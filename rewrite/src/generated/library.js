// Generated from the verified KartSim v39.11 release bundle.
// Rebuild with: node tools/generate-modules.mjs
// Stable minified names are retained for behavioral parity.
import { itemTrackCatalog } from "../resources/track-catalog.ts"; // item-mode(lobby)

import { RaceHudController } from "../ui/race-hud-controller.ts";
import { MultiplayerWindowView } from "../ui/multiplayer-window-view.ts";
import { GarageConfirmationDialog } from "../ui/garage-confirmation-dialog.ts";
import { garageConfirmationFontFamily as PR, loadGarageConfirmationFont, loadGarageConfirmationAssets, loadGarageConfirmationBlueprint, garageConfirmationPartEquipRequest, garageConfirmationLayout } from "../ui/garage-confirmation-assets.ts";
import { GiantBoostHud } from "../ui/giant-boost-hud.ts";
import { MultiplayerRaceHud } from "../ui/multiplayer-race-hud.ts";
import { MultiplayerResultView } from "../ui/multiplayer-result-view.ts";
import { RoadblockResultView } from "../ui/roadblock-result-view.ts";
import { DerivedOverlayRenderer } from "../ui/derived-overlay-renderer.ts";
import { ModelBinaryCursor } from "../resources/model-binary-cursor.ts";
import { ModelObjectReader } from "../resources/model-object-reader.ts";
import { createModelRecordDecoders, isModelElement } from "../resources/model-record-decoders.ts";
import { KartBoosterEffectHost, KartBoosterSharedSources, boosterKindForState, waveKindForState } from "../vehicle/kart-booster-effects.ts";
import { defaultCnSpeedType, findSpeedTypeEntry } from "../physics/speed-baseline.ts";
const multiplayerResultDependencies = { loadBml: F9, attribute: T, cloneNode: h2, loadTeams: fa, loadDye: Pj, loadView: options => te.load(options), smoothImages: Co, stageHeight: $2, formatTime: Eo, newPageClock: time => new Vj(time), showRewards: true };
const roadblockResultDependencies = { loadBml: F9, attribute: T, cloneNode: h2, rectangle: V0, numberTokens: j2, loadView: options => te.load(options), projectTexture: fQ };
const derivedOverlayDependencies = { attribute: T, smoothImages: Co, smoothPixels: image => OR(UB(new Uint8ClampedArray(image.pixels), image.width, image.height)), setPlayCamera: Aa };
import { isPlayableGameplay } from "../multiplayer/gameplay-admission.ts";
import { multiplayerModeTiles } from "../multiplayer/mode-tiles.ts";
import { drawMultiplayerWindowNode } from "../ui/multiplayer-window-draw.ts";
import { renderMultiplayerWindow } from "../ui/multiplayer-window-render.ts";
import { multiplayerCanvasButton, updateMultiplayerHoverRegion, closeMultiplayerCombo, chooseMultiplayerCombo } from "../ui/multiplayer-window-actions.ts";
import { drawMultiplayerComboPopup } from "../ui/multiplayer-window-combo.ts";
import { renderLobbyList } from "../ui/lobby-list-render.ts";
import { loadMultiplayerWindowAssets } from "../ui/multiplayer-window-assets.ts";
import { activateLobbyListEntry } from "../ui/lobby-list-actions.ts";
import { drawLobbyListNode } from "../ui/lobby-list-draw.ts";
import { personalBoostFrame, teamBoostFrame } from "../ui/race-hud-boost.ts";
const raceHudDependencies = { createShadow: texture => new xJ(texture), createRenderer: () => new fn(new Map()), createCache: () => new O5(), createRankPresentation: () => new UQ(), createGaugePulse: Jp, loadClassicGauge: (library, kind) => jl.load(library, kind), validateTick: Pw, buildSpeedSlots: XJ, buildTimeCommands: jJ, buildRankCommands: JJ, buildTeamGaugeCommands: YJ, materializeDrawOrder: dt, requireDrawNode: Xl, scaleGauge: Os, alignMarker: nI, advanceGaugePulse: jR, nativeSine: Ro, get reorderDurationMs() { return px; } };
const lobbyListDrawDependencies = { attribute: T, rectangle: V0, modeForButton: Zc, get interactiveNames() { return aQ; }, imageState: st, drawTexture: ct, fitRoomTitle: CX, measure: ve, drawText: m9, randomTrack: X6, get fontFamily() { return Yp; }, showRoomStatus: true };
const lobbyListRenderDependencies = { viewport: Sr, modeForButton: Zc, roomLabel: rR };
const multiplayerWindowAssetDependencies = { loadBml: F9, findResource: U1, decodeTexture: p2, frame: Ft, attribute: T, buttonStyle: m4, parseBml: s2, loadFont: f5, get fontFamily() { return Sn; } };
const multiplayerWindowDrawDependencies = { attribute: T, rectangle: V0, innerRectangle: E9, paintFrame: C9, color: E8, charLayout: ga, charGlyphs: pa, paintImageButton: ct, numbers: j2, drawText: m9, comboEntries: OM, captionRectangle: f3, nodeConfig: an, get fontFamily() { return Sn; } };
const multiplayerComboDependencies = { entries: OM, attribute: T, rectangle: V0, paintFrame: C9 };
const multiplayerWindowViewDependencies = { newHitLayer: (...args) => new nR(...args), decoratePopup: tR, attribute: T, measureText: ve, drawText: m9, color: E8, releaseFont: G1, get fontFamily() { return Sn; }, renderWindow: view => renderMultiplayerWindow(view, Sr), drawNode: (view, node, parent, visible) => drawMultiplayerWindowNode(view, node, parent, visible, multiplayerWindowDrawDependencies), canvasButton: (view, node, rect, text, state) => multiplayerCanvasButton(view, node, rect, text, state, T), updateHoverRegion: (view, event) => updateMultiplayerHoverRegion(view, event), closeCombo: view => closeMultiplayerCombo(view), chooseCombo: (view, index) => chooseMultiplayerCombo(view, index), drawComboPopup: view => drawMultiplayerComboPopup(view, multiplayerComboDependencies), loadAssets: view => loadMultiplayerWindowAssets(view, multiplayerWindowAssetDependencies) };
const garageConfirmationAssetDependencies = {
  loadFont: f5, parseBml: s2, attribute: T, frame: Ft,
  decodeImage: async bytes => $p(await createImageBitmap(
    new Blob([bytes], { type: "image/png" }))),
  rectangle: V0, innerRectangle: E9,
};
const garageConfirmationDialogDependencies = {
  loadFont: library => loadGarageConfirmationFont(library, garageConfirmationAssetDependencies),
  loadAssets: library => loadGarageConfirmationAssets(library, garageConfirmationAssetDependencies),
  releaseFont: G1, partEquipRequest: garageConfirmationPartEquipRequest,
  layout: (blueprint, lineCount, size, request) =>
    garageConfirmationLayout(blueprint, lineCount, size, request,
      garageConfirmationAssetDependencies),
  attribute: T, resizeCanvas: p3, pixelRatio: xe,
  paintFrame: C9, drawText: m9, captionOffset: an,
  captionRectangle: f3, innerRectangle: E9,
  fontFamily: PR,
};
const giantBoostHudDependencies = {
  createRenderer: () => new fn(new Map()),
  createCamera: () => new a5(), createWorld: () => new D1(),
  createViewport: () => new Y2(), applyCamera: Aa,
  attribute: T, loadModel: aI, findResource: Yi, parseBml: s2,
  decodeTexture: p2, makeUi: d5, layoutUi: dn, panels: dt,
};
const multiplayerRaceHudDependencies = {
  createGap: () => new DQ(),
  loadTimeGap: (library, target) => Bw.load(library, target),
  resolveDye: We, loadHudAssets: eI, attribute: T, loadMinimap: oI,
  createHud: (assets, minimap) => new tI(assets, minimap),
  loadGiant: library => Fw.load(library), normalizeRank: XM,
  get racingState() { return X2.Racing; },
  viewportWidth: H2, viewportHeight: $2,
};
import { speedTypeEntry as r7 } from "../physics/speed-baseline.ts";
import { loadSwWithReadableCodec } from "../codecs/sw-compat.ts";
import { getResource, initializeResourceLookup, resourceCanonicalCandidates, resourceEntriesUnderCanonicalPrefix, resourceExactCanonicalCandidates, resourceFindSibling, resourceHasManifestMount, resourcePhysicalContainerNames, resourceResolveContainerPath } from "../resources/resource-lookup.ts";
import { mapAssets, mapCatalog, timeAttackRandomTrackGroups, timeAttackRandomTrackNames, timeAttackTrackCatalog, trackMetadata, trackMetadataCatalog, trackTitles } from "../resources/track-catalog.ts";
import { loadVehicleEngineGrades, loadVehicleItemIds, loadVehicleLinkCharacterIds, vehicleAssets, vehicleCatalog, vehicleEngineGrade, vehicleItemId, vehicleLinkCharacterId, vehicleTextureKey } from "../resources/vehicle-identity.ts";
import { bodyParams, timeAttackGarageCatalog, timeAttackKartItem, timeAttackPlateItem, timeAttackCharacterItem, timeAttackLinkedCharacterItem, timeAttackDecorationItem } from "../resources/timeattack-items.ts";
import { loadTimeAttackGarageCatalog } from "../resources/garage-catalog.ts";
import { itemTableGarageDefinitions } from "../resources/item-table.ts";
import { vehicleTitles } from "../resources/vehicle-titles.ts";
import { loadTrackConfig } from "../resources/track-config.ts";
import { B2, D1, D2, D9, F1, Fe, H, J9, M1, R4, R9, S1, T2, Vt, Y2, Z9, _0, _9, a5, d3, e9, h9, l1, r1, rr, s1, t9, u1, u9, v1, v2, v9, y1, zN } from "./vendor.js";
import { $2, $6, $p, C9, CB, CX, Co, Cr, E9, Eo, Ft, G1, H2, He, Hl, Hn, IR, J5, JG, L6, LB, Mo, N6, NY, O5, O6, PB, Pj, Qt, SB, Sr, T, UB, V0, VY, Vj, W1, We, _Z, aX, an, bo, c3, c5, cX, cn, ct, cw, d5, da, dn, dt, ew, f3, f5, fa, g4, ga, ie, j0, j2, kB, l5, lt, m4, m9, ma, nR, nq, oX, p2, p3, pa, qB, rR, rw, s2, sR, sn, st, tR, ve, x1, xe, xo, y9, zp } from "./formats.js";

class Sw {
  files;
  archives;
  errors;
  warnings;
  region;
  byPath;
  byCanonicalPath;
  byExactCanonicalPath;
  canonicalPrefixCache = new Map();
  manifestMountPaths;
  manifestAvailable;
  archiveIndexes;
  vehicleTitlePromise;
  vehicleEngineGradePromise;
  vehicleItemIdPromise;
  vehicleLinkCharacterIdPromise;
  trackTitlePromise;
  trackMetadataPromise;
  timeAttackGarageCatalogPromise;
  garageDefinitionsPromise;
    constructor(input) { initializeResourceLookup(this, input); }
    static load(sources, onProgress, indexes) { return loadSwWithReadableCodec(Sw, sources, onProgress, indexes); }
    get(path) { return getResource(this, path); }
    physicalContainerNames(paths) { return resourcePhysicalContainerNames(this, paths); }
    resolveContainerPath(origin, target) { return resourceResolveContainerPath(this, origin, target); }
    exactCanonicalCandidates(path) { return resourceExactCanonicalCandidates(this, path); }
    canonicalCandidates(path) { return resourceCanonicalCandidates(this, path); }
    entriesUnderCanonicalPrefix(prefix) { return resourceEntriesUnderCanonicalPrefix(this, prefix); }
    hasManifestMount(path) { return resourceHasManifestMount(this, path); }
    bodyParams() { return bodyParams(this); }
    vehicleAssets() { return vehicleAssets(this); }
    mapAssets() { return mapAssets(this); }
    timeAttackGarageCatalog() { return timeAttackGarageCatalog(this); }
    timeAttackKartItem(id, path) { return timeAttackKartItem(this, id, path); }
    timeAttackPlateItem(id) { return timeAttackPlateItem(this, id); }
    timeAttackCharacterItem(id, path) { return timeAttackCharacterItem(this, id, path); }
    timeAttackLinkedCharacterItem(id) { return timeAttackLinkedCharacterItem(this, id); }
    timeAttackDecorationItem(category, id) { return timeAttackDecorationItem(this, category, id); }
    loadTimeAttackGarageCatalog() { return loadTimeAttackGarageCatalog(this, { parseShopXml: Zu, resolveModel: IR, legacyFamilies: Cr }); }
    itemTableGarageDefinitions() { return itemTableGarageDefinitions(this, { parseXml: x1, legacyFamilies: Cr }); }
    vehicleCatalog() { return vehicleCatalog(this); }
    vehicleTextureKey(path) { return vehicleTextureKey(this, path); }
    vehicleEngineGrade(path) { return vehicleEngineGrade(this, path); }
    vehicleItemId(path) { return vehicleItemId(this, path); }
    vehicleLinkCharacterId(path) { return vehicleLinkCharacterId(this, path); }
    loadTrackConfig(path) { return loadTrackConfig(this, path, { parseBml: s2, parseXml: x1 }); }
    mapCatalog() { return mapCatalog(this); }
    timeAttackTrackCatalog() { return timeAttackTrackCatalog(this); }
    timeAttackRandomTrackGroups() { return timeAttackRandomTrackGroups(this); }
    timeAttackRandomTrackNames() { return timeAttackRandomTrackNames(this); }
    findSibling(path, names) { return resourceFindSibling(this, path, names); }
    trackMetadata(id) { return trackMetadata(this, id); }
    vehicleTitles() { return vehicleTitles(this, { parseXml: Zu }); }
    loadVehicleEngineGrades() { return loadVehicleEngineGrades(this); }
    loadVehicleItemIds() { return loadVehicleItemIds(this); }
    loadVehicleLinkCharacterIds() { return loadVehicleLinkCharacterIds(this); }
    trackTitles() { return trackTitles(this); }
    trackMetadataCatalog() { return trackMetadataCatalog(this); }
}

const BZ = [
  "steam",
  "forest",
  "desert",
  "village",
  "ice",
  "tomb",
  "mine",
  "northeu",
  "factory",
  "pirate",
  "fairy",
  "moonhill",
  "gold",
  "china",
  "castle",
  "nymph",
  "mechanic",
  "xyy",
  "wkc",
  "brodi",
  "park",
  "beach",
  "transFormer",
  "jurassic",
  "world",
  "nemo",
  "sword",
  "god",
  "abyss",
  "camelot",
  "olympos",
  "korea",
  "mabi",
  "maple",
  "fengshen",
];



function wa(n) {
  return n.theme ?? BZ.find((e) => n.id.startsWith(e));
}







const PZ = new Set([
    "hot1",
    "hot2",
    "hot3",
    "hot4",
    "hot5",
    "crazy",
    "clubSpeed",
  ]);

















const WZ = new Set([
  "goggle",
  "balloon",
  "headBand",
  "handGearL",
  "aura",
  "skidMark",
]);



















function Kl(n) {
  const e = (n.canonicalPath ?? n.virtualPath).replaceAll("\\", "/"),
    i = e.toLowerCase().lastIndexOf("/costume/");
  return i >= 0 ? e.slice(i + 1) : e.slice(e.lastIndexOf("/") + 1);
}













function Zu(n, e) {
  const t = new DOMParser().parseFromString(n, "application/xml"),
    i = t.querySelector("parsererror");
  if (i)
    throw new Error(
      `${e} 不是有效 XML：${i.textContent?.trim() ?? "解析失败"}`,
    );
  return t;
}















function sQ(n, e) {
  if (n.name !== "trackList" || e.name !== "trackList")
    throw new Error("防御地图表无效。");
  const t = [];
  for (const i of n.children) {
    if (i.name !== "track" && i.name !== "track_rvs") continue;
    const r = i.name === "track" ? "id" : "refId",
      s = T(i, r);
    if (!s) throw new Error("防御地图缺少原身份。");
    const o = e.children.filter((u) => u.name === i.name && T(u, r) === s);
    if (o.length === 0) continue;
    if (o.length !== 1) throw new Error("防御地区地图身份不唯一。");
    const a = o[0],
      c = Object.fromEntries(i.attributes.map((u) => [u.name, u.value]));
    (c.blocked === void 0 && (c.blocked = "true"),
      T(a, "blocked") === void 0 && (c.blocked = "false"),
      c.isAllowedRoadBlock === void 0 && (c.isAllowedRoadBlock = "false"));
    for (const u of a.attributes) c[u.name] = u.value;
    const l = c.blocked === "true";
    t.push(
      Object.freeze({
        id: i.name === "track_rvs" ? `${s}_rvs` : s,
        reverse: i.name === "track_rvs",
        blocked: l,
        allowed: c.isAllowedRoadBlock === "true" && !l,
        onlyRoadBlock: c.isOnlyRoadBlockTrack === "true",
        attributes: Object.freeze(c),
      }),
    );
  }
  return Object.freeze(t);
}

async function oQ(n, e, t) {
  const i = n.canonicalCandidates(e),
    r = n.canonicalCandidates(t);
  if (i.length !== 1 || r.length !== 1)
    throw new Error("防御地图表原件未唯一命中。");
  return sQ(s2(await i[0].bytes()), s2(await r[0].bytes()));
}

async function Cw(n) {
  const e = n.files.filter((o) => /track_?\/common\//i.test(o.virtualPath)),
    t = (o) => {
      const a = e.filter((c) => c.name.toLowerCase() === o.toLowerCase());
      if (a.length !== 1) throw new Error(`挡人地图表 ${o} 未唯一命中。`);
      return a[0].virtualPath;
    },
    i = await oQ(n, t("track@zz.bml"), t("trackLocale@cn.bml")),
    r = new Map(
      n.mapAssets().map((o) => [
        o.virtualPath
          .replaceAll("\\", "/")
          .split("/")
          .at(-2)
          .replace(/^track_/, "")
          .toLowerCase(),
        o,
      ]),
    ),
    s = [];
  for (const o of i) {
    if (!o.allowed || !sR(o.id)) continue;
    const a = o.id.replace(/_rvs$/, ""),
      c = await n.trackMetadata(a);
    if (!c) continue;
    const l = r.get((c.folder ?? a).toLowerCase()),
      u = l && (o.reverse ? n.findSibling(l.virtualPath, ["track_rvs.1s"]) : l),
      h = wa(c),
      d = c.cnTitle;
    !u ||
      !h ||
      !d ||
      c.difficulty === void 0 ||
      (c.gameType !== "speed" && c.gameType !== "item") ||
      s.push({
        id: o.id,
        path: u.virtualPath,
        title: o.reverse ? `[反]${d}` : d,
        theme: h,
        difficulty: c.difficulty,
        gameType: c.gameType,
        reverse: o.reverse,
      });
  }
  return Object.freeze(s);
}

const Yc = [
  {
    code: 3,
    groupId: "speed:hot1:1",
    title: "人气随机（极易）",
    cardToken: "hot1Random_TimeAttack@zz",
  },
  {
    code: 4,
    groupId: "speed:hot2:2",
    title: "人气随机（简单）",
    cardToken: "hot2Random_TimeAttack@zz",
  },
  {
    code: 5,
    groupId: "speed:hot3:3",
    title: "人气随机（普通）",
    cardToken: "hot3Random_TimeAttack@zz",
  },
  {
    code: 6,
    groupId: "speed:hot4:4",
    title: "人气随机（困难）",
    cardToken: "hot4Random_TimeAttack@zz",
  },
  {
    code: 7,
    groupId: "speed:hot5:5",
    title: "人气随机（极难）",
    cardToken: "hot5Random_TimeAttack@zz",
  },
  {
    code: 0,
    groupId: "speed:all:0",
    title: "全部随机",
    cardToken: "allRandom_TimeAttack@zz",
  },
  {
    code: 40,
    groupId: "speed:speedAll:0",
    title: "竞速随机",
    cardToken: "speedAllRandom_TimeAttack@zz",
  },
  {
    code: 8,
    groupId: "speed:new:0",
    title: "新图随机",
    cardToken: "newRandom_TimeAttack@zz",
  },
  {
    code: 30,
    groupId: "speed:reverse:0",
    title: "反方向随机",
    cardToken: "reverseRandom_TimeAttack@zz",
  },
];

function X6(n) {
  return Yc.find((e) => e.code === n);
}

const Y6 = multiplayerModeTiles;

function Zc(n) {
  return Y6.find((e) => e.name === n);
}

const Yp = "KartSim Multiplayer Lobby",
  aQ = new Set([...Y6.map((n) => n.name), "roomLeft", "roomRight"]),
  cQ = new Set([
    "showNotice",
    "subCatButtonCon",
    "listTopBattle",
    "trackIcon",
    "battleTeam",
    "campaignBg",
    "roomListType",
    "quickJoin2",
    "myItem2",
    "quickJoin_tier",
    "myItem_tier",
    "tierPractice",
    "quickJoin_rotationMode",
    "createRoom_rotationMode",
    "roomList_rotationMode",
  ]);

function lQ(n, e = "p3553") {
  function t(i, r = !1) {
    const s = T(i, "name") ?? "";
    if (
      !(i.name === "Skip" || cQ.has(s)) &&
      !(
        r &&
        s !== "multiplay_pop" &&
        s !== "rightMenu" &&
        T(i, "texture") !== "img_mainSideBG"
      ) &&
      !(i.name === "TabPage" && s !== "스피드카테고리") &&
      s !== "cats"
    ) {
      if (s === "catList") {
        const o = i.children.find((a) => T(a, "name") === "speedIndiCombine");
        if (!o) throw new Error("缺少竞速入口布局模板");
        return {
          ...i,
          children: Y6.filter(
            (a) =>
              e === "p3553" || (a.gameplay !== "giant" && a.gameplay !== "rp"),
          ).map((a) => ({
            ...o,
            attributes: [
              ...o.attributes.filter(
                (c) =>
                  ![
                    "name",
                    "autoLoadImage",
                    "autoLoadImageBoard",
                    "leftTopTex",
                    "leftTopWH",
                    "windowSize",
                  ].includes(c.name),
              ),
              { name: "name", value: a.name },
              { name: "leftTopWH", value: `${a.x} ${a.y} 272 134` },
            ],
            children: [],
          })),
        };
      }
      if ($6(s))
        return s !== "speedIndiCombine"
          ? void 0
          : {
              ...i,
              attributes: [
                ...i.attributes.filter(
                  (o) =>
                    !["name", "autoLoadImage", "autoLoadImageBoard"].includes(
                      o.name,
                    ),
                ),
                { name: "name", value: "ordinaryRace" },
                { name: "windowSize", value: "272 134" },
              ],
              children: [],
            };
      if (!["clubRace_speed", "grandprix_speedIndi"].includes(s)) {
        if (s === "rightMenu") {
          const o = new Set([
            "rooms",
            "listTopGeneral",
            "quickJoin",
            "myItem",
            "createRoom",
          ]);
          return {
            ...i,
            children: i.children
              .filter(
                (a) =>
                  o.has(T(a, "name") ?? "") ||
                  T(a, "image") === "lobby_right_bg",
              )
              .map((a) => t(a))
              .filter((a) => !!a),
          };
        }
        return {
          ...i,
          children: i.children.map((o) => t(o)).filter((o) => !!o),
        };
      }
    }
  }
  return { ...n, children: n.children.map((i) => t(i, !0)).filter((i) => !!i) };
}

class Ew {
  constructor(e, t) {
    ((this.options = e), (this.assets = t));
    const i = this.canvas.getContext("2d");
    if (!i) throw new Error("无法创建多人大厅画面");
    ((this.context = i),
      this.canvas.setAttribute("aria-label", "多人游戏大厅"),
      (this.canvas.tabIndex = 0),
      Object.assign(this.canvas.style, {
        position: "absolute",
        inset: "0",
        width: "100%",
        height: "100%",
        imageRendering: "pixelated",
        userSelect: "none",
        pointerEvents: "auto",
      }),
      (this.element.dataset.uiLayer = "stage"),
      this.element.setAttribute("aria-label", "多人游戏大厅"),
      Object.assign(this.element.style, {
        position: "absolute",
        inset: "0",
        userSelect: "none",
      }),
      this.element.append(this.canvas),
      (this.buttons = new nR(
        this.canvas,
        this.element,
        () => ({ width: 1600, height: 900 }),
        (r, s) => {
          ((this.hovered = r), (this.pressed = s), this.render());
        },
      )),
      this.element.addEventListener("keydown", this.key),
      (this.observer = new ResizeObserver(() => this.render())),
      this.observer.observe(e.root));
  }
  options;
  assets;
  element = document.createElement("div");
  buttons;
  canvas = document.createElement("canvas");
  context;
  observer;
  hits = [];
  hovered;
  pressed;
  mode;
  page = 0;
  channelName;
  gameplay = "ordinary";
  total = 0;
  rooms = [];
  disposed = !1;
  enabled = !1;
  static async load(e) {
    const t = await uQ(e.library, e.version);
    try {
      return new Ew(e, t);
    } catch (i) {
      throw (G1(t.font), i);
    }
  }
  show() {
    ((this.element.hidden = !1),
      this.render(),
      this.options.root.append(this.element));
  }
  hide() {
    ((this.element.hidden = !0), this.buttons.reset());
  }
  setEnabled(e) {
    ((this.enabled = e), this.render());
  }
  setInert(e) {
    ((this.element.inert = e), e && this.buttons.reset());
  }
  setRooms(e, t, i, r, s = "ordinary") {
    this.disposed ||
      ((this.channelName = e),
      (this.mode = He[e].mode),
      (this.gameplay = s),
      (this.page = t),
      (this.total = i),
      (this.rooms = r),
      this.render());
  }
  dispose() {
    this.disposed ||
      ((this.disposed = !0),
      this.buttons.dispose(),
      this.observer.disconnect(),
      this.element.remove(),
      this.element.removeEventListener("keydown", this.key),
      G1(this.assets.font));
  }
  key = (e) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const t = Y6.filter((r) => this.hits.some((s) => s.name === r.name)),
        i = t.findIndex((r) => r.name === this.hovered);
      (t.length &&
        (this.hovered =
          t[
            i < 0
              ? e.key === "ArrowRight"
                ? 0
                : t.length - 1
              : (i + (e.key === "ArrowRight" ? 1 : -1) + t.length) % t.length
          ].name),
        this.hovered && this.buttons.focus(this.hovered),
        this.render());
    } else
      e.target === this.canvas &&
        e.key === "Enter" &&
        this.hovered &&
        (e.preventDefault(), this.activate(this.hovered));
  };
    activate(name) { return activateLobbyListEntry(this, name, Zc, $6); }
    render() { return renderLobbyList(this, lobbyListRenderDependencies); }
    draw(node, parent, room, titleRight) { return drawLobbyListNode(this, node, parent, room, titleRight, lobbyListDrawDependencies); }
}

function U1(n, e, t, i = ".png") {
  const r = t.includes("@zz") ? [t.replace("@zz", "@cn"), t] : [t];
  for (const s of r)
    for (const o of e) {
      const a = n.canonicalCandidates(`${o}/${s}${i}`);
      if (a.length > 1) throw new Error(`多人大厅资源不唯一：${s}`);
      if (a.length === 1) return a[0];
    }
  throw new Error(`多人大厅缺少原版资源：${t}${i}`);
}

async function uQ(n, e) {
  const i = s2(
    await U1(n, ["stage_/mainMenu"], "stage@zz", ".bml").bytes(),
  ).children.find((h) => h.name === "monocoque");
  if (!i || T(i, "topmostWindow") !== "mq_window@zz")
    throw new Error("当前资源未核验多人大厅模板");
  const r = [
      "stage_/mainMenu",
      ...(T(i, "addResFolder") ?? "")
        .split(";")
        .filter(Boolean)
        .map((h) =>
          h
            .replace(/^\//, "")
            .replace(/\/$/, "")
            .replace(/^([^/]+)\//, "$1_/"),
        ),
    ],
    s = lQ(s2(await U1(n, r, "mq_window@zz", ".bml").bytes()), e),
    o = new Map(),
    a = new Map();
  function c(h, d = r) {
    const f = JSON.stringify([d, h]);
    let p = a.get(f);
    return (
      p ||
        ((p = (async () => {
          const v = await p2(await U1(n, d, h).bytes()),
            w = document.createElement("canvas");
          ((w.width = v.width), (w.height = v.height));
          const g = w.getContext("2d");
          if (!g) throw new Error("无法解码多人大厅资源");
          return (
            g.putImageData(
              new ImageData(new Uint8ClampedArray(v.pixels), w.width, w.height),
              0,
              0,
            ),
            { image: w, width: w.width, height: w.height }
          );
        })()),
        a.set(f, p)),
      p
    );
  }
  async function l(h) {
    const d = T(h, "autoLoadImage") ?? T(h, "autoLoadImageBoard"),
      f = T(h, "image") ?? T(h, "texture"),
      p = Zc(T(h, "name") ?? "");
    if (p?.gameplay === "rp")
      o.set(
        h,
        await Promise.all(
          [1, 2, 3, 4].map(async (v) => {
            const w = await fetch(`/ui/multiplayer/${p.editedImage}${v}.png`);
            if (!w.ok) throw new Error("无法载入RP入口图片");
            const g = await p2(new Uint8Array(await w.arrayBuffer()));
            if (g.width !== 272 || g.height !== 134)
              throw new Error("RP入口图片尺寸不匹配");
            const y = document.createElement("canvas");
            ((y.width = g.width), (y.height = g.height));
            const b = y.getContext("2d");
            if (!b) throw new Error("无法解码RP入口图片");
            return (
              b.putImageData(
                new ImageData(
                  new Uint8ClampedArray(g.pixels),
                  y.width,
                  y.height,
                ),
                0,
                0,
              ),
              { image: y, width: g.width, height: g.height }
            );
          }),
        ),
      );
    else if (p) {
      const v = await fetch(`/ui/multiplayer/${p.image}`);
      if (!v.ok) throw new Error(`无法载入${p.label}入口图片`);
      const w = await p2(new Uint8Array(await v.arrayBuffer())),
        g = document.createElement("canvas");
      ((g.width = w.width), (g.height = w.height));
      const y = g.getContext("2d");
      if (!y) throw new Error("无法解码竞速入口图片");
      y.putImageData(
        new ImageData(new Uint8ClampedArray(w.pixels), g.width, g.height),
        0,
        0,
      );
      const b = {
        image: g,
        width: p.gameplay === "giant" ? w.width : 272,
        height: p.gameplay === "giant" ? w.height : 134,
      };
      o.set(h, [b, b, b, b]);
    } else
      d
        ? o.set(
            h,
            await Promise.all(
              [1, 2, 3, 4].map((v) => c(d.replace(/(@zz)?$/, `${v}$1`))),
            ),
          )
        : f && o.set(h, [await c(f)]);
    await Promise.all(h.children.map(l));
  }
  const u = await f5(
    Yp,
    await U1(n, ["gui_/font"], "SourceHanSansCN-Bold", ".otf").bytes(),
  );
  try {
    await l(s);
    const h = new Map();
    new DOMParser()
      .parseFromString(
        await U1(n, ["etc_"], "baseStringBag", ".xml").text(),
        "application/xml",
      )
      .querySelectorAll("k")
      .forEach((p) => {
        const v = p.getAttribute("n"),
          w = p.querySelector('m[c="cn"]')?.getAttribute("v");
        v && w && h.set(v, w);
      });
    const f = new Map(
      (await n.timeAttackTrackCatalog()).map((p) => [p.id, p.title]),
    );
    if (e === "p3553") for (const p of await Cw(n)) f.set(p.id, p.title);
    if (e === "p3553") for (const p of await itemTrackCatalog(n)) f.has(p.id) || f.set(p.id, p.title); // item-mode(lobby)
    return { definition: s, textures: o, strings: h, font: u, trackTitles: f };
  } catch (h) {
    throw (G1(u), h);
  }
}

const Sn = "KartSim Multiplayer Windows";



function h2(n, e, t = n.children) {
  return {
    ...n,
    attributes: [
      ...n.attributes.filter((i) => !(i.name in e)),
      ...Object.entries(e).map(([i, r]) => ({ name: i, value: r })),
    ],
    children: t,
  };
}

async function F9(n, e, t) {
  return s2(await U1(n, [e], t, ".bml").bytes());
}

async function C8(n, e, t) {
  const i = await ma(n, e, t);
  return i ? { ...e, children: [...e.children, i] } : e;
}

class te extends MultiplayerWindowView {
  constructor(options) { super(options, multiplayerWindowViewDependencies); }
}

function OM(n, e) {
  const t = n.children.find((i) => i.name === "Skip")?.children ?? [];
  if (
    t.length !== e.length ||
    t.some((i, r) => {
      const s = T(i, "text")?.trim(),
        o = e[r];
      return s !== o && (!/^\d+$/.test(o) || s !== `${o} #sb(people)`);
    })
  )
    throw new Error("人数列表与原版模板不一致");
  return t;
}

function E8(n) {
  const e = n.trim().split(/\s+/).map(Number);
  return e.length === 4 ? `rgba(${e[1]},${e[2]},${e[3]},${e[0] / 255})` : n;
}

class Tw extends MultiplayerResultView {
  static load(library, root, race, playerId, teamMode = false) {
    return super.load(library, root, race, playerId, teamMode, multiplayerResultDependencies);
  }
}

const dQ = {
  big_num_추가: {
    sourceWidth: 504,
    sourceHeight: 136,
    cellWidth: 56,
    cellHeight: 68,
    columns: 9,
    count: 11,
    targetWidth: 43,
    targetHeight: 52,
  },
};

function fQ(n, e) {
  const t = dQ[n];
  if (!t) return e;
  if (e.width !== t.sourceWidth || e.height !== t.sourceHeight)
    throw new Error(`挡人数字图集尺寸未核验：${n} ${e.width}×${e.height}`);
  const i = document.createElement("canvas");
  ((i.width = t.count * t.targetWidth), (i.height = t.targetHeight));
  const r = i.getContext("2d");
  if (!r) throw new Error("无法创建挡人数字图集投影。");
  r.imageSmoothingEnabled = !1;
  for (let s = 0; s < t.count; s++)
    r.drawImage(
      e,
      (s % t.columns) * t.cellWidth,
      Math.floor(s / t.columns) * t.cellHeight,
      t.cellWidth,
      t.cellHeight,
      s * t.targetWidth,
      0,
      t.targetWidth,
      t.targetHeight,
    );
  return i;
}

class Bo extends RoadblockResultView {
  static loadHud(library, root, race, playerId) {
    return super.loadHud(library, root, race, playerId, roadblockResultDependencies);
  }
  static loadResult(library, root, race) {
    return super.loadResult(library, root, race, roadblockResultDependencies);
  }
}

async function pQ(library) { return loadGarageConfirmationFont(library, garageConfirmationAssetDependencies); }

async function _w(library) { return loadGarageConfirmationBlueprint(library, garageConfirmationAssetDependencies); }

class FR extends GarageConfirmationDialog {
  constructor(root, onVisibility, blueprint, images, font) {
    super(root, onVisibility, blueprint, images, font, garageConfirmationDialogDependencies);
  }
  static async load(library, root, onVisibility) {
    return GarageConfirmationDialog.load(library, root, onVisibility,
      garageConfirmationDialogDependencies,
      (root, onVisibility, blueprint, images, font) =>
        new FR(root, onVisibility, blueprint, images, font));
  }
}

class Gw {
  view;
  lastPromptTick = 0;
  disposed = !1;
  visible = !1;
  constructor() {}
  static async load(e, t) {
    const [i, r] = await Promise.all([
        _w(e),
        U1(e, ["etc_"], "baseStringBag", ".xml").bytes(),
      ]),
      s = x1(r).root.children,
      o = (g) => {
        const b = s
            .find((x) => j0(x, "n") === g)
            ?.children.find((x) => j0(x, "c") === "cn"),
          A = b && j0(b, "v");
        if (!A) throw new Error(`局内提示缺少原文：${g}`);
        return A;
      },
      a = o("system"),
      c = o("roadBlockNoResetMsg"),
      l = new Gw(),
      {
        dialog: u,
        message: h,
        divider: d,
        buttonGroup: f,
        affirmative: p,
      } = i.nodes,
      v = h2(p, { align: "center" }),
      w = h2(u, { visible: "true" }, [h, d, { ...f, children: [v] }]);
    return (
      (l.view = await te.load({
        library: e,
        root: t,
        definition: { ...i.definition, children: [w] },
        roots: ["dialog2_/customMessageBox", "stage_/common"],
        modal: !0,
        label: a,
        preserveDisplayPixels: !0,
        smoothImages: !0,
        onCancel: () => l.hide(),
        onConfirm: () => l.hide(),
        state: (g) =>
          g === w
            ? { text: a }
            : g === h
              ? { text: c, visible: !0 }
              : g === v
                ? { visible: !0, action: () => l.hide() }
                : {},
      })),
      l
    );
  }
  showRoadBlockReset(e) {
    const t = Math.trunc(e) >>> 0;
    this.disposed ||
      (this.lastPromptTick !== 0 && (t - this.lastPromptTick) >>> 0 <= 3e3) ||
      (this.view.hide(),
      (this.lastPromptTick = t),
      (this.visible = !0),
      this.view.show(),
      this.view.focus());
  }
  hide() {
    this.disposed || ((this.visible = !1), this.view.hide());
  }
  dispose() {
    this.disposed ||
      ((this.disposed = !0), (this.visible = !1), this.view.dispose());
  }
}

let WM = Promise.resolve();

async function Q9(n, e) {
  const t = e instanceof Uint8Array ? e : new Uint8Array(e);
  eh(n);
  try {
    return await n.decodeAudioData(Uint8Array.from(t).buffer);
  } catch (i) {
    if (!EQ(i) || !TQ(t) || n.state === "closed") throw i;
    const r = Uint8Array.from(t),
      s = WM.then(async () => {
        eh(n);
        const o = await _Q(r);
        eh(n);
        const a = n.createBuffer(o.channels.length, o.frames, o.sampleRate);
        return (o.channels.forEach((c, l) => a.copyToChannel(c, l)), a);
      });
    return (
      (WM = s.then(
        () => {},
        () => {},
      )),
      s
    );
  }
}

function eh(n) {
  if (n.state === "closed")
    throw new DOMException("Audio context is closed", "InvalidStateError");
}

function EQ(n) {
  return (
    n !== null &&
    typeof n == "object" &&
    "name" in n &&
    (n.name === "EncodingError" || n.name === "NotSupportedError")
  );
}

function TQ(n) {
  if (
    n.length < 27 ||
    n[0] !== 79 ||
    n[1] !== 103 ||
    n[2] !== 103 ||
    n[3] !== 83 ||
    n[4] !== 0 ||
    (n[5] & 3) !== 2
  )
    return !1;
  const e = n[26],
    t = 27 + e;
  if (!e || t > n.length) return !1;
  let i = 0,
    r = !1;
  for (let s = 0; s < e; s++)
    if (((i += n[27 + s]), n[27 + s] < 255)) {
      r = !0;
      break;
    }
  return (
    r &&
    i >= 30 &&
    t + i <= n.length &&
    [1, 118, 111, 114, 98, 105, 115].every((s, o) => n[t + o] === s)
  );
}

async function _Q(n) {
  const e = new Worker(
    new URL("/assets/VorbisDecodeWorker-IhDQFtip.js", import.meta.url),
    { type: "module" },
  );
  try {
    return await new Promise((t, i) => {
      ((e.onmessage = ({ data: r }) => {
        r?.ok === !1 && typeof r.error == "string"
          ? i(new Error(r.error))
          : r?.ok === !0 &&
              Number.isInteger(r.frames) &&
              r.frames > 0 &&
              Number.isInteger(r.sampleRate) &&
              r.sampleRate >= 8e3 &&
              r.sampleRate <= 96e3 &&
              Array.isArray(r.channels) &&
              r.channels.length >= 1 &&
              r.channels.length <= 2 &&
              r.channels.every(
                (s) => s instanceof Float32Array && s.length === r.frames,
              )
            ? t(r)
            : i(new Error("Vorbis decoder worker returned invalid PCM"));
      }),
        (e.onerror = (r) =>
          i(new Error(r.message || "Vorbis decoder worker failed"))),
        (e.onmessageerror = () =>
          i(new Error("Vorbis decoder worker message could not be decoded"))),
        e.postMessage({ bytes: n }, [n.buffer]));
    });
  } finally {
    e.terminate();
  }
}

const GQ = {
    bgmEnabled: !0,
    bgmVolume: 1,
    fxEnabled: !0,
    fxVolume: 1,
    enableRoadSound: !1,
  },
  HM = new WeakMap(),
  Zp = new WeakMap(),
  DR = new WeakMap();

function Qc(n, e) {
  const t = va(n);
  ((t.options = { ...e }), t.sounds.forEach(Z6));
}

function qM(n, e) {
  const t = va(n);
  ((t.bgmTransition = e),
    !e &&
      t.sounds.forEach((i) => {
        i.group === "bgm" && ((i.volume = 1), Z6(i));
      }));
}

function BQ(n) {
  return va(n).options.enableRoadSound;
}

function S9(n, e, t = "fx", i = n.createGain(), r) {
  const s = va(n),
    o = { context: n, gain: i, group: t, volume: DR.get(i.gain) ?? 1 };
  (s.sounds.add(o),
    Zp.set(i.gain, o),
    r
      ? e.connect(r).connect(i).connect(n.destination)
      : e.connect(i).connect(n.destination),
    Z6(o),
    e.addEventListener(
      "ended",
      () => {
        (s.sounds.delete(o), Zp.delete(i.gain), i.disconnect());
      },
      { once: !0 },
    ));
}

function va(n) {
  let e = HM.get(n);
  return (
    e ||
      ((e = { options: GQ, sounds: new Set(), bgmTransition: !1 }),
      HM.set(n, e)),
    e
  );
}

function Z6(n) {
  const e = va(n.context).options,
    t = n.group === "bgm" ? e.bgmEnabled : e.fxEnabled,
    i = n.group === "bgm" ? e.bgmVolume : e.fxVolume;
  VR(n.gain.gain, t ? Math.fround(n.volume * i) : 0, n.context.currentTime);
}

function he(n, e, t) {
  if (!n) return;
  DR.set(n, e);
  const i = Zp.get(n);
  i ? ((i.volume = e), Z6(i)) : VR(n, e, t);
}

function VR(n, e, t) {
  const i = Math.fround(e),
    r =
      i === 0
        ? -1e4
        : Math.trunc(
            -Math.fround(Math.fround(Math.log(Math.fround(1 / i))) * 1e3),
          );
  r >= -1e4 && r <= 0 && n.setValueAtTime(10 ** (r / 2e3), t);
}

const RQ = "sound_/fx/etc/count_n.flac",
  IQ = "sound_/fx/etc/count_go.flac",
  kQ = "sound_/fx/etc/lab_count.flac",
  LQ = "sound_/fx/etc/final_lab.flac";

class Q6 {
  constructor(e, t, i, r, s, o) {
    ((this.context = e),
      (this.numberBuffer = t),
      (this.goBuffer = i),
      (this.lapBuffer = r),
      (this.finalLapBuffer = s),
      (this.finishNumberBuffer = o));
  }
  context;
  numberBuffer;
  goBuffer;
  lapBuffer;
  finalLapBuffer;
  finishNumberBuffer;
  activeSources = new Set();
  static async load(e, t, i = !1) {
    const r = Xr(e, RQ),
      s = Xr(e, IQ),
      o = Xr(e, kQ),
      a = Xr(e, LQ),
      [c, l, u, h] = await Promise.all([
        r.bytes(),
        s.bytes(),
        o.bytes(),
        a.bytes(),
      ]),
      [d, f, p, v] = await Promise.all([
        Q9(t, c),
        Q9(t, l),
        Q9(t, u),
        Q9(t, h),
      ]),
      w = i
        ? await Q9(t, await Xr(e, "sound_/fx/etc/ro_count.flac").bytes())
        : void 0;
    return new Q6(t, d, f, p, v, w);
  }
  playNumber() {
    this.play(this.numberBuffer);
  }
  playFinishNumber() {
    this.finishNumberBuffer && this.play(this.finishNumberBuffer);
  }
  playGo() {
    this.play(this.goBuffer);
  }
  playLap() {
    this.play(this.lapBuffer);
  }
  playFinalLap() {
    this.play(this.finalLapBuffer);
  }
  reset() {
    for (const e of this.activeSources)
      ((e.onended = null), e.stop(), e.disconnect());
    this.activeSources.clear();
  }
  dispose() {
    this.reset();
  }
  play(e) {
    const t = this.context.createBufferSource();
    ((t.buffer = e),
      S9(this.context, t),
      (t.onended = () => {
        (t.disconnect(), this.activeSources.delete(t));
      }),
      this.activeSources.add(t),
      t.start());
  }
}

function Xr(n, e) {
  const t = n.exactCanonicalCandidates(e);
  if (t.length !== 1) throw new Error(`${e} source 数量 ${t.length}。`);
  return t[0];
}

const Y1 = Math.fround;

function PQ(n, e, t) {
  const i = Y1(Y1(Y1(e.x * e.x) + Y1(e.z * e.z)) + Y1(e.y * e.y)),
    r = Math.max(
      180,
      Math.min(300, Math.trunc(Y1(Y1(Math.sqrt(i)) * Y1(3.6)))),
    );
  return Y1(Y1(18 - Y1(Y1(Y1(r - 195) / Y1(14.5)) * t)) * Y1(n));
}

function FQ(n) {
  const e = Math.trunc(Math.abs(n)),
    t = Math.floor(e / 6e4),
    i = Math.floor(e / 1e3) % 60,
    r = Math.floor(e / 10) % 100,
    s = (o) => String(o).padStart(2, "0");
  return {
    text: `${n >= 0 ? "-" : "+"}${t ? `${t}Q` : ""}${s(i)}D${s(r)}`,
    red: t > 0 || i > 10,
  };
}

class DQ {
  phase = 0;
  lastMs = 0;
  notices = [];
  update(e, t, i, r, s, o, a = !1) {
    if (!t)
      return (
        (this.phase = 0),
        (this.lastMs = 0),
        (this.notices = []),
        this.notices
      );
    if (
      ((this.notices = this.notices.filter(
        (f) => e - f.atMs < 2400 && i.some((p) => p.playerId === f.playerId),
      )),
      e - this.lastMs <= (this.phase === 0 ? 6e3 : 2e3))
    )
      return this.notices;
    if (
      ((this.lastMs = e),
      (this.phase = (this.phase + 1) % 3),
      !this.phase ||
        i.some((f) => !f.progress || !Number.isFinite(f.progress.distance)))
    )
      return this.notices;
    const c = i
        .filter((f) => f.progress.finishElapsedMs !== void 0)
        .sort(
          (f, p) => f.progress.finishElapsedMs - p.progress.finishElapsedMs,
        ),
      l = i
        .filter((f) => f.progress.finishElapsedMs === void 0)
        .sort((f, p) => p.progress.distance - f.progress.distance),
      u = [...c, ...l],
      h = u.findIndex((f) => f.playerId === r);
    if (h < 0 || u[h].progress.finishElapsedMs !== void 0) return this.notices;
    const d = (f, p, v) => {
      if (!p || p.playerId === r || p.progress.finishElapsedMs !== void 0)
        return;
      const w = PQ(Y1(p.progress.distance - u[h].progress.distance), s, v);
      if (!Number.isFinite(w)) return;
      const g = FQ(w);
      ((this.notices = this.notices
        .filter((y) => y.slot !== f)
        .map((y) =>
          y.playerId === p.playerId && y.slot < 2 && f < 2 ? { ...y, ...g } : y,
        )),
        this.notices.push({
          slot: f,
          playerId: p.playerId,
          name: a ? "kartsim" : o ? "KartSim" : p.name,
          rank: u.indexOf(p),
          ...g,
          red: f !== 2 && g.red,
          atMs: e,
        }));
    };
    return (
      this.phase === 1
        ? d(0, l[0], 1)
        : (u.length > 2 && d(1, u[h - 1], 1), d(2, u[h + 1], -1)),
      this.notices
    );
  }
}

const VQ = "KartSim Multiplayer Windows";

function NQ(n, e, t) {
  const i = { family: VQ, size: 16 },
    r = Math.max(0, e.width - 4),
    s = Array.from(t);
  if (ve(n, t, i).width > r) {
    for (; s.length && ve(n, `${s.join("")}…`, i).width > r;) s.pop();
    s.push("…");
  }
  (n.save(),
    n.beginPath(),
    n.rect(e.x, e.y, e.width, e.height),
    n.clip(),
    m9(n, s.join(""), e, {
      ...i,
      kind: "label",
      color: "white",
      align: "left",
      verticalAlign: "center",
    }),
    n.restore());
}

class Bw {
  window;
  notices = [];
  now = 0;
  static async load(e, t) {
    const i = new Bw(),
      r = await F9(e, "gui_/windowTemplate", "timeDiffBig"),
      s = await F9(e, "gui_/windowTemplate", "timeDiffSmall"),
      o = [];
    for (let c = 0; c < 3; c++)
      for (const l of [!1, !0]) {
        const u = c === 0 ? r : s,
          h = `${c}:${Number(l)}`,
          d = u.children.map((f) =>
            h2(f, {
              name: `${h}:${T(f, "name")}`,
              ...(T(f, "clientRect") ? { windowRect: T(f, "clientRect") } : {}),
              ...(T(f, "name") === "time"
                ? {
                    rightAlign: "true",
                    fontPos: c === 0 ? `${l ? 240 : 0} 12` : `${l ? 150 : 0} 0`,
                  }
                : {}),
              ...(T(f, "name") === "rid"
                ? c === 0
                  ? { windowRect: "91 3 185 25" }
                  : { leftTopWH: "100 2 92 18" }
                : {}),
            }),
          );
        o.push(
          h2(
            u,
            {
              name: h,
              windowRect:
                c === 0
                  ? "85 480 359 509"
                  : `85 ${c === 1 ? 515 : 542} 345 ${c === 1 ? 538 : 565}`,
            },
            d,
          ),
        );
      }
    const a = {
      name: "Container",
      text: "",
      attributes: [{ name: "windowRect", value: "0 0 1600 900" }],
      children: o,
    };
    return (
      (i.window = await te.load({
        root: t,
        library: e,
        definition: a,
        roots: ["gui_/windowTemplate"],
        label: "多人比赛时间差提示",
        smoothImages: !0,
        preserveDisplayPixels: !0,
        state: (c) => {
          const l = T(c, "name");
          if (!l) return {};
          const [u, h, d] = l.split(":"),
            f = i.notices.find((v) => v.slot === Number(u));
          if (!f || Number(f.red) !== Number(h)) return { visible: !1 };
          if (d === "rid")
            return { text: "", paint: (v, w) => NQ(v, w, f.name) };
          if (d) return { text: d === "rank" ? String(f.rank) : f.text };
          const p = i.now - f.atMs;
          return {
            offsetX: 315 * Math.max(0, Math.min(1, p / 200, (2400 - p) / 200)),
          };
        },
      })),
      (i.window.element.style.pointerEvents = "none"),
      (i.window.element.style.overflow = "hidden"),
      i
    );
  }
  update(e, t) {
    ((this.notices = e),
      (this.now = t),
      e.length
        ? this.window?.element.isConnected
          ? ((this.window.element.hidden = !1), this.window.repaint())
          : this.window?.show()
        : this.window?.hide());
  }
  dispose() {
    (this.window?.dispose(), (this.window = void 0));
  }
}

function NR(n, e, t) {
  const i = Qp(e),
    r = Qp(t);
  switch (n.step) {
    case 0:
      return Yr(i, r - 6e3)
        ? { next: { step: 1 }, fired: ["prepare"] }
        : { next: n, fired: [] };
    case 1:
      return Yr(i, r - 3e3)
        ? { next: { step: 2 }, fired: ["three"] }
        : { next: n, fired: [] };
    case 2:
      return Yr(i, r - 2e3)
        ? { next: { step: 3 }, fired: ["two"] }
        : { next: n, fired: [] };
    case 3:
      return Yr(i, r - 1e3)
        ? { next: { step: 4 }, fired: ["one"] }
        : { next: n, fired: [] };
    case 4:
      return Yr(i, r)
        ? { next: { step: 4 }, fired: ["go"] }
        : { next: n, fired: [] };
  }
}

function Yr(n, e) {
  return n >= Qp(e);
}

function Qp(n) {
  return Math.trunc(n) >>> 0;
}

var X2 = ((n) => (
  (n[(n.Ready = 0)] = "Ready"),
  (n[(n.Countdown = 1)] = "Countdown"),
  (n[(n.Racing = 2)] = "Racing"),
  (n[(n.PostFinish = 3)] = "PostFinish"),
  (n[(n.Result = 5)] = "Result"),
  n
))(X2 || {});

class OQ {
  state = 0;
  startAtMs = 0;
  finishedElapsedMs = 0;
  finishSignalAtMs = 0;
  raceOverAtMs = 0;
  countdownStep = 0;
  raceoverShown = !1;
  lastAnnouncedLap = 1;
  reset() {
    ((this.state = 0),
      (this.startAtMs = 0),
      (this.finishedElapsedMs = 0),
      (this.finishSignalAtMs = 0),
      (this.raceOverAtMs = 0),
      (this.countdownStep = 0),
      (this.raceoverShown = !1),
      (this.lastAnnouncedLap = 1));
  }
  acceptTiming(e, t, i) {
    const r = (Ns(t) - Ns(i)) >>> 0;
    return e === 1
      ? ((this.startAtMs = r), this.state === 0 && (this.state = 1), [])
      : e === 3
        ? ((this.finishSignalAtMs = r),
          this.state === 2 ? [{ kind: "finish-effect" }] : [])
        : ((this.raceOverAtMs = r),
          this.state !== 2
            ? []
            : ((this.state = 3), [{ kind: "forced-finish" }]));
  }
  update(e) {
    const t = Ns(e.nowMs);
    return this.state === 1
      ? this.updateCountdown(t)
      : this.state === 2
        ? this.updateRacing(t, e.routeProgress, e.routeTotal)
        : this.state === 3
          ? this.updatePostFinish(t, e.resultRosterReady)
          : this.state === 5
            ? [{ kind: "publish-result" }]
            : [];
  }
  updateCountdown(e) {
    const { next: t, fired: i } = NR(
      { step: this.countdownStep },
      e,
      this.startAtMs,
    );
    if (((this.countdownStep = t.step), i.length === 0)) return [];
    switch (i[0]) {
      case "prepare":
        return [{ kind: "prepare-countdown" }];
      case "three":
        return [
          { kind: "start-effect", atMs: (this.startAtMs - 3e3) >>> 0 },
          { kind: "switch-drive-camera" },
          { kind: "countdown", step: 1 },
        ];
      case "two":
        return [{ kind: "countdown", step: 2 }];
      case "one":
        return [{ kind: "countdown", step: 3 }];
      case "go":
        return (
          (this.state = 2),
          [
            { kind: "release-race", startAtMs: this.startAtMs },
            { kind: "count-go" },
          ]
        );
    }
  }
  updateRacing(e, t, i) {
    return t > this.lastAnnouncedLap && t <= i
      ? ((this.lastAnnouncedLap = t),
        t === i ? [{ kind: "final-lap" }] : [{ kind: "lap", value: t }])
      : this.countdownStep !== 4 || !KM(e, this.startAtMs) || t <= i
        ? []
        : ((this.finishedElapsedMs = (e - this.startAtMs) >>> 0),
          (this.state = 3),
          [
            {
              kind: "natural-finish",
              elapsedMs: this.finishedElapsedMs,
              outcome: this.finishSignalAtMs !== 0 ? "finish" : "winner",
            },
            { kind: "switch-surround-camera" },
          ]);
  }
  updatePostFinish(e, t) {
    if (this.raceOverAtMs === 0 || !KM(e, this.raceOverAtMs)) return [];
    if (!this.raceoverShown) {
      const i = this.raceOverAtMs;
      return (
        (this.raceOverAtMs = (this.raceOverAtMs + 3e3) >>> 0),
        (this.raceoverShown = !0),
        [{ kind: "raceover", atMs: i }]
      );
    }
    return t ? ((this.state = 5), [{ kind: "publish-result" }]) : [];
  }
}

function KM(n, e) {
  return Ns(n) >= Ns(e);
}

function Ns(n) {
  return Math.trunc(n) >>> 0;
}

function zQ(n, e) {
  return { ...n, equipment: structuredClone(e.equipment) };
}

function jM(n, e, t) {
  const i = t ?? (e ? 2 : 6);
  return {
    ...n,
    equipment: {
      ...n.equipment,
      itemIds: {
        ...n.equipment.itemIds,
        1: e ? n.equipment.itemIds[1] : 1,
        2: i,
        70: i,
        4: 0,
        8: 0,
        9: 0,
        11: 0,
        16: 0,
        17: 0,
        18: 0,
        20: 0,
        21: 0,
        52: 0,
        ...(e ? {} : { 12: 0 }),
      },
    },
  };
}

function XM(n, e = "KartSim") {
  return { ...n, rows: n.rows.map((t) => (t.local ? t : { ...t, name: e })) };
}

class UQ {
  lastLayoutTick = 0;
  seats = new Map();
  reset() {
    ((this.lastLayoutTick = 0), this.seats.clear());
  }
  update(e, t, i) {
    const r = new Set(),
      s = new Set();
    for (const a of e) {
      if (
        !a.participantId ||
        s.has(a.participantId) ||
        r.has(a.slot) ||
        !Number.isInteger(a.slot) ||
        a.slot < 0
      )
        throw new Error(
          "Rank board requires unique stable participant identities and slots.",
        );
      (s.add(a.participantId), r.add(a.slot));
    }
    if (this.seats.size === 0)
      for (const a of e)
        this.seats.set(a.participantId, { slot: a.slot, x: 0, y: 0 });
    if (
      e.length !== this.seats.size ||
      e.some((a) => this.seats.get(a.participantId)?.slot !== a.slot)
    )
      throw new Error("Rank board roster changed without a new race reset.");
    const o = [...e].sort((a, c) => a.slot - c.slot);
    if ((t - this.lastLayoutTick) >>> 0 >= 500) {
      this.lastLayoutTick = t >>> 0;
      let a = 0;
      for (let c = 0; c <= e.length; c++)
        for (const l of o) {
          if (l.rank !== c) continue;
          const u = this.seats.get(l.participantId);
          ((u.x = 2),
            (u.y = a),
            (a += Math.trunc(Math.fround(Math.fround(i(l)) + 2))));
          break;
        }
    }
    return o.map((a) => ({
      ...a,
      x: this.seats.get(a.participantId).x,
      y: this.seats.get(a.participantId).y,
    }));
  }
}

const $Q = ["dds", "png", "jpg", "tga", "kng"];

function ya(n, e, t) {
  if (t.name === void 0) return { status: "none" };
  const i = e.lastIndexOf("/");
  if (i < 0)
    return { status: "unresolved", reason: `${e} 缺少 canonical directory。` };
  const r = e.slice(0, i + 1);
  let s = !0;
  for (const o of $Q) {
    const a = `${r}${t.name}.${o}`,
      c = n.resolveContainerPath(e, a);
    if (c.status === "found") return { status: "found", entry: c.entry };
    if (c.status === "ambiguous")
      return {
        status: "unresolved",
        reason: `${a} 在 scene container 中不唯一。`,
      };
    s &&= c.authoritative;
  }
  return s
    ? { status: "missing" }
    : {
        status: "unresolved",
        reason: `${e} 的同容器 texture 缺失结论不具权威性。`,
      };
}

function Rw(n, e, t = {}) {
  return W1(
    n.scene,
    e,
    `${n.scenePath}:TachometerPlay1SPanel`,
    (i) => ya(e, n.scenePath, i),
    t,
  );
}

function YM(n, e, t, i, r) {
  if (!n.playControllers || !n.setControllerCycleMode || !n.stopControllers)
    throw new Error("Play1S scene controller lifecycle 尚未接入。");
  if (!t) return n.stopControllers(1);
  (e.loop && n.setControllerCycleMode(0), n.playControllers(i, r));
}

class Iw {
  constructor(e, t, i) {
    ((this.binding = e),
      (this.scene = t),
      (this.state = oX(e, i)),
      YM(
        t,
        e,
        this.state.playing,
        this.state.animationStartMs,
        this.state.durationMs,
      ));
  }
  binding;
  scene;
  state;
  play(e, t, i) {
    ((this.state = rw(this.binding, this.state, e, t, i)), this.apply());
  }
  stop() {
    ((this.state = aX(this.state)), this.apply());
  }
  update(e) {
    const t = cX(this.binding, this.state, e);
    (t !== this.state && ((this.state = t), this.apply()),
      this.scene.update(e));
  }
  snapshot() {
    return this.state;
  }
  dispose() {
    this.scene.dispose();
  }
  apply() {
    YM(
      this.scene,
      this.binding,
      this.state.playing,
      this.state.animationStartMs,
      this.state.durationMs,
    );
  }
}

function OR(n) {
  const e = new Uint8Array(n);
  for (let t = 0; t < e.length; t += 4) {
    const i = n[t + 3];
    for (let r = 0; r < 3; r += 1) e[t + r] = Math.round((n[t + r] * i) / 255);
  }
  return e;
}

const xs = Math.fround(9700 / 9801);

function WQ(n, e, t, i, r) {
  if (n.type !== "MqTacho")
    throw new Error(`${n.type} 的 P3528 draw tree 尚未闭合。`);
  if (!Number.isFinite(e) || e < 0)
    throw new Error(`P3528 Tachometer speed=${e} 无效。`);
  if (!Number.isFinite(t) || !Number.isFinite(i) || t < 0 || i < 0)
    throw new Error(`P3528 Tachometer viewport=${t}x${i} 无效。`);
  const s = [];
  return (
    zR(
      n.windowTree,
      n.textures,
      { left: 0, top: 0, right: Math.fround(t), bottom: Math.fround(i) },
      0,
      0,
      e,
      r,
      s,
    ),
    s
  );
}

function HQ(n) {
  const e = Math.trunc(n),
    t = Math.trunc(Math.fround(Math.fround(n) * Math.fround(19 / 350))) >>> 0;
  return {
    kmh: e.toString().padStart(3, "0"),
    speedGauge: Array.from({ length: 19 }, (i, r) =>
      r < t ? (t < 15 ? "1" : "2") : "0",
    ).join(""),
  };
}

function zR(n, e, t, i, r, s, o, a) {
  if (!qQ(n.node, o)) return;
  const c = l5(n.geometry, t),
    l = Math.fround(i + c.left),
    u = Math.fround(r + c.top);
  if (n.node.name === "Panel") {
    QM(n.node);
    const [d, f] = JM(n.node, e),
      p = {
        left: l,
        top: u,
        right: Math.fround(l + n.geometry.width),
        bottom: Math.fround(u + n.geometry.height),
      };
    a.push({
      kind: "panel",
      node: n.node,
      textureName: d,
      texture: f,
      worldRect: p,
      framebufferRect: ZM(p),
      uv: { left: 0, top: 0, right: 1, bottom: 1 },
      color: 4294967295,
    });
  } else if (n.node.name === "CharPanel" || n.node.name === "DashboardPanel") {
    QM(n.node);
    const [d, f] = JM(n.node, e),
      p = HQ(s),
      v = T(n.node, "name"),
      w = v === "kmh" ? p.kmh : v === "speedGauge" ? p.speedGauge : void 0;
    if (w === void 0)
      throw new Error(
        `MqTacho CharPanel ${v ?? "<unnamed>"} 的 text producer 尚未闭合。`,
      );
    const g = pa(ga(n.node, f), w).map((y) => ({
      ...y,
      left: Math.fround(l + y.left),
      top: Math.fround(u + y.top),
      right: Math.fround(l + y.right),
      bottom: Math.fround(u + y.bottom),
    }));
    a.push({
      kind: "char-panel",
      node: n.node,
      textureName: d,
      texture: f,
      text: w,
      worldQuads: g,
      framebufferQuads: g.map((y) => ({ ...y, ...ZM(y) })),
    });
  } else if (n.node.name !== "Window" && n.node.name !== "Container")
    throw new Error(`${n.node.name} 的 P3528 draw command 尚未闭合。`);
  const h = {
    left: 0,
    top: 0,
    right: n.geometry.width,
    bottom: n.geometry.height,
  };
  n.children.forEach((d) => zR(d, e, h, l, u, s, o, a));
}

function ZM(n) {
  return {
    left: Math.fround(n.left - 0.5),
    top: Math.fround(n.top - 0.5),
    right: Math.fround(n.right - 0.5),
    bottom: Math.fround(n.bottom - 0.5),
  };
}

function qQ(n, e) {
  if (e !== void 0 && T(n, "name") === "bgpOn") return e;
  const t = T(n, "visible");
  if (t === void 0 || t === "true") return !0;
  if (t === "false") return !1;
  throw new Error(`${n.name}.visible=${t} 不是 P3528 boolean。`);
}

function QM(n) {
  if (T(n, "alphaBlend") !== "true" || T(n, "alphaTest") !== void 0)
    throw new Error(`${n.name} 不使用已闭合的 P3528 Mq alpha state。`);
}

function JM(n, e) {
  const t = T(n, "texture"),
    i = t === void 0 ? void 0 : e.get(t);
  if (!t || !i) throw new Error(`${n.name} 缺少已解析的 P3528 texture。`);
  return [t, i];
}

const H5 = 48.98989486694336 / 49.5;

class fn extends DerivedOverlayRenderer {
  constructor(playRuntimes, alphaTestReference = 8) {
    super(playRuntimes, alphaTestReference, derivedOverlayDependencies);
  }
}

function Aa(n, e, t) {
  (n.matrixWorldInverse.set(
    e[0],
    e[1],
    e[2],
    e[3],
    e[4],
    e[5],
    e[6],
    e[7],
    e[8],
    e[9],
    e[10],
    e[11],
    0,
    0,
    0,
    1,
  ),
    n.matrixWorld.copy(n.matrixWorldInverse).invert(),
    n.projectionMatrix.set(
      t[0],
      t[1],
      t[2],
      t[3],
      t[4],
      t[5],
      t[6],
      t[7],
      t[8] * 2 - t[12],
      t[9] * 2 - t[13],
      t[10] * 2 - t[14],
      t[11] * 2 - t[15],
      t[12],
      t[13],
      t[14],
      t[15],
    ),
    n.projectionMatrixInverse.copy(n.projectionMatrix).invert());
}

const eJ = (n) => (n / 2 ** 32) | 0,
  tJ = (n) => n >>> 0;

function nJ(n, e, t, i) {
  const r = eJ(t),
    s = tJ(t);
  (n.setUint32(e, i ? s : r, i), n.setUint32(e + 4, i ? r : s, i));
}

function nx(n) {
  return (
    n instanceof Uint8Array ||
    (ArrayBuffer.isView(n) &&
      n.constructor.name === "Uint8Array" &&
      "BYTES_PER_ELEMENT" in n &&
      n.BYTES_PER_ELEMENT === 1)
  );
}

const iJ = (n) => (n ? `"${n}" ` : "");

function $R(n, e, t = "") {
  if (nx(n) && e === void 0) return n;
  const i = nx(n),
    r = "",
    s = i ? `length=${n.length}` : `type=${typeof n}`,
    o = iJ(t) + "expected Uint8Array" + r + ", got " + s;
  throw i ? new RangeError(o) : new TypeError(o);
}

const rJ = (n, e) => {
    if (n === null || typeof n != "object" || Array.isArray(n))
      throw new TypeError(
        (e === "object" ? "" : `"${e}" `) +
          "expected object, got type=" +
          typeof n,
      );
  },
  ix = (n, e) => {
    rJ(n, e);
    const t = Object.getPrototypeOf(n);
    if (t !== Object.prototype && t !== null)
      throw new TypeError(`"${e}" expected plain object`);
    if (Object.hasOwn(n, "__proto__"))
      throw new TypeError(`"${e}.__proto__" is not allowed`);
  };

function rx(n, e = !0) {
  if (n.destroyed) throw new Error("hash was destroyed");
  if (e && n.finished) throw new Error("digest() was already called");
}

function sJ(n, e) {
  $R(n, void 0, "output");
  const t = e.outputLen;
  if (!(n.length >= t))
    throw new RangeError('"output" expected length >= ' + t);
}

function sx(...n) {
  for (let e = 0; e < n.length; e++) n[e].fill(0);
}

function th(n) {
  return new DataView(n.buffer, n.byteOffset, n.byteLength);
}

function Ot(n, e) {
  return (n << (32 - e)) | (n >>> e);
}

function oJ(n, e, t = "opts") {
  return (
    ix(n, "defaults"),
    e !== void 0 && ix(e, t),
    Object.assign(Object.create(null), n, e)
  );
}

function aJ(n, e = {}) {
  if (typeof n != "function")
    throw new TypeError('"hashCons" expected function, got type=' + typeof n);
  e = oJ({}, e, "info");
  const t = (r, s) => n(s).update(r).digest(),
    i = n(void 0);
  return (
    (t.outputLen = i.outputLen),
    (t.blockLen = i.blockLen),
    (t.canXOF = i.canXOF),
    (t.create = (r) => n(r)),
    Object.assign(t, e),
    Object.freeze(t)
  );
}

const cJ = (n) => ({
  oid: Uint8Array.from([6, 9, 96, 134, 72, 1, 101, 3, 4, 2, n]),
});

function lJ(n, e, t) {
  return (n & e) ^ (~n & t);
}

function uJ(n, e, t) {
  return (n & e) ^ (n & t) ^ (e & t);
}

class hJ {
  blockLen;
  outputLen;
  canXOF = !1;
  padOffset;
  isLE;
  buffer;
  view;
  finished = !1;
  length = 0;
  pos = 0;
  destroyed = !1;
  constructor(e, t, i, r) {
    ((this.blockLen = e),
      (this.outputLen = t),
      (this.padOffset = i),
      (this.isLE = r),
      (this.buffer = new Uint8Array(e)),
      (this.view = th(this.buffer)));
  }
  update(e) {
    (rx(this), $R(e));
    const { view: t, buffer: i, blockLen: r } = this,
      s = e.length;
    let o = !1;
    for (let a = 0; a < s;) {
      const c = Math.min(r - this.pos, s - a);
      if (c === r) {
        const l = th(e);
        for (; r <= s - a; a += r) this.process(l, a);
        o = !0;
        continue;
      }
      (i.set(a === 0 && c === s ? e : e.subarray(a, a + c), this.pos),
        (this.pos += c),
        (a += c),
        this.pos === r && (this.process(t, 0), (this.pos = 0), (o = !0)));
    }
    return ((this.length += e.length), o && this.roundClean(), this);
  }
  digestInto(e) {
    (rx(this), sJ(e, this), (this.finished = !0));
    const { buffer: t, view: i, blockLen: r, isLE: s } = this;
    let { pos: o } = this;
    ((t[o++] = 128),
      t.fill(0, o),
      this.padOffset > r - o && (this.process(i, 0), t.fill(0)),
      nJ(i, r - 8, this.length * 8, s),
      this.process(i, 0),
      this.roundClean());
    const a = e === t ? i : th(e),
      c = this.outputLen,
      l = c / 4,
      u = this.get();
    if (c % 4 || l > u.length) throw new Error("invalid outputLen");
    for (let h = 0; h < l; h++) a.setUint32(4 * h, u[h], s);
  }
  digest() {
    const { buffer: e, outputLen: t } = this;
    this.digestInto(e);
    const i = e.slice(0, t);
    return (this.destroy(), i);
  }
  _cloneIntoMeta(e) {
    const { buffer: t, length: i, finished: r, destroyed: s, pos: o } = this;
    return (
      (e.destroyed = s),
      (e.finished = r),
      (e.length = i),
      (e.pos = o),
      o && e.buffer.set(t),
      e
    );
  }
  clone() {
    return this._cloneInto();
  }
}

const dJ = Uint32Array.from([
    1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924,
    528734635, 1541459225,
  ]),
  fJ = Uint32Array.from([
    1116352408, 1899447441, 3049323471, 3921009573, 961987163, 1508970993,
    2453635748, 2870763221, 3624381080, 310598401, 607225278, 1426881987,
    1925078388, 2162078206, 2614888103, 3248222580, 3835390401, 4022224774,
    264347078, 604807628, 770255983, 1249150122, 1555081692, 1996064986,
    2554220882, 2821834349, 2952996808, 3210313671, 3336571891, 3584528711,
    113926993, 338241895, 666307205, 773529912, 1294757372, 1396182291,
    1695183700, 1986661051, 2177026350, 2456956037, 2730485921, 2820302411,
    3259730800, 3345764771, 3516065817, 3600352804, 4094571909, 275423344,
    430227734, 506948616, 659060556, 883997877, 958139571, 1322822218,
    1537002063, 1747873779, 1955562222, 2024104815, 2227730452, 2361852424,
    2428436474, 2756734187, 3204031479, 3329325298,
  ]),
  Cn = new Uint32Array(64);

class pJ extends hJ {
  A = 0;
  B = 0;
  C = 0;
  D = 0;
  E = 0;
  F = 0;
  G = 0;
  H = 0;
  constructor(e, t) {
    (super(64, e, 8, !1),
      (this.A = t[0] | 0),
      (this.B = t[1] | 0),
      (this.C = t[2] | 0),
      (this.D = t[3] | 0),
      (this.E = t[4] | 0),
      (this.F = t[5] | 0),
      (this.G = t[6] | 0),
      (this.H = t[7] | 0));
  }
  get() {
    const { A: e, B: t, C: i, D: r, E: s, F: o, G: a, H: c } = this;
    return [e, t, i, r, s, o, a, c];
  }
  set(e, t, i, r, s, o, a, c) {
    ((this.A = e | 0),
      (this.B = t | 0),
      (this.C = i | 0),
      (this.D = r | 0),
      (this.E = s | 0),
      (this.F = o | 0),
      (this.G = a | 0),
      (this.H = c | 0));
  }
  _cloneInto(e) {
    return (
      (e ||= new this.constructor()).set(...this.get()),
      this._cloneIntoMeta(e)
    );
  }
  process(e, t) {
    for (let h = 0; h < 16; h++, t += 4) Cn[h] = e.getUint32(t, !1);
    for (let h = 16; h < 64; h++) {
      const d = Cn[h - 15],
        f = Cn[h - 2],
        p = Ot(d, 7) ^ Ot(d, 18) ^ (d >>> 3),
        v = Ot(f, 17) ^ Ot(f, 19) ^ (f >>> 10);
      Cn[h] = (v + Cn[h - 7] + p + Cn[h - 16]) | 0;
    }
    let { A: i, B: r, C: s, D: o, E: a, F: c, G: l, H: u } = this;
    for (let h = 0; h < 64; h++) {
      const d = Ot(a, 6) ^ Ot(a, 11) ^ Ot(a, 25),
        f = (u + d + lJ(a, c, l) + fJ[h] + Cn[h]) | 0,
        v = ((Ot(i, 2) ^ Ot(i, 13) ^ Ot(i, 22)) + uJ(i, r, s)) | 0;
      ((u = l),
        (l = c),
        (c = a),
        (a = (o + f) | 0),
        (o = s),
        (s = r),
        (r = i),
        (i = (f + v) | 0));
    }
    ((i = (i + this.A) | 0),
      (r = (r + this.B) | 0),
      (s = (s + this.C) | 0),
      (o = (o + this.D) | 0),
      (a = (a + this.E) | 0),
      (c = (c + this.F) | 0),
      (l = (l + this.G) | 0),
      (u = (u + this.H) | 0),
      this.set(i, r, s, o, a, c, l, u));
  }
  roundClean() {
    sx(Cn);
  }
  destroy() {
    ((this.destroyed = !0), this.set(0, 0, 0, 0, 0, 0, 0, 0), sx(this.buffer));
  }
}

class gJ extends pJ {
  constructor() {
    super(32, dJ);
  }
}

const WR = aJ(() => new gJ(), cJ(1)),
  mJ = [
    {
      file: "stage_window.bml",
      sha256:
        "bdc235dbd50cf13a471a04174dd7361538ef393b49ecdc4d6584a04e73052d15",
    },
    {
      file: "aw_01@cn.png",
      sha256:
        "cbccbee76c3a65a4330c88f62fe72568e325b7d9079c7904b5d7a3467e836bed",
    },
    {
      file: "aw_02@zz.png",
      sha256:
        "b9d533ce5c524e4df38b6d4e1e9d9da43ba9d7b445ab95d318acd4fb9f0e4d6b",
    },
  ];

function HR(n, e, t) {
  if (Array.from(WR(n), (r) => r.toString(16).padStart(2, "0")).join("") !== e)
    throw new Error(`经典仪表资源 ${t} 与已核原件不一致。`);
}

async function wJ(n) {
  const e = await Promise.all(
      mJ.map(async (i) => {
        const r = await n(i.file);
        return (HR(r, i.sha256, i.file), r);
      }),
    ),
    t = new Map([
      ["aw_01@zz", await p2(e[1])],
      ["aw_02@zz", await p2(e[2])],
    ]);
  return { stage: s2(e[0]), textures: t };
}

let nh;

function vJ() {
  return (
    (nh ??= wJ(async (n) => {
      const e = await fetch(`/classic-hud/p948-v1/${encodeURIComponent(n)}`);
      if (!e.ok)
        throw new Error("经典仪表包未安装或读取失败，请关闭此设置后重试。");
      return new Uint8Array(await e.arrayBuffer());
    }).catch((n) => {
      throw ((nh = void 0), n);
    })),
    nh
  );
}

const yJ = [
    [
      "부스터차지.1s",
      "f57976eb3bae2000f6cf979a3ac2bbed9995573ed4026f5ad142b9d0c6e6c924",
    ],
    [
      "부스터풀.1s",
      "19b2e00e9b6f1d8d5ec6141c65f7314abd4686856670c840e274b49611e55d34",
    ],
    [
      "부스터 게이지_1.png",
      "fed057ee15ed3f22fb9dd51ef8b3b100507e13e610f2188732164d2ed994a2d9",
    ],
    [
      "부스터아이콘.png",
      "af60c99202724ac2ab7f674b50b4e37a35a316f9565bc7abe843bfceedf3f961",
    ],
    [
      "부스터 게이지_3.png",
      "3318f79360cf0842cd5d96a5c81352d60d7a0d137f71a74125095be3475649fa",
    ],
    [
      "부스터 게이지_2.png",
      "7412dc8c4411634004ec3075da9027f2c49929a3b3261a7c51031adc011d8b8c",
    ],
    [
      "부스터 게이지_4.png",
      "5589518535a70288bcdbaf1b3a64e66604c111c60dd7865ed23d8e69ede0aed4",
    ],
  ],
  AJ = [
    [
      "팀부스터_차지1.1s",
      "ec516677416befb69b8650028d3adedaabf2a139b3624de79702e5a3c492d02b",
    ],
    [
      "팀부스터_풀1.1s",
      "e459587aeafdeb39f8821d276899e8e625dbbbfad04beb6569c25c674f506ac8",
    ],
    [
      "팀부스터게이지1.png",
      "9f8888465b9c06c1504b45640ad2d96d03aee11ea145d4f0263fdcd5495cc51c",
    ],
    [
      "팀부스터게이지3.png",
      "91aa31eb4ea714788983419bc43c87d3bc79b1fa04789ff236d2b66575cdbc1e",
    ],
    [
      "팀부스터게이지2.png",
      "0a92025c9a8bdbfe1bff0870e92a18798bdce39193184c8537c99b743fe13b3d",
    ],
    [
      "팀부스터아이콘.png",
      "365f54ed43b74bc133a2db9668942d807b57e2badb2c48aefafcb4db2ba47a69",
    ],
    [
      "팀부스터게이지7.png",
      "49d2e76e256df40ba9db750e9f905f17fa33da1486c5c12a84c85d34532bcbbd",
    ],
  ],
  bJ = [
    [
      "팀부스터_차지2.1s",
      "4847dccbc56e35eb7e47d77b9170322e76fc2fd866f2b77e19cb17ee80c188e9",
    ],
    [
      "팀부스터_풀2.1s",
      "58d9fb482158509de9519c3878ef1dc476b7b2d9741f78ec7f563c7c3e692c87",
    ],
    [
      "팀부스터_회색.1s",
      "bdc65a455c41f92853602a6d2d3b6ab46773093b77d1550abb28e6d133a85796",
    ],
    [
      "teambugage1@zz.png",
      "9f8888465b9c06c1504b45640ad2d96d03aee11ea145d4f0263fdcd5495cc51c",
    ],
    [
      "팀부스터게이지2.png",
      "0a92025c9a8bdbfe1bff0870e92a18798bdce39193184c8537c99b743fe13b3d",
    ],
    [
      "팀부스터게이지3.png",
      "91aa31eb4ea714788983419bc43c87d3bc79b1fa04789ff236d2b66575cdbc1e",
    ],
    [
      "팀부스터아이콘.png",
      "365f54ed43b74bc133a2db9668942d807b57e2badb2c48aefafcb4db2ba47a69",
    ],
  ],
  ox = {
    personal: {
      files: yJ,
      modelCount: 2,
      chargeNode: "부스터 게이지01",
      durationMs: 1e3,
    },
    "team-main": {
      files: AJ,
      modelCount: 2,
      chargeNode: "부스터 게이지01",
      durationMs: 1333,
    },
    "team-contribution": {
      files: bJ,
      modelCount: 3,
      chargeNode: "팀전 게이지01",
      durationMs: 1333,
    },
  };

class MJ {
  constructor(e) {
    if (
      ((this.durationMs = e), !Number.isInteger(e) || e <= 0 || e > 4294967295)
    )
      throw new Error("经典氮气条缺少有效的原动画结束时间。");
  }
  durationMs;
  full = !1;
  anchor;
  requested = !1;
  requestFull() {
    ((this.full = !0), (this.anchor = void 0), (this.requested = !0));
  }
  get needsFullPlay() {
    return this.requested;
  }
  update(e) {
    e = Math.trunc(e) >>> 0;
    const t = this.requested;
    return (
      (this.requested = !1),
      this.full
        ? ((this.anchor ??= e),
          (e - this.anchor) >>> 0 >= this.durationMs
            ? (this.reset(), { playFull: t, ended: !0 })
            : { playFull: t, ended: !1 })
        : { playFull: t, ended: !1 }
    );
  }
  reset() {
    ((this.full = !1), (this.anchor = void 0), (this.requested = !1));
  }
}

function kw(n, e) {
  if (e(n)) return n;
  for (const t of n.children) {
    const i = kw(t, e);
    if (i) return i;
  }
}

function qR(n, e = new Set()) {
  if (!n || typeof n != "object" || e.has(n)) return 0;
  e.add(n);
  const t = Reflect.get(n, "base");
  let i = t && typeof t.stopTimeWord == "number" ? t.stopTimeWord : 0;
  for (const r of Object.values(n)) i = Math.max(i, qR(r, e));
  return i;
}

function ax(n, e) {
  if (n.parsed.root.kind !== "node") throw new Error("经典氮气条根节点无效。");
  const t = kw(n.parsed.root, (v) => v.className === "ReCamera"),
    i = t?.camera,
    r = t && n.scene.clientWorldElements?.(t);
  if (
    !i ||
    i.projectionMode !== 1 ||
    !r ||
    i.fieldOfViewController ||
    i.nearClipController ||
    i.farClipController
  )
    throw new Error("经典氮气条原相机未闭合。");
  const s = Math.fround,
    o = (v, w) => [
      s(w * r[v]),
      s(w * r[v + 1]),
      s(w * r[v + 2]),
      s(-w * (r[v] * r[12] + r[v + 1] * r[13] + r[v + 2] * r[14])),
    ],
    a = [...o(0, -1), ...o(8, 1), ...o(4, -1)],
    c = s(i.fieldOfViewDegrees * s(0.008726639673113823)),
    l = Math.tan(c) * s(323.22100830078125),
    u = s(l),
    h = s(l * s(0.75)),
    d = s(i.nearClip),
    f = s(i.farClip),
    p = [
      s(2 / u),
      0,
      0,
      0,
      0,
      s(2 / h),
      0,
      0,
      0,
      0,
      s(1 / s(f - d)),
      s(d / s(d - f)),
      0,
      0,
      0,
      1,
    ];
  Aa(e, a, p);
}

class jl {
  constructor(e, t, i) {
    ((this.models = e), (this.textures = t), (this.variant = i));
    const r = ox[i],
      s = e[0].parsed.root,
      o = s.kind === "node" ? kw(s, (c) => c.name === r.chargeNode) : void 0;
    if (
      !o ||
      !e[0].scene.setNodeScale ||
      !e.every((c) => c.scene.playControllers)
    )
      throw new Error("经典氮气条缺少原集气节点或动画消费者。");
    this.chargeNode = o;
    const a = qR(e[1].parsed);
    if (a !== r.durationMs)
      throw new Error(
        `经典氮气条 full 动画不是已核准的 ${r.durationMs}ms 原件。`,
      );
    this.state = new MJ(a);
    for (const c of e) (c.scene.reset(0), ax(c, this.camera));
  }
  models;
  textures;
  variant;
  state;
  chargeNode;
  camera = Object.assign(new a5(), { matrixWorldAutoUpdate: !1 });
  world = new D1();
  viewport = new Y2();
  disposed = !1;
  hasFrame = !1;
  initialized = !1;
  static async load(e, t = "personal") {
    const i = ox[t],
      r = await Promise.all(
        i.files.map(async ([a, c]) => {
          const l = `stage_/common/action/${a}`,
            u = e.canonicalCandidates(l);
          if (u.length !== 1) throw new Error(`经典氮气条原件 ${l} 必须唯一。`);
          const h = await u[0].bytes();
          return (HR(h, c, l), h);
        }),
      ),
      s = new Map(),
      o = [];
    try {
      for (let a = 0; a < i.modelCount; a++) {
        const c = `stage_/common/action/${i.files[a][0]}`,
          l = y9(r[a]),
          u = await W1(l, e, c, (h) => ya(e, c, h), {
            advanceEnvironment: !1,
            convertClientCoordinates: !1,
            textureCache: s,
          });
        o.push({ parsed: l, scene: u });
      }
      return new jl(o, s, t);
    } catch (a) {
      for (const c of o) c.scene.dispose();
      for (const c of s.values()) c.dispose();
      throw a;
    }
  }
  requestFull() {
    this.disposed || this.state.requestFull();
  }
  update(e, t) {
    if (this.disposed) return;
    if (!Number.isFinite(t)) throw new Error("经典氮气条气量无效。");
    if (((e = Math.trunc(e) >>> 0), !this.initialized)) {
      for (const o of this.models) o.scene.reset(e);
      this.initialized = !0;
    }
    const i = this.chargeNode.scale;
    this.models[0].scene.setNodeScale(this.chargeNode, [
      Math.fround(i[0] * Math.fround(t + t)),
      i[1],
      i[2],
    ]);
    const r = this.state.full ? 1 : 0;
    (this.state.needsFullPlay && this.models[1].scene.playControllers(e, 0),
      this.models[2]?.scene.update(e),
      this.models[r].scene.update(e),
      this.state.update(e).ended &&
        (this.variant === "team-contribution" &&
          this.models[0].scene.setNodeScale(this.chargeNode, [0, i[1], i[2]]),
        this.models[0].scene.playControllers(e, 0),
        this.models[0].scene.update(e)),
      (this.hasFrame = !0));
  }
  reset() {
    if (this.disposed) return;
    (this.state.reset(), (this.hasFrame = !1), (this.initialized = !1));
    for (const t of this.models) t.scene.reset(0);
    const e = this.chargeNode.scale;
    this.models[0].scene.setNodeScale(this.chargeNode, [0, e[1], e[2]]);
  }
  render(e, t, i) {
    this.disposed ||
      !this.hasFrame ||
      this.drawModel(this.models[this.state.full ? 1 : 0], e, t, i);
  }
  renderIcon(e, t, i) {
    this.disposed ||
      !this.hasFrame ||
      !this.models[2] ||
      this.drawModel(this.models[2], e, t, i);
  }
  drawModel(e, t, i, r) {
    ax(e, this.camera);
    const s = Math.min(i / 800, r / 600),
      o = 800 * s,
      a = 600 * s;
    t.getViewport(this.viewport);
    const c = t.autoClear;
    ((t.autoClear = !1), this.world.add(e.scene.object));
    try {
      (t.setViewport((i - o) / 2, 0, o, a),
        t.render(this.world, this.camera),
        t.clearDepth());
    } finally {
      (e.scene.object.removeFromParent(),
        t.setViewport(this.viewport),
        (t.autoClear = c));
    }
  }
  dispose() {
    if (!this.disposed) {
      ((this.disposed = !0), this.state.reset(), this.world.clear());
      for (const e of this.models) e.scene.dispose();
      for (const e of this.textures.values()) e.dispose();
      this.textures.clear();
    }
  }
}

class xJ {
  scene = new D1();
  camera = new a5();
  geometry = SJ();
  material;
  texture;
  mesh;
  savedViewport = new Y2();
  constructor(e) {
    ((this.texture = new J9(e.pixels, e.width, e.height, e9, _9)),
      (this.texture.name = "ingame_shadow"),
      (this.texture.colorSpace = v9),
      (this.texture.flipY = !1),
      (this.texture.wrapS = this.texture.wrapT = F1),
      (this.texture.magFilter = this.texture.minFilter = h9),
      (this.texture.generateMipmaps = !1),
      (this.texture.unpackAlignment = 1),
      (this.texture.needsUpdate = !0),
      (this.material = new Vt({
        name: "KartRider IngameShadow",
        uniforms: {
          map: { value: this.texture },
          viewport: { value: new B2(1600, 900) },
        },
        vertexShader: `
        precision highp float;
        attribute vec3 position;
        attribute vec2 uv;
        uniform vec2 viewport;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          // P3528 window quads use the authored -0.5 px offset and window depth; the
          // derived HUD shares this mapping (z is a 0..1 window depth).
          gl_Position = vec4(
            position.x * 2.0 / viewport.x - 1.0,
            1.0 - position.y * 2.0 / viewport.y,
            position.z * 2.0 - 1.0,
            1.0
          );
        }
      `,
        fragmentShader: `
        precision highp float;
        uniform sampler2D map;
        varying vec2 vUv;
        void main() {
          gl_FragColor = texture2D(map, vUv);
          if (gl_FragColor.a <= 0.5 / 255.0) discard;
        }
      `,
        transparent: !0,
        depthTest: !0,
        depthWrite: !1,
        depthFunc: y1,
        blending: u1,
        blendSrc: l1,
        blendDst: v1,
        blendEquation: R9,
        toneMapped: !1,
      })),
      (this.mesh = new D2(this.geometry, this.material)),
      (this.mesh.frustumCulled = !1),
      (this.scene.name = "ingame-shadow"),
      this.scene.add(this.mesh));
  }
  render(e, t, i) {
    e.getViewport(this.savedViewport);
    const r = e.autoClear;
    e.autoClear = !1;
    try {
      (this.material.uniforms.viewport.value.set(t, i),
        e.setViewport(0, 0, t, i),
        e.render(this.scene, this.camera));
    } finally {
      (e.setViewport(this.savedViewport), (e.autoClear = r));
    }
  }
  dispose() {
    (this.mesh.removeFromParent(),
      this.geometry.dispose(),
      this.material.dispose(),
      this.texture.dispose());
  }
}

function SJ() {
  const n = new t9(),
    e = new Float32Array([
      -0.5,
      -0.5,
      H5,
      -0.5,
      899.5,
      H5,
      1599.5,
      -0.5,
      H5,
      1599.5,
      899.5,
      H5,
    ]),
    t = new Float32Array([0, 0, 0, 1, 1, 0, 1, 1]);
  return (
    n.setAttribute("position", new _0(e, 3)),
    n.setAttribute("uv", new _0(t, 2)),
    n.setIndex(new _0(new Uint16Array([0, 1, 2, 2, 1, 3]), 1)),
    n
  );
}

const ih = KR(
    "VVVVVVVVxb8AAAAAAADgvxEREREREYE/VVVVVVVVpT8aoAEaoAEqvxdswRZswVa/NMdWpeMdxz4aoAEaoAH6PoPIyW0wXyRAAAAAAAAAOEMAAGAaYbSQPQAAYBphtJA9AABAVPshuT9zcAMuihljOw==",
  ),
  rh = KR(
    [
      "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA8D8xbW0XLrlzvyy0KbymF7k/AAAA4BgnPrwAAAAAAADwP/tpFAEGrZO/C6ZpPLj4yD8AAADAGW1ivAAAAAAAAPA/",
      "WiKdk+oLpr8Gn9UuBpTSPwAAAKCN0nW8AAAAAAAA8D/PlWuGoXyzv2Oprqbifdg/AAAA4O0sZ7wAAAAAAADwP3kS+nNoOr6/O/YGOF0r3j8AAAAgiQ1ePAAAAAAAAPA/",
      "dHnFW2eSxb/IaK45O8fhPwAAACDdJYs8AAAAAAAA8D/9oqtT/g3Nv9YdCSXzTOQ/AAAAIGoHaDwAAAAAAADwPzLv/Jl5gso/zTt/Zp6g5j8AAAAgNN2LvAAAAAAAAOA/",
      "WHcklMwzwT9BFxVrgLzoPwAAACDhxYK8AAAAAAAA4D+HjOaas3OsP6OhDilmm+o/AAAA4DD2OTwAAAAAAADgP06ckH8sSp2/sb2A8bI47D8AAACAseB2vAAAAAAAAOA/",
      "dVpFZXUIvr9GjTLPa5DtPwAAACDmV3Q8AAAAAAAA4D8t+Kx2MaCkP9otxlZBn+4/AAAA4LFghzwAAAAAAADQP9VnWQ4fHay/sFz3z5di7z8AAAAgF2J1PAAAAAAAANA/",
      "UC9ZD2Whm78mJdGjjdjvPwAAAED2fYi8AAAAAAAAwD8AAAAAAAAAAAAAAAAAAPA/AAAAAAAAAAAAAAAAAAAAAFAvWQ9loZs/JiXRo43Y7z8AAABA9n2IvAAAAAAAAMC/",
      "1WdZDh8drD+wXPfPl2LvPwAAACAXYnU8AAAAAAAA0L8t+Kx2MaCkv9otxlZBn+4/AAAA4LFghzwAAAAAAADQv3VaRWV1CL4/Ro0yz2uQ7T8AAAAg5ld0PAAAAAAAAOC/",
      "TpyQfyxKnT+xvYDxsjjsPwAAAICx4Ha8AAAAAAAA4L+HjOaas3Osv6OhDilmm+o/AAAA4DD2OTwAAAAAAADgv1h3JJTMM8G/QRcVa4C86D8AAAAg4cWCvAAAAAAAAOC/",
      "Mu/8mXmCyr/NO39mnqDmPwAAACA03Yu8AAAAAAAA4L/9oqtT/g3NP9YdCSXzTOQ/AAAAIGoHaDwAAAAAAADwv3R5xVtnksU/yGiuOTvH4T8AAAAg3SWLPAAAAAAAAPC/",
      "eRL6c2g6vj879gY4XSvePwAAACCJDV48AAAAAAAA8L/PlWuGoXyzP2Oprqbifdg/AAAA4O0sZ7wAAAAAAADwv1oinZPqC6Y/Bp/VLgaU0j8AAACgjdJ1vAAAAAAAAPC/",
      "+2kUAQatkz8Lpmk8uPjIPwAAAMAZbWK8AAAAAAAA8L8xbW0XLrlzPyy0KbymF7k/AAAA4BgnPrwAAAAAAADwvwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPC/",
      "MW1tFy65cz8stCm8phe5vwAAAOAYJz48AAAAAAAA8L/7aRQBBq2TPwumaTy4+Mi/AAAAwBltYjwAAAAAAADwv1oinZPqC6Y/Bp/VLgaU0r8AAACgjdJ1PAAAAAAAAPC/",
      "z5VrhqF8sz9jqa6m4n3YvwAAAODtLGc8AAAAAAAA8L95EvpzaDq+Pzv2BjhdK96/AAAAIIkNXrwAAAAAAADwv3R5xVtnksU/yGiuOTvH4b8AAAAg3SWLvAAAAAAAAPC/",
      "/aKrU/4NzT/WHQkl80zkvwAAACBqB2i8AAAAAAAA8L8y7/yZeYLKv807f2aeoOa/AAAAIDTdizwAAAAAAADgv1h3JJTMM8G/QRcVa4C86L8AAAAg4cWCPAAAAAAAAOC/",
      "h4zmmrNzrL+joQ4pZpvqvwAAAOAw9jm8AAAAAAAA4L9OnJB/LEqdP7G9gPGyOOy/AAAAgLHgdjwAAAAAAADgv3VaRWV1CL4/Ro0yz2uQ7b8AAAAg5ld0vAAAAAAAAOC/",
      "LfisdjGgpL/aLcZWQZ/uvwAAAOCxYIe8AAAAAAAA0L/VZ1kOHx2sP7Bc98+XYu+/AAAAIBdidbwAAAAAAADQv1AvWQ9loZs/JiXRo43Y778AAABA9n2IPAAAAAAAAMC/",
      "AAAAAAAAAAAAAAAAAADwvwAAAAAAAAAAAAAAAAAAAABQL1kPZaGbvyYl0aON2O+/AAAAQPZ9iDwAAAAAAADAP9VnWQ4fHay/sFz3z5di778AAAAgF2J1vAAAAAAAANA/",
      "LfisdjGgpD/aLcZWQZ/uvwAAAOCxYIe8AAAAAAAA0D91WkVldQi+v0aNMs9rkO2/AAAAIOZXdLwAAAAAAADgP06ckH8sSp2/sb2A8bI47L8AAACAseB2PAAAAAAAAOA/",
      "h4zmmrNzrD+joQ4pZpvqvwAAAOAw9jm8AAAAAAAA4D9YdySUzDPBP0EXFWuAvOi/AAAAIOHFgjwAAAAAAADgPzLv/Jl5gso/zTt/Zp6g5r8AAAAgNN2LPAAAAAAAAOA/",
      "/aKrU/4Nzb/WHQkl80zkvwAAACBqB2i8AAAAAAAA8D90ecVbZ5LFv8horjk7x+G/AAAAIN0li7wAAAAAAADwP3kS+nNoOr6/O/YGOF0r3r8AAAAgiQ1evAAAAAAAAPA/",
      "z5VrhqF8s79jqa6m4n3YvwAAAODtLGc8AAAAAAAA8D9aIp2T6gumvwaf1S4GlNK/AAAAoI3SdTwAAAAAAADwP/tpFAEGrZO/C6ZpPLj4yL8AAADAGW1iPAAAAAAAAPA/",
      "MW1tFy65c78stCm8phe5vwAAAOAYJz48AAAAAAAA8D8=",
    ].join(""),
  ),
  CJ = new DataView(ih.buffer, ih.byteOffset, ih.byteLength),
  _8 = new DataView(rh.buffer, rh.byteOffset, rh.byteLength),
  cx = new DataView(new ArrayBuffer(8));

function Ro(n) {
  cx.setFloat64(0, n, !0);
  const e = cx.getUint16(6, !0) & 32767;
  if (Object.is(n, 0)) return n * 0.9999999999999999;
  if (!Number.isFinite(n) || n < 0 || e < 12336 || e > 16629)
    throw new Error(
      "P3528 native sin input is outside the proven non-negative normal SSE branch.",
    );
  const t = (k) => CJ.getFloat64(k, !0),
    i = t(64) * n,
    r = EJ(i) & 63,
    s = i + t(72) - t(72),
    o = t(96) * s,
    a = t(80) * s,
    c = n - o,
    l = c - a,
    u = c - l - a,
    h = r * 32,
    d = _8.getFloat64(h, !0),
    f = _8.getFloat64(h + 8, !0),
    p = _8.getFloat64(h + 16, !0),
    v = _8.getFloat64(h + 24, !0);
  let w = t(48) * c,
    g = t(56) * c;
  const y = l * l,
    b = l * l;
  ((w *= l), (g *= l));
  let A = t(16) * y,
    x = t(24) * b,
    M = (d + v) * l,
    E = f;
  ((M *= y), (E *= b));
  const _ = y * y,
    C = b * b;
  ((w += t(32)),
    (g += t(40)),
    (A += t(0)),
    (x += t(8)),
    (w *= _),
    (g *= C),
    (A += w),
    (x += g),
    (A *= M),
    (x *= E));
  const S = f * l - (d + v);
  let G = s * t(104) - u;
  ((G *= S), (G += p));
  const I = v * l,
    L = d * l + (I + f);
  return (
    (G += f - (I + f) + I),
    (G += I + f - L + d * l),
    (G += A),
    (G += x),
    L + G
  );
}

function EJ(n) {
  const e = Math.floor(n),
    t = n - e,
    i = t < 0.5 ? e : t > 0.5 ? e + 1 : e + (e & 1);
  if (i < -2147483648 || i > 2147483647)
    throw new Error("P3528 cvtsd2si overflow.");
  return i;
}

function KR(n) {
  return Uint8Array.from(atob(n), (e) => e.charCodeAt(0));
}

function Jp() {
  return { mainRatio: 0, instantRatio: 0, deadlineMs: 0 };
}

function jR(n, e, t, i, r) {
  if (
    (X3(e, "flat gauge pulse tick"), !Number.isFinite(t) || !Number.isFinite(i))
  )
    throw new Error(`P3528 flat gauge pulse ratio ${t}/${i} 无效。`);
  const s = H0(r === "V1GenTacho" ? 0.99000001 : 1),
    o = H0(H0(t) * s),
    a = H0(H0(i) * s);
  let c = n.deadlineMs;
  return (
    (n.mainRatio !== o || n.instantRatio !== a) && (c = 4294967295),
    c === 4294967295 && (c = (e + 1e3) >>> 0),
    c === 0 || e >= c
      ? { state: { mainRatio: o, instantRatio: a, deadlineMs: 0 }, alpha: 255 }
      : {
          state: { mainRatio: o, instantRatio: a, deadlineMs: c },
          alpha: XR(e),
        }
  );
}

function XR(n) {
  const e = H0(H0(n) * H0(0.0025)),
    t = H0(Ro(e));
  return Math.trunc(H0(H0(Math.abs(t)) * H0(255))) & 255;
}

function TJ(n) {
  return (
    X3(n, "charger init now"),
    {
      count: 0,
      previousCount: 0,
      countInitialized: !1,
      interpolationCapacity: 0,
      interpolating: !1,
      interpolationStep: 0,
      active: !1,
      durationMs: 3e3,
      activationMs: n,
      ratio: 0,
    }
  );
}

function _J(n, e, t, i, r) {
  (X3(e, "charger frame tick"),
    X3(t, "charger wall clock"),
    X3(i.count, "charger count"),
    X3(i.capacity, "charger capacity"),
    X3(i.durationMs, "charger duration"));
  const s = [],
    o = i.capacity > 0 ? i.capacity : n.interpolationCapacity;
  if (!n.countInitialized)
    return (
      i.count !== 0 && r.charger
        ? (s.push({ kind: "visibility", name: "charger", visible: !0 }),
          o > 0 &&
            o - 1 === i.count &&
            r.charger2 &&
            s.push({ kind: "visibility", name: "charger2", visible: !0 }))
        : i.count === 0 &&
          (r.charger &&
            s.push({ kind: "visibility", name: "charger", visible: !1 }),
          r.charger2 &&
            s.push({ kind: "visibility", name: "charger2", visible: !1 })),
      i.active &&
        r.chargerBg &&
        (s.push({ kind: "visibility", name: "charger_bg", visible: !0 }),
        s.push({
          kind: "play",
          name: "charger_bg",
          durationMs: i.durationMs,
          sourceTickMs: (t - e) >>> 0,
        })),
      {
        state: {
          ...n,
          countInitialized: !0,
          count: i.count,
          previousCount: i.count,
          interpolationCapacity: o,
          interpolating: !1,
          interpolationStep: 0,
          active: i.active,
          activationMs: e,
          ratio: o > 0 ? ah(i.count, o) : 0,
        },
        commands: s,
      }
    );
  let a = i.capacity > 0 ? { ...n, interpolationCapacity: i.capacity } : n;
  if (n.count !== i.count) {
    let u = n.previousCount;
    const h = i.capacity > 0 ? i.capacity : n.interpolationCapacity;
    let d = n.interpolating,
      f = n.interpolationStep,
      p = n.active,
      v = n.activationMs;
    (!p &&
      n.count < i.count &&
      ((d = !0),
      (p = !1),
      (u = n.count),
      h > 0 && h - 1 === i.count
        ? (r.charger2 &&
            (s.push({ kind: "visibility", name: "charger2", visible: !0 }),
            s.push({
              kind: "play",
              name: "charger2",
              durationMs: 0,
              sourceTickMs: 0,
            })),
          r.charger &&
            s.push({ kind: "visibility", name: "charger", visible: !1 }))
        : (r.charger2 &&
            s.push({ kind: "visibility", name: "charger2", visible: !1 }),
          r.charger &&
            s.push({
              kind: "play",
              name: "charger",
              durationMs: 0,
              sourceTickMs: 0,
            }))),
      !p &&
        i.active &&
        ((d = !1),
        (p = !0),
        (v = e),
        r.chargerBg &&
          (s.push({ kind: "visibility", name: "charger_bg", visible: !0 }),
          s.push({
            kind: "play",
            name: "charger_bg",
            durationMs: i.durationMs,
            sourceTickMs: (t - e) >>> 0,
          }))),
      (a = {
        ...n,
        count: i.count,
        previousCount: u,
        interpolationCapacity: h,
        interpolating: d,
        interpolationStep: f,
        active: p,
        activationMs: v,
      }),
      i.count !== 0 && !(h > 0 && h - 1 === i.count)
        ? r.charger &&
          s.push({ kind: "visibility", name: "charger", visible: !0 })
        : i.count === 0 &&
          (r.charger &&
            s.push({ kind: "visibility", name: "charger", visible: !1 }),
          r.charger2 &&
            s.push({ kind: "visibility", name: "charger2", visible: !1 })));
  }
  if (a.active) {
    const u = (e - a.activationMs) >>> 0,
      h = H0(H0(1) - H0(H0(u) / H0(i.durationMs)));
    return u > i.durationMs && !i.active
      ? {
          state: {
            ...a,
            count: i.count,
            active: !1,
            durationMs: i.durationMs,
            ratio: ah(i.count, i.capacity),
          },
          commands: s,
        }
      : { state: { ...a, durationMs: i.durationMs, ratio: h }, commands: s };
  }
  if (!a.interpolating) return { state: a, commands: s };
  const c = a.interpolationStep + 1,
    l =
      a.interpolationCapacity > 0
        ? H0(
            H0(H0(a.previousCount) + H0(H0(c) / H0(10))) /
              H0(a.interpolationCapacity),
          )
        : 0;
  return c !== 10
    ? { state: { ...a, interpolationStep: c, ratio: l }, commands: s }
    : {
        state: {
          ...a,
          interpolationStep: 0,
          interpolating: !1,
          ratio:
            a.interpolationCapacity > 0
              ? ah(i.count, a.interpolationCapacity)
              : 0,
        },
        commands: s,
      };
}

function GJ(n, e) {
  const t = e.filter((i) => i.kind === "visibility");
  return t.length === 0
    ? n
    : { ...n, ...Object.fromEntries(t.map((i) => [i.name, i.visible])) };
}

function Os(n, e, t) {
  if (!Number.isFinite(e))
    throw new Error(`P3528 flat gauge ratio=${e} 无效。`);
  const i = H0(t === "V1GenTacho" ? H0(e) * H0(0.99000001) : e);
  return {
    ...n,
    worldRect: {
      ...n.worldRect,
      right: Jc(n.worldRect.left, n.worldRect.right, i),
    },
    framebufferRect: {
      ...n.framebufferRect,
      right: Jc(n.framebufferRect.left, n.framebufferRect.right, i),
    },
    uv: { ...n.uv, right: Jc(n.uv.left, n.uv.right, i) },
  };
}

function sh(n, e, t, i) {
  if (!Number.isFinite(t))
    throw new Error(`P3528 flat gauge marker ratio=${t} 无效。`);
  const r = lx(e, "altSize"),
    s = lx(e, "altRelativePos"),
    o = H0(i === "V1GenTacho" ? H0(t) * H0(0.99000001) : t),
    a = H0(H0(e.worldRect.right) - H0(e.worldRect.left)),
    c = H0(a * H0(0.5)),
    l = H0(H0(n.worldRect.right) - H0(n.worldRect.left)),
    u = H0(Jc(n.worldRect.left, n.worldRect.right, o) - c),
    h = H0(H0(H0(n.worldRect.left) - c) + s),
    d = H0(H0(l * H0(0.99000001)) + H0(n.worldRect.left)),
    f = H0(H0(d - c) + r),
    p = Math.min(Math.max(u, h), f),
    v = H0(p - H0(e.worldRect.left));
  return {
    ...e,
    worldRect: {
      ...e.worldRect,
      left: p,
      right: H0(H0(e.worldRect.right) + v),
    },
    framebufferRect: {
      ...e.framebufferRect,
      left: H0(H0(e.framebufferRect.left) + v),
      right: H0(H0(e.framebufferRect.right) + v),
    },
  };
}

function BJ(n, e) {
  if (!Number.isFinite(e))
    throw new Error(`P3528 rect gauge ratio=${e} 无效。`);
  const t = H0(e);
  return {
    ...n,
    worldRect: {
      ...n.worldRect,
      top: oh(n.worldRect.top, n.worldRect.bottom, t),
    },
    framebufferRect: {
      ...n.framebufferRect,
      top: oh(n.framebufferRect.top, n.framebufferRect.bottom, t),
    },
    uv: { ...n.uv, top: oh(n.uv.top, n.uv.bottom, t) },
  };
}

function Jc(n, e, t) {
  return H0(H0(H0(H0(e) - H0(n)) * t) + H0(n));
}

function oh(n, e, t) {
  return H0(H0(e) - H0(H0(H0(e) - H0(n)) * t));
}

function lx(n, e) {
  const t = T(n.node, e);
  if (t === void 0) throw new Error(`${n.node.name} 缺少 P3528 ${e}。`);
  return H0(j2(t, 2, e)[0]);
}

const H0 = Math.fround;

function ah(n, e) {
  return H0(H0(n >>> 0) / H0(e >>> 0));
}

function X3(n, e) {
  if (!Number.isInteger(n) || n < 0 || n > 4294967295)
    throw new Error(`P3528 ${e}=${n} 无效。`);
}

const Lw = "stage_/speedIndiGame",
  ux = "stage_speedIndiGame.rho",
  RJ = `${Lw}/ranklist_mySpot.bml`,
  IJ = `${Lw}/ranklist_spot.bml`;

async function kJ(n, e) {
  const t = await hx(n, RJ, "myRider"),
    i = await hx(n, IJ, "rankSlot"),
    r = j2(QR(i.node, "windowRect"), 4, "rankSlot.windowRect"),
    s = JR(i.source, "rid"),
    o = l5(lt(s, new Map()), { left: 0, top: 0, right: r[2], bottom: r[3] });
  return {
    listGeometry: lt(e, new Map()),
    rowWidth: r[2],
    rowHeight: r[3],
    local: t,
    other: i,
    nameRect: o,
  };
}

async function hx(n, e, t) {
  const i = s2(await ZR(n, e).bytes()),
    r = JR(i, t),
    s = {
      ...r,
      name: "Window",
      children: r.children
        .filter(
          (a) =>
            !(t === "myRider" && T(a, "name") === "logout") &&
            a.name !== "Label" &&
            !["ping", "exceedCon"].includes(T(a, "name") ?? ""),
        )
        .map(YR),
    },
    o = await UJ(n, WJ(s));
  return {
    height: j2(QR(r, "windowRect"), 4, "rank row windowRect")[3],
    node: s,
    source: r,
    tree: d5(s, o),
    textures: o,
  };
}

function YR(n) {
  return {
    ...n,
    name: n.name === "RankSlot" ? "Window" : n.name,
    attributes: n.attributes.map((e) =>
      e.name === "clientRect" ? { name: "leftTopWH", value: e.value } : e,
    ),
    children: n.children.map(YR),
  };
}

function LJ(n, e, t, i) {
  const r = [];
  return (
    e.forEach((s) => {
      const o = s.local ? n.local : n.other,
        a = { x: t.left + s.x, y: t.top + s.y },
        c = {
          visibility: (f) => (T(f, "name") === "logout" ? !!s.out : void 0),
          text: (f) =>
            T(f, "name") === "rankStr"
              ? s.rank > 9
                ? "X"
                : String(s.rank)
              : void 0,
        },
        l =
          i === void 0
            ? dn(o.tree, n.rowWidth, o.height, c)
            : i.drawOrder(o.tree, n.rowWidth, o.height, c),
        u =
          s.color === void 0
            ? o.textures
            : new Map(
                [...o.textures].map(([f, p]) => [
                  f,
                  VJ.has(f) ? NJ(p, s.color) : p,
                ]),
              ),
        h = dt(l, u, i);
      for (const f of h) r.push(zJ(f, a.x, a.y));
      const d = PJ(
        s.disconnected ? `${s.name} [dis]` : s.name,
        s.finished && !s.local ? "#0000ff" : "black",
      );
      if (d) {
        const f = a.x + n.nameRect.left,
          p = n.nameRect.bottom - n.nameRect.top,
          v = a.y + n.nameRect.top + (p - d.height) / 2;
        r.push({
          kind: "panel",
          node: o.tree.node,
          textureName: "rankName",
          texture: d,
          worldRect: {
            left: f,
            top: v,
            right: f + d.width,
            bottom: v + d.height,
          },
          framebufferRect: {
            left: f,
            top: v,
            right: f + d.width,
            bottom: v + d.height,
          },
          uv: { left: 0, top: 0, right: 1, bottom: 1 },
        });
      }
    }),
    r
  );
}

function PJ(n, e = "black") {
  if (n === "" || typeof document > "u") return;
  const t = JSON.stringify([n, e]),
    i = S3.get(t);
  if (i !== void 0) return (S3.delete(t), S3.set(t, i), i);
  const r = (FJ ??= document.createElement("canvas")),
    s = r.getContext("2d");
  if (!s) return;
  const o = 'bold 16px "P3528 Source Han Sans CN Ready", sans-serif';
  s.font = o;
  const a = Math.max(1, Math.ceil(s.measureText(n).width) + 6),
    c = 20;
  ((r.width = a),
    (r.height = c),
    (s.font = o),
    (s.textBaseline = "middle"),
    (s.lineJoin = "round"),
    (s.lineWidth = 3),
    s.clearRect(0, 0, a, c),
    (s.strokeStyle = e),
    s.strokeText(n, 3, c / 2),
    (s.fillStyle = "white"),
    s.fillText(n, 3, c / 2));
  const l = s.getImageData(0, 0, a, c),
    u = { width: a, height: c, pixels: new Uint8Array(l.data.buffer.slice(0)) };
  return (S3.set(t, u), S3.size > DJ && S3.delete(S3.keys().next().value), u);
}

let FJ;

const DJ = 256,
  S3 = new Map(),
  VJ = new Set(["rank_slot_observer2", "내순위표시_2", "내순위표시_간소화_2"]);

function NJ(n, e) {
  const t = ch.get(n)?.get(e);
  if (t) return t;
  const i = (e >>> 16) & 255,
    r = (e >>> 8) & 255,
    s = e & 255,
    o = new Uint8Array(n.pixels.length);
  for (let l = 0; l < n.pixels.length; l += 4)
    ((o[l] = i), (o[l + 1] = r), (o[l + 2] = s), (o[l + 3] = n.pixels[l + 3]));
  const a = { width: n.width, height: n.height, pixels: o };
  let c = ch.get(n);
  return (c || ((c = new Map()), ch.set(n, c)), c.set(e, a), a);
}

const ch = new WeakMap();

function OJ(n, e) {
  return l5(n.listGeometry, e);
}

function zJ(n, e, t) {
  const i = (r) => ({
    left: r.left + e,
    top: r.top + t,
    right: r.right + e,
    bottom: r.bottom + t,
  });
  if (n.kind === "panel" && "framebufferRect" in n)
    return {
      ...n,
      worldRect: i(n.worldRect),
      framebufferRect: i(n.framebufferRect),
    };
  if (n.kind === "char-panel" && "framebufferQuads" in n) {
    const r = (s) => ({
      ...s,
      left: s.left + e,
      top: s.top + t,
      right: s.right + e,
      bottom: s.bottom + t,
    });
    return {
      ...n,
      worldQuads: n.worldQuads.map(r),
      framebufferQuads: n.framebufferQuads.map(r),
    };
  }
  throw new Error(`P3528 rank row command ${n.kind} 尚未映射。`);
}

async function UJ(n, e) {
  return new Map(await Promise.all(e.map(async (t) => [t, await $J(n, t)])));
}

async function $J(n, e) {
  if (e === "out@zz") {
    const t = `stage_/common/${e}.png`,
      i = n.canonicalCandidates(t);
    if (
      i.length !== 1 ||
      i[0].sourceKind !== "rho" ||
      i[0].sourceName.toLowerCase() !== "stage_common.rho"
    )
      throw new Error(`${t} requires its original shared resource.`);
    return p2(await i[0].bytes());
  }
  return p2(await ZR(n, `${Lw}/${e}.png`).bytes());
}

function ZR(n, e) {
  const t = n.canonicalCandidates(e);
  if (t.length !== 1)
    throw new Error(`${e} source 数量必须为 1，实际 ${t.length}。`);
  const i = t[0];
  if (i.sourceKind !== "rho" || i.sourceName.toLowerCase() !== ux.toLowerCase())
    throw new Error(`${e} 必须来自 ${ux}。`);
  return i;
}

function WJ(n) {
  const e = new Set(),
    t = [n];
  for (; t.length > 0;) {
    const i = t.pop(),
      r = T(i, "texture");
    (r && e.add(r), t.push(...i.children));
  }
  return [...e].sort();
}

function QR(n, e) {
  const t = T(n, e);
  if (t === void 0) throw new Error(`P3528 ${n.name}.${e} 缺失。`);
  return t;
}

function JR(n, e) {
  const t = [],
    i = (r) => {
      (T(r, "name") === e && t.push(r), r.children.forEach(i));
    };
  if ((i(n), t.length !== 1))
    throw new Error(`P3528 rank row ${e} 数量必须为 1，实际 ${t.length}。`);
  return t[0];
}

const l3 = "stage_/speedIndiGame",
  u3 = "stage_speedIndiGame.rho",
  dx = "stage_/speedTeamGame",
  fx = "stage_speedTeamGame.rho",
  Zr = "item/slot",
  Qr = "item.rho",
  px = 350,
  HJ = `${l3}/screenui.bml`,
  gx = "ingameShadow",
  qJ = "0e161c8a359e8c6fa697b2e8735f2ad479326a7b15209baa278ae473074961e4",
  mx = 512,
  wx = 384,
  KJ = new Set([
    "big_num",
    "diagonal",
    "laptime_best@zz",
    "laptime_time@zz",
    "small_num",
    "time_num",
  ]);

async function eI(n, e, t, i) {
  const [r, s, o, a, c, l] = await Promise.all([
      n00(n),
      i00(n, vx(e.folder, t)),
      s00(n, t00(e)),
      r00(n, vx(e.folder, t)),
      QJ(n),
      ZJ(n),
    ]),
    u =
      e.type !== "XGenTacho" &&
      e.type !== "V1GenTacho" &&
      e.type !== "XunGenTacho";
  return {
    time: r,
    boost: s,
    items: o,
    teamBoost: a,
    teamBoostVisible: u,
    boostVisible: i <= 6,
    rank: c,
    shadow: l,
  };
}

class tI extends RaceHudController { constructor(definition, minimap) { super(definition, minimap, raceHudDependencies); } }

function jJ(n, e, t, i, r) {
  const s = g00(e.totalLaps, "total lap"),
    o = Math.min(s, Math.max(1, Pw(e.currentLap, "current lap"))),
    a = Eo(e.elapsedMs),
    c = Eo(e.bestMs ?? 0),
    l = (h) => {
      switch (h) {
        case "lap-current":
          return o.toString();
        case "lap-total":
          return s.toString();
        case "elapsed-min":
          return a.min;
        case "elapsed-sec":
          return a.sec;
        case "elapsed-mil":
          return a.mil;
        case "best-min":
          return c.min;
        case "best-sec":
          return c.sec;
        case "best-mil":
          return c.mil;
      }
    },
    u = {
      visibility: (h) =>
        e.bestMs === void 0 && T(h, "name") === "bestinfo" ? !1 : void 0,
      text: (h) => {
        const d = n.textBindings.get(h);
        return d === void 0 ? void 0 : l(d);
      },
    };
  return dt(
    r === void 0 ? dn(n.tree, t, i, u) : r.drawOrder(n.tree, t, i, u),
    n.textures,
    r,
  );
}

function XJ(n, e, t, i, r, s) {
  const o = [],
    a = [];
  e.forEach((l, u) => {
    if (l !== -1 && l !== 6 && l !== 14)
      throw new Error(`P3528 boost-only item slot 不接受 id=${l}。`);
    const h = u === 0 ? n.current : n.reserve,
      d = sI(n, u, e.length),
      f = bx(
        h.node,
        n.frameTextureName,
        n.frameTexture,
        d,
        f00(h.uvPixels, n.frameTexture),
      );
    if ((o.push(f), l === -1)) return;
    const p = t[u] ? Math.floor((r - i) / 100) % 2 === 0 : l === 14,
      v = rI(d, -h.adjust),
      w =
        s === void 0 || e.length !== 2
          ? v
          : d00(u00(n, 1 - u, e.length), v, h00(Math.max(0, Math.min(1, s))));
    a[u] = bx(
      h.node,
      p ? "item14" : "item6",
      p ? n.teamBoostTexture : n.boostTexture,
      w,
      p00(),
    );
  });
  const c = s === void 0 ? a : [...a].reverse();
  return [...o, ...c.filter((l) => l !== void 0)];
}

function YJ(n, e, t, i, r, s) {
  const o = dt(
      s.drawOrder(n.tree, i, r, {
        visibility: (d) => (d === n.full ? e.fullVisible : void 0),
      }),
      n.textures,
      s,
    ),
    a = Xl(o, n.gauge, "team boost gauge"),
    c = Os(a, e.ratio, "V1GenTacho"),
    l = nI(c, Xl(o, n.marker, "team boost marker")),
    u = C2(Ro(C2(C2(t) * C2(0.003)))),
    h = Math.trunc(C2(C2(Math.abs(u)) * C2(255))) & 255;
  return o.map((d) =>
    d.node === n.gauge
      ? c
      : d.node === n.marker
        ? { ...l, alpha: h }
        : d.node === n.full && d.kind === "panel"
          ? { ...d, alpha: e.fullAlpha }
          : d,
  );
}

async function ZJ(n) {
  const e = s2(await ln(n, HJ, u3).bytes()),
    t = w1(e, "screenUI"),
    i = w1(t, gx);
  if (i.name !== "Panel")
    throw new Error(`P3528 ${gx} 节点应为 Panel，实际 ${i.name}。`);
  (xx(i, "windowRect", "fullscreen"), xx(i, "alphaBlend", "true"));
  const r = zs(i, "texture"),
    o = await ln(n, `${l3}/${r}.png`, u3).bytes(),
    a = await l00(o);
  if (a !== qJ) throw new Error(`${r}.png SHA-256 不匹配：${a}。`);
  const c = await p2(o);
  if (c.width !== mx || c.height !== wx)
    throw new Error(`${r}.png 应为 ${mx}x${wx}，实际 ${c.width}x${c.height}。`);
  return { node: i, textureName: r, texture: c };
}

async function QJ(n) {
  const e = s2(await ln(n, `${l3}/rankBoard.bml`, u3).bytes()),
    t = w1(e, "ranklist"),
    i = { ...e, children: e.children.filter((o) => o !== t) },
    r = e7(i),
    s = await J6(n, l3, u3, r);
  return {
    tree: d5(i, s),
    textures: s,
    boardGeometry: lt(e, s),
    rank: w1(i, "myrank"),
    suffix: w1(i, "st"),
    riderCount: w1(i, "riderCount"),
    rows: await kJ(n, t),
  };
}

function JJ(n, e, t, i, r, s) {
  if (!Number.isInteger(e.rank) || e.rank < 1)
    throw new Error(`P3528 rank board rank=${e.rank} 无效。`);
  if (!Number.isInteger(e.riderCount) || e.riderCount < 1)
    throw new Error(`P3528 rank board riderCount=${e.riderCount} 无效。`);
  const o = {
      text: (h) => {
        if (h === n.rank) return String(e.rank);
        if (h === n.suffix) return e00(e.rank);
        if (h === n.riderCount) return String(e.riderCount);
      },
    },
    a = dt(
      r === void 0 ? dn(n.tree, t, i, o) : r.drawOrder(n.tree, t, i, o),
      n.textures,
      r,
    ),
    c = l5(n.boardGeometry, { left: 0, top: 0, right: t, bottom: i }),
    l = OJ(n.rows, {
      left: 0,
      top: 0,
      right: n.boardGeometry.width,
      bottom: n.boardGeometry.height,
    }),
    u = {
      left: c.left + l.left,
      top: c.top + l.top,
      right: c.left + l.right,
      bottom: c.top + l.bottom,
    };
  return [...a, ...LJ(n.rows, e.rows, u, s)];
}

function e00(n) {
  const e = n % 100;
  if (e >= 11 && e <= 13) return "0";
  const t = n % 10;
  return t === 1 ? "1" : t === 2 ? "2" : t === 3 ? "3" : "0";
}

function vx(n, e) {
  if (e !== 0 && e !== 1) throw new Error(`P3528 local aiDyeId=${e} 未准入。`);
  return n.includes("nine") || e === 1
    ? "nine"
    : n === "디셉티콘" || n === "오토봇"
      ? "transformer"
      : "base";
}

function t00(n) {
  return n.type === "XGenTacho"
    ? "dual"
    : n.type === "V1GenTacho"
      ? "v1"
      : n.type === "XunGenTacho"
        ? "v2"
        : n.type === "NineTacho"
          ? n.folder === "nine_lodi"
            ? "nine_lodi"
            : "nine"
          : "normal";
}

async function n00(n) {
  const e = s2(await ln(n, `${l3}/timeInfo@cn.bml`, u3).bytes()),
    t = w1(e, "lapPlus"),
    i = { ...e, children: e.children.filter((o) => o !== t) },
    r = e7(i);
  c00(r, KJ, "timeInfo");
  const s = await J6(n, l3, u3, r);
  return { tree: d5(i, s), textures: s, textBindings: o00(i) };
}

async function i00(n, e) {
  const i = s2(
      await ln(
        n,
        `${l3}/${e === "nine" ? "boostGaugeNine.bml" : e === "transformer" ? "boostGaugeTransformer.bml" : "boostGauge.bml"}`,
        u3,
      ).bytes(),
    ),
    r = e7(i),
    s = await J6(n, l3, u3, r);
  return {
    tree: d5(i, s),
    textures: s,
    full: w1(i, "full"),
    gauge: w1(i, "gauge"),
    marker: w1(i, "bar"),
  };
}

async function r00(n, e) {
  const i = s2(
      await ln(
        n,
        `${dx}/${e === "nine" ? "teamBoostGaugeNine.bml" : e === "transformer" ? "teamBoostGaugeTransformer.bml" : "teamBoostGauge.bml"}`,
        fx,
      ).bytes(),
    ),
    r = e7(i),
    s = await J6(n, dx, fx, r);
  return {
    tree: d5(i, s),
    textures: s,
    full: w1(i, "teamFull"),
    gauge: w1(i, "teamGauge"),
    marker: w1(i, "teamBar"),
  };
}

async function s00(n, e) {
  const [t, i] = await Promise.all([
      ln(n, `${Zr}/slot_template.bml`, Qr).bytes().then(s2),
      ln(n, `${Zr}/slot_frameResource.bml`, Qr).bytes().then(s2),
    ]),
    r = i.children.find((l) => T(l, "name") === e);
  if (!r)
    throw new Error(`P3528 ItemSlot frame=${e} 不在 slot_frameResource。`);
  const s = zs(r, "texture"),
    [o, a, c] = await Promise.all([
      lh(n, `${Zr}/${s}.png`, Qr),
      lh(n, `${Zr}/item6.png`, Qr),
      lh(n, `${Zr}/item14.png`, Qr),
    ]);
  return {
    frameTextureName: s,
    frameTexture: o,
    boostTexture: a,
    teamBoostTexture: c,
    current: Ax(Mx(t, "2")),
    reserve: Ax(Mx(t, "1")),
  };
}

function o00(n) {
  const e = new Map(),
    t = w1(n, "lapinfo");
  return (
    e.set(w1(t, "myLap"), "lap-current"),
    e.set(w1(t, "totalLap"), "lap-total"),
    yx(e, w1(n, "timeinfo"), "elapsed"),
    yx(e, w1(n, "bestinfo"), "best"),
    e
  );
}

function yx(n, e, t) {
  (n.set(w1(e, "min"), `${t}-min`),
    n.set(w1(e, "sec"), `${t}-sec`),
    n.set(w1(e, "mil"), `${t}-mil`));
}

function Ax(n) {
  const [e, t, i, r] = j2(zs(n, "rc"), 4, "Slot.rc"),
    [s, o, a, c] = j2(zs(n, "uvRc"), 4, "Slot.uvRc"),
    l = Number(zs(n, "adjustValue"));
  if (!Number.isInteger(l) || l < 0)
    throw new Error(`P3528 Slot.adjustValue=${l} 无效。`);
  return {
    node: n,
    rect: { left: e, top: t, right: C2(e + i), bottom: C2(t + r) },
    uvPixels: { left: s, top: o, right: a, bottom: c },
    adjust: l,
  };
}

function nI(n, e) {
  const t = C2(e.worldRect.right - e.worldRect.left),
    i = C2(n.worldRect.right - C2(t * C2(0.5))),
    r = C2(i - e.worldRect.left);
  return {
    ...e,
    worldRect: Yl(e.worldRect, r, 0),
    framebufferRect: Yl(e.framebufferRect, r, 0),
  };
}

function Xl(n, e, t) {
  const i = n.find((r) => r.node === e);
  if (!i || i.kind !== "panel" || !("texture" in i))
    throw new Error(`P3528 ${t} 缺少 hydrated panel。`);
  return i;
}

function bx(n, e, t, i, r) {
  return {
    kind: "panel",
    node: n,
    textureName: e,
    texture: t,
    worldRect: i,
    framebufferRect: Yl(i, -0.5, -0.5),
    uv: r,
  };
}

async function J6(n, e, t, i) {
  return new Map(
    await Promise.all(i.map(async (r) => [r, await a00(n, e, t, r)])),
  );
}

async function a00(n, e, t, i) {
  const r = i.endsWith("@zz") ? [`${i.slice(0, -3)}@cn`, i] : [i];
  for (const s of r) {
    const o = `${e}/${s}.png`,
      a = n.canonicalCandidates(o);
    if (a.length > 1)
      throw new Error(`${o} source 数量最多为 1，实际 ${a.length}。`);
    if (a.length === 1) return p2(await iI(a, o, t).bytes());
  }
  throw new Error(`${e}/${i}.png 缺少 P3528 CN→ZZ texture。`);
}

async function lh(n, e, t) {
  return p2(await ln(n, e, t).bytes());
}

function ln(n, e, t) {
  return iI(n.canonicalCandidates(e), e, t);
}

function iI(n, e, t) {
  if (n.length !== 1)
    throw new Error(`${e} source 数量必须为 1，实际 ${n.length}。`);
  const i = n[0];
  if (i.sourceKind !== "rho" || i.sourceName.toLowerCase() !== t.toLowerCase())
    throw new Error(`${e} 必须来自 ${t}。`);
  return i;
}

function e7(n) {
  const e = new Set(),
    t = [n];
  for (; t.length > 0;) {
    const i = t.pop(),
      r = T(i, "texture");
    (r && e.add(r), t.push(...i.children));
  }
  return [...e].sort();
}

function c00(n, e, t) {
  const i = [...e].sort();
  if (n.join("\0") !== i.join("\0"))
    throw new Error(`P3528 ${t} texture 集合已变化：${n.join(", ")}。`);
}

function w1(n, e) {
  const t = [],
    i = [n];
  for (; i.length > 0;) {
    const r = i.pop();
    (T(r, "name") === e && t.push(r), i.push(...r.children));
  }
  if (t.length !== 1)
    throw new Error(`P3528 ${e} node 数量必须为 1，实际 ${t.length}。`);
  return t[0];
}

function Mx(n, e) {
  const t = n.children.filter((i) => i.name === "Slot" && T(i, "type") === e);
  if (t.length !== 1)
    throw new Error(`P3528 Slot type=${e} 数量必须为 1，实际 ${t.length}。`);
  return t[0];
}

function zs(n, e) {
  const t = T(n, e);
  if (t === void 0) throw new Error(`P3528 ${n.name}.${e} 缺失。`);
  return t;
}

function xx(n, e, t) {
  const i = T(n, e);
  if (i !== t) throw new Error(`P3528 ${n.name}.${e}=${i} 应为 ${t}。`);
}

async function l00(n) {
  return [
    ...new Uint8Array(await crypto.subtle.digest("SHA-256", n.slice().buffer)),
  ]
    .map((t) => t.toString(16).padStart(2, "0"))
    .join("");
}

function Yl(n, e, t) {
  return {
    left: C2(n.left + e),
    top: C2(n.top + t),
    right: C2(n.right + e),
    bottom: C2(n.bottom + t),
  };
}

function rI(n, e) {
  return {
    left: C2(n.left - e),
    top: C2(n.top - e),
    right: C2(n.right + e),
    bottom: C2(n.bottom + e),
  };
}

function sI(n, e, t) {
  const i = e === 0 ? n.current : n.reserve;
  return Yl(i.rect, 24 + (t - e - 1) * 82, 24);
}

function u00(n, e, t) {
  const i = e === 0 ? n.current : n.reserve;
  return rI(sI(n, e, t), -i.adjust);
}

function h00(n) {
  return 1 - (1 - n) ** 3;
}

function d00(n, e, t) {
  const i = (r, s) => C2(r + (s - r) * t);
  return {
    left: i(n.left, e.left),
    top: i(n.top, e.top),
    right: i(n.right, e.right),
    bottom: i(n.bottom, e.bottom),
  };
}

function f00(n, e) {
  return {
    left: C2(n.left / e.width),
    top: C2(n.top / e.height),
    right: C2(n.right / e.width),
    bottom: C2(n.bottom / e.height),
  };
}

function p00() {
  return { left: 0, top: 0, right: 1, bottom: 1 };
}

function g00(n, e) {
  const t = Pw(n, e);
  if (t === 0) throw new Error(`P3528 ${e}=0 无效。`);
  return t;
}

function Pw(n, e) {
  if (!Number.isInteger(n) || n < 0 || n > 4294967295)
    throw new Error(`P3528 ${e}=${n} 不是 u32。`);
  return n >>> 0;
}

const C2 = Math.fround,
  m00 = ["dds", "png", "jpg", "tga", "kng"];

function w00(n, e, t) {
  const i = e.name;
  if (i === void 0) return { status: "none" };
  if (t.length === 0)
    throw new Error(
      "P3553 F8E7DF marker 纹理解析必须给出至少一个候选上下文；官服目录优先级未取证前不得使用隐式默认。",
    );
  let r = !0;
  for (const s of t) {
    const { directory: o, anchorPath: a } = s;
    if (a.length === 0)
      throw new Error(
        "P3553 F8E7DF marker 纹理上下文缺少 anchorPath，无法确定 container。",
      );
    if (!o.endsWith("/"))
      throw new Error(
        `P3553 F8E7DF marker 纹理上下文目录必须以 / 结尾，实际 ${o}。`,
      );
    let c = !0;
    for (const l of m00) {
      const u = `${o}${i}.${l}`,
        h = n.resolveContainerPath(a, u);
      if (h.status === "ambiguous")
        return {
          status: "unresolved",
          reason: `${u} 在 ${a} 的 container 中不唯一。`,
        };
      if (h.status === "found")
        return r
          ? { status: "found", entry: h.entry }
          : {
              status: "unresolved",
              reason: `P3553 F8E7DF ${u} 命中前存在非权威缺失，官服目录优先级无法据此确定。`,
            };
      c &&= h.authoritative;
    }
    r &&= c;
  }
  return r
    ? { status: "missing" }
    : {
        status: "unresolved",
        reason: "P3553 F8E7DF marker 纹理候选上下文中存在非权威缺失。",
      };
}

function v00(n) {
  const t = n.uniforms?.baseMap?.value;
  return t instanceof D9 ? t : (n.map ?? void 0);
}

function y00(n, e) {
  const i = n.uniforms?.baseMap;
  if (i && i.value instanceof D9) {
    i.value = e;
    return;
  }
  n.map = e;
}

const eg = "minimapMarkerTintClone",
  Sx = "minimapMarkerTintCloneDisposed";

function Cx(n, e) {
  const t = new Map();
  n.traverse((i) => {
    const r = i;
    if (!r.isMesh) return;
    const o = (Array.isArray(r.material) ? r.material : [r.material]).map(
      (a) => {
        let c = t.get(a);
        if (c === void 0) {
          if (a.userData[eg]) c = a;
          else {
            c = a.clone();
            const l = v00(a);
            (l && y00(c, l), (c.userData[eg] = !0));
          }
          (t.set(a, c), b00(c, e));
        }
        return c;
      },
    );
    r.material = Array.isArray(r.material) ? o : o[0];
  });
}

function A00(n) {
  const e = new Set();
  n.traverse((t) => {
    const i = t;
    if (!i.isMesh) return;
    const r = Array.isArray(i.material) ? i.material : [i.material];
    for (const s of r)
      !s.userData[eg] ||
        s.userData[Sx] ||
        e.has(s) ||
        (e.add(s), (s.userData[Sx] = !0), s.dispose());
  });
}

function b00(n, e) {
  const i = n.uniforms?.materialColor?.value;
  if (!(i instanceof Y2)) return;
  if (e === void 0) {
    i.set(1, 1, 1, i.w);
    return;
  }
  const r = (e >> 16) & 255,
    s = (e >> 8) & 255,
    o = e & 255;
  i.set(r / 255, s / 255, o / 255, i.w);
}

const d2 = Math.fround,
  Us = "stage_/speedIndiGame/minimap.bml",
  Ex = "stage_/common/flag/minimap.1s",
  G8 = "stage_/common/flag/minimap_spot.1s",
  M00 = "stage_speedIndiGame.rho",
  Tx = "stage_common.rho",
  x00 = { directory: Us.slice(0, Us.lastIndexOf("/") + 1), anchorPath: Us },
  S00 = new Set(["미니맵빨강자신", "미니맵빨강일반"]),
  _x = 1.0000011920928955,
  Gx = d2(d2(800) / d2(799));

function Bx(n) {
  if (!Number.isInteger(n) || n < 0 || n > 8)
    throw new Error(`minimap marker participantIndex 必须为 0..8，实际 ${n}。`);
  return d2(d2(10) - d2(d2(n) * d2(0.1)));
}

function uh(n) {
  if (!Number.isInteger(n) || n < 0 || n > 8)
    throw new Error(`minimap marker participantIndex 必须为 0..8，实际 ${n}。`);
  return 9 - n;
}

const C00 = [_x, 0, 0, 0, 0, _x, 0, 0, 0, 0, Gx, d2(-Gx), 0, 0, 1, 0],
  tg = { distance: 96, markerFactor: 1 };

function E00(n) {
  if (
    !Number.isFinite(n.distance) ||
    n.distance <= 0 ||
    !Number.isFinite(n.markerFactor) ||
    n.markerFactor <= 0
  )
    throw new Error(
      `minimap marker scale 必须为正的有限值，实际 distance=${n.distance}, markerFactor=${n.markerFactor}。`,
    );
  return d2(d2(n.distance / d2(96)) * d2(n.markerFactor));
}

function Rx(n, e, t, i, r = 10, s = tg) {
  const o = Math.trunc(e) >>> 0,
    a = kB(i),
    c = LB(a);
  let l = n?.orientation ?? c;
  if (n) {
    da(l, c) < 0 && (l = ew(l, d2(-1)));
    const S = (o - n.tickMs) >>> 0,
      G = Math.min(1, d2(d2(S) / d2(1500)));
    l = O6(l, c, G);
  }
  const u = g4(i.position),
    h = {
      x: d2(d2(t.canvasWidth * 0.5) + d2(u.x - t.centerX)),
      y: d2(d2(t.canvasHeight * 0.5) + d2(u.y - t.centerY)),
      z: 0,
    },
    d = kx(Qt(a, 1)),
    f = Ci(I8(d, { x: 0, y: 0, z: 1 })),
    p = Ci(I8(f, d)),
    v = E00(s),
    w = R00(k8(f, v), k8(d, v), k8(p, v), { ...h, z: r }),
    g = PB(l),
    y = kx(Qt(g, 1)),
    A = { x: 0, y: 0, z: Qt(a, 2).z < 0 ? -1 : 1 },
    x = Ci(G00(A, y)),
    M = Ci(I8(x, y)),
    E = Ci(I8(M, x)),
    _ = B00(h, k8(x, 96)),
    C = [
      L5(M.x),
      L5(M.y),
      L5(M.z),
      fh(M, _),
      E.x,
      E.y,
      E.z,
      L5(fh(E, _)),
      L5(x.x),
      L5(x.y),
      L5(x.z),
      fh(x, _),
    ];
  return { smoothing: { orientation: l, tickMs: o }, markerMatrix: w, view: C };
}

function T00(n, e, t) {
  return t.name !== void 0 && S00.has(t.name) ? w00(n, t, [x00]) : ya(n, e, t);
}

async function oI(n, e, t, i, r, s, o, a = !1) {
  if (
    !(i.scale > 0) ||
    !Number.isFinite(i.scale) ||
    i.canvasWidth === 0 ||
    i.canvasHeight === 0
  )
    throw new Error(
      `P3528 ToMinimap 投影无效：scale=${i.scale}, canvas=${i.canvasWidth}x${i.canvasHeight}。`,
    );
  const c = dh(n, Us, M00),
    l = dh(n, Ex, Tx),
    u = dh(n, G8, Tx),
    [h, d, f] = await Promise.all([
      c.bytes().then(s2),
      l.bytes().then(y9),
      u.bytes().then(y9),
    ]);
  if (h.name !== "Minimap") throw new Error(`${Us} 根节点不是 Minimap。`);
  const p = {
    environment: r,
    stageBinding: s,
    advanceEnvironment: !1,
    convertClientCoordinates: !1,
  };
  let v, w;
  try {
    v = await c5(Ix(d, "minimap", Ex), n, e, t, p);
    const g = u.canonicalPath ?? u.virtualPath;
    w = await W1(
      Ix(f, "me1", G8),
      n,
      `${t.id}:TimeAttackMinimapSpot`,
      (x) => T00(n, g, x),
      {
        ...p,
        additionalRoots: [
          ng(f, "other1", G8),
          ...(a ? [ng(f, "flag1", G8)] : []),
        ],
      },
    );
    const y = R8(v.object, "minimap"),
      b = R8(w.object, "me1"),
      A = R8(w.object, "other1");
    return new _00(
      i,
      lt(h),
      v,
      w,
      y,
      b,
      A,
      o,
      a ? R8(w.object, "flag1") : void 0,
    );
  } catch (g) {
    throw (w?.dispose(), v?.dispose(), g);
  }
}

class _00 {
  constructor(e, t, i, r, s, o, a, c, l) {
    ((this.source = e),
      (this.window = t),
      (this.mapScene = i),
      (this.spotScene = r),
      (this.mapNode = s),
      (this.spotNode = o),
      B8(s),
      B8(o),
      B8(a));
    const u = d2(d2(1) / d2(e.scale));
    ((this.mapScale = new H(u, u, u)),
      (this.camera.matrixWorldAutoUpdate = !1));
    const h = [];
    for (let f = 0; f < Math.max(1, c); f += 1) {
      const p = f === 0 ? a : a.clone(!0);
      (f > 0 && a.parent?.add(p),
        (p.visible = !1),
        hh(p, uh(f + 1)),
        h.push(p));
    }
    ((this.ghostNodes = c > 0 ? h : []), hh(this.spotNode, uh(0)));
    const d = [];
    if (l) {
      B8(l);
      for (let f = 0; f <= c; f++) {
        const p = f === 0 ? l : l.clone(!0);
        (f > 0 && l.parent?.add(p), (p.visible = !1), hh(p, uh(f)), d.push(p));
      }
    }
    this.flagNodes = d;
  }
  source;
  window;
  mapScene;
  spotScene;
  mapNode;
  spotNode;
  camera = new a5();
  previousViewport = new Y2();
  mapScale;
  ghostNodes;
  smoothing;
  ghostTintValues = [];
  localTint;
  localTintApplied = !1;
  localRunnerFlag = !1;
  flagNodes;
  update(e, t, i = []) {
    const r = Rx(this.smoothing, e, this.source, t, Bx(0), tg);
    ((this.smoothing = r.smoothing),
      this.mapScene.update(e),
      this.spotScene.update(e),
      this.mapNode.matrix.scale(this.mapScale),
      (this.mapNode.matrixWorldNeedsUpdate = !0),
      this.spotNode.matrix.copy(r.markerMatrix),
      (this.spotNode.matrixWorldNeedsUpdate = !0),
      this.flagNodes.length &&
        ((this.spotNode.visible = !0),
        (this.flagNodes[0].visible = this.localRunnerFlag),
        this.flagNodes[0].matrix.copy(r.markerMatrix),
        (this.flagNodes[0].matrixWorldNeedsUpdate = !0)));
    for (let s = 0; s < this.ghostNodes.length; s += 1) {
      const o = this.ghostNodes[s],
        a = i[s],
        c = this.flagNodes[s + 1];
      if ((c && (c.visible = !!a?.runnerFlag), !a)) {
        o.visible = !1;
        continue;
      }
      const l = Rx(void 0, e, this.source, a, Bx(s + 1), tg);
      (o.matrix.copy(l.markerMatrix),
        (o.matrixWorldNeedsUpdate = !0),
        (o.visible = !0),
        c && (c.matrix.copy(l.markerMatrix), (c.matrixWorldNeedsUpdate = !0)),
        this.ghostTintValues[s] !== a.markerTint &&
          (Cx(o, a.markerTint), (this.ghostTintValues[s] = a.markerTint)));
    }
    Aa(this.camera, r.view, C00);
  }
  setLocalMarkerTint(e) {
    (this.localTintApplied && this.localTint === e) ||
      (Cx(this.spotNode, e),
      (this.localTint = e),
      (this.localTintApplied = !0));
  }
  setLocalRunnerFlag(e) {
    if (e && !this.flagNodes.length)
      throw new Error("小地图缺少跑者旗帜资源。");
    this.localRunnerFlag = e;
  }
  render(e, t, i) {
    const r = l5(this.window, { left: 0, top: 0, right: t, bottom: i }),
      s = qB(r);
    e.getViewport(this.previousViewport);
    const o = e.autoClear;
    e.autoClear = !1;
    try {
      (e.setViewport(s.x, i - s.y - s.height, s.width, s.height),
        e.render(this.mapScene.object, this.camera),
        e.clearDepth(),
        e.render(this.spotScene.object, this.camera));
    } finally {
      (e.setViewport(this.previousViewport), (e.autoClear = o));
    }
  }
  reset() {
    this.smoothing = void 0;
    for (const e of this.ghostNodes) e.visible = !1;
    for (const e of this.flagNodes) e.visible = !1;
    (this.mapScene.reset(0), this.spotScene.reset(0));
  }
  dispose() {
    (A00(this.spotScene.object),
      this.spotScene.dispose(),
      this.mapScene.dispose());
  }
}

function B8(n) {
  n.traverse((e) => {
    if (!(e instanceof D2)) return;
    const t = Array.isArray(e.material) ? e.material : [e.material];
    for (const i of t) i.side = s1;
  });
}

function ng(n, e, t) {
  const r = (n.root.kind === "track" ? n.root.scene : n.root).children.filter(
    (s) => s.name === e,
  );
  if (r.length !== 1)
    throw new Error(`${t} 根级 ${e} node 数量必须为 1，实际 ${r.length}。`);
  return r[0];
}

function Ix(n, e, t) {
  return { root: ng(n, e, t) };
}

function R8(n, e) {
  const t = [];
  if (
    (n.traverse((i) => {
      i.name === e && t.push(i);
    }),
    t.length !== 1)
  )
    throw new Error(
      `P3528 minimap runtime ${e} node 数量必须为 1，实际 ${t.length}。`,
    );
  return t[0];
}

function hh(n, e) {
  n.traverse((t) => {
    t.renderOrder = e;
  });
}

function dh(n, e, t) {
  const i = n.canonicalCandidates(e);
  if (i.length !== 1)
    throw new Error(`${e} source 数量必须为 1，实际 ${i.length}。`);
  const r = i[0];
  if (r.sourceKind !== "rho" || r.sourceName.toLowerCase() !== t.toLowerCase())
    throw new Error(`${e} 必须来自 ${t}。`);
  return r;
}

function kx(n, e) {
  return Ci({ x: L5(n.x), y: L5(n.y), z: 0 });
}

function Ci(n) {
  const e = d2(
    Math.sqrt(d2(d2(d2(n.x * n.x) + d2(n.y * n.y)) + d2(n.z * n.z))),
  );
  return (
    e !== 0 && ((n.x = d2(n.x / e)), (n.y = d2(n.y / e)), (n.z = d2(n.z / e))),
    n
  );
}

function I8(n, e) {
  return {
    x: d2(d2(n.y * e.z) - d2(n.z * e.y)),
    y: d2(d2(n.z * e.x) - d2(n.x * e.z)),
    z: d2(d2(n.x * e.y) - d2(n.y * e.x)),
  };
}

function G00(n, e) {
  return { x: d2(n.x - e.x), y: d2(n.y - e.y), z: d2(n.z - e.z) };
}

function B00(n, e) {
  return { x: d2(n.x + e.x), y: d2(n.y + e.y), z: d2(n.z + e.z) };
}

function k8(n, e) {
  return { x: d2(n.x * e), y: d2(n.y * e), z: d2(n.z * e) };
}

function fh(n, e) {
  return d2(d2(d2(n.x * e.x) + d2(n.y * e.y)) + d2(n.z * e.z));
}

function L5(n) {
  return n === 0 ? 0 : d2(-n);
}

function R00(n, e, t, i) {
  return new v2().set(
    n.x,
    e.x,
    t.x,
    i.x,
    n.y,
    e.y,
    t.y,
    i.y,
    n.z,
    e.z,
    t.z,
    i.z,
    0,
    0,
    0,
    1,
  );
}

function Yi(n, e) {
  const t = n.canonicalCandidates(e);
  if (t.length !== 1) throw new Error(`巨人原件未唯一命中：${e}`);
  return t[0];
}

async function aI(n, e, t, i = {}, r = !1, s) {
  s ??= y9(await Yi(n, e).bytes());
  const o = await W1(
    s,
    n,
    e,
    (a) => {
      if (r) return ya(n, e, a);
      const c = sn(n, e, void 0, a);
      return c.status === "found" ? { status: "found", entry: c.entry } : c;
    },
    {
      ...i,
      advanceEnvironment: !1,
      textureCache: t,
      convertClientCoordinates: !r,
    },
  );
  return { parsed: s, scene: o };
}

class Fw extends GiantBoostHud {
  constructor(models, textures, panels) {
    super(models, textures, panels, giantBoostHudDependencies);
  }
  static async load(library) {
    return GiantBoostHud.load(library, giantBoostHudDependencies,
      (models, textures, panels) => new Fw(models, textures, panels));
  }
}

class Dw extends MultiplayerRaceHud {
  constructor(ui, tints, anonymous = false, competition = false, runnerId) {
    super(ui, tints, anonymous, competition, runnerId, multiplayerRaceHudDependencies);
  }
  static async load(library, race, playerId) {
    return MultiplayerRaceHud.load(library, race, playerId,
      multiplayerRaceHudDependencies,
      (ui, tints, anonymous, competition, runnerId) =>
        new Dw(ui, tints, anonymous, competition, runnerId));
  }
}

const k00 = "stage_/speedIndiGame/action2d@cn.bml",
  Fx = "stage_speedIndiGame.rho",
  L00 = "stage_/speedIndiGame/s_03@cn.png",
  P00 = "stage_/speedIndiGame/2d_1S_통합2@cn.png",
  F00 = "stage_/speedIndiGame/2d_1S_통합3@cn.png",
  D00 = "stage_/speedIndiGame/2d_1S_통합@cn.png",
  V00 = [
    [0, 0],
    [100, 1],
  ];

function uI(n) {
  const e = [
    [0, 0],
    [100, 1],
  ];
  for (let t = 1; t < n; t++)
    e.push([t * 1e3, 1], [t * 1e3 + 1, 0], [t * 1e3 + 100, 1]);
  return (e.push([n * 1e3, 1]), e);
}

const N00 = uI(4),
  O00 = uI(10);

async function hI(n, e = !1) {
  const t = s2(await pI(n, k00).bytes()),
    [i, r, s, o] = await Promise.all([
      Jr(n, L00),
      Jr(n, P00),
      Jr(n, F00),
      Jr(n, D00),
    ]);
  let a;
  if (e) {
    const c = gI(t, "finish카운트"),
      l = c.children[0],
      u = await Jr(n, "stage_/speedIndiGame/digit_count@zz.png");
    if (
      l?.name !== "TonCharPanel" ||
      T(l, "fontStr") !== "9876543210" ||
      T(l, "fontSize") !== "120 84" ||
      u.width !== 480 ||
      u.height !== 252
    )
      throw new Error("Unsupported multiplayer finish counter resource");
    const h = ga({ ...l, name: "CharPanel" }, u);
    a = {
      node: l,
      texture: u,
      geometry: lt(l),
      glyphs: [..."9876543210"].map((d) => pa(h, d)[0]),
    };
  }
  return {
    ...(e
      ? {
          finishCount: a,
          winner: vt(t, "finish", "winner@zz", "TonPanel", "2d_1S_통합@cn", o),
          retire: vt(t, "finish", "retire@zz", "TonPanel", "2d_1S_통합@cn", o),
          raceOver: vt(
            t,
            "finish",
            "raceover@zz",
            "TonPanel",
            "2d_1S_통합@cn",
            o,
          ),
        }
      : {}),
    start: vt(t, "start", "start@zz", "TonCharPanel", "s_03@zz", i),
    laps: new Map([
      [2, vt(t, "lap", "2lap@zz", "TonPanel", "2d_1S_통합2@cn", r)],
      [3, vt(t, "lap", "3lap@zz", "TonPanel", "2d_1S_통합2@cn", r)],
      [4, vt(t, "lap", "4lap@zz", "TonPanel", "2d_1S_통합2@cn", r)],
      [5, vt(t, "lap", "5lap@zz", "TonPanel", "2d_1S_통합3@cn", s)],
    ]),
    finalLap: vt(
      t,
      "final-lap",
      "finallap@zz",
      "TonPanel",
      "2d_1S_통합2@cn",
      r,
    ),
    finish: vt(t, "finish", "finish@zz", "TonPanel", "2d_1S_통합@cn", o),
    newRecord: vt(
      t,
      "new-record",
      "newRecord@zz",
      "TonPanel",
      "2d_1S_통합2@cn",
      r,
    ),
  };
}

class z00 {
  constructor(e, t, i) {
    ((this.kind = e),
      (this.startTick = t),
      (this.timing = i),
      (this.phaseStartTick = t));
  }
  kind;
  startTick;
  timing;
  phase = 0;
  phaseStartTick;
  frame(e) {
    const t = $s(e),
      i = this.fadeAlpha(t);
    if (i === void 0) return;
    const r = $s(t - this.startTick);
    return {
      elapsedMs: r,
      alpha: i,
      scale: fI(this.kind === "start" ? N00 : V00, r),
      frameIndex: this.kind === "start" ? X00(r) : 0,
    };
  }
  fadeAlpha(e) {
    const t = $s(e - this.phaseStartTick);
    if (this.phase === 0) return this.fadeIn(e, t);
    if (this.phase === 1) return this.show(e, t);
    if (this.phase === 2) return this.fadeOut(t);
  }
  fadeIn(e, t) {
    return t < this.timing.fadeInMs
      ? Math.fround(Math.fround(t) / Math.fround(this.timing.fadeInMs))
      : ((this.phase = 1), (this.phaseStartTick = e), 1);
  }
  show(e, t) {
    return (
      t > this.timing.showMs && ((this.phase = 2), (this.phaseStartTick = e)),
      1
    );
  }
  fadeOut(e) {
    if (e < this.timing.fadeOutMs)
      return Math.fround(
        1 - Math.fround(Math.fround(e) / Math.fround(this.timing.fadeOutMs)),
      );
    this.phase = 3;
  }
}

class dI {
  constructor(e) {
    this.definition = e;
  }
  definition;
  renderer = new fn(new Map());
  enableUiSmoothing() {
    this.renderer.enableUiSmoothing();
  }
  finishDeadline;
  pending;
  active;
  scheduleStart(e) {
    this.schedule(this.definition.start, e);
  }
  showLap(e, t) {
    const i = this.definition.laps.get(e);
    if (!i) throw new Error(`P3528 缺少 ${e}lap@zz。`);
    this.schedule(i, t);
  }
  showFinalLap(e) {
    this.schedule(this.definition.finalLap, e);
  }
  showFinish(e) {
    this.schedule(this.definition.finish, e);
  }
  showWinner(e) {
    if (!this.definition.winner) throw new Error("Winner resource not loaded");
    this.schedule(this.definition.winner, e);
  }
  showRetire(e) {
    if (!this.definition.retire) throw new Error("Retire resource not loaded");
    this.schedule(this.definition.retire, e);
  }
  showRaceOver(e) {
    if (!this.definition.raceOver)
      throw new Error("Raceover resource not loaded");
    this.schedule(this.definition.raceOver, e);
  }
  setFinishDeadline(e) {
    this.finishDeadline = e;
  }
  showNewRecord(e) {
    this.schedule(this.definition.newRecord, e);
  }
  reset() {
    ((this.finishDeadline = void 0),
      (this.pending = void 0),
      (this.active = void 0),
      this.renderer.update([], 0));
  }
  render(e, t, i, r) {
    const s = $s(t);
    this.activatePending(s);
    const o = this.drawCommand(s, i, r);
    (this.renderer.update(o ? [o] : [], s), o && this.renderer.render(e, i, r));
  }
  dispose() {
    (this.reset(), this.renderer.dispose());
  }
  schedule(e, t) {
    ((this.active = void 0), (this.pending = { panel: e, atMs: $s(t) }));
  }
  activatePending(e) {
    if (!this.pending || this.pending.atMs === 0 || this.pending.atMs > e)
      return;
    const t = this.pending.panel;
    ((this.active = { panel: t, animation: new z00(t.kind, e, t.timing) }),
      (this.pending = void 0));
  }
  drawCommand(e, t, i) {
    if (this.finishDeadline !== void 0 && this.definition.finishCount) {
      const a = this.definition.finishCount,
        c = e - (this.finishDeadline - 1e4);
      if (c >= 0 && c < 1e4) {
        const l = Math.min(9, Math.max(0, Math.ceil(c / 1e3) - 1)),
          u = a.glyphs[l],
          h = fI(O00, c),
          d = l5(a.geometry, { left: 0, top: 0, right: t, bottom: i }, h, h);
        return {
          kind: "panel",
          node: a.node,
          textureName: "digit_count@zz",
          texture: a.texture,
          worldRect: d,
          framebufferRect: Dx(d),
          uv: { left: u.u0, top: u.v0, right: u.u1, bottom: u.v1 },
          alpha: 255,
        };
      }
    }
    if (!this.active) return;
    const r = this.active.animation.frame(e);
    if (!r) {
      this.active = void 0;
      return;
    }
    const s = this.active.panel,
      o = l5(
        s.geometry,
        { left: 0, top: 0, right: Math.fround(t), bottom: Math.fround(i) },
        r.scale,
        r.scale,
      );
    return {
      kind: "panel",
      node: s.node,
      worldRect: o,
      textureName: s.textureName,
      texture: s.texture,
      framebufferRect: Dx(o),
      uv: s.kind === "start" ? j00(s.texture, r.frameIndex) : s.uv,
      alpha: Math.trunc(Math.fround(r.alpha * 255)) & 255,
    };
  }
}

function vt(n, e, t, i, r, s) {
  const o = gI(n, t);
  if (o.name !== "ControlWindow")
    throw new Error(`P3528 ${t} 不再是 ControlWindow。`);
  if (T(o, "windowRect") !== "fullscreen")
    throw new Error(`P3528 ${t} 不再是 fullscreen。`);
  if (o.children.length !== 1)
    throw new Error(`P3528 ${t} 必须只有一个 panel。`);
  if (o.children[0].name !== i)
    throw new Error(`P3528 ${t} panel 必须为 ${i}。`);
  const a = o.children[0];
  H00(a, r, U00(e));
  const c = lt(a);
  return {
    kind: e,
    node: a,
    geometry: c,
    textureName: $00(e, r),
    texture: s,
    timing: {
      fadeInMs: ph(o, "fadeInLength"),
      showMs: ph(o, "showLength"),
      fadeOutMs: ph(o, "fadeOutLength"),
    },
    uv: W00(e, a, c, s),
  };
}

function U00(n) {
  return n === "start" ? "start" : "pop";
}

function $00(n, e) {
  return n === "start" ? "s_03@cn" : e;
}

function W00(n, e, t, i) {
  return n === "start" ? q00(e, t, i) : K00(e, i);
}

function H00(n, e, t) {
  new Map([
    ["texture", e],
    ["textureOp", "modulate"],
    ["color", "255 255 255 255"],
    ["alphaBlend", "true"],
    ["panelAnimPack", t],
  ]).forEach((r, s) => {
    if (T(n, s) !== r) throw new Error(`P3528 ${n.name}.${s} 必须为 ${r}。`);
  });
}

function q00(n, e, t) {
  const [i, r] = j2(T(n, "fontSize") ?? "", 2, "TonCharPanel.fontSize");
  if (i !== e.width || r !== e.height || t.width !== i || t.height !== r * 4)
    throw new Error("P3528 start@zz 不再是四行等高的 TonCharPanel atlas。");
  return (
    new Map([
      ["fontStr", "3210"],
      ["text", "0"],
      ["autoScroll", "true"],
      ["autoScrollTick", "1000"],
      ["flexible", "true"],
      ["allowVertical", "true"],
    ]).forEach((o, a) => {
      if (T(n, a) !== o)
        throw new Error(`P3528 TonCharPanel.${a} 必须为 ${o}。`);
    }),
    { left: 0, top: 0, right: 1, bottom: 0.25 }
  );
}

function K00(n, e) {
  const [t, i, r, s] = j2(T(n, "uvRect") ?? "", 4, "TonPanel.uvRect"),
    o = Math.min(t, i, r - t, s - i) >= 0,
    a = r <= e.width && s <= e.height;
  if (!o || !a) throw new Error("P3528 TonPanel.uvRect 超出 texture。");
  const c = Math.fround(1 / e.width),
    l = Math.fround(1 / e.height);
  return {
    left: Math.fround(t * c),
    top: Math.fround(i * l),
    right: Math.fround(r * c),
    bottom: Math.fround(s * l),
  };
}

function j00(n, e) {
  const t = n.height / 4;
  return {
    left: 0,
    top: Math.fround((e * t) / n.height),
    right: 1,
    bottom: Math.fround(((e + 1) * t) / n.height),
  };
}

function X00(n) {
  return n > 3e3 ? 3 : n > 2e3 ? 2 : n > 1e3 ? 1 : 0;
}

function fI(n, e) {
  for (let t = 1; t < n.length; t += 1) {
    const i = n[t - 1],
      r = n[t];
    if (e > r[0]) continue;
    const s = Math.fround((e - i[0]) / (r[0] - i[0]));
    return Math.fround(i[1] + Math.fround((r[1] - i[1]) * s));
  }
  return n[n.length - 1][1];
}

function Dx(n) {
  return {
    left: Math.fround(n.left - 0.5),
    top: Math.fround(n.top - 0.5),
    right: Math.fround(n.right - 0.5),
    bottom: Math.fround(n.bottom - 0.5),
  };
}

async function Jr(n, e) {
  return p2(await pI(n, e).bytes());
}

function pI(n, e) {
  const t = n.canonicalCandidates(e);
  if (t.length !== 1)
    throw new Error(`${e} source 数量必须为 1，实际 ${t.length}。`);
  const i = t[0];
  if (i.sourceKind !== "rho" || i.sourceName.toLowerCase() !== Fx.toLowerCase())
    throw new Error(`${e} 必须来自 ${Fx}。`);
  return i;
}

function gI(n, e) {
  const t = [],
    i = [n];
  for (; i.length > 0;) {
    const r = i.pop();
    (T(r, "name") === e && t.push(r), i.push(...r.children));
  }
  if (t.length !== 1)
    throw new Error(`P3528 ${e} node 数量必须为 1，实际 ${t.length}。`);
  return t[0];
}

function ph(n, e) {
  const t = T(n, e);
  if (!t || !/^\d+$/.test(t))
    throw new Error(`P3528 ${n.name}.${e} 不是 u32。`);
  const i = Number(t);
  if (!Number.isSafeInteger(i) || i > 4294967295)
    throw new Error(`P3528 ${n.name}.${e} 超出 u32。`);
  return i;
}

function $s(n) {
  return Math.trunc(n) >>> 0;
}

const Y00 = "web-rp-speed-v1",
  gh = (n) => !!n && typeof n == "object" && !Array.isArray(n),
  Vx = (n, e) =>
    Number.isSafeInteger(n) && Number(n) >= e && Number(n) <= 65535;

function ba(n, e) {
  if (
    !gh(n) ||
    n.ruleset !== Y00 ||
    typeof n.poolRevision != "string" ||
    !/^[a-f0-9]{64}$/.test(n.poolRevision) ||
    !gh(n.draws)
  )
    return !1;
  const t = new Set(e);
  return t.size !== e.length || Object.keys(n.draws).length !== t.size
    ? !1
    : Object.entries(n.draws).every(
        ([i, r]) =>
          t.has(i) && gh(r) && Vx(r.kartId, 1) && Vx(r.flyingPetId, 0),
      );
}

function mI(n) {
  return {
    ruleset: n.ruleset,
    poolRevision: n.poolRevision,
    draws: Object.fromEntries(
      Object.entries(n.draws).map(([e, t]) => [e, { ...t }]),
    ),
  };
}

function t7(n, e) {
  return !n || !e
    ? n === e
    : n.ruleset === e.ruleset &&
        n.poolRevision === e.poolRevision &&
        Object.keys(n.draws).length === Object.keys(e.draws).length &&
        Object.entries(n.draws).every(
          ([t, i]) =>
            Object.hasOwn(e.draws, t) &&
            i.kartId === e.draws[t].kartId &&
            i.flyingPetId === e.draws[t].flyingPetId,
        );
}

function wI(n, e) {
  const t = { ...n.itemIds, 3: e.kartId, 52: e.flyingPetId };
  for (const i of [10, 43, 44, 45, 46, 58, 59, 61, 68, 69, 71, 76, 77, 78])
    t[i] = 0;
  return {
    ...n,
    itemIds: t,
    kartSerial: 0,
    valueAt3E: 0,
    exceedType: 0,
    systemKart: void 0,
    systemKartVariant: void 0,
  };
}

function Z00(n, e) {
  return { ...n, garage: void 0, equipment: wI(n.equipment, e) };
}

const Pn = Symbol("speed-race-mode");

function vI(n) {
  switch (n) {
    case 1:
    case 3:
      return Object.freeze({
        [Pn]: !0,
        modeId: n,
        kind: "ordinary",
        team: n === 3,
      });
    case 29:
    case 30:
      return Object.freeze({ [Pn]: !0, modeId: n, kind: "rp", team: n === 30 });
    case 38:
    case 39:
      return Object.freeze({
        [Pn]: !0,
        modeId: n,
        kind: "shadow",
        team: n === 39,
      });
    case 48:
    case 49:
      return Object.freeze({
        [Pn]: !0,
        modeId: n,
        kind: "grip",
        team: n === 49,
      });
    case 55:
      return Object.freeze({
        [Pn]: !0,
        modeId: n,
        kind: "roadblock",
        team: !1,
      });
    case 32:
      return Object.freeze({ [Pn]: !0, modeId: n, kind: "giant", team: !1 });
    case 46:
    case 47:
      return Object.freeze({
        [Pn]: !0,
        modeId: n,
        kind: "lte",
        team: n === 47,
      });
    case 2: // item-mode(lobby)
    case 4:
      return Object.freeze({ [Pn]: !0, modeId: n, kind: "item", team: n === 4 });
    default:
      throw new Error(`竞速玩法 ${n} 尚未准入。`);
  }
}

function Q00(n) {
  if (n[Pn] !== !0 || !Object.isFrozen(n))
    throw new Error("缺少冻结的竞速玩法参数。");
  const e = vI(n.modeId);
  if (n.kind !== e.kind || n.team !== e.team)
    throw new Error("竞速玩法身份不一致。");
}

const J00 = "p948-giant-p3553-web-v1",
  e20 = Object.freeze([
    "village_R01",
    "village_I04",
    "village_I05",
    "forest_I03",
    "forest_I04",
    "forest_I05",
    "forest_I07",
    "desert_I03",
    "ice_I03",
    "tomb_I04",
    "pirate_I03",
    "moonhill_I01",
    "moonhill_I03",
    "gold_I01",
    "gold_I03",
    "china_I01",
    "china_I04",
  ]);

function Zl(n) {
  return e20.includes(n);
}

function Io(n) {
  return !!n && typeof n == "object" && n.ruleset === J00;
}

function yI(n, e) {
  return (n === void 0 && e === void 0) || (Io(n) && Io(e));
}

function t20(n) {
  if (!n || typeof n != "object") return !1;
  const e = n;
  return (
    Number.isInteger(e.main) &&
    e.main >= 0 &&
    e.main <= 4 &&
    Number.isInteger(e.extra) &&
    e.extra >= 0 &&
    e.extra <= 2 &&
    (e.main === 4 || e.extra === 0) &&
    (e.status === 0 || e.status === 1)
  );
}

function n20(n, e) {
  if (e.status === 1) return e.main === n.main && e.extra === n.extra;
  const t = n.main + n.extra,
    i = (t + 1) % 7;
  return e.main === Math.min(i, 4) && e.extra === Math.max(0, i - 4);
}

const Ql = Object.freeze({
    ruleset: "web-lte-v1",
    featureSet: "dodge-trial",
    lockMs: 250,
  }),
  AI = Object.freeze(["jurassic_R02", "beach_R05", "moonhill_R06"]),
  bI = 0,
  i20 = Object.freeze({ version: "国服", speed: 5 });

function Vw(n) {
  return AI.includes(n);
}

function ko(n) {
  if (!n || typeof n != "object") return !1;
  const e = n;
  return e.ruleset === Ql.ruleset && e.featureSet === Ql.featureSet;
}

function Nw(n, e) {
  return (
    (n === void 0 && e === void 0) ||
    (ko(n) && ko(e) && n.ruleset === e.ruleset && n.featureSet === e.featureSet)
  );
}

function rg(mode) { return isPlayableGameplay(mode); }

function MI(n) {
  if (!rg(n))
    throw new Error(n === "lte" ? "LTE 模式暂未开放。" : "未知的房间玩法。");
}

function r20(n) {
  return AI.map((e) => {
    const t = `track_/${e}/track.1s`,
      i = n.canonicalCandidates(t);
    if (i.length !== 1)
      throw new Error(`LTE专属赛道 ${e} 的主体资源未唯一命中。`);
    return { id: e, path: i[0].virtualPath };
  });
}

function s20(n, e, t, i) {
  const r = i[e ? 0 : 1]?.dyeId;
  if (r === void 0) throw new Error("挡人模式缺少红蓝染色剂定义。");
  if (!e)
    return {
      ...n,
      equipment: { ...n.equipment, itemIds: { ...n.equipment.itemIds, 70: r } },
    };
  const s = t.filter(
    (o) =>
      o.itemId === 1137 && o.internalId === "practice5" && o.engineGrade === 1,
  );
  if (s.length !== 1) throw new Error("挡人跑者缺少唯一的练习用卡丁车 PRO。");
  return {
    ...n,
    garage: void 0,
    equipment: {
      ...n.equipment,
      kartSerial: 0,
      systemKart: void 0,
      systemKartVariant: void 0,
      exceedType: 0,
      valueAt3E: 0,
      itemIds: {
        ...n.equipment.itemIds,
        3: s[0].itemId,
        70: r,
        68: 0,
        69: 0,
        76: 0,
        77: 0,
      },
    },
  };
}

const Er = [
  {
    key: "topSpeed",
    field: "dragFactor",
    factoryGroup: 1,
    factoryLabel: "最高速度",
    factoryValues: [-8e-4, -0.0015, -0.0022],
    xunSkill: 3,
    xunGroup: 413,
    xunLabel: "最高速度",
    xunValues: [-8e-4, -0.001, -0.0013, -0.0017, -0.00225],
  },
  {
    key: "forwardAccel",
    field: "forwardAccel",
    factoryGroup: 2,
    factoryLabel: "加速度",
    factoryValues: [1.5, 2.5, 3.5],
    xunSkill: 1,
    xunGroup: 411,
    xunLabel: "普通行驶加速度",
    xunValues: [1.5, 1.7, 2, 2.5, 3.5],
  },
  {
    key: "cornerAccel",
    field: "cornerDrawFactor",
    factoryGroup: 3,
    factoryLabel: "弯道加速度",
    factoryValues: [7e-4, 0.0014, 0.002],
    xunSkill: 2,
    xunGroup: 412,
    xunLabel: "弯道加速",
    xunValues: [7e-4, 8e-4, 0.001, 0.0015, 0.002],
  },
  {
    key: "teamBoosterTime",
    field: "teamBoosterTime",
    factoryGroup: 4,
    factoryLabel: "组队加速器时间",
    factoryValues: [100, 180, 250],
    xunSkill: 5,
    xunGroup: 422,
    xunLabel: "组队加速时间",
    xunValues: [100, 130, 160, 200, 250],
  },
  {
    key: "normalBoosterTime",
    field: "normalBoosterTime",
    factoryGroup: 5,
    factoryLabel: "个人加速器时间",
    factoryValues: [70, 120, 190],
    xunSkill: 4,
    xunGroup: 421,
    xunLabel: "加速时间",
    xunValues: [90, 110, 130, 170, 210],
  },
  {
    key: "startBoosterTime",
    field: "startBoosterTimeSpeed",
    factoryGroup: 6,
    factoryLabel: "启动加速器时间",
    factoryValues: [200, 400, 800],
    xunSkill: 6,
    xunGroup: 423,
    xunLabel: "启动加速时间",
    xunValues: [150, 250, 350, 500, 800],
  },
  {
    key: "transformAccel",
    field: "transAccelFactor",
    factoryGroup: 7,
    factoryLabel: "变形加速度",
    factoryValues: [0.006, 0.01, 0.018],
    xunSkill: 7,
    xunGroup: 431,
    xunLabel: "变形加速度",
    xunValues: [0.006, 0.008, 0.01, 0.014, 0.02],
  },
  {
    key: "gaugeCharge",
    field: "driftMaxGauge",
    factoryGroup: 8,
    factoryLabel: "集气速度",
    factoryValues: [-70, -140, -200],
    xunSkill: 9,
    xunGroup: 433,
    xunLabel: "集气速度",
    xunValues: [-80, -100, -120, -160, -210],
  },
  {
    key: "driftOptimization",
    field: "driftEscapeForce",
    factoryGroup: 9,
    factoryLabel: "漂移最佳化",
    factoryValues: [80, 140, 210],
    xunSkill: 8,
    xunGroup: 432,
    xunLabel: "漂移最佳化",
    xunValues: [70, 100, 130, 180, 210],
  },
];

function o20(n) {
  return Er.find((e) => e.factoryGroup === n);
}

function xI(n) {
  return Er.find((e) => e.xunSkill === n);
}

const Vf0 = "仅 9 代及以下和 XUN（迅）车型可升级，请从列表选择可升级车辆。";

function a20(n) {
  if (!(n === void 0 || !Number.isInteger(n))) {
    if (n >= 0 && n <= 6) return "classic";
    if (n === 9) return "xun";
  }
}

const Nf0 = Er.map((n) => ({
  id: n.xunSkill,
  groupId: n.xunGroup,
  label: n.xunLabel,
  field: n.field,
  values: [0, ...n.xunValues],
})).sort((n, e) => n.id - e.id);

function Of0(n) {
  return n
    ? {
        kind: "xun",
        level: 0,
        skills: [
          { id: 1, points: 0 },
          { id: 4, points: 0 },
          { id: 7, points: 0 },
        ],
      }
    : { kind: "classic", level: 0, points: [0, 0, 0, 0] };
}

const c20 = [0, 2, 5, 10, 20, 35];

function l20(n) {
  return n !== void 0 && Number.isInteger(n) && n >= 3 && n <= 6;
}

function sg(n) {
  return (
    (n.kind === "xun" ? (n.level * (n.level + 1)) / 2 : c20[n.level]) -
    (n.kind === "xun"
      ? n.skills.reduce((e, t) => e + t.points, 0)
      : n.points.reduce((e, t) => e + t, 0))
  );
}

function un(n) {
  if (!n || !Number.isInteger(n.level) || n.level < 0 || n.level > 5)
    throw new Error("无效的本地车辆强化等级。");
  const e = (t, i) => Number.isInteger(t) && t >= 0 && t <= i;
  if (n.kind === "classic") {
    if (
      !Array.isArray(n.points) ||
      n.points.length !== 4 ||
      !n.points.every((t) => e(t, 10))
    )
      throw new Error("强化点必须为四项 0..10。");
  } else if (n.kind === "xun") {
    if (
      !Array.isArray(n.skills) ||
      n.skills.length !== 3 ||
      !n.skills.every(
        (t) =>
          t &&
          Number.isInteger(t.id) &&
          t.id >= 1 &&
          t.id <= 9 &&
          e(t.points, 5),
      )
    )
      throw new Error("迅性能槽须选择 1..9 的技能，每项 0..5 点。");
    if (new Set(n.skills.map((t) => t.id)).size !== 3)
      throw new Error("三个性能槽不能重复选择同一技能。");
  } else throw new Error("无效的车辆强化代际。");
  if (sg(n) < 0) throw new Error("可用强化点不足。");
}

function SI(n, e, t) {
  if ((un(n), n.level === 5)) throw new Error("车辆已达到最高强化等级。");
  const i = e === "max" ? 5 : n.kind === "xun" || l20(t) ? n.level + 1 : 5;
  return { ...n, level: i };
}

function zf0(n, e) {
  return SI(n, "step", e);
}

function Uf0(n, e, t, i = "step") {
  un(e);
  const r = SI(n, i, t),
    s = (o) =>
      o.kind === "xun" ? o.skills.map((a) => [a.id, a.points]) : o.points;
  if (
    e.kind !== r.kind ||
    e.level !== r.level ||
    JSON.stringify(s(e)) !== JSON.stringify(s(r))
  )
    throw new Error(
      "强化必须按所选模式逐级或一键升满，不能同时修改已分配点数。",
    );
  return {
    beforeLevel: n.level,
    afterLevel: e.level,
    beforePoints: sg(n),
    afterPoints: sg(e),
  };
}

function $f0(n, e, t) {
  if (
    (un(n),
    !Number.isInteger(e) ||
      e < 0 ||
      e >= (n.kind === "xun" ? 3 : 4) ||
      (t !== -1 && t !== 1))
  )
    throw new Error("无效的强化点操作。");
  const i =
    n.kind === "classic"
      ? { ...n, points: n.points.map((r, s) => r + (s === e ? t : 0)) }
      : {
          ...n,
          skills: n.skills.map((r, s) => ({
            ...r,
            points: r.points + (s === e ? t : 0),
          })),
        };
  return (un(i), i);
}

function Wf0(n, e, t) {
  if ((un(n), !Number.isInteger(e) || e < 0 || e > 2))
    throw new Error("无效的技能栏。");
  const i = {
    ...n,
    skills: n.skills.map((r, s) =>
      s === e ? { id: t, points: t === r.id ? r.points : 0 } : r,
    ),
  };
  return (un(i), i);
}

function u20(n, e, t = 7, i) {
  if (!e) return n;
  if (
    (un(e),
    (i === void 0 ? n.defaultExceedType > 0 : i === 9) !== (e.kind === "xun"))
  )
    throw new Error("车辆强化与车代不兼容。");
  const s = { ...n },
    o = (a, c) => {
      c &&
        !(t === 4 && a === "driftMaxGauge") &&
        (s[a] = Math.fround(s[a] + Math.fround(c)));
    };
  if (e.kind === "xun")
    for (const a of e.skills) {
      const c = xI(a.id);
      if (!c) throw new Error("迅性能技能映射缺失。");
      o(c.field, a.points === 0 ? 0 : c.xunValues[a.points - 1]);
    }
  else {
    const [a, c, l, u] = e.points;
    (o(
      "dragFactor",
      [
        0, -1e-4, -2e-4, -3e-4, -4e-4, -5e-4, -6e-4, -7e-4, -8e-4, -0.001,
        -0.0012,
      ][a],
    ),
      o("forwardAccel", [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 1, 1.5][a]),
      o(
        "cornerDrawFactor",
        [0, 1e-4, 2e-4, 3e-4, 4e-4, 5e-4, 6e-4, 7e-4, 8e-4, 9e-4, 0.001][c],
      ),
      o(
        "steerConstraint",
        [0, 0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.08, 0.11, 0.15, 0.2][c],
      ),
      o("driftEscapeForce", [0, 1, 3, 6, 10, 15, 20, 26, 33, 40, 50][l]),
      o(
        "transAccelFactor",
        [
          0, 1e-4, 3e-4, 6e-4, 0.001, 0.0014, 0.0019, 0.0025, 0.0032, 0.004,
          0.005,
        ][u],
      ));
    const h = [0, 5, 10, 15, 20, 30, 40, 50, 65, 80, 100][u];
    o("startBoosterTimeSpeed", h);
  }
  return s;
}

function n7(n) {
  if (!n || (n.family !== "classic" && n.family !== "xun"))
    throw new Error("无效的外观部件代际。");
  for (const e of Object.keys(n))
    if (!["family", "tailLamp", "boosterEffect", "coating"].includes(e))
      throw new Error("不支持的外观部件槽。");
  if (
    n.coating !== void 0 &&
    (!Number.isInteger(n.coating) ||
      n.coating < 1 ||
      n.coating > (n.family === "xun" ? 19 : 23))
  )
    throw new Error("无效的车膜商品编号。");
  for (const e of ["tailLamp", "boosterEffect"]) {
    const t = n[e];
    if (
      t !== void 0 &&
      (!Number.isInteger(t) ||
        t < 1 ||
        (e === "boosterEffect" && n.family !== "xun"))
    )
      throw new Error("无效的外观部件编号。");
  }
}

function h20(n, e) {
  return e === "tailLamp"
    ? n.partsLocks[5] !== 0
    : n.partsBoosterEffectLock !== 0 || n.defaultExceedType <= 0;
}

function d20(n, e, t) {
  if (!e) return;
  if (
    (n7(e),
    e.coating !== void 0 &&
      (n.partsLocks[4] !== 0 ||
        (t !== 8 && t !== 9) ||
        (t === 9) != (e.family === "xun")))
  )
    throw new Error("此车型不允许装备该车膜。");
  if (
    (t === void 0 ? n.defaultExceedType > 0 : t === 9) !==
    (e.family === "xun")
  )
    throw new Error("外观部件与车代不兼容。");
  for (const r of ["tailLamp", "boosterEffect"])
    if (e[r] !== void 0 && h20(n, r)) throw new Error("外观部件槽已锁定。");
}

const Hf0 = Er.map((n) => ({
    id: n.factoryGroup * 100 + 3,
    label: n.factoryLabel,
    field: n.field,
    delta: n.factoryValues[2],
  })),
  i7 = Er.flatMap((n) =>
    n.factoryValues.map((e, t) => ({
      id: n.factoryGroup * 100 + t + 1,
      label: n.factoryLabel,
      field: n.field,
      level: t + 1,
      delta: e,
    })),
  );

function f20(n) {
  const e = i7.find((t) => t.id === n);
  return e ? { group: Math.floor(e.id / 100), level: e.level } : void 0;
}

function qf0(n, e) {
  return i7.find((t) => Math.floor(t.id / 100) === n && t.level === e)?.id;
}

function p20(n, e) {
  return e && /(?:^|[\s_-])(?:C1|E2|G3|R4)(?:$|[\s_-])/i.test(e)
    ? !1
    : n !== void 0 && Number.isInteger(n) && n >= 1 && n <= 8;
}

function Kf0() {
  return { active: !1, abilities: [0, 0, 0] };
}

function CI(n) {
  if (
    !n ||
    typeof n.active != "boolean" ||
    !Array.isArray(n.abilities) ||
    n.abilities.length !== 3 ||
    n.abilities.some((t) => t !== 0 && !i7.some((i) => i.id === t)) ||
    Object.keys(n).some((t) => t !== "active" && t !== "abilities")
  )
    throw new Error("无效的改装魔方记录。");
  const e = n.abilities.filter(Boolean);
  if (new Set(e.map((t) => Math.floor(t / 100))).size !== e.length)
    throw new Error("改装功能不能重复。");
  if (n.active && e.length !== 3)
    throw new Error("本地改装测试需选择三项功能后激活。");
}

function g20(n, e, t) {
  if (!e || (CI(e), !e.active)) return n;
  const i = { ...n };
  for (const r of e.abilities) {
    const s = i7.find((o) => o.id === r);
    (t === 4 && s.field === "driftMaxGauge") ||
      (i[s.field] = Math.fround(i[s.field] + Math.fround(s.delta)));
  }
  return i;
}

const K2 = Math.fround,
  Nx = {
    engine: "defaultEngineType",
    handle: "defaultHandleType",
    wheel: "defaultWheelType",
    booster: "defaultBoosterType",
  },
  m20 = {
    engine: "transAccelFactor",
    handle: "steerConstraint",
    wheel: "driftEscapeForce",
    booster: "normalBoosterTime",
  };

function Jl(n) {
  if (!Number.isInteger(n) || n < 1 || n > 30)
    throw new Error("P3543 迅部件等级必须在 1..30 内。");
  const e = Math.trunc((n - 1) / 10),
    t = (n - 1) % 10,
    i = [0, 2, 4, 7, 10, 13, 17, 21, 25, 30];
  return 201 + e * 23 + i[t];
}

function og(n, e) {
  return Math.fround(
    n === "engine"
      ? (e - 800) / 25e3 + 0.4765
      : n === "handle"
        ? (e - 800) / 250 + 2.7
        : n === "wheel"
          ? e * 2
          : e - 260,
  );
}

const Fn = {
    1: {
      chargeInstAccelGaugeByBoost: K2(0.016),
      chargeInstAccelGaugeByGrip: K2(0.06),
      chargeInstAccelGaugeByWall: K2(0.15),
      instAccelFactor: K2(1.3),
      instAccelGaugeCooldownTime: 3e3,
      instAccelGaugeLength: 1e3,
      instAccelGaugeMinUsable: 300,
      instAccelGaugeMinVelBound: 0,
      instAccelGaugeMinVelLoss: 50,
      useExtendedAfterBoosterMore: 1,
      wallCollGaugeCooldownTime: 3e3,
      wallCollGaugeMaxVelLoss: 200,
      wallCollGaugeMinVelBound: 160,
      wallCollGaugeMinVelLoss: 50,
      chargeInstAccelGaugeByWallAdded: 0,
      chargeInstAccelGaugeByBoostAdded: 0,
      chargerSystemBoosterUseCount: 0,
      chargerSystemUseTime: 0,
      chargeBoostBySpeedAdded: 0,
      driftGaugeFactor: 0,
      chargeAntiCollideBalance: 0,
    },
    2: {
      chargeInstAccelGaugeByBoost: K2(0.02),
      chargeInstAccelGaugeByGrip: K2(0.07),
      chargeInstAccelGaugeByWall: K2(0.15),
      instAccelFactor: K2(1.29),
      instAccelGaugeCooldownTime: 3e3,
      instAccelGaugeLength: 1040,
      instAccelGaugeMinUsable: 208,
      instAccelGaugeMinVelBound: 0,
      instAccelGaugeMinVelLoss: 50,
      useExtendedAfterBoosterMore: 0,
      wallCollGaugeCooldownTime: 3e3,
      wallCollGaugeMaxVelLoss: 200,
      wallCollGaugeMinVelBound: 200,
      wallCollGaugeMinVelLoss: 50,
      chargeInstAccelGaugeByWallAdded: K2(0.09),
      chargeInstAccelGaugeByBoostAdded: K2(0.03),
      chargerSystemBoosterUseCount: 4,
      chargerSystemUseTime: 3e3,
      chargeBoostBySpeedAdded: 350,
      driftGaugeFactor: 2,
      chargeAntiCollideBalance: K2(0.8),
    },
    3: {
      chargeInstAccelGaugeByBoost: K2(0.02),
      chargeInstAccelGaugeByGrip: K2(0.07),
      chargeInstAccelGaugeByWall: K2(0.15),
      instAccelFactor: K2(1.19),
      instAccelGaugeCooldownTime: 3e3,
      instAccelGaugeLength: 2e3,
      instAccelGaugeMinUsable: 400,
      instAccelGaugeMinVelBound: 0,
      instAccelGaugeMinVelLoss: 50,
      useExtendedAfterBoosterMore: 0,
      wallCollGaugeCooldownTime: 3e3,
      wallCollGaugeMaxVelLoss: 200,
      wallCollGaugeMinVelBound: 200,
      wallCollGaugeMinVelLoss: 50,
      chargeInstAccelGaugeByWallAdded: K2(0.09),
      chargeInstAccelGaugeByBoostAdded: K2(0.03),
      chargerSystemBoosterUseCount: 5,
      chargerSystemUseTime: 3750,
      chargeBoostBySpeedAdded: 350,
      driftGaugeFactor: 2,
      chargeAntiCollideBalance: K2(0.8),
    },
    6: {
      chargeInstAccelGaugeByBoost: K2(0.017),
      chargeInstAccelGaugeByGrip: K2(0.07),
      chargeInstAccelGaugeByWall: K2(0.15),
      instAccelFactor: K2(1.16),
      instAccelGaugeCooldownTime: 3e3,
      instAccelGaugeLength: 3e3,
      instAccelGaugeMinUsable: 600,
      instAccelGaugeMinVelBound: 0,
      instAccelGaugeMinVelLoss: 50,
      useExtendedAfterBoosterMore: 0,
      wallCollGaugeCooldownTime: 3e3,
      wallCollGaugeMaxVelLoss: 200,
      wallCollGaugeMinVelBound: 200,
      wallCollGaugeMinVelLoss: 50,
      chargeInstAccelGaugeByWallAdded: K2(0.09),
      chargeInstAccelGaugeByBoostAdded: K2(0.02),
      chargerSystemBoosterUseCount: 6,
      chargerSystemUseTime: 4500,
      chargeBoostBySpeedAdded: 350,
      driftGaugeFactor: 2,
      chargeAntiCollideBalance: K2(0.8),
    },
  },
  w20 = {
    ...Fn,
    4: {
      ...Fn[6],
      chargeInstAccelGaugeByBoost: K2(0.02),
      instAccelGaugeLength: 2500,
      instAccelGaugeMinUsable: 500,
      chargeInstAccelGaugeByBoostAdded: K2(0.03),
    },
    5: {
      ...Fn[2],
      chargeInstAccelGaugeByBoost: K2(0.016),
      chargeInstAccelGaugeByGrip: K2(0.06),
      instAccelFactor: K2(1.3),
      instAccelGaugeLength: 1e3,
      instAccelGaugeMinUsable: 300,
      chargeInstAccelGaugeByWallAdded: 0,
      chargeInstAccelGaugeByBoostAdded: 0,
      chargerSystemBoosterUseCount: 0,
      chargerSystemUseTime: 0,
      chargeBoostBySpeedAdded: 0,
      driftGaugeFactor: 0,
      chargeAntiCollideBalance: 0,
    },
    7: {
      ...Fn[6],
      chargeInstAccelGaugeByBoost: K2(0.02),
      instAccelGaugeLength: 2500,
      instAccelGaugeMinUsable: 500,
      chargeInstAccelGaugeByWallAdded: K2(0.1),
      chargeInstAccelGaugeByBoostAdded: K2(0.04),
      chargerSystemBoosterUseCount: 5,
      chargerSystemUseTime: 4750,
    },
    8: {
      ...Fn[2],
      instAccelFactor: K2(1.32),
      instAccelGaugeMinUsable: 260,
      chargerSystemUseTime: 2700,
    },
    9: {
      ...Fn[3],
      chargeInstAccelGaugeByWall: K2(0.18),
      instAccelGaugeCooldownTime: 2100,
      chargeInstAccelGaugeByWallAdded: K2(0.11),
      chargeAntiCollideBalance: K2(0.6),
    },
    10: {
      ...Fn[3],
      chargeInstAccelGaugeByBoost: K2(0.03),
      instAccelFactor: K2(1.1425),
    },
  };

function v20(n, e) {
  const t = w20[e];
  if (!t) throw new Error(`Launcher_V2 Exceed 类型 ${e} 尚未映射。`);
  return { ...n, ...t, defaultExceedType: e };
}

function EI(n) {
  if (n.defaultExceedType <= 0) return n;
  const e = Fn[n.defaultExceedType];
  if (!e)
    throw new Error(
      `Launcher_V2 Exceed 类型 ${n.defaultExceedType} 尚未映射。`,
    );
  const t = { ...n, ...e },
    i = t;
  for (const r of Object.keys(Nx)) {
    const s = n[Nx[r]],
      o = og(r, Jl(s)),
      a = m20[r];
    i[a] = Math.fround(n[a] + o);
  }
  return t;
}

const Ow = ["engine", "handle", "wheel", "booster"],
  y20 = { engine: "引擎", handle: "方向盘", wheel: "车轮", booster: "加速器" };

function Ox(n, e) {
  return e === "legacy" && n === "booster" ? "部件" : y20[n];
}

const A20 = { engine: 0, handle: 2, wheel: 1, booster: 3 },
  b20 = {
    engine: "defaultEngineType",
    handle: "defaultHandleType",
    wheel: "defaultWheelType",
    booster: "defaultBoosterType",
  },
  M20 = {
    engine: "transAccelFactor",
    handle: "steerConstraint",
    wheel: "driftEscapeForce",
    booster: "normalBoosterTime",
  };

function TI(n, e) {
  if (e === 9) return "xun";
  if (e === 7) return "x";
  if (e === 8) return "v1";
  if (e === void 0 && n.defaultExceedType > 0) return "xun";
}

function x20(n, e) {
  return e !== void 0 && Number.isInteger(e) && e >= 0 && e <= 6
    ? "legacy"
    : TI(n, e);
}

function jf0(n, e) {
  return e === 9 || (e === void 0 && n.defaultExceedType > 0)
    ? "xun"
    : e !== void 0 && Number.isInteger(e) && e >= 0 && e <= 8
      ? "x-v1"
      : void 0;
}

function Xf0(n) {
  return n >= 0 && n <= 6 ? 7 : n;
}

function p5(n, e, t = 0) {
  return e === 0 ? {} : (n?.builds[`${e}:${t}`] ?? {});
}

function S20(n) {
  return Number.isInteger(n) && n > 0 && n <= 65535;
}

function C20(n, e, t, i) {
  if (!S20(e) || !Number.isInteger(t) || t < 0 || t > 65535)
    throw new Error("车库车辆记录无效。");
  return { version: 1, builds: { ...n?.builds, [`${e}:${t}`]: { ...i } } };
}

function E20(n) {
  if (
    !n ||
    n.version !== 1 ||
    !n.builds ||
    typeof n.builds != "object" ||
    Array.isArray(n.builds)
  )
    return n;
  const e = Object.entries(n.builds),
    t = e.filter(([i]) => !/^0:\d{1,5}$/.test(i) || Number(i.slice(2)) > 65535);
  return t.length === e.length ? n : { ...n, builds: Object.fromEntries(t) };
}

function zx(n, e) {
  return n.partsLocks[A20[e]] !== 0;
}

function T20(n, e) {
  const t = n === "v1" && (e === "engine" || e === "wheel") ? 100 : 0;
  return [
    [810, 900, 10, 4],
    [910, 1e3, 10, 3],
    [1005, 1050, 5, 2],
    [1053, 1080, 3, 1],
  ].flatMap(([i, r, s, o]) =>
    Array.from({ length: (r - i) / s + 1 }, (a, c) => ({
      family: n,
      slot: e,
      itemId: n === "x" ? 1 : 2,
      value: i + c * s + t,
      grade: o,
    })),
  );
}

function e6(n, e, t, i = 7, r) {
  const s = x20(n, e),
    o = TI(n, e);
  if ((d20(n, t.cosmetics, e), t.cosmetics && !o))
    throw new Error("该车代外观部件尚未接入。");
  let a = { ...n };
  if (t.exceedType !== void 0) {
    if (
      e !== 9 ||
      !Number.isInteger(t.exceedType) ||
      t.exceedType < 1 ||
      t.exceedType > 10
    )
      throw new Error("无效的车辆超负荷类型记录。");
    t.exceedType !== n.defaultExceedType && (a = v20(a, t.exceedType));
  }
  for (const l of Ow) {
    const u = t[l];
    if (!u || (_I(u), !s)) continue;
    if (s === "legacy") {
      if (u.family !== "legacy") continue;
      if (u.slot !== l) throw new Error("旧代部件与当前车辆槽位不兼容。");
      if (zx(n, l)) throw new Error(`${Ox(l, s)}槽已锁定。`);
      for (const [d, f] of Object.entries(u.legacySpec ?? {})) {
        if (
          !(d in a) ||
          !Number.isFinite(f) ||
          (d === "driftMaxGauge" && a.driftMaxGauge === 1)
        )
          continue;
        const v = a[d];
        typeof v == "number" && (a[d] = Math.fround(v + f));
      }
      for (const [d, f] of Object.entries(u.legacySetSpec ?? {})) {
        const p = Number(f);
        !(d in a) ||
          !Number.isFinite(p) ||
          typeof a[d] != "number" ||
          (a[d] = p);
      }
      continue;
    }
    if (u.family !== s || u.slot !== l)
      throw new Error("部件与当前车辆代际不兼容。");
    if (zx(n, l)) throw new Error(`${Ox(l, s)}槽已锁定。`);
    const h = M20[l];
    if (s === "xun") {
      const d = n[b20[l]];
      if (u.itemId === 1 || u.itemId === d) continue;
      a[h] = Math.fround(
        Math.fround(n[h] - og(l, Jl(d))) + og(l, Jl(u.itemId)),
      );
    } else
      (l === "engine" &&
        (a[h] = Math.fround(
          Math.fround((u.value - 800) / 25e3 + 1.645) + Math.fround(0.2005),
        )),
        l === "handle" &&
          (a[h] = Math.fround(
            Math.fround((u.value - 800) / 250 + 22.4) + Math.fround(1.95),
          )),
        l === "wheel" && (a[h] = Math.fround(u.value * 2 + 2200 + 400)),
        l === "booster" && (a[h] = Math.fround(u.value - 940 + 3e3)));
  }
  const c = a20(e);
  if (t.progression && (un(t.progression), c && c !== t.progression.kind))
    throw new Error("车辆强化与车代不兼容。");
  if (t.factory && !p20(e) && e !== 9)
    throw new Error("该车代不支持本地改装。");
  return u20(g20(r ? r(a) : a, t.factory, i), c ? t.progression : void 0, i, e);
}

function _I(n) {
  if (!n || !Ow.includes(n.slot)) throw new Error("无效的车库部件槽。");
  if (n.builtIn) throw new Error("车辆原装部件不能写入车库存档。");
  if (n.family === "legacy") {
    if (
      !Number.isInteger(n.itemId) ||
      n.itemId < 1 ||
      n.value !== 0 ||
      n.grade !== 0 ||
      n.legacyCategory !== _20[n.slot] ||
      (n.legacyRarity !== void 0 &&
        (!Number.isInteger(n.legacyRarity) ||
          n.legacyRarity < 1 ||
          n.legacyRarity > 4)) ||
      typeof n.legacyTitle != "string" ||
      !n.legacyTitle.trim()
    )
      throw new Error("无效的旧代部件数据。");
    return;
  } else if (n.family === "xun") {
    if (
      n.value !== Jl(n.itemId) ||
      !Number.isInteger(n.grade) ||
      n.grade < 1 ||
      n.grade > 4
    )
      throw new Error("无效的迅部件数据。");
  } else if (n.family === "x" || n.family === "v1") {
    if (
      !T20(n.family, n.slot).some(
        (e) =>
          e.itemId === n.itemId && e.grade === n.grade && e.value === n.value,
      )
    )
      throw new Error("部件数值不在本地测试目录中。");
  } else throw new Error("无效的部件代际。");
}

const _20 = { engine: 43, handle: 44, wheel: 45, booster: 46 };

function GI(n) {
  if (n !== void 0) {
    if (
      !n ||
      n.version !== 1 ||
      !n.builds ||
      Array.isArray(n.builds) ||
      typeof n.builds != "object"
    )
      throw new Error("车库存档格式无效。");
    for (const [e, t] of Object.entries(n.builds)) {
      if (
        !/^[1-9]\d{0,4}:\d{1,5}$/.test(e) ||
        e.split(":").some((i) => Number(i) > 65535) ||
        !t ||
        typeof t != "object" ||
        Array.isArray(t)
      )
        throw new Error("车库车辆记录无效。");
      for (const i of Object.keys(t)) {
        if (i === "progression") {
          un(t.progression);
          continue;
        }
        if (i === "cosmetics") {
          n7(t.cosmetics);
          continue;
        }
        if (i === "factory") {
          CI(t.factory);
          continue;
        }
        if (i === "exceedType") {
          if (
            !Number.isInteger(t.exceedType) ||
            t.exceedType < 1 ||
            t.exceedType > 10
          )
            throw new Error("车辆超负荷类型记录无效。");
          continue;
        }
        if (!Ow.includes(i)) throw new Error("车库部件槽不匹配。");
        const r = t[i];
        if ((_I(r), r.slot !== i)) throw new Error("车库部件槽不匹配。");
      }
    }
  }
}

function zw(n) {
  if (!n.garage) return n.equipment;
  const e = n.equipment,
    t = p5(n.garage, e.itemIds[3], e.kartSerial).cosmetics;
  return {
    ...e,
    itemIds: {
      ...e.itemIds,
      69: t?.family === "classic" ? (t.tailLamp ?? 0) : 0,
      77: t?.family === "xun" ? (t.tailLamp ?? 0) : 0,
    },
  };
}

function BI(n, e) {
  if (n.itemIds[3] === 0 || (e !== 7 && e !== 8 && e !== 9)) return;
  const t = e === 9,
    i = n.itemIds[t ? 77 : 69],
    r = t ? n.itemIds[76] : e === 8 ? n.itemIds[68] : 0;
  return i || r
    ? {
        family: t ? "xun" : "classic",
        ...(i ? { tailLamp: i } : {}),
        ...(r ? { coating: r } : {}),
      }
    : void 0;
}

function G20(n, e, t) {
  const { equipment: i } = n;
  if (i.itemIds[3] === 0) return n;
  const r = BI(i, e),
    s = t ? p5(t.garage, i.itemIds[3], i.kartSerial) : {},
    o = s.cosmetics ? { ...s.cosmetics, tailLamp: void 0 } : void 0;
  return !t && !r
    ? n
    : {
        ...n,
        garage: C20(t?.garage, i.itemIds[3], i.kartSerial, {
          ...s,
          cosmetics: r ? { ...o, ...r } : o,
        }),
      };
}

const B20 = ["国服", "国服复古", "韩服复古"],
  i3 = {
    国服: { 标准: 7, 真无限: 6, 慢速S0: 3, 普通S1: 0, 快速S2: 1, 高速S3: 2 },
    国服复古: { 新手: 0, 初级: 1, L3: 2, L2: 3, L1: 4, Pro: 5 },
    韩服复古: { 新手: 0, 初级: 1, L3: 2, L2: 3, L1: 4, Pro: 5 },
  };

function R20(n) {
  if (n.trim() === "") return;
  const e = n.toLowerCase(),
    t = e.includes("无限") || e.includes("無限") ? 4 : 255,
    r = [...new Set(B20.flatMap((l) => Object.keys(i3[l])))]
      .sort((l, u) => u.length - l.length)
      .find((l) => {
        const u = [...l].filter((d) => d >= "一" && d <= "鿿").join(""),
          h = [...l].filter((d) => !(d >= "一" && d <= "鿿")).join("");
        return u !== "" && h !== ""
          ? e.includes(u.toLowerCase()) || e.includes(h.toLowerCase())
          : e.includes(l.toLowerCase());
      }),
    s = e.includes("韩服复古") || e.includes("韩服"),
    o = i3.国服复古,
    a = s ? "韩服复古" : r !== void 0 && o[r] !== void 0 ? "国服复古" : "国服",
    c = r === void 0 ? 255 : (i3[a][r] ?? 255);
  return { version: a, speedType: c, infinite: t };
}

function RI(n) {
  if (n.gameplay === "lte")
    return { ...i20, competition: n.name.includes("比赛") };
  const e = R20(n.name);
  return {
    version: e && e.speedType !== 255 ? e.version : "国服",
    speed: e && e.speedType !== 255 ? e.speedType : n.speed,
    competition: n.name.includes("比赛"),
  };
}

const Lo = 1, qn = 2e6, k20 = defaultCnSpeedType;
function II(version, speed) { return findSpeedTypeEntry(version, speed); }

const z20 = [
    "mass",
    "airFriction",
    "dragFactor",
    "forwardAccel",
    "backwardAccel",
    "gripBrake",
    "slipBrake",
    "maxSteerDeg",
    "steerConstraint",
    "frontGripFactor",
    "rearGripFactor",
    "driftTrigFactor",
    "driftTrigTime",
    "driftSlipFactor",
    "driftEscapeForce",
    "cornerDrawFactor",
    "driftMaxGauge",
    "transAccelFactor",
    "boostAccelFactor",
  ],
  kI = {
    DragFactor: "dragFactor",
    ForwardAccelForce: "forwardAccel",
    DriftEscapeForce: "driftEscapeForce",
    CornerDrawFactor: "cornerDrawFactor",
    NormalBoosterTime: "normalBoosterTime",
    ItemBoosterTime: "itemBoosterTime",
    TeamBoosterTime: "teamBoosterTime",
    StartForwardAccelItem: "startForwardAccelItem",
    StartForwardAccelSpeed: "startForwardAccelSpeed",
  },
  t5 = Math.fround,
  Ux = 2e6;

function U20(n) {
  const e = {};
  for (const [t, i] of Object.entries(kI)) {
    const r = n && T(n, t),
      s = r === void 0 || r.trim() === "" ? 0 : Number(r);
    if (!Number.isFinite(s)) throw new Error(`飞宠参数 ${t} 无效。`);
    e[i] = t5(s);
  }
  return e;
}

function $20(n, e, t) {
  const i = { ...n };
  for (const r of Object.values(kI))
    if (!(r === "startForwardAccelItem" || r === "startForwardAccelSpeed")) {
      if (
        (r === "normalBoosterTime" || r === "teamBoosterTime") &&
        (t === 6 || n[r] === Ux)
      ) {
        i[r] = Ux;
        continue;
      }
      i[r] = t5(i[r] + e[r]);
    }
  return i;
}

function $x(n, e) {
  const t = Number(t5(n).toPrecision(7)),
    i = Number(t5(e).toPrecision(7));
  if (!t) return t5(e);
  const r = new Map([
    [1.65, -158.679],
    [1.7, -171.212],
    [1.8, -191.644],
    [1.85, -204.276],
    [1.9, -211.547],
    [2.1, -240.324],
  ]);
  return t5(i * t + (r.get(t) ?? -58.8 * t * t));
}

function W20(n, e, t, i = [0, 0]) {
  const r = (s) => {
    const o = Number(j0(e.body, s) ?? 0);
    if (!Number.isFinite(o)) throw new Error(`车辆 ${s} 无效。`);
    return o;
  };
  return {
    ...n,
    startForwardAccelItem: t5(
      t5(
        $x(r("StartForwardAccelFactorItem"), n.forwardAccel) +
          t.startForwardAccelItem,
      ) + i[0],
    ),
    startForwardAccelSpeed: t5(
      t5(
        $x(r("StartForwardAccelFactorSpeed"), n.forwardAccel) +
          t.startForwardAccelSpeed,
      ) + i[1],
    ),
  };
}

async function Ma(n, e) {
  if (!e) return;
  const t = (await n.timeAttackGarageCatalog()).equipment.find(
    (i) => i.kind === "flyingPet" && i.itemId === e,
  );
  if (!t) throw new Error(`装备飞宠 ${e} 缺少精确物品表身份。`);
  return t;
}

function LI(n, e, t, i, r, s, o = (a) => a) {
  const a = e6(n, e, t, i),
    c = e6(n, e, t, i, (l) => $20(l, s.stats, i));
  return W20(o(c), r, s.stats, [
    Math.fround(a.startForwardAccelItem - n.startForwardAccelItem),
    Math.fround(a.startForwardAccelSpeed - n.startForwardAccelSpeed),
  ]);
}

const Y20 = 1e5;

function Q20(n) {
  const e = new a7(n),
    t = new s7().readObject(e).value;
  if (e.remaining !== 0 || t.className !== "PetSequence")
    throw new Error("飞宠动作不是完整的 PetSequence。");
  return t;
}

function xa(n) {
  const e = new a7(n),
    i = new s7().readObject(e);
  if (!Wx(i.value)) throw new Error("model.1s 根对象不是 Relement 派生节点。");
  if (e.remaining !== 0)
    throw new Error(`model.1s 根对象后仍有 ${e.remaining} 个未解析字节。`);
  const r = new Set();
  let s = 0,
    o = 0;
  const a = [i];
  for (; a.length > 0;) {
    const l = a.pop().value;
    r.has(l) ||
      (r.add(l),
      Wx(l) &&
        ((s += 1),
        (l.className === "ReToonRigid" ||
          l.className === "ReTriList" ||
          l.className === "ReToonSkinned") &&
          (o += 1),
        a.push(...l.children),
        l.slots.forEach((u) => {
          u && a.push(u);
        })));
  }
  if (s > Y20) throw new Error("model.1s 节点数量超过安全上限。");
  return { root: i, nodeCount: s, meshCount: o };
}

function J20(n) {
  const e = new a7(n),
    i = new s7().readObject(e);
  if (i.value.className !== "KartSequence")
    throw new Error("车辆动画 .1s 根对象不是 KartSequence。");
  if (e.remaining !== 0)
    throw new Error(`车辆动画根对象后仍有 ${e.remaining} 个未解析字节。`);
  return { root: i };
}

function FI(n) {
  const e = new a7(n),
    i = new s7().readObject(e);
  if (i.value.className !== "CharSequence")
    throw new Error("人物动画 .1s 根对象不是 CharSequence。");
  if (e.remaining !== 0)
    throw new Error(`人物动画根对象后仍有 ${e.remaining} 个未解析字节。`);
  return { root: i };
}

class s7 extends ModelObjectReader {
  constructor() { super(createModelRecordDecoders(L6)); }
}
function Wx(value) { return isModelElement(value); }

class a7 extends ModelBinaryCursor {}

const Hx = new WeakMap(),
  DI = "flyingPet_/common";

class x4 {
  constructor(e, t, i, r, s) {
    ((this.library = e),
      (this.name = t),
      (this.folders = i),
      (this.soundFolders = r),
      (this.stats = s));
  }
  library;
  name;
  folders;
  soundFolders;
  stats;
  clips = new Map();
  models = new Map();
  static load(e, t) {
    if (!/^[\w-]+$/.test(t)) throw new Error("飞宠目录身份无效。");
    let i = Hx.get(e);
    i || ((i = new Map()), Hx.set(e, i));
    let r = i.get(t);
    return (
      r || ((r = this.create(e, t)), i.set(t, r), r.catch(() => i.delete(t))),
      r
    );
  }
  static async create(e, t) {
    const i = `flyingPet_/${t}/`,
      r = L8(e, `${i}param.bml`);
    if (!r) throw new Error(`飞宠 ${t} 缺少模型参数。`);
    const s = s2(await r.bytes()),
      o = (l) =>
        (T(s, l) ?? "")
          .split(",")
          .map((u) => u.trim())
          .filter(Boolean)
          .map((u) => {
            if (!/^[\w-]+$/.test(u)) throw new Error(`飞宠 ${l} 目录无效。`);
            return u;
          }),
      a = e.region,
      c = a === "unknown" ? void 0 : L8(e, `${i}param@${a}.bml`);
    return new x4(
      e,
      t,
      [t, ...o("addModelFolder")],
      o("petSound"),
      U20(c ? s2(await c.bytes()) : void 0),
    );
  }
  find(e) {
    for (const t of this.folders) {
      const i = L8(this.library, `flyingPet_/${t}/${e}`);
      if (i) return i;
    }
  }
  require(e) {
    const t = this.find(e);
    if (!t) throw new Error(`飞宠 ${this.name} 缺少 ${e}。`);
    return t;
  }
  model(e = !1) {
    const t = e ? "model2.1s" : "model.1s";
    let i = this.models.get(t);
    return (
      i || ((i = this.require(t).bytes().then(xa)), this.models.set(t, i)),
      i
    );
  }
  clip(e, t) {
    const i = `${e ? "equipped" : "unequipped"}/f${String(t).padStart(2, "0")}.1s`;
    let r = this.clips.get(i);
    if (!r) {
      const s = this.require(i);
      ((r = s.bytes().then((o) => ({ sequence: Q20(o), path: s.virtualPath }))),
        this.clips.set(i, r));
    }
    return r;
  }
  sound(e) {
    for (const t of this.soundFolders) {
      const i = L8(this.library, `sound_/flyingPet/${t}/${e}.ogg`);
      if (i) return i;
    }
  }
}

function L8(n, e) {
  const t = n.get(e);
  if (t) return t;
  const i = n.exactCanonicalCandidates(e);
  if (i.length > 1) throw new Error(`飞宠资源 ${e} 来源不唯一。`);
  return i[0];
}

const t6 = [
    1, 2, 3, 4, 8, 9, 10, 11, 12, 16, 17, 18, 20, 21, 52, 26, 27, 30, 31, 32,
    36, 43, 45, 44, 46, 58, 59, 61, 70, 68, 69, 71, 76, 77, 78,
  ],
  P8 = (n, e) => Number.isInteger(n) && Number(n) >= 0 && Number(n) <= e,
  qx = (n) => typeof n == "string" && /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(n);

function w90(n) {
  if (!n || typeof n != "object" || Array.isArray(n)) return !1;
  const e = n;
  if (!e.itemIds || typeof e.itemIds != "object" || Array.isArray(e.itemIds))
    return !1;
  const t = e.itemIds;
  return (
    Object.keys(t).length === t6.length &&
    t6.every((i) => P8(t[i], 65535)) &&
    Number(t[1]) > 0 &&
    P8(e.kartSerial, 65535) &&
    P8(e.valueAt3E, 255) &&
    P8(e.exceedType, 65535) &&
    (t[3] === 0 ? qx(e.systemKart) : e.systemKart === void 0) &&
    (e.systemKartVariant === void 0 || (t[3] === 0 && qx(e.systemKartVariant)))
  );
}

function el(n, e = 0, t = 0) {
  const i = Math.fround(0.5 * Math.fround(n.max[0] - n.min[0])),
    r = Math.fround(0.5 * Math.fround(n.max[1] - n.min[1])),
    s = Math.fround(e),
    o = Math.fround(t);
  return {
    rawX: Math.min(s === 0 ? i : s, Math.fround(0.98)),
    rawY: o === 0 ? r : o,
  };
}

function v90(n, e) {
  return {
    rawHalfWidth: n.rawX,
    rawHalfLength: n.rawY,
    scaleX: e.scaleX,
    scaleY: e.scaleY,
    rawHeight: e.height,
  };
}

const n6 = [
    "mod0",
    "mod1",
    "mod1a",
    "mod1a1",
    "mod1a2",
    "mod1a3",
    "mod1a4",
    "mod1b",
    "mod1b1",
    "mod1b2",
    "mod1b3",
    "mod1b4",
    "mod1c",
    "mod1c1",
    "mod1c2",
    "mod1d",
    "mod1d1",
    "mod1d2",
    "mod2",
    "mod2a",
    "mod2a1",
    "mod2a2",
    "mod2a3",
    "mod2a4",
    "mod2b",
    "mod2b1",
    "mod2b2",
    "mod2b3",
    "mod2b4",
    "mod2c",
    "mod2c1",
    "mod2c2",
    "mod2d",
    "mod2d1",
    "mod2d2",
    "mod3",
    "mod3a",
    "mod3a1",
    "mod3b",
    "mod3b1",
    "mod4",
    "mod4a",
    "mod4a1",
    "mod4b",
    "mod4b1",
    "mod5",
    "mod5a",
    "mod5a1",
    "mod5b",
    "mod5b1",
    "mod6",
    "mod6a",
    "mod6a1",
    "mod6b",
    "mod6b1",
  ],
  Kx = new WeakMap(),
  jx = new WeakMap(),
  Xx = new WeakMap(),
  y90 = [1, 0, 0, 0],
  Zi = { start: 0, stop: 0 },
  wh = { start: 0, stop: 0 },
  Yx = [0, 0, 0, 0],
  Zx = [0, 0, 0, 0],
  Qx = [0, 0, 0, 0],
  di = [0, 0, 0, 0];

class vh {
  constructor(e, t) {
    ((this.scene = t),
      (this.clips = e.map((i) => (i ? b90(i.root.value) : void 0))),
      this.resetPoses(),
      [0, 1, 2, 3].every((i) => this.clips[i]) &&
        (this.enter(0, 0, 0), this.update(0, !1, 0)));
  }
  scene;
  clips;
  poses = [];
  stateValue = 0;
  sequenceBound = !1;
  enteredAt = 0;
  durationOverride = 0;
  get state() {
    return this.stateValue;
  }
  hasClip(e) {
    return this.clips[e] !== void 0;
  }
  reset(e = 0) {
    const t = ee(e);
    (this.resetPoses(), this.enter(0, t, 0), this.update(t, !1, 0));
  }
  enterState(e, t, i = 0) {
    return this.enter(e, ee(t), i);
  }
  update(e, t, i, r, s) {
    const o = ee(e);
    return (
      r !== void 0 && s !== void 0 && this.updateDualTransform(o, t, i, r, s),
      t && (this.stateValue === 0 || this.stateValue === 3)
        ? this.enter(1, o, i)
        : !t &&
          (this.stateValue === 1 || this.stateValue === 2) &&
          this.enter(3, o, 0),
      this.advanceCurrentState(o)
    );
  }
  enterDualUse() {
    this.stateValue < 4 && this.enter(4, 0, 1);
  }
  updateDualTransform(e, t, i, r, s) {
    if (r === 1 || r === 2) {
      t && this.stateValue === 2 && this.enter(4, e, i);
      return;
    }
    s !== 10 &&
      (this.stateValue === 4 || this.stateValue === 5) &&
      this.enter(6, e, 0);
  }
  updateCurrentState(e) {
    return this.advanceCurrentState(ee(e));
  }
  advanceCurrentState(e) {
    let t = this.clips[this.stateValue];
    if (!t) return this.stateValue;
    const i = this.sequenceElapsed(e),
      r = this.durationOverride > 0 ? this.durationOverride : t.maximum,
      s = B90(this.stateValue);
    return (
      i >= r &&
        s !== void 0 &&
        this.clips[s] &&
        (this.enter(s, e, 0), (t = this.clips[this.stateValue])),
      this.applyClip(t, e),
      this.stateValue
    );
  }
  sequenceElapsed(e) {
    return (
      this.enteredAt === 0 && (this.enteredAt = e),
      Math.max(0, e - this.enteredAt)
    );
  }
  applyClip(e, t) {
    if (!this.sequenceBound) return;
    const i =
      this.durationOverride > 0 ? v0(e.span / this.durationOverride) : v0(1);
    for (let r = 0; r < e.sequence.channels.length; r += 1) {
      const s = e.sequence.channels[r],
        o = n6[r],
        a = this.scene.nodes.get(o),
        c = this.poses[r];
      if (!a || !c) continue;
      const l = e.channels[r],
        u = this.stateValue === 6;
      (A90(s, l.prs, c, t, i, u),
        c3(a.object, a.source.transform, c.position, c.rotation, c.scale));
      const h = x90(s.visibility.value, l.visibility, t, i, u);
      a.object.visible = a.source.nodeEnabled !== 0 && h !== 0;
    }
  }
  resetPoses() {
    n6.forEach((e, t) => {
      const i = this.scene.nodes.get(e)?.source.transform;
      if (!i) {
        this.poses[t] = void 0;
        return;
      }
      const r = this.poses[t];
      if (r) {
        (eS(r.position, i.translation),
          _90(r.rotation, i.basis),
          eS(r.scale, i.scale));
        return;
      }
      this.poses[t] = {
        position: [i.translation[0], i.translation[1], i.translation[2]],
        rotation: [
          [i.basis[0][0], i.basis[0][1], i.basis[0][2]],
          [i.basis[1][0], i.basis[1][1], i.basis[1][2]],
          [i.basis[2][0], i.basis[2][1], i.basis[2][2]],
        ],
        scale: [i.scale[0], i.scale[1], i.scale[2]],
      };
    });
  }
  enter(e, t, i) {
    const r = this.clips[e];
    if (!r) return !1;
    ((this.stateValue = e),
      (this.sequenceBound = !0),
      (this.enteredAt = ee(t)),
      (this.durationOverride = i > 0 ? ee(i) : 0));
    for (let s = 0; s < r.channels.length; s += 1) {
      const o = r.channels[s];
      (nS(o.prs, this.enteredAt), nS(o.visibility, this.enteredAt));
    }
    return !0;
  }
}

function A90(n, e, t, i, r, s) {
  (n.prs.value.position &&
    Jx(
      t.position,
      n.prs.value.position.value,
      1,
      Qi(Zi, n.prs.value, 0),
      n.prs.value.base,
      e,
      i,
      r,
      s,
    ),
    n.prs.value.rotation &&
      M90(
        t.rotation,
        n.prs.value.rotation.value,
        Qi(Zi, n.prs.value, 2),
        n.prs.value.base,
        e,
        i,
        r,
        s,
      ),
    n.prs.value.scale &&
      Jx(
        t.scale,
        n.prs.value.scale.value,
        0,
        Qi(Zi, n.prs.value, 4),
        n.prs.value.base,
        e,
        i,
        r,
        s,
      ));
}

function b90(n) {
  let e = 4294967295,
    t = 0;
  const i = (r) => {
    r && (r.start < e && (e = r.start), r.stop > t && (t = r.stop));
  };
  return (
    n.channels.forEach((r) => {
      (i(r.prs.value.position ? Qi(Zi, r.prs.value, 0) : void 0),
        i(r.prs.value.rotation ? Qi(Zi, r.prs.value, 2) : void 0),
        i(r.prs.value.scale ? Qi(Zi, r.prs.value, 4) : void 0),
        i(T90(r.visibility.value.visibility.value)));
    }),
    e === 4294967295 && (e = 0),
    {
      sequence: n,
      channels: n.channels.map(() => ({ prs: tS(), visibility: tS() })),
      maximum: t,
      span: ee(t - e + 1),
    }
  );
}

function Jx(n, e, t, i, r, s, o, a, c) {
  if (e.kind !== "fixed" || e.category !== "vec3" || e.keyType !== t)
    throw new Error(`ReKart vec3 evaluator 不支持 keyType ${e.keyType}。`);
  const l = S90(e),
    u = Uw(r, s, o, i, a, c),
    h = VI(l, u),
    d = l[h],
    f = l[Math.min(h + 1, l.length - 1)];
  if (d === f) {
    ((n[0] = d.value[0]), (n[1] = d.value[1]), (n[2] = d.value[2]));
    return;
  }
  const p = NI(d.time, f.time, u);
  ((n[0] = v0(v0(f.value[0] * p) + v0(d.value[0] * v0(1 - p)))),
    (n[1] = v0(v0(f.value[1] * p) + v0(d.value[1] * v0(1 - p)))),
    (n[2] = v0(v0(f.value[2] * p) + v0(d.value[2] * v0(1 - p)))));
}

function M90(n, e, t, i, r, s, o, a) {
  if (e.kind !== "composite" || e.category !== "rotation" || e.keyType !== 4)
    throw new Error("ReKart rotation evaluator 只支持 keyType 4。");
  const c = Uw(i, r, s, t, o, a),
    l = e.components,
    u = yh(l[0], c),
    h = yh(l[1], c),
    d = yh(l[2], c);
  (Ah(Yx, u, 0),
    Ah(Zx, h, 1),
    Ah(Qx, d, 2),
    bh(di, Yx, y90),
    bh(di, Zx, di),
    bh(di, Qx, di),
    G90(n, di));
}

function x90(n, e, t, i, r) {
  const s = n.visibility.value;
  if (s.kind !== "fixed" || s.category !== "visibility" || s.keyType !== 3)
    throw new Error("ReKart visibility evaluator 只支持 keyType 3。");
  const o = E90(s);
  if (o.length === 0) throw new Error("ReKart visibility track 不含 key。");
  ((wh.start = o.length > 1 ? o[0].time : 0),
    (wh.stop = o.length > 1 ? o[o.length - 1].time : 0));
  const a = Uw(n.base, e, t, wh, i, r);
  let c = 0;
  for (; c + 1 < o.length && a > o[c + 1].time;) c += 1;
  return o[c].value;
}

function yh(n, e) {
  if (
    n.kind !== "fixed" ||
    n.category !== "float" ||
    (n.keyType !== 0 && n.keyType !== 3)
  )
    throw new Error(`ReKart scalar evaluator 不支持 keyType ${n.keyType}。`);
  const t = C90(n),
    i = VI(t, e),
    r = t[i],
    s = t[Math.min(i + 1, t.length - 1)];
  if (r === s || n.keyType === 3) return r.value;
  const o = NI(r.time, s.time, e),
    a = v0(s.value - r.value);
  let c = v0(v0(r.outgoing + s.incoming) - v0(2 * a));
  return (
    (c = v0(v0(c * o) + v0(v0(3 * a) - v0(v0(2 * r.outgoing) + s.incoming)))),
    (c = v0(v0(c * o) + r.outgoing)),
    v0(v0(c * o) + r.value)
  );
}

function Uw(n, e, t, i, r, s) {
  e.anchor === 0 && t !== 0 && (e.anchor = t);
  const o = ee(e.anchor + n.phase);
  let a = t < o ? 0 : ee(t + n.phase - e.anchor);
  R90(r) !== 1065353216 && (a = ee(Math.trunc(v0(v0(a) * r))));
  const c = ee(Math.trunc(v0(v0(ee(i.stop - i.start)) * r)));
  if (c === 0) return a;
  const l = s ? 2 : n.cycleMode;
  if (l === 0) return ee((a % c) + i.start);
  if (l === 1) {
    const u = Math.floor(a / c) >>> 0;
    (u !== e.previousCycle && (e.reverseHalf = !e.reverseHalf),
      (e.previousCycle = u));
    const h = a % c;
    return e.reverseHalf ? ee(c - h) : h;
  }
  return l === 2 ? (a < i.start ? i.start : a > i.stop ? i.stop : a) : t;
}

function S90(n) {
  if (n.records.length === 0) throw new Error("ReKart vec3 track 不含 key。");
  const e = Kx.get(n);
  if (e) return e;
  const t = n.records.map((i) => {
    const r = Po(i);
    return {
      time: r.getUint32(0, !0),
      value: [r.getFloat32(4, !0), r.getFloat32(8, !0), r.getFloat32(12, !0)],
    };
  });
  return (Kx.set(n, t), t);
}

function C90(n) {
  if (n.records.length === 0) throw new Error("ReKart scalar track 不含 key。");
  const e = jx.get(n);
  if (e) return e;
  const t = n.records.map((i) => {
    const r = Po(i);
    return {
      time: r.getUint32(0, !0),
      value: r.getFloat32(4, !0),
      incoming: n.keyType === 0 ? r.getFloat32(8, !0) : 0,
      outgoing: n.keyType === 0 ? r.getFloat32(12, !0) : 0,
    };
  });
  return (jx.set(n, t), t);
}

function E90(n) {
  if (n.records.length === 0)
    throw new Error("ReKart visibility track 不含 key。");
  const e = Xx.get(n);
  if (e) return e;
  const t = n.records.map((i) => ({
    time: Po(i).getUint32(0, !0),
    value: i[4],
  }));
  return (Xx.set(n, t), t);
}

function Qi(n, e, t) {
  return (
    (n.start = e.firstLastCache[t]),
    (n.stop = e.firstLastCache[t + 1]),
    n
  );
}

function T90(n) {
  if (!(n.kind !== "fixed" || n.records.length === 0))
    return n.records.length === 1
      ? { start: 0, stop: 0 }
      : {
          start: Po(n.records[0]).getUint32(0, !0),
          stop: Po(n.records[n.records.length - 1]).getUint32(0, !0),
        };
}

function VI(n, e) {
  if (n.length === 0) throw new Error("ReKart track 不含 key。");
  let t = 0;
  for (; t + 1 < n.length && e > n[t + 1].time;) t += 1;
  return t;
}

function eS(n, e) {
  ((n[0] = e[0]), (n[1] = e[1]), (n[2] = e[2]));
}

function _90(n, e) {
  ((n[0][0] = e[0][0]),
    (n[0][1] = e[0][1]),
    (n[0][2] = e[0][2]),
    (n[1][0] = e[1][0]),
    (n[1][1] = e[1][1]),
    (n[1][2] = e[1][2]),
    (n[2][0] = e[2][0]),
    (n[2][1] = e[2][1]),
    (n[2][2] = e[2][2]));
}

function NI(n, e, t) {
  const i = ee(e - n);
  return i === 0 ? 0 : v0(v0(ee(t - n)) / v0(i));
}

function Ah(n, e, t) {
  const i = v0(e * v0(0.5)),
    r = v0(Math.sin(i));
  ((n[0] = v0(Math.cos(i))),
    (n[1] = v0(+(t === 0) * r)),
    (n[2] = v0(+(t === 1) * r)),
    (n[3] = v0(+(t === 2) * r)));
}

function bh(n, e, t) {
  const i = e[0],
    r = e[1],
    s = e[2],
    o = e[3],
    a = t[0],
    c = t[1],
    l = t[2],
    u = t[3];
  ((n[0] = v0(v0(v0(v0(i * a) - v0(r * c)) - v0(s * l)) - v0(o * u))),
    (n[1] = v0(v0(v0(v0(i * c) + v0(r * a)) + v0(s * u)) - v0(o * l))),
    (n[2] = v0(v0(v0(v0(i * l) - v0(r * u)) + v0(s * a)) + v0(o * c))),
    (n[3] = v0(v0(v0(v0(i * u) + v0(r * l)) - v0(s * c)) + v0(o * a))));
}

function G90(n, e) {
  const t = e[0],
    i = e[1],
    r = e[2],
    s = e[3];
  ((n[0][0] = v0(1 - v0(2 * v0(v0(r * r) + v0(s * s))))),
    (n[0][1] = v0(2 * v0(v0(i * r) - v0(t * s)))),
    (n[0][2] = v0(2 * v0(v0(i * s) + v0(t * r)))),
    (n[1][0] = v0(2 * v0(v0(i * r) + v0(t * s)))),
    (n[1][1] = v0(1 - v0(2 * v0(v0(i * i) + v0(s * s))))),
    (n[1][2] = v0(2 * v0(v0(r * s) - v0(t * i)))),
    (n[2][0] = v0(2 * v0(v0(i * s) - v0(t * r)))),
    (n[2][1] = v0(2 * v0(v0(r * s) + v0(t * i)))),
    (n[2][2] = v0(1 - v0(2 * v0(v0(i * i) + v0(r * r))))));
}

function B90(n) {
  if (n === 1 || n === 6) return 2;
  if (n === 3) return 0;
  if (n === 4) return 5;
}

function tS() {
  return { anchor: 0, previousCycle: 0, reverseHalf: !1 };
}

function nS(n, e) {
  ((n.anchor = e), (n.previousCycle = 0), (n.reverseHalf = !1));
}

function Po(n) {
  return new DataView(n.buffer, n.byteOffset, n.byteLength);
}

function ee(n) {
  return n >>> 0;
}

function v0(n) {
  return Math.fround(n);
}

const iS = new DataView(new ArrayBuffer(4));

function R90(n) {
  return (iS.setFloat32(0, n, !0), iS.getUint32(0, !0));
}

const I90 = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ],
  rS = P0(6.283185005187988),
  k90 = P0(0.0010000000474974513),
  L90 = P0(0.5),
  sS = P0(-0.1),
  Mh = P0(0.1),
  P90 = P0(-0.2),
  F90 = P0(-0.05),
  OI = P0(Math.sqrt(P0(2))),
  D90 = P0(P0(-1) / OI),
  V90 = P0(P0(1) / OI);

class N90 {
  constructor(e, t, i) {
    this.visual = i;
    const r = new Set(
      n6.map((s) => t.nodes.get(s)?.source).filter((s) => s !== void 0),
    );
    if (
      ((this.handle = O90(e, t)),
      (this.riderMount = z90(e, t)),
      r.has(this.handle.source))
    )
      throw new Error(
        "handle child 0 同时绑定 PRS/Vis，矩阵 owner 顺序未闭合。",
      );
    ((this.mainWheels = zI(e).map((s, o) => {
      const a = UI(s, t, o);
      if (r.has(a.source))
        throw new Error(
          `主轮 ${o} child 0 同时绑定 PRS/Vis，矩阵 owner 顺序未闭合。`,
        );
      return a;
    })),
      (this.extWheels = [8, 9].map((s) => aS(t, r, i.attachments[s]))),
      (this.extSteers = [10, 11].map((s) => aS(t, r, i.attachments[s]))));
  }
  visual;
  handle;
  riderMount;
  mainWheels;
  extWheels;
  extSteers;
  visualCompression = [0, 0, 0, 0];
  extRates = [0, 0];
  extAngles = [0, 0];
  mainAngle = 0;
  previousTimeMs = 0;
  reset() {
    (this.visualCompression.fill(0),
      this.extRates.fill(0),
      this.extAngles.fill(0),
      (this.mainAngle = 0),
      (this.previousTimeMs = 0));
  }
  update(e, t, i) {
    const r = t >>> 0;
    if (!this.visual.wheelFixed)
      for (let u = 0; u < 4; u += 1)
        this.visualCompression[u] = q90(P0(e.wheelCompression[u] - L90));
    const s = H90(e.vx, e.vy, e.vz);
    (this.updateExtRates(s, i), this.advanceAngles(r, s));
    const o = P0(e.steering * P0(-3)),
      a = this.visual.ignoreWheelSteer ? I90 : U90(P0(-o));
    (this.updateMotorcycleRider(e.motorcyclePresentation), xh(this.handle, a));
    const c = cS(this.mainAngle),
      l = W90(a, c);
    (this.mainWheels.forEach((u, h) => {
      c3(
        u.object,
        u.source.transform,
        [0, 0, this.visualCompression[h]],
        h < 2 ? l : c,
        u.source.transform.scale,
      );
    }),
      this.extSteers.forEach((u) => {
        u && xh(u, a);
      }),
      this.extWheels.forEach((u, h) => {
        u && xh(u, cS(this.extAngles[h]));
      }));
  }
  updateMotorcycleRider(e) {
    const t = this.riderMount?.children[0];
    if (!t) return;
    const i = $90(P0(e * P90));
    c3(t, {
      basis: i,
      translation: [P0(e * F90), 0, 0],
      scale: [P0(t.scale.x), P0(t.scale.y), P0(t.scale.z)],
    });
  }
  updateExtRates(e, t) {
    const i = P0(this.visual.extWheelSpeed);
    if (this.visual.extWheelType === 0)
      ((this.extRates[0] = i), (this.extRates[1] = i));
    else if (this.visual.extWheelType === 1) {
      const r = P0(e * i);
      ((this.extRates[0] = r), (this.extRates[1] = r));
    } else
      this.visual.extWheelType === 2 &&
        (t === 1 || t === 3) &&
        ((this.extRates[0] = i), (this.extRates[1] = i));
  }
  advanceAngles(e, t) {
    if (this.previousTimeMs === 0)
      ((this.mainAngle = 0), (this.extAngles[0] = 0), (this.extAngles[1] = 0));
    else {
      const i = (e - this.previousTimeMs) >>> 0,
        r = P0(P0(i) * k90),
        s = P0(r * t);
      ((this.mainAngle =
        this.mainAngle <= P0(rS - s)
          ? P0(this.mainAngle + s)
          : P0(s - P0(rS - this.mainAngle))),
        (this.mainAngle === Number.POSITIVE_INFINITY ||
          this.mainAngle === Number.NEGATIVE_INFINITY) &&
          (this.mainAngle = 0),
        (this.extAngles[0] = P0(this.extAngles[0] + P0(r * this.extRates[0]))),
        (this.extAngles[1] = P0(this.extAngles[1] + P0(r * this.extRates[1]))));
    }
    this.previousTimeMs = e;
  }
}

function c7(n, e) {
  const t = Sa(n),
    i = e.bySource.get(t);
  if (!i) throw new Error("balloon ReKart root 缺少 scene binding。");
  const r = i.children.find((l) => l.name === "balloon");
  if (r) return r;
  const s = lr(t.children[4], "balloon wheel2 parent"),
    o = lr(t.children[5], "balloon wheel3 parent"),
    a = s.transform.translation.map((l, u) =>
      P0(P0(l + o.transform.translation[u]) * P0(0.5)),
    ),
    c = new T2();
  return (
    cn(c),
    (c.name = "balloon"),
    c.matrix.makeTranslation(a[0], a[1], a[2]),
    (c.matrixAutoUpdate = !1),
    (c.matrixWorldNeedsUpdate = !0),
    i.add(c),
    c
  );
}

function oS(n, e, t) {
  return UI($I(Sa(n), t), e, t);
}

function zI(n) {
  const e = Sa(n);
  return [0, 1, 2, 3].map((t) => $I(e, t));
}

function Sa(n) {
  if (n.root.value.className !== "ReKart")
    throw new Error("主轮绑定要求 ReKart root。");
  return n.root.value;
}

function lr(n, e) {
  const t = n?.value;
  if (!t || !WI(t)) throw new Error(`${e} 缺少 Relement 派生节点。`);
  return t;
}

function UI(n, e, t) {
  const i = e.bySource.get(n);
  if (!i) throw new Error(`主轮 ${t} child 0 缺少 scene binding。`);
  return { source: n, object: i };
}

function O90(n, e) {
  const t = lr(Sa(n).children[1], "handle parent (ReKart child 1)");
  if (t.className !== "Relement")
    throw new Error("handle parent 不是 Relement。");
  const i = lr(t.children[0], "handle child 0");
  if (i.className !== "ReToonRigid")
    throw new Error("handle child 0 不是 ReToonRigid。");
  const r = e.bySource.get(i);
  if (!r) throw new Error("handle child 0 缺少 scene binding。");
  return { source: i, object: r };
}

function z90(n, e) {
  const t = Sa(n).children[6]?.value;
  return t && WI(t) ? e.bySource.get(t) : void 0;
}

function $I(n, e) {
  const t = `主轮 ${e}`,
    i = lr(n.children[e + 2], `${t} parent (ReKart child ${e + 2})`);
  if (i.className !== "Relement")
    throw new Error(`${t} parent 不是 Relement。`);
  const r = lr(i.children[0], `${t} child 0`);
  if (r.className !== "ReToonRigid")
    throw new Error(`${t} child 0 不是 ReToonRigid。`);
  return r;
}

function aS(n, e, t) {
  const i = n.nodes.get(t);
  if (!i) return;
  const r = i.source.children[0]?.value;
  if (!r || r.className !== "ReToonRigid") return;
  if (e.has(r))
    throw new Error(`${t} child 0 同时绑定 PRS/Vis，矩阵 owner 顺序未闭合。`);
  const s = n.bySource.get(r);
  return s ? { source: r, object: s } : void 0;
}

function xh(n, e) {
  c3(
    n.object,
    n.source.transform,
    n.source.transform.translation,
    e,
    n.source.transform.scale,
  );
}

function cS(n) {
  const e = P0(Math.sin(n)),
    t = P0(Math.cos(n));
  return [
    [1, 0, 0],
    [0, t, P0(-e)],
    [0, e, t],
  ];
}

function U90(n) {
  const e = P0(Math.sin(n)),
    t = P0(Math.cos(n));
  return [
    [t, P0(-e), 0],
    [e, t, 0],
    [0, 0, 1],
  ];
}

function $90(n) {
  const t = D90,
    i = V90,
    r = P0(Math.sin(n)),
    s = P0(Math.cos(n)),
    o = P0(P0(1) - s),
    a = P0(P0(0 * t) * o),
    c = P0(P0(0 * i) * o),
    l = P0(P0(t * i) * o),
    u = P0(0 * r),
    h = P0(t * r),
    d = P0(i * r);
  return [
    [P0(P0(P0(0) * o) + s), P0(d + a), P0(c - h)],
    [P0(a - d), P0(P0(P0(t * t) * o) + s), P0(u + l)],
    [P0(h + c), P0(l - u), P0(P0(P0(i * i) * o) + s)],
  ];
}

function W90(n, e) {
  return [0, 1, 2].map((t) =>
    [0, 1, 2].map((i) =>
      P0(
        P0(P0(n[t][0] * e[0][i]) + P0(n[t][1] * e[1][i])) +
          P0(n[t][2] * e[2][i]),
      ),
    ),
  );
}

function H90(n, e, t) {
  const i = P0(P0(P0(n * n) + P0(e * e)) + P0(t * t));
  return P0(Math.sqrt(i));
}

function q90(n) {
  return Number.isNaN(n) ? Mh : n < sS ? sS : n > Mh ? Mh : n;
}

function WI(n) {
  return (
    n.className === "ReKart" ||
    n.className === "Relement" ||
    n.className === "ReCharacter" ||
    n.className === "ReToonRigid" ||
    n.className === "ReTriList" ||
    n.className === "ReToonSkinned"
  );
}

function P0(n) {
  return Math.fround(n);
}

function HI(n, e, t) {
  const i = n.root.value;
  if (i.className !== "ReKart") throw new Error("车膜绘制需要 ReKart。");
  const r = new Set(),
    s = new Map();
  function o(d) {
    if (r.has(d)) throw new Error("车膜模型包含共享或循环节点。");
    (r.add(d), d.name && s.set(d.name, [...(s.get(d.name) ?? []), d]));
    for (const f of d.children) {
      if (!("children" in f.value))
        throw new Error("车膜模型 child 不是节点。");
      o(f.value);
    }
  }
  o(i);
  const a = new Map();
  function c(d, f, p, v) {
    if (
      !d ||
      typeof d != "object" ||
      !("className" in d) ||
      d.className !== "ReToonRigid"
    )
      return;
    const w = d,
      g = {
        source: w,
        record: f,
        reflectionEligible: p,
        matrixSource: v ?? w,
        origin: w.geometry.value.positions[0] ?? [0, 0, 0],
      };
    if (a.get(w))
      throw new Error("同一车膜几何被重复绑定或存在冲突的绘制批次。");
    a.set(w, g);
  }
  c(i.children[0]?.value, "coating", !0, i);
  const l = (d) => d?.children[0]?.value,
    u = (d) => {
      const f = i.children[d]?.value;
      return f && "children" in f ? f : void 0;
    };
  for (let d = 2; d <= 5; d++) c(l(u(d)), "ordinary", !1);
  c(l(u(1)), "ordinary", !0);
  for (let d = 8; d <= 15; d++) {
    const f = e[d];
    if (!f) continue;
    const p = s.get(f) ?? [];
    if (p.length > 1) throw new Error(`车膜挂点不唯一：${f}`);
    c(l(p[0]), "coating", !0);
  }
  const h = n6.flatMap((d) => {
    const f = s.get(d) ?? [];
    if (f.length > 1) throw new Error(`车膜动画挂点不唯一：${d}`);
    return f.map((p) => ({
      parent: p,
      enabled: l(p)?.className === "ReToonRigid",
    }));
  });
  for (const d of h) {
    if (!r.has(d.parent)) throw new Error("车膜 extra 不属于当前模型。");
    if (d.enabled) {
      const f = l(d.parent);
      if ((c(f, "coating", !0), f?.className === "ReToonRigid")) {
        const p = a.get(f),
          v = i.children[0]?.value;
        v && "children" in v && a.set(f, { ...p, bodyVisibilitySource: v });
      }
    }
  }
  return {
    draws: [...a.values()],
    unclassified: [...r].filter(
      (d) => d.className === "ReToonRigid" && !a.has(d),
    ),
  };
}

function K90(n, e, t, i, r, s = [0, 0]) {
  const o = e.record === "coating" && t !== void 0;
  ((n.uniforms.environmentAddSigned.value = o ? 1 : 0),
    (n.uniforms.normalProjectionEnabled.value =
      o && e.reflectionEligible ? 0 : 1),
    n.uniforms.reflectionOriginObject.value.fromArray(e.origin),
    n.uniforms.reflectionUvOffset.value.set(o ? s[0] : 0, o ? s[1] : 0),
    o && (n.uniforms.toonEnv.value = t),
    n.uniforms.clientWorld.value.copy(i),
    n.uniforms.clientWorldInverse.value.copy(i).invert(),
    n.uniforms.viewOriginClient.value.copy(r));
}

const es = 48;

async function qI(n, e, t, i, r, s, o = !1) {
  const a = n.root.value;
  if (a.serializedBoundsOverride !== 0 || a.cullingTraversalMode !== 3)
    throw new Error("P3528 ReKart root bounds mode 不在已闭合模型集合。");
  const c = new J9(e.pixels, e.width, e.height, e9, _9);
  ((c.name = "kart:t1ImageName"),
    (c.colorSpace = v9),
    (c.flipY = !1),
    (c.wrapS = c.wrapT = S1),
    (c.magFilter = c.minFilter = h9),
    (c.generateMipmaps = !1),
    (c.needsUpdate = !0));
  const l = new T2();
  Hl(l);
  const u = new Map(),
    h = new Map(),
    d = new Set(),
    f = new Set(),
    p = [];
  let v,
    w = new Map();
  const g = new v2(),
    y = new v2(),
    b = new H(),
    A = [],
    x = [],
    M = new Set(zI(n));
  let E = 0;
  const _ = Sh(void 0, void 0),
    C = Sh(n.root.value, _).alpha,
    S = [],
    G = D(n.root, _);
  P();
  const I = new T2();
  ((I.name = "ReKart:P3528Cull"), I.add(G));
  const L = {
    cullingObject: I,
    sourceObject: G,
    bounds: a.bounds0,
    cullingTraversalMode: a.cullingTraversalMode,
    children: [],
    enabled: a.nodeEnabled !== 0,
  };
  return (
    l.add(I),
    q(G),
    {
      object: l,
      modelRoot: G,
      nodes: u,
      bySource: h,
      rootMaterialBindings: S,
      update: e0,
      setCoatingProjection: k,
      dispose: Q,
    }
  );
  function k(U) {
    if (o && (U?.draws.length ?? 0) > 0)
      throw new Error(
        "车膜宿主必须以逐部件模式构建；调色板合并场景不支持车膜绘制。",
      );
    const O = new Map();
    for (const F of U?.draws ?? []) {
      if (
        !h.has(F.source) ||
        !h.has(F.matrixSource) ||
        O.has(F.source) ||
        (F.bodyVisibilitySource && !h.has(F.bodyVisibilitySource))
      )
        throw new Error("车膜绘制来源不属于当前车辆或重复。");
      O.set(F.source, F);
    }
    ((v = U), (w = O));
  }
  function D(U, O) {
    const F = U.value;
    if (h.has(F))
      throw new Error(`${F.name || F.className} 使用共享 model node。`);
    const z = Sh(F, O);
    let Y;
    if (F.className === "ReToonRigid") {
      const X = bo(c, { kind: "normal-projection" });
      (Mo(X, Ch(z.alpha, z.zbuf)), d.add(X));
      const l0 = j90(F.geometry.value);
      f.add(l0);
      const r0 = new D2(l0, X);
      (o && !M.has(F)
        ? ((r0.visible = !1), x.push({ body: r0, state: z }))
        : o
          ? A.push({ body: r0, material: X })
          : (r0.onBeforeRender = (z0, W, R2) => {
              const I0 = hS(r0.matrixWorld, Eh);
              (uS.copy(I0).invert(),
                En.set(R2.position.x, -R2.position.z, R2.position.y),
                xo(X, i, r, I0, uS, En),
                (X.uniforms.environmentAddSigned.value = 0),
                (X.uniforms.normalProjectionEnabled.value = 1),
                X.uniforms.reflectionUvOffset.value.set(0, 0));
              const o2 = w.get(F);
              if (v && o2) {
                const G0 = h.get(o2.matrixSource);
                (hS(G0.matrixWorld, Eh),
                  R2.getWorldPosition(En),
                  En.set(En.x, -En.z, En.y),
                  K90(X, o2, v.texture, Eh, En, v.offset));
              }
            }),
        (r0.frustumCulled = !1),
        S.push({ mesh: r0, inheritsRootAlpha: z.alpha === C }),
        ie(r0, F.sortDepthBias, X.transparent, X.transparent ? -0.01 : 0));
      const j = new T2();
      j.add(r0);
      const F0 = !M.has(F) || t,
        O0 = new N6(F.geometry.value, 4278190080, 2130706432, F0, s, !0);
      (p.push({ outline: O0, body: r0, source: F }),
        F0 &&
          ((O0.object.frustumCulled = !1),
          ie(O0.object, F.sortDepthBias, !0),
          j.add(O0.object)),
        (Y = j));
    } else if (F.className === "ReTriList") {
      const X = CB(c, Ch(z.alpha, z.zbuf));
      d.add(X);
      const l0 = X90(F);
      (f.add(l0),
        (Y = new D2(l0, X)),
        S.push({ mesh: Y, inheritsRootAlpha: z.alpha === C }),
        (Y.frustumCulled = !1),
        ie(Y, F.sortDepthBias, X.transparent, X.transparent ? -0.01 : 0));
    } else {
      if (F.className === "ReToonSkinned")
        throw new Error(
          `${F.name || "ReToonSkinned"} skin/palette consumer 尚未闭合。`,
        );
      Y = new T2();
    }
    return (
      (Y.name = F.name),
      Z90(Y, F.transform),
      (Y.visible = F.nodeEnabled !== 0),
      h.set(F, Y),
      F.children.forEach((X) => {
        if (!Q90(X)) throw new Error(`${F.name} child 不是 Relement。`);
        Y.add(D(X, z));
      }),
      Y
    );
  }
  function V(U) {
    return `${U.alpha.blendEnable},${U.alpha.srcBlend},${U.alpha.dstBlend},${U.alpha.alphaTestEnable},${U.alpha.alphaFunc},${U.alpha.alphaRef},${U.zbuf.mode},${U.zbuf.enabled}`;
  }
  function K(U) {
    if (U.length > es)
      throw new Error(`调色板分块失败：${U.length} 件超出 ${es} 槽容量。`);
    let O = 0;
    for (const I0 of U) O += I0.body.geometry.getAttribute("position").count;
    const F = new Float32Array(O * 3),
      z = new Float32Array(O * 3),
      Y = new Float32Array(O * 2),
      X = new Float32Array(O);
    let l0 = 0;
    U.forEach((I0, o2) => {
      const G0 = I0.body.geometry,
        D0 = G0.getAttribute("position").array,
        E0 = G0.getAttribute("normal").array,
        f2 = G0.getAttribute("uv").array;
      (F.set(D0, l0 * 3),
        z.set(E0, l0 * 3),
        Y.set(f2, l0 * 2),
        X.fill(o2, l0, l0 + D0.length / 3),
        (l0 += D0.length / 3));
    });
    const r0 = new t9();
    (r0.setAttribute("position", new _0(F, 3)),
      r0.setAttribute("normal", new _0(z, 3)),
      r0.setAttribute("uv", new _0(Y, 2)),
      r0.setAttribute("aPartIndex", new _0(X, 1)),
      f.add(r0));
    const j = bo(c, { kind: "normal-projection" }, es);
    (Mo(j, Ch(U[0].state.alpha, U[0].state.zbuf)), d.add(j));
    const F0 = new D2(r0, j);
    ((F0.frustumCulled = !1),
      ie(F0, 0, j.transparent, j.transparent ? -0.01 : 0),
      G.add(F0),
      A.push({ body: F0, material: j }));
    const O0 = new v2(),
      z0 = new v2(),
      W = j.uniforms.uPartPalette.value,
      R2 = U.map((I0) => I0.body);
    F0.onBeforeRender = () => {
      O0.copy(F0.matrixWorld).invert();
      for (let I0 = 0; I0 < R2.length; I0 += 1)
        (z0.multiplyMatrices(O0, R2[I0].matrixWorld),
          W.set(z0.elements, I0 * 16));
    };
  }
  function P() {
    const U = new Map();
    for (const O of x) {
      const F = V(O.state),
        z = U.get(F);
      z ? z.push(O) : U.set(F, [O]);
    }
    for (const O of U.values())
      for (let F = 0; F < O.length; F += es) {
        const z = O.slice(F, F + es);
        ((E += z.length), K(z));
      }
  }
  function q(U) {
    (U.children.forEach((O) => {
      const F = [...h.entries()].find(([, z]) => z === O)?.[0];
      F && !u.has(F.name) && u.set(F.name, { source: F, object: O });
    }),
      U.children.forEach(q));
  }
  function e0(U, O, F) {
    if (!(U instanceof Z9))
      throw new Error(
        "P3528 ReKart hierarchy culling 需要 perspective camera。",
      );
    if ((nq(l, !0), !o))
      for (const { outline: Y, body: X, source: l0 } of p) {
        const r0 = w.get(l0)?.bodyVisibilitySource,
          j = !v || !r0 || h.get(r0).visible;
        ((X.visible = j), (Y.object.visible = j && !Y.isBatched()));
      }
    if ((JG([L], U), !lS(I))) {
      for (const { outline: Y } of p) Y.dropFrame();
      return;
    }
    const z = SB(U, O, F);
    b.set(U.position.x, -U.position.z, U.position.y);
    for (const { body: Y, material: X } of A)
      lS(Y) &&
        (g.makeRotationX(Math.PI / 2).multiply(Y.matrixWorld),
        y.copy(g).invert(),
        xo(X, i, r, g, y, b));
    p.forEach(({ outline: Y, body: X }) => Y.update(X, U, O, F, void 0, z));
  }
  function Q() {
    (p.forEach(({ outline: U }) => U.dispose()),
      f.forEach((U) => U.dispose()),
      d.forEach((U) => U.dispose()),
      c.dispose());
  }
}

function Sh(n, e) {
  const t = {
      className: "AlphaProperty",
      blendEnable: 0,
      srcBlend: 2,
      dstBlend: 1,
      alphaTestEnable: 0,
      alphaFunc: 8,
      alphaRef: 0,
    },
    i = { className: "ZBufProperty", mode: 4, enabled: 1 },
    r = n?.slots[3]?.value,
    s = n?.slots[10]?.value;
  return {
    alpha: r?.className === "AlphaProperty" ? r : (e?.alpha ?? t),
    zbuf: s?.className === "ZBufProperty" ? s : (e?.zbuf ?? i),
  };
}

function Ch(n, e) {
  const t = (i, r) => ({ source: "property-bank", value: i, bankIndex: r });
  return {
    alpha: t(
      {
        kind: "alpha",
        blendEnable: n.blendEnable,
        srcBlend: n.srcBlend,
        dstBlend: n.dstBlend,
        alphaTestEnable: n.alphaTestEnable,
        compare: n.alphaFunc,
        alphaRef: n.alphaRef,
      },
      0,
    ),
    backface: t({ kind: "backface", cull: 2 }, 7),
    fog: t(
      {
        kind: "fog-property",
        selector: 0,
        mode: 1,
        color: 0,
        start: 0,
        end: 1,
        density: 1,
      },
      11,
    ),
    material: t(
      {
        kind: "material",
        mode: 0,
        ambient: 4294967295,
        diffuse: 4294967295,
        specular: 4294967295,
        power: 1,
        reserved: 0,
        emissive: 4294967295,
        controllers: [],
        controllerOccurrences: [],
      },
      12,
    ),
    texture: t(
      {
        kind: "texture",
        textureOp: 1,
        addressU: 1,
        addressV: 1,
        minFilter: 1,
        magFilter: 1,
        mipFilter: 0,
        maxAnisotropy: 1,
        uvControllers: [],
        uvControllerOccurrences: [],
        scalar: 1,
      },
      13,
    ),
    toon: t(
      {
        kind: "toon",
        flags: [1, 1],
        words: [1, 4, 4294967295, 1065353216, 0, 2, 0, 4278190080, 2130706432],
      },
      15,
    ),
    wire: t({ kind: "wire", enabled: 0 }, 16),
    zbuffer: t({ kind: "zbuffer", zFunc: e.mode, zWrite: e.enabled }, 19),
  };
}

function j90(n) {
  const e = new Float32Array(n.faces.length * 9),
    t = new Float32Array(n.faces.length * 9),
    i = new Float32Array(n.faces.length * 6);
  n.faces.forEach((s, o) => {
    for (let a = 0; a < 3; a += 1) {
      const c = n.positions[s.positionIndices[a]],
        l = n.texcoords[s.texcoordIndices[a]];
      (e.set(c, o * 9 + a * 3),
        t.set(n.normals[l.normalIndex], o * 9 + a * 3),
        i.set([l.u, l.v], o * 6 + a * 2));
    }
  });
  const r = new t9();
  return (
    r.setAttribute("position", new _0(e, 3)),
    r.setAttribute("normal", new _0(t, 3)),
    r.setAttribute("uv", new _0(i, 2)),
    r
  );
}

function X90(n) {
  const e = n.vertexData.value;
  if (!e.positions || e.uvSetsPerVertex === 0)
    throw new Error(`${n.name} 缺少 position/UV0。`);
  const t = new t9();
  return (
    t.setAttribute("position", new M1(e.positions.flat(), 3)),
    t.setAttribute(
      "uv",
      new M1(
        e.uvs.flatMap((i) => i[0]),
        2,
      ),
    ),
    t.setAttribute(
      "primaryColor",
      new M1(
        e.diffuseColors?.flatMap(Y90) ??
          Array.from({ length: e.vertexCount }, () => [1, 1, 1, 1]).flat(),
        4,
      ),
    ),
    t.setIndex([...e.indices]),
    t
  );
}

function Y90(n) {
  return [
    ((n >>> 16) & 255) / 255,
    ((n >>> 8) & 255) / 255,
    (n & 255) / 255,
    ((n >>> 24) & 255) / 255,
  ];
}

function Z90(n, e) {
  (cn(n), c3(n, e));
}

function Q90(n) {
  return [
    "ReKart",
    "Relement",
    "ReCharacter",
    "ReToonRigid",
    "ReTriList",
    "ReToonSkinned",
  ].includes(n.value.className);
}

function lS(n) {
  for (let e = n; e; e = e.parent) if (!e.visible) return !1;
  return !0;
}

const Eh = new v2(),
  uS = new v2(),
  En = new H();

function hS(n, e) {
  return e.makeRotationX(Math.PI / 2).multiply(n);
}

const J90 = 180 * 1024 * 1024,
  e10 = 64 * 1024 * 1024,
  t10 = 64 * 1024 * 1024;

class Tr {
  async importVehicle1s(e, t, i, r) {
    const { model: s, animations: o } = Th(e, r);
    if (i.length === 0 || i.length > t10)
      throw new Error("kart texture 文件为空或超过 64 MB 上限。");
    const a = await n10(i),
      c = new d3({ color: 16777215, map: a, transparent: !1, alphaTest: 0 });
    try {
      const l = J5(s);
      r10(l, c);
      const u = new T2();
      ((u.name = t), Hl(u));
      const h = VY(s, c);
      (u.add(h.object), i10(u));
      const d = el(l.rootBounds),
        f = new vh(o, h);
      return {
        name: t,
        model: s,
        object: u,
        footprint: d,
        animation: f,
        scene: h,
      };
    } catch (l) {
      throw (c.dispose(), a.dispose(), l);
    }
  }
  importVehicleRuntime(e, t, i) {
    const { model: r, animations: s } = Th(e, i),
      o = J5(r),
      a = new T2();
    ((a.name = t), Hl(a));
    const c = NY(r);
    a.add(c.object);
    const l = el(o.rootBounds),
      u = new vh(s, c);
    return {
      name: t,
      model: r,
      object: a,
      footprint: l,
      animation: u,
      scene: c,
    };
  }
  async importVehicleRender(e, t, i, r, s, o, a, c, l = !1) {
    const { model: u, animations: h } = Th(e, r),
      d = J5(u),
      f = await qI(u, i, s, o, a, c, l);
    c7(u, f);
    const p = new T2();
    ((p.name = t), p.add(f.object));
    const v = el(d.rootBounds),
      w = new vh(h, f);
    return {
      name: t,
      model: u,
      object: p,
      footprint: v,
      animation: w,
      scene: f,
      renderScene: f,
    };
  }
}

function Th(n, e) {
  if (n.length === 0 || n.length > J90)
    throw new Error("model.1s 文件为空或超过 180 MB 上限。");
  const t = xa(n),
    i = e.map((r) => {
      if (r) {
        if (r.length === 0 || r.length > e10)
          throw new Error("kart animation.1s 文件为空或超过 64 MB 上限。");
        return J20(r);
      }
    });
  return { model: t, animations: i };
}

async function n10(n) {
  const e = n.buffer.slice(n.byteOffset, n.byteOffset + n.byteLength),
    t = new Blob([e], { type: "image/png" }),
    i = URL.createObjectURL(t);
  try {
    const r = await new zN().loadAsync(i);
    return ((r.colorSpace = Fe), (r.flipY = !1), r);
  } finally {
    URL.revokeObjectURL(i);
  }
}

function u5(n) {
  const e = new Set(),
    t = new Set(),
    i = new Set();
  (n.traverse((r) => {
    if (!(r instanceof D2)) return;
    (e.add(r.geometry),
      (Array.isArray(r.material) ? r.material : [r.material]).forEach((o) => {
        (t.add(o),
          Object.values(o).forEach((a) => {
            a instanceof D9 && i.add(a);
          }));
      }));
  }),
    e.forEach((r) => r.dispose()),
    i.forEach((r) => r.dispose()),
    t.forEach((r) => r.dispose()));
}

function i10(n) {
  n.updateMatrixWorld(!0);
  const t = new R4().setFromObject(n).getSize(new H());
  if (!Number.isFinite(t.length()) || t.length() < 1e-4)
    throw new Error("model.1s 没有可见网格或尺寸无效。");
}

function r10(n, e) {
  const t = n.slots[3]?.value;
  if (!t || t.className !== "AlphaProperty")
    throw new Error("玩家车辆 ReKart 缺少 slot 4 AlphaProperty。");
  if (t.blendEnable !== 0)
    throw new Error(
      "当前 Web 渲染 adapter 尚未映射启用状态的 D3D9 blend tuple。",
    );
  if (((e.transparent = !1), t.alphaTestEnable === 0)) {
    e.alphaTest = 0;
    return;
  }
  if (t.alphaFunc !== 5)
    throw new Error(
      `当前 Web 渲染 adapter 尚未映射 D3D9 alpha func ${t.alphaFunc}。`,
    );
  e.alphaTest = t.alphaRef / 255;
}

const kartBoosterDependencies = {
  decodeScene: y9, buildScene: c5, parseXml: x1,
  xmlChild: zp, xmlAttribute: j0, warmDetachedScene: Hn,
};
class KI extends KartBoosterSharedSources {}
class Ca extends KartBoosterEffectHost {
  static load(library, vehicle, grade, kart, environment, stage,
    presentation = "driving", allowed, shared) {
    return super.load(library, vehicle, grade, kart, environment,
      stage, presentation, allowed, shared, kartBoosterDependencies);
  }
}
function $w(state) { return boosterKindForState(state); }
function Ww(state) { return waveKindForState(state); }

function u10(n, e, t) {
  const i = Math.fround,
    r = (c, l) => {
      const u = j0(c, "Mass"),
        h = u === void 0 ? l : Number(u);
      if (!Number.isFinite(i(h)) || (u !== void 0 && u.trim() === ""))
        throw Error("Invalid remote kart resource mass");
      return i(h);
    },
    s = i(r(n.dynamics, 100) + r(e.body, 0)),
    o = i(i(t.max[0] - t.min[0]) * 0.5),
    a = i(i(t.max[1] - t.min[1]) * 0.5);
  if (
    ![s, o, a].every((c) => Number.isFinite(c) && c > 0) ||
    !Number.isFinite(i(12 / s))
  )
    throw Error("Invalid remote kart dimensions or mass");
  return { mass: s, halfWidth: o, halfLength: a };
}

export { $f0, $w, Aa, BI, BJ, BQ, Bo, C20, C8, CI, Ca, Cw, DI, Dw, E20, EI, Er, Ew, F9, FI, FR, G20, GI, GJ, Gw, HI, Hf0, II, Io, Iw, Jl, Jp, KI, Kf0, Kl, LI, Lo, MI, Ma, N90, NR, Nf0, Nw, OQ, OR, Of0, Os, Ow, Ox, PR, Q00, Q6, Q9, Qc, Ql, RI, Ro, Rw, S20, S9, SI, Sw, T20, TI, TJ, Tr, Tw, U1, Uf0, Vf0, Vw, WQ, WR, Wf0, Ww, X2, X6, XR, Xf0, Yc, Yi, Z00, Zl, _I, _J, _w, a20, aI, bI, ba, c7, dI, e6, eI, el, f20, fn, g20, h2, h20, hI, he, i3, i7, jM, jR, jf0, k20, ko, mI, n20, n7, o20, oI, oS, p20, p5, pQ, qI, qM, qf0, qn, r20, r7, rg, s20, sg, sh, t20, t6, t7, tI, te, u10, u20, u5, un, v90, vI, vJ, w90, wI, wa, x20, x4, xI, xa, xs, y20, yI, ya, z20, zQ, zf0, zw, zx };
