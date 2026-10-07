import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";
import {
  loadGarageSkillAssets, type GarageSkillAssetsDependencies,
  type GarageSkillAssetsLibrary,
} from "./garage-skill-assets";
import type { GarageAssetNode } from "./garage-asset-bundle";

const release = readFileSync(new URL(
  "../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
const declaration = parse(release, { sourceType: "module" }).program.body.find(node =>
  node.type === "FunctionDeclaration" && node.id?.name === "Ba");
assert.ok(declaration && declaration.type === "FunctionDeclaration");
const originalSource = release.slice(declaration.start!, declaration.end!);

interface TestNode extends GarageAssetNode { children: TestNode[] }
const node = (name: string, properties: Record<string, string> = {},
  children: TestNode[] = []): TestNode => ({ name, children,
    attributes: Object.entries(properties).map(([key, value]) => ({ name: key, value })) });
const attribute = (source: GarageAssetNode | undefined,
  name: string): string | undefined =>
  source?.attributes.find(value => value.name === name)?.value;

type Variant = "normal" | "missing-container" | "missing-card" |
  "missing-slot" | "missing-image" | "missing-caption" | "colors";

async function run(released: boolean, variant: Variant): Promise<unknown> {
  const events: unknown[] = [];
  const directory = "dialog2_/skill/";
  const lines = [1, 2, 3].map(line => node("Line",
    { name: `skillLine${line}` },
    Array.from({ length: 3 }, (_, offset) => node("Slot",
      { name: String((line - 1) * 3 + offset + 1) }))));
  if (variant === "missing-slot") lines[0]!.children.shift();
  const caption = node("Caption", {
    name: "skillTuningCaption", textRender: "bold22",
    textColor: variant === "colors" ? "255 10 20 30" : "white",
    textAlign: "left,vcenter",
  });
  const skillTuning = node("SkillTuning", { name: "skillTuning" }, [
    node("SpeedPage", { name: "speedPage" }, lines),
    node("GameType", { name: "gameType" }, [
      node("Speed", { name: "speedPage" }),
      node("Item", { name: "itemPage" }),
    ]),
    ...(variant === "missing-caption" ? [] : [caption]),
  ]);
  const container = node("Container", { name: "container" }, [
    skillTuning, node("Button", { name: "closeButton" }),
    node("Button", { name: "okButton", textRender: "bold18",
      textColor: variant === "colors" ? "200 10 20 30" : "white" }),
    node("Button", { name: "cancelButton" }),
  ]);
  const window = node("root", {}, variant === "missing-container" ? [] : [container]);
  const card = node("card", {}, [
    ...(variant === "missing-card" ? [] :
      [node("Image", { name: "skillIcon" })]),
    node("Label", { name: "skillName" }),
    node("Tag", { name: "curSkillSlotTag" }),
  ]);
  const resources = new Map<string, unknown>([
    [`${directory}kart12SkillTuning@zz.bml`, window],
    [`${directory}speedSkillTuningCard.bml`, card],
    [`${directory}tuning_selectperformPopupBg_s.png`, new Uint8Array([1])],
    [`${directory}tuning_selectperform_slotBg_s.png`, new Uint8Array([2])],
  ]);
  if (variant === "missing-image")
    resources.delete(`${directory}tuning_selectperform_slotBg_s.png`);
  const entry = (path: string) => ({ sourceName: path,
    async bytes(): Promise<Uint8Array> {
      events.push(["bytes", path]);
      return resources.get(path) as Uint8Array;
    } });
  const library: GarageSkillAssetsLibrary = {
    exactCanonicalCandidates(path) {
      return resources.has(path) ? [entry(path)] : [];
    },
  };
  let urlId = 0;
  const dependencies: GarageSkillAssetsDependencies = {
    directory,
    imageNames: ["tuning_selectperformPopupBg_s", "tuning_selectperform_slotBg_s"],
    parseBml: bytes => bytes as unknown as GarageAssetNode,
    attribute,
    childRect: (source, parent) => ({
      x: parent.x + 2, y: parent.y + 3,
      width: Math.max(0, (parent.width ?? 0) - 1),
      height: Math.max(0, (parent.height ?? 0) - 1),
      source: source.name,
    }),
    createBitmap: async () => {
      const id = events.filter(value => Array.isArray(value) &&
        value[0] === "bitmap").length;
      events.push(["bitmap", id]);
      return { width: 120, height: 80,
        close() { events.push(["bitmap-close", id]); } };
    },
    createObjectUrl: () => { const url = `blob:${urlId++}`;
      events.push(["url", url]); return url; },
    revokeObjectUrl: url => { events.push(["url-revoke", url]); },
  };
  const original = new Function(
    "Fa", "j", "Ga", "createImageBitmap", "URL", "Blob", "y", "Y",
    `return (${originalSource});`,
  )(
    dependencies.directory, dependencies.parseBml, dependencies.imageNames,
    dependencies.createBitmap,
    { createObjectURL: dependencies.createObjectUrl,
      revokeObjectURL: dependencies.revokeObjectUrl },
    Blob, attribute, dependencies.childRect,
  ) as (library: GarageSkillAssetsLibrary) =>
    Promise<Awaited<ReturnType<typeof loadGarageSkillAssets>>>;
  let error: string | undefined;
  let snapshot: unknown;
  try {
    const assets = released ? await original(library) :
      await loadGarageSkillAssets(library, dependencies);
    snapshot = {
      rects: [...assets.rects], cards: [...assets.cards],
      cardIcon: assets.cardIcon, cardName: assets.cardName,
      cardTag: assets.cardTag, headingStyle: assets.headingStyle,
      actionStyles: [...assets.actionStyles], urls: [...assets.urls],
    };
    assets.dispose();
  } catch (cause) { error = String(cause); }
  return { error, snapshot, events };
}

test("skill picker images, native layout, colors and errors match release Ba", async () => {
  for (const variant of ["normal", "colors", "missing-container", "missing-card",
    "missing-slot", "missing-image", "missing-caption"] as const)
    assert.deepEqual(await run(false, variant), await run(true, variant), variant);
});
