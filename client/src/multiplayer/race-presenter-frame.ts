/** One multiplayer presentation frame, in the released phase order. */

import { updateRacePresenterCamera,
  type RacePresenterCameraHost } from "./race-presenter-camera";
import { advanceRacePresenterEvents,
  type RacePresenterAction, type RacePresenterEventDependencies,
  type RacePresenterEventsHost } from "./race-presenter-events";
import { updateRacePresenterEffects,
  type RacePresenterEffectsHost } from "./race-presenter-effects";
import { finishRacePresenterFrame,
  type RacePresenterHudDependencies,
  type RacePresenterHudHost } from "./race-presenter-hud";
import { updateRacePresenterParticipants,
  type RacePresenterParticipantDependencies,
  type RacePresenterParticipantsHost } from "./race-presenter-participants";
import { presentRaceResultFrame,
  type RacePresenterResultDependencies,
  type RacePresenterResultHost } from "./race-presenter-result-frame";

export type RacePresenterFrameHost = RacePresenterResultHost &
  RacePresenterEventsHost & RacePresenterCameraHost &
  RacePresenterParticipantsHost & RacePresenterEffectsHost &
  RacePresenterHudHost;

export interface RacePresenterFrameDependencies {
  result: RacePresenterResultDependencies;
  events: RacePresenterEventDependencies;
  participants: RacePresenterParticipantDependencies;
  hud: RacePresenterHudDependencies;
}

export function updateRacePresenterFrame(host: RacePresenterFrameHost,
  renderer: { getDrawingBufferSize(size: { x: number; y: number }): void },
  nowMs: number, actions: RacePresenterAction[],
  dependencies: RacePresenterFrameDependencies): void {
  if (presentRaceResultFrame(host, renderer, nowMs, actions,
    dependencies.result)) return;
  const width = host.size.x;
  const height = host.size.y;
  advanceRacePresenterEvents(host, nowMs, actions, dependencies.events);
  updateRacePresenterCamera(host, nowMs, dependencies.events.racingState);
  const remotePoses = updateRacePresenterParticipants(host, nowMs,
    width, height, dependencies.participants);
  updateRacePresenterEffects(host, nowMs, width, height);
  finishRacePresenterFrame(host, nowMs, remotePoses, dependencies.hud);
}
