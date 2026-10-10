import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { cancelCountdownModals, endChangingModal, finishChangingLoad,
  isChangingModalCurrent, releaseChanging, type LobbyChangingHost } from "./lobby-changing";
import { formatMultiplayerError } from "./errors";
import type { ChangingModal } from "./lobby-dialogs";
import type { LobbyRoom } from "./lobby-actions";

const source = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const classStart = source.indexOf("class Wl0 {");
const extract = (name: string, next: string) => {
  const start = source.indexOf(`  ${name}(`, classStart);
  const end = source.indexOf(`  ${next}(`, start);
  assert.ok(start > classStart && end > start);
  return source.slice(start, end);
};
const Original = new Function("C1", `return class {
  ${extract("isChangingModalCurrent", "endChangingModal")}
  ${extract("endChangingModal", "cancelCountdownModals")}
  ${extract("cancelCountdownModals", "finishChangingLoad")}
  ${extract("finishChangingLoad", "async releaseChanging")}
  ${extract("async releaseChanging", "async chooseGarage")}
};`)(formatMultiplayerError) as
  new () => Record<string, (...args: never[]) => unknown>;
type Name = "isChangingModalCurrent" | "endChangingModal" | "cancelCountdownModals" |
  "finishChangingLoad" | "releaseChanging";
const release = (name: Name, host: LobbyChangingHost, ...args: unknown[]) =>
  (Original.prototype[name] as (...args: unknown[]) => unknown).call(host, ...args);

function room(): LobbyRoom {
  return { roomId: "room-1", revision: 1, name: "Room", phase: "open",
    speed: 7, hostId: "host", mode: "individual", members: [
      { playerId: "me", name: "Me", slot: 0, ready: false, team: null, changing: true },
    ] };
}
const modal = (kind: "track" | "garage" = "garage"): ChangingModal =>
  ({ kind, roomId: "room-1", generation: 2,
    entered: true, released: false, releaseAllowed: true });

function fixture(released: boolean) {
  const events: unknown[] = [];
  const host = {
    options: { status: (message: string, error?: boolean) =>
      events.push(["status", message, error]) },
    state: { room: room() },
    client: { request: async (message: Record<string, unknown>) => {
      events.push(["request", message]); return { type: "room" };
    }, dispose: () => events.push("dispose") },
    playerId: "me", connected: true, disposed: false,
    modalLoading: true, garageLoading: true, dialogGeneration: 2,
    changingModal: undefined as ChangingModal | undefined,
    roomView: { countdownLocked: false },
    cancelDialog: () => events.push("cancelDialog"),
    endChangingModal: (value: ChangingModal, allowed = true) => {
      if (released) release("endChangingModal", host as LobbyChangingHost, value, allowed);
      else endChangingModal(host as LobbyChangingHost, value, allowed);
    },
    releaseChanging: async (roomId: string) => { events.push(["releaseChanging", roomId]); },
    render: () => events.push("render"),
    receive: (message: unknown) => events.push(["receive", message]),
  };
  return { host: host as LobbyChangingHost, events };
}

test("editor ownership, countdown and lifecycle match release", () => {
  const run = (released: boolean) => {
    const { host, events } = fixture(released);
    const active = modal();
    host.changingModal = active;
    const isCurrent = (value: ChangingModal) => released
      ? release("isChangingModalCurrent", host, value)
      : isChangingModalCurrent(host, value);
    const result = [isCurrent(active), isCurrent(modal("track"))];
    host.roomView!.countdownLocked = true;
    result.push(isCurrent(active));
    if (released) release("cancelCountdownModals", host);
    else cancelCountdownModals(host);
    host.roomView!.countdownLocked = false;
    if (released) release("finishChangingLoad", host, active, true);
    else finishChangingLoad(host, active, true);
    host.changingModal = undefined;
    if (released) release("endChangingModal", host, active);
    else endChangingModal(host, active);
    return { result, events, modal: active,
      modalLoading: host.modalLoading, garageLoading: host.garageLoading };
  };
  assert.deepEqual(run(false), run(true));
});

test("server changing release and failure handling match release", async () => {
  const run = async (released: boolean, fail: boolean) => {
    const { host, events } = fixture(released);
    if (fail) host.client.request = async () => { throw new Error("ROOM_FULL"); };
    if (released) await release("releaseChanging", host, "room-1");
    else await releaseChanging(host, "room-1");
    return events;
  };
  assert.deepEqual(await run(false, false), await run(true, false));
  assert.deepEqual(await run(false, true), await run(true, true));
});
