import { Ft, T, s2 } from "../generated/formats.js";
import { U1 } from "../generated/library.js";

/**
 * Release art of the 驾照考试 pages on the 单人游戏 tab (stage_mainMenu.rho
 * riderSchool/): riderSchoolPage (the six steps of 新手 … L1), its
 * riderSchoolStepCard, riderSchoolPro1 (the PRO qualification) and
 * riderSchoolPro2 (the PRO missions), the RiderSchoolButton card frame of
 * gui_monocoque frame.bml and the textures they name.
 */

export interface RiderSchoolNode {
  name: string;
  attributes: Array<{ name: string; value: string }>;
  children: RiderSchoolNode[];
}
interface Texture { image: CanvasImageSource; width: number; height: number }
interface ResourceFile { bytes(): Promise<Uint8Array> }
interface Library { canonicalCandidates(path: string): ResourceFile[] }
export interface WindowFrame { texture: string }

export interface RiderSchoolArt {
  page: RiderSchoolNode;
  card: RiderSchoolNode;
  pro1: RiderSchoolNode;
  pro2: RiderSchoolNode;
  /** RiderSchoolButton: Normal, MouseOn, Clicked, Disabled. */
  frames: WindowFrame[];
  frameImages: Map<string, Texture>;
  /** Node textures, the four states of buttons. */
  textures: Map<RiderSchoolNode, Texture[]>;
}

export const RIDER_SCHOOL_ROOTS = ["stage_/mainMenu/riderSchool", "stage_/mainMenu", "stage_/common",
  "zeta_/cn/stage/mainMenu"];

/** "btn_x_@zz" + 2 → "btn_x_2@zz"; "btn_x_" + 2 → "btn_x_2". */
export function stateImageName(states: string, index: number): string {
  return /@zz$/.test(states) ? states.replace(/@zz$/, `${index}@zz`) : `${states}${index}`;
}

export async function loadRiderSchoolArt(library: Library,
  texture: (roots: string[], name: string) => Promise<Texture | undefined>,
  frames: () => Promise<RiderSchoolNode>): Promise<RiderSchoolArt> {
  const layout = async (name: string): Promise<RiderSchoolNode> =>
    s2(await (U1(library, ["stage_/mainMenu/riderSchool"], name, ".bml") as ResourceFile).bytes()) as
      RiderSchoolNode;
  const [page, card, pro1, pro2, frameTree] = await Promise.all([layout("riderSchoolPage@zz"),
    layout("riderSchoolStepCard"), layout("riderSchoolPro1"), layout("riderSchoolPro2"), frames()]);
  const textures = new Map<RiderSchoolNode, Texture[]>();
  const visit = async (node: RiderSchoolNode): Promise<void> => {
    const states = (T(node, "autoLoadImage") ?? T(node, "autoLoadImageBoard")) as string | undefined;
    const single = (T(node, "texture") ?? T(node, "image")) as string | undefined;
    if (states) {
      const loaded = await Promise.all([1, 2, 3, 4].map(index =>
        texture(RIDER_SCHOOL_ROOTS, stateImageName(states, index))));
      if (loaded.every(Boolean)) textures.set(node, loaded as Texture[]);
    } else if (single && single !== "blank") {
      const loaded = await texture(RIDER_SCHOOL_ROOTS, single);
      if (loaded) textures.set(node, [loaded]);
    }
    await Promise.all(node.children.map(visit));
  };
  await Promise.all([page, card, pro1, pro2].map(visit));
  const group = frameTree.children.find(child => child.name === "RiderSchoolButton");
  const cardFrames = (group?.children ?? []).map(child => Ft(child) as WindowFrame);
  const frameImages = new Map<string, Texture>();
  for (const frame of cardFrames) {
    if (!frame.texture || frameImages.has(frame.texture)) continue;
    const image = await texture(["gui_/monocoque"], frame.texture);
    if (image) frameImages.set(frame.texture, image);
  }
  return { page, card, pro1, pro2, frames: cardFrames, frameImages, textures };
}

/** The four states of a step card's mission icon (riderSchool/missionIcon_<icon>_1…4). */
export async function loadMissionIcon(texture: (roots: string[], name: string) => Promise<Texture | undefined>,
  icon: string): Promise<Texture[] | undefined> {
  const states = await Promise.all([1, 2, 3, 4].map(index =>
    texture(RIDER_SCHOOL_ROOTS, `${icon}_${index}`)));
  return states.every(Boolean) ? states as Texture[] : undefined;
}
