import type { BundledArchiveReader } from "../resources/container-store";
import type { ResourceFetch } from "../resources/manifest";
import { brewserSwitch, type BrewserSwitch } from "./platform";

/**
 * Brewser reads byte ranges of files in the app folder; fetch() of a local
 * file would read the whole container (fetch.ts ignores Range), and the
 * largest is 344 MiB. `end` is exclusive, and `end: 0` would mean "to the end
 * of the file", so empty ranges never reach it.
 */
export function brewserArchiveReader(fs: BrewserSwitch, directory: string): BundledArchiveReader {
  return {
    async read(name, start, end) {
      if (end <= start) return new ArrayBuffer(0);
      const path = `${directory}/${name}`;
      const bytes = await fs.readFile(path, { start, end });
      if (!bytes) {
        throw new Error(`找不到内置资源文件 ${path}。请把打包目录里的 ${directory} 文件夹完整复制到 SD 卡。`);
      }
      return bytes;
    },
  };
}

/**
 * The Switch build opened in a desktop browser (development, or a LAN test)
 * reads the same packaged files with HTTP Range requests.
 */
export function httpArchiveReader(baseUrl: string, fetcher: ResourceFetch = (url, init) =>
  globalThis.fetch(url, init)): BundledArchiveReader {
  return {
    async read(name, start, end) {
      if (end <= start) return new ArrayBuffer(0);
      const response = await fetcher(`${baseUrl}/${encodeURIComponent(name)}`, {
        headers: { Range: `bytes=${start}-${end - 1}` },
      });
      if (response.status !== 206) {
        await response.body?.cancel().catch(() => undefined);
        throw new Error(`内置资源 ${name} 分段读取失败：HTTP ${response.status}（服务器需要支持 Range）。`);
      }
      return response.arrayBuffer();
    },
  };
}

/** The packaged archives of this build: SD card on the Switch, HTTP elsewhere. */
export function bundledArchiveReader(version: string): BundledArchiveReader {
  const fs = brewserSwitch();
  return fs ? brewserArchiveReader(fs, version) : httpArchiveReader(`./${version}`);
}
