/** Loads optional multiplayer race presentation owners before live racing. */

interface Disposable { dispose(): void }
interface Participant {
  playerId: unknown;
  profile: { equipment: { itemIds: Record<number, number> } };
  characters: {
    ordinary?: { scene: { getDecorationOwner(): unknown } };
  };
  vehicle: { imported: { model: unknown } };
}

export interface RacePresenterSetupHost {
  disposed: boolean;
  playerId: unknown;
  race: { roadblock?: { runnerId: unknown } };
  assets: {
    drivingMode?: { kind: string };
    participants: Participant[];
    map: { environment: unknown; stageBinding: unknown };
  };
  scene: unknown;
  random: unknown;
  runtime: {
    local: {
      giant?: unknown;
      physics: {
        body: unknown;
        addFlyingPetListener(listener: unknown): void;
      };
    };
    remotes: {
      giant(playerId: unknown): unknown;
      presentationVisible(playerId: unknown, nowMs: number): boolean;
      copyWebPose(playerId: unknown): unknown;
    };
  };
  views: Map<unknown, { root: unknown }>;
  hud: { giantStage(stage: unknown, value: unknown): void; clearGiant(): void };
  cameraShake: { setGiantGate(value: undefined): void };
  giantAppearances: Map<unknown, Disposable>;
  flyingPet?: Disposable & { mount(owner: unknown): void };
  roadblockFlag?: Disposable;
  giantPresentation?: Disposable;
  roadblockResult?: Disposable;
}

export interface RacePresenterSetupDependencies {
  flyingPetItem(library: unknown, itemId: number | undefined): Promise<unknown | undefined>;
  serializedRoot(model: unknown): {
    children: Array<{ value?: { transform?: { scale: unknown } } }>;
  };
  loadFlyingPet(options: {
    library: unknown;
    item: unknown;
    role: string;
    environment: unknown;
    binding: unknown;
    colors: unknown;
    random: unknown;
    grandparentScale: unknown;
    audioContext: unknown;
    listen(listener: unknown): void;
  }): Promise<RacePresenterSetupHost["flyingPet"]>;
  paintColors(library: unknown, itemId: number): Promise<unknown>;
  loadRoadblockFlag(library: unknown, root: unknown,
    world: { environment: unknown; stageBinding: unknown },
    localRunner: boolean): Promise<Disposable>;
  loadGiant(library: unknown, scene: unknown,
    participants: Array<{ id: unknown; logic: unknown; pose(): unknown }>,
    world: { environment: unknown; stageBinding: unknown },
    audioContext: unknown,
    onStage: (stage: unknown, value: unknown) => void): Promise<Disposable>;
  loadRoadblockResult(library: unknown,
    assets: RacePresenterSetupHost["assets"]): Promise<Disposable>;
  nowMs(): number;
}

export async function prepareRacePresenterFlyingPet(host: RacePresenterSetupHost,
  library: unknown, audioContext: unknown,
  dependencies: RacePresenterSetupDependencies): Promise<void> {
  const participant = host.assets.participants.find(candidate =>
    candidate.playerId === host.playerId)!;
  const petItem = await dependencies.flyingPetItem(library,
    participant.profile.equipment.itemIds[52]);
  if (!petItem) return;
  const ordinaryScene = participant.characters.ordinary?.scene;
  const riderMount = dependencies.serializedRoot(
    participant.vehicle.imported.model).children[6]?.value;
  if (!ordinaryScene || !riderMount || !("transform" in riderMount)) {
    throw new Error("Flying pet rider mount is missing.");
  }
  const pet = await dependencies.loadFlyingPet({
    library,
    item: petItem,
    role: "local",
    environment: host.assets.map.environment,
    binding: host.assets.map.stageBinding,
    colors: await dependencies.paintColors(library,
      participant.profile.equipment.itemIds[2] || 1),
    random: host.random,
    grandparentScale: riderMount.transform!.scale,
    audioContext,
    listen: listener => host.runtime.local.physics.addFlyingPetListener(listener),
  });
  if (host.disposed) {
    pet?.dispose();
    throw new Error("Flying pet race was disposed while loading.");
  }
  host.flyingPet = pet;
  pet?.mount(ordinaryScene.getDecorationOwner());
}

export async function prepareRacePresenterRoadblockFlag(
  host: RacePresenterSetupHost, library: unknown,
  dependencies: RacePresenterSetupDependencies): Promise<void> {
  const roadblock = host.race.roadblock;
  if (!roadblock) return;
  const view = host.views.get(roadblock.runnerId);
  if (!view) throw new Error("挡人比赛缺少冻结跑者模型。");
  const flag = await dependencies.loadRoadblockFlag(library, view.root, {
    environment: host.assets.map.environment,
    stageBinding: host.assets.map.stageBinding,
  }, roadblock.runnerId === host.playerId);
  if (host.disposed) {
    flag.dispose();
    return;
  }
  host.roadblockFlag = flag;
}

export async function prepareRacePresenterGiant(host: RacePresenterSetupHost,
  library: unknown, audioContext: unknown,
  dependencies: RacePresenterSetupDependencies): Promise<void> {
  if (host.assets.drivingMode?.kind !== "giant") return;
  const participants = host.assets.participants.map(participant => {
    const local = participant.playerId === host.playerId;
    const logic = local ? host.runtime.local.giant
      : host.runtime.remotes.giant(participant.playerId);
    if (!logic) throw new Error("巨人表现缺少本局车辆 owner。");
    return {
      id: participant.playerId,
      logic,
      pose: () => participant.playerId === host.playerId
        ? host.runtime.local.physics.body
        : host.runtime.remotes.presentationVisible(participant.playerId,
          dependencies.nowMs())
          ? host.runtime.remotes.copyWebPose(participant.playerId)
          : undefined,
    };
  });
  const giant = await dependencies.loadGiant(library, host.scene, participants, {
    environment: host.assets.map.environment,
    stageBinding: host.assets.map.stageBinding,
  }, audioContext, (stage, value) => host.hud.giantStage(stage, value));
  if (host.disposed) {
    giant.dispose();
    return;
  }
  host.giantPresentation = giant;
}

export function clearRacePresenterGiant(host: RacePresenterSetupHost): void {
  if (host.assets.drivingMode?.kind !== "giant") return;
  host.giantPresentation?.dispose();
  host.giantPresentation = undefined;
  host.hud.clearGiant();
  for (const appearance of host.giantAppearances.values()) appearance.dispose();
  host.giantAppearances.clear();
  host.cameraShake.setGiantGate(undefined);
}

export async function prepareRacePresenterRoadblockResult(
  host: RacePresenterSetupHost, library: unknown,
  dependencies: RacePresenterSetupDependencies): Promise<void> {
  if (!host.race.roadblock) return;
  const result = await dependencies.loadRoadblockResult(library, host.assets);
  if (host.disposed) {
    result.dispose();
    return;
  }
  host.roadblockResult = result;
}
