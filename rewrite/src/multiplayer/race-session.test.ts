import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { bindRaceScope, createRaceConnection,
  type RaceSessionHost, type SessionRoom } from "./race-session";

const source = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const classStart = source.indexOf("class LT {");
assert.ok(classStart > 0);
function method(begin: string, end: string): string {
  const first = source.indexOf(begin, classStart);
  const last = source.indexOf(end, first);
  assert.ok(first > classStart && last > first);
  return source.slice(first, last);
}
const Original = new Function(`return class {
  ${method("  raceConnection(", "  bindMotionScope(")}
  ${method("  bindMotionScope(", "  acceptMotion(")}
};`)() as new () => RaceSessionHost & {
  raceConnection(roomId: string, raceId: string, signal: AbortSignal): ReturnType<typeof createRaceConnection>;
  bindMotionScope(room?: SessionRoom): void;
};

const roomId = "11111111-1111-4111-8111-111111111111";
const raceId = "22222222-2222-4222-8222-222222222222";
const self = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const peer = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
function room(phase: SessionRoom["phase"] = "loading"): SessionRoom {
  return { roomId, phase, members: [
    { playerId: self, name: "self", slot: 0, ready: true, team: null },
    { playerId: peer, name: "peer", slot: 2, ready: true, team: null },
  ], race: { raceId, loadedIds: [self, peer] } };
}
function fixture() {
  const commands: unknown[] = [];
  const subscriptions = new Set<(value: any) => void>();
  const motionSubscriptions = new Set<(value: any) => void>();
  const bound: unknown[] = [];
  const host: RaceSessionHost = {
    playerId: self, raceLatencies: new Map([[peer, 88]]),
    echoRtt: { milliseconds: 17, reportAndReset: () => commands.push("reset-rtt") },
    peerTransport: { bind: value => bound.push(value?.phase),
      directAvailable: slot => slot === 2,
      latency: id => id === peer ? 30 : undefined },
    request: async value => { commands.push(value); return { ok: true }; },
    subscribe: listener => { subscriptions.add(listener); return () => { subscriptions.delete(listener); }; },
    subscribeMotion: listener => {
      motionSubscriptions.add(listener);
      return () => { motionSubscriptions.delete(listener); };
    },
    sendMotion: (payload, mask) => { commands.push({ payload, mask }); return true; },
  };
  return { host, commands, bound, subscriptions, motionSubscriptions };
}
function state(host: RaceSessionHost) {
  const scope = host.motionScope;
  const podium = host.podiumScope;
  return {
    motion: scope && { roomId: scope.roomId, raceId: scope.raceId,
      members: [...scope.members], sequence: scope.sequence,
      received: [...scope.received], enabled: scope.enabled,
      recipientMask: scope.recipientMask },
    podium: podium && { roomId: podium.roomId, raceId: podium.raceId,
      members: [...podium.members] },
    latencies: [...host.raceLatencies],
  };
}

test("race and podium scope transitions match release", () => {
  const run = (released: boolean) => {
    const { host, bound } = fixture();
    const original = Object.assign(new Original(), host);
    const target = released ? original : host;
    const bind = (value?: SessionRoom) => released
      ? original.bindMotionScope(value) : bindRaceScope(target, value);
    const snapshots: unknown[] = [];
    bind(room()); snapshots.push(state(target));
    bind(room("countdown")); snapshots.push(state(target));
    const finishing = room("finished");
    finishing.race = { ...finishing.race!, results: {},
      roster: [{ playerId: self }, { playerId: peer }], returnedIds: [peer] };
    bind(finishing); snapshots.push(state(target));
    bind({ ...finishing, phase: "open", race: undefined }); snapshots.push(state(target));
    bind(undefined); snapshots.push(state(target));
    return { snapshots, bound };
  };
  assert.deepEqual(run(false), run(true));
});

test("race commands, scoped event delivery and abort cleanup match release", async () => {
  const run = async (released: boolean) => {
    const { host, commands, subscriptions, motionSubscriptions } = fixture();
    host.motionScope = { roomId, raceId, members: new Set([self, peer]),
      slot: 0, players: new Map([[0, self], [2, peer]]),
      sequence: 0, received: new Map(), enabled: true, recipientMask: 4 };
    const original = Object.assign(new Original(), host);
    const target = released ? original : host;
    const controller = new AbortController();
    const connection = released
      ? original.raceConnection(roomId, raceId, controller.signal)
      : createRaceConnection(target, roomId, raceId, controller.signal);
    const events: unknown[] = [];
    const unsubscribers = [
      connection.subscribeGiantState(event => events.push(["giant", event.type])),
      connection.subscribeTeamGauge(event => events.push(["gauge", event.type])),
      connection.subscribeRaceChat(message => events.push(["chat", message])),
      connection.subscribeAwardMotion(event => events.push(["award", event.type])),
      connection.subscribeMotion(motion => events.push(["motion", motion.sequence])),
    ];
    const initial = { hasMotionRecipients: connection.hasMotionRecipients,
      rtt: connection.motionRoundTripMs,
      direct: connection.directMotionAvailable(2), latency: connection.latencyMs(peer),
      sendMotion: connection.sendMotion("sample", 4) };
    connection.resetMotionRtt();
    await connection.sendTeamCharge(0.5, 3);
    await connection.sendGiantState({ grow: true }, 4);
    await connection.sendAwardMotion("dance");
    await connection.sendRaceChat("hello");
    await connection.reportFinish(12345);
    for (const subscriber of subscriptions) {
      for (const event of [
        { type: "giant-state", roomId, raceId, playerId: peer },
        { type: "team-gauge", roomId, raceId },
        { type: "race-chat", roomId, raceId, message: "go" },
        { type: "award-motion", roomId, raceId, playerId: peer },
      ]) subscriber(event);
    }
    for (const subscriber of motionSubscriptions) subscriber({ roomId, raceId, sequence: 7 });
    controller.abort();
    const afterAbort = { hasMotionRecipients: connection.hasMotionRecipients,
      direct: connection.directMotionAvailable(2),
      subscriptions: subscriptions.size, motionSubscriptions: motionSubscriptions.size };
    await assert.rejects(connection.reportFinish(12346), /expired/);
    unsubscribers.forEach(remove => remove());
    return { initial, commands, events, afterAbort };
  };
  assert.deepEqual(await run(false), await run(true));
});

test("the race scope maps room slots to members for motion frames", () => {
  const { host } = fixture();
  const value = room();
  bindRaceScope(host, value);
  const own = value.members.find(member => member.playerId === self)!;
  assert.equal(host.motionScope?.slot, own.slot);
  assert.deepEqual([...host.motionScope!.players],
    value.members.map(member => [member.slot, member.playerId]));
  const moved = { ...value, members: value.members.map(member =>
    member.playerId === peer ? { ...member, slot: 6 } : member) };
  bindRaceScope(host, moved);
  assert.equal(host.motionScope?.players.get(6), peer);
});
