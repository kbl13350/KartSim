import type { ArchiveSource } from "../resources/container-store";
import { attribute, decodeBinaryXml, type BinaryXmlNode } from "./binary-xml";
import { inflateZlib, joinPath, readExact, requireValue, rhoAdler32 } from "./common";

export interface ArchiveMount {
  readonly fileName: string;
  readonly mountPath: string;
  readonly key: number;
  readonly mediaSize?: number;
  readonly dataHash?: number;
}

export interface MountManifest {
  readonly mounts: readonly ArchiveMount[];
  readonly region: "cn" | "kr" | "tw" | "unknown";
}

function component(value: string, label: string): string {
  requireValue(value !== "." && value !== ".." && !/[\\/\0-\x1f]/.test(value),
    `aaa.pk 的${label}不安全：${value}。`);
  return value;
}

function readUInt32(bytes: Uint8Array, offset: number): number {
  requireValue(offset + 4 <= bytes.length, "aaa.pk 数据不完整。");
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, true);
}

function readInt32(bytes: Uint8Array, offset: number): number {
  requireValue(offset + 4 <= bytes.length, "aaa.pk 数据不完整。");
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getInt32(offset, true);
}

function rhoXor(bytes: Uint8Array, key: number): Uint8Array {
  const mask = new Uint8Array(64);
  const view = new DataView(mask.buffer);
  let word = (key ^ 2222193601) >>> 0;
  for (let offset = 0; offset < 64; offset += 4) {
    view.setUint32(offset, word, true);
    word = (word - 2072773695) >>> 0;
  }
  return bytes.map((value, index) => value ^ mask[index % mask.length]!);
}

export { rhoXor };

function mountsIn(node: BinaryXmlNode, prefix: string, depth: number, result: ArchiveMount[]): void {
  requireValue(depth <= 128, "aaa.pk 目录层级过深。");
  for (const child of node.children) {
    if (child.name === "PackFolder") {
      const name = component(attribute(child, "name") ?? "", "目录名");
      const segment = depth === 0 && name && !name.endsWith("_") ? `${name}_` : name;
      mountsIn(child, joinPath(prefix, segment), depth + 1, result);
      continue;
    }
    if (child.name !== "RhoFolder") continue;
    const fileName = component(attribute(child, "fileName") ?? "", "文件名");
    requireValue(fileName.length > 0 && !fileName.includes(":"), "aaa.pk 文件名无效。");
    const name = component(attribute(child, "name") ?? "", "档案名");
    const key = Number(attribute(child, "key") ?? "0");
    requireValue(Number.isInteger(key) && key >= 0 && key <= 0xffffffff,
      `${fileName} 的档案密钥无效。`);
    const mediaText = attribute(child, "mediaSize");
    const hashText = attribute(child, "dataHash");
    const mediaSize = mediaText === undefined ? undefined : Number(mediaText);
    const dataHash = hashText === undefined ? undefined : Number(hashText);
    if (mediaSize !== undefined) requireValue(Number.isSafeInteger(mediaSize) && mediaSize > 0,
      `${fileName} 的 mediaSize 无效。`);
    if (dataHash !== undefined) requireValue(Number.isInteger(dataHash) &&
      dataHash >= 0 && dataHash <= 0xffffffff, `${fileName} 的 dataHash 无效。`);
    result.push({ fileName, mountPath: name ? joinPath(prefix, name) : prefix,
      key: key >>> 0, mediaSize, dataHash });
  }
}

/** Parse aaa.pk into Rho mount paths. The index already carries Rho file tables. */
export async function readMountManifestDetails(source: ArchiveSource): Promise<MountManifest> {
  requireValue(source.size >= 8 && source.size <= 32 * 1024 * 1024,
    `${source.name} 的大小无效。`);
  const bytes = await readExact(source, 0, source.size);
  const length = readInt32(bytes, 0);
  requireValue(length >= 6 && length <= bytes.length - 4, "aaa.pk KRData 长度无效。");
  const payload = bytes.subarray(4, 4 + length);
  requireValue(payload[0] === 83, "aaa.pk KRData 标识无效。");
  const mode = payload[1]!;
  requireValue((mode & ~3) === 0, "aaa.pk KRData 模式无效。");
  const expectedChecksum = readUInt32(payload, 2);
  let cursor = 6;
  const cipherKey = (mode & 2) ? readUInt32(payload, cursor) : 0;
  if (mode & 2) cursor += 4;
  const decodedSize = (mode & 1) ? readInt32(payload, cursor) : 0;
  if (mode & 1) cursor += 4;
  requireValue(decodedSize >= 0 && decodedSize <= 32 * 1024 * 1024,
    "aaa.pk 解压长度无效。");
  let body = payload.subarray(cursor);
  if (mode & 2) body = rhoXor(body, cipherKey);
  if (mode & 1) {
    body = await inflateZlib(body, decodedSize);
    requireValue(body.length === decodedSize, "aaa.pk 解压长度不匹配。");
  }
  requireValue(rhoAdler32(body) === expectedChecksum, "aaa.pk 校验失败。");
  const root = decodeBinaryXml(body);
  requireValue(root.name === "PackFolder" && attribute(root, "name") === "KartRider",
    "aaa.pk 根目录不是 KartRider。");
  const mounts: ArchiveMount[] = [];
  mountsIn(root, "", 0, mounts);
  const region = root.children
    .find(child => child.name === "PackFolder" && attribute(child, "name") === "zeta")
    ?.children.filter(child => child.name === "PackFolder")
    .map(child => attribute(child, "name"))
    .find(name => name === "cn" || name === "kr" || name === "tw") ?? "unknown";
  return { mounts, region };
}

export async function readMountManifest(source: ArchiveSource): Promise<readonly ArchiveMount[]> {
  return (await readMountManifestDetails(source)).mounts;
}
