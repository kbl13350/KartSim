import { attribute, decodeBinaryXml, type BinaryXmlNode } from "../codecs/binary-xml";
import { p2 } from "../generated/formats.js";

/**
 * The theme icons of the release track picker (SelectTrackEx themeTabOrder),
 * shown before each room name in the multiplayer room list.
 */

interface IconResource {
  sourceName?: string;
  bytes(): Promise<Uint8Array>;
}

export interface ThemeIconLibrary {
  canonicalCandidates(path: string): IconResource[];
  timeAttackTrackCatalog?(): Promise<Array<{ id: string; theme: string }>>;
}

export interface ThemeIconEntry { id: string; icon: string }

export interface LobbyThemeIcons {
  /** Icon of the theme a track belongs to; random tracks use the random theme. */
  forTrack(trackId: string | undefined, random: boolean): CanvasImageSource | undefined;
}

const DIRECTORY = "dialog2_/selectTrackEx";
const OWNER = "dialog2_selecttrackex.rho";
/** themeTabOrder id of the random track pool tab. */
export const RANDOM_THEME_ID = "1024";

/** Theme ids and icon tokens in tab order; 1025 is the favourites tab. */
export function themeIconEntries(config: BinaryXmlNode): ThemeIconEntry[] {
  const order = config.children.find(node => node.name === "themeTabOrder");
  if (!order) return [];
  return order.children.flatMap(node => {
    const id = attribute(node, "id");
    if (!id || id === "1025") return [];
    return [{ id, icon: attribute(node, "icon") ?? id }];
  });
}

/** The first (normal) state of a theme icon token, as the picker names it. */
export function themeIconImageName(token: string): string {
  if (token.endsWith("@zz")) return `${token.slice(0, -3)}_1@zz`;
  return token.endsWith("_") ? `${token}1` : `${token}_1`;
}

/** Theme of a track id: the catalogue's own theme, else the longest theme id prefix. */
export function trackThemeId(trackId: string, catalogue: ReadonlyMap<string, string>,
  themeIds: readonly string[]): string | undefined {
  const known = catalogue.get(trackId) ?? catalogue.get(trackId.replace(/_rvs$/, ""));
  if (known) return known;
  const lower = trackId.toLowerCase();
  return [...themeIds].sort((a, b) => b.length - a.length)
    .find(id => lower.startsWith(id.toLowerCase()));
}

function resource(library: ThemeIconLibrary, name: string): IconResource | undefined {
  const tokens = name.endsWith("@zz") ? [`${name.slice(0, -3)}@cn`, name] : [name];
  for (const token of tokens) {
    const candidates = library.canonicalCandidates(`${DIRECTORY}/${token}`);
    const owned = candidates.filter(entry => entry.sourceName?.toLowerCase() === OWNER);
    const found = owned[0] ?? candidates[0];
    if (found) return found;
  }
  return undefined;
}

async function decode(source: IconResource): Promise<HTMLCanvasElement> {
  const image = await p2(await source.bytes()) as
    { width: number; height: number; pixels: ArrayLike<number> };
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  canvas.getContext("2d")!.putImageData(new ImageData(
    new Uint8ClampedArray(image.pixels), image.width, image.height), 0, 0);
  return canvas;
}

async function load(library: ThemeIconLibrary): Promise<LobbyThemeIcons> {
  const config = resource(library, "config@cn.bml");
  if (!config) throw new Error("缺少选赛道主题配置");
  const entries = themeIconEntries(decodeBinaryXml(await config.bytes()));
  const icons = new Map<string, HTMLCanvasElement>();
  await Promise.all(entries.map(async entry => {
    const source = resource(library, `${themeIconImageName(entry.icon)}.png`);
    if (source) icons.set(entry.id, await decode(source).catch(() => undefined as never));
  }));
  for (const [id, icon] of icons) if (!icon) icons.delete(id);
  const catalogue = new Map((await library.timeAttackTrackCatalog?.().catch(() => []) ?? [])
    .map(track => [track.id, track.theme] as const));
  const themeIds = entries.map(entry => entry.id).filter(id => /\D/.test(id));
  return {
    forTrack: (trackId, random) => {
      if (random) return icons.get(RANDOM_THEME_ID);
      const theme = trackId ? trackThemeId(trackId, catalogue, themeIds) : undefined;
      return theme ? icons.get(theme) : undefined;
    },
  };
}

const cache = new WeakMap<object, Promise<LobbyThemeIcons>>();

/** Icons load once per resource library; failures leave rows with the drawn badge. */
export function lobbyThemeIcons(library: ThemeIconLibrary): Promise<LobbyThemeIcons> {
  let pending = cache.get(library);
  if (!pending) {
    pending = load(library);
    cache.set(library, pending);
  }
  return pending;
}
