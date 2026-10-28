import { BRAWL_SLOTS, brawlGridForward } from "./lobby-brawl-mode";
import { isItemRace, isItemRaceRules } from "./lobby-item-mode";
import { bravePlayerStart, braveRouteSelection, captureBraveStartPoses } from "./brave-route";

export interface LocalRaceConstructionOps {
  validateStartSlots(room: any, slotCount?: number): void;
  hasLteMode(lte: any): boolean;
  validRpDraws(rp: any, playerIds: string[]): boolean;
  sameRp(left: any, right: any): boolean;
  hasGiantMode(giant: any): boolean;
  makeLte(): any;
  makeGiant(compensateBooster: () => void): any;
  makePhysics(...args: any[]): any;
  makeTrack(...args: any[]): any;
  placeAtStart(...args: any[]): any;
  makeCoordinator(...args: any[]): any;
  racingState: unknown;
}

/** Validates a frozen room and assembles its local physics and track owners. */
export function initializeLocalRace(
  owner: any,
  assets: any,
  room: any,
  localPlayerId: string,
  ops: LocalRaceConstructionOps,
): void {
  owner.assets = assets;
  owner.roadblock = assets.drivingMode?.kind === "roadblock";
  owner.isRoadBlockRunner =
    owner.roadblock && room.roadblock?.runnerId === localPlayerId;
  if (assets.raceId !== room.raceId) {
    throw new Error("禁止使用上一局的比赛资源。");
  }
  const brawl = assets.drivingMode?.kind === "brawl";
  ops.validateStartSlots(room, brawl ? BRAWL_SLOTS : undefined);
  const localParticipant = assets.participants.find(
    (participant: any) => participant.playerId === localPlayerId);
  if (!localParticipant ||
    !room.roster.some((entry: any) => entry.playerId === localPlayerId)) {
    throw new Error("本局缺少本机车辆。");
  }
  if (assets.map.data.trackId !== room.trackId) {
    throw new Error("本局赛道与已装配资源不一致。");
  }
  const brave = assets.drivingMode?.kind === "brave";
  const braveMap = assets.map.data.brave;
  if (brave) {
    const expected = braveRouteSelection(room, localPlayerId);
    if (assets.mode !== "team" || !braveMap ||
        braveMap.ruleset !== expected.ruleset || braveMap.forwardTeam !== expected.forwardTeam ||
        braveMap.localTeam !== expected.localTeam)
      throw new Error("勇者竞速冻结方向与已装配路线不一致。");
  } else if (room.brave !== undefined || braveMap !== undefined) {
    throw new Error("普通比赛不能使用勇者竞速路线。");
  }
  if ((assets.drivingMode?.kind === "lte") !== ops.hasLteMode(room.lte)) {
    throw new Error("LTE Web试玩身份与本机玩法不一致。");
  }
  const roomPlayerIds = room.roster.map((entry: any) => entry.playerId);
  if ((assets.drivingMode?.kind === "rp") !==
      ops.validRpDraws(room.rp, roomPlayerIds) ||
      !ops.sameRp(assets.rp, room.rp)) {
    throw new Error("RP 抽取结果与已装配车辆不一致。");
  }
  if (room.rp && assets.participants.some((participant: any) => {
    const draw = room.rp.draws[participant.playerId];
    return !draw ||
      participant.profile.equipment.itemIds[3] !== draw.kartId ||
      participant.profile.equipment.itemIds[52] !== draw.flyingPetId;
  })) {
    throw new Error("RP 分配与参与者实际装配不一致。");
  }
  if (isItemRace(assets.drivingMode)
    ? !isItemRaceRules(room.item, assets.drivingMode?.team === true)
    : room.item !== undefined) {
    throw new Error("道具赛身份与本机玩法不一致。");
  }
  owner.lte = assets.drivingMode?.kind === "lte" ? ops.makeLte() : undefined;
  if ((assets.drivingMode?.kind === "giant") !== ops.hasGiantMode(room.giant)) {
    throw new Error("巨人冻结身份与玩法不一致。");
  }
  owner.giant = assets.drivingMode?.kind === "giant"
    ? ops.makeGiant(() => owner.physics.compensateGiantBooster())
    : undefined;
  owner.physics = ops.makePhysics(
    localParticipant.vehicle.physicsParams,
    localParticipant.vehicle.collisionShape,
    assets.mode === "team",
    assets.mode === "team" && assets.speed === 4,
    // Item team races keep the network-driven gauge but never feed it: they
    // neither subscribe to team-gauge nor send team-charge. Passing false
    // here would start the offline local gauge instead (driving/team-gauge.ts).
    assets.mode === "team" && assets.speed !== 4,
    assets.drivingMode,
    owner.lte?.motion,
    owner.giant,
    assets.checkClientFramerate && assets.channel.adjustCollision,
  );
  owner.track = ops.makeTrack(
    assets.map.data, assets.map.scene, assets.map.renderScene,
    assets.map.skydome, assets.lensFlare);
  owner.braveStartPoses = brave ? captureBraveStartPoses(braveMap, owner.physics) : undefined;
  if (brave) {
    // Validate every slot now, before a remote presentation can be spawned.
    for (const participant of room.roster)
      bravePlayerStart(room, participant.playerId, owner.braveStartPoses);
  }
  owner.physics.resetFromRouteFrame(owner.track.getStart());
  owner.startPose = structuredClone({
    position: owner.physics.body.position,
    right: owner.physics.body.right,
    forward: owner.physics.body.forward,
    up: owner.physics.body.up,
  });
  owner.physics.body.position = ops.placeAtStart(
    owner.physics.body.position,
    owner.physics.body.right,
    brave ? bravePlayerStart(room, localPlayerId, owner.braveStartPoses).slot
      : room.startSlots[localPlayerId],
    (point: any, direction: any) =>
      owner.track.rayQuery(point, direction, false)?.point,
    // 50人乱斗: rows of eight behind the release's row.
    brawl ? brawlGridForward(owner.physics.body.forward) : undefined,
  );
  owner.track.resetRouteState(owner.physics, owner.physics.body.position);
  owner.track.setLensFlareEnabled(
    owner.track.currentRouteSurface(owner.physics) === "lensflare");
  owner.physics.state.trackProgress =
    owner.track.getRouteState(owner.physics).distance;
  owner.physics.setRaceMotionLocked(true);
  owner.coordinator = ops.makeCoordinator(
    assets.map.admission, owner.track, owner.physics,
    (tag: any) => owner.handleLocalRouteTag(tag));
  if (assets.lteCoins) owner.track.group.add(assets.lteCoins.object);
  assets.lteCoins?.attach(
    owner.coordinator,
    () => owner.physics.body.position,
    () => owner.lifecycle.state === ops.racingState &&
      owner.resetState.phase === 0 && !owner.warpNext.blocksDriving(),
  );
  attachItemRaceFields(owner, assets, ops);
  attachHazardTraps(owner, assets, localPlayerId, ops);
}

/**
 * Speed races: the water mines the hazard carriers hold trap the local kart
 * (item/hazard-traps.ts); the trap presenter joins the track group.
 */
function attachHazardTraps(owner: any, assets: any, localPlayerId: string,
  ops: LocalRaceConstructionOps): void {
  const traps = assets.hazardTraps;
  if (!traps || isItemRace(assets.drivingMode)) return;
  owner.track.group.add(traps.object);
  traps.attach(owner.coordinator, {
    physics: owner.physics,
    playerId: localPlayerId,
    canTrigger: () => owner.lifecycle.state === ops.racingState &&
      owner.resetState.phase === 0 && !owner.warpNext.blocksDriving(),
  });
}

/**
 * Item races (道具赛): the cubes and the item presenter join the track group,
 * and the cube and hazard fields pair with the local kart. Their callbacks go
 * to `owner.itemRace`, the item race controller the race coordinator creates
 * once the race connection exists.
 */
function attachItemRaceFields(owner: any, assets: any, ops: LocalRaceConstructionOps): void {
  if (!isItemRace(assets.drivingMode)) return;
  if (assets.itemCubes) owner.track.group.add(assets.itemCubes.object);
  if (assets.itemPresenter?.object) owner.track.group.add(assets.itemPresenter.object);
  const collecting = () => owner.lifecycle.state === ops.racingState &&
    owner.resetState.phase === 0 && !owner.warpNext.blocksDriving();
  assets.itemCubes?.attach(
    owner.coordinator,
    () => owner.physics.body.position,
    collecting,
    (cubeId: number) => owner.itemRace?.cube(cubeId),
  );
  assets.itemHazards?.attach(
    owner.coordinator,
    () => owner.physics.body.position,
    () => collecting() && !owner.physics.itemEffects?.immune,
    (hazard: { id: number; itemIdx: number; position?: unknown }) => owner.itemRace?.hazard(hazard),
  );
  // The hazards' own items (a banana, the robots' water mines) stand on the track.
  if (assets.itemHazards && assets.itemPresenter?.trackHazards) {
    const hazards = assets.itemHazards;
    assets.itemPresenter.trackHazards(hazards.hazards, (id: number) => hazards.position(id))
      .catch((error: unknown) => console.warn("赛道道具陷阱模型载入失败", error));
  }
}
