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
const peerMeshOverrides = new Set(["pl0"]);
const networkTimingOverrides = new Set(["L40", "gl0"]);
const remoteMotionOverrides = new Set(["BL", "Gi0"]);
const raceDrivingScaleOverrides = new Set(["Oi0", "zi0", "fE"]);
const racePeerCadenceOverrides = new Set(["Vi0", "Ni0"]);
const outgoingRaceMotionOverrides = new Set(["FL", "Ii0", "ki0"]);
const inputClassOverrides = new Set(["Xl0", "Zl0"]);
const inputFunctionOverrides = new Map([
  ["xP", { section: "world", text: "function xP(code) { return browserScanCode(code); }" }],
  ["v6", { section: "world", text: "function v6(axis, value) { return gamepadAxisControl(axis, value); }" }],
  ["Hg", { section: "world", text: "function Hg(gamepads) { return pressedGamepadControls(gamepads); }" }],
  ["xl", { section: "multiplayer", text: "function xl(code, keyMap = Br) { return keyboardActionsForCode(code, keyMap, ut); }" }],
  ["yf", { section: "multiplayer", text: "function yf(target) { return isEditableTarget(target); }" }],
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
  ["connect", "  async connect(offerUrl, name, resourceVersion, equipment, initial, raceRuntime = false, token) { return connectGameClient(this, offerUrl, name, resourceVersion, equipment, initial, raceRuntime, token, { validateControlMessage: zo0, transport: configuredTransport() }); }"],
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
    sessionToken: url => xF(ay(url)),
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
    }, (profile, choice) => zw({ ...profile, equipment: choice.equipment })); }`],
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
  ["loadVersionedResources", "  async loadVersionedResources() { return loadStartupResources(this, { localResourcesSupported: io0, recoverLocalSource: ro0, defaultSourceName: so0, versionId: Bt, loadVersionedSources: uo0, loadLibrary: (sources, indexes) => Sw.load(sources, void 0, indexes), loadProfile: Ta0, defaultProfile: gr, resolveSelection: Rf0, isSpecialKartId: n3, displayKartName: Mw, localNickname: im }); }"],
  ["applyNewRiderRegistration", "  async applyNewRiderRegistration() { return registerNewRider(this, { loadEnvironment: library => rn.load(library), loadDialog: (library, root, options, context) => Fy.load(library, root, options, context), saveProfile: cT, saveNickname: EF }); }"],
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
  ["loadGhostKartAssets", "  async loadGhostKartAssets(ghost, scene, importer, speed, version, signal) { return loadGhostKartAssets(this, ghost, scene, importer, speed, version, signal, ghostAssetDependencies); }"],
  ["loadGhostDecorations", "  async loadGhostDecorations(ghost, library, scene, importer) { return loadGhostDecorations(ghost, library, scene, importer, ghostAssetDependencies); }"],
  ["rankColors", "  async rankColors(ghosts) { return rankGhostColors(this, ghosts, ghostAssetDependencies); }"],
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
const ast = parse(source, { sourceType: "module", errorRecovery: false });
const statements = ast.program.body;
const bodies = new Map(order.map((name) => [name, []]));
let garageExportNode;
let dlDeclarator;
const replacedInputs = new Set();
const replacedResources = new Set();
const replacedSwMethods = new Set();
const replacedRaceHudBoostMethods = new Set();
const replacedLobbyListDrawMethods = new Set();
const replacedGhosts = new Set();
const replacedKsv = new Set();
const replacedGhostRuntimeClasses = new Set();
const replacedLobbyAvatarDeclarations = new Set();
const replacedLobbyRoomTimingMethods = new Set();
const retiredGhosts = new Set();
const replacedPhysics = new Set();
const replacedMotionCodec = new Set();
const replacedVehicleBusiness = new Set();
const replacedVehicleAnimationSelectors = new Set();
const replacedVehicleAnimationActions = new Set();
const replacedVehicleCoinSources = new Set();
const replacedVehicleCoinOwners = new Set();
const replacedVehicleVisualOwners = new Set();
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

  const declarationName =
    node.type === "FunctionDeclaration" || node.type === "ClassDeclaration"
      ? node.id?.name
      : node.type === "VariableDeclaration" && node.declarations.length === 1
        ? node.declarations[0].id.name
        : undefined;
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
  if (declarationName === "AL") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "driving", "AL moved from driving.");
    bodies.get("driving").push({
      at: node.start,
      text: rewriteClassMethods(node, drivingMethodOverrides, replacedDrivingMethods),
    });
    continue;
  }
  if (declarationName === "_L") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "world",
      "Track world constructor moved from world.");
    bodies.get("world").push({
      at: node.start,
      text: rewriteClassMethods(node, worldConstructorOverrides, replacedWorldConstructor),
    });
    continue;
  }
  if (declarationName === "Ci0") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "world",
      "Local race runtime moved from world.");
    bodies.get("world").push({
      at: node.start,
      text: rewriteClassMethods(node, localRaceMethodOverrides, replacedLocalRaceMethods),
    });
    continue;
  }
  if (declarationName === "Ui0") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "world",
      "Active race coordinator moved from world.");
    bodies.get("world").push({
      at: node.start,
      text: rewriteClassMethods(node, activeRaceMethodOverrides, replacedActiveRaceMethods),
    });
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
  if (lifecycleOverrides.has(declarationName)) {
    assert(originalSection(node.start) === "timeattack", `Time attack lifecycle declaration ${declarationName} moved.`);
    replacedLifecycle.add(declarationName);
    continue;
  }
  if (declarationName === "ql0") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "multiplayer", "Ready controller moved.");
    bodies.get("multiplayer").push({
      at: node.start,
      text: rewriteClassMethods(node, readyMethodOverrides, replacedReadyMethods),
    });
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
  if (declarationName === "LT") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "multiplayer", "LT moved from multiplayer.");
    bodies.get("multiplayer").push({
      at: node.start,
      text: rewriteClassMethods(node, multiplayerMethodOverrides, replacedRaceSessionMethods),
    });
    continue;
  }
  if (declarationName === "Wl0") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "multiplayer",
      "Lobby controller moved from multiplayer.");
    bodies.get("multiplayer").push({
      at: node.start,
      text: rewriteClassMethods(node, lobbyActionMethodOverrides, replacedLobbyActions),
    });
    continue;
  }
  if (declarationName === "py") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "multiplayer",
      "Lobby room view moved from multiplayer.");
    bodies.get("multiplayer").push({
      at: node.start,
      text: rewriteClassMethods(node, lobbyRoomTimingMethodOverrides,
        replacedLobbyRoomTimingMethods),
    });
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
    bodies.get("library").push({
      at: node.start,
      text: rewriteClassMethods(node, raceHudBoostMethodOverrides, replacedRaceHudBoostMethods),
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
  if (declarationName === "_7") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "ui",
      "Track picker moved from UI.");
    bodies.get("ui").push({
      at: node.start,
      text: rewriteClassMethods(node, trackPickerMethodOverrides, replacedTrackPickerMethods),
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
    bodies.get("ui").push({
      at: node.start,
      text: rewriteClassMethods(node, settingsMethodOverrides, replacedSettingsMethods),
    });
    continue;
  }
  if (declarationName === "C7") {
    assert(node.type === "ClassDeclaration" && originalSection(node.start) === "ui",
      "Garage selector moved from UI.");
    bodies.get("ui").push({
      at: node.start,
      text: rewriteClassMethods(node, garageSelectionMethodOverrides, replacedGarageSelectionMethods),
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
    bodies.get("timeattack").push({
      at: node.start,
      text: rewriteClassMethods(node, presenterMethodOverrides, replacedPresenterMethods),
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
assert(replacedLobbyListDrawMethods.size === lobbyListDrawMethodOverrides.size,
  "The lobby list draw method override was not found.");
assert(
  replacedGhosts.size === ghostOverrides.size,
  "The handwritten Ghost overrides were not all found.",
);
assert(replacedKsv.size === ksvOverrides.size, "The KSV file overrides were not all found.");
assert(replacedGhostRuntimeClasses.size === ghostRuntimeClassOverrides.size,
  "The Ghost runtime class overrides were not all found.");
assert(replacedLobbyAvatarDeclarations.size === lobbyAvatarDeclarationOverrides.size,
  "The lobby avatar declarations were not all found.");
assert(replacedLobbyRoomTimingMethods.size === lobbyRoomTimingMethodOverrides.size,
  "The lobby room timing methods were not all found.");
assert(retiredGhosts.size === retiredGhostHelpers.size, "The retired Ghost helpers were not all found.");
assert(replacedPhysics.size === physicsOverrides.size, "The handwritten vehicle parameter overrides were not all found.");
assert(replacedStageManager, "The handwritten StageManager override was not found.");
assert(replacedLifecycle.size === lifecycleOverrides.size, "The time attack lifecycle override was not complete.");
assert(replacedReadyMethods.size === readyMethodOverrides.size, "The Ready flow method overrides were not all found.");
assert(replacedRaceStartCoordinator, "The race start coordinator override was not found.");
assert(replacedSoloRacePublisher, "The solo race publisher override was not found.");
assert(replacedApplicationMethods.size === applicationMethodOverrides.size, "The application race method overrides were not all found.");
assert(replacedApplicationFields.size === applicationFieldOverrides.size,
  "The application key field override was not found.");
assert(replacedTimeAttackStageMethods.size === timeAttackStageMethodOverrides.size, "The time attack stage method overrides were not all found.");
assert(replacedRecordServiceMethods.size === recordServiceMethodOverrides.size,
  "The time attack record service method overrides were not all found.");
assert(replacedGhostRecordLibraryMethods.size === ghostRecordLibraryMethodOverrides.size,
  "The Ghost record library method overrides were not all found.");
assert(replacedGhostAssetBuilderMethods.size === ghostAssetBuilderMethodOverrides.size,
  "The Ghost asset builder method overrides were not all found.");
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
  if (name === "world") {
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
    lines.push('import { StageManager as wf0 } from "../app/stage-manager.ts";');
    lines.push('import { advancePresentationFrame, renderPresentationFrame } from "../app/frame-loop.ts";');
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
  }
  if (name === "vehicle") {
    lines.push('import { KartRuntimeState as J40 } from "../vehicle/kart-runtime-state.ts";');
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
    lines.push('import { ScrollbarController as b6, scrollbarGeometry as uT, dragScrollPosition as qa0, stepScrollPosition as nf, scrollPosition as qv, pointInRectangle as bc } from "../ui/scrollbar.ts";');
    lines.push('import { TouchPageSwipe as WP } from "../ui/touch-swipe.ts";');
    lines.push('import { CoatingPreviewSession as xa0 } from "../ui/coating-preview.ts";');
    lines.push('import { RandomTrackSession as Tc0 } from "../ui/random-track-session.ts";');
    lines.push('import { activateGarageAction, allGarageItems, clampGarageFavoriteOffset, commitGarageItem, confirmGarageSelection, favoriteGarageItems, filteredGarageItems, garageCategoryItems, garageDecorationItems, garageFavoriteKey, garageFavoriteKeys, garageSubTabs, selectGarageCategory, selectGarageDecoration, selectGarageItem, selectGarageLegacyAppearance, selectGarageSubCategory, selectedGarageKart, toggleGarageFavoriteItem } from "../ui/garage-selection.ts";');
    lines.push('import { activateSettingsControl, applySettingsGraphicsPreset, applySettingsPreset, changeSettingsVolume, closeSettingsCombo, moveSettingsSelection, repeatSettingsVolumeStep, resetSettingsSound, selectSettingsSpeed, selectSettingsVersion, setSettingsRoomSpeed, stepSettingsVolume, stopSettingsVolumePointer, toggleSettingsCombo, toggleSettingsOption } from "../ui/settings-interactions.ts";');
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
    lines.push('import { isEditableTarget } from "../input/gameplay-input-queue.ts";');
    lines.push('import { GameplayInputQueue } from "../input/gameplay-input-queue.ts";');
    lines.push('import { GamepadEdgePoller } from "../input/gamepad-edges.ts";');
    lines.push('import { AutoForwardAssist as Xl0 } from "../input/auto-forward.ts";');
    lines.push('import { NitroSeamlessQueue as Zl0 } from "../input/nitro-seamless.ts";');
    lines.push('import { RaceStartCoordinator } from "../multiplayer/race-start-coordinator.ts";');
    lines.push('import { LobbyAvatarCache, lobbyAvatarKey } from "../multiplayer/lobby-avatar-cache.ts";');
    lines.push('import { animateLobbyRoom, canAnimateLobbyRoom, isLobbyCountdownLocked, lobbyCountdownState, sendLobbyChat as sendLobbyRoomChat, sendLobbyEmotion, setLobbyStartPresentation, updateLobbyCountdown } from "../multiplayer/lobby-room-timing.ts";');
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
    lines.push('import { canReloadForUpdate, configureApplicationBackbuffer, haltApplicationRuntime, handleApplicationShortcut, onApplicationKeyDown, restartRaceFromPause, toggleRacePause } from "../app/application-controls.ts";');
    lines.push('import { disposeApplicationRuntime } from "../app/application-disposal.ts";');
    lines.push('import { createPresenterHost, createReadyHost, getOrCreatePresenter, getOrCreateReadyCoordinator } from "../app/host-bridges.ts";');
    lines.push('import { createGhostRecordMenu, currentGhostRecordKey, mountGhostRecordMenu, selectGhostTrack } from "../app/ghost-menu.ts";');
    lines.push('import { loadStartupResources, prepareStartupReady, registerNewRider } from "../app/startup-resources.ts";');
    lines.push('import { createDrivingPipelineHost, createRaceBuilderHost, getOrCreateDrivingPipeline, getOrCreateRaceBuilder } from "../app/runtime-hosts.ts";');
    lines.push('import { getOrCreateRecordService, updateKartBoosterState } from "../app/race-services.ts";');
    lines.push('import { devToolsTrackObjects, devToolsTrackObjectsSource, devToolsTrackOwner } from "../app/track-diagnostics.ts";');
    lines.push('import { currentRhoLibrary, getOrCreateAudioDirector, getOrCreateRaceSession, getOrCreateReplayLibrary, requireRacePhysics, requireRaceTrack } from "../app/shell-state.ts";');
    lines.push('import { getActiveWindowNotice, mountDevTools, mountDevToolsTrackObjectsOverlay, mountDevToolsTrackOverlay, onApplicationViewportResize, readPresenterClock, setActiveWindowNotice, setDevToolsTrackObjectKind, writePresenterClock } from "../app/shell-accessors.ts";');
    lines.push('import { shellRouting } from "../app/shell-routing.ts";');
    lines.push('import { startSinglePlayerRace, returnToReady } from "../app/race-navigation.ts";');
  }
  if (name === "library") {
    lines.push('import { activateLobbyListEntry } from "../ui/lobby-list-actions.ts";');
    lines.push('import { drawLobbyListNode } from "../ui/lobby-list-draw.ts";');
    lines.push('import { personalBoostFrame, teamBoostFrame } from "../ui/race-hud-boost.ts";');
    lines.push('const lobbyListDrawDependencies = { attribute: T, rectangle: V0, modeForButton: Zc, get interactiveNames() { return aQ; }, imageState: st, drawTexture: ct, fitRoomTitle: CX, measure: ve, drawText: m9, randomTrack: X6, get fontFamily() { return Yp; } };');
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
  if (name === "vehicle") {
    lines.push('const animationActionDependencies = { createSequence: (source, motions, initial) => new _r(source, motions, initial), oneWay: m1, returnable: h5 };');
    lines.push('const coinOwnerOps = { createObject: () => new T2(), originalAsset: nl, decodeModel: y9, decodeAudio: Q9, loadModel: c5, createContact: (...args) => new y10(...args), routeAudio: S9 };');
    lines.push('const chargerEffectOps = { decodeModel: y9, loadModel: c5, prepareTexture: ye0, configureMesh: ie, configureMaterials: ve0 };');
    lines.push('const coatingOwnerOps = { createTextures: library => new yB(library), loadProjection: Ak };');
    lines.push("");
  }
  if (name === "driving") {
    lines.push('const vehicleSurfaces = { parseRouteTag: Vo, surfaceKind: Eg, railId: Ri, roadSurface: Mt };');
    lines.push("");
  }
  if (name === "ui") {
    lines.push('const localProfileDependencies = { normalizeGarage: E20, validateGarage: GI, garageKart: p5, systemKarts: Cr, resolveVariant: xw };');
    lines.push('const garageSelectionDependencies = { blockedKartItem: n3, legacyFamily: of, validateKartItem: j6, selectProfile: aT, findKart: pT, findCharacter: cf };');
    // qg and Ie are declared later in this recovered module. Read them when
    // the user action occurs, after ES module initialization has finished.
    lines.push('const garageFavoriteDependencies = { get maxFavorites() { return qg; }, gridStep: i4 };');
    lines.push('const settingsInteractionDependencies = { get tabs() { return Ie; }, versions: Qd, versionStatus: Ac, speedChoices: Di, fallbackSpeed: wa0, defaultSound: _P, volumeThumb: tm };');
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
    lines.push("const presentationFrameDependencies = { nowMs: () => performance.now(), isRaceFinished: Un, requestFrame: callback => requestAnimationFrame(callback) };");
    lines.push("const presenterRaceDependencies = { setToonLinesEnabled: Pp, newSpeedResetState: pr, nowMs: () => performance.now(), applyTrackFog: kv, isManualBoostTachometer: value => value instanceof Gr };");
    lines.push("const timeAttackStageDependencies = { nowMs: () => performance.now(), bodyQuaternion: PL, statusFlags: GD, racingPhase: Ne.Racing, isRaceFinished: Un, beginResetState: mL, advanceState: wL, kartVisible: gL, isDrivingPhase: Jl0, countdownPhase: Ne.Countdown, finishAcceptedPhase: Ne.FinishAccepted, refreshTachometer: eP, rankParticipants: XL, elapsedRaceMs: ff0, relativeGhostTime: nG, newGhostPoseBuffer: () => kL(), decodeGhostPose: LL, setVisualScaleMode: MK, isExhaustActive: Tk, particleRatio: Pt0, roadDescriptorName: TW, slotOffset: iG, createGhostRouteProgress: track => new hf0(track), compose: gf0, updateTachometer: QL, renderTachometer: JL, prepareWorldScene: e4, renderWithColorPipeline: yo, worldAxis: H2, depthAxis: $2 };");
    lines.push("const recordServiceDependencies = { recordKey: (selection, options) => Pt.recordKey(selection, options), resolveSpeed: Ue, validateSpeed: y6 };");
    lines.push("const ghostPoseRecorderDependencies = { interpolatePose: Ih0, encodeStamp: xD };");
    lines.push("const ghostPlaybackDependencies = { decodeRouteStamp: By, sampleC1: Jh0, sampleC2: ed0, sampleNative: FD, createSmoothSampler: record => new Yh0(record) };");
    lines.push("const ghostAssetDependencies = { findKart: b4, loadParameterFactory: async () => { const { createVehicleTimeAttackParameters } = await El(async () => { const { createVehicleTimeAttackParameters } = await Promise.resolve().then(() => AS); return { createVehicleTimeAttackParameters }; }, void 0); return createVehicleTimeAttackParameters; }, loadBodyParameter: t3, ghostItemIds: U_, loadPaintColor: We, createBalloon: Jw, createAccessory: hr };");
    lines.push("const ghostRecordLibraryDependencies = { restoreSummaries: Vh0, trackIdFromKey: key => Pt.trackIdFromKey(key), errorMessage: z_, zCeiling: B6, commonTimeBase: Dh0, debug: Nf, get storage() { return localStorage; }, get summaryStorageKey() { return PD; }, hydrateSummaries: hydrateGhostSummaryIndex, syncSummaries: syncGhostSummaryIndex };");
    lines.push("const ghostExportDependencies = { filename: V_, zCeiling: B6, encodeKsvFile: ph0 };");
    lines.push("");
  }
  if (name === "multiplayer") {
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
    lines.push("");
  }
  if (name === "world") {
    lines.push("const localRaceDependencies = { states: X2, beginResetState: mL, advanceResetState: wL, routeTagFamily: Vo, isStartBoosterWindow: fL };");
    lines.push("const raceRoomDependencies = { modeOf: G2, sameRp: t7, sameRoadblock: oR, sameLte: Nw, sameGiant: yI, toLocalTick: Y3, racingState: X2.Racing };");
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
            return program.scope.getBinding(part.id.name)?.referenced;
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
const generated = [];
for (const name of order) {
  const text = pruneUnreferencedDeclarations(retireDuplicateArchiveCode(name, renderModule(name)));
  const filename = `${name}.js`;
  await writeFile(path.join(outputDir, filename), text, "utf8");
  generated.push({
    file: filename,
    bytes: Buffer.byteLength(text),
    sha256: sha256(text),
    imports: [...imports.get(name).values()].reduce((total, set) => total + set.size, 0),
    exports: exports.get(name).size,
  });
}

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
const garageProgressionOverrides = new Map([
  ["reset", "reset(layout) { return resetGarageProgressionPanel(this, layout); }"],
  ["updateRadar", "async updateRadar(library, kart, grade, progression, configuration) { return updateGarageProgressionRadar(this, library, kart, grade, progression, configuration, garageProgressionRadarDependencies); }"],
  ["dispose", "dispose() { return disposeGarageProgressionPanel(this); }"],
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
const garageAst = parse(garage, { sourceType: "module", errorRecovery: false });
const garageEdits = garageAst.program.body.flatMap(node =>
  node.type === "FunctionDeclaration" && node.id && garagePartOverrides.has(node.id.name)
    ? [{ start: node.start, end: node.end, text: garagePartOverrides.get(node.id.name), name: node.id.name }]
    : []);
assert(garageEdits.length === garagePartOverrides.size &&
  new Set(garageEdits.map(edit => edit.name)).size === garagePartOverrides.size,
  "Garage parts business functions changed in the release source.");
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
for (const edit of [...garageEdits, ...progressionEdits, ...equipmentEdits,
  ...catalogNavigationEdits, ...factoryScoringEdits, ...cosmeticEquipmentEdits,
  ...cardCatalogEdits, ...stateCommitEdits, ...factoryCommitEdits, ...upgradeDialogEdits,
  ...progressionFlowEdits, ...cosmeticInventoryEdits, ...performanceEdits,
  ...lifecycleEdits, ...equippedCosmeticsEdits, ...vehicleInformationEdits,
  ...pageVisibilityEdits, ...controlsEdits, ...transformPreviewEdits,
  ...factoryPickerEdits,
  ...retiredFactorySessionEdits].sort((left, right) => right.start - left.start)) {
  redirected = redirected.slice(0, edit.start) + edit.text + redirected.slice(edit.end);
}
redirected = redirected.replace(oldImport, 'from "./app.js";');
redirected = 'import { collectGarageParts, parseLegacyGarageParts, resolveEquippedGaragePart, sameGaragePart, sortGarageParts } from "../ui/garage-parts-business.ts";\n'
  + 'import { disposeGarageProgressionPanel, resetGarageProgressionPanel, updateGarageProgressionRadar } from "../ui/garage-progression-radar.ts";\n'
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
  + 'import { activeGaragePreviewRect, finishGaragePreviewDrag, flushGarageTransformPreviewStart, isGarageTransformPreviewSessionActive, moveToGarageTransformPreviewRoot, placeInGarageTransformPreviewRoot, startGarageTransformPreview, syncGarageTransformPreviewUi } from "../ui/garage-transform-preview.ts";\n'
  + 'import { commitGarageFactoryChoice, createGarageFactoryChoiceButton, renderGarageFactoryAbilityPicker, updateGarageFactoryDraftSlot } from "../ui/garage-factory-picker.ts";\n'
  + 'const garageProgressionRadarDependencies = { createStatus: () => document.createElement("div"), loadParameters: da, applyChanges: ha, makeRadar: la };\n'
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
  + redirected;
assert(!redirected.includes(oldImport), "Garage chunk redirect failed.");
const garageOutput = "GarageXView-DSeU5AUN.js";
await writeFile(path.join(outputDir, garageOutput), redirected, "utf8");

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
  handwrittenGarageProgressionOverrides: [...garageProgressionOverrides.keys()],
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
  handwrittenGarageTransformPreviewOverrides: [...garageTransformPreviewOverrides.keys()],
  handwrittenGarageFactoryPickerOverrides: [...garageFactoryPickerOverrides.keys()],
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
  handwrittenApplicationAccessorOverrides: [...applicationMethodOverrides.keys()]
    .filter(name => name.startsWith("get:") || name.startsWith("set:")),
  handwrittenApplicationFieldOverrides: [...applicationFieldOverrides.keys()],
  handwrittenTimeAttackStageMethodOverrides: [...timeAttackStageMethodOverrides.keys()],
  handwrittenRecordServiceMethodOverrides: [...recordServiceMethodOverrides.keys()],
  handwrittenGhostRecordLibraryMethodOverrides: [...ghostRecordLibraryMethodOverrides.keys()],
  handwrittenGhostAssetBuilderMethodOverrides: [...ghostAssetBuilderMethodOverrides.keys()],
  handwrittenPresenterMethodOverrides: [...presenterMethodOverrides.keys()],
  handwrittenMotionCodecOverrides: [...motionCodecOverrides],
  handwrittenVehicleBusinessOverrides: [...vehicleBusinessOverrides],
  handwrittenVehicleAnimationSelectorOverrides: [...vehicleAnimationSelectorOverrides],
  handwrittenVehicleAnimationActionOverrides: [...vehicleAnimationActionOverrides],
  handwrittenVehicleCoinSourceOverrides: [...vehicleCoinSourceOverrides.keys()],
  handwrittenVehicleCoinOwnerOverrides: [...vehicleCoinOwnerOverrides],
  handwrittenVehicleVisualOwnerOverrides: [...vehicleVisualOwnerOverrides],
  handwrittenPeerMeshOverrides: [...peerMeshOverrides],
  handwrittenNetworkTimingOverrides: [...networkTimingOverrides],
  handwrittenLobbyPrimitiveOverrides: [...lobbyPrimitiveOverrides],
  handwrittenUiSymbolOverrides: [...uiSymbolOverrides],
  retiredUiHelpers: [...retiredUiHelpers],
  handwrittenLocalProfileFunctionOverrides: [...localProfileFunctionOverrides.keys()],
  handwrittenTrackPickerMethodOverrides: [...trackPickerMethodOverrides.keys()],
  handwrittenLocalRaceMethodOverrides: [...localRaceMethodOverrides.keys()],
  handwrittenActiveRaceMethodOverrides: [...activeRaceMethodOverrides.keys()],
  handwrittenRemoteMotionOverrides: [...remoteMotionOverrides],
  handwrittenRaceDrivingScaleOverrides: [...raceDrivingScaleOverrides],
  handwrittenRacePeerCadenceOverrides: [...racePeerCadenceOverrides],
  handwrittenOutgoingRaceMotionOverrides: [...outgoingRaceMotionOverrides],
  handwrittenReadyViewMethodOverrides: [...readyViewMethodOverrides.keys()],
  handwrittenReadyViewPointerOverrides: [...readyViewPointerOverrides.keys()],
  handwrittenReadyVehiclePreviewMethodOverrides: [...readyVehiclePreviewMethodOverrides.keys()],
  handwrittenSettingsMethodOverrides: [...settingsMethodOverrides.keys()],
  handwrittenGarageSelectionMethodOverrides: [...garageSelectionMethodOverrides.keys()],
  handwrittenRemoteFleetOverride: replacedRemoteFleet,
  handwrittenInputClassOverrides: [...inputClassOverrides, "jl0", "Ql0"],
  handwrittenInputFunctionOverrides: [...inputFunctionOverrides.keys()],
  handwrittenLobbyActionMethodOverrides: [...lobbyActionMethodOverrides.keys()],
  handwrittenLobbyRoomTimingMethodOverrides: [...lobbyRoomTimingMethodOverrides.keys()],
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
await writeFile(
  path.join(outputDir, "manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
);
console.log(
  `Generated ${generated.length} ES modules and the redirected Garage chunk; ` +
    `${garageAliases.length} Garage exports preserved.`,
);
