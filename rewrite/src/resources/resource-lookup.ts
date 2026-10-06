/** Logical file entry mounted from a physical archive or loose Data file. */
export interface ResourceEntry {
  virtualPath: string;
  canonicalPath?: string;
  sourceName: string;
  sourceKind?: string;
  containerId?: string;
  absenceAuthoritative?: boolean;
}

export interface ResourceLibraryInput<Entry extends ResourceEntry> {
  files: Entry[];
  archives: unknown[];
  errors: string[];
  warnings: string[];
  region: string;
  manifestAvailable: boolean;
  manifestMountPaths: Set<string>;
  archiveIndexes: unknown;
}

/** Index state attached to the release-facing `Sw` library instance. */
export interface ResourceLookup<Entry extends ResourceEntry> extends ResourceLibraryInput<Entry> {
  byPath: Map<string, Entry>;
  byCanonicalPath: Map<string, Entry[]>;
  byExactCanonicalPath: Map<string, Entry[]>;
  canonicalPrefixCache: Map<string, Entry[]>;
}

export type ContainerResolution<Entry extends ResourceEntry> =
  | { status: "found"; entry: Entry }
  | { status: "ambiguous"; entries: Entry[] }
  | { status: "missing"; authoritative: boolean };

/** The release strips separators but does not collapse `..` or case. */
export function normalizeCanonicalPath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\.\//, "").replace(/^\/+|\/+$/g, "");
}

function appendCandidate<Entry extends ResourceEntry>(
  index: Map<string, Entry[]>,
  key: string,
  entry: Entry,
): void {
  index.set(key, [...(index.get(key) ?? []), entry]);
}

/** Construct three independent lookup indexes while retaining duplicate records. */
export function initializeResourceLookup<Entry extends ResourceEntry>(
  library: ResourceLookup<Entry>,
  input: ResourceLibraryInput<Entry>,
): void {
  library.files = input.files;
  library.archives = input.archives;
  library.errors = input.errors;
  library.warnings = input.warnings;
  library.region = input.region;
  library.manifestAvailable = input.manifestAvailable;
  library.manifestMountPaths = input.manifestMountPaths;
  library.archiveIndexes = input.archiveIndexes;

  library.byPath = new Map(input.files.map(entry => [entry.virtualPath.toLowerCase(), entry]));
  library.byCanonicalPath = new Map();
  library.byExactCanonicalPath = new Map();
  library.canonicalPrefixCache ??= new Map();
  for (const entry of input.files) {
    const canonicalPath = entry.canonicalPath ?? entry.virtualPath;
    appendCandidate(library.byCanonicalPath, canonicalPath.toLowerCase(), entry);
    appendCandidate(library.byExactCanonicalPath, canonicalPath, entry);
  }
}

/** Virtual path lookup is case-insensitive; later duplicate paths take priority. */
export function getResource<Entry extends ResourceEntry>(
  library: ResourceLookup<Entry>, path: string,
): Entry | undefined {
  return library.byPath.get(path.toLowerCase());
}

export function resourcePhysicalContainerNames<Entry extends ResourceEntry>(
  library: ResourceLookup<Entry>, paths: string[],
): string[] {
  return [...new Set(paths.map(path => {
    const entry = getResource(library, path);
    if (!entry) throw new Error(`资源库内找不到 ${path}。`);
    return entry.sourceName;
  }))];
}

/** Resolve a canonical path inside the origin file's logical archive. */
export function resourceResolveContainerPath<Entry extends ResourceEntry>(
  library: ResourceLookup<Entry>, originPath: string, targetCanonicalPath: string,
): ContainerResolution<Entry> {
  const origin = getResource(library, originPath);
  if (!origin) throw new Error(`资源库内找不到 ${originPath}。`);
  if (!origin.containerId) throw new Error(`${originPath} 缺少逻辑容器来源。`);
  // Keep the release's exact target spelling behavior: this method lowercases,
  // but does not run normalizeCanonicalPath on the requested target.
  const candidates = (library.byCanonicalPath.get(targetCanonicalPath.toLowerCase()) ?? [])
    .filter(entry => entry.containerId === origin.containerId);
  if (candidates.length === 1) return { status: "found", entry: candidates[0]! };
  if (candidates.length > 1) return { status: "ambiguous", entries: candidates };
  return { status: "missing", authoritative: origin.absenceAuthoritative === true };
}

export function resourceExactCanonicalCandidates<Entry extends ResourceEntry>(
  library: ResourceLookup<Entry>, path: string,
): Entry[] {
  return library.byExactCanonicalPath.get(normalizeCanonicalPath(path)) ?? [];
}

export function resourceCanonicalCandidates<Entry extends ResourceEntry>(
  library: ResourceLookup<Entry>, path: string,
): Entry[] {
  return library.byCanonicalPath.get(normalizeCanonicalPath(path).toLowerCase()) ?? [];
}

/** Prefix lookup is case-sensitive and caches the actual returned array. */
export function resourceEntriesUnderCanonicalPrefix<Entry extends ResourceEntry>(
  library: ResourceLookup<Entry>, prefix: string,
): Entry[] {
  const canonicalPrefix = normalizeCanonicalPath(prefix);
  const cached = library.canonicalPrefixCache.get(canonicalPrefix);
  if (cached) return cached;
  const matches = library.files.filter(entry => {
    const canonicalPath = normalizeCanonicalPath(entry.canonicalPath ?? entry.virtualPath);
    return canonicalPath === canonicalPrefix || canonicalPath.startsWith(`${canonicalPrefix}/`);
  });
  library.canonicalPrefixCache.set(canonicalPrefix, matches);
  return matches;
}

export function resourceHasManifestMount<Entry extends ResourceEntry>(
  library: ResourceLookup<Entry>, mountPath: string,
): boolean {
  return library.manifestMountPaths.has(normalizeCanonicalPath(mountPath));
}

/** Prefer the same source file, then an unambiguous same-kind sibling. */
export function resourceFindSibling<Entry extends ResourceEntry>(
  library: ResourceLookup<Entry>, path: string, names: string[],
): Entry | undefined {
  const origin = getResource(library, path);
  const canonicalPath = origin?.canonicalPath ?? origin?.virtualPath ?? path;
  const slash = canonicalPath.lastIndexOf("/");
  const directory = slash < 0 ? "" : canonicalPath.slice(0, slash + 1);
  for (const name of names) {
    const siblings = library.byCanonicalPath.get(`${directory}${name}`.toLowerCase()) ?? [];
    if (!origin) {
      if (siblings[0]) return siblings[0];
      continue;
    }
    const sameSource = siblings.find(entry =>
      entry.sourceKind === origin.sourceKind && entry.sourceName === origin.sourceName);
    if (sameSource) return sameSource;
    const sameKind = siblings.filter(entry => entry.sourceKind === origin.sourceKind);
    if (sameKind.length === 1) return sameKind[0];
  }
  return undefined;
}
