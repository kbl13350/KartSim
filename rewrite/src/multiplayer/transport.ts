import { serverError } from "./errors";
import { MultiplayerHttpClient } from "./http";
import { decodeMotionFrame, encodeMotionFrame, isNewerSequence,
  type MotionFrame, type MotionPayloadKind } from "./motion";
import { PeerMesh, parsePeerSignal, type PeerDiagnostic } from "./peer-mesh";
import { parseServerMessage, PROTOCOL_VERSION, ROOM_RULESET,
  type HelloRequest, type RoomSnapshot,
  type ServerMessage, type WelcomeMessage } from "./protocol";

type Listener<T> = (value: T) => void;
type PeerFactory = (configuration: RTCConfiguration) => RTCPeerConnection;

export type ConnectionIdentity = Pick<HelloRequest,
  "resourceVersion" | "name" | "equipment" | "initial" | "raceRuntime">;

export interface TransportOptions {
  http: MultiplayerHttpClient;
  peerFactory?: PeerFactory;
  now?: () => number;
  requestTimeoutMs?: number;
  connectTimeoutMs?: number;
}

export interface ClockSample {
  /** server time minus local performance.now() time */
  offsetMs: number;
  roundTripMs: number;
  sampledAt: number;
}

interface PendingRequest {
  resolve: Listener<ServerMessage>;
  reject: Listener<Error>;
  timer: ReturnType<typeof setTimeout>;
  clockTick?: number;
}

interface MotionScope {
  roomId: string;
  raceId: string;
  members: Set<string>;
  recipientMask: number;
  enabled: boolean;
  sequence: number;
  received: Map<string, number>;
}

function abortError(): Error { return new Error("Multiplayer connection cancelled"); }

function abortable<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise((resolve, reject) => {
    const aborted = () => { signal.removeEventListener("abort", aborted); reject(abortError()); };
    signal.addEventListener("abort", aborted, { once: true });
    operation.then((value) => {
      signal.removeEventListener("abort", aborted);
      resolve(value);
    }, (error) => {
      signal.removeEventListener("abort", aborted);
      reject(error);
    });
  });
}

function waitForIce(peer: RTCPeerConnection, signal: AbortSignal): Promise<void> {
  if (peer.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      peer.removeEventListener("icegatheringstatechange", check);
      signal.removeEventListener("abort", aborted);
    };
    const check = () => {
      if (peer.iceGatheringState !== "complete") return;
      cleanup(); resolve();
    };
    const aborted = () => { cleanup(); reject(abortError()); };
    peer.addEventListener("icegatheringstatechange", check);
    signal.addEventListener("abort", aborted, { once: true });
    if (signal.aborted) aborted(); else check();
  });
}

function waitForOpen(channel: RTCDataChannel, signal: AbortSignal): Promise<void> {
  if (channel.readyState === "open") return Promise.resolve();
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      channel.removeEventListener("open", opened);
      channel.removeEventListener("close", closed);
      channel.removeEventListener("error", closed);
      signal.removeEventListener("abort", aborted);
    };
    const opened = () => { cleanup(); resolve(); };
    const closed = () => { cleanup(); reject(new Error("WebRTC control channel closed")); };
    const aborted = () => { cleanup(); reject(abortError()); };
    channel.addEventListener("open", opened);
    channel.addEventListener("close", closed);
    channel.addEventListener("error", closed);
    signal.addEventListener("abort", aborted, { once: true });
    if (signal.aborted) aborted();
    else if (channel.readyState === "open") opened();
    else if (channel.readyState === "closed") closed();
  });
}

/**
 * Client-to-server WebRTC transport. The server performs HTTP SDP signaling;
 * all reliable requests use control (id 0), race motion uses binary motion (id 1).
 */
export class MultiplayerTransport {
  private readonly http: MultiplayerHttpClient;
  private readonly peerFactory: PeerFactory;
  private readonly now: () => number;
  private readonly requestTimeoutMs: number;
  private readonly connectTimeoutMs: number;
  private state: "idle" | "connecting" | "ready" | "closed" = "idle";
  private peer?: RTCPeerConnection;
  private control?: RTCDataChannel;
  private motion?: RTCDataChannel;
  private controller?: AbortController;
  private heartbeat?: ReturnType<typeof setInterval>;
  private iceRefresh?: ReturnType<typeof setInterval>;
  private disconnectTimer?: ReturnType<typeof setTimeout>;
  private peerMesh?: PeerMesh;
  private nextRequestId = 0;
  private pending = new Map<string, PendingRequest>();
  private readonly messageListeners = new Set<Listener<ServerMessage>>();
  private readonly motionListeners = new Set<Listener<MotionFrame>>();
  private readonly closeListeners = new Set<Listener<void>>();
  private readonly clockSamples: ClockSample[] = [];
  private scope?: MotionScope;
  playerId?: string;

  constructor(options: TransportOptions) {
    this.http = options.http;
    this.peerFactory = options.peerFactory ?? ((configuration) => new RTCPeerConnection(configuration));
    this.now = options.now ?? (() => performance.now());
    this.requestTimeoutMs = options.requestTimeoutMs ?? 10_000;
    this.connectTimeoutMs = options.connectTimeoutMs ?? 20_000;
  }

  get connected(): boolean { return this.state === "ready"; }

  subscribe(listener: Listener<ServerMessage>): () => void {
    this.messageListeners.add(listener);
    return () => { this.messageListeners.delete(listener); };
  }

  subscribeMotion(listener: Listener<MotionFrame>): () => void {
    this.motionListeners.add(listener);
    return () => { this.motionListeners.delete(listener); };
  }

  onClose(listener: Listener<void>): () => void {
    this.closeListeners.add(listener);
    return () => { this.closeListeners.delete(listener); };
  }

  async connect(identity: ConnectionIdentity, signal?: AbortSignal): Promise<WelcomeMessage> {
    if (this.state !== "idle") throw new Error("Create a new transport for another connection");
    this.state = "connecting";
    const controller = new AbortController();
    this.controller = controller;
    controller.signal.addEventListener("abort", () => this.close(), { once: true });
    const timeout = setTimeout(() => controller.abort(), this.connectTimeoutMs);
    const forwardAbort = () => controller.abort();
    signal?.addEventListener("abort", forwardAbort, { once: true });
    if (signal?.aborted) controller.abort();

    try {
      if (controller.signal.aborted) throw abortError();
      const peer = this.peerFactory({ iceServers: [] });
      this.peer = peer;
      const control = peer.createDataChannel("control", { negotiated: true, id: 0, ordered: true });
      const motion = peer.createDataChannel("motion", {
        negotiated: true, id: 1, ordered: false, maxRetransmits: 0,
      });
      this.control = control;
      this.motion = motion;
      motion.binaryType = "arraybuffer";
      control.onmessage = (event) => this.receiveControl(event.data);
      motion.onmessage = (event) => this.receiveMotion(event.data);
      control.onclose = () => this.close();
      motion.onclose = () => this.close();
      peer.onconnectionstatechange = () => this.connectionStateChanged(peer);

      const offer = await abortable(peer.createOffer(), controller.signal);
      await abortable(peer.setLocalDescription(offer), controller.signal);
      await waitForIce(peer, controller.signal);
      if (!peer.localDescription?.sdp) throw new Error("WebRTC did not produce an offer SDP");
      const answer = await abortable(
        this.http.exchangeOffer(peer.localDescription.sdp, controller.signal), controller.signal);
      if (controller.signal.aborted) throw abortError();
      await abortable(peer.setRemoteDescription({ type: "answer", sdp: answer }), controller.signal);
      await waitForOpen(control, controller.signal);

      const hello: HelloRequest = {
        type: "hello", protocolVersion: PROTOCOL_VERSION, ruleset: ROOM_RULESET, ...identity,
      };
      const welcome = await this.request(hello);
      if (welcome.type !== "welcome") throw new Error("Expected multiplayer welcome");
      this.playerId = welcome.playerId;

      if (welcome.capabilities.includes("p2p-motion")) {
        const iceServers = await this.http.getIceServers(controller.signal);
        if (controller.signal.aborted) throw abortError();
        this.peerMesh = new PeerMesh({
          playerId: welcome.playerId, iceServers, peerFactory: this.peerFactory,
          send: message => this.request(message),
          receive: () => {},
          receiveFrame: frame => this.acceptMotionFrame(frame, false),
          now: this.now,
        });
        this.iceRefresh = setInterval(() => {
          this.http.getIceServers().then(servers => this.peerMesh?.updateIceServers(servers));
        }, 1_800_000);
      }

      for (let attempt = 0; attempt < 3; attempt++) await this.synchronizeClock();
      if (controller.signal.aborted) throw abortError();
      this.state = "ready";
      this.heartbeat = setInterval(() => {
        this.synchronizeClock().catch(() => this.close());
      }, 10_000);
      return welcome;
    } catch (error) {
      this.close();
      throw error;
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", forwardAbort);
    }
  }

  request<T extends { type: string }>(message: T): Promise<ServerMessage> {
    const channel = this.control;
    if (!channel || channel.readyState !== "open") return Promise.reject(new Error("Not connected"));
    if (this.pending.size >= 32 || channel.bufferedAmount > 65_536) {
      return Promise.reject(new Error("Connection busy"));
    }
    const requestId = String(++this.nextRequestId);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error("Multiplayer request timed out; synchronize the room before retrying"));
      }, this.requestTimeoutMs);
      this.pending.set(requestId, {
        resolve, reject, timer,
        clockTick: message.type === "clock" && "clientTick" in message &&
          typeof message.clientTick === "number" ? message.clientTick : undefined,
      });
      try { channel.send(JSON.stringify({ ...message, requestId })); }
      catch (error) {
        clearTimeout(timer);
        this.pending.delete(requestId);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  async synchronizeClock(): Promise<ClockSample> {
    const clientTick = this.now();
    const response = await this.request({ type: "clock", clientTick });
    if (response.type !== "clock" || response.clientTick !== clientTick) {
      this.close();
      throw new Error("Invalid clock reply");
    }
    const sampledAt = this.now();
    if (sampledAt < clientTick || sampledAt - clientTick > 10_000 ||
        sampledAt < (this.clockSamples.at(-1)?.sampledAt ?? 0)) {
      this.close();
      throw new Error("Clock response arrived outside the valid window");
    }
    const sample = {
      offsetMs: response.serverTick - (clientTick + sampledAt) / 2,
      roundTripMs: sampledAt - clientTick,
      sampledAt,
    };
    this.clockSamples.push(sample);
    while (this.clockSamples.length > 8) this.clockSamples.shift();
    return sample;
  }

  /** Pick the freshest low-latency sample, as the downloaded client does. */
  captureClock(): ClockSample | undefined {
    const now = this.now();
    return this.clockSamples
      .filter((sample) => now >= sample.sampledAt && now - sample.sampledAt <= 30_000)
      .reduce<ClockSample | undefined>((best, sample) =>
        !best || sample.roundTripMs <= best.roundTripMs ? sample : best, undefined);
  }

  /** Update permitted race recipients from a validated room event. */
  bindRoom(room?: RoomSnapshot): void {
    this.peerMesh?.bind(room);
    const playerId = this.playerId;
    if (!room?.race || !playerId || !room.members.some((member) => member.playerId === playerId)) {
      this.scope = undefined;
      return;
    }
    const loaded = new Set(room.race.loadedIds);
    const recipientMask = room.members.reduce((mask, member) =>
      member.playerId !== playerId && loaded.has(member.playerId) ? mask | (1 << member.slot) : mask, 0);
    const enabled = (room.phase === "loading" && loaded.has(playerId)) ||
      room.phase === "countdown" || room.phase === "racing";
    const previous = this.scope;
    if (previous?.roomId === room.roomId && previous.raceId === room.race.raceId) {
      previous.members = new Set(room.members.map((member) => member.playerId));
      previous.recipientMask = recipientMask;
      previous.enabled = enabled;
    } else {
      this.scope = {
        roomId: room.roomId, raceId: room.race.raceId,
        members: new Set(room.members.map((member) => member.playerId)),
        recipientMask, enabled, sequence: 0, received: new Map(),
      };
    }
  }

  /** Sends a simulation-encoded payload by direct peer link or server relay. */
  sendMotion(kind: MotionPayloadKind, payload: Uint8Array, requestedMask = 255): boolean {
    const scope = this.scope;
    const channel = this.motion;
    if (!scope?.enabled || !scope.recipientMask || !this.playerId ||
        !Number.isInteger(requestedMask) || requestedMask < 0 || requestedMask > 255) return false;
    const mask = scope.recipientMask & requestedMask;
    if (!mask) return false;
    const sequence = (scope.sequence + 1) >>> 0;
    try {
      const frame = encodeMotionFrame({
        roomId: scope.roomId, raceId: scope.raceId, playerId: this.playerId,
        sequence, recipientMask: 0, kind, payload,
      });
      const direct = this.peerMesh?.send(frame, sequence, mask);
      const relayMask = direct?.relayMask ?? mask;
      let sent = direct?.sent ?? false;
      if (relayMask && channel?.readyState === "open" && channel.bufferedAmount <= 8_192) {
        frame[3] = relayMask;
        channel.send(frame);
        sent = true;
      }
      if (sent) scope.sequence = sequence;
      return sent;
    } catch {
      this.close();
      return false;
    }
  }

  networkDiagnostics(): PeerDiagnostic[] { return this.peerMesh?.diagnostics() ?? []; }

  private receiveControl(data: unknown): void {
    let message: ServerMessage;
    try { message = parseServerMessage(JSON.parse(String(data))); }
    catch { this.close(); return; }
    if (message.requestId) {
      const pending = this.pending.get(message.requestId);
      if (pending) {
        clearTimeout(pending.timer);
        this.pending.delete(message.requestId);
        if (message.type === "error") pending.reject(serverError(message));
        else if (pending.clockTick !== undefined &&
            (message.type !== "clock" || message.clientTick !== pending.clockTick)) {
          pending.reject(new Error("Invalid clock reply"));
          this.close();
          return;
        } else pending.resolve(message);
      }
    }
    if (message.type === "room") this.bindRoom(message.room);
    if (message.type === "left") this.bindRoom(undefined);
    if (message.type === "p2p-signal" || message.type === "p2p-relay") {
      const signal = parsePeerSignal(message);
      if (signal) void this.peerMesh?.receiveSignal(signal);
    }
    for (const listener of this.messageListeners) listener(message);
  }

  private receiveMotion(data: unknown): void {
    if (!(data instanceof ArrayBuffer) && !ArrayBuffer.isView(data)) { this.close(); return; }
    let frame: MotionFrame;
    try { frame = decodeMotionFrame(data); }
    catch { this.close(); return; }
    this.acceptMotionFrame(frame, true);
  }

  private acceptMotionFrame(frame: MotionFrame, fromServer: boolean): void {
    const scope = this.scope;
    if (!scope || frame.roomId !== scope.roomId || frame.raceId !== scope.raceId ||
        frame.playerId === this.playerId || !scope.members.has(frame.playerId)) return;
    const last = scope.received.get(frame.playerId);
    if (last !== undefined && !isNewerSequence(frame.sequence, last)) return;
    scope.received.set(frame.playerId, frame.sequence);
    if (fromServer) this.peerMesh?.receivedFromServer(frame);
    for (const listener of this.motionListeners) listener(frame);
  }

  private connectionStateChanged(peer: RTCPeerConnection): void {
    if (this.peer !== peer) return;
    if (peer.connectionState === "disconnected") {
      this.disconnectTimer ??= setTimeout(() => {
        if (this.peer === peer && peer.connectionState === "disconnected") this.close();
      }, 3_000);
    } else {
      clearTimeout(this.disconnectTimer);
      this.disconnectTimer = undefined;
      if (peer.connectionState === "failed" || peer.connectionState === "closed") this.close();
    }
  }

  close(): void {
    if (this.state === "closed") return;
    this.state = "closed";
    this.controller?.abort();
    clearInterval(this.heartbeat);
    clearInterval(this.iceRefresh);
    clearTimeout(this.disconnectTimer);
    this.heartbeat = undefined;
    this.iceRefresh = undefined;
    this.disconnectTimer = undefined;
    for (const request of this.pending.values()) {
      clearTimeout(request.timer);
      request.reject(new Error("Connection closed"));
    }
    this.pending.clear();
    this.scope = undefined;
    this.peerMesh?.dispose();
    this.peerMesh = undefined;
    this.clockSamples.length = 0;
    this.playerId = undefined;
    this.control?.close();
    this.motion?.close();
    this.peer?.close();
    this.control = undefined;
    this.motion = undefined;
    this.peer = undefined;
    for (const listener of this.closeListeners) listener();
    this.messageListeners.clear();
    this.motionListeners.clear();
    this.closeListeners.clear();
  }
}
