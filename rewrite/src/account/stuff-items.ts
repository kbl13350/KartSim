/**
 * Counted items without a garage model: the item changer cards (category 7:
 * 道具换位卡, 道具变更卡 and their timed 使用券, rewrite/ITEM_MODE.md C.6),
 * boxes (category 24, opened with 开启), materials such as the 探险币 (34),
 * K币 items (56), 62 and parts fragments (67). Their CN names come from
 * zeta_/cn/shop/data/item.kml and their icons from stuff.rho
 * (etc_/itemTable.kml names the resource: <lottery id='1228'
 * name='탐험대배낭상자'/> -> stuff/lottery/탐험대배낭상자.png; the changer cards'
 * stuff/card/*.1s are models, so they are listed without an icon).
 */
import { x1 } from "../generated/formats.js";
import type { InventoryItem } from "./account-session";
import { remainingLabel } from "./ownership";

export const STUFF_CATEGORIES: ReadonlySet<number> = new Set([7, 24, 34, 56, 62, 67]);

/** The item changer cards (道具换位卡 7:1, 道具变更卡 7:2, 使用券 7:3 / 7:4). */
export const CHANGER_CATEGORY = 7;

/** Boxes, the only stuff 我的物品 can use (开启). */
export const BOX_CATEGORY = 24;

/** itemTable.kml element and stuff.rho folder of the categories with icons. */
const ICONS: Readonly<Record<number, { tag: string; folder: string }>> = {
  24: { tag: "lottery", folder: "stuff/lottery" },
  34: { tag: "material", folder: "stuff/material" },
};

export interface StuffInfo {
  name: string;
  /** The icon's resource path, when itemTable names one. */
  icon?: string;
}

interface XmlNode { name: string; attributes: Array<{ name: string; value: string }>; children: XmlNode[] }

export interface StuffLibrary {
  canonicalCandidates(path: string): Array<{ bytes(): Promise<Uint8Array> }>;
}

const attribute = (node: XmlNode, name: string): string | undefined =>
  node.attributes.find(item => item.name === name)?.value;

export const stuffKey = (category: number, itemId: number): string => `${category}:${itemId}`;

/** Names and icons of the counted categories from item.kml and itemTable.kml roots. */
export function parseStuffInfo(items: XmlNode, table: XmlNode): Map<string, StuffInfo> {
  const info = new Map<string, StuffInfo>();
  for (const node of items.children) {
    if (node.name !== "item") continue;
    const category = Number(attribute(node, "itemCatId"));
    const itemId = Number(attribute(node, "itemId"));
    if (!STUFF_CATEGORIES.has(category) || !Number.isInteger(itemId)) continue;
    info.set(stuffKey(category, itemId), { name: attribute(node, "itemName")?.trim() || String(itemId) });
  }
  for (const [category, { tag, folder }] of Object.entries(ICONS)) {
    for (const node of table.children) {
      if (node.name !== tag) continue;
      const itemId = Number(attribute(node, "id"));
      const name = attribute(node, "name")?.trim();
      const key = stuffKey(Number(category), itemId);
      if (!name || /[/\\]|\.\./.test(name)) continue;
      info.set(key, { name: info.get(key)?.name ?? String(itemId), icon: `${folder}/${name}.png` });
    }
  }
  return info;
}

const loaded = new WeakMap<object, Promise<Map<string, StuffInfo>>>();

export function loadStuffInfo(library: StuffLibrary): Promise<Map<string, StuffInfo>> {
  let pending = loaded.get(library);
  if (!pending) {
    const read = async (path: string): Promise<XmlNode> => {
      const file = library.canonicalCandidates(path)[0];
      if (!file) throw new Error(`缺少原版资源 ${path}`);
      return (x1(await file.bytes()) as { root: XmlNode }).root;
    };
    pending = Promise.all([read("zeta_/cn/shop/data/item.kml"), read("etc_/itemTable.kml")])
      .then(([items, table]) => parseStuffInfo(items, table));
    pending.catch(() => loaded.delete(library));
    loaded.set(library, pending);
  }
  return pending;
}

/** A counted item 我的物品 lists in its 精品道具 tab. */
export interface GarageStuffItem {
  kind: "stuff";
  category: number;
  itemId: number;
  title: string;
  quantity: number;
  icon?: string;
  ownershipLabel?: string;
  [key: string]: unknown;
}

/** The account's counted items with some left, in category and id order. */
export function garageStuffItems(inventory: readonly InventoryItem[], info: ReadonlyMap<string, StuffInfo>,
  now: number): GarageStuffItem[] {
  return inventory.filter(item => STUFF_CATEGORIES.has(item.category) && item.quantity > 0 &&
      (item.expiresAt === null || item.expiresAt === undefined || item.expiresAt > now))
    .sort((a, b) => a.category - b.category || a.itemId - b.itemId)
    .map(item => {
      const known = info.get(stuffKey(item.category, item.itemId));
      // A timed item (the changer vouchers) shows what is left of it.
      const left = item.expiresAt === null || item.expiresAt === undefined ? undefined
        : remainingLabel(item.expiresAt, now);
      return { kind: "stuff", category: item.category, itemId: item.itemId,
        title: known?.name ?? `${item.category}-${item.itemId}`, quantity: item.quantity,
        ...(known?.icon ? { icon: known.icon } : {}), ...(left ? { ownershipLabel: left } : {}) };
    });
}
