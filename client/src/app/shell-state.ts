/** Lazy application owners and access checks used throughout race startup. */

export function getOrCreateRaceSession<Session>(
  host: { raceSession?: Session | null },
  createSession: () => Session,
): Session {
  return host.raceSession ?? (host.raceSession = createSession());
}

export function getOrCreateAudioDirector<Audio>(
  host: { audioDirector?: Audio | null },
  createAudio: () => Audio,
): Audio {
  return host.audioDirector ?? (host.audioDirector = createAudio());
}

export function getOrCreateReplayLibrary<Library>(
  host: { replayLibraryInstance?: Library | null },
  createLibrary: () => Library,
): Library {
  return host.replayLibraryInstance ?? (host.replayLibraryInstance = createLibrary());
}

export function currentRhoLibrary<Library>(
  host: { assets: { current?: Library } },
): Library | undefined {
  return host.assets.current;
}

/** A selected vehicle is required before game physics can be used. */
export function requireRacePhysics<Physics>(
  host: { session: { physics?: Physics } },
): Physics {
  if (!host.session.physics) throw new Error("尚未选择车辆资源。");
  return host.session.physics;
}

/** A selected track is required for active camera and route operations. */
export function requireRaceTrack<Track>(
  host: { session: { track?: Track } },
): Track {
  if (!host.session.track) throw new Error("尚未选择赛道资源。");
  return host.session.track;
}
