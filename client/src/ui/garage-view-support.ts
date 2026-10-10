import type { GarageAssetNode } from "./garage-asset-bundle";

export interface GarageDrawOrderDependencies {
  attribute(node: GarageAssetNode, name: string): string | undefined;
  cache: WeakMap<GarageAssetNode, string[]>;
}

/** Keep native window order around the live kart preview surface. */
export function planGarageDrawOrder(root: GarageAssetNode,
  visible: string[], dependencies: GarageDrawOrderDependencies): {
  beforePreview: string[];
  afterPreview: string[];
} {
  let names = dependencies.cache.get(root);
  if (!names) {
    names = [];
    const collect = (node: GarageAssetNode): void => {
      const name = dependencies.attribute(node, "name");
      if (name) names!.push(name);
      node.children.forEach(collect);
    };
    collect(root);
    dependencies.cache.set(root, names);
  }
  const previewIndex = names.indexOf("kartPreview");
  if (previewIndex < 0 || visible.some(name => !names!.includes(name)))
    throw new Error("车库绘制窗口缺少原件顺序。");
  const ordered = [...visible].sort((left, right) =>
    names!.indexOf(left) - names!.indexOf(right));
  return {
    beforePreview: ordered.filter(name => names!.indexOf(name) < previewIndex),
    afterPreview: ordered.filter(name => names!.indexOf(name) > previewIndex),
  };
}

export interface GarageDefaultKart {
  itemId: number;
  systemKey: string;
  path: string;
}

export interface GarageDefaultPreviewOptions {
  catalog: { karts: GarageDefaultKart[] };
  library: unknown;
  speed: unknown;
  version?: unknown;
}

export interface GarageDefaultPreviewDependencies {
  defaultVersion: unknown;
  loadSpecification(library: unknown, path: string,
    systemKey: string): Promise<{ parameter: { value: unknown } }>;
  previewKey(kart: { itemId: number; systemKey: string }): string;
  createPreview(kart: { itemId: number; systemKey: string }, speed: unknown,
    parameter: unknown, version: unknown): unknown;
}

/** Preload authored zero-ID karts so each generation has a default preview. */
export async function loadGarageDefaultPreviews(
  options: GarageDefaultPreviewOptions,
  dependencies: GarageDefaultPreviewDependencies,
): Promise<Map<string, unknown>> {
  const previews = new Map<string, unknown>();
  await Promise.all(options.catalog.karts.filter(kart => kart.itemId === 0)
    .map(async kart => {
      const identity = { itemId: kart.itemId, systemKey: kart.systemKey };
      const specification = await dependencies.loadSpecification(options.library,
        kart.path, kart.systemKey);
      previews.set(dependencies.previewKey(identity),
        dependencies.createPreview(identity, options.speed,
          specification.parameter.value,
          options.version ?? dependencies.defaultVersion));
    }));
  return previews;
}

export interface GarageHoverTarget {
  disabled: boolean;
  addEventListener(type: string, callback: () => void): void;
}

/** Preview a card on hover or focus, and clear it when the pointer leaves. */
export function bindGarageHoverPreview(target: GarageHoverTarget,
  value: unknown, current: () => unknown,
  select: (value: unknown) => void): void {
  const enter = () => { if (!target.disabled) select(value); };
  const leave = () => { if (current() === value) select(undefined); };
  target.addEventListener("pointerenter", enter);
  target.addEventListener("focus", enter);
  target.addEventListener("pointerleave", leave);
  target.addEventListener("pointercancel", leave);
  target.addEventListener("blur", leave);
}
