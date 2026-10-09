/** Single-player Ready owner and multiplayer entry facade. */

import { initializeReadyControllerState } from
  "../multiplayer/ready-controller-state";
import { applyImmediateReadyGarageSelection, openReadyGarage,
  openReadyGarageX, returnReadyGarage, selectReadyGarage,
  showReadyGarageError, type ReadyGarageController,
  type ReadyGarageDependencies } from "./ready-garage";
import { acquireReadyToonEnvironment, enterTimeAttackReady,
  openTrackSelect, readyStageContext, resolveRandomSelection,
  selectReadyChoice, selectReadyTrack, startRaceFromReady,
  type ReadyFlowController, type ReadyViewDependencies,
  type TrackSelectDependencies } from "./ready-flow";
import { applyReadyMultiplayerGarage, openReadyMultiplayer,
  readyMultiplayerGarageOptions, type ReadyMultiplayerController,
  type ReadyMultiplayerDependencies } from "./ready-multiplayer";
import { changeReadyFavoriteItems, changeReadyFavoriteTrack,
  closeReadyMultiplayer, disposeReadyController, getReadyWindowNotice,
  isReadyModalBusy, readyNetworkDiagnostics, refreshReadyRecord,
  releaseReadyForRace, renderReadyController,
  returnMultiplayerToSinglePlayer, setReadyWindowNotice,
  updateReadyWindowNotice, type ReadyControllerStateHost } from
  "./ready-controller-state";
import { closeReadySettings, confirmReadySettings, handleReadyShortcut,
  openReadySettings, previewReadySettings, publishReadyRaceSpeed,
  releaseReadyToonEnvironment, saveReadyGameOptions,
  showReadyTrackSelectError, type ReadySettingsController,
  type ReadySettingsDependencies } from "./ready-settings";

export interface ReadyControllerServices {
  createRandomTrackSession(): unknown;
  multiplayer: ReadyMultiplayerDependencies;
  createNotice: Parameters<typeof readyMultiplayerGarageOptions>[1];
  loadToonEnvironment: Parameters<typeof acquireReadyToonEnvironment>[2];
  readyView: ReadyViewDependencies;
  trackSelect: TrackSelectDependencies;
  randomGroup: Parameters<typeof selectReadyChoice>[5];
  favoriteTrack: Parameters<typeof changeReadyFavoriteTrack>[3];
  garage: ReadyGarageDependencies;
  settings: ReadySettingsDependencies;
  saveGameOptions: Parameters<typeof saveReadyGameOptions>[1];
}

const ownerServices = new WeakMap<object, ReadyControllerServices>();
const own = <T>(controller: ReadyController) => controller as unknown as T;
const services = (controller: ReadyController) => {
  const value = ownerServices.get(controller);
  if (!value) throw new Error("Ready 控制器依赖尚未初始化。");
  return value;
};

export class ReadyController {
  declare host: { getProfile(): unknown };

  constructor(application: unknown, dependencies: ReadyControllerServices) {
    ownerServices.set(this, dependencies);
    initializeReadyControllerState(this as unknown as Record<string, unknown>,
      application, dependencies.createRandomTrackSession);
  }

  dispose() { return disposeReadyController(own<ReadyControllerStateHost>(this)); }
  updateWindowNotice(value: unknown) {
    return updateReadyWindowNotice(own<ReadyControllerStateHost>(this), value);
  }
  getWindowNotice() { return getReadyWindowNotice(
    own<ReadyControllerStateHost>(this)); }
  setWindowNotice(value: Parameters<typeof setReadyWindowNotice>[1]) { return setReadyWindowNotice(
    own<ReadyControllerStateHost>(this), value); }
  renderReady(state: unknown) { return renderReadyController(
    own<ReadyControllerStateHost>(this), state); }
  refreshRecord() { return refreshReadyRecord(
    own<ReadyControllerStateHost>(this)); }
  releaseForRace() { return releaseReadyForRace(
    own<ReadyControllerStateHost>(this)); }
  readyModalBusy() { return isReadyModalBusy(
    own<ReadyControllerStateHost>(this)); }

  async openMultiplayer(channel?: string, gameplay?: string) { return openReadyMultiplayer(
    own<ReadyMultiplayerController>(this), services(this).multiplayer, channel, gameplay); }
  async multiplayerGarageOptions() { return readyMultiplayerGarageOptions(
    own<ReadyMultiplayerController>(this), services(this).createNotice); }
  applyMultiplayerGarage(choice: Parameters<typeof applyReadyMultiplayerGarage>[1]) {
    return applyReadyMultiplayerGarage(own<ReadyMultiplayerController>(this),
      choice);
  }
  async returnMultiplayerToSinglePlayer() {
    return returnMultiplayerToSinglePlayer(own<ReadyControllerStateHost>(this));
  }
  networkDiagnostics() { return readyNetworkDiagnostics(
    own<ReadyControllerStateHost>(this)); }
  closeMultiplayer(openReady = true, restoreReady = true) {
    return closeReadyMultiplayer(own<ReadyControllerStateHost>(this),
      openReady, restoreReady);
  }

  readyStageContext() { return readyStageContext(own<ReadyFlowController>(this)); }
  async acquireReadyToonEnvironment(
    library: Parameters<typeof acquireReadyToonEnvironment>[1]) {
    return acquireReadyToonEnvironment(own<ReadyFlowController>(this), library,
      services(this).loadToonEnvironment);
  }
  async enterTimeAttackReady(profile = this.host.getProfile()) {
    return enterTimeAttackReady(own<ReadyFlowController>(this), profile,
      services(this).readyView);
  }
  async startRaceFromReady(selection: Parameters<typeof startRaceFromReady>[1],
    options: Parameters<typeof startRaceFromReady>[2]) {
    return startRaceFromReady(own<ReadyFlowController>(this), selection, options);
  }
  async openTrackSelect(selection: Parameters<typeof openTrackSelect>[1],
    options: Parameters<typeof openTrackSelect>[2]) {
    return openTrackSelect(own<ReadyFlowController>(this), selection, options,
      services(this).trackSelect);
  }
  selectReadyTrack(selection: Parameters<typeof selectReadyTrack>[1],
    options: Parameters<typeof selectReadyTrack>[2],
    track: Parameters<typeof selectReadyTrack>[3]) {
    return selectReadyTrack(own<ReadyFlowController>(this), selection, options,
      track);
  }
  selectReadyChoice(selection: Parameters<typeof selectReadyChoice>[1],
    options: Parameters<typeof selectReadyChoice>[2],
    choice: Parameters<typeof selectReadyChoice>[3],
    catalog: Parameters<typeof selectReadyChoice>[4]) {
    return selectReadyChoice(own<ReadyFlowController>(this), selection, options,
      choice, catalog, services(this).randomGroup);
  }
  async resolveRandomSelection(
    selection: Parameters<typeof resolveRandomSelection>[1]) {
    return resolveRandomSelection(own<ReadyFlowController>(this), selection);
  }
  changeFavoriteTrack(track: unknown, favorite: boolean) {
    return changeReadyFavoriteTrack(own<ReadyControllerStateHost>(this), track,
      favorite, services(this).favoriteTrack);
  }
  changeFavoriteItems(items: unknown) { return changeReadyFavoriteItems(
    own<ReadyControllerStateHost>(this), items); }

  async openGarage(selection: Parameters<typeof openReadyGarage>[1],
    options: Parameters<typeof openReadyGarage>[2]) {
    return openReadyGarage(own<ReadyGarageController>(this), selection, options,
      services(this).garage);
  }
  async selectReadyGarage(selection: Parameters<typeof selectReadyGarage>[1],
    options: Parameters<typeof selectReadyGarage>[2],
    choice: Parameters<typeof selectReadyGarage>[3]) {
    return selectReadyGarage(own<ReadyGarageController>(this), selection,
      options, choice);
  }
  async openGarageX(selection: Parameters<typeof openReadyGarageX>[1],
    options: Parameters<typeof openReadyGarageX>[2]) {
    return openReadyGarageX(own<ReadyGarageController>(this), selection, options,
      services(this).garage);
  }
  returnGarageToReady() { return returnReadyGarage(
    own<ReadyGarageController>(this)); }
  applyImmediateGarageSelection(
    selection: Parameters<typeof applyImmediateReadyGarageSelection>[1],
    options: Parameters<typeof applyImmediateReadyGarageSelection>[2],
    choice: Parameters<typeof applyImmediateReadyGarageSelection>[3]) {
    return applyImmediateReadyGarageSelection(own<ReadyGarageController>(this),
      selection, options, choice);
  }
  showGarageError(error: unknown) { return showReadyGarageError(
    own<ReadyGarageController>(this), error); }

  async openSettings() { return openReadySettings(
    own<ReadySettingsController>(this), services(this).settings); }
  previewSettings(options: Parameters<typeof previewReadySettings>[1]) {
    return previewReadySettings(own<ReadySettingsController>(this), options);
  }
  confirmSettings(options: Parameters<typeof confirmReadySettings>[1],
    speed: Parameters<typeof confirmReadySettings>[2],
    version: Parameters<typeof confirmReadySettings>[3]) {
    return confirmReadySettings(own<ReadySettingsController>(this), options,
      speed, version, services(this).settings);
  }
  publishRaceSpeedChannel() { return publishReadyRaceSpeed(
    own<ReadySettingsController>(this), services(this).settings); }
  saveGameOptions() { return saveReadyGameOptions(
    own<ReadySettingsController>(this), services(this).saveGameOptions); }
  closeSettings() { return closeReadySettings(
    own<ReadySettingsController>(this)); }
  showTrackSelectError(error: unknown) { return showReadyTrackSelectError(
    own<ReadySettingsController>(this), error); }
  handleReadyShortcut(event: Parameters<typeof handleReadyShortcut>[1]) {
    return handleReadyShortcut(own<ReadySettingsController>(this), event);
  }
  releaseReadyToonEnvironment() { return releaseReadyToonEnvironment(
    own<ReadySettingsController>(this)); }
}
