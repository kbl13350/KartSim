import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { layoutSpriteFont, layoutSpriteFontInto,
  spriteFontLayoutForPanel, type SpriteFontLayout,
  type SpriteFontGlyph, type SpriteFontNode, type SpriteFontLayoutOps,
} from "./font-glyph-layout";

const require = createRequire(import.meta.url);
const { parse } = require("@babel/parser") as typeof import("@babel/parser");
const releaseFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  "../../../recovered/formatted/index.js");

async function releaseGlyphLayout() {
  const source = await readFile(releaseFile, "utf8");
  const names = new Set(["pa", "$B", "eM", "ga", "tM", "Wp", "Yj", "A8"]);
  const declarations = parse(source, { sourceType: "module" }).program.body
    .filter(node => node.type === "FunctionDeclaration" &&
      names.has(node.id!.name))
    .map(node => source.slice(node.start!, node.end!)).join("\n");
  const attributes = (node: SpriteFontNode, name: string) =>
    node.attributes.find(attribute => attribute.name === name)?.value;
  const rectangle: SpriteFontLayoutOps["rectangle"] = (_node, textures) => {
    const texture = textures?.values().next().value;
    return { width: texture?.width ?? 10, height: texture?.height ?? 10 };
  };
  const parseNumbers: SpriteFontLayoutOps["parseNumbers"] = (value, count,
    name) => {
    const parts = value.trim().split(/\s+/);
    if (parts.length !== count) throw new Error(`${name} count`);
    return parts.map(Number);
  };
  const ops = { attribute: attributes, rectangle, parseNumbers };
  const original = new Function("T", "lt", "j2", `const Jb = new WeakMap();
    ${declarations}\nreturn { pa, $B, ga };`)(attributes, rectangle,
      parseNumbers) as {
    pa: typeof layoutSpriteFont;
    $B: typeof layoutSpriteFontInto;
    ga: (node: SpriteFontNode, texture: { width: number; height: number }) =>
      SpriteFontLayout;
  };
  return { ...original, ops };
}

const layout: SpriteFontLayout = {
  left: -1.25, top: 2.125, right: 16.75,
  fontWidth: 2.25, fontHeight: 3.5,
  fontX: 1.25, fontY: 2.5,
  fontCharacters: "AB|C你DBA", spaceOffset: -0.125,
  centerAlign: false, rightAlign: false, rowWidth: 6,
  textureWidth: 32, textureHeight: 64,
};

test("字符面板字形位置、图集换行和 32 位舍入与发行版一致", async () => {
  const old = await releaseGlyphLayout();
  const texts = ["", "A", "AB C", "C你DA", " A?你 ", "||||", "D", "ABA"];
  for (const centerAlign of [false, true])
    for (const rightAlign of [false, true])
      for (const rowWidth of [4, 6, 20])
        for (const text of texts) {
          const settings = { ...layout, centerAlign, rightAlign, rowWidth };
          assert.deepEqual(layoutSpriteFont(settings, text), old.pa(settings, text),
            `${text}/${centerAlign}/${rightAlign}/${rowWidth}`);
        }
});

test("重复布局复用字形对象，并截断旧字形", async () => {
  const old = await releaseGlyphLayout();
  const current: SpriteFontGlyph[] = [];
  const expected: SpriteFontGlyph[] = [];
  for (const text of ["C你DA", "A", "", "AB C", "D"]) {
    const previous = current[0];
    layoutSpriteFontInto(layout, text, current);
    old.$B(layout, text, expected);
    assert.deepEqual(current, expected, text);
    if (previous && current[0]) assert.equal(current[0], previous);
  }
});

test("字符面板属性、默认值、布尔校验与纹理尺寸缓存和发行版一致", async () => {
  const old = await releaseGlyphLayout();
  const fixture = (attributes: Array<[string, string]>, name = "CharPanel") =>
    ({ name, attributes: attributes.map(([key, value]) =>
      ({ name: key, value })) });
  const configurations: Array<Array<[string, string]>> = [
    [["texture", "font.png"], ["fontSize", "3 4"],
      ["fontStr", "AB|CD"], ["fontPos", "1 2"]],
    [["texture", "font.png"], ["fontSize", "3 4"],
      ["fontStr", "AB|CD"], ["flexible", "true"],
      ["spaceOffset", "-0.25"], ["centerAlign", "true"],
      ["rightAlign", "true"], ["allowVertical", "true"]],
    [["fontSize", "3 4"], ["fontStr", "A"]],
    [["fontSize", "3 4"], ["fontStr", "A"], ["flexible", "yes"]],
    [["fontSize", "3 4"]],
  ];
  for (const attributes of configurations) {
    const currentNode = fixture(attributes);
    const oldNode = fixture(attributes);
    for (const texture of [{ width: 32, height: 64 },
      { width: 32, height: 64 }, { width: 48, height: 64 }]) {
      let expected: SpriteFontLayout | undefined;
      let expectedError: string | undefined;
      try { expected = old.ga(oldNode, texture); }
      catch (error) { expectedError = (error as Error).message; }
      if (expectedError) {
        assert.throws(() => spriteFontLayoutForPanel(currentNode, texture,
          old.ops), { message: expectedError });
      } else {
        const actual = spriteFontLayoutForPanel(currentNode, texture, old.ops);
        assert.deepEqual(actual, expected);
      }
    }
  }
  const bad = fixture([["fontSize", "3 4"], ["fontStr", "A"]], "Panel");
  assert.throws(() => spriteFontLayoutForPanel(bad,
    { width: 1, height: 1 }, old.ops), { message: "Panel 不是 P3528 CharPanel。" });
});
