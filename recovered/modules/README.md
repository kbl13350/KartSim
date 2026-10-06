# Inferred subsystem slices

These files are verbatim sections of [`../formatted/index.js`](../formatted/index.js), split at verified top-level declaration boundaries. They are **reference-only**: bundling flattened the author's original modules, and declarations in one slice refer to names in other slices. The startup export list also refers to names defined elsewhere. These files are not independent ES modules or a runnable replacement for the mirror.

Run `node recovered/tools/split-bundle.mjs` from the workspace root to regenerate them. The splitter has no package dependencies, checks the formatted bundle's SHA-256 and each boundary marker, and writes offsets and hashes to `manifest.json`. Ranges refer to UTF-16 code units in the formatted JavaScript string. Adjacent slices preserve every character of their respective source ranges.

| File | Starts at | Navigation anchors |
| --- | --- | --- |
| [00-vendor-three.js](00-vendor-three.js) | bundle start | Vite preload helper, Three.js r178 |
| [01-formats-and-scene.js](01-formats-and-scene.js) | `s2` | Binary XML, track PRS/`.1s`, `.rho`/`.rho5` and `aaa.pk` formats |
| [02-asset-library-and-hud.js](02-asset-library-and-hud.js) | `Sw` | Asset repository `Sw`, metadata, HUD and menus |
| [03-vehicle-parameters-and-effects.js](03-vehicle-parameters-and-effects.js) | `f10` | Vehicle parameter merge `pS`, gauge/effect/audio classes `iv`, `Cn0`, `pv` |
| [04-driving-simulation.js](04-driving-simulation.js) | `AL` | Vehicle simulation class `AL` |
| [05-race-world.js](05-race-world.js) | `_L` | Track scene `_L`, race runtime `jr0`, performance diagnostics |
| [06-ui-selection.js](06-ui-selection.js) | `Ma0` | Canvas UI, garage, track selection, settings |
| [07-multiplayer.js](07-multiplayer.js) | `ll0` | WebRTC `pl0`, network client `LT`, lobby `Wl0`, menu coordinator `ql0` |
| [08-time-attack-and-replay.js](08-time-attack-and-replay.js) | `GF` | Time attack, touch controls, ghost store `Pt`, race controller `df0` |
| [09-app-bootstrap.js](09-app-bootstrap.js) | `Bf0` | App root, mounting side effects, exports consumed by the garage chunk |

The large top-level `h10` declaration through the five following `hn.set(...)` calls is omitted from the slices to avoid duplicating roughly 2.9 million formatted code units. Its two CSV literals and override Map are available in [`../embedded-data/`](../embedded-data/). The [architecture index](../analysis/architecture.md) explains the symbol roles and original bundle layout in more detail. All subsystem labels here are inferred; original file and module boundaries are unknown.
