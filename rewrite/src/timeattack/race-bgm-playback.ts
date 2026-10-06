/** BGM selection, crossfades, and audio-node cleanup during a race. */

interface AudioSource {
  buffer?: unknown;
  start(): void;
  stop(): void;
  disconnect(): void;
}

interface AudioGain {
  gain: unknown;
  disconnect(): void;
}

interface PlayingBgm {
  source: AudioSource;
  gain: AudioGain;
}

export interface RaceBgmHost {
  context: {
    currentTime: number;
    createBufferSource(): AudioSource;
    createGain(): AudioGain;
  };
  readyBuffer: unknown;
  garageBuffer: unknown;
  winBuffer: unknown;
  loseBuffer: unknown;
  random: { next(): number };
  current?: PlayingBgm;
  retiring?: PlayingBgm;
  transitionTimer?: ReturnType<typeof setInterval>;
  transitionStep: number;
  raceBuffers: unknown[];
  raceNames: unknown[];
  currentRaceNameValue?: unknown;
  multiplayerBuffers?: {
    lobby: unknown; room: unknown; finish: unknown; podium: unknown;
  };
  start(buffer: unknown, loop: boolean, fade: boolean): void;
  playResult(won: boolean): void;
  playReady(): void;
  dispose(): void;
  advanceTransition(): void;
  clearTransition(): void;
  stop(owner?: PlayingBgm): void;
}

export interface RaceBgmPlaybackDependencies {
  setLoop(source: AudioSource, loop: boolean): void;
  setGain(gain: unknown, value: number, time: number): void;
  connect(context: RaceBgmHost["context"], source: AudioSource,
    channel: string, gain: AudioGain): void;
  setDucking(context: RaceBgmHost["context"], fading: boolean): void;
  fadeCurve(step: number): { incoming: number; outgoing: number };
  schedule(callback: () => void, intervalMs: number): ReturnType<typeof setInterval>;
  cancel(timer: ReturnType<typeof setInterval>): void;
}

export function playMultiplayerBgm(host: RaceBgmHost,
  kind: "lobby" | "room"): void {
  const buffer = host.multiplayerBuffers?.[kind];
  if (!buffer) throw Error("多人 BGM 尚未加载。");
  if (host.current?.source.buffer !== buffer) host.start(buffer, true, true);
}

export function playMultiplayerPodiumBgm(host: RaceBgmHost): void {
  const buffer = host.multiplayerBuffers?.podium;
  if (!buffer) throw Error("颁奖台音乐尚未加载。");
  if (host.current?.source.buffer !== buffer) host.start(buffer, false, false);
}

export function playMultiplayerFinishBgm(host: RaceBgmHost,
  won: boolean): void {
  if (won) {
    host.playResult(true);
    return;
  }
  const buffer = host.multiplayerBuffers?.finish;
  if (!buffer) throw Error("多人完赛音乐尚未加载。");
  host.start(buffer, false, false);
}

export function restartRaceBgm(host: RaceBgmHost): void {
  const index = host.random.next() % host.raceBuffers.length;
  host.currentRaceNameValue = host.raceNames[index];
  host.start(host.raceBuffers[index], true, true);
}

export function currentRaceBgmName(host: RaceBgmHost): unknown {
  return host.currentRaceNameValue;
}

export function playReadyBgm(host: RaceBgmHost): void {
  if (host.current?.source.buffer !== host.readyBuffer) {
    host.start(host.readyBuffer, true, true);
  }
}

export function playGarageBgm(host: RaceBgmHost): void {
  if (host.current?.source.buffer !== host.garageBuffer) {
    host.start(host.garageBuffer, true, true);
  }
}

export function playMyItemsBgm(host: RaceBgmHost): void {
  host.playReady();
}

export function playResultBgm(host: RaceBgmHost, won: boolean): void {
  host.start(won ? host.winBuffer : host.loseBuffer, false, false);
}

export function disposeRaceBgm(host: RaceBgmHost): void {
  host.clearTransition();
  host.stop(host.retiring);
  host.stop(host.current);
  host.retiring = undefined;
  host.current = undefined;
}

export function silenceRaceBgm(host: RaceBgmHost): void {
  host.dispose();
}

export function startRaceBgm(host: RaceBgmHost, buffer: unknown,
  loop: boolean, fade: boolean,
  dependencies: RaceBgmPlaybackDependencies): void {
  host.clearTransition();
  host.stop(host.retiring);
  host.retiring = fade ? host.current : undefined;
  if (!fade) host.stop(host.current);
  const source = host.context.createBufferSource();
  const gain = host.context.createGain();
  source.buffer = buffer;
  dependencies.setLoop(source, loop);
  dependencies.setGain(gain.gain, fade ? 0 : 1, host.context.currentTime);
  dependencies.connect(host.context, source, "bgm", gain);
  source.start();
  host.current = { source, gain };
  if (fade) {
    host.transitionStep = 0;
    dependencies.setDucking(host.context, true);
    host.transitionTimer = dependencies.schedule(
      () => host.advanceTransition(), 100);
  }
}

export function advanceRaceBgmTransition(host: RaceBgmHost,
  dependencies: RaceBgmPlaybackDependencies): void {
  if (!host.current) return host.clearTransition();
  if (host.transitionStep >= 16) {
    host.stop(host.retiring);
    host.retiring = undefined;
    host.clearTransition();
    return;
  }
  const mix = dependencies.fadeCurve(host.transitionStep++);
  dependencies.setGain(host.current.gain.gain, mix.incoming,
    host.context.currentTime);
  dependencies.setGain(host.retiring?.gain.gain, mix.outgoing,
    host.context.currentTime);
}

export function clearRaceBgmTransition(host: RaceBgmHost,
  dependencies: RaceBgmPlaybackDependencies): void {
  if (host.transitionTimer !== undefined) {
    dependencies.cancel(host.transitionTimer);
  }
  host.transitionTimer = undefined;
  dependencies.setDucking(host.context, false);
}

export function stopRaceBgmOwner(owner?: PlayingBgm): void {
  if (!owner) return;
  try {
    owner.source.stop();
  } catch {
    // The released client still disconnects a source that has already stopped.
  }
  owner.source.disconnect();
  owner.gain.disconnect();
}
