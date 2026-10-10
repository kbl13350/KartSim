import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";

import {
  updateGarageCards, type GarageCardButton, type GarageCardCatalogDependencies,
  type GarageCardCatalogHost, type GarageCardVehicle, type GarageVisibleCard,
} from "./garage-card-catalog";

const release = readFileSync(new URL("../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
const classNode = parse(release, { sourceType: "module" }).program.body.find(node =>
  node.type === "ClassDeclaration" && node.id?.name === "As");
assert.ok(classNode);
const classSource = release.slice(classNode.start!, classNode.end!);

class ButtonStub implements GarageCardButton {
  title = "";
  textContent = "";
  dataset: { filter?: string } = {};
  classes = new Set<string>();
  attributes = new Map<string, string>();
  onClick?: () => void;
  classList = { toggle: (name: string, enabled: boolean) => {
    if (enabled) this.classes.add(name);
    else this.classes.delete(name);
  } };
  setAttribute(name: string, value: string): void { this.attributes.set(name, value); }
}

const vehicles: GarageCardVehicle[] = Array.from({ length: 12 }, (_, index) => ({
  itemId: index + 1,
  title: `Kart ${index + 1}`,
}));
type TestHost = GarageCardCatalogHost & { updateCards(): void };

function fixture(released: boolean) {
  const events: unknown[] = [];
  const filterButtons = ["0", "1", "2"].map(filter => {
    const button = new ButtonStub();
    button.dataset.filter = filter;
    return button;
  });
  let listed = vehicles;
  const dependencies: GarageCardCatalogDependencies = {
    standardPageSize: 9,
    hoverState: button => () => button.title.endsWith("#2)"),
    standardCardRect: (_assets, index) => ({ layout: "parts", index }),
  };
  const Original = new Function("kn", "xa", "Gi", `${classSource}; return As;`)(
    dependencies.standardPageSize, dependencies.hoverState, dependencies.standardCardRect,
  ) as { prototype: TestHost };
  const host = Object.create(Original.prototype) as TestHost;
  host.pageMode = "parts";
  host.page = 0;
  host.filter = 2;
  host.selected = vehicles[1]!;
  host.pageLabel = { textContent: "", title: "" };
  host.controls = { querySelectorAll: selector => {
    assert.equal(selector, "[data-filter]");
    return filterButtons;
  } };
  const cards: ButtonStub[] = [];
  host.cards = {
    replaceChildren: () => { events.push("clear-cards"); cards.length = 0; },
    append: button => { events.push(["append", button.title]); cards.push(button as ButtonStub); },
  };
  host.visibleCards = [];
  host.assets = { kartCardLayout: { kartZoom: 3 } };
  host.filteredKarts = () => { events.push("filtered"); return listed; };
  host.button = (label, onClick) => {
    events.push(["button", label]);
    const button = new ButtonStub();
    button.onClick = onClick;
    return button;
  };
  host.selectKart = vehicle => { events.push(["select", vehicle.itemId]); };
  if (!released) host.updateCards = () => updateGarageCards(host, dependencies);
  const snapshot = () => ({
    events: structuredClone(events), page: host.page, pageLabel: host.pageLabel,
    filters: filterButtons.map(button => ({ filter: button.dataset.filter,
      selected: button.classes.has("selected") })),
    cards: cards.map(button => ({ title: button.title, text: button.textContent,
      selected: button.classes.has("selected"), ariaLabel: button.attributes.get("aria-label") })),
    visible: host.visibleCards.map((card: GarageVisibleCard) => ({
      id: card.item.itemId, hovered: card.isHovered(), zoom: card.kartZoom,
      shadow: card.kartShadow, rect: card.rect,
    })),
  });
  return { host, cards, events, snapshot, setList: (items: GarageCardVehicle[]) => { listed = items; } };
}

test("parts list paging, filter state, selection, and card actions match As", () => {
  const run = (released: boolean) => {
    const f = fixture(released);
    const states: unknown[] = [];
    f.host.updateCards();
    states.push(f.snapshot());
    f.cards[1]?.onClick?.();
    states.push(f.snapshot());
    f.host.page = 20;
    f.host.updateCards();
    states.push(f.snapshot());
    f.host.page = -3;
    f.setList([]);
    f.host.updateCards();
    states.push(f.snapshot());
    return states;
  };
  assert.deepEqual(run(false), run(true));
});

test("factory catalog layout and hidden-card mode match As", () => {
  const run = (released: boolean) => {
    const f = fixture(released);
    const states: unknown[] = [];
    f.host.pageMode = "factory";
    f.host.factoryPanel = {
      showsCatalog: true,
      catalogLayout: { pageSize: 2, kartZoom: 6,
        thumbnail: index => ({ layout: "factory", index }) },
    };
    f.host.page = 2;
    f.host.updateCards();
    states.push(f.snapshot());
    f.host.factoryPanel.showsCatalog = false;
    f.host.updateCards();
    states.push(f.snapshot());
    return states;
  };
  assert.deepEqual(run(false), run(true));
});

test("generated GarageXView delegates card catalog updates", () => {
  const generated = readFileSync(new URL("../generated/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
  assert.match(generated, /from "\.\.\/ui\/garage-card-catalog\.ts"/);
  const view = parse(generated, { sourceType: "module" }).program.body.find(node =>
    node.type === "ClassDeclaration" && node.id?.name === "As");
  assert.ok(view && view.type === "ClassDeclaration");
  const method = view.body.body.find(node => node.type === "ClassMethod" &&
    node.key.type === "Identifier" && node.key.name === "updateCards");
  assert.ok(method);
  assert.match(generated.slice(method.start!, method.end!), /updateGarageCards\(this, garageCardDependencies\)/);
});
