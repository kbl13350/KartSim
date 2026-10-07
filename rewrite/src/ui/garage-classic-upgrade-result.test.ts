import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";
import { loadGarageClassicUpgradeResult,
  type GarageClassicResultDependencies, type GarageClassicResultLibrary,
  type GarageClassicDrawContext, type GarageClassicUpgradeSummary,
} from "./garage-classic-upgrade-result";
import type { GarageAssetNode, GarageAssetRect } from "./garage-asset-bundle";

const release = readFileSync(new URL(
  "../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
const declaration = parse(release, { sourceType: "module" }).program.body.find(node =>
  node.type === "FunctionDeclaration" && node.id?.name === "ka");
assert.ok(declaration && declaration.type === "FunctionDeclaration");
const originalSource = release.slice(declaration.start!, declaration.end!);

const node = (name: string, properties: Record<string, string> = {},
  children: GarageAssetNode[] = []): GarageAssetNode => ({
    name, children, attributes: Object.entries(properties).map(([key, value]) =>
      ({ name: key, value })),
  });
const attribute = (source: GarageAssetNode, name: string): string | undefined =>
  source.attributes.find(value => value.name === name)?.value;
type Variant = "normal" | "missing-layout" | "missing-main" |
  "missing-scene-name" | "missing-image" | "bad-duration" |
  "font-failure" | "scene-failure";

async function run(released: boolean, variant: Variant): Promise<unknown> {
  const events: unknown[] = [];
  const directory = "dialog/kartLevelUp/";
  const okButton = node("Button", { name: "okButton" });
  const main = node("Panel", { name: "main", image: "background" }, [
    node("Image", { name: "kartLevel", texture: "levelDigits", fontSize: "20 30" }),
    node("Text", { name: "kartName" }),
    node("Text", { name: "kartDesc" }),
    node("Text", { text: "#sb(levelUpResult)" }),
    okButton,
  ]);
  const success = node("Dialog", { name: "success" }, [
    ...variant === "missing-main" ? [] : [main],
    node("Scene", { name: "preEffect",
      ...variant === "missing-scene-name" ? {} : { scene: "effect" } }),
    node("Panel", { name: "itemPanel" }),
  ]);
  const layout = node("root", {}, [success]);
  const resources = new Map<string, unknown>([
    [`${directory}kartLevelUpResult@cn.bml`, layout],
    [`${directory}background.png`, new Uint8Array([1])],
    [`${directory}levelDigits.png`, new Uint8Array([2])],
  ]);
  if (variant === "missing-layout")
    resources.delete(`${directory}kartLevelUpResult@cn.bml`);
  if (variant === "missing-image")
    resources.delete(`${directory}levelDigits.png`);
  const library: GarageClassicResultLibrary = {
    exactCanonicalCandidates(path) {
      return resources.has(path) ? [{ sourceName: path, async bytes() {
        events.push(["read", path]);
        return resources.get(path) as Uint8Array;
      } }] : [];
    },
  };
  const childRect = (source: GarageAssetNode,
    parent: GarageAssetRect): GarageAssetRect & { source: string } => ({
      x: parent.x + 2, y: parent.y + 3,
      width: parent.width - 4, height: parent.height - 6,
      source: attribute(source, "name") ?? source.name,
    });
  const dependencies: GarageClassicResultDependencies = {
    directory, fontFamily: "Test Garage Font", parseBml: bytes =>
      bytes as unknown as GarageAssetNode, attribute, childRect,
    async loadFont() {
      events.push("load-font");
      if (variant === "font-failure") throw new Error("font rejected");
      return "font";
    },
    unloadFont(font) { events.push(["unload-font", font]); },
    async loadScene(_library, request, environment, stage) {
      assert.equal(environment, "environment");
      assert.equal(stage, "stage");
      events.push(["load-scene", request.path]);
      if (variant === "scene-failure") throw new Error("scene rejected");
      return { durationMs: variant === "bad-duration" ? 0 : 1200,
        dispose() { events.push(["dispose-scene", request.path]); } };
    },
    async createBitmap(blob) {
      const id = new Uint8Array(await blob.arrayBuffer())[0] ?? 0;
      events.push(["create-bitmap", id]);
      return { id, width: 64, height: 32,
        close() { events.push(["close-bitmap", id]); } };
    },
  };
  const original = new Function(
    "Jt", "j", "y", "Y", "ws", "Je", "createImageBitmap",
    "Blob", "Ce", "Ta", "yt", `return (${originalSource});`,
  )(directory, dependencies.parseBml, attribute, childRect,
    dependencies.loadFont, dependencies.loadScene,
    dependencies.createBitmap, Blob, dependencies.unloadFont,
    (summary: GarageClassicUpgradeSummary) => [
      `等级 Lv.${summary.beforeLevel} → Lv.${summary.afterLevel}`,
      `可用强化点 ${summary.beforePoints} → ${summary.afterPoints}`,
    ], dependencies.fontFamily) as
    (library: GarageClassicResultLibrary, environment: unknown,
      stage: unknown) => ReturnType<typeof loadGarageClassicUpgradeResult>;

  let error: string | undefined;
  let snapshot: unknown;
  try {
    const assets = released ? await original(library, "environment", "stage") :
      await loadGarageClassicUpgradeResult(library, "environment", "stage",
        dependencies);
    const draws: unknown[] = [];
    const context: GarageClassicDrawContext = {
      fillStyle: "", textAlign: "center", textBaseline: "middle", font: "",
      clearRect(...args) { draws.push(["clear", ...args]); },
      drawImage(image, ...args) {
        draws.push(["image", image.width, image.height, ...args]);
      },
      save() { draws.push("save"); },
      restore() { draws.push("restore"); },
      fillText(text, x, y, maxWidth) {
        draws.push(["text", text, x, y, maxWidth, this.fillStyle,
          this.textAlign, this.textBaseline, this.font]);
      },
    };
    assets.drawResult(context, "赛车", {
      beforeLevel: 4, afterLevel: 5, beforePoints: 2, afterPoints: 3,
    });
    snapshot = { duration: assets.panel.durationMs,
      rect: assets.rect, preview: assets.preview, accept: assets.accept, draws };
    assets.dispose();
  } catch (cause) { error = String(cause); }
  return { error, snapshot, events };
}

test("classic upgrade scene, layout, art, text and cleanup match release ka", async () => {
  for (const variant of ["normal", "missing-layout", "missing-main",
    "missing-scene-name", "missing-image", "bad-duration", "font-failure",
    "scene-failure"] as const)
    assert.deepEqual(await run(false, variant), await run(true, variant), variant);
});
