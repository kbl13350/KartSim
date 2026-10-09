import { p2 } from "../generated/formats.js";

/**
 * Release art for the lobby status bar: the level glove from
 * etc_/level/leveltable, the shop currency icons, and the top menu's
 * btn_chargeKoin "+" button (gui_/window/menu/menu.bml).
 */

interface ArtResource {
  bytes(): Promise<Uint8Array>;
  text?(): Promise<string>;
}

export interface TopBarArtLibrary {
  canonicalCandidates(path: string): ArtResource[];
}

export interface LobbyTopBarArt {
  /** The level's glove icon and its name, e.g. 黄色手套5. */
  level?: { image: string; name: string };
  cash?: string;
  lucci?: string;
  koin?: string;
  /** btn_chargeKoin normal, hover, pressed and disabled states. */
  charge?: string[];
}

const LEVEL_TABLE = "etc_/level/leveltable@cn.xml";
const CURRENCY = {
  cash: "dialog2_/personalShop/img_cash.png",
  lucci: "dialog2_/personalShop/img_lucci.png",
  koin: "dialog2_/personalShop/img_koin.png",
} as const;
const CHARGE = "gui_/window/menu/btn_chargeKoin_";

export interface LevelGlove { glove: string; name: string }

/** `<Level glove name>` rows in level order; row n is level n. */
export function parseLevelTable(xml: string): LevelGlove[] {
  return [...xml.matchAll(/<Level\b([^>]*)\/?>/g)].flatMap(match => {
    const glove = /\bglove\s*=\s*'([^']*)'|\bglove\s*=\s*"([^"]*)"/.exec(match[1]!);
    const name = /\bname\s*=\s*'([^']*)'|\bname\s*=\s*"([^"]*)"/.exec(match[1]!);
    const value = glove?.[1] ?? glove?.[2];
    return value ? [{ glove: value, name: name?.[1] ?? name?.[2] ?? value }] : [];
  });
}

/** The glove for a level; levels past the table keep its last glove. */
export function levelGlove(table: readonly LevelGlove[], level: number): LevelGlove | undefined {
  if (!table.length) return undefined;
  return table[Math.min(table.length - 1, Math.max(0, Math.floor(level)))];
}

function resource(library: TopBarArtLibrary, path: string): ArtResource | undefined {
  return library.canonicalCandidates(path)[0];
}

async function dataUrl(library: TopBarArtLibrary, path: string): Promise<string | undefined> {
  const source = resource(library, path);
  if (!source) return undefined;
  try {
    const image = await p2(await source.bytes()) as
      { width: number; height: number; pixels: ArrayLike<number> };
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    canvas.getContext("2d")!.putImageData(new ImageData(
      new Uint8ClampedArray(image.pixels), image.width, image.height), 0, 0);
    return canvas.toDataURL("image/png");
  } catch {
    return undefined;
  }
}

async function levelArt(library: TopBarArtLibrary,
  level: number): Promise<LobbyTopBarArt["level"]> {
  const table = resource(library, LEVEL_TABLE);
  if (!table?.text) return undefined;
  const glove = levelGlove(parseLevelTable(await table.text()), level);
  if (!glove) return undefined;
  const image = await dataUrl(library, `etc_/level/${glove.glove}.png`);
  return image ? { image, name: glove.name } : undefined;
}

const cache = new WeakMap<object, Map<number, Promise<LobbyTopBarArt>>>();

/** Loads once per library and level; pieces that are missing stay undefined. */
export function loadLobbyTopBarArt(library: TopBarArtLibrary,
  level: number): Promise<LobbyTopBarArt> {
  let byLevel = cache.get(library);
  if (!byLevel) cache.set(library, byLevel = new Map());
  let pending = byLevel.get(level);
  if (!pending) {
    pending = (async () => {
      const [levelIcon, cash, lucci, koin, ...charge] = await Promise.all([
        levelArt(library, level).catch(() => undefined),
        dataUrl(library, CURRENCY.cash), dataUrl(library, CURRENCY.lucci),
        dataUrl(library, CURRENCY.koin),
        ...[1, 2, 3, 4].map(state => dataUrl(library, `${CHARGE}${state}.png`)),
      ]);
      return { level: levelIcon, cash, lucci, koin,
        charge: charge.every(Boolean) ? charge as string[] : undefined };
    })();
    byLevel.set(level, pending);
  }
  return pending;
}

const gloveCache = new WeakMap<object, Map<string, Promise<string | undefined>>>();

/**
 * The glove icon the account summary names (`progress.glove`, a Korean key
 * such as 노랑5) as a data URL; undefined when the archive lacks it.
 */
export function loadLevelGloveArt(library: TopBarArtLibrary,
  glove: string): Promise<string | undefined> {
  if (!glove || /[/\\]|\.\./.test(glove)) return Promise.resolve(undefined);
  let byGlove = gloveCache.get(library);
  if (!byGlove) gloveCache.set(library, byGlove = new Map());
  let pending = byGlove.get(glove);
  if (!pending) {
    pending = dataUrl(library, `etc_/level/${glove}.png`).catch(() => undefined);
    byGlove.set(glove, pending);
  }
  return pending;
}
