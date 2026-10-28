import fs from 'node:fs';
import path from 'node:path';
import { deflateSync, inflateSync } from 'node:zlib';
import { decodeBinaryXml } from '../../src/codecs/binary-xml.ts';
import { rhoAdler32 } from '../../src/codecs/common.ts';
import { rhoXor } from '../../src/codecs/mount-manifest.ts';
import { rhoSourceKey } from '../../src/codecs/rho-writer.ts';

/** Decode/encode only the KRData envelope; retain every existing mount node. */
export function decodeMountTree(input) {
  const length = input.readUInt32LE(0), payload = input.subarray(4, 4 + length);
  if (payload[0] !== 83) throw new Error('aaa.pk is not KRData');
  const mode = payload[1];
  let cursor = 6, cipherKey = 0, expectedSize = 0;
  if (mode & 2) { cipherKey = payload.readUInt32LE(cursor); cursor += 4; }
  if (mode & 1) { expectedSize = payload.readUInt32LE(cursor); cursor += 4; }
  let body = payload.subarray(cursor);
  if (mode & 2) body = rhoXor(body, cipherKey);
  if (mode & 1) body = inflateSync(body);
  if ((mode & 1) && body.length !== expectedSize) throw new Error('aaa.pk decoded size differs');
  if (rhoAdler32(body) !== payload.readUInt32LE(2)) throw new Error('aaa.pk checksum differs');
  return decodeBinaryXml(body);
}

function encodeBml(node) {
  const chunks = [];
  const uint = value => { const b = Buffer.alloc(4); b.writeUInt32LE(value); chunks.push(b); };
  const string = value => { const b = Buffer.from(value ?? '', 'utf16le'); uint(b.length / 2); chunks.push(b); };
  function visit(n) {
    string(n.name); string(n.text); uint(n.attributes.length);
    for (const a of n.attributes) { string(a.name); string(a.value); }
    uint(n.children.length); for (const child of n.children) visit(child);
  }
  visit(node);
  return Buffer.concat(chunks);
}

export function encodeMountTree(root) {
  const body = encodeBml(root), zipped = deflateSync(body, { level: 9 });
  const payload = Buffer.alloc(10 + zipped.length);
  payload[0] = 83; payload[1] = 1;
  payload.writeUInt32LE(rhoAdler32(body), 2); payload.writeUInt32LE(body.length, 6);
  zipped.copy(payload, 10);
  const result = Buffer.alloc(4 + payload.length);
  result.writeUInt32LE(payload.length); payload.copy(result, 4);
  return result;
}

const attr = (node, name) => node.attributes.find(a => a.name === name)?.value;
function folder(name, children = []) {
  return { name: 'PackFolder', text: '', attributes: [{ name: 'name', value: name }], children };
}

/** Each import archive receives one exact canonical mount, never a filename alias. */
export function installMounts(root, containers) {
  const owned = new Set(containers.map(c => c.name.toLowerCase()));
  root.children = root.children.filter(n => attr(n, 'taiwanImport') !== '1');
  function prune(node) {
    node.children = node.children.filter(child => child.name !== 'RhoFolder' || !owned.has((attr(child, 'fileName') ?? '').toLowerCase()));
    for (const child of node.children) prune(child);
  }
  prune(root);
  const groups = new Map();
  for (const c of containers) {
    const segments = c.mountPath.split('/');
    // PackFolder adds the trailing underscore to top-level logical roots.
    const top = segments.shift();
    const topName = top.endsWith('_') ? top.slice(0, -1) : top;
    let group = groups.get(topName);
    if (!group) { group = folder(topName); group.attributes.push({ name: 'taiwanImport', value: '1' }); groups.set(topName, group); }
    let parent = group;
    for (const segment of segments.slice(0, -1)) {
      let next = parent.children.find(n => n.name === 'PackFolder' && attr(n, 'name') === segment);
      if (!next) { next = folder(segment); parent.children.push(next); }
      parent = next;
    }
    const name = segments.at(-1) ?? '';
    parent.children.push({ name: 'RhoFolder', text: '', attributes: [
      { name: 'name', value: name }, { name: 'fileName', value: c.name },
      { name: 'key', value: String(rhoSourceKey(c.name)) }, { name: 'mediaSize', value: String(c.size) },
    ], children: [] });
  }
  // Reuse only empty duplicate wrapper folders left by an earlier import.
  root.children = root.children.filter(n => !(n.name === 'PackFolder' && n.children.length === 0 && groups.has(attr(n, 'name'))));
  root.children.push(...groups.values());
  return root;
}

export function writeChanged(file, bytes) {
  const data = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  if (fs.existsSync(file) && fs.readFileSync(file).equals(data)) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, data); fs.renameSync(temporary, file);
  return true;
}

export function textureStems(parsed) {
  const stems = new Set(), visited = new WeakSet();
  function visit(node) {
    if (!node || typeof node !== 'object' || ArrayBuffer.isView(node) || visited.has(node)) return;
    visited.add(node);
    if (node.kind === 'texture' && typeof node.name === 'string' && node.name) stems.add(node.name);
    if (Array.isArray(node)) {
      if (node.length && typeof node[0] === 'number') return;
      for (const child of node) visit(child);
    } else {
      for (const [key, value] of Object.entries(node)) {
        if (['positions','normals','uvs','indices','colors','weights','tangents','vertexData','rigidGeometry'].includes(key)) continue;
        visit(value);
      }
    }
  }
  visit(parsed.root ?? parsed);
  return [...stems].sort();
}
