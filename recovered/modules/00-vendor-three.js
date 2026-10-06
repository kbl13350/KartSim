(function () {
  const e = document.createElement("link").relList;
  if (e && e.supports && e.supports("modulepreload")) return;
  for (const r of document.querySelectorAll('link[rel="modulepreload"]')) i(r);
  new MutationObserver((r) => {
    for (const s of r)
      if (s.type === "childList")
        for (const o of s.addedNodes)
          o.tagName === "LINK" && o.rel === "modulepreload" && i(o);
  }).observe(document, { childList: !0, subtree: !0 });
  function t(r) {
    const s = {};
    return (
      r.integrity && (s.integrity = r.integrity),
      r.referrerPolicy && (s.referrerPolicy = r.referrerPolicy),
      r.crossOrigin === "use-credentials"
        ? (s.credentials = "include")
        : r.crossOrigin === "anonymous"
          ? (s.credentials = "omit")
          : (s.credentials = "same-origin"),
      s
    );
  }
  function i(r) {
    if (r.ep) return;
    r.ep = !0;
    const s = t(r);
    fetch(r.href, s);
  }
})();
const rV = "modulepreload",
  sV = function (n) {
    return "/" + n;
  },
  jy = {},
  El = function (e, t, i) {
    let r = Promise.resolve();
    if (t && t.length > 0) {
      let c = function (l) {
        return Promise.all(
          l.map((u) =>
            Promise.resolve(u).then(
              (h) => ({ status: "fulfilled", value: h }),
              (h) => ({ status: "rejected", reason: h }),
            ),
          ),
        );
      };
      document.getElementsByTagName("link");
      const o = document.querySelector("meta[property=csp-nonce]"),
        a = o?.nonce || o?.getAttribute("nonce");
      r = c(
        t.map((l) => {
          if (((l = sV(l)), l in jy)) return;
          jy[l] = !0;
          const u = l.endsWith(".css"),
            h = u ? '[rel="stylesheet"]' : "";
          if (document.querySelector(`link[href="${l}"]${h}`)) return;
          const d = document.createElement("link");
          if (
            ((d.rel = u ? "stylesheet" : rV),
            u || (d.as = "script"),
            (d.crossOrigin = ""),
            (d.href = l),
            a && d.setAttribute("nonce", a),
            document.head.appendChild(d),
            u)
          )
            return new Promise((f, p) => {
              (d.addEventListener("load", f),
                d.addEventListener("error", () =>
                  p(new Error(`Unable to preload CSS for ${l}`)),
                ));
            });
        }),
      );
    }
    function s(o) {
      const a = new Event("vite:preloadError", { cancelable: !0 });
      if (((a.payload = o), window.dispatchEvent(a), !a.defaultPrevented))
        throw o;
    }
    return r.then((o) => {
      for (const a of o || []) a.status === "rejected" && s(a.reason);
      return e().catch(s);
    });
  };
function rG(n, e, t, i) {
  return t
    .filter((r) =>
      n === "team"
        ? e.find((s) => s.playerId === r.playerId)?.team === i
        : r.rank <= 3 && r.elapsedMs !== null,
    )
    .map((r) => r.playerId);
}
const l2 = {
  SteerLeft: 0,
  SteerRight: 1,
  Forward: 2,
  Reverse: 3,
  Drift: 4,
  UseItemOrBooster: 5,
  ReorderItems: 6,
  SecondaryItem: 7,
  GaugeState: 8,
  DisplayMode: 9,
  Help: 10,
  Reset: 11,
  ModeImpulsePositive: 25,
  ModeImpulseNegative: 26,
};
class sG {
  leftHeld = !1;
  rightHeld = !1;
  rawDriftHeld = !1;
  derivedDriftHeld = !1;
  driftStartedThisHold = !1;
  forwardSource = 0;
  reverseSource = 0;
  rawSteer = 0;
  swapForwardReverse = !1;
  invertSteering = !1;
  actionMarkerWord = 0;
  forwardBatchGate = !1;
  forwardBatchDown = !1;
  driftPressCount = 0;
  driftReleaseMarker = !1;
  snapshotView = {
    forward: 0,
    reverse: 0,
    steer: 0,
    rawSteer: 0,
    steeringInverted: !1,
    rawDriftHeld: !1,
    derivedDriftHeld: !1,
    actionMarkerWord: 0,
  };
  dispatch(e, t = () => {}) {
    let i = 0;
    for (const r of e) {
      if (
        ((i += 1),
        r.action === l2.Forward &&
          ((this.forwardBatchDown = r.down), this.forwardBatchGate))
      ) {
        r.down ? (this.forwardBatchGate = !1) : (this.forwardBatchDown = !0);
        break;
      }
      this.dispatchOne(r, t);
    }
    return i;
  }
  cancel() {
    ((this.leftHeld = !1),
      (this.rightHeld = !1),
      (this.rawDriftHeld = !1),
      (this.derivedDriftHeld = !1),
      (this.driftStartedThisHold = !1),
      (this.forwardSource = 0),
      (this.reverseSource = 0),
      (this.actionMarkerWord = Nt(this.actionMarkerWord, 1, 2, !1)),
      (this.actionMarkerWord = Nt(this.actionMarkerWord, 4, 8, !1)),
      this.setRawSteer(0));
  }
  snapshot() {
    const e = this.snapshotView;
    return (
      (e.forward = this.swapForwardReverse
        ? this.reverseSource
        : this.forwardSource),
      (e.reverse = this.swapForwardReverse
        ? this.forwardSource
        : this.reverseSource),
      (e.steer = this.rawSteer * (this.invertSteering ? -1 : 1)),
      (e.rawSteer = this.rawSteer),
      (e.steeringInverted = this.invertSteering),
      (e.rawDriftHeld = this.rawDriftHeld),
      (e.derivedDriftHeld = this.derivedDriftHeld),
      (e.actionMarkerWord = this.actionMarkerWord),
      e
    );
  }
  setForwardReverseSwap(e) {
    this.swapForwardReverse = e;
  }
  setSteeringInverted(e) {
    this.invertSteering = e;
  }
  setForwardBatchGate(e) {
    this.forwardBatchGate = e;
  }
  getForwardBatchState() {
    return { gate: this.forwardBatchGate, down: this.forwardBatchDown };
  }
  getDriftEdgeMetadata() {
    return {
      pressCount: this.driftPressCount,
      released: this.driftReleaseMarker,
    };
  }
  dispatchOne(e, t) {
    switch (e.action) {
      case l2.SteerLeft:
        (e.down
          ? (this.setRawSteer(1), (this.leftHeld = !0))
          : ((this.leftHeld = !1), this.setRawSteer(this.rightHeld ? -1 : 0)),
          this.updateDriftChord(e.down, t, e));
        return;
      case l2.SteerRight:
        (e.down
          ? (this.setRawSteer(-1), (this.rightHeld = !0))
          : ((this.rightHeld = !1), this.setRawSteer(this.leftHeld ? 1 : 0)),
          this.updateDriftChord(e.down, t, e));
        return;
      case l2.Forward:
        ((this.forwardSource = e.down ? 1 : 0),
          (this.actionMarkerWord = Nt(this.actionMarkerWord, 1, 2, e.down)),
          t({ kind: e.down ? "forward-down" : "forward-up" }, e));
        return;
      case l2.Reverse:
        ((this.reverseSource = e.down ? 1 : 0),
          (this.actionMarkerWord = Nt(this.actionMarkerWord, 4, 8, e.down)),
          t({ kind: e.down ? "reverse-down" : "reverse-up" }, e));
        return;
      case l2.Drift:
        ((this.rawDriftHeld = e.down),
          e.down
            ? ((this.driftPressCount = (this.driftPressCount + 1) & 65535),
              (this.driftReleaseMarker = !1))
            : ((this.driftReleaseMarker = !0),
              (this.driftStartedThisHold = !1)),
          this.updateDriftChord(e.down, t, e));
        return;
      case l2.UseItemOrBooster:
        e.down && t({ kind: "use-item-or-booster" }, e);
        return;
      case l2.ReorderItems:
        e.down && t({ kind: "reorder-items" }, e);
        return;
      case l2.Reset:
        e.down && t({ kind: "reset" }, e);
        return;
      case l2.GaugeState:
        e.down && t({ kind: "instant-acceleration" }, e);
        return;
      default:
        t({ kind: "unsupported-action", action: e.action, down: e.down }, e);
    }
  }
  updateDriftChord(e, t, i) {
    if (e) {
      if (
        !this.rawDriftHeld ||
        this.rawSteer === 0 ||
        this.driftStartedThisHold
      )
        return;
      ((this.driftStartedThisHold = !0),
        (this.derivedDriftHeld = !0),
        t({ kind: "drift-start", direction: this.rawSteer > 0 ? 1 : -1 }, i));
      return;
    }
    ((this.derivedDriftHeld = this.rawDriftHeld),
      t({ kind: "drift-stop", active: this.rawDriftHeld }, i));
  }
  setRawSteer(e) {
    ((this.rawSteer = e),
      e > 0
        ? ((this.actionMarkerWord = Nt(this.actionMarkerWord, 16, 32, !0)),
          (this.actionMarkerWord = Nt(this.actionMarkerWord, 64, 128, !1)))
        : e < 0
          ? ((this.actionMarkerWord = Nt(this.actionMarkerWord, 64, 128, !0)),
            (this.actionMarkerWord = Nt(this.actionMarkerWord, 16, 32, !1)))
          : ((this.actionMarkerWord = Nt(this.actionMarkerWord, 16, 32, !1)),
            (this.actionMarkerWord = Nt(this.actionMarkerWord, 64, 128, !1))));
  }
}
function Nt(n, e, t, i) {
  return i ? (n & ~t) | e : (n & ~e) | t;
}
const vm = "178",
  oV = 0,
  Xy = 1,
  aV = 2,
  oG = 1,
  cV = 2,
  B5 = 3,
  tn = 0,
  me = 1,
  s1 = 2,
  n5 = 0,
  X5 = 1,
  Yy = 2,
  Zy = 3,
  Qy = 4,
  u1 = 5,
  R9 = 100,
  lV = 101,
  uV = 102,
  hV = 103,
  dV = 104,
  ym = 200,
  h3 = 201,
  ra = 202,
  Am = 203,
  l1 = 204,
  v1 = 205,
  bm = 206,
  Mm = 207,
  xm = 208,
  Sm = 209,
  Cm = 210,
  fV = 211,
  pV = 212,
  gV = 213,
  mV = 214,
  ro = 0,
  ir = 1,
  so = 2,
  y1 = 3,
  oo = 4,
  rr = 5,
  ao = 6,
  co = 7,
  aG = 0,
  wV = 1,
  vV = 2,
  Jn = 0,
  yV = 1,
  AV = 2,
  bV = 3,
  MV = 4,
  xV = 5,
  SV = 6,
  CV = 7,
  cG = 300,
  sr = 301,
  or = 302,
  Xf = 303,
  Yf = 304,
  I6 = 306,
  S1 = 1e3,
  F1 = 1001,
  Tl = 1002,
  h9 = 1003,
  lG = 1004,
  ys = 1005,
  u9 = 1006,
  Nc = 1007,
  e5 = 1008,
  _9 = 1009,
  uG = 1010,
  hG = 1011,
  lo = 1012,
  Em = 1013,
  A4 = 1014,
  $5 = 1015,
  sa = 1016,
  Tm = 1017,
  _m = 1018,
  uo = 1020,
  dG = 35902,
  fG = 1021,
  pG = 1022,
  e9 = 1023,
  ho = 1026,
  fo = 1027,
  gG = 1028,
  Gm = 1029,
  mG = 1030,
  Bm = 1031,
  Rm = 1033,
  u4 = 33776,
  $i = 33777,
  Wi = 33778,
  Hi = 33779,
  Zf = 35840,
  Qf = 35841,
  Jf = 35842,
  ep = 35843,
  _l = 36196,
  tp = 37492,
  np = 37496,
  ip = 37808,
  rp = 37809,
  sp = 37810,
  op = 37811,
  ap = 37812,
  cp = 37813,
  lp = 37814,
  up = 37815,
  hp = 37816,
  dp = 37817,
  fp = 37818,
  pp = 37819,
  gp = 37820,
  mp = 37821,
  Oc = 36492,
  Gl = 36494,
  Bl = 36495,
  wG = 36283,
  wp = 36284,
  vp = 36285,
  yp = 36286,
  EV = 3200,
  TV = 3201,
  _V = 0,
  GV = 1,
  v9 = "",
  Fe = "srgb",
  qe = "srgb-linear",
  Rl = "linear",
  B9 = "srgb",
  N4 = 7680,
  Jy = 519,
  BV = 512,
  RV = 513,
  IV = 514,
  vG = 515,
  kV = 516,
  LV = 517,
  PV = 518,
  FV = 519,
  Ap = 35044,
  r1 = 35048,
  eA = "300 es",
  W5 = 2e3,
  Il = 2001;
class vr {
  addEventListener(e, t) {
    this._listeners === void 0 && (this._listeners = {});
    const i = this._listeners;
    (i[e] === void 0 && (i[e] = []), i[e].indexOf(t) === -1 && i[e].push(t));
  }
  hasEventListener(e, t) {
    const i = this._listeners;
    return i === void 0 ? !1 : i[e] !== void 0 && i[e].indexOf(t) !== -1;
  }
  removeEventListener(e, t) {
    const i = this._listeners;
    if (i === void 0) return;
    const r = i[e];
    if (r !== void 0) {
      const s = r.indexOf(t);
      s !== -1 && r.splice(s, 1);
    }
  }
  dispatchEvent(e) {
    const t = this._listeners;
    if (t === void 0) return;
    const i = t[e.type];
    if (i !== void 0) {
      e.target = this;
      const r = i.slice(0);
      for (let s = 0, o = r.length; s < o; s++) r[s].call(this, e);
      e.target = null;
    }
  }
}
const H1 = [
  "00",
  "01",
  "02",
  "03",
  "04",
  "05",
  "06",
  "07",
  "08",
  "09",
  "0a",
  "0b",
  "0c",
  "0d",
  "0e",
  "0f",
  "10",
  "11",
  "12",
  "13",
  "14",
  "15",
  "16",
  "17",
  "18",
  "19",
  "1a",
  "1b",
  "1c",
  "1d",
  "1e",
  "1f",
  "20",
  "21",
  "22",
  "23",
  "24",
  "25",
  "26",
  "27",
  "28",
  "29",
  "2a",
  "2b",
  "2c",
  "2d",
  "2e",
  "2f",
  "30",
  "31",
  "32",
  "33",
  "34",
  "35",
  "36",
  "37",
  "38",
  "39",
  "3a",
  "3b",
  "3c",
  "3d",
  "3e",
  "3f",
  "40",
  "41",
  "42",
  "43",
  "44",
  "45",
  "46",
  "47",
  "48",
  "49",
  "4a",
  "4b",
  "4c",
  "4d",
  "4e",
  "4f",
  "50",
  "51",
  "52",
  "53",
  "54",
  "55",
  "56",
  "57",
  "58",
  "59",
  "5a",
  "5b",
  "5c",
  "5d",
  "5e",
  "5f",
  "60",
  "61",
  "62",
  "63",
  "64",
  "65",
  "66",
  "67",
  "68",
  "69",
  "6a",
  "6b",
  "6c",
  "6d",
  "6e",
  "6f",
  "70",
  "71",
  "72",
  "73",
  "74",
  "75",
  "76",
  "77",
  "78",
  "79",
  "7a",
  "7b",
  "7c",
  "7d",
  "7e",
  "7f",
  "80",
  "81",
  "82",
  "83",
  "84",
  "85",
  "86",
  "87",
  "88",
  "89",
  "8a",
  "8b",
  "8c",
  "8d",
  "8e",
  "8f",
  "90",
  "91",
  "92",
  "93",
  "94",
  "95",
  "96",
  "97",
  "98",
  "99",
  "9a",
  "9b",
  "9c",
  "9d",
  "9e",
  "9f",
  "a0",
  "a1",
  "a2",
  "a3",
  "a4",
  "a5",
  "a6",
  "a7",
  "a8",
  "a9",
  "aa",
  "ab",
  "ac",
  "ad",
  "ae",
  "af",
  "b0",
  "b1",
  "b2",
  "b3",
  "b4",
  "b5",
  "b6",
  "b7",
  "b8",
  "b9",
  "ba",
  "bb",
  "bc",
  "bd",
  "be",
  "bf",
  "c0",
  "c1",
  "c2",
  "c3",
  "c4",
  "c5",
  "c6",
  "c7",
  "c8",
  "c9",
  "ca",
  "cb",
  "cc",
  "cd",
  "ce",
  "cf",
  "d0",
  "d1",
  "d2",
  "d3",
  "d4",
  "d5",
  "d6",
  "d7",
  "d8",
  "d9",
  "da",
  "db",
  "dc",
  "dd",
  "de",
  "df",
  "e0",
  "e1",
  "e2",
  "e3",
  "e4",
  "e5",
  "e6",
  "e7",
  "e8",
  "e9",
  "ea",
  "eb",
  "ec",
  "ed",
  "ee",
  "ef",
  "f0",
  "f1",
  "f2",
  "f3",
  "f4",
  "f5",
  "f6",
  "f7",
  "f8",
  "f9",
  "fa",
  "fb",
  "fc",
  "fd",
  "fe",
  "ff",
];
let tA = 1234567;
const Rs = Math.PI / 180,
  po = 180 / Math.PI;
function Y5() {
  const n = (Math.random() * 4294967295) | 0,
    e = (Math.random() * 4294967295) | 0,
    t = (Math.random() * 4294967295) | 0,
    i = (Math.random() * 4294967295) | 0;
  return (
    H1[n & 255] +
    H1[(n >> 8) & 255] +
    H1[(n >> 16) & 255] +
    H1[(n >> 24) & 255] +
    "-" +
    H1[e & 255] +
    H1[(e >> 8) & 255] +
    "-" +
    H1[((e >> 16) & 15) | 64] +
    H1[(e >> 24) & 255] +
    "-" +
    H1[(t & 63) | 128] +
    H1[(t >> 8) & 255] +
    "-" +
    H1[(t >> 16) & 255] +
    H1[(t >> 24) & 255] +
    H1[i & 255] +
    H1[(i >> 8) & 255] +
    H1[(i >> 16) & 255] +
    H1[(i >> 24) & 255]
  ).toLowerCase();
}
function J2(n, e, t) {
  return Math.max(e, Math.min(t, n));
}
function Im(n, e) {
  return ((n % e) + e) % e;
}
function DV(n, e, t, i, r) {
  return i + ((n - e) * (r - i)) / (t - e);
}
function VV(n, e, t) {
  return n !== e ? (t - n) / (e - n) : 0;
}
function Is(n, e, t) {
  return (1 - t) * n + t * e;
}
function NV(n, e, t, i) {
  return Is(n, e, 1 - Math.exp(-t * i));
}
function OV(n, e = 1) {
  return e - Math.abs(Im(n, e * 2) - e);
}
function zV(n, e, t) {
  return n <= e
    ? 0
    : n >= t
      ? 1
      : ((n = (n - e) / (t - e)), n * n * (3 - 2 * n));
}
function UV(n, e, t) {
  return n <= e
    ? 0
    : n >= t
      ? 1
      : ((n = (n - e) / (t - e)), n * n * n * (n * (n * 6 - 15) + 10));
}
function $V(n, e) {
  return n + Math.floor(Math.random() * (e - n + 1));
}
function WV(n, e) {
  return n + Math.random() * (e - n);
}
function HV(n) {
  return n * (0.5 - Math.random());
}
function qV(n) {
  n !== void 0 && (tA = n);
  let e = (tA += 1831565813);
  return (
    (e = Math.imul(e ^ (e >>> 15), e | 1)),
    (e ^= e + Math.imul(e ^ (e >>> 7), e | 61)),
    ((e ^ (e >>> 14)) >>> 0) / 4294967296
  );
}
function KV(n) {
  return n * Rs;
}
function jV(n) {
  return n * po;
}
function XV(n) {
  return (n & (n - 1)) === 0 && n !== 0;
}
function YV(n) {
  return Math.pow(2, Math.ceil(Math.log(n) / Math.LN2));
}
function ZV(n) {
  return Math.pow(2, Math.floor(Math.log(n) / Math.LN2));
}
function QV(n, e, t, i, r) {
  const s = Math.cos,
    o = Math.sin,
    a = s(t / 2),
    c = o(t / 2),
    l = s((e + i) / 2),
    u = o((e + i) / 2),
    h = s((e - i) / 2),
    d = o((e - i) / 2),
    f = s((i - e) / 2),
    p = o((i - e) / 2);
  switch (r) {
    case "XYX":
      n.set(a * u, c * h, c * d, a * l);
      break;
    case "YZY":
      n.set(c * d, a * u, c * h, a * l);
      break;
    case "ZXZ":
      n.set(c * h, c * d, a * u, a * l);
      break;
    case "XZX":
      n.set(a * u, c * p, c * f, a * l);
      break;
    case "YXY":
      n.set(c * f, a * u, c * p, a * l);
      break;
    case "ZYZ":
      n.set(c * p, c * f, a * u, a * l);
      break;
    default:
      console.warn(
        "THREE.MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: " +
          r,
      );
  }
}
function Gt(n, e) {
  switch (e.constructor) {
    case Float32Array:
      return n;
    case Uint32Array:
      return n / 4294967295;
    case Uint16Array:
      return n / 65535;
    case Uint8Array:
      return n / 255;
    case Int32Array:
      return Math.max(n / 2147483647, -1);
    case Int16Array:
      return Math.max(n / 32767, -1);
    case Int8Array:
      return Math.max(n / 127, -1);
    default:
      throw new Error("Invalid component type.");
  }
}
function x9(n, e) {
  switch (e.constructor) {
    case Float32Array:
      return n;
    case Uint32Array:
      return Math.round(n * 4294967295);
    case Uint16Array:
      return Math.round(n * 65535);
    case Uint8Array:
      return Math.round(n * 255);
    case Int32Array:
      return Math.round(n * 2147483647);
    case Int16Array:
      return Math.round(n * 32767);
    case Int8Array:
      return Math.round(n * 127);
    default:
      throw new Error("Invalid component type.");
  }
}
const kl = {
  DEG2RAD: Rs,
  RAD2DEG: po,
  generateUUID: Y5,
  clamp: J2,
  euclideanModulo: Im,
  mapLinear: DV,
  inverseLerp: VV,
  lerp: Is,
  damp: NV,
  pingpong: OV,
  smoothstep: zV,
  smootherstep: UV,
  randInt: $V,
  randFloat: WV,
  randFloatSpread: HV,
  seededRandom: qV,
  degToRad: KV,
  radToDeg: jV,
  isPowerOfTwo: XV,
  ceilPowerOfTwo: YV,
  floorPowerOfTwo: ZV,
  setQuaternionFromProperEuler: QV,
  normalize: x9,
  denormalize: Gt,
};
class B2 {
  constructor(e = 0, t = 0) {
    ((B2.prototype.isVector2 = !0), (this.x = e), (this.y = t));
  }
  get width() {
    return this.x;
  }
  set width(e) {
    this.x = e;
  }
  get height() {
    return this.y;
  }
  set height(e) {
    this.y = e;
  }
  set(e, t) {
    return ((this.x = e), (this.y = t), this);
  }
  setScalar(e) {
    return ((this.x = e), (this.y = e), this);
  }
  setX(e) {
    return ((this.x = e), this);
  }
  setY(e) {
    return ((this.y = e), this);
  }
  setComponent(e, t) {
    switch (e) {
      case 0:
        this.x = t;
        break;
      case 1:
        this.y = t;
        break;
      default:
        throw new Error("index is out of range: " + e);
    }
    return this;
  }
  getComponent(e) {
    switch (e) {
      case 0:
        return this.x;
      case 1:
        return this.y;
      default:
        throw new Error("index is out of range: " + e);
    }
  }
  clone() {
    return new this.constructor(this.x, this.y);
  }
  copy(e) {
    return ((this.x = e.x), (this.y = e.y), this);
  }
  add(e) {
    return ((this.x += e.x), (this.y += e.y), this);
  }
  addScalar(e) {
    return ((this.x += e), (this.y += e), this);
  }
  addVectors(e, t) {
    return ((this.x = e.x + t.x), (this.y = e.y + t.y), this);
  }
  addScaledVector(e, t) {
    return ((this.x += e.x * t), (this.y += e.y * t), this);
  }
  sub(e) {
    return ((this.x -= e.x), (this.y -= e.y), this);
  }
  subScalar(e) {
    return ((this.x -= e), (this.y -= e), this);
  }
  subVectors(e, t) {
    return ((this.x = e.x - t.x), (this.y = e.y - t.y), this);
  }
  multiply(e) {
    return ((this.x *= e.x), (this.y *= e.y), this);
  }
  multiplyScalar(e) {
    return ((this.x *= e), (this.y *= e), this);
  }
  divide(e) {
    return ((this.x /= e.x), (this.y /= e.y), this);
  }
  divideScalar(e) {
    return this.multiplyScalar(1 / e);
  }
  applyMatrix3(e) {
    const t = this.x,
      i = this.y,
      r = e.elements;
    return (
      (this.x = r[0] * t + r[3] * i + r[6]),
      (this.y = r[1] * t + r[4] * i + r[7]),
      this
    );
  }
  min(e) {
    return (
      (this.x = Math.min(this.x, e.x)),
      (this.y = Math.min(this.y, e.y)),
      this
    );
  }
  max(e) {
    return (
      (this.x = Math.max(this.x, e.x)),
      (this.y = Math.max(this.y, e.y)),
      this
    );
  }
  clamp(e, t) {
    return (
      (this.x = J2(this.x, e.x, t.x)),
      (this.y = J2(this.y, e.y, t.y)),
      this
    );
  }
  clampScalar(e, t) {
    return ((this.x = J2(this.x, e, t)), (this.y = J2(this.y, e, t)), this);
  }
  clampLength(e, t) {
    const i = this.length();
    return this.divideScalar(i || 1).multiplyScalar(J2(i, e, t));
  }
  floor() {
    return ((this.x = Math.floor(this.x)), (this.y = Math.floor(this.y)), this);
  }
  ceil() {
    return ((this.x = Math.ceil(this.x)), (this.y = Math.ceil(this.y)), this);
  }
  round() {
    return ((this.x = Math.round(this.x)), (this.y = Math.round(this.y)), this);
  }
  roundToZero() {
    return ((this.x = Math.trunc(this.x)), (this.y = Math.trunc(this.y)), this);
  }
  negate() {
    return ((this.x = -this.x), (this.y = -this.y), this);
  }
  dot(e) {
    return this.x * e.x + this.y * e.y;
  }
  cross(e) {
    return this.x * e.y - this.y * e.x;
  }
  lengthSq() {
    return this.x * this.x + this.y * this.y;
  }
  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }
  manhattanLength() {
    return Math.abs(this.x) + Math.abs(this.y);
  }
  normalize() {
    return this.divideScalar(this.length() || 1);
  }
  angle() {
    return Math.atan2(-this.y, -this.x) + Math.PI;
  }
  angleTo(e) {
    const t = Math.sqrt(this.lengthSq() * e.lengthSq());
    if (t === 0) return Math.PI / 2;
    const i = this.dot(e) / t;
    return Math.acos(J2(i, -1, 1));
  }
  distanceTo(e) {
    return Math.sqrt(this.distanceToSquared(e));
  }
  distanceToSquared(e) {
    const t = this.x - e.x,
      i = this.y - e.y;
    return t * t + i * i;
  }
  manhattanDistanceTo(e) {
    return Math.abs(this.x - e.x) + Math.abs(this.y - e.y);
  }
  setLength(e) {
    return this.normalize().multiplyScalar(e);
  }
  lerp(e, t) {
    return (
      (this.x += (e.x - this.x) * t),
      (this.y += (e.y - this.y) * t),
      this
    );
  }
  lerpVectors(e, t, i) {
    return (
      (this.x = e.x + (t.x - e.x) * i),
      (this.y = e.y + (t.y - e.y) * i),
      this
    );
  }
  equals(e) {
    return e.x === this.x && e.y === this.y;
  }
  fromArray(e, t = 0) {
    return ((this.x = e[t]), (this.y = e[t + 1]), this);
  }
  toArray(e = [], t = 0) {
    return ((e[t] = this.x), (e[t + 1] = this.y), e);
  }
  fromBufferAttribute(e, t) {
    return ((this.x = e.getX(t)), (this.y = e.getY(t)), this);
  }
  rotateAround(e, t) {
    const i = Math.cos(t),
      r = Math.sin(t),
      s = this.x - e.x,
      o = this.y - e.y;
    return (
      (this.x = s * i - o * r + e.x),
      (this.y = s * r + o * i + e.y),
      this
    );
  }
  random() {
    return ((this.x = Math.random()), (this.y = Math.random()), this);
  }
  *[Symbol.iterator]() {
    (yield this.x, yield this.y);
  }
}
class s5 {
  constructor(e = 0, t = 0, i = 0, r = 1) {
    ((this.isQuaternion = !0),
      (this._x = e),
      (this._y = t),
      (this._z = i),
      (this._w = r));
  }
  static slerpFlat(e, t, i, r, s, o, a) {
    let c = i[r + 0],
      l = i[r + 1],
      u = i[r + 2],
      h = i[r + 3];
    const d = s[o + 0],
      f = s[o + 1],
      p = s[o + 2],
      v = s[o + 3];
    if (a === 0) {
      ((e[t + 0] = c), (e[t + 1] = l), (e[t + 2] = u), (e[t + 3] = h));
      return;
    }
    if (a === 1) {
      ((e[t + 0] = d), (e[t + 1] = f), (e[t + 2] = p), (e[t + 3] = v));
      return;
    }
    if (h !== v || c !== d || l !== f || u !== p) {
      let w = 1 - a;
      const g = c * d + l * f + u * p + h * v,
        y = g >= 0 ? 1 : -1,
        b = 1 - g * g;
      if (b > Number.EPSILON) {
        const x = Math.sqrt(b),
          M = Math.atan2(x, g * y);
        ((w = Math.sin(w * M) / x), (a = Math.sin(a * M) / x));
      }
      const A = a * y;
      if (
        ((c = c * w + d * A),
        (l = l * w + f * A),
        (u = u * w + p * A),
        (h = h * w + v * A),
        w === 1 - a)
      ) {
        const x = 1 / Math.sqrt(c * c + l * l + u * u + h * h);
        ((c *= x), (l *= x), (u *= x), (h *= x));
      }
    }
    ((e[t] = c), (e[t + 1] = l), (e[t + 2] = u), (e[t + 3] = h));
  }
  static multiplyQuaternionsFlat(e, t, i, r, s, o) {
    const a = i[r],
      c = i[r + 1],
      l = i[r + 2],
      u = i[r + 3],
      h = s[o],
      d = s[o + 1],
      f = s[o + 2],
      p = s[o + 3];
    return (
      (e[t] = a * p + u * h + c * f - l * d),
      (e[t + 1] = c * p + u * d + l * h - a * f),
      (e[t + 2] = l * p + u * f + a * d - c * h),
      (e[t + 3] = u * p - a * h - c * d - l * f),
      e
    );
  }
  get x() {
    return this._x;
  }
  set x(e) {
    ((this._x = e), this._onChangeCallback());
  }
  get y() {
    return this._y;
  }
  set y(e) {
    ((this._y = e), this._onChangeCallback());
  }
  get z() {
    return this._z;
  }
  set z(e) {
    ((this._z = e), this._onChangeCallback());
  }
  get w() {
    return this._w;
  }
  set w(e) {
    ((this._w = e), this._onChangeCallback());
  }
  set(e, t, i, r) {
    return (
      (this._x = e),
      (this._y = t),
      (this._z = i),
      (this._w = r),
      this._onChangeCallback(),
      this
    );
  }
  clone() {
    return new this.constructor(this._x, this._y, this._z, this._w);
  }
  copy(e) {
    return (
      (this._x = e.x),
      (this._y = e.y),
      (this._z = e.z),
      (this._w = e.w),
      this._onChangeCallback(),
      this
    );
  }
  setFromEuler(e, t = !0) {
    const i = e._x,
      r = e._y,
      s = e._z,
      o = e._order,
      a = Math.cos,
      c = Math.sin,
      l = a(i / 2),
      u = a(r / 2),
      h = a(s / 2),
      d = c(i / 2),
      f = c(r / 2),
      p = c(s / 2);
    switch (o) {
      case "XYZ":
        ((this._x = d * u * h + l * f * p),
          (this._y = l * f * h - d * u * p),
          (this._z = l * u * p + d * f * h),
          (this._w = l * u * h - d * f * p));
        break;
      case "YXZ":
        ((this._x = d * u * h + l * f * p),
          (this._y = l * f * h - d * u * p),
          (this._z = l * u * p - d * f * h),
          (this._w = l * u * h + d * f * p));
        break;
      case "ZXY":
        ((this._x = d * u * h - l * f * p),
          (this._y = l * f * h + d * u * p),
          (this._z = l * u * p + d * f * h),
          (this._w = l * u * h - d * f * p));
        break;
      case "ZYX":
        ((this._x = d * u * h - l * f * p),
          (this._y = l * f * h + d * u * p),
          (this._z = l * u * p - d * f * h),
          (this._w = l * u * h + d * f * p));
        break;
      case "YZX":
        ((this._x = d * u * h + l * f * p),
          (this._y = l * f * h + d * u * p),
          (this._z = l * u * p - d * f * h),
          (this._w = l * u * h - d * f * p));
        break;
      case "XZY":
        ((this._x = d * u * h - l * f * p),
          (this._y = l * f * h - d * u * p),
          (this._z = l * u * p + d * f * h),
          (this._w = l * u * h + d * f * p));
        break;
      default:
        console.warn(
          "THREE.Quaternion: .setFromEuler() encountered an unknown order: " +
            o,
        );
    }
    return (t === !0 && this._onChangeCallback(), this);
  }
  setFromAxisAngle(e, t) {
    const i = t / 2,
      r = Math.sin(i);
    return (
      (this._x = e.x * r),
      (this._y = e.y * r),
      (this._z = e.z * r),
      (this._w = Math.cos(i)),
      this._onChangeCallback(),
      this
    );
  }
  setFromRotationMatrix(e) {
    const t = e.elements,
      i = t[0],
      r = t[4],
      s = t[8],
      o = t[1],
      a = t[5],
      c = t[9],
      l = t[2],
      u = t[6],
      h = t[10],
      d = i + a + h;
    if (d > 0) {
      const f = 0.5 / Math.sqrt(d + 1);
      ((this._w = 0.25 / f),
        (this._x = (u - c) * f),
        (this._y = (s - l) * f),
        (this._z = (o - r) * f));
    } else if (i > a && i > h) {
      const f = 2 * Math.sqrt(1 + i - a - h);
      ((this._w = (u - c) / f),
        (this._x = 0.25 * f),
        (this._y = (r + o) / f),
        (this._z = (s + l) / f));
    } else if (a > h) {
      const f = 2 * Math.sqrt(1 + a - i - h);
      ((this._w = (s - l) / f),
        (this._x = (r + o) / f),
        (this._y = 0.25 * f),
        (this._z = (c + u) / f));
    } else {
      const f = 2 * Math.sqrt(1 + h - i - a);
      ((this._w = (o - r) / f),
        (this._x = (s + l) / f),
        (this._y = (c + u) / f),
        (this._z = 0.25 * f));
    }
    return (this._onChangeCallback(), this);
  }
  setFromUnitVectors(e, t) {
    let i = e.dot(t) + 1;
    return (
      i < 1e-8
        ? ((i = 0),
          Math.abs(e.x) > Math.abs(e.z)
            ? ((this._x = -e.y), (this._y = e.x), (this._z = 0), (this._w = i))
            : ((this._x = 0), (this._y = -e.z), (this._z = e.y), (this._w = i)))
        : ((this._x = e.y * t.z - e.z * t.y),
          (this._y = e.z * t.x - e.x * t.z),
          (this._z = e.x * t.y - e.y * t.x),
          (this._w = i)),
      this.normalize()
    );
  }
  angleTo(e) {
    return 2 * Math.acos(Math.abs(J2(this.dot(e), -1, 1)));
  }
  rotateTowards(e, t) {
    const i = this.angleTo(e);
    if (i === 0) return this;
    const r = Math.min(1, t / i);
    return (this.slerp(e, r), this);
  }
  identity() {
    return this.set(0, 0, 0, 1);
  }
  invert() {
    return this.conjugate();
  }
  conjugate() {
    return (
      (this._x *= -1),
      (this._y *= -1),
      (this._z *= -1),
      this._onChangeCallback(),
      this
    );
  }
  dot(e) {
    return this._x * e._x + this._y * e._y + this._z * e._z + this._w * e._w;
  }
  lengthSq() {
    return (
      this._x * this._x +
      this._y * this._y +
      this._z * this._z +
      this._w * this._w
    );
  }
  length() {
    return Math.sqrt(
      this._x * this._x +
        this._y * this._y +
        this._z * this._z +
        this._w * this._w,
    );
  }
  normalize() {
    let e = this.length();
    return (
      e === 0
        ? ((this._x = 0), (this._y = 0), (this._z = 0), (this._w = 1))
        : ((e = 1 / e),
          (this._x = this._x * e),
          (this._y = this._y * e),
          (this._z = this._z * e),
          (this._w = this._w * e)),
      this._onChangeCallback(),
      this
    );
  }
  multiply(e) {
    return this.multiplyQuaternions(this, e);
  }
  premultiply(e) {
    return this.multiplyQuaternions(e, this);
  }
  multiplyQuaternions(e, t) {
    const i = e._x,
      r = e._y,
      s = e._z,
      o = e._w,
      a = t._x,
      c = t._y,
      l = t._z,
      u = t._w;
    return (
      (this._x = i * u + o * a + r * l - s * c),
      (this._y = r * u + o * c + s * a - i * l),
      (this._z = s * u + o * l + i * c - r * a),
      (this._w = o * u - i * a - r * c - s * l),
      this._onChangeCallback(),
      this
    );
  }
  slerp(e, t) {
    if (t === 0) return this;
    if (t === 1) return this.copy(e);
    const i = this._x,
      r = this._y,
      s = this._z,
      o = this._w;
    let a = o * e._w + i * e._x + r * e._y + s * e._z;
    if (
      (a < 0
        ? ((this._w = -e._w),
          (this._x = -e._x),
          (this._y = -e._y),
          (this._z = -e._z),
          (a = -a))
        : this.copy(e),
      a >= 1)
    )
      return ((this._w = o), (this._x = i), (this._y = r), (this._z = s), this);
    const c = 1 - a * a;
    if (c <= Number.EPSILON) {
      const f = 1 - t;
      return (
        (this._w = f * o + t * this._w),
        (this._x = f * i + t * this._x),
        (this._y = f * r + t * this._y),
        (this._z = f * s + t * this._z),
        this.normalize(),
        this
      );
    }
    const l = Math.sqrt(c),
      u = Math.atan2(l, a),
      h = Math.sin((1 - t) * u) / l,
      d = Math.sin(t * u) / l;
    return (
      (this._w = o * h + this._w * d),
      (this._x = i * h + this._x * d),
      (this._y = r * h + this._y * d),
      (this._z = s * h + this._z * d),
      this._onChangeCallback(),
      this
    );
  }
  slerpQuaternions(e, t, i) {
    return this.copy(e).slerp(t, i);
  }
  random() {
    const e = 2 * Math.PI * Math.random(),
      t = 2 * Math.PI * Math.random(),
      i = Math.random(),
      r = Math.sqrt(1 - i),
      s = Math.sqrt(i);
    return this.set(
      r * Math.sin(e),
      r * Math.cos(e),
      s * Math.sin(t),
      s * Math.cos(t),
    );
  }
  equals(e) {
    return (
      e._x === this._x &&
      e._y === this._y &&
      e._z === this._z &&
      e._w === this._w
    );
  }
  fromArray(e, t = 0) {
    return (
      (this._x = e[t]),
      (this._y = e[t + 1]),
      (this._z = e[t + 2]),
      (this._w = e[t + 3]),
      this._onChangeCallback(),
      this
    );
  }
  toArray(e = [], t = 0) {
    return (
      (e[t] = this._x),
      (e[t + 1] = this._y),
      (e[t + 2] = this._z),
      (e[t + 3] = this._w),
      e
    );
  }
  fromBufferAttribute(e, t) {
    return (
      (this._x = e.getX(t)),
      (this._y = e.getY(t)),
      (this._z = e.getZ(t)),
      (this._w = e.getW(t)),
      this._onChangeCallback(),
      this
    );
  }
  toJSON() {
    return this.toArray();
  }
  _onChange(e) {
    return ((this._onChangeCallback = e), this);
  }
  _onChangeCallback() {}
  *[Symbol.iterator]() {
    (yield this._x, yield this._y, yield this._z, yield this._w);
  }
}
class H {
  constructor(e = 0, t = 0, i = 0) {
    ((H.prototype.isVector3 = !0), (this.x = e), (this.y = t), (this.z = i));
  }
  set(e, t, i) {
    return (
      i === void 0 && (i = this.z),
      (this.x = e),
      (this.y = t),
      (this.z = i),
      this
    );
  }
  setScalar(e) {
    return ((this.x = e), (this.y = e), (this.z = e), this);
  }
  setX(e) {
    return ((this.x = e), this);
  }
  setY(e) {
    return ((this.y = e), this);
  }
  setZ(e) {
    return ((this.z = e), this);
  }
  setComponent(e, t) {
    switch (e) {
      case 0:
        this.x = t;
        break;
      case 1:
        this.y = t;
        break;
      case 2:
        this.z = t;
        break;
      default:
        throw new Error("index is out of range: " + e);
    }
    return this;
  }
  getComponent(e) {
    switch (e) {
      case 0:
        return this.x;
      case 1:
        return this.y;
      case 2:
        return this.z;
      default:
        throw new Error("index is out of range: " + e);
    }
  }
  clone() {
    return new this.constructor(this.x, this.y, this.z);
  }
  copy(e) {
    return ((this.x = e.x), (this.y = e.y), (this.z = e.z), this);
  }
  add(e) {
    return ((this.x += e.x), (this.y += e.y), (this.z += e.z), this);
  }
  addScalar(e) {
    return ((this.x += e), (this.y += e), (this.z += e), this);
  }
  addVectors(e, t) {
    return (
      (this.x = e.x + t.x),
      (this.y = e.y + t.y),
      (this.z = e.z + t.z),
      this
    );
  }
  addScaledVector(e, t) {
    return (
      (this.x += e.x * t),
      (this.y += e.y * t),
      (this.z += e.z * t),
      this
    );
  }
  sub(e) {
    return ((this.x -= e.x), (this.y -= e.y), (this.z -= e.z), this);
  }
  subScalar(e) {
    return ((this.x -= e), (this.y -= e), (this.z -= e), this);
  }
  subVectors(e, t) {
    return (
      (this.x = e.x - t.x),
      (this.y = e.y - t.y),
      (this.z = e.z - t.z),
      this
    );
  }
  multiply(e) {
    return ((this.x *= e.x), (this.y *= e.y), (this.z *= e.z), this);
  }
  multiplyScalar(e) {
    return ((this.x *= e), (this.y *= e), (this.z *= e), this);
  }
  multiplyVectors(e, t) {
    return (
      (this.x = e.x * t.x),
      (this.y = e.y * t.y),
      (this.z = e.z * t.z),
      this
    );
  }
  applyEuler(e) {
    return this.applyQuaternion(nA.setFromEuler(e));
  }
  applyAxisAngle(e, t) {
    return this.applyQuaternion(nA.setFromAxisAngle(e, t));
  }
  applyMatrix3(e) {
    const t = this.x,
      i = this.y,
      r = this.z,
      s = e.elements;
    return (
      (this.x = s[0] * t + s[3] * i + s[6] * r),
      (this.y = s[1] * t + s[4] * i + s[7] * r),
      (this.z = s[2] * t + s[5] * i + s[8] * r),
      this
    );
  }
  applyNormalMatrix(e) {
    return this.applyMatrix3(e).normalize();
  }
  applyMatrix4(e) {
    const t = this.x,
      i = this.y,
      r = this.z,
      s = e.elements,
      o = 1 / (s[3] * t + s[7] * i + s[11] * r + s[15]);
    return (
      (this.x = (s[0] * t + s[4] * i + s[8] * r + s[12]) * o),
      (this.y = (s[1] * t + s[5] * i + s[9] * r + s[13]) * o),
      (this.z = (s[2] * t + s[6] * i + s[10] * r + s[14]) * o),
      this
    );
  }
  applyQuaternion(e) {
    const t = this.x,
      i = this.y,
      r = this.z,
      s = e.x,
      o = e.y,
      a = e.z,
      c = e.w,
      l = 2 * (o * r - a * i),
      u = 2 * (a * t - s * r),
      h = 2 * (s * i - o * t);
    return (
      (this.x = t + c * l + o * h - a * u),
      (this.y = i + c * u + a * l - s * h),
      (this.z = r + c * h + s * u - o * l),
      this
    );
  }
  project(e) {
    return this.applyMatrix4(e.matrixWorldInverse).applyMatrix4(
      e.projectionMatrix,
    );
  }
  unproject(e) {
    return this.applyMatrix4(e.projectionMatrixInverse).applyMatrix4(
      e.matrixWorld,
    );
  }
  transformDirection(e) {
    const t = this.x,
      i = this.y,
      r = this.z,
      s = e.elements;
    return (
      (this.x = s[0] * t + s[4] * i + s[8] * r),
      (this.y = s[1] * t + s[5] * i + s[9] * r),
      (this.z = s[2] * t + s[6] * i + s[10] * r),
      this.normalize()
    );
  }
  divide(e) {
    return ((this.x /= e.x), (this.y /= e.y), (this.z /= e.z), this);
  }
  divideScalar(e) {
    return this.multiplyScalar(1 / e);
  }
  min(e) {
    return (
      (this.x = Math.min(this.x, e.x)),
      (this.y = Math.min(this.y, e.y)),
      (this.z = Math.min(this.z, e.z)),
      this
    );
  }
  max(e) {
    return (
      (this.x = Math.max(this.x, e.x)),
      (this.y = Math.max(this.y, e.y)),
      (this.z = Math.max(this.z, e.z)),
      this
    );
  }
  clamp(e, t) {
    return (
      (this.x = J2(this.x, e.x, t.x)),
      (this.y = J2(this.y, e.y, t.y)),
      (this.z = J2(this.z, e.z, t.z)),
      this
    );
  }
  clampScalar(e, t) {
    return (
      (this.x = J2(this.x, e, t)),
      (this.y = J2(this.y, e, t)),
      (this.z = J2(this.z, e, t)),
      this
    );
  }
  clampLength(e, t) {
    const i = this.length();
    return this.divideScalar(i || 1).multiplyScalar(J2(i, e, t));
  }
  floor() {
    return (
      (this.x = Math.floor(this.x)),
      (this.y = Math.floor(this.y)),
      (this.z = Math.floor(this.z)),
      this
    );
  }
  ceil() {
    return (
      (this.x = Math.ceil(this.x)),
      (this.y = Math.ceil(this.y)),
      (this.z = Math.ceil(this.z)),
      this
    );
  }
  round() {
    return (
      (this.x = Math.round(this.x)),
      (this.y = Math.round(this.y)),
      (this.z = Math.round(this.z)),
      this
    );
  }
  roundToZero() {
    return (
      (this.x = Math.trunc(this.x)),
      (this.y = Math.trunc(this.y)),
      (this.z = Math.trunc(this.z)),
      this
    );
  }
  negate() {
    return ((this.x = -this.x), (this.y = -this.y), (this.z = -this.z), this);
  }
  dot(e) {
    return this.x * e.x + this.y * e.y + this.z * e.z;
  }
  lengthSq() {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }
  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }
  manhattanLength() {
    return Math.abs(this.x) + Math.abs(this.y) + Math.abs(this.z);
  }
  normalize() {
    return this.divideScalar(this.length() || 1);
  }
  setLength(e) {
    return this.normalize().multiplyScalar(e);
  }
  lerp(e, t) {
    return (
      (this.x += (e.x - this.x) * t),
      (this.y += (e.y - this.y) * t),
      (this.z += (e.z - this.z) * t),
      this
    );
  }
  lerpVectors(e, t, i) {
    return (
      (this.x = e.x + (t.x - e.x) * i),
      (this.y = e.y + (t.y - e.y) * i),
      (this.z = e.z + (t.z - e.z) * i),
      this
    );
  }
  cross(e) {
    return this.crossVectors(this, e);
  }
  crossVectors(e, t) {
    const i = e.x,
      r = e.y,
      s = e.z,
      o = t.x,
      a = t.y,
      c = t.z;
    return (
      (this.x = r * c - s * a),
      (this.y = s * o - i * c),
      (this.z = i * a - r * o),
      this
    );
  }
  projectOnVector(e) {
    const t = e.lengthSq();
    if (t === 0) return this.set(0, 0, 0);
    const i = e.dot(this) / t;
    return this.copy(e).multiplyScalar(i);
  }
  projectOnPlane(e) {
    return (V7.copy(this).projectOnVector(e), this.sub(V7));
  }
  reflect(e) {
    return this.sub(V7.copy(e).multiplyScalar(2 * this.dot(e)));
  }
  angleTo(e) {
    const t = Math.sqrt(this.lengthSq() * e.lengthSq());
    if (t === 0) return Math.PI / 2;
    const i = this.dot(e) / t;
    return Math.acos(J2(i, -1, 1));
  }
  distanceTo(e) {
    return Math.sqrt(this.distanceToSquared(e));
  }
  distanceToSquared(e) {
    const t = this.x - e.x,
      i = this.y - e.y,
      r = this.z - e.z;
    return t * t + i * i + r * r;
  }
  manhattanDistanceTo(e) {
    return (
      Math.abs(this.x - e.x) + Math.abs(this.y - e.y) + Math.abs(this.z - e.z)
    );
  }
  setFromSpherical(e) {
    return this.setFromSphericalCoords(e.radius, e.phi, e.theta);
  }
  setFromSphericalCoords(e, t, i) {
    const r = Math.sin(t) * e;
    return (
      (this.x = r * Math.sin(i)),
      (this.y = Math.cos(t) * e),
      (this.z = r * Math.cos(i)),
      this
    );
  }
  setFromCylindrical(e) {
    return this.setFromCylindricalCoords(e.radius, e.theta, e.y);
  }
  setFromCylindricalCoords(e, t, i) {
    return (
      (this.x = e * Math.sin(t)),
      (this.y = i),
      (this.z = e * Math.cos(t)),
      this
    );
  }
  setFromMatrixPosition(e) {
    const t = e.elements;
    return ((this.x = t[12]), (this.y = t[13]), (this.z = t[14]), this);
  }
  setFromMatrixScale(e) {
    const t = this.setFromMatrixColumn(e, 0).length(),
      i = this.setFromMatrixColumn(e, 1).length(),
      r = this.setFromMatrixColumn(e, 2).length();
    return ((this.x = t), (this.y = i), (this.z = r), this);
  }
  setFromMatrixColumn(e, t) {
    return this.fromArray(e.elements, t * 4);
  }
  setFromMatrix3Column(e, t) {
    return this.fromArray(e.elements, t * 3);
  }
  setFromEuler(e) {
    return ((this.x = e._x), (this.y = e._y), (this.z = e._z), this);
  }
  setFromColor(e) {
    return ((this.x = e.r), (this.y = e.g), (this.z = e.b), this);
  }
  equals(e) {
    return e.x === this.x && e.y === this.y && e.z === this.z;
  }
  fromArray(e, t = 0) {
    return ((this.x = e[t]), (this.y = e[t + 1]), (this.z = e[t + 2]), this);
  }
  toArray(e = [], t = 0) {
    return ((e[t] = this.x), (e[t + 1] = this.y), (e[t + 2] = this.z), e);
  }
  fromBufferAttribute(e, t) {
    return (
      (this.x = e.getX(t)),
      (this.y = e.getY(t)),
      (this.z = e.getZ(t)),
      this
    );
  }
  random() {
    return (
      (this.x = Math.random()),
      (this.y = Math.random()),
      (this.z = Math.random()),
      this
    );
  }
  randomDirection() {
    const e = Math.random() * Math.PI * 2,
      t = Math.random() * 2 - 1,
      i = Math.sqrt(1 - t * t);
    return (
      (this.x = i * Math.cos(e)),
      (this.y = t),
      (this.z = i * Math.sin(e)),
      this
    );
  }
  *[Symbol.iterator]() {
    (yield this.x, yield this.y, yield this.z);
  }
}
const V7 = new H(),
  nA = new s5();
class W2 {
  constructor(e, t, i, r, s, o, a, c, l) {
    ((W2.prototype.isMatrix3 = !0),
      (this.elements = [1, 0, 0, 0, 1, 0, 0, 0, 1]),
      e !== void 0 && this.set(e, t, i, r, s, o, a, c, l));
  }
  set(e, t, i, r, s, o, a, c, l) {
    const u = this.elements;
    return (
      (u[0] = e),
      (u[1] = r),
      (u[2] = a),
      (u[3] = t),
      (u[4] = s),
      (u[5] = c),
      (u[6] = i),
      (u[7] = o),
      (u[8] = l),
      this
    );
  }
  identity() {
    return (this.set(1, 0, 0, 0, 1, 0, 0, 0, 1), this);
  }
  copy(e) {
    const t = this.elements,
      i = e.elements;
    return (
      (t[0] = i[0]),
      (t[1] = i[1]),
      (t[2] = i[2]),
      (t[3] = i[3]),
      (t[4] = i[4]),
      (t[5] = i[5]),
      (t[6] = i[6]),
      (t[7] = i[7]),
      (t[8] = i[8]),
      this
    );
  }
  extractBasis(e, t, i) {
    return (
      e.setFromMatrix3Column(this, 0),
      t.setFromMatrix3Column(this, 1),
      i.setFromMatrix3Column(this, 2),
      this
    );
  }
  setFromMatrix4(e) {
    const t = e.elements;
    return (
      this.set(t[0], t[4], t[8], t[1], t[5], t[9], t[2], t[6], t[10]),
      this
    );
  }
  multiply(e) {
    return this.multiplyMatrices(this, e);
  }
  premultiply(e) {
    return this.multiplyMatrices(e, this);
  }
  multiplyMatrices(e, t) {
    const i = e.elements,
      r = t.elements,
      s = this.elements,
      o = i[0],
      a = i[3],
      c = i[6],
      l = i[1],
      u = i[4],
      h = i[7],
      d = i[2],
      f = i[5],
      p = i[8],
      v = r[0],
      w = r[3],
      g = r[6],
      y = r[1],
      b = r[4],
      A = r[7],
      x = r[2],
      M = r[5],
      E = r[8];
    return (
      (s[0] = o * v + a * y + c * x),
      (s[3] = o * w + a * b + c * M),
      (s[6] = o * g + a * A + c * E),
      (s[1] = l * v + u * y + h * x),
      (s[4] = l * w + u * b + h * M),
      (s[7] = l * g + u * A + h * E),
      (s[2] = d * v + f * y + p * x),
      (s[5] = d * w + f * b + p * M),
      (s[8] = d * g + f * A + p * E),
      this
    );
  }
  multiplyScalar(e) {
    const t = this.elements;
    return (
      (t[0] *= e),
      (t[3] *= e),
      (t[6] *= e),
      (t[1] *= e),
      (t[4] *= e),
      (t[7] *= e),
      (t[2] *= e),
      (t[5] *= e),
      (t[8] *= e),
      this
    );
  }
  determinant() {
    const e = this.elements,
      t = e[0],
      i = e[1],
      r = e[2],
      s = e[3],
      o = e[4],
      a = e[5],
      c = e[6],
      l = e[7],
      u = e[8];
    return (
      t * o * u - t * a * l - i * s * u + i * a * c + r * s * l - r * o * c
    );
  }
  invert() {
    const e = this.elements,
      t = e[0],
      i = e[1],
      r = e[2],
      s = e[3],
      o = e[4],
      a = e[5],
      c = e[6],
      l = e[7],
      u = e[8],
      h = u * o - a * l,
      d = a * c - u * s,
      f = l * s - o * c,
      p = t * h + i * d + r * f;
    if (p === 0) return this.set(0, 0, 0, 0, 0, 0, 0, 0, 0);
    const v = 1 / p;
    return (
      (e[0] = h * v),
      (e[1] = (r * l - u * i) * v),
      (e[2] = (a * i - r * o) * v),
      (e[3] = d * v),
      (e[4] = (u * t - r * c) * v),
      (e[5] = (r * s - a * t) * v),
      (e[6] = f * v),
      (e[7] = (i * c - l * t) * v),
      (e[8] = (o * t - i * s) * v),
      this
    );
  }
  transpose() {
    let e;
    const t = this.elements;
    return (
      (e = t[1]),
      (t[1] = t[3]),
      (t[3] = e),
      (e = t[2]),
      (t[2] = t[6]),
      (t[6] = e),
      (e = t[5]),
      (t[5] = t[7]),
      (t[7] = e),
      this
    );
  }
  getNormalMatrix(e) {
    return this.setFromMatrix4(e).invert().transpose();
  }
  transposeIntoArray(e) {
    const t = this.elements;
    return (
      (e[0] = t[0]),
      (e[1] = t[3]),
      (e[2] = t[6]),
      (e[3] = t[1]),
      (e[4] = t[4]),
      (e[5] = t[7]),
      (e[6] = t[2]),
      (e[7] = t[5]),
      (e[8] = t[8]),
      this
    );
  }
  setUvTransform(e, t, i, r, s, o, a) {
    const c = Math.cos(s),
      l = Math.sin(s);
    return (
      this.set(
        i * c,
        i * l,
        -i * (c * o + l * a) + o + e,
        -r * l,
        r * c,
        -r * (-l * o + c * a) + a + t,
        0,
        0,
        1,
      ),
      this
    );
  }
  scale(e, t) {
    return (this.premultiply(N7.makeScale(e, t)), this);
  }
  rotate(e) {
    return (this.premultiply(N7.makeRotation(-e)), this);
  }
  translate(e, t) {
    return (this.premultiply(N7.makeTranslation(e, t)), this);
  }
  makeTranslation(e, t) {
    return (
      e.isVector2
        ? this.set(1, 0, e.x, 0, 1, e.y, 0, 0, 1)
        : this.set(1, 0, e, 0, 1, t, 0, 0, 1),
      this
    );
  }
  makeRotation(e) {
    const t = Math.cos(e),
      i = Math.sin(e);
    return (this.set(t, -i, 0, i, t, 0, 0, 0, 1), this);
  }
  makeScale(e, t) {
    return (this.set(e, 0, 0, 0, t, 0, 0, 0, 1), this);
  }
  equals(e) {
    const t = this.elements,
      i = e.elements;
    for (let r = 0; r < 9; r++) if (t[r] !== i[r]) return !1;
    return !0;
  }
  fromArray(e, t = 0) {
    for (let i = 0; i < 9; i++) this.elements[i] = e[i + t];
    return this;
  }
  toArray(e = [], t = 0) {
    const i = this.elements;
    return (
      (e[t] = i[0]),
      (e[t + 1] = i[1]),
      (e[t + 2] = i[2]),
      (e[t + 3] = i[3]),
      (e[t + 4] = i[4]),
      (e[t + 5] = i[5]),
      (e[t + 6] = i[6]),
      (e[t + 7] = i[7]),
      (e[t + 8] = i[8]),
      e
    );
  }
  clone() {
    return new this.constructor().fromArray(this.elements);
  }
}
const N7 = new W2();
function yG(n) {
  for (let e = n.length - 1; e >= 0; --e) if (n[e] >= 65535) return !0;
  return !1;
}
function go(n) {
  return document.createElementNS("http://www.w3.org/1999/xhtml", n);
}
function JV() {
  const n = go("canvas");
  return ((n.style.display = "block"), n);
}
const iA = {};
function qi(n) {
  n in iA || ((iA[n] = !0), console.warn(n));
}
function eN(n, e, t) {
  return new Promise(function (i, r) {
    function s() {
      switch (n.clientWaitSync(e, n.SYNC_FLUSH_COMMANDS_BIT, 0)) {
        case n.WAIT_FAILED:
          r();
          break;
        case n.TIMEOUT_EXPIRED:
          setTimeout(s, t);
          break;
        default:
          i();
      }
    }
    setTimeout(s, t);
  });
}
function tN(n) {
  const e = n.elements;
  ((e[2] = 0.5 * e[2] + 0.5 * e[3]),
    (e[6] = 0.5 * e[6] + 0.5 * e[7]),
    (e[10] = 0.5 * e[10] + 0.5 * e[11]),
    (e[14] = 0.5 * e[14] + 0.5 * e[15]));
}
function nN(n) {
  const e = n.elements;
  e[11] === -1
    ? ((e[10] = -e[10] - 1), (e[14] = -e[14]))
    : ((e[10] = -e[10]), (e[14] = -e[14] + 1));
}
const rA = new W2().set(
    0.4123908,
    0.3575843,
    0.1804808,
    0.212639,
    0.7151687,
    0.0721923,
    0.0193308,
    0.1191948,
    0.9505322,
  ),
  sA = new W2().set(
    3.2409699,
    -1.5373832,
    -0.4986108,
    -0.9692436,
    1.8759675,
    0.0415551,
    0.0556301,
    -0.203977,
    1.0569715,
  );
function iN() {
  const n = {
      enabled: !0,
      workingColorSpace: qe,
      spaces: {},
      convert: function (r, s, o) {
        return (
          this.enabled === !1 ||
            s === o ||
            !s ||
            !o ||
            (this.spaces[s].transfer === B9 &&
              ((r.r = Z5(r.r)), (r.g = Z5(r.g)), (r.b = Z5(r.b))),
            this.spaces[s].primaries !== this.spaces[o].primaries &&
              (r.applyMatrix3(this.spaces[s].toXYZ),
              r.applyMatrix3(this.spaces[o].fromXYZ)),
            this.spaces[o].transfer === B9 &&
              ((r.r = Ki(r.r)), (r.g = Ki(r.g)), (r.b = Ki(r.b)))),
          r
        );
      },
      workingToColorSpace: function (r, s) {
        return this.convert(r, this.workingColorSpace, s);
      },
      colorSpaceToWorking: function (r, s) {
        return this.convert(r, s, this.workingColorSpace);
      },
      getPrimaries: function (r) {
        return this.spaces[r].primaries;
      },
      getTransfer: function (r) {
        return r === v9 ? Rl : this.spaces[r].transfer;
      },
      getLuminanceCoefficients: function (r, s = this.workingColorSpace) {
        return r.fromArray(this.spaces[s].luminanceCoefficients);
      },
      define: function (r) {
        Object.assign(this.spaces, r);
      },
      _getMatrix: function (r, s, o) {
        return r.copy(this.spaces[s].toXYZ).multiply(this.spaces[o].fromXYZ);
      },
      _getDrawingBufferColorSpace: function (r) {
        return this.spaces[r].outputColorSpaceConfig.drawingBufferColorSpace;
      },
      _getUnpackColorSpace: function (r = this.workingColorSpace) {
        return this.spaces[r].workingColorSpaceConfig.unpackColorSpace;
      },
      fromWorkingColorSpace: function (r, s) {
        return (
          qi(
            "THREE.ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace().",
          ),
          n.workingToColorSpace(r, s)
        );
      },
      toWorkingColorSpace: function (r, s) {
        return (
          qi(
            "THREE.ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking().",
          ),
          n.colorSpaceToWorking(r, s)
        );
      },
    },
    e = [0.64, 0.33, 0.3, 0.6, 0.15, 0.06],
    t = [0.2126, 0.7152, 0.0722],
    i = [0.3127, 0.329];
  return (
    n.define({
      [qe]: {
        primaries: e,
        whitePoint: i,
        transfer: Rl,
        toXYZ: rA,
        fromXYZ: sA,
        luminanceCoefficients: t,
        workingColorSpaceConfig: { unpackColorSpace: Fe },
        outputColorSpaceConfig: { drawingBufferColorSpace: Fe },
      },
      [Fe]: {
        primaries: e,
        whitePoint: i,
        transfer: B9,
        toXYZ: rA,
        fromXYZ: sA,
        luminanceCoefficients: t,
        outputColorSpaceConfig: { drawingBufferColorSpace: Fe },
      },
    }),
    n
  );
}
const f9 = iN();
function Z5(n) {
  return n < 0.04045
    ? n * 0.0773993808
    : Math.pow(n * 0.9478672986 + 0.0521327014, 2.4);
}
function Ki(n) {
  return n < 0.0031308 ? n * 12.92 : 1.055 * Math.pow(n, 0.41666) - 0.055;
}
let O4;
class rN {
  static getDataURL(e, t = "image/png") {
    if (/^data:/i.test(e.src) || typeof HTMLCanvasElement > "u") return e.src;
    let i;
    if (e instanceof HTMLCanvasElement) i = e;
    else {
      (O4 === void 0 && (O4 = go("canvas")),
        (O4.width = e.width),
        (O4.height = e.height));
      const r = O4.getContext("2d");
      (e instanceof ImageData
        ? r.putImageData(e, 0, 0)
        : r.drawImage(e, 0, 0, e.width, e.height),
        (i = O4));
    }
    return i.toDataURL(t);
  }
  static sRGBToLinear(e) {
    if (
      (typeof HTMLImageElement < "u" && e instanceof HTMLImageElement) ||
      (typeof HTMLCanvasElement < "u" && e instanceof HTMLCanvasElement) ||
      (typeof ImageBitmap < "u" && e instanceof ImageBitmap)
    ) {
      const t = go("canvas");
      ((t.width = e.width), (t.height = e.height));
      const i = t.getContext("2d");
      i.drawImage(e, 0, 0, e.width, e.height);
      const r = i.getImageData(0, 0, e.width, e.height),
        s = r.data;
      for (let o = 0; o < s.length; o++) s[o] = Z5(s[o] / 255) * 255;
      return (i.putImageData(r, 0, 0), t);
    } else if (e.data) {
      const t = e.data.slice(0);
      for (let i = 0; i < t.length; i++)
        t instanceof Uint8Array || t instanceof Uint8ClampedArray
          ? (t[i] = Math.floor(Z5(t[i] / 255) * 255))
          : (t[i] = Z5(t[i]));
      return { data: t, width: e.width, height: e.height };
    } else
      return (
        console.warn(
          "THREE.ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied.",
        ),
        e
      );
  }
}
let sN = 0;
class km {
  constructor(e = null) {
    ((this.isSource = !0),
      Object.defineProperty(this, "id", { value: sN++ }),
      (this.uuid = Y5()),
      (this.data = e),
      (this.dataReady = !0),
      (this.version = 0));
  }
  getSize(e) {
    const t = this.data;
    return (
      t instanceof HTMLVideoElement
        ? e.set(t.videoWidth, t.videoHeight)
        : t !== null
          ? e.set(t.width, t.height, t.depth || 0)
          : e.set(0, 0, 0),
      e
    );
  }
  set needsUpdate(e) {
    e === !0 && this.version++;
  }
  toJSON(e) {
    const t = e === void 0 || typeof e == "string";
    if (!t && e.images[this.uuid] !== void 0) return e.images[this.uuid];
    const i = { uuid: this.uuid, url: "" },
      r = this.data;
    if (r !== null) {
      let s;
      if (Array.isArray(r)) {
        s = [];
        for (let o = 0, a = r.length; o < a; o++)
          r[o].isDataTexture ? s.push(O7(r[o].image)) : s.push(O7(r[o]));
      } else s = O7(r);
      i.url = s;
    }
    return (t || (e.images[this.uuid] = i), i);
  }
}
function O7(n) {
  return (typeof HTMLImageElement < "u" && n instanceof HTMLImageElement) ||
    (typeof HTMLCanvasElement < "u" && n instanceof HTMLCanvasElement) ||
    (typeof ImageBitmap < "u" && n instanceof ImageBitmap)
    ? rN.getDataURL(n)
    : n.data
      ? {
          data: Array.from(n.data),
          width: n.width,
          height: n.height,
          type: n.data.constructor.name,
        }
      : (console.warn("THREE.Texture: Unable to serialize Texture."), {});
}
let oN = 0;
const z7 = new H();
class D9 extends vr {
  constructor(
    e = D9.DEFAULT_IMAGE,
    t = D9.DEFAULT_MAPPING,
    i = F1,
    r = F1,
    s = u9,
    o = e5,
    a = e9,
    c = _9,
    l = D9.DEFAULT_ANISOTROPY,
    u = v9,
  ) {
    (super(),
      (this.isTexture = !0),
      Object.defineProperty(this, "id", { value: oN++ }),
      (this.uuid = Y5()),
      (this.name = ""),
      (this.source = new km(e)),
      (this.mipmaps = []),
      (this.mapping = t),
      (this.channel = 0),
      (this.wrapS = i),
      (this.wrapT = r),
      (this.magFilter = s),
      (this.minFilter = o),
      (this.anisotropy = l),
      (this.format = a),
      (this.internalFormat = null),
      (this.type = c),
      (this.offset = new B2(0, 0)),
      (this.repeat = new B2(1, 1)),
      (this.center = new B2(0, 0)),
      (this.rotation = 0),
      (this.matrixAutoUpdate = !0),
      (this.matrix = new W2()),
      (this.generateMipmaps = !0),
      (this.premultiplyAlpha = !1),
      (this.flipY = !0),
      (this.unpackAlignment = 4),
      (this.colorSpace = u),
      (this.userData = {}),
      (this.updateRanges = []),
      (this.version = 0),
      (this.onUpdate = null),
      (this.renderTarget = null),
      (this.isRenderTargetTexture = !1),
      (this.isArrayTexture = !!(e && e.depth && e.depth > 1)),
      (this.pmremVersion = 0));
  }
  get width() {
    return this.source.getSize(z7).x;
  }
  get height() {
    return this.source.getSize(z7).y;
  }
  get depth() {
    return this.source.getSize(z7).z;
  }
  get image() {
    return this.source.data;
  }
  set image(e = null) {
    this.source.data = e;
  }
  updateMatrix() {
    this.matrix.setUvTransform(
      this.offset.x,
      this.offset.y,
      this.repeat.x,
      this.repeat.y,
      this.rotation,
      this.center.x,
      this.center.y,
    );
  }
  addUpdateRange(e, t) {
    this.updateRanges.push({ start: e, count: t });
  }
  clearUpdateRanges() {
    this.updateRanges.length = 0;
  }
  clone() {
    return new this.constructor().copy(this);
  }
  copy(e) {
    return (
      (this.name = e.name),
      (this.source = e.source),
      (this.mipmaps = e.mipmaps.slice(0)),
      (this.mapping = e.mapping),
      (this.channel = e.channel),
      (this.wrapS = e.wrapS),
      (this.wrapT = e.wrapT),
      (this.magFilter = e.magFilter),
      (this.minFilter = e.minFilter),
      (this.anisotropy = e.anisotropy),
      (this.format = e.format),
      (this.internalFormat = e.internalFormat),
      (this.type = e.type),
      this.offset.copy(e.offset),
      this.repeat.copy(e.repeat),
      this.center.copy(e.center),
      (this.rotation = e.rotation),
      (this.matrixAutoUpdate = e.matrixAutoUpdate),
      this.matrix.copy(e.matrix),
      (this.generateMipmaps = e.generateMipmaps),
      (this.premultiplyAlpha = e.premultiplyAlpha),
      (this.flipY = e.flipY),
      (this.unpackAlignment = e.unpackAlignment),
      (this.colorSpace = e.colorSpace),
      (this.renderTarget = e.renderTarget),
      (this.isRenderTargetTexture = e.isRenderTargetTexture),
      (this.isArrayTexture = e.isArrayTexture),
      (this.userData = JSON.parse(JSON.stringify(e.userData))),
      (this.needsUpdate = !0),
      this
    );
  }
  setValues(e) {
    for (const t in e) {
      const i = e[t];
      if (i === void 0) {
        console.warn(
          `THREE.Texture.setValues(): parameter '${t}' has value of undefined.`,
        );
        continue;
      }
      const r = this[t];
      if (r === void 0) {
        console.warn(
          `THREE.Texture.setValues(): property '${t}' does not exist.`,
        );
        continue;
      }
      (r && i && r.isVector2 && i.isVector2) ||
      (r && i && r.isVector3 && i.isVector3) ||
      (r && i && r.isMatrix3 && i.isMatrix3)
        ? r.copy(i)
        : (this[t] = i);
    }
  }
  toJSON(e) {
    const t = e === void 0 || typeof e == "string";
    if (!t && e.textures[this.uuid] !== void 0) return e.textures[this.uuid];
    const i = {
      metadata: { version: 4.7, type: "Texture", generator: "Texture.toJSON" },
      uuid: this.uuid,
      name: this.name,
      image: this.source.toJSON(e).uuid,
      mapping: this.mapping,
      channel: this.channel,
      repeat: [this.repeat.x, this.repeat.y],
      offset: [this.offset.x, this.offset.y],
      center: [this.center.x, this.center.y],
      rotation: this.rotation,
      wrap: [this.wrapS, this.wrapT],
      format: this.format,
      internalFormat: this.internalFormat,
      type: this.type,
      colorSpace: this.colorSpace,
      minFilter: this.minFilter,
      magFilter: this.magFilter,
      anisotropy: this.anisotropy,
      flipY: this.flipY,
      generateMipmaps: this.generateMipmaps,
      premultiplyAlpha: this.premultiplyAlpha,
      unpackAlignment: this.unpackAlignment,
    };
    return (
      Object.keys(this.userData).length > 0 && (i.userData = this.userData),
      t || (e.textures[this.uuid] = i),
      i
    );
  }
  dispose() {
    this.dispatchEvent({ type: "dispose" });
  }
  transformUv(e) {
    if (this.mapping !== cG) return e;
    if ((e.applyMatrix3(this.matrix), e.x < 0 || e.x > 1))
      switch (this.wrapS) {
        case S1:
          e.x = e.x - Math.floor(e.x);
          break;
        case F1:
          e.x = e.x < 0 ? 0 : 1;
          break;
        case Tl:
          Math.abs(Math.floor(e.x) % 2) === 1
            ? (e.x = Math.ceil(e.x) - e.x)
            : (e.x = e.x - Math.floor(e.x));
          break;
      }
    if (e.y < 0 || e.y > 1)
      switch (this.wrapT) {
        case S1:
          e.y = e.y - Math.floor(e.y);
          break;
        case F1:
          e.y = e.y < 0 ? 0 : 1;
          break;
        case Tl:
          Math.abs(Math.floor(e.y) % 2) === 1
            ? (e.y = Math.ceil(e.y) - e.y)
            : (e.y = e.y - Math.floor(e.y));
          break;
      }
    return (this.flipY && (e.y = 1 - e.y), e);
  }
  set needsUpdate(e) {
    e === !0 && (this.version++, (this.source.needsUpdate = !0));
  }
  set needsPMREMUpdate(e) {
    e === !0 && this.pmremVersion++;
  }
}
D9.DEFAULT_IMAGE = null;
D9.DEFAULT_MAPPING = cG;
D9.DEFAULT_ANISOTROPY = 1;
class Y2 {
  constructor(e = 0, t = 0, i = 0, r = 1) {
    ((Y2.prototype.isVector4 = !0),
      (this.x = e),
      (this.y = t),
      (this.z = i),
      (this.w = r));
  }
  get width() {
    return this.z;
  }
  set width(e) {
    this.z = e;
  }
  get height() {
    return this.w;
  }
  set height(e) {
    this.w = e;
  }
  set(e, t, i, r) {
    return ((this.x = e), (this.y = t), (this.z = i), (this.w = r), this);
  }
  setScalar(e) {
    return ((this.x = e), (this.y = e), (this.z = e), (this.w = e), this);
  }
  setX(e) {
    return ((this.x = e), this);
  }
  setY(e) {
    return ((this.y = e), this);
  }
  setZ(e) {
    return ((this.z = e), this);
  }
  setW(e) {
    return ((this.w = e), this);
  }
  setComponent(e, t) {
    switch (e) {
      case 0:
        this.x = t;
        break;
      case 1:
        this.y = t;
        break;
      case 2:
        this.z = t;
        break;
      case 3:
        this.w = t;
        break;
      default:
        throw new Error("index is out of range: " + e);
    }
    return this;
  }
  getComponent(e) {
    switch (e) {
      case 0:
        return this.x;
      case 1:
        return this.y;
      case 2:
        return this.z;
      case 3:
        return this.w;
      default:
        throw new Error("index is out of range: " + e);
    }
  }
  clone() {
    return new this.constructor(this.x, this.y, this.z, this.w);
  }
  copy(e) {
    return (
      (this.x = e.x),
      (this.y = e.y),
      (this.z = e.z),
      (this.w = e.w !== void 0 ? e.w : 1),
      this
    );
  }
  add(e) {
    return (
      (this.x += e.x),
      (this.y += e.y),
      (this.z += e.z),
      (this.w += e.w),
      this
    );
  }
  addScalar(e) {
    return ((this.x += e), (this.y += e), (this.z += e), (this.w += e), this);
  }
  addVectors(e, t) {
    return (
      (this.x = e.x + t.x),
      (this.y = e.y + t.y),
      (this.z = e.z + t.z),
      (this.w = e.w + t.w),
      this
    );
  }
  addScaledVector(e, t) {
    return (
      (this.x += e.x * t),
      (this.y += e.y * t),
      (this.z += e.z * t),
      (this.w += e.w * t),
      this
    );
  }
  sub(e) {
    return (
      (this.x -= e.x),
      (this.y -= e.y),
      (this.z -= e.z),
      (this.w -= e.w),
      this
    );
  }
  subScalar(e) {
    return ((this.x -= e), (this.y -= e), (this.z -= e), (this.w -= e), this);
  }
  subVectors(e, t) {
    return (
      (this.x = e.x - t.x),
      (this.y = e.y - t.y),
      (this.z = e.z - t.z),
      (this.w = e.w - t.w),
      this
    );
  }
  multiply(e) {
    return (
      (this.x *= e.x),
      (this.y *= e.y),
      (this.z *= e.z),
      (this.w *= e.w),
      this
    );
  }
  multiplyScalar(e) {
    return ((this.x *= e), (this.y *= e), (this.z *= e), (this.w *= e), this);
  }
  applyMatrix4(e) {
    const t = this.x,
      i = this.y,
      r = this.z,
      s = this.w,
      o = e.elements;
    return (
      (this.x = o[0] * t + o[4] * i + o[8] * r + o[12] * s),
      (this.y = o[1] * t + o[5] * i + o[9] * r + o[13] * s),
      (this.z = o[2] * t + o[6] * i + o[10] * r + o[14] * s),
      (this.w = o[3] * t + o[7] * i + o[11] * r + o[15] * s),
      this
    );
  }
  divide(e) {
    return (
      (this.x /= e.x),
      (this.y /= e.y),
      (this.z /= e.z),
      (this.w /= e.w),
      this
    );
  }
  divideScalar(e) {
    return this.multiplyScalar(1 / e);
  }
  setAxisAngleFromQuaternion(e) {
    this.w = 2 * Math.acos(e.w);
    const t = Math.sqrt(1 - e.w * e.w);
    return (
      t < 1e-4
        ? ((this.x = 1), (this.y = 0), (this.z = 0))
        : ((this.x = e.x / t), (this.y = e.y / t), (this.z = e.z / t)),
      this
    );
  }
  setAxisAngleFromRotationMatrix(e) {
    let t, i, r, s;
    const c = e.elements,
      l = c[0],
      u = c[4],
      h = c[8],
      d = c[1],
      f = c[5],
      p = c[9],
      v = c[2],
      w = c[6],
      g = c[10];
    if (
      Math.abs(u - d) < 0.01 &&
      Math.abs(h - v) < 0.01 &&
      Math.abs(p - w) < 0.01
    ) {
      if (
        Math.abs(u + d) < 0.1 &&
        Math.abs(h + v) < 0.1 &&
        Math.abs(p + w) < 0.1 &&
        Math.abs(l + f + g - 3) < 0.1
      )
        return (this.set(1, 0, 0, 0), this);
      t = Math.PI;
      const b = (l + 1) / 2,
        A = (f + 1) / 2,
        x = (g + 1) / 2,
        M = (u + d) / 4,
        E = (h + v) / 4,
        _ = (p + w) / 4;
      return (
        b > A && b > x
          ? b < 0.01
            ? ((i = 0), (r = 0.707106781), (s = 0.707106781))
            : ((i = Math.sqrt(b)), (r = M / i), (s = E / i))
          : A > x
            ? A < 0.01
              ? ((i = 0.707106781), (r = 0), (s = 0.707106781))
              : ((r = Math.sqrt(A)), (i = M / r), (s = _ / r))
            : x < 0.01
              ? ((i = 0.707106781), (r = 0.707106781), (s = 0))
              : ((s = Math.sqrt(x)), (i = E / s), (r = _ / s)),
        this.set(i, r, s, t),
        this
      );
    }
    let y = Math.sqrt(
      (w - p) * (w - p) + (h - v) * (h - v) + (d - u) * (d - u),
    );
    return (
      Math.abs(y) < 0.001 && (y = 1),
      (this.x = (w - p) / y),
      (this.y = (h - v) / y),
      (this.z = (d - u) / y),
      (this.w = Math.acos((l + f + g - 1) / 2)),
      this
    );
  }
  setFromMatrixPosition(e) {
    const t = e.elements;
    return (
      (this.x = t[12]),
      (this.y = t[13]),
      (this.z = t[14]),
      (this.w = t[15]),
      this
    );
  }
  min(e) {
    return (
      (this.x = Math.min(this.x, e.x)),
      (this.y = Math.min(this.y, e.y)),
      (this.z = Math.min(this.z, e.z)),
      (this.w = Math.min(this.w, e.w)),
      this
    );
  }
  max(e) {
    return (
      (this.x = Math.max(this.x, e.x)),
      (this.y = Math.max(this.y, e.y)),
      (this.z = Math.max(this.z, e.z)),
      (this.w = Math.max(this.w, e.w)),
      this
    );
  }
  clamp(e, t) {
    return (
      (this.x = J2(this.x, e.x, t.x)),
      (this.y = J2(this.y, e.y, t.y)),
      (this.z = J2(this.z, e.z, t.z)),
      (this.w = J2(this.w, e.w, t.w)),
      this
    );
  }
  clampScalar(e, t) {
    return (
      (this.x = J2(this.x, e, t)),
      (this.y = J2(this.y, e, t)),
      (this.z = J2(this.z, e, t)),
      (this.w = J2(this.w, e, t)),
      this
    );
  }
  clampLength(e, t) {
    const i = this.length();
    return this.divideScalar(i || 1).multiplyScalar(J2(i, e, t));
  }
  floor() {
    return (
      (this.x = Math.floor(this.x)),
      (this.y = Math.floor(this.y)),
      (this.z = Math.floor(this.z)),
      (this.w = Math.floor(this.w)),
      this
    );
  }
  ceil() {
    return (
      (this.x = Math.ceil(this.x)),
      (this.y = Math.ceil(this.y)),
      (this.z = Math.ceil(this.z)),
      (this.w = Math.ceil(this.w)),
      this
    );
  }
  round() {
    return (
      (this.x = Math.round(this.x)),
      (this.y = Math.round(this.y)),
      (this.z = Math.round(this.z)),
      (this.w = Math.round(this.w)),
      this
    );
  }
  roundToZero() {
    return (
      (this.x = Math.trunc(this.x)),
      (this.y = Math.trunc(this.y)),
      (this.z = Math.trunc(this.z)),
      (this.w = Math.trunc(this.w)),
      this
    );
  }
  negate() {
    return (
      (this.x = -this.x),
      (this.y = -this.y),
      (this.z = -this.z),
      (this.w = -this.w),
      this
    );
  }
  dot(e) {
    return this.x * e.x + this.y * e.y + this.z * e.z + this.w * e.w;
  }
  lengthSq() {
    return (
      this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w
    );
  }
  length() {
    return Math.sqrt(
      this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w,
    );
  }
  manhattanLength() {
    return (
      Math.abs(this.x) + Math.abs(this.y) + Math.abs(this.z) + Math.abs(this.w)
    );
  }
  normalize() {
    return this.divideScalar(this.length() || 1);
  }
  setLength(e) {
    return this.normalize().multiplyScalar(e);
  }
  lerp(e, t) {
    return (
      (this.x += (e.x - this.x) * t),
      (this.y += (e.y - this.y) * t),
      (this.z += (e.z - this.z) * t),
      (this.w += (e.w - this.w) * t),
      this
    );
  }
  lerpVectors(e, t, i) {
    return (
      (this.x = e.x + (t.x - e.x) * i),
      (this.y = e.y + (t.y - e.y) * i),
      (this.z = e.z + (t.z - e.z) * i),
      (this.w = e.w + (t.w - e.w) * i),
      this
    );
  }
  equals(e) {
    return e.x === this.x && e.y === this.y && e.z === this.z && e.w === this.w;
  }
  fromArray(e, t = 0) {
    return (
      (this.x = e[t]),
      (this.y = e[t + 1]),
      (this.z = e[t + 2]),
      (this.w = e[t + 3]),
      this
    );
  }
  toArray(e = [], t = 0) {
    return (
      (e[t] = this.x),
      (e[t + 1] = this.y),
      (e[t + 2] = this.z),
      (e[t + 3] = this.w),
      e
    );
  }
  fromBufferAttribute(e, t) {
    return (
      (this.x = e.getX(t)),
      (this.y = e.getY(t)),
      (this.z = e.getZ(t)),
      (this.w = e.getW(t)),
      this
    );
  }
  random() {
    return (
      (this.x = Math.random()),
      (this.y = Math.random()),
      (this.z = Math.random()),
      (this.w = Math.random()),
      this
    );
  }
  *[Symbol.iterator]() {
    (yield this.x, yield this.y, yield this.z, yield this.w);
  }
}
class aN extends vr {
  constructor(e = 1, t = 1, i = {}) {
    (super(),
      (i = Object.assign(
        {
          generateMipmaps: !1,
          internalFormat: null,
          minFilter: u9,
          depthBuffer: !0,
          stencilBuffer: !1,
          resolveDepthBuffer: !0,
          resolveStencilBuffer: !0,
          depthTexture: null,
          samples: 0,
          count: 1,
          depth: 1,
          multiview: !1,
        },
        i,
      )),
      (this.isRenderTarget = !0),
      (this.width = e),
      (this.height = t),
      (this.depth = i.depth),
      (this.scissor = new Y2(0, 0, e, t)),
      (this.scissorTest = !1),
      (this.viewport = new Y2(0, 0, e, t)));
    const r = { width: e, height: t, depth: i.depth },
      s = new D9(r);
    this.textures = [];
    const o = i.count;
    for (let a = 0; a < o; a++)
      ((this.textures[a] = s.clone()),
        (this.textures[a].isRenderTargetTexture = !0),
        (this.textures[a].renderTarget = this));
    (this._setTextureOptions(i),
      (this.depthBuffer = i.depthBuffer),
      (this.stencilBuffer = i.stencilBuffer),
      (this.resolveDepthBuffer = i.resolveDepthBuffer),
      (this.resolveStencilBuffer = i.resolveStencilBuffer),
      (this._depthTexture = null),
      (this.depthTexture = i.depthTexture),
      (this.samples = i.samples),
      (this.multiview = i.multiview));
  }
  _setTextureOptions(e = {}) {
    const t = {
      minFilter: u9,
      generateMipmaps: !1,
      flipY: !1,
      internalFormat: null,
    };
    (e.mapping !== void 0 && (t.mapping = e.mapping),
      e.wrapS !== void 0 && (t.wrapS = e.wrapS),
      e.wrapT !== void 0 && (t.wrapT = e.wrapT),
      e.wrapR !== void 0 && (t.wrapR = e.wrapR),
      e.magFilter !== void 0 && (t.magFilter = e.magFilter),
      e.minFilter !== void 0 && (t.minFilter = e.minFilter),
      e.format !== void 0 && (t.format = e.format),
      e.type !== void 0 && (t.type = e.type),
      e.anisotropy !== void 0 && (t.anisotropy = e.anisotropy),
      e.colorSpace !== void 0 && (t.colorSpace = e.colorSpace),
      e.flipY !== void 0 && (t.flipY = e.flipY),
      e.generateMipmaps !== void 0 && (t.generateMipmaps = e.generateMipmaps),
      e.internalFormat !== void 0 && (t.internalFormat = e.internalFormat));
    for (let i = 0; i < this.textures.length; i++)
      this.textures[i].setValues(t);
  }
  get texture() {
    return this.textures[0];
  }
  set texture(e) {
    this.textures[0] = e;
  }
  set depthTexture(e) {
    (this._depthTexture !== null && (this._depthTexture.renderTarget = null),
      e !== null && (e.renderTarget = this),
      (this._depthTexture = e));
  }
  get depthTexture() {
    return this._depthTexture;
  }
  setSize(e, t, i = 1) {
    if (this.width !== e || this.height !== t || this.depth !== i) {
      ((this.width = e), (this.height = t), (this.depth = i));
      for (let r = 0, s = this.textures.length; r < s; r++)
        ((this.textures[r].image.width = e),
          (this.textures[r].image.height = t),
          (this.textures[r].image.depth = i),
          (this.textures[r].isArrayTexture = this.textures[r].image.depth > 1));
      this.dispose();
    }
    (this.viewport.set(0, 0, e, t), this.scissor.set(0, 0, e, t));
  }
  clone() {
    return new this.constructor().copy(this);
  }
  copy(e) {
    ((this.width = e.width),
      (this.height = e.height),
      (this.depth = e.depth),
      this.scissor.copy(e.scissor),
      (this.scissorTest = e.scissorTest),
      this.viewport.copy(e.viewport),
      (this.textures.length = 0));
    for (let t = 0, i = e.textures.length; t < i; t++) {
      ((this.textures[t] = e.textures[t].clone()),
        (this.textures[t].isRenderTargetTexture = !0),
        (this.textures[t].renderTarget = this));
      const r = Object.assign({}, e.textures[t].image);
      this.textures[t].source = new km(r);
    }
    return (
      (this.depthBuffer = e.depthBuffer),
      (this.stencilBuffer = e.stencilBuffer),
      (this.resolveDepthBuffer = e.resolveDepthBuffer),
      (this.resolveStencilBuffer = e.resolveStencilBuffer),
      e.depthTexture !== null && (this.depthTexture = e.depthTexture.clone()),
      (this.samples = e.samples),
      this
    );
  }
  dispose() {
    this.dispatchEvent({ type: "dispose" });
  }
}
class nn extends aN {
  constructor(e = 1, t = 1, i = {}) {
    (super(e, t, i), (this.isWebGLRenderTarget = !0));
  }
}
class AG extends D9 {
  constructor(e = null, t = 1, i = 1, r = 1) {
    (super(null),
      (this.isDataArrayTexture = !0),
      (this.image = { data: e, width: t, height: i, depth: r }),
      (this.magFilter = h9),
      (this.minFilter = h9),
      (this.wrapR = F1),
      (this.generateMipmaps = !1),
      (this.flipY = !1),
      (this.unpackAlignment = 1),
      (this.layerUpdates = new Set()));
  }
  addLayerUpdate(e) {
    this.layerUpdates.add(e);
  }
  clearLayerUpdates() {
    this.layerUpdates.clear();
  }
}
class cN extends D9 {
  constructor(e = null, t = 1, i = 1, r = 1) {
    (super(null),
      (this.isData3DTexture = !0),
      (this.image = { data: e, width: t, height: i, depth: r }),
      (this.magFilter = h9),
      (this.minFilter = h9),
      (this.wrapR = F1),
      (this.generateMipmaps = !1),
      (this.flipY = !1),
      (this.unpackAlignment = 1));
  }
}
class R4 {
  constructor(
    e = new H(1 / 0, 1 / 0, 1 / 0),
    t = new H(-1 / 0, -1 / 0, -1 / 0),
  ) {
    ((this.isBox3 = !0), (this.min = e), (this.max = t));
  }
  set(e, t) {
    return (this.min.copy(e), this.max.copy(t), this);
  }
  setFromArray(e) {
    this.makeEmpty();
    for (let t = 0, i = e.length; t < i; t += 3)
      this.expandByPoint(pt.fromArray(e, t));
    return this;
  }
  setFromBufferAttribute(e) {
    this.makeEmpty();
    for (let t = 0, i = e.count; t < i; t++)
      this.expandByPoint(pt.fromBufferAttribute(e, t));
    return this;
  }
  setFromPoints(e) {
    this.makeEmpty();
    for (let t = 0, i = e.length; t < i; t++) this.expandByPoint(e[t]);
    return this;
  }
  setFromCenterAndSize(e, t) {
    const i = pt.copy(t).multiplyScalar(0.5);
    return (this.min.copy(e).sub(i), this.max.copy(e).add(i), this);
  }
  setFromObject(e, t = !1) {
    return (this.makeEmpty(), this.expandByObject(e, t));
  }
  clone() {
    return new this.constructor().copy(this);
  }
  copy(e) {
    return (this.min.copy(e.min), this.max.copy(e.max), this);
  }
  makeEmpty() {
    return (
      (this.min.x = this.min.y = this.min.z = 1 / 0),
      (this.max.x = this.max.y = this.max.z = -1 / 0),
      this
    );
  }
  isEmpty() {
    return (
      this.max.x < this.min.x ||
      this.max.y < this.min.y ||
      this.max.z < this.min.z
    );
  }
  getCenter(e) {
    return this.isEmpty()
      ? e.set(0, 0, 0)
      : e.addVectors(this.min, this.max).multiplyScalar(0.5);
  }
  getSize(e) {
    return this.isEmpty() ? e.set(0, 0, 0) : e.subVectors(this.max, this.min);
  }
  expandByPoint(e) {
    return (this.min.min(e), this.max.max(e), this);
  }
  expandByVector(e) {
    return (this.min.sub(e), this.max.add(e), this);
  }
  expandByScalar(e) {
    return (this.min.addScalar(-e), this.max.addScalar(e), this);
  }
  expandByObject(e, t = !1) {
    e.updateWorldMatrix(!1, !1);
    const i = e.geometry;
    if (i !== void 0) {
      const s = i.getAttribute("position");
      if (t === !0 && s !== void 0 && e.isInstancedMesh !== !0)
        for (let o = 0, a = s.count; o < a; o++)
          (e.isMesh === !0
            ? e.getVertexPosition(o, pt)
            : pt.fromBufferAttribute(s, o),
            pt.applyMatrix4(e.matrixWorld),
            this.expandByPoint(pt));
      else
        (e.boundingBox !== void 0
          ? (e.boundingBox === null && e.computeBoundingBox(),
            Da.copy(e.boundingBox))
          : (i.boundingBox === null && i.computeBoundingBox(),
            Da.copy(i.boundingBox)),
          Da.applyMatrix4(e.matrixWorld),
          this.union(Da));
    }
    const r = e.children;
    for (let s = 0, o = r.length; s < o; s++) this.expandByObject(r[s], t);
    return this;
  }
  containsPoint(e) {
    return (
      e.x >= this.min.x &&
      e.x <= this.max.x &&
      e.y >= this.min.y &&
      e.y <= this.max.y &&
      e.z >= this.min.z &&
      e.z <= this.max.z
    );
  }
  containsBox(e) {
    return (
      this.min.x <= e.min.x &&
      e.max.x <= this.max.x &&
      this.min.y <= e.min.y &&
      e.max.y <= this.max.y &&
      this.min.z <= e.min.z &&
      e.max.z <= this.max.z
    );
  }
  getParameter(e, t) {
    return t.set(
      (e.x - this.min.x) / (this.max.x - this.min.x),
      (e.y - this.min.y) / (this.max.y - this.min.y),
      (e.z - this.min.z) / (this.max.z - this.min.z),
    );
  }
  intersectsBox(e) {
    return (
      e.max.x >= this.min.x &&
      e.min.x <= this.max.x &&
      e.max.y >= this.min.y &&
      e.min.y <= this.max.y &&
      e.max.z >= this.min.z &&
      e.min.z <= this.max.z
    );
  }
  intersectsSphere(e) {
    return (
      this.clampPoint(e.center, pt),
      pt.distanceToSquared(e.center) <= e.radius * e.radius
    );
  }
  intersectsPlane(e) {
    let t, i;
    return (
      e.normal.x > 0
        ? ((t = e.normal.x * this.min.x), (i = e.normal.x * this.max.x))
        : ((t = e.normal.x * this.max.x), (i = e.normal.x * this.min.x)),
      e.normal.y > 0
        ? ((t += e.normal.y * this.min.y), (i += e.normal.y * this.max.y))
        : ((t += e.normal.y * this.max.y), (i += e.normal.y * this.min.y)),
      e.normal.z > 0
        ? ((t += e.normal.z * this.min.z), (i += e.normal.z * this.max.z))
        : ((t += e.normal.z * this.max.z), (i += e.normal.z * this.min.z)),
      t <= -e.constant && i >= -e.constant
    );
  }
  intersectsTriangle(e) {
    if (this.isEmpty()) return !1;
    (this.getCenter(Pr),
      Va.subVectors(this.max, Pr),
      z4.subVectors(e.a, Pr),
      U4.subVectors(e.b, Pr),
      $4.subVectors(e.c, Pr),
      pn.subVectors(U4, z4),
      gn.subVectors($4, U4),
      w3.subVectors(z4, $4));
    let t = [
      0,
      -pn.z,
      pn.y,
      0,
      -gn.z,
      gn.y,
      0,
      -w3.z,
      w3.y,
      pn.z,
      0,
      -pn.x,
      gn.z,
      0,
      -gn.x,
      w3.z,
      0,
      -w3.x,
      -pn.y,
      pn.x,
      0,
      -gn.y,
      gn.x,
      0,
      -w3.y,
      w3.x,
      0,
    ];
    return !U7(t, z4, U4, $4, Va) ||
      ((t = [1, 0, 0, 0, 1, 0, 0, 0, 1]), !U7(t, z4, U4, $4, Va))
      ? !1
      : (Na.crossVectors(pn, gn),
        (t = [Na.x, Na.y, Na.z]),
        U7(t, z4, U4, $4, Va));
  }
  clampPoint(e, t) {
    return t.copy(e).clamp(this.min, this.max);
  }
  distanceToPoint(e) {
    return this.clampPoint(e, pt).distanceTo(e);
  }
  getBoundingSphere(e) {
    return (
      this.isEmpty()
        ? e.makeEmpty()
        : (this.getCenter(e.center),
          (e.radius = this.getSize(pt).length() * 0.5)),
      e
    );
  }
  intersect(e) {
    return (
      this.min.max(e.min),
      this.max.min(e.max),
      this.isEmpty() && this.makeEmpty(),
      this
    );
  }
  union(e) {
    return (this.min.min(e.min), this.max.max(e.max), this);
  }
  applyMatrix4(e) {
    return this.isEmpty()
      ? this
      : (m5[0].set(this.min.x, this.min.y, this.min.z).applyMatrix4(e),
        m5[1].set(this.min.x, this.min.y, this.max.z).applyMatrix4(e),
        m5[2].set(this.min.x, this.max.y, this.min.z).applyMatrix4(e),
        m5[3].set(this.min.x, this.max.y, this.max.z).applyMatrix4(e),
        m5[4].set(this.max.x, this.min.y, this.min.z).applyMatrix4(e),
        m5[5].set(this.max.x, this.min.y, this.max.z).applyMatrix4(e),
        m5[6].set(this.max.x, this.max.y, this.min.z).applyMatrix4(e),
        m5[7].set(this.max.x, this.max.y, this.max.z).applyMatrix4(e),
        this.setFromPoints(m5),
        this);
  }
  translate(e) {
    return (this.min.add(e), this.max.add(e), this);
  }
  equals(e) {
    return e.min.equals(this.min) && e.max.equals(this.max);
  }
  toJSON() {
    return { min: this.min.toArray(), max: this.max.toArray() };
  }
  fromJSON(e) {
    return (this.min.fromArray(e.min), this.max.fromArray(e.max), this);
  }
}
const m5 = [
    new H(),
    new H(),
    new H(),
    new H(),
    new H(),
    new H(),
    new H(),
    new H(),
  ],
  pt = new H(),
  Da = new R4(),
  z4 = new H(),
  U4 = new H(),
  $4 = new H(),
  pn = new H(),
  gn = new H(),
  w3 = new H(),
  Pr = new H(),
  Va = new H(),
  Na = new H(),
  v3 = new H();
function U7(n, e, t, i, r) {
  for (let s = 0, o = n.length - 3; s <= o; s += 3) {
    v3.fromArray(n, s);
    const a =
        r.x * Math.abs(v3.x) + r.y * Math.abs(v3.y) + r.z * Math.abs(v3.z),
      c = e.dot(v3),
      l = t.dot(v3),
      u = i.dot(v3);
    if (Math.max(-Math.max(c, l, u), Math.min(c, l, u)) > a) return !1;
  }
  return !0;
}
const lN = new R4(),
  Fr = new H(),
  $7 = new H();
class yr {
  constructor(e = new H(), t = -1) {
    ((this.isSphere = !0), (this.center = e), (this.radius = t));
  }
  set(e, t) {
    return (this.center.copy(e), (this.radius = t), this);
  }
  setFromPoints(e, t) {
    const i = this.center;
    t !== void 0 ? i.copy(t) : lN.setFromPoints(e).getCenter(i);
    let r = 0;
    for (let s = 0, o = e.length; s < o; s++)
      r = Math.max(r, i.distanceToSquared(e[s]));
    return ((this.radius = Math.sqrt(r)), this);
  }
  copy(e) {
    return (this.center.copy(e.center), (this.radius = e.radius), this);
  }
  isEmpty() {
    return this.radius < 0;
  }
  makeEmpty() {
    return (this.center.set(0, 0, 0), (this.radius = -1), this);
  }
  containsPoint(e) {
    return e.distanceToSquared(this.center) <= this.radius * this.radius;
  }
  distanceToPoint(e) {
    return e.distanceTo(this.center) - this.radius;
  }
  intersectsSphere(e) {
    const t = this.radius + e.radius;
    return e.center.distanceToSquared(this.center) <= t * t;
  }
  intersectsBox(e) {
    return e.intersectsSphere(this);
  }
  intersectsPlane(e) {
    return Math.abs(e.distanceToPoint(this.center)) <= this.radius;
  }
  clampPoint(e, t) {
    const i = this.center.distanceToSquared(e);
    return (
      t.copy(e),
      i > this.radius * this.radius &&
        (t.sub(this.center).normalize(),
        t.multiplyScalar(this.radius).add(this.center)),
      t
    );
  }
  getBoundingBox(e) {
    return this.isEmpty()
      ? (e.makeEmpty(), e)
      : (e.set(this.center, this.center), e.expandByScalar(this.radius), e);
  }
  applyMatrix4(e) {
    return (
      this.center.applyMatrix4(e),
      (this.radius = this.radius * e.getMaxScaleOnAxis()),
      this
    );
  }
  translate(e) {
    return (this.center.add(e), this);
  }
  expandByPoint(e) {
    if (this.isEmpty()) return (this.center.copy(e), (this.radius = 0), this);
    Fr.subVectors(e, this.center);
    const t = Fr.lengthSq();
    if (t > this.radius * this.radius) {
      const i = Math.sqrt(t),
        r = (i - this.radius) * 0.5;
      (this.center.addScaledVector(Fr, r / i), (this.radius += r));
    }
    return this;
  }
  union(e) {
    return e.isEmpty()
      ? this
      : this.isEmpty()
        ? (this.copy(e), this)
        : (this.center.equals(e.center) === !0
            ? (this.radius = Math.max(this.radius, e.radius))
            : ($7.subVectors(e.center, this.center).setLength(e.radius),
              this.expandByPoint(Fr.copy(e.center).add($7)),
              this.expandByPoint(Fr.copy(e.center).sub($7))),
          this);
  }
  equals(e) {
    return e.center.equals(this.center) && e.radius === this.radius;
  }
  clone() {
    return new this.constructor().copy(this);
  }
  toJSON() {
    return { radius: this.radius, center: this.center.toArray() };
  }
  fromJSON(e) {
    return ((this.radius = e.radius), this.center.fromArray(e.center), this);
  }
}
const w5 = new H(),
  W7 = new H(),
  Oa = new H(),
  mn = new H(),
  H7 = new H(),
  za = new H(),
  q7 = new H();
class uN {
  constructor(e = new H(), t = new H(0, 0, -1)) {
    ((this.origin = e), (this.direction = t));
  }
  set(e, t) {
    return (this.origin.copy(e), this.direction.copy(t), this);
  }
  copy(e) {
    return (this.origin.copy(e.origin), this.direction.copy(e.direction), this);
  }
  at(e, t) {
    return t.copy(this.origin).addScaledVector(this.direction, e);
  }
  lookAt(e) {
    return (this.direction.copy(e).sub(this.origin).normalize(), this);
  }
  recast(e) {
    return (this.origin.copy(this.at(e, w5)), this);
  }
  closestPointToPoint(e, t) {
    t.subVectors(e, this.origin);
    const i = t.dot(this.direction);
    return i < 0
      ? t.copy(this.origin)
      : t.copy(this.origin).addScaledVector(this.direction, i);
  }
  distanceToPoint(e) {
    return Math.sqrt(this.distanceSqToPoint(e));
  }
  distanceSqToPoint(e) {
    const t = w5.subVectors(e, this.origin).dot(this.direction);
    return t < 0
      ? this.origin.distanceToSquared(e)
      : (w5.copy(this.origin).addScaledVector(this.direction, t),
        w5.distanceToSquared(e));
  }
  distanceSqToSegment(e, t, i, r) {
    (W7.copy(e).add(t).multiplyScalar(0.5),
      Oa.copy(t).sub(e).normalize(),
      mn.copy(this.origin).sub(W7));
    const s = e.distanceTo(t) * 0.5,
      o = -this.direction.dot(Oa),
      a = mn.dot(this.direction),
      c = -mn.dot(Oa),
      l = mn.lengthSq(),
      u = Math.abs(1 - o * o);
    let h, d, f, p;
    if (u > 0)
      if (((h = o * c - a), (d = o * a - c), (p = s * u), h >= 0))
        if (d >= -p)
          if (d <= p) {
            const v = 1 / u;
            ((h *= v),
              (d *= v),
              (f = h * (h + o * d + 2 * a) + d * (o * h + d + 2 * c) + l));
          } else
            ((d = s),
              (h = Math.max(0, -(o * d + a))),
              (f = -h * h + d * (d + 2 * c) + l));
        else
          ((d = -s),
            (h = Math.max(0, -(o * d + a))),
            (f = -h * h + d * (d + 2 * c) + l));
      else
        d <= -p
          ? ((h = Math.max(0, -(-o * s + a))),
            (d = h > 0 ? -s : Math.min(Math.max(-s, -c), s)),
            (f = -h * h + d * (d + 2 * c) + l))
          : d <= p
            ? ((h = 0),
              (d = Math.min(Math.max(-s, -c), s)),
              (f = d * (d + 2 * c) + l))
            : ((h = Math.max(0, -(o * s + a))),
              (d = h > 0 ? s : Math.min(Math.max(-s, -c), s)),
              (f = -h * h + d * (d + 2 * c) + l));
    else
      ((d = o > 0 ? -s : s),
        (h = Math.max(0, -(o * d + a))),
        (f = -h * h + d * (d + 2 * c) + l));
    return (
      i && i.copy(this.origin).addScaledVector(this.direction, h),
      r && r.copy(W7).addScaledVector(Oa, d),
      f
    );
  }
  intersectSphere(e, t) {
    w5.subVectors(e.center, this.origin);
    const i = w5.dot(this.direction),
      r = w5.dot(w5) - i * i,
      s = e.radius * e.radius;
    if (r > s) return null;
    const o = Math.sqrt(s - r),
      a = i - o,
      c = i + o;
    return c < 0 ? null : a < 0 ? this.at(c, t) : this.at(a, t);
  }
  intersectsSphere(e) {
    return e.radius < 0
      ? !1
      : this.distanceSqToPoint(e.center) <= e.radius * e.radius;
  }
  distanceToPlane(e) {
    const t = e.normal.dot(this.direction);
    if (t === 0) return e.distanceToPoint(this.origin) === 0 ? 0 : null;
    const i = -(this.origin.dot(e.normal) + e.constant) / t;
    return i >= 0 ? i : null;
  }
  intersectPlane(e, t) {
    const i = this.distanceToPlane(e);
    return i === null ? null : this.at(i, t);
  }
  intersectsPlane(e) {
    const t = e.distanceToPoint(this.origin);
    return t === 0 || e.normal.dot(this.direction) * t < 0;
  }
  intersectBox(e, t) {
    let i, r, s, o, a, c;
    const l = 1 / this.direction.x,
      u = 1 / this.direction.y,
      h = 1 / this.direction.z,
      d = this.origin;
    return (
      l >= 0
        ? ((i = (e.min.x - d.x) * l), (r = (e.max.x - d.x) * l))
        : ((i = (e.max.x - d.x) * l), (r = (e.min.x - d.x) * l)),
      u >= 0
        ? ((s = (e.min.y - d.y) * u), (o = (e.max.y - d.y) * u))
        : ((s = (e.max.y - d.y) * u), (o = (e.min.y - d.y) * u)),
      i > o ||
      s > r ||
      ((s > i || isNaN(i)) && (i = s),
      (o < r || isNaN(r)) && (r = o),
      h >= 0
        ? ((a = (e.min.z - d.z) * h), (c = (e.max.z - d.z) * h))
        : ((a = (e.max.z - d.z) * h), (c = (e.min.z - d.z) * h)),
      i > c || a > r) ||
      ((a > i || i !== i) && (i = a), (c < r || r !== r) && (r = c), r < 0)
        ? null
        : this.at(i >= 0 ? i : r, t)
    );
  }
  intersectsBox(e) {
    return this.intersectBox(e, w5) !== null;
  }
  intersectTriangle(e, t, i, r, s) {
    (H7.subVectors(t, e), za.subVectors(i, e), q7.crossVectors(H7, za));
    let o = this.direction.dot(q7),
      a;
    if (o > 0) {
      if (r) return null;
      a = 1;
    } else if (o < 0) ((a = -1), (o = -o));
    else return null;
    mn.subVectors(this.origin, e);
    const c = a * this.direction.dot(za.crossVectors(mn, za));
    if (c < 0) return null;
    const l = a * this.direction.dot(H7.cross(mn));
    if (l < 0 || c + l > o) return null;
    const u = -a * mn.dot(q7);
    return u < 0 ? null : this.at(u / o, s);
  }
  applyMatrix4(e) {
    return (
      this.origin.applyMatrix4(e),
      this.direction.transformDirection(e),
      this
    );
  }
  equals(e) {
    return e.origin.equals(this.origin) && e.direction.equals(this.direction);
  }
  clone() {
    return new this.constructor().copy(this);
  }
}
class v2 {
  constructor(e, t, i, r, s, o, a, c, l, u, h, d, f, p, v, w) {
    ((v2.prototype.isMatrix4 = !0),
      (this.elements = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
      e !== void 0 && this.set(e, t, i, r, s, o, a, c, l, u, h, d, f, p, v, w));
  }
  set(e, t, i, r, s, o, a, c, l, u, h, d, f, p, v, w) {
    const g = this.elements;
    return (
      (g[0] = e),
      (g[4] = t),
      (g[8] = i),
      (g[12] = r),
      (g[1] = s),
      (g[5] = o),
      (g[9] = a),
      (g[13] = c),
      (g[2] = l),
      (g[6] = u),
      (g[10] = h),
      (g[14] = d),
      (g[3] = f),
      (g[7] = p),
      (g[11] = v),
      (g[15] = w),
      this
    );
  }
  identity() {
    return (this.set(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1), this);
  }
  clone() {
    return new v2().fromArray(this.elements);
  }
  copy(e) {
    const t = this.elements,
      i = e.elements;
    return (
      (t[0] = i[0]),
      (t[1] = i[1]),
      (t[2] = i[2]),
      (t[3] = i[3]),
      (t[4] = i[4]),
      (t[5] = i[5]),
      (t[6] = i[6]),
      (t[7] = i[7]),
      (t[8] = i[8]),
      (t[9] = i[9]),
      (t[10] = i[10]),
      (t[11] = i[11]),
      (t[12] = i[12]),
      (t[13] = i[13]),
      (t[14] = i[14]),
      (t[15] = i[15]),
      this
    );
  }
  copyPosition(e) {
    const t = this.elements,
      i = e.elements;
    return ((t[12] = i[12]), (t[13] = i[13]), (t[14] = i[14]), this);
  }
  setFromMatrix3(e) {
    const t = e.elements;
    return (
      this.set(
        t[0],
        t[3],
        t[6],
        0,
        t[1],
        t[4],
        t[7],
        0,
        t[2],
        t[5],
        t[8],
        0,
        0,
        0,
        0,
        1,
      ),
      this
    );
  }
  extractBasis(e, t, i) {
    return (
      e.setFromMatrixColumn(this, 0),
      t.setFromMatrixColumn(this, 1),
      i.setFromMatrixColumn(this, 2),
      this
    );
  }
  makeBasis(e, t, i) {
    return (
      this.set(
        e.x,
        t.x,
        i.x,
        0,
        e.y,
        t.y,
        i.y,
        0,
        e.z,
        t.z,
        i.z,
        0,
        0,
        0,
        0,
        1,
      ),
      this
    );
  }
  extractRotation(e) {
    const t = this.elements,
      i = e.elements,
      r = 1 / W4.setFromMatrixColumn(e, 0).length(),
      s = 1 / W4.setFromMatrixColumn(e, 1).length(),
      o = 1 / W4.setFromMatrixColumn(e, 2).length();
    return (
      (t[0] = i[0] * r),
      (t[1] = i[1] * r),
      (t[2] = i[2] * r),
      (t[3] = 0),
      (t[4] = i[4] * s),
      (t[5] = i[5] * s),
      (t[6] = i[6] * s),
      (t[7] = 0),
      (t[8] = i[8] * o),
      (t[9] = i[9] * o),
      (t[10] = i[10] * o),
      (t[11] = 0),
      (t[12] = 0),
      (t[13] = 0),
      (t[14] = 0),
      (t[15] = 1),
      this
    );
  }
  makeRotationFromEuler(e) {
    const t = this.elements,
      i = e.x,
      r = e.y,
      s = e.z,
      o = Math.cos(i),
      a = Math.sin(i),
      c = Math.cos(r),
      l = Math.sin(r),
      u = Math.cos(s),
      h = Math.sin(s);
    if (e.order === "XYZ") {
      const d = o * u,
        f = o * h,
        p = a * u,
        v = a * h;
      ((t[0] = c * u),
        (t[4] = -c * h),
        (t[8] = l),
        (t[1] = f + p * l),
        (t[5] = d - v * l),
        (t[9] = -a * c),
        (t[2] = v - d * l),
        (t[6] = p + f * l),
        (t[10] = o * c));
    } else if (e.order === "YXZ") {
      const d = c * u,
        f = c * h,
        p = l * u,
        v = l * h;
      ((t[0] = d + v * a),
        (t[4] = p * a - f),
        (t[8] = o * l),
        (t[1] = o * h),
        (t[5] = o * u),
        (t[9] = -a),
        (t[2] = f * a - p),
        (t[6] = v + d * a),
        (t[10] = o * c));
    } else if (e.order === "ZXY") {
      const d = c * u,
        f = c * h,
        p = l * u,
        v = l * h;
      ((t[0] = d - v * a),
        (t[4] = -o * h),
        (t[8] = p + f * a),
        (t[1] = f + p * a),
        (t[5] = o * u),
        (t[9] = v - d * a),
        (t[2] = -o * l),
        (t[6] = a),
        (t[10] = o * c));
    } else if (e.order === "ZYX") {
      const d = o * u,
        f = o * h,
        p = a * u,
        v = a * h;
      ((t[0] = c * u),
        (t[4] = p * l - f),
        (t[8] = d * l + v),
        (t[1] = c * h),
        (t[5] = v * l + d),
        (t[9] = f * l - p),
        (t[2] = -l),
        (t[6] = a * c),
        (t[10] = o * c));
    } else if (e.order === "YZX") {
      const d = o * c,
        f = o * l,
        p = a * c,
        v = a * l;
      ((t[0] = c * u),
        (t[4] = v - d * h),
        (t[8] = p * h + f),
        (t[1] = h),
        (t[5] = o * u),
        (t[9] = -a * u),
        (t[2] = -l * u),
        (t[6] = f * h + p),
        (t[10] = d - v * h));
    } else if (e.order === "XZY") {
      const d = o * c,
        f = o * l,
        p = a * c,
        v = a * l;
      ((t[0] = c * u),
        (t[4] = -h),
        (t[8] = l * u),
        (t[1] = d * h + v),
        (t[5] = o * u),
        (t[9] = f * h - p),
        (t[2] = p * h - f),
        (t[6] = a * u),
        (t[10] = v * h + d));
    }
    return (
      (t[3] = 0),
      (t[7] = 0),
      (t[11] = 0),
      (t[12] = 0),
      (t[13] = 0),
      (t[14] = 0),
      (t[15] = 1),
      this
    );
  }
  makeRotationFromQuaternion(e) {
    return this.compose(hN, e, dN);
  }
  lookAt(e, t, i) {
    const r = this.elements;
    return (
      Ee.subVectors(e, t),
      Ee.lengthSq() === 0 && (Ee.z = 1),
      Ee.normalize(),
      wn.crossVectors(i, Ee),
      wn.lengthSq() === 0 &&
        (Math.abs(i.z) === 1 ? (Ee.x += 1e-4) : (Ee.z += 1e-4),
        Ee.normalize(),
        wn.crossVectors(i, Ee)),
      wn.normalize(),
      Ua.crossVectors(Ee, wn),
      (r[0] = wn.x),
      (r[4] = Ua.x),
      (r[8] = Ee.x),
      (r[1] = wn.y),
      (r[5] = Ua.y),
      (r[9] = Ee.y),
      (r[2] = wn.z),
      (r[6] = Ua.z),
      (r[10] = Ee.z),
      this
    );
  }
  multiply(e) {
    return this.multiplyMatrices(this, e);
  }
  premultiply(e) {
    return this.multiplyMatrices(e, this);
  }
  multiplyMatrices(e, t) {
    const i = e.elements,
      r = t.elements,
      s = this.elements,
      o = i[0],
      a = i[4],
      c = i[8],
      l = i[12],
      u = i[1],
      h = i[5],
      d = i[9],
      f = i[13],
      p = i[2],
      v = i[6],
      w = i[10],
      g = i[14],
      y = i[3],
      b = i[7],
      A = i[11],
      x = i[15],
      M = r[0],
      E = r[4],
      _ = r[8],
      C = r[12],
      S = r[1],
      G = r[5],
      I = r[9],
      L = r[13],
      k = r[2],
      D = r[6],
      V = r[10],
      K = r[14],
      P = r[3],
      q = r[7],
      e0 = r[11],
      Q = r[15];
    return (
      (s[0] = o * M + a * S + c * k + l * P),
      (s[4] = o * E + a * G + c * D + l * q),
      (s[8] = o * _ + a * I + c * V + l * e0),
      (s[12] = o * C + a * L + c * K + l * Q),
      (s[1] = u * M + h * S + d * k + f * P),
      (s[5] = u * E + h * G + d * D + f * q),
      (s[9] = u * _ + h * I + d * V + f * e0),
      (s[13] = u * C + h * L + d * K + f * Q),
      (s[2] = p * M + v * S + w * k + g * P),
      (s[6] = p * E + v * G + w * D + g * q),
      (s[10] = p * _ + v * I + w * V + g * e0),
      (s[14] = p * C + v * L + w * K + g * Q),
      (s[3] = y * M + b * S + A * k + x * P),
      (s[7] = y * E + b * G + A * D + x * q),
      (s[11] = y * _ + b * I + A * V + x * e0),
      (s[15] = y * C + b * L + A * K + x * Q),
      this
    );
  }
  multiplyScalar(e) {
    const t = this.elements;
    return (
      (t[0] *= e),
      (t[4] *= e),
      (t[8] *= e),
      (t[12] *= e),
      (t[1] *= e),
      (t[5] *= e),
      (t[9] *= e),
      (t[13] *= e),
      (t[2] *= e),
      (t[6] *= e),
      (t[10] *= e),
      (t[14] *= e),
      (t[3] *= e),
      (t[7] *= e),
      (t[11] *= e),
      (t[15] *= e),
      this
    );
  }
  determinant() {
    const e = this.elements,
      t = e[0],
      i = e[4],
      r = e[8],
      s = e[12],
      o = e[1],
      a = e[5],
      c = e[9],
      l = e[13],
      u = e[2],
      h = e[6],
      d = e[10],
      f = e[14],
      p = e[3],
      v = e[7],
      w = e[11],
      g = e[15];
    return (
      p *
        (+s * c * h -
          r * l * h -
          s * a * d +
          i * l * d +
          r * a * f -
          i * c * f) +
      v *
        (+t * c * f -
          t * l * d +
          s * o * d -
          r * o * f +
          r * l * u -
          s * c * u) +
      w *
        (+t * l * h -
          t * a * f -
          s * o * h +
          i * o * f +
          s * a * u -
          i * l * u) +
      g *
        (-r * a * u - t * c * h + t * a * d + r * o * h - i * o * d + i * c * u)
    );
  }
  transpose() {
    const e = this.elements;
    let t;
    return (
      (t = e[1]),
      (e[1] = e[4]),
      (e[4] = t),
      (t = e[2]),
      (e[2] = e[8]),
      (e[8] = t),
      (t = e[6]),
      (e[6] = e[9]),
      (e[9] = t),
      (t = e[3]),
      (e[3] = e[12]),
      (e[12] = t),
      (t = e[7]),
      (e[7] = e[13]),
      (e[13] = t),
      (t = e[11]),
      (e[11] = e[14]),
      (e[14] = t),
      this
    );
  }
  setPosition(e, t, i) {
    const r = this.elements;
    return (
      e.isVector3
        ? ((r[12] = e.x), (r[13] = e.y), (r[14] = e.z))
        : ((r[12] = e), (r[13] = t), (r[14] = i)),
      this
    );
  }
  invert() {
    const e = this.elements,
      t = e[0],
      i = e[1],
      r = e[2],
      s = e[3],
      o = e[4],
      a = e[5],
      c = e[6],
      l = e[7],
      u = e[8],
      h = e[9],
      d = e[10],
      f = e[11],
      p = e[12],
      v = e[13],
      w = e[14],
      g = e[15],
      y = h * w * l - v * d * l + v * c * f - a * w * f - h * c * g + a * d * g,
      b = p * d * l - u * w * l - p * c * f + o * w * f + u * c * g - o * d * g,
      A = u * v * l - p * h * l + p * a * f - o * v * f - u * a * g + o * h * g,
      x = p * h * c - u * v * c - p * a * d + o * v * d + u * a * w - o * h * w,
      M = t * y + i * b + r * A + s * x;
    if (M === 0)
      return this.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    const E = 1 / M;
    return (
      (e[0] = y * E),
      (e[1] =
        (v * d * s -
          h * w * s -
          v * r * f +
          i * w * f +
          h * r * g -
          i * d * g) *
        E),
      (e[2] =
        (a * w * s -
          v * c * s +
          v * r * l -
          i * w * l -
          a * r * g +
          i * c * g) *
        E),
      (e[3] =
        (h * c * s -
          a * d * s -
          h * r * l +
          i * d * l +
          a * r * f -
          i * c * f) *
        E),
      (e[4] = b * E),
      (e[5] =
        (u * w * s -
          p * d * s +
          p * r * f -
          t * w * f -
          u * r * g +
          t * d * g) *
        E),
      (e[6] =
        (p * c * s -
          o * w * s -
          p * r * l +
          t * w * l +
          o * r * g -
          t * c * g) *
        E),
      (e[7] =
        (o * d * s -
          u * c * s +
          u * r * l -
          t * d * l -
          o * r * f +
          t * c * f) *
        E),
      (e[8] = A * E),
      (e[9] =
        (p * h * s -
          u * v * s -
          p * i * f +
          t * v * f +
          u * i * g -
          t * h * g) *
        E),
      (e[10] =
        (o * v * s -
          p * a * s +
          p * i * l -
          t * v * l -
          o * i * g +
          t * a * g) *
        E),
      (e[11] =
        (u * a * s -
          o * h * s -
          u * i * l +
          t * h * l +
          o * i * f -
          t * a * f) *
        E),
      (e[12] = x * E),
      (e[13] =
        (u * v * r -
          p * h * r +
          p * i * d -
          t * v * d -
          u * i * w +
          t * h * w) *
        E),
      (e[14] =
        (p * a * r -
          o * v * r -
          p * i * c +
          t * v * c +
          o * i * w -
          t * a * w) *
        E),
      (e[15] =
        (o * h * r -
          u * a * r +
          u * i * c -
          t * h * c -
          o * i * d +
          t * a * d) *
        E),
      this
    );
  }
  scale(e) {
    const t = this.elements,
      i = e.x,
      r = e.y,
      s = e.z;
    return (
      (t[0] *= i),
      (t[4] *= r),
      (t[8] *= s),
      (t[1] *= i),
      (t[5] *= r),
      (t[9] *= s),
      (t[2] *= i),
      (t[6] *= r),
      (t[10] *= s),
      (t[3] *= i),
      (t[7] *= r),
      (t[11] *= s),
      this
    );
  }
  getMaxScaleOnAxis() {
    const e = this.elements,
      t = e[0] * e[0] + e[1] * e[1] + e[2] * e[2],
      i = e[4] * e[4] + e[5] * e[5] + e[6] * e[6],
      r = e[8] * e[8] + e[9] * e[9] + e[10] * e[10];
    return Math.sqrt(Math.max(t, i, r));
  }
  makeTranslation(e, t, i) {
    return (
      e.isVector3
        ? this.set(1, 0, 0, e.x, 0, 1, 0, e.y, 0, 0, 1, e.z, 0, 0, 0, 1)
        : this.set(1, 0, 0, e, 0, 1, 0, t, 0, 0, 1, i, 0, 0, 0, 1),
      this
    );
  }
  makeRotationX(e) {
    const t = Math.cos(e),
      i = Math.sin(e);
    return (this.set(1, 0, 0, 0, 0, t, -i, 0, 0, i, t, 0, 0, 0, 0, 1), this);
  }
  makeRotationY(e) {
    const t = Math.cos(e),
      i = Math.sin(e);
    return (this.set(t, 0, i, 0, 0, 1, 0, 0, -i, 0, t, 0, 0, 0, 0, 1), this);
  }
  makeRotationZ(e) {
    const t = Math.cos(e),
      i = Math.sin(e);
    return (this.set(t, -i, 0, 0, i, t, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1), this);
  }
  makeRotationAxis(e, t) {
    const i = Math.cos(t),
      r = Math.sin(t),
      s = 1 - i,
      o = e.x,
      a = e.y,
      c = e.z,
      l = s * o,
      u = s * a;
    return (
      this.set(
        l * o + i,
        l * a - r * c,
        l * c + r * a,
        0,
        l * a + r * c,
        u * a + i,
        u * c - r * o,
        0,
        l * c - r * a,
        u * c + r * o,
        s * c * c + i,
        0,
        0,
        0,
        0,
        1,
      ),
      this
    );
  }
  makeScale(e, t, i) {
    return (this.set(e, 0, 0, 0, 0, t, 0, 0, 0, 0, i, 0, 0, 0, 0, 1), this);
  }
  makeShear(e, t, i, r, s, o) {
    return (this.set(1, i, s, 0, e, 1, o, 0, t, r, 1, 0, 0, 0, 0, 1), this);
  }
  compose(e, t, i) {
    const r = this.elements,
      s = t._x,
      o = t._y,
      a = t._z,
      c = t._w,
      l = s + s,
      u = o + o,
      h = a + a,
      d = s * l,
      f = s * u,
      p = s * h,
      v = o * u,
      w = o * h,
      g = a * h,
      y = c * l,
      b = c * u,
      A = c * h,
      x = i.x,
      M = i.y,
      E = i.z;
    return (
      (r[0] = (1 - (v + g)) * x),
      (r[1] = (f + A) * x),
      (r[2] = (p - b) * x),
      (r[3] = 0),
      (r[4] = (f - A) * M),
      (r[5] = (1 - (d + g)) * M),
      (r[6] = (w + y) * M),
      (r[7] = 0),
      (r[8] = (p + b) * E),
      (r[9] = (w - y) * E),
      (r[10] = (1 - (d + v)) * E),
      (r[11] = 0),
      (r[12] = e.x),
      (r[13] = e.y),
      (r[14] = e.z),
      (r[15] = 1),
      this
    );
  }
  decompose(e, t, i) {
    const r = this.elements;
    let s = W4.set(r[0], r[1], r[2]).length();
    const o = W4.set(r[4], r[5], r[6]).length(),
      a = W4.set(r[8], r[9], r[10]).length();
    (this.determinant() < 0 && (s = -s),
      (e.x = r[12]),
      (e.y = r[13]),
      (e.z = r[14]),
      gt.copy(this));
    const l = 1 / s,
      u = 1 / o,
      h = 1 / a;
    return (
      (gt.elements[0] *= l),
      (gt.elements[1] *= l),
      (gt.elements[2] *= l),
      (gt.elements[4] *= u),
      (gt.elements[5] *= u),
      (gt.elements[6] *= u),
      (gt.elements[8] *= h),
      (gt.elements[9] *= h),
      (gt.elements[10] *= h),
      t.setFromRotationMatrix(gt),
      (i.x = s),
      (i.y = o),
      (i.z = a),
      this
    );
  }
  makePerspective(e, t, i, r, s, o, a = W5) {
    const c = this.elements,
      l = (2 * s) / (t - e),
      u = (2 * s) / (i - r),
      h = (t + e) / (t - e),
      d = (i + r) / (i - r);
    let f, p;
    if (a === W5) ((f = -(o + s) / (o - s)), (p = (-2 * o * s) / (o - s)));
    else if (a === Il) ((f = -o / (o - s)), (p = (-o * s) / (o - s)));
    else
      throw new Error(
        "THREE.Matrix4.makePerspective(): Invalid coordinate system: " + a,
      );
    return (
      (c[0] = l),
      (c[4] = 0),
      (c[8] = h),
      (c[12] = 0),
      (c[1] = 0),
      (c[5] = u),
      (c[9] = d),
      (c[13] = 0),
      (c[2] = 0),
      (c[6] = 0),
      (c[10] = f),
      (c[14] = p),
      (c[3] = 0),
      (c[7] = 0),
      (c[11] = -1),
      (c[15] = 0),
      this
    );
  }
  makeOrthographic(e, t, i, r, s, o, a = W5) {
    const c = this.elements,
      l = 1 / (t - e),
      u = 1 / (i - r),
      h = 1 / (o - s),
      d = (t + e) * l,
      f = (i + r) * u;
    let p, v;
    if (a === W5) ((p = (o + s) * h), (v = -2 * h));
    else if (a === Il) ((p = s * h), (v = -1 * h));
    else
      throw new Error(
        "THREE.Matrix4.makeOrthographic(): Invalid coordinate system: " + a,
      );
    return (
      (c[0] = 2 * l),
      (c[4] = 0),
      (c[8] = 0),
      (c[12] = -d),
      (c[1] = 0),
      (c[5] = 2 * u),
      (c[9] = 0),
      (c[13] = -f),
      (c[2] = 0),
      (c[6] = 0),
      (c[10] = v),
      (c[14] = -p),
      (c[3] = 0),
      (c[7] = 0),
      (c[11] = 0),
      (c[15] = 1),
      this
    );
  }
  equals(e) {
    const t = this.elements,
      i = e.elements;
    for (let r = 0; r < 16; r++) if (t[r] !== i[r]) return !1;
    return !0;
  }
  fromArray(e, t = 0) {
    for (let i = 0; i < 16; i++) this.elements[i] = e[i + t];
    return this;
  }
  toArray(e = [], t = 0) {
    const i = this.elements;
    return (
      (e[t] = i[0]),
      (e[t + 1] = i[1]),
      (e[t + 2] = i[2]),
      (e[t + 3] = i[3]),
      (e[t + 4] = i[4]),
      (e[t + 5] = i[5]),
      (e[t + 6] = i[6]),
      (e[t + 7] = i[7]),
      (e[t + 8] = i[8]),
      (e[t + 9] = i[9]),
      (e[t + 10] = i[10]),
      (e[t + 11] = i[11]),
      (e[t + 12] = i[12]),
      (e[t + 13] = i[13]),
      (e[t + 14] = i[14]),
      (e[t + 15] = i[15]),
      e
    );
  }
}
const W4 = new H(),
  gt = new v2(),
  hN = new H(0, 0, 0),
  dN = new H(1, 1, 1),
  wn = new H(),
  Ua = new H(),
  Ee = new H(),
  oA = new v2(),
  aA = new s5();
class o5 {
  constructor(e = 0, t = 0, i = 0, r = o5.DEFAULT_ORDER) {
    ((this.isEuler = !0),
      (this._x = e),
      (this._y = t),
      (this._z = i),
      (this._order = r));
  }
  get x() {
    return this._x;
  }
  set x(e) {
    ((this._x = e), this._onChangeCallback());
  }
  get y() {
    return this._y;
  }
  set y(e) {
    ((this._y = e), this._onChangeCallback());
  }
  get z() {
    return this._z;
  }
  set z(e) {
    ((this._z = e), this._onChangeCallback());
  }
  get order() {
    return this._order;
  }
  set order(e) {
    ((this._order = e), this._onChangeCallback());
  }
  set(e, t, i, r = this._order) {
    return (
      (this._x = e),
      (this._y = t),
      (this._z = i),
      (this._order = r),
      this._onChangeCallback(),
      this
    );
  }
  clone() {
    return new this.constructor(this._x, this._y, this._z, this._order);
  }
  copy(e) {
    return (
      (this._x = e._x),
      (this._y = e._y),
      (this._z = e._z),
      (this._order = e._order),
      this._onChangeCallback(),
      this
    );
  }
  setFromRotationMatrix(e, t = this._order, i = !0) {
    const r = e.elements,
      s = r[0],
      o = r[4],
      a = r[8],
      c = r[1],
      l = r[5],
      u = r[9],
      h = r[2],
      d = r[6],
      f = r[10];
    switch (t) {
      case "XYZ":
        ((this._y = Math.asin(J2(a, -1, 1))),
          Math.abs(a) < 0.9999999
            ? ((this._x = Math.atan2(-u, f)), (this._z = Math.atan2(-o, s)))
            : ((this._x = Math.atan2(d, l)), (this._z = 0)));
        break;
      case "YXZ":
        ((this._x = Math.asin(-J2(u, -1, 1))),
          Math.abs(u) < 0.9999999
            ? ((this._y = Math.atan2(a, f)), (this._z = Math.atan2(c, l)))
            : ((this._y = Math.atan2(-h, s)), (this._z = 0)));
        break;
      case "ZXY":
        ((this._x = Math.asin(J2(d, -1, 1))),
          Math.abs(d) < 0.9999999
            ? ((this._y = Math.atan2(-h, f)), (this._z = Math.atan2(-o, l)))
            : ((this._y = 0), (this._z = Math.atan2(c, s))));
        break;
      case "ZYX":
        ((this._y = Math.asin(-J2(h, -1, 1))),
          Math.abs(h) < 0.9999999
            ? ((this._x = Math.atan2(d, f)), (this._z = Math.atan2(c, s)))
            : ((this._x = 0), (this._z = Math.atan2(-o, l))));
        break;
      case "YZX":
        ((this._z = Math.asin(J2(c, -1, 1))),
          Math.abs(c) < 0.9999999
            ? ((this._x = Math.atan2(-u, l)), (this._y = Math.atan2(-h, s)))
            : ((this._x = 0), (this._y = Math.atan2(a, f))));
        break;
      case "XZY":
        ((this._z = Math.asin(-J2(o, -1, 1))),
          Math.abs(o) < 0.9999999
            ? ((this._x = Math.atan2(d, l)), (this._y = Math.atan2(a, s)))
            : ((this._x = Math.atan2(-u, f)), (this._y = 0)));
        break;
      default:
        console.warn(
          "THREE.Euler: .setFromRotationMatrix() encountered an unknown order: " +
            t,
        );
    }
    return ((this._order = t), i === !0 && this._onChangeCallback(), this);
  }
  setFromQuaternion(e, t, i) {
    return (
      oA.makeRotationFromQuaternion(e),
      this.setFromRotationMatrix(oA, t, i)
    );
  }
  setFromVector3(e, t = this._order) {
    return this.set(e.x, e.y, e.z, t);
  }
  reorder(e) {
    return (aA.setFromEuler(this), this.setFromQuaternion(aA, e));
  }
  equals(e) {
    return (
      e._x === this._x &&
      e._y === this._y &&
      e._z === this._z &&
      e._order === this._order
    );
  }
  fromArray(e) {
    return (
      (this._x = e[0]),
      (this._y = e[1]),
      (this._z = e[2]),
      e[3] !== void 0 && (this._order = e[3]),
      this._onChangeCallback(),
      this
    );
  }
  toArray(e = [], t = 0) {
    return (
      (e[t] = this._x),
      (e[t + 1] = this._y),
      (e[t + 2] = this._z),
      (e[t + 3] = this._order),
      e
    );
  }
  _onChange(e) {
    return ((this._onChangeCallback = e), this);
  }
  _onChangeCallback() {}
  *[Symbol.iterator]() {
    (yield this._x, yield this._y, yield this._z, yield this._order);
  }
}
o5.DEFAULT_ORDER = "XYZ";
class bG {
  constructor() {
    this.mask = 1;
  }
  set(e) {
    this.mask = ((1 << e) | 0) >>> 0;
  }
  enable(e) {
    this.mask |= (1 << e) | 0;
  }
  enableAll() {
    this.mask = -1;
  }
  toggle(e) {
    this.mask ^= (1 << e) | 0;
  }
  disable(e) {
    this.mask &= ~((1 << e) | 0);
  }
  disableAll() {
    this.mask = 0;
  }
  test(e) {
    return (this.mask & e.mask) !== 0;
  }
  isEnabled(e) {
    return (this.mask & ((1 << e) | 0)) !== 0;
  }
}
let fN = 0;
const cA = new H(),
  H4 = new s5(),
  v5 = new v2(),
  $a = new H(),
  Dr = new H(),
  pN = new H(),
  gN = new s5(),
  lA = new H(1, 0, 0),
  uA = new H(0, 1, 0),
  hA = new H(0, 0, 1),
  dA = { type: "added" },
  mN = { type: "removed" },
  q4 = { type: "childadded", child: null },
  K7 = { type: "childremoved", child: null };
class Me extends vr {
  constructor() {
    (super(),
      (this.isObject3D = !0),
      Object.defineProperty(this, "id", { value: fN++ }),
      (this.uuid = Y5()),
      (this.name = ""),
      (this.type = "Object3D"),
      (this.parent = null),
      (this.children = []),
      (this.up = Me.DEFAULT_UP.clone()));
    const e = new H(),
      t = new o5(),
      i = new s5(),
      r = new H(1, 1, 1);
    function s() {
      i.setFromEuler(t, !1);
    }
    function o() {
      t.setFromQuaternion(i, void 0, !1);
    }
    (t._onChange(s),
      i._onChange(o),
      Object.defineProperties(this, {
        position: { configurable: !0, enumerable: !0, value: e },
        rotation: { configurable: !0, enumerable: !0, value: t },
        quaternion: { configurable: !0, enumerable: !0, value: i },
        scale: { configurable: !0, enumerable: !0, value: r },
        modelViewMatrix: { value: new v2() },
        normalMatrix: { value: new W2() },
      }),
      (this.matrix = new v2()),
      (this.matrixWorld = new v2()),
      (this.matrixAutoUpdate = Me.DEFAULT_MATRIX_AUTO_UPDATE),
      (this.matrixWorldAutoUpdate = Me.DEFAULT_MATRIX_WORLD_AUTO_UPDATE),
      (this.matrixWorldNeedsUpdate = !1),
      (this.layers = new bG()),
      (this.visible = !0),
      (this.castShadow = !1),
      (this.receiveShadow = !1),
      (this.frustumCulled = !0),
      (this.renderOrder = 0),
      (this.animations = []),
      (this.customDepthMaterial = void 0),
      (this.customDistanceMaterial = void 0),
      (this.userData = {}));
  }
  onBeforeShadow() {}
  onAfterShadow() {}
  onBeforeRender() {}
  onAfterRender() {}
  applyMatrix4(e) {
    (this.matrixAutoUpdate && this.updateMatrix(),
      this.matrix.premultiply(e),
      this.matrix.decompose(this.position, this.quaternion, this.scale));
  }
  applyQuaternion(e) {
    return (this.quaternion.premultiply(e), this);
  }
  setRotationFromAxisAngle(e, t) {
    this.quaternion.setFromAxisAngle(e, t);
  }
  setRotationFromEuler(e) {
    this.quaternion.setFromEuler(e, !0);
  }
  setRotationFromMatrix(e) {
    this.quaternion.setFromRotationMatrix(e);
  }
  setRotationFromQuaternion(e) {
    this.quaternion.copy(e);
  }
  rotateOnAxis(e, t) {
    return (H4.setFromAxisAngle(e, t), this.quaternion.multiply(H4), this);
  }
  rotateOnWorldAxis(e, t) {
    return (H4.setFromAxisAngle(e, t), this.quaternion.premultiply(H4), this);
  }
  rotateX(e) {
    return this.rotateOnAxis(lA, e);
  }
  rotateY(e) {
    return this.rotateOnAxis(uA, e);
  }
  rotateZ(e) {
    return this.rotateOnAxis(hA, e);
  }
  translateOnAxis(e, t) {
    return (
      cA.copy(e).applyQuaternion(this.quaternion),
      this.position.add(cA.multiplyScalar(t)),
      this
    );
  }
  translateX(e) {
    return this.translateOnAxis(lA, e);
  }
  translateY(e) {
    return this.translateOnAxis(uA, e);
  }
  translateZ(e) {
    return this.translateOnAxis(hA, e);
  }
  localToWorld(e) {
    return (this.updateWorldMatrix(!0, !1), e.applyMatrix4(this.matrixWorld));
  }
  worldToLocal(e) {
    return (
      this.updateWorldMatrix(!0, !1),
      e.applyMatrix4(v5.copy(this.matrixWorld).invert())
    );
  }
  lookAt(e, t, i) {
    e.isVector3 ? $a.copy(e) : $a.set(e, t, i);
    const r = this.parent;
    (this.updateWorldMatrix(!0, !1),
      Dr.setFromMatrixPosition(this.matrixWorld),
      this.isCamera || this.isLight
        ? v5.lookAt(Dr, $a, this.up)
        : v5.lookAt($a, Dr, this.up),
      this.quaternion.setFromRotationMatrix(v5),
      r &&
        (v5.extractRotation(r.matrixWorld),
        H4.setFromRotationMatrix(v5),
        this.quaternion.premultiply(H4.invert())));
  }
  add(e) {
    if (arguments.length > 1) {
      for (let t = 0; t < arguments.length; t++) this.add(arguments[t]);
      return this;
    }
    return e === this
      ? (console.error(
          "THREE.Object3D.add: object can't be added as a child of itself.",
          e,
        ),
        this)
      : (e && e.isObject3D
          ? (e.removeFromParent(),
            (e.parent = this),
            this.children.push(e),
            e.dispatchEvent(dA),
            (q4.child = e),
            this.dispatchEvent(q4),
            (q4.child = null))
          : console.error(
              "THREE.Object3D.add: object not an instance of THREE.Object3D.",
              e,
            ),
        this);
  }
  remove(e) {
    if (arguments.length > 1) {
      for (let i = 0; i < arguments.length; i++) this.remove(arguments[i]);
      return this;
    }
    const t = this.children.indexOf(e);
    return (
      t !== -1 &&
        ((e.parent = null),
        this.children.splice(t, 1),
        e.dispatchEvent(mN),
        (K7.child = e),
        this.dispatchEvent(K7),
        (K7.child = null)),
      this
    );
  }
  removeFromParent() {
    const e = this.parent;
    return (e !== null && e.remove(this), this);
  }
  clear() {
    return this.remove(...this.children);
  }
  attach(e) {
    return (
      this.updateWorldMatrix(!0, !1),
      v5.copy(this.matrixWorld).invert(),
      e.parent !== null &&
        (e.parent.updateWorldMatrix(!0, !1), v5.multiply(e.parent.matrixWorld)),
      e.applyMatrix4(v5),
      e.removeFromParent(),
      (e.parent = this),
      this.children.push(e),
      e.updateWorldMatrix(!1, !0),
      e.dispatchEvent(dA),
      (q4.child = e),
      this.dispatchEvent(q4),
      (q4.child = null),
      this
    );
  }
  getObjectById(e) {
    return this.getObjectByProperty("id", e);
  }
  getObjectByName(e) {
    return this.getObjectByProperty("name", e);
  }
  getObjectByProperty(e, t) {
    if (this[e] === t) return this;
    for (let i = 0, r = this.children.length; i < r; i++) {
      const o = this.children[i].getObjectByProperty(e, t);
      if (o !== void 0) return o;
    }
  }
  getObjectsByProperty(e, t, i = []) {
    this[e] === t && i.push(this);
    const r = this.children;
    for (let s = 0, o = r.length; s < o; s++)
      r[s].getObjectsByProperty(e, t, i);
    return i;
  }
  getWorldPosition(e) {
    return (
      this.updateWorldMatrix(!0, !1),
      e.setFromMatrixPosition(this.matrixWorld)
    );
  }
  getWorldQuaternion(e) {
    return (
      this.updateWorldMatrix(!0, !1),
      this.matrixWorld.decompose(Dr, e, pN),
      e
    );
  }
  getWorldScale(e) {
    return (
      this.updateWorldMatrix(!0, !1),
      this.matrixWorld.decompose(Dr, gN, e),
      e
    );
  }
  getWorldDirection(e) {
    this.updateWorldMatrix(!0, !1);
    const t = this.matrixWorld.elements;
    return e.set(t[8], t[9], t[10]).normalize();
  }
  raycast() {}
  traverse(e) {
    e(this);
    const t = this.children;
    for (let i = 0, r = t.length; i < r; i++) t[i].traverse(e);
  }
  traverseVisible(e) {
    if (this.visible === !1) return;
    e(this);
    const t = this.children;
    for (let i = 0, r = t.length; i < r; i++) t[i].traverseVisible(e);
  }
  traverseAncestors(e) {
    const t = this.parent;
    t !== null && (e(t), t.traverseAncestors(e));
  }
  updateMatrix() {
    (this.matrix.compose(this.position, this.quaternion, this.scale),
      (this.matrixWorldNeedsUpdate = !0));
  }
  updateMatrixWorld(e) {
    (this.matrixAutoUpdate && this.updateMatrix(),
      (this.matrixWorldNeedsUpdate || e) &&
        (this.matrixWorldAutoUpdate === !0 &&
          (this.parent === null
            ? this.matrixWorld.copy(this.matrix)
            : this.matrixWorld.multiplyMatrices(
                this.parent.matrixWorld,
                this.matrix,
              )),
        (this.matrixWorldNeedsUpdate = !1),
        (e = !0)));
    const t = this.children;
    for (let i = 0, r = t.length; i < r; i++) t[i].updateMatrixWorld(e);
  }
  updateWorldMatrix(e, t) {
    const i = this.parent;
    if (
      (e === !0 && i !== null && i.updateWorldMatrix(!0, !1),
      this.matrixAutoUpdate && this.updateMatrix(),
      this.matrixWorldAutoUpdate === !0 &&
        (this.parent === null
          ? this.matrixWorld.copy(this.matrix)
          : this.matrixWorld.multiplyMatrices(
              this.parent.matrixWorld,
              this.matrix,
            )),
      t === !0)
    ) {
      const r = this.children;
      for (let s = 0, o = r.length; s < o; s++) r[s].updateWorldMatrix(!1, !0);
    }
  }
  toJSON(e) {
    const t = e === void 0 || typeof e == "string",
      i = {};
    t &&
      ((e = {
        geometries: {},
        materials: {},
        textures: {},
        images: {},
        shapes: {},
        skeletons: {},
        animations: {},
        nodes: {},
      }),
      (i.metadata = {
        version: 4.7,
        type: "Object",
        generator: "Object3D.toJSON",
      }));
    const r = {};
    ((r.uuid = this.uuid),
      (r.type = this.type),
      this.name !== "" && (r.name = this.name),
      this.castShadow === !0 && (r.castShadow = !0),
      this.receiveShadow === !0 && (r.receiveShadow = !0),
      this.visible === !1 && (r.visible = !1),
      this.frustumCulled === !1 && (r.frustumCulled = !1),
      this.renderOrder !== 0 && (r.renderOrder = this.renderOrder),
      Object.keys(this.userData).length > 0 && (r.userData = this.userData),
      (r.layers = this.layers.mask),
      (r.matrix = this.matrix.toArray()),
      (r.up = this.up.toArray()),
      this.matrixAutoUpdate === !1 && (r.matrixAutoUpdate = !1),
      this.isInstancedMesh &&
        ((r.type = "InstancedMesh"),
        (r.count = this.count),
        (r.instanceMatrix = this.instanceMatrix.toJSON()),
        this.instanceColor !== null &&
          (r.instanceColor = this.instanceColor.toJSON())),
      this.isBatchedMesh &&
        ((r.type = "BatchedMesh"),
        (r.perObjectFrustumCulled = this.perObjectFrustumCulled),
        (r.sortObjects = this.sortObjects),
        (r.drawRanges = this._drawRanges),
        (r.reservedRanges = this._reservedRanges),
        (r.geometryInfo = this._geometryInfo.map((a) => ({
          ...a,
          boundingBox: a.boundingBox ? a.boundingBox.toJSON() : void 0,
          boundingSphere: a.boundingSphere ? a.boundingSphere.toJSON() : void 0,
        }))),
        (r.instanceInfo = this._instanceInfo.map((a) => ({ ...a }))),
        (r.availableInstanceIds = this._availableInstanceIds.slice()),
        (r.availableGeometryIds = this._availableGeometryIds.slice()),
        (r.nextIndexStart = this._nextIndexStart),
        (r.nextVertexStart = this._nextVertexStart),
        (r.geometryCount = this._geometryCount),
        (r.maxInstanceCount = this._maxInstanceCount),
        (r.maxVertexCount = this._maxVertexCount),
        (r.maxIndexCount = this._maxIndexCount),
        (r.geometryInitialized = this._geometryInitialized),
        (r.matricesTexture = this._matricesTexture.toJSON(e)),
        (r.indirectTexture = this._indirectTexture.toJSON(e)),
        this._colorsTexture !== null &&
          (r.colorsTexture = this._colorsTexture.toJSON(e)),
        this.boundingSphere !== null &&
          (r.boundingSphere = this.boundingSphere.toJSON()),
        this.boundingBox !== null &&
          (r.boundingBox = this.boundingBox.toJSON())));
    function s(a, c) {
      return (a[c.uuid] === void 0 && (a[c.uuid] = c.toJSON(e)), c.uuid);
    }
    if (this.isScene)
      (this.background &&
        (this.background.isColor
          ? (r.background = this.background.toJSON())
          : this.background.isTexture &&
            (r.background = this.background.toJSON(e).uuid)),
        this.environment &&
          this.environment.isTexture &&
          this.environment.isRenderTargetTexture !== !0 &&
          (r.environment = this.environment.toJSON(e).uuid));
    else if (this.isMesh || this.isLine || this.isPoints) {
      r.geometry = s(e.geometries, this.geometry);
      const a = this.geometry.parameters;
      if (a !== void 0 && a.shapes !== void 0) {
        const c = a.shapes;
        if (Array.isArray(c))
          for (let l = 0, u = c.length; l < u; l++) {
            const h = c[l];
            s(e.shapes, h);
          }
        else s(e.shapes, c);
      }
    }
    if (
      (this.isSkinnedMesh &&
        ((r.bindMode = this.bindMode),
        (r.bindMatrix = this.bindMatrix.toArray()),
        this.skeleton !== void 0 &&
          (s(e.skeletons, this.skeleton), (r.skeleton = this.skeleton.uuid))),
      this.material !== void 0)
    )
      if (Array.isArray(this.material)) {
        const a = [];
        for (let c = 0, l = this.material.length; c < l; c++)
          a.push(s(e.materials, this.material[c]));
        r.material = a;
      } else r.material = s(e.materials, this.material);
    if (this.children.length > 0) {
      r.children = [];
      for (let a = 0; a < this.children.length; a++)
        r.children.push(this.children[a].toJSON(e).object);
    }
    if (this.animations.length > 0) {
      r.animations = [];
      for (let a = 0; a < this.animations.length; a++) {
        const c = this.animations[a];
        r.animations.push(s(e.animations, c));
      }
    }
    if (t) {
      const a = o(e.geometries),
        c = o(e.materials),
        l = o(e.textures),
        u = o(e.images),
        h = o(e.shapes),
        d = o(e.skeletons),
        f = o(e.animations),
        p = o(e.nodes);
      (a.length > 0 && (i.geometries = a),
        c.length > 0 && (i.materials = c),
        l.length > 0 && (i.textures = l),
        u.length > 0 && (i.images = u),
        h.length > 0 && (i.shapes = h),
        d.length > 0 && (i.skeletons = d),
        f.length > 0 && (i.animations = f),
        p.length > 0 && (i.nodes = p));
    }
    return ((i.object = r), i);
    function o(a) {
      const c = [];
      for (const l in a) {
        const u = a[l];
        (delete u.metadata, c.push(u));
      }
      return c;
    }
  }
  clone(e) {
    return new this.constructor().copy(this, e);
  }
  copy(e, t = !0) {
    if (
      ((this.name = e.name),
      this.up.copy(e.up),
      this.position.copy(e.position),
      (this.rotation.order = e.rotation.order),
      this.quaternion.copy(e.quaternion),
      this.scale.copy(e.scale),
      this.matrix.copy(e.matrix),
      this.matrixWorld.copy(e.matrixWorld),
      (this.matrixAutoUpdate = e.matrixAutoUpdate),
      (this.matrixWorldAutoUpdate = e.matrixWorldAutoUpdate),
      (this.matrixWorldNeedsUpdate = e.matrixWorldNeedsUpdate),
      (this.layers.mask = e.layers.mask),
      (this.visible = e.visible),
      (this.castShadow = e.castShadow),
      (this.receiveShadow = e.receiveShadow),
      (this.frustumCulled = e.frustumCulled),
      (this.renderOrder = e.renderOrder),
      (this.animations = e.animations.slice()),
      (this.userData = JSON.parse(JSON.stringify(e.userData))),
      t === !0)
    )
      for (let i = 0; i < e.children.length; i++) {
        const r = e.children[i];
        this.add(r.clone());
      }
    return this;
  }
}
Me.DEFAULT_UP = new H(0, 1, 0);
Me.DEFAULT_MATRIX_AUTO_UPDATE = !0;
Me.DEFAULT_MATRIX_WORLD_AUTO_UPDATE = !0;
const mt = new H(),
  y5 = new H(),
  j7 = new H(),
  A5 = new H(),
  K4 = new H(),
  j4 = new H(),
  fA = new H(),
  X7 = new H(),
  Y7 = new H(),
  Z7 = new H(),
  Q7 = new Y2(),
  J7 = new Y2(),
  eu = new Y2();
class it {
  constructor(e = new H(), t = new H(), i = new H()) {
    ((this.a = e), (this.b = t), (this.c = i));
  }
  static getNormal(e, t, i, r) {
    (r.subVectors(i, t), mt.subVectors(e, t), r.cross(mt));
    const s = r.lengthSq();
    return s > 0 ? r.multiplyScalar(1 / Math.sqrt(s)) : r.set(0, 0, 0);
  }
  static getBarycoord(e, t, i, r, s) {
    (mt.subVectors(r, t), y5.subVectors(i, t), j7.subVectors(e, t));
    const o = mt.dot(mt),
      a = mt.dot(y5),
      c = mt.dot(j7),
      l = y5.dot(y5),
      u = y5.dot(j7),
      h = o * l - a * a;
    if (h === 0) return (s.set(0, 0, 0), null);
    const d = 1 / h,
      f = (l * c - a * u) * d,
      p = (o * u - a * c) * d;
    return s.set(1 - f - p, p, f);
  }
  static containsPoint(e, t, i, r) {
    return this.getBarycoord(e, t, i, r, A5) === null
      ? !1
      : A5.x >= 0 && A5.y >= 0 && A5.x + A5.y <= 1;
  }
  static getInterpolation(e, t, i, r, s, o, a, c) {
    return this.getBarycoord(e, t, i, r, A5) === null
      ? ((c.x = 0),
        (c.y = 0),
        "z" in c && (c.z = 0),
        "w" in c && (c.w = 0),
        null)
      : (c.setScalar(0),
        c.addScaledVector(s, A5.x),
        c.addScaledVector(o, A5.y),
        c.addScaledVector(a, A5.z),
        c);
  }
  static getInterpolatedAttribute(e, t, i, r, s, o) {
    return (
      Q7.setScalar(0),
      J7.setScalar(0),
      eu.setScalar(0),
      Q7.fromBufferAttribute(e, t),
      J7.fromBufferAttribute(e, i),
      eu.fromBufferAttribute(e, r),
      o.setScalar(0),
      o.addScaledVector(Q7, s.x),
      o.addScaledVector(J7, s.y),
      o.addScaledVector(eu, s.z),
      o
    );
  }
  static isFrontFacing(e, t, i, r) {
    return (mt.subVectors(i, t), y5.subVectors(e, t), mt.cross(y5).dot(r) < 0);
  }
  set(e, t, i) {
    return (this.a.copy(e), this.b.copy(t), this.c.copy(i), this);
  }
  setFromPointsAndIndices(e, t, i, r) {
    return (this.a.copy(e[t]), this.b.copy(e[i]), this.c.copy(e[r]), this);
  }
  setFromAttributeAndIndices(e, t, i, r) {
    return (
      this.a.fromBufferAttribute(e, t),
      this.b.fromBufferAttribute(e, i),
      this.c.fromBufferAttribute(e, r),
      this
    );
  }
  clone() {
    return new this.constructor().copy(this);
  }
  copy(e) {
    return (this.a.copy(e.a), this.b.copy(e.b), this.c.copy(e.c), this);
  }
  getArea() {
    return (
      mt.subVectors(this.c, this.b),
      y5.subVectors(this.a, this.b),
      mt.cross(y5).length() * 0.5
    );
  }
  getMidpoint(e) {
    return e
      .addVectors(this.a, this.b)
      .add(this.c)
      .multiplyScalar(1 / 3);
  }
  getNormal(e) {
    return it.getNormal(this.a, this.b, this.c, e);
  }
  getPlane(e) {
    return e.setFromCoplanarPoints(this.a, this.b, this.c);
  }
  getBarycoord(e, t) {
    return it.getBarycoord(e, this.a, this.b, this.c, t);
  }
  getInterpolation(e, t, i, r, s) {
    return it.getInterpolation(e, this.a, this.b, this.c, t, i, r, s);
  }
  containsPoint(e) {
    return it.containsPoint(e, this.a, this.b, this.c);
  }
  isFrontFacing(e) {
    return it.isFrontFacing(this.a, this.b, this.c, e);
  }
  intersectsBox(e) {
    return e.intersectsTriangle(this);
  }
  closestPointToPoint(e, t) {
    const i = this.a,
      r = this.b,
      s = this.c;
    let o, a;
    (K4.subVectors(r, i), j4.subVectors(s, i), X7.subVectors(e, i));
    const c = K4.dot(X7),
      l = j4.dot(X7);
    if (c <= 0 && l <= 0) return t.copy(i);
    Y7.subVectors(e, r);
    const u = K4.dot(Y7),
      h = j4.dot(Y7);
    if (u >= 0 && h <= u) return t.copy(r);
    const d = c * h - u * l;
    if (d <= 0 && c >= 0 && u <= 0)
      return ((o = c / (c - u)), t.copy(i).addScaledVector(K4, o));
    Z7.subVectors(e, s);
    const f = K4.dot(Z7),
      p = j4.dot(Z7);
    if (p >= 0 && f <= p) return t.copy(s);
    const v = f * l - c * p;
    if (v <= 0 && l >= 0 && p <= 0)
      return ((a = l / (l - p)), t.copy(i).addScaledVector(j4, a));
    const w = u * p - f * h;
    if (w <= 0 && h - u >= 0 && f - p >= 0)
      return (
        fA.subVectors(s, r),
        (a = (h - u) / (h - u + (f - p))),
        t.copy(r).addScaledVector(fA, a)
      );
    const g = 1 / (w + v + d);
    return (
      (o = v * g),
      (a = d * g),
      t.copy(i).addScaledVector(K4, o).addScaledVector(j4, a)
    );
  }
  equals(e) {
    return e.a.equals(this.a) && e.b.equals(this.b) && e.c.equals(this.c);
  }
}
const MG = {
    aliceblue: 15792383,
    antiquewhite: 16444375,
    aqua: 65535,
    aquamarine: 8388564,
    azure: 15794175,
    beige: 16119260,
    bisque: 16770244,
    black: 0,
    blanchedalmond: 16772045,
    blue: 255,
    blueviolet: 9055202,
    brown: 10824234,
    burlywood: 14596231,
    cadetblue: 6266528,
    chartreuse: 8388352,
    chocolate: 13789470,
    coral: 16744272,
    cornflowerblue: 6591981,
    cornsilk: 16775388,
    crimson: 14423100,
    cyan: 65535,
    darkblue: 139,
    darkcyan: 35723,
    darkgoldenrod: 12092939,
    darkgray: 11119017,
    darkgreen: 25600,
    darkgrey: 11119017,
    darkkhaki: 12433259,
    darkmagenta: 9109643,
    darkolivegreen: 5597999,
    darkorange: 16747520,
    darkorchid: 10040012,
    darkred: 9109504,
    darksalmon: 15308410,
    darkseagreen: 9419919,
    darkslateblue: 4734347,
    darkslategray: 3100495,
    darkslategrey: 3100495,
    darkturquoise: 52945,
    darkviolet: 9699539,
    deeppink: 16716947,
    deepskyblue: 49151,
    dimgray: 6908265,
    dimgrey: 6908265,
    dodgerblue: 2003199,
    firebrick: 11674146,
    floralwhite: 16775920,
    forestgreen: 2263842,
    fuchsia: 16711935,
    gainsboro: 14474460,
    ghostwhite: 16316671,
    gold: 16766720,
    goldenrod: 14329120,
    gray: 8421504,
    green: 32768,
    greenyellow: 11403055,
    grey: 8421504,
    honeydew: 15794160,
    hotpink: 16738740,
    indianred: 13458524,
    indigo: 4915330,
    ivory: 16777200,
    khaki: 15787660,
    lavender: 15132410,
    lavenderblush: 16773365,
    lawngreen: 8190976,
    lemonchiffon: 16775885,
    lightblue: 11393254,
    lightcoral: 15761536,
    lightcyan: 14745599,
    lightgoldenrodyellow: 16448210,
    lightgray: 13882323,
    lightgreen: 9498256,
    lightgrey: 13882323,
    lightpink: 16758465,
    lightsalmon: 16752762,
    lightseagreen: 2142890,
    lightskyblue: 8900346,
    lightslategray: 7833753,
    lightslategrey: 7833753,
    lightsteelblue: 11584734,
    lightyellow: 16777184,
    lime: 65280,
    limegreen: 3329330,
    linen: 16445670,
    magenta: 16711935,
    maroon: 8388608,
    mediumaquamarine: 6737322,
    mediumblue: 205,
    mediumorchid: 12211667,
    mediumpurple: 9662683,
    mediumseagreen: 3978097,
    mediumslateblue: 8087790,
    mediumspringgreen: 64154,
    mediumturquoise: 4772300,
    mediumvioletred: 13047173,
    midnightblue: 1644912,
    mintcream: 16121850,
    mistyrose: 16770273,
    moccasin: 16770229,
    navajowhite: 16768685,
    navy: 128,
    oldlace: 16643558,
    olive: 8421376,
    olivedrab: 7048739,
    orange: 16753920,
    orangered: 16729344,
    orchid: 14315734,
    palegoldenrod: 15657130,
    palegreen: 10025880,
    paleturquoise: 11529966,
    palevioletred: 14381203,
    papayawhip: 16773077,
    peachpuff: 16767673,
    peru: 13468991,
    pink: 16761035,
    plum: 14524637,
    powderblue: 11591910,
    purple: 8388736,
    rebeccapurple: 6697881,
    red: 16711680,
    rosybrown: 12357519,
    royalblue: 4286945,
    saddlebrown: 9127187,
    salmon: 16416882,
    sandybrown: 16032864,
    seagreen: 3050327,
    seashell: 16774638,
    sienna: 10506797,
    silver: 12632256,
    skyblue: 8900331,
    slateblue: 6970061,
    slategray: 7372944,
    slategrey: 7372944,
    snow: 16775930,
    springgreen: 65407,
    steelblue: 4620980,
    tan: 13808780,
    teal: 32896,
    thistle: 14204888,
    tomato: 16737095,
    turquoise: 4251856,
    violet: 15631086,
    wheat: 16113331,
    white: 16777215,
    whitesmoke: 16119285,
    yellow: 16776960,
    yellowgreen: 10145074,
  },
  vn = { h: 0, s: 0, l: 0 },
  Wa = { h: 0, s: 0, l: 0 };
function tu(n, e, t) {
  return (
    t < 0 && (t += 1),
    t > 1 && (t -= 1),
    t < 1 / 6
      ? n + (e - n) * 6 * t
      : t < 1 / 2
        ? e
        : t < 2 / 3
          ? n + (e - n) * 6 * (2 / 3 - t)
          : n
  );
}
class r9 {
  constructor(e, t, i) {
    return (
      (this.isColor = !0),
      (this.r = 1),
      (this.g = 1),
      (this.b = 1),
      this.set(e, t, i)
    );
  }
  set(e, t, i) {
    if (t === void 0 && i === void 0) {
      const r = e;
      r && r.isColor
        ? this.copy(r)
        : typeof r == "number"
          ? this.setHex(r)
          : typeof r == "string" && this.setStyle(r);
    } else this.setRGB(e, t, i);
    return this;
  }
  setScalar(e) {
    return ((this.r = e), (this.g = e), (this.b = e), this);
  }
  setHex(e, t = Fe) {
    return (
      (e = Math.floor(e)),
      (this.r = ((e >> 16) & 255) / 255),
      (this.g = ((e >> 8) & 255) / 255),
      (this.b = (e & 255) / 255),
      f9.colorSpaceToWorking(this, t),
      this
    );
  }
  setRGB(e, t, i, r = f9.workingColorSpace) {
    return (
      (this.r = e),
      (this.g = t),
      (this.b = i),
      f9.colorSpaceToWorking(this, r),
      this
    );
  }
  setHSL(e, t, i, r = f9.workingColorSpace) {
    if (((e = Im(e, 1)), (t = J2(t, 0, 1)), (i = J2(i, 0, 1)), t === 0))
      this.r = this.g = this.b = i;
    else {
      const s = i <= 0.5 ? i * (1 + t) : i + t - i * t,
        o = 2 * i - s;
      ((this.r = tu(o, s, e + 1 / 3)),
        (this.g = tu(o, s, e)),
        (this.b = tu(o, s, e - 1 / 3)));
    }
    return (f9.colorSpaceToWorking(this, r), this);
  }
  setStyle(e, t = Fe) {
    function i(s) {
      s !== void 0 &&
        parseFloat(s) < 1 &&
        console.warn(
          "THREE.Color: Alpha component of " + e + " will be ignored.",
        );
    }
    let r;
    if ((r = /^(\w+)\(([^\)]*)\)/.exec(e))) {
      let s;
      const o = r[1],
        a = r[2];
      switch (o) {
        case "rgb":
        case "rgba":
          if (
            (s =
              /^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(
                a,
              ))
          )
            return (
              i(s[4]),
              this.setRGB(
                Math.min(255, parseInt(s[1], 10)) / 255,
                Math.min(255, parseInt(s[2], 10)) / 255,
                Math.min(255, parseInt(s[3], 10)) / 255,
                t,
              )
            );
          if (
            (s =
              /^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(
                a,
              ))
          )
            return (
              i(s[4]),
              this.setRGB(
                Math.min(100, parseInt(s[1], 10)) / 100,
                Math.min(100, parseInt(s[2], 10)) / 100,
                Math.min(100, parseInt(s[3], 10)) / 100,
                t,
              )
            );
          break;
        case "hsl":
        case "hsla":
          if (
            (s =
              /^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(
                a,
              ))
          )
            return (
              i(s[4]),
              this.setHSL(
                parseFloat(s[1]) / 360,
                parseFloat(s[2]) / 100,
                parseFloat(s[3]) / 100,
                t,
              )
            );
          break;
        default:
          console.warn("THREE.Color: Unknown color model " + e);
      }
    } else if ((r = /^\#([A-Fa-f\d]+)$/.exec(e))) {
      const s = r[1],
        o = s.length;
      if (o === 3)
        return this.setRGB(
          parseInt(s.charAt(0), 16) / 15,
          parseInt(s.charAt(1), 16) / 15,
          parseInt(s.charAt(2), 16) / 15,
          t,
        );
      if (o === 6) return this.setHex(parseInt(s, 16), t);
      console.warn("THREE.Color: Invalid hex color " + e);
    } else if (e && e.length > 0) return this.setColorName(e, t);
    return this;
  }
  setColorName(e, t = Fe) {
    const i = MG[e.toLowerCase()];
    return (
      i !== void 0
        ? this.setHex(i, t)
        : console.warn("THREE.Color: Unknown color " + e),
      this
    );
  }
  clone() {
    return new this.constructor(this.r, this.g, this.b);
  }
  copy(e) {
    return ((this.r = e.r), (this.g = e.g), (this.b = e.b), this);
  }
  copySRGBToLinear(e) {
    return ((this.r = Z5(e.r)), (this.g = Z5(e.g)), (this.b = Z5(e.b)), this);
  }
  copyLinearToSRGB(e) {
    return ((this.r = Ki(e.r)), (this.g = Ki(e.g)), (this.b = Ki(e.b)), this);
  }
  convertSRGBToLinear() {
    return (this.copySRGBToLinear(this), this);
  }
  convertLinearToSRGB() {
    return (this.copyLinearToSRGB(this), this);
  }
  getHex(e = Fe) {
    return (
      f9.workingToColorSpace(q1.copy(this), e),
      Math.round(J2(q1.r * 255, 0, 255)) * 65536 +
        Math.round(J2(q1.g * 255, 0, 255)) * 256 +
        Math.round(J2(q1.b * 255, 0, 255))
    );
  }
  getHexString(e = Fe) {
    return ("000000" + this.getHex(e).toString(16)).slice(-6);
  }
  getHSL(e, t = f9.workingColorSpace) {
    f9.workingToColorSpace(q1.copy(this), t);
    const i = q1.r,
      r = q1.g,
      s = q1.b,
      o = Math.max(i, r, s),
      a = Math.min(i, r, s);
    let c, l;
    const u = (a + o) / 2;
    if (a === o) ((c = 0), (l = 0));
    else {
      const h = o - a;
      switch (((l = u <= 0.5 ? h / (o + a) : h / (2 - o - a)), o)) {
        case i:
          c = (r - s) / h + (r < s ? 6 : 0);
          break;
        case r:
          c = (s - i) / h + 2;
          break;
        case s:
          c = (i - r) / h + 4;
          break;
      }
      c /= 6;
    }
    return ((e.h = c), (e.s = l), (e.l = u), e);
  }
  getRGB(e, t = f9.workingColorSpace) {
    return (
      f9.workingToColorSpace(q1.copy(this), t),
      (e.r = q1.r),
      (e.g = q1.g),
      (e.b = q1.b),
      e
    );
  }
  getStyle(e = Fe) {
    f9.workingToColorSpace(q1.copy(this), e);
    const t = q1.r,
      i = q1.g,
      r = q1.b;
    return e !== Fe
      ? `color(${e} ${t.toFixed(3)} ${i.toFixed(3)} ${r.toFixed(3)})`
      : `rgb(${Math.round(t * 255)},${Math.round(i * 255)},${Math.round(r * 255)})`;
  }
  offsetHSL(e, t, i) {
    return (this.getHSL(vn), this.setHSL(vn.h + e, vn.s + t, vn.l + i));
  }
  add(e) {
    return ((this.r += e.r), (this.g += e.g), (this.b += e.b), this);
  }
  addColors(e, t) {
    return (
      (this.r = e.r + t.r),
      (this.g = e.g + t.g),
      (this.b = e.b + t.b),
      this
    );
  }
  addScalar(e) {
    return ((this.r += e), (this.g += e), (this.b += e), this);
  }
  sub(e) {
    return (
      (this.r = Math.max(0, this.r - e.r)),
      (this.g = Math.max(0, this.g - e.g)),
      (this.b = Math.max(0, this.b - e.b)),
      this
    );
  }
  multiply(e) {
    return ((this.r *= e.r), (this.g *= e.g), (this.b *= e.b), this);
  }
  multiplyScalar(e) {
    return ((this.r *= e), (this.g *= e), (this.b *= e), this);
  }
  lerp(e, t) {
    return (
      (this.r += (e.r - this.r) * t),
      (this.g += (e.g - this.g) * t),
      (this.b += (e.b - this.b) * t),
      this
    );
  }
  lerpColors(e, t, i) {
    return (
      (this.r = e.r + (t.r - e.r) * i),
      (this.g = e.g + (t.g - e.g) * i),
      (this.b = e.b + (t.b - e.b) * i),
      this
    );
  }
  lerpHSL(e, t) {
    (this.getHSL(vn), e.getHSL(Wa));
    const i = Is(vn.h, Wa.h, t),
      r = Is(vn.s, Wa.s, t),
      s = Is(vn.l, Wa.l, t);
    return (this.setHSL(i, r, s), this);
  }
  setFromVector3(e) {
    return ((this.r = e.x), (this.g = e.y), (this.b = e.z), this);
  }
  applyMatrix3(e) {
    const t = this.r,
      i = this.g,
      r = this.b,
      s = e.elements;
    return (
      (this.r = s[0] * t + s[3] * i + s[6] * r),
      (this.g = s[1] * t + s[4] * i + s[7] * r),
      (this.b = s[2] * t + s[5] * i + s[8] * r),
      this
    );
  }
  equals(e) {
    return e.r === this.r && e.g === this.g && e.b === this.b;
  }
  fromArray(e, t = 0) {
    return ((this.r = e[t]), (this.g = e[t + 1]), (this.b = e[t + 2]), this);
  }
  toArray(e = [], t = 0) {
    return ((e[t] = this.r), (e[t + 1] = this.g), (e[t + 2] = this.b), e);
  }
  fromBufferAttribute(e, t) {
    return (
      (this.r = e.getX(t)),
      (this.g = e.getY(t)),
      (this.b = e.getZ(t)),
      this
    );
  }
  toJSON() {
    return this.getHex();
  }
  *[Symbol.iterator]() {
    (yield this.r, yield this.g, yield this.b);
  }
}
const q1 = new r9();
r9.NAMES = MG;
let wN = 0;
class oa extends vr {
  constructor() {
    (super(),
      (this.isMaterial = !0),
      Object.defineProperty(this, "id", { value: wN++ }),
      (this.uuid = Y5()),
      (this.name = ""),
      (this.type = "Material"),
      (this.blending = X5),
      (this.side = tn),
      (this.vertexColors = !1),
      (this.opacity = 1),
      (this.transparent = !1),
      (this.alphaHash = !1),
      (this.blendSrc = l1),
      (this.blendDst = v1),
      (this.blendEquation = R9),
      (this.blendSrcAlpha = null),
      (this.blendDstAlpha = null),
      (this.blendEquationAlpha = null),
      (this.blendColor = new r9(0, 0, 0)),
      (this.blendAlpha = 0),
      (this.depthFunc = y1),
      (this.depthTest = !0),
      (this.depthWrite = !0),
      (this.stencilWriteMask = 255),
      (this.stencilFunc = Jy),
      (this.stencilRef = 0),
      (this.stencilFuncMask = 255),
      (this.stencilFail = N4),
      (this.stencilZFail = N4),
      (this.stencilZPass = N4),
      (this.stencilWrite = !1),
      (this.clippingPlanes = null),
      (this.clipIntersection = !1),
      (this.clipShadows = !1),
      (this.shadowSide = null),
      (this.colorWrite = !0),
      (this.precision = null),
      (this.polygonOffset = !1),
      (this.polygonOffsetFactor = 0),
      (this.polygonOffsetUnits = 0),
      (this.dithering = !1),
      (this.alphaToCoverage = !1),
      (this.premultipliedAlpha = !1),
      (this.forceSinglePass = !1),
      (this.allowOverride = !0),
      (this.visible = !0),
      (this.toneMapped = !0),
      (this.userData = {}),
      (this.version = 0),
      (this._alphaTest = 0));
  }
  get alphaTest() {
    return this._alphaTest;
  }
  set alphaTest(e) {
    (this._alphaTest > 0 != e > 0 && this.version++, (this._alphaTest = e));
  }
  onBeforeRender() {}
  onBeforeCompile() {}
  customProgramCacheKey() {
    return this.onBeforeCompile.toString();
  }
  setValues(e) {
    if (e !== void 0)
      for (const t in e) {
        const i = e[t];
        if (i === void 0) {
          console.warn(
            `THREE.Material: parameter '${t}' has value of undefined.`,
          );
          continue;
        }
        const r = this[t];
        if (r === void 0) {
          console.warn(
            `THREE.Material: '${t}' is not a property of THREE.${this.type}.`,
          );
          continue;
        }
        r && r.isColor
          ? r.set(i)
          : r && r.isVector3 && i && i.isVector3
            ? r.copy(i)
            : (this[t] = i);
      }
  }
  toJSON(e) {
    const t = e === void 0 || typeof e == "string";
    t && (e = { textures: {}, images: {} });
    const i = {
      metadata: {
        version: 4.7,
        type: "Material",
        generator: "Material.toJSON",
      },
    };
    ((i.uuid = this.uuid),
      (i.type = this.type),
      this.name !== "" && (i.name = this.name),
      this.color && this.color.isColor && (i.color = this.color.getHex()),
      this.roughness !== void 0 && (i.roughness = this.roughness),
      this.metalness !== void 0 && (i.metalness = this.metalness),
      this.sheen !== void 0 && (i.sheen = this.sheen),
      this.sheenColor &&
        this.sheenColor.isColor &&
        (i.sheenColor = this.sheenColor.getHex()),
      this.sheenRoughness !== void 0 &&
        (i.sheenRoughness = this.sheenRoughness),
      this.emissive &&
        this.emissive.isColor &&
        (i.emissive = this.emissive.getHex()),
      this.emissiveIntensity !== void 0 &&
        this.emissiveIntensity !== 1 &&
        (i.emissiveIntensity = this.emissiveIntensity),
      this.specular &&
        this.specular.isColor &&
        (i.specular = this.specular.getHex()),
      this.specularIntensity !== void 0 &&
        (i.specularIntensity = this.specularIntensity),
      this.specularColor &&
        this.specularColor.isColor &&
        (i.specularColor = this.specularColor.getHex()),
      this.shininess !== void 0 && (i.shininess = this.shininess),
      this.clearcoat !== void 0 && (i.clearcoat = this.clearcoat),
      this.clearcoatRoughness !== void 0 &&
        (i.clearcoatRoughness = this.clearcoatRoughness),
      this.clearcoatMap &&
        this.clearcoatMap.isTexture &&
        (i.clearcoatMap = this.clearcoatMap.toJSON(e).uuid),
      this.clearcoatRoughnessMap &&
        this.clearcoatRoughnessMap.isTexture &&
        (i.clearcoatRoughnessMap = this.clearcoatRoughnessMap.toJSON(e).uuid),
      this.clearcoatNormalMap &&
        this.clearcoatNormalMap.isTexture &&
        ((i.clearcoatNormalMap = this.clearcoatNormalMap.toJSON(e).uuid),
        (i.clearcoatNormalScale = this.clearcoatNormalScale.toArray())),
      this.dispersion !== void 0 && (i.dispersion = this.dispersion),
      this.iridescence !== void 0 && (i.iridescence = this.iridescence),
      this.iridescenceIOR !== void 0 &&
        (i.iridescenceIOR = this.iridescenceIOR),
      this.iridescenceThicknessRange !== void 0 &&
        (i.iridescenceThicknessRange = this.iridescenceThicknessRange),
      this.iridescenceMap &&
        this.iridescenceMap.isTexture &&
        (i.iridescenceMap = this.iridescenceMap.toJSON(e).uuid),
      this.iridescenceThicknessMap &&
        this.iridescenceThicknessMap.isTexture &&
        (i.iridescenceThicknessMap =
          this.iridescenceThicknessMap.toJSON(e).uuid),
      this.anisotropy !== void 0 && (i.anisotropy = this.anisotropy),
      this.anisotropyRotation !== void 0 &&
        (i.anisotropyRotation = this.anisotropyRotation),
      this.anisotropyMap &&
        this.anisotropyMap.isTexture &&
        (i.anisotropyMap = this.anisotropyMap.toJSON(e).uuid),
      this.map && this.map.isTexture && (i.map = this.map.toJSON(e).uuid),
      this.matcap &&
        this.matcap.isTexture &&
        (i.matcap = this.matcap.toJSON(e).uuid),
      this.alphaMap &&
        this.alphaMap.isTexture &&
        (i.alphaMap = this.alphaMap.toJSON(e).uuid),
      this.lightMap &&
        this.lightMap.isTexture &&
        ((i.lightMap = this.lightMap.toJSON(e).uuid),
        (i.lightMapIntensity = this.lightMapIntensity)),
      this.aoMap &&
        this.aoMap.isTexture &&
        ((i.aoMap = this.aoMap.toJSON(e).uuid),
        (i.aoMapIntensity = this.aoMapIntensity)),
      this.bumpMap &&
        this.bumpMap.isTexture &&
        ((i.bumpMap = this.bumpMap.toJSON(e).uuid),
        (i.bumpScale = this.bumpScale)),
      this.normalMap &&
        this.normalMap.isTexture &&
        ((i.normalMap = this.normalMap.toJSON(e).uuid),
        (i.normalMapType = this.normalMapType),
        (i.normalScale = this.normalScale.toArray())),
      this.displacementMap &&
        this.displacementMap.isTexture &&
        ((i.displacementMap = this.displacementMap.toJSON(e).uuid),
        (i.displacementScale = this.displacementScale),
        (i.displacementBias = this.displacementBias)),
      this.roughnessMap &&
        this.roughnessMap.isTexture &&
        (i.roughnessMap = this.roughnessMap.toJSON(e).uuid),
      this.metalnessMap &&
        this.metalnessMap.isTexture &&
        (i.metalnessMap = this.metalnessMap.toJSON(e).uuid),
      this.emissiveMap &&
        this.emissiveMap.isTexture &&
        (i.emissiveMap = this.emissiveMap.toJSON(e).uuid),
      this.specularMap &&
        this.specularMap.isTexture &&
        (i.specularMap = this.specularMap.toJSON(e).uuid),
      this.specularIntensityMap &&
        this.specularIntensityMap.isTexture &&
        (i.specularIntensityMap = this.specularIntensityMap.toJSON(e).uuid),
      this.specularColorMap &&
        this.specularColorMap.isTexture &&
        (i.specularColorMap = this.specularColorMap.toJSON(e).uuid),
      this.envMap &&
        this.envMap.isTexture &&
        ((i.envMap = this.envMap.toJSON(e).uuid),
        this.combine !== void 0 && (i.combine = this.combine)),
      this.envMapRotation !== void 0 &&
        (i.envMapRotation = this.envMapRotation.toArray()),
      this.envMapIntensity !== void 0 &&
        (i.envMapIntensity = this.envMapIntensity),
      this.reflectivity !== void 0 && (i.reflectivity = this.reflectivity),
      this.refractionRatio !== void 0 &&
        (i.refractionRatio = this.refractionRatio),
      this.gradientMap &&
        this.gradientMap.isTexture &&
        (i.gradientMap = this.gradientMap.toJSON(e).uuid),
      this.transmission !== void 0 && (i.transmission = this.transmission),
      this.transmissionMap &&
        this.transmissionMap.isTexture &&
        (i.transmissionMap = this.transmissionMap.toJSON(e).uuid),
      this.thickness !== void 0 && (i.thickness = this.thickness),
      this.thicknessMap &&
        this.thicknessMap.isTexture &&
        (i.thicknessMap = this.thicknessMap.toJSON(e).uuid),
      this.attenuationDistance !== void 0 &&
        this.attenuationDistance !== 1 / 0 &&
        (i.attenuationDistance = this.attenuationDistance),
      this.attenuationColor !== void 0 &&
        (i.attenuationColor = this.attenuationColor.getHex()),
      this.size !== void 0 && (i.size = this.size),
      this.shadowSide !== null && (i.shadowSide = this.shadowSide),
      this.sizeAttenuation !== void 0 &&
        (i.sizeAttenuation = this.sizeAttenuation),
      this.blending !== X5 && (i.blending = this.blending),
      this.side !== tn && (i.side = this.side),
      this.vertexColors === !0 && (i.vertexColors = !0),
      this.opacity < 1 && (i.opacity = this.opacity),
      this.transparent === !0 && (i.transparent = !0),
      this.blendSrc !== l1 && (i.blendSrc = this.blendSrc),
      this.blendDst !== v1 && (i.blendDst = this.blendDst),
      this.blendEquation !== R9 && (i.blendEquation = this.blendEquation),
      this.blendSrcAlpha !== null && (i.blendSrcAlpha = this.blendSrcAlpha),
      this.blendDstAlpha !== null && (i.blendDstAlpha = this.blendDstAlpha),
      this.blendEquationAlpha !== null &&
        (i.blendEquationAlpha = this.blendEquationAlpha),
      this.blendColor &&
        this.blendColor.isColor &&
        (i.blendColor = this.blendColor.getHex()),
      this.blendAlpha !== 0 && (i.blendAlpha = this.blendAlpha),
      this.depthFunc !== y1 && (i.depthFunc = this.depthFunc),
      this.depthTest === !1 && (i.depthTest = this.depthTest),
      this.depthWrite === !1 && (i.depthWrite = this.depthWrite),
      this.colorWrite === !1 && (i.colorWrite = this.colorWrite),
      this.stencilWriteMask !== 255 &&
        (i.stencilWriteMask = this.stencilWriteMask),
      this.stencilFunc !== Jy && (i.stencilFunc = this.stencilFunc),
      this.stencilRef !== 0 && (i.stencilRef = this.stencilRef),
      this.stencilFuncMask !== 255 &&
        (i.stencilFuncMask = this.stencilFuncMask),
      this.stencilFail !== N4 && (i.stencilFail = this.stencilFail),
      this.stencilZFail !== N4 && (i.stencilZFail = this.stencilZFail),
      this.stencilZPass !== N4 && (i.stencilZPass = this.stencilZPass),
      this.stencilWrite === !0 && (i.stencilWrite = this.stencilWrite),
      this.rotation !== void 0 &&
        this.rotation !== 0 &&
        (i.rotation = this.rotation),
      this.polygonOffset === !0 && (i.polygonOffset = !0),
      this.polygonOffsetFactor !== 0 &&
        (i.polygonOffsetFactor = this.polygonOffsetFactor),
      this.polygonOffsetUnits !== 0 &&
        (i.polygonOffsetUnits = this.polygonOffsetUnits),
      this.linewidth !== void 0 &&
        this.linewidth !== 1 &&
        (i.linewidth = this.linewidth),
      this.dashSize !== void 0 && (i.dashSize = this.dashSize),
      this.gapSize !== void 0 && (i.gapSize = this.gapSize),
      this.scale !== void 0 && (i.scale = this.scale),
      this.dithering === !0 && (i.dithering = !0),
      this.alphaTest > 0 && (i.alphaTest = this.alphaTest),
      this.alphaHash === !0 && (i.alphaHash = !0),
      this.alphaToCoverage === !0 && (i.alphaToCoverage = !0),
      this.premultipliedAlpha === !0 && (i.premultipliedAlpha = !0),
      this.forceSinglePass === !0 && (i.forceSinglePass = !0),
      this.wireframe === !0 && (i.wireframe = !0),
      this.wireframeLinewidth > 1 &&
        (i.wireframeLinewidth = this.wireframeLinewidth),
      this.wireframeLinecap !== "round" &&
        (i.wireframeLinecap = this.wireframeLinecap),
      this.wireframeLinejoin !== "round" &&
        (i.wireframeLinejoin = this.wireframeLinejoin),
      this.flatShading === !0 && (i.flatShading = !0),
      this.visible === !1 && (i.visible = !1),
      this.toneMapped === !1 && (i.toneMapped = !1),
      this.fog === !1 && (i.fog = !1),
      Object.keys(this.userData).length > 0 && (i.userData = this.userData));
    function r(s) {
      const o = [];
      for (const a in s) {
        const c = s[a];
        (delete c.metadata, o.push(c));
      }
      return o;
    }
    if (t) {
      const s = r(e.textures),
        o = r(e.images);
      (s.length > 0 && (i.textures = s), o.length > 0 && (i.images = o));
    }
    return i;
  }
  clone() {
    return new this.constructor().copy(this);
  }
  copy(e) {
    ((this.name = e.name),
      (this.blending = e.blending),
      (this.side = e.side),
      (this.vertexColors = e.vertexColors),
      (this.opacity = e.opacity),
      (this.transparent = e.transparent),
      (this.blendSrc = e.blendSrc),
      (this.blendDst = e.blendDst),
      (this.blendEquation = e.blendEquation),
      (this.blendSrcAlpha = e.blendSrcAlpha),
      (this.blendDstAlpha = e.blendDstAlpha),
      (this.blendEquationAlpha = e.blendEquationAlpha),
      this.blendColor.copy(e.blendColor),
      (this.blendAlpha = e.blendAlpha),
      (this.depthFunc = e.depthFunc),
      (this.depthTest = e.depthTest),
      (this.depthWrite = e.depthWrite),
      (this.stencilWriteMask = e.stencilWriteMask),
      (this.stencilFunc = e.stencilFunc),
      (this.stencilRef = e.stencilRef),
      (this.stencilFuncMask = e.stencilFuncMask),
      (this.stencilFail = e.stencilFail),
      (this.stencilZFail = e.stencilZFail),
      (this.stencilZPass = e.stencilZPass),
      (this.stencilWrite = e.stencilWrite));
    const t = e.clippingPlanes;
    let i = null;
    if (t !== null) {
      const r = t.length;
      i = new Array(r);
      for (let s = 0; s !== r; ++s) i[s] = t[s].clone();
    }
    return (
      (this.clippingPlanes = i),
      (this.clipIntersection = e.clipIntersection),
      (this.clipShadows = e.clipShadows),
      (this.shadowSide = e.shadowSide),
      (this.colorWrite = e.colorWrite),
      (this.precision = e.precision),
      (this.polygonOffset = e.polygonOffset),
      (this.polygonOffsetFactor = e.polygonOffsetFactor),
      (this.polygonOffsetUnits = e.polygonOffsetUnits),
      (this.dithering = e.dithering),
      (this.alphaTest = e.alphaTest),
      (this.alphaHash = e.alphaHash),
      (this.alphaToCoverage = e.alphaToCoverage),
      (this.premultipliedAlpha = e.premultipliedAlpha),
      (this.forceSinglePass = e.forceSinglePass),
      (this.visible = e.visible),
      (this.toneMapped = e.toneMapped),
      (this.userData = JSON.parse(JSON.stringify(e.userData))),
      this
    );
  }
  dispose() {
    this.dispatchEvent({ type: "dispose" });
  }
  set needsUpdate(e) {
    e === !0 && this.version++;
  }
}
class d3 extends oa {
  constructor(e) {
    (super(),
      (this.isMeshBasicMaterial = !0),
      (this.type = "MeshBasicMaterial"),
      (this.color = new r9(16777215)),
      (this.map = null),
      (this.lightMap = null),
      (this.lightMapIntensity = 1),
      (this.aoMap = null),
      (this.aoMapIntensity = 1),
      (this.specularMap = null),
      (this.alphaMap = null),
      (this.envMap = null),
      (this.envMapRotation = new o5()),
      (this.combine = aG),
      (this.reflectivity = 1),
      (this.refractionRatio = 0.98),
      (this.wireframe = !1),
      (this.wireframeLinewidth = 1),
      (this.wireframeLinecap = "round"),
      (this.wireframeLinejoin = "round"),
      (this.fog = !0),
      this.setValues(e));
  }
  copy(e) {
    return (
      super.copy(e),
      this.color.copy(e.color),
      (this.map = e.map),
      (this.lightMap = e.lightMap),
      (this.lightMapIntensity = e.lightMapIntensity),
      (this.aoMap = e.aoMap),
      (this.aoMapIntensity = e.aoMapIntensity),
      (this.specularMap = e.specularMap),
      (this.alphaMap = e.alphaMap),
      (this.envMap = e.envMap),
      this.envMapRotation.copy(e.envMapRotation),
      (this.combine = e.combine),
      (this.reflectivity = e.reflectivity),
      (this.refractionRatio = e.refractionRatio),
      (this.wireframe = e.wireframe),
      (this.wireframeLinewidth = e.wireframeLinewidth),
      (this.wireframeLinecap = e.wireframeLinecap),
      (this.wireframeLinejoin = e.wireframeLinejoin),
      (this.fog = e.fog),
      this
    );
  }
}
const A1 = new H(),
  Ha = new B2();
let vN = 0;
class _0 {
  constructor(e, t, i = !1) {
    if (Array.isArray(e))
      throw new TypeError(
        "THREE.BufferAttribute: array should be a Typed Array.",
      );
    ((this.isBufferAttribute = !0),
      Object.defineProperty(this, "id", { value: vN++ }),
      (this.name = ""),
      (this.array = e),
      (this.itemSize = t),
      (this.count = e !== void 0 ? e.length / t : 0),
      (this.normalized = i),
      (this.usage = Ap),
      (this.updateRanges = []),
      (this.gpuType = $5),
      (this.version = 0));
  }
  onUploadCallback() {}
  set needsUpdate(e) {
    e === !0 && this.version++;
  }
  setUsage(e) {
    return ((this.usage = e), this);
  }
  addUpdateRange(e, t) {
    this.updateRanges.push({ start: e, count: t });
  }
  clearUpdateRanges() {
    this.updateRanges.length = 0;
  }
  copy(e) {
    return (
      (this.name = e.name),
      (this.array = new e.array.constructor(e.array)),
      (this.itemSize = e.itemSize),
      (this.count = e.count),
      (this.normalized = e.normalized),
      (this.usage = e.usage),
      (this.gpuType = e.gpuType),
      this
    );
  }
  copyAt(e, t, i) {
    ((e *= this.itemSize), (i *= t.itemSize));
    for (let r = 0, s = this.itemSize; r < s; r++)
      this.array[e + r] = t.array[i + r];
    return this;
  }
  copyArray(e) {
    return (this.array.set(e), this);
  }
  applyMatrix3(e) {
    if (this.itemSize === 2)
      for (let t = 0, i = this.count; t < i; t++)
        (Ha.fromBufferAttribute(this, t),
          Ha.applyMatrix3(e),
          this.setXY(t, Ha.x, Ha.y));
    else if (this.itemSize === 3)
      for (let t = 0, i = this.count; t < i; t++)
        (A1.fromBufferAttribute(this, t),
          A1.applyMatrix3(e),
          this.setXYZ(t, A1.x, A1.y, A1.z));
    return this;
  }
  applyMatrix4(e) {
    for (let t = 0, i = this.count; t < i; t++)
      (A1.fromBufferAttribute(this, t),
        A1.applyMatrix4(e),
        this.setXYZ(t, A1.x, A1.y, A1.z));
    return this;
  }
  applyNormalMatrix(e) {
    for (let t = 0, i = this.count; t < i; t++)
      (A1.fromBufferAttribute(this, t),
        A1.applyNormalMatrix(e),
        this.setXYZ(t, A1.x, A1.y, A1.z));
    return this;
  }
  transformDirection(e) {
    for (let t = 0, i = this.count; t < i; t++)
      (A1.fromBufferAttribute(this, t),
        A1.transformDirection(e),
        this.setXYZ(t, A1.x, A1.y, A1.z));
    return this;
  }
  set(e, t = 0) {
    return (this.array.set(e, t), this);
  }
  getComponent(e, t) {
    let i = this.array[e * this.itemSize + t];
    return (this.normalized && (i = Gt(i, this.array)), i);
  }
  setComponent(e, t, i) {
    return (
      this.normalized && (i = x9(i, this.array)),
      (this.array[e * this.itemSize + t] = i),
      this
    );
  }
  getX(e) {
    let t = this.array[e * this.itemSize];
    return (this.normalized && (t = Gt(t, this.array)), t);
  }
  setX(e, t) {
    return (
      this.normalized && (t = x9(t, this.array)),
      (this.array[e * this.itemSize] = t),
      this
    );
  }
  getY(e) {
    let t = this.array[e * this.itemSize + 1];
    return (this.normalized && (t = Gt(t, this.array)), t);
  }
  setY(e, t) {
    return (
      this.normalized && (t = x9(t, this.array)),
      (this.array[e * this.itemSize + 1] = t),
      this
    );
  }
  getZ(e) {
    let t = this.array[e * this.itemSize + 2];
    return (this.normalized && (t = Gt(t, this.array)), t);
  }
  setZ(e, t) {
    return (
      this.normalized && (t = x9(t, this.array)),
      (this.array[e * this.itemSize + 2] = t),
      this
    );
  }
  getW(e) {
    let t = this.array[e * this.itemSize + 3];
    return (this.normalized && (t = Gt(t, this.array)), t);
  }
  setW(e, t) {
    return (
      this.normalized && (t = x9(t, this.array)),
      (this.array[e * this.itemSize + 3] = t),
      this
    );
  }
  setXY(e, t, i) {
    return (
      (e *= this.itemSize),
      this.normalized && ((t = x9(t, this.array)), (i = x9(i, this.array))),
      (this.array[e + 0] = t),
      (this.array[e + 1] = i),
      this
    );
  }
  setXYZ(e, t, i, r) {
    return (
      (e *= this.itemSize),
      this.normalized &&
        ((t = x9(t, this.array)),
        (i = x9(i, this.array)),
        (r = x9(r, this.array))),
      (this.array[e + 0] = t),
      (this.array[e + 1] = i),
      (this.array[e + 2] = r),
      this
    );
  }
  setXYZW(e, t, i, r, s) {
    return (
      (e *= this.itemSize),
      this.normalized &&
        ((t = x9(t, this.array)),
        (i = x9(i, this.array)),
        (r = x9(r, this.array)),
        (s = x9(s, this.array))),
      (this.array[e + 0] = t),
      (this.array[e + 1] = i),
      (this.array[e + 2] = r),
      (this.array[e + 3] = s),
      this
    );
  }
  onUpload(e) {
    return ((this.onUploadCallback = e), this);
  }
  clone() {
    return new this.constructor(this.array, this.itemSize).copy(this);
  }
  toJSON() {
    const e = {
      itemSize: this.itemSize,
      type: this.array.constructor.name,
      array: Array.from(this.array),
      normalized: this.normalized,
    };
    return (
      this.name !== "" && (e.name = this.name),
      this.usage !== Ap && (e.usage = this.usage),
      e
    );
  }
}
class xG extends _0 {
  constructor(e, t, i) {
    super(new Uint16Array(e), t, i);
  }
}
class SG extends _0 {
  constructor(e, t, i) {
    super(new Uint32Array(e), t, i);
  }
}
class M1 extends _0 {
  constructor(e, t, i) {
    super(new Float32Array(e), t, i);
  }
}
let yN = 0;
const Xe = new v2(),
  nu = new Me(),
  X4 = new H(),
  Te = new R4(),
  Vr = new R4(),
  B1 = new H();
class t9 extends vr {
  constructor() {
    (super(),
      (this.isBufferGeometry = !0),
      Object.defineProperty(this, "id", { value: yN++ }),
      (this.uuid = Y5()),
      (this.name = ""),
      (this.type = "BufferGeometry"),
      (this.index = null),
      (this.indirect = null),
      (this.attributes = {}),
      (this.morphAttributes = {}),
      (this.morphTargetsRelative = !1),
      (this.groups = []),
      (this.boundingBox = null),
      (this.boundingSphere = null),
      (this.drawRange = { start: 0, count: 1 / 0 }),
      (this.userData = {}));
  }
  getIndex() {
    return this.index;
  }
  setIndex(e) {
    return (
      Array.isArray(e)
        ? (this.index = new (yG(e) ? SG : xG)(e, 1))
        : (this.index = e),
      this
    );
  }
  setIndirect(e) {
    return ((this.indirect = e), this);
  }
  getIndirect() {
    return this.indirect;
  }
  getAttribute(e) {
    return this.attributes[e];
  }
  setAttribute(e, t) {
    return ((this.attributes[e] = t), this);
  }
  deleteAttribute(e) {
    return (delete this.attributes[e], this);
  }
  hasAttribute(e) {
    return this.attributes[e] !== void 0;
  }
  addGroup(e, t, i = 0) {
    this.groups.push({ start: e, count: t, materialIndex: i });
  }
  clearGroups() {
    this.groups = [];
  }
  setDrawRange(e, t) {
    ((this.drawRange.start = e), (this.drawRange.count = t));
  }
  applyMatrix4(e) {
    const t = this.attributes.position;
    t !== void 0 && (t.applyMatrix4(e), (t.needsUpdate = !0));
    const i = this.attributes.normal;
    if (i !== void 0) {
      const s = new W2().getNormalMatrix(e);
      (i.applyNormalMatrix(s), (i.needsUpdate = !0));
    }
    const r = this.attributes.tangent;
    return (
      r !== void 0 && (r.transformDirection(e), (r.needsUpdate = !0)),
      this.boundingBox !== null && this.computeBoundingBox(),
      this.boundingSphere !== null && this.computeBoundingSphere(),
      this
    );
  }
  applyQuaternion(e) {
    return (Xe.makeRotationFromQuaternion(e), this.applyMatrix4(Xe), this);
  }
  rotateX(e) {
    return (Xe.makeRotationX(e), this.applyMatrix4(Xe), this);
  }
  rotateY(e) {
    return (Xe.makeRotationY(e), this.applyMatrix4(Xe), this);
  }
  rotateZ(e) {
    return (Xe.makeRotationZ(e), this.applyMatrix4(Xe), this);
  }
  translate(e, t, i) {
    return (Xe.makeTranslation(e, t, i), this.applyMatrix4(Xe), this);
  }
  scale(e, t, i) {
    return (Xe.makeScale(e, t, i), this.applyMatrix4(Xe), this);
  }
  lookAt(e) {
    return (
      nu.lookAt(e),
      nu.updateMatrix(),
      this.applyMatrix4(nu.matrix),
      this
    );
  }
  center() {
    return (
      this.computeBoundingBox(),
      this.boundingBox.getCenter(X4).negate(),
      this.translate(X4.x, X4.y, X4.z),
      this
    );
  }
  setFromPoints(e) {
    const t = this.getAttribute("position");
    if (t === void 0) {
      const i = [];
      for (let r = 0, s = e.length; r < s; r++) {
        const o = e[r];
        i.push(o.x, o.y, o.z || 0);
      }
      this.setAttribute("position", new M1(i, 3));
    } else {
      const i = Math.min(e.length, t.count);
      for (let r = 0; r < i; r++) {
        const s = e[r];
        t.setXYZ(r, s.x, s.y, s.z || 0);
      }
      (e.length > t.count &&
        console.warn(
          "THREE.BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry.",
        ),
        (t.needsUpdate = !0));
    }
    return this;
  }
  computeBoundingBox() {
    this.boundingBox === null && (this.boundingBox = new R4());
    const e = this.attributes.position,
      t = this.morphAttributes.position;
    if (e && e.isGLBufferAttribute) {
      (console.error(
        "THREE.BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",
        this,
      ),
        this.boundingBox.set(
          new H(-1 / 0, -1 / 0, -1 / 0),
          new H(1 / 0, 1 / 0, 1 / 0),
        ));
      return;
    }
    if (e !== void 0) {
      if ((this.boundingBox.setFromBufferAttribute(e), t))
        for (let i = 0, r = t.length; i < r; i++) {
          const s = t[i];
          (Te.setFromBufferAttribute(s),
            this.morphTargetsRelative
              ? (B1.addVectors(this.boundingBox.min, Te.min),
                this.boundingBox.expandByPoint(B1),
                B1.addVectors(this.boundingBox.max, Te.max),
                this.boundingBox.expandByPoint(B1))
              : (this.boundingBox.expandByPoint(Te.min),
                this.boundingBox.expandByPoint(Te.max)));
        }
    } else this.boundingBox.makeEmpty();
    (isNaN(this.boundingBox.min.x) ||
      isNaN(this.boundingBox.min.y) ||
      isNaN(this.boundingBox.min.z)) &&
      console.error(
        'THREE.BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',
        this,
      );
  }
  computeBoundingSphere() {
    this.boundingSphere === null && (this.boundingSphere = new yr());
    const e = this.attributes.position,
      t = this.morphAttributes.position;
    if (e && e.isGLBufferAttribute) {
      (console.error(
        "THREE.BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",
        this,
      ),
        this.boundingSphere.set(new H(), 1 / 0));
      return;
    }
    if (e) {
      const i = this.boundingSphere.center;
      if ((Te.setFromBufferAttribute(e), t))
        for (let s = 0, o = t.length; s < o; s++) {
          const a = t[s];
          (Vr.setFromBufferAttribute(a),
            this.morphTargetsRelative
              ? (B1.addVectors(Te.min, Vr.min),
                Te.expandByPoint(B1),
                B1.addVectors(Te.max, Vr.max),
                Te.expandByPoint(B1))
              : (Te.expandByPoint(Vr.min), Te.expandByPoint(Vr.max)));
        }
      Te.getCenter(i);
      let r = 0;
      for (let s = 0, o = e.count; s < o; s++)
        (B1.fromBufferAttribute(e, s),
          (r = Math.max(r, i.distanceToSquared(B1))));
      if (t)
        for (let s = 0, o = t.length; s < o; s++) {
          const a = t[s],
            c = this.morphTargetsRelative;
          for (let l = 0, u = a.count; l < u; l++)
            (B1.fromBufferAttribute(a, l),
              c && (X4.fromBufferAttribute(e, l), B1.add(X4)),
              (r = Math.max(r, i.distanceToSquared(B1))));
        }
      ((this.boundingSphere.radius = Math.sqrt(r)),
        isNaN(this.boundingSphere.radius) &&
          console.error(
            'THREE.BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',
            this,
          ));
    }
  }
  computeTangents() {
    const e = this.index,
      t = this.attributes;
    if (
      e === null ||
      t.position === void 0 ||
      t.normal === void 0 ||
      t.uv === void 0
    ) {
      console.error(
        "THREE.BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)",
      );
      return;
    }
    const i = t.position,
      r = t.normal,
      s = t.uv;
    this.hasAttribute("tangent") === !1 &&
      this.setAttribute("tangent", new _0(new Float32Array(4 * i.count), 4));
    const o = this.getAttribute("tangent"),
      a = [],
      c = [];
    for (let _ = 0; _ < i.count; _++) ((a[_] = new H()), (c[_] = new H()));
    const l = new H(),
      u = new H(),
      h = new H(),
      d = new B2(),
      f = new B2(),
      p = new B2(),
      v = new H(),
      w = new H();
    function g(_, C, S) {
      (l.fromBufferAttribute(i, _),
        u.fromBufferAttribute(i, C),
        h.fromBufferAttribute(i, S),
        d.fromBufferAttribute(s, _),
        f.fromBufferAttribute(s, C),
        p.fromBufferAttribute(s, S),
        u.sub(l),
        h.sub(l),
        f.sub(d),
        p.sub(d));
      const G = 1 / (f.x * p.y - p.x * f.y);
      isFinite(G) &&
        (v
          .copy(u)
          .multiplyScalar(p.y)
          .addScaledVector(h, -f.y)
          .multiplyScalar(G),
        w
          .copy(h)
          .multiplyScalar(f.x)
          .addScaledVector(u, -p.x)
          .multiplyScalar(G),
        a[_].add(v),
        a[C].add(v),
        a[S].add(v),
        c[_].add(w),
        c[C].add(w),
        c[S].add(w));
    }
    let y = this.groups;
    y.length === 0 && (y = [{ start: 0, count: e.count }]);
    for (let _ = 0, C = y.length; _ < C; ++_) {
      const S = y[_],
        G = S.start,
        I = S.count;
      for (let L = G, k = G + I; L < k; L += 3)
        g(e.getX(L + 0), e.getX(L + 1), e.getX(L + 2));
    }
    const b = new H(),
      A = new H(),
      x = new H(),
      M = new H();
    function E(_) {
      (x.fromBufferAttribute(r, _), M.copy(x));
      const C = a[_];
      (b.copy(C),
        b.sub(x.multiplyScalar(x.dot(C))).normalize(),
        A.crossVectors(M, C));
      const G = A.dot(c[_]) < 0 ? -1 : 1;
      o.setXYZW(_, b.x, b.y, b.z, G);
    }
    for (let _ = 0, C = y.length; _ < C; ++_) {
      const S = y[_],
        G = S.start,
        I = S.count;
      for (let L = G, k = G + I; L < k; L += 3)
        (E(e.getX(L + 0)), E(e.getX(L + 1)), E(e.getX(L + 2)));
    }
  }
  computeVertexNormals() {
    const e = this.index,
      t = this.getAttribute("position");
    if (t !== void 0) {
      let i = this.getAttribute("normal");
      if (i === void 0)
        ((i = new _0(new Float32Array(t.count * 3), 3)),
          this.setAttribute("normal", i));
      else for (let d = 0, f = i.count; d < f; d++) i.setXYZ(d, 0, 0, 0);
      const r = new H(),
        s = new H(),
        o = new H(),
        a = new H(),
        c = new H(),
        l = new H(),
        u = new H(),
        h = new H();
      if (e)
        for (let d = 0, f = e.count; d < f; d += 3) {
          const p = e.getX(d + 0),
            v = e.getX(d + 1),
            w = e.getX(d + 2);
          (r.fromBufferAttribute(t, p),
            s.fromBufferAttribute(t, v),
            o.fromBufferAttribute(t, w),
            u.subVectors(o, s),
            h.subVectors(r, s),
            u.cross(h),
            a.fromBufferAttribute(i, p),
            c.fromBufferAttribute(i, v),
            l.fromBufferAttribute(i, w),
            a.add(u),
            c.add(u),
            l.add(u),
            i.setXYZ(p, a.x, a.y, a.z),
            i.setXYZ(v, c.x, c.y, c.z),
            i.setXYZ(w, l.x, l.y, l.z));
        }
      else
        for (let d = 0, f = t.count; d < f; d += 3)
          (r.fromBufferAttribute(t, d + 0),
            s.fromBufferAttribute(t, d + 1),
            o.fromBufferAttribute(t, d + 2),
            u.subVectors(o, s),
            h.subVectors(r, s),
            u.cross(h),
            i.setXYZ(d + 0, u.x, u.y, u.z),
            i.setXYZ(d + 1, u.x, u.y, u.z),
            i.setXYZ(d + 2, u.x, u.y, u.z));
      (this.normalizeNormals(), (i.needsUpdate = !0));
    }
  }
  normalizeNormals() {
    const e = this.attributes.normal;
    for (let t = 0, i = e.count; t < i; t++)
      (B1.fromBufferAttribute(e, t),
        B1.normalize(),
        e.setXYZ(t, B1.x, B1.y, B1.z));
  }
  toNonIndexed() {
    function e(a, c) {
      const l = a.array,
        u = a.itemSize,
        h = a.normalized,
        d = new l.constructor(c.length * u);
      let f = 0,
        p = 0;
      for (let v = 0, w = c.length; v < w; v++) {
        a.isInterleavedBufferAttribute
          ? (f = c[v] * a.data.stride + a.offset)
          : (f = c[v] * u);
        for (let g = 0; g < u; g++) d[p++] = l[f++];
      }
      return new _0(d, u, h);
    }
    if (this.index === null)
      return (
        console.warn(
          "THREE.BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed.",
        ),
        this
      );
    const t = new t9(),
      i = this.index.array,
      r = this.attributes;
    for (const a in r) {
      const c = r[a],
        l = e(c, i);
      t.setAttribute(a, l);
    }
    const s = this.morphAttributes;
    for (const a in s) {
      const c = [],
        l = s[a];
      for (let u = 0, h = l.length; u < h; u++) {
        const d = l[u],
          f = e(d, i);
        c.push(f);
      }
      t.morphAttributes[a] = c;
    }
    t.morphTargetsRelative = this.morphTargetsRelative;
    const o = this.groups;
    for (let a = 0, c = o.length; a < c; a++) {
      const l = o[a];
      t.addGroup(l.start, l.count, l.materialIndex);
    }
    return t;
  }
  toJSON() {
    const e = {
      metadata: {
        version: 4.7,
        type: "BufferGeometry",
        generator: "BufferGeometry.toJSON",
      },
    };
    if (
      ((e.uuid = this.uuid),
      (e.type = this.type),
      this.name !== "" && (e.name = this.name),
      Object.keys(this.userData).length > 0 && (e.userData = this.userData),
      this.parameters !== void 0)
    ) {
      const c = this.parameters;
      for (const l in c) c[l] !== void 0 && (e[l] = c[l]);
      return e;
    }
    e.data = { attributes: {} };
    const t = this.index;
    t !== null &&
      (e.data.index = {
        type: t.array.constructor.name,
        array: Array.prototype.slice.call(t.array),
      });
    const i = this.attributes;
    for (const c in i) {
      const l = i[c];
      e.data.attributes[c] = l.toJSON(e.data);
    }
    const r = {};
    let s = !1;
    for (const c in this.morphAttributes) {
      const l = this.morphAttributes[c],
        u = [];
      for (let h = 0, d = l.length; h < d; h++) {
        const f = l[h];
        u.push(f.toJSON(e.data));
      }
      u.length > 0 && ((r[c] = u), (s = !0));
    }
    s &&
      ((e.data.morphAttributes = r),
      (e.data.morphTargetsRelative = this.morphTargetsRelative));
    const o = this.groups;
    o.length > 0 && (e.data.groups = JSON.parse(JSON.stringify(o)));
    const a = this.boundingSphere;
    return (a !== null && (e.data.boundingSphere = a.toJSON()), e);
  }
  clone() {
    return new this.constructor().copy(this);
  }
  copy(e) {
    ((this.index = null),
      (this.attributes = {}),
      (this.morphAttributes = {}),
      (this.groups = []),
      (this.boundingBox = null),
      (this.boundingSphere = null));
    const t = {};
    this.name = e.name;
    const i = e.index;
    i !== null && this.setIndex(i.clone());
    const r = e.attributes;
    for (const l in r) {
      const u = r[l];
      this.setAttribute(l, u.clone(t));
    }
    const s = e.morphAttributes;
    for (const l in s) {
      const u = [],
        h = s[l];
      for (let d = 0, f = h.length; d < f; d++) u.push(h[d].clone(t));
      this.morphAttributes[l] = u;
    }
    this.morphTargetsRelative = e.morphTargetsRelative;
    const o = e.groups;
    for (let l = 0, u = o.length; l < u; l++) {
      const h = o[l];
      this.addGroup(h.start, h.count, h.materialIndex);
    }
    const a = e.boundingBox;
    a !== null && (this.boundingBox = a.clone());
    const c = e.boundingSphere;
    return (
      c !== null && (this.boundingSphere = c.clone()),
      (this.drawRange.start = e.drawRange.start),
      (this.drawRange.count = e.drawRange.count),
      (this.userData = e.userData),
      this
    );
  }
  dispose() {
    this.dispatchEvent({ type: "dispose" });
  }
}
const pA = new v2(),
  y3 = new uN(),
  qa = new yr(),
  gA = new H(),
  Ka = new H(),
  ja = new H(),
  Xa = new H(),
  iu = new H(),
  Ya = new H(),
  mA = new H(),
  Za = new H();
class D2 extends Me {
  constructor(e = new t9(), t = new d3()) {
    (super(),
      (this.isMesh = !0),
      (this.type = "Mesh"),
      (this.geometry = e),
      (this.material = t),
      (this.morphTargetDictionary = void 0),
      (this.morphTargetInfluences = void 0),
      (this.count = 1),
      this.updateMorphTargets());
  }
  copy(e, t) {
    return (
      super.copy(e, t),
      e.morphTargetInfluences !== void 0 &&
        (this.morphTargetInfluences = e.morphTargetInfluences.slice()),
      e.morphTargetDictionary !== void 0 &&
        (this.morphTargetDictionary = Object.assign(
          {},
          e.morphTargetDictionary,
        )),
      (this.material = Array.isArray(e.material)
        ? e.material.slice()
        : e.material),
      (this.geometry = e.geometry),
      this
    );
  }
  updateMorphTargets() {
    const t = this.geometry.morphAttributes,
      i = Object.keys(t);
    if (i.length > 0) {
      const r = t[i[0]];
      if (r !== void 0) {
        ((this.morphTargetInfluences = []), (this.morphTargetDictionary = {}));
        for (let s = 0, o = r.length; s < o; s++) {
          const a = r[s].name || String(s);
          (this.morphTargetInfluences.push(0),
            (this.morphTargetDictionary[a] = s));
        }
      }
    }
  }
  getVertexPosition(e, t) {
    const i = this.geometry,
      r = i.attributes.position,
      s = i.morphAttributes.position,
      o = i.morphTargetsRelative;
    t.fromBufferAttribute(r, e);
    const a = this.morphTargetInfluences;
    if (s && a) {
      Ya.set(0, 0, 0);
      for (let c = 0, l = s.length; c < l; c++) {
        const u = a[c],
          h = s[c];
        u !== 0 &&
          (iu.fromBufferAttribute(h, e),
          o ? Ya.addScaledVector(iu, u) : Ya.addScaledVector(iu.sub(t), u));
      }
      t.add(Ya);
    }
    return t;
  }
  raycast(e, t) {
    const i = this.geometry,
      r = this.material,
      s = this.matrixWorld;
    r !== void 0 &&
      (i.boundingSphere === null && i.computeBoundingSphere(),
      qa.copy(i.boundingSphere),
      qa.applyMatrix4(s),
      y3.copy(e.ray).recast(e.near),
      !(
        qa.containsPoint(y3.origin) === !1 &&
        (y3.intersectSphere(qa, gA) === null ||
          y3.origin.distanceToSquared(gA) > (e.far - e.near) ** 2)
      ) &&
        (pA.copy(s).invert(),
        y3.copy(e.ray).applyMatrix4(pA),
        !(i.boundingBox !== null && y3.intersectsBox(i.boundingBox) === !1) &&
          this._computeIntersections(e, t, y3)));
  }
  _computeIntersections(e, t, i) {
    let r;
    const s = this.geometry,
      o = this.material,
      a = s.index,
      c = s.attributes.position,
      l = s.attributes.uv,
      u = s.attributes.uv1,
      h = s.attributes.normal,
      d = s.groups,
      f = s.drawRange;
    if (a !== null)
      if (Array.isArray(o))
        for (let p = 0, v = d.length; p < v; p++) {
          const w = d[p],
            g = o[w.materialIndex],
            y = Math.max(w.start, f.start),
            b = Math.min(
              a.count,
              Math.min(w.start + w.count, f.start + f.count),
            );
          for (let A = y, x = b; A < x; A += 3) {
            const M = a.getX(A),
              E = a.getX(A + 1),
              _ = a.getX(A + 2);
            ((r = Qa(this, g, e, i, l, u, h, M, E, _)),
              r &&
                ((r.faceIndex = Math.floor(A / 3)),
                (r.face.materialIndex = w.materialIndex),
                t.push(r)));
          }
        }
      else {
        const p = Math.max(0, f.start),
          v = Math.min(a.count, f.start + f.count);
        for (let w = p, g = v; w < g; w += 3) {
          const y = a.getX(w),
            b = a.getX(w + 1),
            A = a.getX(w + 2);
          ((r = Qa(this, o, e, i, l, u, h, y, b, A)),
            r && ((r.faceIndex = Math.floor(w / 3)), t.push(r)));
        }
      }
    else if (c !== void 0)
      if (Array.isArray(o))
        for (let p = 0, v = d.length; p < v; p++) {
          const w = d[p],
            g = o[w.materialIndex],
            y = Math.max(w.start, f.start),
            b = Math.min(
              c.count,
              Math.min(w.start + w.count, f.start + f.count),
            );
          for (let A = y, x = b; A < x; A += 3) {
            const M = A,
              E = A + 1,
              _ = A + 2;
            ((r = Qa(this, g, e, i, l, u, h, M, E, _)),
              r &&
                ((r.faceIndex = Math.floor(A / 3)),
                (r.face.materialIndex = w.materialIndex),
                t.push(r)));
          }
        }
      else {
        const p = Math.max(0, f.start),
          v = Math.min(c.count, f.start + f.count);
        for (let w = p, g = v; w < g; w += 3) {
          const y = w,
            b = w + 1,
            A = w + 2;
          ((r = Qa(this, o, e, i, l, u, h, y, b, A)),
            r && ((r.faceIndex = Math.floor(w / 3)), t.push(r)));
        }
      }
  }
}
function AN(n, e, t, i, r, s, o, a) {
  let c;
  if (
    (e.side === me
      ? (c = i.intersectTriangle(o, s, r, !0, a))
      : (c = i.intersectTriangle(r, s, o, e.side === tn, a)),
    c === null)
  )
    return null;
  (Za.copy(a), Za.applyMatrix4(n.matrixWorld));
  const l = t.ray.origin.distanceTo(Za);
  return l < t.near || l > t.far
    ? null
    : { distance: l, point: Za.clone(), object: n };
}
function Qa(n, e, t, i, r, s, o, a, c, l) {
  (n.getVertexPosition(a, Ka),
    n.getVertexPosition(c, ja),
    n.getVertexPosition(l, Xa));
  const u = AN(n, e, t, i, Ka, ja, Xa, mA);
  if (u) {
    const h = new H();
    (it.getBarycoord(mA, Ka, ja, Xa, h),
      r && (u.uv = it.getInterpolatedAttribute(r, a, c, l, h, new B2())),
      s && (u.uv1 = it.getInterpolatedAttribute(s, a, c, l, h, new B2())),
      o &&
        ((u.normal = it.getInterpolatedAttribute(o, a, c, l, h, new H())),
        u.normal.dot(i.direction) > 0 && u.normal.multiplyScalar(-1)));
    const d = { a, b: c, c: l, normal: new H(), materialIndex: 0 };
    (it.getNormal(Ka, ja, Xa, d.normal), (u.face = d), (u.barycoord = h));
  }
  return u;
}
class aa extends t9 {
  constructor(e = 1, t = 1, i = 1, r = 1, s = 1, o = 1) {
    (super(),
      (this.type = "BoxGeometry"),
      (this.parameters = {
        width: e,
        height: t,
        depth: i,
        widthSegments: r,
        heightSegments: s,
        depthSegments: o,
      }));
    const a = this;
    ((r = Math.floor(r)), (s = Math.floor(s)), (o = Math.floor(o)));
    const c = [],
      l = [],
      u = [],
      h = [];
    let d = 0,
      f = 0;
    (p("z", "y", "x", -1, -1, i, t, e, o, s, 0),
      p("z", "y", "x", 1, -1, i, t, -e, o, s, 1),
      p("x", "z", "y", 1, 1, e, i, t, r, o, 2),
      p("x", "z", "y", 1, -1, e, i, -t, r, o, 3),
      p("x", "y", "z", 1, -1, e, t, i, r, s, 4),
      p("x", "y", "z", -1, -1, e, t, -i, r, s, 5),
      this.setIndex(c),
      this.setAttribute("position", new M1(l, 3)),
      this.setAttribute("normal", new M1(u, 3)),
      this.setAttribute("uv", new M1(h, 2)));
    function p(v, w, g, y, b, A, x, M, E, _, C) {
      const S = A / E,
        G = x / _,
        I = A / 2,
        L = x / 2,
        k = M / 2,
        D = E + 1,
        V = _ + 1;
      let K = 0,
        P = 0;
      const q = new H();
      for (let e0 = 0; e0 < V; e0++) {
        const Q = e0 * G - L;
        for (let U = 0; U < D; U++) {
          const O = U * S - I;
          ((q[v] = O * y),
            (q[w] = Q * b),
            (q[g] = k),
            l.push(q.x, q.y, q.z),
            (q[v] = 0),
            (q[w] = 0),
            (q[g] = M > 0 ? 1 : -1),
            u.push(q.x, q.y, q.z),
            h.push(U / E),
            h.push(1 - e0 / _),
            (K += 1));
        }
      }
      for (let e0 = 0; e0 < _; e0++)
        for (let Q = 0; Q < E; Q++) {
          const U = d + Q + D * e0,
            O = d + Q + D * (e0 + 1),
            F = d + (Q + 1) + D * (e0 + 1),
            z = d + (Q + 1) + D * e0;
          (c.push(U, O, z), c.push(O, F, z), (P += 6));
        }
      (a.addGroup(f, P, C), (f += P), (d += K));
    }
  }
  copy(e) {
    return (
      super.copy(e),
      (this.parameters = Object.assign({}, e.parameters)),
      this
    );
  }
  static fromJSON(e) {
    return new aa(
      e.width,
      e.height,
      e.depth,
      e.widthSegments,
      e.heightSegments,
      e.depthSegments,
    );
  }
}
function ar(n) {
  const e = {};
  for (const t in n) {
    e[t] = {};
    for (const i in n[t]) {
      const r = n[t][i];
      r &&
      (r.isColor ||
        r.isMatrix3 ||
        r.isMatrix4 ||
        r.isVector2 ||
        r.isVector3 ||
        r.isVector4 ||
        r.isTexture ||
        r.isQuaternion)
        ? r.isRenderTargetTexture
          ? (console.warn(
              "UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms().",
            ),
            (e[t][i] = null))
          : (e[t][i] = r.clone())
        : Array.isArray(r)
          ? (e[t][i] = r.slice())
          : (e[t][i] = r);
    }
  }
  return e;
}
function ce(n) {
  const e = {};
  for (let t = 0; t < n.length; t++) {
    const i = ar(n[t]);
    for (const r in i) e[r] = i[r];
  }
  return e;
}
function bN(n) {
  const e = [];
  for (let t = 0; t < n.length; t++) e.push(n[t].clone());
  return e;
}
function CG(n) {
  const e = n.getRenderTarget();
  return e === null
    ? n.outputColorSpace
    : e.isXRRenderTarget === !0
      ? e.texture.colorSpace
      : f9.workingColorSpace;
}
const MN = { clone: ar, merge: ce };
var xN = `void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,
  SN = `void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`;
class $1 extends oa {
  constructor(e) {
    (super(),
      (this.isShaderMaterial = !0),
      (this.type = "ShaderMaterial"),
      (this.defines = {}),
      (this.uniforms = {}),
      (this.uniformsGroups = []),
      (this.vertexShader = xN),
      (this.fragmentShader = SN),
      (this.linewidth = 1),
      (this.wireframe = !1),
      (this.wireframeLinewidth = 1),
      (this.fog = !1),
      (this.lights = !1),
      (this.clipping = !1),
      (this.forceSinglePass = !0),
      (this.extensions = { clipCullDistance: !1, multiDraw: !1 }),
      (this.defaultAttributeValues = {
        color: [1, 1, 1],
        uv: [0, 0],
        uv1: [0, 0],
      }),
      (this.index0AttributeName = void 0),
      (this.uniformsNeedUpdate = !1),
      (this.glslVersion = null),
      e !== void 0 && this.setValues(e));
  }
  copy(e) {
    return (
      super.copy(e),
      (this.fragmentShader = e.fragmentShader),
      (this.vertexShader = e.vertexShader),
      (this.uniforms = ar(e.uniforms)),
      (this.uniformsGroups = bN(e.uniformsGroups)),
      (this.defines = Object.assign({}, e.defines)),
      (this.wireframe = e.wireframe),
      (this.wireframeLinewidth = e.wireframeLinewidth),
      (this.fog = e.fog),
      (this.lights = e.lights),
      (this.clipping = e.clipping),
      (this.extensions = Object.assign({}, e.extensions)),
      (this.glslVersion = e.glslVersion),
      this
    );
  }
  toJSON(e) {
    const t = super.toJSON(e);
    ((t.glslVersion = this.glslVersion), (t.uniforms = {}));
    for (const r in this.uniforms) {
      const o = this.uniforms[r].value;
      o && o.isTexture
        ? (t.uniforms[r] = { type: "t", value: o.toJSON(e).uuid })
        : o && o.isColor
          ? (t.uniforms[r] = { type: "c", value: o.getHex() })
          : o && o.isVector2
            ? (t.uniforms[r] = { type: "v2", value: o.toArray() })
            : o && o.isVector3
              ? (t.uniforms[r] = { type: "v3", value: o.toArray() })
              : o && o.isVector4
                ? (t.uniforms[r] = { type: "v4", value: o.toArray() })
                : o && o.isMatrix3
                  ? (t.uniforms[r] = { type: "m3", value: o.toArray() })
                  : o && o.isMatrix4
                    ? (t.uniforms[r] = { type: "m4", value: o.toArray() })
                    : (t.uniforms[r] = { value: o });
    }
    (Object.keys(this.defines).length > 0 && (t.defines = this.defines),
      (t.vertexShader = this.vertexShader),
      (t.fragmentShader = this.fragmentShader),
      (t.lights = this.lights),
      (t.clipping = this.clipping));
    const i = {};
    for (const r in this.extensions) this.extensions[r] === !0 && (i[r] = !0);
    return (Object.keys(i).length > 0 && (t.extensions = i), t);
  }
}
class a5 extends Me {
  constructor() {
    (super(),
      (this.isCamera = !0),
      (this.type = "Camera"),
      (this.matrixWorldInverse = new v2()),
      (this.projectionMatrix = new v2()),
      (this.projectionMatrixInverse = new v2()),
      (this.coordinateSystem = W5));
  }
  copy(e, t) {
    return (
      super.copy(e, t),
      this.matrixWorldInverse.copy(e.matrixWorldInverse),
      this.projectionMatrix.copy(e.projectionMatrix),
      this.projectionMatrixInverse.copy(e.projectionMatrixInverse),
      (this.coordinateSystem = e.coordinateSystem),
      this
    );
  }
  getWorldDirection(e) {
    return super.getWorldDirection(e).negate();
  }
  updateMatrixWorld(e) {
    (super.updateMatrixWorld(e),
      this.matrixWorldInverse.copy(this.matrixWorld).invert());
  }
  updateWorldMatrix(e, t) {
    (super.updateWorldMatrix(e, t),
      this.matrixWorldInverse.copy(this.matrixWorld).invert());
  }
  clone() {
    return new this.constructor().copy(this);
  }
}
const yn = new H(),
  wA = new B2(),
  vA = new B2();
class Z9 extends a5 {
  constructor(e = 50, t = 1, i = 0.1, r = 2e3) {
    (super(),
      (this.isPerspectiveCamera = !0),
      (this.type = "PerspectiveCamera"),
      (this.fov = e),
      (this.zoom = 1),
      (this.near = i),
      (this.far = r),
      (this.focus = 10),
      (this.aspect = t),
      (this.view = null),
      (this.filmGauge = 35),
      (this.filmOffset = 0),
      this.updateProjectionMatrix());
  }
  copy(e, t) {
    return (
      super.copy(e, t),
      (this.fov = e.fov),
      (this.zoom = e.zoom),
      (this.near = e.near),
      (this.far = e.far),
      (this.focus = e.focus),
      (this.aspect = e.aspect),
      (this.view = e.view === null ? null : Object.assign({}, e.view)),
      (this.filmGauge = e.filmGauge),
      (this.filmOffset = e.filmOffset),
      this
    );
  }
  setFocalLength(e) {
    const t = (0.5 * this.getFilmHeight()) / e;
    ((this.fov = po * 2 * Math.atan(t)), this.updateProjectionMatrix());
  }
  getFocalLength() {
    const e = Math.tan(Rs * 0.5 * this.fov);
    return (0.5 * this.getFilmHeight()) / e;
  }
  getEffectiveFOV() {
    return po * 2 * Math.atan(Math.tan(Rs * 0.5 * this.fov) / this.zoom);
  }
  getFilmWidth() {
    return this.filmGauge * Math.min(this.aspect, 1);
  }
  getFilmHeight() {
    return this.filmGauge / Math.max(this.aspect, 1);
  }
  getViewBounds(e, t, i) {
    (yn.set(-1, -1, 0.5).applyMatrix4(this.projectionMatrixInverse),
      t.set(yn.x, yn.y).multiplyScalar(-e / yn.z),
      yn.set(1, 1, 0.5).applyMatrix4(this.projectionMatrixInverse),
      i.set(yn.x, yn.y).multiplyScalar(-e / yn.z));
  }
  getViewSize(e, t) {
    return (this.getViewBounds(e, wA, vA), t.subVectors(vA, wA));
  }
  setViewOffset(e, t, i, r, s, o) {
    ((this.aspect = e / t),
      this.view === null &&
        (this.view = {
          enabled: !0,
          fullWidth: 1,
          fullHeight: 1,
          offsetX: 0,
          offsetY: 0,
          width: 1,
          height: 1,
        }),
      (this.view.enabled = !0),
      (this.view.fullWidth = e),
      (this.view.fullHeight = t),
      (this.view.offsetX = i),
      (this.view.offsetY = r),
      (this.view.width = s),
      (this.view.height = o),
      this.updateProjectionMatrix());
  }
  clearViewOffset() {
    (this.view !== null && (this.view.enabled = !1),
      this.updateProjectionMatrix());
  }
  updateProjectionMatrix() {
    const e = this.near;
    let t = (e * Math.tan(Rs * 0.5 * this.fov)) / this.zoom,
      i = 2 * t,
      r = this.aspect * i,
      s = -0.5 * r;
    const o = this.view;
    if (this.view !== null && this.view.enabled) {
      const c = o.fullWidth,
        l = o.fullHeight;
      ((s += (o.offsetX * r) / c),
        (t -= (o.offsetY * i) / l),
        (r *= o.width / c),
        (i *= o.height / l));
    }
    const a = this.filmOffset;
    (a !== 0 && (s += (e * a) / this.getFilmWidth()),
      this.projectionMatrix.makePerspective(
        s,
        s + r,
        t,
        t - i,
        e,
        this.far,
        this.coordinateSystem,
      ),
      this.projectionMatrixInverse.copy(this.projectionMatrix).invert());
  }
  toJSON(e) {
    const t = super.toJSON(e);
    return (
      (t.object.fov = this.fov),
      (t.object.zoom = this.zoom),
      (t.object.near = this.near),
      (t.object.far = this.far),
      (t.object.focus = this.focus),
      (t.object.aspect = this.aspect),
      this.view !== null && (t.object.view = Object.assign({}, this.view)),
      (t.object.filmGauge = this.filmGauge),
      (t.object.filmOffset = this.filmOffset),
      t
    );
  }
}
const Y4 = -90,
  Z4 = 1;
class CN extends Me {
  constructor(e, t, i) {
    (super(),
      (this.type = "CubeCamera"),
      (this.renderTarget = i),
      (this.coordinateSystem = null),
      (this.activeMipmapLevel = 0));
    const r = new Z9(Y4, Z4, e, t);
    ((r.layers = this.layers), this.add(r));
    const s = new Z9(Y4, Z4, e, t);
    ((s.layers = this.layers), this.add(s));
    const o = new Z9(Y4, Z4, e, t);
    ((o.layers = this.layers), this.add(o));
    const a = new Z9(Y4, Z4, e, t);
    ((a.layers = this.layers), this.add(a));
    const c = new Z9(Y4, Z4, e, t);
    ((c.layers = this.layers), this.add(c));
    const l = new Z9(Y4, Z4, e, t);
    ((l.layers = this.layers), this.add(l));
  }
  updateCoordinateSystem() {
    const e = this.coordinateSystem,
      t = this.children.concat(),
      [i, r, s, o, a, c] = t;
    for (const l of t) this.remove(l);
    if (e === W5)
      (i.up.set(0, 1, 0),
        i.lookAt(1, 0, 0),
        r.up.set(0, 1, 0),
        r.lookAt(-1, 0, 0),
        s.up.set(0, 0, -1),
        s.lookAt(0, 1, 0),
        o.up.set(0, 0, 1),
        o.lookAt(0, -1, 0),
        a.up.set(0, 1, 0),
        a.lookAt(0, 0, 1),
        c.up.set(0, 1, 0),
        c.lookAt(0, 0, -1));
    else if (e === Il)
      (i.up.set(0, -1, 0),
        i.lookAt(-1, 0, 0),
        r.up.set(0, -1, 0),
        r.lookAt(1, 0, 0),
        s.up.set(0, 0, 1),
        s.lookAt(0, 1, 0),
        o.up.set(0, 0, -1),
        o.lookAt(0, -1, 0),
        a.up.set(0, -1, 0),
        a.lookAt(0, 0, 1),
        c.up.set(0, -1, 0),
        c.lookAt(0, 0, -1));
    else
      throw new Error(
        "THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: " +
          e,
      );
    for (const l of t) (this.add(l), l.updateMatrixWorld());
  }
  update(e, t) {
    this.parent === null && this.updateMatrixWorld();
    const { renderTarget: i, activeMipmapLevel: r } = this;
    this.coordinateSystem !== e.coordinateSystem &&
      ((this.coordinateSystem = e.coordinateSystem),
      this.updateCoordinateSystem());
    const [s, o, a, c, l, u] = this.children,
      h = e.getRenderTarget(),
      d = e.getActiveCubeFace(),
      f = e.getActiveMipmapLevel(),
      p = e.xr.enabled;
    e.xr.enabled = !1;
    const v = i.texture.generateMipmaps;
    ((i.texture.generateMipmaps = !1),
      e.setRenderTarget(i, 0, r),
      e.render(t, s),
      e.setRenderTarget(i, 1, r),
      e.render(t, o),
      e.setRenderTarget(i, 2, r),
      e.render(t, a),
      e.setRenderTarget(i, 3, r),
      e.render(t, c),
      e.setRenderTarget(i, 4, r),
      e.render(t, l),
      (i.texture.generateMipmaps = v),
      e.setRenderTarget(i, 5, r),
      e.render(t, u),
      e.setRenderTarget(h, d, f),
      (e.xr.enabled = p),
      (i.texture.needsPMREMUpdate = !0));
  }
}
class EG extends D9 {
  constructor(e = [], t = sr, i, r, s, o, a, c, l, u) {
    (super(e, t, i, r, s, o, a, c, l, u),
      (this.isCubeTexture = !0),
      (this.flipY = !1));
  }
  get images() {
    return this.image;
  }
  set images(e) {
    this.image = e;
  }
}
class EN extends nn {
  constructor(e = 1, t = {}) {
    (super(e, e, t), (this.isWebGLCubeRenderTarget = !0));
    const i = { width: e, height: e, depth: 1 },
      r = [i, i, i, i, i, i];
    ((this.texture = new EG(r)),
      this._setTextureOptions(t),
      (this.texture.isRenderTargetTexture = !0));
  }
  fromEquirectangularTexture(e, t) {
    ((this.texture.type = t.type),
      (this.texture.colorSpace = t.colorSpace),
      (this.texture.generateMipmaps = t.generateMipmaps),
      (this.texture.minFilter = t.minFilter),
      (this.texture.magFilter = t.magFilter));
    const i = {
        uniforms: { tEquirect: { value: null } },
        vertexShader: `

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,
        fragmentShader: `

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`,
      },
      r = new aa(5, 5, 5),
      s = new $1({
        name: "CubemapFromEquirect",
        uniforms: ar(i.uniforms),
        vertexShader: i.vertexShader,
        fragmentShader: i.fragmentShader,
        side: me,
        blending: n5,
      });
    s.uniforms.tEquirect.value = t;
    const o = new D2(r, s),
      a = t.minFilter;
    return (
      t.minFilter === e5 && (t.minFilter = u9),
      new CN(1, 10, this).update(e, o),
      (t.minFilter = a),
      o.geometry.dispose(),
      o.material.dispose(),
      this
    );
  }
  clear(e, t = !0, i = !0, r = !0) {
    const s = e.getRenderTarget();
    for (let o = 0; o < 6; o++) (e.setRenderTarget(this, o), e.clear(t, i, r));
    e.setRenderTarget(s);
  }
}
class T2 extends Me {
  constructor() {
    (super(), (this.isGroup = !0), (this.type = "Group"));
  }
}
const TN = { type: "move" };
class ru {
  constructor() {
    ((this._targetRay = null), (this._grip = null), (this._hand = null));
  }
  getHandSpace() {
    return (
      this._hand === null &&
        ((this._hand = new T2()),
        (this._hand.matrixAutoUpdate = !1),
        (this._hand.visible = !1),
        (this._hand.joints = {}),
        (this._hand.inputState = { pinching: !1 })),
      this._hand
    );
  }
  getTargetRaySpace() {
    return (
      this._targetRay === null &&
        ((this._targetRay = new T2()),
        (this._targetRay.matrixAutoUpdate = !1),
        (this._targetRay.visible = !1),
        (this._targetRay.hasLinearVelocity = !1),
        (this._targetRay.linearVelocity = new H()),
        (this._targetRay.hasAngularVelocity = !1),
        (this._targetRay.angularVelocity = new H())),
      this._targetRay
    );
  }
  getGripSpace() {
    return (
      this._grip === null &&
        ((this._grip = new T2()),
        (this._grip.matrixAutoUpdate = !1),
        (this._grip.visible = !1),
        (this._grip.hasLinearVelocity = !1),
        (this._grip.linearVelocity = new H()),
        (this._grip.hasAngularVelocity = !1),
        (this._grip.angularVelocity = new H())),
      this._grip
    );
  }
  dispatchEvent(e) {
    return (
      this._targetRay !== null && this._targetRay.dispatchEvent(e),
      this._grip !== null && this._grip.dispatchEvent(e),
      this._hand !== null && this._hand.dispatchEvent(e),
      this
    );
  }
  connect(e) {
    if (e && e.hand) {
      const t = this._hand;
      if (t) for (const i of e.hand.values()) this._getHandJoint(t, i);
    }
    return (this.dispatchEvent({ type: "connected", data: e }), this);
  }
  disconnect(e) {
    return (
      this.dispatchEvent({ type: "disconnected", data: e }),
      this._targetRay !== null && (this._targetRay.visible = !1),
      this._grip !== null && (this._grip.visible = !1),
      this._hand !== null && (this._hand.visible = !1),
      this
    );
  }
  update(e, t, i) {
    let r = null,
      s = null,
      o = null;
    const a = this._targetRay,
      c = this._grip,
      l = this._hand;
    if (e && t.session.visibilityState !== "visible-blurred") {
      if (l && e.hand) {
        o = !0;
        for (const v of e.hand.values()) {
          const w = t.getJointPose(v, i),
            g = this._getHandJoint(l, v);
          (w !== null &&
            (g.matrix.fromArray(w.transform.matrix),
            g.matrix.decompose(g.position, g.rotation, g.scale),
            (g.matrixWorldNeedsUpdate = !0),
            (g.jointRadius = w.radius)),
            (g.visible = w !== null));
        }
        const u = l.joints["index-finger-tip"],
          h = l.joints["thumb-tip"],
          d = u.position.distanceTo(h.position),
          f = 0.02,
          p = 0.005;
        l.inputState.pinching && d > f + p
          ? ((l.inputState.pinching = !1),
            this.dispatchEvent({
              type: "pinchend",
              handedness: e.handedness,
              target: this,
            }))
          : !l.inputState.pinching &&
            d <= f - p &&
            ((l.inputState.pinching = !0),
            this.dispatchEvent({
              type: "pinchstart",
              handedness: e.handedness,
              target: this,
            }));
      } else
        c !== null &&
          e.gripSpace &&
          ((s = t.getPose(e.gripSpace, i)),
          s !== null &&
            (c.matrix.fromArray(s.transform.matrix),
            c.matrix.decompose(c.position, c.rotation, c.scale),
            (c.matrixWorldNeedsUpdate = !0),
            s.linearVelocity
              ? ((c.hasLinearVelocity = !0),
                c.linearVelocity.copy(s.linearVelocity))
              : (c.hasLinearVelocity = !1),
            s.angularVelocity
              ? ((c.hasAngularVelocity = !0),
                c.angularVelocity.copy(s.angularVelocity))
              : (c.hasAngularVelocity = !1)));
      a !== null &&
        ((r = t.getPose(e.targetRaySpace, i)),
        r === null && s !== null && (r = s),
        r !== null &&
          (a.matrix.fromArray(r.transform.matrix),
          a.matrix.decompose(a.position, a.rotation, a.scale),
          (a.matrixWorldNeedsUpdate = !0),
          r.linearVelocity
            ? ((a.hasLinearVelocity = !0),
              a.linearVelocity.copy(r.linearVelocity))
            : (a.hasLinearVelocity = !1),
          r.angularVelocity
            ? ((a.hasAngularVelocity = !0),
              a.angularVelocity.copy(r.angularVelocity))
            : (a.hasAngularVelocity = !1),
          this.dispatchEvent(TN)));
    }
    return (
      a !== null && (a.visible = r !== null),
      c !== null && (c.visible = s !== null),
      l !== null && (l.visible = o !== null),
      this
    );
  }
  _getHandJoint(e, t) {
    if (e.joints[t.jointName] === void 0) {
      const i = new T2();
      ((i.matrixAutoUpdate = !1),
        (i.visible = !1),
        (e.joints[t.jointName] = i),
        e.add(i));
    }
    return e.joints[t.jointName];
  }
}
class Lm {
  constructor(e, t = 25e-5) {
    ((this.isFogExp2 = !0),
      (this.name = ""),
      (this.color = new r9(e)),
      (this.density = t));
  }
  clone() {
    return new Lm(this.color, this.density);
  }
  toJSON() {
    return {
      type: "FogExp2",
      name: this.name,
      color: this.color.getHex(),
      density: this.density,
    };
  }
}
class Pm {
  constructor(e, t = 1, i = 1e3) {
    ((this.isFog = !0),
      (this.name = ""),
      (this.color = new r9(e)),
      (this.near = t),
      (this.far = i));
  }
  clone() {
    return new Pm(this.color, this.near, this.far);
  }
  toJSON() {
    return {
      type: "Fog",
      name: this.name,
      color: this.color.getHex(),
      near: this.near,
      far: this.far,
    };
  }
}
class D1 extends Me {
  constructor() {
    (super(),
      (this.isScene = !0),
      (this.type = "Scene"),
      (this.background = null),
      (this.environment = null),
      (this.fog = null),
      (this.backgroundBlurriness = 0),
      (this.backgroundIntensity = 1),
      (this.backgroundRotation = new o5()),
      (this.environmentIntensity = 1),
      (this.environmentRotation = new o5()),
      (this.overrideMaterial = null),
      typeof __THREE_DEVTOOLS__ < "u" &&
        __THREE_DEVTOOLS__.dispatchEvent(
          new CustomEvent("observe", { detail: this }),
        ));
  }
  copy(e, t) {
    return (
      super.copy(e, t),
      e.background !== null && (this.background = e.background.clone()),
      e.environment !== null && (this.environment = e.environment.clone()),
      e.fog !== null && (this.fog = e.fog.clone()),
      (this.backgroundBlurriness = e.backgroundBlurriness),
      (this.backgroundIntensity = e.backgroundIntensity),
      this.backgroundRotation.copy(e.backgroundRotation),
      (this.environmentIntensity = e.environmentIntensity),
      this.environmentRotation.copy(e.environmentRotation),
      e.overrideMaterial !== null &&
        (this.overrideMaterial = e.overrideMaterial.clone()),
      (this.matrixAutoUpdate = e.matrixAutoUpdate),
      this
    );
  }
  toJSON(e) {
    const t = super.toJSON(e);
    return (
      this.fog !== null && (t.object.fog = this.fog.toJSON()),
      this.backgroundBlurriness > 0 &&
        (t.object.backgroundBlurriness = this.backgroundBlurriness),
      this.backgroundIntensity !== 1 &&
        (t.object.backgroundIntensity = this.backgroundIntensity),
      (t.object.backgroundRotation = this.backgroundRotation.toArray()),
      this.environmentIntensity !== 1 &&
        (t.object.environmentIntensity = this.environmentIntensity),
      (t.object.environmentRotation = this.environmentRotation.toArray()),
      t
    );
  }
}
class _N {
  constructor(e, t) {
    ((this.isInterleavedBuffer = !0),
      (this.array = e),
      (this.stride = t),
      (this.count = e !== void 0 ? e.length / t : 0),
      (this.usage = Ap),
      (this.updateRanges = []),
      (this.version = 0),
      (this.uuid = Y5()));
  }
  onUploadCallback() {}
  set needsUpdate(e) {
    e === !0 && this.version++;
  }
  setUsage(e) {
    return ((this.usage = e), this);
  }
  addUpdateRange(e, t) {
    this.updateRanges.push({ start: e, count: t });
  }
  clearUpdateRanges() {
    this.updateRanges.length = 0;
  }
  copy(e) {
    return (
      (this.array = new e.array.constructor(e.array)),
      (this.count = e.count),
      (this.stride = e.stride),
      (this.usage = e.usage),
      this
    );
  }
  copyAt(e, t, i) {
    ((e *= this.stride), (i *= t.stride));
    for (let r = 0, s = this.stride; r < s; r++)
      this.array[e + r] = t.array[i + r];
    return this;
  }
  set(e, t = 0) {
    return (this.array.set(e, t), this);
  }
  clone(e) {
    (e.arrayBuffers === void 0 && (e.arrayBuffers = {}),
      this.array.buffer._uuid === void 0 && (this.array.buffer._uuid = Y5()),
      e.arrayBuffers[this.array.buffer._uuid] === void 0 &&
        (e.arrayBuffers[this.array.buffer._uuid] = this.array.slice(0).buffer));
    const t = new this.array.constructor(
        e.arrayBuffers[this.array.buffer._uuid],
      ),
      i = new this.constructor(t, this.stride);
    return (i.setUsage(this.usage), i);
  }
  onUpload(e) {
    return ((this.onUploadCallback = e), this);
  }
  toJSON(e) {
    return (
      e.arrayBuffers === void 0 && (e.arrayBuffers = {}),
      this.array.buffer._uuid === void 0 && (this.array.buffer._uuid = Y5()),
      e.arrayBuffers[this.array.buffer._uuid] === void 0 &&
        (e.arrayBuffers[this.array.buffer._uuid] = Array.from(
          new Uint32Array(this.array.buffer),
        )),
      {
        uuid: this.uuid,
        buffer: this.array.buffer._uuid,
        type: this.array.constructor.name,
        stride: this.stride,
      }
    );
  }
}
const se = new H();
class Ll {
  constructor(e, t, i, r = !1) {
    ((this.isInterleavedBufferAttribute = !0),
      (this.name = ""),
      (this.data = e),
      (this.itemSize = t),
      (this.offset = i),
      (this.normalized = r));
  }
  get count() {
    return this.data.count;
  }
  get array() {
    return this.data.array;
  }
  set needsUpdate(e) {
    this.data.needsUpdate = e;
  }
  applyMatrix4(e) {
    for (let t = 0, i = this.data.count; t < i; t++)
      (se.fromBufferAttribute(this, t),
        se.applyMatrix4(e),
        this.setXYZ(t, se.x, se.y, se.z));
    return this;
  }
  applyNormalMatrix(e) {
    for (let t = 0, i = this.count; t < i; t++)
      (se.fromBufferAttribute(this, t),
        se.applyNormalMatrix(e),
        this.setXYZ(t, se.x, se.y, se.z));
    return this;
  }
  transformDirection(e) {
    for (let t = 0, i = this.count; t < i; t++)
      (se.fromBufferAttribute(this, t),
        se.transformDirection(e),
        this.setXYZ(t, se.x, se.y, se.z));
    return this;
  }
  getComponent(e, t) {
    let i = this.array[e * this.data.stride + this.offset + t];
    return (this.normalized && (i = Gt(i, this.array)), i);
  }
  setComponent(e, t, i) {
    return (
      this.normalized && (i = x9(i, this.array)),
      (this.data.array[e * this.data.stride + this.offset + t] = i),
      this
    );
  }
  setX(e, t) {
    return (
      this.normalized && (t = x9(t, this.array)),
      (this.data.array[e * this.data.stride + this.offset] = t),
      this
    );
  }
  setY(e, t) {
    return (
      this.normalized && (t = x9(t, this.array)),
      (this.data.array[e * this.data.stride + this.offset + 1] = t),
      this
    );
  }
  setZ(e, t) {
    return (
      this.normalized && (t = x9(t, this.array)),
      (this.data.array[e * this.data.stride + this.offset + 2] = t),
      this
    );
  }
  setW(e, t) {
    return (
      this.normalized && (t = x9(t, this.array)),
      (this.data.array[e * this.data.stride + this.offset + 3] = t),
      this
    );
  }
  getX(e) {
    let t = this.data.array[e * this.data.stride + this.offset];
    return (this.normalized && (t = Gt(t, this.array)), t);
  }
  getY(e) {
    let t = this.data.array[e * this.data.stride + this.offset + 1];
    return (this.normalized && (t = Gt(t, this.array)), t);
  }
  getZ(e) {
    let t = this.data.array[e * this.data.stride + this.offset + 2];
    return (this.normalized && (t = Gt(t, this.array)), t);
  }
  getW(e) {
    let t = this.data.array[e * this.data.stride + this.offset + 3];
    return (this.normalized && (t = Gt(t, this.array)), t);
  }
  setXY(e, t, i) {
    return (
      (e = e * this.data.stride + this.offset),
      this.normalized && ((t = x9(t, this.array)), (i = x9(i, this.array))),
      (this.data.array[e + 0] = t),
      (this.data.array[e + 1] = i),
      this
    );
  }
  setXYZ(e, t, i, r) {
    return (
      (e = e * this.data.stride + this.offset),
      this.normalized &&
        ((t = x9(t, this.array)),
        (i = x9(i, this.array)),
        (r = x9(r, this.array))),
      (this.data.array[e + 0] = t),
      (this.data.array[e + 1] = i),
      (this.data.array[e + 2] = r),
      this
    );
  }
  setXYZW(e, t, i, r, s) {
    return (
      (e = e * this.data.stride + this.offset),
      this.normalized &&
        ((t = x9(t, this.array)),
        (i = x9(i, this.array)),
        (r = x9(r, this.array)),
        (s = x9(s, this.array))),
      (this.data.array[e + 0] = t),
      (this.data.array[e + 1] = i),
      (this.data.array[e + 2] = r),
      (this.data.array[e + 3] = s),
      this
    );
  }
  clone(e) {
    if (e === void 0) {
      console.log(
        "THREE.InterleavedBufferAttribute.clone(): Cloning an interleaved buffer attribute will de-interleave buffer data.",
      );
      const t = [];
      for (let i = 0; i < this.count; i++) {
        const r = i * this.data.stride + this.offset;
        for (let s = 0; s < this.itemSize; s++) t.push(this.data.array[r + s]);
      }
      return new _0(
        new this.array.constructor(t),
        this.itemSize,
        this.normalized,
      );
    } else
      return (
        e.interleavedBuffers === void 0 && (e.interleavedBuffers = {}),
        e.interleavedBuffers[this.data.uuid] === void 0 &&
          (e.interleavedBuffers[this.data.uuid] = this.data.clone(e)),
        new Ll(
          e.interleavedBuffers[this.data.uuid],
          this.itemSize,
          this.offset,
          this.normalized,
        )
      );
  }
  toJSON(e) {
    if (e === void 0) {
      console.log(
        "THREE.InterleavedBufferAttribute.toJSON(): Serializing an interleaved buffer attribute will de-interleave buffer data.",
      );
      const t = [];
      for (let i = 0; i < this.count; i++) {
        const r = i * this.data.stride + this.offset;
        for (let s = 0; s < this.itemSize; s++) t.push(this.data.array[r + s]);
      }
      return {
        itemSize: this.itemSize,
        type: this.array.constructor.name,
        array: t,
        normalized: this.normalized,
      };
    } else
      return (
        e.interleavedBuffers === void 0 && (e.interleavedBuffers = {}),
        e.interleavedBuffers[this.data.uuid] === void 0 &&
          (e.interleavedBuffers[this.data.uuid] = this.data.toJSON(e)),
        {
          isInterleavedBufferAttribute: !0,
          itemSize: this.itemSize,
          data: this.data.uuid,
          offset: this.offset,
          normalized: this.normalized,
        }
      );
  }
}
class TG extends oa {
  constructor(e) {
    (super(),
      (this.isSpriteMaterial = !0),
      (this.type = "SpriteMaterial"),
      (this.color = new r9(16777215)),
      (this.map = null),
      (this.alphaMap = null),
      (this.rotation = 0),
      (this.sizeAttenuation = !0),
      (this.transparent = !0),
      (this.fog = !0),
      this.setValues(e));
  }
  copy(e) {
    return (
      super.copy(e),
      this.color.copy(e.color),
      (this.map = e.map),
      (this.alphaMap = e.alphaMap),
      (this.rotation = e.rotation),
      (this.sizeAttenuation = e.sizeAttenuation),
      (this.fog = e.fog),
      this
    );
  }
}
let Q4;
const Nr = new H(),
  J4 = new H(),
  ei = new H(),
  ti = new B2(),
  Or = new B2(),
  _G = new v2(),
  Ja = new H(),
  zr = new H(),
  e8 = new H(),
  yA = new B2(),
  su = new B2(),
  AA = new B2();
class GG extends Me {
  constructor(e = new TG()) {
    if (
      (super(), (this.isSprite = !0), (this.type = "Sprite"), Q4 === void 0)
    ) {
      Q4 = new t9();
      const t = new Float32Array([
          -0.5, -0.5, 0, 0, 0, 0.5, -0.5, 0, 1, 0, 0.5, 0.5, 0, 1, 1, -0.5, 0.5,
          0, 0, 1,
        ]),
        i = new _N(t, 5);
      (Q4.setIndex([0, 1, 2, 0, 2, 3]),
        Q4.setAttribute("position", new Ll(i, 3, 0, !1)),
        Q4.setAttribute("uv", new Ll(i, 2, 3, !1)));
    }
    ((this.geometry = Q4),
      (this.material = e),
      (this.center = new B2(0.5, 0.5)),
      (this.count = 1));
  }
  raycast(e, t) {
    (e.camera === null &&
      console.error(
        'THREE.Sprite: "Raycaster.camera" needs to be set in order to raycast against sprites.',
      ),
      J4.setFromMatrixScale(this.matrixWorld),
      _G.copy(e.camera.matrixWorld),
      this.modelViewMatrix.multiplyMatrices(
        e.camera.matrixWorldInverse,
        this.matrixWorld,
      ),
      ei.setFromMatrixPosition(this.modelViewMatrix),
      e.camera.isPerspectiveCamera &&
        this.material.sizeAttenuation === !1 &&
        J4.multiplyScalar(-ei.z));
    const i = this.material.rotation;
    let r, s;
    i !== 0 && ((s = Math.cos(i)), (r = Math.sin(i)));
    const o = this.center;
    (t8(Ja.set(-0.5, -0.5, 0), ei, o, J4, r, s),
      t8(zr.set(0.5, -0.5, 0), ei, o, J4, r, s),
      t8(e8.set(0.5, 0.5, 0), ei, o, J4, r, s),
      yA.set(0, 0),
      su.set(1, 0),
      AA.set(1, 1));
    let a = e.ray.intersectTriangle(Ja, zr, e8, !1, Nr);
    if (
      a === null &&
      (t8(zr.set(-0.5, 0.5, 0), ei, o, J4, r, s),
      su.set(0, 1),
      (a = e.ray.intersectTriangle(Ja, e8, zr, !1, Nr)),
      a === null)
    )
      return;
    const c = e.ray.origin.distanceTo(Nr);
    c < e.near ||
      c > e.far ||
      t.push({
        distance: c,
        point: Nr.clone(),
        uv: it.getInterpolation(Nr, Ja, zr, e8, yA, su, AA, new B2()),
        face: null,
        object: this,
      });
  }
  copy(e, t) {
    return (
      super.copy(e, t),
      e.center !== void 0 && this.center.copy(e.center),
      (this.material = e.material),
      this
    );
  }
}
function t8(n, e, t, i, r, s) {
  (ti.subVectors(n, t).addScalar(0.5).multiply(i),
    r !== void 0
      ? ((Or.x = s * ti.x - r * ti.y), (Or.y = r * ti.x + s * ti.y))
      : Or.copy(ti),
    n.copy(e),
    (n.x += Or.x),
    (n.y += Or.y),
    n.applyMatrix4(_G));
}
class J9 extends D9 {
  constructor(e = null, t = 1, i = 1, r, s, o, a, c, l = h9, u = h9, h, d) {
    (super(null, o, a, c, l, u, r, s, h, d),
      (this.isDataTexture = !0),
      (this.image = { data: e, width: t, height: i }),
      (this.generateMipmaps = !1),
      (this.flipY = !1),
      (this.unpackAlignment = 1));
  }
}
const ou = new H(),
  GN = new H(),
  BN = new W2();
class D3 {
  constructor(e = new H(1, 0, 0), t = 0) {
    ((this.isPlane = !0), (this.normal = e), (this.constant = t));
  }
  set(e, t) {
    return (this.normal.copy(e), (this.constant = t), this);
  }
  setComponents(e, t, i, r) {
    return (this.normal.set(e, t, i), (this.constant = r), this);
  }
  setFromNormalAndCoplanarPoint(e, t) {
    return (this.normal.copy(e), (this.constant = -t.dot(this.normal)), this);
  }
  setFromCoplanarPoints(e, t, i) {
    const r = ou.subVectors(i, t).cross(GN.subVectors(e, t)).normalize();
    return (this.setFromNormalAndCoplanarPoint(r, e), this);
  }
  copy(e) {
    return (this.normal.copy(e.normal), (this.constant = e.constant), this);
  }
  normalize() {
    const e = 1 / this.normal.length();
    return (this.normal.multiplyScalar(e), (this.constant *= e), this);
  }
  negate() {
    return ((this.constant *= -1), this.normal.negate(), this);
  }
  distanceToPoint(e) {
    return this.normal.dot(e) + this.constant;
  }
  distanceToSphere(e) {
    return this.distanceToPoint(e.center) - e.radius;
  }
  projectPoint(e, t) {
    return t.copy(e).addScaledVector(this.normal, -this.distanceToPoint(e));
  }
  intersectLine(e, t) {
    const i = e.delta(ou),
      r = this.normal.dot(i);
    if (r === 0)
      return this.distanceToPoint(e.start) === 0 ? t.copy(e.start) : null;
    const s = -(e.start.dot(this.normal) + this.constant) / r;
    return s < 0 || s > 1 ? null : t.copy(e.start).addScaledVector(i, s);
  }
  intersectsLine(e) {
    const t = this.distanceToPoint(e.start),
      i = this.distanceToPoint(e.end);
    return (t < 0 && i > 0) || (i < 0 && t > 0);
  }
  intersectsBox(e) {
    return e.intersectsPlane(this);
  }
  intersectsSphere(e) {
    return e.intersectsPlane(this);
  }
  coplanarPoint(e) {
    return e.copy(this.normal).multiplyScalar(-this.constant);
  }
  applyMatrix4(e, t) {
    const i = t || BN.getNormalMatrix(e),
      r = this.coplanarPoint(ou).applyMatrix4(e),
      s = this.normal.applyMatrix3(i).normalize();
    return ((this.constant = -r.dot(s)), this);
  }
  translate(e) {
    return ((this.constant -= e.dot(this.normal)), this);
  }
  equals(e) {
    return e.normal.equals(this.normal) && e.constant === this.constant;
  }
  clone() {
    return new this.constructor().copy(this);
  }
}
const A3 = new yr(),
  RN = new B2(0.5, 0.5),
  n8 = new H();
class BG {
  constructor(
    e = new D3(),
    t = new D3(),
    i = new D3(),
    r = new D3(),
    s = new D3(),
    o = new D3(),
  ) {
    this.planes = [e, t, i, r, s, o];
  }
  set(e, t, i, r, s, o) {
    const a = this.planes;
    return (
      a[0].copy(e),
      a[1].copy(t),
      a[2].copy(i),
      a[3].copy(r),
      a[4].copy(s),
      a[5].copy(o),
      this
    );
  }
  copy(e) {
    const t = this.planes;
    for (let i = 0; i < 6; i++) t[i].copy(e.planes[i]);
    return this;
  }
  setFromProjectionMatrix(e, t = W5) {
    const i = this.planes,
      r = e.elements,
      s = r[0],
      o = r[1],
      a = r[2],
      c = r[3],
      l = r[4],
      u = r[5],
      h = r[6],
      d = r[7],
      f = r[8],
      p = r[9],
      v = r[10],
      w = r[11],
      g = r[12],
      y = r[13],
      b = r[14],
      A = r[15];
    if (
      (i[0].setComponents(c - s, d - l, w - f, A - g).normalize(),
      i[1].setComponents(c + s, d + l, w + f, A + g).normalize(),
      i[2].setComponents(c + o, d + u, w + p, A + y).normalize(),
      i[3].setComponents(c - o, d - u, w - p, A - y).normalize(),
      i[4].setComponents(c - a, d - h, w - v, A - b).normalize(),
      t === W5)
    )
      i[5].setComponents(c + a, d + h, w + v, A + b).normalize();
    else if (t === Il) i[5].setComponents(a, h, v, b).normalize();
    else
      throw new Error(
        "THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: " +
          t,
      );
    return this;
  }
  intersectsObject(e) {
    if (e.boundingSphere !== void 0)
      (e.boundingSphere === null && e.computeBoundingSphere(),
        A3.copy(e.boundingSphere).applyMatrix4(e.matrixWorld));
    else {
      const t = e.geometry;
      (t.boundingSphere === null && t.computeBoundingSphere(),
        A3.copy(t.boundingSphere).applyMatrix4(e.matrixWorld));
    }
    return this.intersectsSphere(A3);
  }
  intersectsSprite(e) {
    A3.center.set(0, 0, 0);
    const t = RN.distanceTo(e.center);
    return (
      (A3.radius = 0.7071067811865476 + t),
      A3.applyMatrix4(e.matrixWorld),
      this.intersectsSphere(A3)
    );
  }
  intersectsSphere(e) {
    const t = this.planes,
      i = e.center,
      r = -e.radius;
    for (let s = 0; s < 6; s++) if (t[s].distanceToPoint(i) < r) return !1;
    return !0;
  }
  intersectsBox(e) {
    const t = this.planes;
    for (let i = 0; i < 6; i++) {
      const r = t[i];
      if (
        ((n8.x = r.normal.x > 0 ? e.max.x : e.min.x),
        (n8.y = r.normal.y > 0 ? e.max.y : e.min.y),
        (n8.z = r.normal.z > 0 ? e.max.z : e.min.z),
        r.distanceToPoint(n8) < 0)
      )
        return !1;
    }
    return !0;
  }
  containsPoint(e) {
    const t = this.planes;
    for (let i = 0; i < 6; i++) if (t[i].distanceToPoint(e) < 0) return !1;
    return !0;
  }
  clone() {
    return new this.constructor().copy(this);
  }
}
class IN extends D9 {
  constructor(e, t) {
    (super({ width: e, height: t }),
      (this.isFramebufferTexture = !0),
      (this.magFilter = h9),
      (this.minFilter = h9),
      (this.generateMipmaps = !1),
      (this.needsUpdate = !0));
  }
}
class Pl extends D9 {
  constructor(e, t, i, r, s, o, a, c, l, u, h, d) {
    (super(null, o, a, c, l, u, r, s, h, d),
      (this.isCompressedTexture = !0),
      (this.image = { width: t, height: i }),
      (this.mipmaps = e),
      (this.flipY = !1),
      (this.generateMipmaps = !1));
  }
}
class bA extends D9 {
  constructor(e, t, i, r, s, o, a, c, l) {
    (super(e, t, i, r, s, o, a, c, l),
      (this.isCanvasTexture = !0),
      (this.needsUpdate = !0));
  }
}
class RG extends D9 {
  constructor(e, t, i = A4, r, s, o, a = h9, c = h9, l, u = ho, h = 1) {
    if (u !== ho && u !== fo)
      throw new Error(
        "DepthTexture format must be either THREE.DepthFormat or THREE.DepthStencilFormat",
      );
    const d = { width: e, height: t, depth: h };
    (super(d, r, s, o, a, c, u, i, l),
      (this.isDepthTexture = !0),
      (this.flipY = !1),
      (this.generateMipmaps = !1),
      (this.compareFunction = null));
  }
  copy(e) {
    return (
      super.copy(e),
      (this.source = new km(Object.assign({}, e.image))),
      (this.compareFunction = e.compareFunction),
      this
    );
  }
  toJSON(e) {
    const t = super.toJSON(e);
    return (
      this.compareFunction !== null &&
        (t.compareFunction = this.compareFunction),
      t
    );
  }
}
class Ar extends t9 {
  constructor(e = 1, t = 1, i = 1, r = 1) {
    (super(),
      (this.type = "PlaneGeometry"),
      (this.parameters = {
        width: e,
        height: t,
        widthSegments: i,
        heightSegments: r,
      }));
    const s = e / 2,
      o = t / 2,
      a = Math.floor(i),
      c = Math.floor(r),
      l = a + 1,
      u = c + 1,
      h = e / a,
      d = t / c,
      f = [],
      p = [],
      v = [],
      w = [];
    for (let g = 0; g < u; g++) {
      const y = g * d - o;
      for (let b = 0; b < l; b++) {
        const A = b * h - s;
        (p.push(A, -y, 0), v.push(0, 0, 1), w.push(b / a), w.push(1 - g / c));
      }
    }
    for (let g = 0; g < c; g++)
      for (let y = 0; y < a; y++) {
        const b = y + l * g,
          A = y + l * (g + 1),
          x = y + 1 + l * (g + 1),
          M = y + 1 + l * g;
        (f.push(b, A, M), f.push(A, x, M));
      }
    (this.setIndex(f),
      this.setAttribute("position", new M1(p, 3)),
      this.setAttribute("normal", new M1(v, 3)),
      this.setAttribute("uv", new M1(w, 2)));
  }
  copy(e) {
    return (
      super.copy(e),
      (this.parameters = Object.assign({}, e.parameters)),
      this
    );
  }
  static fromJSON(e) {
    return new Ar(e.width, e.height, e.widthSegments, e.heightSegments);
  }
}
class Vt extends $1 {
  constructor(e) {
    (super(e),
      (this.isRawShaderMaterial = !0),
      (this.type = "RawShaderMaterial"));
  }
}
class kN extends oa {
  constructor(e) {
    (super(),
      (this.isMeshDepthMaterial = !0),
      (this.type = "MeshDepthMaterial"),
      (this.depthPacking = EV),
      (this.map = null),
      (this.alphaMap = null),
      (this.displacementMap = null),
      (this.displacementScale = 1),
      (this.displacementBias = 0),
      (this.wireframe = !1),
      (this.wireframeLinewidth = 1),
      this.setValues(e));
  }
  copy(e) {
    return (
      super.copy(e),
      (this.depthPacking = e.depthPacking),
      (this.map = e.map),
      (this.alphaMap = e.alphaMap),
      (this.displacementMap = e.displacementMap),
      (this.displacementScale = e.displacementScale),
      (this.displacementBias = e.displacementBias),
      (this.wireframe = e.wireframe),
      (this.wireframeLinewidth = e.wireframeLinewidth),
      this
    );
  }
}
class LN extends oa {
  constructor(e) {
    (super(),
      (this.isMeshDistanceMaterial = !0),
      (this.type = "MeshDistanceMaterial"),
      (this.map = null),
      (this.alphaMap = null),
      (this.displacementMap = null),
      (this.displacementScale = 1),
      (this.displacementBias = 0),
      this.setValues(e));
  }
  copy(e) {
    return (
      super.copy(e),
      (this.map = e.map),
      (this.alphaMap = e.alphaMap),
      (this.displacementMap = e.displacementMap),
      (this.displacementScale = e.displacementScale),
      (this.displacementBias = e.displacementBias),
      this
    );
  }
}
const ks = {
  enabled: !1,
  files: {},
  add: function (n, e) {
    this.enabled !== !1 && (this.files[n] = e);
  },
  get: function (n) {
    if (this.enabled !== !1) return this.files[n];
  },
  remove: function (n) {
    delete this.files[n];
  },
  clear: function () {
    this.files = {};
  },
};
class PN {
  constructor(e, t, i) {
    const r = this;
    let s = !1,
      o = 0,
      a = 0,
      c;
    const l = [];
    ((this.onStart = void 0),
      (this.onLoad = e),
      (this.onProgress = t),
      (this.onError = i),
      (this.itemStart = function (u) {
        (a++, s === !1 && r.onStart !== void 0 && r.onStart(u, o, a), (s = !0));
      }),
      (this.itemEnd = function (u) {
        (o++,
          r.onProgress !== void 0 && r.onProgress(u, o, a),
          o === a && ((s = !1), r.onLoad !== void 0 && r.onLoad()));
      }),
      (this.itemError = function (u) {
        r.onError !== void 0 && r.onError(u);
      }),
      (this.resolveURL = function (u) {
        return c ? c(u) : u;
      }),
      (this.setURLModifier = function (u) {
        return ((c = u), this);
      }),
      (this.addHandler = function (u, h) {
        return (l.push(u, h), this);
      }),
      (this.removeHandler = function (u) {
        const h = l.indexOf(u);
        return (h !== -1 && l.splice(h, 2), this);
      }),
      (this.getHandler = function (u) {
        for (let h = 0, d = l.length; h < d; h += 2) {
          const f = l[h],
            p = l[h + 1];
          if ((f.global && (f.lastIndex = 0), f.test(u))) return p;
        }
        return null;
      }));
  }
}
const FN = new PN();
class br {
  constructor(e) {
    ((this.manager = e !== void 0 ? e : FN),
      (this.crossOrigin = "anonymous"),
      (this.withCredentials = !1),
      (this.path = ""),
      (this.resourcePath = ""),
      (this.requestHeader = {}));
  }
  load() {}
  loadAsync(e, t) {
    const i = this;
    return new Promise(function (r, s) {
      i.load(e, r, t, s);
    });
  }
  parse() {}
  setCrossOrigin(e) {
    return ((this.crossOrigin = e), this);
  }
  setWithCredentials(e) {
    return ((this.withCredentials = e), this);
  }
  setPath(e) {
    return ((this.path = e), this);
  }
  setResourcePath(e) {
    return ((this.resourcePath = e), this);
  }
  setRequestHeader(e) {
    return ((this.requestHeader = e), this);
  }
}
br.DEFAULT_MATERIAL_NAME = "__DEFAULT";
const b5 = {};
class DN extends Error {
  constructor(e, t) {
    (super(e), (this.response = t));
  }
}
class IG extends br {
  constructor(e) {
    (super(e), (this.mimeType = ""), (this.responseType = ""));
  }
  load(e, t, i, r) {
    (e === void 0 && (e = ""),
      this.path !== void 0 && (e = this.path + e),
      (e = this.manager.resolveURL(e)));
    const s = ks.get(`file:${e}`);
    if (s !== void 0)
      return (
        this.manager.itemStart(e),
        setTimeout(() => {
          (t && t(s), this.manager.itemEnd(e));
        }, 0),
        s
      );
    if (b5[e] !== void 0) {
      b5[e].push({ onLoad: t, onProgress: i, onError: r });
      return;
    }
    ((b5[e] = []), b5[e].push({ onLoad: t, onProgress: i, onError: r }));
    const o = new Request(e, {
        headers: new Headers(this.requestHeader),
        credentials: this.withCredentials ? "include" : "same-origin",
      }),
      a = this.mimeType,
      c = this.responseType;
    (fetch(o)
      .then((l) => {
        if (l.status === 200 || l.status === 0) {
          if (
            (l.status === 0 &&
              console.warn("THREE.FileLoader: HTTP Status 0 received."),
            typeof ReadableStream > "u" ||
              l.body === void 0 ||
              l.body.getReader === void 0)
          )
            return l;
          const u = b5[e],
            h = l.body.getReader(),
            d = l.headers.get("X-File-Size") || l.headers.get("Content-Length"),
            f = d ? parseInt(d) : 0,
            p = f !== 0;
          let v = 0;
          const w = new ReadableStream({
            start(g) {
              y();
              function y() {
                h.read().then(
                  ({ done: b, value: A }) => {
                    if (b) g.close();
                    else {
                      v += A.byteLength;
                      const x = new ProgressEvent("progress", {
                        lengthComputable: p,
                        loaded: v,
                        total: f,
                      });
                      for (let M = 0, E = u.length; M < E; M++) {
                        const _ = u[M];
                        _.onProgress && _.onProgress(x);
                      }
                      (g.enqueue(A), y());
                    }
                  },
                  (b) => {
                    g.error(b);
                  },
                );
              }
            },
          });
          return new Response(w);
        } else
          throw new DN(
            `fetch for "${l.url}" responded with ${l.status}: ${l.statusText}`,
            l,
          );
      })
      .then((l) => {
        switch (c) {
          case "arraybuffer":
            return l.arrayBuffer();
          case "blob":
            return l.blob();
          case "document":
            return l.text().then((u) => new DOMParser().parseFromString(u, a));
          case "json":
            return l.json();
          default:
            if (a === "") return l.text();
            {
              const h = /charset="?([^;"\s]*)"?/i.exec(a),
                d = h && h[1] ? h[1].toLowerCase() : void 0,
                f = new TextDecoder(d);
              return l.arrayBuffer().then((p) => f.decode(p));
            }
        }
      })
      .then((l) => {
        ks.add(`file:${e}`, l);
        const u = b5[e];
        delete b5[e];
        for (let h = 0, d = u.length; h < d; h++) {
          const f = u[h];
          f.onLoad && f.onLoad(l);
        }
      })
      .catch((l) => {
        const u = b5[e];
        if (u === void 0) throw (this.manager.itemError(e), l);
        delete b5[e];
        for (let h = 0, d = u.length; h < d; h++) {
          const f = u[h];
          f.onError && f.onError(l);
        }
        this.manager.itemError(e);
      })
      .finally(() => {
        this.manager.itemEnd(e);
      }),
      this.manager.itemStart(e));
  }
  setResponseType(e) {
    return ((this.responseType = e), this);
  }
  setMimeType(e) {
    return ((this.mimeType = e), this);
  }
}
class VN extends br {
  constructor(e) {
    super(e);
  }
  load(e, t, i, r) {
    const s = this,
      o = [],
      a = new Pl(),
      c = new IG(this.manager);
    (c.setPath(this.path),
      c.setResponseType("arraybuffer"),
      c.setRequestHeader(this.requestHeader),
      c.setWithCredentials(s.withCredentials));
    let l = 0;
    function u(h) {
      c.load(
        e[h],
        function (d) {
          const f = s.parse(d, !0);
          ((o[h] = {
            width: f.width,
            height: f.height,
            format: f.format,
            mipmaps: f.mipmaps,
          }),
            (l += 1),
            l === 6 &&
              (f.mipmapCount === 1 && (a.minFilter = u9),
              (a.image = o),
              (a.format = f.format),
              (a.needsUpdate = !0),
              t && t(a)));
        },
        i,
        r,
      );
    }
    if (Array.isArray(e)) for (let h = 0, d = e.length; h < d; ++h) u(h);
    else
      c.load(
        e,
        function (h) {
          const d = s.parse(h, !0);
          if (d.isCubemap) {
            const f = d.mipmaps.length / d.mipmapCount;
            for (let p = 0; p < f; p++) {
              o[p] = { mipmaps: [] };
              for (let v = 0; v < d.mipmapCount; v++)
                (o[p].mipmaps.push(d.mipmaps[p * d.mipmapCount + v]),
                  (o[p].format = d.format),
                  (o[p].width = d.width),
                  (o[p].height = d.height));
            }
            a.image = o;
          } else
            ((a.image.width = d.width),
              (a.image.height = d.height),
              (a.mipmaps = d.mipmaps));
          (d.mipmapCount === 1 && (a.minFilter = u9),
            (a.format = d.format),
            (a.needsUpdate = !0),
            t && t(a));
        },
        i,
        r,
      );
    return a;
  }
}
const ni = new WeakMap();
class NN extends br {
  constructor(e) {
    super(e);
  }
  load(e, t, i, r) {
    (this.path !== void 0 && (e = this.path + e),
      (e = this.manager.resolveURL(e)));
    const s = this,
      o = ks.get(`image:${e}`);
    if (o !== void 0) {
      if (o.complete === !0)
        (s.manager.itemStart(e),
          setTimeout(function () {
            (t && t(o), s.manager.itemEnd(e));
          }, 0));
      else {
        let h = ni.get(o);
        (h === void 0 && ((h = []), ni.set(o, h)),
          h.push({ onLoad: t, onError: r }));
      }
      return o;
    }
    const a = go("img");
    function c() {
      (u(), t && t(this));
      const h = ni.get(this) || [];
      for (let d = 0; d < h.length; d++) {
        const f = h[d];
        f.onLoad && f.onLoad(this);
      }
      (ni.delete(this), s.manager.itemEnd(e));
    }
    function l(h) {
      (u(), r && r(h), ks.remove(`image:${e}`));
      const d = ni.get(this) || [];
      for (let f = 0; f < d.length; f++) {
        const p = d[f];
        p.onError && p.onError(h);
      }
      (ni.delete(this), s.manager.itemError(e), s.manager.itemEnd(e));
    }
    function u() {
      (a.removeEventListener("load", c, !1),
        a.removeEventListener("error", l, !1));
    }
    return (
      a.addEventListener("load", c, !1),
      a.addEventListener("error", l, !1),
      e.slice(0, 5) !== "data:" &&
        this.crossOrigin !== void 0 &&
        (a.crossOrigin = this.crossOrigin),
      ks.add(`image:${e}`, a),
      s.manager.itemStart(e),
      (a.src = e),
      a
    );
  }
}
class ON extends br {
  constructor(e) {
    super(e);
  }
  load(e, t, i, r) {
    const s = this,
      o = new J9(),
      a = new IG(this.manager);
    return (
      a.setResponseType("arraybuffer"),
      a.setRequestHeader(this.requestHeader),
      a.setPath(this.path),
      a.setWithCredentials(s.withCredentials),
      a.load(
        e,
        function (c) {
          let l;
          try {
            l = s.parse(c);
          } catch (u) {
            if (r !== void 0) r(u);
            else {
              console.error(u);
              return;
            }
          }
          (l.image !== void 0
            ? (o.image = l.image)
            : l.data !== void 0 &&
              ((o.image.width = l.width),
              (o.image.height = l.height),
              (o.image.data = l.data)),
            (o.wrapS = l.wrapS !== void 0 ? l.wrapS : F1),
            (o.wrapT = l.wrapT !== void 0 ? l.wrapT : F1),
            (o.magFilter = l.magFilter !== void 0 ? l.magFilter : u9),
            (o.minFilter = l.minFilter !== void 0 ? l.minFilter : u9),
            (o.anisotropy = l.anisotropy !== void 0 ? l.anisotropy : 1),
            l.colorSpace !== void 0 && (o.colorSpace = l.colorSpace),
            l.flipY !== void 0 && (o.flipY = l.flipY),
            l.format !== void 0 && (o.format = l.format),
            l.type !== void 0 && (o.type = l.type),
            l.mipmaps !== void 0 &&
              ((o.mipmaps = l.mipmaps), (o.minFilter = e5)),
            l.mipmapCount === 1 && (o.minFilter = u9),
            l.generateMipmaps !== void 0 &&
              (o.generateMipmaps = l.generateMipmaps),
            (o.needsUpdate = !0),
            t && t(o, l));
        },
        i,
        r,
      ),
      o
    );
  }
}
class zN extends br {
  constructor(e) {
    super(e);
  }
  load(e, t, i, r) {
    const s = new D9(),
      o = new NN(this.manager);
    return (
      o.setCrossOrigin(this.crossOrigin),
      o.setPath(this.path),
      o.load(
        e,
        function (a) {
          ((s.image = a), (s.needsUpdate = !0), t !== void 0 && t(s));
        },
        i,
        r,
      ),
      s
    );
  }
}
class Fm extends a5 {
  constructor(e = -1, t = 1, i = 1, r = -1, s = 0.1, o = 2e3) {
    (super(),
      (this.isOrthographicCamera = !0),
      (this.type = "OrthographicCamera"),
      (this.zoom = 1),
      (this.view = null),
      (this.left = e),
      (this.right = t),
      (this.top = i),
      (this.bottom = r),
      (this.near = s),
      (this.far = o),
      this.updateProjectionMatrix());
  }
  copy(e, t) {
    return (
      super.copy(e, t),
      (this.left = e.left),
      (this.right = e.right),
      (this.top = e.top),
      (this.bottom = e.bottom),
      (this.near = e.near),
      (this.far = e.far),
      (this.zoom = e.zoom),
      (this.view = e.view === null ? null : Object.assign({}, e.view)),
      this
    );
  }
  setViewOffset(e, t, i, r, s, o) {
    (this.view === null &&
      (this.view = {
        enabled: !0,
        fullWidth: 1,
        fullHeight: 1,
        offsetX: 0,
        offsetY: 0,
        width: 1,
        height: 1,
      }),
      (this.view.enabled = !0),
      (this.view.fullWidth = e),
      (this.view.fullHeight = t),
      (this.view.offsetX = i),
      (this.view.offsetY = r),
      (this.view.width = s),
      (this.view.height = o),
      this.updateProjectionMatrix());
  }
  clearViewOffset() {
    (this.view !== null && (this.view.enabled = !1),
      this.updateProjectionMatrix());
  }
  updateProjectionMatrix() {
    const e = (this.right - this.left) / (2 * this.zoom),
      t = (this.top - this.bottom) / (2 * this.zoom),
      i = (this.right + this.left) / 2,
      r = (this.top + this.bottom) / 2;
    let s = i - e,
      o = i + e,
      a = r + t,
      c = r - t;
    if (this.view !== null && this.view.enabled) {
      const l = (this.right - this.left) / this.view.fullWidth / this.zoom,
        u = (this.top - this.bottom) / this.view.fullHeight / this.zoom;
      ((s += l * this.view.offsetX),
        (o = s + l * this.view.width),
        (a -= u * this.view.offsetY),
        (c = a - u * this.view.height));
    }
    (this.projectionMatrix.makeOrthographic(
      s,
      o,
      a,
      c,
      this.near,
      this.far,
      this.coordinateSystem,
    ),
      this.projectionMatrixInverse.copy(this.projectionMatrix).invert());
  }
  toJSON(e) {
    const t = super.toJSON(e);
    return (
      (t.object.zoom = this.zoom),
      (t.object.left = this.left),
      (t.object.right = this.right),
      (t.object.top = this.top),
      (t.object.bottom = this.bottom),
      (t.object.near = this.near),
      (t.object.far = this.far),
      this.view !== null && (t.object.view = Object.assign({}, this.view)),
      t
    );
  }
}
class UN extends Z9 {
  constructor(e = []) {
    (super(),
      (this.isArrayCamera = !0),
      (this.isMultiViewCamera = !1),
      (this.cameras = e));
  }
}
function MA(n, e, t, i) {
  const r = $N(i);
  switch (t) {
    case fG:
      return n * e;
    case gG:
      return ((n * e) / r.components) * r.byteLength;
    case Gm:
      return ((n * e) / r.components) * r.byteLength;
    case mG:
      return ((n * e * 2) / r.components) * r.byteLength;
    case Bm:
      return ((n * e * 2) / r.components) * r.byteLength;
    case pG:
      return ((n * e * 3) / r.components) * r.byteLength;
    case e9:
      return ((n * e * 4) / r.components) * r.byteLength;
    case Rm:
      return ((n * e * 4) / r.components) * r.byteLength;
    case u4:
    case $i:
      return Math.floor((n + 3) / 4) * Math.floor((e + 3) / 4) * 8;
    case Wi:
    case Hi:
      return Math.floor((n + 3) / 4) * Math.floor((e + 3) / 4) * 16;
    case Qf:
    case ep:
      return (Math.max(n, 16) * Math.max(e, 8)) / 4;
    case Zf:
    case Jf:
      return (Math.max(n, 8) * Math.max(e, 8)) / 2;
    case _l:
    case tp:
      return Math.floor((n + 3) / 4) * Math.floor((e + 3) / 4) * 8;
    case np:
      return Math.floor((n + 3) / 4) * Math.floor((e + 3) / 4) * 16;
    case ip:
      return Math.floor((n + 3) / 4) * Math.floor((e + 3) / 4) * 16;
    case rp:
      return Math.floor((n + 4) / 5) * Math.floor((e + 3) / 4) * 16;
    case sp:
      return Math.floor((n + 4) / 5) * Math.floor((e + 4) / 5) * 16;
    case op:
      return Math.floor((n + 5) / 6) * Math.floor((e + 4) / 5) * 16;
    case ap:
      return Math.floor((n + 5) / 6) * Math.floor((e + 5) / 6) * 16;
    case cp:
      return Math.floor((n + 7) / 8) * Math.floor((e + 4) / 5) * 16;
    case lp:
      return Math.floor((n + 7) / 8) * Math.floor((e + 5) / 6) * 16;
    case up:
      return Math.floor((n + 7) / 8) * Math.floor((e + 7) / 8) * 16;
    case hp:
      return Math.floor((n + 9) / 10) * Math.floor((e + 4) / 5) * 16;
    case dp:
      return Math.floor((n + 9) / 10) * Math.floor((e + 5) / 6) * 16;
    case fp:
      return Math.floor((n + 9) / 10) * Math.floor((e + 7) / 8) * 16;
    case pp:
      return Math.floor((n + 9) / 10) * Math.floor((e + 9) / 10) * 16;
    case gp:
      return Math.floor((n + 11) / 12) * Math.floor((e + 9) / 10) * 16;
    case mp:
      return Math.floor((n + 11) / 12) * Math.floor((e + 11) / 12) * 16;
    case Oc:
    case Gl:
    case Bl:
      return Math.ceil(n / 4) * Math.ceil(e / 4) * 16;
    case wG:
    case wp:
      return Math.ceil(n / 4) * Math.ceil(e / 4) * 8;
    case vp:
    case yp:
      return Math.ceil(n / 4) * Math.ceil(e / 4) * 16;
  }
  throw new Error(`Unable to determine texture byte length for ${t} format.`);
}
function $N(n) {
  switch (n) {
    case _9:
    case uG:
      return { byteLength: 1, components: 1 };
    case lo:
    case hG:
    case sa:
      return { byteLength: 2, components: 1 };
    case Tm:
    case _m:
      return { byteLength: 2, components: 4 };
    case A4:
    case Em:
    case $5:
      return { byteLength: 4, components: 1 };
    case dG:
      return { byteLength: 4, components: 3 };
  }
  throw new Error(`Unknown texture type ${n}.`);
}
typeof __THREE_DEVTOOLS__ < "u" &&
  __THREE_DEVTOOLS__.dispatchEvent(
    new CustomEvent("register", { detail: { revision: vm } }),
  );
typeof window < "u" &&
  (window.__THREE__
    ? console.warn("WARNING: Multiple instances of Three.js being imported.")
    : (window.__THREE__ = vm));
function kG() {
  let n = null,
    e = !1,
    t = null,
    i = null;
  function r(s, o) {
    (t(s, o), (i = n.requestAnimationFrame(r)));
  }
  return {
    start: function () {
      e !== !0 && t !== null && ((i = n.requestAnimationFrame(r)), (e = !0));
    },
    stop: function () {
      (n.cancelAnimationFrame(i), (e = !1));
    },
    setAnimationLoop: function (s) {
      t = s;
    },
    setContext: function (s) {
      n = s;
    },
  };
}
function WN(n) {
  const e = new WeakMap();
  function t(a, c) {
    const l = a.array,
      u = a.usage,
      h = l.byteLength,
      d = n.createBuffer();
    (n.bindBuffer(c, d), n.bufferData(c, l, u), a.onUploadCallback());
    let f;
    if (l instanceof Float32Array) f = n.FLOAT;
    else if (typeof Float16Array < "u" && l instanceof Float16Array)
      f = n.HALF_FLOAT;
    else if (l instanceof Uint16Array)
      a.isFloat16BufferAttribute ? (f = n.HALF_FLOAT) : (f = n.UNSIGNED_SHORT);
    else if (l instanceof Int16Array) f = n.SHORT;
    else if (l instanceof Uint32Array) f = n.UNSIGNED_INT;
    else if (l instanceof Int32Array) f = n.INT;
    else if (l instanceof Int8Array) f = n.BYTE;
    else if (l instanceof Uint8Array) f = n.UNSIGNED_BYTE;
    else if (l instanceof Uint8ClampedArray) f = n.UNSIGNED_BYTE;
    else
      throw new Error(
        "THREE.WebGLAttributes: Unsupported buffer data format: " + l,
      );
    return {
      buffer: d,
      type: f,
      bytesPerElement: l.BYTES_PER_ELEMENT,
      version: a.version,
      size: h,
    };
  }
  function i(a, c, l) {
    const u = c.array,
      h = c.updateRanges;
    if ((n.bindBuffer(l, a), h.length === 0)) n.bufferSubData(l, 0, u);
    else {
      h.sort((f, p) => f.start - p.start);
      let d = 0;
      for (let f = 1; f < h.length; f++) {
        const p = h[d],
          v = h[f];
        v.start <= p.start + p.count + 1
          ? (p.count = Math.max(p.count, v.start + v.count - p.start))
          : (++d, (h[d] = v));
      }
      h.length = d + 1;
      for (let f = 0, p = h.length; f < p; f++) {
        const v = h[f];
        n.bufferSubData(l, v.start * u.BYTES_PER_ELEMENT, u, v.start, v.count);
      }
      c.clearUpdateRanges();
    }
    c.onUploadCallback();
  }
  function r(a) {
    return (a.isInterleavedBufferAttribute && (a = a.data), e.get(a));
  }
  function s(a) {
    a.isInterleavedBufferAttribute && (a = a.data);
    const c = e.get(a);
    c && (n.deleteBuffer(c.buffer), e.delete(a));
  }
  function o(a, c) {
    if (
      (a.isInterleavedBufferAttribute && (a = a.data), a.isGLBufferAttribute)
    ) {
      const u = e.get(a);
      (!u || u.version < a.version) &&
        e.set(a, {
          buffer: a.buffer,
          type: a.type,
          bytesPerElement: a.elementSize,
          version: a.version,
        });
      return;
    }
    const l = e.get(a);
    if (l === void 0) e.set(a, t(a, c));
    else if (l.version < a.version) {
      if (l.size !== a.array.byteLength)
        throw new Error(
          "THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.",
        );
      (i(l.buffer, a, c), (l.version = a.version));
    }
  }
  return { get: r, remove: s, update: o };
}
var HN = `#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,
  qN = `#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,
  KN = `#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,
  jN = `#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,
  XN = `#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,
  YN = `#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,
  ZN = `#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,
  QN = `#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,
  JN = `#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec3 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 ).rgb;
	}
#endif`,
  eO = `#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,
  tO = `vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,
  nO = `vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,
  iO = `float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,
  rO = `#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,
  sO = `#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,
  oO = `#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,
  aO = `#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,
  cO = `#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,
  lO = `#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,
  uO = `#if defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#elif defined( USE_COLOR )
	diffuseColor.rgb *= vColor;
#endif`,
  hO = `#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR )
	varying vec3 vColor;
#endif`,
  dO = `#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec3 vColor;
#endif`,
  fO = `#if defined( USE_COLOR_ALPHA )
	vColor = vec4( 1.0 );
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec3( 1.0 );
#endif
#ifdef USE_COLOR
	vColor *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.xyz *= instanceColor.xyz;
#endif
#ifdef USE_BATCHING_COLOR
	vec3 batchingColor = getBatchingColor( getIndirectIndex( gl_DrawID ) );
	vColor.xyz *= batchingColor.xyz;
#endif`,
  pO = `#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
vec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );
}
mat3 transposeMat3( const in mat3 m ) {
	mat3 tmp;
	tmp[ 0 ] = vec3( m[ 0 ].x, m[ 1 ].x, m[ 2 ].x );
	tmp[ 1 ] = vec3( m[ 0 ].y, m[ 1 ].y, m[ 2 ].y );
	tmp[ 2 ] = vec3( m[ 0 ].z, m[ 1 ].z, m[ 2 ].z );
	return tmp;
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,
  gO = `#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,
  mO = `vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
	#ifdef FLIP_SIDED
		transformedTangent = - transformedTangent;
	#endif
#endif`,
  wO = `#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,
  vO = `#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,
  yO = `#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,
  AO = `#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,
  bO = "gl_FragColor = linearToOutputTexel( gl_FragColor );",
  MO = `vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,
  xO = `#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * vec3( flipEnvMap * reflectVec.x, reflectVec.yz ) );
	#else
		vec4 envColor = vec4( 0.0 );
	#endif
	#ifdef ENVMAP_BLENDING_MULTIPLY
		outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_MIX )
		outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_ADD )
		outgoingLight += envColor.xyz * specularStrength * reflectivity;
	#endif
#endif`,
  SO = `#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform float flipEnvMap;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
	
#endif`,
  CO = `#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,
  EO = `#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,
  TO = `#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,
  _O = `#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,
  GO = `#ifdef USE_FOG
	varying float vFogDepth;
#endif`,
  BO = `#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,
  RO = `#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,
  IO = `#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,
  kO = `#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,
  LO = `LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,
  PO = `varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,
  FO = `uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif`,
  DO = `#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, roughness * roughness) );
			reflectVec = inverseTransformDirection( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
#endif`,
  VO = `ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,
  NO = `varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,
  OO = `BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,
  zO = `varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,
  UO = `PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb * ( 1.0 - metalnessFactor );
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = mix( min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = mix( vec3( 0.04 ), diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.07, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,
  $O = `struct PhysicalMaterial {
	vec3 diffuseColor;
	float roughness;
	vec3 specularColor;
	float specularF90;
	float dispersion;
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		float v = 0.5 / ( gv + gl );
		return saturate(v);
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColor;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transposeMat3( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float a = roughness < 0.25 ? -339.2 * r2 + 161.4 * roughness - 25.9 : -8.48 * r2 + 14.3 * roughness - 9.95;
	float b = roughness < 0.25 ? 44.0 * r2 - 23.7 * roughness + 3.26 : 1.97 * r2 - 3.27 * roughness + 0.72;
	float DG = exp( a * dotNV + b ) + ( roughness < 0.25 ? 0.0 : 0.1 * ( roughness - 0.25 ) );
	return saturate( DG * RECIPROCAL_PI );
}
vec2 DFGApprox( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	const vec4 c0 = vec4( - 1, - 0.0275, - 0.572, 0.022 );
	const vec4 c1 = vec4( 1, 0.0425, 1.04, - 0.04 );
	vec4 r = roughness * c0 + c1;
	float a004 = min( r.x * r.x, exp2( - 9.28 * dotNV ) ) * r.x + r.y;
	vec2 fab = vec2( - 1.04, 1.04 ) * a004 + r.zw;
	return fab;
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColor * t2.x + ( vec3( 1.0 ) - material.specularColor ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseColor * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
	#endif
	reflectedLight.directSpecular += irradiance * BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
	#endif
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.iridescence, material.iridescenceFresnel, material.roughness, singleScattering, multiScattering );
	#else
		computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScattering, multiScattering );
	#endif
	vec3 totalScattering = singleScattering + multiScattering;
	vec3 diffuse = material.diffuseColor * ( 1.0 - max( max( totalScattering.r, totalScattering.g ), totalScattering.b ) );
	reflectedLight.indirectSpecular += radiance * singleScattering;
	reflectedLight.indirectSpecular += multiScattering * cosineWeightedIrradiance;
	reflectedLight.indirectDiffuse += diffuse * cosineWeightedIrradiance;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,
  WO = `
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		material.iridescenceFresnel = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		material.iridescenceF0 = Schlick_to_F0( material.iridescenceFresnel, 1.0, dotNVi );
	}
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,
  HO = `#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD ) && defined( ENVMAP_TYPE_CUBE_UV )
		iblIrradiance += getIBLIrradiance( geometryNormal );
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		radiance += getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,
  qO = `#if defined( RE_IndirectDiffuse )
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,
  KO = `#if defined( USE_LOGDEPTHBUF )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,
  jO = `#if defined( USE_LOGDEPTHBUF )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,
  XO = `#ifdef USE_LOGDEPTHBUF
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,
  YO = `#ifdef USE_LOGDEPTHBUF
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,
  ZO = `#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,
  QO = `#ifdef USE_MAP
	uniform sampler2D map;
#endif`,
  JO = `#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,
  ez = `#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,
  tz = `float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,
  nz = `#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,
  iz = `#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,
  rz = `#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,
  sz = `#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,
  oz = `#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,
  az = `#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,
  cz = `float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,
  lz = `#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,
  uz = `#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,
  hz = `#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,
  dz = `#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
	#endif
#endif`,
  fz = `#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,
  pz = `#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,
  gz = `#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,
  mz = `#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,
  wz = `#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,
  vz = `#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,
  yz = `vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return depth * ( near - far ) - near;
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return ( near * far ) / ( ( far - near ) * depth - far );
}`,
  Az = `#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,
  bz = `vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,
  Mz = `#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,
  xz = `#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,
  Sz = `float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,
  Cz = `#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,
  Ez = `#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform sampler2D pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	float texture2DCompare( sampler2D depths, vec2 uv, float compare ) {
		return step( compare, unpackRGBAToDepth( texture2D( depths, uv ) ) );
	}
	vec2 texture2DDistribution( sampler2D shadow, vec2 uv ) {
		return unpackRGBATo2Half( texture2D( shadow, uv ) );
	}
	float VSMShadow (sampler2D shadow, vec2 uv, float compare ){
		float occlusion = 1.0;
		vec2 distribution = texture2DDistribution( shadow, uv );
		float hard_shadow = step( compare , distribution.x );
		if (hard_shadow != 1.0 ) {
			float distance = compare - distribution.x ;
			float variance = max( 0.00000, distribution.y * distribution.y );
			float softness_probability = variance / (variance + distance * distance );			softness_probability = clamp( ( softness_probability - 0.3 ) / ( 0.95 - 0.3 ), 0.0, 1.0 );			occlusion = clamp( max( hard_shadow, softness_probability ), 0.0, 1.0 );
		}
		return occlusion;
	}
	float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
		float shadow = 1.0;
		shadowCoord.xyz /= shadowCoord.w;
		shadowCoord.z += shadowBias;
		bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
		bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
		if ( frustumTest ) {
		#if defined( SHADOWMAP_TYPE_PCF )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx0 = - texelSize.x * shadowRadius;
			float dy0 = - texelSize.y * shadowRadius;
			float dx1 = + texelSize.x * shadowRadius;
			float dy1 = + texelSize.y * shadowRadius;
			float dx2 = dx0 / 2.0;
			float dy2 = dy0 / 2.0;
			float dx3 = dx1 / 2.0;
			float dy3 = dy1 / 2.0;
			shadow = (
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy1 ), shadowCoord.z )
			) * ( 1.0 / 17.0 );
		#elif defined( SHADOWMAP_TYPE_PCF_SOFT )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx = texelSize.x;
			float dy = texelSize.y;
			vec2 uv = shadowCoord.xy;
			vec2 f = fract( uv * shadowMapSize + 0.5 );
			uv -= f * texelSize;
			shadow = (
				texture2DCompare( shadowMap, uv, shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( dx, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( 0.0, dy ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + texelSize, shadowCoord.z ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, 0.0 ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 0.0 ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, dy ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( 0.0, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 0.0, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( texture2DCompare( shadowMap, uv + vec2( dx, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( dx, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( mix( texture2DCompare( shadowMap, uv + vec2( -dx, -dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, -dy ), shadowCoord.z ),
						  f.x ),
					 mix( texture2DCompare( shadowMap, uv + vec2( -dx, 2.0 * dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 2.0 * dy ), shadowCoord.z ),
						  f.x ),
					 f.y )
			) * ( 1.0 / 9.0 );
		#elif defined( SHADOWMAP_TYPE_VSM )
			shadow = VSMShadow( shadowMap, shadowCoord.xy, shadowCoord.z );
		#else
			shadow = texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z );
		#endif
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	vec2 cubeToUV( vec3 v, float texelSizeY ) {
		vec3 absV = abs( v );
		float scaleToCube = 1.0 / max( absV.x, max( absV.y, absV.z ) );
		absV *= scaleToCube;
		v *= scaleToCube * ( 1.0 - 2.0 * texelSizeY );
		vec2 planar = v.xy;
		float almostATexel = 1.5 * texelSizeY;
		float almostOne = 1.0 - almostATexel;
		if ( absV.z >= almostOne ) {
			if ( v.z > 0.0 )
				planar.x = 4.0 - v.x;
		} else if ( absV.x >= almostOne ) {
			float signX = sign( v.x );
			planar.x = v.z * signX + 2.0 * signX;
		} else if ( absV.y >= almostOne ) {
			float signY = sign( v.y );
			planar.x = v.x + 2.0 * signY + 2.0;
			planar.y = v.z * signY - 2.0;
		}
		return vec2( 0.125, 0.25 ) * planar + vec2( 0.375, 0.75 );
	}
	float getPointShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		
		float lightToPositionLength = length( lightToPosition );
		if ( lightToPositionLength - shadowCameraFar <= 0.0 && lightToPositionLength - shadowCameraNear >= 0.0 ) {
			float dp = ( lightToPositionLength - shadowCameraNear ) / ( shadowCameraFar - shadowCameraNear );			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			vec2 texelSize = vec2( 1.0 ) / ( shadowMapSize * vec2( 4.0, 2.0 ) );
			#if defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_PCF_SOFT ) || defined( SHADOWMAP_TYPE_VSM )
				vec2 offset = vec2( - 1, 1 ) * shadowRadius * texelSize.y;
				shadow = (
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxx, texelSize.y ), dp )
				) * ( 1.0 / 9.0 );
			#else
				shadow = texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp );
			#endif
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
#endif`,
  Tz = `#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,
  _z = `#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	vec3 shadowWorldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,
  Gz = `float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,
  Bz = `#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,
  Rz = `#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,
  Iz = `#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,
  kz = `#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,
  Lz = `float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,
  Pz = `#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,
  Fz = `#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,
  Dz = `#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,
  Vz = `#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = inverseTransformDirection( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseColor, material.specularColor, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,
  Nz = `#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		#else
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,
  Oz = `#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,
  zz = `#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,
  Uz = `#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,
  $z = `#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`;
const Wz = `varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,
  Hz = `uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,
  qz = `varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,
  Kz = `#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float flipEnvMap;
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vec3( flipEnvMap * vWorldDirection.x, vWorldDirection.yz ) );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,
  jz = `varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,
  Xz = `uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,
  Yz = `#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,
  Zz = `#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	float fragCoordZ = 0.5 * vHighPrecisionZW[0] / vHighPrecisionZW[1] + 0.5;
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,
  Qz = `#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,
  Jz = `#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main () {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = packDepthToRGBA( dist );
}`,
  eU = `varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,
  tU = `uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,
  nU = `uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,
  iU = `uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,
  rU = `#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,
  sU = `uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,
  oU = `#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,
  aU = `#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,
  cU = `#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,
  lU = `#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,
  uU = `#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,
  hU = `#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <packing>
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( packNormalToRGB( normal ), diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,
  dU = `#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,
  fU = `#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,
  pU = `#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,
  gU = `#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
		float sheenEnergyComp = 1.0 - 0.157 * max3( material.sheenColor );
		outgoingLight = outgoingLight * sheenEnergyComp + sheenSpecularDirect + sheenSpecularIndirect;
	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,
  mU = `#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,
  wU = `#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,
  vU = `uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,
  yU = `uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,
  AU = `#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,
  bU = `uniform vec3 color;
uniform float opacity;
#include <common>
#include <packing>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,
  MU = `uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,
  xU = `uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,
  z2 = {
    alphahash_fragment: HN,
    alphahash_pars_fragment: qN,
    alphamap_fragment: KN,
    alphamap_pars_fragment: jN,
    alphatest_fragment: XN,
    alphatest_pars_fragment: YN,
    aomap_fragment: ZN,
    aomap_pars_fragment: QN,
    batching_pars_vertex: JN,
    batching_vertex: eO,
    begin_vertex: tO,
    beginnormal_vertex: nO,
    bsdfs: iO,
    iridescence_fragment: rO,
    bumpmap_pars_fragment: sO,
    clipping_planes_fragment: oO,
    clipping_planes_pars_fragment: aO,
    clipping_planes_pars_vertex: cO,
    clipping_planes_vertex: lO,
    color_fragment: uO,
    color_pars_fragment: hO,
    color_pars_vertex: dO,
    color_vertex: fO,
    common: pO,
    cube_uv_reflection_fragment: gO,
    defaultnormal_vertex: mO,
    displacementmap_pars_vertex: wO,
    displacementmap_vertex: vO,
    emissivemap_fragment: yO,
    emissivemap_pars_fragment: AO,
    colorspace_fragment: bO,
    colorspace_pars_fragment: MO,
    envmap_fragment: xO,
    envmap_common_pars_fragment: SO,
    envmap_pars_fragment: CO,
    envmap_pars_vertex: EO,
    envmap_physical_pars_fragment: DO,
    envmap_vertex: TO,
    fog_vertex: _O,
    fog_pars_vertex: GO,
    fog_fragment: BO,
    fog_pars_fragment: RO,
    gradientmap_pars_fragment: IO,
    lightmap_pars_fragment: kO,
    lights_lambert_fragment: LO,
    lights_lambert_pars_fragment: PO,
    lights_pars_begin: FO,
    lights_toon_fragment: VO,
    lights_toon_pars_fragment: NO,
    lights_phong_fragment: OO,
    lights_phong_pars_fragment: zO,
    lights_physical_fragment: UO,
    lights_physical_pars_fragment: $O,
    lights_fragment_begin: WO,
    lights_fragment_maps: HO,
    lights_fragment_end: qO,
    logdepthbuf_fragment: KO,
    logdepthbuf_pars_fragment: jO,
    logdepthbuf_pars_vertex: XO,
    logdepthbuf_vertex: YO,
    map_fragment: ZO,
    map_pars_fragment: QO,
    map_particle_fragment: JO,
    map_particle_pars_fragment: ez,
    metalnessmap_fragment: tz,
    metalnessmap_pars_fragment: nz,
    morphinstance_vertex: iz,
    morphcolor_vertex: rz,
    morphnormal_vertex: sz,
    morphtarget_pars_vertex: oz,
    morphtarget_vertex: az,
    normal_fragment_begin: cz,
    normal_fragment_maps: lz,
    normal_pars_fragment: uz,
    normal_pars_vertex: hz,
    normal_vertex: dz,
    normalmap_pars_fragment: fz,
    clearcoat_normal_fragment_begin: pz,
    clearcoat_normal_fragment_maps: gz,
    clearcoat_pars_fragment: mz,
    iridescence_pars_fragment: wz,
    opaque_fragment: vz,
    packing: yz,
    premultiplied_alpha_fragment: Az,
    project_vertex: bz,
    dithering_fragment: Mz,
    dithering_pars_fragment: xz,
    roughnessmap_fragment: Sz,
    roughnessmap_pars_fragment: Cz,
    shadowmap_pars_fragment: Ez,
    shadowmap_pars_vertex: Tz,
    shadowmap_vertex: _z,
    shadowmask_pars_fragment: Gz,
    skinbase_vertex: Bz,
    skinning_pars_vertex: Rz,
    skinning_vertex: Iz,
    skinnormal_vertex: kz,
    specularmap_fragment: Lz,
    specularmap_pars_fragment: Pz,
    tonemapping_fragment: Fz,
    tonemapping_pars_fragment: Dz,
    transmission_fragment: Vz,
    transmission_pars_fragment: Nz,
    uv_pars_fragment: Oz,
    uv_pars_vertex: zz,
    uv_vertex: Uz,
    worldpos_vertex: $z,
    background_vert: Wz,
    background_frag: Hz,
    backgroundCube_vert: qz,
    backgroundCube_frag: Kz,
    cube_vert: jz,
    cube_frag: Xz,
    depth_vert: Yz,
    depth_frag: Zz,
    distanceRGBA_vert: Qz,
    distanceRGBA_frag: Jz,
    equirect_vert: eU,
    equirect_frag: tU,
    linedashed_vert: nU,
    linedashed_frag: iU,
    meshbasic_vert: rU,
    meshbasic_frag: sU,
    meshlambert_vert: oU,
    meshlambert_frag: aU,
    meshmatcap_vert: cU,
    meshmatcap_frag: lU,
    meshnormal_vert: uU,
    meshnormal_frag: hU,
    meshphong_vert: dU,
    meshphong_frag: fU,
    meshphysical_vert: pU,
    meshphysical_frag: gU,
    meshtoon_vert: mU,
    meshtoon_frag: wU,
    points_vert: vU,
    points_frag: yU,
    shadow_vert: AU,
    shadow_frag: bU,
    sprite_vert: MU,
    sprite_frag: xU,
  },
  K0 = {
    common: {
      diffuse: { value: new r9(16777215) },
      opacity: { value: 1 },
      map: { value: null },
      mapTransform: { value: new W2() },
      alphaMap: { value: null },
      alphaMapTransform: { value: new W2() },
      alphaTest: { value: 0 },
    },
    specularmap: {
      specularMap: { value: null },
      specularMapTransform: { value: new W2() },
    },
    envmap: {
      envMap: { value: null },
      envMapRotation: { value: new W2() },
      flipEnvMap: { value: -1 },
      reflectivity: { value: 1 },
      ior: { value: 1.5 },
      refractionRatio: { value: 0.98 },
    },
    aomap: {
      aoMap: { value: null },
      aoMapIntensity: { value: 1 },
      aoMapTransform: { value: new W2() },
    },
    lightmap: {
      lightMap: { value: null },
      lightMapIntensity: { value: 1 },
      lightMapTransform: { value: new W2() },
    },
    bumpmap: {
      bumpMap: { value: null },
      bumpMapTransform: { value: new W2() },
      bumpScale: { value: 1 },
    },
    normalmap: {
      normalMap: { value: null },
      normalMapTransform: { value: new W2() },
      normalScale: { value: new B2(1, 1) },
    },
    displacementmap: {
      displacementMap: { value: null },
      displacementMapTransform: { value: new W2() },
      displacementScale: { value: 1 },
      displacementBias: { value: 0 },
    },
    emissivemap: {
      emissiveMap: { value: null },
      emissiveMapTransform: { value: new W2() },
    },
    metalnessmap: {
      metalnessMap: { value: null },
      metalnessMapTransform: { value: new W2() },
    },
    roughnessmap: {
      roughnessMap: { value: null },
      roughnessMapTransform: { value: new W2() },
    },
    gradientmap: { gradientMap: { value: null } },
    fog: {
      fogDensity: { value: 25e-5 },
      fogNear: { value: 1 },
      fogFar: { value: 2e3 },
      fogColor: { value: new r9(16777215) },
    },
    lights: {
      ambientLightColor: { value: [] },
      lightProbe: { value: [] },
      directionalLights: {
        value: [],
        properties: { direction: {}, color: {} },
      },
      directionalLightShadows: {
        value: [],
        properties: {
          shadowIntensity: 1,
          shadowBias: {},
          shadowNormalBias: {},
          shadowRadius: {},
          shadowMapSize: {},
        },
      },
      directionalShadowMap: { value: [] },
      directionalShadowMatrix: { value: [] },
      spotLights: {
        value: [],
        properties: {
          color: {},
          position: {},
          direction: {},
          distance: {},
          coneCos: {},
          penumbraCos: {},
          decay: {},
        },
      },
      spotLightShadows: {
        value: [],
        properties: {
          shadowIntensity: 1,
          shadowBias: {},
          shadowNormalBias: {},
          shadowRadius: {},
          shadowMapSize: {},
        },
      },
      spotLightMap: { value: [] },
      spotShadowMap: { value: [] },
      spotLightMatrix: { value: [] },
      pointLights: {
        value: [],
        properties: { color: {}, position: {}, decay: {}, distance: {} },
      },
      pointLightShadows: {
        value: [],
        properties: {
          shadowIntensity: 1,
          shadowBias: {},
          shadowNormalBias: {},
          shadowRadius: {},
          shadowMapSize: {},
          shadowCameraNear: {},
          shadowCameraFar: {},
        },
      },
      pointShadowMap: { value: [] },
      pointShadowMatrix: { value: [] },
      hemisphereLights: {
        value: [],
        properties: { direction: {}, skyColor: {}, groundColor: {} },
      },
      rectAreaLights: {
        value: [],
        properties: { color: {}, position: {}, width: {}, height: {} },
      },
      ltc_1: { value: null },
      ltc_2: { value: null },
    },
    points: {
      diffuse: { value: new r9(16777215) },
      opacity: { value: 1 },
      size: { value: 1 },
      scale: { value: 1 },
      map: { value: null },
      alphaMap: { value: null },
      alphaMapTransform: { value: new W2() },
      alphaTest: { value: 0 },
      uvTransform: { value: new W2() },
    },
    sprite: {
      diffuse: { value: new r9(16777215) },
      opacity: { value: 1 },
      center: { value: new B2(0.5, 0.5) },
      rotation: { value: 0 },
      map: { value: null },
      mapTransform: { value: new W2() },
      alphaMap: { value: null },
      alphaMapTransform: { value: new W2() },
      alphaTest: { value: 0 },
    },
  },
  Xt = {
    basic: {
      uniforms: ce([
        K0.common,
        K0.specularmap,
        K0.envmap,
        K0.aomap,
        K0.lightmap,
        K0.fog,
      ]),
      vertexShader: z2.meshbasic_vert,
      fragmentShader: z2.meshbasic_frag,
    },
    lambert: {
      uniforms: ce([
        K0.common,
        K0.specularmap,
        K0.envmap,
        K0.aomap,
        K0.lightmap,
        K0.emissivemap,
        K0.bumpmap,
        K0.normalmap,
        K0.displacementmap,
        K0.fog,
        K0.lights,
        { emissive: { value: new r9(0) } },
      ]),
      vertexShader: z2.meshlambert_vert,
      fragmentShader: z2.meshlambert_frag,
    },
    phong: {
      uniforms: ce([
        K0.common,
        K0.specularmap,
        K0.envmap,
        K0.aomap,
        K0.lightmap,
        K0.emissivemap,
        K0.bumpmap,
        K0.normalmap,
        K0.displacementmap,
        K0.fog,
        K0.lights,
        {
          emissive: { value: new r9(0) },
          specular: { value: new r9(1118481) },
          shininess: { value: 30 },
        },
      ]),
      vertexShader: z2.meshphong_vert,
      fragmentShader: z2.meshphong_frag,
    },
    standard: {
      uniforms: ce([
        K0.common,
        K0.envmap,
        K0.aomap,
        K0.lightmap,
        K0.emissivemap,
        K0.bumpmap,
        K0.normalmap,
        K0.displacementmap,
        K0.roughnessmap,
        K0.metalnessmap,
        K0.fog,
        K0.lights,
        {
          emissive: { value: new r9(0) },
          roughness: { value: 1 },
          metalness: { value: 0 },
          envMapIntensity: { value: 1 },
        },
      ]),
      vertexShader: z2.meshphysical_vert,
      fragmentShader: z2.meshphysical_frag,
    },
    toon: {
      uniforms: ce([
        K0.common,
        K0.aomap,
        K0.lightmap,
        K0.emissivemap,
        K0.bumpmap,
        K0.normalmap,
        K0.displacementmap,
        K0.gradientmap,
        K0.fog,
        K0.lights,
        { emissive: { value: new r9(0) } },
      ]),
      vertexShader: z2.meshtoon_vert,
      fragmentShader: z2.meshtoon_frag,
    },
    matcap: {
      uniforms: ce([
        K0.common,
        K0.bumpmap,
        K0.normalmap,
        K0.displacementmap,
        K0.fog,
        { matcap: { value: null } },
      ]),
      vertexShader: z2.meshmatcap_vert,
      fragmentShader: z2.meshmatcap_frag,
    },
    points: {
      uniforms: ce([K0.points, K0.fog]),
      vertexShader: z2.points_vert,
      fragmentShader: z2.points_frag,
    },
    dashed: {
      uniforms: ce([
        K0.common,
        K0.fog,
        {
          scale: { value: 1 },
          dashSize: { value: 1 },
          totalSize: { value: 2 },
        },
      ]),
      vertexShader: z2.linedashed_vert,
      fragmentShader: z2.linedashed_frag,
    },
    depth: {
      uniforms: ce([K0.common, K0.displacementmap]),
      vertexShader: z2.depth_vert,
      fragmentShader: z2.depth_frag,
    },
    normal: {
      uniforms: ce([
        K0.common,
        K0.bumpmap,
        K0.normalmap,
        K0.displacementmap,
        { opacity: { value: 1 } },
      ]),
      vertexShader: z2.meshnormal_vert,
      fragmentShader: z2.meshnormal_frag,
    },
    sprite: {
      uniforms: ce([K0.sprite, K0.fog]),
      vertexShader: z2.sprite_vert,
      fragmentShader: z2.sprite_frag,
    },
    background: {
      uniforms: {
        uvTransform: { value: new W2() },
        t2D: { value: null },
        backgroundIntensity: { value: 1 },
      },
      vertexShader: z2.background_vert,
      fragmentShader: z2.background_frag,
    },
    backgroundCube: {
      uniforms: {
        envMap: { value: null },
        flipEnvMap: { value: -1 },
        backgroundBlurriness: { value: 0 },
        backgroundIntensity: { value: 1 },
        backgroundRotation: { value: new W2() },
      },
      vertexShader: z2.backgroundCube_vert,
      fragmentShader: z2.backgroundCube_frag,
    },
    cube: {
      uniforms: {
        tCube: { value: null },
        tFlip: { value: -1 },
        opacity: { value: 1 },
      },
      vertexShader: z2.cube_vert,
      fragmentShader: z2.cube_frag,
    },
    equirect: {
      uniforms: { tEquirect: { value: null } },
      vertexShader: z2.equirect_vert,
      fragmentShader: z2.equirect_frag,
    },
    distanceRGBA: {
      uniforms: ce([
        K0.common,
        K0.displacementmap,
        {
          referencePosition: { value: new H() },
          nearDistance: { value: 1 },
          farDistance: { value: 1e3 },
        },
      ]),
      vertexShader: z2.distanceRGBA_vert,
      fragmentShader: z2.distanceRGBA_frag,
    },
    shadow: {
      uniforms: ce([
        K0.lights,
        K0.fog,
        { color: { value: new r9(0) }, opacity: { value: 1 } },
      ]),
      vertexShader: z2.shadow_vert,
      fragmentShader: z2.shadow_frag,
    },
  };
Xt.physical = {
  uniforms: ce([
    Xt.standard.uniforms,
    {
      clearcoat: { value: 0 },
      clearcoatMap: { value: null },
      clearcoatMapTransform: { value: new W2() },
      clearcoatNormalMap: { value: null },
      clearcoatNormalMapTransform: { value: new W2() },
      clearcoatNormalScale: { value: new B2(1, 1) },
      clearcoatRoughness: { value: 0 },
      clearcoatRoughnessMap: { value: null },
      clearcoatRoughnessMapTransform: { value: new W2() },
      dispersion: { value: 0 },
      iridescence: { value: 0 },
      iridescenceMap: { value: null },
      iridescenceMapTransform: { value: new W2() },
      iridescenceIOR: { value: 1.3 },
      iridescenceThicknessMinimum: { value: 100 },
      iridescenceThicknessMaximum: { value: 400 },
      iridescenceThicknessMap: { value: null },
      iridescenceThicknessMapTransform: { value: new W2() },
      sheen: { value: 0 },
      sheenColor: { value: new r9(0) },
      sheenColorMap: { value: null },
      sheenColorMapTransform: { value: new W2() },
      sheenRoughness: { value: 1 },
      sheenRoughnessMap: { value: null },
      sheenRoughnessMapTransform: { value: new W2() },
      transmission: { value: 0 },
      transmissionMap: { value: null },
      transmissionMapTransform: { value: new W2() },
      transmissionSamplerSize: { value: new B2() },
      transmissionSamplerMap: { value: null },
      thickness: { value: 0 },
      thicknessMap: { value: null },
      thicknessMapTransform: { value: new W2() },
      attenuationDistance: { value: 0 },
      attenuationColor: { value: new r9(0) },
      specularColor: { value: new r9(1, 1, 1) },
      specularColorMap: { value: null },
      specularColorMapTransform: { value: new W2() },
      specularIntensity: { value: 1 },
      specularIntensityMap: { value: null },
      specularIntensityMapTransform: { value: new W2() },
      anisotropyVector: { value: new B2() },
      anisotropyMap: { value: null },
      anisotropyMapTransform: { value: new W2() },
    },
  ]),
  vertexShader: z2.meshphysical_vert,
  fragmentShader: z2.meshphysical_frag,
};
const i8 = { r: 0, b: 0, g: 0 },
  b3 = new o5(),
  SU = new v2();
function CU(n, e, t, i, r, s, o) {
  const a = new r9(0);
  let c = s === !0 ? 0 : 1,
    l,
    u,
    h = null,
    d = 0,
    f = null;
  function p(b) {
    let A = b.isScene === !0 ? b.background : null;
    return (
      A && A.isTexture && (A = (b.backgroundBlurriness > 0 ? t : e).get(A)),
      A
    );
  }
  function v(b) {
    let A = !1;
    const x = p(b);
    x === null ? g(a, c) : x && x.isColor && (g(x, 1), (A = !0));
    const M = n.xr.getEnvironmentBlendMode();
    (M === "additive"
      ? i.buffers.color.setClear(0, 0, 0, 1, o)
      : M === "alpha-blend" && i.buffers.color.setClear(0, 0, 0, 0, o),
      (n.autoClear || A) &&
        (i.buffers.depth.setTest(!0),
        i.buffers.depth.setMask(!0),
        i.buffers.color.setMask(!0),
        n.clear(n.autoClearColor, n.autoClearDepth, n.autoClearStencil)));
  }
  function w(b, A) {
    const x = p(A);
    x && (x.isCubeTexture || x.mapping === I6)
      ? (u === void 0 &&
          ((u = new D2(
            new aa(1, 1, 1),
            new $1({
              name: "BackgroundCubeMaterial",
              uniforms: ar(Xt.backgroundCube.uniforms),
              vertexShader: Xt.backgroundCube.vertexShader,
              fragmentShader: Xt.backgroundCube.fragmentShader,
              side: me,
              depthTest: !1,
              depthWrite: !1,
              fog: !1,
              allowOverride: !1,
            }),
          )),
          u.geometry.deleteAttribute("normal"),
          u.geometry.deleteAttribute("uv"),
          (u.onBeforeRender = function (M, E, _) {
            this.matrixWorld.copyPosition(_.matrixWorld);
          }),
          Object.defineProperty(u.material, "envMap", {
            get: function () {
              return this.uniforms.envMap.value;
            },
          }),
          r.update(u)),
        b3.copy(A.backgroundRotation),
        (b3.x *= -1),
        (b3.y *= -1),
        (b3.z *= -1),
        x.isCubeTexture &&
          x.isRenderTargetTexture === !1 &&
          ((b3.y *= -1), (b3.z *= -1)),
        (u.material.uniforms.envMap.value = x),
        (u.material.uniforms.flipEnvMap.value =
          x.isCubeTexture && x.isRenderTargetTexture === !1 ? -1 : 1),
        (u.material.uniforms.backgroundBlurriness.value =
          A.backgroundBlurriness),
        (u.material.uniforms.backgroundIntensity.value = A.backgroundIntensity),
        u.material.uniforms.backgroundRotation.value.setFromMatrix4(
          SU.makeRotationFromEuler(b3),
        ),
        (u.material.toneMapped = f9.getTransfer(x.colorSpace) !== B9),
        (h !== x || d !== x.version || f !== n.toneMapping) &&
          ((u.material.needsUpdate = !0),
          (h = x),
          (d = x.version),
          (f = n.toneMapping)),
        u.layers.enableAll(),
        b.unshift(u, u.geometry, u.material, 0, 0, null))
      : x &&
        x.isTexture &&
        (l === void 0 &&
          ((l = new D2(
            new Ar(2, 2),
            new $1({
              name: "BackgroundMaterial",
              uniforms: ar(Xt.background.uniforms),
              vertexShader: Xt.background.vertexShader,
              fragmentShader: Xt.background.fragmentShader,
              side: tn,
              depthTest: !1,
              depthWrite: !1,
              fog: !1,
              allowOverride: !1,
            }),
          )),
          l.geometry.deleteAttribute("normal"),
          Object.defineProperty(l.material, "map", {
            get: function () {
              return this.uniforms.t2D.value;
            },
          }),
          r.update(l)),
        (l.material.uniforms.t2D.value = x),
        (l.material.uniforms.backgroundIntensity.value = A.backgroundIntensity),
        (l.material.toneMapped = f9.getTransfer(x.colorSpace) !== B9),
        x.matrixAutoUpdate === !0 && x.updateMatrix(),
        l.material.uniforms.uvTransform.value.copy(x.matrix),
        (h !== x || d !== x.version || f !== n.toneMapping) &&
          ((l.material.needsUpdate = !0),
          (h = x),
          (d = x.version),
          (f = n.toneMapping)),
        l.layers.enableAll(),
        b.unshift(l, l.geometry, l.material, 0, 0, null));
  }
  function g(b, A) {
    (b.getRGB(i8, CG(n)), i.buffers.color.setClear(i8.r, i8.g, i8.b, A, o));
  }
  function y() {
    (u !== void 0 && (u.geometry.dispose(), u.material.dispose(), (u = void 0)),
      l !== void 0 &&
        (l.geometry.dispose(), l.material.dispose(), (l = void 0)));
  }
  return {
    getClearColor: function () {
      return a;
    },
    setClearColor: function (b, A = 1) {
      (a.set(b), (c = A), g(a, c));
    },
    getClearAlpha: function () {
      return c;
    },
    setClearAlpha: function (b) {
      ((c = b), g(a, c));
    },
    render: v,
    addToRenderList: w,
    dispose: y,
  };
}
function EU(n, e) {
  const t = n.getParameter(n.MAX_VERTEX_ATTRIBS),
    i = {},
    r = d(null);
  let s = r,
    o = !1;
  function a(S, G, I, L, k) {
    let D = !1;
    const V = h(L, I, G);
    (s !== V && ((s = V), l(s.object)),
      (D = f(S, L, I, k)),
      D && p(S, L, I, k),
      k !== null && e.update(k, n.ELEMENT_ARRAY_BUFFER),
      (D || o) &&
        ((o = !1),
        A(S, G, I, L),
        k !== null && n.bindBuffer(n.ELEMENT_ARRAY_BUFFER, e.get(k).buffer)));
  }
  function c() {
    return n.createVertexArray();
  }
  function l(S) {
    return n.bindVertexArray(S);
  }
  function u(S) {
    return n.deleteVertexArray(S);
  }
  function h(S, G, I) {
    const L = I.wireframe === !0;
    let k = i[S.id];
    k === void 0 && ((k = {}), (i[S.id] = k));
    let D = k[G.id];
    D === void 0 && ((D = {}), (k[G.id] = D));
    let V = D[L];
    return (V === void 0 && ((V = d(c())), (D[L] = V)), V);
  }
  function d(S) {
    const G = [],
      I = [],
      L = [];
    for (let k = 0; k < t; k++) ((G[k] = 0), (I[k] = 0), (L[k] = 0));
    return {
      geometry: null,
      program: null,
      wireframe: !1,
      newAttributes: G,
      enabledAttributes: I,
      attributeDivisors: L,
      object: S,
      attributes: {},
      index: null,
    };
  }
  function f(S, G, I, L) {
    const k = s.attributes,
      D = G.attributes;
    let V = 0;
    const K = I.getAttributes();
    for (const P in K)
      if (K[P].location >= 0) {
        const e0 = k[P];
        let Q = D[P];
        if (
          (Q === void 0 &&
            (P === "instanceMatrix" &&
              S.instanceMatrix &&
              (Q = S.instanceMatrix),
            P === "instanceColor" && S.instanceColor && (Q = S.instanceColor)),
          e0 === void 0 || e0.attribute !== Q || (Q && e0.data !== Q.data))
        )
          return !0;
        V++;
      }
    return s.attributesNum !== V || s.index !== L;
  }
  function p(S, G, I, L) {
    const k = {},
      D = G.attributes;
    let V = 0;
    const K = I.getAttributes();
    for (const P in K)
      if (K[P].location >= 0) {
        let e0 = D[P];
        e0 === void 0 &&
          (P === "instanceMatrix" &&
            S.instanceMatrix &&
            (e0 = S.instanceMatrix),
          P === "instanceColor" && S.instanceColor && (e0 = S.instanceColor));
        const Q = {};
        ((Q.attribute = e0),
          e0 && e0.data && (Q.data = e0.data),
          (k[P] = Q),
          V++);
      }
    ((s.attributes = k), (s.attributesNum = V), (s.index = L));
  }
  function v() {
    const S = s.newAttributes;
    for (let G = 0, I = S.length; G < I; G++) S[G] = 0;
  }
  function w(S) {
    g(S, 0);
  }
  function g(S, G) {
    const I = s.newAttributes,
      L = s.enabledAttributes,
      k = s.attributeDivisors;
    ((I[S] = 1),
      L[S] === 0 && (n.enableVertexAttribArray(S), (L[S] = 1)),
      k[S] !== G && (n.vertexAttribDivisor(S, G), (k[S] = G)));
  }
  function y() {
    const S = s.newAttributes,
      G = s.enabledAttributes;
    for (let I = 0, L = G.length; I < L; I++)
      G[I] !== S[I] && (n.disableVertexAttribArray(I), (G[I] = 0));
  }
  function b(S, G, I, L, k, D, V) {
    V === !0
      ? n.vertexAttribIPointer(S, G, I, k, D)
      : n.vertexAttribPointer(S, G, I, L, k, D);
  }
  function A(S, G, I, L) {
    v();
    const k = L.attributes,
      D = I.getAttributes(),
      V = G.defaultAttributeValues;
    for (const K in D) {
      const P = D[K];
      if (P.location >= 0) {
        let q = k[K];
        if (
          (q === void 0 &&
            (K === "instanceMatrix" &&
              S.instanceMatrix &&
              (q = S.instanceMatrix),
            K === "instanceColor" && S.instanceColor && (q = S.instanceColor)),
          q !== void 0)
        ) {
          const e0 = q.normalized,
            Q = q.itemSize,
            U = e.get(q);
          if (U === void 0) continue;
          const O = U.buffer,
            F = U.type,
            z = U.bytesPerElement,
            Y = F === n.INT || F === n.UNSIGNED_INT || q.gpuType === Em;
          if (q.isInterleavedBufferAttribute) {
            const X = q.data,
              l0 = X.stride,
              r0 = q.offset;
            if (X.isInstancedInterleavedBuffer) {
              for (let j = 0; j < P.locationSize; j++)
                g(P.location + j, X.meshPerAttribute);
              S.isInstancedMesh !== !0 &&
                L._maxInstanceCount === void 0 &&
                (L._maxInstanceCount = X.meshPerAttribute * X.count);
            } else for (let j = 0; j < P.locationSize; j++) w(P.location + j);
            n.bindBuffer(n.ARRAY_BUFFER, O);
            for (let j = 0; j < P.locationSize; j++)
              b(
                P.location + j,
                Q / P.locationSize,
                F,
                e0,
                l0 * z,
                (r0 + (Q / P.locationSize) * j) * z,
                Y,
              );
          } else {
            if (q.isInstancedBufferAttribute) {
              for (let X = 0; X < P.locationSize; X++)
                g(P.location + X, q.meshPerAttribute);
              S.isInstancedMesh !== !0 &&
                L._maxInstanceCount === void 0 &&
                (L._maxInstanceCount = q.meshPerAttribute * q.count);
            } else for (let X = 0; X < P.locationSize; X++) w(P.location + X);
            n.bindBuffer(n.ARRAY_BUFFER, O);
            for (let X = 0; X < P.locationSize; X++)
              b(
                P.location + X,
                Q / P.locationSize,
                F,
                e0,
                Q * z,
                (Q / P.locationSize) * X * z,
                Y,
              );
          }
        } else if (V !== void 0) {
          const e0 = V[K];
          if (e0 !== void 0)
            switch (e0.length) {
              case 2:
                n.vertexAttrib2fv(P.location, e0);
                break;
              case 3:
                n.vertexAttrib3fv(P.location, e0);
                break;
              case 4:
                n.vertexAttrib4fv(P.location, e0);
                break;
              default:
                n.vertexAttrib1fv(P.location, e0);
            }
        }
      }
    }
    y();
  }
  function x() {
    _();
    for (const S in i) {
      const G = i[S];
      for (const I in G) {
        const L = G[I];
        for (const k in L) (u(L[k].object), delete L[k]);
        delete G[I];
      }
      delete i[S];
    }
  }
  function M(S) {
    if (i[S.id] === void 0) return;
    const G = i[S.id];
    for (const I in G) {
      const L = G[I];
      for (const k in L) (u(L[k].object), delete L[k]);
      delete G[I];
    }
    delete i[S.id];
  }
  function E(S) {
    for (const G in i) {
      const I = i[G];
      if (I[S.id] === void 0) continue;
      const L = I[S.id];
      for (const k in L) (u(L[k].object), delete L[k]);
      delete I[S.id];
    }
  }
  function _() {
    (C(), (o = !0), s !== r && ((s = r), l(s.object)));
  }
  function C() {
    ((r.geometry = null), (r.program = null), (r.wireframe = !1));
  }
  return {
    setup: a,
    reset: _,
    resetDefaultState: C,
    dispose: x,
    releaseStatesOfGeometry: M,
    releaseStatesOfProgram: E,
    initAttributes: v,
    enableAttribute: w,
    disableUnusedAttributes: y,
  };
}
function TU(n, e, t) {
  let i;
  function r(l) {
    i = l;
  }
  function s(l, u) {
    (n.drawArrays(i, l, u), t.update(u, i, 1));
  }
  function o(l, u, h) {
    h !== 0 && (n.drawArraysInstanced(i, l, u, h), t.update(u, i, h));
  }
  function a(l, u, h) {
    if (h === 0) return;
    e.get("WEBGL_multi_draw").multiDrawArraysWEBGL(i, l, 0, u, 0, h);
    let f = 0;
    for (let p = 0; p < h; p++) f += u[p];
    t.update(f, i, 1);
  }
  function c(l, u, h, d) {
    if (h === 0) return;
    const f = e.get("WEBGL_multi_draw");
    if (f === null) for (let p = 0; p < l.length; p++) o(l[p], u[p], d[p]);
    else {
      f.multiDrawArraysInstancedWEBGL(i, l, 0, u, 0, d, 0, h);
      let p = 0;
      for (let v = 0; v < h; v++) p += u[v] * d[v];
      t.update(p, i, 1);
    }
  }
  ((this.setMode = r),
    (this.render = s),
    (this.renderInstances = o),
    (this.renderMultiDraw = a),
    (this.renderMultiDrawInstances = c));
}
function _U(n, e, t, i) {
  let r;
  function s() {
    if (r !== void 0) return r;
    if (e.has("EXT_texture_filter_anisotropic") === !0) {
      const E = e.get("EXT_texture_filter_anisotropic");
      r = n.getParameter(E.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
    } else r = 0;
    return r;
  }
  function o(E) {
    return !(
      E !== e9 &&
      i.convert(E) !== n.getParameter(n.IMPLEMENTATION_COLOR_READ_FORMAT)
    );
  }
  function a(E) {
    const _ =
      E === sa &&
      (e.has("EXT_color_buffer_half_float") || e.has("EXT_color_buffer_float"));
    return !(
      E !== _9 &&
      i.convert(E) !== n.getParameter(n.IMPLEMENTATION_COLOR_READ_TYPE) &&
      E !== $5 &&
      !_
    );
  }
  function c(E) {
    if (E === "highp") {
      if (
        n.getShaderPrecisionFormat(n.VERTEX_SHADER, n.HIGH_FLOAT).precision >
          0 &&
        n.getShaderPrecisionFormat(n.FRAGMENT_SHADER, n.HIGH_FLOAT).precision >
          0
      )
        return "highp";
      E = "mediump";
    }
    return E === "mediump" &&
      n.getShaderPrecisionFormat(n.VERTEX_SHADER, n.MEDIUM_FLOAT).precision >
        0 &&
      n.getShaderPrecisionFormat(n.FRAGMENT_SHADER, n.MEDIUM_FLOAT).precision >
        0
      ? "mediump"
      : "lowp";
  }
  let l = t.precision !== void 0 ? t.precision : "highp";
  const u = c(l);
  u !== l &&
    (console.warn(
      "THREE.WebGLRenderer:",
      l,
      "not supported, using",
      u,
      "instead.",
    ),
    (l = u));
  const h = t.logarithmicDepthBuffer === !0,
    d = t.reverseDepthBuffer === !0 && e.has("EXT_clip_control"),
    f = n.getParameter(n.MAX_TEXTURE_IMAGE_UNITS),
    p = n.getParameter(n.MAX_VERTEX_TEXTURE_IMAGE_UNITS),
    v = n.getParameter(n.MAX_TEXTURE_SIZE),
    w = n.getParameter(n.MAX_CUBE_MAP_TEXTURE_SIZE),
    g = n.getParameter(n.MAX_VERTEX_ATTRIBS),
    y = n.getParameter(n.MAX_VERTEX_UNIFORM_VECTORS),
    b = n.getParameter(n.MAX_VARYING_VECTORS),
    A = n.getParameter(n.MAX_FRAGMENT_UNIFORM_VECTORS),
    x = p > 0,
    M = n.getParameter(n.MAX_SAMPLES);
  return {
    isWebGL2: !0,
    getMaxAnisotropy: s,
    getMaxPrecision: c,
    textureFormatReadable: o,
    textureTypeReadable: a,
    precision: l,
    logarithmicDepthBuffer: h,
    reverseDepthBuffer: d,
    maxTextures: f,
    maxVertexTextures: p,
    maxTextureSize: v,
    maxCubemapSize: w,
    maxAttributes: g,
    maxVertexUniforms: y,
    maxVaryings: b,
    maxFragmentUniforms: A,
    vertexTextures: x,
    maxSamples: M,
  };
}
function GU(n) {
  const e = this;
  let t = null,
    i = 0,
    r = !1,
    s = !1;
  const o = new D3(),
    a = new W2(),
    c = { value: null, needsUpdate: !1 };
  ((this.uniform = c),
    (this.numPlanes = 0),
    (this.numIntersection = 0),
    (this.init = function (h, d) {
      const f = h.length !== 0 || d || i !== 0 || r;
      return ((r = d), (i = h.length), f);
    }),
    (this.beginShadows = function () {
      ((s = !0), u(null));
    }),
    (this.endShadows = function () {
      s = !1;
    }),
    (this.setGlobalState = function (h, d) {
      t = u(h, d, 0);
    }),
    (this.setState = function (h, d, f) {
      const p = h.clippingPlanes,
        v = h.clipIntersection,
        w = h.clipShadows,
        g = n.get(h);
      if (!r || p === null || p.length === 0 || (s && !w)) s ? u(null) : l();
      else {
        const y = s ? 0 : i,
          b = y * 4;
        let A = g.clippingState || null;
        ((c.value = A), (A = u(p, d, b, f)));
        for (let x = 0; x !== b; ++x) A[x] = t[x];
        ((g.clippingState = A),
          (this.numIntersection = v ? this.numPlanes : 0),
          (this.numPlanes += y));
      }
    }));
  function l() {
    (c.value !== t && ((c.value = t), (c.needsUpdate = i > 0)),
      (e.numPlanes = i),
      (e.numIntersection = 0));
  }
  function u(h, d, f, p) {
    const v = h !== null ? h.length : 0;
    let w = null;
    if (v !== 0) {
      if (((w = c.value), p !== !0 || w === null)) {
        const g = f + v * 4,
          y = d.matrixWorldInverse;
        (a.getNormalMatrix(y),
          (w === null || w.length < g) && (w = new Float32Array(g)));
        for (let b = 0, A = f; b !== v; ++b, A += 4)
          (o.copy(h[b]).applyMatrix4(y, a),
            o.normal.toArray(w, A),
            (w[A + 3] = o.constant));
      }
      ((c.value = w), (c.needsUpdate = !0));
    }
    return ((e.numPlanes = v), (e.numIntersection = 0), w);
  }
}
function BU(n) {
  let e = new WeakMap();
  function t(o, a) {
    return (a === Xf ? (o.mapping = sr) : a === Yf && (o.mapping = or), o);
  }
  function i(o) {
    if (o && o.isTexture) {
      const a = o.mapping;
      if (a === Xf || a === Yf)
        if (e.has(o)) {
          const c = e.get(o).texture;
          return t(c, o.mapping);
        } else {
          const c = o.image;
          if (c && c.height > 0) {
            const l = new EN(c.height);
            return (
              l.fromEquirectangularTexture(n, o),
              e.set(o, l),
              o.addEventListener("dispose", r),
              t(l.texture, o.mapping)
            );
          } else return null;
        }
    }
    return o;
  }
  function r(o) {
    const a = o.target;
    a.removeEventListener("dispose", r);
    const c = e.get(a);
    c !== void 0 && (e.delete(a), c.dispose());
  }
  function s() {
    e = new WeakMap();
  }
  return { get: i, dispose: s };
}
const Bi = 4,
  xA = [0.125, 0.215, 0.35, 0.446, 0.526, 0.582],
  K3 = 20,
  au = new Fm(),
  SA = new r9();
let cu = null,
  lu = 0,
  uu = 0,
  hu = !1;
const V3 = (1 + Math.sqrt(5)) / 2,
  ii = 1 / V3,
  CA = [
    new H(-V3, ii, 0),
    new H(V3, ii, 0),
    new H(-ii, 0, V3),
    new H(ii, 0, V3),
    new H(0, V3, -ii),
    new H(0, V3, ii),
    new H(-1, 1, -1),
    new H(1, 1, -1),
    new H(-1, 1, 1),
    new H(1, 1, 1),
  ],
  RU = new H();
class EA {
  constructor(e) {
    ((this._renderer = e),
      (this._pingPongRenderTarget = null),
      (this._lodMax = 0),
      (this._cubeSize = 0),
      (this._lodPlanes = []),
      (this._sizeLods = []),
      (this._sigmas = []),
      (this._blurMaterial = null),
      (this._cubemapMaterial = null),
      (this._equirectMaterial = null),
      this._compileMaterial(this._blurMaterial));
  }
  fromScene(e, t = 0, i = 0.1, r = 100, s = {}) {
    const { size: o = 256, position: a = RU } = s;
    ((cu = this._renderer.getRenderTarget()),
      (lu = this._renderer.getActiveCubeFace()),
      (uu = this._renderer.getActiveMipmapLevel()),
      (hu = this._renderer.xr.enabled),
      (this._renderer.xr.enabled = !1),
      this._setSize(o));
    const c = this._allocateTargets();
    return (
      (c.depthBuffer = !0),
      this._sceneToCubeUV(e, i, r, c, a),
      t > 0 && this._blur(c, 0, 0, t),
      this._applyPMREM(c),
      this._cleanup(c),
      c
    );
  }
  fromEquirectangular(e, t = null) {
    return this._fromTexture(e, t);
  }
  fromCubemap(e, t = null) {
    return this._fromTexture(e, t);
  }
  compileCubemapShader() {
    this._cubemapMaterial === null &&
      ((this._cubemapMaterial = GA()),
      this._compileMaterial(this._cubemapMaterial));
  }
  compileEquirectangularShader() {
    this._equirectMaterial === null &&
      ((this._equirectMaterial = _A()),
      this._compileMaterial(this._equirectMaterial));
  }
  dispose() {
    (this._dispose(),
      this._cubemapMaterial !== null && this._cubemapMaterial.dispose(),
      this._equirectMaterial !== null && this._equirectMaterial.dispose());
  }
  _setSize(e) {
    ((this._lodMax = Math.floor(Math.log2(e))),
      (this._cubeSize = Math.pow(2, this._lodMax)));
  }
  _dispose() {
    (this._blurMaterial !== null && this._blurMaterial.dispose(),
      this._pingPongRenderTarget !== null &&
        this._pingPongRenderTarget.dispose());
    for (let e = 0; e < this._lodPlanes.length; e++)
      this._lodPlanes[e].dispose();
  }
  _cleanup(e) {
    (this._renderer.setRenderTarget(cu, lu, uu),
      (this._renderer.xr.enabled = hu),
      (e.scissorTest = !1),
      r8(e, 0, 0, e.width, e.height));
  }
  _fromTexture(e, t) {
    (e.mapping === sr || e.mapping === or
      ? this._setSize(
          e.image.length === 0
            ? 16
            : e.image[0].width || e.image[0].image.width,
        )
      : this._setSize(e.image.width / 4),
      (cu = this._renderer.getRenderTarget()),
      (lu = this._renderer.getActiveCubeFace()),
      (uu = this._renderer.getActiveMipmapLevel()),
      (hu = this._renderer.xr.enabled),
      (this._renderer.xr.enabled = !1));
    const i = t || this._allocateTargets();
    return (
      this._textureToCubeUV(e, i),
      this._applyPMREM(i),
      this._cleanup(i),
      i
    );
  }
  _allocateTargets() {
    const e = 3 * Math.max(this._cubeSize, 112),
      t = 4 * this._cubeSize,
      i = {
        magFilter: u9,
        minFilter: u9,
        generateMipmaps: !1,
        type: sa,
        format: e9,
        colorSpace: qe,
        depthBuffer: !1,
      },
      r = TA(e, t, i);
    if (
      this._pingPongRenderTarget === null ||
      this._pingPongRenderTarget.width !== e ||
      this._pingPongRenderTarget.height !== t
    ) {
      (this._pingPongRenderTarget !== null && this._dispose(),
        (this._pingPongRenderTarget = TA(e, t, i)));
      const { _lodMax: s } = this;
      (({
        sizeLods: this._sizeLods,
        lodPlanes: this._lodPlanes,
        sigmas: this._sigmas,
      } = IU(s)),
        (this._blurMaterial = kU(s, e, t)));
    }
    return r;
  }
  _compileMaterial(e) {
    const t = new D2(this._lodPlanes[0], e);
    this._renderer.compile(t, au);
  }
  _sceneToCubeUV(e, t, i, r, s) {
    const c = new Z9(90, 1, t, i),
      l = [1, -1, 1, 1, 1, 1],
      u = [1, 1, 1, -1, -1, -1],
      h = this._renderer,
      d = h.autoClear,
      f = h.toneMapping;
    (h.getClearColor(SA), (h.toneMapping = Jn), (h.autoClear = !1));
    const p = new d3({
        name: "PMREM.Background",
        side: me,
        depthWrite: !1,
        depthTest: !1,
      }),
      v = new D2(new aa(), p);
    let w = !1;
    const g = e.background;
    g
      ? g.isColor && (p.color.copy(g), (e.background = null), (w = !0))
      : (p.color.copy(SA), (w = !0));
    for (let y = 0; y < 6; y++) {
      const b = y % 3;
      b === 0
        ? (c.up.set(0, l[y], 0),
          c.position.set(s.x, s.y, s.z),
          c.lookAt(s.x + u[y], s.y, s.z))
        : b === 1
          ? (c.up.set(0, 0, l[y]),
            c.position.set(s.x, s.y, s.z),
            c.lookAt(s.x, s.y + u[y], s.z))
          : (c.up.set(0, l[y], 0),
            c.position.set(s.x, s.y, s.z),
            c.lookAt(s.x, s.y, s.z + u[y]));
      const A = this._cubeSize;
      (r8(r, b * A, y > 2 ? A : 0, A, A),
        h.setRenderTarget(r),
        w && h.render(v, c),
        h.render(e, c));
    }
    (v.geometry.dispose(),
      v.material.dispose(),
      (h.toneMapping = f),
      (h.autoClear = d),
      (e.background = g));
  }
  _textureToCubeUV(e, t) {
    const i = this._renderer,
      r = e.mapping === sr || e.mapping === or;
    r
      ? (this._cubemapMaterial === null && (this._cubemapMaterial = GA()),
        (this._cubemapMaterial.uniforms.flipEnvMap.value =
          e.isRenderTargetTexture === !1 ? -1 : 1))
      : this._equirectMaterial === null && (this._equirectMaterial = _A());
    const s = r ? this._cubemapMaterial : this._equirectMaterial,
      o = new D2(this._lodPlanes[0], s),
      a = s.uniforms;
    a.envMap.value = e;
    const c = this._cubeSize;
    (r8(t, 0, 0, 3 * c, 2 * c), i.setRenderTarget(t), i.render(o, au));
  }
  _applyPMREM(e) {
    const t = this._renderer,
      i = t.autoClear;
    t.autoClear = !1;
    const r = this._lodPlanes.length;
    for (let s = 1; s < r; s++) {
      const o = Math.sqrt(
          this._sigmas[s] * this._sigmas[s] -
            this._sigmas[s - 1] * this._sigmas[s - 1],
        ),
        a = CA[(r - s - 1) % CA.length];
      this._blur(e, s - 1, s, o, a);
    }
    t.autoClear = i;
  }
  _blur(e, t, i, r, s) {
    const o = this._pingPongRenderTarget;
    (this._halfBlur(e, o, t, i, r, "latitudinal", s),
      this._halfBlur(o, e, i, i, r, "longitudinal", s));
  }
  _halfBlur(e, t, i, r, s, o, a) {
    const c = this._renderer,
      l = this._blurMaterial;
    o !== "latitudinal" &&
      o !== "longitudinal" &&
      console.error(
        "blur direction must be either latitudinal or longitudinal!",
      );
    const u = 3,
      h = new D2(this._lodPlanes[r], l),
      d = l.uniforms,
      f = this._sizeLods[i] - 1,
      p = isFinite(s) ? Math.PI / (2 * f) : (2 * Math.PI) / (2 * K3 - 1),
      v = s / p,
      w = isFinite(s) ? 1 + Math.floor(u * v) : K3;
    w > K3 &&
      console.warn(
        `sigmaRadians, ${s}, is too large and will clip, as it requested ${w} samples when the maximum is set to ${K3}`,
      );
    const g = [];
    let y = 0;
    for (let E = 0; E < K3; ++E) {
      const _ = E / v,
        C = Math.exp((-_ * _) / 2);
      (g.push(C), E === 0 ? (y += C) : E < w && (y += 2 * C));
    }
    for (let E = 0; E < g.length; E++) g[E] = g[E] / y;
    ((d.envMap.value = e.texture),
      (d.samples.value = w),
      (d.weights.value = g),
      (d.latitudinal.value = o === "latitudinal"),
      a && (d.poleAxis.value = a));
    const { _lodMax: b } = this;
    ((d.dTheta.value = p), (d.mipInt.value = b - i));
    const A = this._sizeLods[r],
      x = 3 * A * (r > b - Bi ? r - b + Bi : 0),
      M = 4 * (this._cubeSize - A);
    (r8(t, x, M, 3 * A, 2 * A), c.setRenderTarget(t), c.render(h, au));
  }
}
function IU(n) {
  const e = [],
    t = [],
    i = [];
  let r = n;
  const s = n - Bi + 1 + xA.length;
  for (let o = 0; o < s; o++) {
    const a = Math.pow(2, r);
    t.push(a);
    let c = 1 / a;
    (o > n - Bi ? (c = xA[o - n + Bi - 1]) : o === 0 && (c = 0), i.push(c));
    const l = 1 / (a - 2),
      u = -l,
      h = 1 + l,
      d = [u, u, h, u, h, h, u, u, h, h, u, h],
      f = 6,
      p = 6,
      v = 3,
      w = 2,
      g = 1,
      y = new Float32Array(v * p * f),
      b = new Float32Array(w * p * f),
      A = new Float32Array(g * p * f);
    for (let M = 0; M < f; M++) {
      const E = ((M % 3) * 2) / 3 - 1,
        _ = M > 2 ? 0 : -1,
        C = [
          E,
          _,
          0,
          E + 2 / 3,
          _,
          0,
          E + 2 / 3,
          _ + 1,
          0,
          E,
          _,
          0,
          E + 2 / 3,
          _ + 1,
          0,
          E,
          _ + 1,
          0,
        ];
      (y.set(C, v * p * M), b.set(d, w * p * M));
      const S = [M, M, M, M, M, M];
      A.set(S, g * p * M);
    }
    const x = new t9();
    (x.setAttribute("position", new _0(y, v)),
      x.setAttribute("uv", new _0(b, w)),
      x.setAttribute("faceIndex", new _0(A, g)),
      e.push(x),
      r > Bi && r--);
  }
  return { lodPlanes: e, sizeLods: t, sigmas: i };
}
function TA(n, e, t) {
  const i = new nn(n, e, t);
  return (
    (i.texture.mapping = I6),
    (i.texture.name = "PMREM.cubeUv"),
    (i.scissorTest = !0),
    i
  );
}
function r8(n, e, t, i, r) {
  (n.viewport.set(e, t, i, r), n.scissor.set(e, t, i, r));
}
function kU(n, e, t) {
  const i = new Float32Array(K3),
    r = new H(0, 1, 0);
  return new $1({
    name: "SphericalGaussianBlur",
    defines: {
      n: K3,
      CUBEUV_TEXEL_WIDTH: 1 / e,
      CUBEUV_TEXEL_HEIGHT: 1 / t,
      CUBEUV_MAX_MIP: `${n}.0`,
    },
    uniforms: {
      envMap: { value: null },
      samples: { value: 1 },
      weights: { value: i },
      latitudinal: { value: !1 },
      dTheta: { value: 0 },
      mipInt: { value: 0 },
      poleAxis: { value: r },
    },
    vertexShader: Dm(),
    fragmentShader: `

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform int samples;
			uniform float weights[ n ];
			uniform bool latitudinal;
			uniform float dTheta;
			uniform float mipInt;
			uniform vec3 poleAxis;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			vec3 getSample( float theta, vec3 axis ) {

				float cosTheta = cos( theta );
				// Rodrigues' axis-angle rotation
				vec3 sampleDirection = vOutputDirection * cosTheta
					+ cross( axis, vOutputDirection ) * sin( theta )
					+ axis * dot( axis, vOutputDirection ) * ( 1.0 - cosTheta );

				return bilinearCubeUV( envMap, sampleDirection, mipInt );

			}

			void main() {

				vec3 axis = latitudinal ? poleAxis : cross( poleAxis, vOutputDirection );

				if ( all( equal( axis, vec3( 0.0 ) ) ) ) {

					axis = vec3( vOutputDirection.z, 0.0, - vOutputDirection.x );

				}

				axis = normalize( axis );

				gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );
				gl_FragColor.rgb += weights[ 0 ] * getSample( 0.0, axis );

				for ( int i = 1; i < n; i++ ) {

					if ( i >= samples ) {

						break;

					}

					float theta = dTheta * float( i );
					gl_FragColor.rgb += weights[ i ] * getSample( -1.0 * theta, axis );
					gl_FragColor.rgb += weights[ i ] * getSample( theta, axis );

				}

			}
		`,
    blending: n5,
    depthTest: !1,
    depthWrite: !1,
  });
}
function _A() {
  return new $1({
    name: "EquirectangularToCubeUV",
    uniforms: { envMap: { value: null } },
    vertexShader: Dm(),
    fragmentShader: `

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,
    blending: n5,
    depthTest: !1,
    depthWrite: !1,
  });
}
function GA() {
  return new $1({
    name: "CubemapToCubeUV",
    uniforms: { envMap: { value: null }, flipEnvMap: { value: -1 } },
    vertexShader: Dm(),
    fragmentShader: `

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,
    blending: n5,
    depthTest: !1,
    depthWrite: !1,
  });
}
function Dm() {
  return `

		precision mediump float;
		precision mediump int;

		attribute float faceIndex;

		varying vec3 vOutputDirection;

		// RH coordinate system; PMREM face-indexing convention
		vec3 getDirection( vec2 uv, float face ) {

			uv = 2.0 * uv - 1.0;

			vec3 direction = vec3( uv, 1.0 );

			if ( face == 0.0 ) {

				direction = direction.zyx; // ( 1, v, u ) pos x

			} else if ( face == 1.0 ) {

				direction = direction.xzy;
				direction.xz *= -1.0; // ( -u, 1, -v ) pos y

			} else if ( face == 2.0 ) {

				direction.x *= -1.0; // ( -u, v, 1 ) pos z

			} else if ( face == 3.0 ) {

				direction = direction.zyx;
				direction.xz *= -1.0; // ( -1, v, -u ) neg x

			} else if ( face == 4.0 ) {

				direction = direction.xzy;
				direction.xy *= -1.0; // ( -u, -1, v ) neg y

			} else if ( face == 5.0 ) {

				direction.z *= -1.0; // ( u, v, -1 ) neg z

			}

			return direction;

		}

		void main() {

			vOutputDirection = getDirection( uv, faceIndex );
			gl_Position = vec4( position, 1.0 );

		}
	`;
}
function LU(n) {
  let e = new WeakMap(),
    t = null;
  function i(a) {
    if (a && a.isTexture) {
      const c = a.mapping,
        l = c === Xf || c === Yf,
        u = c === sr || c === or;
      if (l || u) {
        let h = e.get(a);
        const d = h !== void 0 ? h.texture.pmremVersion : 0;
        if (a.isRenderTargetTexture && a.pmremVersion !== d)
          return (
            t === null && (t = new EA(n)),
            (h = l ? t.fromEquirectangular(a, h) : t.fromCubemap(a, h)),
            (h.texture.pmremVersion = a.pmremVersion),
            e.set(a, h),
            h.texture
          );
        if (h !== void 0) return h.texture;
        {
          const f = a.image;
          return (l && f && f.height > 0) || (u && f && r(f))
            ? (t === null && (t = new EA(n)),
              (h = l ? t.fromEquirectangular(a) : t.fromCubemap(a)),
              (h.texture.pmremVersion = a.pmremVersion),
              e.set(a, h),
              a.addEventListener("dispose", s),
              h.texture)
            : null;
        }
      }
    }
    return a;
  }
  function r(a) {
    let c = 0;
    const l = 6;
    for (let u = 0; u < l; u++) a[u] !== void 0 && c++;
    return c === l;
  }
  function s(a) {
    const c = a.target;
    c.removeEventListener("dispose", s);
    const l = e.get(c);
    l !== void 0 && (e.delete(c), l.dispose());
  }
  function o() {
    ((e = new WeakMap()), t !== null && (t.dispose(), (t = null)));
  }
  return { get: i, dispose: o };
}
function PU(n) {
  const e = {};
  function t(i) {
    if (e[i] !== void 0) return e[i];
    let r;
    switch (i) {
      case "WEBGL_depth_texture":
        r =
          n.getExtension("WEBGL_depth_texture") ||
          n.getExtension("MOZ_WEBGL_depth_texture") ||
          n.getExtension("WEBKIT_WEBGL_depth_texture");
        break;
      case "EXT_texture_filter_anisotropic":
        r =
          n.getExtension("EXT_texture_filter_anisotropic") ||
          n.getExtension("MOZ_EXT_texture_filter_anisotropic") ||
          n.getExtension("WEBKIT_EXT_texture_filter_anisotropic");
        break;
      case "WEBGL_compressed_texture_s3tc":
        r =
          n.getExtension("WEBGL_compressed_texture_s3tc") ||
          n.getExtension("MOZ_WEBGL_compressed_texture_s3tc") ||
          n.getExtension("WEBKIT_WEBGL_compressed_texture_s3tc");
        break;
      case "WEBGL_compressed_texture_pvrtc":
        r =
          n.getExtension("WEBGL_compressed_texture_pvrtc") ||
          n.getExtension("WEBKIT_WEBGL_compressed_texture_pvrtc");
        break;
      default:
        r = n.getExtension(i);
    }
    return ((e[i] = r), r);
  }
  return {
    has: function (i) {
      return t(i) !== null;
    },
    init: function () {
      (t("EXT_color_buffer_float"),
        t("WEBGL_clip_cull_distance"),
        t("OES_texture_float_linear"),
        t("EXT_color_buffer_half_float"),
        t("WEBGL_multisampled_render_to_texture"),
        t("WEBGL_render_shared_exponent"));
    },
    get: function (i) {
      const r = t(i);
      return (
        r === null &&
          qi("THREE.WebGLRenderer: " + i + " extension not supported."),
        r
      );
    },
  };
}
function FU(n, e, t, i) {
  const r = {},
    s = new WeakMap();
  function o(h) {
    const d = h.target;
    d.index !== null && e.remove(d.index);
    for (const p in d.attributes) e.remove(d.attributes[p]);
    (d.removeEventListener("dispose", o), delete r[d.id]);
    const f = s.get(d);
    (f && (e.remove(f), s.delete(d)),
      i.releaseStatesOfGeometry(d),
      d.isInstancedBufferGeometry === !0 && delete d._maxInstanceCount,
      t.memory.geometries--);
  }
  function a(h, d) {
    return (
      r[d.id] === !0 ||
        (d.addEventListener("dispose", o),
        (r[d.id] = !0),
        t.memory.geometries++),
      d
    );
  }
  function c(h) {
    const d = h.attributes;
    for (const f in d) e.update(d[f], n.ARRAY_BUFFER);
  }
  function l(h) {
    const d = [],
      f = h.index,
      p = h.attributes.position;
    let v = 0;
    if (f !== null) {
      const y = f.array;
      v = f.version;
      for (let b = 0, A = y.length; b < A; b += 3) {
        const x = y[b + 0],
          M = y[b + 1],
          E = y[b + 2];
        d.push(x, M, M, E, E, x);
      }
    } else if (p !== void 0) {
      const y = p.array;
      v = p.version;
      for (let b = 0, A = y.length / 3 - 1; b < A; b += 3) {
        const x = b + 0,
          M = b + 1,
          E = b + 2;
        d.push(x, M, M, E, E, x);
      }
    } else return;
    const w = new (yG(d) ? SG : xG)(d, 1);
    w.version = v;
    const g = s.get(h);
    (g && e.remove(g), s.set(h, w));
  }
  function u(h) {
    const d = s.get(h);
    if (d) {
      const f = h.index;
      f !== null && d.version < f.version && l(h);
    } else l(h);
    return s.get(h);
  }
  return { get: a, update: c, getWireframeAttribute: u };
}
function DU(n, e, t) {
  let i;
  function r(d) {
    i = d;
  }
  let s, o;
  function a(d) {
    ((s = d.type), (o = d.bytesPerElement));
  }
  function c(d, f) {
    (n.drawElements(i, f, s, d * o), t.update(f, i, 1));
  }
  function l(d, f, p) {
    p !== 0 && (n.drawElementsInstanced(i, f, s, d * o, p), t.update(f, i, p));
  }
  function u(d, f, p) {
    if (p === 0) return;
    e.get("WEBGL_multi_draw").multiDrawElementsWEBGL(i, f, 0, s, d, 0, p);
    let w = 0;
    for (let g = 0; g < p; g++) w += f[g];
    t.update(w, i, 1);
  }
  function h(d, f, p, v) {
    if (p === 0) return;
    const w = e.get("WEBGL_multi_draw");
    if (w === null) for (let g = 0; g < d.length; g++) l(d[g] / o, f[g], v[g]);
    else {
      w.multiDrawElementsInstancedWEBGL(i, f, 0, s, d, 0, v, 0, p);
      let g = 0;
      for (let y = 0; y < p; y++) g += f[y] * v[y];
      t.update(g, i, 1);
    }
  }
  ((this.setMode = r),
    (this.setIndex = a),
    (this.render = c),
    (this.renderInstances = l),
    (this.renderMultiDraw = u),
    (this.renderMultiDrawInstances = h));
}
function VU(n) {
  const e = { geometries: 0, textures: 0 },
    t = { frame: 0, calls: 0, triangles: 0, points: 0, lines: 0 };
  function i(s, o, a) {
    switch ((t.calls++, o)) {
      case n.TRIANGLES:
        t.triangles += a * (s / 3);
        break;
      case n.LINES:
        t.lines += a * (s / 2);
        break;
      case n.LINE_STRIP:
        t.lines += a * (s - 1);
        break;
      case n.LINE_LOOP:
        t.lines += a * s;
        break;
      case n.POINTS:
        t.points += a * s;
        break;
      default:
        console.error("THREE.WebGLInfo: Unknown draw mode:", o);
        break;
    }
  }
  function r() {
    ((t.calls = 0), (t.triangles = 0), (t.points = 0), (t.lines = 0));
  }
  return {
    memory: e,
    render: t,
    programs: null,
    autoReset: !0,
    reset: r,
    update: i,
  };
}
function NU(n, e, t) {
  const i = new WeakMap(),
    r = new Y2();
  function s(o, a, c) {
    const l = o.morphTargetInfluences,
      u =
        a.morphAttributes.position ||
        a.morphAttributes.normal ||
        a.morphAttributes.color,
      h = u !== void 0 ? u.length : 0;
    let d = i.get(a);
    if (d === void 0 || d.count !== h) {
      let C = function () {
        (E.dispose(), i.delete(a), a.removeEventListener("dispose", C));
      };
      d !== void 0 && d.texture.dispose();
      const f = a.morphAttributes.position !== void 0,
        p = a.morphAttributes.normal !== void 0,
        v = a.morphAttributes.color !== void 0,
        w = a.morphAttributes.position || [],
        g = a.morphAttributes.normal || [],
        y = a.morphAttributes.color || [];
      let b = 0;
      (f === !0 && (b = 1), p === !0 && (b = 2), v === !0 && (b = 3));
      let A = a.attributes.position.count * b,
        x = 1;
      A > e.maxTextureSize &&
        ((x = Math.ceil(A / e.maxTextureSize)), (A = e.maxTextureSize));
      const M = new Float32Array(A * x * 4 * h),
        E = new AG(M, A, x, h);
      ((E.type = $5), (E.needsUpdate = !0));
      const _ = b * 4;
      for (let S = 0; S < h; S++) {
        const G = w[S],
          I = g[S],
          L = y[S],
          k = A * x * 4 * S;
        for (let D = 0; D < G.count; D++) {
          const V = D * _;
          (f === !0 &&
            (r.fromBufferAttribute(G, D),
            (M[k + V + 0] = r.x),
            (M[k + V + 1] = r.y),
            (M[k + V + 2] = r.z),
            (M[k + V + 3] = 0)),
            p === !0 &&
              (r.fromBufferAttribute(I, D),
              (M[k + V + 4] = r.x),
              (M[k + V + 5] = r.y),
              (M[k + V + 6] = r.z),
              (M[k + V + 7] = 0)),
            v === !0 &&
              (r.fromBufferAttribute(L, D),
              (M[k + V + 8] = r.x),
              (M[k + V + 9] = r.y),
              (M[k + V + 10] = r.z),
              (M[k + V + 11] = L.itemSize === 4 ? r.w : 1)));
        }
      }
      ((d = { count: h, texture: E, size: new B2(A, x) }),
        i.set(a, d),
        a.addEventListener("dispose", C));
    }
    if (o.isInstancedMesh === !0 && o.morphTexture !== null)
      c.getUniforms().setValue(n, "morphTexture", o.morphTexture, t);
    else {
      let f = 0;
      for (let v = 0; v < l.length; v++) f += l[v];
      const p = a.morphTargetsRelative ? 1 : 1 - f;
      (c.getUniforms().setValue(n, "morphTargetBaseInfluence", p),
        c.getUniforms().setValue(n, "morphTargetInfluences", l));
    }
    (c.getUniforms().setValue(n, "morphTargetsTexture", d.texture, t),
      c.getUniforms().setValue(n, "morphTargetsTextureSize", d.size));
  }
  return { update: s };
}
function OU(n, e, t, i) {
  let r = new WeakMap();
  function s(c) {
    const l = i.render.frame,
      u = c.geometry,
      h = e.get(c, u);
    if (
      (r.get(h) !== l && (e.update(h), r.set(h, l)),
      c.isInstancedMesh &&
        (c.hasEventListener("dispose", a) === !1 &&
          c.addEventListener("dispose", a),
        r.get(c) !== l &&
          (t.update(c.instanceMatrix, n.ARRAY_BUFFER),
          c.instanceColor !== null && t.update(c.instanceColor, n.ARRAY_BUFFER),
          r.set(c, l))),
      c.isSkinnedMesh)
    ) {
      const d = c.skeleton;
      r.get(d) !== l && (d.update(), r.set(d, l));
    }
    return h;
  }
  function o() {
    r = new WeakMap();
  }
  function a(c) {
    const l = c.target;
    (l.removeEventListener("dispose", a),
      t.remove(l.instanceMatrix),
      l.instanceColor !== null && t.remove(l.instanceColor));
  }
  return { update: s, dispose: o };
}
const LG = new D9(),
  BA = new RG(1, 1),
  PG = new AG(),
  FG = new cN(),
  DG = new EG(),
  RA = [],
  IA = [],
  kA = new Float32Array(16),
  LA = new Float32Array(9),
  PA = new Float32Array(4);
function Mr(n, e, t) {
  const i = n[0];
  if (i <= 0 || i > 0) return n;
  const r = e * t;
  let s = RA[r];
  if ((s === void 0 && ((s = new Float32Array(r)), (RA[r] = s)), e !== 0)) {
    i.toArray(s, 0);
    for (let o = 1, a = 0; o !== e; ++o) ((a += t), n[o].toArray(s, a));
  }
  return s;
}
function T1(n, e) {
  if (n.length !== e.length) return !1;
  for (let t = 0, i = n.length; t < i; t++) if (n[t] !== e[t]) return !1;
  return !0;
}
function _1(n, e) {
  for (let t = 0, i = e.length; t < i; t++) n[t] = e[t];
}
function k6(n, e) {
  let t = IA[e];
  t === void 0 && ((t = new Int32Array(e)), (IA[e] = t));
  for (let i = 0; i !== e; ++i) t[i] = n.allocateTextureUnit();
  return t;
}
function zU(n, e) {
  const t = this.cache;
  t[0] !== e && (n.uniform1f(this.addr, e), (t[0] = e));
}
function UU(n, e) {
  const t = this.cache;
  if (e.x !== void 0)
    (t[0] !== e.x || t[1] !== e.y) &&
      (n.uniform2f(this.addr, e.x, e.y), (t[0] = e.x), (t[1] = e.y));
  else {
    if (T1(t, e)) return;
    (n.uniform2fv(this.addr, e), _1(t, e));
  }
}
function $U(n, e) {
  const t = this.cache;
  if (e.x !== void 0)
    (t[0] !== e.x || t[1] !== e.y || t[2] !== e.z) &&
      (n.uniform3f(this.addr, e.x, e.y, e.z),
      (t[0] = e.x),
      (t[1] = e.y),
      (t[2] = e.z));
  else if (e.r !== void 0)
    (t[0] !== e.r || t[1] !== e.g || t[2] !== e.b) &&
      (n.uniform3f(this.addr, e.r, e.g, e.b),
      (t[0] = e.r),
      (t[1] = e.g),
      (t[2] = e.b));
  else {
    if (T1(t, e)) return;
    (n.uniform3fv(this.addr, e), _1(t, e));
  }
}
function WU(n, e) {
  const t = this.cache;
  if (e.x !== void 0)
    (t[0] !== e.x || t[1] !== e.y || t[2] !== e.z || t[3] !== e.w) &&
      (n.uniform4f(this.addr, e.x, e.y, e.z, e.w),
      (t[0] = e.x),
      (t[1] = e.y),
      (t[2] = e.z),
      (t[3] = e.w));
  else {
    if (T1(t, e)) return;
    (n.uniform4fv(this.addr, e), _1(t, e));
  }
}
function HU(n, e) {
  const t = this.cache,
    i = e.elements;
  if (i === void 0) {
    if (T1(t, e)) return;
    (n.uniformMatrix2fv(this.addr, !1, e), _1(t, e));
  } else {
    if (T1(t, i)) return;
    (PA.set(i), n.uniformMatrix2fv(this.addr, !1, PA), _1(t, i));
  }
}
function qU(n, e) {
  const t = this.cache,
    i = e.elements;
  if (i === void 0) {
    if (T1(t, e)) return;
    (n.uniformMatrix3fv(this.addr, !1, e), _1(t, e));
  } else {
    if (T1(t, i)) return;
    (LA.set(i), n.uniformMatrix3fv(this.addr, !1, LA), _1(t, i));
  }
}
function KU(n, e) {
  const t = this.cache,
    i = e.elements;
  if (i === void 0) {
    if (T1(t, e)) return;
    (n.uniformMatrix4fv(this.addr, !1, e), _1(t, e));
  } else {
    if (T1(t, i)) return;
    (kA.set(i), n.uniformMatrix4fv(this.addr, !1, kA), _1(t, i));
  }
}
function jU(n, e) {
  const t = this.cache;
  t[0] !== e && (n.uniform1i(this.addr, e), (t[0] = e));
}
function XU(n, e) {
  const t = this.cache;
  if (e.x !== void 0)
    (t[0] !== e.x || t[1] !== e.y) &&
      (n.uniform2i(this.addr, e.x, e.y), (t[0] = e.x), (t[1] = e.y));
  else {
    if (T1(t, e)) return;
    (n.uniform2iv(this.addr, e), _1(t, e));
  }
}
function YU(n, e) {
  const t = this.cache;
  if (e.x !== void 0)
    (t[0] !== e.x || t[1] !== e.y || t[2] !== e.z) &&
      (n.uniform3i(this.addr, e.x, e.y, e.z),
      (t[0] = e.x),
      (t[1] = e.y),
      (t[2] = e.z));
  else {
    if (T1(t, e)) return;
    (n.uniform3iv(this.addr, e), _1(t, e));
  }
}
function ZU(n, e) {
  const t = this.cache;
  if (e.x !== void 0)
    (t[0] !== e.x || t[1] !== e.y || t[2] !== e.z || t[3] !== e.w) &&
      (n.uniform4i(this.addr, e.x, e.y, e.z, e.w),
      (t[0] = e.x),
      (t[1] = e.y),
      (t[2] = e.z),
      (t[3] = e.w));
  else {
    if (T1(t, e)) return;
    (n.uniform4iv(this.addr, e), _1(t, e));
  }
}
function QU(n, e) {
  const t = this.cache;
  t[0] !== e && (n.uniform1ui(this.addr, e), (t[0] = e));
}
function JU(n, e) {
  const t = this.cache;
  if (e.x !== void 0)
    (t[0] !== e.x || t[1] !== e.y) &&
      (n.uniform2ui(this.addr, e.x, e.y), (t[0] = e.x), (t[1] = e.y));
  else {
    if (T1(t, e)) return;
    (n.uniform2uiv(this.addr, e), _1(t, e));
  }
}
function e$(n, e) {
  const t = this.cache;
  if (e.x !== void 0)
    (t[0] !== e.x || t[1] !== e.y || t[2] !== e.z) &&
      (n.uniform3ui(this.addr, e.x, e.y, e.z),
      (t[0] = e.x),
      (t[1] = e.y),
      (t[2] = e.z));
  else {
    if (T1(t, e)) return;
    (n.uniform3uiv(this.addr, e), _1(t, e));
  }
}
function t$(n, e) {
  const t = this.cache;
  if (e.x !== void 0)
    (t[0] !== e.x || t[1] !== e.y || t[2] !== e.z || t[3] !== e.w) &&
      (n.uniform4ui(this.addr, e.x, e.y, e.z, e.w),
      (t[0] = e.x),
      (t[1] = e.y),
      (t[2] = e.z),
      (t[3] = e.w));
  else {
    if (T1(t, e)) return;
    (n.uniform4uiv(this.addr, e), _1(t, e));
  }
}
function n$(n, e, t) {
  const i = this.cache,
    r = t.allocateTextureUnit();
  i[0] !== r && (n.uniform1i(this.addr, r), (i[0] = r));
  let s;
  (this.type === n.SAMPLER_2D_SHADOW
    ? ((BA.compareFunction = vG), (s = BA))
    : (s = LG),
    t.setTexture2D(e || s, r));
}
function i$(n, e, t) {
  const i = this.cache,
    r = t.allocateTextureUnit();
  (i[0] !== r && (n.uniform1i(this.addr, r), (i[0] = r)),
    t.setTexture3D(e || FG, r));
}
function r$(n, e, t) {
  const i = this.cache,
    r = t.allocateTextureUnit();
  (i[0] !== r && (n.uniform1i(this.addr, r), (i[0] = r)),
    t.setTextureCube(e || DG, r));
}
function s$(n, e, t) {
  const i = this.cache,
    r = t.allocateTextureUnit();
  (i[0] !== r && (n.uniform1i(this.addr, r), (i[0] = r)),
    t.setTexture2DArray(e || PG, r));
}
function o$(n) {
  switch (n) {
    case 5126:
      return zU;
    case 35664:
      return UU;
    case 35665:
      return $U;
    case 35666:
      return WU;
    case 35674:
      return HU;
    case 35675:
      return qU;
    case 35676:
      return KU;
    case 5124:
    case 35670:
      return jU;
    case 35667:
    case 35671:
      return XU;
    case 35668:
    case 35672:
      return YU;
    case 35669:
    case 35673:
      return ZU;
    case 5125:
      return QU;
    case 36294:
      return JU;
    case 36295:
      return e$;
    case 36296:
      return t$;
    case 35678:
    case 36198:
    case 36298:
    case 36306:
    case 35682:
      return n$;
    case 35679:
    case 36299:
    case 36307:
      return i$;
    case 35680:
    case 36300:
    case 36308:
    case 36293:
      return r$;
    case 36289:
    case 36303:
    case 36311:
    case 36292:
      return s$;
  }
}
function a$(n, e) {
  n.uniform1fv(this.addr, e);
}
function c$(n, e) {
  const t = Mr(e, this.size, 2);
  n.uniform2fv(this.addr, t);
}
function l$(n, e) {
  const t = Mr(e, this.size, 3);
  n.uniform3fv(this.addr, t);
}
function u$(n, e) {
  const t = Mr(e, this.size, 4);
  n.uniform4fv(this.addr, t);
}
function h$(n, e) {
  const t = Mr(e, this.size, 4);
  n.uniformMatrix2fv(this.addr, !1, t);
}
function d$(n, e) {
  const t = Mr(e, this.size, 9);
  n.uniformMatrix3fv(this.addr, !1, t);
}
function f$(n, e) {
  const t = Mr(e, this.size, 16);
  n.uniformMatrix4fv(this.addr, !1, t);
}
function p$(n, e) {
  n.uniform1iv(this.addr, e);
}
function g$(n, e) {
  n.uniform2iv(this.addr, e);
}
function m$(n, e) {
  n.uniform3iv(this.addr, e);
}
function w$(n, e) {
  n.uniform4iv(this.addr, e);
}
function v$(n, e) {
  n.uniform1uiv(this.addr, e);
}
function y$(n, e) {
  n.uniform2uiv(this.addr, e);
}
function A$(n, e) {
  n.uniform3uiv(this.addr, e);
}
function b$(n, e) {
  n.uniform4uiv(this.addr, e);
}
function M$(n, e, t) {
  const i = this.cache,
    r = e.length,
    s = k6(t, r);
  T1(i, s) || (n.uniform1iv(this.addr, s), _1(i, s));
  for (let o = 0; o !== r; ++o) t.setTexture2D(e[o] || LG, s[o]);
}
function x$(n, e, t) {
  const i = this.cache,
    r = e.length,
    s = k6(t, r);
  T1(i, s) || (n.uniform1iv(this.addr, s), _1(i, s));
  for (let o = 0; o !== r; ++o) t.setTexture3D(e[o] || FG, s[o]);
}
function S$(n, e, t) {
  const i = this.cache,
    r = e.length,
    s = k6(t, r);
  T1(i, s) || (n.uniform1iv(this.addr, s), _1(i, s));
  for (let o = 0; o !== r; ++o) t.setTextureCube(e[o] || DG, s[o]);
}
function C$(n, e, t) {
  const i = this.cache,
    r = e.length,
    s = k6(t, r);
  T1(i, s) || (n.uniform1iv(this.addr, s), _1(i, s));
  for (let o = 0; o !== r; ++o) t.setTexture2DArray(e[o] || PG, s[o]);
}
function E$(n) {
  switch (n) {
    case 5126:
      return a$;
    case 35664:
      return c$;
    case 35665:
      return l$;
    case 35666:
      return u$;
    case 35674:
      return h$;
    case 35675:
      return d$;
    case 35676:
      return f$;
    case 5124:
    case 35670:
      return p$;
    case 35667:
    case 35671:
      return g$;
    case 35668:
    case 35672:
      return m$;
    case 35669:
    case 35673:
      return w$;
    case 5125:
      return v$;
    case 36294:
      return y$;
    case 36295:
      return A$;
    case 36296:
      return b$;
    case 35678:
    case 36198:
    case 36298:
    case 36306:
    case 35682:
      return M$;
    case 35679:
    case 36299:
    case 36307:
      return x$;
    case 35680:
    case 36300:
    case 36308:
    case 36293:
      return S$;
    case 36289:
    case 36303:
    case 36311:
    case 36292:
      return C$;
  }
}
class T$ {
  constructor(e, t, i) {
    ((this.id = e),
      (this.addr = i),
      (this.cache = []),
      (this.type = t.type),
      (this.setValue = o$(t.type)));
  }
}
class _$ {
  constructor(e, t, i) {
    ((this.id = e),
      (this.addr = i),
      (this.cache = []),
      (this.type = t.type),
      (this.size = t.size),
      (this.setValue = E$(t.type)));
  }
}
class G$ {
  constructor(e) {
    ((this.id = e), (this.seq = []), (this.map = {}));
  }
  setValue(e, t, i) {
    const r = this.seq;
    for (let s = 0, o = r.length; s !== o; ++s) {
      const a = r[s];
      a.setValue(e, t[a.id], i);
    }
  }
}
const du = /(\w+)(\])?(\[|\.)?/g;
function FA(n, e) {
  (n.seq.push(e), (n.map[e.id] = e));
}
function B$(n, e, t) {
  const i = n.name,
    r = i.length;
  for (du.lastIndex = 0; ;) {
    const s = du.exec(i),
      o = du.lastIndex;
    let a = s[1];
    const c = s[2] === "]",
      l = s[3];
    if ((c && (a = a | 0), l === void 0 || (l === "[" && o + 2 === r))) {
      FA(t, l === void 0 ? new T$(a, n, e) : new _$(a, n, e));
      break;
    } else {
      let h = t.map[a];
      (h === void 0 && ((h = new G$(a)), FA(t, h)), (t = h));
    }
  }
}
class zc {
  constructor(e, t) {
    ((this.seq = []), (this.map = {}));
    const i = e.getProgramParameter(t, e.ACTIVE_UNIFORMS);
    for (let r = 0; r < i; ++r) {
      const s = e.getActiveUniform(t, r),
        o = e.getUniformLocation(t, s.name);
      B$(s, o, this);
    }
  }
  setValue(e, t, i, r) {
    const s = this.map[t];
    s !== void 0 && s.setValue(e, i, r);
  }
  setOptional(e, t, i) {
    const r = t[i];
    r !== void 0 && this.setValue(e, i, r);
  }
  static upload(e, t, i, r) {
    for (let s = 0, o = t.length; s !== o; ++s) {
      const a = t[s],
        c = i[a.id];
      c.needsUpdate !== !1 && a.setValue(e, c.value, r);
    }
  }
  static seqWithValue(e, t) {
    const i = [];
    for (let r = 0, s = e.length; r !== s; ++r) {
      const o = e[r];
      o.id in t && i.push(o);
    }
    return i;
  }
}
function DA(n, e, t) {
  const i = n.createShader(e);
  return (n.shaderSource(i, t), n.compileShader(i), i);
}
const R$ = 37297;
let I$ = 0;
function k$(n, e) {
  const t = n.split(`
`),
    i = [],
    r = Math.max(e - 6, 0),
    s = Math.min(e + 6, t.length);
  for (let o = r; o < s; o++) {
    const a = o + 1;
    i.push(`${a === e ? ">" : " "} ${a}: ${t[o]}`);
  }
  return i.join(`
`);
}
const VA = new W2();
function L$(n) {
  f9._getMatrix(VA, f9.workingColorSpace, n);
  const e = `mat3( ${VA.elements.map((t) => t.toFixed(4))} )`;
  switch (f9.getTransfer(n)) {
    case Rl:
      return [e, "LinearTransferOETF"];
    case B9:
      return [e, "sRGBTransferOETF"];
    default:
      return (
        console.warn("THREE.WebGLProgram: Unsupported color space: ", n),
        [e, "LinearTransferOETF"]
      );
  }
}
function NA(n, e, t) {
  const i = n.getShaderParameter(e, n.COMPILE_STATUS),
    r = n.getShaderInfoLog(e).trim();
  if (i && r === "") return "";
  const s = /ERROR: 0:(\d+)/.exec(r);
  if (s) {
    const o = parseInt(s[1]);
    return (
      t.toUpperCase() +
      `

` +
      r +
      `

` +
      k$(n.getShaderSource(e), o)
    );
  } else return r;
}
function P$(n, e) {
  const t = L$(e);
  return [
    `vec4 ${n}( vec4 value ) {`,
    `	return ${t[1]}( vec4( value.rgb * ${t[0]}, value.a ) );`,
    "}",
  ].join(`
`);
}
function F$(n, e) {
  let t;
  switch (e) {
    case yV:
      t = "Linear";
      break;
    case AV:
      t = "Reinhard";
      break;
    case bV:
      t = "Cineon";
      break;
    case MV:
      t = "ACESFilmic";
      break;
    case SV:
      t = "AgX";
      break;
    case CV:
      t = "Neutral";
      break;
    case xV:
      t = "Custom";
      break;
    default:
      (console.warn("THREE.WebGLProgram: Unsupported toneMapping:", e),
        (t = "Linear"));
  }
  return (
    "vec3 " + n + "( vec3 color ) { return " + t + "ToneMapping( color ); }"
  );
}
const s8 = new H();
function D$() {
  f9.getLuminanceCoefficients(s8);
  const n = s8.x.toFixed(4),
    e = s8.y.toFixed(4),
    t = s8.z.toFixed(4);
  return [
    "float luminance( const in vec3 rgb ) {",
    `	const vec3 weights = vec3( ${n}, ${e}, ${t} );`,
    "	return dot( weights, rgb );",
    "}",
  ].join(`
`);
}
function V$(n) {
  return [
    n.extensionClipCullDistance
      ? "#extension GL_ANGLE_clip_cull_distance : require"
      : "",
    n.extensionMultiDraw ? "#extension GL_ANGLE_multi_draw : require" : "",
  ].filter(As).join(`
`);
}
function N$(n) {
  const e = [];
  for (const t in n) {
    const i = n[t];
    i !== !1 && e.push("#define " + t + " " + i);
  }
  return e.join(`
`);
}
function O$(n, e) {
  const t = {},
    i = n.getProgramParameter(e, n.ACTIVE_ATTRIBUTES);
  for (let r = 0; r < i; r++) {
    const s = n.getActiveAttrib(e, r),
      o = s.name;
    let a = 1;
    (s.type === n.FLOAT_MAT2 && (a = 2),
      s.type === n.FLOAT_MAT3 && (a = 3),
      s.type === n.FLOAT_MAT4 && (a = 4),
      (t[o] = {
        type: s.type,
        location: n.getAttribLocation(e, o),
        locationSize: a,
      }));
  }
  return t;
}
function As(n) {
  return n !== "";
}
function OA(n, e) {
  const t =
    e.numSpotLightShadows + e.numSpotLightMaps - e.numSpotLightShadowsWithMaps;
  return n
    .replace(/NUM_DIR_LIGHTS/g, e.numDirLights)
    .replace(/NUM_SPOT_LIGHTS/g, e.numSpotLights)
    .replace(/NUM_SPOT_LIGHT_MAPS/g, e.numSpotLightMaps)
    .replace(/NUM_SPOT_LIGHT_COORDS/g, t)
    .replace(/NUM_RECT_AREA_LIGHTS/g, e.numRectAreaLights)
    .replace(/NUM_POINT_LIGHTS/g, e.numPointLights)
    .replace(/NUM_HEMI_LIGHTS/g, e.numHemiLights)
    .replace(/NUM_DIR_LIGHT_SHADOWS/g, e.numDirLightShadows)
    .replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g, e.numSpotLightShadowsWithMaps)
    .replace(/NUM_SPOT_LIGHT_SHADOWS/g, e.numSpotLightShadows)
    .replace(/NUM_POINT_LIGHT_SHADOWS/g, e.numPointLightShadows);
}
function zA(n, e) {
  return n
    .replace(/NUM_CLIPPING_PLANES/g, e.numClippingPlanes)
    .replace(
      /UNION_CLIPPING_PLANES/g,
      e.numClippingPlanes - e.numClipIntersection,
    );
}
const z$ = /^[ \t]*#include +<([\w\d./]+)>/gm;
function bp(n) {
  return n.replace(z$, $$);
}
const U$ = new Map();
function $$(n, e) {
  let t = z2[e];
  if (t === void 0) {
    const i = U$.get(e);
    if (i !== void 0)
      ((t = z2[i]),
        console.warn(
          'THREE.WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',
          e,
          i,
        ));
    else throw new Error("Can not resolve #include <" + e + ">");
  }
  return bp(t);
}
const W$ =
  /#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;
function UA(n) {
  return n.replace(W$, H$);
}
function H$(n, e, t, i) {
  let r = "";
  for (let s = parseInt(e); s < parseInt(t); s++)
    r += i
      .replace(/\[\s*i\s*\]/g, "[ " + s + " ]")
      .replace(/UNROLLED_LOOP_INDEX/g, s);
  return r;
}
function $A(n) {
  let e = `precision ${n.precision} float;
	precision ${n.precision} int;
	precision ${n.precision} sampler2D;
	precision ${n.precision} samplerCube;
	precision ${n.precision} sampler3D;
	precision ${n.precision} sampler2DArray;
	precision ${n.precision} sampler2DShadow;
	precision ${n.precision} samplerCubeShadow;
	precision ${n.precision} sampler2DArrayShadow;
	precision ${n.precision} isampler2D;
	precision ${n.precision} isampler3D;
	precision ${n.precision} isamplerCube;
	precision ${n.precision} isampler2DArray;
	precision ${n.precision} usampler2D;
	precision ${n.precision} usampler3D;
	precision ${n.precision} usamplerCube;
	precision ${n.precision} usampler2DArray;
	`;
  return (
    n.precision === "highp"
      ? (e += `
#define HIGH_PRECISION`)
      : n.precision === "mediump"
        ? (e += `
#define MEDIUM_PRECISION`)
        : n.precision === "lowp" &&
          (e += `
#define LOW_PRECISION`),
    e
  );
}
function q$(n) {
  let e = "SHADOWMAP_TYPE_BASIC";
  return (
    n.shadowMapType === oG
      ? (e = "SHADOWMAP_TYPE_PCF")
      : n.shadowMapType === cV
        ? (e = "SHADOWMAP_TYPE_PCF_SOFT")
        : n.shadowMapType === B5 && (e = "SHADOWMAP_TYPE_VSM"),
    e
  );
}
function K$(n) {
  let e = "ENVMAP_TYPE_CUBE";
  if (n.envMap)
    switch (n.envMapMode) {
      case sr:
      case or:
        e = "ENVMAP_TYPE_CUBE";
        break;
      case I6:
        e = "ENVMAP_TYPE_CUBE_UV";
        break;
    }
  return e;
}
function j$(n) {
  let e = "ENVMAP_MODE_REFLECTION";
  return (n.envMap && n.envMapMode === or && (e = "ENVMAP_MODE_REFRACTION"), e);
}
function X$(n) {
  let e = "ENVMAP_BLENDING_NONE";
  if (n.envMap)
    switch (n.combine) {
      case aG:
        e = "ENVMAP_BLENDING_MULTIPLY";
        break;
      case wV:
        e = "ENVMAP_BLENDING_MIX";
        break;
      case vV:
        e = "ENVMAP_BLENDING_ADD";
        break;
    }
  return e;
}
function Y$(n) {
  const e = n.envMapCubeUVHeight;
  if (e === null) return null;
  const t = Math.log2(e) - 2,
    i = 1 / e;
  return {
    texelWidth: 1 / (3 * Math.max(Math.pow(2, t), 112)),
    texelHeight: i,
    maxMip: t,
  };
}
function Z$(n, e, t, i) {
  const r = n.getContext(),
    s = t.defines;
  let o = t.vertexShader,
    a = t.fragmentShader;
  const c = q$(t),
    l = K$(t),
    u = j$(t),
    h = X$(t),
    d = Y$(t),
    f = V$(t),
    p = N$(s),
    v = r.createProgram();
  let w,
    g,
    y = t.glslVersion
      ? "#version " +
        t.glslVersion +
        `
`
      : "";
  (t.isRawShaderMaterial
    ? ((w = [
        "#define SHADER_TYPE " + t.shaderType,
        "#define SHADER_NAME " + t.shaderName,
        p,
      ].filter(As).join(`
`)),
      w.length > 0 &&
        (w += `
`),
      (g = [
        "#define SHADER_TYPE " + t.shaderType,
        "#define SHADER_NAME " + t.shaderName,
        p,
      ].filter(As).join(`
`)),
      g.length > 0 &&
        (g += `
`))
    : ((w = [
        $A(t),
        "#define SHADER_TYPE " + t.shaderType,
        "#define SHADER_NAME " + t.shaderName,
        p,
        t.extensionClipCullDistance ? "#define USE_CLIP_DISTANCE" : "",
        t.batching ? "#define USE_BATCHING" : "",
        t.batchingColor ? "#define USE_BATCHING_COLOR" : "",
        t.instancing ? "#define USE_INSTANCING" : "",
        t.instancingColor ? "#define USE_INSTANCING_COLOR" : "",
        t.instancingMorph ? "#define USE_INSTANCING_MORPH" : "",
        t.useFog && t.fog ? "#define USE_FOG" : "",
        t.useFog && t.fogExp2 ? "#define FOG_EXP2" : "",
        t.map ? "#define USE_MAP" : "",
        t.envMap ? "#define USE_ENVMAP" : "",
        t.envMap ? "#define " + u : "",
        t.lightMap ? "#define USE_LIGHTMAP" : "",
        t.aoMap ? "#define USE_AOMAP" : "",
        t.bumpMap ? "#define USE_BUMPMAP" : "",
        t.normalMap ? "#define USE_NORMALMAP" : "",
        t.normalMapObjectSpace ? "#define USE_NORMALMAP_OBJECTSPACE" : "",
        t.normalMapTangentSpace ? "#define USE_NORMALMAP_TANGENTSPACE" : "",
        t.displacementMap ? "#define USE_DISPLACEMENTMAP" : "",
        t.emissiveMap ? "#define USE_EMISSIVEMAP" : "",
        t.anisotropy ? "#define USE_ANISOTROPY" : "",
        t.anisotropyMap ? "#define USE_ANISOTROPYMAP" : "",
        t.clearcoatMap ? "#define USE_CLEARCOATMAP" : "",
        t.clearcoatRoughnessMap ? "#define USE_CLEARCOAT_ROUGHNESSMAP" : "",
        t.clearcoatNormalMap ? "#define USE_CLEARCOAT_NORMALMAP" : "",
        t.iridescenceMap ? "#define USE_IRIDESCENCEMAP" : "",
        t.iridescenceThicknessMap ? "#define USE_IRIDESCENCE_THICKNESSMAP" : "",
        t.specularMap ? "#define USE_SPECULARMAP" : "",
        t.specularColorMap ? "#define USE_SPECULAR_COLORMAP" : "",
        t.specularIntensityMap ? "#define USE_SPECULAR_INTENSITYMAP" : "",
        t.roughnessMap ? "#define USE_ROUGHNESSMAP" : "",
        t.metalnessMap ? "#define USE_METALNESSMAP" : "",
        t.alphaMap ? "#define USE_ALPHAMAP" : "",
        t.alphaHash ? "#define USE_ALPHAHASH" : "",
        t.transmission ? "#define USE_TRANSMISSION" : "",
        t.transmissionMap ? "#define USE_TRANSMISSIONMAP" : "",
        t.thicknessMap ? "#define USE_THICKNESSMAP" : "",
        t.sheenColorMap ? "#define USE_SHEEN_COLORMAP" : "",
        t.sheenRoughnessMap ? "#define USE_SHEEN_ROUGHNESSMAP" : "",
        t.mapUv ? "#define MAP_UV " + t.mapUv : "",
        t.alphaMapUv ? "#define ALPHAMAP_UV " + t.alphaMapUv : "",
        t.lightMapUv ? "#define LIGHTMAP_UV " + t.lightMapUv : "",
        t.aoMapUv ? "#define AOMAP_UV " + t.aoMapUv : "",
        t.emissiveMapUv ? "#define EMISSIVEMAP_UV " + t.emissiveMapUv : "",
        t.bumpMapUv ? "#define BUMPMAP_UV " + t.bumpMapUv : "",
        t.normalMapUv ? "#define NORMALMAP_UV " + t.normalMapUv : "",
        t.displacementMapUv
          ? "#define DISPLACEMENTMAP_UV " + t.displacementMapUv
          : "",
        t.metalnessMapUv ? "#define METALNESSMAP_UV " + t.metalnessMapUv : "",
        t.roughnessMapUv ? "#define ROUGHNESSMAP_UV " + t.roughnessMapUv : "",
        t.anisotropyMapUv
          ? "#define ANISOTROPYMAP_UV " + t.anisotropyMapUv
          : "",
        t.clearcoatMapUv ? "#define CLEARCOATMAP_UV " + t.clearcoatMapUv : "",
        t.clearcoatNormalMapUv
          ? "#define CLEARCOAT_NORMALMAP_UV " + t.clearcoatNormalMapUv
          : "",
        t.clearcoatRoughnessMapUv
          ? "#define CLEARCOAT_ROUGHNESSMAP_UV " + t.clearcoatRoughnessMapUv
          : "",
        t.iridescenceMapUv
          ? "#define IRIDESCENCEMAP_UV " + t.iridescenceMapUv
          : "",
        t.iridescenceThicknessMapUv
          ? "#define IRIDESCENCE_THICKNESSMAP_UV " + t.iridescenceThicknessMapUv
          : "",
        t.sheenColorMapUv
          ? "#define SHEEN_COLORMAP_UV " + t.sheenColorMapUv
          : "",
        t.sheenRoughnessMapUv
          ? "#define SHEEN_ROUGHNESSMAP_UV " + t.sheenRoughnessMapUv
          : "",
        t.specularMapUv ? "#define SPECULARMAP_UV " + t.specularMapUv : "",
        t.specularColorMapUv
          ? "#define SPECULAR_COLORMAP_UV " + t.specularColorMapUv
          : "",
        t.specularIntensityMapUv
          ? "#define SPECULAR_INTENSITYMAP_UV " + t.specularIntensityMapUv
          : "",
        t.transmissionMapUv
          ? "#define TRANSMISSIONMAP_UV " + t.transmissionMapUv
          : "",
        t.thicknessMapUv ? "#define THICKNESSMAP_UV " + t.thicknessMapUv : "",
        t.vertexTangents && t.flatShading === !1 ? "#define USE_TANGENT" : "",
        t.vertexColors ? "#define USE_COLOR" : "",
        t.vertexAlphas ? "#define USE_COLOR_ALPHA" : "",
        t.vertexUv1s ? "#define USE_UV1" : "",
        t.vertexUv2s ? "#define USE_UV2" : "",
        t.vertexUv3s ? "#define USE_UV3" : "",
        t.pointsUvs ? "#define USE_POINTS_UV" : "",
        t.flatShading ? "#define FLAT_SHADED" : "",
        t.skinning ? "#define USE_SKINNING" : "",
        t.morphTargets ? "#define USE_MORPHTARGETS" : "",
        t.morphNormals && t.flatShading === !1
          ? "#define USE_MORPHNORMALS"
          : "",
        t.morphColors ? "#define USE_MORPHCOLORS" : "",
        t.morphTargetsCount > 0
          ? "#define MORPHTARGETS_TEXTURE_STRIDE " + t.morphTextureStride
          : "",
        t.morphTargetsCount > 0
          ? "#define MORPHTARGETS_COUNT " + t.morphTargetsCount
          : "",
        t.doubleSided ? "#define DOUBLE_SIDED" : "",
        t.flipSided ? "#define FLIP_SIDED" : "",
        t.shadowMapEnabled ? "#define USE_SHADOWMAP" : "",
        t.shadowMapEnabled ? "#define " + c : "",
        t.sizeAttenuation ? "#define USE_SIZEATTENUATION" : "",
        t.numLightProbes > 0 ? "#define USE_LIGHT_PROBES" : "",
        t.logarithmicDepthBuffer ? "#define USE_LOGDEPTHBUF" : "",
        t.reverseDepthBuffer ? "#define USE_REVERSEDEPTHBUF" : "",
        "uniform mat4 modelMatrix;",
        "uniform mat4 modelViewMatrix;",
        "uniform mat4 projectionMatrix;",
        "uniform mat4 viewMatrix;",
        "uniform mat3 normalMatrix;",
        "uniform vec3 cameraPosition;",
        "uniform bool isOrthographic;",
        "#ifdef USE_INSTANCING",
        "	attribute mat4 instanceMatrix;",
        "#endif",
        "#ifdef USE_INSTANCING_COLOR",
        "	attribute vec3 instanceColor;",
        "#endif",
        "#ifdef USE_INSTANCING_MORPH",
        "	uniform sampler2D morphTexture;",
        "#endif",
        "attribute vec3 position;",
        "attribute vec3 normal;",
        "attribute vec2 uv;",
        "#ifdef USE_UV1",
        "	attribute vec2 uv1;",
        "#endif",
        "#ifdef USE_UV2",
        "	attribute vec2 uv2;",
        "#endif",
        "#ifdef USE_UV3",
        "	attribute vec2 uv3;",
        "#endif",
        "#ifdef USE_TANGENT",
        "	attribute vec4 tangent;",
        "#endif",
        "#if defined( USE_COLOR_ALPHA )",
        "	attribute vec4 color;",
        "#elif defined( USE_COLOR )",
        "	attribute vec3 color;",
        "#endif",
        "#ifdef USE_SKINNING",
        "	attribute vec4 skinIndex;",
        "	attribute vec4 skinWeight;",
        "#endif",
        `
`,
      ].filter(As).join(`
`)),
      (g = [
        $A(t),
        "#define SHADER_TYPE " + t.shaderType,
        "#define SHADER_NAME " + t.shaderName,
        p,
        t.useFog && t.fog ? "#define USE_FOG" : "",
        t.useFog && t.fogExp2 ? "#define FOG_EXP2" : "",
        t.alphaToCoverage ? "#define ALPHA_TO_COVERAGE" : "",
        t.map ? "#define USE_MAP" : "",
        t.matcap ? "#define USE_MATCAP" : "",
        t.envMap ? "#define USE_ENVMAP" : "",
        t.envMap ? "#define " + l : "",
        t.envMap ? "#define " + u : "",
        t.envMap ? "#define " + h : "",
        d ? "#define CUBEUV_TEXEL_WIDTH " + d.texelWidth : "",
        d ? "#define CUBEUV_TEXEL_HEIGHT " + d.texelHeight : "",
        d ? "#define CUBEUV_MAX_MIP " + d.maxMip + ".0" : "",
        t.lightMap ? "#define USE_LIGHTMAP" : "",
        t.aoMap ? "#define USE_AOMAP" : "",
        t.bumpMap ? "#define USE_BUMPMAP" : "",
        t.normalMap ? "#define USE_NORMALMAP" : "",
        t.normalMapObjectSpace ? "#define USE_NORMALMAP_OBJECTSPACE" : "",
        t.normalMapTangentSpace ? "#define USE_NORMALMAP_TANGENTSPACE" : "",
        t.emissiveMap ? "#define USE_EMISSIVEMAP" : "",
        t.anisotropy ? "#define USE_ANISOTROPY" : "",
        t.anisotropyMap ? "#define USE_ANISOTROPYMAP" : "",
        t.clearcoat ? "#define USE_CLEARCOAT" : "",
        t.clearcoatMap ? "#define USE_CLEARCOATMAP" : "",
        t.clearcoatRoughnessMap ? "#define USE_CLEARCOAT_ROUGHNESSMAP" : "",
        t.clearcoatNormalMap ? "#define USE_CLEARCOAT_NORMALMAP" : "",
        t.dispersion ? "#define USE_DISPERSION" : "",
        t.iridescence ? "#define USE_IRIDESCENCE" : "",
        t.iridescenceMap ? "#define USE_IRIDESCENCEMAP" : "",
        t.iridescenceThicknessMap ? "#define USE_IRIDESCENCE_THICKNESSMAP" : "",
        t.specularMap ? "#define USE_SPECULARMAP" : "",
        t.specularColorMap ? "#define USE_SPECULAR_COLORMAP" : "",
        t.specularIntensityMap ? "#define USE_SPECULAR_INTENSITYMAP" : "",
        t.roughnessMap ? "#define USE_ROUGHNESSMAP" : "",
        t.metalnessMap ? "#define USE_METALNESSMAP" : "",
        t.alphaMap ? "#define USE_ALPHAMAP" : "",
        t.alphaTest ? "#define USE_ALPHATEST" : "",
        t.alphaHash ? "#define USE_ALPHAHASH" : "",
        t.sheen ? "#define USE_SHEEN" : "",
        t.sheenColorMap ? "#define USE_SHEEN_COLORMAP" : "",
        t.sheenRoughnessMap ? "#define USE_SHEEN_ROUGHNESSMAP" : "",
        t.transmission ? "#define USE_TRANSMISSION" : "",
        t.transmissionMap ? "#define USE_TRANSMISSIONMAP" : "",
        t.thicknessMap ? "#define USE_THICKNESSMAP" : "",
        t.vertexTangents && t.flatShading === !1 ? "#define USE_TANGENT" : "",
        t.vertexColors || t.instancingColor || t.batchingColor
          ? "#define USE_COLOR"
          : "",
        t.vertexAlphas ? "#define USE_COLOR_ALPHA" : "",
        t.vertexUv1s ? "#define USE_UV1" : "",
        t.vertexUv2s ? "#define USE_UV2" : "",
        t.vertexUv3s ? "#define USE_UV3" : "",
        t.pointsUvs ? "#define USE_POINTS_UV" : "",
        t.gradientMap ? "#define USE_GRADIENTMAP" : "",
        t.flatShading ? "#define FLAT_SHADED" : "",
        t.doubleSided ? "#define DOUBLE_SIDED" : "",
        t.flipSided ? "#define FLIP_SIDED" : "",
        t.shadowMapEnabled ? "#define USE_SHADOWMAP" : "",
        t.shadowMapEnabled ? "#define " + c : "",
        t.premultipliedAlpha ? "#define PREMULTIPLIED_ALPHA" : "",
        t.numLightProbes > 0 ? "#define USE_LIGHT_PROBES" : "",
        t.decodeVideoTexture ? "#define DECODE_VIDEO_TEXTURE" : "",
        t.decodeVideoTextureEmissive
          ? "#define DECODE_VIDEO_TEXTURE_EMISSIVE"
          : "",
        t.logarithmicDepthBuffer ? "#define USE_LOGDEPTHBUF" : "",
        t.reverseDepthBuffer ? "#define USE_REVERSEDEPTHBUF" : "",
        "uniform mat4 viewMatrix;",
        "uniform vec3 cameraPosition;",
        "uniform bool isOrthographic;",
        t.toneMapping !== Jn ? "#define TONE_MAPPING" : "",
        t.toneMapping !== Jn ? z2.tonemapping_pars_fragment : "",
        t.toneMapping !== Jn ? F$("toneMapping", t.toneMapping) : "",
        t.dithering ? "#define DITHERING" : "",
        t.opaque ? "#define OPAQUE" : "",
        z2.colorspace_pars_fragment,
        P$("linearToOutputTexel", t.outputColorSpace),
        D$(),
        t.useDepthPacking ? "#define DEPTH_PACKING " + t.depthPacking : "",
        `
`,
      ].filter(As).join(`
`))),
    (o = bp(o)),
    (o = OA(o, t)),
    (o = zA(o, t)),
    (a = bp(a)),
    (a = OA(a, t)),
    (a = zA(a, t)),
    (o = UA(o)),
    (a = UA(a)),
    t.isRawShaderMaterial !== !0 &&
      ((y = `#version 300 es
`),
      (w =
        [
          f,
          "#define attribute in",
          "#define varying out",
          "#define texture2D texture",
        ].join(`
`) +
        `
` +
        w),
      (g =
        [
          "#define varying in",
          t.glslVersion === eA
            ? ""
            : "layout(location = 0) out highp vec4 pc_fragColor;",
          t.glslVersion === eA ? "" : "#define gl_FragColor pc_fragColor",
          "#define gl_FragDepthEXT gl_FragDepth",
          "#define texture2D texture",
          "#define textureCube texture",
          "#define texture2DProj textureProj",
          "#define texture2DLodEXT textureLod",
          "#define texture2DProjLodEXT textureProjLod",
          "#define textureCubeLodEXT textureLod",
          "#define texture2DGradEXT textureGrad",
          "#define texture2DProjGradEXT textureProjGrad",
          "#define textureCubeGradEXT textureGrad",
        ].join(`
`) +
        `
` +
        g)));
  const b = y + w + o,
    A = y + g + a,
    x = DA(r, r.VERTEX_SHADER, b),
    M = DA(r, r.FRAGMENT_SHADER, A);
  (r.attachShader(v, x),
    r.attachShader(v, M),
    t.index0AttributeName !== void 0
      ? r.bindAttribLocation(v, 0, t.index0AttributeName)
      : t.morphTargets === !0 && r.bindAttribLocation(v, 0, "position"),
    r.linkProgram(v));
  function E(G) {
    if (n.debug.checkShaderErrors) {
      const I = r.getProgramInfoLog(v).trim(),
        L = r.getShaderInfoLog(x).trim(),
        k = r.getShaderInfoLog(M).trim();
      let D = !0,
        V = !0;
      if (r.getProgramParameter(v, r.LINK_STATUS) === !1)
        if (((D = !1), typeof n.debug.onShaderError == "function"))
          n.debug.onShaderError(r, v, x, M);
        else {
          const K = NA(r, x, "vertex"),
            P = NA(r, M, "fragment");
          console.error(
            "THREE.WebGLProgram: Shader Error " +
              r.getError() +
              " - VALIDATE_STATUS " +
              r.getProgramParameter(v, r.VALIDATE_STATUS) +
              `

Material Name: ` +
              G.name +
              `
Material Type: ` +
              G.type +
              `

Program Info Log: ` +
              I +
              `
` +
              K +
              `
` +
              P,
          );
        }
      else
        I !== ""
          ? console.warn("THREE.WebGLProgram: Program Info Log:", I)
          : (L === "" || k === "") && (V = !1);
      V &&
        (G.diagnostics = {
          runnable: D,
          programLog: I,
          vertexShader: { log: L, prefix: w },
          fragmentShader: { log: k, prefix: g },
        });
    }
    (r.deleteShader(x), r.deleteShader(M), (_ = new zc(r, v)), (C = O$(r, v)));
  }
  let _;
  this.getUniforms = function () {
    return (_ === void 0 && E(this), _);
  };
  let C;
  this.getAttributes = function () {
    return (C === void 0 && E(this), C);
  };
  let S = t.rendererExtensionParallelShaderCompile === !1;
  return (
    (this.isReady = function () {
      return (S === !1 && (S = r.getProgramParameter(v, R$)), S);
    }),
    (this.destroy = function () {
      (i.releaseStatesOfProgram(this),
        r.deleteProgram(v),
        (this.program = void 0));
    }),
    (this.type = t.shaderType),
    (this.name = t.shaderName),
    (this.id = I$++),
    (this.cacheKey = e),
    (this.usedTimes = 1),
    (this.program = v),
    (this.vertexShader = x),
    (this.fragmentShader = M),
    this
  );
}
let Q$ = 0;
class J$ {
  constructor() {
    ((this.shaderCache = new Map()), (this.materialCache = new Map()));
  }
  update(e) {
    const t = e.vertexShader,
      i = e.fragmentShader,
      r = this._getShaderStage(t),
      s = this._getShaderStage(i),
      o = this._getShaderCacheForMaterial(e);
    return (
      o.has(r) === !1 && (o.add(r), r.usedTimes++),
      o.has(s) === !1 && (o.add(s), s.usedTimes++),
      this
    );
  }
  remove(e) {
    const t = this.materialCache.get(e);
    for (const i of t)
      (i.usedTimes--, i.usedTimes === 0 && this.shaderCache.delete(i.code));
    return (this.materialCache.delete(e), this);
  }
  getVertexShaderID(e) {
    return this._getShaderStage(e.vertexShader).id;
  }
  getFragmentShaderID(e) {
    return this._getShaderStage(e.fragmentShader).id;
  }
  dispose() {
    (this.shaderCache.clear(), this.materialCache.clear());
  }
  _getShaderCacheForMaterial(e) {
    const t = this.materialCache;
    let i = t.get(e);
    return (i === void 0 && ((i = new Set()), t.set(e, i)), i);
  }
  _getShaderStage(e) {
    const t = this.shaderCache;
    let i = t.get(e);
    return (i === void 0 && ((i = new eW(e)), t.set(e, i)), i);
  }
}
class eW {
  constructor(e) {
    ((this.id = Q$++), (this.code = e), (this.usedTimes = 0));
  }
}
function tW(n, e, t, i, r, s, o) {
  const a = new bG(),
    c = new J$(),
    l = new Set(),
    u = [],
    h = r.logarithmicDepthBuffer,
    d = r.vertexTextures;
  let f = r.precision;
  const p = {
    MeshDepthMaterial: "depth",
    MeshDistanceMaterial: "distanceRGBA",
    MeshNormalMaterial: "normal",
    MeshBasicMaterial: "basic",
    MeshLambertMaterial: "lambert",
    MeshPhongMaterial: "phong",
    MeshToonMaterial: "toon",
    MeshStandardMaterial: "physical",
    MeshPhysicalMaterial: "physical",
    MeshMatcapMaterial: "matcap",
    LineBasicMaterial: "basic",
    LineDashedMaterial: "dashed",
    PointsMaterial: "points",
    ShadowMaterial: "shadow",
    SpriteMaterial: "sprite",
  };
  function v(C) {
    return (l.add(C), C === 0 ? "uv" : `uv${C}`);
  }
  function w(C, S, G, I, L) {
    const k = I.fog,
      D = L.geometry,
      V = C.isMeshStandardMaterial ? I.environment : null,
      K = (C.isMeshStandardMaterial ? t : e).get(C.envMap || V),
      P = K && K.mapping === I6 ? K.image.height : null,
      q = p[C.type];
    C.precision !== null &&
      ((f = r.getMaxPrecision(C.precision)),
      f !== C.precision &&
        console.warn(
          "THREE.WebGLProgram.getParameters:",
          C.precision,
          "not supported, using",
          f,
          "instead.",
        ));
    const e0 =
        D.morphAttributes.position ||
        D.morphAttributes.normal ||
        D.morphAttributes.color,
      Q = e0 !== void 0 ? e0.length : 0;
    let U = 0;
    (D.morphAttributes.position !== void 0 && (U = 1),
      D.morphAttributes.normal !== void 0 && (U = 2),
      D.morphAttributes.color !== void 0 && (U = 3));
    let O, F, z, Y;
    if (q) {
      const A9 = Xt[q];
      ((O = A9.vertexShader), (F = A9.fragmentShader));
    } else
      ((O = C.vertexShader),
        (F = C.fragmentShader),
        c.update(C),
        (z = c.getVertexShaderID(C)),
        (Y = c.getFragmentShaderID(C)));
    const X = n.getRenderTarget(),
      l0 = n.state.buffers.depth.getReversed(),
      r0 = L.isInstancedMesh === !0,
      j = L.isBatchedMesh === !0,
      F0 = !!C.map,
      O0 = !!C.matcap,
      z0 = !!K,
      W = !!C.aoMap,
      R2 = !!C.lightMap,
      I0 = !!C.bumpMap,
      o2 = !!C.normalMap,
      G0 = !!C.displacementMap,
      D0 = !!C.emissiveMap,
      E0 = !!C.metalnessMap,
      f2 = !!C.roughnessMap,
      O2 = C.anisotropy > 0,
      B = C.clearcoat > 0,
      R = C.dispersion > 0,
      $ = C.iridescence > 0,
      o0 = C.sheen > 0,
      u0 = C.transmission > 0,
      c0 = O2 && !!C.anisotropyMap,
      x0 = B && !!C.clearcoatMap,
      C0 = B && !!C.clearcoatNormalMap,
      S0 = B && !!C.clearcoatRoughnessMap,
      U0 = $ && !!C.iridescenceMap,
      m0 = $ && !!C.iridescenceThicknessMap,
      q0 = o0 && !!C.sheenColorMap,
      t2 = o0 && !!C.sheenRoughnessMap,
      Z0 = !!C.specularMap,
      B0 = !!C.specularColorMap,
      r2 = !!C.specularIntensityMap,
      Z = u0 && !!C.transmissionMap,
      N0 = u0 && !!C.thicknessMap,
      b0 = !!C.gradientMap,
      $0 = !!C.alphaMap,
      M0 = C.alphaTest > 0,
      g0 = !!C.alphaHash,
      a2 = !!C.extensions;
    let U2 = Jn;
    C.toneMapped &&
      (X === null || X.isXRRenderTarget === !0) &&
      (U2 = n.toneMapping);
    const $9 = {
      shaderID: q,
      shaderType: C.type,
      shaderName: C.name,
      vertexShader: O,
      fragmentShader: F,
      defines: C.defines,
      customVertexShaderID: z,
      customFragmentShaderID: Y,
      isRawShaderMaterial: C.isRawShaderMaterial === !0,
      glslVersion: C.glslVersion,
      precision: f,
      batching: j,
      batchingColor: j && L._colorsTexture !== null,
      instancing: r0,
      instancingColor: r0 && L.instanceColor !== null,
      instancingMorph: r0 && L.morphTexture !== null,
      supportsVertexTextures: d,
      outputColorSpace:
        X === null
          ? n.outputColorSpace
          : X.isXRRenderTarget === !0
            ? X.texture.colorSpace
            : qe,
      alphaToCoverage: !!C.alphaToCoverage,
      map: F0,
      matcap: O0,
      envMap: z0,
      envMapMode: z0 && K.mapping,
      envMapCubeUVHeight: P,
      aoMap: W,
      lightMap: R2,
      bumpMap: I0,
      normalMap: o2,
      displacementMap: d && G0,
      emissiveMap: D0,
      normalMapObjectSpace: o2 && C.normalMapType === GV,
      normalMapTangentSpace: o2 && C.normalMapType === _V,
      metalnessMap: E0,
      roughnessMap: f2,
      anisotropy: O2,
      anisotropyMap: c0,
      clearcoat: B,
      clearcoatMap: x0,
      clearcoatNormalMap: C0,
      clearcoatRoughnessMap: S0,
      dispersion: R,
      iridescence: $,
      iridescenceMap: U0,
      iridescenceThicknessMap: m0,
      sheen: o0,
      sheenColorMap: q0,
      sheenRoughnessMap: t2,
      specularMap: Z0,
      specularColorMap: B0,
      specularIntensityMap: r2,
      transmission: u0,
      transmissionMap: Z,
      thicknessMap: N0,
      gradientMap: b0,
      opaque:
        C.transparent === !1 && C.blending === X5 && C.alphaToCoverage === !1,
      alphaMap: $0,
      alphaTest: M0,
      alphaHash: g0,
      combine: C.combine,
      mapUv: F0 && v(C.map.channel),
      aoMapUv: W && v(C.aoMap.channel),
      lightMapUv: R2 && v(C.lightMap.channel),
      bumpMapUv: I0 && v(C.bumpMap.channel),
      normalMapUv: o2 && v(C.normalMap.channel),
      displacementMapUv: G0 && v(C.displacementMap.channel),
      emissiveMapUv: D0 && v(C.emissiveMap.channel),
      metalnessMapUv: E0 && v(C.metalnessMap.channel),
      roughnessMapUv: f2 && v(C.roughnessMap.channel),
      anisotropyMapUv: c0 && v(C.anisotropyMap.channel),
      clearcoatMapUv: x0 && v(C.clearcoatMap.channel),
      clearcoatNormalMapUv: C0 && v(C.clearcoatNormalMap.channel),
      clearcoatRoughnessMapUv: S0 && v(C.clearcoatRoughnessMap.channel),
      iridescenceMapUv: U0 && v(C.iridescenceMap.channel),
      iridescenceThicknessMapUv: m0 && v(C.iridescenceThicknessMap.channel),
      sheenColorMapUv: q0 && v(C.sheenColorMap.channel),
      sheenRoughnessMapUv: t2 && v(C.sheenRoughnessMap.channel),
      specularMapUv: Z0 && v(C.specularMap.channel),
      specularColorMapUv: B0 && v(C.specularColorMap.channel),
      specularIntensityMapUv: r2 && v(C.specularIntensityMap.channel),
      transmissionMapUv: Z && v(C.transmissionMap.channel),
      thicknessMapUv: N0 && v(C.thicknessMap.channel),
      alphaMapUv: $0 && v(C.alphaMap.channel),
      vertexTangents: !!D.attributes.tangent && (o2 || O2),
      vertexColors: C.vertexColors,
      vertexAlphas:
        C.vertexColors === !0 &&
        !!D.attributes.color &&
        D.attributes.color.itemSize === 4,
      pointsUvs: L.isPoints === !0 && !!D.attributes.uv && (F0 || $0),
      fog: !!k,
      useFog: C.fog === !0,
      fogExp2: !!k && k.isFogExp2,
      flatShading: C.flatShading === !0 && C.wireframe === !1,
      sizeAttenuation: C.sizeAttenuation === !0,
      logarithmicDepthBuffer: h,
      reverseDepthBuffer: l0,
      skinning: L.isSkinnedMesh === !0,
      morphTargets: D.morphAttributes.position !== void 0,
      morphNormals: D.morphAttributes.normal !== void 0,
      morphColors: D.morphAttributes.color !== void 0,
      morphTargetsCount: Q,
      morphTextureStride: U,
      numDirLights: S.directional.length,
      numPointLights: S.point.length,
      numSpotLights: S.spot.length,
      numSpotLightMaps: S.spotLightMap.length,
      numRectAreaLights: S.rectArea.length,
      numHemiLights: S.hemi.length,
      numDirLightShadows: S.directionalShadowMap.length,
      numPointLightShadows: S.pointShadowMap.length,
      numSpotLightShadows: S.spotShadowMap.length,
      numSpotLightShadowsWithMaps: S.numSpotLightShadowsWithMaps,
      numLightProbes: S.numLightProbes,
      numClippingPlanes: o.numPlanes,
      numClipIntersection: o.numIntersection,
      dithering: C.dithering,
      shadowMapEnabled: n.shadowMap.enabled && G.length > 0,
      shadowMapType: n.shadowMap.type,
      toneMapping: U2,
      decodeVideoTexture:
        F0 &&
        C.map.isVideoTexture === !0 &&
        f9.getTransfer(C.map.colorSpace) === B9,
      decodeVideoTextureEmissive:
        D0 &&
        C.emissiveMap.isVideoTexture === !0 &&
        f9.getTransfer(C.emissiveMap.colorSpace) === B9,
      premultipliedAlpha: C.premultipliedAlpha,
      doubleSided: C.side === s1,
      flipSided: C.side === me,
      useDepthPacking: C.depthPacking >= 0,
      depthPacking: C.depthPacking || 0,
      index0AttributeName: C.index0AttributeName,
      extensionClipCullDistance:
        a2 &&
        C.extensions.clipCullDistance === !0 &&
        i.has("WEBGL_clip_cull_distance"),
      extensionMultiDraw:
        ((a2 && C.extensions.multiDraw === !0) || j) &&
        i.has("WEBGL_multi_draw"),
      rendererExtensionParallelShaderCompile: i.has(
        "KHR_parallel_shader_compile",
      ),
      customProgramCacheKey: C.customProgramCacheKey(),
    };
    return (
      ($9.vertexUv1s = l.has(1)),
      ($9.vertexUv2s = l.has(2)),
      ($9.vertexUv3s = l.has(3)),
      l.clear(),
      $9
    );
  }
  function g(C) {
    const S = [];
    if (
      (C.shaderID
        ? S.push(C.shaderID)
        : (S.push(C.customVertexShaderID), S.push(C.customFragmentShaderID)),
      C.defines !== void 0)
    )
      for (const G in C.defines) (S.push(G), S.push(C.defines[G]));
    return (
      C.isRawShaderMaterial === !1 &&
        (y(S, C), b(S, C), S.push(n.outputColorSpace)),
      S.push(C.customProgramCacheKey),
      S.join()
    );
  }
  function y(C, S) {
    (C.push(S.precision),
      C.push(S.outputColorSpace),
      C.push(S.envMapMode),
      C.push(S.envMapCubeUVHeight),
      C.push(S.mapUv),
      C.push(S.alphaMapUv),
      C.push(S.lightMapUv),
      C.push(S.aoMapUv),
      C.push(S.bumpMapUv),
      C.push(S.normalMapUv),
      C.push(S.displacementMapUv),
      C.push(S.emissiveMapUv),
      C.push(S.metalnessMapUv),
      C.push(S.roughnessMapUv),
      C.push(S.anisotropyMapUv),
      C.push(S.clearcoatMapUv),
      C.push(S.clearcoatNormalMapUv),
      C.push(S.clearcoatRoughnessMapUv),
      C.push(S.iridescenceMapUv),
      C.push(S.iridescenceThicknessMapUv),
      C.push(S.sheenColorMapUv),
      C.push(S.sheenRoughnessMapUv),
      C.push(S.specularMapUv),
      C.push(S.specularColorMapUv),
      C.push(S.specularIntensityMapUv),
      C.push(S.transmissionMapUv),
      C.push(S.thicknessMapUv),
      C.push(S.combine),
      C.push(S.fogExp2),
      C.push(S.sizeAttenuation),
      C.push(S.morphTargetsCount),
      C.push(S.morphAttributeCount),
      C.push(S.numDirLights),
      C.push(S.numPointLights),
      C.push(S.numSpotLights),
      C.push(S.numSpotLightMaps),
      C.push(S.numHemiLights),
      C.push(S.numRectAreaLights),
      C.push(S.numDirLightShadows),
      C.push(S.numPointLightShadows),
      C.push(S.numSpotLightShadows),
      C.push(S.numSpotLightShadowsWithMaps),
      C.push(S.numLightProbes),
      C.push(S.shadowMapType),
      C.push(S.toneMapping),
      C.push(S.numClippingPlanes),
      C.push(S.numClipIntersection),
      C.push(S.depthPacking));
  }
  function b(C, S) {
    (a.disableAll(),
      S.supportsVertexTextures && a.enable(0),
      S.instancing && a.enable(1),
      S.instancingColor && a.enable(2),
      S.instancingMorph && a.enable(3),
      S.matcap && a.enable(4),
      S.envMap && a.enable(5),
      S.normalMapObjectSpace && a.enable(6),
      S.normalMapTangentSpace && a.enable(7),
      S.clearcoat && a.enable(8),
      S.iridescence && a.enable(9),
      S.alphaTest && a.enable(10),
      S.vertexColors && a.enable(11),
      S.vertexAlphas && a.enable(12),
      S.vertexUv1s && a.enable(13),
      S.vertexUv2s && a.enable(14),
      S.vertexUv3s && a.enable(15),
      S.vertexTangents && a.enable(16),
      S.anisotropy && a.enable(17),
      S.alphaHash && a.enable(18),
      S.batching && a.enable(19),
      S.dispersion && a.enable(20),
      S.batchingColor && a.enable(21),
      S.gradientMap && a.enable(22),
      C.push(a.mask),
      a.disableAll(),
      S.fog && a.enable(0),
      S.useFog && a.enable(1),
      S.flatShading && a.enable(2),
      S.logarithmicDepthBuffer && a.enable(3),
      S.reverseDepthBuffer && a.enable(4),
      S.skinning && a.enable(5),
      S.morphTargets && a.enable(6),
      S.morphNormals && a.enable(7),
      S.morphColors && a.enable(8),
      S.premultipliedAlpha && a.enable(9),
      S.shadowMapEnabled && a.enable(10),
      S.doubleSided && a.enable(11),
      S.flipSided && a.enable(12),
      S.useDepthPacking && a.enable(13),
      S.dithering && a.enable(14),
      S.transmission && a.enable(15),
      S.sheen && a.enable(16),
      S.opaque && a.enable(17),
      S.pointsUvs && a.enable(18),
      S.decodeVideoTexture && a.enable(19),
      S.decodeVideoTextureEmissive && a.enable(20),
      S.alphaToCoverage && a.enable(21),
      C.push(a.mask));
  }
  function A(C) {
    const S = p[C.type];
    let G;
    if (S) {
      const I = Xt[S];
      G = MN.clone(I.uniforms);
    } else G = C.uniforms;
    return G;
  }
  function x(C, S) {
    let G;
    for (let I = 0, L = u.length; I < L; I++) {
      const k = u[I];
      if (k.cacheKey === S) {
        ((G = k), ++G.usedTimes);
        break;
      }
    }
    return (G === void 0 && ((G = new Z$(n, S, C, s)), u.push(G)), G);
  }
  function M(C) {
    if (--C.usedTimes === 0) {
      const S = u.indexOf(C);
      ((u[S] = u[u.length - 1]), u.pop(), C.destroy());
    }
  }
  function E(C) {
    c.remove(C);
  }
  function _() {
    c.dispose();
  }
  return {
    getParameters: w,
    getProgramCacheKey: g,
    getUniforms: A,
    acquireProgram: x,
    releaseProgram: M,
    releaseShaderCache: E,
    programs: u,
    dispose: _,
  };
}
function nW() {
  let n = new WeakMap();
  function e(o) {
    return n.has(o);
  }
  function t(o) {
    let a = n.get(o);
    return (a === void 0 && ((a = {}), n.set(o, a)), a);
  }
  function i(o) {
    n.delete(o);
  }
  function r(o, a, c) {
    n.get(o)[a] = c;
  }
  function s() {
    n = new WeakMap();
  }
  return { has: e, get: t, remove: i, update: r, dispose: s };
}
function iW(n, e) {
  return n.groupOrder !== e.groupOrder
    ? n.groupOrder - e.groupOrder
    : n.renderOrder !== e.renderOrder
      ? n.renderOrder - e.renderOrder
      : n.material.id !== e.material.id
        ? n.material.id - e.material.id
        : n.z !== e.z
          ? n.z - e.z
          : n.id - e.id;
}
function WA(n, e) {
  return n.groupOrder !== e.groupOrder
    ? n.groupOrder - e.groupOrder
    : n.renderOrder !== e.renderOrder
      ? n.renderOrder - e.renderOrder
      : n.z !== e.z
        ? e.z - n.z
        : n.id - e.id;
}
function HA() {
  const n = [];
  let e = 0;
  const t = [],
    i = [],
    r = [];
  function s() {
    ((e = 0), (t.length = 0), (i.length = 0), (r.length = 0));
  }
  function o(h, d, f, p, v, w) {
    let g = n[e];
    return (
      g === void 0
        ? ((g = {
            id: h.id,
            object: h,
            geometry: d,
            material: f,
            groupOrder: p,
            renderOrder: h.renderOrder,
            z: v,
            group: w,
          }),
          (n[e] = g))
        : ((g.id = h.id),
          (g.object = h),
          (g.geometry = d),
          (g.material = f),
          (g.groupOrder = p),
          (g.renderOrder = h.renderOrder),
          (g.z = v),
          (g.group = w)),
      e++,
      g
    );
  }
  function a(h, d, f, p, v, w) {
    const g = o(h, d, f, p, v, w);
    f.transmission > 0
      ? i.push(g)
      : f.transparent === !0
        ? r.push(g)
        : t.push(g);
  }
  function c(h, d, f, p, v, w) {
    const g = o(h, d, f, p, v, w);
    f.transmission > 0
      ? i.unshift(g)
      : f.transparent === !0
        ? r.unshift(g)
        : t.unshift(g);
  }
  function l(h, d) {
    (t.length > 1 && t.sort(h || iW),
      i.length > 1 && i.sort(d || WA),
      r.length > 1 && r.sort(d || WA));
  }
  function u() {
    for (let h = e, d = n.length; h < d; h++) {
      const f = n[h];
      if (f.id === null) break;
      ((f.id = null),
        (f.object = null),
        (f.geometry = null),
        (f.material = null),
        (f.group = null));
    }
  }
  return {
    opaque: t,
    transmissive: i,
    transparent: r,
    init: s,
    push: a,
    unshift: c,
    finish: u,
    sort: l,
  };
}
function rW() {
  let n = new WeakMap();
  function e(i, r) {
    const s = n.get(i);
    let o;
    return (
      s === void 0
        ? ((o = new HA()), n.set(i, [o]))
        : r >= s.length
          ? ((o = new HA()), s.push(o))
          : (o = s[r]),
      o
    );
  }
  function t() {
    n = new WeakMap();
  }
  return { get: e, dispose: t };
}
function sW() {
  const n = {};
  return {
    get: function (e) {
      if (n[e.id] !== void 0) return n[e.id];
      let t;
      switch (e.type) {
        case "DirectionalLight":
          t = { direction: new H(), color: new r9() };
          break;
        case "SpotLight":
          t = {
            position: new H(),
            direction: new H(),
            color: new r9(),
            distance: 0,
            coneCos: 0,
            penumbraCos: 0,
            decay: 0,
          };
          break;
        case "PointLight":
          t = { position: new H(), color: new r9(), distance: 0, decay: 0 };
          break;
        case "HemisphereLight":
          t = { direction: new H(), skyColor: new r9(), groundColor: new r9() };
          break;
        case "RectAreaLight":
          t = {
            color: new r9(),
            position: new H(),
            halfWidth: new H(),
            halfHeight: new H(),
          };
          break;
      }
      return ((n[e.id] = t), t);
    },
  };
}
function oW() {
  const n = {};
  return {
    get: function (e) {
      if (n[e.id] !== void 0) return n[e.id];
      let t;
      switch (e.type) {
        case "DirectionalLight":
          t = {
            shadowIntensity: 1,
            shadowBias: 0,
            shadowNormalBias: 0,
            shadowRadius: 1,
            shadowMapSize: new B2(),
          };
          break;
        case "SpotLight":
          t = {
            shadowIntensity: 1,
            shadowBias: 0,
            shadowNormalBias: 0,
            shadowRadius: 1,
            shadowMapSize: new B2(),
          };
          break;
        case "PointLight":
          t = {
            shadowIntensity: 1,
            shadowBias: 0,
            shadowNormalBias: 0,
            shadowRadius: 1,
            shadowMapSize: new B2(),
            shadowCameraNear: 1,
            shadowCameraFar: 1e3,
          };
          break;
      }
      return ((n[e.id] = t), t);
    },
  };
}
let aW = 0;
function cW(n, e) {
  return (
    (e.castShadow ? 2 : 0) -
    (n.castShadow ? 2 : 0) +
    (e.map ? 1 : 0) -
    (n.map ? 1 : 0)
  );
}
function lW(n) {
  const e = new sW(),
    t = oW(),
    i = {
      version: 0,
      hash: {
        directionalLength: -1,
        pointLength: -1,
        spotLength: -1,
        rectAreaLength: -1,
        hemiLength: -1,
        numDirectionalShadows: -1,
        numPointShadows: -1,
        numSpotShadows: -1,
        numSpotMaps: -1,
        numLightProbes: -1,
      },
      ambient: [0, 0, 0],
      probe: [],
      directional: [],
      directionalShadow: [],
      directionalShadowMap: [],
      directionalShadowMatrix: [],
      spot: [],
      spotLightMap: [],
      spotShadow: [],
      spotShadowMap: [],
      spotLightMatrix: [],
      rectArea: [],
      rectAreaLTC1: null,
      rectAreaLTC2: null,
      point: [],
      pointShadow: [],
      pointShadowMap: [],
      pointShadowMatrix: [],
      hemi: [],
      numSpotLightShadowsWithMaps: 0,
      numLightProbes: 0,
    };
  for (let l = 0; l < 9; l++) i.probe.push(new H());
  const r = new H(),
    s = new v2(),
    o = new v2();
  function a(l) {
    let u = 0,
      h = 0,
      d = 0;
    for (let C = 0; C < 9; C++) i.probe[C].set(0, 0, 0);
    let f = 0,
      p = 0,
      v = 0,
      w = 0,
      g = 0,
      y = 0,
      b = 0,
      A = 0,
      x = 0,
      M = 0,
      E = 0;
    l.sort(cW);
    for (let C = 0, S = l.length; C < S; C++) {
      const G = l[C],
        I = G.color,
        L = G.intensity,
        k = G.distance,
        D = G.shadow && G.shadow.map ? G.shadow.map.texture : null;
      if (G.isAmbientLight) ((u += I.r * L), (h += I.g * L), (d += I.b * L));
      else if (G.isLightProbe) {
        for (let V = 0; V < 9; V++)
          i.probe[V].addScaledVector(G.sh.coefficients[V], L);
        E++;
      } else if (G.isDirectionalLight) {
        const V = e.get(G);
        if ((V.color.copy(G.color).multiplyScalar(G.intensity), G.castShadow)) {
          const K = G.shadow,
            P = t.get(G);
          ((P.shadowIntensity = K.intensity),
            (P.shadowBias = K.bias),
            (P.shadowNormalBias = K.normalBias),
            (P.shadowRadius = K.radius),
            (P.shadowMapSize = K.mapSize),
            (i.directionalShadow[f] = P),
            (i.directionalShadowMap[f] = D),
            (i.directionalShadowMatrix[f] = G.shadow.matrix),
            y++);
        }
        ((i.directional[f] = V), f++);
      } else if (G.isSpotLight) {
        const V = e.get(G);
        (V.position.setFromMatrixPosition(G.matrixWorld),
          V.color.copy(I).multiplyScalar(L),
          (V.distance = k),
          (V.coneCos = Math.cos(G.angle)),
          (V.penumbraCos = Math.cos(G.angle * (1 - G.penumbra))),
          (V.decay = G.decay),
          (i.spot[v] = V));
        const K = G.shadow;
        if (
          (G.map &&
            ((i.spotLightMap[x] = G.map),
            x++,
            K.updateMatrices(G),
            G.castShadow && M++),
          (i.spotLightMatrix[v] = K.matrix),
          G.castShadow)
        ) {
          const P = t.get(G);
          ((P.shadowIntensity = K.intensity),
            (P.shadowBias = K.bias),
            (P.shadowNormalBias = K.normalBias),
            (P.shadowRadius = K.radius),
            (P.shadowMapSize = K.mapSize),
            (i.spotShadow[v] = P),
            (i.spotShadowMap[v] = D),
            A++);
        }
        v++;
      } else if (G.isRectAreaLight) {
        const V = e.get(G);
        (V.color.copy(I).multiplyScalar(L),
          V.halfWidth.set(G.width * 0.5, 0, 0),
          V.halfHeight.set(0, G.height * 0.5, 0),
          (i.rectArea[w] = V),
          w++);
      } else if (G.isPointLight) {
        const V = e.get(G);
        if (
          (V.color.copy(G.color).multiplyScalar(G.intensity),
          (V.distance = G.distance),
          (V.decay = G.decay),
          G.castShadow)
        ) {
          const K = G.shadow,
            P = t.get(G);
          ((P.shadowIntensity = K.intensity),
            (P.shadowBias = K.bias),
            (P.shadowNormalBias = K.normalBias),
            (P.shadowRadius = K.radius),
            (P.shadowMapSize = K.mapSize),
            (P.shadowCameraNear = K.camera.near),
            (P.shadowCameraFar = K.camera.far),
            (i.pointShadow[p] = P),
            (i.pointShadowMap[p] = D),
            (i.pointShadowMatrix[p] = G.shadow.matrix),
            b++);
        }
        ((i.point[p] = V), p++);
      } else if (G.isHemisphereLight) {
        const V = e.get(G);
        (V.skyColor.copy(G.color).multiplyScalar(L),
          V.groundColor.copy(G.groundColor).multiplyScalar(L),
          (i.hemi[g] = V),
          g++);
      }
    }
    (w > 0 &&
      (n.has("OES_texture_float_linear") === !0
        ? ((i.rectAreaLTC1 = K0.LTC_FLOAT_1), (i.rectAreaLTC2 = K0.LTC_FLOAT_2))
        : ((i.rectAreaLTC1 = K0.LTC_HALF_1), (i.rectAreaLTC2 = K0.LTC_HALF_2))),
      (i.ambient[0] = u),
      (i.ambient[1] = h),
      (i.ambient[2] = d));
    const _ = i.hash;
    (_.directionalLength !== f ||
      _.pointLength !== p ||
      _.spotLength !== v ||
      _.rectAreaLength !== w ||
      _.hemiLength !== g ||
      _.numDirectionalShadows !== y ||
      _.numPointShadows !== b ||
      _.numSpotShadows !== A ||
      _.numSpotMaps !== x ||
      _.numLightProbes !== E) &&
      ((i.directional.length = f),
      (i.spot.length = v),
      (i.rectArea.length = w),
      (i.point.length = p),
      (i.hemi.length = g),
      (i.directionalShadow.length = y),
      (i.directionalShadowMap.length = y),
      (i.pointShadow.length = b),
      (i.pointShadowMap.length = b),
      (i.spotShadow.length = A),
      (i.spotShadowMap.length = A),
      (i.directionalShadowMatrix.length = y),
      (i.pointShadowMatrix.length = b),
      (i.spotLightMatrix.length = A + x - M),
      (i.spotLightMap.length = x),
      (i.numSpotLightShadowsWithMaps = M),
      (i.numLightProbes = E),
      (_.directionalLength = f),
      (_.pointLength = p),
      (_.spotLength = v),
      (_.rectAreaLength = w),
      (_.hemiLength = g),
      (_.numDirectionalShadows = y),
      (_.numPointShadows = b),
      (_.numSpotShadows = A),
      (_.numSpotMaps = x),
      (_.numLightProbes = E),
      (i.version = aW++));
  }
  function c(l, u) {
    let h = 0,
      d = 0,
      f = 0,
      p = 0,
      v = 0;
    const w = u.matrixWorldInverse;
    for (let g = 0, y = l.length; g < y; g++) {
      const b = l[g];
      if (b.isDirectionalLight) {
        const A = i.directional[h];
        (A.direction.setFromMatrixPosition(b.matrixWorld),
          r.setFromMatrixPosition(b.target.matrixWorld),
          A.direction.sub(r),
          A.direction.transformDirection(w),
          h++);
      } else if (b.isSpotLight) {
        const A = i.spot[f];
        (A.position.setFromMatrixPosition(b.matrixWorld),
          A.position.applyMatrix4(w),
          A.direction.setFromMatrixPosition(b.matrixWorld),
          r.setFromMatrixPosition(b.target.matrixWorld),
          A.direction.sub(r),
          A.direction.transformDirection(w),
          f++);
      } else if (b.isRectAreaLight) {
        const A = i.rectArea[p];
        (A.position.setFromMatrixPosition(b.matrixWorld),
          A.position.applyMatrix4(w),
          o.identity(),
          s.copy(b.matrixWorld),
          s.premultiply(w),
          o.extractRotation(s),
          A.halfWidth.set(b.width * 0.5, 0, 0),
          A.halfHeight.set(0, b.height * 0.5, 0),
          A.halfWidth.applyMatrix4(o),
          A.halfHeight.applyMatrix4(o),
          p++);
      } else if (b.isPointLight) {
        const A = i.point[d];
        (A.position.setFromMatrixPosition(b.matrixWorld),
          A.position.applyMatrix4(w),
          d++);
      } else if (b.isHemisphereLight) {
        const A = i.hemi[v];
        (A.direction.setFromMatrixPosition(b.matrixWorld),
          A.direction.transformDirection(w),
          v++);
      }
    }
  }
  return { setup: a, setupView: c, state: i };
}
function qA(n) {
  const e = new lW(n),
    t = [],
    i = [];
  function r(u) {
    ((l.camera = u), (t.length = 0), (i.length = 0));
  }
  function s(u) {
    t.push(u);
  }
  function o(u) {
    i.push(u);
  }
  function a() {
    e.setup(t);
  }
  function c(u) {
    e.setupView(t, u);
  }
  const l = {
    lightsArray: t,
    shadowsArray: i,
    camera: null,
    lights: e,
    transmissionRenderTarget: {},
  };
  return {
    init: r,
    state: l,
    setupLights: a,
    setupLightsView: c,
    pushLight: s,
    pushShadow: o,
  };
}
function uW(n) {
  let e = new WeakMap();
  function t(r, s = 0) {
    const o = e.get(r);
    let a;
    return (
      o === void 0
        ? ((a = new qA(n)), e.set(r, [a]))
        : s >= o.length
          ? ((a = new qA(n)), o.push(a))
          : (a = o[s]),
      a
    );
  }
  function i() {
    e = new WeakMap();
  }
  return { get: t, dispose: i };
}
const hW = `void main() {
	gl_Position = vec4( position, 1.0 );
}`,
  dW = `uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
#include <packing>
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = unpackRGBATo2Half( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ) );
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = unpackRGBAToDepth( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ) );
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( squared_mean - mean * mean );
	gl_FragColor = pack2HalfToRGBA( vec2( mean, std_dev ) );
}`;
function fW(n, e, t) {
  let i = new BG();
  const r = new B2(),
    s = new B2(),
    o = new Y2(),
    a = new kN({ depthPacking: TV }),
    c = new LN(),
    l = {},
    u = t.maxTextureSize,
    h = { [tn]: me, [me]: tn, [s1]: s1 },
    d = new $1({
      defines: { VSM_SAMPLES: 8 },
      uniforms: {
        shadow_pass: { value: null },
        resolution: { value: new B2() },
        radius: { value: 4 },
      },
      vertexShader: hW,
      fragmentShader: dW,
    }),
    f = d.clone();
  f.defines.HORIZONTAL_PASS = 1;
  const p = new t9();
  p.setAttribute(
    "position",
    new _0(new Float32Array([-1, -1, 0.5, 3, -1, 0.5, -1, 3, 0.5]), 3),
  );
  const v = new D2(p, d),
    w = this;
  ((this.enabled = !1),
    (this.autoUpdate = !0),
    (this.needsUpdate = !1),
    (this.type = oG));
  let g = this.type;
  this.render = function (M, E, _) {
    if (
      w.enabled === !1 ||
      (w.autoUpdate === !1 && w.needsUpdate === !1) ||
      M.length === 0
    )
      return;
    const C = n.getRenderTarget(),
      S = n.getActiveCubeFace(),
      G = n.getActiveMipmapLevel(),
      I = n.state;
    (I.setBlending(n5),
      I.buffers.color.setClear(1, 1, 1, 1),
      I.buffers.depth.setTest(!0),
      I.setScissorTest(!1));
    const L = g !== B5 && this.type === B5,
      k = g === B5 && this.type !== B5;
    for (let D = 0, V = M.length; D < V; D++) {
      const K = M[D],
        P = K.shadow;
      if (P === void 0) {
        console.warn("THREE.WebGLShadowMap:", K, "has no shadow.");
        continue;
      }
      if (P.autoUpdate === !1 && P.needsUpdate === !1) continue;
      r.copy(P.mapSize);
      const q = P.getFrameExtents();
      if (
        (r.multiply(q),
        s.copy(P.mapSize),
        (r.x > u || r.y > u) &&
          (r.x > u &&
            ((s.x = Math.floor(u / q.x)),
            (r.x = s.x * q.x),
            (P.mapSize.x = s.x)),
          r.y > u &&
            ((s.y = Math.floor(u / q.y)),
            (r.y = s.y * q.y),
            (P.mapSize.y = s.y))),
        P.map === null || L === !0 || k === !0)
      ) {
        const Q = this.type !== B5 ? { minFilter: h9, magFilter: h9 } : {};
        (P.map !== null && P.map.dispose(),
          (P.map = new nn(r.x, r.y, Q)),
          (P.map.texture.name = K.name + ".shadowMap"),
          P.camera.updateProjectionMatrix());
      }
      (n.setRenderTarget(P.map), n.clear());
      const e0 = P.getViewportCount();
      for (let Q = 0; Q < e0; Q++) {
        const U = P.getViewport(Q);
        (o.set(s.x * U.x, s.y * U.y, s.x * U.z, s.y * U.w),
          I.viewport(o),
          P.updateMatrices(K, Q),
          (i = P.getFrustum()),
          A(E, _, P.camera, K, this.type));
      }
      (P.isPointLightShadow !== !0 && this.type === B5 && y(P, _),
        (P.needsUpdate = !1));
    }
    ((g = this.type), (w.needsUpdate = !1), n.setRenderTarget(C, S, G));
  };
  function y(M, E) {
    const _ = e.update(v);
    (d.defines.VSM_SAMPLES !== M.blurSamples &&
      ((d.defines.VSM_SAMPLES = M.blurSamples),
      (f.defines.VSM_SAMPLES = M.blurSamples),
      (d.needsUpdate = !0),
      (f.needsUpdate = !0)),
      M.mapPass === null && (M.mapPass = new nn(r.x, r.y)),
      (d.uniforms.shadow_pass.value = M.map.texture),
      (d.uniforms.resolution.value = M.mapSize),
      (d.uniforms.radius.value = M.radius),
      n.setRenderTarget(M.mapPass),
      n.clear(),
      n.renderBufferDirect(E, null, _, d, v, null),
      (f.uniforms.shadow_pass.value = M.mapPass.texture),
      (f.uniforms.resolution.value = M.mapSize),
      (f.uniforms.radius.value = M.radius),
      n.setRenderTarget(M.map),
      n.clear(),
      n.renderBufferDirect(E, null, _, f, v, null));
  }
  function b(M, E, _, C) {
    let S = null;
    const G =
      _.isPointLight === !0 ? M.customDistanceMaterial : M.customDepthMaterial;
    if (G !== void 0) S = G;
    else if (
      ((S = _.isPointLight === !0 ? c : a),
      (n.localClippingEnabled &&
        E.clipShadows === !0 &&
        Array.isArray(E.clippingPlanes) &&
        E.clippingPlanes.length !== 0) ||
        (E.displacementMap && E.displacementScale !== 0) ||
        (E.alphaMap && E.alphaTest > 0) ||
        (E.map && E.alphaTest > 0) ||
        E.alphaToCoverage === !0)
    ) {
      const I = S.uuid,
        L = E.uuid;
      let k = l[I];
      k === void 0 && ((k = {}), (l[I] = k));
      let D = k[L];
      (D === void 0 &&
        ((D = S.clone()), (k[L] = D), E.addEventListener("dispose", x)),
        (S = D));
    }
    if (
      ((S.visible = E.visible),
      (S.wireframe = E.wireframe),
      C === B5
        ? (S.side = E.shadowSide !== null ? E.shadowSide : E.side)
        : (S.side = E.shadowSide !== null ? E.shadowSide : h[E.side]),
      (S.alphaMap = E.alphaMap),
      (S.alphaTest = E.alphaToCoverage === !0 ? 0.5 : E.alphaTest),
      (S.map = E.map),
      (S.clipShadows = E.clipShadows),
      (S.clippingPlanes = E.clippingPlanes),
      (S.clipIntersection = E.clipIntersection),
      (S.displacementMap = E.displacementMap),
      (S.displacementScale = E.displacementScale),
      (S.displacementBias = E.displacementBias),
      (S.wireframeLinewidth = E.wireframeLinewidth),
      (S.linewidth = E.linewidth),
      _.isPointLight === !0 && S.isMeshDistanceMaterial === !0)
    ) {
      const I = n.properties.get(S);
      I.light = _;
    }
    return S;
  }
  function A(M, E, _, C, S) {
    if (M.visible === !1) return;
    if (
      M.layers.test(E.layers) &&
      (M.isMesh || M.isLine || M.isPoints) &&
      (M.castShadow || (M.receiveShadow && S === B5)) &&
      (!M.frustumCulled || i.intersectsObject(M))
    ) {
      M.modelViewMatrix.multiplyMatrices(_.matrixWorldInverse, M.matrixWorld);
      const L = e.update(M),
        k = M.material;
      if (Array.isArray(k)) {
        const D = L.groups;
        for (let V = 0, K = D.length; V < K; V++) {
          const P = D[V],
            q = k[P.materialIndex];
          if (q && q.visible) {
            const e0 = b(M, q, C, S);
            (M.onBeforeShadow(n, M, E, _, L, e0, P),
              n.renderBufferDirect(_, null, L, e0, M, P),
              M.onAfterShadow(n, M, E, _, L, e0, P));
          }
        }
      } else if (k.visible) {
        const D = b(M, k, C, S);
        (M.onBeforeShadow(n, M, E, _, L, D, null),
          n.renderBufferDirect(_, null, L, D, M, null),
          M.onAfterShadow(n, M, E, _, L, D, null));
      }
    }
    const I = M.children;
    for (let L = 0, k = I.length; L < k; L++) A(I[L], E, _, C, S);
  }
  function x(M) {
    M.target.removeEventListener("dispose", x);
    for (const _ in l) {
      const C = l[_],
        S = M.target.uuid;
      S in C && (C[S].dispose(), delete C[S]);
    }
  }
}
const pW = {
  [ro]: ir,
  [so]: ao,
  [oo]: co,
  [y1]: rr,
  [ir]: ro,
  [ao]: so,
  [co]: oo,
  [rr]: y1,
};
function gW(n, e) {
  function t() {
    let Z = !1;
    const N0 = new Y2();
    let b0 = null;
    const $0 = new Y2(0, 0, 0, 0);
    return {
      setMask: function (M0) {
        b0 !== M0 && !Z && (n.colorMask(M0, M0, M0, M0), (b0 = M0));
      },
      setLocked: function (M0) {
        Z = M0;
      },
      setClear: function (M0, g0, a2, U2, $9) {
        ($9 === !0 && ((M0 *= U2), (g0 *= U2), (a2 *= U2)),
          N0.set(M0, g0, a2, U2),
          $0.equals(N0) === !1 && (n.clearColor(M0, g0, a2, U2), $0.copy(N0)));
      },
      reset: function () {
        ((Z = !1), (b0 = null), $0.set(-1, 0, 0, 0));
      },
    };
  }
  function i() {
    let Z = !1,
      N0 = !1,
      b0 = null,
      $0 = null,
      M0 = null;
    return {
      setReversed: function (g0) {
        if (N0 !== g0) {
          const a2 = e.get("EXT_clip_control");
          (g0
            ? a2.clipControlEXT(a2.LOWER_LEFT_EXT, a2.ZERO_TO_ONE_EXT)
            : a2.clipControlEXT(a2.LOWER_LEFT_EXT, a2.NEGATIVE_ONE_TO_ONE_EXT),
            (N0 = g0));
          const U2 = M0;
          ((M0 = null), this.setClear(U2));
        }
      },
      getReversed: function () {
        return N0;
      },
      setTest: function (g0) {
        g0 ? X(n.DEPTH_TEST) : l0(n.DEPTH_TEST);
      },
      setMask: function (g0) {
        b0 !== g0 && !Z && (n.depthMask(g0), (b0 = g0));
      },
      setFunc: function (g0) {
        if ((N0 && (g0 = pW[g0]), $0 !== g0)) {
          switch (g0) {
            case ro:
              n.depthFunc(n.NEVER);
              break;
            case ir:
              n.depthFunc(n.ALWAYS);
              break;
            case so:
              n.depthFunc(n.LESS);
              break;
            case y1:
              n.depthFunc(n.LEQUAL);
              break;
            case oo:
              n.depthFunc(n.EQUAL);
              break;
            case rr:
              n.depthFunc(n.GEQUAL);
              break;
            case ao:
              n.depthFunc(n.GREATER);
              break;
            case co:
              n.depthFunc(n.NOTEQUAL);
              break;
            default:
              n.depthFunc(n.LEQUAL);
          }
          $0 = g0;
        }
      },
      setLocked: function (g0) {
        Z = g0;
      },
      setClear: function (g0) {
        M0 !== g0 && (N0 && (g0 = 1 - g0), n.clearDepth(g0), (M0 = g0));
      },
      reset: function () {
        ((Z = !1), (b0 = null), ($0 = null), (M0 = null), (N0 = !1));
      },
    };
  }
  function r() {
    let Z = !1,
      N0 = null,
      b0 = null,
      $0 = null,
      M0 = null,
      g0 = null,
      a2 = null,
      U2 = null,
      $9 = null;
    return {
      setTest: function (A9) {
        Z || (A9 ? X(n.STENCIL_TEST) : l0(n.STENCIL_TEST));
      },
      setMask: function (A9) {
        N0 !== A9 && !Z && (n.stencilMask(A9), (N0 = A9));
      },
      setFunc: function (A9, ft, g5) {
        (b0 !== A9 || $0 !== ft || M0 !== g5) &&
          (n.stencilFunc(A9, ft, g5), (b0 = A9), ($0 = ft), (M0 = g5));
      },
      setOp: function (A9, ft, g5) {
        (g0 !== A9 || a2 !== ft || U2 !== g5) &&
          (n.stencilOp(A9, ft, g5), (g0 = A9), (a2 = ft), (U2 = g5));
      },
      setLocked: function (A9) {
        Z = A9;
      },
      setClear: function (A9) {
        $9 !== A9 && (n.clearStencil(A9), ($9 = A9));
      },
      reset: function () {
        ((Z = !1),
          (N0 = null),
          (b0 = null),
          ($0 = null),
          (M0 = null),
          (g0 = null),
          (a2 = null),
          (U2 = null),
          ($9 = null));
      },
    };
  }
  const s = new t(),
    o = new i(),
    a = new r(),
    c = new WeakMap(),
    l = new WeakMap();
  let u = {},
    h = {},
    d = new WeakMap(),
    f = [],
    p = null,
    v = !1,
    w = null,
    g = null,
    y = null,
    b = null,
    A = null,
    x = null,
    M = null,
    E = new r9(0, 0, 0),
    _ = 0,
    C = !1,
    S = null,
    G = null,
    I = null,
    L = null,
    k = null;
  const D = n.getParameter(n.MAX_COMBINED_TEXTURE_IMAGE_UNITS);
  let V = !1,
    K = 0;
  const P = n.getParameter(n.VERSION);
  P.indexOf("WebGL") !== -1
    ? ((K = parseFloat(/^WebGL (\d)/.exec(P)[1])), (V = K >= 1))
    : P.indexOf("OpenGL ES") !== -1 &&
      ((K = parseFloat(/^OpenGL ES (\d)/.exec(P)[1])), (V = K >= 2));
  let q = null,
    e0 = {};
  const Q = n.getParameter(n.SCISSOR_BOX),
    U = n.getParameter(n.VIEWPORT),
    O = new Y2().fromArray(Q),
    F = new Y2().fromArray(U);
  function z(Z, N0, b0, $0) {
    const M0 = new Uint8Array(4),
      g0 = n.createTexture();
    (n.bindTexture(Z, g0),
      n.texParameteri(Z, n.TEXTURE_MIN_FILTER, n.NEAREST),
      n.texParameteri(Z, n.TEXTURE_MAG_FILTER, n.NEAREST));
    for (let a2 = 0; a2 < b0; a2++)
      Z === n.TEXTURE_3D || Z === n.TEXTURE_2D_ARRAY
        ? n.texImage3D(N0, 0, n.RGBA, 1, 1, $0, 0, n.RGBA, n.UNSIGNED_BYTE, M0)
        : n.texImage2D(
            N0 + a2,
            0,
            n.RGBA,
            1,
            1,
            0,
            n.RGBA,
            n.UNSIGNED_BYTE,
            M0,
          );
    return g0;
  }
  const Y = {};
  ((Y[n.TEXTURE_2D] = z(n.TEXTURE_2D, n.TEXTURE_2D, 1)),
    (Y[n.TEXTURE_CUBE_MAP] = z(
      n.TEXTURE_CUBE_MAP,
      n.TEXTURE_CUBE_MAP_POSITIVE_X,
      6,
    )),
    (Y[n.TEXTURE_2D_ARRAY] = z(n.TEXTURE_2D_ARRAY, n.TEXTURE_2D_ARRAY, 1, 1)),
    (Y[n.TEXTURE_3D] = z(n.TEXTURE_3D, n.TEXTURE_3D, 1, 1)),
    s.setClear(0, 0, 0, 1),
    o.setClear(1),
    a.setClear(0),
    X(n.DEPTH_TEST),
    o.setFunc(y1),
    I0(!1),
    o2(Xy),
    X(n.CULL_FACE),
    W(n5));
  function X(Z) {
    u[Z] !== !0 && (n.enable(Z), (u[Z] = !0));
  }
  function l0(Z) {
    u[Z] !== !1 && (n.disable(Z), (u[Z] = !1));
  }
  function r0(Z, N0) {
    return h[Z] !== N0
      ? (n.bindFramebuffer(Z, N0),
        (h[Z] = N0),
        Z === n.DRAW_FRAMEBUFFER && (h[n.FRAMEBUFFER] = N0),
        Z === n.FRAMEBUFFER && (h[n.DRAW_FRAMEBUFFER] = N0),
        !0)
      : !1;
  }
  function j(Z, N0) {
    let b0 = f,
      $0 = !1;
    if (Z) {
      ((b0 = d.get(N0)), b0 === void 0 && ((b0 = []), d.set(N0, b0)));
      const M0 = Z.textures;
      if (b0.length !== M0.length || b0[0] !== n.COLOR_ATTACHMENT0) {
        for (let g0 = 0, a2 = M0.length; g0 < a2; g0++)
          b0[g0] = n.COLOR_ATTACHMENT0 + g0;
        ((b0.length = M0.length), ($0 = !0));
      }
    } else b0[0] !== n.BACK && ((b0[0] = n.BACK), ($0 = !0));
    $0 && n.drawBuffers(b0);
  }
  function F0(Z) {
    return p !== Z ? (n.useProgram(Z), (p = Z), !0) : !1;
  }
  const O0 = {
    [R9]: n.FUNC_ADD,
    [lV]: n.FUNC_SUBTRACT,
    [uV]: n.FUNC_REVERSE_SUBTRACT,
  };
  ((O0[hV] = n.MIN), (O0[dV] = n.MAX));
  const z0 = {
    [ym]: n.ZERO,
    [h3]: n.ONE,
    [ra]: n.SRC_COLOR,
    [l1]: n.SRC_ALPHA,
    [Cm]: n.SRC_ALPHA_SATURATE,
    [xm]: n.DST_COLOR,
    [bm]: n.DST_ALPHA,
    [Am]: n.ONE_MINUS_SRC_COLOR,
    [v1]: n.ONE_MINUS_SRC_ALPHA,
    [Sm]: n.ONE_MINUS_DST_COLOR,
    [Mm]: n.ONE_MINUS_DST_ALPHA,
    [fV]: n.CONSTANT_COLOR,
    [pV]: n.ONE_MINUS_CONSTANT_COLOR,
    [gV]: n.CONSTANT_ALPHA,
    [mV]: n.ONE_MINUS_CONSTANT_ALPHA,
  };
  function W(Z, N0, b0, $0, M0, g0, a2, U2, $9, A9) {
    if (Z === n5) {
      v === !0 && (l0(n.BLEND), (v = !1));
      return;
    }
    if ((v === !1 && (X(n.BLEND), (v = !0)), Z !== u1)) {
      if (Z !== w || A9 !== C) {
        if (
          ((g !== R9 || A !== R9) &&
            (n.blendEquation(n.FUNC_ADD), (g = R9), (A = R9)),
          A9)
        )
          switch (Z) {
            case X5:
              n.blendFuncSeparate(
                n.ONE,
                n.ONE_MINUS_SRC_ALPHA,
                n.ONE,
                n.ONE_MINUS_SRC_ALPHA,
              );
              break;
            case Yy:
              n.blendFunc(n.ONE, n.ONE);
              break;
            case Zy:
              n.blendFuncSeparate(n.ZERO, n.ONE_MINUS_SRC_COLOR, n.ZERO, n.ONE);
              break;
            case Qy:
              n.blendFuncSeparate(
                n.DST_COLOR,
                n.ONE_MINUS_SRC_ALPHA,
                n.ZERO,
                n.ONE,
              );
              break;
            default:
              console.error("THREE.WebGLState: Invalid blending: ", Z);
              break;
          }
        else
          switch (Z) {
            case X5:
              n.blendFuncSeparate(
                n.SRC_ALPHA,
                n.ONE_MINUS_SRC_ALPHA,
                n.ONE,
                n.ONE_MINUS_SRC_ALPHA,
              );
              break;
            case Yy:
              n.blendFuncSeparate(n.SRC_ALPHA, n.ONE, n.ONE, n.ONE);
              break;
            case Zy:
              console.error(
                "THREE.WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true",
              );
              break;
            case Qy:
              console.error(
                "THREE.WebGLState: MultiplyBlending requires material.premultipliedAlpha = true",
              );
              break;
            default:
              console.error("THREE.WebGLState: Invalid blending: ", Z);
              break;
          }
        ((y = null),
          (b = null),
          (x = null),
          (M = null),
          E.set(0, 0, 0),
          (_ = 0),
          (w = Z),
          (C = A9));
      }
      return;
    }
    ((M0 = M0 || N0),
      (g0 = g0 || b0),
      (a2 = a2 || $0),
      (N0 !== g || M0 !== A) &&
        (n.blendEquationSeparate(O0[N0], O0[M0]), (g = N0), (A = M0)),
      (b0 !== y || $0 !== b || g0 !== x || a2 !== M) &&
        (n.blendFuncSeparate(z0[b0], z0[$0], z0[g0], z0[a2]),
        (y = b0),
        (b = $0),
        (x = g0),
        (M = a2)),
      (U2.equals(E) === !1 || $9 !== _) &&
        (n.blendColor(U2.r, U2.g, U2.b, $9), E.copy(U2), (_ = $9)),
      (w = Z),
      (C = !1));
  }
  function R2(Z, N0) {
    Z.side === s1 ? l0(n.CULL_FACE) : X(n.CULL_FACE);
    let b0 = Z.side === me;
    (N0 && (b0 = !b0),
      I0(b0),
      Z.blending === X5 && Z.transparent === !1
        ? W(n5)
        : W(
            Z.blending,
            Z.blendEquation,
            Z.blendSrc,
            Z.blendDst,
            Z.blendEquationAlpha,
            Z.blendSrcAlpha,
            Z.blendDstAlpha,
            Z.blendColor,
            Z.blendAlpha,
            Z.premultipliedAlpha,
          ),
      o.setFunc(Z.depthFunc),
      o.setTest(Z.depthTest),
      o.setMask(Z.depthWrite),
      s.setMask(Z.colorWrite));
    const $0 = Z.stencilWrite;
    (a.setTest($0),
      $0 &&
        (a.setMask(Z.stencilWriteMask),
        a.setFunc(Z.stencilFunc, Z.stencilRef, Z.stencilFuncMask),
        a.setOp(Z.stencilFail, Z.stencilZFail, Z.stencilZPass)),
      D0(Z.polygonOffset, Z.polygonOffsetFactor, Z.polygonOffsetUnits),
      Z.alphaToCoverage === !0
        ? X(n.SAMPLE_ALPHA_TO_COVERAGE)
        : l0(n.SAMPLE_ALPHA_TO_COVERAGE));
  }
  function I0(Z) {
    S !== Z && (Z ? n.frontFace(n.CW) : n.frontFace(n.CCW), (S = Z));
  }
  function o2(Z) {
    (Z !== oV
      ? (X(n.CULL_FACE),
        Z !== G &&
          (Z === Xy
            ? n.cullFace(n.BACK)
            : Z === aV
              ? n.cullFace(n.FRONT)
              : n.cullFace(n.FRONT_AND_BACK)))
      : l0(n.CULL_FACE),
      (G = Z));
  }
  function G0(Z) {
    Z !== I && (V && n.lineWidth(Z), (I = Z));
  }
  function D0(Z, N0, b0) {
    Z
      ? (X(n.POLYGON_OFFSET_FILL),
        (L !== N0 || k !== b0) && (n.polygonOffset(N0, b0), (L = N0), (k = b0)))
      : l0(n.POLYGON_OFFSET_FILL);
  }
  function E0(Z) {
    Z ? X(n.SCISSOR_TEST) : l0(n.SCISSOR_TEST);
  }
  function f2(Z) {
    (Z === void 0 && (Z = n.TEXTURE0 + D - 1),
      q !== Z && (n.activeTexture(Z), (q = Z)));
  }
  function O2(Z, N0, b0) {
    b0 === void 0 && (q === null ? (b0 = n.TEXTURE0 + D - 1) : (b0 = q));
    let $0 = e0[b0];
    ($0 === void 0 && (($0 = { type: void 0, texture: void 0 }), (e0[b0] = $0)),
      ($0.type !== Z || $0.texture !== N0) &&
        (q !== b0 && (n.activeTexture(b0), (q = b0)),
        n.bindTexture(Z, N0 || Y[Z]),
        ($0.type = Z),
        ($0.texture = N0)));
  }
  function B() {
    const Z = e0[q];
    Z !== void 0 &&
      Z.type !== void 0 &&
      (n.bindTexture(Z.type, null), (Z.type = void 0), (Z.texture = void 0));
  }
  function R() {
    try {
      n.compressedTexImage2D(...arguments);
    } catch (Z) {
      console.error("THREE.WebGLState:", Z);
    }
  }
  function $() {
    try {
      n.compressedTexImage3D(...arguments);
    } catch (Z) {
      console.error("THREE.WebGLState:", Z);
    }
  }
  function o0() {
    try {
      n.texSubImage2D(...arguments);
    } catch (Z) {
      console.error("THREE.WebGLState:", Z);
    }
  }
  function u0() {
    try {
      n.texSubImage3D(...arguments);
    } catch (Z) {
      console.error("THREE.WebGLState:", Z);
    }
  }
  function c0() {
    try {
      n.compressedTexSubImage2D(...arguments);
    } catch (Z) {
      console.error("THREE.WebGLState:", Z);
    }
  }
  function x0() {
    try {
      n.compressedTexSubImage3D(...arguments);
    } catch (Z) {
      console.error("THREE.WebGLState:", Z);
    }
  }
  function C0() {
    try {
      n.texStorage2D(...arguments);
    } catch (Z) {
      console.error("THREE.WebGLState:", Z);
    }
  }
  function S0() {
    try {
      n.texStorage3D(...arguments);
    } catch (Z) {
      console.error("THREE.WebGLState:", Z);
    }
  }
  function U0() {
    try {
      n.texImage2D(...arguments);
    } catch (Z) {
      console.error("THREE.WebGLState:", Z);
    }
  }
  function m0() {
    try {
      n.texImage3D(...arguments);
    } catch (Z) {
      console.error("THREE.WebGLState:", Z);
    }
  }
  function q0(Z) {
    O.equals(Z) === !1 && (n.scissor(Z.x, Z.y, Z.z, Z.w), O.copy(Z));
  }
  function t2(Z) {
    F.equals(Z) === !1 && (n.viewport(Z.x, Z.y, Z.z, Z.w), F.copy(Z));
  }
  function Z0(Z, N0) {
    let b0 = l.get(N0);
    b0 === void 0 && ((b0 = new WeakMap()), l.set(N0, b0));
    let $0 = b0.get(Z);
    $0 === void 0 && (($0 = n.getUniformBlockIndex(N0, Z.name)), b0.set(Z, $0));
  }
  function B0(Z, N0) {
    const $0 = l.get(N0).get(Z);
    c.get(N0) !== $0 &&
      (n.uniformBlockBinding(N0, $0, Z.__bindingPointIndex), c.set(N0, $0));
  }
  function r2() {
    (n.disable(n.BLEND),
      n.disable(n.CULL_FACE),
      n.disable(n.DEPTH_TEST),
      n.disable(n.POLYGON_OFFSET_FILL),
      n.disable(n.SCISSOR_TEST),
      n.disable(n.STENCIL_TEST),
      n.disable(n.SAMPLE_ALPHA_TO_COVERAGE),
      n.blendEquation(n.FUNC_ADD),
      n.blendFunc(n.ONE, n.ZERO),
      n.blendFuncSeparate(n.ONE, n.ZERO, n.ONE, n.ZERO),
      n.blendColor(0, 0, 0, 0),
      n.colorMask(!0, !0, !0, !0),
      n.clearColor(0, 0, 0, 0),
      n.depthMask(!0),
      n.depthFunc(n.LESS),
      o.setReversed(!1),
      n.clearDepth(1),
      n.stencilMask(4294967295),
      n.stencilFunc(n.ALWAYS, 0, 4294967295),
      n.stencilOp(n.KEEP, n.KEEP, n.KEEP),
      n.clearStencil(0),
      n.cullFace(n.BACK),
      n.frontFace(n.CCW),
      n.polygonOffset(0, 0),
      n.activeTexture(n.TEXTURE0),
      n.bindFramebuffer(n.FRAMEBUFFER, null),
      n.bindFramebuffer(n.DRAW_FRAMEBUFFER, null),
      n.bindFramebuffer(n.READ_FRAMEBUFFER, null),
      n.useProgram(null),
      n.lineWidth(1),
      n.scissor(0, 0, n.canvas.width, n.canvas.height),
      n.viewport(0, 0, n.canvas.width, n.canvas.height),
      (u = {}),
      (q = null),
      (e0 = {}),
      (h = {}),
      (d = new WeakMap()),
      (f = []),
      (p = null),
      (v = !1),
      (w = null),
      (g = null),
      (y = null),
      (b = null),
      (A = null),
      (x = null),
      (M = null),
      (E = new r9(0, 0, 0)),
      (_ = 0),
      (C = !1),
      (S = null),
      (G = null),
      (I = null),
      (L = null),
      (k = null),
      O.set(0, 0, n.canvas.width, n.canvas.height),
      F.set(0, 0, n.canvas.width, n.canvas.height),
      s.reset(),
      o.reset(),
      a.reset());
  }
  return {
    buffers: { color: s, depth: o, stencil: a },
    enable: X,
    disable: l0,
    bindFramebuffer: r0,
    drawBuffers: j,
    useProgram: F0,
    setBlending: W,
    setMaterial: R2,
    setFlipSided: I0,
    setCullFace: o2,
    setLineWidth: G0,
    setPolygonOffset: D0,
    setScissorTest: E0,
    activeTexture: f2,
    bindTexture: O2,
    unbindTexture: B,
    compressedTexImage2D: R,
    compressedTexImage3D: $,
    texImage2D: U0,
    texImage3D: m0,
    updateUBOMapping: Z0,
    uniformBlockBinding: B0,
    texStorage2D: C0,
    texStorage3D: S0,
    texSubImage2D: o0,
    texSubImage3D: u0,
    compressedTexSubImage2D: c0,
    compressedTexSubImage3D: x0,
    scissor: q0,
    viewport: t2,
    reset: r2,
  };
}
function mW(n, e, t, i, r, s, o) {
  const a = e.has("WEBGL_multisampled_render_to_texture")
      ? e.get("WEBGL_multisampled_render_to_texture")
      : null,
    c =
      typeof navigator > "u" ? !1 : /OculusBrowser/g.test(navigator.userAgent),
    l = new B2(),
    u = new WeakMap();
  let h;
  const d = new WeakMap();
  let f = !1;
  try {
    f =
      typeof OffscreenCanvas < "u" &&
      new OffscreenCanvas(1, 1).getContext("2d") !== null;
  } catch {}
  function p(B, R) {
    return f ? new OffscreenCanvas(B, R) : go("canvas");
  }
  function v(B, R, $) {
    let o0 = 1;
    const u0 = O2(B);
    if (
      ((u0.width > $ || u0.height > $) &&
        (o0 = $ / Math.max(u0.width, u0.height)),
      o0 < 1)
    )
      if (
        (typeof HTMLImageElement < "u" && B instanceof HTMLImageElement) ||
        (typeof HTMLCanvasElement < "u" && B instanceof HTMLCanvasElement) ||
        (typeof ImageBitmap < "u" && B instanceof ImageBitmap) ||
        (typeof VideoFrame < "u" && B instanceof VideoFrame)
      ) {
        const c0 = Math.floor(o0 * u0.width),
          x0 = Math.floor(o0 * u0.height);
        h === void 0 && (h = p(c0, x0));
        const C0 = R ? p(c0, x0) : h;
        return (
          (C0.width = c0),
          (C0.height = x0),
          C0.getContext("2d").drawImage(B, 0, 0, c0, x0),
          console.warn(
            "THREE.WebGLRenderer: Texture has been resized from (" +
              u0.width +
              "x" +
              u0.height +
              ") to (" +
              c0 +
              "x" +
              x0 +
              ").",
          ),
          C0
        );
      } else
        return (
          "data" in B &&
            console.warn(
              "THREE.WebGLRenderer: Image in DataTexture is too big (" +
                u0.width +
                "x" +
                u0.height +
                ").",
            ),
          B
        );
    return B;
  }
  function w(B) {
    return B.generateMipmaps;
  }
  function g(B) {
    n.generateMipmap(B);
  }
  function y(B) {
    return B.isWebGLCubeRenderTarget
      ? n.TEXTURE_CUBE_MAP
      : B.isWebGL3DRenderTarget
        ? n.TEXTURE_3D
        : B.isWebGLArrayRenderTarget || B.isCompressedArrayTexture
          ? n.TEXTURE_2D_ARRAY
          : n.TEXTURE_2D;
  }
  function b(B, R, $, o0, u0 = !1) {
    if (B !== null) {
      if (n[B] !== void 0) return n[B];
      console.warn(
        "THREE.WebGLRenderer: Attempt to use non-existing WebGL internal format '" +
          B +
          "'",
      );
    }
    let c0 = R;
    if (
      (R === n.RED &&
        ($ === n.FLOAT && (c0 = n.R32F),
        $ === n.HALF_FLOAT && (c0 = n.R16F),
        $ === n.UNSIGNED_BYTE && (c0 = n.R8)),
      R === n.RED_INTEGER &&
        ($ === n.UNSIGNED_BYTE && (c0 = n.R8UI),
        $ === n.UNSIGNED_SHORT && (c0 = n.R16UI),
        $ === n.UNSIGNED_INT && (c0 = n.R32UI),
        $ === n.BYTE && (c0 = n.R8I),
        $ === n.SHORT && (c0 = n.R16I),
        $ === n.INT && (c0 = n.R32I)),
      R === n.RG &&
        ($ === n.FLOAT && (c0 = n.RG32F),
        $ === n.HALF_FLOAT && (c0 = n.RG16F),
        $ === n.UNSIGNED_BYTE && (c0 = n.RG8)),
      R === n.RG_INTEGER &&
        ($ === n.UNSIGNED_BYTE && (c0 = n.RG8UI),
        $ === n.UNSIGNED_SHORT && (c0 = n.RG16UI),
        $ === n.UNSIGNED_INT && (c0 = n.RG32UI),
        $ === n.BYTE && (c0 = n.RG8I),
        $ === n.SHORT && (c0 = n.RG16I),
        $ === n.INT && (c0 = n.RG32I)),
      R === n.RGB_INTEGER &&
        ($ === n.UNSIGNED_BYTE && (c0 = n.RGB8UI),
        $ === n.UNSIGNED_SHORT && (c0 = n.RGB16UI),
        $ === n.UNSIGNED_INT && (c0 = n.RGB32UI),
        $ === n.BYTE && (c0 = n.RGB8I),
        $ === n.SHORT && (c0 = n.RGB16I),
        $ === n.INT && (c0 = n.RGB32I)),
      R === n.RGBA_INTEGER &&
        ($ === n.UNSIGNED_BYTE && (c0 = n.RGBA8UI),
        $ === n.UNSIGNED_SHORT && (c0 = n.RGBA16UI),
        $ === n.UNSIGNED_INT && (c0 = n.RGBA32UI),
        $ === n.BYTE && (c0 = n.RGBA8I),
        $ === n.SHORT && (c0 = n.RGBA16I),
        $ === n.INT && (c0 = n.RGBA32I)),
      R === n.RGB && $ === n.UNSIGNED_INT_5_9_9_9_REV && (c0 = n.RGB9_E5),
      R === n.RGBA)
    ) {
      const x0 = u0 ? Rl : f9.getTransfer(o0);
      ($ === n.FLOAT && (c0 = n.RGBA32F),
        $ === n.HALF_FLOAT && (c0 = n.RGBA16F),
        $ === n.UNSIGNED_BYTE && (c0 = x0 === B9 ? n.SRGB8_ALPHA8 : n.RGBA8),
        $ === n.UNSIGNED_SHORT_4_4_4_4 && (c0 = n.RGBA4),
        $ === n.UNSIGNED_SHORT_5_5_5_1 && (c0 = n.RGB5_A1));
    }
    return (
      (c0 === n.R16F ||
        c0 === n.R32F ||
        c0 === n.RG16F ||
        c0 === n.RG32F ||
        c0 === n.RGBA16F ||
        c0 === n.RGBA32F) &&
        e.get("EXT_color_buffer_float"),
      c0
    );
  }
  function A(B, R) {
    let $;
    return (
      B
        ? R === null || R === A4 || R === uo
          ? ($ = n.DEPTH24_STENCIL8)
          : R === $5
            ? ($ = n.DEPTH32F_STENCIL8)
            : R === lo &&
              (($ = n.DEPTH24_STENCIL8),
              console.warn(
                "DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.",
              ))
        : R === null || R === A4 || R === uo
          ? ($ = n.DEPTH_COMPONENT24)
          : R === $5
            ? ($ = n.DEPTH_COMPONENT32F)
            : R === lo && ($ = n.DEPTH_COMPONENT16),
      $
    );
  }
  function x(B, R) {
    return w(B) === !0 ||
      (B.isFramebufferTexture && B.minFilter !== h9 && B.minFilter !== u9)
      ? Math.log2(Math.max(R.width, R.height)) + 1
      : B.mipmaps !== void 0 && B.mipmaps.length > 0
        ? B.mipmaps.length
        : B.isCompressedTexture && Array.isArray(B.image)
          ? R.mipmaps.length
          : 1;
  }
  function M(B) {
    const R = B.target;
    (R.removeEventListener("dispose", M),
      _(R),
      R.isVideoTexture && u.delete(R));
  }
  function E(B) {
    const R = B.target;
    (R.removeEventListener("dispose", E), S(R));
  }
  function _(B) {
    const R = i.get(B);
    if (R.__webglInit === void 0) return;
    const $ = B.source,
      o0 = d.get($);
    if (o0) {
      const u0 = o0[R.__cacheKey];
      (u0.usedTimes--,
        u0.usedTimes === 0 && C(B),
        Object.keys(o0).length === 0 && d.delete($));
    }
    i.remove(B);
  }
  function C(B) {
    const R = i.get(B);
    n.deleteTexture(R.__webglTexture);
    const $ = B.source,
      o0 = d.get($);
    (delete o0[R.__cacheKey], o.memory.textures--);
  }
  function S(B) {
    const R = i.get(B);
    if (
      (B.depthTexture && (B.depthTexture.dispose(), i.remove(B.depthTexture)),
      B.isWebGLCubeRenderTarget)
    )
      for (let o0 = 0; o0 < 6; o0++) {
        if (Array.isArray(R.__webglFramebuffer[o0]))
          for (let u0 = 0; u0 < R.__webglFramebuffer[o0].length; u0++)
            n.deleteFramebuffer(R.__webglFramebuffer[o0][u0]);
        else n.deleteFramebuffer(R.__webglFramebuffer[o0]);
        R.__webglDepthbuffer && n.deleteRenderbuffer(R.__webglDepthbuffer[o0]);
      }
    else {
      if (Array.isArray(R.__webglFramebuffer))
        for (let o0 = 0; o0 < R.__webglFramebuffer.length; o0++)
          n.deleteFramebuffer(R.__webglFramebuffer[o0]);
      else n.deleteFramebuffer(R.__webglFramebuffer);
      if (
        (R.__webglDepthbuffer && n.deleteRenderbuffer(R.__webglDepthbuffer),
        R.__webglMultisampledFramebuffer &&
          n.deleteFramebuffer(R.__webglMultisampledFramebuffer),
        R.__webglColorRenderbuffer)
      )
        for (let o0 = 0; o0 < R.__webglColorRenderbuffer.length; o0++)
          R.__webglColorRenderbuffer[o0] &&
            n.deleteRenderbuffer(R.__webglColorRenderbuffer[o0]);
      R.__webglDepthRenderbuffer &&
        n.deleteRenderbuffer(R.__webglDepthRenderbuffer);
    }
    const $ = B.textures;
    for (let o0 = 0, u0 = $.length; o0 < u0; o0++) {
      const c0 = i.get($[o0]);
      (c0.__webglTexture &&
        (n.deleteTexture(c0.__webglTexture), o.memory.textures--),
        i.remove($[o0]));
    }
    i.remove(B);
  }
  let G = 0;
  function I() {
    G = 0;
  }
  function L() {
    const B = G;
    return (
      B >= r.maxTextures &&
        console.warn(
          "THREE.WebGLTextures: Trying to use " +
            B +
            " texture units while this GPU supports only " +
            r.maxTextures,
        ),
      (G += 1),
      B
    );
  }
  function k(B) {
    const R = [];
    return (
      R.push(B.wrapS),
      R.push(B.wrapT),
      R.push(B.wrapR || 0),
      R.push(B.magFilter),
      R.push(B.minFilter),
      R.push(B.anisotropy),
      R.push(B.internalFormat),
      R.push(B.format),
      R.push(B.type),
      R.push(B.generateMipmaps),
      R.push(B.premultiplyAlpha),
      R.push(B.flipY),
      R.push(B.unpackAlignment),
      R.push(B.colorSpace),
      R.join()
    );
  }
  function D(B, R) {
    const $ = i.get(B);
    if (
      (B.isVideoTexture && E0(B),
      B.isRenderTargetTexture === !1 &&
        B.version > 0 &&
        $.__version !== B.version)
    ) {
      const o0 = B.image;
      if (o0 === null)
        console.warn(
          "THREE.WebGLRenderer: Texture marked for update but no image data found.",
        );
      else if (o0.complete === !1)
        console.warn(
          "THREE.WebGLRenderer: Texture marked for update but image is incomplete",
        );
      else {
        Y($, B, R);
        return;
      }
    }
    t.bindTexture(n.TEXTURE_2D, $.__webglTexture, n.TEXTURE0 + R);
  }
  function V(B, R) {
    const $ = i.get(B);
    if (B.version > 0 && $.__version !== B.version) {
      Y($, B, R);
      return;
    }
    t.bindTexture(n.TEXTURE_2D_ARRAY, $.__webglTexture, n.TEXTURE0 + R);
  }
  function K(B, R) {
    const $ = i.get(B);
    if (B.version > 0 && $.__version !== B.version) {
      Y($, B, R);
      return;
    }
    t.bindTexture(n.TEXTURE_3D, $.__webglTexture, n.TEXTURE0 + R);
  }
  function P(B, R) {
    const $ = i.get(B);
    if (B.version > 0 && $.__version !== B.version) {
      X($, B, R);
      return;
    }
    t.bindTexture(n.TEXTURE_CUBE_MAP, $.__webglTexture, n.TEXTURE0 + R);
  }
  const q = { [S1]: n.REPEAT, [F1]: n.CLAMP_TO_EDGE, [Tl]: n.MIRRORED_REPEAT },
    e0 = {
      [h9]: n.NEAREST,
      [lG]: n.NEAREST_MIPMAP_NEAREST,
      [ys]: n.NEAREST_MIPMAP_LINEAR,
      [u9]: n.LINEAR,
      [Nc]: n.LINEAR_MIPMAP_NEAREST,
      [e5]: n.LINEAR_MIPMAP_LINEAR,
    },
    Q = {
      [BV]: n.NEVER,
      [FV]: n.ALWAYS,
      [RV]: n.LESS,
      [vG]: n.LEQUAL,
      [IV]: n.EQUAL,
      [PV]: n.GEQUAL,
      [kV]: n.GREATER,
      [LV]: n.NOTEQUAL,
    };
  function U(B, R) {
    if (
      (R.type === $5 &&
        e.has("OES_texture_float_linear") === !1 &&
        (R.magFilter === u9 ||
          R.magFilter === Nc ||
          R.magFilter === ys ||
          R.magFilter === e5 ||
          R.minFilter === u9 ||
          R.minFilter === Nc ||
          R.minFilter === ys ||
          R.minFilter === e5) &&
        console.warn(
          "THREE.WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device.",
        ),
      n.texParameteri(B, n.TEXTURE_WRAP_S, q[R.wrapS]),
      n.texParameteri(B, n.TEXTURE_WRAP_T, q[R.wrapT]),
      (B === n.TEXTURE_3D || B === n.TEXTURE_2D_ARRAY) &&
        n.texParameteri(B, n.TEXTURE_WRAP_R, q[R.wrapR]),
      n.texParameteri(B, n.TEXTURE_MAG_FILTER, e0[R.magFilter]),
      n.texParameteri(B, n.TEXTURE_MIN_FILTER, e0[R.minFilter]),
      R.compareFunction &&
        (n.texParameteri(B, n.TEXTURE_COMPARE_MODE, n.COMPARE_REF_TO_TEXTURE),
        n.texParameteri(B, n.TEXTURE_COMPARE_FUNC, Q[R.compareFunction])),
      e.has("EXT_texture_filter_anisotropic") === !0)
    ) {
      if (
        R.magFilter === h9 ||
        (R.minFilter !== ys && R.minFilter !== e5) ||
        (R.type === $5 && e.has("OES_texture_float_linear") === !1)
      )
        return;
      if (R.anisotropy > 1 || i.get(R).__currentAnisotropy) {
        const $ = e.get("EXT_texture_filter_anisotropic");
        (n.texParameterf(
          B,
          $.TEXTURE_MAX_ANISOTROPY_EXT,
          Math.min(R.anisotropy, r.getMaxAnisotropy()),
        ),
          (i.get(R).__currentAnisotropy = R.anisotropy));
      }
    }
  }
  function O(B, R) {
    let $ = !1;
    B.__webglInit === void 0 &&
      ((B.__webglInit = !0), R.addEventListener("dispose", M));
    const o0 = R.source;
    let u0 = d.get(o0);
    u0 === void 0 && ((u0 = {}), d.set(o0, u0));
    const c0 = k(R);
    if (c0 !== B.__cacheKey) {
      (u0[c0] === void 0 &&
        ((u0[c0] = { texture: n.createTexture(), usedTimes: 0 }),
        o.memory.textures++,
        ($ = !0)),
        u0[c0].usedTimes++);
      const x0 = u0[B.__cacheKey];
      (x0 !== void 0 &&
        (u0[B.__cacheKey].usedTimes--, x0.usedTimes === 0 && C(R)),
        (B.__cacheKey = c0),
        (B.__webglTexture = u0[c0].texture));
    }
    return $;
  }
  function F(B, R, $) {
    return Math.floor(Math.floor(B / $) / R);
  }
  function z(B, R, $, o0) {
    const c0 = B.updateRanges;
    if (c0.length === 0)
      t.texSubImage2D(n.TEXTURE_2D, 0, 0, 0, R.width, R.height, $, o0, R.data);
    else {
      c0.sort((m0, q0) => m0.start - q0.start);
      let x0 = 0;
      for (let m0 = 1; m0 < c0.length; m0++) {
        const q0 = c0[x0],
          t2 = c0[m0],
          Z0 = q0.start + q0.count,
          B0 = F(t2.start, R.width, 4),
          r2 = F(q0.start, R.width, 4);
        t2.start <= Z0 + 1 &&
        B0 === r2 &&
        F(t2.start + t2.count - 1, R.width, 4) === B0
          ? (q0.count = Math.max(q0.count, t2.start + t2.count - q0.start))
          : (++x0, (c0[x0] = t2));
      }
      c0.length = x0 + 1;
      const C0 = n.getParameter(n.UNPACK_ROW_LENGTH),
        S0 = n.getParameter(n.UNPACK_SKIP_PIXELS),
        U0 = n.getParameter(n.UNPACK_SKIP_ROWS);
      n.pixelStorei(n.UNPACK_ROW_LENGTH, R.width);
      for (let m0 = 0, q0 = c0.length; m0 < q0; m0++) {
        const t2 = c0[m0],
          Z0 = Math.floor(t2.start / 4),
          B0 = Math.ceil(t2.count / 4),
          r2 = Z0 % R.width,
          Z = Math.floor(Z0 / R.width),
          N0 = B0,
          b0 = 1;
        (n.pixelStorei(n.UNPACK_SKIP_PIXELS, r2),
          n.pixelStorei(n.UNPACK_SKIP_ROWS, Z),
          t.texSubImage2D(n.TEXTURE_2D, 0, r2, Z, N0, b0, $, o0, R.data));
      }
      (B.clearUpdateRanges(),
        n.pixelStorei(n.UNPACK_ROW_LENGTH, C0),
        n.pixelStorei(n.UNPACK_SKIP_PIXELS, S0),
        n.pixelStorei(n.UNPACK_SKIP_ROWS, U0));
    }
  }
  function Y(B, R, $) {
    let o0 = n.TEXTURE_2D;
    ((R.isDataArrayTexture || R.isCompressedArrayTexture) &&
      (o0 = n.TEXTURE_2D_ARRAY),
      R.isData3DTexture && (o0 = n.TEXTURE_3D));
    const u0 = O(B, R),
      c0 = R.source;
    t.bindTexture(o0, B.__webglTexture, n.TEXTURE0 + $);
    const x0 = i.get(c0);
    if (c0.version !== x0.__version || u0 === !0) {
      t.activeTexture(n.TEXTURE0 + $);
      const C0 = f9.getPrimaries(f9.workingColorSpace),
        S0 = R.colorSpace === v9 ? null : f9.getPrimaries(R.colorSpace),
        U0 =
          R.colorSpace === v9 || C0 === S0 ? n.NONE : n.BROWSER_DEFAULT_WEBGL;
      (n.pixelStorei(n.UNPACK_FLIP_Y_WEBGL, R.flipY),
        n.pixelStorei(n.UNPACK_PREMULTIPLY_ALPHA_WEBGL, R.premultiplyAlpha),
        n.pixelStorei(n.UNPACK_ALIGNMENT, R.unpackAlignment),
        n.pixelStorei(n.UNPACK_COLORSPACE_CONVERSION_WEBGL, U0));
      let m0 = v(R.image, !1, r.maxTextureSize);
      m0 = f2(R, m0);
      const q0 = s.convert(R.format, R.colorSpace),
        t2 = s.convert(R.type);
      let Z0 = b(R.internalFormat, q0, t2, R.colorSpace, R.isVideoTexture);
      U(o0, R);
      let B0;
      const r2 = R.mipmaps,
        Z = R.isVideoTexture !== !0,
        N0 = x0.__version === void 0 || u0 === !0,
        b0 = c0.dataReady,
        $0 = x(R, m0);
      if (R.isDepthTexture)
        ((Z0 = A(R.format === fo, R.type)),
          N0 &&
            (Z
              ? t.texStorage2D(n.TEXTURE_2D, 1, Z0, m0.width, m0.height)
              : t.texImage2D(
                  n.TEXTURE_2D,
                  0,
                  Z0,
                  m0.width,
                  m0.height,
                  0,
                  q0,
                  t2,
                  null,
                )));
      else if (R.isDataTexture)
        if (r2.length > 0) {
          Z &&
            N0 &&
            t.texStorage2D(n.TEXTURE_2D, $0, Z0, r2[0].width, r2[0].height);
          for (let M0 = 0, g0 = r2.length; M0 < g0; M0++)
            ((B0 = r2[M0]),
              Z
                ? b0 &&
                  t.texSubImage2D(
                    n.TEXTURE_2D,
                    M0,
                    0,
                    0,
                    B0.width,
                    B0.height,
                    q0,
                    t2,
                    B0.data,
                  )
                : t.texImage2D(
                    n.TEXTURE_2D,
                    M0,
                    Z0,
                    B0.width,
                    B0.height,
                    0,
                    q0,
                    t2,
                    B0.data,
                  ));
          R.generateMipmaps = !1;
        } else
          Z
            ? (N0 && t.texStorage2D(n.TEXTURE_2D, $0, Z0, m0.width, m0.height),
              b0 && z(R, m0, q0, t2))
            : t.texImage2D(
                n.TEXTURE_2D,
                0,
                Z0,
                m0.width,
                m0.height,
                0,
                q0,
                t2,
                m0.data,
              );
      else if (R.isCompressedTexture)
        if (R.isCompressedArrayTexture) {
          Z &&
            N0 &&
            t.texStorage3D(
              n.TEXTURE_2D_ARRAY,
              $0,
              Z0,
              r2[0].width,
              r2[0].height,
              m0.depth,
            );
          for (let M0 = 0, g0 = r2.length; M0 < g0; M0++)
            if (((B0 = r2[M0]), R.format !== e9))
              if (q0 !== null)
                if (Z) {
                  if (b0)
                    if (R.layerUpdates.size > 0) {
                      const a2 = MA(B0.width, B0.height, R.format, R.type);
                      for (const U2 of R.layerUpdates) {
                        const $9 = B0.data.subarray(
                          (U2 * a2) / B0.data.BYTES_PER_ELEMENT,
                          ((U2 + 1) * a2) / B0.data.BYTES_PER_ELEMENT,
                        );
                        t.compressedTexSubImage3D(
                          n.TEXTURE_2D_ARRAY,
                          M0,
                          0,
                          0,
                          U2,
                          B0.width,
                          B0.height,
                          1,
                          q0,
                          $9,
                        );
                      }
                      R.clearLayerUpdates();
                    } else
                      t.compressedTexSubImage3D(
                        n.TEXTURE_2D_ARRAY,
                        M0,
                        0,
                        0,
                        0,
                        B0.width,
                        B0.height,
                        m0.depth,
                        q0,
                        B0.data,
                      );
                } else
                  t.compressedTexImage3D(
                    n.TEXTURE_2D_ARRAY,
                    M0,
                    Z0,
                    B0.width,
                    B0.height,
                    m0.depth,
                    0,
                    B0.data,
                    0,
                    0,
                  );
              else
                console.warn(
                  "THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()",
                );
            else
              Z
                ? b0 &&
                  t.texSubImage3D(
                    n.TEXTURE_2D_ARRAY,
                    M0,
                    0,
                    0,
                    0,
                    B0.width,
                    B0.height,
                    m0.depth,
                    q0,
                    t2,
                    B0.data,
                  )
                : t.texImage3D(
                    n.TEXTURE_2D_ARRAY,
                    M0,
                    Z0,
                    B0.width,
                    B0.height,
                    m0.depth,
                    0,
                    q0,
                    t2,
                    B0.data,
                  );
        } else {
          Z &&
            N0 &&
            t.texStorage2D(n.TEXTURE_2D, $0, Z0, r2[0].width, r2[0].height);
          for (let M0 = 0, g0 = r2.length; M0 < g0; M0++)
            ((B0 = r2[M0]),
              R.format !== e9
                ? q0 !== null
                  ? Z
                    ? b0 &&
                      t.compressedTexSubImage2D(
                        n.TEXTURE_2D,
                        M0,
                        0,
                        0,
                        B0.width,
                        B0.height,
                        q0,
                        B0.data,
                      )
                    : t.compressedTexImage2D(
                        n.TEXTURE_2D,
                        M0,
                        Z0,
                        B0.width,
                        B0.height,
                        0,
                        B0.data,
                      )
                  : console.warn(
                      "THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()",
                    )
                : Z
                  ? b0 &&
                    t.texSubImage2D(
                      n.TEXTURE_2D,
                      M0,
                      0,
                      0,
                      B0.width,
                      B0.height,
                      q0,
                      t2,
                      B0.data,
                    )
                  : t.texImage2D(
                      n.TEXTURE_2D,
                      M0,
                      Z0,
                      B0.width,
                      B0.height,
                      0,
                      q0,
                      t2,
                      B0.data,
                    ));
        }
      else if (R.isDataArrayTexture)
        if (Z) {
          if (
            (N0 &&
              t.texStorage3D(
                n.TEXTURE_2D_ARRAY,
                $0,
                Z0,
                m0.width,
                m0.height,
                m0.depth,
              ),
            b0)
          )
            if (R.layerUpdates.size > 0) {
              const M0 = MA(m0.width, m0.height, R.format, R.type);
              for (const g0 of R.layerUpdates) {
                const a2 = m0.data.subarray(
                  (g0 * M0) / m0.data.BYTES_PER_ELEMENT,
                  ((g0 + 1) * M0) / m0.data.BYTES_PER_ELEMENT,
                );
                t.texSubImage3D(
                  n.TEXTURE_2D_ARRAY,
                  0,
                  0,
                  0,
                  g0,
                  m0.width,
                  m0.height,
                  1,
                  q0,
                  t2,
                  a2,
                );
              }
              R.clearLayerUpdates();
            } else
              t.texSubImage3D(
                n.TEXTURE_2D_ARRAY,
                0,
                0,
                0,
                0,
                m0.width,
                m0.height,
                m0.depth,
                q0,
                t2,
                m0.data,
              );
        } else
          t.texImage3D(
            n.TEXTURE_2D_ARRAY,
            0,
            Z0,
            m0.width,
            m0.height,
            m0.depth,
            0,
            q0,
            t2,
            m0.data,
          );
      else if (R.isData3DTexture)
        Z
          ? (N0 &&
              t.texStorage3D(
                n.TEXTURE_3D,
                $0,
                Z0,
                m0.width,
                m0.height,
                m0.depth,
              ),
            b0 &&
              t.texSubImage3D(
                n.TEXTURE_3D,
                0,
                0,
                0,
                0,
                m0.width,
                m0.height,
                m0.depth,
                q0,
                t2,
                m0.data,
              ))
          : t.texImage3D(
              n.TEXTURE_3D,
              0,
              Z0,
              m0.width,
              m0.height,
              m0.depth,
              0,
              q0,
              t2,
              m0.data,
            );
      else if (R.isFramebufferTexture) {
        if (N0)
          if (Z) t.texStorage2D(n.TEXTURE_2D, $0, Z0, m0.width, m0.height);
          else {
            let M0 = m0.width,
              g0 = m0.height;
            for (let a2 = 0; a2 < $0; a2++)
              (t.texImage2D(n.TEXTURE_2D, a2, Z0, M0, g0, 0, q0, t2, null),
                (M0 >>= 1),
                (g0 >>= 1));
          }
      } else if (r2.length > 0) {
        if (Z && N0) {
          const M0 = O2(r2[0]);
          t.texStorage2D(n.TEXTURE_2D, $0, Z0, M0.width, M0.height);
        }
        for (let M0 = 0, g0 = r2.length; M0 < g0; M0++)
          ((B0 = r2[M0]),
            Z
              ? b0 && t.texSubImage2D(n.TEXTURE_2D, M0, 0, 0, q0, t2, B0)
              : t.texImage2D(n.TEXTURE_2D, M0, Z0, q0, t2, B0));
        R.generateMipmaps = !1;
      } else if (Z) {
        if (N0) {
          const M0 = O2(m0);
          t.texStorage2D(n.TEXTURE_2D, $0, Z0, M0.width, M0.height);
        }
        b0 && t.texSubImage2D(n.TEXTURE_2D, 0, 0, 0, q0, t2, m0);
      } else t.texImage2D(n.TEXTURE_2D, 0, Z0, q0, t2, m0);
      (w(R) && g(o0), (x0.__version = c0.version), R.onUpdate && R.onUpdate(R));
    }
    B.__version = R.version;
  }
  function X(B, R, $) {
    if (R.image.length !== 6) return;
    const o0 = O(B, R),
      u0 = R.source;
    t.bindTexture(n.TEXTURE_CUBE_MAP, B.__webglTexture, n.TEXTURE0 + $);
    const c0 = i.get(u0);
    if (u0.version !== c0.__version || o0 === !0) {
      t.activeTexture(n.TEXTURE0 + $);
      const x0 = f9.getPrimaries(f9.workingColorSpace),
        C0 = R.colorSpace === v9 ? null : f9.getPrimaries(R.colorSpace),
        S0 =
          R.colorSpace === v9 || x0 === C0 ? n.NONE : n.BROWSER_DEFAULT_WEBGL;
      (n.pixelStorei(n.UNPACK_FLIP_Y_WEBGL, R.flipY),
        n.pixelStorei(n.UNPACK_PREMULTIPLY_ALPHA_WEBGL, R.premultiplyAlpha),
        n.pixelStorei(n.UNPACK_ALIGNMENT, R.unpackAlignment),
        n.pixelStorei(n.UNPACK_COLORSPACE_CONVERSION_WEBGL, S0));
      const U0 = R.isCompressedTexture || R.image[0].isCompressedTexture,
        m0 = R.image[0] && R.image[0].isDataTexture,
        q0 = [];
      for (let g0 = 0; g0 < 6; g0++)
        (!U0 && !m0
          ? (q0[g0] = v(R.image[g0], !0, r.maxCubemapSize))
          : (q0[g0] = m0 ? R.image[g0].image : R.image[g0]),
          (q0[g0] = f2(R, q0[g0])));
      const t2 = q0[0],
        Z0 = s.convert(R.format, R.colorSpace),
        B0 = s.convert(R.type),
        r2 = b(R.internalFormat, Z0, B0, R.colorSpace),
        Z = R.isVideoTexture !== !0,
        N0 = c0.__version === void 0 || o0 === !0,
        b0 = u0.dataReady;
      let $0 = x(R, t2);
      U(n.TEXTURE_CUBE_MAP, R);
      let M0;
      if (U0) {
        Z &&
          N0 &&
          t.texStorage2D(n.TEXTURE_CUBE_MAP, $0, r2, t2.width, t2.height);
        for (let g0 = 0; g0 < 6; g0++) {
          M0 = q0[g0].mipmaps;
          for (let a2 = 0; a2 < M0.length; a2++) {
            const U2 = M0[a2];
            R.format !== e9
              ? Z0 !== null
                ? Z
                  ? b0 &&
                    t.compressedTexSubImage2D(
                      n.TEXTURE_CUBE_MAP_POSITIVE_X + g0,
                      a2,
                      0,
                      0,
                      U2.width,
                      U2.height,
                      Z0,
                      U2.data,
                    )
                  : t.compressedTexImage2D(
                      n.TEXTURE_CUBE_MAP_POSITIVE_X + g0,
                      a2,
                      r2,
                      U2.width,
                      U2.height,
                      0,
                      U2.data,
                    )
                : console.warn(
                    "THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()",
                  )
              : Z
                ? b0 &&
                  t.texSubImage2D(
                    n.TEXTURE_CUBE_MAP_POSITIVE_X + g0,
                    a2,
                    0,
                    0,
                    U2.width,
                    U2.height,
                    Z0,
                    B0,
                    U2.data,
                  )
                : t.texImage2D(
                    n.TEXTURE_CUBE_MAP_POSITIVE_X + g0,
                    a2,
                    r2,
                    U2.width,
                    U2.height,
                    0,
                    Z0,
                    B0,
                    U2.data,
                  );
          }
        }
      } else {
        if (((M0 = R.mipmaps), Z && N0)) {
          M0.length > 0 && $0++;
          const g0 = O2(q0[0]);
          t.texStorage2D(n.TEXTURE_CUBE_MAP, $0, r2, g0.width, g0.height);
        }
        for (let g0 = 0; g0 < 6; g0++)
          if (m0) {
            Z
              ? b0 &&
                t.texSubImage2D(
                  n.TEXTURE_CUBE_MAP_POSITIVE_X + g0,
                  0,
                  0,
                  0,
                  q0[g0].width,
                  q0[g0].height,
                  Z0,
                  B0,
                  q0[g0].data,
                )
              : t.texImage2D(
                  n.TEXTURE_CUBE_MAP_POSITIVE_X + g0,
                  0,
                  r2,
                  q0[g0].width,
                  q0[g0].height,
                  0,
                  Z0,
                  B0,
                  q0[g0].data,
                );
            for (let a2 = 0; a2 < M0.length; a2++) {
              const $9 = M0[a2].image[g0].image;
              Z
                ? b0 &&
                  t.texSubImage2D(
                    n.TEXTURE_CUBE_MAP_POSITIVE_X + g0,
                    a2 + 1,
                    0,
                    0,
                    $9.width,
                    $9.height,
                    Z0,
                    B0,
                    $9.data,
                  )
                : t.texImage2D(
                    n.TEXTURE_CUBE_MAP_POSITIVE_X + g0,
                    a2 + 1,
                    r2,
                    $9.width,
                    $9.height,
                    0,
                    Z0,
                    B0,
                    $9.data,
                  );
            }
          } else {
            Z
              ? b0 &&
                t.texSubImage2D(
                  n.TEXTURE_CUBE_MAP_POSITIVE_X + g0,
                  0,
                  0,
                  0,
                  Z0,
                  B0,
                  q0[g0],
                )
              : t.texImage2D(
                  n.TEXTURE_CUBE_MAP_POSITIVE_X + g0,
                  0,
                  r2,
                  Z0,
                  B0,
                  q0[g0],
                );
            for (let a2 = 0; a2 < M0.length; a2++) {
              const U2 = M0[a2];
              Z
                ? b0 &&
                  t.texSubImage2D(
                    n.TEXTURE_CUBE_MAP_POSITIVE_X + g0,
                    a2 + 1,
                    0,
                    0,
                    Z0,
                    B0,
                    U2.image[g0],
                  )
                : t.texImage2D(
                    n.TEXTURE_CUBE_MAP_POSITIVE_X + g0,
                    a2 + 1,
                    r2,
                    Z0,
                    B0,
                    U2.image[g0],
                  );
            }
          }
      }
      (w(R) && g(n.TEXTURE_CUBE_MAP),
        (c0.__version = u0.version),
        R.onUpdate && R.onUpdate(R));
    }
    B.__version = R.version;
  }
  function l0(B, R, $, o0, u0, c0) {
    const x0 = s.convert($.format, $.colorSpace),
      C0 = s.convert($.type),
      S0 = b($.internalFormat, x0, C0, $.colorSpace),
      U0 = i.get(R),
      m0 = i.get($);
    if (((m0.__renderTarget = R), !U0.__hasExternalTextures)) {
      const q0 = Math.max(1, R.width >> c0),
        t2 = Math.max(1, R.height >> c0);
      u0 === n.TEXTURE_3D || u0 === n.TEXTURE_2D_ARRAY
        ? t.texImage3D(u0, c0, S0, q0, t2, R.depth, 0, x0, C0, null)
        : t.texImage2D(u0, c0, S0, q0, t2, 0, x0, C0, null);
    }
    (t.bindFramebuffer(n.FRAMEBUFFER, B),
      D0(R)
        ? a.framebufferTexture2DMultisampleEXT(
            n.FRAMEBUFFER,
            o0,
            u0,
            m0.__webglTexture,
            0,
            G0(R),
          )
        : (u0 === n.TEXTURE_2D ||
            (u0 >= n.TEXTURE_CUBE_MAP_POSITIVE_X &&
              u0 <= n.TEXTURE_CUBE_MAP_NEGATIVE_Z)) &&
          n.framebufferTexture2D(n.FRAMEBUFFER, o0, u0, m0.__webglTexture, c0),
      t.bindFramebuffer(n.FRAMEBUFFER, null));
  }
  function r0(B, R, $) {
    if ((n.bindRenderbuffer(n.RENDERBUFFER, B), R.depthBuffer)) {
      const o0 = R.depthTexture,
        u0 = o0 && o0.isDepthTexture ? o0.type : null,
        c0 = A(R.stencilBuffer, u0),
        x0 = R.stencilBuffer ? n.DEPTH_STENCIL_ATTACHMENT : n.DEPTH_ATTACHMENT,
        C0 = G0(R);
      (D0(R)
        ? a.renderbufferStorageMultisampleEXT(
            n.RENDERBUFFER,
            C0,
            c0,
            R.width,
            R.height,
          )
        : $
          ? n.renderbufferStorageMultisample(
              n.RENDERBUFFER,
              C0,
              c0,
              R.width,
              R.height,
            )
          : n.renderbufferStorage(n.RENDERBUFFER, c0, R.width, R.height),
        n.framebufferRenderbuffer(n.FRAMEBUFFER, x0, n.RENDERBUFFER, B));
    } else {
      const o0 = R.textures;
      for (let u0 = 0; u0 < o0.length; u0++) {
        const c0 = o0[u0],
          x0 = s.convert(c0.format, c0.colorSpace),
          C0 = s.convert(c0.type),
          S0 = b(c0.internalFormat, x0, C0, c0.colorSpace),
          U0 = G0(R);
        $ && D0(R) === !1
          ? n.renderbufferStorageMultisample(
              n.RENDERBUFFER,
              U0,
              S0,
              R.width,
              R.height,
            )
          : D0(R)
            ? a.renderbufferStorageMultisampleEXT(
                n.RENDERBUFFER,
                U0,
                S0,
                R.width,
                R.height,
              )
            : n.renderbufferStorage(n.RENDERBUFFER, S0, R.width, R.height);
      }
    }
    n.bindRenderbuffer(n.RENDERBUFFER, null);
  }
  function j(B, R) {
    if (R && R.isWebGLCubeRenderTarget)
      throw new Error(
        "Depth Texture with cube render targets is not supported",
      );
    if (
      (t.bindFramebuffer(n.FRAMEBUFFER, B),
      !(R.depthTexture && R.depthTexture.isDepthTexture))
    )
      throw new Error(
        "renderTarget.depthTexture must be an instance of THREE.DepthTexture",
      );
    const o0 = i.get(R.depthTexture);
    ((o0.__renderTarget = R),
      (!o0.__webglTexture ||
        R.depthTexture.image.width !== R.width ||
        R.depthTexture.image.height !== R.height) &&
        ((R.depthTexture.image.width = R.width),
        (R.depthTexture.image.height = R.height),
        (R.depthTexture.needsUpdate = !0)),
      D(R.depthTexture, 0));
    const u0 = o0.__webglTexture,
      c0 = G0(R);
    if (R.depthTexture.format === ho)
      D0(R)
        ? a.framebufferTexture2DMultisampleEXT(
            n.FRAMEBUFFER,
            n.DEPTH_ATTACHMENT,
            n.TEXTURE_2D,
            u0,
            0,
            c0,
          )
        : n.framebufferTexture2D(
            n.FRAMEBUFFER,
            n.DEPTH_ATTACHMENT,
            n.TEXTURE_2D,
            u0,
            0,
          );
    else if (R.depthTexture.format === fo)
      D0(R)
        ? a.framebufferTexture2DMultisampleEXT(
            n.FRAMEBUFFER,
            n.DEPTH_STENCIL_ATTACHMENT,
            n.TEXTURE_2D,
            u0,
            0,
            c0,
          )
        : n.framebufferTexture2D(
            n.FRAMEBUFFER,
            n.DEPTH_STENCIL_ATTACHMENT,
            n.TEXTURE_2D,
            u0,
            0,
          );
    else throw new Error("Unknown depthTexture format");
  }
  function F0(B) {
    const R = i.get(B),
      $ = B.isWebGLCubeRenderTarget === !0;
    if (R.__boundDepthTexture !== B.depthTexture) {
      const o0 = B.depthTexture;
      if ((R.__depthDisposeCallback && R.__depthDisposeCallback(), o0)) {
        const u0 = () => {
          (delete R.__boundDepthTexture,
            delete R.__depthDisposeCallback,
            o0.removeEventListener("dispose", u0));
        };
        (o0.addEventListener("dispose", u0), (R.__depthDisposeCallback = u0));
      }
      R.__boundDepthTexture = o0;
    }
    if (B.depthTexture && !R.__autoAllocateDepthBuffer) {
      if ($)
        throw new Error(
          "target.depthTexture not supported in Cube render targets",
        );
      const o0 = B.texture.mipmaps;
      o0 && o0.length > 0
        ? j(R.__webglFramebuffer[0], B)
        : j(R.__webglFramebuffer, B);
    } else if ($) {
      R.__webglDepthbuffer = [];
      for (let o0 = 0; o0 < 6; o0++)
        if (
          (t.bindFramebuffer(n.FRAMEBUFFER, R.__webglFramebuffer[o0]),
          R.__webglDepthbuffer[o0] === void 0)
        )
          ((R.__webglDepthbuffer[o0] = n.createRenderbuffer()),
            r0(R.__webglDepthbuffer[o0], B, !1));
        else {
          const u0 = B.stencilBuffer
              ? n.DEPTH_STENCIL_ATTACHMENT
              : n.DEPTH_ATTACHMENT,
            c0 = R.__webglDepthbuffer[o0];
          (n.bindRenderbuffer(n.RENDERBUFFER, c0),
            n.framebufferRenderbuffer(n.FRAMEBUFFER, u0, n.RENDERBUFFER, c0));
        }
    } else {
      const o0 = B.texture.mipmaps;
      if (
        (o0 && o0.length > 0
          ? t.bindFramebuffer(n.FRAMEBUFFER, R.__webglFramebuffer[0])
          : t.bindFramebuffer(n.FRAMEBUFFER, R.__webglFramebuffer),
        R.__webglDepthbuffer === void 0)
      )
        ((R.__webglDepthbuffer = n.createRenderbuffer()),
          r0(R.__webglDepthbuffer, B, !1));
      else {
        const u0 = B.stencilBuffer
            ? n.DEPTH_STENCIL_ATTACHMENT
            : n.DEPTH_ATTACHMENT,
          c0 = R.__webglDepthbuffer;
        (n.bindRenderbuffer(n.RENDERBUFFER, c0),
          n.framebufferRenderbuffer(n.FRAMEBUFFER, u0, n.RENDERBUFFER, c0));
      }
    }
    t.bindFramebuffer(n.FRAMEBUFFER, null);
  }
  function O0(B, R, $) {
    const o0 = i.get(B);
    (R !== void 0 &&
      l0(
        o0.__webglFramebuffer,
        B,
        B.texture,
        n.COLOR_ATTACHMENT0,
        n.TEXTURE_2D,
        0,
      ),
      $ !== void 0 && F0(B));
  }
  function z0(B) {
    const R = B.texture,
      $ = i.get(B),
      o0 = i.get(R);
    B.addEventListener("dispose", E);
    const u0 = B.textures,
      c0 = B.isWebGLCubeRenderTarget === !0,
      x0 = u0.length > 1;
    if (
      (x0 ||
        (o0.__webglTexture === void 0 &&
          (o0.__webglTexture = n.createTexture()),
        (o0.__version = R.version),
        o.memory.textures++),
      c0)
    ) {
      $.__webglFramebuffer = [];
      for (let C0 = 0; C0 < 6; C0++)
        if (R.mipmaps && R.mipmaps.length > 0) {
          $.__webglFramebuffer[C0] = [];
          for (let S0 = 0; S0 < R.mipmaps.length; S0++)
            $.__webglFramebuffer[C0][S0] = n.createFramebuffer();
        } else $.__webglFramebuffer[C0] = n.createFramebuffer();
    } else {
      if (R.mipmaps && R.mipmaps.length > 0) {
        $.__webglFramebuffer = [];
        for (let C0 = 0; C0 < R.mipmaps.length; C0++)
          $.__webglFramebuffer[C0] = n.createFramebuffer();
      } else $.__webglFramebuffer = n.createFramebuffer();
      if (x0)
        for (let C0 = 0, S0 = u0.length; C0 < S0; C0++) {
          const U0 = i.get(u0[C0]);
          U0.__webglTexture === void 0 &&
            ((U0.__webglTexture = n.createTexture()), o.memory.textures++);
        }
      if (B.samples > 0 && D0(B) === !1) {
        (($.__webglMultisampledFramebuffer = n.createFramebuffer()),
          ($.__webglColorRenderbuffer = []),
          t.bindFramebuffer(n.FRAMEBUFFER, $.__webglMultisampledFramebuffer));
        for (let C0 = 0; C0 < u0.length; C0++) {
          const S0 = u0[C0];
          (($.__webglColorRenderbuffer[C0] = n.createRenderbuffer()),
            n.bindRenderbuffer(n.RENDERBUFFER, $.__webglColorRenderbuffer[C0]));
          const U0 = s.convert(S0.format, S0.colorSpace),
            m0 = s.convert(S0.type),
            q0 = b(
              S0.internalFormat,
              U0,
              m0,
              S0.colorSpace,
              B.isXRRenderTarget === !0,
            ),
            t2 = G0(B);
          (n.renderbufferStorageMultisample(
            n.RENDERBUFFER,
            t2,
            q0,
            B.width,
            B.height,
          ),
            n.framebufferRenderbuffer(
              n.FRAMEBUFFER,
              n.COLOR_ATTACHMENT0 + C0,
              n.RENDERBUFFER,
              $.__webglColorRenderbuffer[C0],
            ));
        }
        (n.bindRenderbuffer(n.RENDERBUFFER, null),
          B.depthBuffer &&
            (($.__webglDepthRenderbuffer = n.createRenderbuffer()),
            r0($.__webglDepthRenderbuffer, B, !0)),
          t.bindFramebuffer(n.FRAMEBUFFER, null));
      }
    }
    if (c0) {
      (t.bindTexture(n.TEXTURE_CUBE_MAP, o0.__webglTexture),
        U(n.TEXTURE_CUBE_MAP, R));
      for (let C0 = 0; C0 < 6; C0++)
        if (R.mipmaps && R.mipmaps.length > 0)
          for (let S0 = 0; S0 < R.mipmaps.length; S0++)
            l0(
              $.__webglFramebuffer[C0][S0],
              B,
              R,
              n.COLOR_ATTACHMENT0,
              n.TEXTURE_CUBE_MAP_POSITIVE_X + C0,
              S0,
            );
        else
          l0(
            $.__webglFramebuffer[C0],
            B,
            R,
            n.COLOR_ATTACHMENT0,
            n.TEXTURE_CUBE_MAP_POSITIVE_X + C0,
            0,
          );
      (w(R) && g(n.TEXTURE_CUBE_MAP), t.unbindTexture());
    } else if (x0) {
      for (let C0 = 0, S0 = u0.length; C0 < S0; C0++) {
        const U0 = u0[C0],
          m0 = i.get(U0);
        (t.bindTexture(n.TEXTURE_2D, m0.__webglTexture),
          U(n.TEXTURE_2D, U0),
          l0(
            $.__webglFramebuffer,
            B,
            U0,
            n.COLOR_ATTACHMENT0 + C0,
            n.TEXTURE_2D,
            0,
          ),
          w(U0) && g(n.TEXTURE_2D));
      }
      t.unbindTexture();
    } else {
      let C0 = n.TEXTURE_2D;
      if (
        ((B.isWebGL3DRenderTarget || B.isWebGLArrayRenderTarget) &&
          (C0 = B.isWebGL3DRenderTarget ? n.TEXTURE_3D : n.TEXTURE_2D_ARRAY),
        t.bindTexture(C0, o0.__webglTexture),
        U(C0, R),
        R.mipmaps && R.mipmaps.length > 0)
      )
        for (let S0 = 0; S0 < R.mipmaps.length; S0++)
          l0($.__webglFramebuffer[S0], B, R, n.COLOR_ATTACHMENT0, C0, S0);
      else l0($.__webglFramebuffer, B, R, n.COLOR_ATTACHMENT0, C0, 0);
      (w(R) && g(C0), t.unbindTexture());
    }
    B.depthBuffer && F0(B);
  }
  function W(B) {
    const R = B.textures;
    for (let $ = 0, o0 = R.length; $ < o0; $++) {
      const u0 = R[$];
      if (w(u0)) {
        const c0 = y(B),
          x0 = i.get(u0).__webglTexture;
        (t.bindTexture(c0, x0), g(c0), t.unbindTexture());
      }
    }
  }
  const R2 = [],
    I0 = [];
  function o2(B) {
    if (B.samples > 0) {
      if (D0(B) === !1) {
        const R = B.textures,
          $ = B.width,
          o0 = B.height;
        let u0 = n.COLOR_BUFFER_BIT;
        const c0 = B.stencilBuffer
            ? n.DEPTH_STENCIL_ATTACHMENT
            : n.DEPTH_ATTACHMENT,
          x0 = i.get(B),
          C0 = R.length > 1;
        if (C0)
          for (let U0 = 0; U0 < R.length; U0++)
            (t.bindFramebuffer(
              n.FRAMEBUFFER,
              x0.__webglMultisampledFramebuffer,
            ),
              n.framebufferRenderbuffer(
                n.FRAMEBUFFER,
                n.COLOR_ATTACHMENT0 + U0,
                n.RENDERBUFFER,
                null,
              ),
              t.bindFramebuffer(n.FRAMEBUFFER, x0.__webglFramebuffer),
              n.framebufferTexture2D(
                n.DRAW_FRAMEBUFFER,
                n.COLOR_ATTACHMENT0 + U0,
                n.TEXTURE_2D,
                null,
                0,
              ));
        t.bindFramebuffer(
          n.READ_FRAMEBUFFER,
          x0.__webglMultisampledFramebuffer,
        );
        const S0 = B.texture.mipmaps;
        S0 && S0.length > 0
          ? t.bindFramebuffer(n.DRAW_FRAMEBUFFER, x0.__webglFramebuffer[0])
          : t.bindFramebuffer(n.DRAW_FRAMEBUFFER, x0.__webglFramebuffer);
        for (let U0 = 0; U0 < R.length; U0++) {
          if (
            (B.resolveDepthBuffer &&
              (B.depthBuffer && (u0 |= n.DEPTH_BUFFER_BIT),
              B.stencilBuffer &&
                B.resolveStencilBuffer &&
                (u0 |= n.STENCIL_BUFFER_BIT)),
            C0)
          ) {
            n.framebufferRenderbuffer(
              n.READ_FRAMEBUFFER,
              n.COLOR_ATTACHMENT0,
              n.RENDERBUFFER,
              x0.__webglColorRenderbuffer[U0],
            );
            const m0 = i.get(R[U0]).__webglTexture;
            n.framebufferTexture2D(
              n.DRAW_FRAMEBUFFER,
              n.COLOR_ATTACHMENT0,
              n.TEXTURE_2D,
              m0,
              0,
            );
          }
          (n.blitFramebuffer(0, 0, $, o0, 0, 0, $, o0, u0, n.NEAREST),
            c === !0 &&
              ((R2.length = 0),
              (I0.length = 0),
              R2.push(n.COLOR_ATTACHMENT0 + U0),
              B.depthBuffer &&
                B.resolveDepthBuffer === !1 &&
                (R2.push(c0),
                I0.push(c0),
                n.invalidateFramebuffer(n.DRAW_FRAMEBUFFER, I0)),
              n.invalidateFramebuffer(n.READ_FRAMEBUFFER, R2)));
        }
        if (
          (t.bindFramebuffer(n.READ_FRAMEBUFFER, null),
          t.bindFramebuffer(n.DRAW_FRAMEBUFFER, null),
          C0)
        )
          for (let U0 = 0; U0 < R.length; U0++) {
            (t.bindFramebuffer(
              n.FRAMEBUFFER,
              x0.__webglMultisampledFramebuffer,
            ),
              n.framebufferRenderbuffer(
                n.FRAMEBUFFER,
                n.COLOR_ATTACHMENT0 + U0,
                n.RENDERBUFFER,
                x0.__webglColorRenderbuffer[U0],
              ));
            const m0 = i.get(R[U0]).__webglTexture;
            (t.bindFramebuffer(n.FRAMEBUFFER, x0.__webglFramebuffer),
              n.framebufferTexture2D(
                n.DRAW_FRAMEBUFFER,
                n.COLOR_ATTACHMENT0 + U0,
                n.TEXTURE_2D,
                m0,
                0,
              ));
          }
        t.bindFramebuffer(
          n.DRAW_FRAMEBUFFER,
          x0.__webglMultisampledFramebuffer,
        );
      } else if (B.depthBuffer && B.resolveDepthBuffer === !1 && c) {
        const R = B.stencilBuffer
          ? n.DEPTH_STENCIL_ATTACHMENT
          : n.DEPTH_ATTACHMENT;
        n.invalidateFramebuffer(n.DRAW_FRAMEBUFFER, [R]);
      }
    }
  }
  function G0(B) {
    return Math.min(r.maxSamples, B.samples);
  }
  function D0(B) {
    const R = i.get(B);
    return (
      B.samples > 0 &&
      e.has("WEBGL_multisampled_render_to_texture") === !0 &&
      R.__useRenderToTexture !== !1
    );
  }
  function E0(B) {
    const R = o.render.frame;
    u.get(B) !== R && (u.set(B, R), B.update());
  }
  function f2(B, R) {
    const $ = B.colorSpace,
      o0 = B.format,
      u0 = B.type;
    return (
      B.isCompressedTexture === !0 ||
        B.isVideoTexture === !0 ||
        ($ !== qe &&
          $ !== v9 &&
          (f9.getTransfer($) === B9
            ? (o0 !== e9 || u0 !== _9) &&
              console.warn(
                "THREE.WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType.",
              )
            : console.error(
                "THREE.WebGLTextures: Unsupported texture color space:",
                $,
              ))),
      R
    );
  }
  function O2(B) {
    return (
      typeof HTMLImageElement < "u" && B instanceof HTMLImageElement
        ? ((l.width = B.naturalWidth || B.width),
          (l.height = B.naturalHeight || B.height))
        : typeof VideoFrame < "u" && B instanceof VideoFrame
          ? ((l.width = B.displayWidth), (l.height = B.displayHeight))
          : ((l.width = B.width), (l.height = B.height)),
      l
    );
  }
  ((this.allocateTextureUnit = L),
    (this.resetTextureUnits = I),
    (this.setTexture2D = D),
    (this.setTexture2DArray = V),
    (this.setTexture3D = K),
    (this.setTextureCube = P),
    (this.rebindTextures = O0),
    (this.setupRenderTarget = z0),
    (this.updateRenderTargetMipmap = W),
    (this.updateMultisampleRenderTarget = o2),
    (this.setupDepthRenderbuffer = F0),
    (this.setupFrameBufferTexture = l0),
    (this.useMultisampledRTT = D0));
}
function wW(n, e) {
  function t(i, r = v9) {
    let s;
    const o = f9.getTransfer(r);
    if (i === _9) return n.UNSIGNED_BYTE;
    if (i === Tm) return n.UNSIGNED_SHORT_4_4_4_4;
    if (i === _m) return n.UNSIGNED_SHORT_5_5_5_1;
    if (i === dG) return n.UNSIGNED_INT_5_9_9_9_REV;
    if (i === uG) return n.BYTE;
    if (i === hG) return n.SHORT;
    if (i === lo) return n.UNSIGNED_SHORT;
    if (i === Em) return n.INT;
    if (i === A4) return n.UNSIGNED_INT;
    if (i === $5) return n.FLOAT;
    if (i === sa) return n.HALF_FLOAT;
    if (i === fG) return n.ALPHA;
    if (i === pG) return n.RGB;
    if (i === e9) return n.RGBA;
    if (i === ho) return n.DEPTH_COMPONENT;
    if (i === fo) return n.DEPTH_STENCIL;
    if (i === gG) return n.RED;
    if (i === Gm) return n.RED_INTEGER;
    if (i === mG) return n.RG;
    if (i === Bm) return n.RG_INTEGER;
    if (i === Rm) return n.RGBA_INTEGER;
    if (i === u4 || i === $i || i === Wi || i === Hi)
      if (o === B9)
        if (((s = e.get("WEBGL_compressed_texture_s3tc_srgb")), s !== null)) {
          if (i === u4) return s.COMPRESSED_SRGB_S3TC_DXT1_EXT;
          if (i === $i) return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;
          if (i === Wi) return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;
          if (i === Hi) return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT;
        } else return null;
      else if (((s = e.get("WEBGL_compressed_texture_s3tc")), s !== null)) {
        if (i === u4) return s.COMPRESSED_RGB_S3TC_DXT1_EXT;
        if (i === $i) return s.COMPRESSED_RGBA_S3TC_DXT1_EXT;
        if (i === Wi) return s.COMPRESSED_RGBA_S3TC_DXT3_EXT;
        if (i === Hi) return s.COMPRESSED_RGBA_S3TC_DXT5_EXT;
      } else return null;
    if (i === Zf || i === Qf || i === Jf || i === ep)
      if (((s = e.get("WEBGL_compressed_texture_pvrtc")), s !== null)) {
        if (i === Zf) return s.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;
        if (i === Qf) return s.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;
        if (i === Jf) return s.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;
        if (i === ep) return s.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG;
      } else return null;
    if (i === _l || i === tp || i === np)
      if (((s = e.get("WEBGL_compressed_texture_etc")), s !== null)) {
        if (i === _l || i === tp)
          return o === B9 ? s.COMPRESSED_SRGB8_ETC2 : s.COMPRESSED_RGB8_ETC2;
        if (i === np)
          return o === B9
            ? s.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC
            : s.COMPRESSED_RGBA8_ETC2_EAC;
      } else return null;
    if (
      i === ip ||
      i === rp ||
      i === sp ||
      i === op ||
      i === ap ||
      i === cp ||
      i === lp ||
      i === up ||
      i === hp ||
      i === dp ||
      i === fp ||
      i === pp ||
      i === gp ||
      i === mp
    )
      if (((s = e.get("WEBGL_compressed_texture_astc")), s !== null)) {
        if (i === ip)
          return o === B9
            ? s.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR
            : s.COMPRESSED_RGBA_ASTC_4x4_KHR;
        if (i === rp)
          return o === B9
            ? s.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR
            : s.COMPRESSED_RGBA_ASTC_5x4_KHR;
        if (i === sp)
          return o === B9
            ? s.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR
            : s.COMPRESSED_RGBA_ASTC_5x5_KHR;
        if (i === op)
          return o === B9
            ? s.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR
            : s.COMPRESSED_RGBA_ASTC_6x5_KHR;
        if (i === ap)
          return o === B9
            ? s.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR
            : s.COMPRESSED_RGBA_ASTC_6x6_KHR;
        if (i === cp)
          return o === B9
            ? s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR
            : s.COMPRESSED_RGBA_ASTC_8x5_KHR;
        if (i === lp)
          return o === B9
            ? s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR
            : s.COMPRESSED_RGBA_ASTC_8x6_KHR;
        if (i === up)
          return o === B9
            ? s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR
            : s.COMPRESSED_RGBA_ASTC_8x8_KHR;
        if (i === hp)
          return o === B9
            ? s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR
            : s.COMPRESSED_RGBA_ASTC_10x5_KHR;
        if (i === dp)
          return o === B9
            ? s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR
            : s.COMPRESSED_RGBA_ASTC_10x6_KHR;
        if (i === fp)
          return o === B9
            ? s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR
            : s.COMPRESSED_RGBA_ASTC_10x8_KHR;
        if (i === pp)
          return o === B9
            ? s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR
            : s.COMPRESSED_RGBA_ASTC_10x10_KHR;
        if (i === gp)
          return o === B9
            ? s.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR
            : s.COMPRESSED_RGBA_ASTC_12x10_KHR;
        if (i === mp)
          return o === B9
            ? s.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR
            : s.COMPRESSED_RGBA_ASTC_12x12_KHR;
      } else return null;
    if (i === Oc || i === Gl || i === Bl)
      if (((s = e.get("EXT_texture_compression_bptc")), s !== null)) {
        if (i === Oc)
          return o === B9
            ? s.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT
            : s.COMPRESSED_RGBA_BPTC_UNORM_EXT;
        if (i === Gl) return s.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;
        if (i === Bl) return s.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT;
      } else return null;
    if (i === wG || i === wp || i === vp || i === yp)
      if (((s = e.get("EXT_texture_compression_rgtc")), s !== null)) {
        if (i === Oc) return s.COMPRESSED_RED_RGTC1_EXT;
        if (i === wp) return s.COMPRESSED_SIGNED_RED_RGTC1_EXT;
        if (i === vp) return s.COMPRESSED_RED_GREEN_RGTC2_EXT;
        if (i === yp) return s.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT;
      } else return null;
    return i === uo ? n.UNSIGNED_INT_24_8 : n[i] !== void 0 ? n[i] : null;
  }
  return { convert: t };
}
const vW = `
void main() {

	gl_Position = vec4( position, 1.0 );

}`,
  yW = `
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`;
class AW {
  constructor() {
    ((this.texture = null),
      (this.mesh = null),
      (this.depthNear = 0),
      (this.depthFar = 0));
  }
  init(e, t, i) {
    if (this.texture === null) {
      const r = new D9(),
        s = e.properties.get(r);
      ((s.__webglTexture = t.texture),
        (t.depthNear !== i.depthNear || t.depthFar !== i.depthFar) &&
          ((this.depthNear = t.depthNear), (this.depthFar = t.depthFar)),
        (this.texture = r));
    }
  }
  getMesh(e) {
    if (this.texture !== null && this.mesh === null) {
      const t = e.cameras[0].viewport,
        i = new $1({
          vertexShader: vW,
          fragmentShader: yW,
          uniforms: {
            depthColor: { value: this.texture },
            depthWidth: { value: t.z },
            depthHeight: { value: t.w },
          },
        });
      this.mesh = new D2(new Ar(20, 20), i);
    }
    return this.mesh;
  }
  reset() {
    ((this.texture = null), (this.mesh = null));
  }
  getDepthTexture() {
    return this.texture;
  }
}
class bW extends vr {
  constructor(e, t) {
    super();
    const i = this;
    let r = null,
      s = 1,
      o = null,
      a = "local-floor",
      c = 1,
      l = null,
      u = null,
      h = null,
      d = null,
      f = null,
      p = null;
    const v = new AW(),
      w = t.getContextAttributes();
    let g = null,
      y = null;
    const b = [],
      A = [],
      x = new B2();
    let M = null;
    const E = new Z9();
    E.viewport = new Y2();
    const _ = new Z9();
    _.viewport = new Y2();
    const C = [E, _],
      S = new UN();
    let G = null,
      I = null;
    ((this.cameraAutoUpdate = !0),
      (this.enabled = !1),
      (this.isPresenting = !1),
      (this.getController = function (F) {
        let z = b[F];
        return (
          z === void 0 && ((z = new ru()), (b[F] = z)),
          z.getTargetRaySpace()
        );
      }),
      (this.getControllerGrip = function (F) {
        let z = b[F];
        return (z === void 0 && ((z = new ru()), (b[F] = z)), z.getGripSpace());
      }),
      (this.getHand = function (F) {
        let z = b[F];
        return (z === void 0 && ((z = new ru()), (b[F] = z)), z.getHandSpace());
      }));
    function L(F) {
      const z = A.indexOf(F.inputSource);
      if (z === -1) return;
      const Y = b[z];
      Y !== void 0 &&
        (Y.update(F.inputSource, F.frame, l || o),
        Y.dispatchEvent({ type: F.type, data: F.inputSource }));
    }
    function k() {
      (r.removeEventListener("select", L),
        r.removeEventListener("selectstart", L),
        r.removeEventListener("selectend", L),
        r.removeEventListener("squeeze", L),
        r.removeEventListener("squeezestart", L),
        r.removeEventListener("squeezeend", L),
        r.removeEventListener("end", k),
        r.removeEventListener("inputsourceschange", D));
      for (let F = 0; F < b.length; F++) {
        const z = A[F];
        z !== null && ((A[F] = null), b[F].disconnect(z));
      }
      ((G = null),
        (I = null),
        v.reset(),
        e.setRenderTarget(g),
        (f = null),
        (d = null),
        (h = null),
        (r = null),
        (y = null),
        O.stop(),
        (i.isPresenting = !1),
        e.setPixelRatio(M),
        e.setSize(x.width, x.height, !1),
        i.dispatchEvent({ type: "sessionend" }));
    }
    ((this.setFramebufferScaleFactor = function (F) {
      ((s = F),
        i.isPresenting === !0 &&
          console.warn(
            "THREE.WebXRManager: Cannot change framebuffer scale while presenting.",
          ));
    }),
      (this.setReferenceSpaceType = function (F) {
        ((a = F),
          i.isPresenting === !0 &&
            console.warn(
              "THREE.WebXRManager: Cannot change reference space type while presenting.",
            ));
      }),
      (this.getReferenceSpace = function () {
        return l || o;
      }),
      (this.setReferenceSpace = function (F) {
        l = F;
      }),
      (this.getBaseLayer = function () {
        return d !== null ? d : f;
      }),
      (this.getBinding = function () {
        return h;
      }),
      (this.getFrame = function () {
        return p;
      }),
      (this.getSession = function () {
        return r;
      }),
      (this.setSession = async function (F) {
        if (((r = F), r !== null)) {
          if (
            ((g = e.getRenderTarget()),
            r.addEventListener("select", L),
            r.addEventListener("selectstart", L),
            r.addEventListener("selectend", L),
            r.addEventListener("squeeze", L),
            r.addEventListener("squeezestart", L),
            r.addEventListener("squeezeend", L),
            r.addEventListener("end", k),
            r.addEventListener("inputsourceschange", D),
            w.xrCompatible !== !0 && (await t.makeXRCompatible()),
            (M = e.getPixelRatio()),
            e.getSize(x),
            typeof XRWebGLBinding < "u" &&
              "createProjectionLayer" in XRWebGLBinding.prototype)
          ) {
            let Y = null,
              X = null,
              l0 = null;
            w.depth &&
              ((l0 = w.stencil ? t.DEPTH24_STENCIL8 : t.DEPTH_COMPONENT24),
              (Y = w.stencil ? fo : ho),
              (X = w.stencil ? uo : A4));
            const r0 = {
              colorFormat: t.RGBA8,
              depthFormat: l0,
              scaleFactor: s,
            };
            ((h = new XRWebGLBinding(r, t)),
              (d = h.createProjectionLayer(r0)),
              r.updateRenderState({ layers: [d] }),
              e.setPixelRatio(1),
              e.setSize(d.textureWidth, d.textureHeight, !1),
              (y = new nn(d.textureWidth, d.textureHeight, {
                format: e9,
                type: _9,
                depthTexture: new RG(
                  d.textureWidth,
                  d.textureHeight,
                  X,
                  void 0,
                  void 0,
                  void 0,
                  void 0,
                  void 0,
                  void 0,
                  Y,
                ),
                stencilBuffer: w.stencil,
                colorSpace: e.outputColorSpace,
                samples: w.antialias ? 4 : 0,
                resolveDepthBuffer: d.ignoreDepthValues === !1,
                resolveStencilBuffer: d.ignoreDepthValues === !1,
              })));
          } else {
            const Y = {
              antialias: w.antialias,
              alpha: !0,
              depth: w.depth,
              stencil: w.stencil,
              framebufferScaleFactor: s,
            };
            ((f = new XRWebGLLayer(r, t, Y)),
              r.updateRenderState({ baseLayer: f }),
              e.setPixelRatio(1),
              e.setSize(f.framebufferWidth, f.framebufferHeight, !1),
              (y = new nn(f.framebufferWidth, f.framebufferHeight, {
                format: e9,
                type: _9,
                colorSpace: e.outputColorSpace,
                stencilBuffer: w.stencil,
                resolveDepthBuffer: f.ignoreDepthValues === !1,
                resolveStencilBuffer: f.ignoreDepthValues === !1,
              })));
          }
          ((y.isXRRenderTarget = !0),
            this.setFoveation(c),
            (l = null),
            (o = await r.requestReferenceSpace(a)),
            O.setContext(r),
            O.start(),
            (i.isPresenting = !0),
            i.dispatchEvent({ type: "sessionstart" }));
        }
      }),
      (this.getEnvironmentBlendMode = function () {
        if (r !== null) return r.environmentBlendMode;
      }),
      (this.getDepthTexture = function () {
        return v.getDepthTexture();
      }));
    function D(F) {
      for (let z = 0; z < F.removed.length; z++) {
        const Y = F.removed[z],
          X = A.indexOf(Y);
        X >= 0 && ((A[X] = null), b[X].disconnect(Y));
      }
      for (let z = 0; z < F.added.length; z++) {
        const Y = F.added[z];
        let X = A.indexOf(Y);
        if (X === -1) {
          for (let r0 = 0; r0 < b.length; r0++)
            if (r0 >= A.length) {
              (A.push(Y), (X = r0));
              break;
            } else if (A[r0] === null) {
              ((A[r0] = Y), (X = r0));
              break;
            }
          if (X === -1) break;
        }
        const l0 = b[X];
        l0 && l0.connect(Y);
      }
    }
    const V = new H(),
      K = new H();
    function P(F, z, Y) {
      (V.setFromMatrixPosition(z.matrixWorld),
        K.setFromMatrixPosition(Y.matrixWorld));
      const X = V.distanceTo(K),
        l0 = z.projectionMatrix.elements,
        r0 = Y.projectionMatrix.elements,
        j = l0[14] / (l0[10] - 1),
        F0 = l0[14] / (l0[10] + 1),
        O0 = (l0[9] + 1) / l0[5],
        z0 = (l0[9] - 1) / l0[5],
        W = (l0[8] - 1) / l0[0],
        R2 = (r0[8] + 1) / r0[0],
        I0 = j * W,
        o2 = j * R2,
        G0 = X / (-W + R2),
        D0 = G0 * -W;
      if (
        (z.matrixWorld.decompose(F.position, F.quaternion, F.scale),
        F.translateX(D0),
        F.translateZ(G0),
        F.matrixWorld.compose(F.position, F.quaternion, F.scale),
        F.matrixWorldInverse.copy(F.matrixWorld).invert(),
        l0[10] === -1)
      )
        (F.projectionMatrix.copy(z.projectionMatrix),
          F.projectionMatrixInverse.copy(z.projectionMatrixInverse));
      else {
        const E0 = j + G0,
          f2 = F0 + G0,
          O2 = I0 - D0,
          B = o2 + (X - D0),
          R = ((O0 * F0) / f2) * E0,
          $ = ((z0 * F0) / f2) * E0;
        (F.projectionMatrix.makePerspective(O2, B, R, $, E0, f2),
          F.projectionMatrixInverse.copy(F.projectionMatrix).invert());
      }
    }
    function q(F, z) {
      (z === null
        ? F.matrixWorld.copy(F.matrix)
        : F.matrixWorld.multiplyMatrices(z.matrixWorld, F.matrix),
        F.matrixWorldInverse.copy(F.matrixWorld).invert());
    }
    this.updateCamera = function (F) {
      if (r === null) return;
      let z = F.near,
        Y = F.far;
      (v.texture !== null &&
        (v.depthNear > 0 && (z = v.depthNear),
        v.depthFar > 0 && (Y = v.depthFar)),
        (S.near = _.near = E.near = z),
        (S.far = _.far = E.far = Y),
        (G !== S.near || I !== S.far) &&
          (r.updateRenderState({ depthNear: S.near, depthFar: S.far }),
          (G = S.near),
          (I = S.far)),
        (E.layers.mask = F.layers.mask | 2),
        (_.layers.mask = F.layers.mask | 4),
        (S.layers.mask = E.layers.mask | _.layers.mask));
      const X = F.parent,
        l0 = S.cameras;
      q(S, X);
      for (let r0 = 0; r0 < l0.length; r0++) q(l0[r0], X);
      (l0.length === 2
        ? P(S, E, _)
        : S.projectionMatrix.copy(E.projectionMatrix),
        e0(F, S, X));
    };
    function e0(F, z, Y) {
      (Y === null
        ? F.matrix.copy(z.matrixWorld)
        : (F.matrix.copy(Y.matrixWorld),
          F.matrix.invert(),
          F.matrix.multiply(z.matrixWorld)),
        F.matrix.decompose(F.position, F.quaternion, F.scale),
        F.updateMatrixWorld(!0),
        F.projectionMatrix.copy(z.projectionMatrix),
        F.projectionMatrixInverse.copy(z.projectionMatrixInverse),
        F.isPerspectiveCamera &&
          ((F.fov = po * 2 * Math.atan(1 / F.projectionMatrix.elements[5])),
          (F.zoom = 1)));
    }
    ((this.getCamera = function () {
      return S;
    }),
      (this.getFoveation = function () {
        if (!(d === null && f === null)) return c;
      }),
      (this.setFoveation = function (F) {
        ((c = F),
          d !== null && (d.fixedFoveation = F),
          f !== null && f.fixedFoveation !== void 0 && (f.fixedFoveation = F));
      }),
      (this.hasDepthSensing = function () {
        return v.texture !== null;
      }),
      (this.getDepthSensingMesh = function () {
        return v.getMesh(S);
      }));
    let Q = null;
    function U(F, z) {
      if (((u = z.getViewerPose(l || o)), (p = z), u !== null)) {
        const Y = u.views;
        f !== null &&
          (e.setRenderTargetFramebuffer(y, f.framebuffer),
          e.setRenderTarget(y));
        let X = !1;
        Y.length !== S.cameras.length && ((S.cameras.length = 0), (X = !0));
        for (let j = 0; j < Y.length; j++) {
          const F0 = Y[j];
          let O0 = null;
          if (f !== null) O0 = f.getViewport(F0);
          else {
            const W = h.getViewSubImage(d, F0);
            ((O0 = W.viewport),
              j === 0 &&
                (e.setRenderTargetTextures(
                  y,
                  W.colorTexture,
                  W.depthStencilTexture,
                ),
                e.setRenderTarget(y)));
          }
          let z0 = C[j];
          (z0 === void 0 &&
            ((z0 = new Z9()),
            z0.layers.enable(j),
            (z0.viewport = new Y2()),
            (C[j] = z0)),
            z0.matrix.fromArray(F0.transform.matrix),
            z0.matrix.decompose(z0.position, z0.quaternion, z0.scale),
            z0.projectionMatrix.fromArray(F0.projectionMatrix),
            z0.projectionMatrixInverse.copy(z0.projectionMatrix).invert(),
            z0.viewport.set(O0.x, O0.y, O0.width, O0.height),
            j === 0 &&
              (S.matrix.copy(z0.matrix),
              S.matrix.decompose(S.position, S.quaternion, S.scale)),
            X === !0 && S.cameras.push(z0));
        }
        const l0 = r.enabledFeatures;
        if (
          l0 &&
          l0.includes("depth-sensing") &&
          r.depthUsage == "gpu-optimized" &&
          h
        ) {
          const j = h.getDepthInformation(Y[0]);
          j && j.isValid && j.texture && v.init(e, j, r.renderState);
        }
      }
      for (let Y = 0; Y < b.length; Y++) {
        const X = A[Y],
          l0 = b[Y];
        X !== null && l0 !== void 0 && l0.update(X, z, l || o);
      }
      (Q && Q(F, z),
        z.detectedPlanes &&
          i.dispatchEvent({ type: "planesdetected", data: z }),
        (p = null));
    }
    const O = new kG();
    (O.setAnimationLoop(U),
      (this.setAnimationLoop = function (F) {
        Q = F;
      }),
      (this.dispose = function () {}));
  }
}
const M3 = new o5(),
  MW = new v2();
function xW(n, e) {
  function t(w, g) {
    (w.matrixAutoUpdate === !0 && w.updateMatrix(), g.value.copy(w.matrix));
  }
  function i(w, g) {
    (g.color.getRGB(w.fogColor.value, CG(n)),
      g.isFog
        ? ((w.fogNear.value = g.near), (w.fogFar.value = g.far))
        : g.isFogExp2 && (w.fogDensity.value = g.density));
  }
  function r(w, g, y, b, A) {
    g.isMeshBasicMaterial || g.isMeshLambertMaterial
      ? s(w, g)
      : g.isMeshToonMaterial
        ? (s(w, g), h(w, g))
        : g.isMeshPhongMaterial
          ? (s(w, g), u(w, g))
          : g.isMeshStandardMaterial
            ? (s(w, g), d(w, g), g.isMeshPhysicalMaterial && f(w, g, A))
            : g.isMeshMatcapMaterial
              ? (s(w, g), p(w, g))
              : g.isMeshDepthMaterial
                ? s(w, g)
                : g.isMeshDistanceMaterial
                  ? (s(w, g), v(w, g))
                  : g.isMeshNormalMaterial
                    ? s(w, g)
                    : g.isLineBasicMaterial
                      ? (o(w, g), g.isLineDashedMaterial && a(w, g))
                      : g.isPointsMaterial
                        ? c(w, g, y, b)
                        : g.isSpriteMaterial
                          ? l(w, g)
                          : g.isShadowMaterial
                            ? (w.color.value.copy(g.color),
                              (w.opacity.value = g.opacity))
                            : g.isShaderMaterial && (g.uniformsNeedUpdate = !1);
  }
  function s(w, g) {
    ((w.opacity.value = g.opacity),
      g.color && w.diffuse.value.copy(g.color),
      g.emissive &&
        w.emissive.value.copy(g.emissive).multiplyScalar(g.emissiveIntensity),
      g.map && ((w.map.value = g.map), t(g.map, w.mapTransform)),
      g.alphaMap &&
        ((w.alphaMap.value = g.alphaMap), t(g.alphaMap, w.alphaMapTransform)),
      g.bumpMap &&
        ((w.bumpMap.value = g.bumpMap),
        t(g.bumpMap, w.bumpMapTransform),
        (w.bumpScale.value = g.bumpScale),
        g.side === me && (w.bumpScale.value *= -1)),
      g.normalMap &&
        ((w.normalMap.value = g.normalMap),
        t(g.normalMap, w.normalMapTransform),
        w.normalScale.value.copy(g.normalScale),
        g.side === me && w.normalScale.value.negate()),
      g.displacementMap &&
        ((w.displacementMap.value = g.displacementMap),
        t(g.displacementMap, w.displacementMapTransform),
        (w.displacementScale.value = g.displacementScale),
        (w.displacementBias.value = g.displacementBias)),
      g.emissiveMap &&
        ((w.emissiveMap.value = g.emissiveMap),
        t(g.emissiveMap, w.emissiveMapTransform)),
      g.specularMap &&
        ((w.specularMap.value = g.specularMap),
        t(g.specularMap, w.specularMapTransform)),
      g.alphaTest > 0 && (w.alphaTest.value = g.alphaTest));
    const y = e.get(g),
      b = y.envMap,
      A = y.envMapRotation;
    (b &&
      ((w.envMap.value = b),
      M3.copy(A),
      (M3.x *= -1),
      (M3.y *= -1),
      (M3.z *= -1),
      b.isCubeTexture &&
        b.isRenderTargetTexture === !1 &&
        ((M3.y *= -1), (M3.z *= -1)),
      w.envMapRotation.value.setFromMatrix4(MW.makeRotationFromEuler(M3)),
      (w.flipEnvMap.value =
        b.isCubeTexture && b.isRenderTargetTexture === !1 ? -1 : 1),
      (w.reflectivity.value = g.reflectivity),
      (w.ior.value = g.ior),
      (w.refractionRatio.value = g.refractionRatio)),
      g.lightMap &&
        ((w.lightMap.value = g.lightMap),
        (w.lightMapIntensity.value = g.lightMapIntensity),
        t(g.lightMap, w.lightMapTransform)),
      g.aoMap &&
        ((w.aoMap.value = g.aoMap),
        (w.aoMapIntensity.value = g.aoMapIntensity),
        t(g.aoMap, w.aoMapTransform)));
  }
  function o(w, g) {
    (w.diffuse.value.copy(g.color),
      (w.opacity.value = g.opacity),
      g.map && ((w.map.value = g.map), t(g.map, w.mapTransform)));
  }
  function a(w, g) {
    ((w.dashSize.value = g.dashSize),
      (w.totalSize.value = g.dashSize + g.gapSize),
      (w.scale.value = g.scale));
  }
  function c(w, g, y, b) {
    (w.diffuse.value.copy(g.color),
      (w.opacity.value = g.opacity),
      (w.size.value = g.size * y),
      (w.scale.value = b * 0.5),
      g.map && ((w.map.value = g.map), t(g.map, w.uvTransform)),
      g.alphaMap &&
        ((w.alphaMap.value = g.alphaMap), t(g.alphaMap, w.alphaMapTransform)),
      g.alphaTest > 0 && (w.alphaTest.value = g.alphaTest));
  }
  function l(w, g) {
    (w.diffuse.value.copy(g.color),
      (w.opacity.value = g.opacity),
      (w.rotation.value = g.rotation),
      g.map && ((w.map.value = g.map), t(g.map, w.mapTransform)),
      g.alphaMap &&
        ((w.alphaMap.value = g.alphaMap), t(g.alphaMap, w.alphaMapTransform)),
      g.alphaTest > 0 && (w.alphaTest.value = g.alphaTest));
  }
  function u(w, g) {
    (w.specular.value.copy(g.specular),
      (w.shininess.value = Math.max(g.shininess, 1e-4)));
  }
  function h(w, g) {
    g.gradientMap && (w.gradientMap.value = g.gradientMap);
  }
  function d(w, g) {
    ((w.metalness.value = g.metalness),
      g.metalnessMap &&
        ((w.metalnessMap.value = g.metalnessMap),
        t(g.metalnessMap, w.metalnessMapTransform)),
      (w.roughness.value = g.roughness),
      g.roughnessMap &&
        ((w.roughnessMap.value = g.roughnessMap),
        t(g.roughnessMap, w.roughnessMapTransform)),
      g.envMap && (w.envMapIntensity.value = g.envMapIntensity));
  }
  function f(w, g, y) {
    ((w.ior.value = g.ior),
      g.sheen > 0 &&
        (w.sheenColor.value.copy(g.sheenColor).multiplyScalar(g.sheen),
        (w.sheenRoughness.value = g.sheenRoughness),
        g.sheenColorMap &&
          ((w.sheenColorMap.value = g.sheenColorMap),
          t(g.sheenColorMap, w.sheenColorMapTransform)),
        g.sheenRoughnessMap &&
          ((w.sheenRoughnessMap.value = g.sheenRoughnessMap),
          t(g.sheenRoughnessMap, w.sheenRoughnessMapTransform))),
      g.clearcoat > 0 &&
        ((w.clearcoat.value = g.clearcoat),
        (w.clearcoatRoughness.value = g.clearcoatRoughness),
        g.clearcoatMap &&
          ((w.clearcoatMap.value = g.clearcoatMap),
          t(g.clearcoatMap, w.clearcoatMapTransform)),
        g.clearcoatRoughnessMap &&
          ((w.clearcoatRoughnessMap.value = g.clearcoatRoughnessMap),
          t(g.clearcoatRoughnessMap, w.clearcoatRoughnessMapTransform)),
        g.clearcoatNormalMap &&
          ((w.clearcoatNormalMap.value = g.clearcoatNormalMap),
          t(g.clearcoatNormalMap, w.clearcoatNormalMapTransform),
          w.clearcoatNormalScale.value.copy(g.clearcoatNormalScale),
          g.side === me && w.clearcoatNormalScale.value.negate())),
      g.dispersion > 0 && (w.dispersion.value = g.dispersion),
      g.iridescence > 0 &&
        ((w.iridescence.value = g.iridescence),
        (w.iridescenceIOR.value = g.iridescenceIOR),
        (w.iridescenceThicknessMinimum.value = g.iridescenceThicknessRange[0]),
        (w.iridescenceThicknessMaximum.value = g.iridescenceThicknessRange[1]),
        g.iridescenceMap &&
          ((w.iridescenceMap.value = g.iridescenceMap),
          t(g.iridescenceMap, w.iridescenceMapTransform)),
        g.iridescenceThicknessMap &&
          ((w.iridescenceThicknessMap.value = g.iridescenceThicknessMap),
          t(g.iridescenceThicknessMap, w.iridescenceThicknessMapTransform))),
      g.transmission > 0 &&
        ((w.transmission.value = g.transmission),
        (w.transmissionSamplerMap.value = y.texture),
        w.transmissionSamplerSize.value.set(y.width, y.height),
        g.transmissionMap &&
          ((w.transmissionMap.value = g.transmissionMap),
          t(g.transmissionMap, w.transmissionMapTransform)),
        (w.thickness.value = g.thickness),
        g.thicknessMap &&
          ((w.thicknessMap.value = g.thicknessMap),
          t(g.thicknessMap, w.thicknessMapTransform)),
        (w.attenuationDistance.value = g.attenuationDistance),
        w.attenuationColor.value.copy(g.attenuationColor)),
      g.anisotropy > 0 &&
        (w.anisotropyVector.value.set(
          g.anisotropy * Math.cos(g.anisotropyRotation),
          g.anisotropy * Math.sin(g.anisotropyRotation),
        ),
        g.anisotropyMap &&
          ((w.anisotropyMap.value = g.anisotropyMap),
          t(g.anisotropyMap, w.anisotropyMapTransform))),
      (w.specularIntensity.value = g.specularIntensity),
      w.specularColor.value.copy(g.specularColor),
      g.specularColorMap &&
        ((w.specularColorMap.value = g.specularColorMap),
        t(g.specularColorMap, w.specularColorMapTransform)),
      g.specularIntensityMap &&
        ((w.specularIntensityMap.value = g.specularIntensityMap),
        t(g.specularIntensityMap, w.specularIntensityMapTransform)));
  }
  function p(w, g) {
    g.matcap && (w.matcap.value = g.matcap);
  }
  function v(w, g) {
    const y = e.get(g).light;
    (w.referencePosition.value.setFromMatrixPosition(y.matrixWorld),
      (w.nearDistance.value = y.shadow.camera.near),
      (w.farDistance.value = y.shadow.camera.far));
  }
  return { refreshFogUniforms: i, refreshMaterialUniforms: r };
}
function SW(n, e, t, i) {
  let r = {},
    s = {},
    o = [];
  const a = n.getParameter(n.MAX_UNIFORM_BUFFER_BINDINGS);
  function c(y, b) {
    const A = b.program;
    i.uniformBlockBinding(y, A);
  }
  function l(y, b) {
    let A = r[y.id];
    A === void 0 &&
      (p(y), (A = u(y)), (r[y.id] = A), y.addEventListener("dispose", w));
    const x = b.program;
    i.updateUBOMapping(y, x);
    const M = e.render.frame;
    s[y.id] !== M && (d(y), (s[y.id] = M));
  }
  function u(y) {
    const b = h();
    y.__bindingPointIndex = b;
    const A = n.createBuffer(),
      x = y.__size,
      M = y.usage;
    return (
      n.bindBuffer(n.UNIFORM_BUFFER, A),
      n.bufferData(n.UNIFORM_BUFFER, x, M),
      n.bindBuffer(n.UNIFORM_BUFFER, null),
      n.bindBufferBase(n.UNIFORM_BUFFER, b, A),
      A
    );
  }
  function h() {
    for (let y = 0; y < a; y++) if (o.indexOf(y) === -1) return (o.push(y), y);
    return (
      console.error(
        "THREE.WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached.",
      ),
      0
    );
  }
  function d(y) {
    const b = r[y.id],
      A = y.uniforms,
      x = y.__cache;
    n.bindBuffer(n.UNIFORM_BUFFER, b);
    for (let M = 0, E = A.length; M < E; M++) {
      const _ = Array.isArray(A[M]) ? A[M] : [A[M]];
      for (let C = 0, S = _.length; C < S; C++) {
        const G = _[C];
        if (f(G, M, C, x) === !0) {
          const I = G.__offset,
            L = Array.isArray(G.value) ? G.value : [G.value];
          let k = 0;
          for (let D = 0; D < L.length; D++) {
            const V = L[D],
              K = v(V);
            typeof V == "number" || typeof V == "boolean"
              ? ((G.__data[0] = V),
                n.bufferSubData(n.UNIFORM_BUFFER, I + k, G.__data))
              : V.isMatrix3
                ? ((G.__data[0] = V.elements[0]),
                  (G.__data[1] = V.elements[1]),
                  (G.__data[2] = V.elements[2]),
                  (G.__data[3] = 0),
                  (G.__data[4] = V.elements[3]),
                  (G.__data[5] = V.elements[4]),
                  (G.__data[6] = V.elements[5]),
                  (G.__data[7] = 0),
                  (G.__data[8] = V.elements[6]),
                  (G.__data[9] = V.elements[7]),
                  (G.__data[10] = V.elements[8]),
                  (G.__data[11] = 0))
                : (V.toArray(G.__data, k),
                  (k += K.storage / Float32Array.BYTES_PER_ELEMENT));
          }
          n.bufferSubData(n.UNIFORM_BUFFER, I, G.__data);
        }
      }
    }
    n.bindBuffer(n.UNIFORM_BUFFER, null);
  }
  function f(y, b, A, x) {
    const M = y.value,
      E = b + "_" + A;
    if (x[E] === void 0)
      return (
        typeof M == "number" || typeof M == "boolean"
          ? (x[E] = M)
          : (x[E] = M.clone()),
        !0
      );
    {
      const _ = x[E];
      if (typeof M == "number" || typeof M == "boolean") {
        if (_ !== M) return ((x[E] = M), !0);
      } else if (_.equals(M) === !1) return (_.copy(M), !0);
    }
    return !1;
  }
  function p(y) {
    const b = y.uniforms;
    let A = 0;
    const x = 16;
    for (let E = 0, _ = b.length; E < _; E++) {
      const C = Array.isArray(b[E]) ? b[E] : [b[E]];
      for (let S = 0, G = C.length; S < G; S++) {
        const I = C[S],
          L = Array.isArray(I.value) ? I.value : [I.value];
        for (let k = 0, D = L.length; k < D; k++) {
          const V = L[k],
            K = v(V),
            P = A % x,
            q = P % K.boundary,
            e0 = P + q;
          ((A += q),
            e0 !== 0 && x - e0 < K.storage && (A += x - e0),
            (I.__data = new Float32Array(
              K.storage / Float32Array.BYTES_PER_ELEMENT,
            )),
            (I.__offset = A),
            (A += K.storage));
        }
      }
    }
    const M = A % x;
    return (M > 0 && (A += x - M), (y.__size = A), (y.__cache = {}), this);
  }
  function v(y) {
    const b = { boundary: 0, storage: 0 };
    return (
      typeof y == "number" || typeof y == "boolean"
        ? ((b.boundary = 4), (b.storage = 4))
        : y.isVector2
          ? ((b.boundary = 8), (b.storage = 8))
          : y.isVector3 || y.isColor
            ? ((b.boundary = 16), (b.storage = 12))
            : y.isVector4
              ? ((b.boundary = 16), (b.storage = 16))
              : y.isMatrix3
                ? ((b.boundary = 48), (b.storage = 48))
                : y.isMatrix4
                  ? ((b.boundary = 64), (b.storage = 64))
                  : y.isTexture
                    ? console.warn(
                        "THREE.WebGLRenderer: Texture samplers can not be part of an uniforms group.",
                      )
                    : console.warn(
                        "THREE.WebGLRenderer: Unsupported uniform value type.",
                        y,
                      ),
      b
    );
  }
  function w(y) {
    const b = y.target;
    b.removeEventListener("dispose", w);
    const A = o.indexOf(b.__bindingPointIndex);
    (o.splice(A, 1), n.deleteBuffer(r[b.id]), delete r[b.id], delete s[b.id]);
  }
  function g() {
    for (const y in r) n.deleteBuffer(r[y]);
    ((o = []), (r = {}), (s = {}));
  }
  return { bind: c, update: l, dispose: g };
}
class I4 {
  constructor(e = {}) {
    const {
      canvas: t = JV(),
      context: i = null,
      depth: r = !0,
      stencil: s = !1,
      alpha: o = !1,
      antialias: a = !1,
      premultipliedAlpha: c = !0,
      preserveDrawingBuffer: l = !1,
      powerPreference: u = "default",
      failIfMajorPerformanceCaveat: h = !1,
      reverseDepthBuffer: d = !1,
    } = e;
    this.isWebGLRenderer = !0;
    let f;
    if (i !== null) {
      if (
        typeof WebGLRenderingContext < "u" &&
        i instanceof WebGLRenderingContext
      )
        throw new Error(
          "THREE.WebGLRenderer: WebGL 1 is not supported since r163.",
        );
      f = i.getContextAttributes().alpha;
    } else f = o;
    const p = new Uint32Array(4),
      v = new Int32Array(4);
    let w = null,
      g = null;
    const y = [],
      b = [];
    ((this.domElement = t),
      (this.debug = { checkShaderErrors: !0, onShaderError: null }),
      (this.autoClear = !0),
      (this.autoClearColor = !0),
      (this.autoClearDepth = !0),
      (this.autoClearStencil = !0),
      (this.sortObjects = !0),
      (this.clippingPlanes = []),
      (this.localClippingEnabled = !1),
      (this.toneMapping = Jn),
      (this.toneMappingExposure = 1),
      (this.transmissionResolutionScale = 1));
    const A = this;
    let x = !1;
    this._outputColorSpace = Fe;
    let M = 0,
      E = 0,
      _ = null,
      C = -1,
      S = null;
    const G = new Y2(),
      I = new Y2();
    let L = null;
    const k = new r9(0);
    let D = 0,
      V = t.width,
      K = t.height,
      P = 1,
      q = null,
      e0 = null;
    const Q = new Y2(0, 0, V, K),
      U = new Y2(0, 0, V, K);
    let O = !1;
    const F = new BG();
    let z = !1,
      Y = !1;
    const X = new v2(),
      l0 = new v2(),
      r0 = new H(),
      j = new Y2(),
      F0 = {
        background: null,
        fog: null,
        environment: null,
        overrideMaterial: null,
        isScene: !0,
      };
    let O0 = !1;
    function z0() {
      return _ === null ? P : 1;
    }
    let W = i;
    function R2(N, i0) {
      return t.getContext(N, i0);
    }
    try {
      const N = {
        alpha: !0,
        depth: r,
        stencil: s,
        antialias: a,
        premultipliedAlpha: c,
        preserveDrawingBuffer: l,
        powerPreference: u,
        failIfMajorPerformanceCaveat: h,
      };
      if (
        ("setAttribute" in t &&
          t.setAttribute("data-engine", `three.js r${vm}`),
        t.addEventListener("webglcontextlost", $0, !1),
        t.addEventListener("webglcontextrestored", M0, !1),
        t.addEventListener("webglcontextcreationerror", g0, !1),
        W === null)
      ) {
        const i0 = "webgl2";
        if (((W = R2(i0, N)), W === null))
          throw R2(i0)
            ? new Error(
                "Error creating WebGL context with your selected attributes.",
              )
            : new Error("Error creating WebGL context.");
      }
    } catch (N) {
      throw (console.error("THREE.WebGLRenderer: " + N.message), N);
    }
    let I0,
      o2,
      G0,
      D0,
      E0,
      f2,
      O2,
      B,
      R,
      $,
      o0,
      u0,
      c0,
      x0,
      C0,
      S0,
      U0,
      m0,
      q0,
      t2,
      Z0,
      B0,
      r2,
      Z;
    function N0() {
      ((I0 = new PU(W)),
        I0.init(),
        (B0 = new wW(W, I0)),
        (o2 = new _U(W, I0, e, B0)),
        (G0 = new gW(W, I0)),
        o2.reverseDepthBuffer && d && G0.buffers.depth.setReversed(!0),
        (D0 = new VU(W)),
        (E0 = new nW()),
        (f2 = new mW(W, I0, G0, E0, o2, B0, D0)),
        (O2 = new BU(A)),
        (B = new LU(A)),
        (R = new WN(W)),
        (r2 = new EU(W, R)),
        ($ = new FU(W, R, D0, r2)),
        (o0 = new OU(W, $, R, D0)),
        (q0 = new NU(W, o2, f2)),
        (S0 = new GU(E0)),
        (u0 = new tW(A, O2, B, I0, o2, r2, S0)),
        (c0 = new xW(A, E0)),
        (x0 = new rW()),
        (C0 = new uW(I0)),
        (m0 = new CU(A, O2, B, G0, o0, f, c)),
        (U0 = new fW(A, o0, o2)),
        (Z = new SW(W, D0, o2, G0)),
        (t2 = new TU(W, I0, D0)),
        (Z0 = new DU(W, I0, D0)),
        (D0.programs = u0.programs),
        (A.capabilities = o2),
        (A.extensions = I0),
        (A.properties = E0),
        (A.renderLists = x0),
        (A.shadowMap = U0),
        (A.state = G0),
        (A.info = D0));
    }
    N0();
    const b0 = new bW(A, W);
    ((this.xr = b0),
      (this.getContext = function () {
        return W;
      }),
      (this.getContextAttributes = function () {
        return W.getContextAttributes();
      }),
      (this.forceContextLoss = function () {
        const N = I0.get("WEBGL_lose_context");
        N && N.loseContext();
      }),
      (this.forceContextRestore = function () {
        const N = I0.get("WEBGL_lose_context");
        N && N.restoreContext();
      }),
      (this.getPixelRatio = function () {
        return P;
      }),
      (this.setPixelRatio = function (N) {
        N !== void 0 && ((P = N), this.setSize(V, K, !1));
      }),
      (this.getSize = function (N) {
        return N.set(V, K);
      }),
      (this.setSize = function (N, i0, h0 = !0) {
        if (b0.isPresenting) {
          console.warn(
            "THREE.WebGLRenderer: Can't change size while VR device is presenting.",
          );
          return;
        }
        ((V = N),
          (K = i0),
          (t.width = Math.floor(N * P)),
          (t.height = Math.floor(i0 * P)),
          h0 === !0 &&
            ((t.style.width = N + "px"), (t.style.height = i0 + "px")),
          this.setViewport(0, 0, N, i0));
      }),
      (this.getDrawingBufferSize = function (N) {
        return N.set(V * P, K * P).floor();
      }),
      (this.setDrawingBufferSize = function (N, i0, h0) {
        ((V = N),
          (K = i0),
          (P = h0),
          (t.width = Math.floor(N * h0)),
          (t.height = Math.floor(i0 * h0)),
          this.setViewport(0, 0, N, i0));
      }),
      (this.getCurrentViewport = function (N) {
        return N.copy(G);
      }),
      (this.getViewport = function (N) {
        return N.copy(Q);
      }),
      (this.setViewport = function (N, i0, h0, d0) {
        (N.isVector4 ? Q.set(N.x, N.y, N.z, N.w) : Q.set(N, i0, h0, d0),
          G0.viewport(G.copy(Q).multiplyScalar(P).round()));
      }),
      (this.getScissor = function (N) {
        return N.copy(U);
      }),
      (this.setScissor = function (N, i0, h0, d0) {
        (N.isVector4 ? U.set(N.x, N.y, N.z, N.w) : U.set(N, i0, h0, d0),
          G0.scissor(I.copy(U).multiplyScalar(P).round()));
      }),
      (this.getScissorTest = function () {
        return O;
      }),
      (this.setScissorTest = function (N) {
        G0.setScissorTest((O = N));
      }),
      (this.setOpaqueSort = function (N) {
        q = N;
      }),
      (this.setTransparentSort = function (N) {
        e0 = N;
      }),
      (this.getClearColor = function (N) {
        return N.copy(m0.getClearColor());
      }),
      (this.setClearColor = function () {
        m0.setClearColor(...arguments);
      }),
      (this.getClearAlpha = function () {
        return m0.getClearAlpha();
      }),
      (this.setClearAlpha = function () {
        m0.setClearAlpha(...arguments);
      }),
      (this.clear = function (N = !0, i0 = !0, h0 = !0) {
        let d0 = 0;
        if (N) {
          let s0 = !1;
          if (_ !== null) {
            const T0 = _.texture.format;
            s0 = T0 === Rm || T0 === Bm || T0 === Gm;
          }
          if (s0) {
            const T0 = _.texture.type,
              X0 =
                T0 === _9 ||
                T0 === A4 ||
                T0 === lo ||
                T0 === uo ||
                T0 === Tm ||
                T0 === _m,
              c2 = m0.getClearColor(),
              n2 = m0.getClearAlpha(),
              k2 = c2.r,
              V2 = c2.g,
              b2 = c2.b;
            X0
              ? ((p[0] = k2),
                (p[1] = V2),
                (p[2] = b2),
                (p[3] = n2),
                W.clearBufferuiv(W.COLOR, 0, p))
              : ((v[0] = k2),
                (v[1] = V2),
                (v[2] = b2),
                (v[3] = n2),
                W.clearBufferiv(W.COLOR, 0, v));
          } else d0 |= W.COLOR_BUFFER_BIT;
        }
        (i0 && (d0 |= W.DEPTH_BUFFER_BIT),
          h0 &&
            ((d0 |= W.STENCIL_BUFFER_BIT),
            this.state.buffers.stencil.setMask(4294967295)),
          W.clear(d0));
      }),
      (this.clearColor = function () {
        this.clear(!0, !1, !1);
      }),
      (this.clearDepth = function () {
        this.clear(!1, !0, !1);
      }),
      (this.clearStencil = function () {
        this.clear(!1, !1, !0);
      }),
      (this.dispose = function () {
        (t.removeEventListener("webglcontextlost", $0, !1),
          t.removeEventListener("webglcontextrestored", M0, !1),
          t.removeEventListener("webglcontextcreationerror", g0, !1),
          m0.dispose(),
          x0.dispose(),
          C0.dispose(),
          E0.dispose(),
          O2.dispose(),
          B.dispose(),
          o0.dispose(),
          r2.dispose(),
          Z.dispose(),
          u0.dispose(),
          b0.dispose(),
          b0.removeEventListener("sessionstart", zy),
          b0.removeEventListener("sessionend", Uy),
          g3.stop());
      }));
    function $0(N) {
      (N.preventDefault(),
        console.log("THREE.WebGLRenderer: Context Lost."),
        (x = !0));
    }
    function M0() {
      (console.log("THREE.WebGLRenderer: Context Restored."), (x = !1));
      const N = D0.autoReset,
        i0 = U0.enabled,
        h0 = U0.autoUpdate,
        d0 = U0.needsUpdate,
        s0 = U0.type;
      (N0(),
        (D0.autoReset = N),
        (U0.enabled = i0),
        (U0.autoUpdate = h0),
        (U0.needsUpdate = d0),
        (U0.type = s0));
    }
    function g0(N) {
      console.error(
        "THREE.WebGLRenderer: A WebGL context could not be created. Reason: ",
        N.statusMessage,
      );
    }
    function a2(N) {
      const i0 = N.target;
      (i0.removeEventListener("dispose", a2), U2(i0));
    }
    function U2(N) {
      ($9(N), E0.remove(N));
    }
    function $9(N) {
      const i0 = E0.get(N).programs;
      i0 !== void 0 &&
        (i0.forEach(function (h0) {
          u0.releaseProgram(h0);
        }),
        N.isShaderMaterial && u0.releaseShaderCache(N));
    }
    this.renderBufferDirect = function (N, i0, h0, d0, s0, T0) {
      i0 === null && (i0 = F0);
      const X0 = s0.isMesh && s0.matrixWorld.determinant() < 0,
        c2 = QD(N, i0, h0, d0, s0);
      G0.setMaterial(d0, X0);
      let n2 = h0.index,
        k2 = 1;
      if (d0.wireframe === !0) {
        if (((n2 = $.getWireframeAttribute(h0)), n2 === void 0)) return;
        k2 = 2;
      }
      const V2 = h0.drawRange,
        b2 = h0.attributes.position;
      let Z2 = V2.start * k2,
        G9 = (V2.start + V2.count) * k2;
      (T0 !== null &&
        ((Z2 = Math.max(Z2, T0.start * k2)),
        (G9 = Math.min(G9, (T0.start + T0.count) * k2))),
        n2 !== null
          ? ((Z2 = Math.max(Z2, 0)), (G9 = Math.min(G9, n2.count)))
          : b2 != null &&
            ((Z2 = Math.max(Z2, 0)), (G9 = Math.min(G9, b2.count))));
      const o1 = G9 - Z2;
      if (o1 < 0 || o1 === 1 / 0) return;
      r2.setup(s0, d0, c2, h0, n2);
      let W9,
        I9 = t2;
      if (
        (n2 !== null && ((W9 = R.get(n2)), (I9 = Z0), I9.setIndex(W9)),
        s0.isMesh)
      )
        d0.wireframe === !0
          ? (G0.setLineWidth(d0.wireframeLinewidth * z0()), I9.setMode(W.LINES))
          : I9.setMode(W.TRIANGLES);
      else if (s0.isLine) {
        let S2 = d0.linewidth;
        (S2 === void 0 && (S2 = 1),
          G0.setLineWidth(S2 * z0()),
          s0.isLineSegments
            ? I9.setMode(W.LINES)
            : s0.isLineLoop
              ? I9.setMode(W.LINE_LOOP)
              : I9.setMode(W.LINE_STRIP));
      } else
        s0.isPoints
          ? I9.setMode(W.POINTS)
          : s0.isSprite && I9.setMode(W.TRIANGLES);
      if (s0.isBatchedMesh)
        if (s0._multiDrawInstances !== null)
          (qi(
            "THREE.WebGLRenderer: renderMultiDrawInstances has been deprecated and will be removed in r184. Append to renderMultiDraw arguments and use indirection.",
          ),
            I9.renderMultiDrawInstances(
              s0._multiDrawStarts,
              s0._multiDrawCounts,
              s0._multiDrawCount,
              s0._multiDrawInstances,
            ));
        else if (I0.get("WEBGL_multi_draw"))
          I9.renderMultiDraw(
            s0._multiDrawStarts,
            s0._multiDrawCounts,
            s0._multiDrawCount,
          );
        else {
          const S2 = s0._multiDrawStarts,
            e1 = s0._multiDrawCounts,
            d9 = s0._multiDrawCount,
            Se = n2 ? R.get(n2).bytesPerElement : 1,
            V4 = E0.get(d0).currentProgram.getUniforms();
          for (let Ce = 0; Ce < d9; Ce++)
            (V4.setValue(W, "_gl_DrawID", Ce), I9.render(S2[Ce] / Se, e1[Ce]));
        }
      else if (s0.isInstancedMesh) I9.renderInstances(Z2, o1, s0.count);
      else if (h0.isInstancedBufferGeometry) {
        const S2 =
            h0._maxInstanceCount !== void 0 ? h0._maxInstanceCount : 1 / 0,
          e1 = Math.min(h0.instanceCount, S2);
        I9.renderInstances(Z2, o1, e1);
      } else I9.render(Z2, o1);
    };
    function A9(N, i0, h0) {
      N.transparent === !0 && N.side === s1 && N.forceSinglePass === !1
        ? ((N.side = me),
          (N.needsUpdate = !0),
          Fa(N, i0, h0),
          (N.side = tn),
          (N.needsUpdate = !0),
          Fa(N, i0, h0),
          (N.side = s1))
        : Fa(N, i0, h0);
    }
    ((this.compile = function (N, i0, h0 = null) {
      (h0 === null && (h0 = N),
        (g = C0.get(h0)),
        g.init(i0),
        b.push(g),
        h0.traverseVisible(function (s0) {
          s0.isLight &&
            s0.layers.test(i0.layers) &&
            (g.pushLight(s0), s0.castShadow && g.pushShadow(s0));
        }),
        N !== h0 &&
          N.traverseVisible(function (s0) {
            s0.isLight &&
              s0.layers.test(i0.layers) &&
              (g.pushLight(s0), s0.castShadow && g.pushShadow(s0));
          }),
        g.setupLights());
      const d0 = new Set();
      return (
        N.traverse(function (s0) {
          if (!(s0.isMesh || s0.isPoints || s0.isLine || s0.isSprite)) return;
          const T0 = s0.material;
          if (T0)
            if (Array.isArray(T0))
              for (let X0 = 0; X0 < T0.length; X0++) {
                const c2 = T0[X0];
                (A9(c2, h0, s0), d0.add(c2));
              }
            else (A9(T0, h0, s0), d0.add(T0));
        }),
        (g = b.pop()),
        d0
      );
    }),
      (this.compileAsync = function (N, i0, h0 = null) {
        const d0 = this.compile(N, i0, h0);
        return new Promise((s0) => {
          function T0() {
            if (
              (d0.forEach(function (X0) {
                E0.get(X0).currentProgram.isReady() && d0.delete(X0);
              }),
              d0.size === 0)
            ) {
              s0(N);
              return;
            }
            setTimeout(T0, 10);
          }
          I0.get("KHR_parallel_shader_compile") !== null
            ? T0()
            : setTimeout(T0, 10);
        });
      }));
    let ft = null;
    function g5(N) {
      ft && ft(N);
    }
    function zy() {
      g3.stop();
    }
    function Uy() {
      g3.start();
    }
    const g3 = new kG();
    (g3.setAnimationLoop(g5),
      typeof self < "u" && g3.setContext(self),
      (this.setAnimationLoop = function (N) {
        ((ft = N), b0.setAnimationLoop(N), N === null ? g3.stop() : g3.start());
      }),
      b0.addEventListener("sessionstart", zy),
      b0.addEventListener("sessionend", Uy),
      (this.render = function (N, i0) {
        if (i0 !== void 0 && i0.isCamera !== !0) {
          console.error(
            "THREE.WebGLRenderer.render: camera is not an instance of THREE.Camera.",
          );
          return;
        }
        if (x === !0) return;
        if (
          (N.matrixWorldAutoUpdate === !0 && N.updateMatrixWorld(),
          i0.parent === null &&
            i0.matrixWorldAutoUpdate === !0 &&
            i0.updateMatrixWorld(),
          b0.enabled === !0 &&
            b0.isPresenting === !0 &&
            (b0.cameraAutoUpdate === !0 && b0.updateCamera(i0),
            (i0 = b0.getCamera())),
          N.isScene === !0 && N.onBeforeRender(A, N, i0, _),
          (g = C0.get(N, b.length)),
          g.init(i0),
          b.push(g),
          l0.multiplyMatrices(i0.projectionMatrix, i0.matrixWorldInverse),
          F.setFromProjectionMatrix(l0),
          (Y = this.localClippingEnabled),
          (z = S0.init(this.clippingPlanes, Y)),
          (w = x0.get(N, y.length)),
          w.init(),
          y.push(w),
          b0.enabled === !0 && b0.isPresenting === !0)
        ) {
          const T0 = A.xr.getDepthSensingMesh();
          T0 !== null && F7(T0, i0, -1 / 0, A.sortObjects);
        }
        (F7(N, i0, 0, A.sortObjects),
          w.finish(),
          A.sortObjects === !0 && w.sort(q, e0),
          (O0 =
            b0.enabled === !1 ||
            b0.isPresenting === !1 ||
            b0.hasDepthSensing() === !1),
          O0 && m0.addToRenderList(w, N),
          this.info.render.frame++,
          z === !0 && S0.beginShadows());
        const h0 = g.state.shadowsArray;
        (U0.render(h0, N, i0),
          z === !0 && S0.endShadows(),
          this.info.autoReset === !0 && this.info.reset());
        const d0 = w.opaque,
          s0 = w.transmissive;
        if ((g.setupLights(), i0.isArrayCamera)) {
          const T0 = i0.cameras;
          if (s0.length > 0)
            for (let X0 = 0, c2 = T0.length; X0 < c2; X0++) {
              const n2 = T0[X0];
              Wy(d0, s0, N, n2);
            }
          O0 && m0.render(N);
          for (let X0 = 0, c2 = T0.length; X0 < c2; X0++) {
            const n2 = T0[X0];
            $y(w, N, n2, n2.viewport);
          }
        } else
          (s0.length > 0 && Wy(d0, s0, N, i0),
            O0 && m0.render(N),
            $y(w, N, i0));
        (_ !== null &&
          E === 0 &&
          (f2.updateMultisampleRenderTarget(_), f2.updateRenderTargetMipmap(_)),
          N.isScene === !0 && N.onAfterRender(A, N, i0),
          r2.resetDefaultState(),
          (C = -1),
          (S = null),
          b.pop(),
          b.length > 0
            ? ((g = b[b.length - 1]),
              z === !0 && S0.setGlobalState(A.clippingPlanes, g.state.camera))
            : (g = null),
          y.pop(),
          y.length > 0 ? (w = y[y.length - 1]) : (w = null));
      }));
    function F7(N, i0, h0, d0) {
      if (N.visible === !1) return;
      if (N.layers.test(i0.layers)) {
        if (N.isGroup) h0 = N.renderOrder;
        else if (N.isLOD) N.autoUpdate === !0 && N.update(i0);
        else if (N.isLight) (g.pushLight(N), N.castShadow && g.pushShadow(N));
        else if (N.isSprite) {
          if (!N.frustumCulled || F.intersectsSprite(N)) {
            d0 && j.setFromMatrixPosition(N.matrixWorld).applyMatrix4(l0);
            const X0 = o0.update(N),
              c2 = N.material;
            c2.visible && w.push(N, X0, c2, h0, j.z, null);
          }
        } else if (
          (N.isMesh || N.isLine || N.isPoints) &&
          (!N.frustumCulled || F.intersectsObject(N))
        ) {
          const X0 = o0.update(N),
            c2 = N.material;
          if (
            (d0 &&
              (N.boundingSphere !== void 0
                ? (N.boundingSphere === null && N.computeBoundingSphere(),
                  j.copy(N.boundingSphere.center))
                : (X0.boundingSphere === null && X0.computeBoundingSphere(),
                  j.copy(X0.boundingSphere.center)),
              j.applyMatrix4(N.matrixWorld).applyMatrix4(l0)),
            Array.isArray(c2))
          ) {
            const n2 = X0.groups;
            for (let k2 = 0, V2 = n2.length; k2 < V2; k2++) {
              const b2 = n2[k2],
                Z2 = c2[b2.materialIndex];
              Z2 && Z2.visible && w.push(N, X0, Z2, h0, j.z, b2);
            }
          } else c2.visible && w.push(N, X0, c2, h0, j.z, null);
        }
      }
      const T0 = N.children;
      for (let X0 = 0, c2 = T0.length; X0 < c2; X0++) F7(T0[X0], i0, h0, d0);
    }
    function $y(N, i0, h0, d0) {
      const s0 = N.opaque,
        T0 = N.transmissive,
        X0 = N.transparent;
      (g.setupLightsView(h0),
        z === !0 && S0.setGlobalState(A.clippingPlanes, h0),
        d0 && G0.viewport(G.copy(d0)),
        s0.length > 0 && Pa(s0, i0, h0),
        T0.length > 0 && Pa(T0, i0, h0),
        X0.length > 0 && Pa(X0, i0, h0),
        G0.buffers.depth.setTest(!0),
        G0.buffers.depth.setMask(!0),
        G0.buffers.color.setMask(!0),
        G0.setPolygonOffset(!1));
    }
    function Wy(N, i0, h0, d0) {
      if ((h0.isScene === !0 ? h0.overrideMaterial : null) !== null) return;
      g.state.transmissionRenderTarget[d0.id] === void 0 &&
        (g.state.transmissionRenderTarget[d0.id] = new nn(1, 1, {
          generateMipmaps: !0,
          type:
            I0.has("EXT_color_buffer_half_float") ||
            I0.has("EXT_color_buffer_float")
              ? sa
              : _9,
          minFilter: e5,
          samples: 4,
          stencilBuffer: s,
          resolveDepthBuffer: !1,
          resolveStencilBuffer: !1,
          colorSpace: f9.workingColorSpace,
        }));
      const T0 = g.state.transmissionRenderTarget[d0.id],
        X0 = d0.viewport || G;
      T0.setSize(
        X0.z * A.transmissionResolutionScale,
        X0.w * A.transmissionResolutionScale,
      );
      const c2 = A.getRenderTarget(),
        n2 = A.getActiveCubeFace(),
        k2 = A.getActiveMipmapLevel();
      (A.setRenderTarget(T0),
        A.getClearColor(k),
        (D = A.getClearAlpha()),
        D < 1 && A.setClearColor(16777215, 0.5),
        A.clear(),
        O0 && m0.render(h0));
      const V2 = A.toneMapping;
      A.toneMapping = Jn;
      const b2 = d0.viewport;
      if (
        (d0.viewport !== void 0 && (d0.viewport = void 0),
        g.setupLightsView(d0),
        z === !0 && S0.setGlobalState(A.clippingPlanes, d0),
        Pa(N, h0, d0),
        f2.updateMultisampleRenderTarget(T0),
        f2.updateRenderTargetMipmap(T0),
        I0.has("WEBGL_multisampled_render_to_texture") === !1)
      ) {
        let Z2 = !1;
        for (let G9 = 0, o1 = i0.length; G9 < o1; G9++) {
          const W9 = i0[G9],
            I9 = W9.object,
            S2 = W9.geometry,
            e1 = W9.material,
            d9 = W9.group;
          if (e1.side === s1 && I9.layers.test(d0.layers)) {
            const Se = e1.side;
            ((e1.side = me),
              (e1.needsUpdate = !0),
              Hy(I9, h0, d0, S2, e1, d9),
              (e1.side = Se),
              (e1.needsUpdate = !0),
              (Z2 = !0));
          }
        }
        Z2 === !0 &&
          (f2.updateMultisampleRenderTarget(T0),
          f2.updateRenderTargetMipmap(T0));
      }
      (A.setRenderTarget(c2, n2, k2),
        A.setClearColor(k, D),
        b2 !== void 0 && (d0.viewport = b2),
        (A.toneMapping = V2));
    }
    function Pa(N, i0, h0) {
      const d0 = i0.isScene === !0 ? i0.overrideMaterial : null;
      for (let s0 = 0, T0 = N.length; s0 < T0; s0++) {
        const X0 = N[s0],
          c2 = X0.object,
          n2 = X0.geometry,
          k2 = X0.group;
        let V2 = X0.material;
        (V2.allowOverride === !0 && d0 !== null && (V2 = d0),
          c2.layers.test(h0.layers) && Hy(c2, i0, h0, n2, V2, k2));
      }
    }
    function Hy(N, i0, h0, d0, s0, T0) {
      (N.onBeforeRender(A, i0, h0, d0, s0, T0),
        N.modelViewMatrix.multiplyMatrices(
          h0.matrixWorldInverse,
          N.matrixWorld,
        ),
        N.normalMatrix.getNormalMatrix(N.modelViewMatrix),
        s0.onBeforeRender(A, i0, h0, d0, N, T0),
        s0.transparent === !0 && s0.side === s1 && s0.forceSinglePass === !1
          ? ((s0.side = me),
            (s0.needsUpdate = !0),
            A.renderBufferDirect(h0, i0, d0, s0, N, T0),
            (s0.side = tn),
            (s0.needsUpdate = !0),
            A.renderBufferDirect(h0, i0, d0, s0, N, T0),
            (s0.side = s1))
          : A.renderBufferDirect(h0, i0, d0, s0, N, T0),
        N.onAfterRender(A, i0, h0, d0, s0, T0));
    }
    function Fa(N, i0, h0) {
      i0.isScene !== !0 && (i0 = F0);
      const d0 = E0.get(N),
        s0 = g.state.lights,
        T0 = g.state.shadowsArray,
        X0 = s0.state.version,
        c2 = u0.getParameters(N, s0.state, T0, i0, h0),
        n2 = u0.getProgramCacheKey(c2);
      let k2 = d0.programs;
      ((d0.environment = N.isMeshStandardMaterial ? i0.environment : null),
        (d0.fog = i0.fog),
        (d0.envMap = (N.isMeshStandardMaterial ? B : O2).get(
          N.envMap || d0.environment,
        )),
        (d0.envMapRotation =
          d0.environment !== null && N.envMap === null
            ? i0.environmentRotation
            : N.envMapRotation),
        k2 === void 0 &&
          (N.addEventListener("dispose", a2),
          (k2 = new Map()),
          (d0.programs = k2)));
      let V2 = k2.get(n2);
      if (V2 !== void 0) {
        if (d0.currentProgram === V2 && d0.lightsStateVersion === X0)
          return (Ky(N, c2), V2);
      } else
        ((c2.uniforms = u0.getUniforms(N)),
          N.onBeforeCompile(c2, A),
          (V2 = u0.acquireProgram(c2, n2)),
          k2.set(n2, V2),
          (d0.uniforms = c2.uniforms));
      const b2 = d0.uniforms;
      return (
        ((!N.isShaderMaterial && !N.isRawShaderMaterial) ||
          N.clipping === !0) &&
          (b2.clippingPlanes = S0.uniform),
        Ky(N, c2),
        (d0.needsLights = eV(N)),
        (d0.lightsStateVersion = X0),
        d0.needsLights &&
          ((b2.ambientLightColor.value = s0.state.ambient),
          (b2.lightProbe.value = s0.state.probe),
          (b2.directionalLights.value = s0.state.directional),
          (b2.directionalLightShadows.value = s0.state.directionalShadow),
          (b2.spotLights.value = s0.state.spot),
          (b2.spotLightShadows.value = s0.state.spotShadow),
          (b2.rectAreaLights.value = s0.state.rectArea),
          (b2.ltc_1.value = s0.state.rectAreaLTC1),
          (b2.ltc_2.value = s0.state.rectAreaLTC2),
          (b2.pointLights.value = s0.state.point),
          (b2.pointLightShadows.value = s0.state.pointShadow),
          (b2.hemisphereLights.value = s0.state.hemi),
          (b2.directionalShadowMap.value = s0.state.directionalShadowMap),
          (b2.directionalShadowMatrix.value = s0.state.directionalShadowMatrix),
          (b2.spotShadowMap.value = s0.state.spotShadowMap),
          (b2.spotLightMatrix.value = s0.state.spotLightMatrix),
          (b2.spotLightMap.value = s0.state.spotLightMap),
          (b2.pointShadowMap.value = s0.state.pointShadowMap),
          (b2.pointShadowMatrix.value = s0.state.pointShadowMatrix)),
        (d0.currentProgram = V2),
        (d0.uniformsList = null),
        V2
      );
    }
    function qy(N) {
      if (N.uniformsList === null) {
        const i0 = N.currentProgram.getUniforms();
        N.uniformsList = zc.seqWithValue(i0.seq, N.uniforms);
      }
      return N.uniformsList;
    }
    function Ky(N, i0) {
      const h0 = E0.get(N);
      ((h0.outputColorSpace = i0.outputColorSpace),
        (h0.batching = i0.batching),
        (h0.batchingColor = i0.batchingColor),
        (h0.instancing = i0.instancing),
        (h0.instancingColor = i0.instancingColor),
        (h0.instancingMorph = i0.instancingMorph),
        (h0.skinning = i0.skinning),
        (h0.morphTargets = i0.morphTargets),
        (h0.morphNormals = i0.morphNormals),
        (h0.morphColors = i0.morphColors),
        (h0.morphTargetsCount = i0.morphTargetsCount),
        (h0.numClippingPlanes = i0.numClippingPlanes),
        (h0.numIntersection = i0.numClipIntersection),
        (h0.vertexAlphas = i0.vertexAlphas),
        (h0.vertexTangents = i0.vertexTangents),
        (h0.toneMapping = i0.toneMapping));
    }
    function QD(N, i0, h0, d0, s0) {
      (i0.isScene !== !0 && (i0 = F0), f2.resetTextureUnits());
      const T0 = i0.fog,
        X0 = d0.isMeshStandardMaterial ? i0.environment : null,
        c2 =
          _ === null
            ? A.outputColorSpace
            : _.isXRRenderTarget === !0
              ? _.texture.colorSpace
              : qe,
        n2 = (d0.isMeshStandardMaterial ? B : O2).get(d0.envMap || X0),
        k2 =
          d0.vertexColors === !0 &&
          !!h0.attributes.color &&
          h0.attributes.color.itemSize === 4,
        V2 = !!h0.attributes.tangent && (!!d0.normalMap || d0.anisotropy > 0),
        b2 = !!h0.morphAttributes.position,
        Z2 = !!h0.morphAttributes.normal,
        G9 = !!h0.morphAttributes.color;
      let o1 = Jn;
      d0.toneMapped &&
        (_ === null || _.isXRRenderTarget === !0) &&
        (o1 = A.toneMapping);
      const W9 =
          h0.morphAttributes.position ||
          h0.morphAttributes.normal ||
          h0.morphAttributes.color,
        I9 = W9 !== void 0 ? W9.length : 0,
        S2 = E0.get(d0),
        e1 = g.state.lights;
      if (z === !0 && (Y === !0 || N !== S)) {
        const re = N === S && d0.id === C;
        S0.setState(d0, N, re);
      }
      let d9 = !1;
      d0.version === S2.__version
        ? ((S2.needsLights && S2.lightsStateVersion !== e1.state.version) ||
            S2.outputColorSpace !== c2 ||
            (s0.isBatchedMesh && S2.batching === !1) ||
            (!s0.isBatchedMesh && S2.batching === !0) ||
            (s0.isBatchedMesh &&
              S2.batchingColor === !0 &&
              s0.colorTexture === null) ||
            (s0.isBatchedMesh &&
              S2.batchingColor === !1 &&
              s0.colorTexture !== null) ||
            (s0.isInstancedMesh && S2.instancing === !1) ||
            (!s0.isInstancedMesh && S2.instancing === !0) ||
            (s0.isSkinnedMesh && S2.skinning === !1) ||
            (!s0.isSkinnedMesh && S2.skinning === !0) ||
            (s0.isInstancedMesh &&
              S2.instancingColor === !0 &&
              s0.instanceColor === null) ||
            (s0.isInstancedMesh &&
              S2.instancingColor === !1 &&
              s0.instanceColor !== null) ||
            (s0.isInstancedMesh &&
              S2.instancingMorph === !0 &&
              s0.morphTexture === null) ||
            (s0.isInstancedMesh &&
              S2.instancingMorph === !1 &&
              s0.morphTexture !== null) ||
            S2.envMap !== n2 ||
            (d0.fog === !0 && S2.fog !== T0) ||
            (S2.numClippingPlanes !== void 0 &&
              (S2.numClippingPlanes !== S0.numPlanes ||
                S2.numIntersection !== S0.numIntersection)) ||
            S2.vertexAlphas !== k2 ||
            S2.vertexTangents !== V2 ||
            S2.morphTargets !== b2 ||
            S2.morphNormals !== Z2 ||
            S2.morphColors !== G9 ||
            S2.toneMapping !== o1 ||
            S2.morphTargetsCount !== I9) &&
          (d9 = !0)
        : ((d9 = !0), (S2.__version = d0.version));
      let Se = S2.currentProgram;
      d9 === !0 && (Se = Fa(d0, i0, s0));
      let V4 = !1,
        Ce = !1,
        Lr = !1;
      const j9 = Se.getUniforms(),
        Ke = S2.uniforms;
      if (
        (G0.useProgram(Se.program) && ((V4 = !0), (Ce = !0), (Lr = !0)),
        d0.id !== C && ((C = d0.id), (Ce = !0)),
        V4 || S !== N)
      ) {
        (G0.buffers.depth.getReversed()
          ? (X.copy(N.projectionMatrix),
            tN(X),
            nN(X),
            j9.setValue(W, "projectionMatrix", X))
          : j9.setValue(W, "projectionMatrix", N.projectionMatrix),
          j9.setValue(W, "viewMatrix", N.matrixWorldInverse));
        const ye = j9.map.cameraPosition;
        (ye !== void 0 &&
          ye.setValue(W, r0.setFromMatrixPosition(N.matrixWorld)),
          o2.logarithmicDepthBuffer &&
            j9.setValue(
              W,
              "logDepthBufFC",
              2 / (Math.log(N.far + 1) / Math.LN2),
            ),
          (d0.isMeshPhongMaterial ||
            d0.isMeshToonMaterial ||
            d0.isMeshLambertMaterial ||
            d0.isMeshBasicMaterial ||
            d0.isMeshStandardMaterial ||
            d0.isShaderMaterial) &&
            j9.setValue(W, "isOrthographic", N.isOrthographicCamera === !0),
          S !== N && ((S = N), (Ce = !0), (Lr = !0)));
      }
      if (s0.isSkinnedMesh) {
        (j9.setOptional(W, s0, "bindMatrix"),
          j9.setOptional(W, s0, "bindMatrixInverse"));
        const re = s0.skeleton;
        re &&
          (re.boneTexture === null && re.computeBoneTexture(),
          j9.setValue(W, "boneTexture", re.boneTexture, f2));
      }
      s0.isBatchedMesh &&
        (j9.setOptional(W, s0, "batchingTexture"),
        j9.setValue(W, "batchingTexture", s0._matricesTexture, f2),
        j9.setOptional(W, s0, "batchingIdTexture"),
        j9.setValue(W, "batchingIdTexture", s0._indirectTexture, f2),
        j9.setOptional(W, s0, "batchingColorTexture"),
        s0._colorsTexture !== null &&
          j9.setValue(W, "batchingColorTexture", s0._colorsTexture, f2));
      const je = h0.morphAttributes;
      if (
        ((je.position !== void 0 ||
          je.normal !== void 0 ||
          je.color !== void 0) &&
          q0.update(s0, h0, Se),
        (Ce || S2.receiveShadow !== s0.receiveShadow) &&
          ((S2.receiveShadow = s0.receiveShadow),
          j9.setValue(W, "receiveShadow", s0.receiveShadow)),
        d0.isMeshGouraudMaterial &&
          d0.envMap !== null &&
          ((Ke.envMap.value = n2),
          (Ke.flipEnvMap.value =
            n2.isCubeTexture && n2.isRenderTargetTexture === !1 ? -1 : 1)),
        d0.isMeshStandardMaterial &&
          d0.envMap === null &&
          i0.environment !== null &&
          (Ke.envMapIntensity.value = i0.environmentIntensity),
        Ce &&
          (j9.setValue(W, "toneMappingExposure", A.toneMappingExposure),
          S2.needsLights && JD(Ke, Lr),
          T0 && d0.fog === !0 && c0.refreshFogUniforms(Ke, T0),
          c0.refreshMaterialUniforms(
            Ke,
            d0,
            P,
            K,
            g.state.transmissionRenderTarget[N.id],
          ),
          zc.upload(W, qy(S2), Ke, f2)),
        d0.isShaderMaterial &&
          d0.uniformsNeedUpdate === !0 &&
          (zc.upload(W, qy(S2), Ke, f2), (d0.uniformsNeedUpdate = !1)),
        d0.isSpriteMaterial && j9.setValue(W, "center", s0.center),
        j9.setValue(W, "modelViewMatrix", s0.modelViewMatrix),
        j9.setValue(W, "normalMatrix", s0.normalMatrix),
        j9.setValue(W, "modelMatrix", s0.matrixWorld),
        d0.isShaderMaterial || d0.isRawShaderMaterial)
      ) {
        const re = d0.uniformsGroups;
        for (let ye = 0, D7 = re.length; ye < D7; ye++) {
          const m3 = re[ye];
          (Z.update(m3, Se), Z.bind(m3, Se));
        }
      }
      return Se;
    }
    function JD(N, i0) {
      ((N.ambientLightColor.needsUpdate = i0),
        (N.lightProbe.needsUpdate = i0),
        (N.directionalLights.needsUpdate = i0),
        (N.directionalLightShadows.needsUpdate = i0),
        (N.pointLights.needsUpdate = i0),
        (N.pointLightShadows.needsUpdate = i0),
        (N.spotLights.needsUpdate = i0),
        (N.spotLightShadows.needsUpdate = i0),
        (N.rectAreaLights.needsUpdate = i0),
        (N.hemisphereLights.needsUpdate = i0));
    }
    function eV(N) {
      return (
        N.isMeshLambertMaterial ||
        N.isMeshToonMaterial ||
        N.isMeshPhongMaterial ||
        N.isMeshStandardMaterial ||
        N.isShadowMaterial ||
        (N.isShaderMaterial && N.lights === !0)
      );
    }
    ((this.getActiveCubeFace = function () {
      return M;
    }),
      (this.getActiveMipmapLevel = function () {
        return E;
      }),
      (this.getRenderTarget = function () {
        return _;
      }),
      (this.setRenderTargetTextures = function (N, i0, h0) {
        const d0 = E0.get(N);
        ((d0.__autoAllocateDepthBuffer = N.resolveDepthBuffer === !1),
          d0.__autoAllocateDepthBuffer === !1 && (d0.__useRenderToTexture = !1),
          (E0.get(N.texture).__webglTexture = i0),
          (E0.get(N.depthTexture).__webglTexture = d0.__autoAllocateDepthBuffer
            ? void 0
            : h0),
          (d0.__hasExternalTextures = !0));
      }),
      (this.setRenderTargetFramebuffer = function (N, i0) {
        const h0 = E0.get(N);
        ((h0.__webglFramebuffer = i0),
          (h0.__useDefaultFramebuffer = i0 === void 0));
      }));
    const tV = W.createFramebuffer();
    ((this.setRenderTarget = function (N, i0 = 0, h0 = 0) {
      ((_ = N), (M = i0), (E = h0));
      let d0 = !0,
        s0 = null,
        T0 = !1,
        X0 = !1;
      if (N) {
        const n2 = E0.get(N);
        if (n2.__useDefaultFramebuffer !== void 0)
          (G0.bindFramebuffer(W.FRAMEBUFFER, null), (d0 = !1));
        else if (n2.__webglFramebuffer === void 0) f2.setupRenderTarget(N);
        else if (n2.__hasExternalTextures)
          f2.rebindTextures(
            N,
            E0.get(N.texture).__webglTexture,
            E0.get(N.depthTexture).__webglTexture,
          );
        else if (N.depthBuffer) {
          const b2 = N.depthTexture;
          if (n2.__boundDepthTexture !== b2) {
            if (
              b2 !== null &&
              E0.has(b2) &&
              (N.width !== b2.image.width || N.height !== b2.image.height)
            )
              throw new Error(
                "WebGLRenderTarget: Attached DepthTexture is initialized to the incorrect size.",
              );
            f2.setupDepthRenderbuffer(N);
          }
        }
        const k2 = N.texture;
        (k2.isData3DTexture ||
          k2.isDataArrayTexture ||
          k2.isCompressedArrayTexture) &&
          (X0 = !0);
        const V2 = E0.get(N).__webglFramebuffer;
        (N.isWebGLCubeRenderTarget
          ? (Array.isArray(V2[i0]) ? (s0 = V2[i0][h0]) : (s0 = V2[i0]),
            (T0 = !0))
          : N.samples > 0 && f2.useMultisampledRTT(N) === !1
            ? (s0 = E0.get(N).__webglMultisampledFramebuffer)
            : Array.isArray(V2)
              ? (s0 = V2[h0])
              : (s0 = V2),
          G.copy(N.viewport),
          I.copy(N.scissor),
          (L = N.scissorTest));
      } else
        (G.copy(Q).multiplyScalar(P).floor(),
          I.copy(U).multiplyScalar(P).floor(),
          (L = O));
      if (
        (h0 !== 0 && (s0 = tV),
        G0.bindFramebuffer(W.FRAMEBUFFER, s0) && d0 && G0.drawBuffers(N, s0),
        G0.viewport(G),
        G0.scissor(I),
        G0.setScissorTest(L),
        T0)
      ) {
        const n2 = E0.get(N.texture);
        W.framebufferTexture2D(
          W.FRAMEBUFFER,
          W.COLOR_ATTACHMENT0,
          W.TEXTURE_CUBE_MAP_POSITIVE_X + i0,
          n2.__webglTexture,
          h0,
        );
      } else if (X0) {
        const n2 = E0.get(N.texture),
          k2 = i0;
        W.framebufferTextureLayer(
          W.FRAMEBUFFER,
          W.COLOR_ATTACHMENT0,
          n2.__webglTexture,
          h0,
          k2,
        );
      } else if (N !== null && h0 !== 0) {
        const n2 = E0.get(N.texture);
        W.framebufferTexture2D(
          W.FRAMEBUFFER,
          W.COLOR_ATTACHMENT0,
          W.TEXTURE_2D,
          n2.__webglTexture,
          h0,
        );
      }
      C = -1;
    }),
      (this.readRenderTargetPixels = function (
        N,
        i0,
        h0,
        d0,
        s0,
        T0,
        X0,
        c2 = 0,
      ) {
        if (!(N && N.isWebGLRenderTarget)) {
          console.error(
            "THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.",
          );
          return;
        }
        let n2 = E0.get(N).__webglFramebuffer;
        if ((N.isWebGLCubeRenderTarget && X0 !== void 0 && (n2 = n2[X0]), n2)) {
          G0.bindFramebuffer(W.FRAMEBUFFER, n2);
          try {
            const k2 = N.textures[c2],
              V2 = k2.format,
              b2 = k2.type;
            if (!o2.textureFormatReadable(V2)) {
              console.error(
                "THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.",
              );
              return;
            }
            if (!o2.textureTypeReadable(b2)) {
              console.error(
                "THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.",
              );
              return;
            }
            i0 >= 0 &&
              i0 <= N.width - d0 &&
              h0 >= 0 &&
              h0 <= N.height - s0 &&
              (N.textures.length > 1 && W.readBuffer(W.COLOR_ATTACHMENT0 + c2),
              W.readPixels(i0, h0, d0, s0, B0.convert(V2), B0.convert(b2), T0));
          } finally {
            const k2 = _ !== null ? E0.get(_).__webglFramebuffer : null;
            G0.bindFramebuffer(W.FRAMEBUFFER, k2);
          }
        }
      }),
      (this.readRenderTargetPixelsAsync = async function (
        N,
        i0,
        h0,
        d0,
        s0,
        T0,
        X0,
        c2 = 0,
      ) {
        if (!(N && N.isWebGLRenderTarget))
          throw new Error(
            "THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.",
          );
        let n2 = E0.get(N).__webglFramebuffer;
        if ((N.isWebGLCubeRenderTarget && X0 !== void 0 && (n2 = n2[X0]), n2))
          if (i0 >= 0 && i0 <= N.width - d0 && h0 >= 0 && h0 <= N.height - s0) {
            G0.bindFramebuffer(W.FRAMEBUFFER, n2);
            const k2 = N.textures[c2],
              V2 = k2.format,
              b2 = k2.type;
            if (!o2.textureFormatReadable(V2))
              throw new Error(
                "THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.",
              );
            if (!o2.textureTypeReadable(b2))
              throw new Error(
                "THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.",
              );
            const Z2 = W.createBuffer();
            (W.bindBuffer(W.PIXEL_PACK_BUFFER, Z2),
              W.bufferData(W.PIXEL_PACK_BUFFER, T0.byteLength, W.STREAM_READ),
              N.textures.length > 1 && W.readBuffer(W.COLOR_ATTACHMENT0 + c2),
              W.readPixels(i0, h0, d0, s0, B0.convert(V2), B0.convert(b2), 0));
            const G9 = _ !== null ? E0.get(_).__webglFramebuffer : null;
            G0.bindFramebuffer(W.FRAMEBUFFER, G9);
            const o1 = W.fenceSync(W.SYNC_GPU_COMMANDS_COMPLETE, 0);
            return (
              W.flush(),
              await eN(W, o1, 4),
              W.bindBuffer(W.PIXEL_PACK_BUFFER, Z2),
              W.getBufferSubData(W.PIXEL_PACK_BUFFER, 0, T0),
              W.deleteBuffer(Z2),
              W.deleteSync(o1),
              T0
            );
          } else
            throw new Error(
              "THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.",
            );
      }),
      (this.copyFramebufferToTexture = function (N, i0 = null, h0 = 0) {
        const d0 = Math.pow(2, -h0),
          s0 = Math.floor(N.image.width * d0),
          T0 = Math.floor(N.image.height * d0),
          X0 = i0 !== null ? i0.x : 0,
          c2 = i0 !== null ? i0.y : 0;
        (f2.setTexture2D(N, 0),
          W.copyTexSubImage2D(W.TEXTURE_2D, h0, 0, 0, X0, c2, s0, T0),
          G0.unbindTexture());
      }));
    const nV = W.createFramebuffer(),
      iV = W.createFramebuffer();
    ((this.copyTextureToTexture = function (
      N,
      i0,
      h0 = null,
      d0 = null,
      s0 = 0,
      T0 = null,
    ) {
      T0 === null &&
        (s0 !== 0
          ? (qi(
              "WebGLRenderer: copyTextureToTexture function signature has changed to support src and dst mipmap levels.",
            ),
            (T0 = s0),
            (s0 = 0))
          : (T0 = 0));
      let X0, c2, n2, k2, V2, b2, Z2, G9, o1;
      const W9 = N.isCompressedTexture ? N.mipmaps[T0] : N.image;
      if (h0 !== null)
        ((X0 = h0.max.x - h0.min.x),
          (c2 = h0.max.y - h0.min.y),
          (n2 = h0.isBox3 ? h0.max.z - h0.min.z : 1),
          (k2 = h0.min.x),
          (V2 = h0.min.y),
          (b2 = h0.isBox3 ? h0.min.z : 0));
      else {
        const je = Math.pow(2, -s0);
        ((X0 = Math.floor(W9.width * je)),
          (c2 = Math.floor(W9.height * je)),
          N.isDataArrayTexture
            ? (n2 = W9.depth)
            : N.isData3DTexture
              ? (n2 = Math.floor(W9.depth * je))
              : (n2 = 1),
          (k2 = 0),
          (V2 = 0),
          (b2 = 0));
      }
      d0 !== null
        ? ((Z2 = d0.x), (G9 = d0.y), (o1 = d0.z))
        : ((Z2 = 0), (G9 = 0), (o1 = 0));
      const I9 = B0.convert(i0.format),
        S2 = B0.convert(i0.type);
      let e1;
      (i0.isData3DTexture
        ? (f2.setTexture3D(i0, 0), (e1 = W.TEXTURE_3D))
        : i0.isDataArrayTexture || i0.isCompressedArrayTexture
          ? (f2.setTexture2DArray(i0, 0), (e1 = W.TEXTURE_2D_ARRAY))
          : (f2.setTexture2D(i0, 0), (e1 = W.TEXTURE_2D)),
        W.pixelStorei(W.UNPACK_FLIP_Y_WEBGL, i0.flipY),
        W.pixelStorei(W.UNPACK_PREMULTIPLY_ALPHA_WEBGL, i0.premultiplyAlpha),
        W.pixelStorei(W.UNPACK_ALIGNMENT, i0.unpackAlignment));
      const d9 = W.getParameter(W.UNPACK_ROW_LENGTH),
        Se = W.getParameter(W.UNPACK_IMAGE_HEIGHT),
        V4 = W.getParameter(W.UNPACK_SKIP_PIXELS),
        Ce = W.getParameter(W.UNPACK_SKIP_ROWS),
        Lr = W.getParameter(W.UNPACK_SKIP_IMAGES);
      (W.pixelStorei(W.UNPACK_ROW_LENGTH, W9.width),
        W.pixelStorei(W.UNPACK_IMAGE_HEIGHT, W9.height),
        W.pixelStorei(W.UNPACK_SKIP_PIXELS, k2),
        W.pixelStorei(W.UNPACK_SKIP_ROWS, V2),
        W.pixelStorei(W.UNPACK_SKIP_IMAGES, b2));
      const j9 = N.isDataArrayTexture || N.isData3DTexture,
        Ke = i0.isDataArrayTexture || i0.isData3DTexture;
      if (N.isDepthTexture) {
        const je = E0.get(N),
          re = E0.get(i0),
          ye = E0.get(je.__renderTarget),
          D7 = E0.get(re.__renderTarget);
        (G0.bindFramebuffer(W.READ_FRAMEBUFFER, ye.__webglFramebuffer),
          G0.bindFramebuffer(W.DRAW_FRAMEBUFFER, D7.__webglFramebuffer));
        for (let m3 = 0; m3 < n2; m3++)
          (j9 &&
            (W.framebufferTextureLayer(
              W.READ_FRAMEBUFFER,
              W.COLOR_ATTACHMENT0,
              E0.get(N).__webglTexture,
              s0,
              b2 + m3,
            ),
            W.framebufferTextureLayer(
              W.DRAW_FRAMEBUFFER,
              W.COLOR_ATTACHMENT0,
              E0.get(i0).__webglTexture,
              T0,
              o1 + m3,
            )),
            W.blitFramebuffer(
              k2,
              V2,
              X0,
              c2,
              Z2,
              G9,
              X0,
              c2,
              W.DEPTH_BUFFER_BIT,
              W.NEAREST,
            ));
        (G0.bindFramebuffer(W.READ_FRAMEBUFFER, null),
          G0.bindFramebuffer(W.DRAW_FRAMEBUFFER, null));
      } else if (s0 !== 0 || N.isRenderTargetTexture || E0.has(N)) {
        const je = E0.get(N),
          re = E0.get(i0);
        (G0.bindFramebuffer(W.READ_FRAMEBUFFER, nV),
          G0.bindFramebuffer(W.DRAW_FRAMEBUFFER, iV));
        for (let ye = 0; ye < n2; ye++)
          (j9
            ? W.framebufferTextureLayer(
                W.READ_FRAMEBUFFER,
                W.COLOR_ATTACHMENT0,
                je.__webglTexture,
                s0,
                b2 + ye,
              )
            : W.framebufferTexture2D(
                W.READ_FRAMEBUFFER,
                W.COLOR_ATTACHMENT0,
                W.TEXTURE_2D,
                je.__webglTexture,
                s0,
              ),
            Ke
              ? W.framebufferTextureLayer(
                  W.DRAW_FRAMEBUFFER,
                  W.COLOR_ATTACHMENT0,
                  re.__webglTexture,
                  T0,
                  o1 + ye,
                )
              : W.framebufferTexture2D(
                  W.DRAW_FRAMEBUFFER,
                  W.COLOR_ATTACHMENT0,
                  W.TEXTURE_2D,
                  re.__webglTexture,
                  T0,
                ),
            s0 !== 0
              ? W.blitFramebuffer(
                  k2,
                  V2,
                  X0,
                  c2,
                  Z2,
                  G9,
                  X0,
                  c2,
                  W.COLOR_BUFFER_BIT,
                  W.NEAREST,
                )
              : Ke
                ? W.copyTexSubImage3D(e1, T0, Z2, G9, o1 + ye, k2, V2, X0, c2)
                : W.copyTexSubImage2D(e1, T0, Z2, G9, k2, V2, X0, c2));
        (G0.bindFramebuffer(W.READ_FRAMEBUFFER, null),
          G0.bindFramebuffer(W.DRAW_FRAMEBUFFER, null));
      } else
        Ke
          ? N.isDataTexture || N.isData3DTexture
            ? W.texSubImage3D(e1, T0, Z2, G9, o1, X0, c2, n2, I9, S2, W9.data)
            : i0.isCompressedArrayTexture
              ? W.compressedTexSubImage3D(
                  e1,
                  T0,
                  Z2,
                  G9,
                  o1,
                  X0,
                  c2,
                  n2,
                  I9,
                  W9.data,
                )
              : W.texSubImage3D(e1, T0, Z2, G9, o1, X0, c2, n2, I9, S2, W9)
          : N.isDataTexture
            ? W.texSubImage2D(W.TEXTURE_2D, T0, Z2, G9, X0, c2, I9, S2, W9.data)
            : N.isCompressedTexture
              ? W.compressedTexSubImage2D(
                  W.TEXTURE_2D,
                  T0,
                  Z2,
                  G9,
                  W9.width,
                  W9.height,
                  I9,
                  W9.data,
                )
              : W.texSubImage2D(W.TEXTURE_2D, T0, Z2, G9, X0, c2, I9, S2, W9);
      (W.pixelStorei(W.UNPACK_ROW_LENGTH, d9),
        W.pixelStorei(W.UNPACK_IMAGE_HEIGHT, Se),
        W.pixelStorei(W.UNPACK_SKIP_PIXELS, V4),
        W.pixelStorei(W.UNPACK_SKIP_ROWS, Ce),
        W.pixelStorei(W.UNPACK_SKIP_IMAGES, Lr),
        T0 === 0 && i0.generateMipmaps && W.generateMipmap(e1),
        G0.unbindTexture());
    }),
      (this.copyTextureToTexture3D = function (
        N,
        i0,
        h0 = null,
        d0 = null,
        s0 = 0,
      ) {
        return (
          qi(
            'WebGLRenderer: copyTextureToTexture3D function has been deprecated. Use "copyTextureToTexture" instead.',
          ),
          this.copyTextureToTexture(N, i0, h0, d0, s0)
        );
      }),
      (this.initRenderTarget = function (N) {
        E0.get(N).__webglFramebuffer === void 0 && f2.setupRenderTarget(N);
      }),
      (this.initTexture = function (N) {
        (N.isCubeTexture
          ? f2.setTextureCube(N, 0)
          : N.isData3DTexture
            ? f2.setTexture3D(N, 0)
            : N.isDataArrayTexture || N.isCompressedArrayTexture
              ? f2.setTexture2DArray(N, 0)
              : f2.setTexture2D(N, 0),
          G0.unbindTexture());
      }),
      (this.resetState = function () {
        ((M = 0), (E = 0), (_ = null), G0.reset(), r2.reset());
      }),
      typeof __THREE_DEVTOOLS__ < "u" &&
        __THREE_DEVTOOLS__.dispatchEvent(
          new CustomEvent("observe", { detail: this }),
        ));
  }
  get coordinateSystem() {
    return W5;
  }
  get outputColorSpace() {
    return this._outputColorSpace;
  }
  set outputColorSpace(e) {
    this._outputColorSpace = e;
    const t = this.getContext();
    ((t.drawingBufferColorSpace = f9._getDrawingBufferColorSpace(e)),
      (t.unpackColorSpace = f9._getUnpackColorSpace()));
  }
}
