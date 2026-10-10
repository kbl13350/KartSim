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

`item-input.ts` serves item races (道具赛). `ItemInputRouter` takes the use,
reorder and secondary-item transitions (Ctrl, Alt, Z) out of the drained batch
before it reaches `DrivingInputAccumulator`, so they never spend or reorder
nitro slots, and turns them into item commands: use press, use release (or
cancel when input is dropped), swap and change. Left and right presses are
also reported as escape presses for a water bubble, and every arrow press is
reported by its physical key (`up`, `down`, `left`, `right`) to the sink's
optional `direction` hook, which the session passes to
`itemEffects.directionPress` for the talisman QTE. The multiplayer session
update routes the commands to the local race owner's `items` handler.

Item race reverses use the accumulator's two released hooks:
`setSteeringInverted` swaps left and right in the snapshot and
`setForwardReverseSwap` swaps the two pedals; the multiplayer session sets
both every frame from the physics item effects. The accumulator itself stays
identical to the release (`tests/input-parity.test.mjs` exercises both hooks)
and still reports the raw keys, so the session passes each reported effect
through `itemReverseDrivingEffect`: with the pedals swapped the back key
becomes `forward-down` / `forward-up` (the drift-exit and escape boosts and
the boost release follow the pedal that drives forward), and with inverted
steering `drift-start` turns toward the side the kart actually steers.
Neither hook is set outside item races.

The router tracks which sources (`keyboard:<code>`, `touch:<action>`) hold
the use key. A second down from a source that is still held means its keyup
was lost, so the router cancels the stale hold and starts a fresh press. A
keyboard edge also ends touch holds and a touch edge ends keyboard holds,
because the queue passes one kind's edges only while the other kind holds
nothing. During item
races the session also calls `cancelAll()` on window `blur` and when the page
is hidden (`watchRaceSessionFocusLoss` in
`src/multiplayer/race-session-lifecycle.ts`). The next drain is then
`cancelled`, which cancels the router and the driving input. Speed races and
time attack keep the released behaviour: a lost keyup there lasts only until
that key is pressed again.
