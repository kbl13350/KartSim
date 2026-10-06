import type { LocalProfile, MyRoomProfile } from "./local-profile";
import { validateMyRoomProfile } from "./local-profile";
import type { MyRoomEnvironment } from "./my-room-catalog";

export interface MyRoomViewOptions {
  root: HTMLElement;
  environments: readonly MyRoomEnvironment[];
  profile: LocalProfile;
  onProfileChange(profile: LocalProfile): void;
  onOpenInventory(): Promise<void> | void;
  onClose(): void;
}

const styles = `
.ks-myroom{position:absolute;inset:0;z-index:70;display:flex;align-items:center;justify-content:center;padding:3%;box-sizing:border-box;background:rgba(10,21,43,.89);color:#f4f8ff;font:16px/1.5 system-ui,sans-serif;}
.ks-myroom *{box-sizing:border-box}.ks-myroom[hidden]{display:none}
.ks-myroom-shell{width:min(1100px,100%);height:min(740px,100%);display:flex;flex-direction:column;overflow:hidden;border:2px solid #91cafa;border-radius:20px;background:#152b4a;box-shadow:0 28px 80px #030c1dcc}
.ks-myroom-header{display:flex;align-items:center;gap:14px;padding:16px 24px;background:linear-gradient(100deg,#175695,#102943);border-bottom:1px solid #6fb6eb}
.ks-myroom-header h1{font-size:24px;margin:0;flex:1}.ks-myroom-subtitle{font-size:13px;color:#c2d9ef}.ks-myroom button,.ks-myroom select,.ks-myroom input,.ks-myroom textarea{font:inherit}
.ks-myroom button{border:1px solid #88cafa;border-radius:9px;background:#15578e;color:white;padding:8px 15px;cursor:pointer}.ks-myroom button:hover{background:#2175b2}.ks-myroom button:focus-visible,.ks-myroom select:focus-visible,.ks-myroom input:focus-visible,.ks-myroom textarea:focus-visible{outline:3px solid #ffe082;outline-offset:2px}
.ks-myroom-body{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(280px,.8fr);gap:22px;padding:22px;overflow:auto;flex:1}
.ks-myroom-scene{position:relative;min-height:300px;overflow:hidden;border:1px solid #99c2de;border-radius:16px;background:linear-gradient(180deg,var(--room-sky,#8ac6ef) 0%,var(--room-wall,#d7dfcb) 58%,var(--room-floor,#7c9a9b) 58%,var(--room-floor,#7c9a9b) 100%)}
.ks-myroom-scene:before{content:"";position:absolute;left:11%;top:16%;width:28%;height:31%;border:12px solid #f7e9c9;border-radius:90px 90px 8px 8px;background:linear-gradient(#c2e9ff,#8cc6dc);box-shadow:0 12px 22px #13284155}
.ks-myroom-scene:after{content:"";position:absolute;right:-15%;bottom:-46%;width:110%;height:60%;border-radius:50%;background:#344f65aa;transform:rotate(-8deg)}
.ks-myroom-scene-label{position:absolute;left:22px;bottom:22px;z-index:1;padding:10px 14px;border-radius:10px;background:#102b49da;font-weight:700}
.ks-myroom-side{display:flex;flex-direction:column;gap:16px}.ks-myroom-card{padding:18px;border:1px solid #6f9dbd;border-radius:13px;background:#204366}.ks-myroom-card h2{margin:0 0 12px;font-size:17px}.ks-myroom-card p{margin:0 0 12px;color:#d8e8f5}
.ks-myroom-field{display:block;margin:11px 0;color:#d9eafa;font-size:14px}.ks-myroom-field input,.ks-myroom-field select,.ks-myroom-field textarea{display:block;width:100%;margin-top:5px;padding:9px;border:1px solid #a6c8df;border-radius:8px;background:#f7fbff;color:#143047}.ks-myroom-field textarea{min-height:70px;resize:vertical}
.ks-myroom-actions{display:flex;gap:10px;flex-wrap:wrap}.ks-myroom-status{min-height:23px;color:#ffeeb8;font-size:14px}.ks-myroom-status[role=alert]{color:#ffb9b9}
@media(max-width:700px){.ks-myroom{padding:0}.ks-myroom-shell{border-radius:0;height:100%}.ks-myroom-body{display:block}.ks-myroom-scene{min-height:210px;margin-bottom:15px}.ks-myroom-header{padding:10px}.ks-myroom-header h1{font-size:20px}}
`;

function node<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string,
  text?: string): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function palette(resourceName: string): [string, string, string] {
  const family = resourceName.split("_")[0]?.toLowerCase();
  if (family === "desert") return ["#f9d7a2", "#dbaf78", "#a77154"];
  if (family === "ice") return ["#b4e4ff", "#e5f3f8", "#7bb1c6"];
  if (family === "forest") return ["#8bbba9", "#abd1a0", "#527d67"];
  if (family === "tomb") return ["#b9adba", "#d8cbbf", "#74636e"];
  if (family === "china") return ["#e3b19b", "#e9cfad", "#a35659"];
  return ["#8ac6ef", "#d7dfcb", "#7c9a9b"];
}

/** A local My Room screen backed by the original environment catalog and saved profile. */
export class MyRoomView {
  readonly element = node("section", "ks-myroom");
  readonly title = node("h1");
  readonly scene = node("div", "ks-myroom-scene");
  readonly sceneLabel = node("span", "ks-myroom-scene-label");
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

  constructor(readonly options: MyRoomViewOptions) {
    this.profile = options.profile;
    this.element.hidden = true;
    this.element.setAttribute("role", "dialog");
    this.element.setAttribute("aria-modal", "true");
    this.element.setAttribute("aria-label", "我的小屋");
    const style = node("style");
    style.textContent = styles;
    const shell = node("div", "ks-myroom-shell");
    const header = node("header", "ks-myroom-header");
    const subtitle = node("span", "ks-myroom-subtitle", "小屋 / 我的道具");
    this.closeButton.type = "button";
    this.closeButton.addEventListener("click", options.onClose);
    header.append(this.title, subtitle, this.closeButton);
    const body = node("div", "ks-myroom-body");
    const sceneArea = node("div");
    this.scene.setAttribute("aria-label", "小屋环境主题示意");
    this.scene.append(this.sceneLabel);
    sceneArea.append(this.scene,
      node("p", "ks-myroom-subtitle", "主题示意 · 场景名称与可选范围来自原版小屋资源"));
    const side = node("div", "ks-myroom-side");
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
    const save = node("button", undefined, "保存小屋设置");
    save.type = "button";
    save.addEventListener("click", () => this.save());
    info.append(nameField, messageField, environmentField, save, this.status);
    const actions = node("section", "ks-myroom-card");
    actions.append(node("h2", undefined, "我的道具"),
      node("p", undefined, "查看当前本地可用的道具和装备。"));
    const openInventory = node("button", undefined, "打开我的道具");
    openInventory.type = "button";
    openInventory.addEventListener("click", () => {
      if (this.inventoryOpen) return;
      this.inventoryOpen = true;
      void Promise.resolve().then(() => options.onOpenInventory()).catch(error => {
        this.inventoryOpen = false;
        this.setStatus(`打开我的道具失败：${String(error)}`, true);
      });
    });
    actions.append(openInventory);
    side.append(info, actions);
    body.append(sceneArea, side);
    shell.append(header, body);
    this.element.append(style, shell);
    options.root.append(this.element);
    this.refresh(options.profile);
  }

  show(): void {
    if (this.disposed) return;
    this.element.hidden = false;
    window.addEventListener("keydown", this.onKeyDown, true);
    this.closeButton.focus();
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
    const [sky, wall, floor] = palette(room.resourceName);
    this.scene.style.setProperty("--room-sky", sky);
    this.scene.style.setProperty("--room-wall", wall);
    this.scene.style.setProperty("--room-floor", floor);
    if (room.id !== profile.myRoom.environmentId) {
      this.setStatus("已保存的小屋环境资源不可用，当前显示默认环境。", true);
    }
  }

  /** The inventory overlay calls this when it closes. */
  inventoryClosed(): void { this.inventoryOpen = false; }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    window.removeEventListener("keydown", this.onKeyDown, true);
    this.element.remove();
    this.previousFocus?.isConnected && this.previousFocus.focus();
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (this.inventoryOpen) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.options.onClose();
    }
  };

  private save(): void {
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
