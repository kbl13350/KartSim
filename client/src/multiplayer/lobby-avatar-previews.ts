/** Lobby roster's character previews, emotion actions and renderer lifetime. */

interface Equipment {
  itemIds: Record<number, number>;
  systemKart?: unknown;
  systemKartVariant?: string;
}
interface Member {
  playerId: string;
  name: string;
  equipment: Equipment;
  initial?: string;
  [key: string]: unknown;
}
interface Room { members: Member[]; [key: string]: unknown }
interface KartItem {
  itemId: number;
  systemKey?: unknown;
  engineGrade: unknown;
  linkCharacterId?: number;
  alwaysLinkCharacter?: boolean;
}
interface CharacterItem { itemId: number; path: string }
interface ResourceLibrary {
  timeAttackGarageCatalog(): Promise<{
    karts: KartItem[];
    characters: CharacterItem[];
  }>;
}
interface Environment { dispose(): void }
interface Binding { beginFrame(nowMs: number): void; dispose(): void }
interface Renderer {
  outputColorSpace: unknown;
  setClearColor(color: number, alpha: number): void;
  setSize(width: number, height: number, updateStyle: boolean): void;
  dispose(): void;
}
interface Preview {
  scene: { matrixWorldAutoUpdate: boolean };
  reverse: boolean;
  roomMotion?: { request(action: number): void };
  kart: { animation: { updateCurrentState(nowMs: number): void } };
  flyingPet?: { update(nowMs: number, camera: unknown,
    width: number, height: number): void };
  decorations: Array<{ scene: { update(nowMs: number, camera: unknown,
    width: number, height: number): void } }>;
}
interface AvatarValue { preview: Preview; characterPath: string; camera: unknown }
interface Slots {
  update(room: Room): void;
  get(playerId: string): AvatarValue | undefined;
  dispose(): void;
}
interface EmotionAudio { play(characterPath: string, name: string): void;
  dispose(): void }

export interface LobbyAvatarPreviewDependencies {
  createBinding(): Binding;
  createEmotionAudio(library: ResourceLibrary, audioContext: unknown,
    failed: (error: unknown) => void): EmotionAudio;
  loadEnvironment(library: ResourceLibrary): Promise<Environment>;
  createSlots(build: (member: Member, team: unknown) => Promise<AvatarValue>,
    release: (value: AvatarValue) => void,
    changed: () => void, failed: (error: unknown) => void): Slots;
  disposePreview(preview: Preview): void;
  gameplayMode(room: Room): string;
  rpEquipment(equipment: Equipment,
    replacement: { kartId: number; flyingPetId: number }): Equipment;
  systemKart(karts: KartItem[], itemId: number,
    modelPath: string, systemKey: unknown): KartItem;
  loadAppearance(library: ResourceLibrary, equipment: Equipment,
    team: unknown, grade: unknown, initial?: string): Promise<unknown>;
  loadPreview(library: ResourceLibrary, kart: KartItem,
    character: CharacterItem, environment: Environment, binding: Binding,
    parts: unknown, mode: "ready", appearance: unknown,
    optional: undefined, lobbyPreview: true): Promise<Preview>;
  createParts(): unknown;
  createCamera(team: unknown, reverse: boolean, linkedCharacterId?: number,
    alwaysLink?: boolean, kartId?: number): unknown;
  createRenderer(options: { alpha: true; preserveDrawingBuffer: true }): Renderer;
  outputColorSpace: unknown;
  updatePreview(preview: Preview, nowMs: number, camera: unknown,
    width: number, height: number): void;
  drawPreview(renderer: Renderer, canvas: unknown, rect: unknown,
    render: () => void): void;
  renderScene(renderer: Renderer, scene: Preview["scene"], camera: unknown): void;
}

export class LobbyAvatarPreviews {
  readonly binding: Binding;
  readonly slots: Slots;
  readonly environment: Promise<Environment>;
  readonly emotionAudio: EmotionAudio;
  renderer?: Renderer;
  pending = 0;
  disposed = false;
  released = false;
  readonly pendingActions = new Map<string, number>();

  constructor(readonly library: ResourceLibrary,
    changed: () => void, failed: (error: unknown) => void,
    readonly emotions: Array<{ index: number; soundName?: string }> = [],
    audioContext: unknown,
    readonly dependencies: LobbyAvatarPreviewDependencies) {
    this.binding = dependencies.createBinding();
    this.emotionAudio = dependencies.createEmotionAudio(library,
      audioContext, failed);
    this.environment = dependencies.loadEnvironment(library);
    this.environment.catch(() => {});
    this.slots = dependencies.createSlots(
      (member, team) => this.build(member, team),
      value => dependencies.disposePreview(value.preview), changed, failed);
  }

  update(room: Room): void {
    for (const playerId of this.pendingActions.keys()) {
      if (!room.members.some(member => member.playerId === playerId)) {
        this.pendingActions.delete(playerId);
      }
    }
    const previewRoom = this.dependencies.gameplayMode(room) === "rp"
      ? { ...room, members: room.members.map(member => member.equipment
        ? { ...member, equipment: this.dependencies.rpEquipment(
          member.equipment, { kartId: 795, flyingPetId: 0 }) }
        : member) }
      : room;
    this.slots.update(previewRoom);
  }

  play(playerId: string, action: number): void {
    this.pendingActions.set(playerId, action);
  }

  async build(member: Member, team: unknown): Promise<AvatarValue> {
    this.pending++;
    try {
      const equipment = member.equipment;
      const [catalog, environment] = await Promise.all([
        this.library.timeAttackGarageCatalog(), this.environment,
      ]);
      let kart = catalog.karts.find(item => item.itemId === equipment.itemIds[3]
        && (item.itemId !== 0 || item.systemKey === equipment.systemKart));
      if (kart && equipment.systemKartVariant) {
        kart = this.dependencies.systemKart(catalog.karts, 0,
          `kart_/${equipment.systemKartVariant}/model.1s`, equipment.systemKart);
      }
      const character = catalog.characters.find(item =>
        item.itemId === equipment.itemIds[1]);
      if (!kart || !character) {
        throw new Error(`${member.name} 的装备资源未收录。`);
      }
      const appearance = await this.dependencies.loadAppearance(this.library,
        equipment, team, kart.engineGrade, member.initial);
      const preview = await this.dependencies.loadPreview(this.library,
        kart, character, environment, this.binding,
        this.dependencies.createParts(), "ready", appearance, undefined, true);
      preview.scene.matrixWorldAutoUpdate = false;
      return { preview, characterPath: character.path,
        camera: this.dependencies.createCamera(team, preview.reverse,
          kart.linkCharacterId, kart.alwaysLinkCharacter, kart.itemId) };
    } finally {
      this.pending--;
      this.releaseResources();
    }
  }

  paint(playerId: string, canvas: unknown, rect: unknown, nowMs: number): void {
    if (this.disposed) return;
    const value = this.slots.get(playerId);
    if (!value) return;
    if (!this.renderer) {
      this.renderer = this.dependencies.createRenderer({
        alpha: true, preserveDrawingBuffer: true,
      });
      this.renderer.outputColorSpace = this.dependencies.outputColorSpace;
      this.renderer.setClearColor(0, 0);
      this.renderer.setSize(245, 308, false);
    }
    const renderer = this.renderer;
    const { preview, camera } = value;
    const action = this.pendingActions.get(playerId);
    if (action !== undefined) {
      preview.roomMotion?.request(action);
      const sound = this.emotions.find(emotion =>
        emotion.index === action)?.soundName;
      if (sound) this.emotionAudio.play(value.characterPath, sound);
      this.pendingActions.delete(playerId);
    }
    this.binding.beginFrame(nowMs);
    preview.kart.animation.updateCurrentState(nowMs);
    this.dependencies.updatePreview(preview, nowMs, camera, 245, 308);
    preview.flyingPet?.update(nowMs, camera, 245, 308);
    preview.decorations.forEach(decoration =>
      decoration.scene.update(nowMs, camera, 245, 308));
    this.dependencies.drawPreview(renderer, canvas, rect, () =>
      this.dependencies.renderScene(renderer, preview.scene, camera));
  }

  dispose(): void {
    this.disposed = true;
    this.slots.dispose();
    this.emotionAudio.dispose();
    this.renderer?.dispose();
    this.renderer = undefined;
    this.releaseResources();
  }

  releaseResources(): void {
    if (!this.disposed || this.pending || this.released) return;
    this.released = true;
    this.environment.then(environment => {
      this.binding.dispose();
      environment.dispose();
    }, () => this.binding.dispose());
  }
}
