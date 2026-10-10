import { closeSync, createReadStream, openSync, readSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { decodeArchiveIndex } from "../resources/archive-index";
import { parseResourceManifest } from "../resources/manifest";

/** Node-only helpers for item tests that read the real p3553 mirror. */

const mirror = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../mirror");

export interface MirrorEntry {
  name: string;
  virtualPath: string;
  canonicalPath?: string;
  sourceName: string;
  containerId?: string;
  absenceAuthoritative?: boolean;
  bytes(): Promise<Uint8Array>;
}

export interface MirrorLibrary {
  files: MirrorEntry[];
  manifestAvailable: boolean;
  exactCanonicalCandidates(path: string): MirrorEntry[];
  [field: string]: unknown;
}

function source(name: string, size: number) {
  const filename = path.join(mirror, "p3553", name);
  return {
    name, size,
    arrayBuffer: () => readFile(filename).then(bytes => Uint8Array.from(bytes).buffer),
    slice: (start = 0, end = size) => ({
      arrayBuffer: async () => {
        const bytes = new Uint8Array(end - start);
        const fd = openSync(filename, "r");
        try {
          for (let cursor = 0; cursor < bytes.length;) {
            const read = readSync(fd, bytes, cursor, bytes.length - cursor, start + cursor);
            if (read <= 0) throw Error(`${name} 读取不完整。`);
            cursor += read;
          }
          return bytes.buffer;
        } finally { closeSync(fd); }
      },
    }),
  };
}

const libraries = new Map<string, Promise<MirrorLibrary>>();

/**
 * Mount the named containers (plus aaa.pk for the mount table) through the
 * release-facing `Sw.load`, so lookups behave exactly as in the game.
 */
export function loadMirrorLibrary(names: readonly string[]): Promise<MirrorLibrary> {
  const key = [...names].sort().join("|");
  let library = libraries.get(key);
  if (!library) {
    library = (async () => {
      // The generated vendor module probes modulepreload during import.
      (globalThis as { document?: unknown }).document ??= {
        createElement: () => ({ relList: { supports: () => true } }),
      };
      const { Sw } = await import("../generated/library.js") as unknown as {
        Sw: { load(sources: unknown[], progress: undefined, index: unknown): Promise<MirrorLibrary> };
      };
      const manifest = parseResourceManifest(JSON.parse(await readFile(
        path.join(mirror, "__p3553/resources"), "utf8")), "p3553");
      const index = await decodeArchiveIndex(Readable.toWeb(createReadStream(
        path.join(mirror, "__p3553/archive-index"))) as ReadableStream<Uint8Array>, manifest);
      const wanted = new Set(["aaa.pk", ...names]);
      const sources = manifest.files.filter(spec => wanted.has(spec.name) ||
        names.some(name => name.endsWith("*") && spec.name.startsWith(name.slice(0, -1))))
        .map(spec => source(spec.name, spec.size));
      return Sw.load(sources, undefined, index);
    })();
    libraries.set(key, library);
  }
  return library;
}

/** Containers holding item definitions, sounds, descriptions and track tables. */
export const ITEM_CONTAINERS = ["item.rho", "sound_fx_item.rho", "sound_fx_charger.rho", "track_common.rho",
  "DataPack1_*"];
