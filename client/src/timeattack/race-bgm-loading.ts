/** Loads single-player and multiplayer music banks for the race BGM owner. */

interface AudioResource {
  bytes(): Promise<Uint8Array>;
}

interface RacePlaylist {
  buffers: unknown[];
  names: unknown[];
}

export interface RaceBgmLoadingHost {
  context: unknown;
  raceBuffers: unknown[];
  raceNames: unknown[];
  currentRaceNameValue?: unknown;
  multiplayerBuffers?: {
    lobby: unknown; room: unknown; finish: unknown; podium: unknown;
  };
  multiplayerLobbyPath?: string;
}

export interface RaceBgmLoadingDependencies {
  resource(library: unknown, path: string): AudioResource;
  garageMusic(library: unknown, single: AudioResource): AudioResource;
  parseMultiplayerList(xml: string, lobbyPath: string): {
    lobby: string; room: string;
  };
  decodeBuffer(resource: AudioResource, context: unknown): Promise<unknown>;
  racePlaylist(library: unknown, track: unknown,
    context: unknown): Promise<RacePlaylist>;
  create(context: unknown, playlist: RacePlaylist, ready: unknown,
    garage: unknown, win: unknown, lose: unknown, random: unknown): unknown;
}

export async function prepareMultiplayerBgm(host: RaceBgmLoadingHost,
  library: unknown, lobbyPath: string,
  dependencies: RaceBgmLoadingDependencies): Promise<void> {
  if (host.multiplayerBuffers && host.multiplayerLobbyPath === lobbyPath) return;
  const bytes = await dependencies.resource(library,
    "zeta_/cn/content/bgmList.xml").bytes();
  const xml = new TextDecoder(bytes[0] === 255 ? "utf-16le" : "utf-8")
    .decode(bytes);
  const paths = dependencies.parseMultiplayerList(xml, lobbyPath);
  if (host.multiplayerBuffers) {
    host.multiplayerBuffers = {
      ...host.multiplayerBuffers,
      lobby: await dependencies.decodeBuffer(
        dependencies.resource(library, paths.lobby), host.context),
    };
    host.multiplayerLobbyPath = lobbyPath;
    return;
  }
  const [lobby, room, finish, podium] = await Promise.all([
    dependencies.decodeBuffer(
      dependencies.resource(library, paths.lobby), host.context),
    dependencies.decodeBuffer(
      dependencies.resource(library, paths.room), host.context),
    dependencies.decodeBuffer(
      dependencies.resource(library, "sound_/bgm/main/game_end.ogg"), host.context),
    dependencies.decodeBuffer(
      dependencies.resource(library, "sound_/bgm/main/game_result.ogg"), host.context),
  ]);
  host.multiplayerBuffers = { lobby, room, finish, podium };
  host.multiplayerLobbyPath = lobbyPath;
}

export async function loadRaceBgm(library: unknown, track: unknown,
  random: unknown, context: unknown,
  dependencies: RaceBgmLoadingDependencies): Promise<unknown> {
  const single = dependencies.resource(library, "sound_/bgm/main/single.ogg");
  const garage = dependencies.garageMusic(library, single);
  const win = dependencies.resource(library, "sound_/bgm/main/game_win.ogg");
  const lose = dependencies.resource(library, "sound_/bgm/main/game_lose.ogg");
  const [playlist, readyBuffer, garageBuffer, winBuffer, loseBuffer] =
    await Promise.all([
      dependencies.racePlaylist(library, track, context),
      dependencies.decodeBuffer(single, context),
      garage === single ? Promise.resolve(undefined)
        : dependencies.decodeBuffer(garage, context),
      dependencies.decodeBuffer(win, context),
      dependencies.decodeBuffer(lose, context),
    ]);
  return dependencies.create(context, playlist, readyBuffer,
    garageBuffer ?? readyBuffer, winBuffer, loseBuffer, random);
}

export async function selectRaceBgm(host: RaceBgmLoadingHost,
  library: unknown, track: unknown,
  dependencies: RaceBgmLoadingDependencies): Promise<void> {
  const playlist = await dependencies.racePlaylist(library, track,
    host.context);
  host.raceBuffers = playlist.buffers;
  host.raceNames = playlist.names;
  host.currentRaceNameValue = undefined;
}
