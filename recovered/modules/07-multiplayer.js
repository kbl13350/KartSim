class ll0 {
  constructor(e) {
    this.options = e;
  }
  options;
  active;
  revision = 0;
  roomId;
  disposed = !1;
  update(e) {
    if (
      this.disposed ||
      (e.roomId !== this.roomId && (this.reset(), (this.roomId = e.roomId)),
      e.revision <= this.revision)
    )
      return;
    this.revision = e.revision;
    const t = e.race;
    if (e.phase === "open" || !t) {
      const r = this.active;
      if (r && !r.failed) {
        try {
          r.value?.updateRoom?.(structuredClone(e));
        } catch (s) {
          this.fail(r, s);
          return;
        }
        if (r.value?.presentingResults?.()) return;
      }
      this.release();
      return;
    }
    if (this.active?.raceId !== t.raceId) {
      this.release();
      const r = {
        roomId: e.roomId,
        raceId: t.raceId,
        abort: new AbortController(),
        scheduled: !1,
        failed: !1,
        room: structuredClone(e),
      };
      if (((this.active = r), e.phase !== "loading")) {
        this.fail(r, new Error("Missed race loading phase"));
        return;
      }
      this.prepare(r, structuredClone(e), structuredClone(t));
      return;
    }
    const i = this.active;
    if (
      e.channelName !== i.room.channelName ||
      t.channelName !== i.room.race?.channelName ||
      G2(e) !== G2(i.room) ||
      G2(t) !== G2(i.room.race) ||
      !oR(t.roadblock, i.room.race?.roadblock) ||
      !Nw(t.lte, i.room.race?.lte) ||
      !t7(t.rp, i.room.race?.rp) ||
      e.mode !== i.room.mode ||
      e.speed !== i.room.speed ||
      e.resourceVersion !== i.room.resourceVersion ||
      e.name !== i.room.name ||
      e.speedVersion !== i.room.speedVersion
    ) {
      this.fail(i, new Error("比赛加载期间频道配置发生变化。"));
      return;
    }
    if (((i.room = structuredClone(e)), !i.failed))
      try {
        i.value?.updateRoom?.(structuredClone(e));
      } catch (r) {
        this.fail(i, r);
        return;
      }
    if (!(i.failed || i.scheduled || t.startAt === void 0)) {
      if (!i.value || !i.mapping) {
        this.fail(i, new Error("Start arrived before race preparation"));
        return;
      }
      i.scheduled = !0;
      try {
        i.value.scheduleStart(Y3(t.startAt, i.mapping));
      } catch (r) {
        this.fail(i, r);
      }
    }
  }
  async prepare(e, t, i) {
    try {
      const r = await this.options.loader.prepare(t, i, e.abort.signal);
      if (this.active !== e || e.abort.signal.aborted) {
        r.dispose();
        return;
      }
      e.value = r;
      const s = this.options.captureClock();
      if (((e.mapping = s && Object.freeze({ ...s })), !e.mapping))
        throw new Error("Server clock sample expired during loading");
      (r.bindClock?.(e.mapping),
        r.updateRoom?.(structuredClone(e.room)),
        r.showWaiting?.(),
        await this.options.send({
          type: "loaded",
          roomId: e.roomId,
          raceId: e.raceId,
        }));
    } catch (r) {
      this.active === e && !e.abort.signal.aborted && this.fail(e, r);
    }
  }
  fail(e, t) {
    e.failed ||
      ((e.failed = !0),
      e.abort.abort(),
      e.value?.dispose(),
      (e.value = void 0),
      this.options.onError(t),
      this.options
        .send({ type: "load-failed", roomId: e.roomId, raceId: e.raceId })
        .catch((i) => {
          this.active === e && !this.disposed && this.options.onError(i);
        }));
  }
  release() {
    const e = this.active;
    ((this.active = void 0), e && (e.abort.abort(), e.value?.dispose()));
  }
  reset() {
    (this.release(), (this.revision = 0), (this.roomId = void 0));
  }
  dispose() {
    ((this.disposed = !0), this.reset());
  }
  releasePresentedRace() {
    const e = this.active;
    !e || e.failed || e.value?.presentingResults?.() || this.release();
  }
}
const ul0 = "stun:stun.cloudflare.com:3478",
  hl0 = new Set([
    "turn:turn.cloudflare.com:3478?transport=udp",
    "turn:turn.cloudflare.com:3478?transport=tcp",
    "turn:turn.cloudflare.com:443?transport=udp",
    "turn:turn.cloudflare.com:80?transport=tcp",
    "turns:turn.cloudflare.com:5349?transport=tcp",
    "turns:turn.cloudflare.com:443?transport=tcp",
  ]);
function vf(n) {
  const e = [{ urls: ul0 }];
  if (!Array.isArray(n)) return e;
  const t = new Set();
  for (const i of n.slice(0, 8)) {
    if (
      !i ||
      typeof i != "object" ||
      typeof i.username != "string" ||
      !i.username.length ||
      i.username.length > 512 ||
      typeof i.credential != "string" ||
      !i.credential.length ||
      i.credential.length > 512
    )
      continue;
    const r = Array.isArray(i.urls) ? i.urls : [i.urls],
      s = [];
    for (const o of r.slice(0, 12))
      typeof o == "string" && hl0.has(o) && !t.has(o) && (t.add(o), s.push(o));
    s.length &&
      typeof i.username == "string" &&
      i.username.length > 0 &&
      i.username.length <= 512 &&
      typeof i.credential == "string" &&
      i.credential.length > 0 &&
      i.credential.length <= 512 &&
      e.push({ urls: s, username: i.username, credential: i.credential });
  }
  return e;
}
const kT = 8192,
  dl0 = 3e3,
  fl0 = 5e3;
class pl0 {
  constructor(e) {
    this.options = e;
  }
  options;
  peers = new Map();
  room;
  timer;
  disposed = !1;
  nextSilenceCheck = 0;
  decoder = new d6();
  now() {
    return this.options.now?.() ?? performance.now();
  }
  updateIceServers(e) {
    this.options.iceServers = e;
    for (const t of this.peers.values())
      try {
        t.pc.setConfiguration({ iceServers: e });
      } catch {}
  }
  bind(e) {
    if (this.disposed) return;
    const t =
      e?.race &&
      ["loading", "countdown", "racing"].includes(e.phase) &&
      e.race.loadedIds.includes(this.options.playerId);
    if (
      ((!t ||
        e?.roomId !== this.room?.roomId ||
        e?.race?.raceId !== this.room?.race?.raceId) &&
        this.clear(),
      (this.room = t ? e : void 0),
      !this.room)
    )
      return;
    const i = this.room.members.filter(
      (r) =>
        r.playerId !== this.options.playerId &&
        this.room.race.loadedIds.includes(r.playerId),
    );
    for (const [r, s] of this.peers)
      i.some((o) => o.playerId === r) || (this.peers.delete(r), this.close(s));
    for (const r of i) {
      const s = this.peers.get(r.playerId);
      s ? (s.slot = r.slot) : this.create(r.playerId, r.slot);
    }
    this.timer ??= setInterval(() => this.maintain(), 1e3);
  }
  current(e, t = e.pc) {
    return !this.disposed && this.peers.get(e.id) === e && e.pc === t;
  }
  create(e, t, i) {
    let r;
    try {
      r = new RTCPeerConnection({ iceServers: this.options.iceServers });
      const s = this.now(),
        o = {
          id: e,
          slot: t,
          pc: r,
          motion: r.createDataChannel("peer-motion", {
            negotiated: !0,
            id: 1,
            ordered: !1,
            maxRetransmits: 0,
          }),
          control: r.createDataChannel("peer-control", {
            negotiated: !0,
            id: 0,
            ordered: !0,
          }),
          generation: "",
          retired: i?.retired ?? new Set(),
          pending: !1,
          created: s,
          repairAt: s,
          lastPoseAt: i?.lastPoseAt ?? s,
          lastRelayRequest: i?.lastRelayRequest ?? -1 / 0,
          forced: i?.forced ?? !1,
          probeAt: -1 / 0,
          ackAt: -1 / 0,
          statsAt: -1 / 0,
          statsPending: !1,
          iceRoute: "rtc",
          sent: i?.sent ?? 0,
          received: i?.received ?? 0,
          relayed: i?.relayed ?? 0,
          dropped: i?.dropped ?? 0,
          repairs: i?.repairs ?? 0,
          tokens: 60,
          tokenAt: s,
        };
      return (
        i?.generation &&
          (o.retired.add(i.generation),
          o.retired.size > 16 &&
            o.retired.delete(o.retired.values().next().value)),
        this.peers.set(e, o),
        (o.motion.binaryType = "arraybuffer"),
        (o.motion.onmessage = (a) => this.receiveMotion(o, a.data)),
        (o.control.onmessage = (a) => this.receiveControl(o, a.data)),
        (r.onconnectionstatechange = () => {
          this.current(o) &&
            ((o.disconnectedAt =
              o.pc.connectionState === "disconnected"
                ? (o.disconnectedAt ?? this.now())
                : void 0),
            o.pc.connectionState === "connected" && this.refreshStats(o));
        }),
        this.options.playerId < e &&
          ((o.generation = crypto.randomUUID()), this.offer(o, !1)),
        o
      );
    } catch {
      r?.close();
      return;
    }
  }
  command(e, t) {
    const i = this.room;
    return this.options.send({
      type: "p2p-signal",
      roomId: i.roomId,
      raceId: i.race.raceId,
      targetId: e.id,
      ...t,
    });
  }
  async gather(e, t) {
    t.iceGatheringState !== "complete" &&
      (await new Promise((i, r) => {
        const s = (l) => {
            (clearTimeout(c),
              t.removeEventListener("icegatheringstatechange", o),
              e.cancelGather === a && (e.cancelGather = void 0),
              l ? r(l) : i());
          },
          o = () => {
            t.iceGatheringState === "complete" && s();
          },
          a = () => s(new Error("Peer retired")),
          c = setTimeout(() => s(new Error("Peer ICE gathering timeout")), 1e4);
        ((e.cancelGather = a),
          t.addEventListener("icegatheringstatechange", o),
          o());
      }));
  }
  async offer(e, t) {
    if (!this.current(e) || e.pending || this.options.playerId > e.id) return;
    const i = e.pc;
    ((e.pending = !0), (e.repairAt = this.now()));
    try {
      if (i.signalingState === "have-local-offer" && i.localDescription) {
        ((e.pending = !1),
          this.command(e, {
            kind: "offer",
            sdp: i.localDescription.sdp,
            generation: e.generation,
          }).catch(() => {
            this.current(e, i) && e.dropped++;
          }));
        return;
      }
      if (i.signalingState !== "stable") return;
      const r = await i.createOffer(t ? { iceRestart: !0 } : void 0);
      if (!this.current(e, i)) return;
      (await i.setLocalDescription(r),
        await this.gather(e, i),
        this.current(e, i) &&
          i.localDescription &&
          ((e.pending = !1),
          this.command(e, {
            kind: "offer",
            sdp: i.localDescription.sdp,
            generation: e.generation,
          }).catch(() => {
            this.current(e, i) && e.dropped++;
          })));
    } catch {
      this.current(e, i) && e.dropped++;
    } finally {
      this.current(e, i) && (e.pending = !1);
    }
  }
  async receiveSignal(e) {
    const t = this.room;
    if (!t || e.roomId !== t.roomId || e.raceId !== t.race.raceId) return;
    let i = this.peers.get(e.playerId);
    if (!i) return;
    if (e.type === "p2p-relay") {
      ((i.forced = !0), (i.probeSequence = void 0), (i.probeAt = -1 / 0));
      return;
    }
    const r = this.options.playerId < i.id;
    if ((e.kind === "offer") === r || i.retired.has(e.generation)) return;
    if (e.kind === "offer" && e.generation !== i.generation) {
      if (i.generation) {
        const a = i;
        if (
          (this.peers.delete(a.id),
          this.close(a),
          (i = this.create(a.id, a.slot, a)),
          !i)
        )
          return;
      }
      i.generation = e.generation;
    }
    if (e.generation !== i.generation || i.pending) return;
    const s = i,
      o = i.pc;
    i.pending = !0;
    try {
      if (
        (e.kind === "answer" && o.signalingState !== "have-local-offer") ||
        (e.kind === "offer" && o.signalingState !== "stable") ||
        (await o.setRemoteDescription({ type: e.kind, sdp: e.sdp }),
        !this.current(s, o))
      )
        return;
      e.kind === "offer" &&
        (await o.setLocalDescription(await o.createAnswer()),
        await this.gather(s, o),
        this.current(s, o) &&
          o.localDescription &&
          (await this.command(s, {
            kind: "answer",
            sdp: o.localDescription.sdp,
            generation: s.generation,
          })));
    } catch {
      this.current(s, o) && s.dropped++;
    } finally {
      this.current(s, o) && (s.pending = !1);
    }
  }
  rtcOpen(e) {
    return (
      e.motion.readyState === "open" &&
      e.control.readyState === "open" &&
      !["failed", "closed", "disconnected"].includes(e.pc.connectionState)
    );
  }
  route(e) {
    return !e.forced && this.rtcOpen(e) && e.motion.bufferedAmount <= kT
      ? e.iceRoute
      : "server";
  }
  send(e, t, i = 255) {
    let r = 0,
      s = !1;
    const o = this.now();
    for (const a of this.room?.members ?? [])
      a.playerId !== this.options.playerId &&
        this.room.race.loadedIds.includes(a.playerId) &&
        (r |= 1 << a.slot);
    r &= i;
    for (const a of this.peers.values()) {
      if (!(r & (1 << a.slot))) continue;
      let c = this.route(a) === "server";
      const l =
        a.forced &&
        this.rtcOpen(a) &&
        a.motion.bufferedAmount <= kT &&
        o - a.probeAt >= 1e3;
      if (!c || l)
        try {
          (l && ((a.probeAt = o), (a.probeSequence = t)),
            a.motion.send(e),
            a.sent++,
            (s = !0));
        } catch {
          (a.dropped++, (a.forced = !0), (c = !0), (a.probeSequence = void 0));
        }
      c ? ((r |= 1 << a.slot), a.relayed++) : (r &= ~(1 << a.slot));
    }
    return { relayMask: r, sent: s };
  }
  directAvailable(e) {
    for (const t of this.peers.values())
      if (t.slot === e) return this.rtcOpen(t);
    return !1;
  }
  receivedFromServer(e) {
    const t = this.peers.get(e.playerId);
    t && (t.lastPoseAt = this.now());
  }
  receiveMotion(e, t) {
    if (!this.current(e)) return;
    const i =
      t instanceof ArrayBuffer
        ? new Uint8Array(t)
        : ArrayBuffer.isView(t)
          ? new Uint8Array(t.buffer, t.byteOffset, t.byteLength)
          : void 0;
    if (!i) return;
    const r = this.now();
    if (
      ((e.tokens = Math.min(60, e.tokens + Math.max(0, r - e.tokenAt) * 0.06)),
      (e.tokenAt = r),
      e.tokens < 1)
    ) {
      e.dropped++;
      return;
    }
    e.tokens--;
    const s = this.decoder.decode(i),
      o = this.room;
    if (
      !s ||
      !o ||
      s.roomId !== o.roomId ||
      s.raceId !== o.race.raceId ||
      s.playerId !== e.id ||
      s.recipientMask
    ) {
      e.dropped++;
      return;
    }
    (e.lastRtcSequence !== void 0 && !No(s.sequence, e.lastRtcSequence)) ||
      ((e.lastRtcSequence = s.sequence),
      (e.lastPoseAt = this.now()),
      e.received++,
      this.now() - e.ackAt >= 1e3 &&
        ((e.ackAt = this.now()),
        this.control(e, { type: "motion-ack", sequence: s.sequence })),
      this.options.receive(s));
  }
  control(e, t) {
    if (!(e.control.readyState !== "open" || e.control.bufferedAmount > 4096))
      try {
        e.control.send(JSON.stringify(t));
      } catch {
        e.dropped++;
      }
  }
  receiveControl(e, t) {
    if (!(!this.current(e) || typeof t != "string" || t.length > 256))
      try {
        const i = JSON.parse(t),
          r = this.now();
        i.type === "ping" && Number.isFinite(i.at)
          ? this.control(e, { type: "pong", at: i.at })
          : i.type === "pong" &&
              i.at === e.pingAt &&
              r - i.at >= 0 &&
              r - i.at < 3e3
            ? ((e.rtt = r - i.at), (e.rttAt = r))
            : i.type === "motion-ack" &&
              Number.isInteger(i.sequence) &&
              i.sequence >= 0 &&
              i.sequence <= 4294967295 &&
              e.probeSequence !== void 0 &&
              i.sequence === e.probeSequence &&
              r - e.probeAt < 3e3 &&
              ((e.forced = !1), (e.probeSequence = void 0));
      } catch {
        e.dropped++;
      }
  }
  maintain() {
    const e = this.room;
    if (!e) return;
    const t = this.now(),
      i = t >= this.nextSilenceCheck;
    i && (this.nextSilenceCheck = t + 5e3);
    for (const r of this.peers.values()) {
      if (
        (r.control.readyState === "open" &&
          ((r.pingAt = t), this.control(r, { type: "ping", at: t })),
        this.rtcOpen(r) && t - r.statsAt >= 5e3 && this.refreshStats(r),
        i &&
          e.phase === "racing" &&
          t - r.lastPoseAt > 2e3 &&
          t - r.lastRelayRequest >= 1e4 &&
          ((r.lastRelayRequest = t),
          this.options
            .send({
              type: "p2p-relay",
              roomId: e.roomId,
              raceId: e.race.raceId,
              targetId: r.id,
            })
            .catch(() => {})),
        this.options.playerId > r.id || r.pending || t - r.repairAt < fl0)
      )
        continue;
      const s = r.pc.connectionState;
      (s === "disconnected" && (r.disconnectedAt ??= t),
        (s === "failed" ||
          s === "closed" ||
          r.motion.readyState === "closed" ||
          r.control.readyState === "closed" ||
          (r.disconnectedAt !== void 0 && t - r.disconnectedAt >= dl0) ||
          (!this.rtcOpen(r) && t - r.created >= 15e3)) &&
          (r.repairs++,
          (r.repairAt = t),
          s === "closed" ||
          r.motion.readyState === "closed" ||
          r.control.readyState === "closed"
            ? (this.peers.delete(r.id),
              this.close(r),
              this.create(r.id, r.slot, r))
            : this.offer(r, !0)));
    }
  }
  async refreshStats(e) {
    if (
      !this.current(e) ||
      e.statsPending ||
      typeof e.pc.getStats != "function"
    )
      return;
    ((e.statsPending = !0), (e.statsAt = this.now()));
    const t = e.pc;
    try {
      const i = await t.getStats();
      if (!this.current(e, t)) return;
      let r;
      if (
        (i.forEach((c) => {
          c.type === "transport" &&
            c.selectedCandidatePairId &&
            (r = i.get(c.selectedCandidatePairId));
        }),
        r ||
          i.forEach((c) => {
            !r &&
              c.type === "candidate-pair" &&
              c.state === "succeeded" &&
              c.nominated &&
              (r = c);
          }),
        !r)
      )
        return;
      const s = r,
        o = i.get(s.localCandidateId),
        a = i.get(s.remoteCandidateId);
      if (!o && !a) return;
      ((e.iceRoute =
        o?.candidateType === "relay" || a?.candidateType === "relay"
          ? "turn"
          : "direct"),
        (e.candidate = [o?.candidateType, a?.candidateType]
          .filter(Boolean)
          .join("/")),
        Number.isFinite(s.currentRoundTripTime) &&
          (e.transportRtt = s.currentRoundTripTime * 1e3));
    } catch {
    } finally {
      this.current(e, t) && (e.statsPending = !1);
    }
  }
  latency(e) {
    const t = this.peers.get(e);
    return t &&
      this.route(t) !== "server" &&
      t.rttAt !== void 0 &&
      this.now() - t.rttAt < 3e3
      ? t.rtt
      : void 0;
  }
  diagnostics() {
    const e = this.now();
    return [...this.peers.values()].map((t, i) => ({
      peer: i + 1,
      route: this.route(t),
      connection: t.pc.connectionState,
      rttMs: this.latency(t.id),
      transportRttMs: t.transportRtt,
      candidate: t.candidate,
      stateAgeMs: Math.max(0, e - t.lastPoseAt),
      bufferedBytes: t.motion.bufferedAmount,
      sent: t.sent,
      received: t.received,
      relayed: t.relayed,
      dropped: t.dropped,
      repairs: t.repairs,
      forcedRelay: t.forced,
    }));
  }
  close(e) {
    (e.cancelGather?.(),
      (e.pc.onconnectionstatechange = null),
      (e.motion.onmessage = null),
      (e.control.onmessage = null),
      e.pc.close());
  }
  clear() {
    (clearInterval(this.timer), (this.timer = void 0));
    const e = [...this.peers.values()];
    this.peers.clear();
    for (const t of e) this.close(t);
    ((this.decoder = new d6()), (this.nextSilenceCheck = this.now() + 5e3));
  }
  dispose() {
    this.disposed || ((this.disposed = !0), this.clear(), (this.room = void 0));
  }
}
class gl0 {
  pending;
  acknowledged = !1;
  sent = 0;
  replied = 0;
  latest;
  get milliseconds() {
    return this.latest;
  }
  begin(e, t) {
    (this.acknowledged || (this.latest = void 0),
      (this.acknowledged = !1),
      (this.pending = { id: e, tick: Math.trunc(t) }),
      this.sent++);
  }
  reply(e, t) {
    if (this.pending?.id !== e) return;
    const i = Math.trunc(t);
    i < this.pending.tick ||
      ((this.latest = (i - this.pending.tick) >>> 0),
      (this.acknowledged = !0),
      this.replied++,
      (this.pending = void 0));
  }
  failed(e) {
    this.pending?.id === e &&
      ((this.pending = void 0),
      (this.latest = void 0),
      (this.acknowledged = !1));
  }
  reportAndReset() {
    this.sent && this.replied && this.clear();
  }
  clear() {
    ((this.pending = void 0),
      (this.acknowledged = !1),
      (this.sent = 0),
      (this.replied = 0),
      (this.latest = void 0));
  }
}
class LT {
  peer;
  control;
  motion;
  abort;
  heartbeat;
  peerTransport;
  decoder = new d6();
  iceRefresh;
  disconnectTimer;
  cancelConnect;
  nextId = 0;
  playerId;
  motionScope;
  podiumScope;
  raceLatencies = new Map();
  echoRtt = new gl0();
  motionListeners = new Set();
  raceConnection(e, t, i) {
    const r = this.playerId,
      s = () =>
        !i.aborted &&
        this.playerId === r &&
        this.motionScope?.roomId === e &&
        this.motionScope.raceId === t,
      o = () =>
        !i.aborted &&
        this.playerId === r &&
        this.podiumScope?.roomId === e &&
        this.podiumScope.raceId === t &&
        this.podiumScope.members.has(r);
    if (!r || !s()) throw new Error("Race connection scope is not active");
    const a = this;
    return Object.freeze({
      playerId: r,
      roomId: e,
      raceId: t,
      get hasMotionRecipients() {
        return (
          s() && a.motionScope.enabled && a.motionScope.recipientMask !== 0
        );
      },
      get motionRoundTripMs() {
        return s() ? a.echoRtt.milliseconds : void 0;
      },
      resetMotionRtt: () => {
        s() && a.echoRtt.reportAndReset();
      },
      directMotionAvailable: (c) =>
        s() && (a.peerTransport?.directAvailable(c) ?? !1),
      latencyMs: (c) =>
        s()
          ? (this.peerTransport?.latency(c) ?? this.raceLatencies.get(c))
          : void 0,
      sendTeamCharge: (c, l) =>
        s()
          ? this.request({
              type: "team-charge",
              roomId: e,
              raceId: t,
              charge: c,
              sequence: l,
            })
          : Promise.reject(new Error("Race connection scope expired")),
      sendGiantState: (c, l) =>
        s()
          ? this.request({
              type: "giant-state",
              roomId: e,
              raceId: t,
              sequence: l,
              ...c,
            })
          : Promise.reject(new Error("Race connection scope expired")),
      subscribeGiantState: (c) => {
        if (!s()) return () => {};
        const l = this.subscribe((h) => {
            s() &&
              h.type === "giant-state" &&
              h.roomId === e &&
              h.raceId === t &&
              h.playerId !== r &&
              this.motionScope?.members.has(h.playerId) &&
              c(h);
          }),
          u = () => {
            (l(), i.removeEventListener("abort", u));
          };
        return (i.addEventListener("abort", u, { once: !0 }), u);
      },
      subscribeTeamGauge: (c) => {
        if (!s()) return () => {};
        const l = this.subscribe((h) => {
            s() &&
              h.type === "team-gauge" &&
              h.roomId === e &&
              h.raceId === t &&
              c(h);
          }),
          u = () => {
            (l(), i.removeEventListener("abort", u));
          };
        return (i.addEventListener("abort", u, { once: !0 }), u);
      },
      sendAwardMotion: (c) =>
        s() || o()
          ? this.request({
              type: "award-motion",
              roomId: e,
              raceId: t,
              motion: c,
            })
          : Promise.reject(new Error("Race connection scope expired")),
      sendRaceChat: (c) =>
        s()
          ? this.request({ type: "race-chat", roomId: e, raceId: t, text: c })
          : Promise.reject(new Error("Race connection scope expired")),
      subscribeRaceChat: (c) => {
        if (!s()) return () => {};
        const l = this.subscribe((h) => {
            s() &&
              h.type === "race-chat" &&
              h.roomId === e &&
              h.raceId === t &&
              c(h.message);
          }),
          u = () => {
            (l(), i.removeEventListener("abort", u));
          };
        return (i.addEventListener("abort", u, { once: !0 }), u);
      },
      subscribeAwardMotion: (c) => {
        if (!s()) return () => {};
        const l = this.subscribe((h) => {
            (s() || o()) &&
              h.type === "award-motion" &&
              h.roomId === e &&
              h.raceId === t &&
              h.playerId !== r &&
              (this.podiumScope ?? this.motionScope)?.members.has(h.playerId) &&
              c(h);
          }),
          u = () => {
            (l(), i.removeEventListener("abort", u));
          };
        return (i.addEventListener("abort", u, { once: !0 }), u);
      },
      returnToRoom: () =>
        s() || o()
          ? this.request({ type: "return-room", roomId: e, raceId: t }).then(
              (c) => (
                this.podiumScope?.roomId === e &&
                  this.podiumScope.raceId === t &&
                  this.podiumScope.members.delete(r),
                c
              ),
            )
          : Promise.reject(new Error("Race connection scope expired")),
      reportFinish: (c) =>
        s()
          ? this.request({ type: "finish", roomId: e, raceId: t, elapsedMs: c })
          : Promise.reject(new Error("Race connection scope expired")),
      sendMotion: (c, l) => s() && this.sendMotion(c, l),
      subscribeMotion: (c) => {
        if (!s()) return () => {};
        const l = this.subscribeMotion((h) => {
            s() && h.roomId === e && h.raceId === t && c(h);
          }),
          u = () => {
            (l(), i.removeEventListener("abort", u));
          };
        return (i.addEventListener("abort", u, { once: !0 }), u);
      },
    });
  }
  bindMotionScope(e) {
    if (
      (this.peerTransport?.bind(e),
      !e ||
        !this.playerId ||
        !e.members.some((r) => r.playerId === this.playerId))
    )
      this.podiumScope = void 0;
    else if (e.phase === "finished" && e.race?.results)
      this.podiumScope = {
        roomId: e.roomId,
        raceId: e.race.raceId,
        members: new Set(
          e.members
            .filter(
              (r) =>
                e.race.roster.some((s) => s.playerId === r.playerId) &&
                !e.race.returnedIds?.includes(r.playerId),
            )
            .map((r) => r.playerId),
        ),
      };
    else if (
      e.phase === "open" &&
      !e.race &&
      !e.raceError &&
      this.podiumScope?.roomId === e.roomId
    ) {
      const r = new Set(e.members.map((s) => s.playerId));
      for (const s of this.podiumScope.members)
        r.has(s) || this.podiumScope.members.delete(s);
    } else this.podiumScope = void 0;
    if (
      !e?.race ||
      !this.playerId ||
      !e.members.some((r) => r.playerId === this.playerId)
    ) {
      ((this.motionScope = void 0), this.raceLatencies.clear());
      return;
    }
    const t =
      (e.phase === "loading" && e.race.loadedIds.includes(this.playerId)) ||
      e.phase === "countdown" ||
      e.phase === "racing";
    let i = 0;
    for (const r of e.members)
      r.playerId !== this.playerId &&
        e.race.loadedIds.includes(r.playerId) &&
        (i |= 1 << r.slot);
    if (
      this.motionScope?.roomId === e.roomId &&
      this.motionScope.raceId === e.race.raceId
    ) {
      ((this.motionScope.enabled = t),
        (this.motionScope.members = new Set(e.members.map((r) => r.playerId))),
        (this.motionScope.recipientMask = i));
      return;
    }
    (this.raceLatencies.clear(),
      (this.motionScope = {
        roomId: e.roomId,
        raceId: e.race.raceId,
        members: new Set(e.members.map((r) => r.playerId)),
        sequence: 0,
        received: new Map(),
        enabled: t,
        recipientMask: i,
      }));
  }
  acceptMotion(e) {
    const t =
      e instanceof ArrayBuffer
        ? new Uint8Array(e)
        : ArrayBuffer.isView(e)
          ? new Uint8Array(e.buffer, e.byteOffset, e.byteLength)
          : void 0;
    if (!t) {
      this.dispose();
      return;
    }
    const i = this.decoder.decode(t);
    if (!i) {
      this.dispose();
      return;
    }
    this.acceptMotionMessage(i, !0);
  }
  acceptMotionMessage(e, t = !1) {
    const i = this.motionScope;
    if (
      !i ||
      i.roomId !== e.roomId ||
      i.raceId !== e.raceId ||
      e.playerId === this.playerId ||
      !i.members.has(e.playerId)
    )
      return;
    const r = i.received.get(e.playerId);
    if (!(r !== void 0 && !No(e.sequence, r))) {
      (i.received.set(e.playerId, e.sequence),
        t && this.peerTransport?.receivedFromServer(e));
      for (const s of this.motionListeners) s(e);
    }
  }
  sendMotion(e, t) {
    const i = this.motionScope,
      r = this.motion;
    if (
      !i?.enabled ||
      !i.recipientMask ||
      !this.playerId ||
      (t !== void 0 && (!Number.isInteger(t) || t < 0 || t > 255))
    )
      return !1;
    const s = i.recipientMask & (t ?? 255);
    if (!s) return !1;
    const o = (i.sequence + 1) >>> 0;
    i.encoder ??= new S40({
      roomId: i.roomId,
      raceId: i.raceId,
      playerId: this.playerId,
    });
    const a = i.encoder.encode(e, o),
      c = this.peerTransport?.send(a, o, s);
    let l = c?.sent ?? !1;
    if (
      (!c || c.relayMask) &&
      ((a[3] = c?.relayMask ?? s),
      r?.readyState === "open" && r.bufferedAmount <= 8192)
    )
      try {
        (r.send(a), (l = !0));
      } catch {
        return (this.dispose(), !1);
      }
    return (l && (i.sequence = o), l);
  }
  networkDiagnostics() {
    return this.peerTransport?.diagnostics() ?? [];
  }
  subscribeMotion(e) {
    return (
      this.motionListeners.add(e),
      () => {
        this.motionListeners.delete(e);
      }
    );
  }
  clock = new L40();
  captureClock() {
    return this.clock.capture(performance.now());
  }
  pending = new Map();
  listeners = new Set();
  closeListeners = new Set();
  static sameOriginUrl(e) {
    const t = new URL(e);
    if (t.protocol !== "http:" && t.protocol !== "https:")
      throw new Error("HTTP(S) page required");
    return (
      (t.pathname = "/multiplayer/offer"),
      (t.search = ""),
      (t.hash = ""),
      t.href
    );
  }
  async connect(e, t, i, r, s, o = !1, a) {
    if (this.peer) throw new Error("Connection already exists");
    const c = new RTCPeerConnection({ iceServers: [] });
    ((this.peer = c), (this.abort = new AbortController()));
    const l = c.createDataChannel("control", {
      negotiated: !0,
      id: 0,
      ordered: !0,
    });
    ((this.control = l),
      (this.motion = c.createDataChannel("motion", {
        negotiated: !0,
        id: 1,
        ordered: !1,
        maxRetransmits: 0,
      })),
      (this.motion.binaryType = "arraybuffer"),
      (this.motion.onmessage = (f) => {
        this.peer === c && this.acceptMotion(f.data);
      }),
      (this.motion.onclose = () => {
        this.peer === c && this.dispose();
      }),
      (l.onmessage = (f) => {
        if (this.peer !== c) return;
        let p;
        try {
          p = JSON.parse(String(f.data));
        } catch {
          this.dispose();
          return;
        }
        const v = zo0(p);
        if (!v) {
          this.dispose();
          return;
        }
        (v.type === "latency-probe" &&
          this.motionScope?.roomId === v.roomId &&
          this.motionScope.raceId === v.raceId &&
          this.request({
            type: "latency-reply",
            roomId: v.roomId,
            raceId: v.raceId,
            nonce: v.nonce,
          }).catch(() => {}),
          v.type === "latency" &&
            this.motionScope?.roomId === v.roomId &&
            this.motionScope.raceId === v.raceId &&
            this.raceLatencies.set(v.playerId, v.latencyMs));
        const w = v.requestId ? this.pending.get(v.requestId) : void 0;
        if (w && v.requestId) {
          if (
            (clearTimeout(w.timer),
            this.pending.delete(v.requestId),
            w.clockTick !== void 0 && v.type !== "error")
          ) {
            const g = performance.now();
            if (
              v.type !== "clock" ||
              v.clientTick !== w.clockTick ||
              !this.clock.record(w.clockTick, v.serverTick, g)
            ) {
              (w.reject(new Error("Invalid clock reply")), this.dispose());
              return;
            }
            this.echoRtt.reply(v.requestId, g);
          }
          (v.type === "error" &&
            w.clockTick !== void 0 &&
            this.echoRtt.failed(v.requestId),
            v.type === "error" ? w.reject(new Error(v.code)) : w.resolve(v));
        }
        (v.type === "p2p-signal" || v.type === "p2p-relay") &&
          this.peerTransport?.receiveSignal(v);
        for (const g of this.listeners) g(v);
      }),
      (l.onclose = () => {
        this.peer === c && this.dispose();
      }),
      (c.onconnectionstatechange = () => {
        this.peer === c &&
          (c.connectionState === "disconnected"
            ? (this.disconnectTimer ??= setTimeout(() => {
                this.peer === c &&
                  c.connectionState === "disconnected" &&
                  this.dispose();
              }, 3e3))
            : (clearTimeout(this.disconnectTimer),
              (this.disconnectTimer = void 0),
              ["failed", "closed"].includes(c.connectionState) &&
                this.dispose()));
      }));
    let u;
    const h = new Promise((f, p) => {
        ((this.cancelConnect = p),
          (u = setTimeout(() => {
            (p(new Error("WebRTC connection timeout")), this.dispose());
          }, 2e4)));
      }),
      d = async () => {
        const f = new Promise((w) => {
          l.onopen = () => w();
        });
        if (
          (await c.setLocalDescription(await c.createOffer()),
          c.iceGatheringState !== "complete" &&
            (await Promise.race([
              h,
              new Promise((w) => {
                const g = () => {
                  c.iceGatheringState === "complete" &&
                    (c.removeEventListener("icegatheringstatechange", g), w());
                };
                (c.addEventListener("icegatheringstatechange", g), g());
              }),
            ])),
          this.peer !== c)
        )
          throw new Error("Connection cancelled");
        const p = await fetch(e, {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
            ...(a ? { Authorization: `Bearer ${a}` } : {}),
          },
          body: JSON.stringify({ type: "offer", sdp: c.localDescription?.sdp }),
          signal: this.abort.signal,
        });
        if (!p.ok) throw new Error(`Signaling failed (${p.status})`);
        const v = await p.json();
        if (
          !v ||
          typeof v != "object" ||
          !("type" in v) ||
          v.type !== "answer" ||
          !("sdp" in v) ||
          typeof v.sdp != "string" ||
          v.sdp.length > 32768
        )
          throw new Error("Invalid answer");
        if (this.peer !== c) throw new Error("Connection cancelled");
        (await c.setRemoteDescription({ type: "answer", sdp: v.sdp }), await f);
      };
    try {
      await Promise.race([d(), h]);
      const f = await this.request({
        type: "hello",
        protocolVersion: Uo,
        ruleset: yP,
        resourceVersion: i,
        name: t,
        equipment: r,
        initial: s,
        raceRuntime: o,
      });
      if (f.type !== "welcome") throw new Error("Expected welcome");
      if (
        ((this.playerId = f.playerId), f.capabilities.includes("p2p-motion"))
      ) {
        const v = new URL(e);
        ((v.pathname = "/multiplayer/ice"), (v.search = ""), (v.hash = ""));
        const w = async () => {
            try {
              const y = await fetch(v.href, {
                credentials: "same-origin",
                cache: "no-store",
                headers: a ? { Authorization: `Bearer ${a}` } : {},
                signal: AbortSignal.any([
                  this.abort.signal,
                  AbortSignal.timeout(3e3),
                ]),
              });
              if (!y.ok) return vf(void 0);
              const b = await y.json();
              return vf(
                b && typeof b == "object" && "iceServers" in b
                  ? b.iceServers
                  : void 0,
              );
            } catch {
              return vf(void 0);
            }
          },
          g = await w();
        if (this.peer !== c) throw new Error("Connection cancelled");
        ((this.peerTransport = new pl0({
          playerId: f.playerId,
          iceServers: g,
          send: (y) => this.request(y),
          receive: (y) => this.acceptMotionMessage(y),
        })),
          (this.iceRefresh = setInterval(() => {
            w().then((y) => {
              this.peer === c && this.peerTransport?.updateIceServers(y);
            });
          }, 18e5)));
      }
      const p = async () => {
        if (this.peer !== c) throw new Error("Connection cancelled");
        if (
          (await this.request({ type: "clock", clientTick: performance.now() }),
          this.peer !== c)
        )
          throw new Error("Connection cancelled");
      };
      for (let v = 0; v < 3; v++) await p();
      return (
        (this.heartbeat = setInterval(() => {
          p().catch(() => {
            this.peer === c && this.dispose();
          });
        }, 1e4)),
        f
      );
    } catch (f) {
      throw (this.peer === c && this.dispose(), f);
    } finally {
      (clearTimeout(u), this.peer === c && (this.cancelConnect = void 0));
    }
  }
  request(e) {
    const t = this.control;
    if (!t || t.readyState !== "open")
      return Promise.reject(new Error("Not connected"));
    if (this.pending.size >= 32 || t.bufferedAmount > 65536)
      return Promise.reject(new Error("Connection busy"));
    const i = String(++this.nextId);
    return new Promise((r, s) => {
      const o = setTimeout(() => {
        (e.type === "clock" && this.echoRtt.failed(i),
          this.pending.delete(i),
          s(new Error("Request timeout; synchronize room before retrying")));
      }, 1e4);
      (this.pending.set(i, {
        resolve: r,
        reject: s,
        timer: o,
        clockTick: e.type === "clock" ? e.clientTick : void 0,
      }),
        e.type === "clock" && this.echoRtt.begin(i, e.clientTick));
      try {
        t.send(JSON.stringify({ ...e, requestId: i }));
      } catch (a) {
        (clearTimeout(o),
          this.pending.delete(i),
          e.type === "clock" && this.echoRtt.failed(i),
          s(a));
      }
    });
  }
  subscribe(e) {
    return (
      this.listeners.add(e),
      () => {
        this.listeners.delete(e);
      }
    );
  }
  onClose(e) {
    return (
      this.closeListeners.add(e),
      () => {
        this.closeListeners.delete(e);
      }
    );
  }
  dispose() {
    const e = this.peer;
    ((this.peer = void 0),
      this.abort?.abort(),
      (this.abort = void 0),
      clearInterval(this.heartbeat),
      (this.heartbeat = void 0),
      clearInterval(this.iceRefresh),
      (this.iceRefresh = void 0),
      clearTimeout(this.disconnectTimer),
      (this.disconnectTimer = void 0),
      this.peerTransport?.dispose(),
      (this.peerTransport = void 0),
      (this.decoder = new d6()),
      this.cancelConnect?.(new Error("Connection closed")));
    for (const t of this.pending.values())
      (clearTimeout(t.timer), t.reject(new Error("Connection closed")));
    if (
      (this.pending.clear(),
      this.clock.reset(),
      (this.motionScope = void 0),
      (this.podiumScope = void 0),
      this.raceLatencies.clear(),
      (this.playerId = void 0),
      this.motionListeners.clear(),
      this.echoRtt.clear(),
      this.control?.close(),
      this.motion?.close(),
      (this.control = void 0),
      (this.motion = void 0),
      e?.close(),
      e)
    )
      for (const t of this.closeListeners) t();
    (this.listeners.clear(), this.closeListeners.clear());
  }
}
const ml0 = {};
function ay(n) {
  const e = new URL(n).origin,
    t = typeof window > "u" ? void 0 : window.__KART_MULTIPLAYER_CONFIG__,
    i =
      t?.frontendOrigins !== void 0
        ? t.frontendOrigins
        : t?.frontendOrigin
          ? [t.frontendOrigin]
          : void 0;
  if (
    i !== void 0 &&
    (!Array.isArray(i) ||
      !i.length ||
      i.some((a) => {
        if (typeof a != "string" || a.includes("*")) return !0;
        try {
          const c = new URL(a);
          return !["http:", "https:"].includes(c.protocol) || c.origin !== a;
        } catch {
          return !0;
        }
      }))
  )
    throw new Error(
      "联机前端域名列表必须包含完整的 HTTP(S) 来源，不含路径或末尾斜杠。",
    );
  if (i && !i.includes(e))
    throw new Error("当前网页域名与联机前端配置不匹配。");
  const r =
    t?.backendOrigin?.trim() || ml0?.VITE_MULTIPLAYER_BACKEND_ORIGIN?.trim();
  if (!r)
    throw new Error(
      "生产版尚未配置联机后端地址，或网站门禁拦截了 /multiplayer-config.js。请通过门禁后刷新网页。",
    );
  const s = r || n,
    o = new URL(s);
  if (
    !["http:", "https:"].includes(o.protocol) ||
    o.username ||
    o.password ||
    o.pathname !== "/" ||
    o.search ||
    o.hash
  )
    throw new Error("联机后端地址必须是完整的 HTTP(S) 域名，不含路径。");
  if (new URL(n).protocol === "https:" && o.protocol !== "https:")
    throw new Error("HTTPS 网页必须连接 HTTPS 联机后端。");
  return o.origin;
}
function Ko(n, e) {
  if (!/^[a-z][a-z0-9/-]*$/i.test(n) || n.includes("..") || n.startsWith("/"))
    throw new Error("Invalid multiplayer endpoint");
  return `${ay(e)}/multiplayer/${n}`;
}
const cy = (n) => `kartsim.multiplayer.session:${n}`,
  S6 = new Map();
function xF(n) {
  try {
    const e = sessionStorage.getItem(cy(n));
    return e && /^[A-Za-z0-9_-]{43}$/.test(e) ? e : S6.get(n);
  } catch {
    return S6.get(n);
  }
}
function wl0(n, e) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(e)) throw new Error("INVALID_SESSION_TOKEN");
  S6.set(n, e);
  try {
    sessionStorage.setItem(cy(n), e);
  } catch {}
}
function SF(n) {
  S6.delete(n);
  try {
    sessionStorage.removeItem(cy(n));
  } catch {}
}
const jo = () => ay(window.location.href),
  ly = (n) => Ko(`auth/${n}`, window.location.href),
  nm = () => {
    const n = xF(jo());
    return n ? { Authorization: `Bearer ${n}` } : {};
  },
  G7 = (...n) => {
    for (const e of n)
      e.style.cssText =
        "padding:9px 14px;background:#e7edf5;color:#152333;border:1px solid #90a5bc;cursor:pointer;font:inherit";
  },
  B7 =
    "position:fixed;inset:0;z-index:10000;display:grid;place-items:center;overflow-y:auto;padding:max(12px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) max(12px,env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left));background:#09182bd9;color:#fff;font:16px sans-serif",
  R7 =
    "box-sizing:border-box;width:min(420px,100%);max-height:100%;overflow-y:auto;overscroll-behavior:contain;padding:clamp(14px,4vw,28px);background:#23364c;border:2px solid #5599d5;box-shadow:0 12px 40px #0008;display:grid;gap:12px",
  uy = {
    INVALID_ACCOUNT_FIELDS:
      "账号名须为 3–24 位字母、数字或下划线；昵称 2–16 字；密码至少 12 位。",
    INVALID_INVITE: "邀请码无效或已被使用。",
    USERNAME_TAKEN: "账号名已被使用。",
    NICKNAME_TAKEN: "昵称已被使用。",
    INVALID_CREDENTIALS: "账号或密码错误。",
    TOO_MANY_ATTEMPTS: "尝试过于频繁，请稍后再试。",
    ACCOUNTS_UNAVAILABLE: "账号服务尚未启用。",
    NOT_FOUND: "联机后端尚未更新到账号版本。",
  },
  C6 = (n) => (n instanceof Error ? (uy[n.message] ?? n.message) : String(n));
function vl0(n, e) {
  const t = n.ownerDocument?.body;
  if (!t) return { close: () => {}, fail: async () => {} };
  const i = n.ownerDocument.createElement("div"),
    r = n.ownerDocument.createElement("div");
  ((i.style.cssText = B7),
    (r.style.cssText = R7),
    r.setAttribute("role", "status"));
  const s = n.ownerDocument.createElement("h2");
  ((s.textContent = "多人游戏"), (s.style.margin = "0"));
  const o = n.ownerDocument.createElement("div");
  o.textContent = "正在检查联机服务…";
  const a = n.ownerDocument.createElement("button");
  ((a.type = "button"),
    (a.textContent = "返回"),
    (a.hidden = !0),
    G7(a),
    r.append(s, o, a),
    i.append(r),
    t.append(i));
  let c = !1,
    l;
  const u = new Promise((d) => {
      l = d;
    }),
    h = () => {
      c || ((c = !0), e?.removeEventListener("abort", h), i.remove(), l?.());
    };
  return (
    (a.onclick = h),
    e?.addEventListener("abort", h, { once: !0 }),
    {
      close: h,
      fail: async (d) => {
        c || ((o.textContent = d), (a.hidden = !1), await u);
      },
    }
  );
}
async function Xo(n, e) {
  const t = await fetch(
      ly(n),
      e
        ? {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json", ...nm() },
            body: JSON.stringify(e),
          }
        : { credentials: "same-origin", headers: nm() },
    ),
    i = await t.json();
  if (!t.ok || !i.account) {
    const r = i.error ?? "账号服务暂不可用";
    throw (
      r === "LOGIN_REQUIRED" && SF(jo()),
      new Error(r === "LOGIN_REQUIRED" ? r : (uy[r] ?? r))
    );
  }
  if (n === "login") {
    if (!i.token) throw new Error("联机后端尚未更新到跨域账号版本。");
    wl0(jo(), i.token);
  }
  return i.account;
}
class CF {
  element = document.createElement("div");
  resolve;
  disposed = !1;
  constructor(e, t) {
    this.element.style.cssText = B7;
    const i = document.createElement("form");
    i.style.cssText = R7;
    const r = document.createElement("h2");
    ((r.textContent = "多人游戏账号"), (r.style.margin = "0 0 8px"));
    const s = document.createElement("input"),
      o = document.createElement("input"),
      a = document.createElement("input"),
      c = document.createElement("input");
    ((s.placeholder = "账号名（3–24 位字母、数字或下划线）"),
      (s.autocomplete = "username"),
      (o.placeholder = "游戏昵称（注册时填写）"),
      (o.hidden = !0),
      (a.placeholder = "密码（至少 12 位）"),
      (a.type = "password"),
      (a.autocomplete = "current-password"),
      (c.placeholder = "邀请码"),
      (c.hidden = !0));
    for (const p of [s, o, a, c])
      ((p.style.cssText =
        "box-sizing:border-box;width:100%;padding:9px;background:#fff;color:#152333;border:0;font:inherit"),
        (p.maxLength = 128));
    const l = document.createElement("div");
    l.style.cssText = "min-height:20px;color:#ffb3a9";
    const u = document.createElement("button");
    ((u.type = "submit"), (u.textContent = "登录"));
    const h = document.createElement("button");
    ((h.type = "button"), (h.textContent = "用邀请码注册"));
    const d = document.createElement("button");
    ((d.type = "button"), (d.textContent = "返回"), G7(u, h, d));
    let f = !1;
    ((h.onclick = () => {
      ((f = !f),
        (o.hidden = c.hidden = !f),
        (u.textContent = f ? "注册并登录" : "登录"),
        (h.textContent = f ? "已有账号，去登录" : "用邀请码注册"),
        (l.textContent = ""));
    }),
      (d.onclick = () => this.finish(void 0)),
      (i.onsubmit = async (p) => {
        (p.preventDefault(), (u.disabled = !0), (l.textContent = ""));
        try {
          f &&
            (await Xo("register", {
              username: s.value,
              nickname: o.value,
              password: a.value,
              invite: c.value,
            }),
            (f = !1),
            (o.hidden = c.hidden = !0),
            (u.textContent = "登录"),
            (h.textContent = "用邀请码注册"));
          const v = await Xo("login", { username: s.value, password: a.value });
          this.finish(v);
        } catch (v) {
          l.textContent = C6(v);
        } finally {
          u.disabled = !1;
        }
      }),
      i.append(r, s, o, a, c, l, u, h, d),
      this.element.append(i),
      e.ownerDocument.body.append(this.element),
      s.focus(),
      t?.addEventListener("abort", () => this.finish(void 0), { once: !0 }));
  }
  wait() {
    return new Promise((e) => {
      this.resolve = e;
    });
  }
  finish(e) {
    (this.resolve?.(e), (this.resolve = void 0), this.dispose());
  }
  dispose() {
    this.disposed ||
      ((this.disposed = !0),
      this.element.remove(),
      this.resolve?.(void 0),
      (this.resolve = void 0));
  }
}
async function yl0(n, e) {
  const t = jo(),
    i = await fetch(Ko("auth/config", window.location.href), {
      credentials: "same-origin",
    });
  if (!i.ok) throw new Error("联机后端尚未更新到账号版本。");
  const { loginRequired: r, backendOrigin: s } = await i.json();
  if (s !== t && (t !== window.location.origin || s !== null))
    throw new Error("联机前后端地址配置不匹配，请联系站点管理员。");
  if (!r)
    try {
      return await Xo("me");
    } catch (o) {
      if (o instanceof Error && o.message === "LOGIN_REQUIRED") return;
      throw o;
    }
  try {
    const o = await Xo("me");
    if (e?.aborted) throw new Error("ACCOUNT_CANCELLED");
    return await Al0(n, o, e);
  } catch (o) {
    if (e?.aborted) throw new Error("ACCOUNT_CANCELLED");
    if (o instanceof Error && o.message !== "LOGIN_REQUIRED") throw o;
    const c = await new CF(n, e).wait();
    if (!c) throw new Error("ACCOUNT_CANCELLED");
    return c;
  }
}
async function PT(n, e, t, i = !1) {
  const r = async (s) => {
    if (
      !s ||
      [...s].length > 18 ||
      s !== s.trim() ||
      /[\x00-\x1f\x7f<>]/.test(s)
    )
      throw new Error("昵称须为 1–18 字，且不能包含控制字符或尖括号。");
    const o = await fetch(ly("guest-name"), {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: s }),
        signal: t,
      }),
      a = await o.json();
    if (!o.ok)
      throw new Error(uy[a.error ?? ""] ?? a.error ?? "昵称检查失败。");
    return a.available === !0;
  };
  if (t?.aborted) throw new Error("ACCOUNT_CANCELLED");
  if (e && !i)
    try {
      if (await r(e)) return e;
    } catch (s) {
      if (t?.aborted) throw new Error("ACCOUNT_CANCELLED");
      if (s instanceof Error && !s.message.startsWith("昵称须为")) throw s;
    }
  return new Promise((s, o) => {
    const a = document.createElement("div"),
      c = document.createElement("form");
    ((a.style.cssText = B7), (c.style.cssText = R7));
    const l = document.createElement("h2");
    ((l.textContent = "游客昵称"), (l.style.margin = "0"));
    const u = document.createElement("div");
    u.textContent = e
      ? "这个昵称已被使用，请换一个昵称。"
      : "请输入进入多人游戏时使用的昵称。";
    const h = document.createElement("input");
    ((h.value = e),
      (h.maxLength = 36),
      (h.placeholder = "1–18 字昵称"),
      (h.style.cssText =
        "box-sizing:border-box;width:100%;padding:9px;font:inherit;background:#fff;color:#152333"));
    const d = document.createElement("div");
    d.style.cssText = "min-height:20px;color:#ffb3a9";
    const f = document.createElement("button");
    ((f.type = "submit"), (f.textContent = "进入多人游戏"));
    const p = document.createElement("button");
    ((p.type = "button"), (p.textContent = "返回"), G7(f, p));
    const v = () => {
        (t?.removeEventListener("abort", w), a.remove());
      },
      w = () => {
        (v(), o(new Error("ACCOUNT_CANCELLED")));
      };
    (t?.addEventListener("abort", w, { once: !0 }),
      (p.onclick = w),
      (c.onsubmit = async (g) => {
        (g.preventDefault(), (f.disabled = !0), (d.textContent = ""));
        try {
          const y = h.value;
          if (!(await r(y))) {
            d.textContent = "昵称已被注册或当前有人使用，请换一个。";
            return;
          }
          (v(), s(y));
        } catch (y) {
          if (t?.aborted) {
            w();
            return;
          }
          d.textContent = C6(y);
        } finally {
          f.disabled = !1;
        }
      }),
      c.append(l, u, h, d, f, p),
      a.append(c),
      n.ownerDocument.body.append(a),
      h.focus());
  });
}
function Al0(n, e, t) {
  return new Promise((i, r) => {
    const s = document.createElement("div"),
      o = document.createElement("div");
    ((s.style.cssText = B7), (o.style.cssText = R7));
    const a = document.createElement("h2");
    ((a.textContent = `欢迎，${e.nickname}`), (a.style.margin = "0"));
    const c = document.createElement("input");
    ((c.value = e.nickname),
      (c.maxLength = 16),
      (c.style.cssText =
        "padding:9px;font:inherit;background:#fff;color:#152333"));
    const l = document.createElement("div");
    l.style.color = "#ffb3a9";
    const u = document.createElement("button");
    u.textContent = "进入多人大厅";
    const h = document.createElement("button");
    h.textContent = "修改昵称";
    const d = document.createElement("button");
    d.textContent = "退出账号";
    const f = document.createElement("button");
    ((f.textContent = "返回车库/单人游戏"), G7(u, h, d, f));
    const p = document.createElement("a");
    ((p.href = Ko("admin", window.location.href)),
      (p.target = "_blank"),
      (p.rel = "noopener"),
      (p.textContent = "打开邀请码管理后台"),
      (p.style.color = "#a7d6ff"));
    const v = () => {
        (s.remove(), t?.removeEventListener("abort", w));
      },
      w = () => {
        (v(), r(new Error("ACCOUNT_CANCELLED")));
      };
    (t?.addEventListener("abort", w, { once: !0 }),
      (u.onclick = () => {
        (v(), i(e));
      }),
      (f.onclick = w),
      (h.onclick = async () => {
        h.disabled = !0;
        try {
          ((e = await Xo("nickname", { nickname: c.value })),
            (a.textContent = `欢迎，${e.nickname}`),
            (l.textContent = "昵称已更新"));
        } catch (g) {
          l.textContent = C6(g);
        } finally {
          h.disabled = !1;
        }
      }),
      (d.onclick = async () => {
        d.disabled = !0;
        try {
          (await fetch(ly("logout"), {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json", ...nm() },
            body: "{}",
          }),
            SF(jo()),
            v());
          const y = await new CF(n, t).wait();
          y ? i(y) : r(new Error("ACCOUNT_CANCELLED"));
        } catch (g) {
          ((l.textContent = C6(g)), (d.disabled = !1));
        }
      }),
      o.append(a, c, l, u, h, d, f),
      e.admin && o.append(p),
      s.append(o),
      n.ownerDocument.body.append(s));
  });
}
const hy = "kartsim.local-nickname";
function im() {
  try {
    const n = JSON.parse(localStorage.getItem(hy) ?? "");
    return typeof n == "string" ? n : "";
  } catch {
    return "";
  }
}
function EF(n) {
  try {
    localStorage.setItem(hy, JSON.stringify(n));
  } catch {}
}
function bl0() {
  try {
    localStorage.removeItem(hy);
  } catch {}
}
function Ml0(n, e, t = 0, i = !1, r = 0) {
  const s = n === 1 ? 4 : n === 2 ? 5 : e ? 3 : 2,
    o =
      s === 2
        ? [0, -2.8, 0.7]
        : s === 3
          ? [-0.7, 2.4, 0.9]
          : [s === 4 ? 1 : -1, -2.4, 0.9],
    a = [0, 0, 0.84];
  let c = s === 3 ? 1 : 1.1;
  t &&
    (i
      ? (s !== 3 && ((o[1] = -2.8), (c *= 0.85)),
        r === 900 && n && (a[0] = n === 1 ? -0.5 : 0.5))
      : ((o[2] += 1), (a[2] += 1), (c *= 0.9)));
  const l = 245 / 308,
    u = kl.radToDeg(2 * Math.atan(Math.tan(kl.degToRad(75 / c) / 2) / l)),
    h = new Z9(u, l, 0.5, 100);
  return (h.position.set(o[0], o[2], -o[1]), h.lookAt(a[0], a[2], -0), h);
}
class xl0 {
  constructor(e, t, i) {
    ((this.library = e), (this.context = t), (this.failed = i));
  }
  library;
  context;
  failed;
  buffers = new Map();
  active = new Set();
  disposed = !1;
  play(e, t) {
    if (this.disposed || !this.context) return;
    this.context.state === "suspended" &&
      this.context.resume().catch((o) => this.failed?.(o));
    const i = /^character_\/([^/]+)\//i.exec(e)?.[1];
    if (!i || !t || t.includes("/") || t.includes("\\")) return;
    const r = `sound_/character/${i}/${t}.ogg`;
    let s = this.buffers.get(r);
    if (!s) {
      const o = this.library.get(r);
      if (!o) return;
      ((s = o.bytes().then((a) => Q9(this.context, a))),
        this.buffers.set(r, s));
    }
    s.then((o) => {
      if (!o || this.disposed || !this.context) return;
      const a = this.context.createBufferSource();
      ((a.buffer = o),
        S9(this.context, a, "fx"),
        this.active.add(a),
        a.addEventListener(
          "ended",
          () => {
            (a.disconnect(), this.active.delete(a));
          },
          { once: !0 },
        ),
        a.start());
    }).catch((o) => {
      this.disposed || this.failed?.(o);
    });
  }
  dispose() {
    this.disposed = !0;
    for (const e of this.active) (e.stop(), e.disconnect());
    (this.active.clear(), this.buffers.clear());
  }
}
async function Sl0(n, e, t, i, r = "") {
  const s = t === null ? e.itemIds[70] : (await fa(n))[t - 1].dyeId,
    [o, a] = await Promise.all([
      e.itemIds[2] ? We(n, e.itemIds[2]) : { primary: 0, high: 0 },
      s ? We(n, s, 70) : null,
    ]),
    c = BI(e, i);
  return {
    equipment: e,
    kartColors: o,
    riderColors: a,
    initial: r,
    build: c ? { cosmetics: c } : {},
  };
}
function Cl0(n, e) {
  const t = n.equipment;
  return (
    t &&
    JSON.stringify([
      e === "team" ? n.team : null,
      t.systemKart,
      t.systemKartVariant,
      n.initial ?? "",
      t.kartSerial,
      t.valueAt3E,
      t.exceedType,
      ...t6.map((i) => t.itemIds[i]),
    ])
  );
}
class El0 {
  constructor(e, t, i, r) {
    ((this.build = e),
      (this.release = t),
      (this.changed = i),
      (this.failed = r));
  }
  build;
  release;
  changed;
  failed;
  entries = new Map();
  disposed = !1;
  get(e) {
    return this.entries.get(e)?.value;
  }
  update(e) {
    if (this.disposed) return;
    const t = new Set(e.members.map((i) => i.playerId));
    for (const [i, r] of this.entries)
      t.has(i) || (this.entries.delete(i), r.value && this.release(r.value));
    for (const i of e.members) {
      const r = Cl0(i, e.mode),
        s = this.entries.get(i.playerId);
      if (
        s?.key === r ||
        (this.entries.delete(i.playerId), s?.value && this.release(s.value), !r)
      )
        continue;
      const o = { key: r };
      (this.entries.set(i.playerId, o),
        this.build(i, e.mode === "team" ? i.team : null).then(
          (a) => {
            this.disposed || this.entries.get(i.playerId) !== o
              ? this.release(a)
              : ((o.value = a), this.changed());
          },
          (a) => {
            !this.disposed &&
              this.entries.get(i.playerId) === o &&
              this.failed(a);
          },
        ));
    }
  }
  dispose() {
    this.disposed = !0;
    for (const e of this.entries.values()) e.value && this.release(e.value);
    this.entries.clear();
  }
}
class Tl0 {
  constructor(e, t, i, r = [], s) {
    ((this.library = e),
      (this.emotions = r),
      (this.emotionAudio = new xl0(e, s, i)),
      (this.environment = rn.load(e)),
      this.environment.catch(() => {}),
      (this.slots = new El0(
        (o, a) => this.build(o, a),
        (o) => Lt(o.preview),
        t,
        i,
      )));
  }
  library;
  emotions;
  binding = new ha();
  slots;
  environment;
  renderer;
  pending = 0;
  disposed = !1;
  released = !1;
  pendingActions = new Map();
  emotionAudio;
  update(e) {
    for (const i of this.pendingActions.keys())
      e.members.some((r) => r.playerId === i) || this.pendingActions.delete(i);
    const t =
      G2(e) === "rp"
        ? {
            ...e,
            members: e.members.map((i) =>
              i.equipment
                ? {
                    ...i,
                    equipment: wI(i.equipment, { kartId: 795, flyingPetId: 0 }),
                  }
                : i,
            ),
          }
        : e;
    this.slots.update(t);
  }
  play(e, t) {
    this.pendingActions.set(e, t);
  }
  async build(e, t) {
    ++this.pending;
    try {
      const i = e.equipment,
        [r, s] = await Promise.all([
          this.library.timeAttackGarageCatalog(),
          this.environment,
        ]);
      let o = r.karts.find(
        (u) =>
          u.itemId === i.itemIds[3] &&
          (u.itemId !== 0 || u.systemKey === i.systemKart),
      );
      o &&
        i.systemKartVariant &&
        (o = b4(
          r.karts,
          0,
          `kart_/${i.systemKartVariant}/model.1s`,
          i.systemKart,
        ));
      const a = r.characters.find((u) => u.itemId === i.itemIds[1]);
      if (!o || !a) throw new Error(`${e.name} 的装备资源未收录。`);
      const c = await Sl0(this.library, i, t, o.engineGrade, e.initial),
        l = await Jv(
          this.library,
          o,
          a,
          s,
          this.binding,
          new Tr(),
          "ready",
          c,
          void 0,
          !0,
        );
      return (
        (l.scene.matrixWorldAutoUpdate = !1),
        {
          preview: l,
          characterPath: a.path,
          camera: Ml0(
            t,
            l.reverse,
            o.linkCharacterId,
            o.alwaysLinkCharacter,
            o.itemId,
          ),
        }
      );
    } finally {
      (--this.pending, this.releaseResources());
    }
  }
  paint(e, t, i, r) {
    if (this.disposed) return;
    const s = this.slots.get(e);
    if (!s) return;
    this.renderer ||
      ((this.renderer = new I4({ alpha: !0, preserveDrawingBuffer: !0 })),
      (this.renderer.outputColorSpace = qe),
      this.renderer.setClearColor(0, 0),
      this.renderer.setSize(245, 308, !1));
    const o = this.renderer,
      { preview: a, camera: c } = s,
      l = this.pendingActions.get(e);
    if (l !== void 0) {
      a.roomMotion?.request(l);
      const u = this.emotions.find((h) => h.index === l)?.soundName;
      (u && this.emotionAudio.play(s.characterPath, u),
        this.pendingActions.delete(e));
    }
    (this.binding.beginFrame(r),
      a.kart.animation.updateCurrentState(r),
      T4(a, r, c, 245, 308),
      a.flyingPet?.update(r, c, 245, 308),
      a.decorations.forEach((u) => u.scene.update(r, c, 245, 308)),
      NP(o, t, i, () => f4(o, a.scene, c)));
  }
  dispose() {
    ((this.disposed = !0),
      this.slots.dispose(),
      this.emotionAudio.dispose(),
      this.renderer?.dispose(),
      (this.renderer = void 0),
      this.releaseResources());
  }
  releaseResources() {
    !this.disposed ||
      this.pending ||
      this.released ||
      ((this.released = !0),
      this.environment.then(
        (e) => {
          (this.binding.dispose(), e.dispose());
        },
        () => this.binding.dispose(),
      ));
  }
}
class dy {
  constructor(e, t) {
    ((this.digits = e),
      (this.soundUrl = t),
      (this.sound = new Audio(t)),
      this.reset());
  }
  digits;
  soundUrl;
  sound;
  static async load(e) {
    const t = e.get("stage_/mqReady/대기실카운트.1s");
    if (!t) throw new Error("房间倒数场景缺失");
    const i = y9(await t.bytes()),
      r = new Map(),
      s = (l) => {
        if (!l || typeof l != "object") return;
        const u = l;
        if (u.kind === "node" && /^[1-9]$/.test(u.name ?? "")) {
          const d = u.children
            ?.find(
              (f) =>
                typeof f == "object" &&
                f !== null &&
                f.name === `${u.name}_Geom`,
            )
            ?.slots?.find(
              (f) => typeof f == "object" && f !== null && f.kind === "texture",
            );
          d?.alphaController && r.set(Number(u.name), d.alphaController);
        }
        u.children?.forEach(s);
      };
    if ((s(i.root), r.size !== 9)) throw new Error("房间倒数数字动画不完整");
    const o = await Promise.all(
        Array.from({ length: 9 }, async (l, u) => {
          const h = u + 1,
            d = e.get(`stage_/mqReady/${h}.png`);
          if (!d) throw new Error(`房间倒数数字 ${h} 贴图缺失`);
          const f = await p2(await d.bytes()),
            p = document.createElement("canvas");
          return (
            (p.width = f.width),
            (p.height = f.height),
            p
              .getContext("2d")
              .putImageData(
                new ImageData(
                  new Uint8ClampedArray(f.pixels),
                  f.width,
                  f.height,
                ),
                0,
                0,
              ),
            { image: p, alpha: on.fromParsed(r.get(h)) }
          );
        }),
      ),
      a = e.get("sound_/fx/interface/waitingroom_countdown.ogg");
    if (!a) throw new Error("房间倒数音效缺失");
    const c = URL.createObjectURL(
      new Blob([await a.bytes()], { type: "audio/ogg" }),
    );
    return new dy(o, c);
  }
  paint(e, t, i) {
    const r = 1 + Math.max(0, Math.min(1e4, Math.trunc(i)));
    e.save();
    for (const { image: s, alpha: o } of this.digits) {
      const a = o.update(r);
      a <= 0 ||
        ((e.globalAlpha = Math.min(1, a)),
        e.drawImage(s, t.x, t.y, t.width, t.height));
    }
    e.restore();
  }
  reset() {
    this.digits.forEach((e) => e.alpha.reset(1));
  }
  playTick() {
    ((this.sound.currentTime = 0), this.sound.play().catch(() => {}));
  }
  dispose() {
    (this.sound.pause(), URL.revokeObjectURL(this.soundUrl));
  }
}
class fy {
  constructor(e, t, i, r, s, o, a) {
    ((this.playerId = t),
      (this.caption = i),
      (this.definition = r),
      (this.width = s),
      (this.height = o),
      (this.messageHeight = a),
      (this.room = e));
  }
  playerId;
  caption;
  definition;
  width;
  height;
  messageHeight;
  until = 0;
  view;
  room;
  layouts = new Map();
  activeLayout = { lines: [], lineHeight: 0 };
  static async load(e, t, i, r) {
    const [s, o] = await Promise.all([
        F9(e, "gui_/windowTemplate", "blinkMessageWindow"),
        U1(e, ["etc_"], "baseStringBag", ".xml").bytes(),
      ]),
      a = s.children.find((g) => T(g, "name") === "message");
    if (!a) throw new Error("换图提示缺少原版 message 标签");
    const [c, l] = T(s, "clientSize").split(/\s+/).map(Number),
      [, , u, h] = T(a, "leftTopWH").split(/\s+/).map(Number),
      d = Number(/\d+/.exec(T(a, "textRender"))[0]),
      f = new Map([
        [!0, "trackChangeWaitForMaster"],
        [!1, "trackChangeWait"],
      ]),
      p = x1(o).root.children,
      v = {
        name: "Container",
        text: "",
        attributes: [{ name: "windowRect", value: "fullscreen" }],
        children: [s],
      },
      w = new fy(i, r, s, v, c, l, h);
    w.view = await te.load({
      library: e,
      root: t,
      definition: v,
      roots: ["gui_/windowTemplate", "stage_/common"],
      label: "赛道变更提示",
      preserveDisplayPixels: !0,
      smoothImages: !0,
      state: (g) =>
        g === a
          ? {
              text: "",
              paint: (y, b) =>
                w.view.paintLabelLines(
                  y,
                  w.activeLayout.lines,
                  b,
                  d,
                  "rgb(42,55,80)",
                  w.activeLayout.lineHeight,
                ),
            }
          : {},
    });
    try {
      for (const [g, y] of f) {
        const A = p
            .find((M) => j0(M, "n") === y)
            ?.children.find((M) => j0(M, "c") === "cn"),
          x = A && j0(A, "v");
        if (!x) throw new Error(`换图提示原版文字缺失：${y}`);
        w.layouts.set(g, w.view.wrapLabel(x, u, d));
      }
      return (
        (w.view.element.dataset.uiLayer = "notice"),
        (w.view.element.style.pointerEvents = "none"),
        w.view.element.setAttribute("role", "status"),
        w.view.element.setAttribute("aria-live", "polite"),
        w
      );
    } catch (g) {
      throw (w.view.dispose(), g);
    }
  }
  show() {
    ((this.activeLayout = this.layouts.get(this.room.hostId === this.playerId)),
      (this.definition.children = [
        h2(this.caption, {
          clientSize: `${this.width} ${this.height + Math.max(0, this.activeLayout.lines.length * this.activeLayout.lineHeight - this.messageHeight)}`,
        }),
      ]),
      this.view.element.setAttribute(
        "aria-label",
        this.activeLayout.lines.join(""),
      ),
      this.view.show());
  }
  update(e, t) {
    const i = this.room;
    if (((this.room = e), !t || e.phase !== "open" || e.roomId !== i.roomId)) {
      this.hide();
      return;
    }
    (i.trackId === e.trackId && i.randomTrackCode === e.randomTrackCode) ||
      ((this.until = performance.now() + 3e3), this.show());
  }
  tick() {
    this.until && performance.now() >= this.until && this.hide();
  }
  hide() {
    ((this.until = 0), this.view.hide());
  }
  dispose() {
    ((this.until = 0), this.view.dispose());
  }
}
const _l0 = "#cef143",
  Gl0 = "#d9dce3",
  Bl0 = "#246bb3",
  Rl0 = "#c73b23",
  Il0 = 5e3;
function kl0(n) {
  const e = [""];
  for (const t of n) {
    const i = e.length - 1;
    Array.from(e[i] + t).reduce(
      (s, o) => s + (/^[\x00-\x7f]$/.test(o) ? 7 : 14),
      0,
    ) > 119 && e[i]
      ? e.push(t)
      : (e[i] += t);
  }
  return e.length <= 3 ? e : [...e.slice(0, 2), `${e[2].slice(0, -1)}…`];
}
function FT(n, e) {
  const t = n.members.find((r) => r.playerId === e)?.slot;
  if (t === void 0) return [];
  const i = Array.from({ length: 8 }, (r, s) => ({
    slot: s,
    member: n.members.find((o) => o.slot === s),
    open:
      (n.mode === "individual" ? s < n.capacity : s % 4 < n.capacity / 2) &&
      !n.closedSlots?.includes(s),
  }));
  return n.mode === "team" ? i : [i[t], ...i.filter((r) => r.slot !== t)];
}
function TF(n) {
  if (G2(n) === "roadblock")
    return n.phase === "open" ? n.hostId : n.race?.roadblock?.runnerId;
}
function DT(n, e) {
  const t = TF(n);
  if (!t) return n;
  if (e.length !== 2) throw new Error("挡人房间缺少红蓝装饰资源。");
  return {
    ...n,
    members: n.members.map((i) =>
      i.equipment
        ? {
            ...i,
            equipment: {
              ...i.equipment,
              itemIds: {
                ...i.equipment.itemIds,
                70: e[i.playerId === t ? 0 : 1].dyeId,
              },
            },
          }
        : i,
    ),
  };
}
async function Ll0(n, e = !1) {
  const [t, i, r, s, o] = await Promise.all([
    F9(n, "stage_/mqReady", "stage_window@zz"),
    F9(n, "stage_/mqReady", "riderCard@zz"),
    fa(n),
    F9(n, "gui_/windowTemplate", "trackDifficulty"),
    F9(n, "stage_/mqReady", "talkBalloon@zz"),
  ]);
  return Pl0(t, i, r, s, o, e);
}
function Pl0(n, e, t = [], i, r, s = !1) {
  if (s) {
    for (const u of ["runnerTag", "blockerTag", "runnerHandicap"])
      if (!e.children.some((h) => T(h, "name") === u))
        throw new Error(`挡人房间缺少 ${u} 原件。`);
    const l = (u) => T(u, "name") === "roadBlockTime" || u.children.some(l);
    if (!l(n)) throw new Error("挡人房间缺少限制时间原件。");
  }
  const o = new Set([
      "riderNameLabel",
      "bossTag_me",
      "bossTag_other",
      "ready",
      "changing",
      "closed",
      "kick",
      "info",
      "myRiderTag",
    ]),
    a = e.children.filter(
      (l) =>
        o.has(T(l, "name") ?? "") || T(l, "texture") === "img_slotEmblemBG",
    );
  function c(l) {
    const u = T(l, "name") ?? "";
    if (l.name === "Skip") return;
    const h =
      [
        "readyButtonCont",
        "teamReadyButtonCont",
        "ready",
        "cancel",
        "start",
        "start_count",
        "cancel_count",
        "autoCount",
        "changeRoomInfo",
        "changeRoomInfoNotPassword",
        "changeRoomInfoPassword",
      ].includes(u) ||
      (s && u === "roadBlockTime");
    if (
      !(T(l, "visible") === "false" && !h) &&
      !["요일모드", "recording"].includes(u)
    ) {
      if (u === "gameType") return h2(l, { leftTopWH: "454 0 150 50" });
      if (u === "roadBlockTime") return h2(l, { visible: "true" });
      if (u === "trackTheme")
        return {
          ...l,
          attributes: l.attributes.filter((d) => d.name !== "texture"),
        };
      if (l.name === "TrackCard" && i) {
        const d = h2(
          i,
          {
            name: "roomTrackDifficulty",
            visible: "true",
            align: T(l, "difficultyAlign"),
            adjust: T(l, "difficultyAdjust"),
          },
          i.children.map((f) =>
            h2(f, {
              name: `roomTrackDifficulty/${T(f, "name")}`,
              resourceRoot: "gui_/windowTemplate",
            }),
          ),
        );
        return { ...l, children: [...l.children, d] };
      }
      if (/^rider[0-7]$/.test(u)) {
        const d = `${u}/`,
          f = a.map((_, C) => {
            const S = T(_, "name");
            if (S === "closed") {
              const G = {
                ..._,
                name: "Panel",
                attributes: _.attributes.filter(
                  (I) => I.name !== "autoLoadImage",
                ),
              };
              return h2(G, { name: d + S, texture: "btn_slotClose_1" });
            }
            return h2(_, { name: d + (S ?? `emblemBackground${C}`) });
          }),
          p = (_, C = !1) =>
            h2(
              e,
              {
                name: d + _ + (C ? "Hover" : ""),
                texture: _.replace(/_1$/, C ? "_1" : "_2"),
              },
              [],
            ),
          v = t.flatMap((_, C) =>
            [!1, !0].map((S) =>
              h2(p(_.cardTexture, S), {
                name: d + `teamBackground${C + 1}${S ? "Hover" : ""}`,
              }),
            ),
          ),
          w = s
            ? ["red", "blue"].flatMap((_) =>
                [!1, !0].map((C) =>
                  h2(p(`ridercard_${_}_roadBlock_1`, C), {
                    name: d + `roadBlockBackground/${_}${C ? "Hover" : ""}`,
                  }),
                ),
              )
            : [],
          g = s
            ? ["red", "blue"].map((_) =>
                h2(p(`ridercard_${_}_roadBlock_Cover`), {
                  name: d + `roadBlockCover/${_}`,
                }),
              )
            : [],
          y = s
            ? ["runnerTag", "blockerTag", "runnerHandicap"].map((_) =>
                h2(
                  e.children.find((C) => T(C, "name") === _),
                  {
                    name: d + _,
                    visible: "true",
                    align: _ === "runnerHandicap" ? "hcenter" : "right",
                  },
                ),
              )
            : [],
          b = {
            name: "Panel",
            text: "",
            attributes: [
              { name: "name", value: d + "preview" },
              {
                name: "windowRect",
                value: T(e, "riderRect") ?? "-5 0 245 308",
              },
            ],
            children: [],
          },
          A = t.map((_, C) =>
            h2(p(_.cardTexture.replace(/1$/, "Cover")), {
              name: d + `teamCover${C + 1}`,
            }),
          ),
          x = r
            ? h2(
                r,
                { name: d + "talkBalloon", visible: "true" },
                r.children.map((_) =>
                  h2(_, {
                    name: d + `talkBalloon/${T(_, "name") ?? "nametag"}`,
                  }),
                ),
              )
            : void 0,
          M = f.find((_) => T(_, "name") === d + "closed"),
          E = M
            ? [
                ...f,
                h2(M, { name: d + "closedHover", texture: "btn_slotClose_2" }),
              ]
            : f;
        return {
          ...l,
          children: [
            p("btn_singleEmptySlot1_1"),
            p("btn_singleEmptySlot1_1", !0),
            p("btn_singleSlot1_1"),
            p("btn_singleSlot1_1", !0),
            ...v,
            ...w,
            b,
            h2(p("btn_singleSlotCover"), { name: d + "singleCover" }),
            ...A,
            ...g,
            ...E,
            ...y,
            ...(x ? [x] : []),
          ],
        };
      }
      return { ...l, children: l.children.map(c).filter((d) => !!d) };
    }
  }
  return c(n);
}
function Fl0(n, e) {
  const t = (s, o, a, c, l = []) => ({
      name: s,
      text: "",
      attributes: Object.entries({
        name: o,
        leftTopWH: a,
        ...(c === void 0 ? {} : { text: c, textRender: "bold16" }),
      }).map(([u, h]) => ({ name: u, value: h })),
      children: l,
    }),
    i = e.map((s, o) =>
      t(
        "TextButton",
        `roomEmotion/${o}`,
        `${8 + (o % 2) * 122} ${8 + Math.floor(o / 2) * 40} 116 34`,
        `${o + 1} ${s.label}`,
      ),
    ),
    r = h2(t("Panel", "roomEmotionWheel", "214 566 252 176", void 0, i), {
      color: "232 23 44 77",
    });
  return {
    ...n,
    children: [
      ...n.children,
      r,
      t("TextButton", "roomEmotionToggle", "368 744 98 34", "表情"),
    ],
  };
}
class py {
  constructor(e, t, i, r) {
    ((this.playerId = t),
      (this.actions = i),
      (this.library = r),
      (this.room = e),
      (this.lastChatSequence = e.chat?.at(-1)?.sequence ?? 0));
  }
  playerId;
  actions;
  library;
  room;
  busy = !1;
  connected = !0;
  view;
  chatDraft = "";
  chatSending = !1;
  lastChatSequence;
  bubbles = new Map();
  trackTitle = "尚未选择赛道";
  trackImage;
  trackReverseStamp;
  trackIcon;
  trackDifficulty;
  trackIdentity;
  trackLoad = 0;
  disposed = !1;
  visible = !1;
  previews;
  roleTeams = [];
  animation;
  startPresentation = !1;
  emotions = [];
  emotionWheelOpen = !1;
  countdown;
  autoStartAt;
  autoStartLocalAt;
  lastCountdownNumber = 10;
  lastManualStartAllowed = !0;
  lastCountdownLocked = !1;
  trackChangeNotice;
  onEmotionKey = (e) => {
    if (
      !this.view?.element.contains(e.target) ||
      !this.connected ||
      this.busy ||
      this.room.phase !== "open" ||
      e.altKey ||
      e.metaKey ||
      e.repeat
    )
      return;
    const i =
      e.target?.matches?.(
        "input, textarea, [contenteditable], [contenteditable] *",
      ) ?? !1;
    if (!e.ctrlKey && !i && e.code === "Backquote") {
      (e.preventDefault(), e.stopPropagation(), this.toggleEmotionWheel());
      return;
    }
    if (!e.ctrlKey && this.emotionWheelOpen && e.code === "Escape") {
      (e.preventDefault(), e.stopPropagation(), this.toggleEmotionWheel());
      return;
    }
    if (!e.ctrlKey && (i || !this.emotionWheelOpen)) return;
    const r = Number(e.code.slice(5));
    if (!e.code.startsWith("Digit") || r < 1 || r > 9) return;
    if ((e.preventDefault(), e.stopPropagation(), r === 9)) {
      this.toggleEmotionWheel();
      return;
    }
    const s = this.emotions[r - 1];
    s && this.sendEmotion(s);
  };
  onRoomKey = (e) => {
    e.key !== "Enter" ||
      e.isComposing ||
      this.disposed ||
      this.view?.element.hidden ||
      (!this.view?.element.contains(e.target) && e.target !== document.body) ||
      !this.connected ||
      this.busy ||
      this.room.phase !== "open" ||
      this.view.comboOpen ||
      e.target?.matches?.(
        "input, textarea, [contenteditable], [contenteditable] *",
      ) ||
      (e.preventDefault(), e.stopPropagation(), this.view.focus("채팅"));
  };
  static async load(e, t, i, r, s, o) {
    const a = new py(i, r, s, e);
    (G2(i) === "roadblock" && (a.roleTeams = await fa(e)),
      (a.emotions = await cP(e)),
      (a.countdown = await dy.load(e)));
    try {
      a.view = await te.load({
        library: e,
        root: t,
        preserveDisplayPixels: !0,
        smoothImages: !0,
        definition: Fl0(await Ll0(e, G2(i) === "roadblock"), a.emotions),
        roots: [
          "stage_/mqReady",
          "stage_/common",
          "stage_/gameReady",
          "gui_/windowTemplate",
        ],
        label: "多人游戏房间",
        state: (c) => a.state(c),
        onActivate: s.onActivate,
        onHover: s.onHover,
      });
    } catch (c) {
      throw (a.countdown.dispose(), c);
    }
    try {
      a.trackChangeNotice = await fy.load(e, t, i, r);
    } catch (c) {
      throw (a.view.dispose(), a.countdown.dispose(), c);
    }
    return (
      (a.previews = new Tl0(
        e,
        () => a.view.render(),
        (c) => s.onError?.(c),
        a.emotions,
        o,
      )),
      a.view.element.addEventListener("keydown", a.onEmotionKey, !0),
      a.installRoomKeyboard(),
      a.updateCountdown(i),
      a
    );
  }
  show() {
    this.disposed ||
      ((this.visible = !0),
      this.previews?.update(DT(this.room, this.roleTeams)),
      this.animate(),
      this.view.show(),
      this.view.focus("goBackButton"),
      this.loadTrack());
  }
  setStartPresentation(e) {
    ((this.startPresentation = e),
      this.roomCanAnimate()
        ? this.animate()
        : (this.animation !== void 0 && cancelAnimationFrame(this.animation),
          (this.animation = void 0)));
  }
  roomCanAnimate() {
    return (
      this.room.phase === "open" ||
      (this.startPresentation &&
        (this.room.phase === "loading" || this.room.phase === "countdown"))
    );
  }
  hide() {
    ((this.visible = !1),
      this.animation !== void 0 && cancelAnimationFrame(this.animation),
      (this.animation = void 0),
      this.closeEmotionWheel(),
      this.trackChangeNotice?.hide(),
      this.view.hide());
  }
  activateReadyShortcut() {
    if (
      this.disposed ||
      !this.connected ||
      this.busy ||
      this.room.phase !== "open"
    )
      return;
    const e = this.room.members.find((s) => s.playerId === this.playerId);
    if (!e) return;
    const i = {
        name: "ImageButton",
        text: "",
        attributes: [
          {
            name: "name",
            value:
              this.room.hostId === this.playerId
                ? this.countdownState().active
                  ? "start_count"
                  : "start"
                : e.ready
                  ? this.countdownState().active
                    ? "cancel_count"
                    : "cancel"
                  : "ready",
          },
        ],
        children: [],
      },
      r = this.state(i);
    r.visible !== !1 &&
      !r.disabled &&
      r.action &&
      (r.onActivate?.(), r.action());
  }
  update(e, t, i) {
    if (!this.disposed) {
      ((this.room = e),
        (this.busy = t),
        (this.connected = i),
        this.trackChangeNotice?.update(e, i && this.visible),
        (this.lastManualStartAllowed = this.actions.canStart?.() !== !1),
        this.updateCountdown(e),
        (this.lastCountdownLocked = this.countdownLocked),
        (t || !i || e.phase !== "open") && this.closeEmotionWheel());
      for (const r of e.chat ?? [])
        if (r.sequence > this.lastChatSequence) {
          const s = Ng(r.text, this.emotions);
          (s.text
            ? this.bubbles.set(r.playerId, {
                sequence: r.sequence,
                text: s.text,
                until: performance.now() + Il0,
              })
            : this.bubbles.delete(r.playerId),
            this.previews?.play(r.playerId, s.action),
            (this.lastChatSequence = r.sequence));
        }
      for (const [r, s] of this.bubbles)
        (!e.members.some((o) => o.playerId === r) ||
          s.until <= performance.now()) &&
          this.bubbles.delete(r);
      (i
        ? this.previews?.update(DT(e, this.roleTeams))
        : (this.previews?.dispose(),
          (this.previews = void 0),
          this.animation !== void 0 && cancelAnimationFrame(this.animation),
          (this.animation = void 0)),
        this.roomCanAnimate()
          ? this.animation === void 0 && this.animate()
          : (this.animation !== void 0 && cancelAnimationFrame(this.animation),
            (this.animation = void 0)),
        this.view.render(),
        this.loadTrack());
    }
  }
  dispose() {
    ((this.disposed = !0),
      (this.visible = !1),
      ++this.trackLoad,
      (this.trackImage = void 0),
      (this.trackReverseStamp = void 0),
      this.animation !== void 0 && cancelAnimationFrame(this.animation),
      (this.animation = void 0),
      this.previews?.dispose(),
      this.countdown?.dispose(),
      this.trackChangeNotice?.dispose(),
      this.removeRoomKeyboard(),
      this.view.element.removeEventListener("keydown", this.onEmotionKey, !0),
      this.view.dispose());
  }
  installRoomKeyboard() {
    window.addEventListener("keydown", this.onRoomKey, !0);
  }
  removeRoomKeyboard() {
    window.removeEventListener("keydown", this.onRoomKey, !0);
  }
  toggleEmotionWheel() {
    this.busy ||
      !this.connected ||
      this.room.phase !== "open" ||
      ((this.emotionWheelOpen = !this.emotionWheelOpen), this.view.render());
  }
  closeEmotionWheel() {
    this.emotionWheelOpen && ((this.emotionWheelOpen = !1), this.view.render());
  }
  updateCountdown(e) {
    if (e.autoStartAt === this.autoStartAt) return;
    this.autoStartAt = e.autoStartAt;
    const t = this.actions.captureClock?.();
    ((this.autoStartLocalAt =
      e.autoStartAt === void 0
        ? void 0
        : t
          ? Y3(e.autoStartAt, t)
          : performance.now() + 9001),
      (this.lastCountdownNumber = 10),
      this.countdown?.reset());
  }
  countdownState() {
    const e = this.room.phase === "open" && this.autoStartLocalAt !== void 0,
      t = e
        ? Math.max(0, performance.now() - (this.autoStartLocalAt - 9001))
        : 0;
    return {
      active: e,
      elapsed: t,
      remaining: Math.max(0, Math.ceil((9001 - t) / 1e3)),
      cancelLocked: t >= 6e3,
    };
  }
  get countdownLocked() {
    const e = this.countdownState();
    return e.active && e.cancelLocked;
  }
  async sendEmotion(e) {
    if (!(
      this.busy ||
      !this.connected ||
      this.room.phase !== "open" ||
      this.chatSending ||
      !this.actions.chat
    )) {
      ((this.chatSending = !0), this.view.render());
      try {
        await this.actions.chat(e.marker);
      } finally {
        ((this.chatSending = !1), this.disposed || this.view.render());
      }
    }
  }
  animate() {
    if (
      this.animation !== void 0 ||
      !this.visible ||
      this.disposed ||
      !this.connected ||
      !this.previews ||
      !this.roomCanAnimate()
    )
      return;
    const e = requestAnimationFrame(() => {
      if (
        this.animation !== e ||
        ((this.animation = void 0),
        !this.visible ||
          this.disposed ||
          !this.connected ||
          !this.previews ||
          !this.roomCanAnimate())
      )
        return;
      const { active: t, elapsed: i } = this.countdownState();
      if ((this.trackChangeNotice?.tick(), t)) {
        const r = Math.max(0, 9 - Math.floor(i / 1e3));
        (r < this.lastCountdownNumber &&
          r <= 5 &&
          r > 0 &&
          this.countdown?.playTick(),
          (this.lastCountdownNumber = r));
      }
      try {
        const r = this.actions.canStart?.() !== !1,
          s = this.countdownLocked;
        (s &&
          this.room.hostId === this.playerId &&
          this.actions.onCountdownLocked?.(),
          r !== this.lastManualStartAllowed || s !== this.lastCountdownLocked
            ? ((this.lastManualStartAllowed = r),
              (this.lastCountdownLocked = s),
              this.view.render())
            : this.view.repaint());
      } catch (r) {
        (this.trackChangeNotice?.hide(),
          this.previews?.dispose(),
          (this.previews = void 0),
          this.actions.onError?.(r));
      }
      this.animate();
    });
    this.animation = e;
  }
  async loadTrack() {
    const e = this.room.trackId,
      t =
        this.room.randomTrackCode === void 0
          ? void 0
          : X6(this.room.randomTrackCode),
      i = t ? `random:${t.code}` : e;
    if (i === this.trackIdentity) return;
    this.trackIdentity = i;
    const r = ++this.trackLoad;
    if (
      ((this.trackImage = void 0),
      (this.trackReverseStamp = void 0),
      (this.trackIcon = void 0),
      (this.trackDifficulty = void 0),
      (this.trackTitle = e ? "正在加载赛道…" : "尚未选择赛道"),
      t)
    ) {
      this.trackTitle =
        G2(this.room) === "lte" ? "全部随机（LTE限定3张）" : t.title;
      try {
        const s = G2(this.room) === "lte" ? "lteRandom@zz" : t.cardToken,
          o = await p2(
            await U1(this.library, ["dialog2_/selectTrackEx"], s).bytes(),
          );
        if (this.disposed || r !== this.trackLoad) return;
        const a = document.createElement("canvas");
        ((a.width = o.width),
          (a.height = o.height),
          a
            .getContext("2d")
            .putImageData(
              new ImageData(new Uint8ClampedArray(o.pixels), o.width, o.height),
              0,
              0,
            ),
          (this.trackImage = a),
          this.view.render());
      } catch (s) {
        !this.disposed && r === this.trackLoad && this.actions.onError?.(s);
      }
      return;
    }
    if (!e) {
      this.view.render();
      return;
    }
    try {
      const o = (
        await (G2(this.room) === "roadblock"
          ? Cw(this.library)
          : this.library.timeAttackTrackCatalog())
      ).find((g) => g.id === e);
      if (!o) throw new Error("本地资源中没有房主选择的赛道");
      const a = this.library.get(o.path);
      if (!a) throw new Error("赛道资源缺失");
      const c = (a.canonicalPath ?? a.virtualPath).replaceAll("\\", "/"),
        l = this.library.resolveContainerPath(
          o.path,
          `${c.slice(0, c.lastIndexOf("/") + 1)}xt_trackCard.png`,
        );
      if (l.status !== "found") throw new Error("赛道卡片资源缺失或不唯一");
      const u = await this.library.trackMetadata(e),
        h = u && wa(u);
      if (!h || u?.difficulty === void 0)
        throw new Error("赛道主题或难度资源缺失");
      const [d, f, p] = await Promise.all([
        p2(await l.entry.bytes()),
        p2(
          await U1(this.library, ["dialog2_/selectTrackEx"], `${h}_1`).bytes(),
        ),
        /_rvs$/i.test(e)
          ? p2(
              await U1(this.library, ["stage_/common"], "큰리버스트랙").bytes(),
            )
          : void 0,
      ]);
      if (this.disposed || r !== this.trackLoad) return;
      const v = document.createElement("canvas");
      ((v.width = d.width),
        (v.height = d.height),
        v
          .getContext("2d")
          .putImageData(
            new ImageData(new Uint8ClampedArray(d.pixels), d.width, d.height),
            0,
            0,
          ));
      const w = document.createElement("canvas");
      if (
        ((w.width = f.width),
        (w.height = f.height),
        w
          .getContext("2d")
          .putImageData(
            new ImageData(new Uint8ClampedArray(f.pixels), w.width, w.height),
            0,
            0,
          ),
        (this.trackIcon = w),
        (this.trackDifficulty = u.difficulty),
        p)
      ) {
        const g = document.createElement("canvas");
        ((g.width = p.width),
          (g.height = p.height),
          g
            .getContext("2d")
            .putImageData(
              new ImageData(new Uint8ClampedArray(p.pixels), p.width, p.height),
              0,
              0,
            ),
          (this.trackReverseStamp = g));
      }
      ((this.trackImage = v), (this.trackTitle = o.title), this.view.render());
    } catch (s) {
      !this.disposed &&
        r === this.trackLoad &&
        ((this.trackTitle = "赛道资源不可用"),
        this.view.render(),
        this.actions.onError?.(s));
    }
  }
  async sendChat() {
    const e = this.chatDraft.trim();
    if (!(
      !e ||
      !this.connected ||
      this.busy ||
      this.chatSending ||
      !this.actions.chat
    )) {
      ((this.chatSending = !0), this.view.render());
      try {
        (await this.actions.chat(e)) && (this.chatDraft = "");
      } finally {
        ((this.chatSending = !1), this.disposed || this.view.render());
      }
    }
  }
  state(e) {
    const t = T(e, "name") ?? "";
    if (t === "roomEmotionToggle")
      return {
        label: "表情",
        expanded: this.emotionWheelOpen,
        disabled:
          this.busy ||
          !this.connected ||
          this.room.phase !== "open" ||
          this.chatSending,
        action: () => this.toggleEmotionWheel(),
      };
    if (t === "roomEmotionWheel")
      return { visible: this.emotionWheelOpen, pointerBlock: !0 };
    if (t.startsWith("roomEmotion/")) {
      const c = this.emotions[Number(t.slice(12))];
      return {
        visible: this.emotionWheelOpen && !!c,
        disabled:
          this.busy ||
          !this.connected ||
          this.room.phase !== "open" ||
          this.chatSending,
        action: () => {
          c && (this.sendEmotion(c), this.closeEmotionWheel());
        },
      };
    }
    const i = this.room,
      r = i.members.find((c) => c.playerId === this.playerId),
      s = i.hostId === this.playerId,
      o = this.busy || !this.connected || i.phase !== "open";
    if (/^rider[0-7]$/.test(t)) {
      const c = FT(i, this.playerId)[Number(t.slice(5))];
      return {
        hoverRegion: o ? void 0 : t,
        hoverRegionSound: !o && !!c && !c.open,
      };
    }
    const a = /^rider([0-7])\/(.+)$/.exec(t);
    if (a) {
      const c = FT(i, this.playerId)[Number(a[1])],
        l = c?.member,
        u = a[2],
        h = !o && this.view?.hoveredRegionId === `rider${a[1]}`,
        d = l?.playerId === this.playerId,
        f = l?.playerId === i.hostId,
        p = !!l || (i.mode === "individual" && !c?.open),
        v = TF(i),
        w = l && v ? (l.playerId === v ? "red" : "blue") : void 0,
        g = i.mode === "team" ? l?.team : null;
      if (u === "talkBalloon" || u === "talkBalloon/nametag") {
        const A = l && this.bubbles.get(l.playerId);
        if (!A || A.until <= performance.now()) return { visible: !1 };
        if (u === "talkBalloon/nametag")
          return { visible: !0, text: l.name, textColor: g === 1 ? Rl0 : Bl0 };
        const x = kl0(A.text);
        return {
          visible: !0,
          size: { width: 140, height: 70 + (x.length - 1) * 19 },
          paint: (M, E) => {
            x.forEach((_, C) =>
              m9(
                M,
                _,
                { x: E.x + 10, y: E.y + 36 + C * 19, width: 120, height: 19 },
                {
                  family: "KartSim Multiplayer Windows",
                  size: 14,
                  kind: "label",
                  color: "black",
                  align: "left",
                  verticalAlign: "top",
                },
              ),
            );
          },
        };
      }
      const y = /^roadBlockBackground\/(red|blue)(Hover)?$/.exec(u);
      if (y) return { visible: w === y[1] && !!y[2] === h };
      if (u.startsWith("roadBlockCover/"))
        return { visible: !!w && u.endsWith(w) };
      const b = /^teamBackground([12])(Hover)?$/.exec(u);
      if (b) return { visible: !!g && Number(b[1]) === g && !!b[2] === h };
      if (u.startsWith("teamCover"))
        return { visible: !!g && u.endsWith(String(g)) };
      switch (u) {
        case "btn_singleEmptySlot1_1":
          return {
            visible: !p && !h,
            silentHover: !0,
            ...(s && !l && c?.open && !o
              ? {
                  label: `关闭席位 ${c.slot + 1}`,
                  action: () => this.actions.slot(c.slot, !0),
                }
              : {}),
          };
        case "btn_singleEmptySlot1_1Hover":
          return {
            visible: !p && h,
            silentHover: !0,
            ...(s && !l && c?.open && !o
              ? {
                  label: `关闭席位 ${c.slot + 1}`,
                  action: () => this.actions.slot(c.slot, !0),
                }
              : {}),
          };
        case "btn_singleSlot1_1":
          return { visible: p && !g && !w && !h };
        case "btn_singleSlot1_1Hover":
          return { visible: p && !g && !w && h };
        case "singleCover":
          return { visible: !g && !w };
        case "runnerTag":
          return { visible: w === "red" };
        case "blockerTag":
          return { visible: w === "blue" };
        case "runnerHandicap":
          return {
            visible:
              w === "red" &&
              (i.phase === "open"
                ? tt.noRunnerManualReset
                : i.race?.roadblock?.noRunnerManualReset === !0),
          };
        case "preview":
          return {
            visible: !!l,
            paint: (A, x) => {
              l && this.previews?.paint(l.playerId, A, x, performance.now());
            },
          };
        case "closed":
        case "closedHover":
          return {
            visible: !c?.open && (u === "closedHover" ? h : !h),
            silentHover: !0,
            disabled:
              o ||
              !s ||
              !!l ||
              !(i.mode === "team"
                ? c.slot % 4 < i.capacity / 2
                : c.slot < i.capacity),
            label: `开启席位 ${(c?.slot ?? 0) + 1}`,
            action: c && !l ? () => this.actions.slot(c.slot, !1) : void 0,
          };
        case "riderNameLabel":
          return { visible: !!l, text: l?.name ?? "" };
        case "bossTag_me":
          return { visible: !!l && f && d };
        case "bossTag_other":
          return { visible: !!l && f && !d };
        case "ready":
          return { visible: !!l && l.ready && !f && !l.changing };
        case "changing":
          return { visible: !!l && !!l.changing };
        case "myRiderTag":
          return { visible: !!l && d };
        case "kick":
          return {
            visible: !!l && s && !d,
            disabled: o,
            label: `移出 ${l?.name}`,
            action: l ? () => this.actions.kick(l) : void 0,
          };
        case "info":
          return {
            visible: !c?.open || (!!l && s && !d),
            disabled: o || !l,
            label: l ? `将房主移交给 ${l.name}` : "空席位信息",
            action: l ? () => this.actions.transfer(l) : void 0,
          };
      }
    }
    switch (t) {
      case "roomName":
        return { text: i.name };
      case "gameSpeed":
        return { text: i.speed === 4 ? "无限加速" : "标准速度" };
      case "gameType":
        return {
          text:
            G2(i) === "rp"
              ? lw[i.channelName]
              : G2(i) === "roadblock"
                ? "挡人模式"
                : G2(i) === "ordinary"
                  ? i.mode === "team"
                    ? "组队竞速赛"
                    : "个人竞速赛"
                  : `${i.mode === "team" ? "组队" : "个人"}${G2(i) === "grip" ? "抓地" : "幽灵"}${i.speed === 4 ? "无限加速" : "赛"}`,
        };
      case "changeRoomInfoNotPassword":
        return { visible: i.locked === !1 };
      case "changeRoomInfoPassword":
        return { visible: i.locked === !0 };
      case "sessionStateStr":
        return {
          text: this.connected
            ? this.busy
              ? "正在处理…"
              : i.autoStartAt !== void 0
                ? `自动开始倒数 ${this.countdownState().remaining}`
                : i.kickVote
                  ? `移出投票 ${i.kickVote.yesIds.length}/${Math.floor(i.kickVote.eligibleIds.length / 2) + 1}`
                  : "等待中"
            : "连接已断开",
        };
      case "chat":
        return {
          lines: (i.chat ?? []).flatMap((c) => {
            const l = Ng(c.text, this.emotions).text;
            return l
              ? [
                  {
                    text: `${c.name}: ${l}`,
                    color: c.playerId === this.playerId ? _l0 : Gl0,
                  },
                ]
              : [];
          }),
        };
      case "채팅":
        return {
          label: "房间聊天，按回车激活；再按发送，空内容取消选中",
          disabled: o || this.chatSending,
          input: {
            value: this.chatDraft,
            maxLength: 120,
            blurOnEmptyEnter: !0,
            change: (c) => {
              this.chatDraft = c;
            },
            submit: () => {
              this.sendChat();
            },
          },
        };
      case "트랙카드":
        return {
          paint: (c, l) => {
            (this.trackImage &&
              c.drawImage(this.trackImage, l.x, l.y, l.width, l.height),
              this.trackReverseStamp &&
                c.drawImage(
                  this.trackReverseStamp,
                  l.x,
                  l.y,
                  l.width,
                  l.height,
                ));
          },
        };
      case "trackTheme":
        return {
          visible: !!this.trackIcon,
          paint: (c, l) => {
            this.trackIcon &&
              c.drawImage(this.trackIcon, l.x, l.y, l.width, l.height);
          },
        };
      case "roomTrackDifficulty":
        return { visible: this.trackDifficulty !== void 0 };
      case "roomTrackDifficulty/chars":
        return {
          text: Array.from({ length: 6 }, (c, l) =>
            l < (this.trackDifficulty ?? 0) ? "1" : "0",
          ).join(""),
        };
      case "roadBlockTime":
        return {
          visible:
            G2(i) === "roadblock" &&
            (i.phase === "open" || !!i.race?.roadblock),
          text: `限制时间：${(i.phase === "open" ? tt.limitMs : (i.race?.roadblock?.limitMs ?? 0)) / 6e4} 分钟`,
        };
      case "out_trackName":
        return { visible: G2(i) !== "roadblock", text: this.trackTitle };
      case "goBackButton":
        return {
          disabled: this.busy,
          label: "返回大厅",
          action: this.actions.leave,
        };
      case "readyButtonCont":
        return { visible: i.mode === "individual" };
      case "teamReadyButtonCont":
        return { visible: i.mode === "team" };
      case "ready":
        return {
          visible: !s && !r?.ready,
          disabled: o || !!r?.changing,
          label: "准备",
          onActivate: this.actions.onStartActivate,
          action: () => this.actions.ready(!0),
        };
      case "cancel":
        return {
          visible: !s && !!r?.ready && !this.countdownState().active,
          disabled: o,
          label: "取消准备",
          action: () => this.actions.ready(!1),
        };
      case "cancel_count":
        return {
          visible: !s && !!r?.ready && this.countdownState().active,
          disabled: o || this.countdownState().cancelLocked,
          label: "取消准备",
          action: () => this.actions.ready(!1),
        };
      case "changeRoomInfo":
        return {
          visible: s,
          disabled: o || !s || !this.actions.settings,
          label: "房间设置",
          action: this.actions.settings,
        };
      case "start":
        return {
          visible: s && !this.countdownState().active,
          disabled:
            o || !this.actions.start || this.actions.canStart?.() === !1,
          onActivate: this.actions.onStartActivate,
          label: this.actions.start ? "开始比赛" : "开始比赛（尚未接入）",
          action: this.actions.start,
        };
      case "start_count":
        return {
          visible: s && this.countdownState().active,
          disabled:
            o || !this.actions.start || this.actions.canStart?.() === !1,
          onActivate: this.actions.onStartActivate,
          label: "开始比赛",
          action: this.actions.start,
        };
      case "autoCount":
        return {
          visible: this.countdownState().active,
          paint: (c, l) =>
            this.countdown?.paint(c, l, this.countdownState().elapsed),
        };
      case "teamChange":
        return {
          disabled: o || (!s && !!r?.ready),
          label: "选择队伍",
          action: this.actions.team,
        };
      case "카트":
        return {
          disabled:
            o ||
            (s && this.countdownLocked) ||
            (!s && !!r?.ready) ||
            !this.actions.garage,
          label: "选择赛车",
          action: this.actions.garage,
        };
      case "트랙":
        return G2(i) === "roadblock"
          ? { disabled: !0, label: "全部随机（挡人模式限定24张）" }
          : G2(i) === "lte"
            ? { disabled: !0, label: "全部随机（LTE模式限定3张）" }
            : {
                disabled:
                  o || this.countdownLocked || !s || !this.actions.track,
                label: s ? "选择赛道" : "由房主选择赛道",
                action: this.actions.track,
              };
    }
    return {};
  }
}
class gy {
  constructor(e, t) {
    ((this.root = e),
      (this.background = t),
      (this.element.className = "multiplayer-loading"),
      (this.element.dataset.uiLayer = "system"),
      this.element.setAttribute("aria-label", "比赛加载中"),
      (this.element.hidden = !0),
      (this.progress.className = "multiplayer-loading-progress"),
      this.progress.setAttribute("aria-live", "polite"),
      Object.assign(this.progress.style, {
        width: "1px",
        height: "1px",
        overflow: "hidden",
        clipPath: "inset(50%)",
      }),
      (this.board.className = "multiplayer-loading-board"),
      (this.board.width = t.width),
      (this.board.height = t.height));
    const i = this.board.getContext("2d");
    if (!i) throw new Error("无法创建多人加载画面。");
    ((this.context = i),
      (this.observer = new ResizeObserver(() => this.paint())),
      this.observer.observe(e),
      this.element.append(this.board, this.progress),
      e.append(this.element));
  }
  root;
  background;
  element = document.createElement("section");
  progress = document.createElement("div");
  board = document.createElement("canvas");
  context;
  observer;
  disposed = !1;
  static async load(e, t) {
    const i = await p2(
        await U1(e, ["zeta_/cn/loading"], "백기사_신_로딩페이지_1600").bytes(),
      ),
      r = document.createElement("canvas");
    return (
      (r.className = "multiplayer-loading-board"),
      (r.width = i.width),
      (r.height = i.height),
      r
        .getContext("2d")
        .putImageData(
          new ImageData(new Uint8ClampedArray(i.pixels), i.width, i.height),
          0,
          0,
        ),
      new gy(t, r)
    );
  }
  show(e, t) {
    this.disposed ||
      ((this.progress.textContent = `游戏即将开始，稍等一下哦~。  ${e}/${t}`),
      this.paint(),
      (this.element.hidden = !1));
  }
  paint() {
    if (this.disposed || !this.progress.textContent) return;
    const e = this.context,
      t = this.board.width,
      i = this.board.height;
    (e.clearRect(0, 0, t, i), e.drawImage(this.background, 0, 0));
    const r = this.root.getBoundingClientRect();
    ((e.font = `bold ${(Math.max(12, Math.min(22, window.innerWidth * 0.013)) * i) / Math.max(1, r.height)}px "Microsoft YaHei",sans-serif`),
      (e.textAlign = "right"),
      (e.textBaseline = "bottom"),
      (e.strokeStyle = "#000"),
      (e.lineWidth = (2 * i) / Math.max(1, r.height)),
      (e.lineJoin = "round"),
      (e.fillStyle = "#ffe500"),
      e.strokeText(this.progress.textContent, t * 0.98, i * 0.98),
      e.fillText(this.progress.textContent, t * 0.98, i * 0.98));
  }
  hide() {
    this.element.hidden = !0;
  }
  dispose() {
    ((this.disposed = !0), this.observer.disconnect(), this.element.remove());
  }
}
function _F(n, e, t) {
  const i = (w, g) => {
      const y = T(n, w),
        b = y === void 0 ? g : y.trim().split(/\s+/).map(Number);
      if (b.length !== 3 || b.some((A) => !Number.isFinite(A)))
        throw new Error(`RP ${w} 无效。`);
      return b.map(Math.fround);
    },
    r = i("defaultCameraPos", [0, -2.5, 0.949999988079071]),
    s = i("defaultSpotPos", [0, 0, 0.30000001192092896]);
  if (
    r[0] !== s[0] ||
    !(r[1] < s[1]) ||
    Number(T(n, "zoom")) !== 1 ||
    ["camera", "customCamera", "orthographic", "useRelCamera"].some(
      (w) => T(n, w) !== void 0 && T(n, w) !== "false",
    )
  )
    throw new Error("RP 场景相机超出已核实的 P3553 分支。");
  if (!(e > 0 && t > 0)) throw new Error("RP 场景窗口尺寸无效。");
  const o = Math.fround,
    a = o(r[1] - s[1]),
    c = o(r[2] - s[2]),
    l = o(Math.sqrt(o(o(a * a) + o(c * c)))),
    u = o(a / l),
    h = o(c / l),
    d = [
      1,
      0,
      0,
      -r[0],
      0,
      h,
      o(-u),
      o(-o(o(h * r[1]) + o(o(-u) * r[2]))) + 0,
      0,
      o(-u),
      o(-h) + 0,
      o(o(u * r[1]) + o(h * r[2])),
    ],
    f = o(o(t) / o(e)),
    p = 0.7673262357711792,
    v = o(1e3 / o(999));
  return {
    view: d,
    projection: [
      o(1 / p),
      0,
      0,
      0,
      0,
      o(1 / o(p * f)),
      0,
      0,
      0,
      0,
      v,
      o(-v),
      0,
      0,
      1,
      0,
    ],
  };
}
function Dl0(n, e, t, i) {
  const { view: r, projection: s } = _F(e, t, i);
  ((n.near = 1),
    (n.far = 1e3),
    (n.aspect = t / i),
    (n.fov = (2 * Math.atan((0.7673262357711792 * i) / t) * 180) / Math.PI),
    Aa(n, r, s));
  for (const o of [2, 6, 10, 14]) n.matrixWorldInverse.elements[o] *= -1;
  for (const o of [8, 9, 10, 11]) n.projectionMatrix.elements[o] *= -1;
  (n.matrixWorld.copy(n.matrixWorldInverse).invert(),
    n.projectionMatrixInverse.copy(n.projectionMatrix).invert());
}
class my {
  renderer;
  camera = new Z9();
  scenes = new Map();
  size = new B2();
  kart;
  kartEnvironment;
  kartBinding = new ha();
  kartCamera = new Z9();
  disposed = !1;
  constructor() {
    ((this.camera.matrixAutoUpdate = !1),
      (this.camera.matrixWorldAutoUpdate = !1));
  }
  static async load(e, t, i) {
    const r = new my();
    try {
      const s = [],
        o = (a) => {
          (a.name === "Play1SPanel" && s.push(a), a.children.forEach(o));
        };
      if ((o(t), s.length !== 2)) throw new Error("RP 原开箱/闪光场景不完整。");
      for (const a of s) {
        const c = T(a, "scene");
        if (!["복불복상자(선물펑)", "반짝반짝눈이부셔"].includes(c ?? ""))
          throw new Error("RP 场景身份不匹配。");
        _F(a, 1, 1);
        const l = `dialog/bokbulbok/${c}.1s`,
          u = e.get(l);
        if (!u) throw new Error(`RP 原动画缺失：${l}`);
        const h = await W1(y9(await u.bytes()), e, l, (d) => ya(e, l, d), {
          convertClientCoordinates: !1,
        });
        if ((r.scenes.set(a, h), !h.playControllers || !h.stopControllers))
          throw new Error("RP 场景控制器生命周期缺失。");
        h.stopControllers(1);
      }
      return (
        (r.kartEnvironment = await rn.load(e)),
        (r.kart = await Qv(e, i, r.kartEnvironment, r.kartBinding)),
        (r.renderer = new I4({
          alpha: !0,
          antialias: !1,
          preserveDrawingBuffer: !0,
        })),
        r.renderer.setClearColor(0, 0),
        r.renderer.setPixelRatio(1),
        (r.renderer.outputColorSpace = qe),
        r
      );
    } catch (s) {
      throw (r.dispose(), s);
    }
  }
  paintKart(e, t, i) {
    const r = this.kart,
      s = this.renderer;
    if (this.disposed || !r || !s) throw new Error("RP 车辆预览 owner 缺失。");
    const o = Math.max(1, Math.trunc(t.width)),
      a = Math.max(1, Math.trunc(t.height)),
      c = this.kartCamera;
    (c.position.set(Math.fround(-3.6), 2.25, 5),
      c.lookAt(0, Math.fround(0.3), 0),
      (c.near = 1),
      (c.far = 100),
      (c.aspect = o / a),
      (c.fov = we(75 / Math.fround(1.4), c.aspect)),
      c.updateProjectionMatrix(),
      s.getSize(this.size),
      (this.size.x !== o || this.size.y !== a) && s.setSize(o, a, !1),
      s.clear(!0, !0, !0),
      this.kartBinding.beginFrame(i >>> 0),
      ey(r, i >>> 0, c, o, a),
      f4(s, r.scene, c),
      e.drawImage(s.domElement, t.x, t.y, t.width, t.height));
  }
  play(e, t) {
    if (this.disposed) throw new Error("RP 动画已释放。");
    const i = this.scenes.get(e);
    if (!i) throw new Error("RP 动画节点未装配。");
    i.playControllers(t >>> 0, 0);
  }
  paint(e, t, i, r) {
    const s = this.scenes.get(e),
      o = this.renderer;
    if (this.disposed || !s || !o) throw new Error("RP 动画绘制 owner 缺失。");
    const a = Math.max(1, Math.trunc(i.width)),
      c = Math.max(1, Math.trunc(i.height));
    (Dl0(this.camera, e, a, c),
      o.getSize(this.size),
      (this.size.x !== a || this.size.y !== c) && o.setSize(a, c, !1),
      o.clear(!0, !0, !0),
      s.update(r >>> 0, this.camera, a, c),
      o.render(s.object, this.camera),
      t.drawImage(o.domElement, i.x, i.y, i.width, i.height));
  }
  dispose() {
    this.disposed ||
      ((this.disposed = !0),
      this.scenes.forEach((e) => e.dispose()),
      this.scenes.clear(),
      this.kart && Js(this.kart),
      (this.kart = void 0),
      this.kartBinding.dispose(),
      this.kartEnvironment?.dispose(),
      (this.kartEnvironment = void 0),
      this.renderer?.dispose(),
      this.renderer?.forceContextLoss(),
      (this.renderer = void 0));
  }
}
const VT = {
  opening: "sound_/fx/etc/복불복 상자 사운드.ogg",
  lucky: "sound_/fx/etc/복불복 대박 사운드.ogg",
  unlucky: "sound_/fx/etc/복불복 꽝 사운드.ogg",
};
class wy {
  constructor(e, t) {
    ((this.context = e), (this.buffers = t));
  }
  context;
  buffers;
  voices = new Set();
  disposed = !1;
  static async load(e, t) {
    const i = new Map();
    for (const r of Object.values(VT)) {
      const s = e.get(r);
      if (!s) throw new Error(`RP 原音效缺失：${r}`);
      t && i.set(r, await Q9(t, await s.bytes()));
    }
    return new wy(t, i);
  }
  async prepare() {
    this.context?.state === "suspended" && (await this.context.resume());
  }
  play(e) {
    if (this.disposed || !this.context) return;
    const t = this.buffers.get(VT[e]);
    if (!t) throw new Error("RP 音效未预解码。");
    const i = this.context.createBufferSource();
    ((i.buffer = t),
      S9(this.context, i, "fx"),
      this.voices.add(i),
      (i.onended = () => {
        (i.disconnect(), this.voices.delete(i));
      }));
    try {
      i.start();
    } catch (r) {
      throw ((i.onended = null), i.disconnect(), this.voices.delete(i), r);
    }
  }
  stop() {
    for (const e of this.voices) {
      e.onended = null;
      try {
        e.stop();
      } catch {}
      e.disconnect();
    }
    this.voices.clear();
  }
  dispose() {
    this.disposed || ((this.disposed = !0), this.stop());
  }
}
function Vl0(n, e, t) {
  const i = n.children.find((c) => T(c, "name") === "noticeDlg");
  if (!i || !T(i, "frame")) throw new Error("RP 缺少原版结果窗口。");
  const r = n.children.find((c) => T(c, "name") === "boxOpen"),
    s = i.children.filter((c) => ["꽝", "당첨"].includes(T(c, "name") ?? "")),
    o = i.children.find((c) => T(c, "name") === "main");
  if (
    !r ||
    r.children[0]?.name !== "Play1SPanel" ||
    s.length !== 2 ||
    !o ||
    !s.some(
      (c) => T(c, "name") === "당첨" && c.children[0]?.name === "Play1SPanel",
    )
  )
    throw new Error("RP 缺少原版开箱/欧非结果资源。");
  const a = (c, l, u, h) => ({
    name: "Label",
    text: "",
    attributes: Object.entries({
      name: c,
      leftTopWH: l,
      text: u,
      textAlign: "center",
      textColor: "black",
      textRender: h,
      multiLine: "true",
      autoWrap: "true",
    }).map(([d, f]) => ({ name: d, value: f })),
    children: [],
  });
  return {
    ...n,
    children: [
      r,
      h2(i, { visible: "false" }, [
        ...s,
        o,
        a("rpKart", "20 267 450 36", e, "bold20"),
        a("rpPet", "20 307 450 32", `飞宠：${t}`, "bold16"),
      ]),
    ],
  };
}
class vy {
  constructor(e, t, i) {
    ((this.lucky = e), (this.box = t), (this.sparkle = i));
  }
  lucky;
  box;
  sparkle;
  view;
  scene;
  sound;
  phase = "opening";
  now = 0;
  animation;
  since = 0;
  complete;
  cancel;
  disposed = !1;
  started = !1;
  static async load(e, t, i, r, s) {
    if (
      !ba(
        i.rp,
        i.roster.map((w) => w.playerId),
      ) ||
      !Object.hasOwn(i.rp.draws, r)
    )
      throw new Error("RP 结果窗口缺少本局抽取身份。");
    const o = { ...i.rp.draws[r] },
      [a, c] = await Promise.all([
        F9(e, "dialog/bokbulbok", "bokbulbok"),
        e.timeAttackGarageCatalog(),
      ]),
      l = c.karts.find((w) => w.itemId === o.kartId),
      u = o.flyingPetId
        ? c.equipment.find(
            (w) => w.kind === "flyingPet" && w.itemId === o.flyingPetId,
          )
        : void 0;
    if (!l || (o.flyingPetId && !u))
      throw new Error("RP 抽取物品缺少精确资源身份。");
    const h = Vl0(a, l.title, u?.title ?? "无"),
      d = h.children[1],
      f = h.children[0].children[0],
      p = d.children.find((w) => T(w, "name") === "당첨").children[0],
      v = new vy(o.flyingPetId !== 0, f, p);
    try {
      return (
        (v.scene = await my.load(e, h, l)),
        (v.sound = await wy.load(e, s)),
        await v.sound.prepare(),
        (v.view = await te.load({
          library: e,
          root: t,
          definition: h,
          roots: ["dialog/bokbulbok"],
          label: `本局 RP 赛车：${l.title}，飞宠：${u?.title ?? "无"}`,
          state: (w) => v.state(w),
          modal: !0,
        })),
        (v.view.element.dataset.uiLayer = "notice"),
        v
      );
    } catch (w) {
      throw (v.dispose(), w);
    }
  }
  state(e) {
    const t = T(e, "name");
    return t === "boxOpen"
      ? { visible: this.phase === "opening" }
      : t === "noticeDlg"
        ? { visible: this.phase === "result" }
        : t === "당첨"
          ? { visible: this.lucky }
          : t === "꽝"
            ? { visible: !this.lucky }
            : t === "main"
              ? { paint: (i, r) => this.scene.paintKart(i, r, this.now) }
              : e === this.box || e === this.sparkle
                ? { paint: (i, r) => this.scene.paint(e, i, r, this.now) }
                : {};
  }
  present(e) {
    if (this.disposed || e.aborted)
      return Promise.reject(new Error("本局 RP 结果展示已取消。"));
    if (this.started) throw new Error("本局 RP 结果不能重复展示。");
    return (
      (this.started = !0),
      (this.now = this.since = performance.now() >>> 0),
      new Promise((t, i) => {
        const r = () => this.finish(new Error("本局 RP 结果展示已取消。"));
        ((this.cancel = () => e.removeEventListener("abort", r)),
          (this.complete = (s) => (s ? i(s) : t())),
          e.addEventListener("abort", r, { once: !0 }));
        try {
          (this.scene.play(this.box, this.now),
            this.sound.play("opening"),
            this.view.show(),
            (this.animation = requestAnimationFrame(() =>
              this.update(performance.now()),
            )));
        } catch (s) {
          this.finish(s instanceof Error ? s : new Error(String(s)));
        }
      })
    );
  }
  update(e) {
    if (!(!this.complete || this.disposed))
      try {
        this.now = e >>> 0;
        const t = (this.now - this.since) >>> 0;
        if (this.phase === "opening" && t > 2500)
          ((this.phase = "result"),
            (this.since = this.now),
            this.sound.play(this.lucky ? "lucky" : "unlucky"),
            this.lucky && this.scene.play(this.sparkle, this.now));
        else if (this.phase === "result" && t > 3500) {
          this.finish();
          return;
        }
        (this.view.render(),
          (this.animation = requestAnimationFrame(() =>
            this.update(performance.now()),
          )));
      } catch (t) {
        this.finish(t instanceof Error ? t : new Error(String(t)));
      }
  }
  finish(e) {
    (this.animation !== void 0 && cancelAnimationFrame(this.animation),
      (this.animation = void 0),
      this.cancel?.(),
      (this.cancel = void 0),
      this.sound?.stop(),
      this.view?.hide());
    const t = this.complete;
    ((this.complete = void 0), t?.(e));
  }
  dispose() {
    this.disposed ||
      ((this.disposed = !0),
      this.finish(new Error("本局 RP 结果展示已释放。")),
      this.view?.dispose(),
      this.scene?.dispose(),
      this.sound?.dispose());
  }
}
async function Nl0(n, e, t, i) {
  if (!e.rp) return;
  if (
    (i.throwIfAborted(),
    !ba(
      e.rp,
      e.roster.map((d) => d.playerId),
    ))
  )
    throw new Error("RP 飞宠预读缺少有效抽取结果。");
  const r = e.rp.draws[t];
  if (!r) throw new Error("RP 飞宠预读缺少本机抽取结果。");
  if (!r.flyingPetId) return;
  const s = await Ma(n, r.flyingPetId);
  if ((i.throwIfAborted(), !s)) throw new Error("RP 飞宠预读缺少物品身份。");
  const o = await x4.load(n, s.internalId);
  i.throwIfAborted();
  const a = [
      ...o.folders.map((d) => `flyingPet_/${d}`),
      DI,
      ...o.soundFolders.map((d) => `sound_/flyingPet/${d}`),
    ],
    c = new Map();
  for (const d of a)
    for (const f of n.entriesUnderCanonicalPrefix(d)) {
      const p = f.sourceKind === "loose" ? f.virtualPath : f.sourceName;
      c.has(p) || c.set(p, f);
    }
  const l = [...c.values()];
  let u = 0;
  const h = async () => {
    for (; u < l.length;)
      (i.throwIfAborted(), await l[u++].bytes(), i.throwIfAborted());
  };
  await Promise.all(Array.from({ length: Math.min(3, l.length) }, h));
}
class yy {
  view;
  frame = 0;
  since = 0;
  lastFrame = 0;
  animation;
  cancel;
  complete;
  disposed = !1;
  started = !1;
  constructor() {}
  static async load(e, t, i, r) {
    if (!i.roadblock || !i.roster.some((p) => p.playerId === r))
      throw new Error("挡人任务横幅缺少本局身份。");
    const s = await F9(e, "stage_/mqReady", "stage_window@zz"),
      o = (p, v) =>
        T(p, "name") === v ? p : p.children.map((w) => o(w, v)).find(Boolean),
      a = o(s, "roadBlockFinalScene"),
      c = a && o(a, "roadBlockMisson");
    if (!a || !c) throw new Error("挡人开赛缺少原版任务横幅。");
    const l = T(c, "windowSize");
    if (!l) throw new Error("挡人开赛缺少原版任务横幅尺寸。");
    const u = new yy(),
      h = i.roadblock.runnerId === r ? "runner" : "blocker",
      d = [0, 1].map((p) =>
        h2(c, {
          name: `roadBlockMission${p}`,
          texture: `roadblock_${h}Mission_${p}@cn`,
          visible: "true",
        }),
      ),
      f = {
        name: "Container",
        text: "",
        attributes: [{ name: "windowRect", value: "fullscreen" }],
        children: [h2(a, { windowRect: `0 0 ${l}`, visible: "true" }, d)],
      };
    return (
      (u.view = await te.load({
        library: e,
        root: t,
        definition: f,
        roots: ["stage_/mqReady", "stage_/common"],
        label: h === "runner" ? "红方任务" : "蓝方任务",
        preserveDisplayPixels: !0,
        smoothImages: !0,
        state: (p) =>
          d.includes(p) ? { visible: d.indexOf(p) === u.frame } : {},
      })),
      (u.view.element.dataset.uiLayer = "notice"),
      (u.view.element.style.pointerEvents = "none"),
      u
    );
  }
  present(e) {
    if (this.disposed || e.aborted)
      return Promise.reject(new Error("本局任务横幅已取消。"));
    if (this.started) throw new Error("本局任务横幅不能重复开始。");
    return (
      (this.started = !0),
      (this.frame = 0),
      (this.since = this.lastFrame = performance.now()),
      new Promise((t, i) => {
        const r = () => this.finish(new Error("本局任务横幅已取消。"));
        ((this.cancel = () => e.removeEventListener("abort", r)),
          (this.complete = (s) => (s ? i(s) : t())),
          e.addEventListener("abort", r, { once: !0 }));
        try {
          (this.view.show(),
            (this.animation = requestAnimationFrame((s) => this.update(s))));
        } catch (s) {
          this.finish(s instanceof Error ? s : new Error(String(s)));
        }
      })
    );
  }
  update(e) {
    if (!(!this.complete || this.disposed))
      try {
        if (
          (e - this.lastFrame > 500 &&
            ((this.frame = 1 - this.frame),
            (this.lastFrame = e),
            this.view.render()),
          e - this.since > 4e3)
        ) {
          this.finish();
          return;
        }
        this.animation = requestAnimationFrame((t) => this.update(t));
      } catch (t) {
        this.finish(t instanceof Error ? t : new Error(String(t)));
      }
  }
  finish(e) {
    (this.animation !== void 0 && cancelAnimationFrame(this.animation),
      (this.animation = void 0),
      this.cancel?.(),
      (this.cancel = void 0),
      this.view.hide());
    const t = this.complete;
    ((this.complete = void 0), t?.(e));
  }
  dispose() {
    this.disposed ||
      ((this.disposed = !0),
      this.finish(new Error("本局任务横幅已释放。")),
      this.view.dispose());
  }
}
function NT(n) {
  if (n === "roadblock") return { speedIndiCombine: "挡人模式（Web）" };
  if (n === "giant") return { speedIndiCombine: "巨人模式" };
  if (n === "rp") return lw;
  if (n === "lte")
    return {
      speedIndiCombine: "个人LTE Web试玩",
      speedTeamCombine: "组队LTE Web试玩",
    };
  if (n === "ordinary") return H6;
  if (n === "shadow")
    return {
      speedIndiCombine: "个人幽灵标准",
      speedTeamCombine: "组队幽灵标准",
      speedIndiInfinit: "个人幽灵无限加速",
      speedTeamInfinit: "组队幽灵无限加速",
    };
  const e = n === "grip" ? "抓地" : "幽灵";
  return { speedIndiCombine: `个人${e}`, speedTeamCombine: `组队${e}` };
}
function Ol0(n, e = H6) {
  const t = Object.keys(e).find((i) => e[i] === n);
  if (!t) throw new Error("无效的普通竞速类别");
  return t;
}
function zl0(n, e, t = Object.values(H6)) {
  const i = e.children.find((a) => a.name === "Skip"),
    r = i?.children,
    s = T(e, "frame"),
    o = T(e, "listFrame");
  if (
    n.name !== "ComboBox" ||
    !i ||
    !r ||
    r.length < t.length ||
    !t.length ||
    !s ||
    !o
  )
    throw new Error("缺少普通建房的下拉选项模板");
  return h2(
    n,
    {
      windowRect: "0 0 184 26",
      frame: s,
      listFrame: o,
      comboListLength: String(t.length * 26),
      showDropDownButton: "true",
      enable: "true",
      textAlign: "center",
      textRender: "bold16",
    },
    [
      {
        ...i,
        children: t.map((a, c) =>
          h2(r[c], { text: a, windowRect: "0 0 158 26" }),
        ),
      },
    ],
  );
}
class b1 {
  busy = !1;
  view;
  static async confirm(e, t, i, r, s) {
    return b1.messageBox(e, t, i, r, s);
  }
  static async notice(e, t, i) {
    return b1.messageBox(e, t, i, e.cancel, void 0, !0);
  }
  static async messageBox(e, t, i, r, s, o = !1) {
    const a = new b1(),
      c = await _w(e.library),
      { dialog: l, message: u, divider: h, buttonGroup: d } = c.nodes,
      f = h2(c.nodes.affirmative, { align: o ? "center" : "left" }),
      p = h2(c.nodes.negative, { align: "right" }),
      v = h2(l, { visible: "true" }, [
        u,
        h,
        { ...d, children: o ? [f] : [f, p] },
      ]);
    return (
      (a.view = await te.load({
        ...e,
        preserveDisplayPixels: !0,
        smoothImages: !0,
        definition: { ...c.definition, children: [v] },
        roots: ["dialog2_/customMessageBox", "stage_/common"],
        modal: !0,
        label: t,
        onCancel: e.cancel,
        state: (w) =>
          w === v
            ? { text: t }
            : w === u
              ? { text: i, visible: !0 }
              : w === f
                ? {
                    visible: !0,
                    label: s?.yes ?? "确定",
                    text: s?.yes ?? "确定",
                    action: r,
                  }
                : w === p
                  ? {
                      visible: !0,
                      label: s?.no ?? "取消",
                      text: s?.no ?? "取消",
                      action: e.cancel,
                    }
                  : {},
      })),
      a.view.show(),
      a.view.focus(),
      a
    );
  }
  static async create(e, t, i, r) {
    return b1.createForm(e, t, i, r);
  }
  static async createOrdinary(e, t, i, r) {
    return b1.createForm(
      e,
      He[t].mode,
      i,
      (s, o) => {
        if (!o) throw new Error("创建普通竞速房间缺少类别");
        r({ ...s, channelName: o });
      },
      t,
    );
  }
  static async createGameplay(e, t, i, r, s) {
    if ((MI(t), !NT(t)[i])) throw new Error("该玩法未开放此建房类别");
    return b1.createForm(
      e,
      He[i].mode,
      r,
      (o, a) => {
        if (!a) throw new Error("创建房间缺少类别");
        s({ ...o, channelName: a, gameplay: t });
      },
      i,
      t,
    );
  }
  static async createForm(e, t, i, r, s, o = "ordinary") {
    const a = new b1(),
      c = NT(o),
      l = Object.values(c);
    let u = `${i}的房间`.slice(0, 18),
      h = "",
      d = !1,
      f = "8";
    const p = await F9(e.library, "dialog2_/createRoom", "mq_dialog@zz"),
      v = p.children.find((A) => T(A, "name") === "방만들기");
    if (!v) throw new Error("缺少普通建房模板");
    const w = (A, x) =>
      T(A, "name") === x ? A : A.children.map((M) => w(M, x)).find(Boolean);
    if (s && !w(v, "gameStyle")) throw new Error("缺少选择游戏下拉控件");
    const g = s ? w(v, "joinNum") : void 0,
      y = (A) => {
        const x = T(A, "name") ?? "";
        if (
          ![
            "basicAiCont",
            "clubRaceCont",
            "joinNumAi",
            "warningGreenAuth",
            "checkGreenAuth",
          ].includes(x)
        ) {
          if (x === "gameStyle") {
            if (s) {
              if (!g) throw new Error("缺少人数下拉模板");
              return zl0(A, g, l);
            }
            return h2(A, {
              textColor: "255 72 106 163",
              textRender: "bold16",
              textAlign: "right,vcenter",
            });
          }
          return x === "joinNum" && o === "roadblock"
            ? h2(
                A,
                { comboListLength: "104" },
                A.children.map((M) =>
                  M.name === "Skip"
                    ? {
                        ...M,
                        children: M.children.filter((E) =>
                          ["5", "6", "7", "8"].includes(
                            (T(E, "text") ?? "").trim().split(/\s+/)[0],
                          ),
                        ),
                      }
                    : M,
                ),
              )
            : { ...A, children: A.children.map(y).filter((M) => !!M) };
        }
      },
      b = {
        ...p,
        children: [
          await C8(
            e.library,
            h2(y(v), { visible: "true" }),
            "dialog2_/createRoom",
          ),
        ],
      };
    return (
      (a.view = await te.load({
        ...e,
        preserveDisplayPixels: !0,
        smoothImages: !0,
        definition: b,
        roots: ["dialog2_/createRoom", "stage_/common"],
        modal: !0,
        label: "创建房间",
        onCancel: () => {
          a.busy || e.cancel();
        },
        state: (A) => {
          const x = T(A, "name");
          switch (x) {
            case "gameStyle":
              return s
                ? {
                    disabled: a.busy,
                    label: "选择游戏",
                    select: {
                      value: c[s],
                      valueText: c[s],
                      values: l,
                      change: (M) => {
                        a.busy ||
                          ((s = Ol0(M, c)),
                          (t = He[s].mode),
                          t === "team" &&
                            Number(f) % 2 !== 0 &&
                            (f = String(Number(f) + 1)),
                          a.view.render());
                      },
                    },
                    paint: (M, E) => {
                      (M.save(),
                        (M.strokeStyle = a.busy ? "#a5adba" : "#486aa3"),
                        (M.lineWidth = 2),
                        M.beginPath(),
                        M.moveTo(E.x + E.width - 18, E.y + 11),
                        M.lineTo(E.x + E.width - 13, E.y + 16),
                        M.lineTo(E.x + E.width - 8, E.y + 11),
                        M.stroke(),
                        M.restore());
                    },
                  }
                : { text: t === "team" ? "组队竞速" : "个人竞速" };
            case "roomName":
              return {
                disabled: a.busy,
                label: "房间名称",
                input: {
                  value: u,
                  maxLength: 18,
                  change: (M) => {
                    ((u = M), a.view.render());
                  },
                },
              };
            case "roomPassword":
              return {
                disabled: a.busy || !d,
                label: "房间密码",
                input: {
                  value: h,
                  password: !0,
                  maxLength: 12,
                  change: (M) => {
                    ((h = M), a.view.render());
                  },
                },
              };
            case "isPassword":
              return {
                disabled: a.busy,
                label: "设置房间密码",
                checked: d,
                action: () => {
                  ((d = !d), a.view.render());
                },
              };
            case "joinNum":
            case "joinTeamGame":
              return {
                visible: x === (t === "team" ? "joinTeamGame" : "joinNum"),
                disabled: a.busy,
                label: "房间人数",
                select: {
                  value: f,
                  values:
                    o === "roadblock"
                      ? ["5", "6", "7", "8"]
                      : t === "team"
                        ? ["2", "4", "6", "8"]
                        : ["2", "3", "4", "5", "6", "7", "8"],
                  change: (M) => {
                    f = M;
                  },
                },
              };
            case "createRoom":
              return {
                disabled: a.busy || !u.trim() || (d && !h),
                label: "确定建房",
                action: () => {
                  !a.busy &&
                    u.trim() &&
                    (!d || h) &&
                    r(
                      {
                        name: u.trim(),
                        capacity: Number(f),
                        password: d ? h : "",
                      },
                      s,
                    );
                },
              };
            case "cancelRoom":
              return {
                disabled: a.busy,
                label: "取消",
                action: () => {
                  a.busy || e.cancel();
                },
              };
          }
          return {};
        },
      })),
      a.view.show(),
      a.view.focus("roomName"),
      a
    );
  }
  static async password(e, t) {
    const i = new b1();
    let r = "";
    const s = await C8(
      e.library,
      await F9(e.library, "dialog2_/passwordBox", "passwordBox@zz"),
      "dialog2_/passwordBox",
    );
    return (
      (i.view = await te.load({
        ...e,
        preserveDisplayPixels: !0,
        smoothImages: !0,
        definition: s,
        roots: ["dialog2_/passwordBox", "stage_/common"],
        modal: !0,
        label: "输入房间密码",
        onCancel: () => {
          i.busy || e.cancel();
        },
        state: (o) => {
          switch (T(o, "name")) {
            case "passwordEdit":
              return {
                disabled: i.busy,
                label: "房间密码",
                input: {
                  value: r,
                  password: !0,
                  maxLength: 12,
                  change: (a) => {
                    ((r = a), i.view.render());
                  },
                },
              };
            case "okButton":
              return {
                disabled: i.busy || !r,
                label: "加入房间",
                action: () => t(r),
              };
            case "cancelButton":
              return { disabled: i.busy, label: "取消", action: e.cancel };
          }
          return {};
        },
      })),
      i.view.show(),
      i.view.focus("passwordEdit"),
      i
    );
  }
  static async roomSettings(e, t, i, r) {
    const s = new b1();
    let o = i.name,
      a = i.password,
      c = !!a;
    const l = "dialog/changeRoomInfo",
      u = await F9(e.library, l, "mq_dialog@zz"),
      h = u.children.find((v) => T(v, "name") === "방설정변경");
    if (!h) throw new Error("缺少普通房间设置模板");
    const d = (v) => ({
        ...v,
        children: v.children
          .filter(
            (w) =>
              !["warningGreenAuth", "checkGreenAuth", "clubRaceCont"].includes(
                T(w, "name") ?? "",
              ),
          )
          .map(d),
      }),
      f = {
        ...u,
        children: [await C8(e.library, h2(d(h), { visible: "true" }), l)],
      },
      p = () => {
        !s.busy && o.trim() && r({ name: o.trim(), password: c ? a : "" });
      };
    return (
      (s.view = await te.load({
        ...e,
        preserveDisplayPixels: !0,
        smoothImages: !0,
        definition: f,
        roots: [l, "stage_/common"],
        modal: !0,
        label: "房间设置",
        onConfirm: p,
        onCancel: () => {
          s.busy || e.cancel();
        },
        state: (v) => {
          switch (T(v, "name")) {
            case "gameType":
              return { text: t === "team" ? "组队竞速" : "个人竞速" };
            case "roomName":
              return {
                disabled: s.busy,
                label: "房间名称",
                input: {
                  value: o,
                  maxLength: 18,
                  change: (w) => {
                    ((o = w), s.view.render());
                  },
                  submit: p,
                },
              };
            case "roomPassword":
              return {
                disabled: s.busy || !c,
                label: "房间密码",
                input: {
                  value: a,
                  password: !0,
                  maxLength: 12,
                  change: (w) => {
                    ((a = w), s.view.render());
                  },
                  submit: p,
                },
              };
            case "isPassword":
              return {
                disabled: s.busy,
                label: "设置房间密码",
                checked: c,
                action: () => {
                  s.busy || ((c = !c), c || (a = ""), s.view.render());
                },
              };
            case "change":
              return {
                disabled: s.busy || !o.trim(),
                label: "确定",
                action: p,
              };
            case "cancel":
              return { disabled: s.busy, label: "取消", action: e.cancel };
          }
          return {};
        },
      })),
      s.view.show(),
      s.view.focus("roomName"),
      s
    );
  }
  static async team(e, t, i) {
    const r = new b1(),
      s = "dialog2_/changeTeam",
      o = await F9(e.library, s, "mq_dialog@zz"),
      a = await F9(e.library, s, "teamTemplate"),
      c = async (l) => {
        if (T(l, "name") === "teamPanel")
          return {
            ...l,
            children: [1, 2].map((h, d) => {
              const f = 78 + d * 98;
              return h2(
                a,
                {
                  name: `team${h}`,
                  autoLoadImage: `popup_selectTeamColor_${h === 1 ? "red" : "blue"}_@zz`,
                  windowRect: `${f} 0 ${f + 86} 92`,
                },
                a.children.filter((p) => T(p, "name") === "curr" && t === h),
              );
            }),
          };
        const u = { ...l, children: await Promise.all(l.children.map(c)) };
        return l.name === "CaptionWindow"
          ? C8(e.library, h2(u, { setCloseButton: "cancelButton" }), s)
          : u;
      };
    return (
      (r.view = await te.load({
        ...e,
        preserveDisplayPixels: !0,
        smoothImages: !0,
        definition: await c(o),
        roots: [s, "stage_/common"],
        modal: !0,
        label: "选择队伍",
        onCancel: () => {
          r.busy || e.cancel();
        },
        state: (l) => {
          const u = T(l, "name");
          if (u === "team1" || u === "team2") {
            const h = u === "team1" ? 1 : 2;
            return {
              disabled: r.busy || h === t,
              label: h === 1 ? "红队" : "蓝队",
              action: () => i(h),
            };
          }
          return u === "cancelButton"
            ? { disabled: r.busy, label: "取消", action: e.cancel }
            : {};
        },
      })),
      r.view.show(),
      r.view.focus(),
      r
    );
  }
  setBusy(e) {
    ((this.busy = e), this.view.render());
  }
  dispose() {
    this.view.dispose();
  }
}
class Ul0 {
  room;
  departed = new Set();
  apply(e, t) {
    return e.type === "left"
      ? (this.departed.add(e.roomId),
        this.room?.roomId !== e.roomId ? !1 : ((this.room = void 0), !0))
      : e.type !== "room" ||
          !e.room.members.some((i) => i.playerId === t) ||
          this.departed.has(e.room.roomId) ||
          (this.room &&
            (this.room.roomId !== e.room.roomId ||
              e.room.revision <= this.room.revision))
        ? !1
        : ((this.room = e.room), !0);
  }
  allowJoin(e) {
    this.departed.delete(e);
  }
  appendChat(e) {
    const t = this.room;
    return !t ||
      t.roomId !== e.roomId ||
      (t.chat?.at(-1)?.sequence ?? 0) >= e.message.sequence
      ? !1
      : ((this.room = {
          ...t,
          chat: [...(t.chat ?? []), e.message].slice(-32),
        }),
        !0);
  }
}
const $l0 = new Set([
  "NOT_ENOUGH_PLAYERS",
  "ROADBLOCK_NEEDS_FIVE",
  "TRACK_REQUIRED",
  "EQUIPMENT_REQUIRED",
  "PLAYERS_NOT_READY",
  "TEAM_REQUIRED",
  "CLIENT_RACE_UNAVAILABLE",
]);
class Wl0 {
  constructor(e) {
    ((this.options = e),
      e.raceLoader &&
        (this.startCoordinator = new ll0({
          loader: {
            prepare: async (t, i, r) => {
              const s = {
                roomId: t.roomId,
                raceId: i.raceId,
                complete: !1,
                signal: r,
              };
              ((this.startPresentation = s), this.syncLoadingView());
              const o = i.rp
                ? Nl0(e.library, i, this.playerId, r).then(
                    () => ({ ok: !0 }),
                    (p) => ({ ok: !1, error: p }),
                  )
                : void 0;
              if (i.roadblock) {
                const p = await yy.load(e.library, e.root, i, this.playerId);
                try {
                  if (r.aborted || this.disposed)
                    throw new Error("本局任务横幅已取消。");
                  ((this.startMission = p),
                    this.syncLoadingView(),
                    await p.present(r));
                } finally {
                  (p.dispose(),
                    this.startMission === p &&
                      ((this.startMission = void 0), this.syncLoadingView()));
                }
              }
              if (i.rp) {
                const p = await vy.load(
                  e.library,
                  e.root,
                  i,
                  this.playerId,
                  e.audioContext?.(),
                );
                try {
                  if (r.aborted || this.disposed)
                    throw new Error("本局 RP 结果展示已取消。");
                  ((this.rpNotice = p),
                    this.syncLoadingView(),
                    await p.present(r));
                } finally {
                  (p.dispose(),
                    this.rpNotice === p &&
                      ((this.rpNotice = void 0), this.syncLoadingView()));
                }
              }
              if (r.aborted || this.disposed)
                throw new Error("本局开始展示已取消。");
              if (((s.complete = !0), this.syncLoadingView(), o)) {
                const p = await o;
                if (r.aborted || this.disposed)
                  throw new Error("本局飞宠预读已取消。");
                if (!p.ok) throw p.error;
              }
              const a = this.client.raceConnection(t.roomId, i.raceId, r);
              let c = !1,
                l = !1;
              const u = {
                  ...a,
                  get hasMotionRecipients() {
                    return a.hasMotionRecipients;
                  },
                  get motionRoundTripMs() {
                    return a.motionRoundTripMs;
                  },
                  sendRaceChat: (p) => {
                    const v = this.state.room;
                    return r.aborted || v?.roomId !== t.roomId
                      ? Promise.reject(new Error("本局已结束。"))
                      : v.phase === "open"
                        ? this.client.request({
                            type: "chat",
                            roomId: t.roomId,
                            text: p,
                          })
                        : a.sendRaceChat(p);
                  },
                  subscribeRaceChat: (p) => {
                    const v = a.subscribeRaceChat((g) => {
                        this.state.room?.phase !== "open" && p(g);
                      }),
                      w = this.client.subscribe((g) => {
                        !r.aborted &&
                          this.state.room?.roomId === t.roomId &&
                          this.state.room.phase === "open" &&
                          g.type === "chat" &&
                          g.roomId === t.roomId &&
                          p(g.message);
                      });
                    return () => {
                      (v(), w());
                    };
                  },
                  leaveRace: async () => {
                    const p = this.state.room;
                    if (
                      r.aborted ||
                      p?.roomId !== t.roomId ||
                      p.race?.raceId !== i.raceId
                    )
                      throw new Error("本局已结束。");
                    return this.client.request({
                      type: "leave",
                      roomId: p.roomId,
                      revision: p.revision,
                    });
                  },
                  presentationClosed: () => {
                    r.aborted ||
                      this.disposed ||
                      this.state.room?.roomId !== t.roomId ||
                      this.state.room.phase !== "open" ||
                      h.presentingResults?.() ||
                      (a.returnToRoom?.().catch((p) => {
                        this.disposed ||
                          this.options.status(`返房同步失败：${C1(p)}`, !0);
                      }),
                      (c = !0),
                      this.startCoordinator?.releasePresentedRace());
                  },
                },
                h = await e.raceLoader.prepare(t, i, r, u);
              let d = !1;
              const f = () => {
                d ||
                  ((d = !0),
                  (this.raceVisible = !0),
                  this.roomView?.hide(),
                  this.syncLoadingView(),
                  e.onRaceVisibility?.(!0));
              };
              return {
                showWaiting: () => {
                  h.showWaiting && (h.showWaiting(), f());
                },
                bindClock: (p) => h.bindClock?.(p),
                updateRoom: (p) => {
                  (p.phase === "finished" && (l = !0),
                    l && p.phase === "open" && !p.raceError && (c = !0),
                    h.updateRoom?.(p));
                },
                scheduleStart: (p) => {
                  (h.scheduleStart(p), f());
                },
                presentingResults: () => h.presentingResults?.() ?? !1,
                dispose: () => {
                  if (
                    (h.dispose(),
                    d &&
                      ((d = !1),
                      (this.raceVisible = !1),
                      e.onRaceVisibility?.(!1),
                      !this.disposed && this.state.room?.roomId === t.roomId))
                  ) {
                    const p = this.state.room;
                    (((c && p.phase === "open") ||
                      (p.phase === "finished" &&
                        p.race?.raceId === i.raceId &&
                        p.race.returnedIds?.includes(this.playerId))) &&
                      ((this.autoReadyRoom = p.roomId),
                      (this.autoReadyConsumed = p.hostId === this.playerId)),
                      this.roomView?.show(),
                      this.render(),
                      e.onPageAudio?.("room"),
                      this.maybeAutoReady());
                  }
                },
              };
            },
          },
          send: (t) => this.client.request(t),
          captureClock: () => this.client.captureClock(),
          onError: (t) => {
            (this.syncLoadingView(), e.status(`比赛加载失败：${C1(t)}`, !0));
          },
        })));
  }
  options;
  accountAbort = new AbortController();
  accountNickname;
  client = new LT();
  state = new Ul0();
  lobby;
  roomView;
  loadingView;
  loadingViewPending;
  loadingViewFailed = !1;
  startMission;
  rpNotice;
  startPresentation;
  dialog;
  roomSettingsRoomId;
  manualStartAfter = 0;
  trackSelect;
  garage;
  garageLoading = !1;
  dialogGeneration = 0;
  changingModal;
  favoriteTracks = new Set();
  playerId = "";
  connected = !1;
  busy = !1;
  leaving = !1;
  leaveConfirmation;
  voteDialogId;
  disposed = !1;
  raceVisible = !1;
  autoReadyRoom;
  autoReadyConsumed = !1;
  modalLoading = !1;
  roomLoading = !1;
  selection = 0;
  generation = 0;
  channelName;
  gameplay = "ordinary";
  page = 0;
  rooms = [];
  refresh;
  startCoordinator;
  get hasModal() {
    return (
      this.leaving ||
      this.busy ||
      this.modalLoading ||
      !!this.dialog ||
      !!this.trackSelect ||
      !!this.garage
    );
  }
  get isInRoom() {
    return !!this.state.room;
  }
  networkDiagnostics() {
    return this.client.networkDiagnostics();
  }
  quickJoinShortcut() {
    !this.disposed &&
      this.connected &&
      !this.state.room &&
      !this.busy &&
      !this.dialog &&
      !this.trackSelect &&
      !this.modalLoading &&
      this.quickJoin();
  }
  handleRoomShortcut(e) {
    const t = this.state.room;
    if (
      !t ||
      !this.roomView ||
      this.raceVisible ||
      this.disposed ||
      !this.connected ||
      this.hasModal ||
      this.busy ||
      t.phase !== "open" ||
      (e.code !== "F5" && e.code !== "KeyP") ||
      e.repeat ||
      e.altKey ||
      e.ctrlKey ||
      e.metaKey ||
      e.isComposing ||
      e.target?.matches?.(
        "input, textarea, [contenteditable], [contenteditable] *",
      )
    )
      return !1;
    if ((e.preventDefault(), e.stopPropagation(), e.code === "KeyP")) {
      const r = this.options.toggleAutoReady?.();
      return (
        r !== void 0 &&
          (this.options.status(`自动准备已${r ? "开启" : "关闭"}。`),
          this.render()),
        !0
      );
    }
    return (this.roomView.activateReadyShortcut(), !0);
  }
  refreshAutoReady() {
    this.render();
  }
  async open() {
    const e = vl0(this.options.root, this.accountAbort.signal);
    let t;
    try {
      const r = await fetch(Ko("healthz", window.location.href), {
        cache: "no-store",
        signal: this.accountAbort.signal,
      });
      if (!r.ok) throw new Error("无法验证联机服务版本，请检查后端服务。");
      const s = (await r.json()).protocolVersion;
      if (!Number.isInteger(s))
        throw new Error("无法验证联机服务版本，请检查后端服务。");
      if (s !== Uo)
        throw new Error(`联机前端版本 ${Uo}，后端版本 ${s}。请同步更新后端。`);
      t = await yl0(this.options.root, this.accountAbort.signal);
    } catch (r) {
      throw (
        this.accountAbort.signal.aborted ||
        (r instanceof Error && r.message === "ACCOUNT_CANCELLED")
          ? e.close()
          : await e.fail(`无法打开多人登录：${C1(r)}`),
        r
      );
    }
    if (
      (e.close(),
      this.disposed ||
        ((this.accountNickname =
          t?.nickname ??
          (await PT(
            this.options.root,
            this.options.nickname ?? "",
            this.accountAbort.signal,
          ))),
        this.disposed) ||
        (await this.options.prepareAudio?.(), this.disposed))
    )
      return;
    const i = await Ew.load({
      ...this.options,
      onMode: (r, s, o) => {
        this.list(r, s, !1, o ?? "ordinary");
      },
      onUnavailable: (r, s) => {
        this.openDialog(() => b1.notice(this.dialogOptions(), r, s));
      },
      onCreate: () => {
        this.create();
      },
      onJoin: (r) => {
        this.join(r);
      },
      onQuickJoin: () => {
        this.quickJoin();
      },
    });
    if (this.disposed) {
      i.dispose();
      return;
    }
    ((this.lobby = i),
      i.show(),
      this.options.onVisible?.(),
      this.options.onPageAudio?.("lobby"),
      this.bindClient(),
      this.options.status("多人大厅已打开，正在连接房间服务…"));
    try {
      let r;
      for (;;)
        try {
          r = await this.client.connect(
            Ko("offer", window.location.href),
            this.accountNickname,
            this.options.version,
            this.options.initialEquipment,
            this.options.initial,
            !!this.options.raceLoader,
            xF(ay(window.location.href)),
          );
          break;
        } catch (s) {
          if (
            t ||
            this.disposed ||
            !(s instanceof Error) ||
            !["GUEST_NAME_TAKEN", "INVALID_GUEST_NAME"].includes(s.message)
          )
            throw s;
          (this.client.dispose(),
            (this.client = new LT()),
            this.bindClient(),
            (this.accountNickname = await PT(
              this.options.root,
              this.accountNickname ?? "",
              this.accountAbort.signal,
              !0,
            )));
        }
      if (this.disposed) return;
      if (r.type !== "welcome") throw new Error("房间服务身份未确认");
      (t || EF(this.accountNickname),
        (this.playerId = r.playerId),
        (this.connected = !0),
        this.render(),
        this.options.status("请选择比赛频道。"),
        (this.refresh = setInterval(() => {
          this.channelName &&
            !this.disposed &&
            !this.state.room &&
            !this.busy &&
            !this.modalLoading &&
            !this.dialog &&
            this.connected &&
            this.list(this.channelName, this.page, !0);
        }, 5e3)));
    } catch (r) {
      this.disposed || this.options.status(`多人游戏：${C1(r)}`, !0);
    }
  }
  bindClient() {
    const e = this.client;
    (e.subscribe((t) => this.receive(t)),
      e.onClose(() => {
        this.disposed ||
          this.client !== e ||
          !this.connected ||
          ((this.connected = !1),
          this.startCoordinator?.reset(),
          this.cancelDialog(),
          this.render(),
          this.options.status(
            "联机服务已断开。请返回单人游戏，再重新进入多人游戏。",
            !0,
          ));
      }));
  }
  dispose() {
    this.disposed ||
      ((this.disposed = !0),
      this.accountAbort.abort(),
      this.startCoordinator?.dispose(),
      ++this.generation,
      clearInterval(this.refresh),
      this.startMission?.dispose(),
      (this.startMission = void 0),
      this.rpNotice?.dispose(),
      (this.rpNotice = void 0),
      ++this.dialogGeneration,
      this.leaveConfirmation?.resolve(!1),
      (this.leaveConfirmation = void 0),
      this.client.dispose(),
      this.dialog?.dispose(),
      this.trackSelect?.dispose(),
      this.garage?.dispose(),
      this.roomView?.dispose(),
      this.lobby?.dispose(),
      this.loadingView?.dispose(),
      (this.loadingView = void 0));
  }
  render() {
    (this.syncLoadingView(),
      this.lobby?.setEnabled(
        this.connected && !this.busy && !this.leaving && !this.state.room,
      ),
      this.lobby?.setInert(
        !!this.dialog || this.modalLoading || this.busy || this.leaving,
      ),
      this.state.room &&
        this.roomView?.update(
          this.state.room,
          this.busy ||
            this.leaving ||
            !!this.dialog ||
            !!this.trackSelect ||
            !!this.garage ||
            this.modalLoading,
          this.connected,
        ),
      this.dialog?.setBusy(
        this.busy || (!this.connected && !this.leaveConfirmation),
      ));
  }
  syncLoadingView() {
    const e = this.state.room;
    e &&
      this.options.raceLoader &&
      this.options.library &&
      this.options.root &&
      !this.loadingView &&
      !this.loadingViewPending &&
      !this.loadingViewFailed &&
      !this.disposed &&
      (this.loadingViewPending = gy
        .load(this.options.library, this.options.root)
        .then((o) => {
          if (this.disposed) {
            o.dispose();
            return;
          }
          ((this.loadingView = o), this.syncLoadingView());
        })
        .catch((o) => {
          ((this.loadingViewFailed = !0),
            this.disposed ||
              this.options.status(`比赛加载画面资源失败：${C1(o)}`, !0));
        })
        .finally(() => {
          this.loadingViewPending = void 0;
        }));
    const t = this.startPresentation,
      i = !!(
        t &&
        !t.complete &&
        !t.signal.aborted &&
        t.roomId === e?.roomId &&
        t.raceId === e?.race?.raceId
      );
    if ((this.roomView?.setStartPresentation?.(i), !this.loadingView)) return;
    const s =
      !!!(e?.race?.rp || e?.race?.roadblock) ||
      !!(
        t?.complete &&
        !t.signal.aborted &&
        t.roomId === e?.roomId &&
        t.raceId === e?.race?.raceId
      );
    !this.disposed &&
    this.connected &&
    !this.raceVisible &&
    s &&
    !this.startMission &&
    !this.rpNotice &&
    (e?.phase === "loading" || e?.phase === "countdown")
      ? this.loadingView.show(e.race?.loadedIds.length ?? 0, e.members.length)
      : this.loadingView.hide();
  }
  maybeAutoReady() {
    const e = this.state.room;
    if (
      !e ||
      !this.roomView ||
      !this.options.autoReadyEnabled?.() ||
      !this.connected ||
      this.disposed ||
      this.raceVisible ||
      e.phase !== "open" ||
      e.hostId === this.playerId ||
      this.autoReadyConsumed
    )
      return;
    const t = e.members.find((i) => i.playerId === this.playerId);
    t &&
      ((this.autoReadyConsumed = !0),
      !(t.ready || this.hasModal) && this.roomView.activateReadyShortcut());
  }
  receive(e) {
    if (e.type === "chat") {
      !this.disposed && this.state.appendChat(e) && this.render();
      return;
    }
    const t = this.state.room;
    if (!(this.disposed || !this.state.apply(e, this.playerId)))
      if ((this.client.bindMotionScope(this.state.room), this.state.room)) {
        ((this.gameplay = G2(this.state.room)),
          this.autoReadyRoom !== this.state.room.roomId &&
            ((this.autoReadyRoom = this.state.room.roomId),
            (this.manualStartAfter = 0),
            (this.autoReadyConsumed =
              this.state.room.hostId === this.playerId)),
          t?.roomId === this.state.room.roomId &&
            this.state.room.phase === "open" &&
            this.state.room.hostId === this.playerId &&
            (t.trackId !== this.state.room.trackId ||
              t.randomTrackCode !== this.state.room.randomTrackCode) &&
            (this.manualStartAfter = performance.now() + 3e3),
          this.state.room.phase !== "open" && this.cancelDialog(!1),
          this.state.room.race?.returnedIds?.includes(this.playerId)
            ? (this.startCoordinator?.reset(),
              this.options.status(
                "已返回原房间，等待其他玩家结束结算；全部返回后可重新准备。",
              ))
            : this.startCoordinator?.update(this.state.room),
          this.state.room.phase === "loading" && !this.startCoordinator
            ? this.options.status(
                `正在加载比赛，${this.state.room.race?.loadedIds.length ?? 0}/${this.state.room.members.length} 人已就绪…`,
              )
            : this.state.room.phase === "countdown"
              ? this.options.status(
                  "已加载玩家等待统一起跑；超时玩家已按掉线处理。",
                )
              : this.state.room.phase === "open" &&
                this.state.room.raceError &&
                this.options.status(
                  C1(new Error(this.state.room.raceError)),
                  !0,
                ));
        const i = RI(this.state.room);
        (this.options.speed(i.speed, i.version),
          this.roomSettingsRoomId &&
            (this.state.room.roomId !== this.roomSettingsRoomId ||
              this.state.room.hostId !== this.playerId) &&
            this.cancelDialog(),
          !this.roomSettingsRoomId &&
            ((this.dialog && !this.leaveConfirmation && !this.voteDialogId) ||
              (!this.dialog &&
                !this.garage &&
                !this.garageLoading &&
                !this.trackSelect &&
                !this.modalLoading &&
                !this.voteDialogId)) &&
            this.cancelDialog(),
          this.leaveConfirmation &&
            (this.state.room.roomId !== this.leaveConfirmation.roomId ||
              this.state.room.phase !== "open") &&
            this.cancelDialog(),
          (this.trackSelect || this.changingModal?.kind === "track") &&
            this.state.room.hostId !== this.playerId &&
            this.cancelDialog(),
          this.render(),
          this.cancelCountdownModals(),
          this.maybeAutoReady(),
          !this.roomView && !this.roomLoading && this.showRoom(),
          this.syncKickVoteDialog());
      } else
        ((this.autoReadyRoom = void 0),
          (this.autoReadyConsumed = !1),
          (this.manualStartAfter = 0),
          this.startCoordinator?.reset(),
          ++this.generation,
          (this.roomLoading = !1),
          this.cancelDialog(),
          this.roomView?.dispose(),
          (this.roomView = void 0),
          this.lobby?.show(),
          this.render(),
          this.options.onPageAudio?.("lobby"),
          this.options.status(
            e.type === "left" && !e.requestId
              ? "你已被移出房间。"
              : "已返回多人大厅。",
          ),
          this.channelName && this.list(this.channelName, this.page));
  }
  async showRoom() {
    const e = this.state.room;
    if (!e) return;
    const t = ++this.generation;
    this.roomLoading = !0;
    try {
      const i = await py.load(
        this.options.library,
        this.options.root,
        e,
        this.playerId,
        {
          ...this.options,
          leave: () => {
            this.leaveRoom("lobby");
          },
          ready: (r) => {
            const s = this.state.room;
            s &&
              this.mutate({
                type: "ready",
                roomId: s.roomId,
                revision: s.revision,
                ready: r,
              });
          },
          start: this.options.raceLoader
            ? () => {
                const r = this.state.room;
                r &&
                  performance.now() > this.manualStartAfter &&
                  this.mutate({
                    type: "start",
                    roomId: r.roomId,
                    revision: r.revision,
                  });
              }
            : void 0,
          canStart: () => performance.now() > this.manualStartAfter,
          onCountdownLocked: () => this.cancelCountdownModals(),
          settings: () => {
            this.changeRoomInfo();
          },
          captureClock: () => this.client.captureClock(),
          team: () => {
            this.team();
          },
          track: () => {
            this.chooseTrack();
          },
          garage: this.options.garage
            ? () => {
                this.chooseGarage();
              }
            : void 0,
          chat: (r) => this.sendChat(r),
          onError: (r) => this.options.status(C1(r), !0),
          kick: (r) => {
            this.confirm("发起移出投票", `对 ${r.name} 发起移出投票？`, () => {
              const s = this.state.room;
              s &&
                this.mutate({
                  type: "kick",
                  roomId: s.roomId,
                  revision: s.revision,
                  playerId: r.playerId,
                });
            });
          },
          slot: (r, s) => {
            const o = this.state.room;
            o &&
              this.mutate({
                type: "slot",
                roomId: o.roomId,
                revision: o.revision,
                slot: r,
                closed: s,
              });
          },
          transfer: (r) => {
            this.confirm("移交房主", `将房主移交给 ${r.name}？`, () => {
              const s = this.state.room;
              s &&
                this.mutate({
                  type: "transfer-host",
                  roomId: s.roomId,
                  revision: s.revision,
                  playerId: r.playerId,
                });
            });
          },
        },
        this.options.audioContext?.(),
      );
      if (
        this.disposed ||
        t !== this.generation ||
        this.state.room?.roomId !== e.roomId
      ) {
        i.dispose();
        return;
      }
      ((this.roomView = i),
        this.raceVisible || i.show(),
        this.lobby?.hide(),
        this.render(),
        this.maybeAutoReady(),
        this.raceVisible || this.options.onPageAudio?.("room"),
        this.options.status(
          this.options.raceLoader
            ? "已进入房间。支持个人和组队竞速，可使用本地车库改装。"
            : "已进入房间。可选车、选图、聊天、准备和管理成员；比赛尚未接入。",
        ));
    } catch (i) {
      !this.disposed &&
        t === this.generation &&
        (this.options.status(
          `房间界面加载失败：${C1(i)}。已断开房间，请返回单人游戏重试。`,
          !0,
        ),
        this.client.dispose());
    } finally {
      t === this.generation && (this.roomLoading = !1);
    }
  }
  async list(e, t, i = !1, r = this.gameplay) {
    if (!this.connected || this.state.room || this.disposed) return;
    if (!rg(r)) {
      this.options.status("LTE 模式暂未开放。", !0);
      return;
    }
    if (r !== "ordinary" && this.options.version !== "p3553") {
      this.options.status("娱乐模式暂时仅开放 P3553 资源版本。", !0);
      return;
    }
    ((e !== this.channelName || t !== this.page || r !== this.gameplay) &&
      ((this.rooms = []), this.lobby?.setRooms(e, t, 0, [], r)),
      (this.channelName = e),
      (this.page = t),
      (this.gameplay = r));
    const s = ++this.selection;
    try {
      const o = await this.client.request(
        r === "ordinary"
          ? { type: "list-ordinary", page: t }
          : { type: "list-gameplay", gameplay: r, page: t },
      );
      if (
        this.disposed ||
        s !== this.selection ||
        this.state.room ||
        o.type !== "rooms"
      )
        return;
      if (t > 0 && o.rooms.length === 0) {
        await this.list(e, Math.max(0, Math.ceil(o.total / 10) - 1), i, r);
        return;
      }
      ((this.rooms = o.rooms),
        this.lobby?.setRooms(e, t, o.total, o.rooms, r),
        i ||
          this.options.status(
            r === "lte"
              ? "LTE Web试玩：可创建个人或组队标准房间，Z/X左右躲闪。专用地图、自动补氮气及香蕉事件尚未接齐。"
              : o.total
                ? `找到 ${o.total} 个房间，点击房间即可加入。`
                : `${xX[r]}大厅暂无房间，可以创建房间邀请其他玩家加入。`,
          ));
    } catch (o) {
      !this.disposed &&
        s === this.selection &&
        !i &&
        this.options.status(C1(o), !0);
    }
  }
  async leaveRoom(e) {
    if (this.disposed || this.hasModal || this.raceVisible) return !1;
    const t = this.state.room;
    if (!t) return !0;
    if (t.phase !== "open") return !1;
    ((this.leaving = !0), this.render());
    try {
      if (
        (this.options.beforeLeaveRoom &&
          !(await this.options.beforeLeaveRoom({ reason: e, room: t }))) ||
        !(await this.confirmLeaveRoom(t.roomId)) ||
        this.disposed
      )
        return !1;
      const i = this.state.room;
      return i
        ? i.roomId !== t.roomId || i.phase !== "open"
          ? !1
          : this.connected
            ? (await this.mutate({
                type: "leave",
                roomId: i.roomId,
                revision: i.revision,
              })) && !this.state.room
            : (this.receive({ type: "left", roomId: i.roomId }), !0)
        : !0;
    } catch (i) {
      return (this.disposed || this.options.status(C1(i), !0), !1);
    } finally {
      ((this.leaving = !1), this.disposed || this.render());
    }
  }
  async mutate(e) {
    if (this.disposed || this.busy || !this.connected) return !1;
    ((this.busy = !0), this.render());
    let t,
      i = !1;
    try {
      const r = await this.client.request(e);
      if (this.disposed) return !1;
      (this.receive(r), (i = !0));
    } catch (r) {
      if (!this.disposed) {
        const s = r instanceof Error ? r.message : String(r);
        (e.type === "start" &&
        $l0.has(s) &&
        this.state.room?.hostId === this.playerId
          ? (t = C1(r))
          : this.options.status(C1(r), !0),
          r instanceof Error &&
            r.message.startsWith("Request timeout") &&
            this.client.dispose());
      }
    } finally {
      ((this.busy = !1), this.disposed || this.render());
    }
    return (
      t &&
        !this.disposed &&
        this.state.room?.phase === "open" &&
        (await this.openDialog(() =>
          b1.notice(this.dialogOptions(), "无法开始比赛", t),
        )),
      i
    );
  }
  cancelDialog(e = !0) {
    const t = this.changingModal;
    ((this.changingModal = void 0),
      ++this.dialogGeneration,
      t && ((this.modalLoading = !1), (this.garageLoading = !1)),
      (this.roomSettingsRoomId = void 0),
      (this.voteDialogId = void 0),
      this.leaveConfirmation?.resolve(!1),
      (this.leaveConfirmation = void 0),
      this.dialog?.dispose(),
      (this.dialog = void 0),
      this.trackSelect?.dispose(),
      (this.trackSelect = void 0),
      this.garage?.dispose(),
      (this.garage = void 0),
      this.render(),
      t && this.endChangingModal(t, e));
  }
  async confirmLeaveRoom(e) {
    let t;
    const i = new Promise((r) => {
      t = r;
    });
    return (
      (this.leaveConfirmation = { roomId: e, resolve: t }),
      await this.openDialog(
        () =>
          b1.confirm(
            this.dialogOptions(),
            "提示",
            "确定要离开队友退出房间吗",
            () => {
              const r = this.leaveConfirmation;
              ((this.leaveConfirmation = void 0),
                this.cancelDialog(),
                r?.resolve(!0));
            },
          ),
        !0,
      ),
      !this.dialog && this.leaveConfirmation && this.cancelDialog(),
      i
    );
  }
  async openDialog(e, t = !1) {
    if (
      this.disposed ||
      this.busy ||
      this.dialog ||
      this.trackSelect ||
      this.garage ||
      this.modalLoading ||
      (!this.connected && !t)
    )
      return;
    ((this.modalLoading = !0), this.render());
    const i = ++this.dialogGeneration;
    try {
      const r = await e();
      if (
        this.disposed ||
        i !== this.dialogGeneration ||
        (!this.connected && !t)
      ) {
        r.dispose();
        return;
      }
      this.dialog = r;
    } catch (r) {
      this.disposed || this.options.status(C1(r), !0);
    } finally {
      ((this.modalLoading = !1),
        this.disposed || (this.render(), this.syncKickVoteDialog()));
    }
  }
  dialogOptions() {
    return { ...this.options, cancel: () => this.cancelDialog() };
  }
  syncKickVoteDialog() {
    const e = this.state.room,
      t = e?.kickVote;
    if (
      (this.voteDialogId &&
        (!t ||
          t.voteId !== this.voteDialogId ||
          t.yesIds.includes(this.playerId) ||
          t.noIds.includes(this.playerId)) &&
        this.cancelDialog(),
      !t ||
        this.voteDialogId ||
        this.leaveConfirmation ||
        !t.eligibleIds.includes(this.playerId) ||
        t.yesIds.includes(this.playerId) ||
        t.noIds.includes(this.playerId) ||
        !this.connected ||
        this.raceVisible ||
        ((this.dialog || this.trackSelect || this.garage) &&
          this.cancelDialog(),
        this.busy || this.modalLoading || this.garageLoading))
    )
      return;
    const i = e.members.find((r) => r.playerId === t.targetId);
    i &&
      ((this.voteDialogId = t.voteId),
      this.openDialog(() =>
        b1.confirm(
          { ...this.options, cancel: () => this.castKickVote(!1) },
          "踢人投票",
          `是否同意将 ${i.name} 移出房间？`,
          () => this.castKickVote(!0),
          { yes: "同意", no: "反对" },
        ),
      ));
  }
  castKickVote(e) {
    const t = this.voteDialogId;
    this.cancelDialog();
    const i = this.state.room;
    t &&
      i?.kickVote?.voteId === t &&
      this.mutate({
        type: "kick-vote",
        roomId: i.roomId,
        revision: i.revision,
        voteId: t,
        approve: e,
      });
  }
  async sendChat(e) {
    const t = this.state.room;
    if (!t || !this.connected || this.disposed) return !1;
    try {
      const i = await this.client.request({
        type: "chat",
        roomId: t.roomId,
        text: e,
      });
      return (
        this.receive(i),
        !this.disposed && this.state.room?.roomId === t.roomId
      );
    } catch (i) {
      return (this.disposed || this.options.status(C1(i), !0), !1);
    }
  }
  isChangingModalCurrent(e) {
    const t = this.state.room;
    return (
      !this.disposed &&
      this.connected &&
      this.changingModal === e &&
      e.generation === this.dialogGeneration &&
      t?.roomId === e.roomId &&
      t.phase === "open" &&
      (e.kind === "track"
        ? t.hostId === this.playerId
        : t.hostId === this.playerId ||
          !t.members.find((i) => i.playerId === this.playerId)?.ready) &&
      !(t.hostId === this.playerId && this.roomView?.countdownLocked)
    );
  }
  endChangingModal(e, t = !0) {
    if (
      (t || (e.releaseAllowed = !1),
      e.entered && !e.released && e.releaseAllowed)
    ) {
      e.released = !0;
      const i = this.changingModal;
      if (i && i !== e && i.roomId === e.roomId) {
        i.entered = !0;
        return;
      }
      this.releaseChanging(e.roomId);
    }
  }
  cancelCountdownModals() {
    const e = this.state.room;
    e?.phase === "open" &&
      e.hostId === this.playerId &&
      this.roomView?.countdownLocked &&
      this.changingModal &&
      this.cancelDialog();
  }
  finishChangingLoad(e, t) {
    if (this.changingModal === e) {
      if (!t) {
        this.cancelDialog();
        return;
      }
      ((this.modalLoading = !1),
        (this.garageLoading = !1),
        this.disposed || this.render());
    } else this.endChangingModal(e);
  }
  async releaseChanging(e) {
    const t = this.state.room;
    if (!(
      this.disposed ||
      !this.connected ||
      t?.phase !== "open" ||
      t.roomId !== e ||
      !t.members.find((i) => i.playerId === this.playerId)?.changing
    ))
      try {
        this.receive(
          await this.client.request({
            type: "changing",
            roomId: t.roomId,
            changing: !1,
          }),
        );
      } catch (i) {
        this.disposed ||
          (this.options.status(C1(i), !0), this.client.dispose());
      }
  }
  async chooseGarage() {
    const e = this.state.room,
      t = this.options.garage;
    if (
      !e ||
      e.phase !== "open" ||
      (e.hostId === this.playerId && this.roomView?.countdownLocked) ||
      (e.hostId !== this.playerId &&
        e.members.find((s) => s.playerId === this.playerId)?.ready) ||
      !t ||
      this.disposed ||
      this.busy ||
      this.dialog ||
      this.trackSelect ||
      this.garage ||
      this.modalLoading ||
      !this.connected
    )
      return;
    ((this.modalLoading = !0), (this.garageLoading = !0));
    const i = {
      kind: "garage",
      roomId: e.roomId,
      generation: ++this.dialogGeneration,
      entered: !1,
      released: !1,
      releaseAllowed: !0,
    };
    ((this.changingModal = i), this.render());
    let r = !1;
    try {
      if (
        !(await this.mutate({
          type: "changing",
          roomId: e.roomId,
          changing: !0,
        })) ||
        ((i.entered = !0), !this.isChangingModalCurrent(i))
      )
        return;
      const s = await t.options();
      if (!this.isChangingModalCurrent(i)) return;
      const { TimeAttackGarageView: o } = await El(
        async () => {
          const { TimeAttackGarageView: c } = await Promise.resolve().then(
            () => w80,
          );
          return { TimeAttackGarageView: c };
        },
        void 0,
      );
      if (!this.isChangingModalCurrent(i)) return;
      const a = await o.load({
        ...s,
        onCancel: () => {
          this.isChangingModalCurrent(i) && this.cancelDialog();
        },
        onConfirm: (c) => {
          if (!this.isChangingModalCurrent(i) || this.busy) return;
          const l = zw({ ...s.profile, equipment: c.equipment });
          this.confirmGarage({ ...c, equipment: l }, e.roomId, i);
        },
      });
      if (!this.isChangingModalCurrent(i)) {
        a.dispose();
        return;
      }
      ((this.garage = a), (r = !0), a.show());
    } catch (s) {
      this.disposed || this.options.status(`选择赛车：${C1(s)}`, !0);
    } finally {
      this.finishChangingLoad(i, r);
    }
  }
  async confirmGarage(e, t, i) {
    const r = this.state.room;
    if (
      !r ||
      (r.hostId !== this.playerId &&
        r.members.find((o) => o.playerId === this.playerId)?.ready) ||
      r.roomId !== t ||
      !this.connected ||
      this.disposed ||
      !this.isChangingModalCurrent(i)
    )
      return;
    this.garage?.freeze();
    const s = await this.mutate({
      type: "equipment",
      roomId: t,
      revision: r.revision,
      equipment: e.equipment,
    });
    if (this.changingModal === i) {
      if (!s) {
        this.garage?.unfreeze();
        return;
      }
      (this.cancelDialog(!1),
        !(this.disposed || this.state.room?.roomId !== t) &&
          this.options.garage?.apply(e));
    }
  }
  async chooseTrack() {
    const e = this.state.room;
    if (
      (e && ["roadblock", "lte"].includes(G2(e))) ||
      !e ||
      e.phase !== "open" ||
      e.hostId !== this.playerId ||
      this.disposed ||
      this.roomView?.countdownLocked ||
      this.busy ||
      this.dialog ||
      this.trackSelect ||
      this.garage ||
      this.modalLoading ||
      !this.connected
    )
      return;
    this.modalLoading = !0;
    const t = {
      kind: "track",
      roomId: e.roomId,
      generation: ++this.dialogGeneration,
      entered: !1,
      released: !1,
      releaseAllowed: !0,
    };
    ((this.changingModal = t), this.render());
    let i = !1;
    try {
      if (
        !(await this.mutate({
          type: "changing",
          roomId: e.roomId,
          changing: !0,
        })) ||
        ((t.entered = !0), !this.isChangingModalCurrent(t))
      )
        return;
      const r = await this.options.library.timeAttackTrackCatalog(),
        s = G2(e) === "giant" ? r.filter((h) => Zl(h.id)) : r;
      if (!this.isChangingModalCurrent(t)) return;
      const o =
          e.resourceVersion === "p3553"
            ? (await this.options.library.timeAttackRandomTrackGroups()).filter(
                (h) =>
                  Yc.some(
                    (d) =>
                      d.groupId === h.id && (G2(e) !== "giant" || d.code === 0),
                  ),
              )
            : [],
        a = o.length
          ? await this.options.library.timeAttackRandomTrackNames()
          : new Map();
      if (!this.isChangingModalCurrent(t)) return;
      const c = this.options.trackFavorites,
        l =
          e.trackId ??
          (s.some((h) => h.id === this.options.initialTrackId)
            ? this.options.initialTrackId
            : s[0]?.id) ??
          "",
        u = await _7.load({
          library: this.options.library,
          root: this.options.root,
          tracks: s,
          selectedTrackId: l,
          randomGroups: o,
          randomTrackNames: a,
          selectedRandomGroupId: Yc.find((h) => h.code === e.randomTrackCode)
            ?.groupId,
          favoriteTrackIds: c?.ids(s) ?? this.favoriteTracks,
          getFavoriteCount: () => c?.count() ?? this.favoriteTracks.size,
          onFavoriteChange: (h, d) => {
            const f = s.find((p) => p.id === h);
            f &&
              (c
                ? c.change(f, d)
                : d
                  ? this.favoriteTracks.add(h)
                  : this.favoriteTracks.delete(h));
          },
          onCancel: () => {
            this.isChangingModalCurrent(t) && this.cancelDialog();
          },
          onConfirm: (h) => {
            this.confirmTrack(t, h);
          },
          onNotice: this.options.onNotice ?? ((h, d) => this.options.status(d)),
          onError: (h) => this.options.status(C1(h), !0),
          onInteraction: this.options.onActivate,
        });
      if (!this.isChangingModalCurrent(t)) {
        u.dispose();
        return;
      }
      ((this.trackSelect = u), (i = !0), u.show());
    } catch (r) {
      this.disposed || this.options.status(`选择赛道：${C1(r)}`, !0);
    } finally {
      this.finishChangingLoad(t, i);
    }
  }
  async confirmTrack(e, t) {
    if (!this.isChangingModalCurrent(e) || this.busy) return;
    const i = this.state.room,
      r =
        t.kind === "random" ? Yc.find((s) => s.groupId === t.group.id) : void 0;
    if (!(t.kind === "random" && !r)) {
      (this.trackSelect?.dispose(),
        (this.trackSelect = void 0),
        (this.modalLoading = !0));
      try {
        await this.mutate(
          t.kind === "track"
            ? {
                type: "track",
                roomId: i.roomId,
                revision: i.revision,
                trackId: t.track.id,
              }
            : {
                type: "random-track",
                roomId: i.roomId,
                revision: i.revision,
                randomTrackCode: r.code,
              },
        );
      } finally {
        this.changingModal === e && this.cancelDialog();
      }
    }
  }
  async changeRoomInfo() {
    const e = this.state.room;
    if (
      !e ||
      e.phase !== "open" ||
      e.hostId !== this.playerId ||
      this.hasModal ||
      !this.connected ||
      this.disposed
    )
      return;
    ((this.roomSettingsRoomId = e.roomId), (this.modalLoading = !0));
    const t = ++this.dialogGeneration,
      i = () =>
        !this.disposed &&
        this.connected &&
        t === this.dialogGeneration &&
        this.state.room?.roomId === e.roomId &&
        this.state.room.hostId === this.playerId &&
        this.state.room.phase === "open";
    this.render();
    try {
      const r = await this.client.request({
        type: "get-room-settings",
        roomId: e.roomId,
      });
      if (!i()) return;
      if (r.type !== "room-settings" || r.roomId !== e.roomId)
        throw new Error("房间设置响应不一致。");
      const s = await b1.roomSettings(this.dialogOptions(), e.mode, r, (o) => {
        if (!(!i() || this.busy)) {
          if (o.name === r.name && o.password === r.password) {
            this.cancelDialog();
            return;
          }
          this.submitRoomSettings(o, t);
        }
      });
      if (!i()) {
        s.dispose();
        return;
      }
      this.dialog = s;
    } catch (r) {
      i() && this.options.status(C1(r), !0);
    } finally {
      ((this.modalLoading = !1),
        t === this.dialogGeneration &&
          !this.dialog &&
          (this.roomSettingsRoomId = void 0),
        this.disposed || (this.render(), this.syncKickVoteDialog()));
    }
  }
  async submitRoomSettings(e, t) {
    const i = this.state.room;
    if (
      this.disposed ||
      !this.connected ||
      this.busy ||
      t !== this.dialogGeneration ||
      !i ||
      i.roomId !== this.roomSettingsRoomId ||
      i.hostId !== this.playerId ||
      i.phase !== "open"
    )
      return;
    ((this.manualStartAfter = performance.now() + 3e3),
      (await this.mutate({
        type: "room-settings",
        roomId: i.roomId,
        revision: i.revision,
        ...e,
      })) &&
        !this.disposed &&
        t === this.dialogGeneration &&
        (this.cancelDialog(), this.options.status("房间设置已更新。")));
  }
  async create() {
    if (!rg(this.gameplay)) {
      this.options.status("LTE 模式暂未开放。", !0);
      return;
    }
    const e = this.channelName;
    if (!e) {
      this.options.status("请先选择比赛频道。");
      return;
    }
    if (this.gameplay !== "ordinary") {
      await this.openDialog(() =>
        b1.createGameplay(
          this.dialogOptions(),
          this.gameplay,
          e,
          this.accountNickname ?? this.options.nickname,
          (t) => {
            const { mode: i, speed: r } = He[t.channelName];
            ((this.channelName = t.channelName),
              this.mutate({
                type: "create",
                ...t,
                mode: i,
                speed: r,
                speedVersion: "国服",
              }));
          },
        ),
      );
      return;
    }
    await this.openDialog(() =>
      b1.createOrdinary(
        this.dialogOptions(),
        e,
        this.accountNickname ?? this.options.nickname,
        (t) => {
          const { mode: i, speed: r } = He[t.channelName];
          ((this.channelName = t.channelName),
            this.mutate({
              type: "create",
              ...t,
              gameplay: "ordinary",
              mode: i,
              speed: r,
              speedVersion: "国服",
            }));
        },
      ),
    );
  }
  async join(e) {
    this.busy ||
      this.state.room ||
      !this.connected ||
      (this.state.allowJoin(e.roomId),
      e.locked
        ? await this.openDialog(() =>
            b1.password(this.dialogOptions(), (t) => {
              this.mutate({ type: "join", roomId: e.roomId, password: t });
            }),
          )
        : await this.mutate({ type: "join", roomId: e.roomId, password: "" }));
  }
  async quickJoin() {
    const e = this.rooms.find(
      (t) => !t.locked && !t.gaming && t.count < t.capacity,
    );
    e
      ? await this.join(e)
      : this.options.status("本页没有可快速加入的公开房间，请翻页或创建房间。");
  }
  async team() {
    const e = this.state.room,
      t = e?.members.find((r) => r.playerId === this.playerId),
      i = t?.team;
    !e ||
      !i ||
      e.mode !== "team" ||
      e.phase !== "open" ||
      (e.hostId !== this.playerId && t?.ready) ||
      this.busy ||
      this.leaving ||
      this.hasModal ||
      (await this.mutate({
        type: "team",
        roomId: e.roomId,
        revision: e.revision,
        team: i === 1 ? 2 : 1,
      }));
  }
  async confirm(e, t, i) {
    await this.openDialog(() =>
      b1.confirm(this.dialogOptions(), e, t, () => {
        (this.cancelDialog(), i());
      }),
    );
  }
}
function C1(n) {
  if (n instanceof Error) {
    if (n.message === "ROADBLOCK_NEEDS_FIVE")
      return "挡人模式至少需要五名玩家。";
    if (n.message === "TRACK_UNAVAILABLE") return "该赛道未开放当前玩法。";
    if (n.message === "RUNNER_REQUIRED")
      return "只有本局跑者可以上报到达终点。";
  }
  const e = n instanceof Error ? n.message : String(n);
  if (e === "GUEST_NAME_TAKEN") return "昵称已被使用，请换一个昵称。";
  if (e === "INVALID_GUEST_NAME") return "昵称格式不正确，请重新输入。";
  const t = {
    RACE_IN_PROGRESS: "比赛正在准备或进行中，无法修改房间。",
    NOT_ENOUGH_PLAYERS: "至少需要两名玩家。",
    TRACK_REQUIRED: "请房主先选择赛道。",
    EQUIPMENT_REQUIRED: "有玩家的装备尚未同步。",
    PLAYERS_NOT_READY: "请等待其他玩家准备，并关闭我的物品。",
    TEAM_REQUIRED: "红蓝两队都需要有玩家。",
    CLIENT_RACE_UNAVAILABLE: "有玩家尚未接入多人驾驶功能。",
    STALE_RACE: "该局比赛已经结束或取消。",
    LOAD_TIMEOUT: "有玩家加载超时，本次开赛已取消，请重新准备。",
    LOAD_FAILED: "有玩家加载失败，本次开赛已取消。",
    MEMBER_LEFT: "有玩家在开赛前离开，本次开赛已取消。",
    HOST_CANCELLED: "房主已取消本次开赛。",
    WRONG_PASSWORD: "房间密码错误，请重新输入。",
    ROOM_FULL: "房间已满，请选择其他房间。",
    ROOM_NOT_FOUND: "房间已经关闭，请刷新列表。",
    TEAM_FULL: "该队伍人数已满，请选择另一队。",
    STALE_REVISION: "房间刚刚发生变化，已刷新，请再操作一次。",
    HOST_REQUIRED: "只有房主可以执行此操作。",
    PLAYER_NOT_FOUND: "该玩家已经离开房间。",
    RESOURCE_VERSION_MISMATCH: "游戏资源版本不同，无法加入该房间。",
    ROOM_LIMIT: "房间数量已达上限，请稍后再试。",
    NOT_IN_ROOM: "你已经不在该房间中。",
    ALREADY_IN_ROOM: "你已经加入一个房间，请先退出。",
  };
  return e === "SLOT_OUTSIDE_CAPACITY"
    ? "该席位不在本房间的人数范围内。"
    : e === "SLOT_OCCUPIED"
      ? "该席位已有玩家，不能关闭。"
      : e === "VOTE_IN_PROGRESS"
        ? "已有移出投票正在进行。"
        : e === "VOTE_NOT_FOUND"
          ? "这次投票已经结束。"
          : e === "VOTE_NOT_ELIGIBLE"
            ? "你不能参与这次投票，或已经投过票。"
            : e === "PLAYER_CHANGING"
              ? "请先关闭我的物品，再准备。"
              : e === "HOST_HAS_START_BUTTON"
                ? "房主通过开始按钮发起比赛，无需准备。"
                : e === "PLAYER_READY"
                  ? "请先取消准备，再更换队伍或道具。"
                  : e === "READY_COUNTDOWN_LOCKED"
                    ? "房间倒数已进入最后三秒，不能取消准备。"
                    : e === "CHAT_RATE_LIMIT"
                      ? "发送过快，请稍后重试。"
                      : e === "VERSION_MISMATCH"
                        ? "联机前端与后端版本不一致，请同步更新。"
                        : (t[e] ?? e);
}
function Hl0(n) {
  const e = Ue(n),
    t = (n.version ?? "国服") === "国服" && e === 4 ? 4 : 7;
  return { ...n, speed: t, version: "国服", settingSpeed: 7 };
}
class ql0 {
  constructor(e) {
    this.host = e;
  }
  host;
  activeTimeAttackReady;
  activeTaskbar;
  activeSettings;
  activeTrackSelect;
  activeGarage;
  activeWindowNotice;
  readyToonEnvironment;
  multiplayer;
  disposed = !1;
  settingsOpening = !1;
  activeRandomGroup;
  randomTrackCatalog;
  randomTrackSession = new Tc0();
  dispose() {
    ((this.disposed = !0),
      this.multiplayer?.dispose(),
      (this.multiplayer = void 0),
      this.activeTimeAttackReady?.dispose(),
      this.activeTaskbar?.dispose(),
      this.activeSettings?.dispose(),
      this.activeTrackSelect?.dispose(),
      this.activeGarage?.dispose(),
      this.randomTrackSession.clear(),
      (this.activeRandomGroup = void 0),
      (this.randomTrackCatalog = void 0));
  }
  updateWindowNotice(e) {
    this.activeWindowNotice?.update(e);
  }
  getWindowNotice() {
    return this.activeWindowNotice;
  }
  setWindowNotice(e) {
    this.activeWindowNotice = e;
  }
  renderReady(e) {
    this.activeTimeAttackReady?.render(e);
  }
  refreshRecord() {
    this.activeTimeAttackReady?.refreshRecord();
  }
  releaseForRace() {
    (this.activeTimeAttackReady?.dispose(),
      (this.activeTimeAttackReady = void 0),
      this.activeTaskbar?.setVisible(!1),
      this.releaseReadyToonEnvironment());
  }
  readyModalBusy() {
    return this.host.shell.readyModalBusy;
  }
  async enterTimeAttackReady(e = this.host.getProfile()) {
    if (this.host.shell.isReadyStageOpening) return;
    const { selection: t, library: i, bgm: r } = this.readyStageContext();
    this.host.shell.beginReadyStage();
    const s = this.activeGarage;
    try {
      (s?.freeze(),
        this.activeTrackSelect?.dispose(),
        (this.activeTrackSelect = void 0),
        this.host.releaseRaceForReady());
      const o = await this.acquireReadyToonEnvironment(i);
      if (!o) return;
      const a = await i.timeAttackGarageCatalog(),
        c = b4(a.karts, t.vehicleItemId, t.vehiclePath, t.vehicleSystemKey);
      if (!c) throw new Error(`${t.vehiclePath} 缺少精确 Ready 车辆身份。`);
      const l = a.characters.find(
        (h) =>
          h.itemId === t.characterItemId &&
          h.path.toLowerCase() === t.characterPath.toLowerCase(),
      );
      if (!l) throw new Error(`${t.characterPath} 缺少精确 Ready 人物身份。`);
      this.activeTaskbar ??= await ry.load({
        library: i,
        root: this.host.root,
        onSettings: () => {
          this.openSettings();
        },
        onHover: () => this.host.getInterfaceAudio()?.playHover(),
        onActivate: () => this.host.getInterfaceAudio()?.playClick(),
        onGarage: () => {
          this.openGarageX(t, this.host.getReadyOptions());
        },
        onSinglePlayer: () => {
          this.multiplayer
            ? this.returnMultiplayerToSinglePlayer()
            : this.activeGarage && this.returnGarageToReady();
        },
        onMultiplayer: () => {
          this.openMultiplayer();
        },
      });
      const u = await ty.load({
        library: i,
        root: this.host.root,
        stageBinding: this.host.toonStageBinding,
        environment: o,
        trackPath: t.mapPath,
        trackId: t.trackId,
        randomGroup: this.activeRandomGroup,
        kart: c,
        character: l,
        profile: e,
        initialOptions: this.host.getReadyOptions(),
        recordFor: (h) =>
          this.activeRandomGroup ? void 0 : this.host.getRecordFor(h),
        onTraining: (h) => {
          this.startRaceFromReady(t, h);
        },
        onTrackSelect: (h) => {
          this.openTrackSelect(t, h);
        },
        onItemSelect: (h) => {
          this.openGarage(t, h);
        },
        onInteraction: () => {
          this.host.getAudioContext()?.resume();
        },
        onActivate: () => this.host.getInterfaceAudio()?.playClick(),
        onHover: () => this.host.getInterfaceAudio()?.playHover(),
        onStartActivate: () => this.host.getInterfaceAudio()?.playStart(),
      });
      if (o !== this.readyToonEnvironment) {
        u.dispose();
        return;
      }
      try {
        u.show();
      } catch (h) {
        throw (u.dispose(), h);
      }
      (this.activeTimeAttackReady?.dispose(),
        (this.activeTimeAttackReady = u),
        s?.dispose(),
        this.activeGarage === s && (this.activeGarage = void 0),
        this.activeTaskbar.setVisible(!0),
        r.playReady());
    } finally {
      (this.host.shell.endReadyStage(),
        s &&
          this.activeGarage === s &&
          !this.host.shell.started &&
          (s.unfreeze(),
          this.host.shell.modal || this.host.shell.openModal("garage")));
    }
  }
  async startRaceFromReady(e, t) {
    if (this.host.enterRaceStart()) {
      (this.host.setReadyOptions({ ...t }), this.host.hud.beginLoading());
      try {
        await this.host.getAudioContext()?.resume();
        const i = await this.resolveRandomSelection(e);
        if (this.disposed) return;
        (this.host.setSelection(i), await this.host.startRace(i));
      } catch (i) {
        this.disposed ||
          this.host.hud.showDebugText(
            i instanceof Error ? i.message : String(i),
            "error",
          );
      } finally {
        this.disposed ||
          (this.host.hud.finishLoading(), this.host.endRaceStart());
      }
    }
  }
  async openMultiplayer() {
    if (this.disposed || this.multiplayer) return;
    const e = this.host.getLibrary();
    if (!e) return;
    const t = this.host.shell.modal === "garage" ? this.activeGarage : void 0;
    if (!this.host.shell.enterMultiplayerLobby(t ? "garage" : "ready")) return;
    (this.host.setReadyOptions(Hl0(this.host.getReadyOptions())), t?.freeze());
    let i = !1;
    const r = new Wl0({
      library: e,
      root: this.host.root,
      nickname: im() ?? "",
      version: Bt("p3553"),
      raceLoader: this.host.multiplayerRaceLoader,
      prepareAudio: async () => {
        const s = this.host.getBgm();
        if (!s) throw Error("多人缺少 BGM owner。");
        await s.prepareMultiplayer(
          e,
          this.host.getGameOptions().mainMenuBgmPath,
        );
      },
      audioContext: () => this.host.getAudioContext(),
      onPageAudio: (s) => this.host.getBgm()?.playMultiplayer(s),
      onRaceVisibility: (s) => this.activeTaskbar?.setVisible(!s),
      initialTrackId: this.host.getSelection()?.trackId,
      initialEquipment: zw(this.host.getProfile()),
      initial: this.host.getProfile().initial,
      garage: {
        options: () => this.multiplayerGarageOptions(),
        apply: (s) => this.applyMultiplayerGarage(s),
      },
      speed: (s, o) => {
        (this.host.setReadyOptions({
          ...this.host.getReadyOptions(),
          speed: o === "国服" && s === 4 ? 4 : 7,
          version: o,
          settingSpeed: s,
        }),
          this.activeSettings?.setRoomSpeed(s, o));
      },
      status: (s, o) => {
        o && this.host.hud.showDebugText(s, "error");
      },
      autoReadyEnabled: () => this.host.getGameOptions().autoReady,
      toggleAutoReady: () => {
        const s = this.host.getGameOptions(),
          o = !s.autoReady;
        return (
          this.host.setGameOptions({ ...s, autoReady: o }),
          this.host.saveGameOptions(),
          o
        );
      },
      onVisible: () => {
        ((i = !0),
          this.activeTimeAttackReady?.hide(),
          t &&
            this.activeGarage === t &&
            (t.dispose(), (this.activeGarage = void 0)));
      },
      trackFavorites: {
        ids: (s) => nT(this.host.getProfile().favoriteTracks, s),
        count: () => this.host.getProfile().favoriteTracks.length,
        change: (s, o) => this.changeFavoriteTrack(s, o),
      },
      onNotice: (s, o, a) => {
        ((this.activeWindowNotice ??= new ds(this.host.root)),
          this.activeWindowNotice.show(s, o, a, 2e3));
      },
      onHover: () => this.host.getInterfaceAudio()?.playHover(),
      onStartActivate: () => this.host.getInterfaceAudio()?.playStart(),
      onActivate: () => this.host.getInterfaceAudio()?.playClick(),
    });
    ((this.multiplayer = r), this.activeTimeAttackReady?.freeze());
    try {
      if ((await r.open(), this.multiplayer !== r || this.disposed)) return;
    } catch (s) {
      if (this.multiplayer !== r) return;
      const o = s instanceof Error && s.message === "ACCOUNT_CANCELLED";
      (t && !i
        ? ((this.multiplayer = void 0),
          r.dispose(),
          this.host.shell.restoreGarageFromMultiplayerLobby(),
          t.unfreeze(),
          this.activeTimeAttackReady?.unfreeze())
        : i
          ? this.closeMultiplayer()
          : ((this.multiplayer = void 0),
            r.dispose(),
            this.host.shell.leaveMultiplayerLobby(),
            this.activeTimeAttackReady?.unfreeze(),
            this.activeTimeAttackReady?.show()),
        o ||
          this.host.hud.showDebugText(
            `多人游戏：${s instanceof Error ? s.message : String(s)}`,
            "error",
          ));
    }
  }
  async multiplayerGarageOptions() {
    const e = this.host.getLibrary(),
      t = this.readyToonEnvironment,
      i = this.host.getSelection();
    if (!e || !t || i?.vehicleItemId === void 0 || !i.characterItemId)
      throw new Error("房间选车缺少资源或当前装备身份。");
    return {
      library: e,
      environment: t,
      root: this.host.root,
      stageBinding: this.host.toonStageBinding,
      catalog: await e.timeAttackGarageCatalog(),
      profile: this.host.getProfile(),
      selectedKartItemId: i.vehicleItemId,
      selectedKartSystemKey: i.vehicleSystemKey,
      selectedKartPath: i.vehiclePath,
      selectedCharacterItemId: i.characterItemId,
      onFavoriteChange: (r) => this.changeFavoriteItems(r),
      onHover: () => this.host.getInterfaceAudio()?.playHover(),
      onActivate: () => this.host.getInterfaceAudio()?.playClick(),
      onInteraction: () => {
        this.host.getAudioContext()?.resume();
      },
      onNotice: (r, s, o) => {
        ((this.activeWindowNotice ??= new ds(this.host.root)),
          this.activeWindowNotice.show(r, s, o));
      },
    };
  }
  applyMultiplayerGarage(e) {
    const t = this.host.getSelection();
    if (t) {
      (this.host.setSelection({
        ...t,
        vehiclePath: e.kart.path,
        vehicleItemId: e.kart.itemId,
        vehicleSystemKey: e.kart.systemKey,
        characterPath: e.character.path,
        characterItemId: e.character.itemId,
      }),
        this.host.setVehicleTitle(e.kart.title),
        this.host.setProfile({
          ...this.host.getProfile(),
          equipment: e.equipment,
        }));
      try {
        this.host.saveProfile();
      } catch (i) {
        this.host.hud.showDebugText(
          `本次装备选择未保存：${String(i)}`,
          "error",
        );
      }
    }
  }
  async returnMultiplayerToSinglePlayer() {
    const e = this.multiplayer;
    !e ||
      this.activeSettings ||
      this.settingsOpening ||
      ((await e.leaveRoom("single-player")) &&
        !this.disposed &&
        this.multiplayer === e &&
        this.closeMultiplayer());
  }
  networkDiagnostics() {
    return this.multiplayer?.networkDiagnostics() ?? [];
  }
  closeMultiplayer(e = !0, t = !0) {
    const i = this.multiplayer;
    i &&
      (this.closeSettings(),
      (this.multiplayer = void 0),
      i.dispose(),
      this.host.shell.current === "MultiplayerLobby" &&
        this.host.shell.leaveMultiplayerLobby(),
      t &&
        (this.activeTimeAttackReady?.unfreeze(),
        this.activeTimeAttackReady?.show(),
        this.host.getBgm()?.playReady()),
      e && this.enterTimeAttackReady().catch((r) => this.showGarageError(r)));
  }
  readyStageContext() {
    const e = this.host.getSelection();
    if (
      !e?.mapPath ||
      !e.trackId ||
      !e.vehiclePath ||
      e.vehicleItemId === void 0 ||
      !e.characterPath ||
      !e.characterItemId
    )
      throw new Error("Ready 缺少当前赛道、车辆或人物身份。 ");
    const t = this.host.getLibrary();
    if (!t) throw new Error("Ready 缺少资源库。 ");
    const i = this.host.getBgm();
    if (!i) throw new Error("Ready 缺少全局 BGM owner。 ");
    return { selection: e, library: t, bgm: i };
  }
  async acquireReadyToonEnvironment(e) {
    if (this.readyToonEnvironment) return this.readyToonEnvironment;
    const t = await rn.load(e);
    if (this.host.shell.started) {
      t.dispose();
      return;
    }
    return ((this.readyToonEnvironment = t), t);
  }
  async openTrackSelect(e, t) {
    if (this.readyModalBusy()) return;
    const i = this.host.getLibrary();
    if (!i || !e.trackId) {
      this.host.hud.showDebugText(
        "SelectTrackEx 缺少资源库或当前赛道身份。",
        "error",
      );
      return;
    }
    this.host.shell.openModal("track-select");
    try {
      const r = await i.timeAttackTrackCatalog();
      let s = [],
        o = new Map();
      try {
        ((s = await i.timeAttackRandomTrackGroups()),
          s.length > 0 && (o = await i.timeAttackRandomTrackNames()));
      } catch (l) {
        this.showTrackSelectError(
          new Error(
            `随机赛道功能不可用：${l instanceof Error ? l.message : String(l)}`,
          ),
        );
      }
      this.randomTrackCatalog = r;
      let a;
      const c = () => {
        (a.dispose(),
          this.activeTrackSelect === a && (this.activeTrackSelect = void 0),
          this.host.shell.modal === "track-select" &&
            this.host.shell.closeModal("track-select"));
      };
      ((a = await _7.load({
        library: i,
        root: this.host.root,
        tracks: r,
        selectedTrackId: e.trackId,
        randomGroups: s,
        randomTrackNames: o,
        selectedRandomGroupId: this.activeRandomGroup?.id,
        favoriteTrackIds: nT(this.host.getProfile().favoriteTracks, r),
        getFavoriteCount: () => this.host.getProfile().favoriteTracks.length,
        onFavoriteChange: (l, u) => {
          const h = r.find((d) => d.id === l);
          this.changeFavoriteTrack(h, u);
        },
        onConfirm: (l) => {
          (c(), this.selectReadyChoice(e, t, l, r));
        },
        onCancel: c,
        onInteraction: () => {
          this.host.getAudioContext()?.resume();
        },
        onError: (l) => this.showTrackSelectError(l),
        onNotice: (l, u, h) => {
          ((this.activeWindowNotice ??= new ds(this.host.root)),
            this.activeWindowNotice.show(l, u, h, 2e3));
        },
      })),
        (this.activeTrackSelect = a),
        a.show());
    } catch (r) {
      (this.showTrackSelectError(r),
        this.host.shell.modal === "track-select" &&
          this.host.shell.closeModal("track-select"));
    }
  }
  selectReadyTrack(e, t, i) {
    ((this.activeRandomGroup = void 0),
      this.randomTrackSession.selectGroup(void 0),
      this.host.setReadyOptions({ ...t }),
      this.host.setSelection({ ...e, mapPath: i.path, trackId: i.id }),
      this.host
        .enterTimeAttackReady()
        .catch((r) => this.showTrackSelectError(r)));
  }
  selectReadyChoice(e, t, i, r) {
    if (i.kind === "track") {
      this.selectReadyTrack(e, t, i.track);
      return;
    }
    const s = r.find(
      (o) => i.group.trackIds.includes(o.id) && LR(i.group, o.gameType),
    );
    if (!s) {
      this.showTrackSelectError(
        new Error(`随机池 ${i.group.id} 没有可加载的预览赛道。`),
      );
      return;
    }
    ((this.activeRandomGroup = i.group),
      this.randomTrackSession.selectGroup(i.group.id),
      (this.randomTrackCatalog = r),
      this.host.setReadyOptions({ ...t, showGhost: !1 }),
      this.host.setSelection({ ...e, mapPath: s.path, trackId: s.id }),
      this.host
        .enterTimeAttackReady()
        .catch((o) => this.showTrackSelectError(o)));
  }
  async resolveRandomSelection(e) {
    const t = this.activeRandomGroup;
    if (!t) return e;
    const i = this.host.getLibrary();
    if (!i) throw new Error("随机赛道启动缺少资源库。");
    const r = this.randomTrackCatalog ?? (await i.timeAttackTrackCatalog());
    this.randomTrackCatalog = r;
    const s = this.randomTrackSession.pick(t, r);
    return { ...e, mapPath: s.path, trackId: s.id };
  }
  changeFavoriteTrack(e, t) {
    const i = IP(e),
      r = this.host.getProfile(),
      s = r.favoriteTracks.filter(
        (o) => o.themeId !== i.themeId || o.trackId !== i.trackId,
      );
    this.host.setProfile({ ...r, favoriteTracks: t ? [...s, i] : s });
    try {
      this.host.saveProfile();
    } catch (o) {
      this.host.hud.showDebugText(
        `本次地图收藏变更未保存：${String(o)}`,
        "error",
      );
    }
  }
  changeFavoriteItems(e) {
    this.host.setProfile({ ...this.host.getProfile(), favoriteItems: e });
    try {
      this.host.saveProfile();
    } catch (t) {
      this.host.hud.showDebugText(
        `本次道具星标变更未保存：${String(t)}`,
        "error",
      );
    }
  }
  async openGarage(e, t) {
    if (this.readyModalBusy()) return;
    const i = this.host.getLibrary(),
      r = this.readyToonEnvironment;
    if (
      !i ||
      !r ||
      !e.vehiclePath ||
      e.vehicleItemId === void 0 ||
      !e.characterPath ||
      !e.characterItemId
    ) {
      this.showGarageError("GarageDialog 缺少资源库或当前装备身份。");
      return;
    }
    this.host.shell.openModal("garage");
    try {
      const s = await i.timeAttackGarageCatalog();
      let o;
      const a = () => {
        (o.dispose(),
          this.activeGarage === o && (this.activeGarage = void 0),
          this.host.shell.modal === "garage" &&
            this.host.shell.closeModal("garage"));
      };
      ((o = await C7.load({
        library: i,
        root: this.host.root,
        stageBinding: this.host.toonStageBinding,
        environment: r,
        catalog: s,
        profile: this.host.getProfile(),
        selectedKartItemId: e.vehicleItemId,
        selectedCharacterItemId: e.characterItemId,
        onConfirm: (c) => {
          (a(), this.host.selectReadyGarage(e, t, c));
        },
        onCancel: a,
        onFavoriteChange: (c) => this.changeFavoriteItems(c),
        onHover: () => this.host.getInterfaceAudio()?.playHover(),
        onActivate: () => this.host.getInterfaceAudio()?.playClick(),
        onInteraction: () => {
          this.host.getAudioContext()?.resume();
        },
        onNotice: (c, l, u) => {
          ((this.activeWindowNotice ??= new ds(this.host.root)),
            this.activeWindowNotice.show(c, l, u));
        },
      })),
        (this.activeGarage = o),
        o.show());
    } catch (s) {
      (this.showGarageError(s),
        this.host.shell.modal === "garage" &&
          this.host.shell.closeModal("garage"));
    }
  }
  async selectReadyGarage(e, t, i) {
    const r = this.host.getVehicleTitle(),
      s = this.host.getReadyOptions(),
      o = { ...this.host.getProfile(), equipment: i.equipment };
    (this.host.setReadyOptions({ ...t }),
      this.host.setSelection({
        ...e,
        vehiclePath: i.kart.path,
        vehicleItemId: i.kart.itemId,
        vehicleSystemKey: i.kart.systemKey,
        characterPath: i.character.path,
        characterItemId: i.character.itemId,
      }),
      this.host.setVehicleTitle(i.kart.title));
    try {
      await this.host.enterTimeAttackReady(o);
    } catch (a) {
      (this.host.setSelection(e),
        this.host.setVehicleTitle(r),
        this.host.setReadyOptions(s),
        this.showGarageError(a));
      return;
    }
    this.host.setProfile(o);
    try {
      this.host.saveProfile();
    } catch (a) {
      this.host.hud.showDebugText(`本次装备选择未保存：${String(a)}`, "error");
    }
  }
  async openGarageX(e, t) {
    const i = this.multiplayer,
      r = () => {
        i && this.enterTimeAttackReady().catch((c) => this.showGarageError(c));
      };
    if (i) {
      if (
        this.disposed ||
        this.activeSettings ||
        this.settingsOpening ||
        i.hasModal ||
        this.host.shell.current !== "MultiplayerLobby" ||
        !(await i.leaveRoom("garage")) ||
        this.disposed ||
        this.multiplayer !== i ||
        (this.closeMultiplayer(!1, !1), this.disposed)
      )
        return;
      ((e = this.host.getSelection() ?? e), (t = this.host.getReadyOptions()));
    }
    if (this.readyModalBusy()) {
      r();
      return;
    }
    const s = this.host.getLibrary(),
      o = this.readyToonEnvironment;
    if (
      !s ||
      !o ||
      e.vehicleItemId === void 0 ||
      e.characterItemId === void 0
    ) {
      r();
      return;
    }
    if (!this.host.shell.openModal("garage")) {
      r();
      return;
    }
    const a = this.activeTimeAttackReady;
    a?.freeze();
    try {
      const { GarageXView: c } = await El(async () => {
          const { GarageXView: u } = await import("./GarageXView-DSeU5AUN.js");
          return { GarageXView: u };
        }, []),
        l = await c.load({
          library: s,
          taskbar: this.activeTaskbar,
          environment: o,
          catalog: await s.timeAttackGarageCatalog(),
          root: this.host.root,
          stageBinding: this.host.toonStageBinding,
          profile: this.host.getProfile(),
          speed: y6(t),
          version: t.version ?? ze,
          selectedKartItemId: e.vehicleItemId,
          selectedCharacterItemId: e.characterItemId,
          onChange: (u) => this.applyImmediateGarageSelection(e, t, u),
          onNotice: (u, h, d) => {
            ((this.activeWindowNotice ??= new ds(this.host.root)),
              this.activeWindowNotice.show(u, h, d));
          },
          onInteraction: () => {
            this.host.getAudioContext()?.resume();
          },
          onHover: () => this.host.getInterfaceAudio()?.playHover(),
          onActivate: () => this.host.getInterfaceAudio()?.playClick(),
        });
      if (o !== this.readyToonEnvironment)
        throw (l.dispose(), new Error("车库环境在页面切换期间已失效。"));
      (a?.dispose(),
        this.activeTimeAttackReady === a &&
          (this.activeTimeAttackReady = void 0),
        (this.activeGarage = l),
        l.show(),
        this.host.getBgm()?.playGarage());
    } catch (c) {
      (a?.unfreeze(),
        this.showGarageError(c),
        this.host.shell.modal === "garage" &&
          this.host.shell.closeModal("garage"),
        this.enterTimeAttackReady());
    }
  }
  returnGarageToReady() {
    (this.host.shell.modal === "garage" && this.host.shell.closeModal("garage"),
      this.enterTimeAttackReady().catch((e) => this.showGarageError(e)));
  }
  applyImmediateGarageSelection(e, t, i) {
    (this.host.setReadyOptions({ ...t }),
      this.host.setSelection({
        ...e,
        vehiclePath: i.kart.path,
        vehicleItemId: i.kart.itemId,
        vehicleSystemKey: i.kart.systemKey,
        characterPath: i.character.path,
        characterItemId: i.character.itemId,
      }),
      this.host.setVehicleTitle(i.kart.title),
      this.host.setProfile({
        ...this.host.getProfile(),
        equipment: i.equipment,
        garage: i.garage ?? this.host.getProfile().garage,
      }));
    try {
      this.host.saveProfile();
    } catch (r) {
      this.host.hud.showDebugText(`本次车库变更未保存：${String(r)}`, "error");
    }
  }
  showGarageError(e) {
    this.host.hud.showDebugText(
      `GarageDialog fail-closed：${e instanceof Error ? e.message : String(e)}`,
      "error",
    );
  }
  async openSettings() {
    const e = this.multiplayer;
    if (
      this.settingsOpening ||
      this.activeSettings ||
      this.disposed ||
      e?.hasModal ||
      (!e && (this.readyModalBusy() || !this.activeTimeAttackReady))
    )
      return;
    const { library: t } = this.readyStageContext();
    (e || this.host.shell.openModal("settings"), (this.settingsOpening = !0));
    try {
      (await this.host.getAudioContext()?.resume(),
        this.host.getInterfaceAudio()?.playClick());
      const i = await oy.load({
        library: t,
        root: this.host.root,
        initial: this.host.getGameOptions(),
        initialSpeed: e
          ? Ue(this.host.getReadyOptions())
          : (this.host.getReadyOptions().settingSpeed ?? E4),
        initialVersion: this.host.getReadyOptions().version ?? ze,
        speedLocked: !!e,
        onPreview: (r) => this.host.previewSettings(r),
        onConfirm: (r, s, o) => this.host.confirmSettings(r, s, o),
        onCancel: () => this.host.closeSettings(),
        onActivate: () => this.host.getInterfaceAudio()?.playClick(),
      });
      if (this.disposed || e !== this.multiplayer) {
        i.dispose();
        return;
      }
      (e &&
        i.setRoomSpeed(
          Ue(this.host.getReadyOptions()),
          this.host.getReadyOptions().version ?? ze,
        ),
        (this.activeSettings = i));
    } catch (i) {
      (this.host.hud.showDebugText(`设置窗口：${String(i)}`, "error"),
        this.host.shell.modal === "settings" &&
          this.host.shell.closeModal("settings"));
    } finally {
      this.settingsOpening = !1;
    }
  }
  previewSettings(e) {
    this.host.getAudioContext() &&
      this.host.applyAudioOptions({
        ...e,
        enableRoadSound: this.host.getGameOptions().enableRoadSound,
      });
  }
  confirmSettings(e, t, i) {
    if (this.multiplayer) {
      const c =
        this.host.getGameOptions().mainMenuBgmPath !== e.mainMenuBgmPath;
      if (
        (this.host.setGameOptions({ ...e }),
        this.host.applyInputKeyMap(e),
        this.host.saveGameOptions(),
        this.host.closeSettings(),
        this.multiplayer.refreshAutoReady(),
        c)
      ) {
        const l = this.host.getLibrary(),
          u = this.host.getBgm(),
          h = this.multiplayer;
        l &&
          u &&
          h &&
          u
            .prepareMultiplayer(l, e.mainMenuBgmPath)
            .then(() => {
              this.multiplayer === h &&
                !h.isInRoom &&
                u.playMultiplayer("lobby");
            })
            .catch((d) =>
              this.host.hud.showDebugText(`主页面音乐：${String(d)}`, "error"),
            );
      }
      return;
    }
    const r = $v(i, t);
    (this.host.setGameOptions({ ...e }),
      this.host.applyInputKeyMap(e),
      this.host.saveGameOptions());
    const s = this.host.getReadyOptions(),
      o = { ...s, version: i, settingSpeed: r },
      a = Ue(o) !== Ue(s);
    (this.host.setReadyOptions(o),
      this.host.closeSettings(),
      a && this.publishRaceSpeedChannel());
  }
  publishRaceSpeedChannel() {
    if (this.activeGarage) {
      this.returnGarageToReady();
      return;
    }
    const e = this.host.getReadyOptions();
    this.activeTimeAttackReady?.setSpeedChannel({
      version: e.version ?? ze,
      settingSpeed: e.settingSpeed ?? E4,
    });
  }
  saveGameOptions() {
    try {
      ua0(this.host.getGameOptions());
    } catch (e) {
      this.host.hud.showDebugText(`本次游戏设置未保存：${String(e)}`, "error");
    }
  }
  closeSettings() {
    (this.host.getAudioContext() &&
      this.host.applyAudioOptions(this.host.getGameOptions()),
      this.activeSettings?.dispose(),
      (this.activeSettings = void 0),
      this.host.shell.modal === "settings" &&
        this.host.shell.closeModal("settings"));
  }
  showTrackSelectError(e) {
    this.host.hud.showDebugText(
      `SelectTrackEx fail-closed：${e instanceof Error ? e.message : String(e)}`,
      "error",
    );
  }
  handleReadyShortcut(e) {
    return this.multiplayer?.handleRoomShortcut(e)
      ? !0
      : e.code !== "F5" || !this.activeTimeAttackReady
        ? !1
        : (e.preventDefault(),
          this.multiplayer
            ? (!this.activeSettings &&
                !this.settingsOpening &&
                this.multiplayer.quickJoinShortcut(),
              !0)
            : (this.readyModalBusy() ||
                this.activeTimeAttackReady.activateTrainingShortcut(),
              !0));
  }
  releaseReadyToonEnvironment() {
    (this.activeWindowNotice?.dispose(), (this.activeWindowNotice = void 0));
    const e = this.readyToonEnvironment;
    e &&
      (this.host.toonStageBinding.retain(e),
      e.dispose(),
      (this.readyToonEnvironment = void 0));
  }
}
function xl(n, e = Br) {
  const t = xP(n);
  return t === void 0
    ? []
    : ut.filter(({ index: i }) => e[i] === t).map(({ action: i }) => i);
}
const Kl0 = 31;
class jl0 {
  records = [];
  keyboardRecordCount = 0;
  transitions = [];
  releasedKeys = new Set();
  keyboardActions = new Set();
  touchActions = new Set();
  cancelled = !1;
  enabled = !0;
  keyMap = Br;
  constructor() {
    (window.addEventListener("keydown", this.onKeyDown, { passive: !1 }),
      window.addEventListener("keyup", this.onKeyUp, { passive: !1 }),
      document.addEventListener("focusin", this.onFocusIn));
  }
  drain(e) {
    for (const r of this.records.splice(0))
      if ("code" in r) {
        const s = `keyboard:${r.code}`;
        (e?.[r.code] ?? xl(r.code, this.keyMap)).forEach((a) =>
          this.append(s, a, r.down),
        );
      } else this.applyTouchAction(r.action, r.down);
    this.keyboardRecordCount = 0;
    const t = this.transitions.splice(0),
      i = this.cancelled;
    return ((this.cancelled = !1), { transitions: t, cancelled: i });
  }
  get isEnabled() {
    return this.enabled;
  }
  setKeyMap(e) {
    this.keyMap = e;
  }
  setTouchAction(e, t) {
    this.enabled && this.records.push({ action: e, down: t });
  }
  applyTouchAction(e, t) {
    this.touchActions.has(e) !== t &&
      (t ? this.touchActions.add(e) : this.touchActions.delete(e),
      !this.keyboardActions.has(e) &&
        this.transitions.push({
          source: `touch:${e}`,
          sourceKind: "touch",
          action: e,
          down: t,
        }));
  }
  setEnabled(e) {
    this.enabled !== e && ((this.enabled = e), e || this.cancelAll());
  }
  cancelAll() {
    (this.cancelGameplayInput(), this.releasedKeys.clear());
  }
  dispose() {
    (window.removeEventListener("keydown", this.onKeyDown),
      window.removeEventListener("keyup", this.onKeyUp),
      document.removeEventListener("focusin", this.onFocusIn),
      (this.enabled = !1),
      this.cancelAll());
  }
  onKeyDown = (e) => {
    const t = this.isKeyboardRepeat(e);
    !this.enabled ||
      yf(e.target) ||
      (xl(e.code, this.keyMap).length > 0 && e.preventDefault(),
      !t && this.appendKeyboardRecord(e.code, !0));
  };
  onKeyUp = (e) => {
    (this.releasedKeys.add(e.code),
      !(!this.enabled || yf(e.target)) &&
        (xl(e.code, this.keyMap).length > 0 && e.preventDefault(),
        this.appendKeyboardRecord(e.code, !1)));
  };
  onFocusIn = (e) => {
    yf(e.target) && this.cancelGameplayInput();
  };
  isKeyboardRepeat(e) {
    const t = this.releasedKeys.delete(e.code);
    return e.repeat && !t;
  }
  cancelGameplayInput() {
    ((this.records.length = 0),
      (this.keyboardRecordCount = 0),
      (this.transitions.length = 0),
      this.keyboardActions.clear(),
      this.touchActions.clear(),
      (this.cancelled = !0));
  }
  appendKeyboardRecord(e, t) {
    (this.keyboardRecordCount === Kl0
      ? this.records.splice(
          this.records.findIndex((i) => "code" in i),
          1,
        )
      : this.keyboardRecordCount++,
      this.records.push({ code: e, down: t }));
  }
  append(e, t, i) {
    if (
      (i ? this.keyboardActions.add(t) : this.keyboardActions.delete(t),
      this.touchActions.has(t))
    )
      return;
    const r = { source: e, sourceKind: "keyboard", action: t, down: i };
    this.transitions.push(r);
  }
}
function yf(n) {
  return n instanceof HTMLElement
    ? n.isContentEditable ||
        n.matches("input, textarea, select, [contenteditable='true']")
    : !1;
}
class Xl0 {
  enabled = !1;
  armed = !1;
  ready = !1;
  setEnabled(e) {
    ((this.enabled = e), e || this.cancel());
  }
  setRaceState(e, t) {
    ((this.ready = e && t), e || this.cancel());
  }
  cancel() {
    this.armed = !1;
  }
  isActive(e) {
    return this.isEngaged() && e.reverse === 0;
  }
  apply(e) {
    return this.isEngaged() ? { ...e, forward: e.reverse > 0 ? 0 : 1 } : e;
  }
  dispatch(e, t, i, r) {
    if (
      (t.sourceKind === "keyboard" && t.down && this.cancel(),
      e.kind === "forward-down")
    ) {
      this.pressForward(t, i, r);
      return;
    }
    this.dispatchRelease(e, i, r);
  }
  dispatchRelease(e, t, i) {
    (e.kind === "reverse-down" && this.isEngaged() && i({ kind: "forward-up" }),
      !(e.kind === "forward-up" && this.isActive(t)) && i(e));
  }
  pressForward(e, t, i) {
    (e.sourceKind !== "keyboard" && this.enabled && (this.armed = !0),
      !(this.isEngaged() && t.reverse > 0) && i({ kind: "forward-down" }));
  }
  isEngaged() {
    return this.enabled && this.armed && this.ready;
  }
}
const Yl0 = 200;
class Zl0 {
  mode = "off";
  buffered = !1;
  bufferedAtMs = 0;
  getMode() {
    return this.mode;
  }
  setMode(e) {
    ((this.mode = e), e !== "manual" && this.cancel());
  }
  cancel() {
    this.buffered = !1;
  }
  press(e, t, i) {
    return this.mode === "off"
      ? !1
      : (!e.tryConsumeNormalBooster(t) &&
          this.mode === "manual" &&
          ((this.buffered = !0), (this.bufferedAtMs = Math.trunc(i) >>> 0)),
        !0);
  }
  update(e, t) {
    if (this.mode === "off") {
      e.cancelNitroSeamless();
      return;
    }
    if (this.mode === "auto") {
      e.queueNitroSeamless();
      return;
    }
    if (!this.buffered) {
      e.cancelNitroSeamless();
      return;
    }
    if (((Math.trunc(t) >>> 0) - this.bufferedAtMs) >>> 0 > Yl0) {
      ((this.buffered = !1), e.cancelNitroSeamless());
      return;
    }
    e.queueNitroSeamless();
  }
}
class Ql0 {
  previous = new Set();
  enabled = !0;
  setEnabled(e) {
    this.enabled !== e && ((this.enabled = e), e || this.reset());
  }
  reset() {
    this.previous.clear();
  }
  poll(e, t) {
    const i = this.enabled ? Hg(e) : new Set(),
      r = [];
    for (const s of ut) {
      const o = t[s.index];
      if (o === void 0 || o === Ga) continue;
      const a = this.previous.has(o),
        c = i.has(o);
      a !== c &&
        r.push({
          source: `gamepad:${o}`,
          sourceKind: "gamepad",
          action: s.action,
          down: c,
        });
    }
    return ((this.previous = i), r);
  }
}
var Ne = ((n) => (
  (n[(n.Bootstrap = 0)] = "Bootstrap"),
  (n[(n.Countdown = 1)] = "Countdown"),
  (n[(n.Racing = 2)] = "Racing"),
  (n[(n.FinishAccepted = 3)] = "FinishAccepted"),
  (n[(n.Result = 4)] = "Result"),
  (n[(n.Paused = 5)] = "Paused"),
  n
))(Ne || {});
function Jl0(n) {
  return n >= 1 && n <= 4;
}
function Un(n) {
  return n.finishAtMs !== 0;
}
function e60(n) {
  return n.phase !== 5;
}
function t60(n) {
  return !Un(n) && (n.phase === 1 || n.phase === 2);
}
