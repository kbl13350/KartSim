#!/usr/bin/env node
// Export the flying-pet tune groups that item races (道具赛) apply to the
// local kart into src/physics/data/item-race-tuning.json.
//
// Flying pets carry `tuneGroupId` only in the CN item table overlay
// (etc_/itemTable@cn.xml <flyingPet id tuneGroupId>; the base itemTable.kml
// rows have none), and each group's ability is an `EnchanterAddSpec` in
// zeta_/cn/enchant/enchant.xml (<TuneGroup id><Tune id='1'><EnchanterAddSpec …/>).
// Group 204 (아이템전 부스터 증가) is `itemBoosterTime='250'` on flying pets 5, 11
// and 17 (卡啾-玄武, 天使熊猫-玄武, 可乐棒棒糖: "在道具赛中使用加速时间更长").
//
// Usage, from rewrite/:
//   node src/physics/extract-item-race-tuning.mjs           write the JSON
//   node src/physics/extract-item-race-tuning.mjs --check   exit 1 if it is stale
// The sources are the p3553 text export in recovered/data-full.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ITEM_RACE_TUNING_SOURCES = Object.freeze({
  itemTable: "recovered/data-full/DataPack1/etc_/itemTable@cn.xml",
  enchant: "recovered/data-full/DataPack4/zeta_/cn/enchant/enchant.xml",
});

const withoutComments = text => text.replace(/<!--[\s\S]*?-->/g, "");

/** Attributes of one start tag (single or double quotes, spaces around `=`). */
function tagAttributes(text) {
  const attributes = {};
  for (const match of text.matchAll(/([\w:.-]+)\s*=\s*(?:'([^']*)'|"([^"]*)")/g))
    if (!(match[1] in attributes)) attributes[match[1]] = match[2] ?? match[3];
  return attributes;
}

function integer(raw, what) {
  const text = String(raw ?? "").trim();
  if (!/^\d+$/.test(text)) throw new Error(`${what}=${raw} 不是非负整数。`);
  return Number(text);
}

function finite(raw, what) {
  const value = Number(String(raw ?? "").trim());
  if (String(raw ?? "").trim() === "" || !Number.isFinite(value))
    throw new Error(`${what}=${raw} 不是有限数。`);
  return value;
}

/** `<flyingPet id tuneGroupId>` rows of the CN item table overlay. */
export function flyingPetTuneGroups(itemTableXml) {
  const groups = {};
  for (const match of withoutComments(itemTableXml).matchAll(/<flyingPet\b([^>]*?)\/?>/g)) {
    const attributes = tagAttributes(match[1]);
    if (attributes.tuneGroupId === undefined) continue;
    const id = integer(attributes.id, "flyingPet id");
    const group = integer(attributes.tuneGroupId, `flyingPet ${id} tuneGroupId`);
    if (String(id) in groups && groups[id] !== group)
      throw new Error(`flyingPet ${id} 的 tuneGroupId 冲突。`);
    groups[id] = group;
  }
  return groups;
}

/** The `EnchanterAddSpec` attributes of each `<TuneGroup>`'s single `<Tune>`. */
export function tuneGroupSpecs(enchantXml, groupIds) {
  const text = withoutComments(enchantXml);
  const specs = {};
  for (const groupId of groupIds) {
    const groups = [...text.matchAll(/<TuneGroup\b([^>]*)>([\s\S]*?)<\/TuneGroup>/g)]
      .filter(match => tagAttributes(match[1]).id === String(groupId));
    if (groups.length !== 1) throw new Error(`enchant.xml 必须恰有一个 TuneGroup ${groupId}。`);
    const tunes = [...groups[0][2].matchAll(/<Tune\b([^>]*)>([\s\S]*?)<\/Tune>/g)];
    if (tunes.length !== 1) throw new Error(`TuneGroup ${groupId} 必须恰有一个 Tune。`);
    const adds = [...tunes[0][2].matchAll(/<EnchanterAddSpec\b([^>]*?)\/?>/g)];
    if (adds.length !== 1) throw new Error(`TuneGroup ${groupId} 必须恰有一个 EnchanterAddSpec。`);
    const spec = {};
    for (const [name, raw] of Object.entries(tagAttributes(adds[0][1])))
      spec[name] = finite(raw, `TuneGroup ${groupId} ${name}`);
    specs[groupId] = spec;
  }
  return specs;
}

/** The whole data file, from the two original documents. */
export function extractItemRaceTuning(itemTableXml, enchantXml) {
  const pets = flyingPetTuneGroups(itemTableXml);
  const groupIds = [...new Set(Object.values(pets))].sort((left, right) => left - right);
  return {
    description: "Flying-pet tune groups (itemTable@cn.xml) and their EnchanterAddSpec " +
      "(enchant.xml). Item races add itemBoosterTime to the local kart; the other fields " +
      "would change speed races and are not applied.",
    sources: { ...ITEM_RACE_TUNING_SOURCES },
    flyingPetTuneGroups: pets,
    tuneGroupSpecs: tuneGroupSpecs(enchantXml, groupIds),
  };
}

export function formatItemRaceTuning(data) {
  return `${JSON.stringify(data, null, 2)}\n`;
}

const here = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const projectRoot = path.resolve(here, "../../..");
  const read = relative => readFileSync(path.join(projectRoot, relative), "utf8");
  const text = formatItemRaceTuning(extractItemRaceTuning(
    read(ITEM_RACE_TUNING_SOURCES.itemTable), read(ITEM_RACE_TUNING_SOURCES.enchant)));
  const target = path.join(here, "data/item-race-tuning.json");
  if (process.argv.includes("--check")) {
    let current = "";
    try { current = readFileSync(target, "utf8"); } catch { /* missing */ }
    if (current !== text) {
      console.error(`${path.relative(projectRoot, target)} is stale; rerun without --check.`);
      process.exit(1);
    }
  } else {
    writeFileSync(target, text);
    console.log(`wrote ${path.relative(projectRoot, target)}`);
  }
}
