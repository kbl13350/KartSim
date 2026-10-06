import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import { loadRaceCharacters } from "../src/vehicle/race-character-loading.ts";

const source = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const assetOwner = parse(source, { sourceType: "module" }).program.body.find(node =>
  node.type === "ClassDeclaration" && node.id.name === "ul");
assert.ok(assetOwner);
const method = assetOwner.body.body.find(node => node.key?.name === "loadRaceCharacters");
assert.ok(method);
const methodText = source.slice(method.start, method.end);
const Original = new Function(`return class { constructor(assetHost) { this.assetHost = assetHost; } ${methodText} };`)();

async function exercise(kind, input) {
  const calls = [];
  const profile = { equipment: { itemIds: { 70: input.riderId ?? 42 } } };
  const library = input.library === false ? undefined : {
    async timeAttackLinkedCharacterItem(id) {
      calls.push(["linked item", id]);
      return { path: "character_linked.rho", internalId: id };
    },
  };
  const host = {
    userProfile: profile,
    getLibrary() { calls.push(["library"]); return library; },
  };
  const owner = new Original(host);
  owner.loadCharacterAsset = async (...args) => {
    calls.push(["character", ...args]);
    return { scene: { object: { visible: true } }, path: args[0] };
  };
  const kart = {
    itemId: 123, linkCharacterId: input.linkId ?? 0,
    alwaysLinkCharacter: !!input.always,
    hideChar: !!input.hide,
    characterAniType: input.animationType ?? 0,
  };
  const args = ["character_common.rho", { id: "normal" }, kart,
    { motions: 1 }, true, { env: 2 }, { stage: 3 }, !!input.award];
  try {
    const value = kind === "original"
      ? await owner.loadRaceCharacters(...args)
      : await loadRaceCharacters(owner, ...args);
    return { value, calls };
  } catch (error) {
    return { error: error.message, calls };
  }
}

test("ordinary and linked race character loading match release branches", async () => {
  for (const input of [
    { riderId: 0 }, {}, { hide: true }, { award: true, animationType: 1 },
    { linkId: 2 }, { linkId: 2, always: true, award: true },
    { linkId: 2, hide: true }, { linkId: 2, animationType: 1 },
    { linkId: 2, library: false },
  ]) assert.deepEqual(await exercise("rewritten", input),
    await exercise("original", input), JSON.stringify(input));
});
