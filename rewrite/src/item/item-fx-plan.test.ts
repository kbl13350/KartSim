import assert from "node:assert/strict";
import test from "node:test";
import { ItemIdx, loadItemCatalog } from "./item-catalog";
import { decodeItemBml } from "./item-catalog";
import { CHARGER_SOUND, ITEM_FX_FAMILY, KART_MOTION_MODELS, buildItemFxPlan, type ItemFx } from "./item-fx-plan";
import { SPECIAL_ITEM_ROWS, withSpecialItems } from "./item-special-fixture";
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
  assert.equal(built.sound(ItemIdx.devil, "trapped"), undefined);
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
  assert.deepEqual([fly.impact?.path, fly.kart.trap?.model?.path, fly.impactSound],
    ["item/waterFly/item01.1s", "item/waterFly/fired01.1s", "sound_/fx/item/waterFly/fired.ogg"]);

  const ufo = fx(items.get(ItemIdx.ufo), "ufo");
  assert.deepEqual([ufo.depart.path, ufo.approach.path, ufo.hover.path, ufo.leave.path],
    ["item/ufo/firing00.1s", "item/ufo/fired00.1s", "item/ufo/fired01.1s", "item/ufo/fired02.1s"]);
  assert.deepEqual([ufo.approach.lifeMs, ufo.leave.lifeMs], [1500, 500]);
  assert.deepEqual([ufo.departSound, ufo.arriveSound, ufo.kart.slow?.sound],
    ["sound_/fx/item/ufo/using.ogg", "sound_/fx/item/ufo/affecting.ogg", "sound_/fx/item/ufo/normalAffecting.ogg"]);
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
  assert.equal(banana.kart.trap, undefined);
  assert.equal(banana.impact, undefined);
  assert.deepEqual([banana.eat?.model?.path, banana.eat?.sound],
    ["item/common/바나나먹기.1s", "sound_/fx/item/banana/eat.ogg"]);

  const bomb = fx(items.get(ItemIdx.waterBomb), "throw");
  assert.deepEqual([bomb.flight.path, bomb.set.path, bomb.set.lifeMs, bomb.setSound, bomb.kart.trap?.model?.path],
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

  // The cloud rises, stands and goes where it was used (its Use, Set and Remove item models).
  const cloud = fx(items.get(ItemIdx.cloud2), "cloud");
  assert.deepEqual([cloud.launch?.path, cloud.bornSound, cloud.removeSound],
    ["item/cloud2/무지개구름_사용.1s", "sound_/fx/item/cloud2/born.ogg", "sound_/fx/item/cloud2/disappear.ogg"]);
  assert.deepEqual([cloud.born, cloud.stand, cloud.remove].map(model => [model?.path.split("/").at(-1), model?.lifeMs]),
    [["무지개구름_1.1s", 666], ["무지개구름_2.1s", 10000], ["무지개구름3.1s", 666]]);

  const thunder = fx(items.get(ItemIdx.thunderbolt), "curse");
  assert.deepEqual([thunder.launch, thunder.warning, thunder.strike!, thunder.affect].map(model =>
    [model.path.split("/").at(-1), model.lifeMs]),
  [["벼락_던짐.1s", 500], ["벼락_예고.1s", 1000], ["벼락_피격.1s", 600], ["벼락_피격진행.1s", 1500]]);
  assert.equal(thunder.block.model?.path, "item/thunderbolt/벼락_방어.1s");

  const devil = fx(items.get(ItemIdx.devil), "curse");
  assert.deepEqual([devil.launch, devil.warning, devil.affect, devil.after!].map(model =>
    [model.path, model.lifeMs]), [["item/devil/firing00.1s", 500], ["item/devil/fired01.1s", 1000],
    ["item/devil/fired02.1s", 3000], ["item/devil/fired03.1s", 2000]]);
  assert.equal(devil.afterSound, undefined, "no water bubble sound after a curse");
  assert.equal(devil.strike, undefined);

  const lock = fx(items.get(ItemIdx.slotLock), "lock");
  assert.deepEqual([lock.launch.path, lock.affect.path, lock.affect.lifeMs],
    ["item/slotLock/firing00.1s", "item/slotLock/fired.1s", 3000]);

  const auras = [ItemIdx.shield, ItemIdx.angel, ItemIdx.emp, ItemIdx.scanning]
    .map(idx => fx(items.get(idx), "aura")).map(aura =>
      [aura.effect, aura.model?.path, aura.delayMs, aura.durationMs, aura.onTargets, aura.fromUse]);
  // The Affect models start after their Use state (ITEM_MODE.md C.5); EMP waits for the
  // controller's kartEffect on the racers it frees (C.1).
  assert.deepEqual(auras, [["shield", "item/shield/firing00.1s", 0, 2000, false, true],
    ["angel", "item/angel/fired01.1s", 500, 4000, true, true], ["emp", "item/emp/fired01.1s", 500, 1500, false, false],
    ["scan", "item/scanning/fired01.1s", 500, 8000, true, true]]);

  // Track mines and water mines are the droppable mine and water mine (C.4).
  const mine = fx(items.get(ItemIdx.mine), "throw");
  assert.deepEqual([mine.impact?.path, mine.impactSound, mine.consumed, mine.fallbackDistanceM],
    ["item/common/미사일폭발.1s", "sound_/fx/item/mine/exploding.ogg", true, -4]);
  assert.equal(mine.kart.trap, undefined);
  const waterMine = fx(items.get(ItemIdx.waterMine), "throw");
  assert.deepEqual([waterMine.burst?.path, waterMine.burstSound, waterMine.hitSound, waterMine.impact],
    ["item/waterMine/item03.1s", "sound_/fx/item/waterMine/set.ogg", "sound_/fx/item/waterMine/trapped.ogg",
      undefined]);
  assert.equal(waterMine.kart.trap?.model?.path, "item/common/물방울갇힘_일반.1s");

  assert.equal(items.get(ItemIdx.booster)?.kind, "none");
  assert.deepEqual([built.shared.trap.path, built.shared.trap.lifeMs, built.shared.escapeShield.path],
    ["item/common/물방울갇힘_일반.1s", 2000, "item/common/파란방패.1s"]);
});

async function specialPlan() {
  const library = await loadMirrorLibrary(ITEM_CONTAINERS);
  const catalog = await withSpecialItems(await loadItemCatalog(library), library);
  const balloon = decodeItemBml(await library.exactCanonicalCandidates("item/balloon/item.bml")[0]!.bytes());
  return { library, catalog, plan: buildItemFxPlan(catalog, { balloon }) };
}

const tail = (path: string | undefined) => path?.replace(/^item\/|^sound_\/fx\/item\//, "");

test("every special item (ITEM_MODE.md C.4) is staged from its own folder and variant", async () => {
  const { library, catalog, plan: built } = await specialPlan();
  for (const row of SPECIAL_ITEM_ROWS) {
    const item = built.items.get(row.idx);
    assert.ok(item, `${row.idx} ${row.name}`);
    assert.equal(item.family, ITEM_FX_FAMILY.get(row.idx), row.name);
    // Its states are those of its own base (never base 0 of another variant).
    assert.equal(catalog.get(row.idx)!.base, row.base, row.name);
  }
  for (const model of built.models) assert.equal(library.exactCanonicalCandidates(model.path).length, 1, model.path);
  for (const sound of built.sounds) assert.equal(library.exactCanonicalCandidates(sound).length, 1, sound);
  const items = built.items;
  // Missile reskins: each base's own missile, coke's .flac sounds.
  assert.deepEqual([32, 102, 107, 126, 30].map(idx => tail(fx(items.get(idx), "projectile").flight.path)),
    ["goldRocket/item01.1s", "goldRocket/missile_pinkcandy.1s", "goldRocket/missile_dinoEgg.1s",
      "goldRocket/missile_fox.1s", "cokeRocket/item01.1s"]);
  assert.equal(fx(items.get(30), "projectile").launchSound, "sound_/fx/item/cokeRocket/shooting.flac");
  // Slow-and-blind missiles: no explosion, no kart model; their folders' own cues.
  for (const [idx, folder] of [[99, "tigerRocket"], [136, "pantherRocket"], [131, "deliveryRocket"],
    [108, "dinoClawRocket"], [134, "lionMaskRocket"]] as const) {
    const missile = fx(items.get(idx), "projectile");
    assert.equal(missile.impact, undefined, folder);
    assert.deepEqual([missile.kart.slow?.model, tail(missile.kart.slow?.sound), tail(missile.kart.slow?.afterSound)],
      [undefined, `${folder}/rocketuse.ogg`, `${folder}/rocketend.ogg`]);
  }
  // Lockdown / block missile: AffectMain holds, SetEmp after CountDown, AffectSub slows.
  for (const [idx, flight] of [[104, "lockdownRocket/EMP투척.1s"], [117, "lockdownRocket/네모미사일.1s"]] as const) {
    const lockdown = fx(items.get(idx), "projectile");
    assert.equal(tail(lockdown.flight.path), flight);
    assert.deepEqual([lockdown.field?.countdownMs, tail(lockdown.field?.model?.path), lockdown.field?.model?.lifeMs,
      tail(lockdown.field?.sound)], [500, "lockdownRocket/EMP_피격.1s", 1000, "lockdownRocket/setEmp.ogg"]);
    assert.deepEqual([tail(lockdown.kart.hold?.model?.path), lockdown.kart.hold?.model?.lifeMs,
      tail(lockdown.kart.slow?.model?.path), lockdown.kart.slow?.model?.lifeMs, tail(lockdown.kart.slow?.sound)],
    ["lockdownRocket/락다운이펙_진행.1s", 2000, "lockdownRocket/간접타겟이펙트.1s", 3000, "lockdownRocket/shock.ogg"]);
  }
  // Water flies: own bubbles; 119 locks after its trap (AfterBoost 녹색열쇠).
  assert.deepEqual([118, 119].map(idx => tail(fx(items.get(idx), "projectile").kart.trap?.model?.path)),
    ["snowWaterFly/fired01.1s", "infectedWaterFly/fired01.1s"]);
  const infectedFly = fx(items.get(119), "projectile").kart.trap!;
  assert.deepEqual([tail(infectedFly.after?.path), infectedFly.after?.lifeMs, tail(infectedFly.afterSound)],
    ["common/녹색열쇠.1s", 2000, "infectedWaterFly/locked.ogg"]);
  const bombFly = fx(items.get(120), "projectile");
  assert.deepEqual([bombFly.attach?.carried.key, bombFly.attach?.countdownMs, tail(bombFly.attach?.burst?.path),
    bombFly.attach?.burst?.lifeMs, tail(bombFly.kart.escapeShield?.model?.path), bombFly.kart.escapeShield?.model?.lifeMs],
  ["item/waterBomb/item00.1s#carriedBalloon", 2000, "waterbombFly/item01.1s", 1000, "common/파란방패.1s", 1000]);
  // Water bomb variants: their own throws, sets and bubbles.
  const bombs = [34, 20, 47, 27, 44].map(idx => fx(items.get(idx), "throw"));
  assert.deepEqual(bombs.map(bomb => [tail(bomb.set.path), tail(bomb.kart.trap?.model?.path),
    bomb.kart.trap?.model?.lifeMs, tail(bomb.kart.trap?.after?.path), tail(bomb.kart.escapeShield?.model?.path)]), [
    ["snowBomb/item01.1s", "snowBomb/fired02.1s", 3000, undefined, undefined],
    ["cokeBomb/item01.1s", "common/물방울갇힘_콜라.1s", 2500, undefined, "common/파란방패.1s"],
    ["waterBomb/감옥_물폭파.1s", "waterBomb/감옥_즐.1s", 2000, undefined, "common/파란방패.1s"],
    ["infectedBomb/item01.1s", "infectedBomb/fired02.1s", 2000, "common/녹색열쇠.1s", undefined],
    ["infectedBomb/호박물폭탄_폭파.1s", "infectedBomb/호박물폭탄_공격당함.1s", 2000, "infectedBomb/호박물폭탄_열쇠.1s",
      undefined],
  ]);
  assert.deepEqual(fx(items.get(34), "throw").kart.escapeShield, { sound: "sound_/fx/item/snowBomb/trapped.ogg" },
    "snowBomb's EscapeAffect has no shield model, only its trapped sound");
  // The water fly breaks out with EscapeAffect's `trapped` (its folder has none: waterBomb's).
  assert.equal(fx(items.get(ItemIdx.waterFly), "projectile").kart.escapeShield?.sound,
    "sound_/fx/item/waterBomb/trapped.ogg");
  assert.deepEqual([21, 35, 28].map(idx => tail(fx(items.get(idx), "timeBomb").burst.path)),
    ["timeCokeBomb/item01.1s", "timeSnowBomb/item01.1s", "common/물방울터짐.1s"]);
  // Dropped items: each mine's own model, set where it was dropped; the giant banana; oil; force zone.
  assert.deepEqual([17, 45, 82, 83, 129, 130].map(idx => {
    const mine = fx(items.get(idx), "throw");
    return [tail(mine.set.path), mine.consumed, mine.fallbackDistanceM, tail(mine.impact?.path)];
  }), [
    ["mine/item01.1s", true, -4, "common/미사일폭발.1s"], ["mine/duckbomb_제자리.1s", true, -4, "common/미사일폭발.1s"],
    ["mine/치킨bomb.1s", true, -4, "common/미사일폭발.1s"], ["mine/치킨bomb2.1s", true, -4, "common/미사일폭발.1s"],
    ["mine/태엽폭탄.1s", true, -4, "common/미사일폭발.1s"], ["mine/톱니지뢰.1s", true, -4, "common/미사일폭발.1s"],
  ]);
  assert.deepEqual([tail(fx(items.get(17), "throw").eat?.model?.path), tail(fx(items.get(17), "throw").eat?.bonus?.path)],
    ["common/바나나먹기.1s", "common/루찌획득.1s"]);
  assert.equal(tail(fx(items.get(85), "throw").set.path), "banana/왕바나나.1s");
  const oil = fx(items.get(46), "throw");
  assert.deepEqual([tail(oil.set.path), tail(oil.launchSound), tail(oil.eat?.sound)],
    ["oil/item01.1s", "banana/firing.ogg", "banana/eat.ogg"], "oil's missing sounds fall back to the banana's");
  const zone = fx(items.get(25), "throw");
  assert.deepEqual([tail(zone.set.path), tail(zone.itemImpact?.path), zone.impact],
    ["forceZone/item01.1s", "forceZone/fired00.1s", undefined]);
  // Self items.
  const aura = (idx: number) => fx(items.get(idx), "aura");
  assert.deepEqual([36, 81].map(idx => [aura(idx).effect, tail(aura(idx).model?.path), aura(idx).delayMs,
    aura(idx).durationMs, tail(aura(idx).useSound)]), [
    ["invincible", "goldShield/fired01.1s", 500, 2500, "goldShield/using.ogg"],
    ["invincible", "goldShield/fired02.1s", 500, 4000, "goldShield/protectusing.ogg"],
  ]);
  assert.deepEqual([aura(18).effect, tail(aura(18).model?.path), aura(18).durationMs], ["shield", "shield/GoldS.1s", 3000]);
  assert.deepEqual([aura(101).effect, tail(aura(101).intro?.path), aura(101).fromUse, aura(101).durationMs],
    ["invisible", "ghost/effect_tigerEye.1s", false, 7000]);
  assert.deepEqual([24, 106].map(idx => [tail(aura(idx).intro?.path), tail(aura(idx).model?.path), aura(idx).delayMs,
    aura(idx).durationMs, tail(aura(idx).hitSound)]), [
    [undefined, "siren/firing00.1s", 0, 3000, "siren/trapped.ogg"],
    ["sirenShield/라쳇쉴드_시작.1s", "sirenShield/라쳇쉴드_진행.1s", 200, 2000, "sirenShield/trapped.ogg"],
  ]);
  assert.equal(tail(fx(items.get(103), "magnet").field.path), "magnet/item01.1s");
  // Thrown onto the target.
  const talisman = fx(items.get(137), "beam");
  // Its Use fired00 is a kart-motion track (firedkart only).
  assert.deepEqual([tail(talisman.depart?.path), talisman.approach, tail(talisman.kart.hold?.model?.path),
    talisman.kart.hold?.model?.lifeMs, tail(talisman.arriveSound)],
  ["talisman/부적_사용.1s", undefined, "talisman/부적_피격.1s", 4000, "talisman/아이템 피격.ogg"]);
  const snowman = fx(items.get(112), "beam");
  assert.deepEqual([tail(snowman.depart?.path), snowman.approach, tail(snowman.kart.shrink?.model?.path)],
    ["snowman/firing.1s", undefined, "snowman/fired.1s"]);
  // Curses with their own SpecialShield looks.
  assert.deepEqual([38, 23].map(idx => [tail(fx(items.get(idx), "curse").kart.reverse?.model?.path),
    fx(items.get(idx), "curse").kart.reverse?.model?.lifeMs, tail(fx(items.get(idx), "curse").special.model?.path)]),
  [["newDevil/fired02.1s", 5000, "newDevil/강시_방어효과.1s"], ["drmad/fired02.1s", 5000, "drmad/닥터R_방어효과.1s"]]);
  const abyss = fx(items.get(135), "barricade");
  // StateAffect's fired02_abyss is a kart-motion track: only its sound plays on the stopped kart.
  assert.deepEqual([tail(abyss.active.path), abyss.kart.hold?.model, tail(abyss.kart.hold?.sound)],
    ["abyssBarricade/item01_abyss.1s", undefined, "abyssBarricade/용오름_3_피격효과음.ogg"]);
  // The tornado stands its StateActive at its itemSize; the barricade breaks on its first kart.
  assert.deepEqual([abyss.breaks, abyss.rise.scale, abyss.active.scale, abyss.end.scale], [false, 0.5, 0.8, 0.5]);
  const barricade = fx(items.get(ItemIdx.barricade), "barricade");
  assert.deepEqual([barricade.breaks, barricade.active.scale], [true, undefined]);
  assert.deepEqual([1, 115].map(idx => tail(fx(items.get(idx), "cloud").launch?.path)),
    ["cloud/firing00_black.1s", "cloud2/먹물구름_사용.1s"]);
  assert.equal(items.get(31)?.kind, "none");
  // Hit variants of the classic items (C.2).
  const ufo = fx(items.get(ItemIdx.ufo), "ufo");
  assert.deepEqual([tail(ufo.headband?.slow?.model?.path), ufo.headband?.slow?.model?.lifeMs, tail(ufo.headband?.slow?.sound),
    tail(ufo.bonus?.model?.path), tail(ufo.bonus?.sound)],
  ["ufo/fired03.1s", 1500, "ufo/headBandAffecting.ogg", "common/루찌획득.1s", "ufo/eaten.ogg"]);
  assert.equal(ufo.kart.trap, undefined, "the UFO does not trap");
  assert.deepEqual([tail(fx(items.get(ItemIdx.devil), "curse").special.model?.path)], ["devil/대마왕_방어효과.1s"]);
  assert.deepEqual([tail(fx(items.get(ItemIdx.rocket), "projectile").small?.model?.path),
    fx(items.get(ItemIdx.rocket), "projectile").small?.model?.lifeMs], ["common/미사일폭발.1s", 1000]);
  assert.deepEqual(built.shared.balloon && [built.shared.balloon.popMs, tail(built.shared.balloon.popSound),
    tail(built.shared.balloon.reborn?.path), tail(built.shared.balloon.eatenSound)],
  [1000, "balloon/affect.ogg", "common/루찌획득.1s", "balloon/eaten.ogg"]);
  assert.equal(built.shared.chargerSound, CHARGER_SOUND);
});
