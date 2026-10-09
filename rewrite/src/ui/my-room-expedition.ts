import { T } from "../generated/formats.js";
import { F9 } from "../generated/library.js";
import {
  crewBonus, crewDeparts, characterBonus, friendBonus, kartBonus, missionPayout,
  type CrewMember, type ExpeditionApi, type ExpeditionCharacter, type ExpeditionCrew, type ExpeditionFriend,
  type ExpeditionKart, type ExpeditionMission, type ExpeditionPair, type ExpeditionTokenAction, type ExpeditionView,
} from "../myroom/expedition-api";
import { BmlCanvas, STAGE, loadBmlShared, releaseBmlShared, type BmlHooks, type BmlLibrary, type BmlNode,
  type BmlShared, type Rect } from "./bml-canvas";
import type { DictionaryItemInfo, DictionaryPictureSource } from "./my-room-dictionary";

/**
 * The release 赛车探险队 window (dialog/racingExpeditionDialog mq_dialog@zz):
 * the week's mission list (missionButton cards with the track, attribute,
 * state, time and rewards), the selected mission's crew (three character +
 * kart pairs and a friend, chosen in racingExpeditionSelectCrewDialog), its
 * progress while out, and its reward when back. 探险币 shorten, finish,
 * swap and add missions (mqUseRacingTokendialog@zz).
 */

export interface ExpeditionTracks {
  title(trackId: string): string | undefined;
  /** The track's xt_trackCard thumbnail. */
  card(trackId: string): Promise<CanvasImageSource | undefined>;
}

export interface MyRoomExpeditionOptions {
  library: BmlLibrary;
  root: HTMLElement;
  api: ExpeditionApi;
  view: ExpeditionView;
  crew: ExpeditionCrew;
  /** Names (shop catalog) by "category:itemId". */
  items: ReadonlyMap<string, DictionaryItemInfo>;
  pictures?: DictionaryPictureSource;
  tracks: ExpeditionTracks;
  /** A box's or token's stuff.rho icon. */
  stuffIcon(category: number, itemId: number): CanvasImageSource | undefined;
  notice(title: string, message: string): Promise<unknown> | void;
  /** The wallet or inventory changed (rewards, tokens). */
  onAccountChange(): void;
  onClose(): void;
}

export interface MyRoomExpeditionWindow {
  render(): void;
  dispose(): void;
}

const MAIN = "dialog/racingExpeditionDialog";
const CREW = "dialog/racingExpeditionSelectCrewDialog";
const FONT_FAMILY = "KartSim Expedition";
const MISSION_STEP = 188;
const CREW_STEP = { x: 172, y: 194 };
const SPECIFIC_KEYS = ["boomHill", "world", "earth", "forest", "ocean", "legend", "mystery", "special"];

const attribute = (node: BmlNode, name: string): string | undefined => T(node, name) as string | undefined;
const percent = (tenths: number): string => (tenths / 10).toFixed(1);
const itemKey = (category: number, itemId: number): string => `${category}:${itemId}`;

interface Draft {
  members: Array<{ character?: number; kart?: ExpeditionKart }>;
  friend?: string;
}

type Overlay =
  | { kind: "crew"; member: number; character?: number; kart?: ExpeditionKart; charScroll: number; kartScroll: number }
  | { kind: "friend"; friend?: string; scroll: number }
  | { kind: "token"; action: ExpeditionTokenAction; slot: number; count: number };

/** "2天3小时", "5小时20分", "不到1分钟" with the window's strings. */
export function expeditionDuration(ms: number, strings: { day: string; hour: string; minute: string;
  lessThan1Minute: string }): string {
  if (ms < 60_000) return strings.lessThan1Minute;
  const minutes = Math.floor(ms / 60_000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor(minutes % 1440 / 60);
  const rest = minutes % 60;
  if (days > 0) return `${days}${strings.day}${hours > 0 ? `${hours}${strings.hour}` : ""}`;
  if (hours > 0) return `${hours}${strings.hour}${rest > 0 ? `${rest}${strings.minute}` : ""}`;
  return `${rest}${strings.minute}`;
}

/**
 * Up to three pairs for a mission: a matching character and kart first,
 * then the others, karts by upgrade level (自动填充).
 */
export function autoFillCrew(mission: Pick<ExpeditionMission, "specific">, crew: ExpeditionCrew,
  busy: { characters: Set<number>; karts: Set<string> }): Draft["members"] {
  const characters = crew.characters.filter(item => !busy.characters.has(item.itemId))
    .sort((a, b) => Number(b.specific === mission.specific) - Number(a.specific === mission.specific));
  const karts = crew.karts.filter(item => !busy.karts.has(kartId(item)))
    .sort((a, b) => Number(b.specific === mission.specific) - Number(a.specific === mission.specific) ||
      b.level - a.level || b.parts - a.parts);
  const members: Draft["members"] = [];
  for (let index = 0; index < 3 && index < characters.length && index < karts.length; index++)
    members.push({ character: characters[index]!.itemId, kart: karts[index] });
  while (members.length < 3) members.push({});
  return members;
}

function kartId(kart: Pick<ExpeditionKart, "itemId" | "kartKey">): string {
  return kart.itemId === 0 ? `0:${kart.kartKey ?? ""}` : String(kart.itemId);
}

export async function openMyRoomExpedition(options: MyRoomExpeditionOptions): Promise<MyRoomExpeditionWindow> {
  const bml = (folder: string, name: string) => F9(options.library, folder, name) as Promise<BmlNode>;
  const [shared, main, card, crew, crewCard, friendCard, friendDialog, token] = await Promise.all([
    loadBmlShared(options.library, FONT_FAMILY, [[MAIN, "stringBag"], [CREW, "stringBag"]]),
    bml(MAIN, "mq_dialog@zz"), bml(MAIN, "missionButton@zz"), bml(CREW, "mq_dialog@zz"),
    bml(CREW, "crewButton@zz"), bml(CREW, "friendButton@zz"), bml(CREW, "mqSelectFriendDialog@zz"),
    bml(MAIN, "mqUseRacingTokendialog@zz"),
  ]);
  return new ExpeditionWindow(options, shared, { main, card, crew, crewCard, friendCard, friendDialog, token });
}

interface Layouts {
  main: BmlNode;
  card: BmlNode;
  crew: BmlNode;
  crewCard: BmlNode;
  friendCard: BmlNode;
  friendDialog: BmlNode;
  token: BmlNode;
}

class ExpeditionWindow implements MyRoomExpeditionWindow {
  private readonly canvas: BmlCanvas;
  private view: ExpeditionView;
  private crew: ExpeditionCrew;
  private selected?: number;
  private readonly drafts = new Map<number, Draft>();
  private scroll = 0;
  private listRect?: Rect;
  private overlay?: Overlay;
  private overlayLists: Array<{ rect: Rect; scroll(delta: number): void }> = [];
  private busy = false;
  /** Server time minus Date.now(). */
  private clockOffset: number;
  private readonly timer: ReturnType<typeof setInterval>;
  private readonly pictures = new Map<string, HTMLCanvasElement | null>();
  private readonly picturePending = new Set<string>();
  private readonly trackCards = new Map<string, CanvasImageSource | null>();
  // What the drawing is inside of (depth-first, synchronous).
  private card?: ExpeditionMission | "add";
  private member = -1;
  private slotKind?: "character" | "kart";
  private crewItem?: { character?: ExpeditionCharacter; kart?: ExpeditionKart };
  private friendItem?: ExpeditionFriend;
  private disposed = false;

  constructor(readonly options: MyRoomExpeditionOptions, readonly shared: BmlShared, readonly layouts: Layouts) {
    this.view = options.view;
    this.crew = options.crew;
    this.clockOffset = this.view.serverTime - Date.now();
    this.selected = this.view.missions[0]?.slot;
    this.canvas = new BmlCanvas({
      root: options.root, shared, folders: [MAIN, CREW, "dialog/itemDictionary", "stage_/common"],
      label: this.text("expeditionCaption") ?? "赛车探险队",
      paint: () => this.paint(),
      onKeyDown: event => this.onKeyDown(event),
      onWheel: (event, point) => this.onWheel(event, point),
    });
    this.timer = setInterval(() => this.tick(), 1000);
    this.canvas.render();
    this.canvas.focus();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    clearInterval(this.timer);
    this.canvas.dispose();
    try { this.options.pictures?.dispose(); } catch { /* Best effort. */ }
    for (const picture of this.pictures.values()) if (picture) picture.width = picture.height = 0;
    releaseBmlShared(this.shared);
  }

  private close(): void {
    if (this.busy) return;
    this.dispose();
    this.options.onClose();
  }

  private text(key: string): string | undefined { return this.shared.strings.get(key); }
  render(): void { this.canvas.render(); }
  private now(): number { return Date.now() + this.clockOffset; }

  private durationText(ms: number): string {
    return expeditionDuration(ms, { day: this.text("day") ?? "天", hour: this.text("hour") ?? "小时",
      minute: this.text("minute") ?? "分", lessThan1Minute: this.text("lessThan1Minute") ?? "不到1分钟" });
  }

  /** A mission's state now (a running crew comes back on its own). */
  private stateOf(mission: ExpeditionMission): ExpeditionMission["state"] {
    return mission.state === "running" && this.now() >= mission.ends ? "done" : mission.state;
  }

  private selectedMission(): ExpeditionMission | undefined {
    return this.view.missions.find(mission => mission.slot === this.selected);
  }

  private draft(slot: number): Draft {
    let draft = this.drafts.get(slot);
    if (!draft) {
      draft = { members: [{}, {}, {}] };
      this.drafts.set(slot, draft);
    }
    return draft;
  }

  /** The characters and karts out on missions now. */
  private busyCrew(): { characters: Set<number>; karts: Set<string> } {
    const busy = { characters: new Set<number>(), karts: new Set<string>() };
    for (const mission of this.view.missions) {
      if (this.stateOf(mission) !== "running") continue;
      for (const pair of mission.crew) {
        busy.characters.add(pair.character);
        busy.karts.add(kartId({ itemId: pair.kart, ...(pair.kartKey ? { kartKey: pair.kartKey } : {}) }));
      }
    }
    return busy;
  }

  private character(id: number | undefined): ExpeditionCharacter | undefined {
    return id === undefined ? undefined : this.crew.characters.find(item => item.itemId === id);
  }

  private members(draft: Draft): CrewMember[] {
    return draft.members.flatMap(member => {
      const character = this.character(member.character);
      return character && member.kart ? [{ characterSpecific: character.specific,
        kartSpecific: member.kart.specific, kartLevel: member.kart.level, kartParts: member.kart.parts }] : [];
    });
  }

  private friend(id: string | undefined): ExpeditionFriend | undefined {
    return id ? this.crew.friends.find(friend => friend.accountId === id) : undefined;
  }

  private name(category: number, itemId: number): string {
    return this.options.items.get(itemKey(category, itemId))?.name ?? String(itemId);
  }

  private picture(category: number, itemId: number): HTMLCanvasElement | undefined {
    const key = itemKey(category, itemId);
    const cached = this.pictures.get(key);
    if (cached !== undefined) return cached ?? undefined;
    const source = this.options.pictures;
    if (source && !this.picturePending.has(key) && itemId > 0) {
      this.picturePending.add(key);
      const internalId = this.options.items.get(key)?.internalId ?? "";
      void source.picture(category, itemId, internalId, new AbortController().signal).then(picture => {
        this.picturePending.delete(key);
        if (this.disposed) return;
        this.pictures.set(key, picture ?? null);
        this.render();
      }, () => {
        this.picturePending.delete(key);
        this.pictures.set(key, null);
      });
    }
    return undefined;
  }

  private trackCard(trackId: string): CanvasImageSource | undefined {
    if (this.trackCards.has(trackId)) return this.trackCards.get(trackId) ?? undefined;
    this.trackCards.set(trackId, null);
    void this.options.tracks.card(trackId).then(image => {
      this.trackCards.set(trackId, image ?? null);
      if (image) this.render();
    }, () => undefined);
    return undefined;
  }

  private tick(): void {
    if (this.disposed) return;
    if (this.view.missions.some(mission => mission.state === "running") || !this.view.missions.length) this.render();
  }

  /* ---------- painting ---------- */

  private paint(): void {
    this.overlayLists = [];
    this.member = -1;
    this.slotKind = undefined;
    this.rewardKind = undefined;
    this.canvas.drawTree(this.layouts.main, STAGE, this.mainHooks());
    const overlay = this.overlay;
    // The dialog's dimmed panel takes the clicks meant for the window under it.
    if (overlay) this.canvas.addButton("overlay", STAGE, "", () => undefined);
    if (overlay?.kind === "crew") this.canvas.drawTree(this.layouts.crew, STAGE, this.crewHooks(overlay));
    if (overlay?.kind === "friend") this.canvas.drawTree(this.layouts.friendDialog, STAGE, this.friendHooks(overlay));
    if (overlay?.kind === "token") this.canvas.drawTree(this.layouts.token, STAGE, this.tokenHooks(overlay));
  }

  private mainHooks(): BmlHooks {
    const mission = this.selectedMission();
    const state = mission ? this.stateOf(mission) : undefined;
    const draft = mission && (state === "ready" || state === "blocked") ? this.draft(mission.slot) : undefined;
    const allDone = this.view.missions.length === 0 && this.view.started >= this.view.limit;
    const blocked = !!this.overlay || this.busy;
    return {
      visible: (node, name) => {
        switch (name) {
          case "expeditionContainer":
          case "bonusTimeRewardContainer": return !!draft;
          case "autoFillBtn": return !!draft && this.members(draft).length === 0;
          case "autoFillOffBtn": return !!draft && this.members(draft).length > 0;
          case "startBtn": return !!draft;
          case "expeditionInprogressContainer": return state === "running";
          case "expeditionWaitForGetRewardContainer": return state === "done";
          case "expeditionAllCompleteMissionContainer": return !mission && allDone;
          case "expeditionNoAvailableMissionContainer": return !mission && !allDone;
          case "missionCardTutorialBg":
          case "missionCardPanelBg":
          case "coupleIcon":
          case "missionProgressBar_g": return false;
        }
        const member = /^selectedExpeditionCrewCon_(\d)$/.exec(name);
        if (member) this.member = Number(member[1]);
        if (draft && this.member >= 0 && this.member < 3) {
          const filled = !!draft.members[this.member]?.character;
          if (name === "selectCrewBtn") return !filled;
          if (name === "deleteCrewBtn" || name === "selectCrewBgBtn" || name === "selectKartBgBtn") return filled;
          if (name === "12TuningLevel") return (draft.members[this.member]?.kart?.level ?? 0) > 0;
          if (name === "specificIcon") return filled;
        }
        if (name === "selectedExpeditionFriendCon") this.member = 3;
        if (draft && this.member === 3) {
          if (name === "selectFriendBtn") return !draft.friend;
          if (name === "deleteFriendBtn" || name === "selectFriendBgBtn") return !!draft.friend;
        }
        const reward = /^rewardContainer_(Rp|Lucci|Stock)$/.exec(name);
        if (mission && reward) {
          this.rewardKind = reward[1] === "Rp" ? "rp" : reward[1] === "Lucci" ? "lucci" : "stock";
          return this.rewardKind === "rp" ? mission.exp > 0 : this.rewardKind === "lucci" ? mission.lucci > 0
            : mission.reward.items.length > 0;
        }
        void node;
        return undefined;
      },
      draw: (node, name, rect) => {
        if (name === "missionList") {
          this.drawMissionList(rect);
          return true;
        }
        if (name === "selectCrewBgBtn") this.slotKind = "character";
        if (name === "selectKartBgBtn") this.slotKind = "kart";
        if (name === "selectedCrew" && draft && this.member < 3) {
          const member = draft.members[this.member];
          if (this.slotKind === "character" && member?.character)
            this.canvas.drawFitted(this.picture(1, member.character), rect, 1.2);
          if (this.slotKind === "kart" && member?.kart)
            this.canvas.drawFitted(this.picture(3, member.kart.itemId), rect, 1.2);
          return true;
        }
        if (name === "selectedFriend" && draft?.friend) {
          const friend = this.friend(draft.friend);
          if (friend) this.canvas.drawFitted(this.picture(1, friend.character), { ...rect, y: rect.y + 16,
            height: rect.height - 16 }, 1.2);
          return false;
        }
        if (name === "missionProgressBar" && mission && state === "running") {
          this.drawProgress(node, rect, mission);
          return true;
        }
        if (name === "missionResetProgressBar") {
          const week = 7 * 24 * 3_600_000;
          const done = Math.min(1, Math.max(0, (this.now() - this.view.weekStart) / week));
          const image = this.canvas.texture(attribute(node, "texture"));
          if (image) this.canvas.context.drawImage(image, rect.x, rect.y, rect.width * done, rect.height);
          return true;
        }
        if (name === "rewardPanel" && mission) {
          this.drawRewardPanel(node, rect, mission);
          return true;
        }
        return false;
      },
      image: (node, name) => {
        if (name === "specificIcon" && draft && this.member < 3) {
          const member = draft.members[this.member];
          const specific = this.slotKind === "kart" ? member?.kart?.specific : this.character(member?.character)?.specific;
          return specific === undefined ? undefined : this.canvas.texture(`tag_theme_${specific}@zz`);
        }
        if (name === "12TuningLevel" && draft && this.member < 3) {
          const level = Math.min(5, draft.members[this.member]?.kart?.level ?? 0);
          return this.canvas.texture(`tuning_mark_s_${level}`);
        }
        if (name === "selectCrewBgBtn" && draft && mission) {
          const specific = this.character(draft.members[this.member]?.character)?.specific;
          const state = this.canvas.state(`crew:${this.member}:character`);
          return this.canvas.seriesSprite(specific === mission.specific ? "slotItem_character_" : "slotItem_noReward_",
            state);
        }
        void node;
        return undefined;
      },
      label: (node, name) => this.mainLabel(node, name, mission, draft),
      button: (node, name) => blocked ? undefined : this.mainButton(name, mission, draft),
    };
  }

  private mainLabel(node: BmlNode, name: string, mission: ExpeditionMission | undefined,
    draft: Draft | undefined): string | null | undefined {
    switch (name) {
      case "myTokenLbl": return String(this.view.tokens);
      case "missionCountLbl": return (this.text("missionTotalCount") ?? "%d/%d")
        .replace("%d", String(this.view.started)).replace("%d", String(this.view.limit));
      case "friendNameLbl": return this.friend(draft?.friend)?.nickname ?? null;
      case "missionTrackName": return mission ? this.options.tracks.title(mission.trackId) ?? mission.trackId : null;
      case "missionTime": return mission ? this.durationText(Math.max(0, mission.ends - this.now())) : null;
      case "missionReduceTimeBtn": return String(this.view.rules.basic.reduceTimeTokens);
      case "missionCompleteBtn": return mission ? String(this.completeCost(mission)) : null;
      case "missionResetTime": return this.durationText(Math.max(0, this.view.weekEnds - this.now()));
    }
    if (name === "bonusTime" || name === "bonusReward") {
      if (!mission || !draft) return null;
      const bonus = crewBonus(this.view.rules, mission, this.members(draft), this.friend(draft.friend)?.specific);
      const value = name === "bonusTime" ? bonus.time : bonus.reward;
      const key = name === "bonusTime" ? (value > 0 ? "timeBonus" : "timeBonusNoreward")
        : value > 0 ? "rewardBonus" : "rewardBonusNoreward";
      return (this.text(key) ?? "%.1f%%").replace("%.1f%%", `${percent(value)}%`);
    }
    if (name === "bonusDesc") {
      if (mission && this.stateOf(mission) === "done") {
        const item = mission.reward.items[0];
        if (this.rewardKind === "rp") return `${this.text("rp") ?? "经验"} +${mission.exp}`;
        if (this.rewardKind === "lucci") return `${this.text("lucci") ?? "金币"} +${mission.lucci}`;
        if (this.rewardKind === "stock" && item)
          return `${item.name || this.name(item.category, item.itemId)}${item.count > 1 ? ` ×${item.count}` : ""}`;
        return null;
      }
      if (!mission || !draft) return null;
      if (this.member === 3) {
        const friend = this.friend(draft.friend);
        return friend ? this.rewardText(friendBonus(this.view.rules, mission, friend.specific)) : null;
      }
      const member = draft.members[this.member];
      if (this.slotKind === "character") {
        const character = this.character(member?.character);
        return character ? this.rewardText(characterBonus(this.view.rules, mission, character.specific)) : null;
      }
      if (this.slotKind === "kart" && member?.kart) {
        const kart = kartBonus(this.view.rules, mission, member.kart.level, member.kart.parts);
        return this.timeText(kart.time);
      }
      return null;
    }
    void node;
    return undefined;
  }

  private rewardText(tenths: number): string {
    return (this.text(tenths > 0 ? "rewardBonus" : "rewardBonusNoreward") ?? "%.1f%%")
      .replace("%.1f%%", `${percent(tenths)}%`);
  }

  private timeText(tenths: number): string {
    return (this.text(tenths > 0 ? "timeBonus" : "timeBonusNoreward") ?? "%.1f%%")
      .replace("%.1f%%", `${percent(tenths)}%`);
  }

  private completeCost(mission: ExpeditionMission): number {
    const unit = this.view.rules.basic.reduceMinutes * 60_000;
    return Math.max(0, Math.ceil((mission.ends - this.now()) / unit)) * this.view.rules.basic.reduceTimeTokens;
  }

  private mainButton(name: string, mission: ExpeditionMission | undefined, draft: Draft | undefined) {
    switch (name) {
      case "close": return { activate: () => this.close(), label: this.text("close") ?? "关闭" };
      case "autoFillBtn": return mission && draft ? { activate: () => {
        draft.members = autoFillCrew(mission, this.crew, this.busyCrew());
        const friend = this.crew.friends.find(item => !item.usedToday && item.specific === mission.specific) ??
          this.crew.friends.find(item => !item.usedToday);
        if (friend) draft.friend = friend.accountId;
        this.render();
      } } : undefined;
      case "autoFillOffBtn": return draft ? { activate: () => {
        draft.members = [{}, {}, {}];
        delete draft.friend;
        this.render();
      } } : undefined;
      case "startBtn": return mission && draft ? {
        disabled: !crewDeparts(mission, this.members(draft)),
        activate: () => void this.start(mission, draft),
      } : undefined;
      case "selectCrewBtn":
      case "selectCrewBgBtn":
      case "selectKartBgBtn": {
        const member = this.member;
        if (!draft || member < 0 || member > 2) return undefined;
        return { key: `crew:${member}:${name}`, activate: () => {
          const current = draft.members[member] ?? {};
          this.overlay = { kind: "crew", member, ...(current.character ? { character: current.character } : {}),
            ...(current.kart ? { kart: current.kart } : {}), charScroll: 0, kartScroll: 0 };
          this.render();
        } };
      }
      case "deleteCrewBtn": {
        const member = this.member;
        if (!draft || member < 0 || member > 2) return undefined;
        return { key: `delete:${member}`, activate: () => {
          draft.members[member] = {};
          this.render();
        } };
      }
      case "selectFriendBtn":
      case "selectFriendBgBtn": return draft ? { key: `friend:${name}`, activate: () => {
        this.overlay = { kind: "friend", ...(draft.friend ? { friend: draft.friend } : {}), scroll: 0 };
        this.render();
      } } : undefined;
      case "deleteFriendBtn": return draft ? { activate: () => {
        delete draft.friend;
        this.render();
      } } : undefined;
      case "missionReduceTimeBtn": return mission ? { activate: () => {
        this.overlay = { kind: "token", action: "reduce", slot: mission.slot, count: 1 };
        this.render();
      } } : undefined;
      case "missionCompleteBtn": return mission ? { activate: () => {
        this.overlay = { kind: "token", action: "complete", slot: mission.slot, count: this.completeCost(mission) };
        this.render();
      } } : undefined;
      case "getReward": return mission ? { activate: () => void this.claim(mission) } : undefined;
    }
    return undefined;
  }

  private drawProgress(node: BmlNode, rect: Rect, mission: ExpeditionMission): void {
    const total = mission.ends - mission.started;
    const done = total > 0 ? Math.min(1, Math.max(0, (this.now() - mission.started) / total)) : 1;
    const image = this.canvas.texture(attribute(node, "texture"));
    if (image) this.canvas.context.drawImage(image, 0, 0, image.width * done, image.height, rect.x, rect.y,
      rect.width * done, rect.height);
  }

  private drawRewardPanel(node: BmlNode, rect: Rect, mission: ExpeditionMission): void {
    void node;
    const kind = this.rewardKind ?? "stock";
    if (kind === "rp") this.canvas.drawFitted(this.canvas.texture("icon_rp"), rect, 2);
    if (kind === "lucci") this.canvas.drawFitted(this.canvas.texture("icon_lucci"), rect, 2);
    if (kind === "stock") {
      const item = mission.reward.items[0];
      if (item && !this.canvas.drawFitted(this.options.stuffIcon(item.category, item.itemId), rect, 1.5))
        this.canvas.drawFitted(this.canvas.texture("icon_rewardBox"), rect, 2);
    }
  }

  private rewardKind?: "rp" | "lucci" | "stock";
  /** The mission card's bonus container being drawn. */
  private cardBonus?: "rp" | "lucci";

  /* ---------- mission list ---------- */

  private drawMissionList(area: Rect): void {
    const rect = { x: area.x, y: area.y, width: 604, height: 560 };
    this.listRect = rect;
    const cards: Array<ExpeditionMission | "add"> = [...this.view.missions];
    const addable = this.view.added < this.view.rules.basic.buyableMissions || this.view.missions.length > 0;
    if (addable) cards.push("add");
    const height = cards.length * MISSION_STEP;
    this.scroll = Math.max(0, Math.min(this.scroll, Math.max(0, height - rect.height)));
    const context = this.canvas.context;
    context.save();
    context.beginPath();
    context.rect(rect.x - 4, rect.y - 4, rect.width + 8, rect.height + 8);
    context.clip();
    cards.forEach((card, index) => {
      const y = rect.y + index * MISSION_STEP - this.scroll;
      if (y + MISSION_STEP < rect.y || y > rect.y + rect.height) return;
      this.card = card;
      try {
        this.canvas.drawTree(this.layouts.card, { x: rect.x, y, width: 604, height: 186 }, this.cardHooks());
      } finally {
        this.card = undefined;
      }
    });
    context.restore();
  }

  private cardHooks(): BmlHooks {
    const card = this.card;
    const mission = card === "add" ? undefined : card;
    const state = mission ? this.stateOf(mission) : undefined;
    const selected = mission && mission.slot === this.selected;
    const hoverKey = mission ? `mission:${mission.slot}` : "mission:add";
    const anyStarted = this.view.missions.every(item => item.state !== "ready" && item.state !== "blocked");
    const remaining = this.view.rules.basic.buyableMissions - this.view.added;
    const preview = mission && selected && (state === "ready" || state === "blocked")
      ? missionPayout(this.view.rules, mission, crewBonus(this.view.rules, mission, this.members(this.draft(mission.slot)),
        this.friend(this.draft(mission.slot).friend)?.specific)) : undefined;
    const blocked = !!this.overlay || this.busy;
    return {
      visible: (node, name) => {
        switch (name) {
          case "missionInfoContainer": return !!mission;
          case "missionBuyContainer": return !mission && anyStarted && remaining > 0;
          case "missionWaitingContainer": return !mission && !anyStarted && remaining > 0;
          case "missionNoneContainer": return !mission && remaining <= 0;
          case "missionListBgSelected": return !!selected;
          case "missionListBgOver": return this.canvas.hovered === hoverKey && !selected;
          case "missionState_InProgressArrow":
          case "missionCardPanelBg":
          case "missionCardTutorialBg":
          case "missionProgressBar_g": return false;
          case "missionCardAddTag": return !!mission?.added;
          case "missionProgressBar": return state === "running";
          case "missionProgressBar_complete": return state === "done";
          case "missionChangeBtn": return state === "ready" || state === "blocked";
          case "bonusRpContainer":
            this.cardBonus = "rp";
            return (preview?.exp ?? mission?.exp ?? 0) > 0;
          case "bonusLucciContainer":
            this.cardBonus = "lucci";
            return (preview?.lucci ?? mission?.lucci ?? 0) > 0;
        }
        void node;
        return undefined;
      },
      draw: (node, name, rect) => {
        if (name === "missionInfoContainer" && mission)
          this.canvas.addButton(hoverKey, { x: rect.x - 3, y: rect.y - 3, width: 604, height: 186 },
            this.options.tracks.title(mission.trackId) ?? mission.trackId, () => {
              if (blocked) return;
              this.selected = mission.slot;
              this.render();
            });
        if (attribute(node, "image") === "trackFrame" && mission) {
          this.canvas.drawFitted(this.trackCard(mission.trackId), { x: rect.x + 4, y: rect.y + 4,
            width: rect.width - 8, height: rect.height - 8 }, 3);
          return false;
        }
        if (name === "missionProgressBar" && mission) {
          this.drawProgress(node, rect, mission);
          return true;
        }
        return false;
      },
      after: (node, name, rect) => {
        if (name === "specificIcon" && mission) {
          this.canvas.drawRich(this.options.tracks.title(mission.trackId) ?? mission.trackId,
            { x: rect.x + rect.width + 6, y: rect.y - 6, width: 190, height: 34 },
            { size: 16, color: "rgb(42, 55, 80)", align: "left", verticalAlign: "center" });
        }
        if (name === "bonusStock" && mission) {
          const item = mission.reward.items[0];
          if (item && item.count > 1) this.canvas.drawRich(`×${item.count}`,
            { x: rect.x + rect.width - 4, y: rect.y + rect.height - 18, width: 40, height: 20 },
            { size: 14, color: "white", align: "left", verticalAlign: "center", stroke: 1,
              strokeColor: "rgba(0,0,0,0.9)" });
        }
      },
      image: (node, name) => {
        if (name === "specificIcon" && mission) return this.canvas.texture(`tag_theme_${mission.specific}@zz`);
        if (name === "missionState" && mission) return this.canvas.texture(
          state === "running" ? "mission_tag_y" : state === "done" ? "mission_tag_b"
            : state === "blocked" ? "mission_tag_d" : "mission_tag_g@zz");
        if (name === "bonusStock" && mission) {
          const item = mission.reward.items[0];
          return (item && this.options.stuffIcon(item.category, item.itemId)) || undefined;
        }
        void node;
        return undefined;
      },
      label: (node, name) => {
        if (!mission) {
          if (name === "expeditionMissionDesc" && attribute(node, "text")?.includes("addMissionDesc_1"))
            return (this.text("addMissionDesc_1") ?? "%d").replace("%d", String(remaining));
          if (name === "missionBuyBtn") return String(this.view.rules.basic.addMissionTokens);
          return undefined;
        }
        switch (name) {
          case "missionStateLbl": return this.text(state === "running" ? "inProgress" : state === "done" ? "complete"
            : state === "blocked" ? "cannotProgress" : "beforeStart") ?? null;
          case "missionTime": return state === "running" ? this.durationText(Math.max(0, mission.ends - this.now()))
            : state === "done" ? this.text("complete") ?? "" : `${mission.hours}${this.text("time") ?? "小时"}`;
          case "missionChangeBtn": return String(this.view.rules.basic.changeMissionTokens);
          case "bonusAmountLbl": return String(this.cardBonus === "rp" ? preview?.exp ?? mission.exp
            : preview?.lucci ?? mission.lucci);
        }
        return undefined;
      },
      button: (node, name) => {
        if (blocked) return undefined;
        if (name === "missionChangeBtn" && mission) return { key: `change:${mission.slot}`, activate: () => {
          this.overlay = { kind: "token", action: "change", slot: mission.slot,
            count: this.view.rules.basic.changeMissionTokens };
          this.render();
        } };
        if (name === "missionBuyBtn" && !mission) return { key: "addMission", disabled: !this.view.canAdd,
          activate: () => {
            this.overlay = { kind: "token", action: "add", slot: 0, count: this.view.rules.basic.addMissionTokens };
            this.render();
          } };
        void node;
        return undefined;
      },
    };
  }

  /* ---------- crew and friend selection ---------- */

  private crewHooks(overlay: Extract<Overlay, { kind: "crew" }>): BmlHooks {
    const mission = this.selectedMission();
    const draft = mission ? this.draft(mission.slot) : undefined;
    const busy = this.busyCrew();
    // Pairs of the other members are taken too.
    draft?.members.forEach((member, index) => {
      if (index === overlay.member) return;
      if (member.character) busy.characters.add(member.character);
      if (member.kart) busy.karts.add(kartId(member.kart));
    });
    return {
      visible: (node, name) => {
        if (name === "noAvailableCharactersLabel") return this.crew.characters.length === 0;
        if (name === "noAvailableKartsLabel") return this.crew.karts.length === 0;
        if (name === "itemListBar") return false;
        void node;
        return undefined;
      },
      draw: (node, name, rect) => {
        if (name === "myCharList") {
          this.drawCrewGrid(rect, "character", overlay, busy, mission);
          return true;
        }
        if (name === "myKartList") {
          this.drawCrewGrid(rect, "kart", overlay, busy, mission);
          return true;
        }
        return false;
      },
      button: (node, name) => {
        if (name === "ok") return { disabled: !overlay.character || !overlay.kart, activate: () => {
          if (draft && overlay.character && overlay.kart) {
            draft.members[overlay.member] = { character: overlay.character, kart: overlay.kart };
          }
          this.overlay = undefined;
          this.render();
        } };
        if (name === "cancel") return { activate: () => {
          this.overlay = undefined;
          this.render();
        } };
        void node;
        return undefined;
      },
    };
  }

  private drawCrewGrid(area: Rect, kind: "character" | "kart", overlay: Extract<Overlay, { kind: "crew" }>,
    busy: { characters: Set<number>; karts: Set<string> }, mission: ExpeditionMission | undefined): void {
    const rect = { ...area, width: 520, height: 582 };
    const entries: Array<ExpeditionCharacter | ExpeditionKart> = kind === "character" ? this.crew.characters
      : this.crew.karts;
    const rows = Math.ceil(entries.length / 3);
    const scrollKey = kind === "character" ? "charScroll" : "kartScroll";
    const max = Math.max(0, rows * CREW_STEP.y - rect.height);
    overlay[scrollKey] = Math.max(0, Math.min(overlay[scrollKey], max));
    this.overlayLists.push({ rect, scroll: delta => {
      overlay[scrollKey] = Math.max(0, Math.min(overlay[scrollKey] + delta, max));
      this.render();
    } });
    const context = this.canvas.context;
    context.save();
    context.beginPath();
    context.rect(rect.x - 4, rect.y - 4, rect.width + 8, rect.height + 4);
    context.clip();
    entries.forEach((entry, index) => {
      const cell = { x: rect.x + (index % 3) * CREW_STEP.x, y: rect.y + Math.floor(index / 3) * CREW_STEP.y -
        overlay[scrollKey], width: 164, height: 186 };
      if (cell.y + cell.height < rect.y || cell.y > rect.y + rect.height) return;
      const character = kind === "character" ? entry as ExpeditionCharacter : undefined;
      const kart = kind === "kart" ? entry as ExpeditionKart : undefined;
      const taken = character ? busy.characters.has(character.itemId) : busy.karts.has(kartId(kart!));
      const chosen = character ? overlay.character === character.itemId
        : overlay.kart !== undefined && kartId(overlay.kart) === kartId(kart!);
      this.crewItem = { ...(character ? { character } : {}), ...(kart ? { kart } : {}) };
      const key = character ? `pick:c:${character.itemId}` : `pick:k:${kartId(kart!)}`;
      try {
        this.canvas.drawTree(this.layouts.crewCard, cell, {
          visible: (_node, name) => {
            if (name === "crewCardSelectedBg") return chosen;
            if (name === "specificIcon") return true;
            if (name === "12TuningLevel") return (kart?.level ?? 0) > 0;
            return undefined;
          },
          draw: (_node, name, inner) => {
            if (name === "myCrew") {
              this.canvas.drawFitted(this.picture(kind === "character" ? 1 : 3, entry.itemId), inner, 1.2);
              this.canvas.drawRich(this.name(kind === "character" ? 1 : 3, entry.itemId),
                { x: inner.x + 4, y: inner.y + inner.height - 36, width: inner.width - 8, height: 18 },
                { size: 13, color: "white", align: "center", verticalAlign: "center", stroke: 1,
                  strokeColor: "rgba(0,0,0,0.85)" });
              if (taken) {
                context.fillStyle = "rgba(20, 28, 44, 0.55)";
                context.fillRect(cell.x, cell.y, cell.width, cell.height);
              }
              return true;
            }
            return false;
          },
          image: (_node, name) => {
            if (name === "specificIcon") return this.canvas.texture(`tag_theme_${entry.specific}@zz`);
            if (name === "12TuningLevel") return this.canvas.texture(`tuning_mark_s_${Math.min(5, kart?.level ?? 0)}`);
            if (name === "crewBtn") {
              const matched = mission && entry.specific === mission.specific;
              const state = this.canvas.state(key, taken, chosen);
              return this.canvas.seriesSprite(kind === "kart" ? "slotItem_kart_"
                : matched ? "slotItem_character_" : "slotItem_noReward_", state);
            }
            return undefined;
          },
          label: (_node, name) => {
            if (name !== "bonusAmountLbl" || !mission) return name === "bonusAmountLbl" ? null : undefined;
            if (character) return this.rewardText(characterBonus(this.view.rules, mission, character.specific));
            return this.timeText(kartBonus(this.view.rules, mission, kart!.level, kart!.parts).time);
          },
          button: (_node, name) => name === "crewBtn" ? { key, disabled: taken,
            label: this.name(kind === "character" ? 1 : 3, entry.itemId), activate: () => {
              if (character) overlay.character = character.itemId;
              if (kart) overlay.kart = kart;
              this.render();
            } } : undefined,
        });
      } finally {
        this.crewItem = undefined;
      }
    });
    context.restore();
  }

  private friendHooks(overlay: Extract<Overlay, { kind: "friend" }>): BmlHooks {
    const mission = this.selectedMission();
    const draft = mission ? this.draft(mission.slot) : undefined;
    return {
      visible: (node, name) => {
        if (name === "noAvailableFriendsLabel") return this.crew.friends.length === 0;
        if (name === "friendListBar") return false;
        void node;
        return undefined;
      },
      draw: (node, name, rect) => {
        if (name !== "friendList") return false;
        const area = { x: rect.x, y: rect.y, width: 860, height: 582 };
        const rows = Math.ceil(this.crew.friends.length / 5);
        const max = Math.max(0, rows * CREW_STEP.y - area.height);
        overlay.scroll = Math.max(0, Math.min(overlay.scroll, max));
        this.overlayLists.push({ rect: area, scroll: delta => {
          overlay.scroll = Math.max(0, Math.min(overlay.scroll + delta, max));
          this.render();
        } });
        const context = this.canvas.context;
        context.save();
        context.beginPath();
        context.rect(area.x - 4, area.y - 4, area.width + 8, area.height + 4);
        context.clip();
        this.crew.friends.forEach((friend, index) => {
          const cell = { x: area.x + (index % 5) * CREW_STEP.x, y: area.y + Math.floor(index / 5) * CREW_STEP.y -
            overlay.scroll, width: 164, height: 186 };
          if (cell.y + cell.height < area.y || cell.y > area.y + area.height) return;
          const key = `pick:f:${friend.accountId}`;
          const chosen = overlay.friend === friend.accountId;
          this.friendItem = friend;
          try {
            this.canvas.drawTree(this.layouts.friendCard, cell, {
              visible: (_node, inner) => inner === "friendCardSelectedBg" ? chosen
                : inner === "specificIcon" ? true : inner === "coupleIcon" ? false : undefined,
              draw: (_node, inner, box) => {
                if (inner !== "charKartPreview") return false;
                this.canvas.drawFitted(this.picture(1, friend.character), { ...box, y: box.y + 18,
                  height: box.height - 18 }, 1.2);
                if (friend.usedToday) {
                  context.fillStyle = "rgba(20, 28, 44, 0.55)";
                  context.fillRect(cell.x, cell.y, cell.width, cell.height);
                }
                return false;
              },
              image: (_node, inner) => {
                if (inner === "specificIcon") return this.canvas.texture(`tag_theme_${friend.specific}@zz`);
                if (inner === "friendBtn") {
                  const matched = mission && friend.specific === mission.specific;
                  return this.canvas.seriesSprite(matched ? "slotItem_character_" : "slotItem_noReward_",
                    this.canvas.state(key, friend.usedToday, chosen));
                }
                return undefined;
              },
              label: (_node, inner) => {
                if (inner === "friendNameLbl") return friend.nickname;
                if (inner === "bonusAmountLbl")
                  return mission ? this.rewardText(friendBonus(this.view.rules, mission, friend.specific)) : null;
                return undefined;
              },
              button: (_node, inner) => inner === "friendBtn" ? { key, disabled: friend.usedToday,
                label: friend.nickname, activate: () => {
                  overlay.friend = friend.accountId;
                  this.render();
                } } : undefined,
            });
          } finally {
            this.friendItem = undefined;
          }
        });
        context.restore();
        return true;
      },
      button: (node, name) => {
        if (name === "ok") return { disabled: !overlay.friend, activate: () => {
          if (draft && overlay.friend) draft.friend = overlay.friend;
          this.overlay = undefined;
          this.render();
        } };
        if (name === "cancel") return { activate: () => {
          this.overlay = undefined;
          this.render();
        } };
        void node;
        return undefined;
      },
    };
  }

  /* ---------- 探险币 ---------- */

  private tokenHooks(overlay: Extract<Overlay, { kind: "token" }>): BmlHooks {
    const mission = this.view.missions.find(item => item.slot === overlay.slot);
    const reduce = overlay.action === "reduce";
    const timed = reduce || overlay.action === "complete";
    const unit = this.view.rules.basic.reduceMinutes * 60_000;
    const remaining = mission ? Math.max(0, mission.ends - this.now()) : 0;
    const maxCount = Math.max(1, Math.ceil(remaining / unit));
    if (reduce) overlay.count = Math.min(Math.max(1, overlay.count), maxCount);
    const cost = reduce ? overlay.count * this.view.rules.basic.reduceTimeTokens : overlay.count;
    const after = timed ? Math.max(0, remaining - (overlay.action === "complete" ? remaining : overlay.count * unit)) : 0;
    const description = overlay.action === "reduce" ? "racingTokenDescReduce30Min"
      : overlay.action === "change" ? "racingTokenDescReplaceMission"
        : overlay.action === "add" ? "racingTokenDescAddWeeklyMission" : "racingTokenUseClearRemainTime";
    return {
      visible: (node, name) => {
        if (["missionTime_before", "arrow0", "missionTime_after", "missionProgressBarBg", "missionProgressBar_b",
          "missionProgressBar_y"].includes(name)) return timed;
        if (name === "subCountBtn" || name === "addCountBtn") return reduce;
        void node;
        return undefined;
      },
      draw: (node, name, rect) => {
        if ((name === "missionProgressBar_b" || name === "missionProgressBar_y") && mission) {
          const total = mission.ends - mission.started;
          const left = name === "missionProgressBar_b" ? remaining : after;
          const done = total > 0 ? Math.min(1, Math.max(0, 1 - left / total)) : 1;
          const image = this.canvas.texture(attribute(node, "texture"));
          if (image) this.canvas.context.drawImage(image, 0, 0, image.width * done, image.height, rect.x, rect.y,
            rect.width * done, rect.height);
          return true;
        }
        if (name === "arrow0") {
          const image = this.canvas.texture("useRacingToken_img_arrow");
          if (image) this.canvas.context.drawImage(image, image.width * 2 / 3, 0, image.width / 3, image.height,
            rect.x, rect.y, rect.width, rect.height);
          return true;
        }
        return false;
      },
      label: (node, name) => {
        if (attribute(node, "text") === "#sb(racingTokenDescReduce30Min)") return this.text(description) ?? null;
        switch (name) {
          case "missionTime_before": return this.durationText(remaining);
          case "missionTime_after": return this.durationText(after);
          case "countTokenLbl": return String(cost);
          case "myToken": return String(this.view.tokens);
          case "afterToken": return String(this.view.tokens - cost);
        }
        return undefined;
      },
      button: (node, name) => {
        switch (name) {
          case "subCountBtn": return { disabled: overlay.count <= 1, activate: () => {
            overlay.count--;
            this.render();
          } };
          case "addCountBtn": return { disabled: overlay.count >= maxCount, activate: () => {
            overlay.count++;
            this.render();
          } };
          case "okButton": return { disabled: this.busy, activate: () => void this.useTokens(overlay, cost) };
          case "cancelButton": return { disabled: this.busy, activate: () => {
            this.overlay = undefined;
            this.render();
          } };
        }
        void node;
        return undefined;
      },
    };
  }

  /* ---------- actions ---------- */

  private apply(view: ExpeditionView): void {
    this.view = view;
    this.clockOffset = view.serverTime - Date.now();
    if (!view.missions.some(mission => mission.slot === this.selected)) this.selected = view.missions[0]?.slot;
    for (const slot of [...this.drafts.keys()])
      if (!view.missions.some(mission => mission.slot === slot && (mission.state === "ready" ||
          mission.state === "blocked"))) this.drafts.delete(slot);
  }

  private async run(action: () => Promise<void>): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.render();
    try {
      await action();
    } catch (error) {
      await this.options.notice(this.text("expeditionCaption") ?? "赛车探险队", this.errorText(error));
    } finally {
      this.busy = false;
      if (!this.disposed) this.render();
    }
  }

  private errorText(error: unknown): string {
    switch ((error as { code?: string }).code) {
      case "ITEM_NOT_ENOUGH": return (this.text("insufficientRacingTokenDesc") ?? "持有的探险币不足。").split("|")[0]!;
      case "NO_MATCHING_CREW": return this.text("expeditionStartCondition") ?? "需设置至少一项属性匹配的角色与卡丁车，才能出发探险。";
      case "CREW_BUSY": return "队员正在进行其他探险。";
      case "FRIEND_USED": return "这位好友今天已经参加过探险了。";
      case "MISSION_NOT_IN_PROGRESS":
      case "MISSION_NOT_COMPLETE": return (this.text("racingTokenUseFailDesc") ?? "请重新尝试。").replace("|", "");
    }
    return this.text("unknownError") ?? "发生未知的错误。";
  }

  private async start(mission: ExpeditionMission, draft: Draft): Promise<void> {
    const crew: ExpeditionPair[] = draft.members.flatMap(member => member.character && member.kart
      ? [{ character: member.character, kart: member.kart.itemId,
        ...(member.kart.kartKey ? { kartKey: member.kart.kartKey } : {}) }] : []);
    await this.run(async () => {
      this.apply(await this.options.api.start(mission.slot, crew, draft.friend));
      this.drafts.delete(mission.slot);
      if (draft.friend) {
        const friend = this.friend(draft.friend);
        if (friend) friend.usedToday = true;
      }
    });
  }

  private async useTokens(overlay: Extract<Overlay, { kind: "token" }>, cost: number): Promise<void> {
    if (cost > this.view.tokens) {
      this.overlay = undefined;
      this.render();
      await this.options.notice(this.text("insufficientRacingToken") ?? "探险币不足",
        (this.text("insufficientRacingTokenDesc") ?? "持有的探险币不足。").split("|")[0]!);
      return;
    }
    await this.run(async () => {
      const count = overlay.action === "reduce" ? overlay.count : 0;
      this.apply(await this.options.api.tokens(overlay.action, overlay.slot, count));
      this.overlay = undefined;
      if (overlay.action === "add") this.selected = this.view.missions.at(-1)?.slot ?? this.selected;
      this.options.onAccountChange();
    });
  }

  private async claim(mission: ExpeditionMission): Promise<void> {
    await this.run(async () => {
      const claim = await this.options.api.claim(mission.slot);
      this.apply(claim.expedition);
      this.options.onAccountChange();
      const parts: string[] = [];
      if (claim.exp > 0) parts.push(`${this.text("rp") ?? "经验"} ${claim.exp}`);
      if (claim.lucci > 0) parts.push(`${this.text("lucci") ?? "金币"} ${claim.lucci}`);
      for (const item of claim.items) parts.push(`${item.name || this.name(item.category, item.itemId)}` +
        `${item.count > 1 ? ` ×${item.count}` : ""}`);
      try {
        this.crew = await this.options.api.crew();
      } catch { /* The list stays as it was. */ }
      void this.options.notice(this.text("racingExpeditionReward") ?? "赛车探险奖励",
        `${this.text("racingExpeditionSuccess") ?? "成功完成赛车探险！"} ${parts.join("，")}`);
    });
  }

  /* ---------- input ---------- */

  private onWheel(event: WheelEvent, point: { x: number; y: number }): void {
    if (this.overlay) {
      const list = this.overlayLists.find(item => point.x >= item.rect.x && point.x <= item.rect.x + item.rect.width &&
        point.y >= item.rect.y && point.y <= item.rect.y + item.rect.height);
      list?.scroll(event.deltaY);
      return;
    }
    const list = this.listRect;
    if (list && point.x >= list.x && point.x <= list.x + list.width && point.y >= list.y &&
        point.y <= list.y + list.height) {
      this.scroll = Math.max(0, this.scroll + event.deltaY);
      this.render();
    }
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    if (this.overlay && !this.busy) {
      this.overlay = undefined;
      this.render();
    } else this.close();
  }
}

/** The attribute's name (都市 …), for tests and labels. */
export function specificKey(specific: number): string { return SPECIFIC_KEYS[specific] ?? "special"; }
