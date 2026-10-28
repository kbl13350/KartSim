import assert from "node:assert/strict";
import test from "node:test";
import { appendTaiwanVehicleDefinitions, availableTaiwanVehicles, taiwanVehicle,
  taiwanVehicles } from "./taiwan-vehicles";
import { VehicleSpecCatalog } from "../physics/catalog";
import { createBodyParamSpec } from "../physics/body-param";
import { createItemPassiveTable, racerPassives } from "../item/item-passives";

function mountedLibrary() {
  const paths = new Set(taiwanVehicles.flatMap(row => {
    const d = row.definition;
    return [row.source === "web-existing" ? row.sourceParameter.path : `kart_/${d.internalId}/param.xml`,
      `kart_/${d.internalId}/model.1s`, `kart_/${d.internalId}/${d.textureKey}.png`];
  }));
  return { exactCanonicalCandidates: (path: string) => paths.has(path) ? [{}] : [] };
}

test("新增身份有独立 16 位 ID，来源元数据完整", () => {
  assert.equal(taiwanVehicles.length, 102);
  assert.equal(new Set(taiwanVehicles.map(row => row.definition.itemId)).size, 102);
  assert.equal(new Set(taiwanVehicles.map(row => row.definition.internalId.toLowerCase())).size, 102);
  assert.equal(taiwanVehicles.filter(row => row.source === "taiwan").length, 96);
  assert.equal(taiwanVehicles.filter(row => row.source === "web-existing").length, 6);
  for (const row of taiwanVehicles) {
    const d = row.definition;
    assert.ok(d.itemId > 50000 && d.itemId <= 65535);
    if (row.source === "taiwan") assert.equal(d.internalId, `tw${d.itemId}_${row.sourceInternalId}`);
    else assert.equal(d.internalId, row.sourceInternalId);
    if (row.sourceTwItemId !== null) assert.equal(d.itemId, 50000 + row.sourceTwItemId);
    for (const key of ["engineGrade", "textureKey", "fixedPlateId", "linkCharacterId",
      "alwaysLinkCharacter", "hideChar", "characterAniType"] as const) assert.notEqual(d[key], undefined);
    assert.ok(row.body.ForwardAccelForce, d.title);
  }
  assert.equal(taiwanVehicle(51901)!.definition.engineGrade, 8);
  assert.equal(taiwanVehicle(51903)!.definition.engineGrade, 2);
});

test("追加身份不覆盖 CN，同车型台服涂装也有自己的唯一目录", () => {
  const original = [{ kind: "kart", itemId: 119, internalId: "pig1", title: "福猪迎祥车 R4" }];
  const library = mountedLibrary();
  assert.equal(appendTaiwanVehicleDefinitions(original, { exactCanonicalCandidates: () => [] }), original);
  const appended = appendTaiwanVehicleDefinitions(original, library);
  assert.equal(appended.length, 103);
  assert.equal(appended[0], original[0]);
  const pig = appended.find(row => row.itemId === 50119)!;
  assert.equal(pig.textureKey, "1_tw");
  assert.notEqual(pig.internalId, "pig1");
  assert.throws(() => appendTaiwanVehicleDefinitions([
    { kind: "kart", itemId: 50119, internalId: "collision" },
  ], library), /冲突/);
  assert.throws(() => availableTaiwanVehicles({ exactCanonicalCandidates: path =>
    path.endsWith("tw50119_pig1/1_tw.png") ? [] : library.exactCanonicalCandidates(path) }), /唯一资源/);
});

test("所有新车物理参数由有效 BodyParam 生成，保留一次速度基线转换", () => {
  const catalog = new VehicleSpecCatalog(new Map(), new Map());
  for (const row of taiwanVehicles) {
    const expected = createBodyParamSpec(row.body, 7, "国服");
    for (const version of ["国服", "国服复古", "韩服复古"] as const) {
      for (const speed of version === "国服" ? [0, 1, 2, 3, 4, 5, 6, 7, 8] : [0, 1, 2, 3, 4, 5]) {
        const result = catalog.lookup(row.definition.itemId, speed, version);
        assert.deepEqual(result.spec, expected, `${row.definition.itemId}:${version}:${speed}`);
        assert.match(result.source, /BodyParam/);
        assert.deepEqual(catalog.createVehicleParameters(row.definition, speed, undefined, version), result);
      }
    }
    for (const value of Object.values(expected)) {
      if (Array.isArray(value)) assert.ok(value.every(Number.isFinite));
      else assert.ok(Number.isFinite(value), row.definition.title);
    }
  }
  assert.equal(catalog.lookup(51451, 7).spec.forwardAccel, 2303);
  assert.throws(() => catalog.lookup(51451, 9), /SpeedType/);
  assert.throws(() => catalog.lookup(51451, 6, "韩服复古"), /SpeedType/);
  assert.throws(() => catalog.lookup(1451, 7), /no vehicle 1451/);
});

test("台服道具特性以新 ID 追加，原国服同号不被覆盖", () => {
  const row = taiwanVehicles.find(row => row.sourceItemAttributes.mine === "100")!;
  assert.ok(row);
  const table = createItemPassiveTable({ name: "itemtable", attributes: [], children: [
    { name: "kart", attributes: [{ name: "id", value: String(row.sourceTwItemId) },
      { name: "mine", value: "5" }], children: [] },
  ] }, undefined, { name: "itemtable", attributes: [], children: [{ name: "kart", children: [],
    attributes: Object.entries({ ...row.sourceItemAttributes, id: String(row.definition.itemId) })
      .map(([name, value]) => ({ name, value })),
  }] });
  assert.equal(racerPassives(table, { "3": row.definition.itemId }).kart.mine, 100);
  assert.equal(racerPassives(table, { "3": row.sourceTwItemId }).kart.mine, 5);
});
