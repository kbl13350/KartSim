/**
 * The build target. `vite build --mode switch` sets VITE_KART_PLATFORM=switch
 * (.env.switch): the Nintendo Switch package runs inside Brewser, a homebrew
 * web runtime (V8, WebGL 2 on Mesa, its own DOM) that loads the game from
 * the SD card as brewser://apps/<id>/index.html. See SWITCH.md.
 */
interface PlatformEnvironment { VITE_KART_PLATFORM?: string }

export const SWITCH_BUILD =
  (import.meta as ImportMeta & { env?: PlatformEnvironment }).env?.VITE_KART_PLATFORM === "switch";

/**
 * The parts of Brewser's `Switch` global the game uses. Paths are relative to
 * the app folder (sdmc:/switch/brewser/apps/<id>/), which an app may always
 * read and write; `end` of readFile is exclusive (fs.cc reads end - start
 * bytes) and offsets are 32-bit.
 */
export interface BrewserSwitch {
  readFile(path: string, options?: { start?: number; end?: number }): Promise<ArrayBuffer | null>;
  writeFile?(path: string, data: string | ArrayBuffer | ArrayBufferView): Promise<void>;
  stat?(path: string): Promise<{ size: number } | null>;
}

/** Brewser's file API, or undefined in a browser (the Switch build then reads over HTTP). */
export function brewserSwitch(): BrewserSwitch | undefined {
  const candidate = (globalThis as { Switch?: Partial<BrewserSwitch> }).Switch;
  return candidate && typeof candidate.readFile === "function"
    ? candidate as BrewserSwitch : undefined;
}

/**
 * Root-relative paths of the files packaged next to index.html. In a browser
 * "/ui/x.png" is the site root; in Brewser it would leave the app folder
 * (brewser://ui/x.png), so the Switch build resolves them against the page.
 */
const PACKAGED_ROOTS = /^\/(?:assets|p3553|__p3553|ui|classic-hud)(?:\/|$)/;

/** A packaged file's URL for fetch, Image and CSS: unchanged on the web. */
export function appAssetUrl(path: string): string {
  return SWITCH_BUILD && PACKAGED_ROOTS.test(path) ? `.${path}` : path;
}

/** Whether a root-relative request names a packaged file (see appAssetUrl). */
export function isPackagedPath(path: string): boolean {
  return PACKAGED_ROOTS.test(path);
}
