/** Read-only track object diagnostics for the optional development overlays. */

export interface TrackDiagnosticSession {
  track?: {
    data: unknown;
    getRouteState(physics: unknown): unknown;
  };
  physics?: unknown;
  admission?: { parsed: { root?: { kind: string; trackObjects: unknown[] } } };
  trackMetadata?: unknown;
  toonEnvironment?: unknown;
}

export interface TrackDiagnosticHost {
  session: TrackDiagnosticSession;
  devToolsTrackObjectSelection?: unknown;
  devToolsCollectorInstance?: { trackObjectSnapshots(objects: unknown[]): unknown[] };
  rhoLibrary?: unknown;
  toonStageBinding: unknown;
  assets: { generationValue: unknown; isCurrent(generation: unknown): boolean };
  devToolsTrackObjects(): unknown[];
  devToolsTrackOwner(): TrackDiagnosticOwner | undefined;
}

export interface TrackDiagnosticOwner {
  data: unknown;
  routeState: unknown;
  trackObjects: unknown[];
  visibleKinds: unknown;
}

export interface TrackObjectSource {
  objects: unknown[];
  visibleKinds: unknown;
  itemCube?: {
    library: unknown;
    metadata: unknown;
    environment: unknown;
    stageBinding: unknown;
    generation: unknown;
    isGenerationCurrent(generation: unknown): boolean;
  };
}

/** Route computation is diagnostic only; failure leaves the owner usable. */
export function devToolsTrackOwner(
  host: TrackDiagnosticHost,
  defaultVisibleKinds: unknown,
): TrackDiagnosticOwner | undefined {
  const track = host.session.track;
  if (!track) return undefined;
  const physics = host.session.physics;
  let routeState: unknown;
  if (physics) {
    try {
      routeState = track.getRouteState(physics);
    } catch {
      routeState = undefined;
    }
  }
  return {
    data: track.data,
    routeState,
    trackObjects: host.devToolsTrackObjects(),
    visibleKinds: host.devToolsTrackObjectSelection ?? defaultVisibleKinds,
  };
}

/** Track admission is the authority for overlay object enumeration. */
export function devToolsTrackObjects(host: TrackDiagnosticHost): unknown[] {
  const root = host.session.admission?.parsed.root;
  return !root || root.kind !== "track" ? [] : root.trackObjects;
}

/** Build an item-cube source only when library, metadata, and environment exist. */
export function devToolsTrackObjectsSource(
  host: TrackDiagnosticHost,
): TrackObjectSource | undefined {
  const owner = host.devToolsTrackOwner();
  if (!owner) return undefined;
  const collector = host.devToolsCollectorInstance;
  const library = host.rhoLibrary;
  const metadata = host.session.trackMetadata;
  const environment = host.session.toonEnvironment;
  return {
    objects: collector ? collector.trackObjectSnapshots(owner.trackObjects) : [],
    visibleKinds: owner.visibleKinds,
    itemCube: library && metadata && environment
      ? {
          library,
          metadata,
          environment,
          stageBinding: host.toonStageBinding,
          generation: host.assets.generationValue,
          isGenerationCurrent: generation => host.assets.isCurrent(generation),
        }
      : undefined,
  };
}
