# Compatibility module generator

Run `node tools/generate-modules.mjs` from `rewrite/` after changing the
generator. It reads the exact SHA-256-checked KartSim v39.11 formatted release
bundle and writes `src/generated/`. Do not edit generated files directly.

The generator parses the entire bundle with Babel, splits only at top-level
statements, and computes cross-file imports and exports from lexical bindings.
It also rejects cross-module assignments, unexpected source changes, missing
Garage exports, and imports that would make the generated modules cyclic.
The app entry imports each subsystem in source order so initialization side
effects execute before the app mounts.

Rollup's flattened code had two dependency cycles around vehicle physics,
driving, and the race world. Ten small math helpers (`F2`, `F4`, `m`, `dl`,
`On`, `Rg`, `I1`, `N1`, `Tt`, `t0`) are collected in `math.js` to break them.
Their release implementations are kept verbatim except for splitting `dl`
out of its multi-variable `const` statement.

The generator replaces selected release declarations and class methods with
maintained TypeScript from `src/input/`, `src/resources/`, `src/game/ghost/`,
`src/physics/`, `src/driving/`, `src/world/`, `src/vehicle/`, `src/ui/`,
`src/timeattack/`, `src/multiplayer/`, and `src/app/`. It keeps release symbol
names at the compatibility boundary so existing call sites continue to work.
`src/generated/manifest.json` is the authoritative list of handwritten
overrides for the current fixed release hash. The original Garage chunk is
copied with its sole import redirected to `app.js`; all 89 external aliases
are preserved. The generated modules also export the main game classes to
`src/game/api.ts`.

The vehicle table parser (`qw`) and vehicle parameter lookup (`ek`) are also
replaced by `src/physics/csv.ts` and `src/physics/catalog.ts`. Generated
`data.js` now re-exports `h10`, `d10` and `hn` from editable CSV/JSON through
`src/physics/release-data.ts`; its former 2.9 MB declarations are omitted.
The generated vehicle module passes those parsed tables and override map into
the typed catalog, so the data is not loaded or parsed twice.
Field-level comparisons against the release code cover every captured speed
4/7 row and representative version fallbacks. The generated `AL` driving class
routes all 173 methods through maintained `src/driving/` modules; its fields
and external helpers remain in the compatibility module. The manifest records
their method names.

The single-player path is also an active migration seam. `src/timeattack/`
contains the Ready menu, track selection, random-track launch, race lifecycle,
stage entry and exit, race reset, automatic and checkpoint resets, per-frame
driving coordination, Ghost frame capture, rank/HUD projection, start-grid
placement, stage update/render orchestration, and lifecycle-action dispatch.
The generator replaces the corresponding methods in `ql0`, `df0` and the `Nh0`
record service while
retaining their remaining compatibility methods. `src/app/` owns the stage
manager, race navigation, the presenter's RAF loop, race resource teardown,
track replacement, kart options, startup/resource selection, first-rider
registration, and all `Bf0` application methods and accessors, including
pause, restart and global shortcuts. `src/ui/` supplies selected Ready,
settings, random-track and Garage interactions; `src/vehicle/` supplies
coin, character animation, charge effects, coating and tether behavior;
`src/multiplayer/` supplies the client, lobby and in-race room/frame
coordination. Unlisted class methods, rendering and supporting helpers may
still come from generated modules. The RAF callbacks share one dependency
object, so the wrapper does not allocate a new object each frame. The
generator checks that each targeted release method still exists before
emitting an override.
Release differential tests cover normal and error paths; the built browser
path has been checked from Ready through race countdown and back to Ready.

The Ghost override covers summary keys, legacy summary migration, common
time-base selection, and export filenames. `src/game/ghost/frame-codec.ts`
replaces the small frame-record binary codec (`Ah0`, `bh0`) used for persisted
Ghosts. `src/game/ghost/record-store.ts` replaces the versioned IndexedDB
store (`Th0`), including v1-to-v2 upgrades and v3 raw KSV preservation. These
functions were compared with the release code using byte-level frame fixtures
and v1/v2/v3 database operations. `src/game/ghost/ksv-codec.ts` handles the
complete outer `.ksv` length prefix, KRData flags/checksum/XOR envelope,
v8/v9/v11/v12 headers, equipment and frame records. The generated `Ff` and
`ph0` declarations now call it, passing the release bundle's `fD` zlib
implementation. Compression itself remains in the compatibility module; the
generator omits the retired KSV and Ghost-store helpers after asserting all
their callers were replaced. Tests compare entire KSV file bytes and
decoded structures against the release implementation for all four versions,
both frame z widths, all four KRData flag combinations and malformed files.
The browser fixture `/tests/browser/ksv-codec.html` imports generated `Ff`/
`ph0` and verifies a full write/read cycle with the release zlib engine.
For a real browser IndexedDB round trip, open
`/tests/browser/ghost-store.html` on the Vite development server. It writes
two uniquely named test records, verifies reads and listing, and deletes them.

The result is a stable, buildable migration base, not a recovered copy of the
authors' original source tree. Most compatibility functions still have
compressed names. Replace one subsystem at a time and compare behavior in a
browser, especially asset loading, the Garage chunk, race startup, driving,
and ghost import/export.
