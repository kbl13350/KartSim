import {
  deleteGhostFromMenu, exportGhostFromMenu, importSelectedGhostFile,
  isCurrentGhostImport, switchToImportedGhostTrack,
  type GhostImportSelection, type GhostMenuHost,
  type GhostMenuImportDependencies, type GhostMenuOptions,
} from "./ghost-menu-import";

export type GhostSamplingMode = "native" | "native-smooth" | "c1" | "c2";

export interface GhostMenuPanelOptions extends GhostMenuOptions {
  root: HTMLElement;
  samplingMode(): GhostSamplingMode;
  onSamplingModeChange(mode: GhostSamplingMode): void;
  resetNickname(): void;
}

export interface GhostMenuPanelDependencies {
  samplingLabels: Record<GhostSamplingMode, string>;
  nextSamplingMode(mode: GhostSamplingMode): GhostSamplingMode;
  saveSamplingMode(mode: GhostSamplingMode): void;
  import: GhostMenuImportDependencies;
}

/** The in-game Ghost import/export controls attached to the Ready screen. */
export class GhostMenuPanel implements GhostMenuHost {
  readonly panel: HTMLDivElement;
  readonly importButton: HTMLButtonElement;
  readonly deleteButton: HTMLButtonElement;
  readonly exportButton: HTMLButtonElement;
  readonly samplingModeButton: HTMLButtonElement;
  readonly resetNicknameButton: HTMLButtonElement;
  readonly input: HTMLInputElement;
  disposed = false;
  importRevision = 0;
  pendingTrackSwitch?: Promise<unknown>;

  constructor(
    readonly options: GhostMenuPanelOptions,
    readonly dependencies: GhostMenuPanelDependencies,
  ) {
    this.panel = document.createElement("div");
    this.panel.className = "touch-ghost-panel";
    this.importButton = document.createElement("button");
    this.importButton.type = "button";
    this.importButton.textContent = "导入影子(.ksv)";
    const hint = document.createElement("div");
    hint.textContent =
      "S0 / L2 等同字节档位，按“速度频道设置”的现代／复古版本导入；请先选对应版本。";
    this.deleteButton = document.createElement("button");
    this.deleteButton.type = "button";
    this.deleteButton.textContent = "删除影子";
    this.exportButton = document.createElement("button");
    this.exportButton.type = "button";
    this.exportButton.textContent = "导出 KSV";
    this.samplingModeButton = document.createElement("button");
    this.samplingModeButton.type = "button";
    this.refreshSamplingModeLabel();
    this.resetNicknameButton = document.createElement("button");
    this.resetNicknameButton.type = "button";
    this.resetNicknameButton.textContent = "重置车手名";
    this.input = document.createElement("input");
    this.input.type = "file";
    this.input.accept = ".ksv";
    this.input.hidden = true;
    this.importButton.addEventListener("click", this.openPicker);
    this.deleteButton.addEventListener("click", this.onDeleteClick);
    this.exportButton.addEventListener("click", this.onExportClick);
    this.samplingModeButton.addEventListener("click", this.onSamplingModeToggle);
    this.resetNicknameButton.addEventListener("click", options.resetNickname);
    this.input.addEventListener("change", this.onFileSelected);
    this.panel.append(this.importButton, hint, this.exportButton,
      this.deleteButton, this.samplingModeButton, this.resetNicknameButton,
      this.input);
    options.root.append(this.panel);
  }

  static attach(options: GhostMenuPanelOptions,
    dependencies: GhostMenuPanelDependencies): GhostMenuPanel {
    return new GhostMenuPanel(options, dependencies);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.importButton.removeEventListener("click", this.openPicker);
    this.deleteButton.removeEventListener("click", this.onDeleteClick);
    this.exportButton.removeEventListener("click", this.onExportClick);
    this.samplingModeButton.removeEventListener("click", this.onSamplingModeToggle);
    this.resetNicknameButton.removeEventListener("click", this.options.resetNickname);
    this.input.removeEventListener("change", this.onFileSelected);
    this.panel.remove();
  }

  refreshSamplingModeLabel(): void {
    const mode = this.options.samplingMode();
    this.samplingModeButton.textContent =
      `幽灵插值：${this.dependencies.samplingLabels[mode]}`;
    this.samplingModeButton.setAttribute("aria-pressed", String(mode !== "native"));
  }

  onSamplingModeToggle = (): void => {
    const next = this.dependencies.nextSamplingMode(this.options.samplingMode());
    this.dependencies.saveSamplingMode(next);
    this.refreshSamplingModeLabel();
    this.options.onSamplingModeChange(next);
  };

  openPicker = (): void => {
    this.input.value = "";
    this.input.click();
  };
  onFileSelected = (): void => { void this.importSelectedFile(); };
  onDeleteClick = (): void => { void this.deleteGhost(); };
  onExportClick = (): void => { void this.exportGhost(); };

  deleteGhost(): Promise<void> { return deleteGhostFromMenu(this); }
  exportGhost(): Promise<void> { return exportGhostFromMenu(this); }
  importSelectedFile(): Promise<void> {
    return importSelectedGhostFile(this, this.dependencies.import);
  }
  isCurrentImport(revision: number): boolean {
    return isCurrentGhostImport(this, revision);
  }
  switchToImportedTrack(selection: GhostImportSelection, zCeiling: number,
    frameCount: number, revision: number): Promise<void> {
    return switchToImportedGhostTrack(this, selection, zCeiling, frameCount,
      revision, this.dependencies.import);
  }
}
