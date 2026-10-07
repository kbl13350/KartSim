/** Authored resources, native layout and wording for the garage confirmation window. */

import type { ConfirmationRectangle, GarageConfirmationBlueprint,
  GarageConfirmationRequest } from "./garage-confirmation-dialog";

export const garageConfirmationFontFamily = "KartSim Garage Dialog SourceHanSansCN";

const definitionPath = "dialog2_/customMessageBox/mq_dialog@zz.bml";
const framePath = "gui_/monocoque/frame.bml";
const configPath = "gui_/monocoque/config.bml";
const stringsPath = "stage_/garageX/stage_stringBag.bml";
const warningPath = "stage_/common/대화상자경고.png";
const lineGrowth = 20;

export interface ConfirmationResource {
  sourceKind: string;
  sourceName: string;
  bytes(): Promise<Uint8Array>;
}

export interface GarageConfirmationLibrary {
  exactCanonicalCandidates(path: string): ConfirmationResource[];
}

export interface ConfirmationNode {
  name: string;
  children: ConfirmationNode[];
  [field: string]: unknown;
}

export interface GarageConfirmationAssetDependencies {
  loadFont(family: string, bytes: Uint8Array): Promise<unknown>;
  parseBml(bytes: Uint8Array): ConfirmationNode;
  attribute(node: ConfirmationNode | undefined, name: string): string | undefined;
  frame(node: ConfirmationNode): any;
  decodeImage(bytes: Uint8Array): Promise<{ close(): void }>;
  rectangle(node: ConfirmationNode, parent: ConfirmationRectangle,
    frame?: any, extra?: unknown, size?: { width: number; height: number }):
    ConfirmationRectangle;
  innerRectangle(frame: any, rectangle: ConfirmationRectangle): ConfirmationRectangle;
}

export interface AuthoredGarageConfirmationBlueprint extends GarageConfirmationBlueprint {
  definitionPath: string;
  definition: ConfirmationNode;
  nodes: {
    dialog: ConfirmationNode; icon: ConfirmationNode; message: ConfirmationNode;
    divider: ConfirmationNode; buttonGroup: ConfirmationNode;
    affirmative: ConfirmationNode; negative: ConfirmationNode;
  };
  baseSize: { width: number; height: number };
  iconSize: { width: number; height: number };
  buttonSize: { width: number; height: number };
}

/** The release restricts this font to a unique entry in gui_font.rho. */
export async function loadGarageConfirmationFont(library: GarageConfirmationLibrary,
  dependencies: GarageConfirmationAssetDependencies): Promise<unknown> {
  const candidates = library.exactCanonicalCandidates(
    "gui_/font/SourceHanSansCN-Bold.otf").filter(source =>
    source.sourceKind === "rho" && source.sourceName.toLowerCase() === "gui_font.rho");
  if (candidates.length !== 1) throw new Error("车库弹窗原版字体缺失或不唯一。");
  return dependencies.loadFont(garageConfirmationFontFamily, await candidates[0]!.bytes());
}

function requireUnique(library: GarageConfirmationLibrary, path: string): ConfirmationResource {
  const candidates = library.exactCanonicalCandidates(path);
  if (candidates.length !== 1) throw new Error(`确认窗口资源缺失或不唯一：${path}`);
  return candidates[0]!;
}

function requireNode(parent: ConfirmationNode, name: string,
  attribute: GarageConfirmationAssetDependencies["attribute"]): ConfirmationNode {
  const child = parent.children.find(entry => attribute(entry, "name") === name);
  if (!child) throw new Error(`原确认窗口缺少 ${name}。`);
  return child;
}

function authoredSize(node: ConfirmationNode,
  attribute: GarageConfirmationAssetDependencies["attribute"]):
  { width: number; height: number } {
  const raw = attribute(node, "leftTopWH") ?? attribute(node, "windowSize");
  if (!raw) throw new Error(`${node.name} 缺少原版尺寸。`);
  const values = raw.trim().split(/\s+/).map(Number);
  const dimensions = values.length === 4 ? values.slice(2) : values;
  if (dimensions.length !== 2 || dimensions.some(value => !Number.isFinite(value)))
    throw new Error(`${node.name} 原版尺寸无效。`);
  return { width: dimensions[0]!, height: dimensions[1]! };
}

function localizedStrings(root: ConfirmationNode,
  attribute: GarageConfirmationAssetDependencies["attribute"]): Map<string, string> {
  return new Map(root.children.map(child => {
    const key = attribute(child, "n") ?? "";
    const language = child.children.find(entry => attribute(entry, "c") === "cn") ??
      child.children.find(entry => attribute(entry, "c") === "zz");
    return [key, attribute(language ?? child, "v") ?? ""] as const;
  }).filter(([key]) => Boolean(key)));
}

export async function loadGarageConfirmationBlueprint(library: GarageConfirmationLibrary,
  dependencies: GarageConfirmationAssetDependencies):
  Promise<AuthoredGarageConfirmationBlueprint> {
  const [definition, skin, config, strings] = await Promise.all(
    [definitionPath, framePath, configPath, stringsPath].map(async path =>
      dependencies.parseBml(await requireUnique(library, path).bytes())));
  const dialog = requireNode(definition!, "captionWnd", dependencies.attribute);
  const icon = requireNode(dialog, "iconPanel", dependencies.attribute);
  const message = requireNode(dialog, "textLabel", dependencies.attribute);
  const divider = dialog.children.find(child => child.name === "Window" &&
    dependencies.attribute(child, "frame") === "HSection");
  const buttonGroup = dialog.children.find(child => child.name === "Container" &&
    child.children.some(item => dependencies.attribute(item, "name") === "okButton"));
  if (!divider || !buttonGroup)
    throw new Error("原确认窗口缺少分隔线或按钮组。");
  const affirmative = requireNode(buttonGroup, "okButton", dependencies.attribute);
  const negative = requireNode(buttonGroup, "cancelButton", dependencies.attribute);
  const frames = new Map<string, Map<string, any>>();
  for (const group of skin!.children)
    if (group.children.length) frames.set(group.name,
      new Map(group.children.map(entry => [entry.name, dependencies.frame(entry)])));
  for (const key of [dependencies.attribute(dialog, "frame"),
    dependencies.attribute(divider, "frame"), "TextButton", "DefaultFocusedButton"])
    if (!frames.has(key!)) throw new Error(`确认窗口缺少 ${key} 原版皮肤。`);
  library.exactCanonicalCandidates(warningPath);
  return {
    definitionPath, warningPath, definition: definition!, config: config!,
    nodes: { dialog, icon, message, divider, buttonGroup, affirmative, negative },
    frames, strings: localizedStrings(strings!, dependencies.attribute),
    baseSize: authoredSize(dialog, dependencies.attribute),
    iconSize: authoredSize(icon, dependencies.attribute),
    buttonSize: authoredSize(affirmative, dependencies.attribute),
  };
}

const cachedAssets = new WeakMap<GarageConfirmationLibrary, Promise<{
  blueprint: AuthoredGarageConfirmationBlueprint;
  images: Map<string, { close(): void }>;
}>>();

/** Share one decoding promise per library and discard rejected promises. */
export function loadGarageConfirmationAssets(library: GarageConfirmationLibrary,
  dependencies: GarageConfirmationAssetDependencies) {
  let pending = cachedAssets.get(library);
  if (!pending) {
    pending = (async () => {
      const blueprint = await loadGarageConfirmationBlueprint(library, dependencies);
      const skinNames = [dependencies.attribute(blueprint.nodes.dialog, "frame"),
        dependencies.attribute(blueprint.nodes.divider, "frame"),
        "TextButton", "DefaultFocusedButton"];
      const paths = [...new Set(skinNames.flatMap(name =>
        [...blueprint.frames.get(name!)!.values()].map(frame =>
          `gui_/monocoque/${frame.texture}.png`)).filter(path => !path.endsWith("/.png")))];
      paths.push(blueprint.warningPath);
      const images = new Map<string, { close(): void }>();
      try {
        await Promise.all(paths.map(async path => {
          const candidates = library.exactCanonicalCandidates(path);
          if (candidates.length !== 1)
            throw new Error(`确认窗口贴图缺失或不唯一：${path}`);
          images.set(path, await dependencies.decodeImage(await candidates[0]!.bytes()));
        }));
        return { blueprint, images };
      } catch (error) {
        images.forEach(image => image.close());
        throw error;
      }
    })();
    cachedAssets.set(library, pending);
    const cached = pending;
    pending.catch(() => { if (cachedAssets.get(library) === cached) cachedAssets.delete(library); });
  }
  return pending;
}

function localizedString(strings: Map<string, string>, key: string, fallback: string): string {
  return strings.get(key)?.trim() || fallback;
}

export function garageConfirmationPartEquipRequest(strings: Map<string, string>,
  partName: string): GarageConfirmationRequest {
  const message = localizedString(strings, "confirmUseParts",
    "装备[%s]时，将消耗1个该部件，|且当前已装备的部件将消失。|确定装备吗？");
  return {
    title: localizedString(strings, "plantTune", "装备强化部件"),
    message: message.replace("%s", partName).replaceAll("|", "\n"),
    affirmative: "是", negative: "否", warning: true,
  };
}

export function garageConfirmationLayout(blueprint: AuthoredGarageConfirmationBlueprint,
  lineCount: number, viewport: { width: number; height: number },
  request: { singleAction?: boolean }, dependencies: GarageConfirmationAssetDependencies) {
  const nodes = blueprint.nodes;
  const dialogSkin = blueprint.frames.get(dependencies.attribute(nodes.dialog, "frame")!)!
    .get("Activated")!;
  const extraHeight = Math.max(0, lineCount - 1) * lineGrowth;
  const window = dependencies.rectangle(nodes.dialog, { x: 0, y: 0, ...viewport },
    dialogSkin, undefined, { width: blueprint.baseSize.width,
      height: blueprint.baseSize.height + extraHeight });
  const inner = dependencies.innerRectangle(dialogSkin, window);
  const icon = dependencies.rectangle(nodes.icon, inner);
  const message = dependencies.rectangle(nodes.message, inner);
  const divider = dependencies.rectangle(nodes.divider, inner,
    blueprint.frames.get(dependencies.attribute(nodes.divider, "frame")!)!.get("Normal")!);
  const buttons = dependencies.rectangle(nodes.buttonGroup, inner);
  const buttonWidth = blueprint.buttonSize.width;
  const affirmative = {
    x: request.singleAction ? buttons.x + (buttons.width - buttonWidth) / 2 : buttons.x,
    y: buttons.y, ...blueprint.buttonSize,
  };
  const negative = { x: buttons.x + buttons.width - buttonWidth, y: buttons.y,
    ...blueprint.buttonSize };
  return { window, icon, message, divider, affirmative, negative };
}
