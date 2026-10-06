import type { GaragePreviewRect } from "./garage-transform-preview";

export interface GarageOverlayKart {
  itemId: number;
  engineGrade: number;
}

export interface GarageOverlayCharacter {
  itemId: number;
}

export interface GarageOverlayPanels {
  isPreviewReady: boolean;
  setPreviewSize(width: number, height: number, owner: string): void;
  render(time: number, width: number, height: number, cards: unknown[],
    previewRect: GaragePreviewRect, kart: GarageOverlayKart | undefined,
    character: GarageOverlayCharacter, equipment: Record<string, unknown>,
    coating: undefined, live: boolean, ratio: number): void;
  renderKartSnapshot(time: number, width: number, height: number,
    kart: GarageOverlayKart, rect: GaragePreviewRect, ratio: number): unknown;
  renderPreviewSnapshot(time: number, width: number, height: number,
    rect: GaragePreviewRect, ratio: number): unknown;
}

export interface GarageStrengtheningOverlayHost {
  panels?: GarageOverlayPanels;
  options: {
    catalog: { characters: GarageOverlayCharacter[] };
    selectedCharacterItemId: number;
    profile: unknown;
  };
  preparation?: {
    previewRect?: GaragePreviewRect;
    selected?: GarageOverlayKart;
    cards: unknown[];
    previewCard?: unknown;
    draw(panels: GarageOverlayPanels): void;
  };
  upgrade?: {
    capturePreview(panels: GarageOverlayPanels, rect: GaragePreviewRect): void;
    render(time: number, panels: GarageOverlayPanels): void;
  };
  pageMode: string;
  selected: GarageOverlayKart;
  visibleCards: unknown[];
  configuration: unknown;
  cosmeticPreview?: { family: string; slot: string; id: number };
  assets: { stage: { width: number; height: number } };
  renderPixelRatio: number;
  serial(): number;
  activePreviewRect(): GaragePreviewRect;
  nativeFactoryAllowed(): boolean;
}

export interface GarageStrengtheningOverlayDependencies {
  composeEquipment(profile: unknown, kartItemId: number,
    characterItemId: number): Record<string, unknown>;
  currentConfiguration(configuration: unknown, itemId: number,
    serial: number): { cosmetics?: Record<string, unknown> };
  writeConfiguration(configuration: unknown, itemId: number, serial: number,
    value: { cosmetics: Record<string, unknown> }): unknown;
}

/** Render the selected kart and pending cosmetic state beneath an upgrade dialog. */
export function renderGarageStrengtheningOverlay(
  host: GarageStrengtheningOverlayHost,
  time: number,
  dependencies: GarageStrengtheningOverlayDependencies,
): void {
  const panels = host.panels;
  if (!panels) return;
  const character = host.options.catalog.characters.find(candidate =>
    candidate.itemId === host.options.selectedCharacterItemId);
  if (!character) return;

  const preparation = host.preparation?.previewRect ? host.preparation : undefined;
  const previewKart = host.pageMode !== "factory" || host.nativeFactoryAllowed()
    ? preparation?.selected ?? host.selected : undefined;
  const cards = preparation?.previewCard
    ? [...preparation.cards, preparation.previewCard] : host.visibleCards;
  const equipmentKart = previewKart ?? host.selected;
  let equipment = dependencies.composeEquipment(host.options.profile,
    equipmentKart.itemId, character.itemId);
  let configuration = host.configuration;
  if (host.cosmeticPreview) {
    const current = dependencies.currentConfiguration(configuration,
      host.selected.itemId, host.serial());
    configuration = dependencies.writeConfiguration(host.configuration,
      host.selected.itemId, host.serial(), {
        ...current,
        cosmetics: {
          ...current.cosmetics,
          family: host.cosmeticPreview.family,
          [host.cosmeticPreview.slot]: host.cosmeticPreview.id,
        },
      });
  }
  equipment = { ...equipment, garage: configuration };
  const rect = preparation?.previewRect ?? host.activePreviewRect();
  const { width, height } = host.assets.stage;
  if (preparation || !panels.isPreviewReady) {
    panels.setPreviewSize(rect.width, rect.height, "garage-x");
    panels.render(time, width, height, cards, rect, previewKart, character,
      equipment, undefined, false, host.renderPixelRatio);
  }

  if (host.upgrade && previewKart) {
    let snapshot = host.selected.engineGrade === 9
      ? panels.renderKartSnapshot(time, width, height, previewKart, rect,
          host.renderPixelRatio)
      : panels.renderPreviewSnapshot(time, width, height, rect,
          host.renderPixelRatio);
    if (!snapshot && host.selected.engineGrade === 9)
      snapshot = panels.renderPreviewSnapshot(time, width, height, rect,
        host.renderPixelRatio);
    if (snapshot) host.upgrade.capturePreview(panels, rect);
  }
  host.upgrade?.render(time, panels);
  host.preparation?.draw(panels);
}
