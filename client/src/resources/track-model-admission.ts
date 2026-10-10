import { admitMovingObstacle, trackNameEquals } from "./moving-obstacle";
import { buildTrackCourseGraph, type TrackCourseGraph } from "./track-course-graph";
import { staticRoadIssue } from "./track-road-descriptor";
import { extractTrackRoads, type RoadModelNode } from "./track-road-extraction";

export interface TrackXmlNode {
  name: string;
  attributes: Array<{ name: string; value: string }>;
  children: TrackXmlNode[];
}
export interface TrackRuntimeObject {
  kind: string;
  name: string;
  property?: TrackXmlNode;
  object?: unknown;
  instanceOrdinal?: number;
}
export interface ParsedTrackContainer {
  root: {
    kind: string;
    name: string;
    scene: RoadModelNode;
    trackObjects: TrackRuntimeObject[];
  };
}
export interface TrackSettings {
  cameraFar?: number;
  fog?: { mode: number; r: number; g: number; b: number;
    start?: number; end?: number; density?: number };
}
export interface TrackRouteSummary extends TrackCourseGraph {
  containerName: string;
  collisionTriangles: ReturnType<typeof extractTrackRoads>["triangles"];
  deferredRoadTriangles: ReturnType<typeof extractTrackRoads>["deferredTriangles"];
  roadIssues: ReturnType<typeof extractTrackRoads>["issues"];
  runtimeIssues: string[];
  collisionStats: ReturnType<typeof extractTrackRoads>["stats"];
}

function attributeNumber(node: TrackXmlNode | undefined,
  name: string): number | undefined {
  const text = node?.attributes.find(attribute => attribute.name === name)?.value;
  if (text === undefined) return undefined;
  const value = Number(text);
  return Number.isFinite(value) ? value : undefined;
}

/** Camera and fog values from the track's own TrackObject metadata. */
export function readTrackSettings(root: unknown): TrackSettings {
  const settings: TrackSettings = {};
  if (!root || typeof root !== "object" ||
    (root as { kind?: string }).kind !== "track") return settings;
  const container = root as ParsedTrackContainer["root"];
  const track = container.trackObjects.find(object =>
    trackNameEquals(object.name, "track"));
  const camera = track?.property?.children.find(child => child.name === "camera");
  const far = attributeNumber(camera, "far");
  if (far !== undefined && far > 0) settings.cameraFar = far;
  const fog = track?.property?.children.find(child => child.name === "fog");
  if (fog) {
    const mode = attributeNumber(fog, "mode");
    const r = attributeNumber(fog, "r");
    const g = attributeNumber(fog, "g");
    const b = attributeNumber(fog, "b");
    if (mode !== undefined && r !== undefined && g !== undefined
      && b !== undefined)
      settings.fog = { mode, r, g, b,
        start: attributeNumber(fog, "start"),
        end: attributeNumber(fog, "end"),
        density: attributeNumber(fog, "density") };
  }
  return settings;
}

export function soloTrackMode(mode: string): boolean {
  return mode === "speed-individual" || mode === "time-attack";
}

export function itemGameOnly(object: TrackRuntimeObject): boolean {
  const value = object.property?.children
    .find(child => trackNameEquals(child.name, "object"))
    ?.attributes.find(attribute => trackNameEquals(attribute.name, "onlyItemGame"))?.value;
  return value !== undefined && trackNameEquals(value.toLowerCase(), "true");
}

/** Explain track objects whose runtime consumer is not implemented yet. */
export function trackRuntimeIssues(parsed: ParsedTrackContainer,
  mode = "strict"): string[] {
  if (parsed.root.kind !== "track") return [];
  const issues: string[] = [];
  for (const object of parsed.root.trackObjects) {
    if (object.kind === "TrackObject") {
      if (object.name !== "track")
        issues.push(`TrackObject ${object.name || "<unnamed>"} 的 runtime consumer 尚未闭合`);
      continue;
    }
    if (object.kind === "ToRoad" || object.kind === "ToDummy" ||
      object.kind === "ToBlackPlane" || object.kind === "ToMinimap" ||
      (soloTrackMode(mode) && object.kind === "ToItemCube")) continue;
    if (object.kind !== "ToMovableObject") {
      issues.push(`${object.kind} ${object.name || "<unnamed>"} 的 runtime consumer 尚未闭合`);
      continue;
    }
    const objectProperty = object.property?.children.find(child =>
      trackNameEquals(child.name, "object"));
    if (soloTrackMode(mode) && itemGameOnly(object)) continue;
    const rawType = objectProperty?.attributes.find(attribute =>
      trackNameEquals(attribute.name, "type"))?.value;
    const terminator = rawType?.indexOf("\0") ?? -1;
    const type = rawType === undefined ? undefined : rawType.slice(0,
      terminator < 0 ? rawType.length : terminator);
    if (soloTrackMode(mode) && type === "itemCube") continue;
    const supported = rawType && trackNameEquals(rawType, "obstacle")
      ? "obstacle" : rawType && trackNameEquals(rawType, "event")
        ? "event" : undefined;
    if (supported === "obstacle" && mode === "time-attack" &&
      admitMovingObstacle(object as Parameters<typeof admitMovingObstacle>[0])
        .status === "admit") continue;
    if (supported) {
      issues.push(`ToMovableObject ${object.name || `#${object.instanceOrdinal}`} 的 object type=${supported} 尚未接入 M5 runtime`);
    } else {
      const value = type ?? "<missing>";
      issues.push(`ToMovableObject ${object.name || `#${object.instanceOrdinal}`} 的 object type=${value || "<empty>"} consumer 尚未闭合`);
    }
  }
  return issues;
}

/** Build one collision and course record from a parsed TrackContainer. */
export function extractTrackRoute(parsed: ParsedTrackContainer,
  mode = "strict", options: { forceReverse?: boolean } = {}): TrackRouteSummary {
  if (parsed.root.kind !== "track")
    throw new Error("standalone Relement .1s 不含 TrackContainer 路线数据。");
  const roads = extractTrackRoads(parsed.root.scene, staticRoadIssue);
  if (roads.triangles.length + roads.deferredTriangles.length === 0)
    throw new Error("track.1s 不含原版 <property><road/> 碰撞数据。");
  const route = buildTrackCourseGraph(parsed.root.trackObjects as
    Parameters<typeof buildTrackCourseGraph>[0], options.forceReverse === true);
  return {
    containerName: parsed.root.name,
    collisionTriangles: roads.triangles,
    deferredRoadTriangles: roads.deferredTriangles,
    roadIssues: roads.issues,
    runtimeIssues: trackRuntimeIssues(parsed, mode),
    collisionStats: roads.stats,
    sections: route.sections,
    firstSection: route.firstSection,
    lastSection: route.lastSection,
    start: route.start,
  };
}
