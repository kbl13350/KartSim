/** The scene's small ownership contract needed for track cleanup. */
export interface Disposable {
  dispose(): void;
}

export interface TrackMesh {
  geometry: Disposable;
  material: Disposable | readonly Disposable[];
}

export interface TrackDisposeHost {
  lensFlare?: Disposable;
  renderScene?: Disposable;
  skydomeScene?: Disposable;
  group: { traverse(visitor: (object: unknown) => void): void };
}

/**
 * Releases scene controllers first, then every mesh geometry. A material and
 * each texture found on its fields are released once even when shared by meshes.
 * The caller supplies the renderer's Mesh/Texture identity checks.
 */
export function disposeTrackWorld(
  host: TrackDisposeHost,
  isMesh: (object: unknown) => object is TrackMesh,
  isTexture: (object: unknown) => object is Disposable,
): void {
  host.lensFlare?.dispose();
  host.renderScene?.dispose();
  host.skydomeScene?.dispose();

  const disposedMaterials = new Set<Disposable>();
  const disposedTextures = new Set<Disposable>();
  host.group.traverse(object => {
    if (!isMesh(object)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (disposedMaterials.has(material)) continue;
      disposedMaterials.add(material);
      for (const field of Object.values(material)) {
        if (!isTexture(field) || disposedTextures.has(field)) continue;
        disposedTextures.add(field);
        field.dispose();
      }
      material.dispose();
    }
  });
}
