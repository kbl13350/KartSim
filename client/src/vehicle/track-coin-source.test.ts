import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  loadTrackCoinSource,
  parseTrackCoinResources,
  uniqueOriginalCoinAsset,
  type CoinArchive,
  type CoinTrackData,
  type XmlNode,
} from "./track-coin-source";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
function sourceBetween(start: string, end: string): string {
  const startAt = release.indexOf(start);
  const endAt = release.indexOf(end, startAt + start.length);
  assert.ok(startAt >= 0 && endAt > startAt, `${start} to ${end}`);
  return release.slice(startAt, endAt);
}
const originalParse = new Function("s2", "T",
  `${sourceBetween("function v10(n) {", "class y10 {")}return v10;`,
)((node: XmlNode) => node, (node: XmlNode & { attributes?: Record<string, string> }, key: string) => node.attributes?.[key]) as (node: XmlNode) => unknown;
const originalUnique = new Function(
  `${sourceBetween("function nl(n, e) {", "const Ji =")}return nl;`,
)() as <Bytes>(archive: CoinArchive<Bytes>, path: string) => unknown;
const originalLoad = new Function("nl", "v10",
  `${sourceBetween("async function A10(n, e) {", "class jw {")}return A10;`,
)(originalUnique, originalParse) as (archive: CoinArchive<XmlNode>, track: CoinTrackData) => Promise<unknown>;

type TestXmlNode = XmlNode & { attributes?: Record<string, string> };
function node(name: string, attributes: Record<string, string> = {}, children: TestXmlNode[] = []): TestXmlNode {
  return { name, attributes, children };
}
function validXml(): TestXmlNode {
  return node("item", { name: "lucci" }, [
    node("state", { name: "Stay", life: "0", size: "3.125", item: "coin" }),
    node("state", { name: "Eaten", life: "450", fired: "glow", firedFx: "chime" }),
    node("state", { name: "Wait", life: "900" }),
  ]);
}
const xmlReader = {
  parse: (source: TestXmlNode): XmlNode => source,
  attribute: (source: XmlNode, key: string): string | undefined => (source as TestXmlNode).attributes?.[key],
};
function capture(action: () => unknown): unknown {
  try { return { value: action() }; }
  catch (error) { return { error: (error as Error).message }; }
}

test("coin resource XML rules match release across valid and invalid states", () => {
  const cases = [validXml()];
  for (const [stateIndex, field, value] of [
    [0, "size", "0"], [0, "size", "1e3"], [0, "size", "abc"],
    [0, "item", "bad/name"], [1, "life", "-1"], [1, "life", "1.2"],
    [1, "firedFx", ""], [1, "fired", "bad/name"], [2, "life", "9007199254740992"],
  ] as const) {
    const copy = validXml();
    (copy.children[stateIndex]! as TestXmlNode).attributes![field] = value;
    cases.push(copy);
  }
  const wrongRoot = validXml();
  wrongRoot.attributes!.name = "wrong";
  cases.push(wrongRoot);
  const missingState = validXml();
  missingState.children.pop();
  cases.push(missingState);
  for (const [index, xml] of cases.entries()) {
    assert.deepEqual(capture(() => parseTrackCoinResources(xml, xmlReader)),
      capture(() => originalParse(xml)), `XML case ${index}`);
  }
});

test("unique canonical coin asset selection matches release", () => {
  const entry = { absenceAuthoritative: true, bytes: async () => validXml() };
  for (const candidates of [[], [entry], [entry, entry], [{ ...entry, absenceAuthoritative: false }]]) {
    const archive: CoinArchive<TestXmlNode> = { exactCanonicalCandidates: () => candidates };
    assert.deepEqual(capture(() => uniqueOriginalCoinAsset(archive, "item/lucci/item.bml")),
      capture(() => originalUnique(archive, "item/lucci/item.bml")));
  }
});

test("track coin enumeration and resource loading match release", async () => {
  const track: CoinTrackData = {
    root: { kind: "track", trackObjects: [
      { kind: "Other", name: "skip", transform: { position: [4, 5, 6] } },
      { kind: "ToLucci", name: "first", instanceOrdinal: 0, transform: { position: [1, 2, 3] } },
      { kind: "ToLucci", name: "second", instanceOrdinal: 7, transform: { position: [-4, 5.5, 6] } },
    ] },
  };
  const cases: CoinTrackData[] = [track,
    { root: { kind: "other", trackObjects: track.root.trackObjects } },
    { root: { kind: "track", trackObjects: [
      { kind: "ToLucci", name: "none", transform: { position: [1, 2, 3] } },
    ] } },
    { root: { kind: "track", trackObjects: [
      track.root.trackObjects[1]!, { ...track.root.trackObjects[1]!, name: "duplicate" },
    ] } },
    { root: { kind: "track", trackObjects: [
      { kind: "ToLucci", name: "bad", instanceOrdinal: 9, transform: { position: [1, NaN, 3] } },
    ] } },
  ];
  async function result(action: () => Promise<unknown>): Promise<unknown> {
    try { return { value: await action() }; }
    catch (error) { return { error: (error as Error).message }; }
  }
  for (const [index, data] of cases.entries()) {
    const entry = { absenceAuthoritative: true, bytes: async () => validXml() };
    const archive: CoinArchive<TestXmlNode> = { exactCanonicalCandidates: () => [entry] };
    assert.deepEqual(await result(() => loadTrackCoinSource(archive, data, bytes => parseTrackCoinResources(bytes, xmlReader))),
      await result(() => originalLoad(archive, data)), `track case ${index}`);
  }
});
