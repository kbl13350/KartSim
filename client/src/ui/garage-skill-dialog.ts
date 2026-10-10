import type { GaragePreviewRect } from "./garage-transform-preview";
import type { XunGarageProgression } from "./garage-progression-panel";
import type { GarageSkillSelectionState } from "./garage-progression-session";

export interface GarageSkillDialogAssets {
  rects: Map<string, GaragePreviewRect>;
  urls: Map<string, string>;
  headingStyle: { fontSize: number; color: string };
  cardIcon: GaragePreviewRect;
  cardName: GaragePreviewRect;
  cardTag: GaragePreviewRect;
  cards: Map<number, GaragePreviewRect>;
  actionStyles: Map<string, unknown>;
}

export interface GarageSkillDialogDependencies {
  createState(progression: XunGarageProgression, row: number): GarageSkillSelectionState;
  loadAssets(library: unknown): Promise<GarageSkillDialogAssets>;
  styleAction(button: HTMLButtonElement, style: unknown,
    kind: "primary" | "secondary"): void;
  availablePoints(progression: XunGarageProgression): number;
  skills: readonly { id: number; label: string }[];
}

/** Editable, accessible XUN skill picker backed by an uncommitted selection state. */
export class GarageSkillSelectionDialog {
  readonly element = document.createElement("div");
  readonly panel = document.createElement("div");
  readonly status = document.createElement("div");
  readonly accept = document.createElement("button");
  readonly cancel = document.createElement("button");
  readonly choices = new Map<number, HTMLButtonElement>();
  readonly previousFocus = document.activeElement instanceof HTMLElement
    ? document.activeElement : undefined;
  readonly state: GarageSkillSelectionState;
  assets?: GarageSkillDialogAssets;
  disposed = false;

  constructor(surface: HTMLElement, library: unknown, progression: XunGarageProgression,
    readonly row: number, readonly onClose: (value?: XunGarageProgression) => void,
    readonly dependencies: GarageSkillDialogDependencies) {
    if (!Number.isInteger(row) || row < 0 || row > 2)
      throw new Error("无效的技能栏。");
    this.state = dependencies.createState(progression, row);
    this.element.className = "garage-skill-selection";
    this.panel.className = "garage-skill-selection-panel";
    this.panel.setAttribute("role", "dialog");
    this.panel.setAttribute("aria-label", "迅竞速技能选择");
    this.panel.setAttribute("aria-modal", "true");
    this.status.className = "garage-skill-selection-status";
    this.status.setAttribute("role", "status");
    this.status.textContent = "正在加载原版技能卡片…";
    this.accept.type = this.cancel.type = "button";
    this.accept.textContent = "变更";
    this.accept.disabled = true;
    this.cancel.textContent = "取消";
    this.accept.onclick = () => {
      if (this.assets && this.state.changed) this.close(true);
    };
    this.cancel.onclick = () => this.close(false);
    this.place(this.accept, { x: 225, y: 655, width: 146, height: 42 });
    this.place(this.cancel, { x: 380, y: 655, width: 146, height: 42 });
    this.panel.append(this.status);
    this.element.append(this.panel);
    surface.append(this.element);
    this.cancel.focus();
    this.element.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        this.close(false);
      }
      if (event.key === "Tab") {
        event.preventDefault();
        const buttons = [...this.panel.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        buttons[(index + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length]?.focus();
      }
    });
    void this.load(library);
  }

  place(element: HTMLElement, rect: GaragePreviewRect): void {
    Object.assign(element.style, {
      position: "absolute", left: `${rect.x}px`, top: `${rect.y}px`,
      width: `${rect.width}px`, height: `${rect.height}px`,
    });
    this.panel.append(element);
  }

  async load(library: unknown): Promise<void> {
    try {
      const assets = await this.dependencies.loadAssets(library);
      if (this.disposed) return;
      this.assets = assets;
      this.build(assets);
      this.refresh();
      this.choices.get(this.state.value.skills[this.row]!.id)?.focus();
    } catch (error) {
      this.assets = undefined;
      this.accept.disabled = true;
      if (!this.disposed)
        this.status.textContent = `技能资源加载失败，请取消后重试：${error instanceof Error ? error.message : error}`;
    }
  }

  build(assets: GarageSkillDialogAssets): void {
    const rect = (name: string) => assets.rects.get(name)!;
    const container = rect("/container");
    Object.assign(this.panel.style, {
      width: `${container.width}px`, height: `${container.height}px`,
      left: `${(1600 - container.width) / 2}px`,
      top: `${(834 - container.height) / 2}px`,
      backgroundImage: `url("${assets.urls.get("tuning_selectperformPopupBg_s")}")`,
    });
    const heading = document.createElement("strong");
    heading.className = "garage-skill-selection-heading";
    heading.style.fontSize = `${assets.headingStyle.fontSize}px`;
    heading.style.color = assets.headingStyle.color;
    const slot = document.createElement("span");
    slot.textContent = `性能槽${this.row + 1}`;
    const title = document.createElement("span");
    title.textContent = "性能选择";
    heading.append(slot, title);
    this.place(heading, rect("/container/skillTuningCaption"));
    this.buildModeTabs(assets);
    const guidance = document.createElement("div");
    guidance.className = "garage-skill-selection-local";
    guidance.textContent = "竞速：九选三，不可重复 · 本次仅更换当前性能槽 · 本地不消耗材料";
    this.place(guidance, { x: 15, y: 88, width: 718, height: 35 });
    const close = document.createElement("button");
    close.type = "button";
    close.className = "garage-native-button";
    close.setAttribute("aria-label", "关闭技能选择");
    for (let state = 1; state <= 4; state++)
      close.style.setProperty(`--button-${state}`,
        `url("${assets.urls.get(`tuningPopup_x_${state}`)}")`);
    close.onclick = () => this.close(false);
    this.place(close, rect("/container/closeButton"));
    for (let index = 0; index < 3; index++) {
      const line = rect(`/container/skillTuning/speedPage/skillLine${index + 1}`);
      const marker = document.createElement("img");
      marker.src = assets.urls.get(`tuning_selectperform_mark${index + 1}`)!;
      marker.alt = `第${index + 1}栏`;
      this.place(marker, { x: line.x + 100, y: line.y + 53, width: 76, height: 76 });
    }
    for (const skill of this.dependencies.skills) {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "garage-skill-card";
      card.setAttribute("aria-label", skill.label);
      card.style.setProperty("--card-normal",
        `url("${assets.urls.get("tuning_selectperform_slotBg_s")}")`);
      card.style.setProperty("--card-selected",
        `url("${assets.urls.get("tuning_selectperform_slotBg_c")}")`);
      const icon = document.createElement("img");
      icon.src = assets.urls.get(`tuning_icon_${skill.id}`)!;
      icon.alt = "";
      const name = document.createElement("span");
      name.textContent = skill.label;
      for (const [element, bounds] of [
        [icon, assets.cardIcon], [name, assets.cardName],
      ] as Array<[HTMLElement, GaragePreviewRect]>) {
        Object.assign(element.style, {
          position: "absolute", left: `${bounds.x}px`, top: `${bounds.y}px`,
          width: `${bounds.width}px`, height: `${bounds.height}px`,
        });
        card.append(element);
      }
      const equipped = this.state.equippedSlot(skill.id);
      if (equipped) {
        const marker = document.createElement("img");
        marker.src = assets.urls.get(`tuning_slotNum_0${equipped}`)!;
        marker.alt = `性能槽${equipped}已装备`;
        Object.assign(marker.style, {
          position: "absolute", left: `${assets.cardTag.x}px`,
          top: `${assets.cardTag.y}px`, width: `${assets.cardTag.width}px`,
          height: `${assets.cardTag.height}px`,
        });
        card.append(marker);
        card.title = `性能槽${equipped}已装备${equipped === this.row + 1
          ? "（当前槽）" : "，不可重复选择"}`;
      }
      const selectedEffect = document.createElement("img");
      selectedEffect.className = "garage-skill-card-selected-effect";
      selectedEffect.src = assets.urls.get("tuning_selectperform_slotBg_c_effect")!;
      selectedEffect.alt = "";
      Object.assign(selectedEffect.style, {
        position: "absolute", inset: "0", width: "116px", height: "116px",
      });
      card.append(selectedEffect, name);
      card.disabled = this.state.isOccupied(skill.id);
      card.onclick = () => {
        if (this.assets && !this.disposed) {
          this.state.choose(skill.id);
          this.refresh();
        }
      };
      this.choices.set(skill.id, card);
      this.place(card, assets.cards.get(skill.id)!);
    }
    this.place(this.accept, rect("/container/okButton"));
    this.place(this.cancel, rect("/container/cancelButton"));
    this.dependencies.styleAction(this.accept, assets.actionStyles.get("okButton"), "primary");
    this.dependencies.styleAction(this.cancel, assets.actionStyles.get("cancelButton"), "secondary");
  }

  buildModeTabs(assets: GarageSkillDialogAssets): void {
    for (const [name, label, current] of [
      ["speedPage", "竞速", true], ["itemPage", "道具", false],
    ] as Array<[string, string, boolean]>) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "garage-skill-mode-tab";
      button.textContent = label;
      button.setAttribute("aria-label", current ? "竞速技能（当前）" : "道具技能（未开放）");
      button.setAttribute("aria-pressed", String(current));
      button.disabled = !current;
      button.title = current ? "当前仅支持计时赛竞速技能" : "道具赛技能不在本次实现范围";
      button.style.backgroundImage = `url("${assets.urls.get(
        `tuning_selectperformPopup_tab_${current ? 3 : 1}`)}")`;
      this.place(button, assets.rects.get(`/container/skillTuning/gameType/${name}`)!);
    }
  }

  refresh(): void {
    const value = this.state.value;
    this.choices.forEach((button, id) =>
      button.setAttribute("aria-pressed", String(value.skills[this.row]!.id === id)));
    this.accept.disabled = !this.state.changed;
    this.status.textContent = `本次返还 ${this.state.refunded} 点强化点数，确认后可用 ${this.dependencies.availablePoints(value)} 点强化点数。
关闭或取消不修改。`;
  }

  close(accept: boolean): void {
    if (this.disposed) return;
    const value = this.state.settle(accept);
    this.dispose();
    this.onClose(value);
    if (this.previousFocus?.isConnected) this.previousFocus.focus();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.state.settle(false);
    this.assets = undefined;
    this.element.remove();
  }
}
