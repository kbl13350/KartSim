import {
  x as L,
  p as j,
  a as Z,
  b as y,
  c as Ms,
  l as Rs,
  d as Fs,
  e as Gs,
  G as de,
  f as St,
  s as $t,
  g as Y,
  h as Ce,
  n as gs,
  i as Bs,
  j as me,
  k as te,
  m as fe,
  o as qs,
  q as Ds,
  S as Os,
  r as us,
  P as zs,
  t as ve,
  u as ps,
  v as Us,
  w as Ks,
  y as Vs,
  z as we,
  A as ze,
  B as ce,
  C as fs,
  D as be,
  E as ms,
  F as nt,
  H as Mt,
  I as Hs,
  J as Tt,
  K as Pe,
  L as Ee,
  M as js,
  N as ws,
  O as Ws,
  Q as yt,
  R as kt,
  T as Xs,
  U as Rt,
  V as Re,
  W as Ys,
  X as vt,
  Y as Zs,
  Z as ys,
  _ as Qs,
  $ as le,
  a0 as Ft,
  a1 as Js,
  a2 as ei,
  a3 as ti,
  a4 as si,
  a5 as ii,
  a6 as ai,
  a7 as ie,
  a8 as ni,
  a9 as vs,
  aa as bs,
  ab as xs,
  ac as K,
  ad as ae,
  ae as Ue,
  af as ri,
  ag as oi,
  ah as rt,
  ai as ci,
  aj as li,
  ak as hi,
  al as di,
  am as gi,
  an as Gt,
  ao as ui,
  ap as ot,
  aq as pi,
  ar as fi,
  as as mi,
  at as wi,
  au as yi,
  av as vi,
  aw as bi,
  ax as xi,
  ay as Ci,
} from "./index-DoW2rQpI.js";
function ct(a, e) {
  const t = Math.max(a.x, e.x),
    s = Math.max(a.y, e.y);
  return {
    x: t,
    y: s,
    width: Math.max(0, Math.min(a.x + a.width, e.x + e.width) - t),
    height: Math.max(0, Math.min(a.y + a.height, e.y + e.height) - s),
  };
}
class Pi {
  constructor(e, t, s) {
    ((this.surface = e),
      (this.width = t),
      (this.height = s),
      (this.observer = new MutationObserver((i) => {
        i.some(
          (n) =>
            n.type !== "attributes" ||
            n.target.getAttribute(n.attributeName) !== n.oldValue,
        ) && (this.dirty = !0);
      })),
      this.observer.observe(e, {
        subtree: !0,
        childList: !0,
        characterData: !0,
        attributes: !0,
        attributeOldValue: !0,
      }),
      this.events.forEach((i) => e.addEventListener(i, this.invalidate, !0)),
      document.fonts.addEventListener("loadingdone", this.invalidate));
  }
  surface;
  width;
  height;
  observer;
  images = new Map();
  layers = [];
  dirty = !0;
  ratio = 1;
  overlayOnly = !1;
  disposed = !1;
  invalidate = () => {
    this.dirty = !0;
  };
  events = [
    "pointerover",
    "pointerout",
    "pointerdown",
    "pointerup",
    "pointercancel",
    "focus",
    "blur",
    "scroll",
    "load",
    "change",
    "input",
  ];
  draw(e, t, s = !1) {
    if (this.disposed) return;
    (this.observer
      .takeRecords()
      .some(
        (n) =>
          n.type !== "attributes" ||
          n.target.getAttribute(n.attributeName) !== n.oldValue,
      ) && (this.dirty = !0),
      (t !== this.ratio || s !== this.overlayOnly) && (this.dirty = !0),
      (this.ratio = t),
      (this.overlayOnly = s),
      this.dirty && (this.rebuild(), (this.dirty = !1)));
    for (const n of this.layers)
      e.drawCanvasLayer(n.canvas, n.rect, n.live ? void 0 : 0, n.clip, n.alpha);
  }
  dispose() {
    ((this.disposed = !0),
      this.observer.disconnect(),
      this.events.forEach((e) =>
        this.surface.removeEventListener(e, this.invalidate, !0),
      ),
      document.fonts.removeEventListener("loadingdone", this.invalidate),
      this.images.forEach((e) => {
        e.onload = null;
      }),
      this.images.clear(),
      (this.layers = []));
  }
  image(e) {
    let t = this.images.get(e);
    return (
      t ||
        ((t = new Image()),
        (t.onload = this.invalidate),
        (t.src = e),
        this.images.set(e, t)),
      t.complete && t.naturalWidth ? t : void 0
    );
  }
  rebuild() {
    this.layers = [];
    const e = this.surface.getBoundingClientRect();
    if (!e.width || !e.height) return;
    const t = this.width / e.width,
      s = this.height / e.height,
      i = (d) => ({
        x: (d.x - e.x) * t,
        y: (d.y - e.y) * s,
        width: d.width * t,
        height: d.height * s,
      }),
      n = { x: 0, y: 0, width: this.width, height: this.height };
    let r = [];
    const o = () => {
        if (!r.length) return;
        const d = r.map((m) => ct(m.rect, m.clip)),
          f = Math.max(0, Math.floor(Math.min(...d.map((m) => m.x)))),
          p = Math.max(0, Math.floor(Math.min(...d.map((m) => m.y)))),
          u = Math.min(
            this.width,
            Math.ceil(Math.max(...d.map((m) => m.x + m.width))),
          ),
          g = Math.min(
            this.height,
            Math.ceil(Math.max(...d.map((m) => m.y + m.height))),
          );
        if (u > f && g > p) {
          const m = document.createElement("canvas");
          ((m.width = Math.max(1, Math.round((u - f) * this.ratio))),
            (m.height = Math.max(1, Math.round((g - p) * this.ratio))));
          const b = m.getContext("2d");
          b.setTransform(
            m.width / (u - f),
            0,
            0,
            m.height / (g - p),
            (-f * m.width) / (u - f),
            (-p * m.height) / (g - p),
          );
          for (const P of r)
            (b.save(),
              b.beginPath(),
              b.rect(P.clip.x, P.clip.y, P.clip.width, P.clip.height),
              b.clip(),
              (b.globalAlpha = P.alpha),
              P.paint(b),
              b.restore());
          this.layers.push({
            canvas: m,
            rect: { x: f, y: p, width: u - f, height: g - p },
            live: !1,
          });
        }
        r = [];
      },
      c = (d, f, p, u) => {
        const g = ct(d, f);
        g.width &&
          g.height &&
          p > 0 &&
          r.push({ rect: d, clip: f, alpha: p, paint: u });
      },
      l = (d, f, p) => {
        if (d.hidden) return;
        const u = getComputedStyle(d);
        if (
          u.display === "none" ||
          u.visibility === "hidden" ||
          ((p *= Number(u.opacity)), p <= 0)
        )
          return;
        const g = i(d.getBoundingClientRect());
        if (!g.width || !g.height) return;
        const m = ct(g, f);
        if (!m.width || !m.height) return;
        const b =
            u.overflowX !== "visible" || u.overflowY !== "visible" ? m : f,
          P =
            Number.parseFloat(u.outlineWidth) +
            Math.max(0, Number.parseFloat(u.outlineOffset)),
          C = Number.isFinite(P) ? P : 0;
        if (
          (c(
            {
              x: g.x - C,
              y: g.y - C,
              width: g.width + C * 2,
              height: g.height + C * 2,
            },
            f,
            p,
            (S) => Ei(S, u, g, (w) => this.image(w)),
          ),
          d instanceof HTMLCanvasElement)
        )
          (o(),
            this.layers.push({
              canvas: d,
              rect: g,
              clip: b,
              live: !0,
              alpha: p,
            }));
        else if (d instanceof HTMLImageElement)
          d.complete &&
            d.naturalWidth &&
            c(g, b, p, (S) => {
              const w = Cs(g, d.naturalWidth, d.naturalHeight, u.objectFit);
              S.drawImage(d, w.x, w.y, w.width, w.height);
            });
        else if (d instanceof HTMLSelectElement)
          c(g, b, p, (S) => {
            ((S.font = u.font),
              (S.fillStyle = u.color),
              (S.textBaseline = "middle"),
              S.fillText(
                d.selectedOptions[0]?.textContent ?? "",
                g.x + 4,
                g.y + g.height / 2,
              ),
              S.fillText("▾", g.x + g.width - 15, g.y + g.height / 2));
          });
        else {
          for (const w of d.childNodes)
            if (w.nodeType === Node.TEXT_NODE && w.textContent?.trim()) {
              const k = document.createRange();
              let x = 0;
              for (const T of w.textContent) {
                if (
                  (k.setStart(w, x), (x += T.length), k.setEnd(w, x), !T.trim())
                )
                  continue;
                const v = i(k.getBoundingClientRect());
                !v.width ||
                  !v.height ||
                  c(
                    {
                      ...v,
                      x: v.x - 2,
                      y: v.y - 2,
                      width: v.width + 4,
                      height: v.height + 4,
                    },
                    b,
                    p,
                    (_) => Si(_, u, T, v),
                  );
              }
            }
          const S = [...d.children].filter((w) => w instanceof HTMLElement);
          (S.sort((w, k) => Ke(w) - Ke(k)), S.forEach((w) => l(w, b, p)));
        }
      },
      h = [...this.surface.children].filter((d) => d instanceof HTMLElement);
    h.sort((d, f) => Ke(d) - Ke(f));
    for (const d of h)
      (this.overlayOnly &&
        (d.classList.contains("garage-x-controls") ||
          d.classList.contains("garage-progression") ||
          d.classList.contains("garage-factory") ||
          d.classList.contains("garage-point-effects"))) ||
        l(d, n, 1);
    o();
  }
}
function Ke(a) {
  return Number.parseInt(getComputedStyle(a).zIndex, 10) || 0;
}
function Cs(a, e, t, s) {
  if (s !== "contain" && s !== "cover" && s !== "scale-down" && s !== "none")
    return a;
  const i =
    s === "none"
      ? 1
      : s === "cover"
        ? Math.max(a.width / e, a.height / t)
        : Math.min(s === "scale-down" ? 1 : 1 / 0, a.width / e, a.height / t);
  return {
    x: a.x + (a.width - e * i) / 2,
    y: a.y + (a.height - t * i) / 2,
    width: e * i,
    height: t * i,
  };
}
function Fe(a) {
  let e = 0,
    t = 0;
  const s = [];
  for (let i = 0; i < a.length; i++)
    a[i] === "("
      ? e++
      : a[i] === ")"
        ? e--
        : a[i] === "," && !e && (s.push(a.slice(t, i).trim()), (t = i + 1));
  return (s.push(a.slice(t).trim()), s);
}
function Ei(a, e, t, s) {
  const { x: i, y: n, width: r, height: o } = t;
  (a.save(),
    e.clipPath.startsWith("polygon(") &&
      (a.beginPath(),
      Fe(e.clipPath.slice(8, -1)).forEach((l, h) => {
        const [d, f] = l.split(/\s+/),
          p = i + Ie(d, r),
          u = n + Ie(f, o);
        h ? a.lineTo(p, u) : a.moveTo(p, u);
      }),
      a.closePath(),
      a.clip()),
    (a.fillStyle = e.backgroundColor),
    a.fillRect(i, n, r, o));
  for (const l of Fe(e.boxShadow)) {
    const h =
      /^(rgba?\([^)]*\))\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+([\d.]+)px(?:\s+(-?[\d.]+)px)?\s+inset$/.exec(
        l,
      );
    if (!h) continue;
    const d = Number(h[5] ?? 0),
      f = Number(h[2]),
      p = Number(h[3]);
    (a.save(),
      a.beginPath(),
      a.rect(i, n, r, o),
      a.clip(),
      (a.fillStyle = h[1]));
    const u = Math.max(0, d + p),
      g = Math.max(0, d - p),
      m = Math.max(0, d + f),
      b = Math.max(0, d - f);
    (u && a.fillRect(i, n, r, u),
      g && a.fillRect(i, n + o - g, r, g),
      m && a.fillRect(i, n, m, o),
      b && a.fillRect(i + r - b, n, b, o),
      a.restore());
  }
  for (const l of Fe(e.backgroundImage).reverse()) {
    const h = /^url\(["']?(.*?)["']?\)$/.exec(l)?.[1],
      d = h && s(h);
    if (d) {
      const f = e.backgroundSize.split(/\s+/),
        p =
          e.backgroundSize === "contain" || e.backgroundSize === "cover"
            ? Cs(t, d.naturalWidth, d.naturalHeight, e.backgroundSize)
            : void 0,
        u = p?.width ?? (f[0] === "auto" ? d.naturalWidth : Ie(f[0], r)),
        g =
          p?.height ??
          (!f[1] || f[1] === "auto"
            ? (d.naturalHeight * u) / d.naturalWidth
            : Ie(f[1], o)),
        m = i + Ie(e.backgroundPositionX, r - u),
        b = n + Ie(e.backgroundPositionY, o - g);
      (a.save(),
        a.beginPath(),
        a.rect(i, n, r, o),
        a.clip(),
        a.drawImage(d, m, b, u, g),
        a.restore());
    } else if (l.startsWith("linear-gradient(")) {
      const f = Fe(l.slice(16, -1)),
        p = a.createLinearGradient(i, n, i, n + o);
      (f.forEach((u, g) => {
        const m = /^(.*?)(?:\s+(-?[\d.]+)(%|px))?$/.exec(u);
        p.addColorStop(
          m[2]
            ? Math.max(0, Math.min(1, Number(m[2]) / (m[3] === "%" ? 100 : o)))
            : g / (f.length - 1),
          m[1],
        );
      }),
        (a.fillStyle = p),
        a.fillRect(i, n, r, o));
    }
  }
  const c = [
    [e.borderTopWidth, e.borderTopColor, i, n, r, 0],
    [e.borderBottomWidth, e.borderBottomColor, i, n + o, r, -1],
    [e.borderLeftWidth, e.borderLeftColor, i, n, 0, o],
    [e.borderRightWidth, e.borderRightColor, i + r, n, -1, o],
  ];
  for (const [l, h, d, f, p, u] of c) {
    const g = Number.parseFloat(l);
    g &&
      ((a.fillStyle = h),
      a.fillRect(
        d + (p === -1 ? -g : 0),
        f + (u === -1 ? -g : 0),
        p > 0 ? p : g,
        u > 0 ? u : g,
      ));
  }
  if (e.outlineStyle !== "none") {
    const l = Number.parseFloat(e.outlineWidth),
      h = Number.parseFloat(e.outlineOffset);
    ((a.strokeStyle = e.outlineColor),
      (a.lineWidth = l),
      a.strokeRect(i - h - l / 2, n - h - l / 2, r + h * 2 + l, o + h * 2 + l));
  }
  a.restore();
}
function Ie(a, e) {
  return a.endsWith("%")
    ? (Number.parseFloat(a) / 100) * e
    : Number.parseFloat(a) || 0;
}
function Si(a, e, t, s) {
  ((a.font = e.font), (a.textBaseline = "alphabetic"), (a.fillStyle = e.color));
  const i = a.measureText(t),
    n = s.y + i.fontBoundingBoxAscent;
  for (const r of Fe(e.textShadow)) {
    const o =
      /^(rgba?\([^)]*\))\s+(-?[\d.]+)px\s+(-?[\d.]+)px(?:\s+([\d.]+)px)?$/.exec(
        r,
      );
    o &&
      (a.save(),
      (a.fillStyle = o[1]),
      (a.shadowColor = o[1]),
      (a.shadowBlur = Number(o[4] ?? 0)),
      a.fillText(t, s.x + Number(o[2]), n + Number(o[3])),
      a.restore());
  }
  a.fillText(t, s.x, n);
}
const Q = { engine: 43, handle: 44, wheel: 45, booster: 46 },
  Ps = new Map([
    [Q.engine, "engine"],
    [Q.handle, "handle"],
    [Q.wheel, "wheel"],
    [Q.booster, "booster"],
  ]),
  $i = new Map([
    [Q.engine, "tuneEnginePatch"],
    [Q.handle, "tuneHandle"],
    [Q.wheel, "tuneWheel"],
    [Q.booster, "tuneSupportKit"],
  ]),
  Ti = new Map([
    ["tuneEnginePatch", Q.engine],
    ["tuneHandle", Q.handle],
    ["tuneWheel", Q.wheel],
    ["tuneSupportKit", Q.booster],
  ]),
  ki = "TimeAttack";
function Bt(a) {
  return a === void 0 ? !0 : a.split(";").some((e) => e.trim() === ki);
}
function _i(a) {
  const e = new Map();
  for (const t of a?.children ?? []) {
    if (t.name !== "ItemCat") continue;
    const s = Number(L(t, "id"));
    if (Ps.has(s))
      for (const i of t.children) {
        if (i.name !== "Item") continue;
        const n = Number(L(i, "id"));
        if (!Number.isSafeInteger(n) || n < 1) continue;
        const r = {},
          o = i.children.filter((l) => l.name === "EnchanterAddSpec");
        for (const l of o)
          if (Bt(L(l, "gameType")))
            for (const h of l.attributes) {
              if (h.name === "gameType" || h.name === "class") continue;
              const d = h.name,
                f = Number(h.value);
              !Number.isFinite(f) || !Ii.has(h.name) || (r[d] = f);
            }
        const c = i.children.find(
          (l) => l.name === "EnchanterSetSpec" && Bt(L(l, "gameType")),
        );
        e.set(`${s}:${n}`, {
          spec: r,
          setSpec: c
            ? Object.fromEntries(c.attributes.map((l) => [l.name, l.value]))
            : void 0,
        });
      }
  }
  return e;
}
const Ii = new Set([
  "dragFactor",
  "forwardAccel",
  "backwardAccel",
  "gripBrake",
  "slipBrake",
  "frontGripFactor",
  "rearGripFactor",
  "cornerDrawFactor",
  "driftSlipFactor",
  "driftEscapeForce",
  "driftMaxGauge",
  "normalBoosterTime",
  "itemBoosterTime",
  "teamBoosterTime",
  "animalBoosterTime",
  "startBoosterTimeItem",
  "startBoosterTimeSpeed",
  "startForwardAccelItem",
  "startForwardAccelSpeed",
  "transAccelFactor",
  "steerConstraint",
  "boostAccelFactor",
]);
function Li(a, e, t, s) {
  const i = new Set(),
    n = _i(e),
    r = new Map();
  for (const c of t?.children ?? []) {
    const l = [...$i.entries()].find(([, f]) => f === c.name)?.[0],
      h = Number(L(c, "id")),
      d = L(c, "name")?.trim();
    l === void 0 ||
      !Number.isSafeInteger(h) ||
      h < 1 ||
      !d ||
      r.set(`${l}:${h}`, `stuff/${c.name}/${d}`);
  }
  const o = new Map();
  for (const c of s?.children ?? []) {
    const l = Ti.get(c.name),
      h = Number(L(c, "id")),
      d = Number(L(c, "uniqueLevel"));
    l === void 0 ||
      !Number.isSafeInteger(h) ||
      h < 1 ||
      !Number.isInteger(d) ||
      d < 1 ||
      d > 4 ||
      o.set(`${l}:${h}`, d);
  }
  return a.children.flatMap((c) => {
    if (c.name !== "item") return [];
    const l = Number(L(c, "itemCatId")),
      h = Ps.get(l),
      d = Number(L(c, "itemId"));
    if (!h || !Number.isSafeInteger(d) || d < 1) return [];
    const f = `${l}:${d}`;
    if (i.has(f)) return [];
    i.add(f);
    const p = L(c, "itemName")?.trim();
    return p
      ? [
          {
            family: "legacy",
            slot: h,
            itemId: d,
            value: 0,
            grade: 0,
            legacyCategory: l,
            legacyRarity: o.get(f),
            legacyTitle: p,
            legacyImagePath: r.get(f),
            legacyEffect: L(c, "itemEffect")?.trim() || void 0,
            legacyDescription: L(c, "itemDesc")?.trim() || void 0,
            legacySpec: n.get(f)?.spec,
            legacySetSpec: n.get(f)?.setSpec,
          },
        ]
      : [];
  });
}
function Ni(a) {
  return Q[a];
}
const Ai = 1600,
  Mi = [
    { width: 1400, height: 1050 },
    { width: 1600, height: 900 },
    { width: 1920, height: 1080 },
  ];
function _t(a) {
  const e = Mi.find((t) => t.width === a);
  if (!e) throw new Error(`不支持的车库布局宽度：${a}`);
  return e;
}
const ne = (a, e, t) => ({
    icon: a,
    focusedIcon: `${a}_b`,
    nameKey: `kartBodyEffct_${e}`,
    descriptionKey: `kartBodyEffct_${e}Desc`,
    visible: t,
  }),
  Es = [
    ne(
      "tooltip_icon_드래프트발동",
      "draftMulAccelFactor",
      (a) => a.draftTick > 0,
    ),
    ne(
      "tooltip_icon_듀얼부스터",
      "dualBoosterTickMax",
      (a) => a.dualTransLowSpeed > 0,
    ),
    ne(
      "tooltip_icon_부스터자동충전",
      "chargeBoostBySpeed",
      (a) => a.chargeBoostBySpeed > 0,
    ),
    ne(
      "tooltip_icon_벽충돌게이지증가",
      "wallCollGaugeMaxVelLoss",
      (a) => a.vehicleFunctionWallCollisionGaugeValue > 0,
    ),
    ne(
      "tooltip_icon_차저시스템",
      "chargerSystemboosterUseCount",
      (a) => a.vehicleFunctionChargerBranchValue > 0,
    ),
    ne(
      "tooltip_icon_차저시스템",
      "chargerSystemForItemType",
      (a) => a.vehicleFunctionChargerBranchValue === 0,
    ),
    ne(
      "tooltip_icon_스피드전슬롯개수3",
      "SpeedSlotCapacity",
      (a) => a.speedSlotCapacity === 3,
    ),
    ne(
      "tooltip_icon_아이템전슬롯개수3",
      "ItemSlotCapacity",
      (a) => a.itemSlotCapacity === 3,
    ),
    ne(
      "tooltip_icon_배틀팀필살기2개",
      "SpecialSlotCapacity",
      (a) => a.specialSlotCapacity === 2,
    ),
    ne(
      "tooltip_icon_탈출순간부스터",
      "UseExtendedAfterBooster",
      (a) => a.useExtendedAfterBoosterMore === 1,
    ),
  ],
  Ri = Es.flatMap((a) => [a.icon, a.focusedIcon]);
function Fi(a) {
  return Es.filter((e) => e.visible(a)).map(({ visible: e, ...t }) => t);
}
const Ve = "stage_/garageX/",
  Ze = "mqParts12Card:unique5_x";
function bt(a) {
  const e = a.rects.get("kartSelector");
  if (!e) throw new Error("P3543 车库布局缺少 kartSelector。");
  const t = a.kartCardLayout;
  return {
    x: e.x + t.contentAdjustX,
    y: e.y + t.contentAdjustY,
    width: t.pageSize * t.width + (t.pageSize - 1) * t.gapX,
    height: t.height,
  };
}
function Gi(a, e) {
  const t = bt(a),
    s = a.kartCardLayout;
  return {
    x: t.x + e * (s.width + s.gapX),
    y: t.y,
    width: s.width,
    height: s.height,
  };
}
function Qe(a) {
  const e = (a ?? "").trim().split(/\s+/).map(Number);
  return [Number.isFinite(e[0]) ? e[0] : 0, Number.isFinite(e[1]) ? e[1] : 0];
}
function qt(a, e, t) {
  const [, , s, i] = (y(a, "leftTopWH") ?? y(a, "windowRect") ?? "0 0 0 0")
      .split(/\s+/)
      .map(Number),
    n = a.children.find((g) => y(g, "name") === "shopItemContainer"),
    r = a.children.find((g) => y(g, "name") === "itemNameLabel"),
    [o, c] = Qe(y(n, "windowSize")),
    [l, h] = Qe(y(n, "adjust")),
    [d, f, p, u] = (y(r, "leftTopWH") ?? "0 0 0 0").split(/\s+/).map(Number);
  return {
    width: s,
    height: i,
    iconWidth: o,
    iconHeight: c,
    iconAdjustX: l,
    iconAdjustY: h,
    stepX: s + e,
    stepY: i + t,
    titleRect: { x: d, y: f, width: p, height: u },
    texture: y(a, "texture") ?? "",
  };
}
function xt(a, e) {
  return a.partCardLayouts.get(e === "xun" ? "xun" : "classic");
}
function Dt(a, e) {
  const t = a.rects.get("partsSelect");
  if (!t) throw new Error("车库部件列表布局节点缺失。");
  const s = xt(a, e);
  return {
    x: t.x,
    y: t.y,
    width: s.width * a.partGridLayout.columns,
    height: s.stepY * a.partGridLayout.rows,
  };
}
function Bi(a, e, t, s) {
  const i = [];
  for (const n of de) {
    const r = `parts${n[0].toUpperCase()}${n.slice(1)}`;
    for (const o of ["x", "v1"]) {
      const c = o === "x" ? "1" : "2";
      a.children.some((l) => l.name === r && L(l, "id") === c) &&
        i.push(...gs(o, n));
    }
    for (const o of a.children.filter((c) => c.name === `${r}12`)) {
      const c = Number(L(o, "id")),
        l = Number(L(o, "uniqueLevel"));
      !Number.isInteger(l) ||
        l < 1 ||
        l > 4 ||
        i.push({ family: "xun", slot: n, itemId: c, grade: l, value: Bs(c) });
    }
  }
  return (e && i.push(...Li(e, t, a, s)), i);
}
function qi(a, e, t) {
  const s = a.parts.filter((i) => i.family === e && i.slot === t);
  return e === "legacy"
    ? s
        .map((i, n) => ({ part: i, index: n }))
        .sort(
          (i, n) =>
            (i.part.legacyRarity ?? Number.POSITIVE_INFINITY) -
              (n.part.legacyRarity ?? Number.POSITIVE_INFINITY) ||
            i.index - n.index,
        )
        .map(({ part: i }) => i)
    : [...s].sort((i, n) => n.value - i.value || n.itemId - i.itemId);
}
const Ot = new WeakMap(),
  Di = "gui_/font/SourceHanSansCN-Bold.otf",
  Oi = "gui_font.rho",
  zt = "P3528 Source Han Sans CN Garage";
function zi(a, e = 1600) {
  let t = Ot.get(a);
  t || ((t = new Map()), Ot.set(a, t));
  let s = t.get(e);
  return (
    s ||
      ((s = Ui(a, e)),
      t.set(e, s),
      s.catch(() => {
        t.get(e) === s && t.delete(e);
      })),
    s
  );
}
async function Ui(a, e) {
  const t = _t(e),
    s = (I) => {
      const z = a.exactCanonicalCandidates(I);
      if (z.length !== 1) throw new Error(`车库资源缺失或不唯一：${I}`);
      return z[0];
    },
    i = (I) => {
      const z = a.exactCanonicalCandidates(I);
      if (z.length > 1) throw new Error(`车库资源重复：${I}`);
      return z[0];
    },
    [n, r, o, c, l, h, d, f, p, u, g, m] = await Promise.all([
      s(`${Ve}stage_${t.width}.bml`).bytes().then(j),
      s(`${Ve}stage_stringBag.bml`).bytes().then(j),
      s("etc_/baseStringBag.xml").bytes().then(Z),
      s("etc_/itemTable.kml").bytes().then(Z),
      s("etc_/itemTable@cn.xml").bytes().then(Z),
      s("zeta_/cn/shop/data/item.kml").bytes().then(Z),
      i("zeta_/cn/enchant/enchantMaterials.xml")?.bytes().then(Z),
      s("gui_/windowTemplate/itemPanels.bml").bytes().then(j),
      s("gui_/windowTemplate/garageXKartCard.bml").bytes().then(j),
      s("gui_/windowTemplate/mqPartsCard.bml").bytes().then(j),
      s("gui_/windowTemplate/mqParts12Card.bml").bytes().then(j),
      s("gui_/monocoque/frame.bml").bytes().then(j),
    ]),
    b = (I, z) =>
      y(I, "name") === z ? I : I.children.map((X) => b(X, z)).find(Boolean),
    P = b(n, "kartSelector");
  if (!P) throw new Error("P3543 车库布局缺少 kartSelector。");
  const [, , C, S] = (y(p, "windowRect") ?? "0 0 0 0").split(/\s+/).map(Number),
    [w] = Qe(y(P, "alignMargin")),
    k = Number(y(P, "alignSize")),
    x = f.children.find((I) => I.name === "Kart" && y(I, "name") === "default");
  if (!x) throw new Error("P3543 ItemPanel 布局缺少 Kart/default。");
  const T = {
      width: C,
      height: S,
      gapX: w,
      pageSize: k,
      contentAdjustX: 3,
      contentAdjustY: 4,
      kartZoom: Number(y(x, "zoom")),
      texture: y(p, "texture") ?? "",
      selectedTexture: y(p, "selectedTexture") ?? "",
    },
    v = b(n, "partList");
  if (!v) throw new Error("P3543 车库布局缺少 partList。");
  const [_, $] = Qe(y(v, "alignMargin")),
    N = { columns: Number(y(v, "alignSize")), rows: Number(y(v, "maxLine")) };
  if (
    !Number.isInteger(N.columns) ||
    N.columns < 1 ||
    !Number.isInteger(N.rows) ||
    N.rows < 1
  )
    throw new Error("P3543 车库 partList 网格尺寸无效。");
  const A = new Map([
      ["classic", qt(u, _, $)],
      ["xun", qt(g, _, $)],
    ]),
    E = b(n, "partListBar");
  if (!E) throw new Error("P3543 车库布局缺少 partListBar。");
  const M = Ms(E, m),
    G = new Map(),
    F = await Rs(a, await Fs(a)),
    B = await Gs(a),
    O = new Map();
  for (const I of de) {
    const z = `parts${I[0].toUpperCase()}${I.slice(1)}12`;
    for (const X of c.root.children.filter((W) => W.name === z)) {
      const W = L(X, "name");
      W && O.set(`${I}:${L(X, "id")}`, `stuff2_/parts/${W}.1s`);
    }
  }
  for (const I of r.children) {
    const z = I.children.find((X) => y(X, "c") === "cn");
    z && G.set(y(I, "n"), y(z, "v") ?? "");
  }
  for (const I of o.root.children) {
    const z = L(I, "n"),
      X = I.children.find((W) => L(W, "c") === "cn");
    z && X && !G.has(z) && G.set(z, L(X, "v") ?? "");
  }
  const q = new Map(),
    V = new Map(),
    D = new Set([
      `garage_img_baseBG_${t.width}`,
      `garage_img_baseBG_2_${t.width}`,
      "garage_img_baseBG_list",
      "garage_img_baseBG_list_2",
      "garage_img_partsBG1_lock",
      "img_selectedKart_Normal",
      "garage_img_textCarType2",
      "garage_kartFuncSlotBg",
      "img_itemTooltopBoxBG",
      ...[1, 2, 3, 4, 5].map((I) => `unique${I}_x`),
      ...[1, 2, 3, 4].flatMap((I) => [
        `garage_btn_menuTab1_${I}`,
        `garage_btn_equip_${I}`,
        `garage_btn_preview_${I}`,
        `garage_btn_partsTab_${I}`,
        `garage_btn_partsDelete_${I}`,
        `garage_btn_partsDelete_2_${I}@zz`,
        `buttonRed_${I}`,
        `garage_btn_arrowLeft_${I}`,
        `garage_btn_arrowRight_${I}`,
        `garage_btn_listTab_${I}`,
      ]),
      M.areaFrame.texture,
      ...M.buttonFrames.map((I) => I.texture),
      ...[0, 1, 2, 3, 4, 5].flatMap((I) => [
        `uniqueLevel_${I}`,
        `uniqueLevel_${I}_50x50`,
      ]),
      "turning_enhancedBG",
      ...[1, 2, 3, 4, 5].flatMap((I) => [`tuning_mark_s_${I}`]),
    ]);
  Ri.forEach((I) => D.add(I));
  for (let I = 1; I <= 5; I++) D.add(se("garage_check_0", I));
  (D.add(Ze), D.add(T.texture), D.add(T.selectedTexture));
  const $e = new Set([
      "backGround_1920",
      "backGround_12",
      "kartPreview",
      "karts",
      "kartSelector",
      "kartKeyword",
      "directionArrows",
      "resetKeyword",
      "partsListBoard",
      "menuTab",
      "selectedKartName",
      "selectedKartType",
      "textPerformList",
      "textPerformList_12",
      "equipedParts",
      "equipedParts_12",
      "partsReinforceGrp",
    ]),
    Be = new Set([
      "partsDisassemble",
      "partsComposite",
      "growthAlert",
      "growthLock",
    ]),
    Te = (I, z = !1) => {
      const X = y(I, "name") ?? "";
      if (!(Be.has(X) || (y(I, "frame") && y(I, "frame") !== "NoFrame"))) {
        if (((z ||= $e.has(X)), z)) {
          for (const J of ["image", "texture"]) {
            const Le = y(I, J);
            Le && D.add(Le);
          }
          const W = y(I, "autoLoadImage");
          if (W) for (let J = 1; J <= 4; J++) D.add(se(W, J));
          const ke = y(I, "autoImage");
          if (ke) for (let J = 1; J <= 5; J++) D.add(se(ke, J));
        }
        I.children.forEach((W) => Te(W, z));
      }
    };
  Te(n);
  const At = Bi(c.root, h.root, d?.root, l.root);
  for (const I of At) D.add(Ss(I));
  for (const I of F) I.icon && D.add(`parts:${I.icon.slice(14, -4)}`);
  for (const I of B) I.icon && D.add(`parts:${I.icon.slice(14, -4)}`);
  (D.add("parts:partsTailLamp_0"), D.add("parts:partsTailLamp12_0"));
  let ge;
  try {
    const I = a
      .canonicalCandidates(Di)
      .find((R) => R.sourceName.toLowerCase() === Oi);
    I && typeof FontFace < "u" && (ge = await St(zt, await I.bytes()));
    const X = (
      await Promise.allSettled(
        [...D].map(async (R) => {
          const _e = R.replace(/@zz$/, "@cn"),
            qe = R === T.texture || R === T.selectedTexture,
            Ne = R === "turning_enhancedBG" || /^tuning_mark_s_[1-5]$/.test(R),
            De = (
              R === Ze
                ? ["gui_/windowTemplate/unique5_x.png"]
                : R.startsWith("parts:")
                  ? [`stuff2_/parts/${R.slice(6)}.png`]
                  : R.startsWith("legacy:")
                    ? [`${R.slice(7)}.png`]
                    : qe || Ne
                      ? [
                          `gui_/windowTemplate/${_e}.png`,
                          `gui_/windowTemplate/${R}.png`,
                        ]
                      : [
                          `${Ve}${_e}.png`,
                          `${Ve}${R}.png`,
                          `stage_/common/${_e}.png`,
                          `stage_/common/${R}.png`,
                          `gui_/monocoque/${_e}.png`,
                          `gui_/monocoque/${R}.png`,
                        ]
            )
              .map((Ae) => a.exactCanonicalCandidates(Ae)[0])
              .find(Boolean);
          if (!De) return;
          const Oe = new Blob([await De.bytes()], { type: "image/png" });
          (q.set(R, await $t(await createImageBitmap(Oe))),
            V.set(R, URL.createObjectURL(Oe)));
        }),
      )
    ).find((R) => R.status === "rejected");
    if (X?.status === "rejected") throw X.reason;
    if (!q.has(`garage_img_baseBG_${t.width}`))
      throw new Error("P3543 车库背景缺失。");
    const W = new Map(),
      ke = new Map(),
      J = (R) => $e.has(y(R, "name") ?? "") || R.children.some(J),
      Le = (R, _e, qe, Ne = !1) => {
        const oe = y(R, "name");
        if (
          Be.has(oe ?? "") ||
          (y(R, "frame") && y(R, "frame") !== "NoFrame") ||
          (!Ne && !J(R))
        )
          return;
        Ne ||= $e.has(oe ?? "");
        const De =
            y(R, "image") ??
            y(R, "texture") ??
            se(y(R, "autoLoadImage") ?? "", 1),
          Oe =
            y(R, "frame") === "NoFrame"
              ? {
                  ...R,
                  attributes: R.attributes.filter((at) => at.name !== "frame"),
                }
              : R,
          Ae = Y(Oe, _e, void 0, q.get(De)),
          it = oe ? `${qe}/${oe}` : qe;
        (oe &&
          (W.set(it, Ae),
          ke.set(it, R),
          W.has(oe) || (W.set(oe, Ae), ke.set(oe, R))),
          R.children.forEach((at) => Le(at, Ae, it, Ne)));
      };
    return (
      Le(n, { x: 0, y: 0, width: t.width, height: t.height }, ""),
      {
        stage: t,
        definition: n,
        strings: G,
        textures: q,
        imageUrls: V,
        nodes: ke,
        rects: W,
        parts: At,
        partModels: O,
        cosmetics: F,
        coatings: B,
        kartCardLayout: T,
        partCardLayouts: A,
        partGridLayout: N,
        partScrollbar: M,
        fontFamily: ge ? zt : void 0,
        dispose: () => {
          (ge && (Ce(ge), (ge = void 0)),
            q.forEach((R) => R.close()),
            q.clear(),
            V.forEach((R) => URL.revokeObjectURL(R)),
            V.clear());
        },
      }
    );
  } catch (I) {
    throw (
      ge && Ce(ge),
      q.forEach((z) => z.close()),
      V.forEach((z) => URL.revokeObjectURL(z)),
      I
    );
  }
}
function se(a, e) {
  return a.endsWith("@zz") ? `${a.slice(0, -3)}${e}@zz` : `${a}${e}`;
}
function Ss(a) {
  return a.family === "legacy"
    ? `legacy:${a.legacyImagePath ?? `missing/${a.legacyCategory ?? Ni(a.slot)}/${a.itemId}`}`
    : `parts:parts${a.slot[0].toUpperCase() + a.slot.slice(1)}${a.family === "xun" ? "12_" : `_${a.itemId}`}${a.grade}`;
}
const Ki = {
    kind: "classic",
    backgroundTexture: "garage_img_baseBG_1600",
    partsTab: "4_partsTab",
    equippedRoot: "equipedParts",
    performanceRoot: "textPerformList",
    slotSize: 44,
    cosmeticTabs: [],
  },
  Vi = {
    kind: "v1",
    backgroundTexture: "garage_img_baseBG_1600",
    partsTab: "6_partsTab",
    equippedRoot: "equipedParts",
    performanceRoot: "textPerformList",
    slotSize: 44,
    cosmeticTabs: [
      { node: "partsCoating", label: "车膜" },
      { node: "partsTailLamp", label: "车灯" },
    ],
  },
  Hi = {
    kind: "xun",
    backgroundTexture: "garage_img_baseBG_2_1600",
    partsTab: "7_partsTab",
    equippedRoot: "equipedParts_12",
    performanceRoot: "textPerformList_12",
    slotSize: 50,
    cosmeticTabs: [
      { node: "partsCoating12", label: "车膜" },
      { node: "partsTailLamp12", label: "车灯" },
      { node: "partsBoosterEffect12", label: "加速器特效" },
    ],
  };
function ue(a) {
  if (!(a === void 0 || !Number.isInteger(a))) {
    if (a >= 0 && a <= 7) return Ki;
    if (a === 8) return Vi;
    if (a === 9) return Hi;
  }
}
function pe(a) {
  if (!(a === void 0 || !Number.isInteger(a))) {
    if (a >= 0 && a <= 6) return "classic";
    if (a === 9) return "xun";
  }
}
function Ut(a) {
  return a === "classic" ? "classic" : a;
}
const ji = {
  engine: "defaultEngineType",
  handle: "defaultHandleType",
  wheel: "defaultWheelType",
  booster: "defaultBoosterType",
};
function Wi(a, e, t = "原装") {
  return { value: a ?? t, state: e ? "锁定" : "" };
}
function Xe(a, e, t, s, i, n, r) {
  const o = me(a, i),
    c = e[t];
  if (c && c.family === o && !(c.family === "xun" && c.itemId === 1))
    return c.family === "legacy"
      ? (s.find(
          (l) =>
            l.family === "legacy" &&
            l.slot === t &&
            l.itemId === c.itemId &&
            l.legacyRarity !== void 0,
        ) ?? c)
      : c;
  if (i === 9 || (i === void 0 && a.defaultExceedType > 0))
    return s.find(
      (l) => l.family === "xun" && l.slot === t && l.itemId === a[ji[t]],
    );
  if (!(i !== void 0 && i >= 0 && i <= 6) && (i === 7 || i === 8)) {
    const l = r?.[t],
      h =
        typeof n == "number" && Number.isInteger(n) && n >= 1 && n <= 4 ? n : 4,
      d =
        typeof l == "number" && Number.isInteger(l) && l >= 1 && l <= 4 ? l : h;
    return {
      family: i === 8 ? "v1" : "x",
      slot: t,
      itemId: i === 8 ? 2 : 1,
      value: 0,
      grade: d,
      builtIn: !0,
      engineGrade: i,
    };
  }
}
function Kt(a, e) {
  return (
    a === e ||
    (!!a &&
      !!e &&
      a.family === e.family &&
      a.slot === e.slot &&
      a.itemId === e.itemId &&
      a.value === e.value &&
      a.grade === e.grade &&
      a.builtIn === e.builtIn &&
      a.engineGrade === e.engineGrade)
  );
}
function Xi(a, e, t, s, i = 7) {
  if (!s) return te(a, e, t, i);
  if (s.family !== me(a, e) || fe(a, s.slot))
    throw new Error("当前车辆无法预览此部件。");
  return te(a, e, { ...t, [s.slot]: s }, i);
}
function Yi(a) {
  const e = new Set();
  let t = 0;
  const s = (i) => {
    if (!i || typeof i != "object" || ArrayBuffer.isView(i) || e.has(i)) return;
    e.add(i);
    const n = i,
      r = n.base;
    if (
      (n.kind === "prs" &&
        r &&
        typeof r.stopTimeWord == "number" &&
        typeof r.frequency == "number" &&
        r.frequency > 0 &&
        r.stopTimeWord > 0 &&
        (t = Math.max(t, r.stopTimeWord / r.frequency)),
      n.kind === "float-controller" &&
        r &&
        typeof r.frequency == "number" &&
        r.frequency > 0)
    ) {
      const o = n.keys;
      if (
        o &&
        [0, 1, 3].includes(o.type) &&
        o.records.every((c) => c.byteLength >= 8)
      ) {
        const c = (h) =>
          new DataView(
            o.records[h].buffer,
            o.records[h].byteOffset,
            o.records[h].byteLength,
          );
        let l = o.records.length - 1;
        for (; l > 0;) {
          const h = c(l - 1),
            d = c(l);
          if (
            h.getFloat32(4, !0) !== d.getFloat32(4, !0) ||
            (o.type === 0 &&
              (h.byteLength < 16 ||
                d.byteLength < 16 ||
                h.getFloat32(12, !0) !== 0 ||
                d.getFloat32(8, !0) !== 0))
          )
            break;
          l--;
        }
        l >= 0 && (t = Math.max(t, c(l).getUint32(0, !0) / r.frequency));
      }
    }
    Object.values(n).forEach(s);
  };
  return (s(a), t);
}
function Zi(a, e, t) {
  const s = (g) => {
      const m = (y(a, g) ?? "").trim().split(/\s+/).map(Number);
      if (m.length !== 3 || !m.every(Number.isFinite))
        throw new Error(`部件镜头缺少 ${g}`);
      return m.map(Math.fround);
    },
    [i, n, r] = s("defaultCameraPos"),
    [o, c, l] = s("defaultSpotPos"),
    h = Number(y(a, "zoom"));
  if (!(h > 0)) throw new Error("部件镜头 zoom 无效");
  const d = Number(y(a, "fov") ?? 75),
    f = Number(y(a, "nearPlane") ?? 1),
    p = Number(y(a, "farPlane") ?? 100);
  if (!(d > 0 && d / h < 180 && f > 0 && p > f))
    throw new Error("部件镜头投影参数无效");
  const u = new zs(us(d / h, e / t), e / t, f, p);
  return (u.position.set(i, r, -n), u.lookAt(o, l, -c), u);
}
async function Je(a, e, t, s) {
  const i = (g) => {
      const m = a.exactCanonicalCandidates(g);
      if (m.length !== 1) throw new Error(`部件模型资源缺失或不唯一：${g}`);
      return m[0];
    },
    n =
      e.panel ??
      (
        await i("gui_/windowTemplate/itemPanels.bml").bytes().then(j)
      ).children.find(
        (g) => g.name === "Parts12" && y(g, "name") === "default",
      );
  if (!n) throw new Error("P3543 缺少 Parts12 镜头定义");
  const r = Zi(n, 128, 128),
    o = Number(y(n, "zoom")),
    c = Number(y(n, "fov") ?? 75),
    l = qs(await i(e.path).bytes()),
    h = e.path.slice(0, e.path.lastIndexOf("/") + 1),
    d = await Ds(
      l,
      a,
      e.path,
      (g) => ({ status: "found", entry: i(`${h}${g.name}.png`) }),
      { environment: t, stageBinding: s, advanceEnvironment: !1 },
    ),
    f = new Os();
  (f.add(d.object), d.reset(performance.now()));
  let p;
  const u = Yi(l);
  return {
    scene: f,
    camera: r,
    durationMs: u,
    seek: (g) => {
      if (!Number.isFinite(g) || g < 0) throw new Error("动画时间无效");
      ((p === void 0 || g < p) && d.reset(1e3),
        (p = Math.min(g, Math.max(0, u - 0.001))));
    },
    update: (g, m) => {
      ((r.aspect = g / m),
        (r.fov = us(c / o, r.aspect)),
        r.updateProjectionMatrix(),
        d.update(p === void 0 ? performance.now() : 1e3 + p, r, g, m));
    },
    dispose: () => d.dispose(),
  };
}
class Qi {
  constructor(e, t) {
    ((this.load = e), (this.onError = t));
  }
  load;
  onError;
  panels = new Map();
  loading = new Map();
  failed = new Set();
  disposed = !1;
  generation = 0;
  get(e) {
    if (this.disposed) return;
    const t = e.path,
      s = this.panels.get(t),
      i = this.generation;
    if (s || this.loading.get(t) === i || this.failed.has(t)) return s;
    (this.loading.set(t, i),
      this.load(e)
        .then((n) => {
          this.disposed || i !== this.generation
            ? n.dispose()
            : this.panels.set(t, n);
        })
        .catch((n) => {
          !this.disposed &&
            i === this.generation &&
            (this.failed.add(t), this.onError(t, n));
        })
        .finally(() => {
          this.loading.get(t) === i && this.loading.delete(t);
        }));
  }
  clear() {
    this.disposed ||
      (this.generation++,
      this.panels.forEach((e) => e.dispose()),
      this.panels.clear(),
      this.loading.clear(),
      this.failed.clear());
  }
  dispose() {
    this.disposed ||
      ((this.disposed = !0),
      this.generation++,
      this.panels.forEach((e) => e.dispose()),
      this.panels.clear());
  }
}
const Ji = new Map([
  ["Unique", 4],
  ["Legend", 3],
  ["Rare", 5],
  ["Normal", 2],
  ["Special", 1],
  ["Ultimate", 6],
  ["Epic", 7],
]);
function ea(a) {
  const e = new Map();
  if (a.name !== "TuneAbility") return e;
  for (const t of a.children.filter((s) => s.name === "Tune")) {
    const s = Number(L(t, "groupId")),
      i = Number(L(t, "id"));
    if (!Number.isInteger(s) || s < 1 || !Number.isInteger(i) || i < 1)
      continue;
    const n = s * 100 + i;
    e.set(n, {
      id: n,
      groupId: s,
      level: i,
      title: L(t, "name") ?? "",
      description: (L(t, "desc") ?? "").replace(
        /\[\/?color(?::[^\]]+)?\]/g,
        "",
      ),
    });
  }
  return e;
}
function ta(a) {
  const e = new Map(),
    t = a.children.find((s) => s.name === "exceedTypeList");
  for (const s of t?.children.filter((i) => i.name === "exceedType") ?? []) {
    const i = Number(L(s, "id")),
      n = Number(L(s, "textureType")),
      r = Number(L(s, "exceedAccel")),
      o = Number(L(s, "exceedTime"));
    [i, n, r, o].every(Number.isInteger) &&
      i > 0 &&
      n > 0 &&
      r >= 1 &&
      r <= 3 &&
      o >= 1 &&
      o <= 3 &&
      e.set(i, { id: i, textureType: n, accelLevel: r, timeLevel: o });
  }
  return e;
}
function sa(a) {
  const e = ta(a),
    t = new Map(),
    s = a.children.find((n) => n.name === "exceedTypeChangeFee");
  for (const n of s?.children ?? []) {
    const r = Ji.get(n.name),
      o = Number(L(n, "ethisSpanner")),
      c = Number(L(n, "lucci")),
      l = new Set(
        (L(n, "ingredientEnableGrade") ?? "")
          .split(",")
          .map(Number)
          .filter((h) => Number.isInteger(h) && h > 0),
      );
    r !== void 0 &&
      Number.isInteger(o) &&
      o >= 0 &&
      Number.isInteger(c) &&
      c >= 0 &&
      l.size > 0 &&
      t.set(r, {
        quality: r,
        wrenchCount: o,
        lucci: c,
        ingredientQualities: l,
      });
  }
  const i = (n) =>
    new Set(
      a.children
        .find((r) => r.name === n)
        ?.children.map((r) => Number(L(r, "id")))
        .filter((r) => Number.isInteger(r) && r > 0) ?? [],
    );
  return {
    types: e,
    fees: t,
    changeOnlyKarts: i("exceedTypeChangeOnly"),
    excludedIngredients: i("notUseAsExceedTypeChange"),
    unableTargets: i("unableExceedTypeChange"),
  };
}
const Vt = [
    "tuning_performslot_speed",
    "tuning_pointTextBg",
    "tuning_pointTextBg_none",
    ...Array.from({ length: 6 }, (a, e) => `tuning_progressbar_0${e}`),
    ...Array.from({ length: 9 }, (a, e) => `tuningBoard_icon_${e + 1}`),
    ...Array.from({ length: 5 }, (a, e) => `tuning_mark_${e + 1}`),
    ...Array.from({ length: 10 }, (a, e) => `icon_exceedM_${e + 1}`),
    ...Array.from(
      { length: 3 },
      (a, e) => `tuning_exceedProgressbar_0${e + 1}`,
    ),
  ],
  Ht = [...Array.from({ length: 10 }, (a, e) => `icon_exceedB_${e + 1}`)],
  jt = new WeakMap();
function Wt(a, e = "kartune", t = 1600) {
  let s = jt.get(a);
  s || ((s = new Map()), jt.set(a, s));
  const i = `${e}:${t}`;
  let n = s.get(i);
  return (
    n ||
      ((n = ia(a, e, t)),
      s.set(i, n),
      n.catch(() => {
        s.get(i) === n && s.delete(i);
      })),
    n
  );
}
async function ia(a, e, t) {
  const s = _t(t),
    i = `stage_/${e}/`,
    n = async ($) => {
      const N = a.exactCanonicalCandidates($);
      if (N.length !== 1) throw new Error(`车辆升级资源缺失或不唯一：${$}`);
      return j(await N[0].bytes());
    },
    [r, o, c, l] = await Promise.all([
      n(`${i}stage_${s.width}.bml`),
      n(`${i}stage_stringBag.bml`),
      e === "tuning" ? n("gui_/windowTemplate/tuneItemCard.bml") : void 0,
      n("gui_/monocoque/frame.bml"),
    ]),
    h = new Map(),
    d = new Map();
  for (const $ of [
    "DefaultAlphaStaticButton",
    "TextButton",
    "ComboBox",
    "ComboList",
  ]) {
    const N = l.children.find((A) => A.name === $);
    for (const A of N?.children ?? []) d.set(`${$}/${A.name}`, ve(A));
  }
  const f = l.children.find(($) => $.name === "DefaultFocusedButton");
  if (!f && e === "tuning")
    throw new Error("改装页面缺少 DefaultFocusedButton 原版皮肤。");
  for (const $ of f?.children ?? []) h.set($.name, ve($));
  const p = new Map(),
    u = new Map();
  let g, m, b;
  if (e === "kartune") {
    const $ = a.exactCanonicalCandidates("zeta_/cn/enchant/desc.xml")[0],
      N = a.exactCanonicalCandidates("zeta_/cn/engine/exceedTypeChange.xml")[0];
    ($ && (g = ea(Z(await $.bytes()).root)),
      N && ((b = sa(Z(await N.bytes()).root)), (m = b.types)));
  }
  if (e === "tuning") {
    const $ = a.exactCanonicalCandidates("etc_/baseStringBag.xml")[0];
    if ($)
      for (const A of Z(await $.bytes()).root.children) {
        const E = A.children.find((M) => L(M, "c") === "cn");
        E && p.set(L(A, "n"), L(E, "v") ?? "");
      }
    const N = a.exactCanonicalCandidates("etc_/itemInfoColorByLevel.xml")[0];
    if (N) {
      const A = Z(await N.bytes()).root.children.find(
        (E) => L(E, "name") === "itemNameLabel",
      );
      for (const E of A?.children ?? [])
        u.set(
          Number(L(E, "grade")),
          `rgb(${L(E, "color").split(/\s+/).slice(1).join(",")})`,
        );
    }
  }
  for (const $ of o.children) {
    const N = $.children.find((A) => y(A, "c") === "cn");
    N && p.set(y($, "n"), y(N, "v") ?? "");
  }
  const P = new Map(),
    C = new Map();
  if (e === "tuning") {
    const N = (await n("gui_/windowTemplate/itemPanels.bml")).children.find(
      (A) => A.name === "Kart" && y(A, "name") === "default",
    );
    if (!N) throw new Error("改装页面缺少原版 Kart ItemPanel 配置。");
    C.set("factoryKartItemPanel", N);
  }
  const S = new Map(),
    w = new Map();
  let k, x;
  const T = new Set(["menuTab", "backGround_1920"]),
    v = new Set(),
    _ = ($) => {
      if (T.has(y($, "name") ?? "")) return;
      for (const A of ["texture", "image"]) {
        const E = y($, A);
        E && v.add(E);
      }
      const N = y($, "autoLoadImage");
      if (N) for (let A = 1; A <= 4; A++) v.add(se(N, A));
      $.children.forEach(_);
    };
  (_(r),
    h.forEach(($) => v.add($.texture)),
    d.forEach(($) => v.add($.texture)),
    c && _(c),
    e === "kartune" &&
      (Vt.forEach(($) => v.add($)), Ht.forEach(($) => v.add($))));
  try {
    if (e === "tuning") {
      const E = a.exactCanonicalCandidates(
        "gui_/font/SourceHanSansCN-Bold.otf",
      )[0];
      if (E) {
        const M = await E.bytes(),
          G = new DataView(M.buffer, M.byteOffset, M.byteLength);
        let F = 0,
          B = 0;
        for (let O = 0; O < G.getUint16(4); O++) {
          const q = 12 + O * 16,
            V = String.fromCharCode(...M.slice(q, q + 4)),
            D = G.getUint32(q + 8);
          (V === "head" && (F = G.getUint16(D + 18)),
            V === "hhea" &&
              (B = G.getInt16(D + 4) - G.getInt16(D + 6) + G.getInt16(D + 8)));
        }
        (F && B && (x = B / F), (k = await St("P3543 Factory", M)));
      }
    }
    const N = (
      await Promise.allSettled(
        [...v].map(async (E) => {
          const M = [E.replace(/@zz$/, "@cn"), E],
            G = [
              i,
              "stage_/common/",
              "stage_/garageX/",
              "gui_/windowTemplate/",
              "gui_/monocoque/",
              "dialog2_/exceedTypeChange/",
            ]
              .flatMap((B) => M.map((O) => `${B}${O}.png`))
              .map((B) => a.exactCanonicalCandidates(B)[0])
              .find(Boolean);
          if (!G) return;
          const F = new Blob([await G.bytes()], { type: "image/png" });
          (S.set(E, await createImageBitmap(F)),
            w.set(E, URL.createObjectURL(F)));
        }),
      )
    ).find((E) => E.status === "rejected");
    if (N?.status === "rejected") throw N.reason;
    if (e === "kartune" && Vt.some((E) => !S.has(E)))
      throw new Error("车辆升级技能图标或强化条缺失。");
    if (e === "kartune" && Ht.some((E) => !S.has(E)))
      throw new Error("超负荷类型图标资源缺失。");
    if (
      !S.has(
        e === "kartune"
          ? `garage_img_tuningBG_${s.width}`
          : `garage_img_floterBG_${s.width}`,
      )
    )
      throw new Error("车辆改装/升级背景缺失。");
    const A = (E, M, G) => {
      const F = y(E, "name");
      if (T.has(F ?? "") || E.name === "Dialog" || /Popup|Dialog/.test(F ?? ""))
        return;
      const B =
          y(E, "image") ??
          y(E, "texture") ??
          se(y(E, "autoLoadImage") ?? "", 1),
        O = Y(
          { ...E, attributes: E.attributes.filter((D) => D.name !== "frame") },
          M,
          void 0,
          S.get(B),
        ),
        q = F ? `${G}/${F}` : G;
      F && (P.set(q, O), C.set(q, E), P.has(F) || (P.set(F, O), C.set(F, E)));
      const V = y(E, "text");
      if (!F && V?.startsWith("#sb(")) {
        const D = `${G}/@text:${V}`;
        (P.set(D, O), C.set(D, E));
      }
      (!F &&
        y(E, "text") === "#sb(tuneState)" &&
        (P.set("tuneStateCaption", O), C.set("tuneStateCaption", E)),
        E.children.forEach((D) => A(D, O, q)));
    };
    return (
      A(r, { x: 0, y: 0, width: s.width, height: s.height }, ""),
      c && A(c, { x: 0, y: 0, width: 192, height: 114 }, "/factoryCard"),
      {
        stage: s,
        rects: P,
        nodes: C,
        images: S,
        urls: w,
        strings: p,
        actionFrames: h,
        windowFrames: d,
        qualityColors: u,
        enchantDescriptions: g,
        exceedTypes: m,
        exceedTypeChange: b,
        fontFamily: k ? "P3543 Factory" : void 0,
        fontLineScale: x,
        dispose: () => {
          (k && (Ce(k), (k = void 0)),
            S.forEach((E) => E.close()),
            S.clear(),
            w.forEach((E) => URL.revokeObjectURL(E)),
            w.clear());
        },
      }
    );
  } catch ($) {
    throw (
      k && Ce(k),
      S.forEach((N) => N.close()),
      w.forEach((N) => URL.revokeObjectURL(N)),
      $
    );
  }
}
const H = Math.fround,
  et = {
    DragFactor: "dragFactor",
    ForwardAccelForce: "forwardAccel",
    TransAccelFactor: "transAccelFactor",
    TeamBoosterTime: "teamBoosterTime",
    NormalBoosterTime: "normalBoosterTime",
    StartBoosterTimeSpeed: "startBoosterTimeSpeed",
    DriftMaxGauge: "driftMaxGauge",
    DriftEscapeForce: "driftEscapeForce",
    CornerDrawFactor: "cornerDrawFactor",
  },
  aa = [
    "DescEngineGrade",
    "DescBalance",
    "DescStability",
    "DescEnchantCap",
    "DescCornering",
  ],
  na = [
    "集气速度",
    "加速时间",
    "加速最高速度",
    "竞速",
    "弯道",
    "稳定性",
    "平衡",
    "强化力量",
  ],
  ra = new Set([
    "DriftEscapeForce",
    "TransAccelFactor",
    "NormalBoosterTime",
    "DriftMaxGauge",
  ]);
function ee(a) {
  const e = H(a);
  if (!Number.isFinite(e)) throw new Error("车辆雷达参数不是有效有限数值。");
  return e;
}
function ye(a, e, t) {
  const s = L(a, e);
  if (s === void 0 && t !== void 0) return t;
  if (s === void 0 || !s.trim()) throw new Error(`车辆雷达缺少 ${e}。`);
  return ee(Number(s));
}
function oa(a) {
  const e = Object.entries(et).map(([t, s]) => {
    const i = t === "StartBoosterTimeSpeed" ? ye(a, "StartBoosterTime", 0) : 0,
      n = ye(a, t, i);
    return [s, ra.has(t) && n === -1e5 ? 0 : n];
  });
  return Object.fromEntries([...e, ...aa.map((t) => [t, ye(a, t, 0)])]);
}
function ca(a) {
  if (a.name !== "weightConst") throw new Error("车辆雷达权重根节点无效。");
  const e = new Map();
  for (const t of Object.keys(et)) {
    const s = a.children.filter(
      (n) => n.name === "weight" && L(n, "name") === t,
    );
    if (s.length !== 1) throw new Error(`车辆雷达权重缺失或重复：${t}。`);
    const i = {
      enchantVariable: ye(s[0], "enchantVariable"),
      generalWeight: ye(s[0], "generalWeight"),
      enchantWeight: ye(s[0], "enchantWeight"),
      publicCutDown: ye(s[0], "publicCutDown"),
    };
    if (!i.enchantVariable) throw new Error(`车辆雷达权重分母为零：${t}。`);
    e.set(t, i);
  }
  return e;
}
function la(a, e, t) {
  const s = new Map(),
    i = new Map();
  for (const l of Object.keys(et)) {
    const h = t.get(l);
    if (!h || !h.enchantVariable || !Object.values(h).every(Number.isFinite))
      throw new Error(`车辆雷达权重无效：${l}。`);
    const d = et[l],
      f = ee(a[d]),
      p = ee(e[d]),
      u = Math.max(
        0,
        H(
          H(H(H(f - h.publicCutDown) / h.enchantVariable) * h.generalWeight) *
            ee(a.DescEngineGrade),
        ),
      ),
      g = H(
        H(H(H(p - f) / h.enchantVariable) * h.enchantWeight) *
          ee(e.DescEngineGrade),
      );
    (s.set(l, ee(u)), i.set(l, ee(Math.max(0, H(u + g)))));
  }
  const n = (l, h) => [
      l.get("DriftMaxGauge"),
      H(
        H(l.get("TeamBoosterTime") + l.get("NormalBoosterTime")) +
          l.get("StartBoosterTimeSpeed"),
      ),
      l.get("TransAccelFactor"),
      H(l.get("DragFactor") + l.get("ForwardAccelForce")),
      H(
        H(l.get("DriftEscapeForce") + l.get("CornerDrawFactor")) +
          ee(h.DescCornering),
      ),
      ee(h.DescStability),
      ee(h.DescBalance),
      ee(h.DescEnchantCap),
    ],
    r = (l) => H(H(H(Math.min(70, Math.max(20, l)) - 10) * 100) / 60),
    o = n(s, a),
    c = n(i, e);
  return na.map((l, h) => ({ label: l, base: r(o[h]), enhanced: r(c[h]) }));
}
function ha(a, e, t, s) {
  const i = Us(Ks({ ...e, ...a, defaultExceedType: 0 }, s, 7), t);
  return { ...a, ...i };
}
const Xt = new WeakMap(),
  lt = new WeakMap();
function da(a, e) {
  let t = Xt.get(a);
  t || ((t = new Map()), Xt.set(a, t));
  const s = t.get(e);
  if (s) return s;
  let i = lt.get(a);
  i ||
    ((i = (async () => {
      const r = a.exactCanonicalCandidates("zeta_/cn/enchant/weightConst.xml");
      if (r.length !== 1) throw new Error("车辆雷达权重资源缺失或不唯一。");
      return ca(Z(await r[0].bytes()).root);
    })()),
    lt.set(a, i),
    i.catch(() => lt.delete(a)));
  const n = Promise.all([ps(a, e), i]).then(([r, o]) => ({
    input: oa(r.value.body),
    weights: o,
  }));
  return (t.set(e, n), n.catch(() => t.delete(e)), n);
}
function Yt(a, e, t) {
  const s = Math.fround,
    i = s(
      s(s(s(6.283185005187988 / 24) * 3) * (e + 1)) - s(0.3926990032196045),
    ),
    n = s(Math.min(a.width, a.height) * s(0.4));
  return {
    x: a.x + a.width / 2 + s((s(s(Math.sin(i)) * n) * t) / 100),
    y: a.y + a.height / 2 + s((s(s(Math.cos(i)) * n) * t) / 100),
  };
}
function ga(a, e, t) {
  if (t.length !== 8) return;
  a.save();
  const s = (i, n, r) => {
    (a.beginPath(),
      i.forEach((o, c) => {
        const l = Yt(e, c, o);
        c ? a.lineTo(l.x, l.y) : a.moveTo(l.x, l.y);
      }),
      a.closePath(),
      (a.fillStyle = n),
      a.fill(),
      r && ((a.strokeStyle = r), (a.lineWidth = 1), a.stroke()));
  };
  for (let i = 5; i >= 1; i--)
    s(
      Array(8).fill(i * 20),
      i % 2 ? "#182a45" : "#1b355b",
      i === 5 ? "#667482" : void 0,
    );
  (s(
    t.map((i) => i.enhanced),
    "rgba(80,193,255,.45)",
    "#7dd8ff",
  ),
    s(
      t.map((i) => i.base),
      "#1499ed",
    ),
    (a.font = '15px "P3528 Source Han Sans CN Garage"'),
    (a.fillStyle = "white"),
    (a.shadowColor = "black"),
    (a.shadowBlur = 2),
    (a.textBaseline = "middle"),
    t.forEach((i, n) => {
      const r = Yt(e, n, 125),
        o = e.x + e.width / 2;
      ((a.textAlign = r.x < o ? "right" : "left"),
        i.label === "加速最高速度"
          ? (a.fillText("加速", r.x, r.y - 10),
            a.fillText("最高速度", r.x, r.y + 10))
          : a.fillText(i.label, r.x, r.y));
    }),
    a.restore());
}
const Ye = [2, 3, 4];
function ua(a, e = Math.random) {
  return a !== "random"
    ? a
    : Ye[Math.min(Ye.length - 1, Math.max(0, Math.floor(e() * Ye.length)))];
}
function $s(a, e) {
  return a.engineGrade !== 9 || !e
    ? "hidden"
    : a.kartType === 1
      ? "item-kart"
      : e?.unableTargets.has(a.itemId)
        ? "unable"
        : a.level === 5
          ? "enabled"
          : "level";
}
const It = 15,
  pa = It - 2;
function st(a) {
  return { ...a, x: a.x + It };
}
function fa(a) {
  const e = st(a);
  return { ...e, x: e.x + 3 };
}
function ma(a, e) {
  const i = a.x + 8,
    n = st(e);
  return {
    x: i,
    y: a.y,
    width: Math.max(0, Math.min(a.width - 8, n.x - 8 - i)),
    height: a.height,
  };
}
function wa(a, e) {
  return { ...a, width: Math.max(a.width, e - a.x - 20) };
}
function ya(a, e) {
  const t = /\[color:(\d+) (\d+) (\d+) (\d+)\]([\s\S]*?)\[\/color\]/g;
  let s = 0;
  for (const i of e.matchAll(t)) {
    const n = i.index ?? 0;
    a.append(document.createTextNode(e.slice(s, n)));
    const r = document.createElement("span");
    r.textContent = i[5];
    const [o, c, l, h] = i.slice(1, 5).map(Number);
    ((r.style.color = `rgba(${c}, ${l}, ${h}, ${o / 255})`),
      a.append(r),
      (s = n + i[0].length));
  }
  a.append(document.createTextNode(e.slice(s)));
}
class va {
  constructor(e, t, s, i = () => {}) {
    ((this.assets = e),
      (this.onChange = t),
      (this.onSelectSkill = s),
      (this.onExceedTypeChange = i),
      (this.element.className = "garage-progression"),
      (this.classicContainer.className = "garage-upgrade-layout"),
      (this.classicContainer.dataset.upgradeLayout = "classic"),
      (this.engine12Container.className = "garage-upgrade-layout"),
      (this.engine12Container.dataset.upgradeLayout = "engine12Data"),
      (this.engine12Container.hidden = !0),
      this.element.append(this.classicContainer, this.engine12Container),
      (this.activeContainer = this.classicContainer));
  }
  assets;
  onChange;
  onSelectSkill;
  onExceedTypeChange;
  element = document.createElement("div");
  classicContainer = document.createElement("div");
  engine12Container = document.createElement("div");
  activeContainer;
  radarRevision = 0;
  radar;
  framedControls = new Map();
  reset(e) {
    (this.radarRevision++,
      (this.radar = void 0),
      e === "classic"
        ? this.classicContainer.replaceChildren()
        : e === "xun"
          ? this.engine12Container.replaceChildren()
          : (this.classicContainer.replaceChildren(),
            this.engine12Container.replaceChildren()),
      this.framedControls.clear(),
      !e || e === "classic"
        ? ((this.classicContainer.hidden = !1),
          (this.engine12Container.hidden = !0),
          (this.activeContainer = this.classicContainer),
          e || delete this.element.dataset.engineGradeLayout)
        : ((this.classicContainer.hidden = !0),
          (this.engine12Container.hidden = !1),
          (this.activeContainer = this.engine12Container)));
  }
  get previewRect() {
    return this.assets.rects.get("kartPreview");
  }
  rect(e) {
    const t = this.assets.rects.get(e);
    if (!t) throw new Error(`升级页缺少 ${e}`);
    return t;
  }
  place(e, t) {
    (Object.assign(e.style, {
      position: "absolute",
      left: `${t.x}px`,
      top: `${t.y}px`,
      width: `${t.width}px`,
      height: `${t.height}px`,
    }),
      this.activeContainer.append(e));
  }
  styleFromNode(e, t) {
    const s = this.assets.nodes.get(t);
    if (!s) return;
    const i = new Set(
      (y(s, "textAlign") ?? "")
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean),
    );
    (i.has("vcenter") &&
      ((e.style.display = "flex"), (e.style.alignItems = "center")),
      i.has("right")
        ? (e.style.justifyContent = "flex-end")
        : i.has("center") || i.has("hcenter")
          ? (e.style.justifyContent = "center")
          : i.has("left") && (e.style.justifyContent = "flex-start"));
    const n = y(s, "textRender") ?? "",
      r = /([0-9]+)$/.exec(n)?.[1];
    (r && (e.style.fontSize = `${r}px`),
      n.startsWith("bold") && (e.style.fontWeight = "700"));
    const o = y(s, "textColor");
    if (o === "white") e.style.color = "#fff";
    else if (o) {
      const [c, l, h, d] = o.split(/\s+/).map(Number);
      [c, l, h, d].every(Number.isFinite) &&
        (e.style.color = `rgba(${l}, ${h}, ${d}, ${c / 255})`);
    }
    n.startsWith("outline") && e.classList.add("garage-native-outline");
  }
  label(e, t, s) {
    const i = document.createElement("div");
    ((i.textContent = e),
      (i.className = "garage-native-label"),
      s && this.styleFromNode(i, s),
      this.place(i, t));
  }
  nativeLabel(e, t) {
    const s = this.assets.nodes.get(e),
      i = s && y(s, "text"),
      n = i?.match(/^#sb\((.+)\)$/)?.[1],
      r = (n ? this.assets.strings.get(n) : i) ?? t,
      o = document.createElement("div");
    return (
      (o.textContent = r.replaceAll(
        "|",
        `
`,
      )),
      (o.className = "garage-native-label"),
      this.styleFromNode(o, e),
      this.place(o, this.rect(e)),
      o
    );
  }
  texture(e, t) {
    const s = this.assets.urls.get(e);
    if (!s) return;
    const i = document.createElement("img");
    ((i.src = s),
      (i.alt = ""),
      (i.className = "garage-tuning-art"),
      this.place(i, t));
  }
  button(e, t, s, i = !1, n = 0) {
    const r = document.createElement("button");
    ((r.type = "button"),
      r.setAttribute("aria-label", t),
      (r.title = t),
      (r.disabled = i));
    const o = this.assets.nodes.get(e),
      c = o && y(o, "autoLoadImage");
    if (((r.className = "garage-native-button"), c))
      for (let h = 1; h <= 4; h++) {
        const d = this.assets.urls.get(se(c, h));
        d && r.style.setProperty(`--button-${h}`, `url("${d}")`);
      }
    else r.textContent = t;
    r.onclick = s;
    const l = this.rect(e);
    return (
      this.place(r, { ...l, x: l.x + n }),
      o && y(o, "frame") && this.framedControls.set(e, r),
      r
    );
  }
  update(e, t, s, i, n, r, o = !1) {
    const c = s === 9;
    if ((this.reset(c ? "xun" : "classic"), c !== (e.kind === "xun")))
      throw new Error("升级数据类型与 engineGrade 布局不一致。");
    if (
      ((this.element.dataset.engineGradeLayout = c
        ? "xun"
        : s === 8
          ? "v1"
          : "classic"),
      (this.classicContainer.hidden = c),
      (this.engine12Container.hidden = !c),
      (this.activeContainer = c
        ? this.engine12Container
        : this.classicContainer),
      !t)
    ) {
      this.label(
        o
          ? "暂无可升级车辆"
          : "请从下方列表选择可升级车辆（9 代及以下或 XUN）。",
        { x: 22, y: 210, width: 700, height: 40 },
      );
      return;
    }
    const l = e.level === 5 ? e : Vs(e, s);
    if (
      (this.button(
        c ? "tuningLevelUp" : "카트레벨업",
        e.level === 5 ? "车辆已满级" : `车辆升至 Lv.${l.level}（本地测试）`,
        () => this.onChange(l),
        e.level === 5,
      ),
      e.kind === "classic")
    ) {
      const h = document.createElement("select");
      (h.setAttribute(
        "aria-label",
        this.assets.strings.get("specialSlotSelect") ?? "特殊属性",
      ),
        (h.className = "garage-native-combo"));
      const d = document.createElement("option");
      ((d.textContent =
        this.assets.strings.get("specialSlotSelect") ??
        this.assets.strings.get("emptySlot") ??
        "属性为空"),
        (d.value = ""),
        h.append(d));
      const f = i?.active
        ? i.abilities.filter((b) => this.assets.enchantDescriptions?.has(b))
        : [];
      for (const b of f) {
        const P = this.assets.enchantDescriptions.get(b),
          C = document.createElement("option");
        ((C.value = String(b)), (C.textContent = P.title), h.append(C));
      }
      ((h.disabled = f.length === 0),
        f.length && (h.value = String(f[0])),
        this.place(h, this.rect("specialSlotSelect")),
        this.framedControls.set("specialSlotSelect", h));
      const p = document.createElement("div"),
        u = document.createElement("div");
      ((p.className = "garage-native-label"),
        (u.className = "garage-native-label"),
        this.styleFromNode(p, "enchantTitle"),
        this.styleFromNode(u, "enchantDesc"),
        this.place(p, this.rect("enchantTitle")),
        this.place(u, this.rect("enchantDesc")));
      const g = () => {
        const b = this.assets.enchantDescriptions?.get(Number(h.value));
        ((p.textContent = b?.title ?? ""),
          (u.textContent = b?.description ?? ""));
      };
      ((h.onchange = g),
        g(),
        this.nativeLabel(
          "/backGround/back_img/@text:#sb(pointLeft)",
          "可使用强化点",
        ),
        this.label(String(we(e)), this.rect("pointLeft"), "pointLeft"));
      for (const [b, P] of ["Speed", "Cornering", "Drift", "Booster"].entries())
        (this.label(
          ["速度", "弯道", "漂移", "加速器"][b],
          this.rect(`point${P}Cat`),
          `point${P}Cat`,
        ),
          this.label(String(e.points[b]), this.rect(`point${P}`), `point${P}`),
          this.button(
            `point${P}Plus`,
            `增加${["速度", "弯道", "漂移", "加速器"][b]}强化点`,
            () => this.onChange(ze(e, b, 1)),
            e.points[b] === 10 || we(e) === 0,
          ),
          this.button(
            `point${P}Minus`,
            `减少${["速度", "弯道", "漂移", "加速器"][b]}强化点`,
            () => this.onChange(ze(e, b, -1)),
            e.points[b] === 0,
          ));
      (this.button(
        "pointClear",
        "重置强化点",
        () => this.onChange({ ...ce(!1), level: e.level }),
        e.points.every((b) => b === 0),
      ),
        this.button(
          "pointApply",
          this.assets.strings.get("apply") ?? "适用",
          () => {},
          !0,
        ));
    } else {
      const h = "/backGround/engine12Data/tuningPanel/skillTuning";
      (this.nativeLabel(`${h}/@text:#sb(tuningSkill)`, "性能强化"),
        this.nativeLabel(`${h}/@text:#sb(helpTuningSkillStr)`, ""));
      const d = we(e);
      (this.nativeLabel(`${h}/@text:#sb(haveTuningPoint)`, "持有强化点数"),
        this.texture(
          d ? "tuning_pointTextBg" : "tuning_pointTextBg_none",
          this.rect(`${h}/haveTuningPoint`),
        ));
      const f = document.createElement("div");
      ((f.textContent = String(d)),
        (f.className = "garage-tuning-number"),
        f.setAttribute("aria-label", `可用强化点：${d}`),
        this.place(f, this.rect(`${h}/curTuningPoint`)));
      for (const [m, b] of e.skills.entries()) {
        const P = `${h}/tuningSkill${m + 1}`;
        (this.texture(
          "tuning_performslot_speed",
          this.rect(`${P}/skillSlot${m + 1}`),
        ),
          this.texture(`tuningBoard_icon_${b.id}`, this.rect(`${P}/curSkill`)));
        const C = document.createElement("div");
        ((C.textContent = fs.find((k) => k.id === b.id)?.label ?? ""),
          (C.title = C.textContent),
          (C.className = "garage-tuning-skill-name"),
          this.styleFromNode(C, `${P}/skillName`),
          this.place(
            C,
            ma(this.rect(`${P}/skillName`), this.rect(`${P}/skillGauge`)),
          ));
        const S = document.createElement("div");
        ((S.className = "garage-tuning-gauge"),
          S.setAttribute("role", "meter"),
          S.setAttribute("aria-label", `第${m + 1}栏强化进度`),
          S.setAttribute("aria-valuemin", "0"),
          S.setAttribute("aria-valuemax", "5"),
          S.setAttribute("aria-valuenow", String(b.points)));
        const w = this.assets.urls.get(`tuning_progressbar_0${b.points}`);
        (w && (S.style.backgroundImage = `url("${w}")`),
          this.place(S, st(this.rect(`${P}/skillGauge`))),
          this.button(`${P}/skillChange`, `更换第${m + 1}栏技能`, () =>
            this.onSelectSkill(m),
          ),
          this.label(
            `${b.points} / 5`,
            fa(this.rect(`${P}/skillTuningPoint`)),
            `${P}/skillTuningPoint`,
          ),
          this.button(
            `${P}/plusTuningPoint`,
            `增加第${m + 1}栏强化点`,
            () => this.onChange(ze(e, m, 1)),
            b.points === 5 || we(e) === 0,
            pa,
          ),
          this.button(
            `${P}/minusTuningPoint`,
            `减少第${m + 1}栏强化点`,
            () => this.onChange(ze(e, m, -1)),
            b.points === 0,
            It,
          ));
      }
      const p = "/backGround/engine12Data/tuningPanel/exceedType";
      (this.nativeLabel(`${p}/@text:#sb(exceedType)`, "超负荷类型"),
        this.nativeLabel(`${p}/@text:#sb(curExceedType)`, "现在类型"),
        this.nativeLabel(`${p}/@text:#sb(exceedAccel)`, "超负荷加速度"),
        this.nativeLabel(`${p}/@text:#sb(exceedTime)`, "超负荷时间"),
        this.texture("tuning_Exceedslot", this.rect(`${p}/exceedSlot`)));
      const u = n === void 0 ? void 0 : this.assets.exceedTypes?.get(n);
      if (u) {
        (this.texture(
          `icon_exceedM_${u.textureType}`,
          this.rect(`${p}/exceedIcon`),
        ),
          this.texture(
            `tuning_exceedProgressbar_0${u.accelLevel}`,
            this.rect(`${p}/exceedAccelGauge`),
          ),
          this.texture(
            `tuning_exceedProgressbar_0${u.timeLevel}`,
            this.rect(`${p}/exceedTimeGauge`),
          ));
        const m = this.assets.strings.get(`exceedDesc${u.id}`);
        if (m) {
          const b = document.createElement("div");
          ((b.className = "garage-native-label garage-exceed-description"),
            ya(b, m),
            this.styleFromNode(b, `${p}/exceedDesc`),
            this.place(
              b,
              wa(this.rect(`${p}/exceedDesc`), this.assets.stage.width),
            ));
        }
      }
      const g = $s(
        {
          engineGrade: s,
          itemId: r?.itemId ?? 0,
          kartType: r?.kartType,
          level: e.level,
        },
        this.assets.exceedTypeChange,
      );
      if (g !== "hidden") {
        const m = this.button(
          `${p}/exceedTypeChangeBtn`,
          "变更超负荷类型",
          this.onExceedTypeChange,
          g !== "enabled",
        );
        m.className += " garage-exceed-type-change-button";
      }
      if (g !== "enabled" && g !== "hidden") {
        const m =
          g === "item-kart"
            ? "immutableItemKart"
            : g === "unable"
              ? "unableExceedTypeChangeKart"
              : "higherTuningLevel5";
        (this.texture("tuning_icon_lock", this.rect(`${p}/${m}`)),
          (this.nativeLabel(`${p}/${m}/@text:#sb(${m})`, m).className +=
            " garage-exceed-lock-label"));
      }
    }
  }
  async updateRadar(e, t, s, i, n) {
    const r = ++this.radarRevision;
    if (((this.radar = void 0), i.kind !== "classic")) return;
    const o = document.createElement("div");
    (o.setAttribute("role", "img"),
      o.setAttribute("aria-label", "车辆性能雷达加载中"));
    const c = this.activeContainer;
    ((this.activeContainer = this.classicContainer),
      this.place(o, this.rect("resultGraph")),
      (this.activeContainer = c));
    try {
      const l = await da(e, t);
      if (r !== this.radarRevision) return;
      this.radar = la(l.input, ha(l.input, s, i, n), l.weights);
      const h = this.radar
        .map(
          (d) => `${d.label}：${d.base.toFixed(1)} → ${d.enhanced.toFixed(1)}`,
        )
        .join("；");
      (o.setAttribute(
        "aria-label",
        `车辆性能雷达，基础值与本地强化/改装值。${h}`,
      ),
        (o.title = `原始车辆参数 / 本地强化及改装草稿（非比赛速度档位）
${h}`));
    } catch (l) {
      if (r !== this.radarRevision) return;
      (o.setAttribute("role", "status"),
        o.removeAttribute("aria-label"),
        (o.textContent = `性能雷达暂不可用：${l instanceof Error ? l.message : String(l)}`));
    }
  }
  dispose() {
    (this.radarRevision++, (this.radar = void 0));
  }
  draw(e, t) {
    const s = t === 9;
    for (const i of [
      "backGround",
      ...(s ? ["tuningPanel"] : ["tuning_enhance", "back_img"]),
    ]) {
      const n = this.assets.nodes.get(i);
      if (!n) continue;
      const r = this.assets.images.get(y(n, "image") ?? ""),
        o = this.rect(i);
      r && e.drawImage(r, o.x, o.y, o.width, o.height);
    }
    if (!s)
      for (const [i, n] of this.framedControls) {
        const r = this.assets.nodes.get(i),
          o = r && y(r, "frame");
        if (!o) continue;
        const c = n.matches,
          l = n.disabled
            ? "Disabled"
            : c?.call(n, ":active")
              ? "Clicked"
              : c?.call(n, ":hover")
                ? "MouseOn"
                : "Normal",
          h =
            this.assets.windowFrames?.get(`${o}/${l}`) ??
            this.assets.windowFrames?.get(`${o}/Normal`),
          d = h && this.assets.images.get(h.texture);
        h && d && be(e, h, d, this.rect(i));
      }
    !s && this.radar && ga(e, this.rect("resultGraph"), this.radar);
  }
}
function he(a, e, t) {
  (a.classList.add("garage-skill-action", `garage-skill-action-${t}`),
    e &&
      ((a.style.fontSize = `${e.fontSize}px`),
      e.colors.forEach((s, i) =>
        a.style.setProperty(`--action-text-${i}`, s),
      )));
}
const ba = "立即重置当前车辆的粒子改记录？";
function ht(a) {
  return a.abilities.map((e) => js(e) ?? {});
}
function Zt(a) {
  return `${a.active ? 1 : 0}:${a.abilities.join(",")}`;
}
function xa(a) {
  let e = !1;
  return (
    a.addEventListener("pointerenter", () => {
      e = !a.disabled;
    }),
    a.addEventListener("pointerleave", () => {
      e = !1;
    }),
    a.addEventListener("pointercancel", () => {
      e = !1;
    }),
    () => e && !a.disabled
  );
}
function Ca(a) {
  const e = a.nodes.get("itemGrid"),
    t = a.rects.get("itemGrid"),
    s = a.rects.get("garageCardTemplate"),
    i = Number(y(e, "alignSize")),
    n = Number(y(e, "maxLine")),
    [r, o] = y(e, "alignMargin").split(/\s+/).map(Number);
  return {
    columns: i,
    rows: n,
    gapX: r,
    gapY: o,
    cardWidth: s.width,
    cardHeight: s.height,
    kartZoom: Number(y(a.nodes.get("factoryKartItemPanel"), "zoom")),
    pageSize: i * n,
    rect: {
      x: t.x,
      y: t.y,
      width: i * s.width + (i - 1) * r,
      height: n * s.height + (n - 1) * o,
    },
    thumbnail: (c) =>
      Y(a.nodes.get("/factoryCard/garageCardTemplate/shopItemContainer"), {
        x: t.x + (c % i) * (s.width + r),
        y: t.y + Math.floor(c / i) * (s.height + o),
        width: s.width,
        height: s.height,
      }),
  };
}
class Pa {
  constructor(e, t, s, i, n) {
    ((this.assets = e),
      (this.onChange = t),
      (this.onConfirm = s),
      (this.onTabChange = i),
      (this.onTutorial = n),
      (this.element.className = "garage-factory"));
  }
  assets;
  onChange;
  onConfirm;
  onTabChange;
  onTutorial;
  element = document.createElement("div");
  model;
  modelReady = !1;
  catalog = !0;
  installed = !1;
  scoreLabel;
  emptyVehicleInfo = !1;
  selectedAbilityIndex = 0;
  pickerVehicleKey;
  draft;
  draftDirty = !1;
  appliedSignature;
  actionFrameRedraws = new Set();
  get showsCatalog() {
    return this.catalog;
  }
  get previewRect() {
    return this.assets.rects.get("tuneCardAttach");
  }
  get catalogLayout() {
    return Ca(this.assets);
  }
  resizeCanvases() {
    this.actionFrameRedraws.forEach((e) => e());
  }
  place(e, t) {
    (Object.assign(e.style, {
      position: "absolute",
      left: `${t.x}px`,
      top: `${t.y}px`,
      width: `${t.width}px`,
      height: `${t.height}px`,
    }),
      this.element.append(e));
  }
  label(e, t, s) {
    const i = document.createElement("div");
    if (((i.textContent = e), s)) {
      const n = this.assets.nodes.get(s),
        [r, o, c, l] = (y(n, "marginRect") ?? "0 0 0 0")
          .split(/\s+/)
          .map(Number),
        h = Number(y(n, "textRender")?.match(/\d+/)?.[0] ?? 14);
      Object.assign(i.style, {
        boxSizing: "border-box",
        padding: `${o}px ${c}px ${l}px ${r}px`,
        color: "white",
        font: `${h}px "${this.assets.fontFamily ?? "P3528 Source Han Sans CN Ready"}", sans-serif`,
        overflowWrap: "anywhere",
        whiteSpace: "pre-wrap",
        textAlign: y(n, "textAlign")?.includes("right") ? "right" : "left",
        lineHeight: y(n, "textAlign")?.includes("vcenter")
          ? `${t.height}px`
          : `${Math.round(h * (this.assets.fontLineScale ?? 1)) + Number(y(n, "lineGap") ?? 2)}px`,
      });
    }
    return (this.place(i, t), i);
  }
  updateScores(e, t) {
    if (this.scoreLabel) {
      if (this.emptyVehicleInfo) {
        ((this.scoreLabel.textContent = ""),
          (this.scoreLabel.title = "当前车辆改装信息不可用"));
        return;
      }
      ((this.scoreLabel.textContent = [
        "TransAccelFactor",
        "SteerConstraint",
        "DriftEscapeForce",
        "NormalBoosterTime",
        "DriftMaxGauge",
      ].map((s) => (e ? String((e[s] << 16) >> 16) : "—")).join(`
`)),
        (this.scoreLabel.title = t ?? "客户端五项评分"));
    }
  }
  update(e, t, s = !1, i, n, r = i) {
    !e && !this.catalog && (this.catalog = !0);
    const o = e ?? nt(),
      c = Zt(o);
    (this.actionFrameRedraws.clear(),
      (this.pickerVehicleKey !== r ||
        !this.draft ||
        (!this.draftDirty && this.appliedSignature !== c)) &&
        ((this.pickerVehicleKey = r),
        (this.draft = ht(o)),
        (this.draftDirty = !1)),
      (this.appliedSignature = c),
      this.element.replaceChildren());
    const l =
      n?.engineGrade === 9 ? "xun" : n?.engineGrade === 8 ? "v1" : "classic";
    ((this.element.dataset.factoryPresentation = l),
      (this.installed = !!e),
      (this.scoreLabel = void 0),
      this.element.setAttribute("aria-busy", String(s)),
      (t = t && !s),
      (this.emptyVehicleInfo = !t));
    const h = this.assets.nodes.get("tutorial"),
      d = this.assets.rects.get("tutorial");
    if (h && d && this.onTutorial) {
      const w = document.createElement("button");
      ((w.type = "button"),
        w.setAttribute("aria-label", "改装车间教程"),
        (w.onclick = this.onTutorial));
      const k = y(h, "autoLoadImage"),
        x = (T) => {
          w.style.backgroundImage = `url("${this.assets.urls.get(se(k, T)) ?? ""}")`;
        };
      (Object.assign(w.style, {
        border: "0",
        padding: "0",
        backgroundColor: "transparent",
        backgroundSize: "100% 100%",
      }),
        (w.onpointerenter = () => x(2)),
        (w.onpointerdown = () => x(3)),
        (w.onpointerup = () => x(2)),
        (w.onpointerleave = () => x(1)),
        x(1),
        this.place(w, d));
    }
    const f = this.assets.rects.get("clblSpecName"),
      p = this.assets.rects.get("clblSpecValue");
    if (f && p) {
      const w = [
        "partsCatNameAccel",
        "partsCatNameCorner",
        "partsCatNameDrift",
        "partsCatNameBoosterTime",
        "partsCatNameDriftGauge",
      ].map((k) =>
        (this.assets.strings.get(k) ?? "").replace(/\[\/?color[^\]]*\]/g, ""),
      ).join(`
`);
      (this.label(w, f, "clblSpecName"),
        (this.scoreLabel = this.label("", p, "clblSpecValue")),
        t && this.updateScores());
    }
    const u = this.assets.rects.get("subInfoKartClassStr");
    if (t && n && u) {
      const w =
          n.kartType === 1
            ? "itemKart"
            : n.kartType === 2
              ? "speedkart"
              : void 0,
        k = w ? this.assets.strings.get(w) : void 0,
        x =
          n.vehicleRarityLevel === void 0
            ? void 0
            : {
                0: "loGradeAverage",
                1: "loGradeUnique",
                2: "loGradeLegend",
                3: "loGradeRare",
                4: "loGradeAverage",
              }[n.vehicleRarityLevel],
        T = x && this.assets.strings.get(x),
        v = this.label(
          [k, T].filter(Boolean).join(" / "),
          u,
          "subInfoKartClassStr",
        ),
        _ = n.vehicleRarityLevel;
      v.style.color =
        _ === void 0 ? "white" : (this.assets.qualityColors?.get(_) ?? "white");
    }
    for (const w of ["selectedKart", "subjectName"]) {
      const k = this.assets.nodes.get(w),
        x = this.assets.rects.get(w);
      if (!k || !x) continue;
      const T = y(k, "text")?.match(/^#sb\((.+)\)$/)?.[1],
        v = t && w === "subjectName" ? i : T && this.assets.strings.get(T);
      v && this.label(v, x, w);
    }
    const m = this.assets.nodes
      .get("tuneState")
      ?.children.find((w) => y(w, "text") === "#sb(tuneState)");
    if (m) {
      const w = Y(m, this.assets.rects.get("tuneState"));
      this.label(
        this.assets.strings.get("tuneState"),
        w,
        this.assets.nodes.get("tuneStateCaption") ? "tuneStateCaption" : void 0,
      );
    }
    if (((this.model = void 0), (this.modelReady = !1), t && e)) {
      const w = e.active ? "enableReset" : "enableTune",
        k = this.assets.nodes.get(w),
        x = this.assets.rects.get(w),
        T = document.createElement("canvas");
      ((T.width = x.width), (T.height = x.height));
      const v = T.getContext("2d");
      v &&
        (this.place(T, x),
        (this.model = {
          context: v,
          source: { path: `stage_/tuning/${y(k, "scene")}.1s`, panel: k },
        }));
    }
    const b = this.assets.rects.get("ContentTab");
    for (const [w, k, x] of [
      ["tab_kart", this.assets.strings.get("mqKarts"), !0],
      ["tab_parts", "自定义粒子效果", !1],
    ]) {
      const T = document.createElement("button");
      ((T.type = "button"),
        (T.textContent = k),
        T.setAttribute("aria-pressed", String(this.catalog === x)),
        T.classList.add("garage-factory-tab"),
        this.assets.fontFamily &&
          (T.style.fontFamily = `"${this.assets.fontFamily}", sans-serif`));
      const v = y(this.assets.nodes.get(w), "autoLoadImage");
      for (let _ = 1; _ <= 4; _++) {
        const $ = this.assets.urls.get(se(v, _));
        $ && T.style.setProperty(`--native-state-${_}`, `url("${$}")`);
      }
      ((T.onclick = () => {
        if (!x && !e) {
          this.onConfirm("请先装备粒子魔方/车辆后再进行自定义", () => {}, {
            singleAction: !0,
          });
          return;
        }
        ((this.catalog = x), this.onTabChange());
      }),
        this.place(T, this.assets.rects.get(w)));
    }
    const P = o.abilities.map((w) => {
      const k = ms.find((x) => x.id === w);
      return k ? `${k.label} · ${k.level}级` : "属性为空";
    });
    (this.label(
      e
        ? this.assets.strings.get("equipPlotter")
        : this.assets.strings.get("emptyPlotter").replaceAll(
            "|",
            `
`,
          ),
      this.assets.rects.get("abilityTitle"),
      "abilityTitle",
    ),
      this.label(
        e
          ? `${o.active ? "已激活" : "未激活"}
${P.join(`
`)}`
          : "",
        this.assets.rects.get("abilityDesc"),
        "abilityDesc",
      ));
    const C = e ? (o.active ? "reset" : "tunning") : "equip",
      S = document.createElement("button");
    ((S.type = "button"),
      (S.dataset.factoryAction = C),
      (S.textContent = s
        ? "正在提交……"
        : (this.assets.strings.get(C) ??
          { equip: "装备", tunning: "激活", reset: "重置" }[C])),
      (S.disabled = !t),
      !t &&
        !s &&
        (S.title = "当前车辆未满足本地改装适配条件；不代表官服无法装备魔方。"),
      Object.assign(S.style, {
        color: "white",
        font: `16px "${this.assets.fontFamily ?? "P3528 Source Han Sans CN Ready"}", sans-serif`,
      }),
      (S.onclick = () => {
        e
          ? o.active
            ? this.onConfirm(ba, () => this.commit(nt()))
            : o.abilities.some((w) => w === 0)
              ? ((this.catalog = !1), this.onTabChange())
              : this.onConfirm(
                  "激活所选三项改装功能并立即应用到当前车辆？不消耗道具。",
                  () => this.commit({ ...o, active: !0 }),
                )
          : this.onConfirm(
              "装备改装魔方并立即记录到当前车辆？不消耗官服道具。",
              () => this.commit(nt()),
            );
      }),
      this.place(S, this.assets.rects.get(C)),
      this.styleActionFrame(S),
      !this.catalog && this.renderAbilityPicker(o, t && !!e, b));
  }
  renderAbilityPicker(e, t, s) {
    const i = s.x + 20,
      n = 550,
      r = 8,
      o = this.draft ?? ht(e),
      c = this.label("选择栏位后依次选择属性和等级", {
        x: i,
        y: s.y + 65,
        width: n,
        height: 28,
      });
    c.className = "garage-factory-picker-instruction";
    const l = (n - r * 2) / 3;
    o.forEach((g, m) => {
      const b =
          g.group === void 0
            ? void 0
            : Mt.find((k) => Math.floor(k.id / 100) === g.group),
        P = b
          ? `第${m + 1}栏 ${b.label} ${g.level === void 0 ? "等级未选择" : `Lv.${g.level}`}`
          : `第${m + 1}栏 属性为空`,
        C = this.factoryChoiceButton(
          P,
          this.selectedAbilityIndex === m,
          !1,
          () => {
            ((this.selectedAbilityIndex = m), this.onTabChange());
          },
        );
      (C.classList.add("garage-factory-slot-choice"), (C.textContent = ""));
      const S = document.createElement("span");
      ((S.className = "garage-factory-slot-name"),
        (S.textContent = b?.label ?? "属性为空"));
      const w = document.createElement("span");
      ((w.className = "garage-factory-slot-level"),
        (w.textContent = g.level === void 0 ? "—" : `Lv.${g.level}`),
        C.append(S, w),
        this.place(C, {
          x: i + m * (l + r),
          y: s.y + 98,
          width: l,
          height: 48,
        }));
    });
    const h = o[this.selectedAbilityIndex],
      d = (n - r * 2) / 3;
    (Mt.forEach((g, m) => {
      const b = Math.floor(g.id / 100),
        P = o.some((S, w) => w !== this.selectedAbilityIndex && S.group === b),
        C = this.factoryChoiceButton(g.label, h.group === b, !t || P, () => {
          this.updateDraftSlot(this.selectedAbilityIndex, {
            group: b,
            level: h.group === b ? h.level : void 0,
          });
        });
      (C.classList.add("garage-factory-attribute-choice"),
        this.place(C, {
          x: i + (m % 3) * (d + r),
          y: s.y + 158 + Math.floor(m / 3) * 52,
          width: d,
          height: 44,
        }));
    }),
      [1, 2, 3].forEach((g, m) => {
        const b = this.factoryChoiceButton(
          `Lv.${g}`,
          h.level === g,
          !t || h.group === void 0,
          () => {
            this.updateDraftSlot(this.selectedAbilityIndex, {
              group: h.group,
              level: g,
            });
          },
        );
        (b.classList.add("garage-factory-level-choice"),
          this.place(b, {
            x: i + m * (l + r),
            y: s.y + 326,
            width: l,
            height: 48,
          }));
      }));
    const f = this.factoryChoiceButton(
      "清空当前栏",
      !1,
      !t || h.group === void 0,
      () => this.updateDraftSlot(this.selectedAbilityIndex, {}),
    );
    (f.classList.add("garage-factory-clear-choice"),
      this.place(f, { x: i, y: s.y + 382, width: 150, height: 40 }));
    const p = document.createElement("button");
    ((p.type = "button"),
      (p.textContent = "确定"),
      (p.dataset.factoryPickerAction = "confirm"));
    const u = o.every((g) => g.group !== void 0 && g.level !== void 0);
    ((p.disabled = !t || !this.draftDirty || !u),
      p.setAttribute("aria-label", "确定应用当前三栏粒子改配置"),
      (p.onclick = () => {
        const g = o.map((C) =>
            C.group === void 0 || C.level === void 0
              ? void 0
              : Hs(C.group, C.level),
          ),
          [m, b, P] = g;
        m === void 0 ||
          b === void 0 ||
          P === void 0 ||
          this.commit({ active: !0, abilities: [m, b, P] });
      }),
      he(p, void 0, "primary"),
      this.place(p, { x: i + n - 150, y: s.y + 382, width: 150, height: 40 }));
  }
  updateDraftSlot(e, t) {
    this.draft &&
      ((this.draft = this.draft.map((s, i) => (i === e ? t : s))),
      (this.draftDirty = !0),
      this.onTabChange());
  }
  commit(e) {
    (Tt(e),
      (this.draft = ht(e)),
      (this.draftDirty = !1),
      (this.appliedSignature = Zt(e)),
      this.onChange(e));
  }
  factoryChoiceButton(e, t, s, i) {
    const n = document.createElement("button");
    ((n.type = "button"),
      (n.textContent = e),
      (n.className = "garage-factory-choice"),
      (n.disabled = s),
      n.setAttribute("aria-pressed", String(t)),
      n.setAttribute("aria-label", e),
      (n.title = e),
      (n.onclick = i),
      this.assets.fontFamily &&
        (n.style.fontFamily = `"${this.assets.fontFamily}", sans-serif`));
    const r = y(this.assets.nodes.get("tab_parts"), "autoLoadImage");
    for (let o = 1; o <= 4; o++) {
      const c = this.assets.urls.get(se(r, o));
      c && n.style.setProperty(`--native-state-${o}`, `url("${c}")`);
    }
    return n;
  }
  styleActionFrame(e) {
    const t = this.assets.actionFrames;
    if (!t?.size) return;
    const s = this.assets.rects.get(e.dataset.factoryAction),
      i = document.createElement("canvas");
    ((i.width = s.width), (i.height = s.height));
    const n = i.getContext("2d");
    if (!n) return;
    const r = document.createElement("span");
    ((r.textContent = e.textContent),
      (r.style.position = "relative"),
      Object.assign(i.style, {
        position: "absolute",
        left: "0",
        top: "0",
        width: `${s.width}px`,
        height: `${s.height}px`,
        pointerEvents: "none",
      }),
      e.replaceChildren(i, r),
      (e.style.background = "transparent"),
      (e.style.border = "0"));
    const o = (c) => {
      const l = t.get(e.disabled ? "Disabled" : c) ?? t.get("Normal"),
        h = l && this.assets.images.get(l.texture),
        d = i.getBoundingClientRect();
      (Pe(i, n, d.width, d.height, Ee(), s.width, s.height),
        (n.imageSmoothingEnabled = !0),
        n.clearRect(0, 0, s.width, s.height),
        l && h && be(n, l, h, { ...s, x: 0, y: 0 }));
    };
    ((e.onpointerenter = () => o("MouseOn")),
      (e.onpointerleave = () => o("Normal")),
      (e.onpointerdown = () => o("Clicked")),
      (e.onpointerup = () => o("MouseOn")),
      this.actionFrameRedraws.add(() =>
        o(
          e.matches(":active")
            ? "Clicked"
            : e.matches(":hover")
              ? "MouseOn"
              : "Normal",
        ),
      ),
      o("Normal"));
  }
  draw(e) {
    const t = this.assets.images.get(
      `garage_img_floterBG_${this.assets.stage.width}`,
    );
    t &&
      e.drawImage(t, 0, 0, this.assets.stage.width, this.assets.stage.height);
    const s = this.assets.nodes.get("empty"),
      i = this.assets.rects.get("empty"),
      n = s && this.assets.images.get(y(s, "texture") ?? "");
    !this.installed && n && i && e.drawImage(n, i.x, i.y, i.width, i.height);
  }
  drawCatalogFrame(e, t, s, i = !1) {
    const n = this.catalogLayout,
      r = this.assets.images.get(
        s ? "img_floter_slotBoxSelected" : "img_floter_slotBox",
      );
    r &&
      e.drawImage(
        r,
        s || i ? 0 : n.cardWidth,
        0,
        n.cardWidth,
        n.cardHeight,
        n.rect.x + (t % n.columns) * (n.cardWidth + n.gapX),
        n.rect.y + Math.floor(t / n.columns) * (n.cardHeight + n.gapY),
        n.cardWidth,
        n.cardHeight,
      );
  }
}
async function Ea(a, e) {
  const t = async (u) => {
      const g = a.exactCanonicalCandidates(u)[0];
      if (!g) throw new Error(`改装教程资源缺失：${u}`);
      return g.bytes();
    },
    [s, i, n, r] = await Promise.all(
      [
        "dialog/tutorial/tutorial.bml",
        "dialog/tutorial/plant/tutorial@cn.bml",
        "dialog/tutorial/tutorial_stringBag.bml",
        "gui_/monocoque/frame.bml",
      ].map(async (u) => j(await t(u))),
    ),
    o = new Map(
      n.children.map((u) => [
        y(u, "n"),
        y(u.children.find((g) => y(g, "c") === "cn") ?? u, "v") ?? "",
      ]),
    ),
    c = new Map();
  for (const u of r.children.filter((g) =>
    ["CaptionDialog", "DefaultFocusedButton"].includes(g.name),
  ))
    for (const g of u.children) c.set(`${u.name}/${g.name}`, ve(g));
  const l = new Map(
      r.children
        .filter(
          (u) =>
            ["CaptionDialog", "DefaultFocusedButton"].includes(u.name) &&
            u.children.length,
        )
        .map((u) => [u.name, ve(u.children[0])]),
    ),
    h = new Map();
  let d;
  const f = () => {
      d && (Ce(d), (d = void 0));
    },
    p = async (u) => {
      const g = await createImageBitmap(
          new Blob([await t(u)], { type: "image/png" }),
        ),
        m = await $t(g);
      return (h.set(u, m), m);
    };
  try {
    d = await ws(a);
    const u = await Promise.all(
        i.children.map(async (E) =>
          j(await t(`dialog/tutorial/template${y(E, "template")}.bml`)),
        ),
      ),
      m = (
        await Promise.allSettled(
          [
            ...new Set(
              i.children.map(
                (E) => `dialog/tutorial/plant/${y(E, "image")}.png`,
              ),
            ),
            ...new Set(
              [...l.values()]
                .filter((E) => E.texture)
                .map((E) => `gui_/monocoque/${E.texture}.png`),
            ),
          ].map(p),
        )
      ).find((E) => E.status === "rejected");
    if (m?.status === "rejected") throw m.reason;
    const b = document.createElement("div");
    (Object.assign(b.style, {
      position: "absolute",
      inset: "0",
      zIndex: "100",
      pointerEvents: "auto",
      background: "#0008",
    }),
      b.setAttribute("role", "dialog"),
      b.setAttribute("aria-modal", "true"),
      b.setAttribute("aria-label", o.get("title") || "改装教程"));
    const P = document.createElement("canvas");
    ((P.width = 1600),
      (P.height = 900),
      Object.assign(P.style, {
        position: "absolute",
        inset: "0",
        width: "1600px",
        height: "900px",
        pointerEvents: "none",
      }));
    const C = P.getContext("2d");
    if (!C) throw new Error("教程画布不可用。");
    const S = Ws(s, { x: 0, y: 0, width: 1600, height: 900 }, l),
      w = s.children.find((E) => y(E, "name") === "context"),
      k = s.children.find((E) => y(E, "name") === "buttonGroup"),
      x = document.activeElement;
    let T = 0,
      v = !1,
      _;
    const $ = () => {
        v ||
          ((v = !0),
          _ && window.removeEventListener("resize", _),
          b.remove(),
          h.forEach((E) => E.close()),
          f(),
          x instanceof HTMLElement && x.isConnected && x.focus());
      },
      N = k.children.map((E) => {
        const M = document.createElement("button"),
          G = S.get(E);
        ((M.type = "button"),
          (M.textContent =
            o.get(y(E, "text")?.match(/#sb\((.+)\)/)?.[1]) ?? ""),
          Object.assign(M.style, {
            position: "absolute",
            left: `${G.x}px`,
            top: `${G.y}px`,
            width: `${G.width}px`,
            height: `${G.height}px`,
            font: `16px "${yt}"`,
            background: "transparent",
            border: "0",
            padding: "0",
          }),
          (M.onclick = () => {
            const B = y(E, "name");
            B === "ok" ? $() : ((T += B === "prev" ? -1 : 1), A());
          }));
        const F = (B) => {
          const O = c.get(`${y(E, "frame")}/${M.disabled ? "Disabled" : B}`);
          O && be(C, O, h.get(`gui_/monocoque/${O.texture}.png`), G);
          const q =
              y(
                E,
                M.disabled
                  ? "disabledTextColor"
                  : B === "Clicked"
                    ? "clickedTextColor"
                    : B === "MouseOn"
                      ? "overTextColor"
                      : "textColor",
              ) ?? "white",
            V = q.split(/\s+/).map(Number);
          M.style.color = V.length === 4 ? `rgb(${V.slice(1).join(",")})` : q;
        };
        return (
          (M.onpointerenter = () => F("MouseOn")),
          (M.onpointerleave = () => F("Normal")),
          (M.onpointerdown = () => F("Clicked")),
          (M.onpointerup = () => F("MouseOn")),
          { n: E, button: M, paint: F }
        );
      }),
      A = () => {
        const E = P.getBoundingClientRect();
        (Pe(P, C, E.width, E.height, Ee(), 1600, 900),
          (C.imageSmoothingEnabled = !0),
          C.clearRect(0, 0, 1600, 900));
        const M = S.get(s),
          G = l.get(y(s, "frame"));
        (be(C, G, h.get(`gui_/monocoque/${G.texture}.png`), M),
          (C.fillStyle = y(s, "captionColor")),
          (C.font = `16px "${yt}"`),
          (C.textAlign = "center"),
          C.fillText(o.get("title") ?? "", M.x + M.width / 2, M.y + 22));
        const F = u[T],
          B = i.children[T],
          O = h.get(`dialog/tutorial/plant/${y(B, "image")}.png`),
          q = Y(F, S.get(w)),
          V = Y(F.children[0], q, void 0, void 0, {
            width: O.width,
            height: O.height,
          });
        C.drawImage(O, V.x, V.y, V.width, V.height);
        for (const { n: D, button: $e, paint: Be } of N) {
          $e.disabled =
            y(D, "name") === "prev"
              ? T === 0
              : y(D, "name") === "next"
                ? T === i.children.length - 1
                : !1;
          const Te = c.get(
            `${y(D, "frame")}/${$e.disabled ? "Disabled" : "Normal"}`,
          );
          (Te && be(C, Te, h.get(`gui_/monocoque/${Te.texture}.png`), S.get(D)),
            Be("Normal"));
        }
      };
    return (
      (b.onkeydown = (E) => {
        if (
          (E.stopPropagation(),
          E.key === "Escape" && (E.preventDefault(), $()),
          E.key === "Tab")
        ) {
          E.preventDefault();
          const M = N.map((F) => F.button).filter((F) => !F.disabled),
            G = M.indexOf(document.activeElement);
          M[(G + (E.shiftKey ? M.length - 1 : 1)) % M.length].focus();
        }
      }),
      b.append(P, ...N.map((E) => E.button)),
      e.append(b),
      (_ = () => A()),
      window.addEventListener("resize", _),
      A(),
      N[2].button.focus(),
      $
    );
  } catch (u) {
    throw (h.forEach((g) => g.close()), f(), u);
  }
}
function Sa(a, e, t) {
  if (e !== 0) return a;
  const s = a.findIndex(
      (n) =>
        n.category === t.category &&
        n.itemId === t.itemId &&
        n.serial === t.serial,
    ),
    i = {
      ...t,
      reserved: s < 0 ? 0 : a[s].reserved,
      slots: [...t.slots],
      protectionSlots: [...t.protectionSlots],
      protectionCounts: [...t.protectionCounts],
    };
  return s < 0 ? [...a, i] : a.map((n, r) => (r === s ? i : n));
}
const Qt = (a, e) =>
  a.category === e.category && a.itemId === e.itemId && a.serial === e.serial;
class $a {
  constructor(e, t) {
    ((this.send = t),
      (this.stored = e.map((s) => ({
        ...s,
        slots: [...s.slots],
        protectionSlots: [...s.protectionSlots],
        protectionCounts: [...s.protectionCounts],
      }))));
  }
  send;
  stored;
  selected;
  inFlight = !1;
  pageRevision = 0;
  failure;
  get records() {
    return this.stored;
  }
  get pending() {
    return this.inFlight;
  }
  get error() {
    return this.failure;
  }
  get current() {
    return this.selected && this.stored.find((e) => Qt(e, this.selected));
  }
  select(e) {
    ((this.selected = e && {
      category: e.category,
      itemId: e.itemId,
      serial: e.serial,
    }),
      this.pageRevision++,
      (this.failure = void 0));
  }
  async request(e, t, s) {
    if (this.inFlight) throw new Error("改装请求尚未完成。");
    if (!this.selected) throw new Error("请先选择车辆。");
    const i = { ...this.selected },
      n = this.pageRevision;
    ((this.inFlight = !0), (this.failure = void 0));
    try {
      const r = await this.send({
        ...i,
        operation: e,
        itemCategory: t,
        itemIdToUse: s,
      });
      if (r.resultCode !== 0) throw new Error(`改装失败（${r.resultCode}）。`);
      if (!r.record || !Qt(r.record, i))
        throw new Error("改装响应与请求车辆不匹配。");
      this.stored = Sa(this.stored, r.resultCode, r.record);
    } catch (r) {
      throw (
        n === this.pageRevision &&
          (this.failure = r instanceof Error ? r.message : "改装请求失败。"),
        r
      );
    } finally {
      this.inFlight = !1;
    }
  }
}
const Jt = "dialog/kartLevelUp/";
function Ta(a) {
  return [
    `等级 Lv.${a.beforeLevel} → Lv.${a.afterLevel}`,
    `可用强化点 ${a.beforePoints} → ${a.afterPoints}`,
  ];
}
async function ka(a, e, t) {
  const s = (C) => {
      const S = a.exactCanonicalCandidates(`${Jt}${C}`);
      if (S.length !== 1) throw new Error(`经典升级资源缺失或不唯一：${C}`);
      return S[0];
    },
    n = j(await s("kartLevelUpResult@cn.bml").bytes()).children.find(
      (C) => y(C, "name") === "success",
    ),
    r = n?.children.find((C) => y(C, "name") === "main"),
    o = n?.children.find((C) => y(C, "name") === "preEffect"),
    c = n?.children.find((C) => y(C, "name") === "itemPanel"),
    l = r?.children.find((C) => y(C, "name") === "okButton");
  if (!n || !r || !o || !c || !l || !y(o, "scene"))
    throw new Error("经典升级结果页布局不完整。");
  const h = Y(n, { x: 0, y: 0, width: 1600, height: 900 }),
    d = { ...h, x: 0, y: 0 },
    f = Y(c, h),
    p = new Map(),
    u = new Set(),
    g = (C) => {
      const S = y(C, "image") ?? y(C, "texture");
      (S && u.add(S), C.children.forEach(g));
    };
  g(r);
  let m, b;
  const P = () => {
    (m?.dispose(),
      (m = void 0),
      p.forEach((C) => C.close()),
      p.clear(),
      b && (Ce(b), (b = void 0)));
  };
  try {
    b = await ws(a);
    const S = (
      await Promise.allSettled([
        Je(a, { path: `${Jt}${y(o, "scene")}.1s`, panel: o }, e, t).then(
          (x) => {
            m = x;
          },
        ),
        ...[...u].map(async (x) =>
          p.set(
            x,
            await createImageBitmap(
              new Blob([await s(`${x}.png`).bytes()], { type: "image/png" }),
            ),
          ),
        ),
      ])
    ).find((x) => x.status === "rejected");
    if (S?.status === "rejected") throw S.reason;
    if (!m || !(m.durationMs > 0 && m.durationMs < 6e4))
      throw new Error("经典升级动画时间轴无效。");
    const w = [],
      k = (x, T) => {
        const v = Y(x, T);
        (w.push({ node: x, rect: v }), x.children.forEach((_) => k(_, v)));
      };
    return (
      k(r, d),
      {
        panel: m,
        rect: h,
        preview: f,
        accept: Y(l, Y(r, h)),
        dispose: P,
        drawResult(x, T, v) {
          x.clearRect(0, 0, h.width, h.height);
          for (const { node: _, rect: $ } of w) {
            const N = y(_, "image") ?? y(_, "texture");
            if (N) {
              const G = p.get(N);
              if (y(_, "name") === "kartLevel") {
                const [F, B] = (y(_, "fontSize") ?? "32 40")
                  .split(/\s+/)
                  .map(Number);
                x.drawImage(
                  G,
                  v.afterLevel * F,
                  0,
                  F,
                  B,
                  $.x,
                  $.y,
                  $.width,
                  $.height,
                );
              } else x.drawImage(G, $.x, $.y, $.width, $.height);
            }
            const A = y(_, "name"),
              E = y(_, "text"),
              M =
                A === "kartName"
                  ? [T]
                  : A === "kartDesc"
                    ? Ta(v)
                    : E === "#sb(levelUpResult)"
                      ? ["升级结果"]
                      : [];
            M.length &&
              (x.save(),
              (x.fillStyle = "white"),
              (x.textAlign = "center"),
              (x.textBaseline = "middle"),
              (x.font = `${A === "kartDesc" ? 16 : 20}px "${yt}"`),
              M.forEach((G, F) =>
                x.fillText(
                  G,
                  $.x + $.width / 2,
                  $.y + $.height / 2 + (F - (M.length - 1) / 2) * 26,
                  $.width,
                ),
              ),
              x.restore());
          }
        },
      }
    );
  } catch (C) {
    throw (P(), C);
  }
}
const es = "dialog2_/kart12TuningLevelUp/",
  _a = ["preEffect", "successEffect", "successResult"],
  Ia = ["强化开始", "强化成功", "强化结果"];
function La(a) {
  return [
    {
      label: "性能槽数量",
      before: String(Math.min(a.beforeLevel, 3)),
      after: String(Math.min(a.afterLevel, 3)),
    },
    {
      label: "强化点数",
      before: String(a.beforePoints),
      after: String(a.afterPoints),
    },
  ];
}
function Na(a) {
  return !a;
}
function Aa(a, e) {
  if (
    a.length === 0 ||
    a.some((s) => !Number.isFinite(s) || s <= 0) ||
    !Number.isFinite(e)
  )
    throw new Error("升级动画时长无效。");
  let t = Math.max(0, e);
  for (let s = 0; s < a.length; s++) {
    if (t < a[s]) return { index: s, time: t, complete: !1 };
    if (s === a.length - 1) return { index: s, time: a[s], complete: !0 };
    t -= a[s];
  }
  throw new Error("升级动画阶段无效。");
}
async function Ma(a, e, t, s = !1) {
  const i = a.exactCanonicalCandidates(`${es}kart12TuningLevelUpResult@zz.bml`);
  if (i.length !== 1) throw new Error("迅升级结果页资源缺失或不唯一。");
  const r = j(await i[0].bytes()).children.find((h) => y(h, "name") === "1600");
  if (!r) throw new Error("迅升级结果页缺少 1600 布局。");
  const o = s ? ["successResult"] : _a,
    c = await Promise.allSettled(
      o.map(async (h) => {
        const d = r.children.find((p) => y(p, "name") === h);
        if (!d || !y(d, "scene")) throw new Error(`升级动画缺少 ${h}`);
        const f = await Je(
          a,
          { path: `${es}${y(d, "scene")}.1s`, panel: d },
          e,
          t,
        );
        if (!(f.durationMs > 0 && f.durationMs < 6e4))
          throw (f.dispose(), new Error(`升级动画时间轴无效：${h}`));
        return f;
      }),
    ),
    l = c.find((h) => h.status === "rejected");
  if (l?.status === "rejected")
    throw (
      c.forEach((h) => {
        h.status === "fulfilled" && h.value.dispose();
      }),
      l.reason
    );
  return c.map((h) => h.value);
}
class Ra {
  constructor(e, t, s, i, n, r, o, c, l = !1, h) {
    ((this.title = n),
      (this.onClose = r),
      (this.summary = c),
      (this.resultOnly = l),
      (this.element.className = `garage-upgrade${o === "classic" ? " garage-upgrade-classic" : ""}`),
      l && this.element.classList.add("garage-upgrade-result-only"),
      this.element.setAttribute("role", "dialog"),
      this.element.setAttribute("aria-modal", "true"),
      this.element.setAttribute(
        "aria-label",
        o === "xun" ? "迅车辆强化动画" : "经典车辆升级动画",
      ));
    const d = document.createElement("canvas");
    ((d.width = 1600), (d.height = 900));
    const f = d.getContext("2d");
    if (!f) throw new Error("升级动画画布不可用。");
    this.context = f;
    const p = document.createElement("canvas");
    ((p.width = 250), (p.height = 250), (p.className = "garage-upgrade-kart"));
    const u = p.getContext("2d");
    if (!u) throw new Error("升级车辆画布不可用。");
    ((this.kartContext = u),
      (this.result.className = "garage-upgrade-result"),
      (this.result.hidden = !0));
    const g = document.createElement("strong");
    g.className = "garage-upgrade-result-heading";
    const m = document.createElement("span");
    if (((m.textContent = n), g.append(m), o === "xun" && h)) {
      const w = document.createElement("img");
      ((w.src = h),
        (w.alt = `+${c.afterLevel}`),
        (w.className = "garage-upgrade-result-level"),
        g.append(w));
    }
    const b = document.createElement("div");
    b.className = "garage-upgrade-stats";
    const P =
      o === "xun"
        ? La(c)
        : [
            {
              label: "等级",
              before: `Lv.${c.beforeLevel}`,
              after: `Lv.${c.afterLevel}`,
            },
            {
              label: "强化点",
              before: String(c.beforePoints),
              after: String(c.afterPoints),
            },
          ];
    for (const { label: w, before: k, after: x } of P) {
      const T = document.createElement("span");
      ((T.className = "garage-upgrade-stat-row"),
        T.setAttribute("aria-label", `${w}：${k} 升至 ${x}`));
      for (const [v, _] of [
        ["label", w],
        ["before", k],
        ["after", x],
      ]) {
        const $ = document.createElement("span");
        (($.className = `garage-upgrade-stat-${v}`),
          ($.textContent = _),
          T.append($));
      }
      b.append(T);
    }
    (this.result.append(p),
      o === "xun" && this.result.append(g, b),
      (this.label.className = "garage-upgrade-label"),
      this.label.setAttribute("role", "status"),
      (this.label.textContent = `${n} · 正在加载原版强化动画…`),
      (this.accept.type = this.cancel.type = "button"),
      he(this.accept, void 0, "primary"),
      (this.accept.textContent = l
        ? "确认"
        : `确认本地 Lv.${c.afterLevel} 升级`),
      (this.accept.disabled = !0),
      (this.cancel.textContent = l ? "关闭" : "取消升级"),
      (this.accept.onclick = () => {
        this.complete && this.close(!0);
      }),
      (this.cancel.onclick = () => this.close(l)),
      l && ((this.accept.hidden = !0), (this.cancel.hidden = !0)));
    const C = [d, this.result];
    (Na(l) && C.push(this.label),
      C.push(this.accept, this.cancel),
      this.element.append(...C),
      e.append(this.element),
      (this.previousFocus =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : void 0),
      this.cancel.focus(),
      this.element.addEventListener("keydown", (w) => {
        (w.key === "Escape" &&
          (w.preventDefault(), w.stopPropagation(), this.close(!1)),
          w.key === "Tab" &&
            (w.preventDefault(),
            (this.complete && document.activeElement === this.cancel
              ? this.accept
              : this.cancel
            ).focus()));
      }),
      (async () => {
        if (o === "xun") return Ma(t, s, i, l);
        const w = await ka(t, s, i);
        if (this.disposed) return (w.dispose(), []);
        this.classic = w;
        const k = w.rect,
          x = w.preview;
        ((d.width = k.width),
          (d.height = k.height),
          (this.canvasLogicalWidth = k.width),
          (this.canvasLogicalHeight = k.height),
          Object.assign(d.style, {
            left: `${k.x}px`,
            top: `${k.y}px`,
            width: `${k.width}px`,
            height: `${k.height}px`,
          }),
          (p.width = x.width),
          (p.height = x.height),
          (this.kartLogicalWidth = x.width),
          (this.kartLogicalHeight = x.height),
          Object.assign(p.style, {
            left: `${x.x}px`,
            top: `${x.y}px`,
            width: `${x.width}px`,
            height: `${x.height}px`,
          }));
        const T = w.accept;
        return (
          (this.accept.textContent = l ? "确认" : "确认本地升级"),
          (this.accept.hidden = !0),
          Object.assign(this.accept.style, {
            left: `${T.x}px`,
            top: `${T.y}px`,
            width: `${T.width}px`,
            height: `${T.height}px`,
          }),
          [w.panel]
        );
      })()
        .then((w) => {
          if (this.disposed) {
            w.forEach((k) => k.dispose());
            return;
          }
          ((this.panels = w),
            this.resultOnly &&
              ((this.complete = !0),
              (this.result.hidden = !1),
              (this.accept.disabled = !1),
              (this.accept.hidden = !1),
              (this.cancel.hidden = !0)));
        })
        .catch((w) => {
          !this.disposed &&
            !this.resultOnly &&
            (this.label.textContent = `动画加载失败，未修改升级草稿：${w instanceof Error ? w.message : w}`);
        }));
  }
  title;
  onClose;
  summary;
  resultOnly;
  element = document.createElement("div");
  context;
  label = document.createElement("div");
  accept = document.createElement("button");
  cancel = document.createElement("button");
  result = document.createElement("div");
  kartContext;
  canvasLogicalWidth = 1600;
  canvasLogicalHeight = 900;
  kartLogicalWidth = 250;
  kartLogicalHeight = 250;
  panels;
  epoch;
  disposed = !1;
  complete = !1;
  previousFocus;
  classic;
  capturePreview(e, t) {
    if (this.disposed) return;
    const s = this.kartContext,
      i = s.canvas.getBoundingClientRect();
    Pe(
      s.canvas,
      s,
      i.width,
      i.height,
      Ee(),
      this.kartLogicalWidth,
      this.kartLogicalHeight,
    );
    const n = this.kartLogicalWidth,
      r = this.kartLogicalHeight;
    (s.clearRect(0, 0, n, r), s.save());
    const o = Math.min(n / t.width, r / t.height);
    (s.translate((n - t.width * o) / 2, (r - t.height * o) / 2),
      s.scale(o, o),
      s.translate(-t.x, -t.y),
      e.drawPreview(s, t),
      s.restore());
  }
  render(e, t) {
    if (this.disposed || !this.panels) return;
    const s = this.context.canvas.getBoundingClientRect();
    if (
      (Pe(
        this.context.canvas,
        this.context,
        s.width,
        s.height,
        Ee(),
        this.canvasLogicalWidth,
        this.canvasLogicalHeight,
      ),
      this.resultOnly)
    ) {
      if (this.classic)
        this.classic.drawResult(this.context, this.title, this.summary);
      else {
        const c = this.panels[0];
        (c.seek(c.durationMs), t.drawAuxiliaryPanel(c, [this.context]));
      }
      ((this.result.hidden = !1),
        (this.complete = !0),
        (this.accept.disabled = !1));
      return;
    }
    this.epoch ??= e;
    const i = Aa(
      this.panels.map((c) => c.durationMs),
      e - this.epoch,
    );
    if (this.complete && i.complete) return;
    const n = this.panels[i.index];
    (n.seek(i.time),
      t.drawAuxiliaryPanel(n, [this.context]),
      this.classic &&
        i.complete &&
        this.classic.drawResult(this.context, this.title, this.summary),
      (this.result.hidden = this.classic ? !i.complete : i.index !== 2),
      (this.complete = i.complete),
      (this.accept.disabled = !i.complete),
      this.classic && (this.accept.hidden = !i.complete));
    const r = this.classic
        ? i.complete
          ? "升级结果"
          : "升级成功动画"
        : Ia[i.index],
      o = `${this.title} · ${r}
本地确定性 Lv.${this.summary.beforeLevel} → Lv.${this.summary.afterLevel} 测试，不消耗材料；确认后仅写入车库草稿。`;
    this.label.textContent !== o && (this.label.textContent = o);
  }
  close(e) {
    if (this.disposed) return;
    const t = this.previousFocus;
    (this.dispose(), this.onClose(e), t?.isConnected && t.focus());
  }
  dispose() {
    this.disposed ||
      ((this.disposed = !0),
      this.classic
        ? this.classic.dispose()
        : this.panels?.forEach((e) => e.dispose()),
      (this.classic = void 0),
      (this.panels = void 0),
      this.element.remove(),
      (this.previousFocus = void 0));
  }
}
const Fa = "dialog2_/kart12SkillTuning/",
  Ga = [
    "tuning_selectperformPopupBg_s",
    "tuning_selectperform_slotBg_s",
    "tuning_selectperform_slotBg_c",
    "tuning_selectperform_slotBg_c_effect",
    ...Array.from({ length: 9 }, (a, e) => `tuning_icon_${e + 1}`),
    ...Array.from({ length: 3 }, (a, e) => `tuning_selectperform_mark${e + 1}`),
    ...Array.from({ length: 3 }, (a, e) => `tuning_slotNum_0${e + 1}`),
    ...Array.from(
      { length: 3 },
      (a, e) => `tuning_selectperformPopup_tab_${e + 1}`,
    ),
    ...Array.from({ length: 4 }, (a, e) => `tuningPopup_x_${e + 1}`),
  ],
  He = new WeakMap();
function Ts(a) {
  let e = He.get(a);
  return (
    e ||
      ((e = Ba(a)),
      He.set(a, e),
      e.catch(() => {
        He.get(a) === e && He.delete(a);
      })),
    e
  );
}
async function Ba(a) {
  const e = (o) => {
      const c = a.exactCanonicalCandidates(`${Fa}${o}`);
      if (c.length !== 1) throw new Error(`技能选择资源缺失或不唯一：${o}`);
      return c[0];
    },
    [t, s] = await Promise.all(
      ["kart12SkillTuning@zz.bml", "speedSkillTuningCard.bml"].map(async (o) =>
        j(await e(o).bytes()),
      ),
    ),
    i = new Map(),
    n = new Map(),
    r = () => {
      (i.forEach((o) => URL.revokeObjectURL(o)), i.clear());
    };
  try {
    const c = (
      await Promise.allSettled(
        Ga.map(async (v) => {
          const _ = new Blob([await e(`${v}.png`).bytes()], {
              type: "image/png",
            }),
            $ = await createImageBitmap(_);
          try {
            (n.set(v, { width: $.width, height: $.height }),
              i.set(v, URL.createObjectURL(_)));
          } finally {
            $.close();
          }
        }),
      )
    ).find((v) => v.status === "rejected");
    if (c?.status === "rejected") throw c.reason;
    const l = new Map(),
      h = t.children.find((v) => y(v, "name") === "container");
    if (!h) throw new Error("技能窗口缺少 container。");
    const d = n.get("tuning_selectperformPopupBg_s"),
      f = (v, _, $) => {
        const N = y(v, "name") ?? v.name,
          A = `${$}/${N}`,
          E = Y(v, _);
        (l.set(A, E), v.children.forEach((M) => f(M, E, A)));
      };
    f(h, { x: 0, y: 0, ...d }, "");
    const p = (v) => {
        const _ = l.get(v);
        if (!_) throw new Error(`技能窗口缺少 ${v}`);
        return _;
      },
      u = new Map();
    for (let v = 1; v <= 9; v++) {
      const _ = p(
        `/container/skillTuning/speedPage/skillLine${Math.ceil(v / 3)}/${v}`,
      );
      u.set(v, { ..._, ...n.get("tuning_selectperform_slotBg_s") });
    }
    const g = (v) => {
        const _ = s.children.find(($) => y($, "name") === v);
        if (!_) throw new Error(`技能卡片缺少 ${v}`);
        return Y(_, { x: 0, y: 0, width: 0, height: 0 });
      },
      m = (v, _) => {
        if (y(v, "name") === _) return v;
        for (const $ of v.children) {
          const N = m($, _);
          if (N) return N;
        }
      },
      b = m(h, "skillTuningCaption");
    if (!b) throw new Error("技能窗口缺少标题样式。");
    const P = y(b, "textRender") ?? "bold20",
      C = Number(P.match(/\d+/)?.[0] ?? 20),
      S = y(b, "textColor") ?? "white",
      w = S.split(/\s+/).map(Number),
      k =
        S === "white"
          ? "#fff"
          : w.length === 4 && w.every(Number.isFinite)
            ? `rgba(${w[1]}, ${w[2]}, ${w[3]}, ${w[0] / 255})`
            : S,
      x = (v, _) => {
        if (!v) return _;
        if (v === "white" || v === "black") return v;
        const [$, N, A, E] = v.split(/\s+/).map(Number);
        return [$, N, A, E].every(Number.isFinite)
          ? `rgba(${N}, ${A}, ${E}, ${$ / 255})`
          : _;
      },
      T = new Map();
    for (const v of ["okButton", "cancelButton"]) {
      const _ = m(h, v);
      T.set(v, {
        fontSize: Number(
          (y(_, "textRender") ?? "bold16").match(/\d+/)?.[0] ?? 16,
        ),
        colors: [
          x(y(_, "textColor"), v === "okButton" ? "white" : "#404b5f"),
          x(y(_, "overTextColor"), v === "okButton" ? "white" : "#6a7893"),
          x(y(_, "clickedTextColor"), "#182b48"),
          x(y(_, "disabledTextColor"), "#838383"),
        ],
      });
    }
    for (const v of ["closeButton", "okButton", "cancelButton"])
      p(`/container/${v}`);
    for (const v of ["speedPage", "itemPage"])
      p(`/container/skillTuning/gameType/${v}`);
    return {
      rects: l,
      cards: u,
      cardIcon: g("skillIcon"),
      cardName: g("skillName"),
      cardTag: g("curSkillSlotTag"),
      headingStyle: {
        fontSize: C,
        color: k,
        align: y(b, "textAlign") ?? "center,vcenter",
      },
      actionStyles: T,
      urls: i,
      dispose: r,
    };
  } catch (o) {
    throw (r(), o);
  }
}
class qa {
  constructor(e, t = 0) {
    if (((this.slot = t), kt(e), !Number.isInteger(t) || t < 0 || t > 2))
      throw new Error("无效的性能槽。");
    ((this.initial = { ...e, skills: e.skills.map((s) => ({ ...s })) }),
      (this.id = e.skills[t].id));
  }
  slot;
  initial;
  id;
  settled = !1;
  choose(e) {
    if (!this.settled) {
      if (!Number.isInteger(e) || e < 1 || e > 9)
        throw new Error("无效的竞速技能。");
      if (this.isOccupied(e)) throw new Error("该技能已被其他性能槽占用。");
      this.id = e;
    }
  }
  equippedSlot(e) {
    const t = this.initial.skills.findIndex((s) => s.id === e);
    return t < 0 ? void 0 : t + 1;
  }
  isOccupied(e) {
    const t = this.equippedSlot(e);
    return t !== void 0 && t !== this.slot + 1;
  }
  get value() {
    return Xs(this.initial, this.slot, this.id);
  }
  get changed() {
    return this.id !== this.initial.skills[this.slot].id;
  }
  get refunded() {
    return we(this.value) - we(this.initial);
  }
  settle(e) {
    if (!this.settled)
      return ((this.settled = !0), e && this.changed ? this.value : void 0);
  }
}
class Da {
  constructor(e, t, s, i, n) {
    if (
      ((this.row = i),
      (this.onClose = n),
      !Number.isInteger(i) || i < 0 || i > 2)
    )
      throw new Error("无效的技能栏。");
    ((this.state = new qa(s, i)),
      (this.element.className = "garage-skill-selection"),
      (this.panel.className = "garage-skill-selection-panel"),
      this.panel.setAttribute("role", "dialog"),
      this.panel.setAttribute("aria-label", "迅竞速技能选择"),
      this.panel.setAttribute("aria-modal", "true"),
      (this.status.className = "garage-skill-selection-status"),
      this.status.setAttribute("role", "status"),
      (this.status.textContent = "正在加载原版技能卡片…"),
      (this.accept.type = this.cancel.type = "button"),
      (this.accept.textContent = "变更"),
      (this.accept.disabled = !0),
      (this.cancel.textContent = "取消"),
      (this.accept.onclick = () => {
        this.assets && this.state.changed && this.close(!0);
      }),
      (this.cancel.onclick = () => this.close(!1)),
      this.place(this.accept, { x: 225, y: 655, width: 146, height: 42 }),
      this.place(this.cancel, { x: 380, y: 655, width: 146, height: 42 }),
      this.panel.append(this.status),
      this.element.append(this.panel),
      e.append(this.element),
      this.cancel.focus(),
      this.element.addEventListener("keydown", (r) => {
        if (
          (r.key === "Escape" &&
            (r.preventDefault(), r.stopPropagation(), this.close(!1)),
          r.key === "Tab")
        ) {
          r.preventDefault();
          const o = [...this.panel.querySelectorAll("button:not(:disabled)")],
            c = o.indexOf(document.activeElement);
          o[(c + (r.shiftKey ? o.length - 1 : 1)) % o.length]?.focus();
        }
      }),
      this.load(t));
  }
  row;
  onClose;
  element = document.createElement("div");
  panel = document.createElement("div");
  status = document.createElement("div");
  accept = document.createElement("button");
  cancel = document.createElement("button");
  state;
  choices = new Map();
  assets;
  disposed = !1;
  previousFocus =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : void 0;
  place(e, t) {
    (Object.assign(e.style, {
      position: "absolute",
      left: `${t.x}px`,
      top: `${t.y}px`,
      width: `${t.width}px`,
      height: `${t.height}px`,
    }),
      this.panel.append(e));
  }
  async load(e) {
    let t;
    try {
      if (((t = await Ts(e)), this.disposed)) return;
      ((this.assets = t),
        this.build(t),
        this.refresh(),
        this.choices.get(this.state.value.skills[this.row].id)?.focus());
    } catch (s) {
      ((this.assets = void 0),
        (this.accept.disabled = !0),
        this.disposed ||
          (this.status.textContent = `技能资源加载失败，请取消后重试：${s instanceof Error ? s.message : s}`));
    }
  }
  build(e) {
    const t = (l) => e.rects.get(l),
      s = t("/container");
    Object.assign(this.panel.style, {
      width: `${s.width}px`,
      height: `${s.height}px`,
      left: `${(1600 - s.width) / 2}px`,
      top: `${(834 - s.height) / 2}px`,
      backgroundImage: `url("${e.urls.get("tuning_selectperformPopupBg_s")}")`,
    });
    const i = document.createElement("strong");
    ((i.className = "garage-skill-selection-heading"),
      (i.style.fontSize = `${e.headingStyle.fontSize}px`),
      (i.style.color = e.headingStyle.color));
    const n = document.createElement("span");
    n.textContent = `性能槽${this.row + 1}`;
    const r = document.createElement("span");
    ((r.textContent = "性能选择"),
      i.append(n, r),
      this.place(i, t("/container/skillTuningCaption")),
      this.buildModeTabs(e));
    const o = document.createElement("div");
    ((o.className = "garage-skill-selection-local"),
      (o.textContent =
        "竞速：九选三，不可重复 · 本次仅更换当前性能槽 · 本地不消耗材料"),
      this.place(o, { x: 15, y: 88, width: 718, height: 35 }));
    const c = document.createElement("button");
    ((c.type = "button"),
      (c.className = "garage-native-button"),
      c.setAttribute("aria-label", "关闭技能选择"));
    for (let l = 1; l <= 4; l++)
      c.style.setProperty(
        `--button-${l}`,
        `url("${e.urls.get(`tuningPopup_x_${l}`)}")`,
      );
    ((c.onclick = () => this.close(!1)),
      this.place(c, t("/container/closeButton")));
    for (let l = 0; l < 3; l++) {
      const h = t(`/container/skillTuning/speedPage/skillLine${l + 1}`),
        d = document.createElement("img");
      ((d.src = e.urls.get(`tuning_selectperform_mark${l + 1}`)),
        (d.alt = `第${l + 1}栏`),
        this.place(d, { x: h.x + 100, y: h.y + 53, width: 76, height: 76 }));
    }
    for (const l of fs) {
      const h = document.createElement("button");
      ((h.type = "button"),
        (h.className = "garage-skill-card"),
        h.setAttribute("aria-label", l.label),
        h.style.setProperty(
          "--card-normal",
          `url("${e.urls.get("tuning_selectperform_slotBg_s")}")`,
        ),
        h.style.setProperty(
          "--card-selected",
          `url("${e.urls.get("tuning_selectperform_slotBg_c")}")`,
        ));
      const d = document.createElement("img");
      ((d.src = e.urls.get(`tuning_icon_${l.id}`)), (d.alt = ""));
      const f = document.createElement("span");
      f.textContent = l.label;
      for (const [g, m] of [
        [d, e.cardIcon],
        [f, e.cardName],
      ])
        (Object.assign(g.style, {
          position: "absolute",
          left: `${m.x}px`,
          top: `${m.y}px`,
          width: `${m.width}px`,
          height: `${m.height}px`,
        }),
          h.append(g));
      const p = this.state.equippedSlot(l.id);
      if (p) {
        const g = document.createElement("img");
        ((g.src = e.urls.get(`tuning_slotNum_0${p}`)),
          (g.alt = `性能槽${p}已装备`));
        const m = e.cardTag;
        (Object.assign(g.style, {
          position: "absolute",
          left: `${m.x}px`,
          top: `${m.y}px`,
          width: `${m.width}px`,
          height: `${m.height}px`,
        }),
          h.append(g),
          (h.title = `性能槽${p}已装备${p === this.row + 1 ? "（当前槽）" : "，不可重复选择"}`));
      }
      const u = document.createElement("img");
      ((u.className = "garage-skill-card-selected-effect"),
        (u.src = e.urls.get("tuning_selectperform_slotBg_c_effect")),
        (u.alt = ""),
        Object.assign(u.style, {
          position: "absolute",
          inset: "0",
          width: "116px",
          height: "116px",
        }),
        h.append(u, f),
        (h.disabled = this.state.isOccupied(l.id)),
        (h.onclick = () => {
          this.assets &&
            !this.disposed &&
            (this.state.choose(l.id), this.refresh());
        }),
        this.choices.set(l.id, h),
        this.place(h, e.cards.get(l.id)));
    }
    (this.place(this.accept, t("/container/okButton")),
      this.place(this.cancel, t("/container/cancelButton")),
      he(this.accept, e.actionStyles.get("okButton"), "primary"),
      he(this.cancel, e.actionStyles.get("cancelButton"), "secondary"));
  }
  buildModeTabs(e) {
    for (const [t, s, i] of [
      ["speedPage", "竞速", !0],
      ["itemPage", "道具", !1],
    ]) {
      const n = document.createElement("button");
      ((n.type = "button"),
        (n.className = "garage-skill-mode-tab"),
        (n.textContent = s),
        n.setAttribute(
          "aria-label",
          i ? "竞速技能（当前）" : "道具技能（未开放）",
        ),
        n.setAttribute("aria-pressed", String(i)),
        (n.disabled = !i),
        (n.title = i
          ? "当前仅支持计时赛竞速技能"
          : "道具赛技能不在本次实现范围"),
        (n.style.backgroundImage = `url("${e.urls.get(`tuning_selectperformPopup_tab_${i ? 3 : 1}`)}")`),
        this.place(n, e.rects.get(`/container/skillTuning/gameType/${t}`)));
    }
  }
  refresh() {
    const e = this.state.value;
    (this.choices.forEach((t, s) =>
      t.setAttribute("aria-pressed", String(e.skills[this.row].id === s)),
    ),
      (this.accept.disabled = !this.state.changed),
      (this.status.textContent = `本次返还 ${this.state.refunded} 点强化点数，确认后可用 ${we(e)} 点强化点数。
关闭或取消不修改。`));
  }
  close(e) {
    if (this.disposed) return;
    const t = this.state.settle(e);
    (this.dispose(),
      this.onClose(t),
      this.previousFocus?.isConnected && this.previousFocus.focus());
  }
  dispose() {
    this.disposed ||
      ((this.disposed = !0),
      this.state.settle(!1),
      (this.assets = void 0),
      this.element.remove());
  }
}
const Oa = "/backGround/engine12Data/tuningPanel/skillTuning";
function za(a, e, t) {
  if (!Number.isInteger(t) || t < 1 || t > 5)
    throw new Error("加点动画目标超出强化条范围");
  return {
    ...e,
    x: a.x + ((28 + (t - 1) * 48) * a.width) / 248 - e.width / 2,
    y: a.y + a.height / 2 - e.height / 2,
  };
}
function Ua(a, e) {
  if (a.kind !== "xun" || e.kind !== "xun" || a.level !== e.level)
    return { clear: [0, 1, 2], play: [] };
  const t = [],
    s = [];
  return (
    e.skills.forEach((i, n) => {
      const r = a.skills[n];
      (r.id === i.id && r.points === i.points) ||
        (t.push(n), r.id === i.id && i.points === r.points + 1 && s.push(n));
    }),
    { clear: t, play: s }
  );
}
class Ka {
  constructor(e, t, s, i) {
    ((this.assets = t),
      (this.load = s),
      (this.onError = i),
      (this.element.className = "garage-point-effects"),
      this.element.setAttribute("aria-hidden", "true"),
      e.append(this.element));
  }
  assets;
  load;
  onError;
  element = document.createElement("div");
  slots = new Map();
  contextKey;
  disposed = !1;
  setContext(e) {
    e !== this.contextKey && (this.clear(), (this.contextKey = e));
  }
  transition(e, t) {
    if (this.disposed || !this.contextKey) return;
    const s = Ua(e, t);
    (s.clear.forEach((i) => this.clear(i)),
      t.kind === "xun" &&
        s.play.forEach((i) => this.play(i, t.skills[i].points)));
  }
  play(e, t) {
    const s = `${Oa}/tuningSkill${e + 1}`,
      i = this.assets.nodes.get(`${s}/tuningPoint1s`),
      n = this.assets.rects.get(`${s}/tuningPoint1s`),
      r = this.assets.rects.get(`${s}/skillGauge`),
      o = r && st(r);
    if (!i || !n || !o || !y(i, "scene")) {
      this.onError("加点动画定义缺失；强化点已保留。");
      return;
    }
    const c = za(o, n, t);
    let l = this.slots.get(e);
    if (!l) {
      const h = document.createElement("canvas");
      ((h.width = c.width),
        (h.height = c.height),
        (h.hidden = !0),
        (h.className = "garage-point-effect"),
        (h.dataset.row = String(e + 1)),
        Object.assign(h.style, {
          left: `${c.x}px`,
          top: `${c.y}px`,
          width: `${c.width}px`,
          height: `${c.height}px`,
        }));
      const d = h.getContext("2d");
      if (!d) {
        this.onError("加点动画画布不可用；强化点已保留。");
        return;
      }
      ((l = { context: d, active: !1 }),
        this.slots.set(e, l),
        this.element.append(h));
      const f = l;
      this.load({ path: `stage_/kartune/${y(i, "scene")}.1s`, panel: i })
        .then((p) => {
          if (this.disposed) {
            p.dispose();
            return;
          }
          if (!(p.durationMs > 0 && p.durationMs < 6e4))
            throw (p.dispose(), new Error("无效的加点动画时长"));
          f.panel = p;
        })
        .catch((p) => {
          (this.clear(e),
            this.disposed ||
              this.onError(
                `加点动画加载失败，强化点已保留：${p instanceof Error ? p.message : p}`,
              ));
        });
    }
    (Object.assign(l.context.canvas.style, {
      left: `${c.x}px`,
      top: `${c.y}px`,
    }),
      (l.active = !0),
      (l.epoch = void 0));
  }
  clear(e) {
    for (const [t, s] of this.slots) {
      if (e !== void 0 && t !== e) continue;
      ((s.active = !1), (s.epoch = void 0));
      const { canvas: i } = s.context;
      ((i.hidden = !0), s.context.clearRect(0, 0, i.width, i.height));
    }
  }
  render(e, t) {
    if (!(this.disposed || !this.contextKey))
      for (const [s, i] of this.slots) {
        if (!i.active || !i.panel) continue;
        i.epoch ??= e;
        const n = Math.max(0, e - i.epoch);
        if (n >= i.panel.durationMs) {
          this.clear(s);
          continue;
        }
        ((i.context.canvas.hidden = !1),
          i.panel.seek(n),
          t.drawAuxiliaryPanel(i.panel, [i.context]));
      }
  }
  dispose() {
    this.disposed ||
      ((this.disposed = !0),
      this.clear(),
      this.slots.forEach((e) => e.panel?.dispose()),
      this.slots.clear(),
      this.element.remove());
  }
}
const ts = "dialog2_/kart12TuningLevelUp/",
  dt = "gui_/windowTemplate/",
  Va = [
    "tuning_upgradePopupBg",
    "tuning_arrow_g",
    "tuning_arrow_g_s",
    "icon_ethisChipset",
    "icon_lucci",
    ...[1, 2, 3, 4].map((a) => `tuninglevel_btnStart_${a}`),
  ],
  je = new WeakMap();
function Ha(a) {
  let e = je.get(a);
  return (
    e ||
      ((e = ja(a)),
      je.set(a, e),
      e.catch(() => {
        je.get(a) === e && je.delete(a);
      })),
    e
  );
}
async function ja(a) {
  const e = (v) => {
      const _ = a.exactCanonicalCandidates(v);
      if (_.length !== 1) throw new Error(`强化前窗口资源缺失或不唯一：${v}`);
      return _[0];
    },
    t = j(await e(`${ts}kart12TuningLevelUp@zz.bml`).bytes()),
    s = j(await e(`${dt}kart12TuningLevelUpCard.bml`).bytes()),
    i = t.children.find((v) => y(v, "name") === "kartLevelUp");
  if (!i) throw new Error("强化前窗口缺少 kartLevelUp。");
  const n = j(await e("gui_/monocoque/frame.bml").bytes()),
    r = n.children.find((v) => v.name === y(i, "frame"))?.children[0];
  if (!r) throw new Error("强化前窗口缺少 CaptionDialog。");
  const o = ve(r),
    c = n.children.find((v) => v.name === "BorderLineStaticButton");
  if (!c) throw new Error("强化车辆翻页按钮缺少 BorderLineStaticButton。");
  const l = new Map();
  for (const [v, _] of [
    ["Normal", "normal"],
    ["MouseOn", "hover"],
    ["Clicked", "clicked"],
    ["Disabled", "disabled"],
  ]) {
    const $ = c.children.find((A) => A.name === v);
    if (!$) throw new Error(`强化车辆翻页按钮缺少 ${v} 状态。`);
    const N = ve($);
    if (N.texture !== o.texture)
      throw new Error("强化车辆翻页按钮与窗口使用了不同图集，尚未装载。");
    l.set(_, N);
  }
  const h = Y(i, { x: 0, y: 0, width: 1600, height: 900 }, o),
    d = new Map(),
    f = [],
    p = [];
  let u;
  const g = (v, _) => {
    const $ =
        y(v, "name") === "kartSelector" && y(v, "windowSize") === "0 0 400 400"
          ? {
              ...v,
              attributes: v.attributes.map((q) =>
                q.name === "windowSize" ? { ...q, value: "0 0" } : q,
              ),
            }
          : v,
      N = y(v, "frame"),
      A = N && n.children.find((q) => q.name === N)?.children[0],
      E = A ? ve(A) : void 0,
      M = Y($, _, E),
      G = y(v, "text"),
      F =
        G === "#sb(tuningSlotNum)"
          ? "tuningSlotLabel"
          : G === "#sb(tuningPoint)"
            ? "tuningPointLabel"
            : G === "#sb(tuningTargetKart)" && !d.has("tuningTargetLabel")
              ? "tuningTargetLabel"
              : void 0,
      B = y(v, "name") ?? F ?? v.name;
    if (
      (B === "kartSelector" && (u = v),
      B === "preItemList" || B === "nextItemList")
    ) {
      const q = y(v, "arrowDir");
      if (q !== "left" && q !== "right")
        throw new Error(`${B} 缺少原生箭头方向。`);
      p.push({
        name: B,
        direction: q,
        color: We(y(v, "arrowColor"), `${B} arrowColor`),
        hoverColor: We(y(v, "overArrowColor"), `${B} overArrowColor`),
        clickedColor: We(y(v, "clickedArrowColor"), `${B} clickedArrowColor`),
        disabledColor: We(
          y(v, "disabledArrowColor"),
          `${B} disabledArrowColor`,
        ),
      });
    }
    const O = y(v, "texture");
    ((O === "icon_ethisChipset" || O === "icon_lucci") &&
      f.push({ token: O, rect: M }),
      d.set(B, M),
      v.children.forEach((q) => g(q, E ? Rt(E, M) : M)));
  };
  i.children.forEach((v) => g(v, Rt(o, h)));
  for (const v of [
    "ImageBoard",
    "tuningTargetLabel",
    "itemView",
    "curLevel",
    "nextLevel",
    "tuningSlotLabel",
    "curSlotNum",
    "nextSlotNum",
    "tuningPointLabel",
    "curTp",
    "nextTp",
    "kartList",
    "kartSelector",
    "levelUpStart",
  ])
    if (!d.has(v)) throw new Error(`强化前窗口缺少 ${v}。`);
  if (!u) throw new Error("强化前窗口缺少 kartSelector 定义。");
  if (p.length !== 2) throw new Error("强化车辆翻页箭头定义不完整。");
  const m = Wa(u, s),
    b = y(s, "texture"),
    P = s.children.find((v) => y(v, "name") === "selected"),
    C = P && y(P, "texture");
  if (!b || !C) throw new Error("强化车辆卡片缺少普通或选中贴图映射。");
  const S = new Map(),
    w = new Map();
  let k;
  const x = "P3543 Garage Upgrade",
    T = () => {
      (S.forEach((v) => v.close()),
        S.clear(),
        w.forEach((v) => URL.revokeObjectURL(v)),
        w.clear(),
        k && (Ce(k), (k = void 0)));
    };
  try {
    const v = a.exactCanonicalCandidates(
      "gui_/font/SourceHanSansCN-Bold.otf",
    )[0];
    v && typeof FontFace < "u" && (k = await St(x, await v.bytes()));
    const _ = [
        ...Va.map((A) => ({ token: A, path: `${ts}${A}.png` })),
        { token: "frame", path: `gui_/monocoque/${o.texture}.png` },
        { token: "cardNormal", path: `${dt}${b}.png` },
        { token: "cardSelected", path: `${dt}${C}.png` },
      ],
      N = (
        await Promise.allSettled(
          _.map(async ({ token: A, path: E }) => {
            const M = new Blob([await e(E).bytes()], { type: "image/png" });
            (S.set(A, await $t(await createImageBitmap(M))),
              w.set(A, URL.createObjectURL(M)));
          }),
        )
      ).find((A) => A.status === "rejected");
    if (N?.status === "rejected") throw N.reason;
    for (const A of ["cardNormal", "cardSelected"]) {
      const E = S.get(A);
      if (E.width !== m.width || E.height !== m.height)
        throw new Error(`强化车辆卡片 ${A} 尺寸与 BML 不一致。`);
    }
    return {
      frame: o,
      rect: h,
      rects: d,
      icons: f,
      cardLayout: m,
      pageArrows: p,
      pageButtonFrames: l,
      images: S,
      urls: w,
      font: k,
      fontFamily: k ? x : void 0,
      dispose: T,
    };
  } catch (v) {
    throw (T(), v);
  }
}
function We(a, e) {
  const t = a?.trim().split(/\s+/).map(Number) ?? [];
  if (t.length !== 4 || t.some((s) => !Number.isInteger(s) || s < 0 || s > 255))
    throw new Error(`${e} 无效。`);
  return t;
}
function Wa(a, e) {
  const [, , t, s] = gt(y(e, "windowRect"), 4, "车辆卡片 windowRect"),
    [i, n] = gt(y(a, "alignMargin"), 2, "kartSelector alignMargin"),
    [r, o] = gt(y(a, "clientMargin"), 4, "kartSelector clientMargin"),
    c = Number(y(a, "alignSize")),
    l = Number(y(a, "maxLine"));
  if (![t, s, c, l].every((h) => Number.isInteger(h) && h > 0))
    throw new Error("强化车辆卡片或网格尺寸无效。");
  return {
    width: t,
    height: s,
    columns: c,
    rows: l,
    horizontalMargin: i,
    verticalMargin: n,
    clientLeft: r,
    clientTop: o,
  };
}
function gt(a, e, t) {
  const s = a?.trim().split(/\s+/).map(Number) ?? [];
  if (s.length !== e || s.some((i) => !Number.isFinite(i)))
    throw new Error(`${t} 无效。`);
  return s;
}
const Xa = { x: 186, y: 526, width: 519, height: 210 };
function ss() {
  return { ...Xa };
}
function Ya(a, e) {
  (a.save(),
    (a.fillStyle = "#e9edf2"),
    a.fillRect(e.x, e.y, e.width, e.height),
    a.restore());
}
function Za(a, e) {
  if (![a, e].every((c) => Number.isInteger(c) && c >= 0 && c <= 5) || e < a)
    throw new Error("无效的迅强化等级比较。");
  const t = (c) => Math.min(c, 3),
    s = (c) => (c * (c + 1)) / 2,
    i = t(a),
    n = t(e),
    r = s(a),
    o = s(e);
  return {
    labels: { slotCount: "性能槽数量", tuningPoints: "强化点数" },
    level: { current: a, next: e },
    slots: { current: i, next: n, increment: n - i },
    tuningPoints: { current: r, next: o, increment: o - r },
  };
}
class Qa {
  candidates;
  index;
  pageIndex;
  settled = !1;
  method = "step";
  constructor(e, t) {
    if (
      ((this.candidates = e
        .filter((s) => !Re(s.item.itemId) && s.item.engineGrade === 9)
        .map((s) => {
          if ((kt(s.value), s.value.kind !== "xun"))
            throw new Error("强化目标必须为迅车型。");
          return {
            item: s.item,
            value: {
              ...s.value,
              skills: s.value.skills.map((i) => ({ ...i })),
            },
          };
        })),
      new Set(this.candidates.map((s) => s.item.itemId)).size !==
        this.candidates.length)
    )
      throw new Error("强化目录车辆重复。");
    if (
      ((this.index = this.candidates.findIndex((s) => s.item.itemId === t)),
      this.index < 0)
    )
      throw new Error("强化目标不在迅车型目录中。");
    this.pageIndex = Math.floor(this.index / 16);
  }
  get selected() {
    return this.candidates[this.index];
  }
  get page() {
    return this.pageIndex;
  }
  get pages() {
    return Math.max(1, Math.ceil(this.candidates.length / 16));
  }
  get visible() {
    return this.candidates.slice(this.pageIndex * 16, this.pageIndex * 16 + 16);
  }
  get canStart() {
    return !this.settled && this.selected.value.level < 5;
  }
  get upgradeMethod() {
    return this.method;
  }
  get target() {
    return this.selected.value.level === 5
      ? this.selected.value
      : Ys(this.selected.value, this.method);
  }
  setUpgradeMethod(e) {
    this.settled || (this.method = e);
  }
  turnPage(e) {
    this.settled ||
      (this.pageIndex = Math.min(
        this.pages - 1,
        Math.max(0, this.pageIndex + e),
      ));
  }
  choose(e) {
    if (this.settled) return;
    const t = this.candidates.findIndex((s) => s.item.itemId === e);
    if (t < 0) throw new Error("强化目标不在目录内。");
    ((this.index = t), (this.pageIndex = Math.floor(t / 16)));
  }
  settle(e) {
    if (this.settled) return;
    const t =
      e && this.canStart
        ? { candidate: this.selected, target: this.target, method: this.method }
        : void 0;
    return ((this.settled = !0), t);
  }
}
class Ja {
  constructor(e, t, s, i, n) {
    ((this.onClose = n),
      (this.state = new Qa(s, i)),
      (this.element.className = "garage-upgrade-preparation"),
      this.element.setAttribute("role", "dialog"),
      this.element.setAttribute("aria-modal", "true"),
      this.element.setAttribute("aria-label", "迅车辆强化准备"));
    const r = document.createElement("canvas");
    ((r.width = 1600), (r.height = 900));
    const o = r.getContext("2d");
    if (!o) throw new Error("强化准备画布不可用。");
    ((this.context = o),
      (this.status.className = "garage-preparation-status"),
      this.status.setAttribute("role", "status"),
      (this.status.textContent = "正在加载原版强化窗口…"),
      this.element.append(r, this.controls, this.status),
      e.append(this.element),
      this.cancelButton(),
      this.element.addEventListener("keydown", (c) => {
        if (
          (c.key === "Escape" &&
            (c.preventDefault(), c.stopPropagation(), this.close(!1)),
          c.key === "Tab")
        ) {
          c.preventDefault();
          const l = [
              ...this.controls.querySelectorAll("button:not(:disabled)"),
            ],
            h = l.indexOf(document.activeElement);
          l[(h + (c.shiftKey ? l.length - 1 : 1)) % l.length]?.focus();
        }
      }),
      this.load(t));
  }
  onClose;
  element = document.createElement("div");
  controls = document.createElement("div");
  status = document.createElement("div");
  context;
  pageFrameObservers = [];
  pageFrameRedraws;
  assets;
  disposed = !1;
  previousFocus =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : void 0;
  state;
  get selected() {
    return this.state.selected.item;
  }
  get previewRect() {
    return this.assets?.rects.get("itemView");
  }
  get previewCard() {
    const e = this.previewRect;
    if (e) return { item: this.selected, rect: e };
  }
  get cards() {
    const e = this.assets?.rects.get("kartSelector");
    if (!e) return [];
    const t = this.assets.cardLayout;
    return this.state.visible.map((s, i) => ({
      item: s.item,
      rect: {
        x:
          e.x + t.clientLeft + (i % t.columns) * (t.width + t.horizontalMargin),
        y:
          e.y +
          t.clientTop +
          Math.floor(i / t.columns) * (t.height + t.verticalMargin),
        width: t.width,
        height: t.height,
      },
    }));
  }
  place(e, t) {
    (Object.assign(e.style, {
      position: "absolute",
      left: `${t.x}px`,
      top: `${t.y}px`,
      width: `${t.width}px`,
      height: `${t.height}px`,
    }),
      this.controls.append(e));
  }
  label(e, t, s = "") {
    const i = document.createElement("div");
    ((i.textContent = e),
      (i.className = `garage-preparation-label ${s}`),
      this.place(i, this.assets.rects.get(t)));
  }
  comparisonValue(e, t, s = 0, i = "metric-value") {
    const n = document.createElement("div");
    n.className = `garage-preparation-label ${i}`;
    const r = document.createElement("span");
    if (
      ((r.className = "garage-preparation-value-main"),
      (r.textContent = String(t)),
      n.append(r),
      s > 0)
    ) {
      const o = document.createElement("span");
      ((o.className = "garage-preparation-value-increment"),
        (o.textContent = `(+${s})`),
        n.append(o));
    }
    (n.setAttribute("aria-label", s > 0 ? `${t}，增加 ${s}` : String(t)),
      this.place(n, this.assets.rects.get(e)));
  }
  button(e, t, s, i = !1) {
    const n = document.createElement("button");
    return (
      (n.type = "button"),
      (n.textContent = e),
      n.setAttribute("aria-label", e),
      (n.disabled = i),
      (n.onclick = s),
      this.place(n, t),
      n
    );
  }
  decoratePageArrow(e, t, s) {
    const i = ([h, d, f, p]) => `rgb(${d} ${f} ${p} / ${h / 255})`;
    ((e.className = `garage-preparation-page-arrow ${t.direction}`),
      (e.textContent = ""),
      e.style.setProperty("--page-arrow-normal", i(t.color)),
      e.style.setProperty("--page-arrow-hover", i(t.hoverColor)),
      e.style.setProperty("--page-arrow-active", i(t.clickedColor)),
      e.style.setProperty("--page-arrow-disabled", i(t.disabledColor)));
    const n = document.createElement("canvas");
    ((n.className = "garage-preparation-page-frame"),
      s && ((n.width = s.width), (n.height = s.height)));
    const r = (h) => {
        if (!s || !this.assets) return;
        const d = n.getContext("2d"),
          f = this.assets.pageButtonFrames.get(h),
          p = this.assets.images.get("frame");
        if (!d || !f || !p) return;
        const u = n.getBoundingClientRect();
        (Pe(n, d, u.width, u.height, Ee(), s.width, s.height),
          (d.imageSmoothingEnabled = !0),
          d.clearRect(0, 0, s.width, s.height),
          be(d, f, p, { x: 0, y: 0, width: s.width, height: s.height }));
      },
      o = () => r(e.disabled ? "disabled" : "normal");
    (e.addEventListener("mouseenter", () =>
      r(e.disabled ? "disabled" : "hover"),
    ),
      e.addEventListener("mouseleave", o),
      e.addEventListener("mousedown", () => {
        e.disabled || r("clicked");
      }),
      e.addEventListener("mouseup", () => r(e.disabled ? "disabled" : "hover")),
      e.addEventListener("focus", () => r(e.disabled ? "disabled" : "hover")),
      e.addEventListener("blur", o));
    const c = document.createElement("span");
    ((c.className = "garage-preparation-page-arrow-icon"), e.append(n, c));
    const l = () =>
      r(
        e.disabled
          ? "disabled"
          : e.matches(":active")
            ? "clicked"
            : e.matches(":hover") || document.activeElement === e
              ? "hover"
              : "normal",
      );
    if (typeof ResizeObserver < "u") {
      const h = new ResizeObserver(l);
      (h.observe(n), this.pageFrameObservers.push(h));
    }
    ((this.pageFrameRedraws ??= []).push(l), o());
  }
  cancelButton() {
    const e = this.assets?.rect ?? { x: 178, y: 56, width: 1244 },
      t = this.button(
        "关闭强化准备",
        { x: e.x + e.width - 38, y: e.y + 3, width: 30, height: 30 },
        () => this.close(!1),
      );
    ((t.textContent = "×"),
      (t.className = "garage-preparation-close"),
      t.focus());
  }
  async load(e) {
    let t;
    try {
      if (((t = await Ha(e)), this.disposed)) return;
      ((this.assets = t), this.refresh());
    } catch (s) {
      ((this.assets = void 0),
        this.disposed ||
          (this.controls.replaceChildren(),
          this.cancelButton(),
          (this.status.textContent = `强化窗口加载失败，未修改草稿：${s instanceof Error ? s.message : s}`)));
    }
  }
  refresh() {
    if (!this.assets || this.disposed) return;
    (this.clearPageFrameResources(),
      this.controls.replaceChildren(),
      this.cancelButton());
    const { item: e, value: t } = this.state.selected,
      s = this.state.target,
      i = Za(t.level, s.level),
      n = this.assets,
      r = (u) => n.rects.get(u);
    this.element.style.setProperty(
      "--garage-upgrade-font",
      n.fontFamily ? `"${n.fontFamily}"` : "inherit",
    );
    const o = document.createElement("strong");
    ((o.textContent = "车辆强化"),
      (o.className = "garage-preparation-caption"),
      this.place(o, {
        x: n.rect.x + 60,
        y: n.rect.y + 3,
        width: n.rect.width - 120,
        height: 30,
      }),
      this.label("强化车辆", "tuningTargetLabel", "target-caption"),
      this.label(e.title, "itemName", "vehicle-name"),
      this.label(`${i.level.current}级`, "curLevel", "level-value"),
      this.label(`${i.level.next}级`, "nextLevel", "level-value"),
      this.comparisonValue("curSlotNum", i.slots.current),
      this.comparisonValue("nextSlotNum", i.slots.next, i.slots.increment),
      this.comparisonValue("curTp", i.tuningPoints.current),
      this.comparisonValue(
        "nextTp",
        i.tuningPoints.next,
        i.tuningPoints.increment,
      ),
      this.label(i.labels.slotCount, "tuningSlotLabel", "metric-caption"),
      this.label(i.labels.tuningPoints, "tuningPointLabel", "metric-caption"));
    const c = document.createElement("section");
    ((c.className = "garage-upgrade-method-panel"), this.place(c, ss()));
    const l = document.createElement("strong");
    ((l.className = "garage-upgrade-method-title"),
      (l.textContent = "强化方式"),
      c.append(l));
    const h = document.createElement("div");
    ((h.className = "garage-upgrade-method-divider"), c.append(h));
    const d = document.createElement("div");
    ((d.className = "garage-upgrade-method-buttons"), c.append(d));
    for (const [u, g] of [
      ["step", "逐级强化"],
      ["max", "一键升满"],
    ]) {
      const m = this.state.upgradeMethod === u,
        b = document.createElement("button");
      ((b.type = "button"),
        (b.textContent = g),
        b.setAttribute("aria-label", g),
        (b.disabled = u === "max" && t.level === 5),
        (b.onclick = () => {
          (this.state.setUpgradeMethod(u), this.refresh());
        }),
        (b.className = `garage-upgrade-method${m ? " selected" : ""}`),
        b.setAttribute("aria-pressed", String(m)),
        d.append(b));
    }
    const f = document.createElement("div");
    ((f.className = "garage-upgrade-method-help"),
      (f.textContent =
        this.state.upgradeMethod === "step"
          ? `逐级强化：点击升级后提升 1 级。
强化完成后立即写入当前车辆。`
          : `一键升满：点击升级后直接提升至 5 级。
强化完成后立即写入当前车辆。`),
      c.append(f),
      this.label(
        `离线目录：${this.state.candidates.length}辆`,
        "kartCount",
        "count",
      ),
      this.label(
        `${this.state.page + 1} / ${this.state.pages}`,
        "pageInfo",
        "fee",
      ));
    for (const u of n.pageArrows) {
      const g = u.name === "preItemList",
        m = this.button(
          g ? "上一页强化车辆" : "下一页强化车辆",
          r(u.name),
          () => {
            (this.state.turnPage(g ? -1 : 1), this.refresh());
          },
          g ? this.state.page === 0 : this.state.page + 1 === this.state.pages,
        );
      this.decoratePageArrow(m, u, r(u.name));
    }
    const p = this.button(
      t.level === 5 ? "车辆已满级" : `开始本地 Lv.${s.level} 强化`,
      r("levelUpStart"),
      () => this.close(!0),
      !this.state.canStart,
    );
    ((p.className = "garage-native-button"), (p.textContent = ""));
    for (let u = 1; u <= 4; u++)
      p.style.setProperty(
        `--button-${u}`,
        `url("${n.urls.get(`tuninglevel_btnStart_${u}`)}")`,
      );
    for (const { item: u, rect: g } of this.cards) {
      const m = this.button(`强化目标：${u.title}`, g, () => {
        (this.state.choose(u.itemId), this.refresh());
      });
      ((m.className = "garage-preparation-card"),
        m.setAttribute("aria-pressed", String(u.itemId === e.itemId)),
        (m.textContent = ""),
        (m.title = u.title));
    }
    this.status.textContent = "";
  }
  draw(e) {
    if (!this.assets || this.disposed) return;
    const t = this.context,
      s = this.assets,
      i = t.canvas.getBoundingClientRect();
    (Pe(t.canvas, t, i.width, i.height, Ee(), 1600, 900),
      (t.imageSmoothingEnabled = !0),
      t.clearRect(0, 0, 1600, 900),
      be(t, s.frame, s.images.get("frame"), s.rect));
    const n = s.rects.get("ImageBoard");
    (t.drawImage(
      s.images.get("tuning_upgradePopupBg"),
      n.x,
      n.y,
      n.width,
      n.height,
    ),
      Ya(t, ss()));
    for (const r of ["arrow0", "arrow1", "arrow2"]) {
      const o = s.rects.get(r),
        c = s.images.get(
          r === "arrow0" ? "tuning_arrow_g" : "tuning_arrow_g_s",
        );
      t.drawImage(c, 0, 0, c.width / 3, c.height, o.x, o.y, o.width, o.height);
    }
    (this.previewCard &&
      e.drawCard(t, this.previewCard.item, this.previewCard.rect),
      en(
        t,
        e,
        this.cards,
        this.selected.itemId,
        s.images.get("cardNormal"),
        s.images.get("cardSelected"),
      ));
  }
  resizeCanvases() {
    this.pageFrameRedraws?.forEach((e) => e());
  }
  close(e) {
    if (this.disposed || (e && (!this.assets || !this.state.canStart))) return;
    const t = this.state.settle(e);
    (this.dispose(),
      this.onClose(t),
      !t && this.previousFocus?.isConnected && this.previousFocus.focus());
  }
  dispose() {
    this.disposed ||
      ((this.disposed = !0),
      this.state.settle(!1),
      this.clearPageFrameResources(),
      (this.assets = void 0),
      this.element.remove());
  }
  clearPageFrameResources() {
    (this.pageFrameObservers.forEach((e) => e.disconnect()),
      (this.pageFrameObservers.length = 0),
      this.pageFrameRedraws?.splice(0));
  }
}
function en(a, e, t, s, i, n) {
  for (const { item: r, rect: o } of t)
    (a.drawImage(i, o.x, o.y, o.width, o.height),
      e.drawCard(a, r, o),
      r.itemId === s && a.drawImage(n, o.x, o.y, o.width, o.height));
}
const Ct = {
    TransAccelFactor: "transAccelFactor",
    DriftEscapeForce: "driftEscapeForce",
    NormalBoosterTime: "normalBoosterTime",
    DriftMaxGauge: "driftMaxGauge",
  },
  Pt = () => ({
    TransAccelFactor: 0,
    DriftEscapeForce: 0,
    NormalBoosterTime: 0,
    DriftMaxGauge: 0,
  });
function is(a) {
  if (a === void 0 || !a.trim() || !Number.isSafeInteger(Number(a)))
    throw new Error("迅技能评分数值无效。");
  return Number(a);
}
function tn(a, e) {
  if (a.name !== "kart12TuningData" || e.name !== "TuneAbilityList")
    throw new Error("迅技能评分资源根节点无效。");
  const t = a.children.filter((i) => i.name === "tuningSkillSet");
  if (t.length !== 1) throw new Error("迅技能组缺失或重复。");
  const s = new Map();
  for (let i = 1; i <= 9; i++) {
    const n = t[0].children.filter(
      (l) => l.name === "Skill" && L(l, "idx") === String(i),
    );
    if (n.length !== 1) throw new Error(`迅技能 ${i} 缺失或重复。`);
    const r = is(L(n[0], "tuneGroupId")),
      o = e.children.filter(
        (l) => l.name === "TuneGroup" && L(l, "id") === String(r),
      );
    if (o.length !== 1) throw new Error(`迅技能效果组 ${r} 缺失或重复。`);
    const c = [Pt()];
    for (let l = 1; l <= 5; l++) {
      const h = o[0].children.filter(
        (f) => f.name === "Tune" && L(f, "id") === String(l),
      );
      if (h.length !== 1) throw new Error(`迅技能 ${i}/${l} 缺失或重复。`);
      const d = { ...Pt() };
      for (const f of h[0].children) {
        if (f.name !== "EnchanterAddSpec")
          throw new Error("迅竞速技能评分遇到未支持的效果类型。");
        const p = f.children.filter((u) => u.name === "UiValue");
        if (p.length > 1) throw new Error("迅技能 UiValue 重复。");
        for (const u of Object.keys(Ct))
          if (
            ((d[u] += p[0] ? is(L(p[0], Ct[u]) ?? "0") : 0),
            !Number.isSafeInteger(d[u]))
          )
            throw new Error("迅技能评分溢出。");
      }
      c.push(d);
    }
    s.set(i, c);
  }
  return s;
}
function sn(a, e) {
  const t = { ...Pt() };
  if (!e) return t;
  kt(e);
  for (const s of e.skills) {
    if (s.points === 0) continue;
    const i = a?.get(s.id)?.[s.points];
    if (!i) throw new Error("迅技能评分资源尚未加载。");
    for (const n of Object.keys(Ct)) t[n] += i[n];
  }
  return t;
}
async function an(a) {
  const e = await Promise.all(
    [
      "zeta_/cn/engine/kart12TuningData.xml",
      "zeta_/cn/enchant/enchant.xml",
    ].map(async (t) => {
      const s = a.exactCanonicalCandidates(t);
      if (s.length !== 1) throw new Error(`迅技能评分资源缺失或不唯一：${t}。`);
      return Z(await s[0].bytes()).root;
    }),
  );
  return tn(e[0], e[1]);
}
const tt = {
    TransAccelFactor: "transAccelFactor",
    DriftEscapeForce: "driftEscapeForce",
    SteerConstraint: "steerConstraint",
    NormalBoosterTime: "normalBoosterTime",
    DriftMaxGauge: "driftMaxGauge",
  },
  ks = () => ({
    TransAccelFactor: 0,
    DriftEscapeForce: 0,
    SteerConstraint: 0,
    NormalBoosterTime: 0,
    DriftMaxGauge: 0,
  });
function nn(a) {
  if (a.name !== "TuneAbilityList") throw new Error("改装评分资源根节点无效。");
  const e = new Map();
  for (const { id: t } of ms) {
    const s = a.children.filter(
      (o) =>
        o.name === "TuneGroup" && L(o, "id") === String(Math.floor(t / 100)),
    );
    if (s.length !== 1) throw new Error(`改装评分组 ${t} 缺失或重复。`);
    const i = s[0].children.filter(
      (o) => o.name === "Tune" && L(o, "id") === String(t % 100),
    );
    if (i.length !== 1 || i[0].children.length !== 1)
      throw new Error(`改装评分效果 ${t} 缺失或重复。`);
    const n = i[0].children[0];
    if (
      n.name !== "EnchanterAddSpec" ||
      n.children.some((o) => o.name !== "UiValue")
    )
      throw new Error("改装评分遇到未核实的增强类型或展示投影。");
    const r = ks();
    for (const o of Object.keys(tt)) {
      const c = L(n, tt[o]) ?? "0",
        l = Math.fround(Number(c));
      if (!c.trim() || !Number.isFinite(l))
        throw new Error("改装评分属性值无效。");
      r[o] = l;
    }
    e.set(t, r);
  }
  return e;
}
function as(a, e, t, s = !1) {
  if (!t || (Tt(t), !t.active && !s)) return a;
  const i = ks();
  for (const r of t.abilities) {
    if (r === 0) continue;
    const o = e?.get(r);
    if (!o) throw new Error("改装评分资源尚未加载。");
    for (const c of Object.keys(tt)) i[c] = Math.fround(i[c] + o[c]);
  }
  const n = { ...a };
  for (const r of Object.keys(tt))
    if (
      n[r] !== void 0 &&
      ((n[r] = Math.fround(n[r] + i[r])), !Number.isFinite(n[r]))
    )
      throw new Error("改装评分属性溢出。");
  return n;
}
async function rn(a) {
  const e = "zeta_/cn/enchant/enchant.xml",
    t = a.exactCanonicalCandidates(e);
  if (t.length !== 1) throw new Error(`改装评分资源缺失或不唯一：${e}。`);
  return nn(Z(await t[0].bytes()).root);
}
const Se = [
    "TransAccelFactor",
    "DriftEscapeForce",
    "SteerConstraint",
    "NormalBoosterTime",
    "DriftMaxGauge",
  ],
  U = Math.fround,
  Lt = {
    "x-v1": [4, 1, 3, 2, 1],
    "xun-body": [3, 1, 2, 2, 1],
    "xun-parts": [3, 1, 2, 2, 1],
  };
function xe(a) {
  const e = U(a);
  if (!Number.isFinite(e)) throw new Error("车库评分包含非有限数值。");
  return e;
}
function re(a) {
  if (!a.trim()) throw new Error("车库评分数值为空。");
  return xe(Number(a));
}
function on(a) {
  return Object.fromEntries(
    Se.map((e) => {
      const t = L(a, e),
        s = t === void 0 ? void 0 : re(t);
      return [e, s === -1e5 ? void 0 : s];
    }),
  );
}
function ns(a, e) {
  if (a.name !== "partsConst") throw new Error("车库评分资源根节点无效。");
  const t = a.children.filter((n) => n.name === "weightConst");
  if (t.length !== 1) throw new Error("车库评分权重组缺失或重复。");
  const s =
      e === "x-v1" ? "weight" : e === "xun-body" ? "weightKart" : "weightParts",
    i = new Map();
  return (
    Se.forEach((n, r) => {
      const o = t[0].children.filter((l) => l.name === s && L(l, "name") === n);
      if (o.length !== 1) throw new Error(`车库评分权重缺失或重复：${n}。`);
      const c = (L(o[0], "value") ?? "").split(",").map(re);
      if (c.length !== Lt[e][r])
        throw new Error(`车库评分权重长度无效：${n}。`);
      if (n === "DriftEscapeForce" && c[0] === 0)
        throw new Error("车库评分分母为零。");
      i.set(n, { values: c, fallback: re(L(o[0], "default") ?? "0") });
    }),
    { kind: e, rows: i }
  );
}
function rs(a) {
  return U(Math.floor(U(a + (a < 0 ? -0.5 : 0.5))));
}
function _s(a, e, t) {
  const s = t.rows.get(a);
  if (!s) throw new Error(`车库评分权重缺失：${a}。`);
  const i = Se.indexOf(a);
  if (s.values.length !== Lt[t.kind][i])
    throw new Error(`车库评分权重长度无效：${a}。`);
  const n = s.values.map(xe),
    r = xe(e ?? s.fallback);
  let o;
  switch (a) {
    case "TransAccelFactor": {
      const c = t.kind === "x-v1" && r <= U(1.85) ? n[3] : n[2];
      o = rs(U(U(U(r - n[1]) * c) + n[0]));
      break;
    }
    case "DriftEscapeForce":
      o = U(r / n[0]);
      break;
    case "SteerConstraint":
      o = rs(
        t.kind === "x-v1"
          ? U(U(U(r - n[1]) * n[2]) + n[0])
          : U(U(r + n[0]) * n[1]),
      );
      break;
    case "NormalBoosterTime":
      o =
        t.kind === "x-v1"
          ? U(U(r - n[1]) + n[0])
          : U(U(r - U(-n[0])) - U(-n[1]));
      break;
    case "DriftMaxGauge":
      o = U(r * n[0]);
      break;
  }
  return xe(o);
}
function Nt(a) {
  if (!Number.isFinite(a) || a < -2147483648 || a >= 2147483648)
    throw new Error("车库评分整数转换溢出。");
  return Math.trunc(a) & 65535;
}
function ut(a, e) {
  if (e.kind === "xun-parts") throw new Error("车体评分不能使用部件权重。");
  return Object.fromEntries(
    Se.map((t) => [t, (Nt(_s(t, a[t], e)) << 16) >> 16]),
  );
}
function cn(a, e, t) {
  if (t.kind !== "x-v1") throw new Error("X/V1 部件反向换算不能使用迅权重。");
  const s = t.rows.get(a);
  if (!s || s.values.length !== Lt[t.kind][Se.indexOf(a)])
    throw new Error("部件评分权重无效。");
  const i = s.values.map(xe),
    n = xe(e);
  if (!Number.isInteger(n) || n < 0 || n > 65535)
    throw new Error("部件评分必须为有效整数。");
  const r = U(
    a === "TransAccelFactor" || a === "SteerConstraint"
      ? U(U(n - i[0]) / i[2]) + i[1]
      : a === "DriftEscapeForce"
        ? n * i[0]
        : U(n - i[0]) + i[1],
  );
  return xe(r);
}
function ln(a) {
  const e = a.children.filter((s) => s.name === "gradeSection");
  if (e.length !== 1) throw new Error("部件评分档位组缺失或重复。");
  const t = new Map();
  for (const s of e[0].children.filter((i) => i.name === "grade")) {
    const i = re(L(s, "engineGrade") ?? "");
    if (!Number.isInteger(i) || t.has(i))
      throw new Error("部件评分车代无效或重复。");
    const n = new Map();
    for (const r of Se.slice(0, 4)) {
      const o = s.children.filter(
        (l) => l.name === "section" && L(l, "param") === r,
      );
      if (o.length !== 1) throw new Error(`部件评分档位缺失或重复：${r}。`);
      const c = ["normal", "rare", "legend", "unique"].map((l) => {
        const h = o[0].children.filter((f) => f.name === l);
        if (h.length !== 1) throw new Error("部件品质档位缺失或重复。");
        const d = {
          min: re(L(h[0], "min") ?? ""),
          max: re(L(h[0], "max") ?? ""),
          unit: re(L(h[0], "unit") ?? ""),
        };
        if (
          !Object.values(d).every(Number.isInteger) ||
          d.min < 0 ||
          d.max > 65535 ||
          d.min > d.max ||
          d.unit <= 0 ||
          (d.max - d.min) / d.unit !== 9
        )
          throw new Error("部件评分档位范围无效。");
        return d;
      });
      n.set(r, c);
    }
    t.set(i, n);
  }
  return t;
}
function hn(a, e, t, s) {
  return (
    Number.isInteger(s) &&
    !!a
      .get(e)
      ?.get(t)
      ?.some((i) => s >= i.min && s <= i.max && (s - i.min) % i.unit === 0)
  );
}
function dn(a, e, t, s) {
  const i = a.get(e)?.get(t);
  if (!(!i || !Number.isInteger(s))) {
    for (let n = i.length - 1; n >= 0; n--) {
      const r = i[n];
      if (s >= r.min) return 4 - n;
    }
    return 4;
  }
}
const Is = new Map([
  [72, "TransAccelFactor"],
  [73, "SteerConstraint"],
  [74, "DriftEscapeForce"],
  [75, "NormalBoosterTime"],
]);
function gn(a, e) {
  if (e.kind !== "xun-parts") throw new Error("迅部件评分必须使用部件权重。");
  const t = a.children.filter((i) => i.name === "partsValue");
  if (t.length !== 1) throw new Error("迅部件数值组缺失或重复。");
  const s = new Set();
  return t[0].children
    .filter((i) => i.name === "parts")
    .map((i) => {
      const n = re(L(i, "partsCatId") ?? ""),
        r = re(L(i, "partsItemId") ?? ""),
        o = Is.get(n),
        c = `${n}:${r}`;
      if (!o || !Number.isInteger(r) || r < 0 || r > 65535 || s.has(c))
        throw new Error(`迅部件编号无效或重复：${c}。`);
      s.add(c);
      const l = Nt(_s(o, re(L(i, "value") ?? ""), e));
      return { category: n, itemId: r, field: o, score: l };
    });
}
function un(a, e, t = {}) {
  const s = { ...a };
  for (const i of Se) {
    const n = e.filter((c) => c.field === i);
    if (n.length > 1 || n.some((c) => Is.get(c.category) !== i))
      throw new Error("迅部件评分槽位重复或不匹配。");
    const r = i === "SteerConstraint" ? 0 : (t[i] ?? 0),
      o = [a[i], n[0]?.score ?? 0, r];
    if (!o.every(Number.isSafeInteger))
      throw new Error("迅组合评分必须为有效整数。");
    s[i] = Nt(o.reduce((c, l) => c + l, 0));
  }
  return s;
}
const os = new WeakMap();
async function cs(a, e, t) {
  let s = os.get(a);
  s || ((s = new Map()), os.set(a, s));
  let i = s.get(t);
  i ||
    ((i = (async () => {
      const o = a.exactCanonicalCandidates(
        `zeta_/cn/${t === "x-v1" ? "parts" : "engine"}/partsConst.xml`,
      );
      if (o.length !== 1) throw new Error("车库评分资源缺失或不唯一。");
      const c = Z(await o[0].bytes()).root;
      return {
        table: ns(c, t),
        parts: t === "x-v1" ? [] : gn(c, ns(c, "xun-parts")),
        grid: t === "x-v1" ? ln(c) : void 0,
        skills: t === "xun-body" ? await an(a) : void 0,
        factory: t === "x-v1" ? await rn(a) : void 0,
      };
    })()),
    s.set(t, i),
    i.catch(() => s.delete(t)));
  const [n, r] = await Promise.all([ps(a, e), i]);
  return { ...r, input: on(n.value.body) };
}
const pn = {
    engine: "TransAccelFactor",
    handle: "SteerConstraint",
    wheel: "DriftEscapeForce",
    booster: "NormalBoosterTime",
  },
  fn = { engine: 72, handle: 73, wheel: 74, booster: 75 },
  mn = {
    TransAccelFactor: "transAccelFactor",
    DriftEscapeForce: "driftEscapeForce",
    SteerConstraint: "steerConstraint",
    NormalBoosterTime: "normalBoosterTime",
    DriftMaxGauge: "driftMaxGauge",
  },
  ls = [
    ["加速度", "TransAccelFactor", "transAccelFactor"],
    ["弯道", "SteerConstraint", "cornerDrawFactor"],
    ["漂移", "DriftEscapeForce", "driftEscapeForce"],
    ["加速时间", "NormalBoosterTime", "normalBoosterTime"],
    ["集气速度", "DriftMaxGauge", "boosterGauge"],
  ];
function wn(a, e, t) {
  const s = (i) => `(${i - t >= 0 ? "+" : ""}${i - t})`;
  return {
    beforeValue: String(a),
    beforeDelta: s(a),
    afterValue: String(e),
    afterDelta: s(e),
    trend: e > a ? "increase" : "decrease",
  };
}
function yn(a, e) {
  const t = { ...a };
  for (const s of de) {
    const i = e[s];
    if (i?.family === "legacy")
      for (const [n, r] of Object.entries(mn)) {
        const o = i.legacySpec?.[r];
        o === void 0 ||
          !Number.isFinite(o) ||
          t[n] === void 0 ||
          (t[n] = Math.fround(t[n] + o));
      }
  }
  return t;
}
function Me(a, e, t, s, i, n) {
  const r = me(e, t),
    o = vt(e, t);
  if (!o || (a.table.kind === "xun-body") != (o === "xun"))
    throw new Error("评分资源与车辆代际不匹配。");
  if ((s.factory && Tt(s.factory), r))
    for (const h of de) {
      const d = s[h];
      if (
        d &&
        (Zs(d),
        !(r === "legacy" && d.family !== "legacy") &&
          (d.family !== r || d.slot !== h || fe(e, h)))
      )
        throw new Error("评分部件与车辆不兼容。");
    }
  if (r === "xun") {
    const h = de.flatMap((f) => {
        if (f === n) return [];
        const p = Xe(e, s, f, i, t);
        if (!p) return [];
        const u = a.parts.find(
          (g) => g.category === fn[f] && g.itemId === p.itemId,
        );
        if (!u) throw new Error("迅部件缺少原版评分数据。");
        return [u];
      }),
      d = sn(a.skills, s.progression?.kind === "xun" ? s.progression : void 0);
    return un(ut(a.input, a.table), h, d);
  }
  if (r === "legacy")
    return ut(as(yn(a.input, s), a.factory, s.factory), a.table);
  const c = { ...a.input };
  for (const h of de) {
    const d = s[h];
    if (!d || !r) continue;
    const f = pn[h];
    if (!a.grid) throw new Error("部件评分档位资源缺失。");
    const p = a.grid.has(t) ? t : ys(t);
    if (!hn(a.grid, p, f, d.value))
      throw new Error("部件评分不在原版允许档位中。");
    c[f] !== void 0 && (c[f] = cn(f, d.value, a.table));
  }
  const l = ut(as(c, a.factory, s.factory), a.table);
  return Object.fromEntries(Object.entries(l).map(([h, d]) => [h, d & 65535]));
}
class vn {
  constructor(e, t, s) {
    ((this.viewport = e), (this.hitTarget = t), (this.snapStep = s));
  }
  viewport;
  hitTarget;
  snapStep;
  grab;
  maximum() {
    const e = Math.max(
        0,
        this.viewport.scrollHeight - this.viewport.clientHeight,
      ),
      t = this.snapStep?.();
    return t && Number.isFinite(t) && t > 0 ? Math.floor(e / t) * t : e;
  }
  geometry(e, t) {
    const s = this.viewport.clientHeight,
      i = s + this.maximum();
    if (!(i <= s || s <= 0))
      return Qs(e, t, i / s, 0, this.viewport.scrollTop, i);
  }
  page(e) {
    const t = this.maximum();
    if (t <= 0) return !1;
    const s = Math.max(
      0,
      Math.min(t, this.viewport.scrollTop + e * this.viewport.clientHeight),
    );
    return (s !== this.viewport.scrollTop && (this.viewport.scrollTop = s), !0);
  }
  down(e, t, s, i) {
    const n = this.geometry(t, s);
    n &&
      (e.preventDefault(),
      this.hitTarget.setPointerCapture(e.pointerId),
      i >= n.button.y && i <= n.button.y + n.button.height
        ? (this.grab = i - n.button.y)
        : ((this.viewport.scrollTop +=
            i < n.button.y
              ? -this.viewport.clientHeight
              : this.viewport.clientHeight),
          (this.grab = n.button.height / 2),
          this.move(t, s, i)));
  }
  move(e, t, s) {
    if (this.grab === void 0) return;
    const i = this.geometry(e, t);
    if (!i) return;
    const n = t.height - i.button.height,
      r = this.maximum();
    this.viewport.scrollTop =
      n <= 0 ? 0 : Math.max(0, Math.min(r, ((s - t.y - this.grab) * r) / n));
  }
  up(e) {
    ((this.grab = void 0),
      this.hitTarget.hasPointerCapture(e) &&
        this.hitTarget.releasePointerCapture(e));
  }
}
const bn = [
    "",
    "loGradeUnique",
    "loGradeLegend",
    "loGradeRare",
    "loGradeAverage",
  ],
  xn = {
    engine: "partsEngine12",
    handle: "partsHandle12",
    wheel: "partsWheel12",
    booster: "partsBooster12",
  },
  Cn = ["", "终极", "稀有", "高级", "普通"];
function Ge(a, e, t) {
  return a.get(e)?.trim() || t;
}
function pt(a, e, t) {
  const s = Ge(a, "partsEngine12", "引擎"),
    i = Ge(a, `engineGrade${e}`, t);
  return i.endsWith(s) ? i.slice(0, -s.length).trim() : i.trim();
}
function Ls(a, e) {
  if (a.family === "xun" || a.family === "legacy") return;
  const i = (e.length > 0 ? e : gs(a.family, a.slot))
    .filter(
      (n) => n.family === a.family && n.slot === a.slot && n.grade === a.grade,
    )
    .sort((n, r) => n.value - r.value || n.itemId - r.itemId)
    .findIndex((n) => n.value === a.value && n.itemId === a.itemId);
  return i < 0 ? void 0 : i + 1;
}
function Ns(a, e) {
  if (a.family !== "xun") return Ls(a, e);
  const s = e
    .filter(
      (i) => i.family === "xun" && i.slot === a.slot && i.grade === a.grade,
    )
    .sort((i, n) => i.value - n.value || i.itemId - n.itemId)
    .findIndex((i) => i.itemId === a.itemId && i.value === a.value);
  return s < 0 ? void 0 : s + 1;
}
function Pn(a, e) {
  if (a.family !== "xun") return !1;
  const t = e
    .filter(
      (s) => s.family === "xun" && s.slot === a.slot && s.grade === a.grade,
    )
    .sort((s, i) => s.value - i.value || s.itemId - i.itemId);
  return (
    t.length > 0 &&
    t[t.length - 1].itemId === a.itemId &&
    t[t.length - 1].value === a.value
  );
}
function En(a, e, t) {
  return t && Pn(a, e);
}
function ft(a, e) {
  const t = a >= 1 && a <= 3 ? a : 4;
  return Ge(e, bn[t], Cn[t]);
}
function Et(a) {
  const e = a.family === "legacy" ? a.legacyRarity : a.grade;
  return e !== void 0 && Number.isInteger(e) && e >= 1 && e <= 4 ? e : void 0;
}
function Sn(a, e) {
  const t = Et(a);
  return t === void 0 ? e : `unique${t}_x`;
}
function $n(a, e, t) {
  const s =
    a.family === "legacy"
      ? le(a.slot, a.family)
      : Ge(e, xn[a.slot], le(a.slot, a.family));
  if (a.family === "legacy")
    return a.legacyTitle?.trim() || `${le(a.slot, a.family)} ${a.itemId}`;
  if (a.builtIn) {
    const r =
        a.engineGrade === void 0 || a.engineGrade === 0 ? 0 : a.engineGrade + 4,
      o = pt(
        e,
        r,
        a.engineGrade === 8 ? "V1引擎" : a.engineGrade === 7 ? "X引擎" : "",
      ),
      c = ft(a.grade, e);
    return [o, c, Ge(e, "partsBasic", "基本"), s].filter(Boolean).join(" ");
  }
  if (a.family === "xun") {
    const r = ft(a.grade, e),
      o = Ns(a, t);
    return [pt(e, 13, "迅引擎"), r, s, o === void 0 ? "" : String(o)]
      .filter(Boolean)
      .join(" ");
  }
  const i = Ls(a, t),
    n = ft(a.grade, e);
  return [
    pt(e, a.family === "v1" ? 12 : 11, a.family === "v1" ? "V1引擎" : "X引擎"),
    n,
    s,
    String(i === void 0 ? a.value : i),
  ]
    .filter(Boolean)
    .join(" ");
}
class Tn {
  constructor(e, t, s, i, n) {
    ((this.assets = t),
      (this.onClose = n),
      (this.overlay.className =
        "garage-exceed-change garage-exceed-choice-dialog"),
      (this.panel.className = "garage-exceed-change-panel"),
      this.panel.setAttribute("role", "dialog"),
      this.panel.setAttribute("aria-modal", "true"),
      this.panel.setAttribute("aria-label", "选择超负荷类型"));
    const r = document.createElement("strong");
    ((r.className = "garage-exceed-change-title"),
      (r.textContent = "选择超负荷类型"));
    const o = document.createElement("p");
    ((o.className = "garage-exceed-choice-description"),
      (o.textContent = `${i.title} · 当前类型 ${this.typeName(i.type)}`));
    const c = document.createElement("div");
    c.className = "garage-exceed-choice-grid";
    for (const h of Ye) c.append(this.choiceButton(h, c));
    (c.append(this.choiceButton("random", c)),
      (this.action.type = "button"),
      (this.action.className = "garage-exceed-choice-action"),
      he(this.action, void 0, "primary"),
      (this.action.textContent = "确定"),
      (this.action.disabled = !0),
      (this.action.onclick = () => {
        this.selected === void 0 ||
          this.disposed ||
          this.showConfirmation(this.selected);
      }),
      (this.cancel.type = "button"),
      (this.cancel.className = "garage-exceed-choice-cancel"),
      (this.cancel.textContent = "取消"),
      he(this.cancel, void 0, "secondary"),
      (this.cancel.onclick = () => this.close(void 0)));
    const l = document.createElement("button");
    ((l.type = "button"),
      (l.className = "garage-exceed-change-close"),
      (l.textContent = "×"),
      l.setAttribute("aria-label", "关闭超负荷类型选择"),
      (l.onclick = () => this.close(void 0)),
      this.panel.append(r, o, c, this.action, this.cancel, l),
      this.overlay.append(this.panel),
      e.append(this.overlay),
      l.focus(),
      this.loadActionStyles(s),
      this.overlay.addEventListener("keydown", (h) => {
        h.key === "Escape" && (h.preventDefault(), this.close(void 0));
      }));
  }
  assets;
  onClose;
  overlay = document.createElement("div");
  panel = document.createElement("div");
  action = document.createElement("button");
  cancel = document.createElement("button");
  selected;
  disposed = !1;
  previousFocus =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : void 0;
  choiceButton(e, t) {
    const s = document.createElement("button");
    ((s.type = "button"), (s.className = "garage-exceed-choice"));
    const i = e === "random" ? 5 : e,
      n = this.assets.exceedTypes?.get(i);
    s.append(this.typeIcon(i, n));
    const r = document.createElement("strong");
    r.textContent = e === "random" ? "随机" : this.typeName(i);
    const o = document.createElement("span");
    return (
      (o.textContent =
        e === "random"
          ? "在 S / B / L 中随机选择"
          : n
            ? `加速度 ${n.accelLevel}　时间 ${n.timeLevel}`
            : "类型资料缺失"),
      s.append(r, o),
      (s.onclick = () => {
        ((this.selected = e),
          t
            .querySelectorAll("button")
            .forEach((c) => c.classList.toggle("selected", c === s)),
          (this.action.disabled = !1));
      }),
      s
    );
  }
  async loadActionStyles(e) {
    try {
      const t = await Ts(e);
      if (this.disposed) return;
      (he(this.action, t.actionStyles.get("okButton"), "primary"),
        he(this.cancel, t.actionStyles.get("cancelButton"), "secondary"));
    } catch {}
  }
  typeName(e) {
    return (
      new Map([
        [2, "S"],
        [3, "B"],
        [4, "L"],
        [5, "随机"],
      ]).get(e) ?? `类型 ${e}`
    );
  }
  typeIcon(e, t) {
    const s = document.createElement("img");
    return (
      (s.src =
        this.assets.urls.get(`icon_exceedB_${t?.textureType ?? e}`) ?? ""),
      (s.alt = this.typeName(e)),
      s
    );
  }
  showConfirmation(e) {
    const t = document.createElement("div");
    t.className = "garage-exceed-confirm-shade";
    const s = document.createElement("div");
    s.className = "garage-exceed-confirm garage-exceed-choice-confirm";
    const i = document.createElement("strong");
    i.textContent = "变更超负荷类型";
    const n = document.createElement("p");
    n.textContent =
      e === "random"
        ? `将随机变更超负荷类型。
确定继续吗？`
        : `确定将当前车辆的超负荷类型变更为 ${this.typeName(e)} 吗？`;
    const r = document.createElement("button"),
      o = document.createElement("button");
    ((r.type = o.type = "button"),
      (r.textContent = "确定"),
      (o.textContent = "取消"),
      (r.className = "primary"),
      (r.onclick = () => this.close(ua(e))),
      (o.onclick = () => t.remove()),
      s.append(i, n, r, o),
      t.append(s),
      this.panel.append(t),
      o.focus());
  }
  close(e) {
    this.disposed ||
      ((this.disposed = !0),
      this.overlay.remove(),
      this.onClose(e),
      this.previousFocus?.isConnected && this.previousFocus.focus());
  }
  dispose() {
    this.close(void 0);
  }
}
const kn = 9,
  _n = { x: 70, y: 590, width: 100, height: 32 };
function In(a) {
  return `garage_img_textCarType${a === 1 ? 1 : 2}`;
}
function Ln(a, e) {
  return a === "factory"
    ? []
    : a === "level"
      ? e
        ? ["backGround_12", "textPerformList_12", "selectedKartType"]
        : ["selectedKartType"]
      : [
          "partsListBoard",
          e ? "textPerformList_12" : "textPerformList",
          "selectedKartType",
        ];
}
function Nn(a, e) {
  return a === "parts" ? e.backgroundTexture : void 0;
}
const hs = new WeakMap();
function An(a, e) {
  let t = hs.get(a);
  if (!t) {
    const n = [],
      r = (o) => {
        const c = y(o, "name");
        (c && n.push(c), o.children.forEach(r));
      };
    (r(a), (t = n), hs.set(a, t));
  }
  const s = t.indexOf("kartPreview");
  if (s < 0 || e.some((n) => !t.includes(n)))
    throw new Error("车库绘制窗口缺少原件顺序。");
  const i = [...e].sort((n, r) => t.indexOf(n) - t.indexOf(r));
  return {
    beforePreview: i.filter((n) => t.indexOf(n) < s),
    afterPreview: i.filter((n) => t.indexOf(n) > s),
  };
}
function ds(a, e) {
  return a === "parts" || (a === "level" && e === 9);
}
function mt(a, e = !1) {
  return !a && !e;
}
const wt = {
  engine: "tuneEnginePatch",
  handle: "tuneHandle",
  wheel: "tuneWheel",
  booster: "tuneSupportKit",
};
function Mn(a, e, t, s) {
  const i = () => {
      a.disabled || s(e);
    },
    n = () => {
      t() === e && s(void 0);
    };
  (a.addEventListener("pointerenter", i),
    a.addEventListener("focus", i),
    a.addEventListener("pointerleave", n),
    a.addEventListener("pointercancel", n),
    a.addEventListener("blur", n));
}
function Rn(a, e, t, s, i) {
  const n = s(e, t)?.closest(".garage-part-preview");
  return n && a.contains(n) ? i.get(n) : void 0;
}
class As {
  constructor(e, t, s, i) {
    ((this.options = e),
      (this.assets = t),
      (this.tuning = s),
      (this.previews = i),
      Ft(e.selectedKartItemId));
    const n = e.catalog.karts.find(
      (o) =>
        o.itemId === e.selectedKartItemId &&
        (o.itemId !== 0 || o.systemKey === e.profile.equipment.systemKart),
    );
    if (!n) throw new Error("车库当前车辆不在资源目录内。");
    if (
      ((this.selected = n),
      (this.configuration = e.profile.garage),
      (this.previewRect = t.rects.get("kartPreview")),
      !this.previewRect)
    )
      throw new Error("P3543 车库缺少 kartPreview 布局。");
    ((this.canvas.width = t.stage.width),
      (this.canvas.height = t.stage.height),
      (this.drawing = new Js(this.canvas)),
      (this.context = this.drawing.context),
      (this.modelCache = new Qi(
        (o) => Je(e.library, o, e.environment, e.stageBinding),
        (o, c) => {
          this.status.textContent = `部件模型加载失败：${o}（${c instanceof Error ? c.message : String(c)}）`;
        },
      )),
      (this.element.className = "garage-x"),
      (this.element.dataset.uiLayer = "stage"),
      this.element.setAttribute("role", "dialog"),
      this.element.setAttribute("aria-label", "车库"),
      (this.element.hidden = !0),
      (this.surface.className = "garage-x-surface"),
      t.fontFamily &&
        (this.surface.style.fontFamily = `"${t.fontFamily}", sans-serif`),
      (this.surface.style.width = `${t.stage.width}px`),
      (this.surface.style.height = `${t.stage.height}px`),
      (this.canvas.style.width = `${t.stage.width}px`),
      (this.canvas.style.height = `${t.stage.height}px`),
      (this.controls.className = "garage-x-controls"),
      (this.transformPreviewPartsRoot.className =
        "garage-x-transform-parts-root"),
      (this.transformPreviewPartsRoot.dataset.transformCustomParts = "true"),
      this.controls.append(this.transformPreviewPartsRoot),
      this.surface.append(this.controls),
      Object.assign(this.canvas.style, {
        position: "absolute",
        inset: "0",
        width: "100%",
        height: "100%",
      }),
      (this.canvas.dataset.garageFinalCanvas = "true"),
      this.canvas.setAttribute("aria-hidden", "true"),
      (this.surface.style.filter = "opacity(0)"),
      (this.surface.style.pointerEvents = "none"),
      (this.canvas.style.touchAction = "none"),
      this.element.append(this.canvas, this.surface, this.inputSurface));
    const r =
      e.onHover || e.onActivate
        ? {
            playHover: e.onHover ?? (() => {}),
            playClick: e.onActivate ?? (() => {}),
          }
        : void 0;
    ((this.interactionAudioCleanup = ei(this.element, r, {
      isHoverAudible: xi,
      isClickAudible: Ci,
    })),
      (this.progressionPanel = new va(
        s,
        (o) => this.requestProgression(o),
        (o) => this.requestSkillSelection(o),
        () => this.requestExceedTypeChange(),
      )),
      (this.progressionPanel.element.hidden = !0),
      this.surface.append(this.progressionPanel.element),
      (this.pointEffects = new Ka(
        this.surface,
        s,
        (o) => Je(e.library, o, e.environment, e.stageBinding),
        (o) => {
          this.status.textContent = o;
        },
      )),
      this.buildControls(),
      (this.inputSurface.className = "garage-x-surface garage-x-input-surface"),
      Object.assign(this.inputSurface.style, {
        position: "absolute",
        width: `${t.stage.width}px`,
        height: `${t.stage.height}px`,
        transformOrigin: "0 0",
        pointerEvents: "none",
      }),
      (this.inputSurface.style.fontFamily = this.surface.style.fontFamily),
      (this.search.style.pointerEvents = "auto"),
      this.inputSurface.append(this.search),
      (this.controlCanvas = new Pi(
        this.surface,
        t.stage.width,
        t.stage.height,
      )),
      (this.resize = new ResizeObserver(() => this.resizeSurface())),
      this.resize.observe(e.root),
      window.addEventListener("resize", this.onWindowResize),
      this.canvas.addEventListener("pointerdown", this.onDragStart),
      this.canvas.addEventListener("pointermove", this.onDragMove),
      this.canvas.addEventListener("pointerup", this.onDragEnd),
      this.canvas.addEventListener("pointercancel", this.onDragEnd),
      this.updateControls(),
      e.root.append(this.element));
  }
  options;
  assets;
  tuning;
  tutorialClose;
  tutorialLoading = !1;
  element = document.createElement("div");
  surface = document.createElement("div");
  canvas = document.createElement("canvas");
  context;
  drawing;
  renderPixelRatio = 1;
  controls = document.createElement("div");
  transformPreviewPartsRoot = document.createElement("div");
  cards = document.createElement("div");
  inventory = document.createElement("div");
  inventoryScrollHit = document.createElement("div");
  inventoryScroll = new vn(this.inventory, this.inventoryScrollHit, () => {
    const e = Number.parseFloat(
      this.inventory.style.getPropertyValue("--garage-part-row-step"),
    );
    return Number.isFinite(e) && e > 0 ? e : void 0;
  });
  info = document.createElement("div");
  scoreRevision = 0;
  factoryScoreRevision = 0;
  scoreSources = new Map();
  defaultPartGrades;
  status = document.createElement("div");
  pageLabel = document.createElement("span");
  kartName = document.createElement("h2");
  partTitle = document.createElement("div");
  slotControls = new Map();
  vehicleFunctions = document.createElement("div");
  vehicleInfoNodes = [];
  partsOnlyNodes = [];
  transformPreviewUiRestore = new Map();
  transformPreviewUiHidden = !1;
  interactionAudioCleanup;
  previewPart;
  previewParts = new WeakMap();
  inventoryPointer;
  inventoryHitTestFrame = 0;
  cancelPreview = this.button("取消预览", () => {
    const e = this.cosmeticPreview !== void 0;
    ((this.transformPreviewStartPending = !1),
      (this.coatingPreview = void 0),
      (this.cosmeticPreview = void 0),
      this.transformPreviewUiHidden || this.setPartPreview(void 0),
      e && this.panels?.setTransformPreview?.(!1),
      this.syncTransformPreviewUi(),
      this.syncCosmeticPreviewActions(),
      this.updatePerformance());
  });
  removePart = this.button("拆除部件", () => {
    this.coatingMode
      ? this.requestCoating(void 0)
      : this.cosmeticSlot
        ? this.requestCosmetic(void 0)
        : this.requestEquip(void 0);
  });
  confirmation;
  upgrade;
  preparation;
  skillSelection;
  exceedTypeChange;
  pointEffects;
  cosmeticSlot;
  cosmeticPreview;
  cosmeticBusy = !1;
  cosmeticResetToken;
  coatingMode = !1;
  coatingPreview;
  comparisons = [];
  modelCache;
  modelTargets = [];
  search = document.createElement("input");
  inputSurface = document.createElement("div");
  controlCanvas;
  releaseTaskbar;
  strengtheningSnapshot;
  frozenSnapshot;
  resize;
  onWindowResize = () => this.resizeSurface();
  panels;
  transformPreviewStartPending = !1;
  selected;
  configuration;
  slot = "engine";
  filter = 0;
  page = 0;
  shown = !1;
  disposed = !1;
  frozen = !1;
  raf = 0;
  drag;
  previews;
  visibleCards = [];
  previewRect;
  pageMode = "parts";
  upgradeCatalogEmpty = !1;
  progressionPanel;
  factoryPanel;
  factorySession;
  factorySessionVehicleKey;
  static async load(e) {
    const t = _t(e.stageWidth ?? Ai),
      [s, i] = await Promise.all([zi(e.library, t.width), Fn(e)]);
    try {
      const n = await Wt(e.library, "kartune", t.width);
      let r;
      r = new As(e, s, n, i);
      try {
        const o = await Wt(e.library, "tuning", t.width);
        try {
          ((r.factoryPanel = new Pa(
            o,
            (c) => r.setFactory(c),
            (c, l, h) => r.confirmation?.open(c, l, h),
            () => r.updateControls(),
            () => {
              r.showFactoryTutorial();
            },
          )),
            (r.factoryPanel.element.hidden = !0),
            r.surface.append(r.factoryPanel.element));
        } catch (c) {
          throw c;
        }
        return (
          (r.confirmation = await ti.load(e.library, r.surface, (c) => {
            ((r.controls.inert = c),
              (r.progressionPanel.element.inert = c),
              r.factoryPanel && (r.factoryPanel.element.inert = c));
          })),
          (r.panels = await si.load(
            e.library,
            e.environment,
            e.stageBinding,
            () => {},
            { x: 0, y: 0, width: 137, height: 94 },
            r.previewRect,
            ii(r.previewRect.width, r.previewRect.height),
            "kart-only",
          )),
          r.panels.setParticleModificationPageVisible(r.pageMode === "factory"),
          r
        );
      } catch (o) {
        throw (r.dispose(), o);
      }
    } catch (n) {
      throw n;
    }
  }
  show() {
    this.disposed ||
      ((this.frozen = !1),
      (this.frozenSnapshot = void 0),
      (this.shown = !0),
      (this.element.hidden = !1),
      this.resizeSurface(),
      (this.releaseTaskbar ??= this.options.taskbar?.composite(this, () => {
        this.shown && !this.disposed && this.paintTaskbar();
      })),
      window.addEventListener("keydown", this.onKey),
      this.search.focus(),
      this.frame());
  }
  freeze() {
    this.disposed ||
      ((this.frozen = !0),
      cancelAnimationFrame(this.raf),
      (this.element.inert = !0),
      (this.element.style.pointerEvents = "none"));
  }
  unfreeze() {
    this.disposed ||
      ((this.frozen = !1),
      (this.frozenSnapshot = void 0),
      (this.element.inert = !1),
      (this.element.style.pointerEvents = "auto"),
      this.frame());
  }
  dispose() {
    this.disposed ||
      (this.interactionAudioCleanup?.(),
      this.tutorialClose?.(),
      this.preparation?.dispose(),
      (this.preparation = void 0),
      (this.disposed = !0),
      this.exceedTypeChange?.dispose(),
      (this.exceedTypeChange = void 0),
      cancelAnimationFrame(this.raf),
      cancelAnimationFrame(this.inventoryHitTestFrame),
      this.resize?.disconnect(),
      window.removeEventListener("resize", this.onWindowResize),
      window.removeEventListener("keydown", this.onKey),
      this.panels?.dispose(),
      this.confirmation?.dispose(),
      this.upgrade?.dispose(),
      this.skillSelection?.dispose(),
      this.pointEffects?.dispose(),
      this.progressionPanel.dispose(),
      this.modelCache.dispose(),
      this.controlCanvas?.dispose(),
      this.releaseTaskbar?.(),
      (this.releaseTaskbar = void 0),
      (this.strengtheningSnapshot = void 0),
      (this.frozenSnapshot = void 0),
      this.drawing.dispose(),
      this.element.remove());
  }
  resizeSurface() {
    (this.shown &&
      (this.upgrade || this.preparation) &&
      this.captureStrengtheningStage(),
      this.frozen &&
        !this.frozenSnapshot &&
        (this.frozenSnapshot = this.captureStage()));
    const e = this.options.root.getBoundingClientRect(),
      { width: t, height: s } = this.assets.stage,
      i = Math.min(e.width / t, e.height / s);
    ((this.surface.style.transform = `scale(${i})`),
      (this.surface.style.left = `${(e.width - t * i) / 2}px`),
      (this.surface.style.top = `${(e.height - s * i) / 2}px`));
    const n = Pe(
        this.canvas,
        this.context,
        e.width,
        e.height,
        Ee(),
        e.width,
        e.height,
      ),
      r = (e.width - t * i) / 2,
      o = (e.height - s * i) / 2;
    (this.context.setTransform(
      n.scaleX * i,
      0,
      0,
      n.scaleY * i,
      n.scaleX * r,
      n.scaleY * o,
    ),
      (this.renderPixelRatio = n.scaleX * i),
      this.inputSurface &&
        Object.assign(this.inputSurface.style, {
          transform: this.surface.style.transform,
          left: this.surface.style.left,
          top: this.surface.style.top,
        }),
      this.factoryPanel?.resizeCanvases(),
      this.preparation?.resizeCanvases(),
      this.confirmation?.resizeCanvases(),
      this.frozen &&
        this.frozenSnapshot &&
        (this.drawing.beginFrame(),
        this.drawing.drawCanvasLayer(
          this.frozenSnapshot,
          { x: 0, y: 0, width: t, height: s },
          0,
        ),
        this.paintTaskbar(),
        this.drawing.endFrame()));
  }
  place(e, t) {
    (Object.assign(e.style, {
      position: "absolute",
      left: `${t.x}px`,
      top: `${t.y}px`,
      width: `${t.width}px`,
      height: `${t.height}px`,
    }),
      this.controls.append(e));
  }
  setPartsOnlyNodesMounted(e) {
    const t = this.transformPreviewPartsRoot ?? this.controls;
    for (const s of this.partsOnlyNodes)
      e
        ? s.parentElement !== t && t.append(s)
        : s.parentElement === t && s.remove();
  }
  setVehicleInfoNodesMounted(e) {
    for (const t of this.vehicleInfoNodes)
      e
        ? t.parentElement !== this.controls && this.controls.append(t)
        : t.parentElement === this.controls && t.remove();
  }
  setUpgradeStatusMounted(e) {
    e
      ? this.status.parentElement !== this.controls &&
        this.controls.append(this.status)
      : this.status.parentElement === this.controls && this.status.remove();
  }
  startTransformPreview(e = !1) {
    ((this.transformPreviewStartPending = !0),
      e &&
        (this.panels?.beginTransformPreviewSession?.(),
        this.flushTransformPreviewStart()),
      this.syncTransformPreviewUi());
  }
  transformPreviewSessionActive() {
    return (
      this.panels?.isTransformPreviewSessionActive ??
      this.panels?.isTransformPreviewEnabled ??
      !1
    );
  }
  flushTransformPreviewStart() {
    !this.transformPreviewStartPending ||
      !this.panels?.isPreviewReady ||
      ((this.transformPreviewStartPending = !1),
      this.panels.restartTransformPreview(),
      this.syncTransformPreviewUi());
  }
  syncTransformPreviewUi() {
    if (
      this.transformPreviewStartPending ||
      this.transformPreviewSessionActive()
    ) {
      if (((this.transformPreviewUiHidden = !0), !this.controls)) return;
      this.transformPreviewUiRestore ??= new Map();
      const s = [
          ...this.controls.querySelectorAll(
            ".garage-x-parts-title, .garage-x-inventory, .garage-x-scrollbar-slot, [data-part-tab]",
          ),
        ],
        i = this.transformPreviewPartsRoot;
      i && !s.includes(i) && s.push(i);
      for (const n of s)
        (this.transformPreviewUiRestore.has(n) ||
          this.transformPreviewUiRestore.set(n, {
            hidden: n.hidden,
            inert: n.inert,
            pointerEvents: n.style.pointerEvents,
          }),
          typeof HTMLElement < "u" &&
            n instanceof HTMLElement &&
            typeof document < "u" &&
            document.activeElement instanceof HTMLElement &&
            n.contains(document.activeElement) &&
            document.activeElement.blur(),
          (n.hidden = !0),
          (n.inert = !0),
          (n.style.pointerEvents = "none"));
      return;
    }
    ((this.transformPreviewUiHidden = !1),
      (this.transformPreviewUiRestore ??= new Map()));
    for (const [t, s] of this.transformPreviewUiRestore)
      ((t.hidden = s.hidden),
        (t.inert = s.inert),
        (t.style.pointerEvents = s.pointerEvents));
    this.transformPreviewUiRestore.clear();
  }
  moveToTransformPreviewRoot(e) {
    e.parentElement !== this.transformPreviewPartsRoot &&
      this.transformPreviewPartsRoot.append(e);
  }
  placeInTransformPreviewRoot(e, t) {
    (Object.assign(e.style, {
      position: "absolute",
      left: `${t.x}px`,
      top: `${t.y}px`,
      width: `${t.width}px`,
      height: `${t.height}px`,
    }),
      this.transformPreviewPartsRoot.append(e));
  }
  button(e, t) {
    const s = document.createElement("button");
    return (
      (s.type = "button"),
      (s.textContent = e),
      (s.onclick = () => {
        this.options.onInteraction?.();
        try {
          t();
        } catch (i) {
          this.status.textContent = String(i instanceof Error ? i.message : i);
        }
      }),
      s
    );
  }
  skin(e, t, s = 4) {
    e.classList.add("garage-native-button");
    for (let i = 1; i <= s; i++) {
      const n = this.assets.imageUrls.get(se(t, i));
      n && e.style.setProperty(`--button-${i}`, `url("${n}")`);
    }
  }
  nativeButton(e, t, s, i) {
    const n = this.assets.nodes.get(e),
      r = n && y(n, "text"),
      o = r && /^#sb\((.+)\)$/.exec(r)?.[1],
      c = this.button(i ?? (o ? (this.assets.strings.get(o) ?? t) : t), s);
    c.setAttribute("aria-label", c.textContent ?? t);
    for (const [h, d] of ["t", "overT", "clickedT", "disabledT"].entries()) {
      const f = n && y(n, `${d}extColor`);
      if (f) {
        const p = f.trim().split(/\s+/).map(Number),
          u =
            p.length === 4 && p.every(Number.isFinite)
              ? `rgba(${p[1]}, ${p[2]}, ${p[3]}, ${p[0] / 255})`
              : f;
        c.style.setProperty(`--text-${h + 1}`, u);
      }
    }
    const l = n && y(n, "autoLoadImage");
    return (l && this.skin(c, l), this.place(c, this.rect(e)), c);
  }
  rect(e) {
    const t = this.assets.rects.get(e);
    if (!t) throw new Error(`P3543 车库布局缺少 ${e}`);
    return t;
  }
  icon(e, t) {
    const s = this.assets.imageUrls.get(e);
    if (!s) return;
    const i = document.createElement("img");
    return (
      (i.src = s),
      (i.alt = ""),
      (i.className = t),
      (i.draggable = !1),
      i
    );
  }
  partVisual(e, t, s, i) {
    const n =
        t.family === "legacy"
          ? (this.assets.parts?.find(
              (l) =>
                l.family === "legacy" &&
                l.slot === t.slot &&
                l.itemId === t.itemId &&
                l.legacyImagePath,
            ) ?? t)
          : t,
      r = this.icon(Ss(n), s);
    r && e.append(r);
    const o =
      t.family === "xun"
        ? this.assets.partModels.get(`${t.slot}:${t.itemId}`)
        : void 0;
    if (!o) return;
    const c = xt(this.assets, t.family);
    this.addModelTarget(
      e,
      { path: o },
      s,
      i,
      r,
      s === "garage-inventory-icon" ? [c.iconWidth, c.iconHeight] : void 0,
    );
  }
  addModelTarget(e, t, s, i, n, r) {
    const o = document.createElement("canvas"),
      c =
        r ??
        (s === "garage-inventory-icon"
          ? [136, 100]
          : s === "garage-part-max-effect"
            ? [78, 76]
            : [50, 50]);
    ((o.width = c[0]),
      (o.height = c[1]),
      (o.className = `garage-part-model ${s}`),
      o.setAttribute("aria-hidden", "true"));
    const l = o.getContext("2d");
    l &&
      (e.append(o),
      this.modelTargets.push({ source: t, context: l, row: i, fallback: n }));
  }
  renderPartModels() {
    if (!this.panels || this.transformPreviewUiHidden) return;
    let e = 0;
    for (const o of this.modelTargets)
      o.context.canvas.isConnected !== !1 && (this.modelTargets[e++] = o);
    this.modelTargets.length = e;
    const t = this.inventory.style,
      s =
        Number.parseFloat(t.getPropertyValue("--garage-part-row-step")) || 149,
      i =
        Number.parseFloat(t.getPropertyValue("--garage-part-card-height")) ||
        152,
      n = this.inventory.clientHeight || s * 3,
      r = new Map();
    for (const o of this.modelTargets) {
      if (
        o.row !== void 0 &&
        (o.row * s + i <= this.inventory.scrollTop ||
          o.row * s >= this.inventory.scrollTop + n)
      )
        continue;
      let c = r.get(o.source.path);
      (c || r.set(o.source.path, (c = { source: o.source, targets: [] })),
        c.targets.push(o));
    }
    for (const { source: o, targets: c } of r.values()) {
      const l = this.modelCache.get(o);
      if (l) {
        this.panels.drawAuxiliaryPanel(
          l,
          c.map((h) => h.context),
        );
        for (const h of c) h.fallback && (h.fallback.hidden = !0);
      }
    }
  }
  buildControls() {
    const e = this.nativeButton("partsInstall", "部件", () =>
      this.selectPage("parts"),
    );
    ((e.dataset.garageCommon = "parts"),
      e.classList.add("selected", "garage-menu-button"));
    for (const [r, o] of [
      ["kartLevelUp", "升级"],
      ["partsFactory", "改装"],
    ]) {
      const c = this.nativeButton(r, o, () =>
        this.selectPage(r === "partsFactory" ? "factory" : "level"),
      );
      ((c.dataset.garageCommon = r === "kartLevelUp" ? "level" : "factory"),
        (c.title = r === "partsFactory" ? "车辆改装（本地测试）" : "车辆升级"),
        c.classList.add("garage-menu-button"));
    }
    ((this.kartName.className = "garage-x-kart-name"),
      (this.kartName.dataset.garageCommon = "true"),
      this.place(this.kartName, {
        ...this.rect("selectedKartName"),
        width: 700,
      }),
      this.place(this.info, { x: 20, y: 218, width: 386, height: 175 }),
      (this.info.className = "garage-x-info"),
      (this.info.dataset.vehicleInfo = "true"),
      this.vehicleInfoNodes.push(this.info));
    for (const r of de) {
      const o = this.button(ai[r], () => this.selectSlot(r));
      ((o.className = "garage-equipped-slot"),
        (o.dataset.slot = r),
        (o.dataset.vehicleInfo = "true"),
        this.slotControls.set(r, o),
        this.vehicleInfoNodes.push(o));
    }
    ((this.vehicleFunctions.className = "garage-vehicle-functions"),
      (this.vehicleFunctions.dataset.vehicleInfo = "true"),
      this.place(
        this.vehicleFunctions,
        this.tuning.rects.get("kartBodyEffect12") ?? {
          x: 20,
          y: 478,
          width: 386,
          height: 92,
        },
      ),
      this.vehicleInfoNodes.push(this.vehicleFunctions),
      this.createTransformPreviewButton(),
      (this.partTitle.className = "garage-x-parts-title"),
      this.placeInTransformPreviewRoot(
        this.partTitle,
        this.rect("engineGrade"),
      ),
      this.partsOnlyNodes.push(this.partTitle),
      (this.inventory.className = "garage-x-inventory"),
      this.placeInTransformPreviewRoot(this.inventory, Dt(this.assets, "v1")),
      (this.inventoryScrollHit.className = "garage-x-scrollbar-slot"),
      this.placeInTransformPreviewRoot(
        this.inventoryScrollHit,
        this.rect("partListBar"),
      ),
      this.inventoryScrollHit.addEventListener("pointerdown", (r) =>
        this.inventoryScroll.down(
          r,
          this.assets.partScrollbar,
          this.rect("partListBar"),
          this.authoredPointerY(r),
        ),
      ),
      this.inventoryScrollHit.addEventListener("pointermove", (r) =>
        this.inventoryScroll.move(
          this.assets.partScrollbar,
          this.rect("partListBar"),
          this.authoredPointerY(r),
        ),
      ));
    for (const r of ["pointerup", "pointercancel"])
      this.inventoryScrollHit.addEventListener(r, (o) =>
        this.inventoryScroll.up(o.pointerId),
      );
    (this.controls.append(this.inventoryScrollHit),
      this.inventory.setAttribute("role", "region"),
      this.inventory.setAttribute("aria-label", "部件列表"),
      this.inventory.addEventListener(
        "wheel",
        (r) => {
          ((this.inventoryPointer = { x: r.clientX, y: r.clientY }),
            this.inventoryScroll.page(r.deltaY < 0 ? -1 : 1) &&
              r.preventDefault());
        },
        { passive: !1 },
      ),
      this.inventory.addEventListener("pointermove", (r) => {
        this.inventoryPointer = { x: r.clientX, y: r.clientY };
      }),
      this.inventory.addEventListener("pointerleave", () => {
        this.inventoryPointer = void 0;
      }),
      this.inventory.addEventListener("scroll", () =>
        this.rehitTestInventoryPreview(),
      ),
      this.skin(this.removePart, "buttonRed_"),
      this.removePart.classList.add("garage-danger-button"),
      (this.removePart.textContent = "拆除"),
      this.removePart.setAttribute("aria-label", "拆除部件"),
      this.place(this.removePart, _n),
      this.skin(this.cancelPreview, "garage_btn_equip_"),
      this.place(this.cancelPreview, {
        x: 300,
        y: 590,
        width: 110,
        height: 32,
      }),
      (this.cancelPreview.hidden = !0));
    const t = this.button("恢复原装", () => this.requestRestoreDefaults());
    (this.skin(t, "garage_btn_equip_"),
      (t.dataset.garageRestore = "true"),
      this.place(t, { x: 185, y: 590, width: 100, height: 32 }));
    for (const [r, o, c] of [
      ["allKart", "全部", 0],
      ["speedKart", "竞速车", 2],
      ["itemKart", "道具车", 1],
    ]) {
      const l = this.nativeButton(r, o, () => {
        ((this.filter = c), (this.page = 0), this.updateCards());
      });
      ((l.dataset.filter = String(c)),
        (l.dataset.garageCommon = "true"),
        (l.dataset.garageSelector = "true"));
    }
    ((this.search.placeholder = "搜索车辆"),
      (this.search.maxLength = 14),
      this.search.setAttribute("aria-label", "搜索车辆"),
      (this.search.dataset.garageCommon = "true"),
      (this.search.dataset.garageSelector = "true"),
      (this.search.oninput = () => {
        ((this.page = 0), this.updateCards());
      }),
      this.place(this.search, this.rect("kartKeyword")));
    const s = this.nativeButton("resetKeyword", "清除搜索", () => {
      ((this.search.value = ""), (this.page = 0), this.updateCards());
    });
    ((s.textContent = ""),
      (s.dataset.garageCommon = "true"),
      (s.dataset.garageCatalog = "search"),
      (s.dataset.garageSelector = "true"),
      (this.cards.className = "garage-x-cards"),
      (this.cards.dataset.garageCommon = "true"),
      (this.cards.dataset.garageSelector = "true"),
      this.cards.style.setProperty(
        "--garage-kart-card-width",
        `${this.assets.kartCardLayout.width}px`,
      ),
      this.cards.style.setProperty(
        "--garage-kart-card-height",
        `${this.assets.kartCardLayout.height}px`,
      ),
      this.cards.style.setProperty(
        "--garage-kart-card-gap",
        `${this.assets.kartCardLayout.gapX}px`,
      ),
      this.place(this.cards, bt(this.assets)));
    const i = this.nativeButton("leftKartPage", "上一页", () => {
      ((this.page = Math.max(0, this.page - 1)), this.updateCards());
    });
    ((i.textContent = ""),
      (i.dataset.garageCommon = "true"),
      (i.dataset.garageCatalog = "leftKartPage"),
      (i.dataset.garageSelector = "true"));
    const n = this.nativeButton("rightKartPage", "下一页", () => {
      (this.page++, this.updateCards());
    });
    ((n.textContent = ""),
      (n.dataset.garageCommon = "true"),
      (n.dataset.garageCatalog = "rightKartPage"),
      (n.dataset.garageSelector = "true"),
      (this.pageLabel.className = "garage-page-label"),
      (this.pageLabel.dataset.garageCommon = "true"),
      (this.pageLabel.dataset.garageSelector = "true"),
      this.place(this.pageLabel, this.rect("pageInfo")),
      (this.status.className = "garage-x-status"),
      this.status.setAttribute("role", "status"),
      (this.status.dataset.garageCommon = "true"),
      (this.status.textContent = ""),
      this.place(this.status, { x: 20, y: 630, width: 980, height: 24 }));
  }
  requestRestoreDefaults() {
    if (!this.requireCustomization()) return;
    const e = this.selected,
      t = this.serial();
    this.confirmation?.open(
      `部件、强化、改装和外观记录将清除并立即生效。
是否确认恢复原装？`,
      () => {
        this.disposed ||
          this.selected !== e ||
          this.serial() !== t ||
          ((this.cosmeticResetToken = {}),
          (this.previewPart = void 0),
          (this.cosmeticPreview = void 0),
          (this.coatingPreview = void 0),
          (this.configuration = ie(this.configuration, e.itemId, t, {})),
          this.publishCurrentState(),
          this.updateControls(),
          (this.status.textContent = "已恢复原装并立即生效。"));
      },
    );
  }
  updateVehicleInformation(e, t, s, i = !0) {
    (i && this.updatePerformance(), this.updateVehicleFunctions(e, s));
    const n = me(e, this.selected.engineGrade);
    for (const [r, o] of this.slotControls) {
      const c = Xe(
          e,
          t,
          r,
          this.assets.parts,
          this.selected.engineGrade,
          this.selected.uniqueLevel,
          this.defaultPartGrades,
        ),
        l = fe(e, r),
        h =
          c?.family === "xun"
            ? (() => {
                const w = Ns(c, this.assets.parts);
                return w === void 0 ? this.partLabel(c) : `Lv.${w}`;
              })()
            : c
              ? this.partLabel(c)
              : void 0,
        d =
          this.selected.engineGrade !== void 0 &&
          this.selected.engineGrade >= 0 &&
          this.selected.engineGrade <= 6,
        f = Wi(h, l, d ? "未装备" : void 0),
        p = le(r, n),
        u = `${p} · ${f.value}${f.state ? ` · ${f.state}` : ""}`;
      (o.replaceChildren(), (o.title = u), o.setAttribute("aria-label", u));
      const g = c ? Et(c) : 0,
        m =
          g === void 0
            ? void 0
            : this.icon(
                `uniqueLevel_${g}${s.slotSize === 50 ? "_50x50" : ""}`,
                "garage-part-frame",
              );
      if (
        (m && o.append(m),
        c && this.partVisual(o, c, "garage-equipped-icon"),
        c?.family === "xun" && En(c, this.assets.parts, !0))
      ) {
        const w = this.assets.nodes.get(
          `/${s.equippedRoot}/${wt[r]}/item/partsLvMaxEffect1s`,
        );
        w &&
          this.addModelTarget(
            o,
            { path: `stage_/common/${y(w, "scene")}.1s`, panel: w },
            "garage-part-max-effect",
          );
      }
      if (l) {
        const w = this.icon(
          s.kind === "xun"
            ? "garage_img_partsBG1_lock2"
            : "garage_img_partsBG1_lock",
          "garage-part-frame garage-part-lock",
        );
        w && o.append(w);
      }
      const b = document.createElement("span");
      b.textContent = p;
      const P = document.createElement("strong");
      ((P.textContent = f.value),
        o.append(b, P),
        o.classList.toggle("compact", s.slotSize === 50),
        this.place(o, this.rect(`/${s.equippedRoot}/${wt[r]}`)));
      const C = this.pageMode === "parts",
        S = C && !this.coatingMode && !this.cosmeticSlot && r === this.slot;
      ((o.disabled = !C),
        o.classList.toggle("selected", S),
        o.setAttribute("aria-pressed", String(S)));
    }
  }
  updateVehicleHeading(e) {
    this.kartName.replaceChildren();
    const t = document.createElement("span");
    t.textContent = this.selected.title;
    const s = this.selected.vehicleRarityLevel;
    if (
      ((t.style.color =
        s === void 0
          ? "white"
          : (this.tuning.qualityColors?.get(s) ?? "white")),
      this.kartName.append(t),
      e !== void 0 && e > 0)
    ) {
      const i = this.tuning.urls.get(`tuning_mark_${e}`);
      if (i) {
        const n = document.createElement("img");
        ((n.src = i),
          (n.alt = `+${e}`),
          (n.className = "garage-x-kart-level-badge"),
          this.kartName.append(n));
      }
    }
  }
  updateVehicleFunctions(e, t) {
    if ((this.vehicleFunctions.replaceChildren(), t.kind !== "xun")) return;
    const s = document.createElement("div");
    s.className = "garage-vehicle-function-row";
    for (const i of Fi(e)) {
      const n = document.createElement("div");
      ((n.className = "garage-vehicle-function"), (n.tabIndex = 0));
      const r = this.icon(
          "garage_kartFuncSlotBg",
          "garage-vehicle-function-background",
        ),
        o = this.icon(i.icon, "garage-vehicle-function-icon normal"),
        c = this.icon(i.focusedIcon, "garage-vehicle-function-icon focused"),
        l = this.assets.strings.get(i.nameKey) ?? i.nameKey,
        h = this.assets.strings.get(i.descriptionKey) ?? i.descriptionKey;
      ((n.title = `${l}
${h}`),
        n.setAttribute("aria-label", `${l}：${h}`),
        r && n.append(r),
        o && n.append(o),
        c && n.append(c),
        s.append(n));
    }
    this.vehicleFunctions.append(s);
  }
  updateCosmeticEquippedSlots(e, t, s) {
    const i =
      t.kind === "xun"
        ? `${t.equippedRoot}/selectedKartEquipped12`
        : `${t.equippedRoot}/selectedKartEquippedV1`;
    for (const { node: n, label: r } of t.cosmeticTabs) {
      const o = n.includes("Lamp")
          ? "tailLamp"
          : n.includes("Booster")
            ? "boosterEffect"
            : void 0,
        c = s
          ? () => {
              ((this.coatingMode = !o),
                (this.cosmeticSlot = o),
                (this.cosmeticPreview = void 0),
                (this.previewPart = void 0),
                (this.transformPreviewStartPending = !1),
                this.panels?.setTransformPreview?.(!1),
                (this.inventory.scrollTop = 0),
                this.updateControls());
            }
          : () => {},
        l = this.button("", c);
      ((l.className = `garage-equipped-slot${t.slotSize === 50 ? " compact" : ""}`),
        (l.dataset.cosmeticSlot = n),
        s || (l.dataset.vehicleInfo = "true"),
        (l.title = r),
        (l.disabled = !s),
        l.setAttribute("aria-disabled", String(!s)));
      const h = document.createElement("span");
      h.textContent = r;
      const d = o ? e.cosmetics?.[o] : e.cosmetics?.coating,
        f = t.kind === "xun" ? "xun" : "classic",
        p = o
          ? this.assets.cosmetics.find(
              (w) => w.slot === o && w.family === f && w.id === d,
            )
          : this.assets.coatings.find((w) => w.family === f && w.id === d),
        u = o === "tailLamp" && d === void 0,
        g = p,
        b =
          t.kind === "v1" && u
            ? "uniqueLevel_4"
            : `uniqueLevel_0${t.slotSize === 50 ? "_50x50" : ""}`,
        P = this.icon(b, "garage-part-frame");
      if (
        (P && l.append(P),
        (l.title = g ? `${r} · ${g.title}` : r),
        l.setAttribute("aria-label", l.title),
        g)
      ) {
        const w = this.icon(
          `uniqueLevel_5${t.slotSize === 50 ? "_50x50" : ""}`,
          "garage-equipped-state-frame",
        );
        w && (w.setAttribute("aria-hidden", "true"), l.append(w));
      }
      if (g?.icon) {
        const w = this.cosmeticIcon(g, "garage-equipped-icon");
        w && l.append(w);
      } else if (u) {
        const w = this.icon(ni(f), "garage-equipped-icon");
        w && l.append(w);
      }
      const C = document.createElement("strong"),
        S = n.includes("Lamp")
          ? (this.assets.strings.get("emptyLamp") ?? "基础车灯")
          : (this.assets.strings.get("emptyParts") ?? "未装备");
      if (
        ((C.textContent = g?.title ?? S),
        l.append(h, C),
        this.place(l, this.rect(`/${i}/${n}`)),
        t.kind === "v1" && n === "partsTailLamp" && (g || u))
      ) {
        const w = `/${i}/${n}/previewEquippedTailLamp`;
        if (this.assets.nodes.has(w)) {
          const k = o === "tailLamp" ? p : void 0,
            x = this.nativeButton(
              w,
              this.transformPreviewSessionActive() ? "取消" : "预览",
              () => {
                const v = this.transformPreviewSessionActive();
                ((this.cosmeticPreview = v ? void 0 : k),
                  v
                    ? ((this.transformPreviewStartPending = !1),
                      this.panels?.toggleTransformPreview())
                    : this.startTransformPreview(!0),
                  this.syncTransformPreviewUi());
                const _ = this.transformPreviewSessionActive();
                ((x.textContent = _ ? "取消" : "预览"),
                  x.setAttribute("aria-pressed", String(_)),
                  x.setAttribute("aria-label", _ ? "取消预览" : `预览 ${r}`),
                  (this.cancelPreview.hidden =
                    !this.previewPart &&
                    !this.cosmeticPreview &&
                    !this.coatingPreview));
                const $ =
                  k?.title ??
                  this.assets.strings.get("emptyLamp") ??
                  "基础车灯";
                ((this.status.textContent = _
                  ? `预览：${$}，尚未装备。`
                  : "已取消车灯预览。"),
                  this.updatePerformance());
              },
            );
          (x.classList.add("garage-equipped-preview-action"),
            (x.dataset.cosmeticPreview = "true"),
            (x.dataset.vehicleInfo = "true"));
          const T = this.transformPreviewSessionActive();
          ((x.textContent = T ? "取消" : "预览"),
            x.setAttribute("aria-pressed", String(T)),
            x.setAttribute("aria-label", T ? "取消预览" : `预览 ${r}`));
        }
      }
    }
  }
  syncCosmeticPreviewActions() {
    const e = this.transformPreviewSessionActive();
    this.controls
      ?.querySelectorAll("[data-cosmetic-preview='true']")
      .forEach((t) => {
        const s = e ? "取消" : "预览";
        (t.textContent !== s && (t.textContent = s),
          t.setAttribute("aria-pressed", String(e)),
          t.setAttribute("aria-label", e ? "取消预览" : "预览车灯"));
      });
  }
  serial() {
    return this.selected.itemId === this.options.profile.equipment.itemIds[3]
      ? this.options.profile.equipment.kartSerial
      : 0;
  }
  get speedVersion() {
    return this.options.version ?? vs;
  }
  base() {
    return this.baseFor(this.selected);
  }
  baseFor(e) {
    const t = { itemId: e.itemId, systemKey: e.systemKey },
      s = bs(t);
    let i = this.previews.get(s);
    return (
      i ||
        ((i = xs(t, this.options.speed, void 0, this.speedVersion)),
        this.previews.set(s, i)),
      i.spec
    );
  }
  equip(e) {
    if (!this.requireCustomization()) return;
    const t = this.base();
    if (e && fe(t, this.slot)) throw new Error("该部件槽已锁定。");
    const s = { ...K(this.configuration, this.selected.itemId, this.serial()) };
    (e ? (s[this.slot] = e) : delete s[this.slot],
      te(t, this.selected.engineGrade ?? 0, s, this.options.speed),
      (this.configuration = ie(
        this.configuration,
        this.selected.itemId,
        this.serial(),
        s,
      )),
      this.publishCurrentState(),
      (this.previewPart = void 0),
      (this.status.textContent = ""),
      this.updateControls());
  }
  requestEquip(e) {
    if (!this.requireCustomization()) return;
    const t = this.selected,
      s = this.slot,
      i = () => {
        if (!(this.disposed || this.selected !== t || this.slot !== s))
          try {
            this.equip(e);
          } catch (n) {
            this.status.textContent =
              n instanceof Error ? n.message : String(n);
          }
      };
    if (e) this.confirmation?.openPartEquip(this.partLabel(e), i);
    else {
      const n = me(this.base(), t.engineGrade);
      this.confirmation?.open(`将${le(s, n)}恢复为原装配置并立即生效？`, i);
    }
  }
  requestCosmetic(e) {
    if (!this.requireCustomization()) return;
    const t = this.selected,
      s = this.cosmeticSlot;
    this.confirmation?.open(
      `确定${e ? `装备「${e.title}」` : "恢复此外观槽的原装效果"}并立即生效？
不消耗库存。`,
      () => {
        !this.disposed &&
          this.selected === t &&
          this.cosmeticSlot === s &&
          this.equipCosmetic(e);
      },
    );
  }
  updateControls() {
    (this.setVehicleInfoNodesMounted(
      ds(this.pageMode, this.selected.engineGrade),
    ),
      this.setPartsOnlyNodesMounted(this.pageMode === "parts"),
      this.setUpgradeStatusMounted(this.pageMode !== "level"),
      this.scoreRevision++);
    let e = pe(this.selected.engineGrade);
    if (
      this.pageMode === "level" &&
      (!e || !ae(this.selected.itemId)) &&
      !this.upgradeCatalogEmpty
    ) {
      const r = this.options.catalog.karts.find(
        (o) =>
          !Re(o.itemId) &&
          ae(o.itemId) &&
          o.identityClass !== "legacy-system-family" &&
          pe(o.engineGrade) !== void 0,
      );
      if (r && r !== this.selected) {
        this.selectKart(r);
        return;
      }
      this.upgradeCatalogEmpty = !0;
    }
    const t = Ue(this.selected.engineGrade);
    e = pe(this.selected.engineGrade);
    const s = Ut(e);
    (e && (this.progressionPanel.element.dataset.upgradePresentation = e),
      this.pointEffects?.setContext(
        this.pageMode === "level" && e === "xun"
          ? `${this.selected.itemId}:${this.serial()}`
          : void 0,
      ));
    const i = this.inventory.scrollTop;
    ((this.coatingPreview = void 0),
      this.modelCache.clear(),
      this.inventory.replaceChildren(),
      (this.modelTargets.length = 0),
      this.pageMode !== "factory" || this.nativeFactoryAllowed()
        ? this.updateVehicleHeading()
        : (this.kartName.replaceChildren(),
          this.info.replaceChildren(),
          this.vehicleFunctions.replaceChildren()),
      this.controls
        .querySelectorAll(
          "[data-part-tab], [data-upgrade], [data-cosmetic-slot], [data-cosmetic-preview]",
        )
        .forEach((r) => r.remove()));
    try {
      const r = K(this.configuration, this.selected.itemId, this.serial());
      if (this.pageMode === "factory") {
        const g = this.selected,
          m = this.nativeFactoryAllowed(g),
          b = this.factoryVehicleKey(g),
          P =
            this.factorySessionVehicleKey === b &&
            !!this.factorySession?.pending;
        (this.factoryPanel?.update(
          r.factory,
          m,
          P,
          m ? g.title : void 0,
          m ? g : void 0,
          b,
        ),
          m
            ? this.updateFactoryScores()
            : this.factoryPanel?.updateScores(
                void 0,
                "当前车辆不支持车辆改装。",
              ),
          this.updatePageVisibility(),
          this.updateCards());
        return;
      }
      if (!ae(this.selected.itemId)) {
        for (const g of this.slotControls.values()) g.replaceChildren();
        (this.info.replaceChildren(),
          this.vehicleFunctions.replaceChildren(),
          (this.removePart.disabled = !0),
          (this.inventory.textContent =
            "练习车不支持部件、强化、改装或外观修改。"),
          this.updatePageVisibility(),
          this.updateCards());
        return;
      }
      const o = this.base(),
        c = me(o, this.selected.engineGrade ?? 0),
        l = ue(this.selected.engineGrade);
      if (!l)
        throw new Error(
          `车库不支持 engineGrade=${String(this.selected.engineGrade)} 的界面预置。`,
        );
      this.element.dataset.engineLayout = l.kind;
      const h = new Set(l.cosmeticTabs.map((g) => g.node));
      if (
        (this.coatingMode &&
          ![...h].some((g) => g.includes("Coating")) &&
          (this.coatingMode = !1),
        this.cosmeticSlot === "tailLamp" &&
          ![...h].some((g) => g.includes("Lamp")) &&
          (this.cosmeticSlot = void 0),
        this.cosmeticSlot === "boosterEffect" &&
          ![...h].some((g) => g.includes("Booster")) &&
          (this.cosmeticSlot = void 0),
        this.pageMode === "level")
      )
        if (((this.comparisons.length = 0), e === "classic")) {
          (this.info.replaceChildren(),
            this.info.removeAttribute("aria-label"),
            (this.info.title = ""),
            delete this.info.dataset.performanceMode);
          for (const g of this.slotControls.values()) g.replaceChildren();
          this.vehicleFunctions.replaceChildren();
        } else
          e === "xun" &&
            (this.updateVehicleInformation(o, r, l),
            this.updateCosmeticEquippedSlots(r, l, !1));
      else this.updateVehicleInformation(o, r, l);
      if (this.pageMode === "level") {
        const g =
            r.progression && r.progression.kind === s
              ? r.progression
              : ce(s === "xun"),
          m =
            this.selected.itemId ===
              this.options.profile.equipment.itemIds[3] &&
            this.serial() === this.options.profile.equipment.kartSerial,
          b =
            r.exceedType ??
            (m && this.options.profile.equipment.exceedType > 0
              ? this.options.profile.equipment.exceedType
              : o.defaultExceedType);
        (this.updateVehicleHeading(g.kind === "xun" ? g.level : void 0),
          this.progressionPanel.update(
            g,
            !!t,
            this.selected.engineGrade,
            r.factory,
            b,
            { itemId: this.selected.itemId, kartType: this.selected.kartType },
            this.upgradeCatalogEmpty,
          ),
          s === "classic" &&
            g.kind === "classic" &&
            this.progressionPanel.updateRadar(
              this.options.library,
              this.selected.path,
              o,
              g,
              r.factory,
            ),
          this.updatePageVisibility(),
          this.updateCards());
        return;
      }
      const d = this.controls.querySelector("[data-transform-preview]");
      (d && (d.dataset.transformAvailable = String(l.kind === "xun")),
        (this.partTitle.textContent =
          this.assets.strings.get(
            `engineGrade${c === "xun" ? 13 : c === "v1" ? 12 : c === "x" ? 11 : 0}`,
          ) ?? "车辆部件"),
        (this.removePart.disabled = this.coatingMode
          ? !r.cosmetics?.coating || this.cosmeticBusy
          : this.cosmeticSlot
            ? !r.cosmetics?.[this.cosmeticSlot]
            : !r[this.slot]));
      for (const g of de) {
        const m = c === "legacy" && g === "booster" ? "部件" : void 0,
          b = this.nativeButton(
            `/partsListBoard/${l.partsTab}/${wt[g]}`,
            le(g, c),
            () => this.selectSlot(g),
            m,
          );
        (this.moveToTransformPreviewRoot(b),
          (b.dataset.partTab = g),
          b.classList.toggle(
            "selected",
            !this.coatingMode && !this.cosmeticSlot && g === this.slot,
          ));
      }
      for (const { node: g, label: m } of l.cosmeticTabs) {
        const b = g.includes("Lamp")
            ? "tailLamp"
            : g.includes("Booster")
              ? "boosterEffect"
              : void 0,
          P = () => {
            ((this.coatingMode = !b),
              (this.cosmeticSlot = b),
              (this.cosmeticPreview = void 0),
              (this.previewPart = void 0),
              (this.transformPreviewStartPending = !1),
              this.panels?.setTransformPreview?.(!1),
              (this.inventory.scrollTop = 0),
              this.updateControls());
          },
          C = this.nativeButton(`/partsListBoard/${l.partsTab}/${g}`, m, P);
        (this.moveToTransformPreviewRoot(C),
          (C.dataset.partTab = g),
          (C.title = m),
          C.classList.toggle(
            "selected",
            b ? this.cosmeticSlot === b : this.coatingMode,
          ));
      }
      this.updateCosmeticEquippedSlots(r, l, !0);
      const f =
          this.coatingMode || this.cosmeticSlot
            ? []
            : qi(this.assets, c, this.slot),
        p = l.kind === "xun" ? "xun" : "v1",
        u = xt(this.assets, p);
      if (
        (c && !this.coatingMode && !this.cosmeticSlot
          ? (this.inventory.dataset.partFamily =
              l.kind === "xun" ? "xun" : "classic")
          : delete this.inventory.dataset.partFamily,
        this.inventory.style.setProperty(
          "--garage-part-card-width",
          `${u.width}px`,
        ),
        this.inventory.style.setProperty(
          "--garage-part-card-height",
          `${u.height}px`,
        ),
        this.inventory.style.setProperty(
          "--garage-part-column-step",
          `${u.stepX}px`,
        ),
        this.inventory.style.setProperty(
          "--garage-part-row-step",
          `${u.stepY}px`,
        ),
        this.inventory.style.setProperty(
          "--garage-part-icon-width",
          `${u.iconWidth}px`,
        ),
        this.inventory.style.setProperty(
          "--garage-part-icon-height",
          `${u.iconHeight}px`,
        ),
        this.inventory.style.setProperty(
          "--garage-part-icon-y",
          `${u.iconAdjustY}px`,
        ),
        this.inventory.style.setProperty(
          "--garage-part-title-x",
          `${u.titleRect.x}px`,
        ),
        this.inventory.style.setProperty(
          "--garage-part-title-y",
          `${u.titleRect.y}px`,
        ),
        this.inventory.style.setProperty(
          "--garage-part-title-width",
          `${u.titleRect.width}px`,
        ),
        this.inventory.style.setProperty(
          "--garage-part-title-height",
          `${u.titleRect.height}px`,
        ),
        this.place(this.inventory, Dt(this.assets, p)),
        this.coatingMode && c
          ? this.updateCoatingInventory()
          : this.cosmeticSlot && c && this.updateCosmeticInventory(),
        !c)
      ) {
        const g = document.createElement("div");
        ((g.className = "garage-parts-notice"),
          (g.textContent = "该代暂无可用的四槽部件目录。"),
          this.inventory.append(g));
      }
      for (const [g, m] of f.entries()) {
        const b = Et(m),
          P = document.createElement("div");
        P.className = `garage-part-card garage-native-part-card quality-${b ?? 0}`;
        const C = this.assets.imageUrls.get(Sn(m, u.texture));
        C && (P.style.backgroundImage = `url(${JSON.stringify(C)})`);
        const S = Kt(
          Xe(
            o,
            r,
            this.slot,
            this.assets.parts,
            this.selected.engineGrade,
            this.selected.uniqueLevel,
            this.defaultPartGrades,
          ),
          m,
        );
        P.classList.toggle("selected", S);
        const w = this.button("", () => this.setPartPreview(m));
        ((w.className = "garage-part-preview"),
          w.setAttribute(
            "aria-label",
            `预览 ${this.partLabel(m)} ${le(this.slot, m.family)}`,
          ),
          m.family === "legacy" && m.legacyEffect && (w.title = m.legacyEffect),
          Mn(
            w,
            m,
            () => this.previewPart,
            (v) => {
              this.transformPreviewUiHidden || this.setPartPreview(v);
            },
          ),
          this.previewParts.set(w, m));
        const k =
          m.family === "legacy"
            ? void 0
            : this.icon(`uniqueLevel_${m.grade}`, "garage-inventory-frame");
        (k && w.append(k),
          this.partVisual(w, m, "garage-inventory-icon", Math.floor(g / 3)));
        const x = fe(o, this.slot),
          T = document.createElement("span");
        if (
          ((T.textContent = this.partLabel(m)),
          (T.className = `quality-${b ?? 0}`),
          w.append(T),
          (w.disabled = x),
          w.setAttribute("aria-disabled", String(x)),
          P.classList.toggle("locked", x),
          P.append(w),
          mt(x))
        ) {
          const v = this.button(S ? "已装备" : "装备", () =>
            this.requestEquip(m),
          );
          (v.setAttribute(
            "aria-label",
            `${S ? "已装备" : "装备"} ${this.partLabel(m)} ${le(this.slot, m.family)}`,
          ),
            (v.className = "garage-equip-label"),
            this.skin(v, "garage_btn_equip_"),
            (v.disabled = S),
            P.append(v));
        }
        this.inventory.append(P);
      }
      if (l.kind === "xun" && f.length > 0) {
        const g = Xe(
            o,
            r,
            this.slot,
            this.assets.parts,
            this.selected.engineGrade,
            this.selected.uniqueLevel,
            this.defaultPartGrades,
          )?.itemId,
          m = g === void 0 ? void 0 : f.find((C) => C.itemId === g + 1),
          b = this.button("强化一级", () => {
            m && this.equip(m);
          });
        ((b.disabled = !m || fe(o, this.slot)),
          (b.dataset.upgrade = "true"),
          this.skin(b, "garage_btn_reinforce_0@zz"),
          (b.textContent = ""),
          b.setAttribute("aria-label", "强化一级（本地测试）"),
          this.place(b, this.rect("partsReinforceButton")));
        const P = this.nativeButton(
          "partsResetButton",
          "重置当前部件（本地测试）",
          () => this.requestEquip(void 0),
        );
        ((P.textContent = ""),
          (P.dataset.upgrade = "true"),
          (P.disabled = !r[this.slot] || fe(o, this.slot)));
      }
    } catch (r) {
      (this.info.replaceChildren(),
        (this.comparisons.length = 0),
        (this.cancelPreview.hidden = !0),
        (this.removePart.disabled = !0),
        (this.inventory.textContent = `当前车辆参数不可用：${r instanceof Error ? r.message : r}`));
    }
    ((this.inventory.scrollTop = i),
      this.updatePageVisibility(),
      this.updateCards());
  }
  requestSkillSelection(e) {
    if (
      !this.requireCustomization() ||
      this.disposed ||
      this.skillSelection ||
      this.exceedTypeChange ||
      this.upgrade ||
      this.preparation ||
      this.confirmation?.pending ||
      this.pageMode !== "level" ||
      Ue(this.selected.engineGrade) !== "xun"
    )
      return;
    const t = this.selected,
      s = K(this.configuration, t.itemId, this.serial()).progression ?? ce(!0);
    if (s.kind === "xun") {
      this.pointEffects?.clear();
      try {
        ((this.skillSelection = new Da(
          this.surface,
          this.options.library,
          s,
          e,
          (i) => {
            ((this.skillSelection = void 0),
              (this.controls.inert = !1),
              (this.progressionPanel.element.inert = !1),
              this.factoryPanel && (this.factoryPanel.element.inert = !1),
              i &&
                !this.disposed &&
                this.selected === t &&
                this.setProgression(i),
              this.disposed ||
                this.progressionPanel.element
                  .querySelector(`button[aria-label="更换第${e + 1}栏技能"]`)
                  ?.focus());
          },
        )),
          (this.controls.inert = !0),
          (this.progressionPanel.element.inert = !0),
          this.factoryPanel && (this.factoryPanel.element.inert = !0));
      } catch (i) {
        this.status.textContent = i instanceof Error ? i.message : String(i);
      }
    }
  }
  requestExceedTypeChange() {
    if (
      !this.requireCustomization() ||
      this.disposed ||
      this.exceedTypeChange ||
      this.skillSelection ||
      this.upgrade ||
      this.preparation ||
      this.confirmation?.pending ||
      this.pageMode !== "level"
    )
      return;
    const e = this.selected,
      t = this.serial(),
      s = K(this.configuration, e.itemId, t),
      i = s.progression ?? ce(!0),
      n = this.tuning.exceedTypeChange;
    if (
      !n ||
      i.kind !== "xun" ||
      $s(
        {
          engineGrade: e.engineGrade,
          kartType: e.kartType,
          itemId: e.itemId,
          level: i.level,
        },
        n,
      ) !== "enabled"
    )
      return;
    const r = s.exceedType ?? this.base().defaultExceedType;
    (this.pointEffects?.clear(),
      (this.exceedTypeChange = new Tn(
        this.surface,
        this.tuning,
        this.options.library,
        { title: e.title, type: r },
        (o) => {
          if (
            ((this.exceedTypeChange = void 0),
            (this.controls.inert = !1),
            (this.progressionPanel.element.inert = !1),
            !this.disposed &&
              this.selected === e &&
              this.serial() === t &&
              o !== void 0)
          )
            try {
              const l = {
                ...K(this.configuration, e.itemId, t),
                exceedType: o,
              };
              (te(this.base(), e.engineGrade ?? 0, l, this.options.speed),
                (this.configuration = ie(this.configuration, e.itemId, t, l)));
              const h =
                new Map([
                  [2, "S"],
                  [3, "B"],
                  [4, "L"],
                ]).get(o) ?? `类型 ${o}`;
              (this.publishCurrentState(),
                (this.status.textContent = `超负荷类型已变更为 ${h} 并立即生效。`));
            } catch (c) {
              this.status.textContent =
                c instanceof Error ? c.message : String(c);
            }
          this.disposed || this.updateControls();
        },
      )),
      (this.controls.inert = !0),
      (this.progressionPanel.element.inert = !0));
  }
  requestProgression(e, t = !1, s = "step") {
    if (
      this.skillSelection ||
      this.exceedTypeChange ||
      this.upgrade ||
      this.preparation ||
      this.confirmation?.pending ||
      !this.canSetProgression(e)
    )
      return;
    const i =
      K(this.configuration, this.selected.itemId, this.serial()).progression ??
      ce(e.kind === "xun");
    if (e.level === i.level) {
      this.setProgression(e);
      return;
    }
    const n = this.selected;
    try {
      if (e.kind === "xun" && !t) {
        const o = this.options.catalog.karts
          .filter((c) => !Re(c.itemId) && c.engineGrade === 9)
          .map((c) => {
            const l =
                c.itemId === this.options.profile.equipment.itemIds[3]
                  ? this.options.profile.equipment.kartSerial
                  : 0,
              h = K(this.configuration, c.itemId, l).progression ?? ce(!0);
            if (h.kind !== "xun") throw new Error("迅车型存档强化类型不匹配。");
            return { item: c, value: h };
          });
        (this.pointEffects?.clear(),
          (this.preparation = new Ja(
            this.surface,
            this.options.library,
            o,
            n.itemId,
            (c) => {
              ((this.preparation = void 0),
                (this.controls.inert = !1),
                (this.progressionPanel.element.inert = !1),
                this.factoryPanel && (this.factoryPanel.element.inert = !1),
                !(!c || this.disposed) &&
                  ((this.selected = c.candidate.item),
                  this.panels?.setTransformPreview(!1),
                  this.panels?.resetPreviewRotation(!1),
                  this.publishCurrentState(),
                  this.updateControls(),
                  this.requestProgression(c.target, !0, c.method)));
            },
          )),
          (this.controls.inert = !0),
          (this.progressionPanel.element.inert = !0),
          this.factoryPanel && (this.factoryPanel.element.inert = !0));
        return;
      }
      const r = ri(i, e, n.engineGrade, s);
      if ((this.pointEffects?.clear(), !this.setProgression(e, !1))) return;
      ((this.upgrade = new Ra(
        this.surface,
        this.options.library,
        this.options.environment,
        this.options.stageBinding,
        n.title,
        (o) => {
          ((this.upgrade = void 0),
            this.restoreUpgradeResultBackground(),
            (this.controls.inert = !1),
            (this.progressionPanel.element.inert = !1),
            this.factoryPanel && (this.factoryPanel.element.inert = !1),
            !this.disposed &&
              this.selected === n &&
              this.refreshUpgradeState());
        },
        e.kind,
        r,
        !0,
        e.kind === "xun"
          ? this.tuning?.urls.get(`tuning_mark_${r.afterLevel}`)
          : void 0,
      )),
        this.hideUpgradeResultBackground(),
        (this.controls.inert = !0),
        (this.progressionPanel.element.inert = !0),
        this.factoryPanel && (this.factoryPanel.element.inert = !0));
    } catch (r) {
      this.status.textContent = r instanceof Error ? r.message : String(r);
    }
  }
  hideUpgradeResultBackground() {}
  restoreUpgradeResultBackground() {}
  refreshUpgradeState() {
    if (!(this.pageMode !== "level" || !this.selected))
      try {
        const e = K(this.configuration, this.selected.itemId, this.serial()),
          t = this.base(),
          s = ue(this.selected.engineGrade),
          i = pe(this.selected.engineGrade),
          n = Ue(this.selected.engineGrade),
          r =
            e.progression && e.progression.kind === Ut(i)
              ? e.progression
              : ce(i === "xun");
        (s &&
          i === "xun" &&
          (this.updateVehicleInformation(t, e, s),
          this.updateCosmeticEquippedSlots(e, s, !1)),
          this.updateVehicleHeading(r.kind === "xun" ? r.level : void 0),
          this.progressionPanel.update(
            r,
            !!n,
            this.selected.engineGrade,
            e.factory,
            e.exceedType ?? t.defaultExceedType,
            { itemId: this.selected.itemId, kartType: this.selected.kartType },
            this.upgradeCatalogEmpty,
          ),
          i === "classic" &&
            r.kind === "classic" &&
            this.progressionPanel.updateRadar(
              this.options.library,
              this.selected.path,
              t,
              r,
              e.factory,
            ));
      } catch (e) {
        this.status.textContent = e instanceof Error ? e.message : String(e);
      }
  }
  setProgression(e, t = !0) {
    if (!this.canSetProgression(e)) return !1;
    try {
      const s =
          K(this.configuration, this.selected.itemId, this.serial())
            .progression ?? ce(e.kind === "xun"),
        i = {
          ...K(this.configuration, this.selected.itemId, this.serial()),
          progression: e,
        };
      return (
        te(this.base(), this.selected.engineGrade ?? 0, i, this.options.speed),
        (this.configuration = ie(
          this.configuration,
          this.selected.itemId,
          this.serial(),
          i,
        )),
        this.publishCurrentState(),
        (this.status.textContent = "强化配置已更新并立即生效。"),
        t && this.updateControls(),
        this.pointEffects?.transition(s, e),
        !0
      );
    } catch (s) {
      return (
        (this.status.textContent = s instanceof Error ? s.message : String(s)),
        !1
      );
    }
  }
  async setFactory(e) {
    if (this.factorySession?.pending) return;
    const t = this.selected,
      s = this.serial(),
      i = () =>
        !this.disposed &&
        this.selected.itemId === t.itemId &&
        this.serial() === s &&
        this.pageMode === "factory",
      n = this.configuration;
    let r = !1;
    try {
      if (!this.nativeFactoryAllowed())
        throw new Error("当前车辆不支持原版车辆改装。");
      const o = { ...K(this.configuration, t.itemId, s), factory: e };
      te(this.base(), this.selected.engineGrade ?? 0, o, this.options.speed);
      const c = (u) => ({
          category: 3,
          itemId: t.itemId,
          serial: s,
          status: u.active ? 0 : 1,
          reserved: 0,
          slots: [...u.abilities],
          protectionSlots: [65535, 65535],
          protectionCounts: [0, 0],
        }),
        l = K(this.configuration, t.itemId, s).factory;
      ((this.configuration = ie(this.configuration, t.itemId, s, o)),
        this.publishCurrentState(),
        (r = !0));
      const h = new $a(
        l ? [c(l)] : [],
        async () => (
          await new Promise((u) => setTimeout(u, 0)),
          { resultCode: 0, record: c(e) }
        ),
      );
      ((this.factorySession = h),
        (this.factorySessionVehicleKey = this.factoryVehicleKey(t)),
        h.select({ category: 3, itemId: t.itemId, serial: s }));
      const d = h.request(
        l ? (e.active ? "activate" : "reset") : "install",
        0,
        0,
      );
      if (
        ((this.status.textContent =
          "自定义粒子效果已立即应用，正在确认本地记录……"),
        this.updateControls(),
        await d,
        this.disposed)
      )
        return;
      const f = h.current,
        p = K(this.configuration, t.itemId, s);
      ((this.configuration = ie(this.configuration, t.itemId, s, {
        ...p,
        factory: { active: f.status === 0, abilities: [...f.slots] },
      })),
        this.publishCurrentState(),
        i() && (this.status.textContent = ""));
    } catch (o) {
      (r &&
        !this.disposed &&
        this.selected === t &&
        ((this.configuration = n), this.publishCurrentState()),
        !this.disposed &&
          this.selected === t &&
          (this.status.textContent =
            o instanceof Error ? o.message : String(o)));
    } finally {
      this.disposed || this.updateControls();
    }
  }
  selectPage(e) {
    if (
      (this.panels?.setParticleModificationPageVisible?.(e === "factory"),
      e !== this.pageMode &&
        ((this.transformPreviewStartPending = !1),
        this.panels?.resetPreviewForPageTransition
          ? this.panels.resetPreviewForPageTransition()
          : this.panels?.setTransformPreview?.(!1),
        this.syncTransformPreviewUi()),
      (this.page = 0),
      (this.cosmeticPreview = void 0),
      (this.previewPart = void 0),
      (this.upgradeCatalogEmpty = !1),
      e === "level" &&
        (!ae(this.selected.itemId) || !pe(this.selected.engineGrade)))
    ) {
      const t = this.options.catalog.karts.find(
        (s) =>
          !Re(s.itemId) &&
          ae(s.itemId) &&
          s.identityClass !== "legacy-system-family" &&
          pe(s.engineGrade) !== void 0,
      );
      if (t) {
        ((this.pageMode = e), this.selectKart(t));
        return;
      } else this.upgradeCatalogEmpty = !0;
    }
    if (e === "factory") {
      const t = this.canonicalFactoryVehicle(this.selected);
      t !== this.selected && ((this.selected = t), this.factoryScoreRevision++);
    }
    ((this.pageMode = e), this.updateControls());
  }
  selectKart(e) {
    (Ft(e.itemId),
      (this.transformPreviewStartPending = !1),
      (this.previewPart = void 0),
      (this.cosmeticPreview = void 0),
      (this.coatingPreview = void 0),
      (this.inventory.scrollTop = 0),
      this.info.replaceChildren(),
      this.vehicleFunctions.replaceChildren(),
      (this.comparisons.length = 0));
    for (const t of this.slotControls.values()) t.replaceChildren();
    ((this.selected = e),
      this.factoryScoreRevision++,
      this.panels?.setTransformPreview?.(!1),
      this.panels?.resetPreviewRotation(!1),
      this.publishCurrentState(),
      this.updateControls());
  }
  canSetProgression(e) {
    return this.requireCustomization()
      ? Ue(this.selected.engineGrade) === e.kind
        ? !0
        : ((this.status.textContent = oi), !1)
      : !1;
  }
  updatePageVisibility() {
    for (const n of this.controls.children)
      if (n instanceof HTMLElement) {
        if (
          (n.dataset.garageRestore === "true" &&
            (n.disabled = !ae(this.selected.itemId)),
          !n.dataset.garageCommon)
        ) {
          const r =
            n.dataset.vehicleInfo === "true" &&
            ds(this.pageMode, this.selected?.engineGrade);
          n.hidden =
            !r &&
            (this.pageMode !== "parts" ||
              (n.dataset.transformPreview === "true" &&
                n.dataset.transformAvailable !== "true") ||
              (n === this.cancelPreview &&
                !this.previewPart &&
                !this.cosmeticPreview));
        }
        ["parts", "level", "factory"].includes(n.dataset.garageCommon ?? "") &&
          n.classList.toggle(
            "selected",
            n.dataset.garageCommon === this.pageMode,
          );
      }
    ((this.progressionPanel.element.hidden =
      this.pageMode !== "level" || !ae(this.selected.itemId)),
      (this.inventory.hidden = this.pageMode !== "parts"),
      (this.inventoryScrollHit.hidden = this.pageMode !== "parts"),
      this.factoryPanel &&
        (this.factoryPanel.element.hidden = this.pageMode !== "factory"));
    const e = this.pageMode === "factory";
    this.kartName.hidden = e;
    const t = !e || !!this.factoryPanel?.showsCatalog;
    ((this.search.hidden = e),
      this.controls
        .querySelectorAll("[data-filter], [data-garage-catalog='search']")
        .forEach((n) => {
          n.hidden = e;
        }),
      (this.cards.hidden = this.pageLabel.hidden = !t),
      this.cards.classList.toggle("garage-factory-cards", e));
    const s = this.factoryPanel?.assets,
      i = e ? this.factoryPanel?.catalogLayout : void 0;
    (i &&
      s &&
      (this.cards.style.setProperty("--factory-columns", String(i.columns)),
      this.cards.style.setProperty("--factory-rows", String(i.rows)),
      this.cards.style.setProperty("--factory-card-width", `${i.cardWidth}px`),
      this.cards.style.setProperty(
        "--factory-card-height",
        `${i.cardHeight}px`,
      ),
      this.cards.style.setProperty("--factory-gap-x", `${i.gapX}px`),
      this.cards.style.setProperty("--factory-gap-y", `${i.gapY}px`)),
      this.place(this.cards, i?.rect ?? bt(this.assets)),
      this.place(
        this.pageLabel,
        e && s ? s.rects.get("pageInfo") : this.rect("pageInfo"),
      ),
      this.controls
        .querySelectorAll(
          "[data-garage-catalog='leftKartPage'], [data-garage-catalog='rightKartPage']",
        )
        .forEach((n) => {
          const r = n.dataset.garageCatalog;
          ((n.hidden = !t),
            this.place(
              n,
              e && s
                ? s.rects.get(
                    r === "leftKartPage" ? "preItemList" : "nextItemList",
                  )
                : this.rect(r),
            ));
        }),
      (this.status.style.top = e ? "804px" : "630px"),
      this.syncTransformPreviewUi());
  }
  selectSlot(e) {
    ((this.coatingMode = !1),
      (this.coatingPreview = void 0),
      (this.cosmeticSlot = void 0),
      (this.cosmeticPreview = void 0),
      (this.transformPreviewStartPending = !1),
      this.panels?.setTransformPreview?.(!1),
      (this.previewPart = void 0),
      (this.slot = e),
      (this.inventory.scrollTop = 0),
      this.updateControls());
  }
  cosmeticIcon(e, t) {
    return e.icon ? this.icon(`parts:${e.icon.slice(14, -4)}`, t) : void 0;
  }
  updateCoatingInventory() {
    const e = this.base(),
      t = rt(e, this.selected.engineGrade) === "xun" ? "xun" : "classic",
      s =
        e.partsLocks[4] !== 0 ||
        (this.selected.engineGrade !== 8 && this.selected.engineGrade !== 9),
      i = K(this.configuration, this.selected.itemId, this.serial()).cosmetics
        ?.coating;
    this.status.textContent =
      "点击预览；确认装备后立即应用。取消预览恢复当前装备。";
    for (const n of this.assets.coatings.filter((r) => r.family === t)) {
      const r = document.createElement("div");
      ((r.className = "garage-part-card garage-cosmetic-card"),
        r.classList.toggle("selected", i === n.id));
      const o = this.assets.imageUrls.get(Ze);
      o && (r.style.backgroundImage = `url("${o}")`);
      const c = this.button("", () => {
        ((this.coatingPreview = n),
          (this.cancelPreview.hidden = !1),
          (this.status.textContent = `试穿：${n.title}。可拖动车辆或开启变形预览，不会写入装备。`));
      });
      ((c.className = "garage-part-preview"),
        c.setAttribute("aria-label", `试穿 ${n.title}`),
        (c.disabled = s || this.cosmeticBusy || !!n.unavailableReason),
        (c.title = s ? "车型禁止安装车膜" : (n.unavailableReason ?? n.title)));
      const l = document.createElement("span");
      ((l.className = "garage-cosmetic-name"),
        (l.textContent = n.title),
        c.append(l));
      const h = this.cosmeticIcon(n, "garage-inventory-icon");
      if ((h && c.append(h), r.append(c), mt(s, !!n.unavailableReason))) {
        const d = this.button(i === n.id ? "已装备" : "装备", () =>
          this.requestCoating(n),
        );
        ((d.className = "garage-equip-label"),
          this.skin(d, "garage_btn_equip_"),
          d.setAttribute("aria-label", `装备 ${n.title}`),
          (d.disabled = i === n.id || this.cosmeticBusy),
          r.append(d));
      }
      this.inventory.append(r);
    }
  }
  requestCoating(e) {
    if (!this.requireCustomization()) return;
    const t = this.selected;
    this.confirmation?.open(
      `确定${e ? `装备「${e.title}」` : "卸下车膜，恢复车辆原有材质"}并立即生效？`,
      () => {
        !this.disposed &&
          this.selected === t &&
          this.coatingMode &&
          this.equipCoating(e);
      },
    );
  }
  async equipCoating(e) {
    if (!this.requireCustomization() || this.cosmeticBusy || !this.coatingMode)
      return;
    const t = this.selected,
      s = this.serial(),
      i = this.cosmeticResetToken,
      n = () =>
        !this.disposed &&
        this.selected === t &&
        this.coatingMode &&
        this.serial() === s &&
        this.cosmeticResetToken === i,
      r = t.engineGrade === 9 ? "xun" : "classic",
      o = () => {
        const l = K(this.configuration, t.itemId, s),
          h = { ...l.cosmetics, family: r };
        return (
          e ? (h.coating = e.id) : delete h.coating,
          { ...l, cosmetics: h }
        );
      };
    this.cosmeticBusy = !0;
    let c;
    try {
      if (e && e.family !== r) throw new Error("车膜与车代不兼容。");
      if ((te(this.base(), t.engineGrade ?? 0, o(), this.options.speed), e)) {
        if (!this.panels) throw new Error("请等待车辆预览加载完成。");
        await this.panels.validateCoatingEquipment(t.itemId, e);
      }
      if (!n()) return;
      const l = o();
      (te(this.base(), t.engineGrade ?? 0, l, this.options.speed),
        (this.configuration = ie(this.configuration, t.itemId, s, l)),
        this.publishCurrentState(),
        (this.coatingPreview = void 0));
    } catch (l) {
      c = l instanceof Error ? l.message : String(l);
    } finally {
      ((this.cosmeticBusy = !1),
        this.disposed ||
          (this.updateControls(), c && n() && (this.status.textContent = c)));
    }
  }
  updateCosmeticInventory() {
    const e = this.cosmeticSlot,
      t = this.base(),
      s = rt(t, this.selected.engineGrade) === "xun" ? "xun" : "classic",
      i = K(this.configuration, this.selected.itemId, this.serial())
        .cosmetics?.[e],
      n = ci(
        this.assets.cosmetics.filter((r) => r.family === s),
        e,
      );
    for (const [r, o] of n.entries()) {
      const c = document.createElement("div");
      ((c.className = `garage-part-card garage-cosmetic-card${e === "boosterEffect" ? " garage-booster-effect-card" : ""}`),
        c.classList.toggle("selected", i === o.id));
      const l = this.assets.imageUrls.get(Ze);
      l && (c.style.backgroundImage = `url("${l}")`);
      const h = this.button("", () => {
        const u = this.cosmeticPreview;
        (u &&
          (u.id !== o.id || u.slot !== o.slot || u.family !== o.family) &&
          this.panels?.setTransformPreview?.(!1),
          (this.cosmeticPreview = o),
          (this.cancelPreview.hidden = !1),
          (this.status.textContent = `预览：${o.title}，尚未装备。`),
          this.startTransformPreview());
      });
      ((h.className = "garage-part-preview"),
        h.setAttribute("aria-label", `预览 ${o.title}`),
        (h.title = o.title));
      const d = document.createElement("span");
      ((d.className = "garage-cosmetic-name"),
        (d.textContent = o.title),
        h.append(d));
      const f = this.cosmeticIcon(o, "garage-inventory-icon");
      if (f) h.append(f);
      else {
        const u = document.createElement("span");
        ((u.className = "garage-cosmetic-preview-hint"),
          (u.textContent = "点击预览"),
          h.append(u),
          o.previewModel &&
            this.addModelTarget(
              h,
              { path: o.previewModel },
              "garage-inventory-icon garage-booster-effect-model",
              Math.floor(r / 3),
              u,
              [136, 100],
            ));
      }
      const p = li(t, e);
      if (((h.disabled = p || this.cosmeticBusy), c.append(h), mt(p))) {
        const u = this.button(i === o.id ? "已装备" : "装备", () =>
          this.requestCosmetic(o),
        );
        ((u.className = "garage-equip-label"),
          u.setAttribute(
            "aria-label",
            `${i === o.id ? "已装备" : "装备"} ${o.title}`,
          ),
          this.skin(u, "garage_btn_equip_"),
          (u.disabled = i === o.id || this.cosmeticBusy),
          c.append(u));
      }
      this.inventory.append(c);
    }
  }
  async equipCosmetic(e) {
    if (!this.requireCustomization() || this.cosmeticBusy || !this.cosmeticSlot)
      return;
    const t = this.selected,
      s = this.serial(),
      i = this.cosmeticSlot,
      n = this.cosmeticResetToken,
      r = () =>
        !this.disposed &&
        this.selected === t &&
        this.serial() === s &&
        this.cosmeticSlot === i &&
        this.cosmeticResetToken === n;
    this.cosmeticBusy = !0;
    let o;
    try {
      const c = K(this.configuration, t.itemId, s),
        l = {
          family:
            rt(this.base(), this.selected.engineGrade) === "xun"
              ? "xun"
              : "classic",
          ...c.cosmetics,
        };
      e ? (l[i] = e.id) : delete l[i];
      const h = { ...c, cosmetics: l };
      te(this.base(), t.engineGrade ?? 0, h, this.options.speed);
      const d = await hi(this.options.library, t.path);
      if ((await di(this.options.library, gi(d.parameter.value), l), !r()))
        return;
      const f = K(this.configuration, t.itemId, s),
        p = { ...l, ...f.cosmetics };
      e ? (p[i] = e.id) : delete p[i];
      const u = { ...f, cosmetics: p };
      (te(this.base(), t.engineGrade ?? 0, u, this.options.speed),
        (this.configuration = ie(this.configuration, t.itemId, s, u)),
        this.publishCurrentState(),
        (this.cosmeticPreview = void 0),
        (o = "外观部件已更新并立即生效。"));
    } catch (c) {
      o = c instanceof Error ? c.message : String(c);
    } finally {
      ((this.cosmeticBusy = !1),
        this.disposed ||
          (this.updateControls(), o && r() && (this.status.textContent = o)));
    }
  }
  setPartPreview(e) {
    Kt(this.previewPart, e) ||
      ((this.previewPart = e), this.updatePerformance());
  }
  rehitTestInventoryPreview() {
    (cancelAnimationFrame(this.inventoryHitTestFrame),
      (this.inventoryHitTestFrame = requestAnimationFrame(() => {
        if (((this.inventoryHitTestFrame = 0), this.transformPreviewUiHidden))
          return;
        const e = this.inventoryPointer,
          t = e
            ? Rn(
                this.inventory,
                e.x,
                e.y,
                (s, i) => document.elementFromPoint(s, i),
                this.previewParts,
              )
            : void 0;
        ((this.coatingPreview = void 0),
          (this.cosmeticPreview = void 0),
          this.setPartPreview(t));
      })));
  }
  async showFactoryTutorial() {
    if (!this.tutorialLoading) {
      (this.tutorialClose?.(), (this.tutorialLoading = !0));
      try {
        const e = await Ea(this.options.library, this.surface);
        this.disposed || this.pageMode !== "factory"
          ? e()
          : (this.tutorialClose = e);
      } catch (e) {
        this.disposed ||
          (this.status.textContent = `教程加载失败：${String(e)}`);
      } finally {
        this.tutorialLoading = !1;
      }
    }
  }
  updateFactoryScores() {
    const e = ++this.factoryScoreRevision,
      t = this.selected,
      s = this.factoryPanel,
      i = this.factoryVehicleKey(t);
    if (!s) return;
    if (!this.nativeFactoryAllowed(t)) {
      s.updateScores(void 0, "当前车辆不支持车辆改装。");
      return;
    }
    let r, o;
    try {
      ((r = this.base()), (o = K(this.configuration, t.itemId, this.serial())));
    } catch (p) {
      s.updateScores(void 0, String(p));
      return;
    }
    const c = vt(r, t.engineGrade);
    if (!c) {
      s.updateScores(void 0, "当前车辆缺少对应代际的 Factory 评分来源。");
      return;
    }
    const l = c === "xun" ? "xun-body" : "x-v1",
      h = `${l}:${t.path}`;
    let d = this.scoreSources.get(h);
    d ||
      ((d = cs(this.options.library, t.path, l)),
      this.scoreSources.set(h, d),
      d.catch(() => this.scoreSources.delete(h)));
    const f = () =>
      !this.disposed &&
      this.factoryScoreRevision === e &&
      this.factoryVehicleKey(this.selected) === i &&
      this.pageMode === "factory";
    d.then((p) => {
      if (!f()) return;
      const u = Me(p, r, t.engineGrade, o, this.assets.parts);
      s.updateScores(u);
    }).catch((p) => {
      f() && s.updateScores(void 0, String(p));
    });
  }
  factoryVehicleKey(e) {
    return `${e.kind}:${e.itemId}:${e.systemKey ?? ""}:${e.path}:${e.engineGrade ?? ""}:${this.serialFor(e)}`;
  }
  canonicalFactoryVehicle(e) {
    const t = (s) => s.replace(/\\/g, "/").toLowerCase();
    return (
      this.options.catalog.karts.find(
        (s) =>
          s.itemId === e.itemId &&
          t(s.path) === t(e.path) &&
          (s.systemKey ?? "") === (e.systemKey ?? ""),
      ) ?? e
    );
  }
  serialFor(e) {
    const t = this.options?.profile;
    return t && e.itemId === t.equipment.itemIds[3]
      ? t.equipment.kartSerial
      : 0;
  }
  updatePerformance() {
    const e = ++this.scoreRevision,
      t = this.pageMode,
      s = this.base(),
      i = K(this.configuration, this.selected.itemId, this.serial()),
      n = Gt(
        te(s, this.selected.engineGrade ?? 0, i, this.options.speed),
        this.speedVersion,
        this.options.speed,
      ),
      r = Gt(
        Xi(
          s,
          this.selected.engineGrade ?? 0,
          i,
          this.previewPart,
          this.options.speed,
        ),
        this.speedVersion,
        this.options.speed,
      ),
      o = me(s, this.selected.engineGrade ?? 0),
      c = vt(s, this.selected.engineGrade ?? 0);
    if (((this.defaultPartGrades = void 0), c)) {
      const h = this.selected,
        d = this.previewPart
          ? { ...i, [this.previewPart.slot]: this.previewPart }
          : i;
      this.renderScoreRows(void 0, "正在读取原版评分数据。");
      const f = c === "xun" ? "xun-body" : "x-v1",
        p = `${f}:${h.path}`;
      let u = this.scoreSources.get(p);
      (u ||
        ((u = cs(this.options.library, h.path, f)),
        this.scoreSources.set(p, u),
        u.catch(() => this.scoreSources.delete(p))),
        u
          .then((g) => {
            if (
              this.disposed ||
              this.scoreRevision !== e ||
              this.selected !== h ||
              this.pageMode !== t
            )
              return;
            const m = Me(g, s, h.engineGrade, i, this.assets.parts),
              b = Me(g, s, h.engineGrade, d, this.assets.parts);
            if (o === "x" || o === "v1") {
              const w = g.grid,
                k = {},
                x = Me(g, s, h.engineGrade, {}, this.assets.parts);
              if (w) {
                const T = [
                    ["engine", "TransAccelFactor", x.TransAccelFactor],
                    ["handle", "SteerConstraint", x.SteerConstraint],
                    ["wheel", "DriftEscapeForce", x.DriftEscapeForce],
                    ["booster", "NormalBoosterTime", x.NormalBoosterTime],
                  ],
                  v = ys(h.engineGrade);
                for (const [_, $, N] of T) {
                  const A = dn(w, v, $, N);
                  A !== void 0 && (k[_] = A);
                }
              }
              this.defaultPartGrades = Object.keys(k).length > 0 ? k : void 0;
            }
            let P;
            (o === "xun" &&
              this.previewPart &&
              (P = Me(
                g,
                s,
                h.engineGrade,
                i,
                this.assets.parts,
                this.previewPart.slot,
              )),
              this.renderScoreRows(
                ls.map(([w, k, x]) => ({
                  label: w,
                  node: x,
                  before: m[k],
                  after: b[k],
                  baseline: P?.[k],
                })),
                "P3543 原版评分规则 · 当前车辆状态",
              ));
            const C = K(this.configuration, h.itemId, this.serial()),
              S = ue(h.engineGrade);
            S &&
              this.pageMode !== "factory" &&
              this.updateVehicleInformation(s, C, S, !1);
          })
          .catch((g) => {
            !this.disposed &&
              this.scoreRevision === e &&
              this.selected === h &&
              this.pageMode === t &&
              this.renderScoreRows(
                void 0,
                `评分暂不可用：${g instanceof Error ? g.message : String(g)}`,
              );
          }));
      return;
    }
    (this.info.replaceChildren(),
      (this.comparisons.length = 0),
      (this.info.title = "当前车代显示物理参数，不是官服面板评分。"),
      (this.info.dataset.performanceMode = "physical"),
      (this.cancelPreview.hidden =
        !this.previewPart && !this.cosmeticPreview && !this.coatingPreview));
    const l =
      ue(this.selected.engineGrade)?.performanceRoot ?? "textPerformList";
    for (const [h, d, f, p] of [
      ["加速系数", "transAccelFactor", "transAccelFactor", 5],
      ["转向约束", "steerConstraint", "cornerDrawFactor", 3],
      ["漂移逃脱力", "driftEscapeForce", "driftEscapeForce", 0],
      ["个人氮气 / ms", "normalBoosterTime", "normalBoosterTime", 0],
      ["集气阈值", "driftMaxGauge", "boosterGauge", 0],
    ]) {
      const u = document.createElement("div"),
        g = document.createElement("span");
      if (((g.textContent = n[d].toFixed(p)), u.append(g), n[d] !== r[d])) {
        const m = document.createElement("strong");
        ((m.textContent = `→ ${r[d].toFixed(p)}`),
          u.append(m),
          (u.className = "changed"));
        const b = `/${l}/kartParam/${f}_PrewiewBg`,
          P = this.assets.nodes.get(b);
        P &&
          this.comparisons.push({ token: y(P, "texture"), rect: this.rect(b) });
      }
      ((u.title = `${h}（物理参数，非官服面板分值）`),
        u.setAttribute("aria-label", `${h} ${u.textContent}`),
        this.info.append(u));
    }
  }
  renderScoreRows(e, t) {
    (this.info.replaceChildren(),
      (this.comparisons.length = 0),
      (this.info.title = t),
      this.info.setAttribute("aria-label", t),
      (this.info.dataset.performanceMode = e ? "scores" : "unavailable"),
      (this.cancelPreview.hidden =
        !this.previewPart && !this.cosmeticPreview && !this.coatingPreview));
    const s =
      ue(this.selected.engineGrade)?.performanceRoot ?? "textPerformList";
    this.info.classList.toggle(
      "garage-xun-score-layout",
      s === "textPerformList_12",
    );
    const i = this.rect(`/${s}/kartParam/transAccelFactor_PrewiewBg`);
    this.place(this.info, { x: i.x, y: i.y, width: i.width, height: 160 });
    for (const [n, [r, , o]] of ls.entries()) {
      const c = e?.[n],
        l = document.createElement("div"),
        h = document.createElement("span");
      ((h.textContent = c ? String(c.before) : "—"), l.append(h));
      const d = this.rect(`/${s}/kartParam/${o}`);
      if (
        (s === "textPerformList_12"
          ? ((h.className = "garage-xun-score-value"),
            h.style.setProperty("--xun-value-x", `${d.x - i.x}px`),
            h.style.setProperty("--xun-value-y", `${d.y - i.y}px`),
            h.style.setProperty("--xun-value-width", `${d.width}px`),
            h.style.setProperty("--xun-value-height", `${d.height}px`))
          : ((l.className = "garage-score-row"),
            l.style.setProperty("--garage-score-row-y", `${d.y - i.y}px`),
            l.style.setProperty("--garage-score-row-height", `${d.height}px`),
            (h.className = "garage-score-value"),
            h.style.setProperty("--garage-score-value-x", `${d.x - i.x}px`),
            h.style.setProperty("--garage-score-value-width", `${d.width}px`),
            h.style.setProperty(
              "--garage-score-value-height",
              `${d.height}px`,
            )),
        c && c.before !== c.after)
      ) {
        const f = document.createElement("strong");
        if (s === "textPerformList_12" && c.baseline !== void 0) {
          const g = wn(c.before, c.after, c.baseline),
            m = d,
            b = this.rect(`/${s}/kartParam/compareArrowBg`),
            P = document.createElement("span");
          l.replaceChildren(P);
          const C = m.x - i.x;
          (l.style.setProperty("--xun-comparison-row-x", `${C}px`),
            l.style.setProperty("--xun-comparison-row-y", `${m.y - i.y}px`),
            l.style.setProperty("--xun-arrow-width", `${b.width}px`),
            l.style.setProperty("--xun-arrow-height", `${b.height}px`),
            (P.textContent = `${g.beforeValue} ${g.beforeDelta}`),
            (P.className = "garage-xun-comparison-before"));
          const S = document.createElement("i");
          S.className = "garage-xun-comparison-arrow";
          const w = this.assets.imageUrls.get("garage_img_compareBG2_arrow");
          (w && (S.style.backgroundImage = `url(${JSON.stringify(w)})`),
            (f.textContent = `${g.afterValue} ${g.afterDelta}`),
            (f.className = `garage-xun-comparison-after ${g.trend}`),
            l.append(S, f),
            (l.className = "changed garage-xun-comparison"));
        } else if (s !== "textPerformList_12") {
          const g = d,
            m = this.rect(`/${s}/kartParam/${o}Preview`),
            b = g.x - i.x,
            P = m.x + m.width - g.x;
          (l.style.setProperty("--garage-score-comparison-x", `${b}px`),
            l.style.setProperty(
              "--garage-score-comparison-y",
              `${g.y - i.y}px`,
            ),
            l.style.setProperty("--garage-score-comparison-width", `${P}px`),
            l.style.setProperty(
              "--garage-score-comparison-height",
              `${g.height}px`,
            ),
            l.style.setProperty(
              "--garage-score-comparison-value-width",
              `${g.width}px`,
            ),
            l.style.setProperty(
              "--garage-score-comparison-after-width",
              `${m.width}px`,
            ),
            (h.className = "garage-score-comparison-before"),
            (f.textContent = String(c.after)),
            (f.className = "garage-score-comparison-after"),
            l.append(f),
            (l.className = "changed garage-score-comparison"));
        } else
          ((f.textContent = `→ ${c.after}`),
            l.append(f),
            (l.className = "changed"));
        const p = `/${s}/kartParam/${o}_PrewiewBg`,
          u = this.assets.nodes.get(p);
        u &&
          this.comparisons.push({ token: y(u, "texture"), rect: this.rect(p) });
      }
      ((l.title = `${r} · ${t}`),
        l.setAttribute("aria-label", `${r} ${l.textContent ?? ""} · ${t}`),
        this.info.append(l));
    }
  }
  partLabel(e) {
    return $n(e, this.assets?.strings ?? new Map(), this.assets?.parts ?? []);
  }
  filteredKarts() {
    const e = this.pageMode === "factory",
      t = e ? "" : this.search.value.trim().toLocaleLowerCase();
    return this.options.catalog.karts.filter(
      (s) =>
        !Re(s.itemId) &&
        s.identityClass !== "legacy-system-family" &&
        (this.pageMode !== "level" ||
          (ae(s.itemId) && pe(s.engineGrade) !== void 0)) &&
        (!e || this.nativeFactoryAllowed(s)) &&
        (e || !this.filter || s.kartType === this.filter) &&
        `${s.title} ${s.internalId} ${s.itemId}`
          .toLocaleLowerCase()
          .includes(t),
    );
  }
  nativeFactoryAllowed(e = this.selected) {
    return ae(e.itemId) && ui(e.engineGrade, e.title);
  }
  requireCustomization() {
    return ae(this.selected.itemId)
      ? !0
      : ((this.status.textContent = "练习车不支持部件、强化、改装或外观修改。"),
        !1);
  }
  updateCards() {
    const e = this.pageMode === "factory",
      t = e ? this.factoryPanel?.catalogLayout : void 0,
      s = t?.pageSize ?? kn,
      i = this.filteredKarts(),
      n = Math.max(1, Math.ceil(i.length / s));
    if (
      ((this.page = Math.min(Math.max(0, this.page), n - 1)),
      (this.pageLabel.textContent = `${this.page + 1} / ${n}`),
      (this.pageLabel.title = `${i.length} 辆车`),
      this.controls.querySelectorAll("[data-filter]").forEach((r) => {
        r.classList.toggle(
          "selected",
          Number(r.dataset.filter) === this.filter,
        );
      }),
      this.cards.replaceChildren(),
      e && !this.factoryPanel?.showsCatalog)
    ) {
      this.visibleCards = [];
      return;
    }
    this.visibleCards = i
      .slice(this.page * s, (this.page + 1) * s)
      .map((r, o) => {
        const c = this.button(r.title, () => {
          this.selectKart(r);
        });
        return (
          (c.title = `${r.title} (#${r.itemId})`),
          c.setAttribute("aria-label", r.title),
          (c.textContent = ""),
          c.classList.toggle("selected", r.itemId === this.selected.itemId),
          this.cards.append(c),
          {
            item: r,
            isHovered: xa(c),
            kartZoom: t?.kartZoom ?? this.assets.kartCardLayout.kartZoom,
            kartShadow: !e,
            rect: t ? t.thumbnail(o) : Gi(this.assets, o),
          }
        );
      });
  }
  publishCurrentState() {
    if (!this.options.onChange) return;
    const e = this.options.catalog.characters.find(
      (r) => r.itemId === this.options.selectedCharacterItemId,
    );
    if (!e) throw new Error("当前人物不在资源目录内，无法更新车库状态。");
    const t = ot(
        this.options.profile,
        this.selected.itemId,
        e.itemId,
        this.selected.systemKey,
        this.options.profile.equipment.systemKartVariant,
      ),
      s = K(this.configuration, this.selected.itemId, this.serial()),
      i =
        this.selected.engineGrade === 9
          ? (s.exceedType ?? this.base().defaultExceedType)
          : void 0,
      n = { ...pi({ ...t, garage: this.configuration }), exceedType: i ?? 0 };
    this.options.onChange({
      kart: this.selected,
      character: e,
      equipment: n,
      garage: this.configuration,
    });
  }
  renderStrengtheningOverlay(e) {
    const t = this.panels;
    if (!t) return;
    const s = this.options.catalog.characters.find(
      (f) => f.itemId === this.options.selectedCharacterItemId,
    );
    if (!s) return;
    const i = this.preparation?.previewRect ? this.preparation : void 0,
      r =
        this.pageMode !== "factory" || this.nativeFactoryAllowed()
          ? (i?.selected ?? this.selected)
          : void 0,
      o = i?.previewCard ? [...i.cards, i.previewCard] : this.visibleCards,
      c = r ?? this.selected;
    let l = ot(this.options.profile, c.itemId, s.itemId),
      h = this.configuration;
    if (this.cosmeticPreview) {
      const f = K(h, this.selected.itemId, this.serial());
      h = ie(this.configuration, this.selected.itemId, this.serial(), {
        ...f,
        cosmetics: {
          ...f.cosmetics,
          family: this.cosmeticPreview.family,
          [this.cosmeticPreview.slot]: this.cosmeticPreview.id,
        },
      });
    }
    l = { ...l, garage: h };
    const d = i?.previewRect ?? this.activePreviewRect();
    if (
      ((i || !t.isPreviewReady) &&
        (t.setPreviewSize(d.width, d.height, "garage-x"),
        t.render(
          e,
          this.assets.stage.width,
          this.assets.stage.height,
          o,
          d,
          r,
          s,
          l,
          void 0,
          !1,
          this.renderPixelRatio,
        )),
      this.upgrade && r)
    ) {
      let f =
        this.selected.engineGrade === 9
          ? t.renderKartSnapshot(
              e,
              this.assets.stage.width,
              this.assets.stage.height,
              r,
              d,
              this.renderPixelRatio,
            )
          : t.renderPreviewSnapshot(
              e,
              this.assets.stage.width,
              this.assets.stage.height,
              d,
              this.renderPixelRatio,
            );
      (!f &&
        this.selected.engineGrade === 9 &&
        (f = t.renderPreviewSnapshot(
          e,
          this.assets.stage.width,
          this.assets.stage.height,
          d,
          this.renderPixelRatio,
        )),
        f && this.upgrade.capturePreview(t, d));
    }
    (this.upgrade?.render(e, t), this.preparation?.draw(t));
  }
  frame = () => {
    if (!this.shown || this.disposed || this.frozen) return;
    if (
      ((this.raf = requestAnimationFrame(this.frame)),
      this.upgrade !== void 0 || this.preparation !== void 0)
    ) {
      (this.captureStrengtheningStage(),
        this.renderStrengtheningOverlay(performance.now()),
        this.drawing.beginFrame(),
        this.strengtheningSnapshot &&
          this.drawing.drawCanvasLayer(
            this.strengtheningSnapshot,
            {
              x: 0,
              y: 0,
              width: this.assets.stage.width,
              height: this.assets.stage.height,
            },
            0,
          ),
        this.finishCanvasFrame(!0));
      return;
    }
    this.strengtheningSnapshot = void 0;
    const t = this.context,
      { width: s, height: i } = this.assets.stage;
    (this.drawing.beginFrame(),
      (t.fillStyle = "#151e28"),
      t.fillRect(0, 0, s, i));
    const n = this.assets.nodes.get("backGround_1920"),
      r = n && this.assets.textures.get(y(n, "image") ?? ""),
      o = this.assets.rects.get("backGround_1920");
    r && o && t.drawImage(r, o.x, o.y, o.width, o.height);
    const c = ue(this.selected.engineGrade) ?? ue(0),
      l = c.kind === "xun",
      h = Nn(this.pageMode, c);
    if (h) {
      const x = h.replace("_1600", `_${s}`),
        T = this.assets.textures.get(x);
      T && t.drawImage(T, 0, 0, s, i);
    }
    (this.pageMode === "level" &&
      this.progressionPanel.draw(t, this.selected.engineGrade),
      this.pageMode === "factory" && this.factoryPanel?.draw(t));
    const d = An(this.assets.definition, Ln(this.pageMode, l)),
      f = (x) => {
        if (this.transformPreviewUiHidden && x === "partsListBoard") return;
        const T = this.assets.nodes.get(x);
        let v = y(T, "image") ?? y(T, "texture");
        x === "selectedKartType" && (v = In(this.selected.kartType));
        const _ = this.assets.textures.get(v),
          $ = this.rect(x);
        _ && t.drawImage(_, $.x, $.y);
      },
      p = () => {
        if (
          (d.afterPreview.forEach(f),
          this.pageMode !== "factory" && !this.transformPreviewUiHidden)
        ) {
          const x = this.rect("partListBar"),
            T = this.inventoryScroll.geometry(this.assets.partScrollbar, x),
            v = this.assets.textures.get(
              this.assets.partScrollbar.areaFrame.texture,
            );
          T && v && yi(t, this.assets.partScrollbar, v, T);
        }
      };
    if (this.pageMode !== "factory") {
      d.beforePreview.forEach(f);
      for (const { token: x, rect: T } of this.comparisons) {
        const v = this.assets.textures.get(x);
        v && t.drawImage(v, T.x, T.y);
      }
    }
    if (this.pageMode === "level" && this.upgradeCatalogEmpty) {
      (p(), this.finishCanvasFrame());
      return;
    }
    const u = this.options.catalog.characters.find(
      (x) => x.itemId === this.options.selectedCharacterItemId,
    );
    if (!u || !this.panels) {
      (p(), this.finishCanvasFrame());
      return;
    }
    const g = this.preparation?.previewRect ? this.preparation : void 0,
      b =
        this.pageMode !== "factory" || this.nativeFactoryAllowed()
          ? (g?.selected ?? this.selected)
          : void 0,
      P = g?.previewCard ? [...g.cards, g.previewCard] : this.visibleCards,
      C = b ?? this.selected;
    let S = ot(this.options.profile, C.itemId, u.itemId),
      w = this.configuration;
    if (this.cosmeticPreview) {
      const x = K(w, this.selected.itemId, this.serial());
      w = ie(w, this.selected.itemId, this.serial(), {
        ...x,
        cosmetics: {
          ...x.cosmetics,
          family: this.cosmeticPreview.family,
          [this.cosmeticPreview.slot]: this.cosmeticPreview.id,
        },
      });
    }
    S = { ...S, garage: w };
    const k = g?.previewRect ?? this.activePreviewRect();
    if (
      (this.panels.setPreviewSize(k.width, k.height, "garage-x"),
      this.panels.render(
        performance.now(),
        s,
        i,
        P,
        k,
        b,
        u,
        S,
        this.pageMode === "parts" && this.coatingMode && !g
          ? this.coatingPreview
          : void 0,
        !0,
        this.renderPixelRatio,
        this.drawing,
      ),
      b &&
        (this.panels.drawPreview(t, k),
        this.upgrade?.capturePreview(this.panels, k)),
      p(),
      this.visibleCards.forEach(({ item: x, rect: T, isHovered: v }, _) => {
        this.pageMode === "factory" &&
          this.factoryPanel?.drawCatalogFrame(t, _, !1, v?.());
        const $ = x.itemId === this.selected.itemId;
        (this.pageMode !== "factory" &&
          this.drawKartCatalogFrame(t, T, $, v?.()),
          this.panels.drawCard(t, x, T),
          this.drawKartLevelBadge(t, x, T),
          this.pageMode === "factory" &&
            x.itemId === this.selected.itemId &&
            this.factoryPanel?.drawCatalogFrame(t, _, !0));
      }),
      this.flushTransformPreviewStart(),
      this.coatingPreview &&
        this.panels.coatingPreviewError &&
        this.status.textContent !== this.panels.coatingPreviewError &&
        (this.status.textContent = this.panels.coatingPreviewError),
      this.controls
        .querySelector("[data-transform-preview]")
        ?.setAttribute(
          "aria-pressed",
          String(this.transformPreviewSessionActive()),
        ),
      this.syncTransformPreviewUi(),
      this.syncCosmeticPreviewActions(),
      this.pageMode !== "factory" && this.renderPartModels(),
      this.pageMode === "factory" && this.factoryPanel?.model)
    ) {
      const x = this.factoryPanel.model,
        T = this.modelCache.get(x.source);
      T &&
        (this.panels.drawAuxiliaryPanel(T, [x.context]),
        (this.factoryPanel.modelReady = !0));
    }
    (this.upgrade?.render(performance.now(), this.panels),
      this.preparation?.draw(this.panels),
      this.pointEffects?.render(performance.now(), this.panels),
      this.finishCanvasFrame());
  };
  captureStrengtheningStage() {
    this.strengtheningSnapshot ||
      (this.strengtheningSnapshot = this.captureStage());
  }
  captureStage() {
    const e = this.context.getTransform(),
      { width: t, height: s } = this.assets.stage,
      i = document.createElement("canvas");
    ((i.width = Math.max(1, Math.round(t * e.a))),
      (i.height = Math.max(1, Math.round(s * e.d))));
    const n = i.getContext("2d");
    if (!n) throw new Error("车库冻结画布不可用。");
    return (
      n.drawImage(
        this.canvas,
        e.e,
        e.f,
        t * e.a,
        s * e.d,
        0,
        0,
        i.width,
        i.height,
      ),
      i
    );
  }
  finishCanvasFrame(e = !1) {
    (this.controlCanvas.draw(this.drawing, this.renderPixelRatio, e),
      (this.search.inert = this.controls.inert || e),
      (this.search.style.visibility = this.search.inert ? "hidden" : "visible"),
      this.paintTaskbar(),
      this.drawing.endFrame());
  }
  paintTaskbar() {
    const e = this.options.taskbar?.compositeFrame;
    if (e) {
      const t = this.canvas.getBoundingClientRect();
      if (!t.width || !t.height) return;
      (this.context.save(),
        this.context.setTransform(
          this.canvas.width / t.width,
          0,
          0,
          this.canvas.height / t.height,
          0,
          0,
        ),
        this.drawing.drawCanvasLayer(
          e.canvas,
          {
            x: e.rect.left - t.left,
            y: e.rect.top - t.top,
            width: e.rect.width,
            height: e.rect.height,
          },
          e.revision,
        ),
        this.context.restore());
    }
  }
  authoredPointerY(e) {
    const t = this.surface.getBoundingClientRect();
    return ((e.clientY - t.top) * this.assets.stage.height) / t.height;
  }
  drawKartCatalogFrame(e, t, s, i = !1) {
    if (!s && !i) return;
    const n = this.assets.kartCardLayout,
      r = this.assets.textures.get(s ? n.selectedTexture : n.texture);
    if (!r) return;
    const o = s && r.width >= n.width * 2 ? n.width : 0;
    e.drawImage(r, o, 0, n.width, n.height, t.x, t.y, t.width, t.height);
  }
  drawKartLevelBadge(e, t, s) {
    if (t.kind !== "kart") return;
    const i = K(this.configuration, t.itemId, this.serial()).progression,
      n = i?.level,
      r = fi(t.engineGrade),
      o = mi(t.engineGrade, n);
    if (!r || !o || !i || i.kind !== r) return;
    const c = this.assets.textures.get(o);
    if (!c) return;
    const l = r === "xun" ? 8 : 10,
      h = r === "xun" ? 8 : 10,
      d = r === "xun" ? 30 : 26,
      f = r === "xun" ? 28 : 18,
      p = s.x + s.width - l - d,
      u = s.y + h;
    if ((e.drawImage(c, p, u, d, f), r === "classic")) {
      const g = vi(n);
      if (!g) return;
      wi(
        e,
        g,
        { x: p, y: u, width: d, height: f },
        {
          family: "P3528 Source Han Sans CN Garage",
          size: 12,
          stroke: 1,
          kind: "label",
          color: "white",
          strokeColor: "rgba(113, 0, 0, 0.95)",
          align: "center",
          verticalAlign: "center",
        },
      );
    }
  }
  onKey = (e) => {
    this.frozen ||
      this.confirmation?.pending ||
      this.upgrade ||
      this.preparation ||
      this.skillSelection ||
      this.exceedTypeChange ||
      (e.key === "Escape" &&
        (e.preventDefault(),
        e.stopImmediatePropagation(),
        this.coatingPreview
          ? ((this.coatingPreview = void 0), this.updatePerformance())
          : this.cosmeticPreview
            ? ((this.cosmeticPreview = void 0), this.updatePerformance())
            : this.previewPart && this.setPartPreview(void 0)));
  };
  createTransformPreviewButton() {
    const e = this.assets.nodes.get("previewEquippedTailLamp_Xun"),
      t = e?.children.find((o) => o.name === "Label"),
      s = t && y(t, "text"),
      i = s && /^#sb\((.+)\)$/.exec(s)?.[1],
      n = this.button("", () => {
        (this.panels?.toggleTransformPreview(),
          this.syncTransformPreviewUi(),
          n.setAttribute(
            "aria-pressed",
            String(this.transformPreviewSessionActive()),
          ));
      });
    n.classList.add("garage-transform-preview");
    const r = document.createElement("span");
    return (
      (r.textContent = i
        ? (this.assets.strings.get(i) ?? "变形预览")
        : "变形预览"),
      n.append(r),
      this.skin(n, y(e, "autoImage") ?? "garage_check_0", 5),
      (n.dataset.transformPreview = "true"),
      (n.dataset.transformAvailable = "false"),
      n.setAttribute(
        "aria-pressed",
        String(this.transformPreviewSessionActive()),
      ),
      this.place(n, this.rect("previewEquippedTailLamp_Xun")),
      n
    );
  }
  activePreviewRect() {
    return this.pageMode === "level"
      ? this.progressionPanel.previewRect
      : this.pageMode === "factory" && this.factoryPanel
        ? this.factoryPanel.previewRect
        : this.previewRect;
  }
  onDragStart = (e) => {
    if (e.button !== 0) return;
    const t = this.surface.getBoundingClientRect(),
      s = ((e.clientX - t.left) * this.assets.stage.width) / t.width,
      i = ((e.clientY - t.top) * this.assets.stage.height) / t.height,
      n = this.activePreviewRect();
    s < n.x ||
      s > n.x + n.width ||
      i < n.y ||
      i > n.y + n.height ||
      (this.panels?.beginPreviewRotation(),
      (this.drag = { id: e.pointerId, x: e.clientX }),
      this.canvas.setPointerCapture(e.pointerId));
  };
  onDragMove = (e) => {
    this.drag?.id === e.pointerId &&
      (this.panels?.rotatePreview(
        ((e.clientX - this.drag.x) * this.assets.stage.width) /
          this.surface.getBoundingClientRect().width,
      ),
      (this.drag.x = e.clientX));
  };
  onDragEnd = (e) => {
    this.finishPreviewDrag(e.pointerId);
  };
  finishPreviewDrag(e) {
    this.drag?.id === e &&
      ((this.drag = void 0),
      this.panels?.resetPreviewRotation(),
      this.canvas.hasPointerCapture(e) && this.canvas.releasePointerCapture(e));
  }
}
async function Fn(a) {
  const e = new Map();
  return (
    await Promise.all(
      a.catalog.karts
        .filter((t) => t.itemId === 0)
        .map(async (t) => {
          const s = { itemId: t.itemId, systemKey: t.systemKey },
            i = await bi(a.library, t.path, t.systemKey);
          e.set(bs(s), xs(s, a.speed, i.parameter.value, a.version ?? vs));
        }),
    ),
    e
  );
}
export {
  _n as GARAGE_REMOVE_PART_BUTTON_RECT,
  As as GarageXView,
  Mn as bindGaragePartPreview,
  mt as garageEquipButtonVisible,
  In as garageKartTypeTexture,
  Rn as garagePartPreviewAtPoint,
  Nn as garageXPageBackgroundTexture,
  ds as garageXSharedVehicleInfoVisible,
  Ln as garageXStageNodes,
  An as garageXStagePaintOrder,
};
