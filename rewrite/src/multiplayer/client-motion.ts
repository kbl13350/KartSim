import { isNewerSequence } from "./motion";
import { GameMotionEncoder, type DecodedGameMotion, type GameMotionSample } from "./payload";
import type { PeerDiagnostic } from "./peer-mesh";
import type { RaceScope } from "./race-session";
import type { ClockSample, ClockSynchronizer } from "./network-timing";

interface ClientMotionScope extends RaceScope {
  encoder?: GameMotionEncoder;
}

export interface ClientMotionHost {
  playerId?: string;
  motionScope?: ClientMotionScope;
  motion?: Pick<RTCDataChannel, "readyState" | "bufferedAmount" | "send">;
  decoder: { decode(input: Uint8Array): DecodedGameMotion | undefined };
  peerTransport?: {
    send(frame: Uint8Array, sequence: number, recipientMask: number):
      { relayMask: number; sent: boolean };
    receivedFromServer(message: DecodedGameMotion): void;
    diagnostics(): PeerDiagnostic[];
  };
  motionListeners: Set<(message: DecodedGameMotion) => void>;
  clock: ClockSynchronizer;
  dispose(): void;
}

/** A malformed server motion packet retires the connection, as in the release. */
export function acceptServerMotion(host: ClientMotionHost, input: unknown): void {
  const bytes = input instanceof ArrayBuffer ? new Uint8Array(input)
    : ArrayBuffer.isView(input) ? new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
      : undefined;
  if (!bytes) { host.dispose(); return; }
  const message = host.decoder.decode(bytes);
  if (!message) { host.dispose(); return; }
  acceptGameMotion(host, message, true);
}

/** Scope and sequence filtering shared by direct peer and server traffic. */
export function acceptGameMotion(host: ClientMotionHost, message: DecodedGameMotion,
  fromServer = false): void {
  const scope = host.motionScope;
  if (!scope || scope.roomId !== message.roomId || scope.raceId !== message.raceId ||
      message.playerId === host.playerId || !scope.members.has(message.playerId)) return;
  const previous = scope.received.get(message.playerId);
  if (previous !== undefined && !isNewerSequence(message.sequence, previous)) return;
  scope.received.set(message.playerId, message.sequence);
  if (fromServer) host.peerTransport?.receivedFromServer(message);
  for (const listener of host.motionListeners) listener(message);
}

/** Send one encoded sample to direct peers and use the relay for remaining slots. */
export function sendGameMotion(host: ClientMotionHost, sample: GameMotionSample,
  requestedMask?: number): boolean {
  const scope = host.motionScope;
  const channel = host.motion;
  if (!scope?.enabled || !scope.recipientMask || !host.playerId ||
      (requestedMask !== undefined && (!Number.isInteger(requestedMask) ||
        requestedMask < 0 || requestedMask > 255))) return false;
  const recipients = scope.recipientMask & (requestedMask ?? 255);
  if (!recipients) return false;
  const sequence = (scope.sequence + 1) >>> 0;
  scope.encoder ??= new GameMotionEncoder({ roomId: scope.roomId,
    raceId: scope.raceId, playerId: host.playerId });
  const bytes = scope.encoder.encode(sample, sequence);
  const direct = host.peerTransport?.send(bytes, sequence, recipients);
  let sent = direct?.sent ?? false;
  if (!direct || direct.relayMask) {
    bytes[3] = direct?.relayMask ?? recipients;
    if (channel?.readyState === "open" && channel.bufferedAmount <= 8_192) {
      try { channel.send(bytes as Uint8Array<ArrayBuffer>); sent = true; }
      catch { host.dispose(); return false; }
    }
  }
  if (sent) scope.sequence = sequence;
  return sent;
}

export function networkDiagnostics(host: ClientMotionHost): PeerDiagnostic[] {
  return host.peerTransport?.diagnostics() ?? [];
}

export function subscribeGameMotion(host: ClientMotionHost,
  listener: (message: DecodedGameMotion) => void): () => void {
  host.motionListeners.add(listener);
  return () => { host.motionListeners.delete(listener); };
}

export function captureNetworkClock(host: ClientMotionHost): ClockSample | undefined {
  return host.clock.capture(performance.now());
}
