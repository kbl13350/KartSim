import type { GarageCatalogEntry } from "../resources/garage-catalog";
import type { FavoriteItem, LocalProfile, MyRoomProfile } from "./local-profile";
import { validateMyRoomProfile } from "./local-profile";
import { openMyRoomAdmin, type MyRoomAdminDialog, type MyRoomAdminKart } from "./my-room-admin";
import type { MyRoomEnvironment } from "./my-room-catalog";
import { MyRoomHud, loadMyRoomHudAssets, type MyRoomHudLibrary } from "./my-room-hud";
import { MyRoomSceneView, type MyRoomSceneLibrary,
  type MyRoomSceneSubject } from "./my-room-scene";

export interface MyRoomViewOptions {
  root: HTMLElement;
  library: MyRoomSceneLibrary;
  subject?: MyRoomSceneSubject;
  environments: readonly MyRoomEnvironment[];
  profile: LocalProfile;
  /** Rider shown as the room owner in the release rider list. */
  ownerName: string;
  /** Starred karts offered as representative karts in the room admin dialog. */
  starredKarts: readonly MyRoomAdminKart[];
  /** Kart models for representative karts parked beside the owner's. */
  resolveKart(item: FavoriteItem): GarageCatalogEntry | undefined;
  onProfileChange(profile: LocalProfile): void;
  onOpenInventory(): Promise<void> | void;
  onClose(): void;
}

// Above Ready's stage layer (1), below the shared dialog layer (3) so the
// release dialogs opened from the room menu draw over the room.
const styles = `
.ks-myroom{position:absolute;inset:0 0 7.333333%;z-index:2;display:block;box-sizing:border-box;background:#102b49;color:#f4f8ff;font:16px/1.5 system-ui,sans-serif;}
.ks-myroom *{box-sizing:border-box}.ks-myroom[hidden]{display:none}
.ks-myroom-shell,.ks-myroom-scene{position:absolute;inset:0;overflow:hidden;background:#152b4a}
.ks-myroom-status{position:absolute;z-index:4;left:50%;top:22%;transform:translateX(-50%);max-width:80%;margin:0;padding:6px 12px;border-radius:6px;background:#102b49e6;color:#ffb9b9;font-size:14px;pointer-events:none}
.ks-myroom-status[hidden]{display:none}
`;

function node<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string,
  text?: string): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

/** Representative karts saved in the room, else the first starred karts. */
export function myRoomDisplayKarts(room: MyRoomProfile,
  starred: readonly MyRoomAdminKart[]): FavoriteItem[] {
  if (room.displayKarts) return room.displayKarts;
  return starred.slice(0, 2).map(kart => kart.item);
}

/** A local My Room screen backed by the original environment catalog and scene models. */
export class MyRoomView {
  readonly element = node("section", "ks-myroom");
  readonly shell = node("div", "ks-myroom-shell");
  readonly scene = node("div", "ks-myroom-scene");
  readonly status = node("p", "ks-myroom-status");
  private profile: LocalProfile;
  private readonly previousFocus = document.activeElement instanceof HTMLElement
    ? document.activeElement : undefined;
  private disposed = false;
  private inventoryOpen = false;
  private sceneView?: MyRoomSceneView;
  private hud?: MyRoomHud;
  private hudLoading = false;
  private admin?: MyRoomAdminDialog;
  private adminOpening = false;

  constructor(readonly options: MyRoomViewOptions) {
    this.profile = options.profile;
    this.element.hidden = true;
    this.element.setAttribute("role", "region");
    this.element.setAttribute("aria-label", "我的小屋");
    const style = node("style");
    style.textContent = styles;
    this.scene.setAttribute("aria-label", "原版小屋三维场景");
    this.status.hidden = true;
    this.status.setAttribute("role", "alert");
    this.shell.append(this.scene, this.status);
    this.element.append(style, this.shell);
    options.root.append(this.element);
  }

  show(): void {
    if (this.disposed) return;
    this.element.hidden = false;
    this.sceneView ??= new MyRoomSceneView(this.scene, this.options.library);
    void this.sceneView.setEnvironment(this.environment());
    if (this.options.subject) void this.sceneView.setSubject({ ...this.options.subject,
      displayKarts: this.displayKartEntries() });
    window.addEventListener("keydown", this.onKeyDown, true);
    this.sceneView.canvas.focus();
    void this.loadHud(this.sceneView);
  }

  refresh(profile: LocalProfile): void {
    this.profile = profile;
    if (this.sceneView) void this.sceneView.setEnvironment(this.environment());
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
    this.admin?.dispose();
    this.hud?.dispose();
    this.sceneView?.dispose();
    this.element.remove();
    this.previousFocus?.isConnected && this.previousFocus.focus();
  }

  private environment(): MyRoomEnvironment {
    const environments = this.options.environments;
    return environments.find(item => item.id === this.profile.myRoom.environmentId)
      ?? environments.find(item => item.isDefault)!;
  }

  private displayKartEntries(): GarageCatalogEntry[] {
    return myRoomDisplayKarts(this.profile.myRoom, this.options.starredKarts)
      .map(item => this.options.resolveKart(item))
      .filter((kart): kart is GarageCatalogEntry => !!kart);
  }

  /** The release monocoque menus, rider list and chat box over the scene. */
  private async loadHud(sceneView: MyRoomSceneView): Promise<void> {
    if (this.hud || this.hudLoading) return;
    this.hudLoading = true;
    try {
      const assets = await loadMyRoomHudAssets(
        this.options.library as unknown as MyRoomHudLibrary);
      if (this.disposed) {
        document.fonts.delete(assets.font);
        return;
      }
      this.hud = new MyRoomHud(this.shell, assets, {
        ownerName: this.options.ownerName,
        sceneCanvas: sceneView.canvas,
        chatAllowed: () => this.profile.myRoom.chatAllowed !== false,
        onOpenInventory: () => this.openInventory(),
        onOpenAdmin: () => void this.openAdmin(),
      });
    } catch (error) {
      this.setStatus(`小屋界面加载失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.hudLoading = false;
    }
  }

  private openInventory(): void {
    if (this.inventoryOpen || this.admin) return;
    this.inventoryOpen = true;
    void Promise.resolve().then(() => this.options.onOpenInventory()).catch(error => {
      this.inventoryOpen = false;
      this.setStatus(`打开我的物品失败：${String(error)}`);
    });
  }

  /** "管理" opens the release roomAdmin dialog. */
  private async openAdmin(): Promise<void> {
    if (this.admin || this.adminOpening || this.inventoryOpen || this.disposed) return;
    this.adminOpening = true;
    try {
      const room = { ...this.profile.myRoom,
        displayKarts: myRoomDisplayKarts(this.profile.myRoom, this.options.starredKarts) };
      const dialog = await openMyRoomAdmin({
        library: this.options.library, root: this.options.root, room,
        environments: this.options.environments,
        starredKarts: this.options.starredKarts,
        onSave: next => this.save(next),
        onClose: () => this.closeAdmin(),
      });
      if (this.disposed) dialog.dispose();
      else this.admin = dialog;
    } catch (error) {
      this.setStatus(`打开管理失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.adminOpening = false;
    }
  }

  private closeAdmin(): void {
    this.admin?.dispose();
    this.admin = undefined;
    if (!this.disposed) this.sceneView?.canvas.focus();
  }

  private async save(myRoom: MyRoomProfile): Promise<boolean> {
    try {
      validateMyRoomProfile(myRoom);
      const environment = this.options.environments.find(item => item.id === myRoom.environmentId);
      if (!environment) throw new Error("请选择可用的小屋环境。");
      if (this.sceneView && !(await this.sceneView.setEnvironment(environment))) {
        this.setStatus("小屋场景未能加载，设置没有保存。");
        return false;
      }
      if (this.disposed) return false;
      const previous = this.profile.myRoom.displayKarts;
      const next = { ...this.profile, myRoom };
      this.options.onProfileChange(next);
      this.profile = next;
      if (JSON.stringify(previous) !== JSON.stringify(myRoom.displayKarts))
        void this.sceneView?.setDisplayKarts(this.displayKartEntries());
      this.hud?.render();
      this.setStatus(undefined);
      return true;
    } catch (error) {
      this.setStatus(`保存失败：${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (this.inventoryOpen || this.admin || this.hud?.isChatting) return;
    if (event.key === "Enter" && !event.isComposing &&
        document.activeElement === this.sceneView?.canvas) {
      event.preventDefault();
      this.hud?.beginChat();
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.options.onClose();
    }
  };

  private setStatus(message: string | undefined): void {
    this.status.textContent = message ?? "";
    this.status.hidden = !message;
  }
}
