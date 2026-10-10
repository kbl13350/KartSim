/** Builds the race route graph from the track's original <course> and ToRoad records. */

type ClientVec3 = [number, number, number];
interface WorldVec3 { x: number; y: number; z: number }
interface XmlNode {
  name: string;
  attributes: Array<{ name: string; value: string }>;
  children: XmlNode[];
}
interface RoadFrame {
  position: ClientVec3;
  storedForward: ClientVec3;
  up: ClientVec3;
}
interface RoadRecord {
  name: string;
  positions: ClientVec3[];
  gateIndices: Array<[number, number, number]>;
  frames: RoadFrame[];
  surface: string;
}
interface RoadObject {
  kind: "ToRoad";
  name: string;
  records: RoadRecord[];
  cyclic: boolean;
}
interface TrackPropertyObject {
  kind: "TrackObject";
  name: string;
  property?: XmlNode;
}
type TrackObject = RoadObject | TrackPropertyObject | { kind: string; name: string };

interface RouteFrame { position: WorldVec3; forward: WorldVec3; up: WorldVec3 }
interface RouteGate {
  triangles: WorldVec3[][];
  normal: WorldVec3;
  final: boolean;
  name: string;
}
interface PendingEdge { gate: RouteGate; section: PendingSection | null }
interface PendingSection {
  sequenceIndex: number;
  frames: RouteFrame[];
  length: number;
  surface: string;
  outgoing: PendingEdge[];
  incoming: PendingEdge[];
}
interface RouteEdge { gate: RouteGate; section: number }
interface RouteSection {
  sequenceIndex: number;
  frames: RouteFrame[];
  length: number;
  surface: string;
  outgoing: RouteEdge[];
  incoming: RouteEdge[];
}
export interface TrackCourseGraph {
  sections: RouteSection[];
  firstSection: number;
  lastSection: number;
  start: { position: WorldVec3; forward: WorldVec3; up: WorldVec3 };
}

const f32 = Math.fround;
const attribute = (node: XmlNode, name: string): string | undefined =>
  node.attributes.find(entry => entry.name === name)?.value;
const world = (vector: ClientVec3): WorldVec3 =>
  ({ x: vector[0], y: vector[2], z: -vector[1] });
const subtract = (a: ClientVec3, b: ClientVec3): ClientVec3 =>
  [f32(a[0] - b[0]), f32(a[1] - b[1]), f32(a[2] - b[2])];
const add = (a: ClientVec3, b: ClientVec3): ClientVec3 =>
  [f32(a[0] + b[0]), f32(a[1] + b[1]), f32(a[2] + b[2])];
const scale = (vector: ClientVec3, factor: number): ClientVec3 =>
  [f32(vector[0] * factor), f32(vector[1] * factor), f32(vector[2] * factor)];
function cross(a: ClientVec3, b: ClientVec3): ClientVec3 {
  return [
    f32(f32(a[1] * b[2]) - f32(a[2] * b[1])),
    f32(f32(a[2] * b[0]) - f32(a[0] * b[2])),
    f32(f32(a[0] * b[1]) - f32(a[1] * b[0])),
  ];
}
function normalize(vector: ClientVec3): ClientVec3 {
  const squared = f32(f32(f32(vector[0] * vector[0]) +
    f32(vector[1] * vector[1])) + f32(vector[2] * vector[2]));
  const length = f32(Math.sqrt(squared));
  return length !== 0 ? vector.map(value => f32(value / length)) as ClientVec3
    : [1, 1, 1];
}
function frameDistance(a: WorldVec3, b: WorldVec3): number {
  const x = f32(b.x - a.x), y = f32(b.y - a.y), z = f32(b.z - a.z);
  return f32(Math.sqrt(f32(f32(f32(x * x) + f32(z * z)) + f32(y * y))));
}
function sectionLength(frames: RouteFrame[]): number {
  let length = 0;
  for (let index = 0; index + 1 < frames.length; index++) {
    length = f32(length + f32(frameDistance(frames[index]!.position,
      frames[index + 1]!.position)));
  }
  return length;
}
const routeFrame = (frame: RoadFrame): RouteFrame => ({
  position: world(frame.position),
  forward: world(frame.storedForward),
  up: world(frame.up),
});
const copyFrame = (frame: RouteFrame): RouteFrame => ({
  position: { ...frame.position }, forward: { ...frame.forward }, up: { ...frame.up },
});
const reverseRoadFrame = (frame: RoadFrame): RoadFrame => ({
  ...frame, storedForward: scale(frame.storedForward, -1),
});

/** Selects the duplicate ToRoad object that contains the requested gate names. */
function matchingRoad(candidates: RoadObject[] | undefined,
  start: string | undefined, end: string | undefined): RoadObject | undefined {
  if (!candidates?.length) return;
  let selected = candidates[0]!;
  let bestScore = -1;
  for (const candidate of candidates) {
    const has = (name: string | undefined) =>
      name !== undefined && candidate.records.some(record => record.name === name);
    const score = Number(has(start)) * 2 + Number(has(end)) * 2 +
      Number(candidate.records.length > 0);
    if (score > bestScore) { selected = candidate; bestScore = score; }
  }
  return selected;
}

function roadGate(record: RoadRecord, reverse: boolean, final: boolean): RouteGate {
  if (record.gateIndices.length < 2 || record.frames.length === 0)
    throw new Error(`ToRoad 记录 ${record.name} 缺少检查门或路线帧。`);
  const [[a, b, c], [d, e, f]] = record.gateIndices as
    [[number, number, number], [number, number, number]];
  const point = (index: number): ClientVec3 => {
    const position = record.positions[index];
    if (!position) throw new Error(`ToRoad 记录 ${record.name} 的检查门索引越界。`);
    return position;
  };
  const firstOffset = scale(normalize(subtract(point(a), point(b))), 0.5);
  const secondOffset = scale(normalize(subtract(point(e), point(f))), 0.5);
  const first = reverse
    ? [point(b), point(a), add(point(c), firstOffset)]
    : [point(a), point(b), add(point(c), firstOffset)];
  const second = reverse
    ? [add(point(d), secondOffset), point(f), point(e)]
    : [add(point(d), secondOffset), point(e), point(f)];
  const normal = reverse ? scale(record.frames[0]!.storedForward, -1)
    : record.frames[0]!.storedForward;
  return {
    triangles: [first.map(world), second.map(world)],
    normal: world(normal), final, name: record.name,
  };
}

function reverseGraph(sections: PendingSection[]): void {
  const first = sections[0], last = sections[sections.length - 1];
  if (!first || !last) throw new Error("原版路线图为空。");
  const lastIndex = last.sequenceIndex;
  const exitGate = last.outgoing[0]?.gate;
  const entryGate = first.incoming[0]?.gate;
  const flipped = new Map<RouteGate, RouteGate>();
  const flip = (gate: RouteGate): RouteGate => {
    let replacement = flipped.get(gate);
    if (!replacement) {
      replacement = {
        ...gate,
        triangles: gate.triangles.map(([a, b, c]) => [a!, c!, b!]),
        normal: { x: -gate.normal.x, y: -gate.normal.y, z: -gate.normal.z },
        final: exitGate?.final && (gate === exitGate || gate === entryGate)
          ? gate === entryGate : gate.final,
      };
      flipped.set(gate, replacement);
    }
    return replacement;
  };
  for (const section of sections) {
    if (section.sequenceIndex !== 0)
      section.sequenceIndex = lastIndex - section.sequenceIndex + 1;
    [section.incoming, section.outgoing] = [section.outgoing, section.incoming];
    for (const edge of [...section.incoming, ...section.outgoing]) edge.gate = flip(edge.gate);
    section.frames = section.frames.slice().reverse().map(frame => ({
      ...frame,
      forward: { x: -frame.forward.x, y: -frame.forward.y, z: -frame.forward.z },
    }));
    section.length = sectionLength(section.frames);
  }
  sections.splice(1, sections.length - 1, ...sections.slice(1).reverse());
}

export function buildTrackCourseGraph(objects: TrackObject[], forceReverse: boolean): TrackCourseGraph {
  const course = objects.find(object => object.kind === "TrackObject" &&
    object.name === "track") as TrackPropertyObject | undefined;
  const root = course?.property?.children.find(child => child.name === "course");
  if (!root) throw new Error('TrackObject "track" 缺少原版 <course>。');
  const roads = new Map<string, RoadObject[]>();
  for (const object of objects) {
    if (object.kind !== "ToRoad") continue;
    const road = object as RoadObject;
    const candidates = roads.get(road.name);
    if (candidates) candidates.push(road);
    else roads.set(road.name, [road]);
  }
  const sections: PendingSection[] = [];
  const emptySection = (index: number): PendingSection => ({
    sequenceIndex: index, frames: [], length: 0, surface: "", outgoing: [], incoming: [],
  });
  const link = (sources: PendingSection[], target: PendingSection, gate: RouteGate): void => {
    if (sources.length === 0) {
      target.incoming.push({ gate, section: null });
      return;
    }
    for (const source of sources) {
      source.outgoing.push({ gate, section: target });
      target.incoming.push({ gate, section: source });
    }
  };

  const walk = (courseNode: XmlNode, output: PendingSection[], initialIndex: number,
    index: { value: number }, closeLoop: boolean): PendingSection[] => {
    let predecessors: PendingSection[] = [];
    let current = emptySection(initialIndex);
    index.value = initialIndex;
    for (const node of courseNode.children) {
      if (node.name === "plane") continue;
      if (node.name === "road") {
        const roadName = attribute(node, "name");
        const startName = attribute(node, "start");
        const endName = attribute(node, "end");
        const road = roadName ? matchingRoad(roads.get(roadName), startName, endName)
          : undefined;
        if (!road)
          throw new Error(`<course> 引用缺失的 ToRoad：${roadName ?? "<missing name>"}。`);
        const count = road.records.length;
        if (count === 0) throw new Error(`ToRoad ${road.name} 没有记录。`);
        const recordIndex = (name: string | undefined, fallback: number): number => {
          if (name === undefined) return fallback;
          const found = road.records.findIndex(record => record.name === name);
          return found < 0 ? fallback : found;
        };
        const first = recordIndex(startName, 0);
        const specifiedLast = recordIndex(endName, -1);
        const last = specifiedLast !== -1 ? specifiedLast
          : road.cyclic && first !== 0 ? first - 1 : count - 1;
        const final = recordIndex(attribute(node, "final"), -1);
        const reverse = /^(?:1|true|yes)$/i.test(attribute(node, "reverse") ?? "");
        const increment = reverse ? -1 : 1;
        let cursor = first;
        let visited = 0;
        for (;;) {
          const next = (cursor + increment + count) % count;
          const record = road.records[cursor]!;
          const gate = roadGate(record, reverse, cursor === final);
          link(predecessors, current, gate);
          if (!reverse) {
            current.frames = record.frames.map(routeFrame);
            current.surface = record.surface;
          } else {
            if (record.frames.length === 0)
              throw new Error(`ToRoad ${road.name}/${record.name} 缺少反向帧。`);
            for (let frame = record.frames.length - 1; frame >= 0; frame--)
              current.frames.push(routeFrame(reverseRoadFrame(record.frames[frame]!)));
            current.surface = record.surface;
          }
          current.length = sectionLength(current.frames);
          output.push(current);
          predecessors = [current];
          index.value++;
          current = emptySection(index.value);
          visited++;
          if (cursor === last) break;
          if (visited > count) throw new Error(`ToRoad ${road.name} 的循环范围无效。`);
          cursor = next;
        }
        continue;
      }
      if (node.name === "branch") {
        if (node.children.length === 0)
          throw new Error("<course><branch> 没有可安全表示的 alternative。");
        let highestIndex = initialIndex;
        const branchStart = index.value;
        node.children.forEach((alternative, alternativeIndex) => {
          const branchSections: PendingSection[] = [];
          const branchIndex = { value: branchStart };
          walk(alternative, branchSections, branchStart, branchIndex, false);
          if (branchSections.length === 0)
            throw new Error("<course><branch> alternative 没有路线段。");
          highestIndex = Math.max(highestIndex, branchIndex.value);
          const first = branchSections[0]!;
          const entry = first.incoming[0];
          if (!entry) throw new Error("branch alternative 首段缺少 entry gate。");
          first.incoming.length = 0;
          link(predecessors, first, entry.gate);
          const terminal = branchSections[branchSections.length - 1]!;
          terminal.incoming.forEach(edge => {
            const source = edge.section;
            const outgoing = source?.outgoing[0];
            if (!source || !outgoing)
              throw new Error("branch terminal incoming 缺少 source outgoing[0]。");
            outgoing.section = current;
          });
          const terminalEdge = terminal.incoming[0];
          if (!terminalEdge?.section)
            throw new Error("branch terminal 缺少可复制 incoming edge。");
          current.incoming.push({ gate: terminalEdge.gate, section: terminalEdge.section });
          output.push(...branchSections);
          if (alternativeIndex === 0) {
            current.frames = terminal.frames.map(copyFrame);
            current.length = sectionLength(current.frames);
          }
        });
        current.sequenceIndex = highestIndex - 1;
        output.push(current);
        predecessors = [current];
        index.value = highestIndex;
        current = emptySection(highestIndex);
      }
    }
    if (closeLoop) {
      const first = output[0], last = predecessors[0], gate = first?.incoming[0]?.gate;
      if (!first || !last || !gate) throw new Error("原版路线图无法闭环。");
      first.incoming[0]!.section = last;
      last.outgoing.push({ gate, section: first });
    }
    return predecessors;
  };

  walk(root, sections, 0, { value: 0 }, true);
  if (forceReverse) reverseGraph(sections);
  const first = sections[0], last = sections[sections.length - 1];
  if (!first || !last || first.frames.length === 0)
    throw new Error("原版路线图为空。");
  const indices = new Map(sections.map((section, index) => [section, index]));
  const edge = (pending: PendingEdge): RouteEdge => {
    if (pending.section === null)
      throw new Error("路线图完成后仍含 null edge target。");
    const index = indices.get(pending.section);
    if (index === undefined) throw new Error("路线边引用未保留的 section。");
    return { gate: pending.gate, section: index };
  };
  const finalSections = sections.map(section => ({
    sequenceIndex: section.sequenceIndex, frames: section.frames,
    length: section.length, surface: section.surface,
    outgoing: section.outgoing.map(edge), incoming: section.incoming.map(edge),
  }));
  const startFrame = first.frames[0]!;
  const clientPosition: ClientVec3 = [startFrame.position.x,
    -startFrame.position.z, startFrame.position.y];
  const clientForward: ClientVec3 = [startFrame.forward.x,
    -startFrame.forward.z, startFrame.forward.y];
  const right = normalize(cross(clientForward, [0, 0, 1]));
  const up = normalize(cross(right, clientForward));
  const startPosition = add(clientPosition, scale(clientForward, -0.05));
  const firstSection = indices.get(first), lastSection = indices.get(last);
  if (firstSection === undefined || lastSection === undefined)
    throw new Error("路线首尾 section 未保留。");
  return { sections: finalSections, firstSection, lastSection,
    start: { position: world(startPosition), forward: world(clientForward), up: world(up) } };
}
