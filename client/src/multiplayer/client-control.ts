import { GameMotionDecoder, type DecodedGameMotion } from "./payload";
import { ClockSynchronizer, MotionRoundTripTracker } from "./network-timing";
import type { RaceScope, PodiumScope } from "./race-session";
import { forgetConnectedClient } from "./server-latency";

export interface ControlRequest {
  type: string;
  clientTick?: number;
  [key: string]: unknown;
}

interface PendingRequest {
  resolve(value: unknown): void;
  reject(reason: unknown): void;
  timer: ReturnType<typeof setTimeout>;
  clockTick?: number;
}

export interface ClientControlHost {
  peer?: Pick<RTCPeerConnection, "close">;
  control?: Pick<RTCDataChannel, "readyState" | "bufferedAmount" | "send" | "close">;
  motion?: Pick<RTCDataChannel, "close">;
  abort?: AbortController;
  heartbeat?: ReturnType<typeof setInterval>;
  iceRefresh?: ReturnType<typeof setInterval>;
  disconnectTimer?: ReturnType<typeof setTimeout>;
  peerTransport?: { dispose(): void };
  decoder: GameMotionDecoder;
  cancelConnect?: (reason: Error) => void;
  nextId: number;
  pending: Map<string, PendingRequest>;
  clock: ClockSynchronizer;
  motionScope?: RaceScope;
  podiumScope?: PodiumScope;
  raceLatencies: Map<string, number>;
  playerId?: string;
  motionListeners: Set<(message: DecodedGameMotion) => void>;
  echoRtt: MotionRoundTripTracker;
  listeners: Set<(message: unknown) => void>;
  closeListeners: Set<() => void>;
}

/** Normalize any page URL to the same-origin SDP offer endpoint. */
export function sameOriginOfferUrl(pageUrl: string): string {
  const url = new URL(pageUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("HTTP(S) page required");
  }
  url.pathname = "/multiplayer/offer";
  url.search = "";
  url.hash = "";
  return url.href;
}

/** Send a reliable control request with bounded queue, deadline and RTT tracking. */
export function sendControlRequest(host: ClientControlHost,
  message: ControlRequest): Promise<unknown> {
  const channel = host.control;
  if (!channel || channel.readyState !== "open") {
    return Promise.reject(new Error("Not connected"));
  }
  if (host.pending.size >= 32 || channel.bufferedAmount > 65_536) {
    return Promise.reject(new Error("Connection busy"));
  }
  const id = String(++host.nextId);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (message.type === "clock") host.echoRtt.failed(id);
      host.pending.delete(id);
      reject(new Error("Request timeout; synchronize room before retrying"));
    }, 10_000);
    host.pending.set(id, {
      resolve, reject, timer,
      clockTick: message.type === "clock" ? message.clientTick : undefined,
    });
    if (message.type === "clock") host.echoRtt.begin(id, message.clientTick!);
    try { channel.send(JSON.stringify({ ...message, requestId: id })); }
    catch (error) {
      clearTimeout(timer);
      host.pending.delete(id);
      if (message.type === "clock") host.echoRtt.failed(id);
      reject(error);
    }
  });
}

export function subscribeControl(host: ClientControlHost,
  listener: (message: unknown) => void): () => void {
  host.listeners.add(listener);
  return () => { host.listeners.delete(listener); };
}

export function onClientClose(host: ClientControlHost, listener: () => void): () => void {
  host.closeListeners.add(listener);
  return () => { host.closeListeners.delete(listener); };
}

/** Release all transport state and reject requests tied to the retired peer. */
export function disposeClient(host: ClientControlHost): void {
  const peer = host.peer;
  host.peer = undefined;
  forgetConnectedClient(host);
  host.abort?.abort();
  host.abort = undefined;
  clearInterval(host.heartbeat);
  host.heartbeat = undefined;
  clearInterval(host.iceRefresh);
  host.iceRefresh = undefined;
  clearTimeout(host.disconnectTimer);
  host.disconnectTimer = undefined;
  host.peerTransport?.dispose();
  host.peerTransport = undefined;
  host.decoder = new GameMotionDecoder();
  host.cancelConnect?.(new Error("Connection closed"));
  for (const request of host.pending.values()) {
    clearTimeout(request.timer);
    request.reject(new Error("Connection closed"));
  }
  host.pending.clear();
  host.clock.reset();
  host.motionScope = undefined;
  host.podiumScope = undefined;
  host.raceLatencies.clear();
  host.playerId = undefined;
  host.motionListeners.clear();
  host.echoRtt.clear();
  host.control?.close();
  host.motion?.close();
  host.control = undefined;
  host.motion = undefined;
  peer?.close();
  if (peer) for (const listener of host.closeListeners) listener();
  host.listeners.clear();
  host.closeListeners.clear();
}
