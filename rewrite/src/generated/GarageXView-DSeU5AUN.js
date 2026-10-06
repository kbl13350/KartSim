import { collectGarageParts, parseLegacyGarageParts, resolveEquippedGaragePart, sameGaragePart, sortGarageParts } from "../ui/garage-parts-business.ts";
import { GarageControlCanvas } from "../ui/garage-control-canvas.ts";
import { garageControlZIndex, garageObjectFitRect } from "../ui/garage-control-canvas-lifecycle.ts";
import { intersectGarageRect } from "../ui/garage-control-canvas-rebuild.ts";
import { garageCssLength, paintGarageControlBox, paintGarageControlCharacter, splitGarageCssLayers } from "../ui/garage-control-canvas-paint.ts";
import { GarageModelCache } from "../ui/garage-model-cache.ts";
import { GarageInventoryScroll } from "../ui/garage-inventory-scroll.ts";
import { compareGarageSkillEffects, garageSkillEffectRect, GaragePointEffects } from "../ui/garage-point-effects.ts";
import { GarageSkillSelectionState, GarageUpgradePreparationState } from "../ui/garage-progression-session.ts";
import { GarageSkillSelectionDialog } from "../ui/garage-skill-dialog.ts";
import { GarageExceedTypeDialog } from "../ui/garage-exceed-dialog.ts";
import { clearPreparationPageFrames, closeGaragePreparation, disposeGaragePreparation, preparationCards, preparationPreviewCard, preparationPreviewRect, resizePreparationCanvases, selectedPreparationVehicle } from "../ui/garage-upgrade-preparation-state.ts";
import { compareGarageUpgradeLevels, drawGaragePreparation, drawPreparationCards, fillPreparationMethodPanel, preparationMethodPanelRect } from "../ui/garage-upgrade-preparation-render.ts";
import { addPreparationCancelButton, addPreparationComparisonValue, addPreparationLabel, createPreparationButton, decoratePreparationPageArrow, placePreparationControl } from "../ui/garage-upgrade-preparation-controls.ts";
import { loadGaragePreparation } from "../ui/garage-upgrade-preparation-loading.ts";
import { refreshGaragePreparation } from "../ui/garage-upgrade-preparation-refresh.ts";
import { initializeGaragePreparation } from "../ui/garage-upgrade-preparation-construction.ts";
import { initializeGarageUpgradeResult } from "../ui/garage-upgrade-result-construction.ts";
import { captureGarageUpgradePreview, closeGarageUpgradeResult, disposeGarageUpgradeResult, renderGarageUpgradeResult } from "../ui/garage-upgrade-result-render.ts";
import { disposeGarageProgressionPanel, resetGarageProgressionPanel, updateGarageProgressionRadar } from "../ui/garage-progression-radar.ts";
import { appendGarageNativeColorText, garageExceedChangeAvailability, updateGarageProgressionPanel } from "../ui/garage-progression-panel.ts";
import { addGarageProgressionButton, addGarageProgressionLabel, addGarageProgressionNativeLabel, addGarageProgressionTexture, garageProgressionRect, placeGarageProgressionElement, styleGarageProgressionFromNode } from "../ui/garage-progression-elements.ts";
import { drawGarageProgressionView, garageProgressionPreviewRect, initializeGarageProgressionView } from "../ui/garage-progression-view.ts";
import { equipGaragePart, requestGaragePartEquip, requireGarageCustomization, selectGaragePartSlot, setGaragePartPreview } from "../ui/garage-equipment-actions.ts";
import { canSetGarageProgression, filteredGarageKarts, garageFactoryAllowed, selectGarageKart, selectGaragePage } from "../ui/garage-catalog-navigation.ts";
import { canonicalGarageFactoryVehicle, garageFactoryVehicleKey, garageKartSerialFor, updateGarageFactoryScores } from "../ui/garage-factory-scoring.ts";
import { equipGarageCoating, equipGarageCosmetic, requestGarageCoating, requestGarageCosmetic } from "../ui/garage-cosmetic-equipment.ts";
import { updateGarageCards } from "../ui/garage-card-catalog.ts";
import { publishGarageCurrentState, refreshGarageUpgradeState, requestGarageRestoreDefaults, setGarageProgression } from "../ui/garage-state-commit.ts";
import { GarageFactorySession, setGarageFactory } from "../ui/garage-factory-commit.ts";
import { requestGarageExceedTypeChange, requestGarageSkillSelection } from "../ui/garage-upgrade-dialog-actions.ts";
import { requestGarageProgression } from "../ui/garage-progression-flow.ts";
import { garageCosmeticIcon, syncGarageCosmeticPreviewActions, updateGarageCoatingInventory, updateGarageCosmeticInventory } from "../ui/garage-cosmetic-inventory.ts";
import { renderGarageScoreRows, updateGaragePerformance } from "../ui/garage-performance.ts";
import { disposeGarageView, freezeGarageView, loadGarageView, resizeGarageSurface, showGarageView, unfreezeGarageView } from "../ui/garage-lifecycle.ts";
import { updateGarageCosmeticEquippedSlots } from "../ui/garage-equipped-cosmetics.ts";
import { updateGarageVehicleFunctions, updateGarageVehicleHeading, updateGarageVehicleInformation } from "../ui/garage-vehicle-information.ts";
import { updateGaragePageVisibility } from "../ui/garage-page-visibility.ts";
import { updateGarageControls } from "../ui/garage-controls.ts";
import { createGarageActionButton, createGarageIcon, createGarageNativeButton, garageViewRect, placeGarageControl, setGaragePartsOnlyNodesMounted, setGarageUpgradeStatusMounted, setGarageVehicleInfoNodesMounted, skinGarageActionButton } from "../ui/garage-view-controls.ts";
import { addGaragePartModelTarget, renderGaragePartModels, renderGaragePartVisual } from "../ui/garage-part-models.ts";
import { buildGarageControls } from "../ui/garage-build-controls.ts";
import { initializeGarageView } from "../ui/garage-view-construction.ts";
import { garageBaseForKart, garageBaseSpecification, garagePartLabel, garageSelectedKartSerial, garageSpeedVersion, handleGarageEscapeKey, rehitGarageInventoryPreview, showGarageFactoryTutorial } from "../ui/garage-view-actions.ts";
import { captureGarageStage, captureGarageStrengtheningStage, drawGarageKartCatalogFrame, drawGarageKartLevelBadge, finishGarageCanvasFrame, garageAuthoredPointerY, paintGarageTaskbar } from "../ui/garage-frame-canvas.ts";
import { renderGarageStrengtheningOverlay } from "../ui/garage-strengthening-overlay.ts";
import { renderGarageFrame } from "../ui/garage-frame-render.ts";
import { createGarageTransformPreviewButton, endGaragePreviewDrag, moveGaragePreviewDrag, startGaragePreviewDrag } from "../ui/garage-preview-input.ts";
import { activeGaragePreviewRect, finishGaragePreviewDrag, flushGarageTransformPreviewStart, isGarageTransformPreviewSessionActive, moveToGarageTransformPreviewRoot, placeInGarageTransformPreviewRoot, startGarageTransformPreview, syncGarageTransformPreviewUi } from "../ui/garage-transform-preview.ts";
import { commitGarageFactoryChoice, createGarageFactoryChoiceButton, renderGarageFactoryAbilityPicker, updateGarageFactoryDraftSlot } from "../ui/garage-factory-picker.ts";
import { updateGarageFactoryPanel } from "../ui/garage-factory-panel.ts";
import { addGarageFactoryLabel, garageFactoryCatalogLayout, garageFactoryPreviewRect, garageFactoryShowsCatalog, initializeGarageFactoryView, placeGarageFactoryElement, updateGarageFactoryScoreLabel } from "../ui/garage-factory-view.ts";
import { drawGarageFactoryBackground, drawGarageFactoryCatalogFrame, resizeGarageFactoryCanvases, styleGarageFactoryActionFrame } from "../ui/garage-factory-canvas.ts";
const garageProgressionRadarDependencies = { createStatus: () => document.createElement("div"), loadParameters: da, applyChanges: ha, makeRadar: la };
const garageProgressionPanelDependencies = { nextLevel: Vs, remainingPoints: we, changePoint: ze, initialProgression: ce, get skills() { return fs; } };
const garageProgressionElementsDependencies = { attribute: y };
const garageProgressionDrawDependencies = { attribute: y, drawFrame: (context, frame, image, rect) => be(context, frame, image, rect), drawRadar: (context, rect, radar) => ga(context, rect, radar) };
const garageEquipmentDependencies = { canCustomize: ae, slotLocked: fe, currentConfiguration: K, validateConfiguration: te, writeConfiguration: ie, partFamily: me, slotLabel: le };
const garageCatalogDependencies = { canCustomize: ae, progressionLayout: pe, blockedKart: Re, validateKart: Ft, factoryAllowed: ui, progressionKind: Ue, progressionMismatchMessage: oi };
const garageFactoryScoringDependencies = { currentConfiguration: K, scoreFamily: vt, loadScoreSource: cs, calculateScores: Me };
const garageCosmeticDependencies = { currentConfiguration: K, vehicleFamily: rt, validateConfiguration: te, writeConfiguration: ie, loadVehicle: hi, cosmeticParameters: gi, validateCosmeticResources: di };
const garageCardDependencies = { get standardPageSize() { return kn; }, hoverState: xa, standardCardRect: Gi };
const garageStateCommitDependencies = { currentConfiguration: K, writeConfiguration: ie, validateConfiguration: te, composeEquipment: ot, normalizeEquipment: pi, progressionLayout: ue, progressionKind: pe, supportsProgression: Ue, expectedProgressionKind: Ut, initialProgression: ce };
const garageFactoryCommitDependencies = { currentConfiguration: K, validateConfiguration: te, writeConfiguration: ie, createSession: (records, send) => new GarageFactorySession(records, send) };
const garageUpgradeDialogDependencies = { currentConfiguration: K, initialProgression: ce, gradeFamily: Ue, exceedChangeAvailability: $s, validateConfiguration: te, writeConfiguration: ie, openSkillSelection: (...args) => new Da(...args), openExceedTypeChange: (...args) => new Tn(...args) };
const garageProgressionFlowDependencies = { currentConfiguration: K, initialProgression: ce, blockedKart: Re, transition: ri, openPreparation: (...args) => new Ja(...args), openResult: (...args) => new Ra(...args) };
const garageCosmeticInventoryDependencies = { currentConfiguration: K, vehicleFamily: rt, choicesForSlot: ci, slotLocked: li, canEquip: mt, get cardBackgroundKey() { return Ze; } };
const garagePerformanceDependencies = { currentConfiguration: K, applyConfiguration: te, applySpeedVersion: Gt, previewPartConfiguration: Xi, vehicleFamily: me, scoreFamily: vt, loadScoreSource: cs, calculateScores: Me, fallbackScoreGrade: ys, scoreGradeForValue: dn, performanceLayout: ue, textureToken: y };
const garageLifecycleLoadDependencies = { get defaultStageWidth() { return Ai; }, normalizeStage: width => _t(width), loadAssets: (library, width) => zi(library, width), loadPreviews: options => Fn(options), loadLayout: (library, name, width) => Wt(library, name, width), createView: (options, assets, tuning, previews) => new As(options, assets, tuning, previews), createFactoryPanel: (...args) => new Pa(...args), loadConfirmation: (...args) => ti.load(...args), loadPanels: (...args) => si.load(...args), previewSize: (width, height) => ii(width, height) };
const garageLifecycleDependencies = { window, cancelAnimationFrame: frame => cancelAnimationFrame(frame) };
const garageViewportDependencies = { pixelRatio: () => Ee(), sizeCanvas: (...args) => Pe(...args) };
const garageEquippedCosmeticsDependencies = { defaultLampIcon: ni };
const garageVehicleInformationDependencies = { vehicleFamily: me, resolvePart: Xe, slotLocked: fe, xunPartLevel: Ns, partPresentation: Wi, slotLabel: le, uniqueLevel: Et, isMaxLevel: En, sceneAttribute: y, get slotNodeNames() { return wt; }, vehicleFunctions: Fi };
const garagePageVisibilityDependencies = { canCustomize: ae, showVehicleInformation: ds, defaultCardRect: assets => bt(assets) };
const garageControlsDependencies = { showVehicleInformation: ds, progressionFamily: pe, canCustomize: ae, blockedKart: Re, progressionSupport: Ue, expectedProgressionKind: Ut, currentEquipment: K, vehicleFamily: me, layoutForGrade: ue, initialProgression: ce, slots: de, get slotNodes() { return wt; }, slotLabel: le, partsForSlot: qi, cardLayout: xt, inventoryRect: Dt, quality: Et, cardTexture: Sn, samePart: Kt, equippedPart: Xe, slotLocked: fe, canEquip: mt, bindPreview: Mn };
const garageFactoryPickerDependencies = { get abilities() { return Mt; }, draftFrom: value => ht(value), signature: value => Zt(value), validate: value => Tt(value), abilityId: (group, level) => Hs(group, level), stylePrimary: button => he(button, undefined, "primary"), nodeAttribute: (node, name) => y(node, name), nativeStatePath: (base, state) => se(base, state) };
const garageFactoryPanelDependencies = { defaultConfiguration: () => nt(), signature: value => Zt(value), draftFrom: value => ht(value), get abilityDescriptions() { return ms; }, attribute: (node, name) => y(node, name), nativeStatePath: (base, state) => se(base, state), childRect: (node, rect) => Y(node, rect) };
const garageFactoryViewDependencies = { attribute: (node, name) => y(node, name), childRect: (node, rect) => Y(node, rect) };
const garageFactoryCanvasDependencies = { attribute: (node, name) => y(node, name), pixelRatio: () => Ee(), sizeCanvas: (...args) => Pe(...args), drawFrame: (...args) => be(...args) };
const garageViewActionDependencies = { get defaultVersion() { return vs; }, previewKey: kart => bs(kart), createPreview: (...args) => xs(...args), partLabel: (...args) => $n(...args), hitTest: (...args) => Rn(...args), loadFactoryTutorial: (...args) => Ea(...args), cancelFrame: id => cancelAnimationFrame(id), requestFrame: callback => requestAnimationFrame(callback), elementFromPoint: (x, y) => document.elementFromPoint(x, y) };
const garageFrameCanvasDependencies = { currentConfiguration: (...args) => K(...args), progressionKind: grade => fi(grade), badgeTexture: (grade, level) => mi(grade, level), levelLabel: level => vi(level), drawLabel: (...args) => wi(...args) };
const garageStrengtheningOverlayDependencies = { composeEquipment: (...args) => ot(...args), currentConfiguration: (...args) => K(...args), writeConfiguration: (...args) => ie(...args) };
const garageFrameRenderDependencies = { requestFrame: callback => requestAnimationFrame(callback), now: () => performance.now(), layoutForGrade: grade => ue(grade), backgroundForPage: (page, layout) => Nn(page, layout), nativePageName: (page, xun) => Ln(page, xun), nativeFramePlan: (definition, name) => An(definition, name), attribute: (node, name) => y(node, name), kartTypeTexture: kind => In(kind), drawScrollbar: (...args) => yi(...args), composeEquipment: (...args) => ot(...args), currentConfiguration: (...args) => K(...args), writeConfiguration: (...args) => ie(...args) };
const garagePreviewInputDependencies = { attribute: (node, name) => y(node, name) };
const garageSkillSelectionDependencies = { validate: progression => kt(progression), select: (progression, slot, skillId) => Xs(progression, slot, skillId), availablePoints: progression => we(progression) };
const garageUpgradePreparationDependencies = { blockedKart: itemId => Re(itemId), validate: progression => kt(progression), nextLevel: (progression, method) => Ys(progression, method) };
const garageSkillDialogDependencies = { createState: (progression, row) => new qa(progression, row), loadAssets: library => Ts(library), styleAction: (button, style, kind) => he(button, style, kind), availablePoints: progression => we(progression), get skills() { return fs; } };
const garageExceedDialogDependencies = { styleAction: (button, style, kind) => he(button, style, kind), loadStyles: library => Ts(library), resolveChoice: choice => ua(choice) };
const garagePreparationRenderDependencies = { fitCanvas: (...args) => Pe(...args), pixelRatio: () => Ee(), drawFrame: (...args) => be(...args) };
const garagePreparationConstructionDependencies = { createState: (candidates, selectedItemId) => new Qa(candidates, selectedItemId) };
const garageControlCanvasDependencies = { intersect: (left, right) => intersectGarageRect(left, right), paintBox: (context, style, rect, image) => paintGarageControlBox(context, style, rect, image), paintCharacter: (context, style, character, rect) => paintGarageControlCharacter(context, style, character, rect) };
const garageUpgradeConstructionDependencies = { stylePrimary: button => he(button, undefined, "primary"), loadXun: (...args) => Ma(...args), loadClassic: (...args) => ka(...args) };
const garageUpgradeRenderDependencies = { sizeCanvas: (...args) => Pe(...args), pixelRatio: () => Ee(), phase: (...args) => Aa(...args), get phaseLabels() { return Ia; } };
import {
  x as L,
  p as j,
  a as Z,
  b as y,
  c as Ms,
  l as Rs,
  d as Fs,
  e as Gs,
  G as de,
  f as St,
  s as $t,
  g as Y,
  h as Ce,
  n as gs,
  i as Bs,
  j as me,
  k as te,
  m as fe,
  o as qs,
  q as Ds,
  S as Os,
  r as us,
  P as zs,
  t as ve,
  u as ps,
  v as Us,
  w as Ks,
  y as Vs,
  z as we,
  A as ze,
  B as ce,
  C as fs,
  D as be,
  E as ms,
  F as nt,
  H as Mt,
  I as Hs,
  J as Tt,
  K as Pe,
  L as Ee,
  M as js,
  N as ws,
  O as Ws,
  Q as yt,
  R as kt,
  T as Xs,
  U as Rt,
  V as Re,
  W as Ys,
  X as vt,
  Y as Zs,
  Z as ys,
  _ as Qs,
  $ as le,
  a0 as Ft,
  a1 as Js,
  a2 as ei,
  a3 as ti,
  a4 as si,
  a5 as ii,
  a6 as ai,
  a7 as ie,
  a8 as ni,
  a9 as vs,
  aa as bs,
  ab as xs,
  ac as K,
  ad as ae,
  ae as Ue,
  af as ri,
  ag as oi,
  ah as rt,
  ai as ci,
  aj as li,
  ak as hi,
  al as di,
  am as gi,
  an as Gt,
  ao as ui,
  ap as ot,
  aq as pi,
  ar as fi,
  as as mi,
  at as wi,
  au as yi,
  av as vi,
  aw as bi,
  ax as xi,
  ay as Ci,
} from "./app.js";
function ct(left, right) { return intersectGarageRect(left, right); }
class Pi extends GarageControlCanvas { constructor(surface, width, height) { super(surface, width, height, garageControlCanvasDependencies); } }
function Ke(element) { return garageControlZIndex(element); }
function Cs(rect, width, height, fit) { return garageObjectFitRect(rect, width, height, fit); }
function Fe(value) { return splitGarageCssLayers(value); }
function Ei(context, style, rect, image) { return paintGarageControlBox(context, style, rect, image); }
function Ie(value, basis) { return garageCssLength(value, basis); }
function Si(context, style, character, rect) { return paintGarageControlCharacter(context, style, character, rect); }
const Q = { engine: 43, handle: 44, wheel: 45, booster: 46 },
  Ps = new Map([
    [Q.engine, "engine"],
    [Q.handle, "handle"],
    [Q.wheel, "wheel"],
    [Q.booster, "booster"],
  ]),
  $i = new Map([
    [Q.engine, "tuneEnginePatch"],
    [Q.handle, "tuneHandle"],
    [Q.wheel, "tuneWheel"],
    [Q.booster, "tuneSupportKit"],
  ]),
  Ti = new Map([
    ["tuneEnginePatch", Q.engine],
    ["tuneHandle", Q.handle],
    ["tuneWheel", Q.wheel],
    ["tuneSupportKit", Q.booster],
  ]),
  ki = "TimeAttack";
function Bt(a) {
  return a === void 0 ? !0 : a.split(";").some((e) => e.trim() === ki);
}
function _i(a) {
  const e = new Map();
  for (const t of a?.children ?? []) {
    if (t.name !== "ItemCat") continue;
    const s = Number(L(t, "id"));
    if (Ps.has(s))
      for (const i of t.children) {
        if (i.name !== "Item") continue;
        const n = Number(L(i, "id"));
        if (!Number.isSafeInteger(n) || n < 1) continue;
        const r = {},
          o = i.children.filter((l) => l.name === "EnchanterAddSpec");
        for (const l of o)
          if (Bt(L(l, "gameType")))
            for (const h of l.attributes) {
              if (h.name === "gameType" || h.name === "class") continue;
              const d = h.name,
                f = Number(h.value);
              !Number.isFinite(f) || !Ii.has(h.name) || (r[d] = f);
            }
        const c = i.children.find(
          (l) => l.name === "EnchanterSetSpec" && Bt(L(l, "gameType")),
        );
        e.set(`${s}:${n}`, {
          spec: r,
          setSpec: c
            ? Object.fromEntries(c.attributes.map((l) => [l.name, l.value]))
            : void 0,
        });
      }
  }
  return e;
}
const Ii = new Set([
  "dragFactor",
  "forwardAccel",
  "backwardAccel",
  "gripBrake",
  "slipBrake",
  "frontGripFactor",
  "rearGripFactor",
  "cornerDrawFactor",
  "driftSlipFactor",
  "driftEscapeForce",
  "driftMaxGauge",
  "normalBoosterTime",
  "itemBoosterTime",
  "teamBoosterTime",
  "animalBoosterTime",
  "startBoosterTimeItem",
  "startBoosterTimeSpeed",
  "startForwardAccelItem",
  "startForwardAccelSpeed",
  "transAccelFactor",
  "steerConstraint",
  "boostAccelFactor",
]);
function Li(a, e, t, s) { return parseLegacyGarageParts(a, e, t, s, L); }
function Ni(a) {
  return Q[a];
}
const Ai = 1600,
  Mi = [
    { width: 1400, height: 1050 },
    { width: 1600, height: 900 },
    { width: 1920, height: 1080 },
  ];
function _t(a) {
  const e = Mi.find((t) => t.width === a);
  if (!e) throw new Error(`不支持的车库布局宽度：${a}`);
  return e;
}
const ne = (a, e, t) => ({
    icon: a,
    focusedIcon: `${a}_b`,
    nameKey: `kartBodyEffct_${e}`,
    descriptionKey: `kartBodyEffct_${e}Desc`,
    visible: t,
  }),
  Es = [
    ne(
      "tooltip_icon_드래프트발동",
      "draftMulAccelFactor",
      (a) => a.draftTick > 0,
    ),
    ne(
      "tooltip_icon_듀얼부스터",
      "dualBoosterTickMax",
      (a) => a.dualTransLowSpeed > 0,
    ),
    ne(
      "tooltip_icon_부스터자동충전",
      "chargeBoostBySpeed",
      (a) => a.chargeBoostBySpeed > 0,
    ),
    ne(
      "tooltip_icon_벽충돌게이지증가",
      "wallCollGaugeMaxVelLoss",
      (a) => a.vehicleFunctionWallCollisionGaugeValue > 0,
    ),
    ne(
      "tooltip_icon_차저시스템",
      "chargerSystemboosterUseCount",
      (a) => a.vehicleFunctionChargerBranchValue > 0,
    ),
    ne(
      "tooltip_icon_차저시스템",
      "chargerSystemForItemType",
      (a) => a.vehicleFunctionChargerBranchValue === 0,
    ),
    ne(
      "tooltip_icon_스피드전슬롯개수3",
      "SpeedSlotCapacity",
      (a) => a.speedSlotCapacity === 3,
    ),
    ne(
      "tooltip_icon_아이템전슬롯개수3",
      "ItemSlotCapacity",
      (a) => a.itemSlotCapacity === 3,
    ),
    ne(
      "tooltip_icon_배틀팀필살기2개",
      "SpecialSlotCapacity",
      (a) => a.specialSlotCapacity === 2,
    ),
    ne(
      "tooltip_icon_탈출순간부스터",
      "UseExtendedAfterBooster",
      (a) => a.useExtendedAfterBoosterMore === 1,
    ),
  ],
  Ri = Es.flatMap((a) => [a.icon, a.focusedIcon]);
function Fi(a) {
  return Es.filter((e) => e.visible(a)).map(({ visible: e, ...t }) => t);
}
const Ve = "stage_/garageX/",
  Ze = "mqParts12Card:unique5_x";
function bt(a) {
  const e = a.rects.get("kartSelector");
  if (!e) throw new Error("P3543 车库布局缺少 kartSelector。");
  const t = a.kartCardLayout;
  return {
    x: e.x + t.contentAdjustX,
    y: e.y + t.contentAdjustY,
    width: t.pageSize * t.width + (t.pageSize - 1) * t.gapX,
    height: t.height,
  };
}
function Gi(a, e) {
  const t = bt(a),
    s = a.kartCardLayout;
  return {
    x: t.x + e * (s.width + s.gapX),
    y: t.y,
    width: s.width,
    height: s.height,
  };
}
function Qe(a) {
  const e = (a ?? "").trim().split(/\s+/).map(Number);
  return [Number.isFinite(e[0]) ? e[0] : 0, Number.isFinite(e[1]) ? e[1] : 0];
}
function qt(a, e, t) {
  const [, , s, i] = (y(a, "leftTopWH") ?? y(a, "windowRect") ?? "0 0 0 0")
      .split(/\s+/)
      .map(Number),
    n = a.children.find((g) => y(g, "name") === "shopItemContainer"),
    r = a.children.find((g) => y(g, "name") === "itemNameLabel"),
    [o, c] = Qe(y(n, "windowSize")),
    [l, h] = Qe(y(n, "adjust")),
    [d, f, p, u] = (y(r, "leftTopWH") ?? "0 0 0 0").split(/\s+/).map(Number);
  return {
    width: s,
    height: i,
    iconWidth: o,
    iconHeight: c,
    iconAdjustX: l,
    iconAdjustY: h,
    stepX: s + e,
    stepY: i + t,
    titleRect: { x: d, y: f, width: p, height: u },
    texture: y(a, "texture") ?? "",
  };
}
function xt(a, e) {
  return a.partCardLayouts.get(e === "xun" ? "xun" : "classic");
}
function Dt(a, e) {
  const t = a.rects.get("partsSelect");
  if (!t) throw new Error("车库部件列表布局节点缺失。");
  const s = xt(a, e);
  return {
    x: t.x,
    y: t.y,
    width: s.width * a.partGridLayout.columns,
    height: s.stepY * a.partGridLayout.rows,
  };
}
function Bi(a, e, t, s) { return collectGarageParts(a, e, t, s, { slots: de, attribute: L, defaultParts: gs, xunPartValue: Bs }); }
function qi(a, e, t) { return sortGarageParts(a, e, t); }
const Ot = new WeakMap(),
  Di = "gui_/font/SourceHanSansCN-Bold.otf",
  Oi = "gui_font.rho",
  zt = "P3528 Source Han Sans CN Garage";
function zi(a, e = 1600) {
  let t = Ot.get(a);
  t || ((t = new Map()), Ot.set(a, t));
  let s = t.get(e);
  return (
    s ||
      ((s = Ui(a, e)),
      t.set(e, s),
      s.catch(() => {
        t.get(e) === s && t.delete(e);
      })),
    s
  );
}
async function Ui(a, e) {
  const t = _t(e),
    s = (I) => {
      const z = a.exactCanonicalCandidates(I);
      if (z.length !== 1) throw new Error(`车库资源缺失或不唯一：${I}`);
      return z[0];
    },
    i = (I) => {
      const z = a.exactCanonicalCandidates(I);
      if (z.length > 1) throw new Error(`车库资源重复：${I}`);
      return z[0];
    },
    [n, r, o, c, l, h, d, f, p, u, g, m] = await Promise.all([
      s(`${Ve}stage_${t.width}.bml`).bytes().then(j),
      s(`${Ve}stage_stringBag.bml`).bytes().then(j),
      s("etc_/baseStringBag.xml").bytes().then(Z),
      s("etc_/itemTable.kml").bytes().then(Z),
      s("etc_/itemTable@cn.xml").bytes().then(Z),
      s("zeta_/cn/shop/data/item.kml").bytes().then(Z),
      i("zeta_/cn/enchant/enchantMaterials.xml")?.bytes().then(Z),
      s("gui_/windowTemplate/itemPanels.bml").bytes().then(j),
      s("gui_/windowTemplate/garageXKartCard.bml").bytes().then(j),
      s("gui_/windowTemplate/mqPartsCard.bml").bytes().then(j),
      s("gui_/windowTemplate/mqParts12Card.bml").bytes().then(j),
      s("gui_/monocoque/frame.bml").bytes().then(j),
    ]),
    b = (I, z) =>
      y(I, "name") === z ? I : I.children.map((X) => b(X, z)).find(Boolean),
    P = b(n, "kartSelector");
  if (!P) throw new Error("P3543 车库布局缺少 kartSelector。");
  const [, , C, S] = (y(p, "windowRect") ?? "0 0 0 0").split(/\s+/).map(Number),
    [w] = Qe(y(P, "alignMargin")),
    k = Number(y(P, "alignSize")),
    x = f.children.find((I) => I.name === "Kart" && y(I, "name") === "default");
  if (!x) throw new Error("P3543 ItemPanel 布局缺少 Kart/default。");
  const T = {
      width: C,
      height: S,
      gapX: w,
      pageSize: k,
      contentAdjustX: 3,
      contentAdjustY: 4,
      kartZoom: Number(y(x, "zoom")),
      texture: y(p, "texture") ?? "",
      selectedTexture: y(p, "selectedTexture") ?? "",
    },
    v = b(n, "partList");
  if (!v) throw new Error("P3543 车库布局缺少 partList。");
  const [_, $] = Qe(y(v, "alignMargin")),
    N = { columns: Number(y(v, "alignSize")), rows: Number(y(v, "maxLine")) };
  if (
    !Number.isInteger(N.columns) ||
    N.columns < 1 ||
    !Number.isInteger(N.rows) ||
    N.rows < 1
  )
    throw new Error("P3543 车库 partList 网格尺寸无效。");
  const A = new Map([
      ["classic", qt(u, _, $)],
      ["xun", qt(g, _, $)],
    ]),
    E = b(n, "partListBar");
  if (!E) throw new Error("P3543 车库布局缺少 partListBar。");
  const M = Ms(E, m),
    G = new Map(),
    F = await Rs(a, await Fs(a)),
    B = await Gs(a),
    O = new Map();
  for (const I of de) {
    const z = `parts${I[0].toUpperCase()}${I.slice(1)}12`;
    for (const X of c.root.children.filter((W) => W.name === z)) {
      const W = L(X, "name");
      W && O.set(`${I}:${L(X, "id")}`, `stuff2_/parts/${W}.1s`);
    }
  }
  for (const I of r.children) {
    const z = I.children.find((X) => y(X, "c") === "cn");
    z && G.set(y(I, "n"), y(z, "v") ?? "");
  }
  for (const I of o.root.children) {
    const z = L(I, "n"),
      X = I.children.find((W) => L(W, "c") === "cn");
    z && X && !G.has(z) && G.set(z, L(X, "v") ?? "");
  }
  const q = new Map(),
    V = new Map(),
    D = new Set([
      `garage_img_baseBG_${t.width}`,
      `garage_img_baseBG_2_${t.width}`,
      "garage_img_baseBG_list",
      "garage_img_baseBG_list_2",
      "garage_img_partsBG1_lock",
      "img_selectedKart_Normal",
      "garage_img_textCarType2",
      "garage_kartFuncSlotBg",
      "img_itemTooltopBoxBG",
      ...[1, 2, 3, 4, 5].map((I) => `unique${I}_x`),
      ...[1, 2, 3, 4].flatMap((I) => [
        `garage_btn_menuTab1_${I}`,
        `garage_btn_equip_${I}`,
        `garage_btn_preview_${I}`,
        `garage_btn_partsTab_${I}`,
        `garage_btn_partsDelete_${I}`,
        `garage_btn_partsDelete_2_${I}@zz`,
        `buttonRed_${I}`,
        `garage_btn_arrowLeft_${I}`,
        `garage_btn_arrowRight_${I}`,
        `garage_btn_listTab_${I}`,
      ]),
      M.areaFrame.texture,
      ...M.buttonFrames.map((I) => I.texture),
      ...[0, 1, 2, 3, 4, 5].flatMap((I) => [
        `uniqueLevel_${I}`,
        `uniqueLevel_${I}_50x50`,
      ]),
      "turning_enhancedBG",
      ...[1, 2, 3, 4, 5].flatMap((I) => [`tuning_mark_s_${I}`]),
    ]);
  Ri.forEach((I) => D.add(I));
  for (let I = 1; I <= 5; I++) D.add(se("garage_check_0", I));
  (D.add(Ze), D.add(T.texture), D.add(T.selectedTexture));
  const $e = new Set([
      "backGround_1920",
      "backGround_12",
      "kartPreview",
      "karts",
      "kartSelector",
      "kartKeyword",
      "directionArrows",
      "resetKeyword",
      "partsListBoard",
      "menuTab",
      "selectedKartName",
      "selectedKartType",
      "textPerformList",
      "textPerformList_12",
      "equipedParts",
      "equipedParts_12",
      "partsReinforceGrp",
    ]),
    Be = new Set([
      "partsDisassemble",
      "partsComposite",
      "growthAlert",
      "growthLock",
    ]),
    Te = (I, z = !1) => {
      const X = y(I, "name") ?? "";
      if (!(Be.has(X) || (y(I, "frame") && y(I, "frame") !== "NoFrame"))) {
        if (((z ||= $e.has(X)), z)) {
          for (const J of ["image", "texture"]) {
            const Le = y(I, J);
            Le && D.add(Le);
          }
          const W = y(I, "autoLoadImage");
          if (W) for (let J = 1; J <= 4; J++) D.add(se(W, J));
          const ke = y(I, "autoImage");
          if (ke) for (let J = 1; J <= 5; J++) D.add(se(ke, J));
        }
        I.children.forEach((W) => Te(W, z));
      }
    };
  Te(n);
  const At = Bi(c.root, h.root, d?.root, l.root);
  for (const I of At) D.add(Ss(I));
  for (const I of F) I.icon && D.add(`parts:${I.icon.slice(14, -4)}`);
  for (const I of B) I.icon && D.add(`parts:${I.icon.slice(14, -4)}`);
  (D.add("parts:partsTailLamp_0"), D.add("parts:partsTailLamp12_0"));
  let ge;
  try {
    const I = a
      .canonicalCandidates(Di)
      .find((R) => R.sourceName.toLowerCase() === Oi);
    I && typeof FontFace < "u" && (ge = await St(zt, await I.bytes()));
    const X = (
      await Promise.allSettled(
        [...D].map(async (R) => {
          const _e = R.replace(/@zz$/, "@cn"),
            qe = R === T.texture || R === T.selectedTexture,
            Ne = R === "turning_enhancedBG" || /^tuning_mark_s_[1-5]$/.test(R),
            De = (
              R === Ze
                ? ["gui_/windowTemplate/unique5_x.png"]
                : R.startsWith("parts:")
                  ? [`stuff2_/parts/${R.slice(6)}.png`]
                  : R.startsWith("legacy:")
                    ? [`${R.slice(7)}.png`]
                    : qe || Ne
                      ? [
                          `gui_/windowTemplate/${_e}.png`,
                          `gui_/windowTemplate/${R}.png`,
                        ]
                      : [
                          `${Ve}${_e}.png`,
                          `${Ve}${R}.png`,
                          `stage_/common/${_e}.png`,
                          `stage_/common/${R}.png`,
                          `gui_/monocoque/${_e}.png`,
                          `gui_/monocoque/${R}.png`,
                        ]
            )
              .map((Ae) => a.exactCanonicalCandidates(Ae)[0])
              .find(Boolean);
          if (!De) return;
          const Oe = new Blob([await De.bytes()], { type: "image/png" });
          (q.set(R, await $t(await createImageBitmap(Oe))),
            V.set(R, URL.createObjectURL(Oe)));
        }),
      )
    ).find((R) => R.status === "rejected");
    if (X?.status === "rejected") throw X.reason;
    if (!q.has(`garage_img_baseBG_${t.width}`))
      throw new Error("P3543 车库背景缺失。");
    const W = new Map(),
      ke = new Map(),
      J = (R) => $e.has(y(R, "name") ?? "") || R.children.some(J),
      Le = (R, _e, qe, Ne = !1) => {
        const oe = y(R, "name");
        if (
          Be.has(oe ?? "") ||
          (y(R, "frame") && y(R, "frame") !== "NoFrame") ||
          (!Ne && !J(R))
        )
          return;
        Ne ||= $e.has(oe ?? "");
        const De =
            y(R, "image") ??
            y(R, "texture") ??
            se(y(R, "autoLoadImage") ?? "", 1),
          Oe =
            y(R, "frame") === "NoFrame"
              ? {
                  ...R,
                  attributes: R.attributes.filter((at) => at.name !== "frame"),
                }
              : R,
          Ae = Y(Oe, _e, void 0, q.get(De)),
          it = oe ? `${qe}/${oe}` : qe;
        (oe &&
          (W.set(it, Ae),
          ke.set(it, R),
          W.has(oe) || (W.set(oe, Ae), ke.set(oe, R))),
          R.children.forEach((at) => Le(at, Ae, it, Ne)));
      };
    return (
      Le(n, { x: 0, y: 0, width: t.width, height: t.height }, ""),
      {
        stage: t,
        definition: n,
        strings: G,
        textures: q,
        imageUrls: V,
        nodes: ke,
        rects: W,
        parts: At,
        partModels: O,
        cosmetics: F,
        coatings: B,
        kartCardLayout: T,
        partCardLayouts: A,
        partGridLayout: N,
        partScrollbar: M,
        fontFamily: ge ? zt : void 0,
        dispose: () => {
          (ge && (Ce(ge), (ge = void 0)),
            q.forEach((R) => R.close()),
            q.clear(),
            V.forEach((R) => URL.revokeObjectURL(R)),
            V.clear());
        },
      }
    );
  } catch (I) {
    throw (
      ge && Ce(ge),
      q.forEach((z) => z.close()),
      V.forEach((z) => URL.revokeObjectURL(z)),
      I
    );
  }
}
function se(a, e) {
  return a.endsWith("@zz") ? `${a.slice(0, -3)}${e}@zz` : `${a}${e}`;
}
function Ss(a) {
  return a.family === "legacy"
    ? `legacy:${a.legacyImagePath ?? `missing/${a.legacyCategory ?? Ni(a.slot)}/${a.itemId}`}`
    : `parts:parts${a.slot[0].toUpperCase() + a.slot.slice(1)}${a.family === "xun" ? "12_" : `_${a.itemId}`}${a.grade}`;
}
const Ki = {
    kind: "classic",
    backgroundTexture: "garage_img_baseBG_1600",
    partsTab: "4_partsTab",
    equippedRoot: "equipedParts",
    performanceRoot: "textPerformList",
    slotSize: 44,
    cosmeticTabs: [],
  },
  Vi = {
    kind: "v1",
    backgroundTexture: "garage_img_baseBG_1600",
    partsTab: "6_partsTab",
    equippedRoot: "equipedParts",
    performanceRoot: "textPerformList",
    slotSize: 44,
    cosmeticTabs: [
      { node: "partsCoating", label: "车膜" },
      { node: "partsTailLamp", label: "车灯" },
    ],
  },
  Hi = {
    kind: "xun",
    backgroundTexture: "garage_img_baseBG_2_1600",
    partsTab: "7_partsTab",
    equippedRoot: "equipedParts_12",
    performanceRoot: "textPerformList_12",
    slotSize: 50,
    cosmeticTabs: [
      { node: "partsCoating12", label: "车膜" },
      { node: "partsTailLamp12", label: "车灯" },
      { node: "partsBoosterEffect12", label: "加速器特效" },
    ],
  };
function ue(a) {
  if (!(a === void 0 || !Number.isInteger(a))) {
    if (a >= 0 && a <= 7) return Ki;
    if (a === 8) return Vi;
    if (a === 9) return Hi;
  }
}
function pe(a) {
  if (!(a === void 0 || !Number.isInteger(a))) {
    if (a >= 0 && a <= 6) return "classic";
    if (a === 9) return "xun";
  }
}
function Ut(a) {
  return a === "classic" ? "classic" : a;
}
const ji = {
  engine: "defaultEngineType",
  handle: "defaultHandleType",
  wheel: "defaultWheelType",
  booster: "defaultBoosterType",
};
function Wi(a, e, t = "原装") {
  return { value: a ?? t, state: e ? "锁定" : "" };
}
function Xe(a, e, t, s, i, n, r) { return resolveEquippedGaragePart(a, e, t, s, i, n, r, me); }
function Kt(a, e) { return sameGaragePart(a, e); }
function Xi(a, e, t, s, i = 7) {
  if (!s) return te(a, e, t, i);
  if (s.family !== me(a, e) || fe(a, s.slot))
    throw new Error("当前车辆无法预览此部件。");
  return te(a, e, { ...t, [s.slot]: s }, i);
}
function Yi(a) {
  const e = new Set();
  let t = 0;
  const s = (i) => {
    if (!i || typeof i != "object" || ArrayBuffer.isView(i) || e.has(i)) return;
    e.add(i);
    const n = i,
      r = n.base;
    if (
      (n.kind === "prs" &&
        r &&
        typeof r.stopTimeWord == "number" &&
        typeof r.frequency == "number" &&
        r.frequency > 0 &&
        r.stopTimeWord > 0 &&
        (t = Math.max(t, r.stopTimeWord / r.frequency)),
      n.kind === "float-controller" &&
        r &&
        typeof r.frequency == "number" &&
        r.frequency > 0)
    ) {
      const o = n.keys;
      if (
        o &&
        [0, 1, 3].includes(o.type) &&
        o.records.every((c) => c.byteLength >= 8)
      ) {
        const c = (h) =>
          new DataView(
            o.records[h].buffer,
            o.records[h].byteOffset,
            o.records[h].byteLength,
          );
        let l = o.records.length - 1;
        for (; l > 0;) {
          const h = c(l - 1),
            d = c(l);
          if (
            h.getFloat32(4, !0) !== d.getFloat32(4, !0) ||
            (o.type === 0 &&
              (h.byteLength < 16 ||
                d.byteLength < 16 ||
                h.getFloat32(12, !0) !== 0 ||
                d.getFloat32(8, !0) !== 0))
          )
            break;
          l--;
        }
        l >= 0 && (t = Math.max(t, c(l).getUint32(0, !0) / r.frequency));
      }
    }
    Object.values(n).forEach(s);
  };
  return (s(a), t);
}
function Zi(a, e, t) {
  const s = (g) => {
      const m = (y(a, g) ?? "").trim().split(/\s+/).map(Number);
      if (m.length !== 3 || !m.every(Number.isFinite))
        throw new Error(`部件镜头缺少 ${g}`);
      return m.map(Math.fround);
    },
    [i, n, r] = s("defaultCameraPos"),
    [o, c, l] = s("defaultSpotPos"),
    h = Number(y(a, "zoom"));
  if (!(h > 0)) throw new Error("部件镜头 zoom 无效");
  const d = Number(y(a, "fov") ?? 75),
    f = Number(y(a, "nearPlane") ?? 1),
    p = Number(y(a, "farPlane") ?? 100);
  if (!(d > 0 && d / h < 180 && f > 0 && p > f))
    throw new Error("部件镜头投影参数无效");
  const u = new zs(us(d / h, e / t), e / t, f, p);
  return (u.position.set(i, r, -n), u.lookAt(o, l, -c), u);
}
async function Je(a, e, t, s) {
  const i = (g) => {
      const m = a.exactCanonicalCandidates(g);
      if (m.length !== 1) throw new Error(`部件模型资源缺失或不唯一：${g}`);
      return m[0];
    },
    n =
      e.panel ??
      (
        await i("gui_/windowTemplate/itemPanels.bml").bytes().then(j)
      ).children.find(
        (g) => g.name === "Parts12" && y(g, "name") === "default",
      );
  if (!n) throw new Error("P3543 缺少 Parts12 镜头定义");
  const r = Zi(n, 128, 128),
    o = Number(y(n, "zoom")),
    c = Number(y(n, "fov") ?? 75),
    l = qs(await i(e.path).bytes()),
    h = e.path.slice(0, e.path.lastIndexOf("/") + 1),
    d = await Ds(
      l,
      a,
      e.path,
      (g) => ({ status: "found", entry: i(`${h}${g.name}.png`) }),
      { environment: t, stageBinding: s, advanceEnvironment: !1 },
    ),
    f = new Os();
  (f.add(d.object), d.reset(performance.now()));
  let p;
  const u = Yi(l);
  return {
    scene: f,
    camera: r,
    durationMs: u,
    seek: (g) => {
      if (!Number.isFinite(g) || g < 0) throw new Error("动画时间无效");
      ((p === void 0 || g < p) && d.reset(1e3),
        (p = Math.min(g, Math.max(0, u - 0.001))));
    },
    update: (g, m) => {
      ((r.aspect = g / m),
        (r.fov = us(c / o, r.aspect)),
        r.updateProjectionMatrix(),
        d.update(p === void 0 ? performance.now() : 1e3 + p, r, g, m));
    },
    dispose: () => d.dispose(),
  };
}
const Qi = GarageModelCache;
const Ji = new Map([
  ["Unique", 4],
  ["Legend", 3],
  ["Rare", 5],
  ["Normal", 2],
  ["Special", 1],
  ["Ultimate", 6],
  ["Epic", 7],
]);
function ea(a) {
  const e = new Map();
  if (a.name !== "TuneAbility") return e;
  for (const t of a.children.filter((s) => s.name === "Tune")) {
    const s = Number(L(t, "groupId")),
      i = Number(L(t, "id"));
    if (!Number.isInteger(s) || s < 1 || !Number.isInteger(i) || i < 1)
      continue;
    const n = s * 100 + i;
    e.set(n, {
      id: n,
      groupId: s,
      level: i,
      title: L(t, "name") ?? "",
      description: (L(t, "desc") ?? "").replace(
        /\[\/?color(?::[^\]]+)?\]/g,
        "",
      ),
    });
  }
  return e;
}
function ta(a) {
  const e = new Map(),
    t = a.children.find((s) => s.name === "exceedTypeList");
  for (const s of t?.children.filter((i) => i.name === "exceedType") ?? []) {
    const i = Number(L(s, "id")),
      n = Number(L(s, "textureType")),
      r = Number(L(s, "exceedAccel")),
      o = Number(L(s, "exceedTime"));
    [i, n, r, o].every(Number.isInteger) &&
      i > 0 &&
      n > 0 &&
      r >= 1 &&
      r <= 3 &&
      o >= 1 &&
      o <= 3 &&
      e.set(i, { id: i, textureType: n, accelLevel: r, timeLevel: o });
  }
  return e;
}
function sa(a) {
  const e = ta(a),
    t = new Map(),
    s = a.children.find((n) => n.name === "exceedTypeChangeFee");
  for (const n of s?.children ?? []) {
    const r = Ji.get(n.name),
      o = Number(L(n, "ethisSpanner")),
      c = Number(L(n, "lucci")),
      l = new Set(
        (L(n, "ingredientEnableGrade") ?? "")
          .split(",")
          .map(Number)
          .filter((h) => Number.isInteger(h) && h > 0),
      );
    r !== void 0 &&
      Number.isInteger(o) &&
      o >= 0 &&
      Number.isInteger(c) &&
      c >= 0 &&
      l.size > 0 &&
      t.set(r, {
        quality: r,
        wrenchCount: o,
        lucci: c,
        ingredientQualities: l,
      });
  }
  const i = (n) =>
    new Set(
      a.children
        .find((r) => r.name === n)
        ?.children.map((r) => Number(L(r, "id")))
        .filter((r) => Number.isInteger(r) && r > 0) ?? [],
    );
  return {
    types: e,
    fees: t,
    changeOnlyKarts: i("exceedTypeChangeOnly"),
    excludedIngredients: i("notUseAsExceedTypeChange"),
    unableTargets: i("unableExceedTypeChange"),
  };
}
const Vt = [
    "tuning_performslot_speed",
    "tuning_pointTextBg",
    "tuning_pointTextBg_none",
    ...Array.from({ length: 6 }, (a, e) => `tuning_progressbar_0${e}`),
    ...Array.from({ length: 9 }, (a, e) => `tuningBoard_icon_${e + 1}`),
    ...Array.from({ length: 5 }, (a, e) => `tuning_mark_${e + 1}`),
    ...Array.from({ length: 10 }, (a, e) => `icon_exceedM_${e + 1}`),
    ...Array.from(
      { length: 3 },
      (a, e) => `tuning_exceedProgressbar_0${e + 1}`,
    ),
  ],
  Ht = [...Array.from({ length: 10 }, (a, e) => `icon_exceedB_${e + 1}`)],
  jt = new WeakMap();
function Wt(a, e = "kartune", t = 1600) {
  let s = jt.get(a);
  s || ((s = new Map()), jt.set(a, s));
  const i = `${e}:${t}`;
  let n = s.get(i);
  return (
    n ||
      ((n = ia(a, e, t)),
      s.set(i, n),
      n.catch(() => {
        s.get(i) === n && s.delete(i);
      })),
    n
  );
}
async function ia(a, e, t) {
  const s = _t(t),
    i = `stage_/${e}/`,
    n = async ($) => {
      const N = a.exactCanonicalCandidates($);
      if (N.length !== 1) throw new Error(`车辆升级资源缺失或不唯一：${$}`);
      return j(await N[0].bytes());
    },
    [r, o, c, l] = await Promise.all([
      n(`${i}stage_${s.width}.bml`),
      n(`${i}stage_stringBag.bml`),
      e === "tuning" ? n("gui_/windowTemplate/tuneItemCard.bml") : void 0,
      n("gui_/monocoque/frame.bml"),
    ]),
    h = new Map(),
    d = new Map();
  for (const $ of [
    "DefaultAlphaStaticButton",
    "TextButton",
    "ComboBox",
    "ComboList",
  ]) {
    const N = l.children.find((A) => A.name === $);
    for (const A of N?.children ?? []) d.set(`${$}/${A.name}`, ve(A));
  }
  const f = l.children.find(($) => $.name === "DefaultFocusedButton");
  if (!f && e === "tuning")
    throw new Error("改装页面缺少 DefaultFocusedButton 原版皮肤。");
  for (const $ of f?.children ?? []) h.set($.name, ve($));
  const p = new Map(),
    u = new Map();
  let g, m, b;
  if (e === "kartune") {
    const $ = a.exactCanonicalCandidates("zeta_/cn/enchant/desc.xml")[0],
      N = a.exactCanonicalCandidates("zeta_/cn/engine/exceedTypeChange.xml")[0];
    ($ && (g = ea(Z(await $.bytes()).root)),
      N && ((b = sa(Z(await N.bytes()).root)), (m = b.types)));
  }
  if (e === "tuning") {
    const $ = a.exactCanonicalCandidates("etc_/baseStringBag.xml")[0];
    if ($)
      for (const A of Z(await $.bytes()).root.children) {
        const E = A.children.find((M) => L(M, "c") === "cn");
        E && p.set(L(A, "n"), L(E, "v") ?? "");
      }
    const N = a.exactCanonicalCandidates("etc_/itemInfoColorByLevel.xml")[0];
    if (N) {
      const A = Z(await N.bytes()).root.children.find(
        (E) => L(E, "name") === "itemNameLabel",
      );
      for (const E of A?.children ?? [])
        u.set(
          Number(L(E, "grade")),
          `rgb(${L(E, "color").split(/\s+/).slice(1).join(",")})`,
        );
    }
  }
  for (const $ of o.children) {
    const N = $.children.find((A) => y(A, "c") === "cn");
    N && p.set(y($, "n"), y(N, "v") ?? "");
  }
  const P = new Map(),
    C = new Map();
  if (e === "tuning") {
    const N = (await n("gui_/windowTemplate/itemPanels.bml")).children.find(
      (A) => A.name === "Kart" && y(A, "name") === "default",
    );
    if (!N) throw new Error("改装页面缺少原版 Kart ItemPanel 配置。");
    C.set("factoryKartItemPanel", N);
  }
  const S = new Map(),
    w = new Map();
  let k, x;
  const T = new Set(["menuTab", "backGround_1920"]),
    v = new Set(),
    _ = ($) => {
      if (T.has(y($, "name") ?? "")) return;
      for (const A of ["texture", "image"]) {
        const E = y($, A);
        E && v.add(E);
      }
      const N = y($, "autoLoadImage");
      if (N) for (let A = 1; A <= 4; A++) v.add(se(N, A));
      $.children.forEach(_);
    };
  (_(r),
    h.forEach(($) => v.add($.texture)),
    d.forEach(($) => v.add($.texture)),
    c && _(c),
    e === "kartune" &&
      (Vt.forEach(($) => v.add($)), Ht.forEach(($) => v.add($))));
  try {
    if (e === "tuning") {
      const E = a.exactCanonicalCandidates(
        "gui_/font/SourceHanSansCN-Bold.otf",
      )[0];
      if (E) {
        const M = await E.bytes(),
          G = new DataView(M.buffer, M.byteOffset, M.byteLength);
        let F = 0,
          B = 0;
        for (let O = 0; O < G.getUint16(4); O++) {
          const q = 12 + O * 16,
            V = String.fromCharCode(...M.slice(q, q + 4)),
            D = G.getUint32(q + 8);
          (V === "head" && (F = G.getUint16(D + 18)),
            V === "hhea" &&
              (B = G.getInt16(D + 4) - G.getInt16(D + 6) + G.getInt16(D + 8)));
        }
        (F && B && (x = B / F), (k = await St("P3543 Factory", M)));
      }
    }
    const N = (
      await Promise.allSettled(
        [...v].map(async (E) => {
          const M = [E.replace(/@zz$/, "@cn"), E],
            G = [
              i,
              "stage_/common/",
              "stage_/garageX/",
              "gui_/windowTemplate/",
              "gui_/monocoque/",
              "dialog2_/exceedTypeChange/",
            ]
              .flatMap((B) => M.map((O) => `${B}${O}.png`))
              .map((B) => a.exactCanonicalCandidates(B)[0])
              .find(Boolean);
          if (!G) return;
          const F = new Blob([await G.bytes()], { type: "image/png" });
          (S.set(E, await createImageBitmap(F)),
            w.set(E, URL.createObjectURL(F)));
        }),
      )
    ).find((E) => E.status === "rejected");
    if (N?.status === "rejected") throw N.reason;
    if (e === "kartune" && Vt.some((E) => !S.has(E)))
      throw new Error("车辆升级技能图标或强化条缺失。");
    if (e === "kartune" && Ht.some((E) => !S.has(E)))
      throw new Error("超负荷类型图标资源缺失。");
    if (
      !S.has(
        e === "kartune"
          ? `garage_img_tuningBG_${s.width}`
          : `garage_img_floterBG_${s.width}`,
      )
    )
      throw new Error("车辆改装/升级背景缺失。");
    const A = (E, M, G) => {
      const F = y(E, "name");
      if (T.has(F ?? "") || E.name === "Dialog" || /Popup|Dialog/.test(F ?? ""))
        return;
      const B =
          y(E, "image") ??
          y(E, "texture") ??
          se(y(E, "autoLoadImage") ?? "", 1),
        O = Y(
          { ...E, attributes: E.attributes.filter((D) => D.name !== "frame") },
          M,
          void 0,
          S.get(B),
        ),
        q = F ? `${G}/${F}` : G;
      F && (P.set(q, O), C.set(q, E), P.has(F) || (P.set(F, O), C.set(F, E)));
      const V = y(E, "text");
      if (!F && V?.startsWith("#sb(")) {
        const D = `${G}/@text:${V}`;
        (P.set(D, O), C.set(D, E));
      }
      (!F &&
        y(E, "text") === "#sb(tuneState)" &&
        (P.set("tuneStateCaption", O), C.set("tuneStateCaption", E)),
        E.children.forEach((D) => A(D, O, q)));
    };
    return (
      A(r, { x: 0, y: 0, width: s.width, height: s.height }, ""),
      c && A(c, { x: 0, y: 0, width: 192, height: 114 }, "/factoryCard"),
      {
        stage: s,
        rects: P,
        nodes: C,
        images: S,
        urls: w,
        strings: p,
        actionFrames: h,
        windowFrames: d,
        qualityColors: u,
        enchantDescriptions: g,
        exceedTypes: m,
        exceedTypeChange: b,
        fontFamily: k ? "P3543 Factory" : void 0,
        fontLineScale: x,
        dispose: () => {
          (k && (Ce(k), (k = void 0)),
            S.forEach((E) => E.close()),
            S.clear(),
            w.forEach((E) => URL.revokeObjectURL(E)),
            w.clear());
        },
      }
    );
  } catch ($) {
    throw (
      k && Ce(k),
      S.forEach((N) => N.close()),
      w.forEach((N) => URL.revokeObjectURL(N)),
      $
    );
  }
}
const H = Math.fround,
  et = {
    DragFactor: "dragFactor",
    ForwardAccelForce: "forwardAccel",
    TransAccelFactor: "transAccelFactor",
    TeamBoosterTime: "teamBoosterTime",
    NormalBoosterTime: "normalBoosterTime",
    StartBoosterTimeSpeed: "startBoosterTimeSpeed",
    DriftMaxGauge: "driftMaxGauge",
    DriftEscapeForce: "driftEscapeForce",
    CornerDrawFactor: "cornerDrawFactor",
  },
  aa = [
    "DescEngineGrade",
    "DescBalance",
    "DescStability",
    "DescEnchantCap",
    "DescCornering",
  ],
  na = [
    "集气速度",
    "加速时间",
    "加速最高速度",
    "竞速",
    "弯道",
    "稳定性",
    "平衡",
    "强化力量",
  ],
  ra = new Set([
    "DriftEscapeForce",
    "TransAccelFactor",
    "NormalBoosterTime",
    "DriftMaxGauge",
  ]);
function ee(a) {
  const e = H(a);
  if (!Number.isFinite(e)) throw new Error("车辆雷达参数不是有效有限数值。");
  return e;
}
function ye(a, e, t) {
  const s = L(a, e);
  if (s === void 0 && t !== void 0) return t;
  if (s === void 0 || !s.trim()) throw new Error(`车辆雷达缺少 ${e}。`);
  return ee(Number(s));
}
function oa(a) {
  const e = Object.entries(et).map(([t, s]) => {
    const i = t === "StartBoosterTimeSpeed" ? ye(a, "StartBoosterTime", 0) : 0,
      n = ye(a, t, i);
    return [s, ra.has(t) && n === -1e5 ? 0 : n];
  });
  return Object.fromEntries([...e, ...aa.map((t) => [t, ye(a, t, 0)])]);
}
function ca(a) {
  if (a.name !== "weightConst") throw new Error("车辆雷达权重根节点无效。");
  const e = new Map();
  for (const t of Object.keys(et)) {
    const s = a.children.filter(
      (n) => n.name === "weight" && L(n, "name") === t,
    );
    if (s.length !== 1) throw new Error(`车辆雷达权重缺失或重复：${t}。`);
    const i = {
      enchantVariable: ye(s[0], "enchantVariable"),
      generalWeight: ye(s[0], "generalWeight"),
      enchantWeight: ye(s[0], "enchantWeight"),
      publicCutDown: ye(s[0], "publicCutDown"),
    };
    if (!i.enchantVariable) throw new Error(`车辆雷达权重分母为零：${t}。`);
    e.set(t, i);
  }
  return e;
}
function la(a, e, t) {
  const s = new Map(),
    i = new Map();
  for (const l of Object.keys(et)) {
    const h = t.get(l);
    if (!h || !h.enchantVariable || !Object.values(h).every(Number.isFinite))
      throw new Error(`车辆雷达权重无效：${l}。`);
    const d = et[l],
      f = ee(a[d]),
      p = ee(e[d]),
      u = Math.max(
        0,
        H(
          H(H(H(f - h.publicCutDown) / h.enchantVariable) * h.generalWeight) *
            ee(a.DescEngineGrade),
        ),
      ),
      g = H(
        H(H(H(p - f) / h.enchantVariable) * h.enchantWeight) *
          ee(e.DescEngineGrade),
      );
    (s.set(l, ee(u)), i.set(l, ee(Math.max(0, H(u + g)))));
  }
  const n = (l, h) => [
      l.get("DriftMaxGauge"),
      H(
        H(l.get("TeamBoosterTime") + l.get("NormalBoosterTime")) +
          l.get("StartBoosterTimeSpeed"),
      ),
      l.get("TransAccelFactor"),
      H(l.get("DragFactor") + l.get("ForwardAccelForce")),
      H(
        H(l.get("DriftEscapeForce") + l.get("CornerDrawFactor")) +
          ee(h.DescCornering),
      ),
      ee(h.DescStability),
      ee(h.DescBalance),
      ee(h.DescEnchantCap),
    ],
    r = (l) => H(H(H(Math.min(70, Math.max(20, l)) - 10) * 100) / 60),
    o = n(s, a),
    c = n(i, e);
  return na.map((l, h) => ({ label: l, base: r(o[h]), enhanced: r(c[h]) }));
}
function ha(a, e, t, s) {
  const i = Us(Ks({ ...e, ...a, defaultExceedType: 0 }, s, 7), t);
  return { ...a, ...i };
}
const Xt = new WeakMap(),
  lt = new WeakMap();
function da(a, e) {
  let t = Xt.get(a);
  t || ((t = new Map()), Xt.set(a, t));
  const s = t.get(e);
  if (s) return s;
  let i = lt.get(a);
  i ||
    ((i = (async () => {
      const r = a.exactCanonicalCandidates("zeta_/cn/enchant/weightConst.xml");
      if (r.length !== 1) throw new Error("车辆雷达权重资源缺失或不唯一。");
      return ca(Z(await r[0].bytes()).root);
    })()),
    lt.set(a, i),
    i.catch(() => lt.delete(a)));
  const n = Promise.all([ps(a, e), i]).then(([r, o]) => ({
    input: oa(r.value.body),
    weights: o,
  }));
  return (t.set(e, n), n.catch(() => t.delete(e)), n);
}
function Yt(a, e, t) {
  const s = Math.fround,
    i = s(
      s(s(s(6.283185005187988 / 24) * 3) * (e + 1)) - s(0.3926990032196045),
    ),
    n = s(Math.min(a.width, a.height) * s(0.4));
  return {
    x: a.x + a.width / 2 + s((s(s(Math.sin(i)) * n) * t) / 100),
    y: a.y + a.height / 2 + s((s(s(Math.cos(i)) * n) * t) / 100),
  };
}
function ga(a, e, t) {
  if (t.length !== 8) return;
  a.save();
  const s = (i, n, r) => {
    (a.beginPath(),
      i.forEach((o, c) => {
        const l = Yt(e, c, o);
        c ? a.lineTo(l.x, l.y) : a.moveTo(l.x, l.y);
      }),
      a.closePath(),
      (a.fillStyle = n),
      a.fill(),
      r && ((a.strokeStyle = r), (a.lineWidth = 1), a.stroke()));
  };
  for (let i = 5; i >= 1; i--)
    s(
      Array(8).fill(i * 20),
      i % 2 ? "#182a45" : "#1b355b",
      i === 5 ? "#667482" : void 0,
    );
  (s(
    t.map((i) => i.enhanced),
    "rgba(80,193,255,.45)",
    "#7dd8ff",
  ),
    s(
      t.map((i) => i.base),
      "#1499ed",
    ),
    (a.font = '15px "P3528 Source Han Sans CN Garage"'),
    (a.fillStyle = "white"),
    (a.shadowColor = "black"),
    (a.shadowBlur = 2),
    (a.textBaseline = "middle"),
    t.forEach((i, n) => {
      const r = Yt(e, n, 125),
        o = e.x + e.width / 2;
      ((a.textAlign = r.x < o ? "right" : "left"),
        i.label === "加速最高速度"
          ? (a.fillText("加速", r.x, r.y - 10),
            a.fillText("最高速度", r.x, r.y + 10))
          : a.fillText(i.label, r.x, r.y));
    }),
    a.restore());
}
const Ye = [2, 3, 4];
function ua(a, e = Math.random) {
  return a !== "random"
    ? a
    : Ye[Math.min(Ye.length - 1, Math.max(0, Math.floor(e() * Ye.length)))];
}
function $s(vehicle, restrictions) { return garageExceedChangeAvailability(vehicle, restrictions); }
const It = 15,
  pa = It - 2;
function st(a) {
  return { ...a, x: a.x + It };
}
function fa(a) {
  const e = st(a);
  return { ...e, x: e.x + 3 };
}
function ma(a, e) {
  const i = a.x + 8,
    n = st(e);
  return {
    x: i,
    y: a.y,
    width: Math.max(0, Math.min(a.width - 8, n.x - 8 - i)),
    height: a.height,
  };
}
function wa(a, e) {
  return { ...a, width: Math.max(a.width, e - a.x - 20) };
}
function ya(element, value) { return appendGarageNativeColorText(element, value); }
class va {
  constructor(assets, onChange, onSelectSkill, onExceedTypeChange = () => {}) { initializeGarageProgressionView(this, assets, onChange, onSelectSkill, onExceedTypeChange); }
  assets;
  onChange;
  onSelectSkill;
  onExceedTypeChange;
  element = document.createElement("div");
  classicContainer = document.createElement("div");
  engine12Container = document.createElement("div");
  activeContainer;
  radarRevision = 0;
  radar;
  framedControls = new Map();
  reset(layout) { return resetGarageProgressionPanel(this, layout); }
  get previewRect() { return garageProgressionPreviewRect(this); }
  rect(name) { return garageProgressionRect(this, name); }
  place(element, rect) { return placeGarageProgressionElement(this, element, rect); }
  styleFromNode(element, name) { return styleGarageProgressionFromNode(this, element, name, garageProgressionElementsDependencies); }
  label(text, rect, node) { return addGarageProgressionLabel(this, text, rect, node); }
  nativeLabel(name, fallback) { return addGarageProgressionNativeLabel(this, name, fallback, garageProgressionElementsDependencies); }
  texture(name, rect) { return addGarageProgressionTexture(this, name, rect); }
  button(name, title, action, disabled = false, offset = 0) { return addGarageProgressionButton(this, name, title, action, disabled, offset, garageProgressionElementsDependencies); }
  update(progression, hasVehicle, grade, factory, exceedType, vehicle, noAvailableVehicles = false) { return updateGarageProgressionPanel(this, progression, hasVehicle, grade, factory, exceedType, vehicle, noAvailableVehicles, garageProgressionPanelDependencies); }
  async updateRadar(library, kart, grade, progression, configuration) { return updateGarageProgressionRadar(this, library, kart, grade, progression, configuration, garageProgressionRadarDependencies); }
  dispose() { return disposeGarageProgressionPanel(this); }
  draw(context, grade) { return drawGarageProgressionView(this, context, grade, garageProgressionDrawDependencies); }
}
function he(a, e, t) {
  (a.classList.add("garage-skill-action", `garage-skill-action-${t}`),
    e &&
      ((a.style.fontSize = `${e.fontSize}px`),
      e.colors.forEach((s, i) =>
        a.style.setProperty(`--action-text-${i}`, s),
      )));
}
const ba = "立即重置当前车辆的粒子改记录？";
function ht(a) {
  return a.abilities.map((e) => js(e) ?? {});
}
function Zt(a) {
  return `${a.active ? 1 : 0}:${a.abilities.join(",")}`;
}
function xa(a) {
  let e = !1;
  return (
    a.addEventListener("pointerenter", () => {
      e = !a.disabled;
    }),
    a.addEventListener("pointerleave", () => {
      e = !1;
    }),
    a.addEventListener("pointercancel", () => {
      e = !1;
    }),
    () => e && !a.disabled
  );
}
function Ca(assets) { return garageFactoryCatalogLayout(assets, garageFactoryViewDependencies); }
class Pa {
  constructor(assets, onChange, onConfirm, onTabChange, onTutorial) { initializeGarageFactoryView(this, assets, onChange, onConfirm, onTabChange, onTutorial); }
  assets;
  onChange;
  onConfirm;
  onTabChange;
  onTutorial;
  element = document.createElement("div");
  model;
  modelReady = !1;
  catalog = !0;
  installed = !1;
  scoreLabel;
  emptyVehicleInfo = !1;
  selectedAbilityIndex = 0;
  pickerVehicleKey;
  draft;
  draftDirty = !1;
  appliedSignature;
  actionFrameRedraws = new Set();
  get showsCatalog() { return garageFactoryShowsCatalog(this); }
  get previewRect() { return garageFactoryPreviewRect(this); }
  get catalogLayout() { return garageFactoryCatalogLayout(this.assets, garageFactoryViewDependencies); }
  resizeCanvases() { return resizeGarageFactoryCanvases(this); }
  place(element, rect) { return placeGarageFactoryElement(this, element, rect); }
  label(text, rect, node) { return addGarageFactoryLabel(this, text, rect, node, garageFactoryViewDependencies); }
  updateScores(scores, title) { return updateGarageFactoryScoreLabel(this, scores, title); }
  update(configuration, supported, busy = false, vehicleName, vehicle, vehicleKey = vehicleName) { return updateGarageFactoryPanel(this, configuration, supported, busy, vehicleName, vehicle, vehicleKey, garageFactoryPanelDependencies); }
  renderAbilityPicker(configuration, editable, bounds) { return renderGarageFactoryAbilityPicker(this, configuration, editable, bounds, garageFactoryPickerDependencies); }
  updateDraftSlot(index, selection) { return updateGarageFactoryDraftSlot(this, index, selection); }
  commit(configuration) { return commitGarageFactoryChoice(this, configuration, garageFactoryPickerDependencies); }
  factoryChoiceButton(text, pressed, disabled, action) { return createGarageFactoryChoiceButton(this, text, pressed, disabled, action, garageFactoryPickerDependencies); }
  styleActionFrame(button) { return styleGarageFactoryActionFrame(this, button, garageFactoryCanvasDependencies); }
  draw(context) { return drawGarageFactoryBackground(this, context, garageFactoryCanvasDependencies); }
  drawCatalogFrame(context, index, selected, hover = false) { return drawGarageFactoryCatalogFrame(this, context, index, selected, hover); }
}
async function Ea(a, e) {
  const t = async (u) => {
      const g = a.exactCanonicalCandidates(u)[0];
      if (!g) throw new Error(`改装教程资源缺失：${u}`);
      return g.bytes();
    },
    [s, i, n, r] = await Promise.all(
      [
        "dialog/tutorial/tutorial.bml",
        "dialog/tutorial/plant/tutorial@cn.bml",
        "dialog/tutorial/tutorial_stringBag.bml",
        "gui_/monocoque/frame.bml",
      ].map(async (u) => j(await t(u))),
    ),
    o = new Map(
      n.children.map((u) => [
        y(u, "n"),
        y(u.children.find((g) => y(g, "c") === "cn") ?? u, "v") ?? "",
      ]),
    ),
    c = new Map();
  for (const u of r.children.filter((g) =>
    ["CaptionDialog", "DefaultFocusedButton"].includes(g.name),
  ))
    for (const g of u.children) c.set(`${u.name}/${g.name}`, ve(g));
  const l = new Map(
      r.children
        .filter(
          (u) =>
            ["CaptionDialog", "DefaultFocusedButton"].includes(u.name) &&
            u.children.length,
        )
        .map((u) => [u.name, ve(u.children[0])]),
    ),
    h = new Map();
  let d;
  const f = () => {
      d && (Ce(d), (d = void 0));
    },
    p = async (u) => {
      const g = await createImageBitmap(
          new Blob([await t(u)], { type: "image/png" }),
        ),
        m = await $t(g);
      return (h.set(u, m), m);
    };
  try {
    d = await ws(a);
    const u = await Promise.all(
        i.children.map(async (E) =>
          j(await t(`dialog/tutorial/template${y(E, "template")}.bml`)),
        ),
      ),
      m = (
        await Promise.allSettled(
          [
            ...new Set(
              i.children.map(
                (E) => `dialog/tutorial/plant/${y(E, "image")}.png`,
              ),
            ),
            ...new Set(
              [...l.values()]
                .filter((E) => E.texture)
                .map((E) => `gui_/monocoque/${E.texture}.png`),
            ),
          ].map(p),
        )
      ).find((E) => E.status === "rejected");
    if (m?.status === "rejected") throw m.reason;
    const b = document.createElement("div");
    (Object.assign(b.style, {
      position: "absolute",
      inset: "0",
      zIndex: "100",
      pointerEvents: "auto",
      background: "#0008",
    }),
      b.setAttribute("role", "dialog"),
      b.setAttribute("aria-modal", "true"),
      b.setAttribute("aria-label", o.get("title") || "改装教程"));
    const P = document.createElement("canvas");
    ((P.width = 1600),
      (P.height = 900),
      Object.assign(P.style, {
        position: "absolute",
        inset: "0",
        width: "1600px",
        height: "900px",
        pointerEvents: "none",
      }));
    const C = P.getContext("2d");
    if (!C) throw new Error("教程画布不可用。");
    const S = Ws(s, { x: 0, y: 0, width: 1600, height: 900 }, l),
      w = s.children.find((E) => y(E, "name") === "context"),
      k = s.children.find((E) => y(E, "name") === "buttonGroup"),
      x = document.activeElement;
    let T = 0,
      v = !1,
      _;
    const $ = () => {
        v ||
          ((v = !0),
          _ && window.removeEventListener("resize", _),
          b.remove(),
          h.forEach((E) => E.close()),
          f(),
          x instanceof HTMLElement && x.isConnected && x.focus());
      },
      N = k.children.map((E) => {
        const M = document.createElement("button"),
          G = S.get(E);
        ((M.type = "button"),
          (M.textContent =
            o.get(y(E, "text")?.match(/#sb\((.+)\)/)?.[1]) ?? ""),
          Object.assign(M.style, {
            position: "absolute",
            left: `${G.x}px`,
            top: `${G.y}px`,
            width: `${G.width}px`,
            height: `${G.height}px`,
            font: `16px "${yt}"`,
            background: "transparent",
            border: "0",
            padding: "0",
          }),
          (M.onclick = () => {
            const B = y(E, "name");
            B === "ok" ? $() : ((T += B === "prev" ? -1 : 1), A());
          }));
        const F = (B) => {
          const O = c.get(`${y(E, "frame")}/${M.disabled ? "Disabled" : B}`);
          O && be(C, O, h.get(`gui_/monocoque/${O.texture}.png`), G);
          const q =
              y(
                E,
                M.disabled
                  ? "disabledTextColor"
                  : B === "Clicked"
                    ? "clickedTextColor"
                    : B === "MouseOn"
                      ? "overTextColor"
                      : "textColor",
              ) ?? "white",
            V = q.split(/\s+/).map(Number);
          M.style.color = V.length === 4 ? `rgb(${V.slice(1).join(",")})` : q;
        };
        return (
          (M.onpointerenter = () => F("MouseOn")),
          (M.onpointerleave = () => F("Normal")),
          (M.onpointerdown = () => F("Clicked")),
          (M.onpointerup = () => F("MouseOn")),
          { n: E, button: M, paint: F }
        );
      }),
      A = () => {
        const E = P.getBoundingClientRect();
        (Pe(P, C, E.width, E.height, Ee(), 1600, 900),
          (C.imageSmoothingEnabled = !0),
          C.clearRect(0, 0, 1600, 900));
        const M = S.get(s),
          G = l.get(y(s, "frame"));
        (be(C, G, h.get(`gui_/monocoque/${G.texture}.png`), M),
          (C.fillStyle = y(s, "captionColor")),
          (C.font = `16px "${yt}"`),
          (C.textAlign = "center"),
          C.fillText(o.get("title") ?? "", M.x + M.width / 2, M.y + 22));
        const F = u[T],
          B = i.children[T],
          O = h.get(`dialog/tutorial/plant/${y(B, "image")}.png`),
          q = Y(F, S.get(w)),
          V = Y(F.children[0], q, void 0, void 0, {
            width: O.width,
            height: O.height,
          });
        C.drawImage(O, V.x, V.y, V.width, V.height);
        for (const { n: D, button: $e, paint: Be } of N) {
          $e.disabled =
            y(D, "name") === "prev"
              ? T === 0
              : y(D, "name") === "next"
                ? T === i.children.length - 1
                : !1;
          const Te = c.get(
            `${y(D, "frame")}/${$e.disabled ? "Disabled" : "Normal"}`,
          );
          (Te && be(C, Te, h.get(`gui_/monocoque/${Te.texture}.png`), S.get(D)),
            Be("Normal"));
        }
      };
    return (
      (b.onkeydown = (E) => {
        if (
          (E.stopPropagation(),
          E.key === "Escape" && (E.preventDefault(), $()),
          E.key === "Tab")
        ) {
          E.preventDefault();
          const M = N.map((F) => F.button).filter((F) => !F.disabled),
            G = M.indexOf(document.activeElement);
          M[(G + (E.shiftKey ? M.length - 1 : 1)) % M.length].focus();
        }
      }),
      b.append(P, ...N.map((E) => E.button)),
      e.append(b),
      (_ = () => A()),
      window.addEventListener("resize", _),
      A(),
      N[2].button.focus(),
      $
    );
  } catch (u) {
    throw (h.forEach((g) => g.close()), f(), u);
  }
}



const Jt = "dialog/kartLevelUp/";
function Ta(a) {
  return [
    `等级 Lv.${a.beforeLevel} → Lv.${a.afterLevel}`,
    `可用强化点 ${a.beforePoints} → ${a.afterPoints}`,
  ];
}
async function ka(a, e, t) {
  const s = (C) => {
      const S = a.exactCanonicalCandidates(`${Jt}${C}`);
      if (S.length !== 1) throw new Error(`经典升级资源缺失或不唯一：${C}`);
      return S[0];
    },
    n = j(await s("kartLevelUpResult@cn.bml").bytes()).children.find(
      (C) => y(C, "name") === "success",
    ),
    r = n?.children.find((C) => y(C, "name") === "main"),
    o = n?.children.find((C) => y(C, "name") === "preEffect"),
    c = n?.children.find((C) => y(C, "name") === "itemPanel"),
    l = r?.children.find((C) => y(C, "name") === "okButton");
  if (!n || !r || !o || !c || !l || !y(o, "scene"))
    throw new Error("经典升级结果页布局不完整。");
  const h = Y(n, { x: 0, y: 0, width: 1600, height: 900 }),
    d = { ...h, x: 0, y: 0 },
    f = Y(c, h),
    p = new Map(),
    u = new Set(),
    g = (C) => {
      const S = y(C, "image") ?? y(C, "texture");
      (S && u.add(S), C.children.forEach(g));
    };
  g(r);
  let m, b;
  const P = () => {
    (m?.dispose(),
      (m = void 0),
      p.forEach((C) => C.close()),
      p.clear(),
      b && (Ce(b), (b = void 0)));
  };
  try {
    b = await ws(a);
    const S = (
      await Promise.allSettled([
        Je(a, { path: `${Jt}${y(o, "scene")}.1s`, panel: o }, e, t).then(
          (x) => {
            m = x;
          },
        ),
        ...[...u].map(async (x) =>
          p.set(
            x,
            await createImageBitmap(
              new Blob([await s(`${x}.png`).bytes()], { type: "image/png" }),
            ),
          ),
        ),
      ])
    ).find((x) => x.status === "rejected");
    if (S?.status === "rejected") throw S.reason;
    if (!m || !(m.durationMs > 0 && m.durationMs < 6e4))
      throw new Error("经典升级动画时间轴无效。");
    const w = [],
      k = (x, T) => {
        const v = Y(x, T);
        (w.push({ node: x, rect: v }), x.children.forEach((_) => k(_, v)));
      };
    return (
      k(r, d),
      {
        panel: m,
        rect: h,
        preview: f,
        accept: Y(l, Y(r, h)),
        dispose: P,
        drawResult(x, T, v) {
          x.clearRect(0, 0, h.width, h.height);
          for (const { node: _, rect: $ } of w) {
            const N = y(_, "image") ?? y(_, "texture");
            if (N) {
              const G = p.get(N);
              if (y(_, "name") === "kartLevel") {
                const [F, B] = (y(_, "fontSize") ?? "32 40")
                  .split(/\s+/)
                  .map(Number);
                x.drawImage(
                  G,
                  v.afterLevel * F,
                  0,
                  F,
                  B,
                  $.x,
                  $.y,
                  $.width,
                  $.height,
                );
              } else x.drawImage(G, $.x, $.y, $.width, $.height);
            }
            const A = y(_, "name"),
              E = y(_, "text"),
              M =
                A === "kartName"
                  ? [T]
                  : A === "kartDesc"
                    ? Ta(v)
                    : E === "#sb(levelUpResult)"
                      ? ["升级结果"]
                      : [];
            M.length &&
              (x.save(),
              (x.fillStyle = "white"),
              (x.textAlign = "center"),
              (x.textBaseline = "middle"),
              (x.font = `${A === "kartDesc" ? 16 : 20}px "${yt}"`),
              M.forEach((G, F) =>
                x.fillText(
                  G,
                  $.x + $.width / 2,
                  $.y + $.height / 2 + (F - (M.length - 1) / 2) * 26,
                  $.width,
                ),
              ),
              x.restore());
          }
        },
      }
    );
  } catch (C) {
    throw (P(), C);
  }
}
const es = "dialog2_/kart12TuningLevelUp/",
  _a = ["preEffect", "successEffect", "successResult"],
  Ia = ["强化开始", "强化成功", "强化结果"];
function La(a) {
  return [
    {
      label: "性能槽数量",
      before: String(Math.min(a.beforeLevel, 3)),
      after: String(Math.min(a.afterLevel, 3)),
    },
    {
      label: "强化点数",
      before: String(a.beforePoints),
      after: String(a.afterPoints),
    },
  ];
}
function Na(a) {
  return !a;
}
function Aa(a, e) {
  if (
    a.length === 0 ||
    a.some((s) => !Number.isFinite(s) || s <= 0) ||
    !Number.isFinite(e)
  )
    throw new Error("升级动画时长无效。");
  let t = Math.max(0, e);
  for (let s = 0; s < a.length; s++) {
    if (t < a[s]) return { index: s, time: t, complete: !1 };
    if (s === a.length - 1) return { index: s, time: a[s], complete: !0 };
    t -= a[s];
  }
  throw new Error("升级动画阶段无效。");
}
async function Ma(a, e, t, s = !1) {
  const i = a.exactCanonicalCandidates(`${es}kart12TuningLevelUpResult@zz.bml`);
  if (i.length !== 1) throw new Error("迅升级结果页资源缺失或不唯一。");
  const r = j(await i[0].bytes()).children.find((h) => y(h, "name") === "1600");
  if (!r) throw new Error("迅升级结果页缺少 1600 布局。");
  const o = s ? ["successResult"] : _a,
    c = await Promise.allSettled(
      o.map(async (h) => {
        const d = r.children.find((p) => y(p, "name") === h);
        if (!d || !y(d, "scene")) throw new Error(`升级动画缺少 ${h}`);
        const f = await Je(
          a,
          { path: `${es}${y(d, "scene")}.1s`, panel: d },
          e,
          t,
        );
        if (!(f.durationMs > 0 && f.durationMs < 6e4))
          throw (f.dispose(), new Error(`升级动画时间轴无效：${h}`));
        return f;
      }),
    ),
    l = c.find((h) => h.status === "rejected");
  if (l?.status === "rejected")
    throw (
      c.forEach((h) => {
        h.status === "fulfilled" && h.value.dispose();
      }),
      l.reason
    );
  return c.map((h) => h.value);
}
class Ra {
  constructor(surface, library, environment, stage, title, onClose, kind, summary, resultOnly = false, badgeUrl) { initializeGarageUpgradeResult(this, surface, library, environment, stage, title, onClose, kind, summary, resultOnly, badgeUrl, garageUpgradeConstructionDependencies); }
  title;
  onClose;
  summary;
  resultOnly;
  element = document.createElement("div");
  context;
  label = document.createElement("div");
  accept = document.createElement("button");
  cancel = document.createElement("button");
  result = document.createElement("div");
  kartContext;
  canvasLogicalWidth = 1600;
  canvasLogicalHeight = 900;
  kartLogicalWidth = 250;
  kartLogicalHeight = 250;
  panels;
  epoch;
  disposed = !1;
  complete = !1;
  previousFocus;
  classic;
  capturePreview(panels, rect) { return captureGarageUpgradePreview(this, panels, rect, garageUpgradeRenderDependencies); }
  render(time, panels) { return renderGarageUpgradeResult(this, time, panels, garageUpgradeRenderDependencies); }
  close(confirmed) { return closeGarageUpgradeResult(this, confirmed); }
  dispose() { return disposeGarageUpgradeResult(this); }
}
const Fa = "dialog2_/kart12SkillTuning/",
  Ga = [
    "tuning_selectperformPopupBg_s",
    "tuning_selectperform_slotBg_s",
    "tuning_selectperform_slotBg_c",
    "tuning_selectperform_slotBg_c_effect",
    ...Array.from({ length: 9 }, (a, e) => `tuning_icon_${e + 1}`),
    ...Array.from({ length: 3 }, (a, e) => `tuning_selectperform_mark${e + 1}`),
    ...Array.from({ length: 3 }, (a, e) => `tuning_slotNum_0${e + 1}`),
    ...Array.from(
      { length: 3 },
      (a, e) => `tuning_selectperformPopup_tab_${e + 1}`,
    ),
    ...Array.from({ length: 4 }, (a, e) => `tuningPopup_x_${e + 1}`),
  ],
  He = new WeakMap();
function Ts(a) {
  let e = He.get(a);
  return (
    e ||
      ((e = Ba(a)),
      He.set(a, e),
      e.catch(() => {
        He.get(a) === e && He.delete(a);
      })),
    e
  );
}
async function Ba(a) {
  const e = (o) => {
      const c = a.exactCanonicalCandidates(`${Fa}${o}`);
      if (c.length !== 1) throw new Error(`技能选择资源缺失或不唯一：${o}`);
      return c[0];
    },
    [t, s] = await Promise.all(
      ["kart12SkillTuning@zz.bml", "speedSkillTuningCard.bml"].map(async (o) =>
        j(await e(o).bytes()),
      ),
    ),
    i = new Map(),
    n = new Map(),
    r = () => {
      (i.forEach((o) => URL.revokeObjectURL(o)), i.clear());
    };
  try {
    const c = (
      await Promise.allSettled(
        Ga.map(async (v) => {
          const _ = new Blob([await e(`${v}.png`).bytes()], {
              type: "image/png",
            }),
            $ = await createImageBitmap(_);
          try {
            (n.set(v, { width: $.width, height: $.height }),
              i.set(v, URL.createObjectURL(_)));
          } finally {
            $.close();
          }
        }),
      )
    ).find((v) => v.status === "rejected");
    if (c?.status === "rejected") throw c.reason;
    const l = new Map(),
      h = t.children.find((v) => y(v, "name") === "container");
    if (!h) throw new Error("技能窗口缺少 container。");
    const d = n.get("tuning_selectperformPopupBg_s"),
      f = (v, _, $) => {
        const N = y(v, "name") ?? v.name,
          A = `${$}/${N}`,
          E = Y(v, _);
        (l.set(A, E), v.children.forEach((M) => f(M, E, A)));
      };
    f(h, { x: 0, y: 0, ...d }, "");
    const p = (v) => {
        const _ = l.get(v);
        if (!_) throw new Error(`技能窗口缺少 ${v}`);
        return _;
      },
      u = new Map();
    for (let v = 1; v <= 9; v++) {
      const _ = p(
        `/container/skillTuning/speedPage/skillLine${Math.ceil(v / 3)}/${v}`,
      );
      u.set(v, { ..._, ...n.get("tuning_selectperform_slotBg_s") });
    }
    const g = (v) => {
        const _ = s.children.find(($) => y($, "name") === v);
        if (!_) throw new Error(`技能卡片缺少 ${v}`);
        return Y(_, { x: 0, y: 0, width: 0, height: 0 });
      },
      m = (v, _) => {
        if (y(v, "name") === _) return v;
        for (const $ of v.children) {
          const N = m($, _);
          if (N) return N;
        }
      },
      b = m(h, "skillTuningCaption");
    if (!b) throw new Error("技能窗口缺少标题样式。");
    const P = y(b, "textRender") ?? "bold20",
      C = Number(P.match(/\d+/)?.[0] ?? 20),
      S = y(b, "textColor") ?? "white",
      w = S.split(/\s+/).map(Number),
      k =
        S === "white"
          ? "#fff"
          : w.length === 4 && w.every(Number.isFinite)
            ? `rgba(${w[1]}, ${w[2]}, ${w[3]}, ${w[0] / 255})`
            : S,
      x = (v, _) => {
        if (!v) return _;
        if (v === "white" || v === "black") return v;
        const [$, N, A, E] = v.split(/\s+/).map(Number);
        return [$, N, A, E].every(Number.isFinite)
          ? `rgba(${N}, ${A}, ${E}, ${$ / 255})`
          : _;
      },
      T = new Map();
    for (const v of ["okButton", "cancelButton"]) {
      const _ = m(h, v);
      T.set(v, {
        fontSize: Number(
          (y(_, "textRender") ?? "bold16").match(/\d+/)?.[0] ?? 16,
        ),
        colors: [
          x(y(_, "textColor"), v === "okButton" ? "white" : "#404b5f"),
          x(y(_, "overTextColor"), v === "okButton" ? "white" : "#6a7893"),
          x(y(_, "clickedTextColor"), "#182b48"),
          x(y(_, "disabledTextColor"), "#838383"),
        ],
      });
    }
    for (const v of ["closeButton", "okButton", "cancelButton"])
      p(`/container/${v}`);
    for (const v of ["speedPage", "itemPage"])
      p(`/container/skillTuning/gameType/${v}`);
    return {
      rects: l,
      cards: u,
      cardIcon: g("skillIcon"),
      cardName: g("skillName"),
      cardTag: g("curSkillSlotTag"),
      headingStyle: {
        fontSize: C,
        color: k,
        align: y(b, "textAlign") ?? "center,vcenter",
      },
      actionStyles: T,
      urls: i,
      dispose: r,
    };
  } catch (o) {
    throw (r(), o);
  }
}
class qa extends GarageSkillSelectionState { constructor(progression, slot = 0) { super(progression, slot, garageSkillSelectionDependencies); } }
class Da extends GarageSkillSelectionDialog { constructor(surface, library, progression, row, onClose) { super(surface, library, progression, row, onClose, garageSkillDialogDependencies); } }
const Oa = "/backGround/engine12Data/tuningPanel/skillTuning";
function za(gauge, sprite, points) { return garageSkillEffectRect(gauge, sprite, points); }
function Ua(before, after) { return compareGarageSkillEffects(before, after); }
class Ka extends GaragePointEffects { constructor(surface, assets, load, onError) { super(surface, assets, load, onError, { attribute: (node, name) => y(node, name) }); } }
const ts = "dialog2_/kart12TuningLevelUp/",
  dt = "gui_/windowTemplate/",
  Va = [
    "tuning_upgradePopupBg",
    "tuning_arrow_g",
    "tuning_arrow_g_s",
    "icon_ethisChipset",
    "icon_lucci",
    ...[1, 2, 3, 4].map((a) => `tuninglevel_btnStart_${a}`),
  ],
  je = new WeakMap();
function Ha(a) {
  let e = je.get(a);
  return (
    e ||
      ((e = ja(a)),
      je.set(a, e),
      e.catch(() => {
        je.get(a) === e && je.delete(a);
      })),
    e
  );
}
async function ja(a) {
  const e = (v) => {
      const _ = a.exactCanonicalCandidates(v);
      if (_.length !== 1) throw new Error(`强化前窗口资源缺失或不唯一：${v}`);
      return _[0];
    },
    t = j(await e(`${ts}kart12TuningLevelUp@zz.bml`).bytes()),
    s = j(await e(`${dt}kart12TuningLevelUpCard.bml`).bytes()),
    i = t.children.find((v) => y(v, "name") === "kartLevelUp");
  if (!i) throw new Error("强化前窗口缺少 kartLevelUp。");
  const n = j(await e("gui_/monocoque/frame.bml").bytes()),
    r = n.children.find((v) => v.name === y(i, "frame"))?.children[0];
  if (!r) throw new Error("强化前窗口缺少 CaptionDialog。");
  const o = ve(r),
    c = n.children.find((v) => v.name === "BorderLineStaticButton");
  if (!c) throw new Error("强化车辆翻页按钮缺少 BorderLineStaticButton。");
  const l = new Map();
  for (const [v, _] of [
    ["Normal", "normal"],
    ["MouseOn", "hover"],
    ["Clicked", "clicked"],
    ["Disabled", "disabled"],
  ]) {
    const $ = c.children.find((A) => A.name === v);
    if (!$) throw new Error(`强化车辆翻页按钮缺少 ${v} 状态。`);
    const N = ve($);
    if (N.texture !== o.texture)
      throw new Error("强化车辆翻页按钮与窗口使用了不同图集，尚未装载。");
    l.set(_, N);
  }
  const h = Y(i, { x: 0, y: 0, width: 1600, height: 900 }, o),
    d = new Map(),
    f = [],
    p = [];
  let u;
  const g = (v, _) => {
    const $ =
        y(v, "name") === "kartSelector" && y(v, "windowSize") === "0 0 400 400"
          ? {
              ...v,
              attributes: v.attributes.map((q) =>
                q.name === "windowSize" ? { ...q, value: "0 0" } : q,
              ),
            }
          : v,
      N = y(v, "frame"),
      A = N && n.children.find((q) => q.name === N)?.children[0],
      E = A ? ve(A) : void 0,
      M = Y($, _, E),
      G = y(v, "text"),
      F =
        G === "#sb(tuningSlotNum)"
          ? "tuningSlotLabel"
          : G === "#sb(tuningPoint)"
            ? "tuningPointLabel"
            : G === "#sb(tuningTargetKart)" && !d.has("tuningTargetLabel")
              ? "tuningTargetLabel"
              : void 0,
      B = y(v, "name") ?? F ?? v.name;
    if (
      (B === "kartSelector" && (u = v),
      B === "preItemList" || B === "nextItemList")
    ) {
      const q = y(v, "arrowDir");
      if (q !== "left" && q !== "right")
        throw new Error(`${B} 缺少原生箭头方向。`);
      p.push({
        name: B,
        direction: q,
        color: We(y(v, "arrowColor"), `${B} arrowColor`),
        hoverColor: We(y(v, "overArrowColor"), `${B} overArrowColor`),
        clickedColor: We(y(v, "clickedArrowColor"), `${B} clickedArrowColor`),
        disabledColor: We(
          y(v, "disabledArrowColor"),
          `${B} disabledArrowColor`,
        ),
      });
    }
    const O = y(v, "texture");
    ((O === "icon_ethisChipset" || O === "icon_lucci") &&
      f.push({ token: O, rect: M }),
      d.set(B, M),
      v.children.forEach((q) => g(q, E ? Rt(E, M) : M)));
  };
  i.children.forEach((v) => g(v, Rt(o, h)));
  for (const v of [
    "ImageBoard",
    "tuningTargetLabel",
    "itemView",
    "curLevel",
    "nextLevel",
    "tuningSlotLabel",
    "curSlotNum",
    "nextSlotNum",
    "tuningPointLabel",
    "curTp",
    "nextTp",
    "kartList",
    "kartSelector",
    "levelUpStart",
  ])
    if (!d.has(v)) throw new Error(`强化前窗口缺少 ${v}。`);
  if (!u) throw new Error("强化前窗口缺少 kartSelector 定义。");
  if (p.length !== 2) throw new Error("强化车辆翻页箭头定义不完整。");
  const m = Wa(u, s),
    b = y(s, "texture"),
    P = s.children.find((v) => y(v, "name") === "selected"),
    C = P && y(P, "texture");
  if (!b || !C) throw new Error("强化车辆卡片缺少普通或选中贴图映射。");
  const S = new Map(),
    w = new Map();
  let k;
  const x = "P3543 Garage Upgrade",
    T = () => {
      (S.forEach((v) => v.close()),
        S.clear(),
        w.forEach((v) => URL.revokeObjectURL(v)),
        w.clear(),
        k && (Ce(k), (k = void 0)));
    };
  try {
    const v = a.exactCanonicalCandidates(
      "gui_/font/SourceHanSansCN-Bold.otf",
    )[0];
    v && typeof FontFace < "u" && (k = await St(x, await v.bytes()));
    const _ = [
        ...Va.map((A) => ({ token: A, path: `${ts}${A}.png` })),
        { token: "frame", path: `gui_/monocoque/${o.texture}.png` },
        { token: "cardNormal", path: `${dt}${b}.png` },
        { token: "cardSelected", path: `${dt}${C}.png` },
      ],
      N = (
        await Promise.allSettled(
          _.map(async ({ token: A, path: E }) => {
            const M = new Blob([await e(E).bytes()], { type: "image/png" });
            (S.set(A, await $t(await createImageBitmap(M))),
              w.set(A, URL.createObjectURL(M)));
          }),
        )
      ).find((A) => A.status === "rejected");
    if (N?.status === "rejected") throw N.reason;
    for (const A of ["cardNormal", "cardSelected"]) {
      const E = S.get(A);
      if (E.width !== m.width || E.height !== m.height)
        throw new Error(`强化车辆卡片 ${A} 尺寸与 BML 不一致。`);
    }
    return {
      frame: o,
      rect: h,
      rects: d,
      icons: f,
      cardLayout: m,
      pageArrows: p,
      pageButtonFrames: l,
      images: S,
      urls: w,
      font: k,
      fontFamily: k ? x : void 0,
      dispose: T,
    };
  } catch (v) {
    throw (T(), v);
  }
}
function We(a, e) {
  const t = a?.trim().split(/\s+/).map(Number) ?? [];
  if (t.length !== 4 || t.some((s) => !Number.isInteger(s) || s < 0 || s > 255))
    throw new Error(`${e} 无效。`);
  return t;
}
function Wa(a, e) {
  const [, , t, s] = gt(y(e, "windowRect"), 4, "车辆卡片 windowRect"),
    [i, n] = gt(y(a, "alignMargin"), 2, "kartSelector alignMargin"),
    [r, o] = gt(y(a, "clientMargin"), 4, "kartSelector clientMargin"),
    c = Number(y(a, "alignSize")),
    l = Number(y(a, "maxLine"));
  if (![t, s, c, l].every((h) => Number.isInteger(h) && h > 0))
    throw new Error("强化车辆卡片或网格尺寸无效。");
  return {
    width: t,
    height: s,
    columns: c,
    rows: l,
    horizontalMargin: i,
    verticalMargin: n,
    clientLeft: r,
    clientTop: o,
  };
}
function gt(a, e, t) {
  const s = a?.trim().split(/\s+/).map(Number) ?? [];
  if (s.length !== e || s.some((i) => !Number.isFinite(i)))
    throw new Error(`${t} 无效。`);
  return s;
}
const Xa = { x: 186, y: 526, width: 519, height: 210 };
function ss() { return preparationMethodPanelRect(); }
function Ya(context, rect) { return fillPreparationMethodPanel(context, rect); }
function Za(current, next) { return compareGarageUpgradeLevels(current, next); }
class Qa extends GarageUpgradePreparationState { constructor(candidates, selectedItemId) { super(candidates, selectedItemId, garageUpgradePreparationDependencies); } }
class Ja {
  constructor(surface, library, candidates, selectedItemId, onClose) { initializeGaragePreparation(this, surface, library, candidates, selectedItemId, onClose, garagePreparationConstructionDependencies); }
  onClose;
  element = document.createElement("div");
  controls = document.createElement("div");
  status = document.createElement("div");
  context;
  pageFrameObservers = [];
  pageFrameRedraws;
  assets;
  disposed = !1;
  previousFocus =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : void 0;
  state;
  get selected() { return selectedPreparationVehicle(this); }
  get previewRect() { return preparationPreviewRect(this); }
  get previewCard() { return preparationPreviewCard(this); }
  get cards() { return preparationCards(this); }
  place(element, rect) { return placePreparationControl(this, element, rect); }
  label(text, rectName, extraClass = '') { return addPreparationLabel(this, text, rectName, extraClass); }
  comparisonValue(rectName, value, increment = 0, extraClass = 'metric-value') { return addPreparationComparisonValue(this, rectName, value, increment, extraClass); }
  button(label, rect, action, disabled = false) { return createPreparationButton(this, label, rect, action, disabled); }
  decoratePageArrow(button, arrow, rect) { return decoratePreparationPageArrow(this, button, arrow, rect, garagePreparationRenderDependencies); }
  cancelButton() { return addPreparationCancelButton(this); }
  async load(library) { return loadGaragePreparation(this, library, value => Ha(value)); }
  refresh() { return refreshGaragePreparation(this, garagePreparationRenderDependencies); }
  draw(presenter) { return drawGaragePreparation(this, presenter, garagePreparationRenderDependencies); }
  resizeCanvases() { return resizePreparationCanvases(this); }
  close(accept) { return closeGaragePreparation(this, accept); }
  dispose() { return disposeGaragePreparation(this); }
  clearPageFrameResources() { return clearPreparationPageFrames(this); }
}
function en(context, presenter, cards, selectedId, normal, selected) { return drawPreparationCards(context, presenter, cards, selectedId, normal, selected); }
const Ct = {
    TransAccelFactor: "transAccelFactor",
    DriftEscapeForce: "driftEscapeForce",
    NormalBoosterTime: "normalBoosterTime",
    DriftMaxGauge: "driftMaxGauge",
  },
  Pt = () => ({
    TransAccelFactor: 0,
    DriftEscapeForce: 0,
    NormalBoosterTime: 0,
    DriftMaxGauge: 0,
  });
function is(a) {
  if (a === void 0 || !a.trim() || !Number.isSafeInteger(Number(a)))
    throw new Error("迅技能评分数值无效。");
  return Number(a);
}
function tn(a, e) {
  if (a.name !== "kart12TuningData" || e.name !== "TuneAbilityList")
    throw new Error("迅技能评分资源根节点无效。");
  const t = a.children.filter((i) => i.name === "tuningSkillSet");
  if (t.length !== 1) throw new Error("迅技能组缺失或重复。");
  const s = new Map();
  for (let i = 1; i <= 9; i++) {
    const n = t[0].children.filter(
      (l) => l.name === "Skill" && L(l, "idx") === String(i),
    );
    if (n.length !== 1) throw new Error(`迅技能 ${i} 缺失或重复。`);
    const r = is(L(n[0], "tuneGroupId")),
      o = e.children.filter(
        (l) => l.name === "TuneGroup" && L(l, "id") === String(r),
      );
    if (o.length !== 1) throw new Error(`迅技能效果组 ${r} 缺失或重复。`);
    const c = [Pt()];
    for (let l = 1; l <= 5; l++) {
      const h = o[0].children.filter(
        (f) => f.name === "Tune" && L(f, "id") === String(l),
      );
      if (h.length !== 1) throw new Error(`迅技能 ${i}/${l} 缺失或重复。`);
      const d = { ...Pt() };
      for (const f of h[0].children) {
        if (f.name !== "EnchanterAddSpec")
          throw new Error("迅竞速技能评分遇到未支持的效果类型。");
        const p = f.children.filter((u) => u.name === "UiValue");
        if (p.length > 1) throw new Error("迅技能 UiValue 重复。");
        for (const u of Object.keys(Ct))
          if (
            ((d[u] += p[0] ? is(L(p[0], Ct[u]) ?? "0") : 0),
            !Number.isSafeInteger(d[u]))
          )
            throw new Error("迅技能评分溢出。");
      }
      c.push(d);
    }
    s.set(i, c);
  }
  return s;
}
function sn(a, e) {
  const t = { ...Pt() };
  if (!e) return t;
  kt(e);
  for (const s of e.skills) {
    if (s.points === 0) continue;
    const i = a?.get(s.id)?.[s.points];
    if (!i) throw new Error("迅技能评分资源尚未加载。");
    for (const n of Object.keys(Ct)) t[n] += i[n];
  }
  return t;
}
async function an(a) {
  const e = await Promise.all(
    [
      "zeta_/cn/engine/kart12TuningData.xml",
      "zeta_/cn/enchant/enchant.xml",
    ].map(async (t) => {
      const s = a.exactCanonicalCandidates(t);
      if (s.length !== 1) throw new Error(`迅技能评分资源缺失或不唯一：${t}。`);
      return Z(await s[0].bytes()).root;
    }),
  );
  return tn(e[0], e[1]);
}
const tt = {
    TransAccelFactor: "transAccelFactor",
    DriftEscapeForce: "driftEscapeForce",
    SteerConstraint: "steerConstraint",
    NormalBoosterTime: "normalBoosterTime",
    DriftMaxGauge: "driftMaxGauge",
  },
  ks = () => ({
    TransAccelFactor: 0,
    DriftEscapeForce: 0,
    SteerConstraint: 0,
    NormalBoosterTime: 0,
    DriftMaxGauge: 0,
  });
function nn(a) {
  if (a.name !== "TuneAbilityList") throw new Error("改装评分资源根节点无效。");
  const e = new Map();
  for (const { id: t } of ms) {
    const s = a.children.filter(
      (o) =>
        o.name === "TuneGroup" && L(o, "id") === String(Math.floor(t / 100)),
    );
    if (s.length !== 1) throw new Error(`改装评分组 ${t} 缺失或重复。`);
    const i = s[0].children.filter(
      (o) => o.name === "Tune" && L(o, "id") === String(t % 100),
    );
    if (i.length !== 1 || i[0].children.length !== 1)
      throw new Error(`改装评分效果 ${t} 缺失或重复。`);
    const n = i[0].children[0];
    if (
      n.name !== "EnchanterAddSpec" ||
      n.children.some((o) => o.name !== "UiValue")
    )
      throw new Error("改装评分遇到未核实的增强类型或展示投影。");
    const r = ks();
    for (const o of Object.keys(tt)) {
      const c = L(n, tt[o]) ?? "0",
        l = Math.fround(Number(c));
      if (!c.trim() || !Number.isFinite(l))
        throw new Error("改装评分属性值无效。");
      r[o] = l;
    }
    e.set(t, r);
  }
  return e;
}
function as(a, e, t, s = !1) {
  if (!t || (Tt(t), !t.active && !s)) return a;
  const i = ks();
  for (const r of t.abilities) {
    if (r === 0) continue;
    const o = e?.get(r);
    if (!o) throw new Error("改装评分资源尚未加载。");
    for (const c of Object.keys(tt)) i[c] = Math.fround(i[c] + o[c]);
  }
  const n = { ...a };
  for (const r of Object.keys(tt))
    if (
      n[r] !== void 0 &&
      ((n[r] = Math.fround(n[r] + i[r])), !Number.isFinite(n[r]))
    )
      throw new Error("改装评分属性溢出。");
  return n;
}
async function rn(a) {
  const e = "zeta_/cn/enchant/enchant.xml",
    t = a.exactCanonicalCandidates(e);
  if (t.length !== 1) throw new Error(`改装评分资源缺失或不唯一：${e}。`);
  return nn(Z(await t[0].bytes()).root);
}
const Se = [
    "TransAccelFactor",
    "DriftEscapeForce",
    "SteerConstraint",
    "NormalBoosterTime",
    "DriftMaxGauge",
  ],
  U = Math.fround,
  Lt = {
    "x-v1": [4, 1, 3, 2, 1],
    "xun-body": [3, 1, 2, 2, 1],
    "xun-parts": [3, 1, 2, 2, 1],
  };
function xe(a) {
  const e = U(a);
  if (!Number.isFinite(e)) throw new Error("车库评分包含非有限数值。");
  return e;
}
function re(a) {
  if (!a.trim()) throw new Error("车库评分数值为空。");
  return xe(Number(a));
}
function on(a) {
  return Object.fromEntries(
    Se.map((e) => {
      const t = L(a, e),
        s = t === void 0 ? void 0 : re(t);
      return [e, s === -1e5 ? void 0 : s];
    }),
  );
}
function ns(a, e) {
  if (a.name !== "partsConst") throw new Error("车库评分资源根节点无效。");
  const t = a.children.filter((n) => n.name === "weightConst");
  if (t.length !== 1) throw new Error("车库评分权重组缺失或重复。");
  const s =
      e === "x-v1" ? "weight" : e === "xun-body" ? "weightKart" : "weightParts",
    i = new Map();
  return (
    Se.forEach((n, r) => {
      const o = t[0].children.filter((l) => l.name === s && L(l, "name") === n);
      if (o.length !== 1) throw new Error(`车库评分权重缺失或重复：${n}。`);
      const c = (L(o[0], "value") ?? "").split(",").map(re);
      if (c.length !== Lt[e][r])
        throw new Error(`车库评分权重长度无效：${n}。`);
      if (n === "DriftEscapeForce" && c[0] === 0)
        throw new Error("车库评分分母为零。");
      i.set(n, { values: c, fallback: re(L(o[0], "default") ?? "0") });
    }),
    { kind: e, rows: i }
  );
}
function rs(a) {
  return U(Math.floor(U(a + (a < 0 ? -0.5 : 0.5))));
}
function _s(a, e, t) {
  const s = t.rows.get(a);
  if (!s) throw new Error(`车库评分权重缺失：${a}。`);
  const i = Se.indexOf(a);
  if (s.values.length !== Lt[t.kind][i])
    throw new Error(`车库评分权重长度无效：${a}。`);
  const n = s.values.map(xe),
    r = xe(e ?? s.fallback);
  let o;
  switch (a) {
    case "TransAccelFactor": {
      const c = t.kind === "x-v1" && r <= U(1.85) ? n[3] : n[2];
      o = rs(U(U(U(r - n[1]) * c) + n[0]));
      break;
    }
    case "DriftEscapeForce":
      o = U(r / n[0]);
      break;
    case "SteerConstraint":
      o = rs(
        t.kind === "x-v1"
          ? U(U(U(r - n[1]) * n[2]) + n[0])
          : U(U(r + n[0]) * n[1]),
      );
      break;
    case "NormalBoosterTime":
      o =
        t.kind === "x-v1"
          ? U(U(r - n[1]) + n[0])
          : U(U(r - U(-n[0])) - U(-n[1]));
      break;
    case "DriftMaxGauge":
      o = U(r * n[0]);
      break;
  }
  return xe(o);
}
function Nt(a) {
  if (!Number.isFinite(a) || a < -2147483648 || a >= 2147483648)
    throw new Error("车库评分整数转换溢出。");
  return Math.trunc(a) & 65535;
}
function ut(a, e) {
  if (e.kind === "xun-parts") throw new Error("车体评分不能使用部件权重。");
  return Object.fromEntries(
    Se.map((t) => [t, (Nt(_s(t, a[t], e)) << 16) >> 16]),
  );
}
function cn(a, e, t) {
  if (t.kind !== "x-v1") throw new Error("X/V1 部件反向换算不能使用迅权重。");
  const s = t.rows.get(a);
  if (!s || s.values.length !== Lt[t.kind][Se.indexOf(a)])
    throw new Error("部件评分权重无效。");
  const i = s.values.map(xe),
    n = xe(e);
  if (!Number.isInteger(n) || n < 0 || n > 65535)
    throw new Error("部件评分必须为有效整数。");
  const r = U(
    a === "TransAccelFactor" || a === "SteerConstraint"
      ? U(U(n - i[0]) / i[2]) + i[1]
      : a === "DriftEscapeForce"
        ? n * i[0]
        : U(n - i[0]) + i[1],
  );
  return xe(r);
}
function ln(a) {
  const e = a.children.filter((s) => s.name === "gradeSection");
  if (e.length !== 1) throw new Error("部件评分档位组缺失或重复。");
  const t = new Map();
  for (const s of e[0].children.filter((i) => i.name === "grade")) {
    const i = re(L(s, "engineGrade") ?? "");
    if (!Number.isInteger(i) || t.has(i))
      throw new Error("部件评分车代无效或重复。");
    const n = new Map();
    for (const r of Se.slice(0, 4)) {
      const o = s.children.filter(
        (l) => l.name === "section" && L(l, "param") === r,
      );
      if (o.length !== 1) throw new Error(`部件评分档位缺失或重复：${r}。`);
      const c = ["normal", "rare", "legend", "unique"].map((l) => {
        const h = o[0].children.filter((f) => f.name === l);
        if (h.length !== 1) throw new Error("部件品质档位缺失或重复。");
        const d = {
          min: re(L(h[0], "min") ?? ""),
          max: re(L(h[0], "max") ?? ""),
          unit: re(L(h[0], "unit") ?? ""),
        };
        if (
          !Object.values(d).every(Number.isInteger) ||
          d.min < 0 ||
          d.max > 65535 ||
          d.min > d.max ||
          d.unit <= 0 ||
          (d.max - d.min) / d.unit !== 9
        )
          throw new Error("部件评分档位范围无效。");
        return d;
      });
      n.set(r, c);
    }
    t.set(i, n);
  }
  return t;
}
function hn(a, e, t, s) {
  return (
    Number.isInteger(s) &&
    !!a
      .get(e)
      ?.get(t)
      ?.some((i) => s >= i.min && s <= i.max && (s - i.min) % i.unit === 0)
  );
}
function dn(a, e, t, s) {
  const i = a.get(e)?.get(t);
  if (!(!i || !Number.isInteger(s))) {
    for (let n = i.length - 1; n >= 0; n--) {
      const r = i[n];
      if (s >= r.min) return 4 - n;
    }
    return 4;
  }
}
const Is = new Map([
  [72, "TransAccelFactor"],
  [73, "SteerConstraint"],
  [74, "DriftEscapeForce"],
  [75, "NormalBoosterTime"],
]);
function gn(a, e) {
  if (e.kind !== "xun-parts") throw new Error("迅部件评分必须使用部件权重。");
  const t = a.children.filter((i) => i.name === "partsValue");
  if (t.length !== 1) throw new Error("迅部件数值组缺失或重复。");
  const s = new Set();
  return t[0].children
    .filter((i) => i.name === "parts")
    .map((i) => {
      const n = re(L(i, "partsCatId") ?? ""),
        r = re(L(i, "partsItemId") ?? ""),
        o = Is.get(n),
        c = `${n}:${r}`;
      if (!o || !Number.isInteger(r) || r < 0 || r > 65535 || s.has(c))
        throw new Error(`迅部件编号无效或重复：${c}。`);
      s.add(c);
      const l = Nt(_s(o, re(L(i, "value") ?? ""), e));
      return { category: n, itemId: r, field: o, score: l };
    });
}
function un(a, e, t = {}) {
  const s = { ...a };
  for (const i of Se) {
    const n = e.filter((c) => c.field === i);
    if (n.length > 1 || n.some((c) => Is.get(c.category) !== i))
      throw new Error("迅部件评分槽位重复或不匹配。");
    const r = i === "SteerConstraint" ? 0 : (t[i] ?? 0),
      o = [a[i], n[0]?.score ?? 0, r];
    if (!o.every(Number.isSafeInteger))
      throw new Error("迅组合评分必须为有效整数。");
    s[i] = Nt(o.reduce((c, l) => c + l, 0));
  }
  return s;
}
const os = new WeakMap();
async function cs(a, e, t) {
  let s = os.get(a);
  s || ((s = new Map()), os.set(a, s));
  let i = s.get(t);
  i ||
    ((i = (async () => {
      const o = a.exactCanonicalCandidates(
        `zeta_/cn/${t === "x-v1" ? "parts" : "engine"}/partsConst.xml`,
      );
      if (o.length !== 1) throw new Error("车库评分资源缺失或不唯一。");
      const c = Z(await o[0].bytes()).root;
      return {
        table: ns(c, t),
        parts: t === "x-v1" ? [] : gn(c, ns(c, "xun-parts")),
        grid: t === "x-v1" ? ln(c) : void 0,
        skills: t === "xun-body" ? await an(a) : void 0,
        factory: t === "x-v1" ? await rn(a) : void 0,
      };
    })()),
    s.set(t, i),
    i.catch(() => s.delete(t)));
  const [n, r] = await Promise.all([ps(a, e), i]);
  return { ...r, input: on(n.value.body) };
}
const pn = {
    engine: "TransAccelFactor",
    handle: "SteerConstraint",
    wheel: "DriftEscapeForce",
    booster: "NormalBoosterTime",
  },
  fn = { engine: 72, handle: 73, wheel: 74, booster: 75 },
  mn = {
    TransAccelFactor: "transAccelFactor",
    DriftEscapeForce: "driftEscapeForce",
    SteerConstraint: "steerConstraint",
    NormalBoosterTime: "normalBoosterTime",
    DriftMaxGauge: "driftMaxGauge",
  },
  ls = [
    ["加速度", "TransAccelFactor", "transAccelFactor"],
    ["弯道", "SteerConstraint", "cornerDrawFactor"],
    ["漂移", "DriftEscapeForce", "driftEscapeForce"],
    ["加速时间", "NormalBoosterTime", "normalBoosterTime"],
    ["集气速度", "DriftMaxGauge", "boosterGauge"],
  ];
function wn(a, e, t) {
  const s = (i) => `(${i - t >= 0 ? "+" : ""}${i - t})`;
  return {
    beforeValue: String(a),
    beforeDelta: s(a),
    afterValue: String(e),
    afterDelta: s(e),
    trend: e > a ? "increase" : "decrease",
  };
}
function yn(a, e) {
  const t = { ...a };
  for (const s of de) {
    const i = e[s];
    if (i?.family === "legacy")
      for (const [n, r] of Object.entries(mn)) {
        const o = i.legacySpec?.[r];
        o === void 0 ||
          !Number.isFinite(o) ||
          t[n] === void 0 ||
          (t[n] = Math.fround(t[n] + o));
      }
  }
  return t;
}
function Me(a, e, t, s, i, n) {
  const r = me(e, t),
    o = vt(e, t);
  if (!o || (a.table.kind === "xun-body") != (o === "xun"))
    throw new Error("评分资源与车辆代际不匹配。");
  if ((s.factory && Tt(s.factory), r))
    for (const h of de) {
      const d = s[h];
      if (
        d &&
        (Zs(d),
        !(r === "legacy" && d.family !== "legacy") &&
          (d.family !== r || d.slot !== h || fe(e, h)))
      )
        throw new Error("评分部件与车辆不兼容。");
    }
  if (r === "xun") {
    const h = de.flatMap((f) => {
        if (f === n) return [];
        const p = Xe(e, s, f, i, t);
        if (!p) return [];
        const u = a.parts.find(
          (g) => g.category === fn[f] && g.itemId === p.itemId,
        );
        if (!u) throw new Error("迅部件缺少原版评分数据。");
        return [u];
      }),
      d = sn(a.skills, s.progression?.kind === "xun" ? s.progression : void 0);
    return un(ut(a.input, a.table), h, d);
  }
  if (r === "legacy")
    return ut(as(yn(a.input, s), a.factory, s.factory), a.table);
  const c = { ...a.input };
  for (const h of de) {
    const d = s[h];
    if (!d || !r) continue;
    const f = pn[h];
    if (!a.grid) throw new Error("部件评分档位资源缺失。");
    const p = a.grid.has(t) ? t : ys(t);
    if (!hn(a.grid, p, f, d.value))
      throw new Error("部件评分不在原版允许档位中。");
    c[f] !== void 0 && (c[f] = cn(f, d.value, a.table));
  }
  const l = ut(as(c, a.factory, s.factory), a.table);
  return Object.fromEntries(Object.entries(l).map(([h, d]) => [h, d & 65535]));
}
class vn extends GarageInventoryScroll { constructor(viewport, hitTarget, snapStep) { super(viewport, hitTarget, snapStep, (...args) => Qs(...args)); } }
const bn = [
    "",
    "loGradeUnique",
    "loGradeLegend",
    "loGradeRare",
    "loGradeAverage",
  ],
  xn = {
    engine: "partsEngine12",
    handle: "partsHandle12",
    wheel: "partsWheel12",
    booster: "partsBooster12",
  },
  Cn = ["", "终极", "稀有", "高级", "普通"];
function Ge(a, e, t) {
  return a.get(e)?.trim() || t;
}
function pt(a, e, t) {
  const s = Ge(a, "partsEngine12", "引擎"),
    i = Ge(a, `engineGrade${e}`, t);
  return i.endsWith(s) ? i.slice(0, -s.length).trim() : i.trim();
}
function Ls(a, e) {
  if (a.family === "xun" || a.family === "legacy") return;
  const i = (e.length > 0 ? e : gs(a.family, a.slot))
    .filter(
      (n) => n.family === a.family && n.slot === a.slot && n.grade === a.grade,
    )
    .sort((n, r) => n.value - r.value || n.itemId - r.itemId)
    .findIndex((n) => n.value === a.value && n.itemId === a.itemId);
  return i < 0 ? void 0 : i + 1;
}
function Ns(a, e) {
  if (a.family !== "xun") return Ls(a, e);
  const s = e
    .filter(
      (i) => i.family === "xun" && i.slot === a.slot && i.grade === a.grade,
    )
    .sort((i, n) => i.value - n.value || i.itemId - n.itemId)
    .findIndex((i) => i.itemId === a.itemId && i.value === a.value);
  return s < 0 ? void 0 : s + 1;
}
function Pn(a, e) {
  if (a.family !== "xun") return !1;
  const t = e
    .filter(
      (s) => s.family === "xun" && s.slot === a.slot && s.grade === a.grade,
    )
    .sort((s, i) => s.value - i.value || s.itemId - i.itemId);
  return (
    t.length > 0 &&
    t[t.length - 1].itemId === a.itemId &&
    t[t.length - 1].value === a.value
  );
}
function En(a, e, t) {
  return t && Pn(a, e);
}
function ft(a, e) {
  const t = a >= 1 && a <= 3 ? a : 4;
  return Ge(e, bn[t], Cn[t]);
}
function Et(a) {
  const e = a.family === "legacy" ? a.legacyRarity : a.grade;
  return e !== void 0 && Number.isInteger(e) && e >= 1 && e <= 4 ? e : void 0;
}
function Sn(a, e) {
  const t = Et(a);
  return t === void 0 ? e : `unique${t}_x`;
}
function $n(a, e, t) {
  const s =
    a.family === "legacy"
      ? le(a.slot, a.family)
      : Ge(e, xn[a.slot], le(a.slot, a.family));
  if (a.family === "legacy")
    return a.legacyTitle?.trim() || `${le(a.slot, a.family)} ${a.itemId}`;
  if (a.builtIn) {
    const r =
        a.engineGrade === void 0 || a.engineGrade === 0 ? 0 : a.engineGrade + 4,
      o = pt(
        e,
        r,
        a.engineGrade === 8 ? "V1引擎" : a.engineGrade === 7 ? "X引擎" : "",
      ),
      c = ft(a.grade, e);
    return [o, c, Ge(e, "partsBasic", "基本"), s].filter(Boolean).join(" ");
  }
  if (a.family === "xun") {
    const r = ft(a.grade, e),
      o = Ns(a, t);
    return [pt(e, 13, "迅引擎"), r, s, o === void 0 ? "" : String(o)]
      .filter(Boolean)
      .join(" ");
  }
  const i = Ls(a, t),
    n = ft(a.grade, e);
  return [
    pt(e, a.family === "v1" ? 12 : 11, a.family === "v1" ? "V1引擎" : "X引擎"),
    n,
    s,
    String(i === void 0 ? a.value : i),
  ]
    .filter(Boolean)
    .join(" ");
}
class Tn extends GarageExceedTypeDialog { constructor(surface, assets, library, current, onClose) { super(surface, assets, library, current, onClose, garageExceedDialogDependencies); } }
const kn = 9,
  _n = { x: 70, y: 590, width: 100, height: 32 };
function In(a) {
  return `garage_img_textCarType${a === 1 ? 1 : 2}`;
}
function Ln(a, e) {
  return a === "factory"
    ? []
    : a === "level"
      ? e
        ? ["backGround_12", "textPerformList_12", "selectedKartType"]
        : ["selectedKartType"]
      : [
          "partsListBoard",
          e ? "textPerformList_12" : "textPerformList",
          "selectedKartType",
        ];
}
function Nn(a, e) {
  return a === "parts" ? e.backgroundTexture : void 0;
}
const hs = new WeakMap();
function An(a, e) {
  let t = hs.get(a);
  if (!t) {
    const n = [],
      r = (o) => {
        const c = y(o, "name");
        (c && n.push(c), o.children.forEach(r));
      };
    (r(a), (t = n), hs.set(a, t));
  }
  const s = t.indexOf("kartPreview");
  if (s < 0 || e.some((n) => !t.includes(n)))
    throw new Error("车库绘制窗口缺少原件顺序。");
  const i = [...e].sort((n, r) => t.indexOf(n) - t.indexOf(r));
  return {
    beforePreview: i.filter((n) => t.indexOf(n) < s),
    afterPreview: i.filter((n) => t.indexOf(n) > s),
  };
}
function ds(a, e) {
  return a === "parts" || (a === "level" && e === 9);
}
function mt(a, e = !1) {
  return !a && !e;
}
const wt = {
  engine: "tuneEnginePatch",
  handle: "tuneHandle",
  wheel: "tuneWheel",
  booster: "tuneSupportKit",
};
function Mn(a, e, t, s) {
  const i = () => {
      a.disabled || s(e);
    },
    n = () => {
      t() === e && s(void 0);
    };
  (a.addEventListener("pointerenter", i),
    a.addEventListener("focus", i),
    a.addEventListener("pointerleave", n),
    a.addEventListener("pointercancel", n),
    a.addEventListener("blur", n));
}
function Rn(a, e, t, s, i) {
  const n = s(e, t)?.closest(".garage-part-preview");
  return n && a.contains(n) ? i.get(n) : void 0;
}
class As {
  constructor(options, assets, tuning, previews) { return initializeGarageView(this, options, assets, tuning, previews, {
    validateKart: Ft, createDrawing: canvas => new Js(canvas),
    createModelCache: (load, onError) => new Qi(load, onError),
    loadModel: (library, path, environment, stageBinding) => Je(library, path, environment, stageBinding),
    bindInteractionAudio: ei, isHoverAudible: xi, isClickAudible: Ci,
    createProgressionPanel: (...args) => new va(...args),
    createPointEffects: (...args) => new Ka(...args),
    createControlCanvas: (...args) => new Pi(...args),
    createResizeObserver: callback => new ResizeObserver(callback), window,
  }); }
  options;
  assets;
  tuning;
  tutorialClose;
  tutorialLoading = !1;
  element = document.createElement("div");
  surface = document.createElement("div");
  canvas = document.createElement("canvas");
  context;
  drawing;
  renderPixelRatio = 1;
  controls = document.createElement("div");
  transformPreviewPartsRoot = document.createElement("div");
  cards = document.createElement("div");
  inventory = document.createElement("div");
  inventoryScrollHit = document.createElement("div");
  inventoryScroll = new vn(this.inventory, this.inventoryScrollHit, () => {
    const e = Number.parseFloat(
      this.inventory.style.getPropertyValue("--garage-part-row-step"),
    );
    return Number.isFinite(e) && e > 0 ? e : void 0;
  });
  info = document.createElement("div");
  scoreRevision = 0;
  factoryScoreRevision = 0;
  scoreSources = new Map();
  defaultPartGrades;
  status = document.createElement("div");
  pageLabel = document.createElement("span");
  kartName = document.createElement("h2");
  partTitle = document.createElement("div");
  slotControls = new Map();
  vehicleFunctions = document.createElement("div");
  vehicleInfoNodes = [];
  partsOnlyNodes = [];
  transformPreviewUiRestore = new Map();
  transformPreviewUiHidden = !1;
  interactionAudioCleanup;
  previewPart;
  previewParts = new WeakMap();
  inventoryPointer;
  inventoryHitTestFrame = 0;
  cancelPreview = this.button("取消预览", () => {
    const e = this.cosmeticPreview !== void 0;
    ((this.transformPreviewStartPending = !1),
      (this.coatingPreview = void 0),
      (this.cosmeticPreview = void 0),
      this.transformPreviewUiHidden || this.setPartPreview(void 0),
      e && this.panels?.setTransformPreview?.(!1),
      this.syncTransformPreviewUi(),
      this.syncCosmeticPreviewActions(),
      this.updatePerformance());
  });
  removePart = this.button("拆除部件", () => {
    this.coatingMode
      ? this.requestCoating(void 0)
      : this.cosmeticSlot
        ? this.requestCosmetic(void 0)
        : this.requestEquip(void 0);
  });
  confirmation;
  upgrade;
  preparation;
  skillSelection;
  exceedTypeChange;
  pointEffects;
  cosmeticSlot;
  cosmeticPreview;
  cosmeticBusy = !1;
  cosmeticResetToken;
  coatingMode = !1;
  coatingPreview;
  comparisons = [];
  modelCache;
  modelTargets = [];
  search = document.createElement("input");
  inputSurface = document.createElement("div");
  controlCanvas;
  releaseTaskbar;
  strengtheningSnapshot;
  frozenSnapshot;
  resize;
  onWindowResize = () => this.resizeSurface();
  panels;
  transformPreviewStartPending = !1;
  selected;
  configuration;
  slot = "engine";
  filter = 0;
  page = 0;
  shown = !1;
  disposed = !1;
  frozen = !1;
  raf = 0;
  drag;
  previews;
  visibleCards = [];
  previewRect;
  pageMode = "parts";
  upgradeCatalogEmpty = !1;
  progressionPanel;
  factoryPanel;
  factorySession;
  factorySessionVehicleKey;
  static async load(options) { return loadGarageView(options, garageLifecycleLoadDependencies); }
  show() { return showGarageView(this, garageLifecycleDependencies); }
  freeze() { return freezeGarageView(this, garageLifecycleDependencies); }
  unfreeze() { return unfreezeGarageView(this); }
  dispose() { return disposeGarageView(this, garageLifecycleDependencies); }
  resizeSurface() { return resizeGarageSurface(this, garageViewportDependencies); }
  place(element, rect) { return placeGarageControl(this, element, rect); }
  setPartsOnlyNodesMounted(mounted) { return setGaragePartsOnlyNodesMounted(this, mounted); }
  setVehicleInfoNodesMounted(mounted) { return setGarageVehicleInfoNodesMounted(this, mounted); }
  setUpgradeStatusMounted(mounted) { return setGarageUpgradeStatusMounted(this, mounted); }
  startTransformPreview(immediate = false) { return startGarageTransformPreview(this, immediate); }
  transformPreviewSessionActive() { return isGarageTransformPreviewSessionActive(this); }
  flushTransformPreviewStart() { return flushGarageTransformPreviewStart(this); }
  syncTransformPreviewUi() { return syncGarageTransformPreviewUi(this); }
  moveToTransformPreviewRoot(control) { return moveToGarageTransformPreviewRoot(this, control); }
  placeInTransformPreviewRoot(control, rect) { return placeInGarageTransformPreviewRoot(this, control, rect); }
  button(label, action) { return createGarageActionButton(this, label, action); }
  skin(button, imageBase, states = 4) { return skinGarageActionButton(this, button, imageBase, states); }
  nativeButton(name, fallback, action, override) { return createGarageNativeButton(this, name, fallback, action, override, { attribute: y }); }
  rect(name) { return garageViewRect(this, name); }
  icon(key, className) { return createGarageIcon(this, key, className); }
  partVisual(container, part, className, row) { return renderGaragePartVisual(this, container, part, className, row, { iconKey: Ss, cardLayout: xt }); }
  addModelTarget(container, source, className, row, fallback, dimensions) { return addGaragePartModelTarget(this, container, source, className, row, fallback, dimensions); }
  renderPartModels() { return renderGaragePartModels(this); }
  buildControls() { return buildGarageControls(this, { slots: de, slotLabels: ai, inventoryRect: Dt, removeButtonRect: _n, cardsRect: bt }); }
  requestRestoreDefaults() { return requestGarageRestoreDefaults(this, garageStateCommitDependencies); }
  updateVehicleInformation(vehicle, equipment, layout, refreshPerformance = true) { return updateGarageVehicleInformation(this, vehicle, equipment, layout, refreshPerformance, garageVehicleInformationDependencies); }
  updateVehicleHeading(level) { return updateGarageVehicleHeading(this, level); }
  updateVehicleFunctions(vehicle, layout) { return updateGarageVehicleFunctions(this, vehicle, layout, garageVehicleInformationDependencies); }
  updateCosmeticEquippedSlots(equipment, layout, interactive) { return updateGarageCosmeticEquippedSlots(this, equipment, layout, interactive, garageEquippedCosmeticsDependencies); }
  syncCosmeticPreviewActions() { return syncGarageCosmeticPreviewActions(this); }
  serial() { return garageSelectedKartSerial(this); }
  get speedVersion() { return garageSpeedVersion(this, garageViewActionDependencies); }
  base() { return garageBaseSpecification(this); }
  baseFor(kart) { return garageBaseForKart(this, kart, garageViewActionDependencies); }
  equip(part) { return equipGaragePart(this, part, garageEquipmentDependencies); }
  requestEquip(part) { return requestGaragePartEquip(this, part, garageEquipmentDependencies); }
  requestCosmetic(choice) { return requestGarageCosmetic(this, choice); }
  updateControls() { return updateGarageControls(this, garageControlsDependencies); }
  requestSkillSelection(slot) { return requestGarageSkillSelection(this, slot, garageUpgradeDialogDependencies); }
  requestExceedTypeChange() { return requestGarageExceedTypeChange(this, garageUpgradeDialogDependencies); }
  requestProgression(target, prepared = false, method = "step") { return requestGarageProgression(this, target, prepared, method, garageProgressionFlowDependencies); }
  hideUpgradeResultBackground() {}
  restoreUpgradeResultBackground() {}
  refreshUpgradeState() { return refreshGarageUpgradeState(this, garageStateCommitDependencies); }
  setProgression(progression, refreshControls = true) { return setGarageProgression(this, progression, refreshControls, garageStateCommitDependencies); }
  async setFactory(factory) { return setGarageFactory(this, factory, garageFactoryCommitDependencies); }
  selectPage(page) { return selectGaragePage(this, page, garageCatalogDependencies); }
  selectKart(vehicle) { return selectGarageKart(this, vehicle, Ft); }
  canSetProgression(progression) { return canSetGarageProgression(this, progression, garageCatalogDependencies); }
  updatePageVisibility() { return updateGaragePageVisibility(this, garagePageVisibilityDependencies); }
  selectSlot(slot) { return selectGaragePartSlot(this, slot); }
  cosmeticIcon(choice, className) { return garageCosmeticIcon(this, choice, className); }
  updateCoatingInventory() { return updateGarageCoatingInventory(this, garageCosmeticInventoryDependencies); }
  requestCoating(choice) { return requestGarageCoating(this, choice); }
  async equipCoating(choice) { return equipGarageCoating(this, choice, garageCosmeticDependencies); }
  updateCosmeticInventory() { return updateGarageCosmeticInventory(this, garageCosmeticInventoryDependencies); }
  async equipCosmetic(choice) { return equipGarageCosmetic(this, choice, garageCosmeticDependencies); }
  setPartPreview(part) { return setGaragePartPreview(this, part); }
  rehitTestInventoryPreview() { return rehitGarageInventoryPreview(this, garageViewActionDependencies); }
  async showFactoryTutorial() { return showGarageFactoryTutorial(this, garageViewActionDependencies); }
  updateFactoryScores() { return updateGarageFactoryScores(this, garageFactoryScoringDependencies); }
  factoryVehicleKey(vehicle) { return garageFactoryVehicleKey(this, vehicle); }
  canonicalFactoryVehicle(vehicle) { return canonicalGarageFactoryVehicle(this, vehicle); }
  serialFor(vehicle) { return garageKartSerialFor(this, vehicle); }
  updatePerformance() { return updateGaragePerformance(this, garagePerformanceDependencies); }
  renderScoreRows(rows, title) { return renderGarageScoreRows(this, rows, title, garagePerformanceDependencies); }
  partLabel(part) { return garagePartLabel(this, part, garageViewActionDependencies); }
  filteredKarts() { return filteredGarageKarts(this, garageCatalogDependencies); }
  nativeFactoryAllowed(vehicle = this.selected) { return garageFactoryAllowed(this, vehicle, garageCatalogDependencies); }
  requireCustomization() { return requireGarageCustomization(this, ae); }
  updateCards() { return updateGarageCards(this, garageCardDependencies); }
  publishCurrentState() { return publishGarageCurrentState(this, garageStateCommitDependencies); }
  renderStrengtheningOverlay(time) { return renderGarageStrengtheningOverlay(this, time, garageStrengtheningOverlayDependencies); }
  frame = () => renderGarageFrame(this, garageFrameRenderDependencies);
  captureStrengtheningStage() { return captureGarageStrengtheningStage(this); }
  captureStage() { return captureGarageStage(this); }
  finishCanvasFrame(frozen = false) { return finishGarageCanvasFrame(this, frozen); }
  paintTaskbar() { return paintGarageTaskbar(this); }
  authoredPointerY(event) { return garageAuthoredPointerY(this, event); }
  drawKartCatalogFrame(context, rect, selected, hovered = false) { return drawGarageKartCatalogFrame(this, context, rect, selected, hovered); }
  drawKartLevelBadge(context, kart, rect) { return drawGarageKartLevelBadge(this, context, kart, rect, garageFrameCanvasDependencies); }
  onKey = event => handleGarageEscapeKey(this, event);
  createTransformPreviewButton() { return createGarageTransformPreviewButton(this, garagePreviewInputDependencies); }
  activePreviewRect() { return activeGaragePreviewRect(this); }
  onDragStart = event => startGaragePreviewDrag(this, event);
  onDragMove = event => moveGaragePreviewDrag(this, event);
  onDragEnd = event => endGaragePreviewDrag(this, event);
  finishPreviewDrag(pointerId) { return finishGaragePreviewDrag(this, pointerId); }
}
async function Fn(a) {
  const e = new Map();
  return (
    await Promise.all(
      a.catalog.karts
        .filter((t) => t.itemId === 0)
        .map(async (t) => {
          const s = { itemId: t.itemId, systemKey: t.systemKey },
            i = await bi(a.library, t.path, t.systemKey);
          e.set(bs(s), xs(s, a.speed, i.parameter.value, a.version ?? vs));
        }),
    ),
    e
  );
}
export {
  _n as GARAGE_REMOVE_PART_BUTTON_RECT,
  As as GarageXView,
  Mn as bindGaragePartPreview,
  mt as garageEquipButtonVisible,
  In as garageKartTypeTexture,
  Rn as garagePartPreviewAtPoint,
  Nn as garageXPageBackgroundTexture,
  ds as garageXSharedVehicleInfoVisible,
  Ln as garageXStageNodes,
  An as garageXStagePaintOrder,
};
