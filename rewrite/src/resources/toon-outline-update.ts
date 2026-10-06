import { BufferAttribute, type BufferGeometry, type Camera, type Matrix4 } from "three";
import type { OutlineProfileEntry } from "./toon-outline-geometry";

export interface ToonOverride {
  selector: number;
  centerArgb: number;
  outerArgb: number;
}
export interface ToonBody {
  matrixWorld: Matrix4;
  geometry: BufferGeometry;
}
export interface ToonFrameCache {
  generation: number;
  width: number;
  height: number;
}
export interface ToonOutlineUpdateHost {
  drawOutline: boolean;
  frameProfile: OutlineProfileEntry[];
  frameOverride?: ToonOverride;
  centerColor: number[];
  outerColor: number[];
  originalCenterColor: number[];
  originalOuterColor: number[];
  updateSerial: number;
  frameEmitted: boolean;
  frameViewportValue?: { width: number; height: number };
  frameSortZ: number;
  frameWorldX: number;
  frameWorldY: number;
  frameWorldZ: number;
  cachedBody?: ToonBody;
  cachedProjection?: Float32Array;
  cachedPosition?: BufferAttribute;
  cachedPositionVersion: number;
  bodyIndex?: BufferAttribute;
  cachedIndexVersion: number;
  cachedWidth: number;
  cachedHeight: number;
  cachedProfile?: OutlineProfileEntry[];
  cachedEnabled: boolean;
  cachedEmitted: boolean;
  cachedViewport?: { width: number; height: number };
  material: { uniforms: Record<string, { value: { set(width: number, height: number): void } }> };
  geometry: { setDrawRange(start: number, count: number): void };
  projectVertices(matrix: Matrix4, camera: Camera, width: number, height: number,
    cache?: ToonFrameCache, rigid?: boolean): boolean;
  classifyFaces(): void;
  updateBodyGeometry(geometry: BufferGeometry): void;
  resetFrameWorkspace(): void;
  buildLinks(): void;
  emitOpenSections(): void;
  emitClosedSections(): void;
  emitConflicts(): void;
  expandStrip(): void;
  publishGeometry(): void;
  rememberRigidFrame(body: ToonBody, width: number, height: number): void;
}
export interface ToonOutlineUpdateDependencies {
  profileForSelector1: OutlineProfileEntry[];
  profileForOtherSelector: OutlineProfileEntry[];
  defaultProfile: OutlineProfileEntry[];
  enabled: boolean;
  overrideForObject(body: ToonBody): ToonOverride | undefined;
  colorFromArgb(argb: number): number[];
  nextSerial(): number;
  projectedDepth(body: ToonBody, camera: Camera): number;
}

/** Advances the released silhouette pipeline and its rigid-frame cache. */
export function updateToonOutline(host: ToonOutlineUpdateHost, body: ToonBody,
  camera: Camera, width: number, height: number,
  progress: ((phase: string) => void) | undefined,
  projectionCache: ToonFrameCache | undefined,
  deps: ToonOutlineUpdateDependencies): void {
  const override = deps.overrideForObject(body);
  host.frameProfile = override
    ? override.selector === 1 ? deps.profileForSelector1 : deps.profileForOtherSelector
    : deps.defaultProfile;
  if (override?.centerArgb !== host.frameOverride?.centerArgb ||
      override?.outerArgb !== host.frameOverride?.outerArgb) {
    const center = override ? deps.colorFromArgb(override.centerArgb) : host.originalCenterColor;
    const outer = override ? deps.colorFromArgb(override.outerArgb) : host.originalOuterColor;
    host.centerColor.splice(0, host.centerColor.length, ...center);
    host.outerColor.splice(0, host.outerColor.length, ...outer);
    host.cachedBody = undefined;
  }
  host.frameOverride = override;
  host.updateSerial = deps.nextSerial();
  host.frameEmitted = false;
  host.frameViewportValue = undefined;
  host.frameSortZ = deps.projectedDepth(body, camera);
  const matrix = body.matrixWorld.elements;
  host.frameWorldX = matrix[12]!;
  host.frameWorldY = matrix[13]!;
  host.frameWorldZ = matrix[14]!;

  const position = body.geometry.getAttribute("position");
  const index = body.geometry.getIndex();
  const rigidFrame = position instanceof BufferAttribute &&
    host.cachedProjection !== undefined && host.cachedBody === body &&
    host.cachedPosition === position &&
    host.cachedPositionVersion === position.version &&
    index === host.bodyIndex && host.cachedIndexVersion === index?.version &&
    host.cachedWidth === width && host.cachedHeight === height &&
    host.cachedProfile === host.frameProfile && host.cachedEnabled === deps.enabled;
  if (host.projectVertices(body.matrixWorld, camera, width, height,
    projectionCache, rigidFrame)) {
    host.frameEmitted = host.cachedEmitted;
    host.frameViewportValue = host.cachedViewport;
    return;
  }
  host.cachedBody = undefined;
  progress?.("toon-project");
  host.classifyFaces();
  progress?.("toon-classify");
  host.updateBodyGeometry(body.geometry);
  progress?.("toon-body");
  if (!host.drawOutline || !deps.enabled) {
    host.geometry.setDrawRange(0, 0);
    host.rememberRigidFrame(body, width, height);
    return;
  }
  host.resetFrameWorkspace();
  host.buildLinks();
  host.emitOpenSections();
  host.emitClosedSections();
  host.emitConflicts();
  host.expandStrip();
  progress?.("toon-emit");
  host.publishGeometry();
  progress?.("toon-publish");
  host.material.uniforms.viewportPx!.value.set(width, height);
  host.frameEmitted = true;
  host.frameViewportValue = { width, height };
  host.rememberRigidFrame(body, width, height);
}
