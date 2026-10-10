/** Connection, race transport and clock ownership for each multiplayer client. */

export interface MultiplayerClientFactories {
  createDecoder(): unknown;
  createLatencyTracker(): unknown;
  createClock(): unknown;
}

export function initializeMultiplayerClientState(host: Record<string, unknown>,
  factories: MultiplayerClientFactories): void {
  host.peer = undefined;
  host.control = undefined;
  host.motion = undefined;
  host.abort = undefined;
  host.heartbeat = undefined;
  host.peerTransport = undefined;
  host.decoder = factories.createDecoder();
  host.iceRefresh = undefined;
  host.disconnectTimer = undefined;
  host.cancelConnect = undefined;
  host.nextId = 0;
  host.playerId = undefined;
  host.motionScope = undefined;
  host.podiumScope = undefined;
  host.raceLatencies = new Map();
  host.echoRtt = factories.createLatencyTracker();
  host.motionListeners = new Set();
  host.clock = factories.createClock();
  host.pending = new Map();
  host.listeners = new Set();
  host.closeListeners = new Set();
}

export class MultiplayerClientState {
  constructor(factories: MultiplayerClientFactories) {
    initializeMultiplayerClientState(this as unknown as Record<string, unknown>,
      factories);
  }
}
