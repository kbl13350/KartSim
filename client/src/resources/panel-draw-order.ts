export interface PanelRect {
  left: number; top: number; right: number; bottom: number;
}

export interface PanelGeometry {
  width: number; height: number;
}

export interface PanelTreeNode<Node extends { name: string } = { name: string }> {
  node: Node;
  geometry: PanelGeometry;
  children: PanelTreeNode<Node>[];
}

export interface PanelCommand<Node extends { name: string } = { name: string }> {
  kind: string;
  node: Node;
  worldRect: PanelRect;
  text?: string;
}

export interface PanelDrawOptions<Node extends { name: string }> {
  visibility?: (node: Node, parent: Node | undefined) => boolean | undefined;
  text?: (node: Node) => string | undefined;
}

export interface PanelLayoutOps<Node extends { name: string }> {
  measure(geometry: PanelGeometry, parent: PanelRect): PanelRect;
  kind(name: string): string | undefined;
  visible(node: Node): boolean;
}

interface PanelEntry<Node extends { name: string }> {
  node: Node;
  kind: string | undefined;
  command: PanelCommand<Node> | undefined;
  children: PanelEntry<Node>[];
}

interface GlyphPools {
  local: unknown[]; world: unknown[]; framebuffer: unknown[];
}

/** Caches layout entries while rebuilding only the visible draw list each frame. */
export class PanelDrawCache<Node extends { name: string } = { name: string }> {
  tree?: PanelTreeNode<Node>;
  width = Number.NaN;
  height = Number.NaN;
  root?: PanelEntry<Node>;
  draw: PanelCommand<Node>[] = [];
  base: unknown[] = [];
  basePayloads = new WeakMap<PanelCommand<Node>, Map<unknown, unknown>>();
  glyphPoolsByNode = new WeakMap<Node, GlyphPools>();

  constructor(readonly ops: PanelLayoutOps<Node>) {}

  drawOrder(tree: PanelTreeNode<Node>, width: number, height: number,
    options: PanelDrawOptions<Node> = {}): PanelCommand<Node>[] {
    if (this.root === undefined || this.tree !== tree ||
        this.width !== width || this.height !== height) {
      this.tree = tree;
      this.width = width;
      this.height = height;
      this.root = this.createEntry(tree, { left: 0, top: 0,
        right: Math.fround(width), bottom: Math.fround(height) }, 0, 0);
    }
    this.draw.length = 0;
    this.emit(this.root, undefined, options, this.draw);
    return this.draw;
  }

  payloadFor(command: PanelCommand<Node>, texture?: unknown): unknown {
    return this.basePayloads.get(command)?.get(texture);
  }

  storePayload(command: PanelCommand<Node>, payload: unknown,
    texture?: unknown): void {
    let payloads = this.basePayloads.get(command);
    if (payloads === undefined) {
      payloads = new Map();
      this.basePayloads.set(command, payloads);
    }
    payloads.set(texture, payload);
  }

  baseOutput(): unknown[] { return this.base; }

  glyphPools(node: Node): GlyphPools {
    let pools = this.glyphPoolsByNode.get(node);
    if (pools === undefined) {
      pools = { local: [], world: [], framebuffer: [] };
      this.glyphPoolsByNode.set(node, pools);
    }
    return pools;
  }

  createEntry(tree: PanelTreeNode<Node>, parent: PanelRect,
    offsetX: number, offsetY: number): PanelEntry<Node> {
    const rect = this.ops.measure(tree.geometry, parent);
    const left = Math.fround(offsetX + rect.left);
    const top = Math.fround(offsetY + rect.top);
    const kind = this.ops.kind(tree.node.name);
    const command = kind === undefined ? undefined : {
      kind, node: tree.node,
      worldRect: { left, top,
        right: Math.fround(left + tree.geometry.width),
        bottom: Math.fround(top + tree.geometry.height) },
    };
    const childParent = { left: 0, top: 0,
      right: tree.geometry.width, bottom: tree.geometry.height };
    const children: PanelEntry<Node>[] = [];
    for (const child of tree.children)
      children.push(this.createEntry(child, childParent, left, top));
    return { node: tree.node, kind, command, children };
  }

  emit(entry: PanelEntry<Node>, parent: Node | undefined,
    options: PanelDrawOptions<Node>, output: PanelCommand<Node>[]): void {
    if (!(options.visibility?.(entry.node, parent) ??
      this.ops.visible(entry.node))) return;
    if (entry.command !== undefined) {
      if (entry.kind === "char-panel")
        entry.command.text = options.text?.(entry.node);
      output.push(entry.command);
    }
    for (const child of entry.children)
      this.emit(child, entry.node, options, output);
  }
}
