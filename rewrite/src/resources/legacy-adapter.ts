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

export interface LegacyResourceBundle {
  readonly version: ResourceVersion;
  readonly sources: readonly ArchiveSource[];
  readonly archiveIndexes: ArchiveIndex;
  preloadContainers(names: Iterable<string>): Promise<void>;
}

export interface LegacyAdapterOptions {
  readonly fetcher?: ResourceFetch;
  readonly storage?: OpfsStorage;
  readonly dataBaseUrl?: string;
  readonly fallbackWriter?: ContainerStoreOptions["fallbackWriter"];
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
  const manifest = await loadResourceManifest(version, options.fetcher);
  const archiveIndexes = await loadArchiveIndex(manifest, options.fetcher);
  const store = new ContainerStore({
    manifest,
    storage: options.storage,
    fetcher: options.fetcher,
    localDirectory,
    onProgress,
    fallbackWriter: options.fallbackWriter,
    dataBaseUrl: options.dataBaseUrl ??
      (version === "p3528" ? "https://kart-assets.iii.moe/p3528" : `/${version}`),
  });
  return {
    version,
    sources: manifest.files.map(file => store.source(file.name)),
    archiveIndexes,
    preloadContainers: names => store.preload(names),
  };
}
