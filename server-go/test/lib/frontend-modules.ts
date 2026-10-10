// The browser modules test/frontend-economy-check.mjs drives, loaded through
// ONE tsx import so they share module instances (each tsImport() call has its
// own module namespace: two copies of browser-session.ts would make
// `instanceof BrowserAccountSession` checks in account-runtime.ts fail).
export * as accountApi from "../../../client/src/account/account-api";
export * as loginGate from "../../../client/src/account/login-gate";
export * as tokenStore from "../../../client/src/account/account-token-store";
export * as runtime from "../../../client/src/account/account-runtime";
export * as garageOwnership from "../../../client/src/account/garage-ownership";
export * as ownership from "../../../client/src/account/ownership";
export * as accountProfile from "../../../client/src/account/account-profile";
export * as rewards from "../../../client/src/account/rewards";
export * as shopApi from "../../../client/src/shop/shop-api";
export * as shopModel from "../../../client/src/shop/shop-model";
export * as gameServers from "../../../client/src/multiplayer/game-servers";
export * as clientWebsocket from "../../../client/src/multiplayer/client-websocket";
export * as clientControl from "../../../client/src/multiplayer/client-control";
export * as clientState from "../../../client/src/multiplayer/client-state";
export * as payload from "../../../client/src/multiplayer/payload";
export * as networkTiming from "../../../client/src/multiplayer/network-timing";
export * as serverEvents from "../../../client/src/multiplayer/server-events";
export * as roomValidation from "../../../client/src/multiplayer/room-validation";
export * as multiplayerErrors from "../../../client/src/multiplayer/errors";
export * as localProfile from "../../../client/src/ui/local-profile";
export * as timeAttackSettle from "../../../client/src/timeattack/timeattack-settle";
