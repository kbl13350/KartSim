/**
 * Line icons for shop cards when no item preview renderer is available
 * (the original client has no 2D item icons; it renders the 3D model).
 * Static markup only; drawn with currentColor on a 64×48 grid.
 */
import type { ShopItem } from "./shop-catalog";

export type ShopArtGroup = "kart" | "character" | "pet" | "equip" | "etc";

const ICONS: Record<string, string> = {
  kart: '<path d="M8 30h6l4-9h18l8 6h10a4 4 0 0 1 4 4v3H8z"/><path d="M22 21l3-6h8"/><circle cx="18" cy="36" r="5"/><circle cx="48" cy="36" r="5"/>',
  character: '<circle cx="32" cy="15" r="9"/><path d="M16 44c1-10 8-15 16-15s15 5 16 15"/><path d="M25 13c3-4 11-4 14 0"/>',
  pet: '<ellipse cx="32" cy="32" rx="10" ry="8"/><circle cx="19" cy="20" r="4"/><circle cx="27" cy="12" r="4"/><circle cx="37" cy="12" r="4"/><circle cx="45" cy="20" r="4"/>',
  flyingPet: '<ellipse cx="32" cy="26" rx="7" ry="9"/><path d="M25 24C17 14 8 15 5 20c6 1 12 5 20 10"/><path d="M39 24c8-10 17-9 20-4-6 1-12 5-20 10"/><path d="M29 35l-2 6M35 35l2 6"/>',
  balloon: '<ellipse cx="32" cy="17" rx="11" ry="13"/><path d="M30 30h4l-2 3z"/><path d="M32 33c-3 4 3 7 0 12"/>',
  headBand: '<path d="M12 34c0-14 9-22 20-22s20 8 20 22"/><path d="M18 34c0-10 6-16 14-16s14 6 14 16"/><path d="M28 10l4-6 4 6"/>',
  goggle: '<rect x="8" y="16" width="20" height="16" rx="7"/><rect x="36" y="16" width="20" height="16" rx="7"/><path d="M28 23h8M4 22h4M56 22h4"/>',
  handGear: '<path d="M18 44V22a4 4 0 0 1 8 0v-8a4 4 0 0 1 8 0v8-4a4 4 0 0 1 8 0v8a4 4 0 0 1 8 0v8c0 6-5 10-10 10H18z"/>',
  color: '<rect x="20" y="16" width="20" height="28" rx="3"/><path d="M24 16v-5h12v5"/><path d="M36 8h8M44 4v8M48 6l4-2M48 10l4 2"/>',
  dye: '<path d="M32 6C26 16 20 23 20 31a12 12 0 0 0 24 0c0-8-6-15-12-25z"/><path d="M27 32a6 6 0 0 0 5 6"/>',
  aura: '<ellipse cx="32" cy="34" rx="22" ry="7"/><path d="M32 6v8M20 12l4 6M44 12l-4 6"/><circle cx="32" cy="22" r="3"/>',
  skidMark: '<path d="M6 38c10-12 20 4 30-8s16-14 22-12"/><path d="M6 30c10-12 20 4 30-8s16-14 22-12"/>',
  plate: '<rect x="6" y="14" width="52" height="22" rx="4"/><path d="M14 25h10M30 25h6M42 25h8"/><circle cx="12" cy="18" r="1"/><circle cx="52" cy="18" r="1"/>',
  etc: '<path d="M10 18l22-10 22 10v20L32 46 10 38z"/><path d="M10 18l22 10 22-10M32 28v18"/>',
};

const ICON_BY_KIND: Record<string, string> = {
  kart: "kart", character: "character", pet: "pet", flyingPet: "flyingPet", balloon: "balloon",
  headBand: "headBand", headPhone: "headBand", goggle: "goggle", handGearL: "handGear",
  color: "color", ridColor: "color", dye: "dye", aura: "aura", skidMark: "skidMark", plate: "plate",
};

export function artGroup(item: Pick<ShopItem, "kind" | "tab">): ShopArtGroup {
  if (item.kind === "kart") return "kart";
  if (item.kind === "character") return "character";
  if (item.kind === "pet" || item.kind === "flyingPet") return "pet";
  return item.tab === "equip" && ICON_BY_KIND[item.kind] ? "equip" : "etc";
}

/** SVG markup for the item's kind. */
export function kindIconMarkup(kind: string): string {
  const body = ICONS[ICON_BY_KIND[kind] ?? "etc"]!;
  return `<svg class="ks-shop-art-icon" viewBox="0 0 64 48" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}
