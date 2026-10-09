#!/usr/bin/env node

// Recover real ES module boundaries from the formatted v39.11 release bundle.
// The generated files are a behavior-preserving compatibility baseline. Keep
// handwritten replacements in ../src outside of src/generated.

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { parse } = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const toolDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(toolDir, "..");
const sourceFile = path.resolve(projectDir, "../recovered/formatted/index.js");
const garageFile = path.resolve(
  projectDir,
  "../recovered/formatted/assets/GarageXView-DSeU5AUN.js",
);
const outputDir = path.resolve(projectDir, "src/generated");
const expectedSourceHash =
  "688ec0b3caad96d5e29ea2dcdb827d3f45ff6467c5654b6165a779b0de1832f6";

// These offsets are verified top-level statement boundaries in the formatted
// file. The data section was omitted from recovered/modules but is included
// here so the generated source remains self-contained.
const sections = [
  { name: "vendor", start: 0, end: 678960 },
  { name: "formats", start: 678960, end: 1078192 },
  { name: "library", start: 1078192, end: 1452503 },
  { name: "data", start: 1452503, end: 4369296 },
  { name: "vehicle", start: 4369296, end: 4808523 },
  { name: "driving", start: 4808523, end: 4935967 },
  { name: "world", start: 4935967, end: 5290029 },
  { name: "ui", start: 5290029, end: 5550877 },
  { name: "multiplayer", start: 5550877, end: 5775467 },
  { name: "timeattack", start: 5775467, end: 6099176 },
  { name: "app", start: 6099176, end: 6142501 },
];

// Rollup scope hoisting left two cycles between adjacent regions. These are
// small helpers whose implementations do not depend on game state. Moving them
// into one module breaks those cycles without changing any call site.
const sharedMathNames = new Set([
  "F2",
  "F4",
  "m",
  "dl",
  "On",
  "Rg",
  "I1",
  "N1",
  "Tt",
  "t0",
]);
const inputOverrides = new Set(["l2", "sG", "Nt"]);
const resourceOverrides = new Set(["uo0"]);
const formatRoadDescriptorOverrides = new Map([
  ["VG", "function VG(descriptor) { return roadSurface(descriptor); }"],
  ["Ri", "function Ri(descriptor) { return roadRail(descriptor); }"],
  ["TW", "function TW(descriptor) { return roadSound(descriptor); }"],
  ["mo", "function mo(descriptor) { return isMovableRoad(descriptor); }"],
  ["Fl", "function Fl(descriptor, mesh) { return movingRoadIssue(descriptor, mesh); }"],
  ["NG", "function NG(descriptor, mesh) { return anyRoadIssue(descriptor, mesh); }"],
  ["Vm", "function Vm(descriptor) { return staticRoadIssue(descriptor); }"],
]);
const formatRoadExtractionOverrides = new Map([
  ["qG", "function qG(root) { return extractTrackRoads(root, Vm); }"],
]);
const formatObstacleOverrides = new Map([
  ["Um", "function Um(object) { return admitMovingObstacle(object); }"],
  ["e3", "function e3(point, matrix) { return transformObstaclePoint(point, matrix); }"],
]);
const formatTrackAdmissionOverrides = new Map([
  ["XW", "function XW(root) { return readTrackSettings(root); }"],
  ["YW", "function YW(parsed, mode = \"strict\", options = {}) { return extractTrackRoute(parsed, mode, options); }"],
  ["ZW", "function ZW(parsed, mode = \"strict\") { return trackRuntimeIssues(parsed, mode); }"],
  ["HG", "function HG(object) { return itemGameOnly(object); }"],
  ["Au", "function Au(mode) { return soloTrackMode(mode); }"],
]);
const formatKartIdentityOverrides = new Map([
  ["Cr", "const Cr = legacyKartFamilies;"],
  ["n3", "function n3(itemId) { return isBlockedKartId(itemId); }"],
  ["Mw", "function Mw(itemId) { return blockedKartMessage(itemId); }"],
  ["j6", "function j6(itemId) { return requirePlayableKartId(itemId); }"],
  ["_Z", "function _Z(family) { return defaultLegacyKartState(family); }"],
  ["xw", "function xw(key, alias) { return legacyKartStateForAlias(key, alias); }"],
  ["b4", "function b4(catalog, itemId, path, systemKey) { return resolveKartSelection(catalog, itemId, path, systemKey); }"],
  ["N3", "function N3(kart) { return kartCatalogIdentity(kart); }"],
  ["GZ", "function GZ(key) { return stableSystemKartKey(key); }"],
]);
// Time attack result reward slots (server-go/ECONOMY.md 7.7): the release bound
// RP and Lucci to a constant " +0"; they now read the settled account reward.
const formatTimeAttackRewardOverrides = new Map([
  ["mX", `function mX(n, e, t) {
  const i = new Map();
  return (
    uM(i, ue(n, "timeinfo"), "elapsed"),
    uM(i, ue(n, "bestinfo"), "best"),
    i.set(ue(ue(e, "crashInfo"), "count"), "crash-count"),
    i.set(ue(ue(e, "boosterInfo"), "count"), "booster-count"),
    i.set(ue(t, "RP"), "reward-exp"),
    i.set(ue(t, "Lucci"), "reward-lucci"),
    i
  );
}`],
  ["wX", `function wX(n, e, t, i) {
  if (n === void 0) return;
  if (n === "crash-count") return i.crash;
  if (n === "booster-count") return i.booster;
  if (n === "reward-exp") return i.exp;
  if (n === "reward-lucci") return i.lucci;
  const [r, s] = n.split("-");
  return (r === "elapsed" ? e : t)[s];
}`],
  ["gX", `function gX(n, e, t, i) {
  const r = Eo(e.elapsedMs),
    s = Eo(e.bestMs),
    o = {
      crash: hM(e.crashCount, "crashCount"),
      booster: hM(e.boosterCount, "boosterCount"),
      exp: timeAttackRewardText(e.rewardExp),
      lucci: timeAttackRewardText(e.rewardLucci),
    },
    a = dn(n.windowTree, t, i, {
      visibility: (c) => (n.visiblePanels.has(c) ? !0 : void 0),
      text: (c) => wX(n.textBindings.get(c), r, s, o),
    });
  return dt(a, n.textures);
}`],
]);
const formatFontLayoutOverrides = new Map([
  ["pa", "function pa(layout, text) { return layoutSpriteFont(layout, text); }"],
  ["$B", "function $B(layout, text, glyphs) { return layoutSpriteFontInto(layout, text, glyphs); }"],
  ["ga", "function ga(node, texture) { return spriteFontLayoutForPanel(node, texture, fontLayoutOps); }"],
]);
const retiredFormatFontHelpers = new Set(["Jb", "eM", "tM", "Wp", "Yj", "A8"]);
const retiredFormatSource = new Set([
  "EW", "OG", "_W", "KA",
  "NW", "OW", "zW", "l8", "wo", "UW", "yu", "$W", "WW", "L0",
  "aH", "cH", "lH", "uH", "Ps", "hH", "UH", "$H", "WH", "HH", "jH", "XH",
]);
const resourceLookupMethodOverrides = new Map([
  ["constructor", "  constructor(input) { initializeResourceLookup(this, input); }"],
  ["get", "  get(path) { return getResource(this, path); }"],
  ["physicalContainerNames", "  physicalContainerNames(paths) { return resourcePhysicalContainerNames(this, paths); }"],
  ["resolveContainerPath", "  resolveContainerPath(origin, target) { return resourceResolveContainerPath(this, origin, target); }"],
  ["exactCanonicalCandidates", "  exactCanonicalCandidates(path) { return resourceExactCanonicalCandidates(this, path); }"],
  ["canonicalCandidates", "  canonicalCandidates(path) { return resourceCanonicalCandidates(this, path); }"],
  ["entriesUnderCanonicalPrefix", "  entriesUnderCanonicalPrefix(prefix) { return resourceEntriesUnderCanonicalPrefix(this, prefix); }"],
  ["hasManifestMount", "  hasManifestMount(path) { return resourceHasManifestMount(this, path); }"],
  ["findSibling", "  findSibling(path, names) { return resourceFindSibling(this, path, names); }"],
]);
const trackCatalogMethodOverrides = new Map([
  ["mapAssets", "  mapAssets() { return mapAssets(this); }"],
  ["mapCatalog", "  mapCatalog() { return mapCatalog(this); }"],
  ["trackMetadataCatalog", "  trackMetadataCatalog() { return trackMetadataCatalog(this); }"],
  ["trackTitles", "  trackTitles() { return trackTitles(this); }"],
  ["trackMetadata", "  trackMetadata(id) { return trackMetadata(this, id); }"],
  ["timeAttackTrackCatalog", "  timeAttackTrackCatalog() { return timeAttackTrackCatalog(this); }"],
  ["timeAttackRandomTrackGroups", "  timeAttackRandomTrackGroups() { return timeAttackRandomTrackGroups(this); }"],
  ["timeAttackRandomTrackNames", "  timeAttackRandomTrackNames() { return timeAttackRandomTrackNames(this); }"],
]);
const vehicleIdentityMethodOverrides = new Map([
  ["vehicleAssets", "  vehicleAssets() { return vehicleAssets(this); }"],
  ["vehicleCatalog", "  vehicleCatalog() { return vehicleCatalog(this); }"],
  ["vehicleTextureKey", "  vehicleTextureKey(path) { return vehicleTextureKey(this, path); }"],
  ["vehicleEngineGrade", "  vehicleEngineGrade(path) { return vehicleEngineGrade(this, path); }"],
  ["vehicleItemId", "  vehicleItemId(path) { return vehicleItemId(this, path); }"],
  ["vehicleLinkCharacterId", "  vehicleLinkCharacterId(path) { return vehicleLinkCharacterId(this, path); }"],
  ["loadVehicleEngineGrades", "  loadVehicleEngineGrades() { return loadVehicleEngineGrades(this); }"],
  ["loadVehicleItemIds", "  loadVehicleItemIds() { return loadVehicleItemIds(this); }"],
  ["loadVehicleLinkCharacterIds", "  loadVehicleLinkCharacterIds() { return loadVehicleLinkCharacterIds(this); }"],
]);
const remainingResourceMethodOverrides = new Map([
  ["bodyParams", "  bodyParams() { return bodyParams(this); }"],
  ["timeAttackGarageCatalog", "  timeAttackGarageCatalog() { return timeAttackGarageCatalog(this); }"],
  ["timeAttackKartItem", "  timeAttackKartItem(id, path) { return timeAttackKartItem(this, id, path); }"],
  ["timeAttackPlateItem", "  timeAttackPlateItem(id) { return timeAttackPlateItem(this, id); }"],
  ["timeAttackCharacterItem", "  timeAttackCharacterItem(id, path) { return timeAttackCharacterItem(this, id, path); }"],
  ["timeAttackLinkedCharacterItem", "  timeAttackLinkedCharacterItem(id) { return timeAttackLinkedCharacterItem(this, id); }"],
  ["timeAttackDecorationItem", "  timeAttackDecorationItem(category, id) { return timeAttackDecorationItem(this, category, id); }"],
  ["loadTimeAttackGarageCatalog", "  loadTimeAttackGarageCatalog() { return loadTimeAttackGarageCatalog(this, { parseShopXml: Zu, resolveModel: IR, legacyFamilies: Cr }); }"],
  ["itemTableGarageDefinitions", "  itemTableGarageDefinitions() { return itemTableGarageDefinitions(this, { parseXml: x1, legacyFamilies: Cr }); }"],
  ["vehicleTitles", "  vehicleTitles() { return vehicleTitles(this, { parseXml: Zu }); }"],
  ["loadTrackConfig", "  loadTrackConfig(path) { return loadTrackConfig(this, path, { parseBml: s2, parseXml: x1 }); }"],
]);
const swMethodOverrides = new Map([
  ...resourceLookupMethodOverrides,
  ...trackCatalogMethodOverrides,
  ...vehicleIdentityMethodOverrides,
  ...remainingResourceMethodOverrides,
  ["load", "  static load(sources, onProgress, indexes) { return loadSwWithReadableCodec(Sw, sources, onProgress, indexes); }"],
]);
const raceHudBoostMethodOverrides = new Map([
  ["boostFrame", "  boostFrame(timeMs, ratio) { return personalBoostFrame(this, timeMs, ratio, Ro); }"],
  ["teamBoostFrame", "  teamBoostFrame(timeMs, ratio) { return teamBoostFrame(this, timeMs, ratio, Ro); }"],
]);
const lobbyListDrawMethodOverrides = new Map([
  ["draw", "  draw(node, parent, room, titleRight) { return drawLobbyListNode(this, node, parent, room, titleRight, lobbyListDrawDependencies); }"],
  ["activate", "  activate(name) { return activateLobbyListEntry(this, name, Zc, $6); }"],
  ["render", "  render() { return renderLobbyList(this, lobbyListRenderDependencies); }"],
]);
const multiplayerWindowAssetMethodOverrides = new Map([
  ["loadAssets", "  async loadAssets() { return loadMultiplayerWindowAssets(this, multiplayerWindowAssetDependencies); }"],
  ["draw", "  draw(node, parent, visibleControls) { return drawMultiplayerWindowNode(this, node, parent, visibleControls, multiplayerWindowDrawDependencies); }"],
  ["render", "  render() { return renderMultiplayerWindow(this, Sr); }"],
  ["canvasButton", "  canvasButton(node, rect, text, state) { return multiplayerCanvasButton(this, node, rect, text, state, T); }"],
  ["updateHoverRegion", "  updateHoverRegion(event) { return updateMultiplayerHoverRegion(this, event); }"],
  ["closeCombo", "  closeCombo() { return closeMultiplayerCombo(this); }"],
  ["chooseCombo", "  chooseCombo(index) { return chooseMultiplayerCombo(this, index); }"],
  ["drawComboPopup", "  drawComboPopup() { return drawMultiplayerComboPopup(this, multiplayerComboDependencies); }"],
]);
const ghostOverrides = new Set([
  "LD", "V_", "N_", "Dh0", "Vh0", "O_",
  "Ah0", "bh0", "Th0",
]);
const ksvOverrides = new Set(["Ff", "ph0"]);
const ghostRuntimeClassOverrides = new Map([
  ["kD", "class kD extends GhostPoseRecorder { constructor(zCeiling) { super(zCeiling, ghostPoseRecorderDependencies); } }"],
  ["nf0", "class nf0 extends GhostPlayback { constructor(record, mode = () => \"native\") { super(record, mode, ghostPlaybackDependencies); } }"],
  ["af0", "class af0 extends GhostParticipantStream { constructor(zCeiling) { super(new kD(zCeiling)); } }"],
  ["cf0", "class cf0 extends GhostRecorder { constructor(zCeiling) { super(zCeiling, value => new af0(value)); } }"],
  ["hf0", "class hf0 extends GhostRouteProgress {}"],
]);
const lobbyAvatarDeclarationOverrides = new Map([
  ["Cl0", "function Cl0(member, mode) { return lobbyAvatarKey(member, mode, t6); }"],
  ["El0", "class El0 extends LobbyAvatarCache { constructor(build, release, changed, failed) { super(build, release, changed, failed, t6); } }"],
]);
const lobbyRoomTimingMethodOverrides = new Map([
  ["setStartPresentation", "  setStartPresentation(enabled) { return setLobbyStartPresentation(this, enabled, lobbyRoomTimingDependencies); }"],
  ["roomCanAnimate", "  roomCanAnimate() { return canAnimateLobbyRoom(this); }"],
  ["updateCountdown", "  updateCountdown(room) { return updateLobbyCountdown(this, room, lobbyRoomTimingDependencies); }"],
  ["countdownState", "  countdownState() { return lobbyCountdownState(this, lobbyRoomTimingDependencies); }"],
  ["countdownLocked", "  get countdownLocked() { return isLobbyCountdownLocked(this); }"],
  ["sendEmotion", "  async sendEmotion(emotion) { return sendLobbyEmotion(this, emotion); }"],
  ["animate", "  animate() { return animateLobbyRoom(this, lobbyRoomTimingDependencies); }"],
  ["sendChat", "  async sendChat() { return sendLobbyRoomChat(this); }"],
]);
const lobbyRoomLifecycleMethodOverrides = new Map([
  ["show", "  show() { return showLobbyRoomLifecycle(this, lobbyRoomLifecycleDependencies); }"],
  ["hide", "  hide() { return hideLobbyRoom(this, lobbyRoomLifecycleDependencies); }"],
  ["activateReadyShortcut", "  activateReadyShortcut() { return activateLobbyReadyShortcut(this); }"],
  ["update", "  update(room, busy, connected) { return updateLobbyRoom(this, room, busy, connected, this.emotions, lobbyRoomLifecycleDependencies); }"],
  ["dispose", "  dispose() { return disposeLobbyRoom(this, lobbyRoomLifecycleDependencies); }"],
  ["installRoomKeyboard", "  installRoomKeyboard() { return installLobbyRoomKeyboard(this, lobbyRoomLifecycleDependencies); }"],
  ["removeRoomKeyboard", "  removeRoomKeyboard() { return removeLobbyRoomKeyboard(this, lobbyRoomLifecycleDependencies); }"],
  ["toggleEmotionWheel", "  toggleEmotionWheel() { return toggleLobbyEmotionWheel(this); }"],
  ["closeEmotionWheel", "  closeEmotionWheel() { return closeLobbyEmotionWheel(this); }"],
  ["loadTrack", "  async loadTrack() { return loadLobbyRoomTrack(this, lobbyRoomTrackDependencies); }"],
]);
const lobbyRoomMethodOverrides = new Map([
  ...lobbyRoomTimingMethodOverrides,
  ...lobbyRoomLifecycleMethodOverrides,
  ["constructor", "  constructor(room, playerId, actions, library) { initializeLobbyRoom(this, room, playerId, actions, library); }"],
  ["load", "  static async load(library, root, room, playerId, actions, audioContext) { return loadLobbyRoom((snapshot, id, callbacks, resources) => new py(snapshot, id, callbacks, resources), library, root, room, playerId, actions, audioContext, lobbyRoomConstructionDependencies); }"],
  ["state", "  state(node) { return lobbyRoomNodeState(this, node, lobbyRoomStateDependencies); }"],
]);
const lobbyRoomFieldOverrides = new Map([
  ["onEmotionKey", "  onEmotionKey = event => handleLobbyEmotionKey(this, event);"],
  ["onRoomKey", "  onRoomKey = event => handleLobbyRoomKey(this, event, document.body);"],
]);
const lobbyDialogMethodOverrides = new Map([
  ["confirm", "  static async confirm(options, title, message, onConfirm, labels) { return confirmLobbyMessage((...args) => b1.messageBox(...args), options, title, message, onConfirm, labels); }"],
  ["notice", "  static async notice(options, title, message) { return noticeLobbyMessage((...args) => b1.messageBox(...args), options, title, message); }"],
  ["messageBox", "  static async messageBox(options, title, message, confirm, labels, noticeOnly = false) { return showLobbyMessageBox(() => new b1(), options, title, message, confirm, labels, noticeOnly, lobbyDialogViewDependencies); }"],
  ["create", "  static async create(options, mode, nickname, submit) { return createLobbyRoomDialog((...args) => b1.createForm(...args), options, mode, nickname, submit); }"],
  ["createOrdinary", "  static async createOrdinary(options, channel, nickname, submit) { return createOrdinaryRoomDialog((...args) => b1.createForm(...args), options, channel, nickname, submit, lobbyDialogCategoryDependencies); }"],
  ["createGameplay", "  static async createGameplay(options, gameplay, channel, nickname, submit) { return createGameplayRoomDialog((...args) => b1.createForm(...args), options, gameplay, channel, nickname, submit, lobbyDialogCategoryDependencies); }"],
  ["password", "  static async password(options, submit) { return showLobbyPasswordDialog(() => new b1(), options, submit, lobbyDialogViewDependencies); }"],
  ["team", "  static async team(options, currentTeam, chooseTeam) { return showLobbyTeamDialog(() => new b1(), options, currentTeam, chooseTeam, lobbyDialogViewDependencies); }"],
  ["createForm", "  static async createForm(options, mode, nickname, submit, channel, gameplay = 'ordinary') { return showLobbyRoomCreationForm(() => new b1(), options, mode, nickname, submit, channel, gameplay, lobbyRoomFormDependencies); }"],
  ["roomSettings", "  static async roomSettings(options, mode, settings, submit) { return showLobbyRoomSettings(() => new b1(), options, mode, settings, submit, lobbyDialogViewDependencies); }"],
  ["setBusy", "  setBusy(value) { return setLobbyDialogBusy(this, value); }"],
  ["dispose", "  dispose() { return disposeLobbyDialog(this); }"],
]);
const multiplayerPresentationFunctionOverrides = new Map([
  ["Ll0", "async function Ll0(library, roadblock = false) { return loadLobbyRoomTemplate(library, roadblock, roomTemplateDependencies); }"],
  ["Pl0", "function Pl0(root, riderCard, teams = [], difficulty, talkBalloon, roadblock = false) { return buildLobbyRoomTemplate(root, riderCard, teams, difficulty, talkBalloon, roadblock, roomTemplateDependencies); }"],
  ["Fl0", "function Fl0(root, emotions) { return addLobbyEmotionWheel(root, emotions, roomTemplateDependencies); }"],
  ["_F", "function _F(node, width, height) { return rpSceneCameraMatrices(node, width, height, T); }"],
  ["Dl0", "function Dl0(camera, node, width, height) { return configureRpSceneCamera(camera, node, width, height, rpCameraDependencies); }"],
  ["Vl0", "function Vl0(root, kartTitle, petTitle) { return decorateRpResultTemplate(root, kartTitle, petTitle, roomTemplateDependencies); }"],
  ["Nl0", "async function Nl0(library, race, playerId, signal) { return preloadRpFlyingPet(library, race, playerId, signal, rpPetPreloadDependencies); }"],
]);
const multiplayerSupportFunctionOverrides = new Map([
  ["vl0", "function vl0(root, signal) { return showAccountServiceProgress(root, signal, accountProgressDependencies); }"],
  ["xF", "function xF(origin) { return loadMultiplayerSessionToken(origin, multiplayerTokenStore); }"],
  ["wl0", "function wl0(origin, token) { return saveMultiplayerSessionToken(origin, token, multiplayerTokenStore); }"],
  ["SF", "function SF(origin) { return clearMultiplayerSessionToken(origin, multiplayerTokenStore); }"],
  ["im", "function im() { return loadLocalRiderNickname(() => localStorage); }"],
  ["EF", "function EF(nickname) { return saveLocalRiderNickname(nickname, () => localStorage); }"],
  ["bl0", "function bl0() { return clearLocalRiderNickname(() => localStorage); }"],
  ["Sl0", "async function Sl0(library, equipment, teamIndex, member, initial = '') { return loadLobbyAvatarAppearance(library, equipment, teamIndex, member, initial, lobbyAvatarAppearanceDependencies); }"],
  ["kl0", "function kl0(text) { return wrapLobbyChatBubble(text); }"],
  ["FT", "function FT(room, playerId) { return lobbyRiderSlots(room, playerId); }"],
  ["TF", "function TF(room) { return roadblockRunnerId(room, G2); }"],
  ["DT", "function DT(room, colors) { return decorateIndividualRiders(decorateRoadblockRiders(room, colors, TF(room))); }"],
  ["Hl0", "function Hl0(options) { return multiplayerReadyOptions(options, Ue); }"],
]);
const ghostKsvClassMethodOverrides = new Map([
  ["encode", "  encode(recording, zCeiling) { return encodeGhostKsvRecording(recording, zCeiling, ghostKsvExportDependencies); }"],
  ["build", "  build(recording, encoded) { return buildGhostKsvHeader(recording, encoded); }"],
]);
const ghostKsvFunctionOverrides = new Map([
  ["F_", "function F_(frame) { return nativeFrameToKsvStamp(frame, ghostKsvExportDependencies.encodeStatus); }"],
  ["Ph0", "function Ph0(equipment) { return ghostKsvEquipment(equipment); }"],
]);
const multiplayerPresenterMethodOverrides = new Map([
  ["constructor", "  constructor(assets, runtime, race, playerId, actionAssets, hud, random, countdown, award, resultView, bgm, banner, bannerRequest, petVisible = () => false, trackInfoCard, roadblockHud) { initializeRacePresenter(this, { assets, runtime, race, playerId, actionAssets, hud, random, countdown, award, resultView, bgm, banner, bannerRequest, petVisible, trackInfoCard, roadblockHud }, racePresenterInitializationDependencies); }"],
  ["prepareFlyingPet", "  async prepareFlyingPet(library, audioContext) { return prepareRacePresenterFlyingPet(this, library, audioContext, racePresenterSetupDependencies); }"],
  ["prepareRoadBlockFlag", "  async prepareRoadBlockFlag(library) { return prepareRacePresenterRoadblockFlag(this, library, racePresenterSetupDependencies); }"],
  ["prepareGiant", "  async prepareGiant(library, audioContext) { return prepareRacePresenterGiant(this, library, audioContext, racePresenterSetupDependencies); }"],
  ["clearGiant", "  clearGiant() { return clearRacePresenterGiant(this); }"],
  ["prepareTrackEvents", "  async prepareTrackEvents(library, audioContext) { return prepareRacePresenterTrackEvents(this, library, audioContext, racePresenterTrackEventDependencies); }"],
  ["prepareRoadBlockResult", "  async prepareRoadBlockResult(library) { return prepareRacePresenterRoadblockResult(this, library, racePresenterSetupDependencies); }"],
  ["warm", "  warm(renderer, nowMs) { return warmRacePresenter(this, renderer, nowMs, racePresenterLifecycleDependencies); }"],
  ["update", "  update(renderer, nowMs, actions) { return updateRacePresenterFrame(this, renderer, nowMs, actions, racePresenterFrameDependencies); }"],
  ["awardInput", "  awardInput(input, nowMs) { return forwardPresenterAwardInput(this, input, nowMs); }"],
  ["applyWarpCamera", "  applyWarpCamera() { return applyPresenterWarpCamera(this); }"],
  ["applyLocalWarpActions", "  applyLocalWarpActions() { return applyPresenterWarpActions(this); }"],
  ["handleRouteTag", "  handleRouteTag(tag) { return handlePresenterRouteTag(this, tag, racePresenterActionsDependencies); }"],
  ["showResult", "  showResult(nowMs) { return showRacePresenterResults(this, nowMs, racePresenterResultsDependencies); }"],
  ["startAudio", "  startAudio() { return startPresenterAudio(this); }"],
  ["playGoAndHideTrackInfo", "  playGoAndHideTrackInfo() { return playPresenterGo(this); }"],
  ["playReset", "  playReset() { return playPresenterReset(this); }"],
  ["startBoostGaugeFull", "  startBoostGaugeFull() { return startPresenterBoostGaugeFull(this, racePresenterActionsDependencies); }"],
  ["captureRankProgress", "  captureRankProgress() { return capturePresenterRankProgress(this); }"],
  ["updateRoom", "  updateRoom(room) { return updatePresenterRoom(this, room); }"],
  ["render", "  render(renderer, nowMs) { return renderRacePresenterFrame(this, renderer, nowMs, racePresenterRenderDependencies); }"],
  ["dispose", "  dispose() { return disposeRacePresenter(this, racePresenterLifecycleDependencies); }"],
  ["releaseShadowPresentations", "  releaseShadowPresentations() { return releasePresenterShadowPresentations(this); }"],
]);
const racePresentationSessionMethodOverrides = new Map([
  ["constructor", "  constructor(runtime, scene, host, chat, notice) { super(); initializeRaceSession(this, runtime, scene, host, chat, notice); }"],
  ["diagnosticsView", "  get diagnosticsView() { return raceSessionDiagnosticsView(this); }"],
  ["touchDrivingAvailable", "  get touchDrivingAvailable() { return raceSessionTouchDrivingAvailable(this); }"],
  ["touchDodgeEnabled", "  get touchDodgeEnabled() { return raceSessionTouchDodgeEnabled(this); }"],
  ["bindClock", "  bindClock(clock) { return bindRaceSessionClock(this, clock); }"],
  ["updateRoom", "  updateRoom(room) { return updateRaceSessionRoom(this, room); }"],
  ["presentingResults", "  presentingResults() { return raceSessionPresentingResults(this); }"],
  ["showWaiting", "  showWaiting() { return showRaceSessionWaiting(this, () => performance.now()); }"],
  ["scheduleStart", "  scheduleStart(start) { return scheduleRaceSessionStart(this, start); }"],
  ["update", "  update(frame) { return updateRaceSession(this, raceSessionUpdateDependencies); }"],
  ["render", "  render() { return renderRaceSession(this); }"],
  ["requestLeave", "  requestLeave() { return requestRaceSessionLeave(this); }"],
  ["fail", "  fail(error) { return failRaceSession(this, error); }"],
  ["exit", "  exit() { return exitRaceSession(this); }"],
  ["dispose", "  dispose() { return disposeRaceSession(this); }"],
]);
const trackInfoCardMethodOverrides = new Map([
  ["constructor", "  constructor(root, title, difficulty, bgmTitles, gameLabels, assets) { initializeTrackInfoCard(this, root, title, difficulty, bgmTitles, gameLabels, assets); }"],
  ["load", "  static async load(options) { return loadTrackInfoCard(options, { ...trackInfoCardLoadingDependencies, create: (...args) => new M7(...args) }); }"],
  ["setBgmName", "  setBgmName(trackId) { return setTrackCardBgm(this, trackId); }"],
  ["setVisible", "  setVisible(visible) { return setTrackCardVisible(this, visible); }"],
  ["slideOut", "  slideOut() { return slideTrackCardOut(this); }"],
  ["update", "  update(nowMs) { return updateTrackCard(this, nowMs); }"],
  ["dispose", "  dispose() { return disposeTrackCard(this, trackInfoCardRuntimeDependencies); }"],
  ["render", "  render() { return renderTrackCard(this, trackInfoCardRuntimeDependencies); }"],
  ["drawLabel", "  drawLabel(text, layout, x, y) { return drawTrackCardLabel(this, text, layout, x, y, trackInfoCardRuntimeDependencies); }"],
  ["drawClippedText", "  drawClippedText(text, rect, x, y, color) { return drawTrackCardClippedText(this, text, rect, x, y, color); }"],
]);
// These helpers only served the KSV functions and the old Ghost store. Their
// behavior now lives in the handwritten modules, so omit the dead copies.
const retiredGhostHelpers = new Set([
  "_y", "Gy", "uh0", "hh0", "yD", "AD", "bD", "k_", "dh0", "MD",
  "gh0", "mh0", "SD", "CD", "ED", "wh0", "vh0", "yh0", "TD", "_D",
  "Mh0", "xh0", "Sh0", "L_", "_h0", "Df", "Pc",
]);
const physicsOverrides = new Set(["r7", "pS", "JI", "qw", "ek"]);
const motionCodecOverrides = new Set(["S40", "d6"]);
const vehicleBusinessOverrides = new Set(["y10", "_r", "H10"]);
const vehicleAnimationSelectorOverrides = new Set(["ag", "sk", "ok"]);
const vehicleAnimationActionOverrides = new Set(["b10", "bS", "rk"]);
const vehicleCoinSourceOverrides = new Map([
  ["v10", "function v10(bytes) { return parseTrackCoinResources(bytes, { parse: s2, attribute: T }); }"],
  ["A10", "async function A10(library, track) { return loadTrackCoinSource(library, track, bytes => v10(bytes)); }"],
  ["nl", "function nl(library, path) { return uniqueOriginalCoinAsset(library, path); }"],
]);
const vehicleCoinOwnerOverrides = new Set(["jw"]);
const vehicleVisualOwnerOverrides = new Set(["tv", "d7"]);
const vehicleWeatherOverrides = new Set(["sL", "y7", "A7"]);
const vehicleRouteFunctionOverrides = new Set(["Eg", "Vo", "gv"]);
const vehicleWarpClassOverrides = new Set(["Qk"]);
const vehicleTrackEventOverrides = new Set(["EC", "Kn0"]);
const vehicleEventAnimatorOverrides = new Set(["qn0"]);
const vehicleLensFlareOverrides = new Set(["c30", "w7"]);
const vehicleKartAudioOverrides = new Set([
  "C30", "pv", "E30", "T30", "_30", "G30", "Be", "B30", "ll", "R30",
]);
const vehicleAssetLoaderMethodOverrides = new Map([
  ["loadVehicleAsset", "  async loadVehicleAsset(path, itemId, hint, body, kartName, environment, stageBinding, audioContext, coatingTexture, decorationOption, convertClientCoordinates, suppressClassic = false, forceNew = false) { return loadVehicleAsset(this, path, itemId, hint, body, kartName, environment, stageBinding, audioContext, coatingTexture, decorationOption, convertClientCoordinates, suppressClassic, forceNew, vehicleAssetOps); }"],
  ["loadRaceCharacters", "  async loadRaceCharacters(characterPath, characterItem, kartItem, motionBasis, includeSpecialMotion, environment, stageBinding, award = false) { return loadRaceCharacters(this, characterPath, characterItem, kartItem, motionBasis, includeSpecialMotion, environment, stageBinding, award); }"],
  ["loadVehicleRuntime", "  async loadVehicleRuntime(path, textureKey, plateId, library, environment, stageBinding, profile = this.assetHost.userProfile, kartItemId, engineGrade, coatingTextureOverride, scope, convertClientCoordinates, deferEnvironment = false) { return loadVehicleRuntime(this, path, textureKey, plateId, library, environment, stageBinding, profile, kartItemId, engineGrade, coatingTextureOverride, scope, convertClientCoordinates, deferEnvironment, vehicleRuntimeOps); }"],
  ["loadCharacterAsset", "  async loadCharacterAsset(path, item, motionSource, animationType, includeF54, environment, stageBinding, linkMode, profile = this.assetHost.userProfile, outlineBatch, award = false) { return loadCharacterAsset(this, path, item, motionSource, animationType, includeF54, environment, stageBinding, linkMode, profile, outlineBatch, award, characterAssetOps); }"],
  ["loadAssetMap", "  loadAssetMap(path, trackId) { return loadTimeAttackMap(this, path, trackId, J30); }"],
  ["loadMultiplayerMap", "  loadMultiplayerMap(path, trackId, mode) { return loadMultiplayerMap(this, path, trackId, mode, Bt, Vw, Z30); }"],
  ["loadMap", "  async loadMap(path, trackId, mode, admit, lte = false) { return loadTrackMap(this, path, trackId, mode, admit, lte, trackMapOps); }"],
]);
// item-mode(world): item races (道具赛) load their map through the
// speed-individual admission with an item-game flag (cubes, moving cubes,
// onlyItemGame objects and track hazards admitted), and A40 builds the per-race
// cube and hazard owners next to the LTE coins. Everything else is unchanged.
vehicleAssetLoaderMethodOverrides.set("loadMap", "  async loadMap(path, trackId, mode, admit, lte = false, itemGame = false) { return loadTrackMap(this, path, trackId, mode, admit, lte, trackMapOps, itemGame); }");
const itemWorldVehicleImports = [
  'import { isItemRaceRoom, loadItemGameTrackSources, loadItemRaceFields } from "../item/item-race-map.ts";',
];
const itemWorldVehicleOps = [
  "const itemWorldFieldOps = { createObject: () => new T2(), originalAsset: nl, decodeModel: y9, decodeAudio: Q9, loadModel: c5, routeAudio: S9 };",
  "trackMapOps.loadItemGame = loadItemGameTrackSources;",
];
// A40 (multiplayer race assets): pick the item admission from the room itself,
// because drivingMode is only derived at the end of A40.
const itemWorldRaceAssetPatches = [
  [`: _.loadMultiplayerMap(E.path, E.id)`,
    `: _.loadMultiplayerMap(E.path, E.id, isItemRaceRoom(e) ? "item" : void 0)`],
  [`    (D && S.push(() => D.dispose()), w());`,
    `    (D && S.push(() => D.dispose()), w());
    const itemRaceFields = await loadItemRaceFields(g, C, i, itemWorldFieldOps);
    (itemRaceFields && S.push(() => itemRaceFields.dispose()), w());`],
  [`      lteCoins: D,`,
    `      lteCoins: D,
      itemCatalog: itemRaceFields?.catalog,
      itemCubes: itemRaceFields?.cubes,
      itemHazards: itemRaceFields?.hazards,`],
];
function applyItemWorldPatches(text, patches) {
  for (const [from, to] of patches) {
    assert(text.split(from).length === 2, `item-mode(world) patch anchor changed: ${from}`);
    text = text.replace(from, to);
  }
  return text;
}
// item-mode(fx): the item race presenter (道具赛表现层, src/item/item-race-presenter.ts)
// is built in A40 right after the cube and hazard owners, with the same
// environment, stage binding, model ops and audio context, and returned as
// assets.itemPresenter (undefined outside item races). Every model and sound
// of the item set loads here, so the first use of an item has no hitch.
itemWorldVehicleImports.push(
  'import { loadItemRacePresenter } from "../item/item-race-presenter.ts"; // item-mode(fx)');
itemWorldVehicleOps.push(
  "const itemPresenterOps = { originalAsset: nl, decodeModel: y9, decodeAudio: Q9, loadModel: c5, routeAudio: S9, setGain: he }; // item-mode(fx)");
itemWorldRaceAssetPatches.push(
  [`    (itemRaceFields && S.push(() => itemRaceFields.dispose()), w());`,
    `    (itemRaceFields && S.push(() => itemRaceFields.dispose()), w());
    const itemPresenter = itemRaceFields // item-mode(fx)
      ? await loadItemRacePresenter(g, itemRaceFields.catalog, C.environment, C.stageBinding, i, itemPresenterOps)
      : void 0;
    (itemPresenter && S.push(() => itemPresenter.dispose()), w());`],
  [`      itemHazards: itemRaceFields?.hazards,`,
    `      itemHazards: itemRaceFields?.hazards,
      itemPresenter, // item-mode(fx)`],
);
const vehicleSlipstreamOverrides = new Set(["mv", "wv"]);
const vehicleStartGridOverrides = new Set(["iL", "rL"]);
const vehicleNormalCoordinatorOverrides = new Set(["vL", "U40", "yL", "as", "J8"]);
const vehicleFrameClockOverrides = new Set(["$40", "DC"]);
const vehicleResidualOverrides = new Map([
  ["Vn0", "function Vn0(model) { return collectDummySounds(model); }"],
  ["m7", `class m7 extends TrackDummySurroundAudio {
  constructor(context, sounds, ops = trackSurroundAudioOps) { super(context, sounds, ops); }
  static load(library, sounds, context) { return super.load(library, sounds, context, trackSurroundAudioOps); }
}`],
  ["v7", `class v7 extends StandaloneEventSurroundAudio {
  constructor(context, sounds, ops = trackSurroundAudioOps) { super(context, sounds, ops); }
  static load(library, events, worldMatrix, context) {
    return super.load(library, events, context, {
      ...trackSurroundAudioOps, worldMatrix, transformPoint: e3,
    });
  }
}`],
  ["eL", "function eL(config) { return unsupportedEventSound(config); }"],
  ["I30", "class I30 extends ReadyCameraController { constructor(model) { super(model, readyCameraOps); } }"],
  ["O30", "function O30(model, context) { return warpNextCamera(model, { clientWorldElements: context.clientWorldElements, fieldOfView: we }); }"],
  ["gn0", "class gn0 extends V1TachometerPresentation { constructor(definition, seed) { super(definition, seed, v1TachometerOps); } }"],
  ["Cn0", "class Cn0 extends XGenTachometerPresentation { constructor(definition) { super(definition, xgenTachometerOps); } }"],
  ["Y30", "function Y30(model, source, mode, options = {}) { return buildTrackAdmissionLedger(model, source, mode, options, trackAdmissionOps); }"],
  ["n40", "function n40(entry, index, mode, source, lensFlareCount, courseSoundEnabled, lteCoinsEnabled) { return admitTrackObject(entry, index, mode, source, lensFlareCount, courseSoundEnabled, lteCoinsEnabled, trackAdmissionOps); }"],
  ["No", "function No(incoming, current) { return isNewMotionSequence(incoming, current); }"],
  ["I40", "class I40 extends VehicleMotionSender {}"],
  ["k40", "class k40 extends VehicleMotionReceiver {}"],
  ["F40", "class F40 extends LteDodgeMotion {}"],
  ["D40", "class D40 extends LteDodgeInput { constructor() { super(lteDodgeInputOps); } }"],
  ["Ea", `const Ea = createTailLampEffectClass({
  Object3D: T2, Vector3: H, DataTexture: J9, ShaderMaterial: Vt,
  BufferGeometry: t9, BufferAttribute: _0, Mesh: D2,
  decodePng: p2, configureMesh: Ao,
  rgbaFormat: e9, unsignedByteType: _9, srgbColorSpace: v9,
  clampToEdgeWrapping: S1, linearFilter: u9, dynamicDrawUsage: r1,
  lessEqualDepth: y1, doubleSide: s1, customBlending: u1,
  sourceAlpha: l1, oneBlend: h3, additiveEquation: R9,
});`],
]);
const peerMeshOverrides = new Set(["pl0"]);
const networkTimingOverrides = new Set(["L40", "gl0"]);
const remoteMotionOverrides = new Set(["BL", "Gi0"]);
const raceDrivingScaleOverrides = new Set(["Oi0", "zi0", "fE"]);
const racePeerCadenceOverrides = new Set(["Vi0", "Ni0"]);
const outgoingRaceMotionOverrides = new Set(["FL", "Ii0", "ki0"]);
const worldPerformanceOverrides = new Set(["ko0", "qo0", "yc", "jo0", "Xo0"]);
const worldHudOverrides = new Set([
  "$o0", "Wo0", "Ho0", "X1", "QE", "JE", "Ko0", "eT",
]);
const worldLocalDirectoryOverrides = new Set([
  "io0", "ro0", "so0", "gP", "ao0", "co0",
]);
const retiredTouchLayoutHelpers = new Set([
  "$T", "WT", "HT", "s60", "Ay", "o60", "a60", "_c",
]);
const retiredTouchDrivingHelpers = new Set(["i60", "Mi", "u60", "h60"]);
const drivingCollisionOverrides = new Map([
  ["ni0", "function ni0() { return createVehicleCollisionScratch(F2); }"],
  ["Mt", "function Mt(road) { return optionalRoadSurface(road, VG); }"],
  ["vv", null],
  ["Oo", null],
  ["S5", null],
  ["hi0", null],
  ["vd", null],
  ["yd", null],
  ["Ad", null],
  ["yv", null],
  ["bd", null],
  ["di0", null],
  ["Md", null],
  ["pi0", "function pi0(triangles, verticesOf, timeMs, previousMs) { return updateTrackedTriangleVelocity(triangles, verticesOf, timeMs, previousMs, trackedTriangleMath); }"],
]);
const appBootOverrides = new Map([
  ["Rf0", "function Rf0(garage, tracks, profile) { return resolveStartupSelection(garage, tracks, profile, startupSelectionDependencies); }"],
  ["If0", "function If0(canReload) { return watchFrontendVersion(canReload); }"],
  ["kf0", "function kf0(width, height, ratio) { return fitGameViewport(width, height, ratio); }"],
  ["Lf0", "function Lf0(root) { return mountGameViewport(root, xe); }"],
]);
const inputClassOverrides = new Set(["Xl0", "Zl0"]);
const inputFunctionOverrides = new Map([
  ["xP", { section: "world", text: "function xP(code) { return browserScanCode(code); }" }],
  ["v6", { section: "world", text: "function v6(axis, value) { return gamepadAxisControl(axis, value); }" }],
  ["Hg", { section: "world", text: "function Hg(gamepads) { return pressedGamepadControls(gamepads); }" }],
  ["xl", { section: "multiplayer", text: "function xl(code, keyMap = Br) { return keyboardActionsForCode(code, keyMap, ut); }" }],
  ["yf", { section: "multiplayer", text: "function yf(target) { return isEditableTarget(target); }" }],
]);
const gameplayAdmissionOverrides = new Map([
  ["rg", "function rg(mode) { return isPlayableGameplay(mode); }"],
]);
const gameplayTileOverrides = new Map([
  ["Y6", "const Y6 = multiplayerModeTiles;"],
]);
const lobbyPrimitiveOverrides = new Set(["Ul0", "C1"]);
const uiSymbolOverrides = new Set([
  "ds", "ry", "b6", "WP", "Ma0", "xa0", "Tc0", "uT", "qa0", "nf", "qv", "bc",
  "J80", "Q80", "Z80", "P80", "fF", "W80",
]);
const retiredUiHelpers = new Set(["rT"]);
const localProfileFunctionOverrides = new Map([
  ["Sa0", "function Sa0(index) { return uniqueItemKey(index); }"],
  ["Ca0", "function Ca0(width, centered) { return centerOffset(width, centered); }"],
  ["Jd", "function Jd(item) { return favoriteItemIdentity(item); }"],
  ["wl", "function wl(item) { return canFavoriteItem(item); }"],
  ["ef", "function ef(item) { return makeFavoriteItem(item); }"],
  ["Q3", "function Q3(item) { return favoriteItemKey(item); }"],
  ["sT", "function sT(items) { return favoriteItemKeys(items); }"],
  ["oT", "function oT(value, limit) { return isUnsignedInteger(value, limit); }"],
  ["Ea0", "function Ea0(value) { return hasSystemKartKey(value); }"],
  ["gr", "function gr() { return defaultLocalProfile(); }"],
  ["Ta0", "function Ta0() { return loadBrowserProfile(() => loadLocalProfile(localStorage, localProfileDependencies), serialized => parseLocalProfile(serialized, localProfileDependencies)); }"],
  ["aT", "function aT(profile, kartId, characterId, systemKart, variant) { return selectLocalKart(profile, kartId, characterId, systemKart, variant, localProfileDependencies); }"],
  ["cT", "function cT(profile) { saveLocalProfile(profile, localStorage, localProfileDependencies); syncBrowserProfile(profile); }"],
  ["_a0", "function _a0(serialized) { return parseLocalProfile(serialized, localProfileDependencies); }"],
  ["UP", "function UP(key, variant) { return resolveSystemKartVariant(key, variant, localProfileDependencies); }"],
  ["Ga0", "function Ga0(value) { return validateFavoriteTracks(value); }"],
  ["Ba0", "function Ba0(value) { return validateFavoriteItems(value); }"],
  ["Ra0", "function Ra0(value) { return validateNonzeroItemId(value); }"],
  ["kt", "function kt(value, limit, label) { return validateInteger(value, limit, label); }"],
]);
const trackPickerMethodOverrides = new Map([
  ["placeInitialOffsets", "  placeInitialOffsets() { return placeInitialThemeOffset(this); }"],
  ["confirm", "  confirm() { return confirmTrackSelection(this); }"],
  ["selectTheme", "  selectTheme(theme) { return selectTrackTheme(this, theme); }"],
  ["toggleGameType", "  toggleGameType(gameType) { return toggleTrackGameType(this, gameType); }"],
  ["searchTracks", "  searchTracks(query) { return searchTracks(this, query); }"],
  ["commitSearch", "  commitSearch() { return commitTrackSearch(this); }"],
  ["changeFavorite", "  changeFavorite(trackId, favorite) { return changeFavoriteTrack(this, trackId, favorite); }"],
  ["filteredTracks", "  filteredTracks() { return filteredTracks(this); }"],
  ["randomGroupsForDisplay", "  randomGroupsForDisplay() { return randomGroupsForDisplay(this); }"],
  ["gameTypeEnabled", "  gameTypeEnabled(candidate) { return gameTypeEnabled(this, candidate); }"],
  ["remapRandomSelection", "  remapRandomSelection(gameType) { const group = matchingRandomGroup(this.options.randomGroups, this.selectedRandomGroupId, gameType); if (group) this.selectedRandomGroupId = group.id; }"],
]);
const readyViewMethodOverrides = new Map([
  ["nodeId", "  nodeId(node) { return readyButtonNodeId(this, node); }"],
  ["hitButton", "  hitButton(event) { return readyButtonAtPoint(this, event); }"],
  ["drawImageButton", "  drawImageButton(node, rect) { return drawReadyImageButton(this, node, rect, readyButtonDrawingDependencies); }"],
  ["drawButtonText", "  drawButtonText(node, rect, state) { return drawReadyButtonText(this, node, rect, state, readyButtonDrawingDependencies); }"],
  ["activateTrainingShortcut", "  activateTrainingShortcut() { return activateReadyTrainingShortcut(this); }"],
  ["activateButton", "  activateButton(name) { return activateReadyButton(this, name); }"],
  ["refreshRecord", "  refreshRecord() { return refreshReadyViewRecord(this, readyViewDependencies); }"],
  ["setSpeedChannel", "  setSpeedChannel(change) { return setReadyViewSpeedChannel(this, change, readyViewDependencies); }"],
  ["selectReadyOption", "  selectReadyOption(name) { return selectReadyViewOption(this, name); }"],
  ["applyReadyOptions", "  applyReadyOptions(options) { return applyReadyViewOptions(this, options, readyViewDependencies); }"],
]);
const readyViewPointerOverrides = new Map([
  ["onPointerMove", "  onPointerMove = event => moveReadyPointer(this, event);"],
  ["onPointerDown", "  onPointerDown = event => pressReadyPointer(this, event);"],
  ["onPointerUp", "  onPointerUp = event => releaseReadyPointer(this, event);"],
  ["onPointerCancel", "  onPointerCancel = event => cancelReadyPointer(this, event);"],
  ["onPointerLeave", "  onPointerLeave = () => leaveReadyPointer(this);"],
]);
const readyVehiclePreviewMethodOverrides = new Map([
  ["load", "  static async load(library, environment, character, kart, stageBinding, options) { return loadReadyVehiclePreview(library, environment, character, kart, stageBinding, options, { createImporter: () => new Tr(), loadPreview: T7, createHost: (preview, binding) => new ny(preview, binding), releasePreview: Lt }); }"],
  ["render", "  render(output, frame, time) { return renderReadyVehiclePreview(this, output, frame, time, { width: Ni, height: Es, updateScene: T4, composite: NP, renderScene: f4 }); }"],
  ["dispose", "  dispose() { return disposeReadyVehiclePreview(this, Lt); }"],
]);
const settingsMethodOverrides = new Map([
  ["setRoomSpeed", "  setRoomSpeed(speed, version) { return setSettingsRoomSpeed(this, speed, version); }"],
  ["toggleCombo", "  toggleCombo(name) { return toggleSettingsCombo(this, name); }"],
  ["selectVersion", "  selectVersion(version) { return selectSettingsVersion(this, version, settingsInteractionDependencies); }"],
  ["selectSpeed", "  selectSpeed(choice) { return selectSettingsSpeed(this, choice); }"],
  ["closeCombo", "  closeCombo() { return closeSettingsCombo(this); }"],
  ["moveSelection", "  moveSelection(direction) { return moveSettingsSelection(this, direction, settingsInteractionDependencies); }"],
  ["toggle", "  toggle(name) { return toggleSettingsOption(this, name); }"],
  ["changeVolume", "  changeVolume(field, value) { return changeSettingsVolume(this, field, value); }"],
  ["stepVolume", "  stepVolume(field, delta) { return stepSettingsVolume(this, field, delta); }"],
  ["repeatTrackVolume", "  repeatTrackVolume(field, direction, pointerX) { return repeatSettingsVolumeStep(this, field, direction, pointerX, settingsInteractionDependencies); }"],
  ["stopVolumePointer", "  stopVolumePointer() { return stopSettingsVolumePointer(this); }"],
  ["activate", "  activate(name) { return activateSettingsControl(this, name, settingsInteractionDependencies); }"],
  ["applyPreset", "  applyPreset(name) { return applySettingsPreset(this, name); }"],
  ["applyGraphicsPreset", "  applyGraphicsPreset(highQuality) { return applySettingsGraphicsPreset(this, highQuality); }"],
  ["resetSound", "  resetSound() { return resetSettingsSound(this, settingsInteractionDependencies); }"],
]);
const garageSelectionMethodOverrides = new Map([
  ["subTabs", "  subTabs() { return garageSubTabs(this); }"],
  ["filteredItems", "  filteredItems() { return filteredGarageItems(this); }"],
  ["categoryItems", "  categoryItems() { return garageCategoryItems(this, garageSelectionDependencies); }"],
  ["allCategoryItems", "  allCategoryItems() { return allGarageItems(this, garageSelectionDependencies); }"],
  ["favoriteCategoryItems", "  favoriteCategoryItems() { return favoriteGarageItems(this); }"],
  ["decorationItems", "  decorationItems() { return garageDecorationItems(this); }"],
  ["favoriteKey", "  favoriteKey(item) { return garageFavoriteKey(item); }"],
  ["favoriteKeys", "  favoriteKeys() { return garageFavoriteKeys(this); }"],
  ["toggleFavoriteItem", "  toggleFavoriteItem(item) { return toggleGarageFavoriteItem(this, item, garageFavoriteDependencies); }"],
  ["clampFavoriteOffset", "  clampFavoriteOffset() { return clampGarageFavoriteOffset(this, garageFavoriteDependencies); }"],
  ["selectCategory", "  selectCategory(category) { return selectGarageCategory(this, category); }"],
  ["selectSubCategory", "  selectSubCategory(category) { return selectGarageSubCategory(this, category); }"],
  ["selectItem", "  selectItem(item) { return selectGarageItem(this, item, garageSelectionDependencies); }"],
  ["commitItem", "  commitItem(item) { return commitGarageItem(this, item, garageSelectionDependencies); }"],
  ["selectDecoration", "  selectDecoration(item) { return selectGarageDecoration(this, item); }"],
  ["confirm", "  confirm() { return confirmGarageSelection(this, garageSelectionDependencies); }"],
  ["activate", "  activate(action) { return activateGarageAction(this, action); }"],
  ["selectedKart", "  selectedKart() { return selectedGarageKart(this, garageSelectionDependencies); }"],
  ["selectLegacyAppearance", "  selectLegacyAppearance(level) { return selectGarageLegacyAppearance(this, level); }"],
]);
const localRaceMethodOverrides = new Map([
  ["constructor", "  constructor(assets, room, playerId) { initializeLocalRace(this, assets, room, playerId, localRaceConstructionDependencies); }"],
  ["requestReset", "  requestReset(playerRequested = true) { return requestLocalRaceReset(this, localRaceDependencies, playerRequested); }"],
  ["checkAutomaticReset", "  checkAutomaticReset(nowMs, stepSeconds) { return checkLocalRaceAutomaticReset(this, localRaceDependencies, nowMs, stepSeconds); }"],
  ["advanceReset", "  advanceReset(nowMs) { return advanceLocalRaceReset(this, localRaceDependencies, nowMs); }"],
  ["acceptEndTiming", "  acceptEndTiming(finishDeadline, raceOverAt, resultsReady) { return acceptLocalRaceEndTiming(this, localRaceDependencies, finishDeadline, raceOverAt, resultsReady); }"],
  ["handleLocalRouteTag", "  handleLocalRouteTag(tag) { return handleLocalRaceRouteTag(this, localRaceDependencies, tag); }"],
  ["applyWarpActions", "  applyWarpActions(actions) { return applyLocalRaceWarpActions(this, actions); }"],
  ["scheduleStart", "  scheduleStart(startAtMs) { return scheduleLocalRaceStart(this, startAtMs); }"],
  ["scheduledStartAtMs", "  get scheduledStartAtMs() { return localRaceScheduledStartAtMs(this); }"],
  ["isStartBoosterWindow", "  isStartBoosterWindow(nowMs) { return localRaceStartBoosterWindow(this, localRaceDependencies, nowMs); }"],
  ["raceProgress", "  raceProgress() { return localRaceProgress(this); }"],
  ["elapsedMs", "  elapsedMs(nowMs) { return localRaceElapsedMs(this, localRaceDependencies, nowMs); }"],
  ["update", "  update(nowMs, stepSeconds) { return updateLocalRace(this, localRaceDependencies, nowMs, stepSeconds); }"],
]);
// item-mode(hud): the race HUD item slots. XJ (boost-only slot commands)
// and s00 (slot definition) are src/ui/item-slot-hud.ts, which keeps the
// speed race commands and adds any item icon, 3 slots, the lock overlay and
// countdown; the release helpers only they used (Ax, Mx, bx, …) retire.
const itemHudSlotOverrides = new Map([
  ["XJ", "function XJ(definition, slots, disabled, windowStartMs, timeMs, reorderProgress, overlay) { return buildItemSlotCommands(definition, slots, disabled, windowStartMs, timeMs, reorderProgress, overlay); }"],
  ["s00", "async function s00(library, frame) { return loadItemSlotDefinition(library, frame, itemSlotDependencies); }"],
]);
const retiredItemHudSlotHelpers = new Set([
  "Ax", "Mx", "bx", "rI", "sI", "u00", "h00", "d00", "f00", "p00",
]);
const replacedItemHudSlots = new Set();
const retiredItemHudSlots = new Set();
const lifecycleOverrides = new Set(["GF", "OT", "Z1"]);
const raceSessionMethodOverrides = new Map([
  ["raceConnection", "  raceConnection(roomId, raceId, signal) { return createRaceConnection(this, roomId, raceId, signal); }"],
  ["bindMotionScope", "  bindMotionScope(room) { return bindRaceScope(this, room); }"],
]);
const clientMethodOverrides = new Map([
  ["acceptMotion", "  acceptMotion(data) { return acceptServerMotion(this, data); }"],
  ["acceptMotionMessage", "  acceptMotionMessage(message, fromServer = false) { return acceptGameMotion(this, message, fromServer); }"],
  ["sendMotion", "  sendMotion(sample, mask) { return sendGameMotion(this, sample, mask); }"],
  ["networkDiagnostics", "  networkDiagnostics() { return getNetworkDiagnostics(this); }"],
  ["subscribeMotion", "  subscribeMotion(listener) { return subscribeGameMotion(this, listener); }"],
  ["captureClock", "  captureClock() { return captureNetworkClock(this); }"],
  ["sameOriginUrl", "  static sameOriginUrl(pageUrl) { return sameOriginOfferUrl(pageUrl); }"],
  ["connect", "  async connect(offerUrl, name, resourceVersion, equipment, initial, raceRuntime = false, ticket) { return connectGameClient(this, offerUrl, name, resourceVersion, equipment, initial, raceRuntime, ticket, { validateControlMessage: zo0, transport: configuredTransport() }); }"],
  ["request", "  request(message) { return sendControlRequest(this, message); }"],
  ["subscribe", "  subscribe(listener) { return subscribeControl(this, listener); }"],
  ["onClose", "  onClose(listener) { return onClientClose(this, listener); }"],
  ["dispose", "  dispose() { return disposeClient(this); }"],
]);
const multiplayerMethodOverrides = new Map([
  ...raceSessionMethodOverrides,
  ...clientMethodOverrides,
]);
const lobbyActionMethodOverrides = new Map([
  ["constructor", `  constructor(options) {
    this.options = options;
    initializeLobbyRace(this, {
      createCoordinator: value => new ll0(value),
      preloadRpPet: Nl0,
      loadRoadblock: (library, root, race, playerId) => yy.load(library, root, race, playerId),
      loadRpNotice: (library, root, race, playerId, audio) => vy.load(library, root, race, playerId, audio),
    });
  }`],
  ["quickJoinShortcut", "  quickJoinShortcut() { return quickJoinShortcut(this); }"],
  ["handleRoomShortcut", "  handleRoomShortcut(event) { return handleRoomShortcut(this, event); }"],
  ["networkDiagnostics", "  networkDiagnostics() { return lobbyNetworkDiagnostics(this); }"],
  ["refreshAutoReady", "  refreshAutoReady() { return refreshLobbyAutoReady(this); }"],
  ["open", `  async open() { return openMultiplayerLobby(this, {
    protocolVersion: Uo,
    pageUrl: () => window.location.href,
    endpoint: Ko,
    fetchHealth: (url, signal) => fetch(url, { cache: "no-store", signal }),
    showAccountProgress: vl0,
    loadAccount: yl0,
    chooseNickname: PT,
    loadLobby: options => Ew.load(options),
    notice: (options, title, message) => b1.notice(options, title, message),
    sessionToken: url => multiplayerSessionToken(ay(url), xF),
    rememberNickname: EF,
    createClient: () => new LT(),
  }); }`],
  ["bindClient", "  bindClient() { return bindLobbyClient(this); }"],
  ["dispose", "  dispose() { return disposeLobby(this); }"],
  ["render", "  render() { return renderLobby(this); }"],
  ["syncLoadingView", "  syncLoadingView() { return syncRaceLoadingView(this, (library, root) => gy.load(library, root)); }"],
  ["maybeAutoReady", "  maybeAutoReady() { return maybeAutoReadyInRoom(this); }"],
  ["receive", "  receive(event) { return receiveLobbyEvent(this, event, RI); }"],
  ["showRoom", "  async showRoom() { return showLobbyRoom(this, (library, root, room, playerId, callbacks, audioContext) => py.load(library, root, room, playerId, callbacks, audioContext)); }"],
  ["list", "  async list(channel, page, quiet = false, gameplay = this.gameplay) { return listLobbyRooms(this, channel, page, quiet, gameplay); }"],
  ["leaveRoom", "  async leaveRoom(reason) { return leaveLobbyRoom(this, reason); }"],
  ["mutate", "  async mutate(command) { return mutateLobbyRoom(this, command, (options, title, message) => b1.notice(options, title, message)); }"],
  ["cancelDialog", "  cancelDialog(releaseAllowed = true) { return cancelLobbyDialog(this, releaseAllowed); }"],
  ["confirmLeaveRoom", "  async confirmLeaveRoom(roomId) { return confirmLeaveLobbyRoom(this, roomId, (options, title, message, onConfirm, labels) => b1.confirm(options, title, message, onConfirm, labels)); }"],
  ["openDialog", "  async openDialog(factory, allowDisconnected = false) { return openLobbyDialog(this, factory, allowDisconnected); }"],
  ["dialogOptions", "  dialogOptions() { return lobbyDialogOptions(this); }"],
  ["syncKickVoteDialog", "  syncKickVoteDialog() { return syncKickVoteDialog(this, (options, title, message, onConfirm, labels) => b1.confirm(options, title, message, onConfirm, labels)); }"],
  ["castKickVote", "  castKickVote(approve) { return castLobbyKickVote(this, approve); }"],
  ["isChangingModalCurrent", "  isChangingModalCurrent(modal) { return isChangingModalCurrent(this, modal); }"],
  ["endChangingModal", "  endChangingModal(modal, releaseAllowed = true) { return endChangingModal(this, modal, releaseAllowed); }"],
  ["cancelCountdownModals", "  cancelCountdownModals() { return cancelCountdownModals(this); }"],
  ["finishChangingLoad", "  finishChangingLoad(modal, loaded) { return finishChangingLoad(this, modal, loaded); }"],
  ["releaseChanging", "  async releaseChanging(roomId) { return releaseChanging(this, roomId); }"],
  ["chooseGarage", `  async chooseGarage() { return chooseLobbyGarage(this,
    async options => {
      const { TimeAttackGarageView } = await El(async () => {
        const { TimeAttackGarageView } = await Promise.resolve().then(() => w80);
        return { TimeAttackGarageView };
      }, undefined);
      return TimeAttackGarageView.load(options);
    }, (profile, choice) => accountOwnedEquipment(zw({ ...profile, equipment: choice.equipment }))); }`],
  ["confirmGarage", "  async confirmGarage(choice, roomId, modal) { return confirmLobbyGarage(this, choice, roomId, modal); }"],
  ["chooseTrack", "  async chooseTrack() { return chooseLobbyTrack(this, { gameplay: G2, isGiantTrack: Zl, randomRules: Yc, loadView: options => _7.load(options) }); }"],
  ["confirmTrack", "  async confirmTrack(modal, choice) { return confirmLobbyTrack(this, modal, choice, Yc); }"],
  ["changeRoomInfo", "  async changeRoomInfo() { return changeLobbyRoomInfo(this, (options, mode, settings, submit) => b1.roomSettings(options, mode, settings, submit)); }"],
  ["sendChat", "  async sendChat(message) { return sendLobbyChat(this, message); }"],
  ["submitRoomSettings", "  async submitRoomSettings(settings, generation) { return submitLobbyRoomSettings(this, settings, generation); }"],
  ["create", `  async create() { return createLobbyRoom(this, He,
    (options, gameplay, channel, nickname, submit) => gameplay === "ordinary"
      ? b1.createOrdinary(options, channel, nickname, submit)
      : b1.createGameplay(options, gameplay, channel, nickname, submit)); }`],
  ["join", "  async join(room) { return joinLobbyRoom(this, room, (host, submit) => host.openDialog(() => b1.password(host.dialogOptions(), submit))); }"],
  ["quickJoin", "  async quickJoin() { return quickJoinLobbyRoom(this); }"],
  ["team", "  async team() { return switchLobbyTeam(this); }"],
  ["confirm", "  async confirm(title, message, action) { return confirmLobbyAction(this, title, message, action, (options, heading, body, accept) => b1.confirm(options, heading, body, accept)); }"],
]);
const readyMethodOverrides = new Map([
  ["dispose", "  dispose() { return disposeReadyController(this); }"],
  ["updateWindowNotice", "  updateWindowNotice(value) { return updateReadyWindowNotice(this, value); }"],
  ["getWindowNotice", "  getWindowNotice() { return getReadyWindowNotice(this); }"],
  ["setWindowNotice", "  setWindowNotice(value) { return setReadyWindowNotice(this, value); }"],
  ["renderReady", "  renderReady(state) { return renderReadyController(this, state); }"],
  ["refreshRecord", "  refreshRecord() { return refreshReadyRecord(this); }"],
  ["releaseForRace", "  releaseForRace() { return releaseReadyForRace(this); }"],
  ["readyModalBusy", "  readyModalBusy() { return isReadyModalBusy(this); }"],
  ["openMultiplayer", `  async openMultiplayer() { return openReadyMultiplayer(this, {
    sanitizeReadyOptions: Hl0,
    nickname: im,
    version: Bt,
    initialEquipment: zw,
    favoriteTrackIds: nT,
    createNotice: root => new ds(root),
    createLobby: options => new Wl0(options),
    repairEquipment: () => repairEquipmentForMultiplayer(),
  }); }`],
  ["multiplayerGarageOptions", "  async multiplayerGarageOptions() { return readyMultiplayerGarageOptions(this, root => new ds(root)); }"],
  ["applyMultiplayerGarage", "  applyMultiplayerGarage(choice) { return applyReadyMultiplayerGarage(this, choice); }"],
  ["returnMultiplayerToSinglePlayer", "  async returnMultiplayerToSinglePlayer() { return returnMultiplayerToSinglePlayer(this); }"],
  ["networkDiagnostics", "  networkDiagnostics() { return readyNetworkDiagnostics(this); }"],
  ["closeMultiplayer", "  closeMultiplayer(openReady = true, restoreReady = true) { return closeReadyMultiplayer(this, openReady, restoreReady); }"],
  ["readyStageContext", "  readyStageContext() { return readyStageContext(this); }"],
  ["acquireReadyToonEnvironment", "  async acquireReadyToonEnvironment(library) { return acquireReadyToonEnvironment(this, library, value => rn.load(value)); }"],
  ["enterTimeAttackReady", "  async enterTimeAttackReady(profile = this.host.getProfile()) { return enterTimeAttackReady(this, profile, { findKart: b4, loadTaskbar: options => ry.load(options), loadReadyView: options => ty.load(options) }); }"],
  ["startRaceFromReady", "  async startRaceFromReady(selection, options) { return startRaceFromReady(this, selection, options); }"],
  ["openTrackSelect", "  async openTrackSelect(selection, options) { return openTrackSelect(this, selection, options, { loadTrackSelect: value => _7.load(value), favoriteTrackIds: nT, createWindowNotice: root => new ds(root) }); }"],
  ["selectReadyTrack", "  selectReadyTrack(selection, options, track) { return selectReadyTrack(this, selection, options, track); }"],
  ["selectReadyChoice", "  selectReadyChoice(selection, options, choice, catalog) { return selectReadyChoice(this, selection, options, choice, catalog, LR); }"],
  ["resolveRandomSelection", "  async resolveRandomSelection(selection) { return resolveRandomSelection(this, selection); }"],
  ["changeFavoriteTrack", "  changeFavoriteTrack(track, favorite) { return changeReadyFavoriteTrack(this, track, favorite, IP); }"],
  ["changeFavoriteItems", "  changeFavoriteItems(items) { return changeReadyFavoriteItems(this, items); }"],
  ["openGarage", "  async openGarage(selection, options) { return openReadyGarage(this, selection, options, readyGarageDependencies); }"],
  ["selectReadyGarage", "  async selectReadyGarage(selection, options, choice) { return selectReadyGarage(this, selection, options, choice); }"],
  ["openGarageX", "  async openGarageX(selection, options) { return openReadyGarageX(this, selection, options, readyGarageDependencies); }"],
  ["returnGarageToReady", "  returnGarageToReady() { return returnReadyGarage(this); }"],
  ["applyImmediateGarageSelection", "  applyImmediateGarageSelection(selection, options, choice) { return applyImmediateReadyGarageSelection(this, selection, options, choice); }"],
  ["showGarageError", "  showGarageError(error) { return showReadyGarageError(this, error); }"],
  ["openSettings", "  async openSettings() { return openReadySettings(this, readySettingsDependencies); }"],
  ["previewSettings", "  previewSettings(options) { return previewReadySettings(this, options); }"],
  ["confirmSettings", "  confirmSettings(options, speed, version) { return confirmReadySettings(this, options, speed, version, readySettingsDependencies); }"],
  ["publishRaceSpeedChannel", "  publishRaceSpeedChannel() { return publishReadyRaceSpeed(this, readySettingsDependencies); }"],
  ["saveGameOptions", "  saveGameOptions() { return saveReadyGameOptions(this, ua0); }"],
  ["closeSettings", "  closeSettings() { return closeReadySettings(this); }"],
  ["showTrackSelectError", "  showTrackSelectError(error) { return showReadyTrackSelectError(this, error); }"],
  ["handleReadyShortcut", "  handleReadyShortcut(event) { return handleReadyShortcut(this, event); }"],
  ["releaseReadyToonEnvironment", "  releaseReadyToonEnvironment() { return releaseReadyToonEnvironment(this); }"],
]);
const applicationMethodOverrides = new Map([
  ["constructor", "  constructor(root) { initializeApplication(this, root, applicationConstructionDependencies); }"],
  ["get:previousRenderTime", "  get previousRenderTime() { return readPresenterClock(this, \"previousRenderTime\"); }"],
  ["set:previousRenderTime", "  set previousRenderTime(value) { writePresenterClock(this, \"previousRenderTime\", value); }"],
  ["get:lastUpdateMs", "  get lastUpdateMs() { return readPresenterClock(this, \"lastUpdateMs\"); }"],
  ["set:lastUpdateMs", "  set lastUpdateMs(value) { writePresenterClock(this, \"lastUpdateMs\", value); }"],
  ["get:presentationClockMs", "  get presentationClockMs() { return readPresenterClock(this, \"presentationClockMs\"); }"],
  ["set:presentationClockMs", "  set presentationClockMs(value) { writePresenterClock(this, \"presentationClockMs\", value); }"],
  ["get:fps", "  get fps() { return readPresenterClock(this, \"fps\"); }"],
  ["set:fps", "  set fps(value) { writePresenterClock(this, \"fps\", value); }"],
  ["get:maxRafDelayMs", "  get maxRafDelayMs() { return readPresenterClock(this, \"maxRafDelayMs\"); }"],
  ["set:maxRafDelayMs", "  set maxRafDelayMs(value) { writePresenterClock(this, \"maxRafDelayMs\", value); }"],
  ["get:activeWindowNotice", "  get activeWindowNotice() { return getActiveWindowNotice(this); }"],
  ["set:activeWindowNotice", "  set activeWindowNotice(value) { setActiveWindowNotice(this, value); }"],
  ["mountDevTools", "  mountDevTools() { return mountDevTools(); }"],
  ["setDevToolsTrackObjectKind", "  setDevToolsTrackObjectKind(kind, visible) { return setDevToolsTrackObjectKind(kind, visible); }"],
  ["mountDevToolsTrackOverlay", "  mountDevToolsTrackOverlay() { return mountDevToolsTrackOverlay(); }"],
  ["mountDevToolsTrackObjectsOverlay", "  mountDevToolsTrackObjectsOverlay() { return mountDevToolsTrackObjectsOverlay(); }"],
  ["session", "  get session() { return getOrCreateRaceSession(this, () => new Bd0()); }"],
  ["audio", "  get audio() { return getOrCreateAudioDirector(this, () => new bf0()); }"],
  ["replayLibrary", "  get replayLibrary() { return getOrCreateReplayLibrary(this, () => new Pt()); }"],
  ["rhoLibrary", "  get rhoLibrary() { return currentRhoLibrary(this); }"],
  ["physics", "  get physics() { return requireRacePhysics(this); }"],
  ["track", "  get track() { return requireRaceTrack(this); }"],
  ["raceBuilder", "  get raceBuilder() { return getOrCreateRaceBuilder(this, host => new if0(host)); }"],
  ["createRaceBuilderHost", "  createRaceBuilderHost() { return createRaceBuilderHost(this, _f0, (selection, options) => Pt.recordKey(selection, options)); }"],
  ["drivingPipeline", "  get drivingPipeline() { return getOrCreateDrivingPipeline(this, host => new n60(host)); }"],
  ["createDrivingPipelineHost", "  createDrivingPipelineHost() { return createDrivingPipelineHost(this, () => navigator.getGamepads?.()); }"],
  ["ready", "  get ready() { return getOrCreateReadyCoordinator(this, host => new ql0(host)); }"],
  ["createReadyHost", "  createReadyHost() { return createReadyHost(this, { makeMultiplayerRaceLoader: Hs0, applyAudioOptions: Qc, recordKey: Pt.recordKey, saveProfile: cT }); }"],
  ["presenter", "  get presenter() { return getOrCreatePresenter(this, (host, previousTime) => new vf0(host, previousTime)); }"],
  ["createPresenterHost", "  createPresenterHost() { return createPresenterHost(this); }"],
  ["records", "  get records() { return getOrCreateRecordService(this, configuration => new Nh0(configuration)); }"],
  ["updateKartBoosterState", "  updateKartBoosterState(nowMs, visualState, previousSlot) { return updateKartBoosterState(this, nowMs, visualState, previousSlot); }"],
  ["devToolsTrackOwner", "  devToolsTrackOwner() { return devToolsTrackOwner(this, Gf0); }"],
  ["devToolsTrackObjects", "  devToolsTrackObjects() { return devToolsTrackObjects(this); }"],
  ["devToolsTrackObjectsSource", "  devToolsTrackObjectsSource() { return devToolsTrackObjectsSource(this); }"],
  ["frame", "  frame(nowMs) { return shellRouting.frame(this, nowMs); }"],
  ["updateAndRender", "  updateAndRender(nowMs) { return shellRouting.updateAndRender(this, nowMs); }"],
  ["renderGameplayUi", "  renderGameplayUi(nowMs, frame) { return shellRouting.renderGameplayUi(this, nowMs, frame); }"],
  ["updateDriving", "  updateDriving(nowMs) { return shellRouting.updateDriving(this, nowMs); }"],
  ["updateTimeAttackRoute", "  updateTimeAttackRoute(nowMs, physics, track) { return shellRouting.updateTimeAttackRoute(this, nowMs, physics, track); }"],
  ["handleTimeAttackActions", "  handleTimeAttackActions(actions, nowMs) { return shellRouting.handleTimeAttackActions(this, actions, nowMs); }"],
  ["handleTimeAttackActionAudio", "  handleTimeAttackActionAudio(action, nowMs) { return shellRouting.handleTimeAttackActionAudio(this, action, nowMs); }"],
  ["releaseRaceForReady", "  releaseRaceForReady() { return shellRouting.releaseRaceForReady(this); }"],
  ["applyWarpNextActions", "  applyWarpNextActions(actions) { return shellRouting.applyWarpNextActions(this, actions); }"],
  ["initiateSpeedReset", "  initiateSpeedReset(allowCurrentSpeed) { return shellRouting.initiateSpeedReset(this, allowCurrentSpeed); }"],
  ["advanceResetCompletion", "  advanceResetCompletion(nowMs) { return shellRouting.advanceResetCompletion(this, nowMs); }"],
  ["replaceTrack", "  replaceTrack(track) { return shellRouting.replaceTrack(this, track); }"],
  ["applyRaceOptions", "  applyRaceOptions(options) { return shellRouting.applyRaceOptions(this, options); }"],
  ["promoteTimeAttackRecord", "  promoteTimeAttackRecord(record, time) { return shellRouting.promoteTimeAttackRecord(this, record, time); }"],
  ["restoreTimeAttackRecords", "  restoreTimeAttackRecords() { return shellRouting.restoreTimeAttackRecords(this); }"],
  ["enterTimeAttackReady", "  enterTimeAttackReady(options) { return shellRouting.enterTimeAttackReady(this, options); }"],
  ["openTrackSelect", "  openTrackSelect(selection, options) { return shellRouting.openTrackSelect(this, selection, options); }"],
  ["selectReadyTrack", "  selectReadyTrack(selection, options, track) { return shellRouting.selectReadyTrack(this, selection, options, track); }"],
  ["openGarage", "  openGarage(selection, options) { return shellRouting.openGarage(this, selection, options); }"],
  ["selectReadyGarage", "  selectReadyGarage(selection, options, choice) { return shellRouting.selectReadyGarage(this, selection, options, choice); }"],
  ["readyModalBusy", "  readyModalBusy() { return shellRouting.readyModalBusy(this); }"],
  ["previewSettings", "  previewSettings(options) { return shellRouting.previewSettings(this, options); }"],
  ["confirmSettings", "  confirmSettings(options, speed, version) { return shellRouting.confirmSettings(this, options, speed, version); }"],
  ["saveGameOptions", "  saveGameOptions() { return shellRouting.saveGameOptions(this); }"],
  ["closeSettings", "  closeSettings() { return shellRouting.closeSettings(this); }"],
  ["releaseReadyToonEnvironment", "  releaseReadyToonEnvironment() { return shellRouting.releaseReadyToonEnvironment(this); }"],
  ["handleReadyShortcut", "  handleReadyShortcut(event) { return shellRouting.handleReadyShortcut(this, event); }"],
  ["drainDrivingInput", "  drainDrivingInput(nowMs, state) { return shellRouting.drainDrivingInput(this, nowMs, state); }"],
  ["setAutoForwardEnabled", "  setAutoForwardEnabled(enabled) { return shellRouting.setAutoForwardEnabled(this, enabled); }"],
  ["setNitroSeamlessMode", "  setNitroSeamlessMode(enabled) { return shellRouting.setNitroSeamlessMode(this, enabled); }"],
  ["getDrivingSnapshot", "  getDrivingSnapshot() { return shellRouting.getDrivingSnapshot(this); }"],
  ["updateHud", "  updateHud() { return shellRouting.updateHud(this); }"],
  ["updateActiveRaceCamera", "  updateActiveRaceCamera(nowMs) { return shellRouting.updateActiveRaceCamera(this, nowMs); }"],
  ["applySavedAudioOptions", "  applySavedAudioOptions() { return shellRouting.applySavedAudioOptions(this, Qc); }"],
  ["canReloadForUpdate", "  canReloadForUpdate() { return canReloadForUpdate(this); }"],
  ["dispose", "  dispose() { return disposeApplicationRuntime(this, { setToonLinesEnabled: Pp, removeWindowListener: (name, listener) => window.removeEventListener(name, listener) }); }"],
  ["haltRuntime", "  haltRuntime(error, nowMs) { return haltApplicationRuntime(this, error, nowMs); }"],
  ["togglePause", "  togglePause() { return toggleRacePause(this, () => performance.now(), Ne.Paused); }"],
  ["restartRaceFromPause", "  async restartRaceFromPause() { return restartRaceFromPause(this, root => eT(root), () => performance.now()); }"],
  ["handleGlobalShortcut", "  handleGlobalShortcut(event) { return handleApplicationShortcut(this, event, BP); }"],
  ["configureBackbuffer", "  configureBackbuffer() { return configureApplicationBackbuffer(this, { width: H2, height: $2 }, EX, window.devicePixelRatio); }"],
  ["mountGhostMenu", "  mountGhostMenu() { return mountGhostRecordMenu(this); }"],
  ["ghostRecordMenu", "  ghostRecordMenu() { return createGhostRecordMenu(this, configuration => new vd0(configuration), bl0); }"],
  ["selectGhostTrack", "  async selectGhostTrack(selection, speed, booster, version) { return selectGhostTrack(this, selection, speed, booster, version); }"],
  ["currentGhostRecordKey", "  currentGhostRecordKey() { return currentGhostRecordKey(this, Pt.recordKey); }"],
  // Account economy (server-go/ECONOMY.md 7): login gate before the profile,
  // inventory fallback before the startup selection, and account onboarding
  // instead of the local-nickname first-rider trigger.
  ["loadVersionedResources", "  async loadVersionedResources() { return loadStartupResources(this, { localResourcesSupported: io0, recoverLocalSource: ro0, defaultSourceName: so0, versionId: Bt, loadVersionedSources: uo0, loadLibrary: (sources, indexes) => Sw.load(sources, void 0, indexes), loadProfile: Ta0, defaultProfile: gr, resolveSelection: Rf0, isSpecialKartId: n3, displayKartName: Mw, localNickname: im, ensureAccount: () => ensureStartupAccount(this), sanitizeProfile: (profile, catalog) => sanitizeStartupProfile(profile, catalog, cT), needsRiderRegistration: () => accountNeedsRiderRegistration(), retryProfile: error => retryStartupProfile(this, error) }); }"],
  ["applyNewRiderRegistration", "  async applyNewRiderRegistration() { const dependencies = { loadEnvironment: library => rn.load(library), loadDialog: (library, root, options, context) => Fy.load(library, root, options, context), saveProfile: cT, saveNickname: EF }; return activeBrowserSession() ? registerAccountRider(this, dependencies) : registerNewRider(this, dependencies); }"],
  ["prepareStartupReady", "  async prepareStartupReady(library, selection, vehicleTitle) { return prepareStartupReady(this, library, selection, vehicleTitle, { createAudioContext: () => new AudioContext(), applyAudioOptions: Qc, loadBgm: (source, metadata, random, context) => P7.load(source, metadata, random, context), loadInterfaceAudio: (source, context) => Ny.load(source, context) }); }"],
  ["startRace", "  startRace(selection) { return startSinglePlayerRace(this, selection, Af0); }"],
  ["returnToReady", "  async returnToReady() { return returnToReady(this, eT); }"],
]);
const applicationFieldOverrides = new Map([
  ["onGlobalKeyDown", "  onGlobalKeyDown = event => onApplicationKeyDown(this, event);"],
  ["onViewportResize", "  onViewportResize = () => onApplicationViewportResize(this);"],
]);
const ghostRecordLibraryMethodOverrides = new Map([
  ["record", "  record(key) { return ghostRecord(this, key); }"],
  ["recordKey", "  static recordKey(selection, options) { return ghostRecordKey(selection, options, LD, Ue); }"],
  ["trackIdFromKey", "  static trackIdFromKey(key) { return ghostTrackIdFromKey(key); }"],
  ["restore", "  async restore(reportError) { return restoreGhostRecordLibrary(this, reportError, ghostRecordLibraryDependencies); }"],
  ["promote", "  async promote(key, sources, trackId, summary) { return promoteGhostRecord(this, key, sources, trackId, summary); }"],
  ["save", "  async save(key, sources, summary) { return saveGhostRecord(this, key, sources, summary, ghostRecordLibraryDependencies); }"],
  ["saveRaw", "  async saveRaw(key, raw) { return saveRawGhostRecord(this, key, raw, ghostRecordLibraryDependencies); }"],
  ["saveImported", "  async saveImported(key, sources, summary, bytes) { return saveImportedGhostRecord(this, key, sources, summary, bytes, ghostRecordLibraryDependencies); }"],
  ["exportSource", "  async exportSource(key) { return exportGhostSource(this, key); }"],
  ["exportKsv", "  async exportKsv(key) { return exportGhostKsv(this, key, ghostExportDependencies); }"],
  ["delete", "  async delete(key) { return deleteGhostRecord(this, key); }"],
  ["put", "  async put(key, sources, trackId, bytes) { return putGhostRecord(this, key, sources, trackId, bytes, ghostRecordLibraryDependencies); }"],
  ["persist", "  persist() { return persistGhostSummaries(this, ghostRecordLibraryDependencies); }"],
]);
const ghostAssetBuilderMethodOverrides = new Map([
  ["build", "  async build(selection, options, coatingStage) { return buildSoloRaceAssets(this, selection, options, coatingStage, soloRaceBuildDependencies); }"],
  ["loadGhostKartAssets", "  async loadGhostKartAssets(ghost, scene, importer, speed, version, signal) { return loadGhostKartAssets(this, ghost, scene, importer, speed, version, signal, ghostAssetDependencies); }"],
  ["loadGhostDecorations", "  async loadGhostDecorations(ghost, library, scene, importer) { return loadGhostDecorations(ghost, library, scene, importer, ghostAssetDependencies); }"],
  ["rankColors", "  async rankColors(ghosts) { return rankGhostColors(this, ghosts, ghostAssetDependencies); }"],
]);
const routeSurfaceListenerMethodOverrides = new Map([
  ["handleRouteSurfaceTag", "  handleRouteSurfaceTag(tag, frame) { return handleRouteSurfaceTag(this, tag, frame, routeSurfaceListenerDependencies); }"],
  ["warpNextEventFrame", "  warpNextEventFrame(tag, frame) { return warpNextEventFrame(this, tag, frame); }"],
  ["applyWarpNextActions", "  applyWarpNextActions(actions) { return applyWarpNextActions(this, actions); }"],
  ["applyWarpNextAction", "  applyWarpNextAction(action) { return applyWarpNextAction(this, action); }"],
  ["freezeWarpCamera", "  freezeWarpCamera() { return freezeWarpCamera(this); }"],
]);
const raceBgmResourceOverrides = new Map([
  ["Zd0", "function Zd0(track) { return selectRaceBgmTheme(track); }"],
  ["Jd0", "function Jd0(library, theme) { return raceBgmArchiveTracks(library, theme); }"],
  ["eG", "async function eG(library, track, context) { return loadRaceBgmPlaylist(library, track, context, Q9); }"],
  ["Kt", "async function Kt(resource, context) { return decodeBgmResource(resource, context, Q9); }"],
  ["G5", "function G5(library, path) { return requiredBgmResource(library, path); }"],
  ["ef0", "function ef0(library, fallback) { return garageBgmResource(library, fallback); }"],
  ["tG", "function tG(path) { return canonicalBgmPath(path); }"],
]);
const ghostEquipmentOverrides = new Map([
  ["zh0", "function zh0(equipment, playerName = '') { return ghostEquipmentFromKsv(equipment, playerName); }"],
  ["U_", "function U_(equipment) { return ghostEquipmentProfile(equipment, gr); }"],
  ["P3", "function P3(itemId) { return ghostItemId(itemId); }"],
]);
const ghostMenuImportMethodOverrides = new Map([
  ["deleteGhost", "  async deleteGhost() { return deleteGhostFromMenu(this); }"],
  ["exportGhost", "  async exportGhost() { return exportGhostFromMenu(this); }"],
  ["importSelectedFile", "  async importSelectedFile() { return importSelectedGhostFile(this, ghostMenuImportDependencies); }"],
  ["isCurrentImport", "  isCurrentImport(revision) { return isCurrentGhostImport(this, revision); }"],
  ["switchToImportedTrack", "  async switchToImportedTrack(selection, zCeiling, frameCount, revision) { return switchToImportedGhostTrack(this, selection, zCeiling, frameCount, revision, ghostMenuImportDependencies); }"],
]);
const ghostMenuBridgeMethodOverrides = new Map([
  ["mount", "  mount(root) { return mountGhostMenuBridge(this, root, options => Ly.attach(options)); }"],
  ["importRecord", "  async importRecord(key, sources, summary, bytes) { return importGhostMenuRecord(this, key, sources, summary, bytes); }"],
  ["resolveTrack", "  async resolveTrack(trackId) { return resolveGhostMenuTrack(this, trackId); }"],
  ["resolveKartTitle", "  async resolveKartTitle(itemId) { return resolveGhostMenuKartTitle(this, itemId); }"],
  ["deleteRecord", "  async deleteRecord(key) { return deleteGhostMenuRecord(this, key); }"],
  ["exportRecord", "  async exportRecord(key) { return exportGhostMenuRecord(this, key, wd0); }"],
]);
const ghostVisualMotionMethodOverrides = new Map([
  ["seedStart", "  seedStart(position, right, forward, up) { return seedGhostVisualStart(this, position, right, forward, up); }"],
  ["setAssets", "  setAssets(imported, character, scale, linkedMode, visual, motorcycle, format, level) { return setGhostVisualAssets(this, imported, character, scale, linkedMode, visual, motorcycle, format, level, ghostVisualAssetDependencies); }"],
  ["setEffects", "  setEffects(effects) { return setGhostVisualEffects(this, effects); }"],
  ["setTrails", "  setTrails(trails, vehicle) { return setGhostVisualTrails(this, trails, vehicle); }"],
  ["attachToScene", "  attachToScene(scene) { return attachGhostVisualToScene(this, scene); }"],
  ["setDecorations", "  setDecorations(balloon, accessories) { return setGhostVisualDecorations(this, balloon, accessories, ghostVisualAssetDependencies); }"],
  ["update", "  update(input, timeMs, renderTime, frameSeconds, clock, mark) { return updateGhostVisualFrame(this, input, timeMs, renderTime, frameSeconds, clock, mark, ghostVisualUpdateDependencies); }"],
  ["deriveMotion", "  deriveMotion(pose, forward, timeMs, telemetry) { return deriveGhostVisualMotion(this, pose, forward, timeMs, telemetry); }"],
  ["updateAnimation", "  updateAnimation(timeMs, booster, secondary, speed) { return updateGhostVisualAnimation(this, timeMs, booster, secondary, speed); }"],
  ["ghostDualTeam", "  ghostDualTeam(booster) { return isGhostDualTeam(this, booster); }"],
  ["dispose", "  dispose() { return disposeGhostVisual(this, u5); }"],
]);
const raceBgmPlaybackMethodOverrides = new Map([
  ["prepareMultiplayer", "  async prepareMultiplayer(library, lobbyPath = '') { return prepareMultiplayerBgm(this, library, lobbyPath, raceBgmLoadingDependencies); }"],
  ["playMultiplayer", "  playMultiplayer(kind) { return playMultiplayerBgm(this, kind); }"],
  ["playMultiplayerPodium", "  playMultiplayerPodium() { return playMultiplayerPodiumBgm(this); }"],
  ["playMultiplayerFinish", "  playMultiplayerFinish(won) { return playMultiplayerFinishBgm(this, won); }"],
  ["load", "  static async load(library, track, random, context) { return loadRaceBgm(library, track, random, context, raceBgmLoadingDependencies); }"],
  ["selectRace", "  async selectRace(library, track) { return selectRaceBgm(this, library, track, raceBgmLoadingDependencies); }"],
  ["restart", "  restart() { return restartRaceBgm(this); }"],
  ["currentRaceName", "  get currentRaceName() { return currentRaceBgmName(this); }"],
  ["playReady", "  playReady() { return playReadyBgm(this); }"],
  ["playGarage", "  playGarage() { return playGarageBgm(this); }"],
  ["playMyItems", "  playMyItems() { return playMyItemsBgm(this); }"],
  ["playResult", "  playResult(won) { return playResultBgm(this, won); }"],
  ["dispose", "  dispose() { return disposeRaceBgm(this); }"],
  ["silence", "  silence() { return silenceRaceBgm(this); }"],
  ["start", "  start(buffer, loop, fade) { return startRaceBgm(this, buffer, loop, fade, raceBgmPlaybackDependencies); }"],
  ["advanceTransition", "  advanceTransition() { return advanceRaceBgmTransition(this, raceBgmPlaybackDependencies); }"],
  ["clearTransition", "  clearTransition() { return clearRaceBgmTransition(this, raceBgmPlaybackDependencies); }"],
  ["stop", "  stop(owner) { return stopRaceBgmOwner(owner); }"],
]);
const timeAttackInputBridgeMethodOverrides = new Map([
  ["drainDrivingInput", "  drainDrivingInput(nowMs, inputTime) { return drainTimeAttackDrivingInput(this, nowMs, inputTime, timeAttackInputBridgeDependencies); }"],
  ["handleDrivingCommand", "  handleDrivingCommand(command, nowMs, inputTime) { return routeTimeAttackDrivingCommand(this, command, nowMs, inputTime, timeAttackInputBridgeDependencies); }"],
  ["setAutoForwardEnabled", "  setAutoForwardEnabled(enabled) { return setTimeAttackAutoForward(this, enabled); }"],
  ["setNitroSeamlessMode", "  setNitroSeamlessMode(mode) { return setTimeAttackNitroSeamlessMode(this, mode); }"],
  ["getDrivingSnapshot", "  getDrivingSnapshot() { return timeAttackDrivingSnapshot(this); }"],
  ["handleBaseDrivingCommand", "  handleBaseDrivingCommand(command) { return routeBaseDrivingCommand(this, command); }"],
  ["handleTimeAttackDrivingCommand", "  handleTimeAttackDrivingCommand(command, nowMs, inputTime) { return routeTimeAttackRaceCommand(this, command, nowMs, inputTime, timeAttackInputBridgeDependencies); }"],
  ["resetTacho1InputMode", "  resetTacho1InputMode(inputTime) { return resetTimeAttackTachometerInput(this, inputTime, timeAttackInputBridgeDependencies); }"],
]);
const recordServiceMethodOverrides = new Map([
  ["restore", "  restore() { return restoreRaceRecords(this); }"],
  ["promote", "  async promote(elapsedMs, counts) { return promoteRaceRecord(this, elapsedMs, counts, recordServiceDependencies); }"],
  ["captureReplay", "  captureReplay(elapsedMs, counts, kartName) { return captureRaceReplay(this, elapsedMs, counts, kartName); }"],
  ["rawRecording", "  rawRecording(recorded, equipment, elapsedMs, counts, kartName) { return buildRawRaceRecording(this, recorded, equipment, elapsedMs, counts, kartName, recordServiceDependencies); }"],
  ["currentEquipment", "  currentEquipment() { return currentRaceEquipment(this); }"],
]);
const timeAttackStageMethodOverrides = new Map([
  ["placeAtStart", "  placeAtStart() { return placeAtStart(this, timeAttackStageDependencies); }"],
  ["snapStartToGround", "  snapStartToGround(position) { return snapStartToGround(this, position); }"],
  ["seedGhostStart", "  seedGhostStart(frame) { return seedGhostStart(this, frame, timeAttackStageDependencies); }"],
  ["captureGhostRuntime", "  captureGhostRuntime(nowMs) { return captureGhostRuntime(this, nowMs, timeAttackStageDependencies); }"],
  ["checkLowHeightReset", "  checkLowHeightReset(nowMs) { return checkLowHeightReset(this, nowMs, timeAttackStageDependencies); }"],
  ["checkAutomaticReset", "  checkAutomaticReset(nowMs) { return checkAutomaticReset(this, nowMs, timeAttackStageDependencies); }"],
  ["initiateSpeedReset", "  initiateSpeedReset(allowCurrentSpeed) { return initiateSpeedReset(this, allowCurrentSpeed, timeAttackStageDependencies); }"],
  ["advanceResetCompletion", "  advanceResetCompletion(nowMs) { return advanceCheckpointReset(this, nowMs, timeAttackStageDependencies); }"],
  ["warpToCheckpoint", "  warpToCheckpoint(section) { return warpToCheckpoint(this, section); }"],
  ["warpToPoint", "  warpToPoint(position) { return warpToPoint(this, position); }"],
  ["updateDriving", "  updateDriving(nowMs) { return updateTimeAttackDriving(this, nowMs, timeAttackStageDependencies); }"],
  ["handleTimeAttackActions", "  handleTimeAttackActions(actions, nowMs) { return dispatchTimeAttackActions(this, actions, nowMs); }"],
  ["handleTimeAttackActionAudio", "  handleTimeAttackActionAudio(action, nowMs) { return playTimeAttackActionAudio(this, action, nowMs); }"],
  ["handleTimeAttackFinishAction", "  handleTimeAttackFinishAction(action, nowMs) { return handleTimeAttackFinishAction(this, action, nowMs); }"],
  ["showTimeAttackResult", "  showTimeAttackResult(action, nowMs) { return showTimeAttackResult(this, action, nowMs); }"],
  ["restartRace", "  restartRace() { return restartTimeAttackRace(this, { newSpeedResetState: pr, worldAxis: H2, depthAxis: $2, selectPlayerSlot: pf0, recordingKey: B6, createRecorder: key => new cf0(key), ghostRelativeTime: nG, nowMs: () => performance.now() }); }"],
  ["enter", "  enter(transition) { return enterTimeAttackStage(this, transition, owners => new uf0(owners)); }"],
  ["disposeInterface", "  disposeInterface() { return disposeTimeAttackInterface(this); }"],
  ["exit", "  exit() { return exitTimeAttackStage(this); }"],
  ["updateTimeAttackRoute", "  updateTimeAttackRoute(nowMs, previousLap, currentLap) { return updateTimeAttackRoute(this, nowMs, previousLap, currentLap); }"],
  ["renderGameplayUi", "  renderGameplayUi(nowMs, ghostPoses) { return renderGameplayUi(this, nowMs, ghostPoses, timeAttackStageDependencies); }"],
  ["rankBoardValues", "  rankBoardValues() { return rankBoardValues(this, timeAttackStageDependencies); }"],
  ["update", "  update(frame) { return updateTimeAttackStage(this, frame, timeAttackStageDependencies); }"],
  ["render", "  render() { return renderTimeAttackStage(this, timeAttackStageDependencies); }"],
]);
const presenterMethodOverrides = new Map([
  ["start", "  start() { return startPresentationLoop(this, presentationFrameDependencies); }"],
  ["dispose", "  dispose() { return disposePresentationLoop(this); }"],
  ["frame", "  frame(scheduledAtMs) { return advancePresentationFrame(this, scheduledAtMs, presentationFrameDependencies); }"],
  ["updateAndRender", "  updateAndRender(startedAtMs) { return renderPresentationFrame(this, startedAtMs, presentationFrameDependencies); }"],
  ["releaseRaceForReady", "  releaseRaceForReady() { return releaseRaceForReady(this, presenterRaceDependencies); }"],
  ["replaceTrack", "  replaceTrack(nextTrack) { return replaceRaceTrack(this, nextTrack, presenterRaceDependencies); }"],
  ["applyRaceOptions", "  applyRaceOptions(kartItemId) { return applyRaceOptions(this, kartItemId, presenterRaceDependencies); }"],
]);
// Replace verified dynamics stages in AL while retaining its
// constructor and the remaining release methods until they are migrated.
const drivingMethodOverrides = new Map([
  ["constructor", "  constructor(e, t, i = false, r = false, s = false, o, a, c, l = false) { initializeVehicle(this, e, t, i, r, s, o, a, c, l, Q00); }"],
  ["update", "  update(milliseconds, input, track) { return advanceVehicleFrame(this, milliseconds, input, track); }"],
  ["stepSubstep", "  stepSubstep(seconds, input, track) { return advancePhysicsSubstep(this, seconds, input, track); }"],
  ["applyLongitudinal", "  applyLongitudinal(seconds, input, force) { return applyLongitudinalForce(this, seconds, input, force); }"],
  ["applySuspension", "  applySuspension(seconds, force, torque) { return applySuspensionForce(this, seconds, force, torque); }"],
  ["applyAirState", "  applyAirState(force, torque) { return applyAirborneForces(this, force, torque); }"],
  ["applySteeringAndTires", "  applySteeringAndTires(seconds, input, force, torque) { return applySteeringTireForces(this, seconds, input, force, torque); }"],
  ["applyRoadConsumers", "  applyRoadConsumers(seconds, force) { return applyRoadSurfaceConsumers(this, seconds, force); }"],
  ["probeWheels", "  probeWheels(track, roadOnly) { return probeVehicleWheels(this, track, roadOnly); }"],
  ["applySupplementalWheelRecovery", "  applySupplementalWheelRecovery(track) { return recoverUnconfirmedWheelContacts(this, track); }"],
  ["applySlipAlignment", "  applySlipAlignment() { return applySlipSurfaceAlignment(this); }"],
  ["setRoadActionState", "  setRoadActionState(state, milliseconds) { return beginRoadAction(this, state, milliseconds); }"],
  ["updateStateTimer", "  updateStateTimer(seconds) { return advanceStateTimerSeconds(this, seconds); }"],
  ["updateStateTimerMilliseconds", "  updateStateTimerMilliseconds(milliseconds) { return advanceStateTimerMilliseconds(this, milliseconds); }"],
  ["accumulateSpeedGauge", "  accumulateSpeedGauge(seconds, full3DRail) { return accumulateSpeedCharge(this, seconds, full3DRail); }"],
  ["rebuildBodyState", "  rebuildBodyState(force, torque) { return rebuildVehicleBodyState(this, force, torque); }"],
  ["applyBoosterChargeSurface", "  applyBoosterChargeSurface() { return applyBoosterChargeRoad(this); }"],
  ["updateTachometerIncGauge", "  updateTachometerIncGauge(full3DRail) { return updateSpeedChargeEligibility(this, full3DRail); }"],
  ["applyJumpSurfaceTuning", "  applyJumpSurfaceTuning() { return applyJumpRoadTuning(this); }"],
  ["applyResetSurfaceRequest", "  applyResetSurfaceRequest() { return requestResetRoad(this); }"],
  ["updatePrimaryAutomaticResetTimers", "  updatePrimaryAutomaticResetTimers(collision, seconds) { return updatePrimaryCollisionResetTimers(this, collision, seconds); }"],
  ["updateObstacleAutomaticResetTimer", "  updateObstacleAutomaticResetTimer(collided, seconds) { return updateObstacleCollisionResetTimer(this, collided, seconds); }"],
  ["advanceAutomaticResetTimer", "  advanceAutomaticResetTimer(elapsed, interrupted, seconds, threshold) { return advanceCollisionResetTimer(this, elapsed, interrupted, seconds, threshold); }"],
  ["activateDirectionalPress", "  activateDirectionalPress(mode) { return activateDirectionalCollisionPress(this, mode); }"],
  ["activateHardPress", "  activateHardPress() { return activateHardCollisionPress(this); }"],
  ["scanSpecialRoad", "  scanSpecialRoad(track) { return scanSpecialRoadSurfaces(this, track); }"],
  ["scanSpecialRoadPrefix", "  scanSpecialRoadPrefix(track, prefix, rayLength) { return scanSpecialRoadStrip(this, track, prefix, rayLength); }"],
  ["enterRailMode", "  enterRailMode() { return enterVehicleRailMode(this); }"],
  ["requestMotionMode", "  requestMotionMode(lift, nextMode) { return requestVehicleMotionMode(this, lift, nextMode); }"],
  ["returnToStandard", "  returnToStandard(seconds, track) { return returnVehicleToRoad(this, seconds, track); }"],
  ["captureRail", "  captureRail(seconds, track) { return captureVehicleRail(this, seconds, track); }"],
  ["produceRailFrame", "  produceRailFrame(seconds, track) { return produceVehicleRailFrame(this, seconds, track); }"],
  ["applyFull3DRail", "  applyFull3DRail(seconds, input, track, force, torque) { return applyVehicleRailDynamics(this, seconds, input, track, force, torque); }"],
  ["integrateFull3D", "  integrateFull3D(seconds) { return integrateVehicleRailOrientation(this, seconds); }"],
  ["integrateStandardOrientation", "  integrateStandardOrientation(seconds) { return integrateVehicleRoadOrientation(this, seconds); }"],
  ["countOrdinaryResultCrash", "  countOrdinaryResultCrash() { return countVehicleResultCrash(this); }"],
  ["resolveTrackEvents", "  resolveTrackEvents(track) { return resolveVehicleTrackEvents(this, track); }"],
  ["secondaryCollisionBox", "  secondaryCollisionBox() { return makeSecondaryCollisionBox(this); }"],
  ["updateCollisionGaugeOwners", "  updateCollisionGaugeOwners(contactHit) { return updateVehicleCollisionGaugeOwners(this, contactHit); }"],
  ["updatePublicGauge", "  updatePublicGauge() { return publishVehicleGauge(this); }"],
  ["mainGaugeRatio", "  mainGaugeRatio() { return mainVehicleGaugeRatio(this); }"],
  ["updateInstantAccelerationGauge", "  updateInstantAccelerationGauge(seconds) { return updateInstantAccelerationCharge(this, seconds); }"],
  ["updateInstantWallCharge", "  updateInstantWallCharge(nowMs) { return settleInstantWallCharge(this, nowMs); }"],
  ["beginInstantWallCharge", "  beginInstantWallCharge(nowMs) { return beginInstantWallChargeWindow(this, nowMs); }"],
  ["updateResetGaugeRefill", "  updateResetGaugeRefill(seconds, nowMs) { return advanceResetGaugeRefill(this, seconds, nowMs); }"],
  ["beginWallCollision", "  beginWallCollision() { return beginWallGaugeWindow(this); }"],
  ["settleWallCollision", "  settleWallCollision(nowMs) { return settleWallGaugeWindow(this, nowMs); }"],
  ["setWallGaugeRefill", "  setWallGaugeRefill(fraction) { return setWallGaugeRefund(this, fraction); }"],
  ["clearResetGaugeRefill", "  clearResetGaugeRefill() { return clearWallGaugeRefund(this); }"],
  ["updateCachedDisplaySpeed", "  updateCachedDisplaySpeed() { return cacheDisplaySpeed(this); }"],
  ["syncPresentationFields", "  syncPresentationFields() { return syncVehiclePresentation(this); }"],
  ["accumulateDriftGauge", "  accumulateDriftGauge(seconds, full3DRail) { return accumulateDriftCharge(this, seconds, full3DRail); }"],
  ["commitDriftGauge", "  commitDriftGauge() { return commitDriftCharge(this); }"],
  ["updateDriftLifecycleTimers", "  updateDriftLifecycleTimers(seconds) { return updateDriftWindows(this, seconds); }"],
  ["applyCollisionDriftGaugePreserve", "  applyCollisionDriftGaugePreserve(chargerCollision) { return preserveDriftChargeAfterCollision(this, chargerCollision); }"],
  ["resolvePrimaryCollision", "  resolvePrimaryCollision(track, input) { return resolveVehicleTrackCollision(this, track, input); }"],
  ["resolveStaticObstacles", "  resolveStaticObstacles(track) { return resolveVehicleObstacleCollisions(this, track); }"],
  ["applyHighObstacleAngularResponse", "  applyHighObstacleAngularResponse(normal) { return applyHighContactAngularResponse(this, normal); }"],
  ["applyWallObstacleAngularResponse", "  applyWallObstacleAngularResponse(normal) { return applyWallContactAngularResponse(this, normal); }"],
  ["applyDrag", "  applyDrag(force, torque, full3DRail) { return applyVelocityDrag(this, force, torque, full3DRail); }"],
  ["integrateVelocity", "  integrateVelocity(seconds, force, torque, extraForce) { return integrateVehicleVelocity(this, seconds, force, torque, extraForce); }"],
  ["startNormalBooster", "  startNormalBooster(input) { return startVehicleNormalBooster(this, input); }"],
  ["activateChargerIfReady", "  activateChargerIfReady() { return activateVehicleCharger(this); }"],
  ["chargerDurationMs", "  chargerDurationMs() { return vehicleChargerDurationMs(this); }"],
  ["updateChargerExpiry", "  updateChargerExpiry(nowMs) { return expireVehicleCharger(this, nowMs); }"],
  ["updateDualBooster", "  updateDualBooster() { return updateVehicleDualBooster(this); }"],
  ["armDualBooster", "  armDualBooster() { return armVehicleDualBooster(this); }"],
  ["refreshDualBoosterReady", "  refreshDualBoosterReady() { return refreshVehicleDualBoosterReady(this); }"],
  ["classifyDualBoosterReady", "  classifyDualBoosterReady(mode, state, elapsed) { return classifyVehicleDualBoosterReady(this, mode, state, elapsed); }"],
  ["clearDualBoosterReady", "  clearDualBoosterReady(state) { return clearVehicleDualBoosterReady(this, state); }"],
  ["updateObstacleSuppressionTimer", "  updateObstacleSuppressionTimer(elapsedMs) { return advanceObstacleSuppression(this, elapsedMs); }"],
  ["visualScaleMode", "  visualScaleMode() { return vehicleVisualScaleMode(this); }"],
  ["setVisualScaleMode", "  setVisualScaleMode(mode) { return setVehicleVisualScaleMode(this, mode); }"],
  ["updateVisualScale", "  updateVisualScale(nowMs) { return updateVehicleVisualScale(this, nowMs); }"],
  ["updateModeScale", "  updateModeScale(nowMs) { return updateVehicleScaleMode(this, nowMs); }"],
  ["updateEventScale", "  updateEventScale(nowMs) { return updateVehicleEventScale(this, nowMs); }"],
  ["updateEventGravity", "  updateEventGravity(nowMs) { return updateVehicleEventGravity(this, nowMs); }"],
  ["accumulateTeamGauge", "  accumulateTeamGauge(amount) { return accumulateVehicleTeamGauge(this, amount); }"],
  ["consumeMultiplayerTeamCharge", "  consumeMultiplayerTeamCharge() { return consumeVehicleTeamGaugeCharge(this); }"],
  ["enqueueMultiplayerTeamTarget", "  enqueueMultiplayerTeamTarget(fraction) { return enqueueVehicleTeamGaugeTarget(this, fraction); }"],
  ["updateTeamGauge", "  updateTeamGauge(nowMs) { return updateVehicleTeamGauge(this, nowMs); }"],
  ["consumeTeamGaugeFullAnimation", "  consumeTeamGaugeFullAnimation() { return consumeVehicleTeamGaugeFullAnimation(this); }"],
  ["timeAttackTeamGaugeSettledAtMs", "  timeAttackTeamGaugeSettledAtMs() { return teamGaugeSettledAtMs(this); }"],
  ["convertTeamBoosterSlots", "  convertTeamBoosterSlots(nowMs, temporary) { return convertVehicleTeamBoosterSlots(this, nowMs, temporary); }"],
  ["updateTeamSlotWindow", "  updateTeamSlotWindow(nowMs) { return expireVehicleTeamSlotWindow(this, nowMs); }"],
  ["timeAttackSpeedSlotDisabled", "  timeAttackSpeedSlotDisabled() { return vehicleSpeedSlotDisabled(this); }"],
  ["timeAttackSpeedSlotWindowStartMs", "  timeAttackSpeedSlotWindowStartMs() { return teamSlotWindowStartMs(this); }"],
]);

// item-mode(driving): item-race (道具赛) members of AL and the item tuning record.
// The behavior lives in src/driving/item-mode.ts, item-effects.ts and
// physics-parameters.ts. Touch points elsewhere in this file are also marked
// item-mode(driving): the AL emission and one import line in renderModule.
const itemModeDrivingMembers = [
  "  itemMode = !1;",
  "  itemEffects;",
  "  get itemSlotCapacity() { return VehicleItemMode.vehicleItemSlotCapacity(this); }",
  "  setItemSlots(slots) { return VehicleItemMode.setVehicleItemSlots(this, slots); }",
  "  itemSlots() { return VehicleItemMode.vehicleItemSlots(this); }",
  "  startItemBooster() { return VehicleItemMode.startVehicleItemBooster(this); }",
];
function appendItemModeDrivingMembers(classText) {
  const end = classText.lastIndexOf("}");
  assert(end > 0, "AL class body is missing its closing brace.");
  return `${classText.slice(0, end)}${itemModeDrivingMembers.join("\n")}\n${classText.slice(end)}`;
}
// jt0 builds the AL tuning record; item races also need the item columns.
vehicleResidualOverrides.set("jt0",
  "function jt0(spec, visual, engineGrade) { return vehiclePhysicsParameters(spec, visual, engineGrade); }");
function itemModeDrivingImports(name) {
  if (name === "driving") return ['import * as VehicleItemMode from "../driving/item-mode.ts";'];
  if (name === "vehicle") return ['import { vehiclePhysicsParameters } from "../driving/physics-parameters.ts";'];
  return [];
}

// A delegate retains the release method's original signature, including
// getter syntax and default parameters, while moving its behavior to TypeScript.
function vehicleDelegate(namespace, exportedName, mode = "instance") {
  return method => {
    const parameters = method.params.map(parameter => {
      const binding = parameter.type === "AssignmentPattern" ? parameter.left : parameter;
      assert(binding.type === "Identifier", `Unsupported AL parameter in ${method.key.name}.`);
      return binding.name;
    });
    const argumentsList = mode === "surface-only" ? [...parameters, "vehicleSurfaces"]
      : mode === "no-instance" ? parameters
        : mode === "with-surfaces" ? ["this", ...parameters, "vehicleSurfaces"]
          : mode === "with-neutral-input" ? ["this", ...parameters, "W40"]
          : ["this", ...parameters];
    const header = source.slice(method.start, method.body.start);
    return `${header}{ return ${namespace}.${exportedName}(${argumentsList.join(", ")}); }`;
  };
}

const vehicleCommandDelegates = {
  synchronizeClock: "synchronizeVehicleClock",
  updateLockedIngameClock: "updateVehicleLockedClock",
  setDualBoostAuto: "setVehicleDualBoostAuto",
  handleDrivingCommand: "handleVehicleDrivingCommand",
  tryConsumeNormalBooster: "tryConsumeVehicleNormalBooster",
  queueNitroSeamless: "queueVehicleNitroSeamless",
  cancelNitroSeamless: "cancelVehicleNitroSeamless",
  canHandleRouteSurfaceTag: "canHandleVehicleRouteSurfaceTag",
  handleRouteSurfaceTag: "handleVehicleRouteSurfaceTag",
  prepareRailCheckpointReentry: "prepareVehicleRailCheckpointReentry",
  contactRailId: "vehicleContactRailId",
  consumeRailResetRequest: "consumeVehicleRailResetRequest",
  consumeCollisionAudioStrength: "consumeVehicleCollisionAudioStrength",
  consumeCrashEffectRequest: "consumeVehicleCrashEffectRequest",
  consumeShockWaveRequest: "consumeVehicleShockWaveRequest",
  consumeTrackEventEffectRequests: "consumeVehicleTrackEventEffectRequests",
  consumeSteeringCollisionAudioGain: "consumeVehicleSteeringCollisionAudioGain",
  consumeAutomaticResetRequest: "consumeVehicleAutomaticResetRequest",
  audioState: "vehicleAudioState",
  dualBoosterMode: "vehicleDualBoosterMode",
  dualBoosterState: "vehicleDualBoosterState",
  dualBoosterReadyRemainingMs: "vehicleDualBoosterReadyRemainingMs",
  dualBoosterTeam: "vehicleDualBoosterTeam",
  displaySpeedKmh: "vehicleDisplaySpeedKmh",
  networkMotionMode: "vehicleNetworkMotionMode",
  copyNetworkWrench: "copyVehicleNetworkWrench",
  networkCollisionState: "vehicleNetworkCollisionState",
  networkCollisionScheduled: "vehicleNetworkCollisionScheduled",
  applyKartPairResponse: "applyVehicleKartPairResponse",
  startRaceBooster: "startVehicleRaceBooster",
  setRaceMotionLocked: "setVehicleRaceMotionLocked",
  startPlayBooster: "startVehiclePlayBooster",
  restoreResetInteraction: "restoreVehicleResetInteraction",
  updateModeInventory: "updateVehicleModeInventory",
  lowSpeedAutomaticResetActive: "isVehicleLowSpeedAutomaticResetActive",
  cancelControls: "cancelVehicleControls",
  hardCancelControls: "hardCancelVehicleControls",
  stopDrift: "stopVehicleDrift",
  setDriveSteeringSuppressed: "setVehicleDriveSteeringSuppressed",
  isDriveSteeringSuppressed: "isVehicleDriveSteeringSuppressed",
  setFullPhysicsBypass: "setVehicleFullPhysicsBypass",
  setWarpPresentationActive: "setVehicleWarpPresentationActive",
  isWarpPresentationActive: "isVehicleWarpPresentationActive",
  setWarpPressProtected: "setVehicleWarpPressProtected",
  setRuntimeScales: "setVehicleRuntimeScales",
  setMultiplayerDrivingScales: "setVehicleMultiplayerDrivingScales",
  triggerEventScale: "triggerVehicleEventScale",
  triggerEventGravity: "triggerVehicleEventGravity",
  setAnimationSlot: "setVehicleAnimationSlot",
  consumeKartAnimationInput: "consumeVehicleKartAnimationInput",
  addFlyingPetListener: "addVehicleFlyingPetListener",
  lteDodgeAvailable: "vehicleLteDodgeAvailable",
  giantSourceProtected: "vehicleGiantSourceProtected",
  compensateGiantBooster: "compensateVehicleGiantBooster",
  clearGiantRaceEffects: "clearVehicleGiantRaceEffects",
};
const vehicleTachometerDelegates = {
  timeAttackTachometerSpeed: "vehicleTachometerSpeed",
  timeAttackTachometerGauges: "vehicleTachometerGauges",
  timeAttackSpeedSlots: "vehicleSpeedSlots",
  canReorderSpeedSlots: "canReorderVehicleSpeedSlots",
  timeAttackSlotChangerActive: "vehicleSlotChangerActive",
  reorderSpeedSlots: "reorderVehicleSpeedSlots",
  consumeSpeedSlotReordered: "consumeVehicleSpeedSlotReordered",
  timeAttackTachometerExceed: "vehicleTachometerExceed",
  timeAttackBoosterUnlimited: "vehicleBoosterUnlimited",
  timeAttackTachometerDriftMaxGauge: "vehicleDriftMaxGauge",
  timeAttackTachometerIncGauge: "vehicleTachometerIncGauge",
  timeAttackTachometerCharger: "vehicleTachometerCharger",
  timeAttackTachometerCollision: "vehicleTachometerCollision",
  consumeTimeAttackTachometerNormalBooster: "consumeVehicleNormalBoosterDuration",
  consumeTimeAttackTachometerGaugePreserve: "consumeVehicleGaugePreserveMarker",
  timeAttackResultCounts: "vehicleTimeAttackResultCounts",
  timeAttackTachometerAnimationState: "vehicleTachometerAnimationState",
};
const vehicleFactoryDelegates = {
  createBody: "createVehicleBody",
  createWheelRuntime: "createVehicleWheelRuntime",
  createRuntime: "createVehicleRuntime",
  createState: "createVehicleState",
};
const vehicleViewDelegates = {
  driveCameraRuntime: "updateCameraRuntimeView",
  driftVisualRuntime: "updateDriftVisualView",
};
const vehicleResetDelegates = {
  reset: "resetVehicle",
  resetFromRouteFrame: "resetVehicleFromRoute",
  beginResetInitiation: "beginVehicleReset",
  prepareLowHeightResetPose: "prepareVehicleLowHeightReset",
  completeCheckpointPose: "placeVehicleAtCheckpoint",
  warpPosition: "warpVehiclePosition",
  settle: "settleVehicle",
};
const vehicleDebugDelegates = { getDebugState: "snapshotVehicleDebugState" };
for (const [original, exported] of Object.entries(vehicleCommandDelegates)) {
  assert(!drivingMethodOverrides.has(original), `Duplicate AL method ${original}.`);
  const mode = original === "canHandleRouteSurfaceTag" ? "surface-only"
    : ["handleRouteSurfaceTag", "contactRailId", "stopDrift"].includes(original)
      ? "with-surfaces" : "instance";
  drivingMethodOverrides.set(original, vehicleDelegate("VehicleCommands", exported, mode));
}
for (const [original, exported] of Object.entries(vehicleTachometerDelegates)) {
  assert(!drivingMethodOverrides.has(original), `Duplicate AL method ${original}.`);
  drivingMethodOverrides.set(original, vehicleDelegate("VehicleTachometer", exported));
}
for (const [original, exported] of Object.entries(vehicleFactoryDelegates)) {
  assert(!drivingMethodOverrides.has(original), `Duplicate AL method ${original}.`);
  drivingMethodOverrides.set(original, vehicleDelegate("VehicleInitialization", exported,
    original === "createRuntime" ? "instance" : "no-instance"));
}
for (const [original, exported] of Object.entries(vehicleViewDelegates)) {
  assert(!drivingMethodOverrides.has(original), `Duplicate AL method ${original}.`);
  drivingMethodOverrides.set(original, vehicleDelegate("VehiclePresentation", exported));
}
for (const [original, exported] of Object.entries(vehicleResetDelegates)) {
  assert(!drivingMethodOverrides.has(original), `Duplicate AL method ${original}.`);
  drivingMethodOverrides.set(original, vehicleDelegate("VehicleReset", exported,
    original === "settle" ? "with-neutral-input" : "instance"));
}
for (const [original, exported] of Object.entries(vehicleDebugDelegates)) {
  assert(!drivingMethodOverrides.has(original), `Duplicate AL method ${original}.`);
  drivingMethodOverrides.set(original, vehicleDelegate("VehicleDebug", exported));
}
const worldConstructorOverrides = new Map([
  ["constructor", `  constructor(data, scene, renderScene, skydomeScene, lensFlare) {
    initializeTrackWorld(this, data, scene, renderScene, skydomeScene, lensFlare, {
      p3553ObbQuery: Oo,
      legacyObbQuery: Ai0,
      isRailDescriptor: Ri,
      movingDescriptorIssue: Fl,
      makeStaticSurface: (triangles, query) => new StaticTrackSurface(triangles, query, {
        p3553ObbQuery: Oo,
        p3553ObbBounds: di0,
        roadDescriptorIssue: Vm,
      }),
      makeMovingSurface: (triangles, elements, query) =>
        new MovingTrackSurface(triangles, elements, query, { p3553ObbQuery: Oo }),
      makeObstacleSurface: (triangles, query) =>
        new ObstacleSurface(triangles, query, Oo),
    });
  }`],
  ["commitObstacleSnapshot", "  commitObstacleSnapshot() { return commitObstacleSnapshot(this, Oo); }"],
]);
// The release TrackWorld's entire method surface has already been rewritten
// and differentially tested in world/install.ts. Strip all 36 old bodies and
// install the readable methods when the class is declared.
const worldInstalledMethods = [
  "projectSectionDistance", "sampleRoute", "requireRouteState", "getRouteState",
  "getStart", "resetRouteState", "refreshRouteProjection", "warpRouteToSection",
  "currentRouteSurface", "prepareCurrentSectionReset", "commitCurrentSectionReset",
  "updateRoute", "runOuterRoutePass", "associateRoute", "warpNextDestination",
  "completeWarpNextRailLanding", "railCaptureDistance", "lookupRailConfig",
  "completeRailContactLanding", "updateEvents", "registerEventPairs",
  "expireEventEffects", "consumeExpiredEventEffects", "commitEventSnapshot",
  "queryEventObb", "rayQuery", "queryObb", "queryObstacleObb",
  "updateRender", "setLensFlareEnabled", "resetRender", "updateMovingRoads",
  "updateObstacles", "registerObstaclePair", "commitObstacleSnapshot", "dispose",
];
for (const name of worldInstalledMethods) worldConstructorOverrides.set(name, " ");
const activeRaceMethodOverrides = new Map([
  ["bindClock", "  bindClock(mapping) { return bindActiveRaceClock(this, mapping, { makeClock: value => new BL(value), makeSender: (physics, clock, connection, routing) => new ki0(physics, clock, connection, routing) }); }"],
  ["scheduleStart", "  scheduleStart(startAt) { return scheduleActiveRaceStart(this, startAt); }"],
  ["updateRoom", "  updateRoom(room) { return updateActiveRaceRoom(this, room, raceRoomDependencies); }"],
  ["update", "  update(nowMs, frame, bypass) { return updateActiveRaceFrame(this, nowMs, frame, bypass, { racingState: X2.Racing, resultState: X2.Result, captureMotion: B40, captureAnimation: R40 }); }"],
  ["updateRemotes", "  updateRemotes(nowMs) { return updateRaceRemoteViews(this, nowMs, { racingState: X2.Racing, resultState: X2.Result }); }"],
  ["roadBlockRemaining", "  roadBlockRemaining(nowMs) { return roadblockRemaining(this, nowMs, Y3); }"],
  ["dispose", "  dispose() { return disposeActiveRace(this); }"],
]);
const developmentExports = new Set([
  "Sw",
  "AL",
  "_L",
  "jr0",
  "LT",
  "Wl0",
  "ql0",
  "Pt",
  "df0",
  "vf0",
  "Bf0",
  ...resourceOverrides,
  ...inputOverrides,
  "Ah0",
  "bh0",
  "Th0",
  ...ksvOverrides,
  ...motionCodecOverrides,
  ...peerMeshOverrides,
  ...networkTimingOverrides,
]);
const order = [
  "vendor",
  "formats",
  "library",
  "data",
  "math",
  "vehicle",
  "driving",
  "world",
  "ui",
  "multiplayer",
  "timeattack",
  "app",
];
const rank = new Map(order.map((name, index) => [name, index]));
const sha256 = (text) => createHash("sha256").update(text).digest("hex");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function originalSection(offset) {
  const found = sections.find(({ start, end }) => offset >= start && offset < end);
  assert(found, `No source region owns offset ${offset}`);
  return found.name;
}

function groupNames(names) {
  return [...names].sort().join(", ");
}

const source = await readFile(sourceFile, "utf8");
assert(sha256(source) === expectedSourceHash, "The inspected formatted bundle changed.");
assert(source.length === sections.at(-1).end, "The source length changed.");
const embeddedPakoStart = source.indexOf("const d60 = 4,");
const embeddedPakoEnd = source.indexOf("const ah0 = 12,", embeddedPakoStart);
assert(embeddedPakoStart >= 0 && embeddedPakoEnd > embeddedPakoStart &&
  originalSection(embeddedPakoStart) === "timeattack" &&
  originalSection(embeddedPakoEnd) === "timeattack",
"The embedded Pako codec boundaries changed.");
const embeddedPngInflateStart = source.indexOf("var rt = Uint8Array,");
const embeddedPngInflateEnd = source.indexOf("const Kq = new Uint8Array", embeddedPngInflateStart);
assert(embeddedPngInflateStart >= 0 && embeddedPngInflateEnd > embeddedPngInflateStart,
  "The bundled PNG zlib decoder boundaries changed.");
const trackPrsStart = source.indexOf("const jA = new WeakMap();");
const trackPrsEnd = source.indexOf("class NW {", trackPrsStart);
assert(trackPrsStart >= 0 && trackPrsEnd > trackPrsStart &&
  originalSection(trackPrsStart) === "formats" && originalSection(trackPrsEnd) === "formats",
"The track PRS animation boundaries changed.");
const speedTypeTableStart = source.indexOf("const I20 =");
const speedTypeTableEnd = source.indexOf("const z20 =", speedTypeTableStart);
assert(speedTypeTableStart >= 0 && speedTypeTableEnd > speedTypeTableStart &&
  originalSection(speedTypeTableStart) === "library" &&
  originalSection(speedTypeTableEnd) === "library",
"The redundant SpeedType table boundaries changed.");
const modelRecordStart = source.indexOf("class s7 {");
const modelRecordEnd = source.indexOf("class a7 {", modelRecordStart);
assert(modelRecordStart >= 0 && modelRecordEnd > modelRecordStart &&
  originalSection(modelRecordStart) === "library" &&
  originalSection(modelRecordEnd) === "library",
"The Object47 model reader boundaries changed.");
const kartBoosterEffectsStart = source.indexOf("const dS =");
const kartBoosterEffectsEnd = source.indexOf("function u10(", kartBoosterEffectsStart);
assert(kartBoosterEffectsStart >= 0 && kartBoosterEffectsEnd > kartBoosterEffectsStart &&
  originalSection(kartBoosterEffectsStart) === "library" &&
  originalSection(kartBoosterEffectsEnd) === "library",
"The kart booster effect boundaries changed.");
const ast = parse(source, { sourceType: "module", errorRecovery: false });
const statements = ast.program.body;
const driftClusterStartNode = statements.find(node => node.type === "VariableDeclaration" &&
  node.declarations[0]?.id?.name === "De0");
const driftClusterEndNode = statements.find(node => node.type === "FunctionDeclaration" &&
  node.id?.name === "y0" && node.start > driftClusterStartNode?.start);
assert(driftClusterStartNode && driftClusterEndNode &&
  originalSection(driftClusterStartNode.start) === "vehicle" &&
  originalSection(driftClusterEndNode.start) === "vehicle" &&
  statements.filter(node => node.start >= driftClusterStartNode.start &&
    node.end <= driftClusterEndNode.end).length === 30,
"The release drift effect cluster boundaries changed.");
const embeddedPakoDeclarationCount = statements.filter(node =>
  node.start >= embeddedPakoStart && node.start < embeddedPakoEnd).length;
assert(embeddedPakoDeclarationCount > 30,
  "The embedded Pako codec no longer has the expected declarations.");
const replacedFormatClasses = new Set();
const replacedDriveCameraClasses = new Set();
const replacedKeyControllers = new Set();
let replacedTrackSceneAssembly = false;
const replacedCharacterRenderers = new Set();
const replacedResourceDecoders = new Set();
const replacedSceneResourceClasses = new Set();
let replacedBillboardOrientation = false;
let retiredBillboardScratch = false;
const replacedFormatBusiness = new Set();
const replacedFormatRoadDescriptors = new Set();
const replacedFormatRoadExtraction = new Set();
const replacedFormatObstacles = new Set();
const replacedFormatTrackAdmission = new Set();
const replacedFormatKartIdentity = new Set();
const replacedFormatFontLayout = new Set();
const replacedFormatTimeAttackRewards = new Set();
const retiredFormatFont = new Set();
let retiredKartIdentityEmptySet = false;
let retiredTrackNameCompare = false;
let replacedRendererWarmup = false;
const retiredFormatDeclarations = new Set();
let retiredDriftClusterDeclarations = 0;
let retiredDriftTextureSelector = false;
let replacedToonOutlineController = false;
const replacedReadableFormatRenderers = new Set();
const replacedWorldPerformance = new Set();
const replacedWorldLargeDeclarations = new Set();
const replacedWorldResidualDeclarations = new Set();
const retiredWorldResidualGroups = new Set();
const replacedAppBoot = new Set();
const replacedWorldHud = new Set();
const replacedWorldLocalDirectory = new Set();
let retiredWorldLocalDirectoryKeys = false;
let replacedCanvasContextDiagnostics = false;
let retiredCanvasContextEvents = false;
let replacedTouchLayoutEditor = false;
let retiredTouchLayoutKeys = false;
const retiredTouchLayout = new Set();
let replacedTouchDrivingControls = false;
let retiredTouchDrivingConstants = false;
const retiredTouchDriving = new Set();
const replacedTimeAttackDialogs = new Set();
const replacedRouteSurfaceListenerMethods = new Set();
const replacedRaceBgmResources = new Set();
const replacedGhostEquipment = new Set();
const replacedTimeAttackAuxiliaryClasses = new Set();
let retiredRaceBgmThemePaths = false;
let retiredInterfaceAudioPaths = false;
let replacedFirstRiderDialog = false;
let retiredFirstRiderConstants = false;
const retiredFirstRiderHelpers = new Set();
const firstRiderHelpers = new Set(["n1", "F3", "ms", "Td0", "U5", "Y_", "_d0", "Gd0"]);
let replacedVehiclePreviewRenderer = false;
const replacedTimeAttackRaceViews = new Set();
const replacedGhostVisualHelpers = new Set();
let retiredEmbeddedPakoDeclarations = 0;
const replacedDrivingCollision = new Set();
let retiredHudVersion = false;
const retiredCollisionFloatAliases = new Set();
let replacedKartPresentationView = false;
let replacedPngInflate = false;
let retiredTrackPrsDeclarations = 0;
let retiredSpeedTypeTableDeclarations = 0;
let retiredModelRecordDeclarations = 0;
let retiredKartBoosterEffectDeclarations = 0;
let retiredModelRecordConstants = false;
const replacedLibraryResultViews = new Set();
const retiredDerivedOverlayHelpers = new Set();
let replacedDerivedOverlayRenderer = false;
let replacedModelBinaryCursor = false;
let replacedCourseGraph = false;
let replacedPngDecoder = false;
let retiredPngSignature = false;
const replacedTextureAlpha = new Set();
const bodies = new Map(order.map((name) => [name, []]));
let garageExportNode;
let dlDeclarator;
const replacedInputs = new Set();
const replacedResources = new Set();
const replacedSwMethods = new Set();
const replacedRaceHudBoostMethods = new Set();
let replacedMotionBlurEffect = false;
let retiredMotionBlurConstants = false;
const retiredMotionBlurHelpers = new Set();
let replacedMqTachometer = false;
const retiredMqTachometerHelpers = new Set();
const motionBlurHelperNames = new Set(["Ct0", "Et0", "Tt0", "_t0", "Gt0",
  "YS", "ZS", "QS", "Bt0", "Rt0", "ov", "It0", "kt0", "Lt0", "Gk"]);
const replacedLobbyListDrawMethods = new Set();
const replacedMultiplayerWindowAssetMethods = new Set();
let replacedMultiplayerWindowView = false;
let replacedGarageLivePanels = false;
const retiredLibraryHudAndConfirmation = new Set();
const replacedLibraryHudAndConfirmation = new Set();
const replacedGhosts = new Set();
const replacedKsv = new Set();
const replacedGhostRuntimeClasses = new Set();
const replacedLobbyAvatarDeclarations = new Set();
const replacedLobbyRoomMethods = new Set();
const replacedLobbyRoomFields = new Set();
let replacedRaceLoadingScreen = false;
const replacedGhostKsvClassMethods = new Set();
const replacedGhostKsvFunctions = new Set();
const replacedMultiplayerPresenterMethods = new Set();
const replacedRacePresentationSessionMethods = new Set();
const replacedTrackInfoCardMethods = new Set();
let replacedRaceChatOverlay = false;
let replacedRpScenePreview = false;
const replacedMultiplayerNoticeClasses = new Set();
const replacedLobbyPreviewDeclarations = new Set();
const replacedMultiplayerAccountDeclarations = new Set();
const replacedMultiplayerPresentationFunctions = new Set();
const replacedMultiplayerSupportFunctions = new Set();
const replacedFullMultiplayerClasses = new Set();
let replacedMultiplayerAccountUiGroup = false;
const replacedRoomOptionFunctions = new Set();
const replacedLobbyDialogMethods = new Set();
const retiredGhosts = new Set();
const replacedPhysics = new Set();
const replacedMotionCodec = new Set();
const replacedVehicleBusiness = new Set();
const replacedVehicleAnimationSelectors = new Set();
const replacedVehicleAnimationActions = new Set();
const replacedVehicleCoinSources = new Set();
const replacedVehicleCoinOwners = new Set();
const replacedVehicleVisualOwners = new Set();
const replacedVehicleWeather = new Set();
const replacedVehicleRouteFunctions = new Set();
const replacedVehicleWarpClasses = new Set();
const replacedVehicleTrackEvents = new Set();
const replacedVehicleEventAnimators = new Set();
const replacedVehicleLensFlares = new Set();
const replacedVehicleKartAudio = new Set();
const replacedVehicleAssetLoaderMethods = new Set();
const replacedVehicleSlipstream = new Set();
const replacedVehicleStartGrid = new Set();
const replacedVehicleNormalCoordinators = new Set();
const replacedVehicleFrameClocks = new Set();
const replacedVehicleResidual = new Set();
const retiredVehicleResidualConstants = new Set();
const replacedPeerMesh = new Set();
const replacedNetworkTiming = new Set();
const replacedLobbyPrimitives = new Set();
const replacedUiSymbols = new Set();
const retiredUi = new Set();
const replacedLocalProfileFunctions = new Set();
const replacedTrackPickerMethods = new Set();
const replacedLocalRaceMethods = new Set();
const replacedRemoteMotion = new Set();
const replacedRaceDrivingScales = new Set();
let retiredRaceDrivingHelpers = false;
const replacedRacePeerCadence = new Set();
let retiredRacePeerFloat32 = false;
const replacedOutgoingRaceMotion = new Set();
let retiredOutgoingMotionHelpers = false;
const replacedReadyViewMethods = new Set();
const replacedReadyViewPointers = new Set();
const replacedReadyVehiclePreviewMethods = new Set();
const replacedSettingsMethods = new Set();
const replacedGarageSelectionMethods = new Set();
let replacedRemoteFleet = false;
const replacedInputClasses = new Set();
const replacedInputFunctions = new Set();
const replacedGameplayAdmission = new Set();
const replacedGameplayTiles = new Set();
let replacedGameplayInputQueue = false;
let replacedGamepadPoller = false;
const replacedLobbyActions = new Set();
let replacedRaceStartCoordinator = false;
let replacedSoloRacePublisher = false;
const replacedRaceSessionMethods = new Set();
let replacedServerEventParser = false;
let replacedRoomValidator = false;
const replacedLifecycle = new Set();
const replacedDrivingMethods = new Set();
const replacedWorldConstructor = new Set();
const replacedActiveRaceMethods = new Set();
const replacedReadyMethods = new Set();
const replacedApplicationMethods = new Set();
const replacedApplicationFields = new Set();
const replacedGhostRecordLibraryMethods = new Set();
const replacedGhostAssetBuilderMethods = new Set();
const replacedGhostMenuImportMethods = new Set();
const replacedGhostMenuBridgeMethods = new Set();
const replacedGhostVisualMotionMethods = new Set();
const replacedRaceBgmPlaybackMethods = new Set();
const replacedTimeAttackInputBridgeMethods = new Set();
let replacedGhostSmoothSampler = false;
const replacedRecordServiceMethods = new Set();
const replacedTimeAttackStageMethods = new Set();
const replacedPresenterMethods = new Set();
let replacedStageManager = false;

function rewriteClassMethods(node, replacements, found) {
  let cursor = node.start;
  let rewritten = "";
  for (const method of node.body.body) {
    if (method.type !== "ClassMethod" || method.key.type !== "Identifier") continue;
    const replacement = replacements.get(method.key.name);
    if (!replacement) continue;
    assert(!found.has(method.key.name), `Duplicate method override ${method.key.name}.`);
    rewritten += source.slice(cursor, method.start) +
      (typeof replacement === "function" ? replacement(method) : replacement);
    cursor = method.end;
    found.add(method.key.name);
  }
  return rewritten + source.slice(cursor, node.end);
}

function rewriteLobbyRoomMembers(node) {
  let cursor = node.start;
  let rewritten = "";
  for (const member of node.body.body) {
    if (member.key?.type !== "Identifier") continue;
    const isMethod = member.type === "ClassMethod";
    const isField = member.type === "ClassProperty";
    const replacements = isMethod ? lobbyRoomMethodOverrides :
      isField ? lobbyRoomFieldOverrides : undefined;
    const found = isMethod ? replacedLobbyRoomMethods : replacedLobbyRoomFields;
    const replacement = replacements?.get(member.key.name);
    if (!replacement) continue;
    assert(!found.has(member.key.name), `Duplicate lobby room member ${member.key.name}.`);
    rewritten += source.slice(cursor, member.start) + replacement;
    cursor = member.end;
    found.add(member.key.name);
  }
  return rewritten + source.slice(cursor, node.end);
}

function recordWholeClassMembers(node, replacements, found, type = "ClassMethod") {
  for (const name of replacements.keys()) {
    assert(node.body.body.some(member => member.type === type &&
      member.key?.type === "Identifier" && member.key.name === name),
    `Whole-class replacement is missing ${node.id.name}.${name}.`);
    assert(!found.has(name), `Duplicate whole-class replacement ${node.id.name}.${name}.`);
    found.add(name);
  }
}

function rewriteReadyView(node) {
  let cursor = node.start;
  let rewritten = "";
  for (const member of node.body.body) {
    if (member.key?.type !== "Identifier") continue;
    const name = member.key.name;
    const isMethod = member.type === "ClassMethod";
    const isPointer = member.type === "ClassProperty";
    const replacement = isMethod ? readyViewMethodOverrides.get(name)
      : isPointer ? readyViewPointerOverrides.get(name) : undefined;
    if (!replacement) continue;
    const found = isMethod ? replacedReadyViewMethods : replacedReadyViewPointers;
    assert(!found.has(name), `Duplicate Ready view member ${name}.`);
    rewritten += source.slice(cursor, member.start) + replacement;
    cursor = member.end;
    found.add(name);
  }
  return rewritten + source.slice(cursor, node.end);
}

function rewriteApplication(node) {
  let cursor = node.start;
  let rewritten = "";
  for (const member of node.body.body) {
    if (member.key?.type !== "Identifier") continue;
    const name = member.key.name;
    const isMethod = member.type === "ClassMethod";
    const isField = member.type === "ClassProperty";
    const scopedName = isMethod && (member.kind === "get" || member.kind === "set")
      ? `${member.kind}:${name}` : name;
    const overrideName = isMethod && applicationMethodOverrides.has(scopedName)
      ? scopedName : name;
    const replacement = isMethod ? applicationMethodOverrides.get(overrideName)
      : isField ? applicationFieldOverrides.get(name) : undefined;
    if (!replacement) continue;
    const found = isMethod ? replacedApplicationMethods : replacedApplicationFields;
    const memberName = isMethod ? overrideName : name;
    assert(!found.has(memberName), `Duplicate application member ${memberName}.`);
    rewritten += source.slice(cursor, member.start) + replacement;
    cursor = member.end;
    found.add(memberName);
  }
  return rewritten + source.slice(cursor, node.end);
}

for (const node of statements) {
  if (node.type === "ExportNamedDeclaration") {
    assert(!garageExportNode && !node.declaration, "Unexpected main-bundle export shape.");
    garageExportNode = node;
    continue;
  }
  if (node.start >= embeddedPakoStart && node.start < embeddedPakoEnd) {
    assert(originalSection(node.start) === "timeattack",
      "Embedded Pako declaration moved out of timeattack.");
    retiredEmbeddedPakoDeclarations += 1;
    continue;
  }
  if (node.start >= trackPrsStart && node.start < trackPrsEnd) {
    assert(originalSection(node.start) === "formats", "Track PRS declaration moved.");
    if (node.start === trackPrsStart) bodies.get("formats").push({ at: node.start, text: `
function P6(value) { return isTrackPrs(value); }
function zG() { return createPrsRuntime(); }
function GW(property, runtime, time, duration) { return playPrs(property, runtime, time, duration); }
function BW(runtime, mode) { return setPrsCycleMode(runtime, mode); }
function RW(property, runtime, time) { return stopPrs(property, runtime, time); }
function Nm(property) { return validatePrs(property); }
function UG() { return defaultTrackTransform(); }
function $G(output, property, runtime, time, fallback) { return applyTrackPrs(output, property, runtime, time, fallback); }
function PW(property, runtime, time, fallback) { return sampleTrackPrs(property, runtime, time, fallback); }
` });
    retiredTrackPrsDeclarations += 1;
    continue;
  }
  if (node.start >= modelRecordStart && node.start < modelRecordEnd) {
    assert(originalSection(node.start) === "library", "Object47 model reader declaration moved.");
    if (node.start === modelRecordStart) bodies.get("library").push({ at: node.start,
      text: `class s7 extends ModelObjectReader {
  constructor() { super(createModelRecordDecoders(L6)); }
}
function Wx(value) { return isModelElement(value); }` });
    retiredModelRecordDeclarations += 1;
    continue;
  }
  if (node.start >= kartBoosterEffectsStart && node.start < kartBoosterEffectsEnd) {
    assert(originalSection(node.start) === "library", "Kart booster effect declaration moved.");
    if (node.start === kartBoosterEffectsStart) bodies.get("library").push({ at: node.start,
      text: `const kartBoosterDependencies = {
  decodeScene: y9, buildScene: c5, parseXml: x1,
  xmlChild: zp, xmlAttribute: j0, warmDetachedScene: Hn,
};
class KI extends KartBoosterSharedSources {}
class Ca extends KartBoosterEffectHost {
  static load(library, vehicle, grade, kart, environment, stage,
    presentation = "driving", allowed, shared) {
    return super.load(library, vehicle, grade, kart, environment,
      stage, presentation, allowed, shared, kartBoosterDependencies);
  }
}
function $w(state) { return boosterKindForState(state); }
function Ww(state) { return waveKindForState(state); }` });
    retiredKartBoosterEffectDeclarations += 1;
    continue;
  }
  if (node.start >= driftClusterStartNode.start && node.end <= driftClusterEndNode.end) {
    assert(originalSection(node.start) === "vehicle", "The drift effect declaration moved.");
    if (node.start === driftClusterStartNode.start) bodies.get("vehicle").push({
      at: node.start, text: `const driftEffectDependencies = {
  Object3D: T2, DataTexture: J9, MeshBasicMaterial: d3,
  BufferGeometry: t9, BufferAttribute: _0, Mesh: D2,
  decodePng: p2, configureSkidMesh: ie, configureDriftMesh: Ao,
  textureFormat: e9, textureType: _9, colorSpace: v9,
  wrapping: S1, nearestFilter: h9, dynamicUsage: r1,
  doubleSide: s1, customBlending: u1, additiveEquation: R9,
  sourceAlpha: l1, oneMinusSourceAlpha: v1, oneBlend: h3,
};
function Ze0(definition, scene, singleRearWheel, kartType) {
  return createDriftMarkSetup(definition, scene, singleRearWheel, kartType, oS);
}
const iv = createDriftEffectClass(driftEffectDependencies);`,
    });
    retiredDriftClusterDeclarations += 1;
    continue;
  }

  const declarationName =
    node.type === "FunctionDeclaration" || node.type === "ClassDeclaration"
      ? node.id?.name
      : node.type === "VariableDeclaration" && node.declarations.length === 1
        ? node.declarations[0].id.name
        : undefined;
  // item-mode(hud): item slot builder (see itemHudSlotOverrides).
  if ((itemHudSlotOverrides.has(declarationName) ||
      retiredItemHudSlotHelpers.has(declarationName)) &&
      originalSection(node.start) === "library") {
    assert(node.type === "FunctionDeclaration",
      `Item slot HUD declaration ${declarationName} changed.`);
    if (itemHudSlotOverrides.has(declarationName)) {
      bodies.get("library").push({ at: node.start,
        text: itemHudSlotOverrides.get(declarationName) });
      replacedItemHudSlots.add(declarationName);
    } else retiredItemHudSlots.add(declarationName);
    continue;
  }
  if (node.type === "VariableDeclaration" &&
      node.declarations[0]?.id?.name === "o6") {
    assert(originalSection(node.start) === "vehicle" &&
      groupNames(node.declarations.map(entry => entry.id.name)) ===
        "St0, a6, o6, xt0", "Motion blur constants moved from vehicle.");
    retiredMotionBlurConstants = true;
    continue;
  }
  if (motionBlurHelperNames.has(declarationName)) {
    assert(node.type === "FunctionDeclaration" &&
      originalSection(node.start) === "vehicle",
    `Motion blur helper ${declarationName} moved from vehicle.`);
    retiredMotionBlurHelpers.add(declarationName);
    continue;
  }
  if (declarationName === "sv") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "vehicle",
      "Motion blur effect moved from vehicle.");
    for (const name of ["load", "setState", "render", "reset", "dispose",
      "renderLayer", "captureFrame", "overlayFrame", "currentScreenTexture"]) {
      assert(node.body.body.some(member => member.key?.name === name),
        `Motion blur class lost ${name}.`);
    }
    bodies.get("vehicle").push({ at: node.start,
      text: "const sv = createMotionBlurEffectClass(motionBlurRendererOps);" });
    replacedMotionBlurEffect = true;
    continue;
  }
  if (declarationName === "Kh" || declarationName === "x50") {
    assert(originalSection(node.start) === "vehicle" &&
      node.type === (declarationName === "Kh" ? "VariableDeclaration" :
        "FunctionDeclaration"),
    `MQ tachometer helper ${declarationName} moved from vehicle.`);
    retiredMqTachometerHelpers.add(declarationName);
    continue;
  }
  if (declarationName === "Fk") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "vehicle",
      "MQ tachometer moved from vehicle.");
    for (const name of ["update", "render", "dispose", "enableUiSmoothing"]) {
      assert(node.body.body.some(member => member.key?.name === name),
        `MQ tachometer lost ${name}.`);
    }
    bodies.get("vehicle").push({ at: node.start,
      text: "const Fk = createMqTachometerClass(mqTachometerOps);" });
    replacedMqTachometer = true;
    continue;
  }
  if (node.type === "VariableDeclaration" &&
      node.declarations[0]?.id?.name === "EZ") {
    assert(originalSection(node.start) === "formats" &&
      groupNames(node.declarations.map(entry => entry.id.name)) === "EZ, TZ",
    "The empty blocked kart set changed in the release.");
    retiredKartIdentityEmptySet = true;
    continue;
  }
  if (declarationName === "Wn") {
    assert(node.type === "FunctionDeclaration" && originalSection(node.start) === "formats",
      "Track name comparator changed in the release.");
    retiredTrackNameCompare = true;
    continue;
  }
  if (declarationName === "re0") {
    assert(node.type === "FunctionDeclaration" && originalSection(node.start) === "vehicle",
      "Drift texture selector changed in the release.");
    retiredDriftTextureSelector = true;
    continue;
  }
  if (formatTrackAdmissionOverrides.has(declarationName)) {
    assert(node.type === "FunctionDeclaration" && originalSection(node.start) === "formats",
      `Track admission declaration ${declarationName} changed.`);
    bodies.get("formats").push({ at: node.start,
      text: formatTrackAdmissionOverrides.get(declarationName) });
    replacedFormatTrackAdmission.add(declarationName);
    continue;
  }
  if (formatKartIdentityOverrides.has(declarationName)) {
    assert(node.type === (declarationName === "Cr" ? "VariableDeclaration" : "FunctionDeclaration") &&
      originalSection(node.start) === "formats",
      `Kart identity declaration ${declarationName} changed.`);
    bodies.get("formats").push({ at: node.start,
      text: formatKartIdentityOverrides.get(declarationName) });
    replacedFormatKartIdentity.add(declarationName);
    continue;
  }
  if (formatTimeAttackRewardOverrides.has(declarationName)) {
    assert(node.type === "FunctionDeclaration" && originalSection(node.start) === "formats",
      `Time attack result declaration ${declarationName} changed.`);
    bodies.get("formats").push({ at: node.start,
      text: formatTimeAttackRewardOverrides.get(declarationName) });
    replacedFormatTimeAttackRewards.add(declarationName);
    continue;
  }
  if (formatFontLayoutOverrides.has(declarationName)) {
    assert(node.type === "FunctionDeclaration" && originalSection(node.start) === "formats",
      `Font layout declaration ${declarationName} changed.`);
    bodies.get("formats").push({ at: node.start,
      text: formatFontLayoutOverrides.get(declarationName) });
    replacedFormatFontLayout.add(declarationName);
    continue;
  }
  if (retiredFormatFontHelpers.has(declarationName)) {
    assert(originalSection(node.start) === "formats" &&
      node.type === (declarationName === "Jb" ? "VariableDeclaration" : "FunctionDeclaration"),
      `Font layout helper ${declarationName} changed.`);
    retiredFormatFont.add(declarationName);
    continue;
  }
  if (declarationName === "Hn") {
    assert(node.type === "FunctionDeclaration" && originalSection(node.start) === "formats",
      "Renderer warmup declaration changed.");
    bodies.get("formats").push({ at: node.start,
      text: "function Hn(renderer, root, environment, onePixel = false) { return warmRendererResources(renderer, root, environment, onePixel); }" });
    replacedRendererWarmup = true;
    continue;
  }
  if (node.type === "VariableDeclaration" &&
      node.declarations[0]?.id?.name === "zM") {
    assert(originalSection(node.start) === "library" &&
      groupNames(node.declarations.map(entry => entry.id.name)) ===
      "Qu, T8, UM, gQ, mQ, vQ, wQ, zM",
    "The garage confirmation resource constants changed in the release source.");
    retiredLibraryHudAndConfirmation.add("zM");
    continue;
  }
  if (["PR", "yQ", "jr", "Ju", "AQ", "$M", "bQ", "MQ", "xQ",
    "SQ", "CQ", "I00", "cI", "lI", "ig", "Lx", "Px"].includes(declarationName)) {
    assert(originalSection(node.start) === "library",
      `Library HUD or confirmation helper ${declarationName} moved.`);
    retiredLibraryHudAndConfirmation.add(declarationName);
    continue;
  }
  if (declarationName === "pQ" || declarationName === "_w") {
    assert(node.type === "FunctionDeclaration" && originalSection(node.start) === "library",
      `Garage confirmation resource loader ${declarationName} moved.`);
    bodies.get("library").push({ at: node.start, text: declarationName === "pQ"
      ? "async function pQ(library) { return loadGarageConfirmationFont(library, garageConfirmationAssetDependencies); }"
      : "async function _w(library) { return loadGarageConfirmationBlueprint(library, garageConfirmationAssetDependencies); }" });
    replacedLibraryHudAndConfirmation.add(declarationName);
    continue;
  }
  if (declarationName === "FR") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "library" &&
      node.body.body.filter(member => member.type === "ClassMethod").length === 12,
    "Garage confirmation class changed in the release source.");
    bodies.get("library").push({ at: node.start, text: `class FR extends GarageConfirmationDialog {
  constructor(root, onVisibility, blueprint, images, font) {
    super(root, onVisibility, blueprint, images, font, garageConfirmationDialogDependencies);
  }
  static async load(library, root, onVisibility) {
    return GarageConfirmationDialog.load(library, root, onVisibility,
      garageConfirmationDialogDependencies,
      (root, onVisibility, blueprint, images, font) =>
        new FR(root, onVisibility, blueprint, images, font));
  }
}` });
    replacedLibraryHudAndConfirmation.add(declarationName);
    continue;
  }
  if (declarationName === "Fw") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "library" &&
      node.body.body.filter(member => member.type === "ClassMethod").length === 12,
    "Giant Boost HUD class changed in the release source.");
    bodies.get("library").push({ at: node.start, text: `class Fw extends GiantBoostHud {
  constructor(models, textures, panels) {
    super(models, textures, panels, giantBoostHudDependencies);
  }
  static async load(library) {
    return GiantBoostHud.load(library, giantBoostHudDependencies,
      (models, textures, panels) => new Fw(models, textures, panels));
  }
}` });
    replacedLibraryHudAndConfirmation.add(declarationName);
    continue;
  }
  if (declarationName === "Dw") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "library" &&
      node.body.body.filter(member => member.type === "ClassMethod").length === 14,
    "Multiplayer HUD class changed in the release source.");
    bodies.get("library").push({ at: node.start, text: `class Dw extends MultiplayerRaceHud {
  constructor(ui, tints, anonymous = false, competition = false, runnerId) {
    super(ui, tints, anonymous, competition, runnerId, multiplayerRaceHudDependencies);
  }
  static async load(library, race, playerId) {
    return MultiplayerRaceHud.load(library, race, playerId,
      multiplayerRaceHudDependencies,
      (ui, tints, anonymous, competition, runnerId) =>
        new Dw(ui, tints, anonymous, competition, runnerId));
  }
}` });
    replacedLibraryHudAndConfirmation.add(declarationName);
    continue;
  }
  if (node.type === "VariableDeclaration" && originalSection(node.start) === "world" &&
      ["$L", "n9", "M2"].includes(node.declarations[0]?.id?.name)) {
    retiredWorldResidualGroups.add(node.declarations[0].id.name);
    continue;
  }
  if (["sr0", "ar0", "ur0", "dr0", "$d", "mE", "Ks", "cr0", "hr0", "Tv", "qr0", "Kr0"]
      .includes(declarationName)) {
    assert(originalSection(node.start) === "world" &&
      ["FunctionDeclaration", "ClassDeclaration"].includes(node.type),
      `World residual ${declarationName} moved from its release section.`);
    replacedWorldResidualDeclarations.add(declarationName);
    continue;
  }
  if (formatRoadDescriptorOverrides.has(declarationName)) {
    assert(node.type === "FunctionDeclaration" && originalSection(node.start) === "formats",
      `Road descriptor declaration ${declarationName} changed.`);
    bodies.get("formats").push({ at: node.start,
      text: formatRoadDescriptorOverrides.get(declarationName) });
    replacedFormatRoadDescriptors.add(declarationName);
    continue;
  }
  if (formatRoadExtractionOverrides.has(declarationName)) {
    assert(node.type === "FunctionDeclaration" && originalSection(node.start) === "formats",
      `Road extraction declaration ${declarationName} changed.`);
    bodies.get("formats").push({ at: node.start,
      text: formatRoadExtractionOverrides.get(declarationName) });
    replacedFormatRoadExtraction.add(declarationName);
    continue;
  }
  if (formatObstacleOverrides.has(declarationName)) {
    assert(node.type === "FunctionDeclaration" && originalSection(node.start) === "formats",
      `Obstacle declaration ${declarationName} changed.`);
    bodies.get("formats").push({ at: node.start,
      text: formatObstacleOverrides.get(declarationName) });
    replacedFormatObstacles.add(declarationName);
    continue;
  }
  if (retiredFormatSource.has(declarationName)) {
    assert(originalSection(node.start) === "formats" &&
      (declarationName === "EW" ? node.type === "VariableDeclaration" :
        declarationName === "NW" ? node.type === "ClassDeclaration" :
          node.type === "FunctionDeclaration"),
    `Retired format declaration ${declarationName} changed.`);
    retiredFormatDeclarations.add(declarationName);
    continue;
  }
  if (node.type === "VariableDeclaration" &&
      node.declarations[0]?.id?.name === "Fn0") {
    assert(originalSection(node.start) === "vehicle" &&
      groupNames(node.declarations.map(part => part.id.name)) === "Dn0, Fn0, Je",
    "Track surround audio constants changed in the release.");
    retiredVehicleResidualConstants.add("track-sound");
    continue;
  }
  if (node.type === "VariableDeclaration" && declarationName === "j1") {
    assert(originalSection(node.start) === "vehicle", "V1 tachometer float constant moved.");
    retiredVehicleResidualConstants.add("v1-float");
    continue;
  }
  if (node.type === "VariableDeclaration" &&
      node.declarations[0]?.id?.name === "J_") {
    assert(originalSection(node.start) === "timeattack" &&
      groupNames(node.declarations.map(part => part.id.name)) === "J_, Yd0",
    "Race BGM theme paths changed.");
    retiredRaceBgmThemePaths = true;
    continue;
  }
  if (node.type === "VariableDeclaration" &&
      node.declarations[0]?.id?.name === "xf0") {
    assert(originalSection(node.start) === "timeattack" &&
      groupNames(node.declarations.map(part => part.id.name)) ===
        "Cf0, Ef0, Sf0, xf0",
    "Interface audio paths changed.");
    retiredInterfaceAudioPaths = true;
    continue;
  }
  if (raceBgmResourceOverrides.has(declarationName)) {
    assert(node.type === "FunctionDeclaration" &&
      originalSection(node.start) === "timeattack",
    `Race BGM resource helper ${declarationName} changed.`);
    bodies.get("timeattack").push({ at: node.start,
      text: raceBgmResourceOverrides.get(declarationName) });
    replacedRaceBgmResources.add(declarationName);
    continue;
  }
  if (ghostEquipmentOverrides.has(declarationName)) {
    assert(node.type === "FunctionDeclaration" &&
      originalSection(node.start) === "timeattack",
    `Ghost equipment helper ${declarationName} changed.`);
    bodies.get("timeattack").push({ at: node.start,
      text: ghostEquipmentOverrides.get(declarationName) });
    replacedGhostEquipment.add(declarationName);
    continue;
  }
  // Browser presentation controls extend the verified release settings without
  // changing the stored audio, input, or gameplay preferences.
  if (node.type === "VariableDeclaration" && node.declarations[0]?.id?.name === "_P") {
    const original = source.slice(node.start, node.end);
    assert(original.includes("boostBlur: !1"), "Default graphics options changed.");
    bodies.get("world").push({ at: node.start,
      text: original.replace("boostBlur: !1", "verticalSync: false,\n    boostBlur: !1") });
    continue;
  }
  if (declarationName === "la0") {
    const original = source.slice(node.start, node.end);
    assert(original.includes("dualBoostAuto: !0"), "Stored graphics defaults changed.");
    bodies.get("world").push({ at: node.start,
      text: original.replace("dualBoostAuto: !0", "verticalSync: false,\n            dualBoostAuto: !0") });
    continue;
  }
  if (declarationName === "RP") {
    const original = source.slice(node.start, node.end);
    assert(original.includes('"boostBlur"'), "Graphics option validation changed.");
    bodies.get("world").push({ at: node.start,
      text: original.replace('"boostBlur"', '"verticalSync",\n    "boostBlur"') });
    continue;
  }
  if (node.type === "VariableDeclaration" && node.declarations[0]?.id?.name === "Jc0") {
    const original = source.slice(node.start, node.end);
    assert(original.includes('boostBlur: "boostBlur"'), "Graphics control mapping changed.");
    bodies.get("ui").push({ at: node.start,
      text: original.replace('boostBlur: "boostBlur"', 'verticalSync: "verticalSync",\n    boostBlur: "boostBlur"') });
    continue;
  }
  // Individual rooms dress each racer in its slot's dye (not in the
  // release, which kept everyone's own dye there); team and roadblock dyes
  // are unchanged.
  if (declarationName === "A40") {
    const original = source.slice(node.start, node.end);
    const teamDye = `: Q && F.team
            ? Q[F.team - 1].dyeId
            : void 0,`;
    const dyedCharacters = `c0 = await (
          Q
            ? new ul(`;
    assert(original.includes(teamDye) && original.includes(dyedCharacters),
      "Race rider dye selection changed.");
    bodies.get("vehicle").push({ at: node.start,
      // item-mode(world): applyItemWorldPatches adds the item map flag and owners.
      text: applyItemWorldPatches(original.replace(teamDye, `: Q && F.team
            ? Q[F.team - 1].dyeId
            : individualRiderDye(e, F.slot),`).replace(dyedCharacters, `c0 = await (
          Q || F0 !== void 0
            ? new ul(`), itemWorldRaceAssetPatches) });
    continue;
  }
  if (declarationName === "qc0") {
    const original = source.slice(node.start, node.end);
    assert(original.includes("graphics: i,"), "Graphics definition loading changed.");
    bodies.get("ui").push({ at: node.start,
      text: original.replace("graphics: i,", "graphics: addGraphicsPresentationOptions(i),") });
    continue;
  }
  if (node.type === "VariableDeclaration" && node.declarations[0]?.id?.name === "H20") {
    assert(originalSection(node.start) === "library" &&
      groupNames(node.declarations.map(part => part.id.name)) ===
        groupNames(["H20", "q20", "K20", "j20", "oe", "PI", "X20", "Y20", "mh", "Z20"]),
    "Object47 model constants changed.");
    bodies.get("library").push({ at: node.start, text: "const Y20 = 1e5;" });
    retiredModelRecordConstants = true;
    continue;
  }
  if (node.type === "VariableDeclaration" &&
      node.declarations[0]?.id?.name === "Ad0") {
    assert(originalSection(node.start) === "timeattack" &&
      groupNames(node.declarations.map(part => part.id.name)) ===
        groupNames(["Ad0", "bd0", "Md0", "xd0", "UD", "$D", "WD", "$t",
          "H3", "q3", "mm", "Sd0", "gs", "Cd0", "Ed0", "Vc"]),
    "First rider asset constants changed.");
    retiredFirstRiderConstants = true;
    continue;
  }
  if (firstRiderHelpers.has(declarationName)) {
    assert(node.type === "FunctionDeclaration" &&
      originalSection(node.start) === "timeattack",
    `First rider helper ${declarationName} changed.`);
    retiredFirstRiderHelpers.add(declarationName);
    continue;
  }
  if (node.start >= speedTypeTableStart && node.start < speedTypeTableEnd &&
      declarationName !== "r7") {
    assert(originalSection(node.start) === "library", "SpeedType table declaration moved.");
    if (node.start === speedTypeTableStart) bodies.get("library").push({ at: node.start,
      text: `const Lo = 1, qn = 2e6, k20 = defaultCnSpeedType;
function II(version, speed) { return findSpeedTypeEntry(version, speed); }` });
    retiredSpeedTypeTableDeclarations += 1;
    continue;
  }
  if (["KQ", "jQ", "XQ", "YQ", "ex", "ZQ", "tx", "QQ", "UR", "JQ"].includes(declarationName)) {
    assert(node.type === "FunctionDeclaration" && originalSection(node.start) === "library",
      `Derived overlay helper ${declarationName} moved.`);
    retiredDerivedOverlayHelpers.add(declarationName);
    continue;
  }
  if (["Tw", "Bo"].includes(declarationName)) {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "library",
      `Result view ${declarationName} moved.`);
    bodies.get("library").push({ at: node.start, text: declarationName === "Tw"
      ? `class Tw extends MultiplayerResultView {
  static load(library, root, race, playerId, teamMode = false) {
    return super.load(library, root, race, playerId, teamMode, multiplayerResultDependencies);
  }
}`
      : `class Bo extends RoadblockResultView {
  static loadHud(library, root, race, playerId) {
    return super.loadHud(library, root, race, playerId, roadblockResultDependencies);
  }
  static loadResult(library, root, race) {
    return super.loadResult(library, root, race, roadblockResultDependencies);
  }
}` });
    replacedLibraryResultViews.add(declarationName);
    continue;
  }
  if (declarationName === "fn") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "library",
      "Derived overlay renderer moved.");
    bodies.get("library").push({ at: node.start,
      text: `class fn extends DerivedOverlayRenderer {
  constructor(playRuntimes, alphaTestReference = 8) {
    super(playRuntimes, alphaTestReference, derivedOverlayDependencies);
  }
}` });
    replacedDerivedOverlayRenderer = true;
    continue;
  }
  if (declarationName === "a7") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "library",
      "Model binary cursor moved.");
    bodies.get("library").push({ at: node.start,
      text: "class a7 extends ModelBinaryCursor {}" });
    replacedModelBinaryCursor = true;
    continue;
  }
  if (node.type === "VariableDeclaration" &&
      node.declarations.length === 3 &&
      node.declarations[0].id.name === "no0") {
    assert(originalSection(node.start) === "world" &&
      groupNames(new Set(node.declarations.map(part => part.id.name))) === "no0, pP, zo",
    "Local resource directory storage keys changed.");
    retiredWorldLocalDirectoryKeys = true;
    continue;
  }
  if (node.type === "VariableDeclaration" &&
      node.declarations.length === 2 &&
      node.declarations[0].id.name === "zT") {
    assert(originalSection(node.start) === "timeattack" &&
      groupNames(new Set(node.declarations.map(part => part.id.name))) === "UT, zT",
    "Touch layout constants changed.");
    retiredTouchLayoutKeys = true;
    continue;
  }
  if (node.type === "VariableDeclaration" &&
      node.declarations.length === 5 &&
      node.declarations[0].id.name === "BF") {
    assert(originalSection(node.start) === "timeattack" &&
      groupNames(new Set(node.declarations.map(part => part.id.name))) ===
        "Af, BF, RF, T5, c60",
    "Touch driving constants changed.");
    retiredTouchDrivingConstants = true;
    continue;
  }
  if (declarationName === "UE") {
    assert(node.type === "VariableDeclaration" && originalSection(node.start) === "world",
      "Canvas context event list changed.");
    retiredCanvasContextEvents = true;
    continue;
  }
  if (declarationName === "qs0") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "world",
      "Canvas context diagnostic class changed.");
    bodies.get("world").push({ at: node.start,
      text: "class qs0 extends CanvasContextDiagnostics {}" });
    replacedCanvasContextDiagnostics = true;
    continue;
  }
  if (worldLocalDirectoryOverrides.has(declarationName)) {
    assert(node.type === "FunctionDeclaration" && originalSection(node.start) === "world",
      `Local resource directory function ${declarationName} changed.`);
    replacedWorldLocalDirectory.add(declarationName);
    continue;
  }
  if (declarationName === "r60") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "timeattack",
      "Touch layout editor changed.");
    bodies.get("timeattack").push({ at: node.start,
      text: "class r60 extends TouchLayoutEditor {}" });
    replacedTouchLayoutEditor = true;
    continue;
  }
  if (declarationName === "l60") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "timeattack",
      "Touch driving controls changed.");
    bodies.get("timeattack").push({ at: node.start,
      text: "class l60 extends TouchDrivingControls { constructor(root, onAction, onPause, onAutoForwardChange, onNitroSeamlessChange) { super(root, onAction, onPause, onAutoForwardChange, onNitroSeamlessChange, { keyLabel: SP }); } }" });
    replacedTouchDrivingControls = true;
    continue;
  }
  if (declarationName === "Py") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "timeattack",
      "The vehicle preview renderer changed.");
    bodies.get("timeattack").push({ at: node.start,
      text: "class Py extends VehiclePreviewRenderer { constructor(width, height) { super(width, height, vehiclePreviewDependencies); } static create(width, height) { return new Py(width, height); } }" });
    replacedVehiclePreviewRenderer = true;
    continue;
  }
  if (declarationName === "Fy") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "timeattack",
      "The first rider dialog changed.");
    bodies.get("timeattack").push({ at: node.start,
      text: `class Fy extends FirstRiderDialog {
  constructor(root, blueprint, images, catalog, previewContext) {
    super(root, blueprint, images, catalog, previewContext, firstRiderDialogDependencies);
  }
  static async load(library, root, catalog, previewContext) {
    const { blueprint, images } = await loadRiderImages(library, firstRiderDialogDependencies);
    return new Fy(root, blueprint, images, catalog, previewContext);
  }
}` });
    replacedFirstRiderDialog = true;
    continue;
  }
  if (declarationName === "Mf0") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "timeattack",
      "Race camera coordinator changed.");
    bodies.get("timeattack").push({ at: node.start,
      text: "class Mf0 extends RaceCameraCoordinator { constructor(shake, wave, warpNext, options = {}) { super(shake, wave, warpNext, options, raceCameraDependencies); } }" });
    replacedTimeAttackAuxiliaryClasses.add("Mf0");
    continue;
  }
  if (declarationName === "Ny") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "timeattack",
      "Interface audio owner changed.");
    bodies.get("timeattack").push({ at: node.start,
      text: "class Ny extends InterfaceAudio { constructor(context, click, hover, slotChanger, start) { super(context, click, hover, slotChanger, start, interfaceAudioDependencies); } static async load(library, context) { return InterfaceAudio.load(library, context, interfaceAudioDependencies, (click, hover, slotChanger, start) => new Ny(context, click, hover, slotChanger, start)); } }" });
    replacedTimeAttackAuxiliaryClasses.add("Ny");
    continue;
  }
  if (declarationName === "rf0") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "timeattack",
      "Frame rate counter changed.");
    bodies.get("timeattack").push({ at: node.start,
      text: "class rf0 extends FrameRateCounter {}" });
    replacedTimeAttackAuxiliaryClasses.add("rf0");
    continue;
  }
  if (declarationName === "uf0") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "timeattack",
      "TimeAttack interface owners changed.");
    bodies.get("timeattack").push({ at: node.start,
      text: "class uf0 extends TimeAttackInterfaceOwners {}" });
    replacedTimeAttackAuxiliaryClasses.add("uf0");
    continue;
  }
  if (declarationName === "sf0") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "timeattack",
      "Route surface listener changed.");
    bodies.get("timeattack").push({ at: node.start,
      text: rewriteClassMethods(node, routeSurfaceListenerMethodOverrides,
        replacedRouteSurfaceListenerMethods) });
    continue;
  }
  if (declarationName === "Dy") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "timeattack",
      "The pause menu view changed.");
    bodies.get("timeattack").push({ at: node.start,
      text: "class Dy extends PauseMenuView { constructor(options, assets) { super(options, assets, pauseMenuViewDependencies); } static async load(options) { return PauseMenuView.load(options, pauseMenuViewDependencies, (input, assets) => new Dy(input, assets)); } }" });
    replacedTimeAttackDialogs.add("Dy");
    continue;
  }
  if (declarationName === "zd0") {
    assert(node.type === "FunctionDeclaration" && originalSection(node.start) === "timeattack",
      "The pause menu asset loader changed.");
    bodies.get("timeattack").push({ at: node.start,
      text: "async function zd0(library) { return loadPauseMenuAssets(library, pauseAssetDependencies); }" });
    replacedTimeAttackDialogs.add("zd0");
    continue;
  }
  if (declarationName === "Ly") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "timeattack",
      "The Ghost menu panel changed.");
    for (const method of ghostMenuImportMethodOverrides.keys()) {
      assert(node.body.body.some(member => member.type === "ClassMethod" &&
        member.key.type === "Identifier" && member.key.name === method),
      `The Ghost menu method ${method} changed.`);
      replacedGhostMenuImportMethods.add(method);
    }
    bodies.get("timeattack").push({ at: node.start,
      text: "class Ly extends GhostMenuPanel { constructor(options) { super(options, ghostMenuPanelDependencies); } static attach(options) { return new Ly(options); } }" });
    replacedTimeAttackRaceViews.add("Ly");
    continue;
  }
  if (declarationName === "Bd0") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "timeattack",
      "The solo race state container changed.");
    bodies.get("timeattack").push({ at: node.start,
      text: "class Bd0 extends TimeAttackRaceState { constructor() { super(raceStateDependencies); } }" });
    replacedTimeAttackRaceViews.add("Bd0");
    continue;
  }
  if (declarationName === "Rd0") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "timeattack",
      "The solo result overlay changed.");
    bodies.get("timeattack").push({ at: node.start,
      text: "class Rd0 extends TimeAttackResultOverlay { constructor(definition) { super(definition, resultOverlayDependencies); } }" });
    replacedTimeAttackRaceViews.add("Rd0");
    continue;
  }
  if (declarationName === "Kd0") {
    assert(node.type === "FunctionDeclaration" && originalSection(node.start) === "timeattack",
      "The Ghost trail selection changed.");
    bodies.get("timeattack").push({ at: node.start,
      text: "function Kd0(status, previous, vehicle) { return ghostTrailState(status, previous, vehicle, BD); }" });
    replacedGhostVisualHelpers.add("Kd0");
    continue;
  }
  if (declarationName === "qf") {
    assert(node.type === "FunctionDeclaration" && originalSection(node.start) === "timeattack",
      "The Ghost toon clone helper changed.");
    bodies.get("timeattack").push({ at: node.start,
      text: "function qf(root, pairs) { return cloneGhostToonMaterials(root, pairs, ghostToonDependencies); }" });
    replacedGhostVisualHelpers.add("qf");
    continue;
  }
  if (declarationName === "tf0") {
    assert(node.type === "FunctionDeclaration" && originalSection(node.start) === "timeattack",
      "The Ghost effect inventory changed.");
    bodies.get("timeattack").push({ at: node.start,
      text: "function tf0(record) { return ghostEffectNames(record, ghostEffectDependencies); }" });
    replacedGhostVisualHelpers.add("tf0");
    continue;
  }
  if (retiredTouchDrivingHelpers.has(declarationName)) {
    assert(node.type === "FunctionDeclaration" && originalSection(node.start) === "timeattack",
      `Touch driving helper ${declarationName} changed.`);
    retiredTouchDriving.add(declarationName);
    continue;
  }
  if (retiredTouchLayoutHelpers.has(declarationName)) {
    assert(node.type === "FunctionDeclaration" && originalSection(node.start) === "timeattack",
      `Touch layout helper ${declarationName} changed.`);
    retiredTouchLayout.add(declarationName);
    continue;
  }
  if (node.type === "VariableDeclaration" &&
      node.declarations.length === 3 &&
      node.declarations[0].id.name === "Uo0") {
    assert(originalSection(node.start) === "world" &&
      groupNames(new Set(node.declarations.map(part => part.id.name))) === "Uo0, YE, ZE",
    "HUD version constants changed.");
    retiredHudVersion = true;
    continue;
  }
  if (node.type === "VariableDeclaration" &&
      ["w0", "f1"].includes(declarationName)) {
    assert(originalSection(node.start) === "driving" &&
      node.declarations.length === 1,
    `Collision float alias ${declarationName} changed.`);
    retiredCollisionFloatAliases.add(declarationName);
    continue;
  }
  if (drivingCollisionOverrides.has(declarationName)) {
    assert(node.type === "FunctionDeclaration" &&
      originalSection(node.start) === "driving",
    `Driving collision function ${declarationName} changed.`);
    const text = drivingCollisionOverrides.get(declarationName);
    if (text) bodies.get("driving").push({ at: node.start, text });
    replacedDrivingCollision.add(declarationName);
    continue;
  }
  if (worldHudOverrides.has(declarationName)) {
    assert(originalSection(node.start) === "world" &&
      node.type === (declarationName === "$o0" ? "ClassDeclaration" : "FunctionDeclaration"),
    `HUD declaration ${declarationName} changed.`);
    if (declarationName === "$o0") bodies.get("world").push({ at: node.start,
      text: 'class $o0 extends HudOverlay { constructor(root, callbacks) { super(root, callbacks, `${Uo}.11`); } }' });
    replacedWorldHud.add(declarationName);
    continue;
  }
  if (declarationName === "Vg") {
    assert(node.type === "ClassDeclaration" &&
      originalSection(node.start) === "world",
    "Kart presentation view changed.");
    bodies.get("world").push({ at: node.start,
      text: "class Vg extends KartPresentationView { constructor(scene) { super(scene, kartPresentationDependencies); } }" });
    replacedKartPresentationView = true;
    continue;
  }
  if (worldPerformanceOverrides.has(declarationName)) {
    assert(originalSection(node.start) === "world" &&
      node.type === (declarationName === "ko0" ? "ClassDeclaration" : "FunctionDeclaration"),
    `Performance declaration ${declarationName} moved from world.`);
    replacedWorldPerformance.add(declarationName);
    continue;
  }
  if (appBootOverrides.has(declarationName)) {
    assert(node.type === "FunctionDeclaration" && originalSection(node.start) === "app",
      `Application boot function ${declarationName} moved.`);
    bodies.get("app").push({ at: node.start, text: appBootOverrides.get(declarationName) });
    replacedAppBoot.add(declarationName);
    continue;
  }
  if (declarationName === "Kq") {
    assert(node.type === "VariableDeclaration" && originalSection(node.start) === "formats",
      "The original PNG signature moved from formats.");
    retiredPngSignature = true;
    continue;
  }
  if (declarationName === "p2") {
    assert(node.type === "FunctionDeclaration" && originalSection(node.start) === "formats",
      "The original PNG decoder moved from formats.");
    bodies.get("formats").push({ at: node.start,
      text: "async function p2(bytes) { return decodePngRgba(bytes); }" });
    replacedPngDecoder = true;
    continue;
  }
  if (declarationName === "aK" || declarationName === "cK") {
    assert(node.type === "FunctionDeclaration" && originalSection(node.start) === "formats",
      `Texture alpha corrector ${declarationName} moved from formats.`);
    bodies.get("formats").push({ at: node.start,
      text: `function ${declarationName}(pixels, width, height) { normalizeLegacyTextureAlpha(pixels, width, height); }` });
    replacedTextureAlpha.add(declarationName);
    continue;
  }
  if (node.start >= embeddedPngInflateStart && node.start < embeddedPngInflateEnd) {
    assert(originalSection(node.start) === "formats", "Bundled PNG inflate code moved.");
    if (declarationName === "V6") {
      replacedPngInflate = true;
    }
    continue;
  }
  if (declarationName === "Jq" || declarationName === "eK" || declarationName === "nR") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "formats",
      `Texture loader or canvas controller ${declarationName} moved from formats.`);
    if (declarationName === "nR")
      bodies.get("formats").push({ at: node.start,
        text: "class nR extends CanvasHitController {}" });
    replacedFormatClasses.add(declarationName);
    continue;
  }
  if (declarationName === "AB" || declarationName === "x1") {
    assert(node.type === "FunctionDeclaration" && originalSection(node.start) === "formats",
      `Resource decoder ${declarationName} moved from formats.`);
    bodies.get("formats").push({ at: node.start, text: declarationName === "AB"
      ? "async function AB(resource, sampler, skipPngDecode) { return loadLegacyTexture(resource, sampler, skipPngDecode); }"
      : "function x1(bytes) { return parseResourceXml(bytes); }" });
    replacedResourceDecoders.add(declarationName);
    continue;
  }
  if (["rn", "vB", "yB", "ha", "Qm"].includes(declarationName)) {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "formats",
      `Scene resource class ${declarationName} moved from formats.`);
    const wrappers = {
      rn: "class rn extends ToonEnvironmentTexture {}",
      vB: "class vB extends CoatingFrameClock {}",
      yB: "class yB extends CoatingTextureManager { constructor(library, clock = new vB()) { super(library, clock); } }",
      ha: `class ha extends StageTextureBinding {
  newCoatingTextures(library) {
    let clock = this.coatingClocks.get(library);
    if (!clock) { clock = new vB(); this.coatingClocks.set(library, clock); }
    return new yB(library, clock);
  }
}`,
      Qm: "class Qm extends MorphController { constructor(source, geometry, refreshBounds) { super(source, geometry, refreshBounds, on); } }",
    };
    bodies.get("formats").push({ at: node.start, text: wrappers[declarationName] });
    replacedSceneResourceClasses.add(declarationName);
    continue;
  }
  if (node.type === "VariableDeclaration" && originalSection(node.start) === "formats" &&
      node.declarations[0]?.id?.name === "x3") {
    assert(groupNames(new Set(node.declarations.map(part => part.id.name))) ===
      "Fu, Hr, L1, M5, N9, V1, Vb, g8, k9, oi, x3",
      "The retired Billboard scratch vector layout changed.");
    retiredBillboardScratch = true;
    continue;
  }
  if (declarationName === "rj") {
    assert(node.type === "FunctionDeclaration" && originalSection(node.start) === "formats",
      "The track Billboard orientation function moved from formats.");
    bodies.get("formats").push({ at: node.start,
      text: "function rj(target, source, mode, camera) { return orientTrackBillboard(target, source, mode, camera); }" });
    replacedBillboardOrientation = true;
    continue;
  }
  if (["YH", "ZH", "nw", "Dj", "O5", "dt", "ju", "tZ", "Zq", "Mo", "xo"].includes(declarationName)) {
    assert(originalSection(node.start) === "formats" &&
      (declarationName === "ZH" ? node.type === "VariableDeclaration" :
        ["YH", "nw", "O5"].includes(declarationName) ? node.type === "ClassDeclaration" :
        node.type === "FunctionDeclaration"),
    `Format business declaration ${declarationName} changed.`);
    const wrappers = {
      YH: "class YH extends TrackObjectRegistry {}",
      ZH: "let ZH = class ZH extends TrackBinaryCursor {};",
      nw: "class nw extends CharacterColorTable {}",
      Dj: "async function Dj(library) { return loadCharacterColorTable(library, nw); }",
      O5: "class O5 extends PanelDrawCache { constructor() { super({ measure: l5, kind: XB, visible: ZB }); } }",
      dt: "function dt(commands, textures, cache) { return materializePanelDrawOrder(commands, textures, cache, panelMaterializeDependencies); }",
      ju: "function ju(root, fallback) { return characterMaterialDefaults(root, fallback); }",
      tZ: "function tZ(alpha, zbuffer) { return toonPropertyBank(alpha, zbuffer); }",
      Zq: "function Zq(material, state, enabled) { return setToonUvController(material, state, enabled); }",
      Mo: "function Mo(material, properties) { return applyToonMaterialProperties(material, properties); }",
      xo: "function xo(material, texture, environment, world, inverse, origin) { return setToonEnvironmentUniforms(material, texture, environment, world, inverse, origin); }",
    };
    bodies.get("formats").push({ at: node.start, text: wrappers[declarationName] });
    replacedFormatBusiness.add(declarationName);
    continue;
  }
  if (declarationName === "Cj" || declarationName === "Ol") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "formats",
      `Drive camera ${declarationName} moved from formats.`);
    bodies.get("formats").push({ at: node.start, text: declarationName === "Cj"
      ? "class Cj extends CameraHeightFollower { constructor() { super({ f32: n0, floatWord: g1, clampRatio: bs, smoothScalar: qc }); } }"
      : "class Ol extends DriveCameraController { constructor(processState) { super(processState, cameraMathDependencies()); } }" });
    replacedDriveCameraClasses.add(declarationName);
    continue;
  }
  if (declarationName === "on" || declarationName === "Zm") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "formats",
      `Key controller ${declarationName} moved from formats.`);
    const parent = declarationName === "on" ? "FloatKeyController" : "ColorKeyController";
    bodies.get("formats").push({ at: node.start,
      text: `class ${declarationName} extends ${parent} {
  static fromParsed(parsed) { return ${parent}.fromParsed.call(${declarationName}, parsed); }
}` });
    replacedKeyControllers.add(declarationName);
    continue;
  }
  if (declarationName === "W1") {
    assert(node.type === "FunctionDeclaration" && originalSection(node.start) === "formats",
      "The track scene assembly function moved from formats.");
    bodies.get("formats").push({ at: node.start,
      text: "async function W1(model, library, label, resolveTexture, options = {}) { return assembleTrackScene(model, library, label, resolveTexture, options, trackSceneDependencies()); }" });
    replacedTrackSceneAssembly = true;
    continue;
  }
  if (declarationName === "TR" || declarationName === "vR") {
    assert(originalSection(node.start) === "formats" &&
      (declarationName === "TR" ? node.type === "FunctionDeclaration" :
        node.type === "ClassDeclaration"),
    `Character renderer ${declarationName} moved from formats.`);
    bodies.get("formats").push({ at: node.start, text: declarationName === "TR"
      ? "async function TR(model, bodyBytes, faceSources, animation, environment, stageBinding, options = {}) { return buildCharacterScene(model, bodyBytes, faceSources, animation, environment, stageBinding, options, characterSceneDependencies()); }"
      : "class vR extends CharacterSkinGeometry {}" });
    replacedCharacterRenderers.add(declarationName);
    continue;
  }
  if (declarationName === "N6") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "formats",
      "The Toon outline controller moved from formats.");
    bodies.get("formats").push({ at: node.start,
      text: `class N6 extends ToonOutlineController {
  constructor(source, centerArgb, outerArgb, drawOutline = true, batch, cacheRigidProjection = false) {
    super(source, centerArgb, outerArgb, drawOutline, batch, cacheRigidProjection,
      toonOutlineDependencies());
  }
}` });
    replacedToonOutlineController = true;
    continue;
  }
  if (declarationName === "wK" || declarationName === "tw") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "formats",
      `Readable renderer ${declarationName} moved from formats.`);
    bodies.get("formats").push({ at: node.start,
      text: declarationName === "wK"
        ? "class wK extends ToonOutlineBatch { constructor() { super({ currentSerial: vK, configureObject: ie }); } }"
        : `class tw extends AwardPodiumScene {
  constructor(render, slots, confetti, mode) {
    super(render, slots, confetti, mode, awardPodiumDependencies());
  }
  static async load(library, options) {
    return loadAwardPodiumScene(library, options, awardPodiumLoadDependencies(),
      (render, slots, confetti, mode) => new tw(render, slots, confetti, mode));
  }
}` });
    replacedReadableFormatRenderers.add(declarationName);
    continue;
  }
  if (declarationName === "bo" || declarationName === "CB") {
    assert(node.type === "FunctionDeclaration" && originalSection(node.start) === "formats",
      `Readable material ${declarationName} moved from formats.`);
    bodies.get("formats").push({ at: node.start,
      text: declarationName === "bo"
        ? "function bo(texture, environment, paletteParts = 0) { return createToonEnvironmentMaterial(texture, environment, paletteParts); }"
        : "function CB(texture, properties, flipWinding = false, bakedNodes = false) { return createBasicTextureMaterial(texture, properties, flipWinding, bakedNodes); }" });
    replacedReadableFormatRenderers.add(declarationName);
    continue;
  }
  if (declarationName === "JW") {
    assert(node.type === "FunctionDeclaration" && originalSection(node.start) === "formats",
      "Track course graph builder moved from formats.");
    bodies.get("formats").push({ at: node.start,
      text: "function JW(objects, forceReverse) { return buildTrackCourseGraph(objects, forceReverse); }" });
    replacedCourseGraph = true;
    continue;
  }
  if (node.type === "VariableDeclaration" &&
      node.declarations[0]?.id?.name === "w9") {
    assert(originalSection(node.start) === "vehicle" &&
      groupNames(new Set(node.declarations.map((part) => part.id.name))) ===
        "N40, O40, V40, w9, z40, zt",
      "Giant kart interpolation constants changed.");
    continue;
  }
  if (declarationName === "sd" || declarationName === "pL") {
    assert(originalSection(node.start) === "vehicle" &&
      node.type === (declarationName === "pL" ? "ClassDeclaration" : "FunctionDeclaration"),
      "Giant kart effect implementation moved.");
    continue;
  }
  if (node.type === "VariableDeclaration" &&
      node.declarations.some((part) => part.id.name === "J" || part.id.name === "Q0")) {
    assert(originalSection(node.start) === "vehicle", "Packed kart state indices moved.");
    const retained = node.declarations.filter((part) => part.id.name !== "J" && part.id.name !== "Q0");
    assert(retained.length + 2 === node.declarations.length, "Packed kart state index shape changed.");
    bodies.get("vehicle").push({
      at: node.start,
      text: `${node.kind} ${retained.map((part) => source.slice(part.start, part.end)).join(", ")};`,
    });
    continue;
  }
  if (declarationName === "J40") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "vehicle",
      "Packed kart state class moved.");
    continue;
  }
  if (ghostRuntimeClassOverrides.has(declarationName)) {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "timeattack",
      `Ghost runtime class ${declarationName} moved.`);
    bodies.get("timeattack").push({
      at: node.start,
      text: ghostRuntimeClassOverrides.get(declarationName),
    });
    replacedGhostRuntimeClasses.add(declarationName);
    continue;
  }
  if (lobbyAvatarDeclarationOverrides.has(declarationName)) {
    assert((node.type === "ClassDeclaration" || node.type === "FunctionDeclaration") &&
      originalSection(node.start) === "multiplayer",
    `Lobby avatar declaration ${declarationName} moved.`);
    bodies.get("multiplayer").push({
      at: node.start,
      text: lobbyAvatarDeclarationOverrides.get(declarationName),
    });
    replacedLobbyAvatarDeclarations.add(declarationName);
    continue;
  }
  if (node.type === "VariableDeclaration" && originalSection(node.start) === "world" &&
      node.declarations.length === 2 &&
      node.declarations[0].id.name === "M9" && node.declarations[1].id.name === "Od") {
    retiredRaceDrivingHelpers = true;
    continue;
  }
  if (node.type === "VariableDeclaration" && originalSection(node.start) === "world" &&
      node.declarations.length === 1 && node.declarations[0].id.name === "h1") {
    retiredRacePeerFloat32 = true;
    continue;
  }
  if (node.type === "VariableDeclaration" && originalSection(node.start) === "world" &&
      node.declarations.length === 2 &&
      node.declarations[0].id.name === "us" && node.declarations[1].id.name === "Ri0") {
    retiredOutgoingMotionHelpers = true;
    continue;
  }
  if (raceDrivingScaleOverrides.has(declarationName)) {
    assert(originalSection(node.start) === "world", `Race driving scale ${declarationName} moved.`);
    replacedRaceDrivingScales.add(declarationName);
    continue;
  }
  if (racePeerCadenceOverrides.has(declarationName)) {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "world",
      `Race peer cadence ${declarationName} moved.`);
    if (declarationName === "Vi0") {
      bodies.get("world").push({
        at: node.start,
        text: 'class Vi0 extends RacePeerCadence { constructor(race, localId) { super(race, localId, G2(race) !== "ordinary"); } }',
      });
    }
    replacedRacePeerCadence.add(declarationName);
    continue;
  }
  if (outgoingRaceMotionOverrides.has(declarationName)) {
    assert(originalSection(node.start) === "world", `Outgoing race motion ${declarationName} moved.`);
    const wrappers = {
      FL: "function FL(mode) { return isKnownNetworkMotionMode(mode); }",
      Ii0: "function Ii0(source, tick, suspended = false) { return captureOutgoingMotion(source, tick, suspended, PL); }",
      ki0: "class ki0 extends OutgoingRaceMotionSender { constructor(source, clock, connection, routing) { super(source, clock, connection, routing, PL); } }",
    };
    bodies.get("world").push({ at: node.start, text: wrappers[declarationName] });
    replacedOutgoingRaceMotion.add(declarationName);
    continue;
  }
  if (localProfileFunctionOverrides.has(declarationName)) {
    assert(node.type === "FunctionDeclaration" && originalSection(node.start) === "ui",
      `Local profile helper ${declarationName} moved from UI.`);
    bodies.get("ui").push({ at: node.start, text: localProfileFunctionOverrides.get(declarationName) });
    replacedLocalProfileFunctions.add(declarationName);
    continue;
  }
  if (inputFunctionOverrides.has(declarationName)) {
    const replacement = inputFunctionOverrides.get(declarationName);
    assert(node.type === "FunctionDeclaration" && originalSection(node.start) === replacement.section,
      `Input helper ${declarationName} moved from ${replacement.section}.`);
    bodies.get(replacement.section).push({ at: node.start, text: replacement.text });
    replacedInputFunctions.add(declarationName);
    continue;
  }
  if (gameplayAdmissionOverrides.has(declarationName)) {
    assert(node.type === "FunctionDeclaration" && originalSection(node.start) === "library",
      `Gameplay admission helper ${declarationName} moved from library.`);
    bodies.get("library").push({ at: node.start,
      text: gameplayAdmissionOverrides.get(declarationName) });
    replacedGameplayAdmission.add(declarationName);
    continue;
  }
  if (gameplayTileOverrides.has(declarationName)) {
    assert(node.type === "VariableDeclaration" && node.declarations.length === 1 &&
      originalSection(node.start) === "library",
    `Gameplay tile list ${declarationName} moved from library.`);
    bodies.get("library").push({ at: node.start,
      text: gameplayTileOverrides.get(declarationName) });
    replacedGameplayTiles.add(declarationName);
    continue;
  }
  if (declarationName === "AL") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "driving", "AL moved from driving.");
    bodies.get("driving").push({
      at: node.start,
      // item-mode(driving): append the item-race members to AL.
      text: appendItemModeDrivingMembers(
        rewriteClassMethods(node, drivingMethodOverrides, replacedDrivingMethods)),
    });
    continue;
  }
  if (declarationName === "_L") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "world",
      "Track world constructor moved from world.");
    bodies.get("world").push({
      at: node.start,
      text: `${rewriteClassMethods(node, worldConstructorOverrides, replacedWorldConstructor)}\ninstallWorldOverrides(_L);`,
    });
    continue;
  }
  if (declarationName === "Ci0") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "world",
      "Local race runtime moved from world.");
    recordWholeClassMembers(node, localRaceMethodOverrides, replacedLocalRaceMethods);
    bodies.get("world").push({
      at: node.start,
      text: "class Ci0 extends LocalRaceController { constructor(assets, room, playerId) { super(assets, room, playerId, localRaceControllerDependencies); } }",
    });
    continue;
  }
  if (declarationName === "Ui0") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "world",
      "Active race coordinator moved from world.");
    recordWholeClassMembers(node, activeRaceMethodOverrides, replacedActiveRaceMethods);
    replacedWorldResidualDeclarations.add(declarationName);
    continue;
  }
  if (declarationName === "Bi0") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "world",
      "Remote fleet moved from world.");
    bodies.get("world").push({
      at: node.start,
      text: `class Bi0 extends RemoteFleet {
  constructor(assets, connection, now, onError, cadence) {
    super(assets, connection, now, onError, cadence, {
      createPresentation: () => new k40(),
      createGiant: () => new pL(false),
      validateGiantState: n20,
      newerSequence: No,
      resetVisible: gv,
    });
  }
}`,
    });
    replacedRemoteFleet = true;
    continue;
  }
  if (declarationName === "wf0") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "timeattack", "Stage manager moved.");
    replacedStageManager = true;
    continue;
  }
  if (multiplayerPresentationFunctionOverrides.has(declarationName)) {
    assert(node.type === "FunctionDeclaration" && originalSection(node.start) === "multiplayer",
      `Multiplayer presentation function ${declarationName} moved from multiplayer.`);
    bodies.get("multiplayer").push({ at: node.start,
      text: multiplayerPresentationFunctionOverrides.get(declarationName) });
    replacedMultiplayerPresentationFunctions.add(declarationName);
    continue;
  }
  if (multiplayerSupportFunctionOverrides.has(declarationName)) {
    assert(node.type === "FunctionDeclaration" && originalSection(node.start) === "multiplayer",
      `Multiplayer support function ${declarationName} moved from multiplayer.`);
    bodies.get("multiplayer").push({ at: node.start,
      text: multiplayerSupportFunctionOverrides.get(declarationName) });
    replacedMultiplayerSupportFunctions.add(declarationName);
    continue;
  }
  if (node.type === "VariableDeclaration" && node.declarations[0]?.id?.name === "jo") {
    assert(originalSection(node.start) === "multiplayer" &&
      groupNames(node.declarations.map(declaration => declaration.id.name)) ===
      groupNames(["jo", "ly", "nm", "G7", "B7", "R7", "uy", "C6"]),
    "The multiplayer account UI declaration group changed.");
    bodies.get("multiplayer").push({ at: node.start, text: `const jo = () => currentMultiplayerOrigin(() => window.location.href, ay),
  ly = action => multiplayerAccountEndpoint(action, () => window.location.href, Ko),
  nm = () => multiplayerAuthHeaders(jo, xF),
  G7 = (...buttons) => styleAccountButtons(...buttons),
  B7 = accountOverlayStyle,
  R7 = accountPanelStyle,
  uy = accountErrorMessages,
  C6 = error => formatAccountServiceError(error, uy);` });
    replacedMultiplayerAccountUiGroup = true;
    continue;
  }
  if (lifecycleOverrides.has(declarationName)) {
    assert(originalSection(node.start) === "timeattack", `Time attack lifecycle declaration ${declarationName} moved.`);
    replacedLifecycle.add(declarationName);
    continue;
  }
  if (declarationName === "ql0") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "multiplayer", "Ready controller moved.");
    recordWholeClassMembers(node, readyMethodOverrides, replacedReadyMethods);
    bodies.get("multiplayer").push({
      at: node.start,
      text: "class ql0 extends ReadyController { constructor(host) { super(host, readyControllerServices); } }",
    });
    replacedFullMultiplayerClasses.add("ql0");
    continue;
  }
  if (declarationName === "jl0") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "multiplayer",
      "Gameplay input queue moved from multiplayer.");
    bodies.get("multiplayer").push({
      at: node.start,
      text: `class jl0 extends GameplayInputQueue {
  constructor() { super({ keyMap: Br, resolveActions: xl, editableTarget: yf }); }
}`,
    });
    replacedGameplayInputQueue = true;
    continue;
  }
  if (declarationName === "Ql0") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "multiplayer",
      "Gamepad edge poller moved from multiplayer.");
    bodies.get("multiplayer").push({
      at: node.start,
      text: `class Ql0 extends GamepadEdgePoller {
  constructor() { super({ pressedControls: Hg, bindings: ut, unmappedControl: Ga }); }
}`,
    });
    replacedGamepadPoller = true;
    continue;
  }
  if (declarationName === "ll0") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "multiplayer",
      "Race start coordinator moved from multiplayer.");
    bodies.get("multiplayer").push({
      at: node.start,
      text: `class ll0 extends RaceStartCoordinator {
  constructor(options) {
    super(options, {
      gameplay: G2,
      sameRoadblock: oR,
      sameLte: Nw,
      sameRp: t7,
      toLocalStartTick: Y3,
    });
  }
}`,
    });
    replacedRaceStartCoordinator = true;
    continue;
  }
  if (declarationName === "Ml0") {
    assert(node.type === "FunctionDeclaration" && originalSection(node.start) === "multiplayer",
      "Lobby preview camera moved from multiplayer.");
    bodies.get("multiplayer").push({ at: node.start,
      text: "function Ml0(team, reverse, linkedCharacterId = 0, alwaysLink = false, kartId = 0) { return createLobbyAvatarCamera(lobbyAvatarCameraDependencies, team, reverse, linkedCharacterId, alwaysLink, kartId); }" });
    replacedLobbyPreviewDeclarations.add("Ml0");
    continue;
  }
  if (declarationName === "ay") {
    assert(node.type === "FunctionDeclaration" && originalSection(node.start) === "multiplayer",
      "Multiplayer backend origin moved from multiplayer.");
    bodies.get("multiplayer").push({ at: node.start,
      text: "function ay(pageUrl) { return multiplayerBackendOrigin(pageUrl, typeof window > 'u' ? undefined : window.__KART_MULTIPLAYER_CONFIG__, ml0?.VITE_MULTIPLAYER_BACKEND_ORIGIN); }" });
    replacedMultiplayerAccountDeclarations.add("ay");
    continue;
  }
  if (declarationName === "Ko") {
    assert(node.type === "FunctionDeclaration" && originalSection(node.start) === "multiplayer",
      "Multiplayer endpoint moved from multiplayer.");
    bodies.get("multiplayer").push({ at: node.start,
      text: "function Ko(endpoint, pageUrl) { return multiplayerEndpoint(endpoint, pageUrl, typeof window > 'u' ? undefined : window.__KART_MULTIPLAYER_CONFIG__, ml0?.VITE_MULTIPLAYER_BACKEND_ORIGIN); }" });
    replacedMultiplayerAccountDeclarations.add("Ko");
    continue;
  }
  if (declarationName === "Xo") {
    assert(node.type === "FunctionDeclaration" && originalSection(node.start) === "multiplayer",
      "Multiplayer account request moved from multiplayer.");
    bodies.get("multiplayer").push({ at: node.start,
      text: "async function Xo(action, fields) { return requestMultiplayerAccount(accountRequestDependencies, action, fields); }" });
    replacedMultiplayerAccountDeclarations.add("Xo");
    continue;
  }
  if (declarationName === "CF") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "multiplayer",
      "Account login dialog moved from multiplayer.");
    bodies.get("multiplayer").push({ at: node.start,
      text: "class CF extends AccountLoginDialog { constructor(root, signal) { super(root, signal, accountLoginDependencies); } }" });
    replacedMultiplayerAccountDeclarations.add("CF");
    continue;
  }
  if (declarationName === "yl0") {
    assert(node.type === "FunctionDeclaration" && originalSection(node.start) === "multiplayer",
      "Multiplayer account entry moved from multiplayer.");
    bodies.get("multiplayer").push({ at: node.start,
      text: "async function yl0(root, signal) { return enterMultiplayerAccount(accountEntryDependencies, root, signal); }" });
    replacedMultiplayerAccountDeclarations.add("yl0");
    continue;
  }
  if (declarationName === "PT") {
    assert(node.type === "FunctionDeclaration" && originalSection(node.start) === "multiplayer",
      "Guest nickname chooser moved from multiplayer.");
    bodies.get("multiplayer").push({ at: node.start,
      text: "async function PT(root, previousName, signal, forcePrompt = false) { return chooseGuestNickname(guestNicknameDependencies, root, previousName, signal, forcePrompt); }" });
    replacedMultiplayerAccountDeclarations.add("PT");
    continue;
  }
  if (declarationName === "Al0") {
    assert(node.type === "FunctionDeclaration" && originalSection(node.start) === "multiplayer",
      "Signed-in account chooser moved from multiplayer.");
    bodies.get("multiplayer").push({ at: node.start,
      text: "function Al0(root, account, signal) { return chooseSignedInAccount(accountChoiceDependencies, root, account, signal); }" });
    replacedMultiplayerAccountDeclarations.add("Al0");
    continue;
  }
  if (declarationName === "NT") {
    assert(node.type === "FunctionDeclaration" && originalSection(node.start) === "multiplayer",
      "Room channel names moved from multiplayer.");
    bodies.get("multiplayer").push({ at: node.start,
      text: "function NT(mode) { return roomChannelNames(mode, H6, lw); }" });
    replacedRoomOptionFunctions.add("NT");
    continue;
  }
  if (declarationName === "Ol0") {
    assert(node.type === "FunctionDeclaration" && originalSection(node.start) === "multiplayer",
      "Room channel reverse lookup moved from multiplayer.");
    bodies.get("multiplayer").push({ at: node.start,
      text: "function Ol0(value, channels = H6) { return roomChannelKey(value, channels); }" });
    replacedRoomOptionFunctions.add("Ol0");
    continue;
  }
  if (declarationName === "zl0") {
    assert(node.type === "FunctionDeclaration" && originalSection(node.start) === "multiplayer",
      "Room dropdown template moved from multiplayer.");
    bodies.get("multiplayer").push({ at: node.start,
      text: "function zl0(combo, template, values = Object.values(H6)) { return roomStyleDropdown(combo, template, values, roomDropdownDependencies); }" });
    replacedRoomOptionFunctions.add("zl0");
    continue;
  }
  if (declarationName === "b1") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "multiplayer",
      "Lobby dialog class moved from multiplayer.");
    bodies.get("multiplayer").push({ at: node.start,
      text: rewriteClassMethods(node, lobbyDialogMethodOverrides,
        replacedLobbyDialogMethods) });
    continue;
  }
  if (declarationName === "xl0") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "multiplayer",
      "Lobby emotion audio moved from multiplayer.");
    bodies.get("multiplayer").push({ at: node.start,
      text: "class xl0 extends LobbyEmotionAudio { constructor(library, context, failed) { super(library, context, failed, lobbyEmotionAudioDependencies); } }" });
    replacedLobbyPreviewDeclarations.add("xl0");
    continue;
  }
  if (declarationName === "Tl0") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "multiplayer",
      "Lobby avatar previews moved from multiplayer.");
    bodies.get("multiplayer").push({ at: node.start,
      text: "class Tl0 extends LobbyAvatarPreviews { constructor(library, changed, failed, emotions = [], audioContext) { super(library, changed, failed, emotions, audioContext, lobbyAvatarPreviewDependencies); } }" });
    replacedLobbyPreviewDeclarations.add("Tl0");
    continue;
  }
  if (declarationName === "dy") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "multiplayer",
      "Lobby countdown media moved from multiplayer.");
    bodies.get("multiplayer").push({ at: node.start, text: `class dy extends LobbyCountdownMedia {
  constructor(digits, soundUrl) { super(digits, soundUrl, lobbyCountdownMediaDependencies); }
  static async load(library) { return super.load(library, lobbyCountdownMediaDependencies); }
}` });
    replacedLobbyPreviewDeclarations.add("dy");
    continue;
  }
  if (declarationName === "LT") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "multiplayer", "LT moved from multiplayer.");
    recordWholeClassMembers(node, multiplayerMethodOverrides, replacedRaceSessionMethods);
    bodies.get("multiplayer").push({
      at: node.start,
      text: `class LT extends MultiplayerClientState {
  constructor() { super(multiplayerClientStateFactories); }
${[...multiplayerMethodOverrides.values()].join("\n")}
}`,
    });
    replacedFullMultiplayerClasses.add("LT");
    continue;
  }
  if (declarationName === "Wl0") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "multiplayer",
      "Lobby controller moved from multiplayer.");
    recordWholeClassMembers(node, lobbyActionMethodOverrides, replacedLobbyActions);
    assert(node.body.body.some(member => member.kind === "get" && member.key?.name === "hasModal") &&
      node.body.body.some(member => member.kind === "get" && member.key?.name === "isInRoom"),
    "Lobby shell accessors changed.");
    bodies.get("multiplayer").push({
      at: node.start,
      text: "class Wl0 extends MultiplayerLobbyController { constructor(options) { super(options, multiplayerLobbyServices); } }",
    });
    replacedFullMultiplayerClasses.add("Wl0");
    continue;
  }
  if (declarationName === "py") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "multiplayer",
      "Lobby room view moved from multiplayer.");
    recordWholeClassMembers(node, lobbyRoomMethodOverrides, replacedLobbyRoomMethods);
    recordWholeClassMembers(node, lobbyRoomFieldOverrides, replacedLobbyRoomFields, "ClassProperty");
    bodies.get("multiplayer").push({
      at: node.start,
      text: `class py extends LobbyRoomController {
  constructor(room, playerId, actions, library) {
    super(room, playerId, actions, library, lobbyRoomControllerServices);
  }
  static async load(library, root, room, playerId, actions, audioContext) {
    return loadLobbyRoomController(
      (snapshot, id, callbacks, resources) => new py(snapshot, id, callbacks, resources),
      library, root, room, playerId, actions, audioContext, lobbyRoomControllerServices);
  }
}`,
    });
    replacedFullMultiplayerClasses.add("py");
    continue;
  }
  if (declarationName === "gy") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "multiplayer",
      "Multiplayer race loading screen moved from multiplayer.");
    bodies.get("multiplayer").push({
      at: node.start,
      text: "class gy extends RaceLoadingScreen { static async load(library, root) { return super.load(library, root, raceLoadingScreenAssets); } }",
    });
    replacedRaceLoadingScreen = true;
    continue;
  }
  if (["S4", "b7", "Fv", "Bv"].includes(declarationName)) {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "world",
      `World owner ${declarationName} moved out of its release section.`);
    const replacements = {
      S4: `class S4 extends FlyingPetPresentation {
  constructor(race) { super(race, flyingPetPresentationDependencies); }
  static async preview(options, atOrigin = false) {
    return new S4().loadPreview(options, atOrigin);
  }
  static async race(options) {
    if (options.role !== "local") return;
    return new S4(options).loadRace(options);
  }
}`,
      b7: `class b7 extends TrackEventEffectPool {
  constructor(library, mount, environment, binding, audioContext) {
    super(library, mount, environment, binding, audioContext, trackEventEffectDependencies);
  }
  static async load(library, projections, mount, environment, binding, audioContext) {
    return new b7(library, mount, environment, binding, audioContext)
      .loadEvents(projections);
  }
}`,
      Fv: `class Fv extends GiantRaceEffects {
  constructor(library, world, options, audio, stage) {
    super(library, world, options, audio, stage, giantRaceDependencies);
  }
  static async load(library, world, actors, options, audio, stage) {
    return new Fv(library, world, options, audio, stage).loadActors(actors);
  }
}`,
      Bv: `class Bv extends RoadblockResultPresentation {
  constructor(stand, confetti, reversePodium) {
    super(stand, confetti, reversePodium, roadblockResultPresentationDependencies);
  }
  static async load(library, raceAssets) {
    const parts = await loadRoadblockResultParts(
      library, raceAssets, roadblockResultPresentationDependencies);
    return new Bv(parts.stand, parts.confetti, parts.reversePodium);
  }
}`,
    };
    bodies.get("world").push({ at: node.start, text: replacements[declarationName] });
    replacedWorldLargeDeclarations.add(declarationName);
    continue;
  }
  if (declarationName === "Hs0") {
    assert(node.type === "FunctionDeclaration" && originalSection(node.start) === "world",
      "Multiplayer race loader moved out of its release section.");
    bodies.get("world").push({ at: node.start,
      text: "function Hs0(host) { return createMultiplayerRaceLoader(host, multiplayerRaceLoaderDependencies); }" });
    replacedWorldLargeDeclarations.add(declarationName);
    continue;
  }
  if (declarationName === "jr0") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "world",
      "Multiplayer race presenter moved from world.");
    bodies.get("world").push({
      at: node.start,
      text: rewriteClassMethods(node, multiplayerPresenterMethodOverrides,
        replacedMultiplayerPresenterMethods),
    });
    continue;
  }
  if (declarationName === "Yr0") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "world",
      "Multiplayer race session moved from world.");
    bodies.get("world").push({
      at: node.start,
      text: rewriteClassMethods(node, racePresentationSessionMethodOverrides,
        replacedRacePresentationSessionMethods),
    });
    continue;
  }
  if (declarationName === "Dv") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "world",
      "In-race chat moved from world.");
    bodies.get("world").push({ at: node.start, text: `class Dv extends RaceChatOverlay {
  constructor(root, connection, status, frame, font, emotions) {
    super(root, connection, status, frame, font, emotions, raceChatDependencies);
  }
  static async load(library, root, connection, status) {
    return super.load(library, root, connection, status, raceChatDependencies);
  }
}` });
    replacedRaceChatOverlay = true;
    continue;
  }
  if (declarationName === "M7") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "world",
      "In-race track card moved from world.");
    bodies.get("world").push({
      at: node.start,
      text: rewriteClassMethods(node, trackInfoCardMethodOverrides,
        replacedTrackInfoCardMethods),
    });
    continue;
  }
  if (declarationName === "my") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "multiplayer",
      "RP scene preview moved from multiplayer.");
    bodies.get("multiplayer").push({ at: node.start, text: `class my extends RpScenePreview {
  constructor() { super(rpScenePreviewDependencies); }
  static async load(library, definition, kartItem) {
    return super.load(library, definition, kartItem, rpScenePreviewDependencies);
  }
}` });
    replacedRpScenePreview = true;
    continue;
  }
  if (declarationName === "fy") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "multiplayer",
      "Track change notice moved from multiplayer.");
    bodies.get("multiplayer").push({ at: node.start, text: `class fy extends TrackChangeNotice {
  constructor(room, playerId, caption, definition, width, height, messageHeight) {
    super(room, playerId, caption, definition, width, height, messageHeight, trackChangeNoticeDependencies);
  }
  static async load(library, root, room, playerId) {
    return super.load(library, root, room, playerId, trackChangeNoticeDependencies);
  }
}` });
    replacedMultiplayerNoticeClasses.add("fy");
    continue;
  }
  if (declarationName === "wy") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "multiplayer",
      "RP result sound moved from multiplayer.");
    bodies.get("multiplayer").push({ at: node.start, text: `class wy extends RpResultAudio {
  constructor(context, buffers) { super(context, buffers, rpResultAudioDependencies); }
  static async load(library, context) {
    return super.load(library, context, rpResultAudioDependencies);
  }
}` });
    replacedMultiplayerNoticeClasses.add("wy");
    continue;
  }
  if (declarationName === "vy") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "multiplayer",
      "RP result notice moved from multiplayer.");
    bodies.get("multiplayer").push({ at: node.start, text: `class vy extends RpResultNotice {
  constructor(lucky, box, sparkle) {
    super(lucky, box, sparkle, rpResultNoticeDependencies);
  }
  static async load(library, root, race, playerId, audioContext) {
    return super.load(library, root, race, playerId, audioContext, rpResultNoticeDependencies);
  }
}` });
    replacedMultiplayerNoticeClasses.add("vy");
    continue;
  }
  if (declarationName === "yy") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "multiplayer",
      "Roadblock mission notice moved from multiplayer.");
    bodies.get("multiplayer").push({ at: node.start, text: `class yy extends RoadblockMissionNotice {
  constructor() { super(roadblockMissionDependencies); }
  static async load(library, root, race, playerId) {
    return super.load(library, root, race, playerId, roadblockMissionDependencies);
  }
}` });
    replacedMultiplayerNoticeClasses.add("yy");
    continue;
  }
  if (declarationName === "Sw") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "library",
      "Resource library moved from library.");
    bodies.get("library").push({
      at: node.start,
      text: rewriteClassMethods(node, swMethodOverrides, replacedSwMethods),
    });
    continue;
  }
  if (declarationName === "tI") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "library",
      "Race HUD moved from library.");
    recordWholeClassMembers(node, raceHudBoostMethodOverrides,
      replacedRaceHudBoostMethods);
    bodies.get("library").push({
      at: node.start,
      text: "class tI extends RaceHudController { constructor(definition, minimap) { super(definition, minimap, raceHudDependencies); } }",
    });
    continue;
  }
  if (declarationName === "Ew") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "library",
      "Lobby list view moved from library.");
    bodies.get("library").push({
      at: node.start,
      text: rewriteClassMethods(node, lobbyListDrawMethodOverrides, replacedLobbyListDrawMethods),
    });
    continue;
  }
  if (declarationName === "te") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "library",
      "Multiplayer window moved from library.");
    assert(node.body.body.filter(member => member.type === "ClassMethod").length === 21,
      "The multiplayer window class changed in the release source.");
    recordWholeClassMembers(node, multiplayerWindowAssetMethodOverrides,
      replacedMultiplayerWindowAssetMethods);
    assert(!replacedMultiplayerWindowView, "Duplicate multiplayer window class.");
    replacedMultiplayerWindowView = true;
    bodies.get("library").push({
      at: node.start,
      text: `class te extends MultiplayerWindowView {
  constructor(options) { super(options, multiplayerWindowViewDependencies); }
}`,
    });
    continue;
  }
  if (declarationName === "E7") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "ui",
      "Garage live panels moved from UI.");
    assert(node.body.body.filter(member => member.type === "ClassMethod").length === 42,
      "The garage live panel class changed in the release source.");
    assert(!replacedGarageLivePanels, "Duplicate garage live panel class.");
    replacedGarageLivePanels = true;
    bodies.get("ui").push({ at: node.start, text: `class E7 extends GarageLivePanels {
  constructor(library, environment, binding, onReady, characterSize,
    previewSize, previewCamera, mode = "preview") {
    super(library, environment, binding, onReady, characterSize,
      previewSize, previewCamera, mode, garageLivePanelDependencies);
  }
  static async load(library, environment, binding, onReady, characterSize,
    previewSize, previewCamera, mode = "preview") {
    return new E7(library, environment, binding, onReady, characterSize,
      previewSize, previewCamera, mode);
  }
}` });
    continue;
  }
  if (declarationName === "_7") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "ui",
      "Track picker moved from UI.");
    recordWholeClassMembers(node, trackPickerMethodOverrides,
      replacedTrackPickerMethods);
    bodies.get("ui").push({
      at: node.start,
      text: "const _7 = createTrackPickerWindowClass(trackPickerWindowDependencies);",
    });
    continue;
  }
  if (declarationName === "ty") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "ui",
      "Ready view moved from UI.");
    bodies.get("ui").push({ at: node.start, text: rewriteReadyView(node) });
    continue;
  }
  if (declarationName === "ny") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "ui",
      "Ready vehicle preview moved from UI.");
    bodies.get("ui").push({
      at: node.start,
      text: rewriteClassMethods(node, readyVehiclePreviewMethodOverrides,
        replacedReadyVehiclePreviewMethods),
    });
    continue;
  }
  if (declarationName === "oy") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "ui",
      "Settings view moved from UI.");
    recordWholeClassMembers(node, settingsMethodOverrides, replacedSettingsMethods);
    bodies.get("ui").push({
      at: node.start,
      text: "const oy = createSettingsWindowClass(settingsWindowDependencies);",
    });
    continue;
  }
  if (declarationName === "C7") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "ui",
      "Garage selector moved from UI.");
    recordWholeClassMembers(node, garageSelectionMethodOverrides,
      replacedGarageSelectionMethods);
    bodies.get("ui").push({
      at: node.start,
      text: `const garageSelectionViewOps = {
  get document() { return document; }, get window() { return window; },
  get ResizeObserver() { return ResizeObserver; },
  requestAnimationFrame: callback => requestAnimationFrame(callback),
  cancelAnimationFrame: id => cancelAnimationFrame(id),
  get performance() { return performance; },
  get CanvasDrawing() { return Ma0; }, Scrollbar: b6, TouchSwipe: WP,
  get touchSwipeConfig() { return jv; },
  get touchSwipeThreshold() { return Xv; },
  buildWindows: sF, gridStep: i4, draftProfile: aT,
  normalizeKartKey: of, kartAppearancePath: t80, appearanceMatches: xw,
  loadPanels: (...args) => E7.load(...args), cardRect: yl,
  validateKart: pT, validateCharacter: cf, loadAssets: u80,
  attribute: T, child: Ae, drawFrame: C9, drawText: kn,
  frameContent: E9, captionRect: f3, layoutRect: V0,
  drawImage: uf, drawCardImage: m80, drawScrollbar: Kv,
  spriteSourceX: Ca0, itemKey: sf, hoverState: st, drawIcon: ct,
  get equipmentSlot() { return Ya0; },
  kartProgression: p5, engineFamily: KP, engineLevelText: Ka0,
  classicLevelText: ja0, drawLabel: m9, measureText: ve,
  tooltipRect: rF, noticeLayout: Wo, drawNoticePanel: qP,
  resizeCanvas: p3, pixelRatio: xe, itemGrid: $P,
  positionInput: aw, pointInRect: Oe, moveHover: Xa0, playClick: Mc,
};
const GarageSelectionViewBase = createGarageSelectionViewClass(garageSelectionViewOps);
class C7 extends GarageSelectionViewBase {
${[...garageSelectionMethodOverrides.values()].join("\n")}
}`,
    });
    continue;
  }
  if (declarationName === "Bf0") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "app", "Application controller moved.");
    bodies.get("app").push({
      at: node.start,
      text: rewriteApplication(node),
    });
    continue;
  }
  if (declarationName === "Af0") {
    assert(node.type === "FunctionDeclaration" && originalSection(node.start) === "timeattack",
      "Solo race publisher moved from time attack.");
    bodies.get("timeattack").push({
      at: node.start,
      text: "async function Af0(host, selection, coatingStage) { return publishSoloRace(host, selection, coatingStage, { createLifecycle: elapsedMs => new GF(elapsedMs), recordKey: (entry, options) => Pt.recordKey(entry, options), raceParam: yf0 }); }",
    });
    replacedSoloRacePublisher = true;
    continue;
  }
  if (declarationName === "Rh0" || declarationName === "Lh0") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "timeattack",
      "Ghost KSV exporter moved from time attack.");
    bodies.get("timeattack").push({
      at: node.start,
      text: rewriteClassMethods(node, ghostKsvClassMethodOverrides,
        replacedGhostKsvClassMethods),
    });
    continue;
  }
  if (ghostKsvFunctionOverrides.has(declarationName)) {
    assert(node.type === "FunctionDeclaration" && originalSection(node.start) === "timeattack",
      "Ghost KSV conversion moved from time attack.");
    assert(!replacedGhostKsvFunctions.has(declarationName),
      `Duplicate Ghost KSV function ${declarationName}.`);
    bodies.get("timeattack").push({
      at: node.start,
      text: ghostKsvFunctionOverrides.get(declarationName),
    });
    replacedGhostKsvFunctions.add(declarationName);
    continue;
  }
  if (declarationName === "Nh0") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "timeattack",
      "Time attack record service moved.");
    bodies.get("timeattack").push({
      at: node.start,
      text: rewriteClassMethods(node, recordServiceMethodOverrides,
        replacedRecordServiceMethods),
    });
    continue;
  }
  if (declarationName === "Pt") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "timeattack",
      "Ghost record library moved from timeattack.");
    bodies.get("timeattack").push({
      at: node.start,
      text: rewriteClassMethods(node, ghostRecordLibraryMethodOverrides,
        replacedGhostRecordLibraryMethods),
    });
    continue;
  }
  if (declarationName === "vd0") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "timeattack",
      "Ghost menu bridge moved from timeattack.");
    bodies.get("timeattack").push({
      at: node.start,
      text: rewriteClassMethods(node, ghostMenuBridgeMethodOverrides,
        replacedGhostMenuBridgeMethods),
    });
    continue;
  }
  if (declarationName === "Xd0") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "timeattack",
      "Ghost visual moved from timeattack.");
    bodies.get("timeattack").push({
      at: node.start,
      text: rewriteClassMethods(node, ghostVisualMotionMethodOverrides,
        replacedGhostVisualMotionMethods),
    });
    continue;
  }
  if (declarationName === "P7") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "timeattack",
      "Race BGM owner moved from timeattack.");
    bodies.get("timeattack").push({
      at: node.start,
      text: rewriteClassMethods(node, raceBgmPlaybackMethodOverrides,
        replacedRaceBgmPlaybackMethods),
    });
    continue;
  }
  if (declarationName === "n60") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "timeattack",
      "Time attack input bridge moved from timeattack.");
    bodies.get("timeattack").push({
      at: node.start,
      text: rewriteClassMethods(node, timeAttackInputBridgeMethodOverrides,
        replacedTimeAttackInputBridgeMethods),
    });
    continue;
  }
  if (declarationName === "Yh0") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "timeattack",
      "Ghost smooth sampler moved from timeattack.");
    bodies.get("timeattack").push({
      at: node.start,
      text: "class Yh0 extends GhostSmoothSampler { constructor(record) { super(record, ghostSmoothSamplerDependencies); } }",
    });
    replacedGhostSmoothSampler = true;
    continue;
  }
  if (declarationName === "if0") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "timeattack",
      "Ghost asset builder moved from timeattack.");
    bodies.get("timeattack").push({
      at: node.start,
      text: rewriteClassMethods(node, ghostAssetBuilderMethodOverrides,
        replacedGhostAssetBuilderMethods),
    });
    continue;
  }
  if (declarationName === "df0") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "timeattack", "Time attack stage moved.");
    bodies.get("timeattack").push({
      at: node.start,
      text: rewriteClassMethods(node, timeAttackStageMethodOverrides, replacedTimeAttackStageMethods),
    });
    continue;
  }
  if (declarationName === "vf0") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "timeattack", "Presenter moved.");
    recordWholeClassMembers(node, presenterMethodOverrides, replacedPresenterMethods);
    bodies.get("timeattack").push({
      at: node.start,
      text: "class vf0 extends PresentationController { constructor(host, previousRenderTime) { super(host, previousRenderTime, presentationControllerServices); } }",
    });
    continue;
  }
  if (declarationName === "zo0") {
    assert(node.type === "FunctionDeclaration" && originalSection(node.start) === "world",
      "Server control event parser moved from world.");
    bodies.get("world").push({
      at: node.start,
      text: "function zo0(value) { return parseServerEvent(value, { validRoom: bP, validChannel: W6, validGameplay: To, validRandomTrackCode: code => !!X6(code) }); }",
    });
    replacedServerEventParser = true;
    continue;
  }
  if (declarationName === "bP") {
    assert(node.type === "FunctionDeclaration" && originalSection(node.start) === "world",
      "Room validator moved from world.");
    bodies.get("world").push({
      at: node.start,
      text: "function bP(value) { return isValidRoomSnapshot(value); }",
    });
    replacedRoomValidator = true;
    continue;
  }
  if (inputOverrides.has(declarationName)) {
    assert(originalSection(node.start) === "vendor", `Input override ${declarationName} moved.`);
    replacedInputs.add(declarationName);
    continue;
  }
  if (resourceOverrides.has(declarationName)) {
    assert(originalSection(node.start) === "world", `Resource override ${declarationName} moved.`);
    replacedResources.add(declarationName);
    continue;
  }
  if (ghostOverrides.has(declarationName)) {
    assert(originalSection(node.start) === "timeattack", `Ghost override ${declarationName} moved.`);
    replacedGhosts.add(declarationName);
    continue;
  }
  if (ksvOverrides.has(declarationName)) {
    assert(originalSection(node.start) === "timeattack", `KSV override ${declarationName} moved.`);
    replacedKsv.add(declarationName);
    bodies.get("timeattack").push({
      at: node.start,
      text: declarationName === "Ff"
        ? "function Ff(bytes, zCeiling) { return decodeKsvFile(bytes, zCeiling, fD); }"
        : "function ph0(recording, zCeiling) { return encodeKsvFile(recording, zCeiling, fD); }",
    });
    continue;
  }
  if (retiredGhostHelpers.has(declarationName)) {
    assert(originalSection(node.start) === "timeattack", `Retired Ghost helper ${declarationName} moved.`);
    retiredGhosts.add(declarationName);
    continue;
  }
  if (physicsOverrides.has(declarationName)) {
    assert(originalSection(node.start) === (declarationName === "r7" ? "library" : "vehicle"),
      `Physics override ${declarationName} moved.`);
    replacedPhysics.add(declarationName);
    if (declarationName === "JI") bodies.get("vehicle").push({
      at: node.start,
      text: "function JI(vehicle, speed, body, version = \"国服\") { return physicsCatalog.createVehicleParameters(vehicle, speed, body, version); }",
    });
    if (declarationName === "ek") bodies.get("vehicle").push({
      at: node.start,
      text: "const physicsCatalog = new VehicleSpecCatalog(mS, wS, hn);\nfunction ek(itemId, speed, version = \"国服\") { return physicsCatalog.lookup(itemId, speed, version); }",
    });
    continue;
  }
  if (motionCodecOverrides.has(declarationName)) {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "vehicle",
      `Motion codec override ${declarationName} moved.`);
    replacedMotionCodec.add(declarationName);
    continue;
  }
  if (vehicleBusinessOverrides.has(declarationName)) {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "vehicle",
      `Vehicle business class ${declarationName} moved.`);
    if (declarationName === "_r") {
      bodies.get("vehicle").push({
        at: node.start,
        text: `class _r extends CharacterMotionSequencer {
  constructor(source, motions, initialState) {
    super(source, motions, initialState, {
      prepare: G10, sample: ts, cloneSample: Rh, faceAt: D8,
      advanceSamples: uk, writePose: il, resetClip: V8,
      sampleRoot: hk, float: f0, blendSample: P10,
    });
  }
}`,
      });
    }
    replacedVehicleBusiness.add(declarationName);
    continue;
  }
  if (vehicleAnimationSelectorOverrides.has(declarationName)) {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "vehicle",
      `Vehicle animation selector ${declarationName} moved.`);
    const wrappers = {
      ag: `class ag extends StandardMotionController {
  constructor(source, motions, reverse = false) {
    super(source, motions, reverse, {
      createSequence: (clip, mapping, initial) => new _r(clip, mapping, initial),
      buildMotions: M10, selectDrivingMotion: ck,
    });
  }
}`,
      sk: `class sk extends LinkedMotionController {
  constructor(source, motions, reverse, alwaysLinked) {
    super(source, motions, reverse, alwaysLinked, {
      createSequence: (clip, mapping, initial) => new _r(clip, mapping, initial),
      buildMotions: x10, selectDrivingMotion: T10,
    });
  }
}`,
      ok: `class ok extends MappedMotionController {
  constructor(source, motions, reverse = false) {
    super(source, motions, reverse, {
      createSequence: (clip, mapping, initial) => new _r(clip, mapping, initial),
      buildMotions: S10, selectDrivingMotion: ck, mapState: E10,
    });
  }
}`,
    };
    bodies.get("vehicle").push({ at: node.start, text: wrappers[declarationName] });
    replacedVehicleAnimationSelectors.add(declarationName);
    continue;
  }
  if (vehicleAnimationActionOverrides.has(declarationName)) {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "vehicle",
      `Vehicle animation action ${declarationName} moved.`);
    const wrappers = {
      b10: "class b10 extends ResultMotionController { constructor(gameplay, base, motions, optional) { super(gameplay, base, motions, optional, animationActionDependencies); } }",
      bS: "class bS extends SingleActionMotionController { constructor(base, motion, action) { super(base, motion, action, animationActionDependencies); } }",
      rk: "class rk extends ActionSetMotionController { constructor(base, special, extras) { super(base, special, extras, animationActionDependencies); } }",
    };
    bodies.get("vehicle").push({ at: node.start, text: wrappers[declarationName] });
    replacedVehicleAnimationActions.add(declarationName);
    continue;
  }
  if (vehicleCoinSourceOverrides.has(declarationName)) {
    assert(node.type === "FunctionDeclaration" && originalSection(node.start) === "vehicle",
      `Vehicle coin source ${declarationName} moved.`);
    bodies.get("vehicle").push({ at: node.start, text: vehicleCoinSourceOverrides.get(declarationName) });
    replacedVehicleCoinSources.add(declarationName);
    continue;
  }
  if (vehicleCoinOwnerOverrides.has(declarationName)) {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "vehicle",
      `Vehicle coin owner ${declarationName} moved.`);
    bodies.get("vehicle").push({
      at: node.start,
      text: "class jw extends TrackCoinOwner { static load(library, source, environment, stageBinding, context) { return super.load(library, source, environment, stageBinding, context, coinOwnerOps); } }",
    });
    replacedVehicleCoinOwners.add(declarationName);
    continue;
  }
  if (vehicleVisualOwnerOverrides.has(declarationName)) {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "vehicle",
      `Vehicle visual owner ${declarationName} moved.`);
    const wrappers = {
      tv: `class tv extends ChargerEffect {
  static load(library, parent, environment, stageBinding) {
    return super.load(library, parent, environment, stageBinding, chargerEffectOps);
  }
}`,
      d7: `class d7 extends CoatingOwner {
  static load(library, scene, visual, body, generation, selection, textures) {
    return super.load(library, scene, visual, body, generation, selection, textures, coatingOwnerOps);
  }
}`,
    };
    bodies.get("vehicle").push({ at: node.start, text: wrappers[declarationName] });
    replacedVehicleVisualOwners.add(declarationName);
    continue;
  }
  if (vehicleWeatherOverrides.has(declarationName)) {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "vehicle",
      `Vehicle weather effect ${declarationName} moved.`);
    const wrappers = {
      sL: "class sL extends RainScreenEffect { constructor(random, rainOnStart) { super(random, rainOnStart, ca); } }",
      y7: "class y7 extends RainAudioCue { constructor(context, cue) { super(context, cue, S9); } static load(library, context) { return loadRainAudioCue(library, context, Q9, (audioContext, buffer) => new y7(audioContext, buffer)); } }",
      A7: "class A7 extends SnowScreenEffect { constructor(random, texture) { super(random, texture, ca); } static load(library, random) { return loadSnowScreenEffect(library, random, p2, (source, texture) => new A7(source, texture)); } }",
    };
    bodies.get("vehicle").push({ at: node.start, text: wrappers[declarationName] });
    replacedVehicleWeather.add(declarationName);
    continue;
  }
  if (vehicleRouteFunctionOverrides.has(declarationName)) {
    assert(node.type === "FunctionDeclaration" && originalSection(node.start) === "vehicle",
      `Vehicle route function ${declarationName} moved.`);
    replacedVehicleRouteFunctions.add(declarationName);
    continue;
  }
  if (vehicleWarpClassOverrides.has(declarationName)) {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "vehicle",
      `Vehicle warp class ${declarationName} moved.`);
    replacedVehicleWarpClasses.add(declarationName);
    continue;
  }
  if (vehicleTrackEventOverrides.has(declarationName)) {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "vehicle",
      `Vehicle track event ${declarationName} moved.`);
    if (declarationName === "Kn0") {
      bodies.get("vehicle").push({ at: node.start,
        text: "class Kn0 extends TrackEventOwner { constructor(projection) { super(projection, trackEventOwnerOps); } }" });
    }
    replacedVehicleTrackEvents.add(declarationName);
    continue;
  }
  if (vehicleEventAnimatorOverrides.has(declarationName)) {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "vehicle",
      `Vehicle event animator ${declarationName} moved.`);
    bodies.get("vehicle").push({ at: node.start,
      text: "class qn0 extends MovingTrackEvent { constructor(root, projection) { super(root, projection, movingEventOps); } }" });
    replacedVehicleEventAnimators.add(declarationName);
    continue;
  }
  if (vehicleLensFlareOverrides.has(declarationName)) {
    assert(originalSection(node.start) === "vehicle" &&
      node.type === (declarationName === "w7" ? "ClassDeclaration" : "FunctionDeclaration"),
      `Vehicle lens flare ${declarationName} moved.`);
    if (declarationName === "w7") bodies.get("vehicle").push({ at: node.start,
      text: "class w7 extends LensFlareEffect { constructor(point, texture) { super(point, texture, ca); } static load(library, position) { return loadLensFlareEffect(library, position, p2, (point, texture) => new w7(point, texture)); } }" });
    replacedVehicleLensFlares.add(declarationName);
    continue;
  }
  if (vehicleKartAudioOverrides.has(declarationName)) {
    assert(originalSection(node.start) === "vehicle" &&
      node.type === (declarationName === "pv" ? "ClassDeclaration" : "FunctionDeclaration"),
      `Vehicle kart audio ${declarationName} moved.`);
    if (declarationName === "pv") bodies.get("vehicle").push({ at: node.start,
      text: "class pv extends KartAudioRuntime { constructor(...args) { super(...args, kartAudioOps); } static load(library, engineName, generation, chargeBoostBySpeed, context, kartName) { return loadKartAudio(library, engineName, generation, chargeBoostBySpeed, context, kartName, kartAudioLoadOps, (...args) => new pv(...args)); } }" });
    replacedVehicleKartAudio.add(declarationName);
    continue;
  }
  if (declarationName === "ul") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "vehicle",
      "Vehicle asset loader class moved.");
    bodies.get("vehicle").push({ at: node.start,
      text: rewriteClassMethods(node, vehicleAssetLoaderMethodOverrides,
        replacedVehicleAssetLoaderMethods) });
    continue;
  }
  if (vehicleSlipstreamOverrides.has(declarationName)) {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "vehicle",
      `Vehicle slipstream ${declarationName} moved.`);
    const wrapper = declarationName === "mv"
      ? "class mv extends SlipstreamVisual { static load(library, kart, environment, stageBinding) { return loadSlipstreamVisual(library, kart, environment, stageBinding, slipstreamVisualOps, (scene, burst) => new mv(scene, burst)); } }"
      : "class wv extends SlipstreamAudio { constructor(context, charging, draft) { super(context, charging, draft, slipstreamAudioOps); } static load(library, context) { return loadSlipstreamAudio(library, context, Q9, (audioContext, charging, draft) => new wv(audioContext, charging, draft)); } }";
    bodies.get("vehicle").push({ at: node.start, text: wrapper });
    replacedVehicleSlipstream.add(declarationName);
    continue;
  }
  if (vehicleStartGridOverrides.has(declarationName)) {
    assert(node.type === "FunctionDeclaration" && originalSection(node.start) === "vehicle",
      `Vehicle start grid ${declarationName} moved.`);
    replacedVehicleStartGrid.add(declarationName);
    continue;
  }
  if (vehicleNormalCoordinatorOverrides.has(declarationName)) {
    assert(originalSection(node.start) === "vehicle" &&
      node.type === (["as", "J8"].includes(declarationName) ? "FunctionDeclaration" : "ClassDeclaration"),
      `Vehicle normal coordinator ${declarationName} moved.`);
    if (declarationName === "yL") bodies.get("vehicle").push({ at: node.start,
      text: "class yL extends NormalRaceCoordinator { constructor(mode, track, kart, sink) { super(mode, track, kart, sink, normalRaceModes); } }" });
    replacedVehicleNormalCoordinators.add(declarationName);
    continue;
  }
  if (vehicleFrameClockOverrides.has(declarationName)) {
    assert(originalSection(node.start) === "vehicle" &&
      node.type === (declarationName === "DC" ? "FunctionDeclaration" : "ClassDeclaration"),
      `Vehicle frame clock ${declarationName} moved.`);
    replacedVehicleFrameClocks.add(declarationName);
    continue;
  }
  if (vehicleResidualOverrides.has(declarationName)) {
    assert(originalSection(node.start) === "vehicle" &&
      node.type === (["m7", "v7", "I30", "gn0", "Cn0", "I40", "k40", "F40", "D40", "Ea"].includes(declarationName)
        ? "ClassDeclaration" : "FunctionDeclaration"),
    `Vehicle residual symbol ${declarationName} changed in the release.`);
    assert(!replacedVehicleResidual.has(declarationName),
      `Duplicate vehicle residual symbol ${declarationName}.`);
    bodies.get("vehicle").push({ at: node.start,
      text: vehicleResidualOverrides.get(declarationName) });
    replacedVehicleResidual.add(declarationName);
    continue;
  }
  if (peerMeshOverrides.has(declarationName)) {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "multiplayer",
      `Peer mesh override ${declarationName} moved.`);
    replacedPeerMesh.add(declarationName);
    continue;
  }
  if (networkTimingOverrides.has(declarationName)) {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) ===
      (declarationName === "L40" ? "vehicle" : "multiplayer"),
      `Network timing override ${declarationName} moved.`);
    replacedNetworkTiming.add(declarationName);
    continue;
  }
  if (remoteMotionOverrides.has(declarationName)) {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "world",
      `Remote motion override ${declarationName} moved.`);
    replacedRemoteMotion.add(declarationName);
    continue;
  }
  if (inputClassOverrides.has(declarationName)) {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "multiplayer",
      `Input class override ${declarationName} moved.`);
    replacedInputClasses.add(declarationName);
    continue;
  }
  if (lobbyPrimitiveOverrides.has(declarationName)) {
    assert(originalSection(node.start) === "multiplayer",
      `Lobby primitive ${declarationName} moved from multiplayer.`);
    replacedLobbyPrimitives.add(declarationName);
    continue;
  }
  if (uiSymbolOverrides.has(declarationName)) {
    assert(originalSection(node.start) === "ui", `UI override ${declarationName} moved.`);
    replacedUiSymbols.add(declarationName);
    continue;
  }
  if (retiredUiHelpers.has(declarationName)) {
    assert(originalSection(node.start) === "ui", `Retired UI helper ${declarationName} moved.`);
    retiredUi.add(declarationName);
    continue;
  }

  if (node.type === "FunctionDeclaration" && sharedMathNames.has(node.id?.name)) {
    bodies.get("math").push({ at: node.start, text: source.slice(node.start, node.end) });
    continue;
  }

  if (
    node.type === "VariableDeclaration" &&
    node.declarations.some((declaration) => declaration.id.name === "dl")
  ) {
    assert(node.kind === "const", "Expected dl in a const declaration.");
    assert(node.declarations[0].id.name === "dl", "Expected dl as first declarator.");
    assert(node.declarations.length > 1, "Expected other driving constants beside dl.");
    dlDeclarator = node.declarations[0];
    bodies.get("math").push({
      at: dlDeclarator.start,
      text: `const ${source.slice(dlDeclarator.start, dlDeclarator.end)};`,
    });
    bodies.get("driving").push({
      at: node.start,
      text: `const ${source.slice(node.declarations[1].start, node.end)}`,
    });
    continue;
  }

  bodies.get(originalSection(node.start)).push({
    at: node.start,
    text: source.slice(node.start, node.end),
  });
}
assert(garageExportNode, "The 89-name garage export declaration is missing.");
assert(groupNames(replacedFormatClasses) === "Jq, eK, nR",
  "The texture loaders and canvas controller were not all replaced.");
assert(groupNames(replacedDriveCameraClasses) === "Cj, Ol",
  "The drive camera classes were not both replaced.");
assert(groupNames(replacedKeyControllers) === "Zm, on",
  "The float and color key controllers were not both replaced.");
assert(replacedTrackSceneAssembly, "The track scene assembly function was not replaced.");
assert(groupNames(replacedCharacterRenderers) === "TR, vR",
  "The character scene and CPU skin renderers were not both replaced.");
assert(groupNames(replacedResourceDecoders) === "AB, x1",
  "The texture loader and UTF-16 XML parser were not both replaced.");
assert(groupNames(replacedSceneResourceClasses) === "Qm, ha, rn, vB, yB" &&
  replacedBillboardOrientation && retiredBillboardScratch,
"The scene resource classes and Billboard orientation were not all replaced.");
assert(groupNames(replacedFormatBusiness) === "Dj, Mo, O5, YH, ZH, Zq, dt, ju, nw, tZ, xo",
  "The track reader, color table, UI draw pipeline and Toon state were not all replaced.");
assert(replacedFormatRoadDescriptors.size === formatRoadDescriptorOverrides.size &&
  replacedFormatRoadExtraction.size === formatRoadExtractionOverrides.size &&
  replacedFormatObstacles.size === formatObstacleOverrides.size &&
  groupNames(retiredFormatDeclarations) === groupNames(retiredFormatSource),
"The road descriptor, road extraction, and moving obstacle declarations were not all replaced.");
assert(replacedFormatTimeAttackRewards.size === formatTimeAttackRewardOverrides.size,
  "The time attack result reward bindings were not all replaced.");
assert(replacedFormatTrackAdmission.size === formatTrackAdmissionOverrides.size &&
  replacedFormatKartIdentity.size === formatKartIdentityOverrides.size &&
  replacedFormatFontLayout.size === formatFontLayoutOverrides.size &&
  groupNames(retiredFormatFont) === groupNames(retiredFormatFontHelpers) &&
  retiredKartIdentityEmptySet && retiredTrackNameCompare && replacedRendererWarmup,
"The track admission, kart identity, font layout, or renderer warmup was not replaced.");
assert(retiredDriftClusterDeclarations === 30 && retiredDriftTextureSelector,
  "The drift effect cluster was not fully replaced.");
assert(replacedToonOutlineController, "The Toon outline controller was not replaced.");
assert(groupNames(replacedReadableFormatRenderers) === "CB, bo, tw, wK",
  "The award scene, Toon batch, and material renderers were not all replaced.");
assert(replacedPngInflate, "The bundled PNG inflate entry point was not replaced.");
assert(retiredTrackPrsDeclarations === 40,
  `Expected 40 track PRS declarations; found ${retiredTrackPrsDeclarations}.`);
assert(retiredSpeedTypeTableDeclarations === 7,
  `Expected 7 retired SpeedType declarations; found ${retiredSpeedTypeTableDeclarations}.`);
assert(retiredModelRecordConstants && retiredModelRecordDeclarations === 23,
  `Expected Object47 model constants and 23 declarations; found ${retiredModelRecordDeclarations}.`);
assert(retiredKartBoosterEffectDeclarations === 11,
  `Expected 11 kart booster effect declarations; found ${retiredKartBoosterEffectDeclarations}.`);
assert(replacedMultiplayerWindowView && replacedGarageLivePanels,
  "The multiplayer window and garage live panels were not both replaced.");
assert(groupNames(retiredLibraryHudAndConfirmation) ===
  "$M, AQ, CQ, I00, Ju, Lx, MQ, PR, Px, SQ, bQ, cI, ig, jr, lI, xQ, yQ, zM" &&
  groupNames(replacedLibraryHudAndConfirmation) === "Dw, FR, Fw, _w, pQ",
`The confirmation and multiplayer HUD source clusters were not all replaced: retired=${groupNames(retiredLibraryHudAndConfirmation)} replaced=${groupNames(replacedLibraryHudAndConfirmation)}.`);
// item-mode(hud)
assert(groupNames(replacedItemHudSlots) === "XJ, s00" &&
  groupNames(retiredItemHudSlots) === "Ax, Mx, bx, d00, f00, h00, p00, rI, sI, u00",
`The item slot HUD declarations were not all replaced: replaced=${groupNames(replacedItemHudSlots)} retired=${groupNames(retiredItemHudSlots)}.`);
assert(groupNames(replacedLibraryResultViews) === "Bo, Tw",
  "The multiplayer result views were not both replaced.");
assert(replacedDerivedOverlayRenderer && replacedModelBinaryCursor &&
  groupNames(retiredDerivedOverlayHelpers) === "JQ, KQ, QQ, UR, XQ, YQ, ZQ, ex, jQ, tx",
"The derived overlay and model cursor declarations were not all replaced.");
assert(replacedCourseGraph, "The track course graph builder was not replaced.");
assert(replacedPngDecoder && retiredPngSignature,
  "The PNG decoder and signature were not both replaced.");
assert(groupNames(replacedTextureAlpha) === "aK, cK",
  "The texture alpha correctors were not both replaced.");
assert(dlDeclarator, "The shared dl constant was not found.");
assert(
  replacedInputs.size === inputOverrides.size,
  "The three handwritten input overrides were not all found.",
);
assert(
  replacedResources.size === resourceOverrides.size,
  "The handwritten resource override was not found.",
);
assert(replacedSwMethods.size === swMethodOverrides.size,
  "The resource lookup and track catalog method overrides were not all found.");
assert(replacedRaceHudBoostMethods.size === raceHudBoostMethodOverrides.size,
  "The race HUD boost method overrides were not all found.");
assert(replacedMotionBlurEffect && retiredMotionBlurConstants &&
  retiredMotionBlurHelpers.size === motionBlurHelperNames.size,
  "The motion blur implementation was not fully retired.");
assert(replacedMqTachometer &&
  groupNames(retiredMqTachometerHelpers) === "Kh, x50",
  "The MQ tachometer implementation was not fully retired.");
assert(replacedLobbyListDrawMethods.size === lobbyListDrawMethodOverrides.size,
  "The lobby list draw method override was not found.");
assert(replacedMultiplayerWindowAssetMethods.size === multiplayerWindowAssetMethodOverrides.size,
  "The multiplayer window asset override was not found.");
assert(
  replacedGhosts.size === ghostOverrides.size,
  "The handwritten Ghost overrides were not all found.",
);
assert(replacedKsv.size === ksvOverrides.size, "The KSV file overrides were not all found.");
assert(replacedGhostRuntimeClasses.size === ghostRuntimeClassOverrides.size,
  "The Ghost runtime class overrides were not all found.");
assert(replacedLobbyAvatarDeclarations.size === lobbyAvatarDeclarationOverrides.size,
  "The lobby avatar declarations were not all found.");
assert(replacedLobbyRoomMethods.size === lobbyRoomMethodOverrides.size,
  "The lobby room methods were not all found.");
assert(replacedLobbyRoomFields.size === lobbyRoomFieldOverrides.size,
  "The lobby room keyboard fields were not all found.");
assert(replacedRaceLoadingScreen,
  "The multiplayer race loading screen override was not found.");
assert(replacedGhostKsvClassMethods.size === ghostKsvClassMethodOverrides.size,
  "The Ghost KSV exporter classes were not both replaced.");
assert(replacedGhostKsvFunctions.size === ghostKsvFunctionOverrides.size,
  "The Ghost KSV exporter functions were not both replaced.");
assert(replacedMultiplayerPresenterMethods.size === multiplayerPresenterMethodOverrides.size,
  "The multiplayer race presenter update override was not found.");
assert(replacedRacePresentationSessionMethods.size === racePresentationSessionMethodOverrides.size,
  "The multiplayer race session method overrides were not all found.");
assert(replacedRaceChatOverlay, "The handwritten in-race chat overlay was not found.");
assert(replacedTrackInfoCardMethods.size === trackInfoCardMethodOverrides.size,
  "The handwritten track information card methods were not all found.");
assert(replacedRpScenePreview, "The handwritten RP scene preview was not found.");
assert(groupNames(replacedMultiplayerNoticeClasses) === groupNames(["fy", "wy", "vy", "yy"]),
  "The four multiplayer notice classes were not all replaced.");
assert(groupNames(replacedLobbyPreviewDeclarations) === groupNames(["Ml0", "xl0", "Tl0", "dy"]),
  "The lobby avatar and countdown runtime declarations were not all replaced.");
assert(groupNames(replacedMultiplayerAccountDeclarations) ===
  groupNames(["ay", "Ko", "Xo", "CF", "yl0", "PT", "Al0"]),
  "The multiplayer account declarations were not all replaced.");
assert(replacedMultiplayerPresentationFunctions.size ===
  multiplayerPresentationFunctionOverrides.size,
  "The multiplayer presentation functions were not all replaced.");
assert(replacedMultiplayerSupportFunctions.size === multiplayerSupportFunctionOverrides.size,
  "The multiplayer support functions were not all replaced.");
assert(replacedMultiplayerAccountUiGroup,
  "The multiplayer account UI declaration group was not replaced.");
assert(groupNames(replacedFullMultiplayerClasses) === groupNames(["LT", "Wl0", "ql0", "py"]),
  "The multiplayer controller classes were not all replaced.");
assert(groupNames(replacedRoomOptionFunctions) === groupNames(["NT", "Ol0", "zl0"]),
  "The room option functions were not all replaced.");
assert(replacedLobbyDialogMethods.size === lobbyDialogMethodOverrides.size,
  "The lobby dialog method overrides were not all found.");
assert(retiredGhosts.size === retiredGhostHelpers.size, "The retired Ghost helpers were not all found.");
assert(replacedPhysics.size === physicsOverrides.size, "The handwritten vehicle parameter overrides were not all found.");
assert(replacedStageManager, "The handwritten StageManager override was not found.");
assert(replacedLifecycle.size === lifecycleOverrides.size, "The time attack lifecycle override was not complete.");
assert(replacedReadyMethods.size === readyMethodOverrides.size, "The Ready flow method overrides were not all found.");
assert(replacedRaceStartCoordinator, "The race start coordinator override was not found.");
assert(replacedSoloRacePublisher, "The solo race publisher override was not found.");
assert(replacedApplicationMethods.size === applicationMethodOverrides.size, "The application race method overrides were not all found.");
assert(replacedAppBoot.size === appBootOverrides.size,
  "The application boot overrides were not all found.");
assert(replacedWorldPerformance.size === worldPerformanceOverrides.size,
  "The performance diagnostics overrides were not all found.");
assert(groupNames(replacedWorldLargeDeclarations) === "Bv, Fv, Hs0, S4, b7",
  "The large world owners were not all replaced.");
assert(groupNames(replacedWorldResidualDeclarations) ===
  "$d, Kr0, Ks, Tv, Ui0, ar0, cr0, dr0, hr0, mE, qr0, sr0, ur0" &&
  groupNames(retiredWorldResidualGroups) === "$L, M2, n9",
  "The flying pet, giant warning and multiplayer coordinator residuals were not retired.");
assert(replacedWorldHud.size === worldHudOverrides.size && retiredHudVersion,
  "The HUD overlay overrides were not all found.");
assert(replacedWorldLocalDirectory.size === worldLocalDirectoryOverrides.size &&
  retiredWorldLocalDirectoryKeys && replacedCanvasContextDiagnostics &&
  retiredCanvasContextEvents,
  "The local resource directory and canvas diagnostics were not all replaced.");
assert(replacedTouchLayoutEditor && retiredTouchLayoutKeys &&
  retiredTouchLayout.size === retiredTouchLayoutHelpers.size,
  "The touch layout editor was not fully replaced.");
assert(replacedTouchDrivingControls && retiredTouchDrivingConstants &&
  retiredTouchDriving.size === retiredTouchDrivingHelpers.size,
  "The touch driving controller was not fully replaced.");
assert(replacedVehiclePreviewRenderer && replacedTimeAttackDialogs.size === 2,
  "The TimeAttack preview and pause dialog were not fully replaced.");
assert(replacedFirstRiderDialog && retiredFirstRiderConstants &&
  retiredFirstRiderHelpers.size === firstRiderHelpers.size,
  "The first rider dialog and assets were not fully replaced.");
assert(replacedTimeAttackAuxiliaryClasses.size === 4 &&
  replacedRouteSurfaceListenerMethods.size === routeSurfaceListenerMethodOverrides.size &&
  retiredInterfaceAudioPaths,
  "The TimeAttack camera, audio, route and owner classes were not fully replaced.");
assert(replacedRaceBgmResources.size === raceBgmResourceOverrides.size &&
  retiredRaceBgmThemePaths,
  "The TimeAttack BGM archive resources were not fully replaced.");
assert(replacedGhostEquipment.size === ghostEquipmentOverrides.size,
  "The Ghost equipment helpers were not fully replaced.");
assert(replacedTimeAttackRaceViews.size === 3 && replacedGhostVisualHelpers.size === 3,
  "The TimeAttack race views and Ghost visual helpers were not fully replaced.");
assert(retiredEmbeddedPakoDeclarations === embeddedPakoDeclarationCount,
  "The embedded Pako codec was not fully retired.");
assert(replacedDrivingCollision.size === drivingCollisionOverrides.size &&
  retiredCollisionFloatAliases.size === 2,
  "The driving collision overrides were not all found.");
assert(replacedKartPresentationView,
  "The kart presentation view override was not found.");
assert(replacedApplicationFields.size === applicationFieldOverrides.size,
  "The application key field override was not found.");
assert(replacedTimeAttackStageMethods.size === timeAttackStageMethodOverrides.size, "The time attack stage method overrides were not all found.");
assert(replacedRecordServiceMethods.size === recordServiceMethodOverrides.size,
  "The time attack record service method overrides were not all found.");
assert(replacedGhostRecordLibraryMethods.size === ghostRecordLibraryMethodOverrides.size,
  "The Ghost record library method overrides were not all found.");
assert(replacedGhostAssetBuilderMethods.size === ghostAssetBuilderMethodOverrides.size,
  "The Ghost asset builder method overrides were not all found.");
assert(replacedGhostMenuImportMethods.size === ghostMenuImportMethodOverrides.size,
  "The Ghost menu import method overrides were not all found.");
assert(replacedGhostMenuBridgeMethods.size === ghostMenuBridgeMethodOverrides.size,
  "The Ghost menu bridge method overrides were not all found.");
assert(replacedGhostVisualMotionMethods.size === ghostVisualMotionMethodOverrides.size,
  "The Ghost visual motion method overrides were not all found.");
assert(replacedRaceBgmPlaybackMethods.size === raceBgmPlaybackMethodOverrides.size,
  "The race BGM playback method overrides were not all found.");
assert(replacedTimeAttackInputBridgeMethods.size === timeAttackInputBridgeMethodOverrides.size,
  "The time attack input bridge method overrides were not all found.");
assert(replacedGhostSmoothSampler,
  "The Ghost smooth sampler override was not found.");
assert(replacedPresenterMethods.size === presenterMethodOverrides.size,
  "The presentation method overrides were not all found.");
assert(replacedMotionCodec.size === motionCodecOverrides.size,
  "The handwritten motion codec classes were not both found.");
assert(replacedVehicleBusiness.size === vehicleBusinessOverrides.size,
  "The handwritten vehicle business classes were not both found.");
assert(replacedVehicleAnimationSelectors.size === vehicleAnimationSelectorOverrides.size,
  "The handwritten vehicle animation selectors were not all found.");
assert(replacedVehicleAnimationActions.size === vehicleAnimationActionOverrides.size,
  "The handwritten vehicle animation actions were not all found.");
assert(replacedVehicleCoinSources.size === vehicleCoinSourceOverrides.size,
  "The handwritten vehicle coin source functions were not all found.");
assert(replacedVehicleCoinOwners.size === vehicleCoinOwnerOverrides.size,
  "The handwritten vehicle coin owner was not found.");
assert(replacedVehicleVisualOwners.size === vehicleVisualOwnerOverrides.size,
  "The handwritten vehicle visual owners were not all found.");
assert(replacedVehicleWeather.size === vehicleWeatherOverrides.size,
  "The vehicle weather effects were not all replaced.");
assert(replacedVehicleRouteFunctions.size === vehicleRouteFunctionOverrides.size,
  "The vehicle route functions were not all replaced.");
assert(replacedVehicleWarpClasses.size === vehicleWarpClassOverrides.size,
  "The vehicle warp classes were not all replaced.");
assert(replacedVehicleTrackEvents.size === vehicleTrackEventOverrides.size,
  "The vehicle track event classes were not all replaced.");
assert(replacedVehicleEventAnimators.size === vehicleEventAnimatorOverrides.size,
  "The vehicle event animator was not replaced.");
assert(replacedVehicleLensFlares.size === vehicleLensFlareOverrides.size,
  "The vehicle lens flare symbols were not all replaced.");
assert(replacedVehicleKartAudio.size === vehicleKartAudioOverrides.size,
  "The vehicle kart audio symbols were not all replaced.");
assert(replacedVehicleAssetLoaderMethods.size === vehicleAssetLoaderMethodOverrides.size,
  "The vehicle asset loader methods were not all replaced.");
assert(replacedVehicleSlipstream.size === vehicleSlipstreamOverrides.size,
  "The vehicle slipstream classes were not all replaced.");
assert(replacedVehicleStartGrid.size === vehicleStartGridOverrides.size,
  "The vehicle start grid functions were not all replaced.");
assert(replacedVehicleNormalCoordinators.size === vehicleNormalCoordinatorOverrides.size,
  "The vehicle normal coordinator symbols were not all replaced.");
assert(replacedVehicleFrameClocks.size === vehicleFrameClockOverrides.size,
  "The vehicle frame clock symbols were not all replaced.");
assert(replacedVehicleResidual.size === vehicleResidualOverrides.size &&
  retiredVehicleResidualConstants.size === 2,
  "The track audio, ready camera, and tachometer owners were not all replaced.");
assert(replacedPeerMesh.size === peerMeshOverrides.size,
  "The handwritten peer mesh class was not found.");
assert(replacedNetworkTiming.size === networkTimingOverrides.size,
  "The handwritten network timing classes were not both found.");
assert(replacedLobbyPrimitives.size === lobbyPrimitiveOverrides.size,
  "The handwritten lobby primitives were not both found.");
assert(replacedUiSymbols.size === uiSymbolOverrides.size,
  "The handwritten UI symbols were not all found.");
assert(retiredUi.size === retiredUiHelpers.size, "The retired UI helper was not found.");
assert(replacedLocalProfileFunctions.size === localProfileFunctionOverrides.size,
  "The handwritten local profile helpers were not all found.");
assert(replacedTrackPickerMethods.size === trackPickerMethodOverrides.size,
  "The handwritten track picker methods were not all found.");
assert(replacedLocalRaceMethods.size === localRaceMethodOverrides.size,
  "The handwritten local race methods were not all found.");
assert(replacedRemoteMotion.size === remoteMotionOverrides.size && replacedRemoteFleet,
  "The remote motion and fleet overrides were not all found.");
assert(replacedRaceDrivingScales.size === raceDrivingScaleOverrides.size && retiredRaceDrivingHelpers,
  "The race driving scale overrides were not all found.");
assert(replacedRacePeerCadence.size === racePeerCadenceOverrides.size && retiredRacePeerFloat32,
  "The race peer cadence overrides were not all found.");
assert(replacedOutgoingRaceMotion.size === outgoingRaceMotionOverrides.size && retiredOutgoingMotionHelpers,
  "The outgoing race motion overrides were not all found.");
assert(replacedReadyViewMethods.size === readyViewMethodOverrides.size &&
  replacedReadyViewPointers.size === readyViewPointerOverrides.size,
"The Ready view overrides were not all found.");
assert(replacedReadyVehiclePreviewMethods.size === readyVehiclePreviewMethodOverrides.size,
  "The Ready vehicle preview overrides were not all found.");
assert(replacedSettingsMethods.size === settingsMethodOverrides.size,
  "The settings interaction overrides were not all found.");
assert(replacedGarageSelectionMethods.size === garageSelectionMethodOverrides.size,
  "The garage selection overrides were not all found.");
assert(replacedInputClasses.size === inputClassOverrides.size &&
  replacedGameplayInputQueue && replacedGamepadPoller,
  "The gameplay input class overrides were not all found.");
assert(replacedInputFunctions.size === inputFunctionOverrides.size,
  "The gameplay input helper overrides were not all found.");
assert(replacedGameplayAdmission.size === gameplayAdmissionOverrides.size,
  "The gameplay admission override was not found.");
assert(replacedGameplayTiles.size === gameplayTileOverrides.size,
  "The gameplay tile override was not found.");
assert(replacedLobbyActions.size === lobbyActionMethodOverrides.size,
  "The handwritten lobby actions were not all found.");
assert(replacedRaceSessionMethods.size === multiplayerMethodOverrides.size,
  "The handwritten multiplayer client method overrides were not all found.");
assert(replacedServerEventParser, "The handwritten server event parser was not found.");
assert(replacedRoomValidator, "The handwritten room validator was not found.");
assert(replacedDrivingMethods.size === drivingMethodOverrides.size, "The handwritten driving method overrides were not all found.");
assert(replacedWorldConstructor.size === worldConstructorOverrides.size,
  "The handwritten world constructor override was not found.");
assert(replacedActiveRaceMethods.size === activeRaceMethodOverrides.size,
  "The active race room method overrides were not all found.");

// AST scopes, not text searches, identify the actual producer of each symbol.
// Map every reference to the generated module containing its top-level owner.
function statementAt(offset) {
  let low = 0;
  let high = statements.length - 1;
  while (low <= high) {
    const mid = (low + high) >>> 1;
    const node = statements[mid];
    if (offset < node.start) high = mid - 1;
    else if (offset >= node.end) low = mid + 1;
    else return node;
  }
  throw new Error(`No top-level statement contains offset ${offset}`);
}

function moduleForReference(offset) {
  if (offset >= dlDeclarator.start && offset < dlDeclarator.end) return "math";
  const node = statementAt(offset);
  if (node.type === "FunctionDeclaration" && sharedMathNames.has(node.id?.name))
    return "math";
  return originalSection(node.start);
}

const imports = new Map(order.map((name) => [name, new Map()]));
const exports = new Map(order.map((name) => [name, new Set()]));
function addImport(consumer, producer, name) {
  if (consumer === producer) return;
  assert(
    rank.get(producer) < rank.get(consumer),
    `Module dependency cycle or forward evaluation: ${consumer} -> ${producer} (${name})`,
  );
  if (!imports.get(consumer).has(producer)) imports.get(consumer).set(producer, new Set());
  imports.get(consumer).get(producer).add(name);
  exports.get(producer).add(name);
}

let bindings;
traverse(ast, {
  Program(program) {
    bindings = program.scope.bindings;
    for (const [name, binding] of Object.entries(bindings)) {
      const producer = sharedMathNames.has(name)
        ? "math"
        : originalSection(binding.identifier.start);
      for (const reference of binding.referencePaths) {
        addImport(moduleForReference(reference.node.start), producer, name);
      }
      // ESM imports are read-only. Moving a writer to another module would
      // change behavior even if syntax generation succeeded.
      for (const write of binding.constantViolations) {
        assert(
          moduleForReference(write.node.start) === producer,
          `Cross-module assignment to ${name} would require an explicit setter.`,
        );
      }
    }
    program.stop();
  },
});

// Removing a retired helper is safe only while every original caller is also
// replaced or retired. Catch future source changes before emitting JS globals.
for (const name of retiredGhostHelpers) {
  const binding = bindings[name];
  assert(binding, `Retired Ghost helper ${name} has no source binding.`);
  for (const reference of binding.referencePaths) {
    const owner = statementAt(reference.node.start);
    const ownerName = owner.type === "FunctionDeclaration" || owner.type === "ClassDeclaration"
      ? owner.id?.name
      : undefined;
    assert(
      retiredGhostHelpers.has(ownerName) || ksvOverrides.has(ownerName) || ghostOverrides.has(ownerName),
      `Retired Ghost helper ${name} is still used by ${ownerName ?? owner.type}.`,
    );
  }
}
for (const name of ["OT", "Z1"]) {
  const binding = bindings[name];
  assert(binding, `Retired lifecycle helper ${name} has no source binding.`);
  for (const reference of binding.referencePaths) {
    const owner = statementAt(reference.node.start);
    assert(
      (owner.type === "ClassDeclaration" && owner.id?.name === "GF") ||
      (owner.type === "FunctionDeclaration" && lifecycleOverrides.has(owner.id?.name)),
      `Retired lifecycle helper ${name} is still used outside the rewritten lifecycle.`,
    );
  }
}

const garageAliases = [];
for (const specifier of garageExportNode.specifiers) {
  assert(specifier.type === "ExportSpecifier", "Unexpected garage export specifier.");
  const local = specifier.local.name;
  const external = specifier.exported.name;
  const binding = bindings[local];
  assert(binding, `Garage export ${local} has no local declaration.`);
  const producer = sharedMathNames.has(local)
    ? "math"
    : originalSection(binding.identifier.start);
  addImport("app", producer, local);
  garageAliases.push({ local, external, producer });
}
assert(garageAliases.length === 89, `Expected 89 garage exports; found ${garageAliases.length}.`);
for (const name of developmentExports) {
  const binding = bindings[name];
  assert(binding, `Development export ${name} has no original declaration.`);
  const producer = sharedMathNames.has(name)
    ? "math"
    : originalSection(binding.identifier.start);
  exports.get(producer).add(name);
}

function renderModule(name) {
  const lines = [
    "// Generated from the verified KartSim v39.11 release bundle.",
    "// Rebuild with: node tools/generate-modules.mjs",
    "// Stable minified names are retained for behavioral parity.",
    "",
  ];
  if (name === "data") {
    assert(groupNames(exports.get(name)) === "d10, h10, hn",
      "The embedded vehicle data export list changed.");
    lines.push('export { d10, h10, hn } from "../physics/release-data.ts";');
    return `${lines.join("\n").trimEnd()}\n`;
  }
  if (name === "math") {
    lines.push('export { F2, F4, m, t0, dl, On, Rg, I1, N1, Tt } from "../physics/release-math.ts";');
    return `${lines.join("\n").trimEnd()}\n`;
  }
  if (name === "vendor") {
    // The release bundled Three.js r178. Use that exact public package version
    // through a named compatibility adapter instead of regenerating its minified
    // internals into the source tree.
    lines.push('export * from "../vendor/legacy-three.ts";');
    return `${lines.join("\n").trimEnd()}\n`;
  }
  lines.push(...itemModeDrivingImports(name)); // item-mode(driving)
  if (name === "formats") {
    lines.push('import { isTrackPrs, createPrsRuntime, playPrs, setPrsCycleMode, stopPrs, validatePrs, defaultTrackTransform, applyTrackPrs, sampleTrackPrs } from "../resources/track-prs-animation.ts";');
    lines.push('import { admitMovingObstacle, transformObstaclePoint } from "../resources/moving-obstacle.ts";');
    lines.push('import { extractTrackRoute, itemGameOnly, readTrackSettings, soloTrackMode, trackRuntimeIssues } from "../resources/track-model-admission.ts";');
    lines.push('import { blockedKartMessage, defaultLegacyKartState, isBlockedKartId, kartCatalogIdentity, legacyKartFamilies, legacyKartStateForAlias, requirePlayableKartId, resolveKartSelection, stableSystemKartKey } from "../resources/system-kart-identity.ts";');
    lines.push('import { layoutSpriteFont, layoutSpriteFontInto, spriteFontLayoutForPanel } from "../resources/font-glyph-layout.ts";');
    lines.push('import { timeAttackRewardText } from "../timeattack/result-rewards.ts";');
    lines.push('import { warmRendererResources } from "../resources/renderer-warmup.ts";');
    lines.push('import { extractTrackRoads } from "../resources/track-road-extraction.ts";');
    lines.push('import { anyRoadIssue, isMovableRoad, movingRoadIssue, roadRail, roadSound, roadSurface, staticRoadIssue } from "../resources/track-road-descriptor.ts";');
    lines.push('import { CanvasHitController } from "../ui/canvas-hit-controller.ts";');
    lines.push('import { CameraHeightFollower, DriveCameraController } from "../resources/drive-camera.ts";');
    lines.push('import { FloatKeyController } from "../resources/float-key-controller.ts";');
    lines.push('import { ColorKeyController } from "../resources/color-key-controller.ts";');
    lines.push('import { assembleTrackScene } from "../resources/track-scene-assembly.js";');
    lines.push('import { buildCharacterScene } from "../resources/character-scene-render.js";');
    lines.push('import { CharacterSkinGeometry } from "../resources/character-skin-geometry.js";');
    lines.push('import { loadLegacyTexture } from "../resources/legacy-texture-loader.ts";');
    lines.push('import { parseResourceXml } from "../resources/xml-utf16-parser.ts";');
    lines.push('import { ToonEnvironmentTexture } from "../resources/toon-environment-texture.ts";');
    lines.push('import { CoatingFrameClock, CoatingTextureManager, StageTextureBinding } from "../resources/coating-stage.ts";');
    lines.push('import { MorphController } from "../resources/morph-controller.ts";');
    lines.push('import { orientTrackBillboard } from "../resources/billboard-orientation.ts";');
    lines.push('import { TrackBinaryCursor, TrackObjectRegistry } from "../resources/track-binary-reader.ts";');
    lines.push('import { CharacterColorTable, loadCharacterColorTable } from "../resources/character-color-table.ts";');
    lines.push('import { PanelDrawCache } from "../resources/panel-draw-order.ts";');
    lines.push('import { materializePanelDrawOrder } from "../resources/panel-materializer.ts";');
    lines.push('import { applyToonMaterialProperties, characterMaterialDefaults, setToonEnvironmentUniforms, setToonUvController, toonPropertyBank } from "../resources/toon-material-state.ts";');
    lines.push('import { ToonOutlineController, toonColorFromArgb } from "../resources/toon-outline-controller.ts";');
    lines.push('import { ToonOutlineBatch } from "../resources/toon-outline-batch.ts";');
    lines.push('import { AwardPodiumScene, loadAwardPodiumScene } from "../resources/award-podium-scene.ts";');
    lines.push('import { createToonEnvironmentMaterial } from "../resources/toon-environment-material.ts";');
    lines.push('import { createBasicTextureMaterial } from "../resources/basic-texture-material.ts";');
    lines.push('import { decodePngRgba } from "../resources/png-decoder.ts";');
    lines.push('import { normalizeLegacyTextureAlpha } from "../resources/texture-alpha.ts";');
    lines.push('import { buildTrackCourseGraph } from "../resources/track-course-graph.ts";');
    lines.push('const fontLayoutOps = { attribute: T, rectangle: lt, parseNumbers: j2 };');
  }
  if (name === "world") {
    lines.push('import { installWorldOverrides } from "../world/install.ts";');
    lines.push('import { LocalRaceController } from "../multiplayer/local-race-controller.ts";');
    lines.push('import { FlyingPetModel, loadFlyingPetModelParts } from "../world/flying-pet-model.ts";');
    lines.push('import { FlyingPetIdleMotion, FlyingPetRaceState, visibleFlyingPet } from "../world/flying-pet-state.ts";');
    lines.push('import { FlyingPetAudio, loadFlyingPetAliveSound, loadFlyingPetEffect } from "../world/flying-pet-media.ts";');
    lines.push('import { FlyingPetTextures } from "../world/flying-pet-textures.ts";');
    lines.push('import { GiantWarning } from "../world/giant-warning.ts";');
    lines.push('import { GiantAppearance } from "../world/giant-appearance.ts";');
    lines.push('import { ActiveRaceCoordinator } from "../multiplayer/active-race-coordinator.ts";');
    lines.push('import { FlyingPetPresentation } from "../world/flying-pet-presentation.ts";');
    lines.push('import { TrackEventEffectPool } from "../world/track-event-effect-pool.ts";');
    lines.push('import { GiantRaceEffects } from "../world/giant-race-effects.ts";');
    lines.push('import { RoadblockResultPresentation, loadRoadblockResultParts } from "../world/roadblock-result-presentation.ts";');
    lines.push('import { createMultiplayerRaceLoader } from "../multiplayer/race-loader.ts";');
    lines.push('import { CanvasContextDiagnostics } from "../ui/canvas-context-diagnostics.ts";');
    lines.push('import { supportsLocalResourceDirectory as io0, recoverLocalResourceDirectory as ro0, chooseLocalResourceDirectory as so0 } from "../resources/local-directory-source.ts";');
    lines.push('import { initializeLocalRace } from "../multiplayer/local-race-construction.ts";');
    lines.push('import { KartPresentationView } from "../world/kart-presentation-view.ts";');
    lines.push('import { HudOverlay, captureUiTransition as eT } from "../ui/hud-overlay.ts";');
    lines.push('import { PerformanceCounter as ko0 } from "../ui/performance-counter.ts";');
    lines.push('import { collectEngineDiagnostics as jo0, formatDiagnosticsLines as qo0 } from "../ui/engine-diagnostics.ts";');
    lines.push('import { RaceChatOverlay } from "../multiplayer/race-chat-overlay.ts";');
    lines.push('import { initializeTrackInfoCard, loadTrackInfoCard } from "../multiplayer/track-info-card-loading.ts";');
    lines.push('import { disposeTrackCard, drawTrackCardClippedText, drawTrackCardLabel, renderTrackCard, setTrackCardBgm, setTrackCardVisible, slideTrackCardOut, updateTrackCard } from "../multiplayer/track-info-card-runtime.ts";');
    lines.push('import { initializeRacePresenter } from "../multiplayer/race-presenter-initialize.ts";');
    lines.push('import { updateRacePresenterFrame } from "../multiplayer/race-presenter-frame.ts";');
    lines.push('import { updateRaceSession } from "../multiplayer/race-session-update.ts";');
    lines.push('import { bindRaceSessionClock, disposeRaceSession, exitRaceSession, failRaceSession, initializeRaceSession, raceSessionDiagnosticsView, raceSessionPresentingResults, raceSessionTouchDodgeEnabled, raceSessionTouchDrivingAvailable, renderRaceSession, requestRaceSessionLeave, scheduleRaceSessionStart, showRaceSessionWaiting, updateRaceSessionRoom } from "../multiplayer/race-session-lifecycle.ts";');
    lines.push('import { clearRacePresenterGiant, prepareRacePresenterFlyingPet, prepareRacePresenterGiant, prepareRacePresenterRoadblockFlag, prepareRacePresenterRoadblockResult } from "../multiplayer/race-presenter-setup.ts";');
    lines.push('import { prepareRacePresenterTrackEvents } from "../multiplayer/race-presenter-track-events.ts";');
    lines.push('import { showRacePresenterResults } from "../multiplayer/race-presenter-results.ts";');
    lines.push('import { disposeRacePresenter, warmRacePresenter } from "../multiplayer/race-presenter-lifecycle.ts";');
    lines.push('import { applyPresenterWarpActions, applyPresenterWarpCamera, capturePresenterRankProgress, forwardPresenterAwardInput, handlePresenterRouteTag, playPresenterGo, playPresenterReset, releasePresenterShadowPresentations, startPresenterAudio, startPresenterBoostGaugeFull, updatePresenterRoom } from "../multiplayer/race-presenter-actions.ts";');
    lines.push('import { renderRacePresenterFrame } from "../multiplayer/race-presenter-render.ts";');
    lines.push('import { browserScanCode } from "../input/action-bindings.ts";');
    lines.push('import { gamepadAxisControl, pressedGamepadControls } from "../input/gamepad-controls.ts";');
    lines.push('import { MotionClockMapping as BL, RemoteMotionPredictor as Gi0 } from "../multiplayer/remote-motion.ts";');
    lines.push('import { RemoteFleet } from "../multiplayer/remote-fleet.ts";');
    lines.push('import { computeCatchupScales as Oi0, chargerDurationScale as zi0, SlipstreamBoost as fE } from "../multiplayer/race-driving-scales.ts";');
    lines.push('import { RacePeerCadence, CollisionFramerateHistory as Ni0 } from "../multiplayer/race-peer-cadence.ts";');
    lines.push('import { OutgoingRaceMotionSender, captureOutgoingMotion, isKnownNetworkMotionMode } from "../multiplayer/outgoing-race-motion.ts";');
    lines.push('import { bindActiveRaceClock, disposeActiveRace, roadblockRemaining, scheduleActiveRaceStart, updateActiveRaceRoom } from "../multiplayer/race-room-coordination.ts";');
    lines.push('import { updateActiveRaceFrame, updateRaceRemoteViews } from "../multiplayer/race-frame-coordination.ts";');
    lines.push('import { acceptLocalRaceEndTiming, advanceLocalRaceReset, applyLocalRaceWarpActions, checkLocalRaceAutomaticReset, handleLocalRaceRouteTag, localRaceElapsedMs, localRaceProgress, localRaceScheduledStartAtMs, localRaceStartBoosterWindow, requestLocalRaceReset, scheduleLocalRaceStart, updateLocalRace } from "../multiplayer/local-race-runtime.ts";');
    lines.push(
      'import { loadLegacyResourceBundle as uo0 } from "../resources/legacy-adapter.ts";',
    );
    lines.push('import { parseServerEvent } from "../multiplayer/server-events.ts";');
    lines.push('import { isValidRoomSnapshot } from "../multiplayer/room-validation.ts";');
    lines.push('import { initializeTrackWorld } from "../world/create-track-world.ts";');
    lines.push('import { StaticTrackSurface } from "../world/static-track-surface.ts";');
    lines.push('import { MovingTrackSurface } from "../world/moving-track-surface.ts";');
    lines.push('import { ObstacleSurface } from "../world/obstacle-surface.ts";');
    lines.push('import { commitObstacleSnapshot } from "../world/track-obstacle-snapshot.ts";');
  }
  if (name === "timeattack") {
    lines.push('import { PresentationController } from "../app/presentation-controller.ts";');
    lines.push('import { TouchLayoutEditor } from "../input/touch-layout-editor.ts";');
    lines.push('import { TouchDrivingControls } from "../input/touch-driving-controls.ts";');
    lines.push('import { VehiclePreviewRenderer } from "../timeattack/vehicle-preview-renderer.ts";');
    lines.push('import { FirstRiderDialog } from "../timeattack/first-rider-dialog.ts";');
    lines.push('import { loadRiderImages } from "../timeattack/first-rider-assets.ts";');
    lines.push('import { buildSoloRaceAssets } from "../timeattack/race-asset-builder.ts";');
    lines.push('import { RaceCameraCoordinator } from "../timeattack/race-camera-coordinator.ts";');
    lines.push('import { InterfaceAudio } from "../timeattack/interface-audio.ts";');
    lines.push('import { FrameRateCounter, TimeAttackInterfaceOwners } from "../timeattack/race-auxiliary-owners.ts";');
    lines.push('import { handleRouteSurfaceTag, warpNextEventFrame, applyWarpNextActions, applyWarpNextAction, freezeWarpCamera } from "../timeattack/route-surface-listener.ts";');
    lines.push('import { selectRaceBgmTheme, raceBgmArchiveTracks, loadRaceBgmPlaylist, decodeBgmResource, requiredBgmResource, garageBgmResource, canonicalBgmPath } from "../timeattack/race-bgm-resources.ts";');
    lines.push('import { ghostEquipmentFromKsv, ghostEquipmentProfile, ghostItemId } from "../timeattack/ghost-equipment.ts";');
    lines.push('import { PauseMenuView } from "../timeattack/pause-menu-view.ts";');
    lines.push('import { PAUSE_VIEW_WIDTH, PAUSE_VIEW_HEIGHT, PAUSE_FONT_FAMILY, loadPauseMenuAssets, pauseButtonHits, pauseString, requiredPauseChild } from "../timeattack/pause-menu-assets.ts";');
    lines.push('import { GhostMenuPanel } from "../timeattack/ghost-menu-panel.ts";');
    lines.push('import { TimeAttackRaceState, TimeAttackResultOverlay } from "../timeattack/race-display-state.ts";');
    lines.push('import { cloneGhostToonMaterials, ghostEffectNames, ghostTrailState } from "../timeattack/ghost-visual-helpers.ts";');
    lines.push('import { ksvCompression as fD } from "../codecs/ksv-compression.ts";');
    lines.push('import { StageManager as wf0 } from "../app/stage-manager.ts";');
    lines.push('import { advancePresentationFrame, renderPresentationFrame } from "../app/frame-loop.ts";');
    lines.push('import { startPresentationLoop, disposePresentationLoop } from "../app/presentation-scheduler.ts";');
    lines.push('import { releaseRaceForReady } from "../app/race-cleanup.ts";');
    lines.push('import { applyRaceOptions, replaceRaceTrack } from "../app/race-configuration.ts";');
    lines.push('import { checkAutomaticReset, checkLowHeightReset, initiateSpeedReset } from "../timeattack/automatic-reset.ts";');
    lines.push('import { advanceCheckpointReset, warpToCheckpoint, warpToPoint } from "../timeattack/checkpoint-reset.ts";');
    lines.push('import { updateTimeAttackDriving } from "../timeattack/driving-loop.ts";');
    lines.push('import { captureGhostRuntime } from "../timeattack/ghost-capture.ts";');
    lines.push('import { GhostParticipantStream, GhostPlayback, GhostPoseRecorder, GhostRecorder, GhostRouteProgress } from "../timeattack/ghost-runtime.ts";');
    lines.push('import { hydrateGhostSummaryIndex, syncGhostSummaryIndex } from "../game/ghost-summary-sync.ts";');
    lines.push('import { loadGhostDecorations, loadGhostKartAssets, rankGhostColors } from "../timeattack/ghost-asset-loading.ts";');
    lines.push('import { deleteGhostRecord, exportGhostKsv, exportGhostSource, ghostRecord, ghostRecordKey, ghostTrackIdFromKey, persistGhostSummaries, promoteGhostRecord, putGhostRecord, restoreGhostRecordLibrary, saveGhostRecord, saveImportedGhostRecord, saveRawGhostRecord } from "../timeattack/ghost-record-library.ts";');
    lines.push('import { deleteGhostFromMenu, exportGhostFromMenu, importSelectedGhostFile, isCurrentGhostImport, switchToImportedGhostTrack } from "../timeattack/ghost-menu-import.ts";');
    lines.push('import { deleteGhostMenuRecord, exportGhostMenuRecord, importGhostMenuRecord, mountGhostMenuBridge, resolveGhostMenuKartTitle, resolveGhostMenuTrack } from "../timeattack/ghost-menu-host.ts";');
    lines.push('import { deriveGhostVisualMotion, isGhostDualTeam, updateGhostVisualAnimation } from "../timeattack/ghost-visual-motion.ts";');
    lines.push('import { attachGhostVisualToScene, disposeGhostVisual, seedGhostVisualStart, setGhostVisualEffects, setGhostVisualTrails } from "../timeattack/ghost-visual-lifecycle.ts";');
    lines.push('import { setGhostVisualAssets, setGhostVisualDecorations } from "../timeattack/ghost-visual-assets.ts";');
    lines.push('import { updateGhostVisualFrame } from "../timeattack/ghost-visual-update.ts";');
    lines.push('import { advanceRaceBgmTransition, clearRaceBgmTransition, currentRaceBgmName, disposeRaceBgm, playGarageBgm, playMultiplayerBgm, playMultiplayerFinishBgm, playMultiplayerPodiumBgm, playMyItemsBgm, playReadyBgm, playResultBgm, restartRaceBgm, silenceRaceBgm, startRaceBgm, stopRaceBgmOwner } from "../timeattack/race-bgm-playback.ts";');
    lines.push('import { loadRaceBgm, prepareMultiplayerBgm, selectRaceBgm } from "../timeattack/race-bgm-loading.ts";');
    lines.push('import { drainTimeAttackDrivingInput, resetTimeAttackTachometerInput, routeBaseDrivingCommand, routeTimeAttackDrivingCommand, routeTimeAttackRaceCommand, setTimeAttackAutoForward, setTimeAttackNitroSeamlessMode, timeAttackDrivingSnapshot } from "../timeattack/driving-input-bridge.ts";');
    lines.push('import { GhostSmoothSampler } from "../timeattack/ghost-smooth-sampler.ts";');
    lines.push('import { rankBoardValues, renderGameplayUi } from "../timeattack/race-hud.ts";');
    lines.push('import { placeAtStart, seedGhostStart, snapStartToGround } from "../timeattack/start-grid.ts";');
    lines.push('import { updateTimeAttackStage } from "../timeattack/stage-update.ts";');
    lines.push('import { renderTimeAttackStage } from "../timeattack/stage-render.ts";');
    lines.push('import { TimeAttackLifecycle as GF } from "../timeattack/lifecycle.ts";');
    lines.push('import { dispatchTimeAttackActions, handleTimeAttackFinishAction, playTimeAttackActionAudio, showTimeAttackResult } from "../timeattack/action-dispatch.ts";');
    lines.push('import { restartTimeAttackRace } from "../timeattack/race-reset.ts";');
    lines.push('import { publishSoloRace } from "../timeattack/race-publication.ts";');
    lines.push('import { buildRawRaceRecording, captureRaceReplay, currentRaceEquipment, promoteRaceRecord, restoreRaceRecords } from "../timeattack/record-service.ts";');
    lines.push('import { disposeTimeAttackInterface, enterTimeAttackStage, exitTimeAttackStage, updateTimeAttackRoute } from "../timeattack/stage-lifecycle.ts";');
    lines.push('import { LD, V_, N_, Dh0, Vh0, O_ } from "../game/ghost-records.ts";');
    lines.push('import { Ah0, bh0 } from "../game/ghost/frame-codec.ts";');
    lines.push('import { Th0 } from "../game/ghost/record-store.ts";');
    lines.push('import { decodeKsvFile, encodeKsvFile } from "../game/ghost/ksv-codec.ts";');
    lines.push('import { buildGhostKsvHeader, encodeGhostKsvRecording, ghostKsvEquipment, nativeFrameToKsvStamp } from "../timeattack/ghost-ksv-export.ts";');
  }
  if (name === "vehicle") {
    lines.push('import { createMqTachometerClass } from "../vehicle/mq-tachometer-renderer.ts";');
    lines.push('import { individualRiderDye } from "../multiplayer/individual-rider-colors.ts";');
    lines.push('import { createMotionBlurEffectClass } from "../vehicle/motion-blur-effect.ts";');
    lines.push('import { collectDummySounds, TrackDummySurroundAudio, StandaloneEventSurroundAudio, unsupportedEventSound } from "../vehicle/track-surround-audio.ts";');
    lines.push('import { ReadyCameraController, warpNextCamera } from "../vehicle/ready-camera.ts";');
    lines.push('import { V1TachometerPresentation } from "../vehicle/v1-tachometer-presentation.ts";');
    lines.push('import { XGenTachometerPresentation } from "../vehicle/xgen-tachometer-presentation.ts";');
    lines.push('import { buildTrackAdmissionLedger } from "../vehicle/track-admission-ledger.ts";');
    lines.push('import { admitTrackObject } from "../vehicle/track-object-admission.ts";');
    lines.push('import { isNewMotionSequence, VehicleMotionSender, VehicleMotionReceiver } from "../vehicle/remote-vehicle-motion.ts";');
    lines.push('import { LteDodgeMotion, LteDodgeInput } from "../vehicle/lte-dodge.ts";');
    lines.push('import { createTailLampEffectClass } from "../vehicle/tail-lamp-effect.ts";');
    lines.push('import { createDriftEffectClass, createDriftMarkSetup } from "../vehicle/drift-effect.ts";');
    lines.push('import { KartRuntimeState as J40 } from "../vehicle/kart-runtime-state.ts";');
    lines.push('import { GiantKartEffect as pL } from "../vehicle/giant-kart-effect.ts";');
    lines.push('import { WarpNextController as Qk, warpPresentationBlinkVisible as gv } from "../vehicle/warp-next-controller.ts";');
    lines.push('import { EventCollisionLatch as EC } from "../vehicle/event-collision-latch.ts";');
    lines.push('import { TrackEventOwner } from "../vehicle/track-event-owner.ts";');
    lines.push('import { MovingTrackEvent } from "../vehicle/moving-track-event.ts";');
    lines.push('import { copyEventPoint } from "../vehicle/event-geometry.ts";');
    lines.push('import { LensFlareEffect, lensFlareAnchor as c30, loadLensFlareEffect } from "../vehicle/lens-flare.ts";');
    lines.push('import { loadRaceCharacters } from "../vehicle/race-character-loading.ts";');
    lines.push('import { loadVehicleRuntime } from "../vehicle/load-vehicle-runtime.ts";');
    lines.push('import { loadVehicleAsset } from "../vehicle/load-vehicle-asset.ts";');
    lines.push('import { loadTrackMap, loadTimeAttackMap, loadMultiplayerMap } from "../vehicle/load-track-map.ts";');
    lines.push(...itemWorldVehicleImports); // item-mode(world)
    lines.push('import { KartAudioRuntime, loadKartAudio, decodeMotorAudio, parseRoadSoundConfig } from "../vehicle/kart-audio-runtime.ts";');
    lines.push('import { loadCharacterAsset } from "../vehicle/load-character-asset.ts";');
    lines.push('import { SlipstreamVisual, loadSlipstreamVisual, SlipstreamAudio, loadSlipstreamAudio } from "../vehicle/slipstream-effects.ts";');
    lines.push('import { validateRaceStartGrid as iL, raceStartPosition as rL } from "../vehicle/race-start-slots.ts";');
    lines.push('import { LapTiming as vL, NormalObjectCoordinator as U40 } from "../vehicle/normal-coordinator.ts";');
    lines.push('import { NormalRaceCoordinator } from "../vehicle/normal-race-coordinator.ts";');
    lines.push('import { VehicleFrameClock as $40, normalizeVehicleTime as DC } from "../vehicle/frame-clock.ts";');
    lines.push('import { routeSurfaceKind as Eg, routeTagFamily as Vo } from "../world/route-tag.ts";');
    lines.push('import { RainScreenEffect } from "../vehicle/rain-screen-effect.ts";');
    lines.push('import { SnowScreenEffect, loadSnowScreenEffect } from "../vehicle/snow-screen-effect.ts";');
    lines.push('import { RainAudioCue, loadRainAudioCue } from "../vehicle/rain-audio-cue.ts";');
    lines.push('import { parseKartSpecCsv as qw } from "../physics/csv.ts";');
    lines.push('import { createBodyParamSpec as pS } from "../physics/body-param.ts";');
    lines.push('import { VehicleSpecCatalog } from "../physics/catalog.ts";');
    lines.push('import { GameMotionEncoder as S40, GameMotionDecoder as d6 } from "../multiplayer/payload.ts";');
    lines.push('import { ClockSynchronizer as L40 } from "../multiplayer/network-timing.ts";');
    lines.push('import { TrackCoinContact as y10 } from "../vehicle/track-coin.ts";');
    lines.push('import { CharacterMotionSequencer } from "../vehicle/motion-sequencer.ts";');
    lines.push('import { StandardMotionController, LinkedMotionController, MappedMotionController } from "../vehicle/animation-selectors.ts";');
    lines.push('import { ResultMotionController, SingleActionMotionController, ActionSetMotionController } from "../vehicle/animation-actions.ts";');
    lines.push('import { TetherMotion as H10 } from "../vehicle/tether-motion.ts";');
    lines.push('import { loadTrackCoinSource, parseTrackCoinResources, uniqueOriginalCoinAsset } from "../vehicle/track-coin-source.ts";');
    lines.push('import { TrackCoinOwner } from "../vehicle/track-coin-owner.ts";');
    lines.push('import { ChargerEffect } from "../vehicle/charger-effect.ts";');
    lines.push('import { CoatingOwner } from "../vehicle/coating-owner.ts";');
  }
  if (name === "driving") {
    lines.push('import { createVehicleCollisionScratch, optionalRoadSurface, triangleCentroid as vv, triangleIntersectsOrientedBox as Oo, orientedBoxBounds as di0, updateTrackedTriangleVelocity } from "../driving/collision-geometry.ts";');
    lines.push('import { initializeVehicle } from "../driving/construct-vehicle.ts";');
    lines.push('import * as VehicleCommands from "../driving/vehicle-commands.ts";');
    lines.push('import * as VehicleTachometer from "../driving/tachometer.ts";');
    lines.push('import * as VehicleInitialization from "../driving/initial-state.ts";');
    lines.push('import * as VehiclePresentation from "../driving/presentation-view.ts";');
    lines.push('import * as VehicleReset from "../driving/reset-runtime.ts";');
    lines.push('import * as VehicleDebug from "../driving/debug-state.ts";');
    lines.push('import { applyLongitudinalForce, applyVelocityDrag, integrateVehicleVelocity } from "../driving/continuous-motion.ts";');
    lines.push('import { advanceVehicleFrame } from "../driving/frame-update.ts";');
    lines.push('import { advancePhysicsSubstep } from "../driving/frame-pipeline.ts";');
    lines.push('import { applySuspensionForce, applyAirborneForces } from "../driving/surface-forces.ts";');
    lines.push('import { accumulateDriftCharge, commitDriftCharge, updateDriftWindows, preserveDriftChargeAfterCollision } from "../driving/drift-gauge.ts";');
    lines.push('import { resolveVehicleTrackCollision, resolveVehicleObstacleCollisions, applyHighContactAngularResponse, applyWallContactAngularResponse } from "../driving/track-collision.ts";');
    lines.push('import { applySteeringTireForces } from "../driving/steering-tires.ts";');
    lines.push('import { applyRoadSurfaceConsumers } from "../driving/road-consumers.ts";');
    lines.push('import { probeVehicleWheels } from "../driving/wheel-probe.ts";');
    lines.push('import { recoverUnconfirmedWheelContacts } from "../driving/wheel-recovery.ts";');
    lines.push('import { applySlipSurfaceAlignment } from "../driving/slip-alignment.ts";');
    lines.push('import { beginRoadAction, advanceStateTimerSeconds, advanceStateTimerMilliseconds, accumulateSpeedCharge } from "../driving/motion-state.ts";');
    lines.push('import { rebuildVehicleBodyState, applyBoosterChargeRoad, updateSpeedChargeEligibility, applyJumpRoadTuning, requestResetRoad } from "../driving/contact-preparation.ts";');
    lines.push('import { updatePrimaryCollisionResetTimers, updateObstacleCollisionResetTimer, advanceCollisionResetTimer, activateDirectionalCollisionPress, activateHardCollisionPress } from "../driving/automatic-reset.ts";');
    lines.push('import { scanSpecialRoadSurfaces, scanSpecialRoadStrip } from "../driving/special-road.ts";');
    lines.push('import { enterVehicleRailMode, requestVehicleMotionMode, returnVehicleToRoad } from "../driving/rail-transitions.ts";');
    lines.push('import { captureVehicleRail } from "../driving/rail-capture.ts";');
    lines.push('import { produceVehicleRailFrame } from "../driving/rail-frame.ts";');
    lines.push('import { applyVehicleRailDynamics } from "../driving/rail-dynamics.ts";');
    lines.push('import { integrateVehicleRailOrientation, integrateVehicleRoadOrientation } from "../driving/orientation-integration.ts";');
    lines.push('import { countVehicleResultCrash, resolveVehicleTrackEvents, makeSecondaryCollisionBox, updateVehicleCollisionGaugeOwners } from "../driving/collision-events.ts";');
    lines.push('import { publishVehicleGauge, mainVehicleGaugeRatio, updateInstantAccelerationCharge, settleInstantWallCharge, beginInstantWallChargeWindow, advanceResetGaugeRefill, beginWallGaugeWindow, settleWallGaugeWindow, setWallGaugeRefund, clearWallGaugeRefund, cacheDisplaySpeed, syncVehiclePresentation } from "../driving/collision-gauges.ts";');
    lines.push('import { startVehicleNormalBooster, activateVehicleCharger, vehicleChargerDurationMs, expireVehicleCharger, updateVehicleDualBooster, armVehicleDualBooster, refreshVehicleDualBoosterReady, classifyVehicleDualBoosterReady, clearVehicleDualBoosterReady } from "../driving/booster-state.ts";');
    lines.push('import { advanceObstacleSuppression, vehicleVisualScaleMode, setVehicleVisualScaleMode, updateVehicleVisualScale, updateVehicleScaleMode, updateVehicleEventScale, updateVehicleEventGravity } from "../driving/visual-scale.ts";');
    lines.push('import { accumulateVehicleTeamGauge, consumeVehicleTeamGaugeCharge, enqueueVehicleTeamGaugeTarget, updateVehicleTeamGauge, consumeVehicleTeamGaugeFullAnimation, teamGaugeSettledAtMs, convertVehicleTeamBoosterSlots, expireVehicleTeamSlotWindow, vehicleSpeedSlotDisabled, teamSlotWindowStartMs } from "../driving/team-gauge.ts";');
  }
  if (name === "ui") {
    lines.push('import { createTrackPickerWindowClass } from "../ui/track-picker-window.ts";');
    lines.push('import { loadTrackPickerWindowAssets, loadTrackCard } from "../ui/track-picker-window-assets.ts";');
    lines.push('import { createSettingsWindowClass } from "../ui/settings-window.ts";');
    lines.push('import { loadSettingsWindowAssets, parseOfficialBgmChoices } from "../ui/settings-window-assets.ts";');
    lines.push('import { ScrollbarController as b6, scrollbarGeometry as uT, dragScrollPosition as qa0, stepScrollPosition as nf, scrollPosition as qv, pointInRectangle as bc } from "../ui/scrollbar.ts";');
    lines.push('import { GarageLivePanels } from "../ui/garage-live-panels.ts";');
    lines.push('import { garageEquipmentCardKey, normalizedGarageKartPath } from "../ui/garage-live-panel-assets.ts";');
    lines.push('import { createGarageSelectionViewClass } from "../ui/garage-selection-view.ts";');
    lines.push('import { TouchPageSwipe as WP } from "../ui/touch-swipe.ts";');
    lines.push('import { CoatingPreviewSession as xa0 } from "../ui/coating-preview.ts";');
    lines.push('import { RandomTrackSession as Tc0 } from "../ui/random-track-session.ts";');
    lines.push('import { activateGarageAction, allGarageItems, clampGarageFavoriteOffset, commitGarageItem, confirmGarageSelection, favoriteGarageItems, filteredGarageItems, garageCategoryItems, garageDecorationItems, garageFavoriteKey, garageFavoriteKeys, garageSubTabs, selectGarageCategory, selectGarageDecoration, selectGarageItem, selectGarageLegacyAppearance, selectGarageSubCategory, selectedGarageKart, toggleGarageFavoriteItem } from "../ui/garage-selection.ts";');
    lines.push('import { activateSettingsControl, applySettingsGraphicsPreset, applySettingsPreset, changeSettingsVolume, closeSettingsCombo, moveSettingsSelection, repeatSettingsVolumeStep, resetSettingsSound, selectSettingsSpeed, selectSettingsVersion, setSettingsRoomSpeed, stepSettingsVolume, stopSettingsVolumePointer, toggleSettingsCombo, toggleSettingsOption } from "../ui/settings-interactions.ts";');
    lines.push('import { addGraphicsPresentationOptions } from "../ui/graphics-presentation-options.ts";');
    lines.push('import { activateReadyButton, activateReadyTrainingShortcut, applyReadyViewOptions, cancelReadyPointer, drawReadyButtonText, drawReadyImageButton, leaveReadyPointer, moveReadyPointer, pressReadyPointer, readyButtonAtPoint, readyButtonNodeId, refreshReadyViewRecord, releaseReadyPointer, selectReadyViewOption, setReadyViewSpeedChannel } from "../ui/ready-view-actions.ts";');
    lines.push('import { disposeReadyVehiclePreview, loadReadyVehiclePreview, renderReadyVehiclePreview } from "../ui/ready-vehicle-preview.ts";');
    lines.push('import { GarageCanvasCompositor } from "../ui/garage-compositor.ts";');
    lines.push('import { canFavoriteItem, centerOffset, defaultLocalProfile, favoriteItemIdentity, favoriteItemKey, favoriteItemKeys, hasSystemKartKey, isUnsignedInteger, loadLocalProfile, makeFavoriteItem, parseLocalProfile, resolveSystemKartVariant, saveLocalProfile, selectLocalKart, uniqueItemKey, validateFavoriteItems, validateFavoriteTracks, validateInteger, validateNonzeroItemId } from "../ui/local-profile.ts";');
    lines.push('import { loadBrowserProfile, syncBrowserProfile } from "../ui/profile-sync.ts";');
    lines.push('import { Taskbar as ry } from "../ui/taskbar.ts";');
    lines.push('import { WindowNotice as ds } from "../ui/window-notice.ts";');
    lines.push('import { selectReadyOption as J80, isReadyOptionSelected as Q80, readyButtonImageState as Z80, readyOptionTexture as P80, readyNodeVisible as fF, randomTrackGroupName as W80 } from "../ui/ready-options.ts";');
    lines.push('import { filteredTracks, randomGroupsForDisplay, gameTypeEnabled, matchingRandomGroup } from "../ui/track-picker.ts";');
    lines.push('import { changeFavoriteTrack, commitTrackSearch, confirmTrackSelection, placeInitialThemeOffset, searchTracks, selectTrackTheme, toggleTrackGameType } from "../ui/track-picker-actions.ts";');
  }
  if (name === "multiplayer") {
    lines.push('import { keyboardActionsForCode } from "../input/action-bindings.ts";');
    lines.push('import { showAccountServiceProgress } from "../multiplayer/account-progress.ts";');
    lines.push('import { loadMultiplayerSessionToken, saveMultiplayerSessionToken, clearMultiplayerSessionToken, loadLocalRiderNickname, saveLocalRiderNickname, clearLocalRiderNickname } from "../multiplayer/account-local-state.ts";');
    lines.push('import { accountOverlayStyle, accountPanelStyle, accountErrorMessages, styleAccountButtons, formatAccountServiceError, currentMultiplayerOrigin, multiplayerAccountEndpoint, multiplayerAuthHeaders } from "../multiplayer/account-ui-support.ts";');
    lines.push('import { loadLobbyAvatarAppearance } from "../multiplayer/lobby-avatar-appearance.ts";');
    lines.push('import { lobbyRiderSlots, roadblockRunnerId, decorateRoadblockRiders, wrapLobbyChatBubble } from "../multiplayer/lobby-room-helpers.ts";');
    lines.push('import { decorateIndividualRiders } from "../multiplayer/individual-rider-colors.ts";');
    lines.push('import { multiplayerReadyOptions } from "../multiplayer/ready-options.ts";');
    lines.push('import { MultiplayerLobbyController } from "../multiplayer/lobby-controller.ts";');
    lines.push('import { ReadyController } from "../timeattack/ready-controller.ts";');
    lines.push('import { LobbyRoomController, loadLobbyRoomController } from "../multiplayer/lobby-room-controller.ts";');
    lines.push('import { MultiplayerClientState } from "../multiplayer/client-state.ts";');
    lines.push('import { RpScenePreview } from "../multiplayer/rp-scene-preview.ts";');
    lines.push('import { RpResultAudio } from "../multiplayer/rp-result-audio.ts";');
    lines.push('import { RpResultNotice } from "../multiplayer/rp-result-notice.ts";');
    lines.push('import { RoadblockMissionNotice } from "../multiplayer/roadblock-mission-notice.ts";');
    lines.push('import { TrackChangeNotice } from "../multiplayer/track-change-notice.ts";');
    lines.push('import { LobbyCountdownMedia } from "../multiplayer/lobby-countdown-media.ts";');
    lines.push('import { LobbyEmotionAudio } from "../multiplayer/lobby-emotion-audio.ts";');
    lines.push('import { LobbyAvatarPreviews } from "../multiplayer/lobby-avatar-previews.ts";');
    lines.push('import { createLobbyAvatarCamera } from "../multiplayer/lobby-avatar-camera.ts";');
    lines.push('import { multiplayerBackendOrigin, multiplayerEndpoint } from "../multiplayer/backend-origin.ts";');
    lines.push('import { requestMultiplayerAccount, enterMultiplayerAccount, multiplayerAccountFromSession } from "../multiplayer/account-service.ts";');
    lines.push('import { currentAccountSession } from "../account/account-session.ts";');
    lines.push('import { accountTokenStore } from "../account/account-token-store.ts";');
    lines.push('import { multiplayerSessionToken } from "../account/account-runtime.ts";');
    lines.push('import { accountOwnedEquipment } from "../account/garage-ownership.ts";');
    lines.push('import { repairEquipmentForMultiplayer } from "../app/account-startup.ts";');
    lines.push('import { AccountLoginDialog } from "../multiplayer/account-login-dialog.ts";');
    lines.push('import { chooseGuestNickname } from "../multiplayer/guest-nickname.ts";');
    lines.push('import { chooseGameServer, requestGameServerEntry } from "../multiplayer/game-servers.ts";');
    lines.push('import { showGameServerPicker } from "../multiplayer/game-server-dialog.ts";');
    lines.push('import { roomChannelNames, roomChannelKey, roomStyleDropdown } from "../multiplayer/lobby-room-options.ts";');
    lines.push('import { chooseSignedInAccount } from "../multiplayer/account-choice-dialog.ts";');
    lines.push('import { addLobbyEmotionWheel, buildLobbyRoomTemplate, loadLobbyRoomTemplate } from "../multiplayer/lobby-room-template.ts";');
    lines.push('import { configureRpSceneCamera, decorateRpResultTemplate, rpSceneCameraMatrices } from "../multiplayer/rp-scene-helpers.ts";');
    lines.push('import { preloadRpFlyingPet } from "../multiplayer/rp-pet-preload.ts";');
    lines.push('import { confirmLobbyMessage, noticeLobbyMessage, createLobbyRoomDialog, createOrdinaryRoomDialog, createGameplayRoomDialog } from "../multiplayer/lobby-dialog-facade.ts";');
    lines.push('import { showLobbyMessageBox, showLobbyPasswordDialog, showLobbyTeamDialog, setLobbyDialogBusy, disposeLobbyDialog } from "../multiplayer/lobby-dialog-views.ts";');
    lines.push('import { showLobbyRoomCreationForm } from "../multiplayer/lobby-room-form.ts";');
    lines.push('import { showLobbyRoomSettings } from "../multiplayer/lobby-room-settings-dialog.ts";');
    lines.push('import { RaceLoadingScreen } from "../multiplayer/race-loading-screen.ts";');
    lines.push('import { handleLobbyEmotionKey, handleLobbyRoomKey, initializeLobbyRoom, loadLobbyRoom } from "../multiplayer/lobby-room-construction.ts";');
    lines.push('import { lobbyRoomNodeState } from "../multiplayer/lobby-room-state.ts";');
    lines.push('import { isEditableTarget } from "../input/gameplay-input-queue.ts";');
    lines.push('import { GameplayInputQueue } from "../input/gameplay-input-queue.ts";');
    lines.push('import { GamepadEdgePoller } from "../input/gamepad-edges.ts";');
    lines.push('import { AutoForwardAssist as Xl0 } from "../input/auto-forward.ts";');
    lines.push('import { NitroSeamlessQueue as Zl0 } from "../input/nitro-seamless.ts";');
    lines.push('import { RaceStartCoordinator } from "../multiplayer/race-start-coordinator.ts";');
    lines.push('import { LobbyAvatarCache, lobbyAvatarKey } from "../multiplayer/lobby-avatar-cache.ts";');
    lines.push('import { animateLobbyRoom, canAnimateLobbyRoom, isLobbyCountdownLocked, lobbyCountdownState, sendLobbyChat as sendLobbyRoomChat, sendLobbyEmotion, setLobbyStartPresentation, updateLobbyCountdown } from "../multiplayer/lobby-room-timing.ts";');
    lines.push('import { activateLobbyReadyShortcut, closeLobbyEmotionWheel, disposeLobbyRoom, hideLobbyRoom, installLobbyRoomKeyboard, removeLobbyRoomKeyboard, showLobbyRoom as showLobbyRoomLifecycle, toggleLobbyEmotionWheel, updateLobbyRoom } from "../multiplayer/lobby-room-lifecycle.ts";');
    lines.push('import { loadLobbyRoomTrack } from "../multiplayer/lobby-room-track.ts";');
    lines.push('import { initializeLobbyRace } from "../multiplayer/lobby-race-loader.ts";');
    lines.push('import { RoomState as Ul0 } from "../multiplayer/room-state.ts";');
    lines.push('import { formatMultiplayerError as C1 } from "../multiplayer/errors.ts";');
    lines.push('import { joinLobbyRoom, leaveLobbyRoom, listLobbyRooms, mutateLobbyRoom, quickJoinLobbyRoom, sendLobbyChat, submitLobbyRoomSettings, switchLobbyTeam } from "../multiplayer/lobby-actions.ts";');
    lines.push('import { receiveLobbyEvent } from "../multiplayer/lobby-events.ts";');
    lines.push('import { bindLobbyClient, disposeLobby, handleRoomShortcut, lobbyNetworkDiagnostics, maybeAutoReadyInRoom, quickJoinShortcut, refreshLobbyAutoReady, renderLobby } from "../multiplayer/lobby-lifecycle.ts";');
    lines.push('import { cancelLobbyDialog, castLobbyKickVote, confirmLeaveLobbyRoom, lobbyDialogOptions, openLobbyDialog, syncKickVoteDialog } from "../multiplayer/lobby-dialogs.ts";');
    lines.push('import { openMultiplayerLobby } from "../multiplayer/lobby-open.ts";');
    lines.push('import { syncRaceLoadingView } from "../multiplayer/lobby-loading.ts";');
    lines.push('import { showLobbyRoom } from "../multiplayer/lobby-room-view.ts";');
    lines.push('import { changeLobbyRoomInfo, confirmLobbyAction, createLobbyRoom } from "../multiplayer/lobby-settings.ts";');
    lines.push('import { cancelCountdownModals, endChangingModal, finishChangingLoad, isChangingModalCurrent, releaseChanging } from "../multiplayer/lobby-changing.ts";');
    lines.push('import { chooseLobbyGarage, confirmLobbyGarage } from "../multiplayer/lobby-garage.ts";');
    lines.push('import { chooseLobbyTrack, confirmLobbyTrack } from "../multiplayer/lobby-track.ts";');
    lines.push('import { PeerMesh as pl0 } from "../multiplayer/peer-mesh.ts";');
    lines.push('import { MotionRoundTripTracker as gl0 } from "../multiplayer/network-timing.ts";');
    lines.push('import { bindRaceScope, createRaceConnection } from "../multiplayer/race-session.ts";');
    lines.push('import { acceptGameMotion, acceptServerMotion, captureNetworkClock, networkDiagnostics as getNetworkDiagnostics, sendGameMotion, subscribeGameMotion } from "../multiplayer/client-motion.ts";');
    lines.push('import { disposeClient, onClientClose, sameOriginOfferUrl, sendControlRequest, subscribeControl } from "../multiplayer/client-control.ts";');
    lines.push('import { connectGameClient } from "../multiplayer/client-connect.ts";');
    lines.push('import { configuredTransport } from "../multiplayer/local-config.ts";');
    lines.push('import { acquireReadyToonEnvironment, enterTimeAttackReady, openTrackSelect, readyStageContext, resolveRandomSelection, selectReadyChoice, selectReadyTrack, startRaceFromReady } from "../timeattack/ready-flow.ts";');
    lines.push('import { changeReadyFavoriteItems, changeReadyFavoriteTrack, closeReadyMultiplayer, disposeReadyController, getReadyWindowNotice, isReadyModalBusy, readyNetworkDiagnostics, refreshReadyRecord, releaseReadyForRace, renderReadyController, returnMultiplayerToSinglePlayer, setReadyWindowNotice, updateReadyWindowNotice } from "../timeattack/ready-controller-state.ts";');
    lines.push('import { applyReadyMultiplayerGarage, openReadyMultiplayer, readyMultiplayerGarageOptions } from "../timeattack/ready-multiplayer.ts";');
    lines.push('import { applyImmediateReadyGarageSelection, openReadyGarage, openReadyGarageX, returnReadyGarage, selectReadyGarage, showReadyGarageError } from "../timeattack/ready-garage.ts";');
    lines.push('import { closeReadySettings, confirmReadySettings, handleReadyShortcut, openReadySettings, previewReadySettings, publishReadyRaceSpeed, releaseReadyToonEnvironment, saveReadyGameOptions, showReadyTrackSelectError } from "../timeattack/ready-settings.ts";');
  }
  if (name === "app") {
    lines.push('import { initializeApplication } from "../app/application-construction.ts";');
    lines.push('import { fitGameViewport, mountGameViewport, resolveStartupSelection, watchFrontendVersion } from "../app/boot-support.ts";');
    lines.push('import { canReloadForUpdate, configureApplicationBackbuffer, haltApplicationRuntime, handleApplicationShortcut, onApplicationKeyDown, restartRaceFromPause, toggleRacePause } from "../app/application-controls.ts";');
    lines.push('import { disposeApplicationRuntime } from "../app/application-disposal.ts";');
    lines.push('import { createPresenterHost, createReadyHost, getOrCreatePresenter, getOrCreateReadyCoordinator } from "../app/host-bridges.ts";');
    lines.push('import { createGhostRecordMenu, currentGhostRecordKey, mountGhostRecordMenu, selectGhostTrack } from "../app/ghost-menu.ts";');
    lines.push('import { loadStartupResources, prepareStartupReady, registerNewRider } from "../app/startup-resources.ts";');
    lines.push('import { accountNeedsRiderRegistration, ensureStartupAccount, registerAccountRider, retryStartupProfile, sanitizeStartupProfile, setAccountProfileWriter } from "../app/account-startup.ts";');
    lines.push('import { activeBrowserSession } from "../account/account-runtime.ts";');
    lines.push('import { createDrivingPipelineHost, createRaceBuilderHost, getOrCreateDrivingPipeline, getOrCreateRaceBuilder } from "../app/runtime-hosts.ts";');
    lines.push('import { getOrCreateRecordService, updateKartBoosterState } from "../app/race-services.ts";');
    lines.push('import { devToolsTrackObjects, devToolsTrackObjectsSource, devToolsTrackOwner } from "../app/track-diagnostics.ts";');
    lines.push('import { currentRhoLibrary, getOrCreateAudioDirector, getOrCreateRaceSession, getOrCreateReplayLibrary, requireRacePhysics, requireRaceTrack } from "../app/shell-state.ts";');
    lines.push('import { getActiveWindowNotice, mountDevTools, mountDevToolsTrackObjectsOverlay, mountDevToolsTrackOverlay, onApplicationViewportResize, readPresenterClock, setActiveWindowNotice, setDevToolsTrackObjectKind, writePresenterClock } from "../app/shell-accessors.ts";');
    lines.push('import { shellRouting } from "../app/shell-routing.ts";');
    lines.push('import { startSinglePlayerRace, returnToReady } from "../app/race-navigation.ts";');
  }
  if (name === "library") {
    lines.push('import { RaceHudController } from "../ui/race-hud-controller.ts";');
    lines.push('import { MultiplayerWindowView } from "../ui/multiplayer-window-view.ts";');
    lines.push('import { GarageConfirmationDialog } from "../ui/garage-confirmation-dialog.ts";');
    lines.push('import { garageConfirmationFontFamily as PR, loadGarageConfirmationFont, loadGarageConfirmationAssets, loadGarageConfirmationBlueprint, garageConfirmationPartEquipRequest, garageConfirmationLayout } from "../ui/garage-confirmation-assets.ts";');
    lines.push('import { GiantBoostHud } from "../ui/giant-boost-hud.ts";');
    lines.push('import { MultiplayerRaceHud } from "../ui/multiplayer-race-hud.ts";');
    lines.push('import { MultiplayerResultView } from "../ui/multiplayer-result-view.ts";');
    lines.push('import { RoadblockResultView } from "../ui/roadblock-result-view.ts";');
    lines.push('import { DerivedOverlayRenderer } from "../ui/derived-overlay-renderer.ts";');
    lines.push('import { ModelBinaryCursor } from "../resources/model-binary-cursor.ts";');
    lines.push('import { ModelObjectReader } from "../resources/model-object-reader.ts";');
    lines.push('import { createModelRecordDecoders, isModelElement } from "../resources/model-record-decoders.ts";');
    lines.push('import { KartBoosterEffectHost, KartBoosterSharedSources, boosterKindForState, waveKindForState } from "../vehicle/kart-booster-effects.ts";');
    lines.push('import { defaultCnSpeedType, findSpeedTypeEntry } from "../physics/speed-baseline.ts";');
    lines.push('const multiplayerResultDependencies = { loadBml: F9, attribute: T, cloneNode: h2, loadTeams: fa, loadDye: Pj, loadView: options => te.load(options), smoothImages: Co, stageHeight: $2, formatTime: Eo, newPageClock: time => new Vj(time), showRewards: true };');
    lines.push('const roadblockResultDependencies = { loadBml: F9, attribute: T, cloneNode: h2, rectangle: V0, numberTokens: j2, loadView: options => te.load(options), projectTexture: fQ };');
    lines.push('const derivedOverlayDependencies = { attribute: T, smoothImages: Co, smoothPixels: image => OR(UB(new Uint8ClampedArray(image.pixels), image.width, image.height)), setPlayCamera: Aa };');
    lines.push('import { isPlayableGameplay } from "../multiplayer/gameplay-admission.ts";');
    lines.push('import { multiplayerModeTiles } from "../multiplayer/mode-tiles.ts";');
    lines.push('import { drawMultiplayerWindowNode } from "../ui/multiplayer-window-draw.ts";');
    lines.push('import { renderMultiplayerWindow } from "../ui/multiplayer-window-render.ts";');
    lines.push('import { multiplayerCanvasButton, updateMultiplayerHoverRegion, closeMultiplayerCombo, chooseMultiplayerCombo } from "../ui/multiplayer-window-actions.ts";');
    lines.push('import { drawMultiplayerComboPopup } from "../ui/multiplayer-window-combo.ts";');
    lines.push('import { renderLobbyList } from "../ui/lobby-list-render.ts";');
    lines.push('import { loadMultiplayerWindowAssets } from "../ui/multiplayer-window-assets.ts";');
    lines.push('import { activateLobbyListEntry } from "../ui/lobby-list-actions.ts";');
    lines.push('import { drawLobbyListNode } from "../ui/lobby-list-draw.ts";');
    lines.push('import { personalBoostFrame, teamBoostFrame } from "../ui/race-hud-boost.ts";');
    // item-mode(hud): item slots and the item race HUD layer.
    lines.push('import { buildItemSlotCommands, loadItemSlotDefinition } from "../ui/item-slot-hud.ts";');
    lines.push('import { ItemHud } from "../ui/item-hud.ts";');
    lines.push('import { readStoredItemHudOptions } from "../ui/item-hud-options.ts";');
    lines.push('import { giantControllerDuration as itemHudControllerDuration } from "../ui/giant-boost-hud-model.ts";');
    lines.push('import { collectItemHudPlayPanels, finalizeItemHudPlayPanels } from "../ui/item-hud-play-panels.ts";');
    lines.push(`const itemSlotDependencies = { attribute: T, numbers: j2, parseBml: s2, decodeTexture: p2, findResource: ln };
const itemHudDependencies = {
  attribute: T, numbers: j2, parseBml: s2, decodeTexture: p2, findResource: U1,
  geometry: lt, place: l5, createRenderer: () => new fn(new Map()),
  cloud: {
    attribute: T, parseBml: s2, findResource: U1, parseModel: y9,
    collectPlayPanels: collectItemHudPlayPanels, finalizePlay: finalizeItemHudPlayPanels,
    loadPlayScene: (binding, library) => Rw(binding, library, { convertClientCoordinates: false }),
    createPlayRuntime: (binding, scene, tick) => new Iw(binding, scene, tick),
    createRenderer: runtimes => new fn(runtimes),
    makeUi: d5, layoutUi: dn, materialize: dt,
    controllerDuration: itemHudControllerDuration,
    // The cover's billboards and hierarchy culling need a perspective camera.
    createCamera: () => new Z9(),
  },
  warn: message => console.warn(message),
};`);
    lines.push('const raceHudDependencies = { createShadow: texture => new xJ(texture), createRenderer: () => new fn(new Map()), createCache: () => new O5(), createRankPresentation: () => new UQ(), createGaugePulse: Jp, loadClassicGauge: (library, kind) => jl.load(library, kind), validateTick: Pw, buildSpeedSlots: XJ, buildTimeCommands: jJ, buildRankCommands: JJ, buildTeamGaugeCommands: YJ, materializeDrawOrder: dt, requireDrawNode: Xl, scaleGauge: Os, alignMarker: nI, advanceGaugePulse: jR, nativeSine: Ro, get reorderDurationMs() { return px; } };');
    lines.push('const lobbyListDrawDependencies = { attribute: T, rectangle: V0, modeForButton: Zc, get interactiveNames() { return aQ; }, imageState: st, drawTexture: ct, fitRoomTitle: CX, measure: ve, drawText: m9, randomTrack: X6, get fontFamily() { return Yp; }, showRoomStatus: true };');
    lines.push('const lobbyListRenderDependencies = { viewport: Sr, modeForButton: Zc, roomLabel: rR };');
    lines.push('const multiplayerWindowAssetDependencies = { loadBml: F9, findResource: U1, decodeTexture: p2, frame: Ft, attribute: T, buttonStyle: m4, parseBml: s2, loadFont: f5, get fontFamily() { return Sn; } };');
    lines.push('const multiplayerWindowDrawDependencies = { attribute: T, rectangle: V0, innerRectangle: E9, paintFrame: C9, color: E8, charLayout: ga, charGlyphs: pa, paintImageButton: ct, numbers: j2, drawText: m9, comboEntries: OM, captionRectangle: f3, nodeConfig: an, get fontFamily() { return Sn; } };');
    lines.push('const multiplayerComboDependencies = { entries: OM, attribute: T, rectangle: V0, paintFrame: C9 };');
    lines.push('const multiplayerWindowViewDependencies = { newHitLayer: (...args) => new nR(...args), decoratePopup: tR, attribute: T, measureText: ve, drawText: m9, color: E8, releaseFont: G1, get fontFamily() { return Sn; }, renderWindow: view => renderMultiplayerWindow(view, Sr), drawNode: (view, node, parent, visible) => drawMultiplayerWindowNode(view, node, parent, visible, multiplayerWindowDrawDependencies), canvasButton: (view, node, rect, text, state) => multiplayerCanvasButton(view, node, rect, text, state, T), updateHoverRegion: (view, event) => updateMultiplayerHoverRegion(view, event), closeCombo: view => closeMultiplayerCombo(view), chooseCombo: (view, index) => chooseMultiplayerCombo(view, index), drawComboPopup: view => drawMultiplayerComboPopup(view, multiplayerComboDependencies), loadAssets: view => loadMultiplayerWindowAssets(view, multiplayerWindowAssetDependencies) };');
    lines.push(`const garageConfirmationAssetDependencies = {
  loadFont: f5, parseBml: s2, attribute: T, frame: Ft,
  decodeImage: async bytes => $p(await createImageBitmap(
    new Blob([bytes], { type: "image/png" }))),
  rectangle: V0, innerRectangle: E9,
};
const garageConfirmationDialogDependencies = {
  loadFont: library => loadGarageConfirmationFont(library, garageConfirmationAssetDependencies),
  loadAssets: library => loadGarageConfirmationAssets(library, garageConfirmationAssetDependencies),
  releaseFont: G1, partEquipRequest: garageConfirmationPartEquipRequest,
  layout: (blueprint, lineCount, size, request) =>
    garageConfirmationLayout(blueprint, lineCount, size, request,
      garageConfirmationAssetDependencies),
  attribute: T, resizeCanvas: p3, pixelRatio: xe,
  paintFrame: C9, drawText: m9, captionOffset: an,
  captionRectangle: f3, innerRectangle: E9,
  fontFamily: PR,
};
const giantBoostHudDependencies = {
  createRenderer: () => new fn(new Map()),
  createCamera: () => new a5(), createWorld: () => new D1(),
  createViewport: () => new Y2(), applyCamera: Aa,
  attribute: T, loadModel: aI, findResource: Yi, parseBml: s2,
  decodeTexture: p2, makeUi: d5, layoutUi: dn, panels: dt,
};
const multiplayerRaceHudDependencies = {
  createGap: () => new DQ(),
  loadTimeGap: (library, target) => Bw.load(library, target),
  resolveDye: We, loadHudAssets: eI, attribute: T, loadMinimap: oI,
  createHud: (assets, minimap) => new tI(assets, minimap),
  loadGiant: library => Fw.load(library), normalizeRank: XM,
  // item-mode(hud): the item race layer and the saved item options.
  loadItemHud: (library, options) => ItemHud.load(library, itemHudDependencies, options),
  itemHudOptions: () => readStoredItemHudOptions(),
  get racingState() { return X2.Racing; },
  viewportWidth: H2, viewportHeight: $2,
};`);
    lines.push('import { speedTypeEntry as r7 } from "../physics/speed-baseline.ts";');
    lines.push('import { loadSwWithReadableCodec } from "../codecs/sw-compat.ts";');
    lines.push('import { getResource, initializeResourceLookup, resourceCanonicalCandidates, resourceEntriesUnderCanonicalPrefix, resourceExactCanonicalCandidates, resourceFindSibling, resourceHasManifestMount, resourcePhysicalContainerNames, resourceResolveContainerPath } from "../resources/resource-lookup.ts";');
    lines.push('import { mapAssets, mapCatalog, timeAttackRandomTrackGroups, timeAttackRandomTrackNames, timeAttackTrackCatalog, trackMetadata, trackMetadataCatalog, trackTitles } from "../resources/track-catalog.ts";');
    lines.push('import { loadVehicleEngineGrades, loadVehicleItemIds, loadVehicleLinkCharacterIds, vehicleAssets, vehicleCatalog, vehicleEngineGrade, vehicleItemId, vehicleLinkCharacterId, vehicleTextureKey } from "../resources/vehicle-identity.ts";');
    lines.push('import { bodyParams, timeAttackGarageCatalog, timeAttackKartItem, timeAttackPlateItem, timeAttackCharacterItem, timeAttackLinkedCharacterItem, timeAttackDecorationItem } from "../resources/timeattack-items.ts";');
    lines.push('import { loadTimeAttackGarageCatalog } from "../resources/garage-catalog.ts";');
    lines.push('import { itemTableGarageDefinitions } from "../resources/item-table.ts";');
    lines.push('import { vehicleTitles } from "../resources/vehicle-titles.ts";');
    lines.push('import { loadTrackConfig } from "../resources/track-config.ts";');
  }
  for (const dependency of order) {
    if (dependency === name) break;
    const names = imports.get(name).get(dependency);
    // app.js explicitly imports every region in source order. The other
    // modules only import the bindings they reference.
    if (name === "app") {
      if (names?.size) lines.push(`import { ${groupNames(names)} } from "./${dependency}.js";`);
      else lines.push(`import "./${dependency}.js";`);
    } else if (names?.size) {
      lines.push(`import { ${groupNames(names)} } from "./${dependency}.js";`);
    }
  }
  lines.push("");
  if (name === "app") {
    lines.push('const startupSelectionDependencies = { defaultProfile: gr, resolveSystemKart: b4, isSpecialKartId: n3, displayKartName: Mw, startTrack: jf };');
    lines.push('setAccountProfileWriter(cT);');
    lines.push('const applicationConstructionDependencies = { outputColorSpace: qe, makeKartView: scene => new Vg(scene), makeHud: (root, actions) => new $o0(root, actions), collectEngineDiagnostics: jo0, makeAssets: hud => new Jo0(hud), makeInput: () => new jl0(), makeCanvasDiagnostics: (...args) => new qs0(...args), makeTouchControls: (...args) => new l60(...args), makeBlackBar: root => new yr0({ root }), makeResizeObserver: callback => new ResizeObserver(callback) };');
    lines.push("");
  }
  if (name === "formats") {
    lines.push('const panelMaterializeDependencies = { attribute: T, inset: YB, uv: dX, font: ga, rasterizeInto: $B, offsetInto: lX, copyInto: uX, rasterize: pa };');
    lines.push(`function characterSceneDependencies() { return {
  loadBodyTexture: QY, loadFaceTexture: YY,
  orientClientGroup: Hl, orientNativeGroup: cn,
  defaultProperties: ju, inheritProperties: ju,
  rigidGeometry: nZ, SkinnedGeometry: vR,
  registerSkinCulling: qm,
  collectBoneMatrices: (source, pose) => AR.collect(source, pose),
  applyTransform: iZ, isRenderableChild: rZ,
  makeToonMaterial: bo, applyMaterialProperties: Mo,
  toonProperties: tZ, configureRenderOrder: ie,
  OutlineController: N6, cullHierarchy: JG,
  isVisible: Xu, configureToonUniforms: xo, poseMatrix: ZY,
}; }`);
    lines.push(`function trackSceneDependencies() { return {
  inspectRoot: hB, validateInspection: ZK, isMorphGeometry: Vu,
  stripIndices: Vp, allocateRigidGeometry: aj,
  allocateTriangleGeometry: cj, finishSharedGeometry: oj,
  loadEnvironment: library => rn.load(library), StageBinding: ha,
  localNodeMatrix: uj, poseOverrideMatrix: GB, sceneVisibility: TK,
  prsController: Lb, makePrsRuntime: zG, loadTexture: AB,
  inheritToonTexture: YK, createToonMaterial: bo,
  applyMaterialProperties: Mo, createBasicMaterial: CB,
  createTextureControllers: _K, ColorController: Zm,
  initializeMaterialUniforms: EB, makeMorphGeometry: lj,
  MorphController: Qm, configureRenderOrder: ie, bindTexture: uK,
  configureToonUniforms: xo, OutlineController: N6,
  isVisible: Ob, updateLightFactor: PK, floatColor: _B,
  updateMaterialEntry: dj, resetNodeControllers: QK,
  eachVisibility: p8, resetTextureControllers: BK, eachPrs: ku,
  playPrs: GW, materialControllers: Lu, setPrsCycleMode: BW,
  stopPrs: RW, updateNodeVisibility: JK, readCameraPose: tj,
  updateNodeWorld: nj, updateCulling: wq, cullBlackPlanes: Sq,
  collectVisible: Gp, updateNoCameraCulling: ej,
  serializeLocalTransform: Jm, readPoseOverrideFallback: hj,
  setClientWorldRoot: BB, incrementFrameSerial: () => { Hc += 1; },
}; }`);
    // Resolve late format constants only when a camera is constructed.
    lines.push(`function cameraMathDependencies() { return {
  f32: n0, floatWord: g1, bodyBasis: kB, clientVector: g4,
  column: Qt, setColumn: zl, normalize: Np, cross: Op, scale: Kc, add: Hb,
  alignMotorcycle: Ej, orientation: LB, orientationDot: da,
  scaleOrientation: ew, smoothOrientation: O6, speed: Ul,
  smoothScalar: qc, clampRatio: bs, basisFromOrientation: PB,
  tiltBasis: _j, outputVector: v8, clientDot: Ou, horizontalFov: we,
  resolutionFov: z6, parseRoadNumber: y8, emptyVector: Bj,
  baseFov: DB, activeFov: VB, altActiveFov: NB, boostFov: OB,
  specialFovLimit: bj, p3528SpecialFovLimit: Mj, near: xj, far: Sj,
}; }`);
    lines.push(`function toonOutlineDependencies() { return {
  defaultProfile: () => kp,
  nextSerial: yb,
  enabled: () => $c,
  projection: {
    generation: () => Lp, prepare: SB, transpose: Fp, multiply: Dp,
    transform: SK, model: Li, combined: Pi, screen: xB, clip: $r,
  },
  update: () => ({
    profileForSelector1: AK, profileForOtherSelector: Xm,
    get defaultProfile() { return kp; },
    get enabled() { return $c; },
    overrideForObject: bK, colorFromArgb: toonColorFromArgb,
    nextSerial: yb,
    projectedDepth: (body, camera) => {
      Mb.setFromMatrixPosition(body.matrixWorld).project(camera);
      return Mb.z;
    },
  }),
}; }`);
    lines.push(`function awardPodiumDependencies() { return {
  makeDistanceController: parsed => on.fromParsed(parsed),
  baseFov: () => z6(0).base,
  horizontalFov: we,
}; }
function awardPodiumLoadDependencies() { return {
  parseModel: y9, loadScene: W1,
  resolveTexture: (library, path, resource) => sn(library, path, void 0, resource),
}; }`);
    lines.push("");
  }
  if (name === "vehicle") {
    lines.push('const mqTachometerOps = { Scene: D1, Camera: a5, Geometry: t9, BufferAttribute: _0, Mesh: D2, BoundingSphere: yr, Vector3: H, Vector2: B2, DataTexture: J9, ShaderMaterial: Vt, drawCommands: WQ, systemUiSmoothing: Co, resamplePixels: UB, finishResampledPixels: OR, depth: xs, rgbaFormat: e9, unsignedByteType: _9, srgbColorSpace: v9, clampWrapping: S1, linearFilter: u9, nearestFilter: h9, lessEqualDepth: y1, customBlending: u1, additiveEquation: R9, sourceAlpha: l1, oneMinusSourceAlpha: v1 };');
    lines.push('const motionBlurRendererOps = { Scene: D1, Camera: a5, Geometry: t9, FloatAttribute: M1, Mesh: D2, Vector2: B2, Vector3: H, ShaderMaterial: Vt, RenderTarget: nn, DataTexture: J9, FramebufferTexture: IN, decodePng: p2, colorSpace: v9, clampWrapping: F1, linearFilter: u9, textureFormat: e9, textureType: _9, customBlending: u1, additiveEquation: R9, sourceAlpha: l1, oneMinusSourceAlpha: v1 };');
    lines.push('const trackSurroundAudioOps = { decode: Q9, route: S9, setGain: he, setLoop: w4 };');
    lines.push('const readyCameraOps = { isPrsController: P6, unsupportedPrs: Nm, createPrsRuntime: zG, animatePrs: PW, fieldOfView: we };');
    lines.push('const v1TachometerOps = { attribute: T, makeCharger: TJ, makeGaugePulse: Jp, updateCharger: _J, chargerVisibility: GJ, updateGaugePulse: jR, updateResettingBlink: F50, frameAlpha: vg };');
    lines.push('const xgenTachometerOps = { attribute: T, initialGauge: jh, setGaugeTarget: Ei, beginGaugeDrain: oC, advanceGauge: aC, pulseAlpha: XR };');
    lines.push('const trackAdmissionOps = { routeSurfaceKind: Eg, descriptorUses: qG, isDeferredRoad: mo, unsupportedRoad: NG, isItemOnlyMovable: HG, admitObstacle: Um, parseEvent: $k, unsupportedEventSound: eL };');
    lines.push('const lteDodgeInputOps = { positiveAction: l2.ModeImpulsePositive, negativeAction: l2.ModeImpulseNegative, lockMs: Ql.lockMs };');
    lines.push('const animationActionDependencies = { createSequence: (source, motions, initial) => new _r(source, motions, initial), oneWay: m1, returnable: h5 };');
    lines.push('const coinOwnerOps = { createObject: () => new T2(), originalAsset: nl, decodeModel: y9, decodeAudio: Q9, loadModel: c5, createContact: (...args) => new y10(...args), routeAudio: S9 };');
    lines.push('const chargerEffectOps = { decodeModel: y9, loadModel: c5, prepareTexture: ye0, configureMesh: ie, configureMaterials: ve0 };');
    lines.push('const coatingOwnerOps = { createTextures: library => new yB(library), loadProjection: Ak };');
    lines.push('const movingEventOps = { transformPoint: e3 };');
    lines.push('const trackEventOwnerOps = { createAnimator: (root, projection) => new qn0(root, projection), copyPosition: copyEventPoint };');
    lines.push('const vehicleRuntimeOps = { resolveResources: t3, wheelAssets: yw, palette: We, prepareAppearance: vw, garageKart: p5, parseParameters: cv, makeVisual: wk, shortAssetName: a40, loadCoating: (...args) => d7.load(...args), needsParticleModification: Bk, loadXunModification: (...args) => Do.loadXun(...args), loadParticleModification: (...args) => c6.load(...args), disposeObject: u5 };');
    lines.push('const kartAudioOps = { route: S9, setGain: he, setLoop: w4, roadSoundEnabled: BQ };');
    lines.push('const kartAudioLoadOps = { decodeMotor: (context, bytes) => decodeMotorAudio(context, bytes, S30), decodeAudio: Q9, parseRoadConfig: bytes => parseRoadSoundConfig(bytes, s2, T), createContext: () => new AudioContext() };');
    lines.push('const vehicleAssetOps = { resolveKartIdentity: b4, tachometerSelection: O50, useClassicHud: E50, resourceVersion: Bt, loadClassicTachometer: () => uv.load(), loadTachometerConfig: $50, makeTacho1: config => new fv(config), makeMqTacho: config => new Fk(config), loadNineTacho: (...args) => p7.load(...args), loadV1Tacho: (...args) => Ta.load(...args), loadXGenTacho: (...args) => Gr.load(...args), loadAudio: (...args) => pv.load(...args), loadEffects: (...args) => Ca.load(...args), loadTrails: (...args) => Ea.load(...args), makeDriftSetup: Ze0, loadDriftEffects: (...args) => iv.load(...args), loadMotionBlur: (...args) => sv.load(...args), loadZetAir: (...args) => lv.load(...args), loadShockWave: (...args) => av.load(...args), loadExhaust: (...args) => rv.load(...args), loadCrash: (...args) => nv.load(...args), loadCharger: (...args) => tv.load(...args), loadLampFlares: (...args) => s6.load(...args), kartModelRoot: J5, loadShadow: (...args) => fr.load(...args), paintColor: We, loadDecoration: Jw, loadAccessory: hr, physicsParams: jt0, rootExtent: el, collisionShape: v90, disposeObject: u5 };');
    lines.push('const trackMapOps = { decodeModel: y9, assetProvenance: X30, loadLteCoins: A10, loadWeather: A30, loadWarp: b30, validateCourse: Y30, lensFlareAnchor: c30, dummySounds: Vn0, extractRoad: YW, mapMovingObjects: K30, additionalMatrixRoots: j30, admitMovingObject: Um, parseEventProjection: $k, makeEventRuntime: projection => new Kn0(projection), hasDeferredRoad: mo, isDeferredRoadMaterial: Fl, unsupportedRoad: NG, hasRail: Ri, loadRailConfig: w30, loadRailCapture: y30, resourceVersion: Bt, isLteTrack: Vw, loadAdmission: J30, loadMultiplayerAdmission: Z30, makeReadyCamera: model => new I30(model), loadAdvertisements: Ln0, textureCandidates: hB, textureStatus: sn, loadEnvironment: library => rn.load(library), loadScene: c5, warpNextCamera: O30, configureSkydome: i40 };');
    lines.push(...itemWorldVehicleOps); // item-mode(world)
    lines.push('const characterAssetOps = { resolveIdentity: pk, chooseCostume: CR, decodeMotion: FI, linkedMotionNames: qp, specialMotionNames: HY, standardMotionNames: WY, linkedController: s40, specialController: o40, standardController: r40, awardController: (...args) => new b10(...args), faceTextureSources: SR, collectFaceMotionAssets: xR, palette: We, parseModel: xa, createScene: TR };');
    lines.push('const slipstreamVisualOps = { decodeModel: y9, loadModel: c5 };');
    lines.push('const slipstreamAudioOps = { loop: w4, connect: S9 };');
    lines.push('const normalRaceModes = { isSoloMode: Q30, isMultiplayerMode: e40 };');
    lines.push("");
  }
  if (name === "driving") {
    lines.push('const trackedTriangleMath = { cloneVector: I1, centroid: Rg, subtract: N1, scale: Tt, f32: t0 };');
    lines.push('const vehicleSurfaces = { parseRouteTag: Vo, surfaceKind: Eg, railId: Ri, roadSurface: Mt };');
    lines.push("");
  }
  if (name === "ui") {
    lines.push('const localProfileDependencies = { normalizeGarage: E20, validateGarage: GI, garageKart: p5, systemKarts: Cr, resolveVariant: xw };');
    lines.push(`const garageLivePanelDependencies = {
  createRenderer: () => new I4({ alpha: true, preserveDrawingBuffer: true,
    powerPreference: "high-performance" }),
  createCamera: (kind, width, height) => Qs(kind, width, height),
  createImporter: () => new Tr(), sizePreviewCamera: $a0, cameraYaw: J3,
  outputColorSpace: qe,
  motion: { cameraYaw: J3, resetLinkedPresentation: Zv,
    now: () => performance.now() },
  assets: { coatingEquipment: Ak, equipmentKey: garageEquipmentCardKey,
    loadEquipment: La0, disposeCharacter: af, loadCharacter: Ho,
    kartKey: N3, disposeKart: Js, loadKart: Qv, garageKart: p5,
    normalizedKartPath: normalizedGarageKartPath, loadPreview: T7,
    disposePreview: Lt, createCoatingFitting: JP },
  render: { kartKey: N3, equipmentKey: garageEquipmentCardKey,
    frameKartCamera: Ua0, updateKartCard: ey, updatePreview: T4,
    advanceKartTransform: o80, updateOrdinaryPreview: nF, visualState: ZP,
    renderScene: f4, pixelRatio: xe, disposeCharacter: af,
    disposeKart: Js },
};`);
    lines.push('const garageSelectionDependencies = { blockedKartItem: n3, legacyFamily: of, validateKartItem: j6, selectProfile: aT, findKart: pT, findCharacter: cf };');
    // qg and Ie are declared later in this recovered module. Read them when
    // the user action occurs, after ES module initialization has finished.
    lines.push('const garageFavoriteDependencies = { get maxFavorites() { return qg; }, gridStep: i4 };');
    lines.push('const settingsInteractionDependencies = { get tabs() { return Ie; }, versions: Qd, versionStatus: Ac, speedChoices: Di, fallbackSpeed: wa0, defaultSound: _P, volumeThumb: tm };');
    lines.push('const settingsWindowAssetDependencies = { parseBml: s2, decodePng: p2, attribute: T, frameState: Ft, buttonStyle: m4, loadAutoImage: ma, registerFont: f5, scrollbarAssets: Hv };');
    lines.push('const settingsWindowDependencies = { loadAssets: library => loadSettingsWindowAssets(library, settingsWindowAssetDependencies), parseBgmChoices: parseOfficialBgmChoices, releaseFont: G1, configureCanvas: p3, pixelRatio: xe, layoutRect: V0, clientRect: E9, captionPosition: an, captionRect: f3, measureText: ve, paintText: m9, paintFrame: C9, keyboardLabel: SP, gamepadLabel: sa0, gamepadButtons: Hg, validGamepadCode: EP, usedGamepadCode: ca0, browserKeyCode: xP, validKeyCode: CP, get tabs() { return Ie; }, versions: Qd, defaultVersion: C4, versionStatus: Ac, speedChoices: Di, fallbackSpeed: wa0, speedChannel: zv, channelText: VP, keyActions: ut, defaultKeyMap: Br, dialogShortcuts: BP, defaultSound: _P };');
    lines.push('const trackPickerAssetDependencies = { parseBml: s2, decodePng: p2, frame: Ft, buttonStyle: m4, scrollbar: Hv, captionOffset: an, loadFont: f5 };');
    lines.push('const trackPickerWindowDependencies = { loadAssets: (library, groups) => loadTrackPickerWindowAssets(library, groups, trackPickerAssetDependencies), loadTrackCard: (library, path) => loadTrackCard(library, path, { decodePng: p2 }), releaseFont: G1, layoutTree: jc, layoutRect: V0, frameClient: E9, paintFrame: C9, paintText: m9, measureText: ve, configureCanvas: p3, pixelRatio: xe, positionControl: aw, noticeLayout: Wo, paintNotice: qP };');
    lines.push('const readyViewDependencies = { formatRecord: yT, speedChannel: Ue, defaultVersion: ze };');
    lines.push('const readyButtonDrawingDependencies = { paintFrame: ct, paintText: df, translate: Yn };');
    lines.push(`class Ma0 extends GarageCanvasCompositor {
  constructor(canvas) {
    super(canvas, {
      createCanvas: () => document.createElement("canvas"),
      createRenderer: target => new I4({ canvas: target, alpha: true,
        preserveDrawingBuffer: true, powerPreference: "high-performance" }),
      createScene: () => new D1(),
      createCamera: () => new Fm(),
      createMaterial: options => new $1(options),
      createQuad: material => new D2(new Ar(1, 1), material),
      createTexture: target => new bA(target),
      outputColorSpace: qe,
      canvasTextureFilter: u9,
      paintTextureFilter: h9,
    });
  }
}`);
    lines.push("");
  }
  if (name === "timeattack") {
    lines.push('const vehiclePreviewDependencies = { createRenderer: () => new I4({ alpha: true, preserveDrawingBuffer: true, powerPreference: "high-performance" }), outputColorSpace: qe, createCamera: (width, height) => Qs("preview", width, height), createImportToken: () => new Tr(), loadSubject: T7, disposeSubject: Lt, updateSubject: T4, renderScene: f4 };');
    lines.push('const firstRiderDialogDependencies = { parseBml: s2, attribute: T, frameState: Ft, windowRect: V0, frameInset: E9, captionOffset: an, captionRect: f3, loadImage: async bytes => $p(await createImageBitmap(new Blob([bytes], { type: "image/png" }))), pixelRatio: xe, resizeCanvas: p3, drawFrame: C9, drawText: m9, positionInput: aw, contains: Oe, createPreview: (width, height) => Py.create(width, height), requestFrame: callback => requestAnimationFrame(callback), cancelFrame: id => cancelAnimationFrame(id), now: () => performance.now() };');
    lines.push('const raceCameraDependencies = { versionTag: tag => Bt(tag), get processState() { return zB; }, createDrive: state => new Ol(state), createSurround: () => new KL() };');
    lines.push('const interfaceAudioDependencies = { decode: (context, bytes) => Q9(context, bytes), route: (context, source) => S9(context, source) };');
    lines.push('const routeSurfaceListenerDependencies = { routeEffect: tag => Vo(tag) };');
    lines.push(`const soloRaceBuildDependencies = {
  validateItemId: value => j6(value), findKart: (...args) => b4(...args),
  loadParameterFactory: () => ghostAssetDependencies.loadParameterFactory(),
  speed: options => y6(options), get defaultVersion() { return ze; },
  loadBodyParameter: (...args) => t3(...args),
  garageState: (...args) => p5(...args), tuneSpec: (...args) => e6(...args),
  flyingPetItem: (...args) => Ma(...args),
  applyFlyingPetSpec: (...args) => LI(...args),
  loadFlyingPetAbility: (library, id) => x4.load(library, id),
  finalizeSpec: (...args) => h6(...args),
  particleModification: (...args) => uP(...args),
  loadParticleBanner: (library, root) => x7.load(library, root),
  createAudioContext: () => new AudioContext(),
  configureAudio: (context, options) => Qc(context, options),
  loadRaceBgm: (...args) => P7.load(...args),
  createBoosterVisuals: () => new KI(),
  createOutlineBatch: () => new wK(),
  createPhysics: (...args) => new AL(...args),
  loadLensFlare: (...args) => w7.load(...args),
  createTrack: (...args) => new _L(...args),
  applyTrackFog: (...args) => kv(...args),
  prepareScene: (...args) => Hn(...args),
  createRain: (...args) => new sL(...args),
  loadRainAudio: (...args) => y7.load(...args),
  loadSnow: (...args) => A7.load(...args),
  loadTachometer: (...args) => eI(...args),
  loadMinimap: (...args) => oI(...args),
  createGameplayUi: (...args) => new tI(...args),
  loadAction2D: (...args) => hI(...args),
  createAction2D: asset => new dI(asset),
  loadResult: (...args) => pX(...args),
  createResult: asset => new Rd0(asset),
  versionTag: tag => Bt(tag),
  loadTrackInfoCard: options => M7.load(options),
  loadPause: options => Dy.load(options),
  loadCountdown: (...args) => Q6.load(...args),
  loadEventEffects: (...args) => b7.load(...args),
  loadEventAudio: (...args) => v7.load(...args),
  loadDummyAudio: (...args) => m7.load(...args),
  serializedRoot: model => J5(model),
  createLinkedPresentation: (...args) => new _a(...args),
  loadFlyingPet: options => S4.race(options),
  loadPaintColor: (...args) => We(...args),
  now: () => performance.now(), get accessorySockets() { return oP; },
  attachAura: (...args) => ev(...args),
  createGhostView: () => new Xd0(),
  createGhostPlayback: (record, mode) => new nf0(record, mode),
  loadGhostEffects: (...args) => Ca.load(...args),
  loadGhostTrails: (...args) => Ea.load(...args),
  ghostEffectNames: record => tf0(record),
  ghostItemIds: equipment => U_(equipment),
  disposeImportedObject: object => u5(object),
};`);
    lines.push('const pauseAssetDependencies = { parseBml: s2, decodePng: p2, attribute: T, frameState: Ft, captionOffset: an, loadAutoImage: ma, registerFont: f5, frameInset: E9, windowRect: V0 };');
    lines.push('const pauseMenuViewDependencies = { width: PAUSE_VIEW_WIDTH, height: PAUSE_VIEW_HEIGHT, fontFamily: PAUSE_FONT_FAMILY, loadAssets: library => zd0(library), releaseFont: G1, string: pauseString, smoothImages: Co, drawFrame: C9, captionRect: f3, drawText: m9, buttonHits: (assets, dialog) => pauseButtonHits(assets, dialog, pauseAssetDependencies), buttonState: st, drawButton: ct, resizeCanvas: p3, pixelRatio: xe, dialogRect: assets => V0(requiredPauseChild(assets.definition, "CaptionWindow"), { x: 0, y: 0, width: PAUSE_VIEW_WIDTH, height: PAUSE_VIEW_HEIGHT }, assets.captionFrame), contains: Oe };');
    lines.push('const raceStateDependencies = { createLifecycle: () => new GF(), createSpeedResetState: pr };');
    lines.push('const resultOverlayDependencies = { createRenderer: () => new fn(new Map()), buildItems: gX };');
    lines.push('const ghostToonDependencies = { isMesh: value => value instanceof D2, isToon: zn, prepareClone: OL, refreshMesh: ZG, copyToon: f6 };');
    lines.push('const ghostEffectDependencies = { boosterState: RD, boosterEffect: $w, secondaryEffect: Ww, secondaryState: ID };');
    lines.push("const presentationFrameDependencies = { nowMs: () => performance.now(), isRaceFinished: Un, requestFrame: callback => requestAnimationFrame(callback) };");
    lines.push("const presenterRaceDependencies = { setToonLinesEnabled: Pp, newSpeedResetState: pr, nowMs: () => performance.now(), applyTrackFog: kv, isManualBoostTachometer: value => value instanceof Gr };");
    lines.push("const presentationControllerServices = { createFrameRateCounter: () => new rf0(), createStageManager: () => new wf0(), createReadyStage: host => new mf0(host), createRaceStage: host => new df0(host), startLoop: owner => startPresentationLoop(owner, presentationFrameDependencies), stopLoop: owner => disposePresentationLoop(owner), advanceFrame: (owner, scheduledAtMs) => advancePresentationFrame(owner, scheduledAtMs, presentationFrameDependencies), renderFrame: (owner, startedAtMs) => renderPresentationFrame(owner, startedAtMs, presentationFrameDependencies), releaseRace: owner => releaseRaceForReady(owner, presenterRaceDependencies), replaceTrack: (owner, track) => replaceRaceTrack(owner, track, presenterRaceDependencies), applyRaceOptions: (owner, kartItemId) => applyRaceOptions(owner, kartItemId, presenterRaceDependencies) };");
    lines.push("const timeAttackStageDependencies = { nowMs: () => performance.now(), bodyQuaternion: PL, statusFlags: GD, racingPhase: Ne.Racing, isRaceFinished: Un, beginResetState: mL, advanceState: wL, kartVisible: gL, isDrivingPhase: Jl0, countdownPhase: Ne.Countdown, finishAcceptedPhase: Ne.FinishAccepted, refreshTachometer: eP, rankParticipants: XL, elapsedRaceMs: ff0, relativeGhostTime: nG, newGhostPoseBuffer: () => kL(), decodeGhostPose: LL, setVisualScaleMode: MK, isExhaustActive: Tk, particleRatio: Pt0, roadDescriptorName: TW, slotOffset: iG, createGhostRouteProgress: track => new hf0(track), compose: gf0, updateTachometer: QL, renderTachometer: JL, prepareWorldScene: e4, renderWithColorPipeline: yo, worldAxis: H2, depthAxis: $2 };");
    lines.push("const recordServiceDependencies = { recordKey: (selection, options) => Pt.recordKey(selection, options), resolveSpeed: Ue, validateSpeed: y6 };");
    lines.push("const ghostPoseRecorderDependencies = { interpolatePose: Ih0, encodeStamp: xD };");
    lines.push("const ghostPlaybackDependencies = { decodeRouteStamp: By, sampleC1: Jh0, sampleC2: ed0, sampleNative: FD, createSmoothSampler: record => new Yh0(record) };");
    lines.push("const ghostAssetDependencies = { findKart: b4, loadParameterFactory: async () => { const { createVehicleTimeAttackParameters } = await El(async () => { const { createVehicleTimeAttackParameters } = await Promise.resolve().then(() => AS); return { createVehicleTimeAttackParameters }; }, void 0); return createVehicleTimeAttackParameters; }, loadBodyParameter: t3, ghostItemIds: U_, loadPaintColor: We, createBalloon: Jw, createAccessory: hr };");
    lines.push("const ghostRecordLibraryDependencies = { restoreSummaries: Vh0, trackIdFromKey: key => Pt.trackIdFromKey(key), errorMessage: z_, zCeiling: B6, commonTimeBase: Dh0, debug: Nf, get storage() { return localStorage; }, get summaryStorageKey() { return PD; }, hydrateSummaries: hydrateGhostSummaryIndex, syncSummaries: syncGhostSummaryIndex };");
    lines.push("const ghostExportDependencies = { filename: V_, zCeiling: B6, encodeKsvFile: ph0 };");
    lines.push("const ghostMenuImportDependencies = { decodeKsv: pd0, toGhostRecord: gd0, toSelection: zD, selectionLabel: X_, mergeTrackSelection: md0 };");
    lines.push('const ghostMenuPanelDependencies = { get samplingLabels() { return qh0; }, nextSamplingMode: Xh0, saveSamplingMode: jh0, import: ghostMenuImportDependencies };');
    lines.push("const ghostVisualAssetDependencies = { serializedRoot: J5, createLinkedPresentation: (root, mount, driver, always) => new _a(root, mount, driver, always), collectToonPairs: qf, createBalloonMount: c7, get decorationSockets() { return jd0; }, nowMs: () => performance.now() };");
    lines.push("const ghostVisualUpdateDependencies = { decodePose: (frame, scratch) => LL(frame, scratch), decodeBasis: (basis, scratch) => xv(basis, scratch), boosterState: status => RD(status), secondaryState: status => ID(status), instantAcceleration: status => P_(status), copyToon: (source, clone) => f6(source, clone), nextTrailState: (status, prior, vehicle) => Kd0(status, prior, vehicle) };");
    lines.push("const raceBgmPlaybackDependencies = { setLoop: (source, loop) => w4(source, loop), setGain: (gain, value, time) => he(gain, value, time), connect: (context, source, channel, gain) => S9(context, source, channel, gain), setDucking: (context, fading) => qM(context, fading), fadeCurve: step => Qd0(step), schedule: (callback, delay) => setInterval(callback, delay), cancel: timer => clearInterval(timer) };");
    lines.push("const raceBgmLoadingDependencies = { resource: (library, path) => G5(library, path), garageMusic: (library, single) => ef0(library, single), parseMultiplayerList: (xml, path) => Fc0(xml, path), decodeBuffer: (resource, context) => Kt(resource, context), racePlaylist: (library, track, context) => eG(library, track, context), create: (context, playlist, ready, garage, win, lose, random) => new P7(context, playlist, ready, garage, win, lose, random) };");
    lines.push("const timeAttackInputBridgeDependencies = { get racingPhase() { return Ne.Racing; }, get forwardAction() { return l2.Forward; }, acceptsTimeAttackInput: lifecycle => e60(lifecycle), activeRace: lifecycle => t60(lifecycle), isTachometer: value => value instanceof fv };");
    lines.push("const ghostSmoothSamplerDependencies = { sampleNative: (record, timeMs) => FD(record, timeMs), smoothVelocity: (tail, head, prior, elapsed) => Zh0(tail, head, prior, elapsed), magnitude: velocity => fd0(velocity), float32: value => L9(value), renderBasis: (velocity, speed, quaternion) => Qh0(velocity, speed, quaternion) };");
    lines.push("const ghostKsvExportDependencies = { encodeStatus: (...args) => GD(...args), encodeRuntimeStamp: (stamp, zCeiling) => xD(stamp, zCeiling), createRecorder: zCeiling => new kD(zCeiling) };");
    lines.push("");
  }
  if (name === "multiplayer") {
    // The startup account login (localStorage, 30 days) is the multiplayer session.
    lines.push("const multiplayerTokenStore = accountTokenStore;");
    lines.push("const accountProgressDependencies = { get overlayStyle() { return B7; }, get panelStyle() { return R7; }, styleButtons: (...buttons) => G7(...buttons) };");
    lines.push("const lobbyAvatarAppearanceDependencies = { loadRoleTeams: library => fa(library), paintColors: (library, itemId, slot) => We(library, itemId, slot), cosmetics: (equipment, member) => BI(equipment, member) };");
    lines.push("const multiplayerClientStateFactories = { createDecoder: () => new d6(), createLatencyTracker: () => new gl0(), createClock: () => new L40() };");
    lines.push(`const readyGarageDependencies = {
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
};`);
    lines.push(`const readySettingsDependencies = {
  loadSettings: options => oy.load(options),
  speedLabel: Ue,
  chooseSpeed: $v,
  defaultSpeed: E4,
  defaultVersion: ze,
  persistGameOptions: ua0,
};`);
    lines.push("const lobbyRoomTimingDependencies = { nowMs: () => performance.now(), requestFrame: callback => requestAnimationFrame(callback), cancelFrame: frameId => cancelAnimationFrame(frameId), toLocalStartAt: Y3 };");
    lines.push("const lobbyRoomLifecycleDependencies = { previewMembers: (room, teams) => DT(room, teams), parseChat: (chat, emotions) => Ng(chat, emotions), get chatBubbleDurationMs() { return Il0; }, nowMs: () => performance.now(), cancelFrame: frameId => cancelAnimationFrame(frameId), get keyboard() { return window; } };");
    lines.push("const lobbyRoomTrackDependencies = { randomTrack: code => X6(code), mode: room => G2(room), uiResource: (library, roots, token) => U1(library, roots, token), decodePng: bytes => p2(bytes), canvas: image => { const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height; canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(image.pixels), image.width, image.height), 0, 0); return canvas; }, roadblockTracks: library => Cw(library), theme: metadata => wa(metadata) };");
    lines.push("const lobbyRoomConstructionDependencies = { mode: room => G2(room), loadRoleTeams: library => fa(library), loadEmotions: library => cP(library), loadCountdown: library => dy.load(library), loadDefinition: (library, roadblock) => Ll0(library, roadblock), withEmotions: (definition, emotions) => Fl0(definition, emotions), loadView: options => te.load(options), loadTrackChangeNotice: (...args) => fy.load(...args), createPreviews: (library, render, onError, emotions, audioContext) => new Tl0(library, render, onError, emotions, audioContext) };");
    lines.push("const lobbyRoomStateDependencies = { nodeName: node => T(node, 'name'), slots: (room, playerId) => FT(room, playerId), roadblockRunner: room => TF(room), gameplayMode: room => G2(room), decodeChat: (text, emotions) => Ng(text, emotions), wrapBubble: text => kl0(text), drawBubbleLine: (canvas, line, rect, options) => m9(canvas, line, rect, options), nowMs: () => performance.now(), get roadblockDefaults() { return tt; }, get rpChannelNames() { return lw; }, get colors() { return { redTeam: Rl0, blueTeam: Bl0, ownChat: _l0, otherChat: Gl0 }; } };");
    lines.push("const lobbyRoomControllerServices = { construction: lobbyRoomConstructionDependencies, lifecycle: lobbyRoomLifecycleDependencies, timing: lobbyRoomTimingDependencies, track: lobbyRoomTrackDependencies, state: lobbyRoomStateDependencies, documentBody: () => document.body };");
    lines.push("const raceLoadingScreenAssets = { imageBytes: (library, roots, name) => U1(library, roots, name).bytes(), decodeImage: bytes => p2(bytes) };");
    lines.push("const rpScenePreviewDependencies = { createCamera: () => new Z9(), createSize: () => new B2(), createBinding: () => new ha(), sceneName: node => T(node, 'scene'), validateCamera: (...args) => _F(...args), parseScene: bytes => y9(bytes), loadScene: (...args) => W1(...args), resolveReference: (...args) => ya(...args), loadKartEnvironment: library => rn.load(library), loadKart: (...args) => Qv(...args), createRenderer: options => new I4(options), outputColorSpace: qe, kartFieldOfView: (...args) => we(...args), prepareKart: (...args) => ey(...args), renderKart: (...args) => f4(...args), configureSceneCamera: (...args) => Dl0(...args), disposeKart: kart => Js(kart) };");
    lines.push("const rpResultAudioDependencies = { decode: (context, bytes) => Q9(context, bytes), route: (context, voice, channel) => S9(context, voice, channel) };");
    lines.push("const rpResultNoticeDependencies = { validDraws: (draws, playerIds) => ba(draws, playerIds), loadDefinition: (library, folder, name) => F9(library, folder, name), decorateDefinition: (definition, kartTitle, petTitle) => Vl0(definition, kartTitle, petTitle), nodeName: node => T(node, 'name'), loadScene: (library, definition, kart) => my.load(library, definition, kart), loadSound: (library, audioContext) => wy.load(library, audioContext), loadView: options => te.load(options), nowMs: () => performance.now(), requestFrame: callback => requestAnimationFrame(callback), cancelFrame: id => cancelAnimationFrame(id) };");
    lines.push("const roadblockMissionDependencies = { loadDefinition: (library, folder, name) => F9(library, folder, name), attribute: (node, name) => T(node, name), clone: (node, attributes, children) => h2(node, attributes, children), loadView: options => te.load(options), nowMs: () => performance.now(), requestFrame: callback => requestAnimationFrame(callback), cancelFrame: id => cancelAnimationFrame(id) };");
    lines.push("const trackChangeNoticeDependencies = { loadDefinition: (library, folder, name) => F9(library, folder, name), loadStringBag: library => U1(library, ['etc_'], 'baseStringBag', '.xml').bytes(), parseStringBag: bytes => x1(bytes), nodeAttribute: (node, name) => T(node, name), stringAttribute: (node, name) => j0(node, name), clone: (node, attributes) => h2(node, attributes), loadView: options => te.load(options), nowMs: () => performance.now() };");
    lines.push("const lobbyAvatarCameraDependencies = { degToRad: degrees => kl.degToRad(degrees), radToDeg: radians => kl.radToDeg(radians), createCamera: (fov, aspect, near, far) => new Z9(fov, aspect, near, far) };");
    lines.push("const lobbyEmotionAudioDependencies = { decode: (context, bytes) => Q9(context, bytes), route: (context, voice, channel) => S9(context, voice, channel) };");
    lines.push("const lobbyAvatarPreviewDependencies = { createBinding: () => new ha(), createEmotionAudio: (library, context, failed) => new xl0(library, context, failed), loadEnvironment: library => rn.load(library), createSlots: (build, release, changed, failed) => new El0(build, release, changed, failed), disposePreview: preview => Lt(preview), gameplayMode: room => G2(room), rpEquipment: (equipment, replacement) => wI(equipment, replacement), systemKart: (karts, itemId, path, systemKey) => b4(karts, itemId, path, systemKey), loadAppearance: (...args) => Sl0(...args), loadPreview: (...args) => Jv(...args), createParts: () => new Tr(), createCamera: (...args) => Ml0(...args), createRenderer: options => new I4(options), outputColorSpace: qe, updatePreview: (...args) => T4(...args), drawPreview: (...args) => NP(...args), renderScene: (...args) => f4(...args) };");
    lines.push("const lobbyCountdownMediaDependencies = { parseScene: bytes => y9(bytes), decodeImage: bytes => p2(bytes), createCanvas: image => { const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height; canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(image.pixels), image.width, image.height), 0, 0); return canvas; }, alphaFromParsed: parsed => on.fromParsed(parsed), createSoundUrl: bytes => URL.createObjectURL(new Blob([bytes], { type: 'audio/ogg' })), createAudio: url => new Audio(url), revokeSoundUrl: url => URL.revokeObjectURL(url) };");
    lines.push("const accountRequestDependencies = { authEndpoint: action => ly(action), authorizationHeaders: () => nm(), fetch: (url, options) => fetch(url, options), backendOrigin: () => jo(), clearToken: origin => SF(origin), saveToken: (origin, token) => wl0(origin, token), get errorMessages() { return uy; } };");
    lines.push("const accountLoginDependencies = { createElement: tag => document.createElement(tag), get overlayStyle() { return B7; }, get panelStyle() { return R7; }, styleButtons: (...buttons) => G7(...buttons), requestAccount: (action, fields) => Xo(action, fields), formatError: error => C6(error) };");
    lines.push("const accountEntryDependencies = { backendOrigin: () => jo(), pageUrl: () => window.location.href, pageOrigin: () => window.location.origin, endpoint: (path, pageUrl) => Ko(path, pageUrl), fetch: (url, options) => fetch(url, options), loadAccount: () => Xo('me'), chooseAccount: (root, account, signal) => Al0(root, account, signal), showLogin: (root, signal) => new CF(root, signal).wait() };");
    lines.push("const guestNicknameDependencies = { createElement: tag => document.createElement(tag), get overlayStyle() { return B7; }, get panelStyle() { return R7; }, styleButtons: (...buttons) => G7(...buttons), endpoint: action => ly(action), fetch: (url, options) => fetch(url, options), get errorMessages() { return uy; }, formatError: error => C6(error) };");
    lines.push("const gameServerPickerDependencies = { createElement: tag => document.createElement(tag), get overlayStyle() { return B7; }, get panelStyle() { return R7; }, styleButtons: (...buttons) => G7(...buttons) };");
    lines.push("const gameServerDependencies = { endpoint: path => Ko(path, window.location.href), backendOrigin: () => jo(), pageUrl: () => window.location.href, fetch: (url, options) => fetch(url, options), storage: () => localStorage, pick: (root, options, selected, signal) => showGameServerPicker(gameServerPickerDependencies, root, options, selected, signal) };");
    lines.push("const roomDropdownDependencies = { attribute: (node, name) => T(node, name), clone: (node, attributes, children) => children === undefined ? h2(node, attributes) : h2(node, attributes, children) };");
    lines.push("const accountChoiceDependencies = { createElement: tag => document.createElement(tag), get overlayStyle() { return B7; }, get panelStyle() { return R7; }, styleButtons: (...buttons) => G7(...buttons), endpoint: (path, pageUrl) => Ko(path, pageUrl), pageUrl: () => window.location.href, requestAccount: (action, fields) => Xo(action, fields), formatError: error => C6(error), authEndpoint: action => ly(action), authorizationHeaders: () => nm(), fetch: (url, options) => fetch(url, options), backendOrigin: () => jo(), clearToken: origin => SF(origin), showLogin: (root, signal) => new CF(root, signal).wait() };");
    lines.push("const lobbyDialogViewDependencies = { loadMessageTemplate: library => _w(library), loadDefinition: (library, folder, name) => F9(library, folder, name), decorateDefinition: (library, definition, folder) => C8(library, definition, folder), clone: (node, attributes, children) => children === undefined ? h2(node, attributes) : h2(node, attributes, children), nodeName: node => T(node, 'name'), loadView: options => te.load(options) };");
    lines.push("const lobbyDialogCategoryDependencies = { mode: channel => He[channel].mode, validateGameplay: gameplay => MI(gameplay), channelNames: gameplay => NT(gameplay) };");
    lines.push("const lobbyRoomFormDependencies = { ...lobbyDialogViewDependencies, attribute: (node, name) => T(node, name), channelNames: gameplay => NT(gameplay), channelKey: (value, channels) => Ol0(value, channels), dropdown: (combo, template, values) => zl0(combo, template, values), channelMode: key => He[key].mode };");
    lines.push("const roomTemplateDependencies = { attribute: (node, name) => T(node, name), clone: (node, attributes, children) => children === undefined ? h2(node, attributes) : h2(node, attributes, children), loadDefinition: (library, folder, name) => F9(library, folder, name), loadRoleTeams: library => fa(library) };");
    lines.push("const rpCameraDependencies = { attribute: (node, name) => T(node, name), applyMatrices: (camera, view, projection) => Aa(camera, view, projection) };");
    lines.push("const rpPetPreloadDependencies = { validDraws: (rp, playerIds) => ba(rp, playerIds), findItem: (library, itemId) => Ma(library, itemId), loadPet: (library, internalId) => x4.load(library, internalId), sharedFolder: DI };");
    lines.push(`const readyControllerServices = {
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
};`);
    lines.push(`const multiplayerLobbyServices = {
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
};`);
    lines.push("");
  }
  if (name === "world") {
    lines.push(`const flyingPetModelDependencies = {
  createGroup: () => new T2(), createSkin: source => new vR(source),
  registerSkinCulling: (root, collect) => qm(root, collect),
  applyTransform: (root, transform) => Ud(root, transform),
  toonProperties: (node, parent) => wE(node, parent),
  makeMaterial: (texture, options) => bo(texture, options),
  applyMaterial: (material, properties) => Mo(material, properties),
  renderState: (alpha, zbuf) => ir0(alpha, zbuf),
  createMesh: (geometry, material) => new D2(geometry, material),
  configureRenderOrder: (...args) => ie(...args),
  createOutline: (...args) => new N6(...args),
  createMatrix: () => new v2(), createVector: () => new H(),
  updateEnvironment: (...args) => xo(...args),
  rigidGeometry: source => rr0(source), isElement: node => vE(node),
  collectBoneMatrices: (source, pose) => AR.collect(source, pose),
  composeBoneMatrix: (pose, inverse) => yR(pose, inverse),
  setTextureEnabled: (material, disabled) => JH(material, disabled),
  headTransform: pose => nr0(pose),
};`);
    lines.push(`const flyingPetTextureDependencies = {
  decodePng: bytes => p2(bytes),
  paintColors: (low, high, primary, highlight) => K6(low, high, primary, highlight),
  createTexture: (pixels, width, height, format) => new J9(pixels, width, height, format),
  format: e9, colorSpace: v9, wrapping: S1, filtering: h9,
};`);
    lines.push(`const flyingPetMediaDependencies = {
  directory: DI, parseScene: y9, buildScene: W1,
  decodeAudio: Q9, connectAudio: S9,
};`);
    lines.push(`const giantWarningDependencies = {
  createGeometry: () => new t9(),
  createAttribute: (values, size) => new _0(values, size),
  createMaterial: options => new Vt(options),
  createMesh: (geometry, material) => new D2(geometry, material),
  orientMesh: mesh => Ao(mesh),
  repeatWrapping: S1, linearFilter: h9,
  normalBlending: u1, sourceAlpha: l1, oneMinusSourceAlpha: v1,
  addEquation: R9, doubleSide: s1, alwaysDepth: y1,
};`);
    lines.push(`const giantAppearanceDependencies = {
  applyOutline: (mesh, options) => Ab(mesh, options),
  isMaterial: material => material instanceof $1,
  hasNormalUvOffset: material => zn(material),
  restoreRootConsumer: mesh => QG(mesh),
  get normalUvY() { return NL; },
  blending: u1, sourceAlpha: l1, oneMinusSourceAlpha: v1, addEquation: R9,
};`);
    lines.push(`const activeRaceCoordinatorDependencies = {
  normalizeRp: value => mI(value),
  createCollisionFramerate: (...args) => new Ni0(...args),
  createLocal: (...args) => new Ci0(...args),
  createCadence: (...args) => new Vi0(...args),
  createRemotes: (...args) => new Bi0(...args),
  resolveRemoteCollision: (...args) => Di0(...args),
  createPresentation: () => new I40(), createSlipstream: () => new fE(),
  bindClock: (host, mapping) => bindActiveRaceClock(host, mapping, {
    makeClock: value => new BL(value),
    makeSender: (...args) => new ki0(...args),
  }),
  scheduleStart: (host, startAt) => scheduleActiveRaceStart(host, startAt),
  updateRoom: (host, room) => updateActiveRaceRoom(host, room, raceRoomDependencies),
  updateFrame: (host, now, frame, bypass) => updateActiveRaceFrame(host, now, frame, bypass,
    { racingState: X2.Racing, resultState: X2.Result,
      captureMotion: B40, captureAnimation: R40 }),
  updateRemoteViews: (host, now) => updateRaceRemoteViews(host, now,
    { racingState: X2.Racing, resultState: X2.Result }),
  roadblockRemaining: (host, now) => roadblockRemaining(host, now, Y3),
  dispose: host => disposeActiveRace(host),
};`);
    lines.push(`const flyingPetPresentationDependencies = {
  loadPetAsset: (library, id) => x4.load(library, id),
  createSkinResources: (asset, primary, high) => new FlyingPetTextures(
    asset, primary, high, flyingPetTextureDependencies),
  createAnimation: sequence => new cc(sequence),
  loadModel: async (model, clips, skin, environment, binding) => {
    const { body, faces } = await loadFlyingPetModelParts(clips, skin);
    return new FlyingPetModel(model, body, faces, environment, binding,
      flyingPetModelDependencies);
  },
  createIdleMotion: (clips, animation, random) => new FlyingPetIdleMotion(clips, animation, random),
  loadEffect: (library, name, environment, binding) => loadFlyingPetEffect(
    library, name, environment, binding, flyingPetMediaDependencies),
  loadAudio: async (asset, context) => new FlyingPetAudio(context,
    await loadFlyingPetAliveSound(asset, context, flyingPetMediaDependencies),
    flyingPetMediaDependencies),
  createRaceState: () => new FlyingPetRaceState(), isVisible: visibleFlyingPet,
  createRotationMatrix: () => new v2(), renderNested: qm,
};`);
    lines.push(`const trackEventEffectDependencies = {
  parseScene: y9, buildScene: W1,
  resolveTextureSource: (library, path, reference) => sn(library, path, void 0, reference),
  decodeSound: Q9, connectSound: (context, source) => S9(context, source),
};`);
    lines.push(`const giantRaceDependencies = {
  parseBml: s2, attribute: T,
  exactEntry: (library, path) => Yi(library, path),
  createGroup: () => new T2(), decodeSound: Q9, connectSound: S9,
  decodeImage: p2, createTexture: (pixels, width, height) => new J9(pixels, width, height),
  createWarning: texture => new GiantWarning(texture, giantWarningDependencies), build: aI,
};`);
    lines.push(`const roadblockResultPresentationDependencies = {
  parseScene: y9, attribute: T, buildScene: W1,
  resolveSource: (library, path, reference) => sn(library, path, void 0, reference),
  validateStand: mr0, createGroup: () => new T2(),
  createCameraPublisher: () => new Ol(), createDistance: wr0,
  startBasis: fr0, nativePoint: point => It(point),
  createVector: (x, y, z) => new H(x, y, z),
  runnerPose: pr0, cameraPose: gr0,
};`);
    lines.push(`const multiplayerRaceLoaderDependencies = {
  createToonStageBinding: () => new ha(),
  loadRaceAssets: (...args) => A40(...args),
  loadCharacterAnimations: (...args) => hI(...args),
  createNetworkDriver: (...args) => new ActiveRaceCoordinator(
    ...args, activeRaceCoordinatorDependencies),
  loadTimeGap: (...args) => Dw.load(...args),
  loadCountdownAudio: (...args) => Q6.load(...args),
  loadRoadblockFlag: (...args) => tw.load(...args),
  loadTrackCard: options => M7.load(options),
  loadRoadblockHud: (...args) => Bo.loadHud(...args),
  loadRoadblockResult: (...args) => Bo.loadResult(...args),
  loadRoadblockOverlay: (...args) => Gw.load(...args),
  loadRaceResult: (...args) => Tw.load(...args),
  findKart: p5, bannerKind: uP,
  loadBanner: (...args) => x7.load(...args),
  createPresenter: (...args) => new jr0(...args),
  loadRaceChat: (...args) => Dv.load(...args),
  createSession: (...args) => new Yr0(...args),
  now: () => performance.now(),
};`);
    lines.push('const kartPresentationDependencies = { makeWheelPresentation: (resource, nodes, visual) => new N90(resource, nodes, visual), makeBalloon: c7, disposeObject: u5 };');
    lines.push("const localRaceConstructionDependencies = { validateStartSlots: iL, hasLteMode: ko, validRpDraws: ba, sameRp: t7, hasGiantMode: Io, makeLte: () => new D40(), makeGiant: callback => new pL(true, callback), makePhysics: (...args) => new AL(...args), makeTrack: (...args) => new _L(...args), placeAtStart: rL, makeCoordinator: (...args) => new yL(...args), racingState: X2.Racing };");
    lines.push("const localRaceDependencies = { states: X2, beginResetState: mL, advanceResetState: wL, routeTagFamily: Vo, isStartBoosterWindow: fL };");
    lines.push("const localRaceControllerDependencies = { construction: localRaceConstructionDependencies, runtime: localRaceDependencies, makeLapTiming: () => new vL(), makeLifecycle: () => new OQ(), makeResetState: () => pr(), makeWarpNext: () => new Qk(), resetVisible: gL };");
    lines.push("const raceRoomDependencies = { modeOf: G2, sameRp: t7, sameRoadblock: oR, sameLte: Nw, sameGiant: yI, toLocalTick: Y3, racingState: X2.Racing };");
    lines.push("const racePresenterInitializationDependencies = { createCameraShake: (random, anchor) => new nP(random, anchor), createRankRoster: (roster, playerId) => new Tr0(roster, playerId), createLightFactor: random => new sP(random), createAction2d: assets => new dI(assets), applyTrackFog: (scene, track) => kv(scene, track), createRacerView: scene => new Vg(scene), vehicleParts: vehicle => lc(vehicle), serializedRoot: model => J5(model), get accessorySockets() { return oP; }, createLinkedPresentation: (...args) => new _a(...args), attachAura: (...args) => ev(...args), createGiantAppearance: (...args) => new GiantAppearance(...args, giantAppearanceDependencies), startPosition: (...args) => rL(...args), createShadowPresentation: object => new $i0(object) };");
    lines.push("const racePresenterFrameDependencies = { result: { get countdownState() { return X2.Countdown; }, render: (...args) => e4(...args) }, events: { get racingState() { return X2.Racing; } }, participants: { updateRemoteVehicleEffects: (...args) => xr0(...args), updateLocalVehicleEffects: (...args) => Mr0(...args) }, hud: { rankByProgress: (...args) => _r0(...args), rankFallback: (...args) => Gr0(...args), rankWithResults: (...args) => Br0(...args), updateTachometer: (...args) => QL(...args), prepareScene: (...args) => e4(...args), get racingState() { return X2.Racing; } } };");
    lines.push("const racePresenterSetupDependencies = { flyingPetItem: (library, itemId) => Ma(library, itemId), serializedRoot: model => J5(model), loadFlyingPet: options => S4.race(options), paintColors: (library, itemId) => We(library, itemId), loadRoadblockFlag: (...args) => _v.load(...args), loadGiant: (...args) => Fv.load(...args), loadRoadblockResult: (...args) => Bv.load(...args), nowMs: () => performance.now() };");
    lines.push("const racePresenterTrackEventDependencies = { loadEffects: (...args) => b7.load(...args), loadAudio: (...args) => v7.load(...args), loadDummyAudio: (...args) => m7.load(...args) };");
    lines.push("const racePresenterResultsDependencies = { vehicleParts: vehicle => lc(vehicle), winningPlayers: (...args) => rG(...args), createVehicleView: scene => new Vg(scene) };");
    lines.push("const racePresenterLifecycleDependencies = { warmScene: (...args) => Hn(...args), createRenderTarget: (width, height) => new nn(width, height), vehicleParts: vehicle => lc(vehicle) };");
    lines.push("const racePresenterActionsDependencies = { routeTagFamily: tag => Vo(tag), resetTachometer: tachometer => eP(tachometer) };");
    lines.push("const racePresenterRenderDependencies = { get transparentSort() { return jm; }, withColorPipeline: (...args) => yo(...args), renderTachometer: (...args) => JL(...args), get blackBarFraction() { return Rv; }, get worldAxis() { return H2; }, get depthAxis() { return $2; }, get postFinishState() { return X2.PostFinish; } };");
    lines.push("const raceSessionUpdateDependencies = { nowMs: () => performance.now(), get lteKeyMap() { return Xr0; }, get states() { return X2; } };");
    lines.push("const raceChatDependencies = { loadFrame: library => U1(library, ['stage_/common'], 'ingame_chat_Bg').bytes().then(p2), loadEmotions: library => cP(library), loadFontBytes: library => U1(library, ['gui_/font'], 'SourceHanSansCN-Medium', '.otf').bytes(), registerFont: (family, bytes) => f5(family, bytes), releaseFont: font => G1(font), parseChat: (text, emotions) => Ng(text, emotions), nowMs: () => performance.now(), setTimer: (callback, delay) => window.setTimeout(callback, delay), clearTimer: timer => window.clearTimeout(timer) };");
    lines.push("const trackInfoCardLoadingDependencies = { configEnabled: library => xs0(library), cardPath: directory => ds0(directory), parseXml: (text, path) => DE(text, path), gameLabels: (game, labels) => ws0(game, labels), uniqueResource: (library, path) => Gn(library, path), parseNode: bytes => s2(bytes), layout: node => Ss0(node), stripIndex: (value, team) => ps0(value, team), decodeImage: entry => yi(entry), difficultyLayout: (...args) => bs0(...args), registerFont: (family, bytes) => f5(family, bytes), releaseFont: font => G1(font), title: (title, trackId) => fs0(title, trackId) };");
    lines.push("const trackInfoCardRuntimeDependencies = { configureCanvas: (...args) => p3(...args), pixelRatio: () => xe(), drawTrack: (...args) => ys0(...args), drawReverse: (...args) => As0(...args), drawDifficulty: (...args) => Ms0(...args), drawLabel: (...args) => m9(...args), releaseFont: font => G1(font), removeResizeListener: listener => window.removeEventListener('resize', listener) };");
    lines.push("");
  }
  for (const fragment of bodies.get(name).sort((a, b) => a.at - b.at)) {
    lines.push(fragment.text, "");
  }
  if (name === "app") lines.push(source.slice(garageExportNode.start, garageExportNode.end), "");
  if (exports.get(name).size) lines.push(`export { ${groupNames(exports.get(name))} };`, "");
  return `${lines.join("\n").trimEnd()}\n`;
}

// Sw.load now uses the readable Rho, Rho5 and aaa.pk codecs in src/codecs.
// The old parsers (including a bundled SparkMD5 copy) survive in the fixed
// release source for differential tests, but must not be emitted into the
// production compatibility module. Keep the one checksum consumer used by
// favorite-track IDs through the readable codec implementation.
const retiredArchiveFormatExports = new Set(["PX", "lR", "KX", "YX", "bY", "MY", "gR"]);
function retireDuplicateArchiveCode(name, rendered) {
  if (name !== "formats" && name !== "library") return rendered;
  const nodes = parse(rendered, { sourceType: "module" }).program.body;
  const edits = [];
  if (name === "formats") {
    const first = nodes.find(node => node.type === "VariableDeclaration" &&
      node.declarations[0]?.id?.name === "GX");
    const last = nodes.find(node => node.type === "ClassDeclaration" && node.id.name === "LY");
    assert(first && last && first.start < last.start,
      "Original archive codec boundaries changed.");
    edits.push({ start: first.start, end: last.end,
      text: "function Dt(bytes, seed = 0) { return rhoAdler32(bytes, seed); }" });
    const exportNode = nodes.find(node => node.type === "ExportNamedDeclaration" &&
      node.specifiers.some(specifier => specifier.local.name === "PX"));
    assert(exportNode, "Original archive codec exports changed.");
    const retained = exportNode.specifiers.filter(specifier =>
      !retiredArchiveFormatExports.has(specifier.local.name));
    edits.push({ start: exportNode.start, end: exportNode.end,
      text: `export { ${retained.map(specifier => specifier.local.name).join(", ")} };` });
    const prefix = 'import { rhoAdler32 } from "../codecs/common.ts";\n';
    rendered = prefix + rendered;
    for (const edit of edits) { edit.start += prefix.length; edit.end += prefix.length; }
  } else {
    const declaration = nodes.find(node => node.type === "ImportDeclaration" &&
      node.source.value === "./formats.js");
    assert(declaration, "Library format imports changed.");
    const retained = declaration.specifiers.filter(specifier =>
      !retiredArchiveFormatExports.has(specifier.imported?.name));
    assert(declaration.specifiers.length - retained.length === 7,
      "Duplicate archive imports unexpectedly changed.");
    edits.push({ start: declaration.start, end: declaration.end,
      text: `import { ${retained.map(specifier => specifier.imported.name).join(", ")} } from "./formats.js";` });
  }
  for (const edit of edits.sort((a, b) => b.start - a.start))
    rendered = rendered.slice(0, edit.start) + edit.text + rendered.slice(edit.end);
  return rendered;
}

// Method overrides leave some release helpers with no callers. Functions and
// ordinary classes have no declaration-time side effects, so omit only those
// proven unused by the module's lexical scope. Likewise omit unused literal
// tables. Keep imports, impure variables and classes with static initialization.
function isInertLiteral(node) {
  if (!node) return true;
  if (["StringLiteral", "NumericLiteral", "BooleanLiteral", "NullLiteral",
    "RegExpLiteral", "BigIntLiteral"].includes(node.type)) return true;
  if (node.type === "TemplateLiteral") return node.expressions.length === 0;
  if (node.type === "UnaryExpression") return isInertLiteral(node.argument);
  if (node.type === "ArrayExpression") return node.elements.every((value) =>
    value?.type !== "SpreadElement" && isInertLiteral(value));
  if (node.type === "ObjectExpression") return node.properties.every((property) =>
    property.type === "ObjectProperty" && !property.computed &&
    isInertLiteral(property.value));
  return false;
}
function pruneUnreferencedDeclarations(rendered) {
  let sourceText = rendered;
  for (let pass = 0; pass < 12; pass += 1) {
    const dead = [];
    traverse(parse(sourceText, { sourceType: "module" }), {
      Program(program) {
        for (const binding of Object.values(program.scope.bindings)) {
          if (binding.referenced) continue;
          const node = binding.path.node;
          if (node.type === "FunctionDeclaration") {
            dead.push({ start: node.start, end: node.end });
          } else if (node.type === "ClassDeclaration" && !node.superClass &&
              node.body.body.every((member) =>
                !member.computed && member.type !== "StaticBlock" &&
                !(member.static && member.type !== "ClassMethod"))) {
            dead.push({ start: node.start, end: node.end });
          }
        }
        for (const statement of program.node.body) {
          if (statement.type !== "VariableDeclaration") continue;
          const retained = statement.declarations.filter((part) => {
            if (part.id.type !== "Identifier" || !isInertLiteral(part.init)) return true;
            const binding = program.scope.getBinding(part.id.name);
            // Babel does not count a write-only binding as "referenced". A
            // later `cache ??= value` still needs its lexical declaration.
            return binding?.referenced || !!binding?.constantViolations.length;
          });
          if (retained.length === statement.declarations.length) continue;
          dead.push({
            start: statement.start,
            end: statement.end,
            text: retained.length
              ? `${statement.kind} ${retained.map((part) =>
                  sourceText.slice(part.start, part.end)).join(",\n  ")};`
              : "",
          });
        }
        program.stop();
      },
    });
    if (dead.length === 0) return sourceText;
    for (const { start, end, text = "" } of dead.sort((left, right) => right.start - left.start)) {
      sourceText = sourceText.slice(0, start) + text + sourceText.slice(end);
    }
  }
  throw new Error("Unused declaration pruning did not converge.");
}

await mkdir(outputDir, { recursive: true });
async function writeIfChanged(filename, contents) {
  const target = path.join(outputDir, filename);
  try {
    if (await readFile(target, "utf8") === contents) return;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  await writeFile(target, contents, "utf8");
}

// ---- item-mode(lobby) ----------------------------------------------------
// 道具赛 mode identity (ITEM_MODE.md 1, 2, 5, 8): the original item channels
// itemIndiCombine / itemTeamCombine (channel.xml:72-73) and gameplay "item"
// in the generated mode tables, the original game types 2 / 4, room labels,
// the item track catalog for item rooms and the frozen `race.item` check at
// race start. Each substitution must match exactly once in its module.
const itemLobbyImports = new Map([
  ["formats", ['import { itemChannelMismatch, itemRoomLabel } from "../multiplayer/lobby-item-mode.ts"; // item-mode(lobby)']],
  ["library", ['import { itemTrackCatalog } from "../resources/track-catalog.ts"; // item-mode(lobby)']],
  ["vehicle", [
    'import { isItemRaceRules, sameItemRaceRules } from "../multiplayer/lobby-item-mode.ts"; // item-mode(lobby)',
    'import { itemTrackCatalog } from "../resources/track-catalog.ts"; // item-mode(lobby)',
  ]],
]);
const itemLobbyPatches = new Map([
  ["formats", [
    // Channel table He: the release only listed the four speed channels.
    ['  speedTeamInfinit: { mode: "team", speed: 4, gameType: 3 },\n};',
      '  speedTeamInfinit: { mode: "team", speed: 4, gameType: 3 },\n' +
      '  // item-mode(lobby): the original combined item channels.\n' +
      '  itemIndiCombine: { mode: "individual", speed: 7, gameType: 2 },\n' +
      '  itemTeamCombine: { mode: "team", speed: 7, gameType: 4 },\n};'],
    // Gameplay names xX and the gameplay set cw.
    ['  rp: "RP竞速",\n};', '  rp: "RP竞速",\n  item: "道具赛", // item-mode(lobby)\n};'],
    ['    n === "giant" ||\n    n === "rp"\n  );',
      '    n === "giant" ||\n    n === "rp" ||\n    n === "item" // item-mode(lobby)\n  );'],
    // To: item gameplay only on item channels, and nothing else on them.
    ['function To(n, e, t) {\n  return (n !== void 0 && !cw(n)) || !$6(e)',
      'function To(n, e, t) {\n  if (itemChannelMismatch(n, e)) return !1; // item-mode(lobby)\n' +
      '  return (n !== void 0 && !cw(n)) || !$6(e)'],
    // SX: kItemIndi = 2, kItemTeam = 4.
    ['    case "lte":\n      return e ? 47 : 46;\n  }',
      '    case "lte":\n      return e ? 47 : 46;\n' +
      '    case "item": // item-mode(lobby)\n      return e ? 4 : 2;\n  }'],
    // iR: room title suffix 个人道具赛 / 组队道具赛.
    ['function iR(n) {\n  const e = G2(n);\n',
      'function iR(n) {\n  const e = G2(n);\n' +
      '  if (e === "item") return itemRoomLabel(n.channelName); // item-mode(lobby)\n'],
  ]],
  ["library", [
    // vI: the frozen driving mode of game types 2 and 4, accepted by Q00.
    ['    default:\n      throw new Error(`竞速玩法 ${n} 尚未准入。`);',
      '    case 2: // item-mode(lobby)\n    case 4:\n' +
      '      return Object.freeze({ [Pn]: !0, modeId: n, kind: "item", team: n === 4 });\n' +
      '    default:\n      throw new Error(`竞速玩法 ${n} 尚未准入。`);'],
    // Lobby list titles also cover the item-only tracks.
    ['    if (e === "p3553") for (const p of await Cw(n)) f.set(p.id, p.title);\n',
      '    if (e === "p3553") for (const p of await Cw(n)) f.set(p.id, p.title);\n' +
      '    if (e === "p3553") for (const p of await itemTrackCatalog(n)) f.has(p.id) || f.set(p.id, p.title); // item-mode(lobby)\n'],
  ]],
  ["vehicle", [
    // w40: an item race carries exactly its frozen race.item rules.
    ['    throw new Error("LTE Web试玩冻结参数无效。");\n',
      '    throw new Error("LTE Web试玩冻结参数无效。");\n' +
      '  if ( // item-mode(lobby)\n' +
      '    G2(n) === "item"\n' +
      '      ? !isItemRaceRules(e.item, n.mode === "team") ||\n' +
      '        !sameItemRaceRules(e.item, n.race?.item)\n' +
      '      : e.item !== void 0\n' +
      '  )\n' +
      '    throw new Error("道具赛冻结参数无效。");\n'],
    // A40: item rooms resolve their track in the item catalog.
    ['        : G2(e) === "lte"\n          ? r20(g)\n          : g.timeAttackTrackCatalog(),',
      '        : G2(e) === "lte"\n          ? r20(g)\n' +
      '          : G2(e) === "item" // item-mode(lobby)\n            ? itemTrackCatalog(g)\n' +
      '            : g.timeAttackTrackCatalog(),'],
  ]],
]);
const appliedItemLobbyPatches = new Set();
function applyItemLobbyPatches(name, source) {
  for (const [before, after] of itemLobbyPatches.get(name) ?? []) {
    const first = source.indexOf(before);
    assert(first >= 0 && source.indexOf(before, first + 1) < 0,
      `item-mode(lobby) patch target in ${name}.js is missing or ambiguous: ${before.slice(0, 60)}`);
    source = source.replace(before, () => after);
    appliedItemLobbyPatches.add(before);
  }
  const header = "// Stable minified names are retained for behavioral parity.\n";
  const lines = itemLobbyImports.get(name);
  if (lines) {
    assert(source.includes(header), `${name}.js lost its generated header.`);
    source = source.replace(header, () => `${header}${lines.join("\n")}\n`);
  }
  return source;
}
// ---- end item-mode(lobby) ------------------------------------------------

const generated = [];
function addHouseShellState(source) {
  const substitutions = [
    ['    garage: "ReadyGarage",\n    settings: "ReadySettings",',
      '    garage: "ReadyGarage",\n    house: "ReadyHouse",\n    settings: "ReadySettings",'],
    ['    ReadyGarage: "garage",\n    ReadySettings: "settings",',
      '    ReadyGarage: "garage",\n    ReadyHouse: "house",\n    ReadySettings: "settings",'],
    ['      this.state === "ReadyGarage" ||\n      this.state === "ReadySettings"',
      '      this.state === "ReadyGarage" ||\n      this.state === "ReadyHouse" ||\n      this.state === "ReadySettings"'],
  ];
  for (const [before, after] of substitutions) {
    assert(source.includes(before), "ShellStateMachine layout changed; house modal needs review.");
    source = source.replace(before, after);
  }
  return source.replace(/^[ \t]+$/gm, "");
}
for (const name of order) {
  let text = pruneUnreferencedDeclarations(retireDuplicateArchiveCode(name, renderModule(name)));
  if (name === "world") text = addHouseShellState(text);
  text = applyItemLobbyPatches(name, text); // item-mode(lobby)
  const filename = `${name}.js`;
  await writeIfChanged(filename, text);
  generated.push({
    file: filename,
    bytes: Buffer.byteLength(text),
    sha256: sha256(text),
    imports: [...imports.get(name).values()].reduce((total, set) => total + set.size, 0),
    exports: exports.get(name).size,
  });
}

assert(appliedItemLobbyPatches.size === [...itemLobbyPatches.values()].flat().length,
  "Not every item-mode(lobby) patch was applied."); // item-mode(lobby)
const garage = await readFile(garageFile, "utf8");
const oldImport = 'from "./index-DoW2rQpI.js";';
assert(garage.includes(oldImport), "Garage chunk import path changed.");
const garagePartOverrides = new Map([
  ["Li", "function Li(a, e, t, s) { return parseLegacyGarageParts(a, e, t, s, L); }"],
  ["Bi", "function Bi(a, e, t, s) { return collectGarageParts(a, e, t, s, { slots: de, attribute: L, defaultParts: gs, xunPartValue: Bs }); }"],
  ["qi", "function qi(a, e, t) { return sortGarageParts(a, e, t); }"],
  ["Xe", "function Xe(a, e, t, s, i, n, r) { return resolveEquippedGaragePart(a, e, t, s, i, n, r, me); }"],
  ["Kt", "function Kt(a, e) { return sameGaragePart(a, e); }"],
]);
const garageRuntimeClassOverrides = new Map([
  ["Pi", "class Pi extends GarageControlCanvas { constructor(surface, width, height) { super(surface, width, height, garageControlCanvasDependencies); } }"],
  ["Qi", "const Qi = GarageModelCache;"],
  ["vn", "class vn extends GarageInventoryScroll { constructor(viewport, hitTarget, snapStep) { super(viewport, hitTarget, snapStep, (...args) => Qs(...args)); } }"],
  ["Ka", "class Ka extends GaragePointEffects { constructor(surface, assets, load, onError) { super(surface, assets, load, onError, { attribute: (node, name) => y(node, name) }); } }"],
]);
const garageUpgradeSessionClassOverrides = new Map([
  ["qa", "class qa extends GarageSkillSelectionState { constructor(progression, slot = 0) { super(progression, slot, garageSkillSelectionDependencies); } }"],
  ["Qa", "class Qa extends GarageUpgradePreparationState { constructor(candidates, selectedItemId) { super(candidates, selectedItemId, garageUpgradePreparationDependencies); } }"],
  ["Da", "class Da extends GarageSkillSelectionDialog { constructor(surface, library, progression, row, onClose) { super(surface, library, progression, row, onClose, garageSkillDialogDependencies); } }"],
  ["Tn", "class Tn extends GarageExceedTypeDialog { constructor(surface, assets, library, current, onClose) { super(surface, assets, library, current, onClose, garageExceedDialogDependencies); } }"],
]);
const garageUpgradeResultOverrides = new Map([
  ["constructor", "constructor(surface, library, environment, stage, title, onClose, kind, summary, resultOnly = false, badgeUrl) { initializeGarageUpgradeResult(this, surface, library, environment, stage, title, onClose, kind, summary, resultOnly, badgeUrl, garageUpgradeConstructionDependencies); }"],
  ["capturePreview", "capturePreview(panels, rect) { return captureGarageUpgradePreview(this, panels, rect, garageUpgradeRenderDependencies); }"],
  ["render", "render(time, panels) { return renderGarageUpgradeResult(this, time, panels, garageUpgradeRenderDependencies); }"],
  ["close", "close(confirmed) { return closeGarageUpgradeResult(this, confirmed); }"],
  ["dispose", "dispose() { return disposeGarageUpgradeResult(this); }"],
]);
const garagePointEffectHelperOverrides = new Map([
  ["za", "function za(gauge, sprite, points) { return garageSkillEffectRect(gauge, sprite, points); }"],
  ["Ua", "function Ua(before, after) { return compareGarageSkillEffects(before, after); }"],
]);
const garagePreparationHelperOverrides = new Map([
  ["Za", "function Za(current, next) { return compareGarageUpgradeLevels(current, next); }"],
  ["ss", "function ss() { return preparationMethodPanelRect(); }"],
  ["Ya", "function Ya(context, rect) { return fillPreparationMethodPanel(context, rect); }"],
  ["en", "function en(context, presenter, cards, selectedId, normal, selected) { return drawPreparationCards(context, presenter, cards, selectedId, normal, selected); }"],
]);
const garageControlCanvasHelperOverrides = new Map([
  ["ct", "function ct(left, right) { return intersectGarageRect(left, right); }"],
  ["Ke", "function Ke(element) { return garageControlZIndex(element); }"],
  ["Cs", "function Cs(rect, width, height, fit) { return garageObjectFitRect(rect, width, height, fit); }"],
  ["Fe", "function Fe(value) { return splitGarageCssLayers(value); }"],
  ["Ie", "function Ie(value, basis) { return garageCssLength(value, basis); }"],
  ["Ei", "function Ei(context, style, rect, image) { return paintGarageControlBox(context, style, rect, image); }"],
  ["Si", "function Si(context, style, character, rect) { return paintGarageControlCharacter(context, style, character, rect); }"],
]);
const garagePreparationDialogOverrides = new Map([
  ["constructor", "constructor(surface, library, candidates, selectedItemId, onClose) { initializeGaragePreparation(this, surface, library, candidates, selectedItemId, onClose, garagePreparationConstructionDependencies); }"],
  ["selected", "get selected() { return selectedPreparationVehicle(this); }"],
  ["previewRect", "get previewRect() { return preparationPreviewRect(this); }"],
  ["previewCard", "get previewCard() { return preparationPreviewCard(this); }"],
  ["cards", "get cards() { return preparationCards(this); }"],
  ["place", "place(element, rect) { return placePreparationControl(this, element, rect); }"],
  ["label", "label(text, rectName, extraClass = '') { return addPreparationLabel(this, text, rectName, extraClass); }"],
  ["comparisonValue", "comparisonValue(rectName, value, increment = 0, extraClass = 'metric-value') { return addPreparationComparisonValue(this, rectName, value, increment, extraClass); }"],
  ["button", "button(label, rect, action, disabled = false) { return createPreparationButton(this, label, rect, action, disabled); }"],
  ["decoratePageArrow", "decoratePageArrow(button, arrow, rect) { return decoratePreparationPageArrow(this, button, arrow, rect, garagePreparationRenderDependencies); }"],
  ["cancelButton", "cancelButton() { return addPreparationCancelButton(this); }"],
  ["load", "async load(library) { return loadGaragePreparation(this, library, value => Ha(value)); }"],
  ["refresh", "refresh() { return refreshGaragePreparation(this, garagePreparationRenderDependencies); }"],
  ["resizeCanvases", "resizeCanvases() { return resizePreparationCanvases(this); }"],
  ["close", "close(accept) { return closeGaragePreparation(this, accept); }"],
  ["dispose", "dispose() { return disposeGaragePreparation(this); }"],
  ["clearPageFrameResources", "clearPageFrameResources() { return clearPreparationPageFrames(this); }"],
  ["draw", "draw(presenter) { return drawGaragePreparation(this, presenter, garagePreparationRenderDependencies); }"],
]);
const garageProgressionOverrides = new Map([
  ["constructor", "constructor(assets, onChange, onSelectSkill, onExceedTypeChange = () => {}) { initializeGarageProgressionView(this, assets, onChange, onSelectSkill, onExceedTypeChange); }"],
  ["reset", "reset(layout) { return resetGarageProgressionPanel(this, layout); }"],
  ["previewRect", "get previewRect() { return garageProgressionPreviewRect(this); }"],
  ["updateRadar", "async updateRadar(library, kart, grade, progression, configuration) { return updateGarageProgressionRadar(this, library, kart, grade, progression, configuration, garageProgressionRadarDependencies); }"],
  ["dispose", "dispose() { return disposeGarageProgressionPanel(this); }"],
  ["rect", "rect(name) { return garageProgressionRect(this, name); }"],
  ["place", "place(element, rect) { return placeGarageProgressionElement(this, element, rect); }"],
  ["styleFromNode", "styleFromNode(element, name) { return styleGarageProgressionFromNode(this, element, name, garageProgressionElementsDependencies); }"],
  ["label", "label(text, rect, node) { return addGarageProgressionLabel(this, text, rect, node); }"],
  ["nativeLabel", "nativeLabel(name, fallback) { return addGarageProgressionNativeLabel(this, name, fallback, garageProgressionElementsDependencies); }"],
  ["texture", "texture(name, rect) { return addGarageProgressionTexture(this, name, rect); }"],
  ["button", "button(name, title, action, disabled = false, offset = 0) { return addGarageProgressionButton(this, name, title, action, disabled, offset, garageProgressionElementsDependencies); }"],
  ["update", "update(progression, hasVehicle, grade, factory, exceedType, vehicle, noAvailableVehicles = false) { return updateGarageProgressionPanel(this, progression, hasVehicle, grade, factory, exceedType, vehicle, noAvailableVehicles, garageProgressionPanelDependencies); }"],
  ["draw", "draw(context, grade) { return drawGarageProgressionView(this, context, grade, garageProgressionDrawDependencies); }"],
]);
const garageProgressionHelperOverrides = new Map([
  ["$s", "function $s(vehicle, restrictions) { return garageExceedChangeAvailability(vehicle, restrictions); }"],
  ["ya", "function ya(element, value) { return appendGarageNativeColorText(element, value); }"],
]);
const garageEquipmentOverrides = new Map([
  ["requireCustomization", "requireCustomization() { return requireGarageCustomization(this, ae); }"],
  ["equip", "equip(part) { return equipGaragePart(this, part, garageEquipmentDependencies); }"],
  ["requestEquip", "requestEquip(part) { return requestGaragePartEquip(this, part, garageEquipmentDependencies); }"],
  ["selectSlot", "selectSlot(slot) { return selectGaragePartSlot(this, slot); }"],
  ["setPartPreview", "setPartPreview(part) { return setGaragePartPreview(this, part); }"],
]);
const garageCatalogNavigationOverrides = new Map([
  ["selectPage", "selectPage(page) { return selectGaragePage(this, page, garageCatalogDependencies); }"],
  ["selectKart", "selectKart(vehicle) { return selectGarageKart(this, vehicle, Ft); }"],
  ["filteredKarts", "filteredKarts() { return filteredGarageKarts(this, garageCatalogDependencies); }"],
  ["nativeFactoryAllowed", "nativeFactoryAllowed(vehicle = this.selected) { return garageFactoryAllowed(this, vehicle, garageCatalogDependencies); }"],
  ["canSetProgression", "canSetProgression(progression) { return canSetGarageProgression(this, progression, garageCatalogDependencies); }"],
]);
const garageFactoryScoringOverrides = new Map([
  ["updateFactoryScores", "updateFactoryScores() { return updateGarageFactoryScores(this, garageFactoryScoringDependencies); }"],
  ["factoryVehicleKey", "factoryVehicleKey(vehicle) { return garageFactoryVehicleKey(this, vehicle); }"],
  ["canonicalFactoryVehicle", "canonicalFactoryVehicle(vehicle) { return canonicalGarageFactoryVehicle(this, vehicle); }"],
  ["serialFor", "serialFor(vehicle) { return garageKartSerialFor(this, vehicle); }"],
]);
const garageCosmeticEquipmentOverrides = new Map([
  ["requestCoating", "requestCoating(choice) { return requestGarageCoating(this, choice); }"],
  ["equipCoating", "async equipCoating(choice) { return equipGarageCoating(this, choice, garageCosmeticDependencies); }"],
  ["requestCosmetic", "requestCosmetic(choice) { return requestGarageCosmetic(this, choice); }"],
  ["equipCosmetic", "async equipCosmetic(choice) { return equipGarageCosmetic(this, choice, garageCosmeticDependencies); }"],
]);
const garageCardCatalogOverrides = new Map([
  ["updateCards", "updateCards() { return updateGarageCards(this, garageCardDependencies); }"],
]);
const garageStateCommitOverrides = new Map([
  ["requestRestoreDefaults", "requestRestoreDefaults() { return requestGarageRestoreDefaults(this, garageStateCommitDependencies); }"],
  ["publishCurrentState", "publishCurrentState() { return publishGarageCurrentState(this, garageStateCommitDependencies); }"],
  ["setProgression", "setProgression(progression, refreshControls = true) { return setGarageProgression(this, progression, refreshControls, garageStateCommitDependencies); }"],
  ["refreshUpgradeState", "refreshUpgradeState() { return refreshGarageUpgradeState(this, garageStateCommitDependencies); }"],
]);
const garageFactoryCommitOverrides = new Map([
  ["setFactory", "async setFactory(factory) { return setGarageFactory(this, factory, garageFactoryCommitDependencies); }"],
]);
const garageUpgradeDialogOverrides = new Map([
  ["requestSkillSelection", "requestSkillSelection(slot) { return requestGarageSkillSelection(this, slot, garageUpgradeDialogDependencies); }"],
  ["requestExceedTypeChange", "requestExceedTypeChange() { return requestGarageExceedTypeChange(this, garageUpgradeDialogDependencies); }"],
]);
const garageProgressionFlowOverrides = new Map([
  ["requestProgression", "requestProgression(target, prepared = false, method = \"step\") { return requestGarageProgression(this, target, prepared, method, garageProgressionFlowDependencies); }"],
]);
const garageCosmeticInventoryOverrides = new Map([
  ["cosmeticIcon", "cosmeticIcon(choice, className) { return garageCosmeticIcon(this, choice, className); }"],
  ["updateCoatingInventory", "updateCoatingInventory() { return updateGarageCoatingInventory(this, garageCosmeticInventoryDependencies); }"],
  ["updateCosmeticInventory", "updateCosmeticInventory() { return updateGarageCosmeticInventory(this, garageCosmeticInventoryDependencies); }"],
  ["syncCosmeticPreviewActions", "syncCosmeticPreviewActions() { return syncGarageCosmeticPreviewActions(this); }"],
]);
const garagePerformanceOverrides = new Map([
  ["updatePerformance", "updatePerformance() { return updateGaragePerformance(this, garagePerformanceDependencies); }"],
  ["renderScoreRows", "renderScoreRows(rows, title) { return renderGarageScoreRows(this, rows, title, garagePerformanceDependencies); }"],
]);
const garageLifecycleOverrides = new Map([
  ["load", "static async load(options) { return loadGarageView(options, garageLifecycleLoadDependencies); }"],
  ["show", "show() { return showGarageView(this, garageLifecycleDependencies); }"],
  ["freeze", "freeze() { return freezeGarageView(this, garageLifecycleDependencies); }"],
  ["unfreeze", "unfreeze() { return unfreezeGarageView(this); }"],
  ["dispose", "dispose() { return disposeGarageView(this, garageLifecycleDependencies); }"],
  ["resizeSurface", "resizeSurface() { return resizeGarageSurface(this, garageViewportDependencies); }"],
]);
const garageEquippedCosmeticsOverrides = new Map([
  ["updateCosmeticEquippedSlots", "updateCosmeticEquippedSlots(equipment, layout, interactive) { return updateGarageCosmeticEquippedSlots(this, equipment, layout, interactive, garageEquippedCosmeticsDependencies); }"],
]);
const garageVehicleInformationOverrides = new Map([
  ["updateVehicleInformation", "updateVehicleInformation(vehicle, equipment, layout, refreshPerformance = true) { return updateGarageVehicleInformation(this, vehicle, equipment, layout, refreshPerformance, garageVehicleInformationDependencies); }"],
  ["updateVehicleHeading", "updateVehicleHeading(level) { return updateGarageVehicleHeading(this, level); }"],
  ["updateVehicleFunctions", "updateVehicleFunctions(vehicle, layout) { return updateGarageVehicleFunctions(this, vehicle, layout, garageVehicleInformationDependencies); }"],
]);
const garagePageVisibilityOverrides = new Map([
  ["updatePageVisibility", "updatePageVisibility() { return updateGaragePageVisibility(this, garagePageVisibilityDependencies); }"],
]);
const garageControlsOverrides = new Map([
  ["updateControls", "updateControls() { return updateGarageControls(this, garageControlsDependencies); }"],
]);
const garageViewControlsOverrides = new Map([
  ["place", "place(element, rect) { return placeGarageControl(this, element, rect); }"],
  ["setPartsOnlyNodesMounted", "setPartsOnlyNodesMounted(mounted) { return setGaragePartsOnlyNodesMounted(this, mounted); }"],
  ["setVehicleInfoNodesMounted", "setVehicleInfoNodesMounted(mounted) { return setGarageVehicleInfoNodesMounted(this, mounted); }"],
  ["setUpgradeStatusMounted", "setUpgradeStatusMounted(mounted) { return setGarageUpgradeStatusMounted(this, mounted); }"],
  ["button", "button(label, action) { return createGarageActionButton(this, label, action); }"],
  ["skin", "skin(button, imageBase, states = 4) { return skinGarageActionButton(this, button, imageBase, states); }"],
  ["nativeButton", "nativeButton(name, fallback, action, override) { return createGarageNativeButton(this, name, fallback, action, override, { attribute: y }); }"],
  ["rect", "rect(name) { return garageViewRect(this, name); }"],
  ["icon", "icon(key, className) { return createGarageIcon(this, key, className); }"],
]);
const garagePartModelsOverrides = new Map([
  ["partVisual", "partVisual(container, part, className, row) { return renderGaragePartVisual(this, container, part, className, row, { iconKey: Ss, cardLayout: xt }); }"],
  ["addModelTarget", "addModelTarget(container, source, className, row, fallback, dimensions) { return addGaragePartModelTarget(this, container, source, className, row, fallback, dimensions); }"],
  ["renderPartModels", "renderPartModels() { return renderGaragePartModels(this); }"],
]);
const garageBuildControlsOverrides = new Map([
  ["buildControls", "buildControls() { return buildGarageControls(this, { slots: de, slotLabels: ai, inventoryRect: Dt, removeButtonRect: _n, cardsRect: bt }); }"],
]);
const garageViewConstructionOverrides = new Map([
  ["constructor", `constructor(options, assets, tuning, previews) { return initializeGarageView(this, options, assets, tuning, previews, {
    validateKart: Ft, createDrawing: canvas => new Js(canvas),
    createModelCache: (load, onError) => new Qi(load, onError),
    loadModel: (library, path, environment, stageBinding) => Je(library, path, environment, stageBinding),
    bindInteractionAudio: ei, isHoverAudible: xi, isClickAudible: Ci,
    createProgressionPanel: (...args) => new va(...args),
    createPointEffects: (...args) => new Ka(...args),
    createControlCanvas: (...args) => new Pi(...args),
    createResizeObserver: callback => new ResizeObserver(callback), window,
  }); }`],
]);
const garageViewActionsOverrides = new Map([
  ["serial", "serial() { return garageSelectedKartSerial(this); }"],
  ["speedVersion", "get speedVersion() { return garageSpeedVersion(this, garageViewActionDependencies); }"],
  ["base", "base() { return garageBaseSpecification(this); }"],
  ["baseFor", "baseFor(kart) { return garageBaseForKart(this, kart, garageViewActionDependencies); }"],
  ["partLabel", "partLabel(part) { return garagePartLabel(this, part, garageViewActionDependencies); }"],
  ["rehitTestInventoryPreview", "rehitTestInventoryPreview() { return rehitGarageInventoryPreview(this, garageViewActionDependencies); }"],
  ["showFactoryTutorial", "async showFactoryTutorial() { return showGarageFactoryTutorial(this, garageViewActionDependencies); }"],
  ["onKey", "onKey = event => handleGarageEscapeKey(this, event);"],
]);
const garageViewFieldActionsOverrides = new Map([
  ["inventoryScroll", `inventoryScroll = createGarageInventoryScroll(this,
    (inventory, hitTarget, step) => new vn(inventory, hitTarget, step));`],
  ["cancelPreview", "cancelPreview = createGarageCancelPreviewButton(this);"],
  ["removePart", "removePart = createGarageRemovePartButton(this);"],
]);
const garageFrameCanvasOverrides = new Map([
  ["captureStrengtheningStage", "captureStrengtheningStage() { return captureGarageStrengtheningStage(this); }"],
  ["captureStage", "captureStage() { return captureGarageStage(this); }"],
  ["finishCanvasFrame", "finishCanvasFrame(frozen = false) { return finishGarageCanvasFrame(this, frozen); }"],
  ["paintTaskbar", "paintTaskbar() { return paintGarageTaskbar(this); }"],
  ["authoredPointerY", "authoredPointerY(event) { return garageAuthoredPointerY(this, event); }"],
  ["drawKartCatalogFrame", "drawKartCatalogFrame(context, rect, selected, hovered = false) { return drawGarageKartCatalogFrame(this, context, rect, selected, hovered); }"],
  ["drawKartLevelBadge", "drawKartLevelBadge(context, kart, rect) { return drawGarageKartLevelBadge(this, context, kart, rect, garageFrameCanvasDependencies); }"],
]);
const garageStrengtheningOverlayOverrides = new Map([
  ["renderStrengtheningOverlay", "renderStrengtheningOverlay(time) { return renderGarageStrengtheningOverlay(this, time, garageStrengtheningOverlayDependencies); }"],
]);
const garageFrameRenderOverrides = new Map([
  ["frame", "frame = () => renderGarageFrame(this, garageFrameRenderDependencies);"],
]);
const garagePreviewInputOverrides = new Map([
  ["createTransformPreviewButton", "createTransformPreviewButton() { return createGarageTransformPreviewButton(this, garagePreviewInputDependencies); }"],
  ["onDragStart", "onDragStart = event => startGaragePreviewDrag(this, event);"],
  ["onDragMove", "onDragMove = event => moveGaragePreviewDrag(this, event);"],
  ["onDragEnd", "onDragEnd = event => endGaragePreviewDrag(this, event);"],
]);
const garageTransformPreviewOverrides = new Map([
  ["startTransformPreview", "startTransformPreview(immediate = false) { return startGarageTransformPreview(this, immediate); }"],
  ["transformPreviewSessionActive", "transformPreviewSessionActive() { return isGarageTransformPreviewSessionActive(this); }"],
  ["flushTransformPreviewStart", "flushTransformPreviewStart() { return flushGarageTransformPreviewStart(this); }"],
  ["syncTransformPreviewUi", "syncTransformPreviewUi() { return syncGarageTransformPreviewUi(this); }"],
  ["moveToTransformPreviewRoot", "moveToTransformPreviewRoot(control) { return moveToGarageTransformPreviewRoot(this, control); }"],
  ["placeInTransformPreviewRoot", "placeInTransformPreviewRoot(control, rect) { return placeInGarageTransformPreviewRoot(this, control, rect); }"],
  ["activePreviewRect", "activePreviewRect() { return activeGaragePreviewRect(this); }"],
  ["finishPreviewDrag", "finishPreviewDrag(pointerId) { return finishGaragePreviewDrag(this, pointerId); }"],
]);
const garageFactoryPickerOverrides = new Map([
  ["renderAbilityPicker", "renderAbilityPicker(configuration, editable, bounds) { return renderGarageFactoryAbilityPicker(this, configuration, editable, bounds, garageFactoryPickerDependencies); }"],
  ["updateDraftSlot", "updateDraftSlot(index, selection) { return updateGarageFactoryDraftSlot(this, index, selection); }"],
  ["commit", "commit(configuration) { return commitGarageFactoryChoice(this, configuration, garageFactoryPickerDependencies); }"],
  ["factoryChoiceButton", "factoryChoiceButton(text, pressed, disabled, action) { return createGarageFactoryChoiceButton(this, text, pressed, disabled, action, garageFactoryPickerDependencies); }"],
]);
const garageFactoryPanelOverrides = new Map([
  ["update", "update(configuration, supported, busy = false, vehicleName, vehicle, vehicleKey = vehicleName) { return updateGarageFactoryPanel(this, configuration, supported, busy, vehicleName, vehicle, vehicleKey, garageFactoryPanelDependencies); }"],
]);
const garageFactoryViewOverrides = new Map([
  ["constructor", "constructor(assets, onChange, onConfirm, onTabChange, onTutorial) { initializeGarageFactoryView(this, assets, onChange, onConfirm, onTabChange, onTutorial); }"],
  ["showsCatalog", "get showsCatalog() { return garageFactoryShowsCatalog(this); }"],
  ["previewRect", "get previewRect() { return garageFactoryPreviewRect(this); }"],
  ["catalogLayout", "get catalogLayout() { return garageFactoryCatalogLayout(this.assets, garageFactoryViewDependencies); }"],
  ["place", "place(element, rect) { return placeGarageFactoryElement(this, element, rect); }"],
  ["label", "label(text, rect, node) { return addGarageFactoryLabel(this, text, rect, node, garageFactoryViewDependencies); }"],
  ["updateScores", "updateScores(scores, title) { return updateGarageFactoryScoreLabel(this, scores, title); }"],
]);
const garageFactoryCanvasOverrides = new Map([
  ["resizeCanvases", "resizeCanvases() { return resizeGarageFactoryCanvases(this); }"],
  ["styleActionFrame", "styleActionFrame(button) { return styleGarageFactoryActionFrame(this, button, garageFactoryCanvasDependencies); }"],
  ["draw", "draw(context) { return drawGarageFactoryBackground(this, context, garageFactoryCanvasDependencies); }"],
  ["drawCatalogFrame", "drawCatalogFrame(context, index, selected, hover = false) { return drawGarageFactoryCatalogFrame(this, context, index, selected, hover); }"],
]);
const garageTopLevelBusinessOverrides = new Map([
  ["Yi", "function Yi(model) { return garagePartModelDuration(model); }"],
  ["Zi", `function Zi(panel, width, height) { return createGaragePartCamera(panel, width, height, {
    field: y, verticalFov: us,
    createPerspectiveCamera: (fov, aspect, near, far) => new zs(fov, aspect, near, far),
  }); }`],
  ["Je", `function Je(library, request, environment, stageBinding) { return loadGaragePartModelScene(library, request, environment, stageBinding, {
    field: y, verticalFov: us,
    createPerspectiveCamera: (fov, aspect, near, far) => new zs(fov, aspect, near, far),
    parsePanel: j, parseModel: qs, createScene: () => new Os(),
    loadScene: Ds, now: () => performance.now(),
  }); }`],
  ["la", "function la(base, enhanced, weights) { return calculateGarageRadar(base, enhanced, weights); }"],
  ["Yt", "function Yt(rect, axis, percent) { return garageRadarPoint(rect, axis, percent); }"],
  ["ga", "function ga(context, rect, axes) { return drawGarageRadar(context, rect, axes); }"],
  ["ea", "function ea(root) { return parseGarageTuneAbilities(root, L); }"],
  ["ta", "function ta(root) { return parseGarageExceedTypes(root, L); }"],
  ["sa", "function sa(root) { return parseGarageExceedChangeRules(root, L); }"],
  ["oa", "function oa(node) { return parseGarageRadarInput(node, L); }"],
  ["ca", "function ca(root) { return parseGarageRadarWeights(root, L); }"],
  ["da", `function da(library, path) { return loadGarageRadarParameters(library, path, {
    attribute: L, parseXml: Z, loadVehicleParameters: ps,
  }); }`],
]);
const garageScoreBusinessOverrides = new Map([
  ["Me", `function Me(source, vehicle, engineGrade, configuration, parts, ignoredSlot) {
    return calculateGarageVehicleScores(source, vehicle, engineGrade, configuration,
      parts, ignoredSlot, {
        partFamily: me, scoreFamily: vt, validateFactory: Tt,
        validatePart: Zs, slotLocked: fe, slots: de,
        scorePartCategories: fn, scorePartFields: pn, resolvePart: Xe,
        skillBonus: (skills, progression) => garageXunSkillBonus(skills, progression, kt),
        combineXun: combineGarageXunScores, scoreBody: scoreGarageBody,
        addLegacyParts: (input, current) => applyGarageLegacyParts(input, current, de),
        applyFactory: as, fallbackGrade: ys, gradeContains: garageGradeContains,
        inversePartScore: inverseGaragePartScore,
      });
  }`],
  ["tn", "function tn(tuning, abilities) { return parseGarageSkillScoreTable(tuning, abilities, L); }"],
  ["ln", "function ln(root) { return parseGaragePartGradeGrid(root, L); }"],
  ["rs", "function rs(value) { return roundGarageScore(value); }"],
  ["_s", "function _s(field, value, table) { return projectGarageScoreField(field, value, table); }"],
  ["Nt", "function Nt(value) { return garageScoreInteger(value); }"],
  ["ut", "function ut(input, table) { return scoreGarageBody(input, table); }"],
  ["cn", "function cn(field, value, table) { return inverseGaragePartScore(field, value, table); }"],
  ["hn", "function hn(grid, grade, field, value) { return garageGradeContains(grid, grade, field, value); }"],
  ["un", "function un(input, parts, bonus) { return combineGarageXunScores(input, parts, bonus); }"],
  ["yn", "function yn(input, configuration) { return applyGarageLegacyParts(input, configuration, de); }"],
  ["sn", "function sn(skills, progression) { return garageXunSkillBonus(skills, progression, kt); }"],
]);
const garageAssetLoaderOverrides = new Map([
  ["Ui", `function Ui(library, width) { return loadGarageAssetBundle(library, width, {
    normalizeStage: _t, stageDirectory: Ve, parseBml: j, parseXml: Z,
    attribute: y, xmlAttribute: L, alignPair: Qe, partCardLayout: qt,
    partScrollbar: Ms, loadCosmetics: Rs, cosmeticLookup: Fs,
    loadCoatings: Gs, partSlots: de, collectParts: Bi, partIconKey: Ss,
    builtInTextures: Ri, nativeStatePath: se, lampTexture: Ze,
    fontResourcePrefix: Di, fontResourceName: Oi, fontFamily: zt,
    canLoadFont: () => typeof FontFace < "u", loadFont: St, unloadFont: Ce,
    bitmapMeta: $t, createBitmap: blob => createImageBitmap(blob),
    createObjectUrl: blob => URL.createObjectURL(blob),
    revokeObjectUrl: url => URL.revokeObjectURL(url), childRect: Y,
  }); }`],
  ["ia", `function ia(library, mode, width) { return loadGarageUpgradeAssets(library, mode, width, {
    normalizeStage: _t, parseBml: j, parseXml: Z, attribute: y,
    xmlAttribute: L, frameStyle: ve, parseEnchantDescriptions: ea,
    parseExceedChange: sa, nativeStatePath: se,
    skillTextures: Vt, exceedTextures: Ht,
    loadFont: St, unloadFont: Ce,
    createBitmap: blob => createImageBitmap(blob),
    createObjectUrl: blob => URL.createObjectURL(blob),
    revokeObjectUrl: url => URL.revokeObjectURL(url), childRect: Y,
  }); }`],
  ["Ba", `function Ba(library) { return loadGarageSkillAssets(library, {
    directory: Fa, imageNames: Ga, parseBml: j, attribute: y,
    childRect: Y, createBitmap: blob => createImageBitmap(blob),
    createObjectUrl: blob => URL.createObjectURL(blob),
    revokeObjectUrl: url => URL.revokeObjectURL(url),
  }); }`],
  ["ja", `function ja(library) { return loadGaragePreparationAssets(library, {
    layoutDirectory: ts, cardDirectory: dt, imageTokens: Va,
    parseBml: j, attribute: y, frameStyle: ve, childRect: Y,
    frameInnerRect: Rt, parseArrowColor: We, cardLayout: Wa,
    canLoadFont: () => typeof FontFace < "u", loadFont: St, unloadFont: Ce,
    bitmapMeta: $t, createBitmap: blob => createImageBitmap(blob),
    createObjectUrl: blob => URL.createObjectURL(blob),
    revokeObjectUrl: url => URL.revokeObjectURL(url),
  }); }`],
]);
const garageUpgradeFlowLoaderOverrides = new Map([
  ["Ea", `async function Ea(library, surface) { return showGarageUpgradeTutorial(library, surface, {
    parseBml: j, attribute: y, frameStyle: ve, layout: Ws,
    childRect: Y, paintFrame: be, sizeCanvas: Pe, pixelRatio: Ee,
    fontFamily: yt, loadFont: ws, unloadFont: Ce, bitmapMeta: $t,
    createBitmap: blob => createImageBitmap(blob),
  }); }`],
  ["Ma", `async function Ma(library, environment, stage, resultOnly = false) { return loadGarageXunUpgradePanels(library, environment, stage, resultOnly, {
    directory: es, stages: _a, parseBml: j, attribute: y,
    loadScene: Je,
  }); }`],
  ["ka", `async function ka(library, environment, stage) { return loadGarageClassicUpgradeResult(library, environment, stage, {
    directory: Jt, fontFamily: yt, parseBml: j, attribute: y,
    childRect: Y, loadFont: ws, unloadFont: Ce, loadScene: Je,
    createBitmap: blob => createImageBitmap(blob),
  }); }`],
]);
const garageSupportBusinessOverrides = new Map([
  ["nn", "function nn(root) { return parseGarageFactoryAbilityScores(root, garageScoreResourceDependencies()); }"],
  ["ns", "function ns(root, kind) { return parseGarageWeightTable(root, kind, garageScoreResourceDependencies()); }"],
  ["gn", "function gn(root, table) { return parseGarageXunPartValues(root, table, garageScoreResourceDependencies()); }"],
  ["cs", `async function cs(library, vehicle, kind) { return loadGarageScoreSource(library, vehicle, kind, {
    ...garageScoreResourceDependencies(), cache: os, parseXml: Z,
    parseWeights: ns, parseParts: gn, parseGradeGrid: ln,
    loadSkills: an, loadFactory: rn, loadVehicle: ps, normalizeBody: on,
  }); }`],
  ["_i", "function _i(root) { return parseGarageEnchantSpecs(root, { attribute: L, categories: Ps, appliesToGameType: Bt, scoreFields: Ii }); }"],
  ["Ls", "function Ls(part, available) { return garagePartOrdinal(part, available, garagePartPresentationDependencies()); }"],
  ["Ns", "function Ns(part, available) { return garageXunPartOrdinal(part, available, garagePartPresentationDependencies()); }"],
  ["$n", "function $n(part, strings, available) { return garagePartDisplayName(part, strings, available, garagePartPresentationDependencies()); }"],
  ["qt", "function qt(card, horizontalGap, verticalGap) { return garagePartCardLayout(card, horizontalGap, verticalGap, garageCardLayoutDependencies()); }"],
  ["Wa", "function Wa(selector, card) { return garagePreparationCardLayout(selector, card, garageCardLayoutDependencies()); }"],
  ["An", "function An(root, visible) { return planGarageDrawOrder(root, visible, { attribute: y, cache: hs }); }"],
  ["Fn", "async function Fn(options) { return loadGarageDefaultPreviews(options, { defaultVersion: vs, loadSpecification: bi, previewKey: bs, createPreview: xs }); }"],
  ["Mn", "function Mn(target, value, current, select) { return bindGarageHoverPreview(target, value, current, select); }"],
]);
const garageExtendedBusinessOverrides = new Map([
  ["an", "async function an(library) { return loadGarageSkillScores(library, garageScoreApplicationDependencies()); }"],
  ["rn", "async function rn(library) { return loadGarageFactoryScores(library, garageScoreApplicationDependencies()); }"],
  ["as", "function as(base, scores, factory, includeInactive = false) { return applyGarageFactoryScores(base, scores, factory, includeInactive, garageScoreApplicationDependencies()); }"],
  ["on", "function on(body) { return normalizeGarageBodyScore(body, garageScoreApplicationDependencies()); }"],
  ["dn", "function dn(grid, grade, field, score) { return garageScoreGrade(grid, grade, field, score); }"],
  ["wn", "function wn(before, after, base) { return garageScoreTrend(before, after, base); }"],
  ["zi", "function zi(library, width = 1600) { return garageAssetsForWidth(library, width, Ot, Ui); }"],
  ["Wt", "function Wt(library, mode = \"kartune\", width = 1600) { return garageUpgradeAssetsForMode(library, mode, width, jt, ia); }"],
  ["Ts", "function Ts(library) { return garageDialogAssets(library, He, Ba); }"],
  ["Ha", "function Ha(library) { return garageDialogAssets(library, je, ja); }"],
  ["bt", "function bt(assets) { return garageKartCardsRect(assets); }"],
  ["Dt", "function Dt(assets, kind) { return garagePartsGridRect(assets, kind, xt); }"],
  ["Ss", "function Ss(part) { return garagePartIconKey(part, Ni); }"],
  ["Pn", "function Pn(part, available) { return isGarageMaxXunPart(part, available); }"],
  ["Ln", "function Ln(page, xun) { return garagePageOverlayNames(page, xun); }"],
  ["he", "function he(button, style, kind) { return styleGarageActionButton(button, style, kind); }"],
  ["xa", "function xa(button) { return garagePointerPresence(button); }"],
  ["La", "function La(summary) { return garageXunUpgradeRows(summary); }"],
  ["Qe", "function Qe(value) { return garagePair(value); }"],
  ["We", "function We(value, label) { return garageArrowColor(value, label); }"],
  ["gt", "function gt(value, count, label) { return garageNumericTuple(value, count, label); }"],
  ["Aa", "function Aa(durations, elapsed) { return garageUpgradeAnimationPhase(durations, elapsed); }"],
  ["Gi", "function Gi(assets, index) { return garageKartCardRect(assets, index, bt); }"],
  ["st", "function st(rect) { return garageInsetRect(rect, It); }"],
  ["fa", "function fa(rect) { return garageSecondInsetRect(rect, It); }"],
  ["ma", "function ma(left, right) { return garageBetweenRects(left, right, It); }"],
  ["wa", "function wa(rect, rightEdge) { return garageExtendRect(rect, rightEdge); }"],
  ["ue", "function ue(grade) { return garageLayoutForEngineGrade(grade, { classic: Ki, v1: Vi, xun: Hi }); }"],
  ["pe", "function pe(grade) { return garageProgressionKind(grade); }"],
  ["Xi", "function Xi(vehicle, equipment, configuration, part, version = 7) { return previewGaragePart(vehicle, equipment, configuration, part, version, { calculate: te, family: me, slotLocked: fe }); }"],
  ["Ge", "function Ge(strings, key, fallback) { return garageText(strings, key, fallback); }"],
  ["pt", "function pt(strings, grade, fallback) { return garageEngineName(strings, grade, fallback); }"],
  ["ft", "function ft(grade, strings) { return garageGradeName(grade, strings, bn, Cn); }"],
  ["Et", "function Et(part) { return garagePartQuality(part); }"],
  ["Sn", "function Sn(part, fallback) { return garagePartCardBackground(part, fallback); }"],
  ["In", "function In(kind) { return garageKartTypeTexture(kind); }"],
  ["Nn", "function Nn(page, layout) { return garagePageBackground(page, layout); }"],
  ["ds", "function ds(page, grade) { return garageShowsVehicleInformation(page, grade); }"],
  ["mt", "function mt(locked, blocked = false) { return garageAllowsEquipment(locked, blocked); }"],
  ["Rn", "function Rn(container, x, y, elementFromPoint, cards) { return garagePreviewHitTest(container, x, y, elementFromPoint, cards); }"],
  ["ee", "function ee(value) { return garageRadarFinite(value, H); }"],
  ["ye", "function ye(node, name, fallback) { return garageRadarAttribute(node, name, fallback, L, H); }"],
  ["ha", "function ha(values, defaults, weights, stage) { return garageRadarBaseline(values, defaults, weights, stage, { normalize: Ks, calculate: Us }); }"],
  ["ua", "function ua(value, random = Math.random) { return garageExceedChoice(value, Ye, random); }"],
  ["is", "function is(value) { return garageSkillScoreInteger(value); }"],
  ["xe", "function xe(value) { return garageFiniteScore(value, U); }"],
  ["re", "function re(value) { return garageScoreNumber(value, U); }"],
]);
const garageNativeCatalogOverrides = new Map([
  ["Q", "const Q = garagePartCategoryIds, Ps = garagePartSlotsByCategory, $i = garageTuneNodesByCategory, Ti = garageTuneCategoriesByNode, ki = garageDrivingMode;"],
  ["Ii", "const Ii = garageEnchantScoreFields;"],
  ["ne", "const Es = garageVehicleFunctions, Ri = garageFunctionTextures;"],
  ["Ki", "const Ki = garageLayoutProfiles.classic, Vi = garageLayoutProfiles.v1, Hi = garageLayoutProfiles.xun;"],
  ["Vt", "const Vt = garageSkillTextures, Ht = garageExceedTextures, jt = new WeakMap();"],
  ["Fa", "const Fa = garageSkillDirectory, Ga = garageSkillPickerImages, He = new WeakMap();"],
  ["tt", "const tt = garageFactoryAbilityAttributes, ks = zeroGarageFactoryAbility;"],
  ["pn", "const pn = garageScoreFieldBySlot, fn = garageScorePartCategories, mn = garageScoreXmlAttributes, ls = garageScoreDisplayRows;"],
]);
const garageRemainingPrimitiveOverrides = new Map([
  ["Bt", "function Bt(gameTypes) { return garageGameTypeAllowed(gameTypes, ki); }"],
  ["Ni", "function Ni(slot) { return garagePartCategoryId(slot, Q); }"],
  ["_t", "function _t(width) { return garageStageLayout(width, Mi); }"],
  ["Fi", "function Fi(vehicle) { return garageAvailableVehicleFunctions(vehicle, Es); }"],
  ["xt", "function xt(assets, kind) { return garagePartCardLayoutForKind(assets, kind); }"],
  ["se", "function se(path, suffix) { return garageNativeStatePath(path, suffix); }"],
  ["Ut", "function Ut(kind) { return garageExpectedProgressionKind(kind); }"],
  ["Wi", "function Wi(value, locked, fallback = \"原装\") { return garagePartPresentation(value, locked, fallback); }"],
  ["ht", "function ht(factory) { return garageFactoryAbilityDraft(factory.abilities, js); }"],
  ["Zt", "function Zt(factory) { return garageFactorySignature(factory); }"],
  ["Ta", "function Ta(summary) { return garageClassicUpgradeLines(summary); }"],
  ["Na", "function Na(value) { return garageNeedsLoadingLabel(value); }"],
  ["En", "function En(part, available, enabled) { return garageShowMaxPart(part, available, enabled, Pn); }"],
]);
const garageRemainingCatalogOverrides = new Map([
  ["Ai", "const Ai = garageDefaultWidth, Mi = garageStageSizes;"],
  ["Ve", "const Ve = garageStageDirectory, Ze = garageLampTexture;"],
  ["Ot", "const Ot = new WeakMap(), Di = garageFontPath, Oi = garageFontResource, zt = garageFontFamily;"],
  ["ji", "const ji = garageDefaultPartFields;"],
  ["Ji", "const Ji = garageNativeRarityValues;"],
  ["H", "const H = Math.fround, et = garageRadarAttributes, aa = garageRadarDescriptionKeys, na = garageRadarCaptions, ra = garageRadarSkillFields;"],
  ["Ye", "const Ye = garageExceedChoices;"],
  ["It", "const It = garageSidePanelInset, pa = garageSidePanelInnerInset;"],
  ["ba", "const ba = garageResetPrompt;"],
  ["Jt", "const Jt = garageClassicUpgradeDirectory;"],
  ["es", "const es = garageXunUpgradeDirectory, _a = garageXunUpgradeStages, Ia = garageXunUpgradeStageLabels;"],
  ["Oa", "const Oa = garageSkillPanelPath;"],
  ["ts", "const ts = garagePreparationDirectory, dt = garagePreparationCardDirectory, Va = garagePreparationImages, je = new WeakMap();"],
  ["Xa", "const Xa = garageSkillDialogRect;"],
  ["Ct", "const Ct = garageXunSkillAttributes, Pt = zeroGarageXunSkillScore;"],
  ["Se", "const Se = garageScoreFields, U = Math.fround, Lt = garageScoreWeightLengths;"],
  ["Is", "const Is = garageXunPartScoreFields;"],
  ["bn", "const bn = garageGradeKeys, xn = garagePartSlotKeys, Cn = garageGradeFallbacks;"],
  ["kn", "const kn = garageCardPageSize, _n = garageRemovePartRect;"],
  ["wt", "const wt = garageTuneSlotNodes;"],
]);
const garageAst = parse(garage, { sourceType: "module", errorRecovery: false });
const garageAssetLoaderEdits = garageAst.program.body.flatMap(node =>
  node.type === "FunctionDeclaration" && node.id &&
    garageAssetLoaderOverrides.has(node.id.name)
    ? [{ start: node.start, end: node.end,
      text: garageAssetLoaderOverrides.get(node.id.name), name: node.id.name }]
    : []);
assert(garageAssetLoaderEdits.length === garageAssetLoaderOverrides.size &&
  new Set(garageAssetLoaderEdits.map(edit => edit.name)).size ===
    garageAssetLoaderOverrides.size,
  "Garage asset loader functions changed in the release source.");
const garageUpgradeFlowLoaderEdits = garageAst.program.body.flatMap(node =>
  node.type === "FunctionDeclaration" && node.id &&
    garageUpgradeFlowLoaderOverrides.has(node.id.name)
    ? [{ start: node.start, end: node.end,
      text: garageUpgradeFlowLoaderOverrides.get(node.id.name), name: node.id.name }]
    : []);
assert(garageUpgradeFlowLoaderEdits.length === garageUpgradeFlowLoaderOverrides.size &&
  new Set(garageUpgradeFlowLoaderEdits.map(edit => edit.name)).size ===
    garageUpgradeFlowLoaderOverrides.size,
  "Garage tutorial or upgrade result loaders changed in the release source.");
const garageSupportBusinessEdits = garageAst.program.body.flatMap(node =>
  node.type === "FunctionDeclaration" && node.id &&
    garageSupportBusinessOverrides.has(node.id.name)
    ? [{ start: node.start, end: node.end,
      text: garageSupportBusinessOverrides.get(node.id.name), name: node.id.name }]
    : []);
assert(garageSupportBusinessEdits.length === garageSupportBusinessOverrides.size &&
  new Set(garageSupportBusinessEdits.map(edit => edit.name)).size ===
    garageSupportBusinessOverrides.size,
  "Garage score, part or preview helpers changed in the release source.");
const garageExtendedBusinessEdits = garageAst.program.body.flatMap(node =>
  node.type === "FunctionDeclaration" && node.id &&
    garageExtendedBusinessOverrides.has(node.id.name)
    ? [{ start: node.start, end: node.end,
      text: garageExtendedBusinessOverrides.get(node.id.name), name: node.id.name }]
    : []);
assert(garageExtendedBusinessEdits.length === garageExtendedBusinessOverrides.size &&
  new Set(garageExtendedBusinessEdits.map(edit => edit.name)).size ===
    garageExtendedBusinessOverrides.size,
  "Garage extended business helpers changed in the release source.");
const garageNativeCatalogEdits = garageAst.program.body.flatMap(node =>
  node.type === "VariableDeclaration" &&
    node.declarations[0]?.id.type === "Identifier" &&
    garageNativeCatalogOverrides.has(node.declarations[0].id.name)
    ? [{ start: node.start, end: node.end,
      text: garageNativeCatalogOverrides.get(node.declarations[0].id.name),
      name: node.declarations[0].id.name }]
    : []);
assert(garageNativeCatalogEdits.length === garageNativeCatalogOverrides.size &&
  new Set(garageNativeCatalogEdits.map(edit => edit.name)).size ===
    garageNativeCatalogOverrides.size,
  "Garage native catalog declarations changed in the release source.");
const garageRemainingPrimitiveEdits = garageAst.program.body.flatMap(node =>
  node.type === "FunctionDeclaration" && node.id &&
    garageRemainingPrimitiveOverrides.has(node.id.name)
    ? [{ start: node.start, end: node.end,
      text: garageRemainingPrimitiveOverrides.get(node.id.name), name: node.id.name }]
    : []);
assert(garageRemainingPrimitiveEdits.length === garageRemainingPrimitiveOverrides.size &&
  new Set(garageRemainingPrimitiveEdits.map(edit => edit.name)).size ===
    garageRemainingPrimitiveOverrides.size,
  "Garage remaining primitive functions changed in the release source.");
const garageRemainingCatalogEdits = garageAst.program.body.flatMap(node =>
  node.type === "VariableDeclaration" &&
    node.declarations[0]?.id.type === "Identifier" &&
    garageRemainingCatalogOverrides.has(node.declarations[0].id.name)
    ? [{ start: node.start, end: node.end,
      text: garageRemainingCatalogOverrides.get(node.declarations[0].id.name),
      name: node.declarations[0].id.name }]
    : []);
assert(garageRemainingCatalogEdits.length === garageRemainingCatalogOverrides.size &&
  new Set(garageRemainingCatalogEdits.map(edit => edit.name)).size ===
    garageRemainingCatalogOverrides.size,
  "Garage remaining native constants changed in the release source.");
const garageScoreBusinessEdits = garageAst.program.body.flatMap(node =>
  node.type === "FunctionDeclaration" && node.id &&
    garageScoreBusinessOverrides.has(node.id.name)
    ? [{ start: node.start, end: node.end,
      text: garageScoreBusinessOverrides.get(node.id.name), name: node.id.name }]
    : []);
assert(garageScoreBusinessEdits.length === garageScoreBusinessOverrides.size &&
  new Set(garageScoreBusinessEdits.map(edit => edit.name)).size ===
    garageScoreBusinessOverrides.size,
  "Garage score business functions changed in the release source.");
const garageTopLevelBusinessEdits = garageAst.program.body.flatMap(node =>
  node.type === "FunctionDeclaration" && node.id &&
    garageTopLevelBusinessOverrides.has(node.id.name)
    ? [{ start: node.start, end: node.end,
      text: garageTopLevelBusinessOverrides.get(node.id.name), name: node.id.name }]
    : []);
assert(garageTopLevelBusinessEdits.length === garageTopLevelBusinessOverrides.size &&
  new Set(garageTopLevelBusinessEdits.map(edit => edit.name)).size ===
    garageTopLevelBusinessOverrides.size,
  "Garage top-level model, upgrade metadata, or radar functions changed.");
const garageEdits = garageAst.program.body.flatMap(node =>
  node.type === "FunctionDeclaration" && node.id && garagePartOverrides.has(node.id.name)
    ? [{ start: node.start, end: node.end, text: garagePartOverrides.get(node.id.name), name: node.id.name }]
    : []);
assert(garageEdits.length === garagePartOverrides.size &&
  new Set(garageEdits.map(edit => edit.name)).size === garagePartOverrides.size,
  "Garage parts business functions changed in the release source.");
const garageRuntimeClassEdits = garageAst.program.body.flatMap(node =>
  node.type === "ClassDeclaration" && node.id && garageRuntimeClassOverrides.has(node.id.name)
    ? [{ start: node.start, end: node.end,
      text: garageRuntimeClassOverrides.get(node.id.name), name: node.id.name }]
    : []);
assert(garageRuntimeClassEdits.length === garageRuntimeClassOverrides.size &&
  new Set(garageRuntimeClassEdits.map(edit => edit.name)).size === garageRuntimeClassOverrides.size,
  "Garage runtime classes changed in the release source.");
const garageUpgradeSessionClassEdits = garageAst.program.body.flatMap(node =>
  node.type === "ClassDeclaration" && node.id &&
    garageUpgradeSessionClassOverrides.has(node.id.name)
    ? [{ start: node.start, end: node.end,
      text: garageUpgradeSessionClassOverrides.get(node.id.name), name: node.id.name }]
    : []);
assert(garageUpgradeSessionClassEdits.length === garageUpgradeSessionClassOverrides.size &&
  new Set(garageUpgradeSessionClassEdits.map(edit => edit.name)).size === garageUpgradeSessionClassOverrides.size,
  "Garage upgrade session classes changed in the release source.");
const upgradeResultClass = garageAst.program.body.find(node =>
  node.type === "ClassDeclaration" && node.id?.name === "Ra");
assert(upgradeResultClass, "Garage upgrade result class changed in the release source.");
const garageUpgradeResultEdits = upgradeResultClass.body.body.flatMap(method =>
  method.type === "ClassMethod" && method.key.type === "Identifier" &&
    garageUpgradeResultOverrides.has(method.key.name)
    ? [{ start: method.start, end: method.end,
      text: garageUpgradeResultOverrides.get(method.key.name), name: method.key.name }]
    : []);
assert(garageUpgradeResultEdits.length === garageUpgradeResultOverrides.size &&
  new Set(garageUpgradeResultEdits.map(edit => edit.name)).size === garageUpgradeResultOverrides.size,
  "Garage upgrade result methods changed in the release source.");
const garagePointEffectHelperEdits = garageAst.program.body.flatMap(node =>
  node.type === "FunctionDeclaration" && node.id &&
    garagePointEffectHelperOverrides.has(node.id.name)
    ? [{ start: node.start, end: node.end,
      text: garagePointEffectHelperOverrides.get(node.id.name), name: node.id.name }]
    : []);
assert(garagePointEffectHelperEdits.length === garagePointEffectHelperOverrides.size,
  "Garage point effect helpers changed in the release source.");
const garagePreparationHelperEdits = garageAst.program.body.flatMap(node =>
  node.type === "FunctionDeclaration" && node.id &&
    garagePreparationHelperOverrides.has(node.id.name)
    ? [{ start: node.start, end: node.end,
      text: garagePreparationHelperOverrides.get(node.id.name), name: node.id.name }]
    : []);
assert(garagePreparationHelperEdits.length === garagePreparationHelperOverrides.size,
  "Garage preparation helpers changed in the release source.");
const garageControlCanvasHelperEdits = garageAst.program.body.flatMap(node =>
  node.type === "FunctionDeclaration" && node.id &&
    garageControlCanvasHelperOverrides.has(node.id.name)
    ? [{ start: node.start, end: node.end,
      text: garageControlCanvasHelperOverrides.get(node.id.name), name: node.id.name }]
    : []);
assert(garageControlCanvasHelperEdits.length === garageControlCanvasHelperOverrides.size,
  "Garage control canvas helpers changed in the release source.");
const preparationDialogClass = garageAst.program.body.find(node =>
  node.type === "ClassDeclaration" && node.id?.name === "Ja");
assert(preparationDialogClass, "Garage preparation dialog changed in the release source.");
const garagePreparationDialogEdits = preparationDialogClass.body.body.flatMap(method =>
  method.type === "ClassMethod" && method.key.type === "Identifier" &&
    garagePreparationDialogOverrides.has(method.key.name)
    ? [{ start: method.start, end: method.end,
      text: garagePreparationDialogOverrides.get(method.key.name), name: method.key.name }]
    : []);
assert(garagePreparationDialogEdits.length === garagePreparationDialogOverrides.size &&
  new Set(garagePreparationDialogEdits.map(edit => edit.name)).size ===
    garagePreparationDialogOverrides.size,
  "Garage preparation dialog methods changed in the release source.");
const progressionHelperEdits = garageAst.program.body.flatMap(node =>
  node.type === "FunctionDeclaration" && node.id && garageProgressionHelperOverrides.has(node.id.name)
    ? [{ start: node.start, end: node.end,
      text: garageProgressionHelperOverrides.get(node.id.name), name: node.id.name }]
    : []);
assert(progressionHelperEdits.length === garageProgressionHelperOverrides.size,
  "Garage progression helper functions changed in the release source.");
const factoryLayoutEdits = garageAst.program.body.flatMap(node =>
  node.type === "FunctionDeclaration" && node.id?.name === "Ca"
    ? [{ start: node.start, end: node.end,
      text: "function Ca(assets) { return garageFactoryCatalogLayout(assets, garageFactoryViewDependencies); }" }]
    : []);
assert(factoryLayoutEdits.length === 1, "Garage Factory catalog layout moved in the release source.");
const progressionClass = garageAst.program.body.find(node =>
  node.type === "ClassDeclaration" && node.id?.name === "va");
assert(progressionClass, "Garage progression panel class changed in the release source.");
const progressionEdits = progressionClass.body.body.flatMap(method =>
  method.type === "ClassMethod" && method.key.type === "Identifier" &&
    garageProgressionOverrides.has(method.key.name)
    ? [{ start: method.start, end: method.end,
      text: garageProgressionOverrides.get(method.key.name), name: method.key.name }]
    : []);
assert(progressionEdits.length === garageProgressionOverrides.size &&
  new Set(progressionEdits.map(edit => edit.name)).size === garageProgressionOverrides.size,
  "Garage progression radar methods changed in the release source.");
const garageViewClass = garageAst.program.body.find(node =>
  node.type === "ClassDeclaration" && node.id?.name === "As");
assert(garageViewClass, "Garage view class changed in the release source.");
const equipmentEdits = garageViewClass.body.body.flatMap(method =>
  method.type === "ClassMethod" && method.key.type === "Identifier" &&
    garageEquipmentOverrides.has(method.key.name)
    ? [{ start: method.start, end: method.end,
      text: garageEquipmentOverrides.get(method.key.name), name: method.key.name }]
    : []);
assert(equipmentEdits.length === garageEquipmentOverrides.size &&
  new Set(equipmentEdits.map(edit => edit.name)).size === garageEquipmentOverrides.size,
  "Garage equipment methods changed in the release source.");
const catalogNavigationEdits = garageViewClass.body.body.flatMap(method =>
  method.type === "ClassMethod" && method.key.type === "Identifier" &&
    garageCatalogNavigationOverrides.has(method.key.name)
    ? [{ start: method.start, end: method.end,
      text: garageCatalogNavigationOverrides.get(method.key.name), name: method.key.name }]
    : []);
assert(catalogNavigationEdits.length === garageCatalogNavigationOverrides.size &&
  new Set(catalogNavigationEdits.map(edit => edit.name)).size === garageCatalogNavigationOverrides.size,
  "Garage catalog navigation methods changed in the release source.");
const factoryScoringEdits = garageViewClass.body.body.flatMap(method =>
  method.type === "ClassMethod" && method.key.type === "Identifier" &&
    garageFactoryScoringOverrides.has(method.key.name)
    ? [{ start: method.start, end: method.end,
      text: garageFactoryScoringOverrides.get(method.key.name), name: method.key.name }]
    : []);
assert(factoryScoringEdits.length === garageFactoryScoringOverrides.size &&
  new Set(factoryScoringEdits.map(edit => edit.name)).size === garageFactoryScoringOverrides.size,
  "Garage Factory scoring methods changed in the release source.");
const cosmeticEquipmentEdits = garageViewClass.body.body.flatMap(method =>
  method.type === "ClassMethod" && method.key.type === "Identifier" &&
    garageCosmeticEquipmentOverrides.has(method.key.name)
    ? [{ start: method.start, end: method.end,
      text: garageCosmeticEquipmentOverrides.get(method.key.name), name: method.key.name }]
    : []);
assert(cosmeticEquipmentEdits.length === garageCosmeticEquipmentOverrides.size &&
  new Set(cosmeticEquipmentEdits.map(edit => edit.name)).size === garageCosmeticEquipmentOverrides.size,
  "Garage cosmetic equipment methods changed in the release source.");
const cardCatalogEdits = garageViewClass.body.body.flatMap(method =>
  method.type === "ClassMethod" && method.key.type === "Identifier" &&
    garageCardCatalogOverrides.has(method.key.name)
    ? [{ start: method.start, end: method.end,
      text: garageCardCatalogOverrides.get(method.key.name), name: method.key.name }]
    : []);
assert(cardCatalogEdits.length === garageCardCatalogOverrides.size &&
  new Set(cardCatalogEdits.map(edit => edit.name)).size === garageCardCatalogOverrides.size,
  "Garage card catalog method changed in the release source.");
const stateCommitEdits = garageViewClass.body.body.flatMap(method =>
  method.type === "ClassMethod" && method.key.type === "Identifier" &&
    garageStateCommitOverrides.has(method.key.name)
    ? [{ start: method.start, end: method.end,
      text: garageStateCommitOverrides.get(method.key.name), name: method.key.name }]
    : []);
assert(stateCommitEdits.length === garageStateCommitOverrides.size &&
  new Set(stateCommitEdits.map(edit => edit.name)).size === garageStateCommitOverrides.size,
  "Garage state commit methods changed in the release source.");
const factoryCommitEdits = garageViewClass.body.body.flatMap(method =>
  method.type === "ClassMethod" && method.key.type === "Identifier" &&
    garageFactoryCommitOverrides.has(method.key.name)
    ? [{ start: method.start, end: method.end,
      text: garageFactoryCommitOverrides.get(method.key.name), name: method.key.name }]
    : []);
assert(factoryCommitEdits.length === garageFactoryCommitOverrides.size,
  "Garage Factory commit method changed in the release source.");
const upgradeDialogEdits = garageViewClass.body.body.flatMap(method =>
  method.type === "ClassMethod" && method.key.type === "Identifier" &&
    garageUpgradeDialogOverrides.has(method.key.name)
    ? [{ start: method.start, end: method.end,
      text: garageUpgradeDialogOverrides.get(method.key.name), name: method.key.name }]
    : []);
assert(upgradeDialogEdits.length === garageUpgradeDialogOverrides.size &&
  new Set(upgradeDialogEdits.map(edit => edit.name)).size === garageUpgradeDialogOverrides.size,
  "Garage upgrade dialog methods changed in the release source.");
const progressionFlowEdits = garageViewClass.body.body.flatMap(method =>
  method.type === "ClassMethod" && method.key.type === "Identifier" &&
    garageProgressionFlowOverrides.has(method.key.name)
    ? [{ start: method.start, end: method.end,
      text: garageProgressionFlowOverrides.get(method.key.name), name: method.key.name }]
    : []);
assert(progressionFlowEdits.length === garageProgressionFlowOverrides.size,
  "Garage progression flow method changed in the release source.");
const cosmeticInventoryEdits = garageViewClass.body.body.flatMap(method =>
  method.type === "ClassMethod" && method.key.type === "Identifier" &&
    garageCosmeticInventoryOverrides.has(method.key.name)
    ? [{ start: method.start, end: method.end,
      text: garageCosmeticInventoryOverrides.get(method.key.name), name: method.key.name }]
    : []);
assert(cosmeticInventoryEdits.length === garageCosmeticInventoryOverrides.size &&
  new Set(cosmeticInventoryEdits.map(edit => edit.name)).size === garageCosmeticInventoryOverrides.size,
  "Garage cosmetic inventory methods changed in the release source.");
const performanceEdits = garageViewClass.body.body.flatMap(method =>
  method.type === "ClassMethod" && method.key.type === "Identifier" &&
    garagePerformanceOverrides.has(method.key.name)
    ? [{ start: method.start, end: method.end,
      text: garagePerformanceOverrides.get(method.key.name), name: method.key.name }]
    : []);
assert(performanceEdits.length === garagePerformanceOverrides.size &&
  new Set(performanceEdits.map(edit => edit.name)).size === garagePerformanceOverrides.size,
  "Garage performance methods changed in the release source.");
const lifecycleEdits = garageViewClass.body.body.flatMap(method =>
  method.type === "ClassMethod" && method.key.type === "Identifier" &&
    garageLifecycleOverrides.has(method.key.name)
    ? [{ start: method.start, end: method.end,
      text: garageLifecycleOverrides.get(method.key.name), name: method.key.name }]
    : []);
assert(lifecycleEdits.length === garageLifecycleOverrides.size &&
  new Set(lifecycleEdits.map(edit => edit.name)).size === garageLifecycleOverrides.size,
  "Garage lifecycle methods changed in the release source.");
const equippedCosmeticsEdits = garageViewClass.body.body.flatMap(method =>
  method.type === "ClassMethod" && method.key.type === "Identifier" &&
    garageEquippedCosmeticsOverrides.has(method.key.name)
    ? [{ start: method.start, end: method.end,
      text: garageEquippedCosmeticsOverrides.get(method.key.name), name: method.key.name }]
    : []);
assert(equippedCosmeticsEdits.length === garageEquippedCosmeticsOverrides.size,
  "Garage equipped cosmetic method changed in the release source.");
const vehicleInformationEdits = garageViewClass.body.body.flatMap(method =>
  method.type === "ClassMethod" && method.key.type === "Identifier" &&
    garageVehicleInformationOverrides.has(method.key.name)
    ? [{ start: method.start, end: method.end,
      text: garageVehicleInformationOverrides.get(method.key.name), name: method.key.name }]
    : []);
assert(vehicleInformationEdits.length === garageVehicleInformationOverrides.size &&
  new Set(vehicleInformationEdits.map(edit => edit.name)).size === garageVehicleInformationOverrides.size,
  "Garage vehicle information methods changed in the release source.");
const pageVisibilityEdits = garageViewClass.body.body.flatMap(method =>
  method.type === "ClassMethod" && method.key.type === "Identifier" &&
    garagePageVisibilityOverrides.has(method.key.name)
    ? [{ start: method.start, end: method.end,
      text: garagePageVisibilityOverrides.get(method.key.name), name: method.key.name }]
    : []);
assert(pageVisibilityEdits.length === garagePageVisibilityOverrides.size,
  "Garage page visibility method changed in the release source.");
const controlsEdits = garageViewClass.body.body.flatMap(method =>
  method.type === "ClassMethod" && method.key.type === "Identifier" &&
    garageControlsOverrides.has(method.key.name)
    ? [{ start: method.start, end: method.end,
      text: garageControlsOverrides.get(method.key.name), name: method.key.name }]
    : []);
assert(controlsEdits.length === garageControlsOverrides.size,
  "Garage controls method changed in the release source.");
function garageClassMethodEdits(overrides, label) {
  const edits = garageViewClass.body.body.flatMap(method =>
    method.type === "ClassMethod" && method.key.type === "Identifier" &&
      overrides.has(method.key.name)
      ? [{ start: method.start, end: method.end,
        text: overrides.get(method.key.name), name: method.key.name }]
      : []);
  assert(edits.length === overrides.size &&
    new Set(edits.map(edit => edit.name)).size === overrides.size,
    `${label} changed in the release source.`);
  return edits;
}
const viewControlsEdits = garageClassMethodEdits(garageViewControlsOverrides,
  "Garage view control methods");
const partModelsEdits = garageClassMethodEdits(garagePartModelsOverrides,
  "Garage part model methods");
const buildControlsEdits = garageClassMethodEdits(garageBuildControlsOverrides,
  "Garage build controls method");
function garageClassMemberEdits(overrides, label) {
  const edits = garageViewClass.body.body.flatMap(member =>
    (member.type === "ClassMethod" || member.type === "ClassProperty") &&
      member.key.type === "Identifier" && overrides.has(member.key.name)
      ? [{ start: member.start, end: member.end,
        text: overrides.get(member.key.name), name: member.key.name }]
      : []);
  assert(edits.length === overrides.size &&
    new Set(edits.map(edit => edit.name)).size === overrides.size,
    `${label} changed in the release source.`);
  return edits;
}
const viewConstructionEdits = garageClassMemberEdits(garageViewConstructionOverrides,
  "Garage view construction");
const viewActionsEdits = garageClassMemberEdits(garageViewActionsOverrides,
  "Garage view actions");
const viewFieldActionsEdits = garageClassMemberEdits(garageViewFieldActionsOverrides,
  "Garage view field actions");
const frameCanvasEdits = garageClassMemberEdits(garageFrameCanvasOverrides,
  "Garage frame canvas methods");
const strengtheningOverlayEdits = garageClassMemberEdits(garageStrengtheningOverlayOverrides,
  "Garage strengthening overlay");
const frameRenderEdits = garageClassMemberEdits(garageFrameRenderOverrides,
  "Garage frame render loop");
const previewInputEdits = garageClassMemberEdits(garagePreviewInputOverrides,
  "Garage preview input controls");
const transformPreviewEdits = garageViewClass.body.body.flatMap(method =>
  method.type === "ClassMethod" && method.key.type === "Identifier" &&
    garageTransformPreviewOverrides.has(method.key.name)
    ? [{ start: method.start, end: method.end,
      text: garageTransformPreviewOverrides.get(method.key.name), name: method.key.name }]
    : []);
assert(transformPreviewEdits.length === garageTransformPreviewOverrides.size &&
  new Set(transformPreviewEdits.map(edit => edit.name)).size === garageTransformPreviewOverrides.size,
  "Garage transform preview methods changed in the release source.");
const factoryPanelClass = garageAst.program.body.find(node =>
  node.type === "ClassDeclaration" && node.id?.name === "Pa");
assert(factoryPanelClass, "Garage Factory panel class changed in the release source.");
const factoryPickerEdits = factoryPanelClass.body.body.flatMap(method =>
  method.type === "ClassMethod" && method.key.type === "Identifier" &&
    garageFactoryPickerOverrides.has(method.key.name)
    ? [{ start: method.start, end: method.end,
      text: garageFactoryPickerOverrides.get(method.key.name), name: method.key.name }]
    : []);
assert(factoryPickerEdits.length === garageFactoryPickerOverrides.size &&
  new Set(factoryPickerEdits.map(edit => edit.name)).size === garageFactoryPickerOverrides.size,
  "Garage Factory picker methods changed in the release source.");
const factoryPanelEdits = factoryPanelClass.body.body.flatMap(method =>
  method.type === "ClassMethod" && method.key.type === "Identifier" &&
    garageFactoryPanelOverrides.has(method.key.name)
    ? [{ start: method.start, end: method.end,
      text: garageFactoryPanelOverrides.get(method.key.name), name: method.key.name }]
    : []);
assert(factoryPanelEdits.length === garageFactoryPanelOverrides.size,
  "Garage Factory panel refresh changed in the release source.");
const factoryViewEdits = factoryPanelClass.body.body.flatMap(method =>
  method.type === "ClassMethod" && method.key.type === "Identifier" &&
    garageFactoryViewOverrides.has(method.key.name)
    ? [{ start: method.start, end: method.end,
      text: garageFactoryViewOverrides.get(method.key.name), name: method.key.name }]
    : []);
assert(factoryViewEdits.length === garageFactoryViewOverrides.size &&
  new Set(factoryViewEdits.map(edit => edit.name)).size === garageFactoryViewOverrides.size,
  "Garage Factory view methods changed in the release source.");
const factoryCanvasEdits = factoryPanelClass.body.body.flatMap(method =>
  method.type === "ClassMethod" && method.key.type === "Identifier" &&
    garageFactoryCanvasOverrides.has(method.key.name)
    ? [{ start: method.start, end: method.end,
      text: garageFactoryCanvasOverrides.get(method.key.name), name: method.key.name }]
    : []);
assert(factoryCanvasEdits.length === garageFactoryCanvasOverrides.size &&
  new Set(factoryCanvasEdits.map(edit => edit.name)).size === garageFactoryCanvasOverrides.size,
  "Garage Factory canvas methods changed in the release source.");
const retiredFactorySessionNodes = garageAst.program.body.filter(node =>
  node.type === "ClassDeclaration" && node.id?.name === "$a" ||
  node.type === "FunctionDeclaration" && node.id?.name === "Sa" ||
  node.type === "VariableDeclaration" && node.declarations.length === 1 &&
    node.declarations[0].id.type === "Identifier" && node.declarations[0].id.name === "Qt");
assert(retiredFactorySessionNodes.length === 3,
  "Garage Factory session and private record helpers changed in the release source.");
const retiredFactorySessionEdits = retiredFactorySessionNodes.map(node =>
  ({ start: node.start, end: node.end, text: "" }));
let redirected = garage;
for (const edit of [...garageEdits, ...garageRuntimeClassEdits,
  ...garageTopLevelBusinessEdits,
  ...garageScoreBusinessEdits,
  ...garageAssetLoaderEdits,
  ...garageUpgradeFlowLoaderEdits,
  ...garageSupportBusinessEdits,
  ...garageExtendedBusinessEdits,
  ...garageNativeCatalogEdits,
  ...garageRemainingPrimitiveEdits,
  ...garageRemainingCatalogEdits,
  ...garageUpgradeSessionClassEdits, ...garageUpgradeResultEdits,
  ...garagePointEffectHelperEdits, ...garagePreparationHelperEdits,
  ...garageControlCanvasHelperEdits,
  ...garagePreparationDialogEdits, ...progressionHelperEdits, ...factoryLayoutEdits,
  ...progressionEdits, ...equipmentEdits,
  ...catalogNavigationEdits, ...factoryScoringEdits, ...cosmeticEquipmentEdits,
  ...cardCatalogEdits, ...stateCommitEdits, ...factoryCommitEdits, ...upgradeDialogEdits,
  ...progressionFlowEdits, ...cosmeticInventoryEdits, ...performanceEdits,
  ...lifecycleEdits, ...equippedCosmeticsEdits, ...vehicleInformationEdits,
  ...pageVisibilityEdits, ...controlsEdits, ...viewControlsEdits,
  ...partModelsEdits, ...buildControlsEdits, ...viewConstructionEdits,
  ...viewActionsEdits, ...viewFieldActionsEdits,
  ...frameCanvasEdits, ...strengtheningOverlayEdits,
  ...frameRenderEdits, ...previewInputEdits, ...transformPreviewEdits,
  ...factoryPickerEdits, ...factoryPanelEdits, ...factoryViewEdits, ...factoryCanvasEdits,
  ...retiredFactorySessionEdits].sort((left, right) => right.start - left.start)) {
  redirected = redirected.slice(0, edit.start) + edit.text + redirected.slice(edit.end);
}
redirected = redirected.replace(oldImport, 'from "./app.js";');
redirected = 'import { collectGarageParts, parseLegacyGarageParts, resolveEquippedGaragePart, sameGaragePart, sortGarageParts } from "../ui/garage-parts-business.ts";\n'
  + 'import { createGaragePartCamera, garagePartModelDuration, loadGaragePartModelScene } from "../ui/garage-part-model-scene.ts";\n'
  + 'import { calculateGarageRadar, drawGarageRadar, garageRadarPoint } from "../ui/garage-radar-chart.ts";\n'
  + 'import { loadGarageRadarParameters, parseGarageRadarInput, parseGarageRadarWeights } from "../ui/garage-radar-data.ts";\n'
  + 'import { parseGarageExceedChangeRules, parseGarageExceedTypes, parseGarageTuneAbilities } from "../ui/garage-upgrade-metadata.ts";\n'
  + 'import { calculateGarageVehicleScores } from "../ui/garage-score-calculation.ts";\n'
  + 'import { parseGaragePartGradeGrid, parseGarageSkillScoreTable } from "../ui/garage-score-data.ts";\n'
  + 'import { applyGarageLegacyParts, combineGarageXunScores, garageGradeContains, garageScoreInteger, garageXunSkillBonus, inverseGaragePartScore, projectGarageScoreField, roundGarageScore, scoreGarageBody } from "../ui/garage-score-arithmetic.ts";\n'
  + 'import { createGarageCancelPreviewButton, createGarageInventoryScroll, createGarageRemovePartButton } from "../ui/garage-view-field-actions.ts";\n'
  + 'import { loadGarageAssetBundle } from "../ui/garage-asset-bundle.ts";\n'
  + 'import { loadGarageUpgradeAssets } from "../ui/garage-upgrade-assets.ts";\n'
  + 'import { loadGarageSkillAssets } from "../ui/garage-skill-assets.ts";\n'
  + 'import { loadGaragePreparationAssets } from "../ui/garage-upgrade-preparation-assets.ts";\n'
  + 'import { showGarageUpgradeTutorial } from "../ui/garage-upgrade-tutorial.ts";\n'
  + 'import { loadGarageXunUpgradePanels } from "../ui/garage-xun-upgrade-panels.ts";\n'
  + 'import { loadGarageClassicUpgradeResult } from "../ui/garage-classic-upgrade-result.ts";\n'
  + 'import { loadGarageScoreSource, parseGarageFactoryAbilityScores, parseGarageWeightTable, parseGarageXunPartValues } from "../ui/garage-score-resources.ts";\n'
  + 'import { garagePartDisplayName, garagePartOrdinal, garageXunPartOrdinal, parseGarageEnchantSpecs } from "../ui/garage-part-presentation.ts";\n'
  + 'import { garagePartCardLayout, garagePreparationCardLayout } from "../ui/garage-card-layouts.ts";\n'
  + 'import { bindGarageHoverPreview, loadGarageDefaultPreviews, planGarageDrawOrder } from "../ui/garage-view-support.ts";\n'
  + 'import { applyGarageFactoryScores, garageScoreGrade, garageScoreTrend, loadGarageFactoryScores, loadGarageSkillScores, normalizeGarageBodyScore } from "../ui/garage-score-application.ts";\n'
  + 'import { garageAssetsForWidth, garageDialogAssets, garageUpgradeAssetsForMode } from "../ui/garage-asset-cache.ts";\n'
  + 'import { garageKartCardsRect, garagePartsGridRect, garagePartIconKey, isGarageMaxXunPart, garagePageOverlayNames, styleGarageActionButton, garagePointerPresence, garageXunUpgradeRows } from "../ui/garage-ui-support.ts";\n'
  + 'import { garagePair, garageArrowColor, garageNumericTuple, garageUpgradeAnimationPhase, garageKartCardRect, garageInsetRect, garageSecondInsetRect, garageBetweenRects, garageExtendRect } from "../ui/garage-native-layout.ts";\n'
  + 'import { garageLayoutForEngineGrade, garageProgressionKind, previewGaragePart, garageText, garageEngineName, garageGradeName, garagePartQuality, garagePartCardBackground, garageKartTypeTexture, garagePageBackground, garageShowsVehicleInformation, garageAllowsEquipment, garagePreviewHitTest } from "../ui/garage-vehicle-presentation.ts";\n'
  + 'import { garageRadarFinite, garageRadarAttribute, garageRadarBaseline, garageExceedChoice, garageSkillScoreInteger, garageFiniteScore, garageScoreNumber } from "../ui/garage-native-values.ts";\n'
  + 'import { garagePartCategoryIds, garagePartSlotsByCategory, garageTuneNodesByCategory, garageTuneCategoriesByNode, garageDrivingMode, garageEnchantScoreFields, garageVehicleFunctions, garageFunctionTextures, garageLayoutProfiles, garageSkillTextures, garageExceedTextures, garageSkillDirectory, garageSkillPickerImages, garageFactoryAbilityAttributes, zeroGarageFactoryAbility, garageScoreFieldBySlot, garageScorePartCategories, garageScoreXmlAttributes, garageScoreDisplayRows } from "../ui/garage-native-catalog.ts";\n'
  + 'import { garageGameTypeAllowed, garagePartCategoryId, garageStageLayout, garageAvailableVehicleFunctions, garagePartCardLayoutForKind, garageNativeStatePath, garageExpectedProgressionKind, garagePartPresentation, garageFactoryAbilityDraft, garageFactorySignature, garageClassicUpgradeLines, garageNeedsLoadingLabel, garageShowMaxPart } from "../ui/garage-remaining-primitives.ts";\n'
  + 'import { garageDefaultWidth, garageStageSizes, garageStageDirectory, garageLampTexture, garageFontPath, garageFontResource, garageFontFamily, garageDefaultPartFields, garageNativeRarityValues, garageRadarAttributes, garageRadarDescriptionKeys, garageRadarCaptions, garageRadarSkillFields, garageExceedChoices, garageSidePanelInset, garageSidePanelInnerInset, garageResetPrompt, garageClassicUpgradeDirectory, garageXunUpgradeDirectory, garageXunUpgradeStages, garageXunUpgradeStageLabels, garageSkillPanelPath, garagePreparationDirectory, garagePreparationCardDirectory, garagePreparationImages, garageSkillDialogRect, garageXunSkillAttributes, zeroGarageXunSkillScore, garageScoreFields, garageScoreWeightLengths, garageXunPartScoreFields, garageGradeKeys, garagePartSlotKeys, garageGradeFallbacks, garageCardPageSize, garageRemovePartRect, garageTuneSlotNodes } from "../ui/garage-native-remaining-constants.ts";\n'
  + 'import { GarageControlCanvas } from "../ui/garage-control-canvas.ts";\n'
  + 'import { garageControlZIndex, garageObjectFitRect } from "../ui/garage-control-canvas-lifecycle.ts";\n'
  + 'import { intersectGarageRect } from "../ui/garage-control-canvas-rebuild.ts";\n'
  + 'import { garageCssLength, paintGarageControlBox, paintGarageControlCharacter, splitGarageCssLayers } from "../ui/garage-control-canvas-paint.ts";\n'
  + 'import { GarageModelCache } from "../ui/garage-model-cache.ts";\n'
  + 'import { GarageInventoryScroll } from "../ui/garage-inventory-scroll.ts";\n'
  + 'import { compareGarageSkillEffects, garageSkillEffectRect, GaragePointEffects } from "../ui/garage-point-effects.ts";\n'
  + 'import { GarageSkillSelectionState, GarageUpgradePreparationState } from "../ui/garage-progression-session.ts";\n'
  + 'import { GarageSkillSelectionDialog } from "../ui/garage-skill-dialog.ts";\n'
  + 'import { GarageExceedTypeDialog } from "../ui/garage-exceed-dialog.ts";\n'
  + 'import { clearPreparationPageFrames, closeGaragePreparation, disposeGaragePreparation, preparationCards, preparationPreviewCard, preparationPreviewRect, resizePreparationCanvases, selectedPreparationVehicle } from "../ui/garage-upgrade-preparation-state.ts";\n'
  + 'import { compareGarageUpgradeLevels, drawGaragePreparation, drawPreparationCards, fillPreparationMethodPanel, preparationMethodPanelRect } from "../ui/garage-upgrade-preparation-render.ts";\n'
  + 'import { addPreparationCancelButton, addPreparationComparisonValue, addPreparationLabel, createPreparationButton, decoratePreparationPageArrow, placePreparationControl } from "../ui/garage-upgrade-preparation-controls.ts";\n'
  + 'import { loadGaragePreparation } from "../ui/garage-upgrade-preparation-loading.ts";\n'
  + 'import { refreshGaragePreparation } from "../ui/garage-upgrade-preparation-refresh.ts";\n'
  + 'import { initializeGaragePreparation } from "../ui/garage-upgrade-preparation-construction.ts";\n'
  + 'import { initializeGarageUpgradeResult } from "../ui/garage-upgrade-result-construction.ts";\n'
  + 'import { captureGarageUpgradePreview, closeGarageUpgradeResult, disposeGarageUpgradeResult, renderGarageUpgradeResult } from "../ui/garage-upgrade-result-render.ts";\n'
  + 'import { disposeGarageProgressionPanel, resetGarageProgressionPanel, updateGarageProgressionRadar } from "../ui/garage-progression-radar.ts";\n'
  + 'import { appendGarageNativeColorText, garageExceedChangeAvailability, updateGarageProgressionPanel } from "../ui/garage-progression-panel.ts";\n'
  + 'import { addGarageProgressionButton, addGarageProgressionLabel, addGarageProgressionNativeLabel, addGarageProgressionTexture, garageProgressionRect, placeGarageProgressionElement, styleGarageProgressionFromNode } from "../ui/garage-progression-elements.ts";\n'
  + 'import { drawGarageProgressionView, garageProgressionPreviewRect, initializeGarageProgressionView } from "../ui/garage-progression-view.ts";\n'
  + 'import { equipGaragePart, requestGaragePartEquip, requireGarageCustomization, selectGaragePartSlot, setGaragePartPreview } from "../ui/garage-equipment-actions.ts";\n'
  + 'import { canSetGarageProgression, filteredGarageKarts, garageFactoryAllowed, selectGarageKart, selectGaragePage } from "../ui/garage-catalog-navigation.ts";\n'
  + 'import { canonicalGarageFactoryVehicle, garageFactoryVehicleKey, garageKartSerialFor, updateGarageFactoryScores } from "../ui/garage-factory-scoring.ts";\n'
  + 'import { equipGarageCoating, equipGarageCosmetic, requestGarageCoating, requestGarageCosmetic } from "../ui/garage-cosmetic-equipment.ts";\n'
  + 'import { updateGarageCards } from "../ui/garage-card-catalog.ts";\n'
  + 'import { publishGarageCurrentState, refreshGarageUpgradeState, requestGarageRestoreDefaults, setGarageProgression } from "../ui/garage-state-commit.ts";\n'
  + 'import { GarageFactorySession, setGarageFactory } from "../ui/garage-factory-commit.ts";\n'
  + 'import { requestGarageExceedTypeChange, requestGarageSkillSelection } from "../ui/garage-upgrade-dialog-actions.ts";\n'
  + 'import { requestGarageProgression } from "../ui/garage-progression-flow.ts";\n'
  + 'import { garageCosmeticIcon, syncGarageCosmeticPreviewActions, updateGarageCoatingInventory, updateGarageCosmeticInventory } from "../ui/garage-cosmetic-inventory.ts";\n'
  + 'import { renderGarageScoreRows, updateGaragePerformance } from "../ui/garage-performance.ts";\n'
  + 'import { disposeGarageView, freezeGarageView, loadGarageView, resizeGarageSurface, showGarageView, unfreezeGarageView } from "../ui/garage-lifecycle.ts";\n'
  + 'import { updateGarageCosmeticEquippedSlots } from "../ui/garage-equipped-cosmetics.ts";\n'
  + 'import { updateGarageVehicleFunctions, updateGarageVehicleHeading, updateGarageVehicleInformation } from "../ui/garage-vehicle-information.ts";\n'
  + 'import { updateGaragePageVisibility } from "../ui/garage-page-visibility.ts";\n'
  + 'import { updateGarageControls } from "../ui/garage-controls.ts";\n'
  + 'import { createGarageActionButton, createGarageIcon, createGarageNativeButton, garageViewRect, placeGarageControl, setGaragePartsOnlyNodesMounted, setGarageUpgradeStatusMounted, setGarageVehicleInfoNodesMounted, skinGarageActionButton } from "../ui/garage-view-controls.ts";\n'
  + 'import { addGaragePartModelTarget, renderGaragePartModels, renderGaragePartVisual } from "../ui/garage-part-models.ts";\n'
  + 'import { buildGarageControls } from "../ui/garage-build-controls.ts";\n'
  + 'import { initializeGarageView } from "../ui/garage-view-construction.ts";\n'
  + 'import { garageBaseForKart, garageBaseSpecification, garagePartLabel, garageSelectedKartSerial, garageSpeedVersion, handleGarageEscapeKey, rehitGarageInventoryPreview, showGarageFactoryTutorial } from "../ui/garage-view-actions.ts";\n'
  + 'import { captureGarageStage, captureGarageStrengtheningStage, drawGarageKartCatalogFrame, drawGarageKartLevelBadge, finishGarageCanvasFrame, garageAuthoredPointerY, paintGarageTaskbar } from "../ui/garage-frame-canvas.ts";\n'
  + 'import { renderGarageStrengtheningOverlay } from "../ui/garage-strengthening-overlay.ts";\n'
  + 'import { renderGarageFrame } from "../ui/garage-frame-render.ts";\n'
  + 'import { createGarageTransformPreviewButton, endGaragePreviewDrag, moveGaragePreviewDrag, startGaragePreviewDrag } from "../ui/garage-preview-input.ts";\n'
  + 'import { activeGaragePreviewRect, finishGaragePreviewDrag, flushGarageTransformPreviewStart, isGarageTransformPreviewSessionActive, moveToGarageTransformPreviewRoot, placeInGarageTransformPreviewRoot, startGarageTransformPreview, syncGarageTransformPreviewUi } from "../ui/garage-transform-preview.ts";\n'
  + 'import { commitGarageFactoryChoice, createGarageFactoryChoiceButton, renderGarageFactoryAbilityPicker, updateGarageFactoryDraftSlot } from "../ui/garage-factory-picker.ts";\n'
  + 'import { updateGarageFactoryPanel } from "../ui/garage-factory-panel.ts";\n'
  + 'import { addGarageFactoryLabel, garageFactoryCatalogLayout, garageFactoryPreviewRect, garageFactoryShowsCatalog, initializeGarageFactoryView, placeGarageFactoryElement, updateGarageFactoryScoreLabel } from "../ui/garage-factory-view.ts";\n'
  + 'import { drawGarageFactoryBackground, drawGarageFactoryCatalogFrame, resizeGarageFactoryCanvases, styleGarageFactoryActionFrame } from "../ui/garage-factory-canvas.ts";\n'
  + 'const garageProgressionRadarDependencies = { createStatus: () => document.createElement("div"), loadParameters: da, applyChanges: ha, makeRadar: la };\n'
  + 'const garageProgressionPanelDependencies = { nextLevel: Vs, remainingPoints: we, changePoint: ze, initialProgression: ce, get skills() { return fs; } };\n'
  + 'const garageProgressionElementsDependencies = { attribute: y };\n'
  + 'const garageProgressionDrawDependencies = { attribute: y, drawFrame: (context, frame, image, rect) => be(context, frame, image, rect), drawRadar: (context, rect, radar) => ga(context, rect, radar) };\n'
  + 'const garageEquipmentDependencies = { canCustomize: ae, slotLocked: fe, currentConfiguration: K, validateConfiguration: te, writeConfiguration: ie, partFamily: me, slotLabel: le };\n'
  + 'const garageCatalogDependencies = { canCustomize: ae, progressionLayout: pe, blockedKart: Re, validateKart: Ft, factoryAllowed: ui, progressionKind: Ue, progressionMismatchMessage: oi };\n'
  + 'const garageFactoryScoringDependencies = { currentConfiguration: K, scoreFamily: vt, loadScoreSource: cs, calculateScores: Me };\n'
  + 'const garageCosmeticDependencies = { currentConfiguration: K, vehicleFamily: rt, validateConfiguration: te, writeConfiguration: ie, loadVehicle: hi, cosmeticParameters: gi, validateCosmeticResources: di };\n'
  + 'const garageCardDependencies = { get standardPageSize() { return kn; }, hoverState: xa, standardCardRect: Gi };\n'
  + 'const garageStateCommitDependencies = { currentConfiguration: K, writeConfiguration: ie, validateConfiguration: te, composeEquipment: ot, normalizeEquipment: pi, progressionLayout: ue, progressionKind: pe, supportsProgression: Ue, expectedProgressionKind: Ut, initialProgression: ce };\n'
  + 'const garageFactoryCommitDependencies = { currentConfiguration: K, validateConfiguration: te, writeConfiguration: ie, createSession: (records, send) => new GarageFactorySession(records, send) };\n'
  + 'const garageUpgradeDialogDependencies = { currentConfiguration: K, initialProgression: ce, gradeFamily: Ue, exceedChangeAvailability: $s, validateConfiguration: te, writeConfiguration: ie, openSkillSelection: (...args) => new Da(...args), openExceedTypeChange: (...args) => new Tn(...args) };\n'
  + 'const garageProgressionFlowDependencies = { currentConfiguration: K, initialProgression: ce, blockedKart: Re, transition: ri, openPreparation: (...args) => new Ja(...args), openResult: (...args) => new Ra(...args) };\n'
  + 'const garageCosmeticInventoryDependencies = { currentConfiguration: K, vehicleFamily: rt, choicesForSlot: ci, slotLocked: li, canEquip: mt, get cardBackgroundKey() { return Ze; } };\n'
  + 'const garagePerformanceDependencies = { currentConfiguration: K, applyConfiguration: te, applySpeedVersion: Gt, previewPartConfiguration: Xi, vehicleFamily: me, scoreFamily: vt, loadScoreSource: cs, calculateScores: Me, fallbackScoreGrade: ys, scoreGradeForValue: dn, performanceLayout: ue, textureToken: y };\n'
  + 'const garageLifecycleLoadDependencies = { get defaultStageWidth() { return Ai; }, normalizeStage: width => _t(width), loadAssets: (library, width) => zi(library, width), loadPreviews: options => Fn(options), loadLayout: (library, name, width) => Wt(library, name, width), createView: (options, assets, tuning, previews) => new As(options, assets, tuning, previews), createFactoryPanel: (...args) => new Pa(...args), loadConfirmation: (...args) => ti.load(...args), loadPanels: (...args) => si.load(...args), previewSize: (width, height) => ii(width, height) };\n'
  + 'const garageLifecycleDependencies = { window, cancelAnimationFrame: frame => cancelAnimationFrame(frame) };\n'
  + 'const garageViewportDependencies = { pixelRatio: () => Ee(), sizeCanvas: (...args) => Pe(...args) };\n'
  + 'const garageEquippedCosmeticsDependencies = { defaultLampIcon: ni };\n'
  + 'const garageVehicleInformationDependencies = { vehicleFamily: me, resolvePart: Xe, slotLocked: fe, xunPartLevel: Ns, partPresentation: Wi, slotLabel: le, uniqueLevel: Et, isMaxLevel: En, sceneAttribute: y, get slotNodeNames() { return wt; }, vehicleFunctions: Fi };\n'
  + 'const garagePageVisibilityDependencies = { canCustomize: ae, showVehicleInformation: ds, defaultCardRect: assets => bt(assets) };\n'
  + 'const garageControlsDependencies = { showVehicleInformation: ds, progressionFamily: pe, canCustomize: ae, blockedKart: Re, progressionSupport: Ue, expectedProgressionKind: Ut, currentEquipment: K, vehicleFamily: me, layoutForGrade: ue, initialProgression: ce, slots: de, get slotNodes() { return wt; }, slotLabel: le, partsForSlot: qi, cardLayout: xt, inventoryRect: Dt, quality: Et, cardTexture: Sn, samePart: Kt, equippedPart: Xe, slotLocked: fe, canEquip: mt, bindPreview: Mn };\n'
  + 'const garageFactoryPickerDependencies = { get abilities() { return Mt; }, draftFrom: value => ht(value), signature: value => Zt(value), validate: value => Tt(value), abilityId: (group, level) => Hs(group, level), stylePrimary: button => he(button, undefined, "primary"), nodeAttribute: (node, name) => y(node, name), nativeStatePath: (base, state) => se(base, state) };\n'
  + 'const garageFactoryPanelDependencies = { defaultConfiguration: () => nt(), signature: value => Zt(value), draftFrom: value => ht(value), get abilityDescriptions() { return ms; }, attribute: (node, name) => y(node, name), nativeStatePath: (base, state) => se(base, state), childRect: (node, rect) => Y(node, rect) };\n'
  + 'const garageFactoryViewDependencies = { attribute: (node, name) => y(node, name), childRect: (node, rect) => Y(node, rect) };\n'
  + 'const garageFactoryCanvasDependencies = { attribute: (node, name) => y(node, name), pixelRatio: () => Ee(), sizeCanvas: (...args) => Pe(...args), drawFrame: (...args) => be(...args) };\n'
  + 'const garageViewActionDependencies = { get defaultVersion() { return vs; }, previewKey: kart => bs(kart), createPreview: (...args) => xs(...args), partLabel: (...args) => $n(...args), hitTest: (...args) => Rn(...args), loadFactoryTutorial: (...args) => Ea(...args), cancelFrame: id => cancelAnimationFrame(id), requestFrame: callback => requestAnimationFrame(callback), elementFromPoint: (x, y) => document.elementFromPoint(x, y) };\n'
  + 'const garageFrameCanvasDependencies = { currentConfiguration: (...args) => K(...args), progressionKind: grade => fi(grade), badgeTexture: (grade, level) => mi(grade, level), levelLabel: level => vi(level), drawLabel: (...args) => wi(...args) };\n'
  + 'const garageStrengtheningOverlayDependencies = { composeEquipment: (...args) => ot(...args), currentConfiguration: (...args) => K(...args), writeConfiguration: (...args) => ie(...args) };\n'
  + 'const garageFrameRenderDependencies = { requestFrame: callback => requestAnimationFrame(callback), now: () => performance.now(), layoutForGrade: grade => ue(grade), backgroundForPage: (page, layout) => Nn(page, layout), nativePageName: (page, xun) => Ln(page, xun), nativeFramePlan: (definition, name) => An(definition, name), attribute: (node, name) => y(node, name), kartTypeTexture: kind => In(kind), drawScrollbar: (...args) => yi(...args), composeEquipment: (...args) => ot(...args), currentConfiguration: (...args) => K(...args), writeConfiguration: (...args) => ie(...args) };\n'
  + 'const garagePreviewInputDependencies = { attribute: (node, name) => y(node, name) };\n'
  + 'const garageSkillSelectionDependencies = { validate: progression => kt(progression), select: (progression, slot, skillId) => Xs(progression, slot, skillId), availablePoints: progression => we(progression) };\n'
  + 'const garageUpgradePreparationDependencies = { blockedKart: itemId => Re(itemId), validate: progression => kt(progression), nextLevel: (progression, method) => Ys(progression, method) };\n'
  + 'const garageSkillDialogDependencies = { createState: (progression, row) => new qa(progression, row), loadAssets: library => Ts(library), styleAction: (button, style, kind) => he(button, style, kind), availablePoints: progression => we(progression), get skills() { return fs; } };\n'
  + 'const garageExceedDialogDependencies = { styleAction: (button, style, kind) => he(button, style, kind), loadStyles: library => Ts(library), resolveChoice: choice => ua(choice) };\n'
  + 'const garagePreparationRenderDependencies = { fitCanvas: (...args) => Pe(...args), pixelRatio: () => Ee(), drawFrame: (...args) => be(...args) };\n'
  + 'const garagePreparationConstructionDependencies = { createState: (candidates, selectedItemId) => new Qa(candidates, selectedItemId) };\n'
  + 'const garageControlCanvasDependencies = { intersect: (left, right) => intersectGarageRect(left, right), paintBox: (context, style, rect, image) => paintGarageControlBox(context, style, rect, image), paintCharacter: (context, style, character, rect) => paintGarageControlCharacter(context, style, character, rect) };\n'
  + 'const garageUpgradeConstructionDependencies = { stylePrimary: button => he(button, undefined, "primary"), loadXun: (...args) => Ma(...args), loadClassic: (...args) => ka(...args) };\n'
  + 'const garageUpgradeRenderDependencies = { sizeCanvas: (...args) => Pe(...args), pixelRatio: () => Ee(), phase: (...args) => Aa(...args), get phaseLabels() { return Ia; } };\n'
  + 'const garageScoreResourceDependencies = () => ({ attribute: L, scoreFields: Se, weightLengths: Lt, partScoreFields: Is, parseNumber: re, projectPartScore: _s, scoreInteger: Nt, abilityDescriptions: ms, abilityFields: tt, zeroAbilityScore: ks });\n'
  + 'const garagePartPresentationDependencies = () => ({ slotLabel: le, localize: Ge, slotKey: xn, engineName: pt, gradeName: ft, defaultParts: gs });\n'
  + 'const garageCardLayoutDependencies = () => ({ attribute: y, pair: Qe, numbers: gt });\n'
  + 'const garageScoreApplicationDependencies = () => ({ parseXml: Z, attribute: L, parseNumber: re, fields: Se, abilityFields: tt, zeroAbilityScore: ks, validateFactory: Tt, parseSkills: tn, parseFactory: nn });\n'
  + redirected;
assert(!redirected.includes(oldImport), "Garage chunk redirect failed.");
const garageOutput = "GarageXView-DSeU5AUN.js";
await writeIfChanged(garageOutput, redirected);

const vehicleDataInputs = await Promise.all([
  "vehicle-physics-h10.csv",
  "vehicle-physics-d10.csv",
  "vehicle-physics-overrides.json",
  "vehicle-physics-aliases.json",
].map(async file => {
  const content = await readFile(path.join(projectDir, "src/physics/data", file));
  return { file: `../physics/data/${file}`, bytes: content.length, sha256: sha256(content) };
}));

const manifest = {
  source: "../../../recovered/formatted/index.js",
  sourceSha256: expectedSourceHash,
  garageSource: "../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js",
  garageSourceSha256: sha256(garage),
  garageExportCount: garageAliases.length,
  handwrittenGaragePartOverrides: [...garagePartOverrides.keys()],
  handwrittenGarageTopLevelBusinessOverrides: [...garageTopLevelBusinessOverrides.keys()],
  handwrittenGarageScoreBusinessOverrides: [...garageScoreBusinessOverrides.keys()],
  handwrittenGarageAssetLoaderOverrides: [...garageAssetLoaderOverrides.keys()],
  handwrittenGarageUpgradeFlowLoaderOverrides: [...garageUpgradeFlowLoaderOverrides.keys()],
  handwrittenGarageSupportBusinessOverrides: [...garageSupportBusinessOverrides.keys()],
  handwrittenGarageExtendedBusinessOverrides: [...garageExtendedBusinessOverrides.keys()],
  handwrittenGarageNativeCatalogOverrides: [...garageNativeCatalogOverrides.keys()],
  handwrittenGarageRemainingPrimitiveOverrides: [...garageRemainingPrimitiveOverrides.keys()],
  handwrittenGarageRemainingCatalogOverrides: [...garageRemainingCatalogOverrides.keys()],
  handwrittenGarageRuntimeClassOverrides: [...garageRuntimeClassOverrides.keys()],
  handwrittenGarageUpgradeSessionClassOverrides: [...garageUpgradeSessionClassOverrides.keys()],
  handwrittenGarageUpgradeResultOverrides: [...garageUpgradeResultOverrides.keys()],
  handwrittenGaragePointEffectHelperOverrides: [...garagePointEffectHelperOverrides.keys()],
  handwrittenGaragePreparationHelperOverrides: [...garagePreparationHelperOverrides.keys()],
  handwrittenGarageControlCanvasHelperOverrides: [...garageControlCanvasHelperOverrides.keys()],
  handwrittenGaragePreparationDialogOverrides: [...garagePreparationDialogOverrides.keys()],
  handwrittenGarageProgressionOverrides: [...garageProgressionOverrides.keys()],
  handwrittenGarageProgressionHelperOverrides: [...garageProgressionHelperOverrides.keys()],
  handwrittenGarageEquipmentOverrides: [...garageEquipmentOverrides.keys()],
  handwrittenGarageCatalogNavigationOverrides: [...garageCatalogNavigationOverrides.keys()],
  handwrittenGarageFactoryScoringOverrides: [...garageFactoryScoringOverrides.keys()],
  handwrittenGarageCosmeticEquipmentOverrides: [...garageCosmeticEquipmentOverrides.keys()],
  handwrittenGarageCardCatalogOverrides: [...garageCardCatalogOverrides.keys()],
  handwrittenGarageStateCommitOverrides: [...garageStateCommitOverrides.keys()],
  handwrittenGarageFactoryCommitOverrides: [...garageFactoryCommitOverrides.keys()],
  handwrittenGarageUpgradeDialogOverrides: [...garageUpgradeDialogOverrides.keys()],
  handwrittenGarageProgressionFlowOverrides: [...garageProgressionFlowOverrides.keys()],
  handwrittenGarageCosmeticInventoryOverrides: [...garageCosmeticInventoryOverrides.keys()],
  handwrittenGaragePerformanceOverrides: [...garagePerformanceOverrides.keys()],
  handwrittenGarageLifecycleOverrides: [...garageLifecycleOverrides.keys()],
  handwrittenGarageEquippedCosmeticsOverrides: [...garageEquippedCosmeticsOverrides.keys()],
  handwrittenGarageVehicleInformationOverrides: [...garageVehicleInformationOverrides.keys()],
  handwrittenGaragePageVisibilityOverrides: [...garagePageVisibilityOverrides.keys()],
  handwrittenGarageControlsOverrides: [...garageControlsOverrides.keys()],
  handwrittenGarageViewControlsOverrides: [...garageViewControlsOverrides.keys()],
  handwrittenGaragePartModelsOverrides: [...garagePartModelsOverrides.keys()],
  handwrittenGarageBuildControlsOverrides: [...garageBuildControlsOverrides.keys()],
  handwrittenGarageViewConstructionOverrides: [...garageViewConstructionOverrides.keys()],
  handwrittenGarageViewActionsOverrides: [...garageViewActionsOverrides.keys()],
  handwrittenGarageViewFieldActionsOverrides: [...garageViewFieldActionsOverrides.keys()],
  handwrittenGarageFrameCanvasOverrides: [...garageFrameCanvasOverrides.keys()],
  handwrittenGarageStrengtheningOverlayOverrides: [...garageStrengtheningOverlayOverrides.keys()],
  handwrittenGarageFrameRenderOverrides: [...garageFrameRenderOverrides.keys()],
  handwrittenGaragePreviewInputOverrides: [...garagePreviewInputOverrides.keys()],
  handwrittenGarageTransformPreviewOverrides: [...garageTransformPreviewOverrides.keys()],
  handwrittenGarageFactoryPickerOverrides: [...garageFactoryPickerOverrides.keys()],
  handwrittenGarageFactoryPanelOverrides: [...garageFactoryPanelOverrides.keys()],
  handwrittenGarageFactoryViewOverrides: [...garageFactoryViewOverrides.keys()],
  handwrittenGarageFactoryCanvasOverrides: [...garageFactoryCanvasOverrides.keys()],
  handwrittenGarageFactoryLayoutOverride: factoryLayoutEdits.length === 1,
  retiredGarageFactorySessionHelpers: ["Sa", "Qt", "$a"],
  noModuleCycles: true,
  sharedMathNames: [...sharedMathNames],
  handwrittenInputOverrides: [...inputOverrides],
  handwrittenResourceOverrides: [...resourceOverrides],
  handwrittenResourceLookupMethodOverrides: [...resourceLookupMethodOverrides.keys()],
  handwrittenTrackCatalogMethodOverrides: [...trackCatalogMethodOverrides.keys()],
  handwrittenVehicleIdentityMethodOverrides: [...vehicleIdentityMethodOverrides.keys()],
  handwrittenRemainingResourceMethodOverrides: [...remainingResourceMethodOverrides.keys()],
  handwrittenResourceLoaderMethodOverrides: ["load"],
  handwrittenGhostOverrides: [...ghostOverrides],
  handwrittenKsvOverrides: [...ksvOverrides],
  handwrittenGhostRuntimeClassOverrides: [...ghostRuntimeClassOverrides.keys()],
  handwrittenLobbyAvatarDeclarationOverrides: [...lobbyAvatarDeclarationOverrides.keys()],
  retiredGhostHelpers: [...retiredGhostHelpers],
  handwrittenPhysicsOverrides: [...physicsOverrides],
  handwrittenEmbeddedVehicleData: {
    exports: ["d10", "h10", "hn"],
    inputs: vehicleDataInputs,
  },
  handwrittenStageManagerOverride: replacedStageManager,
  handwrittenLifecycleOverrides: [...lifecycleOverrides],
  handwrittenReadyMethodOverrides: [...readyMethodOverrides.keys()],
  handwrittenRaceStartCoordinatorOverride: replacedRaceStartCoordinator,
  handwrittenSoloRacePublisherOverride: replacedSoloRacePublisher,
  handwrittenApplicationMethodOverrides: [...applicationMethodOverrides.keys()],
  handwrittenApplicationBootOverrides: [...appBootOverrides.keys()],
  handwrittenWorldPerformanceOverrides: [...worldPerformanceOverrides],
  handwrittenFormatRoadDescriptors: [...replacedFormatRoadDescriptors].sort(),
  handwrittenFormatRoadExtraction: [...replacedFormatRoadExtraction].sort(),
  handwrittenFormatObstacles: [...replacedFormatObstacles].sort(),
  handwrittenFormatTrackAdmission: [...replacedFormatTrackAdmission].sort(),
  handwrittenFormatKartIdentity: [...replacedFormatKartIdentity].sort(),
  handwrittenFormatFontLayout: [...replacedFormatFontLayout].sort(),
  retiredFormatFontHelpers: [...retiredFormatFont].sort(),
  handwrittenRendererWarmup: replacedRendererWarmup,
  retiredKartIdentityEmptySet,
  retiredTrackNameCompare,
  handwrittenDriftEffect: retiredDriftClusterDeclarations === 30 &&
    retiredDriftTextureSelector,
  retiredFormatDeclarations: [...retiredFormatDeclarations].sort(),
  handwrittenWorldHudOverrides: [...worldHudOverrides],
  handwrittenItemHudSlots: [...replacedItemHudSlots].sort(),
  retiredItemHudSlotHelpers: [...retiredItemHudSlots].sort(),
  handwrittenWorldLocalDirectoryOverrides: [...worldLocalDirectoryOverrides],
  handwrittenCanvasContextDiagnostics: replacedCanvasContextDiagnostics,
  handwrittenTouchLayoutEditor: replacedTouchLayoutEditor,
  handwrittenTouchDrivingControls: replacedTouchDrivingControls,
  handwrittenVehiclePreviewRenderer: replacedVehiclePreviewRenderer,
  handwrittenTimeAttackDialogs: [...replacedTimeAttackDialogs],
  handwrittenTimeAttackRaceViews: [...replacedTimeAttackRaceViews],
  handwrittenGhostVisualHelpers: [...replacedGhostVisualHelpers],
  retiredEmbeddedPakoBytes: embeddedPakoEnd - embeddedPakoStart,
  handwrittenKartPresentationViewOverride: replacedKartPresentationView,
  handwrittenDrivingCollisionOverrides: [...drivingCollisionOverrides.keys()],
  handwrittenApplicationAccessorOverrides: [...applicationMethodOverrides.keys()]
    .filter(name => name.startsWith("get:") || name.startsWith("set:")),
  handwrittenApplicationFieldOverrides: [...applicationFieldOverrides.keys()],
  handwrittenTimeAttackStageMethodOverrides: [...timeAttackStageMethodOverrides.keys()],
  handwrittenRecordServiceMethodOverrides: [...recordServiceMethodOverrides.keys()],
  handwrittenGhostRecordLibraryMethodOverrides: [...ghostRecordLibraryMethodOverrides.keys()],
  handwrittenGhostAssetBuilderMethodOverrides: [...ghostAssetBuilderMethodOverrides.keys()],
  handwrittenGhostMenuImportMethodOverrides: [...ghostMenuImportMethodOverrides.keys()],
  handwrittenGhostMenuBridgeMethodOverrides: [...ghostMenuBridgeMethodOverrides.keys()],
  handwrittenGhostVisualMotionMethodOverrides: [...ghostVisualMotionMethodOverrides.keys()],
  handwrittenRaceBgmPlaybackMethodOverrides: [...raceBgmPlaybackMethodOverrides.keys()],
  handwrittenTimeAttackInputBridgeMethodOverrides: [...timeAttackInputBridgeMethodOverrides.keys()],
  handwrittenGhostSmoothSamplerOverride: replacedGhostSmoothSampler,
  handwrittenPresenterMethodOverrides: [...presenterMethodOverrides.keys()],
  handwrittenMotionCodecOverrides: [...motionCodecOverrides],
  handwrittenVehicleBusinessOverrides: [...vehicleBusinessOverrides],
  handwrittenVehicleAnimationSelectorOverrides: [...vehicleAnimationSelectorOverrides],
  handwrittenVehicleAnimationActionOverrides: [...vehicleAnimationActionOverrides],
  handwrittenVehicleCoinSourceOverrides: [...vehicleCoinSourceOverrides.keys()],
  handwrittenVehicleCoinOwnerOverrides: [...vehicleCoinOwnerOverrides],
  handwrittenVehicleVisualOwnerOverrides: [...vehicleVisualOwnerOverrides],
  handwrittenVehicleWeatherOverrides: [...vehicleWeatherOverrides],
  handwrittenVehicleRouteFunctionOverrides: [...vehicleRouteFunctionOverrides],
  handwrittenVehicleWarpClassOverrides: [...vehicleWarpClassOverrides],
  handwrittenVehicleTrackEventOverrides: [...vehicleTrackEventOverrides],
  handwrittenVehicleEventAnimatorOverrides: [...vehicleEventAnimatorOverrides],
  handwrittenVehicleLensFlareOverrides: [...vehicleLensFlareOverrides],
  handwrittenVehicleKartAudioOverrides: [...vehicleKartAudioOverrides],
  handwrittenVehicleAssetLoaderMethodOverrides: [...vehicleAssetLoaderMethodOverrides.keys()],
  handwrittenVehicleSlipstreamOverrides: [...vehicleSlipstreamOverrides],
  handwrittenVehicleStartGridOverrides: [...vehicleStartGridOverrides],
  handwrittenVehicleNormalCoordinatorOverrides: [...vehicleNormalCoordinatorOverrides],
  handwrittenVehicleFrameClockOverrides: [...vehicleFrameClockOverrides],
  handwrittenVehicleResidualOverrides: [...vehicleResidualOverrides.keys()],
  handwrittenMotionBlurEffect: replacedMotionBlurEffect,
  retiredMotionBlurHelpers: [...retiredMotionBlurHelpers].sort(),
  handwrittenMqTachometer: replacedMqTachometer,
  retiredMqTachometerHelpers: [...retiredMqTachometerHelpers].sort(),
  retiredVehicleResidualConstants: [...retiredVehicleResidualConstants],
  handwrittenPeerMeshOverrides: [...peerMeshOverrides],
  handwrittenNetworkTimingOverrides: [...networkTimingOverrides],
  handwrittenLobbyPrimitiveOverrides: [...lobbyPrimitiveOverrides],
  handwrittenUiSymbolOverrides: [...uiSymbolOverrides],
  retiredUiHelpers: [...retiredUiHelpers],
  handwrittenLocalProfileFunctionOverrides: [...localProfileFunctionOverrides.keys()],
  handwrittenTrackPickerMethodOverrides: [...trackPickerMethodOverrides.keys()],
  handwrittenTrackPickerWindow: replacedTrackPickerMethods.size ===
    trackPickerMethodOverrides.size,
  handwrittenLocalRaceMethodOverrides: [...localRaceMethodOverrides.keys()],
  handwrittenActiveRaceMethodOverrides: [...activeRaceMethodOverrides.keys()],
  handwrittenRemoteMotionOverrides: [...remoteMotionOverrides],
  handwrittenRaceDrivingScaleOverrides: [...raceDrivingScaleOverrides],
  handwrittenRacePeerCadenceOverrides: [...racePeerCadenceOverrides],
  handwrittenOutgoingRaceMotionOverrides: [...outgoingRaceMotionOverrides],
  handwrittenReadyViewMethodOverrides: [...readyViewMethodOverrides.keys()],
  handwrittenReadyViewPointerOverrides: [...readyViewPointerOverrides.keys()],
  handwrittenReadyVehiclePreviewMethodOverrides: [...readyVehiclePreviewMethodOverrides.keys()],
  handwrittenFirstRiderDialog: replacedFirstRiderDialog,
  handwrittenTimeAttackAuxiliaryClasses: [...replacedTimeAttackAuxiliaryClasses].sort(),
  handwrittenRouteSurfaceListenerMethods: [...routeSurfaceListenerMethodOverrides.keys()],
  handwrittenRaceBgmResources: [...raceBgmResourceOverrides.keys()],
  handwrittenGhostEquipment: [...ghostEquipmentOverrides.keys()],
  handwrittenSoloRaceBuild: replacedGhostAssetBuilderMethods.has("build"),
  handwrittenSettingsMethodOverrides: [...settingsMethodOverrides.keys()],
  handwrittenRaceHudController: replacedRaceHudBoostMethods.size ===
    raceHudBoostMethodOverrides.size,
  handwrittenGarageSelectionMethodOverrides: [...garageSelectionMethodOverrides.keys()],
  handwrittenRemoteFleetOverride: replacedRemoteFleet,
  handwrittenInputClassOverrides: [...inputClassOverrides, "jl0", "Ql0"],
  handwrittenInputFunctionOverrides: [...inputFunctionOverrides.keys()],
  handwrittenGameplayAdmissionOverrides: [...gameplayAdmissionOverrides.keys()],
  handwrittenGameplayTileOverrides: [...gameplayTileOverrides.keys()],
  handwrittenLobbyActionMethodOverrides: [...lobbyActionMethodOverrides.keys()],
  handwrittenLobbyRoomTimingMethodOverrides: [...lobbyRoomTimingMethodOverrides.keys()],
  handwrittenLobbyRoomLifecycleMethodOverrides: [...lobbyRoomLifecycleMethodOverrides.keys()],
  handwrittenLobbyRoomMemberOverrides: [...lobbyRoomMethodOverrides.keys(),
    ...lobbyRoomFieldOverrides.keys()],
  handwrittenRaceLoadingScreenOverride: replacedRaceLoadingScreen,
  handwrittenRpScenePreviewOverride: replacedRpScenePreview,
  handwrittenMultiplayerNoticeClassOverrides: [...replacedMultiplayerNoticeClasses].sort(),
  handwrittenLobbyPreviewDeclarationOverrides: [...replacedLobbyPreviewDeclarations].sort(),
  handwrittenMultiplayerAccountDeclarationOverrides: [...replacedMultiplayerAccountDeclarations].sort(),
  handwrittenMultiplayerPresentationFunctionOverrides: [...replacedMultiplayerPresentationFunctions].sort(),
  handwrittenMultiplayerSupportFunctionOverrides: [...replacedMultiplayerSupportFunctions].sort(),
  handwrittenMultiplayerAccountUiGroup: replacedMultiplayerAccountUiGroup,
  handwrittenFullMultiplayerClasses: [...replacedFullMultiplayerClasses].sort(),
  handwrittenRoomOptionFunctionOverrides: [...replacedRoomOptionFunctions].sort(),
  handwrittenLobbyDialogMethodOverrides: [...lobbyDialogMethodOverrides.keys()],
  handwrittenGhostKsvClassMethodOverrides: [...ghostKsvClassMethodOverrides.keys()],
  handwrittenGhostKsvFunctionOverrides: [...ghostKsvFunctionOverrides.keys()],
  handwrittenMultiplayerPresenterMethodOverrides: [...multiplayerPresenterMethodOverrides.keys()],
  handwrittenRacePresentationSessionMethodOverrides: [...racePresentationSessionMethodOverrides.keys()],
  handwrittenRaceChatOverlayOverride: replacedRaceChatOverlay,
  handwrittenTrackInfoCardMethodOverrides: [...trackInfoCardMethodOverrides.keys()],
  handwrittenRaceSessionMethodOverrides: [...raceSessionMethodOverrides.keys()],
  handwrittenClientMethodOverrides: [...clientMethodOverrides.keys()],
  handwrittenServerEventParserOverride: replacedServerEventParser,
  handwrittenRoomValidatorOverride: replacedRoomValidator,
  handwrittenDrivingMethodOverrides: [...drivingMethodOverrides.keys()],
  handwrittenTrackSurfaceImplementations: ["mi0", "gi0", "eE"],
  developmentExports: [...developmentExports],
  files: generated,
  garageFile: garageOutput,
};
await writeIfChanged("manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);
console.log(
  `Generated ${generated.length} ES modules and the redirected Garage chunk; ` +
    `${garageAliases.length} Garage exports preserved.`,
);
