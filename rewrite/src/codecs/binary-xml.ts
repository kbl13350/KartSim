import { decodeText, requireValue } from "./common";

export interface BinaryXmlNode {
  readonly name: string;
  readonly text: string;
  readonly attributes: readonly { name: string; value: string }[];
  readonly children: readonly BinaryXmlNode[];
}

class BinaryXmlReader {
  readonly bytes: Uint8Array;
  private readonly view: DataView;
  offset = 0;

  constructor(bytes: Uint8Array) {
    this.bytes = bytes;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  uint32(): number {
    requireValue(this.offset + 4 <= this.bytes.length, "BML 整数不完整。");
    const value = this.view.getUint32(this.offset, true);
    this.offset += 4;
    return value;
  }

  string(): string {
    const characters = this.uint32();
    requireValue(characters <= 1_000_000, "BML 字符串超过上限。");
    const size = characters * 2;
    requireValue(this.offset + size <= this.bytes.length, "BML 字符串不完整。");
    const value = new TextDecoder("utf-16le", { fatal: true })
      .decode(this.bytes.subarray(this.offset, this.offset + size));
    this.offset += size;
    return value;
  }
}

export function decodeBinaryXml(bytes: Uint8Array): BinaryXmlNode {
  const reader = new BinaryXmlReader(bytes);
  let nodes = 0, attributes = 0;
  function node(depth: number): BinaryXmlNode {
    requireValue(depth <= 128 && ++nodes <= 1_000_000, "BML 树过深或过大。");
    const name = reader.string();
    const text = reader.string();
    const attributeCount = reader.uint32();
    attributes += attributeCount;
    requireValue(attributeCount <= 100_000 && attributes <= 10_000_000, "BML 属性超过上限。");
    const nodeAttributes = Array.from({ length: attributeCount }, () => ({
      name: reader.string(), value: reader.string(),
    }));
    const childCount = reader.uint32();
    requireValue(childCount <= 1_000_000, "BML 子节点超过上限。");
    const children = Array.from({ length: childCount }, () => node(depth + 1));
    return { name, text, attributes: nodeAttributes, children };
  }
  const root = node(0);
  requireValue(reader.offset === bytes.length, "BML 尾部包含未解析数据。");
  return root;
}

export function attribute(node: BinaryXmlNode, name: string): string | undefined {
  return node.attributes.find(item => item.name === name)?.value;
}

const XML_NAME = /^[\p{L}_:][\p{L}\p{N}_.:-]*$/u;
const escapeText = (text: string): string => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeAttribute = (text: string): string => escapeText(text).replace(/"/g, "&quot;").replace(/'/g, "&apos;");

/** The stable UTF-8 rendering used by recovered/data-full for comparison. */
export function serializeBinaryXml(root: BinaryXmlNode): string {
  function render(node: BinaryXmlNode, depth: number): string {
    requireValue(XML_NAME.test(node.name), `无效的 BML XML 节点名：${node.name}。`);
    const pad = "  ".repeat(depth);
    const attrs = node.attributes.map(({ name, value }) => {
      requireValue(XML_NAME.test(name), `无效的 BML XML 属性名：${name}。`);
      return ` ${name}="${escapeAttribute(value)}"`;
    }).join("");
    if (node.children.length === 0 && !node.text) return `${pad}<${node.name}${attrs}/>`;
    if (node.children.length === 0) {
      return `${pad}<${node.name}${attrs}>${escapeText(node.text)}</${node.name}>`;
    }
    const children = node.children.map(child => render(child, depth + 1)).join("\n");
    return `${pad}<${node.name}${attrs}>${node.text ? escapeText(node.text) : ""}\n${children}\n${pad}</${node.name}>`;
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n${render(root, 0)}\n`;
}

export function exportXml(bytes: Uint8Array, path: string): string {
  if (path.toLowerCase().endsWith(".bml")) return serializeBinaryXml(decodeBinaryXml(bytes));
  return decodeText(bytes).replace(/^\s+(?=<\?xml)/i, "")
    .replace(/^(\s*<\?xml[^>]*\bencoding\s*=\s*['"])[^'"]+(['"][^>]*\?>)/i, "$1UTF-8$2");
}
