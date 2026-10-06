# Input pipeline

`driving-input.ts` combines action edges into the physics snapshot. The four
classes that used to live in `multiplayer.js` now have readable implementations:

| Release class | Handwritten source | Role |
| --- | --- | --- |
| `jl0` | `GameplayInputQueue` in `gameplay-input-queue.ts` | Window keyboard and touch edge queue |
| `Xl0` | `AutoForwardAssist` in `auto-forward.ts` | Touch forward latch |
| `Zl0` | `NitroSeamlessQueue` in `nitro-seamless.ts` | Short manual nitro buffer |
| `Ql0` | `GamepadEdgePoller` in `gamepad-edges.ts` | Gamepad press and release edges |

Adjacent tests extract the matching classes from the immutable
`recovered/formatted/index.js` and compare state transitions, callbacks and
edge cases. The queue and gamepad reader accept the current key mapping and
gamepad helpers as constructor dependencies so they can be wired without a
cycle into generated world data.

`action-bindings.ts` contains the 22 configurable action slots, default keys,
browser scan code lookup, and keyboard action resolution. `gamepad-controls.ts`
reads connected controllers and converts buttons and axes into the control IDs
used by `GamepadEdgePoller`. The mapping tests compare every browser scan code,
all binding slots, remapped keys, and analog thresholds with the release.
