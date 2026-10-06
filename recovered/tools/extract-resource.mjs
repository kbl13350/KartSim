#!/usr/bin/env node
// Selective extractor for the local p3553 archive index and its .rho/.rho5 files.
// Uses only Node built-ins. The index and decoding rules came from the mirrored
// game's browser bundle; no data is fetched from the network.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const mirror = path.join(root, 'mirror');
const indexPath = path.join(mirror, '__p3553', 'archive-index');
const outputRoot = path.join(root, 'recovered', 'data');
const fullOutputRoot = path.join(root, 'recovered', 'data-full');
const regionSecrets = { KR: 'y&errfV6GRS!e8JL', CN: 'd$Bjgfc8@dH4TQ?k', TW: 't5rHKg-g9BA7%=qD' };

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function loadIndex() {
  const index = JSON.parse(zlib.inflateSync(fs.readFileSync(indexPath)));
  assert(index.version === 'p3553', `Unexpected archive version: ${index.version}`);
  return index;
}

function readRange(file, offset, length, expectedSize) {
  assert(Number.isSafeInteger(offset) && Number.isSafeInteger(length) && offset >= 0 && length >= 0,
    `Invalid range in ${file}`);
  const size = fs.statSync(file).size;
  if (expectedSize !== undefined) assert(size === expectedSize, `Container size changed: ${file}`);
  assert(offset + length <= size, `Out-of-bounds range in ${file}`);
  const fd = fs.openSync(file, 'r');
  try {
    const result = Buffer.alloc(length);
    let position = 0;
    while (position < length) {
      const count = fs.readSync(fd, result, position, length - position, offset + position);
      assert(count > 0, `Short read in ${file}`);
      position += count;
    }
    return result;
  } finally {
    fs.closeSync(fd);
  }
}

function adler32(bytes) {
  let a = 0, b = 0;
  for (const value of bytes) {
    a = (a + value) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function rhoXor(bytes, key) {
  const mask = Buffer.alloc(64);
  let word = (key ^ 2222193601) >>> 0;
  for (let offset = 0; offset < 64; offset += 4) {
    mask.writeUInt32LE(word, offset);
    word = (word - 2072773695) >>> 0;
  }
  return Buffer.from(bytes.map((byte, index) => byte ^ mask[index % mask.length]));
}

function extractRho(archive, entry) {
  const source = path.join(mirror, 'p3553', archive.name);
  const blocks = new Map(archive.blocks.map(block => [block.index, block]));
  const block = blocks.get(entry.dataIndex);
  assert(block, `Missing Rho data block for ${entry.path}`);

  function decode(blockToRead, key) {
    let bytes = readRange(source, blockToRead.offset, blockToRead.storedSize, archive.mediaSize);
    const flags = blockToRead.processingFlags;
    assert((flags & ~15) === 0 && (flags & 8) === 0, `Unsupported Rho block flags: ${flags}`);
    if (flags & 2) bytes = zlib.inflateSync(bytes);
    if (flags & 4) bytes = rhoXor(bytes, key);
    assert(bytes.length === blockToRead.logicalSize, `Rho block length mismatch: ${entry.path}`);
    if (flags & 1) assert(adler32(bytes) === blockToRead.checksum, `Rho Adler-32 mismatch: ${entry.path}`);
    return bytes;
  }

  let bytes;
  if (block.processingFlags === 4) {
    bytes = rhoXor(readRange(source, block.offset, block.storedSize, archive.mediaSize), entry.dataKey);
    if (entry.size > bytes.length) {
      const next = blocks.get((entry.dataIndex + 1) >>> 0);
      assert(next && next.processingFlags === 0, `Missing Rho continuation: ${entry.path}`);
      bytes = Buffer.concat([bytes, readRange(source, next.offset, next.storedSize, archive.mediaSize)]);
    }
  } else {
    bytes = decode(block, entry.dataKey);
  }
  assert(bytes.length === entry.size, `Rho file length mismatch: ${entry.path}`);
  return bytes;
}

const u32 = value => value >>> 0;
const add32 = (a, b) => (a + b) >>> 0;
const rotRight = (value, shift) => (value >>> shift | value << (32 - shift)) >>> 0;
const rotByte = (value, shift) => (value << shift | value >>> (8 - shift)) & 255;
const gfDouble = (value, reduction) => ((value << 1 & 255) ^ (value & 128 ? reduction : 0)) & 255;

function gfMultiply(a, b) {
  let out = 0;
  for (let bit = 0; bit < 8; bit++) {
    if (b & 1) out ^= a;
    a = gfDouble(a, 27);
    b >>>= 1;
  }
  return out & 255;
}

function gfPower(value, exponent) {
  let out = 1;
  while (exponent > 0) {
    if (exponent & 1) out = gfMultiply(out, value);
    value = gfMultiply(value, value);
    exponent >>>= 1;
  }
  return out;
}

function sBox(value) {
  const inverse = value === 0 ? 0 : gfPower(value, 254);
  return (inverse ^ rotByte(inverse, 1) ^ rotByte(inverse, 2) ^
    rotByte(inverse, 3) ^ rotByte(inverse, 4) ^ 99) & 255;
}

function gfIterate(value, steps) {
  for (let n = 0; n < steps; n++) value = gfDouble(value, 169);
  return value;
}

let tables;
function cipherTables() {
  if (tables) return tables;
  tables = Array.from({ length: 6 }, () => new Uint32Array(256));
  for (let byte = 0; byte < 256; byte++) {
    const transformed = sBox(byte);
    const doubled = gfDouble(transformed, 27);
    const word = ((doubled << 24) | ((doubled ^ transformed) << 16) |
      (transformed << 8) | transformed) >>> 0;
    tables[0][byte] = word;
    tables[1][byte] = rotRight(word, 8);
    tables[2][byte] = rotRight(word, 16);
    tables[3][byte] = rotRight(word, 24);
    tables[4][byte] = ((gfIterate(byte, 16) << 24) | (gfIterate(byte, 39) << 16) |
      (gfIterate(byte, 6) << 8) | gfIterate(byte, 64)) >>> 0;
    tables[5][byte] = ((gfIterate(byte, 23) << 24) | (gfIterate(byte, 245) << 16) |
      (gfIterate(byte, 48) << 8) | gfIterate(byte, 239)) >>> 0;
  }
  return tables;
}

function cipherC(word) {
  const t = cipherTables();
  return (t[0][word >>> 24] ^ t[1][word >>> 16 & 255] ^
    t[2][word >>> 8 & 255] ^ t[3][word & 255]) >>> 0;
}
function cipherL(word) { return (word << 8 ^ cipherTables()[5][word >>> 24]) >>> 0; }
function cipherU(word) { return (word >>> 8 ^ cipherTables()[4][word & 255]) >>> 0; }

// The original stream cipher reads four key bytes as signed bytes before OR-ing.
function signedBigEndianWord(key, offset) {
  let word = 0;
  for (let n = 0; n < 4; n++) {
    const signed = key[offset + n] << 24 >> 24;
    word = (word << 8 | signed) >>> 0;
  }
  return word;
}

class Rho5Stream {
  constructor(key) {
    assert(key.length >= 16, 'Rho5 key too short');
    this.state = new Uint32Array(16);
    this.r1 = 0;
    this.r2 = 0;
    for (let n = 0; n < 4; n++) {
      const word = signedBigEndianWord(key, n * 4);
      this.state[15 - n] = word;
      this.state[11 - n] = ~word >>> 0;
      this.state[7 - n] = word;
      this.state[3 - n] = ~word >>> 0;
    }
    for (let n = 0; n < 32; n++) this.clock(true);
  }

  clock(warming) {
    const feedback = warming ? (add32(this.r1, this.state[15]) ^ this.r2) >>> 0 : 0;
    const next = (cipherL(this.state[0]) ^ this.state[2] ^
      cipherU(this.state[11]) ^ feedback) >>> 0;
    const r1 = add32(this.r2, this.state[5]);
    const r2 = cipherC(this.r1);
    this.state.copyWithin(0, 1);
    this.state[15] = next;
    this.r1 = r1;
    this.r2 = r2;
    return (add32(r1, next) ^ r2 ^ this.state[0]) >>> 0;
  }
}

function rho5Decipher(bytes, key) {
  const cipher = new Rho5Stream(key);
  const out = Buffer.alloc(bytes.length);
  for (let offset = 0; offset < bytes.length; offset += 4) {
    let word = 0;
    const count = Math.min(4, bytes.length - offset);
    for (let n = 0; n < count; n++) word = (word | bytes[offset + n] << (n * 8)) >>> 0;
    word = (word - cipher.clock(false)) >>> 0;
    for (let n = 0; n < count; n++) out[offset + n] = word >>> (n * 8) & 255;
  }
  return out;
}

function fnv1a(text) {
  let hash = 2166136261;
  for (const char of text) hash = Math.imul((hash ^ char.charCodeAt(0)) >>> 0, 16777619) >>> 0;
  return hash;
}

function rho5PayloadKey(md5, secret, resourcePath) {
  assert(md5.length === 16 && resourcePath.length > 0, 'Invalid Rho5 key inputs');
  const digits = [...String(fnv1a(secret))].map(char => char.charCodeAt(0) - 48);
  const key = Buffer.alloc(128);
  for (let index = 0; index < key.length; index++) {
    const first = digits[index % digits.length] & 1;
    const second = digits[(index + 1) % digits.length];
    const md5Index = (digits[(index + 2) % digits.length] + index) & 15;
    const value = (((second + index) % 5) + md5[md5Index] + first) & 255;
    const pathByte = resourcePath.charCodeAt(index % resourcePath.length) & 255;
    key[index] = (Math.imul(value, pathByte) + index) & 255;
  }
  return key;
}

function extractRho5(archive, entry) {
  const part = archive.parts.find(item => item.id === entry.partId);
  assert(part, `Missing Rho5 part for ${entry.path}`);
  const source = path.join(mirror, 'p3553', part.name);
  const md5 = Buffer.from(entry.payloadMd5.$u8, 'base64');
  const secret = regionSecrets[archive.region];
  assert(secret, `Unknown Rho5 region: ${archive.region}`);
  const key = rho5PayloadKey(md5, secret, entry.path);
  let bytes = readRange(source, entry.payloadStart, entry.compressedSize, part.size);
  const flags = entry.pipelineFlags;
  assert((flags & ~7) === 0, `Unsupported Rho5 pipeline: ${flags}`);
  if (flags & 4) {
    const headSize = Math.min(1024, bytes.length);
    bytes = Buffer.concat([rho5Decipher(bytes.subarray(0, headSize), key), bytes.subarray(headSize)]);
  }
  if (flags & 2) bytes = rho5Decipher(bytes, key);
  if (flags & 1) bytes = zlib.inflateSync(bytes);
  assert(bytes.length === entry.decompressedSize, `Rho5 length mismatch: ${entry.path}`);
  assert(crypto.createHash('md5').update(bytes).digest().equals(md5), `Rho5 MD5 mismatch: ${entry.path}`);
  return bytes;
}

function decodeText(bytes) {
  let text;
  if (bytes[0] === 255 && bytes[1] === 254) text = new TextDecoder('utf-16le', { fatal: true }).decode(bytes.subarray(2));
  else if (bytes[0] === 254 && bytes[1] === 255) text = new TextDecoder('utf-16be', { fatal: true }).decode(bytes.subarray(2));
  else text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  // Exported files are UTF-8, so the declaration must match the output bytes.
  return text.replace(/^\s+(?=<\?xml)/i, '')
    .replace(/^(\s*<\?xml[^>]*\bencoding\s*=\s*['"])[^'"]+(['"][^>]*\?>)/i, '$1UTF-8$2');
}

// BML is the game's binary XML: UTF-16LE length-prefixed strings in a tree.
function decodeBml(bytes) {
  let offset = 0, nodes = 0, attributes = 0;
  function uint32() {
    assert(offset + 4 <= bytes.length, 'BML ended inside an integer');
    const value = bytes.readUInt32LE(offset);
    offset += 4;
    return value;
  }
  function string() {
    const characters = uint32();
    assert(characters <= 1_000_000, 'BML string too long');
    const length = characters * 2;
    assert(offset + length <= bytes.length, 'BML ended inside a string');
    const value = new TextDecoder('utf-16le', { fatal: true }).decode(bytes.subarray(offset, offset + length));
    offset += length;
    return value;
  }
  function node(depth) {
    assert(depth <= 128 && ++nodes <= 1_000_000, 'BML tree too deep or too large');
    const name = string(), text = string();
    const attributeCount = uint32();
    assert(attributeCount <= 100_000 && (attributes += attributeCount) <= 10_000_000, 'Too many BML attributes');
    const attrs = [];
    for (let n = 0; n < attributeCount; n++) attrs.push([string(), string()]);
    const childCount = uint32();
    assert(childCount <= 1_000_000, 'Too many BML children');
    const children = [];
    for (let n = 0; n < childCount; n++) children.push(node(depth + 1));
    return { name, text, attrs, children };
  }
  const tree = node(0);
  assert(offset === bytes.length, 'BML has trailing bytes');
  const escapeText = value => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const escapeAttribute = value => escapeText(value).replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  function serialize(current, depth) {
    assert(/^[\p{L}_:][\p{L}\p{N}_.:-]*$/u.test(current.name), `Invalid BML XML name: ${current.name}`);
    const pad = '  '.repeat(depth);
    const attrs = current.attrs.map(([name, value]) => {
      assert(/^[\p{L}_:][\p{L}\p{N}_.:-]*$/u.test(name), `Invalid BML attribute name: ${name}`);
      return ` ${name}="${escapeAttribute(value)}"`;
    }).join('');
    if (!current.children.length && !current.text) return `${pad}<${current.name}${attrs}/>`;
    if (!current.children.length) return `${pad}<${current.name}${attrs}>${escapeText(current.text)}</${current.name}>`;
    const childXml = current.children.map(child => serialize(child, depth + 1)).join('\n');
    const textXml = current.text ? escapeText(current.text) : '';
    return `${pad}<${current.name}${attrs}>${textXml}\n${childXml}\n${pad}</${current.name}>`;
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n${serialize(tree, 0)}\n`;
}

function safeOutputPath(container, resourcePath, raw = false, base = outputRoot) {
  assert(/^[\w.-]+$/.test(container), `Unsafe container: ${container}`);
  assert(resourcePath && !resourcePath.startsWith('/') && !resourcePath.includes('\\') &&
    resourcePath.split('/').every(part => part && part !== '.' && part !== '..'),
    `Unsafe resource path: ${resourcePath}`);
  const destination = path.resolve(base, ...(raw ? ['_raw'] : []), container, resourcePath);
  assert(destination.startsWith(base + path.sep), `Output escapes data directory: ${destination}`);
  return destination;
}

function exportedText(bytes, resourcePath) {
  const text = resourcePath.toLowerCase().endsWith('.bml') ? decodeBml(bytes) : decodeText(bytes);
  assert(!text.includes('\u0000'), `Decoded text contains NUL: ${resourcePath}`);
  return Buffer.from(text, 'utf8');
}

function writeIfMatching(destination, bytes) {
  if (fs.existsSync(destination)) {
    assert(fs.readFileSync(destination).equals(bytes), `Existing file differs: ${destination}`);
    return 'verified';
  }
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, bytes, { flag: 'wx' });
  return 'extracted';
}

function extractAllText(index) {
  const records = [];
  for (const [type, archives] of [['rho', index.rho], ['rho5', index.rho5]]) {
    for (const archive of archives) {
      for (const entry of archive.files) {
        if (!/\.(?:xml|bml)$/i.test(entry.path)) continue;
        records.push({ type, archive, entry, exportedPath: entry.path + (/\.bml$/i.test(entry.path) ? '.xml' : '') });
      }
    }
  }
  const canonical = relative => relative.normalize('NFD').toLowerCase();
  const outputCounts = new Map();
  for (const record of records) {
    const key = canonical(`${record.archive.name}/${record.exportedPath}`);
    outputCounts.set(key, (outputCounts.get(key) ?? 0) + 1);
  }
  const used = new Set();
  const collisions = [];
  let extracted = 0, verified = 0, failed = 0, decodedBytes = 0, exportedBytes = 0;
  const failures = [];
  for (const record of records) {
    const { type, archive, entry } = record;
    const spec = `${archive.name}:${entry.path}`;
    try {
      let relative = record.exportedPath;
      const originalKey = canonical(`${archive.name}/${relative}`);
      if ((outputCounts.get(originalKey) ?? 0) > 1 || used.has(originalKey)) {
        const hash = crypto.createHash('sha256').update(spec).digest('hex');
        const dot = relative.lastIndexOf('.');
        const start = dot < 0 ? relative : relative.slice(0, dot);
        const end = dot < 0 ? '' : relative.slice(dot);
        let length = 12;
        do {
          relative = `${start}~${hash.slice(0, length)}${end}`;
          length += 4;
          assert(length <= 68, `Could not disambiguate path: ${spec}`);
        } while (used.has(canonical(`${archive.name}/${relative}`)));
        collisions.push({ source: spec, exportedPath: `${archive.name}/${relative}` });
      }
      const destination = safeOutputPath(archive.name, relative, false, fullOutputRoot);
      const bytes = type === 'rho' ? extractRho(archive, entry) : extractRho5(archive, entry);
      const exported = exportedText(bytes, entry.path);
      const action = writeIfMatching(destination, exported);
      used.add(canonical(`${archive.name}/${relative}`));
      if (action === 'extracted') extracted++; else verified++;
      decodedBytes += bytes.length;
      exportedBytes += exported.length;
    } catch (error) {
      failed++;
      failures.push({ source: spec, error: String(error?.message ?? error) });
    }
    const done = extracted + verified + failed;
    if (done % 1000 === 0 || done === records.length) {
      console.error(`${done}/${records.length}: extracted=${extracted}, verified=${verified}, failed=${failed}`);
    }
  }
  const report = {
    archiveVersion: index.version,
    archiveRevision: index.revision,
    selected: records.length,
    extracted,
    verified,
    failed,
    decodedBytes,
    exportedBytes,
    collisions,
    failures,
  };
  fs.mkdirSync(fullOutputRoot, { recursive: true });
  fs.writeFileSync(path.join(fullOutputRoot, '_report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  if (failed) process.exitCode = 1;
}

function locate(index, container, resourcePath) {
  const rho = index.rho.find(item => item.name === container);
  const rho5 = index.rho5.find(item => item.name === container);
  const archive = rho ?? rho5;
  assert(archive, `Unknown container: ${container}`);
  const entry = archive.files.find(item => item.path === resourcePath);
  assert(entry, `No entry ${resourcePath} in ${container}`);
  return { archive, entry, type: rho ? 'rho' : 'rho5' };
}

function usage() {
  console.log(`Usage:\n  node recovered/tools/extract-resource.mjs list [substring]\n  node recovered/tools/extract-resource.mjs extract CONTAINER:PATH [...]\n  node recovered/tools/extract-resource.mjs extract-raw CONTAINER:PATH [...]\n  node recovered/tools/extract-resource.mjs extract-all-text\n\nText is written as UTF-8 under recovered/data/CONTAINER/PATH; BML becomes .bml.xml. Raw bytes go under recovered/data/_raw/CONTAINER/PATH. Bulk text goes under recovered/data-full/.`);
}

const [command, ...arguments_] = process.argv.slice(2);
if (!command || command === '--help' || command === 'help') {
  usage();
} else {
  const index = loadIndex();
  if (command === 'list') {
    const needle = (arguments_[0] ?? '').toLowerCase();
    let count = 0;
    for (const archive of [...index.rho, ...index.rho5]) {
      for (const entry of archive.files) {
        if (entry.path.toLowerCase().includes(needle)) {
          console.log(`${archive.name}:${entry.path}`);
          count++;
        }
      }
    }
    console.error(`${count} matching entries`);
  } else if (command === 'extract-all-text') {
    assert(arguments_.length === 0, 'extract-all-text takes no arguments');
    extractAllText(index);
  } else if (command === 'extract' || command === 'extract-raw') {
    assert(arguments_.length > 0, 'Supply at least one CONTAINER:PATH');
    const raw = command === 'extract-raw';
    for (const spec of arguments_) {
      const separator = spec.indexOf(':');
      assert(separator > 0, `Invalid resource spec: ${spec}`);
      const container = spec.slice(0, separator);
      const resourcePath = spec.slice(separator + 1);
      const isBml = !raw && resourcePath.toLowerCase().endsWith('.bml');
      const destination = safeOutputPath(container, resourcePath + (isBml ? '.xml' : ''), raw);
      const { archive, entry, type } = locate(index, container, resourcePath);
      const bytes = type === 'rho' ? extractRho(archive, entry) : extractRho5(archive, entry);
      const normalized = raw ? bytes : exportedText(bytes, resourcePath);
      const action = writeIfMatching(destination, normalized);
      console.log(`${action} ${destination} (${bytes.length} decoded bytes)`);
    }
  } else {
    usage();
    process.exitCode = 2;
  }
}
