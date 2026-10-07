export interface LocalRaceConstructionOps {
  validateStartSlots(room: any): void;
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
  ops.validateStartSlots(room);
  const localParticipant = assets.participants.find(
    (participant: any) => participant.playerId === localPlayerId);
  if (!localParticipant ||
    !room.roster.some((entry: any) => entry.playerId === localPlayerId)) {
    throw new Error("本局缺少本机车辆。");
  }
  if (assets.map.data.trackId !== room.trackId) {
    throw new Error("本局赛道与已装配资源不一致。");
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
    assets.mode === "team" && assets.speed !== 4,
    assets.drivingMode,
    owner.lte?.motion,
    owner.giant,
    assets.checkClientFramerate && assets.channel.adjustCollision,
  );
  owner.track = ops.makeTrack(
    assets.map.data, assets.map.scene, assets.map.renderScene,
    assets.map.skydome, assets.lensFlare);
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
    room.startSlots[localPlayerId],
    (point: any, direction: any) =>
      owner.track.rayQuery(point, direction, false)?.point,
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
}
