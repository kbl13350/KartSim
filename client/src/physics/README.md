# Vehicle parameter rewrite

The two captured CSV tables and 436 launcher overrides are copied into
`data/`. Their origin and hashes are documented in
`../../../recovered/embedded-data/manifest.json`. `release-data.ts` restores
the release's `h10`, `d10` and `hn` exports from these editable files. The
separate `bundledVehicleSpecCatalog()` API remains lazy.

## APIs

- `parseKartSpecCsv(text)` validates all 91 columns, CSV quoting, row IDs,
  speeds, duplicate keys and the original f32/u8/u16/i32 numeric types.
- `VehicleSpecCatalog.lookup(itemId, speed, version)` rewrites `ek`: it first
  checks the captured CN table, then the supplemental table, applies the
  launcher overrides, and falls back to speed 7 with a source suffix.
- `VehicleSpecCatalog.createVehicleParameters(vehicle, speed, body, version)`
  rewrites `JI`: regular cars use the catalog; four known system identities
  use a BodyParam resource and the standard speed 7 baseline.
- `createBodyParamSpec(attributes, speed, version)` rewrites the `pS` field
  combination, including boolean strings, f32 rounding, booster sentinel and
  tuned start-acceleration factors.
- `speedTypeEntry(version, speed)` rewrites `r7`, including every baseline
  field, display name, drift-gauge flag and source line metadata.
- `bundledVehicleSpecCatalog()` builds a cached catalog from the local data
  files. Vite imports the CSV and override JSON as raw source text.
- `buildReleaseVehicleData()` rebuilds the original exported strings and Map,
  including Map iteration order and its shared object reference.

The original `vehicle-physics-overrides.mjs` is a 250 KB single-line Map
initializer. `data/vehicle-physics-overrides.json` stores its final 436 key
values as formatted data. JSON cannot express the original shared object for
`1466:4` and `1466:7`, so `data/vehicle-physics-aliases.json` records that
reference. Run `node src/physics/extract-release-data.mjs` to regenerate the
editable files from the hash-checked release extraction. `default-exceed.ts`
expresses the p3553 preset and part-grade calculation as maintainable functions.

## Parity and integration

`catalog.test.ts` isolates the original functions from the immutable recovered
release bundle, so generated overrides cannot become a circular test oracle.
It compares both parsed tables row for row, every available 4/7 lookup against
the original `ek`, representative speed/version fallbacks, all supported speed
baseline fields against `r7`, two BodyParam samples at every supported
speed/version against the isolated release `pS`, and system car cases against
`JI`. It parses real `practiceX` and `practiceblack0` BodyParam XML extracted
from p3553 and compares both `pS` and `JI` results to the release. It also
checks the generated module's override seam. `release-data-builder.test.ts`
compares the CSV bytes, every Map key, field, number, key order and object alias
against the immutable release extraction, then checks the generated data seam.
Run:

```sh
npm test
```

`qw`, `ek`, `r7`, `pS` and `JI` are connected through generator overrides.
Generated `data.js` re-exports the three handwritten data exports. Node tests
register `node-raw-test-hook.mjs` to read Vite `?raw` imports; production builds
use Vite's own loader. Generated `vehicle.js` imports the readable parser and
builds one `VehicleSpecCatalog` from its existing `mS`, `wS` and `hn` tables.
This avoids parsing the data a second time. The release oracle for `r7` and the vehicle
functions is extracted from the immutable downloaded bundle, independent of
these generated overrides. The p3553 XML files are normalized to the release
parser's UTF-16 input before comparison. Malformed-input diagnostic text is
not byte-for-byte identical. Vehicle physics simulation itself is a separate
rewrite task.

In `ek`'s fallback, the requested speed/version checks the SpeedType table and
adds a source suffix. The spec itself comes from the car's speed-7 row; no
target-speed baseline numbers are added. This is confirmed by whole-object
differential assertions, not only source-label comparisons.

## Item-race overlays

`item-race-tuning.ts` adjusts the spec of an item-race (道具赛) kart after the
lookup above; the generated race loader (`A40`, marker `item-mode(p3p)` in
`tools/generate-modules.mjs`) calls `itemRaceVehicleSpec(spec, drivingMode,
kartParameter, flyingPetId)` with the kart's own `param@cn.xml` (else
`param.xml`) document it already loaded. For every other driving mode the spec
object is returned unchanged, so the captured tables, `ek`/`JI` and the parity
tests above are untouched.

- `boostAccelFactorOnlyItem`: the captured CN table has 1.5 on every row; the
  kart XML's `BoosterAccelFactorItem` (1.6–1.8 on over 300 catalog karts)
  replaces it, with the BodyParam precedence (`BoostAccelFactorOnlyItem` first).
- `itemBoosterTime`: flying pets in tune group 204 (`EnchanterAddSpec
  itemBoosterTime='250'`) add 250 ms. `data/item-race-tuning.json` holds the
  flying-pet groups of `etc_/itemTable@cn.xml` and the group specs of
  `zeta_/cn/enchant/enchant.xml`; regenerate it with
  `node src/physics/extract-item-race-tuning.mjs` (`--check` reports a stale
  file). Only `itemBoosterTime` is applied; the other groups (team booster,
  acceleration, cornering) would change speed races.

`item-race-tuning.test.ts` re-exports the JSON from `recovered/data-full`,
checks every catalog kart's factor against its parameter file, and checks the
generated loader line.
