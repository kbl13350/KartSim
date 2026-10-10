import { BufferAttribute, BufferGeometry } from "three";

const f32 = Math.fround;
const IDENTITY_BONE = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];
const normalScratch = [0, 0, 0];
const secondaryNormal = [0, 0, 0];
const secondaryPosition = [0, 0, 0];

/** CPU skinning for the model's packed wedges and Toon outline vertices. */
export class CharacterSkinGeometry {
  constructor(source) {
    this.source = source;
    this.positions = new Float32Array(source.wedges.length * 3);
    this.normals = new Float32Array(source.wedges.length * 3);
    const firstWedgeByVertex = new Int32Array(source.vertices.length).fill(-1);
    this.normalSourceOffsets = new Int32Array(source.wedges.length);
    source.wedges.forEach((wedge, index) => {
      if (firstWedgeByVertex[wedge.skinVertexIndex] < 0)
        firstWedgeByVertex[wedge.skinVertexIndex] = index;
      this.normalSourceOffsets[index] =
        firstWedgeByVertex[wedge.skinVertexIndex] * 3;
    });
    this.outlinePositions = source.vertices.map(() => [0, 0, 0]);
    this.globalPose = source.bones.map(() => new Array(12).fill(0));
    this.palette = source.bones.map(() => new Array(12).fill(0));

    const uvs = new Float32Array(source.wedges.length * 2);
    source.wedges.forEach((wedge, index) => {
      uvs.set([wedge.u, wedge.v], index * 2);
    });
    const indices = [];
    for (const triangle of source.triangles)
      indices.push(...triangle.wedgeIndices);
    this.geometry = new BufferGeometry();
    this.geometry.setAttribute("position", new BufferAttribute(this.positions, 3));
    this.geometry.setAttribute("normal", new BufferAttribute(this.normals, 3));
    this.geometry.setAttribute("uv", new BufferAttribute(uvs, 2));
    this.geometry.setIndex(indices);
    this.outlineSource = {
      positions: this.outlinePositions,
      normals: [], texcoords: [],
      faces: source.triangles.map(triangle => ({
        texcoordIndices: [...triangle.wedgeIndices],
        adjacentFaceIndices: [...triangle.adjacentTriangleIndices],
        positionIndices: [...triangle.positionIndices],
        winding: triangle.winding,
        outlineOpenEdge: triangle.unknown13,
      })),
    };
    this.update(source.bones.map(bone => bone.localBind));
  }

  update(pose) {
    const globalPose = this.updatePose(pose);
    this.updateVertices();
    return globalPose;
  }

  updatePose(localPose) {
    if (localPose.length < this.source.bones.length)
      throw new Error(`character pose 需要 ${this.source.bones.length} bones，实际为 ${localPose.length}。`);
    for (let index = 0; index < this.source.bones.length; index++) {
      const bone = this.source.bones[index];
      if (index === 0) copyMatrix12(this.globalPose[index], localPose[index]);
      else if (bone.enabled) {
        if (bone.parentIndex >= index)
          throw new Error(`character bone ${index} parent ${bone.parentIndex} 尚未建立。`);
        multiplyMatrix12(this.globalPose[index],
          this.globalPose[bone.parentIndex], localPose[index]);
      } else copyMatrix12(this.globalPose[index], IDENTITY_BONE);
      multiplyMatrix12(this.palette[index], this.globalPose[index], bone.inverseBind);
    }
    return this.globalPose;
  }

  updateVertices() {
    this.applyPalette(this.palette);
  }

  applyPalette(palette) {
    const wedges = this.source.wedges;
    for (let index = 0; index < wedges.length; index++) {
      const offset = index * 3;
      const normalSource = this.normalSourceOffsets[index];
      if (normalSource === offset) {
        const vertex = this.source.vertices[wedges[index].skinVertexIndex];
        blendNormal(normalScratch, vertex.normal, vertex.bone0, vertex.bone1,
          vertex.weight0, vertex.weight1, palette);
        this.normals.set(normalScratch, offset);
      } else {
        this.normals[offset] = this.normals[normalSource];
        this.normals[offset + 1] = this.normals[normalSource + 1];
        this.normals[offset + 2] = this.normals[normalSource + 2];
      }
    }
    for (let index = 0; index < this.source.vertices.length; index++) {
      const vertex = this.source.vertices[index];
      blendPosition(this.outlinePositions[index], vertex.position,
        vertex.bone0, vertex.bone1, vertex.weight0, vertex.weight1, palette);
    }
    for (let index = 0; index < wedges.length; index++)
      this.positions.set(this.outlinePositions[wedges[index].skinVertexIndex], index * 3);
    this.geometry.getAttribute("position").needsUpdate = true;
    this.geometry.getAttribute("normal").needsUpdate = true;
    this.geometry.computeBoundingBox();
    this.geometry.computeBoundingSphere();
  }
}

function copyMatrix12(target, source) {
  for (let index = 0; index < 12; index++) target[index] = source[index];
}

/** Multiply two row-major 3x4 affine matrices with release float32 rounding. */
function multiplyMatrix12(output, left, right) {
  for (let row = 0; row < 3; row++) {
    for (let column = 0; column < 3; column++)
      output[row * 4 + column] = f32(
        f32(f32(left[row * 4] * right[column]) +
          f32(left[row * 4 + 1] * right[4 + column])) +
          f32(left[row * 4 + 2] * right[8 + column]));
    output[row * 4 + 3] = f32(
      f32(f32(f32(left[row * 4] * right[3]) +
        f32(left[row * 4 + 1] * right[7])) +
        f32(left[row * 4 + 2] * right[11])) + left[row * 4 + 3]);
  }
}

function paletteMatrix(palette, index, weight) {
  if (index < palette.length) return palette[index];
  if (weight === 0) return IDENTITY_BONE;
  throw new Error(`character skin palette index ${index} 越界且权重为 ${weight}。`);
}

function transformPosition(output, matrix, point) {
  for (let row = 0; row < 3; row++)
    output[row] = f32(f32(
      f32(f32(matrix[row * 4] * point[0]) +
        f32(matrix[row * 4 + 1] * point[1])) +
        f32(matrix[row * 4 + 2] * point[2])) + matrix[row * 4 + 3]);
}

function transformNormal(output, matrix, vector) {
  for (let row = 0; row < 3; row++)
    output[row] = f32(f32(
      f32(matrix[row * 4] * vector[0]) +
        f32(matrix[row * 4 + 1] * vector[1])) +
        f32(matrix[row * 4 + 2] * vector[2]));
}

function blendPosition(output, point, firstBone, secondBone,
  firstWeight, secondWeight, palette) {
  transformPosition(output, paletteMatrix(palette, firstBone, firstWeight), point);
  if (secondBone === 65535) return;
  transformPosition(secondaryPosition,
    paletteMatrix(palette, secondBone, secondWeight), point);
  for (let axis = 0; axis < 3; axis++)
    output[axis] = f32(f32(output[axis] * firstWeight) +
      f32(secondaryPosition[axis] * secondWeight));
}

function blendNormal(output, vector, firstBone, secondBone,
  firstWeight, secondWeight, palette) {
  transformNormal(output, paletteMatrix(palette, firstBone, firstWeight), vector);
  if (secondBone === 65535) return;
  transformNormal(secondaryNormal,
    paletteMatrix(palette, secondBone, secondWeight), vector);
  for (let axis = 0; axis < 3; axis++)
    output[axis] = f32(f32(output[axis] * firstWeight) +
      f32(secondaryNormal[axis] * secondWeight));
}
