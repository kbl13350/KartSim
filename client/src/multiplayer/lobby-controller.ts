/** Multiplayer lobby owner over the readable room, modal and network services. */

import { joinLobbyRoom, leaveLobbyRoom, listLobbyRooms, mutateLobbyRoom,
  quickJoinLobbyRoom, sendLobbyChat, submitLobbyRoomSettings,
  switchLobbyTeam, type LobbyControllerHost } from "./lobby-actions";
import { cancelCountdownModals, endChangingModal, finishChangingLoad,
  isChangingModalCurrent, releaseChanging,
  type LobbyChangingHost } from "./lobby-changing";
import { cancelLobbyDialog, castLobbyKickVote, confirmLeaveLobbyRoom,
  lobbyDialogOptions, openLobbyDialog, syncKickVoteDialog,
  type LobbyDialogHost } from "./lobby-dialogs";
import { receiveLobbyEvent, type LobbyEventHost } from "./lobby-events";
import { chooseLobbyGarage, confirmLobbyGarage,
  type LobbyGarageHost } from "./lobby-garage";
import { bindLobbyClient, disposeLobby, handleRoomShortcut,
  lobbyNetworkDiagnostics, maybeAutoReadyInRoom, quickJoinShortcut,
  refreshLobbyAutoReady, renderLobby,
  type LobbyLifecycleHost } from "./lobby-lifecycle";
import { syncRaceLoadingView, type LobbyLoadingHost } from "./lobby-loading";
import { openMultiplayerLobby, type LobbyOpenHost } from "./lobby-open";
import { initializeLobbyRace, type LobbyRaceDependencies,
  type LobbyRaceHost } from "./lobby-race-loader";
import { showLobbyRoom, type RoomViewHost } from "./lobby-room-view";
import { changeLobbyRoomInfo, confirmLobbyAction, createLobbyRoom,
  type LobbySettingsHost } from "./lobby-settings";
import { initializeLobbyShellState, lobbyHasModal, lobbyIsInRoom,
  type LobbyShellFactories } from "./lobby-shell-state";
import { chooseLobbyTrack, confirmLobbyTrack,
  type LobbyTrackHost } from "./lobby-track";

export interface MultiplayerLobbyServices {
  state: LobbyShellFactories;
  race: LobbyRaceDependencies;
  open: Parameters<typeof openMultiplayerLobby>[1];
  loadingView: Parameters<typeof syncRaceLoadingView>[1];
  receive: Parameters<typeof receiveLobbyEvent>[2];
  loadRoom: Parameters<typeof showLobbyRoom>[1];
  notice: Parameters<typeof mutateLobbyRoom>[2];
  confirm: Parameters<typeof confirmLeaveLobbyRoom>[2];
  garageView: Parameters<typeof chooseLobbyGarage>[1];
  normalizeEquipment: Parameters<typeof chooseLobbyGarage>[2];
  track: Parameters<typeof chooseLobbyTrack>[1];
  randomRules: Parameters<typeof confirmLobbyTrack>[3];
  roomSettings: Parameters<typeof changeLobbyRoomInfo>[1];
  channels: Parameters<typeof createLobbyRoom>[1];
  createRoom: Parameters<typeof createLobbyRoom>[2];
  passwordDialog: Parameters<typeof joinLobbyRoom>[2];
  confirmAction: Parameters<typeof confirmLobbyAction>[4];
}

const ownerServices = new WeakMap<object, MultiplayerLobbyServices>();
const own = <T>(lobby: MultiplayerLobbyController) => lobby as unknown as T;
const services = (lobby: MultiplayerLobbyController) => {
  const value = ownerServices.get(lobby);
  if (!value) throw new Error("联机大厅依赖尚未初始化。");
  return value;
};

export class MultiplayerLobbyController {
  declare gameplay: NonNullable<Parameters<typeof listLobbyRooms>[4]>;

  constructor(options: LobbyRaceHost["options"],
    dependencies: MultiplayerLobbyServices) {
    ownerServices.set(this, dependencies);
    initializeLobbyShellState(this as unknown as Record<string, unknown>,
      options, dependencies.state);
    initializeLobbyRace(own<LobbyRaceHost>(this), dependencies.race);
  }

  get hasModal() { return lobbyHasModal(own<Parameters<typeof lobbyHasModal>[0]>(this)); }
  get isInRoom() { return lobbyIsInRoom(own<Parameters<typeof lobbyIsInRoom>[0]>(this)); }

  networkDiagnostics() { return lobbyNetworkDiagnostics(
    own<Parameters<typeof lobbyNetworkDiagnostics>[0]>(this)); }
  quickJoinShortcut() { return quickJoinShortcut(own<LobbyLifecycleHost>(this)); }
  handleRoomShortcut(event: Parameters<typeof handleRoomShortcut>[1]) {
    return handleRoomShortcut(own<LobbyLifecycleHost>(this), event);
  }
  refreshAutoReady() { return refreshLobbyAutoReady(
    own<LobbyLifecycleHost>(this)); }
  async open() { return openMultiplayerLobby(own<LobbyOpenHost>(this),
    services(this).open); }
  bindClient() { return bindLobbyClient(own<LobbyLifecycleHost>(this)); }
  dispose() { return disposeLobby(own<LobbyLifecycleHost>(this)); }
  render() { return renderLobby(own<LobbyLifecycleHost>(this)); }
  syncLoadingView() { return syncRaceLoadingView(own<LobbyLoadingHost>(this),
    services(this).loadingView); }
  maybeAutoReady() { return maybeAutoReadyInRoom(
    own<LobbyLifecycleHost>(this)); }
  receive(event: Parameters<typeof receiveLobbyEvent>[1]) {
    return receiveLobbyEvent(own<LobbyEventHost>(this), event,
      services(this).receive);
  }
  async showRoom() { return showLobbyRoom(own<RoomViewHost>(this),
    services(this).loadRoom); }
  async list(channel: string, page: number, quiet = false,
    gameplay = this.gameplay) {
    return listLobbyRooms(own<LobbyControllerHost>(this), channel, page,
      quiet, gameplay);
  }
  async leaveRoom(reason: string) { return leaveLobbyRoom(
    own<LobbyControllerHost>(this), reason); }
  async mutate(command: Parameters<typeof mutateLobbyRoom>[1]) {
    return mutateLobbyRoom(own<LobbyControllerHost>(this), command,
      services(this).notice);
  }
  cancelDialog(releaseAllowed = true) { return cancelLobbyDialog(
    own<LobbyDialogHost>(this), releaseAllowed); }
  async confirmLeaveRoom(roomId: string) { return confirmLeaveLobbyRoom(
    own<LobbyDialogHost>(this), roomId, services(this).confirm); }
  async openDialog(factory: Parameters<typeof openLobbyDialog>[1],
    allowDisconnected = false) { return openLobbyDialog(
      own<LobbyDialogHost>(this), factory, allowDisconnected); }
  dialogOptions() { return lobbyDialogOptions(own<LobbyDialogHost>(this)); }
  syncKickVoteDialog() { return syncKickVoteDialog(
    own<LobbyDialogHost>(this), services(this).confirm); }
  castKickVote(approve: boolean) { return castLobbyKickVote(
    own<LobbyDialogHost>(this), approve); }

  isChangingModalCurrent(modal: Parameters<typeof isChangingModalCurrent>[1]) {
    return isChangingModalCurrent(own<LobbyChangingHost>(this), modal);
  }
  endChangingModal(modal: Parameters<typeof endChangingModal>[1],
    releaseAllowed = true) { return endChangingModal(
      own<LobbyChangingHost>(this), modal, releaseAllowed); }
  cancelCountdownModals() { return cancelCountdownModals(
    own<LobbyChangingHost>(this)); }
  finishChangingLoad(modal: Parameters<typeof finishChangingLoad>[1],
    loaded: boolean) { return finishChangingLoad(
      own<LobbyChangingHost>(this), modal, loaded); }
  async releaseChanging(roomId: string) { return releaseChanging(
    own<LobbyChangingHost>(this), roomId); }

  async chooseGarage() { return chooseLobbyGarage(own<LobbyGarageHost>(this),
    services(this).garageView, services(this).normalizeEquipment); }
  async confirmGarage(choice: Parameters<typeof confirmLobbyGarage>[1],
    roomId: string, modal: Parameters<typeof confirmLobbyGarage>[3]) {
    return confirmLobbyGarage(own<LobbyGarageHost>(this), choice, roomId, modal);
  }
  async chooseTrack() { return chooseLobbyTrack(own<LobbyTrackHost>(this),
    services(this).track); }
  async confirmTrack(modal: Parameters<typeof confirmLobbyTrack>[1],
    choice: Parameters<typeof confirmLobbyTrack>[2]) {
    return confirmLobbyTrack(own<LobbyTrackHost>(this), modal, choice,
      services(this).randomRules);
  }
  async changeRoomInfo() { return changeLobbyRoomInfo(
    own<LobbySettingsHost>(this), services(this).roomSettings); }
  async sendChat(message: string) { return sendLobbyChat(
    own<LobbyControllerHost>(this), message); }
  async submitRoomSettings(
    settings: Parameters<typeof submitLobbyRoomSettings>[1],
    generation: number) { return submitLobbyRoomSettings(
      own<LobbyControllerHost>(this), settings, generation); }
  async create() { return createLobbyRoom(own<LobbySettingsHost>(this),
    services(this).channels, services(this).createRoom); }
  async join(room: Parameters<typeof joinLobbyRoom>[1]) { return joinLobbyRoom(
    own<LobbyControllerHost>(this), room, services(this).passwordDialog); }
  async quickJoin() { return quickJoinLobbyRoom(
    own<LobbyControllerHost>(this)); }
  async team() { return switchLobbyTeam(own<LobbyControllerHost>(this)); }
  async confirm(title: string, message: string, action: () => void) {
    return confirmLobbyAction(own<LobbySettingsHost>(this), title, message,
      action, services(this).confirmAction);
  }
}
