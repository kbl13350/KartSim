import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import {
  chooseLocalResourceDirectory, recoverLocalResourceDirectory,
  supportsLocalResourceDirectory,
} from "../src/resources/local-directory-source.ts";

const release = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const declarations = parse(release, { sourceType: "module" }).program.body;
function sourceOf(name) {
  const node = declarations.find(item => item.id?.name === name ||
    item.declarations?.some(part => part.id.name === name));
  assert.ok(node, name);
  return release.slice(node.start, node.end);
}
const original = new Function(
  `${sourceOf("no0")}\n${["io0", "ro0", "so0", "gP", "ao0", "co0"].map(sourceOf).join("\n")};
  return { supports: io0, recover: ro0, choose: so0 };`,
)();

function fakeIndexedDb(calls, scenario, directory) {
  let saved = scenario.saved ? directory : undefined;
  return {
    open(name, version) {
      calls.push(["open", name, version]);
      const request = {};
      const database = {
        createObjectStore(name) { calls.push(["create store", name]); },
        transaction(name, mode) {
          calls.push(["transaction", name, mode]);
          const transaction = {
            objectStore(name) {
              calls.push(["object store", name]);
              return {
                get(key) {
                  calls.push(["get", key]);
                  const result = {};
                  queueMicrotask(() => {
                    result.result = saved;
                    result.onsuccess?.();
                  });
                  return result;
                },
                put(value, key) {
                  calls.push(["put", key]);
                  saved = value;
                  queueMicrotask(() => {
                    if (scenario.saveError) {
                      transaction.error = new Error("write failed");
                      transaction.onerror?.();
                    } else transaction.oncomplete?.();
                  });
                },
              };
            },
          };
          return transaction;
        },
        close() { calls.push("close"); },
      };
      queueMicrotask(() => {
        if (scenario.openError) {
          request.error = new Error("open failed");
          request.onerror?.();
        } else {
          request.result = database;
          request.onupgradeneeded?.();
          request.onsuccess?.();
        }
      });
      return request;
    },
  };
}

async function run(kind, scenario) {
  const calls = [];
  const directory = {
    queryPermission({ mode }) {
      calls.push(["permission", mode]);
      if (scenario.permissionError) throw new Error("permission failed");
      return Promise.resolve(scenario.permission ?? "granted");
    },
    getFileHandle(name) {
      calls.push(["file", name]);
      if (scenario.missingArchive) throw new Error("missing aaa.pk");
      return Promise.resolve({});
    },
  };
  const windowStub = {
    showDirectoryPicker: scenario.noPicker ? undefined : function(options) {
      calls.push(["picker", options.mode, this === windowStub]);
      return Promise.resolve(directory);
    },
  };
  const savedWindow = globalThis.window;
  const savedDatabase = globalThis.indexedDB;
  globalThis.window = windowStub;
  globalThis.indexedDB = fakeIndexedDb(calls, scenario, directory);
  const impl = kind === "original" ? original : {
    supports: supportsLocalResourceDirectory,
    recover: recoverLocalResourceDirectory,
    choose: chooseLocalResourceDirectory,
  };
  try {
    const supports = impl.supports();
    let recovered, chosen;
    try { recovered = await impl.recover() === directory; }
    catch (error) { recovered = { error: error.message }; }
    try { chosen = await impl.choose() === directory; }
    catch (error) { chosen = { error: error.message }; }
    return { supports, recovered, chosen, calls };
  } finally {
    globalThis.window = savedWindow;
    globalThis.indexedDB = savedDatabase;
  }
}

test("saved and newly selected Data directories match release behavior", async () => {
  for (const scenario of [
    {}, { saved: true }, { saved: true, permission: "denied" },
    { saved: true, permissionError: true }, { noPicker: true },
    { missingArchive: true }, { saveError: true }, { openError: true },
  ]) {
    assert.deepEqual(await run("rewritten", scenario),
      await run("original", scenario), JSON.stringify(scenario));
  }
});
