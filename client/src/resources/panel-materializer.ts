import type { PanelCommand, PanelRect } from "./panel-draw-order";

export interface PanelQuad extends PanelRect {
  character: string;
  u0: number; v0: number; u1: number; v1: number;
}

export interface PanelMaterializeOps<Node extends { name: string }> {
  attribute(node: Node, name: string): string | undefined;
  inset(rect: PanelRect): PanelRect;
  uv(node: Node, texture: unknown): PanelRect;
  font(node: Node, texture: unknown): unknown;
  rasterizeInto(font: unknown, text: string, output: PanelQuad[]): void;
  offsetInto(local: PanelQuad[], world: PanelQuad[], x: number, y: number): void;
  copyInto(world: PanelQuad[], framebuffer: PanelQuad[]): void;
  rasterize(font: unknown, text: string): PanelQuad[];
}

export interface PanelMaterializeCache<Node extends { name: string }> {
  baseOutput(): unknown[];
  payloadFor(command: PanelCommand<Node>, texture?: unknown): unknown;
  storePayload(command: PanelCommand<Node>, payload: unknown, texture?: unknown): void;
  glyphPools(node: Node): {
    local: unknown[]; world: unknown[]; framebuffer: unknown[];
  };
}

/** Turns cached P3528 layout commands into textured or glyph draw payloads. */
export function materializePanelDrawOrder<Node extends { name: string }>(
  commands: PanelCommand<Node>[], textures: Map<string, unknown>,
  cache: PanelMaterializeCache<Node> | undefined,
  ops: PanelMaterializeOps<Node>): Array<PanelCommand<Node> & Record<string, unknown>> {
  const output = cache === undefined ? [] : cache.baseOutput();
  output.length = 0;
  for (const command of commands) {
    if (command.kind !== "panel" && command.kind !== "char-panel") {
      output.push(command);
      continue;
    }
    const node = command.node;
    if (ops.attribute(node, "alphaBlend") !== "true" ||
        ops.attribute(node, "alphaTest") !== undefined)
      throw new Error(`${node.name} 不使用已闭合的 P3528 alpha state。`);
    const textureName = ops.attribute(node, "texture");
    const texture = textureName === undefined ? undefined : textures.get(textureName);

    if (command.kind === "panel" && textureName === undefined) {
      if (ops.attribute(node, "color") !== "150 0 0 0")
        throw new Error(`${node.name} 缺少已闭合的 P3528 texture 或 solid color。`);
      const cached = cache?.payloadFor(command);
      if (cached !== undefined) {
        output.push(cached);
        continue;
      }
      const solid = { ...command, kind: "solid-panel",
        framebufferRect: ops.inset(command.worldRect), color: [0, 0, 0, 150] };
      cache?.storePayload(command, solid);
      output.push(solid);
      continue;
    }

    if (!textureName || !texture)
      throw new Error(`${node.name} 缺少已解析的 P3528 texture。`);
    if (command.kind === "panel") {
      const cached = cache?.payloadFor(command, texture);
      if (cached !== undefined) {
        output.push(cached);
        continue;
      }
      const textured = { ...command, kind: "panel", textureName, texture,
        framebufferRect: command.worldRect, uv: ops.uv(node, texture) };
      cache?.storePayload(command, textured, texture);
      output.push(textured);
      continue;
    }

    if (command.text === undefined)
      throw new Error(`${ops.attribute(node, "name") ?? "CharPanel"} 缺少已闭合的 text producer。`);
    const font = ops.font(node, texture);
    if (cache !== undefined) {
      const glyphs = cache.glyphPools(node);
      const local = glyphs.local as PanelQuad[];
      const world = glyphs.world as PanelQuad[];
      const framebuffer = glyphs.framebuffer as PanelQuad[];
      ops.rasterizeInto(font, command.text, local);
      ops.offsetInto(local, world,
        command.worldRect.left, command.worldRect.top);
      ops.copyInto(world, framebuffer);
      const cached = cache.payloadFor(command, texture) as
        (PanelCommand<Node> & Record<string, unknown>) | undefined;
      const drawable = cached ?? { ...command, kind: "char-panel",
        text: command.text, textureName, texture,
        worldQuads: world, framebufferQuads: framebuffer };
      if (cached === undefined) cache.storePayload(command, drawable, texture);
      else drawable.text = command.text;
      output.push(drawable);
      continue;
    }

    const worldQuads = ops.rasterize(font, command.text).map(glyph => ({
      ...glyph,
      left: Math.fround(command.worldRect.left + glyph.left),
      top: Math.fround(command.worldRect.top + glyph.top),
      right: Math.fround(command.worldRect.left + glyph.right),
      bottom: Math.fround(command.worldRect.top + glyph.bottom),
    }));
    output.push({ ...command, text: command.text, textureName, texture,
      worldQuads, framebufferQuads: worldQuads.map(glyph => ({ ...glyph })) });
  }
  return output as Array<PanelCommand<Node> & Record<string, unknown>>;
}
