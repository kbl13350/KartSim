import type { ClientConnectionHost, ServerControlEvent } from "./client-connect";
import { serverError } from "./errors";
import type { PeerMesh } from "./peer-mesh";

/** Dispatch one validated control event, regardless of its network transport. */
export function receiveGameControlEvent(host: ClientConnectionHost, raw: unknown,
  validate: (value: unknown) => ServerControlEvent | undefined,
  now: () => number): void {
  const message = validate(raw);
  if (!message) { host.dispose(); return; }

  const scope = host.motionScope;
  if (message.type === "latency-probe" && scope && scope.roomId === message.roomId &&
      scope.raceId === message.raceId) {
    void host.request({ type: "latency-reply", roomId: message.roomId,
      raceId: message.raceId, nonce: message.nonce }).catch(() => {});
  }
  if (message.type === "latency" && scope && scope.roomId === message.roomId &&
      scope.raceId === message.raceId) {
    host.raceLatencies.set(message.playerId!, message.latencyMs!);
  }

  const pending = message.requestId ? host.pending.get(message.requestId) : undefined;
  if (pending && message.requestId) {
    clearTimeout(pending.timer);
    host.pending.delete(message.requestId);
    if (pending.clockTick !== undefined && message.type !== "error") {
      const receivedAt = now();
      if (message.type !== "clock" || message.clientTick !== pending.clockTick ||
          !host.clock.record(pending.clockTick, message.serverTick!, receivedAt)) {
        pending.reject(new Error("Invalid clock reply"));
        host.dispose();
        return;
      }
      host.echoRtt.reply(message.requestId, receivedAt);
    }
    if (message.type === "error" && pending.clockTick !== undefined) {
      host.echoRtt.failed(message.requestId);
    }
    if (message.type === "error") pending.reject(serverError(message));
    else pending.resolve(message);
  }
  if (message.type === "p2p-signal" || message.type === "p2p-relay") {
    void host.peerTransport?.receiveSignal(message as Parameters<PeerMesh["receiveSignal"]>[0]);
  }
  for (const listener of host.listeners) listener(message);
}
