import { Matrix4, Vector3 } from "three";

export interface BillboardCameraBasis {
  position: Vector3;
  right: Vector3;
  up: Vector3;
  back: Vector3;
}

function writeBasis(target: Matrix4, right: Vector3, up: Vector3,
  back: Vector3, position: Vector3): void {
  target.set(right.x, up.x, back.x, position.x,
    right.y, up.y, back.y, position.y,
    right.z, up.z, back.z, position.z, 0, 0, 0, 1);
}

/** Reorients a track billboard while preserving its previous translation. */
export function orientTrackBillboard(target: Matrix4, source: Matrix4,
  mode: number, camera: BillboardCameraBasis): void {
  const elements = source.elements;
  const position = new Vector3(elements[12], elements[13], elements[14]);
  const original = [
    new Vector3(elements[0], elements[1], elements[2]),
    new Vector3(elements[4], elements[5], elements[6]),
    new Vector3(elements[8], elements[9], elements[10]),
  ];
  const normalized = original.map(axis => axis.clone());
  if (normalized.some(axis => axis.length() !== 1))
    normalized.forEach(axis => axis.multiplyScalar(1 / axis.length()));

  if (mode === 3) {
    const view = camera.position.clone().sub(position);
    const side = view.dot(normalized[0]!);
    const depth = view.dot(normalized[2]!);
    const distance = Math.sqrt(side * side + depth * depth);
    if (distance < 9999999960041972e-28) {
      target.copy(source);
      return;
    }
    const angle = Math.acos(side / distance);
    const rotation = depth >= 0 ? 1.570796012878418 - angle
      : angle + 1.570796012878418;
    const cosine = Math.cos(rotation);
    const sine = Math.sin(rotation);
    const right = original[0]!.clone().multiplyScalar(cosine)
      .addScaledVector(original[2]!, -sine);
    const back = original[0]!.clone().multiplyScalar(sine)
      .addScaledVector(original[2]!, cosine);
    writeBasis(target, right, original[1]!, back, position);
    return;
  }

  if (mode === 5) {
    const view = camera.position.clone().sub(position);
    if (view.lengthSq() < 0.009999999776482582) {
      target.copy(source);
      return;
    }
    view.normalize();
    const dot = camera.back.dot(view);
    const rotate = dot < 0.9999989867210388;
    const right = rotate ? rotateFromTo(view, camera.back,
      Math.acos(dot), camera.right) : camera.right.clone();
    const up = rotate ? rotateFromTo(view, camera.back,
      Math.acos(dot), camera.up) : camera.up.clone();
    const back = view.clone().negate();
    const axes = [right, up, back].map(axis =>
      original[0]!.clone().multiplyScalar(normalized[0]!.dot(axis))
        .addScaledVector(original[1]!, normalized[1]!.dot(axis))
        .addScaledVector(original[2]!, normalized[2]!.dot(axis)));
    writeBasis(target, axes[0]!, axes[1]!, axes[2]!, position);
    return;
  }

  if (mode !== 1 && mode !== 4) {
    writeBasis(target, normalized[0]!, normalized[1]!, normalized[2]!, position);
    return;
  }

  const negativeRight = camera.right.clone().negate();
  const cameraAxes = [mode === 4 ? negativeRight : camera.back,
    camera.up, mode === 4 ? camera.back : negativeRight];
  const localAxes = cameraAxes.map(axis => new Vector3(
    normalized[0]!.dot(axis), normalized[1]!.dot(axis),
    normalized[2]!.dot(axis)));
  let oriented: Vector3[];
  if (mode === 4) {
    oriented = localAxes.map(axis => worldAxis(original, axis));
  } else {
    const [back, up, right] = localAxes;
    const verticalLength = Math.sqrt(up!.z * up!.z + right!.z * right!.z);
    const originalBack = back!.clone();
    const originalRight = right!.clone();
    if (verticalLength > 9999999974752427e-22) {
      const upZ = up!.z, rightZ = right!.z;
      localAxes[0] = up!.clone().multiplyScalar(upZ)
        .addScaledVector(originalRight, rightZ)
        .multiplyScalar(1 / verticalLength);
      localAxes[1] = up!.clone().multiplyScalar(rightZ)
        .sub(originalRight.clone().multiplyScalar(upZ))
        .multiplyScalar(1 / verticalLength);
      localAxes[2] = originalBack.negate();
    } else {
      localAxes[0] = originalRight;
      localAxes[2] = originalBack.negate();
    }
    oriented = localAxes.map(axis => worldAxis(original, axis));
  }
  writeBasis(target, oriented[0]!, oriented[1]!, oriented[2]!, position);
}

function worldAxis(basis: Vector3[], axis: Vector3): Vector3 {
  return basis[0]!.clone().multiplyScalar(axis.x)
    .addScaledVector(basis[1]!, axis.y)
    .addScaledVector(basis[2]!, axis.z);
}

function rotateFromTo(direction: Vector3, reference: Vector3,
  angle: number, vector: Vector3): Vector3 {
  const axis = direction.clone().cross(reference);
  const cosine = Math.cos(angle), sine = Math.sin(angle);
  const remainder = 1 - cosine;
  const { x, y, z } = axis;
  const matrix = [
    x * x * remainder + cosine,
    z * sine + x * y * remainder,
    x * z * remainder - y * sine,
    x * y * remainder - z * sine,
    y * y * remainder + cosine,
    x * sine + y * z * remainder,
    y * sine + x * z * remainder,
    y * z * remainder - x * sine,
    z * z * remainder + cosine,
  ];
  return new Vector3(
    vector.x * matrix[0]! + vector.y * matrix[1]! + vector.z * matrix[2]!,
    vector.x * matrix[3]! + vector.y * matrix[4]! + vector.z * matrix[5]!,
    vector.x * matrix[6]! + vector.y * matrix[7]! + vector.z * matrix[8]!,
  );
}
