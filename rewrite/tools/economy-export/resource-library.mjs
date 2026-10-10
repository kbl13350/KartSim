// Builds the browser's resource library (`Sw` from src/generated/library.js) in
// Node, over the containers on disk. It follows the browser's startup path
// (manifest -> archive index -> one lazy source per manifest file ->
// Sw.load(sources, undefined, indexes)), so catalog queries such as
// timeAttackGarageCatalog() run the same TypeScript code as the browser.
//
// Must be imported from a process started with `--import tsx`, because the
// generated modules import TypeScript sources.
import { closeSync, createReadStream, openSync, readFileSync, readSync, statSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pathToFileURL } from "node:url";

/** UTF-16LE bytes with BOM, the encoding parseResourceXml requires. */
export function utf16Bytes(text) {
  return new Uint8Array(Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, "utf16le")]));
}

/**
 * XML attribute-value normalization (XML 1.0 3.3.3), which parseResourceXml
 * skips: a literal tab, line feed, carriage return or CR LF pair inside a
 * quoted attribute value becomes one space. Character references such as
 * &#xD;&#xA; are untouched, so they still decode to real line breaks. This
 * is what the browser's DOMParser returns, e.g. for the item.kml description
 * of 11:30010, whose "&#xD;&#xA;" is followed by two literal tabs.
 */
export function normalizeAttributeWhitespace(text) {
  let out = "";
  let position = 0;
  const copyThrough = (start, terminator) => {
    const end = text.indexOf(terminator, start);
    const stop = end < 0 ? text.length : end + terminator.length;
    out += text.slice(position, stop);
    position = stop;
  };
  while (position < text.length) {
    const open = text.indexOf("<", position);
    if (open < 0) { out += text.slice(position); break; }
    out += text.slice(position, open);
    position = open;
    if (text.startsWith("<!--", open)) { copyThrough(open + 4, "-->"); continue; }
    if (text.startsWith("<![CDATA[", open)) { copyThrough(open + 9, "]]>"); continue; }
    if (text.startsWith("<?", open)) { copyThrough(open + 2, "?>"); continue; }
    if (text.startsWith("<!", open)) { copyThrough(open + 2, ">"); continue; }
    let quote;
    for (; position < text.length; position++) {
      const ch = text[position];
      if (quote !== undefined && (ch === "\t" || ch === "\n" || ch === "\r")) {
        if (ch === "\r" && text[position + 1] === "\n") position++;
        out += " ";
        continue;
      }
      out += ch;
      if (quote !== undefined) { if (ch === quote) quote = undefined; }
      else if (ch === "'" || ch === '"') quote = ch;
      else if (ch === ">") { position++; break; }
    }
  }
  return out;
}

/**
 * parseResourceXml over UTF-16LE (BOM) resource bytes, after attribute-value
 * normalization. Bytes without a UTF-16LE BOM are passed through untouched,
 * so the parser reports them exactly as before.
 */
export function parseNormalizedXml(parseResourceXml, data) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (bytes.length < 2 || bytes[0] !== 0xff || bytes[1] !== 0xfe) return parseResourceXml(data);
  const text = new TextDecoder("utf-16le", { fatal: true, ignoreBOM: true }).decode(bytes.subarray(2));
  return parseResourceXml(utf16Bytes(normalizeAttributeWhitespace(text)));
}

/**
 * The browser's parseShopXml (`Zu`) calls DOMParser, which Node lacks. This
 * shim exposes the two members Zu and garage-catalog.ts use
 * (querySelector("parsererror") and getElementsByTagName(...).getAttribute),
 * backed by the rewrite's strict resource XML parser plus the attribute-value
 * normalization DOMParser applies. A malformed document throws here, where
 * the browser would report a parsererror and throw too.
 */
export function installDomParserShim(parseResourceXml) {
  if (globalThis.DOMParser) return;
  globalThis.DOMParser = class ResourceXmlDomParser {
    parseFromString(raw) {
      const text = normalizeAttributeWhitespace(raw);
      const source = /^\s*<\?xml/.test(text)
        ? text.replace(/^\s*<\?xml[^>]*\?>/, '<?xml version="1.0" encoding="UTF-16"?>')
        : `<?xml version="1.0" encoding="UTF-16"?>${text}`;
      const { root } = parseResourceXml(utf16Bytes(source));
      const nodes = [];
      const walk = node => { nodes.push(node); node.children.forEach(walk); };
      walk(root);
      const element = node => ({
        tagName: node.name,
        getAttribute: name => node.attributes.find(item => item.name === name)?.value ?? null,
      });
      return {
        querySelector: () => null,
        getElementsByTagName: tag => nodes.filter(node => tag === "*" || node.name === tag).map(element),
      };
    }
  };
}

/** A lazy Blob-like ArchiveSource that reads byte ranges from one file. */
function diskSource(file, name, size) {
  const read = (start, end) => {
    const from = Math.max(0, Math.min(start, size));
    const to = Math.max(from, Math.min(end, size));
    const buffer = Buffer.alloc(to - from);
    const fd = openSync(file, "r");
    try {
      let offset = 0;
      while (offset < buffer.length) {
        const count = readSync(fd, buffer, offset, buffer.length - offset, from + offset);
        if (count <= 0) throw new Error(`${name}: short read at ${from + offset}`);
        offset += count;
      }
    } finally {
      closeSync(fd);
    }
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.length);
  };
  return {
    name,
    size,
    arrayBuffer: async () => read(0, size),
    slice: (start = 0, end = size) => ({ arrayBuffer: async () => read(start, end) }),
  };
}

/**
 * Load the p3553 resource library from `<projectRoot>/mirror`.
 * Returns { library, formats, xml } where formats holds generated helpers
 * (s2 = parseBml, T = attribute) and xml.parseResourceXml is the TS parser.
 */
// mirrorRoot is the checkout whose mirror/ holds the archives (default
// projectRoot), for a worktree checked out without mirror/p3553.
export async function loadResourceLibrary(projectRoot, version = "p3553", mirrorRoot = projectRoot) {
  globalThis.document ??= {
    createElement: () => ({ relList: { supports: () => true }, getContext: () => null, style: {} }),
  };
  const rewrite = path.join(projectRoot, "rewrite/src");
  const load = relative => import(pathToFileURL(path.join(rewrite, relative)).href);
  const [{ Sw }, formats, { parseResourceManifest }, { decodeArchiveIndex }, xml] = await Promise.all([
    load("generated/library.js"),
    load("generated/formats.js"),
    load("resources/manifest.ts"),
    load("resources/archive-index.ts"),
    load("resources/xml-utf16-parser.ts"),
  ]);
  installDomParserShim(xml.parseResourceXml);

  const mirror = path.join(mirrorRoot, "mirror");
  const manifest = parseResourceManifest(
    JSON.parse(readFileSync(path.join(mirror, `__${version}/resources`), "utf8")), version);
  const indexes = await decodeArchiveIndex(
    Readable.toWeb(createReadStream(path.join(mirror, `__${version}/archive-index`))), manifest);
  const sources = manifest.files.map(entry => {
    const file = path.join(mirror, version, entry.name);
    const actual = statSync(file).size;
    // A Git LFS pointer or truncated download would silently hide assets.
    if (actual !== entry.size)
      throw new Error(`${entry.name}: size ${actual} on disk, manifest says ${entry.size} (LFS pointer?)`);
    return diskSource(file, entry.name, entry.size);
  });
  const library = await Sw.load(sources, undefined, indexes);
  if (library.errors.length > 0)
    throw new Error(`resource library errors: ${library.errors.slice(0, 5).join("; ")}`);
  return { library, formats, xml, manifest };
}

/** Read one unique canonical resource as bytes; throws when absent or ambiguous. */
export async function uniqueBytes(library, canonicalPath) {
  const candidates = library.exactCanonicalCandidates(canonicalPath);
  if (candidates.length !== 1)
    throw new Error(`${canonicalPath}: expected exactly 1 resource, found ${candidates.length}`);
  return candidates[0].bytes();
}
