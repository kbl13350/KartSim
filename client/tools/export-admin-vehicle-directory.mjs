#!/usr/bin/env node
// node --import tsx tools/export-admin-vehicle-directory.mjs [--check]
// The admin inventory includes every selectable native garage identity, even
// when its visibility has been disabled by an administrator.
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { loadResourceLibrary } from "./economy-export/resource-library.mjs";
import { formatDocument } from "./economy-export/canonical.mjs";
import { kartCatalogIdentity } from "../src/resources/system-kart-identity.ts";
import { engineLabel } from "../src/shop/shop-model.ts";

const root = fileURLToPath(new URL("../../", import.meta.url));
const target = new URL("../../server-go/internal/data/economy/vehicle-directory.json", import.meta.url);
const { library } = await loadResourceLibrary(root);
const { karts } = await library.timeAttackGarageCatalog();
const titles = { speed: "竞速车", item: "道具车", other: "其他车辆", system: "系统练习车" };
const vehicles = karts.map(kart => {
  const category = kart.itemId === 0 ? "system" : kart.kartType === 1 ? "item" : kart.kartType === 2 ? "speed" : "other";
  return { id: kartCatalogIdentity(kart), title: kart.title, itemId: kart.itemId,
    ...(kart.systemKey ? { systemKey: kart.systemKey } : {}), internalId: kart.internalId,
    category, categoryTitle: titles[category],
    ...(Number.isSafeInteger(kart.engineGrade) ? { engineGrade: kart.engineGrade } : {}),
    engineTitle: engineLabel(kart) ?? (kart.engineGrade === 0 ? "旧版引擎" : "其他引擎") };
}).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
if (new Set(vehicles.map(vehicle => vehicle.id)).size !== vehicles.length)
  throw Error("Garage catalog contains duplicate stable vehicle identities");
const { text, version } = formatDocument({
  generatedFrom: "client/tools/export-admin-vehicle-directory.mjs: complete mounted native garage catalog, stable kart identities and native shop engine labels. Do not edit by hand.",
  vehicles,
});
if (process.argv.includes("--check")) {
  if (fs.readFileSync(target, "utf8") !== text) throw Error("vehicle-directory.json is stale");
} else fs.writeFileSync(target, text);
console.log(JSON.stringify({ status: process.argv.includes("--check") ? "verified" : "exported",
  vehicles: vehicles.length, version, categories: Object.fromEntries(Object.keys(titles).map(category =>
    [category, vehicles.filter(vehicle => vehicle.category === category).length])) }));
