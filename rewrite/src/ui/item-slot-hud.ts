/**
 * The race HUD item slots (release XJ, s00 and Ax, "P3528 ItemSlot").
 *
 * The release only drew the speed race booster slots (item 6 and the team
 * booster 14) and threw for any other id. This port keeps those commands
 * unchanged and adds what the item race needs: any item icon
 * (item/slot/item<idx>.png, loaded on first use), the 3-slot row, the swap
 * animation for 3 slots, the freeze_slot.png lock overlay and the slotTimer
 * countdown digits of stage_/speedIndiGame/screenui.bml.
 */

export interface SlotRect { left: number; top: number; right: number; bottom: number }
export interface SlotImage { width: number; height: number; pixels: Uint8Array }

export interface SlotNode {
  name: string;
  attributes: Array<{ name: string; value: string }>;
  children: SlotNode[];
}

export interface ItemSlotFrame {
  node: SlotNode;
  rect: SlotRect;
  uvPixels: SlotRect;
  adjust: number;
}

export interface SlotPanelCommand {
  kind: "panel";
  node: SlotNode;
  textureName: string;
  texture: SlotImage;
  worldRect: SlotRect;
  framebufferRect: SlotRect;
  uv: SlotRect;
}

export interface ItemSlotResourceFile {
  bytes(): Promise<Uint8Array>;
}

export interface ItemSlotDependencies {
  attribute(node: SlotNode, name: string): string | undefined;
  /** Release j2: "a b c" → float32 numbers, throwing on a wrong count. */
  numbers(text: string, count: number, label: string): number[];
  parseBml(bytes: Uint8Array): SlotNode;
  decodeTexture(bytes: Uint8Array): Promise<SlotImage>;
  /** Release ln: the one canonical source of a path inside a container. */
  findResource(library: unknown, path: string, container: string): ItemSlotResourceFile;
}

/** The slotTimer DashboardPanel of screenui.bml with its digit atlas. */
export interface ItemSlotTimer {
  node: SlotNode;
  texture: SlotImage;
  textureName: string;
  glyphWidth: number;
  glyphHeight: number;
  glyphs: string;
}

/**
 * Item race resources the release never loaded. Icons load on first use and
 * show from the next frame; `prepare` loads a known set up front.
 */
export class ItemSlotResources {
  readonly icons = new Map<number, SlotImage | null>();
  readonly smallIcons = new Map<number, SlotImage | null>();
  freeze?: SlotImage;
  timer?: ItemSlotTimer;
  /** Ids whose icon failed to load (an iconGuide noIcon id, for example). */
  readonly missing = new Set<string>();
  private readonly pending = new Map<string, Promise<void>>();
  private overlay?: Promise<void>;

  constructor(readonly library: unknown, readonly dependencies: ItemSlotDependencies) {}

  /** item/slot/item<idx>.png, or undefined while it loads. */
  icon(idx: number): SlotImage | undefined {
    return this.cached(this.icons, `item${idx}`, idx);
  }

  /** item/slot/item_s<idx>.png (Slot type 0), or undefined while it loads. */
  smallIcon(idx: number): SlotImage | undefined {
    return this.cached(this.smallIcons, `item_s${idx}`, idx);
  }

  /** Icons, small icons, the lock overlay and the countdown digits. */
  async prepare(ids: readonly number[]): Promise<void> {
    await Promise.all([
      ...ids.map(idx => this.load(this.icons, `item${idx}`, idx)),
      ...ids.map(idx => this.load(this.smallIcons, `item_s${idx}`, idx)),
      this.prepareOverlay(),
    ]);
  }

  prepareOverlay(): Promise<void> {
    this.overlay ??= (async () => {
      const deps = this.dependencies;
      const [freeze, timer] = await Promise.all([
        deps.findResource(this.library, `${slotFolder}/freeze_slot.png`, slotContainer).bytes()
          .then(bytes => deps.decodeTexture(bytes)),
        loadSlotTimer(this.library, deps),
      ]);
      this.freeze = freeze;
      this.timer = timer;
    })();
    return this.overlay;
  }

  private cached(cache: Map<number, SlotImage | null>, name: string,
    idx: number): SlotImage | undefined {
    const image = cache.get(idx);
    if (image !== undefined) return image ?? undefined;
    void this.load(cache, name, idx);
    return undefined;
  }

  private load(cache: Map<number, SlotImage | null>, name: string,
    idx: number): Promise<void> {
    if (!Number.isInteger(idx) || idx < 0) return Promise.resolve();
    if (cache.has(idx)) return Promise.resolve();
    const running = this.pending.get(name);
    if (running) return running;
    const deps = this.dependencies;
    const task = (async () => {
      try {
        const file = deps.findResource(this.library, `${slotFolder}/${name}.png`, slotContainer);
        cache.set(idx, await deps.decodeTexture(await file.bytes()));
      } catch {
        cache.set(idx, null);
        this.missing.add(name);
      } finally {
        this.pending.delete(name);
      }
    })();
    this.pending.set(name, task);
    return task;
  }
}

export interface ItemSlotDefinition {
  frameTextureName: string;
  frameTexture: SlotImage;
  boostTexture: SlotImage;
  teamBoostTexture: SlotImage;
  current: ItemSlotFrame;
  reserve: ItemSlotFrame;
  /** Not in the release: Slot type 0 (30×30, uvRc 0 98 30 128). */
  small: ItemSlotFrame;
  resources: ItemSlotResources;
}

/** Item race additions to the slot row; their presence marks an item race. */
export interface ItemSlotOverlay {
  /** freeze_slot.png over every slot (slotLock). */
  locked?: boolean;
  /** slotTimer countdown over the current slot (lock or time bomb). */
  countdownMs?: number;
}

const slotFolder = "item/slot";
const slotContainer = "item.rho";
const screenUiPath = "stage_/speedIndiGame/screenui.bml";
const screenUiContainer = "stage_speedIndiGame.rho";
/** screenui addResFolder order: /stage/common/ resolves 미사일숫자 first. */
const timerTextureRoots: ReadonlyArray<[string, string]> = [
  ["stage_/common", "stage_common.rho"],
  ["stage_/speedIndiGame", "stage_speedIndiGame.rho"],
];

/** Release px: the Alt swap animation length. */
export const ITEM_SLOT_REORDER_MS = 350;
export const ITEM_SLOT_LEFT = 24;
export const ITEM_SLOT_TOP = 24;
export const ITEM_SLOT_PITCH = 82;

const f32 = Math.fround;

function requireAttribute(node: SlotNode, name: string, deps: ItemSlotDependencies): string {
  const value = deps.attribute(node, name);
  if (value === undefined) throw new Error(`P3528 ${node.name}.${name} 缺失。`);
  return value;
}

/** Release Ax: Slot rc (x y w h), uvRc (l t r b) and adjustValue. */
export function itemSlotFrame(node: SlotNode, deps: ItemSlotDependencies): ItemSlotFrame {
  const [x, y, width, height] = deps.numbers(requireAttribute(node, "rc", deps), 4, "Slot.rc");
  const [left, top, right, bottom] = deps.numbers(requireAttribute(node, "uvRc", deps), 4,
    "Slot.uvRc");
  const adjust = Number(requireAttribute(node, "adjustValue", deps));
  if (!Number.isInteger(adjust) || adjust < 0)
    throw new Error(`P3528 Slot.adjustValue=${adjust} 无效。`);
  return {
    node,
    rect: { left: x!, top: y!, right: f32(x! + width!), bottom: f32(y! + height!) },
    uvPixels: { left: left!, top: top!, right: right!, bottom: bottom! },
    adjust,
  };
}

/** Release Mx: the one Slot of a type in slot_template.bml. */
function slotOfType(template: SlotNode, type: string, deps: ItemSlotDependencies): SlotNode {
  const slots = template.children.filter(child =>
    child.name === "Slot" && deps.attribute(child, "type") === type);
  if (slots.length !== 1)
    throw new Error(`P3528 Slot type=${type} 数量必须为 1，实际 ${slots.length}。`);
  return slots[0]!;
}

async function loadTexture(library: unknown, path: string, container: string,
  deps: ItemSlotDependencies): Promise<SlotImage> {
  return deps.decodeTexture(await deps.findResource(library, path, container).bytes());
}

/** Release s00: slot_template.bml, the tachometer's frame and the booster icons. */
export async function loadItemSlotDefinition(library: unknown, frame: string,
  deps: ItemSlotDependencies): Promise<ItemSlotDefinition> {
  const [template, frames] = await Promise.all([
    deps.findResource(library, `${slotFolder}/slot_template.bml`, slotContainer)
      .bytes().then(bytes => deps.parseBml(bytes)),
    deps.findResource(library, `${slotFolder}/slot_frameResource.bml`, slotContainer)
      .bytes().then(bytes => deps.parseBml(bytes)),
  ]);
  const entry = frames.children.find(child => deps.attribute(child, "name") === frame);
  if (!entry) throw new Error(`P3528 ItemSlot frame=${frame} 不在 slot_frameResource。`);
  const textureName = requireAttribute(entry, "texture", deps);
  const [frameTexture, boostTexture, teamBoostTexture] = await Promise.all([
    loadTexture(library, `${slotFolder}/${textureName}.png`, slotContainer, deps),
    loadTexture(library, `${slotFolder}/item6.png`, slotContainer, deps),
    loadTexture(library, `${slotFolder}/item14.png`, slotContainer, deps),
  ]);
  const resources = new ItemSlotResources(library, deps);
  resources.icons.set(6, boostTexture);
  resources.icons.set(14, teamBoostTexture);
  return {
    frameTextureName: textureName,
    frameTexture,
    boostTexture,
    teamBoostTexture,
    current: itemSlotFrame(slotOfType(template, "2", deps), deps),
    reserve: itemSlotFrame(slotOfType(template, "1", deps), deps),
    small: itemSlotFrame(slotOfType(template, "0", deps), deps),
    resources,
  };
}

/** The slotTimer DashboardPanel and its digit atlas (fontSize 22 26). */
export async function loadSlotTimer(library: unknown,
  deps: ItemSlotDependencies): Promise<ItemSlotTimer> {
  const screen = deps.parseBml(await deps.findResource(library, screenUiPath,
    screenUiContainer).bytes());
  const node = findNamed(screen, "slotTimer", deps);
  if (!node || node.name !== "DashboardPanel")
    throw new Error("screenui.bml 缺少 slotTimer DashboardPanel。");
  const textureName = requireAttribute(node, "texture", deps);
  const [glyphWidth, glyphHeight] = deps.numbers(requireAttribute(node, "fontSize", deps), 2,
    "slotTimer.fontSize");
  const glyphs = requireAttribute(node, "fontStr", deps);
  let texture: SlotImage | undefined;
  for (const [folder, container] of timerTextureRoots) {
    try {
      texture = await loadTexture(library, `${folder}/${textureName}.png`, container, deps);
      break;
    } catch { /* The next addResFolder. */ }
  }
  if (!texture) throw new Error(`slotTimer 缺少 ${textureName}.png。`);
  if (texture.width < glyphWidth! * glyphs.length || texture.height < glyphHeight!)
    throw new Error(`slotTimer ${textureName}.png 与 fontSize 不符。`);
  return { node, texture, textureName, glyphWidth: glyphWidth!, glyphHeight: glyphHeight!,
    glyphs };
}

function findNamed(root: SlotNode, name: string,
  deps: ItemSlotDependencies): SlotNode | undefined {
  const stack = [root];
  while (stack.length) {
    const node = stack.pop()!;
    if (deps.attribute(node, "name") === name) return node;
    stack.push(...node.children);
  }
  return undefined;
}

/** Release Yl. */
function offset(rect: SlotRect, x: number, y: number): SlotRect {
  return { left: f32(rect.left + x), top: f32(rect.top + y),
    right: f32(rect.right + x), bottom: f32(rect.bottom + y) };
}

/** Release rI: grows the rect by `amount` on every side. */
function grow(rect: SlotRect, amount: number): SlotRect {
  return { left: f32(rect.left - amount), top: f32(rect.top - amount),
    right: f32(rect.right + amount), bottom: f32(rect.bottom + amount) };
}

function slotFrame(definition: Pick<ItemSlotDefinition, "current" | "reserve">,
  index: number): ItemSlotFrame {
  return index === 0 ? definition.current : definition.reserve;
}

/** Release sI: slot `index` of a `count` row; slot 0 is the rightmost. */
export function itemSlotRect(definition: Pick<ItemSlotDefinition, "current" | "reserve">,
  index: number, count: number): SlotRect {
  return offset(slotFrame(definition, index).rect,
    ITEM_SLOT_LEFT + (count - index - 1) * ITEM_SLOT_PITCH, ITEM_SLOT_TOP);
}

/** Release u00: the icon rect of a slot (inset by adjustValue). */
export function itemSlotIconRect(definition: Pick<ItemSlotDefinition, "current" | "reserve">,
  index: number, count: number): SlotRect {
  return grow(itemSlotRect(definition, index, count), -slotFrame(definition, index).adjust);
}

/** Release h00: ease-out cubic. */
export function slotReorderEase(progress: number): number {
  return 1 - (1 - progress) ** 3;
}

/** Release d00. */
function lerpRect(from: SlotRect, to: SlotRect, t: number): SlotRect {
  const at = (a: number, b: number) => f32(a + (b - a) * t);
  return { left: at(from.left, to.left), top: at(from.top, to.top),
    right: at(from.right, to.right), bottom: at(from.bottom, to.bottom) };
}

/** Release f00. */
function normalizedUv(pixels: SlotRect, texture: SlotImage): SlotRect {
  return { left: f32(pixels.left / texture.width), top: f32(pixels.top / texture.height),
    right: f32(pixels.right / texture.width), bottom: f32(pixels.bottom / texture.height) };
}

const fullUv = (): SlotRect => ({ left: 0, top: 0, right: 1, bottom: 1 });

/** Release bx. */
export function slotPanel(node: SlotNode, textureName: string, texture: SlotImage,
  rect: SlotRect, uv: SlotRect): SlotPanelCommand {
  return { kind: "panel", node, textureName, texture, worldRect: rect,
    framebufferRect: offset(rect, -0.5, -0.5), uv };
}

/**
 * Release XJ for the speed booster ids (6, 14, -1), extended to any item idx.
 * `overlay` marks an item race: the 3-slot row then animates the 0↔1 swap,
 * and the lock overlay and countdown follow the icons.
 */
export function buildItemSlotCommands(definition: ItemSlotDefinition,
  slots: readonly number[], disabled: ArrayLike<unknown>, windowStartMs: number,
  timeMs: number, reorderProgress?: number,
  overlay?: ItemSlotOverlay): SlotPanelCommand[] {
  const frames: SlotPanelCommand[] = [];
  const icons: Array<SlotPanelCommand | undefined> = [];
  const count = slots.length;
  const animated = reorderProgress !== undefined &&
    (count === 2 || (overlay !== undefined && count === 3));
  slots.forEach((id, index) => {
    const frame = slotFrame(definition, index);
    const rect = itemSlotRect(definition, index, count);
    frames.push(slotPanel(frame.node, definition.frameTextureName, definition.frameTexture,
      rect, normalizedUv(frame.uvPixels, definition.frameTexture)));
    if (id === -1) return;
    const inset = grow(rect, -frame.adjust);
    const target = !animated || index > 1 ? inset
      : lerpRect(itemSlotIconRect(definition, 1 - index, count), inset,
        slotReorderEase(Math.max(0, Math.min(1, reorderProgress!))));
    if (id === 6 || id === 14) {
      const team = disabled[index]
        ? Math.floor((timeMs - windowStartMs) / 100) % 2 === 0 : id === 14;
      icons[index] = slotPanel(frame.node, team ? "item14" : "item6",
        team ? definition.teamBoostTexture : definition.boostTexture, target, fullUv());
      return;
    }
    const icon = definition.resources?.icon(id);
    if (icon) icons[index] = slotPanel(frame.node, `item${id}`, icon, target, fullUv());
  });
  const ordered = reorderProgress === undefined ? icons : [...icons].reverse();
  const commands = [...frames, ...ordered.filter(command => command !== undefined)];
  if (overlay) commands.push(...slotOverlayCommands(definition, count, overlay));
  return commands;
}

function slotOverlayCommands(definition: ItemSlotDefinition, count: number,
  overlay: ItemSlotOverlay): SlotPanelCommand[] {
  const commands: SlotPanelCommand[] = [];
  const resources = definition.resources;
  const freeze = resources?.freeze;
  if (overlay.locked && freeze) {
    for (let index = 0; index < count; index++) {
      const frame = slotFrame(definition, index);
      commands.push(slotPanel(frame.node, "freeze_slot", freeze,
        itemSlotRect(definition, index, count), normalizedUv(frame.uvPixels, freeze)));
    }
  }
  const timer = resources?.timer;
  const text = countdownText(overlay.countdownMs);
  if (timer && text !== undefined && count > 0)
    commands.push(...timerDigits(timer, text, itemSlotRect(definition, 0, count)));
  return commands;
}

/** Whole seconds left, rounded up ("3", "2", "1"); undefined when done. */
export function countdownText(remainingMs: number | undefined): string | undefined {
  if (remainingMs === undefined || !(remainingMs > 0)) return undefined;
  return String(Math.min(99, Math.ceil(remainingMs / 1000)));
}

/** slotTimer digits centred on a rect, one panel per glyph. */
export function timerDigits(timer: ItemSlotTimer, text: string,
  around: SlotRect): SlotPanelCommand[] {
  const width = timer.glyphWidth * text.length;
  const left = Math.floor((around.left + around.right - width) / 2);
  const top = Math.floor((around.top + around.bottom - timer.glyphHeight) / 2);
  const commands: SlotPanelCommand[] = [];
  for (let index = 0; index < text.length; index++) {
    const glyph = timer.glyphs.indexOf(text[index]!);
    if (glyph < 0) continue;
    const x = left + index * timer.glyphWidth;
    commands.push(slotPanel(timer.node, timer.textureName, timer.texture,
      { left: x, top, right: x + timer.glyphWidth, bottom: top + timer.glyphHeight },
      normalizedUv({ left: glyph * timer.glyphWidth, top: 0,
        right: (glyph + 1) * timer.glyphWidth, bottom: timer.glyphHeight }, timer.texture)));
  }
  return commands;
}
