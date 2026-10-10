import { NormalObjectCoordinator, type NormalObject } from "./normal-coordinator";

export interface RacePosition { x: number; y: number; z: number }
export interface RaceRouteState { distance: number; [key: string]: unknown }
export interface CoordinatedKart {
  body: { position: RacePosition };
  state: { trackProgress: number };
  update(timeMs: number, input: unknown, track: CoordinatedTrack): unknown;
  handleRouteSurfaceTag(tag: unknown): void;
  contactRailId?(): unknown;
}
export interface CoordinatedTrack {
  updateObstacles(timeMs: number, kartPosition: RacePosition): void;
  registerObstaclePair(kartPosition: RacePosition): void;
  commitObstacleSnapshot(): void;
  updateEvents(timeMs: number): void;
  registerEventPairs(kartPosition: RacePosition, timeMs: number): void;
  commitEventSnapshot(): void;
  runOuterRoutePass(kart: CoordinatedKart, previous: RacePosition, current: RacePosition,
    onTag: (tag: unknown, detail: unknown) => void): RaceRouteState;
  getRouteState(kart: CoordinatedKart): RaceRouteState;
  completeRailContactLanding(kart: CoordinatedKart, position: RacePosition,
    onTag: (tag: unknown, detail: unknown) => void): boolean;
  completeWarpNextRailLanding(kart: CoordinatedKart,
    onTag: (tag: unknown, detail: unknown) => void): boolean;
}
export interface NormalRaceModes {
  isSoloMode(token: unknown): boolean;
  isMultiplayerMode(token: unknown): boolean;
}

export function makeNormalObject(name: string, active: boolean, category = 0): NormalObject {
  return {
    name, category, active, removeRequested: false,
    slot12: () => {}, slot13: () => {}, commit: () => {}, destroy: () => {},
  };
}

export function copyRacePosition(position: RacePosition): RacePosition {
  return { x: position.x, y: position.y, z: position.z };
}

/** Coordinates the solo or multiplayer kart, track, obstacles, events and peers. */
export class NormalRaceCoordinator {
  track: CoordinatedTrack;
  kart: CoordinatedKart;
  surfaceTagSink: ((tag: unknown, detail: unknown) => void) | undefined;
  core: NormalObjectCoordinator;
  kartObject: NormalObject;
  kartPairObjects = new Set<NormalObject>();
  remoteKartPairs = new Map<NormalObject, (timeMs: number) => void>();
  previousPosition: RacePosition;
  input: unknown;
  schedule: unknown;
  route: RaceRouteState | undefined;
  pendingWarpNextRailLanding = false;

  constructor(modeToken: unknown, track: CoordinatedTrack, kart: CoordinatedKart,
    surfaceTagSink: ((tag: unknown, detail: unknown) => void) | undefined,
    modes: NormalRaceModes) {
    this.track = track;
    this.kart = kart;
    this.surfaceTagSink = surfaceTagSink;
    if (!modes.isSoloMode(modeToken) && !modes.isMultiplayerMode(modeToken))
      throw new Error("normal coordinator 缺少目标模式准入 token。");
    this.previousPosition = copyRacePosition(kart.body.position);
    const trackObject = makeNormalObject("GoTrack", false);
    const courseObject = makeNormalObject("GoCourse", true);
    const kartObject = makeNormalObject("GoPlayKart", true);
    const obstacleObject = makeNormalObject("GoItemObstacle[]", true, 2);
    const eventObject = makeNormalObject("GoItemEventObject[]", true, 2);
    this.kartObject = kartObject;
    trackObject.active = true;
    obstacleObject.slot12 = now => track.updateObstacles(now, kart.body.position);
    obstacleObject.slot13 = peer => {
      if (peer === kartObject) track.registerObstaclePair(kart.body.position);
    };
    obstacleObject.commit = () => track.commitObstacleSnapshot();
    eventObject.slot12 = now => track.updateEvents(now);
    eventObject.slot13 = (peer, now) => {
      if (peer === kartObject) track.registerEventPairs(kart.body.position, now);
    };
    eventObject.commit = () => track.commitEventSnapshot();
    kartObject.slot12 = now => {
      if (!this.input) throw new Error("normal coordinator 缺少本次 input snapshot。");
      this.schedule = kart.update(now, this.input, track);
    };
    courseObject.slot13 = peer => {
      if (peer !== kartObject) return;
      this.route = track.runOuterRoutePass(kart, this.previousPosition,
        copyRacePosition(kart.body.position), (tag, detail) => {
          kart.handleRouteSurfaceTag(tag);
          this.surfaceTagSink?.(tag, detail);
        });
      if (this.pendingWarpNextRailLanding) {
        this.pendingWarpNextRailLanding = false;
        this.completeWarpNextRailLanding();
        this.route = track.getRouteState(kart);
      }
      if (kart.contactRailId?.() && track.completeRailContactLanding(
        kart, kart.body.position, (tag, detail) => {
          kart.handleRouteSurfaceTag(tag);
          this.surfaceTagSink?.(tag, detail);
        })) this.route = track.getRouteState(kart);
      kart.state.trackProgress = this.route.distance;
    };
    kartObject.commit = () => {
      this.previousPosition = copyRacePosition(kart.body.position);
    };
    kartObject.slot13 = (peer, now) => this.remoteKartPairs.get(peer)?.(now);
    this.core = new NormalObjectCoordinator((source, peer) =>
      ((source === courseObject || source === obstacleObject ||
        source === eventObject || this.kartPairObjects.has(source)) && peer === kartObject) ||
      (source === kartObject && this.remoteKartPairs.has(peer)));
    this.core.queue(trackObject);
    this.core.queue(courseObject);
    this.core.queue(kartObject);
    this.core.queue(obstacleObject);
    this.core.queue(eventObject);
  }

  run(nowMs: number, input: unknown): { schedule: unknown; route: RaceRouteState } {
    this.input = input;
    this.schedule = undefined;
    this.route = undefined;
    try { this.core.run(nowMs); }
    finally { this.input = undefined; }
    if (!this.schedule)
      throw new Error("normal coordinator 未执行 GoPlayKart slot12。");
    if (!this.route)
      throw new Error("normal coordinator 未执行 GoCourse -> GoPlayKart slot13。");
    return { schedule: this.schedule, route: this.route };
  }

  synchronizePositionAnchor(): void {
    this.previousPosition = copyRacePosition(this.kart.body.position);
  }

  deferWarpNextRailLanding(): void { this.pendingWarpNextRailLanding = true; }

  completeWarpNextRailLanding(): boolean {
    const completed = this.track.completeWarpNextRailLanding(this.kart, (tag, detail) => {
      this.kart.handleRouteSurfaceTag(tag);
      this.surfaceTagSink?.(tag, detail);
    });
    if (completed)
      this.kart.state.trackProgress = this.track.getRouteState(this.kart).distance;
    return completed;
  }

  isKartPeer(object: NormalObject): boolean { return object === this.kartObject; }

  queueKartPairObject(object: NormalObject): void {
    if (object.category !== 2)
      throw new Error(`${object.name} 不是 P3528 category-2 track item。`);
    this.kartPairObjects.add(object);
    this.core.queue(object);
  }

  dispose(): void {
    this.core.dispose();
    this.kartPairObjects.clear();
    this.remoteKartPairs.clear();
  }

  queueRemoteKart(object: NormalObject, onPair: (timeMs: number) => void): void {
    if (object.category !== 0) throw Error("GoNetKart must use category 0");
    this.core.queue(object);
    this.remoteKartPairs.set(object, onPair);
  }
}
