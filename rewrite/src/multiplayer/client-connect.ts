import { sanitizeIceServers } from "./http";
import { PeerMesh } from "./peer-mesh";
import { PROTOCOL_VERSION, ROOM_RULESET } from "./protocol";
import { receiveGameControlEvent } from "./client-control-receiver";
import { rememberConnectedClient } from "./server-latency";
import type { ClientControlHost, ControlRequest } from "./client-control";
import type { DecodedGameMotion } from "./payload";

export interface ServerControlEvent {
  type: string;
  requestId?: string;
  code?: string;
  roomId?: string;
  raceId?: string;
  playerId?: string;
  clientTick?: number;
  serverTick?: number;
  latencyMs?: number;
  nonce?: string;
  capabilities?: string[];
  [key: string]: unknown;
}

export interface ClientConnectionHost extends ClientControlHost {
  peer?: Pick<RTCPeerConnection, "close">;
  control?: ClientControlHost["control"];
  motion?: Pick<RTCDataChannel, "readyState" | "bufferedAmount" | "send" | "close">;
  peerTransport?: PeerMesh;
  request(message: ControlRequest): Promise<ServerControlEvent>;
  acceptMotion(input: unknown): void;
  acceptMotionMessage(message: DecodedGameMotion): void;
  dispose(): void;
}

export interface ClientConnectDependencies {
  validateControlMessage(value: unknown): ServerControlEvent | undefined;
  transport?: "webrtc" | "websocket";
  peerFactory?: (configuration: RTCConfiguration) => RTCPeerConnection;
  webSocketFactory?: (url: string) => WebSocket;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

/**
 * Connect the game client to its server-negotiated WebRTC channels, or to the
 * game server's WebSocket. `ticket` is the data service's one-time entry
 * ticket; it is presented in `hello` and is not a bearer credential.
 */
export async function connectGameClient(host: ClientConnectionHost, offerUrl: string,
  name: string, resourceVersion: string, equipment: unknown, initial: string,
  raceRuntime = false, ticket: string | undefined,
  dependencies: ClientConnectDependencies): Promise<ServerControlEvent> {
  if (dependencies.transport === "websocket") {
    const { connectWebSocketGameClient } = await import("./client-websocket");
    return connectWebSocketGameClient(host, offerUrl, name, resourceVersion,
      equipment, initial, raceRuntime, ticket, dependencies);
  }
  if (host.peer) throw new Error("Connection already exists");
  const createPeer = dependencies.peerFactory ??
    (configuration => new RTCPeerConnection(configuration));
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const now = dependencies.now ?? (() => performance.now());
  const peer = createPeer({ iceServers: [] });
  host.peer = peer;
  host.abort = new AbortController();
  const control = peer.createDataChannel("control", { negotiated: true, id: 0, ordered: true });
  const motion = peer.createDataChannel("motion", {
    negotiated: true, id: 1, ordered: false, maxRetransmits: 0,
  });
  host.control = control;
  host.motion = motion;
  motion.binaryType = "arraybuffer";
  motion.onmessage = event => {
    if (host.peer === peer) host.acceptMotion(event.data);
  };
  motion.onclose = () => { if (host.peer === peer) host.dispose(); };

  control.onmessage = event => {
    if (host.peer !== peer) return;
    let raw: unknown;
    try { raw = JSON.parse(String(event.data)); }
    catch { host.dispose(); return; }
    receiveGameControlEvent(host, raw, dependencies.validateControlMessage, now);
  };
  control.onclose = () => { if (host.peer === peer) host.dispose(); };
  peer.onconnectionstatechange = () => {
    if (host.peer !== peer) return;
    if (peer.connectionState === "disconnected") {
      host.disconnectTimer ??= setTimeout(() => {
        if (host.peer === peer && peer.connectionState === "disconnected") host.dispose();
      }, 3_000);
    } else {
      clearTimeout(host.disconnectTimer);
      host.disconnectTimer = undefined;
      if (peer.connectionState === "failed" || peer.connectionState === "closed") host.dispose();
    }
  };

  let deadline: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    host.cancelConnect = reject;
    deadline = setTimeout(() => {
      reject(new Error("WebRTC connection timeout"));
      host.dispose();
    }, 20_000);
  });
  const negotiate = async () => {
    const open = new Promise<void>(resolve => { control.onopen = () => resolve(); });
    await peer.setLocalDescription(await peer.createOffer());
    if (peer.iceGatheringState !== "complete") {
      await Promise.race([timeout, new Promise<void>(resolve => {
        const check = () => {
          if (peer.iceGatheringState === "complete") {
            peer.removeEventListener("icegatheringstatechange", check);
            resolve();
          }
        };
        peer.addEventListener("icegatheringstatechange", check);
        check();
      })]);
    }
    if (host.peer !== peer) throw new Error("Connection cancelled");
    const response = await fetchImpl(offerUrl, {
      method: "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "offer", sdp: peer.localDescription?.sdp }),
      signal: host.abort!.signal,
    });
    if (!response.ok) throw new Error(`Signaling failed (${response.status})`);
    const answer: unknown = await response.json();
    if (!answer || typeof answer !== "object" ||
        (answer as Record<string, unknown>).type !== "answer" ||
        typeof (answer as Record<string, unknown>).sdp !== "string" ||
        ((answer as Record<string, unknown>).sdp as string).length > 32_768) {
      throw new Error("Invalid answer");
    }
    if (host.peer !== peer) throw new Error("Connection cancelled");
    await peer.setRemoteDescription({ type: "answer",
      sdp: (answer as { sdp: string }).sdp });
    await open;
  };

  try {
    await Promise.race([negotiate(), timeout]);
    const welcome = await host.request({ type: "hello", protocolVersion: PROTOCOL_VERSION,
      ruleset: ROOM_RULESET, resourceVersion, name, equipment, initial, raceRuntime,
      ...(ticket ? { ticket } : {}) });
    if (welcome.type !== "welcome") throw new Error("Expected welcome");
    host.playerId = welcome.playerId;

    if (welcome.capabilities?.includes("p2p-motion")) {
      const iceUrl = new URL(offerUrl);
      iceUrl.pathname = "/multiplayer/ice";
      iceUrl.search = "";
      iceUrl.hash = "";
      const fetchIce = async (): Promise<RTCIceServer[]> => {
        try {
          const response = await fetchImpl(iceUrl.href, {
            credentials: "same-origin", cache: "no-store", headers: {},
            signal: AbortSignal.any([host.abort!.signal, AbortSignal.timeout(3_000)]),
          });
          if (!response.ok) return sanitizeIceServers(undefined);
          const body: unknown = await response.json();
          return sanitizeIceServers(body && typeof body === "object" &&
            "iceServers" in body ? body.iceServers : undefined);
        } catch { return sanitizeIceServers(undefined); }
      };
      const iceServers = await fetchIce();
      if (host.peer !== peer) throw new Error("Connection cancelled");
      host.peerTransport = new PeerMesh({
        playerId: welcome.playerId!, iceServers,
        send: message => host.request(message),
        receive: message => host.acceptMotionMessage(message),
      });
      host.iceRefresh = setInterval(() => {
        void fetchIce().then(servers => {
          if (host.peer === peer) host.peerTransport?.updateIceServers(servers);
        });
      }, 1_800_000);
    }
    const ping = async () => {
      if (host.peer !== peer) throw new Error("Connection cancelled");
      await host.request({ type: "clock", clientTick: now() });
      if (host.peer !== peer) throw new Error("Connection cancelled");
    };
    for (let index = 0; index < 3; index++) await ping();
    host.heartbeat = setInterval(() => {
      void ping().catch(() => { if (host.peer === peer) host.dispose(); });
    }, 10_000);
    rememberConnectedClient(host);
    return welcome;
  } catch (error) {
    if (host.peer === peer) host.dispose();
    throw error;
  } finally {
    clearTimeout(deadline);
    if (host.peer === peer) host.cancelConnect = undefined;
  }
}
