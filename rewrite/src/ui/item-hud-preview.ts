/**
 * Dev-only preview of the item race HUD (tools/item-hud-preview.html, not
 * part of the game build): loads the original resources straight from the
 * dev server's mirror, then plays a scripted ItemHudState timeline through
 * the real slot builder, ItemHud layer and overlay renderer.
 *
 *   npm run dev → http://127.0.0.1:8780/tools/item-hud-preview.html
 *   (?t=9500 freezes the 20 s timeline, ?all=1 shows everything, ?slots=3)
 */

import { PerspectiveCamera, WebGLRenderer } from "three";
import { RhoReader } from "../codecs/rho";
import { Rho5Reader } from "../codecs/rho5";
import { T, d5, dn, dt, j2, l5, lt, p2, s2, y9 } from "../generated/formats.js";
import { Iw, Rw, Sw, U1, fn } from "../generated/library.js";
import type { Rho5ArchiveIndex, RhoArchiveIndex } from "../resources/archive-index";
import type { ArchiveSource } from "../resources/container-store";
import { giantControllerDuration } from "./giant-boost-hud-model";
import type { HudNode } from "./item-hud-assets";
import { ItemHud, type ItemHudDependencies, type ItemHudRankSource } from "./item-hud";
import { collectItemHudPlayPanels, finalizeItemHudPlayPanels } from "./item-hud-play-panels";
import { defaultItemHudOptions } from "./item-hud-options";
import { emptyItemHudState, type ItemHudState } from "./item-hud-state";
import { ITEM_HUD_FONT_FAMILY } from "./item-hud-text";
import { buildItemSlotCommands, loadItemSlotDefinition, type ItemSlotDependencies } from "./item-slot-hud";
import { itemSlotInput } from "./multiplayer-race-hud";

const containers = ["item.rho", "stage_common.rho", "stage_speedIndiGame.rho",
  "gui_windowTemplate.rho", "gui_font.rho"];
const dataPacks = ["DataPack1"];

interface PreviewFile {
  name: string; extension: string; virtualPath: string; canonicalPath: string;
  sourceName: string; sourceKind: string; containerId: string;
  bytes(): Promise<Uint8Array>; text(): Promise<string>;
}

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

/** `stage_speedIndiGame.rho` → `stage_/speedIndiGame/`, `item.rho` → `item/`. */
function folderOf(container: string): string {
  const stem = container.replace(/\.rho$/i, "");
  const split = stem.indexOf("_");
  return split < 0 ? `${stem}/` : `${stem.slice(0, split + 1)}/${stem.slice(split + 1)}/`;
}

interface PreviewLibrary { canonicalCandidates(path: string): PreviewFile[] }

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
  // Source identities as the game's library gives them (scene assembly checks
  // that etc_/toon.png comes from DataPack1_00001.rho5 in rho5:datapack1).
  const file = (path: string, canonical: string, sourceName: string, sourceKind: string,
    containerId: string, bytes: () => Promise<Uint8Array>): PreviewFile => {
    const name = path.split("/").at(-1)!;
    return { name, extension: name.split(".").at(-1)!.toLowerCase(), virtualPath: canonical,
      canonicalPath: canonical, sourceName, sourceKind, containerId,
      bytes, text: async () => decodeText(await bytes()) };
  };
  for (const name of containers) {
    status(`下载 ${name}…`);
    const entry = index.rho.find(archive => archive.name === name)!;
    const reader = new RhoReader(await fetchSource(name), entry);
    for (const record of reader.files) files.push(file(record.path, `${folderOf(name)}${record.path}`,
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

const attribute = T as (node: HudNode, name: string) => string | undefined;

function hudDependencies(): ItemHudDependencies {
  return {
    attribute, numbers: j2, parseBml: s2, decodeTexture: p2, findResource: U1,
    geometry: lt, place: l5, createRenderer: () => new fn(new Map()),
    cloud: {
      attribute, parseBml: s2, findResource: U1, parseModel: y9,
      collectPlayPanels: collectItemHudPlayPanels as never,
      finalizePlay: finalizeItemHudPlayPanels as never,
      loadPlayScene: (binding, library) => Rw(binding, library, { convertClientCoordinates: false }),
      createPlayRuntime: (binding, scene, tick) => new Iw(binding, scene, tick),
      createRenderer: runtimes => new fn(runtimes),
      makeUi: d5, layoutUi: dn, materialize: dt, controllerDuration: giantControllerDuration,
      createCamera: () => new PerspectiveCamera(),
    },
    warn: message => { console.warn(message); status(message); },
  };
}

const slotDependencies: ItemSlotDependencies = {
  attribute, numbers: j2, parseBml: s2, decodeTexture: p2,
  findResource(library, path, container) {
    const found = (library as PreviewLibrary).canonicalCandidates(path)
      .filter(entry => entry.sourceName.toLowerCase() === container.toLowerCase());
    if (found.length !== 1) throw new Error(`${path} 必须来自 ${container}`);
    return found[0]!;
  },
};

/** The scripted 20 s loop, or everything at once. */
function scenario(t: number, capacity: 2 | 3, all: boolean): ItemHudState {
  const at = (offset: number) => Math.floor(t / 20000) * 20000 + offset;
  const phase = (from: number, to: number) => all || (t % 20000 >= from && t % 20000 < to);
  const state: ItemHudState = { ...emptyItemHudState(capacity),
    slots: capacity === 3 ? [7, 9, 5] : [7, 9] };
  const local = t % 20000;
  if (phase(0, 3000)) {
    const aim = all ? 2 : Math.min(2, Math.floor(local / 1000));
    state.aim = { phase: (["aiming", "inrange", "ontarget"] as const)[aim]!,
      x: 800 + Math.round(Math.sin(t / 700) * 120), y: 430 };
    state.infoCard = { itemIdx: 7 };
  }
  if (phase(3000, 6000)) state.warning = local < 4500 && !all ? "rocket" : "waterfly";
  if (phase(3000, 9000)) {
    state.notices = [
      { kind: "bad", itemIdx: 7, text: "红色闪电", at: all ? t : at(3200) },
      { kind: "bad", itemIdx: 4, text: "飞天小猪", at: all ? t : at(3600) },
      { kind: "good", itemIdx: 9, text: "对手甲 等2人", at: all ? t : at(5000) },
    ];
    state.log = [
      { attacker: "红队车手", victim: "蓝队车手", itemIdx: 7, failed: false, team: "red", at: all ? t : at(5200) },
      { attacker: "蓝队车手", victim: "红队车手", itemIdx: 4, failed: true, team: "blue", at: all ? t : at(5800) },
      { attacker: "个人车手", victim: "对手", itemIdx: 8, failed: false, team: "solo", at: all ? t : at(6400) },
    ];
    state.slotChanger = 3;
    state.itemChanger = "infinite";
  }
  if (phase(9000, 13000)) state.cloud = { opacity: 1, variant: 0 };
  if (phase(13000, 16000)) state.lock = { remainingMs: all ? 2400 : 16000 - local };
  if (phase(16000, 19000)) {
    state.timeBomb = { remainingMs: all ? 2400 : 19000 - local };
    state.abuseUntil = all ? t + 1000 : at(19000);
  }
  if (phase(6000, 13000)) state.scan = [{ playerId: "p2", slots: [10, 113] }];
  if (!all && local >= 6000 && local < 6350) state.reorderProgress = (local - 6000) / 350;
  return state;
}

async function main(): Promise<void> {
  const library = await loadLibrary();
  status("载入字体与 HUD…");
  const fontBytes = await library.canonicalCandidates("gui_/font/SourceHanSansCN-Bold.otf")[0]!.bytes();
  const font = new FontFace(ITEM_HUD_FONT_FAMILY, Uint8Array.from(fontBytes).buffer);
  await font.load();
  document.fonts.add(font);

  const canvas = document.getElementById("hud") as HTMLCanvasElement;
  const renderer = new WebGLRenderer({ canvas, alpha: false });
  renderer.setPixelRatio(1);
  renderer.setSize(1600, 900, false);
  renderer.autoClear = false;
  renderer.setClearColor(0x4f6f8f);

  const slots = await loadItemSlotDefinition(library, "normal", slotDependencies);
  const hud = await ItemHud.load(library, hudDependencies(), { capacity: 2, slots });
  // For poking at from the console.
  Object.assign(window, { itemHudPreview: { hud, slots, renderer } });
  const slotOverlay = new fn(new Map());
  slotOverlay.enableUiSmoothing();

  const board = s2(await U1(library, ["stage_/speedIndiGame"], "rankBoard", ".bml").bytes()) as HudNode;
  const list = board.children.find(child => attribute(child, "name") === "ranklist")!;
  const rank: ItemHudRankSource = {
    definition: { rank: { boardGeometry: lt(board, new Map()), rows: {
      listGeometry: lt(list, new Map()), rowWidth: 245, local: { height: 31 }, other: { height: 31 } } } },
    rankRows: [{ participantId: "p1", x: 2, y: 0, local: true }, { participantId: "p2", x: 2, y: 33 },
      { participantId: "p3", x: 2, y: 66 }],
  };

  // ?t=9500 freezes the timeline there, ?all=1 shows everything, ?slots=3.
  const query = new URLSearchParams(location.search);
  let capacity: 2 | 3 = query.get("slots") === "3" ? 3 : 2;
  let all = query.get("all") === "1";
  let paused = query.has("t");
  let clock = Number(query.get("t") ?? 0) || 0;
  let last = performance.now();
  const options = defaultItemHudOptions();
  const controls = document.getElementById("controls")!;
  const button = (label: string, action: () => void) => {
    const element = document.createElement("button");
    element.textContent = label;
    element.onclick = action;
    controls.append(element);
  };
  button("2/3 槽", () => { capacity = capacity === 2 ? 3 : 2; });
  button("时间线/全部", () => { all = !all; });
  button("暂停", () => { paused = !paused; });
  for (const key of ["itemStateNotice", "itemStateTotalNotice", "dispIngameItemInfoCard"] as const) {
    const label = document.createElement("label");
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = true;
    box.onchange = () => { options[key] = box.checked; hud.setOptions(options); };
    label.append(box, key);
    controls.append(label);
  }

  const frame = (now: number) => {
    if (!paused) clock += now - last;
    last = now;
    const t = Math.floor(clock);
    const state = scenario(t, capacity, all);
    hud.setState(state);
    hud.update(t, rank);
    const input = itemSlotInput(state);
    slotOverlay.update(buildItemSlotCommands(slots, input.speedSlots, input.speedSlotDisabled, 0, t,
      input.slotReorderProgress, input.itemSlotOverlay) as never, t >>> 0);
    renderer.clear();
    hud.renderUnder(renderer, 1600, 900);
    slotOverlay.render(renderer, 1600, 900);
    hud.renderOver(renderer, 1600, 900);
    status(`t=${(t % 20000 / 1000).toFixed(1)}s ${all ? "全部" : "时间线"} ${capacity} 槽`);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

main().catch(error => {
  console.error(error);
  status(`失败：${error instanceof Error ? error.message : String(error)}`);
});
