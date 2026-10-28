import { tr } from "../i18n/locale";
/** Room creation form state and template adaptation for all gameplay modes. */

import type { LobbyDialogNode, LobbyDialogOptions, LobbyDialogSession,
  LobbyDialogViewDependencies } from "./lobby-dialog-views";
import { BRAVE_CAPACITIES, BRAVE_CHANNEL, BRAVE_LABEL } from "./lobby-brave-mode";
import { itemModeLabel } from "./lobby-item-mode";

interface RoomSettings { name: string; capacity: number; password: string }
interface CanvasLike {
  strokeStyle: string;
  lineWidth: number;
  save(): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  stroke(): void;
  restore(): void;
}

export interface LobbyRoomFormDependencies extends LobbyDialogViewDependencies {
  attribute(node: LobbyDialogNode, name: string): string | undefined;
  channelNames(gameplay: string): Record<string, string>;
  channelKey(value: string, channels: Record<string, string>): string;
  dropdown(combo: LobbyDialogNode, template: LobbyDialogNode,
    values: string[]): LobbyDialogNode;
  channelMode(key: string): "team" | "individual";
}

function findNamedNode(node: LobbyDialogNode, name: string,
  attribute: LobbyDialogViewDependencies["nodeName"]):
    LobbyDialogNode | undefined {
  if (attribute(node) === name) return node;
  for (const child of node.children) {
    const found = findNamedNode(child, name, attribute);
    if (found) return found;
  }
  return undefined;
}

export async function showLobbyRoomCreationForm<T extends LobbyDialogSession>(
  createDialog: () => T, options: LobbyDialogOptions,
  initialMode: "team" | "individual", nickname: string,
  submit: (settings: RoomSettings, channel?: string) => void,
  initialChannel: string | undefined, gameplay: string,
  dependencies: LobbyRoomFormDependencies): Promise<T> {
  const dialog = createDialog();
  const channels = dependencies.channelNames(gameplay);
  const channelValues = Object.values(channels);
  let roomName = tr("{value}的房间", { value: String(nickname) }).slice(0, 18);
  let password = "";
  let passwordEnabled = false;
  // 50人乱斗 rooms seat up to 50 (server-go/BRAWL.md), in steps of ten.
  const brawlCapacities = ["10", "20", "30", "40", "50"];
  let capacity = gameplay === "brawl" ? "50" : "8";
  let mode = gameplay === "brave" ? "team" as const : initialMode;
  let channel = gameplay === "brave" ? BRAVE_CHANNEL : initialChannel;
  const folder = "dialog2_/createRoom";
  const raw = await dependencies.loadDefinition(options.library,
    folder, "mq_dialog@zz");
  const template = raw.children.find(child =>
    dependencies.nodeName(child) === "방만들기");
  if (!template) throw new Error(tr("缺少普通建房模板"));
  if (channel && !findNamedNode(template, "gameStyle",
    dependencies.nodeName)) {
    throw new Error(tr("缺少选择游戏下拉控件"));
  }
  const capacityTemplate = channel
    ? findNamedNode(template, "joinNum", dependencies.nodeName)
    : undefined;

  const transform = (node: LobbyDialogNode): LobbyDialogNode | undefined => {
    const name = dependencies.nodeName(node) ?? "";
    if (["basicAiCont", "clubRaceCont", "joinNumAi",
      "warningGreenAuth", "checkGreenAuth"].includes(name)) return undefined;
    if (name === "gameStyle") {
      if (channel) {
        if (!capacityTemplate) throw new Error(tr("缺少人数下拉模板"));
        return dependencies.dropdown(node, capacityTemplate, channelValues);
      }
      return dependencies.clone(node, {
        textColor: "255 72 106 163", textRender: "bold16",
        textAlign: "right,vcenter",
      });
    }
    if (name === "joinNum" && gameplay === "brawl") {
      return dependencies.clone(node, { comboListLength: String(26 * brawlCapacities.length) },
        node.children.map(child => {
          const row = child.name === "Skip" ? child.children[0] : undefined;
          return row ? { ...child, children: brawlCapacities.map((count, index) =>
            dependencies.clone(row, { name: `item${index + 1}`, text: `${count} #sb(people)` })) } : child;
        }));
    }
    if (name === "joinTeamGame" && gameplay === "brave") {
      return dependencies.clone(node, { comboListLength: "78" },
        node.children.map(child => child.name === "Skip"
          ? { ...child, children: child.children.filter(option =>
            ["4", "6", "8"].includes((dependencies.attribute(option, "text") ?? "").trim().split(/\s+/)[0]!)) }
          : child));
    }
    if (name === "joinNum" && gameplay === "roadblock") {
      return dependencies.clone(node, { comboListLength: "104" },
        node.children.map(child => child.name === "Skip"
          ? { ...child, children: child.children.filter(option =>
            ["5", "6", "7", "8"].includes(
              (dependencies.attribute(option, "text") ?? "")
                .trim().split(/\s+/)[0]!)) }
          : child));
    }
    return { ...node, children: node.children.map(transform)
      .filter((child): child is LobbyDialogNode => !!child) };
  };
  const visibleTemplate = dependencies.clone(transform(template)!,
    { visible: "true" });
  const definition = { ...raw, children: [
    await dependencies.decorateDefinition(options.library,
      visibleTemplate, folder),
  ] };
  dialog.view = await dependencies.loadView({
    ...options, preserveDisplayPixels: true, smoothImages: true,
    definition, roots: [folder, "stage_/common"],
    modal: true, label: tr("创建房间"),
    onCancel: () => { if (!dialog.busy) options.cancel(); },
    state: (node: LobbyDialogNode) => {
      const name = dependencies.nodeName(node);
      switch (name) {
        case "gameStyle": return channel ? {
          disabled: dialog.busy, label: tr("选择游戏"),
          select: {
            value: channels[channel], valueText: channels[channel],
            values: channelValues,
            change: (value: string) => {
              if (dialog.busy) return;
              channel = dependencies.channelKey(value, channels);
              mode = dependencies.channelMode(channel);
              if (mode === "team" && Number(capacity) % 2 !== 0) {
                capacity = String(Number(capacity) + 1);
              }
              dialog.view.render();
            },
          },
          paint: (canvas: CanvasLike,
            rect: { x: number; y: number; width: number }) => {
            canvas.save();
            canvas.strokeStyle = dialog.busy ? "#a5adba" : "#486aa3";
            canvas.lineWidth = 2;
            canvas.beginPath();
            canvas.moveTo(rect.x + rect.width - 18, rect.y + 11);
            canvas.lineTo(rect.x + rect.width - 13, rect.y + 16);
            canvas.lineTo(rect.x + rect.width - 8, rect.y + 11);
            canvas.stroke();
            canvas.restore();
          },
        } : { text: gameplay === "brave" ? tr(BRAVE_LABEL) : gameplay === "item" ? tr(itemModeLabel(mode === "team"))
          : mode === "team" ? tr("组队竞速") : tr("个人竞速") };
        case "roomName": return {
          disabled: dialog.busy, label: tr("房间名称"),
          input: { value: roomName, maxLength: 18,
            change: (value: string) => {
              roomName = value;
              dialog.view.render();
            } },
        };
        case "roomPassword": return {
          disabled: dialog.busy || !passwordEnabled,
          label: tr("房间密码"),
          input: { value: password, password: true, maxLength: 12,
            change: (value: string) => {
              password = value;
              dialog.view.render();
            } },
        };
        case "isPassword": return {
          disabled: dialog.busy, label: tr("设置房间密码"),
          checked: passwordEnabled,
          action: () => {
            passwordEnabled = !passwordEnabled;
            dialog.view.render();
          },
        };
        case "joinNum":
        case "joinTeamGame": return {
          visible: name === (mode === "team" ? "joinTeamGame" : "joinNum"),
          disabled: dialog.busy, label: tr("房间人数"),
          select: { value: capacity,
            values: gameplay === "brave" ? BRAVE_CAPACITIES.map(String)
              : gameplay === "brawl" ? brawlCapacities
              : gameplay === "roadblock" ? ["5", "6", "7", "8"]
              : mode === "team" ? ["2", "4", "6", "8"]
                : ["2", "3", "4", "5", "6", "7", "8"],
            change: (value: string) => { capacity = value; } },
        };
        case "createRoom": return {
          disabled: dialog.busy || !roomName.trim() ||
            (passwordEnabled && !password),
          label: tr("确定建房"),
          action: () => {
            if (!dialog.busy && roomName.trim() &&
              (!passwordEnabled || password)) {
              submit({ name: roomName.trim(), capacity: Number(capacity),
                password: passwordEnabled ? password : "" }, channel);
            }
          },
        };
        case "cancelRoom": return {
          disabled: dialog.busy, label: tr("取消"),
          action: () => { if (!dialog.busy) options.cancel(); },
        };
      }
      return {};
    },
  });
  dialog.view.show();
  dialog.view.focus("roomName");
  return dialog;
}
