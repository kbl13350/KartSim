/**
 * Dev-only preview of the item race presenter (tools/item-fx-preview.html,
 * not part of the game build): loads the original item resources straight
 * from the dev server's mirror and plays every item between three dummy
 * karts — A (the local racer, blue), B (green) and C (red) — by calling the
 * presenter the way the race controller does.
 *
 *   npm run dev → http://127.0.0.1:8780/tools/item-fx-preview.html
 *   (?item=rocket starts one scenario, ?item=special:99 one special item,
 *   ?move=1 lets the karts drive)
 *
 * Every special item of ITEM_MODE.md C.4 has its own button (staged by its
 * presentation family, from its own folder and variant), and the hit
 * variants (two missiles, balloon, headband, lucci bonus, equipment
 * defence, eating) have theirs.
 */

import {
  BoxGeometry, ConeGeometry, GridHelper, Group, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene,
  Vector3, WebGLRenderer,
} from "three";
import { RhoReader } from "../codecs/rho";
import { Rho5Reader } from "../codecs/rho5";
import { c5, ha, rn, y9 } from "../generated/formats.js";
import { Q9, S9, Sw, he } from "../generated/library.js";
import type { Rho5ArchiveIndex, RhoArchiveIndex } from "../resources/archive-index";
import type { ArchiveSource } from "../resources/container-store";
import { uniqueOriginalCoinAsset } from "../vehicle/track-coin-source";
import { ItemIdx, loadItemCatalog, type ItemCatalogLibrary } from "./item-catalog";
import type { FxModelData, ItemFxOps } from "./item-fx-assets";
import { ITEM_FX_FAMILY } from "./item-fx-plan";
import { applyItemKartPresentation } from "./item-kart-presentation";
import {
  loadItemRacePresenter, type ItemPresenterPose, type ItemPresenterVec3, type ItemRacePresenter,
} from "./item-race-presenter";
import { SPECIAL_ITEM_ROWS, withSpecialItems } from "./item-special-fixture";

/** Mount folders of the containers the presenter reads (the game takes them from aaa.pk). */
const containers: Record<string, string> = {
  "item.rho": "item/",
  "sound_fx_item.rho": "sound_/fx/item/",
  "sound_fx_charger.rho": "sound_/fx/charger/",
  "theme_common.rho": "theme_/common/",
};
const dataPacks = ["DataPack1"];

interface PreviewFile {
  name: string; extension: string; virtualPath: string; canonicalPath: string;
  sourceName: string; sourceKind: string; containerId: string; absenceAuthoritative: boolean;
  bytes(): Promise<Uint8Array>; text(): Promise<string>;
}

type PreviewLibrary = ItemCatalogLibrary & { exactCanonicalCandidates(path: string): PreviewFile[] };

function status(text: string): void {
  document.getElementById("status")!.textContent = text;
}

async function fetchSource(name: string): Promise<ArchiveSource> {
  const response = await fetch(`/p3553/${name}`);
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
  const buffer = await response.arrayBuffer();
  return {
    name, size: buffer.byteLength,
    arrayBuffer: async () => buffer.slice(0),
    slice: (start = 0, end = buffer.byteLength) => ({ arrayBuffer: async () => buffer.slice(start, end) }),
  };
}

function decodeText(bytes: Uint8Array): string {
  return bytes[0] === 0xff && bytes[1] === 0xfe
    ? new TextDecoder("utf-16le").decode(bytes.subarray(2)) : new TextDecoder().decode(bytes);
}

async function loadLibrary(): Promise<PreviewLibrary> {
  status("读取资源索引…");
  const compressed = await (await fetch("/__p3553/archive-index")).arrayBuffer();
  const json = await new Response(new Blob([compressed]).stream()
    .pipeThrough(new DecompressionStream("deflate"))).text();
  const index = JSON.parse(json, (_key, value: unknown) =>
    value && typeof value === "object" && "$u8" in value && typeof value.$u8 === "string"
      ? Uint8Array.from(atob(value.$u8), char => char.charCodeAt(0)) : value) as
    { rho: RhoArchiveIndex[]; rho5: Rho5ArchiveIndex[] };
  const files: PreviewFile[] = [];
  // Whole containers are loaded, so a file missing from one is really absent.
  const file = (path: string, canonical: string, sourceName: string, sourceKind: string,
    containerId: string, bytes: () => Promise<Uint8Array>): PreviewFile => {
    const name = path.split("/").at(-1)!;
    return { name, extension: name.split(".").at(-1)!.toLowerCase(), virtualPath: canonical,
      canonicalPath: canonical, sourceName, sourceKind, containerId, absenceAuthoritative: true,
      bytes, text: async () => decodeText(await bytes()) };
  };
  for (const [name, folder] of Object.entries(containers)) {
    status(`下载 ${name}…`);
    const entry = index.rho.find(archive => archive.name === name)!;
    const reader = new RhoReader(await fetchSource(name), entry);
    for (const record of reader.files) files.push(file(record.path, `${folder}${record.path}`,
      name, "rho", `rho:${name.replace(/\.rho$/i, "").toLowerCase()}`, () => reader.read(record.path)));
  }
  for (const name of dataPacks) {
    status(`下载 ${name}…`);
    const group = index.rho5.find(entry => entry.name === name)!;
    const reader = new Rho5Reader(group, await Promise.all(group.parts.map(part => fetchSource(part.name))));
    for (const record of reader.files) {
      const part = group.parts.find(entry => entry.id === record.partId)!;
      files.push(file(record.path, record.path, part.name, "rho5", `rho5:${name.toLowerCase()}`,
        () => reader.read(record.path)));
    }
  }
  return new Sw({ files, archives: [], errors: [], warnings: [], region: "cn",
    manifestAvailable: false, manifestMountPaths: new Set(),
    archiveIndexes: { rho: [], rho5: [] } }) as unknown as PreviewLibrary;
}

interface Kart { id: string; base: Vector3; color: number; view: Group }

/** A dummy kart: a box with a cone on its nose (+z), origin on the ground. */
function dummyKart(id: string, base: Vector3, color: number): Kart {
  const view = new Group();
  const body = new Mesh(new BoxGeometry(1.6, 0.8, 2.4), new MeshBasicMaterial({ color }));
  body.position.y = 0.4;
  const nose = new Mesh(new ConeGeometry(0.4, 0.9, 12), new MeshBasicMaterial({ color: 0xffffff }));
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 0.6, 1.5);
  view.add(body, nose);
  return { id, base, color, view };
}

/** The controller-side calls a scenario makes. */
type Events = Pick<ItemRacePresenter, "used" | "placed" | "hit" | "removed" | "kartEffect" | "endKartEffect">;
type Step = [atMs: number, run: (presenter: Events, now: number) => void];
const TRACK_HAZARDS: readonly number[] = [ItemIdx.mine, ItemIdx.waterMine];

/**
 * A special item staged by its family the way the race controller drives it
 * (A uses it; B is ahead, C further ahead).
 */
function specialSteps(idx: number, lifeOf: (state: string) => number,
  at: (id: string, ahead: number, side?: number) => ItemPresenterVec3): Step[] {
  const family = ITEM_FX_FAMILY.get(idx);
  const affect = lifeOf("Affect") || lifeOf("AffectMain") || lifeOf("StateAffect") || 2000;
  // The karts' poses exist once the preview runs: points are taken when a step runs.
  const use = (targets: string[], etaMs = 1000, extra: () => object = () => ({})): Step =>
    [0, (p, t) => p.used({ useId: 0, itemId: idx, userId: "A", targets, startMs: t, etaMs, ...extra() })];
  const hit = (victim: string, kind: Parameters<Events["kartEffect"]>[1] | undefined, ms: number,
    durationMs = affect): Step => [ms, (p, t) => {
    p.hit({ useId: 0, itemId: idx, victimId: victim, result: "hit", atMs: t });
    if (kind) p.kartEffect(victim, kind, t, durationMs);
  }];
  switch (family) {
    case "rocket": return [use(["B"], 800), hit("B", "launch", 800, 1500)];
    case "blindRocket":
      return [use(["B"], 800), hit("B", idx === 134 ? "spin" : "slow", 800)];
    case "lockdown": return [use(["B"], 800), hit("B", "hold", 800, lifeOf("AffectMain")),
      hit("C", "slow", 1300, lifeOf("AffectSub"))];
    case "fly": return idx === 132 ? [use(["B"], 1200), hit("B", "slow", 1200)]
      : [use(["B"], 1200), hit("B", "trap", 1200),
        [1200 + affect, (p, t) => p.kartEffect("B", "escapeShield", t, lifeOf("EscapeAffect"))]];
    case "bombFly": {
      const blast = 1200 + lifeOf("CountDown");
      return [use(["B"], 1200), hit("B", "trap", blast, 2000), hit("C", "trap", blast, 2000),
        [blast + 2000, (p, t) => p.kartEffect("B", "escapeShield", t, lifeOf("EscapeAffect"))]];
    }
    case "beam": return [use(["B"], 1500), hit("B", idx === 112 ? "shrink" : "hold", 1500)];
    case "drop": {
      const kind = idx === 25 ? "knockback" : idx === 8 || idx === 85 ? "spin"
        : idx === 37 ? "trap" : idx === 46 ? undefined : "launch";
      return [[0, (p, t) => p.used({ useId: 0, itemId: idx, userId: "B", targets: [], startMs: t, etaMs: 0,
        point: at("B", -5) })], hit("A", kind, 3000)];
    }
    case "throw": return [use([], 0, () => ({ point: at("B", 0) })), hit("B", "trap", lifeOf("Use")),
      [lifeOf("Use") + affect, (p, t) => p.kartEffect("B", "escapeShield", t, lifeOf("EscapeAffect") || 2000)]];
    case "timeBomb": return [
      [0, (p, t) => {
        p.used({ useId: 0, itemId: idx, userId: "A", targets: [], startMs: t, etaMs: 0 });
        p.kartEffect("A", "timeBomb", t, lifeOf("Use"));
      }],
      [lifeOf("Use"), (p, t) => {
        p.placed({ useId: 0, itemId: idx, userId: "A", point: at("A", 0), startMs: t - lifeOf("Use") });
        p.hit({ useId: 0, itemId: idx, victimId: "B", result: "hit", atMs: t });
        p.kartEffect("B", "trap", t, affect);
      }]];
    case "barricade": return [use(["C"], 0),
      [200, (p, t) => p.placed({ useId: 0, itemId: idx, userId: "C", point: at("C", 25), startMs: t - 200 })],
      hit("C", "hold", 3000, lifeOf("StateAffect"))];
    case "cloud": return [[0, (p, t) => p.used({ useId: 0, itemId: idx, userId: "C", targets: ["A", "B"],
      startMs: t, etaMs: 0 })]];
    case "curse": return [use(["B", "C"], 0),
      [lifeOf("Use") + lifeOf("Preaffect"), (p, t) => {
        for (const victim of ["B", "C"]) p.kartEffect(victim, "reverse", t, affect);
      }]];
    case "magnet": return [[0, (p, t) => {
      p.used({ useId: 0, itemId: idx, userId: "A", targets: ["B"], startMs: t, etaMs: 0 });
      p.kartEffect("A", "pull", t, lifeOf("Use"));
      p.kartEffect("A", "shield", t, lifeOf("Use"));
    }]];
    case "invincible": return [use(["A"], 0)];
    case "invisible": return [use(["A"], 0), [lifeOf("Use"), (p, t) => {
      p.kartEffect("A", "invisible", t, affect, { visibleToMe: true });
    }]];
    case "siren": return [use(["A"], 0), hit("B", "spin", 600, affect)];
    default: return [use(["A"], 0)];
  }
}

async function main(): Promise<void> {
  const library = await loadLibrary();
  status("载入道具目录与表现层…");
  const catalog = await withSpecialItems(await loadItemCatalog(library), library);
  const audio = new AudioContext();
  const ops: ItemFxOps<PreviewLibrary> = {
    originalAsset: (archive, path) => uniqueOriginalCoinAsset(archive, path),
    decodeModel: bytes => y9(bytes) as FxModelData,
    decodeAudio: (context, bytes) => Q9(context, bytes),
    loadModel: (data, archive, path, identity, options) => c5(data, archive, path, identity, options),
    routeAudio: (context, source, group, gain, panner) => S9(context, source, group, gain, panner),
    setGain: (param, value, time) => he(param, value, time),
  };
  const environment = await rn.load(library);
  const presenter = await loadItemRacePresenter(library, catalog, environment, new ha(), audio as never, ops);

  const canvas = document.getElementById("view") as HTMLCanvasElement;
  const renderer = new WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(1);
  renderer.setSize(1600, 900, false);
  renderer.setClearColor(0x6f8fb0);
  const scene = new Scene();
  scene.add(new GridHelper(400, 80, 0x2a3a4a, 0x445566), presenter.object);
  const camera = new PerspectiveCamera(60, 16 / 9, 0.5, 2000);
  const karts = [
    dummyKart("A", new Vector3(0, 0, 0), 0x3070ff),
    dummyKart("B", new Vector3(0, 0, 24), 0x30c060),
    dummyKart("C", new Vector3(-7, 0, 42), 0xe04040),
  ];
  for (const kart of karts) scene.add(kart.view);
  Object.assign(window, { itemFxPreview: { presenter, scene, camera, renderer } });

  const query = new URLSearchParams(location.search);
  let moving = query.get("move") === "1";
  let travel = 0;
  const poses = new Map<string, ItemPresenterPose>();
  const pose = (id: string) => poses.get(id)!;
  const at = (id: string, ahead: number, side = 0): ItemPresenterVec3 => {
    const { position } = pose(id);
    return { x: position.x + side, y: position.y, z: position.z + ahead };
  };

  const scenarios: Record<string, { label: string; steps: Step[] }> = {
    rocket: { label: "导弹", steps: [
      [0, (p, t) => p.used({ useId: 0, itemId: ItemIdx.rocket, userId: "A", targets: ["B"], startMs: t, etaMs: 800 })],
      [800, (p, t) => { p.hit({ useId: 0, itemId: ItemIdx.rocket, victimId: "B", result: "hit", atMs: t }); }],
    ] },
    rocketShield: { label: "导弹被护盾挡", steps: [
      [0, (p, t) => p.used({ useId: 0, itemId: ItemIdx.shield, userId: "B", targets: ["B"], startMs: t, etaMs: 0 })],
      [300, (p, t) => p.used({ useId: 1, itemId: ItemIdx.rocket, userId: "A", targets: ["B"], startMs: t, etaMs: 800 })],
      [1100, (p, t) => {
        p.hit({ useId: 1, itemId: ItemIdx.rocket, victimId: "B", result: "blocked", by: "shield", atMs: t });
        p.endKartEffect("B", "shield");
      }],
    ] },
    guideRocket: { label: "追踪导弹", steps: [
      [0, (p, t) => p.used({ useId: 0, itemId: ItemIdx.guideRocket, userId: "A", targets: ["C"], startMs: t, etaMs: 1200 })],
      [1200, (p, t) => p.hit({ useId: 0, itemId: ItemIdx.guideRocket, victimId: "C", result: "hit", atMs: t })],
    ] },
    randomRocket: { label: "随机导弹", steps: [
      [0, (p, t) => p.used({ useId: 0, itemId: ItemIdx.randomRocket, userId: "A", targets: ["B"], startMs: t, etaMs: 700 })],
      [700, (p, t) => p.hit({ useId: 0, itemId: ItemIdx.randomRocket, victimId: "B", result: "hit", atMs: t })],
    ] },
    misfire: { label: "哑弹", steps: [
      [0, (p, t) => p.used({ useId: 0, itemId: ItemIdx.rocket, userId: "A", targets: [], startMs: t, etaMs: 0 })],
    ] },
    waterFly: { label: "水苍蝇", steps: [
      [0, (p, t) => p.used({ useId: 0, itemId: ItemIdx.waterFly, userId: "A", targets: ["B"], startMs: t, etaMs: 1200 })],
      [1200, (p, t) => {
        p.hit({ useId: 0, itemId: ItemIdx.waterFly, victimId: "B", result: "hit", atMs: t });
        p.kartEffect("B", "trap", t, 1000);
      }],
      [2200, (p, t) => p.kartEffect("B", "escapeShield", t, 2000)],
    ] },
    ufo: { label: "飞碟", steps: [
      [0, (p, t) => p.used({ useId: 0, itemId: ItemIdx.ufo, userId: "A", targets: ["C"], startMs: t, etaMs: 0 })],
      [1500, (p, t) => {
        p.hit({ useId: 0, itemId: ItemIdx.ufo, victimId: "C", result: "hit", atMs: t });
        p.kartEffect("C", "slow", t, 3000);
      }],
    ] },
    ufoEmp: { label: "飞碟被电磁波解除", steps: [
      [0, (p, t) => p.used({ useId: 0, itemId: ItemIdx.ufo, userId: "A", targets: ["C"], startMs: t, etaMs: 0 })],
      [1500, (p, t) => {
        p.hit({ useId: 0, itemId: ItemIdx.ufo, victimId: "C", result: "hit", atMs: t });
        p.kartEffect("C", "slow", t, 3000);
      }],
      [2000, (p, t) => p.used({ useId: 1, itemId: ItemIdx.emp, userId: "C", targets: ["C"], startMs: t, etaMs: 0 })],
      // EMP acts from its Affect state (+500) and only on racers really under a UFO (C.1, C.5).
      [2500, (p, t) => {
        p.endKartEffect("C", "slow", { tail: false });
        p.kartEffect("C", "emp", t, 1500);
      }],
    ] },
    magnet: { label: "磁铁", steps: [
      [0, (p, t) => {
        p.used({ useId: 0, itemId: ItemIdx.magnet, userId: "A", targets: ["B"], startMs: t, etaMs: 0 });
        p.kartEffect("A", "pull", t, 3000);
      }],
    ] },
    banana: { label: "香蕉皮", steps: [
      [0, (p, t) => p.used({ useId: 0, itemId: ItemIdx.banana, userId: "B", targets: [], startMs: t, etaMs: 0,
        point: at("B", -4) })],
      [3000, (p, t) => {
        p.hit({ useId: 0, itemId: ItemIdx.banana, victimId: "A", result: "hit", atMs: t });
        p.removed(0);
        p.kartEffect("A", "spin", t, 2000);
      }],
    ] },
    waterBomb: { label: "水炸弹", steps: [
      [0, (p, t) => p.used({ useId: 0, itemId: ItemIdx.waterBomb, userId: "A", targets: [], startMs: t, etaMs: 0,
        point: at("B", 0) })],
      [1000, (p, t) => {
        p.hit({ useId: 0, itemId: ItemIdx.waterBomb, victimId: "B", result: "hit", atMs: t });
        p.kartEffect("B", "trap", t, 2000);
      }],
      [3000, (p, t) => p.kartEffect("B", "escapeShield", t, 2000)],
    ] },
    timeBomb: { label: "定时水炸弹", steps: [
      [0, (p, t) => {
        p.used({ useId: 0, itemId: ItemIdx.timeBomb, userId: "A", targets: [], startMs: t, etaMs: 0 });
        p.kartEffect("A", "timeBomb", t, 3000);
      }],
      [3000, (p, t) => {
        p.placed({ useId: 0, itemId: ItemIdx.timeBomb, userId: "A", point: at("A", 0), startMs: t - 3000 });
        p.hit({ useId: 0, itemId: ItemIdx.timeBomb, victimId: "A", result: "hit", atMs: t });
        p.kartEffect("A", "trap", t, 2000);
      }],
      [5000, (p, t) => p.kartEffect("A", "escapeShield", t, 2000)],
    ] },
    barricade: { label: "路障", steps: [
      [0, (p, t) => p.used({ useId: 0, itemId: ItemIdx.barricade, userId: "A", targets: ["C"], startMs: t, etaMs: 0 })],
      [200, (p, t) => p.placed({ useId: 0, itemId: ItemIdx.barricade, userId: "C", point: at("C", 25),
        startMs: t - 200 })],
      [4000, (p, t) => {
        p.hit({ useId: 0, itemId: ItemIdx.barricade, victimId: "C", result: "hit", atMs: t });
        p.kartEffect("C", "barrier", t, 500);
      }],
    ] },
    cloud2: { label: "乌云", steps: [
      [0, (p, t) => p.used({ useId: 0, itemId: ItemIdx.cloud2, userId: "C", targets: ["A", "B"], startMs: t, etaMs: 0 })],
    ] },
    thunderbolt: { label: "闪电", steps: [
      [0, (p, t) => p.used({ useId: 0, itemId: ItemIdx.thunderbolt, userId: "A", targets: ["B", "C"], startMs: t, etaMs: 0 })],
      [2100, (p, t) => {
        for (const victim of ["B", "C"]) {
          p.hit({ useId: 0, itemId: ItemIdx.thunderbolt, victimId: victim, result: "hit", atMs: t });
          p.kartEffect(victim, "shrink", t, 1500);
        }
      }],
    ] },
    devil: { label: "大魔王", steps: [
      [0, (p, t) => p.used({ useId: 0, itemId: ItemIdx.devil, userId: "B", targets: ["A", "C"], startMs: t, etaMs: 0 })],
      [1500, (p, t) => { for (const victim of ["A", "C"]) p.kartEffect(victim, "reverse", t, 3000); }],
    ] },
    shield: { label: "护盾", steps: [
      [0, (p, t) => p.used({ useId: 0, itemId: ItemIdx.shield, userId: "A", targets: ["A"], startMs: t, etaMs: 0 })],
    ] },
    angel: { label: "天使", steps: [
      [0, (p, t) => p.used({ useId: 0, itemId: ItemIdx.angel, userId: "A", targets: ["A", "C"], startMs: t, etaMs: 0 })],
    ] },
    emp: { label: "电磁波（无人中飞碟：无效果）", steps: [
      [0, (p, t) => p.used({ useId: 0, itemId: ItemIdx.emp, userId: "C", targets: ["C"], startMs: t, etaMs: 0 })],
    ] },
    scanning: { label: "透视镜", steps: [
      [0, (p, t) => p.used({ useId: 0, itemId: ItemIdx.scanning, userId: "A", targets: ["A", "C"], startMs: t, etaMs: 0 })],
    ] },
    slotLock: { label: "道具锁", steps: [
      [0, (p, t) => p.used({ useId: 0, itemId: ItemIdx.slotLock, userId: "A", targets: ["B", "C"], startMs: t, etaMs: 0 })],
    ] },
    rocketTwice: { label: "双发导弹", steps: [
      [0, (p, t) => p.used({ useId: 0, itemId: ItemIdx.rocket, userId: "A", targets: ["B"], startMs: t, etaMs: 800,
        count: 2 })],
      [800, (p, t) => { p.hit({ useId: 0, itemId: ItemIdx.rocket, victimId: "B", result: "hit", atMs: t, shot: 0 }); }],
      [1000, (p, t) => { p.hit({ useId: 0, itemId: ItemIdx.rocket, victimId: "B", result: "hit", atMs: t, shot: 1 }); }],
    ] },
    balloon: { label: "气球挡导弹", steps: [
      [0, (p, t) => p.used({ useId: 0, itemId: ItemIdx.rocket, userId: "A", targets: ["B"], startMs: t, etaMs: 800 })],
      [800, (p, t) => {
        p.hit({ useId: 0, itemId: ItemIdx.rocket, victimId: "B", result: "hit", atMs: t, variant: "balloon" });
        p.kartEffect("B", "launch", t, 1000);
      }],
    ] },
    headband: { label: "头饰缩短飞碟", steps: [
      [0, (p, t) => p.used({ useId: 0, itemId: ItemIdx.ufo, userId: "A", targets: ["C"], startMs: t, etaMs: 1000 })],
      [1000, (p, t) => {
        p.hit({ useId: 0, itemId: ItemIdx.ufo, victimId: "C", result: "hit", atMs: t, variant: "headband" });
        p.kartEffect("C", "slow", t, 1500);
      }],
    ] },
    ufoBonus: { label: "奇奇飞碟金币", steps: [
      [0, (p, t) => p.used({ useId: 0, itemId: ItemIdx.ufo, userId: "A", targets: ["C"], startMs: t, etaMs: 1000 })],
      [1000, (p, t) => {
        p.hit({ useId: 0, itemId: ItemIdx.ufo, victimId: "C", result: "hit", atMs: t, variant: "bonus" });
        p.kartEffect("C", "slow", t, 3000);
      }],
    ] },
    devilDefence: { label: "车辆防御大魔王", steps: [
      [0, (p, t) => p.used({ useId: 0, itemId: ItemIdx.devil, userId: "B", targets: ["A", "C"], startMs: t, etaMs: 0 })],
      [1500, (p, t) => {
        p.hit({ useId: 0, itemId: ItemIdx.devil, victimId: "A", result: "blocked", by: "kart", atMs: t });
        p.kartEffect("C", "reverse", t, 3000);
      }],
    ] },
    bananaEat: { label: "吃掉香蕉皮", steps: [
      [0, (p, t) => p.used({ useId: 0, itemId: ItemIdx.banana, userId: "B", targets: [], startMs: t, etaMs: 0,
        point: at("B", -4) })],
      [3000, (p, t) => {
        p.hit({ useId: 0, itemId: ItemIdx.banana, victimId: "A", result: "blocked", by: "eat", atMs: t });
        p.removed(0);
      }],
    ] },
    mineEatBonus: { label: "吃掉地雷得金币", steps: [
      [0, (p, t) => p.hit({ useId: 0, itemId: ItemIdx.mine, victimId: "A", result: "blocked", by: "eat",
        variant: "bonus", atMs: t })],
    ] },
    hazards: { label: "地雷/水雷", steps: [
      [0, (p, t) => {
        p.hit({ useId: 0, itemId: ItemIdx.mine, victimId: "B", result: "hit", atMs: t });
        p.kartEffect("B", "launch", t, 1500);
        p.hit({ useId: 0, itemId: ItemIdx.waterMine, victimId: "C", result: "hit", atMs: t, position: at("C", 3) });
        p.kartEffect("C", "trap", t, 2000);
      }],
    ] },
  };

  for (const row of SPECIAL_ITEM_ROWS) {
    const definition = catalog.get(row.idx);
    if (!definition) continue;
    const lifeOf = (state: string) => definition.states.get(state)?.lifeMs ?? 0;
    scenarios[`special:${row.idx}`] = { label: `${row.idx} ${definition.title}`,
      steps: specialSteps(row.idx, lifeOf, at) };
  }

  // Scripted steps run on the presenter clock; each scenario gets fresh use ids.
  let pending: Array<{ atMs: number; run: (now: number) => void }> = [];
  let nextUse = 1;
  const play = (key: string, startMs: number) => {
    const scenario = scenarios[key]!;
    const base = nextUse;
    nextUse += 10;
    const shift = <T extends { useId: number }>(event: T): T => ({ ...event, useId: event.useId + base });
    const shifted: Events = {
      used: event => presenter.used(shift(event)),
      placed: event => presenter.placed(shift(event)),
      hit: event => presenter.hit(event.useId === 0 && TRACK_HAZARDS.includes(event.itemId) ? event : shift(event)),
      removed: useId => presenter.removed(useId + base),
      kartEffect: (...args) => presenter.kartEffect(...args),
      endKartEffect: (...args) => presenter.endKartEffect(...args),
    };
    for (const [offset, run] of scenario.steps)
      pending.push({ atMs: startMs + offset, run: now => run(shifted, now) });
  };

  const controls = document.getElementById("controls")!;
  const button = (label: string, action: () => void) => {
    const element = document.createElement("button");
    element.textContent = label;
    element.onclick = () => { void audio.resume(); action(); };
    controls.append(element);
  };
  for (const [key, scenario] of Object.entries(scenarios))
    button(scenario.label, () => play(key, Math.floor(performance.now())));
  button("全部依次", () => {
    const now = Math.floor(performance.now());
    Object.keys(scenarios).forEach((key, index) => play(key, now + index * 6000));
  });
  button("行驶/停车", () => { moving = !moving; });
  button("清除", () => { pending = []; presenter.reset(); });
  const first = query.get("item");
  if (first && scenarios[first]) play(first, Math.floor(performance.now()) + 500);

  let last = performance.now();
  const frame = (time: number) => {
    const now = Math.floor(time);
    if (moving) travel = (travel + (time - last) * 0.012) % 160;
    last = time;
    for (const kart of karts) {
      const position = kart.base.clone().add(new Vector3(0, 0, travel));
      kart.view.position.copy(position);
      kart.view.visible = true;
      applyItemKartPresentation({ root: kart.view }, presenter.kartPresentation(kart.id, now));
      poses.set(kart.id, { position: { x: position.x, y: position.y, z: position.z },
        forward: { x: 0, y: 0, z: 1 }, up: { x: 0, y: 1, z: 0 }, right: { x: 1, y: 0, z: 0 } });
    }
    camera.position.set(9, 7, travel - 9);
    camera.lookAt(-2, 1, travel + 20);
    camera.updateMatrixWorld(true);
    const due = pending.filter(step => step.atMs <= now);
    pending = pending.filter(step => step.atMs > now);
    for (const step of due) step.run(step.atMs);
    presenter.update({ nowMs: now, camera, width: 1600, height: 900, localPlayerId: "A",
      pose: id => poses.get(id) });
    renderer.render(scene, camera);
    const active = presenter.visuals.length;
    status(`${active} 个效果，${pending.length} 步待播；A 蓝（本机）B 绿 C 红`);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

main().catch(error => {
  console.error(error);
  status(`失败：${error instanceof Error ? error.message : String(error)}`);
});
