export interface CoatingTextureManager {
  advance(nowMs: number): void;
  dispose(): void;
}

export interface CoatingScene<Projection> {
  setCoatingProjection(projection: Projection | undefined): void;
}

export interface CoatingSelection {
  coating?: number;
  family?: string;
}

export interface CoatingOwnerOps<Archive, Visual, Body, Projection, Textures extends CoatingTextureManager> {
  createTextures(archive: Archive): Textures;
  loadProjection(
    archive: Archive,
    visual: Visual,
    body: Body,
    generation: number,
    selection: CoatingSelection,
    textures: Textures,
  ): Promise<Projection>;
}

/** Installs one kart coating projection and owns its texture lifetime when allocated locally. */
export class CoatingOwner<Projection, Textures extends CoatingTextureManager> {
  scene: CoatingScene<Projection>;
  configuration: Projection;
  textures: Textures;
  ownsTextures: boolean;
  disposed = false;

  constructor(scene: CoatingScene<Projection>, configuration: Projection, textures: Textures, ownsTextures: boolean) {
    this.scene = scene;
    this.configuration = configuration;
    this.textures = textures;
    this.ownsTextures = ownsTextures;
  }

  static async load<Archive, Visual, Body, Projection, Textures extends CoatingTextureManager>(
    archive: Archive,
    scene: CoatingScene<Projection>,
    visual: Visual,
    body: Body,
    generation: number,
    selection: CoatingSelection | undefined,
    injectedTextures: Textures | undefined,
    ops: CoatingOwnerOps<Archive, Visual, Body, Projection, Textures>,
  ): Promise<CoatingOwner<Projection, Textures> | undefined> {
    if (selection?.coating === undefined) return undefined;
    const textures = injectedTextures ?? ops.createTextures(archive);
    try {
      const projection = await ops.loadProjection(archive, visual, body, generation, selection, textures);
      scene.setCoatingProjection(projection);
      return new this(scene, projection, textures, injectedTextures === undefined);
    } catch (error) {
      if (!injectedTextures) textures.dispose();
      throw error;
    }
  }

  advance(nowMs: number): void {
    if (!this.disposed && this.ownsTextures) this.textures.advance(Math.trunc(nowMs) >>> 0);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.scene.setCoatingProjection(undefined);
    if (this.ownsTextures) this.textures.dispose();
  }
}
