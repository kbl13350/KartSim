interface CheckpointPose { surface: string }

interface CheckpointPhysics {
  canHandleRouteSurfaceTag(tag: string): boolean;
  completeCheckpointPose(pose: CheckpointPose, alignCamera: boolean): void;
  prepareRailCheckpointReentry(): void;
  setFullPhysicsBypass(enabled: boolean): void;
  restoreResetInteraction(): void;
  warpPosition(position: unknown): void;
}

interface CheckpointTrack {
  warpRouteToSection(physics: CheckpointPhysics, section: number): void;
  prepareCurrentSectionReset(physics: CheckpointPhysics): CheckpointPose;
  commitCurrentSectionReset(physics: CheckpointPhysics): void;
}

export interface CheckpointResetStage {
  host: {
    session: {
      speedResetState: unknown;
      coordinator?: { synchronizePositionAnchor(): void };
    };
    kartView: { root: { visible: boolean } };
    getPhysics(): CheckpointPhysics;
    getTrack(): CheckpointTrack;
  };
  handleRouteSurfaceTag(tag: string, pose: CheckpointPose): void;
}

export interface CheckpointResetDependencies {
  advanceState(previous: unknown, nowMs: number): {
    state: unknown;
    actions: string[];
  };
  kartVisible(state: unknown, nowMs: number): boolean;
}

/** Finish a timed reset transition and apply its physics commands in order. */
export function advanceCheckpointReset(
  stage: CheckpointResetStage,
  nowMs: number,
  dependencies: CheckpointResetDependencies,
): void {
  const { host } = stage;
  const transition = dependencies.advanceState(host.session.speedResetState, nowMs);
  host.session.speedResetState = transition.state;
  host.kartView.root.visible = dependencies.kartVisible(host.session.speedResetState, nowMs);
  for (const action of transition.actions) {
    if (action === "complete-checkpoint-pose") {
      const pose = host.getTrack().prepareCurrentSectionReset(host.getPhysics());
      const tag = `${pose.surface}:in:next`;
      if (pose.surface && !host.getPhysics().canHandleRouteSurfaceTag(tag)) {
        throw new Error(`reset surface event ${pose.surface} 的 listener lifecycle 尚未闭合。`);
      }
      host.getTrack().commitCurrentSectionReset(host.getPhysics());
      host.getPhysics().completeCheckpointPose(pose, true);
      host.session.coordinator?.synchronizePositionAnchor();
      if (pose.surface.includes("rail")) host.getPhysics().prepareRailCheckpointReentry();
      if (pose.surface) stage.handleRouteSurfaceTag(tag, pose);
    } else if (action === "suspend-physics") {
      host.getPhysics().setFullPhysicsBypass(true);
    } else if (action === "resume-physics") {
      host.getPhysics().setFullPhysicsBypass(false);
    } else {
      host.getPhysics().restoreResetInteraction();
    }
  }
}

/** Jump to a route checkpoint while preserving surface-listener ordering. */
export function warpToCheckpoint(stage: CheckpointResetStage, section: number): void {
  const { host } = stage;
  const track = host.getTrack();
  const physics = host.getPhysics();
  track.warpRouteToSection(physics, section);
  const pose = track.prepareCurrentSectionReset(physics);
  const tag = `${pose.surface}:in:next`;
  if (pose.surface && !physics.canHandleRouteSurfaceTag(tag)) {
    throw new Error(`reset surface event ${pose.surface} 的 listener lifecycle 尚未闭合。`);
  }
  track.commitCurrentSectionReset(physics);
  physics.completeCheckpointPose(pose, true);
  host.session.coordinator?.synchronizePositionAnchor();
  stage.handleRouteSurfaceTag(tag, pose);
}

/** Move the kart to a free point and realign the multiplayer anchor. */
export function warpToPoint(stage: CheckpointResetStage, position: unknown): void {
  const { host } = stage;
  host.getPhysics().warpPosition(position);
  host.session.coordinator?.synchronizePositionAnchor();
}
