import { p2 } from "../generated/formats.js";
import type { ThemeIconLibrary } from "./lobby-theme-icons";

export const DEATHMATCH_BUTTON_ROOTS = ["zeta_/cn/stage/mainMenu", "zeta_/cn_stage/mainMenu",
  "zeta_cn_stage_/mainMenu", "stage_/mainMenu"] as const;
const cache = new WeakMap<object, Promise<CanvasImageSource[]>>();

/** Four original btn_deathMatch states, read from the mounted resource library. */
export function lobbyDeathmatchArt(library: ThemeIconLibrary): Promise<CanvasImageSource[]> {
  let pending = cache.get(library);
  if (!pending) {
    pending = Promise.all([1, 2, 3, 4].map(async state => {
      const token = `btn_deathMatch_0${state}.png`;
      const candidates = DEATHMATCH_BUTTON_ROOTS.flatMap(root => library.canonicalCandidates(`${root}/${token}`));
      const source = candidates.find(candidate => candidate.sourceName?.toLowerCase() === "zeta_cn_stage.rho") ?? candidates[0];
      if (!source) throw new Error(`Missing original DeathMatch menu resource: ${token}`);
      const decoded = await p2(await source.bytes()) as { width: number; height: number; pixels: ArrayLike<number> };
      const canvas = document.createElement("canvas");
      canvas.width = decoded.width; canvas.height = decoded.height;
      canvas.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(decoded.pixels), decoded.width, decoded.height), 0, 0);
      return canvas;
    }));
    cache.set(library, pending);
  }
  return pending;
}
