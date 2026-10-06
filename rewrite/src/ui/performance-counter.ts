const histogramStepMs = 0.5;
const histogramMaxMs = 2_000;
const histogramBins = histogramMaxMs / histogramStepMs + 1;
const thresholdsMs = [8.33, 16.67, 33.33, 50, 100, 250, 1_000];
const bytesPerMib = 1_024 * 1_024;
const samplingWindowMs = 1_000;
const workSmoothing = 0.1;
const gcDropThresholdBytes = 1_572_864;

export interface DurationDistribution {
  averageMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
  low1Ms: number;
  low01Ms: number;
  low1Fps: number;
  low01Fps: number;
  minFps: number;
}

function histogramIndex(durationMs: number): number {
  return Math.min(histogramBins - 1, Math.floor(durationMs / histogramStepMs));
}

function binUpperBound(index: number): number {
  return Math.min(histogramMaxMs, (index + 1) * histogramStepMs);
}

function slowestTailAverage(histogram: Uint32Array, frames: number,
  proportion: number): number {
  if (frames === 0) return 0;
  const count = Math.max(1, Math.ceil(frames * proportion));
  let remaining = count;
  let total = 0;
  for (let index = histogram.length - 1; index >= 0 && remaining > 0; index--) {
    const frequency = histogram[index]!;
    if (frequency === 0) continue;
    const take = Math.min(frequency, remaining);
    total += take * binUpperBound(index);
    remaining -= take;
  }
  return total / count;
}

export function durationDistribution(histogram: Uint32Array,
  frames: number, totalMs: number, maximumMs: number): DurationDistribution {
  if (frames === 0) return {
    averageMs: 0, p50Ms: 0, p95Ms: 0, p99Ms: 0, maxMs: 0,
    low1Ms: 0, low01Ms: 0, low1Fps: 0, low01Fps: 0, minFps: 0,
  };
  const medianCount = Math.ceil(frames * 0.5);
  const p95Count = Math.ceil(frames * 0.95);
  const p99Count = Math.ceil(frames * 0.99);
  let counted = 0;
  let p50Ms = 0;
  let p95Ms = 0;
  let p99Ms = 0;
  for (let index = 0; index < histogram.length; index++) {
    counted += histogram[index]!;
    const upper = binUpperBound(index);
    if (p50Ms === 0 && counted >= medianCount) p50Ms = upper;
    if (p95Ms === 0 && counted >= p95Count) p95Ms = upper;
    if (counted >= p99Count) { p99Ms = upper; break; }
  }
  const low1Ms = slowestTailAverage(histogram, frames, 0.01);
  const low01Ms = slowestTailAverage(histogram, frames, 0.001);
  return {
    averageMs: totalMs / frames,
    p50Ms, p95Ms, p99Ms, maxMs: maximumMs,
    low1Ms, low01Ms,
    low1Fps: low1Ms > 0 ? 1_000 / low1Ms : 0,
    low01Fps: low01Ms > 0 ? 1_000 / low01Ms : 0,
    minFps: maximumMs > 0 ? 1_000 / maximumMs : 0,
  };
}

const roundHundredth = (value: number): number => Math.round(value * 100) / 100;

export function longTaskObserverSupported(): boolean {
  return typeof PerformanceObserver !== "undefined" &&
    (PerformanceObserver.supportedEntryTypes?.includes("longtask") ?? false);
}

let cachedTimerResolutionMs: number | undefined;
export function timerResolutionMs(): number {
  if (cachedTimerResolutionMs !== undefined) return cachedTimerResolutionMs;
  let minimum = Infinity;
  for (let index = 0; index < 500; index++) {
    const first = performance.now();
    const second = performance.now();
    if (second > first) minimum = Math.min(minimum, second - first);
  }
  cachedTimerResolutionMs = Number.isFinite(minimum) ? minimum : 0;
  return cachedTimerResolutionMs;
}

const milliseconds = (value: number): string =>
  value >= histogramMaxMs ? `${value.toFixed(1)} ms` : `${value.toFixed(2)} ms`;
const memoryMib = (bytes: number): string =>
  `${(bytes / bytesPerMib).toFixed(1)} MiB`;
const decimalMs = (value: number): string =>
  Number.isFinite(value) ? value >= 100
    ? `${value.toFixed(1)} ms` : value >= 1
      ? `${value.toFixed(3)} ms` : `${(value * 1_000).toFixed(1)} µs`
    : "n/a";
const raceDuration = (durationMs: number): string => {
  const seconds = durationMs / 1_000;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${(seconds - minutes * 60).toFixed(2).padStart(5, "0")}`;
};

/** Shared formatting used by both the report and the on-screen F3 panel. */
export const formatPerformanceMilliseconds = milliseconds;
export const formatPerformanceMemory = memoryMib;
export const formatPerformanceDecimal = decimalMs;

function thresholdReport(counts: Uint32Array, frames: number): string[] {
  return thresholdsMs.map((threshold, index) => {
    const count = counts[index]!;
    const ratio = frames > 0 ? (count * 100) / frames : 0;
    return `  > ${threshold.toFixed(2).padStart(7)} ms: ${String(count).padStart(8)} (${ratio.toFixed(3)}%)`;
  });
}

interface HeapSample { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number }
interface HeapPerformance extends Performance { memory?: HeapSample }

/** Measures frame time, main-thread work, long tasks and sampled heap changes. */
export class PerformanceCounter {
  frameHistogram = new Uint32Array(histogramBins);
  workHistogram = new Uint32Array(histogramBins);
  thresholdCounts = new Uint32Array(thresholdsMs.length);
  longTaskObserver?: PerformanceObserver;
  longTaskSupported: boolean;
  raceStarted = false;
  raceStartTimeMs = 0;
  raceEndTimeMs = 0;
  raceStartedAt = "";
  frameCount = 0;
  totalFrameMs = 0;
  totalWorkMs = 0;
  latestFrameMs = 0;
  latestWorkMs = 0;
  workWindowStartMs = 0;
  workWindowSumMs = 0;
  workWindowCount = 0;
  workWindowMeanMs = 0;
  workEmaMs = 0;
  workEmaInitialized = false;
  maxFrameMs = 0;
  maxWorkMs = 0;
  maxStallMs = 0;
  panelPeakFrameMs = 0;
  panelPeakWorkMs = 0;
  pendingSkipFrames = 0;
  longTaskCount = 0;
  longTaskTotalMs = 0;
  longTaskMaxMs = 0;
  heapStartBytes = 0;
  heapCurrentBytes = 0;
  heapTotalBytes = 0;
  heapLimitBytes = 0;
  heapMinBytes = 0;
  heapMaxBytes = 0;
  heapLargestDropBytes = 0;
  heapWindowStartMs = 0;
  heapWindowActive = false;
  heapWindowAllocBytes = 0;
  heapWindowGcDrops = 0;
  heapWindowFrameCount = 0;
  heapAllocMiBPerSec = 0;
  heapGcPerSec = 0;
  heapAllocKiBPerFrame = 0;
  heapGcDropTotal = 0;

  constructor() {
    this.longTaskSupported = longTaskObserverSupported();
    if (this.longTaskSupported) {
      this.longTaskObserver = new PerformanceObserver(entries =>
        this.recordLongTasks(entries));
      this.longTaskObserver.observe({ entryTypes: ["longtask"] });
    }
  }

  dispose(): void { this.longTaskObserver?.disconnect(); }

  beginRace(nowMs = performance.now()): void {
    this.frameHistogram.fill(0);
    this.workHistogram.fill(0);
    this.thresholdCounts.fill(0);
    this.raceStarted = true;
    this.raceStartTimeMs = nowMs;
    this.raceEndTimeMs = 0;
    this.raceStartedAt = new Date().toISOString();
    this.frameCount = 0;
    this.totalFrameMs = 0;
    this.totalWorkMs = 0;
    this.latestFrameMs = 0;
    this.latestWorkMs = 0;
    this.maxFrameMs = 0;
    this.maxWorkMs = 0;
    this.maxStallMs = 0;
    this.panelPeakFrameMs = 0;
    this.panelPeakWorkMs = 0;
    this.workWindowStartMs = 0;
    this.workWindowSumMs = 0;
    this.workWindowCount = 0;
    this.workWindowMeanMs = 0;
    this.workEmaMs = 0;
    this.workEmaInitialized = false;
    this.pendingSkipFrames = 1;
    this.longTaskCount = 0;
    this.longTaskTotalMs = 0;
    this.longTaskMaxMs = 0;
    this.resetHeapSamples(nowMs);
  }

  finishRace(nowMs = performance.now()): void {
    if (this.raceStarted && this.raceEndTimeMs === 0) {
      this.raceEndTimeMs = nowMs;
      this.sampleHeap(nowMs);
    }
  }

  recordFrame(frameMs: number, workMs: number, nowMs: number): boolean {
    if (!this.containsTime(nowMs)) return false;
    if (this.pendingSkipFrames > 0) {
      this.pendingSkipFrames -= 1;
      return false;
    }
    const frame = Math.max(0, frameMs);
    const work = Math.max(0, workMs);
    this.workEmaMs = this.workEmaInitialized
      ? this.workEmaMs + (work - this.workEmaMs) * workSmoothing : work;
    this.workEmaInitialized = true;
    if (this.workWindowCount === 0) this.workWindowStartMs = nowMs;
    this.workWindowSumMs += work;
    this.workWindowCount += 1;
    if (nowMs - this.workWindowStartMs >= samplingWindowMs) {
      this.workWindowMeanMs = this.workWindowSumMs / this.workWindowCount;
      this.workWindowSumMs = 0;
      this.workWindowCount = 0;
      this.workWindowStartMs = nowMs;
    }
    this.frameCount += 1;
    this.totalFrameMs += frame;
    this.totalWorkMs += work;
    this.latestFrameMs = frame;
    this.latestWorkMs = work;
    this.maxFrameMs = Math.max(this.maxFrameMs, frame);
    this.maxWorkMs = Math.max(this.maxWorkMs, work);
    this.maxStallMs = Math.max(this.maxStallMs, frame - work);
    this.panelPeakFrameMs = Math.max(this.panelPeakFrameMs, frame);
    this.panelPeakWorkMs = Math.max(this.panelPeakWorkMs, work);
    this.frameHistogram[histogramIndex(frame)]! += 1;
    this.workHistogram[histogramIndex(work)]! += 1;
    this.recordThresholds(frame);
    this.heapWindowFrameCount += 1;
    this.sampleHeap(nowMs);
    return true;
  }

  skipNextFrame(): void {
    this.pendingSkipFrames = Math.max(this.pendingSkipFrames, 1);
  }

  isRaceActive(): boolean {
    return this.raceStarted && this.raceEndTimeMs === 0;
  }

  summary(): Record<string, any> {
    const frame = durationDistribution(this.frameHistogram, this.frameCount,
      this.totalFrameMs, this.maxFrameMs);
    const work = durationDistribution(this.workHistogram, this.frameCount,
      this.totalWorkMs, this.maxWorkMs);
    const averageFps = this.totalFrameMs > 0
      ? (this.frameCount * 1_000) / this.totalFrameMs : 0;
    return {
      hasRace: this.raceStarted,
      active: this.isRaceActive(),
      durationMs: this.totalFrameMs,
      frameCount: this.frameCount,
      averageFps,
      latestFrameMs: this.latestFrameMs,
      latestWorkMs: this.latestWorkMs,
      workWindowMeanMs: this.workWindowMeanMs,
      workEmaMs: this.workEmaMs,
      timerResolutionMs: timerResolutionMs(),
      crossOriginIsolated: globalThis.crossOriginIsolated === true,
      panelPeakFrameMs: this.panelPeakFrameMs,
      panelPeakWorkMs: this.panelPeakWorkMs,
      maxStallMs: this.maxStallMs,
      frame, work,
      thresholdCounts: this.thresholdCounts.slice(),
      longTaskSupported: this.longTaskSupported,
      longTaskCount: this.longTaskCount,
      longTaskTotalMs: this.longTaskTotalMs,
      longTaskMaxMs: this.longTaskMaxMs,
      heapSupported: this.heapStartBytes > 0,
      heapStartBytes: this.heapStartBytes,
      heapCurrentBytes: this.heapCurrentBytes,
      heapTotalBytes: this.heapTotalBytes,
      heapLimitBytes: this.heapLimitBytes,
      heapMinBytes: this.heapMinBytes,
      heapMaxBytes: this.heapMaxBytes,
      heapLargestDropBytes: this.heapLargestDropBytes,
      heapAllocMiBPerSec: this.heapAllocMiBPerSec,
      heapAllocKiBPerFrame: this.heapAllocKiBPerFrame,
      heapGcPerSec: this.heapGcPerSec,
      heapGcDropTotal: this.heapGcDropTotal,
    };
  }

  clearPanelPeaks(): void {
    this.panelPeakFrameMs = 0;
    this.panelPeakWorkMs = 0;
  }

  formatReport(): string {
    const state = this.summary();
    const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    const longTaskLine = state.longTaskSupported
      ? `Long tasks (>50 ms): ${state.longTaskCount}, total ${milliseconds(state.longTaskTotalMs)}, max ${milliseconds(state.longTaskMaxMs)}`
      : "Long Tasks API: unavailable";
    const heapLine = state.heapSupported
      ? `JS heap: start ${memoryMib(state.heapStartBytes)}, current ${memoryMib(state.heapCurrentBytes)}, min ${memoryMib(state.heapMinBytes)}, max ${memoryMib(state.heapMaxBytes)}, committed ${memoryMib(state.heapTotalBytes)}, limit ${memoryMib(state.heapLimitBytes)}, largest sampled drop ${memoryMib(state.heapLargestDropBytes)}`
      : "JS heap: unavailable";
    return [
      "KartRider Web Performance Report v1",
      `State: ${state.active ? "running" : state.hasRace ? "finished" : "not started"}`,
      `Started: ${this.raceStartedAt || "n/a"}`,
      `Captured: ${new Date().toISOString()}`,
      `URL: ${location.href}`,
      `User agent: ${navigator.userAgent}`,
      `Viewport: ${window.innerWidth}x${window.innerHeight} @ ${window.devicePixelRatio.toFixed(2)} DPR`,
      `CPU threads: ${navigator.hardwareConcurrency || "unknown"}`,
      `Device memory: ${deviceMemory === undefined ? "unavailable" : `${deviceMemory} GiB (rounded)`}`,
      "",
      `Duration: ${raceDuration(state.durationMs)}`,
      `Frames: ${state.frameCount}`,
      `Average FPS: ${state.averageFps.toFixed(2)}`,
      `Frame interval: avg ${milliseconds(state.frame.averageMs)}, p50 ${milliseconds(state.frame.p50Ms)}, p95 ${milliseconds(state.frame.p95Ms)}, p99 ${milliseconds(state.frame.p99Ms)}, max ${milliseconds(state.frame.maxMs)}`,
      `Low FPS: 1% ${state.frame.low1Fps.toFixed(1)}, 0.1% ${state.frame.low01Fps.toFixed(1)}, min ${state.frame.minFps.toFixed(1)}`,
      `Main-thread work: avg ${milliseconds(state.work.averageMs)}, p50 ${milliseconds(state.work.p50Ms)}, p95 ${milliseconds(state.work.p95Ms)}, p99 ${milliseconds(state.work.p99Ms)}, max ${milliseconds(state.work.maxMs)}, 1s window mean ${decimalMs(state.workWindowMeanMs)}, EMA ${decimalMs(state.workEmaMs)}`,
      `Worst stall (frame minus work): ${milliseconds(state.maxStallMs)}`,
      `Allocation: ${state.heapAllocKiBPerFrame.toFixed(1)} KiB/frame, ${state.heapAllocMiBPerSec.toFixed(2)} MiB/s, GC drops ${state.heapGcPerSec.toFixed(2)} /s (window) / ${state.heapGcDropTotal} total`,
      "",
      "Frame interval counts:",
      ...thresholdReport(state.thresholdCounts, state.frameCount),
      "",
      longTaskLine,
      heapLine,
      "",
      "Notes:",
      "- Frame interval includes browser scheduling, background throttling, and work outside this callback.",
      "- Main-thread work measures this game's animation callback through render submission; it is not GPU time.",
      "- JS heap is Chromium-only and approximate; a large drop is evidence of reclamation, not proof of a GC pause.",
    ].join("\n");
  }

  containsTime(nowMs: number): boolean {
    return this.raceStarted && nowMs >= this.raceStartTimeMs &&
      (this.raceEndTimeMs === 0 || nowMs <= this.raceEndTimeMs);
  }

  recordThresholds(frameMs: number): void {
    for (let index = 0; index < thresholdsMs.length; index++)
      if (frameMs > thresholdsMs[index]!) this.thresholdCounts[index]! += 1;
  }

  recordLongTasks(list: PerformanceObserverEntryList): void {
    for (const entry of list.getEntries()) {
      if (!this.containsTime(entry.startTime)) continue;
      this.longTaskCount += 1;
      this.longTaskTotalMs += entry.duration;
      this.longTaskMaxMs = Math.max(this.longTaskMaxMs, entry.duration);
    }
  }

  resetHeapSamples(nowMs: number): void {
    this.heapStartBytes = 0;
    this.heapCurrentBytes = 0;
    this.heapTotalBytes = 0;
    this.heapLimitBytes = 0;
    this.heapMinBytes = 0;
    this.heapMaxBytes = 0;
    this.heapLargestDropBytes = 0;
    this.heapWindowStartMs = 0;
    this.heapWindowActive = false;
    this.heapWindowAllocBytes = 0;
    this.heapWindowGcDrops = 0;
    this.heapWindowFrameCount = 0;
    this.heapAllocMiBPerSec = 0;
    this.heapGcPerSec = 0;
    this.heapAllocKiBPerFrame = 0;
    this.heapGcDropTotal = 0;
    this.sampleHeap(nowMs);
  }

  sampleHeap(nowMs: number): void {
    const heap = (performance as HeapPerformance).memory;
    if (!heap) return;
    const current = heap.usedJSHeapSize;
    this.heapTotalBytes = heap.totalJSHeapSize;
    this.heapLimitBytes = heap.jsHeapSizeLimit;
    if (this.heapStartBytes === 0) {
      this.heapStartBytes = current;
      this.heapMinBytes = current;
      this.heapMaxBytes = current;
    } else {
      const delta = current - this.heapCurrentBytes;
      if (delta > 0) this.heapWindowAllocBytes += delta;
      else if (delta <= -gcDropThresholdBytes) {
        this.heapWindowGcDrops += 1;
        this.heapGcDropTotal += 1;
        this.heapLargestDropBytes = Math.max(this.heapLargestDropBytes, -delta);
      }
      this.heapMinBytes = Math.min(this.heapMinBytes, current);
      this.heapMaxBytes = Math.max(this.heapMaxBytes, current);
    }
    this.heapCurrentBytes = current;
    if (!this.heapWindowActive) {
      this.heapWindowActive = true;
      this.heapWindowStartMs = nowMs;
    }
    const elapsed = nowMs - this.heapWindowStartMs;
    if (elapsed >= samplingWindowMs) {
      this.heapAllocMiBPerSec = roundHundredth(
        this.heapWindowAllocBytes / (elapsed / 1_000) / bytesPerMib);
      this.heapGcPerSec = roundHundredth(
        this.heapWindowGcDrops / (elapsed / 1_000));
      this.heapAllocKiBPerFrame = this.heapWindowFrameCount > 0
        ? Math.round((this.heapWindowAllocBytes /
          this.heapWindowFrameCount / 1_024) * 10) / 10 : 0;
      this.heapWindowAllocBytes = 0;
      this.heapWindowGcDrops = 0;
      this.heapWindowFrameCount = 0;
      this.heapWindowStartMs = nowMs;
    }
  }
}
