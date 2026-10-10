import assert from "node:assert/strict";
import test from "node:test";
import {
  formatDownloadBytes,
  formatDownloadTitle,
  installStartupLoadingSkin,
  startupLoadingPercent,
} from "./startup-loading-skin";

test("the loading bar shows the overall percentage, clamped to 0..100", () => {
  assert.equal(startupLoadingPercent(null), 0);
  assert.equal(startupLoadingPercent("42.3"), 42.3);
  assert.equal(startupLoadingPercent("120"), 100);
  assert.equal(startupLoadingPercent("-5"), 0);
  assert.equal(startupLoadingPercent("not a number"), 0);
});

test("formatDownloadBytes formats bytes into human-readable strings", () => {
  assert.equal(formatDownloadBytes(0), "0 B");
  assert.equal(formatDownloadBytes(-10), "0 B");
  assert.equal(formatDownloadBytes(512), "512 B");
  assert.equal(formatDownloadBytes(1024), "1.0 KB");
  assert.equal(formatDownloadBytes(1536), "1.5 KB");
  assert.equal(formatDownloadBytes(1048576), "1.0 MB");
  assert.equal(formatDownloadBytes(26214400), "25.0 MB");
});

test("formatDownloadTitle formats raw labels and byte progress", () => {
  assert.equal(formatDownloadTitle(), "当前下载：暂无");
  assert.equal(formatDownloadTitle(undefined), "当前下载：暂无");
  assert.equal(formatDownloadTitle("正在加载 DataPack2_00000.rho5"), "当前下载：DataPack2_00000.rho5");
  assert.equal(
    formatDownloadTitle("正在加载 DataPack2_00000.rho5", 10485760, 20971520),
    "当前下载：DataPack2_00000.rho5 (10.0 MB / 20.0 MB)",
  );
  assert.equal(
    formatDownloadTitle("character_dao.rho", 512, 1024),
    "当前下载：character_dao.rho (512 B / 1.0 KB)",
  );
});

test("installStartupLoadingSkin appends both overall and download progress tracks", () => {
  class FakeNode {
    className = "";
    textContent = "";
    children: FakeNode[] = [];
    attributes = new Map<string, string>();
    style: Record<string, string> = {};

    setAttribute(name: string, value: string) { this.attributes.set(name, value); }
    getAttribute(name: string) { return this.attributes.get(name) ?? null; }
    removeAttribute(name: string) { this.attributes.delete(name); }
    append(...nodes: FakeNode[]) { this.children.push(...nodes); }
    prepend(...nodes: FakeNode[]) { this.children.unshift(...nodes); }
    querySelector(selector: string): FakeNode | null {
      const match = (node: FakeNode): boolean => {
        if (selector.startsWith(".") && node.className.split(/\s+/).includes(selector.slice(1))) return true;
        return false;
      };
      for (const child of this.children) {
        if (match(child)) return child;
        const sub = child.querySelector(selector);
        if (sub) return sub;
      }
      return null;
    }
  }

  const headNode = new FakeNode();
  const bodyNode = new FakeNode();
  const fakeDoc = {
    head: headNode,
    body: bodyNode,
    createElement: (_tag: string) => new FakeNode(),
    querySelector: (selector: string) => bodyNode.querySelector(selector),
  } as unknown as Document;

  const view = new FakeNode();
  view.className = "startup-loading";
  const copy = new FakeNode();
  copy.className = "startup-loading-copy";
  const label = new FakeNode();
  label.className = "startup-loading-label";
  copy.append(label);
  view.append(copy);
  bodyNode.append(view);

  // Global MutationObserver fallback for test environment
  const originalMutationObserver = globalThis.MutationObserver;
  (globalThis as unknown as { MutationObserver: unknown }).MutationObserver = class {
    observe() {}
    disconnect() {}
  };

  try {
    installStartupLoadingSkin(fakeDoc);
    assert.ok(view.querySelector(".ks-loading-track"), "overall track must exist");
    assert.ok(view.querySelector(".ks-loading-fill"), "overall fill must exist");
    assert.ok(view.querySelector(".ks-download-track"), "download track must exist");
    assert.ok(view.querySelector(".ks-download-fill"), "download fill must exist");
    assert.ok(view.querySelector(".ks-download-title"), "download title must exist");
    assert.ok(view.querySelector(".ks-download-percent"), "download percent must exist");
  } finally {
    (globalThis as unknown as { MutationObserver: unknown }).MutationObserver = originalMutationObserver;
  }
});
