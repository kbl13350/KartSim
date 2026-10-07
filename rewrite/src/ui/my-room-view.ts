import type { LocalProfile, MyRoomProfile } from "./local-profile";
import { validateMyRoomProfile } from "./local-profile";
import type { MyRoomEnvironment } from "./my-room-catalog";
import { MyRoomSceneView, type MyRoomSceneLibrary,
  type MyRoomSceneSubject } from "./my-room-scene";

export interface MyRoomViewOptions {
  root: HTMLElement;
  library: MyRoomSceneLibrary;
  subject?: MyRoomSceneSubject;
  environments: readonly MyRoomEnvironment[];
  profile: LocalProfile;
  onProfileChange(profile: LocalProfile): void;
  onOpenInventory(): Promise<void> | void;
  onClose(): void;
}

const styles = `
.ks-myroom{position:absolute;inset:0 0 7.333333%;z-index:70;display:block;box-sizing:border-box;background:#102b49;color:#f4f8ff;font:16px/1.5 system-ui,sans-serif;}
.ks-myroom *{box-sizing:border-box}.ks-myroom[hidden]{display:none}
.ks-myroom-shell{position:relative;width:100%;height:100%;overflow:hidden;background:#152b4a}
.ks-myroom-header{position:absolute;z-index:4;top:0;left:0;right:0;display:flex;align-items:center;gap:12px;padding:12px 18px;background:linear-gradient(100deg,#175695e8,#102943e8);border-bottom:1px solid #6fb6eb;backdrop-filter:blur(8px)}
.ks-myroom-header h1{font-size:24px;margin:0;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ks-myroom-subtitle{font-size:13px;color:#c2d9ef}.ks-myroom button,.ks-myroom select,.ks-myroom input,.ks-myroom textarea{font:inherit}
.ks-myroom button{border:1px solid #88cafa;border-radius:9px;background:#15578e;color:white;padding:8px 15px;cursor:pointer}.ks-myroom button:hover{background:#2175b2}.ks-myroom button:focus-visible,.ks-myroom select:focus-visible,.ks-myroom input:focus-visible,.ks-myroom textarea:focus-visible{outline:3px solid #ffe082;outline-offset:2px}
.ks-myroom-body,.ks-myroom-scene-area,.ks-myroom-scene{position:absolute;inset:0;overflow:hidden}
.ks-myroom-scene{background:#102b49}
.ks-myroom-scene-label{position:absolute;left:18px;bottom:18px;z-index:1;padding:8px 12px;border-radius:8px;background:#102b49da;font-weight:700;pointer-events:none}
.ks-myroom-hint{position:absolute;right:18px;bottom:18px;z-index:1;margin:0;padding:8px 12px;border-radius:8px;background:#102b49da;pointer-events:none}
.ks-myroom-side{position:absolute;z-index:5;top:76px;right:18px;bottom:18px;width:min(360px,calc(100% - 36px));display:flex;flex-direction:column;gap:16px;overflow:auto;padding:1px}
.ks-myroom-side[hidden]{display:none}.ks-myroom-card{padding:18px;border:1px solid #6f9dbd;border-radius:13px;background:#204366f2;box-shadow:0 10px 30px #06182faa}.ks-myroom-card h2{margin:0 0 12px;font-size:17px}.ks-myroom-card p{margin:0 0 12px;color:#d8e8f5}
.ks-myroom-field{display:block;margin:11px 0;color:#d9eafa;font-size:14px}.ks-myroom-field input,.ks-myroom-field select,.ks-myroom-field textarea{display:block;width:100%;margin-top:5px;padding:9px;border:1px solid #a6c8df;border-radius:8px;background:#f7fbff;color:#143047}.ks-myroom-field textarea{min-height:70px;resize:vertical}
.ks-myroom-actions{display:flex;gap:10px;flex-wrap:wrap}.ks-myroom-status{min-height:23px;color:#ffeeb8;font-size:14px}.ks-myroom-status[role=alert]{color:#ffb9b9}
@media(max-width:700px){.ks-myroom-header{gap:6px;padding:8px}.ks-myroom-header h1{font-size:18px}.ks-myroom-header .ks-myroom-subtitle{display:none}.ks-myroom-header button{padding:6px 8px;font-size:13px}.ks-myroom-side{top:57px;right:8px;bottom:8px;width:min(360px,calc(100% - 16px))}.ks-myroom-hint{right:8px;bottom:62px;font-size:12px}.ks-myroom-scene-label{left:8px;bottom:8px;font-size:12px}}
`;

function node<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string,
  text?: string): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

/** A local My Room screen backed by the original environment catalog and scene models. */
export class MyRoomView {
  readonly element = node("section", "ks-myroom");
  readonly title = node("h1");
  readonly scene = node("div", "ks-myroom-scene");
  readonly sceneLabel = node("span", "ks-myroom-scene-label");
  readonly settingsPanel = node("aside", "ks-myroom-side");
  readonly settingsButton = node("button", undefined, "管理");
  readonly nameInput = node("input");
  readonly messageInput = node("textarea");
  readonly environmentSelect = node("select");
  readonly status = node("p", "ks-myroom-status");
  readonly closeButton = node("button", undefined, "返回");
  private profile: LocalProfile;
  private readonly previousFocus = document.activeElement instanceof HTMLElement
    ? document.activeElement : undefined;
  private disposed = false;
  private inventoryOpen = false;
  private sceneView?: MyRoomSceneView;

  constructor(readonly options: MyRoomViewOptions) {
    this.profile = options.profile;
    this.element.hidden = true;
    this.element.setAttribute("role", "region");
    this.element.setAttribute("aria-label", "我的小屋");
    const style = node("style");
    style.textContent = styles;
    const shell = node("div", "ks-myroom-shell");
    const header = node("header", "ks-myroom-header");
    const subtitle = node("span", "ks-myroom-subtitle", "原版小屋场景");
    this.closeButton.type = "button";
    this.closeButton.addEventListener("click", options.onClose);
    const openInventory = node("button", undefined, "我的物品");
    openInventory.type = "button";
    openInventory.addEventListener("click", () => {
      if (this.inventoryOpen) return;
      this.inventoryOpen = true;
      void Promise.resolve().then(() => options.onOpenInventory()).catch(error => {
        this.inventoryOpen = false;
        this.setStatus(`打开我的物品失败：${String(error)}`, true);
      });
    });
    this.settingsButton.type = "button";
    this.settingsButton.setAttribute("aria-controls", "ks-myroom-settings");
    this.settingsButton.setAttribute("aria-expanded", "false");
    this.settingsButton.addEventListener("click", () => {
      this.settingsPanel.hidden = !this.settingsPanel.hidden;
      this.settingsButton.setAttribute("aria-expanded", String(!this.settingsPanel.hidden));
      if (this.settingsPanel.hidden) this.sceneView?.canvas.focus();
    });
    header.append(this.title, subtitle, openInventory, this.settingsButton, this.closeButton);
    const body = node("div", "ks-myroom-body");
    const sceneArea = node("div", "ks-myroom-scene-area");
    this.scene.setAttribute("aria-label", "原版小屋三维场景");
    this.scene.append(this.sceneLabel);
    sceneArea.append(this.scene,
      node("p", "ks-myroom-subtitle ks-myroom-hint", "WASD / 方向键移动 · 滚轮缩放"));
    const side = this.settingsPanel;
    side.id = "ks-myroom-settings";
    side.hidden = true;
    const info = node("section", "ks-myroom-card");
    info.append(node("h2", undefined, "我的小屋"),
      node("p", undefined, "选择小屋环境，并保存自己的名称和留言。"));
    const nameField = node("label", "ks-myroom-field", "小屋名称");
    this.nameInput.maxLength = 32;
    nameField.append(this.nameInput);
    const messageField = node("label", "ks-myroom-field", "小屋留言");
    this.messageInput.maxLength = 120;
    messageField.append(this.messageInput);
    const environmentField = node("label", "ks-myroom-field", "小屋环境");
    for (const room of options.environments) {
      const choice = node("option", undefined, room.title);
      choice.value = String(room.id);
      this.environmentSelect.append(choice);
    }
    environmentField.append(this.environmentSelect);
    this.environmentSelect.addEventListener("change", () => {
      const room = this.selectedEnvironment();
      if (room) void this.sceneView?.setEnvironment(room).then(loaded => {
        if (loaded && !this.disposed && this.selectedEnvironment()?.id === room.id)
          this.sceneLabel.textContent = room.title;
      });
    });
    const save = node("button", undefined, "保存小屋设置");
    save.type = "button";
    save.addEventListener("click", () => this.save());
    info.append(nameField, messageField, environmentField, save, this.status);
    side.append(info);
    body.append(sceneArea, side);
    shell.append(header, body);
    this.element.append(style, shell);
    options.root.append(this.element);
    this.refresh(options.profile);
  }

  show(): void {
    if (this.disposed) return;
    this.element.hidden = false;
    this.sceneView ??= new MyRoomSceneView(this.scene, this.options.library);
    const room = this.selectedEnvironment();
    if (room) void this.sceneView.setEnvironment(room);
    if (this.options.subject) void this.sceneView.setSubject(this.options.subject);
    window.addEventListener("keydown", this.onKeyDown, true);
    this.sceneView.canvas.focus();
  }

  refresh(profile: LocalProfile): void {
    this.profile = profile;
    this.title.textContent = profile.myRoom.displayName;
    this.nameInput.value = profile.myRoom.displayName;
    this.messageInput.value = profile.myRoom.message;
    const room = this.options.environments.find(item => item.id === profile.myRoom.environmentId)
      ?? this.options.environments.find(item => item.isDefault)!;
    this.environmentSelect.value = String(room.id);
    this.sceneLabel.textContent = room.title;
    if (this.sceneView) void this.sceneView.setEnvironment(room);
    if (room.id !== profile.myRoom.environmentId) {
      this.setStatus("已保存的小屋环境资源不可用，当前显示默认环境。", true);
    }
  }

  /** The inventory overlay calls this when it closes. */
  inventoryClosed(): void {
    this.inventoryOpen = false;
    if (!this.disposed) this.sceneView?.canvas.focus();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    window.removeEventListener("keydown", this.onKeyDown, true);
    this.sceneView?.dispose();
    this.element.remove();
    this.previousFocus?.isConnected && this.previousFocus.focus();
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (this.inventoryOpen) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!this.settingsPanel.hidden) {
        this.settingsPanel.hidden = true;
        this.settingsButton.setAttribute("aria-expanded", "false");
        this.sceneView?.canvas.focus();
      } else {
        this.options.onClose();
      }
    }
  };

  private selectedEnvironment(): MyRoomEnvironment | undefined {
    return this.options.environments.find(item => String(item.id) === this.environmentSelect.value);
  }

  private async save(): Promise<void> {
    const environmentId = Number(this.environmentSelect.value);
    if (!this.options.environments.some(item => item.id === environmentId)) {
      this.setStatus("请选择可用的小屋环境。", true);
      return;
    }
    const myRoom: MyRoomProfile = {
      environmentId,
      displayName: this.nameInput.value.trim(),
      message: this.messageInput.value.trim(),
    };
    try {
      if (this.sceneView && !(await this.sceneView.setEnvironment(
        this.options.environments.find(item => item.id === environmentId)!))) {
        this.setStatus("小屋场景未能加载，设置没有保存。", true);
        return;
      }
      if (this.disposed) return;
      validateMyRoomProfile(myRoom);
      const next = { ...this.profile, myRoom };
      this.options.onProfileChange(next);
      this.refresh(next);
      this.setStatus("小屋设置已保存。", false);
    } catch (error) {
      this.setStatus(`保存失败：${error instanceof Error ? error.message : String(error)}`, true);
    }
  }

  private setStatus(message: string, error: boolean): void {
    this.status.textContent = message;
    this.status.setAttribute("role", error ? "alert" : "status");
  }
}
