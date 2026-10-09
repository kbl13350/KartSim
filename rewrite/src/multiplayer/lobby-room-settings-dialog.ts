/** Edit an existing lobby room's name and optional password. */

import type { LobbyDialogNode, LobbyDialogOptions, LobbyDialogSession,
  LobbyDialogViewDependencies } from "./lobby-dialog-views";
import { itemModeLabel } from "./lobby-item-mode";

/** The room's game as the settings dialog names it; item rooms are 道具赛. */
export type RoomSettingsMode = "team" | "individual" | "itemTeam" | "itemIndi";

export function roomSettingsMode(room: { mode: string; gameplay?: string }): RoomSettingsMode {
  const team = room.mode === "team";
  return room.gameplay === "item" ? team ? "itemTeam" : "itemIndi"
    : team ? "team" : "individual";
}

export interface ExistingRoomSettings { name: string; password: string }

export async function showLobbyRoomSettings<T extends LobbyDialogSession>(
  createDialog: () => T, options: LobbyDialogOptions,
  mode: RoomSettingsMode, initial: ExistingRoomSettings,
  submitSettings: (settings: ExistingRoomSettings) => void,
  dependencies: LobbyDialogViewDependencies): Promise<T> {
  const dialog = createDialog();
  let roomName = initial.name;
  let password = initial.password;
  let passwordEnabled = !!password;
  const folder = "dialog/changeRoomInfo";
  const raw = await dependencies.loadDefinition(options.library,
    folder, "mq_dialog@zz");
  const template = raw.children.find(child =>
    dependencies.nodeName(child) === "방설정변경");
  if (!template) throw new Error("缺少普通房间设置模板");
  const stripUnused = (node: LobbyDialogNode): LobbyDialogNode => ({
    ...node,
    children: node.children.filter(child => ![
      "warningGreenAuth", "checkGreenAuth", "clubRaceCont",
    ].includes(dependencies.nodeName(child) ?? "")).map(stripUnused),
  });
  const definition = { ...raw, children: [
    await dependencies.decorateDefinition(options.library,
      dependencies.clone(stripUnused(template), { visible: "true" }), folder),
  ] };
  const commit = () => {
    if (!dialog.busy && roomName.trim()) {
      submitSettings({ name: roomName.trim(),
        password: passwordEnabled ? password : "" });
    }
  };
  dialog.view = await dependencies.loadView({
    ...options, preserveDisplayPixels: true, smoothImages: true,
    definition, roots: [folder, "stage_/common"],
    modal: true, label: "房间设置", onConfirm: commit,
    onCancel: () => { if (!dialog.busy) options.cancel(); },
    state: (node: LobbyDialogNode) => {
      switch (dependencies.nodeName(node)) {
        case "gameType": return {
          text: mode === "itemTeam" || mode === "itemIndi"
            ? itemModeLabel(mode === "itemTeam")
            : mode === "team" ? "组队竞速" : "个人竞速",
        };
        case "roomName": return {
          disabled: dialog.busy, label: "房间名称",
          input: { value: roomName, maxLength: 18,
            change: (value: string) => {
              roomName = value;
              dialog.view.render();
            }, submit: commit },
        };
        case "roomPassword": return {
          disabled: dialog.busy || !passwordEnabled,
          label: "房间密码",
          input: { value: password, password: true, maxLength: 12,
            change: (value: string) => {
              password = value;
              dialog.view.render();
            }, submit: commit },
        };
        case "isPassword": return {
          disabled: dialog.busy, label: "设置房间密码",
          checked: passwordEnabled,
          action: () => {
            if (!dialog.busy) {
              passwordEnabled = !passwordEnabled;
              if (!passwordEnabled) password = "";
              dialog.view.render();
            }
          },
        };
        case "change": return {
          disabled: dialog.busy || !roomName.trim(),
          label: "确定", action: commit,
        };
        case "cancel": return {
          disabled: dialog.busy, label: "取消", action: options.cancel,
        };
      }
      return {};
    },
  });
  dialog.view.show();
  dialog.view.focus("roomName");
  return dialog;
}
