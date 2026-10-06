/** The Ready screen's mutable choices; unrelated fields are retained on updates. */
export interface ReadyOptions {
  speed: number;
  booster: number;
  showGhost: boolean;
  version?: string;
  settingSpeed?: number;
  [key: string]: unknown;
}

export interface UiDefinitionNode {
  name: string;
  attributes: Array<{ name: string; value: string }>;
}

export interface RandomTrackGroup {
  randomType: string;
  cardToken?: string;
  level?: number | string;
}

const boosterIcon = "timeAttack_main_iconBooster";
const ghostIcon = "timeAttack_main_iconGhost";
const speedIcon = "timeAttack_main_iconMode";
const hiddenReadyNodes = new Set([
  "clearPanel", "difficulty", "duel", "duelInfoPanel", "dualTabBtnPanel", "vsIconOn",
]);

const optionChanges: ReadonlyMap<string, Partial<ReadyOptions>> = new Map([
  ["S7", { speed: 7 }],
  ["S4", { speed: 4 }],
  ["indiBoosterBtn", { booster: 0 }],
  ["teamBoosterBtn", { booster: 1 }],
  ["onBtn", { showGhost: true }],
  ["offBtn", { showGhost: false }],
]);

function attribute(node: UiDefinitionNode, name: string): string | undefined {
  return node.attributes.find(item => item.name === name)?.value;
}

function legacySpeedSelectionAllowed(options: ReadyOptions): boolean {
  return (options.version ?? "国服") === "国服" &&
    (options.settingSpeed ?? 7) === 7;
}

function isSpeedButton(name: string): boolean {
  return name === "S4" || name === "S7";
}

/** The Ready screen ignores unavailable speed controls without cloning state. */
export function selectReadyOption(options: ReadyOptions, buttonName: string): ReadyOptions {
  const change = optionChanges.get(buttonName);
  if (!change || (isSpeedButton(buttonName) && !legacySpeedSelectionAllowed(options))) {
    return options;
  }
  return { ...options, ...change };
}

export function isReadyOptionSelected(buttonName: string, options: ReadyOptions): boolean {
  if (isSpeedButton(buttonName)) {
    return legacySpeedSelectionAllowed(options) &&
      buttonName === (options.speed === 7 ? "S7" : "S4");
  }
  return buttonName === (options.booster === 0 ? "indiBoosterBtn" : "teamBoosterBtn") ||
    buttonName === (options.showGhost ? "onBtn" : "offBtn");
}

/** 1 normal, 2 hovered, 3 pressed, 4 selected or disabled. */
export function readyButtonImageState(
  buttonId: string,
  buttonName: string,
  options: ReadyOptions,
  hoveredId?: string,
  pressedId?: string,
): number {
  if (isReadyOptionSelected(buttonName, options)) return 4;
  return hoveredId !== buttonId ? 1 : pressedId === buttonId ? 3 : 2;
}

/** Choose the texture variant for booster, speed channel or ghost display. */
export function readyOptionTexture(token: string | undefined, options: ReadyOptions): string | undefined {
  if (token === undefined) return undefined;
  if (token.startsWith(boosterIcon) && /^[012]$/.test(token.slice(boosterIcon.length))) {
    return `${boosterIcon}${options.booster}`;
  }
  if (token.startsWith(speedIcon) && /^(?:1|4|7|Default)$/.test(token.slice(speedIcon.length))) {
    return `${speedIcon}${options.speed}`;
  }
  if (token === `${ghostIcon}1` || token === `${ghostIcon}2`) {
    return `${ghostIcon}${options.showGhost ? 1 : 2}`;
  }
  return token;
}

/** Visibility rules for Ready BML nodes and race record controls. */
export function readyNodeVisible(
  node: UiDefinitionNode,
  hasGhostRecord: boolean,
  reverseTrack = false,
  randomGroup = false,
): boolean {
  const name = attribute(node, "name");
  if (name === "rvs") return reverseTrack;
  if (name === "randomInfoText") return randomGroup;
  if (name !== undefined && hiddenReadyNodes.has(name)) return false;
  if (name === "shadowBtnPanel") return hasGhostRecord;
  if (node.name === "Label" && name === "desc") {
    return attribute(node, "text") === "#sb(invalidShadow)" && !hasGhostRecord;
  }
  return attribute(node, "visible") !== "false" || name === "training";
}

/** Chinese labels displayed for the packaged random track groups. */
export function randomTrackGroupName(group: RandomTrackGroup): string {
  const names: Record<string, string> = {
    hot1: "人气随机（极易）",
    hot2: "人气随机（简单）",
    hot3: "人气随机（普通）",
    hot4: "人气随机（困难）",
    hot5: "人气随机（极难）",
    all: "全部随机",
    speedAll: "竞速随机",
    clubSpeed: "专业竞速随机",
    new: "新图随机",
    reverse: "反方向随机",
    crazy: "疯狂随机",
  };
  const named = names[group.randomType];
  if (named?.startsWith("人气随机")) return named;
  if (group.cardToken === "speedAllRandom_TimeAttack@zz") return "竞速随机";
  return named ??
    (group.level === undefined ? group.randomType : `${group.randomType}:${group.level}`);
}
