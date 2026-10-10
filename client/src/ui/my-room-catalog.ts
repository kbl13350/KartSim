import { attribute, decodeBinaryXml, type BinaryXmlNode } from "../codecs/binary-xml";

export interface MyRoomEnvironment {
  id: number;
  resourceName: string;
  title: string;
  isDefault: boolean;
  /** Original room model scale applied when displaying karts. */
  scaleUpOnKart?: number;
  bgm?: string;
  bgmTheme?: string;
}

interface RoomResourceEntry {
  virtualPath: string;
  sourceName: string;
  bytes(): Promise<Uint8Array>;
}

export interface MyRoomResourceLibrary {
  files: readonly RoomResourceEntry[];
}

function resource(library: MyRoomResourceLibrary, name: string): RoomResourceEntry {
  const suffix = `/common/${name}`.toLowerCase();
  const matches = library.files.filter(entry =>
    entry.sourceName.toLowerCase() === "myroom.rho" &&
    entry.virtualPath.toLowerCase().endsWith(suffix));
  if (matches.length !== 1) {
    throw new Error(`小屋原版资源 ${name} 缺失或不唯一。`);
  }
  return matches[0]!;
}

/** Match the original room IDs to the Chinese titles shipped in myRoom.rho. */
export function parseMyRoomCatalog(rooms: BinaryXmlNode,
  locale: BinaryXmlNode): MyRoomEnvironment[] {
  if (rooms.name !== "myRoomList" || locale.name !== "myRoomList") {
    throw new Error("小屋场景清单格式无效。");
  }
  const titles = new Map<number, { title: string; isDefault: boolean;
    bgm?: string; bgmTheme?: string }>();
  for (const node of locale.children) {
    if (node.name !== "myRoom") continue;
    const id = Number(attribute(node, "id"));
    const title = attribute(node, "title")?.trim();
    if (!Number.isInteger(id) || id < 0 || id > 65535 || !title || titles.has(id)) {
      throw new Error("小屋中文环境清单含无效或重复 ID。");
    }
    titles.set(id, { title, isDefault: attribute(node, "default") === "true",
      bgm: attribute(node, "bgm"), bgmTheme: attribute(node, "bgmTheme") });
  }
  const seen = new Set<number>();
  const environments: MyRoomEnvironment[] = [];
  for (const node of rooms.children) {
    if (node.name !== "myRoom") continue;
    const id = Number(attribute(node, "id"));
    const name = attribute(node, "name");
    if (!Number.isInteger(id) || id < 0 || id > 65535 ||
        !name || !/^[A-Za-z0-9_]+$/.test(name) || seen.has(id)) {
      throw new Error("小屋场景清单含无效或重复 ID。");
    }
    seen.add(id);
    const localized = titles.get(id);
    const rawScale = attribute(node, "scaleUpOnKart");
    const scaleUpOnKart = rawScale === undefined ? undefined : Number(rawScale);
    if (rawScale !== undefined && (!Number.isFinite(scaleUpOnKart) ||
        scaleUpOnKart! <= 0)) {
      throw new Error("小屋背景包含无效的车辆显示比例。");
    }
    if (localized) environments.push({ id, resourceName: name,
      title: localized.title, isDefault: localized.isDefault,
      ...(scaleUpOnKart === undefined ? {} : { scaleUpOnKart }),
      ...(localized.bgm === undefined ? {} : { bgm: localized.bgm }),
      ...(localized.bgmTheme === undefined ? {} : { bgmTheme: localized.bgmTheme }),
    });
  }
  if (environments.length === 0 || environments.filter(item => item.isDefault).length !== 1) {
    throw new Error("小屋清单缺少唯一的默认中文场景。");
  }
  return environments;
}

export async function loadMyRoomCatalog(library: MyRoomResourceLibrary): Promise<MyRoomEnvironment[]> {
  const [rooms, locale] = await Promise.all([
    resource(library, "myRoom.bml").bytes(),
    resource(library, "myRoomLocale@cn.bml").bytes(),
  ]);
  const configured = parseMyRoomCatalog(decodeBinaryXml(rooms), decodeBinaryXml(locale));
  const models = new Set(library.files
    .filter(entry => entry.sourceName.toLowerCase() === "myroom.rho" &&
      entry.virtualPath.toLowerCase().endsWith("/track.1s"))
    .map(entry => entry.virtualPath.toLowerCase()));
  const available = configured.filter(room => [...models].some(path =>
    path.endsWith(`/${room.resourceName.toLowerCase()}/track.1s`)));
  if (!available.some(room => room.isDefault)) {
    throw new Error("小屋默认场景模型缺失。");
  }
  return available;
}
