export type GarageExceedChoice = 2 | 3 | 4 | "random";

export interface GarageExceedDialogAssets {
  exceedTypes?: Map<number, { textureType: number; accelLevel: number; timeLevel: number }>;
  urls: Map<string, string>;
}

export interface GarageExceedDialogDependencies {
  styleAction(button: HTMLButtonElement, style: unknown, kind: "primary" | "secondary"): void;
  loadStyles(library: unknown): Promise<{ actionStyles: Map<string, unknown> }>;
  resolveChoice(choice: GarageExceedChoice): number;
}

/** Native Garage Exceed Type chooser, including delayed action styles and confirmation. */
export class GarageExceedTypeDialog {
  readonly overlay = document.createElement("div");
  readonly panel = document.createElement("div");
  readonly action = document.createElement("button");
  readonly cancel = document.createElement("button");
  selected?: GarageExceedChoice;
  disposed = false;
  readonly previousFocus = document.activeElement instanceof HTMLElement
    ? document.activeElement : undefined;

  constructor(surface: HTMLElement, readonly assets: GarageExceedDialogAssets,
    library: unknown, current: { title: string; type: number },
    readonly onClose: (selected?: number) => void,
    readonly dependencies: GarageExceedDialogDependencies) {
    this.overlay.className = "garage-exceed-change garage-exceed-choice-dialog";
    this.panel.className = "garage-exceed-change-panel";
    this.panel.setAttribute("role", "dialog");
    this.panel.setAttribute("aria-modal", "true");
    this.panel.setAttribute("aria-label", "选择超负荷类型");
    const title = document.createElement("strong");
    title.className = "garage-exceed-change-title";
    title.textContent = "选择超负荷类型";
    const description = document.createElement("p");
    description.className = "garage-exceed-choice-description";
    description.textContent = `${current.title} · 当前类型 ${this.typeName(current.type)}`;
    const choices = document.createElement("div");
    choices.className = "garage-exceed-choice-grid";
    for (const choice of [2, 3, 4] as const)
      choices.append(this.choiceButton(choice, choices));
    choices.append(this.choiceButton("random", choices));
    this.action.type = "button";
    this.action.className = "garage-exceed-choice-action";
    dependencies.styleAction(this.action, undefined, "primary");
    this.action.textContent = "确定";
    this.action.disabled = true;
    this.action.onclick = () => {
      if (this.selected !== undefined && !this.disposed)
        this.showConfirmation(this.selected);
    };
    this.cancel.type = "button";
    this.cancel.className = "garage-exceed-choice-cancel";
    this.cancel.textContent = "取消";
    dependencies.styleAction(this.cancel, undefined, "secondary");
    this.cancel.onclick = () => this.close(undefined);
    const close = document.createElement("button");
    close.type = "button";
    close.className = "garage-exceed-change-close";
    close.textContent = "×";
    close.setAttribute("aria-label", "关闭超负荷类型选择");
    close.onclick = () => this.close(undefined);
    this.panel.append(title, description, choices, this.action, this.cancel, close);
    this.overlay.append(this.panel);
    surface.append(this.overlay);
    close.focus();
    void this.loadActionStyles(library);
    this.overlay.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        event.preventDefault();
        this.close(undefined);
      }
    });
  }

  choiceButton(choice: GarageExceedChoice, grid: HTMLElement): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "garage-exceed-choice";
    const id = choice === "random" ? 5 : choice;
    const record = this.assets.exceedTypes?.get(id);
    button.append(this.typeIcon(id, record));
    const name = document.createElement("strong");
    name.textContent = choice === "random" ? "随机" : this.typeName(id);
    const details = document.createElement("span");
    details.textContent = choice === "random"
      ? "在 S / B / L 中随机选择"
      : record
        ? `加速度 ${record.accelLevel}　时间 ${record.timeLevel}`
        : "类型资料缺失";
    button.append(name, details);
    button.onclick = () => {
      this.selected = choice;
      grid.querySelectorAll("button").forEach(candidate =>
        candidate.classList.toggle("selected", candidate === button));
      this.action.disabled = false;
    };
    return button;
  }

  async loadActionStyles(library: unknown): Promise<void> {
    try {
      const styles = await this.dependencies.loadStyles(library);
      if (this.disposed) return;
      this.dependencies.styleAction(this.action,
        styles.actionStyles.get("okButton"), "primary");
      this.dependencies.styleAction(this.cancel,
        styles.actionStyles.get("cancelButton"), "secondary");
    } catch { /* Style assets are optional while the dialog remains usable. */ }
  }

  typeName(type: number): string {
    return new Map([[2, "S"], [3, "B"], [4, "L"], [5, "随机"]])
      .get(type) ?? `类型 ${type}`;
  }

  typeIcon(type: number, record?: { textureType: number }): HTMLImageElement {
    const image = document.createElement("img");
    image.src = this.assets.urls.get(`icon_exceedB_${record?.textureType ?? type}`) ?? "";
    image.alt = this.typeName(type);
    return image;
  }

  showConfirmation(choice: GarageExceedChoice): void {
    const shade = document.createElement("div");
    shade.className = "garage-exceed-confirm-shade";
    const dialog = document.createElement("div");
    dialog.className = "garage-exceed-confirm garage-exceed-choice-confirm";
    const heading = document.createElement("strong");
    heading.textContent = "变更超负荷类型";
    const message = document.createElement("p");
    message.textContent = choice === "random"
      ? "将随机变更超负荷类型。\n确定继续吗？"
      : `确定将当前车辆的超负荷类型变更为 ${this.typeName(choice)} 吗？`;
    const confirm = document.createElement("button");
    const cancel = document.createElement("button");
    confirm.type = cancel.type = "button";
    confirm.textContent = "确定";
    cancel.textContent = "取消";
    confirm.className = "primary";
    confirm.onclick = () => this.close(this.dependencies.resolveChoice(choice));
    cancel.onclick = () => shade.remove();
    dialog.append(heading, message, confirm, cancel);
    shade.append(dialog);
    this.panel.append(shade);
    cancel.focus();
  }

  close(selected?: number): void {
    if (this.disposed) return;
    this.disposed = true;
    this.overlay.remove();
    this.onClose(selected);
    if (this.previousFocus?.isConnected) this.previousFocus.focus();
  }

  dispose(): void { this.close(undefined); }
}
