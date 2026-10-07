export interface TrackObjectOccurrence {
  encoding: unknown;
  id: unknown;
  value: {
    kind: string;
    name: string;
    property?: {
      children: { name: string; attributes: { name: string; value: string }[] }[];
    };
    [key: string]: unknown;
  };
}

export interface TrackAdmissionRecord {
  occurrence: {
    kind: "track-object";
    index: number;
    encoding: unknown;
    objectId: unknown;
    className: string;
    name: string;
    detail?: string;
  };
  mode: string;
  source: unknown;
  producer: string;
  consumer: string;
  owner: string;
  lifecycle: string;
  order: string;
  decision: "admit" | "omit" | "block";
  reason: string;
}

export interface TrackAdmissionOps {
  isItemOnlyMovable(value: TrackObjectOccurrence["value"]): boolean;
  admitObstacle(value: TrackObjectOccurrence["value"]): {
    status: string;
    reason?: string;
    hasPrs?: unknown;
    pressMode?: string;
    collisionTriangleCount?: number;
    markerProfile?: string[];
  };
  parseEvent(value: TrackObjectOccurrence["value"]): {
    status: string;
    reason?: string;
    prsNodes?: number;
    triangleCount?: number;
    sourceTriangleCount?: number;
    selectedTriangleCount?: number;
    skippedTriangleCount?: number;
    degenerateTriangleCount?: number;
    effect?: unknown;
    scalePercent?: number;
    gravity?: unknown;
    sound?: any;
  };
  unsupportedEventSound(sound: any): string | undefined;
}

function textBeforeNul(text: string): string {
  const terminator = text.indexOf("\0");
  return text.slice(0, terminator < 0 ? text.length : terminator);
}

/** The nested `object/type` property is the movable object's runtime class. */
export function movableObjectType(value: TrackObjectOccurrence["value"]): string {
  const entry = value.property?.children
    .find(child => textBeforeNul(child.name) === "object")
    ?.attributes.find(attribute => textBeforeNul(attribute.name) === "type")?.value;
  if (entry === undefined) return "<missing>";
  return textBeforeNul(entry) || "<empty>";
}

export function isRaceItemMode(mode: string): boolean {
  return mode === "speed-individual" || mode === "speed-team" || mode === "time-attack";
}

export function omittedTrackObject(base: Pick<TrackAdmissionRecord, "occurrence" | "mode" | "source">,
  reason: string): TrackAdmissionRecord {
  return { ...base, producer: "TRACKDATA TrackObject wire", consumer: "目标省略路径",
    owner: "不创建运行期对象", lifecycle: "不适用", order: "不创建 ordering placeholder",
    decision: "omit", reason };
}

export function blockedTrackObject(base: Pick<TrackAdmissionRecord, "occurrence" | "mode" | "source">,
  reason: string): TrackAdmissionRecord {
  return { ...base, producer: "TRACKDATA TrackObject wire", consumer: "未闭合",
    owner: "未闭合", lifecycle: "未闭合", order: "未闭合",
    decision: "block", reason };
}

/** Admit a TrackContainer occurrence only when its runtime lifecycle is known. */
export function admitTrackObject(
  entry: TrackObjectOccurrence,
  index: number,
  mode: string,
  source: unknown,
  lensFlareCount: number,
  courseSoundEnabled: boolean,
  lteCoinsEnabled: boolean,
  ops: TrackAdmissionOps,
): TrackAdmissionRecord {
  const object = entry.value;
  const base = {
    occurrence: {
      kind: "track-object" as const,
      index,
      encoding: entry.encoding,
      objectId: entry.id,
      className: object.kind,
      name: object.name,
      detail: object.kind === "ToMovableObject" ? movableObjectType(object) : undefined,
    },
    mode,
    source,
  };

  if (object.kind === "TrackObject") {
    const isCourse = object.name === "track";
    return {
      ...base,
      producer: "TRACKDATA TrackObject wire",
      consumer: isCourse ? "course property" : "未闭合",
      owner: isCourse ? "GoCourse setup" : "未闭合",
      lifecycle: isCourse ? "track setup -> destruction" : "未闭合",
      order: isCourse ? "GoCourse 在 kart 后执行 slot13" : "未闭合",
      decision: isCourse ? "admit" : "block",
      reason: isCourse ? "course-owner" : "track-object-consumer-unclosed",
    };
  }
  if (object.kind === "ToRoad") {
    return {
      ...base,
      producer: "TRACKDATA ToRoad wire",
      consumer: "GoCourse route builder",
      owner: "GoCourse",
      lifecycle: "track setup -> destruction",
      order: "route pair after kart slot12",
      decision: "admit",
      reason: "course-road",
    };
  }
  if (object.kind === "ToDummy") {
    const isSound = courseSoundEnabled &&
      (mode === "time-attack" || mode === "speed-individual") &&
      object.name.slice(0, 5) === "sound" &&
      object.property?.children.some(child => child.name === "sound" &&
        child.attributes.some(attribute => attribute.name === "filename" && attribute.value.length > 0));
    if (isSound) {
      return {
        ...base,
        producer: "P3553 TRACKDATA ToDummy transform + sound property",
        consumer: "BF3450 -> BFDA10 -> surround source",
        owner: "shared GameStage audio manager / TrackDummyAudio",
        lifecycle: "common stage enter -> camera listener update -> common stage exit",
        order: "course/world assembly after track objects, then sound enable",
        decision: "admit",
        reason: "track-dummy-sound-admitted",
      };
    }
    if ((mode !== "time-attack" && mode !== "speed-individual") || object.name !== "lensflare")
      return omittedTrackObject(base, "structural-dummy");
    const uniqueLensFlare = lensFlareCount === 1;
    return {
      ...base,
      producer: "TRACKDATA exact ToDummy lensflare transform",
      consumer: "BEAD20 -> GameStage ReLensFlare",
      owner: "GameStage +0x944 / TrackLensFlare",
      lifecycle: uniqueLensFlare ? "stage setup -> route toggle -> destruction"
        : "多个 exact owner 的选择顺序尚未闭合",
      order: "stage weather construction 后，route listener 前",
      decision: uniqueLensFlare ? "admit" : "block",
      reason: uniqueLensFlare ? "track-lensflare-admitted" : "track-lensflare-owner-ambiguous",
    };
  }
  if (object.kind === "ToBlackPlane") {
    return {
      ...base,
      producer: "TRACKDATA ToBlackPlane quad, normal and edge flags",
      consumer: "P3553 10C22F0 -> 10AF980 -> 11E5500 full AABB occlusion",
      owner: "BasicRenderScenario / TrackRenderScene",
      lifecycle: "track setup -> per-frame suppress before collect -> restore after draw -> destruction",
      order: "camera matrix -> black-plane volumes -> scene collection -> draw -> restore",
      decision: "admit",
      reason: "render-black-plane-admitted",
    };
  }
  if (object.kind === "ToMinimap") {
    if (mode !== "time-attack") return omittedTrackObject(base, "presentation-minimap");
    return {
      ...base,
      producer: "TRACKDATA ToMinimap wire",
      consumer: "P3528 F88FE0/F8AFC0/F8BD30 normal TimeAttack Minimap",
      owner: "TimeAttack gameplay UI Minimap",
      lifecycle: "stage setup -> gameplay frames -> destruction",
      order: "manager-0 gameplay HUD pass",
      decision: "admit",
      reason: "timeattack-minimap-admitted",
    };
  }
  if (object.kind === "ToItemCube") {
    return isRaceItemMode(mode) ? omittedTrackObject(base, "cube-loader-omission")
      : blockedTrackObject(base, mode === "item" ? "cube-grant-unclosed" : "cube-mode-unclosed");
  }
  if (object.kind === "ToLucci") {
    if (mode !== "speed-individual" || !lteCoinsEnabled)
      return blockedTrackObject(base, "lucci-lifecycle-unclosed");
    return {
      ...base,
      producer: "P3553 BF6E7F -> BF6F6F base-0 GoLucci, original item/lucci states",
      consumer: "LteCoinRuntime coordinator slot12/slot13; LteCoins original model/audio",
      owner: "local race coordinator runtime; race assets GPU/audio",
      lifecycle: "map setup -> pickup once -> Eaten deadline -> remove -> race teardown",
      order: "kart slot12 -> category-2 pair -> next frame state update; no account currency",
      decision: "admit",
      reason: "lte-coin-runtime-admitted",
    };
  }
  if (object.kind === "ToMesh" || object.kind === "ToEventMesh")
    return blockedTrackObject(base, "mesh-occurrence-drift");
  if (object.kind !== "ToMovableObject")
    return blockedTrackObject(base, "track-object-consumer-unclosed");

  if (isRaceItemMode(mode) && ops.isItemOnlyMovable(object))
    return omittedTrackObject(base, "only-item-game-loader-omission");
  const type = movableObjectType(object);
  if (type === "<missing>" || type === "dummy") {
    if (mode !== "time-attack" && mode !== "speed-individual")
      return omittedTrackObject(base, "movable-dummy-noop");
    return {
      ...base,
      producer: "P3553 BFC240 ToMovableObject -> ACF600 GoItemDummy fallback",
      consumer: "AB7E00/AB7E70 attaches nested scene; item and collision callbacks are no-ops",
      owner: "GoItemDummy nested render root under the track object manager",
      lifecycle: "stage setup -> scene traversal -> stage teardown",
      order: "BFC240 factory registration before scene traversal; no collision registration",
      decision: "admit",
      reason: "movable-dummy-visual-admitted",
    };
  }
  if (type === "itemCube") {
    return isRaceItemMode(mode) ? omittedTrackObject(base, "cube-loader-omission")
      : blockedTrackObject(base, mode === "item" ? "cube-grant-unclosed" : "cube-mode-unclosed");
  }
  if (["banana", "ltejump", "mine", "mineHidden", "waterMine"].includes(type)) {
    return isRaceItemMode(mode) ? omittedTrackObject(base, "excluded-nonboost-item-runtime")
      : blockedTrackObject(base, "excluded-nonboost-item-runtime");
  }
  if (type === "obstacle") {
    const obstacle = ops.admitObstacle(object);
    if ((mode === "time-attack" || mode === "speed-individual") && obstacle.status === "admit") {
      return {
        ...base,
        occurrence: {
          ...base.occurrence,
          detail: `obstacle;prs=${obstacle.hasPrs};press=${obstacle.pressMode ?? "none"};triangles=${obstacle.collisionTriangleCount};markers=${obstacle.markerProfile!.join(",") || "none"}`,
        },
        producer: "TRACKDATA ToMovableObject obstacle wire + live PRS matrices",
        consumer: "GoPlayKart secondary obstacle collision",
        owner: "GoItemObstacle snapshot",
        lifecycle: "track setup -> slot12 motion -> pair registration -> destruction",
        order: "slot12 pending; pair capacity 8; commit N -> kart consumption N+1",
        decision: "admit",
        reason: "obstacle-runtime-admitted",
      };
    }
    if (obstacle.status === "block") {
      return blockedTrackObject({ ...base, occurrence: {
        ...base.occurrence, detail: `obstacle;${obstacle.reason}`,
      } }, "obstacle-lifecycle-unclosed");
    }
    return blockedTrackObject(base, "obstacle-lifecycle-unclosed");
  }
  if (type === "event") {
    const event = ops.parseEvent(object);
    const unsupportedSound = event.status === "parsed" && event.sound
      ? ops.unsupportedEventSound(event.sound) : undefined;
    const admitted = (mode === "time-attack" || mode === "speed-individual") &&
      event.status === "parsed" && !unsupportedSound;
    const detail = event.status === "parsed"
      ? `event;prs=${event.prsNodes};triangles=${event.triangleCount};source=${event.sourceTriangleCount};selected=${event.selectedTriangleCount};skipped=${event.skippedTriangleCount};degenerate=${event.degenerateTriangleCount};effect=${!!event.effect};scale=${event.scalePercent ?? "none"};gravity=${event.gravity ?? "none"};sound=${!!event.sound};rearm=countdown-normalized;geometry=live;pair=capacity8;collision=wired;scaleConsumer=wired;gravityConsumer=wired;dispatch=excluded-network-only;effectOwner=wired;standaloneSound=${unsupportedSound ?? "wired"}`
      : `event;projection-block=${event.reason}`;
    return {
      ...base,
      occurrence: { ...base.occurrence, detail },
      producer: "P3528 BF7C60 event branch -> ACFDA0 GoItemEventObject",
      consumer: "P3528 B583A0 -> AD0550 overlap -> AD0150 callback; BF9430 -> 111A360 standalone sound",
      owner: admitted ? "GoItemEventObject + local kart effect presentation + standalone track sound"
        : "GoItemEventObject runtime owner 未完整闭合",
      lifecycle: admitted
        ? "Countdown residue clear -> overlap/effect cooldown -> 3000ms rearm; stage audio setup -> teardown"
        : "阻断",
      order: "Countdown manager slot12/21; event pair snapshot N -> kart callback N+1 after obstacle response",
      decision: admitted ? "admit" : "block",
      reason: admitted ? "event-runtime-admitted" : "event-runtime-unclosed",
    };
  }
  return blockedTrackObject(base, "movable-consumer-unclosed");
}
