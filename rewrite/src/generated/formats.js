import { rhoAdler32 } from "../codecs/common.ts";
// Generated from the verified KartSim v39.11 release bundle.
// Rebuild with: node tools/generate-modules.mjs
// Stable minified names are retained for behavioral parity.

import { DDSLoader } from "three/addons/loaders/DDSLoader.js";
import { TGALoader } from "three/addons/loaders/TGALoader.js";
import { CanvasHitController } from "../ui/canvas-hit-controller.ts";
import { CameraHeightFollower, DriveCameraController } from "../resources/drive-camera.ts";
import { FloatKeyController } from "../resources/float-key-controller.ts";
import { ColorKeyController } from "../resources/color-key-controller.ts";
import { ToonOutlineController, toonColorFromArgb } from "../resources/toon-outline-controller.ts";
import { ToonOutlineBatch } from "../resources/toon-outline-batch.ts";
import { AwardPodiumScene, loadAwardPodiumScene } from "../resources/award-podium-scene.ts";
import { createToonEnvironmentMaterial } from "../resources/toon-environment-material.ts";
import { createBasicTextureMaterial } from "../resources/basic-texture-material.ts";
import { decodePngRgba } from "../resources/png-decoder.ts";
import { normalizeLegacyTextureAlpha } from "../resources/texture-alpha.ts";
import { buildTrackCourseGraph } from "../resources/track-course-graph.ts";
import { $1, $i, Am, B2, Bl, Cm, D1, D2, D9, F1, GG, Gl, H, Hi, J9, M1, Mm, Nc, ON, Pl, R4, R9, S1, Sm, T2, Tl, VN, Vt, W2, Wi, Y2, Z9, _0, _9, _l, ao, bm, co, e5, e9, h3, h9, ir, l1, l2, lG, me, n5, oo, r1, r9, rG, ra, ro, rr, s1, s5, so, t9, tn, u1, u4, u9, v1, v2, v9, xm, y1, ym, yr, ys } from "./vendor.js";

function cameraMathDependencies() { return {
  f32: n0, floatWord: g1, bodyBasis: kB, clientVector: g4,
  column: Qt, setColumn: zl, normalize: Np, cross: Op, scale: Kc, add: Hb,
  alignMotorcycle: Ej, orientation: LB, orientationDot: da,
  scaleOrientation: ew, smoothOrientation: O6, speed: Ul,
  smoothScalar: qc, clampRatio: bs, basisFromOrientation: PB,
  tiltBasis: _j, outputVector: v8, clientDot: Ou, horizontalFov: we,
  resolutionFov: z6, parseRoadNumber: y8, emptyVector: Bj,
  baseFov: DB, activeFov: VB, altActiveFov: NB, boostFov: OB,
  specialFovLimit: bj, p3528SpecialFovLimit: Mj, near: xj, far: Sj,
}; }
function toonOutlineDependencies() { return {
  defaultProfile: () => kp,
  nextSerial: yb,
  enabled: () => $c,
  projection: {
    generation: () => Lp, prepare: SB, transpose: Fp, multiply: Dp,
    transform: SK, model: Li, combined: Pi, screen: xB, clip: $r,
  },
  update: () => ({
    profileForSelector1: AK, profileForOtherSelector: Xm,
    get defaultProfile() { return kp; },
    get enabled() { return $c; },
    overrideForObject: bK, colorFromArgb: toonColorFromArgb,
    nextSerial: yb,
    projectedDepth: (body, camera) => {
      Mb.setFromMatrixPosition(body.matrixWorld).project(camera);
      return Mb.z;
    },
  }),
}; }
function awardPodiumDependencies() { return {
  makeDistanceController: parsed => on.fromParsed(parsed),
  baseFov: () => z6(0).base,
  horizontalFov: we,
}; }
function awardPodiumLoadDependencies() { return {
  parseModel: y9, loadScene: W1,
  resolveTexture: (library, path, resource) => sn(library, path, void 0, resource),
}; }

function s2(n) {
  const e = new CW(n),
    t = L6(e);
  if (e.remaining !== 0) throw new Error("二进制 XML 尾部包含未解析数据。");
  return t;
}

function L6(n, e = 0, t = { nodes: 0, attributes: 0 }) {
  if (((t.nodes += 1), e > 128 || t.nodes > 1e6))
    throw new Error("二进制 XML 层级或节点数量无效。");
  const i = n.string(),
    r = n.string(),
    s = Mp(n.uint32(), "属性", 1e5);
  if (((t.attributes += s), t.attributes > 1e7))
    throw new Error("二进制 XML 属性总数无效。");
  const o = Array.from({ length: s }, () => ({
      name: n.string(),
      value: n.string(),
    })),
    a = Mp(n.uint32(), "子节点", 1e6),
    c = Array.from({ length: a }, () => L6(n, e + 1, t));
  return { name: i, text: r, attributes: o, children: c };
}

function T(n, e) {
  return n.attributes.find((t) => t.name === e)?.value;
}

function Mp(n, e, t) {
  if (n > t) throw new Error(`二进制 XML ${e}数量无效。`);
  return n;
}

let CW = class {
  constructor(e) {
    ((this.bytes = e),
      (this.view = new DataView(e.buffer, e.byteOffset, e.byteLength)));
  }
  bytes;
  view;
  position = 0;
  get remaining() {
    return this.bytes.length - this.position;
  }
  uint32() {
    this.require(4);
    const e = this.view.getUint32(this.position, !0);
    return ((this.position += 4), e);
  }
  string() {
    const t = Mp(this.uint32(), "字符串", 1e6) * 2;
    this.require(t);
    const i = new TextDecoder("utf-16le", { fatal: !0 }).decode(
      this.bytes.subarray(this.position, this.position + t),
    );
    return ((this.position += t), i);
  }
  require(e) {
    if (
      !Number.isSafeInteger(e) ||
      e < 0 ||
      this.position + e > this.bytes.length
    )
      throw new Error("二进制 XML 数据意外结束。");
  }
};

const EW = new Set(["BH", "MZ", "BS", "JM", "DJ", "DF", "MR", "HW"]);

function VG(n) {
  return n.road.attributes.find((e) => e.name === "surface")?.value;
}

function Ri(n) {
  return n.road.attributes.find((e) => e.name === "rail")?.value;
}

function TW(n) {
  return n.road.attributes.find((e) => e.name === "sound")?.value;
}

function mo(n) {
  return n.road.attributes.some(
    (e) => e.name === "movable" && e.value === "true",
  );
}

function Fl(n, e) {
  const t = OG(n, !0);
  if (t) return t;
  if (!mo(n)) return "road descriptor 不是 movable=true";
  for (let i = e; i; i = i.parent) {
    if (i.node.slotOccurrences?.[1]?.value?.kind === "prs") return;
    if (i.node.slotOccurrences?.[0] || i.node.slotOccurrences?.[2])
      return "movable=true lineage 含未闭合 Vis/Path controller";
    if (
      i.node.className !== "Relement" &&
      i.node.className !== "ReTriList" &&
      i.node.className !== "ReTriStrip"
    )
      return `movable=true lineage 节点类 ${i.node.className} 的 matrix callback 未闭合`;
  }
}

function NG(n, e) {
  return mo(n) ? Fl(n, e) : Vm(n);
}

function Vm(n) {
  return OG(n, !1);
}

function OG(n, e) {
  const t = n.road;
  if (t.text !== "") return "road text 非空";
  if (t.children.length !== 0) return "road 含子节点";
  const i = new Set();
  for (const r of t.attributes) {
    if (i.has(r.name)) return `road 重复属性 ${r.name}`;
    if ((i.add(r.name), r.name === "surface")) {
      const s = _W(r.value);
      if (s) return s;
    } else {
      if (e && r.name === "movable" && r.value === "true") continue;
      if (
        !["alphaBias", "dust", "dustVel", "sound", "soung", "rail"].includes(
          r.name,
        )
      )
        return `road 属性 ${r.name}=${r.value} 尚未接入已证 consumer`;
    }
  }
}

function _W(n) {
  if (
    [
      "bcharge",
      "bcharget",
      "dirt",
      "pit",
      "retire",
      "slip",
      "리셋",
      "점프",
      "촋",
    ].includes(n)
  )
    return;
  const e = n.slice(0, 2);
  if (!EW.has(e)) return `road surface=${n} 尚未接入已证 consumer`;
  if (e === "DJ") {
    const t = n.slice(2).split("/");
    if (t.length < 3 || t.slice(0, 3).some((i) => !KA(i)))
      return `road surface=${n} 的 DJ token 无法安全复现`;
  }
  if (
    (e === "BH" || e === "MZ") &&
    n[4] === "." &&
    (e === "BH" ? [3, 7, 11, 15] : [3, 7, 11]).some(
      (i) => !KA(n.slice(i, i + 3)),
    )
  )
    return `road surface=${n} 的固定宽度 float token 无法安全复现`;
}

function KA(n) {
  return n === "" ? !0 : Number.isFinite(Number.parseFloat(n));
}

const jA = new WeakMap();

function P6(n) {
  return !!(n && typeof n == "object" && n.kind === "prs");
}

function zG() {
  return {
    anchor: 0,
    previousCycle: 0,
    reverseHalf: !1,
    frequencyOverride: 1,
    cycleModeOverride: void 0,
    frozenTime: void 0,
    rangeStart: 0,
    rangeStop: 0,
  };
}

function GW(n, e, t, i) {
  ((e.anchor = Math.trunc(t) >>> 0),
    (e.previousCycle = 0),
    (e.reverseHalf = !1),
    (e.frozenTime = void 0));
  const r = WG(n);
  ((e.rangeStart = n.base.startTimeWord ?? r.start),
    (e.rangeStop = n.base.stopTimeWord ?? r.stop),
    (e.frequencyOverride = 1));
  const s = Math.trunc(i) >>> 0;
  if (s !== 0 && e.rangeStop !== 0) {
    const o = xp(a0(a0((e.rangeStop - e.rangeStart) >>> 0) * n.base.frequency));
    e.frequencyOverride = a0(a0(o) / a0(s));
  }
}

function BW(n, e) {
  n.cycleModeOverride = Math.trunc(e) >>> 0;
}

function RW(n, e, t) {
  if (e.rangeStart === 0 && e.rangeStop === 0) {
    const i = WG(n);
    ((e.rangeStart = n.base.startTimeWord ?? i.start),
      (e.rangeStop = n.base.stopTimeWord ?? i.stop));
  }
  e.frozenTime = Uc(n.base, e, Math.trunc(t) >>> 0, e.rangeStart, e.rangeStop);
}

function Nm(n) {
  const e = (o, a) => {
      if (o)
        return !("records" in o) || ![0, 1, 3].includes(o.type)
          ? `${a} Vec3 keyType ${o.type}`
          : o.records.length === 0
            ? `${a} 不含 key`
            : void 0;
    },
    t = e(n.position, "position");
  if (t) return t;
  const i = e(n.scale, "scale");
  if (i) return i;
  const r = n.rotation;
  if (!r) return fu(n);
  if ("records" in r)
    return r.type !== 1
      ? `rotation keyType ${r.type}`
      : r.records.length === 0
        ? "rotation 不含 key"
        : fu(n);
  if (r.type !== 4) return `rotation composite keyType ${r.type}`;
  const s = r.axes ?? r.components;
  if (!s || s.length !== 3) return "rotation type4 缺少三个 scalar axes";
  for (const o of s) {
    if (o.type !== 0 && o.type !== 3)
      return `rotation scalar keyType ${o.type}`;
    if (o.records.length === 0) return "rotation scalar 不含 key";
  }
  return fu(n);
}

function fu(n) {
  n.position && (QA(n.position), Ls(n.position, n, 0));
  const e = n.rotation;
  (e &&
    ("records" in e ? DW(e) : (e.axes ?? e.components).forEach(VW),
    Ls(e, n, 2)),
    n.scale && (QA(n.scale), Ls(n.scale, n, 4)));
}

function UG() {
  return {
    position: [0, 0, 0],
    basis: [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ],
    scale: [1, 1, 1],
  };
}

function $G(n, e, t, i, r) {
  const s = Math.trunc(i) >>> 0,
    o = IW(e);
  if (o.position) {
    const a = Uc(e.base, t, s, o.rangeP[0], o.rangeP[1]);
    YA(n.position, o.position, a);
  } else ZA(n.position, r.position);
  if (o.rotation) {
    const a = Uc(e.base, t, s, o.rangeR[0], o.rangeR[1]);
    kW(n.basis, o.rotation, a);
  } else FW(n.basis, r.basis);
  if (o.scale) {
    const a = Uc(e.base, t, s, o.rangeS[0], o.rangeS[1]);
    YA(n.scale, o.scale, a);
  } else ZA(n.scale, r.scale);
  return n;
}

const XA = new WeakMap();

function pu(n, e, t) {
  const i = Ls(n, e, t);
  return [i.start, i.stop];
}

function IW(n) {
  let e = XA.get(n);
  if (e) return e;
  const t = (o) => {
      if (!o) return;
      if (!("records" in o))
        throw new Error(`Track PRS Vec3 keyType ${o.type} 尚未映射。`);
      if (![0, 1, 3].includes(o.type))
        throw new Error(`Track PRS Vec3 keyType ${o.type} 尚未映射。`);
      const a = o.records.length,
        c = new Float64Array(a),
        l = new Float32Array(a * 3);
      for (let u = 0; u < a; u += 1) {
        const h = h4(o.records[u]);
        ((c[u] = h.getUint32(0, !0)),
          (l[u * 3] = h.getFloat32(4, !0)),
          (l[u * 3 + 1] = h.getFloat32(8, !0)),
          (l[u * 3 + 2] = h.getFloat32(12, !0)));
      }
      return { type: o.type, times: c, values: l };
    },
    i = (o) => {
      if (o.type !== 0 && o.type !== 3)
        throw new Error(`Track PRS scalar keyType ${o.type} 尚未映射。`);
      const a = o.records.length,
        c = new Float64Array(a),
        l = new Float32Array(a),
        u = new Float32Array(a),
        h = new Float32Array(a);
      for (let d = 0; d < a; d += 1) {
        const f = h4(o.records[d]);
        ((c[d] = f.getUint32(0, !0)),
          (l[d] = f.getFloat32(4, !0)),
          o.type === 0 &&
            ((u[d] = f.getFloat32(8, !0)), (h[d] = f.getFloat32(12, !0))));
      }
      return { type: o.type, times: c, values: l, incoming: u, outgoing: h };
    },
    r = n.rotation;
  let s;
  if (r)
    if ("records" in r) {
      if (r.type !== 1)
        throw new Error(`Track PRS rotation keyType ${r.type} 尚未映射。`);
      const o = r.records.length,
        a = new Float64Array(o),
        c = new Float32Array(o * 4);
      for (let l = 0; l < o; l += 1) {
        const u = h4(r.records[l]);
        ((a[l] = u.getUint32(0, !0)),
          (c[l * 4] = u.getFloat32(4, !0)),
          (c[l * 4 + 1] = u.getFloat32(8, !0)),
          (c[l * 4 + 2] = u.getFloat32(12, !0)),
          (c[l * 4 + 3] = u.getFloat32(16, !0)));
      }
      s = { kind: 2, type: r.type, times: a, values: c };
    } else {
      if (r.type !== 4)
        throw new Error(
          `Track PRS rotation composite keyType ${r.type} 尚未映射。`,
        );
      const o = r.axes ?? r.components;
      if (!o || o.length !== 3)
        throw new Error("Track PRS rotation type4 缺少三个 scalar axes。 ");
      s = { kind: 3, type: 4, axes: o.map(i) };
    }
  return (
    (e = {
      position: t(n.position),
      rotation: s,
      scale: t(n.scale),
      rangeP: n.position ? pu(n.position, n, 0) : [0, 0],
      rangeR: r ? pu(r, n, 2) : [0, 0],
      rangeS: n.scale ? pu(n.scale, n, 4) : [0, 0],
    }),
    XA.set(n, e),
    e
  );
}

function YA(n, e, t) {
  const i = e.times.length,
    r = Om(e.times, i, t),
    s = r,
    o = Math.min(r + 1, i - 1);
  if (s === o || e.type === 3) {
    ((n[0] = e.values[s * 3]),
      (n[1] = e.values[s * 3 + 1]),
      (n[2] = e.values[s * 3 + 2]));
    return;
  }
  const a = zm(e.times[s], e.times[o], t),
    c = a0(1 - a);
  ((n[0] = a0(a0(e.values[s * 3] * c) + a0(e.values[o * 3] * a))),
    (n[1] = a0(a0(e.values[s * 3 + 1] * c) + a0(e.values[o * 3 + 1] * a))),
    (n[2] = a0(a0(e.values[s * 3 + 2] * c) + a0(e.values[o * 3 + 2] * a))));
}

function kW(n, e, t) {
  if (e.kind === 2) {
    const o = e.times.length,
      a = Om(e.times, o, t),
      c = a,
      l = Math.min(a + 1, o - 1);
    c === l
      ? vu(n, [
          e.values[c * 4],
          e.values[c * 4 + 1],
          e.values[c * 4 + 2],
          e.values[c * 4 + 3],
        ])
      : (LW(
          o8,
          e.values[c * 4],
          e.values[c * 4 + 1],
          e.values[c * 4 + 2],
          e.values[c * 4 + 3],
          e.values[l * 4],
          e.values[l * 4 + 1],
          e.values[l * 4 + 2],
          e.values[l * 4 + 3],
          zm(e.times[c], e.times[l], t),
        ),
        vu(n, o8));
    return;
  }
  const i = gu(e.axes[0], t),
    r = gu(e.axes[1], t),
    s = gu(e.axes[2], t);
  (wu(a8, s, 2),
    wu(c8, r, 1),
    eb(o8, a8, c8),
    wu(a8, i, 0),
    eb(c8, o8, a8),
    vu(n, c8));
}

function gu(n, e) {
  const t = n.times.length,
    i = Om(n.times, t, e),
    r = i,
    s = Math.min(i + 1, t - 1);
  if (r === s || n.type === 3) return n.values[r];
  const o = zm(n.times[r], n.times[s], e),
    a = a0(n.values[s] - n.values[r]);
  let c = a0(a0(a0(n.outgoing[r] + n.incoming[s]) - a0(2 * a)));
  return (
    (c = a0(
      a0(c * o) + a0(a0(3 * a) - a0(a0(2 * n.outgoing[r]) + n.incoming[s])),
    )),
    (c = a0(a0(c * o) + n.outgoing[r])),
    a0(a0(c * o) + n.values[r])
  );
}

function Om(n, e, t) {
  if (e === 0) throw new Error("Track PRS track 不含 key。 ");
  let i = 0;
  for (; i + 1 < e && t > n[i + 1];) i += 1;
  return i;
}

function LW(n, e, t, i, r, s, o, a, c, l) {
  const u = a0(a0(a0(a0(o * t) + a0(s * e)) + a0(i * a)) + a0(r * c));
  let h = a0(1 - a0(u * a0(0.82279688)));
  h = a0(a0(h * h) * a0(0.58549219));
  let d;
  if (l > 0.5) {
    const v = a0(1 - l);
    d = a0(1 - a0(a0(a0(a0(a0(v + v) - 3) * a0(h * v)) + 1 + h) * v));
  } else d = a0(a0(a0(a0(a0(l + l) - 3) * a0(h * l)) + 1 + h) * l);
  ((n[0] = a0(a0(s - e) * d + e)),
    (n[1] = a0(a0(o - t) * d + t)),
    (n[2] = a0(a0(a - i) * d + i)),
    (n[3] = a0(a0(c - r) * d + r)));
  const f = a0(a0(a0(n[0] * n[0] + n[1] * n[1]) + n[2] * n[2]) + n[3] * n[3]);
  let p = a0(a0(f - a0(0.95906597)) * a0(-0.53251559) + a0(1.0214351));
  (f <= a0(0.91521198) &&
    ((p = JA(f, p)), f <= a0(0.6521197) && (p = JA(f, p))),
    (n[0] = a0(n[0] * p)),
    (n[1] = a0(n[1] * p)),
    (n[2] = a0(n[2] * p)),
    (n[3] = a0(n[3] * p)));
}

function PW(n, e, t, i) {
  return $G(UG(), n, e, t, i);
}

function ZA(n, e) {
  ((n[0] = e[0]), (n[1] = e[1]), (n[2] = e[2]));
}

function FW(n, e) {
  for (let t = 0; t < 3; t += 1)
    ((n[t][0] = e[t][0]), (n[t][1] = e[t][1]), (n[t][2] = e[t][2]));
}

function Uc(n, e, t, i, r) {
  if (e.frozenTime !== void 0) return e.frozenTime;
  ((e.rangeStart = i),
    (e.rangeStop = r),
    e.anchor === 0 && t !== 0 && (e.anchor = t));
  const s = (e.anchor + n.phaseWord) >>> 0;
  let o = t < s ? 0 : (t + n.phaseWord - e.anchor) >>> 0;
  const a =
    nb(e.frequencyOverride) === 1065353216 ? n.frequency : e.frequencyOverride;
  nb(a) !== 1065353216 && (o = xp(a0(a0(o) * a)));
  const c = xp(a0(a0((r - i) >>> 0) * a));
  if (c === 0) return o;
  const l = e.cycleModeOverride ?? n.cycleMode;
  if (l === 0) return ((o % c) + i) >>> 0;
  if (l === 1) {
    const u = Math.floor(o / c) >>> 0;
    (u !== e.previousCycle && (e.reverseHalf = !e.reverseHalf),
      (e.previousCycle = u));
    const h = o % c;
    return e.reverseHalf ? (c - h) >>> 0 : h;
  }
  return l === 2 ? (o < i ? i : o > r ? r : o) : t;
}

function WG(n) {
  const e = n.scale ? 4 : n.rotation ? 2 : 0,
    t = n.scale ?? n.rotation ?? n.position;
  return t ? Ls(t, n, e) : { start: 0, stop: 0 };
}

const mu = { start: 0, stop: 0 };

function Ls(n, e, t) {
  const i = F6(n);
  if (i.range) return i.range;
  const r =
    "records" in n
      ? n.records
      : (n.axes ?? n.components ?? []).flatMap((o) => o.records);
  if (r.length === 0)
    return (
      (mu.start = e.firstLastCache[t]),
      (mu.stop = e.firstLastCache[t + 1]),
      mu
    );
  const s = r.map((o) => h4(o).getUint32(0, !0));
  return (i.range = { start: Math.min(...s), stop: Math.max(...s) });
}

function F6(n) {
  let e = jA.get(n);
  return (e || ((e = {}), jA.set(n, e)), e);
}

function QA(n) {
  const e = F6(n);
  return (e.vec3 ??= n.records.map((t) => {
    const i = h4(t);
    return {
      time: i.getUint32(0, !0),
      value: [i.getFloat32(4, !0), i.getFloat32(8, !0), i.getFloat32(12, !0)],
    };
  }));
}

function DW(n) {
  const e = F6(n);
  return (e.rotation ??= n.records.map((t) => {
    const i = h4(t);
    return {
      time: i.getUint32(0, !0),
      value: [
        i.getFloat32(4, !0),
        i.getFloat32(8, !0),
        i.getFloat32(12, !0),
        i.getFloat32(16, !0),
      ],
    };
  }));
}

function VW(n) {
  const e = F6(n);
  return (e.scalar ??= n.records.map((t) => {
    const i = h4(t);
    return {
      time: i.getUint32(0, !0),
      value: i.getFloat32(4, !0),
      incoming: n.type === 0 ? i.getFloat32(8, !0) : 0,
      outgoing: n.type === 0 ? i.getFloat32(12, !0) : 0,
    };
  }));
}

function zm(n, e, t) {
  const i = (e - n) >>> 0;
  return i === 0 ? 0 : a0(a0((t - n) >>> 0) / a0(i));
}

const o8 = [0, 0, 0, 0],
  a8 = [0, 0, 0, 0],
  c8 = [0, 0, 0, 0];

function JA(n, e) {
  return a0(
    e *
      a0(
        a0(a0(a0(e * e) * n) - a0(0.95906597)) * a0(-0.53251559) +
          a0(1.0214351),
      ),
  );
}

function wu(n, e, t) {
  const i = a0(e * 0.5);
  ((n[0] = a0(Math.cos(i))),
    (n[1] = 0),
    (n[2] = 0),
    (n[3] = 0),
    (n[t + 1] = a0(Math.sin(i))));
}

function eb(n, e, t) {
  const [i, r, s, o] = e,
    [a, c, l, u] = t,
    h = a0(a0(a0(a0(i * a) - a0(r * c)) - a0(s * l)) - a0(o * u)),
    d = a0(a0(a0(a0(i * c) + a0(r * a)) + a0(s * u)) - a0(o * l)),
    f = a0(a0(a0(a0(i * l) - a0(r * u)) + a0(s * a)) + a0(o * c)),
    p = a0(a0(a0(a0(i * u) + a0(r * l)) - a0(s * c)) + a0(o * a));
  ((n[0] = h), (n[1] = d), (n[2] = f), (n[3] = p));
}

function vu(n, [e, t, i, r]) {
  ((n[0][0] = a0(1 - a0(2 * a0(a0(i * i) + a0(r * r))))),
    (n[0][1] = a0(2 * a0(a0(t * i) - a0(e * r)))),
    (n[0][2] = a0(2 * a0(a0(t * r) + a0(e * i)))),
    (n[1][0] = a0(2 * a0(a0(t * i) + a0(e * r)))),
    (n[1][1] = a0(1 - a0(2 * a0(a0(t * t) + a0(r * r))))),
    (n[1][2] = a0(2 * a0(a0(i * r) - a0(e * t)))),
    (n[2][0] = a0(2 * a0(a0(t * r) - a0(e * i)))),
    (n[2][1] = a0(2 * a0(a0(i * r) + a0(e * t)))),
    (n[2][2] = a0(1 - a0(2 * a0(a0(t * t) + a0(i * i))))));
}

function h4(n) {
  return new DataView(n.buffer, n.byteOffset, n.byteLength);
}

const tb = new DataView(new ArrayBuffer(4));

function nb(n) {
  return (tb.setFloat32(0, n, !0), tb.getUint32(0, !0));
}

function xp(n) {
  if (!Number.isFinite(n) || n < 0 || n > 4294967296)
    throw new Error(`Track PRS u32 conversion 越界：${n}。`);
  return Math.trunc(a0(n)) >>> 0;
}

function a0(n) {
  return Math.fround(n);
}

class NW {
  constructor(e, t, i, r) {
    ((this.bindings = e),
      (this.renderRoot = t),
      (this.velFactor = i),
      (this.pressMode = r));
  }
  bindings;
  renderRoot;
  velFactor;
  pressMode;
  lastUpdateMs = 0;
  center = { x: 0, y: 0, z: 0 };
  radius = 0;
  currentTriangles = [];
  update(e, t, i, r) {
    const s = Math.trunc(e) >>> 0,
      o = (c) => {
        const l = t(c);
        if (!l)
          throw new Error(
            `${c.name || c.className} 缺少上一轮 scene world matrix。`,
          );
        return l;
      },
      a = i(this.renderRoot);
    if (!a)
      throw new Error(
        `${this.renderRoot.name} 缺少上一轮 scene world bounds。`,
      );
    return (
      (this.radius = OW(a)),
      this.lastUpdateMs === 0 && (this.lastUpdateMs = s),
      this.shouldThrottle(s, r)
        ? this.currentTriangles
        : this.updateTriangles(s, o)
    );
  }
  shouldThrottle(e, t) {
    if (!t || (e - this.lastUpdateMs) >>> 0 >= 333) return !1;
    const i = L0(L0(this.radius * 4) + 10),
      r = L0(this.center.x - t.x),
      s = L0(this.center.y - t.y),
      o = L0(this.center.z - t.z);
    return L0(L0(L0(r * r) + L0(o * o)) + L0(s * s)) > L0(i * i);
  }
  updateTriangles(e, t) {
    const i = (e - this.lastUpdateMs) >>> 0,
      r = this.bindings.map((o) => {
        const a = t(o.node),
          c = e3(o.localA, a),
          l = e3(o.localB, a),
          u = e3(o.localC, a);
        o.normal = $W(c, l, u) ?? o.normal;
        const h = WW(c, l, u);
        return (
          o.previousCenter &&
            i !== 0 &&
            (o.motion = {
              x: L0(L0(L0(h.x - o.previousCenter.x) * 1e3) / L0(i)),
              y: L0(L0(L0(h.y - o.previousCenter.y) * 1e3) / L0(i)),
              z: L0(L0(L0(h.z - o.previousCenter.z) * 1e3) / L0(i)),
            }),
          (o.previousCenter = h),
          {
            a: c,
            b: l,
            c: u,
            normal: o.normal,
            motion: o.motion,
            velFactor: this.velFactor,
            pressMode: this.pressMode,
          }
        );
      }),
      s = this.bindings.map((o) => o.previousCenter);
    if (((this.center = { x: 0, y: 0, z: 0 }), s.length > 0)) {
      const o = L0(s.length);
      this.center = {
        x: L0(s.reduce((a, c) => L0(a + c.x), 0) / o),
        y: L0(s.reduce((a, c) => L0(a + c.y), 0) / o),
        z: L0(s.reduce((a, c) => L0(a + c.z), 0) / o),
      };
    }
    return ((this.lastUpdateMs = e), (this.currentTriangles = r), r);
  }
  updateSnapshot() {
    return this.currentTriangles;
  }
  registrationCenter() {
    return this.center;
  }
  modelRadius() {
    return this.radius;
  }
}

function Um(n) {
  if (zW(n.property) !== "obstacle")
    return { status: "block", reason: "not-obstacle" };
  if (!UW(n.object))
    return { status: "block", reason: "nested object 不是 Relement" };
  const e = [];
  let t,
    i = !1,
    r;
  const s = new Set(),
    o = (u, h, d) => {
      const f = u.slotOccurrences[1];
      if (f)
        if (!P6(f.value)) t ??= `${u.name || u.className} PRS 类型不受支持`;
        else {
          const y = Nm(f.value);
          y ? (t ??= `${u.name || u.className} ${y}`) : (i = !0);
        }
      const p = u.additionalProperty;
      p &&
        (["effect", "gravity", "inv", "ob", "scale"].forEach((y) => {
          l8(p, y) && s.add(y);
        }),
        l8(p, "press")
          ? (r = "directional")
          : l8(p, "press100") && (r = "hard-stop"));
      const v = u.slotOccurrences[4]?.value,
        w = v?.kind === "backface" && v.cull !== void 0 ? v.cull : d;
      if (h && (u.className === "ReTriList" || u.className === "ReTriStrip")) {
        const y = u.vertexData;
        if (!y?.positions)
          t ??= `${u.name || u.className} obstacle geometry 缺少 positions`;
        else {
          const b = (A, x, M) => {
            if (A === x || x === M || A === M) return;
            let E = x,
              _ = M;
            w === 3 && ([E, _] = [_, E]);
            const C = y.positions[A],
              S = y.positions[E],
              G = y.positions[_];
            if (!C || !S || !G) {
              t ??= `${u.name || u.className} obstacle index 越界`;
              return;
            }
            e.push({
              node: u,
              localA: C,
              localB: S,
              localC: G,
              normal: { x: 0, y: 0, z: 0 },
              motion: { x: 0, y: 0, z: 0 },
            });
          };
          if (u.className === "ReTriList")
            for (let A = 0; A + 2 < y.indices.length; A += 3)
              b(y.indices[A], y.indices[A + 1], y.indices[A + 2]);
          else
            for (let A = 0; A + 2 < y.indices.length; A += 1)
              b(
                A % 2 === 0 ? y.indices[A] : y.indices[A + 1],
                A % 2 === 0 ? y.indices[A + 1] : y.indices[A],
                y.indices[A + 2],
              );
        }
      }
      const g = !!(p && l8(p, "ob"));
      u.children.forEach((y) => o(y, g, w));
    };
  if ((o(n.object, !1, 2), t)) return { status: "block", reason: t };
  const c = n.property?.children
      .find((u) => wo(u.name, "object"))
      ?.attributes.find((u) => wo(u.name, "velFactor"))?.value,
    l = c === void 0 ? 1 : Number.parseFloat(c);
  return Number.isFinite(l)
    ? {
        status: "admit",
        animator: new NW(e, n.object, L0(l), r),
        renderRoot: n.object,
        hasPrs: i,
        pressMode: r,
        collisionTriangleCount: e.length,
        markerProfile: [...s].sort(),
      }
    : { status: "block", reason: `velFactor=${c} 无效` };
}

function OW(n) {
  if (n.kind !== "ordinary")
    return { canonical: 0, invalid: 1 / 0, "non-finite": NaN }[n.kind];
  const e = n.max.map((i, r) => L0(i - L0(L0(n.min[r] + i) * 0.5))),
    t = L0(L0(L0(e[0] * e[0]) + L0(e[1] * e[1])) + L0(e[2] * e[2]));
  return L0(Math.sqrt(t));
}

function zW(n) {
  const t = n?.children
    .find((r) => wo(r.name, "object"))
    ?.attributes.find((r) => wo(r.name, "type"))?.value;
  if (t === void 0) return;
  const i = t.indexOf("\0");
  return t.slice(0, i < 0 ? t.length : i);
}

function l8(n, e) {
  return n.children.find((t) => wo(t.name, e));
}

function wo(n, e) {
  const t = n.indexOf("\0");
  return n.slice(0, t < 0 ? n.length : t) === e;
}

function UW(n) {
  return !!(n && typeof n == "object" && n.kind === "node");
}

function e3(n, e) {
  const t = L0(yu(e[0], n[0], e[4], n[1], e[8], n[2]) + e[12]),
    i = L0(yu(e[1], n[0], e[5], n[1], e[9], n[2]) + e[13]),
    r = L0(yu(e[2], n[0], e[6], n[1], e[10], n[2]) + e[14]);
  return { x: t, y: r, z: L0(-i) };
}

function yu(n, e, t, i, r, s) {
  return L0(L0(L0(n * e) + L0(t * i)) + L0(r * s));
}

function $W(n, e, t) {
  const i = { x: L0(e.x - n.x), y: L0(e.y - n.y), z: L0(e.z - n.z) },
    r = { x: L0(t.x - n.x), y: L0(t.y - n.y), z: L0(t.z - n.z) },
    s = {
      x: L0(L0(i.y * r.z) - L0(i.z * r.y)),
      y: L0(L0(i.z * r.x) - L0(i.x * r.z)),
      z: L0(L0(i.x * r.y) - L0(i.y * r.x)),
    },
    o = L0(Math.sqrt(L0(L0(L0(s.x * s.x) + L0(s.z * s.z)) + L0(s.y * s.y))));
  if (o > 0) return { x: L0(s.x / o), y: L0(s.y / o), z: L0(s.z / o) };
}

function WW(n, e, t) {
  const i = L0(0.3333300054);
  return {
    x: L0(L0(L0(n.x + e.x) + t.x) * i),
    y: L0(L0(L0(n.y + e.y) + t.y) * i),
    z: L0(L0(L0(n.z + e.z) + t.z) * i),
  };
}

function L0(n) {
  return Math.fround(n);
}

const HW = 18346,
  qW = 18363,
  KW = 10154,
  jW = 10171,
  a9 = {
    TrackContainer: 687408536,
    Relement: 235340604,
    ReTriStrip: 352060408,
    ReTriList: 282329986,
    ReToonRigid: 422184006,
    ReBillboard: 413074498,
    ReCamera: 217187072,
    TrackObject: 424870988,
    ToRoad: 131990089,
    TexProperty: 444138646,
    AlphaProperty: 593036619,
    BackFaceProperty: 842597957,
    MtlProperty: 441844882,
    ZBufProperty: 501810396,
    WireProperty: 525010172,
    ToonProperty: 530318597,
    PrsController: 575341866,
    VisController: 621610343,
    FloatController: 805242411,
    IntController: 615187808,
    ColorController: 812058164,
    MorphController: 820577851,
    FogProperty: 430572673,
    ToDummy: 178782927,
    ToBlackPlane: 486016144,
    ToMesh: 131334736,
    ToEventMesh: 425395282,
    ToMinimap: 289407886,
    ToItemCube: 347472849,
    ToLucci: 177078963,
    ToMovableObject: 778110432,
    PathController: 706020803,
    TontrollerGroup: 833422914,
  };

function XW(n) {
  const e = {};
  if (n.kind !== "track") return e;
  const t = n.trackObjects.find((a) => Wn(a.name, "track")),
    i = (a, c) => {
      const l = a?.attributes.find((h) => h.name === c)?.value;
      if (l === void 0) return;
      const u = Number(l);
      return Number.isFinite(u) ? u : void 0;
    },
    r = t?.property?.children.find((a) => a.name === "camera"),
    s = i(r, "far");
  s !== void 0 && s > 0 && (e.cameraFar = s);
  const o = t?.property?.children.find((a) => a.name === "fog");
  if (o) {
    const a = i(o, "mode"),
      c = i(o, "r"),
      l = i(o, "g"),
      u = i(o, "b");
    a !== void 0 &&
      c !== void 0 &&
      l !== void 0 &&
      u !== void 0 &&
      (e.fog = {
        mode: a,
        r: c,
        g: l,
        b: u,
        start: i(o, "start"),
        end: i(o, "end"),
        density: i(o, "density"),
      });
  }
  return e;
}

function y9(n) {
  const e = new ZH(n),
    i = dH().readObjectOccurrence(e),
    r = i.value;
  if (!Hm(r) && !Wm(r))
    throw new Error(".1s 根对象不是 TrackContainer 或 Relement。");
  if (e.remaining !== 0)
    throw new Error(`.1s 根对象后剩余 ${e.remaining} 字节。`);
  return { root: r, rootOccurrence: i, settings: XW(r) };
}

function YW(n, e = "strict", t = {}) {
  if (!Hm(n.root))
    throw new Error("standalone Relement .1s 不含 TrackContainer 路线数据。");
  const i = qG(n.root.scene);
  if (i.triangles.length + i.deferredTriangles.length === 0)
    throw new Error("track.1s 不含原版 <property><road/> 碰撞数据。");
  const r = JW(n.root.trackObjects, t.forceReverse === !0);
  return {
    containerName: n.root.name,
    collisionTriangles: i.triangles,
    deferredRoadTriangles: i.deferredTriangles,
    roadIssues: i.issues,
    runtimeIssues: ZW(n, e),
    collisionStats: i.stats,
    sections: r.sections,
    firstSection: r.firstSection,
    lastSection: r.lastSection,
    start: r.start,
  };
}

function ZW(n, e = "strict") {
  if (!Hm(n.root)) return [];
  const t = [];
  for (const i of n.root.trackObjects) {
    if (i.kind === "TrackObject") {
      i.name !== "track" &&
        t.push(
          `TrackObject ${i.name || "<unnamed>"} 的 runtime consumer 尚未闭合`,
        );
      continue;
    }
    if (
      i.kind === "ToRoad" ||
      i.kind === "ToDummy" ||
      i.kind === "ToBlackPlane" ||
      i.kind === "ToMinimap" ||
      (Au(e) && i.kind === "ToItemCube")
    )
      continue;
    if (i.kind !== "ToMovableObject") {
      t.push(`${i.kind} ${i.name || "<unnamed>"} 的 runtime consumer 尚未闭合`);
      continue;
    }
    const r = i.property?.children.find((l) => Wn(l.name, "object"));
    if (Au(e) && HG(i)) continue;
    const s = r?.attributes.find((l) => Wn(l.name, "type"))?.value,
      o = s?.indexOf("\0") ?? -1,
      a = s === void 0 ? void 0 : s.slice(0, o < 0 ? s.length : o);
    if (Au(e) && a === "itemCube") continue;
    const c =
      s && Wn(s, "obstacle")
        ? "obstacle"
        : s && Wn(s, "event")
          ? "event"
          : void 0;
    if (!(c === "obstacle" && e === "time-attack" && Um(i).status === "admit"))
      if (c)
        t.push(
          `ToMovableObject ${i.name || `#${i.instanceOrdinal}`} 的 object type=${c} 尚未接入 M5 runtime`,
        );
      else {
        const l = a ?? "<missing>";
        t.push(
          `ToMovableObject ${i.name || `#${i.instanceOrdinal}`} 的 object type=${l || "<empty>"} consumer 尚未闭合`,
        );
      }
  }
  return t;
}

function HG(n) {
  const t = n.property?.children
    .find((i) => Wn(i.name, "object"))
    ?.attributes.find((i) => Wn(i.name, "onlyItemGame"))?.value;
  return t !== void 0 && Wn(t.toLowerCase(), "true");
}

function Au(n) {
  return n === "speed-individual" || n === "time-attack";
}

function Wn(n, e) {
  const t = n.indexOf("\0");
  return n.slice(0, t < 0 ? n.length : t) === e;
}



function JW(objects, forceReverse) { return buildTrackCourseGraph(objects, forceReverse); }



















function d4(n, e) {
  return [
    Math.fround(n[0] - e[0]),
    Math.fround(n[1] - e[1]),
    Math.fround(n[2] - e[2]),
  ];
}

function Ii(n, e) {
  return [
    Math.fround(n[0] + e[0]),
    Math.fround(n[1] + e[1]),
    Math.fround(n[2] + e[2]),
  ];
}

function Zt(n, e) {
  return [Math.fround(n[0] * e), Math.fround(n[1] * e), Math.fround(n[2] * e)];
}

function Cp(n, e) {
  return [
    Math.fround(Math.fround(n[1] * e[2]) - Math.fround(n[2] * e[1])),
    Math.fround(Math.fround(n[2] * e[0]) - Math.fround(n[0] * e[2])),
    Math.fround(Math.fround(n[0] * e[1]) - Math.fround(n[1] * e[0])),
  ];
}

function cr(n) {
  const e = Math.fround(
      Math.fround(Math.fround(n[0] * n[0]) + Math.fround(n[1] * n[1])) +
        Math.fround(n[2] * n[2]),
    ),
    t = Math.fround(Math.sqrt(e));
  return t !== 0 ? n.map((i) => Math.fround(i / t)) : [1, 1, 1];
}

function qG(n) {
  const e = [],
    t = [],
    i = [],
    r = [],
    s = new Set(),
    o = {
      roadMeshCount: 0,
      ownRoadMeshCount: 0,
      expandedTriangleCount: 0,
      registeredTriangleCount: 0,
      admittedTriangleCount: 0,
      deferredTriangleCount: 0,
      reversedTriangleCount: 0,
      roadMeshNames: [],
    },
    a = (c, l, u, h, d) => {
      const f = { node: c, parent: d },
        p = lH(l, cH(c));
      let v = u,
        w = !1;
      const g = UH(c);
      if (g) {
        const A = g.value.propertyOccurrence,
          x =
            A?.value.name === "property"
              ? A.value.children.find((M) => M.name === "road")
              : void 0;
        ((v =
          x && A
            ? { texture: g, property: A, road: x, declaredAt: f }
            : void 0),
          (w = v !== void 0));
      }
      const y = $H(c)?.cull ?? h,
        b = HH(c);
      if (
        (v &&
          !b &&
          (c.vertexData || c.rigidGeometry) &&
          i.push({
            descriptor: v,
            mesh: f,
            reason: `road mesh class ${c.className} 不是 ReTriList/ReTriStrip`,
          }),
        v && b)
      ) {
        (r.push({ descriptor: v, mesh: f }),
          (o.roadMeshCount += 1),
          w && (o.ownRoadMeshCount += 1));
        const A = v.property.encoding === "reference" ? "ref" : "new";
        o.roadMeshNames.push(`${w ? A : "inherited"}:${c.name}`);
        const x = uH(b.positions, p),
          M = b.indices,
          E = Vm(v);
        E &&
          !s.has(v) &&
          (s.add(v), i.push({ descriptor: v, mesh: f, reason: E }));
        const _ = (C, S, G) => {
          if (b.kind === "strip" && (C === S || S === G || C === G)) return;
          let I = S,
            L = G;
          ((o.expandedTriangleCount += 1),
            y === 3 && (([I, L] = [L, I]), (o.reversedTriangleCount += 1)));
          const k = x[C],
            D = x[I],
            V = x[L];
          if (!k || !D || !V)
            throw new Error(`${c.name} 的原版 road 索引越界。`);
          if (
            ![k, D, V].every(
              (q) => q[0] >= 0 && q[0] < 2e3 && q[1] >= 0 && q[1] < 2e3,
            )
          )
            return;
          const K = hH(k, D, V);
          if (!K) return;
          const P = {
            a: ne(k),
            b: ne(D),
            c: ne(V),
            normal: ne(K),
            auxiliaryDirection: aH(v, b.uvs, k, D, V, C, I, L),
            roadDescriptor: v,
            origin: { mesh: f, localIndices: [C, I, L] },
          };
          (E
            ? (t.push(P), (o.deferredTriangleCount += 1))
            : (e.push(P), (o.admittedTriangleCount += 1)),
            (o.registeredTriangleCount += 1));
        };
        if (b.kind === "list")
          for (let C = 0; C + 2 < M.length; C += 3) _(M[C], M[C + 1], M[C + 2]);
        else
          for (let C = 0; C + 2 < M.length; C += 1) {
            const S = C % 2 === 0;
            _(S ? M[C] : M[C + 1], S ? M[C + 1] : M[C], M[C + 2]);
          }
      }
      c.children.forEach((A) => a(A, p, v, y, f));
    };
  return (
    a(n, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0], void 0, 2),
    {
      triangles: e,
      deferredTriangles: t,
      issues: i,
      descriptorUses: r,
      stats: o,
    }
  );
}

function aH(n, e, t, i, r, s, o, a) {
  const c = [0, 0, 1],
    l = VG(n);
  if (!l || l.length <= 3 || (l.slice(0, 2) !== "BS" && l.slice(0, 2) !== "JM"))
    return ne(c);
  const u = e[s],
    h = e[o],
    d = e[a];
  if (!u || !h || !d) return ne(c);
  const f = (E, _) => [Math.fround(E[0] - _[0]), Math.fround(E[1] - _[1])],
    p = f(h, u),
    v = f(d, u),
    w = f(d, h),
    g = d4(i, t),
    y = d4(r, t),
    b = d4(r, i),
    A = Math.fround(v[0] - p[0]),
    x = Math.fround(9999999747378752e-21);
  let M;
  if (A <= x && A >= -x) M = w[0] < 0 ? Zt(b, -1) : b;
  else {
    const E = Math.fround(v[0] / A);
    ((M = Ii(Zt(g, E), Zt(y, Math.fround(1 - E)))),
      Math.fround(v[1] + Math.fround(E * Math.fround(p[1] - v[1]))) < 0 &&
        (M = Zt(M, -1)));
  }
  return ne(Zt(cr(M), -1));
}

function cH(n) {
  const [e, t, i] = n.transform,
    [r, s, o] = n.scale;
  return [
    Math.fround(e[0] * r),
    Math.fround(e[1] * s),
    Math.fround(e[2] * o),
    Math.fround(n.position[0]),
    Math.fround(t[0] * r),
    Math.fround(t[1] * s),
    Math.fround(t[2] * o),
    Math.fround(n.position[1]),
    Math.fround(i[0] * r),
    Math.fround(i[1] * s),
    Math.fround(i[2] * o),
    Math.fround(n.position[2]),
  ];
}

function lH(n, e) {
  const t = new Array(12);
  for (let i = 0; i < 3; i += 1) {
    const r = i * 4;
    for (let s = 0; s < 3; s += 1)
      t[r + s] = Ps(n[r], e[s], n[r + 1], e[4 + s], n[r + 2], e[8 + s]);
    t[r + 3] = Math.fround(
      Ps(n[r], e[3], n[r + 1], e[7], n[r + 2], e[11]) + n[r + 3],
    );
  }
  return t;
}

function uH(n, e) {
  return n.map((t) => [
    Math.fround(Ps(e[0], t[0], e[1], t[1], e[2], t[2]) + e[3]),
    Math.fround(Ps(e[4], t[0], e[5], t[1], e[6], t[2]) + e[7]),
    Math.fround(Ps(e[8], t[0], e[9], t[1], e[10], t[2]) + e[11]),
  ]);
}

function Ps(n, e, t, i, r, s) {
  return Math.fround(
    Math.fround(Math.fround(n * e) + Math.fround(t * i)) + Math.fround(r * s),
  );
}

function hH(n, e, t) {
  return cr(Cp(d4(e, n), d4(t, n)));
}

function dH() {
  const n = new YH();
  return (
    n.register(a9.TrackContainer, fH),
    n.register(a9.Relement, (e, t) => xr(e, t, "Relement")),
    n.register(a9.ReTriList, AH),
    n.register(a9.ReTriStrip, bH),
    n.register(a9.ReToonRigid, MH),
    n.register(a9.ReBillboard, xH),
    n.register(a9.ReCamera, SH),
    n.register(a9.TrackObject, k4),
    n.register(a9.ToRoad, vH),
    n.register(a9.TexProperty, EH),
    n.register(a9.AlphaProperty, TH),
    n.register(a9.BackFaceProperty, _H),
    n.register(a9.MtlProperty, GH),
    n.register(a9.ZBufProperty, BH),
    n.register(a9.WireProperty, RH),
    n.register(a9.ToonProperty, IH),
    n.register(a9.PrsController, kH),
    n.register(a9.VisController, LH),
    n.register(a9.FloatController, PH),
    n.register(a9.IntController, FH),
    n.register(a9.ColorController, DH),
    n.register(a9.MorphController, VH),
    n.register(a9.PathController, NH),
    n.register(a9.TontrollerGroup, (e) => ({
      kind: "tontroller-group",
      value: e.string(),
    })),
    n.register(a9.FogProperty, OH),
    n.register(a9.ToDummy, (e, t) => bu(e, t, "ToDummy")),
    n.register(a9.ToBlackPlane, pH),
    n.register(a9.ToMinimap, gH),
    n.register(a9.ToItemCube, (e, t) => bu(e, t, "ToItemCube", !0)),
    n.register(a9.ToLucci, (e, t) => bu(e, t, "ToLucci", !0)),
    n.register(a9.ToMesh, KG),
    n.register(a9.ToEventMesh, mH),
    n.register(a9.ToMovableObject, wH),
    n
  );
}

function fH(n, e) {
  const t = n.string(),
    i = e.readObjectOccurrence(n),
    r = i.value;
  if (!Wm(r)) throw new Error("TrackContainer 的 scene 不是 Relement。");
  const s = n.count("TrackObject", 1e6),
    o = [];
  let a;
  for (let l = 0; l < s; l += 1) {
    const u = n.isNewObject() ? n.peekUint32(2) : void 0;
    try {
      (o.push(e.readObjectOccurrence(n)), (a = u));
    } catch (h) {
      throw new Error(
        `TrackObject[${l}/${s}] 解析失败（当前=${u?.toString(16) ?? "引用"}，前一个=${a?.toString(16) ?? "无"}）：${h instanceof Error ? h.message : String(h)}`,
      );
    }
  }
  const c = o.map((l) => l.value);
  if (!c.every(KH)) throw new Error("TrackContainer 含无效 TrackObject。");
  return {
    kind: "track",
    name: t,
    scene: r,
    sceneOccurrence: i,
    trackObjects: c,
    trackObjectOccurrences: o,
  };
}

function k4(n, e) {
  const t = n.string(),
    i = n.uint8() ? e.readField(n, $m) : void 0;
  return { kind: "TrackObject", name: t, property: i };
}

function bu(n, e, t, i = !1) {
  const r = k4(n, e),
    s = jG(n);
  return {
    kind: t,
    name: r.name,
    property: r.property,
    transform: s,
    instanceOrdinal: i ? n.uint32() : void 0,
  };
}

function pH(n, e) {
  return {
    ...k4(n, e),
    kind: "ToBlackPlane",
    vertices: [n.vec3(), n.vec3(), n.vec3(), n.vec3()],
    planeNormal: n.vec3(),
    edgeEnabled: [n.uint8(), n.uint8(), n.uint8(), n.uint8()],
  };
}

function gH(n, e) {
  return {
    ...k4(n, e),
    kind: "ToMinimap",
    centerX: n.float32(),
    centerY: n.float32(),
    scale: n.float32(),
    canvasWidth: n.uint32(),
    canvasHeight: n.uint32(),
    padding: n.uint32(),
  };
}

function KG(n, e) {
  const t = k4(n, e),
    i = n.uint16(),
    r = Array.from({ length: i }, () => n.uint16()),
    s = n.uint16(),
    o = a3(n, s);
  return {
    kind: "ToMesh",
    name: t.name,
    property: t.property,
    indices: r,
    positions: o,
  };
}

function mH(n, e) {
  return { ...KG(n, e), kind: "ToEventMesh", eventName: n.string() };
}

function wH(n, e) {
  return {
    ...k4(n, e),
    kind: "ToMovableObject",
    transform: jG(n),
    object: e.readObject(n),
    instanceOrdinal: n.uint32(),
  };
}

function vH(n, e) {
  const t = k4(n, e),
    i = n.uint8() !== 0,
    r = Array.from({ length: n.count("ToRoad 记录", 1e6) }, () => {
      const s = n.string(),
        o = a3(n, n.count("ToRoad 位置", 1e6)),
        a = rb(n, n.count("ToRoad gate", 1e6)),
        c = n.string(),
        l = rb(n, n.count("ToRoad surface", 1e6)),
        u = Array.from({ length: n.count("ToRoad frame", 1e6) }, () => ({
          position: n.vec3(),
          storedForward: n.vec3(),
          up: n.vec3(),
        }));
      return {
        name: s,
        positions: o,
        gateIndices: a,
        surface: c,
        surfaceIndices: l,
        frames: u,
      };
    });
  return {
    kind: "ToRoad",
    name: t.name,
    property: t.property,
    cyclic: i,
    records: r,
  };
}

function rb(n, e) {
  return Array.from({ length: e }, () => [n.uint16(), n.uint16(), n.uint16()]);
}

function jG(n) {
  return {
    basis: [n.vec3(), n.vec3(), n.vec3()],
    position: n.vec3(),
    scale: n.vec3(),
  };
}

function xr(n, e, t) {
  const i = qH(t);
  i.name = n.string();
  const r = n.count("场景子节点", 1e6);
  i.childOccurrences = [];
  for (let s = 0; s < r; s += 1) {
    const o = e.readObjectOccurrence(n),
      a = o.value;
    if (!Wm(a)) throw new Error(`${t} child[${s}] 不是 Relement。`);
    (i.childOccurrences.push(o), i.children.push(a));
  }
  return (yH(n, e, i), i);
}

function yH(n, e, t) {
  ((t.transform = [n.vec3(), n.vec3(), n.vec3()]),
    (t.position = n.vec3()),
    (t.scale = n.vec3()),
    (t.bounds0 = { min: n.vec3(), max: n.vec3() }),
    (t.serializedBoundsOverride = n.uint8()),
    (t.cullingTraversalMode = n.uint32()),
    (t.bounds1 = { min: n.vec3(), max: n.vec3() }),
    (t.rawScalar = n.float32()),
    (t.nodeEnabled = n.uint8()),
    (t.slotOccurrences = Array.from({ length: 11 }, () => vo(n, e))),
    (t.slots = t.slotOccurrences.map((i) => i?.value)),
    n.uint8() !== 0 &&
      ((t.additionalPropertyOccurrence = e.readFieldOccurrence(n, $m)),
      (t.additionalProperty = t.additionalPropertyOccurrence.value)));
}

function AH(n, e) {
  const t = xr(n, e, "ReTriList");
  return (
    (t.sortDepthBias = n.float32()),
    (t.vertexDataOccurrence = e.readFieldOccurrence(n, XG)),
    (t.vertexData = t.vertexDataOccurrence.value),
    t
  );
}

function bH(n, e) {
  const t = xr(n, e, "ReTriStrip");
  return (
    (t.sortDepthBias = n.float32()),
    (t.vertexDataOccurrence = e.readFieldOccurrence(n, XG)),
    (t.vertexData = t.vertexDataOccurrence.value),
    t
  );
}

function MH(n, e) {
  const t = xr(n, e, "ReToonRigid");
  return (
    (t.sortDepthBias = n.float32()),
    (t.rigidGeometryOccurrence = e.readFieldOccurrence(n, CH)),
    (t.rigidGeometry = t.rigidGeometryOccurrence.value),
    t
  );
}

function xH(n, e) {
  const t = xr(n, e, "ReBillboard");
  return ((t.orientationMode = n.uint32()), t);
}

function SH(n, e) {
  const t = xr(n, e, "ReCamera"),
    i = n.uint8(),
    r = n.float32(),
    s = Mu(n, e),
    o = n.float32(),
    a = Mu(n, e),
    c = n.float32(),
    l = Mu(n, e);
  return (
    (t.camera = {
      projectionMode: i,
      fieldOfViewDegrees: r,
      fieldOfViewController: s,
      nearClip: o,
      nearClipController: a,
      farClip: c,
      farClipController: l,
    }),
    t
  );
}

function XG(n, e) {
  const t = n.uint16Count("网格顶点", 65535),
    i = n.uint8() ? a3(n, t) : void 0,
    r = n.uint8() ? a3(n, t) : void 0,
    s = n.uint8() ? Array.from({ length: t }, () => n.uint32()) : void 0,
    o = n.uint16Count("每顶点 UV 集", 16),
    a = Array.from({ length: t }, () =>
      Array.from({ length: o }, () => n.vec2()),
    ),
    c = n.uint8() !== 0 ? e.readObjectOccurrence(n) : void 0,
    l = c?.value,
    u = Array.from({ length: n.uint16Count("网格索引", 65535) }, () =>
      n.uint16(),
    );
  return {
    vertexCount: t,
    positions: i,
    normals: r,
    diffuseColors: s,
    uvSetsPerVertex: o,
    uvs: a,
    property: l,
    propertyOccurrence: c,
    indices: u,
  };
}

function CH(n) {
  const e = a3(n, n.count("Toon 顶点", 1e6)),
    t = a3(n, n.count("Toon 法线", 1e6)),
    i = Array.from({ length: n.count("Toon UV", 1e6) }, () => ({
      rawWord: n.uint16(),
      normalIndex: n.uint16(),
      u: n.float32(),
      v: n.float32(),
    })),
    r = n.count("Toon 面", 1e6),
    s = Array.from({ length: r }, () => ({
      texcoordIndices: [n.uint16(), n.uint16(), n.uint16()],
      adjacentFaceIndices: [n.uint16(), n.uint16(), n.uint16()],
      positionIndices: [n.uint16(), n.uint16(), n.uint16()],
      winding: n.uint8(),
      outlineOpenEdge: n.uint8(),
    }));
  return (
    i.forEach((o, a) => {
      if (o.normalIndex >= t.length)
        throw new Error(`Toon UV ${a} 的法线索引越界。`);
    }),
    s.forEach((o, a) => {
      (o.texcoordIndices.forEach((c) => xu(c, i.length, `Toon 面 ${a} UV`)),
        o.positionIndices.forEach((c) => xu(c, e.length, `Toon 面 ${a} 顶点`)),
        o.adjacentFaceIndices.forEach((c) => {
          c !== 65535 && xu(c, s.length, `Toon 面 ${a} 邻接面`);
        }));
    }),
    { positions: e, normals: t, texcoords: i, faces: s }
  );
}

function EH(n, e) {
  const t = n.uint32(),
    i = n.uint8() ? e.readFieldOccurrence(n, (y) => y.string()) : void 0,
    r = i?.value,
    s = n.uint32(),
    o = n.uint32(),
    a = n.uint32(),
    c = n.uint32(),
    l = n.uint32(),
    u = n.uint32(),
    h = Array.from({ length: 5 }, () => vo(n, e)),
    d = h.map((y) => y?.value),
    f = n.float32(),
    p = vo(n, e),
    v = p?.value;
  let w, g;
  return (
    n.uint8() && ((g = e.readFieldOccurrence(n, $m)), (w = g.value)),
    {
      kind: "texture",
      textureOp: t,
      name: r,
      nameOccurrence: i,
      addressU: s,
      addressV: o,
      minFilter: a,
      magFilter: c,
      mipFilter: l,
      maxAnisotropy: u,
      uvControllers: d,
      uvControllerOccurrences: h,
      scalar: f,
      alphaController: v,
      alphaControllerOccurrence: p,
      property: w,
      propertyOccurrence: g,
    }
  );
}

function TH(n) {
  return {
    kind: "alpha",
    blendEnable: n.uint8(),
    srcBlend: n.uint32(),
    dstBlend: n.uint32(),
    alphaTestEnable: n.uint8(),
    compare: n.uint32(),
    alphaRef: n.uint8(),
  };
}

function _H(n) {
  return { kind: "backface", cull: n.uint32() };
}

function GH(n, e) {
  const t = n.uint32(),
    i = n.uint32(),
    r = n.uint32(),
    s = n.uint32(),
    o = n.float32(),
    a = n.uint8(),
    c = n.uint32(),
    l = Array.from({ length: 4 }, () => vo(n, e)),
    u = l.map((h) => h?.value);
  return {
    kind: "material",
    mode: t,
    ambient: i,
    diffuse: r,
    specular: s,
    power: o,
    reserved: a,
    emissive: c,
    controllers: u,
    controllerOccurrences: l,
  };
}

function BH(n) {
  return { kind: "zbuffer", zFunc: n.uint32(), zWrite: n.uint8() };
}

function RH(n) {
  return { kind: "wire", enabled: n.uint8() };
}

function IH(n) {
  return {
    kind: "toon",
    flags: [n.uint8(), n.uint8()],
    words: Array.from({ length: 9 }, () => n.uint32()),
  };
}

function kH(n, e) {
  const t = L4(n),
    i = n.uint8() !== 0 ? e.readField(n, Ep) : void 0,
    r = n.uint8() !== 0 ? e.readField(n, zH) : void 0,
    s = n.uint8() !== 0 ? e.readField(n, Ep) : void 0,
    o = Array.from({ length: 6 }, () => n.uint32());
  return {
    kind: "prs",
    base: t,
    position: i,
    rotation: r,
    scale: s,
    firstLastCache: o,
  };
}

function LH(n, e) {
  const t = L4(n),
    i = e.readField(n, (r) => {
      const s = r.uint32();
      if (s !== 3)
        throw new Error(`可见性关键帧类型 ${s} 无原版 reader 分支。`);
      const o = r.count("可见性关键帧", 1e6);
      return { type: s, records: Array.from({ length: o }, () => r.bytes(5)) };
    });
  return { kind: "visibility", base: t, keys: i };
}

function PH(n, e) {
  return { kind: "float-controller", base: L4(n), keys: e.readField(n, Q5) };
}

function FH(n, e) {
  const t = L4(n),
    i = e.readField(n, (r) => {
      const s = r.uint32();
      if (s !== 3) throw new Error(`整数关键帧类型 ${s} 无原版 reader 分支。`);
      const o = r.count("整数关键帧", 1e6);
      return { type: s, records: Array.from({ length: o }, () => r.bytes(8)) };
    });
  return { kind: "int-controller", base: t, keys: i };
}

function DH(n, e) {
  const t = L4(n),
    i = e.readField(n, (r) => {
      const s = r.uint32(),
        o = r.count("颜色关键帧", 1e6),
        a = D6("颜色", s, { 0: 16, 1: 8, 2: 20, 3: 8 });
      return { type: s, records: Array.from({ length: o }, () => r.bytes(a)) };
    });
  return { kind: "color-controller", base: t, keys: i };
}

function VH(n, e) {
  const t = L4(n),
    i = e.readField(n, (r, s) => {
      const o = r.count("Morph 记录", 1e6),
        a = [];
      for (let c = 0; c < o; c += 1) {
        const l = r.uint16(),
          u = r.uint8() !== 0 ? a3(r, l) : void 0,
          h = r.uint8() !== 0 ? a3(r, l) : void 0,
          d =
            r.uint8() !== 0
              ? Array.from({ length: l }, () => r.float32())
              : void 0,
          f =
            r.uint8() !== 0
              ? Array.from({ length: l }, () => r.vec2())
              : void 0,
          p = s.readField(r, Q5);
        a.push({
          vertexCount: l,
          positions: u,
          normals: h,
          scalars: d,
          uvs: f,
          keys: p,
        });
      }
      return a;
    });
  return { kind: "morph-controller", base: t, data: i };
}

function NH(n, e) {
  const t = L4(n),
    i = n.uint8() !== 0 ? e.readField(n, Ep) : void 0,
    r = n.uint8() !== 0 ? e.readField(n, Q5) : void 0;
  return {
    kind: "path-controller",
    base: t,
    vec3Keys: i,
    floatKeys: r,
    tailDword0: n.uint32(),
    tailDword1: n.uint32(),
    tailWord0: n.uint16(),
    tailDword2: n.uint32(),
    tailWord1: n.uint16(),
    tailBytes: n.bytes(5),
  };
}

function OH(n) {
  return {
    kind: "fog-property",
    selector: n.uint32(),
    mode: n.uint32(),
    color: n.uint32(),
    start: n.float32(),
    end: n.float32(),
    density: n.float32(),
  };
}

function L4(n) {
  return {
    controllerBaseWord0: n.uint32(),
    cycleMode: n.uint32(),
    readerDiscardedWords: [n.uint32(), n.uint32()],
    frequency: n.float32(),
    phaseWord: n.uint32(),
    startTimeWord: n.uint32(),
    stopTimeWord: n.uint32(),
  };
}

function Q5(n) {
  const e = n.uint32(),
    t = n.count("浮点关键帧", 1e6),
    i = D6("浮点", e, { 0: 16, 1: 8, 2: 20, 3: 8 });
  return { type: e, records: Array.from({ length: t }, () => n.bytes(i)) };
}

function Ep(n) {
  const e = n.uint32(),
    t = n.count("向量关键帧", 1e6);
  if (e === 5)
    return {
      type: e,
      count: t,
      header: Array.from({ length: 4 }, () => n.uint32()),
      components: [Q5(n), Q5(n), Q5(n)],
    };
  const i = D6("向量", e, { 0: 40, 1: 16, 2: 28, 3: 16 });
  return { type: e, records: Array.from({ length: t }, () => n.bytes(i)) };
}

function zH(n) {
  const e = n.uint32(),
    t = n.count("旋转关键帧", 1e6);
  if (e === 4)
    return {
      type: e,
      count: t,
      header: Array.from({ length: 5 }, () => n.uint32()),
      axes: [Q5(n), Q5(n), Q5(n)],
    };
  const i = D6("旋转", e, { 0: 20, 1: 20, 2: 32, 3: 20 });
  return { type: e, records: Array.from({ length: t }, () => n.bytes(i)) };
}

function D6(n, e, t) {
  const i = t[e];
  if (i === void 0) throw new Error(`${n}关键帧类型 ${e} 无原版 reader 分支。`);
  return i;
}

function $m(n, e) {
  return L6(n);
}

function Mu(n, e) {
  return vo(n, e)?.value;
}

function vo(n, e) {
  return n.uint8() !== 0 ? e.readObjectOccurrence(n) : void 0;
}

function UH(n) {
  const e = n.slotOccurrences[7];
  if (!e) {
    if (n.slots[7] !== void 0)
      throw new Error(
        `${n.name || n.className} 的 TexProperty 缺少 Object47 occurrence。`,
      );
    return;
  }
  if (!XH(e.value))
    throw new Error(`${n.name || n.className} 的 slot 8 不是 TexProperty。`);
  return e;
}

function $H(n) {
  const e = n.slotOccurrences[4];
  if (!e) {
    if (n.slots[4] !== void 0)
      throw new Error(
        `${n.name || n.className} 的 BackFaceProperty 缺少 Object47 occurrence。`,
      );
    return;
  }
  if (!jH(e.value))
    throw new Error(
      `${n.name || n.className} 的 slot 5 不是 BackFaceProperty。`,
    );
  return e.value;
}

function WH(n) {
  return [...n.indices];
}

function HH(n) {
  if (
    !(n.className !== "ReTriList" && n.className !== "ReTriStrip") &&
    n.vertexData?.positions
  )
    return {
      kind: n.className === "ReTriStrip" ? "strip" : "list",
      positions: n.vertexData.positions,
      indices: WH(n.vertexData),
      uvs: n.vertexData.uvs.flat(),
    };
}

function xu(n, e, t) {
  if (n >= e) throw new Error(`${t}索引 ${n} 越界。`);
}

function qH(n) {
  return {
    kind: "node",
    className: n,
    name: "",
    children: [],
    transform: [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ],
    position: [0, 0, 0],
    scale: [1, 1, 1],
    bounds0: { min: [0, 0, 0], max: [0, 0, 0] },
    serializedBoundsOverride: 0,
    cullingTraversalMode: 0,
    bounds1: { min: [0, 0, 0], max: [0, 0, 0] },
    rawScalar: 0,
    nodeEnabled: 1,
    slots: Array.from({ length: 11 }),
    slotOccurrences: Array.from({ length: 11 }),
  };
}

function ne(n) {
  return { x: n[0], y: n[2], z: -n[1] };
}

function a3(n, e) {
  return Array.from({ length: e }, () => n.vec3());
}

function Wm(n) {
  return !!(n && typeof n == "object" && n.kind === "node");
}

function Hm(n) {
  return !!(n && typeof n == "object" && n.kind === "track");
}

function KH(n) {
  if (!n || typeof n != "object") return !1;
  const e = n.kind;
  return (
    e === "TrackObject" ||
    e === "ToRoad" ||
    e === "ToDummy" ||
    e === "ToBlackPlane" ||
    e === "ToMesh" ||
    e === "ToEventMesh" ||
    e === "ToMinimap" ||
    e === "ToItemCube" ||
    e === "ToLucci" ||
    e === "ToMovableObject"
  );
}

function jH(n) {
  return !!(n && typeof n == "object" && n.kind === "backface");
}

function XH(n) {
  return !!(n && typeof n == "object" && n.kind === "texture");
}

class YH {
  objects = new Map();
  fields = new Map();
  objectIds = new Set();
  fieldIds = new Set();
  decoders = new Map();
  register(e, t) {
    this.decoders.set(e >>> 0, t);
  }
  readObject(e) {
    return this.readObjectOccurrence(e).value;
  }
  readObjectOccurrence(e) {
    const t = e.position,
      i = e.uint16();
    if (i === qW) {
      const c = e.uint16();
      if (!this.objects.has(c)) throw new Error(`未知对象引用 ${c}。`);
      return { encoding: "reference", id: c, value: this.objects.get(c) };
    }
    if (i !== HW)
      throw new Error(
        `0x${t.toString(16)} 不是 KartObject（标记 0x${i.toString(16)}）。`,
      );
    const r = e.uint32(),
      s = e.uint16();
    if (this.objectIds.has(s)) throw new Error(`重复对象索引 ${s}。`);
    this.objectIds.add(s);
    const o = this.decoders.get(r);
    if (!o) throw new Error(`不支持 ClassStamp 0x${r.toString(16)}。`);
    const a = o(e, this);
    return (this.objects.set(s, a), { encoding: "new", id: s, value: a });
  }
  readField(e, t) {
    return this.readFieldOccurrence(e, t).value;
  }
  readFieldOccurrence(e, t) {
    const i = e.position,
      r = e.uint16();
    if (r === jW) {
      const a = e.uint16();
      if (!this.fields.has(a))
        throw new Error(`0x${i.toString(16)} 存在未知字段引用 ${a}。`);
      return { encoding: "reference", id: a, value: this.fields.get(a) };
    }
    if (r !== KW) throw new Error(`0x${i.toString(16)} 不是索引字段。`);
    const s = e.uint16();
    if (this.fieldIds.has(s)) throw new Error(`重复字段索引 ${s}。`);
    this.fieldIds.add(s);
    const o = t(e, this);
    return (this.fields.set(s, o), { encoding: "new", id: s, value: o });
  }
}

let ZH = class {
  constructor(e) {
    ((this.data = e),
      (this.view = new DataView(e.buffer, e.byteOffset, e.byteLength)));
  }
  data;
  view;
  position = 0;
  get remaining() {
    return this.data.length - this.position;
  }
  skip(e) {
    (this.require(e), (this.position += e));
  }
  bytes(e) {
    this.require(e);
    const t = this.data.slice(this.position, this.position + e);
    return ((this.position += e), t);
  }
  uint8() {
    return (this.require(1), this.data[this.position++]);
  }
  int16() {
    this.require(2);
    const e = this.view.getInt16(this.position, !0);
    return ((this.position += 2), e);
  }
  uint16() {
    this.require(2);
    const e = this.view.getUint16(this.position, !0);
    return ((this.position += 2), e);
  }
  uint32() {
    this.require(4);
    const e = this.view.getUint32(this.position, !0);
    return ((this.position += 4), e);
  }
  float32() {
    this.require(4);
    const e = this.view.getFloat32(this.position, !0);
    return ((this.position += 4), e);
  }
  vec2() {
    return [this.float32(), this.float32()];
  }
  vec3() {
    return [this.float32(), this.float32(), this.float32()];
  }
  string() {
    const e = this.count("字符串", 1e5);
    try {
      return new TextDecoder("utf-16le", { fatal: !0 }).decode(
        this.bytes(e * 2),
      );
    } catch {
      throw new Error("track.1s 包含无效 UTF-16LE 字符串。");
    }
  }
  count(e, t) {
    const i = this.uint32();
    if (i > t) throw new Error(`${e}数量 ${i} 无效。`);
    return i;
  }
  uint16Count(e, t) {
    const i = this.uint16();
    if (i > t) throw new Error(`${e}数量 ${i} 无效。`);
    return i;
  }
  isNewObject() {
    return (
      this.position + 8 <= this.data.length &&
      this.data[this.position] === 170 &&
      this.data[this.position + 1] === 71
    );
  }
  peekUint32(e) {
    return (this.require(e + 4), this.view.getUint32(this.position + e, !0));
  }
  require(e) {
    if (
      !Number.isSafeInteger(e) ||
      e < 0 ||
      this.position + e > this.data.length
    )
      throw new Error(`track.1s 在 0x${this.position.toString(16)} 意外结束。`);
  }
};

const YG = new WeakMap();

function qm(n, e) {
  YG.set(n, e);
}

function QH(n) {
  YG.get(n)?.();
}

const Tp = new WeakSet();

function JH(n, e) {
  e ? Tp.add(n) : Tp.delete(n);
}

class eq {
  texture;
  uvEnabled = 0;
  uv = new Y2(0, 0, 1, 1);
  rotation = 0;
  beforeDraw(e) {
    const t = e,
      i = t.uniforms;
    if (Tp.has(e)) {
      if (!this.texture)
        throw new Error("空 TexProperty 前尚无有效的原生 stage-0 纹理绑定。");
      ((i.baseMap.value = this.texture),
        (i.uvControllerEnabled.value = this.uvEnabled),
        i.uvOffsetScale.value.copy(this.uv),
        (i.uvRotation.value = this.rotation),
        (t.uniformsNeedUpdate = !0));
      return;
    }
    const r = i?.baseMap?.value ?? e.map;
    r instanceof D9 &&
      ((this.texture = r),
      (this.uvEnabled = i?.uvControllerEnabled?.value ?? 0),
      i?.uvOffsetScale
        ? this.uv.copy(i.uvOffsetScale.value)
        : this.uv.set(0, 0, 1, 1),
      (this.rotation = i?.uvRotation?.value ?? 0));
  }
}

const sb = new WeakMap();

function yo(n, e) {
  let t = sb.get(n);
  t || ((t = new eq()), sb.set(n, t));
  const i = n.renderBufferDirect;
  n.renderBufferDirect = function (r, s, o, a, c, l) {
    (t.beforeDraw(a), i.call(this, r, s, o, a, c, l));
  };
  try {
    e();
  } finally {
    n.renderBufferDirect = i;
  }
}

const Rt = new WeakMap(),
  Dl = new DataView(new ArrayBuffer(4)),
  ob = new Array(16).fill(0),
  tq = [];

function ie(n, e, t, i = 0, r) {
  Rt.set(n, {
    bias: x2(e),
    key: 0,
    rank: 0,
    keyOffset: x2(i),
    phase: "world",
    trueGroup: t,
    sortSource: r,
  });
}

function ZG(n) {
  const e = Rt.get(n);
  if (!e || e.bias === void 0)
    throw new Error(`${n.name || n.type} 缺少可转为 blend 的相机记录。`);
  Rt.set(n, {
    bias: e.bias,
    key: 0,
    rank: 0,
    keyOffset: x2(-0.01),
    phase: e.phase,
    trueGroup: !0,
    sortSource: e.sortSource,
  });
}

function ca(n, e) {
  Rt.set(n, {
    key: x2(e),
    rank: 0,
    keyOffset: 0,
    phase: "world",
    trueGroup: !0,
  });
}

function QG(n) {
  const e = Rt.get(n);
  ZG(n);
  const t = Rt.get(n);
  let i = !1;
  return () => {
    if (!i) {
      if (((i = !0), Rt.get(n) !== t))
        throw new Error("blend 记录在释放前被其他 owner 替换。");
      Rt.set(n, e);
    }
  };
}

function Ao(n) {
  Rt.set(n, {
    key: 0,
    rank: 0,
    keyOffset: 0,
    phase: "post-world",
    trueGroup: !0,
  });
}

function Km(n, e) {
  if ((n.matrixAutoUpdate && n.updateMatrix(), n.matrixWorldNeedsUpdate || e)) {
    if (n.matrixWorldAutoUpdate === !0) {
      const t = n.parent;
      t === null
        ? n.matrixWorld.copy(n.matrix)
        : n.matrixWorld.multiplyMatrices(t.matrixWorld, n.matrix);
    }
    ((n.matrixWorldNeedsUpdate = !1), (e = !0));
  }
  for (let t = 0; t < n.children.length; t += 1) {
    const i = n.children[t];
    i.matrixWorldAutoUpdate !== !1 && Km(i, e);
  }
}

function nq(n, e) {
  const t = [];
  for (let i = n.parent; i !== null; i = i.parent) t.push(i);
  for (let i = t.length - 1; i >= 0; i -= 1) {
    const r = t[i];
    (r.matrixAutoUpdate && r.updateMatrix(),
      r.matrixWorldAutoUpdate === !0 &&
        (r.parent === null
          ? r.matrixWorld.copy(r.matrix)
          : r.matrixWorld.multiplyMatrices(r.parent.matrixWorld, r.matrix)));
  }
  Km(n, e);
}

function e4(n, e, t = !0, i) {
  (Km(n, t), e.updateMatrixWorld(!0));
  const r = e.matrixWorldInverse.elements;
  for (let o = 0; o < 16; o += 1) ob[o] = Math.fround(r[o]);
  i?.("rw-matrix");
  const s = tq;
  s.length = 0;
  try {
    (n.traverseVisible((o) => {
      QH(o);
      const a = Rt.get(o),
        c = o;
      if (!a && (c.isLine || c.isMesh || c.isPoints || c.isSprite))
        throw new Error(
          `${o.name || o.type} 缺少 P3528 render record marker。`,
        );
      if (a) {
        if (a.bias !== void 0) {
          const l = (a.sortSource ?? o).matrixWorld.elements;
          a.key = x2(iq(a.bias, l[12], l[13], l[14], ob) + a.keyOffset);
        }
        a.trueGroup && a.phase === "world" && s.push(a);
      }
    }),
      i?.("rw-traverse"),
      sq(s),
      i?.("rw-sort"));
  } finally {
    s.length = 0;
  }
}

function iq(n, e, t, i, r) {
  const s = x2(x2(x2(x2(e) * r[2]) + x2(x2(i) * r[10])) + x2(x2(t) * r[6]));
  return x2(n - x2(s + r[14]));
}

function jm(n, e) {
  const t = ab(n),
    i = ab(e);
  return t.phase !== i.phase
    ? t.phase === "world"
      ? -1
      : 1
    : t.phase === "post-world"
      ? 0
      : t.rank - i.rank;
}

function f4(n, e, t) {
  (e4(e, t), n.setTransparentSort(jm));
  try {
    yo(n, () => n.render(e, t));
  } finally {
    n.setTransparentSort(null);
  }
}

function JG(n, e) {
  (e.updateWorldMatrix(!0, !1), rq(n));
  const t = lB(e);
  for (let i = 0; i < n.length; i += 1) oB(n[i], t, 1);
}

function rq(n) {
  n.forEach(eB);
}

function sq(n) {
  n.sort((e, t) => t.key - e.key);
  for (let e = 0; e < n.length; e += 1) n[e].rank = e;
}

function ab(n) {
  const e = Rt.get(n.object);
  if (!e)
    throw new Error(
      `${n.object.name || n.object.type} 缺少 P3528 render record marker。`,
    );
  return e;
}

const oq = { kind: "canonical" },
  la = { kind: "invalid" },
  aq = { kind: "non-finite" },
  cb = new WeakMap();

function _p(n) {
  let e = cb.get(n);
  return (
    e ||
      ((e = { kind: "ordinary", min: [0, 0, 0], max: [0, 0, 0] }),
      cb.set(n, e)),
    e
  );
}

function eB(n) {
  return n.boundsDirty === !1
    ? !1
    : (n.boundsDirty === !0 && (n.boundsDirty = !1),
      n.children.length > 0 && n.cullingTraversalMode !== 3
        ? cq(n)
        : (n.boundsDirty === void 0 && n.sourceObject.updateWorldMatrix(!0, !1),
          (n.runtimeBounds = hq(
            n,
            n.bounds,
            n.sourceObject.matrixWorld.elements,
          )),
          !0));
}

function cq(n) {
  if (n.cullingTraversalMode > 3)
    throw new Error(
      `${n.cullingObject.name || "scene node"} 的 culling traversal mode 尚未映射。`,
    );
  n.runtimeBounds ??= la;
  let e = !1;
  const t = n.children;
  for (let i = 0; i < t.length; i += 1) eB(t[i]) && (e = !0);
  return n.cullingTraversalMode === 1
    ? !1
    : (e && (n.runtimeBounds = lq(n, n.children)), e);
}

function lq(n, e) {
  let t = la;
  for (const i of e) t = uq(n, t, i.runtimeBounds);
  return t;
}

function uq(n, e, t) {
  return e.kind === "canonical" || t.kind === "invalid"
    ? e
    : e.kind === "invalid" || t.kind === "canonical"
      ? t.kind !== "ordinary"
        ? t
        : tB(_p(n), t)
      : e.kind !== "ordinary" || t.kind !== "ordinary"
        ? e
        : nB(_p(n), e, t);
}

function tB(n, e) {
  return (
    (n.min[0] = e.min[0]),
    (n.min[1] = e.min[1]),
    (n.min[2] = e.min[2]),
    (n.max[0] = e.max[0]),
    (n.max[1] = e.max[1]),
    (n.max[2] = e.max[2]),
    n
  );
}

function nB(n, e, t) {
  return (
    (n.min[0] = t.min[0] < e.min[0] ? t.min[0] : e.min[0]),
    (n.min[1] = t.min[1] < e.min[1] ? t.min[1] : e.min[1]),
    (n.min[2] = t.min[2] < e.min[2] ? t.min[2] : e.min[2]),
    (n.max[0] = t.max[0] > e.max[0] ? t.max[0] : e.max[0]),
    (n.max[1] = t.max[1] > e.max[1] ? t.max[1] : e.max[1]),
    (n.max[2] = t.max[2] > e.max[2] ? t.max[2] : e.max[2]),
    n
  );
}

const J1 = Array.from({ length: 8 }, () => [0, 0, 0]);

function hq(n, e, t) {
  const i = iB(e);
  return i || (rB(e, t), sB(_p(n)));
}

function dq(n, e, t, i) {
  const r = iB(t);
  return r || (rB(t, i), sB(n.ordinaryBounds(e)));
}

function iB(n) {
  const e = Mq(n.min[0]);
  if (e === 7136238) return oq;
  if (e === 2123789977) return la;
  const [t, i, r] = n.min,
    [s, o, a] = n.max;
  if (!(
    Number.isFinite(t) &&
    Number.isFinite(i) &&
    Number.isFinite(r) &&
    Number.isFinite(s) &&
    Number.isFinite(o) &&
    Number.isFinite(a)
  ))
    return aq;
}

function rB(n, e) {
  const [t, i, r] = n.min,
    [s, o, a] = n.max;
  (An(J1[0], t, i, r, e),
    An(J1[1], s, i, r, e),
    An(J1[2], t, o, r, e),
    An(J1[3], s, o, r, e),
    An(J1[4], t, i, a, e),
    An(J1[5], s, i, a, e),
    An(J1[6], t, o, a, e),
    An(J1[7], s, o, a, e));
}

function sB(n) {
  const e = n.min,
    t = n.max;
  ((e[0] = J1[0][0]),
    (e[1] = J1[0][1]),
    (e[2] = J1[0][2]),
    (t[0] = J1[0][0]),
    (t[1] = J1[0][1]),
    (t[2] = J1[0][2]));
  for (let i = 1; i < J1.length; i += 1) fq(e, t, J1[i]);
  return n;
}

function An(n, e, t, i, r) {
  ((n[0] = P5(e, t, i, r[0], r[4], r[8], r[12])),
    (n[1] = P5(e, t, i, r[1], r[5], r[9], r[13])),
    (n[2] = P5(e, t, i, r[2], r[6], r[10], r[14])));
}

function P5(n, e, t, i, r, s, o) {
  const a = x2(x2(x2(n) * x2(i)) + x2(x2(e) * x2(r)));
  return x2(x2(a + x2(x2(t) * x2(s))) + x2(o));
}

function fq(n, e, t) {
  for (let i = 0; i < 3; i += 1)
    (t[i] < n[i] && (n[i] = t[i]), t[i] > e[i] && (e[i] = t[i]));
}

function oB(n, e, t, i) {
  if (!n.enabled) {
    n.cullingObject.visible = !1;
    return;
  }
  const s = pq(n, e, t);
  if (((n.cullingObject.visible = s !== 0), s === 0)) return;
  const o = n.children;
  for (let a = 0; a < o.length; a += 1) oB(o[a], e, s);
}

function pq(n, e, t) {
  return t === 3
    ? 3
    : n.children.length === 0 || n.cullingTraversalMode === 0
      ? p4(n.runtimeBounds, e)
      : n.cullingTraversalMode === 2 || n.cullingTraversalMode === 3
        ? p4(n.runtimeBounds, e) === 0
          ? 0
          : 3
        : t;
}

function Gp(n) {
  const e = n.count;
  for (let t = 0; t < e; t += 1)
    if (n.parent[t] === -1)
      for (
        k5.length = 0,
          R5.length = 0,
          j3.length = 0,
          k5.push(t),
          R5.push(-1),
          j3.push(0);
        k5.length > 0;
      ) {
        const i = k5.length - 1,
          r = k5[i];
        if (R5[i] < 0) {
          if (((R5[i] = 0), n.boundsDirty[r] === 0)) {
            Su(0);
            continue;
          }
          n.boundsDirty[r] = 0;
          const l = n.childOffsets[r],
            u = n.childOffsets[r + 1],
            h = n.cullingTraversalMode[r];
          if (u > l && h !== 3) {
            if (h > 3)
              throw new Error(
                `${n.cullingObject[r].name || "scene node"} 的 culling traversal mode 尚未映射。`,
              );
            n.runtimeBounds[r] === void 0 && (n.runtimeBounds[r] = la);
          } else {
            ((n.runtimeBounds[r] = dq(
              n,
              r,
              n.bounds[r],
              n.object[r].matrixWorld.elements,
            )),
              Su(1));
            continue;
          }
        }
        const s = k5[i],
          o = n.childOffsets[s],
          a = n.childOffsets[s + 1];
        if (R5[i] < a - o) {
          const l = n.childIndices[o + R5[i]];
          ((R5[i] += 1), k5.push(l), R5.push(-1), j3.push(0));
          continue;
        }
        const c = n.cullingTraversalMode[s];
        (c !== 1 && j3[i] !== 0 && (n.runtimeBounds[s] = gq(n, s)),
          Su(c === 1 ? 0 : j3[i]));
      }
}

function Su(n) {
  (k5.pop(), R5.pop(), j3.pop());
  const e = k5.length - 1;
  e >= 0 && n !== 0 && (j3[e] = 1);
}

const k5 = [],
  R5 = [],
  j3 = [];

function gq(n, e) {
  let t = la;
  const i = n.childOffsets[e],
    r = n.childOffsets[e + 1];
  for (let s = i; s < r; s += 1) {
    const o = n.childIndices[s];
    t = mq(n, e, t, n.runtimeBounds[o]);
  }
  return t;
}

function mq(n, e, t, i) {
  return t.kind === "canonical" || i.kind === "invalid"
    ? t
    : t.kind === "invalid" || i.kind === "canonical"
      ? i.kind !== "ordinary"
        ? i
        : tB(n.ordinaryBounds(e), i)
      : t.kind !== "ordinary" || i.kind !== "ordinary"
        ? t
        : nB(n.ordinaryBounds(e), t, i);
}

let ri = new Int32Array(0),
  Ur = new Uint8Array(0);

function wq(n, e, t) {
  (e.updateWorldMatrix(!0, !1), Gp(n));
  const i = lB(e),
    r = n.count;
  (ri.length < r && ((ri = new Int32Array(r)), (Ur = new Uint8Array(r))),
    Ur.fill(0, 0, r));
  for (let s = 0; s < r; s += 1) {
    const o = n.parent[s];
    let a;
    if (o < 0) ((Ur[s] = 1), (a = 1));
    else {
      if (Ur[o] === 0 || ri[o] === 0) continue;
      ((Ur[s] = 1), (a = ri[o]));
    }
    if (n.enabled[s] === 0 || t?.[s] === 1) {
      ((n.cullingObject[s].visible = !1), (ri[s] = 0));
      continue;
    }
    n.onCollect?.[s]?.();
    const c = vq(n, s, i, a);
    ((ri[s] = c),
      (n.cullingObject[s].visible = c !== 0),
      c !== 0 && n.onVisible?.[s]?.());
  }
}

function vq(n, e, t, i) {
  return i === 3
    ? 3
    : n.childOffsets[e + 1] === n.childOffsets[e] ||
        n.cullingTraversalMode[e] === 0
      ? p4(n.runtimeBounds[e], t)
      : n.cullingTraversalMode[e] === 2 || n.cullingTraversalMode[e] === 3
        ? p4(n.runtimeBounds[e], t) === 0
          ? 0
          : 3
        : i;
}

function p4(n, e) {
  if (n.kind === "invalid") return 0;
  if (n.kind !== "ordinary") return 1;
  let t = 0;
  for (const i of e) {
    if (bq(yq(n, i)) > 0) return 0;
    const r = Aq(n, i);
    !Number.isNaN(r) && r <= 0 && (t += 1);
  }
  return t === e.length ? 3 : 1;
}

function yq(n, e) {
  const t = e.normal,
    i = t[0] <= 0 ? n.max[0] : n.min[0],
    r = t[1] <= 0 ? n.max[1] : n.min[1],
    s = t[2] <= 0 ? n.max[2] : n.min[2];
  return aB(t, i, r, s, e.constant);
}

function Aq(n, e) {
  const t = e.normal,
    i = t[0] <= 0 ? n.min[0] : n.max[0],
    r = t[1] <= 0 ? n.min[1] : n.max[1],
    s = t[2] <= 0 ? n.min[2] : n.max[2];
  return aB(t, i, r, s, e.constant);
}

function aB(n, e, t, i, r) {
  const s = x2(x2(x2(n[0] * e) + x2(n[1] * t)) + x2(n[2] * i));
  return x2(s + r);
}

const cB = Array.from({ length: 6 }, () => ({
  normal: [0, 0, 0],
  constant: 0,
}));

function lB(n) {
  const e = x2(Math.tan((n.fov * Math.PI) / 360)),
    t = x2(e * x2(n.aspect)),
    i = x2(n.near),
    r = x2(n.far),
    s = n.matrixWorld.elements;
  return (
    si(0, 0, 0, 1, 0, 0, -i, s),
    si(1, 0, 0, -1, 0, 0, -r, s),
    si(2, 1, 0, t, x2(t * r), 0, -r, s),
    si(3, -1, 0, t, x2(-t * r), 0, -r, s),
    si(4, 0, -1, e, 0, x2(-e * r), -r, s),
    si(5, 0, 1, e, 0, x2(e * r), -r, s),
    cB
  );
}

function si(n, e, t, i, r, s, o, a) {
  const c = x2(Math.sqrt(lb(e, t, i, e, t, i))),
    l = c === 0 ? 1 : x2(e / c),
    u = c === 0 ? 1 : x2(t / c),
    h = c === 0 ? 1 : x2(i / c),
    d = cB[n],
    f = P5(l, u, h, a[0], a[4], a[8], 0),
    p = P5(l, u, h, a[1], a[5], a[9], 0),
    v = P5(l, u, h, a[2], a[6], a[10], 0),
    w = P5(r, s, o, a[0], a[4], a[8], a[12]),
    g = P5(r, s, o, a[1], a[5], a[9], a[13]),
    y = P5(r, s, o, a[2], a[6], a[10], a[14]);
  ((d.normal[0] = f),
    (d.normal[1] = p),
    (d.normal[2] = v),
    (d.constant = x2(-lb(f, p, v, w, g, y))));
}

function lb(n, e, t, i, r, s) {
  return x2(x2(x2(n * i) + x2(e * r)) + x2(t * s));
}

function bq(n) {
  return (Dl.setFloat32(0, n, !0), Dl.getInt32(0, !0));
}

function Mq(n) {
  return (Dl.setFloat32(0, n, !0), Dl.getUint32(0, !0));
}

function x2(n) {
  return Math.fround(n);
}

const Q2 = Math.fround;

function uB(n, e) {
  return Q2(Q2(Q2(n[0] * e[0]) + Q2(n[1] * e[1])) + Q2(n[2] * e[2]));
}

function Cu(n, e) {
  return [Q2(n[0] - e[0]), Q2(n[1] - e[1]), Q2(n[2] - e[2])];
}

function ub(n, e) {
  return { normal: n, constant: Q2(-uB(e, n)) };
}

function xq(n, e) {
  const t = n.vertices,
    i = uB(Cu(t[0], e), n.planeNormal) < 0,
    r = i
      ? n.planeNormal
      : [Q2(-n.planeNormal[0]), Q2(-n.planeNormal[1]), Q2(-n.planeNormal[2])],
    s = [ub(r, t[0])];
  for (let o = 0; o < 4; o += 1) {
    if (n.edgeEnabled[o] === 0) continue;
    const a = i ? o : (o + 1) & 3,
      c = i ? (o + 1) & 3 : o,
      l = Cu(t[a], e),
      u = Cu(t[c], t[a]),
      h = [
        Q2(Q2(l[1] * u[2]) - Q2(l[2] * u[1])),
        Q2(Q2(l[2] * u[0]) - Q2(l[0] * u[2])),
        Q2(Q2(l[0] * u[1]) - Q2(l[1] * u[0])),
      ],
      d = Q2(
        Math.sqrt(Q2(Q2(Q2(h[0] * h[0]) + Q2(h[1] * h[1])) + Q2(h[2] * h[2]))),
      ),
      f = d === 0 ? [1, 1, 1] : [Q2(h[0] / d), Q2(h[1] / d), Q2(h[2] / d)];
    s.push(ub(f, t[a]));
  }
  return s;
}

function Sq(n, e, t, i, r) {
  if ((i.fill(0), e.length === 0)) return;
  const s = e.map((a) => xq(r ? Cq(a, r) : a, t)),
    o = new Uint8Array(n.count);
  for (let a = 0; a < n.count; a += 1) {
    const c = n.parent[a];
    if (c >= 0 && o[c] === 0) continue;
    const l = n.cullingTraversalMode[a];
    if (l === 1) {
      o[a] = 1;
      continue;
    }
    if (s.some((u) => p4(n.runtimeBounds[a], u) === 3)) {
      i[a] = 1;
      continue;
    }
    l !== 2 && l !== 3 && (o[a] = 1);
  }
}

function Cq(n, e) {
  const t = new W2().getNormalMatrix(e),
    i = (s) => {
      const o = new H(...s).applyMatrix4(e);
      return [Q2(o.x), Q2(o.y), Q2(o.z)];
    },
    r = new H(...n.planeNormal).applyMatrix3(t).normalize();
  return {
    ...n,
    vertices: [
      i(n.vertices[0]),
      i(n.vertices[1]),
      i(n.vertices[2]),
      i(n.vertices[3]),
    ],
    planeNormal: [Q2(r.x), Q2(r.y), Q2(r.z)],
  };
}

const Eq = {
    alpha: bn(0, {
      kind: "alpha",
      blendEnable: 0,
      srcBlend: 2,
      dstBlend: 1,
      alphaTestEnable: 0,
      compare: 8,
      alphaRef: 0,
    }),
    backface: bn(7, { kind: "backface", cull: 2 }),
    fog: bn(11, {
      kind: "fog-property",
      selector: 0,
      mode: 1,
      color: 0,
      start: 0,
      end: 1,
      density: 1,
    }),
    material: bn(12, {
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
    }),
    texture: bn(13, {
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
    }),
    toon: bn(15, {
      kind: "toon",
      flags: [1, 1],
      words: [1, 4, 4294967295, 1065353216, 0, 2, 0, 4278190080, 2130706432],
    }),
    wire: bn(16, { kind: "wire", enabled: 0 }),
    zbuffer: bn(19, { kind: "zbuffer", zFunc: 4, zWrite: 1 }),
  },
  Tq = [
    ["alpha", 3, "alpha"],
    ["backface", 4, "backface"],
    ["fog", 5, "fog-property"],
    ["material", 6, "material"],
    ["texture", 7, "texture"],
    ["toon", 8, "toon"],
    ["wire", 9, "wire"],
    ["zbuffer", 10, "zbuffer"],
  ];

function hB(n) {
  const e = [],
    t = [],
    i = new Set(),
    r = (s, o, a) => {
      if (i.has(s))
        throw new Error(
          `${s.name || s.className} 使用共享 scene node，render owner 尚未闭合。`,
        );
      i.add(s);
      const c = { ...o };
      for (const [u, h, d] of Tq) {
        const f = s.slotOccurrences[h];
        if (!f) {
          if (s.slots[h] !== void 0)
            throw new Error(
              `${s.name || s.className} 的 slot ${h + 1} 缺少 Object47 occurrence。`,
            );
          continue;
        }
        if (!Rq(f.value, d))
          throw new Error(
            `${s.name || s.className} 的 slot ${h + 1} 不是 ${d}。`,
          );
        c[u] = { source: "wire", value: f.value, occurrence: f };
      }
      if (s.nodeEnabled === 0) {
        t.push({
          node: s,
          path: a,
          reason: "nodeEnabled=0 省略 node 和 subtree",
        });
        return;
      }
      const l = _q(s);
      (l
        ? e.push({
            node: s,
            path: a,
            geometryKind: l,
            state: c,
            issues: Gq(s, c),
          })
        : s.className === "ReBillboard" &&
          t.push({
            node: s,
            path: a,
            reason: `ReBillboard orientationMode=${s.orientationMode ?? "missing"}`,
          }),
        s.children.forEach((u, h) => r(u, c, [...a, h])));
    };
  return (r(n, Eq, []), { candidates: e, omitted: t });
}

function _q(n) {
  if (n.className === "ReTriList") return "tri-list";
  if (n.className === "ReTriStrip") return "tri-strip";
  if (n.className === "ReToonRigid") return "toon-rigid";
}

function Gq(n, e) {
  const t = [];
  (n.slotOccurrences[2] && t.push("node Path controller 尚未映射"),
    e.wire.value.enabled &&
      t.push("WireProperty enabled consumer 不在 M14 范围"),
    e.material.value.controllers.some((s) => s && !Bq(s)) &&
      t.push("MtlProperty controller tuple 尚未映射"));
  const i = e.texture.value.uvControllers,
    r = i.filter(Boolean).length;
  return (
    r !== 0 &&
      (r !== 5 || i.some((s) => !hb(s))) &&
      t.push("TexProperty UV controller tuple 尚未映射"),
    e.texture.value.alphaController &&
      !hb(e.texture.value.alphaController) &&
      t.push("TexProperty alpha controller 尚未映射"),
    n.className === "ReToonRigid" &&
      e.texture.value.name === void 0 &&
      t.push("ReToonRigid 缺少 texture"),
    n.className === "ReTriList" || n.className === "ReTriStrip"
      ? (n.vertexData?.positions ||
          t.push(`${n.className} 缺少 position channel`),
        e.material.value.mode === 2 &&
          !n.vertexData?.normals &&
          t.push(`${n.className} 的 lighting material 缺少 normal channel`))
      : n.rigidGeometry || t.push("ReToonRigid 缺少 geometry"),
    t
  );
}

function hb(n) {
  if (!n || typeof n != "object") return !1;
  const e = n;
  return (
    e.kind === "float-controller" && (e.keys?.type === 0 || e.keys?.type === 3)
  );
}

function Bq(n) {
  if (!n || typeof n != "object") return !1;
  const e = n;
  return (
    e.kind === "color-controller" && (e.keys?.type === 0 || e.keys?.type === 3)
  );
}

function bn(n, e) {
  return { source: "property-bank", bankIndex: n, value: e };
}

function Rq(n, e) {
  return !!(n && typeof n == "object" && n.kind === e);
}

async function p2(bytes) { return decodePngRgba(bytes); }









const u8 = "etc_/toon.png";

class rn {
  texture;
  constructor(e) {
    this.texture = e;
  }
  static async load(e) {
    const t = e.exactCanonicalCandidates(u8);
    if (t.length !== 1)
      throw new Error(`${u8} exact source 数量应为 1，实际为 ${t.length}。`);
    const i = t[0];
    if (
      i.sourceKind !== "rho5" ||
      i.sourceName !== "DataPack1_00001.rho5" ||
      i.containerId !== "rho5:datapack1"
    )
      throw new Error(`${u8} 不来自当前 P3528 DataPack1 exact owner。`);
    return rn.fromBytes(await i.bytes());
  }
  static async fromBytes(e) {
    const t = await p2(e);
    if (t.width !== 128 || t.height !== 64)
      throw new Error(
        `toon.png dimensions 应为 128x64，实际为 ${t.width}x${t.height}。`,
      );
    const i = new J9(t.pixels, t.width, t.height, e9, _9);
    return (
      (i.name = u8),
      (i.colorSpace = v9),
      (i.wrapS = i.wrapT = F1),
      (i.magFilter = i.minFilter = h9),
      (i.generateMipmaps = !1),
      (i.flipY = !1),
      (i.unpackAlignment = 1),
      (i.needsUpdate = !0),
      new rn(i)
    );
  }
  requestTexture() {
    return this.texture;
  }
  takeBoundTexture(e) {
    if (!e || this.texture !== e) return;
    const t = this.texture;
    return ((this.texture = void 0), t);
  }
  dispose() {
    (this.texture?.dispose(), (this.texture = void 0));
  }
}

class vB {
  position = 0;
  direction = 1;
  deadline = 0;
  advance(e) {
    if (!Number.isInteger(e) || e < 0 || e > 4294967295)
      throw new Error("车膜时钟必须是 uint32。");
    return e <= this.deadline
      ? !1
      : ((this.deadline = (e + 30) >>> 0),
        (this.position += this.direction),
        this.position === 120
          ? (this.direction = -1)
          : this.position === 0 && (this.direction = 1),
        !0);
  }
}

class yB {
  constructor(e, t = new vB()) {
    ((this.library = e), (this.clock = t));
  }
  library;
  clock;
  pending = new Map();
  ready = new Map();
  disposed = !1;
  request(e) {
    if (!Number.isInteger(e) || e < 1 || e > 255)
      return Promise.reject(new Error("车膜纹理索引尚未支持。"));
    if (this.disposed)
      return Promise.reject(new Error("车膜纹理管理器已释放。"));
    const t = this.pending.get(e);
    if (t) return t;
    const i = this.load(e);
    return (
      this.pending.set(e, i),
      i.catch(() => {
        this.pending.get(e) === i && this.pending.delete(e);
      }),
      i
    );
  }
  advance(e) {
    if (!Number.isInteger(e) || e < 0 || e > 4294967295)
      throw new Error("车膜时钟必须是 uint32。");
    if (!(this.disposed || !this.clock.advance(e)))
      for (const { source: t, texture: i } of this.ready.values())
        t.width < 256 ||
          (fb(t, this.clock.position, 128, i.image.data), (i.needsUpdate = !0));
  }
  dispose() {
    if (!this.disposed) {
      this.disposed = !0;
      for (const { texture: e } of this.ready.values()) e.dispose();
      (this.ready.clear(), this.pending.clear());
    }
  }
  async load(e) {
    const t = `effect/envMap/env${e}.png`,
      i = this.library.exactCanonicalCandidates(t);
    if (i.length !== 1) throw new Error(`车膜纹理缺失或不唯一：${t}`);
    const r = await p2(await i[0].bytes());
    if (
      !(e === 255
        ? r.width === 256 && r.height === 256
        : (r.width === 128 || r.width === 256) && r.height === 128)
    )
      throw new Error(`车膜纹理尺寸尚未支持：${r.width}×${r.height}`);
    if (this.disposed) throw new Error("车膜纹理管理器已释放。");
    const o = new Uint8Array(128 * r.height * 4);
    fb(r, 0, r.height, o);
    const a = new J9(o, 128, r.height, e9, _9);
    return (
      (a.name = t),
      (a.colorSpace = v9),
      (a.wrapS = a.wrapT = S1),
      (a.magFilter = u9),
      (a.minFilter = h9),
      (a.generateMipmaps = !1),
      (a.flipY = !1),
      (a.unpackAlignment = 1),
      (a.needsUpdate = !0),
      this.ready.set(e, { source: r, texture: a }),
      a
    );
  }
}

function fb(n, e, t, i) {
  for (let r = 0; r < t; r++) {
    const s = (r * n.width + e) * 4;
    i.set(n.pixels.subarray(s, s + 512), r * 128 * 4);
  }
}

class ha {
  current = null;
  retained = null;
  light = 1;
  coatings = new Map();
  coatingClocks = new Map();
  coatingTransitions = new Set();
  coatingRevision = 0;
  coatingsDisposed = !1;
  coatingTextures(e) {
    if (this.coatingsDisposed) throw new Error("共享车膜渲染绑定已释放。");
    let t = this.coatings.get(e);
    return (
      t || ((t = this.newCoatingTextures(e)), this.coatings.set(e, t)),
      t
    );
  }
  newCoatingTextures(e) {
    let t = this.coatingClocks.get(e);
    return (t || ((t = new vB()), this.coatingClocks.set(e, t)), new yB(e, t));
  }
  prepareCoatingStage() {
    if (this.coatingsDisposed) throw new Error("共享车膜渲染绑定已释放。");
    const e = this.coatingRevision,
      t = new Map();
    let i = !0;
    const r = () => {
        if (!i || this.coatingsDisposed || e !== this.coatingRevision)
          throw new Error("车膜阶段事务已失效。");
      },
      s = {
        validate: r,
        textures: (o) => {
          r();
          let a = t.get(o);
          return (a || ((a = this.newCoatingTextures(o)), t.set(o, a)), a);
        },
        commit: () => {
          r();
          const o = this.coatings;
          ((this.coatings = t),
            ++this.coatingRevision,
            (i = !1),
            this.coatingTransitions.delete(s));
          for (const a of o.values()) a.dispose();
        },
        dispose: () => {
          if (i) {
            ((i = !1), this.coatingTransitions.delete(s));
            for (const o of t.values()) o.dispose();
          }
        },
      };
    return (this.coatingTransitions.add(s), s);
  }
  request(e) {
    const t = e.requestTexture();
    return (
      t &&
        t !== this.current &&
        (this.retained?.dispose(), (this.retained = null), (this.current = t)),
      this.current
    );
  }
  currentTexture() {
    return this.current;
  }
  beginFrame(e) {
    const t = Math.trunc(e) >>> 0;
    for (const [i, r] of this.coatingClocks) {
      const s = this.coatings.get(i);
      s ? s.advance(t) : r.advance(t);
    }
  }
  retain(e) {
    const t = e.takeBoundTexture(this.current);
    t && (this.retained?.dispose(), (this.retained = t));
  }
  setLightFactor(e) {
    this.light = e;
  }
  lightFactor() {
    return this.light;
  }
  release() {
    for (const e of [...this.coatingTransitions]) e.dispose();
    for (const e of this.coatings.values()) e.dispose();
    (this.coatings.clear(),
      this.coatingClocks.clear(),
      this.retained?.dispose(),
      (this.retained = null),
      (this.current = null),
      ++this.coatingRevision);
  }
  dispose() {
    ((this.coatingsDisposed = !0), this.release());
  }
}

function bo(texture, environment, paletteParts = 0) { return createToonEnvironmentMaterial(texture, environment, paletteParts); }

function Zq(n, e, t) {
  ((n.uniforms.uvControllerEnabled.value = t ? 1 : 0),
    n.uniforms.uvOffsetScale.value.set(
      e.offsetU,
      e.offsetV,
      e.scaleU,
      e.scaleV,
    ),
    (n.uniforms.uvRotation.value = e.rotation));
}

function Mo(n, e) {
  if (e.toon.value.words[0] !== 1 || e.toon.value.words[5] !== 2)
    throw new Error(
      `Toon mode/key ${e.toon.value.words[0]}/${e.toon.value.words[5]} 尚未映射。`,
    );
  if (e.wire.value.enabled !== 0)
    throw new Error("WireProperty enabled 尚未映射。 ");
  if (e.material.value.mode !== 0)
    throw new Error(`MtlProperty mode ${e.material.value.mode} 尚未映射。`);
  n.uniforms.normalUvOffset.value.set(
    pb(e.toon.value.words[3]),
    pb(e.toon.value.words[4]),
  );
  const t = e.alpha.value;
  ((n.uniforms.alphaTestEnabled.value = t.alphaTestEnable !== 0 ? 1 : 0),
    (n.uniforms.alphaFunction.value = t.compare),
    (n.uniforms.alphaReference.value = t.alphaRef / 255),
    (n.depthWrite = e.zbuffer.value.zWrite !== 0),
    (n.depthFunc = Qq(e.zbuffer.value.zFunc)),
    (n.side = s1),
    t.blendEnable !== 0
      ? ((n.transparent = !0),
        (n.blending = u1),
        (n.blendSrc = gb(t.srcBlend)),
        (n.blendDst = gb(t.dstBlend)),
        (n.blendEquation = R9))
      : ((n.transparent = !1), (n.blending = n5)));
}

function pb(n) {
  const e = new ArrayBuffer(4),
    t = new DataView(e);
  return (t.setUint32(0, n, !0), t.getFloat32(0, !0));
}

function xo(n, e, t, i, r, s) {
  ((n.uniforms.toonEnv.value = t.request(e)),
    n.uniforms.clientWorld.value.copy(i),
    n.uniforms.clientWorldInverse.value.copy(r),
    n.uniforms.viewOriginClient.value.copy(s));
}

function Qq(n) {
  const t = { 1: ro, 2: so, 3: oo, 4: y1, 5: ao, 6: co, 7: rr, 8: ir }[n];
  if (t === void 0) throw new Error(`D3DCMPFUNC ${n} 尚未映射。`);
  return t;
}

function gb(n) {
  const t = {
    1: ym,
    2: h3,
    3: ra,
    4: Am,
    5: l1,
    6: v1,
    7: bm,
    8: Mm,
    9: xm,
    10: Sm,
    11: Cm,
  }[n];
  if (t === void 0) throw new Error(`D3DBLEND ${n} 尚未映射。`);
  return t;
}

class Jq extends DDSLoader {}

class eK extends TGALoader {}

function tK(n, e, t, i) {
  const r = i === "DXT1" ? 8 : 16;
  nK(n, e, t, r);
  const s = new Uint8Array(e * t * 4),
    o = new DataView(n.buffer, n.byteOffset, n.byteLength),
    a = new Uint8Array(16),
    c = new Uint8Array(16).fill(255),
    l = new Uint8Array(8);
  let u = 0;
  for (let h = 0; h < t; h += 4)
    for (let d = 0; d < e; d += 4) {
      const f = u + r - 8;
      (iK(o, f, i === "DXT1", a),
        rK(n, u, i, c, l),
        oK(s, e, t, d, h, o.getUint32(f + 4, !0), a, c),
        (u += r));
    }
  return s;
}

function nK(n, e, t, i) {
  if (!Number.isInteger(e) || !Number.isInteger(t) || e < 1 || t < 1)
    throw new Error(`DXT mip 尺寸必须为正整数，实际 ${e}x${t}。`);
  const r = Math.ceil(e / 4) * Math.ceil(t / 4) * i;
  if (n.length !== r)
    throw new Error(`DXT mip 长度不匹配，应为 ${r} bytes，实际 ${n.length}。`);
}

function iK(n, e, t, i) {
  const r = n.getUint16(e, !0),
    s = n.getUint16(e + 2, !0);
  (mb(r, i, 0), mb(s, i, 4));
  const o = t && r <= s,
    a = o ? 2 : 3;
  for (let c = 0; c < 3; c += 1)
    ((i[8 + c] = Math.floor(((a - 1) * i[c] + i[4 + c]) / a)),
      (i[12 + c] = o ? 0 : Math.floor((i[c] + 2 * i[4 + c]) / 3)));
  ((i[11] = 255), (i[15] = o ? 0 : 255));
}

function mb(n, e, t) {
  const i = n >>> 11,
    r = (n >>> 5) & 63,
    s = n & 31;
  ((e[t] = (i << 3) | (i >>> 2)),
    (e[t + 1] = (r << 2) | (r >>> 4)),
    (e[t + 2] = (s << 3) | (s >>> 2)),
    (e[t + 3] = 255));
}

function rK(n, e, t, i, r) {
  if (t !== "DXT1") {
    if (t === "DXT3") {
      for (let s = 0; s < 16; s += 1)
        i[s] = ((n[e + (s >>> 1)] >>> ((s & 1) * 4)) & 15) * 17;
      return;
    }
    sK(n, e, i, r);
  }
}

function sK(n, e, t, i) {
  const r = n[e],
    s = n[e + 1],
    o = r > s ? 7 : 5;
  ((i[0] = r), (i[1] = s), (i[6] = 0), (i[7] = 255));
  for (let a = 1; a < o; a += 1)
    i[a + 1] = Math.floor(((o - a) * r + a * s) / o);
  for (let a = 0; a < 2; a += 1) {
    const c = e + 2 + a * 3;
    let l = n[c] | (n[c + 1] << 8) | (n[c + 2] << 16);
    for (let u = 0; u < 8; u += 1) ((t[a * 8 + u] = i[l & 7]), (l >>>= 3));
  }
}

function oK(n, e, t, i, r, s, o, a) {
  const c = Math.min(4, t - r),
    l = Math.min(4, e - i);
  for (let u = 0; u < c; u += 1)
    for (let h = 0; h < l; h += 1) {
      const d = u * 4 + h,
        f = ((s >>> (d * 2)) & 3) * 4,
        p = ((r + u) * e + i + h) * 4;
      ((n[p] = o[f]),
        (n[p + 1] = o[f + 1]),
        (n[p + 2] = o[f + 2]),
        (n[p + 3] = o[f + 3] & a[d]));
    }
}

async function AB(n, e, t) {
  const i = n.extension.toLowerCase(),
    r = i === "png" && t,
    s = await n.bytes();
  let o;
  if (i === "png") {
    let a;
    try {
      r || (a = await p2(s));
    } catch (l) {
      throw new Error(
        `${n.virtualPath} PNG decode：${l instanceof Error ? l.message : String(l)}`,
      );
    }
    const c = n.canonicalPath ?? n.virtualPath;
    (/^(?:stuff|stuff2_)\/boostereffect\/[^/]+\//i.test(c) &&
      aK(a.pixels, a.width, a.height),
      /(^|\/)effect\/enchant\/front\.png$/i.test(c.replaceAll("\\", "/")) &&
        cK(a.pixels, a.width, a.height),
      (o = new J9(a.pixels, a.width, a.height, e9, _9)),
      (o.premultiplyAlpha = !1));
  } else if (i === "dds") {
    const a = new Jq().parse(_u(s), !0);
    if (!a.format || a.width <= 0 || a.height <= 0 || a.mipmapCount <= 0)
      throw new Error(`${n.virtualPath} DDS layout 无效。`);
    if (a.format === e9)
      o = new J9(a.mipmaps[0].data, a.width, a.height, e9, _9);
    else {
      const c = a.format === u4 ? $i : a.format;
      o = new Pl(a.mipmaps, a.width, a.height, c, _9);
    }
  } else if (i === "tga") {
    const a = new eK().parse(_u(s));
    ((o = new J9(a.data, a.width, a.height, e9, _9)), (o.flipY = !1));
  } else if (i === "jpg") {
    const a = await createImageBitmap(
      new Blob([_u(s)], { type: "image/jpeg" }),
      {
        colorSpaceConversion: "none",
        imageOrientation: "none",
        premultiplyAlpha: "none",
      },
    );
    ((o = new D9(a)), (o.flipY = !0));
  } else
    throw new Error(`${n.virtualPath} 的 ${i || "unknown"} decoder 尚未闭合。`);
  return (
    (o.name = n.canonicalPath ?? n.virtualPath),
    (o.colorSpace = v9),
    i !== "tga" && i !== "jpg" && (o.flipY = !1),
    (o.generateMipmaps = e.mipFilter !== 0 && !(o instanceof Pl)),
    (o.wrapS = wb(e.addressU)),
    (o.wrapT = wb(e.addressV)),
    (o.magFilter = fK(e.magFilter)),
    (o.minFilter = dK(e.minFilter, e.mipFilter)),
    (o.anisotropy =
      e.minFilter === 3 || e.magFilter === 3 ? e.maxAnisotropy : 1),
    (o.needsUpdate = !0),
    o
  );
}

function aK(pixels, width, height) { normalizeLegacyTextureAlpha(pixels, width, height); }

function cK(pixels, width, height) { normalizeLegacyTextureAlpha(pixels, width, height); }





function uK(n, e) {
  if (!(n instanceof Pl)) return;
  const t = hK(n.format);
  if (!t || e.extensions.has("WEBGL_compressed_texture_s3tc")) return;
  const i = n.mipmaps.map((r) => ({
    data: tK(r.data, r.width, r.height, t),
    width: r.width,
    height: r.height,
  }));
  ((n.mipmaps = i),
    (n.format = e9),
    (n.generateMipmaps = !1),
    (n.needsUpdate = !0));
}

function hK(n) {
  if (n === u4 || n === $i) return "DXT1";
  if (n === Wi) return "DXT3";
  if (n === Hi) return "DXT5";
}

function wb(n) {
  if (n === 1) return S1;
  if (n === 2) return Tl;
  if (n === 3) return F1;
  throw new Error(`D3DTEXTUREADDRESS ${n} 尚未映射。`);
}

function dK(n, e) {
  if (n !== 1 && n !== 2 && n !== 3)
    throw new Error(`D3DTEXF min ${n} 尚未映射。`);
  const t = n !== 1;
  if (e === 0) return t ? u9 : h9;
  if (e === 1) return t ? Nc : lG;
  if (e === 2 || e === 3 || e === 4 || e === 5) return t ? e5 : ys;
  throw new Error(`D3DTEXF mip ${e} 尚未映射。`);
}

function fK(n) {
  if (n === 0 || n === 1) return h9;
  if ([2, 3, 4, 5].includes(n)) return u9;
  throw new Error(`D3DTEXF mag ${n} 尚未映射。`);
}

function _u(n) {
  return n.slice().buffer;
}

const pK = ["dds", "png", "jpg", "tga", "kng"],
  vb = [
    "steam",
    "forest",
    "desert",
    "village",
    "ice",
    "tomb",
    "mine",
    "northeu",
    "factory",
    "pirate",
    "fairy",
    "moonhill",
    "gold",
    "china",
    "castle",
    "nymph",
    "mechanic",
    "xyy",
    "wkc",
    "brodi",
    "park",
    "beach",
    "transFormer",
    "jurassic",
    "world",
    "nemo",
    "sword",
    "god",
    "abyss",
    "camelot",
    "olympos",
    "korea",
    "mabi",
    "maple",
    "fengshen",
  ];

function sn(n, e, t, i, r = []) {
  if (i.name === void 0) return { status: "none" };
  const s = n.get(e);
  if (!s) return { status: "unresolved", reason: `资源库内找不到 ${e}。` };
  const o = [...gK(s, t), ...r],
    a = i.name.endsWith("@zz") ? i.name : void 0,
    c = a ? `${i.name.slice(0, -3)}@cn` : i.name;
  for (const l of a ? [c, a] : [c])
    for (const u of o) {
      const h = n.entriesUnderCanonicalPrefix(u.canonicalPrefix);
      if (h.length === 0) {
        if (!n.manifestAvailable || n.hasManifestMount(u.mountPath))
          return {
            status: "unresolved",
            reason: `${u.id} source 未选择，不能跳到低优先级 source。`,
            source: u,
            stem: l,
          };
        continue;
      }
      const d = mK(n, u, l);
      if (d) return d;
      const f = new Set(h.map((p) => p.containerId));
      if (
        f.size !== 1 ||
        f.has(void 0) ||
        !h.every((p) => p.absenceAuthoritative === !0)
      )
        return {
          status: "unresolved",
          reason: `${u.id} source 的缺失结论不具权威性，不能跳到低优先级 source。`,
          source: u,
          stem: l,
        };
    }
  return { status: "missing", stem: i.name };
}

function gK(n, e) {
  const t = MB(n.canonicalPath ?? n.virtualPath),
    i = t.lastIndexOf("/"),
    r = i < 0 ? "" : t.slice(0, i),
    s =
      e?.id ??
      r
        .split("/")
        .at(-1)
        ?.replace(/^track_/, "") ??
      "",
    o = t.startsWith("effect/") ? r.slice(0, r.lastIndexOf("/")) : void 0,
    a = o ? r : t.startsWith("track_/") ? `track_/${s}` : r,
    c = [{ kind: "track", id: `track:${a}`, canonicalPrefix: a, mountPath: a }];
  if (e?.folder && e.folder !== s) {
    const u = o ? `${o}/${e.folder}` : `track_/${e.folder}`;
    c.push({
      kind: "folder-alias",
      id: `${o ? "effect" : "track"}:${u}`,
      canonicalPrefix: u,
      mountPath: o ? "effect" : `track_/${e.folder}`,
    });
  }
  const l = vb.find((u) => s.startsWith(u));
  l && c.push(Gu("primary-theme", l));
  for (const u of e?.texTheme?.split("|") ?? [])
    !u || !vb.includes(u) || c.push(Gu("extra-theme", u));
  return (c.push(Gu("default-theme", "common")), c);
}

function Gu(n, e) {
  const t = `theme_/${e}`;
  return {
    kind: n,
    id: `theme:${e}`,
    canonicalPrefix: `${t}/texture`,
    mountPath: t,
  };
}

function mK(n, e, t) {
  for (const i of pK) {
    const r = `${MB(e.canonicalPrefix)}/${t}.${i}`,
      s = n.exactCanonicalCandidates(r);
    if (s.length > 1)
      return {
        status: "unresolved",
        reason: `${r} 在 source 中不唯一。`,
        source: e,
        stem: t,
      };
    if (s.length === 1)
      return { status: "found", entry: s[0], source: e, stem: t, extension: i };
  }
}

function MB(n) {
  return n
    .replaceAll("\\", "/")
    .replace(/^\.\//, "")
    .replace(/^\/+|\/+$/g, "");
}

class wK extends ToonOutlineBatch { constructor() { super({ currentSerial: vK, configureObject: ie }); } }



let Rp = 0;

function yb() {
  return ((Rp += 1), Rp);
}

function vK() {
  return Rp;
}

const Xm = Ym(Wc(1068708659), 4),
  yK = Ym(2, 2.5),
  AK = Ym(15, 20),
  Ip = new WeakMap();

function Ab(n, e) {
  e ? Ip.set(n, e) : Ip.delete(n);
}

function bK(n) {
  for (let e = n; e; e = e.parent) {
    const t = Ip.get(e);
    if (t) return t;
  }
}

let kp = Xm,
  $c = !0;

const Li = new Float32Array(16),
  bb = new Float32Array(16),
  Pi = new Float32Array(16),
  Mb = new H(),
  xB = new Float32Array(16);

let Lp = 0;

const $r = new Float32Array(4);

function SB(n, e, t) {
  return (
    n.updateMatrixWorld(),
    Fp(Li, n.projectionMatrix),
    Fp(bb, n.matrixWorldInverse),
    Dp(Pi, Li, bb),
    xK(Li, e, t),
    Dp(xB, Li, Pi),
    (Lp += 1),
    { generation: Lp, width: e, height: t }
  );
}

function MK(n) {
  kp = n === 1 ? yK : Xm;
}

function Pp(n) {
  $c = n;
}

class N6 extends ToonOutlineController {
  constructor(source, centerArgb, outerArgb, drawOutline = true, batch, cacheRigidProjection = false) {
    super(source, centerArgb, outerArgb, drawOutline, batch, cacheRigidProjection,
      toonOutlineDependencies());
  }
}



function Ym(n, e) {
  const t = Wc(1086918618),
    i = Wc(1023410176),
    r = Wc(1070141400),
    s = [];
  for (let o = 0; o < 32; o += 1) {
    const a = w2(w2(w2(o) * t) * i);
    for (let c = 0; c < 32; c += 1) {
      const l = (c + 16) & 31,
        u = w2(w2(w2(l) * t) * i);
      let h = w2(u - a);
      a > u || (h = w2(h - t));
      const d = w2(h * 0.5),
        f = w2(1 / w2(Math.cos(w2(r - Math.abs(d))))),
        p = w2(a + d),
        v = w2(-w2(w2(Math.cos(p)) * f) * n),
        w = w2(-w2(w2(Math.sin(p)) * f) * n),
        g = w2(w2(v * v) + w2(w * w));
      s.push({ x: v, y: w, valid: w2(e * e) >= g });
    }
  }
  return s;
}

function Fp(n, e) {
  const t = e.elements;
  for (let i = 0; i < 4; i += 1)
    for (let r = 0; r < 4; r += 1) n[i * 4 + r] = w2(t[r * 4 + i]);
}

function Dp(n, e, t) {
  for (let i = 0; i < 4; i += 1)
    for (let r = 0; r < 4; r += 1) {
      let s = w2(e[i * 4] * t[r]);
      ((s = w2(s + w2(e[i * 4 + 1] * t[4 + r]))),
        (s = w2(s + w2(e[i * 4 + 2] * t[8 + r]))),
        (n[i * 4 + r] = w2(s + w2(e[i * 4 + 3] * t[12 + r]))));
    }
}

function xK(n, e, t) {
  n.fill(0);
  const i = w2(w2(e) * 0.5),
    r = w2(w2(t) * 0.5);
  ((n[0] = i),
    (n[3] = i),
    (n[5] = -r),
    (n[7] = r),
    (n[10] = 0.5),
    (n[11] = 0.5),
    (n[15] = 1));
}

function SK(n, e, t) {
  const i = w2(t[0]),
    r = w2(t[1]),
    s = w2(t[2]);
  for (let o = 0; o < 4; o += 1) {
    const a = o * 4,
      c = w2(w2(r * e[a + 1]) + w2(i * e[a])),
      l = w2(w2(s * e[a + 2]) + e[a + 3]);
    n[o] = w2(c + l);
  }
}













function w2(n) {
  return Math.fround(n);
}

function Wc(n) {
  const e = new ArrayBuffer(4),
    t = new DataView(e);
  return (t.setUint32(0, n, !0), t.getFloat32(0, !0));
}

class on extends FloatKeyController {
  static fromParsed(parsed) { return FloatKeyController.fromParsed.call(on, parsed); }
}

function TK(n) {
  if (!LK(n))
    throw new Error("scene visibility controller 不是 VisTontroller。 ");
  if (n.keys.type !== 3)
    throw new Error(`VisTontroller key type ${n.keys.type} 尚未映射。`);
  if (n.keys.records.length === 0) throw new Error("VisTontroller 缺少 key。 ");
  const e = n.keys.records.map((t) => {
    if (t.length !== 5)
      throw new Error(`VisTontroller key size 应为 5，实际为 ${t.length}。`);
    const i = new DataView(t.buffer, t.byteOffset, t.byteLength),
      r = new Uint8Array(8),
      s = new DataView(r.buffer);
    return (
      s.setUint32(0, i.getUint32(0, !0), !0),
      s.setFloat32(4, t[4], !0),
      r
    );
  });
  return on.fromParsed({
    kind: "float-controller",
    base: n.base,
    keys: { type: 3, records: e },
  });
}

function _K(n, e, t) {
  const i = n.filter(Boolean).length;
  if (i !== 0 && i !== 5)
    throw new Error("TexProperty UV controller 必须为 0 或 5 个。 ");
  return {
    uvControllers: i === 5 ? n.map(on.fromParsed) : void 0,
    alphaController: e ? on.fromParsed(e) : void 0,
    baseAlpha: P2(t),
    currentAlpha: P2(t),
  };
}

function GK(n, e) {
  const t = (n.animationValue ??= {
    offsetU: 0,
    offsetV: 0,
    scaleU: 1,
    scaleV: 1,
    rotation: 0,
  });
  ((t.offsetU = 0),
    (t.offsetV = 0),
    (t.scaleU = 1),
    (t.scaleV = 1),
    (t.rotation = 0),
    n.uvControllers &&
      ((t.offsetU = P2(n.uvControllers[0].update(e))),
      (t.offsetV = P2(n.uvControllers[1].update(e))),
      (t.scaleU = P2(n.uvControllers[2].update(e))),
      (t.scaleV = P2(n.uvControllers[3].update(e))),
      (t.rotation = P2(n.uvControllers[4].update(e)))));
  const i = n.alphaController ? n.alphaController.update(e) : n.baseAlpha;
  return ((n.currentAlpha = P2(i)), t);
}

function BK(n, e) {
  (n.uvControllers?.forEach((t) => t.reset(e)),
    n.alphaController?.reset(e),
    (n.currentAlpha = n.baseAlpha));
}







function LK(n) {
  if (!n || typeof n != "object") return !1;
  const e = n;
  return (
    e.kind === "visibility" &&
    !!(e.base && e.keys && Array.isArray(e.keys.records))
  );
}



function P2(n) {
  return Math.fround(n);
}

const Cb = new DataView(new ArrayBuffer(4));



function CB(texture, properties, flipWinding = false, bakedNodes = false) { return createBasicTextureMaterial(texture, properties, flipWinding, bakedNodes); }

function EB(n, e, t, i) {
  ((n.uniforms.uvControllerEnabled.value = t ? 1 : 0),
    n.uniforms.uvOffsetScale.value.set(
      e.offsetU,
      e.offsetV,
      e.scaleU,
      e.scaleV,
    ),
    (n.uniforms.uvRotation.value = e.rotation),
    (n.uniforms.textureAlpha.value = DK(i)),
    (n.uniforms.currentAlpha.value = i));
}

function PK(n, e) {
  n.uniforms.lightFactor.value = e;
}

function FK(n, e, t) {
  TB(n.uniforms.materialColor.value, e, t);
}

function DK(n) {
  return n === 1
    ? 1
    : ((Number.isFinite(n) ? Math.trunc(Math.fround(n * 255)) : -2147483648) &
        255) /
        255;
}





function TB(n, e, t) {
  return n.set(
    ((t >>> 16) & 255) / 255,
    ((t >>> 8) & 255) / 255,
    (t & 255) / 255,
    ((e >>> 24) & 255) / 255,
  );
}





class Zm extends ColorKeyController {
  static fromParsed(parsed) { return ColorKeyController.fromParsed.call(Zm, parsed); }
}











class Qm {
  constructor(e, t, i) {
    if (((this.geometry = t), e.data.length === 0))
      throw new Error("MorphController 缺少 MorphData。");
    ((this.channel = qK(e)),
      (this.attribute = t.getAttribute(this.channel)),
      KK(e, this.channel, this.attribute),
      (this.weights = e.data.map((r) =>
        on.fromParsed({ kind: "float-controller", base: e.base, keys: r.keys }),
      )),
      (this.weightOutputs = this.weights.map(() => 0)),
      (this.targets = e.data.map((r) =>
        Float32Array.from(
          (this.channel === "position" ? r.positions : r.uvs).flat(),
        ),
      )),
      (this.refreshBounds = i),
      this.attribute.setUsage(r1));
  }
  geometry;
  weights;
  targets;
  channel;
  attribute;
  weightOutputs;
  refreshBounds;
  lastTick;
  static fromParsed(e, t, i = !0) {
    if (!jK(e)) throw new Error("VertexData property 不是 MorphController。");
    return new Qm(e, t, i);
  }
  update(e) {
    const t = Math.trunc(e) >>> 0;
    if (t === this.lastTick) return;
    this.lastTick = t;
    const i = this.weightOutputs;
    for (let s = 0; s < this.weights.length; s += 1)
      i[s] = this.weights[s].update(t);
    const r = this.attribute.array;
    (this.channel === "position"
      ? (r.fill(0),
        this.targets.forEach((s, o) => HK(r, s, i[o])),
        this.refreshBounds &&
          (this.geometry.computeBoundingBox(),
          this.geometry.computeBoundingSphere()))
      : this.targets.forEach((s, o) => WK(r, s, i[o])),
      (this.attribute.needsUpdate = !0));
  }
  reset(e) {
    (this.weights.forEach((t) => t.reset(e)), (this.lastTick = void 0));
  }
  play(e, t) {
    (this.weights.forEach((i) => i.play(e, t)), (this.lastTick = void 0));
  }
  setCycleMode(e) {
    this.weights.forEach((t) => t.setCycleMode(e));
  }
  stop(e) {
    (this.update(e), this.weights.forEach((t) => t.stop(e)));
  }
}

function WK(n, e, t) {
  const i = Fi(1 - t);
  for (let r = 0; r < n.length; r += 1) n[r] = Fi(Fi(e[r] * t) + Fi(n[r] * i));
}

function HK(n, e, t) {
  for (let i = 0; i < n.length; i += 1) n[i] = Fi(n[i] + Fi(e[i] * t));
}

function qK(n) {
  if (n.data.some((r) => r.normals || r.scalars))
    throw new Error("MorphController normal/scalar channel 尚未映射。");
  const e = n.data[0].positions !== void 0,
    t = n.data[0].uvs !== void 0;
  if (e === t)
    throw new Error("MorphController 必须且只能包含 position 或 UV channel。");
  const i = e ? "position" : "uv";
  if (n.data.some((r) => !!r.positions !== e || !!r.uvs !== t))
    throw new Error(`MorphController ${i} channel 在 records 间不一致。`);
  return i;
}

function KK(n, e, t) {
  if (!(t?.array instanceof Float32Array))
    throw new Error(`Morph ${e} buffer 必须为 Float32Array。`);
  const i = e === "position" ? 3 : 2;
  if (t.itemSize !== i) throw new Error(`Morph ${e} buffer 分量数应为 ${i}。`);
  for (const r of n.data) {
    const s = e === "position" ? r.positions : r.uvs;
    if (r.vertexCount !== t.count || s.length !== t.count)
      throw new Error(
        `MorphController ${e} 顶点数 ${r.vertexCount} 与 mesh ${t.count} 不一致。`,
      );
  }
}

function jK(n) {
  if (!n || typeof n != "object") return !1;
  const e = n;
  return e.kind === "morph-controller" && !!(e.base && Array.isArray(e.data));
}

function Fi(n) {
  return Math.fround(n);
}

class XK {
  count;
  source;
  object;
  cullingObject;
  bounds;
  serializedLocal;
  clientWorld;
  clientWorldInverse;
  clientWorldElementsViews;
  clientWorldMatrix;
  clientWorldInverseMatrix;
  animatedTransform;
  animatedDescendants;
  matrixDirty;
  boundsDirty;
  enabled;
  cullingTraversalMode;
  childOffsets;
  childIndices;
  parent;
  visibility;
  prs;
  prsRuntime;
  prsFallback;
  needsClientWorldInverse;
  indexBySource;
  onCollect;
  onVisible;
  runtimeBounds;
  ordinaryBoundsStore;
  constructor(e) {
    const t = e.length;
    ((this.count = t),
      (this.source = new Array(t)),
      (this.object = new Array(t)),
      (this.cullingObject = new Array(t)),
      (this.bounds = new Array(t)),
      (this.serializedLocal = new Array(t)),
      (this.animatedTransform = new Uint8Array(t)),
      (this.animatedDescendants = new Uint8Array(t)),
      (this.matrixDirty = new Uint8Array(t).fill(1)),
      (this.boundsDirty = new Uint8Array(t).fill(1)),
      (this.enabled = new Uint8Array(t)),
      (this.cullingTraversalMode = new Int32Array(t)),
      (this.onCollect = new Array(t)),
      (this.onVisible = new Array(t)),
      (this.visibility = new Array(t)),
      (this.prs = new Array(t)),
      (this.prsRuntime = new Array(t)),
      (this.prsFallback = new Array(t)),
      (this.needsClientWorldInverse = new Uint8Array(t)),
      (this.runtimeBounds = new Array(t)),
      (this.ordinaryBoundsStore = new Array(t).fill(void 0)),
      (this.indexBySource = new Map()));
    const i = new Float64Array(t * 16);
    ((this.clientWorld = i),
      (this.clientWorldInverse = new Float64Array(t * 16)),
      (this.clientWorldElementsViews = new Array(t)),
      (this.clientWorldMatrix = new Array(t)),
      (this.clientWorldInverseMatrix = new Array(t)));
    for (let a = 0; a < t; a += 1) {
      const c = e[a];
      ((this.source[a] = c.source),
        (this.object[a] = c.object),
        (this.cullingObject[a] = c.cullingObject),
        (this.bounds[a] = c.bounds),
        (this.serializedLocal[a] = c.serializedLocal),
        (this.animatedTransform[a] = c.animatedTransform ? 1 : 0),
        (this.animatedDescendants[a] = c.animatedDescendants ? 1 : 0),
        (this.enabled[a] = c.enabled ? 1 : 0),
        (this.cullingTraversalMode[a] = c.cullingTraversalMode),
        (this.onCollect[a] = c.onCollect),
        (this.onVisible[a] = c.onVisible),
        (this.visibility[a] = c.visibility),
        (this.prs[a] = c.prs),
        (this.prsRuntime[a] = c.prsRuntime),
        (this.prsFallback[a] = c.prsFallback),
        (this.needsClientWorldInverse[a] = c.needsClientWorldInverse ? 1 : 0),
        i.set(c.initialClientWorld, a * 16));
      const l = i.subarray(a * 16, (a + 1) * 16);
      this.clientWorldElementsViews[a] = l;
      const u = this.clientWorldInverse.subarray(a * 16, (a + 1) * 16);
      ((this.clientWorldMatrix[a] = Gb(l)),
        (this.clientWorldInverseMatrix[a] = Gb(u)),
        this.indexBySource.set(c.source, a));
    }
    const r = new Int32Array(t + 1),
      s = new Int32Array(t).fill(-1),
      o = [];
    for (let a = 0; a < t; a += 1) {
      r[a] = o.length;
      const c = e[a].source.children;
      for (let l = 0; l < c.length; l += 1) {
        const u = this.indexBySource.get(c[l]);
        if (u === void 0)
          throw new Error("TrackSceneStore child 缺少 preorder 记录。");
        (o.push(u), (s[u] = a));
      }
    }
    ((r[t] = o.length),
      (this.childOffsets = r),
      (this.parent = s),
      (this.childIndices = Int32Array.from(o)));
  }
  ordinaryBounds(e) {
    let t = this.ordinaryBoundsStore[e];
    return (
      t ||
        ((t = { kind: "ordinary", min: [0, 0, 0], max: [0, 0, 0] }),
        (this.ordinaryBoundsStore[e] = t)),
      t
    );
  }
  readClientWorld(e, t) {
    t.copy(this.clientWorldMatrix[e]);
  }
  readClientWorldInverse(e, t) {
    t.copy(this.clientWorldInverseMatrix[e]);
  }
}

function Gb(n) {
  const e = new v2();
  return ((e.elements = n), e);
}

const Bb = new H(),
  Rb = new v2(),
  Ib = new v2(),
  Iu = new Set();

async function c5(n, e, t, i, r = {}) {
  return W1(
    n,
    e,
    `${i.id}:TimeAttackRenderScene`,
    (s) => sn(e, t, i, s, r.advertisementSources),
    r,
  );
}

async function W1(n, e, t, i, r = {}) {
  const s = n.root.kind === "track" ? n.root.scene : n.root,
    o =
      n.root.kind === "track"
        ? n.root.trackObjects.filter((B) => B.kind === "ToBlackPlane")
        : [],
    a = [s, ...(r.additionalRoots ?? [])],
    c = a.map(hB);
  c.forEach(ZK);
  const l = new Set(r.matrixOnlyRoots ?? []),
    u = r.environment === void 0,
    h = r.environment ?? (await rn.load(e)),
    d = r.stageBinding ?? new ha(),
    f = new Map(
      c.flatMap((B, R) =>
        l.has(a[R]) ? [] : B.candidates.map(($) => [$.node, $]),
      ),
    ),
    p = r.textureCache === void 0,
    v = r.textureCache ?? new Map(),
    w = new Set(),
    g = new Set(),
    y = new Set(),
    b = [],
    A = [];
  let x;
  const M = [];
  let E,
    _ = 0,
    C;
  const S = new Map();
  o.length;
  const G = globalThis.localStorage?.getItem("ksProbeBatchMode") ?? "static",
    I = Math.max(
      1,
      Number(globalThis.localStorage?.getItem("ksProbeBatchMin")) || 1,
    ),
    L = Math.max(
      1,
      Number(globalThis.localStorage?.getItem("ksProbeBatchCell")) || 384,
    ),
    k = void 0,
    D = [],
    V = [];
  let K,
    P = 0,
    q,
    e0 = [];
  const Q = new T2();
  ((Q.name = t),
    r.convertClientCoordinates !== !1 && (Q.rotation.x = -Math.PI / 2),
    Q.scale.setScalar(r.scale ?? 1));
  const U = new v2(),
    O = new v2(),
    F = new v2(),
    z = { right: new H(), up: new H(), back: new H(), position: new H() };
  let Y = !1,
    X,
    l0;
  {
    let B = 0,
      R = 0,
      $ = 0;
    for (const o0 of f.values())
      if (!Vu(o0))
        if (o0.geometryKind === "toon-rigid")
          B += o0.node.rigidGeometry.faces.length * 3;
        else {
          const u0 = o0.node.vertexData;
          ((R += u0.vertexCount),
            ($ +=
              o0.geometryKind === "tri-strip"
                ? Vp(u0.indices).length
                : u0.indices.length));
        }
    (B > 0 && (X = aj(B)), R > 0 && (l0 = cj(R, $)));
  }
  const r0 = [];
  let j, F0;
  try {
    for (const B of a) {
      const R = await G0(B, new v2(), !1);
      Q.add(r0[R].cullingObject);
    }
    (oj([X, l0]),
      (j = new XK(r0)),
      o.length > 0 && (F0 = new Uint8Array(j.count)),
      k && k.length > 0);
  } catch (B) {
    throw (E0(), B);
  }
  const O0 = [];
  for (let B = 0; B < j.count; B += 1)
    j.parent[B] === -1 && O0.push(j.object[B]);
  return {
    object: Q,
    rootObjects: O0,
    settings: n.settings,
    setNodeScale: (B, R) => {
      const $ = j.indexBySource.get(B);
      if (
        $ === void 0 ||
        j.prs[$] ||
        R.length !== 3 ||
        R.some((o0) => !Number.isFinite(o0))
      )
        throw new Error("原模型节点 scale writer 与控制器 owner 不匹配。");
      (Jm(j.serializedLocal[$], {
        basis: B.transform,
        position: B.position,
        scale: R,
      }),
        (j.animatedTransform[$] = 1));
      for (let o0 = j.parent[$]; o0 >= 0; o0 = j.parent[o0])
        j.animatedDescendants[o0] = 1;
    },
    clientWorldElements: (B) => {
      const R = j.indexBySource.get(B);
      return R === void 0 ? void 0 : j.clientWorldElementsViews[R];
    },
    clientWorldBounds: (B) => {
      const R = j.indexBySource.get(B),
        $ = R === void 0 ? void 0 : j.runtimeBounds[R];
      return $?.kind !== "ordinary" || r.convertClientCoordinates === !1
        ? $
        : {
            kind: "ordinary",
            min: [$.min[0], -$.max[2], $.min[1]],
            max: [$.max[0], -$.min[2], $.max[1]],
          };
    },
    reset: (B) => {
      (QK(j, B),
        p8(j, (R) => R.reset(B)),
        M.forEach(({ state: R, materialControllers: $ }) => {
          (BK(R, B), $?.forEach((o0) => o0?.reset(B)));
        }),
        A.forEach((R) => R.reset(B)));
    },
    playControllers: (B, R) => {
      (ku(j, ($, o0) => GW($, o0, B, R)),
        p8(j, ($) => $.play(B, R)),
        M.forEach(({ state: $ }) => Lu($).forEach((o0) => o0.play(B, R))),
        A.forEach(($) => $.play(B, R)));
    },
    setControllerCycleMode: (B) => {
      (ku(j, (R, $) => BW($, B)),
        p8(j, (R) => R.setCycleMode(B)),
        M.forEach(({ state: R }) => Lu(R).forEach(($) => $.setCycleMode(B))),
        A.forEach((R) => R.setCycleMode(B)));
    },
    stopControllers: (B) => {
      (ku(j, (R, $) => RW(R, $, B)),
        p8(j, (R) => R.stop(B)),
        M.forEach(({ state: R }) => Lu(R).forEach(($) => $.stop(B))),
        A.forEach((R) => R.stop(B)));
    },
    update: (B, R, $, o0) => {
      (r.advanceEnvironment !== !1 && d.beginFrame(B),
        (_ = B),
        JK(j, B),
        R2(B, R),
        o2(R),
        f2());
      const u0 = d.lightFactor();
      (C !== u0 && (g.forEach((c0) => PK(c0, u0)), (C = u0)),
        O2(),
        R &&
          $ &&
          o0 &&
          b.forEach(({ outline: c0, body: x0 }) => {
            Ob(x0) && (x0.updateWorldMatrix(!1, !1), c0.update(x0, R, $, o0));
          }));
    },
    refreshRootWorldMatrices: () => {
      if (E !== void 0)
        for (let B = 0; B < j.count; B += 1)
          j.parent[B] === -1 && BB(j, B, Q.matrixWorld);
    },
    pruneWorldMatrixRecursion: () => {
      if (!Y) {
        ((Y = !0), (Q.matrixWorldAutoUpdate = !1));
        for (let B = 0; B < j.count; B += 1)
          ((j.object[B].matrixWorldAutoUpdate = !1),
            (j.cullingObject[B].matrixWorldAutoUpdate = !1));
      }
    },
    dispose: E0,
  };
  function z0(B, R) {
    const $ = B.vertexCursor,
      o0 = B.positions,
      u0 = B.normals,
      c0 = B.uvs;
    R.faces.forEach((S0, U0) => {
      for (let m0 = 0; m0 < 3; m0 += 1) {
        const q0 = R.positions[S0.positionIndices[m0]],
          t2 = R.texcoords[S0.texcoordIndices[m0]],
          Z0 = R.normals[t2.normalIndex],
          B0 = $ + U0 * 3 + m0,
          r2 = B0 * 3;
        ((o0[r2] = q0[0]),
          (o0[r2 + 1] = q0[1]),
          (o0[r2 + 2] = q0[2]),
          (u0[r2] = Z0[0]),
          (u0[r2 + 1] = Z0[1]),
          (u0[r2 + 2] = Z0[2]));
        const Z = B0 * 2;
        ((c0[Z] = t2.u), (c0[Z + 1] = t2.v));
      }
    });
    const x0 = R.faces.length * 3;
    B.vertexCursor += x0;
    const C0 = new t9();
    return (
      C0.setAttribute("position", B.positionAttribute),
      C0.setAttribute("normal", B.normalAttribute),
      C0.setAttribute("uv", B.uvAttribute),
      (C0.boundingSphere = B.sphere),
      C0.setDrawRange($, x0),
      B.views.push(C0),
      C0
    );
  }
  function W(B, R, $, o0) {
    if (!R.positions)
      throw new Error(
        `${o0} TimeAttack geometry channel：position=${!!R.positions} normal=${!!R.normals} uvSets=${R.uvSetsPerVertex}。`,
      );
    const u0 = B.vertexCursor;
    (B.positions.set(R.positions.flat(), u0 * 3),
      R.normals && B.normals.set(R.normals.flat(), u0 * 3),
      B.uvs.set(
        R.uvSetsPerVertex === 0
          ? new Float32Array(R.vertexCount * 2)
          : R.uvs.flatMap((U0) => U0[0]),
        u0 * 2,
      ),
      B.colors.set(
        R.diffuseColors?.flatMap(_B) ??
          Array.from({ length: R.vertexCount }, () => [1, 1, 1, 1]).flat(),
        u0 * 4,
      ));
    const c0 = $ ? Vp(R.indices) : [...R.indices],
      x0 = B.indices,
      C0 = B.indexCursor;
    for (let U0 = 0; U0 < c0.length; U0 += 1) x0[C0 + U0] = c0[U0] + u0;
    ((B.vertexCursor += R.vertexCount), (B.indexCursor += c0.length));
    const S0 = new t9();
    return (
      S0.setAttribute("position", B.positionAttribute),
      S0.setAttribute("normal", B.normalAttribute),
      S0.setAttribute("uv", B.uvAttribute),
      S0.setAttribute("primaryColor", B.colorAttribute),
      S0.setIndex(B.indexAttribute),
      (S0.boundingSphere = B.sphere),
      S0.setDrawRange(C0, c0.length),
      B.views.push(S0),
      S0
    );
  }
  function R2(B, R) {
    Hc += 1;
    const $ = I0(R);
    (Q.updateWorldMatrix(!0, !1),
      Y &&
        Q.matrixWorld.multiplyMatrices(
          Q.parent ? Q.parent.matrixWorld : U,
          Q.matrix,
        ));
    for (let x0 = 0; x0 < D.length; x0 += 1)
      D[x0].matrixWorld.copy(Q.matrixWorld);
    const o0 = !O.equals(Q.matrixWorld);
    O.copy(Q.matrixWorld);
    let u0;
    R &&
      (R.updateWorldMatrix(!0, !1),
      F.copy(Q.matrixWorld).invert().multiply(R.matrixWorld),
      (u0 = tj(z, F)));
    const c0 = !R || o0 || $;
    (nj(j, U, Q.matrixWorld, u0, B, c0), (E = u0));
  }
  function I0(B) {
    r.cameraCentered && B && Q.position.copy(B.position);
    const R = !!B;
    if (Y === R) return !1;
    ((Y = R), (Q.matrixWorldAutoUpdate = !Y));
    for (let $ = 0; $ < j.count; $ += 1)
      ((j.object[$].matrixWorldAutoUpdate = !Y),
        (j.cullingObject[$].matrixWorldAutoUpdate = !Y));
    return !0;
  }
  function o2(B) {
    if (!B) {
      (Gp(j), ej(j));
      return;
    }
    if (!(B instanceof Z9))
      throw new Error(
        "P3528 scene hierarchy culling 需要 perspective camera。",
      );
    if (F0) {
      Gp(j);
      const R = B.matrixWorld.elements;
      Sq(j, o, [R[12], R[13], R[14]], F0, Q.matrixWorld);
    }
    wq(j, B, F0);
  }
  async function G0(B, R, $) {
    if (B.serializedBoundsOverride !== 0)
      throw new Error(
        `${B.name || B.className} 的 serialized bounds override 尚未映射。`,
      );
    const o0 = r.rootPoseOverrides?.get(B),
      u0 = o0 ? GB(o0) : uj(B),
      c0 = B.slotOccurrences[0] ? TK(B.slotOccurrences[0].value) : void 0,
      x0 = Lb(B),
      C0 = !!x0 || B.className === "ReBillboard" || c0 !== void 0;
    !$ && !C0 && B.nodeEnabled;
    const S0 = R.clone().multiply(u0),
      U0 = f.get(B),
      m0 = r0.length,
      q0 = M.length,
      t2 = A.length,
      Z0 = U0 ? await D0(U0, S0, m0) : new T2(),
      B0 = M.length > q0 ? M[q0] : void 0,
      r2 = A.length > t2 ? A[t2] : void 0;
    ((Z0.name = B.name),
      Z0.matrix.copy(u0),
      (Z0.matrixAutoUpdate = !1),
      (Z0.visible = B.nodeEnabled !== 0));
    const Z = new T2();
    ((Z.name = `${B.name || B.className}:P3528Cull`),
      (Z.matrixAutoUpdate = !1),
      Z.add(Z0));
    const N0 = {
      source: B,
      object: Z0,
      cullingObject: Z,
      bounds: B.bounds0,
      cullingTraversalMode: B.cullingTraversalMode,
      serializedLocal: u0,
      prsFallback: o0
        ? hj(o0)
        : { position: B.position, basis: B.transform, scale: B.scale },
      needsClientWorldInverse: U0?.geometryKind === "toon-rigid",
      animatedTransform: !!x0 || B.className === "ReBillboard",
      animatedDescendants: !1,
      enabled: B.nodeEnabled !== 0,
      initialClientWorld: S0.elements,
      visibility: c0,
      prs: x0,
      prsRuntime: x0 ? zG() : void 0,
      onCollect: B0?.needsUpdate ? () => dj(B0, _) : void 0,
      onVisible: r2 ? () => r2.update(_) : void 0,
    };
    r0.push(N0);
    for (const b0 of B.children) {
      const M0 = await G0(b0, S0, $ || C0),
        g0 = r0[M0];
      ((N0.animatedDescendants ||=
        g0.animatedTransform || g0.animatedDescendants),
        Z0.add(g0.cullingObject));
    }
    return m0;
  }
  async function D0(B, R, $, o0) {
    const u0 = i(B.state.texture.value);
    if (u0.status === "unresolved")
      throw new Error(
        `${B.node.name || B.node.className} texture ${B.state.texture.value.name}：${u0.reason}`,
      );
    let c0;
    if (u0.status === "found") {
      const $0 = [
        u0.entry.virtualPath,
        B.state.texture.value.addressU,
        B.state.texture.value.addressV,
        B.state.texture.value.minFilter,
        B.state.texture.value.magFilter,
        B.state.texture.value.mipFilter,
        B.state.texture.value.maxAnisotropy,
      ].join("|");
      ((c0 = v.get($0)),
        c0 ||
          ((c0 = await AB(u0.entry, B.state.texture.value)), v.set($0, c0)));
    }
    const x0 = B.geometryKind === "toon-rigid";
    (x0 && (c0 = YK(B, c0, x)),
      c0 &&
        B.state.alpha.value.blendEnable === 0 &&
        (x = { texture: c0, state: B.state.texture.value }));
    const C0 = R.determinant() < 0;
    let S0;
    if (x0) ((S0 = bo(c0, { kind: "normal-projection" })), Mo(S0, B.state));
    else {
      const $0 = JSON.stringify({
        texture: c0 ? c0.uuid : null,
        inverted: C0,
        textureState: B.state.texture.value,
        alpha: B.state.alpha.value,
        fogSelector: B.state.fog.value.selector,
        material: B.state.material.value,
        zbuffer: B.state.zbuffer.value,
        backface: B.state.backface.value,
      });
      let M0 = S.get($0);
      (M0 || ((M0 = CB(c0 ?? null, B.state, C0)), S.set($0, M0)), (S0 = M0));
    }
    S0.userData.toon = x0;
    const U0 = _K(
        B.state.texture.value.uvControllers,
        B.state.texture.value.alphaController,
        B.state.texture.value.scalar,
      ),
      m0 =
        B.state.material.value.mode === 2
          ? B.state.material.value.controllers.map(($0) =>
              $0 ? Zm.fromParsed($0) : void 0,
            )
          : void 0,
      q0 = m0
        ? [
            B.state.material.value.ambient,
            B.state.material.value.diffuse,
            B.state.material.value.specular,
            B.state.material.value.emissive,
          ]
        : void 0,
      t2 =
        U0.uvControllers !== void 0 ||
        U0.alphaController !== void 0 ||
        m0?.some(($0) => $0 !== void 0) === !0;
    (x0 ||
      EB(
        S0,
        { offsetU: 0, offsetV: 0, scaleU: 1, scaleV: 1, rotation: 0 },
        !1,
        U0.currentAlpha,
      ),
      M.push({
        state: U0,
        material: S0,
        toon: x0,
        materialControllers: m0,
        materialColors: q0,
        needsUpdate: t2,
      }),
      x0 ? w.add(S0) : g.add(S0));
    let Z0;
    (B.geometryKind === "toon-rigid"
      ? (Z0 = z0(X, B.node.rigidGeometry))
      : Vu(B)
        ? (Z0 = lj(
            B.node.vertexData,
            B.geometryKind === "tri-strip",
            B.node.name || B.node.className,
          ))
        : (Z0 = W(
            l0,
            B.node.vertexData,
            B.geometryKind === "tri-strip",
            B.node.name || B.node.className,
          )),
      y.add(Z0));
    const B0 = B.node.vertexData?.property;
    B0 &&
      typeof B0 == "object" &&
      B0.kind === "morph-controller" &&
      A.push(Qm.fromParsed(B0, Z0));
    const r2 = new D2(Z0, S0);
    if (
      ((r2.frustumCulled = !1),
      (r2.userData.batchKind = x0
        ? "toon"
        : Vu(B)
          ? "morph"
          : B.state.alpha.value.blendEnable !== 0
            ? "blend"
            : B.node.slotOccurrences[0]
              ? "visibility"
              : Lb(B.node) || B.node.className === "ReBillboard"
                ? "animated"
                : "static"),
      B.node.sortDepthBias === void 0)
    )
      throw new Error(
        `${B.node.name || B.node.className} 缺少 sortDepthBias。`,
      );
    if (
      (ie(r2, B.node.sortDepthBias, S0.transparent, S0.transparent ? -0.01 : 0),
      (r2.renderOrder = 0),
      (r2.onBeforeRender = ($0, M0, g0) => {
        (uK(c0, $0),
          x0 &&
            (Bb.set(g0.position.x, -g0.position.z, g0.position.y),
            j.readClientWorld($, Rb),
            j.readClientWorldInverse($, Ib),
            xo(S0, h, d, Rb, Ib, Bb)));
      }),
      !x0)
    )
      return r2;
    if (!B.node.rigidGeometry)
      throw new Error(
        `${B.node.name || B.node.className} outline 缺少 Toon face adjacency。`,
      );
    const Z = B.state.toon.value.flags[1] !== 0,
      N0 = new N6(
        B.node.rigidGeometry,
        B.state.toon.value.words[7],
        B.state.toon.value.words[8],
        Z,
      );
    if ((b.push({ outline: N0, body: r2 }), !Z)) return r2;
    ((N0.object.frustumCulled = !1), ie(N0.object, B.node.sortDepthBias, !0));
    const b0 = new T2();
    return (b0.add(r2, N0.object), b0);
  }
  function E0() {
    (y.forEach((B) => B.dispose()),
      w.forEach((B) => B.dispose()),
      g.forEach((B) => B.dispose()),
      K?.dispose(),
      b.forEach(({ outline: B }) => B.dispose()),
      p && v.forEach((B) => B.dispose()),
      u && h.dispose());
  }
  function f2() {
    const B = K,
      R = q;
    if (!B || !R) return;
    const $ = P;
    for (let o0 = 0; o0 < e0.length; o0 += 1) {
      const u0 = e0[o0],
        c0 = j.enabled[u0] !== 0 && Ob(j.cullingObject[u0]),
        x0 = j.clientWorldMatrix[u0].elements,
        C0 = u0 * 3;
      for (let S0 = 0; S0 < 3; S0 += 1) {
        const U0 = C0 + S0,
          m0 = U0 % $,
          t2 = (((U0 - m0) / $) * $ + m0) * 4;
        c0
          ? ((R[t2] = x0[S0]),
            (R[t2 + 1] = x0[S0 + 4]),
            (R[t2 + 2] = x0[S0 + 8]),
            (R[t2 + 3] = x0[S0 + 12]))
          : ((R[t2] = 0), (R[t2 + 1] = 0), (R[t2 + 2] = 0), (R[t2 + 3] = 0));
      }
    }
    B.needsUpdate = !0;
  }
  function O2() {
    for (let B = 0; B < V.length; B += 1) {
      const R = V[B],
        $ = R.source.uniforms,
        o0 = R.baked.uniforms;
      ((o0.uvControllerEnabled.value = $.uvControllerEnabled.value),
        o0.uvOffsetScale.value.copy($.uvOffsetScale.value),
        (o0.uvRotation.value = $.uvRotation.value),
        (o0.textureAlpha.value = $.textureAlpha.value),
        (o0.currentAlpha.value = $.currentAlpha.value),
        (o0.lightFactor.value = $.lightFactor.value),
        o0.materialColor.value.copy($.materialColor.value));
    }
  }
}

function YK(n, e, t) {
  if (e) return e;
  const i = n.node.name || n.node.className;
  if (n.state.alpha.value.blendEnable !== 0)
    throw new Error(`${i} Toon 空纹理的 blend 组 stage0 前驱顺序尚未闭合。`);
  if (!t)
    throw new Error(`${i} Toon 空纹理前没有已绑定的 opaque stage0 纹理。`);
  const r = kb(n.state.texture.value);
  if (!r || r !== kb(t.state))
    throw new Error(`${i} Toon 空纹理与 opaque stage0 前驱的采样状态不一致。`);
  return t.texture;
}

function kb(n) {
  if (!(n.uvControllers.some(Boolean) || n.alphaController !== void 0))
    return [
      n.textureOp,
      n.addressU,
      n.addressV,
      n.minFilter,
      n.magFilter,
      n.mipFilter,
      n.maxAnisotropy,
      n.scalar,
    ].join("|");
}

function ZK(n) {
  const e = n.omitted.find(
    (r) =>
      r.node.className !== "ReBillboard" ||
      ![1, 3, 4, 5].includes(r.node.orientationMode ?? -1),
  );
  if (e) throw new Error(`Track render scene 含未闭合 branch：${e.reason}。`);
  const t = n.candidates.find((r) => r.issues.length > 0);
  if (t)
    throw new Error(`${t.node.name || t.node.className}：${t.issues[0]}。`);
  const i = n.candidates.find((r) => r.state.fog.value.selector !== 0);
  if (i)
    throw new Error(
      `${i.node.name || i.node.className} 的 Fog pass 尚未闭合。`,
    );
}

function Lb(n) {
  const e = n.slotOccurrences[1];
  if (!e) return;
  const t = e.value;
  if (!P6(t)) throw new Error(`${n.name || n.className} PRS 类型不受支持。`);
  const i = Nm(t);
  if (i) throw new Error(`${n.name || n.className} PRS: ${i}。`);
  return t;
}

function QK(n, e) {
  for (let t = 0; t < n.count; t += 1) {
    n.matrixDirty[t] = 1;
    const i = n.prsRuntime[t];
    i &&
      ((i.anchor = Math.trunc(e) >>> 0),
      (i.previousCycle = 0),
      (i.reverseHalf = !1),
      (i.frequencyOverride = 1),
      (i.frozenTime = void 0));
  }
}

function ku(n, e) {
  for (let t = 0; t < n.count; t += 1) {
    const i = n.prs[t],
      r = n.prsRuntime[t];
    i && r && e(i, r);
  }
}

function p8(n, e) {
  for (let t = 0; t < n.count; t += 1) {
    const i = n.visibility[t];
    i && e(i);
  }
}

function JK(n, e) {
  for (let t = 0; t < n.count; t += 1) {
    const i = n.parent[t],
      r = i < 0 ? !0 : n.enabled[i] !== 0,
      s = n.enabled[t] !== 0;
    let o = r && n.source[t].nodeEnabled !== 0;
    const a = n.visibility[t];
    (o && a && (o = a.update(e) !== 0),
      (n.enabled[t] = o ? 1 : 0),
      !s && o && (n.matrixDirty[t] = 1));
  }
}

let Wr = new Uint8Array(0);

function ej(n) {
  Wr.length < n.count && (Wr = new Uint8Array(n.count));
  for (let e = 0; e < n.count; e += 1) {
    const t = n.parent[e];
    if (t >= 0 && (Wr[t] === 0 || n.enabled[t] === 0)) {
      Wr[e] = 0;
      continue;
    }
    Wr[e] = 1;
    const i = n.enabled[e] !== 0;
    ((n.cullingObject[e].visible = i),
      i && (n.onCollect?.[e]?.(), n.onVisible?.[e]?.()));
  }
}

function Lu(n) {
  return [
    ...(n.uvControllers ?? []),
    ...(n.alphaController ? [n.alphaController] : []),
  ];
}

function tj(n, e) {
  const t = e.elements;
  return (
    n.right.set(t[0], t[1], t[2]).normalize(),
    n.up.set(t[4], t[5], t[6]).normalize(),
    n.back.set(t[8], t[9], t[10]).normalize(),
    n.position.set(t[12], t[13], t[14]),
    n
  );
}

const N5 = [],
  Vn = [],
  Vl = [],
  Nl = [],
  Ds = [];

function nj(n, e, t, i, r, s) {
  for (let o = 0; o < n.count; o += 1)
    if (n.parent[o] === -1)
      for (
        N5.length = 0,
          Vn.length = 0,
          Vl.length = 0,
          Nl.length = 0,
          Ds.length = 0,
          Pb(o, s ? 1 : 0, -1);
        N5.length > 0;
      ) {
        const a = N5.length - 1,
          c = N5[a];
        if (Vn[a] < 0) {
          if (((Vn[a] = 0), n.enabled[c] === 0)) {
            Pu(n);
            continue;
          }
          const d =
            Nl[a] !== 0 ||
            n.matrixDirty[c] !== 0 ||
            n.animatedTransform[c] !== 0;
          if (d) {
            const f = Vl[a],
              p = f < 0 ? t : n.object[f].matrixWorld;
            ij(n, c, f, e, p, i, r);
          }
          if (!d && n.animatedDescendants[c] === 0) {
            Pu(n);
            continue;
          }
          Ds[a] = d ? 1 : 0;
        }
        const l = N5[a],
          u = n.childOffsets[l],
          h = n.childOffsets[l + 1];
        if (Vn[a] < h - u) {
          const d = n.childIndices[u + Vn[a]];
          ((Vn[a] += 1), Pb(d, Ds[a], l));
          continue;
        }
        Pu(n);
      }
}

function Pb(n, e, t) {
  (N5.push(n), Vn.push(-1), Vl.push(t), Nl.push(e), Ds.push(0));
}

function Pu(n) {
  const e = N5.pop();
  (Vn.pop(), Vl.pop(), Nl.pop(), Ds.pop());
  const t = N5.length - 1;
  if (t >= 0) {
    const i = N5[t];
    n.boundsDirty[e] !== 0 &&
      n.cullingTraversalMode[i] !== 1 &&
      (n.boundsDirty[i] = 1);
  }
}

const Fb = UG(),
  Db = new WeakMap();

let Hc = 0;

function ij(n, e, t, i, r, s, o) {
  const a = n.object[e].matrix,
    c = n.prs[e],
    l = n.prsRuntime[e];
  if (c && l) {
    const d = !!(c.position && c.rotation && c.scale),
      f = d ? Db.get(c) : void 0;
    f && f.frame === Hc
      ? a.copy(f.matrix)
      : ($G(Fb, c, l, o, n.prsFallback[e]),
        Jm(a, Fb),
        d &&
          (f
            ? (f.matrix.copy(a), (f.frame = Hc))
            : Db.set(c, { frame: Hc, matrix: new v2().copy(a) })));
  } else a.copy(n.serializedLocal[e]);
  const u = t < 0 ? i : n.clientWorldMatrix[t],
    h = n.clientWorldMatrix[e];
  if ((h.multiplyMatrices(u, a), n.source[e].className === "ReBillboard")) {
    if (!s)
      throw new Error(`${n.source[e].name || "ReBillboard"} 更新需要 camera。`);
    (rj(h, h, n.source[e].orientationMode ?? 0, s),
      a.copy(u).invert().multiply(h));
  }
  (n.needsClientWorldInverse[e] !== 0 &&
    n.clientWorldInverseMatrix[e].copy(h).invert(),
    n.cullingObject[e].matrixWorld.copy(r),
    n.object[e].matrixWorld.multiplyMatrices(r, n.object[e].matrix),
    (n.matrixDirty[e] = 0),
    (n.boundsDirty[e] = 1));
}

const x3 = new H(),
  V1 = [new H(), new H(), new H()],
  N9 = [new H(), new H(), new H()],
  k9 = [new H(), new H(), new H()],
  oi = [new H(), new H(), new H()],
  M5 = new H(),
  Hr = new H(),
  Fu = new H(),
  g8 = new H(),
  Vb = new H(),
  L1 = new Array(9).fill(0);

function rj(n, e, t, i) {
  const r = e.elements;
  (x3.set(r[12], r[13], r[14]),
    V1[0].set(r[0], r[1], r[2]),
    V1[1].set(r[4], r[5], r[6]),
    V1[2].set(r[8], r[9], r[10]),
    N9[0].copy(V1[0]),
    N9[1].copy(V1[1]),
    N9[2].copy(V1[2]));
  let s = !1;
  for (let o = 0; o < 3; o += 1)
    if (N9[o].length() !== 1) {
      s = !0;
      break;
    }
  if (s)
    for (let o = 0; o < 3; o += 1) N9[o].multiplyScalar(1 / N9[o].length());
  if (t === 3) {
    M5.copy(i.position).sub(x3);
    const o = M5.dot(N9[0]),
      a = M5.dot(N9[2]),
      c = Math.sqrt(o * o + a * a);
    if (c < 9999999960041972e-28) {
      n.copy(e);
      return;
    }
    const l = Math.acos(o / c),
      u = a >= 0 ? 1.570796012878418 - l : l + 1.570796012878418,
      h = Math.cos(u),
      d = Math.sin(u);
    (k9[0].copy(V1[0]).multiplyScalar(h).addScaledVector(V1[2], -d),
      k9[1].copy(V1[1]),
      k9[2].copy(V1[0]).multiplyScalar(d).addScaledVector(V1[2], h),
      m8(n, k9[0], k9[1], k9[2], x3));
    return;
  }
  if (t === 5) {
    if ((M5.copy(i.position).sub(x3), M5.lengthSq() < 0.009999999776482582)) {
      n.copy(e);
      return;
    }
    M5.normalize();
    const o = i.back.dot(M5),
      a = o < 0.9999989867210388;
    (a && sj(M5, i.back, Math.acos(o)),
      a ? Nb(oi[0], i.right) : oi[0].copy(i.right),
      a ? Nb(oi[1], i.up) : oi[1].copy(i.up),
      oi[2].copy(M5).negate());
    for (let c = 0; c < 3; c += 1) {
      const l = oi[c],
        u = N9[0].dot(l),
        h = N9[1].dot(l),
        d = N9[2].dot(l);
      k9[c]
        .copy(V1[0])
        .multiplyScalar(u)
        .addScaledVector(V1[1], h)
        .addScaledVector(V1[2], d);
    }
    m8(n, k9[0], k9[1], k9[2], x3);
    return;
  }
  if (t !== 1 && t !== 4) {
    m8(n, N9[0], N9[1], N9[2], x3);
    return;
  }
  if (
    (Hr.copy(i.right).negate(),
    Du(k9[0], t === 4 ? Hr : i.back),
    Du(k9[1], i.up),
    Du(k9[2], t === 4 ? i.back : Hr),
    t === 4)
  )
    (ai(N9[0], k9[0]), ai(N9[1], k9[1]), ai(N9[2], k9[2]));
  else {
    const o = k9[0],
      a = k9[1],
      c = k9[2],
      l = Math.sqrt(a.z * a.z + c.z * c.z);
    if ((Fu.copy(o), g8.copy(c), l > 9999999974752427e-22)) {
      const u = a.z,
        h = c.z;
      (Hr.copy(g8).multiplyScalar(u),
        k9[0]
          .copy(a)
          .multiplyScalar(u)
          .addScaledVector(g8, h)
          .multiplyScalar(1 / l),
        k9[1]
          .copy(a)
          .multiplyScalar(h)
          .sub(Hr)
          .multiplyScalar(1 / l),
        k9[2].copy(Fu).negate());
    } else (k9[0].copy(g8), k9[2].copy(Fu).negate());
    (ai(N9[0], k9[0]), ai(N9[1], k9[1]), ai(N9[2], k9[2]));
  }
  m8(n, N9[0], N9[1], N9[2], x3);
}

function Du(n, e) {
  n.set(N9[0].dot(e), N9[1].dot(e), N9[2].dot(e));
}

function ai(n, e) {
  n.copy(V1[0])
    .multiplyScalar(e.x)
    .addScaledVector(V1[1], e.y)
    .addScaledVector(V1[2], e.z);
}

function sj(n, e, t) {
  Vb.copy(n).cross(e);
  const i = Math.cos(t),
    r = Math.sin(t),
    s = 1 - i,
    { x: o, y: a, z: c } = Vb;
  ((L1[0] = o * o * s + i),
    (L1[1] = c * r + o * a * s),
    (L1[2] = o * c * s - a * r),
    (L1[3] = o * a * s - c * r),
    (L1[4] = a * a * s + i),
    (L1[5] = o * r + a * c * s),
    (L1[6] = a * r + o * c * s),
    (L1[7] = a * c * s - o * r),
    (L1[8] = c * c * s + i));
}

function Nb(n, e) {
  n.set(
    e.x * L1[0] + e.y * L1[1] + e.z * L1[2],
    e.x * L1[3] + e.y * L1[4] + e.z * L1[5],
    e.x * L1[6] + e.y * L1[7] + e.z * L1[8],
  );
}

function m8(n, e, t, i, r) {
  n.set(e.x, t.x, i.x, r.x, e.y, t.y, i.y, r.y, e.z, t.z, i.z, r.z, 0, 0, 0, 1);
}

function Vu(n) {
  const e = n.node.vertexData?.property;
  return typeof e == "object" && e !== null && e.kind === "morph-controller";
}

function Hn(n, e, t, i = !1) {
  const r = new Z9();
  t ? n.compile(e, r, t) : n.compile(e, r);
  const s = new Set();
  if (
    (e.traverse((d) => {
      const f = d;
      if (!(!f.isMesh && !d.isSprite))
        for (const p of Array.isArray(f.material) ? f.material : [f.material]) {
          const v = p.uniforms,
            w = p.map;
          if ((w instanceof D9 && s.add(w), v))
            for (const g of Object.keys(v)) {
              const y = v[g]?.value;
              y instanceof D9 && s.add(y);
            }
        }
    }),
    s.forEach((d) => n.initTexture(d)),
    !i)
  )
    return;
  const o = new D1();
  ((o.fog = t?.fog ?? null),
    e.traverse((d) => {
      let f;
      if (d.type === "Mesh") {
        const p = d;
        f = new D2(p.geometry, p.material);
      } else if (d.isSprite) f = new GG(d.material);
      else return;
      ((f.matrixAutoUpdate = !1),
        f.matrix.copy(d.matrixWorld),
        (f.frustumCulled = !1),
        o.add(f));
    }));
  const a = n.getRenderTarget(),
    c = n.getViewport(new Y2()),
    l = n.getScissor(new Y2()),
    u = n.getScissorTest(),
    h = n.sortObjects;
  try {
    (n.setRenderTarget(null),
      n.setViewport(0, 0, 1, 1),
      n.setScissor(0, 0, 1, 1),
      n.setScissorTest(!0),
      (n.sortObjects = !1),
      n.render(o, r));
  } finally {
    ((n.sortObjects = h),
      n.setRenderTarget(a),
      n.setViewport(c),
      n.setScissor(l),
      n.setScissorTest(u),
      o.clear());
  }
}

function oj(n) {
  for (const e of n) {
    if (!e) continue;
    new R4()
      .setFromBufferAttribute(e.positionAttribute)
      .getBoundingSphere(e.sphere);
  }
}

function aj(n) {
  const e = new Float32Array(n * 3),
    t = new Float32Array(n * 3),
    i = new Float32Array(n * 2);
  return {
    positions: e,
    normals: t,
    uvs: i,
    colors: void 0,
    indices: void 0,
    positionAttribute: new _0(e, 3),
    normalAttribute: new _0(t, 3),
    uvAttribute: new _0(i, 2),
    colorAttribute: void 0,
    indexAttribute: void 0,
    sphere: new yr(),
    views: [],
    vertexCursor: 0,
    indexCursor: 0,
  };
}

function cj(n, e) {
  const t = new Float32Array(n * 3),
    i = new Float32Array(n * 3),
    r = new Float32Array(n * 2),
    s = new Float32Array(n * 4),
    o = new Uint32Array(e);
  return {
    positions: t,
    normals: i,
    uvs: r,
    colors: s,
    indices: o,
    positionAttribute: new _0(t, 3),
    normalAttribute: new _0(i, 3),
    uvAttribute: new _0(r, 2),
    colorAttribute: new _0(s, 4),
    indexAttribute: new _0(o, 1),
    sphere: new yr(),
    views: [],
    vertexCursor: 0,
    indexCursor: 0,
  };
}

function lj(n, e, t) {
  if (!n.positions)
    throw new Error(
      `${t} TimeAttack geometry channel：position=${!!n.positions} normal=${!!n.normals} uvSets=${n.uvSetsPerVertex}。`,
    );
  const i = e ? Vp(n.indices) : [...n.indices],
    r = new t9();
  return (
    r.setAttribute("position", new M1(n.positions.flat(), 3)),
    n.normals && r.setAttribute("normal", new M1(n.normals.flat(), 3)),
    r.setAttribute(
      "uv",
      new M1(
        n.uvSetsPerVertex === 0
          ? new Float32Array(n.vertexCount * 2)
          : n.uvs.flatMap((s) => s[0]),
        2,
      ),
    ),
    r.setAttribute(
      "primaryColor",
      new M1(
        n.diffuseColors?.flatMap(_B) ??
          Array.from({ length: n.vertexCount }, () => [1, 1, 1, 1]).flat(),
        4,
      ),
    ),
    r.setIndex(i),
    r.computeBoundingBox(),
    r.computeBoundingSphere(),
    r
  );
}

function _B(n) {
  return [
    ((n >>> 16) & 255) / 255,
    ((n >>> 8) & 255) / 255,
    (n & 255) / 255,
    ((n >>> 24) & 255) / 255,
  ];
}

function Vp(n) {
  const e = [];
  for (let t = 0; t + 2 < n.length; t += 1) {
    const i = t % 2 === 0 ? n[t] : n[t + 1],
      r = t % 2 === 0 ? n[t + 1] : n[t],
      s = n[t + 2];
    i !== r && r !== s && i !== s && e.push(i, r, s);
  }
  return e;
}

function uj(n) {
  return GB({ basis: n.transform, scale: n.scale, position: n.position });
}

function GB(n) {
  const e = new v2();
  return (Jm(e, n), e);
}

function Jm(n, e) {
  const [t, i, r] = e.basis,
    [s, o, a] = e.scale,
    [c, l, u] = e.position;
  n.set(
    t[0] * s,
    t[1] * o,
    t[2] * a,
    c,
    i[0] * s,
    i[1] * o,
    i[2] * a,
    l,
    r[0] * s,
    r[1] * o,
    r[2] * a,
    u,
    0,
    0,
    0,
    1,
  );
}

function hj(n) {
  const e = (s) => {
      const o = Math.hypot(n.basis[0][s], n.basis[1][s], n.basis[2][s]);
      return o === 0 ? 1 : o;
    },
    [t, i, r] = [e(0), e(1), e(2)];
  return {
    position: [...n.position],
    basis: n.basis.map((s) => [s[0] / t, s[1] / i, s[2] / r]),
    scale: [n.scale[0] * t, n.scale[1] * i, n.scale[2] * r],
  };
}

function dj(n, e) {
  const {
    state: t,
    material: i,
    toon: r,
    materialControllers: s,
    materialColors: o,
  } = n;
  if (t.uvControllers !== void 0 || t.alphaController !== void 0) {
    const a = GK(t, e);
    r
      ? Zq(i, a, t.uvControllers !== void 0)
      : EB(i, a, t.uvControllers !== void 0, t.currentAlpha);
  }
  if (s && o) {
    for (let a = 0; a < s.length; a += 1) {
      const c = s[a];
      c && (o[a] = c.update(e));
    }
    FK(i, o[1], o[3]);
  }
}

function BB(n, e, t) {
  const i = n.cullingObject[e];
  (i.matrixWorld.copy(t), (i.matrixWorldNeedsUpdate = !1));
  const r = n.object[e];
  (r.matrixWorld.multiplyMatrices(t, r.matrix),
    (r.matrixWorldNeedsUpdate = !1));
  const s = n.childOffsets[e],
    o = n.childOffsets[e + 1];
  Iu.clear();
  for (let a = s; a < o; a += 1) Iu.add(n.cullingObject[n.childIndices[a]]);
  for (const a of r.children) Iu.has(a) || RB(a, r.matrixWorld);
  for (let a = s; a < o; a += 1) BB(n, n.childIndices[a], r.matrixWorld);
}

function RB(n, e) {
  (n.matrixAutoUpdate && n.updateMatrix(),
    n.matrixWorld.multiplyMatrices(e, n.matrix),
    (n.matrixWorldNeedsUpdate = !1));
  for (const t of n.children) RB(t, n.matrixWorld);
}

function Ob(n) {
  for (let e = n; e; e = e.parent) if (!e.visible) return !1;
  return !0;
}

function we(n, e) {
  const t = (n * Math.PI) / 360;
  return (Math.atan(Math.tan(t) / e) * 360) / Math.PI;
}

const IB = new ArrayBuffer(4),
  fj = new Uint32Array(IB),
  pj = new Float32Array(IB),
  gj = P4(1062380241),
  mj = P4(1058398929),
  zb = P4(1064666457),
  Ub = P4(3204993777),
  $b = P4(1065533027),
  wj = P4(1063930709),
  vj = P4(1059516753);

function kB(n) {
  const e = g4(n.right),
    t = g4(n.forward),
    i = {
      x: t.x === 0 ? 0 : p0(-t.x),
      y: t.y === 0 ? 0 : p0(-t.y),
      z: t.z === 0 ? 0 : p0(-t.z),
    },
    r = g4(n.up);
  return [
    { x: e.x, y: i.x, z: r.x },
    { x: e.y, y: i.y, z: r.y },
    { x: e.z, y: i.z, z: r.z },
  ];
}

function Qt(n, e) {
  return { x: n[0][Nu(e)], y: n[1][Nu(e)], z: n[2][Nu(e)] };
}

function LB(n) {
  const e = n[0].x,
    t = n[1].x,
    i = n[2].x,
    r = n[0].y,
    s = n[1].y,
    o = n[2].y,
    a = n[0].z,
    c = n[1].z,
    l = n[2].z,
    u = p0(p0(e + s) + l);
  if (u > 0) {
    const b = p0(Math.sqrt(p0(u + p0(1)))),
      A = p0(p0(0.5) / b);
    return {
      w: p0(b * p0(0.5)),
      x: p0(p0(c - o) * A),
      y: p0(p0(i - a) * A),
      z: p0(p0(r - t) * A),
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
    w = p0(Math.sqrt(p0(p0(p0(h[d] - h[f]) - h[p]) + p0(1)))),
    g = p0(p0(0.5) / w),
    y = [0, 0, 0];
  return (
    (y[d] = p0(w * p0(0.5))),
    (y[f] = p0(p0(v[f][d] + v[d][f]) * g)),
    (y[p] = p0(p0(v[p][d] + v[d][p]) * g)),
    { w: p0(p0(v[p][f] - v[f][p]) * g), x: y[0], y: y[1], z: y[2] }
  );
}

function PB(n) {
  const e = p0(n.x * n.x),
    t = p0(n.y * n.y),
    i = p0(n.z * n.z),
    r = p0(n.x * n.y),
    s = p0(n.x * n.z),
    o = p0(n.y * n.z),
    a = p0(n.w * n.x),
    c = p0(n.w * n.y),
    l = p0(n.w * n.z),
    u = p0(2);
  return [
    {
      x: p0(p0(1) - p0(u * p0(t + i))),
      y: p0(u * p0(r + l)),
      z: p0(u * p0(s - c)),
    },
    {
      x: p0(u * p0(r - l)),
      y: p0(p0(1) - p0(u * p0(e + i))),
      z: p0(u * p0(o + a)),
    },
    {
      x: p0(u * p0(s + c)),
      y: p0(u * p0(o - a)),
      z: p0(p0(1) - p0(u * p0(e + t))),
    },
  ];
}

function O6(n, e, t) {
  const i = da(e, n),
    r = p0(p0(1) - p0(i * gj)),
    s = p0(p0(r * r) * mj),
    o = (d) =>
      p0(p0(p0(p0(p0(p0(d + d) - p0(3)) * p0(s * d)) + p0(1)) + s) * d),
    a = t > p0(0.5) ? p0(p0(1) - o(p0(p0(1) - t))) : o(t);
  let c = {
    w: p0(p0(p0(e.w - n.w) * a) + n.w),
    x: p0(p0(p0(e.x - n.x) * a) + n.x),
    y: p0(p0(p0(e.y - n.y) * a) + n.y),
    z: p0(p0(p0(e.z - n.z) * a) + n.z),
  };
  const l = p0(
      p0(p0(p0(c.w * c.w) + p0(c.x * c.x)) + p0(c.y * c.y)) + p0(c.z * c.z),
    ),
    u = (d) => p0(p0(p0(p0(p0(d * d) * l) - zb) * Ub) + $b);
  let h = p0(p0(p0(l - zb) * Ub) + $b);
  return (
    l <= wj && ((h = p0(h * u(h))), l <= vj && (h = p0(h * u(h)))),
    (c = ew(c, h)),
    c
  );
}

function da(n, e) {
  return p0(
    p0(p0(p0(n.x * e.x) + p0(n.w * e.w)) + p0(n.y * e.y)) + p0(n.z * e.z),
  );
}

function ew(n, e) {
  return { w: p0(n.w * e), x: p0(n.x * e), y: p0(n.y * e), z: p0(n.z * e) };
}

function g4(n) {
  return { x: p0(n.x), y: p0(-n.z), z: p0(n.y) };
}

function Nu(n) {
  return n === 0 ? "x" : n === 1 ? "y" : "z";
}

function p0(n) {
  return Math.fround(n);
}

function P4(n) {
  return ((fj[0] = n >>> 0), pj[0]);
}

const FB = new ArrayBuffer(4),
  yj = new Uint32Array(FB),
  Aj = new Float32Array(FB),
  DB = g1(1114594461),
  VB = g1(1119608232),
  NB = g1(1121776014),
  OB = g1(1122534421),
  Wb = g1(1007614510),
  bj = n0(25),
  Mj = g1(1100417874),
  xj = g1(1069547520),
  Sj = g1(1132068864);

class Cj extends CameraHeightFollower { constructor() { super({ f32: n0, floatWord: g1, clampRatio: bs, smoothScalar: qc }); } }

const zB = new Cj();

class Ol extends DriveCameraController { constructor(processState) { super(processState, cameraMathDependencies()); } }

function Ou(n, e) {
  return n0(n0(n0(n.x * e.x) + n0(n.z * e.z)) + n0(n.y * e.y));
}

function z6(n) {
  const e = n === 0 ? 1600 : n === 2 ? 1400 : 1920,
    i = n0(n0(n === 0 ? 900 : n === 2 ? 1050 : 1080) / n0(e));
  return {
    base: w8(DB, i),
    active: w8(VB, i),
    altActive: w8(NB, i),
    boost: w8(OB, i),
  };
}

function w8(n, e) {
  const t = n0(Math.tan(n0(n * Wb))),
    i = n0(Math.atan(n0(t / e)));
  return n0(i / Wb);
}

function Ej(n, e) {
  const t = Qt(n, 1),
    i = Qt(n, 2),
    r = Np(Op(e, t)),
    s = Gj(r, i),
    o = n0(Ul(r) * Ul(i)),
    a = n0(s / o);
  if (!(a > n0(-1) && a < n0(1))) return n;
  const c = n0(n0(Math.acos(a)) * g1(1113927396)),
    l = Kc(t, n0(-1));
  ((i.z = n0(i.z + n0(n0(Math.abs(n0(n0(90) - c))) * n0(0.5)))), Np(i));
  const u = n.map(Rj);
  return (zl(u, 0, Op(i, l)), zl(u, 2, i), u);
}

function zl(n, e, t) {
  const i = Tj(e);
  ((n[0][i] = t.x), (n[1][i] = t.y), (n[2][i] = t.z));
}

function Tj(n) {
  return n === 0 ? "x" : n === 1 ? "y" : "z";
}

function _j(n, e) {
  const t = n0(Math.sin(e)),
    i = n0(Math.cos(e));
  return n.map((r) => ({
    x: r.x,
    y: n0(n0(i * r.y) + n0(t * r.z)),
    z: n0(n0(n0(-t) * r.y) + n0(i * r.z)),
  }));
}

function Np(n) {
  const e = Ul(n);
  return (
    e !== 0 && ((n.x = n0(n.x / e)), (n.y = n0(n.y / e)), (n.z = n0(n.z / e))),
    n
  );
}

function Ul(n) {
  const e = n0(n0(n0(n.x * n.x) + n0(n.y * n.y)) + n0(n.z * n.z));
  return n0(Math.sqrt(e));
}

function Gj(n, e) {
  return n0(n0(n0(n.x * e.x) + n0(n.y * e.y)) + n0(n.z * e.z));
}

function Op(n, e) {
  return {
    x: n0(n0(n.y * e.z) - n0(n.z * e.y)),
    y: n0(n0(n.z * e.x) - n0(n.x * e.z)),
    z: n0(n0(n.x * e.y) - n0(n.y * e.x)),
  };
}

function qc(n, e, t) {
  return n0(n0(n0(n0(1) - t) * n) + n0(e * t));
}

function bs(n) {
  return n < 1 ? n : n0(1);
}

function Kc(n, e) {
  return { x: n0(n.x * e), y: n0(n.y * e), z: n0(n.z * e) };
}

function Hb(n, e) {
  return { x: n0(n.x + e.x), y: n0(n.y + e.y), z: n0(n.z + e.z) };
}

function v8(n) {
  return { x: n.x, y: n.z, z: n0(-n.y) };
}

function Bj() {
  return { x: 0, y: 0, z: 0 };
}

function Rj(n) {
  return { x: n.x, y: n.y, z: n.z };
}

function n0(n) {
  return Math.fround(n);
}

function y8(n) {
  return Number.parseInt(n, 10) || 0;
}

function g1(n) {
  return ((yj[0] = n >>> 0), Aj[0]);
}

class tw extends AwardPodiumScene {
  constructor(render, slots, confetti, mode) {
    super(render, slots, confetti, mode, awardPodiumDependencies());
  }
  static async load(library, options) {
    return loadAwardPodiumScene(library, options, awardPodiumLoadDependencies(),
      (render, slots, confetti, mode) => new tw(render, slots, confetti, mode));
  }
}

function x1(n) {
  if (n.length < 2 || n[0] !== 255 || n[1] !== 254)
    throw new Error("XML 缺少 UTF-16LE BOM。");
  let e;
  try {
    e = new TextDecoder("utf-16le", { fatal: !0 }).decode(n.subarray(2));
  } catch {
    throw new Error("XML 含无效 UTF-16LE code unit 序列。");
  }
  const t = new Ij(e);
  (t.declaration(), t.misc());
  const i = t.element(0);
  if ((t.misc(), !t.finished))
    throw new Error(`XML 在 code unit ${t.position} 后含额外内容。`);
  return { root: i, sourceBytes: n.slice() };
}

function j0(n, e) {
  return n.attributes.find((t) => t.name === e)?.value;
}

function zp(n, e) {
  return n.children.find((t) => t.name === e);
}

class Ij {
  constructor(e) {
    this.source = e;
  }
  source;
  position = 0;
  get finished() {
    return this.position === this.source.length;
  }
  declaration() {
    if (!this.source.startsWith("<?xml", this.position))
      throw new Error("XML declaration 必须紧跟 UTF-16LE BOM。");
    const e = this.source.indexOf("?>", this.position + 5);
    if (e < 0) throw new Error("XML declaration 未闭合。");
    const t = this.source.slice(this.position + 5, e);
    if (
      !/\bversion\s*=\s*(['"])1\.0\1/.test(t) ||
      !/\bencoding\s*=\s*(['"])UTF-16\1/i.test(t)
    )
      throw new Error("XML declaration 不是 version 1.0 / UTF-16。");
    this.position = e + 2;
  }
  misc() {
    for (;;) {
      if ((this.whitespace(), !this.source.startsWith("<!--", this.position)))
        return;
      const e = this.source.indexOf("-->", this.position + 4);
      if (e < 0) throw new Error("XML comment 未闭合。");
      if (this.source.slice(this.position + 4, e).includes("--"))
        throw new Error("XML comment 含非法 --。");
      this.position = e + 3;
    }
  }
  element(e) {
    if (e > 128) throw new Error("XML 层级超过安全上限。");
    if ((this.expect("<"), this.peek("/") || this.peek("!") || this.peek("?")))
      throw new Error("XML element 起始标记无效。");
    const t = this.name(),
      i = [],
      r = new Set();
    for (;;) {
      if ((this.whitespace(), this.take("/>")))
        return { name: t, attributes: i, children: [], text: "" };
      if (this.take(">")) break;
      const a = this.name();
      if (r.has(a)) throw new Error(`${t} 含重复属性 ${a}。`);
      (r.add(a), this.whitespace(), this.expect("="), this.whitespace());
      const c = this.source[this.position];
      if (c !== "'" && c !== '"') throw new Error(`${t}.${a} 缺少属性引号。`);
      this.position += 1;
      const l = this.source.indexOf(c, this.position);
      if (l < 0) throw new Error(`${t}.${a} 属性未闭合。`);
      const u = qb(this.source.slice(this.position, l));
      ((this.position = l + 1), i.push({ name: a, value: u }));
    }
    const s = [];
    let o = "";
    for (;;) {
      if (this.source.startsWith(`</${t}`, this.position))
        return (
          (this.position += t.length + 2),
          this.whitespace(),
          this.expect(">"),
          { name: t, attributes: i, children: s, text: qb(o) }
        );
      if (this.source.startsWith("<!--", this.position)) {
        const l = this.source.indexOf("-->", this.position + 4);
        if (l < 0) throw new Error("XML comment 未闭合。");
        this.position = l + 3;
        continue;
      }
      if (this.peek("<")) {
        s.push(this.element(e + 1));
        continue;
      }
      if (this.finished) throw new Error(`${t} 缺少结束标记。`);
      const a = this.source.indexOf("<", this.position),
        c = a < 0 ? this.source.length : a;
      ((o += this.source.slice(this.position, c)), (this.position = c));
    }
  }
  name() {
    const e = /^[A-Za-z_][A-Za-z0-9_.:-]*/.exec(
      this.source.slice(this.position),
    );
    if (!e) throw new Error(`XML 在 code unit ${this.position} 缺少合法名称。`);
    return ((this.position += e[0].length), e[0]);
  }
  whitespace() {
    for (; /\s/.test(this.source[this.position] ?? "");) this.position += 1;
  }
  peek(e) {
    return this.source.startsWith(e, this.position);
  }
  take(e) {
    return this.peek(e) ? ((this.position += e.length), !0) : !1;
  }
  expect(e) {
    if (!this.take(e))
      throw new Error(`XML 在 code unit ${this.position} 需要 ${e}。`);
  }
}

function qb(n) {
  return n
    .replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|apos|quot);/g, (e, t) => {
      if (t === "amp") return "&";
      if (t === "lt") return "<";
      if (t === "gt") return ">";
      if (t === "apos") return "'";
      if (t === "quot") return '"';
      const i = t.startsWith("#x")
        ? Number.parseInt(t.slice(2), 16)
        : Number.parseInt(t.slice(1), 10);
      if (
        !Number.isInteger(i) ||
        i < 0 ||
        i > 1114111 ||
        (i >= 55296 && i <= 57343)
      )
        throw new Error(`XML entity ${e} 无效。`);
      return String.fromCodePoint(i);
    })
    .replace(/&[^;\s]*;/g, (e) => {
      throw new Error(`XML entity ${e} 未定义。`);
    });
}

const Kb = new WeakMap();

function kj(n) {
  const e = x1(n).root,
    t = e.children.find((s) => s.name === "TeamDecoDefs")?.children ?? [],
    r =
      e.children
        .find((s) => s.name === "TeamDefs")
        ?.children.find((s) => s.name === "TeamDef" && j0(s, "maxTeam") === "2")
        ?.children.find((s) => s.name === "DecoTable")?.children ?? [];
  if (e.name !== "Team" || r.length !== 2)
    throw new Error("队伍资源缺少双队装饰表。");
  return r.map((s) => {
    const o = jb(s, "alias"),
      a = t.filter((l) => j0(l, "alias") === o);
    if (a.length !== 1 || !/^[a-z]+$/.test(o))
      throw new Error("队伍装饰引用不唯一。");
    const c = Number(jb(a[0], "dyeId"));
    if (!Number.isInteger(c) || c < 1 || c > 65535)
      throw new Error("无效的队伍染色剂。");
    return { alias: o, dyeId: c, cardTexture: `ridercard_${o}b_1` };
  });
}

function fa(n) {
  let e = Kb.get(n);
  return (
    e ||
      ((e = (async () => {
        const t = n.exactCanonicalCandidates("zeta_/cn/teamSystem/team.xml");
        if (t.length !== 1) throw new Error("队伍资源来源缺失或不唯一。");
        return kj(await t[0].bytes());
      })()),
      Kb.set(n, e)),
    e
  );
}

function jb(n, e) {
  const t = j0(n, e);
  if (!t) throw new Error(`队伍资源缺少 ${e}。`);
  return t;
}

const Xb = new WeakMap();

async function Lj(n, e) {
  return (await U6(n)).resolve(e);
}

async function We(n, e, t = 2) {
  return (await U6(n)).resolveColor(e, t);
}

async function Pj(n, e) {
  return (await U6(n)).resolveDyeRankColor(e);
}

async function Yb(n, e, t = 2) {
  const i = await U6(n);
  return i.tryResolveColor(e, t) ?? i.resolveColor(1, t);
}

function U6(n) {
  let e = Xb.get(n);
  return (e || ((e = Dj(n)), Xb.set(n, e)), e);
}

class nw {
  constructor(e, t, i, r, s) {
    ((this.characterColorIds = e),
      (this.colors = t),
      (this.riderColors = i),
      (this.uniformNames = r),
      (this.dyeRankColors = s));
  }
  characterColorIds;
  colors;
  riderColors;
  uniformNames;
  dyeRankColors;
  static parse(e) {
    const t = x1(e).root;
    if (t.name !== "itemtable")
      throw new Error(`character color table root ${t.name} 不是 itemtable。`);
    const i = Fj(t),
      r = new Map(),
      s = new Map(),
      o = new Set(),
      a = new Map();
    for (const c of t.children)
      if (c.name === "color") Zb(c, r, "base", "high");
      else if (c.name === "dye") {
        Zb(c, s, "base", "high");
        const l = j0(c, "rank");
        l !== void 0 && a.set(iw(c, "id"), Up(l));
      } else c.name === "uniform" && o.add(So(c, "name").toLowerCase());
    return new nw(i, r, s, o, a);
  }
  resolveDyeRankColor(e) {
    const t = this.dyeRankColors.get(e);
    if (t === void 0) throw new Error(`itemTable 缺少 dye ${e} 的 rank 颜色。`);
    return t;
  }
  resolve(e) {
    const t = this.tryResolve(e);
    if (t) return t;
    const i = e
      .replace(/^character_/i, "")
      .replace(/\.rho$/i, "")
      .toLowerCase();
    throw new Error(`itemTable 缺少 character ${i}。`);
  }
  tryResolve(e) {
    const t = e
        .replace(/^character_/i, "")
        .replace(/\.rho$/i, "")
        .toLowerCase(),
      i = this.characterColorIds.get(t);
    if (i === void 0) return;
    const r = this.riderColors.get(i);
    if (!r) throw new Error(`itemTable character ${t} 引用缺失 dye ${i}。`);
    return r;
  }
  tryResolveColor(e, t = 2) {
    return (t === 2 ? this.colors : this.riderColors).get(e);
  }
  resolveColor(e, t = 2) {
    const i = this.tryResolveColor(e, t);
    if (!i)
      throw new Error(`itemTable 缺少 ${t === 2 ? "color" : "dye"} ${e}。`);
    return i;
  }
}

function Fj(n) {
  const e = new Map();
  for (const t of n.children.filter((i) => i.name === "character")) {
    const i = So(t, "name").toLowerCase(),
      r = iw(t, "orgColorId"),
      s = e.get(i);
    if (s !== void 0 && s !== r)
      throw new Error(
        `itemTable character ${i} 的 orgColorId ${s}/${r} 冲突。`,
      );
    e.set(i, r);
  }
  return e;
}

function Zb(n, e, t, i) {
  const r = iw(n, "id");
  if (e.has(r)) throw new Error(`itemTable ${n.name} ${r} 重复。`);
  e.set(r, { primary: Up(So(n, t)), high: Up(So(n, i)) });
}

async function Dj(n) {
  const e = n.exactCanonicalCandidates("etc_/itemTable.kml");
  if (e.length !== 1)
    throw new Error(
      `etc_/itemTable.kml source 数量必须为 1，实际 ${e.length}。`,
    );
  return nw.parse(await e[0].bytes());
}

function So(n, e) {
  const t = j0(n, e);
  if (t === void 0 || t === "")
    throw new Error(`itemTable ${n.name}.${e} 缺失。`);
  return t;
}

function iw(n, e) {
  const t = So(n, e);
  if (!/^\d+$/.test(t))
    throw new Error(`itemTable ${n.name}.${e} 不是非负整数。`);
  return Number(t);
}

function Up(n) {
  const e = n.trim().split(/\s+/).map(Number);
  if (e.length !== 4 || e.some((o) => !Number.isInteger(o) || o < 0 || o > 255))
    throw new Error(`itemTable color ${n} 不是 A R G B bytes。`);
  const [t, i, r, s] = e;
  return ((t << 24) | (i << 16) | (r << 8) | s) >>> 0;
}

const H2 = 1600,
  $2 = 900;

class Vj {
  phase = 0;
  since;
  constructor(e) {
    this.since = e;
  }
  update(e) {
    const t = Math.max(0, e - this.since);
    if (this.phase === 0) {
      if (t <= 250) return { offset: t / 250 - 1, complete: !1 };
      ((this.phase = 1), (this.since = e));
    } else if (this.phase === 1 && t > 7e3)
      ((this.phase = 2), (this.since = e));
    else if (this.phase === 2) {
      if (t <= 250) return { offset: -t / 250, complete: !1 };
      this.phase = 3;
    }
    return { offset: this.phase === 3 ? -1 : 0, complete: this.phase === 3 };
  }
}

function UB(n, e, t) {
  const i = n.slice(),
    r = e * 4;
  for (let s = 1; s < t - 1; s++)
    for (let o = 1; o < e - 1; o++) {
      const a = s * r + o * 4;
      if (n[a + 3] !== 0) {
        if (n[a + 3] < 255) {
          const c = n[a + 3],
            l = (n[a - 4 + 3] + n[a + 4 + 3] + n[a - r + 3] + n[a + r + 3]) / 4;
          i[a + 3] = c + Math.max(-6, Math.min(6, (c - l) * 0.3));
          continue;
        }
        if (!(
          n[a - 4 + 3] !== 255 ||
          n[a + 4 + 3] !== 255 ||
          n[a - r + 3] !== 255 ||
          n[a + r + 3] !== 255
        ))
          for (let c = 0; c < 3; c++) {
            const l = n[a + c],
              u =
                (n[a - 4 + c] + n[a + 4 + c] + n[a - r + c] + n[a + r + c]) / 4,
              h = Math.max(-6, Math.min(6, (l - u) * 0.3));
            i[a + c] = l + h;
          }
      }
    }
  return i;
}

function Co() {
  return !1;
}

async function $p(n) {
  return n;
}

const Nj = [
    "windowRect",
    "clientRect",
    "leftTopTex",
    "leftTopWH",
    "windowSize",
    "clientSize",
  ],
  Oj = new Map([
    ["left", 1],
    ["right", 2],
    ["hcenter", 4],
    ["top", 16],
    ["bottom", 32],
    ["vcenter", 64],
    ["center", 68],
  ]),
  z9 = Math.fround;

function lt(n, e, t = {}) {
  zj(n, t);
  const i = Nj.find((f) => T(n, f) !== void 0),
    [r, s, o, a] = Uj(n, i, e, t),
    c = T(n, "adjust"),
    [l, u] = c === void 0 ? [0, 0] : j2(c, 2, "adjust"),
    h = i === "windowSize" || i === "clientSize",
    d = qj(n, jj(n), h);
  return {
    left: r,
    top: s,
    width: o,
    height: a,
    align: d,
    adjustX: l,
    adjustY: u,
    hasAdjust: h || (i !== void 0 && c !== void 0),
  };
}

function zj(n, e) {
  if (T(n, "frame") !== void 0 && !e.frameInsets)
    throw new Error(`${n.name}.frame 的 P3528 client extent 尚未闭合。`);
}

function Uj(n, e, t, i) {
  if (e === void 0) return [0, 0, 10, 10];
  const r = T(n, e);
  return e === "windowRect"
    ? Hj(r, i)
    : e === "leftTopWH"
      ? j2(r, 4, e)
      : e === "leftTopTex"
        ? Wj(n, r, t, i.textureSize)
        : $j(n, e, r, i.frameInsets);
}

function $j(n, e, t, i) {
  if (e === "clientRect")
    throw new Error(`${n.name}.${e} 的 P3528 frame extent 修改尚未闭合。`);
  const [r, s] = j2(t, 2, e);
  return e === "windowSize" || !i
    ? [0, 0, r, s]
    : [0, 0, z9(r + z9(i.left + i.right)), z9(s + z9(i.top + i.bottom))];
}

function Wj(n, e, t, i) {
  const [r, s] = j2(e, 2, "leftTopTex"),
    o = i ?? t?.get(T(n, "texture") ?? "");
  return o ? [r, s, o.width, o.height] : [r, s, 100, 100];
}

function Hj(n, e) {
  if (n === "fullscreen") {
    if (!e.viewport)
      throw new Error("windowRect=fullscreen 缺少 P3528 full-surface 尺寸。");
    return [0, 0, e.viewport.width, e.viewport.height];
  }
  const [t, i, r, s] = j2(n, 4, "windowRect");
  return [t, i, z9(r - t), z9(s - i)];
}

function qj(n, e, t) {
  return !t || !Kj(n)
    ? e
    : e | ((e & 7) === 0 ? 1 : 0) | ((e & 112) === 0 ? 16 : 0);
}

function Kj(n) {
  const e = T(n, "anchor");
  if (e === void 0) return !0;
  const [t, i] = j2(e, 2, "anchor");
  return t === 1 && i === 1;
}

function l5(n, e, t = 1, i = 1) {
  const r = z9(z9(n.width) * z9(t)),
    s = z9(z9(n.height) * z9(i)),
    o = Qb(
      n.left,
      r,
      z9(z9(e.right) - z9(e.left)),
      n.align & 7,
      n.hasAdjust ? n.adjustX : 0,
    ),
    a = Qb(
      n.top,
      s,
      z9(z9(e.bottom) - z9(e.top)),
      (n.align >> 4) & 7,
      n.hasAdjust ? n.adjustY : 0,
    );
  return { left: o, top: a, right: z9(o + r), bottom: z9(a + s) };
}

function Qb(n, e, t, i, r) {
  return i & 1
    ? r
    : i & 2
      ? z9(z9(t - e) - r)
      : i & 4
        ? z9(Math.floor(z9(z9(t - e) * 0.5)) + r)
        : n;
}

function jj(n) {
  const e = T(n, "align") ?? "";
  let t = 0;
  for (const i of e.split(/[|,.;\s]+/)) t |= Oj.get(i) ?? 0;
  return t;
}

function j2(n, e, t) {
  const i = n.trim().split(/\s+/);
  if (i.length !== e) throw new Error(`${t}=${n} 必须包含 ${e} 个数。`);
  return i.map((r) => {
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(r))
      throw new Error(`${t}=${n} 包含无效数字。`);
    const s = Number(r);
    if (!Number.isFinite(s)) throw new Error(`${t}=${n} 包含非有限值。`);
    return z9(s);
  });
}

const Xj = new Set([
  "Window",
  "Container",
  "Panel",
  "CharPanel",
  "DashboardPanel",
  "Graduation",
  "BlinkButton",
  "Play1SPanel",
]);

function d5(n, e) {
  if (!Xj.has(n.name))
    throw new Error(`${n.name} 的 P3528 Window 投影尚未闭合。`);
  const t = lt(n, e);
  return { node: n, geometry: t, children: n.children.map((i) => d5(i, e)) };
}

function pa(n, e) {
  const t = [];
  return ($B(n, e, t), t);
}

function $B(n, e, t) {
  const i = Math.fround(n.fontWidth),
    r = Math.fround(n.fontHeight),
    s = Math.fround(i + Math.fround(n.spaceOffset)),
    o = Math.fround(s * e.length),
    a = Math.fround(Math.fround(n.right) - Math.fround(n.left));
  let c = Math.fround(n.left);
  (n.centerAlign &&
    (c = Math.fround(c + eM(Math.fround(Math.fround(a - o) * 0.5)))),
    n.rightAlign && (c = Math.fround(n.left + eM(Math.fround(a - o)))));
  const l = Math.fround(n.top),
    u = n.fontCharacters;
  let h = 0;
  for (let d = 0; d < e.length; d += 1) {
    const f = e.charAt(d);
    if (f !== " ") {
      let p = 0,
        v = 0,
        w = !1;
      for (let g = 0; g < u.length; g += 1) {
        const y = u.charAt(g);
        if (y === f) {
          w = !0;
          break;
        }
        ((p = Math.fround(p + i)),
          p < n.rowWidth || ((v = Math.fround(v + r)), (p = 0)),
          y === "|" && ((v = Math.fround(v + r)), (p = 0)));
      }
      if (w) {
        const g = Math.fround(n.fontX + p),
          y = Math.fround(n.fontY + v);
        let b = t[h];
        (b === void 0 &&
          ((b = {
            character: f,
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
            u0: 0,
            v0: 0,
            u1: 0,
            v1: 0,
          }),
          (t[h] = b)),
          (b.character = f),
          (b.left = c),
          (b.top = l),
          (b.right = Math.fround(c + i)),
          (b.bottom = Math.fround(l + r)),
          (b.u0 = Math.fround(g / n.textureWidth)),
          (b.v0 = Math.fround(y / n.textureHeight)),
          (b.u1 = Math.fround(Math.fround(g + i) / n.textureWidth)),
          (b.v1 = Math.fround(Math.fround(y + r) / n.textureHeight)),
          (h += 1));
      }
    }
    c = Math.fround(c + s);
  }
  t.length = h;
}

const Jb = new WeakMap();

function ga(n, e) {
  const t = Jb.get(n);
  if (t && t.textureWidth === e.width && t.textureHeight === e.height)
    return t.layout;
  if (!["CharPanel", "DashboardPanel"].includes(n.name))
    throw new Error(`${n.name} 不是 P3528 CharPanel。`);
  const i = T(n, "texture"),
    r = lt(n, i === void 0 ? void 0 : new Map([[i, e]])),
    s = 0,
    o = 0,
    a = r.width,
    c = r.height,
    l = Wp(tM(n, "fontSize"), 2, "fontSize"),
    u = Wp(T(n, "fontPos") ?? "0 0", 2, "fontPos"),
    h = A8(n, "flexible"),
    d = {
      left: s,
      top: o,
      right: a,
      fontWidth: h ? Math.fround(a - s) : l[0],
      fontHeight: h ? Math.fround(c - o) : l[1],
      fontX: u[0],
      fontY: u[1],
      fontCharacters: tM(n, "fontStr"),
      spaceOffset: Yj(n, "spaceOffset", 0),
      centerAlign: A8(n, "centerAlign"),
      rightAlign: A8(n, "rightAlign"),
      rowWidth: A8(n, "allowVertical") ? e.width : 800,
      textureWidth: e.width,
      textureHeight: e.height,
    };
  return (
    Jb.set(n, { textureWidth: e.width, textureHeight: e.height, layout: d }),
    d
  );
}

function eM(n) {
  return Math.trunc(Math.fround(n + (n < 0 ? -0.5 : 0.5)));
}

function tM(n, e) {
  const t = T(n, e);
  if (t === void 0 || t === "") throw new Error(`${n.name} 缺少 ${e}。`);
  return t;
}

function Wp(n, e, t) {
  return j2(n, e, t);
}

function Yj(n, e, t) {
  const i = T(n, e);
  return i === void 0 ? t : Wp(i, 1, e)[0];
}

function A8(n, e) {
  const t = T(n, e);
  if (t === void 0 || t === "false") return !1;
  if (t === "true") return !0;
  throw new Error(`${n.name}.${e}=${t} 不是 P3528 boolean。`);
}

function WB(n, e) {
  if (n.name !== "Graduation")
    throw new Error(`${n.name} 不是 P3528 Graduation。`);
  const t = T(n, "texture"),
    i = lt(n, t === void 0 ? void 0 : new Map([[t, e]])),
    r = T(n, "uvRect"),
    s =
      r === void 0
        ? { left: 0, top: 0, right: 1, bottom: 1 }
        : eX(j2(r, 4, "uvRect"), e),
    o = tX(n, "axis", 2, [0, 0]);
  return {
    width: i.width,
    height: i.height,
    minDegree: qr(n, "minDegree", 0),
    maxDegree: qr(n, "maxDegree", 1),
    minValue: qr(n, "minValue", 0),
    maxValue: qr(n, "maxValue", 1),
    axisX: o[0],
    axisY: o[1],
    defaultValue: qr(n, "defaultVal", 0),
    uv: s,
  };
}

function Zj(n, e) {
  const t = e2(
      e2(n.minDegree) +
        e2(e2(e2(n.maxDegree) - e2(n.minDegree)) * e2(e2(e) - e2(n.minValue))) /
          e2(e2(n.maxValue) - e2(n.minValue)),
    ),
    i = e2(e2(t * e2(-3.141592025756836)) / e2(180));
  return HB(n, t, i);
}

function Qj(n, e) {
  const t = e2(
      ((e2(n.maxDegree) - e2(n.minDegree)) * (e2(e) - e2(n.minValue))) /
        (e2(n.maxValue) - e2(n.minValue)) +
        e2(n.minDegree),
    ),
    i = e2((-t * e2(3.141592025756836)) / e2(180));
  return HB(n, t, i);
}

function HB(n, e, t) {
  const i = e2(Math.cos(t)),
    r = e2(Math.sin(t)),
    s = [i, 0, r, 0, 0, 1, 0, 0, e2(-r), 0, i, 0],
    o = nM(n.axisX, 0, n.axisY),
    a = nM(e2(-n.axisX), -0, e2(-n.axisY)),
    c = iM(iM(o, s), a),
    l = (p, v) => {
      const w = Jj(c, p, 0, v);
      return [w[0], w[2]];
    },
    u = l(0, 0),
    h = l(0, n.height),
    d = l(n.width, 0),
    f = l(n.width, n.height);
  return {
    positions: [u[0], u[1], h[0], h[1], d[0], d[1], f[0], f[1]],
    uv: n.uv,
    degree: e,
  };
}

function nM(n, e, t) {
  return [1, 0, 0, e2(n), 0, 1, 0, e2(e), 0, 0, 1, e2(t)];
}

function iM(n, e) {
  const t = new Array(12);
  for (let i = 0; i < 3; i += 1) {
    for (let s = 0; s < 3; s += 1)
      t[i * 4 + s] = e2(
        e2(e2(n[i * 4] * e[s]) + e2(n[i * 4 + 1] * e[4 + s])) +
          e2(n[i * 4 + 2] * e[8 + s]),
      );
    let r = e2(e2(n[i * 4] * e[3]) + e2(n[i * 4 + 1] * e[7]));
    ((r = e2(r + e2(n[i * 4 + 2] * e[11]))),
      (t[i * 4 + 3] = e2(r + n[i * 4 + 3])));
  }
  return t;
}

function Jj(n, e, t, i) {
  return [0, 1, 2].map((r) => {
    let s = e2(e2(n[r * 4] * e2(e)) + e2(n[r * 4 + 1] * e2(t)));
    return ((s = e2(s + e2(n[r * 4 + 2] * e2(i)))), e2(s + n[r * 4 + 3]));
  });
}

function eX(n, e) {
  return {
    left: e2(e2(n[0]) / e2(e.width)),
    top: e2(e2(n[1]) / e2(e.height)),
    right: e2(e2(n[2]) / e2(e.width)),
    bottom: e2(e2(n[3]) / e2(e.height)),
  };
}

function qr(n, e, t) {
  const i = T(n, e);
  return i === void 0 ? t : j2(i, 1, e)[0];
}

function tX(n, e, t, i) {
  const r = T(n, e);
  return r === void 0 ? i : j2(r, t, e);
}

const e2 = Math.fround;

function qB(n) {
  const e = [
    n.left,
    n.top,
    Math.fround(n.right - n.left),
    Math.fround(n.bottom - n.top),
  ];
  if (e.some((o) => !Number.isFinite(o) || o <= -2147483648 || o >= 4294967296))
    throw new Error(
      `P3528 Play1S viewport=${e.join(",")} 不属于已闭合的 u32 域。`,
    );
  const [t, i, r, s] = e.map((o) => Math.trunc(o) >>> 0);
  if (r === 0 || s === 0)
    throw new Error(`P3528 Play1S viewport=${e.join(",")} 尺寸为零。`);
  return { x: t, y: i, width: r, height: s, minDepth: 0, maxDepth: 1 };
}

function nX(n) {
  const [e, t, i] = n.defaultCameraPosition;
  if (
    n.cameraName !== void 0 ||
    n.customCamera ||
    n.useRelativeCamera ||
    n.zoom !== 1 ||
    e !== 0 ||
    !(t < 0) ||
    n.defaultSpotPosition.some((l) => l !== 0)
  )
    throw new Error(
      `${n.name} 不属于已闭合的 P3528 Play1S target-axis view分支。`,
    );
  const r = P9(t),
    s = P9(i),
    o = Math.sqrt(r * r + s * s),
    a = P9(r / o),
    c = P9(s / o);
  return [
    1,
    0,
    0,
    0,
    0,
    c,
    P9(-a),
    P9(-P9(P9(c * r) + P9(P9(-a) * s))) + 0,
    0,
    P9(-a),
    P9(-c) + 0,
    P9(P9(a * r) + P9(c * s)),
  ];
}

function iX(n, e, t) {
  if (
    n.cameraName !== void 0 ||
    n.customCamera ||
    n.orthographic ||
    n.fieldOfViewDegrees !== 75
  )
    throw new Error(`${n.name} 不属于已闭合的 P3528 Play1S perspective 分支。`);
  if (!(e > 0) || !(t > 0) || !Number.isFinite(e) || !Number.isFinite(t))
    throw new Error(`P3528 Play1S client=${e}x${t} 无效。`);
  const i = P9(n.nearPlane),
    r = P9(n.farPlane);
  if (!(i > 0) || !(r > i))
    throw new Error(`${n.name} near/far=${i}/${r} 无效。`);
  const s = P9(P9(t) / P9(e)),
    o = P9(r / P9(r - i)),
    a = 0.7673262357711792;
  return [
    P9(1 / a),
    0,
    0,
    0,
    0,
    P9(1 / P9(a * s)),
    0,
    0,
    0,
    0,
    o,
    P9(-P9(o * i)),
    0,
    0,
    1,
    0,
  ];
}

const P9 = Math.fround;

function rX(n) {
  return [
    ...(n.clearZBefore ? ["clear-depth"] : []),
    "draw-scene",
    ...(n.clearZAfter ? ["clear-depth"] : []),
  ];
}

async function sX(n, e) {
  const t = [],
    i = (r) => {
      (r.name === "Play1SPanel" && t.push(r), r.children.forEach(i));
    };
  return (
    i(n),
    Promise.all(
      t.map(async (r) => {
        const s = Vs(r, "scene"),
          o = await e(s),
          a = j2(Vs(r, "zoom"), 1, "zoom")[0];
        return {
          node: r,
          name: Vs(r, "name"),
          sceneName: s,
          scenePath: o.canonicalPath,
          cameraName: T(r, "camera"),
          scene: o.scene,
          geometry: lt(r),
          initiallyVisible: rM(r, "visible"),
          clearZBefore: rM(r, "clearZBefore"),
          clearZAfter: ci(r, "clearZAfter", !1),
          nearPlane: sM(r, "nearPlane", 1),
          farPlane: sM(r, "farPlane", 1e3),
          fieldOfViewDegrees: Math.fround(75 / a),
          customCamera: ci(r, "customCamera", !1),
          defaultCameraPosition: aM(r, "defaultCameraPos"),
          defaultSpotPosition: aM(r, "defaultSpotPos"),
          zoom: a,
          loop: ci(r, "loop", !1),
          orthographic: ci(r, "orthographic", !1),
          useRelativeCamera: ci(r, "useRelCamera", !1),
          stop: ci(r, "stop", !1),
          playTickMs: oM(r, "playTick", 0),
          delayedPlayMs: oM(r, "delayedPlay", 0),
        };
      }),
    )
  );
}

function oX(n, e) {
  const t = {
    playing: !1,
    playSerial: 0,
    animationStartMs: 0,
    durationMs: 0,
    delayedStartedAtMs: n.delayedPlayMs === 0 ? 0 : e >>> 0,
    cycleModeOverride: void 0,
  };
  return n.stop ? t : rw(n, t, 0, 0, e);
}

function rw(n, e, t, i, r) {
  return {
    ...e,
    playing: !0,
    playSerial: e.playSerial + 1,
    animationStartMs: ((r >>> 0) - (i >>> 0)) >>> 0,
    durationMs: t === 0 ? n.playTickMs : t >>> 0,
    cycleModeOverride: n.loop ? 0 : e.cycleModeOverride,
  };
}

function aX(n) {
  return { ...n, playing: !1 };
}

function cX(n, e, t) {
  return e.delayedStartedAtMs === 0 ||
    ((t >>> 0) - e.delayedStartedAtMs) >>> 0 <= n.delayedPlayMs
    ? e
    : { ...rw(n, e, 0, 0, t), delayedStartedAtMs: 0 };
}

function Vs(n, e) {
  const t = T(n, e);
  if (t === void 0)
    throw new Error(`Play1SPanel.${e} 缺少 P3528 authored value。`);
  return t;
}

function rM(n, e) {
  return KB(e, Vs(n, e));
}

function ci(n, e, t) {
  const i = T(n, e);
  return i === void 0 ? t : KB(e, i);
}

function KB(n, e) {
  if (e === "true") return !0;
  if (e === "false") return !1;
  throw new Error(`Play1SPanel.${n} 不是 P3528 boolean。`);
}

function sM(n, e, t) {
  const i = T(n, e);
  return i === void 0 ? t : j2(i, 1, e)[0];
}

function oM(n, e, t) {
  const i = T(n, e);
  if (i === void 0) return t;
  if (!/^\d+$/.test(i)) throw new Error(`Play1SPanel.${e} 不是 P3528 u32。`);
  const r = Number(i);
  if (!Number.isSafeInteger(r) || r > 4294967295)
    throw new Error(`Play1SPanel.${e} 不是 P3528 u32。`);
  return r;
}

function aM(n, e) {
  const t = j2(Vs(n, e), 3, e);
  return [t[0], t[1], t[2]];
}

function dn(n, e, t, i = {}) {
  const r = [];
  return (
    jB(
      n,
      { left: 0, top: 0, right: Math.fround(e), bottom: Math.fround(t) },
      0,
      0,
      void 0,
      i.visibility,
      i.text,
      r,
    ),
    r
  );
}

function dt(n, e, t) {
  const i = t === void 0 ? [] : t.baseOutput();
  i.length = 0;
  for (let r = 0; r < n.length; r += 1) {
    const s = n[r];
    if (s.kind !== "panel" && s.kind !== "char-panel") {
      i.push(s);
      continue;
    }
    if (T(s.node, "alphaBlend") !== "true" || T(s.node, "alphaTest") !== void 0)
      throw new Error(`${s.node.name} 不使用已闭合的 P3528 alpha state。`);
    const o = T(s.node, "texture"),
      a = o === void 0 ? void 0 : e.get(o);
    if (s.kind === "panel" && o === void 0) {
      if (T(s.node, "color") !== "150 0 0 0")
        throw new Error(
          `${s.node.name} 缺少已闭合的 P3528 texture 或 solid color。`,
        );
      const d = t?.payloadFor(s);
      if (d !== void 0) {
        i.push(d);
        continue;
      }
      const f = {
        ...s,
        kind: "solid-panel",
        framebufferRect: YB(s.worldRect),
        color: [0, 0, 0, 150],
      };
      (t?.storePayload(s, f), i.push(f));
      continue;
    }
    if (!o || !a)
      throw new Error(`${s.node.name} 缺少已解析的 P3528 texture。`);
    if (s.kind === "panel") {
      const h = t?.payloadFor(s, a);
      if (h !== void 0) {
        i.push(h);
        continue;
      }
      const d = {
        ...s,
        kind: "panel",
        textureName: o,
        texture: a,
        framebufferRect: s.worldRect,
        uv: dX(s.node, a),
      };
      (t?.storePayload(s, d, a), i.push(d));
      continue;
    }
    if (s.text === void 0)
      throw new Error(
        `${T(s.node, "name") ?? "CharPanel"} 缺少已闭合的 text producer。`,
      );
    const c = ga(s.node, a);
    if (t !== void 0) {
      const h = t.glyphPools(s.node);
      ($B(c, s.text, h.local),
        lX(h.local, h.world, s.worldRect.left, s.worldRect.top),
        uX(h.world, h.framebuffer));
      const d = t.payloadFor(s, a),
        f = d ?? {
          ...s,
          kind: "char-panel",
          text: s.text,
          textureName: o,
          texture: a,
          worldQuads: h.world,
          framebufferQuads: h.framebuffer,
        };
      (d === void 0 ? t.storePayload(s, f, a) : (f.text = s.text), i.push(f));
      continue;
    }
    const u = pa(c, s.text).map((h) => ({
      ...h,
      left: Math.fround(s.worldRect.left + h.left),
      top: Math.fround(s.worldRect.top + h.top),
      right: Math.fround(s.worldRect.left + h.right),
      bottom: Math.fround(s.worldRect.top + h.bottom),
    }));
    i.push({
      ...s,
      text: s.text,
      textureName: o,
      texture: a,
      worldQuads: u,
      framebufferQuads: u.map((h) => ({ ...h })),
    });
  }
  return i;
}

function lX(n, e, t, i) {
  for (let r = 0; r < n.length; r += 1) {
    const s = n[r];
    let o = e[r];
    (o === void 0 &&
      ((o = {
        character: s.character,
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        u0: 0,
        v0: 0,
        u1: 0,
        v1: 0,
      }),
      (e[r] = o)),
      (o.character = s.character),
      (o.left = Math.fround(t + s.left)),
      (o.top = Math.fround(i + s.top)),
      (o.right = Math.fround(t + s.right)),
      (o.bottom = Math.fround(i + s.bottom)),
      (o.u0 = s.u0),
      (o.v0 = s.v0),
      (o.u1 = s.u1),
      (o.v1 = s.v1));
  }
  e.length = n.length;
}

function uX(n, e) {
  for (let t = 0; t < n.length; t += 1) {
    const i = n[t];
    let r = e[t];
    (r === void 0 &&
      ((r = {
        character: i.character,
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        u0: 0,
        v0: 0,
        u1: 0,
        v1: 0,
      }),
      (e[t] = r)),
      (r.character = i.character),
      (r.left = i.left),
      (r.top = i.top),
      (r.right = i.right),
      (r.bottom = i.bottom),
      (r.u0 = i.u0),
      (r.v0 = i.v0),
      (r.u1 = i.u1),
      (r.v1 = i.v1));
  }
  e.length = n.length;
}

function sw(n, e, t, i, r = Zj) {
  return n.map((s) => {
    if (s.kind !== "graduation") return s;
    const o = t.find((d) => d.node === s.node),
      a = T(s.node, "texture"),
      c = a === void 0 ? void 0 : e.get(a),
      l = i(s.node);
    if (!o || !a || !c || l === void 0)
      throw new Error(
        `${T(s.node, "name") ?? "Graduation"} 缺少已闭合的 layout/texture/value。`,
      );
    const u = r(o.layout, l),
      h = cM(u.positions, s.worldRect.left, s.worldRect.top);
    return {
      ...s,
      textureName: a,
      texture: c,
      quad: u,
      worldPositions: h,
      framebufferPositions: cM(h, -0.5, -0.5),
    };
  });
}

function hX(n, e, t) {
  return n.map((i) => {
    if (i.kind !== "blink-button") return i;
    const r = e.find((o) => o.node === i.node),
      s = r === void 0 ? void 0 : t(r)?.image;
    if (!r || !s)
      throw new Error(
        `${T(i.node, "name") ?? "BlinkButton"} 缺少已闭合的 binding/state image。`,
      );
    return {
      ...i,
      textureName: s.name,
      texture: s.texture,
      framebufferRect: YB(i.worldRect),
    };
  });
}

function ow(n, e) {
  return n.map((t) => {
    if (t.kind !== "play-1s-panel") return t;
    const i = e.find((r) => r.node === t.node);
    if (!i)
      throw new Error(
        `${T(t.node, "name") ?? "Play1SPanel"} 缺少已闭合的 binding。`,
      );
    return {
      ...t,
      binding: i,
      view: nX(i),
      projection: iX(i, i.geometry.width, i.geometry.height),
      viewport: qB(t.worldRect),
      steps: rX(i),
    };
  });
}

function jB(n, e, t, i, r, s, o, a) {
  if (!(s?.(n.node, r) ?? ZB(n.node))) return;
  const c = l5(n.geometry, e),
    l = Math.fround(t + c.left),
    u = Math.fround(i + c.top),
    h = XB(n.node.name);
  h &&
    a.push({
      kind: h,
      node: n.node,
      worldRect: {
        left: l,
        top: u,
        right: Math.fround(l + n.geometry.width),
        bottom: Math.fround(u + n.geometry.height),
      },
      ...(h === "char-panel" ? { text: o?.(n.node) } : {}),
    });
  const d = {
      left: 0,
      top: 0,
      right: n.geometry.width,
      bottom: n.geometry.height,
    },
    f = n.children;
  for (let p = 0; p < f.length; p += 1) jB(f[p], d, l, u, n.node, s, o, a);
}

function XB(n) {
  if (n === "Panel") return "panel";
  if (n === "CharPanel" || n === "DashboardPanel") return "char-panel";
  if (n === "Graduation") return "graduation";
  if (n === "BlinkButton") return "blink-button";
  if (n === "Play1SPanel") return "play-1s-panel";
}

function YB(n) {
  return {
    left: Math.fround(n.left - 0.5),
    top: Math.fround(n.top - 0.5),
    right: Math.fround(n.right - 0.5),
    bottom: Math.fround(n.bottom - 0.5),
  };
}

const zu = new WeakMap();

function dX(n, e) {
  const t = zu.get(n);
  if (t !== void 0 && t.width === e.width && t.height === e.height) return t.uv;
  const i = T(n, "uvRect");
  if (i === void 0) {
    const h = { left: 0, top: 0, right: 1, bottom: 1 };
    return (zu.set(n, { width: e.width, height: e.height, uv: h }), h);
  }
  const [r, s, o, a] = j2(i, 4, "uvRect"),
    c = Math.fround(1 / Math.fround(e.width)),
    l = Math.fround(1 / Math.fround(e.height)),
    u = {
      left: Math.fround(r * c),
      top: Math.fround(s * l),
      right: Math.fround(o * c),
      bottom: Math.fround(a * l),
    };
  return (zu.set(n, { width: e.width, height: e.height, uv: u }), u);
}

function cM(n, e, t) {
  return n.map((i, r) => Math.fround(i + (r % 2 === 0 ? e : t)));
}

class O5 {
  tree;
  width = Number.NaN;
  height = Number.NaN;
  root;
  draw = [];
  base = [];
  basePayloads = new WeakMap();
  glyphPoolsByNode = new WeakMap();
  drawOrder(e, t, i, r = {}) {
    return (
      (this.root === void 0 ||
        this.tree !== e ||
        this.width !== t ||
        this.height !== i) &&
        ((this.tree = e),
        (this.width = t),
        (this.height = i),
        (this.root = this.createEntry(
          e,
          { left: 0, top: 0, right: Math.fround(t), bottom: Math.fround(i) },
          0,
          0,
        ))),
      (this.draw.length = 0),
      this.emit(this.root, void 0, r, this.draw),
      this.draw
    );
  }
  payloadFor(e, t) {
    return this.basePayloads.get(e)?.get(t);
  }
  storePayload(e, t, i) {
    let r = this.basePayloads.get(e);
    (r === void 0 && ((r = new Map()), this.basePayloads.set(e, r)),
      r.set(i, t));
  }
  baseOutput() {
    return this.base;
  }
  glyphPools(e) {
    let t = this.glyphPoolsByNode.get(e);
    return (
      t === void 0 &&
        ((t = { local: [], world: [], framebuffer: [] }),
        this.glyphPoolsByNode.set(e, t)),
      t
    );
  }
  createEntry(e, t, i, r) {
    const s = l5(e.geometry, t),
      o = Math.fround(i + s.left),
      a = Math.fround(r + s.top),
      c = XB(e.node.name),
      l =
        c === void 0
          ? void 0
          : {
              kind: c,
              node: e.node,
              worldRect: {
                left: o,
                top: a,
                right: Math.fround(o + e.geometry.width),
                bottom: Math.fround(a + e.geometry.height),
              },
            },
      u = {
        left: 0,
        top: 0,
        right: e.geometry.width,
        bottom: e.geometry.height,
      },
      h = [];
    for (let d = 0; d < e.children.length; d += 1)
      h.push(this.createEntry(e.children[d], u, o, a));
    return { node: e.node, kind: c, command: l, children: h };
  }
  emit(e, t, i, r) {
    if (!(i.visibility?.(e.node, t) ?? ZB(e.node))) return;
    e.command !== void 0 &&
      (e.kind === "char-panel" && (e.command.text = i.text?.(e.node)),
      r.push(e.command));
    const s = e.children;
    for (let o = 0; o < s.length; o += 1) this.emit(s[o], e.node, i, r);
  }
}

function ZB(n) {
  const e = T(n, "visible");
  if (e === void 0 || e === "true") return !0;
  if (e === "false") return !1;
  throw new Error(`${n.name}.visible=${e} 不是 P3528 boolean。`);
}

const lM = "stage_/timeAttack/mq_window@zz.bml",
  fX = "stage_timeAttack.rho",
  QB = new Map([
    [
      "lapinfo_countBooster@zz",
      { directory: "stage_/timeAttack", owner: "stage_timeAttack.rho" },
    ],
    [
      "lapinfo_countCrash@zz",
      { directory: "stage_/timeAttack", owner: "stage_timeAttack.rho" },
    ],
    [
      "lapinfo_countTXT@zz",
      { directory: "stage_/timeAttack", owner: "stage_timeAttack.rho" },
    ],
    [
      "laptime_best@zz",
      { directory: "stage_/speedIndiGame", owner: "stage_speedIndiGame.rho" },
    ],
    [
      "laptime_time@zz",
      { directory: "stage_/speedIndiGame", owner: "stage_speedIndiGame.rho" },
    ],
    [
      "time_num",
      { directory: "stage_/speedIndiGame", owner: "stage_speedIndiGame.rho" },
    ],
    [
      "reward_num",
      { directory: "stage_/timeAttack", owner: "stage_timeAttack.rho" },
    ],
    [
      "time_rp@zz",
      { directory: "stage_/timeAttack", owner: "stage_timeAttack.rho" },
    ],
    [
      "time_lucci@zz",
      { directory: "stage_/timeAttack", owner: "stage_timeAttack.rho" },
    ],
  ]);

async function pX(n) {
  const e = eR(n.canonicalCandidates(lM), lM, fX),
    t = s2(await e.bytes()),
    i = ue(t, "trainingResultPanel"),
    r = ue(i, "newrecord_time"),
    s = ue(i, "driveInfo"),
    o = ue(i, "reward_timeAttack"),
    a = { ...i, children: [r, s, o] },
    c = yX(a),
    l = [...QB.keys()].sort();
  if (c.join("\0") !== l.join("\0"))
    throw new Error(
      `P3528 training result core texture 集合已变化：${c.join(", ")}。`,
    );
  const u = new Map(
      await Promise.all(
        c.map(async (d) => [d, await p2(await vX(n, d).bytes())]),
      ),
    ),
    h = mX(r, s, o);
  return {
    root: a,
    textures: u,
    windowTree: d5(a, u),
    textBindings: h,
    visiblePanels: new Set([r, s, o]),
  };
}

function gX(n, e, t, i) {
  const r = Eo(e.elapsedMs),
    s = Eo(e.bestMs),
    o = {
      crash: hM(e.crashCount, "crashCount"),
      booster: hM(e.boosterCount, "boosterCount"),
    },
    a = dn(n.windowTree, t, i, {
      visibility: (c) => (n.visiblePanels.has(c) ? !0 : void 0),
      text: (c) => wX(n.textBindings.get(c), r, s, o),
    });
  return dt(a, n.textures);
}

function Eo(n) {
  const e = JB(n, "time");
  return {
    min: Math.floor(e / 6e4)
      .toString()
      .padStart(2, "0"),
    sec: (Math.floor(e / 1e3) % 60).toString().padStart(2, "0"),
    mil: (Math.floor(e / 10) % 100).toString().padStart(2, "0"),
  };
}

function mX(n, e, t) {
  const i = new Map();
  return (
    uM(i, ue(n, "timeinfo"), "elapsed"),
    uM(i, ue(n, "bestinfo"), "best"),
    i.set(ue(ue(e, "crashInfo"), "count"), "crash-count"),
    i.set(ue(ue(e, "boosterInfo"), "count"), "booster-count"),
    i.set(ue(t, "RP"), "initial-reward"),
    i.set(ue(t, "Lucci"), "initial-reward"),
    i
  );
}

function uM(n, e, t) {
  (n.set(ue(e, "min"), `${t}-min`),
    n.set(ue(e, "sec"), `${t}-sec`),
    n.set(ue(e, "mil"), `${t}-mil`));
}

function wX(n, e, t, i) {
  if (n === void 0) return;
  if (n === "crash-count") return i.crash;
  if (n === "booster-count") return i.booster;
  if (n === "initial-reward") return " +0";
  const [r, s] = n.split("-");
  return (r === "elapsed" ? e : t)[s];
}

function hM(n, e) {
  return JB(n, e).toString();
}

function JB(n, e) {
  if (!Number.isInteger(n) || n < 0 || n > 4294967295)
    throw new Error(`P3528 result ${e}=${n} 不是 u32。`);
  return n;
}

function vX(n, e) {
  const t = QB.get(e);
  if (!t)
    throw new Error(`P3528 training result texture ${e} 未被资源账本准入。`);
  const i = e.endsWith("@zz") ? [`${e.slice(0, -3)}@cn`, e] : [e];
  for (const r of i) {
    const s = `${t.directory}/${r}.png`,
      o = n.canonicalCandidates(s);
    if (o.length > 1)
      throw new Error(`${s} source 数量最多为 1，实际 ${o.length}。`);
    if (o.length === 1) return eR(o, s, t.owner);
  }
  throw new Error(`${t.directory}/${e}.png 缺少 P3528 CN→ZZ texture。`);
}

function eR(n, e, t) {
  if (n.length !== 1)
    throw new Error(`${e} source 数量必须为 1，实际 ${n.length}。`);
  const i = n[0];
  if (i.sourceKind !== "rho" || i.sourceName.toLowerCase() !== t.toLowerCase())
    throw new Error(`${e} 必须来自 ${t}。`);
  return i;
}

function yX(n) {
  const e = new Set(),
    t = [n];
  for (; t.length > 0;) {
    const i = t.pop(),
      r = T(i, "texture");
    (r && e.add(r), t.push(...i.children));
  }
  return [...e].sort();
}

function ue(n, e) {
  const t = [],
    i = [n];
  for (; i.length > 0;) {
    const r = i.pop();
    (T(r, "name") === e && t.push(r), i.push(...r.children));
  }
  if (t.length !== 1)
    throw new Error(`P3528 ${e} node 数量必须为 1，实际 ${t.length}。`);
  return t[0];
}

function Ft(n) {
  const e = T(n, "clientType") ?? "none";
  if (e !== "fill" && e !== "transFill" && e !== "none")
    throw new Error(`尚未实现窗口帧 clientType=${e}。`);
  return {
    texture: T(n, "texture") ?? "",
    caption: Kr(n, "captionUV"),
    left: Kr(n, "leftUV"),
    right: Kr(n, "rightUV"),
    client: Kr(n, "clientUV"),
    bottom: Kr(n, "bottomUV"),
    captionLeftMargin: Number(T(n, "captionLeftMargin") ?? 0),
    captionRightMargin: Number(T(n, "captionRightMargin") ?? 0),
    bottomLeftMargin: Number(T(n, "bottomLeftMargin") ?? 0),
    bottomRightMargin: Number(T(n, "bottomRightMargin") ?? 0),
    clientType: e,
  };
}

function E9(n, e) {
  return {
    x: e.x + n.left.width,
    y: e.y + n.caption.height,
    width: e.width - n.left.width - n.right.width,
    height: e.height - n.caption.height - n.bottom.height,
  };
}

function C9(n, e, t, i) {
  const r = E9(e, i);
  (dM(
    n,
    t,
    e.caption,
    { ...i, height: e.caption.height },
    e.captionLeftMargin,
    e.captionRightMargin,
  ),
    ji(n, t, e.left, { x: i.x, y: r.y, width: e.left.width, height: r.height }),
    ji(n, t, e.right, {
      x: r.x + r.width,
      y: r.y,
      width: e.right.width,
      height: r.height,
    }),
    dM(
      n,
      t,
      e.bottom,
      { x: i.x, y: r.y + r.height, width: i.width, height: e.bottom.height },
      e.bottomLeftMargin,
      e.bottomRightMargin,
    ),
    e.clientType !== "none" && ji(n, t, e.client, r, !0));
}

function dM(n, e, t, i, r, s) {
  (ji(
    n,
    e,
    { ...t, x: t.x + r, width: t.width - r - s },
    { ...i, x: i.x + r, width: i.width - r - s },
  ),
    ji(n, e, { ...t, width: r }, { ...i, width: r }),
    ji(
      n,
      e,
      { ...t, x: t.x + t.width - s, width: s },
      { ...i, x: i.x + i.width - s, width: s },
    ));
}

function ji(n, e, t, i, r = !1) {
  if (t.width === 0 || t.height === 0) return;
  const s = AX(n, i),
    o = () =>
      n.drawImage(e, t.x, t.y, t.width, t.height, s.x, s.y, s.width, s.height);
  if ((!r && (t.width !== 1 || t.height !== 1)) || !n.imageSmoothingEnabled) {
    o();
    return;
  }
  n.imageSmoothingEnabled = !1;
  try {
    o();
  } finally {
    n.imageSmoothingEnabled = !0;
  }
}

function AX(n, e) {
  if (typeof n.getTransform != "function") return e;
  const t = n.getTransform();
  if (
    t.b !== 0 ||
    t.c !== 0 ||
    !Number.isFinite(t.a) ||
    !Number.isFinite(t.d) ||
    !Number.isFinite(t.e) ||
    !Number.isFinite(t.f) ||
    t.a <= 0 ||
    t.d <= 0
  )
    return e;
  const i = (l) => (Math.round(l * t.a + t.e) - t.e) / t.a,
    r = (l) => (Math.round(l * t.d + t.f) - t.f) / t.d,
    s = i(e.x),
    o = i(e.x + e.width),
    a = r(e.y),
    c = r(e.y + e.height);
  return { x: s, y: a, width: o - s, height: c - a };
}

function Kr(n, e) {
  const [t, i, r, s] = (T(n, e) ?? "0 0 0 0").trim().split(/\s+/).map(Number);
  return { x: t, y: i, width: r - t, height: s - i };
}

function Oe(n, e, t) {
  return n >= t.x && n <= t.x + t.width && e >= t.y && e <= t.y + t.height;
}

function aw(n, e, t, i) {
  Object.assign(n.style, {
    left: `${e.x * t}px`,
    top: `${e.y * i}px`,
    width: `${e.width}px`,
    height: `${e.height}px`,
    transformOrigin: "top left",
    transform: `scale(${t}, ${i})`,
  });
}

function V0(n, e, t, i, r) {
  const s = t ? E9(t, { x: 0, y: 0, width: 0, height: 0 }) : void 0,
    o = lt(n, void 0, {
      viewport: e,
      textureSize: i,
      frameInsets: s && {
        left: s.x,
        top: s.y,
        right: -s.width - s.x,
        bottom: -s.height - s.y,
      },
    }),
    a = l5(
      { ...o, ...r },
      { left: 0, top: 0, right: e.width, bottom: e.height },
    );
  return {
    x: e.x + a.left,
    y: e.y + a.top,
    width: a.right - a.left,
    height: a.bottom - a.top,
  };
}

function jc(n, e, t, i) {
  const r = new Map(),
    s = (o, a) => {
      if (T(o, "visible") === "false") return;
      const c = T(o, "frame"),
        l = c === void 0 ? void 0 : t.get(c),
        u = V0(o, a, l, i?.get(o));
      r.set(o, u);
      const h = l ? E9(l, u) : u;
      o.children.forEach((d) => s(d, h));
    };
  return (s(n, e), r);
}

function tR(n) {
  Object.assign(n.style, {
    position: "absolute",
    width: "1px",
    height: "1px",
    padding: "0",
    border: "0",
    overflow: "hidden",
    clipPath: "inset(50%)",
    pointerEvents: "none",
  });
}

class nR extends CanvasHitController {}

function st(n, e, t) {
  return e !== n ? 0 : t === n ? 2 : 1;
}

async function ma(n, e, t) {
  const i = T(e, "setCloseButton");
  if (!i) return;
  const r = T(e, "frame"),
    s = bX(r),
    o = [`${t}/${i}.bml`, `stage_/common/${i}.bml`, `stage_/common/${s}.bml`];
  for (const a of o) {
    const c = n.canonicalCandidates(a);
    if (c.length === 0) continue;
    if (c.length !== 1)
      throw new Error(`P3528 close button ${a} 的资源不唯一。`);
    const l = s2(await c[0].bytes());
    return {
      ...l,
      attributes: [
        ...l.attributes.filter((u) => u.name !== "name"),
        { name: "name", value: i },
      ],
    };
  }
  throw new Error(`P3528 CaptionWindow 缺少 ${s}。`);
}

function bX(n) {
  return n === "CaptionDialog"
    ? "dialogCloseButton"
    : n === "BigCaptionDialog" || n === "FlagCaptionDialog"
      ? "dialogLargeCloseButton"
      : "defaultCloseButton";
}

function ct(n, e, t) {
  const i = t.x + (t.width - e.width) * 0.5,
    r = t.y + (t.height - e.height) * 0.5;
  n.drawImage(e.image, i, r);
}

function m4(n, e, t) {
  const i = pM(e, "TextButton"),
    r = T(n, "frame") ?? "DefaultStaticButton",
    s = (MX(n) && T(i, "focusButtonFrame")) || r,
    o = i.children.find((u) => u.name === s) ?? i,
    a = pM(t, s);
  let c;
  const l = ["t", "overT", "clickedT", "disabledT"].map(
    (u, h) => (
      (c = T(n, `${u}extRender`) ?? c),
      {
        frame: Ft(a.children[h]),
        textRender: c ?? T(o, `${u}extRender`) ?? "default",
        textColor: fM(n, o, `${u}extColor`),
        textColor2: fM(n, o, `${u}extColor2`),
      }
    ),
  );
  return { frameName: s, states: l };
}

function MX(n) {
  if (n.name !== "TextButton") return !1;
  const e = (T(n, "text") ?? "").toLowerCase(),
    t = (T(n, "name") ?? "").toLowerCase();
  return ["#sb(ok)", "#sb(yes)"].includes(e) || ["ok", "okbutton"].includes(t);
}

function fM(n, e, t) {
  const i = T(n, t) ?? T(e, t) ?? "black";
  if (i === "white" || i === "black") return i;
  const [r, s, o, a] = i.trim().split(/\s+/).map(Number);
  return `rgba(${s}, ${o}, ${a}, ${r / 255})`;
}

function pM(n, e) {
  const t = n.children.find((i) => i.name === e);
  if (!t) throw new Error(`窗口按钮资源缺少 ${e}。`);
  return t;
}

function an(n, e) {
  const t = T(n, "frame"),
    i = e.children
      .find((c) => c.name === "CaptionWindow")
      ?.children.find((c) => c.name === t),
    [r, s] = (T(n, "captionPos") ?? "0 0").trim().split(/\s+/).map(Number),
    [o, a] = ((i && T(i, "dialogCaptionPosOffset")) || "0 0")
      .trim()
      .split(/\s+/)
      .map(Number);
  return { x: r + o, y: s + a };
}

function f3(n, e, t) {
  return {
    x: e.x + n.left.width + t.x,
    y: e.y + t.y - 1,
    width: e.width - n.left.width - n.right.width,
    height: n.caption.height,
  };
}

function ve(n, e, t) {
  const i = t.stroke ?? 0;
  return (
    (n.font = `${t.size}px "${t.family}"`),
    (n.fontKerning = "none"),
    (n.letterSpacing = "0px"),
    {
      width: Array.from(e).reduce(
        (r, s) => r + n.measureText(s).width + i * 2,
        0,
      ),
      height: Math.trunc(Math.fround(Math.fround(1448 / 1e3) * t.size) + i * 2),
      ascent: Math.trunc(Math.fround(Math.fround(1160 / 1e3) * t.size)) + i,
    }
  );
}

function m9(n, e, t, i) {
  n.save();
  const r = ve(n, e, i),
    s = { left: 0, center: 0.5, right: 1 }[i.align],
    o = { top: 0, center: 0.5, bottom: 1 }[i.verticalAlign],
    a = t.height - r.height,
    c = i.kind === "label" ? Math.max(0, a) : a,
    l = i.stroke ?? 0;
  let u = Math.floor(t.x + gM(t.width - r.width, s, i.kind)) + l;
  const h = Math.floor(t.y + gM(c, o, i.kind));
  ((n.textAlign = "left"),
    (n.textBaseline = "alphabetic"),
    (n.fillStyle = i.color),
    (n.strokeStyle = i.strokeColor ?? "black"),
    (n.lineWidth = l * 2),
    (n.lineJoin = "round"));
  for (const d of e)
    (l && n.strokeText(d, u, h + r.ascent),
      n.fillText(d, u, h + r.ascent),
      (u += n.measureText(d).width + l * 2));
  n.restore();
}

function gM(n, e, t) {
  const i = n * e;
  return t === "button" && e === 0.5 ? Math.floor(i) : i;
}

const He = {
  speedIndiCombine: { mode: "individual", speed: 7, gameType: 1 },
  speedTeamCombine: { mode: "team", speed: 7, gameType: 3 },
  speedIndiInfinit: { mode: "individual", speed: 4, gameType: 1 },
  speedTeamInfinit: { mode: "team", speed: 4, gameType: 3 },
};

function $6(n) {
  return typeof n == "string" && Object.hasOwn(He, n);
}

function W6(n, e, t) {
  return $6(n) && He[n].mode === e && He[n].speed === t;
}

const xX = {
  ordinary: "普通竞速",
  grip: "抓地模式",
  shadow: "幽灵模式",
  roadblock: "挡人模式",
  lte: "LTE Web试玩",
  giant: "巨人模式",
  rp: "RP竞速",
};

function cw(n) {
  return (
    n === "ordinary" ||
    n === "grip" ||
    n === "shadow" ||
    n === "roadblock" ||
    n === "lte" ||
    n === "giant" ||
    n === "rp"
  );
}

function G2(n) {
  if (n.gameplay === void 0) return "ordinary";
  if (!cw(n.gameplay)) throw new Error("未知的房间玩法");
  return n.gameplay;
}

function To(n, e, t) {
  return (n !== void 0 && !cw(n)) || !$6(e)
    ? !1
    : n === "roadblock" || n === "giant"
      ? e === "speedIndiCombine" && (t === void 0 || t === "p3553")
      : n === "rp"
        ? t === void 0 || t === "p3553"
        : n === "lte"
          ? He[e].speed === 7 && (t === void 0 || t === "p3553")
          : n === void 0 ||
            n === "ordinary" ||
            ((n === "shadow" || He[e].speed === 7) &&
              (t === void 0 || t === "p3553"));
}

function SX(n) {
  if (!To(n.gameplay, n.channelName)) throw new Error("房间玩法与类别不匹配");
  const e = He[n.channelName].mode === "team";
  switch (G2(n)) {
    case "rp":
      return e ? 30 : 29;
    case "ordinary":
      return e ? 3 : 1;
    case "shadow":
      return e ? 39 : 38;
    case "grip":
      return e ? 49 : 48;
    case "roadblock":
      return 55;
    case "giant":
      return 32;
    case "lte":
      return e ? 47 : 46;
  }
}

const H6 = {
    speedIndiCombine: "个人标准",
    speedTeamCombine: "组队标准",
    speedIndiInfinit: "个人无限加速",
    speedTeamInfinit: "组队无限加速",
  },
  lw = {
    speedIndiCombine: "标准个人RP",
    speedTeamCombine: "标准组队RP",
    speedIndiInfinit: "无限个人RP",
    speedTeamInfinit: "无限组队RP",
  };

function iR(n) {
  const e = G2(n);
  return e === "roadblock"
    ? "挡人模式"
    : e === "giant"
      ? "巨人模式"
      : e === "rp"
        ? lw[n.channelName]
        : e === "lte"
          ? `${n.channelName === "speedTeamCombine" ? "组队" : "个人"}LTE Web试玩`
          : e === "ordinary"
            ? H6[n.channelName]
            : `${n.channelName === "speedTeamCombine" || n.channelName === "speedTeamInfinit" ? "组队" : "个人"}${e === "grip" ? "抓地" : "幽灵"}${e === "shadow" ? (n.channelName.endsWith("Infinit") ? "无限加速" : "标准") : ""}`;
}

function rR(n) {
  return `${n.name}（${iR(n)}）`;
}

function CX(n, e, t) {
  const i = rR(n);
  if (t(i) <= e) return i;
  const r = `（${iR(n)}）`,
    s = Array.from(n.name);
  for (; s.length && t(`${s.join("")}…${r}`) > e;) s.pop();
  return `${s.join("")}…${r}`;
}

async function f5(n, e) {
  const t = new FontFace(n, e.slice().buffer);
  return (await t.load(), document.fonts.add(t), t);
}

function G1(n) {
  document.fonts.delete(n);
}

function xe() {
  const n = typeof window > "u" ? 1 : window.devicePixelRatio;
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function Sr(n, e, t, i, r, s = 1600, o = 900) {
  const a = Number.isFinite(n) && n > 0 ? n : s,
    c = Number.isFinite(e) && e > 0 ? e : o,
    l = Number.isFinite(t) && t > 0 ? t : 1,
    u = Math.round(a * l) / s,
    h = Math.round(c * l) / o,
    d = Math.max(1, Math.round(i * u)),
    f = Math.max(1, Math.round(r * h));
  return { width: d, height: f, scaleX: u, scaleY: h };
}

function p3(n, e, t, i, r, s, o, a = s, c = o) {
  const l = Sr(t, i, r, s, o, a, c);
  return (
    n.width !== l.width && (n.width = l.width),
    n.height !== l.height && (n.height = l.height),
    e.setTransform(l.scaleX, 0, 0, l.scaleY, 0, 0),
    l
  );
}

function EX(n, e, t, i = 1600, r = 900) {
  const s = Number.isFinite(n) && n > 0 ? n : i,
    o = Number.isFinite(e) && e > 0 ? e : r,
    a = Number.isFinite(t) && t > 0 ? t : 1,
    c = Math.round(s * a),
    l = Math.round(o * a);
  let u = Math.max(c / i, l / r);
  return (
    (Math.floor(i * u) < c || Math.floor(r * u) < l) &&
      (u += Number.EPSILON * Math.max(1, u)),
    u
  );
}

const tt = Object.freeze({
    ruleset: "web-roadblock-v1",
    minPlayers: 5,
    limitMs: 18e4,
    noRunnerManualReset: !0,
    resultDelayMs: 3e3,
  }),
  TX = Object.freeze([
    "desert_I01",
    "village_I02",
    "village_R01",
    "ice_I05",
    "ice_R04",
    "tomb_I01",
    "tomb_R01",
    "mine_I02",
    "fairy_I04",
    "china_I02",
    "castle_I02",
    "castle_I03",
    "castle_I06",
    "park_R01",
    "steam_I01",
    "jurassic_R01",
    "forest_I01_rvs",
    "forest_I05_rvs",
    "forest_I07_rvs",
    "village_I01_rvs",
    "village_I13_rvs",
    "ice_I02_rvs",
    "ice_I04_rvs",
    "northeu_I04_rvs",
  ]);

function sR(n) {
  return TX.includes(n);
}

const _X = 0;

function oR(n, e) {
  return (
    (n === void 0 && e === void 0) ||
    (!!n &&
      !!e &&
      n.ruleset === e.ruleset &&
      n.runnerId === e.runnerId &&
      n.limitMs === e.limitMs &&
      n.noRunnerManualReset === e.noRunnerManualReset)
  );
}

function Dt(bytes, seed = 0) { return rhoAdler32(bytes, seed); }

const wR = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0],
  M8 = [0, 0, 0],
  x8 = [0, 0, 0],
  EM = [0, 0, 0];

class vR {
  constructor(e) {
    ((this.source = e),
      (this.positions = new Float32Array(e.wedges.length * 3)),
      (this.normals = new Float32Array(e.wedges.length * 3)));
    const t = new Int32Array(e.vertices.length).fill(-1);
    ((this.normalSourceOffsets = new Int32Array(e.wedges.length)),
      e.wedges.forEach((s, o) => {
        (t[s.skinVertexIndex] < 0 && (t[s.skinVertexIndex] = o),
          (this.normalSourceOffsets[o] = t[s.skinVertexIndex] * 3));
      }),
      (this.outlinePositions = e.vertices.map(() => [0, 0, 0])),
      (this.globalPose = e.bones.map(() => new Array(12).fill(0))),
      (this.palette = e.bones.map(() => new Array(12).fill(0))));
    const i = new Float32Array(e.wedges.length * 2);
    e.wedges.forEach((s, o) => {
      i.set([s.u, s.v], o * 2);
    });
    const r = [];
    (e.triangles.forEach((s) => {
      r.push(...s.wedgeIndices);
    }),
      (this.geometry = new t9()),
      this.geometry.setAttribute("position", new _0(this.positions, 3)),
      this.geometry.setAttribute("normal", new _0(this.normals, 3)),
      this.geometry.setAttribute("uv", new _0(i, 2)),
      this.geometry.setIndex(r),
      (this.outlineSource = {
        positions: this.outlinePositions,
        normals: [],
        texcoords: [],
        faces: e.triangles.map((s) => ({
          texcoordIndices: [...s.wedgeIndices],
          adjacentFaceIndices: [...s.adjacentTriangleIndices],
          positionIndices: [...s.positionIndices],
          winding: s.winding,
          outlineOpenEdge: s.unknown13,
        })),
      }),
      this.update(
        Array.from({ length: e.bones.length }, (s, o) => e.bones[o].localBind),
      ));
  }
  source;
  geometry;
  positions;
  normals;
  normalSourceOffsets;
  outlinePositions;
  globalPose;
  palette;
  outlineSource;
  update(e) {
    const t = this.updatePose(e);
    return (this.updateVertices(), t);
  }
  updatePose(e) {
    if (e.length < this.source.bones.length)
      throw new Error(
        `character pose 需要 ${this.source.bones.length} bones，实际为 ${e.length}。`,
      );
    const t = this.globalPose,
      i = this.palette,
      r = this.source.bones;
    for (let s = 0; s < r.length; s += 1) {
      const o = r[s];
      if (s === 0) TM(t[s], e[s]);
      else if (o.enabled) {
        if (o.parentIndex >= s)
          throw new Error(
            `character bone ${s} parent ${o.parentIndex} 尚未建立。`,
          );
        Hp(t[s], t[o.parentIndex], e[s]);
      } else TM(t[s], wR);
      Hp(i[s], t[s], o.inverseBind);
    }
    return t;
  }
  updateVertices() {
    this.applyPalette(this.palette);
  }
  applyPalette(e) {
    const t = this.source.wedges;
    for (let r = 0; r < t.length; r += 1) {
      const s = r * 3,
        o = this.normalSourceOffsets[r];
      if (o === s) {
        const a = this.source.vertices[t[r].skinVertexIndex];
        (FY(EM, a.normal, a.bone0, a.bone1, a.weight0, a.weight1, e),
          this.normals.set(EM, s));
      } else
        ((this.normals[s] = this.normals[o]),
          (this.normals[s + 1] = this.normals[o + 1]),
          (this.normals[s + 2] = this.normals[o + 2]));
    }
    const i = this.source.vertices;
    for (let r = 0; r < i.length; r += 1) {
      const s = i[r];
      PY(
        this.outlinePositions[r],
        s.position,
        s.bone0,
        s.bone1,
        s.weight0,
        s.weight1,
        e,
      );
    }
    for (let r = 0; r < t.length; r += 1)
      this.positions.set(this.outlinePositions[t[r].skinVertexIndex], r * 3);
    ((this.geometry.getAttribute("position").needsUpdate = !0),
      (this.geometry.getAttribute("normal").needsUpdate = !0),
      this.geometry.computeBoundingBox(),
      this.geometry.computeBoundingSphere());
  }
}

function PY(n, e, t, i, r, s, o) {
  (_M(n, Wl(o, t, r), e),
    i !== 65535 &&
      (_M(M8, Wl(o, i, s), e),
      (n[0] = q2(q2(n[0] * r) + q2(M8[0] * s))),
      (n[1] = q2(q2(n[1] * r) + q2(M8[1] * s))),
      (n[2] = q2(q2(n[2] * r) + q2(M8[2] * s)))));
}

function FY(n, e, t, i, r, s, o) {
  (GM(n, Wl(o, t, r), e),
    i !== 65535 &&
      (GM(x8, Wl(o, i, s), e),
      (n[0] = q2(q2(n[0] * r) + q2(x8[0] * s))),
      (n[1] = q2(q2(n[1] * r) + q2(x8[1] * s))),
      (n[2] = q2(q2(n[2] * r) + q2(x8[2] * s)))));
}

function Wl(n, e, t) {
  if (e < n.length) return n[e];
  if (t === 0) return wR;
  throw new Error(`character skin palette index ${e} 越界且权重为 ${t}。`);
}

function TM(n, e) {
  for (let t = 0; t < 12; t += 1) n[t] = e[t];
}

function yR(n, e) {
  const t = new Array(12);
  return (Hp(t, n, e), t);
}

function Hp(n, e, t) {
  for (let i = 0; i < 3; i += 1) {
    for (let r = 0; r < 3; r += 1)
      n[i * 4 + r] = q2(
        q2(q2(e[i * 4] * t[r]) + q2(e[i * 4 + 1] * t[4 + r])) +
          q2(e[i * 4 + 2] * t[8 + r]),
      );
    n[i * 4 + 3] = q2(
      q2(
        q2(q2(e[i * 4] * t[3]) + q2(e[i * 4 + 1] * t[7])) +
          q2(e[i * 4 + 2] * t[11]),
      ) + e[i * 4 + 3],
    );
  }
}

function _M(n, e, t) {
  for (let i = 0; i < 3; i += 1)
    n[i] = q2(
      q2(
        q2(q2(e[i * 4] * t[0]) + q2(e[i * 4 + 1] * t[1])) +
          q2(e[i * 4 + 2] * t[2]),
      ) + e[i * 4 + 3],
    );
}

function GM(n, e, t) {
  for (let i = 0; i < 3; i += 1)
    n[i] = q2(
      q2(q2(e[i * 4] * t[0]) + q2(e[i * 4 + 1] * t[1])) +
        q2(e[i * 4 + 2] * t[2]),
    );
}

function q2(n) {
  return Math.fround(n);
}

class DY {
  global = Array.from({ length: 256 }, () => Array(12).fill(0));
  collect(e, t) {
    if (!e.bones.length || e.bones.length > 256)
      throw new Error("Toon bone count 越界。");
    return (
      e.bones.forEach((i, r) => {
        if (!(r !== 0 && !i.enabled)) {
          if (!t[r]) throw new Error(`Toon bone ${r} 缺少已分配的动作矩阵。`);
          if (r && i.parentIndex >= r)
            throw new Error(`Toon bone ${r} 父索引无效。`);
          this.global[r] =
            r === 0 ? [...t[r]] : yR(this.global[i.parentIndex], t[r]);
        }
      }),
      this.global
    );
  }
}

const AR = new DY();

class _o extends v2 {
  multiplyMatrices(e, t) {
    const i = e.elements,
      r = t.elements,
      s = Math.fround(i[0]),
      o = Math.fround(i[4]),
      a = Math.fround(i[8]),
      c = Math.fround(i[12]),
      l = Math.fround(i[1]),
      u = Math.fround(i[5]),
      h = Math.fround(i[9]),
      d = Math.fround(i[13]),
      f = Math.fround(i[2]),
      p = Math.fround(i[6]),
      v = Math.fround(i[10]),
      w = Math.fround(i[14]),
      g = Math.fround(r[0]),
      y = Math.fround(r[4]),
      b = Math.fround(r[8]),
      A = Math.fround(r[12]),
      x = Math.fround(r[1]),
      M = Math.fround(r[5]),
      E = Math.fround(r[9]),
      _ = Math.fround(r[13]),
      C = Math.fround(r[2]),
      S = Math.fround(r[6]),
      G = Math.fround(r[10]),
      I = Math.fround(r[14]);
    return this.set(
      Ye(s, o, a, g, x, C),
      Ye(s, o, a, y, M, S),
      Ye(s, o, a, b, E, G),
      Math.fround(Ye(s, o, a, A, _, I) + c),
      Ye(l, u, h, g, x, C),
      Ye(l, u, h, y, M, S),
      Ye(l, u, h, b, E, G),
      Math.fround(Ye(l, u, h, A, _, I) + d),
      Ye(f, p, v, g, x, C),
      Ye(f, p, v, y, M, S),
      Ye(f, p, v, b, E, G),
      Math.fround(Ye(f, p, v, A, _, I) + w),
      0,
      0,
      0,
      1,
    );
  }
}

function cn(n) {
  n.matrixWorld = new _o().copy(n.matrixWorld);
}

function Hl(n) {
  (n.matrix.set(1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1),
    (n.matrixAutoUpdate = !1),
    cn(n));
}

function Ye(n, e, t, i, r, s) {
  const o = Math.fround(Math.fround(n * i) + Math.fround(e * r));
  return Math.fround(o + Math.fround(t * s));
}

function VY(n, e) {
  const t = new Map(),
    i = new Map(),
    r = new Map(),
    s = pw(n.root, e, t, i),
    o = (a) => {
      (a.children.forEach((c) => {
        const l = t.get(c);
        l && !r.has(l.name) && r.set(l.name, { source: l, object: c });
      }),
        a.children.forEach(o));
    };
  return (o(s), { object: s, nodes: r, bySource: i });
}

function NY(n) {
  const e = new Map(),
    t = new Map(),
    i = new Map(),
    r = pw(n.root, void 0, e, t),
    s = (o) => {
      (o.children.forEach((a) => {
        const c = e.get(a);
        c && !i.has(c.name) && i.set(c.name, { source: c, object: a });
      }),
        o.children.forEach(s));
    };
  return (s(r), { object: r, nodes: i, bySource: t });
}

function J5(n) {
  if (n.root.value.className !== "ReKart")
    throw new Error("玩家车辆 model.1s 的根对象不是 ReKart。");
  return n.root.value;
}

function pw(n, e, t, i) {
  const r = n.value;
  if (r.className === "ReToonSkinned")
    throw new Error(`${r.name || "ReToonSkinned"} 的 skin consumer 尚未闭合。`);
  if (i.has(r))
    throw new Error(
      `${r.name || r.className} 使用共享 node occurrence，scene owner 尚未闭合。`,
    );
  const s =
    e && r.className === "ReToonRigid"
      ? OY(r, e)
      : e && r.className === "ReTriList"
        ? zY(r, e)
        : new T2();
  return (
    (s.name = r.name),
    cn(s),
    UY(s, r.transform),
    t.set(s, r),
    i.set(r, s),
    r.children.forEach((o) => {
      if (!$Y(o))
        throw new Error(`${r.name} 的 child 不是 Relement 派生节点。`);
      s.add(pw(o, e, t, i));
    }),
    (s.visible = r.nodeEnabled !== 0),
    s
  );
}

function OY(n, e) {
  const t = new t9(),
    i = n.geometry.value,
    r = new Float32Array(i.faces.length * 9),
    s = new Float32Array(i.faces.length * 9),
    o = new Float32Array(i.faces.length * 6);
  return (
    i.faces.forEach((a, c) => {
      for (let l = 0; l < 3; l += 1) {
        const u = i.positions[a.positionIndices[l]],
          h = i.texcoords[a.texcoordIndices[l]],
          d = i.normals[h.normalIndex];
        (r.set(u, c * 9 + l * 3),
          s.set(d, c * 9 + l * 3),
          o.set([h.u, h.v], c * 6 + l * 2));
      }
    }),
    t.setAttribute("position", new _0(r, 3)),
    t.setAttribute("normal", new _0(s, 3)),
    t.setAttribute("uv", new _0(o, 2)),
    MR(t),
    bR(t, e, i)
  );
}

function zY(n, e) {
  const t = n.vertexData.value;
  if (!t.positions)
    throw new Error(`${n.name} 的 ReTriList 缺少 position channel。`);
  if (!t.normals)
    throw new Error(`${n.name} 的 ReTriList normal consumer 尚未闭合。`);
  if (t.uvSetsPerVertex === 0)
    throw new Error(`${n.name} 的 ReTriList 缺少 texture UV。`);
  const i = new t9();
  return (
    i.setAttribute("position", new M1(t.positions.flat(), 3)),
    i.setAttribute("normal", new M1(t.normals.flat(), 3)),
    i.setAttribute(
      "uv",
      new M1(
        t.uvs.flatMap((r) => [r[0][0], r[0][1]]),
        2,
      ),
    ),
    i.setIndex([...t.indices]),
    MR(i),
    bR(i, e, t)
  );
}

function bR(n, e, t) {
  return ((n.userData.resource = t), new D2(n, e));
}

function MR(n) {
  (n.computeBoundingBox(), n.computeBoundingSphere());
}

function c3(n, e, t = e.translation, i = e.basis, r = e.scale) {
  const [s, o, a] = i,
    [c, l, u] = r,
    [h, d, f] = t;
  (n.matrix.set(
    Math.fround(s[0] * c),
    Math.fround(s[1] * l),
    Math.fround(s[2] * u),
    h,
    Math.fround(o[0] * c),
    Math.fround(o[1] * l),
    Math.fround(o[2] * u),
    d,
    Math.fround(a[0] * c),
    Math.fround(a[1] * l),
    Math.fround(a[2] * u),
    f,
    0,
    0,
    0,
    1,
  ),
    (n.matrixAutoUpdate = !1),
    (n.matrixWorldNeedsUpdate = !0));
}

function UY(n, e) {
  c3(n, e);
}

function $Y(n) {
  return (
    n.value.className === "ReKart" ||
    n.value.className === "Relement" ||
    n.value.className === "ReCharacter" ||
    n.value.className === "ReToonRigid" ||
    n.value.className === "ReTriList" ||
    n.value.className === "ReToonSkinned"
  );
}

const WY = [
    "f00",
    "f40",
    "f41",
    "f42",
    "f45",
    "f46",
    "f47",
    "f48",
    "f49",
    "f50",
    "f51",
    "f54",
  ],
  qp = [
    "f00",
    "f08",
    "f45",
    "f46",
    "f47",
    "f48",
    "f49",
    "f50",
    "f51",
    "f11",
    "f54",
  ],
  HY = ["f00", "f10", "f22", "f23", "f54"],
  qY = [
    "f00",
    "f08",
    "f10",
    "f11",
    "f22",
    "f23",
    "f40",
    "f41",
    "f42",
    "f45",
    "f46",
    "f47",
    "f48",
    "f49",
    "f50",
    "f51",
    "f54",
  ],
  Xc = {
    kind: "base",
    modelFolder: "",
    bodyFolder: "",
    faceFolder: "",
    motionFolder: "",
    modelStem: "model",
    highStem: "0",
    bodyStem: "1",
    forceFaceZero: !1,
  };

class gw {
  constructor(e) {
    this.records = e;
  }
  records;
  static parse(e, t) {
    const i = new Map();
    return (BM(i, e, "direct"), BM(i, t, "set"), new gw(i));
  }
  resolve(e, t, i) {
    if (t === "1") return Xc;
    const r = this.records.get(ER(e, t));
    if (!r) throw new Error(`P3528 costume descriptor 缺少 ${e}/${t}。`);
    return r.kind === "set" ? jY(r.set) : KY(r, i);
  }
}

function xR(n) {
  const e = new Set();
  return (
    n.forEach((t) => t.root.value.map.forEach((i) => e.add(i))),
    [...e].sort((t, i) => t - i)
  );
}

function SR(n, e, t) {
  const i = new Map(n.map((a) => [mw(a), a])),
    r =
      i.has(fe(e.faceFolder, "f00_0.tga").toLowerCase()) ||
      i.has(fe(e.faceFolder, "f00_0.png").toLowerCase()),
    s = new Map();
  for (const a of t) {
    const c = e.forceFaceZero ? 0 : a,
      l = `f${String(c).padStart(2, "0")}`;
    if (r) {
      const h = o(fe(e.faceFolder, `${l}_0`)),
        d = o(fe(e.faceFolder, `${l}_1`));
      if (!h && !d) {
        if (c !== 2)
          throw new Error(`character split face ${l} 缺少原版绑定结论。`);
        continue;
      }
      if (!h || !d) throw new Error(`character split face ${l} 资源不完整。`);
      s.set(a, { kind: "split", base: h, overlay: d });
      continue;
    }
    const u = o(fe(e.faceFolder, l));
    if (u) s.set(a, { kind: "direct", image: u });
    else if (c !== 2) throw new Error(`character face ${l} 缺少原版绑定结论。`);
  }
  return s;
  function o(a) {
    const c = i.get(`${a}.png`.toLowerCase()),
      l = i.get(`${a}.tga`.toLowerCase()),
      u = i.get(`${a}.kng`.toLowerCase());
    if (l || u)
      throw new Error(`${a} 使用尚未迁移的 ${l ? "tga" : "kng"} 解码。`);
    return c;
  }
}

function CR(n, e) {
  const t = new Map(n.map((c) => [mw(c), c])),
    i = (c) => {
      const l = t.get(c.toLowerCase());
      if (!l) throw new Error(`character archive 缺少 ${c}。`);
      return l;
    },
    r = i(fe(e.modelFolder, `${e.modelStem}.1s`)),
    s = i(fe(e.bodyFolder, `${e.bodyStem}.png`)),
    o = XY(t, e.faceFolder);
  if (!o) throw new Error(`${e.faceFolder || "base"} 缺少目标 face probe。`);
  const a = Object.fromEntries(
    qY.flatMap((c) => {
      const l = t.get(fe(e.motionFolder, `${c}.1s`).toLowerCase());
      return l ? [[c, l]] : [];
    }),
  );
  return {
    kind: e.kind,
    model: r,
    body: s,
    face: o,
    faceFolder: e.faceFolder,
    motionFolder: e.motionFolder,
    forceFaceZero: e.forceFaceZero,
    motions: a,
    high: t.get(fe(e.modelFolder, `${e.highStem}.png`).toLowerCase()),
  };
}

function BM(n, e, t) {
  if (e.name !== "costume")
    throw new Error(`${t} costume 根节点不是 costume。`);
  e.children.forEach((i) =>
    i.children.forEach((r) => {
      const s = ER(i.name, r.name);
      if (n.has(s))
        throw new Error(`P3528 costume descriptor 重复 ${i.name}/${r.name}。`);
      const o = T(r, "set");
      if (t === "set" && !o)
        throw new Error(`P3528 costumeSet ${i.name}/${r.name} 缺少 set。`);
      n.set(s, {
        kind: t,
        model: T(r, "model"),
        texture: T(r, "tex"),
        face: T(r, "face"),
        set: o,
      });
    }),
  );
}

function KY(n, e) {
  const t = n.model ?? Xc.modelStem,
    i = n.face ? `costume/face/${n.face}` : "",
    r = new Set(e.map(mw)),
    s =
      !!n.face &&
      !r.has(fe(i, "f01.png").toLowerCase()) &&
      !r.has(fe(i, "f01_0.png").toLowerCase());
  return {
    kind: "costume-model",
    modelFolder: n.model ? "costume/model" : "",
    bodyFolder: n.texture ? "costume/texture" : "",
    faceFolder: i,
    motionFolder: "",
    modelStem: t,
    highStem: n.model ? `${t}_high` : Xc.highStem,
    bodyStem: n.texture ?? Xc.bodyStem,
    forceFaceZero: s,
  };
}

function jY(n) {
  const e = `costume/set/${n}`;
  return {
    kind: "costume-set",
    modelFolder: e,
    bodyFolder: e,
    faceFolder: e,
    motionFolder: e,
    modelStem: "model",
    highStem: "0",
    bodyStem: "1",
    forceFaceZero: !1,
  };
}

function XY(n, e) {
  return (
    n.get(fe(e, "f00_0.tga").toLowerCase()) ??
    n.get(fe(e, "f00_0.png").toLowerCase()) ??
    n.get(fe(e, "f00.tga").toLowerCase()) ??
    n.get(fe(e, "f00.png").toLowerCase())
  );
}

function ER(n, e) {
  return `${n}\0${e}`;
}

function fe(n, e) {
  return n ? `${n}/${e}` : e;
}

function mw(n) {
  return n.replaceAll("\\", "/").toLowerCase();
}

async function TR(n, e, t, i, r, s, o = {}) {
  const a = n.root.value;
  if (a.serializedBoundsOverride !== 0 || a.cullingTraversalMode !== 3)
    throw new Error("P3528 ReCharacter root bounds mode 不在已闭合模型集合。");
  const [c, l] = await Promise.all([
      QY(e, o),
      Promise.all([...t].map(async ([U, O]) => [U, await YY(U, O, o)])),
    ]),
    u = new Map(l),
    h = o.outlineBatch,
    d = Q(i.face()),
    f = new T2();
  ((f.name = "TimeAttackCharacter"),
    o.convertClientCoordinates !== !1 ? Hl(f) : cn(f));
  const p = new Set(),
    v = [],
    w = new Set(),
    g = [],
    y = [],
    b = new v2(),
    A = new v2(),
    x = new H(),
    M = [];
  let E;
  const _ = ju(),
    C = ju(n.root.value, _).alpha,
    S = [],
    G = K(n.root, _, !1),
    I = new T2();
  ((I.name = "ReCharacter:P3528Cull"), I.add(G));
  const L = {
    cullingObject: I,
    sourceObject: G,
    bounds: a.bounds0,
    cullingTraversalMode: a.cullingTraversalMode,
    children: [],
    enabled: a.nodeEnabled !== 0,
  };
  f.add(I);
  const k = M[0]?.skin;
  if (!k) throw new Error("ReCharacter 缺少主 ReToonSkinned body。");
  const D = [
    { object: G.children[1], bone: 5, local: G.children[1]?.matrix.clone() },
    { object: G.children[2], bone: 5, local: G.children[2]?.matrix.clone() },
    { object: G.children[3], bone: 5 },
    { object: G.children[4], bone: 9 },
    { object: G.children[5], bone: 14 },
  ];
  return {
    object: f,
    rootMaterialBindings: S,
    getDecorationOwner: () => G,
    getDecorationSocket: V,
    update: q,
    reset: () => i.reset(),
    dispose: e0,
  };
  function V(U, O) {
    return G.children[U]?.children[O];
  }
  function K(U, O, F) {
    const z = U.value,
      Y = ju(z, O),
      X = F || z.name === "face";
    let l0;
    if (z.className === "ReToonRigid") {
      const r0 = nZ(z.geometry.value);
      (w.add(r0),
        (l0 = P(r0, z.geometry.value, X ? d : c, Y, z.sortDepthBias, X)));
    } else if (z.className === "ReToonSkinned") {
      const r0 = new vR(z.geometry.value);
      (w.add(r0.geometry),
        (l0 = P(r0.geometry, r0.outlineSource, c, Y, z.sortDepthBias, !1)),
        M.push({ skin: r0, object: l0 }),
        qm(l0, () => {
          E && AR.collect(z.geometry.value, E);
        }));
    } else l0 = new T2();
    return (
      (l0.name = z.name),
      iZ(l0, z.transform),
      (l0.visible = z.nodeEnabled !== 0),
      z.children.forEach((r0) => {
        if (!rZ(r0))
          throw new Error(`${z.name || z.className} child 不是 Relement。`);
        l0.add(K(r0, Y, X));
      }),
      l0
    );
  }
  function P(U, O, F, z, Y, X) {
    const l0 = bo(F, { kind: "normal-projection" });
    (Mo(l0, tZ(z.alpha, z.zbuf)), p.add(l0), X && v.push(l0));
    const r0 = new D2(U, l0);
    (S.push({ mesh: r0, inheritsRootAlpha: z.alpha === C }),
      (r0.frustumCulled = !1),
      ie(r0, Y, l0.transparent, l0.transparent ? -0.01 : 0));
    const j = new N6(O, 4278190080, 2130706432, !0, h);
    ((j.object.frustumCulled = !1), ie(j.object, Y, !0));
    const F0 = new T2();
    return (
      F0.add(r0, j.object),
      g.push({ outline: j, mesh: r0 }),
      y.push({ mesh: r0, material: l0 }),
      F0
    );
  }
  function q(U, O, F, z, Y) {
    const X = i.update(U, Y);
    E = X;
    const l0 = Q(i.face());
    v.forEach((j) => {
      j.uniforms.baseMap.value = l0;
    });
    const r0 = k.updatePose(X);
    for (let j = 1; j < M.length; j += 1) M[j].skin.updatePose(X);
    if (
      (D.forEach(({ object: j, bone: F0, local: O0 }) => {
        if (!j) return;
        const z0 = ZY(r0[F0]);
        j.matrix.copy(O0 ? z0.multiply(O0) : z0);
      }),
      !(O instanceof Z9))
    )
      throw new Error(
        "P3528 ReCharacter hierarchy culling 需要 perspective camera。",
      );
    if ((f.updateWorldMatrix(!0, !0), JG([L], O), !Xu(I))) {
      for (const { outline: j } of g) j.dropFrame();
      return;
    }
    for (const { skin: j, object: F0 } of M) Xu(F0) && j.updateVertices();
    x.set(O.position.x, -O.position.z, O.position.y);
    for (const { mesh: j, material: F0 } of y)
      Xu(j) &&
        (b.makeRotationX(Math.PI / 2).multiply(j.matrixWorld),
        A.copy(b).invert(),
        xo(F0, r, s, b, A, x));
    g.forEach(({ outline: j, mesh: F0 }) => j.update(F0, O, F, z));
  }
  function e0() {
    (f.removeFromParent(),
      g.forEach(({ outline: U }) => U.dispose()),
      w.forEach((U) => U.dispose()),
      p.forEach((U) => U.dispose()),
      c.dispose(),
      u.forEach((U) => U.dispose()));
  }
  function Q(U) {
    return u.get(U) ?? c;
  }
}

async function YY(n, e, t) {
  if (!e.overlay) return eZ(e.image, `character:face:${n}`);
  const i = await p2(e.image),
    r = await _R(e.overlay, i.width, i.height);
  return ww(
    K6(
      i.pixels,
      r.pixels,
      t.primaryColor ?? 4278190080,
      t.highColor ?? 4294967295,
    ),
    i.width,
    i.height,
    `character:face:${n}`,
  );
}

function ZY(n) {
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

async function QY(n, e) {
  const t = await p2(n),
    i = e.highTextureBytes
      ? JY(
          t.pixels,
          (await _R(e.highTextureBytes, t.width, t.height)).pixels,
          e.primaryColor ?? 4278190080,
          e.highColor ?? 4294967295,
        )
      : t.pixels;
  return ww(i, t.width, t.height, "character:body");
}

function JY(n, e, t, i) {
  return K6(e, n, t, i);
}

async function _R(n, e, t) {
  const i = await p2(n);
  if (i.width !== e || i.height !== t)
    throw new Error(
      `character high image ${i.width}x${i.height} 与 body ${e}x${t} 不匹配。`,
    );
  return i;
}

function K6(n, e, t, i) {
  if (n.length !== e.length || n.length % 4 !== 0)
    throw new Error("character body/high RGBA8 长度不匹配。");
  const r = RM(t),
    s = RM(i),
    o = new Uint8Array(n.length);
  for (let a = 0; a < n.length; a += 4) {
    const c = e[a],
      l = e[a + 1],
      u = e[a + 2];
    if (c === 255 && l === 0 && u === 255) continue;
    const h = n[a + 3],
      d = n[a] > 127 || n[a + 1] > 127 || n[a + 2] > 127,
      f = ui(r.r, d ? s.r : n[a], h),
      p = ui(r.g, d ? s.g : n[a + 1], h),
      v = ui(r.b, d ? s.b : n[a + 2], h),
      w = e[a + 3];
    ((o[a] = ui(f, c, w)),
      (o[a + 1] = ui(p, l, w)),
      (o[a + 2] = ui(v, u, w)),
      (o[a + 3] = 255));
  }
  return o;
}

function ui(n, e, t) {
  return Math.min(
    255,
    Math.floor((n * (255 - t)) / 255) + Math.floor((e * t) / 255),
  );
}

function RM(n) {
  return { r: (n >>> 16) & 255, g: (n >>> 8) & 255, b: n & 255 };
}

async function eZ(n, e) {
  const t = await p2(n);
  return ww(t.pixels, t.width, t.height, e);
}

function ww(n, e, t, i) {
  const r = new J9(n, e, t, e9, _9);
  return (
    (r.name = i),
    (r.colorSpace = v9),
    (r.flipY = !1),
    (r.wrapS = r.wrapT = S1),
    (r.magFilter = r.minFilter = h9),
    (r.generateMipmaps = !1),
    (r.needsUpdate = !0),
    r
  );
}

function ju(n, e) {
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

function tZ(n, e) {
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

function nZ(n) {
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

function iZ(n, e) {
  (cn(n), c3(n, e));
}

function rZ(n) {
  return [
    "ReKart",
    "Relement",
    "ReCharacter",
    "ReToonRigid",
    "ReTriList",
    "ReToonSkinned",
  ].includes(n.value.className);
}

function Xu(n) {
  for (let e = n; e; e = e.parent) if (!e.visible) return !1;
  return !0;
}

async function sZ(n, e, t) {
  const i = await n.timeAttackPlateItem(e),
    r = await p2(await i.texture.bytes());
  if (!i.fontName) return r;
  const [s, o] = await Promise.all([GR(n, i.fontName), aZ(n, t)]);
  return BR(r, s, o, i.fontColor);
}

async function oZ(n) {
  const e = new Uint8Array(3600);
  for (let i = 3; i < e.length; i += 4) e[i] = 255;
  const t = await GR(n, "plateBold");
  return BR({ width: 45, height: 20, pixels: e }, t, "SIM", "255 255 255 255");
}

async function GR(n, e) {
  const t = `stuff2_/plate/font/${e}`,
    [i, r] = await Promise.all([Kp(n, `${t}.bmh`), Kp(n, `${t}.bmx`)]);
  return cZ(i, r);
}

async function Kp(n, e) {
  const t = n.exactCanonicalCandidates(e);
  if (t.length !== 1)
    throw new Error(`${e} source 数量必须为 1，实际 ${t.length}。`);
  return t[0].bytes();
}

async function aZ(n, e) {
  if (e !== "") return e;
  const i = x1(await Kp(n, "zeta_/cn/content/config.xml")).root.children.find(
    (r) => j0(r, "name") === "defaultInitial",
  );
  return (i && j0(i, "value")) || "CAR";
}

function cZ(n, e) {
  const t = new DataView(n.buffer, n.byteOffset, n.byteLength),
    i = t.getUint16(0, !0),
    r = t.getUint32(2, !0),
    s = Math.min(t.getUint32(6, !0), 16);
  if (t.getUint32(10, !0) !== 4)
    throw new Error("号牌字体不是已闭合的 4-bit bitmap。 ");
  const o = new Map();
  let a = 14;
  for (let c = 0; c < i; c += 1) {
    const l = Math.min(t.getUint16(a, !0), 65534),
      u = Math.min(t.getUint16(a + 2, !0), 65534);
    a += 4;
    for (let h = l; h <= u; h += 1) {
      const d = t.getUint8(a),
        f = t.getUint32(a + 1, !0);
      (o.set(h, lZ(e, f, d, r)), (a += 5));
    }
  }
  if (a + 4 !== n.length || t.getUint32(a, !0) !== e.length)
    throw new Error("号牌 BMH/BMX 数据长度不匹配。 ");
  return { height: r, glyphs: o, missingGlyph: uZ(s, r) };
}

function lZ(n, e, t, i) {
  const r = t * i;
  if (e + Math.ceil(r / 2) > n.length)
    throw new Error("号牌 glyph 超出 BMX 数据。 ");
  const s = new Uint8Array(r);
  for (let o = 0; o < r; o += 1) s[o] = (n[e + (o >> 1)] >> ((o & 1) * 4)) & 15;
  return { width: t, pixels: s };
}

function uZ(n, e) {
  if (n < 3 || e < 5) throw new Error("号牌字体尺寸不能容纳原版缺字图形。 ");
  const t = new Uint8Array(n * e);
  for (let i = 2; i + 2 < e; i += 1)
    ((t[i * n + 1] = 1), (t[i * n + n - 2] = 1));
  return (
    t.fill(1, 2 * n + 1, 3 * n - 1),
    t.fill(1, (e - 3) * n + 1, (e - 2) * n - 1),
    { width: n, pixels: t }
  );
}

function BR(n, e, t, i) {
  const r = i.trim().split(/\s+/).map(Number);
  if (r.length !== 4 || r.some((a) => !Number.isInteger(a) || a < 0 || a > 255))
    throw new Error(`号牌 fontColor=${i} 不是 A R G B bytes。`);
  const s = n.pixels.slice();
  let o = 4;
  for (let a = 0; a < Math.min(t.length, 3); a += 1) {
    const c = hZ(e, t.charCodeAt(a));
    (dZ(s, n.width, n.height, o, e.height, c, r.slice(1)), (o += c.width + 1));
  }
  return { ...n, pixels: s };
}

function hZ(n, e) {
  return e === 0
    ? { width: 0, pixels: new Uint8Array() }
    : (n.glyphs.get(e) ?? n.missingGlyph);
}

function dZ(n, e, t, i, r, s, o) {
  if (i + s.width > e || 3 + r > t) throw new Error("号牌 glyph 超出纹理。 ");
  for (let a = 0; a < s.pixels.length; a += 1) {
    const c = ((3 + Math.floor(a / s.width)) * e + i + (a % s.width)) * 4;
    fZ(n, c, s.pixels[a], o);
  }
}

function fZ(n, e, t, i) {
  if (t === 0) return;
  const r = t * 17;
  for (let s = 0; s < 3; s += 1) {
    const o = Math.floor((i[s] * t) / 15);
    n[e + s] = r === 255 ? o : (o * (r + 1) + n[e + s] * (256 - r)) >> 8;
  }
  n[e + 3] = 255;
}

function jp(n) {
  if (n.root.name !== "BodyParam")
    throw new Error(`车辆参数根节点必须是 BodyParam，实际为 ${n.root.name}。`);
  if (n.root.text.trim() !== "")
    throw new Error("BodyParam 含非空 element text。");
  return {
    document: n,
    body: n.root,
    shortTrail: zp(n.root, "ShortTrail"),
    tailLampTeam: zp(n.root, "TailLampTeam"),
  };
}

function IM(n) {
  if (n.root.name !== "Dynamics")
    throw new Error(
      `速度档位参数根节点必须是 Dynamics，实际为 ${n.root.name}。`,
    );
  return { document: n, dynamics: n.root };
}

const RR = ["bml", "eml", "kml", "xml"];

async function pZ(n, e) {
  const t = Xp(n, e, "param@cn");
  let i;
  if (t)
    try {
      const o = await Go(t, "BodyParam");
      return { entry: t, value: jp(o), localized: !0 };
    } catch (o) {
      if (o instanceof bw) throw o;
      i = o instanceof Error ? o.message : String(o);
    }
  const r = Xp(n, e, "param");
  if (!r) throw new Error(`${e} 同目录缺少可用的 param@cn 或 param 资源。`);
  const s = await Go(r, "BodyParam");
  return { entry: r, value: jp(s), localized: !1, localizedFailure: i };
}

async function IR(n, e) {
  const t = await pZ(n, e),
    i = j0(t.value.body, "addModelFolder")?.trim() ? void 0 : await xZ(n, e),
    r = SZ(t, i);
  return {
    logicalModelPath: e,
    parameter: t,
    providerDirectories: r,
    find: (s) => kR(n, t.entry, r, s),
  };
}

async function t3(n, e, t) {
  if (t !== "legacyPractice" && t !== "legacyPracticeBlackline")
    return IR(n, e);
  const i = n.get(e);
  if (!i?.containerId) throw new Error(`${e} 缺少 legacy practice 模型容器。`);
  const r = Aw(i.canonicalPath ?? i.virtualPath),
    s = r.lastIndexOf("/"),
    o = s < 0 ? "" : r.slice(0, s),
    c = {
      entry: i,
      value: jp({
        root: { name: "BodyParam", attributes: [], children: [], text: "" },
        sourceBytes: new Uint8Array(),
      }),
      localized: !1,
    };
  return {
    logicalModelPath: e,
    parameter: c,
    providerDirectories: [o],
    find: (l) => kR(n, i, [o], l),
  };
}

async function vw(n, e, t, i, r, s, o) {
  const a = e.find([`${t}.png`]);
  if (!a)
    throw new Error(
      `${e.logicalModelPath} 缺少 t1ImageName texture ${t}.png。`,
    );
  const c = e.find(["0.png"]);
  if (!c) throw new Error(`${e.logicalModelPath} 的 ReKart 合成缺少 0.png。`);
  const l = e.find(["2.png"]),
    u = i || o?.itemId || 0,
    [h, d, f, p, v] = await Promise.all([
      c.bytes().then(p2),
      a.bytes().then(p2),
      l ? l.bytes().then(p2) : void 0,
      u ? sZ(n, u, o?.initial ?? "") : oZ(n),
      l ? void 0 : mZ(n),
    ]);
  (kM(`${t}.png`, d, h), f && kM("2.png", f, h));
  const w = f
      ? LM(j0(e.parameter.value.body, "secondColor"), "secondColor")
      : 0,
    g = f
      ? LM(j0(e.parameter.value.body, "secondHighColor"), "secondHighColor")
      : 0,
    y = f
      ? gZ(h.pixels, d.pixels, f.pixels, r, s, w, g)
      : K6(h.pixels, d.pixels, r, s);
  return (
    wZ(y, h.width, h.height, p, v, r),
    { width: h.width, height: h.height, pixels: y }
  );
}

function gZ(n, e, t, i, r, s, o) {
  if (n.length !== e.length || n.length !== t.length || n.length % 4 !== 0)
    throw new Error("kart 0/1/2 RGBA8 长度不匹配。");
  const a = Ms(i),
    c = Ms(r),
    l = Ms(s),
    u = Ms(o),
    h = new Uint8Array(n.length);
  for (let d = 0; d < n.length; d += 4) {
    if (ql(e, d, 255, 0, 255, 255)) continue;
    const f = ql(e, d, 0, 255, 255, 255),
      p = AZ(n, d, f ? l : a, f ? u : c);
    bZ(h, d, p, f ? t : e);
  }
  return h;
}

async function mZ(n) {
  const e = "kart_/common/number.png",
    t = n.exactCanonicalCandidates(e);
  if (t.length !== 1) throw new Error(`${e} source 不唯一或缺失。`);
  const i = await p2(await t[0].bytes());
  if (i.width !== 100 || i.height !== 17)
    throw new Error("车辆号码图集不是 100x17。");
  const r = new Uint8Array(680);
  for (let s = 0; s < 17; s += 1)
    r.set(i.pixels.subarray(s * 100 * 4, (s * 100 + 10) * 4), s * 10 * 4);
  return { width: 10, height: 17, pixels: r };
}

function wZ(n, e, t, i, r, s = 0) {
  const o = Ms(s);
  for (let a = 0; a < n.length; a += 4)
    ql(n, a, 0, 0, 255, 255)
      ? yZ(n, e, t, a, i)
      : r && ql(n, a, 0, 255, 255, 255) && vZ(n, e, a, r, o);
}

function vZ(n, e, t, i, r) {
  const s = t - (8 * e + 5) * 4;
  if (s < 0 || s + (16 * e + 10) * 4 > n.length)
    throw new Error("车辆号码复制超出纹理缓冲区。");
  n.copyWithin(t, t + 4, t + 8);
  for (let o = 0; o < 170; o += 1) {
    const a = s + (Math.floor(o / 10) * e + (o % 10)) * 4,
      c = i.pixels[o * 4 + 3];
    ((n[a] = (n[a] * (255 - c) + r.r * c) >> 8),
      (n[a + 1] = (n[a + 1] * (255 - c) + r.g * c) >> 8),
      (n[a + 2] = (n[a + 2] * (255 - c) + r.b * c) >> 8),
      (n[a + 3] = 255));
  }
}

function yZ(n, e, t, i, r) {
  if (r.width !== 45 || r.height !== 20)
    throw new Error(`号牌图片必须为 45x20，实际 ${r.width}x${r.height}。`);
  if (i + ((r.height - 1) * e + r.width) * 4 > e * t * 4)
    throw new Error("号牌复制超出车辆纹理缓冲区。");
  for (let s = 0; s < r.height; s += 1) {
    const o = s * r.width * 4,
      a = i + s * e * 4;
    n.set(r.pixels.subarray(o, o + r.width * 4), a);
  }
}

function kM(n, e, t) {
  if (e.width !== t.width || e.height !== t.height)
    throw new Error(
      `kart ${n} ${e.width}x${e.height} 与 0.png ${t.width}x${t.height} 不匹配。`,
    );
}

function LM(n, e) {
  if (n === void 0) return 0;
  const t = n.trim().split(/\s+/).map(Number);
  if (t.length !== 4 || t.some((a) => !Number.isInteger(a) || a < 0 || a > 255))
    throw new Error(`BodyParam ${e}=${n} 不是 A R G B bytes。`);
  const [i, r, s, o] = t;
  return ((i << 24) | (r << 16) | (s << 8) | o) >>> 0;
}

function AZ(n, e, t, i) {
  const r = n[e] > 127 || n[e + 1] > 127 || n[e + 2] > 127;
  return [
    Xi(t.r, r ? i.r : n[e], n[e + 3]),
    Xi(t.g, r ? i.g : n[e + 1], n[e + 3]),
    Xi(t.b, r ? i.b : n[e + 2], n[e + 3]),
  ];
}

function bZ(n, e, t, i) {
  ((n[e] = Xi(t[0], i[e], i[e + 3])),
    (n[e + 1] = Xi(t[1], i[e + 1], i[e + 3])),
    (n[e + 2] = Xi(t[2], i[e + 2], i[e + 3])),
    (n[e + 3] = 255));
}

function Xi(n, e, t) {
  return Math.min(
    255,
    Math.floor((n * (255 - t)) / 255) + Math.floor((e * t) / 255),
  );
}

function Ms(n) {
  return { r: (n >>> 16) & 255, g: (n >>> 8) & 255, b: n & 255 };
}

function ql(n, e, t, i, r, s) {
  return n[e] === t && n[e + 1] === i && n[e + 2] === r && n[e + 3] === s;
}

async function MZ(n, e) {
  const t = `kart_/level/level${e}`,
    i = PM(n, `${t}@cn`);
  if (i)
    try {
      const o = await Go(i, "Dynamics");
      return { entry: i, value: IM(o) };
    } catch (o) {
      if (o instanceof bw) throw o;
    }
  const r = PM(n, t);
  if (!r) throw new Error(`资源库缺少 ${t} 参数。`);
  const s = await Go(r, "Dynamics");
  return { entry: r, value: IM(s) };
}

function yw(n, e) {
  return CZ(e, n.find);
}

function Xp(n, e, t) {
  return n.findSibling(
    e,
    RR.map((i) => `${t}.${i}`),
  );
}

function PM(n, e) {
  for (const t of RR) {
    const i = n.get(`${e}.${t}`);
    if (i) return i;
    const r = `/${e}.${t}`.toLowerCase(),
      s = n.files.find((o) => o.virtualPath.toLowerCase().endsWith(r));
    if (s) return s;
  }
}

async function xZ(n, e) {
  const t = new Set();
  for (const i of ["kr", "tw"]) {
    const r = Xp(n, e, `param@${i}`);
    if (!r) continue;
    const s = await Go(r, "BodyParam"),
      o = j0(s.root, "addModelFolder")?.trim();
    o && t.add(o);
  }
  if (t.size > 1)
    throw new Error(
      `${e} 的区域 addModelFolder 不一致：${[...t].join(", ")}。`,
    );
  return t.values().next().value;
}

function SZ(n, e) {
  const t = Aw(n.entry.canonicalPath ?? n.entry.virtualPath),
    i = t.lastIndexOf("/"),
    r = i < 0 ? "" : t.slice(0, i),
    s = j0(n.value.body, "addModelFolder")?.trim() || e;
  if (!s) return [r];
  if (!/^[A-Za-z0-9_]+$/.test(s))
    throw new Error(`${n.entry.virtualPath} 的 addModelFolder=${s} 尚未闭合。`);
  const o = r.lastIndexOf("/"),
    a = o < 0 ? "" : r.slice(0, o);
  return [r, a ? `${a}/${s}` : s];
}

function kR(n, e, t, i) {
  if (!e.containerId)
    throw new Error(`${e.virtualPath} 缺少车辆逻辑容器来源。`);
  for (const r of t)
    for (const s of i) {
      const o = `${r}/${s}`.toLowerCase(),
        a = n.files.filter(
          (c) =>
            c.containerId === e.containerId &&
            Aw(c.canonicalPath ?? c.virtualPath).toLowerCase() === o,
        );
      if (a.length > 1)
        throw new Error(`${o} 在车辆逻辑容器内有 ${a.length} 份候选。`);
      if (a[0]) return a[0];
    }
}

function CZ(n, e) {
  const t = new Array(7).fill(void 0);
  for (let i = 0; i < 7; i += 1) {
    const r = `f0${i}.1s`,
      s = e([r]) ?? n.get(`kart_/common/${r}`);
    if (!s) break;
    t[i] = s;
  }
  return t;
}

function Aw(n) {
  return n.replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
}

async function Go(n, e) {
  if (n.extension === "bml" || n.extension === "eml")
    throw new Error(
      `${n.virtualPath} 的 ${n.extension.toUpperCase()} 参数编码未在 KARTDATA 中说明，已停止解析。`,
    );
  const t = x1(await n.bytes());
  if (t.root.name !== e)
    throw new bw(`${n.virtualPath} 的根节点应为 ${e}，实际为 ${t.root.name}。`);
  return t;
}

class bw extends Error {}

const EZ = [],
  TZ = new Set(EZ);

function n3(n) {
  return TZ.has(n);
}

function Mw(n) {
  return n3(n)
    ? `车辆 ItemKart ${n} 的比赛数据尚未补全，暂不可选择或进入相关流程。`
    : void 0;
}

function j6(n) {
  const e = Mw(n);
  if (e) throw new Error(e);
}

const Cr = [
  {
    key: "legacyPractice",
    identityClass: "legacy-system-family",
    title: "旧版练习用卡丁车",
    defaultLevel: "l1",
    engineGrade: 0,
    states: [
      {
        level: "rookie",
        resource: "practice0",
        aliases: ["practice0"],
        parameterSource: { status: "school-spec" },
      },
      {
        level: "l3",
        resource: "practice1",
        aliases: ["practice1"],
        parameterSource: { status: "school-spec" },
      },
      {
        level: "l2",
        resource: "practice2",
        aliases: ["practice2"],
        parameterSource: { status: "school-spec" },
      },
      {
        level: "l1",
        resource: "practice3",
        aliases: ["practice3"],
        parameterSource: { status: "school-spec" },
      },
    ],
  },
  {
    key: "legacyPracticeBlackline",
    identityClass: "legacy-system-family",
    title: "旧版黑线练习用卡丁车",
    defaultLevel: "l1",
    engineGrade: 0,
    states: [
      {
        level: "rookie",
        resource: "practiceblack0",
        aliases: ["practiceblack0", "practiceblack1"],
        parameterSource: {
          status: "family-resource",
          resource: "practiceblack0",
          generation: "G3",
        },
      },
      {
        level: "l3",
        resource: "practiceblack2",
        aliases: ["practiceblack2"],
        parameterSource: {
          status: "family-resource",
          resource: "practiceblack0",
          generation: "G3",
        },
      },
      {
        level: "l2",
        resource: "practiceblack3",
        aliases: ["practiceblack3"],
        parameterSource: {
          status: "family-resource",
          resource: "practiceblack0",
          generation: "G3",
        },
      },
      {
        level: "l1",
        resource: "practiceblack4",
        aliases: ["practiceblack4", "practiceblack5"],
        parameterSource: {
          status: "family-resource",
          resource: "practiceblack0",
          generation: "G3",
        },
      },
    ],
  },
];

function _Z(n) {
  const e = n.states.find((t) => t.level === n.defaultLevel);
  if (!e) throw new Error(`${n.key} 缺少默认等级 ${n.defaultLevel}。`);
  return e;
}

function xw(n, e) {
  const t = e.toLowerCase();
  return Cr.find((i) => i.key === n)?.states.find((i) =>
    i.aliases.some((r) => r.toLowerCase() === t),
  );
}

function b4(n, e, t, i) {
  if (n3(e)) return;
  const r = t.replace(/\\/g, "/").toLowerCase(),
    s = n.find(
      (u) =>
        u.itemId === e &&
        (e !== 0 || u.systemKey === i) &&
        u.path.replace(/\\/g, "/").toLowerCase() === r,
    );
  if (s) return s;
  if (e !== 0 || !i) return;
  const o = Cr.find((u) => u.key === i),
    a = /^kart_\/([^/]+)\/model\.1s$/.exec(r),
    c = o && a ? xw(o.key, a[1]) : void 0;
  if (!c || r !== `kart_/${c.resource.toLowerCase()}/model.1s`) return;
  const l = n.find((u) => u.itemId === 0 && u.systemKey === i);
  return l
    ? { ...l, internalId: c.resource, path: `kart_/${c.resource}/model.1s` }
    : void 0;
}

function N3(n) {
  return n.itemId === 0 ? `system:${GZ(n.systemKey)}` : `catalog:3:${n.itemId}`;
}

function GZ(n) {
  const e = n?.trim();
  if (!e) throw new Error("系统车辆缺少稳定身份键。");
  return e;
}

function LR(n, e) {
  return (n.selectionGameTypes ?? [n.gameType]).includes(e);
}

export { $2, $6, $p, AB, AR, Ab, Ao, C9, CB, CR, CX, Co, Cr, Dt, E9, EX, Eo, Fl, Ft, G1, G2, H2, H6, HG, HY, He, Hl, Hn, IR, J5, JG, JH, K6, L6, LB, LR, Lj, MK, MZ, Mo, Mw, N3, N6, NG, NY, Nm, O5, O6, Oe, Ol, P6, PB, PW, Pj, Pp, QG, Qj, Qt, Ri, SB, SR, SX, Sr, T, TR, TW, To, UB, Um, V0, VG, VY, Vj, Vm, W1, W6, WB, WY, We, YW, Yb, ZG, _X, _Z, _o, aX, an, aw, b4, bo, c3, c5, cX, ca, cn, ct, cw, d5, da, dn, dt, e3, e4, ew, f3, f4, f5, fa, g4, gX, ga, gw, hB, hX, ha, ie, j0, j2, j6, jc, jm, kB, l5, lt, lw, m4, m9, ma, mo, n3, nR, nq, oR, oX, on, ow, p2, p3, pX, pZ, pa, qB, qG, qm, qp, rR, rn, rw, s2, sR, sX, sn, st, sw, t3, tR, tt, tw, vR, ve, vw, wK, we, x1, xR, xX, xe, xo, xw, y9, yB, yR, yo, yw, z6, zB, zG, zp };
