import type { GarageAssetNode, GarageAssetEntry } from "./garage-asset-bundle";

export interface GarageXunPanel {
  durationMs: number;
  dispose(): void;
}

export interface GarageXunPanelLibrary {
  exactCanonicalCandidates(path: string): GarageAssetEntry[];
}

export interface GarageXunPanelDependencies {
  directory: string;
  stages: readonly string[];
  parseBml(bytes: Uint8Array): GarageAssetNode;
  attribute(node: GarageAssetNode, name: string): string | undefined;
  loadScene(library: GarageXunPanelLibrary,
    request: { path: string; panel: GarageAssetNode },
    environment: unknown, stage: unknown): Promise<GarageXunPanel>;
}

/** Load the native Xun upgrade scenes in stage order, closing successful scenes on failure. */
export async function loadGarageXunUpgradePanels(
  library: GarageXunPanelLibrary,
  environment: unknown,
  stage: unknown,
  resultOnly: boolean,
  dependencies: GarageXunPanelDependencies,
): Promise<GarageXunPanel[]> {
  const candidates = library.exactCanonicalCandidates(
    `${dependencies.directory}kart12TuningLevelUpResult@zz.bml`);
  if (candidates.length !== 1)
    throw new Error("迅升级结果页资源缺失或不唯一。");
  const layout = dependencies.parseBml(await candidates[0]!.bytes());
  const page = layout.children.find(node =>
    dependencies.attribute(node, "name") === "1600");
  if (!page) throw new Error("迅升级结果页缺少 1600 布局。");

  const names = resultOnly ? ["successResult"] : dependencies.stages;
  const settled = await Promise.allSettled(names.map(async name => {
    const panel = page.children.find(node =>
      dependencies.attribute(node, "name") === name);
    const scene = panel && dependencies.attribute(panel, "scene");
    if (!panel || !scene) throw new Error(`升级动画缺少 ${name}`);
    const loaded = await dependencies.loadScene(library, {
      path: `${dependencies.directory}${scene}.1s`, panel,
    }, environment, stage);
    if (!(loaded.durationMs > 0 && loaded.durationMs < 60_000)) {
      loaded.dispose();
      throw new Error(`升级动画时间轴无效：${name}`);
    }
    return loaded;
  }));
  const failed = settled.find(result => result.status === "rejected");
  if (failed?.status === "rejected") {
    settled.forEach(result => {
      if (result.status === "fulfilled") result.value.dispose();
    });
    throw failed.reason;
  }
  return settled.map(result => (result as PromiseFulfilledResult<GarageXunPanel>).value);
}
