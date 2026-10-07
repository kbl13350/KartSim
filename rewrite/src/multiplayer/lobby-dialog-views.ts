/** Message, password and team-selection dialogs used by lobby actions. */

export interface LobbyDialogNode {
  name: string;
  children: LobbyDialogNode[];
  [key: string]: unknown;
}

interface DialogView {
  show(): void;
  focus(target?: string): void;
  render(): void;
  dispose(): void;
}

export interface LobbyDialogSession {
  busy: boolean;
  view: DialogView;
}

export interface LobbyDialogOptions {
  library: unknown;
  cancel(): void;
  [key: string]: unknown;
}

interface MessageTemplate {
  definition: LobbyDialogNode;
  nodes: {
    dialog: LobbyDialogNode;
    message: LobbyDialogNode;
    divider: LobbyDialogNode;
    buttonGroup: LobbyDialogNode;
    affirmative: LobbyDialogNode;
    negative: LobbyDialogNode;
  };
}

export interface LobbyDialogViewDependencies {
  loadMessageTemplate(library: unknown): Promise<MessageTemplate>;
  loadDefinition(library: unknown, folder: string, name: string):
    Promise<LobbyDialogNode>;
  decorateDefinition(library: unknown, definition: LobbyDialogNode,
    folder: string): Promise<LobbyDialogNode>;
  clone(node: LobbyDialogNode, attributes: Record<string, string>,
    children?: LobbyDialogNode[]): LobbyDialogNode;
  nodeName(node: LobbyDialogNode): string | undefined;
  loadView(options: Record<string, unknown>): Promise<DialogView>;
}

export async function showLobbyMessageBox<T extends LobbyDialogSession>(
  createDialog: () => T, options: LobbyDialogOptions, title: string,
  message: string, confirm: () => void,
  labels: { yes?: string; no?: string } | undefined,
  noticeOnly: boolean,
  dependencies: LobbyDialogViewDependencies): Promise<T> {
  const dialog = createDialog();
  const template = await dependencies.loadMessageTemplate(options.library);
  const { dialog: shell, message: body, divider, buttonGroup,
    affirmative, negative } = template.nodes;
  const yes = dependencies.clone(affirmative,
    { align: noticeOnly ? "center" : "left" });
  const no = dependencies.clone(negative, { align: "right" });
  const visibleShell = dependencies.clone(shell, { visible: "true" }, [
    body, divider,
    { ...buttonGroup, children: noticeOnly ? [yes] : [yes, no] },
  ]);
  dialog.view = await dependencies.loadView({
    ...options, preserveDisplayPixels: true, smoothImages: true,
    definition: { ...template.definition, children: [visibleShell] },
    roots: ["dialog2_/customMessageBox", "stage_/common"],
    modal: true, label: title, onCancel: options.cancel,
    state: (node: LobbyDialogNode) => {
      if (node === visibleShell) return { text: title };
      if (node === body) return { text: message, visible: true };
      if (node === yes) return {
        visible: true, label: labels?.yes ?? "确定",
        text: labels?.yes ?? "确定", action: confirm,
      };
      if (node === no) return {
        visible: true, label: labels?.no ?? "取消",
        text: labels?.no ?? "取消", action: options.cancel,
      };
      return {};
    },
  });
  dialog.view.show();
  dialog.view.focus();
  return dialog;
}

export async function showLobbyPasswordDialog<T extends LobbyDialogSession>(
  createDialog: () => T, options: LobbyDialogOptions,
  submit: (password: string) => void,
  dependencies: LobbyDialogViewDependencies): Promise<T> {
  const dialog = createDialog();
  let password = "";
  const definition = await dependencies.decorateDefinition(options.library,
    await dependencies.loadDefinition(options.library, "dialog2_/passwordBox",
      "passwordBox@zz"), "dialog2_/passwordBox");
  dialog.view = await dependencies.loadView({
    ...options, preserveDisplayPixels: true, smoothImages: true,
    definition, roots: ["dialog2_/passwordBox", "stage_/common"],
    modal: true, label: "输入房间密码",
    onCancel: () => { if (!dialog.busy) options.cancel(); },
    state: (node: LobbyDialogNode) => {
      switch (dependencies.nodeName(node)) {
        case "passwordEdit": return {
          disabled: dialog.busy, label: "房间密码",
          input: { value: password, password: true, maxLength: 12,
            change: (value: string) => {
              password = value;
              dialog.view.render();
            } },
        };
        case "okButton": return {
          disabled: dialog.busy || !password,
          label: "加入房间", action: () => submit(password),
        };
        case "cancelButton": return {
          disabled: dialog.busy, label: "取消", action: options.cancel,
        };
      }
      return {};
    },
  });
  dialog.view.show();
  dialog.view.focus("passwordEdit");
  return dialog;
}

export async function showLobbyTeamDialog<T extends LobbyDialogSession>(
  createDialog: () => T, options: LobbyDialogOptions,
  currentTeam: number, chooseTeam: (team: number) => void,
  dependencies: LobbyDialogViewDependencies): Promise<T> {
  const dialog = createDialog();
  const folder = "dialog2_/changeTeam";
  const definition = await dependencies.loadDefinition(options.library,
    folder, "mq_dialog@zz");
  const teamTemplate = await dependencies.loadDefinition(options.library,
    folder, "teamTemplate");
  const transform = async (node: LobbyDialogNode): Promise<LobbyDialogNode> => {
    if (dependencies.nodeName(node) === "teamPanel") {
      return { ...node, children: [1, 2].map((team, index) => {
        const left = 78 + index * 98;
        return dependencies.clone(teamTemplate, {
          name: `team${team}`,
          autoLoadImage: `popup_selectTeamColor_${team === 1 ? "red" : "blue"}_@zz`,
          windowRect: `${left} 0 ${left + 86} 92`,
        }, teamTemplate.children.filter(child =>
          dependencies.nodeName(child) === "curr" && currentTeam === team));
      }) };
    }
    const updated = { ...node,
      children: await Promise.all(node.children.map(transform)) };
    return node.name === "CaptionWindow"
      ? dependencies.decorateDefinition(options.library,
        dependencies.clone(updated,
          { setCloseButton: "cancelButton" }), folder)
      : updated;
  };
  dialog.view = await dependencies.loadView({
    ...options, preserveDisplayPixels: true, smoothImages: true,
    definition: await transform(definition),
    roots: [folder, "stage_/common"], modal: true,
    label: "选择队伍",
    onCancel: () => { if (!dialog.busy) options.cancel(); },
    state: (node: LobbyDialogNode) => {
      const name = dependencies.nodeName(node);
      if (name === "team1" || name === "team2") {
        const team = name === "team1" ? 1 : 2;
        return { disabled: dialog.busy || team === currentTeam,
          label: team === 1 ? "红队" : "蓝队",
          action: () => chooseTeam(team) };
      }
      return name === "cancelButton"
        ? { disabled: dialog.busy, label: "取消", action: options.cancel }
        : {};
    },
  });
  dialog.view.show();
  dialog.view.focus();
  return dialog;
}

export function setLobbyDialogBusy(dialog: LobbyDialogSession, busy: boolean): void {
  dialog.busy = busy;
  dialog.view.render();
}

export function disposeLobbyDialog(dialog: LobbyDialogSession): void {
  dialog.view.dispose();
}
