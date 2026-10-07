/** The UTF-16LE XML subset used by the game's resource manifests. */
export interface ResourceXmlNode {
  name: string;
  attributes: Array<{ name: string; value: string }>;
  children: ResourceXmlNode[];
  text: string;
}

export function parseResourceXml(bytes: Uint8Array): {
  root: ResourceXmlNode; sourceBytes: Uint8Array;
} {
  if (bytes.length < 2 || bytes[0] !== 255 || bytes[1] !== 254)
    throw new Error("XML 缺少 UTF-16LE BOM。");
  let source: string;
  try {
    source = new TextDecoder("utf-16le", { fatal: true }).decode(bytes.subarray(2));
  } catch {
    throw new Error("XML 含无效 UTF-16LE code unit 序列。");
  }
  const cursor = new ResourceXmlCursor(source);
  cursor.readDeclaration();
  cursor.skipCommentsAndWhitespace();
  const root = cursor.readElement(0);
  cursor.skipCommentsAndWhitespace();
  if (!cursor.finished)
    throw new Error(`XML 在 code unit ${cursor.position} 后含额外内容。`);
  return { root, sourceBytes: bytes.slice() };
}

class ResourceXmlCursor {
  position = 0;
  constructor(readonly source: string) {}

  get finished(): boolean { return this.position === this.source.length; }

  readDeclaration(): void {
    if (!this.source.startsWith("<?xml", this.position))
      throw new Error("XML declaration 必须紧跟 UTF-16LE BOM。");
    const end = this.source.indexOf("?>", this.position + 5);
    if (end < 0) throw new Error("XML declaration 未闭合。");
    const declaration = this.source.slice(this.position + 5, end);
    if (!/\bversion\s*=\s*(['"])1\.0\1/.test(declaration) ||
        !/\bencoding\s*=\s*(['"])UTF-16\1/i.test(declaration))
      throw new Error("XML declaration 不是 version 1.0 / UTF-16。");
    this.position = end + 2;
  }

  skipCommentsAndWhitespace(): void {
    for (;;) {
      this.skipWhitespace();
      if (!this.source.startsWith("<!--", this.position)) return;
      const end = this.source.indexOf("-->", this.position + 4);
      if (end < 0) throw new Error("XML comment 未闭合。");
      this.position = end + 3;
    }
  }

  readElement(depth: number): ResourceXmlNode {
    if (depth > 128) throw new Error("XML 层级超过安全上限。");
    this.expect("<");
    if (this.peek("/") || this.peek("!") || this.peek("?"))
      throw new Error("XML element 起始标记无效。");
    const name = this.readName();
    const attributes: ResourceXmlNode["attributes"] = [];
    const seen = new Set<string>();
    for (;;) {
      this.skipWhitespace();
      if (this.take("/>")) return { name, attributes, children: [], text: "" };
      if (this.take(">")) break;
      const attribute = this.readName();
      if (seen.has(attribute)) throw new Error(`${name} 含重复属性 ${attribute}。`);
      seen.add(attribute);
      this.skipWhitespace();
      this.expect("=");
      this.skipWhitespace();
      const quote = this.source[this.position];
      if (quote !== "'" && quote !== '"')
        throw new Error(`${name}.${attribute} 缺少属性引号。`);
      this.position++;
      const end = this.source.indexOf(quote, this.position);
      if (end < 0) throw new Error(`${name}.${attribute} 属性未闭合。`);
      const value = decodeXmlEntities(this.source.slice(this.position, end));
      this.position = end + 1;
      attributes.push({ name: attribute, value });
    }

    const children: ResourceXmlNode[] = [];
    let text = "";
    for (;;) {
      if (this.source.startsWith(`</${name}`, this.position)) {
        this.position += name.length + 2;
        this.skipWhitespace();
        this.expect(">");
        return { name, attributes, children, text: decodeXmlEntities(text) };
      }
      if (this.source.startsWith("<!--", this.position)) {
        const end = this.source.indexOf("-->", this.position + 4);
        if (end < 0) throw new Error("XML comment 未闭合。");
        this.position = end + 3;
        continue;
      }
      if (this.peek("<")) {
        children.push(this.readElement(depth + 1));
        continue;
      }
      if (this.finished) throw new Error(`${name} 缺少结束标记。`);
      const next = this.source.indexOf("<", this.position);
      const end = next < 0 ? this.source.length : next;
      text += this.source.slice(this.position, end);
      this.position = end;
    }
  }

  private readName(): string {
    const match = /^[A-Za-z_][A-Za-z0-9_.:-]*/.exec(
      this.source.slice(this.position));
    if (!match)
      throw new Error(`XML 在 code unit ${this.position} 缺少合法名称。`);
    this.position += match[0]!.length;
    return match[0]!;
  }

  private skipWhitespace(): void {
    while (/\s/.test(this.source[this.position] ?? "")) this.position++;
  }

  private peek(value: string): boolean {
    return this.source.startsWith(value, this.position);
  }

  private take(value: string): boolean {
    if (!this.peek(value)) return false;
    this.position += value.length;
    return true;
  }

  private expect(value: string): void {
    if (!this.take(value))
      throw new Error(`XML 在 code unit ${this.position} 需要 ${value}。`);
  }
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|apos|quot);/g,
      (entity, name: string) => {
        if (name === "amp") return "&";
        if (name === "lt") return "<";
        if (name === "gt") return ">";
        if (name === "apos") return "'";
        if (name === "quot") return '"';
        const point = name.startsWith("#x")
          ? Number.parseInt(name.slice(2), 16)
          : Number.parseInt(name.slice(1), 10);
        if (!Number.isInteger(point) || point < 0 || point > 1114111 ||
            (point >= 55296 && point <= 57343))
          throw new Error(`XML entity ${entity} 无效。`);
        return String.fromCodePoint(point);
      })
    .replace(/&[^;\s]*;/g, entity => {
      throw new Error(`XML entity ${entity} 未定义。`);
    });
}
