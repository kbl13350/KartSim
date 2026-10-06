class _L {
  constructor(e, t, i, r, s) {
    if (
      ((this.renderScene = i),
      (this.skydomeScene = r),
      (this.lensFlare = s),
      e.sections.length === 0)
    )
      throw new Error("导入赛道缺少原版 RouteSection 图。");
    if (!e.sections[e.firstSection] || !e.sections[e.lastSection])
      throw new Error("原版路线图首尾索引无效。");
    if (
      (e.sections.forEach((o, a) => {
        for (const c of [...o.outgoing, ...o.incoming])
          if (!e.sections[c.section])
            throw new Error(`路线段 ${a} 含越界 edge target ${c.section}。`);
      }),
      (this.data = e),
      (this.triangleObbQuery = e.resourceVersion === "p3553" ? Oo : Ai0),
      (this.cameraFar = i?.settings?.cameraFar),
      (this.fog = i?.settings?.fog),
      (this.group.name = `track:${e.trackId}`),
      (this.group.matrixAutoUpdate = !1),
      (this.group.matrixWorldNeedsUpdate = !1),
      (this.sections = e.sections),
      e.roadIssues.length > 0 || e.deferredRoadTriangles.length > 0)
    )
      throw new Error(
        "赛道包含尚未接入已证 consumer 的 road descriptor，已停止建立运行时查询。",
      );
    if (e.runtimeIssues.length > 0)
      throw new Error(
        `赛道包含尚未接入的原版 runtime object：${e.runtimeIssues[0]}。`,
      );
    if (e.collisionTriangles.some((o) => !!Ri(o.roadDescriptor))) {
      if (!e.railConfig)
        throw new Error(
          "赛道包含 rail descriptor，但资源库缺少权威 rail.bml。",
        );
      if (e.railCaptureDistance === void 0)
        throw new Error(
          "赛道包含 rail descriptor，但 stage theme producer 未闭合，无法选择 4/10 m capture distance。",
        );
    }
    if (
      ((this.surface = new mi0(e.collisionTriangles, this.triangleObbQuery)),
      e.movingRoadTriangles?.length)
    ) {
      if (!i?.clientWorldElements)
        throw new Error("moving road 缺少上一帧 scene world matrix owner。");
      for (const o of e.movingRoadTriangles) {
        const a = Fl(o.roadDescriptor, o.origin.mesh);
        if (a) throw new Error(`moving road 拒绝 descriptor：${a}。`);
      }
      this.movingSurface = new gi0(
        e.movingRoadTriangles,
        i.clientWorldElements,
        this.triangleObbQuery,
      );
    }
    if (e.obstacleAnimators?.length) {
      if (!i?.clientWorldElements)
        throw new Error("obstacle 缺少上一轮 scene world matrix owner。");
      if (!i.clientWorldBounds)
        throw new Error("obstacle 缺少上一轮 scene world bounds owner。");
      ((this.obstacleClientWorldElements = i.clientWorldElements),
        (this.obstacleClientWorldBounds = i.clientWorldBounds));
    }
    if (e.eventRuntimes?.length) {
      if (!i?.clientWorldElements)
        throw new Error("event 缺少上一轮 scene world matrix owner。");
      this.eventClientWorldElements = i.clientWorldElements;
    }
    (e.obstacleTriangles?.length &&
      (this.obstacleSurface = new eE(
        e.obstacleTriangles,
        this.triangleObbQuery,
      )),
      (t.name ||= "track.1s-scene"),
      this.group.add(t),
      s && this.group.add(s.object),
      (this.skydome = r?.object));
  }
  renderScene;
  skydomeScene;
  lensFlare;
  group = new T2();
  skydome;
  data;
  cameraFar;
  fog;
  sections;
  surface;
  movingSurface;
  obstacleClientWorldElements;
  obstacleClientWorldBounds;
  obstacleSurface;
  pendingObstacleTriangles;
  obstacleKartPaired = !1;
  obstacleKartPairs = new WeakSet();
  eventClientWorldElements;
  pendingEventRuntimes;
  activeEventRuntimes = [];
  expiredEventEffects = [];
  routeStates = new WeakMap();
  triangleObbQuery;
  updateRender(e, t, i, r) {
    (this.renderScene?.update(e, t, i, r),
      this.skydomeScene?.update(e, t, i, r),
      this.lensFlare?.update(t, i, r));
  }
  setLensFlareEnabled(e) {
    this.lensFlare?.setEnabled(e);
  }
  resetRender(e, t, i, r) {
    (this.renderScene?.reset(e),
      this.skydomeScene?.reset(e),
      this.lensFlare?.reset(),
      this.updateRender(e, t, i, r),
      this.movingSurface?.rebase(),
      this.data.eventRuntimes?.forEach((s) => s.reset()),
      (this.pendingEventRuntimes = void 0),
      (this.activeEventRuntimes = []),
      (this.expiredEventEffects = []));
  }
  updateMovingRoads(e) {
    this.movingSurface?.update(e);
  }
  queryObb(e) {
    return [
      ...(this.movingSurface?.queryObb(e) ?? []),
      ...this.surface.queryObb(e),
    ];
  }
  queryObstacleObb(e) {
    return this.obstacleSurface?.queryObb(e) ?? [];
  }
  updateObstacles(e, t) {
    this.data.obstacleAnimators?.length &&
      ((this.pendingObstacleTriangles = void 0),
      this.data.obstacleAnimators.forEach((i) => {
        const r =
          this.data.resourceVersion === "p3553"
            ? this.obstacleKartPairs.has(i)
            : this.obstacleKartPaired;
        i.update(
          e,
          this.obstacleClientWorldElements,
          this.obstacleClientWorldBounds,
          r ? t : void 0,
        );
      }));
  }
  registerObstaclePair(e) {
    if (!this.data.obstacleAnimators?.length) return;
    this.obstacleKartPaired = !0;
    const t = [];
    let i = 0;
    for (const r of this.data.obstacleAnimators) {
      if (this.data.resourceVersion === "p3553") this.obstacleKartPairs.add(r);
      else if (i >= 8) break;
      const s = r.registrationCenter(),
        o = t0(r.modelRadius() * 4),
        a = t0(s.x - e.x),
        c = t0(s.y - e.y),
        l = t0(s.z - e.z);
      !(t0(t0(t0(a * a) + t0(l * l)) + t0(c * c)) < t0(o * o)) ||
        i >= 8 ||
        (t.push(...r.updateSnapshot()), (i += 1));
    }
    this.pendingObstacleTriangles = t;
  }
  commitObstacleSnapshot() {
    this.data.obstacleAnimators?.length &&
      ((this.obstacleSurface = this.pendingObstacleTriangles?.length
        ? new eE(this.pendingObstacleTriangles, this.triangleObbQuery)
        : void 0),
      (this.pendingObstacleTriangles = void 0));
  }
  updateEvents(e) {
    this.data.eventRuntimes?.forEach((t) =>
      t.slot12(e, this.eventClientWorldElements),
    );
  }
  registerEventPairs(e, t) {
    if (!this.data.eventRuntimes?.length) return;
    const i = [];
    for (const r of this.data.eventRuntimes)
      r.registerKartPair(e) && i.length < 8 && i.push(r);
    (this.expireEventEffects(t), (this.pendingEventRuntimes = i));
  }
  expireEventEffects(e) {
    this.data.eventRuntimes?.forEach((t) => {
      this.expiredEventEffects.push(...t.expireEffects(e));
    });
  }
  consumeExpiredEventEffects() {
    const e = this.expiredEventEffects;
    return ((this.expiredEventEffects = []), e);
  }
  commitEventSnapshot() {
    this.data.eventRuntimes?.length &&
      ((this.activeEventRuntimes = this.pendingEventRuntimes ?? []),
      (this.pendingEventRuntimes = void 0));
  }
  queryEventObb(e, t) {
    const i = [];
    for (const r of this.activeEventRuntimes) {
      const s = r.firstOverlap(e, t);
      s && i.push(s);
    }
    return i;
  }
  rayQuery(e, t, i) {
    const r = this.movingSurface,
      s = r === void 0 ? Number.POSITIVE_INFINITY : r.queryBest(e, t, i),
      o = this.surface.queryBest(e, t, i),
      a = r === void 0 || o < s,
      c = a ? o : s,
      l = this.obstacleSurface,
      u = l === void 0 ? Number.POSITIVE_INFINITY : l.queryBest(e, t, i);
    return c === Number.POSITIVE_INFINITY || u < c
      ? l === void 0 || u === Number.POSITIVE_INFINITY
        ? void 0
        : l.buildHit(e, t, u)
      : a
        ? this.surface.buildHit(e, t, o)
        : r.buildHit(e, t, s);
  }
  getStart() {
    return this.data.start;
  }
  prepareCurrentSectionReset(e) {
    const t = this.requireRouteState(e),
      i = this.sections[t.section],
      r = i.frames[0];
    if (!r) throw new Error("当前路线段缺少 reset frame 0。");
    return {
      position: On(r.position, Tt(r.forward, t0(0.10000000149011612))),
      forward: I1(r.forward),
      up: I1(r.up),
      surface: i.surface,
    };
  }
  commitCurrentSectionReset(e) {
    const t = this.requireRouteState(e);
    this.routeStates.set(e, {
      ...t,
      resetAux68: 0,
      resetAux74: 0,
      resetAux80: 0,
      resetAux8C: 0,
    });
  }
  getRouteState(e) {
    return this.requireRouteState(e);
  }
  currentRouteSurface(e) {
    return this.sections[this.requireRouteState(e).section].surface;
  }
  warpNextDestination(e) {
    const t = this.sections[this.requireRouteState(e).section];
    if (t.surface !== "warpnext")
      throw new Error("warpnext destination 的当前路线段类型不匹配。");
    const i = t.outgoing[0];
    if (!i) throw new Error("warpnext 路线段缺少原版 outgoing[0]。");
    const r = E5(this.sections[i.section]),
      s = N1(r.position, Tt(r.forward, rc));
    return (
      (s.z = t0(-t0(t0(-r.position.z) - t0(t0(-r.forward.z) * rc)))),
      { position: s, forward: I1(r.forward), up: I1(r.up) }
    );
  }
  completeWarpNextRailLanding(e, t) {
    const i = this.requireRouteState(e),
      r = this.sections[i.section];
    if (r.surface !== "warpnext") return !1;
    const s = r.outgoing[0];
    if (!s) throw new Error("warpnext 路线段缺少 outgoing[0]。");
    const o = this.sections[s.section];
    if (!o.surface.includes("rail")) return !1;
    t?.("warpnext:out:next", E5(r));
    const a = Math.fround(i.completedDistance + r.length),
      c =
        s.section === this.data.firstSection ||
        (s.gate.final &&
          this.data.lapTarget !== void 0 &&
          i.lap === this.data.lapTarget)
          ? i.lap + 1
          : i.lap;
    return (
      this.routeStates.set(e, {
        ...i,
        section: s.section,
        lap: c,
        localDistance: 0,
        completedDistance: a,
        distance: a,
      }),
      t?.(`${o.surface}:in:next`, E5(o)),
      !0
    );
  }
  completeRailContactLanding(e, t, i) {
    const r = this.requireRouteState(e),
      s = this.sections[r.section];
    if (s.surface.includes("rail")) return !1;
    const o = s.outgoing.filter((p) =>
      this.sections[p.section].surface.includes("rail"),
    );
    if (o.length === 0) return !1;
    const a = this.railCaptureDistance();
    let c,
      l = Math.fround(a * a);
    for (const p of o) {
      const v = this.sections[p.section].frames;
      for (let w = 0; w + 1 < v.length; w += 1) {
        const g = v[w].position,
          y = N1(v[w + 1].position, g),
          b = xt(y, y),
          A = b > 0 ? Math.max(0, Math.min(1, xt(N1(t, g), y) / b)) : 0,
          x = N1(t, On(g, Tt(y, A))),
          M = xt(x, x);
        M < l && ((l = M), (c = p));
      }
    }
    if (!c) return !1;
    const u = this.sections[c.section];
    s.surface && i?.(`${s.surface}:out:next`, E5(s));
    const h = Math.fround(r.completedDistance + s.length),
      d = this.projectSectionDistance(t, u),
      f =
        c.section === this.data.firstSection ||
        (c.gate.final &&
          this.data.lapTarget !== void 0 &&
          r.lap === this.data.lapTarget)
          ? r.lap + 1
          : r.lap;
    return (
      this.routeStates.set(e, {
        ...r,
        section: c.section,
        lap: f,
        localDistance: d,
        completedDistance: h,
        distance: Math.fround(h + d),
      }),
      i?.(`${u.surface}:in:next`, E5(u)),
      !0
    );
  }
  lookupRailConfig(e) {
    if (!this.data.railConfig)
      throw new Error("rail descriptor 缺少 rail.bml registry。");
    return f30(this.data.railConfig, e);
  }
  railCaptureDistance() {
    if (this.data.railCaptureDistance === void 0)
      throw new Error("rail capture distance 未安装。");
    return this.data.railCaptureDistance;
  }
  resetRouteState(e, t) {
    const i = this.sections[this.data.lastSection],
      r = this.projectSectionDistance(t, i);
    this.routeStates.set(e, {
      section: this.data.lastSection,
      lap: 0,
      localDistance: r,
      completedDistance: -i.length,
      distance: Math.fround(-i.length + r),
      resetAux68: 0,
      resetAux74: 0,
      resetAux80: 0,
      resetAux8C: 0,
    });
  }
  warpRouteToSection(e, t) {
    if (!this.sections[t]) throw new Error(`路线段 ${t} 不存在。`);
    const r = this.requireRouteState(e);
    this.routeStates.set(e, {
      ...r,
      section: t,
      localDistance: 0,
      distance: Math.fround(r.completedDistance),
    });
  }
  associateRoute(e, t) {
    const i = this.requireRouteState(e);
    let r = null,
      s = 999999;
    const o = (c, l, u) => {
      c < s && xt(l, On(u, Tt(l, rc))) > -xd && ((s = c), (r = null));
    };
    if (
      (this.sections.forEach((c, l) => {
        for (let u = 0; u + 1 < c.frames.length; u += 1) {
          const h = c.frames[u],
            d = c.frames[u + 1],
            f = N1(h.position, d.position),
            p = N1(t, d.position),
            v = xt(f, p);
          if (v < 0) {
            o(xt(p, p), d.up, p);
            continue;
          }
          const w = N1(t, h.position);
          if (xt(Tt(f, -1), w) < 0) {
            o(xt(w, w), h.up, w);
            continue;
          }
          const y = v / xt(f, f),
            b = On(d.position, Tt(f, y)),
            A = N1(t, b),
            x = xt(A, A);
          x < s && xt(d.up, On(A, Tt(d.up, rc))) > -xd && ((s = x), (r = l));
        }
      }),
      r === null)
    )
      return !1;
    const a = this.projectSectionDistance(t, this.sections[r]);
    return (
      this.routeStates.set(e, {
        ...i,
        section: r,
        localDistance: a,
        distance: Math.fround(i.completedDistance + a),
      }),
      !0
    );
  }
  refreshRouteProjection(e, t) {
    const i = this.requireRouteState(e),
      r = this.projectSectionDistance(t, this.sections[i.section]),
      s = {
        ...i,
        localDistance: r,
        distance: Math.fround(i.completedDistance + r),
      };
    return (this.routeStates.set(e, s), s);
  }
  sampleRoute(e, t, i = 0) {
    const r = this.requireRouteState(e);
    let s = r.section,
      o = r.localDistance,
      a = Math.fround(Math.max(0, t));
    const c = new Set();
    for (; a > 0;) {
      const h = this.sections[s];
      if (Math.fround(o + a) <= h.length) break;
      const d = Math.fround(h.length - o),
        f = Math.fround(a - d);
      if (f < a) c.clear();
      else {
        if (c.has(s))
          throw new Error("rail route lookahead 遇到无距离进展的循环。");
        c.add(s);
      }
      a = f;
      const p = h.outgoing;
      if (p.length === 0)
        throw new Error("rail route lookahead 缺少 outgoing edge。");
      ((s = p[(i >>> 0) % p.length].section), (o = 0));
    }
    o = Math.fround(o + a);
    const l = this.sections[s];
    let u = 0;
    for (let h = 0; h + 1 < l.frames.length; h += 1) {
      const d = l.frames[h],
        f = l.frames[h + 1],
        p = nE(d.position, f.position),
        v = Math.fround(u + p);
      if (o >= u && o <= v) {
        const w = Math.fround(Math.fround(o - u) / p);
        return {
          surface: l.surface,
          sampled: !0,
          point: Td(d.position, f.position, w),
          direction: Td(d.forward, f.forward, w),
          up: Td(d.up, f.up, w),
        };
      }
      u = v;
    }
    return { surface: l.surface, sampled: !1 };
  }
  updateRoute(e, t, i, r) {
    const s = this.requireRouteState(e);
    let o = s.section,
      a = s.lap,
      c = s.completedDistance,
      l = !1,
      u = 0,
      h = !1;
    for (;;) {
      let p = !1;
      const v = this.sections[o];
      for (const w of v.outgoing) {
        let g = _d(w.gate, t, i) > 0;
        if (!g) {
          const M = this.sections[w.section].outgoing;
          for (let E = 0; E < M.length; E += 1)
            if (_d(M[E].gate, t, i) > 0) {
              g = !0;
              break;
            }
        }
        if (!g) continue;
        c = Math.fround(c + v.length);
        const y = o,
          b = w.section,
          A = this.sections[y].surface,
          x = this.sections[b].surface;
        (A !== x && A && r?.(`${A}:out:next`, E5(this.sections[y])),
          (o = b),
          (o === this.data.firstSection ||
            (w.gate.final &&
              this.data.lapTarget !== void 0 &&
              s.lap === this.data.lapTarget)) &&
            (a += 1),
          this.routeStates.set(e, {
            ...s,
            section: o,
            lap: a,
            localDistance: 0,
            completedDistance: c,
            distance: c,
          }),
          A !== x && x && r?.(`${x}:in:next`, E5(this.sections[b])),
          (l = !0),
          (p = !0),
          y === o && (h = !0));
        break;
      }
      if (!p || h) break;
      if (u++ > this.sections.length * 2)
        throw new Error("route forward transition cycle 未收敛。");
    }
    if (!l)
      for (;;) {
        let p = !1;
        const v = this.sections[o];
        for (const w of v.incoming) {
          if (_d(w.gate, t, i) >= 0) continue;
          const g = o,
            y = w.section,
            b = this.sections[g].surface,
            A = this.sections[y].surface;
          (b !== A && b && r?.(`${b}:out:prev`, E5(this.sections[g])),
            (o = y),
            (c = Math.fround(c - this.sections[o].length)),
            g === this.data.firstSection && (a = a > 0 ? a - 1 : 0),
            this.routeStates.set(e, {
              ...s,
              section: o,
              lap: a,
              localDistance: 0,
              completedDistance: c,
              distance: c,
            }),
            b !== A && A && r?.(`${A}:in:prev`, E5(this.sections[y])),
            (p = !0),
            g === o && (h = !0));
          break;
        }
        if (!p || h) break;
        if (u++ > this.sections.length * 2)
          throw new Error("route reverse transition cycle 未收敛。");
      }
    const d = this.projectSectionDistance(i, this.sections[o]),
      f = {
        ...s,
        section: o,
        lap: a,
        localDistance: d,
        completedDistance: c,
        distance: Math.fround(c + d),
      };
    return (this.routeStates.set(e, f), f);
  }
  runOuterRoutePass(e, t, i, r, s = !0, o = !0) {
    return (s && o && this.updateRoute(e, t, i, r), this.requireRouteState(e));
  }
  requireRouteState(e) {
    const t = this.routeStates.get(e);
    if (!t) throw new Error("该车辆尚未建立路线状态。");
    return t;
  }
  projectSectionDistance(e, t) {
    const i = t.frames;
    if (i.length === 0) return 0;
    let r = 0;
    for (; r < i.length && !(q5(N1(e, i[r].position), i[r].forward) < 0);)
      r += 1;
    if (r === 0) return 0;
    let s = 0,
      o = 0;
    for (; o + 1 < r;)
      ((s = Math.fround(s + Math.fround(nE(i[o].position, i[o + 1].position)))),
        (o += 1));
    let a;
    if (r === i.length) a = q5(N1(e, i[o].position), i[o].forward);
    else {
      const c = N1(i[r].position, i[o].position);
      GL(c) > xd
        ? ((a = q5(N1(e, i[o].position), bi0(c))), a < 0 && (a = 0))
        : (a = q5(N1(e, i[o].position), i[o].forward));
    }
    return ((s = Math.fround(s + Math.fround(a))), s > t.length ? t.length : s);
  }
  dispose() {
    (this.lensFlare?.dispose(),
      this.renderScene?.dispose(),
      this.skydomeScene?.dispose());
    const e = new Set(),
      t = new Set();
    this.group.traverse((i) => {
      if (!(i instanceof D2)) return;
      (i.geometry.dispose(),
        (Array.isArray(i.material) ? i.material : [i.material]).forEach((s) => {
          if (!e.has(s)) {
            e.add(s);
            for (const o of Object.values(s))
              !(o instanceof D9) || t.has(o) || (t.add(o), o.dispose());
            s.dispose();
          }
        }));
    });
  }
}
class gi0 {
  constructor(e, t, i) {
    ((this.clientWorldElements = t),
      (this.triangleObbQuery = i),
      (this.triangles = e.map((r) => ({
        ...r,
        a: I1(r.a),
        b: I1(r.b),
        c: I1(r.c),
        normal: I1(r.normal),
        previousVertices: [I1(r.a), I1(r.b), I1(r.c)],
        surfaceVelocity: { x: 0, y: 0, z: 0 },
        stagedVertices: [I1(r.a), I1(r.b), I1(r.c)],
      }))),
      this.triangles.forEach((r) => this.currentVertices(r)));
  }
  clientWorldElements;
  triangleObbQuery;
  triangles;
  lastUpdateMs = 0;
  bestTriangle;
  hit = {
    point: { x: 0, y: 0, z: 0 },
    normal: { x: 0, y: 0, z: 0 },
    fraction: 0,
    roadDescriptor: void 0,
    auxiliaryDirection: { x: 0, y: 0, z: 0 },
    surfaceVelocity: { x: 0, y: 0, z: 0 },
  };
  update(e) {
    ((this.lastUpdateMs = pi0(
      this.triangles,
      (t) => this.currentVertices(t),
      Math.trunc(e),
      this.lastUpdateMs,
    )),
      this.triangles.forEach((t) => this.publishVertices(t, t.stagedVertices)));
  }
  rebase() {
    this.lastUpdateMs = 0;
    for (const e of this.triangles) {
      const t = this.currentVertices(e);
      (this.publishVertices(e, t),
        (e.previousVertices = t.map(I1)),
        (e.surfaceVelocity = { x: 0, y: 0, z: 0 }));
    }
  }
  queryBest(e, t, i) {
    this.bestTriangle = void 0;
    let r = Number.POSITIVE_INFINITY;
    for (const s of this.triangles) {
      if (!i && Math.abs(s.normal.y) < 0.6499999761581421) continue;
      const o = Av(s, e, t);
      o === void 0 || o > r || ((this.bestTriangle = s), (r = o));
    }
    return r;
  }
  buildHit(e, t, i) {
    const r = this.bestTriangle;
    if (r === void 0)
      throw new Error("MovingTrackSurface.buildHit 缺少 best triangle。");
    const s = this.hit;
    return (
      Mv(s.point, t, i),
      bv(s.point, e, s.point),
      (s.normal.x = r.normal.x),
      (s.normal.y = r.normal.y),
      (s.normal.z = r.normal.z),
      (s.fraction = i),
      (s.roadDescriptor = r.roadDescriptor),
      (s.auxiliaryDirection.x = r.auxiliaryDirection.x),
      (s.auxiliaryDirection.y = r.auxiliaryDirection.y),
      (s.auxiliaryDirection.z = r.auxiliaryDirection.z),
      (s.surfaceVelocity.x = r.surfaceVelocity.x),
      (s.surfaceVelocity.y = r.surfaceVelocity.y),
      (s.surfaceVelocity.z = r.surfaceVelocity.z),
      s
    );
  }
  queryObb(e) {
    const t = [];
    for (const i of this.triangles)
      this.triangleObbQuery(i, e) &&
        t.push({
          point: this.triangleObbQuery === Oo ? vv(i) : Rg([i.a, i.b, i.c]),
          normal: { ...i.normal },
          roadDescriptor: i.roadDescriptor,
        });
    return t.length ? t : void 0;
  }
  currentVertices(e) {
    const t = e.origin.mesh.node.vertexData?.positions,
      i = this.clientWorldElements(e.origin.mesh.node);
    if (!t || !i)
      throw new Error(
        "moving road 缺少 local vertices 或 live client-world matrix。",
      );
    const r = e.stagedVertices,
      s = e.origin.localIndices;
    for (let o = 0; o < 3; o += 1) {
      const a = t[s[o]];
      if (!a) throw new Error("moving road local vertex index 越界。");
      Mi0(r[o], a, i);
    }
    return r;
  }
  publishVertices(e, t) {
    ((e.a = t[0]), (e.b = t[1]), (e.c = t[2]));
    const i = xi0(N1(e.b, e.a), N1(e.c, e.a)),
      r = Si0(i);
    r > 0 && (e.normal = Tt(i, t0(1 / r)));
  }
}
class eE {
  constructor(e, t) {
    ((this.triangles = e), (this.triangleObbQuery = t));
  }
  triangles;
  triangleObbQuery;
  bestTriangle;
  hit = {
    point: { x: 0, y: 0, z: 0 },
    normal: { x: 0, y: 0, z: 0 },
    fraction: 0,
    auxiliaryDirection: { x: 0, y: 1, z: 0 },
    surfaceVelocity: { x: 0, y: 0, z: 0 },
    obstacleSource: !0,
  };
  queryBest(e, t, i) {
    this.bestTriangle = void 0;
    let r = Number.POSITIVE_INFINITY;
    for (const s of this.triangles) {
      if (!i && Math.abs(s.normal.y) < 0.6499999761581421) continue;
      const o = Av(s, e, t);
      o === void 0 || o >= r || ((this.bestTriangle = s), (r = o));
    }
    return r;
  }
  buildHit(e, t, i) {
    const r = this.bestTriangle;
    if (r === void 0)
      throw new Error("ObstacleSurface.buildHit 缺少 best triangle。");
    const s = this.hit;
    (Mv(s.point, t, i),
      bv(s.point, e, s.point),
      (s.normal.x = r.normal.x),
      (s.normal.y = r.normal.y),
      (s.normal.z = r.normal.z),
      (s.fraction = i),
      (s.auxiliaryDirection.x = 0),
      (s.auxiliaryDirection.y = 1),
      (s.auxiliaryDirection.z = 0));
    const o = "motion" in r ? r.motion : void 0;
    return (
      (s.surfaceVelocity.x = o ? o.x : 0),
      (s.surfaceVelocity.y = o ? o.y : 0),
      (s.surfaceVelocity.z = o ? o.z : 0),
      s
    );
  }
  queryObb(e) {
    const t = [];
    for (const i of this.triangles)
      this.triangleObbQuery(i, e) &&
        t.push({
          point:
            this.triangleObbQuery === Oo
              ? vv(i)
              : {
                  x: (i.a.x + i.b.x + i.c.x) * dl,
                  y: (i.a.y + i.b.y + i.c.y) * dl,
                  z: (i.a.z + i.b.z + i.c.z) * dl,
                },
          normal: { ...i.normal },
          motion: "motion" in i ? { ...i.motion } : { x: 0, y: 0, z: 0 },
          velFactor: "velFactor" in i ? i.velFactor : 1,
          pressMode: "pressMode" in i ? i.pressMode : void 0,
        });
    return t;
  }
}
class mi0 {
  constructor(e, t) {
    if (((this.triangleObbQuery = t), e.length === 0))
      throw new Error("导入赛道不含可用碰撞路面。");
    ((this.triangles = e.map((i) => ({
      ...i,
      minX: Math.min(i.a.x, i.b.x, i.c.x),
      maxX: Math.max(i.a.x, i.b.x, i.c.x),
      minZ: Math.min(i.a.z, i.b.z, i.c.z),
      maxZ: Math.max(i.a.z, i.b.z, i.c.z),
    }))),
      this.triangles.forEach((i, r) => {
        const s = Vm(i.roadDescriptor);
        if (s) throw new Error(`静态网格拒绝 road descriptor：${s}。`);
        const o = [i.a, i.b, i.c].map((w) => ({ x: w.x, y: -w.z })),
          a = Cd(o[0].x, o[1].x, o[2].x),
          c = Cd(o[0].y, o[1].y, o[2].y),
          l = Ed(o[0].x, o[1].x, o[2].x),
          u = Ed(o[0].y, o[1].y, o[2].y),
          h = sc(a),
          d = sc(c),
          f = sc(l),
          p = sc(u),
          v = i.normal.y < 0 ? [o[0], o[2], o[1]] : o;
        for (let w = h; w <= f; w += 4)
          for (let g = d; g <= p; g += 4) {
            const y = [
              { x: w, y: g },
              { x: w + 4, y: g },
              { x: w + 4, y: g + 4 },
              { x: w, y: g + 4 },
            ];
            if (!vi0(y, v)) continue;
            const b = Sd(w >> 2, g >> 2),
              A = this.cells.get(b);
            A ? A.push(r) : this.cells.set(b, [r]);
          }
      }));
  }
  triangleObbQuery;
  triangles;
  cells = new Map();
  rayCandidates = new Set();
  obbCandidates = [];
  obbVisited = new Set();
  obbClientBounds = [0, 0, 0, 0, 0, 0];
  bestTriangle;
  hit = {
    point: { x: 0, y: 0, z: 0 },
    normal: { x: 0, y: 0, z: 0 },
    fraction: 0,
    roadDescriptor: void 0,
    auxiliaryDirection: { x: 0, y: 0, z: 0 },
    surfaceVelocity: { x: 0, y: 0, z: 0 },
  };
  queryBest(e, t, i) {
    this.bestTriangle = void 0;
    const r = t0(e.x + t.x),
      s = t0(e.z + t.z),
      o = Re(Math.min(e.x, r)),
      a = Re(Math.max(e.x, r)),
      c = Re(-Math.max(e.z, s)),
      l = Re(-Math.min(e.z, s)),
      u = this.rayCandidates;
    u.clear();
    for (let d = c; d <= l; d += 1)
      for (let f = o; f <= a; f += 1) {
        const p = this.cells.get(Sd(f, d));
        if (p) for (let v = 0; v < p.length; v += 1) u.add(p[v]);
      }
    let h = Number.POSITIVE_INFINITY;
    for (const d of u) {
      const f = this.triangles[d];
      if (!i && Math.abs(f.normal.y) < 0.6499999761581421) continue;
      const p = Av(f, e, t);
      p === void 0 || p > h || ((this.bestTriangle = f), (h = p));
    }
    return h;
  }
  buildHit(e, t, i) {
    const r = this.bestTriangle;
    if (r === void 0)
      throw new Error("TrackSurface.buildHit 缺少 best triangle。");
    const s = this.hit;
    return (
      Mv(s.point, t, i),
      bv(s.point, e, s.point),
      (s.normal.x = r.normal.x),
      (s.normal.y = r.normal.y),
      (s.normal.z = r.normal.z),
      (s.fraction = i),
      (s.roadDescriptor = r.roadDescriptor),
      (s.auxiliaryDirection.x = r.auxiliaryDirection.x),
      (s.auxiliaryDirection.y = r.auxiliaryDirection.y),
      (s.auxiliaryDirection.z = r.auxiliaryDirection.z),
      (s.surfaceVelocity.x = 0),
      (s.surfaceVelocity.y = 0),
      (s.surfaceVelocity.z = 0),
      s
    );
  }
  queryObb(e) {
    const t = this.triangleObbQuery === Oo;
    let i, r, s, o;
    if (t)
      (di0(e, this.obbClientBounds),
        (i = Re(this.obbClientBounds[0])),
        (r = Re(this.obbClientBounds[3])),
        (s = Re(this.obbClientBounds[1])),
        (o = Re(this.obbClientBounds[4])));
    else {
      const u = e.halfExtents.reduce(
          (d, f, p) => d + f * Math.abs(e.axes[p].x),
          0,
        ),
        h = e.halfExtents.reduce((d, f, p) => d + f * Math.abs(e.axes[p].z), 0);
      ((i = Re(e.center.x - u)),
        (r = Re(e.center.x + u)),
        (s = Re(-(e.center.z + h))),
        (o = Re(-(e.center.z - h))));
    }
    const a = this.obbCandidates,
      c = this.obbVisited;
    ((a.length = 0), c.clear());
    for (let u = s; u <= o; u += 1)
      for (let h = i; h <= r; h += 1) {
        const d = this.cells.get(Sd(h, u));
        if (d)
          for (let f = 0; f < d.length; f += 1) {
            const p = d[f];
            if (!c.has(p)) {
              if (t) {
                const v = this.triangles[p];
                if (
                  Ed(v.a.y, v.b.y, v.c.y) < this.obbClientBounds[2] ||
                  this.obbClientBounds[5] < Cd(v.a.y, v.b.y, v.c.y)
                )
                  continue;
              }
              (c.add(p), a.push(p));
            }
          }
      }
    const l = [];
    for (const u of a) {
      const h = this.triangles[u];
      this.triangleObbQuery(h, e) &&
        l.push({
          point:
            this.triangleObbQuery === Oo
              ? vv(h)
              : {
                  x: (h.a.x + h.b.x + h.c.x) * 0.3333300054,
                  y: (h.a.y + h.b.y + h.c.y) * 0.3333300054,
                  z: (h.a.z + h.b.z + h.c.z) * 0.3333300054,
                },
          normal: { ...h.normal },
          roadDescriptor: h.roadDescriptor,
        });
    }
    return l;
  }
}
function Re(n) {
  return Math.trunc(t0(n * t0(0.25)));
}
const wi0 = 67108864;
function Sd(n, e) {
  return n * wi0 + e;
}
function sc(n) {
  return Re(n) * 4;
}
function Cd(n, e, t) {
  let i = n;
  return (e < i && (i = e), t < i && (i = t), i);
}
function Ed(n, e, t) {
  let i = n;
  return (e > i && (i = e), t > i && (i = t), i);
}
function vi0(n, e) {
  return tE(n, e) ? !1 : !tE(e, n);
}
function tE(n, e) {
  let t = n[n.length - 1];
  for (const i of n) {
    if (yi0(e, t, i) > 0) return !0;
    t = i;
  }
  return !1;
}
function yi0(n, e, t) {
  const i = t0(t.x - e.x),
    r = t0(t.y - e.y),
    s = t0(-i);
  let o = !1,
    a = !1;
  for (const c of n) {
    const l = t0(c.y - t.y),
      u = t0(c.x - t.x),
      h = t0(l * s),
      d = t0(u * r),
      f = t0(h + d);
    if (f === 0 || (f > 0 && (o = !0), f < 0 && (a = !0), o && a)) return 0;
  }
  return o ? 1 : -1;
}
function Ai0(n, e) {
  const t = e.axes,
    i = e.center,
    r = e.halfExtents[0],
    s = e.halfExtents[1],
    o = e.halfExtents[2],
    a = t[0],
    c = t[1],
    l = t[2],
    u = n.a.x - i.x,
    h = n.a.y - i.y,
    d = n.a.z - i.z,
    f = n.b.x - i.x,
    p = n.b.y - i.y,
    v = n.b.z - i.z,
    w = n.c.x - i.x,
    g = n.c.y - i.y,
    y = n.c.z - i.z,
    b = u * a.x + h * a.y + d * a.z,
    A = u * c.x + h * c.y + d * c.z,
    x = u * l.x + h * l.y + d * l.z,
    M = f * a.x + p * a.y + v * a.z,
    E = f * c.x + p * c.y + v * c.z,
    _ = f * l.x + p * l.y + v * l.z,
    C = w * a.x + g * a.y + y * a.z,
    S = w * c.x + g * c.y + y * c.z,
    G = w * l.x + g * l.y + y * l.z,
    I = M - b,
    L = E - A,
    k = _ - x,
    D = C - M,
    V = S - E,
    K = G - _,
    P = b - C,
    q = A - S,
    e0 = x - G;
  if (
    C5(b, A, x, M, E, _, C, S, G, 0, k, -L, r, s, o) ||
    C5(b, A, x, M, E, _, C, S, G, -k, 0, I, r, s, o) ||
    C5(b, A, x, M, E, _, C, S, G, L, -I, 0, r, s, o) ||
    C5(b, A, x, M, E, _, C, S, G, 0, K, -V, r, s, o) ||
    C5(b, A, x, M, E, _, C, S, G, -K, 0, D, r, s, o) ||
    C5(b, A, x, M, E, _, C, S, G, V, -D, 0, r, s, o) ||
    C5(b, A, x, M, E, _, C, S, G, 0, e0, -q, r, s, o) ||
    C5(b, A, x, M, E, _, C, S, G, -e0, 0, P, r, s, o) ||
    C5(b, A, x, M, E, _, C, S, G, q, -P, 0, r, s, o) ||
    Math.min(b, M, C) > r ||
    -r > Math.max(b, M, C) ||
    Math.min(A, E, S) > s ||
    -s > Math.max(A, E, S) ||
    Math.min(x, _, G) > o ||
    -o > Math.max(x, _, G)
  )
    return !1;
  const Q = C - b,
    U = S - A,
    O = G - x,
    F = L * O - k * U,
    z = k * Q - I * O,
    Y = I * U - L * Q,
    X = -(F * b + z * A + Y * x),
    l0 = F >= 0 ? -r : r,
    r0 = z >= 0 ? -s : s,
    j = Y >= 0 ? -o : o,
    F0 = F * l0 + z * r0 + Y * j + X,
    O0 = F * -l0 + z * -r0 + Y * -j + X;
  return F0 <= 0 && O0 >= 0;
}
function C5(n, e, t, i, r, s, o, a, c, l, u, h, d, f, p) {
  const v = n * l + e * u + t * h,
    w = i * l + r * u + s * h,
    g = o * l + a * u + c * h,
    y = d * Math.abs(l) + f * Math.abs(u) + p * Math.abs(h);
  return Math.min(v, w, g) > y || -y > Math.max(v, w, g);
}
function Av(n, e, t) {
  const i = n.a,
    r = n.b,
    s = n.c,
    o = t0(r.x - i.x),
    a = t0(r.y - i.y),
    c = t0(r.z - i.z),
    l = t0(s.x - i.x),
    u = t0(s.y - i.y),
    h = t0(s.z - i.z),
    d = t0(t0(t.y * h) - t0(t.z * u)),
    f = t0(t0(t.z * l) - t0(t.x * h)),
    p = t0(t0(t.x * u) - t0(t.y * l)),
    v = t0(t0(t0(o * d) + t0(a * f)) + t0(c * p));
  if (v > -Bg && v < Bg) return;
  const w = t0(1 / v),
    g = t0(e.x - i.x),
    y = t0(e.y - i.y),
    b = t0(e.z - i.z),
    A = t0(t0(t0(t0(g * d) + t0(y * f)) + t0(b * p)) * w);
  if (A < 0 || A > 1) return;
  const x = t0(t0(y * c) - t0(b * a)),
    M = t0(t0(b * o) - t0(g * c)),
    E = t0(t0(g * a) - t0(y * o)),
    _ = t0(t0(t0(t0(t.x * x) + t0(t.y * M)) + t0(t.z * E)) * w);
  if (_ < 0 || t0(A + _) > 1) return;
  const C = t0(t0(t0(t0(l * x) + t0(u * M)) + t0(h * E)) * w);
  return C >= 0 && C <= 1 ? C : void 0;
}
function nE(n, e) {
  const t = t0(e.x - n.x),
    i = t0(e.y - n.y),
    r = t0(e.z - n.z),
    s = t0(t * t),
    o = t0(r * r),
    a = t0(i * i),
    c = t0(t0(s + o) + a);
  return t0(Math.sqrt(c));
}
function GL(n) {
  const e = t0(n.x * n.x),
    t = t0(n.z * n.z),
    i = t0(n.y * n.y),
    r = t0(t0(e + t) + i);
  return t0(Math.sqrt(r));
}
function bi0(n) {
  const e = GL(n);
  if (e === 0) return { x: 1, y: 1, z: -1 };
  const t = t0(-n.z);
  return { x: t0(n.x / e), y: t0(n.y / e), z: t0(-t0(t / e)) };
}
function q5(n, e) {
  const t = t0(n.x * e.x),
    i = t0(t0(-n.z) * t0(-e.z)),
    r = t0(n.y * e.y);
  return t0(t0(t + i) + r);
}
function iE(n, e, t) {
  const i = e.x,
    r = t0(-e.z),
    s = e.y,
    o = t.x,
    a = t0(-t.z),
    c = t.y,
    l = t0(t0(r * c) - t0(s * a)),
    u = t0(t0(s * o) - t0(i * c)),
    h = t0(t0(i * a) - t0(r * o));
  ((n.x = l), (n.y = h), (n.z = t0(-u)));
}
function Td(n, e, t) {
  return On(n, Tt(N1(e, n), t));
}
function _d(n, e, t) {
  return (
    fl(oc, t, e),
    !rE(n.triangles[0], e, oc) && !rE(n.triangles[1], e, oc)
      ? 0
      : q5(oc, n.normal) >= 0
        ? 1
        : -1
  );
}
const oc = { x: 0, y: 0, z: 0 },
  Gd = { x: 0, y: 0, z: 0 },
  Bd = { x: 0, y: 0, z: 0 },
  Rd = { x: 0, y: 0, z: 0 },
  Id = { x: 0, y: 0, z: 0 },
  kd = { x: 0, y: 0, z: 0 };
function rE(n, e, t) {
  (fl(Gd, n[1], n[0]), fl(Bd, n[2], n[0]), iE(Rd, t, Bd));
  const i = q5(Gd, Rd);
  if (i > -Bg && i < fi0) return !1;
  const r = t0(1 / i);
  fl(Id, e, n[0]);
  const s = t0(q5(Id, Rd) * r);
  if (s < 0 || s > 1) return !1;
  iE(kd, Id, Gd);
  const o = t0(q5(t, kd) * r);
  if (o < 0 || t0(s + o) > 1) return !1;
  const a = t0(q5(Bd, kd) * r);
  return a >= 0 && a <= 1;
}
function On(n, e) {
  return { x: t0(n.x + e.x), y: t0(n.y + e.y), z: t0(n.z + e.z) };
}
function bv(n, e, t) {
  ((n.x = t0(e.x + t.x)), (n.y = t0(e.y + t.y)), (n.z = t0(e.z + t.z)));
}
function Rg(n) {
  return Tt(On(On(n[0], n[1]), n[2]), dl);
}
function I1(n) {
  return { x: t0(n.x), y: t0(n.y), z: t0(n.z) };
}
function E5(n) {
  const e = n.frames[0];
  if (!e) throw new Error("route surface event 缺少 section frame 0。");
  return e;
}
function Mi0(n, e, t) {
  const i = t0(Ld(t[0], e[0], t[4], e[1], t[8], e[2]) + t[12]),
    r = t0(Ld(t[1], e[0], t[5], e[1], t[9], e[2]) + t[13]),
    s = t0(Ld(t[2], e[0], t[6], e[1], t[10], e[2]) + t[14]);
  ((n.x = i), (n.y = s), (n.z = t0(-r)));
}
function Ld(n, e, t, i, r, s) {
  return t0(t0(t0(n * e) + t0(t * i)) + t0(r * s));
}
function N1(n, e) {
  return { x: t0(n.x - e.x), y: t0(n.y - e.y), z: t0(n.z - e.z) };
}
function fl(n, e, t) {
  ((n.x = t0(e.x - t.x)), (n.y = t0(e.y - t.y)), (n.z = t0(e.z - t.z)));
}
function Tt(n, e) {
  return { x: t0(n.x * e), y: t0(n.y * e), z: t0(n.z * e) };
}
function Mv(n, e, t) {
  ((n.x = t0(e.x * t)), (n.y = t0(e.y * t)), (n.z = t0(e.z * t)));
}
function xt(n, e) {
  return t0(t0(t0(n.x * e.x) + t0(n.y * e.y)) + t0(n.z * e.z));
}
function xi0(n, e) {
  return {
    x: t0(t0(n.y * e.z) - t0(n.z * e.y)),
    y: t0(t0(n.z * e.x) - t0(n.x * e.z)),
    z: t0(t0(n.x * e.y) - t0(n.y * e.x)),
  };
}
function Si0(n) {
  return t0(Math.hypot(n.x, n.y, n.z));
}
function t0(n) {
  return Math.fround(n);
}
class Ci0 {
  constructor(e, t, i) {
    if (
      ((this.assets = e),
      (this.roadblock = e.drivingMode?.kind === "roadblock"),
      (this.isRoadBlockRunner = this.roadblock && t.roadblock?.runnerId === i),
      e.raceId !== t.raceId)
    )
      throw new Error("禁止使用上一局的比赛资源。");
    iL(t);
    const r = e.participants.find((s) => s.playerId === i);
    if (!r || !t.roster.some((s) => s.playerId === i))
      throw new Error("本局缺少本机车辆。");
    if (e.map.data.trackId !== t.trackId)
      throw new Error("本局赛道与已装配资源不一致。");
    if ((e.drivingMode?.kind === "lte") !== ko(t.lte))
      throw new Error("LTE Web试玩身份与本机玩法不一致。");
    if (
      (e.drivingMode?.kind === "rp") !==
        ba(
          t.rp,
          t.roster.map((s) => s.playerId),
        ) ||
      !t7(e.rp, t.rp)
    )
      throw new Error("RP 抽取结果与已装配车辆不一致。");
    if (
      t.rp &&
      e.participants.some((s) => {
        const o = t.rp.draws[s.playerId];
        return (
          !o ||
          s.profile.equipment.itemIds[3] !== o.kartId ||
          s.profile.equipment.itemIds[52] !== o.flyingPetId
        );
      })
    )
      throw new Error("RP 分配与参与者实际装配不一致。");
    if (
      ((this.lte = e.drivingMode?.kind === "lte" ? new D40() : void 0),
      (e.drivingMode?.kind === "giant") !== Io(t.giant))
    )
      throw new Error("巨人冻结身份与玩法不一致。");
    ((this.giant =
      e.drivingMode?.kind === "giant"
        ? new pL(!0, () => this.physics.compensateGiantBooster())
        : void 0),
      (this.physics = new AL(
        r.vehicle.physicsParams,
        r.vehicle.collisionShape,
        e.mode === "team",
        e.mode === "team" && e.speed === 4,
        e.mode === "team" && e.speed !== 4,
        e.drivingMode,
        this.lte?.motion,
        this.giant,
        e.checkClientFramerate && e.channel.adjustCollision,
      )),
      (this.track = new _L(
        e.map.data,
        e.map.scene,
        e.map.renderScene,
        e.map.skydome,
        e.lensFlare,
      )),
      this.physics.resetFromRouteFrame(this.track.getStart()),
      (this.startPose = structuredClone({
        position: this.physics.body.position,
        right: this.physics.body.right,
        forward: this.physics.body.forward,
        up: this.physics.body.up,
      })),
      (this.physics.body.position = rL(
        this.physics.body.position,
        this.physics.body.right,
        t.startSlots[i],
        (s, o) => this.track.rayQuery(s, o, !1)?.point,
      )),
      this.track.resetRouteState(this.physics, this.physics.body.position),
      this.track.setLensFlareEnabled(
        this.track.currentRouteSurface(this.physics) === "lensflare",
      ),
      (this.physics.state.trackProgress = this.track.getRouteState(
        this.physics,
      ).distance),
      this.physics.setRaceMotionLocked(!0),
      (this.coordinator = new yL(
        e.map.admission,
        this.track,
        this.physics,
        (s) => this.handleLocalRouteTag(s),
      )),
      e.lteCoins && this.track.group.add(e.lteCoins.object),
      e.lteCoins?.attach(
        this.coordinator,
        () => this.physics.body.position,
        () =>
          this.lifecycle.state === X2.Racing &&
          this.resetState.phase === 0 &&
          !this.warpNext.blocksDriving(),
      ));
  }
  assets;
  lapTiming = new vL();
  boostGaugeFull = !1;
  physics;
  track;
  lifecycle = new OQ();
  startPose;
  coordinator;
  scheduled = !1;
  clockOriginMs = 0;
  disposed = !1;
  lte;
  giant;
  isRoadBlockRunner;
  roadblock;
  naturallyFinished = !1;
  forcedElapsedMs;
  pendingActions = [];
  finishDeadline;
  raceOverAt;
  resultsReady = !1;
  resetState = pr();
  lowSpeedResetStartedAtMs = 0;
  resetSoundPending = !1;
  roadBlockResetNoticePending = !1;
  pendingRouteTags = [];
  warpNext = new Qk();
  pendingWarpActions = [];
  routeClockMs = 0;
  consumeLocalRouteTags() {
    return this.pendingRouteTags.splice(0);
  }
  consumeWarpActions() {
    return this.pendingWarpActions.splice(0);
  }
  lteAvailable() {
    return (
      !this.disposed &&
      this.lifecycle.state === X2.Racing &&
      this.resetState.phase === 0 &&
      !this.warpNext.blocksDriving() &&
      this.physics.lteDodgeAvailable()
    );
  }
  handleModeDrivingCommand(e, t) {
    return this.lte?.dispatch(e, t, this.lteAvailable()) ?? !1;
  }
  cancelModeDrivingInput() {
    this.lte?.cancel();
  }
  requestReset(e = !0) {
    return this.disposed ||
      this.lifecycle.state !== X2.Racing ||
      this.resetState.phase !== 0
      ? !1
      : e && this.isRoadBlockRunner
        ? ((this.roadBlockResetNoticePending = !0), !1)
        : this.physics.beginResetInitiation(e)
          ? (this.lte?.cancel(),
            (this.resetState = mL(this.resetState)),
            (this.resetSoundPending = !0),
            !0)
          : !1;
  }
  consumeResetSound() {
    const e = this.resetSoundPending;
    return ((this.resetSoundPending = !1), e);
  }
  consumeRoadBlockResetNotice() {
    const e = this.roadBlockResetNoticePending;
    return ((this.roadBlockResetNoticePending = !1), !!e);
  }
  get resetStartedAt() {
    return this.resetState.phase !== 0 && this.resetState.startMs !== 0
      ? this.resetState.startMs
      : void 0;
  }
  checkAutomaticReset(e, t) {
    if (this.lifecycle.state === X2.Racing) {
      if (
        (this.physics.body.position.y < -5 &&
          (this.physics.prepareLowHeightResetPose(),
          this.coordinator.synchronizePositionAnchor(),
          this.requestReset(!1)),
        this.physics.consumeAutomaticResetRequest())
      ) {
        this.requestReset(!1);
        return;
      }
      if (this.warpNext.blocksDriving()) {
        this.lowSpeedResetStartedAtMs = 0;
        return;
      }
      if (!this.physics.lowSpeedAutomaticResetActive(t)) {
        this.lowSpeedResetStartedAtMs = 0;
        return;
      }
      (this.lowSpeedResetStartedAtMs === 0 &&
        (this.lowSpeedResetStartedAtMs = e),
        this.lowSpeedResetStartedAtMs !== 0 &&
          (this.lowSpeedResetStartedAtMs + 2e3) >>> 0 < e &&
          ((this.lowSpeedResetStartedAtMs = 0), this.requestReset(!1)));
    }
  }
  resetVisible(e) {
    return gL(this.resetState, e);
  }
  get resetSuspended() {
    return this.resetState.phase === 1 || this.resetState.phase === 2;
  }
  advanceReset(e) {
    const t = wL(this.resetState, e);
    this.resetState = t.state;
    for (const i of t.actions)
      if (i === "complete-checkpoint-pose") {
        const r = this.track.prepareCurrentSectionReset(this.physics);
        if (
          r.surface &&
          !this.physics.canHandleRouteSurfaceTag(`${r.surface}:in:next`)
        )
          throw new Error(`多人复位暂未接入特殊路面 ${r.surface}。`);
        if (
          (this.track.commitCurrentSectionReset(this.physics),
          this.physics.completeCheckpointPose(r, !0),
          this.coordinator.synchronizePositionAnchor(),
          r.surface?.includes("rail") &&
            this.physics.prepareRailCheckpointReentry(),
          this.track.setLensFlareEnabled(r.surface === "lensflare"),
          r.surface)
        ) {
          const s = `${r.surface}:in:next`;
          if (!this.physics.handleRouteSurfaceTag(s))
            throw new Error(`多人复位路段 ${r.surface} 无物理处理器。`);
          this.handleLocalRouteTag(s);
        }
      } else
        i === "suspend-physics"
          ? this.physics.setFullPhysicsBypass(!0)
          : i === "resume-physics"
            ? this.physics.setFullPhysicsBypass(!1)
            : this.physics.restoreResetInteraction();
  }
  acceptEndTiming(e, t, i) {
    this.disposed ||
      (e !== void 0 &&
        this.finishDeadline === void 0 &&
        ((this.finishDeadline = e),
        this.pendingActions.push(
          ...this.lifecycle.acceptTiming(3, e - this.clockOriginMs, 0),
        )),
      t !== void 0 &&
        this.raceOverAt === void 0 &&
        (this.lifecycle.state === X2.Racing &&
          e !== void 0 &&
          (this.forcedElapsedMs = this.elapsedMs(e)),
        (this.raceOverAt = t),
        this.lte?.cancel(),
        this.pendingActions.push(
          ...this.lifecycle.acceptTiming(4, t - this.clockOriginMs, 0),
        ),
        this.physics.setRaceMotionLocked(!0)),
      (this.resultsReady = i));
  }
  handleLocalRouteTag(e) {
    const t = Vo(e),
      i = e.includes(":in:");
    (e === "warpnext:in:next" &&
      this.lifecycle.state === X2.Racing &&
      this.applyWarpActions(
        this.warpNext.enter(
          e,
          this.track.warpNextDestination(this.physics),
          this.routeClockMs,
          this.track.data.warp,
        ),
      ),
      (t === "flash" || t.startsWith("shake") || t.startsWith("wave")) &&
        this.pendingRouteTags.push(e),
      t === "lensflare" && this.track.setLensFlareEnabled(i),
      (t === "norain" || t === "rail, norain") &&
        (this.assets.rain?.setEnabled(!i),
        this.assets.rainAudio?.setRainEnabled(!i)),
      t === "nosnow" && this.assets.snow?.setEnabled(!i));
  }
  applyWarpActions(e) {
    for (const t of e) {
      if (t.kind === "start-warp-presentation")
        (this.lte?.cancel(),
          this.physics.setWarpPresentationActive(!0),
          this.physics.setWarpPressProtected(!0));
      else if (t.kind === "freeze-camera") {
        if (!this.assets.map.warpNextCamera)
          throw new Error("warpnextcamera_cam 缺失；多人不能沿用旧镜头。");
      } else
        t.kind === "teleport"
          ? (this.physics.completeCheckpointPose(t.frame, t.clearMotion),
            this.physics.setWarpPressProtected(!1),
            t.clearMotion
              ? this.coordinator.completeWarpNextRailLanding()
              : this.coordinator.deferWarpNextRailLanding(),
            this.coordinator.synchronizePositionAnchor())
          : t.kind === "finish-warp-presentation" &&
            (this.physics.setWarpPresentationActive(!1),
            this.physics.setFullPhysicsBypass(!1),
            this.physics.restoreResetInteraction());
      this.pendingWarpActions.push(t);
    }
  }
  scheduleStart(e) {
    if (this.disposed || this.scheduled)
      throw new Error("本局起跑安排已释放或已设置。");
    if (!Number.isFinite(e) || e < 0) throw new Error("本局起跑时钟无效。");
    ((this.scheduled = !0),
      (this.clockOriginMs = Math.trunc(e) - 6e3),
      this.lifecycle.acceptTiming(1, 6e3, 0));
  }
  get scheduledStartAtMs() {
    return this.scheduled ? this.lifecycle.startAtMs + this.clockOriginMs : 0;
  }
  isStartBoosterWindow(e) {
    return (
      this.scheduled &&
      fL(this.lifecycle.startAtMs, Math.trunc(e) - this.clockOriginMs)
    );
  }
  raceProgress() {
    const e = this.track.getRouteState(this.physics);
    return {
      distance: e.distance,
      lap: e.lap,
      ...(this.naturallyFinished
        ? { finishElapsedMs: this.lifecycle.finishedElapsedMs }
        : {}),
    };
  }
  elapsedMs(e) {
    return !this.scheduled || this.lifecycle.state < X2.Racing
      ? 0
      : this.lifecycle.state >= X2.PostFinish
        ? (this.forcedElapsedMs ?? this.lifecycle.finishedElapsedMs)
        : Math.max(
            0,
            Math.trunc(e) - this.clockOriginMs - this.lifecycle.startAtMs,
          );
  }
  update(e, t) {
    if (((this.boostGaugeFull = !1), this.disposed)) return [];
    if (!Number.isFinite(e) || e < 0) throw new Error("本局更新时间无效。");
    const i = Math.trunc(e) >>> 0;
    if (
      ((this.routeClockMs = i),
      this.track.updateMovingRoads(i),
      !this.scheduled)
    )
      return (this.physics.updateLockedIngameClock(i), []);
    const r = Math.trunc(e) - this.clockOriginMs;
    if (r < 0) return (this.physics.updateLockedIngameClock(i), []);
    (this.lifecycle.state === X2.Racing &&
      this.physics.consumeRailResetRequest() &&
      this.requestReset(!1),
      this.checkAutomaticReset(i, t),
      this.advanceReset(i),
      this.lifecycle.state === X2.Racing &&
        this.lapTiming.update(r, this.track.getRouteState(this.physics).lap));
    const s = [
      ...this.pendingActions.splice(0),
      ...this.lifecycle.update({
        nowMs: r,
        routeProgress:
          this.roadblock && !this.isRoadBlockRunner
            ? 0
            : this.track.getRouteState(this.physics).lap,
        routeTotal: this.track.data.lapTarget,
        resultRosterReady: this.resultsReady,
      }),
    ].map((o) =>
      "atMs" in o
        ? { ...o, atMs: o.atMs + this.clockOriginMs }
        : o.kind === "release-race"
          ? { ...o, startAtMs: o.startAtMs + this.clockOriginMs }
          : o,
    );
    for (const o of s)
      (o.kind === "natural-finish" && (this.naturallyFinished = !0),
        o.kind === "release-race" &&
          (this.physics.setRaceMotionLocked(!1),
          this.physics.synchronizeClock(i)));
    return this.lifecycle.state !== X2.Racing
      ? (this.giant?.setDrivingActive(!1),
        this.lte?.cancel(),
        this.physics.setRaceMotionLocked(!0),
        this.lifecycle.state === X2.PostFinish
          ? this.coordinator.run(i, t)
          : this.lifecycle.state === X2.Ready ||
              this.lifecycle.state === X2.Countdown
            ? this.physics.updateLockedIngameClock(i)
            : this.physics.synchronizeClock(i),
        s)
      : (this.lte?.update(i, this.lteAvailable()),
        this.giant?.setDrivingActive(
          !this.resetSuspended && !this.warpNext.blocksDriving(),
        ),
        this.coordinator.run(i, t),
        this.physics.consumeRailResetRequest() && this.requestReset(!1),
        this.applyWarpActions(this.warpNext.tick(i)),
        (this.boostGaugeFull = this.physics.updateModeInventory()),
        s);
  }
  queueRemoteKart(e, t) {
    this.coordinator.queueRemoteKart(e, t);
  }
  dispose() {
    this.disposed ||
      ((this.disposed = !0),
      (this.roadBlockResetNoticePending = !1),
      this.lte?.dispose(),
      this.giant?.dispose(),
      this.giant && this.physics.clearGiantRaceEffects(),
      this.warpNext.reset(),
      this.physics.hardCancelControls(),
      this.physics.setRaceMotionLocked(!0),
      this.coordinator.dispose(),
      this.track.group.removeFromParent(),
      this.track.group.clear());
  }
}
const sE = 4294967296;
class BL {
  offset;
  constructor(e) {
    if (!Number.isFinite(e.offsetMs))
      throw new Error("Invalid motion clock mapping");
    this.offset = e.offsetMs;
  }
  encode(e) {
    const t = Math.trunc(e + this.offset);
    if (!Number.isFinite(e) || e < 0 || !Number.isSafeInteger(t) || t < 0)
      throw new Error("Invalid motion clock");
    return t >>> 0;
  }
  decode(e, t) {
    if (
      !Number.isInteger(e) ||
      e < 0 ||
      e > 4294967295 ||
      !Number.isFinite(t) ||
      t < 0
    )
      throw new Error("Invalid motion clock");
    const i = t + this.offset,
      r = e + Math.round((i - e) / sE) * sE,
      s = Math.trunc(r - this.offset);
    if (!Number.isSafeInteger(s))
      throw new Error("Invalid expanded motion clock");
    return s;
  }
}
const Y0 = Math.fround;
function RL(n, e, t) {
  return [
    { x: n.x, y: Y0(-e.x), z: t.x },
    { x: Y0(-n.z), y: e.z, z: Y0(-t.z) },
    { x: n.y, y: Y0(-e.y), z: t.y },
  ];
}
function xv(n, e) {
  return (
    (e.right.x = n[0].x),
    (e.right.y = n[2].x),
    (e.right.z = Y0(-n[1].x)),
    (e.forward.x = Y0(-n[0].y)),
    (e.forward.y = Y0(-n[2].y)),
    (e.forward.z = n[1].y),
    (e.up.x = n[0].z),
    (e.up.y = n[2].z),
    (e.up.z = Y0(-n[1].z)),
    e
  );
}
function Ei0(n) {
  return xv(n, {
    right: { x: 0, y: 0, z: 0 },
    forward: { x: 0, y: 0, z: 0 },
    up: { x: 0, y: 0, z: 0 },
  });
}
function Ig(n, e) {
  const t = Y0(n.x * n.x),
    i = Y0(n.y * n.y),
    r = Y0(n.z * n.z),
    s = Y0(n.x * n.y),
    o = Y0(n.x * n.z),
    a = Y0(n.y * n.z),
    c = Y0(n.w * n.x),
    l = Y0(n.w * n.y),
    u = Y0(n.w * n.z),
    h = Y0(2);
  return (
    (e[0].x = Y0(Y0(1) - Y0(h * Y0(i + r)))),
    (e[0].y = Y0(h * Y0(s - u))),
    (e[0].z = Y0(h * Y0(o + l))),
    (e[1].x = Y0(h * Y0(s + u))),
    (e[1].y = Y0(Y0(1) - Y0(h * Y0(t + r)))),
    (e[1].z = Y0(h * Y0(a - c))),
    (e[2].x = Y0(h * Y0(o - l))),
    (e[2].y = Y0(h * Y0(a + c))),
    (e[2].z = Y0(Y0(1) - Y0(h * Y0(t + i)))),
    e
  );
}
function IL(n) {
  const e = n[0].x,
    t = n[0].y,
    i = n[0].z,
    r = n[1].x,
    s = n[1].y,
    o = n[1].z,
    a = n[2].x,
    c = n[2].y,
    l = n[2].z,
    u = Y0(Y0(e + s) + l);
  if (u > 0) {
    const b = Y0(Math.sqrt(Y0(u + Y0(1)))),
      A = Y0(Y0(0.5) / b);
    return {
      w: Y0(b * Y0(0.5)),
      x: Y0(Y0(c - o) * A),
      y: Y0(Y0(i - a) * A),
      z: Y0(Y0(r - t) * A),
    };
  }
  const h = [e, s, l];
  let d = 0;
  (h[1] > h[d] && (d = 1), h[2] > h[d] && (d = 2));
  const f = (d + 1) % 3,
    p = (f + 1) % 3,
    v = [
      [e, t, i],
      [r, s, o],
      [a, c, l],
    ],
    w = Y0(Math.sqrt(Y0(Y0(Y0(h[d] - h[f]) - h[p]) + Y0(1)))),
    g = Y0(Y0(0.5) / w),
    y = [0, 0, 0];
  return (
    (y[d] = Y0(w * Y0(0.5))),
    (y[f] = Y0(Y0(v[f][d] + v[d][f]) * g)),
    (y[p] = Y0(Y0(v[p][d] + v[d][p]) * g)),
    { w: Y0(Y0(v[p][f] - v[f][p]) * g), x: y[0], y: y[1], z: y[2] }
  );
}
const oE = [
  { x: 0, y: 0, z: 0 },
  { x: 0, y: 0, z: 0 },
  { x: 0, y: 0, z: 0 },
];
function kL() {
  return {
    position: { x: 0, y: 0, z: 0 },
    right: { x: 0, y: 0, z: 0 },
    forward: { x: 0, y: 0, z: 0 },
    up: { x: 0, y: 0, z: 0 },
  };
}
function LL(n, e) {
  return (
    Ig(n.quaternion, oE),
    xv(oE, e),
    (e.position.x = n.x),
    (e.position.y = n.z),
    (e.position.z = Math.fround(-n.y)),
    e
  );
}
function PL(n) {
  return IL(RL(n.right, n.forward, n.up));
}
const i2 = Math.fround,
  Pd = (n, e) => n.map((t, i) => i2(t + e[i])),
  Fd = (n, e) => n.map((t) => i2(t * e)),
  Ti0 = (n, e) => [
    i2(i2(n[1] * e[2]) - i2(n[2] * e[1])),
    i2(i2(n[2] * e[0]) - i2(n[0] * e[2])),
    i2(i2(n[0] * e[1]) - i2(n[1] * e[0])),
  ],
  aE = (n, e) =>
    n.map((t) => i2(i2(i2(t.x * e[0]) + i2(t.y * e[1])) + i2(t.z * e[2]))),
  _i0 = () => [
    { x: 1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 0, y: 0, z: 1 },
  ];
class Gi0 {
  constructor(e, t) {
    if (
      ((this.mass = e),
      !Number.isFinite(i2(e)) ||
        i2(e) <= 0 ||
        !Number.isFinite(i2(1 / e)) ||
        t.some((i) => Object.values(i).some((r) => !Number.isFinite(i2(r)))))
    )
      throw new Error("Invalid remote motion parameters");
    this.inertia = structuredClone(t);
  }
  mass;
  snapshot;
  snapshotTick = 0;
  eligible = !0;
  futureTickInvalid = !1;
  snapshotAgeDisplay = 0;
  previousTick;
  position = [0, 0, 0];
  velocity = [0, 0, 0];
  angular = [0, 0, 0];
  rotation = _i0();
  inertia;
  receive(e, t, i) {
    if (![t, i].every((a) => Number.isSafeInteger(a) && a > 0))
      throw new Error("Invalid remote clock");
    if (e.kind !== "kinematic" && (e.flags[1] & 7) !== 0)
      throw new Error("Special remote motion is not supported");
    const r = [
        ...e.position,
        ...e.quaternion,
        ...e.linearVelocity,
        ...e.angularVelocity,
        ...e.vector5C,
        ...e.vector68,
      ],
      s = e.quaternion.reduce((a, c) => i2(a + i2(c * c)), 0);
    if (r.some((a) => !Number.isFinite(i2(a))) || !Number.isFinite(s) || s <= 0)
      throw new Error("Invalid remote motion snapshot");
    ((this.futureTickInvalid = ((i - t) | 0) < -2e3),
      (this.eligible =
        e.kind === "kinematic"
          ? e.collision?.active === !0
          : (e.flags[0] & 1) !== 0));
    const o = Math.min(t, i);
    return this.snapshot && o <= this.snapshotTick
      ? !1
      : ((this.snapshot = structuredClone(e)),
        (this.snapshotTick = o),
        (this.snapshotAgeDisplay = 0),
        (this.previousTick = void 0),
        !0);
  }
  collisionState() {
    const e = this.snapshot;
    if (!(!this.eligible || !e || e.kind !== "kinematic" || !e.collision))
      return e.collision;
  }
  get active() {
    return this.eligible;
  }
  get rankSnapshotAge() {
    return this.snapshotAgeDisplay;
  }
  updateEligibility(e, t) {
    if (!this.snapshot) {
      ((this.snapshotAgeDisplay = 0), t.locked || (this.eligible = !1));
      return;
    }
    const i = (e - this.snapshotTick) >>> 0;
    (this.snapshotAgeDisplay !== 0
      ? i > 5e3 && (this.snapshotAgeDisplay = 0)
      : e <= this.snapshotTick
        ? (this.snapshotAgeDisplay = 1)
        : i <= 5e3 && (this.snapshotAgeDisplay = i),
      t.bypass ||
        (this.eligible =
          (i <= 5e3 && !this.futureTickInvalid && this.eligible) || t.locked));
  }
  update(e, t) {
    if (!Number.isSafeInteger(e) || e < 0)
      throw new Error("Invalid remote frame clock");
    this.updateEligibility(e, t);
    const i = this.snapshot;
    if (i) {
      if (e < (this.previousTick ?? this.snapshotTick))
        throw new Error("Remote frame clock moved backwards");
      if (t.bypass) {
        this.previousTick = e;
        return;
      }
      if (
        (this.previousTick === void 0 &&
          ((this.position = [...i.position]),
          (this.velocity = [...i.linearVelocity]),
          (this.angular = [...i.angularVelocity]),
          this.restoreRotation(),
          (this.previousTick = this.snapshotTick)),
        t.locked)
      )
        ((this.position = [...i.position]), this.restoreRotation());
      else {
        let r = Math.min(e - this.previousTick, 200);
        for (; r > 0;) {
          const s = Math.min(r, 10);
          r -= s;
          const o = i2(i2(s) * i2(0.001));
          this.velocity = Pd(
            this.velocity,
            Fd(
              i.vector5C.map((g) => i2(g / this.mass)),
              o,
            ),
          );
          const a = Ti0(this.angular, aE(this.inertia, this.angular)),
            c = i.vector68.map((g, y) => i2(g - a[y]));
          ((this.angular = Pd(this.angular, Fd(aE(this.inertia, c), o))),
            (this.position = Pd(this.position, Fd(this.velocity, o))));
          const l = IL(this.rotation),
            [u, h, d] = this.angular,
            f = [
              i2(i2(i2(-i2(l.x * u)) - i2(l.y * h)) - i2(l.z * d)),
              i2(i2(i2(l.w * u) + i2(l.y * d)) - i2(l.z * h)),
              i2(i2(i2(l.w * h) + i2(l.z * u)) - i2(l.x * d)),
              i2(i2(i2(l.w * d) + i2(l.x * h)) - i2(l.y * u)),
            ],
            p = i2(o * i2(0.5)),
            v = [l.w, l.x, l.y, l.z].map((g, y) => i2(g + i2(f[y] * p))),
            w = i2(
              Math.sqrt(
                i2(
                  i2(i2(i2(v[0] * v[0]) + i2(v[1] * v[1])) + i2(v[2] * v[2])) +
                    i2(v[3] * v[3]),
                ),
              ),
            );
          if (
            (Ig(
              {
                w: i2(v[0] / w),
                x: i2(v[1] / w),
                y: i2(v[2] / w),
                z: i2(v[3] / w),
              },
              this.rotation,
            ),
            [
              ...this.position,
              ...this.velocity,
              ...this.angular,
              ...this.rotation.flatMap((g) => [g.x, g.y, g.z]),
            ].some((g) => !Number.isFinite(g)))
          )
            throw (this.clear(), new Error("Remote motion overflow"));
        }
      }
      this.previousTick = e;
    }
  }
  restoreRotation() {
    const [e, t, i, r] = this.snapshot.quaternion;
    Ig({ w: e, x: t, y: i, z: r }, this.rotation);
  }
  copyPose() {
    if (this.previousTick !== void 0)
      return {
        position: [...this.position],
        rotation: structuredClone(this.rotation),
        velocity: [...this.velocity],
        angularVelocity: [...this.angular],
      };
  }
  clear() {
    ((this.snapshot = void 0),
      (this.snapshotTick = 0),
      (this.previousTick = void 0),
      (this.eligible = !0),
      (this.futureTickInvalid = !1),
      (this.snapshotAgeDisplay = 0));
  }
}
class Bi0 {
  constructor(e, t, i, r, s) {
    if (
      ((this.connection = t),
      (this.now = i),
      (this.onError = r),
      (this.cadence = s),
      e.roomId !== t.roomId ||
        e.raceId !== t.raceId ||
        !e.participants.some((a) => a.playerId === t.playerId))
    )
      throw new Error("Remote fleet identity mismatch");
    const o = new Set();
    for (const a of e.participants) {
      if (
        !Number.isInteger(a.slot) ||
        a.slot < 0 ||
        a.slot > 7 ||
        o.has(a.slot)
      )
        throw new Error("Remote fleet requires unique frozen race slots");
      o.add(a.slot);
    }
    this.collisionOrder = e.participants
      .filter((a) => a.playerId !== t.playerId)
      .slice()
      .sort((a, c) => a.slot - c.slot)
      .map((a) => a.playerId);
    for (const a of e.participants) {
      if (a.playerId === t.playerId) continue;
      if (this.remotes.has(a.playerId))
        throw new Error("Duplicate remote identity");
      const c = Math.fround(a.remoteParameters.mass),
        l = Math.fround(12 / c),
        u = new Gi0(c, [
          { x: l, y: 0, z: 0 },
          { x: 0, y: l, z: 0 },
          { x: 0, y: 0, z: l },
        ]);
      (this.remotes.set(a.playerId, {
        parameters: a.remoteParameters,
        motion: u,
        presentation: new k40(),
      }),
        e.drivingMode?.kind === "giant" &&
          this.giants.set(a.playerId, new pL(!1)));
    }
    if (
      ((this.unsubscribe = t.subscribeMotion((a) => {
        try {
          this.receive(a);
        } catch (c) {
          (this.dispose(), this.onError(c));
        }
      })),
      e.drivingMode?.kind === "giant")
    ) {
      if (!t.subscribeGiantState)
        throw (this.dispose(), new Error("缺少巨人状态接收通道。"));
      this.offGiant = t.subscribeGiantState((a) => this.receiveGiant(a));
    }
  }
  connection;
  now;
  onError;
  cadence;
  remotes = new Map();
  collisionOrder;
  departed = new Set();
  clock;
  unsubscribe;
  disposed = !1;
  giants = new Map();
  giantSequences = new Map();
  offGiant;
  giantFinished = !1;
  receiveGiant(e) {
    if (
      this.disposed ||
      this.giantFinished ||
      !this.clock ||
      e.roomId !== this.connection.roomId ||
      e.raceId !== this.connection.raceId ||
      this.departed.has(e.playerId) ||
      e.sequence <= (this.giantSequences.get(e.playerId) ?? 0)
    )
      return;
    const t = this.giants.get(e.playerId);
    if (t) {
      if (
        e.sequence !== (this.giantSequences.get(e.playerId) ?? 0) + 1 ||
        !n20(t, e)
      ) {
        try {
          this.onError(new Error("巨人有序状态链缺失或非法。"));
        } finally {
          this.dispose();
        }
        return;
      }
      (this.giantSequences.set(e.playerId, e.sequence),
        t.receive(e, this.now()));
    }
  }
  giant(e) {
    return this.disposed ? void 0 : this.giants.get(e);
  }
  updateGiantEffects(e) {
    for (const t of this.giants.values()) t.updateEffects(e);
  }
  resetGiants() {
    this.giantFinished = !0;
    for (const e of this.giants.values()) e.reset();
  }
  bindClock(e) {
    if (this.disposed || this.clock)
      throw new Error("Remote fleet clock already bound or released");
    this.clock = new BL(e);
  }
  receive(e) {
    if (
      this.disposed ||
      !this.clock ||
      e.roomId !== this.connection.roomId ||
      e.raceId !== this.connection.raceId
    )
      return;
    const t = this.remotes.get(e.playerId);
    if (
      !t ||
      this.departed.has(e.playerId) ||
      (t.sequence !== void 0 && !No(e.sequence, t.sequence))
    )
      return;
    const i = Math.trunc(this.now()),
      r = this.clock.decode(e.payload.tick, i);
    if (r <= 0 || i <= 0) return;
    this.cadence?.recordReceipt(e.playerId, i);
    const s = t.motion.receive(e.payload, r, i);
    (this.cadence?.observe(e.playerId, e.payload),
      (t.sequence = e.sequence),
      e.payload.kind === "kinematic" &&
        e.payload.presentation &&
        (t.presentation.receive(e.payload.presentation),
        this.giantFinished ||
          this.giants
            .get(e.playerId)
            ?.nativeFlattenMode(e.payload.presentation.visualScaleMode)),
      e.payload.kind === "kinematic" &&
        e.payload.visualScale &&
        (t.visualScale = { ...e.payload.visualScale }),
      s &&
        ((t.receivedAt = i),
        (t.resetStartedAt =
          e.payload.kind === "kinematic" && e.payload.resetStartedAt !== void 0
            ? this.clock.decode(e.payload.resetStartedAt, i)
            : void 0),
        e.payload.kind === "kinematic" &&
          e.payload.raceProgress &&
          (t.progress = { ...e.payload.raceProgress })));
  }
  updateRoom(e) {
    if (this.disposed) return;
    if (
      e.roomId !== this.connection.roomId ||
      e.race?.raceId !== this.connection.raceId ||
      !e.members.some((i) => i.playerId === this.connection.playerId)
    ) {
      this.dispose();
      return;
    }
    const t = new Set(e.members.map((i) => i.playerId));
    for (const i of this.remotes.keys()) t.has(i) || this.departed.add(i);
  }
  update(e, t) {
    if (!(this.disposed || !this.clock))
      try {
        for (const [i, r] of this.remotes)
          (r.motion.update(Math.trunc(e), t),
            this.giants.get(i)?.updateVehicle(e, () => {}));
      } catch (i) {
        (this.dispose(), this.onError(i));
      }
  }
  raceProgress(e) {
    return this.disposed ? void 0 : this.remotes.get(e)?.progress;
  }
  updateAndForEachFreshRacePeer(e, t, i) {
    (this.update(e, t), this.forEachFreshRacePeer(e, i));
  }
  forEachFreshRacePeer(e, t) {
    if (!this.disposed)
      for (const [i, r] of this.remotes) {
        if (
          this.departed.has(i) ||
          r.receivedAt === void 0 ||
          e - r.receivedAt > 1e3 ||
          e < r.receivedAt ||
          r.progress?.finishElapsedMs !== void 0 ||
          r.resetStartedAt !== void 0
        )
          continue;
        const s = r.motion.copyPose()?.velocity;
        t(i, r.progress, this.copyWebPose(i), s ? Math.hypot(...s) * 3.6 : NaN);
      }
  }
  forEachCollisionBody(e, t) {
    if (!this.disposed)
      for (const i of this.collisionOrder) {
        const r = this.remotes.get(i),
          s = r.motion.collisionState(),
          o = r.motion.copyPose();
        if (!s || !o) continue;
        const a = (l) => ({ x: l[0], y: l[1], z: l[2] }),
          c = this.giants.get(i);
        t(
          {
            ...r.parameters,
            position: a(o.position),
            rotation: o.rotation,
            velocity: a(o.velocity),
            angularVelocity: a(o.angularVelocity),
            scaleX: c?.mainScale.x ?? s.scaleX,
            scaleY: c?.mainScale.y ?? s.scaleY,
          },
          this.cadence?.collisionScale(i, this.connection.motionRoundTripMs),
          i,
        );
      }
  }
  rankDisconnected(e) {
    const t = this.remotes.get(e);
    return !this.disposed && t !== void 0 && t.motion.rankSnapshotAge === 0;
  }
  presentationVisible(e, t) {
    const i = this.remotes.get(e);
    return this.disposed || !i
      ? !1
      : (i.motion.active || (Math.trunc(t) >>> 0) % 200 >= 100) &&
          this.resetVisible(e, t);
  }
  resetVisible(e, t) {
    const i = this.remotes.get(e)?.resetStartedAt;
    return this.disposed || i === void 0 || t - i > 2e3
      ? !0
      : gv(Math.max(0, t - i));
  }
  consumePresentation(e) {
    return this.disposed ? void 0 : this.remotes.get(e)?.presentation.consume();
  }
  copyWebPose(e) {
    const t = this.remotes.get(e),
      i = t?.motion.copyPose();
    if (!(!i || this.disposed))
      return {
        position: {
          x: i.position[0],
          y: i.position[2],
          z: Math.fround(-i.position[1]),
        },
        ...Ei0(i.rotation),
        visualScale: this.giants.get(e)?.visualScale() ?? {
          ...(t?.visualScale ?? { x: 1, y: 1, z: 1 }),
        },
      };
  }
  dispose() {
    if (!this.disposed) {
      ((this.disposed = !0),
        this.unsubscribe?.(),
        (this.unsubscribe = void 0),
        this.offGiant?.(),
        (this.offGiant = void 0));
      for (const e of this.giants.values()) e.dispose();
      (this.giants.clear(), this.giantSequences.clear());
      for (const e of this.remotes.values()) e.motion.clear();
      (this.remotes.clear(),
        (this.collisionOrder.length = 0),
        this.departed.clear(),
        (this.clock = void 0));
    }
  }
}
const us = (n) => [Math.fround(n.x), Math.fround(-n.z), Math.fround(n.y)],
  Ri0 = new Set([1, 2, 3, 5, 6]);
function FL(n) {
  return n === 0 || Ri0.has(n);
}
function Ii0(n, e, t = !1) {
  if (!FL(n.networkMotionMode))
    throw new Error(`多人联机遇到未知运动状态 ${n.networkMotionMode}。`);
  const i = n.body,
    r = { force: { x: 0, y: 0, z: 0 }, torque: { x: 0, y: 0, z: 0 } };
  n.copyNetworkWrench(r);
  const s = PL(i),
    o = n.networkMotionMode !== 0;
  return {
    kind: "kinematic",
    tick: e,
    position: us(i.position),
    quaternion: [s.w, s.x, s.y, s.z],
    linearVelocity: t ? [0, 0, 0] : us(i.linearVelocity),
    angularVelocity: t ? [0, 0, 0] : us(i.angularVelocity),
    vector5C: t || o ? [0, 0, 0] : us(r.force),
    vector68: t || o ? [0, 0, 0] : us(r.torque),
  };
}
class ki0 {
  constructor(e, t, i, r) {
    ((this.source = e),
      (this.clock = t),
      (this.connection = i),
      (this.routing = r));
  }
  source;
  clock;
  connection;
  routing;
  lastBucket;
  disposed = !1;
  update(e, t, i, r = !1, s) {
    if (this.disposed) return !1;
    if (!Number.isFinite(e) || e < 0)
      throw new Error("Invalid outgoing motion clock");
    const o = Math.floor(e / 64);
    if (this.lastBucket !== void 0 && o < this.lastBucket)
      throw new Error("Outgoing motion clock moved backwards");
    if (
      o === this.lastBucket ||
      ((this.lastBucket = o), this.connection.hasMotionRecipients === !1)
    )
      return !1;
    if (!FL(this.source.networkMotionMode))
      throw new Error(
        `多人联机遇到未知运动状态 ${this.source.networkMotionMode}。`,
      );
    const a = this.routing?.cadence.select(
      Math.trunc(e),
      this.source.networkMotionMode,
      r || s !== void 0,
      this.source.body.position,
      this.routing.position,
      (h) => this.connection.directMotionAvailable?.(h) ?? !1,
    );
    if (a === 0) return !1;
    const c = Ii0(this.source, this.clock.encode(e), r),
      l = this.source.networkCollisionState?.(),
      u = {
        ...c,
        ...(i && t && l ? { collision: l } : {}),
        ...(s === void 0 ? {} : { resetStartedAt: this.clock.encode(s) }),
        ...(t ? { presentation: t } : {}),
        ...(i ? { raceProgress: i } : {}),
      };
    if (t?.animation && i && l) {
      if (!this.source.state)
        throw new Error("Race motion requires final visual scale");
      u.visualScale = { ...this.source.state.visualScale };
    }
    if (this.routing) {
      if (!t?.animation || !i || !l)
        throw new Error("Distance cadence requires full race motion");
      return (
        (u.routing = {
          motionMode: this.source.networkMotionMode,
          observedPlayerId: this.routing.playerId,
        }),
        this.connection.sendMotion(u, a)
      );
    }
    return this.connection.sendMotion(u);
  }
  dispose() {
    this.disposed = !0;
  }
}
const b9 = Math.fround,
  Dd = (n, e) => b9(b9(b9(n.x * e.x) + b9(n.y * e.y)) + b9(n.z * e.z)),
  cE = (n, e, t) => b9(b9(n + e) + t);
function Li0(n, e) {
  const t = {
      x: b9(e.position.x - n.position.x),
      y: b9(e.position.y - n.position.y),
      z: b9(e.position.z - n.position.z),
    },
    i = n.axes.map((a) => e.axes.map((c) => Dd(a, c))),
    r = i.map((a) => a.map(Math.abs)),
    s = n.axes.map((a) => Dd(a, t));
  let o = !1;
  for (let a = 0; a < 3; a++) {
    o ||= r[a].some((l) => l > b9(0.99999899));
    const c = cE(
      b9(e.halfSize[0] * r[a][0]),
      b9(e.halfSize[1] * r[a][1]),
      b9(e.halfSize[2] * r[a][2]),
    );
    if (Math.abs(s[a]) > b9(n.halfSize[a] + c)) return !1;
  }
  for (let a = 0; a < 3; a++) {
    const c = cE(
      b9(n.halfSize[0] * r[0][a]),
      b9(n.halfSize[1] * r[1][a]),
      b9(n.halfSize[2] * r[2][a]),
    );
    if (Math.abs(Dd(e.axes[a], t)) > b9(c + e.halfSize[a])) return !1;
  }
  if (o) return !0;
  for (let a = 0; a < 3; a++)
    for (let c = 0; c < 3; c++) {
      const l = (a + 1) % 3,
        u = (a + 2) % 3,
        h = (c + 1) % 3,
        d = (c + 2) % 3,
        f = Math.abs(b9(b9(s[u] * i[l][c]) - b9(s[l] * i[u][c]))),
        p = b9(b9(n.halfSize[l] * r[u][c]) + b9(n.halfSize[u] * r[l][c])),
        v = b9(b9(e.halfSize[h] * r[a][d]) + b9(e.halfSize[d] * r[a][h]));
      if (f > b9(p + v)) return !1;
    }
  return !0;
}
const m2 = Math.fround,
  pl = (n, e) => ({ x: m2(n.x + e.x), y: m2(n.y + e.y), z: m2(n.z + e.z) }),
  ac = (n, e) => ({ x: m2(n.x - e.x), y: m2(n.y - e.y), z: m2(n.z - e.z) }),
  Qe = (n, e) => ({ x: m2(n.x * e), y: m2(n.y * e), z: m2(n.z * e) }),
  kg = (n, e) => ({ x: m2(n.x / e), y: m2(n.y / e), z: m2(n.z / e) }),
  ot = (n, e) => m2(m2(m2(n.x * e.x) + m2(n.y * e.y)) + m2(n.z * e.z)),
  T3 = (n, e) => ({
    x: m2(m2(n.y * e.z) - m2(n.z * e.y)),
    y: m2(m2(n.z * e.x) - m2(n.x * e.z)),
    z: m2(m2(n.x * e.y) - m2(n.y * e.x)),
  }),
  DL = (n) => m2(Math.sqrt(ot(n, n))),
  Vd = (n) => {
    const e = DL(n);
    return e === 0 ? { x: 1, y: 1, z: 1 } : kg(n, e);
  },
  VL = (n) => [
    { x: n[0].x, y: n[1].x, z: n[2].x },
    { x: n[0].y, y: n[1].y, z: n[2].y },
    { x: n[0].z, y: n[1].z, z: n[2].z },
  ],
  hs = (n, e) => ({ x: ot(n[0], e), y: ot(n[1], e), z: ot(n[2], e) }),
  lE = (n, e) => {
    const t = VL(e);
    return n.map((i) => ({ x: ot(i, t[0]), y: ot(i, t[1]), z: ot(i, t[2]) }));
  };
function uE(n) {
  const e = m2(12 / m2(n.mass));
  return lE(
    lE(n.rotation, [
      { x: e, y: 0, z: 0 },
      { x: 0, y: e, z: 0 },
      { x: 0, y: 0, z: e },
    ]),
    n.rotation,
  );
}
function hE(n) {
  const e = VL(n.rotation);
  return {
    axes: e,
    position: pl(n.position, e[2]),
    halfSize: [m2(n.halfWidth * n.scaleX), m2(n.halfLength * n.scaleY), 1],
  };
}
function Pi0(n, e, t, i = 1, r = 1) {
  if (!Li0(hE(n), hE(e))) return;
  const s = (E) =>
      m2(
        Math.sqrt(
          m2(m2(E.halfWidth * E.halfWidth) + m2(E.halfLength * E.halfLength)),
        ),
      ),
    o = s(n),
    a = s(e),
    c = kg(pl(Qe(e.position, o), Qe(n.position, a)), m2(o + a)),
    l = ac(c, n.position),
    u = ac(c, e.position),
    h = Vd(ac(l, u)),
    d = ac(
      pl(n.velocity, T3(hs(n.rotation, n.angularVelocity), l)),
      pl(e.velocity, T3(hs(e.rotation, e.angularVelocity), u)),
    ),
    f = ot(d, h);
  if (f <= 0) return;
  const p = ot(d, d) >= 6.25 ? Vd(d) : h,
    v = uE(n),
    w = uE(e),
    g = Math.abs(
      m2(ot(p, T3(hs(v, T3(l, p)), l)) + ot(p, T3(hs(w, T3(u, p)), u))),
    ),
    y = m2(m2(1 / m2(n.mass)) + m2(1 / m2(e.mass))),
    b = -m2(m2(f * m2(1.4)) / y),
    A = -m2(m2(ot(d, p) * m2(1.4)) / m2(y + g));
  let x = Qe(hs(v, T3(l, Qe(p, A))), m2(0.05));
  const M = m2(1.570796);
  return (
    DL(x) > M && (x = Qe(Vd(x), M)),
    {
      linear: Qe(Qe(Qe(kg(Qe(h, b), m2(n.mass)), i), m2(t)), r),
      angular: Qe(Qe(Qe(x, i), m2(t)), r),
      strength: Math.abs(m2(b / m2(n.mass))),
    }
  );
}
const Nd = (n) => ({
    x: Math.fround(n.x),
    y: Math.fround(-n.z),
    z: Math.fround(n.y),
  }),
  dE = (n) => ({ x: n.x, y: n.z, z: Math.fround(-n.y) }),
  Fi0 = (n) => {
    const e = Math.fround;
    return e(
      e(Math.sqrt(e(e(e(n.x * n.x) + e(n.y * n.y)) + e(n.z * n.z)))) * e(3.6),
    );
  };
function Di0(n, e, t, i, r) {
  if (n.speedRaceMode?.kind === "shadow") return;
  const s = n.networkCollisionState();
  if (!s.active) return;
  const o =
    n.timeAttackTachometerCharger().active && t.charger !== 1
      ? t.charger
      : t.ordinary;
  e.forEachCollisionBody(i, (a, c, l) => {
    if (r && l === void 0) throw new Error("碰撞帧率历史缺少对手身份。");
    const u = r && l !== void 0 ? r.factor(l, n.networkCollisionScheduled) : 1,
      h = n.body,
      d = n.collisionShape,
      f = Pi0(
        {
          position: Nd(h.position),
          rotation: RL(h.right, h.forward, h.up),
          velocity: Nd(h.linearVelocity),
          angularVelocity: Nd(h.angularVelocity),
          mass: n.tuning.mass,
          halfWidth: d.rawHalfWidth,
          halfLength: d.rawHalfLength,
          scaleX: s.scaleX,
          scaleY: s.scaleY,
        },
        a,
        o,
        c,
        u,
      );
    if ((r && l !== void 0 && r.record(l, f !== void 0), f)) {
      const p = n.giant,
        v = l === void 0 ? void 0 : e.giant(l);
      if (p) {
        if (!v) throw new Error("巨人碰撞缺少对手规则 owner。");
        if (
          (p.processKartContact(
            v,
            n.displaySpeedKmh(),
            Fi0(a.velocity),
            i,
            n.giantSourceProtected(),
          ),
          v.flattened)
        )
          return;
      }
      n.applyKartPairResponse(dE(f.linear), dE(f.angular), f.strength);
    }
  });
}
const h1 = Math.fround;
class Vi0 {
  constructor(e, t) {
    ((this.localId = t),
      (this.raceId = e.raceId),
      (this.special = G2(e) !== "ordinary"));
    for (const i of e.roster) {
      if (i.playerId === t) continue;
      const r = i.equipment?.itemIds[12];
      if (
        typeof r != "number" ||
        !Number.isInteger(r) ||
        r < 0 ||
        r > 65535 ||
        this.peers.has(i.playerId)
      )
        throw new Error(
          "Distance cadence requires frozen participant equipment",
        );
      const s = r !== 0;
      this.peers.set(i.playerId, {
        slot: i.slot,
        fixed: s,
        tier: s ? 1 : 2,
        collisionMode: 0,
        loaded: !1,
        lastReceipt: 0,
        gap: 0,
      });
    }
  }
  localId;
  peers = new Map();
  lastTick = 0;
  previousMode;
  previousSuspended;
  disposed = !1;
  raceId;
  special;
  updateRoom(e) {
    if (!this.disposed) {
      if (
        e.race?.raceId !== this.raceId ||
        !e.members.some((t) => t.playerId === this.localId)
      ) {
        this.dispose();
        return;
      }
      for (const [t, i] of this.peers) {
        const r = e.members.find((s) => s.playerId === t);
        if (!r) {
          this.peers.delete(t);
          continue;
        }
        (i.slot !== r.slot &&
          ((i.slot = r.slot),
          (i.tier = i.fixed ? 1 : 2),
          (i.collisionMode = 0)),
          (i.loaded = e.race.loadedIds.includes(t)));
      }
    }
  }
  recordReceipt(e, t) {
    const i = this.peers.get(e);
    if (!i || this.disposed) return;
    const r = Math.trunc(t) >>> 0;
    ((i.gap = i.lastReceipt ? (r - i.lastReceipt) >>> 0 : 0),
      (i.lastReceipt = r));
  }
  observe(e, t) {
    const i = this.peers.get(e);
    if (!i || this.disposed) return;
    const r = t.kind === "kinematic" ? t.routing : void 0;
    ((i.target = r?.observedPlayerId),
      (i.motionMode = r?.motionMode),
      (i.resetting = t.kind === "kinematic" && t.resetStartedAt !== void 0));
  }
  select(e, t, i, r, s, o) {
    if (this.disposed) return 0;
    let a = 0;
    for (let u = 1; u <= 5; u++) {
      if (
        Math.floor(this.lastTick / 2 ** (u + 5)) ===
        Math.floor(e / 2 ** (u + 5))
      ) {
        a = u - 1;
        break;
      }
      a = u;
    }
    this.lastTick = e;
    const c = this.previousMode !== t || this.previousSuspended !== i;
    if (((this.previousMode = t), (this.previousSuspended = i), !a)) return 0;
    let l = 0;
    for (const u of this.peers.values()) {
      if (!u.loaded) continue;
      const h = u.target ? this.peers.get(u.target) : void 0,
        d = u.target === this.localId ? r : h?.loaded ? s(u.target) : void 0;
      if (
        this.special ||
        t !== 0 ||
        i ||
        c ||
        u.motionMode !== 0 ||
        u.resetting ||
        !d ||
        (u.target !== this.localId && (h?.motionMode !== 0 || h?.resetting))
      ) {
        ((l |= 1 << u.slot), (u.collisionMode = 0));
        continue;
      }
      if (u.tier > a || ((l |= 1 << u.slot), u.fixed)) continue;
      const p = h1(h1(r.x) - h1(d.x)),
        v = h1(h1(-r.z) - h1(-d.z)),
        w = h1(h1(r.y) - h1(d.y)),
        g = h1(h1(h1(p * p) + h1(v * v)) + h1(w * w));
      ((u.tier = g < 1600 && o(u.slot) ? 1 : g < 3600 ? 2 : g < 1e4 ? 3 : 4),
        (u.collisionMode = u.tier));
    }
    return l;
  }
  collisionScale(e, t) {
    const i = this.peers.get(e);
    return this.disposed ||
      !i ||
      i.collisionMode !== 1 ||
      h1(i.gap) <= 180 ||
      t === void 0 ||
      t > 100
      ? 1
      : h1(Math.pow(0.5, h1(h1(h1(i.gap) - h1(180)) * h1(0.025))));
  }
  dispose() {
    ((this.disposed = !0), this.peers.clear());
  }
}
class Ni0 {
  constructor(e, t, i) {
    if (
      ((this.enabled = e),
      (this.counter = i),
      t.length > 7 || new Set(t).size !== t.length)
    )
      throw new Error("碰撞帧率历史缺少唯一的本局对手身份。");
    for (const r of t) this.previous.set(r, !1);
  }
  enabled;
  counter;
  previous = new Map();
  factor(e, t) {
    const i = this.previous.get(e);
    if (i === void 0) throw new Error("碰撞帧率历史收到本局之外的对手。");
    if (!this.enabled || !i) return 1;
    const r = this.counter.fps;
    return r < 30 ? 2 : r < 60 ? Math.fround(60 / r) : r === 60 || t ? 1 : 0;
  }
  record(e, t) {
    if (!this.previous.has(e))
      throw new Error("碰撞帧率历史收到本局之外的对手。");
    this.previous.set(e, t);
  }
  dispose() {
    this.previous.clear();
  }
}
const M9 = Math.fround,
  Od = (n, e) => Math.hypot(n.x - e.x, n.y - e.y, n.z - e.z);
function Oi0(n, e) {
  if (!Number.isFinite(n) || n < 0) return { drag: 1, steering: 1 };
  let t = n;
  for (const o of e)
    o.progress &&
      Number.isFinite(o.progress.distance) &&
      o.progress.distance >= 0 &&
      o.progress.distance > t &&
      (t = o.progress.distance);
  const i = M9(Math.max(0, M9(t - n)));
  if (i === 0) return { drag: 1, steering: 1 };
  const r =
      i < M9(300)
        ? M9(M9(1) - Math.min(M9(0.1), M9(i / M9(400))))
        : M9(M9(1) - M9(M9(0.1) + Math.min(M9(0.05), M9(i / M9(16e3))))),
    s = M9(M9(1) - Math.min(M9(0.05), M9(i / M9(1e3))));
  return { drag: r, steering: s };
}
function zi0(n, e) {
  if (!Number.isFinite(n) || n < 0) return;
  let t = n;
  for (const r of e)
    r.progress &&
      Number.isFinite(r.progress.distance) &&
      r.progress.distance > t &&
      (t = r.progress.distance);
  if (t === n) return;
  const i = M9(t - n);
  return i >= M9(701)
    ? M9(1.8)
    : i >= M9(401)
      ? M9(1.4)
      : i >= M9(201)
        ? M9(1.2)
        : 1;
}
class fE {
  history = new Map();
  chargeStart;
  activeStart;
  cooldownStart;
  presentationVisible = !1;
  hudActive = !1;
  get windowActive() {
    return this.activeStart !== void 0;
  }
  update(e, t, i, r, s, o, a = !1) {
    this.hudActive = this.activeStart !== void 0;
    const c = new Set(r.map((u) => u.playerId));
    for (const u of this.history.keys()) c.has(u) || this.history.delete(u);
    let l = !1;
    for (const u of r) {
      if (
        ![
          u.position.x,
          u.position.y,
          u.position.z,
          u.forward.x,
          u.forward.y,
          u.forward.z,
        ].every(Number.isFinite)
      )
        continue;
      const h = this.history.get(u.playerId) ?? [];
      if (
        ((h.length === 0 || Od(u.position, h.at(-1)) > 6) &&
          (h.push({ ...u.position }), h.length > 5 && h.shift()),
        this.history.set(u.playerId, h),
        !(l || h.length < 2 || Od(u.position, t) > 50))
      ) {
        for (let d = h.length - 1; d >= 0; d--)
          if (!(Od(h[d], t) >= 6)) {
            if (d === h.length - 1) {
              const f = {
                x: u.position.x - t.x,
                y: u.position.y - t.y,
                z: u.position.z - t.z,
              };
              if (f.x * u.forward.x + f.y * u.forward.y + f.z * u.forward.z < 0)
                break;
            }
            l = !0;
            break;
          }
      }
    }
    if (
      ((!Number.isFinite(e) ||
        !Number.isFinite(i) ||
        !Number.isFinite(o) ||
        !Number.isFinite(s) ||
        s <= 0 ||
        o <= 1 ||
        o > 4 ||
        a ||
        i < 100) &&
        (l = !1),
      this.activeStart !== void 0)
    )
      if (e > this.activeStart + s)
        ((this.activeStart = void 0), (this.cooldownStart = e));
      else
        return (
          (this.chargeStart = void 0),
          (this.presentationVisible = !1),
          M9(o)
        );
    return l
      ? this.cooldownStart !== void 0 && e < this.cooldownStart + 3e3
        ? ((this.presentationVisible = !1), 1)
        : ((this.presentationVisible = !0),
          (this.chargeStart ??= e),
          e > this.chargeStart + 2500 ? ((this.activeStart = e), M9(o)) : 1)
      : ((this.chargeStart = void 0), (this.presentationVisible = !1), 1);
  }
  reset() {
    (this.history.clear(),
      (this.chargeStart = void 0),
      (this.activeStart = void 0),
      (this.cooldownStart = void 0),
      (this.presentationVisible = !1),
      (this.hudActive = !1));
  }
}
class Ui0 {
  constructor(e, t, i, r, s, o) {
    ((this.assets = e),
      (this.connection = i),
      (this.onError = s),
      (this.rpIdentity = t.rp ? mI(t.rp) : void 0),
      (this.roadblockIdentity = t.roadblock
        ? Object.freeze({ ...t.roadblock })
        : void 0),
      (this.lteIdentity = t.lte ? Object.freeze({ ...t.lte }) : void 0),
      (this.giantIdentity = t.giant ? Object.freeze({ ...t.giant }) : void 0),
      (this.collisionFramerate = new Ni0(
        e.checkClientFramerate && e.channel.adjustCollision,
        e.participants
          .filter((c) => c.playerId !== i.playerId)
          .map((c) => c.playerId),
        o,
      )));
    let a;
    try {
      if (e.channel.name !== t.channelName)
        throw new Error("比赛频道与已加载资源不一致。");
      if (
        ((a = new Ci0(e, t, i.playerId)),
        (this.local = a),
        a.giant && !i.sendGiantState)
      )
        throw new Error("缺少巨人可靠状态发送通道。");
      if (
        ((this.cadence = new Vi0(t, i.playerId)),
        e.mode === "team" && e.speed !== 4)
      ) {
        if (!i.sendTeamCharge || !i.subscribeTeamGauge)
          throw Error("缺少组队集气通道。");
        const l = t.roster.find((u) => u.playerId === i.playerId).team;
        this.offTeam = i.subscribeTeamGauge((u) => {
          this.disposed ||
            u.team !== l ||
            u.sequence <= this.teamSequence ||
            this.room?.phase !== "racing" ||
            ((this.teamSequence = u.sequence),
            this.local.physics.enqueueMultiplayerTeamTarget(u.target));
        });
      }
      this.remotes = new Bi0(
        e,
        i,
        r,
        (l) => {
          try {
            s(l);
          } finally {
            this.dispose();
          }
        },
        this.cadence,
      );
      const c = e.participants.find(
        (l) => l.playerId === i.playerId,
      ).collisionBalance;
      this.local.queueRemoteKart(
        {
          name: "GoNetKart[]",
          category: 0,
          active: !0,
          removeRequested: !1,
          slot12: (l) => {
            (this.remoteFrameUpdated || this.updateRemotes(l),
              this.local.giant?.updateEffects(l),
              this.remotes.updateGiantEffects(l));
          },
          slot13: () => {},
          commit: () => {},
          destroy: () => {},
        },
        (l) =>
          Di0(this.local.physics, this.remotes, c, l, this.collisionFramerate),
      );
    } catch (c) {
      throw (
        this.collisionFramerate.dispose(),
        this.offTeam?.(),
        this.cadence?.dispose(),
        a?.dispose(),
        e.dispose(),
        c
      );
    }
  }
  assets;
  connection;
  onError;
  local;
  remotes;
  localPresentation;
  presentation = new I40();
  slipstream = new fE();
  remoteSlipstreams = new Map();
  disposed = !1;
  clockBound = !1;
  mapping;
  room;
  finishReported = !1;
  offTeam;
  teamSequence = 0;
  teamSentSequence = 0;
  teamCharge = 0;
  teamSentAt = -1 / 0;
  finishDeadline;
  sender;
  cadence;
  collisionFramerate;
  remotePhysicsBypass = !1;
  remoteFrameUpdated = !1;
  rpIdentity;
  roadblockIdentity;
  lteIdentity;
  giantIdentity;
  giantSequence = 0;
  giantSend = Promise.resolve();
  giantCleared = !1;
  get giantEffectsEnded() {
    return this.giantCleared;
  }
  bindClock(e) {
    if (this.disposed || this.clockBound)
      throw new Error("Race clock already bound or released");
    if ((this.remotes.bindClock(e), !this.cadence))
      throw new Error("Race cadence is not prepared");
    ((this.sender = new ki0(this.local.physics, new BL(e), this.connection, {
      cadence: this.cadence,
      playerId: this.connection.playerId,
      position: (t) => this.remotes.copyWebPose(t)?.position,
    })),
      (this.clockBound = !0),
      (this.mapping = e));
  }
  scheduleStart(e) {
    if (this.disposed || !this.clockBound)
      throw new Error("Race clock is not ready");
    this.local.scheduleStart(e);
  }
  updateRoom(e) {
    if (this.disposed) return;
    if (
      e.channelName !== this.assets.channel.name ||
      G2(e) !== (this.assets.drivingMode?.kind ?? "ordinary") ||
      (e.race &&
        (e.race.channelName !== this.assets.channel.name ||
          G2(e.race) !== G2(e) ||
          !t7(e.race.rp, this.rpIdentity) ||
          !oR(e.race.roadblock, this.roadblockIdentity) ||
          !Nw(e.race.lte, this.lteIdentity) ||
          !yI(e.race.giant, this.giantIdentity)))
    ) {
      try {
        this.onError(new Error("比赛期间频道身份发生变化。"));
      } finally {
        this.dispose();
      }
      return;
    }
    if (e.phase === "open") {
      if (this.room?.race?.results) return;
      this.dispose();
      return;
    }
    if (
      e.roomId !== this.assets.roomId ||
      e.race?.raceId !== this.assets.raceId ||
      !e.members.some((i) => i.playerId === this.connection.playerId)
    ) {
      this.dispose();
      return;
    }
    const t =
      e.race?.finishDeadline !== void 0 &&
      e.race.finishDeadline !== this.room?.race?.finishDeadline;
    if (
      ((this.room = structuredClone(e)),
      this.cadence?.updateRoom(e),
      t &&
        this.local.lifecycle.state === X2.Racing &&
        this.connection.resetMotionRtt?.(),
      this.remotes.updateRoom(e),
      this.mapping)
    ) {
      this.finishDeadline =
        e.race?.finishDeadline === void 0
          ? void 0
          : Y3(e.race.finishDeadline, this.mapping);
      const i = e.race?.roadblockOutcome?.endAt;
      this.local.acceptEndTiming(
        i === void 0 ? this.finishDeadline : Y3(i, this.mapping),
        e.race?.raceOverAt === void 0
          ? void 0
          : Y3(e.race.raceOverAt, this.mapping),
        !!e.race?.results,
      );
    }
  }
  update(e, t, i) {
    if (this.disposed) return [];
    try {
      ((this.remotePhysicsBypass = i), (this.remoteFrameUpdated = !1));
      const r = this.local.physics;
      if (this.local.lifecycle.state === X2.Racing) {
        const l = [],
          u = new Map();
        ((this.remoteFrameUpdated = !0),
          this.remotes.updateAndForEachFreshRacePeer(
            e,
            { bypass: i, locked: !1 },
            (g, y, b, A) => {
              b &&
                (l.push({
                  playerId: g,
                  position: b.position,
                  forward: b.forward,
                  progress: y,
                }),
                u.set(g, A));
            },
          ));
        const h = Oi0(this.local.raceProgress().distance, l),
          d = this.assets.participants.find(
            (g) => g.playerId === this.connection.playerId,
          ).vehicle.physicsParams,
          f =
            Math.hypot(
              r.body.linearVelocity.x,
              r.body.linearVelocity.y,
              r.body.linearVelocity.z,
            ) * 3.6,
          p = this.slipstream.update(
            e,
            r.body.position,
            f,
            l,
            d.draftTick ?? 0,
            d.draftMulAccelFactor ?? 1,
            this.local.resetSuspended,
          );
        r.setMultiplayerDrivingScales({
          catchupDrag: h.drag,
          catchupSteering: h.steering,
          draftAcceleration: p,
          chargerDuration: zi0(this.local.raceProgress().distance, l),
        });
        const v = {
            playerId: this.connection.playerId,
            position: r.body.position,
            forward: r.body.forward,
            progress: this.local.raceProgress(),
          },
          w = new Set(l.map((g) => g.playerId));
        for (const g of this.remoteSlipstreams.keys())
          w.has(g) || this.remoteSlipstreams.delete(g);
        for (const g of l) {
          let y = this.remoteSlipstreams.get(g.playerId);
          y || ((y = new fE()), this.remoteSlipstreams.set(g.playerId, y));
          const b = this.assets.participants.find(
            (A) => A.playerId === g.playerId,
          ).vehicle.physicsParams;
          y.update(
            e,
            g.position,
            u.get(g.playerId),
            [v, ...l.filter((A) => A.playerId !== g.playerId)],
            b.draftTick ?? 0,
            b.draftMulAccelFactor ?? 1,
          );
        }
      } else
        (this.slipstream.reset(),
          this.remoteSlipstreams.clear(),
          r.setMultiplayerDrivingScales({
            catchupDrag: 1,
            catchupSteering: 1,
            draftAcceleration: 1,
            chargerDuration: 1,
          }));
      const s = this.local.update(e, t);
      if (this.local.giant) {
        !this.giantCleared &&
          (this.local.lifecycle.state === X2.Result ||
            this.room?.phase === "finished") &&
          ((this.giantCleared = !0),
          this.local.physics.clearGiantRaceEffects(),
          this.remotes.resetGiants());
        for (const l of this.local.giant.consumePackets()) {
          const u = ++this.giantSequence;
          this.giantSend = this.giantSend
            .then(() => {
              if (!(this.disposed || this.giantCleared))
                return this.connection.sendGiantState(l, u);
            })
            .catch((h) => {
              !this.disposed &&
                this.room?.phase === "racing" &&
                this.onError(h);
            });
        }
      }
      if (s.some((l) => l.kind === "natural-finish") && !this.finishReported) {
        if (
          ((this.finishReported = !0),
          this.connection.resetMotionRtt?.(),
          !this.connection.reportFinish)
        )
          throw new Error("本局连接缺少完赛上报能力。");
        const l = this.local.lifecycle.finishedElapsedMs,
          u = () =>
            this.disposed ? Promise.resolve() : this.connection.reportFinish(l);
        (this.local.giant ? this.giantSend.then(u) : u()).catch((h) => {
          !this.disposed && this.room?.phase !== "finished" && this.onError(h);
        });
      }
      if (
        this.assets.mode === "team" &&
        this.assets.speed !== 4 &&
        this.assets.drivingMode?.kind !== "grip" &&
        ((this.teamCharge = Math.fround(
          this.teamCharge + this.local.physics.consumeMultiplayerTeamCharge(),
        )),
        this.local.lifecycle.state === X2.Racing &&
          this.teamCharge > 0 &&
          e - this.teamSentAt >= 100)
      ) {
        const l = this.teamCharge;
        ((this.teamCharge = 0),
          (this.teamSentAt = e),
          this.connection
            .sendTeamCharge(l, ++this.teamSentSequence)
            .catch((u) => {
              !this.disposed &&
                this.room?.phase === "racing" &&
                !this.finishReported &&
                this.onError(u);
            }));
      }
      const o = B40(this.local.physics, t),
        a = R40(this.local.physics),
        c = this.presentation.capture(o, t, a);
      return (
        (this.localPresentation = {
          motion: o,
          frontLamp: c.frontLamp,
          rearLamp: c.rearLamp,
          animation: a,
        }),
        this.remoteFrameUpdated || this.updateRemotes(e),
        !this.disposed &&
          this.room?.phase !== "finished" &&
          this.room?.race?.loadedIds.includes(this.connection.playerId) &&
          this.local.lifecycle.state !== X2.Result &&
          this.sender?.update(
            e,
            c,
            this.local.raceProgress(),
            this.local.resetSuspended || this.local.lifecycle.state < X2.Racing,
            this.local.resetStartedAt,
          ),
        s
      );
    } catch (r) {
      if (this.disposed) throw r;
      try {
        this.onError(r);
      } finally {
        this.dispose();
      }
      return [];
    }
  }
  raceSnapshot() {
    return this.room?.race;
  }
  latencyMs(e) {
    return this.connection.latencyMs?.(e);
  }
  draftPresentationVisible(e) {
    return e === this.connection.playerId
      ? this.slipstream.presentationVisible
      : (this.remoteSlipstreams.get(e)?.presentationVisible ?? !1);
  }
  draftBurstActive(e) {
    return e === this.connection.playerId
      ? this.slipstream.hudActive
      : (this.remoteSlipstreams.get(e)?.hudActive ?? !1);
  }
  localDraftHudActive() {
    return this.slipstream.hudActive;
  }
  updateRemotes(e) {
    this.remoteFrameUpdated = !0;
    const t = this.local.lifecycle.state;
    this.remotes.update(e, {
      bypass: this.remotePhysicsBypass,
      locked:
        t < X2.Racing ||
        t === X2.Result ||
        this.local.lifecycle.raceoverShown === !0,
    });
  }
  resultSnapshot() {
    return this.room?.race?.results;
  }
  roadBlockRunnerProgress() {
    const e = this.roadblockIdentity?.runnerId;
    if (e)
      return e === this.connection.playerId
        ? this.local.raceProgress()
        : this.remotes.raceProgress(e);
  }
  roadBlockRemaining(e) {
    if (!this.roadblockIdentity) return;
    const t = this.room?.race?.startAt;
    if (t === void 0 || !this.mapping) return this.roadblockIdentity.limitMs;
    const i = this.room?.race?.roadblockOutcome?.endAt;
    return Math.max(
      0,
      Math.min(
        this.roadblockIdentity.limitMs,
        this.roadblockIdentity.limitMs -
          ((i === void 0 ? e : Y3(i, this.mapping)) - Y3(t, this.mapping)),
      ),
    );
  }
  finishSnapshot() {
    return this.room?.race?.finishes ?? [];
  }
  dispose() {
    this.disposed ||
      ((this.disposed = !0),
      this.sender?.dispose(),
      (this.sender = void 0),
      this.offTeam?.(),
      (this.offTeam = void 0),
      (this.teamCharge = 0),
      this.slipstream.reset(),
      this.remoteSlipstreams.clear(),
      this.collisionFramerate.dispose(),
      this.local.physics.setMultiplayerDrivingScales({
        catchupDrag: 1,
        catchupSteering: 1,
        draftAcceleration: 1,
        chargerDuration: 1,
      }),
      this.remotes.dispose(),
      this.cadence?.dispose(),
      this.local.dispose(),
      this.assets.dispose());
  }
}
const NL = 0.6796875;
function zn(n) {
  return n.uniforms?.normalUvOffset !== void 0;
}
function OL(n) {
  (n.uniforms.normalUvOffset.value.set(n.uniforms.normalUvOffset.value.x, NL),
    (n.uniforms.alphaTestEnabled.value = 1),
    (n.uniforms.alphaFunction.value = 5),
    (n.uniforms.alphaReference.value = 0),
    (n.transparent = !0),
    (n.blending = u1),
    (n.blendSrc = l1),
    (n.blendDst = v1),
    (n.blendEquation = R9));
}
function f6(n, e) {
  ((e.uniforms.toonEnv.value = n.uniforms.toonEnv.value),
    e.uniforms.clientWorld.value.copy(n.uniforms.clientWorld.value),
    e.uniforms.clientWorldInverse.value.copy(
      n.uniforms.clientWorldInverse.value,
    ),
    e.uniforms.viewOriginClient.value.copy(n.uniforms.viewOriginClient.value));
}
class $i0 {
  bindings = [];
  constructor(e) {
    try {
      (e.traverse((t) => {
        if (!(t instanceof D2)) return;
        const i = t.material,
          r = [],
          s = (Array.isArray(i) ? i : [i]).map((c) => {
            if (!zn(c)) return c;
            const l = c.clone();
            return (
              (l.uniforms.baseMap.value = c.uniforms.baseMap.value),
              (l.uniforms.toonEnv.value = c.uniforms.toonEnv.value),
              OL(l),
              r.push({ source: c, clone: l }),
              l
            );
          });
        if (r.length === 0) return;
        let o;
        try {
          o = QG(t);
        } catch (c) {
          for (const l of r) l.clone.dispose();
          throw c;
        }
        const a = t.onBeforeRender;
        (this.bindings.push({
          mesh: t,
          original: i,
          callback: a,
          restoreRecord: o,
          pairs: r,
        }),
          (t.material = Array.isArray(i) ? s : s[0]),
          (t.onBeforeRender = function (...c) {
            a.apply(this, c);
            for (const l of r) f6(l.source, l.clone);
          }));
      }),
        this.update());
    } catch (t) {
      throw (this.dispose(), t);
    }
  }
  update() {
    for (const e of this.bindings)
      for (const t of e.pairs) f6(t.source, t.clone);
  }
  dispose() {
    for (const e of this.bindings.splice(0).reverse()) {
      ((e.mesh.material = e.original),
        (e.mesh.onBeforeRender = e.callback),
        e.restoreRecord());
      for (const t of e.pairs) t.clone.dispose();
    }
  }
}
function pE(n, e, t, i) {
  if (n.kind !== "fixed" || n.category !== "vec3" || n.keyType !== 1)
    throw new Error("CharSequence position 仅支持 Vec3 keyType1。 ");
  const r = n.records.map((h) => {
      const d = p6(h);
      return {
        time: d.getUint32(0, !0),
        value: [d.getFloat32(4, !0), d.getFloat32(8, !0), d.getFloat32(12, !0)],
      };
    }),
    [s, o] = Sv(r),
    a = Cv(e.base, t, i, s, o),
    c = Ev(r, a);
  if (c.left === c.right) return c.left.value;
  const l = zL(c.left.time, c.right.time, a),
    u = u2(1 - l);
  return [0, 1, 2].map((h) =>
    u2(u2(c.left.value[h] * u) + u2(c.right.value[h] * l)),
  );
}
function Wi0(n, e, t, i, r = Ki0) {
  if (n.kind !== "fixed" || n.category !== "rotation" || n.keyType !== 1)
    throw new Error("CharSequence rotation 仅支持 quaternion keyType1。 ");
  const s = n.records.map((u) => {
      const h = p6(u);
      return {
        time: h.getUint32(0, !0),
        value: [
          h.getFloat32(8, !0),
          h.getFloat32(12, !0),
          h.getFloat32(16, !0),
          h.getFloat32(4, !0),
        ],
      };
    }),
    [o, a] = Sv(s),
    c = Cv(e.base, t, i, o, a),
    l = Ev(s, c);
  return l.left === l.right
    ? l.left.value
    : r(l.left.value, l.right.value, zL(l.left.time, l.right.time, c));
}
function Hi0(n, e, t) {
  const i = n.keys.value;
  if (i.kind !== "fixed" || i.category !== "integer" || i.keyType !== 3)
    throw new Error("CharSequence root 仅支持 Int keyType3。 ");
  const r = i.records.map((c) => ({
      time: p6(c).getUint32(0, !0),
      value: p6(c).getInt32(4, !0),
    })),
    [s, o] = Sv(r),
    a = Cv(n.base, e, t, s, o);
  return Ev(r, a).left.value;
}
function Sv(n) {
  return n.length > 1 ? [n[0].time, n[n.length - 1].time] : [0, 0];
}
function Cv(n, e, t, i, r) {
  e.anchor === 0 && t !== 0 && (e.anchor = t);
  const s = (e.anchor + n.phase) >>> 0;
  let o = t < s ? 0 : (t + n.phase - e.anchor) >>> 0;
  Yi0(n.frequency) !== 1065353216 &&
    (o = Math.trunc(u2(u2(o) * n.frequency)) >>> 0);
  const a = Math.trunc(u2(u2((r - i) >>> 0) * n.frequency)) >>> 0;
  if (a === 0) return o;
  if (n.cycleMode === 0) return ((o % a) + i) >>> 0;
  if (n.cycleMode === 1) {
    const c = Math.floor(o / a) >>> 0;
    (c !== e.previousCycle && (e.reverseHalf = !e.reverseHalf),
      (e.previousCycle = c));
    const l = o % a;
    return e.reverseHalf ? (a - l) >>> 0 : l;
  }
  return n.cycleMode === 2 ? (o < i ? i : o > r ? r : o) : t;
}
function Ev(n, e) {
  if (n.length === 0) throw new Error("CharSequence track 不含 key。 ");
  let t = 0;
  for (; t + 1 < n.length && e > n[t + 1].time;) t += 1;
  return { left: n[t], right: n[Math.min(t + 1, n.length - 1)] };
}
function zL(n, e, t) {
  const i = (e - n) >>> 0;
  return i === 0 ? 0 : u2(u2((t - n) >>> 0) / u2(i));
}
function qi0(n) {
  return { translation: [...n.translation], rotation: [...n.rotation] };
}
function Ki0(n, e, t) {
  const i = u2(ji0(n, e));
  let r = u2(1 - u2(i * u2(0.82279688)));
  r = u2(u2(r * r) * u2(0.58549219));
  let s;
  if (t > 0.5) {
    const l = u2(1 - t);
    s = u2(1 - u2(u2(u2(u2(u2(l + l) - 3) * u2(r * l)) + 1 + r) * l));
  } else s = u2(u2(u2(u2(u2(t + t) - 3) * u2(r * t)) + 1 + r) * t);
  const o = [0, 1, 2, 3].map((l) => u2(u2(e[l] - n[l]) * s + n[l])),
    a = u2(u2(u2(o[0] * o[0] + o[1] * o[1]) + o[2] * o[2]) + o[3] * o[3]);
  let c = u2(u2(a - u2(0.95906597)) * u2(-0.53251559) + u2(1.0214351));
  return (
    a <= u2(0.91521198) &&
      ((c = gE(a, c)), a <= u2(0.6521197) && (c = gE(a, c))),
    o.map((l) => u2(l * c))
  );
}
function gE(n, e) {
  return u2(
    e *
      u2(
        u2(u2(u2(e * e) * n) - u2(0.95906597)) * u2(-0.53251559) +
          u2(1.0214351),
      ),
  );
}
function ji0(n, e) {
  return u2(
    u2(u2(u2(n[0] * e[0]) + u2(n[1] * e[1])) + u2(n[2] * e[2])) +
      u2(n[3] * e[3]),
  );
}
function Xi0() {
  return { anchor: 0, previousCycle: 0, reverseHalf: !1 };
}
function p6(n) {
  return new DataView(n.buffer, n.byteOffset, n.byteLength);
}
function Yi0(n) {
  const e = new ArrayBuffer(4),
    t = new DataView(e);
  return (t.setFloat32(0, n, !0), t.getUint32(0, !0));
}
function u2(n) {
  return Math.fround(n);
}
const jt = Math.fround,
  z5 = (n, e) => jt(n + e),
  U3 = (n, e) => jt(n - e),
  p1 = (n, e) => jt(n * e),
  Lg = (n, e) =>
    z5(z5(z5(p1(n[3], e[3]), p1(n[0], e[0])), p1(n[1], e[1])), p1(n[2], e[2]));
function UL(n, e, t) {
  let i = U3(1, p1(Lg(n, e), jt(0.82279688)));
  i = p1(p1(i, i), jt(0.58549219));
  const r = (u) => p1(z5(z5(p1(U3(z5(u, u), 3), p1(i, u)), 1), i), u),
    s = t > 0.5 ? U3(1, r(U3(1, t))) : r(t),
    o = n.map((u, h) => z5(p1(U3(e[h], u), s), u)),
    a = Lg(o, o),
    c = (u) => z5(p1(U3(u, jt(0.95906597)), jt(-0.53251559)), jt(1.0214351));
  let l = c(a);
  return (
    a <= jt(0.91521198) &&
      ((l = p1(l, c(p1(p1(l, l), a)))),
      a <= jt(0.6521197) && (l = p1(l, c(p1(p1(l, l), a))))),
    o.map((u) => p1(u, l))
  );
}
function Zi0(n, e, t) {
  const i =
    Lg(n.rotation, e.rotation) < 0 ? e.rotation.map((r) => -r) : e.rotation;
  return {
    translation: [0, 1, 2].map((r) =>
      z5(p1(n.translation[r], U3(1, t)), p1(e.translation[r], t)),
    ),
    rotation: UL(n.rotation, i, t),
  };
}
const o9 = Math.fround,
  Qi0 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0],
  zd = () => ({ translation: [0, 0, 0], rotation: [0, 0, 0, 0] });
class cc {
  target;
  clocks = new Map();
  elapsed = 0;
  previous = 0;
  blend = 0;
  samples = [];
  from = [];
  to = [];
  matrices = [];
  selector = 0;
  pending;
  constructor(e) {
    this.bind(e, 0);
  }
  get sequence() {
    return this.target;
  }
  get faceSlot() {
    return this.selector;
  }
  get pose() {
    return this.matrices;
  }
  reset(e) {
    (this.clocks.clear(),
      (this.elapsed = this.previous = this.blend = 0),
      (this.pending = void 0),
      (this.samples = []),
      (this.matrices.length = 0),
      this.bind(e));
  }
  bind(e, t = 0, i = !1, r = 300, s = 0) {
    const o = e.channels.length;
    if (
      !o ||
      o > 256 ||
      e.rootChannel.value.className !== "IntTontroller" ||
      e.map.length > 8 ||
      e.channels.some((c) => c.value.className !== "PRSTontroller")
    )
      throw new Error("飞宠动作通道或纹理槽格式不受支持。");
    i && this.target
      ? (this.pending = {
          sequence: this.pending?.sequence ?? this.target,
          blend: this.pending?.blend ?? r,
          threshold: ((s || e.header[2]) + t) >>> 0,
        })
      : (this.pending = void 0);
    const a = this.target?.channels.length ?? 0;
    ((this.from = Array.from({ length: o }, (c, l) =>
      l < a ? qi0(this.samples[l] ?? zd()) : zd(),
    )),
      (this.to = e.channels.map((c, l) => (l < a ? Ji0(c.value) : zd()))));
    for (let c = a; c < o; c++) this.matrices[c] = Qi0;
    ((this.blend = this.elapsed !== 0 ? t >>> 0 : 0),
      (this.elapsed = 0),
      (this.target = e),
      this.blend && (this.selector = er0(e.rootChannel.value)));
  }
  update(e) {
    if (((e >>>= 0), this.pending)) {
      const t = this.pending;
      (t.anchor || (t.anchor = e),
        (e - t.anchor) >>> 0 >= t.threshold && this.bind(t.sequence, t.blend));
    }
    if (
      ((this.elapsed =
        this.elapsed === 0 ? 1 : (this.elapsed - this.previous + e) >>> 0),
      (this.previous = e),
      this.blend && this.elapsed <= this.blend)
    ) {
      const t = o9(o9(this.elapsed) * o9(1 / o9(this.blend)));
      this.samples = this.from.map((i, r) => Zi0(i, this.to[r], t));
    } else {
      if (this.blend) {
        ((this.elapsed = (this.elapsed - this.blend) >>> 0), (this.blend = 0));
        for (const t of this.target.channels) this.clock(t.value).anchor = 0;
        this.clock(this.target.rootChannel.value).anchor = 0;
      }
      ((this.samples = this.target.channels.map((t) => {
        const i = t.value,
          r = this.clock(i),
          s = i.position ? pE(i.position.value, i, r, this.elapsed) : [0, 0, 0],
          o = i.rotation
            ? Wi0(i.rotation.value, i, r, this.elapsed, UL)
            : [0, 0, 0, 1];
        return (
          i.scale && pE(i.scale.value, i, r, this.elapsed),
          { translation: s, rotation: o }
        );
      })),
        (this.selector = Hi0(
          this.target.rootChannel.value,
          this.clock(this.target.rootChannel.value),
          this.elapsed,
        )));
    }
    if (
      (this.samples.forEach((t, i) => {
        this.matrices[i] = tr0(t);
      }),
      !Number.isInteger(this.selector) ||
        this.selector < 0 ||
        this.selector >= this.target.map.length)
    )
      throw new Error("飞宠动作选择了无效纹理槽。");
    return this.matrices;
  }
  clock(e) {
    let t = this.clocks.get(e);
    return (t || ((t = Xi0()), this.clocks.set(e, t)), t);
  }
}
function Ji0(n) {
  const e = n.position?.value,
    t = n.rotation?.value;
  if (
    !e ||
    e.kind !== "fixed" ||
    e.records.length === 0 ||
    !t ||
    t.kind !== "fixed" ||
    t.records.length === 0
  )
    throw new Error("飞宠混合动作缺少位置/旋转首关键帧。");
  const i = Pg(e.records[0]),
    r = Pg(t.records[0]);
  return {
    translation: [
      i.getFloat32(4, !0),
      i.getFloat32(8, !0),
      i.getFloat32(12, !0),
    ],
    rotation: [
      r.getFloat32(8, !0),
      r.getFloat32(12, !0),
      r.getFloat32(16, !0),
      r.getFloat32(4, !0),
    ],
  };
}
function er0(n) {
  const e = n.keys.value;
  if (e.kind !== "fixed" || !e.records.length)
    throw new Error("飞宠贴图控制器缺少首帧。");
  return Pg(e.records[0]).getInt32(4, !0);
}
function Pg(n) {
  return new DataView(n.buffer, n.byteOffset, n.byteLength);
}
function tr0({ translation: [n, e, t], rotation: [i, r, s, o] }) {
  const a = o9(o9(i + i) * i),
    c = o9(o9(r + r) * r),
    l = o9(o9(s + s) * s),
    u = o9(o9(r + r) * i),
    h = o9(o9(s + s) * i),
    d = o9(o9(s + s) * r),
    f = o9(o9(i + i) * o),
    p = o9(o9(r + r) * o),
    v = o9(o9(s + s) * o);
  return [
    o9(1 - o9(c + l)),
    o9(u - v),
    o9(h + p),
    n,
    o9(u + v),
    o9(1 - o9(a + l)),
    o9(d - f),
    e,
    o9(h - p),
    o9(d + f),
    o9(1 - o9(a + c)),
    t,
  ];
}
class mE {
  constructor(e, t, i) {
    ((this.assets = e), (this.primary = t), (this.high = i));
  }
  assets;
  primary;
  high;
  textures = new Map();
  disposed = !1;
  body() {
    return this.load("body").then((e) => {
      if (!e) throw new Error("飞宠缺少主体贴图。");
      return e;
    });
  }
  face(e) {
    return this.load(`f${String(e).padStart(2, "0")}`);
  }
  dispose() {
    if (!this.disposed) {
      this.disposed = !0;
      for (const e of this.textures.values())
        e.then(
          (t) => t?.dispose(),
          () => {},
        );
      this.textures.clear();
    }
  }
  load(e) {
    if (this.disposed) throw new Error("飞宠贴图owner已释放。");
    let t = this.textures.get(e);
    return (t || ((t = this.create(e)), this.textures.set(e, t)), t);
  }
  async create(e) {
    const t = e === "body" || !!this.assets.find("f00_0.png"),
      i = t ? this.assets.find(e === "body" ? "0.png" : `${e}_0.png`) : void 0,
      r = this.assets.find(
        e === "body" ? "1.png" : t ? `${e}_1.png` : `${e}.png`,
      );
    if (!r) return;
    const s = await r.bytes(),
      o = await p2(s);
    let a = o.pixels;
    if (i) {
      const l = await i.bytes();
      if (l[24] === 8 && l[25] === 6 && s[24] === 8 && s[25] === 6) {
        const u = await p2(l);
        if (u.width === o.width && u.height === o.height)
          a = K6(u.pixels, a, this.primary, this.high);
        else if (e !== "body") return;
      } else if (e !== "body") return;
    } else if (t && e !== "body") return;
    const c = new J9(a, o.width, o.height, e9);
    return (
      (c.name = `${this.assets.name}:${e}`),
      (c.colorSpace = v9),
      (c.flipY = !1),
      (c.wrapS = c.wrapT = S1),
      (c.minFilter = c.magFilter = h9),
      (c.generateMipmaps = !1),
      (c.needsUpdate = !0),
      c
    );
  }
}
function nr0(n) {
  return new _o().set(
    n[0],
    n[1],
    n[2],
    n[3],
    n[4],
    n[5],
    n[6],
    n[7],
    n[8],
    n[9],
    n[10],
    n[11],
    0,
    0,
    0,
    1,
  );
}
function wE(n, e) {
  const t = {
      className: "AlphaProperty",
      blendEnable: 0,
      srcBlend: 2,
      dstBlend: 1,
      alphaTestEnable: 0,
      alphaFunc: 8,
      alphaRef: 0,
    },
    i = { className: "ZBufProperty", mode: 4, enabled: 1 },
    r = n?.slots[3]?.value,
    s = n?.slots[10]?.value;
  return {
    alpha: r?.className === "AlphaProperty" ? r : (e?.alpha ?? t),
    zbuf: s?.className === "ZBufProperty" ? s : (e?.zbuf ?? i),
  };
}
function ir0(n, e) {
  const t = (i, r) => ({ source: "property-bank", value: i, bankIndex: r });
  return {
    alpha: t(
      {
        kind: "alpha",
        blendEnable: n.blendEnable,
        srcBlend: n.srcBlend,
        dstBlend: n.dstBlend,
        alphaTestEnable: n.alphaTestEnable,
        compare: n.alphaFunc,
        alphaRef: n.alphaRef,
      },
      0,
    ),
    backface: t({ kind: "backface", cull: 2 }, 7),
    fog: t(
      {
        kind: "fog-property",
        selector: 0,
        mode: 1,
        color: 0,
        start: 0,
        end: 1,
        density: 1,
      },
      11,
    ),
    material: t(
      {
        kind: "material",
        mode: 0,
        ambient: 4294967295,
        diffuse: 4294967295,
        specular: 4294967295,
        power: 1,
        reserved: 0,
        emissive: 4294967295,
        controllers: [],
        controllerOccurrences: [],
      },
      12,
    ),
    texture: t(
      {
        kind: "texture",
        textureOp: 1,
        addressU: 1,
        addressV: 1,
        minFilter: 1,
        magFilter: 1,
        mipFilter: 0,
        maxAnisotropy: 1,
        uvControllers: [],
        uvControllerOccurrences: [],
        scalar: 1,
      },
      13,
    ),
    toon: t(
      {
        kind: "toon",
        flags: [1, 1],
        words: [1, 4, 4294967295, 1065353216, 0, 2, 0, 4278190080, 2130706432],
      },
      15,
    ),
    wire: t({ kind: "wire", enabled: 0 }, 16),
    zbuffer: t({ kind: "zbuffer", zFunc: e.mode, zWrite: e.enabled }, 19),
  };
}
function rr0(n) {
  const e = new Float32Array(n.faces.length * 9),
    t = new Float32Array(n.faces.length * 9),
    i = new Float32Array(n.faces.length * 6);
  n.faces.forEach((s, o) => {
    for (let a = 0; a < 3; a += 1) {
      const c = n.texcoords[s.texcoordIndices[a]];
      (e.set(n.positions[s.positionIndices[a]], o * 9 + a * 3),
        t.set(n.normals[c.normalIndex], o * 9 + a * 3),
        i.set([c.u, c.v], o * 6 + a * 2));
    }
  });
  const r = new t9();
  return (
    r.setAttribute("position", new _0(e, 3)),
    r.setAttribute("normal", new _0(t, 3)),
    r.setAttribute("uv", new _0(i, 2)),
    r
  );
}
function Ud(n, e) {
  (cn(n), c3(n, e));
}
function vE(n) {
  return [
    "ReKart",
    "Relement",
    "ReCharacter",
    "ReToonRigid",
    "ReTriList",
    "ReToonSkinned",
  ].includes(n.value.className);
}
function sr0(n) {
  const e = (t) => {
    const i = n.bones[t];
    if (!i) throw new Error("飞宠骨骼索引越界。");
    if (t !== 0 && i.enabled) {
      if (i.parentIndex >= t) throw new Error("飞宠骨骼父索引无效。");
      e(i.parentIndex);
    }
  };
  e(5);
  for (const t of n.vertices)
    for (const [i, r] of [
      [t.bone0, t.bone1 === 65535 || t.weight0 !== 0],
      [t.bone1, t.bone1 !== 65535 && t.weight1 !== 0],
    ])
      if (r && (e(i), !n.bones[i].reserved))
        throw new Error("此飞宠依赖原生保留蒙皮矩阵，暂不支持显示。");
}
class Ks {
  object = new T2();
  headSocket;
  skin;
  skinSource;
  frame;
  draws = [];
  materials = [];
  rigid = [];
  attachments = [];
  faceMaterials = [];
  faces = new Map();
  head;
  disposed = !1;
  static async load(e, t, i, r, s) {
    const o = await i.body(),
      a = new Map();
    for (const c of new Set(t.flatMap((l) => l.map))) {
      const l = await i.face(c);
      l && a.set(c, l);
    }
    return new Ks(e, o, a, r, s);
  }
  constructor(e, t, i, r, s) {
    const o = e.root.value;
    if (o.className !== "RePet2") throw new Error("飞宠模型不是 RePet2。");
    const a = o.children[0]?.value;
    if (a?.className !== "ReToonSkinned") throw new Error("飞宠主蒙皮缺失。");
    (sr0(a.geometry.value),
      (this.skinSource = a.geometry.value),
      (this.skin = new vR(this.skinSource)),
      qm(this.object, () => this.collect()));
    try {
      ((this.faces = i),
        (this.object.name = "FlyingPet:RePet2"),
        Ud(this.object, o.transform));
      const c = wE(o),
        l = (d, f, p, v, w, g = !0) => {
          const y = bo(v, { kind: "normal-projection" }),
            b = wE(p, c);
          (Mo(y, ir0(b.alpha, b.zbuf)),
            this.materials.push(y),
            w && this.faceMaterials.push(y));
          const A = new D2(d, y);
          ((A.frustumCulled = !1),
            ie(
              A,
              o.sortDepthBias,
              y.transparent,
              y.transparent ? -0.01 : 0,
              this.object,
            ));
          const x = new N6(f, 4278190080, 2130706432, g);
          ((x.object.visible = g),
            ie(x.object, o.sortDepthBias, !0, 0, this.object));
          const M = new T2();
          (M.add(A, x.object),
            Ud(M, p.transform),
            (M.visible = p.nodeEnabled !== 0),
            this.draws.push({ mesh: A, outline: x }));
          const E = new v2(),
            _ = new v2(),
            C = new v2().makeRotationX(Math.PI / 2),
            S = new H();
          return (
            (A.onBeforeRender = (G, I, L) => {
              (E.copy(C).multiply(A.matrixWorld),
                L.getWorldPosition(S),
                S.set(S.x, -S.z, S.y),
                _.copy(E).invert(),
                xo(y, r, s, E, _, S));
            }),
            M
          );
        },
        u = l(this.skin.geometry, this.skin.outlineSource, a, t, !1);
      (u.matrix.identity(), this.object.add(u));
      for (const d of [1, 2]) {
        const f = o.children[d]?.value;
        if (!f || !("children" in f)) continue;
        const p = f.children[0]?.value;
        if (!p && d === 2) continue;
        if (!p || p.className !== "ReToonRigid")
          throw new Error("飞宠刚性附件结构不支持。");
        const v = rr0(p.geometry.value);
        this.rigid.push(v);
        const w = l(
          v,
          p.geometry.value,
          p,
          d === 1 ? (i.values().next().value ?? t) : t,
          d === 1,
          d !== 2,
        );
        (this.attachments.push({ object: w, local: w.matrix.clone() }),
          this.object.add(w));
      }
      const h = o.children[3];
      if (h) {
        if (!vE(h) || h.value.name !== "head")
          throw new Error("飞宠头部挂点结构不支持。");
        const d = (f) => {
          if (f.className !== "Relement")
            throw new Error("飞宠头部包含未支持的几何。");
          const p = new T2();
          Ud(p, f.transform);
          for (const v of f.children) {
            if (!vE(v)) throw new Error("飞宠头部子节点不是 Relement。");
            p.add(d(v.value));
          }
          return p;
        };
        ((this.head = d(h.value)),
          (this.headSocket = this.head.children[0]),
          this.object.add(this.head));
      }
    } catch (c) {
      throw (this.dispose(), c);
    }
  }
  update(e, t, i, r, s) {
    this.frame = { animation: e, camera: t, width: i, height: r, now: s };
  }
  collect() {
    if (this.disposed || !this.frame) return;
    const { animation: e, camera: t, width: i, height: r, now: s } = this.frame;
    e.update(s);
    const o = AR.collect(this.skinSource, e.pose);
    this.skin.applyPalette(
      this.skinSource.bones.map((l, u) => yR(o[u], l.inverseBind)),
    );
    const a = this.faces.get(e.sequence.map[e.faceSlot]);
    for (const l of this.faceMaterials)
      (JH(l, !a),
        a &&
          ((l.uniforms.baseMap.value = a),
          (l.uniforms.uvControllerEnabled.value = 0)));
    const c = nr0(o[5]);
    for (const l of this.attachments) l.object.matrix.copy(c).multiply(l.local);
    (this.head?.matrix.copy(c), this.object.updateWorldMatrix(!0, !0));
    for (const { mesh: l, outline: u } of this.draws) u.update(l, t, i, r);
  }
  dispose() {
    this.disposed ||
      ((this.disposed = !0),
      this.object.removeFromParent(),
      this.skin.geometry.dispose(),
      this.rigid.forEach((e) => e.dispose()),
      this.materials.forEach((e) => e.dispose()),
      this.draws.forEach((e) => e.outline.dispose()));
  }
}
const $L = [
    { motion: 0, min: 2, max: 5, restore: !1, carry: !1 },
    { motion: 1, min: 2, max: 5, restore: !0, carry: !1 },
    { motion: 21, min: 2, max: 5, restore: !0, carry: !1 },
    { motion: 20, min: 10, max: 60, restore: !0, carry: !0 },
    { motion: 8, min: 1, max: 4, restore: !1, carry: !1 },
    { motion: 6, min: 2, max: 5, restore: !0, carry: !1 },
    { motion: 5, min: 2, max: 5, restore: !0, carry: !1 },
    { motion: 7, min: 2, max: 5, restore: !0, carry: !1 },
  ],
  or0 = $L.map((n) => n.motion);
function ar0(n) {
  return Math.max(0, Math.ceil((n % 80) / 10) - 1);
}
class cr0 {
  constructor(e, t, i) {
    ((this.clips = e), (this.animation = t), (this.random = i));
  }
  clips;
  animation;
  random;
  next = 0;
  remaining = 0;
  reset() {
    this.next = this.remaining = 0;
  }
  update(e) {
    if (e < this.remaining) {
      this.remaining -= e;
      return;
    }
    const t = $L[this.next];
    this.next = ar0(this.random.next());
    const i = this.clips.get(t.motion);
    if (!i) throw new Error("飞宠闲置动作未预载。");
    (this.animation.bind(i, 300, t.restore, 300, t.carry ? this.remaining : 0),
      (this.remaining =
        Math.imul(
          (this.random.next() % (t.max - t.min)) + t.min,
          i.header[2],
        ) >>> 0));
  }
}
const n9 = Math.fround,
  lr0 = () => [n9(0.59), -0.75, 0.5],
  WL = (n, e) => n.map((t, i) => n9(t - e[i])),
  Fg = (n, e) => n9(n9(n9(n[0] * e[0]) + n9(n[1] * e[1])) + n9(n[2] * e[2]));
function ur0(n, e, t, i) {
  const r = Math.min(n9(0.05), n9(n9(i >>> 0) * n9(0.001))),
    s = WL(n, t),
    o = n9(Math.sqrt(Fg(s, s)));
  if (o === 0) return !1;
  const a = n9(350 * o),
    c = n9(n9(Fg(e, s) * 2) / o);
  for (let l = 0; l < 3; l++) {
    const u = n9(n9(-n9(a + c) * s[l]) / o),
      h = n9(u - n9(e[l] * 11));
    ((e[l] = n9(e[l] + n9(h * r))), (n[l] = n9(n[l] + n9(e[l] * r))));
  }
  return !0;
}
class hr0 {
  local = lr0();
  secondLocal = [0.75, 0.75, 0.5];
  position = [0, 0, 0];
  velocity = [0, 0, 0];
  previous = 0;
  remaining = 0;
  following = !1;
  launched = !1;
  firstVisible = !0;
  secondVisible = !1;
  firedVisible = !1;
  aliveVisible = !1;
  firedStart = 0;
  aliveStart = 0;
  counter = 0;
  aliveDue = 0;
  showDue = 0;
  clearDue = 0;
  launch() {
    this.launched ||
      ((this.launched = !0),
      (this.remaining = 400),
      (this.firstVisible = !1),
      (this.secondLocal = [...this.local]),
      this.disable());
  }
  disable() {
    this.launched &&
      (this.counter++,
      (this.secondVisible = this.aliveVisible = !1),
      (this.firedVisible = !0),
      (this.firedStart = this.previous));
  }
  enable() {
    this.launched &&
      (this.counter > 0 && this.counter--,
      (this.aliveDue = (Math.imul(this.counter, 700) + this.previous) >>> 0));
  }
  update(e, t, i, r) {
    ((e >>>= 0), this.previous || (this.previous = e));
    const s = (e - this.previous) >>> 0;
    if (
      (this.remaining
        ? s < this.remaining
          ? (this.remaining -= s)
          : ((this.remaining = 0),
            (this.local[1] = n9(this.local[1] + 1.5)),
            (this.position = [n9(t[12]), n9(t[13] + 1.5), n9(t[14])]),
            this.enable(),
            (this.following = !0))
        : r(s),
      this.following)
    ) {
      if (!(this.previous < e)) return !1;
      const a = [n9(t[12]), n9(t[13] + 1.5), n9(t[14])];
      if (!ur0(this.position, this.velocity, a, s)) return !1;
      const c = WL(this.position, a);
      this.secondLocal = [0, 1, 2].map((l) => {
        const u = i[l];
        if (!Number.isFinite(u) || u === 0)
          throw new Error("飞宠祖父缩放无效。");
        const h = [0, 1, 2].map((d) => n9(n9(t[l * 4 + d]) * n9(1 / u)));
        return n9(Fg(h, c) + this.local[l]);
      });
    }
    let o = !1;
    return (
      this.aliveDue &&
        (e - this.aliveDue) >>> 0 > 500 &&
        ((this.aliveDue = 0),
        (this.firedVisible = !1),
        (this.aliveVisible = !0),
        (this.aliveStart = e),
        (this.showDue = this.clearDue = e),
        (o = !0)),
      this.showDue &&
        (e - this.showDue) >>> 0 > 166 &&
        ((this.secondVisible = !0), (this.showDue = 0)),
      this.clearDue &&
        (e - this.clearDue) >>> 0 > 766 &&
        ((this.clearDue = this.counter = 0),
        (this.aliveVisible = this.firedVisible = !1)),
      (this.previous = e),
      o
    );
  }
}
function dr0(n, e) {
  return n === "local" && e;
}
async function $d(n, e, t, i) {
  const r = (s) => {
    const o = n.get(`${DI}/${s}`);
    if (!o) throw new Error(`飞宠公共效果缺少 ${s}。`);
    return o;
  };
  return W1(
    y9(await r(`${e}.1s`).bytes()),
    n,
    `flyingPet:${e}`,
    (s) => ({ status: "found", entry: r(`${s.name}.png`) }),
    {
      environment: t,
      stageBinding: i,
      advanceEnvironment: !1,
      convertClientCoordinates: !1,
    },
  );
}
class Tv {
  constructor(e, t) {
    ((this.context = e), (this.alive = t));
  }
  context;
  alive;
  active = new Set();
  disposed = !1;
  static async load(e, t) {
    const i = t && e.sound("펫머리얹기"),
      r = i && (await i.bytes()),
      s = r && (await Q9(t, r));
    return new Tv(t, s || void 0);
  }
  playAlive() {
    if (this.disposed || !this.context || !this.alive) return;
    const e = this.context.createBufferSource();
    ((e.buffer = this.alive),
      S9(this.context, e, "fx"),
      this.active.add(e),
      e.addEventListener(
        "ended",
        () => {
          (e.disconnect(), this.active.delete(e));
        },
        { once: !0 },
      ),
      e.start());
  }
  dispose() {
    ((this.disposed = !0),
      this.active.forEach((e) => {
        (e.stop(), e.disconnect());
      }),
      this.active.clear());
  }
}
function _3(n, e) {
  ((n.matrixAutoUpdate = !1),
    (n.matrix.elements[12] = e[0]),
    (n.matrix.elements[13] = e[1]),
    (n.matrix.elements[14] = e[2]),
    (n.matrixWorldNeedsUpdate = !0));
}
class S4 {
  constructor(e) {
    this.race = e;
  }
  race;
  resources = [];
  first;
  firstAnimation;
  second;
  secondAnimation;
  fired;
  alive;
  headEffects = [];
  idle;
  audio;
  state;
  initial;
  equipped;
  firedStart;
  aliveStart;
  disposed = !1;
  get object() {
    return this.first.object;
  }
  static async preview(e, t = !1) {
    const i = new S4();
    try {
      const r = await x4.load(e.library, e.item.internalId),
        s = new mE(r, e.colors.primary, e.colors.high);
      i.resources.push(s);
      const o = (await r.clip(!1, 8)).sequence;
      return (
        (i.initial = o),
        (i.firstAnimation = new cc(o)),
        (i.first = await Ks.load(
          await r.model(),
          [o],
          s,
          e.environment,
          e.binding,
        )),
        i.resources.push(i.first),
        _3(i.first.object, t ? [0, 0, 0] : [0.75, -0.75, 0.5]),
        e.item.tuneGroupId && (await i.attachHeadEffect(e, i.first)),
        i
      );
    } catch (r) {
      throw (i.dispose(), r);
    }
  }
  static async race(e) {
    if (e.role !== "local") return;
    const t = new S4(e);
    try {
      const i = await x4.load(e.library, e.item.internalId),
        r = new mE(i, e.colors.primary, e.colors.high);
      t.resources.push(r);
      const s = new Map();
      for (const a of or0) s.set(a, (await i.clip(!1, a)).sequence);
      ((t.initial = s.get(0)),
        (t.equipped = (await i.clip(!0, 40)).sequence),
        (t.firstAnimation = new cc(t.initial)),
        (t.secondAnimation = new cc(t.equipped)),
        (t.first = await Ks.load(
          await i.model(),
          [...s.values()],
          r,
          e.environment,
          e.binding,
        )),
        t.resources.push(t.first),
        (t.second = await Ks.load(
          await i.model(!0),
          [t.equipped],
          r,
          e.environment,
          e.binding,
        )),
        t.resources.push(t.second),
        (t.idle = new cr0(s, t.firstAnimation, e.random)),
        (t.fired = await $d(e.library, "firedFx", e.environment, e.binding)),
        t.resources.push(t.fired),
        (t.alive = await $d(e.library, "aliveFx", e.environment, e.binding)),
        t.resources.push(t.alive),
        (t.audio = await Tv.load(i, e.audioContext)),
        t.resources.push(t.audio),
        e.item.tuneGroupId && (await t.attachHeadEffect(e, t.second)),
        t.reset());
      const o = e.listen?.((a) => (a ? t.state?.enable() : t.state?.disable()));
      return (o && t.resources.push({ dispose: o }), t);
    } catch (i) {
      throw (t.dispose(), i);
    }
  }
  mount(e) {
    (e.add(this.first.object),
      this.second && e.add(this.second.object),
      this.fired && e.add(this.fired.object),
      this.alive && e.add(this.alive.object));
  }
  launch() {
    this.state?.launch();
  }
  reset() {
    (this.firstAnimation.reset(this.initial),
      this.race &&
        ((this.state = new hr0()),
        (this.secondAnimation = new cc(this.equipped)),
        this.idle?.reset(),
        (this.firedStart = this.aliveStart = void 0),
        _3(this.first.object, this.state.local),
        _3(this.second.object, this.state.secondLocal),
        (this.first.object.visible = !1),
        (this.second.object.visible =
          this.fired.object.visible =
          this.alive.object.visible =
            !1)));
  }
  update(e, t, i, r, s = !0) {
    if (this.disposed) return;
    const o = !this.race || dr0(this.race.role, s);
    if (this.state) {
      this.first.object.updateWorldMatrix(!0, !1);
      const a = new v2()
        .makeRotationX(Math.PI / 2)
        .multiply(this.first.object.matrixWorld);
      (this.state.update(e, a.elements, this.race.grandparentScale, (l) =>
        this.idle.update(l),
      ) &&
        o &&
        this.audio?.playAlive(),
        _3(this.first.object, this.state.local),
        _3(this.second.object, this.state.secondLocal),
        (this.first.object.visible = o && this.state.firstVisible),
        (this.second.object.visible = o && this.state.secondVisible),
        (this.fired.object.visible = o && this.state.firedVisible),
        (this.alive.object.visible = o && this.state.aliveVisible),
        this.state.firedVisible &&
          this.firedStart !== this.state.firedStart &&
          ((this.firedStart = this.state.firedStart),
          _3(this.fired.object, this.state.local),
          this.fired.setControllerCycleMode?.(2),
          this.fired.reset(this.firedStart)),
        this.state.aliveVisible &&
          this.aliveStart !== this.state.aliveStart &&
          ((this.aliveStart = this.state.aliveStart),
          _3(this.alive.object, this.state.local),
          this.alive.setControllerCycleMode?.(2),
          this.alive.reset(this.aliveStart)),
        this.second.update(this.secondAnimation, t, i, r, e),
        this.state.firedVisible && this.fired.update(e, t, i, r),
        this.state.aliveVisible && this.alive.update(e, t, i, r));
    }
    this.first.update(this.firstAnimation, t, i, r, e);
    for (const a of this.headEffects) qm(a.object, () => a.update(e, t, i, r));
  }
  dispose() {
    if (!this.disposed) {
      this.disposed = !0;
      for (const e of this.resources.reverse()) e.dispose();
      this.resources.length = 0;
    }
  }
  async attachHeadEffect(e, t) {
    if (!t.headSocket) return;
    const i = await $d(e.library, "effect", e.environment, e.binding);
    (this.resources.push(i),
      this.headEffects.push(i),
      t.headSocket.add(i.object));
  }
}
class _v {
  constructor(e, t, i) {
    if (((this.scene = e), (this.textures = t), i)) {
      const r = new Set();
      e.object.traverse((s) => {
        if (s instanceof D2) {
          for (const a of Array.isArray(s.material) ? s.material : [s.material])
            r.add(a);
          const o = s.onBeforeRender;
          s.onBeforeRender = (...a) => {
            (o.call(s, ...a), this.applyLocalFade());
          };
        }
      });
      for (const s of r) {
        if (s instanceof $1) {
          if (!s.fragmentShader.includes("#include <fog_fragment>"))
            throw new Error("跑者旗帜 shader 缺少透明度应用位置。");
          ((s.fragmentShader = s.fragmentShader.replace(
            "#include <fog_fragment>",
            `gl_FragColor.a *= 0.3;
#include <fog_fragment>`,
          )),
            (s.needsUpdate = !0));
        } else s.opacity *= 0.3;
        this.fadedMaterials.push(s);
      }
      this.applyLocalFade();
    }
  }
  scene;
  textures;
  disposed = !1;
  fadedMaterials = [];
  applyLocalFade() {
    for (const e of this.fadedMaterials)
      ((e.transparent = !0), (e.blending = X5), (e.depthWrite = !1));
  }
  static async load(e, t, i, r = !1) {
    const s = "item/roadBlockFlag/runner_flag.1s",
      o = e.canonicalCandidates(s);
    if (o.length !== 1) throw new Error("挡人跑者旗帜资源未唯一命中。");
    const a = new Map();
    let c;
    try {
      const l = await W1(
        y9(await o[0].bytes()),
        e,
        "WebRoadBlockRunnerFlag",
        (u) => {
          const h = sn(e, s, void 0, u);
          return h.status === "found" ? { status: "found", entry: h.entry } : h;
        },
        { ...i, advanceEnvironment: !1, textureCache: a },
      );
      return (
        (c = l),
        t.add(l.object),
        l.reset(performance.now()),
        new _v(l, a, r)
      );
    } catch (l) {
      (c?.object.removeFromParent(), c?.dispose());
      for (const u of a.values()) u.dispose();
      throw l;
    }
  }
  update(e, t, i, r) {
    this.disposed || (this.scene.update(e, t, i, r), this.applyLocalFade());
  }
  dispose() {
    if (!this.disposed) {
      ((this.disposed = !0),
        this.scene.object.removeFromParent(),
        this.scene.dispose());
      for (const e of this.textures.values()) e.dispose();
      this.textures.clear();
    }
  }
}
const J0 = Math.fround,
  Dg = (n) => ({ x: J0(n.x), y: J0(-n.z), z: J0(n.y) }),
  It = (n) => ({ x: n.x, y: n.z, z: J0(-n.y) }),
  Gv = (n) => ({ x: J0(-n.x), y: J0(-n.y), z: J0(-n.z) });
function yE(n, e) {
  return {
    x: J0(J0(n.y * e.z) - J0(n.z * e.y)),
    y: J0(J0(n.z * e.x) - J0(n.x * e.z)),
    z: J0(J0(n.x * e.y) - J0(n.y * e.x)),
  };
}
function AE(n) {
  const e = J0(
    Math.sqrt(J0(J0(J0(n.x * n.x) + J0(n.y * n.y)) + J0(n.z * n.z))),
  );
  if (!Number.isFinite(e) || e === 0) throw new Error("挡人结算基准无效。");
  return { x: J0(n.x / e), y: J0(n.y / e), z: J0(n.z / e) };
}
function er(n, e) {
  return { x: n[0][e], y: n[1][e], z: n[2][e] };
}
function HL(n, e) {
  const t = (i) => J0(J0(J0(i.x * e.x) + J0(i.y * e.y)) + J0(i.z * e.z));
  return { x: t(n[0]), y: t(n[1]), z: t(n[2]) };
}
function qL(n, e) {
  const t = J0(Math.cos(e)),
    i = J0(Math.sin(e));
  return n.map((r) => ({
    x: J0(J0(J0(r.x * t) + J0(r.y * i)) + J0(r.z * 0)),
    y: J0(J0(J0(r.x * -i) + J0(r.y * t)) + J0(r.z * 0)),
    z: J0(J0(J0(r.x * 0) + J0(r.y * 0)) + J0(r.z * 1)),
  }));
}
function fr0(n, e) {
  const t = e ? Dg(n.forward) : Gv(Dg(n.forward)),
    i = AE(yE(t, { x: 0, y: 0, z: 1 })),
    r = AE(yE(i, t));
  return [
    { x: i.x, y: t.x, z: r.x },
    { x: i.y, y: t.y, z: r.y },
    { x: i.z, y: t.z, z: r.z },
  ];
}
function pr0(n, e) {
  const t = It(HL(n, { x: 3, y: -6, z: 0 })),
    i = qL(n, J0(-0.9));
  return {
    x: J0(e.x + t.x),
    y: J0(e.y + t.y),
    z: J0(-J0(J0(-e.z) + J0(-t.z))),
    right: It(er(i, "x")),
    up: It(er(i, "z")),
    forward: It(Gv(er(i, "y"))),
    visualScale: { x: 1, y: 1, z: 1 },
  };
}
function gr0(n, e, t) {
  const i = HL(n, { x: 0, y: -5, z: J0(1.7) }),
    r = Dg(e),
    s = { x: J0(r.x + i.x), y: J0(r.y + i.y), z: J0(J0(r.z + i.z) + 1) },
    o = qL(n, Math.fround(3.141592025756836)),
    a = er(o, "y"),
    c = Gv(a),
    l = {
      x: J0(s.x - J0(c.x * t)),
      y: J0(s.y - J0(c.y * t)),
      z: J0(s.z - J0(c.z * t)),
    };
  return {
    position: It(l),
    basis: [It(er(o, "x")), It(a), It(er(o, "z"))],
    horizontalFovDegrees: J0(z6(0).base + J0(-17.046377182006836)),
    near: 1.5,
    far: 500,
  };
}
function mr0(n) {
  const e = new Set(),
    t = (i) => {
      ((i.name === "개인시상대" || i.name === "그림자") &&
        ((i.nodeEnabled = 0), e.add(i.name)),
        i.children.forEach(t));
    };
  if ((t(n), e.size !== 2)) throw new Error("挡人结算缺少原生奖台隐藏节点。");
}
function wr0() {
  const n = [
    [0, 21],
    [500, 14],
    [2e3, 11],
  ].map(([e, t]) => {
    const i = new Uint8Array(8),
      r = new DataView(i.buffer);
    return (r.setUint32(0, e, !0), r.setFloat32(4, t, !0), i);
  });
  return on.fromParsed({
    kind: "float-controller",
    base: {
      cycleMode: 2,
      frequency: 1,
      phaseWord: 0,
      startTimeWord: 0,
      stopTimeWord: 2e3,
    },
    keys: { type: 1, records: n },
  });
}
class Bv {
  constructor(e, t, i) {
    ((this.stand = e),
      (this.confetti = t),
      (this.reversePodium = i),
      this.root.add(e.object),
      this.effectRoot.add(t.object));
  }
  stand;
  confetti;
  reversePodium;
  root = new T2();
  effectRoot = new T2();
  cameraPublisher = new Ol();
  distance = wr0();
  basis;
  ground;
  runner;
  runnerView;
  disposed = !1;
  static async load(e, t) {
    const i = async (f) => {
        const p = e.exactCanonicalCandidates(f);
        if (p.length !== 1) throw new Error(`挡人结算资源不唯一：${f}`);
        return p[0].bytes();
      },
      r = y9(await i(t.map.path));
    if (r.root.kind !== "track")
      throw new Error("挡人结算赛道没有 course owner。");
    const o = r.root.trackObjects
      .find((f) => f.kind === "TrackObject" && f.name === "track")
      ?.property?.children.find((f) => f.name === "course");
    if (!o) throw new Error("挡人结算赛道缺少 course。");
    const a = /^(?:1|true|on)$/i.test((T(o, "reversePodium") ?? "").trim()),
      c = "stuff/award/stand/indi.1s",
      l = y9(await i(c));
    if (l.root.kind !== "node") throw new Error("挡人奖台不是 Relement。");
    const u = {
        environment: t.map.environment,
        stageBinding: t.map.stageBinding,
        advanceEnvironment: !1,
      },
      h = await W1(l, e, "RoadBlockFinalStand", (f) => sn(e, c, void 0, f), u);
    let d;
    try {
      mr0(l.root);
      const f = "stuff/award/effect/ob_award_efect_a.1s";
      return (
        (d = await W1(
          y9(await i(f)),
          e,
          "RoadBlockFinalConfetti",
          (p) => sn(e, f, void 0, p),
          u,
        )),
        new Bv(h, d, a)
      );
    } catch (f) {
      throw (d?.dispose(), h.dispose(), f);
    }
  }
  show(e, t, i, r, s) {
    if (this.disposed || this.runner) return;
    if (!s.roadblock || !s.roadblockOutcome)
      throw new Error("挡人结算缺少跑者和胜负。");
    const o = i.participants.find((w) => w.playerId === s.roadblock.runnerId),
      a = r.get(s.roadblock.runnerId);
    if (!o || !a || !o.characters.ordinary?.award || o.characters.linked)
      throw new Error("挡人结算跑者人车未就绪。");
    const c = t.track.getStart(),
      l = t.track.rayQuery(
        { x: c.position.x, y: Math.fround(c.position.y + 10), z: c.position.z },
        { x: 0, y: -60, z: 0 },
        !1,
      )?.point;
    if (!l) throw new Error("挡人结算基准未命中原生地面。");
    ((this.basis = fr0(c, this.reversePodium)), (this.ground = l));
    const [u, h, d] = this.basis,
      f = It({ x: u.x, y: h.x, z: d.x }),
      p = It({ x: u.z, y: h.z, z: d.z }),
      v = It({ x: -u.y, y: -h.y, z: -d.y });
    ((this.root.matrixAutoUpdate = !1),
      this.root.matrix
        .makeBasis(
          new H(f.x, f.y, f.z),
          new H(p.x, p.y, p.z),
          new H(v.x, v.y, v.z),
        )
        .setPosition(l.x, l.y, l.z),
      (this.root.matrixWorldNeedsUpdate = !0),
      (this.effectRoot.matrixAutoUpdate = !1),
      this.effectRoot.matrix.copy(this.root.matrix),
      (this.effectRoot.matrixWorldNeedsUpdate = !0),
      this.stand.reset(Math.trunc(e) >>> 0),
      this.confetti.reset(Math.trunc(e) >>> 0),
      this.distance.reset(Math.trunc(e) >>> 0));
    for (const [w, g] of r) g.root.visible = w === o.playerId;
    (a.resetAnimation(),
      o.characters.ordinary.scene.reset(),
      a.updatePose(pr0(this.basis, l)),
      a.root.updateMatrixWorld(!0),
      o.characters.ordinary.award.enterResult(
        s.roadblockOutcome.runnerWon ? 12 : 13,
      ),
      (this.runner = o),
      (this.runnerView = a));
  }
  update(e, t, i, r) {
    if (this.disposed || !this.runner || !this.basis || !this.ground) return;
    (this.cameraPublisher.apply(
      t,
      gr0(this.basis, this.ground, this.distance.update(Math.trunc(e) >>> 0)),
    ),
      this.runnerView.root.updateMatrixWorld(!0),
      this.stand.update(e, t, i, r),
      this.confetti.update(e, t, i, r));
    const s = this.runner;
    (s.vehicle.imported.renderScene?.update(t, i, r),
      s.characters.ordinary.scene.update(e, t, i, r, void 0));
    for (const o of s.vehicle.accessories) o.render.scene.update(e, t, i, r);
    s.vehicle.decoration?.scene.update(e, t, i, r);
  }
  dispose() {
    this.disposed ||
      ((this.disposed = !0),
      (this.runner = void 0),
      (this.runnerView = void 0),
      this.root.removeFromParent(),
      this.effectRoot.removeFromParent(),
      this.confetti.dispose(),
      this.stand.dispose());
  }
}
class vr0 {
  deadline;
  count = 0;
  update(e, t) {
    return t === void 0 ||
      (this.deadline === void 0 && (this.deadline = t),
      e >= this.deadline ||
        this.count >= 10 ||
        e < this.deadline - 1e4 + this.count * 1e3)
      ? !1
      : (this.count++, !0);
  }
}
const Rv = 0.09375;
class yr0 {
  element = document.createElement("div");
  topBar = document.createElement("div");
  bottomBar = document.createElement("div");
  ratio = 0;
  viewportHeight = 0;
  disposed = !1;
  constructor(e) {
    (Object.assign(this.element.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      pointerEvents: "none",
      overflow: "hidden",
    }),
      (this.element.dataset.uiLayer = "stage"),
      (this.element.dataset.warpBlackBar = "container"),
      this.element.setAttribute("aria-hidden", "true"));
    for (const t of [this.topBar, this.bottomBar])
      (Object.assign(t.style, {
        position: "absolute",
        left: "0",
        width: "100%",
        height: "0px",
        background: "#000000",
      }),
        (t.textContent = ""),
        this.element.append(t));
    ((this.topBar.style.top = "0"),
      (this.bottomBar.style.bottom = "0"),
      (this.topBar.dataset.warpBlackBar = "top"),
      (this.bottomBar.dataset.warpBlackBar = "bottom"),
      e.root.append(this.element));
  }
  isAttached() {
    return this.element.isConnected;
  }
  setViewportHeight(e) {
    if (this.disposed) return;
    const t = Number.isFinite(e) ? Math.max(0, Math.trunc(e)) : 0;
    t !== this.viewportHeight &&
      ((this.viewportHeight = t), this.applyBarHeights());
  }
  setRatio(e) {
    if (this.disposed) return;
    const t = Number.isFinite(e) ? Math.min(1, Math.max(0, e)) : 0;
    t !== this.ratio && ((this.ratio = t), this.applyBarHeights());
  }
  applyBarHeights() {
    const e = Math.floor(this.viewportHeight * Rv + 0.5),
      i = `${Math.floor(e * this.ratio + 0.5)}px`;
    (this.topBar.style.height !== i && (this.topBar.style.height = i),
      this.bottomBar.style.height !== i && (this.bottomBar.style.height = i));
  }
  dispose() {
    this.disposed || ((this.disposed = !0), this.element.remove());
  }
}
function Ar0() {
  return { hidden: !1 };
}
function br0(n, e) {
  const t = Math.floor(n * Rv + 0.5);
  return Math.floor(t * Math.min(1, Math.max(0, e / 375)) + 0.5);
}
class bE {
  scene = new D1();
  camera = new Fm(0, 1, 1, 0, -1, 1);
  geometry = new Ar(1, 1);
  material = new d3({ color: 0, depthTest: !1, depthWrite: !1 });
  bars = [
    new D2(this.geometry, this.material),
    new D2(this.geometry, this.material),
  ];
  startedAt;
  constructor() {
    this.scene.add(...this.bars);
  }
  start(e) {
    this.startedAt ??= e;
  }
  render(e, t, i) {
    if (this.startedAt === void 0 || i <= 0) return;
    const r = br0(i, t - this.startedAt) / i;
    this.renderRatio(e, r);
  }
  renderRatio(e, t) {
    t &&
      (this.bars.forEach((i, r) => {
        (i.scale.set(1, t, 1),
          i.position.set(0.5, r === 0 ? t / 2 : 1 - t / 2, 0));
      }),
      e.render(this.scene, this.camera));
  }
  dispose() {
    ((this.startedAt = void 0),
      this.scene.clear(),
      this.geometry.dispose(),
      this.material.dispose());
  }
}
function Mr0(n, e, t, i, r, s, o = !0) {
  const a = e.physics,
    c = a.driveCameraRuntime(),
    l = a.displaySpeedKmh();
  (n.zetAirEffect.update(r, l, a.body.linearVelocity, i, t.root.visible),
    n.exhaustEffect.update(
      r,
      l,
      a.body.linearVelocity,
      i,
      t.root.visible &&
        Tk(
          a.audioState(),
          a.dualBoosterState(),
          a.dualBoosterMode(),
          c.action8,
        ),
    ),
    n.shockWaveEffect.update(
      r,
      a.consumeShockWaveRequest(),
      t.root.matrixWorld,
      i,
      H2,
      $2,
    ),
    n.crashEffect.update(
      r,
      a.consumeCrashEffectRequest(),
      t.root.matrixWorld,
      i,
      H2,
      $2,
    ));
  const u = a.timeAttackTachometerCharger();
  (n.chargerEffect.update(r, u.active, u.durationMs, i, H2, $2),
    n.simpleShadow.update(
      e.track,
      t.root.visible && o && c.motionMode !== 2 && c.motionMode !== 3,
    ),
    n.driftEffects.update(r, a.driftVisualRuntime(), e.track, t.root.visible),
    n.effects.setState(
      a.audioState(),
      a.dualBoosterMode(),
      a.dualBoosterTeam(),
      c.action8,
      r,
    ) && ((s = t.enterDualUse()), s !== void 0 && a.setAnimationSlot(s)),
    n.effects.update(r, i, H2, $2),
    n.trails.setState(a.audioState(), r),
    n.trails.update(r, i, n.imported.renderScene !== void 0));
  const h = n.audio;
  (h.update(r, Math.hypot(a.state.vx, a.state.vy, a.state.vz)),
    h.playCollision(a.consumeCollisionAudioStrength(), r),
    h.playSteeringCollision(a.consumeSteeringCollisionAudioGain()),
    h.playLandingShock(c.landingMotionTrigger, c.landingShockAudioStrength),
    h.setState(a.audioState(), a.dualBoosterState()),
    h.setChargerActive(u.active),
    h.setExceedActive(c.action8),
    h.setTransformingState(s),
    h.setDriftActive(a.state.drifting));
}
function xr0(n, e, t, i, r, s, o, a) {
  (n.effects.setState(r.physicsState, r.dualMode, r.dualTeam, s, i) &&
    e.enterDualUse(),
    n.effects.update(i, t, o, a),
    n.chargerEffect.update(
      i,
      r.chargerActive,
      Math.max(
        1,
        Math.trunc(Math.fround(n.physicsParams.chargerSystemUseTime)),
      ),
      t,
      o,
      a,
    ));
}
function lc(n) {
  return [
    n.trails.object,
    n.driftEffects.object,
    n.zetAirEffect.object,
    n.shockWaveEffect.object,
    n.exhaustEffect.object,
    n.crashEffect.object,
    n.simpleShadow.object,
  ];
}
const ME = Iv(1072245229),
  xE = Iv(1082846802),
  SE = Iv(1114594461),
  Sr0 = { x: 0, y: 1, z: 0 };
class KL {
  phase = 0;
  anchorMs = 0;
  raceFov = SE;
  fov = SE;
  configureP3528ResolutionMode(e = 0) {
    this.raceFov = z6(e).base;
  }
  reset() {
    ((this.phase = 0), (this.anchorMs = 0), (this.fov = this.raceFov));
  }
  update(e, t, i = 1) {
    const r = Math.trunc(e) >>> 0,
      s = this.phase === 0;
    (s && (this.anchorMs = r), this.anchorMs === 0 && (this.anchorMs = r));
    const o = r >= this.anchorMs ? (r - this.anchorMs) >>> 0 : 0,
      a = o % 6e3,
      c = o % 5e3,
      l = a <= 3e3 ? uc(ME, xE, hc(a, 3e3)) : uc(xE, ME, hc(a - 3e3, 3e3)),
      u =
        c <= 2500
          ? uc(l9(0.5), l9(0.25), hc(c, 2500))
          : uc(l9(0.25), l9(0.5), hc(c - 2500, 2500)),
      h = [TE(t.right), F5(t.forward, l9(-1)), TE(t.up)],
      d = CE(CE(h, Cr0(l)), Er0(u)),
      f = F5(d[1], l9(-1));
    let p = l9(i);
    p >= 1 && (p = js(jL(Xs(p, 1), 10), 1));
    let v = F5(f, 2);
    ((v = F5(v, 8)), (v = F5(v, p)));
    let w = g6(t.position, Sr0);
    return (
      (w = EE(w, v)),
      s ? ((this.fov = this.raceFov), (this.phase = 1)) : (w = g6(w, F5(f, 8))),
      {
        position: w,
        basis: d,
        horizontalFovDegrees: this.fov,
        near: 1.5,
        far: 500,
      }
    );
  }
  apply(e, t) {
    ((e.matrixAutoUpdate = !0),
      e.position.set(t.position.x, t.position.y, t.position.z),
      e.up.set(t.basis[2].x, t.basis[2].y, t.basis[2].z));
    const i = EE(t.position, t.basis[1]);
    (e.lookAt(i.x, i.y, i.z),
      (e.fov = we(t.horizontalFovDegrees, e.aspect)),
      (e.near = t.near),
      (e.far = t.far),
      e.updateProjectionMatrix());
  }
}
function Cr0(n) {
  const e = l9(Math.cos(l9(n))),
    t = l9(Math.sin(l9(n)));
  return [
    { x: e, y: t, z: 0 },
    { x: l9(-t), y: e, z: 0 },
    { x: 0, y: 0, z: 1 },
  ];
}
function Er0(n) {
  const e = l9(Math.cos(l9(n))),
    t = l9(Math.sin(l9(n)));
  return [
    { x: 1, y: 0, z: 0 },
    { x: 0, y: e, z: t },
    { x: 0, y: l9(-t), z: e },
  ];
}
function CE(n, e) {
  const t = (i) => g6(g6(F5(n[0], i.x), F5(n[1], i.y)), F5(n[2], i.z));
  return [t(e[0]), t(e[1]), t(e[2])];
}
function uc(n, e, t) {
  return js(l9(Xs(1, t) * n), l9(e * t));
}
function hc(n, e) {
  return jL(l9(n >>> 0), l9(e >>> 0));
}
function g6(n, e) {
  return { x: js(n.x, e.x), y: js(n.y, e.y), z: js(n.z, e.z) };
}
function EE(n, e) {
  return { x: Xs(n.x, e.x), y: Xs(n.y, e.y), z: Xs(n.z, e.z) };
}
function F5(n, e) {
  return { x: l9(n.x * e), y: l9(n.y * e), z: l9(n.z * e) };
}
function js(n, e) {
  return l9(l9(n) + l9(e));
}
function Xs(n, e) {
  return l9(l9(n) - l9(e));
}
function jL(n, e) {
  return l9(l9(n) / l9(e));
}
function TE(n) {
  return { x: n.x, y: n.y, z: n.z };
}
function l9(n) {
  return Math.fround(n);
}
function Iv(n) {
  const e = new ArrayBuffer(4),
    t = new DataView(e);
  return (t.setUint32(0, n, !0), t.getFloat32(0, !0));
}
function XL(n) {
  return n
    .map((e, t) => ({ participant: e, index: t }))
    .sort((e, t) => {
      const i = t.participant.lap - e.participant.lap;
      if (i !== 0) return i;
      const r = t.participant.progress - e.participant.progress;
      return r !== 0 ? r : e.index - t.index;
    })
    .map(({ participant: e }, t) => ({ ...e, rank: t + 1 }));
}
function YL(n, e) {
  return e === void 0 ? n : `${n}（${Math.trunc(e)}ms）`;
}
function ZL(n, e, t) {
  if (t === e) return 0;
  const i = n
    .filter((r) => r.playerId !== e)
    .findIndex((r) => r.playerId === t);
  if (i < 0)
    throw new Error("Rank participant is absent from the frozen race roster.");
  return i + 1;
}
class Tr0 {
  constructor(e, t) {
    ((this.roster = e), (this.localId = t));
  }
  roster;
  localId;
  samples = new Map();
  departed = new Set();
  capture(e) {
    for (const t of this.roster) {
      if (this.departed.has(t.playerId)) continue;
      const i = e(t.playerId);
      i && this.samples.set(t.playerId, { ...i });
    }
  }
  updatePresent(e) {
    for (const t of this.roster)
      t.playerId !== this.localId &&
        !e.has(t.playerId) &&
        this.departed.add(t.playerId);
  }
  progress(e) {
    return this.samples.get(e);
  }
  out(e) {
    return this.departed.has(e);
  }
  dispose() {
    (this.samples.clear(), this.departed.clear());
  }
}
function _r0(n, e, t, i, r = [], s) {
  const o = n.map((h) => {
    const d = t(h.playerId),
      f = r.find((p) => p.playerId === h.playerId);
    return {
      member: h,
      progress: f
        ? {
            distance: d?.distance ?? 0,
            lap: d?.lap ?? 0,
            finishElapsedMs: f.elapsedMs,
          }
        : d,
    };
  });
  if (!o.length || o.some((h) => !h.progress)) return;
  const a = o
      .filter((h) => h.progress.finishElapsedMs !== void 0)
      .sort((h, d) => h.progress.finishElapsedMs - d.progress.finishElapsedMs),
    c = XL(
      o
        .filter((h) => h.progress.finishElapsedMs === void 0)
        .map((h) => ({
          id: h.member.playerId,
          name: h.member.name,
          lap: 0,
          progress: h.progress.distance,
        })),
    ),
    l = [...a.map((h) => h.member.playerId), ...c.map((h) => h.id)],
    u = l.indexOf(e) + 1;
  if (u)
    return {
      rank: u,
      riderCount: l.length,
      rows: l.map((h, d) => ({
        participantId: h,
        slot: ZL(n, e, h),
        rank: d + 1,
        local: h === e,
        name: YL(n.find((f) => f.playerId === h).name, s?.(h)),
        color: i.get(h),
        finished: a.some((f) => f.member.playerId === h),
      })),
    };
}
function Gr0(n, e, t, i) {
  return {
    rank: n.findIndex((r) => r.playerId === e) + 1,
    riderCount: n.length,
    rows: n.map((r, s) => ({
      participantId: r.playerId,
      slot: ZL(n, e, r.playerId),
      rank: s + 1,
      local: r.playerId === e,
      name: YL(r.name, i?.(r.playerId)),
      color: t.get(r.playerId),
    })),
  };
}
function Br0(n, e) {
  const t = n.rows.map((i) => {
    const r = e.find((s) => s.playerId === i.participantId);
    return r ? { ...i, rank: r.rank, finished: r.elapsedMs !== null } : i;
  });
  return { ...n, rank: t.find((i) => i.local).rank, rows: t };
}
class Rr0 {
  localPending = !1;
  played = new Set();
  acceptLocalFinish(e) {
    this.localPending = !0;
  }
  consume(e, t, i, r) {
    if (r || this.played.has(e)) return 0;
    if (e === t) {
      if (!this.localPending) return 0;
      this.localPending = !1;
    } else if (!i.some((s) => s.playerId === e)) return 0;
    return (this.played.add(e), 12);
  }
}
function QL(n, e, t, i, r, s, o, a, c = !1) {
  n instanceof fv
    ? n.update(
        e.displaySpeedKmh(),
        e.timeAttackTachometerAnimationState(),
        t,
        r,
        H2,
        $2,
        o,
        a,
      )
    : n instanceof p7
      ? n.update(e, i, r, H2, $2, o, c)
      : n instanceof Ta || n instanceof Gr
        ? n.update(e, i, r, s, H2, $2, o, c)
        : n.update(e.displaySpeedKmh(), H2, $2, o);
}
function JL(n, e) {
  n instanceof Fk ? n.render(e) : n.render(e, H2, $2);
}
function eP(n) {
  (n instanceof Gr || n instanceof Ta) && n.startMainGaugeDrain();
}
class tP {
  enabled = !1;
  anchorMs = 0;
  visible = !1;
  configure(e) {
    ((this.enabled = e === "ht" || e === "디셉티콘" || e === "오토봇"),
      this.reset());
  }
  reset() {
    ((this.anchorMs = 0), (this.visible = !1));
  }
  update(e, t) {
    if (!this.enabled) return;
    const i = Math.trunc(e) >>> 0;
    return (this.trigger(i, t), this.expire(i), this.visible);
  }
  expire(e) {
    this.anchorMs === 0 ||
      (e - this.anchorMs) >>> 0 <= 500 ||
      ((this.anchorMs = 0), (this.visible = !1));
  }
  trigger(e, t) {
    !t || this.anchorMs !== 0 || ((this.anchorMs = e), (this.visible = !0));
  }
}
class nP {
  constructor(e, t = { value: 0 }) {
    ((this.random = e), (this.effectAnchor = t));
  }
  random;
  effectAnchor;
  activeCount = 0;
  durationAnchorMs = 0;
  x = 0;
  y = 0;
  z = 0;
  giantDenominator;
  enter() {
    (this.activeCount++, (this.effectAnchor.value = 0));
  }
  leave(e = !1) {
    (this.activeCount > 0 && this.activeCount--,
      (e || this.activeCount === 0) &&
        ((this.activeCount = 0), (this.effectAnchor.value = 0)));
  }
  setGiantGate(e) {
    const t = typeof e == "number",
      i = typeof this.giantDenominator == "number";
    (t !== i && (this.effectAnchor.value = 0), (this.giantDenominator = e));
  }
  update(e, t = "") {
    if (
      this.giantDenominator === !1 ||
      (this.giantDenominator === void 0 && this.activeCount === 0)
    )
      return { x: 0, y: 0, z: 0 };
    const i = Math.trunc(e) >>> 0,
      r = /^shake(\d+),(\d+)$/.exec(t),
      s = Math.fround(
        r
          ? Math.fround(Number(r[1]) * Math.fround(-90)) + Math.fround(1e4)
          : typeof this.giantDenominator == "number"
            ? this.giantDenominator
            : 800,
      ),
      o = Math.fround(r ? Number(r[2]) : 2100);
    (this.effectAnchor.value === 0 && (this.effectAnchor.value = i),
      (i - this.effectAnchor.value) >>> 0 > 10 &&
        this.effectAnchor.value !== 0 &&
        ((this.effectAnchor.value = 0),
        (this.x = (this.random.next() % 1e3) - 500),
        (this.y = (this.random.next() % 1e3) - 500),
        (this.z = (this.random.next() % 1e3) - 500)));
    let a = (i - this.durationAnchorMs) >>> 0;
    if (
      (o > 0 &&
        (this.durationAnchorMs === 0 || Math.fround(a) > o) &&
        ((this.durationAnchorMs = i), (a = 0)),
      typeof this.giantDenominator == "number")
    ) {
      const d = o > 0 ? (o - a) / o : 1,
        f = Math.fround((this.x / s) * d),
        p = Math.fround((this.y / s) * d),
        v = Math.fround((this.z / s) * d);
      return { x: f, y: v, z: p === 0 ? 0 : Math.fround(-p) };
    }
    const c =
        o > 0
          ? Math.fround(Math.fround(o - Math.fround(a)) / o)
          : Math.fround(1),
      l = Math.fround(Math.fround(Math.fround(this.x) / s) * c),
      u = Math.fround(Math.fround(Math.fround(this.y) / s) * c),
      h = Math.fround(Math.fround(Math.fround(this.z) / s) * c);
    return { x: l, y: h, z: u === 0 ? 0 : Math.fround(-u) };
  }
}
const Y9 = Math.fround;
class iP {
  constructor(e = { value: 0 }) {
    this.effectAnchor = e;
  }
  effectAnchor;
  enabled = !1;
  enter() {
    ((this.enabled = !0), (this.effectAnchor.value = 0));
  }
  leave() {
    ((this.enabled = !1), (this.effectAnchor.value = 0));
  }
  update(e, t, i, r = { x: 0, y: 0, z: 0 }) {
    if (!this.enabled) return r;
    const s = /^wave(\d+),(\d+),(\d+),(\d+)\s*$/.exec(t),
      o = s ? Number(s[1]) >>> 0 : 0,
      a = Y9(s ? Y9(Number(s[2]) / Y9(1e3)) * Y9(3) : 0.13),
      c = Y9(s ? Number(s[3]) : 8),
      l = s ? Y9(Number(s[4])) : 0,
      u = Math.trunc(e) >>> 0;
    this.effectAnchor.value === 0 && (this.effectAnchor.value = u);
    const h = (u - this.effectAnchor.value) >>> 0;
    if (l !== 0 && l <= Y9(h)) return ((this.effectAnchor.value = 0), r);
    const d = Y9(Y9(Y9(Y9(6.2831802) * Y9(h)) / Y9(1e3)) * c),
      f = Y9(Ro(d)),
      p = l === 0 ? void 0 : Y9(l - Y9(h));
    return (
      o <= 1 && Wd(r, i.right, f, a, p, l),
      (o === 0 || o === 2) && Wd(r, i.up, f, a, p, l),
      o === 0 && Wd(r, i.forward, Y9(-f), a, p, l),
      r
    );
  }
}
function Wd(n, e, t, i, r, s) {
  for (const o of ["x", "y", "z"]) {
    let a = Y9(Y9(e[o] * t) * i);
    (r !== void 0 && (a = Y9(Y9(a * r) / s)), (n[o] = Y9(n[o] + a)));
  }
}
class rP {
  constructor(e = Math.trunc(Date.now() / 1e3) >>> 0) {
    this.state = e;
  }
  state;
  next() {
    return (
      (this.state = (Math.imul(214013, this.state) + 2531011) >>> 0),
      (this.state >>> 16) & 32767
    );
  }
}
class sP {
  constructor(e = new rP()) {
    this.random = e;
  }
  random;
  active = !1;
  mode = 0;
  transitioning = !1;
  pulseCount = 0;
  completedPulses = 0;
  rate = 0;
  current = 0;
  target = 0;
  trigger() {
    this.active = !0;
  }
  update() {
    if (!this.active) return 1;
    if (this.transitioning)
      ((this.current = Math.fround(
        Math.fround(Math.fround(this.target - this.current) * this.rate) +
          this.current,
      )),
        this.current < 0.5 && (this.mode = 1),
        (this.current <= 0.2 || this.current >= 1) &&
          ((this.transitioning = !1),
          this.pulseCount >= this.completedPulses
            ? (this.completedPulses += 1)
            : ((this.active = !1),
              (this.pulseCount = 0),
              (this.completedPulses = 0))));
    else if (this.random.next() % 100 >= 5) this.mode = 0;
    else {
      ((this.mode = 1),
        (this.transitioning = !0),
        (this.target = this.current <= 0 ? 0 : 1),
        (this.current = 1),
        this.pulseCount === 0 &&
          ((this.pulseCount = (this.random.next() % 4) + 2),
          (this.completedPulses = 0)));
      const e = this.random.next() % 100;
      ((this.rate =
        this.target > 0
          ? Math.fround(0.01)
          : Math.fround(
              Math.fround(Math.fround(0.01) * e) + Math.fround(0.003),
            )),
        e === 0 && (this.rate = Math.fround(0.01)));
    }
    return this.active ? (this.mode === 0 ? 1 : this.mode === 1 ? 2 : 4) : 1;
  }
}
class Vg {
  root = new T2();
  modelMount = new T2();
  affectBasis = new _o();
  presentationMatrix = new _o();
  presentationState;
  importedModel;
  visualConfig;
  animation;
  wheelPresentation;
  attachmentNodes = [];
  constructor(e) {
    ((this.root.name = "player-kart"),
      (this.modelMount.name = "imported-kart-mount"),
      (this.root.matrixAutoUpdate = !1),
      cn(this.root),
      (this.modelMount.matrixAutoUpdate = !1),
      (this.modelMount.matrixWorldAutoUpdate = !1),
      cn(this.modelMount),
      this.root.add(this.modelMount),
      e.add(this.root));
  }
  setModel(e, t, i, r, s) {
    const o = r && s ? new N90(r, s, t) : void 0,
      a = t.attachments.map((c) => s?.nodes.get(c)?.object);
    (!a[16] && t.attachments[16] === "balloon" && r && s && (a[16] = c7(r, s)),
      this.clearImportedModel(),
      (this.importedModel = e),
      (this.visualConfig = t),
      (this.animation = i),
      (this.wheelPresentation = o),
      (this.attachmentNodes = a),
      this.modelMount.add(e));
  }
  clearModel() {
    this.clearImportedModel();
  }
  resetAnimation() {
    (this.animation?.reset(0),
      this.wheelPresentation?.reset(),
      this.setLocalAffectBasis());
  }
  setLocalAffectBasis(e) {
    if (e) {
      const t = e.elements;
      this.affectBasis.set(
        t[0],
        -t[8],
        t[4],
        0,
        -t[2],
        t[10],
        -t[6],
        0,
        t[1],
        -t[9],
        t[5],
        0,
        0,
        0,
        0,
        1,
      );
    } else this.affectBasis.identity();
    this.presentationState &&
      this.updatePresentationTransform(this.presentationState);
  }
  getAttachment(e) {
    return this.attachmentNodes[e];
  }
  getVisualConfig() {
    return this.visualConfig;
  }
  presentationRoot() {
    return this.modelMount;
  }
  update(e, t, i) {
    (this.updatePose(e), (this.presentationState = e));
    const r = this.animation?.state ?? 0,
      s = i
        ? this.updateAnimation(t, i)
        : this.animation?.updateCurrentState(t);
    return (
      this.wheelPresentation && this.wheelPresentation.update(e, t >>> 0, r),
      s
    );
  }
  updatePose(e) {
    (this.root.matrix.set(
      e.right.x,
      e.up.x,
      e.forward.x,
      e.x,
      e.right.y,
      e.up.y,
      e.forward.y,
      e.y,
      e.right.z,
      e.up.z,
      e.forward.z,
      e.z,
      0,
      0,
      0,
      1,
    ),
      (this.root.matrixWorldNeedsUpdate = !0),
      this.updatePresentationTransform(e));
  }
  updateRemote(e, t, i) {
    return (
      this.updatePose(e),
      (this.presentationState = e),
      this.updateAnimation(t, i)
    );
  }
  enterDualUse() {
    return (this.animation?.enterDualUse(), this.animation?.state);
  }
  updateAnimation(e, t) {
    if (!this.animation || !this.visualConfig) return;
    const i = e >>> 0,
      r =
        (this.visualConfig.isTransformAutoCharge &&
          t.displaySpeedKmh > this.visualConfig.autoChargeLowSpeed) ||
        (t.physicsState > 2 && t.physicsState < 12);
    return this.animation.update(
      i,
      r,
      this.visualConfig.transformTime,
      t.dualMode,
      t.physicsState,
    );
  }
  dispose() {
    (this.clearImportedModel(), this.root.removeFromParent());
  }
  releaseBorrowedModel() {
    (this.clearImportedModel(!1), this.root.removeFromParent());
  }
  updatePresentationTransform(e) {
    const t = this.presentationMatrix
        .set(
          e.right.x,
          -e.forward.x,
          e.up.x,
          0,
          -e.right.z,
          e.forward.z,
          -e.up.z,
          0,
          e.right.y,
          -e.forward.y,
          e.up.y,
          0,
          0,
          0,
          0,
          1,
        )
        .multiply(this.affectBasis).elements,
      { x: i, y: r, z: s } = e.visualScale,
      o = Math.fround;
    (this.modelMount.matrixWorld.set(
      o(t[0] * i),
      o(t[8] * r),
      -o(t[4] * s),
      e.x,
      o(t[2] * i),
      o(t[10] * r),
      -o(t[6] * s),
      e.y,
      -o(t[1] * i),
      -o(t[9] * r),
      o(t[5] * s),
      e.z,
      0,
      0,
      0,
      1,
    ),
      (this.modelMount.matrixWorldNeedsUpdate = !0));
  }
  clearImportedModel(e = !0) {
    this.importedModel &&
      (this.importedModel.removeFromParent(),
      e && u5(this.importedModel),
      (this.importedModel = void 0),
      (this.visualConfig = void 0),
      (this.animation = void 0),
      (this.wheelPresentation = void 0),
      (this.attachmentNodes = []),
      e || (this.presentationState = void 0),
      this.setLocalAffectBasis());
  }
}
const _E = 1,
  Ir0 = 2,
  kr0 = 3,
  Lr0 = 0.5,
  Pr0 = 1,
  Fr0 = 1,
  Dr0 = 300;
let GE = !1;
function Vr0() {
  GE ||
    ((GE = !0),
    (z2.fog_pars_vertex = `
#ifdef USE_FOG

	varying float vFogDepth;
	varying float vFogRadialDistance;

#endif
`),
    (z2.fog_vertex = `
#ifdef USE_FOG

	vFogDepth = - mvPosition.z;
	vFogRadialDistance = length( mvPosition.xyz );

#endif
`),
    (z2.fog_pars_fragment = `
#ifdef USE_FOG

	uniform vec3 fogColor;
	varying float vFogDepth;
	varying float vFogRadialDistance;

	#ifdef FOG_EXP2

		uniform float fogDensity;

	#else

		uniform float fogNear;
		uniform float fogFar;

	#endif

#endif
`),
    (z2.fog_fragment = `
#ifdef USE_FOG

	#ifdef FOG_EXP2

		bool expFog = fogDensity < 0.0;
		float density = abs( fogDensity );
		float fogDist = expFog ? vFogDepth : vFogRadialDistance;
		float fogFactor = expFog
			? 1.0 - exp( - density * fogDist )
			: 1.0 - exp( - density * density * fogDist * fogDist );

	#else

		float fogFactor = clamp( ( vFogDepth - fogNear ) / ( fogFar - fogNear ), 0.0, 1.0 );

	#endif

	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );

#endif
`));
}
function kv(n, e) {
  Vr0();
  const t = e.fog,
    i = e.cameraFar ?? Dr0;
  if (t?.mode === kr0) {
    n.fog = new Pm(
      new r9(t.r / 255, t.g / 255, t.b / 255),
      (t.start ?? Lr0) * i,
      (t.end ?? Pr0) * i,
    );
    return;
  }
  if (t?.mode === Ir0 || t?.mode === _E) {
    const r = (t.density ?? Fr0) / i;
    n.fog = new Lm(
      new r9(t.r / 255, t.g / 255, t.b / 255),
      t.mode === _E ? -r : r,
    );
    return;
  }
  n.fog = null;
}
const oP = { goggle: [3, 0], headBand: [3, 3], handGearL: [4, 0] },
  Lv = "item/eventObject",
  Nr0 = [Lv, "sound_/fx/surround"],
  Or0 = ["ogg", "wav", "flac"];
class b7 {
  constructor(e, t, i, r, s) {
    ((this.library = e),
      (this.mount = t),
      (this.environment = i),
      (this.stageBinding = r),
      (this.audioContext = s));
  }
  library;
  mount;
  environment;
  stageBinding;
  audioContext;
  templates = new Map();
  activeScenes = [];
  textures = new Map();
  soundBuffers = new Map();
  playingSounds = new Map();
  pendingBuilds = 0;
  disposed = !1;
  texturesDisposed = !1;
  failure;
  static async load(e, t, i, r, s, o) {
    const a = new b7(e, i, r, s, o);
    try {
      const c = t.flatMap((l) => (l.effect ? [l.effect] : []));
      return (await a.loadTemplates(c), await a.loadSounds(c), a);
    } catch (c) {
      throw (a.dispose(), c);
    }
  }
  trigger(e, t) {
    this.throwFailure();
    const i = this.templates.get(gl(e.model));
    if (!i) return;
    const r = i.spare.pop();
    if (!r) throw new Error(`${i.path} event effect clone pool 尚未补回。`);
    (r.reset(Math.trunc(t) >>> 0),
      this.mount.add(r.object),
      this.activeScenes.push({ effect: e, scene: r }),
      this.playSound(e),
      this.replenish(i));
  }
  remove(e) {
    const t = this.activeScenes.findIndex((r) => r.effect === e);
    if (t === -1) return;
    const [{ scene: i }] = this.activeScenes.splice(t, 1);
    (i.object.removeFromParent(), i.dispose());
  }
  update(e, t, i, r) {
    this.throwFailure();
    for (const { scene: s } of this.activeScenes) s.update(e, t, i, r);
  }
  dispose() {
    if (!this.disposed) {
      this.disposed = !0;
      for (const e of this.playingSounds.values()) {
        e.onended = null;
        try {
          e.stop();
        } catch {}
        e.disconnect();
      }
      this.playingSounds.clear();
      for (const { scene: e } of this.activeScenes)
        (e.object.removeFromParent(), e.dispose());
      this.activeScenes.length = 0;
      for (const e of this.templates.values()) {
        for (const t of e.spare) t.dispose();
        e.spare.length = 0;
      }
      (this.templates.clear(),
        this.pendingBuilds === 0 && this.disposeTextures());
    }
  }
  async loadTemplates(e) {
    const t = zr0(e);
    for (const [i, r] of t) {
      const s = `${Lv}/${i}.1s`,
        o = this.library.exactCanonicalCandidates(s);
      if (o.length > 1) throw new Error(`${s} source 数量 ${o.length}。`);
      if (o.length === 0) continue;
      const a = {
        model: i,
        path: s,
        parsed: y9(await o[0].bytes()),
        spare: [],
      };
      for (let c = 0; c < r; c += 1) a.spare.push(await this.buildScene(a));
      this.templates.set(gl(i), a);
    }
  }
  async loadSounds(e) {
    const t = new Set(
      e
        .filter((i) => this.templates.has(gl(i.model)) && BE(i))
        .map((i) => i.soundName),
    );
    for (const i of t) {
      const r = $r0(this.library, i);
      if (!r) continue;
      const s = await r.bytes();
      this.soundBuffers.set(RE(i), await Q9(this.audioContext, s));
    }
  }
  buildScene(e) {
    return W1(
      e.parsed,
      this.library,
      `event:${e.model}:TrackEventEffect`,
      (t) => Ur0(this.library, e.path, t),
      {
        environment: this.environment,
        stageBinding: this.stageBinding,
        advanceEnvironment: !1,
        textureCache: this.textures,
      },
    );
  }
  replenish(e) {
    ((this.pendingBuilds += 1),
      this.buildScene(e)
        .then((t) => {
          this.disposed ? t.dispose() : e.spare.push(t);
        })
        .catch((t) => {
          this.disposed || (this.failure = Hr0(t));
        })
        .finally(() => {
          ((this.pendingBuilds -= 1),
            this.disposed &&
              this.pendingBuilds === 0 &&
              this.disposeTextures());
        }));
  }
  playSound(e) {
    if (!BE(e)) return;
    const t = RE(e.soundName),
      i = this.soundBuffers.get(t);
    if (!i || this.playingSounds.has(t)) return;
    const r = this.audioContext.createBufferSource();
    ((r.buffer = i),
      S9(this.audioContext, r),
      (r.onended = () => {
        this.playingSounds.get(t) === r &&
          (r.disconnect(), this.playingSounds.delete(t));
      }),
      this.playingSounds.set(t, r),
      r.start());
  }
  throwFailure() {
    if (this.failure) throw this.failure;
  }
  disposeTextures() {
    if (!this.texturesDisposed) {
      this.texturesDisposed = !0;
      for (const e of this.textures.values()) e.dispose();
      this.textures.clear();
    }
  }
}
function zr0(n) {
  const e = new Map();
  for (const t of n) {
    const i = gl(t.model),
      r = e.get(i);
    r ? (r.count += 1) : e.set(i, { model: t.model, count: 1 });
  }
  return new Map([...e.values()].map(({ model: t, count: i }) => [t, i]));
}
function Ur0(n, e, t) {
  const i = sn(n, e, void 0, t);
  if (i.status !== "found") return i;
  const r = Wr0(i.source.canonicalPrefix);
  return i.source.kind !== "track" || r !== Lv.toLowerCase()
    ? {
        status: "unresolved",
        reason: `${t.name ?? "<unnamed>"} escaped item/eventObject source。`,
      }
    : { status: "found", entry: i.entry };
}
function $r0(n, e) {
  for (const t of Nr0) {
    const i = Or0.flatMap((r) => n.exactCanonicalCandidates(`${t}/${e}.${r}`));
    if (i.length > 1)
      throw new Error(`${t}/${e} sound source 数量 ${i.length}。`);
    if (i.length === 1) return i[0];
  }
}
function BE(n) {
  return n.soundType === 0 || n.soundType === 1
    ? !0
    : n.soundType === 2 && n.distance >= 0;
}
function gl(n) {
  return n.toLowerCase();
}
function RE(n) {
  return n.toLowerCase();
}
function Wr0(n) {
  return n
    .replaceAll("\\", "/")
    .replace(/^\.\//, "")
    .replace(/^\/+|\/+$/g, "")
    .toLowerCase();
}
function Hr0(n) {
  return n instanceof Error ? n : new Error(String(n));
}
function Pv(n) {
  return (
    Number.isInteger(n.linkCharacterId) &&
    n.linkCharacterId > 0 &&
    n.alwaysLinkCharacter === !1 &&
    n.hideChar === !1 &&
    n.characterAniType === 0
  );
}
class _a {
  constructor(e, t, i, r) {
    ((this.linkedMount = t),
      (this.linkedCharacter = i),
      (this.alwaysLinked = r));
    const s = e.children.findIndex((o) => o.name === "balloon");
    if (s < 0)
      throw new Error("linked ReKart root 缺少 exact balloon stop marker。");
    if (((e.children[s].visible = !1), r))
      this.normalPrefix = e.children.slice(0, s);
    else {
      const o = e.children.slice(0, s).filter((c) => c !== t),
        a = new T2();
      ((a.name = "conditional-kart-vehicle"),
        (a.matrixAutoUpdate = !1),
        e.add(a));
      for (const c of o) a.add(c);
      this.normalPrefix = [a];
    }
    this.setMode(1);
  }
  linkedMount;
  linkedCharacter;
  alwaysLinked;
  normalPrefix;
  mode = -1;
  shadowEnabled = !0;
  previousState = 0;
  deadline = 0;
  setMode(e) {
    if (this.alwaysLinked || e === 2 || (this.mode === 2 && e < 2)) return !1;
    const t = e === 4 ? 0 : e;
    if (t === this.mode) return !1;
    this.mode = t;
    const i = this.mode === 1 || this.mode === 3;
    return (
      this.normalPrefix.forEach((r) => {
        r.visible = !i;
      }),
      (this.linkedMount.visible = !0),
      (this.linkedCharacter.visible = i),
      (this.shadowEnabled = !i),
      !0
    );
  }
  update(e, t) {
    const i = Math.trunc(t) >>> 0,
      r = this.updateState(e, i);
    return this.updateDeadline(i) ?? r;
  }
  updateSpeedRace(e, t) {
    const i = Math.trunc(t) >>> 0,
      r = this.updateState(e, i, !0);
    return this.updateDeadline(i) ?? r;
  }
  updateState(e, t, i = !1) {
    const r = i && e === 11 && this.previousState !== 0;
    if (e === this.previousState && !r) return;
    let s;
    return (
      this.previousState !== 0 &&
        ((this.deadline = 0), this.setMode(0) && (s = 18)),
      (this.previousState = e),
      (i
        ? e !== 0 && !r && ![1, 2, 13, 14, 15, 16, 18, 19].includes(e)
        : e === 3) && (this.deadline = (t + 100) >>> 0),
      s
    );
  }
  updateDeadline(e) {
    if (!(this.deadline === 0 || this.deadline >= e))
      return ((this.deadline = 0), this.setMode(1) ? 14 : void 0);
  }
  resetForRacePresentation() {
    ((this.previousState = 0), (this.deadline = 0), this.setMode(3));
  }
  simpleShadowEnabled() {
    return this.shadowEnabled;
  }
}
const M2 = Math.fround,
  dc = (n) => {
    const e = M2(
      Math.sqrt(M2(M2(M2(n.x * n.x) + M2(n.y * n.y)) + M2(n.z * n.z))),
    );
    return e === 0
      ? { x: 0, y: 0, z: 0 }
      : { x: M2(n.x / e), y: M2(n.y / e), z: M2(n.z / e) };
  },
  Hd = (n, e) => ({ x: M2(n.x - e.x), y: M2(n.y - e.y), z: M2(n.z - e.z) }),
  IE = (n, e) => M2(M2(M2(n.x * e.x) + M2(n.y * e.y)) + M2(n.z * e.z));
class qr0 {
  constructor(e) {
    ((this.texture = e),
      (e.wrapS = e.wrapT = S1),
      (e.minFilter = e.magFilter = h9),
      (e.generateMipmaps = !1),
      this.geometry.setAttribute("position", new _0(this.positions, 3)),
      this.geometry.setAttribute("uv", new _0(this.uvs, 2)),
      this.geometry.setIndex([0, 1, 2, 2, 1, 3]),
      (this.material = new Vt({
        uniforms: { image: { value: e } },
        transparent: !0,
        blending: u1,
        blendSrc: l1,
        blendDst: v1,
        blendEquation: R9,
        side: s1,
        forceSinglePass: !0,
        depthFunc: y1,
        depthWrite: !1,
        vertexShader:
          "precision highp float; uniform mat4 projectionMatrix,modelViewMatrix; attribute vec3 position; attribute vec2 uv; varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
        fragmentShader:
          "precision highp float; uniform sampler2D image; varying vec2 vUv; void main(){gl_FragColor=texture2D(image,vUv)*vec4(1.0,1.0,1.0,128.0/255.0);}",
      })),
      (this.mesh = new D2(this.geometry, this.material)),
      (this.mesh.frustumCulled = !1),
      (this.mesh.visible = !1),
      (this.mesh.matrixAutoUpdate = !1),
      Ao(this.mesh));
  }
  texture;
  geometry = new t9();
  material;
  mesh;
  selected;
  coefficient = 0;
  angle = 0;
  positions = new Float32Array(12);
  uvs = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]);
  update(e, t, i, r) {
    if (((this.mesh.visible = !1), i)) return;
    let s,
      o = 1 / 0;
    if (e.main !== 4) {
      for (const y of t)
        if (y.main === 4) {
          const b = Hd(y.position, e.position),
            A = M2(
              Math.sqrt(M2(M2(M2(b.x * b.x) + M2(b.y * b.y)) + M2(b.z * b.z))),
            );
          A >= 5 &&
            A <= 70 &&
            A < o &&
            IE({ x: -e.forward.x, y: -e.forward.y, z: -e.forward.z }, dc(b)) >
              0 &&
            ((s = y), (o = A));
        }
    }
    if (!s && !this.selected) return;
    if (
      (s &&
        s.id !== this.selected &&
        ((this.coefficient = 0), (this.angle = 0), (this.selected = s.id)),
      !s && this.coefficient <= M2(0.05))
    ) {
      this.reset();
      return;
    }
    const a = M2((o - 5) / 65),
      c = M2(392 - a * 392),
      l = s ? M2((120 + c) / 512) : 0;
    this.coefficient = M2((1 - M2(0.1)) * this.coefficient + l * M2(0.1));
    const u = r.matrixWorld.elements,
      h = { x: u[12], y: u[13], z: u[14] };
    if (s) {
      const y = dc(Hd(s.position, e.position)),
        b = dc({ x: u[8], y: u[9], z: u[10] });
      ((this.angle = M2((1 - Math.max(0, IE(b, y))) * M2(0.85))),
        M2(b.z * y.x - b.x * y.z) > 0 && (this.angle = M2(-this.angle)));
    }
    const d = dc(Hd(e.position, h)),
      f = M2(h.x + M2(d.x * M2(2.5))),
      p = M2(h.y + M2(d.y * M2(2.5))),
      v = M2(h.z + M2(d.z * M2(2.5))),
      w = { x: M2(-u[0] * 2.5), y: M2(-u[1] * 2.5), z: M2(-u[2] * 2.5) },
      g = { x: M2(u[4] * 2.5), y: M2(u[5] * 2.5), z: M2(u[6] * 2.5) };
    for (let y = 0; y < 4; y++) {
      const b = M2((y % 2 === 0 ? 1 : -1) + this.angle),
        A = y < 2 ? 1 : -1;
      ((this.positions[y * 3] = M2(w.x * b + g.x * A + f)),
        (this.positions[y * 3 + 1] = M2(w.y * b + g.y * A + p)),
        (this.positions[y * 3 + 2] = M2(w.z * b + g.z * A + v)));
    }
    ((this.uvs[5] = this.uvs[7] = this.coefficient),
      (this.geometry.attributes.position.needsUpdate = !0),
      (this.geometry.attributes.uv.needsUpdate = !0),
      (this.mesh.visible = !0));
  }
  reset() {
    ((this.selected = void 0),
      (this.coefficient = 0),
      (this.angle = 0),
      (this.mesh.visible = !1));
  }
  dispose() {
    (this.reset(),
      this.mesh.removeFromParent(),
      this.geometry.dispose(),
      this.material.dispose(),
      this.texture.dispose());
  }
}
class Fv {
  constructor(e, t, i, r, s) {
    ((this.library = e),
      (this.world = t),
      (this.options = i),
      (this.audio = r),
      (this.stage = s));
  }
  library;
  world;
  options;
  audio;
  stage;
  disposed = !1;
  pending = 0;
  failure;
  textures = new Map();
  actors = [];
  explosions = [];
  sounds = new Map();
  sources = new Set();
  threat;
  warning;
  firePath = "";
  arrowLife = 0;
  fireLife = 0;
  static async load(e, t, i, r, s, o) {
    const a = new Fv(e, t, r, s, o);
    try {
      const l = s2(
        await Yi(e, "item/giantEffect/item.bml").bytes(),
      ).children.filter((d) => d.name === "state" && T(d, "name") === "Affect");
      if (
        l.length !== 2 ||
        T(l[0], "fired") !== "fired00" ||
        T(l[1], "item") !== "arrow"
      )
        throw new Error("巨人效果原状态表不匹配。");
      if (
        ((a.fireLife = Number(T(l[0], "life"))),
        (a.arrowLife = Number(T(l[1], "life"))),
        a.fireLife !== 1e3 || a.arrowLife !== 3e4)
      )
        throw new Error("巨人效果原生命周期未核准。");
      a.firePath = `item/giantEffect/${T(l[0], "fired")}.1s`;
      for (const d of i) {
        const f = await a.build("item/giantEffect/arrow.1s"),
          p = new T2();
        ((p.matrixAutoUpdate = !1),
          (p.visible = !1),
          p.add(f.scene.object),
          t.add(p));
        const v = { actor: d, arrow: f, mount: p, spare: [] };
        (a.actors.push(v), v.spare.push(await a.build(a.firePath)));
      }
      for (const [d, f] of [
        ["scale", "sound_/fx/etc/giantScale.ogg"],
        ["press", "sound_/fx/etc/press.ogg"],
        ["reset", `sound_/fx/item/giantEffect/${T(l[0], "itemFx")}.ogg`],
        ["threat", "sound_/fx/surround/mo_돌구르기.ogg"],
      ])
        a.sounds.set(d, await Q9(s, await Yi(e, f).bytes()));
      const u = await p2(
          await Yi(e, "effect/giantShadow/giantShadow.png").bytes(),
        ),
        h = new J9(u.pixels, u.width, u.height);
      return (
        (h.flipY = !1),
        (h.needsUpdate = !0),
        (a.warning = new qr0(h)),
        t.add(a.warning.mesh),
        a
      );
    } catch (c) {
      throw (a.dispose(), c);
    }
  }
  build(e, t) {
    return aI(this.library, e, this.textures, this.options, !1, t);
  }
  replenish(e, t) {
    (this.pending++,
      this.build(this.firePath, t)
        .then((i) => {
          this.disposed ? i.scene.dispose() : e.spare.push(i);
        })
        .catch((i) => {
          this.disposed || (this.failure = i);
        })
        .finally(() => {
          (this.pending--, this.releaseTextures());
        }));
  }
  play(e, t = !1) {
    const i = this.sounds.get(e);
    if (!i) throw new Error(`巨人声音未装配：${e}`);
    const r = this.audio.createBufferSource();
    return (
      (r.buffer = i),
      (r.loop = t),
      S9(this.audio, r, "fx"),
      this.sources.add(r),
      (r.onended = () => {
        (r.disconnect(), this.sources.delete(r));
      }),
      r.start(),
      r
    );
  }
  setThreatSound(e) {
    this.disposed ||
      (e && !this.threat
        ? (this.threat = this.play("threat", !0))
        : !e &&
          this.threat &&
          (this.stop(this.threat), (this.threat = void 0)));
  }
  stop(e) {
    ((e.onended = null), e.stop(), e.disconnect(), this.sources.delete(e));
  }
  pose(e, t, i) {
    const r = t.actor.pose();
    if (!r) return !1;
    const { right: s, forward: o, up: a, position: c } = r;
    return (
      e.matrix.set(
        s.x,
        a.x,
        -o.x,
        Math.fround(c.x + a.x * i),
        s.y,
        a.y,
        -o.y,
        Math.fround(c.y + a.y * i),
        s.z,
        a.z,
        -o.z,
        Math.fround(c.z + a.z * i),
        0,
        0,
        0,
        1,
      ),
      (e.matrixWorldNeedsUpdate = !0),
      !0
    );
  }
  update(e, t, i, r, s) {
    if (this.disposed) return;
    if (this.failure) throw this.failure;
    const o = this.actors.find((l) => l.actor.logic.local);
    for (const l of this.actors) {
      for (const h of l.actor.logic.consumeVisuals()) {
        if (h.kind === "stage") {
          l.actor.logic.local && this.stage(h.cells, h.atMs);
          continue;
        }
        if (h.kind === "reset") {
          const d = l.spare.pop();
          if (!d) throw new Error("巨人爆炸原模型克隆尚未补回。");
          const f = new T2();
          ((f.matrixAutoUpdate = !1),
            f.add(d.scene.object),
            this.world.add(f),
            d.scene.reset(h.atMs),
            this.explosions.push({
              model: d,
              mount: f,
              actor: l,
              start: h.atMs,
            }),
            this.replenish(l, d.parsed));
        }
        l.actor.logic.local && this.play(h.kind);
      }
      const u = o.actor.logic.main === 4 && l.actor.logic.main !== 4;
      (u &&
        l.arrowStart === void 0 &&
        ((l.arrowStart = e), l.arrow.scene.reset(e)),
        u || (l.arrowStart = void 0),
        l.arrowStart !== void 0 &&
          (e - l.arrowStart) >>> 0 >= this.arrowLife &&
          ((l.arrowStart = e), l.arrow.scene.reset(e)),
        (l.mount.visible =
          u &&
          this.pose(
            l.mount,
            l,
            Math.fround(l.actor.logic.mainScale.z * Math.fround(1.31)),
          )),
        l.mount.visible && l.arrow.scene.update(e, t, i, r));
    }
    for (let l = this.explosions.length - 1; l >= 0; l--) {
      const u = this.explosions[l];
      if ((e - u.start) >>> 0 >= this.fireLife) {
        (u.mount.removeFromParent(),
          u.model.scene.dispose(),
          this.explosions.splice(l, 1));
        continue;
      }
      ((u.mount.visible = this.pose(u.mount, u.actor, 0)),
        u.model.scene.update(e, t, i, r));
    }
    const a = (l) => {
        const u = l.actor.pose();
        return u ? { id: l.actor.id, main: l.actor.logic.main, ...u } : void 0;
      },
      c = a(o);
    c &&
      this.warning?.update(
        c,
        this.actors
          .filter((l) => l !== o)
          .flatMap((l) => {
            const u = a(l);
            return u ? [u] : [];
          }),
        s,
        t,
      );
  }
  releaseTextures() {
    if (this.disposed && this.pending === 0) {
      for (const e of this.textures.values()) e.dispose();
      this.textures.clear();
    }
  }
  dispose() {
    if (!this.disposed) {
      ((this.disposed = !0), this.warning?.dispose(), (this.warning = void 0));
      for (const e of [...this.sources]) this.stop(e);
      ((this.threat = void 0), this.sounds.clear());
      for (const e of this.actors) {
        (e.mount.removeFromParent(), e.arrow.scene.dispose());
        for (const t of e.spare) t.scene.dispose();
        e.spare.length = 0;
      }
      for (const e of this.explosions)
        (e.mount.removeFromParent(), e.model.scene.dispose());
      ((this.explosions.length = 0),
        (this.actors.length = 0),
        this.releaseTextures());
    }
  }
}
class Kr0 {
  constructor(e, t, i) {
    ((this.local = e), (this.kart = t), (this.character = i));
  }
  local;
  kart;
  character;
  clones = [];
  transparent = !1;
  purple = !1;
  update(e, t) {
    e === 0 ? (this.purple = !1) : t === 2 && (this.purple = !0);
    for (const [s, o] of [
      [this.kart, 4284887961],
      [this.character, 2858824601],
    ])
      for (const { mesh: a } of s)
        Ab(a, {
          selector: this.purple ? 1 : 0,
          centerArgb: this.purple ? o : 4278190080,
          outerArgb: this.purple ? 6697881 : 2130706432,
        });
    const r = this.local && e === 4;
    if (
      this.transparent !== r &&
      (this.restoreMaterials(), (this.transparent = r), !!r)
    )
      try {
        for (const s of [...this.kart, ...this.character]) {
          const o = s.mesh.material;
          if (Array.isArray(o) || !(o instanceof $1))
            throw new Error("巨人模型缺少已闭合的单材质 root consumer。");
          if (!zn(o) && !s.inheritsRootAlpha) continue;
          const a = o.clone(),
            c = s.mesh.onBeforeRender,
            l = s.inheritsRootAlpha ? QG(s.mesh) : () => {},
            u = () => {
              for (const [h, d] of Object.entries(o.uniforms)) {
                const f = d.value,
                  p = a.uniforms[h];
                p &&
                  (f?.isTexture
                    ? (p.value = f)
                    : p.value?.copy && f?.clone
                      ? p.value.copy(f)
                      : (p.value = f));
              }
              (zn(a) && (a.uniforms.normalUvOffset.value.y = NL),
                s.inheritsRootAlpha &&
                  ((a.uniforms.alphaTestEnabled.value = 1),
                  (a.uniforms.alphaFunction.value = 5),
                  (a.uniforms.alphaReference.value = 0),
                  (a.transparent = !0),
                  (a.blending = u1),
                  (a.blendSrc = l1),
                  (a.blendDst = v1),
                  (a.blendEquation = R9)));
            };
          (this.clones.push({
            binding: s,
            source: o,
            clone: a,
            callback: c,
            restore: l,
          }),
            (s.mesh.material = a),
            (s.mesh.onBeforeRender = function (...h) {
              (c.apply(this, h), u());
            }),
            u());
        }
      } catch (s) {
        throw (this.restoreMaterials(), s);
      }
  }
  restoreMaterials() {
    for (const e of this.clones.splice(0).reverse())
      ((e.binding.mesh.material = e.source),
        (e.binding.mesh.onBeforeRender = e.callback),
        e.restore(),
        e.clone.dispose());
  }
  dispose() {
    (this.restoreMaterials(), (this.transparent = !1), (this.purple = !1));
    for (const { mesh: e } of [...this.kart, ...this.character]) Ab(e, void 0);
  }
}
class jr0 {
  constructor(e, t, i, r, s, o, a, c, l, u, h, d, f, p = () => !1, v, w) {
    ((this.assets = e),
      (this.runtime = t),
      (this.race = i),
      (this.playerId = r),
      (this.hud = o),
      (this.random = a),
      (this.countdown = c),
      (this.award = l),
      (this.resultView = u),
      (this.bgm = h),
      (this.banner = d),
      (this.bannerRequest = f),
      (this.petVisible = p),
      (this.trackInfoCard = v),
      (this.roadblockHud = w),
      (this.cameraShake = new nP(a, this.cameraEffectAnchor)),
      (this.rankRoster = new Tr0(i.roster, r)),
      (this.lightFactor = new sP(a)));
    const g = e.participants.find((b) => b.playerId === r);
    ((this.tachometer = g.vehicle.tachometerRenderer),
      this.tachometer.enableUiSmoothing(),
      this.gaugePreserve.configure(g.vehicle.tachometerSelection.folder),
      (this.action2d = new dI(s)),
      this.action2d.enableUiSmoothing(),
      this.drive.configureP3528ResolutionMode(),
      this.surround.configureP3528ResolutionMode());
    const y = t.local.track;
    (this.scene.add(y.group),
      kv(this.scene, y),
      e.rain && this.scene.add(e.rain.object),
      e.snow && this.scene.add(e.snow.object));
    try {
      for (const b of e.participants) {
        const A = b.vehicle,
          x = new Vg(this.scene);
        (this.views.set(b.playerId, x),
          b.playerId === r
            ? this.scene.add(...lc(A))
            : this.scene.add(A.trails.object),
          x.setModel(
            A.imported.object,
            A.visual,
            A.imported.animation,
            A.imported.model,
            A.imported.scene,
          ));
        const M = J5(A.imported.model),
          E = M.children[6]?.value,
          _ =
            E && "children" in E
              ? A.imported.renderScene?.bySource.get(E)
              : void 0,
          C = b.characters.linked ?? b.characters.ordinary;
        if (C) {
          if (!_) throw new Error("多人赛车缺少原角色挂点。");
          if (
            (_.clear(),
            _.add(C.scene.object),
            C.scene.object.scale.setScalar(A.visual.onCharacterSize),
            b.characters.linked)
          ) {
            const I = A.imported.renderScene?.bySource.get(M);
            if (!I || !C.award)
              throw new Error("多人联动角色的车体显示或领奖资源未就绪。");
            const L = new _a(
              I,
              _,
              C.scene.object,
              A.kartItem.alwaysLinkCharacter,
            );
            (L.resetForRacePresentation(),
              this.linkedPresentations.set(b.playerId, L));
          }
        }
        for (const I of A.accessories) {
          if (!C) throw new Error("多人角色饰品缺少角色。");
          const L = I.kind === "aura" ? void 0 : oP[I.kind],
            k = L
              ? C.scene.getDecorationSocket(L[0], L[1])
              : C.scene.getDecorationOwner();
          if (!k) throw new Error("多人角色饰品挂点缺失。");
          if ((k.add(I.render.scene.object), I.kind === "aura")) {
            if (!_) throw new Error("多人赛车缺少炫光车体挂点。");
            const D = A.imported.renderScene?.bySource.get(M);
            if (!D) throw new Error("多人赛车缺少炫光车体根节点。");
            ev(k, D, I.render.scene.object);
          }
        }
        if (A.decoration) {
          const I = x.getAttachment(16);
          if (!I) throw new Error("多人赛车缺少气球挂点。");
          I.add(A.decoration.scene.object);
        }
        if (e.drivingMode?.kind === "giant") {
          const I = A.imported.renderScene?.rootMaterialBindings,
            L = C?.scene.rootMaterialBindings;
          if (!I || !L) throw new Error("巨人模型缺少独立材料继承 consumer。");
          this.giantAppearances.set(
            b.playerId,
            new Kr0(b.playerId === r, I, L),
          );
        }
        const S = t.local.startPose,
          G = rL(
            S.position,
            S.right,
            i.startSlots[b.playerId],
            (I, L) => y.rayQuery(I, L, !1)?.point,
          );
        (this.initialPoses.set(b.playerId, { ...S, position: G }),
          x.updatePose({
            x: G.x,
            y: G.y,
            z: G.z,
            ...S,
            visualScale: { x: 1, y: 1, z: 1 },
          }),
          e.drivingMode?.kind === "shadow" &&
            b.playerId !== r &&
            this.shadowPresentations.set(
              b.playerId,
              new $i0(A.imported.object),
            ));
      }
    } catch (b) {
      throw (this.dispose(), b);
    }
  }
  assets;
  runtime;
  race;
  playerId;
  hud;
  random;
  countdown;
  award;
  resultView;
  bgm;
  banner;
  bannerRequest;
  petVisible;
  trackInfoCard;
  roadblockHud;
  roadblockFlag;
  giantPresentation;
  giantAppearances = new Map();
  roadblockResult;
  scene = Object.assign(new D1(), {
    matrixWorldAutoUpdate: !1,
    matrixAutoUpdate: !1,
    matrixWorldNeedsUpdate: !1,
  });
  camera = new Z9();
  drive = new Ol(zB);
  surround = new KL();
  cameraShake;
  cameraEffectAnchor = { value: 0 };
  cameraWave = new iP(this.cameraEffectAnchor);
  lightFactor;
  initialPoses = new Map();
  views = new Map();
  shadowPresentations = new Map();
  linkedPresentations = new Map();
  rankRoster;
  action2d;
  finishBlackBar = new bE();
  warpBlackBar = new bE();
  finishCountdown = new vr0();
  audioStarted = !1;
  size = new B2();
  retiredCharacterIds = new Set();
  winnerMotion = new Rr0();
  localRetirePending = !1;
  cameraMode = "ready";
  warpCameraFrozen = !1;
  warpHudHidden = !1;
  disposed = !1;
  flyingPet;
  resultVisible = !1;
  resultComplete = !1;
  gaugePreserve = new tP();
  tachometer;
  trackEventEffects;
  trackEventAudio;
  trackDummyAudio;
  async prepareFlyingPet(e, t) {
    const i = this.assets.participants.find(
        (c) => c.playerId === this.playerId,
      ),
      r = await Ma(e, i.profile.equipment.itemIds[52]);
    if (!r) return;
    const s = i.characters.ordinary?.scene,
      o = J5(i.vehicle.imported.model).children[6]?.value;
    if (!s || !o || !("transform" in o))
      throw new Error("Flying pet rider mount is missing.");
    const a = await S4.race({
      library: e,
      item: r,
      role: "local",
      environment: this.assets.map.environment,
      binding: this.assets.map.stageBinding,
      colors: await We(e, i.profile.equipment.itemIds[2] || 1),
      random: this.random,
      grandparentScale: o.transform.scale,
      audioContext: t,
      listen: (c) => this.runtime.local.physics.addFlyingPetListener(c),
    });
    if (this.disposed)
      throw (
        a?.dispose(),
        new Error("Flying pet race was disposed while loading.")
      );
    ((this.flyingPet = a), a?.mount(s.getDecorationOwner()));
  }
  async prepareRoadBlockFlag(e) {
    if (!this.race.roadblock) return;
    const t = this.views.get(this.race.roadblock.runnerId);
    if (!t) throw new Error("挡人比赛缺少冻结跑者模型。");
    const i = await _v.load(
      e,
      t.root,
      {
        environment: this.assets.map.environment,
        stageBinding: this.assets.map.stageBinding,
      },
      this.race.roadblock.runnerId === this.playerId,
    );
    if (this.disposed) {
      i.dispose();
      return;
    }
    this.roadblockFlag = i;
  }
  async prepareGiant(e, t) {
    if (this.assets.drivingMode?.kind !== "giant") return;
    const i = this.assets.participants.map((s) => {
        const o =
          s.playerId === this.playerId
            ? this.runtime.local.giant
            : this.runtime.remotes.giant(s.playerId);
        if (!o) throw new Error("巨人表现缺少本局车辆 owner。");
        return {
          id: s.playerId,
          logic: o,
          pose: () =>
            s.playerId === this.playerId
              ? this.runtime.local.physics.body
              : this.runtime.remotes.presentationVisible(
                    s.playerId,
                    performance.now(),
                  )
                ? this.runtime.remotes.copyWebPose(s.playerId)
                : void 0,
        };
      }),
      r = await Fv.load(
        e,
        this.scene,
        i,
        {
          environment: this.assets.map.environment,
          stageBinding: this.assets.map.stageBinding,
        },
        t,
        (s, o) => this.hud.giantStage(s, o),
      );
    if (this.disposed) {
      r.dispose();
      return;
    }
    this.giantPresentation = r;
  }
  clearGiant() {
    if (this.assets.drivingMode?.kind === "giant") {
      (this.giantPresentation?.dispose(),
        (this.giantPresentation = void 0),
        this.hud.clearGiant());
      for (const e of this.giantAppearances.values()) e.dispose();
      (this.giantAppearances.clear(), this.cameraShake.setGiantGate(void 0));
    }
  }
  async prepareTrackEvents(e, t) {
    if (this.disposed) throw new Error("多人赛道场景已经释放。");
    const i = this.assets.map.eventProjections,
      r =
        i.length > 0
          ? this.views.get(this.playerId)?.presentationRoot()
          : void 0;
    if (i.length > 0 && !r) throw new Error("多人事件效果缺少本机车辆挂点。");
    const s = r
      ? await b7.load(
          e,
          i,
          r,
          this.assets.map.environment,
          this.assets.map.stageBinding,
          t,
        )
      : void 0;
    let o, a;
    try {
      const c = this.assets.map.renderScene?.clientWorldElements;
      if (i.some((l) => l.sound) && !c)
        throw new Error("多人事件独立音效缺少赛道世界矩阵。");
      if (
        ((o = c && i.some((l) => l.sound) ? await v7.load(e, i, c, t) : void 0),
        (a =
          this.assets.map.dummySounds.length > 0
            ? await m7.load(e, this.assets.map.dummySounds, t)
            : void 0),
        this.disposed)
      )
        throw (
          s?.dispose(),
          o?.dispose(),
          a?.dispose(),
          new Error("多人赛道场景载入期间已释放。")
        );
      ((this.trackEventEffects = s),
        (this.trackEventAudio = o),
        (this.trackDummyAudio = a));
    } catch (c) {
      throw (s?.dispose(), o?.dispose(), a?.dispose(), c);
    }
  }
  async prepareRoadBlockResult(e) {
    if (!this.race.roadblock) return;
    const t = await Bv.load(e, this.assets);
    if (this.disposed) {
      t.dispose();
      return;
    }
    this.roadblockResult = t;
  }
  warm(e, t) {
    (this.assets.map.readyCamera.start(),
      this.update(e, t, []),
      Hn(e, this.scene, this.scene));
    for (const s of this.assets.participants)
      (Hn(e, this.views.get(s.playerId).root, this.scene, !0),
        s.vehicle.effects.warmDetachedScenes(e, this.scene));
    (this.runtime.local.track.skydome &&
      Hn(e, this.runtime.local.track.skydome, this.scene),
      e.getDrawingBufferSize(this.size));
    const i = new nn(this.size.x, this.size.y),
      r = e.getRenderTarget();
    try {
      (e.setRenderTarget(i), this.render(e, t));
    } finally {
      (e.setRenderTarget(r), i.dispose());
    }
  }
  update(e, t, i) {
    if (this.disposed) return;
    (this.runtime.giantEffectsEnded && this.clearGiant(),
      this.trackInfoCard?.update(t),
      this.banner?.update(
        t,
        this.runtime.local.scheduledStartAtMs,
        this.runtime.local.lifecycle.state === X2.Countdown,
        this.bannerRequest,
      ),
      e.getDrawingBufferSize(this.size));
    const r = this.size.x,
      s = this.size.y;
    if (
      ((this.camera.aspect = r / s),
      !this.resultVisible &&
        i.some((g) => g.kind === "publish-result") &&
        this.showResult(t),
      this.resultVisible)
    ) {
      (this.hud.hideTimeGap(),
        (this.resultComplete = this.resultView.update(t)),
        this.assets.map.stageBinding.beginFrame(t),
        this.award?.update(
          t,
          this.camera,
          this.runtime.local,
          this.assets,
          this.views,
        ),
        this.roadblockResult?.update(t, this.camera, r, s),
        this.runtime.local.track.updateRender(t, this.camera, r, s),
        this.assets.lteCoins?.update(t, this.camera, r, s),
        e4(this.scene, this.camera, !1),
        this.runtime.local.track.skydome &&
          e4(this.runtime.local.track.skydome, this.camera));
      return;
    }
    const { physics: o, track: a } = this.runtime.local,
      c = this.race.roadblock ? this.runtime.roadBlockRemaining(t) : void 0;
    if (c !== void 0) {
      this.roadblockHud?.setRemaining(c);
      const g = a.data.lapTarget;
      if (g === void 0) throw new Error("挡人HUD缺少赛道圈数。");
      this.roadblockHud?.setRunnerLaps(
        this.runtime.roadBlockRunnerProgress()?.lap,
        g,
      );
    }
    (this.finishCountdown.update(
      t,
      this.runtime.local.lifecycle.state === X2.Racing
        ? this.runtime.finishDeadline
        : void 0,
    ) && this.countdown?.playFinishNumber(),
      this.runtime.local.consumeResetSound() &&
        (this.cameraShake.leave(!0),
        this.cameraWave.leave(),
        this.playReset()));
    for (const g of this.runtime.local.consumeLocalRouteTags())
      this.handleRouteTag(g);
    (this.applyLocalWarpActions(), this.lightFactor.update());
    for (const g of i) {
      if (g.kind === "countdown") {
        if (g.step === 2)
          for (const [y, b] of this.linkedPresentations)
            (b.setMode(4), this.views.get(y)?.resetAnimation());
        if (
          (this.countdown?.playNumber(),
          g.step === 2 && this.flyingPet?.launch(),
          g.step === 3)
        )
          for (const y of this.assets.participants)
            y.vehicle.accessories
              .find((b) => b.kind === "aura")
              ?.render.requestDespawn?.();
      }
      (g.kind === "count-go" && this.playGoAndHideTrackInfo(),
        g.kind === "lap" && this.countdown?.playLap(),
        g.kind === "final-lap" && this.countdown?.playFinalLap(),
        g.kind === "switch-drive-camera" &&
          ((this.cameraMode = "drive"), this.drive.reset()),
        g.kind === "switch-surround-camera" &&
          ((this.cameraMode = "surround"), this.surround.reset()),
        g.kind === "start-effect" && this.action2d.scheduleStart(g.atMs),
        g.kind === "lap" && this.action2d.showLap(g.value, t),
        g.kind === "final-lap" && this.action2d.showFinalLap(t),
        g.kind === "forced-finish" &&
          !this.race.roadblock &&
          ((this.localRetirePending = !0),
          this.action2d.showRetire(t),
          this.finishBlackBar.start(t),
          this.bgm?.playResult(!1)),
        g.kind === "natural-finish" &&
          !this.race.roadblock &&
          (this.winnerMotion.acceptLocalFinish(g.outcome),
          this.finishBlackBar.start(t),
          this.bgm?.playMultiplayerFinish(g.outcome === "winner"),
          g.outcome === "winner"
            ? this.action2d.showWinner(t)
            : this.action2d.showFinish(t)),
        g.kind === "raceover" && this.action2d.showRaceOver(t));
    }
    if (this.warpCameraFrozen) this.applyWarpCamera();
    else if (this.cameraMode === "ready")
      this.assets.map.readyCamera.apply(this.camera, t, o.body);
    else if (this.cameraMode === "surround")
      this.surround.apply(
        this.camera,
        this.surround.update(
          t,
          o.body,
          o.driveCameraRuntime().eventScaleSecondary.z,
        ),
      );
    else {
      const g = a.currentRouteSurface(o),
        y = o.body;
      if (o.giant && !this.runtime.giantEffectsEnded) {
        let E = !1;
        if (
          o.giant.main !== 4 &&
          this.runtime.local.lifecycle.state === X2.Racing
        )
          for (const _ of this.assets.participants) {
            const C = this.runtime.remotes.giant(_.playerId),
              S = this.runtime.remotes.copyWebPose(_.playerId);
            if (!C || C.main !== 4 || !S) continue;
            const G = Math.fround(S.position.x - y.position.x),
              I = Math.fround(S.position.y - y.position.y),
              L = Math.fround(S.position.z - y.position.z);
            if (
              Math.fround(
                Math.fround(Math.fround(G * G) + Math.fround(L * L)) +
                  Math.fround(I * I),
              ) < 900
            ) {
              E = !0;
              break;
            }
          }
        (this.cameraShake.setGiantGate(
          E ? Math.fround(1e3 - o.giant.main * 100) : !1,
        ),
          this.giantPresentation?.setThreatSound(E));
      }
      const b = this.cameraShake.update(t, g),
        A = {
          x: Math.fround(y.position.x + b.x),
          y: Math.fround(y.position.y + b.y),
          z: Math.fround(y.position.z + b.z),
        };
      this.cameraWave.update(t, g, y, A);
      const x = this.drive.update({
          timestampMs: t,
          body: { ...y, position: A },
          routeSurface: g,
          ...o.driveCameraRuntime(),
        }),
        M = this.runtime.local.warpNext.fairyFovFactor();
      this.drive.apply(this.camera, {
        ...x,
        horizontalFovDegrees:
          M === void 0
            ? x.horizontalFovDegrees
            : Math.max(Math.fround(x.horizontalFovDegrees * M), 65),
        far: a.cameraFar ?? x.far,
      });
    }
    (this.assets.map.stageBinding.beginFrame(t),
      a.updateRender(t, this.camera, r, s),
      this.assets.lteCoins?.update(t, this.camera, r, s),
      this.assets.rain?.update(t, this.camera, r, s),
      this.assets.snow?.update(t, this.camera, r, s));
    const l = this.runtime.finishSnapshot(),
      u = [];
    for (const g of this.assets.participants) {
      const y = this.views.get(g.playerId);
      if (!y) continue;
      const b =
        g.playerId === this.playerId
          ? this.runtime.localPresentation
          : this.runtime.remotes.consumePresentation(g.playerId);
      let A;
      if (g.playerId === this.playerId) {
        const I = o.body;
        ((A = y.update(
          {
            ...o.state,
            x: I.position.x,
            y: I.position.y,
            z: I.position.z,
            right: I.right,
            forward: I.forward,
            up: I.up,
          },
          t,
          o.consumeKartAnimationInput(),
        )),
          A !== void 0 && o.setAnimationSlot(A));
      } else {
        const I =
          this.runtime.remotes.copyWebPose(g.playerId) ??
          this.initialPoses.get(g.playerId);
        if ((I && u.push({ playerId: g.playerId, pose: I }), I)) {
          const L = {
            x: I.position.x,
            y: I.position.y,
            z: I.position.z,
            ...I,
            visualScale:
              "visualScale" in I ? I.visualScale : { x: 1, y: 1, z: 1 },
          };
          b?.animation ? y.updateRemote(L, t, b.animation) : y.updatePose(L);
        }
      }
      y.root.visible =
        g.playerId === this.playerId
          ? this.runtime.local.resetVisible(t) &&
            this.runtime.local.warpNext.presentationVisible(t)
          : this.runtime.remotes.presentationVisible(g.playerId, t);
      const x = b?.motion,
        M = this.linkedPresentations.get(g.playerId),
        E = x ? M?.updateSpeedRace(x.boosterState, t) : void 0;
      y.root.updateMatrixWorld(!0);
      const _ =
        g.playerId === this.playerId
          ? o.giant
          : this.runtime.remotes.giant(g.playerId);
      (_ && this.giantAppearances.get(g.playerId)?.update(_.main, _.extra),
        g.vehicle.imported.renderScene?.update(this.camera, r, s),
        g.draftEffect?.update(
          t,
          y.root.visible && this.runtime.draftPresentationVisible(g.playerId),
          y.root.visible && this.runtime.draftBurstActive(g.playerId),
          this.camera,
          r,
          s,
        ));
      const C =
          g.playerId === this.playerId
            ? this.localRetirePending
            : this.runtime
                .resultSnapshot()
                ?.some(
                  (I) => I.playerId === g.playerId && I.elapsedMs === null,
                ),
        S = C && !this.retiredCharacterIds.has(g.playerId);
      S && this.retiredCharacterIds.add(g.playerId);
      const G = this.winnerMotion.consume(g.playerId, this.playerId, l, !!C);
      ((g.characters.linked ?? g.characters.ordinary)?.scene.update(
        t,
        this.camera,
        r,
        s,
        S || G
          ? {
              forwardSpeed: 0,
              rawSteer: 0,
              tireTransient: 0,
              boosterState: 0,
              instantAccelerationActive: !1,
              motorcycle: !1,
              landingTrigger: !1,
              collisionHit: !1,
              collisionStrength: 0,
              visualScaleMode: 0,
              ...x,
              linkedPresentationMotion: E,
              finishMotion: S ? 13 : G,
            }
          : x
            ? { ...x, linkedPresentationMotion: E }
            : void 0,
      ),
        b &&
          (g.vehicle.lampFlares.setInputPair("front", b.frontLamp),
          g.vehicle.lampFlares.setInputPair("rear", b.rearLamp)),
        g.vehicle.lampFlares.update(
          t,
          this.camera,
          g.vehicle.imported.renderScene !== void 0,
        ),
        g.playerId !== this.playerId &&
          b &&
          (b.animation &&
            xr0(
              g.vehicle,
              y,
              this.camera,
              t,
              b.animation,
              b.motion.instantAccelerationActive,
              r,
              s,
            ),
          g.vehicle.trails.setState(b.motion.boosterState, t),
          g.vehicle.trails.update(
            t,
            this.camera,
            g.vehicle.imported.renderScene !== void 0,
          )));
      for (const I of g.vehicle.accessories)
        (I.kind === "headBand" &&
          b &&
          I.render.setOwnerState?.(b.motion.boosterState, t),
          I.render.scene.update(t, this.camera, r, s));
      (g.playerId === this.playerId &&
        Mr0(
          g.vehicle,
          this.runtime.local,
          y,
          this.camera,
          t,
          A,
          M?.simpleShadowEnabled() ?? !0,
        ),
        g.vehicle.decoration?.scene.update(t, this.camera, r, s));
    }
    const h = o.consumeTrackEventEffectRequests();
    if (
      (this.roadblockFlag?.update(t, this.camera, r, s),
      this.giantPresentation?.update(
        t,
        this.camera,
        r,
        s,
        o.giantSourceProtected(),
      ),
      this.assets.drivingMode?.kind === "shadow")
    )
      for (const g of this.shadowPresentations.values()) g.update();
    if (h.length > 0 && !this.trackEventEffects)
      throw new Error("多人赛道事件缺少本机效果对象。");
    for (const g of h) this.trackEventEffects.trigger(g.effect, g.atMs);
    for (const g of a.consumeExpiredEventEffects())
      this.trackEventEffects?.remove(g);
    (this.flyingPet?.update(t, this.camera, r, s, this.petVisible()),
      this.trackEventEffects?.update(t, this.camera, r, s),
      this.trackEventAudio?.update(t, o.body.position),
      this.trackDummyAudio?.update(this.camera),
      this.captureRankProgress());
    const d = _r0(
      this.race.roster,
      this.playerId,
      (g) => this.rankRoster.progress(g),
      this.hud.markerTints(),
      this.runtime.finishSnapshot(),
      (g) =>
        this.runtime.remotes.rankDisconnected(g)
          ? void 0
          : this.runtime.latencyMs(g),
    );
    o.giant?.setRank(d === void 0 ? void 0 : d.rank - 1);
    let f =
      d ??
      Gr0(this.race.roster, this.playerId, this.hud.markerTints(), (g) =>
        this.runtime.remotes.rankDisconnected(g)
          ? void 0
          : this.runtime.latencyMs(g),
      );
    const p = this.runtime.resultSnapshot();
    if (
      (p && (f = Br0(f, p)),
      (f = {
        ...f,
        rows: f.rows.map((g) => ({
          ...g,
          out: this.rankRoster.out(g.participantId),
          disconnected: this.runtime.remotes.rankDisconnected(g.participantId),
        })),
      }),
      this.action2d.setFinishDeadline(
        this.runtime.local.lifecycle.state === X2.Racing
          ? this.runtime.finishDeadline
          : void 0,
      ),
      o.consumeTeamGaugeFullAnimation() && this.hud.startTeamBoostGaugeFull(),
      this.hud.update(this.runtime.local, t, u, f),
      this.hud.timeGapEnabled && this.warpHudHidden && this.hud.hideTimeGap(),
      this.hud.timeGapEnabled && !this.warpHudHidden)
    ) {
      const g = this.runtime.finishSnapshot();
      this.hud.updateTimeGap(
        this.runtime.local,
        t,
        this.race.roster
          .filter((y) => this.views.has(y.playerId))
          .map((y) => {
            const b =
                y.playerId === this.playerId
                  ? this.runtime.local.raceProgress()
                  : this.runtime.remotes.raceProgress(y.playerId),
              A = g.find((x) => x.playerId === y.playerId);
            return {
              playerId: y.playerId,
              name: y.name,
              progress: A
                ? {
                    distance: b?.distance ?? 0,
                    lap: b?.lap ?? 0,
                    finishElapsedMs: A.elapsedMs,
                  }
                : b,
            };
          }),
        this.playerId,
      );
    }
    const v = Math.trunc(t) >>> 0,
      w = this.gaugePreserve.update(
        t,
        o.consumeTimeAttackTachometerGaugePreserve(),
      );
    (QL(
      this.tachometer,
      o,
      t,
      v,
      v,
      0,
      w,
      o.consumeTimeAttackTachometerNormalBooster(),
      this.runtime.localDraftHudActive(),
    ),
      this.audioStarted &&
        this.assets.draftAudio.update(
          this.runtime.draftPresentationVisible(this.playerId),
          this.runtime.localDraftHudActive(),
        ),
      e4(this.scene, this.camera, !1),
      a.skydome && e4(a.skydome, this.camera));
  }
  awardInput(e, t) {
    this.resultVisible && this.award?.input(e, t);
  }
  applyWarpCamera() {
    if (!this.warpCameraFrozen) return;
    const e = this.assets.map.warpNextCamera;
    if (!e) throw new Error("warpnextcamera_cam 缺失；多人不能沿用旧镜头。");
    e(this.camera);
  }
  applyLocalWarpActions() {
    for (const e of this.runtime.local.consumeWarpActions())
      (e.kind === "start-warp-presentation" && (this.warpHudHidden = !0),
        e.kind === "reset-drive-camera" &&
          (this.drive.reset(0), (this.warpCameraFrozen = !1)),
        e.kind === "freeze-camera" && (this.warpCameraFrozen = !0),
        e.kind === "teleport" && (this.warpCameraFrozen = !1),
        e.kind === "finish-warp-letterbox" && (this.warpHudHidden = !1));
  }
  handleRouteTag(e) {
    const t = Vo(e);
    (t === "flash" && this.lightFactor.trigger(),
      t.startsWith("shake") &&
        (e.includes(":in:")
          ? this.cameraShake.enter()
          : e.includes(":out:") && this.cameraShake.leave(!0)),
      t.startsWith("wave") &&
        (e.includes(":in:")
          ? this.cameraWave.enter()
          : e.includes(":out:") && this.cameraWave.leave()));
  }
  showResult(e) {
    (this.clearGiant(),
      this.roadblockFlag?.dispose(),
      (this.roadblockFlag = void 0),
      this.releaseShadowPresentations(),
      this.flyingPet?.dispose(),
      (this.flyingPet = void 0),
      this.cameraShake.leave(!0),
      this.cameraWave.leave(),
      (this.warpCameraFrozen = !1),
      (this.warpHudHidden = !1),
      this.trackEventEffects?.dispose(),
      (this.trackEventEffects = void 0),
      this.trackEventAudio?.dispose(),
      (this.trackEventAudio = void 0),
      this.trackDummyAudio?.dispose(),
      (this.trackDummyAudio = void 0));
    const t = this.runtime.resultSnapshot();
    if (!t || !this.resultView) throw new Error("本局结果展示资源未就绪。");
    const i = this.runtime.raceSnapshot();
    if (i.roadblock) {
      if ((this.roadblockHud?.hide(), !this.roadblockResult))
        throw new Error("挡人专属结算场景未就绪。");
      for (const s of this.assets.participants) {
        s.draftEffect?.reset(e);
        for (const o of lc(s.vehicle)) o.removeFromParent();
        (s.vehicle.effects.setState(0, 0, !1, !1, e),
          s.vehicle.lampFlares.resetInputVisibility(),
          s.vehicle.imported.animation?.reset(e),
          s.vehicle.audio.stopRace());
      }
      (this.roadblockResult.show(
        e,
        this.runtime.local,
        this.assets,
        this.views,
        i,
      ),
        this.scene.add(
          this.roadblockResult.root,
          this.roadblockResult.effectRoot,
        ),
        this.assets.draftAudio.reset(),
        this.resultView.show(t, e, i),
        (this.resultVisible = !0),
        this.bgm?.playResult(
          i.roadblockOutcome?.runnerWon ===
            (i.roadblock.runnerId === this.playerId),
        ));
      return;
    }
    if (!this.award) throw new Error("本局颁奖资源未就绪。");
    const r = rG(this.assets.mode ?? "individual", i.roster, t, i.winningTeam);
    for (const s of t)
      if (r.includes(s.playerId) && !this.views.has(s.playerId)) {
        const o = this.assets.participants.find(
            (l) => l.playerId === s.playerId,
          ),
          a = new Vg(this.scene),
          c = o.vehicle;
        (a.setModel(
          c.imported.object,
          c.visual,
          c.imported.animation,
          c.imported.model,
          c.imported.scene,
        ),
          this.views.set(s.playerId, a));
      }
    for (const [s, o] of this.linkedPresentations)
      (this.views.get(s)?.resetAnimation(), o.setMode(1));
    this.award.show(e, this.runtime.local, t, this.views, i);
    for (const s of this.assets.participants) {
      s.draftEffect?.reset(e);
      for (const o of lc(s.vehicle)) o.removeFromParent();
      (s.vehicle.effects.setState(0, 0, !1, !1, e),
        s.vehicle.lampFlares.resetInputVisibility(),
        s.vehicle.imported.animation?.reset(e),
        s.vehicle.audio.stopRace());
    }
    (this.assets.draftAudio.reset(),
      this.scene.add(this.award.root, this.award.effectRoot),
      this.resultView.show(t, e, i),
      (this.resultVisible = !0),
      this.bgm?.playMultiplayerPodium());
  }
  startAudio() {
    this.audioStarted ||
      ((this.audioStarted = !0),
      this.bgm?.restart(),
      this.trackInfoCard?.setBgmName(this.bgm?.currentRaceName ?? ""),
      this.trackInfoCard?.setVisible(!0),
      this.assets.participants
        .find((e) => e.playerId === this.playerId)
        .vehicle.audio.start());
  }
  playGoAndHideTrackInfo() {
    (this.countdown?.playGo(), this.trackInfoCard?.slideOut());
  }
  playReset() {
    this.assets.participants
      .find((e) => e.playerId === this.playerId)
      .vehicle.audio.playReset();
  }
  startBoostGaugeFull() {
    (eP(this.tachometer), this.hud.startBoostGaugeFull());
  }
  captureRankProgress() {
    this.rankRoster.capture((e) =>
      e === this.playerId
        ? this.runtime.local.raceProgress()
        : this.runtime.remotes.raceProgress(e),
    );
  }
  updateRoom(e) {
    if (this.resultVisible) return;
    const t = new Set(e.members.map((i) => i.playerId));
    (this.captureRankProgress(), this.rankRoster.updatePresent(t));
  }
  render(e, t) {
    if (this.disposed) return;
    const i = e.autoClear;
    try {
      ((e.autoClear = !1), e.clear(), e.setTransparentSort(jm));
      try {
        (this.runtime.local.track.skydome &&
          yo(e, () => e.render(this.runtime.local.track.skydome, this.camera)),
          e.clearDepth(),
          yo(e, () => e.render(this.scene, this.camera)));
      } finally {
        e.setTransparentSort(null);
      }
      if (this.resultVisible) return;
      (e.clearDepth(),
        !this.warpHudHidden &&
          this.runtime.local.lifecycle.state < X2.PostFinish &&
          (this.hud.render(e), JL(this.tachometer, e)));
      const r = Math.floor(this.size.y * Rv + 0.5),
        s =
          this.size.y > 0
            ? Math.floor(
                r * this.runtime.local.warpNext.blackBarRatio(t) + 0.5,
              ) / this.size.y
            : 0;
      (this.warpBlackBar.renderRatio(e, s),
        this.finishBlackBar.render(e, t, this.size.y),
        this.action2d.render(e, t, H2, $2));
    } finally {
      e.autoClear = i;
    }
  }
  dispose() {
    if ((this.releaseShadowPresentations(), !this.disposed)) {
      ((this.disposed = !0),
        this.clearGiant(),
        this.flyingPet?.dispose(),
        (this.flyingPet = void 0),
        this.trackEventEffects?.dispose(),
        (this.trackEventEffects = void 0),
        this.trackEventAudio?.dispose(),
        (this.trackEventAudio = void 0),
        this.trackDummyAudio?.dispose(),
        (this.trackDummyAudio = void 0),
        this.audioStarted && this.bgm?.silence());
      for (const e of this.assets.participants) {
        for (const t of lc(e.vehicle)) t.removeFromParent();
        (e.characters.ordinary?.scene.object.removeFromParent(),
          e.characters.linked?.scene.object.removeFromParent());
        for (const t of e.vehicle.accessories)
          t.render.scene.object.removeFromParent();
        e.vehicle.decoration?.scene.object.removeFromParent();
      }
      for (const e of this.views.values()) e.releaseBorrowedModel();
      (this.views.clear(),
        this.linkedPresentations.clear(),
        this.hud.dispose(),
        this.initialPoses.clear(),
        this.rankRoster.dispose(),
        this.roadblockFlag?.dispose(),
        (this.roadblockFlag = void 0),
        this.roadblockHud?.dispose(),
        this.roadblockResult?.dispose(),
        this.award?.dispose(),
        this.resultView?.dispose(),
        this.banner?.dispose(),
        this.trackInfoCard?.dispose(),
        this.countdown?.dispose(),
        this.finishBlackBar.dispose(),
        this.warpBlackBar.dispose(),
        this.action2d.dispose(),
        this.scene.clear());
    }
  }
  releaseShadowPresentations() {
    if (this.assets.drivingMode?.kind === "shadow") {
      for (const e of this.shadowPresentations.values()) e.dispose();
      this.shadowPresentations.clear();
    }
  }
}
class aP {
  enter() {}
  update(e) {}
  render() {}
  onPacket(e) {}
  exit() {}
}
const Xr0 = { KeyZ: [l2.ModeImpulsePositive], KeyX: [l2.ModeImpulseNegative] };
class Yr0 extends aP {
  constructor(e, t, i, r, s) {
    (super(),
      (this.runtime = e),
      (this.scene = t),
      (this.host = i),
      (this.chat = r),
      (this.notice = s));
  }
  runtime;
  scene;
  host;
  chat;
  notice;
  controls = new sG();
  active = !1;
  disposed = !1;
  leaving = !1;
  resultVisible = !1;
  roomPhase;
  now = 0;
  get diagnosticsView() {
    return this.scene;
  }
  get touchDrivingAvailable() {
    return (
      this.active &&
      !this.disposed &&
      !this.resultVisible &&
      !this.notice?.visible
    );
  }
  get touchDodgeEnabled() {
    return (
      !this.disposed && this.runtime.local.physics.speedRaceMode?.kind === "lte"
    );
  }
  bindClock(e) {
    this.runtime.bindClock(e);
  }
  updateRoom(e) {
    ((this.roomPhase = e.phase),
      this.scene.updateRoom(e),
      this.runtime.updateRoom(e),
      this.chat?.updateRoom(e));
  }
  presentingResults() {
    return this.resultVisible
      ? !this.scene.resultComplete
      : this.runtime.resultSnapshot() !== void 0;
  }
  showWaiting() {
    if (this.disposed) throw new Error("多人比赛已释放。");
    this.active ||
      ((this.now = performance.now()),
      this.scene.update(this.host.renderer, this.now, []),
      this.scene.render(this.host.renderer, this.now),
      this.host.publish(this),
      (this.active = !0),
      this.chat?.show(),
      this.chat?.setAllowed(!0),
      this.scene.startAudio(),
      this.host.input.cancelAll(),
      this.host.input.setEnabled(!0),
      this.host.autoForward.cancel(),
      this.host.renderer.domElement.focus(),
      this.host.status("本机加载完成，等待其他玩家和统一起跑通知。"));
  }
  scheduleStart(e) {
    if (this.disposed) throw new Error("多人比赛已释放。");
    (this.runtime.scheduleStart(e),
      this.showWaiting(),
      this.host.status(
        this.runtime.local.physics.speedRaceMode?.kind === "lte"
          ? "LTE Web试玩：Z左躲闪、X右躲闪；自动补氮气及香蕉事件尚未接齐。"
          : "沿用设置中的驾驶按键，等待统一起跑。",
      ));
  }
  update(e) {
    if (!(!this.active || this.disposed)) {
      this.now = performance.now();
      try {
        const t = this.runtime.local.physics,
          i = this.host.input.drain(
            t.speedRaceMode?.kind === "lte" ? Xr0 : void 0,
          );
        i.cancelled &&
          (this.controls.cancel(),
          this.host.autoForward.cancel(),
          t.hardCancelControls(),
          this.runtime.local.cancelModeDrivingInput());
        const r = this.runtime.local.lifecycle;
        (this.host.autoForward.setRaceState(
          !this.resultVisible && r.state < X2.PostFinish,
          r.state === X2.Racing &&
            !this.runtime.local.isStartBoosterWindow(this.now),
        ),
          this.resultVisible &&
            this.scene.awardInput(i.transitions, i.cancelled),
          this.controls.dispatch(
            this.resultVisible || this.notice?.visible ? [] : i.transitions,
            (c, l) => {
              this.notice?.visible ||
                this.host.autoForward.dispatch(
                  c,
                  l,
                  this.controls.snapshot(),
                  (u) => {
                    if (u.kind === "reset") {
                      (this.runtime.local.requestReset(),
                        this.runtime.local.consumeRoadBlockResetNotice() &&
                          (this.notice?.showRoadBlockReset(this.now),
                          this.notice?.visible &&
                            (this.controls.cancel(),
                            this.host.autoForward.cancel(),
                            t.hardCancelControls(),
                            this.host.input.cancelAll())));
                      return;
                    }
                    const h = this.runtime.local.lifecycle.state;
                    if (
                      h === X2.Result ||
                      (h !== X2.Racing &&
                        (u.kind === "instant-acceleration" ||
                          u.kind === "reorder-items"))
                    )
                      return;
                    const d = this.host.autoForward.apply(
                      this.controls.snapshot(),
                    );
                    (u.kind === "unsupported-action" &&
                      this.runtime.local.handleModeDrivingCommand(
                        u,
                        this.now,
                      )) ||
                      (t.handleDrivingCommand(u, d),
                      (u.kind === "forward-down" || u.kind === "forward-up") &&
                        (this.runtime.local.isStartBoosterWindow(this.now) &&
                          t.startRaceBooster(),
                        u.kind === "forward-down" && t.startPlayBooster(d)));
                  },
                );
            },
          ),
          this.notice?.visible &&
            (this.controls.cancel(), this.host.autoForward.cancel()));
        const s = this.controls.snapshot(),
          o = !this.resultVisible && r.state !== X2.Result,
          a = this.runtime.update(this.now, this.host.autoForward.apply(s), !1);
        (o && this.host.clientFramerate.sample(this.now),
          this.host.touchControls.setAutoForwardActive(
            this.host.autoForward.isActive(s),
          ),
          this.disposed ||
            (t.consumeSpeedSlotReordered() && this.host.playSlotChanger(),
            this.chat?.setAllowed(
              r.state === X2.Ready ||
                (r.state === X2.Countdown && r.countdownStep < 4) ||
                r.state >= X2.PostFinish,
            ),
            this.runtime.local.boostGaugeFull &&
              this.scene.startBoostGaugeFull(),
            this.scene.update(this.host.renderer, this.now, a),
            this.resultVisible &&
              this.scene.resultComplete &&
              this.requestLeave(),
            !this.resultVisible &&
              a.some((c) => c.kind === "publish-result") &&
              (this.notice?.hide(),
              (this.resultVisible = !0),
              this.controls.cancel(),
              this.host.autoForward.cancel(),
              t.hardCancelControls(),
              this.host.input.cancelAll(),
              this.host.status("成绩展示结束后自动返回原房间。"))));
      } catch (t) {
        this.fail(t);
      }
    }
  }
  render() {
    if (!(!this.active || this.disposed))
      try {
        this.scene.render(this.host.renderer, this.now);
      } catch (e) {
        this.fail(e);
      }
  }
  requestLeave() {
    if (this.leaving || this.disposed) return;
    if (
      ((this.leaving = !0),
      this.resultVisible &&
        this.roomPhase === "open" &&
        this.host.closePresentation)
    ) {
      this.host.closePresentation();
      return;
    }
    (this.resultVisible && this.host.returnToRoom
      ? () => this.host.returnToRoom()
      : () => this.host.leave())().catch((t) => {
      ((this.leaving = !1), this.host.status(`退出失败：${String(t)}`, !0));
    });
  }
  fail(e) {
    this.disposed ||
      (this.host.status(
        `多人比赛已停止：${e instanceof Error ? e.message : String(e)}`,
        !0,
      ),
      (this.resultVisible = !1),
      this.requestLeave(),
      this.dispose());
  }
  exit() {
    this.dispose();
  }
  dispose() {
    this.disposed ||
      ((this.disposed = !0),
      this.active &&
        (this.host.input.setEnabled(!1), this.host.input.cancelAll()),
      this.controls.cancel(),
      this.host.autoForward.setRaceState(!1, !1),
      this.host.touchControls.setAutoForwardActive(!1),
      this.chat?.dispose(),
      this.notice?.dispose(),
      this.scene.dispose(),
      this.runtime.dispose(),
      this.active && this.host.release(this),
      (this.active = !1));
  }
}
function fc(n) {
  return n
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"');
}
function Zr0(n) {
  const e = [];
  for (const t of n.matchAll(
    /<Emotion\s+animationIndex='(\d+)'\s+soundName='([^']+)'[^>]*>([\s\S]*?)<\/Emotion>/g,
  )) {
    const i = Number(t[1]);
    if (![1, 2, 3, 4, 5, 6, 7, 20].includes(i)) continue;
    const r = [
        ...t[3].matchAll(
          /<Word\s+text='([^']+)'\s+hidden='(true|false)'\s*\/>/g,
        ),
      ],
      s = r.find((o) => o[2] === "true")?.[1];
    s &&
      e.push({
        index: i,
        marker: fc(s),
        label: fc(s).replace(/[()（）]/g, ""),
        soundName: fc(t[2]),
        words: r.map((o) => ({ text: fc(o[1]), hidden: o[2] === "true" })),
      });
  }
  return e;
}
async function cP(n) {
  const e = n.get("etc_/emotionPatterns@cn.xml");
  if (!e) throw new Error("P3553 房间表情资源缺失");
  const t = new Map(Zr0(await e.text()).map((r) => [r.index, r])),
    i = [1, 2, 3, 4, 5, 6, 7, 20].map((r) => t.get(r));
  if (i.some((r) => !r)) throw new Error("P3553 房间表情映射不完整");
  return i;
}
function Ng(n, e) {
  for (const t of e) {
    const i = t.words.find((s) => n.includes(s.text));
    if (!i) continue;
    return {
      text: (i.hidden ? n.replace(i.text, "") : n).trim(),
      action: t.index,
    };
  }
  return { text: n, action: 21 };
}
const Qr0 = 5e3,
  kE = "KartSim Multiplayer Race Chat";
function LE(n) {
  return `${n.name} : ${n.text}`;
}
function PE(n) {
  return n.key === "Enter" || n.code === "Enter";
}
function Jr0(n) {
  return n.phase === "loading" && n.race
    ? `已加载 ${n.race.loadedIds.length}/${n.members.length} 人，等待统一起跑`
    : void 0;
}
class Dv {
  constructor(e, t, i, r, s, o) {
    if (
      ((this.connection = t),
      (this.status = i),
      (this.frame = r),
      (this.font = s),
      (this.emotions = o),
      !t.sendRaceChat || !t.subscribeRaceChat)
    )
      throw new Error("本局连接缺少聊天通道。");
    ((this.element.className = "multiplayer-race-chat"),
      (this.element.dataset.uiLayer = "dialog"),
      this.element.setAttribute("aria-label", "比赛聊天"),
      (this.element.hidden = !0),
      (this.log.className = "multiplayer-race-chat-log"),
      this.log.setAttribute("aria-live", "polite"),
      (this.canvas.className = "multiplayer-race-chat-canvas"),
      (this.canvas.width = 520),
      (this.canvas.height = 156),
      (this.input.className = "multiplayer-race-chat-input"),
      (this.input.type = "text"),
      (this.input.maxLength = 20),
      (this.input.hidden = !0),
      this.input.addEventListener("keydown", this.onInputKeyDown),
      this.element.append(this.canvas, this.log, this.input),
      e.append(this.element),
      window.addEventListener("keydown", this.onWindowKeyDown, !0),
      (this.off = t.subscribeRaceChat((a) => this.append(a))),
      this.renderMessages());
  }
  connection;
  status;
  frame;
  font;
  emotions;
  element = document.createElement("section");
  log = document.createElement("div");
  canvas = document.createElement("canvas");
  input = document.createElement("input");
  off;
  allowed = !1;
  shown = !1;
  sending = !1;
  disposed = !1;
  messages = new Map();
  hideTimer;
  roomChannel = !1;
  loadingLine;
  static async load(e, t, i, r) {
    const [s, o, a] = await Promise.all([
        U1(e, ["stage_/common"], "ingame_chat_Bg").bytes().then(p2),
        cP(e),
        U1(e, ["gui_/font"], "SourceHanSansCN-Medium", ".otf").bytes(),
      ]),
      c = await f5(kE, a);
    try {
      const l = document.createElement("canvas");
      return (
        (l.width = s.width),
        (l.height = s.height),
        l
          .getContext("2d")
          .putImageData(
            new ImageData(new Uint8ClampedArray(s.pixels), s.width, s.height),
            0,
            0,
          ),
        new Dv(t, i, r, l, c, o)
      );
    } catch (l) {
      throw (G1(c), l);
    }
  }
  show() {
    this.disposed || ((this.shown = !0), (this.element.hidden = !1));
  }
  updateRoom(e) {
    if (this.disposed || e.roomId !== this.connection.roomId) return;
    const t = Jr0(e);
    t !== this.loadingLine && ((this.loadingLine = t), this.renderMessages());
    const i = e.phase === "open";
    if (
      (i !== this.roomChannel &&
        ((this.roomChannel = i), this.renderMessages()),
      i)
    ) {
      for (const r of e.chat ?? []) this.append(r);
      return;
    }
    if (e.race?.raceId === this.connection.raceId)
      for (const r of e.race.chat ?? []) this.append(r);
  }
  setAllowed(e) {
    this.disposed ||
      this.allowed === e ||
      ((this.allowed = e), e || this.close());
  }
  append(e) {
    if (this.disposed || this.messages.has(e.sequence)) return;
    this.messages.set(e.sequence, {
      message: e,
      until: performance.now() + Qr0,
    });
    const t = [...this.messages.keys()].sort((i, r) => i - r);
    for (; t.length > 32;) this.messages.delete(t.shift());
    this.renderMessages();
  }
  renderMessages() {
    this.hideTimer !== void 0 &&
      (window.clearTimeout(this.hideTimer), (this.hideTimer = void 0));
    const e = performance.now(),
      t = [...this.messages.values()]
        .filter((s) => s.until > e)
        .sort((s, o) => s.message.sequence - o.message.sequence)
        .slice(-8),
      i = this.canvas.getContext("2d");
    (i.clearRect(0, 0, this.canvas.width, this.canvas.height),
      this.input.hidden ||
        i.drawImage(this.frame, 0, 0, this.canvas.width, this.canvas.height),
      (i.font = `16px '${kE}'`),
      (i.textBaseline = "top"),
      (i.strokeStyle = "#000"),
      (i.lineWidth = 2),
      (i.lineJoin = "round"),
      this.loadingLine &&
        ((i.fillStyle = "#00e9ff"),
        i.strokeText(this.loadingLine, 12, 10, this.canvas.width - 24),
        i.fillText(this.loadingLine, 12, 10, this.canvas.width - 24)));
    const r = t
      .map(({ message: s }) => ({
        message: s,
        text: Ng(s.text, this.emotions).text,
      }))
      .filter((s) => s.text)
      .slice(-(this.loadingLine ? 4 : 5));
    (r.forEach(({ message: s, text: o }, a) => {
      i.fillStyle =
        s.playerId === this.connection.playerId ? "#a3ff2a" : "#fff";
      const c = LE({ ...s, text: o }),
        l = this.canvas.height - 56 - (r.length - 1 - a) * 19;
      (i.strokeText(c, 12, l, this.canvas.width - 24),
        i.fillText(c, 12, l, this.canvas.width - 24));
    }),
      (this.log.textContent = [
        this.loadingLine,
        ...r.map(({ message: s, text: o }) => LE({ ...s, text: o })),
      ].filter(Boolean).join(`
`)),
      (this.log.scrollTop = this.log.scrollHeight),
      t.length &&
        (this.hideTimer = window.setTimeout(
          () => this.renderMessages(),
          Math.max(1, Math.ceil(Math.min(...t.map((s) => s.until)) - e)),
        )));
  }
  open() {
    !this.shown ||
      !this.allowed ||
      this.disposed ||
      ((this.input.hidden = !1), this.renderMessages(), this.input.focus());
  }
  close() {
    this.input.hidden ||
      ((this.input.hidden = !0), this.input.blur(), this.renderMessages());
  }
  onWindowKeyDown = (e) => {
    if (
      !this.shown ||
      !this.allowed ||
      this.disposed ||
      !PE(e) ||
      e.repeat ||
      e.isComposing ||
      e.keyCode === 229 ||
      !this.input.hidden
    )
      return;
    const t = e.target;
    (t instanceof HTMLElement &&
      (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) ||
      (e.preventDefault(), e.stopImmediatePropagation(), this.open());
  };
  onInputKeyDown = (e) => {
    if (e.code === "Escape") {
      (e.preventDefault(), e.stopImmediatePropagation(), this.close());
      return;
    }
    if (!PE(e) || e.repeat || e.isComposing || e.keyCode === 229) return;
    (e.preventDefault(), e.stopImmediatePropagation());
    const t = this.input.value.trim();
    if (!t) {
      this.close();
      return;
    }
    this.sending ||
      !this.allowed ||
      ((this.sending = !0),
      (this.input.value = ""),
      this.close(),
      this.connection
        .sendRaceChat(t)
        .then(() => {
          this.disposed;
        })
        .catch((i) => {
          if (this.disposed) return;
          const r = i instanceof Error ? i.message : String(i);
          (r === "RACE_CHAT_CLOSED" && this.setAllowed(!1),
            this.status(
              r === "CHAT_RATE_LIMIT"
                ? "发送过快，请稍后重试。"
                : r === "RACE_CHAT_CLOSED"
                  ? "当前阶段不能发送文字消息。"
                  : `比赛聊天发送失败：${r}`,
              !0,
            ));
        })
        .finally(() => {
          this.sending = !1;
        }));
  };
  dispose() {
    this.disposed ||
      ((this.disposed = !0),
      this.hideTimer !== void 0 && window.clearTimeout(this.hideTimer),
      this.off(),
      window.removeEventListener("keydown", this.onWindowKeyDown, !0),
      this.input.removeEventListener("keydown", this.onInputKeyDown),
      G1(this.font),
      this.element.remove());
  }
}
const es0 = "zeta_/cn/content/config.xml",
  ts0 = "inGameDispTrackInfo",
  ns0 = "gui_/windowTemplate/trackInfoCard.bml",
  is0 = "gui_/windowTemplate/trackcard.png",
  rs0 = "gui_/windowTemplate/trackInfoLabel.png",
  ss0 = "gui_/windowTemplate/trackDifficulty.bml",
  os0 = "gui_/windowTemplate/난이도text@cn.png",
  as0 = "gui_/windowTemplate/난이도원.png",
  cs0 = "stage_/common/큰리버스트랙.png",
  pc = { width: 350, height: 205 },
  ls0 = "gui_/font/SourceHanSansCN-Bold.otf",
  qd = "etc_/bgmList.xml",
  Kd = "etc_/baseStringBag.xml",
  us0 = "speedS",
  hs0 = 16,
  Og = "P3553 Source Han Sans CN TrackInfoCard",
  FE = "_rvs";
function ds0(n) {
  return `track_/${n.toLowerCase().endsWith(FE) ? n.slice(0, -FE.length) : n}/xt_trackCard.png`;
}
function fs0(n, e) {
  return /_rvs$/i.test(e) ? `[反]${n}` : n;
}
function ps0(n, e) {
  return e ?? n;
}
const jd = 1600,
  Xd = 900,
  gs0 = `16px "${Og}"`;
function ms0(n, e, t = "") {
  return e !== ""
    ? { gameSpeed: e, gameInfo: n, teamName: t }
    : { gameSpeed: n, gameInfo: "", teamName: t };
}
function ws0(n, e) {
  const t = e.get(n.modeKey) ?? "",
    i = n.modeSuffixKey === void 0 ? void 0 : (e.get(n.modeSuffixKey) ?? ""),
    r = i === void 0 ? t : `${t} / ${i}`,
    s = e.get(`${us0}${Math.trunc(n.speed)}`) ?? "",
    o = n.team === 1 ? "redTeam" : n.team === 2 ? "blueTeam" : void 0;
  return ms0(r, s, o ? (e.get(o) ?? "") : "");
}
function vs0(n, e, t) {
  const i = Math.fround(Math.min(4, t >>> 0)),
    r = Math.fround(Math.fround(n) - Math.fround(Math.fround(3) * i));
  return { adjustX: r, complete: -e > r };
}
class M7 {
  constructor(e, t, i, r, s, o) {
    ((this.root = e),
      (this.trackTitle = t),
      (this.trackDifficulty = i),
      (this.bgmTitles = r),
      (this.gameLabels = s),
      (this.assets = o),
      (this.adjustX = o.layout.adjustX));
    const a = this.canvas.getContext("2d", { alpha: !0 });
    if (!a) throw new Error("浏览器无法创建 trackInfoCard Canvas。");
    ((this.context = a),
      Object.assign(this.canvas.style, {
        position: "absolute",
        inset: "0",
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }),
      (this.canvas.dataset.uiLayer = "hud"),
      this.canvas.setAttribute("aria-hidden", "true"),
      e.append(this.canvas),
      (this.resizeObserver = new ResizeObserver(() => this.render())),
      this.resizeObserver.observe(e),
      window.addEventListener("resize", this.onWindowResize),
      this.render());
  }
  root;
  trackTitle;
  trackDifficulty;
  bgmTitles;
  gameLabels;
  assets;
  canvas = document.createElement("canvas");
  context;
  resizeObserver;
  onWindowResize = () => this.render();
  bgmName = "";
  visible = !0;
  slidingOut = !1;
  adjustX;
  lastUpdateMs;
  disposed = !1;
  static async load(e) {
    const { library: t } = e;
    if (!(await xs0(t))) return;
    const i = t.get(ds0(e.trackDirectory));
    if (!i) return;
    const r = t.exactCanonicalCandidates(qd);
    if (r.length === 0) return;
    if (r.length !== 1)
      throw new Error(`${qd} source 数量必须为 1，实际 ${r.length}。`);
    const s = DE(await r[0].text(), qd),
      o = t.exactCanonicalCandidates(Kd);
    if (o.length !== 1)
      throw new Error(`${Kd} source 数量必须为 1，实际 ${o.length}。`);
    const a = ws0(e.game, DE(await o[0].text(), Kd)),
      c = s2(await Gn(t, ns0).bytes()),
      l = Ss0(c),
      u = { ...l, stripIndex: ps0(l.stripIndex, e.game.team) },
      h = /_rvs$/i.test(e.trackId),
      [d, f, p, v, w, g, y, b] = await Promise.all([
        yi(Gn(t, is0)),
        yi(Gn(t, rs0)),
        yi(i),
        h ? yi(Gn(t, cs0)) : Promise.resolve(void 0),
        Gn(t, ss0).bytes().then(s2),
        yi(Gn(t, os0)),
        yi(Gn(t, as0)),
        Gn(t, ls0).bytes(),
      ]);
    if (d.width !== u.width || d.height !== u.cardHeight)
      throw new Error(
        `trackcard.png 应为 ${u.width}x${u.cardHeight}，实际 ${d.width}x${d.height}。`,
      );
    if (f.width !== u.width || f.height !== u.stripHeight * u.stripCount)
      throw new Error(
        `trackInfoLabel.png 应为 ${u.width}x${u.stripHeight * u.stripCount}，实际 ${f.width}x${f.height}。`,
      );
    if (v && (v.width !== p.width || v.height !== p.height))
      throw new Error("反向标记与赛道预览图尺寸不一致。");
    const A = { layout: bs0(w, u.trackRect, g, y), text: g, glyphs: y };
    if (
      e.difficulty !== void 0 &&
      (!Number.isInteger(e.difficulty) || e.difficulty < 0)
    )
      throw new Error(`赛道难度无效：${e.difficulty}。`);
    const x = await f5(Og, b);
    try {
      return new M7(e.root, fs0(e.trackTitle, e.trackId), e.difficulty, s, a, {
        layout: u,
        frame: d,
        label: f,
        track: p,
        reverseStamp: v,
        difficulty: A,
        font: x,
      });
    } catch (M) {
      throw (G1(x), M);
    }
  }
  setBgmName(e) {
    if (this.disposed) return;
    const t = this.bgmTitles.get(e) ?? "";
    this.bgmName !== t && ((this.bgmName = t), this.render());
  }
  setVisible(e) {
    this.disposed ||
      this.visible === e ||
      ((this.visible = e),
      (this.slidingOut = !1),
      e && (this.adjustX = this.assets.layout.adjustX),
      (this.canvas.hidden = !e),
      e && this.render());
  }
  slideOut() {
    this.disposed || !this.visible || (this.slidingOut = !0);
  }
  update(e) {
    if (this.disposed) return;
    const t = this.lastUpdateMs;
    if (
      ((this.lastUpdateMs = e),
      !this.visible || !this.slidingOut || t === void 0)
    )
      return;
    const i = (Math.trunc(e) - Math.trunc(t)) >>> 0,
      r = vs0(this.adjustX, this.assets.layout.width, i);
    ((this.adjustX = r.adjustX),
      r.complete ? this.setVisible(!1) : this.render());
  }
  dispose() {
    this.disposed ||
      ((this.disposed = !0),
      this.resizeObserver.disconnect(),
      window.removeEventListener("resize", this.onWindowResize),
      this.canvas.remove(),
      G1(this.assets.font));
  }
  render() {
    if (this.disposed || !this.visible) return;
    const e = this.root.clientWidth,
      t = this.root.clientHeight;
    if (e <= 0 || t <= 0) return;
    p3(this.canvas, this.context, e, t, xe(), jd, Xd);
    const {
        layout: i,
        frame: r,
        label: s,
        track: o,
        reverseStamp: a,
        difficulty: c,
      } = this.assets,
      l = this.context;
    l.clearRect(0, 0, jd, Xd);
    const u = jd - this.adjustX - i.width,
      h = Xd - i.adjustY - i.height;
    l.drawImage(
      s.image,
      0,
      i.stripIndex * i.stripHeight,
      i.width,
      i.stripHeight,
      u,
      h,
      i.width,
      i.stripHeight,
    );
    const d = h + i.cardTop;
    (l.drawImage(r.image, u, d),
      ys0(l, o, i.trackRect, u + i.trackRect.x, d + i.trackRect.y),
      a && As0(l, a, u, d, i.width, i.cardHeight),
      Ms0(l, this.trackDifficulty, c, u + i.trackRect.x, d + i.trackRect.y),
      this.drawLabel(this.gameLabels.gameSpeed, i.gameSpeed, u, h),
      this.drawLabel(this.gameLabels.gameInfo, i.gameInfo, u, h),
      this.drawLabel(this.gameLabels.teamName, i.teamName, u, h),
      (l.font = gs0),
      (l.textBaseline = "middle"),
      (l.textAlign = "left"),
      this.drawClippedText(this.bgmName, i.bgmRect, u, h, i.bgmColor),
      this.drawClippedText(
        this.trackTitle,
        i.trackNameRect,
        u,
        d,
        i.trackNameColor,
      ));
  }
  drawLabel(e, t, i, r) {
    e &&
      m9(
        this.context,
        e,
        {
          x: i + t.rect.x,
          y: r + t.rect.y,
          width: t.rect.width,
          height: t.rect.height,
        },
        {
          kind: "label",
          family: Og,
          size: hs0,
          color: t.color,
          align: t.align,
          verticalAlign: t.verticalAlign,
        },
      );
  }
  drawClippedText(e, t, i, r, s) {
    if (!e) return;
    const o = this.context;
    (o.save(),
      o.beginPath(),
      o.rect(i + t.x, r + t.y, t.width, t.height),
      o.clip(),
      (o.fillStyle = s),
      o.fillText(e, i + t.x, r + t.y + t.height / 2),
      o.restore());
  }
}
function ys0(n, e, t, i, r) {
  n.drawImage(e.image, 0, 0, e.width, e.height, i, r, t.width, t.height);
}
function As0(n, e, t, i, r, s) {
  n.drawImage(
    e.image,
    t + Math.floor((r - pc.width) / 2),
    i + Math.floor((s - pc.height) / 2),
    pc.width,
    pc.height,
  );
}
function bs0(n, e, t, i) {
  if (n.name !== "Window")
    throw new Error("trackDifficulty 模板根节点应为 Window。");
  (le(n, "leftTopWH", 4, "trackDifficulty"),
    le(n, "adjust", 2, "trackDifficulty"),
    Ys(n, "trackDifficulty", ["left", "top"]));
  const r = Z3(n, "text"),
    s = Z3(n, "chars");
  if (r.name !== "Panel" || y4(r, "texture", "text") !== "난이도text@zz")
    throw new Error("trackDifficulty 的文字贴图配置无效。");
  if (
    (le(r, "leftTopTex", 2, "text"),
    s.name !== "CharPanel" || y4(s, "texture", "chars") !== "난이도원")
  )
    throw new Error("trackDifficulty 的六格图集配置无效。");
  Ys(s, "chars", ["right", "vcenter"]);
  const [o, a] = le(s, "fontSize", 2, "chars"),
    c = y4(s, "fontStr", "chars"),
    l = o + le(s, "spaceOffset", 1, "chars")[0];
  if (
    o <= 0 ||
    a <= 0 ||
    l <= 0 ||
    c.length !== 2 ||
    !c.includes("0") ||
    !c.includes("1") ||
    i.width !== o * c.length ||
    i.height !== a
  )
    throw new Error("trackDifficulty 的 0/1 图集尺寸或字距无效。");
  const u = V0(n, { x: 0, y: 0, width: e.width, height: e.height }),
    h = V0(r, u, void 0, t),
    d = V0(s, u);
  if (
    h.width !== t.width ||
    h.height !== t.height ||
    d.width < o + 5 * l ||
    d.height !== a
  )
    throw new Error("trackDifficulty 的文字或六格窗口尺寸与贴图不符。");
  return {
    labelRect: h,
    glyphRect: d,
    glyphWidth: o,
    glyphHeight: a,
    advance: l,
    emptySourceX: c.indexOf("0") * o,
    filledSourceX: c.indexOf("1") * o,
  };
}
function Ms0(n, e, t, i, r) {
  if (e === void 0) return;
  const { layout: s, text: o, glyphs: a } = t;
  n.drawImage(
    o.image,
    i + s.labelRect.x,
    r + s.labelRect.y,
    s.labelRect.width,
    s.labelRect.height,
  );
  for (let c = 0; c < 6; c += 1)
    n.drawImage(
      a.image,
      c < e ? s.filledSourceX : s.emptySourceX,
      0,
      s.glyphWidth,
      s.glyphHeight,
      i + s.glyphRect.x + c * s.advance,
      r + s.glyphRect.y,
      s.glyphWidth,
      s.glyphHeight,
    );
}
function DE(n, e) {
  const t = new DOMParser().parseFromString(n, "application/xml");
  if (t.querySelector("parsererror")) throw new Error(`${e} 不是有效 XML。`);
  const i = new Map();
  return (
    Array.from(t.documentElement.children).forEach((r) => {
      const s = r.getAttribute("n"),
        a = Array.from(r.children)
          .find((c) => c.getAttribute("c") === "cn")
          ?.getAttribute("v");
      s !== null && a !== null && a !== void 0 && i.set(s, a);
    }),
    i
  );
}
async function xs0(n) {
  const e = n.exactCanonicalCandidates(es0);
  if (e.length === 0) return !1;
  if (e.length !== 1)
    throw new Error(
      `content/config.xml source 数量必须为 1，实际 ${e.length}。`,
    );
  const i = x1(await e[0].bytes()).root.children.find(
    (r) => r.name === "content" && j0(r, "name") === ts0,
  );
  return i !== void 0 && j0(i, "enable") === "true";
}
function Gn(n, e) {
  const t = n.canonicalCandidates(e);
  if (t.length !== 1)
    throw new Error(`${e} 候选数量必须为 1，实际 ${t.length}。`);
  return t[0];
}
async function yi(n) {
  const e = await p2(await n.bytes()),
    t = document.createElement("canvas");
  ((t.width = e.width), (t.height = e.height));
  const i = t.getContext("2d");
  if (!i) throw new Error(`浏览器无法创建 ${n.virtualPath} 的 Canvas。`);
  const r = new Uint8ClampedArray(e.pixels.length);
  return (
    r.set(e.pixels),
    i.putImageData(new ImageData(r, e.width, e.height), 0, 0),
    { image: t, width: e.width, height: e.height }
  );
}
function Ss0(n) {
  const e = Z3(n, "trackInfoCard");
  Ys(e, "trackInfoCard", ["right", "bottom"]);
  const [t, i] = le(e, "windowSize", 2, "trackInfoCard"),
    [r, s] = le(e, "adjust", 2, "trackInfoCard"),
    o = Z3(n, "game");
  Ys(o, "game", ["top"]);
  const [a, c] = le(o, "fontSize", 2, "game");
  if (a !== t) throw new Error(`game fontSize 宽度应为 ${t}，实际 ${a}。`);
  const l = y4(o, "fontStr", "game"),
    u = y4(o, "text", "game"),
    h = l.indexOf(u);
  if (u.length !== 1 || h < 0)
    throw new Error(`game 默认样式条 ${u} 不在 fontStr ${l} 内。`);
  const d = { x: 0, y: 0, width: t, height: c },
    f = Yd(o, "gameSpeed", d),
    p = Yd(o, "gameInfo", d),
    v = Yd(o, "teamName", d),
    w = Z3(n, "trackCardCont");
  Ys(w, "trackCardCont", ["bottom"]);
  const [g, y] = le(w, "windowSize", 2, "trackCardCont");
  if (g !== t) throw new Error(`trackCardCont 宽度应为 ${t}，实际 ${g}。`);
  const b = Z3(n, "trackCard"),
    A = VE(le(b, "trackRect", 4, "trackCard")),
    x = VE(le(b, "trackNameRect", 4, "trackCard")),
    M = zg(le(b, "trackNameTextColor", 4, "trackCard")),
    E = Z3(n, "bgmInfo"),
    [_, C] = le(E, "windowSize", 2, "bgmInfo"),
    [S, G] = le(E, "adjust", 2, "bgmInfo"),
    I = zg(le(E, "textColor", 4, "bgmInfo"));
  return {
    width: t,
    height: i,
    adjustX: r,
    adjustY: s,
    stripHeight: c,
    stripCount: l.length,
    stripIndex: h,
    gameSpeed: f,
    gameInfo: p,
    teamName: v,
    cardTop: i - y,
    cardHeight: y,
    trackRect: A,
    trackNameRect: x,
    trackNameColor: M,
    bgmRect: { x: S, y: G, width: _, height: C },
    bgmColor: I,
  };
}
function Yd(n, e, t) {
  const i = n.children.find((c) => c.name === "Label" && T(c, "name") === e);
  if (!i) throw new Error(`trackInfoCard 模板 game 缺少 Label ${e}。`);
  const r = new Set(
      (T(i, "textAlign") ?? T(i, "align") ?? "left")
        .toLowerCase()
        .split(/[\s,;|]+/)
        .filter(Boolean),
    ),
    s = T(i, "textColor") ?? "white",
    o = s.trim().split(/\s+/).map(Number),
    a = o.length === 4 && o.every(Number.isFinite) ? zg(o) : s;
  return {
    rect: V0(i, t),
    align: r.has("right")
      ? "right"
      : r.has("center") || r.has("hcenter")
        ? "center"
        : "left",
    verticalAlign: r.has("bottom")
      ? "bottom"
      : r.has("vcenter") || r.has("center")
        ? "center"
        : "top",
    color: a,
  };
}
function Z3(n, e) {
  const t = [],
    i = (r) => {
      T(r, "name") === e && t.push(r);
      for (const s of r.children) i(s);
    };
  if ((i(n), t.length !== 1))
    throw new Error(
      `trackInfoCard 模板应有 1 个 ${e} 节点，实际 ${t.length}。`,
    );
  return t[0];
}
function y4(n, e, t) {
  const i = T(n, e);
  if (i === void 0) throw new Error(`${t} 缺少 ${e}。`);
  return i;
}
function le(n, e, t, i) {
  const r = y4(n, e, i).trim().split(/\s+/);
  if (r.length !== t)
    throw new Error(`${i} 的 ${e} 应有 ${t} 个数值，实际 ${r.length}。`);
  return r.map((s) => {
    const o = Number.parseInt(s, 10);
    if (!Number.isFinite(o)) throw new Error(`${i} 的 ${e} 含非数值 ${s}。`);
    return o;
  });
}
function Ys(n, e, t) {
  const i = y4(n, "align", e).toLowerCase();
  for (const r of t)
    if (!i.includes(r))
      throw new Error(`${e} 的 align 应包含 ${r}，实际 ${i}。`);
}
function VE(n) {
  const [e, t, i, r] = n;
  if (i <= e || r <= t) throw new Error(`矩形 ${n.join(" ")} 边序非法。`);
  return { x: e, y: t, width: i - e, height: r - t };
}
function zg(n) {
  const [e, t, i, r] = n;
  return `rgba(${t}, ${i}, ${r}, ${e / 255})`;
}
const lP = 3;
function Cs0(n, e, t) {
  if (!n?.active || n.abilities.length !== lP) return;
  const r = n.abilities
    .map((o) => {
      const a = f20(o),
        c = a && o20(a.group);
      return a && c ? { textKey: c.key, level: a.level } : void 0;
    })
    .filter((o) => o !== void 0);
  if (r.length === 0) return;
  const s = { attributes: r, mode: e, speed: t };
  return (Vv(s), s);
}
function uP(n, e, t, i) {
  if (e === 9) {
    const r = n?.progression;
    if (!r || r.kind !== "xun") return;
    const s = r.skills
      .filter((a) => Number.isInteger(a.points) && a.points > 0)
      .map((a) => {
        const c = xI(a.id);
        return c
          ? {
              textKey: c.key,
              label: c.xunLabel,
              level: a.points,
              levelStyle: "xun",
            }
          : void 0;
      })
      .filter((a) => a !== void 0);
    if (s.length === 0) return;
    const o = { attributes: s, mode: t, speed: i };
    return (Vv(o), o);
  }
  if (e !== void 0 && e >= 0 && e <= 8) return Cs0(n?.factory, t, i);
}
function Vv(n) {
  if (
    !n ||
    !Array.isArray(n.attributes) ||
    n.attributes.length < 1 ||
    n.attributes.length > lP
  )
    throw new Error("属性横幅必须包含一至三项。 ");
  n.attributes.forEach((e) => {
    if (
      !e ||
      typeof e.textKey != "string" ||
      !e.textKey.trim() ||
      !Number.isInteger(e.level) ||
      e.level < 1 ||
      e.level > 5
    )
      throw new Error("粒子改属性横幅的属性键或等级无效。 ");
  });
}
const NE = 240,
  OE = 40,
  Es0 = 0,
  Ts0 = 445,
  _s0 = 38,
  tr = 3,
  Gs0 = 1024,
  Bs0 = 768,
  hP = 1600,
  dP = 900,
  Rs0 = -6,
  gc = "gui_/windowTemplate/ingame_tuningTextBg.png",
  zE = "gui_windowTemplate.rho",
  Is0 = 6e3,
  mc = 3e3,
  Zd = 1,
  ks0 = -1,
  Ls0 = 5,
  Ps0 = 1;
function fP(n, e) {
  const t = (n - Gs0) / 2,
    i = (e - Bs0) / 2;
  return [2, 1, 0].map((r) => {
    const s = Es0 + t + 20 * r,
      o = Ts0 + i - _s0 * r;
    return { x: s, y: o, targetX: s };
  });
}
class Fs0 {
  sessionStartAtMs = Number.NaN;
  finished = !1;
  rows = new Map();
  isFinishedFor(e) {
    return this.finished && this.sessionStartAtMs === e;
  }
  update(e, t, i, r, s) {
    if (!i || t === 0) return (this.reset(), this.hiddenFrame());
    if (
      (this.sessionStartAtMs !== t &&
        (this.rows.clear(), (this.sessionStartAtMs = t), (this.finished = !1)),
      this.finished)
    )
      return this.hiddenFrame();
    const o = t - Is0,
      a = e - o;
    if (a < 0) return this.hiddenFrame();
    const c = new Set(s.filter((d) => Number.isInteger(d) && d >= 0 && d < tr));
    for (const d of this.rows.keys()) c.has(d) || this.rows.delete(d);
    for (const d of c) {
      const f = r[d];
      if (!f) continue;
      const p = this.rows.get(d);
      p
        ? (p.targetX = f.targetX)
        : this.rows.set(d, { x: 0, targetX: f.targetX, active: !0 });
    }
    for (const d of this.rows.values())
      if (d.active)
        if (a < mc) {
          const f = d.targetX - d.x;
          f * Zd > 0 &&
            ((d.x += Zd * (d.targetX / 1e3) * a),
            Math.abs(f) < Ls0 && (d.x = d.targetX));
        } else
          ((d.x += ks0 * (d.targetX / 1e3) * (a - mc)),
            d.x <= Ps0 && (d.active = !1));
    const l = Array(tr).fill(void 0);
    let u = !1,
      h = !1;
    for (const [d, f] of this.rows)
      f.active &&
        ((l[d] = f.x),
        (u = !0),
        a < mc && (f.targetX - f.x) * Zd > 0 && (h = !0));
    return u
      ? a >= mc
        ? { state: "exiting", rowXPositions: l }
        : { state: h ? "entering" : "holding", rowXPositions: l }
      : (this.rows.size > 0 && (this.finished = !0),
        { state: "hidden", rowXPositions: l });
  }
  reset() {
    ((this.sessionStartAtMs = Number.NaN),
      (this.finished = !1),
      this.rows.clear());
  }
  hiddenFrame() {
    return { state: "hidden", rowXPositions: Array(tr).fill(void 0) };
  }
}
const Ds0 = {
    normalBoosterTime: "加速时间",
    gaugeCharge: "集气速度",
    startBoosterTime: "启动加速时间",
  },
  Vs0 = ["", "一级", "二级", "三级", "四级", "五级"];
function Ns0(n) {
  const e = Ds0[n];
  return e !== void 0 ? e : (Er.find((t) => t.key === n)?.factoryLabel ?? n);
}
function Os0(n, e) {
  return e === "xun" ? `+${n}` : (Vs0[n] ?? `${n}级`);
}
function zs0(n) {
  return `${n.label ?? Ns0(n.textKey)} ${Os0(n.level, n.levelStyle)}`;
}
function Us0(n, e, t, i = {}) {
  Vv(t);
  const r = i.viewportWidth ?? hP,
    s = i.viewportHeight ?? dP,
    o = fP(r, s),
    a = tr - t.attributes.length;
  t.attributes.forEach((c, l) => {
    const u = a + l,
      h = o[u],
      d = Math.round(i.rowXPositions?.[u] ?? h.x),
      f = h.y;
    (n.save(),
      n.drawImage(e.image, d, f, NE, OE),
      m9(
        n,
        zs0(c),
        { x: d, y: f + Rs0, width: NE, height: OE },
        {
          kind: "label",
          family: "P3528 Source Han Sans CN Ready",
          size: 16,
          color: "rgba(255, 255, 255, 1)",
          align: "center",
          verticalAlign: "center",
          stroke: 1,
          strokeColor: "rgba(0, 101, 225, 1)",
        },
      ),
      n.restore());
  });
}
const wc = new WeakMap();
function $s0(n) {
  const e = wc.get(n);
  if (e) return e;
  const t = Ws0(n);
  return (
    wc.set(n, t),
    t.catch(() => {
      wc.get(n) === t && wc.delete(n);
    }),
    t
  );
}
async function Ws0(n) {
  const e = zE.toLowerCase(),
    t = gc.slice(gc.lastIndexOf("/") + 1).toLowerCase(),
    i = n
      .canonicalCandidates(gc)
      .filter(
        (h) => h.sourceKind === "rho" && h.sourceName.toLowerCase() === e,
      ),
    r = n.files.filter((h) => {
      const d = (h.canonicalPath ?? h.virtualPath).replaceAll("\\", "/");
      return (
        h.sourceKind === "rho" &&
        h.sourceName.toLowerCase() === e &&
        d.slice(d.lastIndexOf("/") + 1).toLowerCase() === t
      );
    }),
    s = [
      ...new Map(
        [...i, ...r].map((h) => [
          `${h.sourceName.toLowerCase()}:${h.virtualPath.toLowerCase()}`,
          h,
        ]),
      ).values(),
    ];
  if (s.length > 1) throw new Error(`${gc} 在 ${zE} 内不唯一。`);
  const o = s[0];
  if (!o) return;
  const a = await p2(await o.bytes()),
    c = document.createElement("canvas");
  ((c.width = a.width), (c.height = a.height));
  const l = c.getContext("2d");
  if (!l) throw new Error("无法创建粒子改属性横幅纹理 Canvas。 ");
  const u = new Uint8ClampedArray(a.pixels.length);
  return (
    u.set(a.pixels),
    l.putImageData(new ImageData(u, a.width, a.height), 0, 0),
    { width: a.width, height: a.height, image: c }
  );
}
class x7 {
  constructor(e) {
    this.options = e;
    const t = this.canvas.getContext("2d", { alpha: !0 });
    if (!t) throw new Error("无法创建粒子改属性横幅 Canvas。 ");
    ((this.context = t),
      Object.assign(this.canvas.style, {
        position: "absolute",
        inset: "0",
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: "1",
        display: "none",
      }),
      (this.canvas.dataset.uiLayer = "stage"),
      (this.canvas.dataset.particleBanner = "created"),
      (this.canvas.hidden = !0),
      this.canvas.setAttribute("aria-hidden", "true"),
      e.root.append(this.canvas));
  }
  options;
  canvas = document.createElement("canvas");
  context;
  motion = new Fs0();
  disposed = !1;
  static async load(e, t) {
    const i = await $s0(e);
    return i ? new x7({ root: t, texture: i }) : void 0;
  }
  isAttached() {
    return this.canvas.isConnected;
  }
  update(e, t, i, r) {
    if (this.disposed || this.motion.isFinishedFor(t)) return;
    const s = r !== void 0 && r.attributes.length > 0,
      o = s ? tr - r.attributes.length : tr,
      a = s ? r.attributes.map((f, p) => o + p) : [],
      c = hP,
      l = dP,
      u = fP(c, l),
      h = this.motion.update(e, t, i, u, a);
    if (
      ((this.canvas.dataset.particleBannerRequest = s ? "ready" : "empty"),
      (this.canvas.dataset.particleBannerStartAtMs = String(t)),
      (this.canvas.dataset.particleBannerCountdown = String(i)),
      (this.canvas.dataset.particleBannerState = h.state),
      !s || h.state === "hidden")
    ) {
      this.hideCanvas();
      return;
    }
    ((this.canvas.hidden = !1),
      (this.canvas.style.display = "block"),
      this.canvas.setAttribute("aria-hidden", "false"));
    const d = this.options.root.getBoundingClientRect();
    (p3(
      this.canvas,
      this.context,
      d.width,
      d.height,
      xe(),
      1600,
      900,
      1600,
      900,
    ),
      this.context.clearRect(0, 0, 1600, 900),
      Us0(this.context, this.options.texture, r, {
        viewportWidth: c,
        viewportHeight: l,
        rowXPositions: h.rowXPositions,
      }));
  }
  dispose() {
    this.disposed ||
      ((this.disposed = !0), this.motion.reset(), this.canvas.remove());
  }
  hideCanvas() {
    (this.canvas.hidden || this.context.clearRect(0, 0, 1600, 900),
      (this.canvas.hidden = !0),
      (this.canvas.style.display = "none"),
      this.canvas.setAttribute("aria-hidden", "true"));
  }
}
function Hs0(n) {
  return {
    async prepare(e, t, i, r) {
      const s = n.assets(),
        o = n.audio(),
        a = s.getLibrary();
      if (!r?.leaveRace || !o || !a)
        throw new Error("多人驾驶缺少资源、音频或本局连接。");
      const c = () => {
        if (i.aborted) throw new Error("本局装配已取消。");
      };
      c();
      const l = await A40(
        { ...s, toonStageBinding: new ha() },
        e,
        t,
        o,
        {
          playerId: r.playerId,
          profile: n.profile(),
          anonymous: n.raceAnonymous?.() ?? !1,
          classicHud: n.classicHud?.() ?? !1,
        },
        i,
      );
      let u, h, d, f, p, v, w, g, y, b, A, x;
      try {
        const M = await hI(a, !0);
        (c(),
          (w = new Ui0(
            l,
            t,
            r,
            () => performance.now(),
            (D) => {
              if (y) y.fail(D);
              else throw D;
            },
            n.clientFramerate,
          )),
          (v = await Dw.load(a, l, r.playerId)),
          c(),
          (p = await Q6.load(a, o, !0)),
          c());
        const E = n.bgm();
        if (!E) throw Error("比赛缺少 BGM owner。");
        (await E.selectRace(a, l.map.metadata),
          c(),
          t.roadblock || ((u = await tw.load(a, l)), c(), u.bind(r, l)));
        const _ = n.renderer.domElement.parentElement;
        if (!_) throw new Error("缺少结果界面容器。");
        const C = l.map.path.replaceAll("\\", "/").split("/").at(-2);
        if (!C) throw new Error("赛道信息卡缺少赛道目录。");
        const S =
          e.mode === "team"
            ? t.roster.find((D) => D.playerId === r.playerId)?.team
            : void 0;
        if (e.mode === "team" && S !== 1 && S !== 2)
          throw new Error("组队赛卡片缺少本机红蓝队身份。");
        ((x = await M7.load({
          library: a,
          root: _,
          trackId: t.trackId,
          trackDirectory: C,
          trackTitle: l.map.metadata.cnTitle ?? "",
          difficulty: l.map.metadata.difficulty,
          game: {
            modeKey: e.mode === "team" ? "SpeedTeam" : "SpeedIndi",
            speed: e.speed,
            team: S === 1 || S === 2 ? S : void 0,
          },
        })),
          c(),
          x?.setVisible(!1),
          n.raceTimeGap?.() && !t.roadblock && (await v.loadTimeGap(a, _), c()),
          t.roadblock
            ? ((d = await Bo.loadHud(a, _, t, r.playerId)),
              c(),
              (h = await Bo.loadResult(a, _, t)),
              c(),
              (f = await Gw.load(a, _)),
              c())
            : ((h = await Tw.load(a, _, t, r.playerId, e.mode === "team")),
              c()));
        const G = l.participants.find((D) => D.playerId === r.playerId);
        if (!G) throw new Error("本局缺少本机车辆横幅身份。");
        const I = G.profile.equipment,
          L = p5(G.profile.garage, I.itemIds[3], I.kartSerial),
          k = uP(
            L,
            G.vehicle.kartItem.engineGrade,
            e.mode === "team" ? "team" : "personal",
            e.speed,
          );
        if (k) {
          try {
            A = await x7.load(a, _);
          } catch {
            A = void 0;
          }
          c();
        }
        return (
          (g = new jr0(
            l,
            w,
            t,
            r.playerId,
            M,
            v,
            s.targetRandom,
            p,
            u,
            h,
            E,
            A,
            k,
            () => n.flyingPetVisible?.() ?? !1,
            x,
            d,
          )),
          await g.prepareRoadBlockFlag(a),
          c(),
          await g.prepareGiant(a, o),
          c(),
          await g.prepareRoadBlockResult(a),
          c(),
          await g.prepareFlyingPet(a, o),
          c(),
          await g.prepareTrackEvents(a, o),
          c(),
          g.warm(n.renderer, performance.now()),
          c(),
          (b = await Dv.load(a, _, r, n.status)),
          c(),
          (y = new Yr0(
            w,
            g,
            {
              ...n,
              leave: () => r.leaveRace(),
              returnToRoom: () =>
                r.returnToRoom
                  ? r.returnToRoom()
                  : Promise.reject(new Error("本局连接不支持返回房间。")),
              closePresentation: () => r.presentationClosed?.(),
            },
            b,
            f,
          )),
          y
        );
      } catch (M) {
        throw (
          b?.dispose(),
          f?.dispose(),
          g?.dispose(),
          g ||
            (d?.dispose(),
            x?.dispose(),
            A?.dispose(),
            p?.dispose(),
            u?.dispose(),
            h?.dispose()),
          v?.dispose(),
          w ? w.dispose() : l.dispose(),
          M
        );
      }
    },
  };
}
const UE = [
  "webglcontextlost",
  "webglcontextrestored",
  "contextlost",
  "contextrestored",
];
class qs0 {
  constructor(e, t, i, r) {
    ((this.root = e),
      (this.gameCanvas = t),
      (this.phase = i),
      (this.report = r));
    for (const s of UE) e.addEventListener(s, this.onContext, !0);
  }
  root;
  gameCanvas;
  phase;
  report;
  onContext = (e) => {
    const t = e.target;
    if (!(t instanceof HTMLCanvasElement)) return;
    const i = e.type.endsWith("lost"),
      r = e.type.startsWith("webgl") ? "WebGL" : "Canvas2D",
      s = t.closest("[data-ui-layer]")?.dataset.uiLayer ?? "unknown",
      o = t === this.gameCanvas ? "主游戏画布" : `界面画布(${s})`,
      a =
        "statusMessage" in e && typeof e.statusMessage == "string"
          ? e.statusMessage
          : "",
      c = `[画布诊断] ${o} ${r} ${i ? "已丢失" : "已恢复"}；${t.width}×${t.height}；阶段=${this.phase()}${a ? `；${a}` : ""}`;
    this.report(c, i);
  };
  dispose() {
    for (const e of UE) this.root.removeEventListener(e, this.onContext, !0);
  }
}
async function Ks0(n, e, t) {
  const i = new Worker(
    new URL("/assets/ArchiveIndexDecodeWorker-CfvjruiE.js", import.meta.url),
    { type: "module" },
  );
  try {
    return await new Promise((r, s) => {
      ((i.onmessage = ({ data: o }) => {
        o &&
        o.ok === !0 &&
        o.indexes &&
        Array.isArray(o.indexes.rho) &&
        Array.isArray(o.indexes.rho5)
          ? r(o.indexes)
          : o && o.ok === !1 && typeof o.error == "string"
            ? s(new Error(o.error))
            : s(new Error("档案索引 Worker 返回无效消息。"));
      }),
        (i.onerror = (o) =>
          s(new Error(o.message || "档案索引 Worker 执行失败。"))),
        (i.onmessageerror = () =>
          s(new Error("档案索引 Worker 消息无法解码。"))),
        i.postMessage({ compressed: n, version: e, revision: t }, [n]));
    });
  } finally {
    i.terminate();
  }
}
const js0 = 1,
  m6 = "snapshots",
  Xs0 = "current",
  Ys0 = 2;
async function Zs0(n, e) {
  const t = await Js0(n, e);
  try {
    const i = t.transaction(m6, "readonly"),
      [r] = await Promise.all([eo0(i.objectStore(m6).get(Xs0)), to0(i)]);
    if (
      !r ||
      r.schemaVersion !== Ys0 ||
      r.version !== n ||
      r.revision !== e ||
      !Array.isArray(r.rho) ||
      !Array.isArray(r.rho5) ||
      typeof r.checksum != "string"
    )
      return;
    try {
      if (r.checksum !== (await Qs0(n, e, r))) return;
    } catch {
      return;
    }
    return { rho: r.rho, rho5: r.rho5 };
  } finally {
    t.close();
  }
}
async function Qs0(n, e, t) {
  const i = JSON.stringify(
      { version: n, revision: e, rho: t.rho, rho5: t.rho5 },
      (o, a) => (a instanceof Uint8Array ? { $u8: Array.from(a) } : a),
    ),
    r = new TextEncoder().encode(i),
    s = new Uint8Array(await crypto.subtle.digest("SHA-256", r));
  return Array.from(s, (o) => o.toString(16).padStart(2, "0")).join("");
}
function Js0(n, e) {
  return new Promise((t, i) => {
    const r = indexedDB.open(In0(n, e), js0);
    ((r.onupgradeneeded = () => {
      r.result.objectStoreNames.contains(m6) ||
        r.result.createObjectStore(m6, { keyPath: "key" });
    }),
      (r.onsuccess = () => t(r.result)),
      (r.onerror = () =>
        i(
          r.error ?? new Error(`${n.toUpperCase()} 档案索引数据库打开失败。`),
        )));
  });
}
function eo0(n) {
  return new Promise((e, t) => {
    ((n.onsuccess = () => e(n.result)),
      (n.onerror = () => t(n.error ?? new Error("P3528 档案索引读取失败。"))));
  });
}
function to0(n) {
  return new Promise((e, t) => {
    ((n.oncomplete = () => e()),
      (n.onerror = () => t(n.error ?? new Error("P3528 档案索引事务失败。"))),
      (n.onabort = () =>
        t(n.error ?? new Error("P3528 档案索引事务已中止。"))));
  });
}
const no0 = "kartsim-local-rho-directory",
  zo = "selection",
  pP = "data-directory";
function io0() {
  return typeof window.showDirectoryPicker == "function";
}
async function ro0() {
  try {
    const n = await ao0();
    return n && (await n.queryPermission({ mode: "read" })) === "granted"
      ? n
      : void 0;
  } catch {
    return;
  }
}
async function so0() {
  const n = window.showDirectoryPicker;
  if (!n) throw new Error("当前浏览器不支持选择本地资源目录。");
  const e = await n.call(window, { mode: "read" });
  try {
    await e.getFileHandle("aaa.pk");
  } catch {
    throw new Error("请选择卡丁车客户端的 Data 文件夹（其中应有 aaa.pk）。");
  }
  return (await co0(e).catch(() => {}), e);
}
async function oo0(n, e) {
  let t;
  try {
    t = await (await n.getFileHandle(e.name)).getFile();
  } catch (o) {
    if (
      o instanceof DOMException &&
      (o.name === "NotFoundError" || o.name === "NotAllowedError")
    )
      return;
    throw o;
  }
  if (t.size !== e.size) return;
  const i = WR.create(),
    r = t.stream().getReader();
  try {
    for (;;) {
      const { done: o, value: a } = await r.read();
      if (o) break;
      i.update(a);
    }
  } finally {
    r.releaseLock();
  }
  return Array.from(i.digest(), (o) => o.toString(16).padStart(2, "0")).join(
    "",
  ) === e.sha256
    ? t
    : void 0;
}
function gP() {
  return new Promise((n, e) => {
    const t = indexedDB.open(no0, 1);
    ((t.onupgradeneeded = () => t.result.createObjectStore(zo)),
      (t.onsuccess = () => n(t.result)),
      (t.onerror = () => e(t.error)));
  });
}
async function ao0() {
  const n = await gP();
  try {
    return await new Promise((e, t) => {
      const i = n.transaction(zo, "readonly").objectStore(zo).get(pP);
      ((i.onsuccess = () => e(i.result)), (i.onerror = () => t(i.error)));
    });
  } finally {
    n.close();
  }
}
async function co0(n) {
  const e = await gP();
  try {
    await new Promise((t, i) => {
      const r = e.transaction(zo, "readwrite");
      (r.objectStore(zo).put(n, pP),
        (r.oncomplete = () => t()),
        (r.onerror = () => i(r.error)),
        (r.onabort = () => i(r.error)));
    });
  } finally {
    e.close();
  }
}
function lo0(n) {
  const e = n === "p3528" ? "https://kart-assets.iii.moe/p3528" : `/${n}`;
  return {
    manifest: `/__${n}/resources`,
    archiveIndex: `/__${n}/archive-index`,
    data: e,
  };
}
async function uo0(n, e, t) {
  return ho0(n, e, t);
}
async function ho0(n, e, t) {
  const i = lo0(n),
    r = await wo0(i.manifest);
  if (r.version !== n)
    throw new Error(
      `请求 ${n.toUpperCase()}，但资源清单返回 ${r.version.toUpperCase()}。`,
    );
  const [s, o] = await Promise.all([do0(r, i.archiveIndex), mo0()]),
    a = await yo0(o, r.version, r.revision),
    c = new fo0(o, a, r.files, i.data, e, t);
  return {
    version: r.version,
    sources: r.files.map((l) => c.source(l)),
    archiveIndexes: s,
    preloadContainers: (l) => c.preload(l),
  };
}
async function do0(n, e) {
  try {
    const t = await Zs0(n.version, n.revision);
    if (t) return t;
  } catch {}
  return vo0(n.version, n.revision, e);
}
class fo0 {
  constructor(e, t, i, r, s, o) {
    ((this.storage = e),
      (this.directory = t),
      (this.dataUrl = r),
      (this.onProgress = s),
      (this.localDirectory = o),
      (this.expectedByName = new Map(i.map((a) => [a.name.toLowerCase(), a]))));
  }
  storage;
  directory;
  dataUrl;
  onProgress;
  localDirectory;
  expectedByName;
  loaded = new Map();
  source(e) {
    return {
      name: e.name,
      size: e.size,
      arrayBuffer: () => this.readBuffer(e),
      slice: (t = 0, i = e.size) => ({
        arrayBuffer: () => this.readBuffer(e, t, i),
      }),
    };
  }
  async readBuffer(e, t, i) {
    const r = await this.ensure(e);
    try {
      return await (t === void 0 ? r : r.slice(t, i)).arrayBuffer();
    } catch (s) {
      if (!(s instanceof DOMException) || s.name !== "NotReadableError")
        throw s;
      this.loaded.delete(e.name.toLowerCase());
      const o = await this.ensure(e);
      return (t === void 0 ? o : o.slice(t, i)).arrayBuffer();
    }
  }
  async preload(e) {
    const t = this.resolveNames(e);
    (t.forEach((i) => this.reportProgress("checking", i, 0)),
      await po0(t, 3, async (i) => {
        await this.ensure(i);
      }));
  }
  resolveNames(e) {
    const t = new Map();
    for (const i of e) {
      const r = this.expectedByName.get(i.toLowerCase());
      if (!r) throw new Error(`资源清单内找不到容器 ${i}。`);
      t.set(r.name.toLowerCase(), r);
    }
    return [...t.values()];
  }
  async ensure(e) {
    const t = e.name.toLowerCase();
    let i = this.loaded.get(t);
    i ||
      (this.reportProgress("checking", e, 0),
      (i = this.load(e)),
      this.loaded.set(t, i));
    try {
      const r = await i;
      return (this.reportProgress("ready", e, e.size), r);
    } catch (r) {
      throw (this.loaded.delete(t), r);
    }
  }
  async load(e) {
    const t = await $E(this.directory, e.name);
    if (t?.size === e.size) return t;
    if (this.localDirectory)
      try {
        const r = await oo0(this.localDirectory, e);
        if (r) return r;
      } catch {}
    (await Ao0(this.storage, e.size),
      await bo0(this.directory, e, this.dataUrl, (r) => {
        this.reportProgress("downloading", e, r);
      }));
    const i = await $E(this.directory, e.name);
    if (!i || i.size !== e.size) throw new Error(`${e.name} OPFS 长度不匹配。`);
    return i;
  }
  reportProgress(e, t, i) {
    this.onProgress?.({
      phase: e,
      file: t.name,
      loadedBytes: i,
      totalBytes: t.size,
    });
  }
}
async function po0(n, e, t) {
  let i = 0;
  const r = async () => {
    for (; i < n.length;) {
      const s = i++;
      await t(n[s]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(Math.max(1, e), n.length) }, r),
  );
}
function go0() {
  if (
    typeof navigator > "u" ||
    typeof navigator.storage?.getDirectory != "function"
  )
    throw new Error("当前浏览器不支持 OPFS，无法保存游戏资源容器。");
  return navigator.storage;
}
async function mo0() {
  const n = go0();
  if (typeof n.persist == "function")
    try {
      await n.persist();
    } catch {}
  return n;
}
async function wo0(n) {
  const e = await fetch(n, { cache: "no-store" });
  if (e.status !== 200) throw new Error(`资源清单读取失败：HTTP ${e.status}。`);
  return Co0(await e.json());
}
async function vo0(n, e, t) {
  const i = await fetch(t, { cache: "no-store" });
  if (i.status !== 200) throw new Error(`档案索引读取失败：HTTP ${i.status}。`);
  return Ks0(await i.arrayBuffer(), n, e);
}
async function yo0(n, e, t) {
  return (await n.getDirectory()).getDirectoryHandle(Uk(e, t), { create: !0 });
}
async function Ao0(n, e) {
  if (typeof n.estimate != "function") return;
  const { quota: t, usage: i } = await n.estimate();
  if (typeof t != "number" || typeof i != "number")
    throw new Error("浏览器未提供存储配额，无法确认 P3528 容器可以写入 OPFS。");
  const r = Math.max(0, t - i);
  if (r < e) throw new Error(`OPFS 空间不足：需要 ${WE(e)}，可用 ${WE(r)}。`);
}
async function bo0(n, e, t, i) {
  const r = await n.getFileHandle(e.name, { create: !0 });
  if (typeof r.createWritable != "function") return Mo0(n.name, e, t, i);
  const s = await fetch(`${t}/${encodeURIComponent(e.name)}`, {
      cache: "no-store",
    }),
    o = xo0(s, e.name),
    a = await r.createWritable(),
    c = await So0(o, a, i);
  if (c !== e.size)
    throw new Error(
      `${e.name} 完整读取长度不匹配：manifest=${e.size}，response=${c}。`,
    );
}
async function Mo0(n, e, t, i) {
  const r = new Worker(
    new URL("/assets/OpfsDownloadWorker-D3FLEvg5.js", import.meta.url),
    { type: "module" },
  );
  try {
    await new Promise((s, o) => {
      ((r.onmessage = ({ data: a }) => {
        a.type === "progress"
          ? i(a.loadedBytes)
          : a.type === "done"
            ? s()
            : o(new Error(a.message));
      }),
        (r.onerror = (a) => o(new Error(a.message))),
        r.postMessage({
          version: n,
          name: e.name,
          size: e.size,
          url: `${t}/${encodeURIComponent(e.name)}`,
        }));
    });
  } finally {
    r.terminate();
  }
}
function xo0(n, e) {
  if (n.status !== 200)
    throw new Error(`${e} 完整读取失败：HTTP ${n.status}。`);
  if (!n.body) throw new Error(`${e} 完整读取未返回响应流。`);
  return n.body;
}
async function So0(n, e, t) {
  const i = n.getReader();
  let r = 0;
  try {
    for (;;) {
      const { done: s, value: o } = await i.read();
      if (s) break;
      (await e.write(o), (r += o.byteLength), t(r));
    }
    await e.close();
  } catch (s) {
    throw (await e.abort(), s);
  }
  return r;
}
async function $E(n, e) {
  try {
    return await (await n.getFileHandle(e)).getFile();
  } catch (t) {
    if (t instanceof DOMException && t.name === "NotFoundError") return;
    throw t;
  }
}
function Co0(n) {
  if (!mP(n)) throw new Error("资源清单格式无效。");
  if (n.version !== "p3528" && n.version !== "p3543" && n.version !== "p3553")
    throw new Error("资源清单版本无效。");
  if (typeof n.revision != "string" || !/^[a-f0-9]{64}$/i.test(n.revision))
    throw new Error("资源清单修订号无效。");
  return { version: n.version, revision: n.revision, files: Eo0(n.files) };
}
function Eo0(n) {
  if (!Array.isArray(n) || n.length === 0)
    throw new Error("资源清单 files 无效。");
  const e = n.map(To0);
  if (new Set(e.map((t) => t.name.toLowerCase())).size !== e.length)
    throw new Error("P3528 资源清单包含同名容器文件。");
  return e;
}
function To0(n) {
  if (!mP(n)) throw new Error("资源清单包含无效文件。");
  const e = Go0(n.name),
    t = Bo0(n.size, e),
    i = Ro0(n.mtimeMs, e),
    r = _o0(n.sha256, e);
  return { name: e, size: t, mtimeMs: i, sha256: r };
}
function _o0(n, e) {
  if (typeof n != "string" || !/^[a-f0-9]{64}$/i.test(n))
    throw new Error(`资源 ${e} 的 SHA-256 无效。`);
  return n.toLowerCase();
}
function Go0(n) {
  if (typeof n != "string") throw new Error("P3528 资源清单包含无效文件名。");
  if (!/^(?:aaa\.pk|[^/\\]+\.rho|DataPack\d+_\d{5}\.rho5)$/i.test(n))
    throw new Error("P3528 资源清单包含无效文件名。");
  return n;
}
function Bo0(n, e) {
  if (!Number.isSafeInteger(n) || n <= 0)
    throw new Error(`P3528 资源 ${e} 的 size 无效。`);
  return n;
}
function Ro0(n, e) {
  if (typeof n != "number" || !Number.isFinite(n) || n < 0)
    throw new Error(`P3528 资源 ${e} 的 mtimeMs 无效。`);
  return n;
}
function mP(n) {
  return typeof n == "object" && n !== null;
}
function WE(n) {
  return `${(n / 1024 / 1024).toFixed(2)} MiB`;
}
const Nv = 0.5,
  Ov = 2e3,
  Ug = Ov / Nv + 1,
  ml = [8.33, 16.67, 33.33, 50, 100, 250, 1e3],
  wP = 1024 * 1024,
  HE = 1e3,
  Io0 = 0.1;
class ko0 {
  frameHistogram = new Uint32Array(Ug);
  workHistogram = new Uint32Array(Ug);
  thresholdCounts = new Uint32Array(ml.length);
  longTaskObserver;
  longTaskSupported;
  raceStarted = !1;
  raceStartTimeMs = 0;
  raceEndTimeMs = 0;
  raceStartedAt = "";
  frameCount = 0;
  totalFrameMs = 0;
  totalWorkMs = 0;
  latestFrameMs = 0;
  latestWorkMs = 0;
  workWindowStartMs = 0;
  workWindowSumMs = 0;
  workWindowCount = 0;
  workWindowMeanMs = 0;
  workEmaMs = 0;
  workEmaInitialized = !1;
  maxFrameMs = 0;
  maxWorkMs = 0;
  maxStallMs = 0;
  panelPeakFrameMs = 0;
  panelPeakWorkMs = 0;
  pendingSkipFrames = 0;
  longTaskCount = 0;
  longTaskTotalMs = 0;
  longTaskMaxMs = 0;
  heapStartBytes = 0;
  heapCurrentBytes = 0;
  heapTotalBytes = 0;
  heapLimitBytes = 0;
  heapMinBytes = 0;
  heapMaxBytes = 0;
  heapLargestDropBytes = 0;
  heapWindowStartMs = 0;
  heapWindowActive = !1;
  heapWindowAllocBytes = 0;
  heapWindowGcDrops = 0;
  heapWindowFrameCount = 0;
  heapAllocMiBPerSec = 0;
  heapGcPerSec = 0;
  heapAllocKiBPerFrame = 0;
  heapGcDropTotal = 0;
  constructor() {
    ((this.longTaskSupported = Lo0()),
      this.longTaskSupported &&
        ((this.longTaskObserver = new PerformanceObserver((e) =>
          this.recordLongTasks(e),
        )),
        this.longTaskObserver.observe({ entryTypes: ["longtask"] })));
  }
  dispose() {
    this.longTaskObserver?.disconnect();
  }
  beginRace(e = performance.now()) {
    (this.frameHistogram.fill(0),
      this.workHistogram.fill(0),
      this.thresholdCounts.fill(0),
      (this.raceStarted = !0),
      (this.raceStartTimeMs = e),
      (this.raceEndTimeMs = 0),
      (this.raceStartedAt = new Date().toISOString()),
      (this.frameCount = 0),
      (this.totalFrameMs = 0),
      (this.totalWorkMs = 0),
      (this.latestFrameMs = 0),
      (this.latestWorkMs = 0),
      (this.maxFrameMs = 0),
      (this.maxWorkMs = 0),
      (this.maxStallMs = 0),
      (this.panelPeakFrameMs = 0),
      (this.panelPeakWorkMs = 0),
      (this.workWindowStartMs = 0),
      (this.workWindowSumMs = 0),
      (this.workWindowCount = 0),
      (this.workWindowMeanMs = 0),
      (this.workEmaMs = 0),
      (this.workEmaInitialized = !1),
      (this.pendingSkipFrames = 1),
      (this.longTaskCount = 0),
      (this.longTaskTotalMs = 0),
      (this.longTaskMaxMs = 0),
      this.resetHeapSamples(e));
  }
  finishRace(e = performance.now()) {
    !this.raceStarted ||
      this.raceEndTimeMs !== 0 ||
      ((this.raceEndTimeMs = e), this.sampleHeap(e));
  }
  recordFrame(e, t, i) {
    if (!this.containsTime(i)) return !1;
    if (this.pendingSkipFrames > 0) return ((this.pendingSkipFrames -= 1), !1);
    const r = Math.max(0, e),
      s = Math.max(0, t);
    return (
      (this.workEmaMs = this.workEmaInitialized
        ? this.workEmaMs + (s - this.workEmaMs) * Io0
        : s),
      (this.workEmaInitialized = !0),
      this.workWindowCount === 0 && (this.workWindowStartMs = i),
      (this.workWindowSumMs += s),
      (this.workWindowCount += 1),
      i - this.workWindowStartMs >= HE &&
        ((this.workWindowMeanMs = this.workWindowSumMs / this.workWindowCount),
        (this.workWindowSumMs = 0),
        (this.workWindowCount = 0),
        (this.workWindowStartMs = i)),
      (this.frameCount += 1),
      (this.totalFrameMs += r),
      (this.totalWorkMs += s),
      (this.latestFrameMs = r),
      (this.latestWorkMs = s),
      (this.maxFrameMs = Math.max(this.maxFrameMs, r)),
      (this.maxWorkMs = Math.max(this.maxWorkMs, s)),
      (this.maxStallMs = Math.max(this.maxStallMs, r - s)),
      (this.panelPeakFrameMs = Math.max(this.panelPeakFrameMs, r)),
      (this.panelPeakWorkMs = Math.max(this.panelPeakWorkMs, s)),
      (this.frameHistogram[KE(r)] += 1),
      (this.workHistogram[KE(s)] += 1),
      this.recordThresholds(r),
      (this.heapWindowFrameCount += 1),
      this.sampleHeap(i),
      !0
    );
  }
  skipNextFrame() {
    this.pendingSkipFrames = Math.max(this.pendingSkipFrames, 1);
  }
  isRaceActive() {
    return this.raceStarted && this.raceEndTimeMs === 0;
  }
  summary() {
    const e = jE(
        this.frameHistogram,
        this.frameCount,
        this.totalFrameMs,
        this.maxFrameMs,
      ),
      t = jE(
        this.workHistogram,
        this.frameCount,
        this.totalWorkMs,
        this.maxWorkMs,
      ),
      i =
        this.totalFrameMs > 0 ? (this.frameCount * 1e3) / this.totalFrameMs : 0;
    return {
      hasRace: this.raceStarted,
      active: this.raceStarted && this.raceEndTimeMs === 0,
      durationMs: this.totalFrameMs,
      frameCount: this.frameCount,
      averageFps: i,
      latestFrameMs: this.latestFrameMs,
      latestWorkMs: this.latestWorkMs,
      workWindowMeanMs: this.workWindowMeanMs,
      workEmaMs: this.workEmaMs,
      timerResolutionMs: No0(),
      crossOriginIsolated: globalThis.crossOriginIsolated === !0,
      panelPeakFrameMs: this.panelPeakFrameMs,
      panelPeakWorkMs: this.panelPeakWorkMs,
      maxStallMs: this.maxStallMs,
      frame: e,
      work: t,
      thresholdCounts: this.thresholdCounts.slice(),
      longTaskSupported: this.longTaskSupported,
      longTaskCount: this.longTaskCount,
      longTaskTotalMs: this.longTaskTotalMs,
      longTaskMaxMs: this.longTaskMaxMs,
      heapSupported: this.heapStartBytes > 0,
      heapStartBytes: this.heapStartBytes,
      heapCurrentBytes: this.heapCurrentBytes,
      heapTotalBytes: this.heapTotalBytes,
      heapLimitBytes: this.heapLimitBytes,
      heapMinBytes: this.heapMinBytes,
      heapMaxBytes: this.heapMaxBytes,
      heapLargestDropBytes: this.heapLargestDropBytes,
      heapAllocMiBPerSec: this.heapAllocMiBPerSec,
      heapAllocKiBPerFrame: this.heapAllocKiBPerFrame,
      heapGcPerSec: this.heapGcPerSec,
      heapGcDropTotal: this.heapGcDropTotal,
    };
  }
  clearPanelPeaks() {
    ((this.panelPeakFrameMs = 0), (this.panelPeakWorkMs = 0));
  }
  formatReport() {
    const e = this.summary(),
      t = navigator.deviceMemory;
    return [
      "KartRider Web Performance Report v1",
      `State: ${e.active ? "running" : e.hasRace ? "finished" : "not started"}`,
      `Started: ${this.raceStartedAt || "n/a"}`,
      `Captured: ${new Date().toISOString()}`,
      `URL: ${location.href}`,
      `User agent: ${navigator.userAgent}`,
      `Viewport: ${window.innerWidth}x${window.innerHeight} @ ${window.devicePixelRatio.toFixed(2)} DPR`,
      `CPU threads: ${navigator.hardwareConcurrency || "unknown"}`,
      `Device memory: ${t === void 0 ? "unavailable" : `${t} GiB (rounded)`}`,
      "",
      `Duration: ${Vo0(e.durationMs)}`,
      `Frames: ${e.frameCount}`,
      `Average FPS: ${e.averageFps.toFixed(2)}`,
      `Frame interval: avg ${i1(e.frame.averageMs)}, p50 ${i1(e.frame.p50Ms)}, p95 ${i1(e.frame.p95Ms)}, p99 ${i1(e.frame.p99Ms)}, max ${i1(e.frame.maxMs)}`,
      `Low FPS: 1% ${e.frame.low1Fps.toFixed(1)}, 0.1% ${e.frame.low01Fps.toFixed(1)}, min ${e.frame.minFps.toFixed(1)}`,
      `Main-thread work: avg ${i1(e.work.averageMs)}, p50 ${i1(e.work.p50Ms)}, p95 ${i1(e.work.p95Ms)}, p99 ${i1(e.work.p99Ms)}, max ${i1(e.work.maxMs)}, 1s window mean ${$g(e.workWindowMeanMs)}, EMA ${$g(e.workEmaMs)}`,
      `Worst stall (frame minus work): ${i1(e.maxStallMs)}`,
      `Allocation: ${e.heapAllocKiBPerFrame.toFixed(1)} KiB/frame, ${e.heapAllocMiBPerSec.toFixed(2)} MiB/s, GC drops ${e.heapGcPerSec.toFixed(2)} /s (window) / ${e.heapGcDropTotal} total`,
      "",
      "Frame interval counts:",
      ...Po0(e.thresholdCounts, e.frameCount),
      "",
      Fo0(e),
      Do0(e),
      "",
      "Notes:",
      "- Frame interval includes browser scheduling, background throttling, and work outside this callback.",
      "- Main-thread work measures this game's animation callback through render submission; it is not GPU time.",
      "- JS heap is Chromium-only and approximate; a large drop is evidence of reclamation, not proof of a GC pause.",
    ].join(`
`);
  }
  containsTime(e) {
    return !this.raceStarted || e < this.raceStartTimeMs
      ? !1
      : this.raceEndTimeMs === 0 || e <= this.raceEndTimeMs;
  }
  recordThresholds(e) {
    for (let t = 0; t < ml.length; t += 1)
      e > ml[t] && (this.thresholdCounts[t] += 1);
  }
  recordLongTasks(e) {
    for (const t of e.getEntries())
      this.containsTime(t.startTime) &&
        ((this.longTaskCount += 1),
        (this.longTaskTotalMs += t.duration),
        (this.longTaskMaxMs = Math.max(this.longTaskMaxMs, t.duration)));
  }
  resetHeapSamples(e) {
    ((this.heapStartBytes = 0),
      (this.heapCurrentBytes = 0),
      (this.heapTotalBytes = 0),
      (this.heapLimitBytes = 0),
      (this.heapMinBytes = 0),
      (this.heapMaxBytes = 0),
      (this.heapLargestDropBytes = 0),
      (this.heapWindowStartMs = 0),
      (this.heapWindowActive = !1),
      (this.heapWindowAllocBytes = 0),
      (this.heapWindowGcDrops = 0),
      (this.heapWindowFrameCount = 0),
      (this.heapAllocMiBPerSec = 0),
      (this.heapGcPerSec = 0),
      (this.heapAllocKiBPerFrame = 0),
      (this.heapGcDropTotal = 0),
      this.sampleHeap(e));
  }
  sampleHeap(e) {
    const t = performance.memory;
    if (!t) return;
    const i = t.usedJSHeapSize;
    if (
      ((this.heapTotalBytes = t.totalJSHeapSize),
      (this.heapLimitBytes = t.jsHeapSizeLimit),
      this.heapStartBytes === 0)
    )
      ((this.heapStartBytes = i),
        (this.heapMinBytes = i),
        (this.heapMaxBytes = i));
    else {
      const s = i - this.heapCurrentBytes;
      (s > 0
        ? (this.heapWindowAllocBytes += s)
        : s <= -1572864 &&
          ((this.heapWindowGcDrops += 1),
          (this.heapGcDropTotal += 1),
          (this.heapLargestDropBytes = Math.max(
            this.heapLargestDropBytes,
            -s,
          ))),
        (this.heapMinBytes = Math.min(this.heapMinBytes, i)),
        (this.heapMaxBytes = Math.max(this.heapMaxBytes, i)));
    }
    ((this.heapCurrentBytes = i),
      this.heapWindowActive ||
        ((this.heapWindowActive = !0), (this.heapWindowStartMs = e)));
    const r = e - this.heapWindowStartMs;
    r >= HE &&
      ((this.heapAllocMiBPerSec = qE(
        this.heapWindowAllocBytes / (r / 1e3) / wP,
      )),
      (this.heapGcPerSec = qE(this.heapWindowGcDrops / (r / 1e3))),
      (this.heapAllocKiBPerFrame =
        this.heapWindowFrameCount > 0
          ? Math.round(
              (this.heapWindowAllocBytes / this.heapWindowFrameCount / 1024) *
                10,
            ) / 10
          : 0),
      (this.heapWindowAllocBytes = 0),
      (this.heapWindowGcDrops = 0),
      (this.heapWindowFrameCount = 0),
      (this.heapWindowStartMs = e));
  }
}
function qE(n) {
  return Math.round(n * 100) / 100;
}
function Lo0() {
  return (
    typeof PerformanceObserver < "u" &&
    (PerformanceObserver.supportedEntryTypes?.includes("longtask") ?? !1)
  );
}
function KE(n) {
  return Math.min(Ug - 1, Math.floor(n / Nv));
}
function jE(n, e, t, i) {
  if (e === 0)
    return {
      averageMs: 0,
      p50Ms: 0,
      p95Ms: 0,
      p99Ms: 0,
      maxMs: 0,
      low1Ms: 0,
      low01Ms: 0,
      low1Fps: 0,
      low01Fps: 0,
      minFps: 0,
    };
  const r = Math.ceil(e * 0.5),
    s = Math.ceil(e * 0.95),
    o = Math.ceil(e * 0.99);
  let a = 0,
    c = 0,
    l = 0,
    u = 0;
  for (let f = 0; f < n.length; f += 1) {
    a += n[f];
    const p = vP(f);
    if ((c === 0 && a >= r && (c = p), l === 0 && a >= s && (l = p), a >= o)) {
      u = p;
      break;
    }
  }
  const h = XE(n, e, 0.01),
    d = XE(n, e, 0.001);
  return {
    averageMs: t / e,
    p50Ms: c,
    p95Ms: l,
    p99Ms: u,
    maxMs: i,
    low1Ms: h,
    low01Ms: d,
    low1Fps: h > 0 ? 1e3 / h : 0,
    low01Fps: d > 0 ? 1e3 / d : 0,
    minFps: i > 0 ? 1e3 / i : 0,
  };
}
function vP(n) {
  return Math.min(Ov, (n + 1) * Nv);
}
function XE(n, e, t) {
  if (e === 0) return 0;
  const i = Math.max(1, Math.ceil(e * t));
  let r = i,
    s = 0;
  for (let o = n.length - 1; o >= 0 && r > 0; o -= 1) {
    const a = n[o];
    if (a === 0) continue;
    const c = Math.min(a, r);
    ((s += c * vP(o)), (r -= c));
  }
  return s / i;
}
function Po0(n, e) {
  return ml.map((t, i) => {
    const r = n[i],
      s = e > 0 ? (r * 100) / e : 0;
    return `  > ${t.toFixed(2).padStart(7)} ms: ${String(r).padStart(8)} (${s.toFixed(3)}%)`;
  });
}
function Fo0(n) {
  return n.longTaskSupported
    ? `Long tasks (>50 ms): ${n.longTaskCount}, total ${i1(n.longTaskTotalMs)}, max ${i1(n.longTaskMaxMs)}`
    : "Long Tasks API: unavailable";
}
function Do0(n) {
  return n.heapSupported
    ? `JS heap: start ${De(n.heapStartBytes)}, current ${De(n.heapCurrentBytes)}, min ${De(n.heapMinBytes)}, max ${De(n.heapMaxBytes)}, committed ${De(n.heapTotalBytes)}, limit ${De(n.heapLimitBytes)}, largest sampled drop ${De(n.heapLargestDropBytes)}`
    : "JS heap: unavailable";
}
function Vo0(n) {
  const e = n / 1e3,
    t = Math.floor(e / 60),
    i = e - t * 60;
  return `${t}:${i.toFixed(2).padStart(5, "0")}`;
}
function i1(n) {
  return n >= Ov ? `${n.toFixed(1)} ms` : `${n.toFixed(2)} ms`;
}
function $g(n) {
  return Number.isFinite(n)
    ? n >= 100
      ? `${n.toFixed(1)} ms`
      : n >= 1
        ? `${n.toFixed(3)} ms`
        : `${(n * 1e3).toFixed(1)} µs`
    : "n/a";
}
let vc;
function No0() {
  if (vc !== void 0) return vc;
  let n = 1 / 0;
  for (let e = 0; e < 500; e += 1) {
    const t = performance.now(),
      i = performance.now();
    i > t && (n = Math.min(n, i - t));
  }
  return ((vc = Number.isFinite(n) ? n : 0), vc);
}
function De(n) {
  return `${(n / wP).toFixed(1)} MiB`;
}
const Uo = 39,
  yP = "launcher-room-v1",
  ke = (n) => !!n && typeof n == "object" && !Array.isArray(n),
  _2 = (n, e, t) =>
    typeof n == "string" &&
    [...n].length >= e &&
    [...n].length <= t &&
    !/[\u0000-\u001f\u007f]/u.test(n),
  P1 = (n, e, t) => Number.isSafeInteger(n) && Number(n) >= e && Number(n) <= t,
  AP = (n) => n === "p3528" || n === "p3543" || n === "p3553",
  Wg = (n) => typeof n == "string" && /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(n),
  w6 = (n) =>
    ke(n) &&
    P1(n.sequence, 1, Number.MAX_SAFE_INTEGER) &&
    _2(n.playerId, 1, 64) &&
    _2(n.name, 1, 18) &&
    _2(n.text, 1, 120) &&
    !!n.text.trim(),
  Oo0 = (n) =>
    typeof n == "string" &&
    n.length > 0 &&
    n.length <= 16384 &&
    /^v=0\r?\n/.test(n) &&
    /(?:^|\n)m=application /m.test(n) &&
    !/(?:^|\n)m=(?:audio|video) /m.test(n);
function bP(n) {
  if (
    !ke(n) ||
    !_2(n.roomId, 1, 64) ||
    !P1(n.revision, 1, Number.MAX_SAFE_INTEGER) ||
    !_2(n.name, 1, 18) ||
    (n.mode !== "individual" && n.mode !== "team") ||
    !P1(n.capacity, 2, 8) ||
    n.speedVersion !== "国服" ||
    !W6(n.channelName, n.mode, n.speed) ||
    !To(n.gameplay, n.channelName, n.resourceVersion) ||
    !AP(n.resourceVersion) ||
    !_2(n.hostId, 1, 64) ||
    !["open", "loading", "countdown", "racing", "finished"].includes(
      String(n.phase),
    ) ||
    !Array.isArray(n.members) ||
    n.members.length < 1 ||
    n.members.length > n.capacity ||
    (n.trackId !== void 0 && !Wg(n.trackId)) ||
    (n.randomTrackCode !== void 0 &&
      (typeof n.randomTrackCode != "number" ||
        !X6(n.randomTrackCode) ||
        n.resourceVersion !== "p3553" ||
        n.trackId !== void 0)) ||
    (n.trackId === void 0 && n.randomTrackCode === void 0) ||
    (n.autoStartAt !== void 0 &&
      (n.phase !== "open" ||
        !Number.isFinite(n.autoStartAt) ||
        Number(n.autoStartAt) < 0)) ||
    (n.closedSlots !== void 0 &&
      (!Array.isArray(n.closedSlots) ||
        n.closedSlots.length > 8 ||
        new Set(n.closedSlots).size !== n.closedSlots.length ||
        !n.closedSlots.every((o) => P1(o, 0, 7))))
  )
    return !1;
  if (n.kickVote !== void 0) {
    const o = n.kickVote;
    if (
      !ke(o) ||
      !_2(o.voteId, 1, 64) ||
      !_2(o.targetId, 1, 64) ||
      !Array.isArray(o.eligibleIds) ||
      !Array.isArray(o.yesIds) ||
      !Array.isArray(o.noIds) ||
      !Number.isFinite(o.deadline) ||
      Number(o.deadline) < 0
    )
      return !1;
    const a = new Set(o.eligibleIds);
    if (
      a.size !== o.eligibleIds.length ||
      o.eligibleIds.length > 7 ||
      !o.eligibleIds.every((c) => _2(c, 1, 64)) ||
      !o.yesIds.every((c) => a.has(c)) ||
      !o.noIds.every((c) => a.has(c)) ||
      new Set([...o.yesIds, ...o.noIds]).size !==
        o.yesIds.length + o.noIds.length
    )
      return !1;
  }
  if (
    (n.locked !== void 0 && typeof n.locked != "boolean") ||
    (n.chat !== void 0 &&
      (!Array.isArray(n.chat) || n.chat.length > 32 || !n.chat.every(w6)))
  )
    return !1;
  const e = new Set(),
    t = new Set();
  for (const o of n.members) {
    if (
      !ke(o) ||
      !_2(o.playerId, 1, 64) ||
      !_2(o.name, 1, 18) ||
      !P1(o.slot, 0, 7) ||
      typeof o.ready != "boolean" ||
      ![null, 1, 2].includes(o.team) ||
      e.has(o.playerId) ||
      t.has(o.slot) ||
      (o.changing !== void 0 && typeof o.changing != "boolean") ||
      (o.initial !== void 0 && !_2(o.initial, 0, 64)) ||
      (o.equipment !== void 0 && !w90(o.equipment))
    )
      return !1;
    (e.add(o.playerId), t.add(o.slot));
  }
  if (!e.has(n.hostId)) return !1;
  const i = n;
  if (
    (G2(i) === "roadblock" &&
      (i.capacity < tt.minPlayers ||
        i.randomTrackCode !== _X ||
        i.trackId !== void 0)) ||
    (G2(i) === "lte" && (i.randomTrackCode !== bI || i.trackId !== void 0)) ||
    (G2(i) === "giant" &&
      (i.randomTrackCode !== void 0
        ? i.randomTrackCode !== 0
        : !Zl(i.trackId ?? ""))) ||
    i.closedSlots?.some(
      (o) =>
        t.has(o) ||
        (i.mode === "team" ? o % 4 >= i.capacity / 2 : o >= i.capacity),
    ) ||
    (i.kickVote &&
      (i.phase !== "open" ||
        !e.has(i.kickVote.targetId) ||
        i.kickVote.eligibleIds.some(
          (o) => !e.has(o) || o === i.kickVote.targetId,
        ) ||
        !i.kickVote.yesIds.includes(i.hostId) ||
        i.kickVote.eligibleIds.includes(i.kickVote.targetId))) ||
    (n.raceError !== void 0 &&
      ![
        "LOAD_TIMEOUT",
        "LOAD_FAILED",
        "MEMBER_LEFT",
        "HOST_CANCELLED",
      ].includes(String(n.raceError)))
  )
    return !1;
  if (n.phase === "open") return n.race === void 0;
  const r = n.race;
  if (
    !ke(r) ||
    r.channelName !== n.channelName ||
    !To(r.gameplay, r.channelName, n.resourceVersion) ||
    G2(r) !== G2(n) ||
    !_2(r.raceId, 1, 64) ||
    !Wg(r.trackId) ||
    (n.randomTrackCode === void 0 && r.trackId !== n.trackId) ||
    typeof r.loadingDeadline != "number" ||
    !Number.isFinite(r.loadingDeadline) ||
    r.loadingDeadline < 0 ||
    !Array.isArray(r.roster) ||
    !Array.isArray(r.loadedIds) ||
    !bP({ ...n, phase: "open", race: void 0, members: r.roster })
  )
    return !1;
  const s = new Set(r.roster.map((o) => o.playerId));
  if (
    r.roster.some((o) => !o.equipment) ||
    new Set(r.loadedIds).size !== r.loadedIds.length ||
    !r.loadedIds.every((o) => typeof o == "string" && s.has(o)) ||
    n.members.some((o) => !s.has(o.playerId)) ||
    (r.returnedIds !== void 0 &&
      (n.phase !== "finished" ||
        !Array.isArray(r.returnedIds) ||
        new Set(r.returnedIds).size !== r.returnedIds.length ||
        !r.returnedIds.every((o) => typeof o == "string" && s.has(o)))) ||
    (G2(i) === "rp" ? !ba(r.rp, [...s]) : r.rp !== void 0) ||
    (G2(i) === "lte" ? !ko(r.lte) || !Vw(r.trackId) : r.lte !== void 0) ||
    (G2(i) === "giant" ? !Io(r.giant) || !Zl(r.trackId) : r.giant !== void 0)
  )
    return !1;
  if (G2(i) === "roadblock") {
    const o = r.roadblock;
    if (
      !ke(o) ||
      o.ruleset !== tt.ruleset ||
      !s.has(String(o.runnerId)) ||
      o.limitMs !== tt.limitMs ||
      o.noRunnerManualReset !== !0 ||
      r.roster.length < tt.minPlayers ||
      !sR(r.trackId) ||
      r.finishWindowMs !== void 0 ||
      r.winningTeam !== void 0 ||
      r.teamScores !== void 0
    )
      return !1;
    if (n.phase === "loading")
      return (
        r.startAt === void 0 &&
        r.finishDeadline === void 0 &&
        r.roadblockOutcome === void 0 &&
        r.results === void 0 &&
        r.raceOverAt === void 0 &&
        r.finishes === void 0
      );
    if (
      typeof r.startAt != "number" ||
      !Number.isFinite(r.startAt) ||
      r.startAt < 0 ||
      r.loadedIds.length < tt.minPlayers ||
      !r.loadedIds.includes(o.runnerId) ||
      r.finishDeadline !== r.startAt + tt.limitMs
    )
      return !1;
    if (n.phase !== "finished")
      return (
        r.roadblockOutcome === void 0 &&
        r.results === void 0 &&
        r.raceOverAt === void 0 &&
        r.finishes === void 0
      );
    const a = r.roadblockOutcome;
    return !ke(a) ||
      typeof a.runnerWon != "boolean" ||
      !["finish", "timeout", "runner-left"].includes(String(a.reason)) ||
      typeof a.endAt != "number" ||
      !Number.isFinite(a.endAt) ||
      a.endAt < r.startAt ||
      a.endAt > r.finishDeadline ||
      a.runnerWon !== (a.reason === "finish") ||
      r.raceOverAt !== a.endAt + tt.resultDelayMs ||
      !Array.isArray(r.results) ||
      r.results.length !== 0 ||
      (a.reason === "timeout" && a.endAt !== r.finishDeadline)
      ? !1
      : a.reason === "finish"
        ? Array.isArray(r.finishes) &&
          r.finishes.length === 1 &&
          ke(r.finishes[0]) &&
          r.finishes[0].playerId === o.runnerId &&
          r.finishes[0].elapsedMs === a.endAt - r.startAt
        : r.finishes === void 0;
  }
  if (
    r.roadblock !== void 0 ||
    r.roadblockOutcome !== void 0 ||
    (r.finishWindowMs !== void 0 && r.finishWindowMs !== 1e4) ||
    (r.chat !== void 0 &&
      (!Array.isArray(r.chat) || r.chat.length > 32 || !r.chat.every(w6))) ||
    (r.finishes !== void 0 &&
      (!Array.isArray(r.finishes) ||
        r.finishes.length > r.roster.length ||
        !r.finishes.every(
          (o) =>
            ke(o) &&
            s.has(String(o.playerId)) &&
            P1(o.elapsedMs, 0, 4294967294),
        ) ||
        new Set(r.finishes.map((o) => o.playerId)).size !== r.finishes.length))
  )
    return !1;
  for (const o of [r.finishDeadline, r.raceOverAt])
    if (o !== void 0 && (typeof o != "number" || !Number.isFinite(o) || o < 0))
      return !1;
  if (
    r.finishDeadline !== void 0 &&
    (!r.finishes?.length || r.finishWindowMs !== 1e4)
  )
    return !1;
  if (n.phase === "finished") {
    if (
      r.finishDeadline === void 0 ||
      r.raceOverAt !== Number(r.finishDeadline) + 6e3 ||
      !Array.isArray(r.results) ||
      r.results.length !== r.loadedIds.length
    )
      return !1;
    if (n.mode === "team") {
      if (
        (r.winningTeam !== 1 && r.winningTeam !== 2) ||
        !ke(r.teamScores) ||
        !P1(r.teamScores[1], 0, 39) ||
        !P1(r.teamScores[2], 0, 39)
      )
        return !1;
    } else if (r.winningTeam !== void 0 || r.teamScores !== void 0) return !1;
    const o = new Set();
    for (const [a, c] of r.results.entries()) {
      if (
        !ke(c) ||
        !r.loadedIds.includes(String(c.playerId)) ||
        o.has(String(c.playerId)) ||
        c.rank !== a + 1 ||
        !(c.elapsedMs === null || P1(c.elapsedMs, 0, 4294967294)) ||
        typeof c.points != "number" ||
        !P1(c.points + 5, 0, 15)
      )
        return !1;
      o.add(String(c.playerId));
    }
  } else if (
    r.raceOverAt !== void 0 ||
    r.results !== void 0 ||
    r.winningTeam !== void 0 ||
    r.teamScores !== void 0
  )
    return !1;
  return n.phase === "loading"
    ? r.startAt === void 0
    : typeof r.startAt == "number" &&
        Number.isFinite(r.startAt) &&
        r.startAt >= 0 &&
        r.loadedIds.length > 0;
}
function zo0(n) {
  if (!(!ke(n) || (n.requestId !== void 0 && !_2(n.requestId, 1, 64))))
    switch (n.type) {
      case "p2p-signal":
        if (
          _2(n.roomId, 1, 64) &&
          _2(n.raceId, 1, 64) &&
          _2(n.playerId, 1, 64) &&
          _2(n.generation, 1, 64) &&
          (n.kind === "offer" || n.kind === "answer") &&
          Oo0(n.sdp)
        )
          return n;
        break;
      case "p2p-relay":
        if (_2(n.roomId, 1, 64) && _2(n.raceId, 1, 64) && _2(n.playerId, 1, 64))
          return n;
        break;
      case "p2p-accepted":
        if (_2(n.roomId, 1, 64) && _2(n.raceId, 1, 64)) return n;
        break;
      case "welcome":
        if (
          _2(n.playerId, 1, 64) &&
          n.protocolVersion === Uo &&
          n.ruleset === yP &&
          Array.isArray(n.capabilities) &&
          n.capabilities.length <= 32 &&
          n.capabilities.every((e) => _2(e, 1, 64))
        )
          return n;
        break;
      case "team-gauge":
        if (
          _2(n.roomId, 1, 64) &&
          _2(n.raceId, 1, 64) &&
          (n.team === 1 || n.team === 2) &&
          P1(n.sequence, 1, Number.MAX_SAFE_INTEGER) &&
          typeof n.target == "number" &&
          Number.isFinite(n.target) &&
          n.target >= 0 &&
          n.target <= 1
        )
          return n;
        break;
      case "giant-state":
        if (
          _2(n.roomId, 1, 64) &&
          _2(n.raceId, 1, 64) &&
          _2(n.playerId, 1, 64) &&
          P1(n.sequence, 1, Number.MAX_SAFE_INTEGER) &&
          t20(n)
        )
          return {
            type: "giant-state",
            roomId: n.roomId,
            raceId: n.raceId,
            playerId: n.playerId,
            sequence: n.sequence,
            main: n.main,
            extra: n.extra,
            status: n.status,
            ...(n.requestId === void 0 ? {} : { requestId: n.requestId }),
          };
        break;
      case "award-motion":
        if (
          _2(n.roomId, 1, 64) &&
          _2(n.raceId, 1, 64) &&
          _2(n.playerId, 1, 64) &&
          typeof n.motion == "number" &&
          [3, 4, 5, 12].includes(n.motion)
        )
          return n;
        break;
      case "latency-probe":
        if (_2(n.roomId, 1, 64) && _2(n.raceId, 1, 64) && _2(n.nonce, 1, 64))
          return n;
        break;
      case "latency":
        if (
          _2(n.roomId, 1, 64) &&
          _2(n.raceId, 1, 64) &&
          _2(n.playerId, 1, 64) &&
          P1(n.latencyMs, 0, 5e3)
        )
          return n;
        break;
      case "latency-ack":
        return n;
      case "room":
        if (bP(n.room)) return n;
        break;
      case "room-settings":
        if (
          _2(n.roomId, 1, 64) &&
          P1(n.revision, 1, Number.MAX_SAFE_INTEGER) &&
          _2(n.name, 1, 18) &&
          n.name.trim() &&
          _2(n.password, 0, 12)
        )
          return n;
        break;
      case "chat":
        if (_2(n.roomId, 1, 64) && w6(n.message)) return n;
        break;
      case "race-chat":
        if (_2(n.roomId, 1, 64) && _2(n.raceId, 1, 64) && w6(n.message))
          return n;
        break;
      case "left":
        if (_2(n.roomId, 1, 64)) return n;
        break;
      case "error":
        if (_2(n.code, 1, 64)) return n;
        break;
      case "clock":
        if (
          typeof n.clientTick == "number" &&
          Number.isFinite(n.clientTick) &&
          n.clientTick >= 0 &&
          typeof n.serverTick == "number" &&
          Number.isFinite(n.serverTick) &&
          n.serverTick >= 0
        )
          return n;
        break;
      case "rooms":
        if (
          P1(n.page, 0, 1e5) &&
          P1(n.total, 0, 1e5) &&
          Array.isArray(n.rooms) &&
          n.rooms.length <= 10 &&
          n.rooms.every(
            (e) =>
              ke(e) &&
              _2(e.roomId, 1, 64) &&
              _2(e.name, 1, 18) &&
              (e.mode === "individual" || e.mode === "team") &&
              P1(e.capacity, 2, 8) &&
              e.speedVersion === "国服" &&
              W6(e.channelName, e.mode, e.speed) &&
              To(e.gameplay, e.channelName, e.resourceVersion) &&
              P1(e.count, 0, Number(e.capacity)) &&
              typeof e.locked == "boolean" &&
              AP(e.resourceVersion) &&
              (e.trackId === void 0 || Wg(e.trackId)) &&
              (e.randomTrackCode === void 0 ||
                (typeof e.randomTrackCode == "number" &&
                  !!X6(e.randomTrackCode) &&
                  e.resourceVersion === "p3553" &&
                  e.trackId === void 0)) &&
              (e.trackId !== void 0 || e.randomTrackCode !== void 0),
          )
        )
          return n;
        break;
    }
}
const Uo0 = 11,
  YE = `${Uo}.${Uo0}`,
  ZE = 250;
class $o0 {
  element;
  systemElement = document.createElement("section");
  debugTextList;
  debugPanel;
  debugOutput;
  copyPerformanceButton;
  debugEnginePanel;
  debugEngineOutput;
  copyEngineButton;
  callbacks;
  pauseOverlay;
  loadingView;
  loadingLabel;
  loadingError;
  loadingFab;
  loadingFabCopy;
  loadingFabRing;
  loadingProgress = new Map();
  performanceCounter;
  debugVisible = !1;
  nextDebugRefreshMs = 0;
  engineVisible = !1;
  nextEngineRefreshMs = 0;
  copyLabelTimer = 0;
  latestState;
  latestFps = 0;
  latestWorkSegments;
  constructor(e, t) {
    ((this.element = document.createElement("section")),
      (this.element.className = "hud"),
      (this.element.dataset.uiLayer = "diagnostics"),
      (this.element.innerHTML = `
      <div class="debug-text-list" data-hud="debug-text-list" role="log" aria-live="polite"></div>
      <aside class="debug-panel" data-hud="debug">
        <div class="debug-panel-actions">
          <strong>F2 FPS</strong>
        </div>
        <pre data-hud="debug-output"></pre>
      </aside>
    `),
      this.element.insertAdjacentHTML(
        "beforeend",
        `
      <aside class="debug-panel" data-hud="debug-engine" style="left:25px;right:auto;">
        <div class="debug-panel-actions">
          <strong>F3 ENGINE / GRAPHICS / MEMORY · v${YE}</strong>
          <button type="button" data-action="copy-engine">复制</button>
        </div>
        <pre data-hud="debug-engine-output"></pre>
      </aside>
    `,
      ),
      (this.systemElement.className = "system-overlay"),
      (this.systemElement.dataset.uiLayer = "system"),
      (this.systemElement.innerHTML = `
      <div class="pause-overlay">
        <strong>运行已停止</strong>
        <div class="pause-actions">
          <button type="button" data-action="return-ready">返回 READY</button>
        </div>
      </div>
      <div class="startup-loading" data-hud="startup-loading" role="status" aria-live="polite">
        <div class="startup-loading-copy">
          <strong class="startup-loading-label" role="progressbar" aria-label="加载进度">LOADING</strong>
          <small class="startup-frontend-version">前端 v${YE}</small>
          <p data-hud="startup-loading-error" role="alert" hidden></p>
          <div class="startup-resource-choice" data-hud="resource-choice" hidden>
            <span>资源来源</span>
            <button type="button" data-action="local-rho">选择本地 Data 文件夹</button>
            <button type="button" data-action="online-rho">使用在线资源</button>
          </div>
        </div>
      </div>
      <div class="loading-fab" data-hud="loading-fab" role="status" aria-live="polite" hidden>
        <span class="loading-fab-copy" data-hud="loading-fab-copy">正在加载资源</span>
        <span class="loading-fab-ring" role="progressbar" aria-label="后台加载进度"></span>
      </div>
    `),
      e.append(this.element),
      e.ownerDocument.body.append(this.systemElement),
      (this.debugTextList = X1(this.element, "[data-hud='debug-text-list']")),
      (this.debugPanel = X1(this.element, "[data-hud='debug']")),
      (this.debugOutput = X1(this.debugPanel, "[data-hud='debug-output']")),
      (this.debugEnginePanel = X1(this.element, "[data-hud='debug-engine']")),
      (this.debugEngineOutput = X1(
        this.debugEnginePanel,
        "[data-hud='debug-engine-output']",
      )),
      (this.copyEngineButton = X1(
        this.debugEnginePanel,
        "[data-action='copy-engine']",
      )),
      (this.performanceCounter = new ko0()),
      (this.callbacks = t),
      (this.pauseOverlay = X1(this.systemElement, ".pause-overlay")),
      (this.loadingView = X1(
        this.systemElement,
        "[data-hud='startup-loading']",
      )),
      (this.loadingLabel = X1(this.systemElement, ".startup-loading-label")),
      (this.loadingError = X1(
        this.systemElement,
        "[data-hud='startup-loading-error']",
      )),
      (this.loadingFab = X1(this.systemElement, "[data-hud='loading-fab']")),
      (this.loadingFabCopy = X1(
        this.systemElement,
        "[data-hud='loading-fab-copy']",
      )),
      (this.loadingFabRing = X1(this.systemElement, ".loading-fab-ring")),
      this.pauseOverlay
        .querySelector("[data-action='return-ready']")
        ?.addEventListener("click", t.returnToReady),
      this.copyPerformanceButton?.addEventListener(
        "click",
        this.onCopyPerformance,
      ),
      this.copyEngineButton?.addEventListener("click", this.onCopyEngine),
      window.addEventListener("keydown", this.onDebugKeyDown),
      document.addEventListener("visibilitychange", this.onVisibilityChange));
  }
  dispose() {
    (window.removeEventListener("keydown", this.onDebugKeyDown),
      document.removeEventListener("visibilitychange", this.onVisibilityChange),
      this.copyPerformanceButton?.removeEventListener(
        "click",
        this.onCopyPerformance,
      ),
      this.copyEngineButton?.removeEventListener("click", this.onCopyEngine),
      window.clearTimeout(this.copyLabelTimer),
      this.performanceCounter?.dispose(),
      this.element.remove(),
      this.systemElement.remove());
  }
  update(e, t) {
    ((this.latestState = e), this.updateEngine(t));
  }
  updateEngine(e) {
    this.latestFps = e;
    const t = performance.now();
    (this.refreshDebugPanel(t), this.refreshEnginePanel(t));
  }
  probeSnapshot() {}
  beginPerformanceRace(e = performance.now()) {
    const t = this.performanceCounter;
    t !== void 0 &&
      (t.beginRace(e),
      (this.nextDebugRefreshMs = 0),
      this.refreshDebugPanel(e, !0));
  }
  finishPerformanceRace(e = performance.now()) {
    const t = this.performanceCounter;
    t !== void 0 &&
      (t.finishRace(e),
      (this.nextDebugRefreshMs = 0),
      this.refreshDebugPanel(e, !0));
  }
  recordPerformanceFrame(e, t, i, r) {
    this.latestWorkSegments = r;
    const s = this.performanceCounter;
    if (s === void 0) return;
    s.recordFrame(e, t, i) &&
      !s.isRaceActive() &&
      this.refreshDebugPanel(performance.now(), !0);
  }
  setPaused(e) {
    const t = this.performanceCounter;
    (e === !1 && t?.isRaceActive() && t.skipNextFrame(),
      this.pauseOverlay.classList.toggle("is-visible", e));
  }
  showDebugText(e, t = "info") {
    const i = document.createElement("p");
    ((i.textContent = e),
      (i.dataset.kind = t),
      this.debugTextList.append(i),
      window.setTimeout(() => i.remove(), t === "error" ? 6e3 : 3500));
  }
  beginLoading() {
    (this.loadingProgress.clear(),
      JE(this.loadingLabel),
      JE(this.loadingFabRing),
      this.setLoadingFabVisible(!1),
      this.loadingView.classList.remove("is-complete", "has-error"),
      this.loadingView.removeAttribute("aria-hidden"),
      (this.loadingError.textContent = ""),
      (this.loadingError.hidden = !0));
  }
  chooseResourceSource(e) {
    const t = X1(this.loadingView, "[data-hud='resource-choice']"),
      i = X1(t, "[data-action='local-rho']"),
      r = X1(t, "[data-action='online-rho']");
    return (
      (t.hidden = !1),
      new Promise((s) => {
        const o = (l) => {
            ((t.hidden = !0),
              i.removeEventListener("click", c),
              r.removeEventListener("click", a),
              s(l));
          },
          a = () => o(),
          c = async () => {
            i.disabled = !0;
            try {
              o(await e());
            } catch (l) {
              (l instanceof DOMException && l.name === "AbortError") ||
                ((this.loadingError.textContent =
                  l instanceof Error ? l.message : String(l)),
                (this.loadingError.hidden = !1));
            } finally {
              i.disabled = !1;
            }
          };
        (i.addEventListener("click", c), r.addEventListener("click", a));
      })
    );
  }
  finishLoading() {
    (this.loadingView.classList.add("is-complete"),
      this.loadingView.setAttribute("aria-hidden", "true"),
      this.setLoadingFabVisible(!1),
      this.loadingProgress.clear());
  }
  setLoadingProgress(e, t, i, r = "正在加载资源") {
    const s = Math.max(0, i);
    this.loadingProgress.set(e, {
      loaded: Math.min(s, Math.max(0, t)),
      total: s,
    });
    const o = Ho0(this.loadingProgress.values()),
      a = o.total <= 0 ? 1 : o.loaded / o.total,
      c = Math.round(a * 1e4) / 100;
    (QE(this.loadingLabel, c),
      QE(this.loadingFabRing, c),
      (this.loadingFabCopy.textContent = r));
    const l = !this.loadingView.classList.contains("is-complete"),
      u = o.total <= 0 || o.loaded >= o.total;
    (this.setLoadingFabVisible(!l && !u),
      !l && u && this.loadingProgress.clear());
  }
  showLoadingError(e) {
    ((this.loadingError.textContent = e),
      (this.loadingError.hidden = !1),
      this.loadingView.classList.add("has-error"),
      this.showDebugText(e, "error"));
  }
  setLoadingFabVisible(e) {
    ((this.loadingFab.hidden = !e),
      this.systemElement.classList.toggle("has-loading-fab", e));
  }
  onVisibilityChange = () => {
    document.visibilityState === "visible" &&
      this.performanceCounter?.skipNextFrame();
  };
  onDebugKeyDown = (e) => {
    e.repeat ||
      (e.code === "F2"
        ? (e.preventDefault(),
          (this.debugVisible = !this.debugVisible),
          this.debugPanel.classList.toggle("is-visible", this.debugVisible),
          (this.nextDebugRefreshMs = 0),
          this.refreshDebugPanel(performance.now(), !0))
        : e.code === "F3" &&
          (e.preventDefault(),
          (this.engineVisible = !this.engineVisible),
          this.debugEnginePanel?.classList.toggle(
            "is-visible",
            this.engineVisible,
          ),
          (this.nextEngineRefreshMs = 0),
          this.refreshEnginePanel(performance.now(), !0)));
  };
  onCopyPerformance = () => {};
  onCopyEngine = () => {
    const e = this.copyEngineButton;
    if (e === void 0 || this.debugEngineOutput === void 0) return;
    const t = this.debugEngineOutput.textContent ?? "";
    Ko0(t)
      .then(() => {
        (window.clearTimeout(this.copyLabelTimer),
          (e.textContent = "已复制"),
          (this.copyLabelTimer = window.setTimeout(() => {
            e.textContent = "复制";
          }, 1500)));
      })
      .catch((i) => {
        const r = i instanceof Error ? i.message : String(i);
        this.showDebugText(`复制 F3 数据失败：${r}`, "error");
      });
  };
  refreshEnginePanel(e, t = !1) {
    if (
      !this.engineVisible ||
      this.performanceCounter === void 0 ||
      this.debugEngineOutput === void 0 ||
      (!t && e < this.nextEngineRefreshMs)
    )
      return;
    this.nextEngineRefreshMs = e + ZE;
    const i = this.callbacks.collectEngineDiagnostics?.() ?? null,
      r = qo0(i, this.performanceCounter.summary(), this.latestFps);
    this.debugEngineOutput.textContent = r.join(`
`);
  }
  refreshDebugPanel(e, t = !1) {
    if (this.debugVisible && !(!t && e < this.nextDebugRefreshMs)) {
      this.nextDebugRefreshMs = e + ZE;
      {
        this.debugOutput.textContent = Wo0(this.latestFps);
        return;
      }
    }
  }
}
function Wo0(n) {
  return `FPS  ${n.toFixed(1)}`;
}
function Ho0(n) {
  let e = 0,
    t = 0;
  for (const i of n) ((e += i.loaded), (t += i.total));
  return { loaded: e, total: t };
}
function X1(n, e) {
  const t = n.querySelector(e);
  if (!t) throw new Error(`HUD element not found: ${e}`);
  return t;
}
function QE(n, e) {
  (n.classList.add("is-determinate"),
    n.style.setProperty("--loading-progress", `${e}%`),
    n.setAttribute("aria-valuemin", "0"),
    n.setAttribute("aria-valuemax", "100"),
    n.setAttribute("aria-valuenow", String(e)));
}
function JE(n) {
  (n.classList.remove("is-determinate"),
    n.style.removeProperty("--loading-progress"),
    n.removeAttribute("aria-valuemin"),
    n.removeAttribute("aria-valuemax"),
    n.removeAttribute("aria-valuenow"));
}
function qo0(n, e, t) {
  const i = e.longTaskSupported
      ? `${e.longTaskCount} max ${i1(e.longTaskMaxMs)}`
      : "n/a",
    r = e.heapSupported
      ? `used ${De(e.heapCurrentBytes)} / limit ${De(e.heapLimitBytes)} | committed ${De(e.heapTotalBytes)} | min ${De(e.heapMinBytes)} max ${De(e.heapMaxBytes)} | maxdrop ${De(e.heapLargestDropBytes)}`
      : "unavailable",
    s = [
      `FPS        now ${t.toFixed(1)} | race avg ${e.averageFps.toFixed(1)} | frames ${e.frameCount}`,
      `FRAME      p50 ${i1(e.frame.p50Ms)} | p95 ${i1(e.frame.p95Ms)} | p99 ${i1(e.frame.p99Ms)} | max ${i1(e.frame.maxMs)}`,
      `LOW FPS    1% ${e.frame.low1Fps.toFixed(1)} | 0.1% ${e.frame.low01Fps.toFixed(1)} | min ${e.frame.minFps.toFixed(1)}`,
      `WORK       p50 ${i1(e.work.p50Ms)} | p95 ${i1(e.work.p95Ms)} | max ${i1(e.work.maxMs)} | 1s mean ${$g(e.workWindowMeanMs)} | longtask ${i}`,
      `STALL      worst frame minus its work = ${i1(e.maxStallMs)} (outside game callback => GC/GPU/browser)`,
      `JS HEAP    ${r}`,
      `ALLOC      ${e.heapAllocKiBPerFrame.toFixed(1)} KiB/frame | ${e.heapAllocMiBPerSec.toFixed(2)} MiB/s | GC ${e.heapGcPerSec.toFixed(2)} /s (total ${e.heapGcDropTotal})`,
    ];
  if (!n) return (s.push("ENGINE     (diagnostics provider unavailable)"), s);
  s.push(
    `DRAW       calls ${n.render.calls} | triangles ${n.render.triangles} | lines ${n.render.lines} | points ${n.render.points} | frameIndex ${n.render.frame}`,
    `GPU MEM    geometries ${n.rendererMemory.geometries} | textures ${n.rendererMemory.textures} | programs ${n.programs} (start ${n.programsAtStart})`,
    `CONTEXT    ${n.capabilities.isWebGL2 ? "WebGL2" : "WebGL1"} | maxTextures ${n.capabilities.maxTextures} | maxTextureSize ${n.capabilities.maxTextureSize} | DPR ${n.drawingBuffer.pixelRatio.toFixed(2)} | buffer ${n.drawingBuffer.width}x${n.drawingBuffer.height}`,
    `SCENE      objects ${n.scene.objects} | visible ${n.scene.visibleObjects} | mesh ${n.scene.meshes} (skinned ${n.scene.skinnedMeshes}) | line ${n.scene.lineObjects} | point ${n.scene.pointObjects} | sprite ${n.scene.sprites} | light ${n.scene.lights}`,
    `TRACK DRAW visible ${n.trackDraws.visibleMeshes} / ${n.trackDraws.builtMeshes} built | ${n.trackDraws.visibleTris} tri`,
    `CAMERA     pos ${n.camera.position.join(", ")} | yaw ${n.camera.rotationY} | pitch ${n.camera.rotationX} | fov ${n.camera.fov} | near ${n.camera.near} | far ${n.camera.far}`,
    `ASSETS     materials ${n.scene.materials} | geometries ${n.scene.geometries}`,
    `ACTIVE     ${Object.keys(n.active)
      .filter((o) => n.active[o])
      .join(" ")}`,
    `OPTIONS    boostBlur ${yc(n.options.boostBlur)} | toonLine ${yc(n.options.toonLine)} | shadow ${yc(n.options.shadow)} | dualBoostAuto ${yc(n.options.dualBoostAuto)}`,
    `RAF DELAY  max ${i1(n.raf.maxDelayMs)} (vsync -> our callback; large = main thread busy before us)`,
  );
  for (const o of n.network ?? [])
    s.push(
      `NET peer-${o.peer} ${o.route} (${o.candidate ?? "pending"}) | RTT ${o.rttMs?.toFixed(0) ?? "-"} ms | age ${o.stateAgeMs.toFixed(0)} ms | queued ${o.bufferedBytes} B | RTC ${o.sent}/${o.received} | relay attempts ${o.relayed} | errors ${o.dropped} | repair ${o.repairs}`,
    );
  return s;
}
function yc(n) {
  return n ? "on" : "off";
}
async function Ko0(n) {
  if (navigator.clipboard?.writeText)
    try {
      await navigator.clipboard.writeText(n);
      return;
    } catch {}
  const e = document.createElement("textarea");
  ((e.value = n),
    e.setAttribute("readonly", ""),
    (e.style.position = "fixed"),
    (e.style.opacity = "0"),
    document.body.append(e),
    e.select());
  const t = document.execCommand("copy");
  if ((e.remove(), !t)) throw new Error("浏览器拒绝了剪贴板写入");
}
function eT(n) {
  const e = n.getBoundingClientRect(),
    t = document.createElement("canvas"),
    i = window.devicePixelRatio || 1;
  ((t.width = Math.max(1, Math.round(e.width * i))),
    (t.height = Math.max(1, Math.round(e.height * i))));
  const r = t.getContext("2d");
  if (!r) throw new Error("无法保存页面切换画面。");
  r.scale(i, i);
  const s = [...n.querySelectorAll("canvas[data-ui-layer]")]
    .map((o) => ({
      source: o,
      style: getComputedStyle(o),
      rect: o.getBoundingClientRect(),
    }))
    .filter(
      ({ source: o, style: a, rect: c }) =>
        !o.hidden &&
        a.display !== "none" &&
        a.visibility !== "hidden" &&
        c.width > 0 &&
        c.height > 0,
    )
    .sort(
      (o, a) =>
        (Number.parseInt(o.style.zIndex) || 0) -
        (Number.parseInt(a.style.zIndex) || 0),
    );
  for (const { source: o, style: a, rect: c } of s)
    ((r.globalAlpha = Number(a.opacity)),
      r.drawImage(o, c.left - e.left, c.top - e.top, c.width, c.height));
  return (
    Object.assign(t.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      zIndex: "8",
      pointerEvents: "auto",
    }),
    t.setAttribute("aria-hidden", "true"),
    n.append(t),
    () => t.remove()
  );
}
function jo0(n) {
  const {
    renderer: e,
    scene: t,
    camera: i,
    drawingBufferSize: r,
    renderStats: s,
  } = n;
  e.getDrawingBufferSize(r);
  let o = 0,
    a = 0,
    c = 0,
    l = 0,
    u = 0,
    h = 0,
    d = 0,
    f = 0,
    p = 0,
    v = 0,
    w = 0;
  const g = new Set(),
    y = new Set();
  t.traverse((A) => {
    ((o += 1), A.visible && (a += 1));
    const x = A.isMesh === !0;
    (x && (c += 1),
      A.isSkinnedMesh && (l += 1),
      A.isLine && (u += 1),
      A.isPoints && (h += 1),
      A.isSprite && (d += 1),
      A.isLight && (f += 1));
    const M = A.geometry;
    M && y.add(M);
    const E = A.material;
    if ((Array.isArray(E) ? E.forEach((_) => g.add(_)) : E && g.add(E), x)) {
      let _ = !1,
        C = !0;
      for (let S = A; S; S = S.parent)
        (S.name.endsWith(":TimeAttackRenderScene") && (_ = !0),
          S.visible || (C = !1));
      if (_ && ((p += 1), C)) {
        v += 1;
        const S = A.geometry;
        w +=
          (S.drawRange.count !== 1 / 0
            ? S.drawRange.count
            : S.index
              ? S.index.count
              : S.attributes.position.count) / 3;
      }
    }
  });
  const b = e.info;
  return {
    network: n.network,
    render: s,
    rendererMemory: {
      geometries: b.memory.geometries,
      textures: b.memory.textures,
    },
    programs: b.programs?.length ?? 0,
    programsAtStart: n.raceStartProgramCount,
    capabilities: {
      isWebGL2: e.capabilities.isWebGL2,
      maxTextures: e.capabilities.maxTextures,
      maxTextureSize: e.capabilities.maxTextureSize,
    },
    drawingBuffer: { width: r.x, height: r.y, pixelRatio: e.getPixelRatio() },
    scene: {
      objects: o,
      visibleObjects: a,
      meshes: c,
      skinnedMeshes: l,
      lineObjects: u,
      pointObjects: h,
      sprites: d,
      lights: f,
      materials: g.size,
      geometries: y.size,
    },
    trackDraws: {
      visibleMeshes: v,
      visibleTris: Math.round(w),
      builtMeshes: p,
    },
    camera: Xo0(i),
    active: n.active,
    options: n.options,
    raf: { maxDelayMs: n.maxRafDelayMs },
  };
}
function Xo0(n) {
  const e = new o5().setFromQuaternion(n.quaternion, "YXZ");
  return {
    position: [
      Math.round(n.position.x * 100) / 100,
      Math.round(n.position.y * 100) / 100,
      Math.round(n.position.z * 100) / 100,
    ],
    rotationY: Math.round(e.y * 1e3) / 1e3,
    rotationX: Math.round(e.x * 1e3) / 1e3,
    fov: Math.round(n.fov * 100) / 100,
    near: n.near,
    far: n.far,
  };
}
const Yo0 = {
    "track-select": "ReadyTrackSelect",
    garage: "ReadyGarage",
    settings: "ReadySettings",
  },
  Zo0 = {
    ReadyTrackSelect: "track-select",
    ReadyGarage: "garage",
    ReadySettings: "settings",
  };
class Qo0 {
  state = "Booting";
  haltLock = !1;
  raceStarting = !1;
  readyStageOpening = !1;
  get current() {
    return this.state;
  }
  get modal() {
    return Zo0[this.state];
  }
  get started() {
    return this.state === "Racing";
  }
  get halted() {
    return this.haltLock;
  }
  get readyModalBusy() {
    return (
      this.state === "MultiplayerLobby" ||
      this.state === "MultiplayerRacing" ||
      this.raceStarting ||
      this.readyStageOpening ||
      this.state === "ReadyTrackSelect" ||
      this.state === "ReadyGarage" ||
      this.state === "ReadySettings"
    );
  }
  get isRaceStarting() {
    return this.raceStarting;
  }
  get isReadyStageOpening() {
    return this.readyStageOpening;
  }
  enterMultiplayerLobby(e = "ready") {
    return this.raceStarting ||
      this.readyStageOpening ||
      this.state !== (e === "garage" ? "ReadyGarage" : "Ready")
      ? !1
      : ((this.state = "MultiplayerLobby"), !0);
  }
  restoreGarageFromMultiplayerLobby() {
    if (this.state !== "MultiplayerLobby")
      throw new Error("Multiplayer lobby is not active");
    this.state = "ReadyGarage";
  }
  leaveMultiplayerLobby() {
    if (this.state !== "MultiplayerLobby")
      throw new Error("Multiplayer lobby is not active");
    this.state = "Ready";
  }
  enterMultiplayerRace() {
    if (this.state !== "MultiplayerLobby")
      throw new Error("Multiplayer room is not active");
    this.state = "MultiplayerRacing";
  }
  leaveMultiplayerRace() {
    if (this.state !== "MultiplayerRacing")
      throw new Error("Multiplayer race is not active");
    this.state = "MultiplayerLobby";
  }
  enterReady() {
    const e = this.state;
    if (e !== "Booting" && e !== "Ready" && e !== "Racing")
      throw new Error(`ShellStateMachine.enterReady 非法转移：${e} -> Ready。`);
    this.state = "Ready";
  }
  halt() {
    if (this.state === "Disposed")
      throw new Error("ShellStateMachine.halt 非法转移：Disposed。");
    this.haltLock = !0;
  }
  clearHalt() {
    if (this.state === "Disposed")
      throw new Error("ShellStateMachine.clearHalt 非法转移：Disposed。");
    this.haltLock = !1;
  }
  openModal(e) {
    return this.state !== "Ready" || this.readyModalBusy
      ? !1
      : ((this.state = Yo0[e]), !0);
  }
  closeModal(e) {
    if (this.modal !== e)
      throw new Error(
        `ShellStateMachine.closeModal 非法转移：${this.state} 关闭 ${e}。`,
      );
    this.state = "Ready";
  }
  beginRaceStart() {
    return this.state !== "Ready" || this.readyModalBusy
      ? !1
      : ((this.raceStarting = !0), !0);
  }
  enterRace() {
    if (this.state !== "Ready" && this.state !== "Racing")
      throw new Error(
        `ShellStateMachine.enterRace 非法转移：${this.state} -> Racing。`,
      );
    this.state = "Racing";
  }
  endRaceStart() {
    if (!this.raceStarting)
      throw new Error(
        "ShellStateMachine.endRaceStart 调用时未持有 race start 锁。",
      );
    this.raceStarting = !1;
  }
  beginReadyStage() {
    if (this.state === "Disposed")
      throw new Error("ShellStateMachine.beginReadyStage 非法转移：Disposed。");
    this.readyStageOpening = !0;
  }
  endReadyStage() {
    if (!this.readyStageOpening)
      throw new Error(
        "ShellStateMachine.endReadyStage 调用时未持有 ready stage 锁。",
      );
    this.readyStageOpening = !1;
  }
  dispose() {
    ((this.state = "Disposed"),
      (this.haltLock = !1),
      (this.raceStarting = !1),
      (this.readyStageOpening = !1));
  }
}
class Jo0 {
  constructor(e) {
    this.debug = e;
  }
  debug;
  library;
  resources;
  generation = 0;
  get current() {
    return this.library;
  }
  get opfs() {
    return this.resources;
  }
  get generationValue() {
    return this.generation;
  }
  beginGeneration() {
    return ++this.generation;
  }
  invalidate() {
    this.generation += 1;
  }
  isCurrent(e) {
    return e === this.generation;
  }
  install(e, t) {
    ((this.library = e), (this.resources = t));
  }
  require(e) {
    const t = this.library?.get(e);
    if (!t) throw new Error(`资源库内找不到 ${e}。`);
    return t;
  }
  async preloadContainers(e, t, i, r) {
    if (!this.library || !this.resources)
      throw new Error("P3528 资源库尚未建立。");
    const s = await t3(this.library, t, r),
      o = s.find(["model.1s"]);
    if (!o) throw new Error(`${t} 的车辆资源目录内找不到 model.1s。`);
    const a = this.library.physicalContainerNames([
      e,
      s.parameter.entry.virtualPath,
      o.virtualPath,
      i,
    ]);
    (await this.resources.preloadContainers(a),
      this.debug.showDebugText(`已预加载本局 ${a.length} 个物理资源容器`));
  }
}
const ut = [
    { index: 0, action: l2.SteerLeft, defaultKeyCode: 203 },
    { index: 1, action: l2.SteerRight, defaultKeyCode: 205 },
    { index: 2, action: l2.Forward, defaultKeyCode: 200 },
    { index: 3, action: l2.Reverse, defaultKeyCode: 208 },
    { index: 4, action: l2.Drift, defaultKeyCode: 42 },
    { index: 5, action: l2.UseItemOrBooster, defaultKeyCode: 29 },
    { index: 6, action: l2.ReorderItems, defaultKeyCode: 56 },
    { index: 7, action: l2.SecondaryItem, defaultKeyCode: 44 },
    { index: 8, action: l2.GaugeState, defaultKeyCode: 57 },
    { index: 9, action: l2.Reset, defaultKeyCode: 19 },
    { index: 10, action: l2.SteerLeft, defaultKeyCode: 75 },
    { index: 11, action: l2.SteerRight, defaultKeyCode: 77 },
    { index: 12, action: l2.Forward, defaultKeyCode: 72 },
    { index: 13, action: l2.Reverse, defaultKeyCode: 80 },
    { index: 14, action: l2.Drift, defaultKeyCode: 54 },
    { index: 15, action: l2.UseItemOrBooster, defaultKeyCode: 157 },
    { index: 16, action: l2.ReorderItems, defaultKeyCode: 184 },
    { index: 18, action: l2.ModeImpulsePositive, defaultKeyCode: 44 },
    { index: 19, action: l2.ModeImpulseNegative, defaultKeyCode: 45 },
    { index: 20, action: l2.GaugeState, defaultKeyCode: 45 },
    { index: 21, action: l2.DisplayMode, defaultKeyCode: 23 },
    { index: 22, action: l2.Help, defaultKeyCode: 59 },
  ],
  Br = Object.fromEntries(ut.map(({ index: n, defaultKeyCode: e }) => [n, e])),
  MP = {
    0: ["", !0],
    1: ["Esc", !1],
    2: ["1", !1],
    3: ["2", !1],
    4: ["3", !1],
    5: ["4", !1],
    6: ["5", !1],
    7: ["6", !1],
    8: ["7", !1],
    9: ["8", !1],
    10: ["9", !1],
    11: ["0", !1],
    12: ["-", !0],
    13: ["=", !0],
    14: ["Back Space", !0],
    15: ["Tab", !1],
    16: ["Q", !0],
    17: ["W", !0],
    18: ["E", !0],
    19: ["R", !0],
    20: ["T", !0],
    21: ["Y", !0],
    22: ["U", !0],
    23: ["I", !0],
    24: ["O", !0],
    25: ["P", !0],
    26: ["[", !0],
    27: ["]", !0],
    28: ["Enter", !0],
    29: ["Ctrl (Left)", !0],
    30: ["A", !0],
    31: ["S", !0],
    32: ["D", !0],
    33: ["F", !0],
    34: ["G", !0],
    35: ["H", !0],
    36: ["J", !0],
    37: ["K", !0],
    38: ["L", !0],
    39: [";", !0],
    40: ["'", !0],
    41: ["`", !0],
    42: ["Shift (Left)", !0],
    43: ["\\", !0],
    44: ["Z", !0],
    45: ["X", !0],
    46: ["C", !0],
    47: ["V", !0],
    48: ["B", !0],
    49: ["N", !0],
    50: ["M", !1],
    51: [",", !0],
    52: [".", !0],
    53: ["/", !0],
    54: ["Shift (Right)", !0],
    55: ["* (Numpad)", !0],
    56: ["Alt (Left)", !0],
    57: ["Space", !0],
    58: ["Caps Lock", !0],
    59: ["F1", !0],
    60: ["F2", !1],
    61: ["F3", !1],
    62: ["F4", !1],
    63: ["F5", !1],
    64: ["F6", !1],
    65: ["F7", !1],
    66: ["F8", !1],
    67: ["F9", !1],
    68: ["F10", !1],
    69: ["Num Lock", !1],
    70: ["Scroll Lock", !1],
    71: ["7 (Numpad)", !0],
    72: ["8 (Numpad)", !0],
    73: ["9 (Numpad)", !0],
    74: ["- (Numpad)", !0],
    75: ["4 (Numpad)", !0],
    76: ["5 (Numpad)", !0],
    77: ["6 (Numpad)", !0],
    78: ["+ (Numpad)", !0],
    79: ["1 (Numpad)", !0],
    80: ["2 (Numpad)", !0],
    81: ["3 (Numpad)", !0],
    82: ["0 (Numpad)", !0],
    83: [". (Numpad)", !0],
    87: ["F11", !1],
    88: ["F12", !1],
    100: ["F13", !1],
    101: ["F14", !1],
    102: ["F15", !1],
    112: ["Kana", !0],
    121: ["Convert", !0],
    123: ["No Convert", !0],
    125: ["Yen", !0],
    141: ["=(Numpad)", !0],
    144: ["Circumflex", !0],
    145: ["@", !0],
    146: [":", !0],
    147: ["_", !0],
    148: ["Kanji", !0],
    149: ["Stop", !0],
    150: ["Japan AX", !0],
    151: ["J3100", !0],
    156: ["Enter (Numpad)", !0],
    157: ["Ctrl (Right)", !0],
    179: [", (Numpad)", !0],
    181: ["/ (Numpad)", !0],
    183: ["Sys Rq", !0],
    184: ["Alt (Right)", !0],
    197: ["Pause", !0],
    199: ["Home", !0],
    200: ["Up Arrow", !0],
    201: ["Page Up", !0],
    203: ["Left Arrow", !0],
    205: ["Right Arrow", !0],
    207: ["End", !0],
    208: ["Down Arrow", !0],
    209: ["Page Down", !0],
    210: ["Insert", !0],
    211: ["Delete", !0],
    219: ["Windows (Left)", !1],
    220: ["Windows (Right)", !1],
    221: ["Menu", !1],
    222: ["Power", !1],
    223: ["Sleep", !1],
  },
  ea0 = {
    Escape: 1,
    Digit1: 2,
    Digit2: 3,
    Digit3: 4,
    Digit4: 5,
    Digit5: 6,
    Digit6: 7,
    Digit7: 8,
    Digit8: 9,
    Digit9: 10,
    Digit0: 11,
    Minus: 12,
    Equal: 13,
    Backspace: 14,
    Tab: 15,
    KeyQ: 16,
    KeyW: 17,
    KeyE: 18,
    KeyR: 19,
    KeyT: 20,
    KeyY: 21,
    KeyU: 22,
    KeyI: 23,
    KeyO: 24,
    KeyP: 25,
    BracketLeft: 26,
    BracketRight: 27,
    Enter: 28,
    ControlLeft: 29,
    KeyA: 30,
    KeyS: 31,
    KeyD: 32,
    KeyF: 33,
    KeyG: 34,
    KeyH: 35,
    KeyJ: 36,
    KeyK: 37,
    KeyL: 38,
    Semicolon: 39,
    Quote: 40,
    Backquote: 41,
    ShiftLeft: 42,
    Backslash: 43,
    KeyZ: 44,
    KeyX: 45,
    KeyC: 46,
    KeyV: 47,
    KeyB: 48,
    KeyN: 49,
    KeyM: 50,
    Comma: 51,
    Period: 52,
    Slash: 53,
    ShiftRight: 54,
    NumpadMultiply: 55,
    AltLeft: 56,
    Space: 57,
    CapsLock: 58,
    F1: 59,
    F2: 60,
    F3: 61,
    F4: 62,
    F5: 63,
    F6: 64,
    F7: 65,
    F8: 66,
    F9: 67,
    F10: 68,
    NumLock: 69,
    ScrollLock: 70,
    Numpad7: 71,
    Numpad8: 72,
    Numpad9: 73,
    NumpadSubtract: 74,
    Numpad4: 75,
    Numpad5: 76,
    Numpad6: 77,
    NumpadAdd: 78,
    Numpad1: 79,
    Numpad2: 80,
    Numpad3: 81,
    Numpad0: 82,
    NumpadDecimal: 83,
    F11: 87,
    F12: 88,
    F13: 100,
    F14: 101,
    F15: 102,
    KanaMode: 112,
    Convert: 121,
    NonConvert: 123,
    IntlYen: 125,
    NumpadEqual: 141,
    NumpadEnter: 156,
    ControlRight: 157,
    NumpadComma: 179,
    NumpadDivide: 181,
    PrintScreen: 183,
    AltRight: 184,
    Pause: 197,
    Home: 199,
    ArrowUp: 200,
    PageUp: 201,
    ArrowLeft: 203,
    ArrowRight: 205,
    End: 207,
    ArrowDown: 208,
    PageDown: 209,
    Insert: 210,
    Delete: 211,
    MetaLeft: 219,
    MetaRight: 220,
    ContextMenu: 221,
    Power: 222,
    Sleep: 223,
  };
function xP(n) {
  return ea0[n];
}
function SP(n) {
  return MP[n]?.[0] ?? "";
}
function CP(n) {
  return typeof n == "number" && MP[n]?.[1] === !0;
}
function ta0(n) {
  if (typeof n != "object" || n === null || Array.isArray(n))
    throw new Error("客户端键位配置必须是绑定编号到键码的记录。");
  const e = n;
  if (Object.keys(e).length !== ut.length)
    throw new Error("客户端键位配置必须保留原版 22 个绑定。");
  if (!ut.every(({ index: t }) => CP(e[t])))
    throw new Error("客户端键位配置包含缺失绑定或原版不允许的键码。");
  return e;
}
const Ga = -1,
  na0 = 64,
  Zs = na0;
function v6(n, e) {
  return Zs + n * 2 + (e < 0 ? 0 : 1);
}
const tT = 0.5,
  ia0 = 0.5,
  ra0 = {
    0: "A",
    1: "B",
    2: "X",
    3: "Y",
    4: "LB",
    5: "RB",
    6: "LT",
    7: "RT",
    8: "Back",
    9: "Start",
    10: "LS",
    11: "RS",
    12: "十字上",
    13: "十字下",
    14: "十字左",
    15: "十字右",
  };
function sa0(n) {
  if (n === Ga) return "";
  if (n < Zs) return ra0[n] ?? `按钮${n}`;
  const e = Math.floor((n - Zs) / 2),
    t = (n - Zs) % 2 === 0;
  return `摇杆${e + 1}${t ? "←/↑" : "→/↓"}`;
}
function EP(n) {
  return (
    typeof n == "number" &&
    Number.isInteger(n) &&
    (n === Ga || (n >= 0 && n < Zs + 16))
  );
}
const TP = Object.fromEntries(ut.map((n) => [n.index, oa0(n)]));
function oa0(n) {
  switch (n.index) {
    case 0:
      return v6(0, -1);
    case 1:
      return v6(0, 1);
    case 2:
      return 0;
    case 3:
      return 1;
    case 4:
      return 2;
    case 5:
      return 5;
    case 6:
      return 3;
    case 7:
      return 4;
    case 8:
      return 7;
    case 9:
      return 8;
    case 21:
      return 9;
    default:
      return Ga;
  }
}
function Hg(n) {
  const e = new Set();
  for (const t of n)
    t?.connected &&
      (t.buttons.forEach((i, r) => {
        (i.pressed || i.value >= ia0) && e.add(r);
      }),
      t.axes.forEach((i, r) => {
        (i <= -tT && e.add(v6(r, -1)), i >= tT && e.add(v6(r, 1)));
      }));
  return e;
}
function aa0(n) {
  if (typeof n != "object" || n === null || Array.isArray(n))
    throw new Error("客户端手柄键位配置必须是绑定编号到手柄控件的记录。");
  const e = n;
  if (Object.keys(e).length !== ut.length)
    throw new Error("客户端手柄键位配置必须保留原版 22 个绑定。");
  if (!ut.every(({ index: t }) => EP(e[t])))
    throw new Error("客户端手柄键位配置包含缺失绑定或非法手柄控件。");
  return e;
}
function ca0(n, e, t) {
  return t === Ga ? !1 : ut.some((i) => i.index !== e && n[i.index] === t);
}
const _P = {
    bgmEnabled: !0,
    bgmVolume: 1,
    fxEnabled: !0,
    fxVolume: 1,
    enableRoadSound: !1,
    boostBlur: !1,
    dualBoostAuto: !0,
    toonLine: !0,
    shadow: !0,
    mainMenuBgmPath: "",
    inGameFlyingPetVisible: !1,
    raceAnonymous: !1,
    raceTimeGap: !1,
    classicHud: !1,
    autoReady: !1,
    keyMap: Br,
    gamepadMap: TP,
  },
  GP = "kartrider-web:p3528:game-options-v1",
  BP = { F6: "enableRoadSound", F7: "fxEnabled", F8: "bgmEnabled" };
function la0() {
  const n = localStorage.getItem(GP),
    e =
      n === null
        ? { ..._P }
        : {
            dualBoostAuto: !0,
            toonLine: !0,
            shadow: !0,
            inGameFlyingPetVisible: !1,
            raceAnonymous: !1,
            raceTimeGap: !1,
            classicHud: !1,
            autoReady: !1,
            mainMenuBgmPath: "",
            keyMap: Br,
            gamepadMap: TP,
            ...JSON.parse(n),
          };
  return (RP(e), e);
}
function ua0(n) {
  (RP(n), localStorage.setItem(GP, JSON.stringify(n)));
}
function RP(n) {
  for (const e of [
    "bgmEnabled",
    "fxEnabled",
    "enableRoadSound",
    "boostBlur",
    "dualBoostAuto",
    "toonLine",
    "shadow",
    "inGameFlyingPetVisible",
    "raceAnonymous",
    "raceTimeGap",
    "classicHud",
    "autoReady",
  ])
    if (typeof n?.[e] != "boolean")
      throw new Error(`本地游戏设置 ${e} 必须是布尔值。`);
  if (
    (["bgmVolume", "fxVolume"].forEach((e) => {
      const t = n[e];
      if (!Number.isFinite(t) || t < 0 || t > 1)
        throw new Error(`本地游戏设置 ${e} 必须在 0 到 1 之间。`);
    }),
    typeof n.mainMenuBgmPath != "string" ||
      (n.mainMenuBgmPath !== "" &&
        !/^sound_\/bgm\/[-\w]+\/[-\w]+\.ogg$/.test(n.mainMenuBgmPath)))
  )
    throw new Error("本地游戏设置 mainMenuBgmPath 无效。");
  (ta0(n.keyMap), aa0(n.gamepadMap));
}
const ha0 = {
    steam: 22,
    forest: 1,
    desert: 2,
    village: 3,
    ice: 4,
    tomb: 5,
    mine: 6,
    northeu: 7,
    factory: 8,
    pirate: 9,
    fairy: 10,
    moonhill: 11,
    gold: 12,
    china: 13,
    castle: 14,
    nymph: 15,
    mechanic: 16,
    xyy: 17,
    wkc: 18,
    brodi: 19,
    park: 20,
    beach: 21,
    transFormer: 23,
    jurassic: 24,
    world: 25,
    nemo: 26,
    sword: 27,
    god: 28,
    abyss: 29,
    camelot: 30,
    olympos: 31,
    korea: 32,
    mabi: 33,
    maple: 34,
    fengshen: 35,
  },
  da0 = new Map([
    ["gold_S02", 457835184],
    ["gold_S01", 461767354],
    ["", 65536],
  ]);
function IP(n) {
  const e = ha0[n.theme];
  if (e === void 0) throw new Error(`P3528 收藏赛道主题无法解析：${n.theme}`);
  return { themeId: e, trackId: fa0(n.id) };
}
function fa0(n) {
  const e = da0.get(n);
  if (e !== void 0) return e;
  const t = new Uint8Array(n.length * 2),
    i = new DataView(t.buffer);
  for (let o = 0; o < n.length; o++) i.setUint16(o * 2, n.charCodeAt(o), !0);
  const r = Dt(t),
    s = r === 0 ? 1 : r === 4294967295 ? 2 : r;
  return s < 65536 ? s + 65536 : s;
}
function nT(n, e) {
  return new Set(
    e
      .filter((t) => {
        const i = IP(t);
        return n.some(
          (r) => r.themeId === i.themeId && r.trackId === i.trackId,
        );
      })
      .map((t) => t.id),
  );
}
const C4 = "国服",
  Qd = ["国服", "国服复古", "韩服复古"],
  pa0 = [4, 7],
  ga0 = 7,
  ze = "国服",
  E4 = 7;
function Ue(n) {
  const e = n.version ?? ze,
    t = n.settingSpeed ?? E4;
  return e === ze && t === E4 ? n.speed : t;
}
function kP(n) {
  return (n.version ?? ze) === ze && (n.settingSpeed ?? E4) === E4;
}
function y6(n) {
  return $v(n.version ?? ze, Ue(n));
}
const LP = "缺少该版本的速度参数。",
  PP = {
    国服: [7, 6, 3, 0, 1, 2],
    国服复古: [0, 1, 2, 3, 4, 5],
    韩服复古: [0, 1, 2, 3, 4, 5],
  },
  FP = Uv(C4),
  ma0 = pa0.filter((n) => !PP[C4].includes(n)).map((n) => DP(C4, n));
function Di(n) {
  return n === C4 ? FP : Uv(n);
}
function zv(n, e) {
  return (n === C4 ? [...FP, ...ma0] : Uv(n)).find((i) => i.speed === e);
}
function Ac(n) {
  const e = Di(n);
  return e.some((t) => t.available)
    ? { version: n, available: !0 }
    : {
        version: n,
        available: !1,
        unavailableReason: e[0]?.unavailableReason ?? LP,
      };
}
function Uv(n) {
  const e = PP[n];
  if (!e) throw new Error(`速度版本 ${n} 没有档位顺序表。`);
  return e.map((t) => DP(n, t));
}
function DP(n, e) {
  const i = II(n, e) !== void 0;
  return {
    speed: e,
    label: va0(n, e),
    available: i,
    ...(i ? {} : { unavailableReason: LP }),
  };
}
function wa0(n) {
  return Di(n).find((e) => e.available);
}
function $v(n, e) {
  const t = zv(n, e);
  if (!t) throw new Error(`${n} 的速度频道未收录速度 ${e}。`);
  if (!t.available)
    throw new Error(`${n} 的速度 ${e} 不可选：${t.unavailableReason ?? ""}`);
  return t.speed;
}
function VP(n, e) {
  return n.label.kind === "literal" ? n.label.text : e(`#sb(${n.label.key})`);
}
function va0(n, e) {
  return n !== C4
    ? { kind: "literal", text: iT(n, e) }
    : [4, 6, 7].includes(e)
      ? { kind: "string", key: `speedS${e}` }
      : { kind: "literal", text: iT(n, e) };
}
function iT(n, e) {
  const t = i3[n],
    i = Object.keys(t).find((r) => t[r] === e);
  if (i === void 0)
    throw new Error(`速度 ${e} 在 ${n} 的速度频道表里没有名字。`);
  return i;
}
function ya0(n, e) {
  return {
    x: Math.trunc(n.x * e.a + e.e),
    y: Math.trunc(n.y * e.d + e.f),
    width: Math.max(1, Math.trunc(n.width * e.a)),
    height: Math.max(1, Math.trunc(n.height * e.d)),
  };
}
function NP(n, e, t, i) {
  const r = ya0(t, e.getTransform());
  ((n.domElement.width !== r.width || n.domElement.height !== r.height) &&
    n.setDrawingBufferSize(r.width, r.height, 1),
    i(),
    e.save());
  try {
    (e.setTransform(1, 0, 0, 1, 0, 0), e.drawImage(n.domElement, r.x, r.y));
  } finally {
    e.restore();
  }
}
const Aa0 = new Set([
    "drawImage",
    "fillRect",
    "fillText",
    "strokeText",
    "fill",
    "stroke",
  ]),
  ba0 = [
    "fillStyle",
    "strokeStyle",
    "font",
    "fontKerning",
    "letterSpacing",
    "textAlign",
    "textBaseline",
    "direction",
    "lineWidth",
    "lineJoin",
    "miterLimit",
    "globalAlpha",
    "globalCompositeOperation",
    "imageSmoothingEnabled",
    "imageSmoothingQuality",
    "shadowBlur",
    "shadowColor",
    "shadowOffsetX",
    "shadowOffsetY",
  ];
