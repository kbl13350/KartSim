// Generated from the verified KartSim v39.11 release bundle.
// Rebuild with: node tools/generate-modules.mjs
// Stable minified names are retained for behavioral parity.

import { keyboardActionsForCode } from "../input/action-bindings.ts";
import { showAccountServiceProgress } from "../multiplayer/account-progress.ts";
import { loadMultiplayerSessionToken, saveMultiplayerSessionToken, clearMultiplayerSessionToken, loadLocalRiderNickname, saveLocalRiderNickname, clearLocalRiderNickname } from "../multiplayer/account-local-state.ts";
import { accountOverlayStyle, accountPanelStyle, accountErrorMessages, styleAccountButtons, formatAccountServiceError, currentMultiplayerOrigin, multiplayerAccountEndpoint, multiplayerAuthHeaders } from "../multiplayer/account-ui-support.ts";
import { loadLobbyAvatarAppearance } from "../multiplayer/lobby-avatar-appearance.ts";
import { lobbyRiderSlots, roadblockRunnerId, decorateRoadblockRiders, wrapLobbyChatBubble } from "../multiplayer/lobby-room-helpers.ts";
import { decorateIndividualRiders } from "../multiplayer/individual-rider-colors.ts";
import { multiplayerReadyOptions } from "../multiplayer/ready-options.ts";
import { MultiplayerLobbyController } from "../multiplayer/lobby-controller.ts";
import { ReadyController } from "../timeattack/ready-controller.ts";
import { LobbyRoomController, loadLobbyRoomController } from "../multiplayer/lobby-room-controller.ts";
import { MultiplayerClientState } from "../multiplayer/client-state.ts";
import { RpScenePreview } from "../multiplayer/rp-scene-preview.ts";
import { RpResultAudio } from "../multiplayer/rp-result-audio.ts";
import { RpResultNotice } from "../multiplayer/rp-result-notice.ts";
import { RoadblockMissionNotice } from "../multiplayer/roadblock-mission-notice.ts";
import { TrackChangeNotice } from "../multiplayer/track-change-notice.ts";
import { LobbyCountdownMedia } from "../multiplayer/lobby-countdown-media.ts";
import { LobbyEmotionAudio } from "../multiplayer/lobby-emotion-audio.ts";
import { LobbyAvatarPreviews } from "../multiplayer/lobby-avatar-previews.ts";
import { createLobbyAvatarCamera } from "../multiplayer/lobby-avatar-camera.ts";
import { multiplayerBackendOrigin, multiplayerEndpoint } from "../multiplayer/backend-origin.ts";
import { requestMultiplayerAccount, enterMultiplayerAccount, multiplayerAccountFromSession } from "../multiplayer/account-service.ts";
import { currentAccountSession } from "../account/account-session.ts";
import { accountTokenStore } from "../account/account-token-store.ts";
import { multiplayerSessionToken } from "../account/account-runtime.ts";
import { accountOwnedEquipment } from "../account/garage-ownership.ts";
import { repairEquipmentForMultiplayer } from "../app/account-startup.ts";
import { AccountLoginDialog } from "../multiplayer/account-login-dialog.ts";
import { chooseGuestNickname } from "../multiplayer/guest-nickname.ts";
import { chooseGameServer, requestGameServerEntry } from "../multiplayer/game-servers.ts";
import { showGameServerPicker } from "../multiplayer/game-server-dialog.ts";
import { roomChannelNames, roomChannelKey, roomStyleDropdown } from "../multiplayer/lobby-room-options.ts";
import { chooseSignedInAccount } from "../multiplayer/account-choice-dialog.ts";
import { addLobbyEmotionWheel, buildLobbyRoomTemplate, loadLobbyRoomTemplate } from "../multiplayer/lobby-room-template.ts";
import { configureRpSceneCamera, decorateRpResultTemplate, rpSceneCameraMatrices } from "../multiplayer/rp-scene-helpers.ts";
import { preloadRpFlyingPet } from "../multiplayer/rp-pet-preload.ts";
import { confirmLobbyMessage, noticeLobbyMessage, createLobbyRoomDialog, createOrdinaryRoomDialog, createGameplayRoomDialog } from "../multiplayer/lobby-dialog-facade.ts";
import { showLobbyMessageBox, showLobbyPasswordDialog, showLobbyTeamDialog, setLobbyDialogBusy, disposeLobbyDialog } from "../multiplayer/lobby-dialog-views.ts";
import { showLobbyRoomCreationForm } from "../multiplayer/lobby-room-form.ts";
import { showLobbyRoomSettings } from "../multiplayer/lobby-room-settings-dialog.ts";
import { RaceLoadingScreen } from "../multiplayer/race-loading-screen.ts";
import { handleLobbyEmotionKey, handleLobbyRoomKey, initializeLobbyRoom, loadLobbyRoom } from "../multiplayer/lobby-room-construction.ts";
import { lobbyRoomNodeState } from "../multiplayer/lobby-room-state.ts";
import { isEditableTarget } from "../input/gameplay-input-queue.ts";
import { GameplayInputQueue } from "../input/gameplay-input-queue.ts";
import { GamepadEdgePoller } from "../input/gamepad-edges.ts";
import { AutoForwardAssist as Xl0 } from "../input/auto-forward.ts";
import { NitroSeamlessQueue as Zl0 } from "../input/nitro-seamless.ts";
import { RaceStartCoordinator } from "../multiplayer/race-start-coordinator.ts";
import { LobbyAvatarCache, lobbyAvatarKey } from "../multiplayer/lobby-avatar-cache.ts";
import { animateLobbyRoom, canAnimateLobbyRoom, isLobbyCountdownLocked, lobbyCountdownState, sendLobbyChat as sendLobbyRoomChat, sendLobbyEmotion, setLobbyStartPresentation, updateLobbyCountdown } from "../multiplayer/lobby-room-timing.ts";
import { activateLobbyReadyShortcut, closeLobbyEmotionWheel, disposeLobbyRoom, hideLobbyRoom, installLobbyRoomKeyboard, removeLobbyRoomKeyboard, showLobbyRoom as showLobbyRoomLifecycle, toggleLobbyEmotionWheel, updateLobbyRoom } from "../multiplayer/lobby-room-lifecycle.ts";
import { loadLobbyRoomTrack } from "../multiplayer/lobby-room-track.ts";
import { initializeLobbyRace } from "../multiplayer/lobby-race-loader.ts";
import { RoomState as Ul0 } from "../multiplayer/room-state.ts";
import { formatMultiplayerError as C1 } from "../multiplayer/errors.ts";
import { joinLobbyRoom, leaveLobbyRoom, listLobbyRooms, mutateLobbyRoom, quickJoinLobbyRoom, sendLobbyChat, submitLobbyRoomSettings, switchLobbyTeam } from "../multiplayer/lobby-actions.ts";
import { receiveLobbyEvent } from "../multiplayer/lobby-events.ts";
import { bindLobbyClient, disposeLobby, handleRoomShortcut, lobbyNetworkDiagnostics, maybeAutoReadyInRoom, quickJoinShortcut, refreshLobbyAutoReady, renderLobby } from "../multiplayer/lobby-lifecycle.ts";
import { cancelLobbyDialog, castLobbyKickVote, confirmLeaveLobbyRoom, lobbyDialogOptions, openLobbyDialog, syncKickVoteDialog } from "../multiplayer/lobby-dialogs.ts";
import { openMultiplayerLobby } from "../multiplayer/lobby-open.ts";
import { syncRaceLoadingView } from "../multiplayer/lobby-loading.ts";
import { showLobbyRoom } from "../multiplayer/lobby-room-view.ts";
import { changeLobbyRoomInfo, confirmLobbyAction, createLobbyRoom } from "../multiplayer/lobby-settings.ts";
import { cancelCountdownModals, endChangingModal, finishChangingLoad, isChangingModalCurrent, releaseChanging } from "../multiplayer/lobby-changing.ts";
import { chooseLobbyGarage, confirmLobbyGarage } from "../multiplayer/lobby-garage.ts";
import { chooseLobbyTrack, confirmLobbyTrack } from "../multiplayer/lobby-track.ts";
import { PeerMesh as pl0 } from "../multiplayer/peer-mesh.ts";
import { MotionRoundTripTracker as gl0 } from "../multiplayer/network-timing.ts";
import { bindRaceScope, createRaceConnection } from "../multiplayer/race-session.ts";
import { acceptGameMotion, acceptServerMotion, captureNetworkClock, networkDiagnostics as getNetworkDiagnostics, sendGameMotion, subscribeGameMotion } from "../multiplayer/client-motion.ts";
import { disposeClient, onClientClose, sameOriginOfferUrl, sendControlRequest, subscribeControl } from "../multiplayer/client-control.ts";
import { connectGameClient } from "../multiplayer/client-connect.ts";
import { configuredTransport } from "../multiplayer/local-config.ts";
import { acquireReadyToonEnvironment, enterTimeAttackReady, openTrackSelect, readyStageContext, resolveRandomSelection, selectReadyChoice, selectReadyTrack, startRaceFromReady } from "../timeattack/ready-flow.ts";
import { changeReadyFavoriteItems, changeReadyFavoriteTrack, closeReadyMultiplayer, disposeReadyController, getReadyWindowNotice, isReadyModalBusy, readyNetworkDiagnostics, refreshReadyRecord, releaseReadyForRace, renderReadyController, returnMultiplayerToSinglePlayer, setReadyWindowNotice, updateReadyWindowNotice } from "../timeattack/ready-controller-state.ts";
import { applyReadyMultiplayerGarage, openReadyMultiplayer, readyMultiplayerGarageOptions } from "../timeattack/ready-multiplayer.ts";
import { applyImmediateReadyGarageSelection, openReadyGarage, openReadyGarageX, returnReadyGarage, selectReadyGarage, showReadyGarageError } from "../timeattack/ready-garage.ts";
import { closeReadySettings, confirmReadySettings, handleReadyShortcut, openReadySettings, previewReadySettings, publishReadyRaceSpeed, releaseReadyToonEnvironment, saveReadyGameOptions, showReadyTrackSelectError } from "../timeattack/ready-settings.ts";
import { B2, El, I4, Z9, kl, qe } from "./vendor.js";
import { G2, H6, He, LR, T, W1, We, b4, f4, fa, ha, j0, lw, m9, oR, on, p2, rn, tt, we, x1, xX, y9 } from "./formats.js";
import { Aa, BI, C8, Cw, DI, Ew, F9, MI, Ma, Nw, Q9, RI, S9, Tr, U1, X6, Yc, Zl, _w, ba, h2, rg, t6, t7, te, wI, wa, x4, ya, zw } from "./library.js";
import { Bt, L40, No, S40, Y3, d6 } from "./vehicle.js";
import { $v, Br, E4, Ga, Hg, IP, NP, Ng, Ue, Uo, cP, nT, ua0, ut, xP, y6, yP, ze, zo0 } from "./world.js";
import { C7, Js, Jv, Lt, Qv, T4, Tc0, _7, ds, ey, oy, ry, ty, w80 } from "./ui.js";

const multiplayerTokenStore = accountTokenStore;
const accountProgressDependencies = { get overlayStyle() { return B7; }, get panelStyle() { return R7; }, styleButtons: (...buttons) => G7(...buttons) };
const lobbyAvatarAppearanceDependencies = { loadRoleTeams: library => fa(library), paintColors: (library, itemId, slot) => We(library, itemId, slot), cosmetics: (equipment, member) => BI(equipment, member) };
const multiplayerClientStateFactories = { createDecoder: () => new d6(), createLatencyTracker: () => new gl0(), createClock: () => new L40() };
const readyGarageDependencies = {
  loadGarage: options => C7.load(options),
  loadGarageX: async options => {
    const { GarageXView } = await El(async () => {
      const { GarageXView } = await import("./GarageXView-DSeU5AUN.js");
      return { GarageXView };
    }, []);
    return GarageXView.load(options);
  },
  createNotice: root => new ds(root),
  speed: y6,
  defaultVersion: ze,
};
const readySettingsDependencies = {
  loadSettings: options => oy.load(options),
  speedLabel: Ue,
  chooseSpeed: $v,
  defaultSpeed: E4,
  defaultVersion: ze,
  persistGameOptions: ua0,
};
const lobbyRoomTimingDependencies = { nowMs: () => performance.now(), requestFrame: callback => requestAnimationFrame(callback), cancelFrame: frameId => cancelAnimationFrame(frameId), toLocalStartAt: Y3 };
const lobbyRoomLifecycleDependencies = { previewMembers: (room, teams) => DT(room, teams), parseChat: (chat, emotions) => Ng(chat, emotions), get chatBubbleDurationMs() { return Il0; }, nowMs: () => performance.now(), cancelFrame: frameId => cancelAnimationFrame(frameId), get keyboard() { return window; } };
const lobbyRoomTrackDependencies = { randomTrack: code => X6(code), mode: room => G2(room), uiResource: (library, roots, token) => U1(library, roots, token), decodePng: bytes => p2(bytes), canvas: image => { const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height; canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(image.pixels), image.width, image.height), 0, 0); return canvas; }, roadblockTracks: library => Cw(library), theme: metadata => wa(metadata) };
const lobbyRoomConstructionDependencies = { mode: room => G2(room), loadRoleTeams: library => fa(library), loadEmotions: library => cP(library), loadCountdown: library => dy.load(library), loadDefinition: (library, roadblock) => Ll0(library, roadblock), withEmotions: (definition, emotions) => Fl0(definition, emotions), loadView: options => te.load(options), loadTrackChangeNotice: (...args) => fy.load(...args), createPreviews: (library, render, onError, emotions, audioContext) => new Tl0(library, render, onError, emotions, audioContext) };
const lobbyRoomStateDependencies = { nodeName: node => T(node, 'name'), slots: (room, playerId) => FT(room, playerId), roadblockRunner: room => TF(room), gameplayMode: room => G2(room), decodeChat: (text, emotions) => Ng(text, emotions), wrapBubble: text => kl0(text), drawBubbleLine: (canvas, line, rect, options) => m9(canvas, line, rect, options), nowMs: () => performance.now(), get roadblockDefaults() { return tt; }, get rpChannelNames() { return lw; }, get colors() { return { redTeam: Rl0, blueTeam: Bl0, ownChat: _l0, otherChat: Gl0 }; } };
const lobbyRoomControllerServices = { construction: lobbyRoomConstructionDependencies, lifecycle: lobbyRoomLifecycleDependencies, timing: lobbyRoomTimingDependencies, track: lobbyRoomTrackDependencies, state: lobbyRoomStateDependencies, documentBody: () => document.body };
const raceLoadingScreenAssets = { imageBytes: (library, roots, name) => U1(library, roots, name).bytes(), decodeImage: bytes => p2(bytes) };
const rpScenePreviewDependencies = { createCamera: () => new Z9(), createSize: () => new B2(), createBinding: () => new ha(), sceneName: node => T(node, 'scene'), validateCamera: (...args) => _F(...args), parseScene: bytes => y9(bytes), loadScene: (...args) => W1(...args), resolveReference: (...args) => ya(...args), loadKartEnvironment: library => rn.load(library), loadKart: (...args) => Qv(...args), createRenderer: options => new I4(options), outputColorSpace: qe, kartFieldOfView: (...args) => we(...args), prepareKart: (...args) => ey(...args), renderKart: (...args) => f4(...args), configureSceneCamera: (...args) => Dl0(...args), disposeKart: kart => Js(kart) };
const rpResultAudioDependencies = { decode: (context, bytes) => Q9(context, bytes), route: (context, voice, channel) => S9(context, voice, channel) };
const rpResultNoticeDependencies = { validDraws: (draws, playerIds) => ba(draws, playerIds), loadDefinition: (library, folder, name) => F9(library, folder, name), decorateDefinition: (definition, kartTitle, petTitle) => Vl0(definition, kartTitle, petTitle), nodeName: node => T(node, 'name'), loadScene: (library, definition, kart) => my.load(library, definition, kart), loadSound: (library, audioContext) => wy.load(library, audioContext), loadView: options => te.load(options), nowMs: () => performance.now(), requestFrame: callback => requestAnimationFrame(callback), cancelFrame: id => cancelAnimationFrame(id) };
const roadblockMissionDependencies = { loadDefinition: (library, folder, name) => F9(library, folder, name), attribute: (node, name) => T(node, name), clone: (node, attributes, children) => h2(node, attributes, children), loadView: options => te.load(options), nowMs: () => performance.now(), requestFrame: callback => requestAnimationFrame(callback), cancelFrame: id => cancelAnimationFrame(id) };
const trackChangeNoticeDependencies = { loadDefinition: (library, folder, name) => F9(library, folder, name), loadStringBag: library => U1(library, ['etc_'], 'baseStringBag', '.xml').bytes(), parseStringBag: bytes => x1(bytes), nodeAttribute: (node, name) => T(node, name), stringAttribute: (node, name) => j0(node, name), clone: (node, attributes) => h2(node, attributes), loadView: options => te.load(options), nowMs: () => performance.now() };
const lobbyAvatarCameraDependencies = { degToRad: degrees => kl.degToRad(degrees), radToDeg: radians => kl.radToDeg(radians), createCamera: (fov, aspect, near, far) => new Z9(fov, aspect, near, far) };
const lobbyEmotionAudioDependencies = { decode: (context, bytes) => Q9(context, bytes), route: (context, voice, channel) => S9(context, voice, channel) };
const lobbyAvatarPreviewDependencies = { createBinding: () => new ha(), createEmotionAudio: (library, context, failed) => new xl0(library, context, failed), loadEnvironment: library => rn.load(library), createSlots: (build, release, changed, failed) => new El0(build, release, changed, failed), disposePreview: preview => Lt(preview), gameplayMode: room => G2(room), rpEquipment: (equipment, replacement) => wI(equipment, replacement), systemKart: (karts, itemId, path, systemKey) => b4(karts, itemId, path, systemKey), loadAppearance: (...args) => Sl0(...args), loadPreview: (...args) => Jv(...args), createParts: () => new Tr(), createCamera: (...args) => Ml0(...args), createRenderer: options => new I4(options), outputColorSpace: qe, updatePreview: (...args) => T4(...args), drawPreview: (...args) => NP(...args), renderScene: (...args) => f4(...args) };
const lobbyCountdownMediaDependencies = { parseScene: bytes => y9(bytes), decodeImage: bytes => p2(bytes), createCanvas: image => { const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height; canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(image.pixels), image.width, image.height), 0, 0); return canvas; }, alphaFromParsed: parsed => on.fromParsed(parsed), createSoundUrl: bytes => URL.createObjectURL(new Blob([bytes], { type: 'audio/ogg' })), createAudio: url => new Audio(url), revokeSoundUrl: url => URL.revokeObjectURL(url) };
const accountRequestDependencies = { authEndpoint: action => ly(action), authorizationHeaders: () => nm(), fetch: (url, options) => fetch(url, options), backendOrigin: () => jo(), clearToken: origin => SF(origin), saveToken: (origin, token) => wl0(origin, token), get errorMessages() { return uy; } };
const accountLoginDependencies = { createElement: tag => document.createElement(tag), get overlayStyle() { return B7; }, get panelStyle() { return R7; }, styleButtons: (...buttons) => G7(...buttons), requestAccount: (action, fields) => Xo(action, fields), formatError: error => C6(error) };
const accountEntryDependencies = { backendOrigin: () => jo(), pageUrl: () => window.location.href, pageOrigin: () => window.location.origin, endpoint: (path, pageUrl) => Ko(path, pageUrl), fetch: (url, options) => fetch(url, options), loadAccount: () => Xo('me'), chooseAccount: (root, account, signal) => Al0(root, account, signal), showLogin: (root, signal) => new CF(root, signal).wait() };
const guestNicknameDependencies = { createElement: tag => document.createElement(tag), get overlayStyle() { return B7; }, get panelStyle() { return R7; }, styleButtons: (...buttons) => G7(...buttons), endpoint: action => ly(action), fetch: (url, options) => fetch(url, options), get errorMessages() { return uy; }, formatError: error => C6(error) };
const gameServerPickerDependencies = { createElement: tag => document.createElement(tag), get overlayStyle() { return B7; }, get panelStyle() { return R7; }, styleButtons: (...buttons) => G7(...buttons) };
const gameServerDependencies = { endpoint: path => Ko(path, window.location.href), backendOrigin: () => jo(), pageUrl: () => window.location.href, fetch: (url, options) => fetch(url, options), storage: () => localStorage, pick: (root, options, selected, signal) => showGameServerPicker(gameServerPickerDependencies, root, options, selected, signal) };
const roomDropdownDependencies = { attribute: (node, name) => T(node, name), clone: (node, attributes, children) => children === undefined ? h2(node, attributes) : h2(node, attributes, children) };
const accountChoiceDependencies = { createElement: tag => document.createElement(tag), get overlayStyle() { return B7; }, get panelStyle() { return R7; }, styleButtons: (...buttons) => G7(...buttons), endpoint: (path, pageUrl) => Ko(path, pageUrl), pageUrl: () => window.location.href, requestAccount: (action, fields) => Xo(action, fields), formatError: error => C6(error), authEndpoint: action => ly(action), authorizationHeaders: () => nm(), fetch: (url, options) => fetch(url, options), backendOrigin: () => jo(), clearToken: origin => SF(origin), showLogin: (root, signal) => new CF(root, signal).wait() };
const lobbyDialogViewDependencies = { loadMessageTemplate: library => _w(library), loadDefinition: (library, folder, name) => F9(library, folder, name), decorateDefinition: (library, definition, folder) => C8(library, definition, folder), clone: (node, attributes, children) => children === undefined ? h2(node, attributes) : h2(node, attributes, children), nodeName: node => T(node, 'name'), loadView: options => te.load(options) };
const lobbyDialogCategoryDependencies = { mode: channel => He[channel].mode, validateGameplay: gameplay => MI(gameplay), channelNames: gameplay => NT(gameplay) };
const lobbyRoomFormDependencies = { ...lobbyDialogViewDependencies, attribute: (node, name) => T(node, name), channelNames: gameplay => NT(gameplay), channelKey: (value, channels) => Ol0(value, channels), dropdown: (combo, template, values) => zl0(combo, template, values), channelMode: key => He[key].mode };
const roomTemplateDependencies = { attribute: (node, name) => T(node, name), clone: (node, attributes, children) => children === undefined ? h2(node, attributes) : h2(node, attributes, children), loadDefinition: (library, folder, name) => F9(library, folder, name), loadRoleTeams: library => fa(library) };
const rpCameraDependencies = { attribute: (node, name) => T(node, name), applyMatrices: (camera, view, projection) => Aa(camera, view, projection) };
const rpPetPreloadDependencies = { validDraws: (rp, playerIds) => ba(rp, playerIds), findItem: (library, itemId) => Ma(library, itemId), loadPet: (library, internalId) => x4.load(library, internalId), sharedFolder: DI };
const readyControllerServices = {
  createRandomTrackSession: () => new Tc0(),
  multiplayer: {
    sanitizeReadyOptions: Hl0, nickname: im, get version() { return Bt; },
    initialEquipment: zw, get favoriteTrackIds() { return nT; },
    createNotice: root => new ds(root), createLobby: options => new Wl0(options),
    repairEquipment: () => repairEquipmentForMultiplayer(),
  },
  createNotice: root => new ds(root),
  loadToonEnvironment: library => rn.load(library),
  readyView: { findKart: b4, loadTaskbar: options => ry.load(options), loadReadyView: options => ty.load(options) },
  trackSelect: { loadTrackSelect: value => _7.load(value), get favoriteTrackIds() { return nT; }, createWindowNotice: root => new ds(root) },
  get randomGroup() { return LR; }, get favoriteTrack() { return IP; },
  garage: readyGarageDependencies, settings: readySettingsDependencies,
  saveGameOptions: options => ua0(options),
};
const multiplayerLobbyServices = {
  state: {
    createAbortController: () => new AbortController(),
    createClient: () => new LT(), createState: () => new Ul0(),
  },
  race: {
    createCoordinator: value => new ll0(value), preloadRpPet: Nl0,
    loadRoadblock: (library, root, race, playerId) => yy.load(library, root, race, playerId),
    loadRpNotice: (library, root, race, playerId, audio) => vy.load(library, root, race, playerId, audio),
  },
  open: {
    get protocolVersion() { return Uo; }, pageUrl: () => window.location.href,
    endpoint: Ko, fetchHealth: (url, signal) => fetch(url, { cache: "no-store", signal }),
    showAccountProgress: vl0, loadAccount: () => multiplayerAccountFromSession(currentAccountSession()),
    loadLobby: options => Ew.load(options),
    notice: (options, title, message) => b1.notice(options, title, message),
    chooseGameServer: (root, signal, failed) =>
      chooseGameServer(gameServerDependencies, root, signal, failed),
    enterGameServer: (server, sessionToken, signal) =>
      requestGameServerEntry(gameServerDependencies, server, sessionToken, signal),
    sessionToken: url => multiplayerSessionToken(ay(url), xF),
    repairEquipment: () => repairEquipmentForMultiplayer(),
    createClient: () => new LT(),
  },
  loadingView: (library, root) => gy.load(library, root), receive: (...args) => RI(...args),
  loadRoom: (library, root, room, playerId, callbacks, audioContext) =>
    py.load(library, root, room, playerId, callbacks, audioContext),
  notice: (options, title, message) => b1.notice(options, title, message),
  confirm: (options, title, message, onConfirm, labels) => b1.confirm(options, title, message, onConfirm, labels),
  garageView: async options => {
    const { TimeAttackGarageView } = await El(async () => {
      const { TimeAttackGarageView } = await Promise.resolve().then(() => w80);
      return { TimeAttackGarageView };
    }, undefined);
    return TimeAttackGarageView.load(options);
  },
  normalizeEquipment: (profile, choice) => accountOwnedEquipment(zw({ ...profile, equipment: choice.equipment })),
  track: {
    gameplay: G2, isGiantTrack: Zl, get randomRules() { return Yc; },
    loadView: options => _7.load(options),
  },
  get randomRules() { return Yc; },
  roomSettings: (options, mode, settings, submit) => b1.roomSettings(options, mode, settings, submit),
  get channels() { return He; },
  createRoom: (options, gameplay, channel, nickname, submit) =>
    gameplay === "ordinary" ? b1.createOrdinary(options, channel, nickname, submit)
      : b1.createGameplay(options, gameplay, channel, nickname, submit),
  passwordDialog: (host, submit) => host.openDialog(() => b1.password(host.dialogOptions(), submit)),
  confirmAction: (options, heading, body, accept) => b1.confirm(options, heading, body, accept),
};

class ll0 extends RaceStartCoordinator {
  constructor(options) {
    super(options, {
      gameplay: G2,
      sameRoadblock: oR,
      sameLte: Nw,
      sameRp: t7,
      toLocalStartTick: Y3,
    });
  }
}

const hl0 = new Set([
    "turn:turn.cloudflare.com:3478?transport=udp",
    "turn:turn.cloudflare.com:3478?transport=tcp",
    "turn:turn.cloudflare.com:443?transport=udp",
    "turn:turn.cloudflare.com:80?transport=tcp",
    "turns:turn.cloudflare.com:5349?transport=tcp",
    "turns:turn.cloudflare.com:443?transport=tcp",
  ]);





class LT extends MultiplayerClientState {
  constructor() { super(multiplayerClientStateFactories); }
  raceConnection(roomId, raceId, signal) { return createRaceConnection(this, roomId, raceId, signal); }
  bindMotionScope(room) { return bindRaceScope(this, room); }
  acceptMotion(data) { return acceptServerMotion(this, data); }
  acceptMotionMessage(message, fromServer = false) { return acceptGameMotion(this, message, fromServer); }
  sendMotion(sample, mask) { return sendGameMotion(this, sample, mask); }
  networkDiagnostics() { return getNetworkDiagnostics(this); }
  subscribeMotion(listener) { return subscribeGameMotion(this, listener); }
  captureClock() { return captureNetworkClock(this); }
  static sameOriginUrl(pageUrl) { return sameOriginOfferUrl(pageUrl); }
  async connect(offerUrl, name, resourceVersion, equipment, initial, raceRuntime = false, ticket) { return connectGameClient(this, offerUrl, name, resourceVersion, equipment, initial, raceRuntime, ticket, { validateControlMessage: zo0, transport: configuredTransport() }); }
  request(message) { return sendControlRequest(this, message); }
  subscribe(listener) { return subscribeControl(this, listener); }
  onClose(listener) { return onClientClose(this, listener); }
  dispose() { return disposeClient(this); }
}

const ml0 = {};

function ay(pageUrl) { return multiplayerBackendOrigin(pageUrl, typeof window > 'u' ? undefined : window.__KART_MULTIPLAYER_CONFIG__, ml0?.VITE_MULTIPLAYER_BACKEND_ORIGIN); }

function Ko(endpoint, pageUrl) { return multiplayerEndpoint(endpoint, pageUrl, typeof window > 'u' ? undefined : window.__KART_MULTIPLAYER_CONFIG__, ml0?.VITE_MULTIPLAYER_BACKEND_ORIGIN); }

const cy = (n) => `kartsim.multiplayer.session:${n}`,
  S6 = new Map();

function xF(origin) { return loadMultiplayerSessionToken(origin, multiplayerTokenStore); }

function wl0(origin, token) { return saveMultiplayerSessionToken(origin, token, multiplayerTokenStore); }

function SF(origin) { return clearMultiplayerSessionToken(origin, multiplayerTokenStore); }

const jo = () => currentMultiplayerOrigin(() => window.location.href, ay),
  ly = action => multiplayerAccountEndpoint(action, () => window.location.href, Ko),
  nm = () => multiplayerAuthHeaders(jo, xF),
  G7 = (...buttons) => styleAccountButtons(...buttons),
  B7 = accountOverlayStyle,
  R7 = accountPanelStyle,
  uy = accountErrorMessages,
  C6 = error => formatAccountServiceError(error, uy);

function vl0(root, signal) { return showAccountServiceProgress(root, signal, accountProgressDependencies); }

async function Xo(action, fields) { return requestMultiplayerAccount(accountRequestDependencies, action, fields); }

class CF extends AccountLoginDialog { constructor(root, signal) { super(root, signal, accountLoginDependencies); } }





function Al0(root, account, signal) { return chooseSignedInAccount(accountChoiceDependencies, root, account, signal); }



function im() { return loadLocalRiderNickname(() => localStorage); }

function EF(nickname) { return saveLocalRiderNickname(nickname, () => localStorage); }

function bl0() { return clearLocalRiderNickname(() => localStorage); }

function Ml0(team, reverse, linkedCharacterId = 0, alwaysLink = false, kartId = 0) { return createLobbyAvatarCamera(lobbyAvatarCameraDependencies, team, reverse, linkedCharacterId, alwaysLink, kartId); }

class xl0 extends LobbyEmotionAudio { constructor(library, context, failed) { super(library, context, failed, lobbyEmotionAudioDependencies); } }

async function Sl0(library, equipment, teamIndex, member, initial = '') { return loadLobbyAvatarAppearance(library, equipment, teamIndex, member, initial, lobbyAvatarAppearanceDependencies); }



class El0 extends LobbyAvatarCache { constructor(build, release, changed, failed) { super(build, release, changed, failed, t6); } }

class Tl0 extends LobbyAvatarPreviews { constructor(library, changed, failed, emotions = [], audioContext) { super(library, changed, failed, emotions, audioContext, lobbyAvatarPreviewDependencies); } }

class dy extends LobbyCountdownMedia {
  constructor(digits, soundUrl) { super(digits, soundUrl, lobbyCountdownMediaDependencies); }
  static async load(library) { return super.load(library, lobbyCountdownMediaDependencies); }
}

class fy extends TrackChangeNotice {
  constructor(room, playerId, caption, definition, width, height, messageHeight) {
    super(room, playerId, caption, definition, width, height, messageHeight, trackChangeNoticeDependencies);
  }
  static async load(library, root, room, playerId) {
    return super.load(library, root, room, playerId, trackChangeNoticeDependencies);
  }
}

const _l0 = "#cef143",
  Gl0 = "#d9dce3",
  Bl0 = "#246bb3",
  Rl0 = "#c73b23",
  Il0 = 5e3;

function kl0(text) { return wrapLobbyChatBubble(text); }

function FT(room, playerId) { return lobbyRiderSlots(room, playerId); }

function TF(room) { return roadblockRunnerId(room, G2); }

function DT(room, colors) { return decorateIndividualRiders(decorateRoadblockRiders(room, colors, TF(room))); }

async function Ll0(library, roadblock = false) { return loadLobbyRoomTemplate(library, roadblock, roomTemplateDependencies); }



function Fl0(root, emotions) { return addLobbyEmotionWheel(root, emotions, roomTemplateDependencies); }

class py extends LobbyRoomController {
  constructor(room, playerId, actions, library) {
    super(room, playerId, actions, library, lobbyRoomControllerServices);
  }
  static async load(library, root, room, playerId, actions, audioContext) {
    return loadLobbyRoomController(
      (snapshot, id, callbacks, resources) => new py(snapshot, id, callbacks, resources),
      library, root, room, playerId, actions, audioContext, lobbyRoomControllerServices);
  }
}

class gy extends RaceLoadingScreen { static async load(library, root) { return super.load(library, root, raceLoadingScreenAssets); } }

function _F(node, width, height) { return rpSceneCameraMatrices(node, width, height, T); }

function Dl0(camera, node, width, height) { return configureRpSceneCamera(camera, node, width, height, rpCameraDependencies); }

class my extends RpScenePreview {
  constructor() { super(rpScenePreviewDependencies); }
  static async load(library, definition, kartItem) {
    return super.load(library, definition, kartItem, rpScenePreviewDependencies);
  }
}



class wy extends RpResultAudio {
  constructor(context, buffers) { super(context, buffers, rpResultAudioDependencies); }
  static async load(library, context) {
    return super.load(library, context, rpResultAudioDependencies);
  }
}

function Vl0(root, kartTitle, petTitle) { return decorateRpResultTemplate(root, kartTitle, petTitle, roomTemplateDependencies); }

class vy extends RpResultNotice {
  constructor(lucky, box, sparkle) {
    super(lucky, box, sparkle, rpResultNoticeDependencies);
  }
  static async load(library, root, race, playerId, audioContext) {
    return super.load(library, root, race, playerId, audioContext, rpResultNoticeDependencies);
  }
}

async function Nl0(library, race, playerId, signal) { return preloadRpFlyingPet(library, race, playerId, signal, rpPetPreloadDependencies); }

class yy extends RoadblockMissionNotice {
  constructor() { super(roadblockMissionDependencies); }
  static async load(library, root, race, playerId) {
    return super.load(library, root, race, playerId, roadblockMissionDependencies);
  }
}

function NT(mode) { return roomChannelNames(mode, H6, lw); }

function Ol0(value, channels = H6) { return roomChannelKey(value, channels); }

function zl0(combo, template, values = Object.values(H6)) { return roomStyleDropdown(combo, template, values, roomDropdownDependencies); }

class b1 {
  busy = !1;
  view;
    static async confirm(options, title, message, onConfirm, labels) { return confirmLobbyMessage((...args) => b1.messageBox(...args), options, title, message, onConfirm, labels); }
    static async notice(options, title, message) { return noticeLobbyMessage((...args) => b1.messageBox(...args), options, title, message); }
    static async messageBox(options, title, message, confirm, labels, noticeOnly = false) { return showLobbyMessageBox(() => new b1(), options, title, message, confirm, labels, noticeOnly, lobbyDialogViewDependencies); }
    static async create(options, mode, nickname, submit) { return createLobbyRoomDialog((...args) => b1.createForm(...args), options, mode, nickname, submit); }
    static async createOrdinary(options, channel, nickname, submit) { return createOrdinaryRoomDialog((...args) => b1.createForm(...args), options, channel, nickname, submit, lobbyDialogCategoryDependencies); }
    static async createGameplay(options, gameplay, channel, nickname, submit) { return createGameplayRoomDialog((...args) => b1.createForm(...args), options, gameplay, channel, nickname, submit, lobbyDialogCategoryDependencies); }
    static async createForm(options, mode, nickname, submit, channel, gameplay = 'ordinary') { return showLobbyRoomCreationForm(() => new b1(), options, mode, nickname, submit, channel, gameplay, lobbyRoomFormDependencies); }
    static async password(options, submit) { return showLobbyPasswordDialog(() => new b1(), options, submit, lobbyDialogViewDependencies); }
    static async roomSettings(options, mode, settings, submit) { return showLobbyRoomSettings(() => new b1(), options, mode, settings, submit, lobbyDialogViewDependencies); }
    static async team(options, currentTeam, chooseTeam) { return showLobbyTeamDialog(() => new b1(), options, currentTeam, chooseTeam, lobbyDialogViewDependencies); }
    setBusy(value) { return setLobbyDialogBusy(this, value); }
    dispose() { return disposeLobbyDialog(this); }
}

const $l0 = new Set([
  "NOT_ENOUGH_PLAYERS",
  "ROADBLOCK_NEEDS_FIVE",
  "TRACK_REQUIRED",
  "EQUIPMENT_REQUIRED",
  "PLAYERS_NOT_READY",
  "TEAM_REQUIRED",
  "CLIENT_RACE_UNAVAILABLE",
]);

class Wl0 extends MultiplayerLobbyController { constructor(options) { super(options, multiplayerLobbyServices); } }

function Hl0(options) { return multiplayerReadyOptions(options, Ue); }

class ql0 extends ReadyController { constructor(host) { super(host, readyControllerServices); } }

function xl(code, keyMap = Br) { return keyboardActionsForCode(code, keyMap, ut); }



class jl0 extends GameplayInputQueue {
  constructor() { super({ keyMap: Br, resolveActions: xl, editableTarget: yf }); }
}

function yf(target) { return isEditableTarget(target); }



class Ql0 extends GamepadEdgePoller {
  constructor() { super({ pressedControls: Hg, bindings: ut, unmappedControl: Ga }); }
}

var Ne = ((n) => (
  (n[(n.Bootstrap = 0)] = "Bootstrap"),
  (n[(n.Countdown = 1)] = "Countdown"),
  (n[(n.Racing = 2)] = "Racing"),
  (n[(n.FinishAccepted = 3)] = "FinishAccepted"),
  (n[(n.Result = 4)] = "Result"),
  (n[(n.Paused = 5)] = "Paused"),
  n
))(Ne || {});

function Jl0(n) {
  return n >= 1 && n <= 4;
}

function Un(n) {
  return n.finishAtMs !== 0;
}

function e60(n) {
  return n.phase !== 5;
}

function t60(n) {
  return !Un(n) && (n.phase === 1 || n.phase === 2);
}

export { EF, Jl0, LT, Ne, Ql0, Un, Wl0, Xl0, Zl0, bl0, e60, gl0, im, jl0, pl0, ql0, t60, xl };
