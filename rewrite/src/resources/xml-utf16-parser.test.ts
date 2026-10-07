import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { parseResourceXml } from "./xml-utf16-parser";

const releaseFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  "../../../recovered/formatted/index.js");

async function originalParser() {
  const source = await readFile(releaseFile, "utf8");
  const first = source.indexOf("function x1(");
  const last = source.indexOf("\nconst Kb =", first);
  assert.ok(first >= 0 && last > first);
  return new Function(`${source.slice(first, last)}\nreturn x1;`)() as typeof parseResourceXml;
}

function utf16(xml: string): Uint8Array {
  return Uint8Array.from([255, 254, ...Buffer.from(xml, "utf16le")]);
}

test("资源 XML 的声明、属性、嵌套、注释及实体与发行版一致", async () => {
  const original = await originalParser();
  const documents = [
    '<?xml version="1.0" encoding="UTF-16"?><root/>',
    '<?xml version="1.0" encoding="UTF-16"?><!--intro--><root a="A&amp;B" b=\'&#x1f600;\'>one<child x="&lt;"/>two<!--skip--><last/>three</root><!--end-->',
    '<?xml encoding="utf-16" version="1.0"?><_R2 n="&#65; &#x42; &quot;&apos;&gt;"/>',
    '<?xml version="1.0" encoding="UTF-16"?><root>  a  <child/>  b  </root>',
  ];
  for (const document of documents) {
    const bytes = utf16(document);
    assert.deepEqual(parseResourceXml(bytes), original(bytes));
  }
});

test("资源 XML 的非法编码、标签、属性及实体保留发行版错误", async () => {
  const original = await originalParser();
  const documents = [
    Uint8Array.from([0, 0]),
    utf16('<root/>'),
    utf16('<?xml version="1.0" encoding="UTF-8"?><root/>'),
    utf16('<?xml version="1.0" encoding="UTF-16"?><root a="1" a="2"/>'),
    utf16('<?xml version="1.0" encoding="UTF-16"?><root a=x/>'),
    utf16('<?xml version="1.0" encoding="UTF-16"?><root>&bogus;</root>'),
    utf16('<?xml version="1.0" encoding="UTF-16"?><root>&#xD800;</root>'),
    utf16('<?xml version="1.0" encoding="UTF-16"?><root></wrong>'),
    utf16('<?xml version="1.0" encoding="UTF-16"?><root/> extra'),
    Uint8Array.from([255, 254, 0, 216]),
  ];
  const capture = (parser: typeof parseResourceXml, bytes: Uint8Array) => {
    try { return parser(bytes); }
    catch (error) { return String(error); }
  };
  for (const bytes of documents)
    assert.deepEqual(capture(parseResourceXml, bytes), capture(original, bytes));
});
