import assert from "node:assert/strict";
import test from "node:test";
import { ItemIdx, loadItemCatalog } from "./item-catalog";
import { KART_MOTION_MODELS, buildItemFxPlan, type ItemFx } from "./item-fx-plan";
import { ITEM_CONTAINERS, loadMirrorLibrary } from "./item-test-fixtures";

/** The presenter's model and sound table, resolved on the real p3553 item data. */

async function plan() {
  const library = await loadMirrorLibrary(ITEM_CONTAINERS);
  const catalog = await loadItemCatalog(library);
  return { library, catalog, plan: buildItemFxPlan(catalog) };
}

const fx = <K extends ItemFx["kind"]>(item: ItemFx | undefined, kind: K): Extract<ItemFx, { kind: K }> => {
  assert.equal(item?.kind, kind);
  return item as Extract<ItemFx, { kind: K }>;
};

test("every model and sound the presenter uses resolves to one original file", async () => {
  const { library, plan: built } = await plan();
  assert.ok(built.models.length >= 40, `${built.models.length} models`);
  for (const model of built.models) {
    assert.equal(library.exactCanonicalCandidates(model.path).length, 1, model.path);
    assert.ok(model.lifeMs >= 0, model.key);
    assert.equal(KART_MOTION_MODELS.has(model.path), false, model.path);
  }
  for (const sound of built.sounds) assert.equal(library.exactCanonicalCandidates(sound).length, 1, sound);
  // Every item of the set has a table entry, and every entry's paths are in the preload lists.
  const keys = new Set(built.models.map(model => model.key));
  const sounds = new Set(built.sounds);
  for (const [idx, item] of built.items) {
    for (const value of Object.values(item)) {
      if (value && typeof value === "object" && "key" in value) assert.ok(keys.has(value.key), `${idx} ${value.key}`);
      if (typeof value === "string" && value.startsWith("sound_/")) assert.ok(sounds.has(value), `${idx} ${value}`);
    }
    if (item.block.model) assert.ok(keys.has(item.block.model.key));
    if (item.block.sound) assert.ok(sounds.has(item.block.sound));
  }
  // The controller's aim cues are preloaded.
  for (const stem of ["aiming", "inrange", "ontarget", "misfire"]) {
    assert.ok(sounds.has(`sound_/fx/item/rocket/${stem}.ogg`), stem);
    assert.ok(sounds.has(`sound_/fx/item/magnet/${stem}.ogg`), stem);
  }
  assert.equal(built.sound(ItemIdx.rocket, "aiming"), "sound_/fx/item/rocket/aiming.ogg");
  assert.equal(built.sound(ItemIdx.devil, "trapped"), "sound_/fx/item/waterBomb/trapped.ogg");
  assert.equal(built.sound(ItemIdx.rocket, "nothing"), undefined);
});

test("the table follows the base-0 item.bml states", async () => {
  const { plan: built } = await plan();
  const items = built.items;
  for (const idx of [ItemIdx.rocket, ItemIdx.guideRocket, ItemIdx.randomRocket]) {
    const rocket = fx(items.get(idx), "projectile");
    assert.equal(rocket.flight.path, "item/rocket/item01.1s");
    assert.equal(rocket.flight.lifeMs, 1500);
    assert.equal(rocket.speed, 100);
    assert.equal(rocket.launchSound, "sound_/fx/item/rocket/shooting.ogg");
    assert.deepEqual([rocket.impact?.path, rocket.impact?.lifeMs], ["item/common/미사일폭발.1s", 1500]);
    assert.equal(rocket.impactSound, "sound_/fx/item/rocket/exploding.ogg");
    assert.deepEqual([rocket.block.model?.path, rocket.block.model?.lifeMs, rocket.block.sound],
      ["item/common/쉴드방어.1s", 1000, "sound_/fx/item/rocket/shield.ogg"]);
  }
  const fly = fx(items.get(ItemIdx.waterFly), "projectile");
  assert.deepEqual([fly.flight.path, fly.flight.lifeMs, fly.speed], ["item/waterFly/item00.1s", 2000, 60]);
  assert.deepEqual([fly.impact?.path, fly.trap?.path, fly.impactSound],
    ["item/waterFly/item01.1s", "item/waterFly/fired01.1s", "sound_/fx/item/waterFly/fired.ogg"]);

  const ufo = fx(items.get(ItemIdx.ufo), "ufo");
  assert.deepEqual([ufo.depart.path, ufo.approach.path, ufo.hover.path, ufo.leave.path],
    ["item/ufo/firing00.1s", "item/ufo/fired00.1s", "item/ufo/fired01.1s", "item/ufo/fired02.1s"]);
  assert.deepEqual([ufo.approach.lifeMs, ufo.leave.lifeMs], [1500, 500]);
  assert.deepEqual([ufo.departSound, ufo.arriveSound],
    ["sound_/fx/item/ufo/using.ogg", "sound_/fx/item/ufo/affecting.ogg"]);
  // The UFO has no Shield model: a blocked UFO shows the shield's 쉴드방어.
  assert.deepEqual([ufo.block.model?.path, ufo.block.sound],
    ["item/common/쉴드방어.1s", "sound_/fx/item/shield/shield.ogg"]);

  assert.equal(fx(items.get(ItemIdx.magnet), "magnet").field.path, "item/magnet/item01.1s");

  const banana = fx(items.get(ItemIdx.banana), "throw");
  assert.deepEqual([banana.flight.path, banana.flight.lifeMs, banana.set.path, banana.set.lifeMs],
    ["item/banana/item00.1s", 500, "item/banana/item01.1s", 30000]);
  assert.deepEqual([banana.launchSound, banana.hitSound, banana.fallbackDistanceM],
    ["sound_/fx/item/banana/firing.ogg", "sound_/fx/item/banana/trapped.ogg", -4]);
  // banana's Affect 당함 is a kart-motion track only (the spin is physics).
  assert.equal(banana.trap, undefined);

  const bomb = fx(items.get(ItemIdx.waterBomb), "throw");
  assert.deepEqual([bomb.flight.path, bomb.set.path, bomb.set.lifeMs, bomb.setSound, bomb.trap?.path],
    ["item/waterBomb/item00.1s", "item/waterBomb/item01.1s", 1000, "sound_/fx/item/waterBomb/set.ogg",
      "item/common/물방울갇힘_일반.1s"]);

  const timeBomb = fx(items.get(ItemIdx.timeBomb), "timeBomb");
  assert.deepEqual([timeBomb.carried.key, timeBomb.carried.lifeMs, timeBomb.burst.path, timeBomb.burst.lifeMs],
    ["item/waterBomb/item00.1s#carriedBalloon", 3000, "item/common/물방울터짐.1s", 1000]);
  assert.deepEqual([timeBomb.launchSound, timeBomb.burstSound],
    ["sound_/fx/item/timeBomb/firing.ogg", "sound_/fx/item/timeBomb/set.ogg"]);

  const barricade = fx(items.get(ItemIdx.barricade), "barricade");
  assert.deepEqual([barricade.launch, barricade.rise, barricade.active, barricade.end].map(model =>
    [model.path.split("/").at(-1), model.lifeMs]),
  [["바리게이트_사용.1s", 1000], ["바리게이트_시작.1s", 266], ["바리게이트_진행.1s", 5000], ["바리게이트_끝.1s", 500]]);
  assert.deepEqual([barricade.launchSound, barricade.riseSound, barricade.endSound].map(path => path?.split("/").at(-1)),
    ["장애물 발사.ogg", "장애물 등장.ogg", "장애물 피격.ogg"]);
  assert.equal(barricade.block.sound, "sound_/fx/item/shield/shield.ogg");

  const cloud = fx(items.get(ItemIdx.cloud2), "cloud");
  assert.deepEqual([cloud.launch.path, cloud.coverMs, cloud.bornSound, cloud.removeSound],
    ["item/cloud2/무지개구름_사용.1s", 10666, "sound_/fx/item/cloud2/born.ogg", "sound_/fx/item/cloud2/disappear.ogg"]);

  const thunder = fx(items.get(ItemIdx.thunderbolt), "curse");
  assert.deepEqual([thunder.launch, thunder.warning, thunder.strike!, thunder.affect].map(model =>
    [model.path.split("/").at(-1), model.lifeMs]),
  [["벼락_던짐.1s", 500], ["벼락_예고.1s", 1000], ["벼락_피격.1s", 600], ["벼락_피격진행.1s", 1500]]);
  assert.equal(thunder.block.model?.path, "item/thunderbolt/벼락_방어.1s");

  const devil = fx(items.get(ItemIdx.devil), "curse");
  assert.deepEqual([devil.launch, devil.warning, devil.affect, devil.after!].map(model =>
    [model.path, model.lifeMs]), [["item/devil/firing00.1s", 500], ["item/devil/fired01.1s", 1000],
    ["item/devil/fired02.1s", 3000], ["item/devil/fired03.1s", 2000]]);
  assert.equal(devil.afterSound, "sound_/fx/item/waterBomb/trapped.ogg");
  assert.equal(devil.strike, undefined);

  const lock = fx(items.get(ItemIdx.slotLock), "lock");
  assert.deepEqual([lock.launch.path, lock.affect.path, lock.affect.lifeMs],
    ["item/slotLock/firing00.1s", "item/slotLock/fired.1s", 1000]);

  const auras = [ItemIdx.shield, ItemIdx.angel, ItemIdx.emp, ItemIdx.scanning]
    .map(idx => fx(items.get(idx), "aura")).map(aura => [aura.effect, aura.model.path, aura.durationMs, aura.onTargets]);
  assert.deepEqual(auras, [["shield", "item/shield/firing00.1s", 2000, false],
    ["angel", "item/angel/fired01.1s", 4000, true], ["emp", "item/emp/fired01.1s", 1500, false],
    ["scan", "item/scanning/fired01.1s", 8000, false]]);

  const mine = fx(items.get(ItemIdx.mine), "hazard");
  assert.equal(mine.impact?.path, "item/common/미사일폭발.1s");
  const waterMine = fx(items.get(ItemIdx.waterMine), "hazard");
  assert.deepEqual([waterMine.burst?.path, waterMine.burstSound, waterMine.hitSound],
    ["item/waterMine/item03.1s", "sound_/fx/item/waterMine/set.ogg", "sound_/fx/item/waterMine/trapped.ogg"]);

  assert.equal(items.get(ItemIdx.booster)?.kind, "none");
  assert.deepEqual([built.shared.trap.path, built.shared.trap.lifeMs, built.shared.escapeShield.path],
    ["item/common/물방울갇힘_일반.1s", 2000, "item/common/파란방패.1s"]);
});
