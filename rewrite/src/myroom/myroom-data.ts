/**
 * Release My Room data read in the browser: the CN emblem table
 * (etc_/emblem/emblem@cn.xml) with its icons (etc_/emblem/<id>_51.png), and
 * the CN career table (etc_/career/newCareer@cn.xml) with the texts and
 * icons the career window shows (dialog2_newCareer icon/<texture>.png).
 */
import { p2 } from "../generated/formats.js";

interface DataResource {
  bytes(): Promise<Uint8Array>;
  text?(): Promise<string>;
}

export interface MyRoomDataLibrary {
  canonicalCandidates(path: string): DataResource[];
}

export interface EmblemInfo { id: number; name: string; desc: string }

export interface CareerInfo {
  id: number;
  mainType: number;
  subType: number;
  careerType: number;
  clearValue: number;
  title: string;
  desc: string;
  help: string;
  texture: string;
  rewardPoint: number;
  rewardEmblemId: number;
  /** showCondition: the "(%d/%d)" progress after the description. */
  showCondition: boolean;
  hidden: boolean;
  preClearCareerId: number;
  multiIds: number[];
}

/** Attribute values of one XML start tag; both quote styles. */
export function xmlAttributes(tag: string): Map<string, string> {
  const values = new Map<string, string>();
  for (const match of tag.matchAll(/([A-Za-z_][\w.-]*)\s*=\s*(?:'([^']*)'|"([^"]*)")/g))
    values.set(match[1]!, decodeEntities(match[2] ?? match[3] ?? ""));
  return values;
}

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (whole, entity: string) => {
    const lower = entity.toLowerCase();
    if (lower.startsWith("#x")) return String.fromCodePoint(Number.parseInt(lower.slice(2), 16));
    if (lower.startsWith("#")) return String.fromCodePoint(Number.parseInt(lower.slice(1), 10));
    return ({ amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'" } as Record<string, string>)[lower] ?? whole;
  });
}

function withoutComments(xml: string): string {
  return xml.replace(/<!--[\s\S]*?-->/g, "");
}

export function parseEmblemTable(xml: string): Map<number, EmblemInfo> {
  const table = new Map<number, EmblemInfo>();
  for (const match of withoutComments(xml).matchAll(/<emblem\b([^>]*)\/?>/g)) {
    const values = xmlAttributes(match[1]!);
    const id = Number(values.get("id"));
    if (!Number.isInteger(id) || id <= 0 || table.has(id)) continue;
    table.set(id, { id, name: values.get("name") ?? "", desc: values.get("desc") ?? "" });
  }
  return table;
}

const number = (value: string | undefined): number => {
  const parsed = Number(value?.trim());
  return Number.isFinite(parsed) ? parsed : 0;
};

/** newCareer@cn.xml rows; a repeated id keeps its first row (as the server does). */
export function parseCareerTable(xml: string): Map<number, CareerInfo> {
  const table = new Map<number, CareerInfo>();
  for (const match of withoutComments(xml).matchAll(/<careerItem\b([^>]*)\/?>/g)) {
    const values = xmlAttributes(match[1]!);
    const id = number(values.get("id"));
    if (!Number.isInteger(id) || id <= 0 || table.has(id) ||
        values.get("enable")?.trim().toLowerCase() === "false") continue;
    table.set(id, {
      id,
      mainType: number(values.get("mainType")),
      subType: number(values.get("subType")),
      careerType: number(values.get("careerType")),
      clearValue: number(values.get("clearValue")),
      title: values.get("title")?.trim() ?? "",
      desc: values.get("careerDesc")?.trim() ?? "",
      help: values.get("helpString")?.trim() ?? "",
      texture: values.get("texture")?.trim() ?? "",
      rewardPoint: number(values.get("rewardPoint")),
      rewardEmblemId: number(values.get("rewardEmblemId")),
      showCondition: values.get("showCondition")?.trim().toLowerCase() !== "false",
      hidden: values.get("isHidden")?.trim().toLowerCase() === "true",
      preClearCareerId: number(values.get("preClearCareerId")),
      multiIds: values.get("isMulti")?.trim().toLowerCase() === "true"
        ? (values.get("multiId") ?? "").split(",").map(number).filter(value => value > 0) : [],
    });
  }
  return table;
}

async function text(library: MyRoomDataLibrary, path: string): Promise<string> {
  const resource = library.canonicalCandidates(path)[0];
  if (!resource?.text) throw new Error(`缺少原版资源 ${path}`);
  return resource.text();
}

const emblemTables = new WeakMap<object, Promise<Map<number, EmblemInfo>>>();
const careerTables = new WeakMap<object, Promise<Map<number, CareerInfo>>>();

export function loadEmblemTable(library: MyRoomDataLibrary): Promise<Map<number, EmblemInfo>> {
  let pending = emblemTables.get(library);
  if (!pending) {
    pending = text(library, "etc_/emblem/emblem@cn.xml").then(parseEmblemTable);
    pending.catch(() => emblemTables.delete(library));
    emblemTables.set(library, pending);
  }
  return pending;
}

export function loadCareerTable(library: MyRoomDataLibrary): Promise<Map<number, CareerInfo>> {
  let pending = careerTables.get(library);
  if (!pending) {
    pending = text(library, "etc_/career/newCareer@cn.xml").then(parseCareerTable);
    pending.catch(() => careerTables.delete(library));
    careerTables.set(library, pending);
  }
  return pending;
}

/** A decoded release image as a canvas. */
export async function decodeImage(resource: DataResource): Promise<HTMLCanvasElement> {
  const image = await p2(await resource.bytes()) as
    { width: number; height: number; pixels: ArrayLike<number> };
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("无法解码原版图片");
  context.putImageData(new ImageData(new Uint8ClampedArray(image.pixels), image.width, image.height), 0, 0);
  return canvas;
}

/**
 * Images by resource path, decoded once per library; a missing image
 * resolves to undefined. `get` answers synchronously once loaded and calls
 * `loaded` when a pending image arrives (to redraw).
 */
export class ImageCache {
  private readonly images = new Map<string, HTMLCanvasElement | null>();
  private readonly pending = new Set<string>();

  constructor(private readonly library: MyRoomDataLibrary, private readonly loaded: () => void) {}

  get(path: string): HTMLCanvasElement | undefined {
    const image = this.images.get(path);
    if (image !== undefined) return image ?? undefined;
    if (!this.pending.has(path)) {
      this.pending.add(path);
      void this.load(path);
    }
    return undefined;
  }

  private async load(path: string): Promise<void> {
    const resource = this.library.canonicalCandidates(path)[0];
    let image: HTMLCanvasElement | null = null;
    try {
      if (resource) image = await decodeImage(resource);
    } catch (error) {
      console.warn(`原版图片 ${path} 解码失败`, error);
    }
    this.images.set(path, image);
    this.pending.delete(path);
    if (image) this.loaded();
  }
}

/** etc_/emblem/<id>_51.png, the 51x51 emblem icon. */
export function emblemIconPath(id: number): string {
  return `etc_/emblem/${id}_51.png`;
}

/** The level glove icon (etc_/level/<glove>.png). */
export function gloveIconPath(glove: string): string | undefined {
  return glove && !/[/\\]|\.\./.test(glove) ? `etc_/level/${glove}.png` : undefined;
}
