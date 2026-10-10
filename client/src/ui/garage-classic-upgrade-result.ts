import type { GarageAssetNode, GarageAssetRect, GarageAssetEntry } from
  "./garage-asset-bundle";

export interface GarageClassicResultLibrary {
  exactCanonicalCandidates(path: string): GarageAssetEntry[];
}

export interface GarageClassicResultPanel {
  durationMs: number;
  dispose(): void;
}

export interface GarageClassicResultBitmap {
  width: number;
  height: number;
  close(): void;
}

export interface GarageClassicDrawContext {
  fillStyle: string;
  textAlign: string;
  textBaseline: string;
  font: string;
  clearRect(x: number, y: number, width: number, height: number): void;
  drawImage(image: GarageClassicResultBitmap, ...coordinates: number[]): void;
  save(): void;
  restore(): void;
  fillText(text: string, x: number, y: number, maxWidth: number): void;
}

export interface GarageClassicUpgradeSummary {
  beforeLevel: number;
  afterLevel: number;
  beforePoints: number;
  afterPoints: number;
}

export interface GarageClassicResultDependencies {
  directory: string;
  fontFamily: string;
  parseBml(bytes: Uint8Array): GarageAssetNode;
  attribute(node: GarageAssetNode, name: string): string | undefined;
  childRect(node: GarageAssetNode, parent: GarageAssetRect): GarageAssetRect;
  loadFont(library: GarageClassicResultLibrary): Promise<unknown>;
  unloadFont(font: unknown): void;
  loadScene(library: GarageClassicResultLibrary,
    request: { path: string; panel: GarageAssetNode },
    environment: unknown, stage: unknown): Promise<GarageClassicResultPanel>;
  createBitmap(blob: Blob): Promise<GarageClassicResultBitmap>;
}

export interface GarageClassicResultAssets {
  panel: GarageClassicResultPanel;
  rect: GarageAssetRect;
  preview: GarageAssetRect;
  accept: GarageAssetRect;
  dispose(): void;
  drawResult(context: GarageClassicDrawContext, title: string,
    summary: GarageClassicUpgradeSummary): void;
}

/** Load the classic upgrade scene, native layout and images used by its result page. */
export async function loadGarageClassicUpgradeResult(
  library: GarageClassicResultLibrary,
  environment: unknown,
  stage: unknown,
  dependencies: GarageClassicResultDependencies,
): Promise<GarageClassicResultAssets> {
  const required = (name: string): GarageAssetEntry => {
    const candidates = library.exactCanonicalCandidates(
      `${dependencies.directory}${name}`);
    if (candidates.length !== 1)
      throw new Error(`经典升级资源缺失或不唯一：${name}`);
    return candidates[0]!;
  };
  const definition = dependencies.parseBml(await required(
    "kartLevelUpResult@cn.bml").bytes());
  const success = definition.children.find(node =>
    dependencies.attribute(node, "name") === "success");
  const namedChild = (parent: GarageAssetNode | undefined,
    name: string): GarageAssetNode | undefined => parent?.children.find(node =>
      dependencies.attribute(node, "name") === name);
  const main = namedChild(success, "main");
  const effect = namedChild(success, "preEffect");
  const itemPanel = namedChild(success, "itemPanel");
  const acceptButton = namedChild(main, "okButton");
  if (!success || !main || !effect || !itemPanel || !acceptButton ||
      !dependencies.attribute(effect, "scene"))
    throw new Error("经典升级结果页布局不完整。");

  const rect = dependencies.childRect(success,
    { x: 0, y: 0, width: 1600, height: 900 });
  const localRect = { ...rect, x: 0, y: 0 };
  const preview = dependencies.childRect(itemPanel, rect);
  const images = new Map<string, GarageClassicResultBitmap>();
  const imageNames = new Set<string>();
  const collectImages = (node: GarageAssetNode): void => {
    const name = dependencies.attribute(node, "image") ??
      dependencies.attribute(node, "texture");
    if (name) imageNames.add(name);
    node.children.forEach(collectImages);
  };
  collectImages(main);

  let panel: GarageClassicResultPanel | undefined;
  let font: unknown;
  const dispose = (): void => {
    panel?.dispose();
    panel = undefined;
    images.forEach(image => image.close());
    images.clear();
    if (font) { dependencies.unloadFont(font); font = undefined; }
  };
  try {
    font = await dependencies.loadFont(library);
    const settled = await Promise.allSettled([
      dependencies.loadScene(library, {
        path: `${dependencies.directory}${dependencies.attribute(effect, "scene")}.1s`,
        panel: effect,
      }, environment, stage).then(loaded => { panel = loaded; }),
      ...[...imageNames].map(async name => {
        const bytes = await required(`${name}.png`).bytes();
        images.set(name, await dependencies.createBitmap(new Blob(
          [new Uint8Array(bytes)], { type: "image/png" })));
      }),
    ]);
    const failed = settled.find(result => result.status === "rejected");
    if (failed?.status === "rejected") throw failed.reason;
    if (!panel || !(panel.durationMs > 0 && panel.durationMs < 60_000))
      throw new Error("经典升级动画时间轴无效。");

    const nodes: Array<{ node: GarageAssetNode; rect: GarageAssetRect }> = [];
    const collectRects = (node: GarageAssetNode, parent: GarageAssetRect): void => {
      const bounds = dependencies.childRect(node, parent);
      nodes.push({ node, rect: bounds });
      node.children.forEach(child => collectRects(child, bounds));
    };
    collectRects(main, localRect);
    return {
      panel, rect, preview,
      accept: dependencies.childRect(acceptButton,
        dependencies.childRect(main, rect)),
      dispose,
      drawResult(context, title, summary) {
        context.clearRect(0, 0, rect.width, rect.height);
        for (const { node, rect: bounds } of nodes) {
          const imageName = dependencies.attribute(node, "image") ??
            dependencies.attribute(node, "texture");
          if (imageName) {
            const image = images.get(imageName)!;
            if (dependencies.attribute(node, "name") === "kartLevel") {
              const [digitWidth, digitHeight] = (
                dependencies.attribute(node, "fontSize") ?? "32 40")
                .split(/\s+/).map(Number);
              context.drawImage(image, summary.afterLevel * digitWidth!, 0,
                digitWidth!, digitHeight!, bounds.x, bounds.y,
                bounds.width, bounds.height);
            } else {
              context.drawImage(image, bounds.x, bounds.y,
                bounds.width, bounds.height);
            }
          }
          const name = dependencies.attribute(node, "name");
          const text = dependencies.attribute(node, "text");
          const lines = name === "kartName" ? [title] :
            name === "kartDesc" ? [
              `等级 Lv.${summary.beforeLevel} → Lv.${summary.afterLevel}`,
              `可用强化点 ${summary.beforePoints} → ${summary.afterPoints}`,
            ] : text === "#sb(levelUpResult)" ? ["升级结果"] : [];
          if (lines.length === 0) continue;
          context.save();
          context.fillStyle = "white";
          context.textAlign = "center";
          context.textBaseline = "middle";
          context.font = `${name === "kartDesc" ? 16 : 20}px "${dependencies.fontFamily}"`;
          lines.forEach((line, index) => context.fillText(line,
            bounds.x + bounds.width / 2,
            bounds.y + bounds.height / 2 + (index - (lines.length - 1) / 2) * 26,
            bounds.width));
          context.restore();
        }
      },
    };
  } catch (error) { dispose(); throw error; }
}
