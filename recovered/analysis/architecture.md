# Recovered bundle architecture

This index describes the downloaded KartSim v39.11 release files, especially `mirror/assets/index-DoW2rQpI.js` (5,118,505 bytes). It is a navigation aid for reconstruction; the regions below are approximate and are **not** evidence of the author's original filenames or module layout. Offsets are zero-based UTF-16 code-unit positions in the decoded JavaScript string, with the end position excluded.

The main file is a Vite/Rollup-style ES module with 3,319 top-level statements: 2,510 function declarations, 341 class declarations, 422 variable declarations, and one export declaration. It has no static imports and exports 89 names for the lazy garage chunk. No local `.map` file or `sourceMappingURL` was found. The bundle still preserves many class method and object property names, strings, and data schemas, while local variable names and original module boundaries are mostly lost.

## Entrypoints and chunks

| File | Structure | Role |
| --- | --- | --- |
| `mirror/index.html` | Loads the main JS and CSS | Page entrypoint and `#app` root |
| `mirror/assets/index-DoW2rQpI.js` | Main ES module | Rendering, resource decoding, simulation, UI, networking, and app startup |
| `mirror/assets/GarageXView-DSeU5AUN.js` | 208,059 bytes; 89 static imports from main; 10 named exports | Lazy garage UI, opened by `ql0` at main-bundle offset 4,819,441 |
| `mirror/assets/ArchiveIndexDecodeWorker-CfvjruiE.js` | Self-contained worker | Archive index decoding |
| `mirror/assets/OpfsDownloadWorker-D3FLEvg5.js` | Self-contained worker | OPFS download stream |
| `mirror/assets/VorbisDecodeWorker-IhDQFtip.js` | Self-contained worker | Audio decode using `motor-vorbis-B0OpSz3w.wasm` |

The workers are instantiated in the main bundle with `new Worker(new URL(..., import.meta.url), {type: 'module'})`. The garage is loaded with `import('./GarageXView-DSeU5AUN.js')`. Preserve those asset paths or adjust them together when creating a new source layout.

## Main bundle regions

| Approximate range | Evidence and inferred subsystem |
| --- | --- |
| 0–489,165 | Vite module-preload helper, then bundled Three.js r178 (`vm="178"` near 5,808; renderer class `I4` ends at 489,165). Treat as vendored code. |
| 489,165–766,911 | Game format and scene code: binary XML decoder `s2`/`CW`, track PRS and `track.1s` parser, culling/render adapters, `.rho`/`.rho5` and `aaa.pk` handling. `MY` near 729,458 validates RHO5 parts. |
| 766,911–1,024,876 | Asset library `Sw` (`load`, `exactCanonicalCandidates`, `bodyParams`), multiplayer UI data and views, HUD, garage dialogs, speed type lookup `r7`, and kart effect helpers. |
| 1,024,876–3,847,452 | Embedded vehicle physics data: `h10` and `d10` are 91-column CSV template literals with 2,374 and 3,276 data rows; `hn` is a 436-key override `Map`. The five final `hn.set(...)` calls end at 3,847,452. Extracted copies are in `recovered/embedded-data/`. |
| 3,847,452–4,158,050 | Vehicle parameter merging (`pS`), render and audio effects (`iv`, `pv`), gauges (`gn0`, `Cn0`), and asset loading (`ul`). |
| 4,158,050–4,248,781 | Driving simulation centered on class `AL` (81,407 code units; `update`, `handleDrivingCommand`, boost and reset methods). |
| 4,248,781–4,497,227 | Track scene `_L`, collision/query code, local and remote race coordinators (`Ci0`, `Bi0`, `Ui0`), race presenter `jr0`, chat/HUD, and performance diagnostics. |
| 4,497,227–4,683,739 | UI rendering and menus: `Ma0`, garage and track selection `C7`/`_7`, controls/settings view `oy`, plus race setup transition `ll0`. |
| 4,683,739–4,829,482 | Multiplayer transport (`pl0` WebRTC peer routines; `LT` connect/request/motion), room UI `py`, lobby `Wl0`, and menu coordinator `ql0`. |
| 4,829,482–5,048,546 | Time attack phase `GF`, driving input, touch controls, ghost record store `Pt`, ghost import/export, race assembly and controller `df0`, frame presenter `vf0`. |
| 5,048,546–5,080,017 | App class `Bf0`, scaling helper, `#app` lookup, `new Bf0(...)`, and ghost menu mounting. The final export list contains the 89 symbols used by the garage chunk. |

## Useful stable symbols

Names below are minified names in this release. The roles are inferred from preserved method names and strings; they are suggested navigation anchors, not original source names.

| Symbol | Offset | Strongest evidence |
| --- | ---: | --- |
| `Sw` | 766,911 | Archive/library class; `exactCanonicalCandidates`, `timeAttackGarageCatalog`, `mapAssets` |
| `AL` | 4,158,050 | Vehicle simulation; `updateLockedIngameClock`, `handleDrivingCommand`, `tryConsumeNormalBooster` |
| `_L` | 4,248,781 | Track scene; `updateMovingRoads`, `queryObstacleObb`, `updateEvents` |
| `jr0` | 4,380,950 | Race runtime integration; `prepareTrackEvents`, `applyLocalWarpActions`, `showResult` |
| `pl0` | 4,687,413 | WebRTC transport; `offer`, `receiveSignal`, `rtcOpen`, `receiveMotion` |
| `LT` | 4,697,830 | Multiplayer client; `connect`, `request`, `subscribe`, `sendMotion` |
| `Wl0` | 4,774,852 | Multiplayer lobby; `quickJoinShortcut`, `render`, `receive`, `showRoom` |
| `ql0` | 4,804,571 | Menu coordinator; `enterTimeAttackReady`, `openMultiplayer`, `applyMultiplayerGarage` |
| `Pt` | 4,922,896 | Ghost records; `saveImported`, `exportKsv`, `persist` |
| `df0` | 5,006,126 | Local race controller; `updateDriving`, `updateTimeAttackRoute`, `warpToCheckpoint` |
| `vf0` | 5,031,264 | Frame presenter; `updateAndRender`, `renderGameplayUi`, `publishMultiplayer` |
| `Bf0` | 5,048,546 | App root; renderer setup and stage/menu lifecycle |

## Reconstruction boundaries

The data literals and existing garage/worker chunks can be extracted without guessing. The rest of the main module was flattened by bundling, so creating source modules requires a declaration dependency graph and careful movement of shared declarations, initialization side effects, and the 89 garage exports. Semantic renaming should be incremental and tested against the unmodified mirror. Comments, TypeScript types, original local variable names, and server code cannot be inferred reliably from this bundle alone.
