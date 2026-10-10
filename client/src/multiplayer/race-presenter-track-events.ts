/** Loads the live multiplayer track's local effects and independent sounds. */

interface Projection { sound?: unknown; [key: string]: unknown }
interface Disposable { dispose(): void }

export interface RacePresenterTrackEventsHost {
  disposed: boolean;
  playerId: unknown;
  assets: {
    map: {
      eventProjections: Projection[];
      environment: unknown;
      stageBinding: unknown;
      renderScene?: { clientWorldElements?: unknown };
      dummySounds: unknown[];
    };
  };
  views: Map<unknown, { presentationRoot(): unknown }>;
  trackEventEffects?: Disposable;
  trackEventAudio?: Disposable;
  trackDummyAudio?: Disposable;
}

export interface RacePresenterTrackEventsDependencies {
  loadEffects(library: unknown, projections: Projection[], root: unknown,
    environment: unknown, binding: unknown,
    audioContext: unknown): Promise<Disposable>;
  loadAudio(library: unknown, projections: Projection[], worldElements: unknown,
    audioContext: unknown): Promise<Disposable>;
  loadDummyAudio(library: unknown, sounds: unknown[],
    audioContext: unknown): Promise<Disposable>;
}

export async function prepareRacePresenterTrackEvents(
  host: RacePresenterTrackEventsHost, library: unknown,
  audioContext: unknown,
  dependencies: RacePresenterTrackEventsDependencies): Promise<void> {
  if (host.disposed) throw new Error("多人赛道场景已经释放。");
  const map = host.assets.map;
  const projections = map.eventProjections;
  const localRoot = projections.length > 0
    ? host.views.get(host.playerId)?.presentationRoot() : undefined;
  if (projections.length > 0 && !localRoot) {
    throw new Error("多人事件效果缺少本机车辆挂点。");
  }
  const effects = localRoot
    ? await dependencies.loadEffects(library, projections, localRoot,
      map.environment, map.stageBinding, audioContext)
    : undefined;
  let audio: Disposable | undefined;
  let dummyAudio: Disposable | undefined;
  try {
    const worldElements = map.renderScene?.clientWorldElements;
    if (projections.some(projection => projection.sound) && !worldElements) {
      throw new Error("多人事件独立音效缺少赛道世界矩阵。");
    }
    audio = worldElements && projections.some(projection => projection.sound)
      ? await dependencies.loadAudio(library, projections,
        worldElements, audioContext) : undefined;
    dummyAudio = map.dummySounds.length > 0
      ? await dependencies.loadDummyAudio(library, map.dummySounds,
        audioContext) : undefined;
    if (host.disposed) {
      effects?.dispose();
      audio?.dispose();
      dummyAudio?.dispose();
      throw new Error("多人赛道场景载入期间已释放。");
    }
    host.trackEventEffects = effects;
    host.trackEventAudio = audio;
    host.trackDummyAudio = dummyAudio;
  } catch (error) {
    effects?.dispose();
    audio?.dispose();
    dummyAudio?.dispose();
    throw error;
  }
}
