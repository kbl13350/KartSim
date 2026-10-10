/** Builds the multiplayer race scene from loaded participants and track owners. */

interface Vec3 { x: number; y: number; z: number }
interface SceneMount {
  clear(): void;
  add(object: unknown): void;
  scale: { setScalar(value: number): void };
}
interface CharacterPresentation {
  scene: {
    object: SceneMount;
    rootMaterialBindings?: unknown;
    getDecorationSocket(part: unknown, slot: unknown): SceneMount | undefined;
    getDecorationOwner(): SceneMount | undefined;
  };
  award?: unknown;
}
interface VehiclePresentation {
  tachometerRenderer: { enableUiSmoothing(): void };
  tachometerSelection: { folder: unknown };
  trails: { object: unknown };
  imported: {
    object: unknown;
    animation?: unknown;
    model: unknown;
    scene: unknown;
    renderScene?: {
      bySource: Map<unknown, SceneMount>;
      rootMaterialBindings?: unknown;
    };
  };
  visual: { onCharacterSize: number };
  kartItem: { alwaysLinkCharacter: boolean };
  accessories: Array<{ kind: string;
    render: { scene: { object: unknown } } }>;
  decoration?: { scene: { object: unknown } };
}
interface RaceParticipant {
  playerId: PropertyKey;
  vehicle: VehiclePresentation;
  characters: { linked?: CharacterPresentation;
    ordinary?: CharacterPresentation };
}
interface RacerView {
  setModel(object: unknown, visual: unknown, animation: unknown,
    model: unknown, scene: unknown): void;
  getAttachment(index: number): SceneMount | undefined;
  updatePose(pose: Record<string, unknown>): void;
}

export interface RacePresenterInitializationHost {
  assets: RacePresenterInitializationInputs["assets"];
  runtime: RacePresenterInitializationInputs["runtime"];
  race: RacePresenterInitializationInputs["race"];
  playerId: PropertyKey;
  hud: RacePresenterInitializationInputs["hud"];
  random: unknown;
  countdown: unknown;
  award: unknown;
  resultView: unknown;
  bgm: unknown;
  banner: unknown;
  bannerRequest: unknown;
  petVisible: () => boolean;
  trackInfoCard: unknown;
  roadblockHud: unknown;
  cameraEffectAnchor: unknown;
  cameraShake: unknown;
  rankRoster: unknown;
  lightFactor: unknown;
  tachometer: VehiclePresentation["tachometerRenderer"];
  gaugePreserve: { configure(folder: unknown): void };
  action2d: { enableUiSmoothing(): void };
  drive: { configureP3528ResolutionMode(): void };
  surround: { configureP3528ResolutionMode(): void };
  scene: { add(...objects: unknown[]): void };
  views: Map<PropertyKey, RacerView>;
  linkedPresentations: Map<PropertyKey,
    { resetForRacePresentation(): void }>;
  giantAppearances: Map<PropertyKey, unknown>;
  initialPoses: Map<PropertyKey, unknown>;
  shadowPresentations: Map<PropertyKey, unknown>;
  dispose(): void;
}

export interface RacePresenterInitializationInputs {
  assets: {
    participants: RaceParticipant[];
    drivingMode?: { kind: string };
    rain?: { object: unknown };
    snow?: { object: unknown };
  };
  runtime: {
    local: {
      track: {
        group: unknown;
        rayQuery(from: unknown, to: unknown, includeWalls: boolean):
          { point: Vec3 } | undefined;
      };
      startPose: { position: Vec3; right: unknown;
        [key: string]: unknown };
    };
  };
  race: { roster: unknown; startSlots: Record<PropertyKey, unknown> };
  playerId: PropertyKey;
  actionAssets: unknown;
  hud: unknown;
  random: unknown;
  countdown: unknown;
  award: unknown;
  resultView: unknown;
  bgm: unknown;
  banner: unknown;
  bannerRequest: unknown;
  petVisible: () => boolean;
  trackInfoCard: unknown;
  roadblockHud: unknown;
}

export interface RacePresenterInitializationDependencies {
  createCameraShake(random: unknown, anchor: unknown): unknown;
  createRankRoster(roster: unknown, playerId: PropertyKey): unknown;
  createLightFactor(random: unknown): unknown;
  createAction2d(assets: unknown): RacePresenterInitializationHost["action2d"];
  applyTrackFog(scene: unknown,
    track: RacePresenterInitializationInputs["runtime"]["local"]["track"]): void;
  createRacerView(scene: unknown): RacerView;
  vehicleParts(vehicle: VehiclePresentation): unknown[];
  serializedRoot(model: unknown): { children: Array<{ value?: unknown }> };
  accessorySockets: Record<string, [unknown, unknown] | undefined>;
  createLinkedPresentation(root: SceneMount, riderMount: SceneMount,
    character: SceneMount, alwaysLinked: boolean):
    { resetForRacePresentation(): void };
  attachAura(socket: SceneMount, vehicleRoot: SceneMount,
    auraObject: unknown): void;
  createGiantAppearance(local: boolean, vehicleBindings: unknown,
    characterBindings: unknown): unknown;
  startPosition(position: Vec3, right: unknown, slot: unknown,
    ground: (from: unknown, to: unknown) => Vec3 | undefined): Vec3;
  createShadowPresentation(vehicleObject: unknown): unknown;
}

export function initializeRacePresenter(host: RacePresenterInitializationHost,
  inputs: RacePresenterInitializationInputs,
  dependencies: RacePresenterInitializationDependencies): void {
  const { assets, runtime, race, playerId } = inputs;
  host.assets = assets;
  host.runtime = runtime;
  host.race = race;
  host.playerId = playerId;
  host.hud = inputs.hud;
  host.random = inputs.random;
  host.countdown = inputs.countdown;
  host.award = inputs.award;
  host.resultView = inputs.resultView;
  host.bgm = inputs.bgm;
  host.banner = inputs.banner;
  host.bannerRequest = inputs.bannerRequest;
  host.petVisible = inputs.petVisible;
  host.trackInfoCard = inputs.trackInfoCard;
  host.roadblockHud = inputs.roadblockHud;
  host.cameraShake = dependencies.createCameraShake(inputs.random,
    host.cameraEffectAnchor);
  host.rankRoster = dependencies.createRankRoster(race.roster, playerId);
  host.lightFactor = dependencies.createLightFactor(inputs.random);

  const local = assets.participants.find(participant =>
    participant.playerId === playerId)!;
  host.tachometer = local.vehicle.tachometerRenderer;
  host.tachometer.enableUiSmoothing();
  host.gaugePreserve.configure(local.vehicle.tachometerSelection.folder);
  host.action2d = dependencies.createAction2d(inputs.actionAssets);
  host.action2d.enableUiSmoothing();
  host.drive.configureP3528ResolutionMode();
  host.surround.configureP3528ResolutionMode();

  const track = runtime.local.track;
  host.scene.add(track.group);
  dependencies.applyTrackFog(host.scene, track);
  if (assets.rain) host.scene.add(assets.rain.object);
  if (assets.snow) host.scene.add(assets.snow.object);
  try {
    for (const participant of assets.participants) {
      const vehicle = participant.vehicle;
      const view = dependencies.createRacerView(host.scene);
      host.views.set(participant.playerId, view);
      if (participant.playerId === playerId) {
        host.scene.add(...dependencies.vehicleParts(vehicle));
      } else {
        host.scene.add(vehicle.trails.object);
      }
      view.setModel(vehicle.imported.object, vehicle.visual,
        vehicle.imported.animation, vehicle.imported.model,
        vehicle.imported.scene);

      const sourceRoot = dependencies.serializedRoot(vehicle.imported.model);
      const riderSource = sourceRoot.children[6]?.value;
      const riderMount = riderSource && "children" in (riderSource as object)
        ? vehicle.imported.renderScene?.bySource.get(riderSource)
        : undefined;
      const character = participant.characters.linked ??
        participant.characters.ordinary;
      if (character) {
        if (!riderMount) throw new Error("多人赛车缺少原角色挂点。");
        riderMount.clear();
        riderMount.add(character.scene.object);
        character.scene.object.scale.setScalar(vehicle.visual.onCharacterSize);
        if (participant.characters.linked) {
          const vehicleRoot = vehicle.imported.renderScene?.bySource.get(sourceRoot);
          if (!vehicleRoot || !character.award) {
            throw new Error("多人联动角色的车体显示或领奖资源未就绪。");
          }
          const linked = dependencies.createLinkedPresentation(vehicleRoot,
            riderMount, character.scene.object,
            vehicle.kartItem.alwaysLinkCharacter);
          linked.resetForRacePresentation();
          host.linkedPresentations.set(participant.playerId, linked);
        }
      }
      for (const accessory of vehicle.accessories) {
        if (!character) throw new Error("多人角色饰品缺少角色。");
        const socketName = accessory.kind === "aura"
          ? undefined : dependencies.accessorySockets[accessory.kind];
        const socket = socketName
          ? character.scene.getDecorationSocket(socketName[0], socketName[1])
          : character.scene.getDecorationOwner();
        if (!socket) throw new Error("多人角色饰品挂点缺失。");
        socket.add(accessory.render.scene.object);
        if (accessory.kind === "aura") {
          if (!riderMount) throw new Error("多人赛车缺少炫光车体挂点。");
          const vehicleRoot = vehicle.imported.renderScene?.bySource.get(sourceRoot);
          if (!vehicleRoot) throw new Error("多人赛车缺少炫光车体根节点。");
          dependencies.attachAura(socket, vehicleRoot,
            accessory.render.scene.object);
        }
      }
      if (vehicle.decoration) {
        const socket = view.getAttachment(16);
        if (!socket) throw new Error("多人赛车缺少气球挂点。");
        socket.add(vehicle.decoration.scene.object);
      }
      if (assets.drivingMode?.kind === "giant") {
        const vehicleBindings = vehicle.imported.renderScene?.rootMaterialBindings;
        // A racer may deliberately have no character equipped. Giant effects
        // still apply to the kart's material bindings in that case.
        const characterBindings = character
          ? character.scene.rootMaterialBindings : [];
        if (!vehicleBindings || !characterBindings) {
          throw new Error("巨人模型缺少独立材料继承 consumer。");
        }
        host.giantAppearances.set(participant.playerId,
          dependencies.createGiantAppearance(participant.playerId === playerId,
            vehicleBindings, characterBindings));
      }
      const startPose = runtime.local.startPose;
      const position = dependencies.startPosition(startPose.position,
        startPose.right, race.startSlots[participant.playerId],
        (from, to) => track.rayQuery(from, to, false)?.point);
      host.initialPoses.set(participant.playerId,
        { ...startPose, position });
      view.updatePose({
        x: position.x,
        y: position.y,
        z: position.z,
        ...startPose,
        visualScale: { x: 1, y: 1, z: 1 },
      });
      if (assets.drivingMode?.kind === "shadow" &&
        participant.playerId !== playerId) {
        host.shadowPresentations.set(participant.playerId,
          dependencies.createShadowPresentation(vehicle.imported.object));
      }
    }
  } catch (error) {
    host.dispose();
    throw error;
  }
}
