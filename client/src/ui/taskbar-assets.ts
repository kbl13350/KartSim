import { attribute, decodeBinaryXml, type BinaryXmlNode } from "../codecs/binary-xml";
import type { TaskbarAssets, TaskbarImage, TaskbarButton } from "./taskbar";
import type { UiRectangle } from "./scrollbar";

const menuDirectory = "gui_/window/menu";
const menuArchive = "gui_window.rho";
const trayViewport: UiRectangle = { x: 0, y: 0, width: 1600, height: 66 };

export interface TaskbarAssetEntry {
  sourceKind: string;
  sourceName: string;
  virtualPath: string;
  bytes(): Promise<Uint8Array>;
  text(): Promise<string>;
}

export interface TaskbarAssetLibrary {
  canonicalCandidates(path: string): readonly TaskbarAssetEntry[];
}

export interface TaskbarFormatOperations {
  decodePng(bytes: Uint8Array): Promise<{ width: number; height: number; pixels: Uint8Array }>;
  layout(node: BinaryXmlNode, viewport: UiRectangle, image?: TaskbarImage): UiRectangle;
}

async function currentFormats(): Promise<TaskbarFormatOperations> {
  const { p2, V0 } = await import("../generated/formats.js");
  return { decodePng: p2, layout: (node, viewport, image) => V0(node, viewport, undefined, image) };
}

function exactEntry(library: TaskbarAssetLibrary, path: string): TaskbarAssetEntry {
  const entries = library.canonicalCandidates(path);
  if (entries.length !== 1) throw new Error(`P3528 任务栏资源 ${path} 不唯一或缺失。`);
  return entries[0]!;
}

function trayEntry(library: TaskbarAssetLibrary, name: string): TaskbarAssetEntry {
  const entry = exactEntry(library, `${menuDirectory}/${name}`);
  if (entry.sourceKind !== "rho" || entry.sourceName.toLowerCase() !== menuArchive) {
    throw new Error(`P3528 任务栏资源必须来自 ${menuArchive}。`);
  }
  return entry;
}

function requiredAttribute(node: BinaryXmlNode, name: string): string {
  const value = attribute(node, name);
  if (value === undefined) throw new Error(`P3528 任务栏缺少 ${node.name}.${name}。`);
  return value;
}

function imageName(library: TaskbarAssetLibrary, token: string): string {
  const candidates = token.endsWith("@zz")
    ? [`${token.slice(0, -3)}@cn`, token]
    : [token];
  for (const candidate of candidates) {
    if (library.canonicalCandidates(`${menuDirectory}/${candidate}.png`).length > 0) {
      return `${candidate}.png`;
    }
  }
  throw new Error(`P3528 任务栏缺少原版图片 ${token}。`);
}

function buttonImageName(node: BinaryXmlNode, frame: number): string {
  const token = requiredAttribute(node, "autoLoadImage");
  return token.endsWith("@zz")
    ? `${token.slice(0, -3)}${frame}@zz`
    : `${token}${frame}`;
}

async function decodeImage(entry: TaskbarAssetEntry,
  formats: TaskbarFormatOperations): Promise<TaskbarImage> {
  const decoded = await formats.decodePng(await entry.bytes());
  const canvas = document.createElement("canvas");
  canvas.width = decoded.width;
  canvas.height = decoded.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("浏览器无法解码 P3528 任务栏图片。");
  context.putImageData(new ImageData(new Uint8ClampedArray(decoded.pixels),
    decoded.width, decoded.height), 0, 0);
  return { image: canvas, width: canvas.width, height: canvas.height };
}

async function loadImage(library: TaskbarAssetLibrary, token: string,
  formats: TaskbarFormatOperations): Promise<TaskbarImage> {
  return decodeImage(trayEntry(library, imageName(library, token)), formats);
}

function forEachVisible(node: BinaryXmlNode, visit: (node: BinaryXmlNode) => void): void {
  if (node.name === "Skip" || attribute(node, "visible") === "false") return;
  visit(node);
  node.children.forEach(child => forEachVisible(child, visit));
}

function withFullWidth(node: BinaryXmlNode): BinaryXmlNode {
  return {
    ...node,
    attributes: node.attributes.map(item => item.name === "windowSize"
      ? { ...item, value: item.value.replace(/^fullwidth\b/, "1600") }
      : item),
  };
}

function buttonLayout(definition: BinaryXmlNode,
  images: Map<BinaryXmlNode, TaskbarImage>, formats: TaskbarFormatOperations): TaskbarButton[] {
  const buttons: TaskbarButton[] = [];
  function visit(node: BinaryXmlNode, viewport: UiRectangle): void {
    if (node.name === "Skip" || attribute(node, "visible") === "false") return;
    const rect = formats.layout(withFullWidth(node), viewport, images.get(node));
    if (attribute(node, "autoLoadImage")) {
      buttons.push({ node, rect, name: requiredAttribute(node, "name") });
    }
    node.children.forEach(child => visit(child, rect));
  }
  visit(definition, trayViewport);
  return buttons;
}

function buttonLabels(definition: BinaryXmlNode, xml: string): Map<string, string> {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  const stringBag = new Map(Array.from(document.querySelectorAll("k")).map(node => [
    node.getAttribute("n"),
    node.querySelector('m[c="cn"]')?.getAttribute("v") ?? "",
  ]));
  const labels = new Map<string, string>();
  function visit(node: BinaryXmlNode): void {
    const raw = attribute(node, "altText") ?? attribute(node, "text") ?? "";
    const key = /^#sb\(([^)]+)\)$/.exec(raw)?.[1];
    const label = key && stringBag.get(key);
    if (label) labels.set(attribute(node, "name") ?? "", label);
    node.children.forEach(visit);
  }
  visit(definition);
  labels.set("goKartPass", stringBag.get("kartPass") || "通行证");
  return labels;
}

/** Load the official tray BML and four-frame textures from its Rho owner. */
export async function loadTaskbarAssets(library: TaskbarAssetLibrary,
  operations?: TaskbarFormatOperations): Promise<TaskbarAssets> {
  const formats = operations ?? await currentFormats();
  const [definitionBytes, stringsXml] = await Promise.all([
    trayEntry(library, "tray@cn.bml").bytes(),
    exactEntry(library, "etc_/baseStringBag.xml").text(),
  ]);
  const definition = decodeBinaryXml(definitionBytes);
  const nodes: BinaryXmlNode[] = [];
  forEachVisible(definition, node => {
    if (attribute(node, "autoLoadImage")) nodes.push(node);
  });
  const images = new Map(await Promise.all(nodes.map(async node => [
    node,
    await Promise.all([1, 2, 3, 4].map(frame =>
      loadImage(library, buttonImageName(node, frame), formats))),
  ] as const)));
  const firstFrames = new Map([...images].map(([node, frames]) => [node, frames[0]!]));
  return {
    background: await loadImage(library, requiredAttribute(definition, "image"), formats),
    images: images as TaskbarAssets["images"],
    buttons: buttonLayout(definition, firstFrames, formats),
    labels: buttonLabels(definition, stringsXml),
  };
}
