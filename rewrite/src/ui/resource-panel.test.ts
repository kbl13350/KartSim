import assert from "node:assert/strict";
import test from "node:test";

import { formatBytes, resourceButtonState, rowStatus, statusText } from "./resource-panel";
import { resourceWindowDefinition } from "./resource-window";
import type { Node } from "./bml-kit";

const status = (progressBytes: number, state: "complete" | "partial" | "none", queued = false) =>
  ({ totalBytes: 1000, cachedBytes: progressBytes, progressBytes, state, downloading: queued, queued });

test("the window's sizes and states", () => {
  assert.equal(formatBytes(341.4 * 1024 ** 2), "341.4 MB");
  assert.equal(formatBytes(3.49 * 1024 ** 3), "3.49 GB");
  assert.equal(formatBytes(300), "0 KB");
  assert.equal(statusText(status(1000, "complete")), "已下载");
  assert.equal(statusText(status(0, "none")), "未下载");
  assert.equal(statusText(status(2, "partial")), "已下载 <1%");
  assert.equal(statusText(status(523, "partial", true)), "下载中 52%");
  assert.deepEqual([status(1000, "complete"), status(523, "partial", true), status(523, "partial"),
    status(0, "none")].map(rowStatus), ["完成", "下载中", "52%", "未下载"]);
});

test("the window is a release CaptionDialog with a row a group and ten theme cells", () => {
  const names: string[] = [];
  const frames = new Set<string>();
  const walk = (entry: Node): void => {
    for (const attribute of entry.attributes) {
      if (attribute.name === "name") names.push(attribute.value);
      if (attribute.name === "frame") frames.add(attribute.value);
    }
    entry.children.forEach(walk);
  };
  walk(resourceWindowDefinition(14));
  assert.equal(names.filter(name => /^groupRow\d+$/.test(name)).length, 14);
  assert.equal(names.filter(name => /^themeCell\d+$/.test(name)).length, 10);
  for (const name of ["primaryButton", "secondaryButton", "downloadAll", "pauseAll", "okButton", "gauge"])
    assert.ok(names.includes(name), name);
  // TitleCapBottomGrey is painted by the window (its bottom middle has no width for the frame renderer).
  assert.deepEqual([...frames].sort(), ["CaptionDialog", "CaptionWindowGrey", "CaptionWindowRightSlot", "TitleCap"]);
  assert.ok(names.includes("detailBack"));
});

test("the top-bar button: progress while downloading, gone once everything is here", () => {
  const job = (doneBytes: number) => ({ totalBytes: 200, doneBytes: () => doneBytes }) as never;
  const manager = (jobs: never[], cachedBytes: number) => ({ activeJobs: () => jobs,
    totals: () => ({ cachedBytes, totalBytes: 1000 }) });
  assert.deepEqual(resourceButtonState(manager([], 400)), { hidden: false, text: "资源下载" });
  assert.deepEqual(resourceButtonState(manager([job(50), job(100)], 400)), { hidden: false, text: "下载中 37%" });
  assert.deepEqual(resourceButtonState(manager([], 1000)), { hidden: true, text: "资源下载" });
  // A job still running keeps it, even when the totals already add up.
  assert.equal(resourceButtonState(manager([job(200)], 1000)).hidden, false);
});
