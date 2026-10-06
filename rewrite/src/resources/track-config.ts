import type { ResourceEntry } from "./resource-lookup";

export interface TrackConfigResource extends ResourceEntry {
  extension: string;
  bytes(): Promise<Uint8Array>;
}

export interface TrackConfigLibrary {
  byCanonicalPath: Map<string, TrackConfigResource[]>;
  get(path: string): TrackConfigResource | undefined;
}

export interface TrackConfigDependencies<XmlNode> {
  parseBml(bytes: Uint8Array): XmlNode;
  parseXml(bytes: Uint8Array): { root: XmlNode };
}

/** Choose a track config only from the model's own logical container. */
export async function loadTrackConfig<XmlNode>(
  library: TrackConfigLibrary,
  modelPath: string,
  dependencies: TrackConfigDependencies<XmlNode>,
): Promise<{ model: TrackConfigResource; root?: XmlNode }> {
  const model = library.get(modelPath);
  if (!model) throw new Error(`资源库内找不到 ${modelPath}。`);
  if (!model.containerId) throw new Error(`${modelPath} 缺少逻辑容器来源。`);
  const canonicalPath = model.canonicalPath ?? model.virtualPath;
  const slash = canonicalPath.lastIndexOf("/");
  const directory = slash < 0 ? "" : canonicalPath.slice(0, slash + 1);
  const candidates = ["track.bml", "track.xml"]
    .flatMap(name => library.byCanonicalPath.get(`${directory}${name}`.toLowerCase()) ?? [])
    .filter(file => file.containerId === model.containerId);
  if (candidates.length > 1)
    throw new Error(`${modelPath} 的 track config 在同一逻辑容器内不唯一。`);
  const config = candidates[0];
  if (!config) return { model };
  const bytes = await config.bytes();
  const root = config.extension === "bml"
    ? dependencies.parseBml(bytes)
    : dependencies.parseXml(bytes).root;
  return { model, root };
}
