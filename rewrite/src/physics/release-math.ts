export interface Vector3Like {
  x: number;
  y: number;
  z: number;
}

/** The release rounds most simulation arithmetic to IEEE 754 float32. */
export const float32 = Math.fround;

export function vector3(x = 0, y = 0, z = 0): Vector3Like {
  return { x, y, z };
}

export function float32FromBits(bits: number): number {
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setUint32(0, bits, true);
  return view.getFloat32(0, true);
}

export const averageWeight = float32(0.3333300054);

export function addVectors(left: Vector3Like, right: Vector3Like): Vector3Like {
  return {
    x: float32(left.x + right.x),
    y: float32(left.y + right.y),
    z: float32(left.z + right.z),
  };
}

export function subtractVectors(left: Vector3Like, right: Vector3Like): Vector3Like {
  return {
    x: float32(left.x - right.x),
    y: float32(left.y - right.y),
    z: float32(left.z - right.z),
  };
}

export function scaleVector(vector: Vector3Like, scale: number): Vector3Like {
  return {
    x: float32(vector.x * scale),
    y: float32(vector.y * scale),
    z: float32(vector.z * scale),
  };
}

export function copyAsFloat32(vector: Vector3Like): Vector3Like {
  return {
    x: float32(vector.x),
    y: float32(vector.y),
    z: float32(vector.z),
  };
}

/** The original uses a rounded one-third constant, not exact division. */
export function averageThreeVectors(vectors: [Vector3Like, Vector3Like, Vector3Like]): Vector3Like {
  return scaleVector(addVectors(addVectors(vectors[0], vectors[1]), vectors[2]), averageWeight);
}

// Release names remain available while callers move to descriptive imports.
export {
  vector3 as F2,
  float32FromBits as F4,
  float32 as m,
  float32 as t0,
  averageWeight as dl,
  addVectors as On,
  averageThreeVectors as Rg,
  copyAsFloat32 as I1,
  subtractVectors as N1,
  scaleVector as Tt,
};
