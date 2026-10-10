import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";
import { loadGarageXunUpgradePanels,
  type GarageXunPanelDependencies, type GarageXunPanelLibrary,
} from "./garage-xun-upgrade-panels";
import type { GarageAssetNode } from "./garage-asset-bundle";

const release = readFileSync(new URL(
  "../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
const declaration = parse(release, { sourceType: "module" }).program.body.find(node =>
  node.type === "FunctionDeclaration" && node.id?.name === "Ma");
assert.ok(declaration && declaration.type === "FunctionDeclaration");
const originalSource = release.slice(declaration.start!, declaration.end!);

const node = (name: string, children: GarageAssetNode[] = [],
  properties: Record<string, string> = {}): GarageAssetNode => ({
    name, children,
    attributes: Object.entries(properties).map(([key, value]) =>
      ({ name: key, value })),
  });
const attribute = (source: GarageAssetNode, name: string): string | undefined =>
  source.attributes.find(value => value.name === name)?.value;
type Variant = "normal" | "result-only" | "missing-resource" |
  "missing-page" | "missing-scene" | "bad-duration" | "load-failure";

async function run(released: boolean, variant: Variant): Promise<unknown> {
  const events: unknown[] = [];
  const directory = "dialog2_/kart12TuningLevelUp/";
  const stages = ["preEffect", "successEffect", "successResult"];
  const resource = node("layout", variant === "missing-page" ? [] : [
    node("page", stages.map(name => node("panel", [], {
      name, ...variant === "missing-scene" && name === "successEffect" ?
        {} : { scene: `scene-${name}` },
    })), { name: "1600" }),
  ]);
  const library: GarageXunPanelLibrary = {
    exactCanonicalCandidates(path) {
      if (variant === "missing-resource") return [];
      assert.equal(path, `${directory}kart12TuningLevelUpResult@zz.bml`);
      return [{ sourceName: path, async bytes() {
        events.push("read-layout");
        return resource as unknown as Uint8Array;
      } }];
    },
  };
  const dependencies: GarageXunPanelDependencies = {
    directory, stages, parseBml: bytes => bytes as unknown as GarageAssetNode,
    attribute,
    async loadScene(_library, request, environment, stage) {
      assert.equal(environment, "environment");
      assert.equal(stage, "stage");
      events.push(["load", request.path, attribute(request.panel, "name")]);
      if (variant === "load-failure" &&
          request.path.endsWith("successEffect.1s"))
        throw new Error("scene rejected");
      const durationMs = variant === "bad-duration" &&
        request.path.endsWith("successEffect.1s") ? 60_000 : 1000;
      return { durationMs,
        dispose() { events.push(["dispose", request.path]); } };
    },
  };
  const original = new Function("es", "_a", "j", "y", "Je",
    `return (${originalSource});`)(directory, stages,
      dependencies.parseBml, attribute, dependencies.loadScene) as
    (library: GarageXunPanelLibrary, environment: unknown,
      stage: unknown, resultOnly: boolean) =>
      ReturnType<typeof loadGarageXunUpgradePanels>;
  let error: string | undefined;
  let panels: number[] | undefined;
  try {
    const result = released ? await original(library, "environment", "stage",
      variant === "result-only") :
      await loadGarageXunUpgradePanels(library, "environment", "stage",
        variant === "result-only", dependencies);
    panels = result.map(panel => panel.durationMs);
    result.forEach(panel => panel.dispose());
  } catch (cause) { error = String(cause); }
  return { error, panels, events };
}

test("Xun result scenes, partial failures and cleanup match release Ma", async () => {
  for (const variant of ["normal", "result-only", "missing-resource",
    "missing-page", "missing-scene", "bad-duration", "load-failure"] as const)
    assert.deepEqual(await run(false, variant), await run(true, variant), variant);
});
