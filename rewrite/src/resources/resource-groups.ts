/**
 * Resource categories for the download panel and priority loading: the
 * 1,695 physical containers of the release (`.rho`, `.rho5` parts and
 * aaa.pk) grouped by the pages that need them. A container may belong to
 * several groups (myRoom.rho is both the home backdrop and 小屋); 其他
 * holds the rest, so the groups together cover every container.
 *
 * Rho5 packs are split by size, not by feature: their parts are assigned
 * by the virtual paths they hold (DataPack3 track folders go to their
 * track theme).
 */

export interface ResourceFileSpec {
  readonly name: string;
  readonly size: number;
}

/** What resource grouping needs of a rho5 archive index entry. */
export interface Rho5PackSpec {
  readonly name: string;
  readonly parts: readonly { readonly id: number; readonly name: string }[];
  readonly files: readonly unknown[];
}

export interface ResourceGroup {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  /** Downloaded before the home screen opens; cannot be deleted. */
  readonly required: boolean;
  readonly containers: readonly string[];
  readonly bytes: number;
  /** Track themes under 赛道. */
  readonly children?: readonly ResourceGroup[];
}

interface Rule {
  id: string;
  title: string;
  description: string;
  required?: boolean;
  /** Exact container names without the extension. */
  names?: string[];
  patterns?: RegExp[];
  /** Rho5 packs taken whole. */
  packs?: string[];
}

/** Chinese theme names (first word of the theme's track titles in trackLocale@cn). */
export const THEME_TITLES: Readonly<Record<string, string>> = {
  forest: "森林", desert: "沙漠", village: "城镇", ice: "冰河", tomb: "墓地", mine: "矿山", northeu: "太空",
  factory: "工厂", pirate: "海盗", fairy: "童话世界", moonhill: "月光之城", gold: "黄金文明", china: "龙行华夏",
  castle: "大城堡", nymph: "精灵", mechanic: "机械", wkc: "WKC", brodi: "未来工厂", park: "跑跑游乐场",
  beach: "滨海大道", steam: "1920", jurassic: "侏罗纪", world: "环游世界", nemo: "像素世界", sword: "刀剑",
  god: "神之国度", abyss: "深渊之都", camelot: "亚瑟传说", olympos: "奥林匹斯", mabi: "洛奇", maple: "冒险岛",
  fengshen: "封神传说", transFormer: "变形金刚", xyy: "喜羊羊", korea: "韩国",
};

/**
 * The groups in panel order. 首页 is what the home screen and the first
 * Ready need (the startup path reads these); the others are the pages'
 * own containers.
 */
const RULES: Rule[] = [
  {
    id: "home", title: "首页（基础资源）", required: true,
    description: "启动与首页必需：界面、字体、首页场景、主菜单音乐、道具与赛道目录、任务与资源下载窗口",
    names: ["aaa", "stage_common", "stage_mainMenu", "stage_timeAttackReady", "stage_logo", "track_common",
      "theme_common", "theme_village", "sound_bgm_main", "sound_bgm_village", "sound_fx_interface", "sound_fx_etc",
      "character_common", "myRoom", "dialog2_timeAttackCompetitive", "dialog2_personalShop",
      "dialog2_customMessageBox", "dialog2_progressDialog", "dialog2_questInfo2"],
    patterns: [/^gui_/],
    packs: ["DataPack1", "DataPack4"],
  },
  {
    id: "race", title: "比赛通用",
    description: "所有比赛都会用到：道具、特效、引擎与路面音效、赛道广告牌、仪表盘与比赛界面",
    names: ["effect", "item", "boss", "sound_fx_item", "sound_fx_kart", "sound_fx_road", "sound_fx_surround",
      "sound_fx_battle", "sound_fx_boss", "sound_fx_charger", "stage_speedIndiGame", "stage_speedTeamGame",
      "stage_itemIndiGame", "stage_itemTeamGame", "stage_gameFinalIndi", "stage_gameFinalTeam", "stage_timeAttack",
      "stage_gameReady", "stage_replay", "stage_replayReady", "dialog2_selectTrackEx", "dialog2_selectTrackSmall",
      "dialog2_timeAttack", "zeta_cn_ppl"],
  },
  { id: "tracks", title: "赛道", description: "按主题下载：赛道模型、主题贴图与主题音乐" },
  {
    id: "karts", title: "车辆", description: "全部车辆模型与贴图（选车、比赛、车库、商城预览）",
    packs: ["DataPack2"],
  },
  {
    id: "characters", title: "角色", description: "全部角色模型与角色语音（比赛、房间与表情）",
    patterns: [/^character_(?!common$)/, /^sound_character$/],
  },
  {
    id: "pets", title: "宠物与飞行宠物", description: "宠物、飞行宠物的模型与音效",
    patterns: [/^pet_/, /^flyingPet_/, /^sound_pet/, /^sound_flyingPet/],
  },
  {
    id: "myroom", title: "小屋", description: "小屋场景、拜访与图鉴、探险队界面",
    names: ["myRoom", "stage_myRoom", "dialog2_findRider", "dialog2_passwordBox", "dialog2_newCareer", "dialog"],
  },
  {
    id: "shop", title: "商城与饰品", description: "商城界面与全部饰品（头饰、眼镜、气球、光环等）的模型和图标",
    names: ["stuff", "stage_mqShop", "stage_shop", "stage_timeShop", "stage_cashInventory", "stage_giftBox",
      "dialog2_buyItem", "dialog2_buyAll", "dialog2_giveGift", "dialog2_giveGiftConfirm", "dialog2_giveGiftDupl",
      "dialog2_itemExpired", "stuff2_slotBG", "stuff2_plate", "stuff2_ethisItem", "stuff2_"],
  },
  {
    id: "garage", title: "车库与改装", description: "车库、改装与部件界面",
    names: ["stage_garageX", "stage_tuning", "stage_kartune", "stage_upgradeGear", "stage_growthKart",
      "stage_disassemble", "dialog2_selectParts", "dialog2_kart12SkillTuning", "dialog2_kart12TuningLevelUp",
      "dialog2_exceedTypeChange", "dialog2_selectItem", "dialog2_selectItemEx", "stuff2_parts", "sound_fx_disassemble"],
  },
  {
    id: "multiplayer", title: "多人游戏", description: "多人大厅、房间、结算与聊天界面",
    names: ["stage_mqReady", "stage_globalChatSystem", "stage_messengerSystem", "dialog2_createRoom",
      "dialog2_createRoomEx", "dialog2_changeTeam", "dialog2_quickMatchDialog", "dialog2_confirmReadyStageOut",
      "dialog2_messenger", "dialog2_userInfo", "dialog2_questInfo2", "dialog2_noticer", "stage_rewardBox"],
    patterns: [/^stage_mq/],
  },
  {
    id: "story", title: "剧情与驾照", description: "剧情模式的场景与对白、驾照考试界面",
    names: ["stage_scene", "stage_scenarioReady", "stage_scenarioSelect", "zeta_cn_scenario", "sound_fx_scene",
      "dialog2_licenseCard"],
    patterns: [/^stage_riderSchool/],
  },
  {
    id: "activities", title: "活动与抽奖", description: "寻宝、扭蛋、抽奖与各类小游戏活动",
    names: ["stage_treasureHunt", "stage_shuffleGacha", "stage_gacha", "stage_gachaUse", "stage_burningSlotGacha",
      "stage_countdownBox", "stage_blueMarble", "stage_BingoStage", "stage_fishing", "stage_kartPass",
      "stage_exchangeSystem", "stage_periodExchangeSystem", "stage_boomhillExchange", "stage_magicHat",
      "stage_hitPangPang", "stage_blockCatch", "sound_fx_treasureHunt", "sound_fx_countdownBox",
      "sound_fx_hitPangPang", "sound_fx_blockCatch", "sound_bgm_treasureHunt", "sound_bgm_burningSlot",
      "sound_bgm_fishing", "sound_bgm_hitPangPang", "dialog2_eventMenu", "dialog2_eventMenuGachaMultiDialog"],
  },
  {
    id: "club", title: "俱乐部", description: "俱乐部各页面",
    patterns: [/^stage_club/, /^stuff2_guildMark$/],
  },
];

const OTHER: Rule = { id: "other", title: "其他", description: "其他模式与暂未使用的资源" };

function baseName(name: string): string {
  return name.replace(/\.(rho5?|pk)$/i, "");
}

function matches(rule: Rule, base: string): boolean {
  return !!rule.names?.includes(base) || !!rule.patterns?.some(pattern => pattern.test(base));
}

/** The pack a rho5 part file belongs to ("DataPack3_00021.rho5" → "DataPack3"). */
function packOf(name: string): string | undefined {
  return /^(.*)_\d+\.rho5$/i.exec(name)?.[1];
}

function filePath(file: unknown): string | undefined {
  return file && typeof file === "object" && typeof (file as { path?: unknown }).path === "string"
    ? (file as { path: string }).path : undefined;
}

function filePart(file: unknown): number | undefined {
  const part = file && typeof file === "object" ? (file as { partId?: unknown }).partId : undefined;
  return typeof part === "number" ? part : undefined;
}

/** Track themes of the container names and of DataPack3's track folders. */
function trackThemes(files: readonly ResourceFileSpec[], packs: readonly Rho5PackSpec[]): Map<string, Set<string>> {
  const themes = new Map<string, Set<string>>();
  const add = (theme: string, container: string) => {
    let set = themes.get(theme);
    if (!set) themes.set(theme, set = new Set());
    set.add(container);
  };
  for (const file of files) {
    const match = /^track_([A-Za-z0-9]+)_/.exec(baseName(file.name));
    if (match && match[1] !== "common") add(match[1]!, file.name);
  }
  for (const pack of packs) {
    if (pack.name !== "DataPack3") continue;
    const partNames = new Map(pack.parts.map(part => [part.id, part.name]));
    for (const entry of pack.files) {
      const theme = /^track_\/([A-Za-z0-9]+)_/.exec(filePath(entry) ?? "")?.[1];
      const part = partNames.get(filePart(entry) ?? -1);
      if (theme && part) add(theme, part);
    }
  }
  // Each theme also brings its textures and music.
  const names = new Map(files.map(file => [baseName(file.name).toLowerCase(), file.name]));
  for (const [theme, set] of themes) {
    for (const extra of [`theme_${theme}`, `sound_bgm_${theme}`, `sound_bgm_${theme}2`, `sound_bgm_${theme}_2`]) {
      const name = names.get(extra.toLowerCase());
      if (name) set.add(name);
    }
  }
  return themes;
}

function group(rule: Rule, containers: Iterable<string>, sizes: Map<string, number>,
  children?: ResourceGroup[]): ResourceGroup {
  const list = [...new Set(containers)].sort();
  return {
    id: rule.id, title: rule.title, description: rule.description, required: !!rule.required,
    containers: list, bytes: list.reduce((sum, name) => sum + (sizes.get(name) ?? 0), 0),
    ...(children ? { children } : {}),
  };
}

/**
 * Builds the groups over the manifest's containers. `themeTitles` may
 * replace the built-in theme names (the track catalog's).
 */
export function buildResourceGroups(files: readonly ResourceFileSpec[], packs: readonly Rho5PackSpec[],
  themeTitles: Readonly<Record<string, string>> = THEME_TITLES): ResourceGroup[] {
  const sizes = new Map(files.map(file => [file.name, file.size]));
  const assigned = new Set<string>();
  const groups: ResourceGroup[] = [];
  for (const rule of RULES) {
    if (rule.id === "tracks") {
      const themes = trackThemes(files, packs);
      const children = [...themes].map(([theme, set]) => group({ id: `track:${theme}`,
        title: themeTitles[theme] ?? THEME_TITLES[theme] ?? theme,
        description: `${themeTitles[theme] ?? THEME_TITLES[theme] ?? theme}主题的赛道` }, set, sizes))
        .sort((a, b) => b.bytes - a.bytes);
      const all = children.flatMap(child => child.containers);
      all.forEach(name => assigned.add(name));
      groups.push(group(rule, all, sizes, children));
      continue;
    }
    const containers = files.filter(file => matches(rule, baseName(file.name)) ||
      (rule.packs?.includes(packOf(file.name) ?? "") ?? false)).map(file => file.name);
    containers.forEach(name => assigned.add(name));
    groups.push(group(rule, containers, sizes));
  }
  groups.push(group(OTHER, files.filter(file => !assigned.has(file.name)).map(file => file.name), sizes));
  return groups;
}

/** A group by id, theme children included ("track:village"). */
export function findResourceGroup(groups: readonly ResourceGroup[], id: string): ResourceGroup | undefined {
  for (const entry of groups) {
    if (entry.id === id) return entry;
    const child = entry.children?.find(candidate => candidate.id === id);
    if (child) return child;
  }
  return undefined;
}

/** The track theme of a track path or id ("track_/village_R01/track.1s", "village_R01_rvs"). */
export function trackThemeOf(track: string): string | undefined {
  const id = track.replace(/^.*?track_\//, "").split("/")[0] ?? "";
  return /^([A-Za-z0-9]+)_/.exec(id)?.[1];
}
