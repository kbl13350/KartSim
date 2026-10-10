import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";

import { loadGaragePreparation } from "./garage-upgrade-preparation-loading";

const release = readFileSync(
  new URL("../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url),
  "utf8",
);
const view = parse(release, { sourceType: "module" }).program.body.find(node =>
  node.type === "ClassDeclaration" && node.id?.name === "Ja");
assert.ok(view && view.type === "ClassDeclaration");
const source = release.slice(view.start!, view.end!);

test("upgrade preparation success, failure and late response match Ja.load", async () => {
  const run = async (released: boolean, mode: "success" | "failure" | "disposed") => {
    const events: unknown[] = [];
    let resolveLoad: ((assets: { name: string }) => void) | undefined;
    let rejectLoad: ((error: Error) => void) | undefined;
    const loadAssets = (_library: unknown) => {
      events.push("load");
      return new Promise<{ name: string }>((resolve, reject) => {
        resolveLoad = resolve;
        rejectLoad = reject;
      });
    };
    const Original = new Function("Ha", source + ";return Ja;")(loadAssets) as
      new (...args: never[]) => {
        disposed: boolean;
        assets?: { name: string };
        load(library: unknown): Promise<void>;
        controls: { replaceChildren(): void };
        status: { textContent: string };
        cancelButton(): void;
        refresh(): void;
      };
    const host = released ? Object.create(Original.prototype) as InstanceType<typeof Original>
      : {} as InstanceType<typeof Original>;
    Object.assign(host, {
      disposed: false,
      assets: undefined,
      controls: { replaceChildren: () => { events.push("clear"); } },
      status: { textContent: "loading" },
      cancelButton: () => { events.push("cancel"); },
      refresh: () => { events.push("refresh"); },
    });
    const pending = released ? host.load("library")
      : loadGaragePreparation(host, "library", loadAssets);
    if (mode === "disposed") host.disposed = true;
    if (mode === "failure") rejectLoad!(new Error("assets unavailable"));
    else resolveLoad!({ name: "native-assets" });
    await pending;
    return { events, assets: host.assets, status: host.status.textContent };
  };
  for (const mode of ["success", "failure", "disposed"] as const)
    assert.deepEqual(await run(false, mode), await run(true, mode), mode);
});
