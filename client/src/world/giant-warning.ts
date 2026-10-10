interface Point3 { x: number; y: number; z: number }
interface Threat extends Point3 { id: unknown; main: number; position: Point3 }

export interface GiantWarningDependencies {
  createGeometry(): any;
  createAttribute(values: Float32Array, itemSize: number): any;
  createMaterial(options: unknown): any;
  createMesh(geometry: unknown, material: unknown): any;
  orientMesh(mesh: unknown): void;
  repeatWrapping: unknown;
  linearFilter: unknown;
  normalBlending: unknown;
  sourceAlpha: unknown;
  oneMinusSourceAlpha: unknown;
  addEquation: unknown;
  doubleSide: unknown;
  alwaysDepth: unknown;
}

const f32 = Math.fround;
function subtract(left: Point3, right: Point3): Point3 {
  return { x: f32(left.x - right.x), y: f32(left.y - right.y), z: f32(left.z - right.z) };
}
function length(vector: Point3): number {
  return f32(Math.sqrt(f32(f32(f32(vector.x * vector.x) +
    f32(vector.y * vector.y)) + f32(vector.z * vector.z))));
}
function normalize(vector: Point3): Point3 {
  const radius = length(vector);
  return radius === 0 ? { x: 0, y: 0, z: 0 } :
    { x: f32(vector.x / radius), y: f32(vector.y / radius), z: f32(vector.z / radius) };
}
function dot(left: Point3, right: Point3): number {
  return f32(f32(f32(left.x * right.x) + f32(left.y * right.y)) + f32(left.z * right.z));
}

/** Camera facing warning quad for a nearby giant kart approaching the player. */
export class GiantWarning {
  readonly geometry: any;
  readonly material: any;
  readonly mesh: any;
  selected: unknown;
  coefficient = 0;
  angle = 0;
  readonly positions = new Float32Array(12);
  readonly uvs = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]);

  constructor(readonly texture: any, readonly dependencies: GiantWarningDependencies) {
    const ops = dependencies;
    this.geometry = ops.createGeometry();
    texture.wrapS = texture.wrapT = ops.repeatWrapping;
    texture.minFilter = texture.magFilter = ops.linearFilter;
    texture.generateMipmaps = false;
    this.geometry.setAttribute("position", ops.createAttribute(this.positions, 3));
    this.geometry.setAttribute("uv", ops.createAttribute(this.uvs, 2));
    this.geometry.setIndex([0, 1, 2, 2, 1, 3]);
    this.material = ops.createMaterial({
      uniforms: { image: { value: texture } },
      transparent: true,
      blending: ops.normalBlending,
      blendSrc: ops.sourceAlpha,
      blendDst: ops.oneMinusSourceAlpha,
      blendEquation: ops.addEquation,
      side: ops.doubleSide,
      forceSinglePass: true,
      depthFunc: ops.alwaysDepth,
      depthWrite: false,
      vertexShader: "precision highp float; uniform mat4 projectionMatrix,modelViewMatrix; attribute vec3 position; attribute vec2 uv; varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
      fragmentShader: "precision highp float; uniform sampler2D image; varying vec2 vUv; void main(){gl_FragColor=texture2D(image,vUv)*vec4(1.0,1.0,1.0,128.0/255.0);}",
    });
    this.mesh = ops.createMesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.mesh.matrixAutoUpdate = false;
    ops.orientMesh(this.mesh);
  }

  update(local: any, opponents: any[], hidden: unknown, camera: any): void {
    this.mesh.visible = false;
    if (hidden) return;
    let selected: any;
    let distance = Infinity;
    if (local.main !== 4) {
      for (const opponent of opponents) {
        if (opponent.main !== 4) continue;
        const delta = subtract(opponent.position, local.position);
        const candidateDistance = length(delta);
        if (candidateDistance >= 5 && candidateDistance <= 70 &&
          candidateDistance < distance &&
          dot({ x: -local.forward.x, y: -local.forward.y, z: -local.forward.z },
            normalize(delta)) > 0) {
          selected = opponent;
          distance = candidateDistance;
        }
      }
    }
    if (!selected && !this.selected) return;
    if (selected && selected.id !== this.selected) {
      this.coefficient = 0;
      this.angle = 0;
      this.selected = selected.id;
    }
    if (!selected && this.coefficient <= f32(0.05)) {
      this.reset();
      return;
    }
    const distanceFraction = f32((distance - 5) / 65);
    const size = f32(392 - distanceFraction * 392);
    const opacity = selected ? f32((120 + size) / 512) : 0;
    this.coefficient = f32((1 - f32(0.1)) * this.coefficient + opacity * f32(0.1));
    const matrix = camera.matrixWorld.elements;
    const cameraPosition = { x: matrix[12], y: matrix[13], z: matrix[14] };
    if (selected) {
      const towardGiant = normalize(subtract(selected.position, local.position));
      const cameraForward = normalize({ x: matrix[8], y: matrix[9], z: matrix[10] });
      this.angle = f32((1 - Math.max(0, dot(cameraForward, towardGiant))) * f32(0.85));
      if (f32(cameraForward.z * towardGiant.x - cameraForward.x * towardGiant.z) > 0)
        this.angle = f32(-this.angle);
    }
    const towardPlayer = normalize(subtract(local.position, cameraPosition));
    const origin = {
      x: f32(cameraPosition.x + f32(towardPlayer.x * f32(2.5))),
      y: f32(cameraPosition.y + f32(towardPlayer.y * f32(2.5))),
      z: f32(cameraPosition.z + f32(towardPlayer.z * f32(2.5))),
    };
    const right = { x: f32(-matrix[0] * 2.5), y: f32(-matrix[1] * 2.5),
      z: f32(-matrix[2] * 2.5) };
    const up = { x: f32(matrix[4] * 2.5), y: f32(matrix[5] * 2.5),
      z: f32(matrix[6] * 2.5) };
    for (let corner = 0; corner < 4; corner += 1) {
      const side = f32((corner % 2 === 0 ? 1 : -1) + this.angle);
      const vertical = corner < 2 ? 1 : -1;
      this.positions[corner * 3] = f32(right.x * side + up.x * vertical + origin.x);
      this.positions[corner * 3 + 1] = f32(right.y * side + up.y * vertical + origin.y);
      this.positions[corner * 3 + 2] = f32(right.z * side + up.z * vertical + origin.z);
    }
    this.uvs[5] = this.uvs[7] = this.coefficient;
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.uv.needsUpdate = true;
    this.mesh.visible = true;
  }

  reset(): void {
    this.selected = undefined;
    this.coefficient = 0;
    this.angle = 0;
    this.mesh.visible = false;
  }

  dispose(): void {
    this.reset();
    this.mesh.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
  }
}
