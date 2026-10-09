import { freezeItemRaceRules, teamGaugeEnabled } from "./lobby-item-mode";
import { createActiveItemRace } from "./item-race-wiring";
import type { ItemRaceController } from "../item/item-race-controller";

export interface ActiveRaceCoordinatorDependencies {
  normalizeRp(value: unknown): unknown;
  createCollisionFramerate(enabled: unknown, opponents: unknown[], clientFramerate: unknown): any;
  createLocal(assets: any, room: any, playerId: unknown): any;
  createCadence(room: any, playerId: unknown): any;
  createRemotes(assets: any, connection: any, now: () => number,
    fail: (error: unknown) => void, cadence: any): any;
  resolveRemoteCollision(localPhysics: any, remotes: any, balance: unknown,
    hit: unknown, framerate: any): unknown;
  createPresentation(): any;
  createSlipstream(): any;
  bindClock(host: any, mapping: unknown): unknown;
  scheduleStart(host: any, startAt: unknown): unknown;
  updateRoom(host: any, room: any): unknown;
  updateFrame(host: any, now: number, frame: unknown, bypass: unknown): unknown;
  updateRemoteViews(host: any, now: number): unknown;
  roadblockRemaining(host: any, now: number): unknown;
  dispose(host: any): unknown;
}

/** Live multiplayer physics and remote-kart state owner. */
export class ActiveRaceCoordinator {
  assets: any;
  connection: any;
  onError: (error: unknown) => void;
  local: any;
  remotes: any;
  localPresentation: any;
  presentation: any;
  slipstream: any;
  remoteSlipstreams = new Map<unknown, any>();
  disposed = false;
  clockBound = false;
  mapping: any;
  room: any;
  finishReported = false;
  offTeam: (() => void) | undefined;
  teamSequence = 0;
  teamSentSequence = 0;
  teamCharge = 0;
  teamSentAt = -Infinity;
  finishDeadline: unknown;
  sender: any;
  cadence: any;
  collisionFramerate: any;
  remotePhysicsBypass = false;
  remoteFrameUpdated = false;
  rpIdentity: unknown;
  roadblockIdentity: unknown;
  lteIdentity: unknown;
  giantIdentity: unknown;
  /** Frozen `race.item` of a 道具赛 race. */
  itemIdentity: unknown;
  /** 道具赛: the local item race controller (also `local.items`). */
  itemRace: ItemRaceController | undefined;
  giantSequence = 0;
  giantSend = Promise.resolve();
  giantCleared = false;

  constructor(assets: any, room: any, connection: any, now: () => number,
    onError: (error: unknown) => void, clientFramerate: unknown,
    readonly dependencies: ActiveRaceCoordinatorDependencies) {
    const ops = dependencies;
    this.presentation = ops.createPresentation();
    this.slipstream = ops.createSlipstream();
    this.assets = assets;
    this.connection = connection;
    this.onError = onError;
    this.rpIdentity = room.rp ? ops.normalizeRp(room.rp) : undefined;
    this.roadblockIdentity = room.roadblock ? Object.freeze({ ...room.roadblock }) : undefined;
    this.lteIdentity = room.lte ? Object.freeze({ ...room.lte }) : undefined;
    this.giantIdentity = room.giant ? Object.freeze({ ...room.giant }) : undefined;
    this.itemIdentity = freezeItemRaceRules(room.item);
    this.collisionFramerate = ops.createCollisionFramerate(
      assets.checkClientFramerate && assets.channel.adjustCollision,
      assets.participants.filter((player: any) => player.playerId !== connection.playerId)
        .map((player: any) => player.playerId),
      clientFramerate,
    );
    let local: any;
    try {
      if (assets.channel.name !== room.channelName)
        throw new Error("比赛频道与已加载资源不一致。");
      local = ops.createLocal(assets, room, connection.playerId);
      this.local = local;
      if (local.giant && !connection.sendGiantState)
        throw new Error("缺少巨人可靠状态发送通道。");
      this.cadence = ops.createCadence(room, connection.playerId);
      // Item team races have no 组队集气 (ITEM_MODE.md 1).
      if (teamGaugeEnabled(assets)) {
        if (!connection.sendTeamCharge || !connection.subscribeTeamGauge)
          throw Error("缺少组队集气通道。");
        const team = room.roster.find((player: any) =>
          player.playerId === connection.playerId).team;
        this.offTeam = connection.subscribeTeamGauge((gauge: any) => {
          if (!this.disposed && gauge.team === team &&
            gauge.sequence > this.teamSequence && this.room?.phase === "racing") {
            this.teamSequence = gauge.sequence;
            this.local.physics.enqueueMultiplayerTeamTarget(gauge.target);
          }
        });
      }
      this.remotes = ops.createRemotes(assets, connection, now, error => {
        try { onError(error); }
        finally { this.dispose(); }
      }, this.cadence);
      this.itemRace = createActiveItemRace(this, room, now);
      const balance = assets.participants.find((player: any) =>
        player.playerId === connection.playerId).collisionBalance;
      this.local.queueRemoteKart({
        name: "GoNetKart[]", category: 0, active: true, removeRequested: false,
        slot12: (time: number) => {
          if (!this.remoteFrameUpdated) this.updateRemotes(time);
          this.local.giant?.updateEffects(time);
          this.remotes.updateGiantEffects(time);
        },
        slot13: () => {}, commit: () => {}, destroy: () => {},
      }, (hit: unknown) => ops.resolveRemoteCollision(
        this.local.physics, this.remotes, balance, hit, this.collisionFramerate));
    } catch (error) {
      this.collisionFramerate.dispose();
      this.offTeam?.();
      this.cadence?.dispose();
      local?.dispose();
      assets.dispose();
      throw error;
    }
  }

  get giantEffectsEnded(): boolean { return this.giantCleared; }
  bindClock(mapping: unknown): unknown { return this.dependencies.bindClock(this, mapping); }
  scheduleStart(startAt: unknown): unknown { return this.dependencies.scheduleStart(this, startAt); }
  updateRoom(room: any): unknown { return this.dependencies.updateRoom(this, room); }
  update(now: number, frame: unknown, bypass: unknown): unknown {
    return this.dependencies.updateFrame(this, now, frame, bypass);
  }
  raceSnapshot(): any { return this.room?.race; }
  latencyMs(value: unknown): unknown { return this.connection.latencyMs?.(value); }
  draftPresentationVisible(playerId: unknown): boolean {
    return playerId === this.connection.playerId
      ? this.slipstream.presentationVisible
      : this.remoteSlipstreams.get(playerId)?.presentationVisible ?? false;
  }
  draftBurstActive(playerId: unknown): boolean {
    return playerId === this.connection.playerId
      ? this.slipstream.hudActive
      : this.remoteSlipstreams.get(playerId)?.hudActive ?? false;
  }
  localDraftHudActive(): boolean { return this.slipstream.hudActive; }
  updateRemotes(now: number): unknown { return this.dependencies.updateRemoteViews(this, now); }
  resultSnapshot(): any { return this.room?.race?.results; }
  roadBlockRunnerProgress(): unknown {
    const runnerId = (this.roadblockIdentity as { runnerId?: unknown } | undefined)?.runnerId;
    if (runnerId) return runnerId === this.connection.playerId
      ? this.local.raceProgress() : this.remotes.raceProgress(runnerId);
  }
  roadBlockRemaining(now: number): unknown {
    return this.dependencies.roadblockRemaining(this, now);
  }
  finishSnapshot(): unknown[] { return this.room?.race?.finishes ?? []; }
  dispose(): unknown { return this.dependencies.dispose(this); }
}
