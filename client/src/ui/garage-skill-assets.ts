import type { GarageAssetNode, GarageAssetRect, GarageAssetEntry } from
  "./garage-asset-bundle";

export interface GarageSkillAssetsLibrary {
  exactCanonicalCandidates(path: string): GarageAssetEntry[];
}

export interface GarageSkillBitmap {
  width: number;
  height: number;
  close(): void;
}

export interface GarageSkillAssetsDependencies {
  directory: string;
  imageNames: readonly string[];
  parseBml(bytes: Uint8Array): GarageAssetNode;
  attribute(node: GarageAssetNode | undefined,
    name: string): string | undefined;
  childRect(node: GarageAssetNode, parent: GarageAssetRect): GarageAssetRect;
  createBitmap(blob: Blob): Promise<GarageSkillBitmap>;
  createObjectUrl(blob: Blob): string;
  revokeObjectUrl(url: string): void;
}

export interface GarageSkillActionStyle {
  fontSize: number;
  colors: string[];
}

/** Decode native skill selection art, slot rectangles and text styles. */
export async function loadGarageSkillAssets(library: GarageSkillAssetsLibrary,
  dependencies: GarageSkillAssetsDependencies) {
  const required = (name: string): GarageAssetEntry => {
    const candidates = library.exactCanonicalCandidates(
      `${dependencies.directory}${name}`);
    if (candidates.length !== 1)
      throw new Error(`技能选择资源缺失或不唯一：${name}`);
    return candidates[0]!;
  };
  const [window, card] = await Promise.all([
    "kart12SkillTuning@zz.bml", "speedSkillTuningCard.bml",
  ].map(async name => dependencies.parseBml(await required(name).bytes())));
  const urls = new Map<string, string>();
  const imageSizes = new Map<string, { width: number; height: number }>();
  const dispose = () => {
    urls.forEach(url => dependencies.revokeObjectUrl(url));
    urls.clear();
  };
  try {
    const loaded = await Promise.allSettled(dependencies.imageNames.map(async name => {
      const blob = new Blob([new Uint8Array(
        await required(`${name}.png`).bytes())], { type: "image/png" });
      const bitmap = await dependencies.createBitmap(blob);
      try {
        imageSizes.set(name, { width: bitmap.width, height: bitmap.height });
        urls.set(name, dependencies.createObjectUrl(blob));
      } finally { bitmap.close(); }
    }));
    const failed = loaded.find(result => result.status === "rejected");
    if (failed?.status === "rejected") throw failed.reason;

    const container = window!.children.find(node =>
      dependencies.attribute(node, "name") === "container");
    if (!container) throw new Error("技能窗口缺少 container。");
    const rects = new Map<string, GarageAssetRect>();
    const popupSize = imageSizes.get("tuning_selectperformPopupBg_s");
    const collectRects = (node: GarageAssetNode, parent: GarageAssetRect,
      parentPath: string): void => {
      const name = dependencies.attribute(node, "name") ?? node.name;
      const path = `${parentPath}/${name}`;
      const rect = dependencies.childRect(node, parent);
      rects.set(path, rect);
      node.children.forEach(child => collectRects(child, rect, path));
    };
    collectRects(container, { x: 0, y: 0, ...popupSize } as GarageAssetRect, "");
    const rect = (path: string): GarageAssetRect => {
      const value = rects.get(path);
      if (!value) throw new Error(`技能窗口缺少 ${path}`);
      return value;
    };
    const cards = new Map<number, GarageAssetRect>();
    for (let slot = 1; slot <= 9; slot++) {
      const placement = rect(
        `/container/skillTuning/speedPage/skillLine${Math.ceil(slot / 3)}/${slot}`);
      cards.set(slot, { ...placement,
        ...imageSizes.get("tuning_selectperform_slotBg_s") });
    }
    const cardRect = (name: string): GarageAssetRect => {
      const part = card!.children.find(node =>
        dependencies.attribute(node, "name") === name);
      if (!part) throw new Error(`技能卡片缺少 ${name}`);
      return dependencies.childRect(part,
        { x: 0, y: 0, width: 0, height: 0 });
    };
    const descendant = (node: GarageAssetNode,
      name: string): GarageAssetNode | undefined => {
      if (dependencies.attribute(node, "name") === name) return node;
      for (const child of node.children) {
        const found = descendant(child, name);
        if (found) return found;
      }
      return undefined;
    };
    const caption = descendant(container, "skillTuningCaption");
    if (!caption) throw new Error("技能窗口缺少标题样式。");
    const captionFont = dependencies.attribute(caption, "textRender") ?? "bold20";
    const headingSize = Number(captionFont.match(/\d+/)?.[0] ?? 20);
    const captionColor = dependencies.attribute(caption, "textColor") ?? "white";
    const colorComponents = captionColor.split(/\s+/).map(Number);
    const headingColor = captionColor === "white" ? "#fff" :
      colorComponents.length === 4 && colorComponents.every(Number.isFinite) ?
        `rgba(${colorComponents[1]}, ${colorComponents[2]}, ` +
          `${colorComponents[3]}, ${colorComponents[0]! / 255})` :
        captionColor;
    const actionColor = (value: string | undefined, fallback: string): string => {
      if (!value) return fallback;
      if (value === "white" || value === "black") return value;
      const [alpha, red, green, blue] = value.split(/\s+/).map(Number);
      return [alpha, red, green, blue].every(Number.isFinite) ?
        `rgba(${red}, ${green}, ${blue}, ${alpha! / 255})` : fallback;
    };
    const actionStyles = new Map<string, GarageSkillActionStyle>();
    for (const name of ["okButton", "cancelButton"]) {
      const button = descendant(container, name);
      actionStyles.set(name, {
        fontSize: Number((dependencies.attribute(button, "textRender") ?? "bold16")
          .match(/\d+/)?.[0] ?? 16),
        colors: [
          actionColor(dependencies.attribute(button, "textColor"),
            name === "okButton" ? "white" : "#404b5f"),
          actionColor(dependencies.attribute(button, "overTextColor"),
            name === "okButton" ? "white" : "#6a7893"),
          actionColor(dependencies.attribute(button, "clickedTextColor"),
            "#182b48"),
          actionColor(dependencies.attribute(button, "disabledTextColor"),
            "#838383"),
        ],
      });
    }
    for (const name of ["closeButton", "okButton", "cancelButton"])
      rect(`/container/${name}`);
    for (const name of ["speedPage", "itemPage"])
      rect(`/container/skillTuning/gameType/${name}`);
    return {
      rects, cards,
      cardIcon: cardRect("skillIcon"),
      cardName: cardRect("skillName"),
      cardTag: cardRect("curSkillSlotTag"),
      headingStyle: {
        fontSize: headingSize,
        color: headingColor,
        align: dependencies.attribute(caption, "textAlign") ?? "center,vcenter",
      },
      actionStyles, urls, dispose,
    };
  } catch (error) { dispose(); throw error; }
}
