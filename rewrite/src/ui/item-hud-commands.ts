/**
 * Item race HUD draw commands from an ItemHudState (pure: no loading, no GL).
 * Commands use the overlay renderer's "panel" payload; text is rasterized
 * into panel textures by the injected `text` function, the way the release
 * draws rank board names (library.js PJ).
 */

import {
  STAGE_HEIGHT, STAGE_RECT, STAGE_WIDTH, changerOffset,
  type ChangerRow, type HudImage, type HudNode, type HudRect, type ItemDescription,
  type ItemHudAssets, type PlacedLabel, type TextStyle,
} from "./item-hud-assets";
import type { ItemHudLogEntry, ItemHudNotice, ItemHudOptions, ItemHudState } from "./item-hud-state";
import type { ItemSlotFrame } from "./item-slot-hud";

export interface HudPanelCommand {
  kind: "panel";
  node: HudNode;
  textureName: string;
  texture: HudImage;
  worldRect: HudRect;
  framebufferRect: HudRect;
  uv: HudRect;
  alpha?: number;
}

export interface HudTextSpec {
  text: string;
  style: TextStyle;
  /** Wider lines shrink to fit. */
  maxWidth?: number;
}

export interface ItemHudRankRow {
  participantId: unknown;
  x: number;
  y: number;
  local?: boolean;
}

export interface ItemHudFrameInput {
  state: ItemHudState;
  options: ItemHudOptions;
  timeMs: number;
  /** item/itemStateNotice/item<idx>.png (45×45), undefined while it loads. */
  noticeIcon(idx: number): HudImage | undefined;
  /** item/slot/item_s<idx>.png (30×30). */
  smallIcon(idx: number): HudImage | undefined;
  /** Slot type 0 of slot_template.bml with the race's slot frame texture. */
  smallSlot?: { frame: ItemSlotFrame; texture: HudImage; textureName: string };
  describe(idx: number): ItemDescription | undefined;
  abuseText: string;
  text(spec: HudTextSpec): HudImage | undefined;
  /** The rank board rows as laid out this frame (scanning icons go beside them). */
  rank?: { left: number; top: number; rowWidth: number; rowHeight: number;
    rows: readonly ItemHudRankRow[] };
}

/** How long a hit-log row stays (itemStateTotalNotice has no lifeTime) [还原]. */
export const ITEM_LOG_LIFE_MS = 3000;
export const ITEM_LOG_FADE_MS = 500;
/** Rows of itemStateNotice (panelCount) and itemStateTotalNotice. */
export const ITEM_NOTICE_ROWS = 3;
/** The firingWarning vignette pulse and the teamWarn lamp blink [还原]. */
export const ITEM_WARNING_PERIOD_MS = 500;
export const ITEM_WARNING_LAMP_MS = 250;
/** The item box abuse message: centred on the stage [还原]. */
export const ITEM_ABUSE_TOP = 300;
export const ITEM_ABUSE_FADE_MS = 300;

const fullUv = (): HudRect => ({ left: 0, top: 0, right: 1, bottom: 1 });

function normalized(pixels: HudRect, texture: HudImage): HudRect {
  return { left: Math.fround(pixels.left / texture.width), top: Math.fround(pixels.top / texture.height),
    right: Math.fround(pixels.right / texture.width),
    bottom: Math.fround(pixels.bottom / texture.height) };
}

function moved(rect: HudRect, x: number, y: number): HudRect {
  return { left: rect.left + x, top: rect.top + y, right: rect.right + x, bottom: rect.bottom + y };
}

export function hudPanel(node: HudNode, textureName: string, texture: HudImage, rect: HudRect,
  uv: HudRect = fullUv(), alpha = 255): HudPanelCommand {
  const command: HudPanelCommand = { kind: "panel", node, textureName, texture,
    worldRect: rect, framebufferRect: rect, uv };
  if (alpha < 255) command.alpha = Math.max(0, Math.round(alpha));
  return command;
}

/** An image placed inside a rect by the label's alignment. */
export function alignedRect(image: { width: number; height: number }, rect: HudRect,
  style: Pick<TextStyle, "align" | "verticalAlign">): HudRect {
  const width = rect.right - rect.left;
  const height = rect.bottom - rect.top;
  const left = style.align === "right" ? rect.right - image.width
    : style.align === "center" ? rect.left + Math.floor((width - image.width) / 2) : rect.left;
  const top = style.verticalAlign === "bottom" ? rect.bottom - image.height
    : style.verticalAlign === "center" ? rect.top + Math.floor((height - image.height) / 2)
      : rect.top;
  return { left, top, right: left + image.width, bottom: top + image.height };
}

function textPanel(input: ItemHudFrameInput, label: Pick<PlacedLabel, "node" | "rect">,
  text: string, style: TextStyle, alpha = 255): HudPanelCommand | undefined {
  if (!text) return undefined;
  const image = input.text({ text, style, maxWidth: label.rect.right - label.rect.left });
  if (!image) return undefined;
  return hudPanel(label.node, `text:${text}`, image, alignedRect(image, label.rect, style),
    fullUv(), alpha);
}

/** itemStateNotice: full for affectTime, then fading out until lifeTime [还原]. */
export function noticeAlpha(ageMs: number, lifeTimeMs: number, affectTimeMs: number): number {
  if (!(ageMs >= 0) || ageMs >= lifeTimeMs) return 0;
  if (ageMs <= affectTimeMs) return 255;
  return Math.round(255 * (1 - (ageMs - affectTimeMs) / (lifeTimeMs - affectTimeMs)));
}

export function logAlpha(ageMs: number): number {
  if (!(ageMs >= 0) || ageMs >= ITEM_LOG_LIFE_MS) return 0;
  const left = ITEM_LOG_LIFE_MS - ageMs;
  return left >= ITEM_LOG_FADE_MS ? 255 : Math.round(255 * left / ITEM_LOG_FADE_MS);
}

/** Triangle pulse between 96 and 255 (firingWarning starts at color alpha 0). */
export function warningAlpha(timeMs: number): number {
  const phase = ((timeMs % ITEM_WARNING_PERIOD_MS) + ITEM_WARNING_PERIOD_MS) % ITEM_WARNING_PERIOD_MS;
  const wave = 1 - Math.abs(phase / ITEM_WARNING_PERIOD_MS * 2 - 1);
  return Math.round(96 + (255 - 96) * wave);
}

/** The newest live entries first, at most `count`. */
export function liveEntries<Entry extends { at: number }>(entries: readonly Entry[], timeMs: number,
  lifeMs: number, count = ITEM_NOTICE_ROWS): Entry[] {
  return entries.filter(entry => timeMs >= entry.at && timeMs - entry.at < lifeMs)
    .sort((a, b) => b.at - a.at).slice(0, count);
}

/** Right edge of the slot row (release geometry: 24 + (n-1)·82 + 92). */
export function slotRowRight(capacity: number): number {
  return 24 + (capacity - 1) * 82 + 92;
}

/** Panels drawn over the race HUD (the cloud cover is drawn by ItemHudCloud). */
export interface ItemHudCommands {
  over: HudPanelCommand[];
}

export function buildItemHudCommands(assets: ItemHudAssets,
  input: ItemHudFrameInput): ItemHudCommands {
  const { state, timeMs } = input;
  const over: HudPanelCommand[] = [];
  const push = (command: HudPanelCommand | undefined) => { if (command) over.push(command); };

  if (state.warning) {
    const texture = state.warning === "waterfly" ? assets.warning.waterfly : assets.warning.rocket;
    push(hudPanel(assets.warning.node, `warning_${state.warning}`, texture, assets.warning.rect,
      fullUv(), warningAlpha(timeMs)));
    const { lamp, light } = assets.teamWarn;
    push(hudPanel(lamp.node, "crash_01", assets.textures.get("crash_01")!, lamp.rect));
    if (Math.floor(timeMs / ITEM_WARNING_LAMP_MS) % 2 === 0)
      push(hudPanel(light.node, "crash_02", assets.textures.get("crash_02")!, light.rect));
  }

  over.push(...scanCommands(assets, input));
  over.push(...changerCommands(assets, state));

  if (state.aim) {
    const crosshair = assets.crosshairs[state.aim.phase];
    const { width, height } = crosshair.texture;
    const left = Math.round(state.aim.x - width / 2);
    const top = Math.round(state.aim.y - height / 2);
    push(hudPanel(crosshair.node, crosshair.name, crosshair.texture,
      { left, top, right: left + width, bottom: top + height }));
  }

  if (input.options.dispIngameItemInfoCard && state.infoCard) {
    const description = input.describe(state.infoCard.itemIdx);
    if (description) {
      const balloon = assets.infoCard.balloons[state.capacity === 3 ? 3 : 2];
      const name = assets.textures.get(balloonTexture(balloon.node, assets))!;
      push(hudPanel(balloon.node, balloonTexture(balloon.node, assets), name, balloon.rect));
      const lines = [description.name, ...description.description.split("|")].filter(Boolean);
      push(textPanel(input, assets.infoCard.text, lines.join("\n"), assets.infoCard.text.style));
    }
  }

  if (input.options.itemStateNotice) {
    for (const kind of ["bad", "good"] as const) {
      const rows = assets.notices[kind];
      const live = liveEntries(state.notices.filter(notice => notice.kind === kind), timeMs,
        assets.notices.lifeTimeMs, rows.length);
      live.forEach((notice, index) => over.push(...noticeCommands(assets, input, rows[index]!,
        notice, noticeAlpha(timeMs - notice.at, assets.notices.lifeTimeMs,
          assets.notices.affectTimeMs))));
    }
  }

  if (input.options.itemStateTotalNotice) {
    liveEntries(state.log, timeMs, ITEM_LOG_LIFE_MS, assets.log.rows.length)
      .forEach((entry, index) => over.push(...logCommands(assets, input, index, entry,
        logAlpha(timeMs - entry.at))));
  }

  if (state.abuseUntil !== undefined && timeMs < state.abuseUntil) {
    const left = state.abuseUntil - timeMs;
    const alpha = left >= ITEM_ABUSE_FADE_MS ? 255 : Math.round(255 * left / ITEM_ABUSE_FADE_MS);
    const { texture } = assets.abuse;
    const x = Math.floor((STAGE_WIDTH - texture.width) / 2);
    const rect = { left: x, top: ITEM_ABUSE_TOP, right: x + texture.width,
      bottom: ITEM_ABUSE_TOP + texture.height };
    push(hudPanel(assets.abuse.node, "itemCubeAbusingMsgBg", texture, rect, fullUv(), alpha));
    push(textPanel(input, { node: assets.abuse.text, rect }, input.abuseText.split("|").join("\n"),
      { color: "white", outline: "black", size: 14, align: "center", verticalAlign: "center" },
      alpha));
  }
  return { over };
}

function balloonTexture(node: HudNode, assets: ItemHudAssets): string {
  const name = node.attributes.find(entry => entry.name === "texture")?.value;
  if (!name || !assets.textures.has(name)) throw new Error("道具说明卡缺少气泡贴图。");
  return name;
}

function noticeCommands(assets: ItemHudAssets, input: ItemHudFrameInput,
  row: ItemHudAssets["notices"]["bad"][number], notice: ItemHudNotice,
  alpha: number): HudPanelCommand[] {
  const commands: HudPanelCommand[] = [];
  const icon = input.noticeIcon(notice.itemIdx);
  if (icon) commands.push(hudPanel(row.icon.node, `notice${notice.itemIdx}`, icon, row.icon.rect,
    fullUv(), alpha));
  const label = textPanel(input, row.label, notice.text, row.label.style, alpha);
  if (label) commands.push(label);
  const stateTexture = row.state.node.attributes.find(entry => entry.name === "texture")?.value;
  const texture = stateTexture === undefined ? undefined : assets.textures.get(stateTexture);
  if (texture) commands.push(hudPanel(row.state.node, stateTexture!, texture, row.state.rect,
    fullUv(), alpha));
  return commands;
}

const logBackgrounds = {
  solo: "itemInfo_BG_solo", blue: "itemInfo_BG_teamBlue", red: "itemInfo_BG_teamRed",
} as const;

function logCommands(assets: ItemHudAssets, input: ItemHudFrameInput, index: number,
  entry: ItemHudLogEntry, alpha: number): HudPanelCommand[] {
  const row = assets.log.rows[index]!;
  const team = entry.team ?? "solo";
  const colors = assets.log.colors[team];
  const commands: HudPanelCommand[] = [];
  const background = assets.textures.get(logBackgrounds[team])!;
  commands.push(hudPanel(row.background.node, logBackgrounds[team], background,
    row.background.rect, fullUv(), alpha));
  const attacker = textPanel(input, row.attacker, entry.attacker,
    { ...row.attacker.style, color: colors.attacker }, alpha);
  if (attacker) commands.push(attacker);
  const victim = textPanel(input, row.victim, entry.victim,
    { ...row.victim.style, color: colors.victim }, alpha);
  if (victim) commands.push(victim);
  const icon = input.noticeIcon(entry.itemIdx);
  if (icon) commands.push(hudPanel(row.icon.node, `notice${entry.itemIdx}`, icon, row.icon.rect,
    fullUv(), alpha));
  if (entry.failed) commands.push(hudPanel(row.failIcon.node, "itemInfo_failIcon",
    assets.textures.get("itemInfo_failIcon")!, row.failIcon.rect, fullUv(), alpha));
  return commands;
}

function changerCommands(assets: ItemHudAssets, state: ItemHudState): HudPanelCommand[] {
  const commands: HudPanelCommand[] = [];
  const offset = changerOffset(slotRowRight(state.capacity));
  const changer = assets.textures.get("changer")!;
  const digits = assets.textures.get("time_num")!;
  const infinity = assets.textures.get("changerItem_num_infinite")!;
  const rows: Array<[ChangerRow, ItemHudState["slotChanger"]]> = [
    [assets.changers.slot, state.slotChanger], [assets.changers.item, state.itemChanger],
  ];
  for (const [row, count] of rows) {
    if (count !== "infinite" && !(Number.isInteger(count) && count > 0)) continue;
    commands.push(hudPanel(row.key.node, "changer", changer, moved(row.key.rect, offset.x, offset.y),
      normalized(row.keyUv.enabled, changer)));
    commands.push(hudPanel(row.card.node, "changer", changer,
      moved(row.card.rect, offset.x, offset.y), normalized(row.cardUv.enabled, changer)));
    if (count === "infinite") {
      commands.push(hudPanel(row.infinity.node, "changerItem_num_infinite", infinity,
        moved(row.infinity.rect, offset.x, offset.y)));
      continue;
    }
    const text = `x${Math.min(count, 99)}`;
    const rect = moved(row.number.rect, offset.x, offset.y);
    for (let index = 0; index < text.length; index++) {
      const glyph = row.glyphs.indexOf(text[index]!);
      if (glyph < 0) continue;
      const left = rect.left + index * row.glyphAdvance;
      commands.push(hudPanel(row.number.node, "time_num", digits,
        { left, top: rect.top, right: left + row.glyphWidth, bottom: rect.top + row.glyphHeight },
        normalized({ left: glyph * row.glyphWidth, top: 0, right: (glyph + 1) * row.glyphWidth,
          bottom: row.glyphHeight }, digits)));
    }
  }
  return commands;
}

/**
 * scanning: each opponent's slots beside their rank row, one Slot type 0
 * cell per slot (the 30×30 frame of slot.png) with slot_scanning (23×23)
 * as its backdrop and the item_s icon on top [还原: native layout].
 */
function scanCommands(assets: ItemHudAssets, input: ItemHudFrameInput): HudPanelCommand[] {
  const { state, rank } = input;
  if (!state.scan?.length || !rank) return [];
  const commands: HudPanelCommand[] = [];
  const small = input.smallSlot;
  const size = small ? small.frame.rect.right - small.frame.rect.left : 30;
  const backdrop = assets.scanning.texture;
  for (const row of rank.rows) {
    if (row.local) continue;
    const scan = state.scan.find(entry => entry.playerId === row.participantId);
    if (!scan) continue;
    const top = rank.top + row.y + Math.floor((rank.rowHeight - size) / 2);
    let left = rank.left + row.x + rank.rowWidth + 4;
    for (const idx of scan.slots) {
      const rect = { left, top, right: left + size, bottom: top + size };
      if (small) commands.push(hudPanel(small.frame.node, small.textureName, small.texture, rect,
        normalized(small.frame.uvPixels, small.texture)));
      const inner = { left: left + Math.floor((size - backdrop.width) / 2),
        top: top + Math.floor((size - backdrop.height) / 2) };
      commands.push(hudPanel(assets.scanning.node, "slot_scanning", backdrop, { ...inner,
        right: inner.left + backdrop.width, bottom: inner.top + backdrop.height }));
      const icon = idx >= 0 ? input.smallIcon(idx) : undefined;
      if (icon) {
        const inset = small?.frame.adjust ?? 0;
        commands.push(hudPanel(small?.frame.node ?? assets.scanning.node, `item_s${idx}`, icon, {
          left: rect.left + inset, top: rect.top + inset,
          right: rect.right - inset, bottom: rect.bottom - inset }));
      }
      left += size + 2;
    }
  }
  return commands;
}

export const ITEM_HUD_STAGE = { width: STAGE_WIDTH, height: STAGE_HEIGHT, rect: STAGE_RECT };
