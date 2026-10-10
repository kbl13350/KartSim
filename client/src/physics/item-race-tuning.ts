/**
 * Item-race (道具赛) overlays on a kart spec (ITEM_MODE.md C.2, C.5). The race
 * loader (generated A40) applies them after the CN kart table lookup and the
 * flying-pet parameters, for item races only, so speed and time-attack specs
 * stay exactly what the release built.
 *
 * - `BoosterAccelFactorItem`: the CN kart table captured from the server has
 *   `boostAccelFactorOnlyItem` 1.5 on every row, while the kart's own
 *   `param@cn.xml` (or `param.xml`) gives the item booster factor (1.6–1.8,
 *   e.g. `kart_/justice_Z7GT/param@cn.xml` `BoosterAccelFactorItem ='1.65'`).
 *   The loader already reads that file for every kart; its value replaces the
 *   table's, with the same precedence as BodyParam karts (body-param.ts:
 *   `BoostAccelFactorOnlyItem`, then `BoosterAccelFactorItem`).
 * - Flying-pet tune group 204 (`EnchanterAddSpec itemBoosterTime='250'`,
 *   enchant.xml) adds 250 ms to `itemBoosterTime`. The group comes from
 *   `itemTable@cn.xml` (`data/item-race-tuning.json`, exported by
 *   `extract-item-race-tuning.mjs`); the garage catalog reads only the base
 *   table, whose flying pets have no `tuneGroupId`, so nothing else applies it.
 *   The other groups (team booster, acceleration, cornering) would change
 *   speed races and are not applied here.
 */
import tuningJson from "./data/item-race-tuning.json?raw";

export interface ItemRaceTuningData {
  flyingPetTuneGroups: Record<string, number>;
  tuneGroupSpecs: Record<string, Record<string, number>>;
}

/** A kart parameter document as the loader holds it (`jp(...)`), or a plain attribute map. */
export type KartParameterInput =
  | { body: { attributes: ReadonlyArray<{ name: string; value: string }> } }
  | Readonly<Record<string, string>>;

export interface ItemRaceSpecFields {
  boostAccelFactorOnlyItem: number;
  itemBoosterTime: number;
}

const f32 = Math.fround;
let bundled: ItemRaceTuningData | undefined;

/** The exported flying-pet tune groups. */
export function itemRaceTuningData(): ItemRaceTuningData {
  bundled ??= JSON.parse(tuningJson) as ItemRaceTuningData;
  return bundled;
}

function attribute(input: KartParameterInput, name: string): string | undefined {
  if ("body" in input && typeof input.body === "object" && input.body !== null &&
      Array.isArray((input.body as { attributes?: unknown }).attributes)) {
    const attributes = (input.body as { attributes: ReadonlyArray<{ name: string; value: string }> })
      .attributes;
    return attributes.find(item => item.name === name)?.value;
  }
  const value = (input as Readonly<Record<string, unknown>>)[name];
  return typeof value === "string" ? value : undefined;
}

function finiteAttribute(input: KartParameterInput, name: string): number | undefined {
  const raw = attribute(input, name)?.trim();
  if (raw === undefined || raw === "") return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`车辆参数 ${name}=${raw} 不是有限数。`);
  return value;
}

/** The item booster factor a kart's own parameter file sets, if any. */
export function kartItemBoosterAccelFactor(kartParameter: KartParameterInput | undefined):
  number | undefined {
  if (!kartParameter) return undefined;
  const value = finiteAttribute(kartParameter, "BoostAccelFactorOnlyItem") ??
    finiteAttribute(kartParameter, "BoosterAccelFactorItem");
  return value === undefined ? undefined : f32(value);
}

/** Extra `itemBoosterTime` from an equipped flying pet's tune group (204: +250). */
export function flyingPetItemBoosterBonusMs(flyingPetId: number | undefined,
  data: ItemRaceTuningData = itemRaceTuningData()): number {
  if (!flyingPetId || !Number.isSafeInteger(flyingPetId) || flyingPetId <= 0) return 0;
  const group = data.flyingPetTuneGroups[String(flyingPetId)];
  if (group === undefined) return 0;
  const bonus = data.tuneGroupSpecs[String(group)]?.itemBoosterTime ?? 0;
  return Number.isFinite(bonus) ? bonus : 0;
}

/**
 * The spec an item-race kart drives with. Outside item races (any other
 * `drivingMode`) the same object comes back untouched.
 */
export function itemRaceVehicleSpec<T extends ItemRaceSpecFields>(spec: T,
  drivingMode: { kind?: string } | undefined,
  kartParameter: KartParameterInput | undefined,
  flyingPetId: number | undefined,
  data: ItemRaceTuningData = itemRaceTuningData()): T {
  if (drivingMode?.kind !== "item") return spec;
  const factor = kartItemBoosterAccelFactor(kartParameter);
  const bonus = flyingPetItemBoosterBonusMs(flyingPetId, data);
  if (factor === undefined && bonus === 0) return spec;
  return {
    ...spec,
    ...(factor === undefined ? {} : { boostAccelFactorOnlyItem: factor }),
    ...(bonus === 0 ? {} : { itemBoosterTime: f32(spec.itemBoosterTime + bonus) }),
  };
}
