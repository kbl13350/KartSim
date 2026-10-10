/** Import, export, and track-switch workflow for the Ghost menu. */

export interface GhostImportSelection {
  trackId: string;
  speed: unknown;
  booster: unknown;
  version: unknown;
}

export interface GhostImportSource {
  record: { stamps: unknown[] };
}

export interface GhostImportResult {
  key: string;
  sources: GhostImportSource[];
  summary: Record<string, unknown>;
}

export interface GhostMenuOptions {
  currentGhostKey(): string | undefined;
  deleteGhost(key: string): Promise<unknown>;
  exportGhost?(key: string): Promise<unknown>;
  reportError(message: string): void;
  speedVersion(): unknown;
  resolveGhostKartTitle(kartId: unknown): Promise<string | undefined>;
  importGhost(key: string, sources: GhostImportSource[],
    summary: Record<string, unknown>, bytes: Uint8Array): Promise<unknown>;
  resolveGhostTrack(trackId: string): Promise<{
    track: { title: string; id: string };
    selection?: unknown;
  } | undefined>;
  selectGhostTrack(selection: unknown, speed: unknown, booster: unknown,
    version: unknown): Promise<unknown>;
}

export interface GhostMenuHost {
  options: GhostMenuOptions;
  input: { files?: ArrayLike<{ arrayBuffer(): Promise<ArrayBuffer> }> | null;
    value: string };
  disposed: boolean;
  importRevision: number;
  pendingTrackSwitch?: Promise<unknown>;
  isCurrentImport(revision: number): boolean;
  switchToImportedTrack(selection: GhostImportSelection, zCeiling: number,
    frameCount: number, revision: number): Promise<void>;
}

export interface GhostMenuImportDependencies {
  decodeKsv(bytes: Uint8Array): {
    info: { players: Array<{ equipment: { kart?: unknown } }> };
    zCeiling: number;
  };
  toGhostRecord(info: unknown, speedVersion: unknown): GhostImportResult;
  toSelection(info: unknown, speedVersion: unknown): GhostImportSelection;
  selectionLabel(selection: GhostImportSelection): string;
  mergeTrackSelection(selection: unknown,
    track: { title: string; id: string }): unknown;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function deleteGhostFromMenu(host: GhostMenuHost): Promise<void> {
  const key = host.options.currentGhostKey();
  if (!key) {
    host.options.reportError("当前地图没有记录，无法删除影子。");
    return;
  }
  try {
    await host.options.deleteGhost(key);
  } catch (error) {
    host.options.reportError(`删除失败：${errorMessage(error)}`);
  }
}

export async function exportGhostFromMenu(host: GhostMenuHost): Promise<void> {
  const key = host.options.currentGhostKey();
  if (!key) {
    host.options.reportError("当前地图没有记录，无法导出 KSV。 ");
    return;
  }
  try {
    if (!host.options.exportGhost) throw new Error("导出功能尚未就绪。 ");
    await host.options.exportGhost(key);
  } catch (error) {
    host.options.reportError(`导出失败：${errorMessage(error)}`);
  }
}

export function isCurrentGhostImport(host: GhostMenuHost,
  revision: number): boolean {
  return !host.disposed && host.importRevision === revision;
}

export async function importSelectedGhostFile(host: GhostMenuHost,
  dependencies: GhostMenuImportDependencies): Promise<void> {
  const file = host.input.files?.[0];
  if (!file || host.disposed) return;
  const revision = ++host.importRevision;
  const speedVersion = host.options.speedVersion();
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!host.isCurrentImport(revision)) return;
    const { info, zCeiling } = dependencies.decodeKsv(bytes);
    const imported = dependencies.toGhostRecord(info, speedVersion);
    const selection = dependencies.toSelection(info, speedVersion);
    const kartId = info.players[0]?.equipment.kart;
    const kartName = kartId === undefined ? ""
      : (await host.options.resolveGhostKartTitle(kartId)) ?? "";
    if (!host.isCurrentImport(revision)) return;
    await host.options.importGhost(imported.key, imported.sources,
      { ...imported.summary, kartName }, bytes);
    if (!host.isCurrentImport(revision)) return;
    const frameCount = Math.max(...imported.sources.map(source =>
      source.record.stamps.length));
    await host.switchToImportedTrack(selection, zCeiling, frameCount, revision);
  } catch (error) {
    if (host.isCurrentImport(revision)) {
      host.options.reportError(`导入失败：${errorMessage(error)}`);
    }
  } finally {
    if (host.isCurrentImport(revision)) host.input.value = "";
  }
}

export async function switchToImportedGhostTrack(host: GhostMenuHost,
  selection: GhostImportSelection, zCeiling: number, frameCount: number,
  revision: number,
  dependencies: GhostMenuImportDependencies): Promise<void> {
  const found = await host.options.resolveGhostTrack(selection.trackId);
  if (!host.isCurrentImport(revision)) return;
  if (!found) {
    host.options.reportError(
      `已导入影子：地图 ${selection.trackId} 不在当前目录，无法自动切换 ${dependencies.selectionLabel(selection)}（zCeiling ${zCeiling}，${frameCount} 帧）`,
    );
    return;
  }
  if (!found.selection) {
    host.options.reportError(
      `已导入影子：${found.track.title} (${found.track.id})；READY 未就绪，未能自动切换 ${dependencies.selectionLabel(selection)}（zCeiling ${zCeiling}，${frameCount} 帧）`,
    );
    return;
  }
  if (host.pendingTrackSwitch) {
    await host.pendingTrackSwitch.catch(() => {});
  }
  if (!host.isCurrentImport(revision)) return;
  const pending = host.options.selectGhostTrack(
    dependencies.mergeTrackSelection(found.selection, found.track),
    selection.speed, selection.booster, selection.version,
  );
  host.pendingTrackSwitch = pending;
  try {
    await pending;
  } finally {
    if (host.pendingTrackSwitch === pending) host.pendingTrackSwitch = undefined;
  }
}
