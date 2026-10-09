# Multiplayer client rewrite

This directory rewrites the client-side multiplayer boundary from the recovered
bundle. It can be developed independently of the original minified code.

## Modules

- `config.ts`: validates the frontend allowlist and backend origin, then builds
  `/multiplayer/` URLs.
- `local-config.ts`: configures the local data service origin and selects
  WebSocket by default. `index.html` no longer loads the downloaded remote
  config file.
- `game-servers.ts`, `game-server-dialog.ts`: the data service's game server
  list, one-time entry tickets, the remembered choice and the server picker.
- `http.ts`: health/version check, account and guest-name API, session token,
  SDP offer/answer exchange, and sanitized ICE servers.
- `protocol.ts`: the known control message names, core message types, and
  runtime checks for handshake, clock, room, room-list and error envelopes.
- `motion.ts`: exact 56-byte motion frame header with UUIDs, kind, recipient
  mask, sequence and payload bytes.
- `payload.ts`: readable encoding and decoding for driving samples and all nine
  kinematic sample shapes; it replaces the release's `S40` and `d6` classes.
- `peer-mesh.ts`: direct `peer-motion` / `peer-control` links, SDP signaling,
  relay probing, ICE repair, rate limits and diagnostics; it replaces `pl0`.
- `network-timing.ts`: clock offset and race request RTT state; it replaces
  `L40` and `gl0`.
- `race-session.ts`: member permissions and the abort-scoped race command API,
  including the serialized 道具赛 `sendItem` (strict per-racer sequence) and
  `subscribeItem`.
- `item-race-wiring.ts`, `race-presenter-items.ts`: 道具赛 assembly (the item
  race controller on the local owner) and its frame updates (cubes, hazards,
  item presenter, item HUD state).
- `server-events.ts`: validation for every observed server control event.
- `room-validation.ts`: full room and race snapshot validation from the release.
- `room-state.ts`: authoritative room revision, departure and recent-chat state.
- `individual-rider-colors.ts`: individual rooms dress each racer in its slot's
  basic dye (red, yellow, orange, green, light jade, blue, purple, pink),
  shuffled per room ID, for the lobby previews, the race outfits and the rank
  and minimap colours; the release kept everyone's own dye there. The race
  loader `A40` takes it through a patch in `tools/generate-modules.mjs`.
- `errors.ts`: multiplayer error messages shown by the release.
- `lobby-actions.ts`: room listing, joining, leaving, chat, team and settings commands.
- `lobby-events.ts`: readable room-event orchestration and UI state transitions.
- `lobby-lifecycle.ts`, `lobby-dialogs.ts`: subscriptions, cleanup, room shortcuts,
  auto-ready and modal/vote behavior.
- `lobby-loading.ts`, `lobby-open.ts`, `lobby-room-view.ts`: race overlay,
  lobby account connection and room interface loading.
- `lobby-settings.ts`, `lobby-changing.ts`, `lobby-garage.ts`: room creation,
  host settings, editor state and garage equipment commands.
- `lobby-track.ts`: host track and random-group selection with favorite handling.
- `race-start-coordinator.ts`, `lobby-race-loader.ts`: race loading revisions,
  clock binding, roadblock/RP presentation and return-to-room lifecycle.
- `local-race-runtime.ts`: local multiplayer reset, route events, start schedule,
  elapsed clock and per-frame actions.
- `remote-motion.ts`, `remote-fleet.ts`: remote clock mapping, pose prediction,
  peer vehicle lifetime and collision processing.
- `race-driving-scales.ts`: leader-gap catchup and charger multipliers plus
  slipstream charge, burst and cooldown state from the multiplayer race runtime.
- `race-peer-cadence.ts`: peer motion recipient cadence, stale-contact scaling,
  and collision frame-rate correction during a race.
- `outgoing-race-motion.ts`: client-space physics sample conversion and the
  local kart's 64 ms multiplayer motion send gate.
- `race-room-coordination.ts`: in-race clock binding, start scheduling, room
  identity and finish-clock updates, roadblock time remaining, and cleanup order.
- `race-frame-coordination.ts`: each multiplayer race frame's remote updates,
  driving modifiers, team charge, giant effects, finish report and motion send.
- `client-motion.ts`, `client-control.ts`, `client-connect.ts`: the game-facing
  `LT` transport's motion, request, lifecycle and WebRTC handshake methods.
- `client-websocket.ts`, `client-control-receiver.ts`: game server connection
  using one WebSocket for JSON control and binary race motion, with the same
  request IDs, event validation, clock samples and room state as `LT`.
- `transport.ts`: server WebRTC connection, negotiated `control`/`motion`
  channels, request IDs, heartbeat/clock synchronization, race scope filtering,
  and selection of direct links or server relay.

Typical integration:

```ts
const backendOrigin = resolveBackendOrigin(config, location.href);
const http = new MultiplayerHttpClient({ backendOrigin, pageOrigin: location.origin });
await http.checkHealth();
const client = new MultiplayerTransport({ http });
client.subscribe((message) => { /* update lobby/room state */ });
await client.connect({
  resourceVersion: "p3553", name: nickname, equipment,
  initial: "", raceRuntime: true,
});
```

## Local data service and game servers

Run `./run-full-local.sh` from the repository root. The configured backend
origin (`http://127.0.0.1:8787` by default) is the single data service of
`../../server-go/`: health, account login, profiles, records,
history, the game server list and entry tickets. Rooms live on one or more
game servers (`kart-game`, `:8788` and up).

Accounts (server-go/ECONOMY.md 7): every player signs in at startup
(`src/account/login-gate.ts`), so multiplayer has no guest path any more.
`lobby-open.ts` takes the account from the current session
(`multiplayerAccountFromSession`, which re-reads `/api/account` and requires a
claimed starter kit, `ONBOARDING_REQUIRED` otherwise); a missing session is
`LOGIN_REQUIRED`. The generated `multiplayerTokenStore` is
`account/account-token-store.ts`: the startup login, remembered 30 days in
`localStorage` under `kartsim.multiplayer.session:<data service origin>`, is the
token sent for tickets. The guest nickname dialog (`guest-nickname.ts`) and the
signed-in choice dialog (`account-choice-dialog.ts`) are no longer reached.
A `hello` refused with `403 ITEM_NOT_OWNED` refreshes the inventory, replaces
unowned equipment in the live profile and retries once with a new ticket.
After a race the result rows show `race.rewards` (`+经验 +金币` per player;
挡人模式 announces the local reward instead) and the account is re-read so the
lobby top bar and a level-up notice catch up.

Entering the lobby after the account is checked:

1. `GET /multiplayer/game-servers` on the data service. No usable server is an
   error ("暂无可用的游戏服务器", followed by the cause when servers are listed
   but unusable, e.g. all full or not HTTPS on an HTTPS page); exactly one is
   entered directly; several open the picker (full servers, and plain HTTP
   servers on an HTTPS page, are listed but cannot be chosen; Escape cancels
   it). The picked node ID is remembered in `localStorage` under
   `kartsim.multiplayer.game-server`. Server and ticket origins are
   normalized to the browser's form (lowercase host, no default port), so an
   origin such as `http://My-Mac.local:8788` or `https://game.example:443`
   is accepted.
2. For every connection attempt `POST /multiplayer/game-servers/ticket
   {"nodeId"}` returns a fresh one-time ticket. The account's
   `Authorization: Bearer <session token>` is sent here, and only here
   (`401 LOGIN_REQUIRED`, `403 ONBOARDING_REQUIRED` otherwise).
3. The client connects to `<origin>/multiplayer/ws` of that server (a null
   origin means the data service origin, i.e. a same-origin proxy) and sends
   the ticket in `hello`. The session token is never sent to a game server.
4. If the chosen node refuses the player (ticket `GAME_SERVER_FULL` /
   `GAME_SERVER_NOT_FOUND`, a refused or timed-out WebSocket upgrade, or a
   node-specific `hello` error such as `SERVER_FULL`, `SERVER_BUSY`,
   `SERVER_SHUTTING_DOWN`, `TICKET_WRONG_NODE` or `PROTOCOL_MISMATCH`), the
   mounted lobby offers the server choice again without that node, up to
   three times, and connects with a fresh ticket.

The WebSocket carries the existing protocol version 39 / `launcher-room-v1`
JSON messages. After `hello`/`welcome`, three `clock` exchanges establish the
time offset; later requests and replies carry the same `requestId`. Binary
race motion frames share this WebSocket.

For LAN play (`run-lan.sh`), Vite proxies `/multiplayer/ws` to
`KART_LAN_GAME_BACKEND` (default `http://127.0.0.1:8788`) and the other
`/multiplayer/` and `/api/` paths to `KART_LAN_BACKEND` (the data service). The account-bound profile
(`/api/account/profile`) and the Ghost summary index synchronize through `ui/profile-sync.ts` and
`game/ghost-summary-sync.ts`; full Ghost replay frames remain in IndexedDB.
The local client accepts ordinary, grip, shadow, roadblock, giant, RP, and LTE
rooms on P3553. LTE is a Web trial: its race uses only the three dedicated
tracks, random track code 0, and the existing Z/X dodge control. The server
must include the frozen `race.lte` metadata and a complete `race.startSlots`
map (one unique slot from 0 to 7 per roster player) for the client to load it.
The LTE trial does not yet implement automatic nitro refill or banana events.
The original WebRTC path stays available by setting
`VITE_MULTIPLAYER_TRANSPORT=webrtc` and a compatible backend origin; it also
presents the entry ticket in `hello` and no longer sends a bearer token.

## Known boundaries

The downloaded files contain a browser client, not the remote backend. The
local services (the Java server and its Go rewrite) implement the recovered
control protocol and persistent game state; they are new implementations, not
the remote server's source code.

`MultiplayerTransport.sendMotion` accepts an encoded payload. `payload.ts`
provides the sample codec and full-frame encoder/decoder for callers that work
with typed physics values. The transport chooses a direct peer link when it is
healthy and requests server relay otherwise. The generated game client now
delegates all `LT` methods, room validation, room state, error text and all
`Wl0` lobby-controller methods to these TypeScript modules. Its field
declarations and visual lobby/room views still use the compatibility layer.
Remote and local race behavior is also wired in.
The fixed WebRTC channel IDs and 39 / `launcher-room-v1` handshake match the
downloaded browser client. The runtime validators intentionally cover only
core fields; add feature-specific validators before using untyped event data.

## Compatibility with recovered `LT`

| Recovered runtime | Rewrite | Status |
| --- | --- | --- |
| `connect(offerUrl, name, version, equipment, initial, raceRuntime, token)` | `new MultiplayerTransport({ http }).connect({ resourceVersion, name, equipment, initial, raceRuntime })` | Same server SDP exchange, `hello` and three initial clock requests. Backend URL and token now belong to `MultiplayerHttpClient`. |
| `request(message)`, `subscribe(listener)`, `onClose(listener)` | Same method names | Request ID correlation, 32 pending requests, 64 KiB control backpressure and 10-second default timeout are implemented. |
| `dispose()` | `close()` | Closes both channels, peer connection and pending requests. Create a new instance to reconnect. |
| `bindMotionScope(room)` | `bindRoom(room)` | Computes server relay recipients and filters incoming frame identity/sequence. Uses only the room fields represented by `RoomSnapshot`. |
| `sendMotion(payload, mask)` | `sendMotion(kind, encodedPayload, mask)` | Direct peer and server relay paths use the same wire frame. The race simulation encodes the 80–178 byte payload with `payload.ts`. |
| `subscribeMotion(listener)` | Same method name | Delivers a validated `MotionFrame` with payload bytes; callers decode with `payload.ts`. |
| `captureClock()` | Same method name | Returns an offset/round-trip sample; no separate RTT diagnostic tracker yet. |
| `raceConnection()` | `createRaceConnection()` | Scoped race command facade checks identity, room, race and abort state on every operation. |
| `networkDiagnostics()` | Same method name | Returns peer route, latency, traffic and repair counters. |
| Direct `peer-motion` and `peer-control` P2P links | `PeerMesh` | SDP signaling, ICE refresh and repair, P2P health probes and server relay selection are implemented. |

The downloaded production `multiplayer-config.js` only allows its two HTTPS
origins. The rewrite sets its own local configuration before loading the game.

Primary local evidence: `recovered/analysis/network-protocol.md`,
`recovered/formatted/index.js` around lines 78,311, 94,319, 94,632,
104,976, 105,887, 106,203 and 106,458.
