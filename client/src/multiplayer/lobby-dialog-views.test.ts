import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { disposeLobbyDialog, setLobbyDialogBusy, showLobbyMessageBox,
  showLobbyPasswordDialog, showLobbyTeamDialog,
  type LobbyDialogNode, type LobbyDialogViewDependencies } from
  "./lobby-dialog-views";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class b1 {");
const end = release.indexOf("\nconst $l0 =", start);
assert.ok(start >= 0 && end > start);
const originalClass = release.slice(start, end);

type Variant = "message" | "notice" | "password" | "team";

async function observe(rewritten: boolean, variant: Variant) {
  const events: unknown[][] = [];
  const library = { id: "library" };
  const root = { id: "root" };
  const options = { library, root,
    cancel() { events.push(["cancel"]); } };
  const named = (name: string, children: LobbyDialogNode[] = []): LobbyDialogNode =>
    ({ name, children });
  const template = { definition: named("messageRoot"), nodes: {
    dialog: named("dialog"), message: named("message"),
    divider: named("divider"), buttonGroup: named("buttonGroup"),
    affirmative: named("yes"), negative: named("no"),
  } };
  const teamDefinition = named("CaptionWindow", [
    named("teamPanel"), named("cancelButton"),
  ]);
  const teamTemplate = named("teamTemplate", [named("curr"), named("background")]);
  let captured: Record<string, unknown> = {};
  const view = { show() { events.push(["show"]); },
    focus(target?: string) { events.push(["focus", target]); },
    render() { events.push(["render"]); },
    dispose() { events.push(["dispose"]); },
  };
  const deps = {
    async loadMessageTemplate(_library: unknown) {
      events.push(["message-template", _library === library]);
      return template;
    },
    async loadDefinition(_library: unknown, folder: string, name: string) {
      events.push(["definition", _library === library, folder, name]);
      return name === "teamTemplate" ? teamTemplate
        : folder === "dialog2_/changeTeam" ? teamDefinition
          : named("passwordRoot", [named("passwordEdit"),
            named("okButton"), named("cancelButton")]);
    },
    async decorateDefinition(_library: unknown, definition: LobbyDialogNode,
      folder: string) {
      events.push(["decorate", _library === library, definition.name, folder]);
      return definition;
    },
    clone(node: LobbyDialogNode, attributes: Record<string, string>,
      children?: LobbyDialogNode[]) {
      events.push(["clone", node.name, attributes, children?.length]);
      return { ...node, ...attributes, children: children ?? node.children };
    },
    nodeName(node: LobbyDialogNode) { return node.name; },
    async loadView(settings: Record<string, unknown>) {
      captured = settings;
      events.push(["view", settings.library === library,
        settings.root === root, settings.roots, settings.label,
        settings.preserveDisplayPixels, settings.smoothImages,
        settings.modal, JSON.stringify(settings.definition)]);
      return view;
    },
  } satisfies LobbyDialogViewDependencies;
  const Original = new Function("_w", "F9", "C8", "h2", "T", "te",
    `${originalClass}\nreturn b1;`)(
      deps.loadMessageTemplate, deps.loadDefinition,
      deps.decorateDefinition, deps.clone, deps.nodeName,
      { load: deps.loadView },
    ) as unknown as {
      messageBox(options: unknown, title: string, message: string,
        confirm: () => void, labels?: unknown, noticeOnly?: boolean):
          Promise<{ busy: boolean; view: typeof view; setBusy(value: boolean): void;
            dispose(): void }>;
      password(options: unknown, submit: (value: string) => void):
        Promise<{ busy: boolean; view: typeof view; setBusy(value: boolean): void;
          dispose(): void }>;
      team(options: unknown, team: number, choose: (team: number) => void):
        Promise<{ busy: boolean; view: typeof view; setBusy(value: boolean): void;
          dispose(): void }>;
    };
  class Modern {
    busy = false;
    view = view;
    setBusy(value: boolean) { setLobbyDialogBusy(this, value); }
    dispose() { disposeLobbyDialog(this); }
  }
  const make = () => new Modern();
  const confirm = () => events.push(["confirm"]);
  const submit = (password: string) => events.push(["submit", password]);
  const choose = (team: number) => events.push(["choose", team]);
  const dialog = variant === "message" || variant === "notice"
    ? rewritten
      ? await showLobbyMessageBox(make, options, "标题", "内容",
        variant === "notice" ? options.cancel : confirm,
        variant === "message" ? { yes: "同意", no: "拒绝" } : undefined,
        variant === "notice", deps)
      : await Original.messageBox(options, "标题", "内容",
        variant === "notice" ? options.cancel : confirm,
        variant === "message" ? { yes: "同意", no: "拒绝" } : undefined,
        variant === "notice")
    : variant === "password"
      ? rewritten ? await showLobbyPasswordDialog(make, options, submit, deps)
        : await Original.password(options, submit)
      : rewritten ? await showLobbyTeamDialog(make, options, 1, choose, deps)
        : await Original.team(options, 1, choose);
  const state = captured.state as (node: LobbyDialogNode) =>
    Record<string, unknown>;
  let snapshots: unknown[] = [];
  if (variant === "message" || variant === "notice") {
    const definition = captured.definition as LobbyDialogNode;
    const shell = definition.children[0]!;
    const group = shell.children[2]!;
    const yes = group.children[0]!;
    const no = group.children[1];
    snapshots = [state(shell).text, state(template.nodes.message),
      { label: state(yes).label, text: state(yes).text,
        visible: state(yes).visible },
      no && { label: state(no).label, text: state(no).text,
        visible: state(no).visible }];
    (state(yes).action as () => void)();
    if (no) (state(no).action as () => void)();
  } else if (variant === "password") {
    const edit = named("passwordEdit");
    const ok = named("okButton");
    snapshots = [{ disabled: state(ok).disabled,
      input: state(edit).input && {
        value: (state(edit).input as { value: string }).value,
        maxLength: (state(edit).input as { maxLength: number }).maxLength,
      } }];
    ((state(edit).input as { change(value: string): void }).change)("secret");
    snapshots.push({ disabled: state(ok).disabled });
    (state(ok).action as () => void)();
    dialog.setBusy(true);
    snapshots.push({ disabled: state(ok).disabled });
    (captured.onCancel as () => void)();
    dialog.setBusy(false);
    (captured.onCancel as () => void)();
  } else {
    const team1 = named("team1");
    const team2 = named("team2");
    snapshots = [{ disabled: state(team1).disabled,
      label: state(team1).label },
    { disabled: state(team2).disabled, label: state(team2).label }];
    (state(team2).action as () => void)();
    dialog.setBusy(true);
    snapshots.push({ disabled: state(team2).disabled });
    (captured.onCancel as () => void)();
    dialog.setBusy(false);
    (captured.onCancel as () => void)();
  }
  dialog.dispose();
  return { events, snapshots, busy: dialog.busy };
}

test("lobby message, password and team dialog rendering and actions match release", async () => {
  for (const variant of ["message", "notice", "password", "team"] as const) {
    assert.deepEqual(await observe(true, variant),
      await observe(false, variant), variant);
  }
});
