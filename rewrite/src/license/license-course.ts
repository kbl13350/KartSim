/**
 * 驾照考试 courses (village_L0x_xx, village_C0xx/C1xx, ice_C001) are not in
 * track@zz.bml: the license race registers their metadata (one lap) and
 * loads them as time attack maps. Seventeen of the twenty name their goal
 * with <road final="end">; the open course village_C005 (行驶练习, 导弹练习)
 * names none, so its lap never ends. This gives such a course its goal, and
 * turns C005's start and sections the way the road runs.
 */
import type { Vec3 } from "../world/route";

/** The part of a course route (extractRoad / RouteSection) this reads. */
interface LicenseRoad {
  sections: ReadonlyArray<{
    frames: ReadonlyArray<{ position: Vec3; forward?: Vec3 }>;
    length?: number;
    outgoing: ReadonlyArray<{ section: number; gate: { final: boolean;
      triangles?: ReadonlyArray<ReadonlyArray<Vec3>> } }>;
  }>;
  firstSection: number;
  lastSection: number;
  start?: { position: Vec3; forward: Vec3 };
}

/** Beyond this gap between the last frame and the first the course is open, not a loop. */
const OPEN_COURSE_GAP = 5;

function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

/**
 * Marks the gate into the last section as the goal of an open course that
 * has no final gate [还原: the other license courses put final on their
 * "end" record, the physical end]. Loops without one (village_C110/C116)
 * finish on the start line as usual. Returns whether a gate was marked.
 */
export function markLicenseGoal(road: LicenseRoad): boolean {
  const edges = road.sections.flatMap(section => section.outgoing);
  if (edges.some(edge => edge.gate.final)) return false;
  const last = road.sections[road.lastSection];
  const first = road.sections[road.firstSection];
  const lastFrame = last?.frames.at(-1);
  const firstFrame = first?.frames[0];
  if (!lastFrame || !firstFrame || distance(lastFrame.position, firstFrame.position) <= OPEN_COURSE_GAP)
    return false;
  const goal = edges.find(edge => edge.section === road.lastSection);
  if (!goal) return false;
  goal.gate.final = true;
  return true;
}

const along = (from: Vec3, to: Vec3, direction: Vec3): number =>
  (to.x - from.x) * direction.x + (to.y - from.y) * direction.y + (to.z - from.z) * direction.z;
const turned = (vector: Vec3): Vec3 => ({ x: -vector.x, y: -vector.y, z: -vector.z });

/**
 * village_C005 is a reverse="1" road of two records. Its first section's one
 * frame takes the start gate's normal, which a reversed road keeps flipped
 * (track-course-graph.ts), so that frame and the start pose look back up the
 * road: the kart starts facing the wall behind it. Frames that look against
 * their own section's run turn around, and the start pose with the first one
 * [还原: the start dummy faces down the road]. Returns how many turned.
 */
export function alignLicenseFrames(road: LicenseRoad): number {
  let count = 0;
  for (const [index, section] of road.sections.entries()) {
    section.frames.forEach((frame, at) => {
      const next = section.frames[at + 1];
      if (!next || !frame.forward || along(frame.position, next.position, frame.forward) >= 0) return;
      (frame as { forward: Vec3 }).forward = turned(frame.forward);
      count++;
      if (index !== road.firstSection || at !== 0 || !road.start) return;
      // The start stands 0.05 behind the first frame along its forward.
      const start = road.start;
      start.forward = turned(start.forward);
      start.position = { x: frame.position.x - start.forward.x * 0.05,
        y: frame.position.y - start.forward.y * 0.05, z: frame.position.z - start.forward.z * 0.05 };
    });
  }
  return count;
}

function gateCentre(gate: { triangles?: ReadonlyArray<ReadonlyArray<Vec3>> }): Vec3 | undefined {
  const points = gate.triangles?.flat() ?? [];
  if (!points.length) return undefined;
  const sum = points.reduce((total, point) =>
    ({ x: total.x + point.x, y: total.y + point.y, z: total.z + point.z }), { x: 0, y: 0, z: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length, z: sum.z / points.length };
}

/**
 * The same reversed two-record road keeps each record's gate at its far end,
 * so a section's way out stands at the end of the OTHER section's frames: the
 * route state names the section behind the kart. The finish still counts
 * (lap 1 at the start gate, the goal at end), but a checkpoint reset takes
 * the frame of the wrong section, back at the start or with no goal left
 * ahead. The two sections trade frames (and lengths) so each runs up to its
 * own way out [还原]. Call after markLicenseGoal and alignLicenseFrames;
 * returns whether they traded.
 */
export function alignLicenseSections(road: LicenseRoad): boolean {
  if (road.sections.length !== 2) return false;
  const [a, b] = road.sections as [LicenseRoad["sections"][number], LicenseRoad["sections"][number]];
  if (a.outgoing.length !== 1 || b.outgoing.length !== 1) return false;
  const exitA = gateCentre(a.outgoing[0]!.gate), exitB = gateCentre(b.outgoing[0]!.gate);
  const endA = a.frames.at(-1)?.position, endB = b.frames.at(-1)?.position;
  if (!exitA || !exitB || !endA || !endB) return false;
  if (!(distance(exitA, endB) < distance(exitA, endA) && distance(exitB, endA) < distance(exitB, endB)))
    return false;
  const traded = { frames: a.frames, length: a.length };
  Object.assign(a, { frames: b.frames, length: b.length });
  Object.assign(b, traded);
  return true;
}

interface PropertyNode {
  name: string;
  attributes?: Array<{ name: string; value: unknown }>;
  children?: PropertyNode[];
}

/**
 * The course's <eventList> (TrackObject "track" property): the hint scene
 * (stage_common action/<file>.1s) of each event:* point, by event name, e.g.
 * turnLeft → 좌회전. Points without an entry (the scripted attacks) are absent.
 */
export function licenseEventScenes(trackObjects: ReadonlyArray<{ kind?: string; name?: string;
  property?: PropertyNode }>): Map<string, string> {
  const scenes = new Map<string, string>();
  const track = trackObjects.find(object => object.kind === "TrackObject" && object.name === "track");
  const list = track?.property?.children?.find(child => child.name === "eventList");
  for (const event of list?.children ?? []) {
    const scene = event.children?.find(child => child.name === "scene");
    const file = scene?.attributes?.find(attribute => attribute.name === "file")?.value;
    // Decoded strings may carry a NUL-terminated tail.
    const name = typeof file === "string" ? file.replace(/\0.*$/, "").trim() : "";
    if (name && /^[\p{L}\p{N}_@-]+$/u.test(name)) scenes.set(event.name, name);
  }
  return scenes;
}
