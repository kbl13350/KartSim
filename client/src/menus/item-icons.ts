import type { AccountSession } from "../account/account-session";
import { fetchShopCatalog } from "../shop/shop-api";
import { createItemPictures } from "../timeattack/shop-preview";
import { ImageCache, type BmlLibrary, type Texture } from "../ui/bml-kit";

/**
 * Pictures of rewards in the 奖励箱 cards and the 任务 reward slots: the
 * release currency icons (stage_mqShop common_icon_*), the gacha and
 * treasure-hunt material icons, emblem icons (etc_/emblem/<id>_51) and the
 * shop's garage snapshots of catalog items (karts, characters…). Undefined
 * until loaded; `changed` runs when one arrives.
 */

export interface RewardLike {
  category: number;
  itemId: number;
  currency?: string;
  emblem?: number;
}

const CURRENCY_ICONS: Record<string, string> = { lucci: "common_icon_lucci", koin: "common_icon_koin",
  coupon: "common_icon_cash" };

/** Categories the garage snapshot renderer draws (shop-preview SHOP_PREVIEW_CATEGORIES' kinds). */
const PICTURED = new Set([1, 2, 3, 4, 8, 9, 11, 16, 18, 20, 21, 26, 27, 52, 70, 71]);

function materialIcon(item: RewardLike): [string[], string] | undefined {
  if (item.category === 34 && (item.itemId === 883 || item.itemId === 884)) return [["stage_/treasureHunt"], "newgacha_goodsicon_1"];
  if (item.category === 34 && item.itemId === 834) return [["stage_/treasureHunt"], "newgacha_goodsicon_2"];
  if (item.category === 24) return [["stage_/mainMenu"], "limitedGacha_01"];
  return undefined;
}

export class ItemIcons {
  private readonly images: ImageCache;
  private pictures?: ReturnType<typeof createItemPictures>;
  private catalog?: Promise<Map<string, string>>;
  private readonly abort = new AbortController();
  private readonly snapshots = new Map<string, Texture>();
  private readonly requested = new Set<string>();
  private disposed = false;

  constructor(private readonly library: BmlLibrary, private readonly session: AccountSession | undefined,
    private readonly changed: () => void) {
    this.images = new ImageCache(library, changed);
  }

  icon(item: RewardLike): Texture | undefined {
    if (item.emblem) return this.images.path(`etc_/emblem/${item.emblem}_51.png`);
    if (item.currency) {
      const name = CURRENCY_ICONS[item.currency];
      return name ? this.images.named(["stage_/mqShop"], name) : undefined;
    }
    const material = materialIcon(item);
    if (material) return this.images.named(material[0], material[1]);
    if (!PICTURED.has(item.category) || item.itemId <= 0) return undefined;
    const key = `${item.category}:${item.itemId}`;
    return this.snapshots.get(key) ?? this.requestPicture(key, item);
  }

  private requestPicture(key: string, item: RewardLike): undefined {
    if (this.requested.has(key) || this.disposed || !this.session) return undefined;
    this.requested.add(key);
    void this.catalogItems().then(async items => {
      const internalId = items.get(key);
      if (!internalId || this.disposed) return;
      try { this.pictures ??= createItemPictures(this.library); } catch { return; }
      const canvas = await this.pictures.picture(item.category, item.itemId, internalId, this.abort.signal);
      if (!canvas || this.disposed) return;
      this.snapshots.set(key, { image: canvas, width: canvas.width, height: canvas.height });
      this.changed();
    }).catch(() => undefined);
    return undefined;
  }

  private catalogItems(): Promise<Map<string, string>> {
    this.catalog ??= fetchShopCatalog(this.session as never).then(catalog => new Map(catalog.items.map(item =>
      [`${item.category}:${item.itemId}`, item.internalId]))).catch(() => new Map());
    return this.catalog;
  }

  dispose(): void {
    this.disposed = true;
    this.abort.abort();
    try { this.pictures?.dispose(); } catch { /* Pictures are optional. */ }
    this.pictures = undefined;
  }
}
