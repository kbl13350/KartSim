import {
  sampleRoute,
  projectSectionDistance,
  type RouteSection,
  type RouteState,
  type Vec3,
} from "./route";
import {
  associateRoute, commitCurrentSectionReset, completeRailContactLanding,
  completeWarpNextRailLanding, currentRouteSurface, prepareCurrentSectionReset,
  lookupRailConfig, railCaptureDistance, warpNextDestination,
  refreshRouteProjection, requireRouteState, resetRouteState,
  updateRoute, warpRouteToSection,
  type RailRegistryWorldHost, type RailWorldHost, type RouteTag, type RouteWorldHost,
} from "./route-state";
import {
  commitWorldEventSnapshot,
  consumeExpiredWorldEventEffects,
  expireWorldEventEffects,
  queryWorldEventObb,
  registerWorldEventPairs,
  updateWorldEvents,
  type WorldEventHost,
} from "./event-queue";
import {
  queryObstacleObb, queryTrackObb, queryTrackRay,
  type TrackCollisionHost,
} from "./collision-routing";
import {
  resetTrackRender, setTrackLensFlareEnabled, updateMovingRoads,
  updateTrackRender, type TrackRenderHost,
} from "./render-lifecycle";
import {
  commitWorldObstacleSnapshot, registerWorldObstaclePair,
  updateWorldObstacles, type WorldObstacleHost,
} from "./obstacle-lifecycle";
import { disposeTrackWorld, type TrackDisposeHost, type TrackMesh,
  type Disposable } from "./dispose";
import { D2, D9 } from "../generated/vendor.js";

interface TrackRouteHost {
  sections: readonly RouteSection[];
  requireRouteState(vehicle: object): RouteState;
}

type TrackPrototype = Record<string, unknown>;

const installed = new WeakSet<object>();

/**
 * Replaces the validated instance methods of the release TrackWorld class.
 * Its generated constructor delegates to initializeTrackWorld(); collision
 * surfaces and scene controllers are still supplied by the release runtime.
 */
export function installWorldOverrides(TrackWorld: { prototype: object }): void {
  const prototype = TrackWorld.prototype as TrackPrototype;
  if (installed.has(prototype)) return;
  prototype.projectSectionDistance = function (this: TrackRouteHost,
    position: Vec3, section: RouteSection): number {
    return projectSectionDistance(position, section);
  };
  prototype.sampleRoute = function (this: TrackRouteHost,
    vehicle: object, lookahead: number, outgoingChoice = 0) {
    return sampleRoute(this.sections, this.requireRouteState(vehicle), lookahead, outgoingChoice);
  };
  prototype.requireRouteState = function (this: RouteWorldHost, vehicle: object) {
    return requireRouteState(this, vehicle);
  };
  prototype.getRouteState = function (this: RouteWorldHost, vehicle: object) {
    return requireRouteState(this, vehicle);
  };
  prototype.getStart = function (this: { data: { start: unknown } }) {
    return this.data.start;
  };
  prototype.resetRouteState = function (this: RouteWorldHost,
    vehicle: object, position: Vec3): void {
    resetRouteState(this, vehicle, position);
  };
  prototype.refreshRouteProjection = function (this: RouteWorldHost,
    vehicle: object, position: Vec3) {
    return refreshRouteProjection(this, vehicle, position);
  };
  prototype.warpRouteToSection = function (this: RouteWorldHost,
    vehicle: object, sectionIndex: number): void {
    warpRouteToSection(this, vehicle, sectionIndex);
  };
  prototype.currentRouteSurface = function (this: RouteWorldHost, vehicle: object) {
    return currentRouteSurface(this, vehicle);
  };
  prototype.prepareCurrentSectionReset = function (this: RouteWorldHost, vehicle: object) {
    return prepareCurrentSectionReset(this, vehicle);
  };
  prototype.commitCurrentSectionReset = function (this: RouteWorldHost, vehicle: object): void {
    commitCurrentSectionReset(this, vehicle);
  };
  prototype.updateRoute = function (this: RouteWorldHost,
    vehicle: object, previous: Vec3, current: Vec3, onTag?: RouteTag) {
    return updateRoute(this, vehicle, previous, current, onTag);
  };
  prototype.runOuterRoutePass = function (this: {
    updateRoute(vehicle: object, previous: Vec3, current: Vec3, onTag?: RouteTag): unknown;
    requireRouteState(vehicle: object): RouteState;
  }, vehicle: object, previous: Vec3, current: Vec3, onTag?: RouteTag,
  updateEnabled = true, routeEnabled = true): RouteState {
    if (updateEnabled && routeEnabled) this.updateRoute(vehicle, previous, current, onTag);
    return this.requireRouteState(vehicle);
  };
  prototype.associateRoute = function (this: RouteWorldHost,
    vehicle: object, position: Vec3): boolean {
    return associateRoute(this, vehicle, position);
  };
  prototype.warpNextDestination = function (this: RouteWorldHost, vehicle: object) {
    return warpNextDestination(this, vehicle);
  };
  prototype.completeWarpNextRailLanding = function (this: RouteWorldHost,
    vehicle: object, onTag?: RouteTag): boolean {
    return completeWarpNextRailLanding(this, vehicle, onTag);
  };
  prototype.railCaptureDistance = function (this: RailWorldHost): number {
    return railCaptureDistance(this);
  };
  prototype.lookupRailConfig = function (this: RailRegistryWorldHost, id: string) {
    return lookupRailConfig(this, id);
  };
  prototype.completeRailContactLanding = function (this: RailWorldHost,
    vehicle: object, position: Vec3, onTag?: RouteTag): boolean {
    return completeRailContactLanding(this, vehicle, position, onTag);
  };
  prototype.updateEvents = function (this: WorldEventHost, timeMs: number): void {
    updateWorldEvents(this, timeMs);
  };
  prototype.registerEventPairs = function (this: WorldEventHost,
    position: Vec3, timeMs: number): void {
    registerWorldEventPairs(this, position, timeMs);
  };
  prototype.expireEventEffects = function (this: WorldEventHost, timeMs: number): void {
    expireWorldEventEffects(this, timeMs);
  };
  prototype.consumeExpiredEventEffects = function (this: WorldEventHost) {
    return consumeExpiredWorldEventEffects(this);
  };
  prototype.commitEventSnapshot = function (this: WorldEventHost): void {
    commitWorldEventSnapshot(this);
  };
  prototype.queryEventObb = function (this: WorldEventHost,
    box: unknown, filter: unknown) {
    return queryWorldEventObb(this, box, filter);
  };
  prototype.rayQuery = function (this: TrackCollisionHost,
    origin: Vec3, movement: Vec3, includeWalls: boolean) {
    return queryTrackRay(this, origin, movement, includeWalls);
  };
  prototype.queryObb = function (this: TrackCollisionHost, box: unknown) {
    return queryTrackObb(this, box);
  };
  prototype.queryObstacleObb = function (this: TrackCollisionHost, box: unknown) {
    return queryObstacleObb(this, box);
  };
  prototype.updateRender = function (this: TrackRenderHost,
    timeMs: number, frame: unknown, camera: unknown, viewport: unknown): void {
    updateTrackRender(this, timeMs, frame, camera, viewport);
  };
  prototype.setLensFlareEnabled = function (this: TrackRenderHost, enabled: boolean): void {
    setTrackLensFlareEnabled(this, enabled);
  };
  prototype.resetRender = function (this: TrackRenderHost,
    timeMs: number, frame: unknown, camera: unknown, viewport: unknown): void {
    resetTrackRender(this, timeMs, frame, camera, viewport);
  };
  prototype.updateMovingRoads = function (this: TrackRenderHost, timeMs: number): void {
    updateMovingRoads(this, timeMs);
  };
  prototype.updateObstacles = function (this: WorldObstacleHost,
    timeMs: number, pairedPosition: Vec3): void {
    updateWorldObstacles(this, timeMs, pairedPosition);
  };
  prototype.registerObstaclePair = function (this: WorldObstacleHost,
    position: Vec3): void {
    registerWorldObstaclePair(this, position);
  };
  prototype.commitObstacleSnapshot = function (this: WorldObstacleHost): void {
    commitWorldObstacleSnapshot(this);
  };
  prototype.dispose = function (this: TrackDisposeHost): void {
    disposeTrackWorld(this,
      (object): object is TrackMesh => object instanceof D2,
      (object): object is Disposable => object instanceof D9);
  };
  installed.add(prototype);
}
