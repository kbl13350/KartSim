import {
  addPreparationCancelButton, addPreparationComparisonValue,
  addPreparationLabel, createPreparationButton, decoratePreparationPageArrow,
  placePreparationControl, type GaragePreparationArrow,
  type GaragePreparationControlAssets, type GaragePreparationControlHost,
} from "./garage-upgrade-preparation-controls";
import {
  clearPreparationPageFrames, preparationCards,
  type GaragePreparationHost, type GaragePreparationItem,
} from "./garage-upgrade-preparation-state";
import {
  compareGarageUpgradeLevels, preparationMethodPanelRect,
  type GaragePreparationRenderDependencies,
} from "./garage-upgrade-preparation-render";

export interface GaragePreparationRefreshAssets extends GaragePreparationControlAssets {
  rect: { x: number; y: number; width: number; height: number };
  cardLayout: {
    width: number; height: number; columns: number;
    horizontalMargin: number; verticalMargin: number;
    clientLeft: number; clientTop: number;
  };
  pageArrows: Array<GaragePreparationArrow & { name: string }>;
  urls: Map<string, string>;
  fontFamily?: string;
}

/**
 * The tips in the helpStr bubble. The release helpStr1/2 are about failure
 * odds that rise after each failed try; local upgrades always succeed.
 */
export const PREPARATION_TIPS = [
  "强化一定会成功，放心升级吧~",
  "最高可强化到 5 级，强化点数随等级增加，性能槽最多 3 个！",
] as const;

export type GaragePreparationRefreshHost =
  GaragePreparationHost & GaragePreparationControlHost & {
    assets?: GaragePreparationRefreshAssets;
    element: HTMLElement;
    controls: HTMLElement;
    status: HTMLElement;
  };

/** Rebuild the upgrade controls from the selected vehicle, page and method. */
export function refreshGaragePreparation(host: GaragePreparationRefreshHost,
  dependencies: GaragePreparationRenderDependencies): void {
  if (!host.assets || host.disposed) return;
  clearPreparationPageFrames(host);
  host.controls.replaceChildren();
  addPreparationCancelButton(host);
  const { item, value } = host.state.selected;
  const target = host.state.target;
  const comparison = compareGarageUpgradeLevels(value.level, target.level);
  const assets = host.assets;
  const rect = (name: string) => assets.rects.get(name)!;
  host.element.style.setProperty("--garage-upgrade-font",
    assets.fontFamily ? '"' + assets.fontFamily + '"' : "inherit");
  const caption = document.createElement("strong");
  caption.textContent = "车辆强化";
  caption.className = "garage-preparation-caption";
  placePreparationControl(host, caption, {
    x: assets.rect.x + 60, y: assets.rect.y + 3,
    width: assets.rect.width - 120, height: 30,
  });
  addPreparationLabel(host, "强化车辆", "tuningTargetLabel", "target-caption");
  addPreparationLabel(host, (item as GaragePreparationItem).title,
    "itemName", "vehicle-name");
  addPreparationLabel(host, comparison.level.current + "级", "curLevel", "level-value");
  addPreparationLabel(host, comparison.level.next + "级", "nextLevel", "level-value");
  addPreparationComparisonValue(host, "curSlotNum", comparison.slots.current);
  addPreparationComparisonValue(host, "nextSlotNum", comparison.slots.next,
    comparison.slots.increment);
  addPreparationComparisonValue(host, "curTp", comparison.tuningPoints.current);
  addPreparationComparisonValue(host, "nextTp", comparison.tuningPoints.next,
    comparison.tuningPoints.increment);
  addPreparationLabel(host, comparison.labels.slotCount,
    "tuningSlotLabel", "metric-caption");
  addPreparationLabel(host, comparison.labels.tuningPoints,
    "tuningPointLabel", "metric-caption");
  const methodPanel = document.createElement("section");
  methodPanel.className = "garage-upgrade-method-panel";
  placePreparationControl(host, methodPanel, preparationMethodPanelRect());
  const title = document.createElement("strong");
  title.className = "garage-upgrade-method-title";
  title.textContent = "强化方式";
  methodPanel.append(title);
  const divider = document.createElement("div");
  divider.className = "garage-upgrade-method-divider";
  methodPanel.append(divider);
  const methods = document.createElement("div");
  methods.className = "garage-upgrade-method-buttons";
  methodPanel.append(methods);
  for (const [method, label] of [["step", "逐级强化"],
    ["max", "一键升满"]] as const) {
    const selected = host.state.upgradeMethod === method;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.setAttribute("aria-label", label);
    button.disabled = method === "max" && value.level === 5;
    button.onclick = () => {
      host.state.setUpgradeMethod(method);
      refreshGaragePreparation(host, dependencies);
    };
    button.className = "garage-upgrade-method" + (selected ? " selected" : "");
    button.setAttribute("aria-pressed", String(selected));
    methods.append(button);
  }
  const help = document.createElement("div");
  help.className = "garage-upgrade-method-help";
  help.textContent = host.state.upgradeMethod === "step"
    ? "逐级强化：点击升级后提升 1 级。\n强化完成后立即写入当前车辆。"
    : "一键升满：点击升级后直接提升至 5 级。\n强化完成后立即写入当前车辆。";
  methodPanel.append(help);
  if (assets.rects.has("kartListLabel"))
    addPreparationLabel(host, "强化车辆", "kartListLabel", "list-caption");
  // kart12TuningLevelUp_stringBag kartCount: the list is the owned XUN karts.
  addPreparationLabel(host, "持有车辆： " + host.state.candidates.length + "辆",
    "kartCount", "count");
  addPreparationLabel(host, host.state.page + 1 + " / " + host.state.pages,
    "pageInfo", "fee");
  const bubble = assets.rects.get("helpStr");
  PREPARATION_TIPS.forEach((text, index) => {
    const label = assets.rects.get("helpStr" + (index + 1));
    if (!bubble || !label) return;
    const element = document.createElement("div");
    element.className = "garage-preparation-label help";
    element.textContent = text;
    // .help pads 20 px for the info mark, which sits 20 px left of the label.
    placePreparationControl(host, element, {
      x: label.x - 20, y: label.y,
      width: bubble.x + bubble.width - label.x + 20, height: label.height,
    });
  });
  for (const arrow of assets.pageArrows) {
    const previous = arrow.name === "preItemList";
    const button = createPreparationButton(host,
      previous ? "上一页强化车辆" : "下一页强化车辆",
      rect(arrow.name), () => {
        host.state.turnPage(previous ? -1 : 1);
        refreshGaragePreparation(host, dependencies);
      }, previous ? host.state.page === 0
        : host.state.page + 1 === host.state.pages);
    decoratePreparationPageArrow(host, button, arrow, rect(arrow.name),
      dependencies);
  }
  const start = createPreparationButton(host,
    value.level === 5 ? "车辆已满级" :
      "开始本地 Lv." + target.level + " 强化",
    rect("levelUpStart"), () => host.close(true), !host.state.canStart);
  start.className = "garage-native-button";
  start.textContent = "";
  for (let state = 1; state <= 4; state++)
    start.style.setProperty("--button-" + state,
      'url("' + assets.urls.get("tuninglevel_btnStart_" + state) + '")');
  for (const card of preparationCards(host)) {
    const button = createPreparationButton(host,
      "强化目标：" + card.item.title, card.rect, () => {
        host.state.choose(card.item.itemId);
        refreshGaragePreparation(host, dependencies);
      });
    button.className = "garage-preparation-card";
    button.setAttribute("aria-pressed",
      String(card.item.itemId === item.itemId));
    button.textContent = "";
    button.title = card.item.title;
  }
  host.status.textContent = "";
}
