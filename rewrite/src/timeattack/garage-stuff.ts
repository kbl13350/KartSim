/**
 * 我的物品's 精品道具 tab: the account's counted items (boxes, 探险币 …)
 * with their stuff.rho icons, and opening a box (POST /api/inventory/open)
 * in the release reward window. Shared by Ready's garage and My Room's.
 */
import { activeBrowserSession } from "../account/account-runtime";
import type { InventoryItem } from "../account/account-session";
import {
  BOX_CATEGORY, garageStuffItems, loadStuffInfo, stuffKey, type GarageStuffItem, type StuffInfo,
  type StuffLibrary,
} from "../account/stuff-items";
import { ImageCache, type MyRoomDataLibrary } from "../myroom/myroom-data";
import { newRequestId } from "../shop/shop-api";
import { openBoxDialog, type BoxReward } from "../ui/box-dialogs";
import { GARAGE_FONT } from "../ui/garage-selection-view";
import { SHOP_PREVIEW_CATEGORIES, createItemPictures } from "./shop-preview";

/** The garage view as far as the 精品道具 tab goes. */
interface StuffGarageView {
  options: { catalog: Record<string, unknown> };
  render(): void;
}

export interface GarageStuffSupport {
  /** The counted items for the garage catalog's stuff list. */
  stuff: GarageStuffItem[];
  stuffIcon(item: { category: number; itemId: number }): HTMLCanvasElement | undefined;
  onUseItem(item: { kind?: string; category?: number; itemId: number; title?: string }): void;
  dispose(): void;
}

interface BoxOpening { rewards: BoxReward[]; items: InventoryItem[] }

export async function garageStuffSupport(options: {
  library: unknown;
  root: HTMLElement;
  view(): StuffGarageView | undefined;
  /** The garage catalog again, after an opening changed what the account owns. */
  refreshCatalog(): Promise<Record<string, unknown>>;
}): Promise<GarageStuffSupport> {
  const session = activeBrowserSession();
  let info: ReadonlyMap<string, StuffInfo> = new Map();
  try {
    info = await loadStuffInfo(options.library as StuffLibrary);
  } catch (error) {
    console.warn("精品道具资料加载失败", error);
  }
  const listStuff = () => session ? garageStuffItems(session.inventory(), info, Date.now()) : [];
  let rendering: () => void = () => options.view()?.render();
  const icons = new ImageCache(options.library as MyRoomDataLibrary, () => rendering());
  const pictures = new Map<string, HTMLCanvasElement | null>();
  let previews: ReturnType<typeof createItemPictures> | undefined;
  let opening = false;

  const iconOf = (category: number, itemId: number) => {
    const path = info.get(stuffKey(category, itemId))?.icon;
    return path ? icons.get(path) : undefined;
  };
  const rewardPicture = (reward: BoxReward, render: () => void): HTMLCanvasElement | undefined => {
    const icon = iconOf(reward.category, reward.itemId);
    if (icon) return icon;
    if (!SHOP_PREVIEW_CATEGORIES.has(reward.category)) return undefined;
    const key = stuffKey(reward.category, reward.itemId);
    if (pictures.has(key)) return pictures.get(key) ?? undefined;
    pictures.set(key, null);
    previews ??= createItemPictures(options.library);
    void previews.picture(reward.category, reward.itemId, "", new AbortController().signal)
      .then(picture => {
        pictures.set(key, picture ?? null);
        render();
      }, () => undefined);
    return undefined;
  };

  const support: GarageStuffSupport = {
    stuff: listStuff(),
    stuffIcon: item => iconOf(item.category, item.itemId),
    onUseItem: item => {
      if (opening || !session || item.category !== BOX_CATEGORY) return;
      opening = true;
      const name = item.title ?? info.get(stuffKey(BOX_CATEGORY, item.itemId))?.name ?? String(item.itemId);
      let dialog: { render(): void } | undefined;
      void openBoxDialog({
        library: options.library, root: options.root, fontFamily: GARAGE_FONT,
        box: { itemId: item.itemId, name },
        boxIcon: () => iconOf(BOX_CATEGORY, item.itemId),
        rewardPicture: reward => rewardPicture(reward, () => dialog?.render()),
        open: async () => {
          const result = await session.requestJson("/api/inventory/open", { method: "POST",
            body: JSON.stringify({ itemId: item.itemId, requestId: newRequestId() }) }) as BoxOpening;
          for (const row of result.items ?? []) session.applyInventoryItem(row);
          return { rewards: result.rewards ?? [] };
        },
        onClose: opened => {
          opening = false;
          rendering = () => options.view()?.render();
          if (!opened) return;
          void session.refresh().catch(() => undefined);
          void options.refreshCatalog().then(catalog => {
            const view = options.view();
            if (!view) return;
            support.stuff = listStuff();
            view.options.catalog = { ...catalog, stuff: support.stuff };
            view.render();
          }, () => undefined);
        },
      }).then(opened => {
        dialog = opened;
        rendering = () => {
          options.view()?.render();
          opened.render();
        };
      }, error => {
        opening = false;
        console.warn("开箱窗口加载失败", error);
      });
    },
    dispose: () => {
      previews?.dispose();
      for (const picture of pictures.values()) if (picture) picture.width = picture.height = 0;
      pictures.clear();
    },
  };
  return support;
}
