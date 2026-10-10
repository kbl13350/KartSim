import type { CoinPosition } from "./track-coin";

export interface XmlNode {
  name: string;
  children: XmlNode[];
}

export interface CoinXmlReader<Input> {
  parse(input: Input): XmlNode;
  attribute(node: XmlNode, name: string): string | undefined;
}

export interface TrackCoinResources {
  radius: number;
  stayModel: string;
  eatenModel: string;
  eatenLifeMs: number;
  waitLifeMs: number;
  audioStem: string;
}

/** Parse item/lucci/item.bml into the models and timing used by LTE coins. */
export function parseTrackCoinResources<Input>(input: Input, xml: CoinXmlReader<Input>): TrackCoinResources {
  const root = xml.parse(input);
  const attribute = xml.attribute;
  if (root.name !== "item" || attribute(root, "name") !== "lucci") {
    throw Error("地图金币需要 item/lucci/item.bml。");
  }
  const states = root.children.filter(child => child.name === "state");
  const [stay, eaten, wait] = states;
  if (!stay || !eaten || !wait
    || attribute(stay, "name") !== "Stay"
    || attribute(eaten, "name") !== "Eaten"
    || attribute(wait, "name") !== "Wait"
    || attribute(stay, "life") !== "0") {
    throw Error("地图金币 base-0 状态不完整。");
  }
  const decimal = (value: string | undefined, field: string): number => {
    if (!value || !/^\d+(?:\.\d+)?$/.test(value)) throw Error(`地图金币 ${field} 无效。`);
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) throw Error(`地图金币 ${field} 越界。`);
    return parsed;
  };
  const model = (stem: string | undefined): string => {
    if (!stem || !/^\w+$/.test(stem)) throw Error("地图金币 model stem 无效。");
    return `item/lucci/${stem}.1s`;
  };
  const radius = Math.fround(decimal(attribute(stay, "size"), "size"));
  const eatenLifeMs = decimal(attribute(eaten, "life"), "Eaten.life");
  const waitLifeMs = decimal(attribute(wait, "life"), "Wait.life");
  const audioStem = attribute(eaten, "firedFx");
  if (radius <= 0
    || !Number.isSafeInteger(eatenLifeMs) || eatenLifeMs <= 0
    || !Number.isSafeInteger(waitLifeMs) || waitLifeMs <= 0
    || !audioStem) {
    throw Error("地图金币期限或音源无效。");
  }
  return {
    radius,
    stayModel: model(attribute(stay, "item")),
    eatenModel: model(attribute(eaten, "fired")),
    eatenLifeMs,
    waitLifeMs,
    audioStem,
  };
}

export interface CoinArchiveEntry<Bytes> {
  absenceAuthoritative?: boolean;
  bytes(): Promise<Bytes>;
}

export interface CoinArchive<Bytes> {
  exactCanonicalCandidates(path: string): CoinArchiveEntry<Bytes>[];
}

export function uniqueOriginalCoinAsset<Bytes>(archive: CoinArchive<Bytes>, path: string): CoinArchiveEntry<Bytes> {
  const candidates = archive.exactCanonicalCandidates(path);
  if (candidates.length !== 1 || candidates[0]!.absenceAuthoritative !== true) {
    throw Error(`${path} 需要唯一完整原件。`);
  }
  return candidates[0]!;
}

export interface CoinTrackObject {
  kind: string;
  name: string;
  instanceOrdinal?: number;
  transform: { position: number[] };
}

export interface CoinTrackData {
  root: { kind: string; trackObjects: CoinTrackObject[] };
}

export interface TrackCoinDescriptor {
  name: string;
  ordinal: number;
  position: CoinPosition;
}

/** Load one resource table and enumerate validated ToLucci instances on a track. */
export async function loadTrackCoinSource<Bytes>(
  archive: CoinArchive<Bytes>,
  track: CoinTrackData,
  parseResources: (bytes: Bytes) => TrackCoinResources,
): Promise<{ resources: TrackCoinResources; coins: TrackCoinDescriptor[] }> {
  if (track.root.kind !== "track") throw Error("LTE 金币缺少赛道根。");
  const coins: TrackCoinDescriptor[] = [];
  const seenOrdinals = new Set<number>();
  for (const object of track.root.trackObjects) {
    if (object.kind !== "ToLucci") continue;
    const ordinal = object.instanceOrdinal;
    if (ordinal === undefined || seenOrdinals.has(ordinal)) {
      throw Error(`LTE 金币 ${object.name} 缺少唯一原件序号。`);
    }
    seenOrdinals.add(ordinal);
    const position = object.transform.position;
    if (!position.every(Number.isFinite)) throw Error(`LTE 金币 ${object.name} 坐标无效。`);
    coins.push({
      name: object.name,
      ordinal,
      position: { x: position[0]!, y: position[2]!, z: -position[1]! },
    });
  }
  const bytes = await uniqueOriginalCoinAsset(archive, "item/lucci/item.bml").bytes();
  return { resources: parseResources(bytes), coins };
}
