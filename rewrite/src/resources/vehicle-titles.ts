import type { GarageItemDefinition, GarageResource } from "./timeattack-items";
import type { VehicleTitle } from "./vehicle-identity";

export interface VehicleTitleLibrary {
  files: GarageResource[];
  vehicleTitlePromise?: Promise<Map<string, VehicleTitle>>;
  itemTableGarageDefinitions(): Promise<GarageItemDefinition[]>;
}

export interface VehicleTitleDependencies {
  parseXml(text: string, path: string): Document;
}

interface KartIdentity {
  name: string;
  textureKey: string;
}

/** Merge base and CN kart tags in file order; later tags may inherit fields. */
function kartIdentityByItemId(tables: GarageResource[], parseXml: VehicleTitleDependencies["parseXml"]): Promise<Map<string, KartIdentity>> {
  return (async () => {
    const identities = new Map<string, KartIdentity>();
    for (const table of tables) {
      const document = parseXml(await table.text(), table.virtualPath);
      for (const kart of [...document.getElementsByTagName("kart")]) {
        const itemId = kart.getAttribute("id");
        if (!itemId) continue;
        const previous = identities.get(itemId);
        const name = kart.getAttribute("name")?.trim().toLowerCase() || previous?.name;
        if (!name) continue;
        const textureKey = kart.hasAttribute("t1ImageName")
          ? kart.getAttribute("t1ImageName")?.trim() || "1"
          : previous?.textureKey ?? "1";
        identities.set(itemId, { name, textureKey });
      }
    }
    return identities;
  })();
}

/** Resolve model-folder titles and texture identity from ItemTable and CN shop. */
export function vehicleTitles(
  library: VehicleTitleLibrary,
  dependencies: VehicleTitleDependencies,
): Promise<Map<string, VehicleTitle>> {
  return library.vehicleTitlePromise ??= (async () => {
    const titles = new Map<string, VehicleTitle>();
    const tables = library.files.filter(file =>
      /^itemtable(?:@cn)?\.(kml|xml)$/i.test(file.name) &&
      /(^|\/)etc_\//i.test(file.virtualPath))
      .sort((left, right) =>
        Number(/@cn\./i.test(left.name)) - Number(/@cn\./i.test(right.name)));
    const shop = library.files.find(file =>
      file.name.toLowerCase() === "item.kml" &&
      /(^|\/)zeta_\/cn\/shop\/data\//i.test(file.virtualPath));
    if (tables.length === 0 || typeof DOMParser === "undefined") return titles;

    const shopTitles = new Map<string, string>();
    if (shop) {
      const document = dependencies.parseXml(await shop.text(), shop.virtualPath);
      for (const item of [...document.getElementsByTagName("item")]) {
        if (item.getAttribute("itemCatId") !== "3") continue;
        const itemId = item.getAttribute("itemId");
        const title = item.getAttribute("itemName")?.trim();
        if (itemId && title) shopTitles.set(itemId, title);
      }
    }

    const identities = await kartIdentityByItemId(tables, dependencies.parseXml);
    const byModel = new Map<string, { id: string; textureKey: string }[]>();
    identities.forEach(({ name, textureKey }, id) =>
      byModel.set(name, [...(byModel.get(name) ?? []), { id, textureKey }]));
    byModel.forEach((items, model) => {
      const named = items.map(({ id }) => ({ id, title: shopTitles.get(id) }))
        .filter(item => !!item.title);
      const names = [...new Set(named.map(item => item.title))];
      const textures = [...new Set(items.map(item => item.textureKey))];
      titles.set(model, {
        title: names.length === 1 ? names[0] : undefined,
        itemId: named.length === 1 ? named[0]!.id : undefined,
        ambiguous: names.length > 1 || textures.length > 1,
        textureKey: textures.length === 1 ? textures[0] : undefined,
        textureAmbiguous: textures.length > 1,
      });
    });
    for (const definition of await library.itemTableGarageDefinitions()) {
      if (definition.kind !== "kart" || !definition.title) continue;
      titles.set(definition.internalId.toLowerCase(), {
        title: definition.title,
        itemId: String(definition.itemId),
        ambiguous: false,
        textureKey: definition.textureKey ?? "1",
        textureAmbiguous: false,
      });
    }
    return titles;
  })();
}
