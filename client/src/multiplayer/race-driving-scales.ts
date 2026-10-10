/** Race distance and slipstream modifiers used by the multiplayer race. */

export interface RacePoint {
  x: number;
  y: number;
  z: number;
}

export interface RaceProgressPeer {
  progress?: { distance: number };
}

export interface SlipstreamPeer {
  playerId: string;
  position: RacePoint;
  forward: RacePoint;
}

const float32 = Math.fround;

function pointDistance(first: RacePoint, second: RacePoint): number {
  return Math.hypot(
    first.x - second.x,
    first.y - second.y,
    first.z - second.z,
  );
}

/** Reduce drag and steering as the local kart falls behind the race leader. */
export function computeCatchupScales(
  distance: number,
  peers: readonly RaceProgressPeer[],
): { drag: number; steering: number } {
  if (!Number.isFinite(distance) || distance < 0) return { drag: 1, steering: 1 };

  let leaderDistance = distance;
  for (const peer of peers) {
    const peerDistance = peer.progress?.distance;
    if (peerDistance !== undefined && Number.isFinite(peerDistance) &&
      peerDistance >= 0 && peerDistance > leaderDistance) {
      leaderDistance = peerDistance;
    }
  }

  const gap = float32(Math.max(0, float32(leaderDistance - distance)));
  if (gap === 0) return { drag: 1, steering: 1 };

  const drag = gap < float32(300)
    ? float32(float32(1) - Math.min(float32(0.1), float32(gap / float32(400))))
    : float32(float32(1) - float32(
      float32(0.1) + Math.min(float32(0.05), float32(gap / float32(16_000))),
    ));
  const steering = float32(float32(1) - Math.min(float32(0.05),
    float32(gap / float32(1_000))));
  return { drag, steering };
}

/** Duration multiplier for the charger when a kart trails the leader. */
export function chargerDurationScale(
  distance: number,
  peers: readonly RaceProgressPeer[],
): number | undefined {
  if (!Number.isFinite(distance) || distance < 0) return undefined;

  let leaderDistance = distance;
  for (const peer of peers) {
    const peerDistance = peer.progress?.distance;
    if (peerDistance !== undefined && Number.isFinite(peerDistance) &&
      peerDistance > leaderDistance) {
      leaderDistance = peerDistance;
    }
  }
  if (leaderDistance === distance) return undefined;

  const gap = float32(leaderDistance - distance);
  return gap >= float32(701) ? float32(1.8)
    : gap >= float32(401) ? float32(1.4)
      : gap >= float32(201) ? float32(1.2) : 1;
}

/** Tracks a nearby leading kart to charge, activate, and cool down a draft. */
export class SlipstreamBoost {
  history = new Map<string, RacePoint[]>();
  chargeStart: number | undefined;
  activeStart: number | undefined;
  cooldownStart: number | undefined;
  presentationVisible = false;
  hudActive = false;

  get windowActive(): boolean {
    return this.activeStart !== undefined;
  }

  update(
    nowMs: number,
    position: RacePoint,
    speedKmh: number,
    peers: readonly SlipstreamPeer[],
    durationMs: number,
    accelerationMultiplier: number,
    resetSuspended = false,
  ): number {
    this.hudActive = this.activeStart !== undefined;

    const presentIds = new Set(peers.map(peer => peer.playerId));
    for (const id of this.history.keys()) {
      if (!presentIds.has(id)) this.history.delete(id);
    }

    let inDraft = false;
    for (const peer of peers) {
      if (![peer.position.x, peer.position.y, peer.position.z,
        peer.forward.x, peer.forward.y, peer.forward.z].every(Number.isFinite)) continue;

      const samples = this.history.get(peer.playerId) ?? [];
      if (samples.length === 0 || pointDistance(peer.position, samples.at(-1)!) > 6) {
        samples.push({ ...peer.position });
        if (samples.length > 5) samples.shift();
      }
      this.history.set(peer.playerId, samples);

      if (inDraft || samples.length < 2 || pointDistance(peer.position, position) > 50) {
        continue;
      }

      for (let index = samples.length - 1; index >= 0; index--) {
        const sample = samples[index]!;
        if (pointDistance(sample, position) >= 6) continue;
        if (index === samples.length - 1) {
          const offset = {
            x: peer.position.x - position.x,
            y: peer.position.y - position.y,
            z: peer.position.z - position.z,
          };
          if (offset.x * peer.forward.x + offset.y * peer.forward.y +
            offset.z * peer.forward.z < 0) break;
        }
        inDraft = true;
        break;
      }
    }

    if (!Number.isFinite(nowMs) || !Number.isFinite(speedKmh) ||
      !Number.isFinite(accelerationMultiplier) || !Number.isFinite(durationMs) ||
      durationMs <= 0 || accelerationMultiplier <= 1 ||
      accelerationMultiplier > 4 || resetSuspended || speedKmh < 100) {
      inDraft = false;
    }

    if (this.activeStart !== undefined) {
      if (nowMs > this.activeStart + durationMs) {
        this.activeStart = undefined;
        this.cooldownStart = nowMs;
      } else {
        this.chargeStart = undefined;
        this.presentationVisible = false;
        return float32(accelerationMultiplier);
      }
    }

    if (inDraft) {
      if (this.cooldownStart !== undefined && nowMs < this.cooldownStart + 3_000) {
        this.presentationVisible = false;
        return 1;
      }
      this.presentationVisible = true;
      this.chargeStart ??= nowMs;
      if (nowMs > this.chargeStart + 2_500) {
        this.activeStart = nowMs;
        return float32(accelerationMultiplier);
      }
      return 1;
    }

    this.chargeStart = undefined;
    this.presentationVisible = false;
    return 1;
  }

  reset(): void {
    this.history.clear();
    this.chargeStart = undefined;
    this.activeStart = undefined;
    this.cooldownStart = undefined;
    this.presentationVisible = false;
    this.hudActive = false;
  }
}
