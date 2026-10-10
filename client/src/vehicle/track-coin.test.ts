import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { TrackCoinContact, type CoinPosition, type CoinView } from "./track-coin";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class y10 {");
const end = release.indexOf("async function A10(", start);
assert.ok(start >= 0 && end > start);
const Original = new Function(`${release.slice(start, end)}\nreturn y10;`)() as new (
  name: string,
  position: CoinPosition,
  resources: { radius: number; eatenLifeMs: number },
  view: CoinView,
  kartPeer: (candidate: unknown) => boolean,
  kartPosition: () => CoinPosition,
  canCollect: () => boolean,
) => TrackCoinContact;

type Scenario = { coin: TrackCoinContact; kart: CoinPosition; peer: object; calls: unknown[][] };
function scenario(released: boolean): Scenario {
  const calls: unknown[][] = [];
  const kart = { x: 0.6, y: 0.2, z: 0.1 };
  const peer = {};
  const view: CoinView = {
    stay(rotation) { calls.push(["stay", rotation]); },
    eaten(position, atMs) { calls.push(["eaten", { ...position }, atMs]); },
    hide() { calls.push(["hide"]); },
    destroy() { calls.push(["destroy"]); },
  };
  const args = ["coin-1", { x: 0, y: 0, z: 0 }, { radius: 1, eatenLifeMs: 300 }, view,
    (candidate: unknown) => candidate === peer, () => kart, () => true] as const;
  const coin = released ? new Original(...args) : new TrackCoinContact(...args);
  return { coin, kart, peer, calls };
}

function compare(label: string, action: (state: Scenario) => void): void {
  const expected = scenario(true), actual = scenario(false);
  action(expected); action(actual);
  const fields = (coin: TrackCoinContact) => ({
    name: coin.name, position: coin.position, resources: coin.resources,
    category: coin.category, active: coin.active,
    removeRequested: coin.removeRequested, state: coin.state,
    eatenAt: coin.eatenAt, target: coin.target, destroyed: coin.destroyed,
  });
  assert.deepEqual(fields(actual.coin), fields(expected.coin), `${label}: state`);
  assert.deepEqual(Object.keys(actual.coin), Object.keys(expected.coin), `${label}: field order`);
  assert.deepEqual(actual.calls, expected.calls, `${label}: view calls`);
  if (actual.coin.target) assert.strictEqual(actual.coin.target, actual.kart, `${label}: target identity`);
}

test("coin contact and state timeline match release", () => {
  compare("idle spin", state => state.coin.slot12(1234));
  compare("collect then animate", state => {
    state.coin.slot13(state.peer, undefined);
    state.coin.slot12(0xffff_ff00);
    state.coin.slot12(0xffff_ff80);
  });
  compare("collect through unsigned wrap and expire", state => {
    state.coin.slot13(state.peer, undefined);
    state.coin.slot12(0xffff_ff00);
    state.coin.slot12(0x0000_002d);
    state.coin.slot12(0x0000_0030);
  });
  compare("negative timestamp coerces to unsigned", state => {
    state.coin.slot13(state.peer, undefined);
    state.coin.slot12(-1);
  });
});

test("collection rejection, invalid distance and destruction match release", () => {
  compare("wrong peer", state => state.coin.slot13({}, undefined));
  compare("far kart", state => { state.kart.x = 2; state.coin.slot13(state.peer, undefined); });
  compare("NaN distance", state => { state.kart.x = NaN; state.coin.slot13(state.peer, undefined); });
  compare("destroy is idempotent", state => {
    state.coin.destroy(); state.coin.slot12(100); state.coin.slot13(state.peer, undefined);
    state.coin.destroy(); state.coin.commit();
  });
  compare("destroy pending coin", state => {
    state.coin.slot13(state.peer, undefined);
    state.coin.destroy(); state.coin.slot12(100);
  });
});
