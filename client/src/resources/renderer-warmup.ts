import { Mesh, PerspectiveCamera, Scene, Sprite, Texture, Vector4,
  type Object3D, type WebGLRenderer } from "three";

/** Compile scene shaders and upload every material texture before racing. */
export function warmRendererResources(renderer: WebGLRenderer, root: Object3D,
  environment?: Scene, renderOnePixel = false): void {
  const camera = new PerspectiveCamera();
  if (environment) renderer.compile(root, camera, environment);
  else renderer.compile(root, camera);

  const textures = new Set<Texture>();
  root.traverse(object => {
    const drawable = object as Object3D & {
      isMesh?: boolean; isSprite?: boolean;
      material: Mesh["material"] | Sprite["material"];
    };
    if (!drawable.isMesh && !drawable.isSprite) return;
    const materials = Array.isArray(drawable.material)
      ? drawable.material : [drawable.material];
    for (const material of materials) {
      const value = material as typeof material & {
        uniforms?: Record<string, { value?: unknown }>;
        map?: unknown;
      };
      if (value.map instanceof Texture) textures.add(value.map);
      if (value.uniforms)
        for (const uniform of Object.values(value.uniforms))
          if (uniform?.value instanceof Texture) textures.add(uniform.value);
    }
  });
  for (const texture of textures) renderer.initTexture(texture);
  if (!renderOnePixel) return;

  // A tiny render forces texture and material initialization without showing
  // the assembled scene. Restore the caller's renderer state even on failure.
  const preview = new Scene();
  preview.fog = environment?.fog ?? null;
  root.traverse(object => {
    let drawable: Mesh | Sprite;
    if (object.type === "Mesh") {
      const mesh = object as Mesh;
      drawable = new Mesh(mesh.geometry, mesh.material);
    } else if ((object as Sprite).isSprite) {
      drawable = new Sprite((object as Sprite).material);
    } else return;
    drawable.matrixAutoUpdate = false;
    drawable.matrix.copy(object.matrixWorld);
    drawable.frustumCulled = false;
    preview.add(drawable);
  });

  const target = renderer.getRenderTarget();
  const viewport = renderer.getViewport(new Vector4());
  const scissor = renderer.getScissor(new Vector4());
  const scissorEnabled = renderer.getScissorTest();
  const sortObjects = renderer.sortObjects;
  try {
    renderer.setRenderTarget(null);
    renderer.setViewport(0, 0, 1, 1);
    renderer.setScissor(0, 0, 1, 1);
    renderer.setScissorTest(true);
    renderer.sortObjects = false;
    renderer.render(preview, camera);
  } finally {
    renderer.sortObjects = sortObjects;
    renderer.setRenderTarget(target);
    renderer.setViewport(viewport);
    renderer.setScissor(scissor);
    renderer.setScissorTest(scissorEnabled);
    preview.clear();
  }
}
