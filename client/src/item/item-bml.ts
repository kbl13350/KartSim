/** Generic reader for the original `item/<folder>/item.bml` state tables. */

export interface ItemXmlNode {
  readonly name: string;
  readonly attributes: readonly { name: string; value: string }[];
  readonly children: readonly ItemXmlNode[];
}

/** One `<state>` row; every attribute of the row is kept in `attributes`. */
export interface ItemState {
  readonly name: string;
  readonly lifeMs: number;
  /** Radius in track units (pickup, trigger or blast radius). */
  readonly size?: number;
  /** Model scale (abyssBarricade only). */
  readonly itemSize?: number;
  /** Model stems, resolved under `item/<folder>/` then `item/common/`. */
  readonly item?: string;
  readonly firing?: string;
  readonly fired?: string;
  /** Sound stems, resolved under `sound_/fx/item/<folder>/`. */
  readonly itemFx?: string;
  readonly firingFx?: string;
  readonly firedFx?: string;
  /** `auxFx0..3`, e.g. the rocket's aiming/inrange/ontarget/misfire cues. */
  readonly auxFx?: readonly string[];
  readonly preload?: string;
  readonly attributes: Readonly<Record<string, string>>;
}

/**
 * A variant ("base") is one full run of states. A file repeats its state list
 * once per variant; the release calls the first run base 0.
 */
export interface ItemBase {
  readonly index: number;
  readonly order: readonly ItemState[];
  readonly states: ReadonlyMap<string, ItemState>;
}

export interface ItemBml {
  /** The root `name`, which is not always the folder name (goldRocket -> rocket). */
  readonly name: string;
  readonly bases: readonly ItemBase[];
  /** `<repaint texture=…/>` rows of the water-dome items. */
  readonly repaint: readonly string[];
}

function attributeRecord(node: ItemXmlNode): Record<string, string> {
  const record: Record<string, string> = {};
  for (const { name, value } of node.attributes) {
    if (Object.hasOwn(record, name)) throw Error(`item.bml state 属性 ${name} 重复。`);
    record[name] = value;
  }
  return record;
}

function decimal(value: string, field: string, state: string): number {
  const parsed = Number(value);
  if (!/^\d+(?:\.\d+)?$/.test(value) || !Number.isFinite(parsed))
    throw Error(`item.bml ${state}.${field}=${value} 无效。`);
  return parsed;
}

function stem(value: string | undefined, field: string, state: string): string | undefined {
  if (value === undefined) return undefined;
  // Stems are file names; reject anything that could leave the item folder.
  if (value.length === 0 || /[\\/]|\.\./.test(value)) throw Error(`item.bml ${state}.${field}=${value} 无效。`);
  return value;
}

/** Parse one `<state>` row, validating the numeric and resource fields. */
export function parseItemState(node: ItemXmlNode): ItemState {
  const attributes = attributeRecord(node);
  const name = attributes.name;
  if (!name) throw Error("item.bml state 缺少 name。");
  if (attributes.life === undefined) throw Error(`item.bml ${name} 缺少 life。`);
  const lifeMs = decimal(attributes.life, "life", name);
  if (!Number.isSafeInteger(lifeMs)) throw Error(`item.bml ${name}.life 不是整数毫秒。`);
  const auxFx: string[] = [];
  for (let index = 0; attributes[`auxFx${index}`] !== undefined; index++)
    auxFx.push(stem(attributes[`auxFx${index}`], `auxFx${index}`, name)!);
  const state: { -readonly [Key in keyof ItemState]: ItemState[Key] } = { name, lifeMs, attributes };
  if (attributes.size !== undefined) state.size = decimal(attributes.size, "size", name);
  if (attributes.itemSize !== undefined) state.itemSize = decimal(attributes.itemSize, "itemSize", name);
  for (const field of ["item", "firing", "fired", "itemFx", "firingFx", "firedFx"] as const) {
    const value = stem(attributes[field], field, name);
    if (value !== undefined) state[field] = value;
  }
  if (auxFx.length > 0) state.auxFx = auxFx;
  if (attributes.preload !== undefined) state.preload = attributes.preload;
  return state;
}

/**
 * Split the state rows into variants: a state name that already occurs in the
 * current run starts the next base. This reproduces every original file's
 * repetition (all 103 definitions); trailing extra states such as lucci's
 * Cached/Eaten2/Drop stay in the last base.
 */
export function parseItemBml(root: ItemXmlNode): ItemBml {
  if (root.name !== "item") throw Error("item.bml 根节点必须是 <item>。");
  const name = root.attributes.find(attribute => attribute.name === "name")?.value;
  if (!name) throw Error("item.bml 缺少 item name。");
  const bases: ItemBase[] = [];
  const repaint: string[] = [];
  let current: ItemState[] = [];
  const close = () => {
    if (current.length === 0) return;
    bases.push({ index: bases.length, order: current,
      states: new Map(current.map(state => [state.name, state])) });
    current = [];
  };
  for (const child of root.children) {
    if (child.name === "repaint") {
      const texture = child.attributes.find(attribute => attribute.name === "texture")?.value;
      if (!texture) throw Error(`${name} item.bml repaint 缺少 texture。`);
      repaint.push(texture);
      continue;
    }
    if (child.name !== "state") throw Error(`${name} item.bml 含未知节点 ${child.name}。`);
    const state = parseItemState(child);
    if (current.some(entry => entry.name === state.name)) close();
    current.push(state);
  }
  close();
  if (bases.length === 0) throw Error(`${name} item.bml 没有 state。`);
  return { name, bases, repaint };
}
