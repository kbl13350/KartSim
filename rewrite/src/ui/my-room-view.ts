import type { GarageCatalogEntry } from "../resources/garage-catalog";
import { MyRoomApi } from "../myroom/myroom-api";
import { MyRoomError, type EnterTarget, type MyRoomConnection, type RoomAppearance,
  type RoomEvent, type RoomMember, type RoomSnapshot } from "../myroom/myroom-connection";
import { ImageCache, gloveIconPath } from "../myroom/myroom-data";
import type { FavoriteItem, LocalProfile, MyRoomProfile } from "./local-profile";
import { validateMyRoomProfile } from "./local-profile";
import { openMyRoomAdmin, type MyRoomAdminDialog, type MyRoomAdminKart } from "./my-room-admin";
import { openMyRoomCareer, type MyRoomCareerLibrary, type MyRoomCareerWindow } from "./my-room-career";
import { openMyRoomDictionary, type DictionaryItemInfo, type DictionaryPictureSource,
  type MyRoomDictionaryWindow } from "./my-room-dictionary";
import type { MyRoomEnvironment } from "./my-room-catalog";
import { askRoomPassword, openFindRiderDialog } from "./my-room-dialogs";
import { openMyRoomEmblems, type MyRoomEmblemDialog } from "./my-room-emblems";
import { MyRoomHud, loadMyRoomHudAssets, type MyRoomHudLibrary, type MyRoomHudRider } from "./my-room-hud";
import { MyRoomSceneView, type MyRoomRemoteRider, type MyRoomSceneLibrary,
  type MyRoomSceneSubject, type MyRoomVisitorKart } from "./my-room-scene";

/** The data service side of the room: live visits, careers, emblems and the item dictionary. */
export interface MyRoomSocial {
  api: MyRoomApi;
  connection: MyRoomConnection;
  /** Another rider's look as scene models; undefined when its items are unknown here. */
  resolveAppearance(appearance: RoomAppearance): MyRoomSceneSubject | undefined;
  /** Friend nicknames for 寻找小屋's list. */
  friends(): string[];
  /** A release notice box. */
  notice(title: string, message: string): Promise<unknown>;
  /** Item names and kart types (the shop catalog) by itemKey for the 道具图鉴. */
  dictionaryItems(): Promise<ReadonlyMap<string, DictionaryItemInfo>>;
  /** Item pictures for the 道具图鉴; disposed with its window. */
  dictionaryPictures?(): DictionaryPictureSource;
  /** Re-reads the account (the wallet after a K币 reward). */
  refreshAccount(): void;
}

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
  /** Without it the room stays a local, single-rider room. */
  social?: MyRoomSocial;
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

/** Release texts of the room notices (stage_myRoom stage_stringBag and etc_/baseStringBag). */
export const MY_ROOM_TEXT = {
  title: "小屋",
  findTitle: "寻找小屋",
  randomTitle: "随机进入",
  unknownRider: "不存在的车手",
  alreadyMyRoom: "已经在 %s的小屋里",
  wrongPassword: "密码错误",
  cannotEnterRandomRoom: "随机进入失败",
  cannotEnterMyRoom: "进入小屋失败",
  roomFull: "小屋已满员，进入小屋失败",
  kicked: "你被请出了%s的小屋",
  replaced: "已在其他窗口进入小屋",
  notifyEnter: "%s进入小屋",
  notifyLeave: "%s离开小屋",
  chatDisabled: "小屋主人关闭了聊天",
  chatFlood: "发言过于频繁，请稍后再试",
  tooManyAttempts: "密码尝试次数过多，请稍后再试",
  reconnecting: "与小屋服务器的连接中断，正在重新连接…",
  roomPassword: "小屋密码",
  etcPassword: "车库等公开密码",
} as const;

/** The notice text for a refused enter. */
export function enterErrorMessage(error: unknown, random: boolean): string {
  const code = error instanceof MyRoomError ? error.code : "";
  switch (code) {
    case "UNKNOWN_RIDER": return MY_ROOM_TEXT.unknownRider;
    case "ALREADY_HERE": return MY_ROOM_TEXT.alreadyMyRoom.replace("%s",
      (error as MyRoomError).nickname ?? "");
    case "WRONG_PASSWORD": return MY_ROOM_TEXT.wrongPassword;
    case "RANDOM_FAILED": return MY_ROOM_TEXT.cannotEnterRandomRoom;
    case "ROOM_FULL": return MY_ROOM_TEXT.roomFull;
    case "RATE_LIMITED": return MY_ROOM_TEXT.tooManyAttempts;
  }
  return random ? MY_ROOM_TEXT.cannotEnterRandomRoom : MY_ROOM_TEXT.cannotEnterMyRoom;
}

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

/** The My Room screen: the original scene and menus, live with the riders in it. */
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
  private career?: MyRoomCareerWindow;
  private dictionary?: MyRoomDictionaryWindow;
  private emblems?: MyRoomEmblemDialog;
  /** A dialog of the room menu is open or opening (find, career, emblems…). */
  private dialogBusy = false;
  private room?: RoomSnapshot;
  private readonly members = new Map<string, RoomMember>();
  private entering = false;
  /** The etc password given for the room being visited. */
  private etcPassword?: string;
  private releaseEvents?: () => void;
  private readonly gloves: ImageCache;

  constructor(readonly options: MyRoomViewOptions) {
    this.profile = options.profile;
    this.gloves = new ImageCache(options.library as unknown as MyRoomCareerLibrary,
      () => this.hud?.render());
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

  /** The player is in another rider's room. */
  get visiting(): boolean {
    return !!this.room && this.room.room.ownerId !== this.room.self;
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
    const social = this.options.social;
    if (social) {
      this.releaseEvents = social.connection.onEvent(this.onRoomEvent);
      this.sceneView.onLocalMove = pose => { if (this.room) social.connection.move(pose); };
      social.connection.start();
      void this.enterRoom({ own: true });
    }
  }

  refresh(profile: LocalProfile): void {
    this.profile = profile;
    if (this.sceneView && !this.visiting) void this.sceneView.setEnvironment(this.environment());
  }

  /** Back to the player's own room (the taskbar 小屋 button while visiting). */
  goHome(): void {
    if (this.visiting) void this.enterRoom({ own: true });
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
    this.releaseEvents?.();
    const connection = this.options.social?.connection;
    if (connection) void connection.leave().finally(() => connection.stop());
    this.admin?.dispose();
    this.career?.dispose();
    this.emblems?.dispose();
    this.dictionary?.dispose();
    this.hud?.dispose();
    this.sceneView?.dispose();
    this.element.remove();
    this.previousFocus?.isConnected && this.previousFocus.focus();
  }

  private environment(): MyRoomEnvironment {
    const environments = this.options.environments;
    const id = this.visiting ? this.room!.room.settings.environmentId : this.profile.myRoom.environmentId;
    return environments.find(item => item.id === id)
      ?? environments.find(item => item.isDefault)!;
  }

  private displayKartItems(): FavoriteItem[] {
    return this.visiting ? this.room!.room.settings.displayKarts
      : myRoomDisplayKarts(this.profile.myRoom, this.options.starredKarts);
  }

  private displayKartEntries(): GarageCatalogEntry[] {
    return this.displayKartItems()
      .map(item => this.options.resolveKart(item))
      .filter((kart): kart is GarageCatalogEntry => !!kart);
  }

  /** The room owner's look while visiting (its kart is parked at parking00). */
  private ownerSubject(): MyRoomSceneSubject | undefined {
    const appearance = this.visiting ? this.room!.room.ownerAppearance : undefined;
    return appearance ? this.options.social?.resolveAppearance(appearance) : undefined;
  }

  private hudRiders(): MyRoomHudRider[] {
    if (!this.room) return [{ accountId: "", nickname: this.options.ownerName, slot: 0 }];
    return [...this.members.values()].sort((a, b) => a.slot - b.slot)
      .map(member => ({ accountId: member.accountId, nickname: member.nickname, slot: member.slot,
        glove: member.glove }));
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
        sceneCanvas: sceneView.canvas,
        room: () => ({ visitor: this.visiting,
          ownerName: this.room?.room.ownerNickname ?? this.options.ownerName,
          riders: this.hudRiders() }),
        chatAllowed: () => !this.visiting || this.room?.room.settings.chatAllowed !== false,
        onOpenInventory: () => this.openInventory(),
        onOpenAdmin: () => void this.openAdmin(),
        onCareer: () => void this.openCareer(),
        onEmblem: () => void this.openEmblems(),
        onDictionary: () => void this.openDictionary(),
        onFindRider: () => void this.openFindRider(),
        onRandomVisit: () => void this.randomVisit(),
        onKick: accountId => void this.kick(accountId),
        onChat: text => !!this.room && !!this.options.social?.connection.chat(text),
        gloveImage: glove => {
          const path = gloveIconPath(glove);
          return path ? this.gloves.get(path) : undefined;
        },
      });
    } catch (error) {
      this.setStatus(`小屋界面加载失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.hudLoading = false;
    }
  }

  /* ---------- live room ---------- */

  /**
   * Enter a room; a locked room asks for its password first. Refusals show
   * the release notice and keep the player where it was.
   */
  private async enterRoom(target: EnterTarget, password?: string): Promise<boolean> {
    const social = this.options.social;
    if (!social || this.disposed || this.entering) return false;
    this.entering = true;
    const random = "random" in target;
    try {
      const snapshot = await social.connection.enter(target, password);
      if (this.disposed) return false;
      this.applySnapshot(snapshot);
      return true;
    } catch (error) {
      if (this.disposed) return false;
      if (error instanceof MyRoomError && error.code === "PASSWORD_REQUIRED") {
        this.entering = false;
        const typed = await askRoomPassword({ library: this.options.library,
          root: this.options.root, label: MY_ROOM_TEXT.roomPassword });
        if (!typed || this.disposed) return false;
        return this.enterRoom(target, typed);
      }
      // The own room is entered silently at start; a failure there keeps the
      // local room.
      if (!("own" in target)) {
        await social.notice(random ? MY_ROOM_TEXT.randomTitle : MY_ROOM_TEXT.findTitle,
          enterErrorMessage(error, random));
      }
      return false;
    } finally {
      this.entering = false;
    }
  }

  private applySnapshot(snapshot: RoomSnapshot): void {
    const changedRoom = this.room?.room.ownerId !== snapshot.room.ownerId;
    this.room = snapshot;
    this.members.clear();
    for (const member of snapshot.members) this.members.set(member.accountId, member);
    if (changedRoom) this.etcPassword = undefined;
    this.setStatus(undefined);
    this.sceneView?.setLocalSlot(this.members.get(snapshot.self)?.slot ?? 0);
    this.applyRoomView();
    this.syncRiders();
    if (changedRoom) this.hud?.clearChat();
    this.hud?.render();
    if (changedRoom && this.visiting)
      this.hud?.addChatLine(MY_ROOM_TEXT.notifyEnter.replace("%s",
        this.members.get(snapshot.self)?.nickname ?? this.options.ownerName));
  }

  /** The room's environment, the owner's parked kart and its representative karts. */
  private applyRoomView(): void {
    const scene = this.sceneView;
    if (!scene) return;
    void scene.setEnvironment(this.environment());
    if (this.options.subject) void scene.setSubject({ ...this.options.subject,
      displayKarts: this.displayKartEntries() }, this.ownerSubject());
    void scene.setDisplayKarts(this.displayKartEntries());
  }

  /** Remote riders and the visitors' parked karts in the scene. */
  private syncRiders(): void {
    const scene = this.sceneView;
    const social = this.options.social;
    if (!scene || !social || !this.room) return;
    const self = this.room.self;
    const riders: MyRoomRemoteRider[] = [];
    const karts: MyRoomVisitorKart[] = [];
    for (const member of this.members.values()) {
      const subject = member.accountId === self ? this.options.subject
        : member.appearance ? social.resolveAppearance(member.appearance) : undefined;
      if (!subject) continue;
      if (member.accountId !== self) riders.push({ id: member.accountId, slot: member.slot, subject,
        pose: member.pose });
      if (member.slot > 0) karts.push({ id: member.accountId, slot: member.slot, subject });
    }
    scene.setRemoteRiders(riders);
    scene.setVisitorKarts(karts);
  }

  private readonly onRoomEvent = (event: RoomEvent): void => {
    if (this.disposed) return;
    switch (event.type) {
      case "joined":
        this.members.set(event.member.accountId, event.member);
        this.hud?.addChatLine(MY_ROOM_TEXT.notifyEnter.replace("%s", event.member.nickname));
        this.syncRiders();
        break;
      case "left":
        this.members.delete(event.accountId);
        if (event.nickname) this.hud?.addChatLine(MY_ROOM_TEXT.notifyLeave.replace("%s", event.nickname));
        this.syncRiders();
        break;
      case "moved": {
        const member = this.members.get(event.accountId);
        if (member) member.pose = event.pose;
        this.sceneView?.moveRemoteRider(event.accountId, event.pose);
        return;
      }
      case "chat":
        this.hud?.addChatLine(`${event.nickname} : ${event.text}`);
        return;
      case "chat-error":
        this.hud?.addChatLine(event.code === "CHAT_DISABLED" ? MY_ROOM_TEXT.chatDisabled
          : event.code === "CHAT_FLOOD" ? MY_ROOM_TEXT.chatFlood : MY_ROOM_TEXT.cannotEnterMyRoom);
        return;
      case "settings":
        // The owner changed its room (or looks); the riders here stay.
        if (this.room) {
          this.room = { ...this.room, room: event.room };
          if (this.visiting) this.applyRoomView();
        }
        break;
      case "member":
        this.members.set(event.member.accountId, event.member);
        this.syncRiders();
        break;
      case "kicked": {
        const owner = event.ownerNickname || this.room?.room.ownerNickname || "";
        this.room = undefined;
        this.members.clear();
        void this.options.social?.notice(MY_ROOM_TEXT.title, MY_ROOM_TEXT.kicked.replace("%s", owner));
        void this.enterRoom({ own: true });
        break;
      }
      case "replaced":
        this.room = undefined;
        this.members.clear();
        this.syncRiders();
        this.setStatus(MY_ROOM_TEXT.replaced);
        break;
      case "connection":
        this.setStatus(event.open ? undefined : MY_ROOM_TEXT.reconnecting);
        return;
      case "rejoined":
        this.applySnapshot(event.snapshot);
        return;
    }
    this.hud?.render();
  };

  private async kick(accountId: string): Promise<void> {
    try {
      await this.options.social?.connection.kick(accountId);
    } catch (error) {
      await this.options.social?.notice(MY_ROOM_TEXT.title, enterErrorMessage(error, false));
    }
  }

  /* ---------- room menu ---------- */

  /** Runs one room-menu dialog at a time. */
  private async withDialog(run: () => Promise<void>): Promise<void> {
    if (this.dialogBusy || this.admin || this.inventoryOpen || this.disposed) return;
    this.dialogBusy = true;
    try {
      await run();
    } catch (error) {
      if (!this.disposed) await this.options.social?.notice(MY_ROOM_TEXT.title,
        error instanceof MyRoomError || !(error instanceof Error) ? MY_ROOM_TEXT.cannotEnterMyRoom
          : error.message);
    } finally {
      this.dialogBusy = false;
    }
  }

  /** A visitor's etc password for the owner's emblems and careers, asked once. */
  private async visitTarget(): Promise<{ nickname: string; password?: string } | undefined> {
    if (!this.visiting || !this.room) return undefined;
    const nickname = this.room.room.ownerNickname;
    if (!this.room.room.settings.etcLocked) return { nickname };
    if (this.etcPassword) return { nickname, password: this.etcPassword };
    const password = await askRoomPassword({ library: this.options.library, root: this.options.root,
      label: MY_ROOM_TEXT.etcPassword });
    return password ? { nickname, password } : undefined;
  }

  /** Runs a visitor view; a wrong etc password is forgotten and told. */
  private async visitorView<T>(load: (visit?: { nickname: string; password?: string }) => Promise<T>):
    Promise<T | undefined> {
    const visit = await this.visitTarget();
    if (this.visiting && !visit) return undefined;
    try {
      const result = await load(visit);
      if (visit?.password) this.etcPassword = visit.password;
      return result;
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === "WRONG_PASSWORD" || code === "PASSWORD_REQUIRED") {
        this.etcPassword = undefined;
        await this.options.social?.notice(MY_ROOM_TEXT.title, MY_ROOM_TEXT.wrongPassword);
        return undefined;
      }
      throw error;
    }
  }

  private openCareer(): Promise<void> {
    const social = this.options.social;
    if (!social) return Promise.resolve();
    return this.withDialog(async () => {
      const summary = await this.visitorView(visit => social.api.careers(visit));
      if (!summary || this.disposed) return;
      await new Promise<void>((resolve, reject) => {
        openMyRoomCareer({
          library: this.options.library as unknown as MyRoomCareerLibrary,
          root: this.options.root, summary, editable: summary.owner,
          complete: id => social.api.completeCareer(id),
          reload: () => social.api.careers(),
          notice: (title, message) => social.notice(title, message),
          onClose: () => {
            this.career = undefined;
            resolve();
            if (!this.disposed) this.sceneView?.canvas.focus();
          },
        }).then(window => {
          if (this.disposed) window.dispose();
          else this.career = window;
        }, reject);
      });
    });
  }

  private openEmblems(): Promise<void> {
    const social = this.options.social;
    if (!social) return Promise.resolve();
    return this.withDialog(async () => {
      const summary = await this.visitorView(visit => social.api.emblems(visit));
      if (!summary || this.disposed) return;
      await new Promise<void>((resolve, reject) => {
        openMyRoomEmblems({
          library: this.options.library as unknown as MyRoomCareerLibrary,
          root: this.options.root, summary, editable: summary.owner,
          onSave: main => social.api.setMainEmblems(main),
          notice: message => { void social.notice(summary.owner ? "查看我的徽章" : "查看徽章", message); },
          onClose: () => {
            this.emblems = undefined;
            resolve();
            if (!this.disposed) this.sceneView?.canvas.focus();
          },
        }).then(dialog => {
          if (this.disposed) dialog.dispose();
          else this.emblems = dialog;
        }, reject);
      });
    });
  }

  /** 图鉴 / 浏览图鉴: the 道具图鉴, the owner's with 领取奖励. */
  private openDictionary(): Promise<void> {
    const social = this.options.social;
    if (!social) return Promise.resolve();
    return this.withDialog(async () => {
      const [summary, items] = await Promise.all([
        this.visitorView(visit => social.api.dictionary(visit)),
        social.dictionaryItems().catch(() => new Map<string, DictionaryItemInfo>()),
      ]);
      if (!summary || this.disposed) return;
      await new Promise<void>((resolve, reject) => {
        const pictures = social.dictionaryPictures?.();
        openMyRoomDictionary({
          library: this.options.library as unknown as MyRoomCareerLibrary,
          root: this.options.root, summary, items, editable: summary.owner,
          ...(pictures ? { pictures } : {}),
          claim: async () => {
            const claim = await social.api.claimDictionaryReward();
            social.refreshAccount();
            return claim;
          },
          notice: (title, message) => social.notice(title, message),
          onClose: () => {
            this.dictionary = undefined;
            resolve();
            if (!this.disposed) this.sceneView?.canvas.focus();
          },
        }).then(window => {
          if (this.disposed) window.dispose();
          else this.dictionary = window;
        }, error => {
          pictures?.dispose();
          reject(error);
        });
      });
    });
  }

  private openFindRider(): Promise<void> {
    const social = this.options.social;
    if (!social) return Promise.resolve();
    return this.withDialog(() => new Promise<void>((resolve, reject) => {
      openFindRiderDialog({
        library: this.options.library, root: this.options.root, friends: social.friends(),
        submit: (nickname, dialog) => {
          dialog.setBusy(true);
          void this.enterRoom({ nickname }).then(entered => {
            if (entered) dialog.close();
            else dialog.setBusy(false);
          });
        },
        onClose: () => {
          resolve();
          if (!this.disposed) this.sceneView?.canvas.focus();
        },
      }).catch(reject);
    }));
  }

  private randomVisit(): Promise<void> {
    return this.withDialog(async () => { await this.enterRoom({ random: true }); });
  }

  private openInventory(): void {
    if (this.inventoryOpen || this.admin || this.dialogBusy) return;
    this.inventoryOpen = true;
    void Promise.resolve().then(() => this.options.onOpenInventory()).catch(error => {
      this.inventoryOpen = false;
      this.setStatus(`打开我的物品失败：${String(error)}`);
    });
  }

  /** "管理" opens the release roomAdmin dialog. */
  private async openAdmin(): Promise<void> {
    if (this.admin || this.adminOpening || this.inventoryOpen || this.dialogBusy || this.disposed ||
        this.visiting) return;
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
    if (this.inventoryOpen || this.admin || this.dialogBusy || this.hud?.isChatting) return;
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
