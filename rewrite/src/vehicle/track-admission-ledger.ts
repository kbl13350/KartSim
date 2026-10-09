import {
  admitItemGameTrackObject, admitTrackObject, type TrackAdmissionOps, type TrackObjectOccurrence,
} from "./track-object-admission";

export interface TrackAdmissionOptions {
  weather?: {
    rainEnabled?: boolean;
    rainOnStart?: unknown;
    lightningSound?: unknown;
    snowEnabled?: boolean;
  };
  warp?: { inType?: string };
  p3553CourseSound?: boolean;
  lteCoins?: boolean;
  /** Item race on the speed-individual path: admit cubes and item hazards. */
  itemGame?: boolean;
}

export interface TrackAdmissionModel {
  root: {
    kind: string;
    trackObjects: { kind: string; name: string }[];
    trackObjectOccurrences?: TrackObjectOccurrence[];
    scene: unknown;
  };
}

export interface RoadDescriptorUse {
  descriptor: {
    texture: { encoding: unknown; id: unknown };
    property: { id: unknown };
  };
  mesh: { node: { className: string; name: string } };
}

export interface TrackLedgerOps extends TrackAdmissionOps {
  routeSurfaceKind(surface: string): string | undefined;
  descriptorUses(scene: unknown): { descriptorUses: RoadDescriptorUse[] };
  isDeferredRoad(descriptor: RoadDescriptorUse["descriptor"]): boolean;
  unsupportedRoad(descriptor: RoadDescriptorUse["descriptor"], mesh: RoadDescriptorUse["mesh"]): string | undefined;
}

export interface TrackAdmissionLedger {
  mode: string;
  source: unknown;
  records: any[];
}

const individualRouteTags = new Set([
  "start", "end", "branch", "15", "raiil", "zoom20.100", "zoom20.050",
  "lensflare", "norain", "nosnow", "rail, norain", "flash", "warpnext",
]);

/** Speed individual only dispatches the finite route-tag grammar supported by the release. */
export function isIndividualRouteTag(surface: string): boolean {
  return individualRouteTags.has(surface) || /^shake\d+,\d+$/.test(surface) ||
    /^wave\d+,\d+,\d+,\d+\s*$/.test(surface) ||
    /^zoom(?:Out|In)\d{2}.\d{3}$/.test(surface);
}

export function flashRouteRecord(road: TrackObjectOccurrence, roadIndex: number,
  recordIndex: number, source: unknown, mode: string) {
  return {
    occurrence: {
      kind: "route-surface", index: roadIndex, encoding: road.encoding, objectId: road.id,
      className: road.value.kind, name: road.value.name, detail: `${recordIndex}:flash`,
    },
    mode, source,
    producer: "TRACKDATA#TRK-COURSE ToRoadRecord.surfaceTag",
    consumer: "BEC9F0 -> 1006EC0 -> process FactorRegistry key 5",
    owner: "process FactorRegistry LightFactor singleton",
    lifecycle: "four suffixes activate; one update per race frame including pause; accepted first-process zero fields",
    order: "kart slot12 后，stage publication 前",
    decision: "admit", reason: "route-event-flash",
  };
}

/** Make one route-surface ledger entry with the exact owner and reason chosen by v39.11. */
export function routeSurfaceRecord(
  road: TrackObjectOccurrence,
  roadIndex: number,
  recordIndex: number,
  surface: string,
  mode: string,
  source: unknown,
  lensFlareCount: number,
  options: TrackAdmissionOptions,
  ops: Pick<TrackLedgerOps, "routeSurfaceKind">,
) {
  const classify = mode === "time-attack" ||
    (mode === "speed-individual" && isIndividualRouteTag(surface));
  const kind = classify ? ops.routeSurfaceKind(surface) : undefined;
  if (kind === "flash") return flashRouteRecord(road, roadIndex, recordIndex, source, mode);

  const empty = surface.length === 0;
  const rail = surface === "rail";
  const rain = kind === "rain";
  const snow = kind === "snow";
  const railRain = kind === "rail-rain";
  const rainOwner = !!options.weather?.rainEnabled;
  const snowOwner = !!options.weather?.snowEnabled;
  const noop = kind === "noop";
  const warp = kind === "warpnext";
  const shake = kind === "shake";
  const wave = kind === "wave";
  const zoom = kind === "zoom";
  const lensFlare = kind === "lensflare";
  const uniqueLensFlare = lensFlareCount === 1;

  let consumer: string;
  if (empty || noop) consumer = "无 TimeAttack consumer";
  else if (lensFlare) consumer = uniqueLensFlare
    ? "BEC9F0 -> GameStage +0x944 -> ReLensFlare toggle"
    : "BEC9F0 lensflare owner guard miss";
  else if (snow) consumer = snowOwner ? "BEC9F0 -> ReSnow toggle"
    : "BEC9F0 snow owner guard miss";
  else if (railRain) consumer = rainOwner
    ? "BEC9F0 rail consumer then ReRain toggle + surround rain cue"
    : "BEC9F0 rail consumer; rain owner guard miss";
  else if (rain) consumer = rainOwner ? "BEC9F0 -> ReRain toggle + surround rain cue"
    : "BEC9F0 rain owner guard miss";
  else if (warp) consumer = "BEC9F0 -> C02310 warpnext state machine";
  else if (shake) consumer = "BEC9F0 -> B87CA0 / B854F0 -> B87050 DriveCameraman shake";
  else if (wave) consumer = "BEC9F0 -> C0CEA0 / B854F0 -> B87580 DriveCameraman wave";
  else if (zoom) consumer = "DriveCameraman currentRouteSurface -> consumeRouteSurface zoom";
  else consumer = "DRIVING#DRV-RAIL A79DB0 -> GoEventService";

  let lifecycle: string;
  if (empty) lifecycle = "省略";
  else if (noop) lifecycle = "BEC9F0 finite dispatch miss";
  else if (lensFlare) lifecycle = uniqueLensFlare
    ? "route in启用/out禁用 ReLensFlare lifecycle已闭合"
    : "exact ToDummy owner缺失后的有限分派miss";
  else if (rail) lifecycle = "exact rail listener 已闭合";
  else if (snow) lifecycle = snowOwner
    ? "route in关闭/out恢复 ReSnow lifecycle已闭合"
    : "snow handle=-1后有限分派miss";
  else if (railRain) lifecycle = rainOwner
    ? "同一tag先执行rail，再执行owner-backed norain lifecycle"
    : "rail已执行；rain handle=-1后有限分派miss";
  else if (rain) lifecycle = rainOwner
    ? "route in关闭/out恢复 + loop gain 0.2/1.0 + 비소리작아짐 cue 已闭合"
    : "rain handle=-1后有限分派miss";
  else if (warp) lifecycle = options.warp?.inType === "fairy"
    ? "fairy立即传送、Drive reset与outTime/FOV phase已闭合；+ED仅强制boostBlur eligibility"
    : "普通500/2500/3000/4000ms动作已闭合；500ms camera缺失时fail-closed";
  else if (shake) lifecycle = "nested route gate + strict 10ms CRT-random camera offset 已闭合";
  else if (wave) lifecycle = "route D1 toggle + native sine/axis/duration lifecycle 已闭合";
  else if (zoom) lifecycle = "DriveCameraman consumes current route surface every local camera update";
  else lifecycle = "listener 未闭合";

  const decision = empty ? "omit" :
    rail || rain || snow || railRain || noop || warp || shake || wave || zoom ||
      (lensFlare && lensFlareCount <= 1) ? "admit" : "block";
  let reason: string;
  if (empty) reason = "route-event-empty";
  else if (rail) reason = "route-event-rail";
  else if (railRain) reason = rainOwner ? "route-event-rail-rain" : "route-event-rail";
  else if (rain) reason = rainOwner ? "route-event-rain" : "route-event-noop";
  else if (snow) reason = snowOwner ? "route-event-snow" : "route-event-noop";
  else if (noop) reason = "route-event-noop";
  else if (warp) reason = "route-event-warpnext";
  else if (shake) reason = "route-event-shake";
  else if (wave) reason = "route-event-wave";
  else if (zoom) reason = "route-event-zoom";
  else if (lensFlare && uniqueLensFlare) reason = "route-event-lensflare";
  else if (lensFlare && lensFlareCount === 0) reason = "route-event-noop";
  else reason = "route-event-listener-unclosed";

  return {
    occurrence: {
      kind: "route-surface", index: roadIndex, encoding: road.encoding,
      objectId: road.id, className: road.value.kind, name: road.value.name,
      detail: `${recordIndex}:${surface}`,
    },
    mode, source,
    producer: "TRACKDATA#TRK-COURSE ToRoadRecord.surfaceTag",
    consumer,
    owner: "GoCourse RouteSection",
    lifecycle,
    order: "kart slot12 后，stage publication 前",
    decision,
    reason,
  };
}

/** Build the ordered admission ledger for a parsed TrackContainer. */
export function buildTrackAdmissionLedger(
  model: TrackAdmissionModel,
  source: unknown,
  mode: string,
  options: TrackAdmissionOptions = {},
  ops: TrackLedgerOps,
): TrackAdmissionLedger {
  if (model.root.kind !== "track")
    throw new Error("standalone Relement 不含 TrackObject runtime occurrence。");
  const occurrences = model.root.trackObjectOccurrences;
  if (!occurrences || occurrences.length !== model.root.trackObjects.length)
    throw new Error("TrackContainer 缺少完整 Object47 occurrence provenance。");
  const itemGame = options.itemGame === true;
  if (itemGame && (mode !== "speed-individual" || options.lteCoins === true))
    throw new Error("道具赛准入只用于 speed-individual 多人赛道。");
  const records: any[] = [];
  const lensFlareCount = model.root.trackObjects.filter(object =>
    object.kind === "ToDummy" && object.name === "lensflare").length;

  if ((mode === "time-attack" || mode === "speed-individual") && options.weather?.rainEnabled) {
    records.push({
      occurrence: { kind: "weather", index: -1, className: "ReRain", name: "rainEffect",
        detail: `onStart=${options.weather.rainOnStart}` },
      mode, source,
      producer: "track.bml rainEffect enable/onStart",
      consumer: "BE7A70 -> ReRain / BEC9F0 norain",
      owner: "GameStage ReRain handle +0x740",
      lifecycle: "200-slot screen quad update/render + route toggle 已闭合",
      order: "stage weather construction 后，route listener 前",
      decision: options.weather.lightningSound === undefined ? "admit" : "block",
      reason: options.weather.lightningSound === undefined
        ? "weather-rain-admitted" : "weather-rain-audio-unclosed",
    });
  }
  if ((mode === "time-attack" || mode === "speed-individual") && options.weather?.snowEnabled) {
    records.push({
      occurrence: { kind: "weather", index: -2, className: "ReSnow", name: "snow",
        detail: "seasonal xmas variant" },
      mode, source,
      producer: "BE7A70 ice seasonal selector -> xmas resource suffix",
      consumer: "BE7A70 -> ReSnow / BEC9F0 nosnow",
      owner: "GameStage ReSnow handle +0x73C",
      lifecycle: "200-slot textured screen quad update/render + route toggle 已闭合",
      order: "stage snow construction 后，route listener 前",
      decision: "admit", reason: "weather-snow-admitted",
    });
  }

  for (const [index, occurrence] of occurrences.entries()) {
    records.push(itemGame
      ? admitItemGameTrackObject(occurrence, index, source, lensFlareCount,
        options.p3553CourseSound === true, ops)
      : admitTrackObject(occurrence, index, mode, source,
        lensFlareCount, options.p3553CourseSound === true, options.lteCoins === true, ops));
    if (occurrence.value.kind !== "ToRoad") continue;
    const road = occurrence.value as TrackObjectOccurrence["value"] &
      { records: { surface: string }[] };
    for (const [recordIndex, record] of road.records.entries()) {
      records.push(routeSurfaceRecord(occurrence, index, recordIndex,
        record.surface, mode, source, lensFlareCount, options, ops));
    }
  }

  const uses = ops.descriptorUses(model.root.scene).descriptorUses;
  for (const [index, use] of uses.entries()) {
    const deferred = ops.isDeferredRoad(use.descriptor);
    const unsupported = ops.unsupportedRoad(use.descriptor, use.mesh);
    records.push({
      occurrence: {
        kind: "road-descriptor", index,
        encoding: use.descriptor.texture.encoding, objectId: use.descriptor.texture.id,
        className: use.mesh.node.className, name: use.mesh.node.name,
        detail: `Typed27:${use.descriptor.property.id}${unsupported ? `;${unsupported}` : ""}`,
      },
      mode, source,
      producer: "TRACKDATA#TRK-ROAD TexProperty/BinaryXML direct road",
      consumer: unsupported ? "未闭合" : deferred
        ? "DRIVING#DRV-MOVING A84A60 tracked-road update and query"
        : "DRIVING#DRV-ROAD GoTrack collision and road consumers",
      owner: "GoTrack descriptor and triangle registration",
      lifecycle: unsupported ? "阻断" : "setup registration -> track destruction",
      order: unsupported ? "未闭合" : deferred
        ? "GoTrack slot12 uses previous scene traversal before kart slot12"
        : "GoTrack query before kart collision response",
      decision: unsupported ? "block" : "admit",
      reason: unsupported ? "road-descriptor-unclosed" : "road-descriptor-admitted",
    });
  }
  return { mode, source, records };
}
