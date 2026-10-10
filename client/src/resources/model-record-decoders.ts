/** Payload decoders registered by the model.1s Object47 reader. */

import type { ModelBinaryCursor } from "./model-binary-cursor";
import type { ModelObjectDecoders, ModelObjectReader } from "./model-object-reader";

const maximumObjects = 200_000;
const maximumRigidVertices = 2_000_000;
const maximumRigidFaces = 4_000_000;

export function validateModelIndex(index: number, length: number, label: string): void {
  if (index >= length) throw new Error(`${label}索引 ${index} 越界。`);
}

export function isModelElement(value: { className?: string }): boolean {
  return value.className === "ReKart" || value.className === "Relement" ||
    value.className === "ReCharacter" || value.className === "RePet2" ||
    value.className === "ReToonRigid" || value.className === "ReTriList" ||
    value.className === "ReToonSkinned";
}

export function readModelElement(cursor: ModelBinaryCursor, reader: ModelObjectReader,
  className: string, readAdditionalProperty: (cursor: ModelBinaryCursor) => unknown) {
  const name = cursor.string();
  const childCount = cursor.count32("子节点", maximumObjects);
  const children = Array.from({ length: childCount }, () => reader.readObject(cursor));
  const transform = {
    basis: [cursor.vec3(), cursor.vec3(), cursor.vec3()],
    translation: cursor.vec3(), scale: cursor.vec3(),
  };
  const bounds0 = cursor.bounds();
  const serializedBoundsOverride = cursor.uint8();
  const cullingTraversalMode = cursor.uint32();
  const bounds1 = cursor.bounds();
  const rawScalar = cursor.float32();
  const nodeEnabled = cursor.uint8();
  const slots = Array.from({ length: 11 }, () =>
    cursor.uint8() !== 0 ? reader.readObject(cursor) : undefined);
  const additionalProperty = cursor.uint8() !== 0
    ? reader.readTyped(cursor, item => readAdditionalProperty(item)) : undefined;
  return { className, name, children, transform, bounds0,
    serializedBoundsOverride, cullingTraversalMode, bounds1, rawScalar,
    nodeEnabled, slots, additionalProperty };
}

export function readSkinnedGeometry(cursor: ModelBinaryCursor) {
  const vertices = Array.from({ length: cursor.count32("skin vertices", 65535) }, () => ({
    position: cursor.vec3(), normal: cursor.vec3(), bone0: cursor.uint16(),
    bone1: cursor.uint16(), weight0: cursor.float32(), weight1: cursor.float32(),
  }));
  const wedges = Array.from({ length: cursor.count32("skin wedges", 65535) }, () => ({
    skinVertexIndex: cursor.uint32(), u: cursor.float32(), v: cursor.float32(),
  }));
  const triangles = Array.from({ length: cursor.count32("skin triangles", 65535) }, () => {
    const wedgeIndices = cursor.uint16Triple();
    const unknown06 = cursor.bytes(6);
    const adjacent = new DataView(unknown06.buffer, unknown06.byteOffset, unknown06.byteLength);
    return {
      wedgeIndices, unknown06,
      adjacentTriangleIndices: [adjacent.getUint16(0, true),
        adjacent.getUint16(2, true), adjacent.getUint16(4, true)],
      positionIndices: cursor.uint16Triple(), winding: cursor.uint8(),
      unknown13: cursor.uint8(),
    };
  });
  const bones = Array.from({ length: cursor.count32("skin bones", 65535) }, () => ({
    inverseBind: Array.from({ length: 12 }, () => cursor.float32()),
    localBind: Array.from({ length: 12 }, () => cursor.float32()),
    parentIndex: cursor.uint16(), enabled: cursor.uint8(), reserved: cursor.uint8(),
  }));
  wedges.forEach((wedge, index) =>
    validateModelIndex(wedge.skinVertexIndex, vertices.length, `skin wedge ${index} vertex `));
  triangles.forEach((triangle, index) => {
    triangle.wedgeIndices.forEach(wedge =>
      validateModelIndex(wedge, wedges.length, `skin triangle ${index} wedge `));
    triangle.positionIndices.forEach(vertex =>
      validateModelIndex(vertex, vertices.length, `skin triangle ${index} position `));
    triangle.adjacentTriangleIndices.forEach(adjacent => {
      if (adjacent !== 65535)
        validateModelIndex(adjacent, triangles.length, `skin triangle ${index} adjacent `);
    });
  });
  return { vertices, wedges, triangles, bones };
}

export function readRigidGeometry(cursor: ModelBinaryCursor) {
  const positions = cursor.vec3Array(cursor.count32("刚性顶点", maximumRigidVertices));
  const normals = cursor.vec3Array(cursor.count32("刚性法线", maximumRigidVertices));
  const textureCount = cursor.count32("刚性纹理坐标", maximumRigidVertices * 3);
  const texcoords = Array.from({ length: textureCount }, () => ({
    rawWord: cursor.uint16(), normalIndex: cursor.uint16(),
    u: cursor.float32(), v: cursor.float32(),
  }));
  const faceCount = cursor.count32("刚性面", maximumRigidFaces);
  const faces = Array.from({ length: faceCount }, () => ({
    texcoordIndices: cursor.uint16Triple(), adjacentFaceIndices: cursor.uint16Triple(),
    positionIndices: cursor.uint16Triple(), winding: cursor.uint8(),
    outlineOpenEdge: cursor.uint8(),
  }));
  texcoords.forEach((texcoord, index) => {
    if (texcoord.normalIndex >= normals.length)
      throw new Error(`刚性纹理坐标 ${index} 的法线索引越界。`);
  });
  faces.forEach((face, index) => {
    face.texcoordIndices.forEach(texture =>
      validateModelIndex(texture, texcoords.length, `刚性面 ${index} 的纹理坐标`));
    face.positionIndices.forEach(vertex =>
      validateModelIndex(vertex, positions.length, `刚性面 ${index} 的顶点`));
    face.adjacentFaceIndices.forEach(adjacent => {
      if (adjacent !== 65535)
        validateModelIndex(adjacent, faces.length, `刚性面 ${index} 的邻接面`);
    });
  });
  return { positions, normals, texcoords, faces };
}

export function readAuxiliaryGeometry(cursor: ModelBinaryCursor, reader: ModelObjectReader) {
  const vertexCount = cursor.count16("辅助模型顶点", 65535);
  const positions = cursor.uint8() !== 0 ? cursor.vec3Array(vertexCount) : undefined;
  const normals = cursor.uint8() !== 0 ? cursor.vec3Array(vertexCount) : undefined;
  const diffuseColors = cursor.uint8() !== 0
    ? Array.from({ length: vertexCount }, () => cursor.uint32()) : undefined;
  const uvSetsPerVertex = cursor.count16("每顶点 UV 集", 16);
  const uvs = Array.from({ length: vertexCount }, () =>
    Array.from({ length: uvSetsPerVertex }, () => cursor.vec2()));
  const property = cursor.uint8() !== 0 ? reader.readObject(cursor) : undefined;
  const indexCount = cursor.count16("辅助模型索引", 65535);
  const indices = Array.from({ length: indexCount }, () => cursor.uint16());
  indices.forEach((index, slot) => validateModelIndex(index, vertexCount, `辅助模型索引 ${slot}`));
  return { vertexCount, positions, normals, diffuseColors,
    uvSetsPerVertex, uvs, property, indices };
}

export function readAlphaProperty(cursor: ModelBinaryCursor) {
  return { className: "AlphaProperty", blendEnable: cursor.uint8(),
    srcBlend: cursor.uint32(), dstBlend: cursor.uint32(),
    alphaTestEnable: cursor.uint8(), alphaFunc: cursor.uint32(),
    alphaRef: cursor.uint8() };
}

export function readZBufferProperty(cursor: ModelBinaryCursor) {
  return { className: "ZBufProperty", mode: cursor.uint32(), enabled: cursor.uint8() };
}

export function readControllerBase(cursor: ModelBinaryCursor) {
  return { controllerBaseWord0: cursor.uint32(), cycleMode: cursor.uint32(),
    readerDiscardedWords: [cursor.uint32(), cursor.uint32()],
    frequency: cursor.float32(), phase: cursor.uint32(),
    startTimeWord: cursor.uint32(), stopTimeWord: cursor.uint32() };
}

export function readKartSequence(cursor: ModelBinaryCursor, reader: ModelObjectReader) {
  const cachedMinimum = cursor.uint32();
  const cachedMaximum = cursor.uint32();
  const cachedSpan = cursor.uint32();
  const channels = Array.from({ length: 55 }, (_, index) => {
    const prs = reader.readObject(cursor);
    const visibility = reader.readObject(cursor);
    if ((prs.value as { className?: string }).className !== "PRSTontroller")
      throw new Error(`KartSequence 通道 ${index} 的首对象不是 PRSTontroller。`);
    if ((visibility.value as { className?: string }).className !== "VisTontroller")
      throw new Error(`KartSequence 通道 ${index} 的次对象不是 VisTontroller。`);
    return { prs, visibility };
  });
  return { className: "KartSequence", cachedMinimum, cachedMaximum, cachedSpan, channels };
}

export function readCharacterSequence(cursor: ModelBinaryCursor, reader: ModelObjectReader) {
  const header = [cursor.uint32(), cursor.uint32(), cursor.uint32()];
  const channels = Array.from({ length: 24 }, () => reader.readObject(cursor));
  const rootChannel = reader.readObject(cursor);
  const map = Array.from({ length: cursor.count32("character animation map", 1_000_000) },
    () => cursor.uint32());
  return { className: "CharSequence", header, channels, rootChannel, map };
}

export type ModelKeyCategory = "float" | "vec3" | "rotation" | "visibility" | "integer";
const keyRecordSize: Record<ModelKeyCategory, Record<number, number>> = {
  float: { 0: 16, 1: 8, 2: 20, 3: 8 },
  vec3: { 0: 40, 1: 16, 2: 28, 3: 16 },
  rotation: { 0: 20, 1: 20, 2: 32, 3: 20 },
  visibility: { 3: 5 }, integer: { 3: 8 },
};

export function readModelKeys(cursor: ModelBinaryCursor, category: ModelKeyCategory): unknown {
  const keyType = cursor.uint32();
  const declaredCount = cursor.count32(`${category} 关键帧`, 1_000_000);
  if (category === "vec3" && keyType === 5) {
    const header = Array.from({ length: 4 }, () => cursor.uint32());
    return { kind: "composite", category, keyType, declaredCount, header,
      components: [readModelKeys(cursor, "float"), readModelKeys(cursor, "float"),
        readModelKeys(cursor, "float")] };
  }
  if (category === "rotation" && keyType === 4) {
    const header = Array.from({ length: 5 }, () => cursor.uint32());
    return { kind: "composite", category, keyType, declaredCount, header,
      components: [readModelKeys(cursor, "float"), readModelKeys(cursor, "float"),
        readModelKeys(cursor, "float")] };
  }
  const size = keyRecordSize[category][keyType];
  if (size === undefined) throw new Error(`${category} 不支持关键帧类型 ${keyType}。`);
  cursor.ensure(declaredCount * size);
  return { kind: "fixed", category, keyType, declaredCount,
    records: Array.from({ length: declaredCount }, () => cursor.bytes(size)) };
}

export function readPrsController(cursor: ModelBinaryCursor, reader: ModelObjectReader) {
  const base = readControllerBase(cursor);
  const position = cursor.uint8() !== 0
    ? reader.readTyped(cursor, item => readModelKeys(item, "vec3")) : undefined;
  const rotation = cursor.uint8() !== 0
    ? reader.readTyped(cursor, item => readModelKeys(item, "rotation")) : undefined;
  const scale = cursor.uint8() !== 0
    ? reader.readTyped(cursor, item => readModelKeys(item, "vec3")) : undefined;
  const firstLastCache = Array.from({ length: 6 }, () => cursor.uint32());
  return { className: "PRSTontroller", base, position, rotation, scale, firstLastCache };
}

export function readIntegerController(cursor: ModelBinaryCursor, reader: ModelObjectReader) {
  return { className: "IntTontroller", base: readControllerBase(cursor),
    keys: reader.readTyped(cursor, item => readModelKeys(item, "integer")) };
}

export function readVisibilityController(cursor: ModelBinaryCursor, reader: ModelObjectReader) {
  return { className: "VisTontroller", base: readControllerBase(cursor),
    visibility: reader.readTyped(cursor, item => readModelKeys(item, "visibility")) };
}

export function readPathController(cursor: ModelBinaryCursor, reader: ModelObjectReader) {
  const base = readControllerBase(cursor);
  const vec3Keys = cursor.uint8() !== 0
    ? reader.readTyped(cursor, item => readModelKeys(item, "vec3")) : undefined;
  const floatKeys = cursor.uint8() !== 0
    ? reader.readTyped(cursor, item => readModelKeys(item, "float")) : undefined;
  return { className: "PathTontroller", base, vec3Keys, floatKeys,
    tailDword0: cursor.uint32(), tailDword1: cursor.uint32(),
    tailWord0: cursor.uint16(), tailDword2: cursor.uint32(),
    tailWord1: cursor.uint16(), tailBytes: cursor.bytes(5) };
}

export function createModelRecordDecoders(
  readAdditionalProperty: (cursor: ModelBinaryCursor) => unknown): ModelObjectDecoders {
  const element = (cursor: ModelBinaryCursor, reader: ModelObjectReader, name: string) =>
    readModelElement(cursor, reader, name, readAdditionalProperty);
  return {
    readElement: element,
    decodeKart: (cursor, reader) => ({ ...element(cursor, reader, "ReKart"),
      sortDepthBias: cursor.float32(), rootBounds: cursor.bounds(),
      simpleShadow: [cursor.float32(), cursor.float32(), cursor.float32(), cursor.float32()] }),
    decodeRigid: (cursor, reader) => ({ ...element(cursor, reader, "ReToonRigid"),
      sortDepthBias: cursor.float32(),
      geometry: reader.readTyped(cursor, readRigidGeometry) }),
    decodeTriangles: (cursor, reader) => ({ ...element(cursor, reader, "ReTriList"),
      sortDepthBias: cursor.float32(),
      vertexData: reader.readTyped(cursor, readAuxiliaryGeometry) }),
    decodeSkinned: (cursor, reader) => {
      const base = element(cursor, reader, "ReToonSkinned");
      const sortDepthBias = cursor.float32();
      const geometry = reader.readTyped(cursor, readSkinnedGeometry);
      const secondaryReference = cursor.uint8() !== 0 ? reader.readObject(cursor) : undefined;
      return { ...base, sortDepthBias, geometry, secondaryReference };
    },
    decodeCharacter: (cursor, reader) => ({ ...element(cursor, reader, "ReCharacter"),
      characterScalar: cursor.float32() }),
    decodeAlpha: readAlphaProperty,
    decodeZBuffer: readZBufferProperty,
    decodePrs: readPrsController,
    decodeVisibility: readVisibilityController,
    decodePath: readPathController,
    decodeKartSequence: readKartSequence,
    decodeCharacterSequence: readCharacterSequence,
    decodeInteger: readIntegerController,
  };
}
