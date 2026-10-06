export interface GarageCardVehicle {
  itemId: number;
  title: string;
  [key: string]: unknown;
}

export interface GarageCardButton {
  title: string;
  textContent: string;
  dataset: { filter?: string };
  classList: { toggle(name: string, enabled: boolean): void };
  setAttribute(name: string, value: string): void;
}

export interface GarageVisibleCard {
  item: GarageCardVehicle;
  isHovered: () => boolean;
  kartZoom: number;
  kartShadow: boolean;
  rect: unknown;
}

export interface GarageCardCatalogHost {
  pageMode: string;
  page: number;
  filter: number;
  selected: GarageCardVehicle;
  factoryPanel?: {
    showsCatalog: boolean;
    catalogLayout?: {
      pageSize: number;
      kartZoom: number;
      thumbnail(index: number): unknown;
    };
  };
  pageLabel: { textContent: string; title: string };
  controls: { querySelectorAll(selector: string): ArrayLike<GarageCardButton> &
    { forEach(callback: (button: GarageCardButton) => void): void } };
  cards: { replaceChildren(): void; append(button: GarageCardButton): void };
  visibleCards: GarageVisibleCard[];
  assets: { kartCardLayout: { kartZoom: number }; [key: string]: unknown };
  filteredKarts(): GarageCardVehicle[];
  button(label: string, onClick: () => void): GarageCardButton;
  selectKart(vehicle: GarageCardVehicle): void;
}

export interface GarageCardCatalogDependencies {
  standardPageSize: number;
  hoverState(button: GarageCardButton): () => boolean;
  standardCardRect(assets: GarageCardCatalogHost["assets"], index: number): unknown;
}

/** Page the filtered kart list and expose only the cards used by the active garage layout. */
export function updateGarageCards(
  host: GarageCardCatalogHost,
  dependencies: GarageCardCatalogDependencies,
): void {
  const factory = host.pageMode === "factory";
  const factoryLayout = factory ? host.factoryPanel?.catalogLayout : undefined;
  const pageSize = factoryLayout?.pageSize ?? dependencies.standardPageSize;
  const vehicles = host.filteredKarts();
  const pageCount = Math.max(1, Math.ceil(vehicles.length / pageSize));
  host.page = Math.min(Math.max(0, host.page), pageCount - 1);
  host.pageLabel.textContent = `${host.page + 1} / ${pageCount}`;
  host.pageLabel.title = `${vehicles.length} 辆车`;
  host.controls.querySelectorAll("[data-filter]").forEach(button => {
    button.classList.toggle("selected", Number(button.dataset.filter) === host.filter);
  });
  host.cards.replaceChildren();
  if (factory && !host.factoryPanel?.showsCatalog) {
    host.visibleCards = [];
    return;
  }
  host.visibleCards = vehicles
    .slice(host.page * pageSize, (host.page + 1) * pageSize)
    .map((vehicle, index) => {
      const button = host.button(vehicle.title, () => host.selectKart(vehicle));
      button.title = `${vehicle.title} (#${vehicle.itemId})`;
      button.setAttribute("aria-label", vehicle.title);
      button.textContent = "";
      button.classList.toggle("selected", vehicle.itemId === host.selected.itemId);
      host.cards.append(button);
      return {
        item: vehicle,
        isHovered: dependencies.hoverState(button),
        kartZoom: factoryLayout?.kartZoom ?? host.assets.kartCardLayout.kartZoom,
        kartShadow: !factory,
        rect: factoryLayout ? factoryLayout.thumbnail(index)
          : dependencies.standardCardRect(host.assets, index),
      };
    });
}
