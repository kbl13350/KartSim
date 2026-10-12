import { loadArchiveIndex, type ArchiveIndex } from "./archive-index";
import {
  ContainerStore,
  type ArchiveSource,
  type ContainerProgress,
  type DirectoryHandle,
  type OpfsStorage,
  type ContainerStoreOptions,
} from "./container-store";
import { loadResourceManifest, type ResourceFetch, type ResourceVersion } from "./manifest";
import { bundledArchiveReader } from "../platform/bundled-archives";
import { appAssetUrl, SWITCH_BUILD } from "../platform/platform";

export interface LegacyResourceBundle {
  readonly version: ResourceVersion;
  readonly sources: readonly ArchiveSource[];
  readonly archiveIndexes: ArchiveIndex;
  /** The OPFS cache behind the sources (resource download panel, priority loading). */
  readonly store: ContainerStore;
  preloadContainers(names: Iterable<string>): Promise<void>;
}

export interface LegacyAdapterOptions {
  readonly fetcher?: ResourceFetch;
  readonly storage?: OpfsStorage;
  readonly dataBaseUrl?: string;
  readonly fallbackWriter?: ContainerStoreOptions["fallbackWriter"];
  /** Packaged containers (the Switch build's default): no downloads, no OPFS. */
  readonly bundled?: ContainerStoreOptions["bundled"];
}

/**
 * Drop-in shape for the release bundle's uo0(version, onProgress, dataDirectory).
 * The binary archive parser can consume these lazy Blob-like sources unchanged.
 */
export async function loadLegacyResourceBundle(
  version: ResourceVersion,
  onProgress?: (progress: ContainerProgress) => void,
  localDirectory?: DirectoryHandle,
  options: LegacyAdapterOptions = {},
): Promise<LegacyResourceBundle> {
  // The Switch package carries every container next to index.html (SWITCH.md).
  const bundled = options.bundled ?? (SWITCH_BUILD && !options.storage ? bundledArchiveReader(version) : undefined);
  const manifest = await loadResourceManifest(version, options.fetcher, appAssetUrl(`/__${version}/resources`));
  const archiveIndexes = await loadArchiveIndex(manifest, options.fetcher, appAssetUrl(`/__${version}/archive-index`));
  const store = new ContainerStore({
    manifest,
    storage: options.storage,
    fetcher: options.fetcher,
    localDirectory,
    onProgress,
    fallbackWriter: options.fallbackWriter,
    bundled,
    dataBaseUrl: options.dataBaseUrl ??
      (version === "p3528" ? "https://kart-assets.iii.moe/p3528" : `/${version}`),
  });
  return {
    version,
    sources: manifest.files.map(file => store.source(file.name)),
    archiveIndexes,
    store,
    preloadContainers: names => store.preload(names),
  };
}
