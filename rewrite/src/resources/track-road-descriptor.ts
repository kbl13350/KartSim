import type { RoadDescriptor, RoadMeshRef } from "./track-road-extraction";

const supportedSurfaceFamilies = new Set([
  "BH", "MZ", "BS", "JM", "DJ", "DF", "MR", "HW",
]);
const standaloneSurfaces = new Set([
  "bcharge", "bcharget", "dirt", "pit", "retire", "slip",
  "리셋", "점프", "촋",
]);
const supportedRoadAttributes = new Set([
  "alphaBias", "dust", "dustVel", "sound", "soung", "rail",
]);

function roadAttribute(descriptor: RoadDescriptor,
  name: string): string | undefined {
  return descriptor.road.attributes.find(attribute => attribute.name === name)?.value;
}

export function roadSurface(descriptor: RoadDescriptor): string | undefined {
  return roadAttribute(descriptor, "surface");
}

export function roadRail(descriptor: RoadDescriptor): string | undefined {
  return roadAttribute(descriptor, "rail");
}

export function roadSound(descriptor: RoadDescriptor): string | undefined {
  return roadAttribute(descriptor, "sound");
}

export function isMovableRoad(descriptor: RoadDescriptor): boolean {
  return descriptor.road.attributes.some(attribute =>
    attribute.name === "movable" && attribute.value === "true");
}

function validNumberToken(text: string): boolean {
  return text === "" || Number.isFinite(Number.parseFloat(text));
}

/** Check surface names whose letters also encode physical parameters. */
export function roadSurfaceIssue(surface: string): string | undefined {
  if (standaloneSurfaces.has(surface)) return undefined;
  const family = surface.slice(0, 2);
  if (!supportedSurfaceFamilies.has(family))
    return `road surface=${surface} 尚未接入已证 consumer`;
  if (family === "DJ") {
    const tokens = surface.slice(2).split("/");
    if (tokens.length < 3 || tokens.slice(0, 3).some(token =>
      !validNumberToken(token)))
      return `road surface=${surface} 的 DJ token 无法安全复现`;
  }
  if ((family === "BH" || family === "MZ") && surface[4] === "." &&
    (family === "BH" ? [3, 7, 11, 15] : [3, 7, 11]).some(index =>
      !validNumberToken(surface.slice(index, index + 3))))
    return `road surface=${surface} 的固定宽度 float token 无法安全复现`;
  return undefined;
}

/** Descriptors with unproven fields remain visible but cannot drive collision. */
export function roadDescriptorIssue(descriptor: RoadDescriptor,
  permitMovable = false): string | undefined {
  const road = descriptor.road;
  if (road.text !== "") return "road text 非空";
  if (road.children.length !== 0) return "road 含子节点";
  const seen = new Set<string>();
  for (const attribute of road.attributes) {
    if (seen.has(attribute.name)) return `road 重复属性 ${attribute.name}`;
    seen.add(attribute.name);
    if (attribute.name === "surface") {
      const issue = roadSurfaceIssue(attribute.value);
      if (issue) return issue;
    } else {
      if (permitMovable && attribute.name === "movable"
        && attribute.value === "true") continue;
      if (!supportedRoadAttributes.has(attribute.name))
        return `road 属性 ${attribute.name}=${attribute.value} 尚未接入已证 consumer`;
    }
  }
  return undefined;
}

export function staticRoadIssue(descriptor: RoadDescriptor): string | undefined {
  return roadDescriptorIssue(descriptor, false);
}

/** A movable road needs a supported ancestor and a PRS controller on its path. */
export function movingRoadIssue(descriptor: RoadDescriptor,
  mesh: RoadMeshRef): string | undefined {
  const issue = roadDescriptorIssue(descriptor, true);
  if (issue) return issue;
  if (!isMovableRoad(descriptor)) return "road descriptor 不是 movable=true";
  for (let current: RoadMeshRef | undefined = mesh; current;
    current = current.parent) {
    const node = current.node;
    const slots = node.slotOccurrences;
    const prs = slots?.[1]?.value as { kind?: string } | undefined;
    if (prs?.kind === "prs") return undefined;
    if (slots?.[0] || slots?.[2])
      return "movable=true lineage 含未闭合 Vis/Path controller";
    if (node.className !== "Relement" && node.className !== "ReTriList"
      && node.className !== "ReTriStrip")
      return `movable=true lineage 节点类 ${node.className} 的 matrix callback 未闭合`;
  }
  return undefined;
}

export function anyRoadIssue(descriptor: RoadDescriptor,
  mesh: RoadMeshRef): string | undefined {
  return isMovableRoad(descriptor)
    ? movingRoadIssue(descriptor, mesh) : staticRoadIssue(descriptor);
}
