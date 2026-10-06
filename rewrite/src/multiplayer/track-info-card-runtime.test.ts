import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { disposeTrackCard, drawTrackCardClippedText,
  drawTrackCardLabel, renderTrackCard, setTrackCardBgm,
  setTrackCardVisible, slideTrackCardOut, updateTrackCard,
  type TrackInfoCardDependencies, type TrackInfoCardHost,
} from "./track-info-card-runtime";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class M7 {");
const end = release.indexOf("\nfunction ys0(", start);
assert.ok(start >= 0 && end > start);
const originalClass = release.slice(start, end);

type Method = "bgm" | "visible" | "slide" | "render" |
  "label" | "clipped" | "dispose";

function observe(rewritten: boolean, method: Method, variant: "normal" |
  "disposed" | "hidden" | "complete" | "zero-size" | "wrap") {
  const events: unknown[][] = [];
  const dependencyValues = {
    configureCanvas: (...args: unknown[]) => {
      events.push(["configure", args[2], args[3], args[4], args[5], args[6]]);
    },
    pixelRatio: () => 1.5,
    drawTrack: (_context: unknown, image: unknown, rect: unknown,
      x: number, y: number) => events.push(["track", image, rect, x, y]),
    drawReverse: (_context: unknown, image: unknown, x: number, y: number,
      width: number, height: number) =>
      events.push(["reverse", image, x, y, width, height]),
    drawDifficulty: (_context: unknown, difficulty: unknown, assets: unknown,
      x: number, y: number) =>
      events.push(["difficulty", difficulty, assets, x, y]),
    drawLabel: (_context: unknown, text: string, rect: unknown,
      options: unknown) => events.push(["label", text, rect, options]),
    releaseFont: (font: unknown) => events.push(["release-font", font]),
    removeResizeListener: (_listener: unknown) => events.push(["remove-resize"]),
  } as TrackInfoCardDependencies;
  const helperValues = {
    vs0: (position: number, width: number, elapsed: number) => {
      const step = Math.fround(Math.min(4, elapsed >>> 0));
      const adjustX = Math.fround(Math.fround(position) -
        Math.fround(Math.fround(3) * step));
      return { adjustX, complete: -width > adjustX };
    },
    p3: dependencyValues.configureCanvas,
    xe: dependencyValues.pixelRatio,
    jd: 1600, Xd: 900,
    ys0: dependencyValues.drawTrack,
    As0: dependencyValues.drawReverse,
    Ms0: dependencyValues.drawDifficulty,
    m9: dependencyValues.drawLabel,
    gs0: '16px "P3553 Source Han Sans CN TrackInfoCard"',
    Og: "P3553 Source Han Sans CN TrackInfoCard", hs0: 16,
    G1: dependencyValues.releaseFont,
    window: { removeEventListener: dependencyValues.removeResizeListener },
  };
  const Original = new Function(...Object.keys(helperValues),
    `${originalClass}\nreturn M7;`)(...Object.values(helperValues)) as
    new () => TrackInfoCardHost & {
      setBgmName(name: string): void;
      setVisible(value: boolean): void;
      slideOut(): void;
      update(nowMs: number): void;
      dispose(): void;
    };
  const host = Object.create(Original.prototype) as InstanceType<typeof Original>;
  const context = {
    font: "", textBaseline: "", textAlign: "", fillStyle: "",
    clearRect(...args: number[]) { events.push(["clear", ...args]); },
    drawImage(image: unknown, ...args: number[]) {
      events.push(["image", image, ...args]);
    },
    save() { events.push(["save"]); },
    beginPath() { events.push(["begin"]); },
    rect(...args: number[]) { events.push(["rect", ...args]); },
    clip() { events.push(["clip"]); },
    fillText(text: string, ...args: number[]) {
      events.push(["text", text, ...args, this.fillStyle]);
    },
    restore() { events.push(["restore"]); },
  };
  const layout = {
    adjustX: 4, adjustY: 10, width: 300, height: 220,
    stripIndex: 1, stripHeight: 25, cardTop: 30, cardHeight: 180,
    trackRect: { x: 10, y: 11, width: 100, height: 80 },
    gameSpeed: { rect: { x: 1, y: 2, width: 20, height: 12 },
      color: "red", align: "left", verticalAlign: "middle" },
    gameInfo: { rect: { x: 5, y: 6, width: 30, height: 12 },
      color: "green", align: "center", verticalAlign: "top" },
    teamName: { rect: { x: 8, y: 9, width: 25, height: 13 },
      color: "blue", align: "right", verticalAlign: "bottom" },
    bgmRect: { x: 12, y: 16, width: 60, height: 14 }, bgmColor: "yellow",
    trackNameRect: { x: 14, y: 21, width: 130, height: 17 },
    trackNameColor: "white",
  };
  Object.assign(host, {
    root: { clientWidth: variant === "zero-size" ? 0 : 1200,
      clientHeight: 720 },
    trackTitle: "赛道", trackDifficulty: 4,
    bgmTitles: new Map([["track", "音乐甲"]]),
    gameLabels: { gameSpeed: "快速", gameInfo: "竞速", teamName: "红队" },
    assets: { layout, frame: { image: "frame", width: 300, height: 180 },
      label: { image: "label", width: 300, height: 50 },
      track: { image: "track", width: 100, height: 80 },
      reverseStamp: { image: "reverse", width: 100, height: 80 },
      difficulty: "difficulty", font: "font" },
    canvas: { hidden: false, remove() { events.push(["remove-canvas"]); } },
    context,
    resizeObserver: { disconnect() { events.push(["disconnect"]); } },
    onWindowResize: () => undefined,
    bgmName: "", visible: variant !== "hidden",
    slidingOut: false,
    adjustX: variant === "complete" ? -300 : 4,
    lastUpdateMs: variant === "wrap" ? 0xfffffff0 : undefined,
    disposed: variant === "disposed",
  });
  if (rewritten) Object.assign(host, {
    setBgmName(name: string) { setTrackCardBgm(host, name); },
    setVisible(value: boolean) { setTrackCardVisible(host, value); },
    slideOut() { slideTrackCardOut(host); },
    update(nowMs: number) { updateTrackCard(host, nowMs); },
    dispose() { disposeTrackCard(host, dependencyValues); },
    render() { renderTrackCard(host, dependencyValues); },
    drawLabel(text: string, box: typeof layout.gameSpeed, x: number, y: number) {
      drawTrackCardLabel(host, text, box, x, y, dependencyValues);
    },
    drawClippedText(text: string, box: typeof layout.bgmRect, x: number,
      y: number, color: string) {
      drawTrackCardClippedText(host, text, box, x, y, color);
    },
  });

  if (method === "bgm") {
    host.setBgmName("track");
    host.setBgmName("track");
    host.setBgmName("missing");
  } else if (method === "visible") {
    host.setVisible(false);
    host.setVisible(true);
  } else if (method === "slide") {
    host.slideOut();
    host.update(variant === "wrap" ? 5 : 1000);
    host.update(1016);
    host.update(1032);
  } else if (method === "render") host.render();
  else if (method === "label") host.drawLabel("快速", layout.gameSpeed, 20, 30);
  else if (method === "clipped") {
    host.drawClippedText("赛道", layout.trackNameRect, 20, 30, "red");
    host.drawClippedText("", layout.trackNameRect, 20, 30, "red");
  } else { host.dispose(); host.dispose(); }
  return { events, disposed: host.disposed, visible: host.visible,
    slidingOut: host.slidingOut, adjustX: host.adjustX,
    lastUpdateMs: host.lastUpdateMs, hidden: host.canvas.hidden,
    bgmName: host.bgmName };
}

test("race track card drawing, slide, visibility and cleanup match release", () => {
  for (const method of ["bgm", "visible", "slide", "render", "label",
    "clipped", "dispose"] as const) {
    for (const variant of ["normal", "disposed", "hidden", "complete",
      "zero-size", "wrap"] as const) {
      assert.deepEqual(observe(true, method, variant),
        observe(false, method, variant), `${method}:${variant}`);
    }
  }
});
