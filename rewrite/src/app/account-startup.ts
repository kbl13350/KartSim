/**
 * The application side of the account (server-go/ECONOMY.md 7): the startup
 * login gate, equipment fallback for unowned or expired items, the account
 * onboarding dialog and keeping the live profile in step with the inventory.
 */
import { AccountServiceError, errorCode } from "../account/account-api";
import { showAccountMessage, showAccountToast, type OverlayDocument } from "../account/account-dialogs";
import {
  accountProfileSync, activeBrowserSession, backgroundTimer, clearAccountSession,
  installAccountSession, lastProfileLoad, setEquipmentRepairHandler,
} from "../account/account-runtime";
import { browserLoginGateDependencies, ensureAccountSession } from "../account/login-gate";
import {
  CATEGORY, STARTER, ownershipNow, sanitizeProfileEquipment, unownedSlots, type Ownership,
} from "../account/ownership";
import type { BrowserAccountSession } from "../account/browser-session";
import { startMessenger, stopMessenger } from "../messenger/messenger-runtime";
import { accountErrorMessages } from "../multiplayer/account-ui-support";
import {
  browserLocalStorage, claimTimeAttackRecords, clearAccountLocalData,
} from "./account-local-data";
import { saveLocalRiderNickname, type BrowserStorage } from "../multiplayer/account-local-state";
import type {
  RiderCatalog, RiderProfile, RiderRegistrationDependencies, StartupHost, StartupLibrary,
} from "./startup-resources";

/** Application fields the account code reads and updates. */
export interface AccountStartupHost {
  root: HTMLElement;
  hud: { showDebugText(message: string, level?: string): void };
  userProfile: RiderProfile;
  localNickname: string;
  rhoLibrary?: StartupLibrary;
  shell?: { current?: string; modal?: string };
  session: StartupHost["session"];
  newRiderDialog?: StartupHost["newRiderDialog"];
  toonStageBinding: StartupHost["toonStageBinding"];
  /** Time attack records restored before sign-in (cleared when another account signs in). */
  replayLibrary?: { summaries?: { clear(): void } };
  enterTimeAttackReady(): Promise<unknown>;
}

function pageDocument(host: AccountStartupHost): OverlayDocument {
  return host.root.ownerDocument as unknown as OverlayDocument;
}

function formatAccountError(error: unknown): string {
  const code = errorCode(error);
  return code && accountErrorMessages[code]
    ? accountErrorMessages[code]!
    : error instanceof Error ? error.message : String(error);
}

function rememberNickname(host: AccountStartupHost, nickname: string): void {
  saveLocalRiderNickname(nickname, () => localStorage);
  host.localNickname = nickname;
}

let expiryTimer: ReturnType<typeof setInterval> | undefined;
let repairTimer: ReturnType<typeof setTimeout> | undefined;
let attachedHost: AccountStartupHost | undefined;

/** The first profile save after onboarding did not reach the data service. */
export const PROFILE_NOT_SAVED_MESSAGE =
  "账号档案暂未保存到服务器：收藏、小屋等设置会在下次修改时再次保存。";

/**
 * Sign in before the profile loads. The session becomes current, the local
 * rider nickname follows the account, level ups show a toast and expired or
 * revoked logins return to the login dialog.
 */
export async function ensureStartupAccount(host: AccountStartupHost): Promise<void> {
  if (activeBrowserSession()) return;
  const session = await ensureAccountSession(browserLoginGateDependencies(host.root));
  attachAccountSession(host, session);
}

/** Install a signed-in session into the application (also used by tests). */
export function attachAccountSession(host: AccountStartupHost,
  session: BrowserAccountSession): void {
  installAccountSession(session);
  attachedHost = host;
  const username = session.summary()?.account.username;
  const storage = browserLocalStorage();
  if (username && storage && claimTimeAttackRecords(storage, username)) {
    // They were read at startup for the previous account.
    host.replayLibrary?.summaries?.clear();
  }
  const nickname = session.summary()?.account.nickname;
  if (nickname) rememberNickname(host, nickname);
  let knownNickname = nickname;
  session.subscribe(() => {
    const current = session.summary()?.account.nickname;
    if (current && current !== knownNickname) {
      knownNickname = current;
      rememberNickname(host, current);
    }
    scheduleEquipmentRepair(host);
  });
  session.onLevelUp(change => {
    const glove = change.summary.progress.gloveName;
    showAccountToast(pageDocument(host),
      `升级啦！Lv.${change.to}${glove ? ` · ${glove}` : ""}`, 5_000);
  });
  session.onExpired(reason => {
    stopMessenger();
    void returnToLogin(host.root, reason === "replaced"
      ? "您的账号已在其他地方登录，这里的登录已失效。如果不是您本人操作，请尽快修改密码。"
      : "登录已失效，请重新登录。");
  });
  setEquipmentRepairHandler(() => repairAccountEquipment(host));
  // 好友聊天系统: friends see this account online from now on.
  startMessenger(session);
  if (expiryTimer !== undefined) clearInterval(expiryTimer);
  // Rentals run out while playing; re-read the inventory once one has expired.
  expiryTimer = backgroundTimer(setInterval(() => {
    const active = activeBrowserSession();
    if (!active) return;
    const now = active.serverNow();
    if (active.inventory().some(item => item.expiresAt !== null && item.expiresAt <= now))
      void active.refresh().catch(() => undefined);
  }, 60_000));
}

/**
 * Logout or an expired login: forget the session, sign in again over the
 * current page and reload so every view starts from the new account.
 */
export async function returnToLogin(root: HTMLElement, message?: string): Promise<void> {
  stopMessenger();
  clearAccountSession();
  if (expiryTimer !== undefined) clearInterval(expiryTimer);
  expiryTimer = undefined;
  setEquipmentRepairHandler(undefined);
  const document = root.ownerDocument as unknown as OverlayDocument;
  if (message) await showAccountMessage(document, "账号", message, "重新登录");
  await ensureAccountSession(browserLoginGateDependencies(root));
  window.location.reload();
}

/**
 * The account profile could not be read at startup: show why in Chinese and
 * resolve when the player chooses 重试. An expired login is already handled
 * by returnToLogin (sign in again, then reload), so this waits for that.
 */
export async function retryStartupProfile(host: AccountStartupHost,
  error: unknown): Promise<void> {
  if (!activeBrowserSession()) return new Promise<void>(() => {});
  await showAccountMessage(pageDocument(host), "账号档案",
    `无法读取账号档案：${formatAccountError(error)}`, "重试");
}

/**
 * Log out (best effort on the service), forget the account's cached browser
 * data (account-local-data.ts) and show the login dialog.
 */
export async function logoutAccount(root: HTMLElement,
  storage: BrowserStorage | undefined = browserLocalStorage()): Promise<void> {
  const session = activeBrowserSession();
  stopMessenger();
  if (session) await session.logout();
  if (storage) clearAccountLocalData(storage);
  await returnToLogin(root);
}

function catalogPresent(profile: RiderProfile, catalog: RiderCatalog): RiderProfile {
  const itemIds = profile.equipment.itemIds;
  const kartId = itemIds[CATEGORY.kart] ?? 0;
  const systemKart = profile.equipment.systemKart as string | undefined;
  const kartListed = catalog.karts.some(kart => kart.itemId === kartId &&
    (kartId !== 0 || (kart as { systemKey?: string }).systemKey === systemKart));
  const characterListed = catalog.characters.some(character =>
    character.itemId === itemIds[CATEGORY.character]);
  if (kartListed && characterListed) return profile;
  const { systemKartVariant: _variant, ...equipment } = profile.equipment;
  const nextIds: Record<number, number> = { ...itemIds };
  if (!kartListed) nextIds[CATEGORY.kart] = STARTER.kart.itemId;
  if (!characterListed) nextIds[CATEGORY.character] = STARTER.defaultCharacter;
  return {
    ...profile,
    equipment: {
      ...(kartListed ? profile.equipment : {
        ...equipment, systemKart: STARTER.kart.systemKey, kartSerial: 0, exceedType: 0,
      }),
      itemIds: nextIds,
    },
  };
}

/**
 * Startup fallback for unowned or expired equipment (ECONOMY.md 4.3). A new
 * account owns nothing yet and starts from the practice kart and the default
 * starter character so `resolveStartupSelection` can open Ready.
 */
export function sanitizeStartupProfile(profile: RiderProfile, catalog: RiderCatalog,
  saveProfile: (profile: RiderProfile) => void): RiderProfile {
  const session = activeBrowserSession();
  if (!session) return profile;
  const owned = sanitizeProfileEquipment(profile as RiderProfile & {
    equipment: RiderProfile["equipment"] & { itemIds: Record<number, number> } }, session);
  const next = catalogPresent(owned, catalog);
  const load = lastProfileLoad();
  // A salvaged document keeps the server copy until the player saves something:
  // the defaults that replaced its invalid sections are not written back.
  const write = load?.salvaged !== true &&
    (next !== profile || load?.fromServer === false || load?.mergedLocal === true);
  if (write && session.summary()?.onboarded) {
    try {
      saveProfile(next);
    } catch (error) {
      console.warn("启动装备修正未保存", error);
    }
  }
  return next;
}

/** The first-rider dialog runs until the account has claimed its starter kit. */
export function accountNeedsRiderRegistration(): boolean {
  const session = activeBrowserSession();
  return !!session && session.summary()?.onboarded !== true;
}

function selectionFor(host: AccountStartupHost, catalog: RiderCatalog,
  equipment: RiderProfile["equipment"]): boolean {
  const selection = host.session.selection;
  if (!selection) return false;
  const kartId = equipment.itemIds[CATEGORY.kart] ?? 0;
  const systemKart = equipment.systemKart as string | undefined;
  const kart = catalog.karts.find(item => item.itemId === kartId &&
    (kartId !== 0 || (item as { systemKey?: string }).systemKey === systemKart)) as
    { itemId: number; path?: string; systemKey?: string; title?: string } | undefined;
  const character = catalog.characters.find(item =>
    item.itemId === equipment.itemIds[CATEGORY.character]);
  if (!kart?.path || !character) return false;
  const changed = selection.vehicleItemId !== kart.itemId ||
    selection.vehiclePath !== kart.path || selection.characterItemId !== character.itemId;
  host.session.selection = {
    ...selection,
    vehiclePath: kart.path, vehicleItemId: kart.itemId, vehicleSystemKey: kart.systemKey,
    characterPath: character.path, characterItemId: character.itemId,
  };
  if (kart.title) host.session.vehicleTitle = kart.title;
  return changed;
}

let saveLiveProfile: ((profile: RiderProfile) => void) | undefined;

/** The generated app passes its profile writer (cT) once. */
export function setAccountProfileWriter(writer: (profile: RiderProfile) => void): void {
  saveLiveProfile = writer;
}

function readyIdle(host: AccountStartupHost): boolean {
  return host.shell?.current === "Ready" && !host.shell.modal;
}

/** Outside a race in the lobby: rooms send this profile's equipment (create/join/equipment). */
function inMultiplayerLobby(host: AccountStartupHost): boolean {
  return host.shell?.current === "MultiplayerLobby";
}

function scheduleEquipmentRepair(host: AccountStartupHost): void {
  const session = activeBrowserSession();
  if (!session || session.summary()?.onboarded !== true) return;
  if (!unownedSlots(host.userProfile.equipment, session).length) return;
  if (repairTimer !== undefined) return;
  repairTimer = backgroundTimer(setTimeout(() => {
    repairTimer = undefined;
    void repairAccountEquipment(host);
  }, 0));
}

/**
 * Replace equipment the inventory no longer covers in the live profile, save
 * it, and rebuild Ready when the kart or rider changed. In the multiplayer
 * lobby the profile is repaired at once (rooms send it) and Ready is rebuilt
 * when the lobby closes; during a race or another Ready dialog the repair
 * waits until Ready is idle again.
 */
export async function repairAccountEquipment(host: AccountStartupHost,
  rebuildReady = true): Promise<void> {
  const session = activeBrowserSession();
  if (!session || session.summary()?.onboarded !== true) return;
  const ownership: Ownership = session;
  const now = ownershipNow(ownership);
  if (!unownedSlots(host.userProfile.equipment, ownership, now).length) return;
  const lobby = inMultiplayerLobby(host);
  if (rebuildReady && !lobby && !readyIdle(host)) {
    if (repairTimer === undefined) {
      repairTimer = backgroundTimer(setTimeout(() => {
        repairTimer = undefined;
        void repairAccountEquipment(host);
      }, 5_000));
    }
    return;
  }
  const library = host.rhoLibrary;
  if (!library) return;
  const catalog = await library.timeAttackGarageCatalog();
  const next = catalogPresent(sanitizeProfileEquipment(host.userProfile as RiderProfile & {
    equipment: RiderProfile["equipment"] & { itemIds: Record<number, number> } },
  ownership, now), catalog);
  host.userProfile = next;
  try {
    saveLiveProfile?.(next);
  } catch (error) {
    host.hud.showDebugText(`装备修正未保存：${String(error)}`, "error");
  }
  if (selectionFor(host, catalog, next.equipment)) {
    showAccountToast(pageDocument(host), "部分装备已到期，已换回默认装备。");
    if (rebuildReady && !lobby) await host.enterTimeAttackReady().catch(error => host.hud.showDebugText(
      `装备到期后刷新失败：${error instanceof Error ? error.message : String(error)}`, "error"));
  }
}

/**
 * A game node refused the equipment (403 ITEM_NOT_OWNED): re-read the
 * inventory and replace unowned items now; Ready is rebuilt when the lobby closes.
 */
export async function repairEquipmentForMultiplayer(): Promise<void> {
  const session = activeBrowserSession();
  const host = attachedHost;
  if (!session || !host) return;
  await session.refresh().catch(() => undefined);
  await repairAccountEquipment(host, false);
}

/**
 * Account onboarding (ECONOMY.md 4): the release new-rider dialog restricted
 * to 皮蛋/黑妞 and the CN starter colors, starting from the account nickname.
 * A changed name goes through auth/nickname; then the starter kit is claimed
 * and Ready reopens with the practice kart and the chosen rider.
 */
export async function registerAccountRider(host: AccountStartupHost,
  dependencies: RiderRegistrationDependencies): Promise<void> {
  const session = activeBrowserSession();
  if (!session) return;
  const account = session.summary()?.account;
  if (session.summary()?.onboarded) {
    // Already registered (for example the ghost menu's nickname reset): keep the account name.
    if (account) rememberNickname(host, account.nickname);
    host.hud.showDebugText("账号昵称请在大厅点击头像，在账号面板中修改。");
    return;
  }
  const library = host.rhoLibrary;
  if (!library) return;
  const catalog = await library.timeAttackGarageCatalog();
  const kart = catalog.karts.find(item => item.itemId === STARTER.kart.itemId &&
    (item as { systemKey?: string }).systemKey === STARTER.kart.systemKey) ??
    catalog.karts.find(item => item.itemId === host.session.selection?.vehicleItemId);
  if (!kart) throw new Error("新车手注册缺少练习用卡丁车资源。");
  const starterColors = (kind: string) => catalog.equipment
    .filter(item => item.kind === kind && (STARTER.colors as readonly number[]).includes(item.itemId))
    .map(({ itemId, title }) => ({ itemId, title }));
  const environment = await dependencies.loadEnvironment(library);
  const document = pageDocument(host);
  try {
    host.newRiderDialog ??= await dependencies.loadDialog(library, host.root, {
      characters: catalog.characters
        .filter(item => (STARTER.characters as readonly number[]).includes(item.itemId))
        .map(({ itemId, title }) => ({ itemId, title })),
      paints: starterColors("color"),
      dyes: starterColors("dye"),
      defaults: {
        character: STARTER.defaultCharacter, paint: STARTER.defaultPaint, dye: STARTER.defaultDye,
      },
    }, {
      library, environment, stageBinding: host.toonStageBinding, kartItem: kart,
      characterItems: catalog.characters, profile: host.userProfile,
    });
    let name = account?.nickname ?? "";
    let choice: Awaited<ReturnType<NonNullable<StartupHost["newRiderDialog"]>["open"]>>;
    for (;;) {
      choice = await host.newRiderDialog.open({ name, maxLength: 16 });
      name = choice.name;
      try {
        if (choice.name !== session.summary()?.account.nickname)
          await session.updateNickname(choice.name);
        await session.claimStarter({ character: choice.characterItemId,
          paint: choice.paintItemId, dye: choice.dyeItemId });
        break;
      } catch (error) {
        if (errorCode(error) === "STARTER_ALREADY_CLAIMED" || errorCode(error) === "ALREADY_OWNED") {
          await session.refresh().catch(() => undefined);
          if (session.summary()?.onboarded) break;
        }
        await showAccountMessage(document, "新车手注册", formatAccountError(error), "重新填写");
      }
    }
    if (!session.summary()?.onboarded)
      throw new AccountServiceError("ONBOARDING_REQUIRED");
    const profile = host.userProfile;
    const { systemKartVariant: _variant, ...equipment } = profile.equipment;
    const starterProfile: RiderProfile = {
      ...profile,
      equipment: {
        ...equipment,
        systemKart: STARTER.kart.systemKey, kartSerial: 0, exceedType: 0,
        itemIds: {
          ...profile.equipment.itemIds,
          [CATEGORY.character]: choice.characterItemId,
          [CATEGORY.paint]: choice.paintItemId,
          [CATEGORY.kart]: STARTER.kart.itemId,
          [CATEGORY.dye]: choice.dyeItemId,
        },
      },
    };
    host.userProfile = sanitizeProfileEquipment(starterProfile as RiderProfile & {
      equipment: RiderProfile["equipment"] & { itemIds: Record<number, number> } }, session);
    dependencies.saveProfile(host.userProfile);
    dependencies.saveNickname(choice.name);
    host.localNickname = choice.name;
    selectionFor(host, catalog, host.userProfile.equipment);
    await host.enterTimeAttackReady();
    showAccountToast(document, "新手礼包已放入车库：练习用卡丁车、角色与喷漆染色。", 5_000);
  } finally {
    host.newRiderDialog?.dispose();
    host.newRiderDialog = undefined;
    host.toonStageBinding.retain(environment);
    environment.dispose();
  }
  // Until this first save lands the server holds only the starter equipment,
  // so the migrated favorites and My Room settings would be lost at the next login.
  const sync = accountProfileSync();
  if (sync && !(await sync.settled())) {
    showAccountToast(document, PROFILE_NOT_SAVED_MESSAGE, 6_000);
    host.hud.showDebugText(PROFILE_NOT_SAVED_MESSAGE, "error");
  }
}
