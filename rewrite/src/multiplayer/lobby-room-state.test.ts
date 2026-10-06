import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { lobbyRoomNodeState, type LobbyRoomStateDependencies,
  type LobbyRoomStateHost } from "./lobby-room-state";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class py {");
const end = release.indexOf("\nclass gy {", start);
assert.ok(start >= 0 && end > start);
const originalClass = release.slice(start, end);

type Variant = "host" | "guest" | "team" | "roadblock" | "lte" |
  "countdown" | "hovered" | "busy" | "disconnected" | "loading";

function normalize(value: unknown): unknown {
  if (typeof value === "function") return "[function]";
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, normalize(child)]));
  return value;
}

function observe(rewritten: boolean, name: string, variant: Variant) {
  const events: unknown[][] = [];
  const hostId = variant === "guest" ? "other" : "local";
  const roomMode = variant === "team" ? "team" : "individual";
  const gameplay = variant === "roadblock" ? "roadblock" :
    variant === "lte" ? "lte" : "ordinary";
  const phase = variant === "loading" ? "loading" : "open";
  const local = { playerId: "local", name: "我", ready: variant === "guest",
    changing: false, team: 1 };
  const other = { playerId: "other", name: "对手", ready: true,
    changing: false, team: 2 };
  const room = {
    name: "测试房", speed: 4, mode: roomMode, phase, hostId,
    capacity: 8, members: [local, other], locked: true,
    autoStartAt: variant === "countdown" ? 2000 : undefined,
    kickVote: undefined,
    channelName: "fast",
    chat: [
      { playerId: "local", name: "我", text: "你好" },
      { playerId: "other", name: "对手", text: "#hidden" },
    ],
    race: { roadblock: { noRunnerManualReset: true, limitMs: 120000 } },
  };
  const slots = Array.from({ length: 8 }, (_, slot) => ({ slot, open: slot !== 2,
    member: slot === 0 ? local : slot === 1 ? other : undefined }));
  const dependencies: LobbyRoomStateDependencies = {
    nodeName: node => (node as { name: string }).name,
    slots: () => slots,
    roadblockRunner: () => variant === "roadblock" ? "other" : undefined,
    gameplayMode: () => gameplay,
    decodeChat: text => ({ text: text.startsWith("#") ? "" : text }),
    wrapBubble: text => text.split("|"),
    drawBubbleLine: (_canvas, line, rect, options) => {
      events.push(["bubble", line, rect, options]);
    },
    nowMs: () => 1000,
    roadblockDefaults: { noRunnerManualReset: true, limitMs: 90000 },
    rpChannelNames: { fast: "快速通道" },
    colors: { redTeam: "red", blueTeam: "blue", ownChat: "own",
      otherChat: "other" },
  };
  const legacyDeps = {
    T: dependencies.nodeName,
    FT: dependencies.slots,
    TF: dependencies.roadblockRunner,
    G2: dependencies.gameplayMode,
    Ng: dependencies.decodeChat,
    kl0: dependencies.wrapBubble,
    m9: dependencies.drawBubbleLine,
    tt: dependencies.roadblockDefaults,
    lw: dependencies.rpChannelNames,
    Rl0: dependencies.colors.redTeam,
    Bl0: dependencies.colors.blueTeam,
    _l0: dependencies.colors.ownChat,
    Gl0: dependencies.colors.otherChat,
    performance: { now: dependencies.nowMs },
  };
  const Legacy = new Function(...Object.keys(legacyDeps),
    `${originalClass}\nreturn py;`)(...Object.values(legacyDeps)) as
    new () => LobbyRoomStateHost & { state(node: unknown): Record<string, unknown> };
  const host = Object.create(Legacy.prototype) as InstanceType<typeof Legacy>;
  const emotion = { marker: ":)" };
  Object.assign(host, {
    room, playerId: "local", busy: variant === "busy",
    connected: variant !== "disconnected", chatSending: false,
    chatDraft: "draft", emotionWheelOpen: true, emotions: [emotion],
    bubbles: new Map([["other", { text: "hello|world", until: 1500 }]]),
    previews: { paint(id: string, _canvas: unknown, rect: unknown, now: number) {
      events.push(["preview", id, rect, now]);
    } },
    countdown: { paint(_canvas: unknown, rect: unknown, elapsed: number) {
      events.push(["countdown", rect, elapsed]);
    } },
    view: { hoveredRegionId: variant === "hovered" ? "rider1" : undefined },
    trackImage: { id: "track" }, trackReverseStamp: { id: "reverse" },
    trackIcon: { id: "icon" }, trackDifficulty: 4, trackTitle: "赛道甲",
    actions: {
      slot(slot: number, closed: boolean) { events.push(["slot", slot, closed]); },
      kick(member: typeof local) { events.push(["kick", member.playerId]); },
      transfer(member: typeof local) { events.push(["transfer", member.playerId]); },
      leave() { events.push(["leave"]); },
      ready(ready: boolean) { events.push(["ready", ready]); },
      onStartActivate() { events.push(["activate"]); },
      settings() { events.push(["settings"]); },
      start() { events.push(["start"]); },
      canStart() { return variant !== "busy"; },
      team() { events.push(["team"]); },
      garage() { events.push(["garage"]); },
      track() { events.push(["track"]); },
    },
  });
  host.toggleEmotionWheel = () => { events.push(["toggle-emotion"]); };
  host.closeEmotionWheel = () => { events.push(["close-emotion"]); };
  host.sendEmotion = value => { events.push(["send-emotion", value.marker]); };
  host.sendChat = () => { events.push(["send-chat"]); };
  host.countdownState = () => ({ active: variant === "countdown",
    elapsed: 6500, remaining: 3, cancelLocked: variant === "countdown" });

  const node = { name };
  const state = rewritten ? lobbyRoomNodeState(host, node, dependencies) : host.state(node);
  const normalized = normalize(state);
  const canvas = { drawImage(image: { id: string }, ...args: number[]) {
    events.push(["image", image.id, ...args]);
  } };
  const rect = { x: 10, y: 20, width: 50, height: 60 };
  if (typeof state.onActivate === "function") state.onActivate();
  if (typeof state.action === "function") state.action();
  if (typeof state.paint === "function") state.paint(canvas, rect);
  const input = state.input as {
    change?(value: string): void; submit?(): void;
  } | undefined;
  input?.change?.("changed");
  input?.submit?.();
  return { normalized, events, chatDraft: host.chatDraft };
}

test("room controls, member slots, chat and track state match the release", () => {
  const names = [
    "roomEmotionToggle", "roomEmotionWheel", "roomEmotion/0", "roomEmotion/9",
    "rider0", "rider1", "rider2", "rider3",
    "rider0/riderNameLabel", "rider0/bossTag_me", "rider0/ready",
    "rider1/roadBlockBackground/red", "rider1/roadBlockBackground/blueHover",
    "rider1/roadBlockCover/red", "rider1/teamBackground2Hover",
    "rider1/teamCover2", "rider1/talkBalloon", "rider1/talkBalloon/nametag",
    "rider1/preview", "rider1/kick", "rider1/info", "rider1/runnerHandicap",
    "rider2/closed", "rider2/closedHover", "rider3/btn_singleEmptySlot1_1",
    "rider3/btn_singleEmptySlot1_1Hover", "rider3/singleCover",
    "roomName", "gameSpeed", "gameType", "changeRoomInfoNotPassword",
    "changeRoomInfoPassword", "sessionStateStr", "chat", "채팅",
    "트랙카드", "trackTheme", "roomTrackDifficulty",
    "roomTrackDifficulty/chars", "roadBlockTime", "out_trackName",
    "goBackButton", "readyButtonCont", "teamReadyButtonCont", "ready",
    "cancel", "cancel_count", "changeRoomInfo", "start", "start_count",
    "autoCount", "teamChange", "카트", "트랙", "unknown",
  ];
  const variants: Variant[] = ["host", "guest", "team", "roadblock", "lte",
    "countdown", "hovered", "busy", "disconnected", "loading"];
  for (const variant of variants) {
    for (const name of names) {
      assert.deepEqual(observe(true, name, variant), observe(false, name, variant),
        `${variant}:${name}`);
    }
  }
});
