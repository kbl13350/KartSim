/** Mounts a Ghost kart model, driver, and cosmetics into its visual scene. */

interface SceneObject {
  add(child: unknown): void;
  clear(): void;
}

interface SerializedNode {
  children?: Array<{ value?: object }>;
}

interface ImportedGhostKart {
  model: unknown;
  scene: { nodes: Map<string, { object: SceneObject }> };
  object: unknown;
  animation: unknown;
  renderScene?: {
    bySource: Map<object, SceneObject>;
  };
}

interface GhostCharacter {
  object: SceneObject & { scale: { setScalar(scale: number): void } };
  getDecorationSocket(first: unknown, second: unknown): SceneObject | undefined;
}

interface GhostDecoration {
  kind: string;
  render: {
    scene: { reset(nowMs: number): void; object: SceneObject };
  };
}

interface GhostBalloon {
  scene: { reset(nowMs: number): void; object: SceneObject };
}

export interface GhostVisualAssetHost {
  usesP3553NonDualLinkedState: boolean;
  linkedPresentation?: { setMode(mode: number): void };
  imported?: ImportedGhostKart;
  character?: GhostCharacter;
  animation?: unknown;
  visual?: { attachments: string[] };
  motorcycle?: unknown;
  modelMount: SceneObject;
  toonPairs: unknown[];
  attachmentNodes: Array<SceneObject | undefined>;
  balloon?: GhostBalloon;
  accessories: GhostDecoration[];
}

export interface GhostVisualAssetDependencies {
  serializedRoot(model: unknown): SerializedNode;
  createLinkedPresentation(root: SceneObject, mount: SceneObject,
    character: SceneObject, always: boolean): { setMode(mode: number): void };
  collectToonPairs(object: SceneObject, pairs?: unknown[]): void;
  createBalloonMount(model: unknown,
    scene: ImportedGhostKart["scene"]): SceneObject;
  decorationSockets: Record<string, [unknown, unknown]>;
  nowMs(): number;
}

export function setGhostVisualAssets(host: GhostVisualAssetHost,
  imported: ImportedGhostKart, character: GhostCharacter | undefined,
  characterScale: number, linkedMode: string | undefined,
  visual: { attachments: string[] }, motorcycle: unknown,
  resourceFormat: string, featureLevel: number,
  dependencies: GhostVisualAssetDependencies): void {
  host.usesP3553NonDualLinkedState = resourceFormat === "p3553" &&
    featureLevel <= 6;
  const serializedRoot = dependencies.serializedRoot(imported.model);
  const renderRoot = imported.renderScene?.bySource.get(serializedRoot);
  if (!renderRoot) {
    throw new Error("影子 ReKart serialized root presentation 缺失。");
  }
  if (character) {
    const child = serializedRoot.children?.[6]?.value;
    const characterMount = child && "children" in child
      ? imported.renderScene?.bySource.get(child) : undefined;
    if (!characterMount) {
      throw new Error("影子 ReKart root child 6 mount 缺失。");
    }
    characterMount.clear();
    characterMount.add(character.object);
    if (linkedMode) {
      host.linkedPresentation = dependencies.createLinkedPresentation(
        renderRoot, characterMount, character.object,
        linkedMode === "always");
      host.linkedPresentation.setMode(0);
    } else {
      character.object.scale.setScalar(characterScale);
    }
  }
  host.imported = imported;
  host.character = character;
  host.animation = imported.animation;
  host.visual = visual;
  host.motorcycle = motorcycle;
  host.modelMount.add(imported.object);
  host.toonPairs.length = 0;
  dependencies.collectToonPairs(host.modelMount, host.toonPairs);
  const attachments = visual.attachments.map(name =>
    imported.scene.nodes.get(name)?.object);
  if (!attachments[16] && visual.attachments[16] === "balloon") {
    attachments[16] = dependencies.createBalloonMount(
      imported.model, imported.scene);
  }
  host.attachmentNodes = attachments;
}

export function setGhostVisualDecorations(host: GhostVisualAssetHost,
  balloon: GhostBalloon | undefined, accessories: GhostDecoration[],
  dependencies: GhostVisualAssetDependencies): void {
  const balloonMount = host.attachmentNodes[16];
  if (balloon && balloonMount) {
    balloon.scene.reset(dependencies.nowMs());
    balloonMount.add(balloon.scene.object);
    dependencies.collectToonPairs(balloon.scene.object);
    host.balloon = balloon;
  }
  for (const accessory of accessories) {
    const socket = dependencies.decorationSockets[accessory.kind];
    const mount = host.character?.getDecorationSocket(socket![0], socket![1]);
    if (mount) {
      accessory.render.scene.reset(dependencies.nowMs());
      mount.add(accessory.render.scene.object);
      dependencies.collectToonPairs(accessory.render.scene.object);
      host.accessories = [...host.accessories, accessory];
    }
  }
}
