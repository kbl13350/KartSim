import { collectGarageParts, parseLegacyGarageParts, resolveEquippedGaragePart, sameGaragePart, sortGarageParts } from "../ui/garage-parts-business.ts";
import { createGaragePartCamera, garagePartModelDuration, loadGaragePartModelScene } from "../ui/garage-part-model-scene.ts";
import { calculateGarageRadar, drawGarageRadar, garageRadarPoint } from "../ui/garage-radar-chart.ts";
import { loadGarageRadarParameters, parseGarageRadarInput, parseGarageRadarWeights } from "../ui/garage-radar-data.ts";
import { parseGarageExceedChangeRules, parseGarageExceedTypes, parseGarageTuneAbilities } from "../ui/garage-upgrade-metadata.ts";
import { calculateGarageVehicleScores } from "../ui/garage-score-calculation.ts";
import { parseGaragePartGradeGrid, parseGarageSkillScoreTable } from "../ui/garage-score-data.ts";
import { applyGarageLegacyParts, combineGarageXunScores, garageGradeContains, garageScoreInteger, garageXunSkillBonus, inverseGaragePartScore, projectGarageScoreField, roundGarageScore, scoreGarageBody } from "../ui/garage-score-arithmetic.ts";
import { createGarageCancelPreviewButton, createGarageInventoryScroll, createGarageRemovePartButton } from "../ui/garage-view-field-actions.ts";
import { loadGarageAssetBundle } from "../ui/garage-asset-bundle.ts";
import { loadGarageUpgradeAssets } from "../ui/garage-upgrade-assets.ts";
import { loadGarageSkillAssets } from "../ui/garage-skill-assets.ts";
import { loadGaragePreparationAssets } from "../ui/garage-upgrade-preparation-assets.ts";
import { showGarageUpgradeTutorial } from "../ui/garage-upgrade-tutorial.ts";
import { loadGarageXunUpgradePanels } from "../ui/garage-xun-upgrade-panels.ts";
import { loadGarageClassicUpgradeResult } from "../ui/garage-classic-upgrade-result.ts";
import { loadGarageScoreSource, parseGarageFactoryAbilityScores, parseGarageWeightTable, parseGarageXunPartValues } from "../ui/garage-score-resources.ts";
import { garagePartDisplayName, garagePartOrdinal, garageXunPartOrdinal, parseGarageEnchantSpecs } from "../ui/garage-part-presentation.ts";
import { garagePartCardLayout, garagePreparationCardLayout } from "../ui/garage-card-layouts.ts";
import { bindGarageHoverPreview, loadGarageDefaultPreviews, planGarageDrawOrder } from "../ui/garage-view-support.ts";
import { applyGarageFactoryScores, garageScoreGrade, garageScoreTrend, loadGarageFactoryScores, loadGarageSkillScores, normalizeGarageBodyScore } from "../ui/garage-score-application.ts";
import { garageAssetsForWidth, garageDialogAssets, garageUpgradeAssetsForMode } from "../ui/garage-asset-cache.ts";
import { garageKartCardsRect, garagePartsGridRect, garagePartIconKey, isGarageMaxXunPart, garagePageOverlayNames, styleGarageActionButton, garagePointerPresence, garageXunUpgradeRows } from "../ui/garage-ui-support.ts";
import { garagePair, garageArrowColor, garageNumericTuple, garageUpgradeAnimationPhase, garageKartCardRect, garageInsetRect, garageSecondInsetRect, garageBetweenRects, garageExtendRect } from "../ui/garage-native-layout.ts";
import { garageLayoutForEngineGrade, garageProgressionKind, previewGaragePart, garageText, garageEngineName, garageGradeName, garagePartQuality, garagePartCardBackground, garageKartTypeTexture, garagePageBackground, garageShowsVehicleInformation, garageAllowsEquipment, garagePreviewHitTest } from "../ui/garage-vehicle-presentation.ts";
import { garageRadarFinite, garageRadarAttribute, garageRadarBaseline, garageExceedChoice, garageSkillScoreInteger, garageFiniteScore, garageScoreNumber } from "../ui/garage-native-values.ts";
import { garagePartCategoryIds, garagePartSlotsByCategory, garageTuneNodesByCategory, garageTuneCategoriesByNode, garageDrivingMode, garageEnchantScoreFields, garageVehicleFunctions, garageFunctionTextures, garageLayoutProfiles, garageSkillTextures, garageExceedTextures, garageSkillDirectory, garageSkillPickerImages, garageFactoryAbilityAttributes, zeroGarageFactoryAbility, garageScoreFieldBySlot, garageScorePartCategories, garageScoreXmlAttributes, garageScoreDisplayRows } from "../ui/garage-native-catalog.ts";
import { garageGameTypeAllowed, garagePartCategoryId, garageStageLayout, garageAvailableVehicleFunctions, garagePartCardLayoutForKind, garageNativeStatePath, garageExpectedProgressionKind, garagePartPresentation, garageFactoryAbilityDraft, garageFactorySignature, garageClassicUpgradeLines, garageNeedsLoadingLabel, garageShowMaxPart } from "../ui/garage-remaining-primitives.ts";
import { garageDefaultWidth, garageStageSizes, garageStageDirectory, garageLampTexture, garageFontPath, garageFontResource, garageFontFamily, garageDefaultPartFields, garageNativeRarityValues, garageRadarAttributes, garageRadarDescriptionKeys, garageRadarCaptions, garageRadarSkillFields, garageExceedChoices, garageSidePanelInset, garageSidePanelInnerInset, garageResetPrompt, garageClassicUpgradeDirectory, garageXunUpgradeDirectory, garageXunUpgradeStages, garageXunUpgradeStageLabels, garageSkillPanelPath, garagePreparationDirectory, garagePreparationCardDirectory, garagePreparationImages, garageSkillDialogRect, garageXunSkillAttributes, zeroGarageXunSkillScore, garageScoreFields, garageScoreWeightLengths, garageXunPartScoreFields, garageGradeKeys, garagePartSlotKeys, garageGradeFallbacks, garageCardPageSize, garageRemovePartRect, garageTuneSlotNodes } from "../ui/garage-native-remaining-constants.ts";
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
const garageScoreResourceDependencies = () => ({ attribute: L, scoreFields: Se, weightLengths: Lt, partScoreFields: Is, parseNumber: re, projectPartScore: _s, scoreInteger: Nt, abilityDescriptions: ms, abilityFields: tt, zeroAbilityScore: ks });
const garagePartPresentationDependencies = () => ({ slotLabel: le, localize: Ge, slotKey: xn, engineName: pt, gradeName: ft, defaultParts: gs });
const garageCardLayoutDependencies = () => ({ attribute: y, pair: Qe, numbers: gt });
const garageScoreApplicationDependencies = () => ({ parseXml: Z, attribute: L, parseNumber: re, fields: Se, abilityFields: tt, zeroAbilityScore: ks, validateFactory: Tt, parseSkills: tn, parseFactory: nn });
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
const Q = garagePartCategoryIds, Ps = garagePartSlotsByCategory, $i = garageTuneNodesByCategory, Ti = garageTuneCategoriesByNode, ki = garageDrivingMode;
function Bt(gameTypes) { return garageGameTypeAllowed(gameTypes, ki); }
function _i(root) { return parseGarageEnchantSpecs(root, { attribute: L, categories: Ps, appliesToGameType: Bt, scoreFields: Ii }); }
const Ii = garageEnchantScoreFields;
function Li(a, e, t, s) { return parseLegacyGarageParts(a, e, t, s, L); }
function Ni(slot) { return garagePartCategoryId(slot, Q); }
const Ai = garageDefaultWidth, Mi = garageStageSizes;
function _t(width) { return garageStageLayout(width, Mi); }
const Es = garageVehicleFunctions, Ri = garageFunctionTextures;
function Fi(vehicle) { return garageAvailableVehicleFunctions(vehicle, Es); }
const Ve = garageStageDirectory, Ze = garageLampTexture;
function bt(assets) { return garageKartCardsRect(assets); }
function Gi(assets, index) { return garageKartCardRect(assets, index, bt); }
function Qe(value) { return garagePair(value); }
function qt(card, horizontalGap, verticalGap) { return garagePartCardLayout(card, horizontalGap, verticalGap, garageCardLayoutDependencies()); }
function xt(assets, kind) { return garagePartCardLayoutForKind(assets, kind); }
function Dt(assets, kind) { return garagePartsGridRect(assets, kind, xt); }
function Bi(a, e, t, s) { return collectGarageParts(a, e, t, s, { slots: de, attribute: L, defaultParts: gs, xunPartValue: Bs }); }
function qi(a, e, t) { return sortGarageParts(a, e, t); }
const Ot = new WeakMap(), Di = garageFontPath, Oi = garageFontResource, zt = garageFontFamily;
function zi(library, width = 1600) { return garageAssetsForWidth(library, width, Ot, Ui); }
function Ui(library, width) { return loadGarageAssetBundle(library, width, {
    normalizeStage: _t, stageDirectory: Ve, parseBml: j, parseXml: Z,
    attribute: y, xmlAttribute: L, alignPair: Qe, partCardLayout: qt,
    partScrollbar: Ms, loadCosmetics: Rs, cosmeticLookup: Fs,
    loadCoatings: Gs, partSlots: de, collectParts: Bi, partIconKey: Ss,
    builtInTextures: Ri, nativeStatePath: se, lampTexture: Ze,
    fontResourcePrefix: Di, fontResourceName: Oi, fontFamily: zt,
    canLoadFont: () => typeof FontFace < "u", loadFont: St, unloadFont: Ce,
    bitmapMeta: $t, createBitmap: blob => createImageBitmap(blob),
    createObjectUrl: blob => URL.createObjectURL(blob),
    revokeObjectUrl: url => URL.revokeObjectURL(url), childRect: Y,
  }); }
function se(path, suffix) { return garageNativeStatePath(path, suffix); }
function Ss(part) { return garagePartIconKey(part, Ni); }
const Ki = garageLayoutProfiles.classic, Vi = garageLayoutProfiles.v1, Hi = garageLayoutProfiles.xun;
function ue(grade) { return garageLayoutForEngineGrade(grade, { classic: Ki, v1: Vi, xun: Hi }); }
function pe(grade) { return garageProgressionKind(grade); }
function Ut(kind) { return garageExpectedProgressionKind(kind); }
const ji = garageDefaultPartFields;
function Wi(value, locked, fallback = "原装") { return garagePartPresentation(value, locked, fallback); }
function Xe(a, e, t, s, i, n, r) { return resolveEquippedGaragePart(a, e, t, s, i, n, r, me); }
function Kt(a, e) { return sameGaragePart(a, e); }
function Xi(vehicle, equipment, configuration, part, version = 7) { return previewGaragePart(vehicle, equipment, configuration, part, version, { calculate: te, family: me, slotLocked: fe }); }
function Yi(model) { return garagePartModelDuration(model); }
function Zi(panel, width, height) { return createGaragePartCamera(panel, width, height, {
    field: y, verticalFov: us,
    createPerspectiveCamera: (fov, aspect, near, far) => new zs(fov, aspect, near, far),
  }); }
function Je(library, request, environment, stageBinding) { return loadGaragePartModelScene(library, request, environment, stageBinding, {
    field: y, verticalFov: us,
    createPerspectiveCamera: (fov, aspect, near, far) => new zs(fov, aspect, near, far),
    parsePanel: j, parseModel: qs, createScene: () => new Os(),
    loadScene: Ds, now: () => performance.now(),
  }); }
const Qi = GarageModelCache;
const Ji = garageNativeRarityValues;
function ea(root) { return parseGarageTuneAbilities(root, L); }
function ta(root) { return parseGarageExceedTypes(root, L); }
function sa(root) { return parseGarageExceedChangeRules(root, L); }
const Vt = garageSkillTextures, Ht = garageExceedTextures, jt = new WeakMap();
function Wt(library, mode = "kartune", width = 1600) { return garageUpgradeAssetsForMode(library, mode, width, jt, ia); }
function ia(library, mode, width) { return loadGarageUpgradeAssets(library, mode, width, {
    normalizeStage: _t, parseBml: j, parseXml: Z, attribute: y,
    xmlAttribute: L, frameStyle: ve, parseEnchantDescriptions: ea,
    parseExceedChange: sa, nativeStatePath: se,
    skillTextures: Vt, exceedTextures: Ht,
    loadFont: St, unloadFont: Ce,
    createBitmap: blob => createImageBitmap(blob),
    createObjectUrl: blob => URL.createObjectURL(blob),
    revokeObjectUrl: url => URL.revokeObjectURL(url), childRect: Y,
  }); }
const H = Math.fround, et = garageRadarAttributes, aa = garageRadarDescriptionKeys, na = garageRadarCaptions, ra = garageRadarSkillFields;
function ee(value) { return garageRadarFinite(value, H); }
function ye(node, name, fallback) { return garageRadarAttribute(node, name, fallback, L, H); }
function oa(node) { return parseGarageRadarInput(node, L); }
function ca(root) { return parseGarageRadarWeights(root, L); }
function la(base, enhanced, weights) { return calculateGarageRadar(base, enhanced, weights); }
function ha(values, defaults, weights, stage) { return garageRadarBaseline(values, defaults, weights, stage, { normalize: Ks, calculate: Us }); }
const Xt = new WeakMap(),
  lt = new WeakMap();
function da(library, path) { return loadGarageRadarParameters(library, path, {
    attribute: L, parseXml: Z, loadVehicleParameters: ps,
  }); }
function Yt(rect, axis, percent) { return garageRadarPoint(rect, axis, percent); }
function ga(context, rect, axes) { return drawGarageRadar(context, rect, axes); }
const Ye = garageExceedChoices;
function ua(value, random = Math.random) { return garageExceedChoice(value, Ye, random); }
function $s(vehicle, restrictions) { return garageExceedChangeAvailability(vehicle, restrictions); }
const It = garageSidePanelInset, pa = garageSidePanelInnerInset;
function st(rect) { return garageInsetRect(rect, It); }
function fa(rect) { return garageSecondInsetRect(rect, It); }
function ma(left, right) { return garageBetweenRects(left, right, It); }
function wa(rect, rightEdge) { return garageExtendRect(rect, rightEdge); }
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
function he(button, style, kind) { return styleGarageActionButton(button, style, kind); }
const ba = garageResetPrompt;
function ht(factory) { return garageFactoryAbilityDraft(factory.abilities, js); }
function Zt(factory) { return garageFactorySignature(factory); }
function xa(button) { return garagePointerPresence(button); }
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
async function Ea(library, surface) { return showGarageUpgradeTutorial(library, surface, {
    parseBml: j, attribute: y, frameStyle: ve, layout: Ws,
    childRect: Y, paintFrame: be, sizeCanvas: Pe, pixelRatio: Ee,
    fontFamily: yt, loadFont: ws, unloadFont: Ce, bitmapMeta: $t,
    createBitmap: blob => createImageBitmap(blob),
  }); }



const Jt = garageClassicUpgradeDirectory;
function Ta(summary) { return garageClassicUpgradeLines(summary); }
async function ka(library, environment, stage) { return loadGarageClassicUpgradeResult(library, environment, stage, {
    directory: Jt, fontFamily: yt, parseBml: j, attribute: y,
    childRect: Y, loadFont: ws, unloadFont: Ce, loadScene: Je,
    createBitmap: blob => createImageBitmap(blob),
  }); }
const es = garageXunUpgradeDirectory, _a = garageXunUpgradeStages, Ia = garageXunUpgradeStageLabels;
function La(summary) { return garageXunUpgradeRows(summary); }
function Na(value) { return garageNeedsLoadingLabel(value); }
function Aa(durations, elapsed) { return garageUpgradeAnimationPhase(durations, elapsed); }
async function Ma(library, environment, stage, resultOnly = false) { return loadGarageXunUpgradePanels(library, environment, stage, resultOnly, {
    directory: es, stages: _a, parseBml: j, attribute: y,
    loadScene: Je,
  }); }
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
const Fa = garageSkillDirectory, Ga = garageSkillPickerImages, He = new WeakMap();
function Ts(library) { return garageDialogAssets(library, He, Ba); }
function Ba(library) { return loadGarageSkillAssets(library, {
    directory: Fa, imageNames: Ga, parseBml: j, attribute: y,
    childRect: Y, createBitmap: blob => createImageBitmap(blob),
    createObjectUrl: blob => URL.createObjectURL(blob),
    revokeObjectUrl: url => URL.revokeObjectURL(url),
  }); }
class qa extends GarageSkillSelectionState { constructor(progression, slot = 0) { super(progression, slot, garageSkillSelectionDependencies); } }
class Da extends GarageSkillSelectionDialog { constructor(surface, library, progression, row, onClose) { super(surface, library, progression, row, onClose, garageSkillDialogDependencies); } }
const Oa = garageSkillPanelPath;
function za(gauge, sprite, points) { return garageSkillEffectRect(gauge, sprite, points); }
function Ua(before, after) { return compareGarageSkillEffects(before, after); }
class Ka extends GaragePointEffects { constructor(surface, assets, load, onError) { super(surface, assets, load, onError, { attribute: (node, name) => y(node, name) }); } }
const ts = garagePreparationDirectory, dt = garagePreparationCardDirectory, Va = garagePreparationImages, je = new WeakMap();
function Ha(library) { return garageDialogAssets(library, je, ja); }
function ja(library) { return loadGaragePreparationAssets(library, {
    layoutDirectory: ts, cardDirectory: dt, imageTokens: Va,
    parseBml: j, attribute: y, frameStyle: ve, childRect: Y,
    frameInnerRect: Rt, parseArrowColor: We, cardLayout: Wa,
    canLoadFont: () => typeof FontFace < "u", loadFont: St, unloadFont: Ce,
    bitmapMeta: $t, createBitmap: blob => createImageBitmap(blob),
    createObjectUrl: blob => URL.createObjectURL(blob),
    revokeObjectUrl: url => URL.revokeObjectURL(url),
  }); }
function We(value, label) { return garageArrowColor(value, label); }
function Wa(selector, card) { return garagePreparationCardLayout(selector, card, garageCardLayoutDependencies()); }
function gt(value, count, label) { return garageNumericTuple(value, count, label); }
const Xa = garageSkillDialogRect;
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
const Ct = garageXunSkillAttributes, Pt = zeroGarageXunSkillScore;
function is(value) { return garageSkillScoreInteger(value); }
function tn(tuning, abilities) { return parseGarageSkillScoreTable(tuning, abilities, L); }
function sn(skills, progression) { return garageXunSkillBonus(skills, progression, kt); }
async function an(library) { return loadGarageSkillScores(library, garageScoreApplicationDependencies()); }
const tt = garageFactoryAbilityAttributes, ks = zeroGarageFactoryAbility;
function nn(root) { return parseGarageFactoryAbilityScores(root, garageScoreResourceDependencies()); }
function as(base, scores, factory, includeInactive = false) { return applyGarageFactoryScores(base, scores, factory, includeInactive, garageScoreApplicationDependencies()); }
async function rn(library) { return loadGarageFactoryScores(library, garageScoreApplicationDependencies()); }
const Se = garageScoreFields, U = Math.fround, Lt = garageScoreWeightLengths;
function xe(value) { return garageFiniteScore(value, U); }
function re(value) { return garageScoreNumber(value, U); }
function on(body) { return normalizeGarageBodyScore(body, garageScoreApplicationDependencies()); }
function ns(root, kind) { return parseGarageWeightTable(root, kind, garageScoreResourceDependencies()); }
function rs(value) { return roundGarageScore(value); }
function _s(field, value, table) { return projectGarageScoreField(field, value, table); }
function Nt(value) { return garageScoreInteger(value); }
function ut(input, table) { return scoreGarageBody(input, table); }
function cn(field, value, table) { return inverseGaragePartScore(field, value, table); }
function ln(root) { return parseGaragePartGradeGrid(root, L); }
function hn(grid, grade, field, value) { return garageGradeContains(grid, grade, field, value); }
function dn(grid, grade, field, score) { return garageScoreGrade(grid, grade, field, score); }
const Is = garageXunPartScoreFields;
function gn(root, table) { return parseGarageXunPartValues(root, table, garageScoreResourceDependencies()); }
function un(input, parts, bonus) { return combineGarageXunScores(input, parts, bonus); }
const os = new WeakMap();
async function cs(library, vehicle, kind) { return loadGarageScoreSource(library, vehicle, kind, {
    ...garageScoreResourceDependencies(), cache: os, parseXml: Z,
    parseWeights: ns, parseParts: gn, parseGradeGrid: ln,
    loadSkills: an, loadFactory: rn, loadVehicle: ps, normalizeBody: on,
  }); }
const pn = garageScoreFieldBySlot, fn = garageScorePartCategories, mn = garageScoreXmlAttributes, ls = garageScoreDisplayRows;
function wn(before, after, base) { return garageScoreTrend(before, after, base); }
function yn(input, configuration) { return applyGarageLegacyParts(input, configuration, de); }
function Me(source, vehicle, engineGrade, configuration, parts, ignoredSlot) {
    return calculateGarageVehicleScores(source, vehicle, engineGrade, configuration,
      parts, ignoredSlot, {
        partFamily: me, scoreFamily: vt, validateFactory: Tt,
        validatePart: Zs, slotLocked: fe, slots: de,
        scorePartCategories: fn, scorePartFields: pn, resolvePart: Xe,
        skillBonus: (skills, progression) => garageXunSkillBonus(skills, progression, kt),
        combineXun: combineGarageXunScores, scoreBody: scoreGarageBody,
        addLegacyParts: (input, current) => applyGarageLegacyParts(input, current, de),
        applyFactory: as, fallbackGrade: ys, gradeContains: garageGradeContains,
        inversePartScore: inverseGaragePartScore,
      });
  }
class vn extends GarageInventoryScroll { constructor(viewport, hitTarget, snapStep) { super(viewport, hitTarget, snapStep, (...args) => Qs(...args)); } }
const bn = garageGradeKeys, xn = garagePartSlotKeys, Cn = garageGradeFallbacks;
function Ge(strings, key, fallback) { return garageText(strings, key, fallback); }
function pt(strings, grade, fallback) { return garageEngineName(strings, grade, fallback); }
function Ls(part, available) { return garagePartOrdinal(part, available, garagePartPresentationDependencies()); }
function Ns(part, available) { return garageXunPartOrdinal(part, available, garagePartPresentationDependencies()); }
function Pn(part, available) { return isGarageMaxXunPart(part, available); }
function En(part, available, enabled) { return garageShowMaxPart(part, available, enabled, Pn); }
function ft(grade, strings) { return garageGradeName(grade, strings, bn, Cn); }
function Et(part) { return garagePartQuality(part); }
function Sn(part, fallback) { return garagePartCardBackground(part, fallback); }
function $n(part, strings, available) { return garagePartDisplayName(part, strings, available, garagePartPresentationDependencies()); }
class Tn extends GarageExceedTypeDialog { constructor(surface, assets, library, current, onClose) { super(surface, assets, library, current, onClose, garageExceedDialogDependencies); } }
const kn = garageCardPageSize, _n = garageRemovePartRect;
function In(kind) { return garageKartTypeTexture(kind); }
function Ln(page, xun) { return garagePageOverlayNames(page, xun); }
function Nn(page, layout) { return garagePageBackground(page, layout); }
const hs = new WeakMap();
function An(root, visible) { return planGarageDrawOrder(root, visible, { attribute: y, cache: hs }); }
function ds(page, grade) { return garageShowsVehicleInformation(page, grade); }
function mt(locked, blocked = false) { return garageAllowsEquipment(locked, blocked); }
const wt = garageTuneSlotNodes;
function Mn(target, value, current, select) { return bindGarageHoverPreview(target, value, current, select); }
function Rn(container, x, y, elementFromPoint, cards) { return garagePreviewHitTest(container, x, y, elementFromPoint, cards); }
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
  inventoryScroll = createGarageInventoryScroll(this,
    (inventory, hitTarget, step) => new vn(inventory, hitTarget, step));
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
  cancelPreview = createGarageCancelPreviewButton(this);
  removePart = createGarageRemovePartButton(this);
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
async function Fn(options) { return loadGarageDefaultPreviews(options, { defaultVersion: vs, loadSpecification: bi, previewKey: bs, createPreview: xs }); }
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
