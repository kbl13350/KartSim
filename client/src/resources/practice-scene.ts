import type { RoadCollisionTriangle } from "./track-road-extraction";
import type { TrackCourseGraph } from "./track-course-graph";

export const PRACTICE_SCENE_IDS = new Set(["pirate_P01", "maple_P01", "fengshen_P01", "mabi_P01"]);

/** pirate_P01 is a mission stage, without ToRoad or ground collision flags.
 * Give its existing island terrain collision for free exploration; never add
 * invisible floors or pretend that this scenery contains a race circuit. */
export function preparePracticeScene(model: any, trackId: string): void {
  if (!["pirate_P01", "fengshen_P01"].includes(trackId) || model.root.kind !== "track") return;
  const visit = (node: any): void => {
    if ((trackId === "pirate_P01" && ["Plane3391@s0", "Plane3391@s1", "섬@s0", "섬@s1"].includes(node.name)) ||
        (trackId === "fengshen_P01" && /^Object1667993700@s[0-4]$/.test(node.name))) {
      for (let index = 0; index < node.slots.length; index++) {
        const slot = node.slots[index];
        if (slot?.kind !== "texture") continue;
        const property = { name: "property", text: "", attributes: [],
          children: [{ name: "road", text: "", attributes: [], children: [] }] };
        const texture = { ...slot, property, propertyOccurrence: { encoding: "practice", id: -1, value: property } };
        node.slots[index] = texture;
        node.slotOccurrences[index] = { encoding: "practice", id: -1, value: texture };
      }
    }
    node.children?.forEach(visit);
  };
  visit(model.root.scene);
}

/** A safe respawn segment on the existing ground, with no finish gate. */
export function practiceSceneRoute(triangles: RoadCollisionTriangle[], trackId = "pirate_P01"): TrackCourseGraph {
  const area = (t: RoadCollisionTriangle) => Math.abs((t.b.x-t.a.x)*(t.c.z-t.a.z)-(t.c.x-t.a.x)*(t.b.z-t.a.z));
  const floor = triangles.filter(t => t.normal.y > .95 &&
    (trackId !== "pirate_P01" || ["Plane3391@s1", "섬@s1"].includes(t.origin.mesh.node.name)) &&
    (trackId !== "fengshen_P01" || /^Object1667993700@s[0-4]$/.test(t.origin.mesh.node.name)))
    .sort((a,b) => area(b)-area(a))[0];
  if (!floor) throw new Error("自由探索场景没有可安全落地的原始地面。");
  const mix = (a: number,b: number,c: number) => ({x: floor.a.x*a+floor.b.x*b+floor.c.x*c,
    y: floor.a.y*a+floor.b.y*b+floor.c.y*c, z: floor.a.z*a+floor.b.z*b+floor.c.z*c});
  const from=mix(.6,.2,.2), to=mix(.2,.6,.2);
  const length=Math.hypot(to.x-from.x,to.y-from.y,to.z-from.z);
  const forward={x:(to.x-from.x)/length,y:(to.y-from.y)/length,z:(to.z-from.z)/length};
  // The Fengshen island's longest triangle edge points into its rock wall.
  // Face across the open platform instead (verified against its real collision).
  if (trackId === "fengshen_P01") {
    const x=forward.x; forward.x=forward.z; forward.z=-x;
  }
  const up={x:0,y:1,z:0};
  const frame=(position: typeof from)=>({position,forward,up});
  // Degenerate gates deliberately cannot finish a mission scenery session.
  const gate={triangles:[[from,from,from],[from,from,from]],normal:forward,final:false,name:"practice-respawn"};
  return {sections:[{sequenceIndex:0,frames:[frame(from),frame(to)],length,surface:"",
    incoming:[{section:0,gate}],outgoing:[{section:0,gate}]}],firstSection:0,lastSection:0,start:frame(from)};
}
