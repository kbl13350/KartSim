/** Layout for the sprite-font CharPanel and DashboardPanel widgets. */
export interface SpriteFontLayout {
  left: number;
  top: number;
  right: number;
  fontWidth: number;
  fontHeight: number;
  fontX: number;
  fontY: number;
  fontCharacters: string;
  spaceOffset: number;
  centerAlign: boolean;
  rightAlign: boolean;
  rowWidth: number;
  textureWidth: number;
  textureHeight: number;
}

export interface SpriteFontGlyph {
  character: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
  u0: number;
  v0: number;
  u1: number;
  v1: number;
}

export interface SpriteFontNode {
  name: string;
  attributes: Array<{ name: string; value: string }>;
}
export interface SpriteFontTexture { width: number; height: number }
export interface SpriteFontLayoutOps {
  attribute(node: SpriteFontNode, name: string): string | undefined;
  rectangle(node: SpriteFontNode,
    textures?: Map<string, SpriteFontTexture>): { width: number; height: number };
  parseNumbers(value: string, count: number, name: string): number[];
}

const f32 = Math.fround;
const layoutCache = new WeakMap<SpriteFontNode, {
  textureWidth: number; textureHeight: number; layout: SpriteFontLayout;
}>();

/** Resolve the text layout metadata once per panel and texture size. */
export function spriteFontLayoutForPanel(node: SpriteFontNode,
  texture: SpriteFontTexture, ops: SpriteFontLayoutOps): SpriteFontLayout {
  const cached = layoutCache.get(node);
  if (cached && cached.textureWidth === texture.width &&
    cached.textureHeight === texture.height) return cached.layout;
  if (node.name !== "CharPanel" && node.name !== "DashboardPanel")
    throw new Error(`${node.name} 不是 P3528 CharPanel。`);

  const attr = (name: string) => ops.attribute(node, name);
  const required = (name: string) => {
    const value = attr(name);
    if (value === undefined || value === "")
      throw new Error(`${node.name} 缺少 ${name}。`);
    return value;
  };
  const boolean = (name: string) => {
    const value = attr(name);
    if (value === undefined || value === "false") return false;
    if (value === "true") return true;
    throw new Error(`${node.name}.${name}=${value} 不是 P3528 boolean。`);
  };
  const textureName = attr("texture");
  const rectangle = ops.rectangle(node, textureName === undefined
    ? undefined : new Map([[textureName, texture]]));
  const [fontWidth, fontHeight] = ops.parseNumbers(required("fontSize"),
    2, "fontSize");
  const [fontX, fontY] = ops.parseNumbers(attr("fontPos") ?? "0 0",
    2, "fontPos");
  const flexible = boolean("flexible");
  const spaceOffset = attr("spaceOffset");
  const layout: SpriteFontLayout = {
    left: 0, top: 0, right: rectangle.width,
    fontWidth: flexible ? f32(rectangle.width) : fontWidth!,
    fontHeight: flexible ? f32(rectangle.height) : fontHeight!,
    fontX: fontX!, fontY: fontY!,
    fontCharacters: required("fontStr"),
    spaceOffset: spaceOffset === undefined ? 0
      : ops.parseNumbers(spaceOffset, 1, "spaceOffset")[0]!,
    centerAlign: boolean("centerAlign"),
    rightAlign: boolean("rightAlign"),
    rowWidth: boolean("allowVertical") ? texture.width : 800,
    textureWidth: texture.width,
    textureHeight: texture.height,
  };
  layoutCache.set(node, { textureWidth: texture.width,
    textureHeight: texture.height, layout });
  return layout;
}

function legacyRound(value: number): number {
  return Math.trunc(f32(value + (value < 0 ? -0.5 : 0.5)));
}

/** Fill a reusable glyph buffer, retaining existing glyph objects when possible. */
export function layoutSpriteFontInto(layout: SpriteFontLayout, text: string,
  glyphs: SpriteFontGlyph[]): void {
  const width = f32(layout.fontWidth);
  const height = f32(layout.fontHeight);
  const advance = f32(width + f32(layout.spaceOffset));
  const textWidth = f32(advance * text.length);
  const availableWidth = f32(f32(layout.right) - f32(layout.left));
  let x = f32(layout.left);
  if (layout.centerAlign)
    x = f32(x + legacyRound(f32(f32(availableWidth - textWidth) * 0.5)));
  if (layout.rightAlign)
    x = f32(layout.left + legacyRound(f32(availableWidth - textWidth)));
  const y = f32(layout.top);
  const atlas = layout.fontCharacters;
  let used = 0;

  for (let index = 0; index < text.length; index += 1) {
    const character = text.charAt(index);
    if (character !== " ") {
      let atlasX = 0;
      let atlasY = 0;
      let found = false;
      for (let atlasIndex = 0; atlasIndex < atlas.length; atlasIndex += 1) {
        const current = atlas.charAt(atlasIndex);
        if (current === character) {
          found = true;
          break;
        }
        atlasX = f32(atlasX + width);
        if (atlasX >= layout.rowWidth) {
          atlasY = f32(atlasY + height);
          atlasX = 0;
        }
        if (current === "|") {
          atlasY = f32(atlasY + height);
          atlasX = 0;
        }
      }
      if (found) {
        const textureX = f32(layout.fontX + atlasX);
        const textureY = f32(layout.fontY + atlasY);
        const glyph = glyphs[used] ?? {
          character, left: 0, top: 0, right: 0, bottom: 0,
          u0: 0, v0: 0, u1: 0, v1: 0,
        };
        glyphs[used] = glyph;
        glyph.character = character;
        glyph.left = x;
        glyph.top = y;
        glyph.right = f32(x + width);
        glyph.bottom = f32(y + height);
        glyph.u0 = f32(textureX / layout.textureWidth);
        glyph.v0 = f32(textureY / layout.textureHeight);
        glyph.u1 = f32(f32(textureX + width) / layout.textureWidth);
        glyph.v1 = f32(f32(textureY + height) / layout.textureHeight);
        used += 1;
      }
    }
    x = f32(x + advance);
  }
  glyphs.length = used;
}

export function layoutSpriteFont(layout: SpriteFontLayout,
  text: string): SpriteFontGlyph[] {
  const glyphs: SpriteFontGlyph[] = [];
  layoutSpriteFontInto(layout, text, glyphs);
  return glyphs;
}
