import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import {
  deleteGhostFromMenu, exportGhostFromMenu, importSelectedGhostFile,
  isCurrentGhostImport, switchToImportedGhostTrack,
} from "../src/timeattack/ghost-menu-import.ts";
import { GhostMenuPanel } from "../src/timeattack/ghost-menu-panel.ts";

const release = readFileSync(
  new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const panelNode = parse(release, { sourceType: "module" }).program.body.find(
  node => node.type === "ClassDeclaration" && node.id.name === "Ly");
assert.ok(panelNode);
const panelSource = release.slice(panelNode.start, panelNode.end);

async function scenario(readable) {
  const events = [];
  let nextId = 0;
  let mode = "native";
  class Element {
    constructor(tag) { this.tag = tag; this.id = ++nextId; events.push(["create", tag, this.id]); }
    attributes = {};
    addEventListener(name) { events.push(["listen", this.id, name]); }
    removeEventListener(name) { events.push(["unlisten", this.id, name]); }
    setAttribute(name, value) { this.attributes[name] = value; }
    append(...children) { events.push(["append", this.id, ...children.map(child => child.id)]); }
    click() { events.push(["click", this.id]); }
    remove() { events.push(["remove", this.id]); }
  }
  const labels = {
    native: "原生", "native-smooth": "原生平滑", c1: "C1", c2: "C2",
  };
  const modes = ["native", "native-smooth", "c1", "c2"];
  const nextSamplingMode = current =>
    modes[(modes.indexOf(current) + 1) % modes.length];
  const saveSamplingMode = next => events.push(["save mode", next]);
  const importDependencies = {};
  const OriginalPanel = new Function(
    "qh0", "Xh0", "jh0", "deleteGhostFromMenu", "exportGhostFromMenu",
    "importSelectedGhostFile", "ghostMenuImportDependencies",
    "isCurrentGhostImport", "switchToImportedGhostTrack",
    `${panelSource}; return Ly;`,
  )(labels, nextSamplingMode, saveSamplingMode,
    deleteGhostFromMenu, exportGhostFromMenu, importSelectedGhostFile,
    importDependencies, isCurrentGhostImport, switchToImportedGhostTrack);
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", {
    configurable: true, value: { createElement: tag => new Element(tag) },
  });
  try {
    const root = new Element("root");
    const options = {
      root,
      samplingMode: () => mode,
      onSamplingModeChange: next => { events.push(["mode", next]); mode = next; },
      resetNickname: () => events.push(["reset nickname"]),
      currentGhostKey: () => "test-key",
      deleteGhost: async key => events.push(["delete ghost", key]),
      exportGhost: async key => events.push(["export ghost", key]),
      reportError: message => events.push(["error", message]),
    };
    const panel = readable
      ? new GhostMenuPanel(options, {
        samplingLabels: labels, nextSamplingMode, saveSamplingMode,
        import: importDependencies,
      })
      : new OriginalPanel(options);
    const initial = {
      children: [panel.importButton, panel.exportButton,
        panel.deleteButton, panel.samplingModeButton,
        panel.resetNicknameButton, panel.input].map(element => ({
        id: element.id, tag: element.tag, type: element.type,
        text: element.textContent, accept: element.accept, hidden: element.hidden,
      })),
      className: panel.panel.className,
    };
    panel.onSamplingModeToggle();
    panel.onSamplingModeToggle();
    panel.openPicker();
    await panel.deleteGhost();
    await panel.exportGhost();
    const importCurrent = [panel.isCurrentImport(0), panel.isCurrentImport(1)];
    panel.dispose();
    panel.dispose();
    return {
      events, initial, importCurrent,
      final: {
        disposed: panel.disposed,
        label: panel.samplingModeButton.textContent,
        pressed: panel.samplingModeButton.attributes["aria-pressed"],
        input: panel.input.value,
      },
    };
  } finally {
    if (previousDocument)
      Object.defineProperty(globalThis, "document", previousDocument);
    else delete globalThis.document;
  }
}

test("Ghost menu controls, mode labels, actions and disposal match release", async () => {
  assert.deepEqual(await scenario(true), await scenario(false));
});
