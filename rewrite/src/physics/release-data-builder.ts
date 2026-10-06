/** The shape of the original release's embedded vehicle data exports. */
export interface ReleaseVehicleData {
  h10: string;
  d10: string;
  hn: Map<string, Record<string, number>>;
}

function objectEntries(value: unknown, name: string): [string, unknown][] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${name} must be a JSON object`);
  }
  return Object.entries(value);
}

function sameFields(left: Record<string, number>, right: Record<string, number>): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return leftKeys.length === rightKeys.length &&
    leftKeys.every((key, index) => key === rightKeys[index] && Object.is(left[key], right[key]));
}

/**
 * Recreate the original h10/d10 strings and hn Map from editable CSV and JSON.
 *
 * JSON preserves the override numbers and field order, but cannot represent
 * two Map keys pointing to one object. The alias file records that one extra
 * piece of the release's object graph. Updating an existing Map key preserves
 * its original iteration position.
 */
export function buildReleaseVehicleData(
  capturedCsv: string,
  supplementalCsv: string,
  overridesJson: string,
  aliasesJson: string,
): ReleaseVehicleData {
  const hn = new Map<string, Record<string, number>>();
  for (const [key, value] of objectEntries(JSON.parse(overridesJson), "vehicle overrides")) {
    const fields = objectEntries(value, `vehicle override ${key}`);
    if (fields.some(([, field]) => typeof field !== "number" || !Number.isFinite(field))) {
      throw new TypeError(`vehicle override ${key} must contain finite numbers`);
    }
    hn.set(key, value as Record<string, number>);
  }

  for (const [alias, target] of objectEntries(JSON.parse(aliasesJson), "vehicle aliases")) {
    if (typeof target !== "string") throw new TypeError(`alias target for ${alias} must be a string`);
    const aliasFields = hn.get(alias);
    const targetFields = hn.get(target);
    if (!aliasFields || !targetFields) throw new Error(`missing vehicle override alias ${alias} -> ${target}`);
    if (!sameFields(aliasFields, targetFields)) {
      throw new Error(`vehicle override alias ${alias} differs from ${target}`);
    }
    hn.set(alias, targetFields);
  }

  return { h10: capturedCsv, d10: supplementalCsv, hn };
}
