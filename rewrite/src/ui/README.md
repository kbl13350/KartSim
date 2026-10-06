# UI business logic

The release UI draws from packaged BML and texture resources. These modules replace
the input and selection rules with named TypeScript while keeping the same layout
coordinates and observable behavior.

| Release symbol | Readable implementation | Used by |
| --- | --- | --- |
| `b6`, `uT`, `qa0`, `nf`, `qv`, `bc` | `ScrollbarController` and scrollbar math in `scrollbar.ts` | Garage, track picker, settings |
| `WP` | `TouchPageSwipe` in `touch-swipe.ts` | Track picker touch input |
| `J80`, `Q80`, `Z80`, `P80`, `fF`, `W80` | Ready option and visibility functions in `ready-options.ts` | Ready screen |
| `_7.filteredTracks`, `_7.randomGroupsForDisplay`, `_7.gameTypeEnabled`, `_7.remapRandomSelection` | Functions in `track-picker.ts` | Track picker |
| `_7.placeInitialOffsets`, `_7.confirm`, `_7.selectTheme`, `_7.toggleGameType`, `_7.searchTracks`, `_7.commitSearch`, `_7.changeFavorite` | Functions in `track-picker-actions.ts` | Track picker interaction |
| `ry`, `kc0` and tray asset helpers | `Taskbar` in `taskbar.ts` and `loadTaskbarAssets` in `taskbar-assets.ts` | Bottom navigation |
| `ds` | `WindowNotice` in `window-notice.ts` | Lobby notices |
| `xa0` | `CoatingPreviewSession` in `coating-preview.ts` | Garage coating try-on and cancellation |
| `Ma0` | `GarageCanvasCompositor` in `garage-compositor.ts` | Cached Canvas/WebGL garage drawing |
| `ty` selected methods and pointer fields | `ready-view-actions.ts` | Ready button drawing, pointer input, option/speed selection and record refresh; routed into the release class |
| `ny.load`, `ny.render`, `ny.dispose` | `ready-vehicle-preview.ts` | Ready vehicle preview loading, attachment updates, frame composition and disposal; routed into the release class |
| `Tc0` | `RandomTrackSession` in `random-track-session.ts` | Random track choice without repeats; replaces the release class |
| `oy` 15 interaction methods | `settings-interactions.ts` | Settings speed/version, sound, graphics, presets and control activation; routed into the release class |
| `C7` 19 business methods | `garage-selection.ts` | Garage category/filter, favorites, kart/character/equipment choice and confirmation; routed into the release class |
| `Li`, `Bi`, `qi`, `Xe`, `Kt` in GarageXView | `garage-parts-business.ts` | Garage parts parsing, grouping, sorting, equipped/default selection and equality; routed into the lazy chunk |
| `va.reset`, `va.updateRadar`, `va.dispose` in GarageXView | `garage-progression-radar.ts` | Vehicle upgrade radar lifecycle, stale async result suppression and cleanup; routed into the lazy chunk |
| `As.requireCustomization`, `As.equip`, `As.requestEquip`, `As.selectSlot`, `As.setPartPreview` in GarageXView | `garage-equipment-actions.ts` | Practice kart restrictions, locked slots, equipment validation, stale confirmation protection, slot selection and preview; routed into the lazy chunk |
| `As.selectPage`, `As.selectKart`, `As.filteredKarts`, `As.nativeFactoryAllowed`, `As.canSetProgression` in GarageXView | `garage-catalog-navigation.ts` | Garage page and kart navigation, preview reset, catalog filters and upgrade eligibility; routed into the lazy chunk |
| `As.updateFactoryScores`, `As.factoryVehicleKey`, `As.canonicalFactoryVehicle`, `As.serialFor` in GarageXView | `garage-factory-scoring.ts` | Factory score cache, stale async response protection and canonical vehicle identity; routed into the lazy chunk |
| `As.requestCoating`, `As.equipCoating`, `As.requestCosmetic`, `As.equipCosmetic` in GarageXView | `garage-cosmetic-equipment.ts` | Coating and cosmetic confirmation, resource checks, stale request protection and configuration merge; routed into the lazy chunk |
| `As.updateCards` in GarageXView | `garage-card-catalog.ts` | Vehicle cards, pagination, selection state and Factory-specific layout; routed into the lazy chunk |
| `As.requestRestoreDefaults`, `As.publishCurrentState`, `As.setProgression`, `As.refreshUpgradeState` in GarageXView | `garage-state-commit.ts` | Confirmed defaults, local kart publication, upgrade submission and panel refresh; routed into the lazy chunk |
| `$a` and `As.setFactory` in GarageXView | `garage-factory-commit.ts` | Factory session requests, optimistic configuration submission, stale response protection and rollback; routed into the lazy chunk |
| `As.requestSkillSelection`, `As.requestExceedTypeChange` in GarageXView | `garage-upgrade-dialog-actions.ts` | Upgrade dialog eligibility, selection and configuration submission; routed into the lazy chunk |
| Local profile helpers | `local-profile.ts` | Equipment, kart choice, storage validation and favorites |

The generator routes these selected implementations into the running game. The `ty`, `oy` and `C7` class shells, rendering, and unlisted methods remain in `src/generated/ui.js`. Each adjacent test compares the implementation against code extracted at test time
from the immutable `recovered/formatted/index.js` release. The tests cover state
transitions, boundaries, ordering, async cancellation and tray resource resolution. The taskbar loader
uses the handwritten BML decoder and the existing PNG/layout primitives. Remaining
UI screens still use generated compatibility code until their own migration.
