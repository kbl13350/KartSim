/** Ends live multiplayer presentation and opens the race result scene. */

interface ResultRow { playerId: unknown; [key: string]: unknown }
interface RaceSnapshot {
  roadblock?: { runnerId: unknown };
  roadblockOutcome?: { runnerWon: boolean };
  roster: unknown;
  winningTeam?: unknown;
}
interface ResultVehicle {
  imported: {
    object: unknown;
    animation?: { reset(nowMs: number): void };
    model: unknown;
    scene: unknown;
  };
  visual: unknown;
  effects: { setState(boost: number, drift: number, active: boolean,
    collision: boolean, nowMs: number): void };
  lampFlares: { resetInputVisibility(): void };
  audio: { stopRace(): void };
}
interface ResultParticipant {
  playerId: unknown;
  vehicle: ResultVehicle;
  draftEffect?: { reset(nowMs: number): void };
}
interface ResultView {
  resetAnimation(): void;
  setModel(object: unknown, visual: unknown, animation: unknown,
    model: unknown, scene: unknown): void;
}
interface ResultScene {
  root: unknown;
  effectRoot: unknown;
  show(nowMs: number, local: unknown, ...args: unknown[]): void;
}

export interface RacePresenterResultsHost {
  playerId: unknown;
  cameraShake: { leave(force: boolean): void };
  cameraWave: { leave(): void };
  scene: { add(...objects: unknown[]): void };
  runtime: {
    local: unknown;
    resultSnapshot(): ResultRow[] | undefined;
    raceSnapshot(): RaceSnapshot;
  };
  assets: {
    mode?: string;
    participants: ResultParticipant[];
    draftAudio: { reset(): void };
  };
  views: Map<unknown, ResultView>;
  linkedPresentations: Map<unknown, { setMode(mode: number): void }>;
  roadblockHud?: { hide(): void };
  roadblockResult?: ResultScene;
  award?: ResultScene;
  resultView?: {
    show(results: ResultRow[], nowMs: number, snapshot: RaceSnapshot): void;
  };
  bgm?: {
    playResult(won: boolean): void;
    playMultiplayerPodium(): void;
  };
  roadblockFlag?: { dispose(): void };
  flyingPet?: { dispose(): void };
  trackEventEffects?: { dispose(): void };
  trackEventAudio?: { dispose(): void };
  trackDummyAudio?: { dispose(): void };
  warpCameraFrozen: boolean;
  warpHudHidden: boolean;
  resultVisible: boolean;
  clearGiant(): void;
  releaseShadowPresentations(): void;
}

export interface RacePresenterResultsDependencies {
  vehicleParts(vehicle: ResultVehicle): Array<{ removeFromParent(): void }>;
  winningPlayers(mode: string, roster: unknown, results: ResultRow[],
    winningTeam: unknown): unknown[];
  createVehicleView(scene: RacePresenterResultsHost["scene"]): ResultView;
}

function resetResultParticipant(participant: ResultParticipant, nowMs: number,
  dependencies: RacePresenterResultsDependencies): void {
  participant.draftEffect?.reset(nowMs);
  for (const part of dependencies.vehicleParts(participant.vehicle)) {
    part.removeFromParent();
  }
  const vehicle = participant.vehicle;
  vehicle.effects.setState(0, 0, false, false, nowMs);
  vehicle.lampFlares.resetInputVisibility();
  vehicle.imported.animation?.reset(nowMs);
  vehicle.audio.stopRace();
}

export function showRacePresenterResults(host: RacePresenterResultsHost,
  nowMs: number, dependencies: RacePresenterResultsDependencies): void {
  host.clearGiant();
  host.roadblockFlag?.dispose();
  host.roadblockFlag = undefined;
  host.releaseShadowPresentations();
  host.flyingPet?.dispose();
  host.flyingPet = undefined;
  host.cameraShake.leave(true);
  host.cameraWave.leave();
  host.warpCameraFrozen = false;
  host.warpHudHidden = false;
  host.trackEventEffects?.dispose();
  host.trackEventEffects = undefined;
  host.trackEventAudio?.dispose();
  host.trackEventAudio = undefined;
  host.trackDummyAudio?.dispose();
  host.trackDummyAudio = undefined;

  const results = host.runtime.resultSnapshot();
  if (!results || !host.resultView) {
    throw new Error("本局结果展示资源未就绪。");
  }
  const snapshot = host.runtime.raceSnapshot();
  if (snapshot.roadblock) {
    host.roadblockHud?.hide();
    if (!host.roadblockResult) {
      throw new Error("挡人专属结算场景未就绪。");
    }
    for (const participant of host.assets.participants) {
      resetResultParticipant(participant, nowMs, dependencies);
    }
    host.roadblockResult.show(nowMs, host.runtime.local,
      host.assets, host.views, snapshot);
    host.scene.add(host.roadblockResult.root, host.roadblockResult.effectRoot);
    host.assets.draftAudio.reset();
    host.resultView.show(results, nowMs, snapshot);
    host.resultVisible = true;
    host.bgm?.playResult(snapshot.roadblockOutcome?.runnerWon ===
      (snapshot.roadblock.runnerId === host.playerId));
    return;
  }

  if (!host.award) throw new Error("本局颁奖资源未就绪。");
  const winners = dependencies.winningPlayers(host.assets.mode ?? "individual",
    snapshot.roster, results, snapshot.winningTeam);
  for (const result of results) {
    if (!winners.includes(result.playerId) || host.views.has(result.playerId)) {
      continue;
    }
    const participant = host.assets.participants.find(candidate =>
      candidate.playerId === result.playerId)!;
    const view = dependencies.createVehicleView(host.scene);
    const vehicle = participant.vehicle;
    view.setModel(vehicle.imported.object, vehicle.visual,
      vehicle.imported.animation, vehicle.imported.model,
      vehicle.imported.scene);
    host.views.set(result.playerId, view);
  }
  for (const [playerId, linked] of host.linkedPresentations) {
    host.views.get(playerId)?.resetAnimation();
    linked.setMode(1);
  }
  host.award.show(nowMs, host.runtime.local, results, host.views, snapshot);
  for (const participant of host.assets.participants) {
    resetResultParticipant(participant, nowMs, dependencies);
  }
  host.assets.draftAudio.reset();
  host.scene.add(host.award.root, host.award.effectRoot);
  host.resultView.show(results, nowMs, snapshot);
  host.resultVisible = true;
  host.bgm?.playMultiplayerPodium();
}
