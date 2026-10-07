export interface GiantAppearanceDependencies {
  applyOutline(mesh: any, options: unknown): void;
  isMaterial(material: unknown): boolean;
  hasNormalUvOffset(material: any): boolean;
  restoreRootConsumer(mesh: any): () => void;
  normalUvY: number;
  blending: unknown;
  sourceAlpha: unknown;
  oneMinusSourceAlpha: unknown;
  addEquation: unknown;
}

interface MaterialBinding {
  mesh: any;
  inheritsRootAlpha?: boolean;
}

interface MaterialClone {
  binding: MaterialBinding;
  source: any;
  clone: any;
  callback: (...args: any[]) => unknown;
  restore: () => void;
}

/** Applies giant kart outline color and temporary translucent materials. */
export class GiantAppearance {
  readonly clones: MaterialClone[] = [];
  transparent = false;
  purple = false;

  constructor(readonly local: boolean, readonly kart: MaterialBinding[],
    readonly character: MaterialBinding[],
    readonly dependencies: GiantAppearanceDependencies) {}

  update(state: number, effect: number): void {
    if (state === 0) this.purple = false;
    else if (effect === 2) this.purple = true;
    for (const [bindings, color] of [
      [this.kart, 4284887961], [this.character, 2858824601],
    ] as [MaterialBinding[], number][]) {
      for (const { mesh } of bindings)
        this.dependencies.applyOutline(mesh, {
          selector: this.purple ? 1 : 0,
          centerArgb: this.purple ? color : 4278190080,
          outerArgb: this.purple ? 6697881 : 2130706432,
        });
    }
    const translucent = this.local && state === 4;
    if (this.transparent === translucent) return;
    this.restoreMaterials();
    this.transparent = translucent;
    if (!translucent) return;
    try {
      for (const binding of [...this.kart, ...this.character]) {
        const source = binding.mesh.material;
        if (Array.isArray(source) || !this.dependencies.isMaterial(source))
          throw new Error("巨人模型缺少已闭合的单材质 root consumer。");
        if (!this.dependencies.hasNormalUvOffset(source) && !binding.inheritsRootAlpha)
          continue;
        const clone = source.clone();
        const callback = binding.mesh.onBeforeRender;
        const restore = binding.inheritsRootAlpha
          ? this.dependencies.restoreRootConsumer(binding.mesh) : () => {};
        const synchronize = () => {
          for (const [name, uniform] of Object.entries(source.uniforms) as [string, any][]) {
            const value = uniform.value;
            const target = clone.uniforms[name];
            if (!target) continue;
            if (value?.isTexture) target.value = value;
            else if (target.value?.copy && value?.clone) target.value.copy(value);
            else target.value = value;
          }
          if (this.dependencies.hasNormalUvOffset(clone))
            clone.uniforms.normalUvOffset.value.y = this.dependencies.normalUvY;
          if (binding.inheritsRootAlpha) {
            clone.uniforms.alphaTestEnabled.value = 1;
            clone.uniforms.alphaFunction.value = 5;
            clone.uniforms.alphaReference.value = 0;
            clone.transparent = true;
            clone.blending = this.dependencies.blending;
            clone.blendSrc = this.dependencies.sourceAlpha;
            clone.blendDst = this.dependencies.oneMinusSourceAlpha;
            clone.blendEquation = this.dependencies.addEquation;
          }
        };
        this.clones.push({ binding, source, clone, callback, restore });
        binding.mesh.material = clone;
        binding.mesh.onBeforeRender = function (this: unknown, ...args: any[]) {
          callback.apply(this, args);
          synchronize();
        };
        synchronize();
      }
    } catch (error) {
      this.restoreMaterials();
      throw error;
    }
  }

  restoreMaterials(): void {
    for (const entry of this.clones.splice(0).reverse()) {
      entry.binding.mesh.material = entry.source;
      entry.binding.mesh.onBeforeRender = entry.callback;
      entry.restore();
      entry.clone.dispose();
    }
  }

  dispose(): void {
    this.restoreMaterials();
    this.transparent = false;
    this.purple = false;
    for (const { mesh } of [...this.kart, ...this.character])
      this.dependencies.applyOutline(mesh, undefined);
  }
}
