/** Object47 and Typed27 reference graph reader for model.1s. */

import type { ModelBinaryCursor } from "./model-binary-cursor";

export type ModelReadReference = {
  encoding: "new" | "reference";
  id: number;
  value: unknown;
};

type Decoder = (cursor: ModelBinaryCursor, reader: ModelObjectReader) => unknown;

export interface ModelObjectDecoders {
  readElement(cursor: ModelBinaryCursor, reader: ModelObjectReader, name: string): unknown;
  decodeKart: Decoder;
  decodeRigid: Decoder;
  decodeTriangles: Decoder;
  decodeSkinned: Decoder;
  decodeCharacter: Decoder;
  decodeAlpha: Decoder;
  decodeZBuffer: Decoder;
  decodePrs: Decoder;
  decodeVisibility: Decoder;
  decodePath: Decoder;
  decodeKartSequence: Decoder;
  decodeCharacterSequence: Decoder;
  decodeInteger: Decoder;
}

const objectNewMarker = 18346;
const objectReferenceMarker = 18363;
const typedNewMarker = 10154;
const typedReferenceMarker = 10171;
const objectLimit = 200_000;
const nestingLimit = 256;

/** Class stamps captured from the original KartRider model serializer. */
export const modelClassStamps = {
  RePet2: 124650002,
  PetSequence: 432604258,
  ReKart: 126616137,
  Relement: 235340604,
  ReToonRigid: 422184006,
  ReTriList: 282329986,
  ReToonSkinned: 590546211,
  ReCharacter: 409928772,
  AlphaProperty: 593036619,
  ZBufProperty: 501810396,
  PrsTontroller: 575341866,
  VisTontroller: 621610343,
  PathTontroller: 706020803,
  TontrollerGroup: 833422914,
  KartSequence: 512361675,
  CharSequence: 498795703,
  IntTontroller: 615187808,
} as const;

function decoderTable(deps: ModelObjectDecoders): Map<number, Decoder> {
  const stamps = modelClassStamps;
  return new Map<number, Decoder>([
    [stamps.RePet2, (cursor, reader) => ({
      ...deps.readElement(cursor, reader, "RePet2") as Record<string, unknown>,
      className: "RePet2", sortDepthBias: cursor.float32(),
    })],
    [stamps.PetSequence, (cursor, reader) => {
      const header = [cursor.uint32(), cursor.uint32(), cursor.uint32()];
      const channels = Array.from({ length: cursor.count32("pet channels", 10_000) },
        () => reader.readObject(cursor));
      const rootChannel = reader.readObject(cursor);
      const map = Array.from({ length: cursor.count32("pet texture slots", 1_000_000) },
        () => cursor.uint32());
      return { className: "PetSequence", header, channels, rootChannel, map };
    }],
    [stamps.ReKart, deps.decodeKart],
    [stamps.Relement, (cursor, reader) => deps.readElement(cursor, reader, "Relement")],
    [stamps.ReToonRigid, deps.decodeRigid],
    [stamps.ReTriList, deps.decodeTriangles],
    [stamps.ReToonSkinned, deps.decodeSkinned],
    [stamps.ReCharacter, deps.decodeCharacter],
    [stamps.AlphaProperty, deps.decodeAlpha],
    [stamps.ZBufProperty, deps.decodeZBuffer],
    [stamps.PrsTontroller, deps.decodePrs],
    [stamps.VisTontroller, deps.decodeVisibility],
    [stamps.PathTontroller, deps.decodePath],
    [stamps.TontrollerGroup, cursor => ({ className: "TontrollerGroup", value: cursor.string() })],
    [stamps.KartSequence, deps.decodeKartSequence],
    [stamps.CharSequence, deps.decodeCharacterSequence],
    [stamps.IntTontroller, deps.decodeInteger],
  ]);
}

export class ModelObjectReader {
  readonly objects = new Map<number, unknown>();
  readonly typed = new Map<number, unknown>();
  readonly objectIds = new Set<number>();
  readonly typedIds = new Set<number>();
  objectDepth = 0;
  readonly decoders: Map<number, Decoder>;

  constructor(deps: ModelObjectDecoders) {
    this.decoders = decoderTable(deps);
  }

  readObject(cursor: ModelBinaryCursor): ModelReadReference {
    const start = cursor.position;
    const marker = cursor.uint16();
    if (marker === objectReferenceMarker) {
      const id = cursor.uint16();
      const value = this.objects.get(id);
      if (!value)
        throw new Error(`model.1s 在 0x${start.toString(16)} 引用了未知 Object47 ID ${id}。`);
      return { encoding: "reference", id, value };
    }
    if (marker !== objectNewMarker)
      throw new Error(`model.1s 在 0x${start.toString(16)} 的 Object47 marker 0x${marker.toString(16)} 无效。`);
    const stamp = cursor.uint32();
    const id = cursor.uint16();
    if (this.objectIds.has(id)) throw new Error(`model.1s 含重复 Object47 ID ${id}。`);
    if (this.objectIds.size >= objectLimit)
      throw new Error("model.1s 对象数量超过安全上限。");
    this.objectIds.add(id);
    const decoder = this.decoders.get(stamp);
    if (!decoder) throw new Error(`model.1s 不支持 ClassStamp 0x${stamp.toString(16)}。`);
    if (this.objectDepth >= nestingLimit)
      throw new Error("model.1s 对象嵌套超过安全上限。");
    this.objectDepth += 1;
    let value: unknown;
    try { value = decoder(cursor, this); }
    finally { this.objectDepth -= 1; }
    this.objects.set(id, value);
    return { encoding: "new", id, value };
  }

  readTyped(cursor: ModelBinaryCursor, decoder: Decoder): ModelReadReference {
    const start = cursor.position;
    const marker = cursor.uint16();
    if (marker === typedReferenceMarker) {
      const id = cursor.uint16();
      if (!this.typed.has(id))
        throw new Error(`model.1s 在 0x${start.toString(16)} 引用了未知 Typed27 ID ${id}。`);
      return { encoding: "reference", id, value: this.typed.get(id) };
    }
    if (marker !== typedNewMarker)
      throw new Error(`model.1s 在 0x${start.toString(16)} 的 Typed27 marker 0x${marker.toString(16)} 无效。`);
    const id = cursor.uint16();
    if (this.typedIds.has(id)) throw new Error(`model.1s 含重复 Typed27 ID ${id}。`);
    this.typedIds.add(id);
    const value = decoder(cursor, this);
    this.typed.set(id, value);
    return { encoding: "new", id, value };
  }
}
