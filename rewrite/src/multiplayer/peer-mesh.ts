import { decodeMotionFrame, isNewerSequence, motionRaceTag, type MotionFrame } from "./motion";
import { GameMotionDecoder, type DecodedGameMotion } from "./payload";
import type { RoomSnapshot } from "./protocol";

const MOTION_BACKPRESSURE_BYTES = 8_192;
const DISCONNECT_GRACE_MS = 3_000;
const REPAIR_INTERVAL_MS = 5_000;

export type PeerSignal = {
  type: "p2p-signal";
  roomId: string;
  raceId: string;
  playerId: string;
  kind: "offer" | "answer";
  sdp: string;
  generation: string;
} | {
  type: "p2p-relay";
  roomId: string;
  raceId: string;
  playerId: string;
};

/** Validate the signaling fields before passing a server event into a peer link. */
export function parsePeerSignal(value: unknown): PeerSignal | undefined {
  if (!value || typeof value !== "object") return undefined;
  const signal = value as Record<string, unknown>;
  const id = (field: unknown): field is string =>
    typeof field === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(field);
  if (!id(signal.roomId) || !id(signal.raceId) || !id(signal.playerId)) return undefined;
  if (signal.type === "p2p-relay") return signal as PeerSignal;
  if (signal.type !== "p2p-signal" || !["offer", "answer"].includes(String(signal.kind)) ||
      typeof signal.sdp !== "string" || signal.sdp.length < 1 || signal.sdp.length > 65_536 ||
      typeof signal.generation !== "string" || signal.generation.length < 1 ||
      signal.generation.length > 64) return undefined;
  return signal as PeerSignal;
}

export interface PeerMeshOptions {
  playerId: string;
  iceServers: RTCIceServer[];
  send: (message: { type: string; [key: string]: unknown }) => Promise<unknown>;
  receive: (motion: DecodedGameMotion) => void;
  receiveFrame?: (frame: MotionFrame) => void;
  now?: () => number;
  peerFactory?: (configuration: RTCConfiguration) => RTCPeerConnection;
}

export interface PeerDiagnostic {
  peer: number;
  route: "server" | "rtc" | "direct" | "turn";
  connection: RTCPeerConnectionState;
  rttMs?: number;
  transportRttMs?: number;
  candidate?: string;
  stateAgeMs: number;
  bufferedBytes: number;
  sent: number;
  received: number;
  relayed: number;
  dropped: number;
  repairs: number;
  forcedRelay: boolean;
}

interface PeerState {
  id: string;
  slot: number;
  pc: RTCPeerConnection;
  motion: RTCDataChannel;
  control: RTCDataChannel;
  generation: string;
  retired: Set<string>;
  pending: boolean;
  created: number;
  repairAt: number;
  lastPoseAt: number;
  lastRelayRequest: number;
  forced: boolean;
  probeAt: number;
  probeSequence?: number;
  ackAt: number;
  statsAt: number;
  statsPending: boolean;
  iceRoute: "rtc" | "direct" | "turn";
  sent: number;
  received: number;
  relayed: number;
  dropped: number;
  repairs: number;
  tokens: number;
  tokenAt: number;
  disconnectedAt?: number;
  lastRtcSequence?: number;
  pingAt?: number;
  rtt?: number;
  rttAt?: number;
  transportRtt?: number;
  candidate?: string;
  cancelGather?: () => void;
}

/** Direct race links, with validated motion, ICE repair and server relay fallback. */
export class PeerMesh {
  private readonly options: PeerMeshOptions;
  private readonly peerFactory: (configuration: RTCConfiguration) => RTCPeerConnection;
  private peers = new Map<string, PeerState>();
  private room?: RoomSnapshot;
  private timer?: ReturnType<typeof setInterval>;
  private disposed = false;
  private nextSilenceCheck = 0;
  private decoder = new GameMotionDecoder();

  constructor(options: PeerMeshOptions) {
    this.options = options;
    this.peerFactory = options.peerFactory ?? (configuration => new RTCPeerConnection(configuration));
  }

  private now(): number { return this.options.now?.() ?? performance.now(); }

  updateIceServers(iceServers: RTCIceServer[]): void {
    this.options.iceServers = iceServers;
    for (const peer of this.peers.values()) {
      try { peer.pc.setConfiguration({ iceServers }); } catch { /* stale peer */ }
    }
  }

  bind(room?: RoomSnapshot): void {
    if (this.disposed) return;
    const eligible = room?.race && ["loading", "countdown", "racing"].includes(room.phase) &&
      room.race.loadedIds.includes(this.options.playerId);
    if (!eligible || room.roomId !== this.room?.roomId ||
        room.race?.raceId !== this.room?.race?.raceId) this.clear();
    this.room = eligible ? room : undefined;
    if (!this.room?.race) return;

    const members = this.room.members.filter(member =>
      member.playerId !== this.options.playerId &&
      this.room!.race!.loadedIds.includes(member.playerId));
    for (const [id, peer] of this.peers) {
      if (members.some(member => member.playerId === id)) continue;
      this.peers.delete(id);
      this.close(peer);
    }
    for (const member of members) {
      const peer = this.peers.get(member.playerId);
      if (peer) peer.slot = member.slot;
      else this.create(member.playerId, member.slot);
    }
    this.timer ??= setInterval(() => this.maintain(), 1_000);
  }

  private current(peer: PeerState, pc = peer.pc): boolean {
    return !this.disposed && this.peers.get(peer.id) === peer && peer.pc === pc;
  }

  private create(id: string, slot: number, previous?: PeerState): PeerState | undefined {
    let pc: RTCPeerConnection | undefined;
    try {
      pc = this.peerFactory({ iceServers: this.options.iceServers });
      const now = this.now();
      const peer: PeerState = {
        id, slot, pc,
        motion: pc.createDataChannel("peer-motion", {
          negotiated: true, id: 1, ordered: false, maxRetransmits: 0,
        }),
        control: pc.createDataChannel("peer-control", { negotiated: true, id: 0, ordered: true }),
        generation: "", retired: previous?.retired ?? new Set(), pending: false,
        created: now, repairAt: now, lastPoseAt: previous?.lastPoseAt ?? now,
        lastRelayRequest: previous?.lastRelayRequest ?? -Infinity,
        forced: previous?.forced ?? false,
        probeAt: -Infinity, ackAt: -Infinity, statsAt: -Infinity,
        statsPending: false, iceRoute: "rtc", sent: previous?.sent ?? 0,
        received: previous?.received ?? 0, relayed: previous?.relayed ?? 0,
        dropped: previous?.dropped ?? 0, repairs: previous?.repairs ?? 0,
        tokens: 60, tokenAt: now,
      };
      if (previous?.generation) {
        peer.retired.add(previous.generation);
        if (peer.retired.size > 16) peer.retired.delete(peer.retired.values().next().value!);
      }
      this.peers.set(id, peer);
      peer.motion.binaryType = "arraybuffer";
      peer.motion.onmessage = event => this.receiveMotion(peer, event.data);
      peer.control.onmessage = event => this.receiveControl(peer, event.data);
      pc.onconnectionstatechange = () => {
        if (!this.current(peer)) return;
        peer.disconnectedAt = pc!.connectionState === "disconnected"
          ? peer.disconnectedAt ?? this.now() : undefined;
        if (pc!.connectionState === "connected") void this.refreshStats(peer);
      };
      if (this.options.playerId < id) {
        peer.generation = crypto.randomUUID();
        void this.offer(peer, false);
      }
      return peer;
    } catch {
      pc?.close();
      return undefined;
    }
  }

  private command(peer: PeerState, signal: Record<string, unknown>): Promise<unknown> {
    const room = this.room!;
    return this.options.send({ type: "p2p-signal", roomId: room.roomId,
      raceId: room.race!.raceId, targetId: peer.id, ...signal });
  }

  private async gather(peer: PeerState, pc: RTCPeerConnection): Promise<void> {
    if (pc.iceGatheringState === "complete") return;
    await new Promise<void>((resolve, reject) => {
      let finished = false;
      const finish = (error?: Error) => {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        pc.removeEventListener("icegatheringstatechange", check);
        if (peer.cancelGather === cancel) peer.cancelGather = undefined;
        error ? reject(error) : resolve();
      };
      const check = () => { if (pc.iceGatheringState === "complete") finish(); };
      const cancel = () => finish(new Error("Peer retired"));
      const timeout = setTimeout(() => finish(new Error("Peer ICE gathering timeout")), 10_000);
      peer.cancelGather = cancel;
      pc.addEventListener("icegatheringstatechange", check);
      check();
    });
  }

  private async offer(peer: PeerState, iceRestart: boolean): Promise<void> {
    if (!this.current(peer) || peer.pending || this.options.playerId > peer.id) return;
    const pc = peer.pc;
    peer.pending = true;
    peer.repairAt = this.now();
    try {
      if (pc.signalingState === "have-local-offer" && pc.localDescription) {
        peer.pending = false;
        void this.command(peer, { kind: "offer", sdp: pc.localDescription.sdp,
          generation: peer.generation }).catch(() => { if (this.current(peer, pc)) peer.dropped++; });
        return;
      }
      if (pc.signalingState !== "stable") return;
      const offer = await pc.createOffer(iceRestart ? { iceRestart: true } : undefined);
      if (!this.current(peer, pc)) return;
      await pc.setLocalDescription(offer);
      await this.gather(peer, pc);
      if (this.current(peer, pc) && pc.localDescription) {
        peer.pending = false;
        void this.command(peer, { kind: "offer", sdp: pc.localDescription.sdp,
          generation: peer.generation }).catch(() => { if (this.current(peer, pc)) peer.dropped++; });
      }
    } catch { if (this.current(peer, pc)) peer.dropped++; }
    finally { if (this.current(peer, pc)) peer.pending = false; }
  }

  async receiveSignal(signal: PeerSignal): Promise<void> {
    const room = this.room;
    if (!room?.race || signal.roomId !== room.roomId || signal.raceId !== room.race.raceId) return;
    let peer = this.peers.get(signal.playerId);
    if (!peer) return;
    if (signal.type === "p2p-relay") {
      peer.forced = true;
      peer.probeSequence = undefined;
      peer.probeAt = -Infinity;
      return;
    }
    const initiator = this.options.playerId < peer.id;
    if ((signal.kind === "offer") === initiator || peer.retired.has(signal.generation)) return;
    if (signal.kind === "offer" && signal.generation !== peer.generation) {
      if (peer.generation) {
        const previous = peer;
        this.peers.delete(previous.id);
        this.close(previous);
        peer = this.create(previous.id, previous.slot, previous);
        if (!peer) return;
      }
      peer.generation = signal.generation;
    }
    if (signal.generation !== peer.generation || peer.pending) return;
    const current = peer;
    const pc = peer.pc;
    peer.pending = true;
    try {
      if ((signal.kind === "answer" && pc.signalingState !== "have-local-offer") ||
          (signal.kind === "offer" && pc.signalingState !== "stable")) return;
      await pc.setRemoteDescription({ type: signal.kind, sdp: signal.sdp });
      if (!this.current(current, pc)) return;
      if (signal.kind === "offer") {
        await pc.setLocalDescription(await pc.createAnswer());
        await this.gather(current, pc);
        if (this.current(current, pc) && pc.localDescription) {
          await this.command(current, { kind: "answer", sdp: pc.localDescription.sdp,
            generation: current.generation });
        }
      }
    } catch { if (this.current(current, pc)) current.dropped++; }
    finally { if (this.current(current, pc)) current.pending = false; }
  }

  private rtcOpen(peer: PeerState): boolean {
    return peer.motion.readyState === "open" && peer.control.readyState === "open" &&
      !["failed", "closed", "disconnected"].includes(peer.pc.connectionState);
  }

  private route(peer: PeerState): "server" | "rtc" | "direct" | "turn" {
    return !peer.forced && this.rtcOpen(peer) &&
      peer.motion.bufferedAmount <= MOTION_BACKPRESSURE_BYTES ? peer.iceRoute : "server";
  }

  /** Send direct frames, returning the remaining slot mask for server relay. */
  send(bytes: Uint8Array, sequence: number, requestedMask = 255): { relayMask: number; sent: boolean } {
    let relayMask = 0;
    let sent = false;
    const now = this.now();
    for (const member of this.room?.members ?? []) {
      if (member.playerId !== this.options.playerId &&
          this.room!.race!.loadedIds.includes(member.playerId)) relayMask |= 1 << member.slot;
    }
    relayMask &= requestedMask;
    for (const peer of this.peers.values()) {
      if (!(relayMask & (1 << peer.slot))) continue;
      let useServer = this.route(peer) === "server";
      const probe = peer.forced && this.rtcOpen(peer) &&
        peer.motion.bufferedAmount <= MOTION_BACKPRESSURE_BYTES && now - peer.probeAt >= 1_000;
      if (!useServer || probe) {
        try {
          if (probe) { peer.probeAt = now; peer.probeSequence = sequence; }
          peer.motion.send(bytes.buffer instanceof ArrayBuffer
            ? bytes as Uint8Array<ArrayBuffer> : new Uint8Array(bytes));
          peer.sent++;
          sent = true;
        } catch {
          peer.dropped++;
          peer.forced = true;
          useServer = true;
          peer.probeSequence = undefined;
        }
      }
      if (useServer) { relayMask |= 1 << peer.slot; peer.relayed++; }
      else relayMask &= ~(1 << peer.slot);
    }
    return { relayMask, sent };
  }

  directAvailable(slot: number): boolean {
    for (const peer of this.peers.values()) if (peer.slot === slot) return this.rtcOpen(peer);
    return false;
  }

  receivedFromServer(message: Pick<DecodedGameMotion, "playerId">): void {
    const peer = this.peers.get(message.playerId);
    if (peer) peer.lastPoseAt = this.now();
  }

  private receiveMotion(peer: PeerState, data: unknown): void {
    if (!this.current(peer)) return;
    const bytes = data instanceof ArrayBuffer ? new Uint8Array(data)
      : ArrayBuffer.isView(data) ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
        : undefined;
    if (!bytes) return;
    const now = this.now();
    peer.tokens = Math.min(60, peer.tokens + Math.max(0, now - peer.tokenAt) * 0.06);
    peer.tokenAt = now;
    if (peer.tokens < 1) { peer.dropped++; return; }
    peer.tokens--;
    const frame = this.decoder.decode(bytes);
    const room = this.room;
    // A direct frame carries its sender's slot, which must be this link's peer.
    if (!frame || !room?.race || frame.raceTag !== motionRaceTag(room.race.raceId) ||
        frame.slot !== peer.slot || frame.recipientMask) { peer.dropped++; return; }
    if (peer.lastRtcSequence !== undefined &&
        !isNewerSequence(frame.sequence, peer.lastRtcSequence)) return;
    peer.lastRtcSequence = frame.sequence;
    peer.lastPoseAt = this.now();
    peer.received++;
    if (this.now() - peer.ackAt >= 1_000) {
      peer.ackAt = this.now();
      this.control(peer, { type: "motion-ack", sequence: frame.sequence });
    }
    this.options.receiveFrame?.(decodeMotionFrame(bytes));
    this.options.receive({ roomId: room.roomId, raceId: room.race.raceId, playerId: peer.id,
      sequence: frame.sequence, payload: frame.payload });
  }

  private control(peer: PeerState, message: Record<string, unknown>): void {
    if (peer.control.readyState !== "open" || peer.control.bufferedAmount > 4_096) return;
    try { peer.control.send(JSON.stringify(message)); }
    catch { peer.dropped++; }
  }

  private receiveControl(peer: PeerState, data: unknown): void {
    if (!this.current(peer) || typeof data !== "string" || data.length > 256) return;
    try {
      const message = JSON.parse(data) as Record<string, unknown>;
      const now = this.now();
      if (message.type === "ping" && typeof message.at === "number" && Number.isFinite(message.at)) {
        this.control(peer, { type: "pong", at: message.at });
      } else if (message.type === "pong" && message.at === peer.pingAt &&
          typeof message.at === "number" && now - message.at >= 0 && now - message.at < 3_000) {
        peer.rtt = now - message.at;
        peer.rttAt = now;
      } else if (message.type === "motion-ack" &&
          typeof message.sequence === "number" && Number.isInteger(message.sequence) &&
          message.sequence >= 0 && message.sequence <= 0xffff_ffff &&
          peer.probeSequence !== undefined && message.sequence === peer.probeSequence &&
          now - peer.probeAt < 3_000) {
        peer.forced = false;
        peer.probeSequence = undefined;
      }
    } catch { peer.dropped++; }
  }

  maintain(): void {
    const room = this.room;
    if (!room?.race) return;
    const now = this.now();
    const checkSilence = now >= this.nextSilenceCheck;
    if (checkSilence) this.nextSilenceCheck = now + 5_000;
    for (const peer of this.peers.values()) {
      if (peer.control.readyState === "open") {
        peer.pingAt = now;
        this.control(peer, { type: "ping", at: now });
      }
      if (this.rtcOpen(peer) && now - peer.statsAt >= 5_000) void this.refreshStats(peer);
      if (checkSilence && room.phase === "racing" && now - peer.lastPoseAt > 2_000 &&
          now - peer.lastRelayRequest >= 10_000) {
        peer.lastRelayRequest = now;
        void this.options.send({ type: "p2p-relay", roomId: room.roomId,
          raceId: room.race.raceId, targetId: peer.id }).catch(() => {});
      }
      if (this.options.playerId > peer.id || peer.pending || now - peer.repairAt < REPAIR_INTERVAL_MS) continue;
      const state = peer.pc.connectionState;
      if (state === "disconnected") peer.disconnectedAt ??= now;
      const failed = state === "failed" || state === "closed" ||
        peer.motion.readyState === "closed" || peer.control.readyState === "closed" ||
        (peer.disconnectedAt !== undefined && now - peer.disconnectedAt >= DISCONNECT_GRACE_MS) ||
        (!this.rtcOpen(peer) && now - peer.created >= 15_000);
      if (!failed) continue;
      peer.repairs++;
      peer.repairAt = now;
      if (state === "closed" || peer.motion.readyState === "closed" ||
          peer.control.readyState === "closed") {
        this.peers.delete(peer.id);
        this.close(peer);
        this.create(peer.id, peer.slot, peer);
      } else void this.offer(peer, true);
    }
  }

  private async refreshStats(peer: PeerState): Promise<void> {
    if (!this.current(peer) || peer.statsPending || typeof peer.pc.getStats !== "function") return;
    peer.statsPending = true;
    peer.statsAt = this.now();
    const pc = peer.pc;
    try {
      const report = await pc.getStats();
      if (!this.current(peer, pc)) return;
      type Stats = RTCStats & { selectedCandidatePairId?: string; localCandidateId?: string;
        remoteCandidateId?: string; state?: string; nominated?: boolean;
        candidateType?: string; currentRoundTripTime?: number };
      let pair: Stats | undefined;
      report.forEach(raw => {
        const stat = raw as Stats;
        if (stat.type === "transport" && stat.selectedCandidatePairId) {
          pair = report.get(stat.selectedCandidatePairId) as Stats | undefined;
        }
      });
      if (!pair) report.forEach(raw => {
        const stat = raw as Stats;
        if (!pair && stat.type === "candidate-pair" && stat.state === "succeeded" &&
            stat.nominated) pair = stat;
      });
      if (!pair) return;
      const local = report.get(pair.localCandidateId ?? "") as Stats | undefined;
      const remote = report.get(pair.remoteCandidateId ?? "") as Stats | undefined;
      if (!local && !remote) return;
      peer.iceRoute = local?.candidateType === "relay" || remote?.candidateType === "relay"
        ? "turn" : "direct";
      peer.candidate = [local?.candidateType, remote?.candidateType].filter(Boolean).join("/");
      if (typeof pair.currentRoundTripTime === "number" &&
          Number.isFinite(pair.currentRoundTripTime)) {
        peer.transportRtt = pair.currentRoundTripTime * 1_000;
      }
    } catch { /* stats are best-effort diagnostics */ }
    finally { if (this.current(peer, pc)) peer.statsPending = false; }
  }

  latency(playerId: string): number | undefined {
    const peer = this.peers.get(playerId);
    return peer && this.route(peer) !== "server" && peer.rttAt !== undefined &&
      this.now() - peer.rttAt < 3_000 ? peer.rtt : undefined;
  }

  diagnostics(): PeerDiagnostic[] {
    const now = this.now();
    return [...this.peers.values()].map((peer, index) => ({
      peer: index + 1, route: this.route(peer), connection: peer.pc.connectionState,
      rttMs: this.latency(peer.id), transportRttMs: peer.transportRtt,
      candidate: peer.candidate, stateAgeMs: Math.max(0, now - peer.lastPoseAt),
      bufferedBytes: peer.motion.bufferedAmount, sent: peer.sent,
      received: peer.received, relayed: peer.relayed, dropped: peer.dropped,
      repairs: peer.repairs, forcedRelay: peer.forced,
    }));
  }

  private close(peer: PeerState): void {
    peer.cancelGather?.();
    peer.pc.onconnectionstatechange = null;
    peer.motion.onmessage = null;
    peer.control.onmessage = null;
    peer.pc.close();
  }

  clear(): void {
    clearInterval(this.timer);
    this.timer = undefined;
    const retired = [...this.peers.values()];
    this.peers.clear();
    for (const peer of retired) this.close(peer);
    this.decoder = new GameMotionDecoder();
    this.nextSilenceCheck = this.now() + 5_000;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clear();
    this.room = undefined;
  }
}
