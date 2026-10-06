import { receiveGameControlEvent } from "./client-control-receiver";
import type { ClientConnectDependencies, ClientConnectionHost,
  ServerControlEvent } from "./client-connect";
import { PROTOCOL_VERSION, ROOM_RULESET } from "./protocol";

/** The existing lobby still asks for /offer; the local server uses one WS channel. */
export function websocketUrlForOffer(offerUrl: string): string {
  const url = new URL(offerUrl);
  if ((url.protocol !== "http:" && url.protocol !== "https:") ||
      url.pathname !== "/multiplayer/offer" || url.search || url.hash ||
      url.username || url.password) {
    throw new Error("Invalid local multiplayer offer URL");
  }
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/multiplayer/ws";
  return url.href;
}

/** Gives the existing request and motion code the small channel API it needs. */
class SocketChannel {
  constructor(private readonly socket: WebSocket) {}

  get readyState(): RTCDataChannelState {
    return (["connecting", "open", "closing", "closed"] as const)[this.socket.readyState] ?? "closed";
  }

  get bufferedAmount(): number { return this.socket.bufferedAmount; }

  send(data: string): void;
  send(data: Blob): void;
  send(data: ArrayBuffer): void;
  send(data: ArrayBufferView): void;
  send(data: string | Blob | ArrayBuffer | ArrayBufferView): void {
    if (ArrayBuffer.isView(data)) {
      const bytes = new Uint8Array(data.byteLength);
      bytes.set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
      this.socket.send(bytes);
    } else {
      this.socket.send(data);
    }
  }

  close(): void { this.socket.close(); }
}

/** Connect the recovered game client to the Java server's readable JSON protocol. */
export async function connectWebSocketGameClient(host: ClientConnectionHost,
  offerUrl: string, name: string, resourceVersion: string, equipment: unknown,
  initial: string, raceRuntime: boolean, token: string | undefined,
  dependencies: ClientConnectDependencies): Promise<ServerControlEvent> {
  if (host.peer) throw new Error("Connection already exists");
  const makeSocket = dependencies.webSocketFactory ?? (url => new WebSocket(url));
  const now = dependencies.now ?? (() => performance.now());
  const socket = makeSocket(websocketUrlForOffer(offerUrl));
  socket.binaryType = "arraybuffer";
  const session = { close: () => socket.close() };
  host.peer = session;
  host.abort = new AbortController();
  host.abort.signal.addEventListener("abort", () => socket.close(), { once: true });
  const channel = new SocketChannel(socket);
  host.control = channel;
  host.motion = channel;

  socket.addEventListener("message", event => {
    if (host.peer !== session) return;
    if (typeof event.data !== "string") {
      host.acceptMotion(event.data);
      return;
    }
    let value: unknown;
    try { value = JSON.parse(event.data); }
    catch { host.dispose(); return; }
    receiveGameControlEvent(host, value, dependencies.validateControlMessage, now);
  });
  socket.addEventListener("close", () => {
    if (host.peer === session) host.dispose();
  });

  let deadline: ReturnType<typeof setTimeout> | undefined;
  const opened = new Promise<void>((resolve, reject) => {
    const fail = () => reject(new Error("WebSocket connection failed"));
    host.cancelConnect = reject;
    socket.addEventListener("open", () => resolve(), { once: true });
    socket.addEventListener("error", fail, { once: true });
    socket.addEventListener("close", fail, { once: true });
    deadline = setTimeout(() => {
      reject(new Error("WebSocket connection timeout"));
      if (host.peer === session) host.dispose();
    }, 20_000);
  });

  try {
    await opened;
    if (host.peer !== session) throw new Error("Connection cancelled");
    const welcome = await host.request({ type: "hello", protocolVersion: PROTOCOL_VERSION,
      ruleset: ROOM_RULESET, resourceVersion, name, equipment, initial,
      raceRuntime, ...(token ? { token } : {}) });
    if (welcome.type !== "welcome" || !welcome.playerId) throw new Error("Expected welcome");
    host.playerId = welcome.playerId;

    const ping = async () => {
      if (host.peer !== session) throw new Error("Connection cancelled");
      await host.request({ type: "clock", clientTick: now() });
      if (host.peer !== session) throw new Error("Connection cancelled");
    };
    for (let index = 0; index < 3; index++) await ping();
    host.heartbeat = setInterval(() => {
      void ping().catch(() => { if (host.peer === session) host.dispose(); });
    }, 10_000);
    return welcome;
  } catch (error) {
    if (host.peer === session) host.dispose();
    throw error;
  } finally {
    clearTimeout(deadline);
    if (host.peer === session) host.cancelConnect = undefined;
  }
}
