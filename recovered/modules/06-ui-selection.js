class Ma0 {
  constructor(e) {
    this.canvas = e;
    const t = document.createElement("canvas").getContext("2d");
    if (!t) throw new Error("浏览器无法创建车库界面绘制上下文。");
    ((this.state = t),
      (this.renderer = new I4({
        canvas: e,
        alpha: !0,
        preserveDrawingBuffer: !0,
        powerPreference: "high-performance",
      })),
      (this.renderer.outputColorSpace = qe),
      (this.renderer.autoClear = !1),
      this.renderer.setClearColor(0, 0),
      this.scene.add(this.quad),
      (this.quad.frustumCulled = !1),
      (this.context = new Proxy(t, {
        get: (i, r) => {
          if (r === "canvas") return e;
          if (r === "clearRect")
            return () => {
              if (this.paints.length)
                throw new Error("车库仅在帧开始清理最终颜色目标。");
            };
          if (r === "beginPath")
            return () => {
              this.path = [];
            };
          if (r === "moveTo" || r === "lineTo" || r === "closePath")
            return (...o) => {
              this.path = [...this.path, { method: r, args: o }];
            };
          if (typeof r == "string" && Aa0.has(r))
            return (...o) => this.record(r, o);
          if (
            [
              "arc",
              "arcTo",
              "ellipse",
              "rect",
              "roundRect",
              "bezierCurveTo",
              "quadraticCurveTo",
              "strokeRect",
              "putImageData",
              "clip",
              "reset",
            ].includes(String(r))
          )
            return () => {
              throw new Error(`车库绘制目标未接入 ${String(r)}。`);
            };
          const s = Reflect.get(i, r, i);
          return typeof s == "function" ? s.bind(i) : s;
        },
        set: (i, r, s) => Reflect.set(i, r, s, i),
      })));
  }
  canvas;
  renderer;
  context;
  state;
  scene = new D1();
  camera = new Fm();
  material = new $1({
    uniforms: { image: { value: null }, opacity: { value: 1 } },
    vertexShader:
      "varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
    fragmentShader:
      "uniform sampler2D image; uniform float opacity; varying vec2 vUv; void main(){ gl_FragColor=texture2D(image,vUv); gl_FragColor.a*=opacity; }",
    transparent: !0,
    depthTest: !1,
    depthWrite: !1,
    toneMapped: !1,
  });
  quad = new D2(new Ar(1, 1), this.material);
  layers = new Map();
  imageIds = new WeakMap();
  canvasLayers = new Map();
  nextImageId = 0;
  paints = [];
  path = [];
  layerBytes = 0;
  backingWidth = 0;
  backingHeight = 0;
  disposed = !1;
  beginFrame() {
    if (this.disposed) return;
    ((this.paints = []),
      (this.path = []),
      this.canvasLayers.forEach((i) => {
        i.used = !1;
      }));
    const { width: e, height: t } = this.canvas;
    ((e !== this.backingWidth || t !== this.backingHeight) &&
      (this.renderer.setSize(e, t, !1),
      (this.backingWidth = e),
      (this.backingHeight = t),
      this.releaseLayers(),
      (this.camera.left = 0),
      (this.camera.right = e),
      (this.camera.top = t),
      (this.camera.bottom = 0),
      (this.camera.near = -1),
      (this.camera.far = 1),
      this.camera.updateProjectionMatrix()),
      this.fullViewport(),
      this.renderer.clear(!0, !0, !1));
  }
  endFrame() {
    this.flush();
    for (const [e, t] of this.canvasLayers)
      t.used || (t.texture.dispose(), this.canvasLayers.delete(e));
  }
  drawCanvasLayer(e, t, i, r, s = 1) {
    if (this.disposed || !e.width || !e.height) return;
    this.flush();
    let o = this.canvasLayers.get(e);
    if (o)
      ((i === void 0 || i !== o.revision) && (o.texture.needsUpdate = !0),
        (o.revision = i),
        (o.used = !0));
    else {
      const d = new bA(e);
      ((d.minFilter = d.magFilter = u9),
        (d.generateMipmaps = !1),
        (o = { texture: d, revision: i, used: !0 }),
        this.canvasLayers.set(e, o));
    }
    const a = this.state.getTransform(),
      c = a.a * t.x + a.e,
      l = a.d * t.y + a.f,
      u = a.a * t.width,
      h = a.d * t.height;
    if ((this.fullViewport(), r)) {
      const d = rT(r, a.a, a.d, this.canvas.height, a.e, a.f);
      (this.renderer.setScissor(d.x, d.y, d.width, d.height),
        this.renderer.setScissorTest(!0));
    }
    ((this.material.uniforms.image.value = o.texture),
      (this.material.uniforms.opacity.value = s),
      this.quad.position.set(c + u / 2, this.canvas.height - l - h / 2, 0),
      this.quad.scale.set(u, h, 1));
    try {
      this.renderer.render(this.scene, this.camera);
    } finally {
      this.fullViewport();
    }
  }
  drawModel(e, t) {
    this.flush();
    const i = this.state.getTransform(),
      r = rT(e, i.a, i.d, this.canvas.height, i.e, i.f),
      s = this.renderer;
    (s.setViewport(r.x, r.y, r.width, r.height),
      s.setScissor(r.x, r.y, r.width, r.height),
      s.setScissorTest(!0));
    try {
      t(s);
    } finally {
      (s.clear(!1, !0, !1), this.fullViewport());
    }
  }
  dispose() {
    this.disposed ||
      ((this.disposed = !0),
      (this.paints = []),
      this.releaseLayers(),
      this.canvasLayers.forEach((e) => e.texture.dispose()),
      this.canvasLayers.clear(),
      this.material.dispose(),
      this.quad.geometry.dispose(),
      this.renderer.dispose());
  }
  record(e, t) {
    const i = Object.fromEntries(ba0.map((h) => [h, this.state[h]])),
      { a: r, b: s, c: o, d: a, e: c, f: l } = this.state.getTransform(),
      u = e === "fill" || e === "stroke" ? this.path : void 0;
    if (u && t.length)
      throw new Error("车库多边形仅接入现有雷达 owner 的无参数提交。");
    (u && !u.some((h) => h.args.length === 2)) ||
      this.paints.push({
        method: e,
        args: t,
        state: i,
        transform: [r, s, o, a, c, l],
        path: u,
      });
  }
  flush() {
    if (!this.paints.length || this.disposed) return;
    const e = this.paints;
    this.paints = [];
    const t = JSON.stringify(
      e.map((r) => ({
        ...r,
        args: r.args.map((s) => {
          if (typeof s != "object" || s === null) return s;
          let o = this.imageIds.get(s);
          return (
            o === void 0 && ((o = ++this.nextImageId), this.imageIds.set(s, o)),
            { image: o }
          );
        }),
      })),
    );
    let i = this.layers.get(t);
    if (i) (this.layers.delete(t), this.layers.set(t, i));
    else {
      if (((i = this.rasterize(e)), !i)) return;
      for (
        this.layers.set(t, i), this.layerBytes += i.bytes;
        this.layerBytes > 64 * 1024 * 1024 && this.layers.size > 1;
      ) {
        const r = this.layers.entries().next().value;
        (this.layers.delete(r[0]),
          (this.layerBytes -= r[1].bytes),
          r[1].texture.dispose());
      }
    }
    (this.fullViewport(),
      (this.material.uniforms.image.value = i.texture),
      (this.material.uniforms.opacity.value = 1),
      this.quad.position.set(
        i.rect.x + i.rect.width / 2,
        this.canvas.height - i.rect.y - i.rect.height / 2,
        0,
      ),
      this.quad.scale.set(i.rect.width, i.rect.height, 1),
      this.renderer.render(this.scene, this.camera));
  }
  rasterize(e) {
    const t = e.map((u) => this.paintBounds(u)),
      i = Math.max(0, Math.floor(Math.min(...t.map((u) => u.x)))),
      r = Math.max(0, Math.floor(Math.min(...t.map((u) => u.y)))),
      s = Math.min(
        this.canvas.width,
        Math.ceil(Math.max(...t.map((u) => u.x + u.width))),
      ),
      o = Math.min(
        this.canvas.height,
        Math.ceil(Math.max(...t.map((u) => u.y + u.height))),
      );
    if (s <= i || o <= r) return;
    const a = document.createElement("canvas");
    ((a.width = s - i), (a.height = o - r));
    const c = a.getContext("2d");
    for (const u of e) {
      Object.assign(c, u.state);
      const [h, d, f, p, v, w] = u.transform;
      if ((c.setTransform(h, d, f, p, v - i, w - r), u.path)) {
        c.beginPath();
        for (const y of u.path)
          Reflect.get(c, y.method, c).apply(c, [...y.args]);
      }
      Reflect.get(c, u.method, c).apply(c, [...u.args]);
    }
    const l = new bA(a);
    return (
      (l.minFilter = l.magFilter = h9),
      (l.generateMipmaps = !1),
      {
        texture: l,
        rect: { x: i, y: r, width: a.width, height: a.height },
        bytes: a.width * a.height * 4,
      }
    );
  }
  paintBounds(e) {
    const t = e.args;
    let i, r, s, o;
    if (e.path) {
      const g = e.path.filter((b) => b.args.length === 2).map((b) => b.args),
        y = e.method === "stroke" ? e.state.lineWidth * e.state.miterLimit : 1;
      ((i = Math.min(...g.map((b) => b[0])) - y),
        (r = Math.min(...g.map((b) => b[1])) - y),
        (s = Math.max(...g.map((b) => b[0])) - i + y),
        (o = Math.max(...g.map((b) => b[1])) - r + y));
    } else if (e.method === "drawImage") {
      const g = t[0],
        y = t.length === 9 ? 5 : 1;
      ((i = Number(t[y])),
        (r = Number(t[y + 1])),
        (s = t.length === 3 ? g.width : Number(t[y + 2])),
        (o = t.length === 3 ? g.height : Number(t[y + 3])));
    } else if (e.method === "fillRect") [i, r, s, o] = t.map(Number);
    else {
      (this.state.save(), Object.assign(this.state, e.state));
      const g = this.state.measureText(String(t[0]));
      this.state.restore();
      const y =
        (e.method === "strokeText"
          ? e.state.lineWidth * e.state.miterLimit
          : 0) + 2;
      ((i = Number(t[1]) - g.actualBoundingBoxLeft - y),
        (r = Number(t[2]) - g.actualBoundingBoxAscent - y),
        (s = g.actualBoundingBoxLeft + g.actualBoundingBoxRight + y * 2),
        (o = g.actualBoundingBoxAscent + g.actualBoundingBoxDescent + y * 2));
    }
    const [a, c, l, u, h, d] = e.transform,
      f = [
        [i, r],
        [i + s, r],
        [i, r + o],
        [i + s, r + o],
      ].map(([g, y]) => [a * g + l * y + h, c * g + u * y + d]),
      p = f.map((g) => g[0]),
      v = f.map((g) => g[1]),
      w =
        e.state.shadowBlur * 2 +
        Math.abs(e.state.shadowOffsetX) +
        Math.abs(e.state.shadowOffsetY);
    return {
      x: Math.min(...p) - w,
      y: Math.min(...v) - w,
      width: Math.max(...p) - Math.min(...p) + w * 2,
      height: Math.max(...v) - Math.min(...v) + w * 2,
    };
  }
  fullViewport() {
    (this.renderer.setViewport(0, 0, this.canvas.width, this.canvas.height),
      this.renderer.setScissorTest(!1));
  }
  releaseLayers() {
    (this.layers.forEach((e) => e.texture.dispose()),
      this.layers.clear(),
      (this.layerBytes = 0),
      (this.material.uniforms.image.value = null));
  }
}
function rT(n, e, t, i, r = 0, s = 0) {
  const o = Math.trunc(n.x * e + r),
    a = Math.trunc(n.y * t + s),
    c = Math.trunc(n.width * e),
    l = Math.trunc(n.height * t);
  return { x: o, y: i - a - l, width: c, height: l };
}
class xa0 {
  constructor(e, t, i, r, s) {
    ((this.scene = e),
      (this.draws = t),
      (this.textures = i),
      (this.family = r),
      (this.baseline = s));
  }
  scene;
  draws;
  textures;
  family;
  baseline;
  revision = 0;
  disposed = !1;
  selected;
  get current() {
    return this.selected;
  }
  async select(e) {
    if (this.disposed) throw new Error("车膜试穿已结束。");
    const t = ++this.revision;
    if (e.family !== this.family) throw new Error("车膜与车代不兼容。");
    if (e.unavailableReason) throw new Error(e.unavailableReason);
    if (
      !Number.isInteger(e.resourceIndex) ||
      e.resourceIndex < 0 ||
      e.resourceIndex > 65535 ||
      e.textureIndex !== (e.resourceIndex & 255) ||
      e.textureIndex < 1 ||
      e.textureIndex >= 255 ||
      e.texturePath !== `effect/envMap/env${e.textureIndex}.png`
    )
      throw new Error("车膜资源映射尚未支持。");
    let i;
    try {
      i = await this.textures.request(e.textureIndex);
    } catch (r) {
      if (this.disposed || t !== this.revision) return !1;
      throw r;
    }
    return this.disposed || t !== this.revision
      ? !1
      : (this.scene.setCoatingProjection({ draws: this.draws, texture: i }),
        (this.selected = e),
        !0);
  }
  cancel() {
    this.disposed ||
      (++this.revision,
      this.scene.setCoatingProjection(this.baseline),
      (this.selected = void 0));
  }
  dispose() {
    this.disposed || (this.cancel(), (this.disposed = !0));
  }
}
function Sa0(n) {
  return Number.isInteger(n) && n >= 1 && n <= 7 ? `unique${n}@zz` : void 0;
}
function Ca0(n, e) {
  return e ? 0 : n / 2;
}
const S7 = {
    character: 1,
    color: 2,
    kart: 3,
    plate: 4,
    dye: 70,
    flyingPet: 52,
    goggle: 8,
    balloon: 9,
    headBand: 11,
    handGearL: 16,
    aura: 26,
    skidMark: 27,
  },
  qg = 100;
function Jd(n) {
  if ("category" in n) return { category: n.category, itemId: n.itemId };
  const e = S7[n.kind];
  if (n.kind === "kart" && n.itemId === 0) {
    const t = n.systemKey?.trim();
    return t ? { category: e, itemId: 0, systemKart: t } : void 0;
  }
  return { category: e, itemId: n.itemId };
}
function wl(n) {
  return !oT(n.category, 65535) || !oT(n.itemId, 65535)
    ? !1
    : n.itemId !== 0
      ? n.systemKart === void 0
      : n.category === S7.kart && Ea0(n.systemKart);
}
function ef(n) {
  if (!wl(n))
    throw new Error(
      "P3528 星标道具身份无效：需要类别、物品 ID，以及零 ID 物品的系统内容键。",
    );
  return {
    category: n.category,
    itemId: n.itemId,
    serial: 0,
    ...(n.systemKart ? { systemKart: n.systemKart.trim() } : {}),
  };
}
function Q3(n) {
  return `${n.category}:${n.itemId}:${n.serial}:${n.systemKart ?? ""}`;
}
function sT(n) {
  return new Set(n.map(Q3));
}
function oT(n, e) {
  return typeof n == "number" && Number.isInteger(n) && n >= 0 && n <= e;
}
function Ea0(n) {
  return typeof n == "string" && n.trim().length > 0;
}
const OP = [
    1, 2, 3, 4, 8, 9, 10, 11, 12, 16, 17, 18, 20, 21, 52, 26, 27, 30, 31, 32,
    36, 43, 45, 44, 46, 58, 59, 61, 70, 68, 69, 71, 76, 77, 78,
  ],
  zP = "kartrider-web:p3528:user-profile-v2";
function gr() {
  const n = Object.fromEntries(OP.map((e) => [e, 0]));
  return (
    (n[1] = 2),
    (n[2] = 1),
    (n[3] = 387),
    (n[70] = 1),
    {
      equipment: { itemIds: n, kartSerial: 0, valueAt3E: 0, exceedType: 0 },
      initial: "",
      favoriteTracks: [],
      favoriteItems: [],
    }
  );
}
function Ta0() {
  const n = localStorage.getItem(zP);
  return n === null ? void 0 : _a0(n);
}
function aT(n, e, t, i, r) {
  (kt(e, 65535, "卡丁车 ID"), Ra0(t));
  const s = n ?? gr(),
    o = s.equipment,
    a = e === 0 ? (i ?? (o.itemIds[3] === 0 ? o.systemKart : void 0)) : void 0;
  if (e === 0 && !a)
    throw new Error("本地用户资料的系统卡丁车缺少内容身份键。");
  const c = a
      ? UP(a, r ?? (o.systemKart === a ? o.systemKartVariant : void 0))
      : void 0,
    l = o.itemIds[3] === e && o.systemKart === a && o.systemKartVariant === c,
    u = l ? o.kartSerial : 0,
    h = l ? o.exceedType : (p5(s.garage, e, u).exceedType ?? 0),
    { systemKart: d, systemKartVariant: f, ...p } = o;
  return {
    ...s,
    equipment: {
      ...p,
      itemIds: { ...o.itemIds, 1: t, 3: e },
      ...(a ? { systemKart: a } : {}),
      ...(c ? { systemKartVariant: c } : {}),
      kartSerial: u,
      exceedType: h,
    },
  };
}
function cT(n) {
  (GI(n.garage), localStorage.setItem(zP, JSON.stringify(n)));
}
function _a0(n) {
  const e = {
      initial: "",
      favoriteTracks: [],
      favoriteItems: [],
      ...JSON.parse(n),
    },
    t = e?.equipment;
  if (!t) throw new Error("本地用户资料缺少装备结构。");
  for (const r of OP) kt(t.itemIds?.[r], 65535, `装备类别 ${r}`);
  if (
    (kt(t.kartSerial, 65535, "车辆实例编号"),
    kt(t.valueAt3E, 255, "装备 +3E"),
    kt(t.exceedType, 65535, "Exceed 类型"),
    t.systemKartVariant !== void 0)
  ) {
    if (t.itemIds[3] !== 0 || typeof t.systemKart != "string" || !t.systemKart)
      throw new Error("本地用户资料的系统车辆外观缺少系统车辆身份。");
    UP(t.systemKart, t.systemKartVariant);
  }
  if (typeof e.initial != "string")
    throw new Error("本地用户资料的号牌文字必须是字符串。");
  (Ga0(e.favoriteTracks), Ba0(e.favoriteItems));
  const i = E20(e.garage);
  return (GI(i), i === e.garage ? e : { ...e, garage: i });
}
function UP(n, e) {
  if (e === void 0) return;
  if (typeof e != "string" || !e.trim())
    throw new Error(`系统车辆 ${n} 的外观 variant 无效。`);
  const t = Cr.find((r) => r.key === n);
  if (!t) throw new Error(`系统车辆 ${n} 不支持外观 variant。`);
  const i = xw(t.key, e);
  if (!i) throw new Error(`系统车辆 ${n} 的外观 variant ${e} 无效。`);
  return i.resource;
}
function Ga0(n) {
  if (!Array.isArray(n) || n.length > 50)
    throw new Error("本地用户资料的收藏地图必须是最多 50 项的列表。");
  for (const e of n)
    (kt(e?.themeId, 35, "收藏主题 ID"),
      kt(e?.trackId, 4294967295, "收藏地图 ID"));
}
function Ba0(n) {
  if (!Array.isArray(n) || n.length > qg)
    throw new Error(`本地用户资料的星标道具必须是最多 ${qg} 项的列表。`);
  const e = new Set();
  for (const t of n) {
    if (
      (kt(t?.category, 65535, "星标道具类别"),
      kt(t?.itemId, 65535, "星标道具 ID"),
      kt(t?.serial, 65535, "星标道具实例编号"),
      t.systemKart !== void 0 &&
        (typeof t.systemKart != "string" ||
          !t.systemKart.trim() ||
          t.category !== S7.kart ||
          t.itemId !== 0))
    )
      throw new Error("本地用户资料的星标系统车辆缺少有效的系统车辆身份。");
    const i = Q3(t);
    if (e.has(i))
      throw new Error("本地用户资料的星标道具不能重复登记同一物品。");
    e.add(i);
  }
}
function Ra0(n) {
  if ((kt(n, 65535, "角色或卡丁车 ID"), n === 0))
    throw new Error("本地用户资料的角色或卡丁车 ID 不能为 0。");
}
function kt(n, e, t) {
  if (typeof n != "number" || !Number.isInteger(n) || n < 0 || n > e)
    throw new Error(`本地用户资料的${t}必须是 0..${e} 的整数。`);
}
const Ia0 = {
  flyingPet: "FlyingPet",
  color: "Paint",
  dye: "Dye",
  plate: "Plate",
  balloon: "Balloon",
  goggle: "Goggle",
  headBand: "HeadBand",
  handGearL: "HandGearL",
  aura: "Aura",
  skidMark: "SkidMark",
};
function ka0(n) {
  return (
    n === "balloon" ||
    n === "goggle" ||
    n === "headBand" ||
    n === "handGearL" ||
    n === "aura" ||
    n === "skidMark"
  );
}
async function La0(n, e, t, i) {
  if (e.kind === "flyingPet") {
    const { camera: h, zoom: d } = await tf(n, e.kind),
      f = await S4.preview(
        {
          library: n,
          item: e,
          environment: t,
          binding: i,
          colors: { primary: 4278190080, high: 4278190080 },
        },
        !0,
      ),
      p = new D1(),
      v = new T2();
    return (
      (v.rotation.x = -Math.PI / 2),
      v.add(f.object),
      p.add(v),
      {
        scene: p,
        camera: h,
        update: (w, g) => {
          ((h.aspect = w / g),
            (h.fov = we(75 / d, h.aspect)),
            h.updateProjectionMatrix(),
            f.update(performance.now(), h, w, g));
        },
        dispose: () => f.dispose(),
      }
    );
  }
  const r = { color: "colorspray", dye: "colordye", plate: "plateitem" }[
    e.kind
  ];
  if (ka0(e.kind)) {
    const h = await hr(n, e.kind, e.internalId, t, i),
      d = new D1();
    d.add(h.scene.object);
    const { camera: f, zoom: p } = await tf(n, e.kind);
    return (
      h.scene.reset(performance.now()),
      {
        scene: d,
        camera: f,
        update: (v, w) => {
          ((f.aspect = v / w),
            (f.fov = we(75 / p, f.aspect)),
            f.updateProjectionMatrix(),
            h.scene.update(performance.now(), f, v, w));
        },
        dispose: () => h.dispose(),
      }
    );
  }
  if (!r) throw new Error(`P3528 车库暂不支持装备类别 ${e.kind}。`);
  const s = y9(await A6(n, `stage_/common/${r}.1s`).bytes());
  if (s.root.kind !== "node") throw new Error(`${r}.1s 根节点不是 Relement。`);
  const o = e.kind === "plate" ? await Da0(n, e.itemId, s.root) : void 0;
  (e.kind === "color" && (await Pa0(n, e.itemId, s.root)),
    e.kind === "dye" && (await Fa0(n, e.itemId, s.root)));
  const a = await W1(
      s,
      n,
      r,
      (h) => ({
        status: "found",
        entry: A6(
          n,
          e.kind === "plate"
            ? "stage_/common/platetex.tga"
            : `stage_/common/${h.name}.png`,
        ),
      }),
      {
        environment: t,
        stageBinding: i,
        advanceEnvironment: !1,
        textureCache: o,
      },
    ),
    c = new D1();
  c.add(a.object);
  const { camera: l, zoom: u } = await tf(n, e.kind);
  return (
    a.reset(performance.now()),
    {
      scene: c,
      camera: l,
      update: (h, d) => {
        ((l.aspect = h / d),
          (l.fov = we(75 / u, l.aspect)),
          l.updateProjectionMatrix(),
          a.update(performance.now(), l, h, d));
      },
      dispose: () => {
        (a.dispose(), o?.forEach((h) => h.dispose()));
      },
    }
  );
}
async function Pa0(n, e, t) {
  const i = t.children[0]?.children[1]?.slots[6];
  if (i?.kind !== "material")
    throw new Error("colorspray.1s 缺少原版喷漆材质。 ");
  i.emissive = (await We(n, e)).primary;
}
async function Fa0(n, e, t) {
  const r = t.children[0].children[0].children[3].children[0].slots[6];
  if (r?.kind !== "material")
    throw new Error("colordye.1s 缺少原版染色剂材质。");
  r.emissive = (await We(n, e, 70)).primary;
}
async function Da0(n, e, t) {
  const i = t.children[0]?.slots[7];
  if (i?.kind !== "texture")
    throw new Error("plateitem.1s 缺少原版号牌纹理槽。 ");
  const r = A6(n, "stage_/common/platetex.tga"),
    s = await AB(r, i),
    o = await n.timeAttackPlateItem(e),
    a = await p2(await o.texture.bytes()),
    c = s.image,
    l = c.data;
  for (let u = 0; u < a.height; u += 1)
    l.set(
      a.pixels.subarray(u * a.width * 4, (u + 1) * a.width * 4),
      u * c.width * 4,
    );
  return ((s.needsUpdate = !0), new Map([[Va0(r, i), s]]));
}
function Va0(n, e) {
  return [
    n.virtualPath,
    e.addressU,
    e.addressV,
    e.minFilter,
    e.magFilter,
    e.mipFilter,
    e.maxAnisotropy,
  ].join("|");
}
async function tf(n, e) {
  const t = A6(n, "gui_/windowTemplate/itemPanels2.bml"),
    i = s2(await t.bytes()),
    r = Ia0[e];
  if (!r) throw new Error(`P3528 itemPanels2.bml 缺少 ${e} 相机记录。`);
  const s = i.children.find((g) => g.name === r && T(g, "name") === "default"),
    o = (g, y) =>
      (s ? (T(s, g) ?? y) : y).split(/\s+/).map((b) => Math.fround(Number(b))),
    [a, c, l] = o("defaultCameraPos", "0 -2.5 0.65"),
    [u, h, d] = o("defaultSpotPos", "0 0 0.65"),
    [f] = o("zoom", "2.5"),
    [p, v] = o("viewSize", "97 96"),
    w = new Z9(we(75 / f, p / v), p / v, 1, 100);
  return (w.position.set(a, l, -c), w.lookAt(u, d, -h), { camera: w, zoom: f });
}
function A6(n, e) {
  const t = n.exactCanonicalCandidates(e);
  if (t.length !== 1)
    throw new Error(`${e} source 数量必须为 1，实际 ${t.length}。`);
  return t[0];
}
const Le = Math.fround,
  lT = 3.141592025756836,
  Na0 = 6.283185005187988,
  $o = new WeakMap();
function Oa0(n, e, t) {
  const i = za0(n, e),
    r = Le(i - n),
    s = Le(Le(r * 9) + (r > 0 ? 0.5 : -0.5)),
    o = Le(n + Le(Le(Le(t) * s) * Le(0.001))),
    a = Math.abs(r) < Le(0.01) || Math.sign(r) !== Math.sign(Le(i - o));
  return { yaw: a ? i : o, complete: a };
}
function za0(n, e) {
  return n < 0 && Math.abs(Le(e - n)) > Math.abs(Le(e + n)) ? -Le(Na0 - e) : e;
}
function Qs(n, e, t) {
  const i = { kart: 3.7, character: 1.2, preview: 1.6 }[n],
    r = new Z9(we(75 / i, e / t), e / t, 1, n === "preview" ? 30 : 100);
  return (
    n === "kart"
      ? (r.position.set(2, 3.6, 8), r.lookAt(0, 0.3, 0))
      : n === "character"
        ? (r.position.set(-0.15, 1, 2.9), r.lookAt(0, 1, 0))
        : ($o.set(r, { preset: "default", authoredVerticalFov: r.fov }),
          J3(r, 0)),
    r
  );
}
function Ua0(n, e, t, i = 3.7) {
  const r = e / t,
    s = we(75 / i, r);
  (n.aspect === r && n.fov === s) ||
    ((n.aspect = r), (n.fov = s), n.updateProjectionMatrix());
}
function $a0(n, e, t, i) {
  const r = e / t;
  if (i) {
    const o = $o.get(n),
      a =
        i === "garage-x" && o?.preset === i
          ? o
          : {
              preset: i,
              authoredVerticalFov: we(75 / (i === "garage-x" ? 1.8 : 1.6), r),
            };
    ($o.set(n, a),
      (n.aspect !== r || n.fov !== a.authoredVerticalFov) &&
        ((n.aspect = r),
        (n.fov = a.authoredVerticalFov),
        n.updateProjectionMatrix()));
    return;
  }
  if (n.aspect === r) return;
  const s =
    (2 * Math.atan(Math.tan((n.fov * Math.PI) / 360) * n.aspect) * 180) /
    Math.PI;
  ((n.aspect = r), (n.fov = we(s, r)), n.updateProjectionMatrix());
}
function J3(n, e) {
  const t = $o.get(n)?.preset === "garage-x",
    i = new H(0, t ? 1.3 : 1.2, 0),
    r = t ? new H(8, 1.1, 8) : new H(-0.9, -0.3, 3.2);
  (r.multiplyScalar(1 + 1 / r.length()).applyAxisAngle(new H(0, 1, 0), e),
    n.position.copy(i).add(r),
    n.lookAt(i));
}
function Jf0(n, e) {
  const t = new Z9(we(41.666666666666664, n / e), n / e, 1, 30);
  return (
    $o.set(t, { preset: "garage-x", authoredVerticalFov: t.fov }),
    J3(t, 0),
    t
  );
}
function vl(n) {
  const [e, t, i, r] = j2(T(n, "clientMargin") ?? "3 3 3 3", 4, "clientMargin"),
    [s, o] = j2(T(n, "alignMargin") ?? "2 2", 2, "alignMargin");
  return {
    columns: Number(T(n, "alignSize") ?? 3),
    maxRows: Number(T(n, "maxLine") ?? 1),
    linePaging: T(n, "linePaging") === "true",
    gapX: s,
    gapY: o,
    margin: { left: e, top: t, right: i, bottom: r },
  };
}
function Wa0(n, e) {
  if (e <= n.columns * n.maxRows) return 1;
  const t = Math.ceil(e / n.columns);
  return n.linePaging
    ? t - n.maxRows + 1
    : n.maxRows === 0
      ? 1
      : Math.ceil(t / n.maxRows);
}
function Wv(n) {
  return n.columns * n.maxRows;
}
function i4(n) {
  return n.linePaging ? n.columns : Wv(n);
}
function $P(n, e, t, i, r) {
  const s = r * i4(n),
    o = Ha0(n, e, t, i),
    a = Math.min(i - s, Wv(n)),
    c = Array.from({ length: Math.max(0, a) }, (l, u) => ({
      x: e.x + n.margin.left + (u % n.columns) * (t.width + n.gapX),
      y: e.y + n.margin.top + Math.floor(u / n.columns) * (t.height + n.gapY),
      width: t.width,
      height: t.height,
    }));
  return { rect: o, cells: c, firstItem: s, positionCount: Wa0(n, i) };
}
function Ha0(n, e, t, i) {
  const r = Math.min(i, n.columns),
    s = Math.max(1, Math.min(Math.ceil(i / n.columns), n.maxRows)),
    o = i === 0 ? 0 : t.width,
    a = i === 0 ? 0 : t.height;
  return {
    ...e,
    width: r * o + (r - 1) * n.gapX + n.margin.left + n.margin.right,
    height: s * a + (s - 1) * n.gapY + n.margin.top + n.margin.bottom,
  };
}
function Hv(n, e) {
  const t = T(n, "scrollType") ?? "vertical",
    i = ["frame", "framePreset", "fixButtonSize"].find((s) => T(n, s));
  if (t !== "vertical" || i) throw new Error("尚未实现这个滚动条布局。");
  const r = rf(n, e, "upButton", "DefaultScrollUpButton")[0];
  if (r.caption.height + r.bottom.height !== 0)
    throw new Error("尚未实现带箭头的滚动条。");
  return {
    areaFrame: rf(n, e, "scrollArea", "DefaultVerticalScrollArea")[0],
    buttonFrames: rf(n, e, "scrollButton", "DefaultVerticalScrollButton"),
    minButtonHeight: Number(T(n, "minScrollButtonHeight") ?? 25),
  };
}
function uT(
  n,
  e,
  t,
  i,
  r = Math.fround(i * e.height),
  s = Math.fround(t * e.height),
) {
  const o = Math.fround(e.height),
    a = Math.fround(Math.fround(o * o) / s),
    c = Math.min(o, Math.max(n.minButtonHeight, a)),
    l = Math.fround(o - Math.fround(c - a)),
    u = Math.trunc(Math.fround(Math.fround(l * r) / s));
  return {
    area: e,
    button: {
      x: e.x,
      y: e.y + u,
      width: Math.trunc(e.width),
      height: Math.trunc(c),
    },
  };
}
function qa0(n, e, t, i, r = Math.fround(e * n.height)) {
  const s = r,
    o = Math.max(0, Math.fround(Math.fround(t - n.y) - i)),
    a = Math.min(
      Math.fround(s - n.height),
      Math.fround(Math.fround(s * o) / n.height),
    );
  return qv(n, a);
}
function nf(n, e, t, i, r = !1, s = Math.fround(e * n.height), o = n.height) {
  const a = Math.fround(t + i * o),
    c = r && i < 0 && a < o ? o : 0,
    l = a < c ? 0 : Math.min(Math.fround(s - n.height), a);
  return qv(n, l);
}
class b6 {
  constructor(e) {
    this.onChange = e;
  }
  onChange;
  buttonState = 3;
  current;
  grabOffset;
  trackPoint;
  direction = 1;
  repeatStart = 0;
  lastRepeat = 0;
  repeatFrame;
  get contentOffset() {
    return this.current?.value.contentOffset ?? 0;
  }
  layout(e, t, i, r, s = Math.fround(i * t.height)) {
    const o = this.current,
      a =
        !o ||
        o.count !== i ||
        o.value.position !== r ||
        o.rect.height !== t.height;
    a && this.stopPointer();
    const c = a ? qv(t, Math.fround(r * t.height)) : o.value,
      l = uT(e, t, i, r, c.contentOffset, s);
    return (
      (this.current = {
        scrollbar: e,
        rect: t,
        count: i,
        contentLength: s,
        value: c,
        geometry: l,
      }),
      l
    );
  }
  down(e) {
    const t = this.current;
    return !t || t.count <= 1 || !bc(e, t.geometry.area)
      ? !1
      : (this.stopPointer(),
        bc(e, t.geometry.button)
          ? ((this.grabOffset = Math.fround(e.y - t.geometry.button.y)),
            this.setButtonState(2))
          : this.startTrack(e),
        !0);
  }
  move(e, t) {
    const i = this.current;
    if (i) {
      if (this.grabOffset !== void 0 && !t) return this.up();
      (this.updateButtonState(e, t),
        this.grabOffset !== void 0 &&
          this.apply(
            qa0(i.rect, i.count, e.y, this.grabOffset, i.contentLength),
          ));
    }
  }
  wheel(e, t, i = !1) {
    const r = this.current;
    return !r || r.count <= 1
      ? !1
      : (this.apply(
          nf(r.rect, r.count, r.value.contentOffset, e, i, r.contentLength, t),
        ),
        !0);
  }
  up() {
    (this.stopPointer(), this.notify());
  }
  leave() {
    (this.stopRepeat(), this.setButtonState(3));
  }
  reset() {
    (this.stopPointer(), (this.current = void 0));
  }
  dispose() {
    this.reset();
  }
  startTrack(e) {
    const t = this.current;
    ((this.trackPoint = e),
      (this.direction = e.y < t.geometry.button.y ? -1 : 1),
      (this.repeatStart = performance.now()),
      (this.lastRepeat = this.repeatStart),
      this.apply(
        nf(
          t.rect,
          t.count,
          t.value.contentOffset,
          this.direction,
          !1,
          t.contentLength,
        ),
      ),
      (this.repeatFrame = requestAnimationFrame(this.repeatTrack)));
  }
  repeatTrack = (e) => {
    ((this.repeatFrame = void 0),
      !(!this.current || !this.trackPoint) &&
        (e > this.repeatStart + 300 && this.repeatStep(e),
        this.trackPoint &&
          (this.repeatFrame = requestAnimationFrame(this.repeatTrack))));
  };
  repeatStep(e) {
    const t = this.current;
    (e > this.lastRepeat + 77 &&
      ((this.lastRepeat = e),
      this.apply(
        nf(
          t.rect,
          t.count,
          t.value.contentOffset,
          this.direction,
          !0,
          t.contentLength,
        ),
      )),
      bc(this.trackPoint, this.current.geometry.button) && this.stopRepeat());
  }
  apply(e) {
    const t = this.current;
    ((t.value = e),
      (t.geometry = uT(
        t.scrollbar,
        t.rect,
        t.count,
        e.position,
        e.contentOffset,
        t.contentLength,
      )),
      this.notify());
  }
  setButtonState(e) {
    this.buttonState !== e && ((this.buttonState = e), this.notify());
  }
  updateButtonState(e, t) {
    this.setButtonState(t && bc(e, this.current.geometry.button) ? 2 : 3);
  }
  notify() {
    this.current && this.onChange(this.current.value.position);
  }
  stopPointer() {
    ((this.grabOffset = void 0), (this.buttonState = 3), this.stopRepeat());
  }
  stopRepeat() {
    ((this.trackPoint = void 0),
      this.repeatFrame !== void 0 && cancelAnimationFrame(this.repeatFrame),
      (this.repeatFrame = void 0));
  }
}
function qv(n, e) {
  return { contentOffset: e, position: Math.trunc(Math.fround(e / n.height)) };
}
function bc(n, e) {
  return (
    n.x >= e.x && n.x <= e.x + e.width && n.y >= e.y && n.y <= e.y + e.height
  );
}
function Kv(n, e, t, i, r = 3) {
  (C9(n, e.areaFrame, t, i.area), C9(n, e.buttonFrames[r], t, i.button));
}
function rf(n, e, t, i) {
  const r = T(n, t) ?? i,
    s = e.children.find((o) => o.name === r);
  if (!s) throw new Error(`缺少滚动条窗口帧 ${r}。`);
  return s.children.map(Ft);
}
const jv = 48,
  Xv = 8;
class WP {
  constructor(e = jv, t = Xv, i) {
    ((this.pagePixels = e), (this.tapSlop = t), (this.onPage = i));
  }
  pagePixels;
  tapSlop;
  onPage;
  pointer;
  startY = 0;
  steps = 0;
  moved = !1;
  isActive(e) {
    return this.pointer === e;
  }
  begin(e, t) {
    ((this.pointer = e),
      (this.startY = t),
      (this.steps = 0),
      (this.moved = !1));
  }
  move(e, t) {
    if (this.pointer !== e) return;
    const i = t - this.startY;
    Math.abs(i) >= this.tapSlop && (this.moved = !0);
    const r = Math.trunc(-i / this.pagePixels),
      s = r > this.steps ? 1 : -1;
    for (; this.steps !== r && this.onPage(s);) this.steps += s;
  }
  finish(e) {
    if (this.pointer !== e) return !1;
    const t = this.moved;
    return ((this.pointer = void 0), (this.steps = 0), (this.moved = !1), t);
  }
}
function HP(n, e, t, i) {
  const r = [];
  let s = "",
    o = 0;
  for (const a of e) {
    const c = ve(n, a, { family: i, size: 16 }).width;
    (o + c > t && (r.push(s), (s = ""), (o = 0)),
      !(s.length === 0 && a === " ") && ((s += a), (o += c)));
  }
  return (r.push(s), r);
}
function Wo(n, e, t = 0) {
  const i = { x: 0, y: 0, width: 1600, height: 900 },
    r = V0(n, i, e),
    s = V0(n, i, e, void 0, { width: r.width + 100, height: r.height + t }),
    o = E9(e, s),
    a = n.children.find((u) => T(u, "name") === "message"),
    c = n.children.find((u) => T(u, "name") === "icon"),
    l = V0(a, o);
  return {
    window: s,
    icon: V0(c, o),
    message: V0(a, o, void 0, void 0, {
      width: l.width + 100,
      height: l.height,
    }),
  };
}
function qP(n, e, t, i, r, s) {
  (C9(n, e.frame, e.frameImage, t.window),
    m9(n, i, f3(e.frame, t.window, e.captionOffset), {
      family: s,
      size: 20,
      color: "white",
      kind: "button",
      align: "center",
      verticalAlign: "center",
    }));
  const o = t.icon;
  n.drawImage(e.iconImage, o.x, o.y, o.width, o.height);
  const a = { family: s, size: 16 },
    c = ve(n, "", a).height,
    l = t.message.y + Math.max(0, (t.message.height - r.length * c) * 0.5);
  r.forEach((u, h) =>
    m9(
      n,
      u,
      { ...t.message, y: l + h * c, height: c },
      {
        ...a,
        color: "rgb(42, 55, 80)",
        kind: "label",
        align: "center",
        verticalAlign: "top",
      },
    ),
  );
}
class ds {
  canvas = document.createElement("canvas");
  context;
  resizeObserver;
  expiresAt = 0;
  active;
  onResize = () => this.paint();
  constructor(e) {
    const t = this.canvas.getContext("2d");
    if (!t) throw new Error("浏览器无法创建 P3528 通知窗口 Canvas。");
    ((this.context = t),
      Object.assign(this.canvas.style, {
        position: "absolute",
        pointerEvents: "auto",
      }),
      (this.canvas.dataset.uiLayer = "notice"),
      (this.canvas.hidden = !0),
      this.canvas.setAttribute("role", "status"),
      e.append(this.canvas),
      typeof ResizeObserver < "u" &&
        ((this.resizeObserver = new ResizeObserver(this.onResize)),
        this.resizeObserver.observe(e)),
      window.addEventListener("resize", this.onResize));
  }
  show(e, t, i, r = 1500) {
    (Object.assign(this.canvas.style, {
      left: `${(e.x / 1600) * 100}%`,
      top: `${(e.y / 900) * 100}%`,
      width: `${(e.width / 1600) * 100}%`,
      height: `${(e.height / 900) * 100}%`,
    }),
      (this.expiresAt = performance.now() + r),
      this.canvas.setAttribute("aria-label", t),
      (this.active = { rect: e, text: t, draw: i }),
      (this.canvas.hidden = !1),
      this.paint());
  }
  update(e) {
    e >= this.expiresAt && ((this.canvas.hidden = !0), (this.active = void 0));
  }
  dispose() {
    (this.resizeObserver?.disconnect(),
      window.removeEventListener("resize", this.onResize),
      (this.active = void 0),
      this.canvas.remove());
  }
  paint() {
    const e = this.active;
    if (!e || this.canvas.hidden) return;
    const t = this.canvas.getBoundingClientRect(),
      i = Sr(
        t.width,
        t.height,
        xe(),
        e.rect.width,
        e.rect.height,
        e.rect.width,
        e.rect.height,
      );
    (this.canvas.width !== i.width && (this.canvas.width = i.width),
      this.canvas.height !== i.height && (this.canvas.height = i.height),
      this.context.setTransform(1, 0, 0, 1, 0, 0),
      this.context.clearRect(0, 0, this.canvas.width, this.canvas.height),
      this.context.setTransform(
        i.scaleX,
        0,
        0,
        i.scaleY,
        -e.rect.x * i.scaleX,
        -e.rect.y * i.scaleY,
      ),
      (this.context.imageSmoothingEnabled = !1),
      e.draw(this.context));
  }
}
function KP(n) {
  if (n === 9) return "xun";
  if (Number.isInteger(n) && n >= 0 && n <= 8) return "classic";
}
function Ka0(n, e) {
  if (!(!Number.isInteger(e) || e < 1 || e > 5))
    return KP(n) === "xun" ? `tuning_mark_s_${e}` : "turning_enhancedBG";
}
function ja0(n) {
  return Number.isInteger(n) && n >= 1 && n <= 5 ? `+${n}` : void 0;
}
function Xa0(n, e, t) {
  return (e !== n && e !== void 0 && t?.playHover(), e);
}
function Mc(n, e) {
  n?.playClick();
}
function ep0(n, e, t = {}) {
  if (!e) return () => {};
  const i = (a) => {
      const l = a.target;
      if (!l?.closest) return;
      const u = l.closest("button,select,input,textarea,[role='button']");
      if (!u) return;
      const h = typeof a.composedPath == "function" ? a.composedPath() : [];
      return n.contains(u) || h.includes(u) ? u : void 0;
    },
    r = (a) => {
      for (let c = a; c; c = c.parentElement) {
        if (
          c.getAttribute("aria-disabled") === "true" ||
          c.inert ||
          ("disabled" in c && c.disabled)
        )
          return !0;
        if (c === n) break;
      }
      return !1;
    },
    s = (a) => {
      const c = i(a),
        l = t.isHoverAudible ?? t.isAudible;
      if (!c || (l !== void 0 && !l(c)) || r(c)) return;
      const u = a.relatedTarget;
      (u && c.contains(u)) || e.playHover();
    },
    o = (a) => {
      const c = i(a),
        l = t.isClickAudible ?? t.isAudible;
      !c || (l !== void 0 && !l(c)) || r(c) || e.playClick();
    };
  return (
    n.addEventListener("pointerover", s),
    n.addEventListener("click", o, !0),
    () => {
      (n.removeEventListener("pointerover", s),
        n.removeEventListener("click", o, !0));
    }
  );
}
function tp0(n) {
  return !(
    n.classList.contains("selected") ||
    n.getAttribute("aria-pressed") === "true" ||
    n.matches("input,textarea,.garage-part-preview") ||
    n.closest(".garage-x-cards") ||
    n.closest("[data-garage-catalog='search']")
  );
}
function np0(n) {
  return !n.matches(".garage-part-preview");
}
const Bn = 1600,
  Rn = 900,
  Ya0 = S7,
  Kg = Sa0;
function jP(n) {
  return (
    n !== "item" &&
    n !== "favorite" &&
    n !== "appearance" &&
    n !== "search" &&
    n !== "appearanceCancel"
  );
}
const G3 = "dialog.rho",
  In = "dialog/garageDialog",
  B3 = "gui_windowTemplate.rho",
  R3 = "gui_/windowTemplate",
  I3 = "gui_monocoque.rho",
  Za0 = "gui_font.rho",
  Qa0 = "etc_/baseStringBag.xml",
  Ja0 = "gui_/font/SourceHanSansCN-Bold.otf",
  Nn = "P3528 Source Han Sans CN Garage",
  e80 = [
    { key: "favoriteItem", category: "favorite" },
    { key: "lockedItem" },
    { key: "pcCafe" },
    { key: "kartBody", category: "kart" },
    { key: "character", category: "character" },
    { key: "equip", category: "equip" },
    { key: "useful" },
    { key: "deco", category: "deco" },
  ],
  hT = {
    equip: [
      { key: "whole", value: "whole" },
      { key: "headband", value: "headBand", kind: "headBand" },
      { key: "balloon", value: "balloon", kind: "balloon" },
      { key: "goggle", value: "goggle", kind: "goggle" },
      { key: "handGearL", value: "handGearL", kind: "handGearL" },
    ],
    deco: [
      { key: "whole", value: "whole" },
      { key: "aura", value: "aura", kind: "aura" },
      { key: "paint", value: "paint", kind: "color" },
      { key: "dye", value: "dye", kind: "dye" },
      { key: "skidMark", value: "skidMark", kind: "skidMark" },
      { key: "plate", value: "plate", kind: "plate" },
    ],
  };
class C7 {
  constructor(e, t) {
    ((this.options = e),
      (this.assets = t),
      (this.drawing = new Ma0(this.canvas)),
      (this.context = this.drawing.context),
      (this.windows = sF(t.definition, t.frames)),
      (this.scroll = new b6((s) => {
        ((this.offset = s * i4(t.grid)), this.render());
      })),
      (this.draftProfile = aT(
        e.profile,
        e.selectedKartItemId,
        e.selectedCharacterItemId,
        e.selectedKartSystemKey,
      )));
    const i = of(e.selectedKartSystemKey),
      r = t80(e.selectedKartPath);
    (i && r && xw(i.key, r) && this.legacyAppearance.set(i.key, r),
      this.prepareElements(),
      (this.element.className = "client-dialog"),
      (this.element.dataset.uiLayer = "dialog"),
      (this.element.hidden = !0),
      this.element.append(this.canvas, this.search),
      e.root.append(this.element),
      (this.resizeObserver = new ResizeObserver(() => this.render())),
      this.resizeObserver.observe(e.root),
      window.addEventListener("resize", this.onWindowResize),
      E7.load(
        e.library,
        e.environment,
        e.stageBinding,
        () => this.render(),
        yl(t.cardDefinition, { x: 0, y: 0, width: 0, height: 0 }),
        this.rect("charKartPreview"),
      )
        .then((s) => {
          this.disposed ? s.dispose() : ((this.livePanels = s), this.render());
        })
        .catch(() => {}));
  }
  options;
  assets;
  element = document.createElement("div");
  canvas = document.createElement("canvas");
  search = document.createElement("input");
  context;
  drawing;
  resizeObserver;
  renderPixelRatio = 1;
  onWindowResize = () => this.render();
  category = "favorite";
  subCategory = "whole";
  draftProfile;
  hits = [];
  offset = 0;
  hovered;
  pressed;
  shown = !1;
  disposed = !1;
  frozen = !1;
  animationFrame = 0;
  searchQuery = "";
  searchState = 0;
  searchTooltipVisible = !1;
  livePanels;
  previewPointer;
  previewPointerX = 0;
  scrollPointer;
  scroll;
  touchSwipe = new WP(jv, Xv, (e) => this.scroll.wheel(e));
  windows;
  appearanceDialog;
  legacyAppearance = new Map();
  favoriteKeyCache;
  static async load(e) {
    (pT(e.catalog.karts, e.selectedKartItemId, e.selectedKartSystemKey),
      cf(e.catalog.characters, e.selectedCharacterItemId, "人物"));
    const t = await u80(e.library);
    try {
      return new C7(e, t);
    } catch (i) {
      throw i;
    }
  }
  show() {
    this.disposed ||
      ((this.frozen = !1),
      (this.shown = !0),
      (this.element.hidden = !1),
      this.showEmptyFavoriteNotice(),
      (this.canvas.hidden = !1),
      (this.search.hidden = !1),
      window.addEventListener("keydown", this.onKeyDown),
      this.render(),
      (this.animationFrame = requestAnimationFrame(this.onAnimationFrame)),
      this.canvas.focus());
  }
  freeze() {
    this.disposed ||
      ((this.frozen = !0),
      cancelAnimationFrame(this.animationFrame),
      (this.element.style.pointerEvents = "none"));
  }
  unfreeze() {
    this.disposed ||
      ((this.frozen = !1),
      (this.element.style.pointerEvents = "auto"),
      this.render(),
      (this.animationFrame = requestAnimationFrame(this.onAnimationFrame)));
  }
  dispose() {
    this.disposed ||
      ((this.disposed = !0),
      cancelAnimationFrame(this.animationFrame),
      this.scroll.dispose(),
      this.resizeObserver.disconnect(),
      window.removeEventListener("resize", this.onWindowResize),
      window.removeEventListener("keydown", this.onKeyDown),
      this.canvas.removeEventListener("pointermove", this.onPointerMove),
      this.canvas.removeEventListener("pointerdown", this.onPointerDown),
      this.canvas.removeEventListener("pointerup", this.onPointerUp),
      this.canvas.removeEventListener("pointercancel", this.onPointerCancel),
      this.canvas.removeEventListener("pointerleave", this.onPointerLeave),
      this.canvas.removeEventListener("wheel", this.onWheel),
      this.search.removeEventListener("keydown", this.onSearchKeyDown),
      this.search.removeEventListener("pointerdown", this.onSearchPointerDown),
      this.search.removeEventListener("pointermove", this.onSearchPointerMove),
      this.search.removeEventListener(
        "pointerleave",
        this.onSearchPointerLeave,
      ),
      this.canvas.remove(),
      this.search.remove(),
      this.drawing.dispose(),
      this.element.remove(),
      this.livePanels?.dispose());
  }
  prepareElements() {
    (Object.assign(this.canvas.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      imageRendering: "pixelated",
      pointerEvents: "auto",
    }),
      (this.canvas.hidden = !0),
      (this.canvas.tabIndex = 0),
      this.canvas.setAttribute("role", "dialog"),
      this.canvas.setAttribute("aria-label", this.text("itemTitle")),
      (this.search.className = "window-edit"),
      Object.assign(this.search.style, {
        position: "absolute",
        boxSizing: "border-box",
        border: "0",
        outline: "0",
        background: "transparent",
        color: "rgb(223, 223, 223)",
        font: `16px "${Nn}"`,
        padding: "0",
      }),
      (this.search.hidden = !0),
      (this.search.maxLength = Number(
        T(Ae(this.assets.definition, "searchEdit"), "maxChar"),
      )),
      (this.search.spellcheck = !1),
      (this.search.autocomplete = "off"),
      this.search.setAttribute("aria-label", this.text("searchTooltip")),
      this.canvas.addEventListener("pointermove", this.onPointerMove),
      this.canvas.addEventListener("pointerdown", this.onPointerDown),
      this.canvas.addEventListener("pointerup", this.onPointerUp),
      this.canvas.addEventListener("pointercancel", this.onPointerCancel),
      this.canvas.addEventListener("pointerleave", this.onPointerLeave),
      this.canvas.addEventListener("wheel", this.onWheel, { passive: !1 }),
      this.search.addEventListener("keydown", this.onSearchKeyDown),
      this.search.addEventListener("pointerdown", this.onSearchPointerDown),
      this.search.addEventListener("pointermove", this.onSearchPointerMove),
      this.search.addEventListener("pointerleave", this.onSearchPointerLeave));
  }
  render() {
    if (!this.shown || this.disposed) return;
    (this.resizeCanvas(),
      this.drawing.beginFrame(),
      this.context.clearRect(0, 0, Bn, Rn),
      (this.context.imageSmoothingEnabled = !0),
      (this.hits = []));
    const e = this.rect("captionDlgFrame"),
      t = this.liveCards(),
      i = this.selectedKart(),
      r = cf(
        this.options.catalog.characters,
        this.draftProfile.equipment.itemIds[1],
        "人物",
      );
    (this.livePanels?.render(
      performance.now(),
      Bn,
      Rn,
      t,
      this.rect("charKartPreview"),
      i,
      r,
      this.draftProfile,
      void 0,
      !0,
      this.renderPixelRatio,
      this.drawing,
    ),
      (this.context.fillStyle = "rgba(0, 0, 0, 0.392)"),
      this.context.fillRect(0, 0, Bn, Rn));
    const s = this.assets.frames.get("BigCaptionDialog");
    (C9(this.context, s, this.assets.caption.image, e),
      kn(
        this.context,
        this.text("itemTitle"),
        f3(s, e, this.assets.captionOffset),
        20,
        "white",
        "center",
        "button",
      ),
      this.drawPreview(),
      this.drawItemBox(),
      this.drawButtons(),
      this.drawCloseButton(),
      this.positionSearch(),
      this.appearanceDialog && this.drawAppearanceDialog(),
      this.drawing.endFrame(),
      (this.canvas.style.cursor =
        this.hovered === void 0 ? "default" : "pointer"));
  }
  drawPreview() {
    const e = this.rect("previewWindow");
    (uf(this.context, this.assets.previewBackground, e),
      this.livePanels?.drawPreview(this.context, this.rect("charKartPreview")),
      uf(this.context, this.assets.previewFrame, e));
  }
  drawItemBox() {
    const e = this.rect("itemBox");
    ((this.context.fillStyle = "rgb(160, 170, 184)"),
      this.context.fillRect(e.x, e.y, e.width, e.height),
      C9(
        this.context,
        this.assets.frames.get("TabBoxLarge"),
        this.assets.frame02.image,
        this.rect("itemCatTabHolder"),
      ),
      this.drawTopTabs(),
      this.drawSubTabs(),
      this.drawItems(),
      this.drawSearch());
  }
  drawTopTabs() {
    const e = E9(
        this.assets.frames.get("TabBoxLarge"),
        this.rect("itemCatTabHolder"),
      ),
      t = V0(
        this.assets.tabDefinition,
        e,
        this.assets.tabStyle.states[0].frame,
      );
    let i = Number(
      T(Ae(this.assets.definition, "tabMarginCont"), "adjust").split(" ")[0],
    );
    e80.forEach((r) => {
      const s = this.text(r.key),
        o = { ...t, x: t.x + i, width: this.tabTextWidth(s) + 40 };
      i += o.width;
      const a = `category:${r.category ?? r.key}`,
        c = r.category === this.category,
        l = this.tabState(a, c),
        u = this.assets.tabStyle.states[l];
      (C9(this.context, u.frame, this.assets.frame02.image, o),
        kn(
          this.context,
          s,
          E9(u.frame, o),
          Number(u.textRender.replace("bold", "")),
          u.textColor,
          "center",
          "button",
        ),
        r.category &&
          !c &&
          this.addHit({ id: a, kind: "category", value: r.category, rect: o }));
    });
  }
  drawSubTabs() {
    const e = this.subTabs(),
      t = V0(
        this.assets.subTabDefinition,
        this.rect("itemSubCatHolder"),
        this.assets.subTabStyle.states[0].frame,
      ),
      i = Number(
        T(Ae(this.assets.definition, "subTabMarginCont"), "adjust").split(
          " ",
        )[0],
      );
    let r = 0;
    e.forEach((s) => {
      const o = this.text(s.key),
        a = { ...t, x: t.x + r, width: this.tabTextWidth(o) + i };
      r += a.width;
      const c = `sub:${s.value}`,
        l = s.value === this.subCategory,
        u = this.tabState(c, l),
        h = this.assets.subTabStyle.states[u];
      (C9(this.context, h.frame, this.assets.frame01.image, a),
        kn(
          this.context,
          o,
          E9(h.frame, a),
          Number(h.textRender.replace("bold", "")),
          h.textColor,
          "center",
          "button",
        ),
        l ||
          this.addHit({ id: c, kind: "subCategory", value: s.value, rect: a }));
    });
  }
  tabTextWidth(e) {
    return ve(this.context, e, { family: Nn, size: 16 }).width;
  }
  tabState(e, t) {
    return t ? 3 : st(e, this.hovered, this.pressed);
  }
  drawItems() {
    const e = this.filteredItems(),
      t = this.itemGrid(e.length);
    t.cells.forEach((r, s) => {
      const o = e[t.firstItem + s];
      (this.addHit({ id: sf(o), kind: "item", value: o, rect: r }),
        this.drawCard(o, r));
    });
    const i = this.scroll.layout(
      this.assets.scrollbar,
      this.rect("itemListBar"),
      t.positionCount,
      this.offset / i4(this.assets.grid),
    );
    t.positionCount > 1 &&
      Kv(
        this.context,
        this.assets.scrollbar,
        this.assets.frame01.image,
        i,
        this.scroll.buttonState,
      );
  }
  showEmptyFavoriteNotice() {
    this.category !== "favorite" ||
      this.filteredItems().length > 0 ||
      this.showFavoriteNotice("favoriteItemNone");
  }
  showFavoriteNotice(e, t) {
    const i = this.assets.frames.get("CaptionDialog"),
      r = Wo(this.assets.noticeDefinition, i).window,
      s = t === void 0 ? this.text(e) : this.text(e).replace("%s", t);
    this.options.onNotice(r, s, (o) => this.drawNotice(o, s));
  }
  drawNotice(e, t) {
    const i = this.assets.frames.get("CaptionDialog"),
      r = {
        definition: this.assets.noticeDefinition,
        frame: i,
        frameImage: this.assets.frame01.image,
        iconImage: this.assets.noticeIcon.image,
        captionOffset: this.assets.noticeCaptionOffset,
      },
      s = Wo(r.definition, i);
    qP(e, r, s, this.text("notice"), [t], Nn);
  }
  drawCard(e, t) {
    const i =
        e.itemId === this.draftProfile.equipment.itemIds[Ya0[e.kind]] &&
        (e.kind !== "kart" ||
          e.itemId !== 0 ||
          e.systemKey === this.draftProfile.equipment.systemKart),
      r =
        e.kind === "kart" && e.vehicleRarityLevel !== void 0
          ? this.assets.qualityCards.get(e.vehicleRarityLevel)
          : void 0,
      s = r ?? (i ? this.assets.selectedCard : this.assets.card),
      o = this.hovered === sf(e);
    (m80(
      this.context,
      s,
      {
        x: r ? Ca0(r.width, o) : o ? 0 : t.width,
        y: 0,
        width: t.width,
        height: t.height,
      },
      t,
    ),
      this.drawCardTitle(e, t),
      this.livePanels?.drawCard(
        this.context,
        e,
        yl(this.assets.cardDefinition, t),
      ),
      this.drawKartLevelBadge(e, t),
      i &&
        C9(
          this.context,
          this.assets.selectedFrame,
          this.assets.frame01.image,
          t,
        ),
      this.drawFavoriteCheck(e, t));
  }
  drawFavoriteCheck(e, t) {
    const i = this.favoriteKey(e);
    if (i === void 0) return;
    const r = V0(Ae(this.assets.cardDefinition, "favoriteItemCheck"), t),
      s = this.favoriteKeys().has(i);
    (ct(this.context, this.assets.favoriteMark[s ? 1 : 0], r),
      this.addHit({
        id: `favorite:${sf(e)}`,
        kind: "favorite",
        value: e,
        rect: r,
      }));
  }
  favoriteKey(e) {
    const t = Jd(e);
    return t === void 0 || !wl(t) ? void 0 : Q3(ef(t));
  }
  favoriteKeys() {
    const e = this.draftProfile.favoriteItems;
    return (
      this.favoriteKeyCache?.source !== e &&
        (this.favoriteKeyCache = { source: e, keys: sT(e) }),
      this.favoriteKeyCache.keys
    );
  }
  toggleFavoriteItem(e) {
    const t = Jd(e);
    if (t === void 0 || !wl(t)) return;
    const i = ef(t),
      r = Q3(i),
      s = this.draftProfile.favoriteItems,
      o = s.some((c) => Q3(c) === r);
    if (!o && s.length >= qg) {
      this.showFavoriteNotice("favoriteItemOver");
      return;
    }
    const a = o ? s.filter((c) => Q3(c) !== r) : [...s, i];
    ((this.draftProfile = { ...this.draftProfile, favoriteItems: a }),
      this.options.onFavoriteChange(a),
      this.showFavoriteNotice(
        o ? "favoriteItemDeleted" : "favoriteItemAdded",
        e.title,
      ),
      this.category === "favorite" && this.clampFavoriteOffset(),
      this.render());
  }
  clampFavoriteOffset() {
    const e = this.itemGrid(this.filteredItems().length).positionCount,
      t = i4(this.assets.grid);
    this.offset = Math.min(this.offset, Math.max(0, (e - 1) * t));
  }
  drawKartLevelBadge(e, t) {
    if (e.kind !== "kart") return;
    const i =
        e.itemId === this.draftProfile.equipment.itemIds[3]
          ? this.draftProfile.equipment.kartSerial
          : 0,
      r = p5(this.draftProfile.garage, e.itemId, i).progression,
      s = r?.level,
      o = KP(e.engineGrade),
      a = Ka0(e.engineGrade, s);
    if (!o || !a || !r || r.kind !== o) return;
    const c =
      o === "xun"
        ? this.assets.xunLevelBadges.get(s)
        : this.assets.levelBackground;
    if (!c) return;
    const l = t.x + t.width - (o === "xun" ? 12 : 10) - c.width,
      u = t.y + (o === "xun" ? 47 : 46);
    if ((this.context.drawImage(c.image, l, u), o === "classic")) {
      const h = ja0(s);
      if (!h) return;
      m9(
        this.context,
        h,
        { x: l, y: u, width: c.width, height: c.height },
        {
          family: Nn,
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
  drawCardTitle(e, t) {
    const i =
        e.kind === "kart" && e.vehicleRarityLevel === 6
          ? "ultimateNameLabel"
          : "itemNameLabel",
      r = Ae(this.assets.cardDefinition, i),
      s = Number(T(r, "textRender").replace("bold", "")),
      [o, a, c, l] = T(r, "textColor").split(/\s+/).map(Number),
      u = { family: Nn, size: s },
      h = V0(Ae(this.assets.cardDefinition, "itemNameContainer"), t),
      d = V0(r, h, void 0, void 0, ve(this.context, e.title, u));
    m9(this.context, e.title, d, {
      ...u,
      kind: "label",
      color: `rgba(${a}, ${c}, ${l}, ${o / 255})`,
      align: "left",
      verticalAlign: "top",
    });
  }
  liveCards() {
    const e = this.filteredItems(),
      t = this.itemGrid(e.length);
    return t.cells.map((i, r) => {
      const s = e[t.firstItem + r];
      return {
        item: s,
        kartShadow: s.kind === "kart" ? !0 : void 0,
        rect: yl(this.assets.cardDefinition, i),
      };
    });
  }
  drawSearch() {
    const e = this.rect("searchBtn"),
      t = this.searchState === 5 ? 0 : this.searchState;
    (uf(this.context, this.assets.search[t], e),
      this.addHit({
        id: "search",
        kind: "search",
        rect: { x: e.x, y: e.y, width: 30, height: e.height },
      }),
      this.drawSearchTooltip());
  }
  drawSearchTooltip() {
    if (!this.searchTooltipVisible) return;
    const e = this.text("searchTooltip"),
      t = { family: Nn, size: 14 },
      i = this.assets.frames.get("DefaultTooltipNew"),
      r = rF(
        Ae(this.assets.definition, "searchEditTooltip"),
        this.rect("searchBtn"),
        i,
        ve(this.context, e, t),
      );
    (C9(this.context, i, this.assets.searchTooltipFrame.image, r),
      m9(this.context, e, E9(i, r), {
        ...t,
        kind: "label",
        color: "white",
        align: "left",
        verticalAlign: "top",
      }));
  }
  drawCloseButton() {
    const e = this.assets.frames.get("BigCaptionDialog"),
      t = V0(this.assets.closeDefinition, E9(e, this.rect("captionDlgFrame"))),
      i = st("close", this.hovered, this.pressed);
    (ct(this.context, this.assets.close[i], t),
      this.addHit({ id: "close", kind: "confirm", rect: t }));
  }
  drawButtons() {
    (this.drawTextButton("confirm", this.text("ok"), this.rect("ok")),
      this.drawTextButton("cancel", this.text("cancel"), this.rect("cancel")));
  }
  drawTextButton(e, t, i) {
    const r = e,
      s = st(r, this.hovered, this.pressed) + 1,
      o = this.assets.buttonStyles.get(e === "confirm" ? "ok" : "cancel")
        .states[s - 1];
    (C9(this.context, o.frame, this.assets.buttonFrame.image, i),
      kn(
        this.context,
        t,
        E9(o.frame, i),
        Number(o.textRender.replace("bold", "")),
        o.textColor,
        "center",
        "button",
      ),
      this.addHit({ id: r, kind: e, rect: i }));
  }
  drawAppearanceDialog() {
    const e = this.appearanceDialog;
    if (!e) return;
    const t = { x: 490, y: 282, width: 620, height: 300 };
    ((this.context.fillStyle = "rgba(0, 0, 0, 0.58)"),
      this.context.fillRect(0, 0, Bn, Rn),
      this.addHit({
        id: "appearance:cancel",
        kind: "appearanceCancel",
        rect: { x: 0, y: 0, width: 1600, height: 900 },
      }));
    const i = this.assets.frames.get("CaptionDialog");
    (C9(this.context, i, this.assets.frame01.image, t),
      kn(
        this.context,
        `${e.family.title} · 等级外观`,
        { x: t.x + 24, y: t.y + 10, width: t.width - 48, height: 34 },
        20,
        "white",
        "center",
        "button",
      ),
      kn(
        this.context,
        "仅切换模型外观；车辆身份与性能参数保持不变",
        { x: t.x + 24, y: t.y + 62, width: t.width - 48, height: 30 },
        15,
        "rgb(210, 225, 241)",
        "center",
        "button",
      ));
    const r = { rookie: "Rookie", l3: "L3", l2: "L2", l1: "L1" };
    (e.family.states.forEach((s, o) => {
      const a = { x: t.x + 48 + o * 132, y: t.y + 112, width: 116, height: 48 };
      this.drawAppearanceButton(
        `appearance:${s.level}`,
        r[s.level],
        a,
        s.level,
      );
    }),
      this.drawAppearanceCancelButton({
        x: t.x + 237,
        y: t.y + 218,
        width: 146,
        height: 48,
      }));
  }
  drawAppearanceButton(e, t, i, r) {
    const s = st(e, this.hovered, this.pressed) + 1,
      o = this.assets.buttonStyles.get("ok").states[s - 1];
    (C9(this.context, o.frame, this.assets.buttonFrame.image, i),
      kn(
        this.context,
        t,
        E9(o.frame, i),
        Number(o.textRender.replace("bold", "")),
        o.textColor,
        "center",
        "button",
      ),
      this.addHit({ id: e, kind: "appearance", value: r, rect: i }));
  }
  drawAppearanceCancelButton(e) {
    const t = "appearance:cancel-button",
      i = st(t, this.hovered, this.pressed) + 1,
      r = this.assets.buttonStyles.get("cancel").states[i - 1];
    (C9(this.context, r.frame, this.assets.buttonFrame.image, e),
      kn(
        this.context,
        this.text("cancel"),
        E9(r.frame, e),
        Number(r.textRender.replace("bold", "")),
        r.textColor,
        "center",
        "button",
      ),
      this.addHit({ id: t, kind: "appearanceCancel", rect: e }));
  }
  subTabs() {
    return this.category === "kart"
      ? [
          { key: "whole", value: "whole" },
          { key: "itemKart", value: "itemKart" },
          { key: "speedkart", value: "speedkart" },
          { key: "legacyMuseum", value: "legacyMuseum" },
        ]
      : this.category === "character"
        ? [
            { key: "whole", value: "whole" },
            { key: "character", value: "character" },
            { key: "pet", value: "pet" },
            { key: "flyingPet", value: "flyingPet" },
          ]
        : this.category === "equip" || this.category === "deco"
          ? hT[this.category]
          : [{ key: "whole", value: "whole" }];
  }
  filteredItems() {
    const e = this.categoryItems(),
      t = this.searchQuery.split(" ").filter(Boolean).map(fT);
    return t.length === 0
      ? e
      : e.filter((i) => {
          const r = fT(i.title);
          return t.every((s) => r.includes(s));
        });
  }
  categoryItems() {
    if (this.category === "favorite") return this.favoriteCategoryItems();
    if (this.category === "deco" || this.category === "equip")
      return this.decorationItems();
    if (this.category === "character") {
      const t = this.options.catalog.equipment.filter(
        (i) => i.kind === "flyingPet",
      );
      return this.subCategory === "flyingPet"
        ? t
        : this.subCategory === "pet"
          ? []
          : this.subCategory === "character"
            ? this.options.catalog.characters
            : [...this.options.catalog.characters, ...t];
    }
    const e = this.options.catalog.karts.filter((t) => !n3(t.itemId));
    return this.subCategory === "itemKart"
      ? e.filter((t) => t.kartType === 1)
      : this.subCategory === "speedkart"
        ? e.filter((t) => t.kartType === 2)
        : this.subCategory === "legacyMuseum"
          ? e.filter((t) => t.identityClass === "legacy-system-family")
          : e.filter((t) => t.identityClass !== "legacy-system-family");
  }
  allCategoryItems() {
    return [
      ...this.options.catalog.karts.filter((e) => !n3(e.itemId)),
      ...this.options.catalog.characters,
      ...this.options.catalog.equipment,
    ];
  }
  favoriteCategoryItems() {
    const e = sT(this.draftProfile.favoriteItems);
    return e.size === 0
      ? []
      : this.allCategoryItems().filter((t) => {
          const i = Jd(t);
          return i !== void 0 && wl(i) && e.has(Q3(ef(i)));
        });
  }
  decorationItems() {
    if (this.category !== "equip" && this.category !== "deco") return [];
    const e = hT[this.category],
      t = new Set(e.flatMap((r) => (r.kind ? [r.kind] : []))),
      i = e.find((r) => r.value === this.subCategory)?.kind;
    return this.options.catalog.equipment.filter(
      (r) => t.has(r.kind) && (i === void 0 || r.kind === i),
    );
  }
  selectCategory(e) {
    ((this.category = e),
      (this.subCategory = "whole"),
      (this.offset = 0),
      this.scroll.reset(),
      this.livePanels?.resetPreviewRotation(!1),
      e === "favorite" && this.showEmptyFavoriteNotice(),
      this.clearSearch(),
      this.render());
  }
  selectSubCategory(e) {
    ((this.subCategory = e),
      (this.offset = 0),
      this.scroll.reset(),
      this.livePanels?.resetPreviewRotation(!1),
      this.clearSearch(),
      this.render());
  }
  selectItem(e) {
    if (e.kind === "kart") {
      if (n3(e.itemId)) return;
      const t = of(e.systemKey);
      if (t) {
        ((this.appearanceDialog = { item: e, family: t }), this.render());
        return;
      }
    }
    this.commitItem(e);
  }
  commitItem(e) {
    e.kind === "kart" && j6(e.itemId);
    const { itemIds: t } = this.draftProfile.equipment;
    ("category" in e
      ? this.selectDecoration(e)
      : (this.draftProfile = aT(
          this.draftProfile,
          e.kind === "kart" ? e.itemId : t[3],
          e.kind === "character" ? e.itemId : t[1],
          e.kind === "kart"
            ? e.systemKey
            : this.draftProfile.equipment.systemKart,
          e.kind === "kart" && of(e.systemKey) ? e.internalId : void 0,
        )),
      this.livePanels?.resetPreviewRotation(e.kind === "plate"),
      this.render());
  }
  selectDecoration(e) {
    const t = this.draftProfile.equipment,
      i = t.itemIds[e.category],
      r =
        e.kind === "color" || e.kind === "dye"
          ? e.itemId
          : i === e.itemId
            ? 0
            : e.itemId;
    this.draftProfile = {
      ...this.draftProfile,
      equipment: { ...t, itemIds: { ...t.itemIds, [e.category]: r } },
    };
  }
  confirm() {
    const e = this.selectedKart(),
      t = cf(
        this.options.catalog.characters,
        this.draftProfile.equipment.itemIds[1],
        "人物",
      );
    this.options.onConfirm({
      kart: e,
      character: t,
      equipment: this.draftProfile.equipment,
    });
  }
  activate(e) {
    if (e.kind === "appearanceCancel") {
      ((this.appearanceDialog = void 0), this.render());
      return;
    }
    if (e.kind === "appearance") {
      this.selectLegacyAppearance(e.value);
      return;
    }
    if (e.kind === "cancel") return this.options.onCancel();
    if (e.kind === "confirm") return this.confirm();
    if (e.kind === "category") return this.selectCategory(e.value);
    if (e.kind === "subCategory") return this.selectSubCategory(e.value);
    if (e.kind === "favorite") return this.toggleFavoriteItem(e.value);
    if (e.kind === "search") return this.activateSearch();
    this.selectItem(e.value);
  }
  selectedKart() {
    const e = pT(
        this.options.catalog.karts,
        this.draftProfile.equipment.itemIds[3],
        this.draftProfile.equipment.systemKart,
      ),
      t = e.systemKey ? this.legacyAppearance.get(e.systemKey) : void 0;
    return t ? { ...e, internalId: t, path: `kart_/${t}/model.1s` } : e;
  }
  selectLegacyAppearance(e) {
    const t = this.appearanceDialog;
    if (!t) return;
    const i = t.family.states.find((r) => r.level === e);
    if (!i) throw new Error(`${t.family.key} 缺少 ${e} 外观。`);
    (this.legacyAppearance.set(t.family.key, i.resource),
      (this.appearanceDialog = void 0),
      this.commitItem({
        ...t.item,
        internalId: i.resource,
        path: `kart_/${i.resource}/model.1s`,
      }));
  }
  text(e) {
    if (e === "legacyMuseum") return "经典测试";
    if (e === "pet") return this.assets.strings.get(e) ?? "宠物";
    const t = this.assets.strings.get(e);
    if (t === void 0)
      throw new Error(`P3528 GarageDialog 缺少 StringBag key：${e}。`);
    return t;
  }
  resizeCanvas() {
    const e = this.options.root.getBoundingClientRect(),
      t = p3(
        this.canvas,
        this.context,
        e.width,
        e.height,
        xe(),
        Bn,
        Rn,
        1600,
        900,
      );
    this.renderPixelRatio = t.scaleX;
  }
  rect(e) {
    const t = this.windows.get(e);
    if (!t) throw new Error(`P3528 GarageDialog 缺少布局节点：${e}。`);
    return t;
  }
  itemGrid(e) {
    const t = this.rect("itemList"),
      i = V0(this.assets.cardDefinition, t);
    return $P(this.assets.grid, t, i, e, this.offset / i4(this.assets.grid));
  }
  positionSearch() {
    const e = this.rect("searchEdit"),
      t = this.options.root.getBoundingClientRect(),
      i = t.width / Bn,
      r = t.height / Rn;
    aw(this.search, e, i, r);
  }
  clearSearch() {
    ((this.search.value = ""),
      (this.searchQuery = ""),
      (this.searchState = 0),
      (this.searchTooltipVisible = !1),
      this.search.blur());
  }
  addHit(e) {
    this.hits.push(e);
  }
  hitAt(e) {
    const t = this.canvas.getBoundingClientRect(),
      i = ((e.clientX - t.left) * Bn) / t.width,
      r = ((e.clientY - t.top) * Rn) / t.height;
    return [
      ...(this.appearanceDialog
        ? this.hits.filter(
            (o) => o.kind === "appearance" || o.kind === "appearanceCancel",
          )
        : this.hits),
    ]
      .reverse()
      .find((o) => Oe(i, r, o.rect));
  }
  onPointerMove = (e) => {
    if (
      ((this.searchTooltipVisible = !1), this.touchSwipe.isActive(e.pointerId))
    ) {
      this.touchSwipe.move(e.pointerId, e.clientY);
      return;
    }
    if (e.pointerId === this.scrollPointer) {
      this.scroll.move(this.eventPoint(e), (e.buttons & 1) !== 0);
      return;
    }
    if (e.pointerId === this.previewPointer) {
      const s = this.eventPoint(e);
      (this.livePanels?.rotatePreview(s.x - this.previewPointerX),
        (this.previewPointerX = s.x),
        this.render());
      return;
    }
    const t = this.hitAt(e),
      i = t?.id;
    if ((this.moveSearchButton(i), i === this.hovered)) return;
    const r = !jP(t?.kind);
    ((this.hovered = Xa0(
      this.hovered,
      i,
      this.options.onHover && !r && i !== "appearance:cancel"
        ? { playHover: this.options.onHover }
        : void 0,
    )),
      this.render());
  };
  onPointerDown = (e) => {
    if (e.button !== 0) return;
    const t = this.eventPoint(e),
      i = this.hitAt(e);
    (this.pressSearchButton(i),
      !this.beginScroll(e, t) &&
        (this.beginTouchSwipe(e, t) ||
          this.beginPreviewDrag(e, t) ||
          (i && this.beginButtonPress(i, e))));
  };
  beginButtonPress(e, t) {
    (this.options.onInteraction?.(),
      (this.pressed = e.id),
      (this.hovered = e.id),
      this.canvas.setPointerCapture(t.pointerId),
      e.kind === "item"
        ? (Mc(
            this.options.onActivate
              ? { playClick: this.options.onActivate }
              : void 0,
          ),
          this.selectItem(e.value))
        : this.render());
  }
  onPointerUp = (e) => {
    if (this.touchSwipe.isActive(e.pointerId)) return this.finishTouchSwipe(e);
    if (this.endScroll(e)) return;
    if (e.pointerId === this.previewPointer) {
      ((this.previewPointer = void 0),
        this.livePanels?.resetPreviewRotation(),
        this.releasePointer(e),
        this.render());
      return;
    }
    const t = this.releasedButton(e);
    ((this.pressed = void 0),
      this.releasePointer(e),
      t
        ? (Mc(
            t.id === "appearance:cancel"
              ? void 0
              : this.options.onActivate
                ? { playClick: this.options.onActivate }
                : void 0,
          ),
          this.activate(t))
        : this.render());
  };
  releasedButton(e) {
    const t = this.hitAt(e);
    if (t && t.id === this.pressed) return t.kind === "item" ? void 0 : t;
  }
  onPointerCancel = (e) => {
    if (this.touchSwipe.isActive(e.pointerId)) {
      (this.touchSwipe.finish(e.pointerId),
        this.releasePointer(e),
        this.render());
      return;
    }
    this.endScroll(e) ||
      (e.pointerId === this.previewPointer &&
        ((this.previewPointer = void 0),
        this.livePanels?.resetPreviewRotation()),
      (this.pressed = void 0),
      this.moveSearchButton(void 0),
      this.releasePointer(e),
      this.render());
  };
  onPointerLeave = () => {
    (this.scroll.leave(),
      (this.hovered = void 0),
      this.moveSearchButton(void 0),
      this.render());
  };
  onWheel = (e) => {
    if (this.appearanceDialog || e.deltaY === 0) return;
    const t = this.eventPoint(e);
    this.insideItemScroll(t) &&
      this.scroll.wheel(e.deltaY > 0 ? 1 : -1) &&
      e.preventDefault();
  };
  insideItemScroll(e) {
    return ["itemSelect", "itemListBar"].some((t) =>
      Oe(e.x, e.y, this.rect(t)),
    );
  }
  beginPreviewDrag(e, t) {
    return e.button !== 0 || !Oe(t.x, t.y, this.rect("charKartPreview"))
      ? !1
      : (this.options.onInteraction?.(),
        (this.previewPointer = e.pointerId),
        (this.previewPointerX = t.x),
        this.canvas.setPointerCapture(e.pointerId),
        !0);
  }
  beginScroll(e, t) {
    return e.button !== 0 || !this.scroll.down(t)
      ? !1
      : (this.options.onInteraction?.(),
        (this.scrollPointer = e.pointerId),
        this.canvas.setPointerCapture(e.pointerId),
        !0);
  }
  beginTouchSwipe(e, t) {
    return e.pointerType !== "touch" || !this.insideItemScroll(t)
      ? !1
      : (this.options.onInteraction?.(),
        this.touchSwipe.begin(e.pointerId, e.clientY),
        this.canvas.setPointerCapture(e.pointerId),
        !0);
  }
  finishTouchSwipe(e) {
    const t = this.touchSwipe.finish(e.pointerId);
    if ((this.releasePointer(e), t)) return this.render();
    const i = this.hitAt(e);
    i ? this.activate(i) : this.render();
  }
  endScroll(e) {
    return e.pointerId !== this.scrollPointer
      ? !1
      : ((this.scrollPointer = void 0),
        this.scroll.up(),
        this.releasePointer(e),
        !0);
  }
  releasePointer(e) {
    this.canvas.hasPointerCapture(e.pointerId) &&
      this.canvas.releasePointerCapture(e.pointerId);
  }
  eventPoint(e) {
    const t = this.canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - t.left) * Bn) / t.width,
      y: ((e.clientY - t.top) * Rn) / t.height,
    };
  }
  onSearchKeyDown = (e) => {
    e.key !== "Enter" ||
      e.isComposing ||
      (e.preventDefault(),
      this.options.onInteraction?.(),
      Mc(
        this.options.onActivate
          ? { playClick: this.options.onActivate }
          : void 0,
      ),
      this.commitSearch());
  };
  commitSearch() {
    ((this.searchQuery = this.search.value),
      (this.offset = 0),
      this.scroll.reset(),
      this.livePanels?.resetPreviewRotation(),
      this.render());
  }
  moveSearchButton(e) {
    if (e !== "search") {
      this.searchState !== 1 && (this.searchState = 0);
      return;
    }
    this.searchState === 0 && (this.searchState = 5);
  }
  pressSearchButton(e) {
    e?.kind === "search"
      ? (this.searchState = this.searchState === 1 ? 3 : 2)
      : ((this.searchState = 0), (this.searchTooltipVisible = !1));
  }
  activateSearch() {
    const e = this.searchState === 3;
    if (this.searchState !== 2 && !e) return this.render();
    ((this.searchState = 1),
      this.search.focus(),
      e ? this.commitSearch() : this.render());
  }
  toggleSearchFocus() {
    ((this.searchState = this.searchState === 1 ? 0 : 1),
      this.searchState === 1 ? this.search.focus() : this.search.blur(),
      this.render());
  }
  onSearchPointerDown = (e) => {
    e.button === 0 &&
      (this.options.onInteraction?.(),
      Mc(
        this.options.onActivate
          ? { playClick: this.options.onActivate }
          : void 0,
      ),
      (this.searchState = 1),
      (this.searchTooltipVisible = !0),
      this.render());
  };
  onSearchPointerMove = () => {
    ((this.searchTooltipVisible = this.searchState === 1), this.render());
  };
  onSearchPointerLeave = () => {
    ((this.searchTooltipVisible = !1), this.render());
  };
  onKeyDown = (e) => {
    const t = {
      Escape: () => this.options.onCancel(),
      F1: () => this.toggleSearchFocus(),
      F5: () => this.commitSearch(),
    }[e.key];
    t && (e.preventDefault(), t());
  };
  onAnimationFrame = () => {
    this.frozen ||
      (this.livePanels && this.render(),
      this.disposed ||
        (this.animationFrame = requestAnimationFrame(this.onAnimationFrame)));
  };
}
function XP(n, e, t) {
  if (e.y >= 0 || n.y < 0) return;
  const i = -n.y / e.y;
  if (!(i < 0 || i > 1))
    return {
      point: { x: n.x + e.x * i, y: 0, z: n.z + e.z * i },
      normal: { x: 0, y: 1, z: 0 },
    };
}
const YP = { rayQuery: XP };
function ZP(n, e) {
  return e
    ? n === 4 || n === 5
      ? { state: 10, dualMode: 3, dualBoosterState: 2 }
      : n === 1 || n === 2
        ? { state: 3, dualMode: 0, dualBoosterState: 0 }
        : { state: 0, dualMode: 0, dualBoosterState: 0 }
    : { state: 0, dualMode: 0, dualBoosterState: 0 };
}
function Yv(n, e) {
  return {
    showOrdinaryRider: e !== "kart-only",
    showLinkedVehicleActor:
      ((n.linkCharacterId ?? 0) !== 0 && n.alwaysLinkCharacter === !0) || Pv(n),
    panelMode: e === "kart-only" ? "preview" : e,
  };
}
function T4(n, e, t, i, r, s = !0) {
  const o = s ? n.linkedPresentation : void 0,
    a = n.kart.animation.state === 1 || n.kart.animation.state === 2 ? 3 : 0,
    c = o
      ? {
          forwardSpeed: 0,
          rawSteer: 0,
          tireTransient: 0,
          boosterState: a,
          motorcycle: !1,
          visualScaleMode: 0,
          instantAccelerationActive: !1,
          landingTrigger: !1,
          collisionHit: !1,
          collisionStrength: 0,
          linkedPresentationMotion: o.update(a, e),
        }
      : void 0;
  (n.kart.renderScene?.update(t, i, r), n.character?.update(e, t, i, r, c));
}
function Zv(n) {
  (n.character?.reset(),
    n.linkedPresentation?.resetForRacePresentation(),
    n.linkedPresentation?.setMode(0));
}
function dT(n) {
  return `${n.x},${n.y},${n.width},${n.height}`;
}
class E7 {
  constructor(e, t, i, r, s, o, a, c = "preview") {
    ((this.library = e),
      (this.environment = t),
      (this.stageBinding = i),
      (this.onReady = r),
      (this.previewMode = c),
      (this.coatingTextures = i.coatingTextures(e)),
      (this.renderer.outputColorSpace = qe),
      this.renderer.setClearColor(0, 0),
      (this.renderer.autoClear = !1),
      (this.characterCamera = Qs("character", s.width, s.height)),
      (this.kartCamera = Qs("kart", s.width, s.height)),
      (this.previewCamera = a ?? Qs("preview", o.width, o.height)));
  }
  library;
  environment;
  stageBinding;
  onReady;
  previewMode;
  particleModificationPageVisible = !0;
  coatingTextures;
  coatingFitting;
  coatingRequest;
  coatingFailure;
  get coatingPreviewError() {
    return this.coatingFailure;
  }
  setParticleModificationPageVisible(e) {
    ((this.particleModificationPageVisible = e),
      this.preview?.particleModification?.setPresentationAllowed(e));
  }
  async validateCoatingEquipment(e, t) {
    const i = this.preview,
      r = i?.coatingSource;
    if (!i || r?.itemId !== e) throw new Error("请等待当前车辆预览加载完成。");
    if (
      (await Ak(
        this.library,
        i.kart.model,
        r.visual,
        r.engineGrade,
        { family: t.family, coating: t.id },
        this.coatingTextures,
      ),
      this.disposed || this.preview !== i)
    )
      throw new Error("车辆已切换，请重新选择车膜。");
  }
  renderer = new I4({
    alpha: !0,
    preserveDrawingBuffer: !0,
    powerPreference: "high-performance",
  });
  pixelRatio = 1;
  directFrame;
  preparingDirectFrame = !1;
  panelRect;
  characterCamera;
  kartCamera;
  previewCamera;
  setPreviewSize(e, t, i = "default") {
    ($a0(this.previewCamera, e, t, i), J3(this.previewCamera, this.previewYaw));
  }
  importer = new Tr();
  characters = new Map();
  karts = new Map();
  characterLoading = new Set();
  kartLoading = new Set();
  characterFailed = new Set();
  kartFailed = new Set();
  equipment = new Map();
  equipmentLoading = new Set();
  equipmentFailed = new Set();
  desiredEquipment = new Set();
  desiredCharacters = new Set();
  desiredKarts = new Set();
  preview;
  previewKey;
  previewGeneration = 0;
  previewYaw = 0;
  previewReverse = !1;
  previewRearView = !1;
  transformPreviewEnabled = !1;
  transformPreviewTimelineActive = !1;
  transformPreviewCancelled = !1;
  transformPreviewCompleted = !1;
  transformPreviewClosing = !1;
  previewTargetYaw;
  previewYawTime;
  disposed = !1;
  static async load(e, t, i, r, s, o, a, c = "preview") {
    return new E7(e, t, i, r, s, o, a, c);
  }
  render(e, t, i, r, s, o, a, c, l, u = !0, h = 1, d) {
    if (!this.disposed) {
      (this.syncCards(r.map((f) => f.item)),
        o
          ? this.syncPreview(o, a, c)
          : ((this.previewKey = void 0),
            this.previewGeneration++,
            this.disposePreview()),
        this.syncCoatingPreview(l),
        u && this.advancePreviewRotation(e),
        (this.pixelRatio = Number.isFinite(h) && h > 0 ? h : 1),
        (this.directFrame = d ? { target: d, scenes: new Map() } : void 0),
        (this.preparingDirectFrame = d !== void 0),
        d ||
          (this.renderer.setPixelRatio(this.pixelRatio),
          this.renderer.setSize(t, i, !1),
          this.renderer.setScissorTest(!1),
          this.renderer.clear(!0, !0, !0)),
        this.stageBinding.beginFrame(e),
        d || this.renderer.setScissorTest(!0));
      try {
        (o && this.renderPreview(e, i, s, u),
          r.forEach(({ item: f, rect: p, kartZoom: v, kartShadow: w }) => {
            f.kind === "character"
              ? this.renderCharacterCard(e, i, f, p)
              : f.kind === "kart"
                ? this.renderKartCard(e, i, f, p, v, w)
                : "category" in f && this.renderEquipmentCard(i, f, p);
          }));
      } finally {
        ((this.preparingDirectFrame = !1),
          d || this.renderer.setScissorTest(!1));
      }
    }
  }
  drawCard(e, t, i) {
    (t.kind === "character"
      ? this.characters.has(t.itemId)
      : t.kind === "kart"
        ? this.karts.has(N3(t))
        : this.equipment.has(xc(t))) && this.copyTo(e, i);
  }
  drawPreview(e, t) {
    this.preview && this.copyTo(e, t);
  }
  renderPreviewSnapshot(e, t, i, r, s = 1) {
    return this.disposed || !this.preview
      ? !1
      : ((this.directFrame = void 0),
        (this.pixelRatio = Number.isFinite(s) && s > 0 ? s : 1),
        this.renderer.setPixelRatio(this.pixelRatio),
        this.renderer.setSize(t, i, !1),
        this.renderer.setScissorTest(!1),
        this.renderer.clear(!0, !0, !0),
        this.stageBinding.beginFrame(e),
        this.renderer.setScissorTest(!0),
        this.renderPreview(e, i, r, !1),
        this.renderer.setScissorTest(!1),
        !0);
  }
  renderKartSnapshot(e, t, i, r, s, o = 1) {
    return this.disposed || !this.karts.get(N3(r))
      ? !1
      : ((this.directFrame = void 0),
        (this.pixelRatio = Number.isFinite(o) && o > 0 ? o : 1),
        this.renderer.setPixelRatio(this.pixelRatio),
        this.renderer.setSize(t, i, !1),
        this.renderer.setScissorTest(!1),
        this.renderer.clear(!0, !0, !0),
        this.stageBinding.beginFrame(e),
        this.renderer.setScissorTest(!0),
        this.renderKartCard(e, i, r, s),
        this.renderer.setScissorTest(!1),
        !0);
  }
  drawAuxiliaryPanel(e, t) {
    if (this.disposed || t.length === 0) return;
    const i = this.pixelRatio > 0 ? this.pixelRatio : 1,
      r = new Map();
    for (const a of t) {
      const c = a.canvas.getBoundingClientRect();
      let l = a.canvas.width / i,
        u = a.canvas.height / i;
      if (c.width > 0 && c.height > 0) {
        const f = xe(),
          p = Math.max(1, Math.round(c.width * f)),
          v = Math.max(1, Math.round(c.height * f));
        (a.canvas.width !== p && (a.canvas.width = p),
          a.canvas.height !== v && (a.canvas.height = v),
          (l = (c.width * f) / i),
          (u = (c.height * f) / i));
      }
      const h = `${a.canvas.width}:${a.canvas.height}`,
        d = r.get(h);
      d
        ? d.targets.push(a)
        : r.set(h, { targets: [a], logicalWidth: l, logicalHeight: u });
    }
    const s = Math.max(
        ...[...r.values()].map((a) => a.targets[0].canvas.width),
      ),
      o = Math.max(...[...r.values()].map((a) => a.targets[0].canvas.height));
    (this.renderer.getPixelRatio() !== 1 && this.renderer.setPixelRatio(1),
      (this.renderer.domElement.width !== s ||
        this.renderer.domElement.height !== o) &&
        this.renderer.setSize(s, o, !1));
    for (const a of r.values()) {
      const { width: c, height: l } = a.targets[0].canvas,
        { logicalWidth: u, logicalHeight: h } = a;
      (this.renderer.setScissorTest(!0),
        this.setViewport(o, { x: 0, y: 0, width: c, height: l }),
        this.renderer.clear(!0, !0, !0),
        e.update(u, h),
        f4(this.renderer, e.scene, e.camera),
        this.renderer.setScissorTest(!1));
      for (const d of a.targets)
        (d.save(),
          d.setTransform(1, 0, 0, 1, 0, 0),
          d.clearRect(0, 0, c, l),
          d.drawImage(this.renderer.domElement, 0, 0, c, l, 0, 0, c, l),
          d.restore());
    }
  }
  beginPreviewRotation() {
    ((this.previewTargetYaw = void 0), (this.previewYawTime = void 0));
  }
  rotatePreview(e) {
    this.beginPreviewRotation();
    const t = Math.fround(this.previewYaw - Math.fround(e * Math.fround(0.02))),
      i = 6.283185005187988;
    let r = Math.abs(t);
    for (; r > i;) r = Math.fround(r - i);
    (r > lT && (r = -Math.fround(i - r)),
      (this.previewYaw = t < 0 ? -r : r),
      J3(this.previewCamera, this.previewYaw));
  }
  beginTransformPreviewSession() {
    this.transformPreviewEnabled ||
      ((this.transformPreviewCompleted = !1),
      (this.transformPreviewClosing = !1),
      (this.transformPreviewCancelled = !1),
      (this.transformPreviewTimelineActive = !1),
      (this.transformPreviewEnabled = !0),
      this.resetPreviewRotation(!0));
  }
  restartTransformPreview() {
    (this.transformPreviewEnabled || this.beginTransformPreviewSession(),
      (this.transformPreviewCompleted = !1),
      (this.transformPreviewClosing = !1),
      (this.transformPreviewTimelineActive = !0),
      (this.transformPreviewCancelled = !1),
      this.preview &&
        ((this.preview.origin = void 0),
        this.preview.cosmeticEffects?.restartGaragePreview(performance.now()),
        this.preview.cosmeticTrails?.restartGaragePreview()));
  }
  get isTransformPreviewSessionActive() {
    return this.transformPreviewEnabled;
  }
  get isTransformPreviewEnabled() {
    return this.transformPreviewEnabled;
  }
  get isPreviewReady() {
    return this.preview !== void 0;
  }
  toggleTransformPreview() {
    if (!this.transformPreviewClosing) {
      if (this.transformPreviewCompleted) {
        this.closeCompletedTransformPreview();
        return;
      }
      this.setTransformPreview(!this.transformPreviewEnabled);
    }
  }
  setTransformPreview(e) {
    if (e !== this.transformPreviewEnabled) {
      if (e) {
        ((this.transformPreviewCompleted = !1),
          (this.transformPreviewClosing = !1));
        const t = this.transformPreviewCancelled;
        ((this.transformPreviewTimelineActive = !0),
          (this.transformPreviewCancelled = !1),
          t && this.preview && (this.preview.origin = void 0));
      }
      if (((this.transformPreviewEnabled = e), e)) {
        const t = performance.now();
        (this.preview?.cosmeticEffects?.restartGaragePreview(t),
          this.preview?.cosmeticTrails?.restartGaragePreview());
      } else {
        if (this.transformPreviewTimelineActive) {
          this.transformPreviewCancelled = !0;
          const i = this.preview?.kart.animation;
          (!this.preview ||
            this.preview.transformEnabled !== !0 ||
            i?.state === 0) &&
            (this.transformPreviewTimelineActive = !1);
        }
        const t = performance.now();
        (this.preview?.cosmeticEffects?.setState(0, 0, !1, !1, t),
          this.preview?.cosmeticTrails?.setState(0, t));
      }
      this.resetPreviewRotation(e);
    }
  }
  resetPreviewForPageTransition() {
    if (this.disposed) return;
    const e = performance.now();
    ((this.transformPreviewEnabled = !1),
      (this.transformPreviewTimelineActive = !1),
      (this.transformPreviewCancelled = !1),
      (this.transformPreviewCompleted = !1),
      (this.transformPreviewClosing = !1),
      (this.previewTargetYaw = void 0),
      (this.previewYawTime = void 0),
      (this.previewYaw = 0),
      (this.previewRearView = !1),
      this.previewMode === "kart-only" && (this.previewReverse = !1),
      J3(this.previewCamera, 0),
      this.preview?.cosmeticEffects?.setState(0, 0, !1, !1, e),
      this.preview?.cosmeticTrails?.setState(0, e));
    const t = this.preview;
    t &&
      ((t.transformEnabled = !1),
      (t.origin = void 0),
      t.kart.animation.reset(Math.trunc(e) >>> 0),
      Zv(t));
  }
  closeCompletedTransformPreview() {
    const e = performance.now();
    ((this.transformPreviewCompleted = !1),
      (this.transformPreviewEnabled = !1),
      (this.transformPreviewTimelineActive = !1),
      (this.transformPreviewCancelled = !1),
      (this.transformPreviewClosing = Math.abs(this.previewYaw) >= 0.01),
      this.preview?.cosmeticEffects?.restartGaragePreview(e),
      this.preview?.cosmeticTrails?.restartGaragePreview(),
      this.preview &&
        ((this.preview.transformEnabled = !1), (this.preview.origin = void 0)),
      (this.previewTargetYaw = 0),
      (this.previewYawTime = void 0),
      (this.previewRearView = !1),
      J3(this.previewCamera, this.previewYaw));
  }
  resetPreviewRotation(e = this.previewRearView) {
    ((this.previewRearView = e),
      this.previewMode === "kart-only"
        ? (this.previewTargetYaw = e ? Math.fround(Math.PI / 2) : 0)
        : (this.previewTargetYaw = e || this.previewReverse ? lT : 0),
      (this.previewYawTime = void 0));
  }
  advancePreviewRotation(e) {
    if (this.previewTargetYaw === void 0) return;
    const t = Math.floor(e) >>> 0,
      i = (t - (this.previewYawTime ?? t)) >>> 0,
      r = Oa0(this.previewYaw, this.previewTargetYaw, i);
    ((this.previewYaw = r.yaw),
      (this.previewYawTime = t),
      r.complete &&
        ((this.previewTargetYaw = void 0),
        this.transformPreviewClosing && (this.transformPreviewClosing = !1)),
      J3(this.previewCamera, this.previewYaw));
  }
  dispose() {
    this.disposed ||
      ((this.disposed = !0),
      (this.directFrame = void 0),
      this.characters.forEach(af),
      this.karts.forEach(Js),
      this.characters.clear(),
      this.karts.clear(),
      this.equipment.forEach((e) => e.dispose()),
      this.equipment.clear(),
      this.disposePreview(),
      this.renderer.dispose());
  }
  copyTo(e, t) {
    const i = this.directFrame;
    if (i && e === i.target.context) {
      const r = i.scenes.get(dT(t));
      r && i.target.drawModel(t, (s) => f4(s, r.scene, r.camera));
      return;
    }
    e.drawImage(
      this.renderer.domElement,
      t.x * this.pixelRatio,
      t.y * this.pixelRatio,
      t.width * this.pixelRatio,
      t.height * this.pixelRatio,
      t.x,
      t.y,
      t.width,
      t.height,
    );
  }
  renderCharacterCard(e, t, i, r) {
    const s = this.characters.get(i.itemId);
    s &&
      (this.setViewport(t, r),
      s.character.update(e, this.characterCamera, r.width, r.height, void 0),
      this.submitScene(s.scene, this.characterCamera));
  }
  renderKartCard(e, t, i, r, s, o = !1) {
    const a = this.karts.get(N3(i));
    if (!a) return;
    Ua0(this.kartCamera, r.width, r.height, s);
    const c = a.cardCamera?.(r.width, r.height) ?? this.kartCamera;
    (this.setViewport(t, r),
      ey(a, e, c, r.width, r.height, o),
      this.submitScene(a.scene, c));
  }
  renderPreview(e, t, i, r = !0) {
    const s = this.preview;
    if (!s) return;
    this.setViewport(t, i);
    const o = this.previewMode === "kart-only";
    if (!r) {
      (T4(s, e, this.previewCamera, i.width, i.height, !1),
        this.submitScene(s.scene, this.previewCamera));
      return;
    }
    (o
      ? (s.kart.animation.updateCurrentState(e),
        o80(s, e, this.transformPreviewTimelineActive) &&
          ((this.transformPreviewCompleted = !this.transformPreviewCancelled),
          (this.transformPreviewTimelineActive = !1),
          (this.transformPreviewCancelled = !1),
          (s.transformEnabled = !1),
          (s.origin = void 0)))
      : (nF(s, e), s.kart.animation.updateCurrentState(e)),
      T4(s, e, this.previewCamera, i.width, i.height));
    const a = s.kart.animation.state,
      c = ((Math.trunc(e) >>> 0) - (s.origin ?? 0)) >>> 0,
      l = o && this.transformPreviewEnabled && c <= 6e3,
      u = ZP(a, l),
      h = u.state !== 0;
    (s.cosmeticEffects?.setState(u.state, u.dualMode, !1, !1, e),
      s.cosmeticEffects?.update(e, this.previewCamera, i.width, i.height),
      s.cosmeticTrails?.setState(h ? 3 : 0, e),
      s.cosmeticTrails?.update(e, this.previewCamera),
      s.particleModification?.update(
        e,
        !0,
        this.previewCamera,
        i.width,
        i.height,
      ),
      s.flyingPet?.update(e, this.previewCamera, i.width, i.height),
      s.decorations.forEach((d) =>
        d.scene.update(e, this.previewCamera, i.width, i.height),
      ),
      this.submitScene(s.scene, this.previewCamera));
  }
  renderEquipmentCard(e, t, i) {
    const r = this.equipment.get(xc(t));
    r &&
      (this.setViewport(e, i),
      r.update(i.width, i.height),
      this.submitScene(r.scene, r.camera));
  }
  setViewport(e, t) {
    if (((this.panelRect = t), this.preparingDirectFrame)) return;
    const i = e - t.y - t.height;
    (this.renderer.setViewport(t.x, i, t.width, t.height),
      this.renderer.setScissor(t.x, i, t.width, t.height),
      this.renderer.clear(!0, !0, !0));
  }
  submitScene(e, t) {
    this.preparingDirectFrame && this.directFrame && this.panelRect
      ? this.directFrame.scenes.set(dT(this.panelRect), {
          scene: e,
          camera: t.clone(),
        })
      : f4(this.renderer, e, t);
  }
  syncCards(e) {
    const t = e.filter((r) => r.kind === "character"),
      i = e.filter((r) => r.kind === "kart");
    (this.syncCharacters(t),
      this.syncKarts(i),
      this.syncEquipment(e.filter((r) => "category" in r)));
  }
  syncEquipment(e) {
    ((this.desiredEquipment = new Set(e.map(xc))),
      this.equipment.forEach((t, i) => {
        this.desiredEquipment.has(i) || (t.dispose(), this.equipment.delete(i));
      }),
      e.forEach((t) => this.loadEquipmentCard(t)));
  }
  loadEquipmentCard(e) {
    const t = xc(e);
    this.equipment.has(t) ||
      this.equipmentLoading.has(t) ||
      this.equipmentFailed.has(t) ||
      (this.equipmentLoading.add(t),
      La0(this.library, e, this.environment, this.stageBinding)
        .then((i) => {
          this.disposed || !this.desiredEquipment.has(t)
            ? i.dispose()
            : this.equipment.set(t, i);
        })
        .catch(() => this.equipmentFailed.add(t))
        .finally(() => {
          (this.equipmentLoading.delete(t), this.disposed || this.onReady());
        }));
  }
  syncCharacters(e) {
    ((this.desiredCharacters = new Set(e.map((t) => t.itemId))),
      this.characters.forEach((t, i) => {
        this.desiredCharacters.has(i) || (af(t), this.characters.delete(i));
      }),
      e.forEach((t) => {
        this.characters.has(t.itemId) ||
          this.characterLoading.has(t.itemId) ||
          this.characterFailed.has(t.itemId) ||
          (this.characterLoading.add(t.itemId),
          Ho(this.library, t, this.environment, this.stageBinding, "card")
            .then((i) => {
              this.disposed || !this.desiredCharacters.has(t.itemId)
                ? af(i)
                : this.characters.set(t.itemId, i);
            })
            .catch(() => {
              this.characterFailed.add(t.itemId);
            })
            .finally(() => {
              (this.characterLoading.delete(t.itemId),
                this.disposed || this.onReady());
            }));
      }));
  }
  syncKarts(e) {
    ((this.desiredKarts = new Set(e.map(N3))),
      this.karts.forEach((t, i) => {
        this.desiredKarts.has(i) || (Js(t), this.karts.delete(i));
      }),
      e.forEach((t) => this.loadKartCard(t)));
  }
  loadKartCard(e) {
    const t = N3(e);
    this.karts.has(t) ||
      this.kartLoading.has(t) ||
      this.kartFailed.has(t) ||
      (this.kartLoading.add(t),
      Qv(this.library, e, this.environment, this.stageBinding)
        .then((i) => {
          this.disposed || !this.desiredKarts.has(t)
            ? Js(i)
            : this.karts.set(t, i);
        })
        .catch(() => this.kartFailed.add(t))
        .finally(() => {
          (this.kartLoading.delete(t), this.disposed || this.onReady());
        }));
  }
  syncPreview(e, t, i) {
    const { itemIds: r } = i.equipment,
      s = e.itemId === r[3] ? i.equipment.kartSerial : 0,
      o = p5(i.garage, e.itemId, s),
      a = JSON.stringify([
        N3(e),
        n80(e.path),
        t.itemId,
        r[2],
        r[4],
        r[70],
        r[52],
        r[8],
        r[9],
        r[11],
        r[16],
        r[26],
        r[27],
        i.initial,
        o.cosmetics,
        o.progression?.kind,
        o.progression?.level,
      ]);
    if (a === this.previewKey) return;
    this.previewKey = a;
    const c = ++this.previewGeneration;
    (this.disposePreview(),
      T7(
        this.library,
        e,
        t,
        this.environment,
        this.stageBinding,
        this.importer,
        this.previewMode,
        i,
        this.coatingTextures,
      )
        .then((l) => {
          if (this.disposed || c !== this.previewGeneration) Lt(l);
          else {
            ((this.preview = l),
              l.particleModification?.setPresentationAllowed(
                this.particleModificationPageVisible,
              ));
            const u = this.previewMode === "kart-only" ? !1 : l.reverse;
            this.previewReverse !== u &&
              ((this.previewReverse = u), this.resetPreviewRotation());
          }
        })
        .catch(() => {})
        .finally(() => {
          !this.disposed && c === this.previewGeneration && this.onReady();
        }));
  }
  disposePreview() {
    (this.coatingFitting?.dispose(),
      (this.coatingFitting = void 0),
      (this.coatingRequest = void 0),
      (this.coatingFailure = void 0),
      (this.transformPreviewEnabled = !1),
      (this.transformPreviewTimelineActive = !1),
      (this.transformPreviewCancelled = !1),
      (this.transformPreviewCompleted = !1),
      (this.transformPreviewClosing = !1),
      this.preview && (Lt(this.preview), (this.preview = void 0)));
  }
  syncCoatingPreview(e) {
    if (!e) {
      if (this.coatingRequest) {
        const t = this.coatingFitting?.current !== void 0;
        (this.coatingFitting?.cancel(),
          t && this.preview && (this.preview.origin = void 0));
      }
      ((this.coatingRequest = void 0), (this.coatingFailure = void 0));
      return;
    }
    if (!(!this.preview || this.coatingRequest === e)) {
      ((this.coatingRequest = e), (this.coatingFailure = void 0));
      try {
        if (this.previewMode !== "kart-only")
          throw new Error("车膜试穿仅属于独立车库。");
        this.coatingFitting ??= JP(this.preview, this.coatingTextures);
        const t = this.coatingFitting,
          i = this.preview;
        t.select(e)
          .then((r) => {
            r &&
              !this.disposed &&
              this.preview === i &&
              this.coatingFitting === t &&
              this.coatingRequest === e &&
              (i.origin = void 0);
          })
          .catch((r) => {
            !this.disposed &&
              this.coatingFitting === t &&
              this.coatingRequest === e &&
              (this.coatingFailure =
                r instanceof Error ? r.message : String(r));
          });
      } catch (t) {
        this.coatingFailure = t instanceof Error ? t.message : String(t);
      }
    }
  }
}
function xc(n) {
  return `${n.kind}:${n.itemId}`;
}
function QP(n, e, t, i) {
  return n === "preview" ? !1 : Bk(e, t, i);
}
function sf(n) {
  return n.kind === "kart" && n.itemId === 0
    ? `item:kart:${N3(n)}`
    : `item:${n.kind}:${n.itemId}`;
}
function of(n) {
  return Cr.find((e) => e.key === n);
}
function t80(n) {
  return n?.replaceAll("\\", "/").match(/^kart_\/([^/]+)\/model\.1s$/i)?.[1];
}
function n80(n) {
  return n.replaceAll("\\", "/").toLowerCase();
}
async function Qv(n, e, t, i) {
  const r = await t3(n, e.path, e.systemKey),
    s = r.find(["model.1s"]);
  if (!s || s.extension !== "1s")
    throw new Error(`${e.path} 缺少车辆 model.1s。`);
  const o = await s.bytes(),
    a = eF(e),
    c = await We(n, s80(e)),
    l = await vw(n, r, a, tF(e), c.primary, c.high),
    u = xa(o);
  if (u.root.value.className !== "ReKart")
    throw new Error(`${e.path} 的根对象不是 ReKart。`);
  const h = cv(r.parameter.value);
  if (Pv(e)) {
    const v = yw(r, n),
      w = await new Tr().importVehicleRender(
        o,
        iF(e.path),
        l,
        await Promise.all(v.map((b) => b?.bytes())),
        h.isWheelOutline,
        t,
        i,
      );
    let g, y;
    try {
      const b = await n.timeAttackLinkedCharacterItem(e.linkCharacterId);
      g = (await Ho(n, b, t, i, "preview", h.reverse, 0, c, !1, !0)).character;
      const A = w.model.root.value,
        x = A.children[6]?.value,
        M = w.renderScene,
        E = M?.bySource.get(A),
        _ = x && "children" in x ? M?.bySource.get(x) : void 0;
      if (!M || !E || !_)
        throw new Error(`${e.path} 缺少 conditional linked card 挂点。`);
      (_.clear(), _.add(g.object));
      const C = new _a(E, _, g.object, !1);
      C.setMode(0);
      const S = r.find(["shadow.png"]);
      y = await fr.load(S, u.root.value.simpleShadow, E, !!S);
      const G = new D1();
      G.add(w.object, y.object);
      const I = {
        scene: G,
        kart: w,
        character: g,
        linkedPresentation: C,
        decorations: [],
        hasF04: !!v[4],
        reverse: h.reverse,
      };
      let L,
        k = 0,
        D = 0;
      return {
        scene: G,
        kart: M,
        shadow: y,
        preview: I,
        cardCamera(V, K) {
          return (
            (!L || k !== V || D !== K) &&
              ((L = Qs("preview", V, K)),
              (L.zoom *= 0.54),
              L.setViewOffset(V, K, (-5 * V) / 222, (-12 * V) / 222, V, K),
              L.updateProjectionMatrix(),
              (k = V),
              (D = K)),
            L
          );
        },
      };
    } catch (b) {
      throw (
        y?.dispose(),
        g?.dispose(),
        w.renderScene?.dispose(),
        u5(w.object),
        b
      );
    }
  }
  const d = await qI(u, l, h.isWheelOutline, t, i);
  let f, p;
  try {
    const v = Yv(e, "kart-only");
    if (v.showLinkedVehicleActor) {
      const y = await n.timeAttackLinkedCharacterItem(e.linkCharacterId);
      f = (await Ho(n, y, t, i, v.panelMode, h.reverse, 0, c)).character;
      const A = u.root.value.children[6]?.value,
        x = A && "children" in A ? d.bySource.get(A) : void 0;
      if (!x)
        throw new Error(`${e.path} 缺少 KartItemPanel linked character 挂点。`);
      (f.object.removeFromParent(),
        f.object.scale.setScalar(h.onCharacterSize),
        x.clear(),
        x.add(f.object),
        (f.object.visible = !0),
        f.reset());
    }
    const w = r.find(["shadow.png"]);
    ((p = await fr.load(w, u.root.value.simpleShadow, d.object, !!w)),
      p.update(YP, !0));
    const g = new D1();
    return (
      g.add(d.object, p.object),
      { scene: g, kart: d, shadow: p, linkedCharacter: f }
    );
  } catch (v) {
    throw (p?.dispose(), f?.dispose(), d.dispose(), v);
  }
}
async function T7(n, e, t, i, r, s, o, a, c) {
  const [l, u] = await Promise.all([
      Yb(n, a.equipment.itemIds[2]),
      o === "kart-only" ? void 0 : Yb(n, a.equipment.itemIds[70], 70),
    ]),
    h = e.itemId === a.equipment.itemIds[3] ? a.equipment.kartSerial : 0;
  return Jv(
    n,
    e,
    t,
    i,
    r,
    s,
    o,
    {
      equipment: a.equipment,
      initial: a.initial,
      build: p5(a.garage, e.itemId, h),
      kartColors: l,
      riderColors: u,
    },
    c,
  );
}
async function Jv(n, e, t, i, r, s, o, a, c, l = !1) {
  r80(e);
  const u = e.linkCharacterId ?? 0,
    h = Yv(e, o),
    d = Pv(e),
    { kartColors: f, riderColors: p, build: v } = a,
    {
      imported: w,
      reverse: g,
      onCharacterSize: y,
      hasF04: b,
      visual: A,
    } = await i80(n, e, i, r, s, f.primary, f.high, a),
    x = new D1();
  x.add(w.object);
  let M, E, _, C, S, G, I;
  const L = [];
  let k = t.goggleType ?? "";
  try {
    if (
      (h.showOrdinaryRider &&
        p !== null &&
        !d &&
        ((M = await Ho(n, t, i, r, h.panelMode, g, e.characterAniType, p, l)),
        (M.character.object.visible = t.itemId !== 84 && u === 0)),
      h.showLinkedVehicleActor)
    ) {
      const U = await n.timeAttackLinkedCharacterItem(u),
        O = await Ho(n, U, i, r, h.panelMode, g, 0, f, l, d);
      (M?.character.dispose(), (M = O), (k = U.goggleType ?? ""));
    }
    if (M) {
      const U = w.model.root.value.children[6]?.value,
        O = U && "children" in U ? w.renderScene?.bySource.get(U) : void 0;
      if (!O) throw new Error(`${e.path} 缺少 GaragePreview rider 挂点。`);
      if (
        (M.character.object.removeFromParent(),
        d || M.character.object.scale.setScalar(y),
        O.clear(),
        O.add(M.character.object),
        h.showLinkedVehicleActor)
      ) {
        const F = w.renderScene?.bySource.get(w.model.root.value);
        if (!F)
          throw new Error(`${e.path} 缺少 linked GaragePreview ReKart root。`);
        const z = new _a(F, O, M.character.object, !d);
        d ? ((E = z), z.setMode(0)) : (M.character.object.visible = !0);
      }
      (e.hideChar && (M.character.object.visible = !1), M.character.reset());
    }
    const D = v.factory?.active === !0,
      V =
        o === "ready" && v.progression?.kind === "xun"
          ? v.progression.level
          : void 0,
      K = QP(o, e.engineGrade, D, V),
      P = o === "ready" ? "ready" : "garage",
      q = v.cosmetics;
    if (q?.coating !== void 0 && !w.renderScene)
      throw new Error("车膜缺少车辆渲染器。");
    if (w.renderScene) {
      I = await d7.load(
        n,
        w.renderScene,
        w.model,
        A,
        e.engineGrade ?? 0,
        q,
        c ?? r.coatingTextures(n),
      );
      const U = o === "kart-only";
      ((U || q?.boosterEffect !== void 0) &&
        (C = await Ca.load(
          n,
          A,
          e.engineGrade,
          w.renderScene,
          i,
          r,
          U ? "garage-preview" : "driving",
        )),
        (U || q?.tailLamp !== void 0) &&
          ((S = await Ea.load(
            n,
            A,
            w.renderScene,
            U ? "garage-preview" : "driving",
          )),
          x.add(S.object)),
        K &&
          typeof e.engineGrade == "number" &&
          Number.isInteger(e.engineGrade) &&
          (e.engineGrade >= 0 && e.engineGrade <= 8
            ? (G = await dr.load(n, w.renderScene, i, r))
            : e.engineGrade === 9 &&
              (G = await Do.loadXun(n, w.renderScene, i, r, P))));
    }
    const e0 = a.equipment.itemIds[9];
    if (e0 !== 0) {
      const U = await n.timeAttackDecorationItem(9, e0),
        O = await Jw(n, U.internalId, i, r, {
          ...U,
          wireColor: f.primary,
          trans: U.decorationTrans,
        });
      (c7(w.model, w.scene).add(O.scene.object), L.push(O));
    }
    const Q = M?.character;
    if (Q) {
      if (o !== "kart-only") {
        const O = await Ma(n, a.equipment.itemIds[52]);
        if (O)
          try {
            ((_ = await S4.preview({
              library: n,
              item: O,
              environment: i,
              binding: r,
              colors: f,
            })),
              _.mount(Q.getDecorationOwner()));
          } catch (F) {
            console.warn("飞宠预览未准入：", F);
          }
      }
      for (const [O, F, z, Y] of [
        ["goggle", 8, 3, 0],
        ["headBand", 11, 3, 3],
        ["handGearL", 16, 4, 0],
      ]) {
        const X = a.equipment.itemIds[F];
        if (X === 0) continue;
        const l0 = await n.timeAttackDecorationItem(F, X),
          r0 = await hr(n, O, l0.internalId, i, r, {
            convertClientCoordinates: !1,
            goggleType: O === "goggle" ? k : void 0,
            trans: l0.decorationTrans,
          }),
          j = Q.getDecorationSocket(z, Y);
        if (!j) throw new Error(`ReCharacter ${O} socket ${z},${Y} 缺失。`);
        (j.add(r0.scene.object), L.push(r0));
      }
      const U = a.equipment.itemIds[26];
      if (U !== 0) {
        const O = await n.timeAttackDecorationItem(26, U),
          F = await hr(n, "aura", O.internalId, i, r, {
            convertClientCoordinates: !1,
            trans: O.decorationTrans,
          }),
          z = Q.getDecorationOwner();
        z.add(F.scene.object);
        const Y = w.renderScene?.bySource.get(w.model.root.value);
        if (!Y) throw new Error(`${e.path} 缺少 aura 偏移挂点。`);
        (ev(z, Y, F.scene.object), L.push(F));
      }
      Q.reset();
    }
    return {
      scene: x,
      kart: w,
      character: M?.character,
      linkedPresentation: E,
      roomMotion: M?.roomMotion,
      flyingPet: _,
      decorations: L,
      hasF04: b,
      reverse: g,
      cosmeticEffects: C,
      cosmeticTrails: S,
      particleModification: G,
      coating: I,
      coatingSource:
        o === "kart-only"
          ? { itemId: e.itemId, engineGrade: e.engineGrade ?? 0, visual: A }
          : void 0,
    };
  } catch (D) {
    throw (
      _?.dispose(),
      L.forEach((V) => V.dispose()),
      M?.character.dispose(),
      C?.dispose(),
      S?.dispose(),
      G?.dispose(),
      I?.dispose(),
      w.renderScene?.dispose(),
      u5(w.object),
      D
    );
  }
}
function JP(n, e) {
  const t = n.coatingSource;
  if (!t || (t.engineGrade !== 8 && t.engineGrade !== 9))
    throw new Error("车膜试穿仅支持 V1 / 迅。");
  yk(t.visual);
  const i = n.kart.renderScene;
  if (!i) throw new Error("车辆预览尚未就绪。");
  const r = HI(n.kart.model, t.visual.attachments);
  if (r.unclassified.length)
    throw new Error("此车存在未核实的绘制部件，暂不覆盖车膜。");
  return new xa0(
    i,
    r.draws,
    e,
    t.engineGrade === 9 ? "xun" : "classic",
    n.coating?.configuration,
  );
}
async function i80(n, e, t, i, r, s, o, a) {
  const c = await t3(n, e.path, e.systemKey),
    l = c.find(["model.1s"]);
  if (!l || l.extension !== "1s")
    throw new Error(`${e.path} 缺少车辆 model.1s。`);
  const u = yw(c, n),
    [h, d] = await Promise.all([
      l.bytes(),
      Promise.all(u.map((g) => g?.bytes())),
    ]),
    f = eF(e),
    p = await vw(n, c, f, tF(e), s, o, {
      itemId: a.equipment.itemIds[4],
      initial: a.initial,
    }),
    v = await wk(n, cv(c.parameter.value), a.build.cosmetics);
  return {
    imported: await r.importVehicleRender(
      h,
      iF(e.path),
      p,
      d,
      v.isWheelOutline,
      t,
      i,
    ),
    reverse: v.reverse,
    onCharacterSize: v.onCharacterSize,
    hasF04: !!u[4],
    visual: v,
  };
}
function r80(n) {
  if (
    n.engineGrade === void 0 ||
    n.textureKey === void 0 ||
    n.fixedPlateId === void 0 ||
    n.linkCharacterId === void 0 ||
    n.alwaysLinkCharacter === void 0 ||
    n.hideChar === void 0 ||
    n.characterAniType === void 0
  )
    throw new Error(`${n.path} 缺少 P3528 GaragePreview ItemTable 字段。`);
}
function eF(n) {
  if (!n.textureKey)
    throw new Error(`${n.path} 缺少精确 ItemKart t1ImageName。`);
  return n.textureKey;
}
function tF(n) {
  if (n.fixedPlateId === void 0)
    throw new Error(`${n.path} 缺少精确 ItemKart fixedPlateId。`);
  return n.fixedPlateId;
}
function s80(n) {
  if (n.orgColorId === void 0)
    throw new Error(`${n.path} 缺少精确 ItemKart orgColorId。`);
  return n.orgColorId;
}
function nF(n, e) {
  const t = Math.trunc(e) >>> 0;
  if (n.origin === void 0) {
    ((n.origin = t), n.kart.animation.reset(t), Zv(n));
    return;
  }
  const i = (t - n.origin) >>> 0,
    r = n.kart.animation;
  (i > 6e3
    ? (r.state === 1 || r.state === 2) && r.enterState(3, t)
    : i > 1e3 && (r.state === 0 || r.state === 3) && r.enterState(1, t),
    n.hasF04 &&
      (i > 5e3
        ? (r.state === 4 || r.state === 5) && r.enterState(6, t)
        : i > 2e3 && r.state === 2 && r.enterState(4, t)));
}
function o80(n, e, t) {
  const i = Math.trunc(e) >>> 0;
  if (!t) return !1;
  if (n.transformEnabled !== !0 || n.origin === void 0)
    return (
      (n.transformEnabled = !0),
      (n.origin = i),
      n.kart.animation.reset(i),
      n.linkedPresentation && Zv(n),
      !1
    );
  const r = (i - (n.origin ?? i)) >>> 0,
    s = n.kart.animation.state;
  return (
    r > 1e3 &&
      r <= 6e3 &&
      (s === 0 || s === 3) &&
      n.kart.animation.enterState(1, i),
    n.hasF04
      ? a80(n.kart, i, r)
      : r > 6e3 && (s === 1 || s === 2) && n.kart.animation.enterState(3, i),
    r > 6e3 && n.kart.animation.state === 0
  );
}
function a80(n, e, t) {
  const i = n.animation.state;
  if (t > 6e3) {
    i === 4 || i === 5
      ? n.animation.enterState(6, e)
      : (i === 1 || i === 2) && n.animation.enterState(3, e);
    return;
  }
  t > 2e3 && i === 2 && n.animation.enterState(4, e);
}
function af(n) {
  n.character.dispose();
}
function ey(n, e, t, i, r, s = !1) {
  (n.preview
    ? (nF(n.preview, e),
      n.preview.kart.animation.updateCurrentState(e),
      T4(n.preview, e, t, i, r))
    : (n.kart.update(t, i, r), n.linkedCharacter?.update(e, t, i, r, void 0)),
    s
      ? n.shadow.update(
          YP,
          n.preview?.linkedPresentation?.simpleShadowEnabled() ?? !0,
        )
      : n.shadow.hide());
}
function Js(n) {
  if (n.preview) {
    (n.shadow.dispose(), Lt(n.preview));
    return;
  }
  (n.linkedCharacter?.dispose(), n.shadow.dispose(), n.kart.dispose());
}
function Lt(n) {
  (n.flyingPet?.dispose(),
    n.coating?.dispose(),
    n.cosmeticEffects?.dispose(),
    n.cosmeticTrails?.dispose(),
    n.particleModification?.dispose(),
    n.decorations.forEach((e) => e.dispose()),
    n.character?.dispose(),
    n.kart.renderScene?.dispose(),
    u5(n.kart.object));
}
function fT(n) {
  return n.replace(/[A-Z]/g, (e) => e.toLowerCase());
}
function iF(n) {
  const e = n.replaceAll("\\", "/").split("/");
  return e.length > 1 ? e[e.length - 2] : n.replace(/\.1s$/i, "");
}
async function Ho(n, e, t, i, r, s = !1, o = 0, a, c = !1, l = !1) {
  const u = n.get(e.path);
  if (!u?.containerId) throw new Error(`${e.path} 缺少人物容器身份。`);
  const h = n.files.filter((L) => L.containerId === u.containerId),
    d = (L) => {
      const k = (L.canonicalPath ?? L.virtualPath).replaceAll("\\", "/"),
        D = k.toLowerCase().lastIndexOf("/costume/");
      return D >= 0 ? k.slice(D + 1) : k.slice(k.lastIndexOf("/") + 1);
    },
    f = new Map(h.map((L) => [d(L).toLowerCase(), L])),
    p = await pk(n, e.internalId, e.uniform ?? "1", e.path),
    v = CR([...f.keys()], p),
    w = (L) => {
      const k = f.get(L.toLowerCase());
      if (!k) throw new Error(`${e.path} 缺少 ${L}。`);
      return k;
    },
    g = (L) =>
      n.files.find(
        (k) =>
          k.sourceName.toLowerCase() === "character_common.rho" &&
          k.name.toLowerCase() === `${L}.1s`,
      ),
    y = async (L) => {
      const k = v.motionFolder ? `${v.motionFolder}/${L}.1s` : `${L}.1s`,
        D = f.get(k.toLowerCase()) ?? g(L);
      if (!D) throw new Error(`${e.path} 缺少 ${L} 人物动作。`);
      return FI(await D.bytes());
    },
    b = w(v.model),
    A = w(v.body),
    x = v.high ? w(v.high) : void 0,
    [{ player: M, animations: E }, _] = await Promise.all([
      c80(r, y, s, o, c, l),
      a ?? Lj(n, u.sourceName),
    ]),
    C = SR([...f.keys()], v, xR(E)),
    S = new Map(
      await Promise.all(
        [...C].map(async ([L, k]) => {
          const D = w(k.kind === "direct" ? k.image : k.base),
            V = k.kind === "split" ? w(k.overlay) : void 0;
          return [
            L,
            { image: await D.bytes(), overlay: V ? await V.bytes() : void 0 },
          ];
        }),
      ),
    ),
    G = await TR(xa(await b.bytes()), await A.bytes(), S, M, t, i, {
      convertClientCoordinates: r === "card",
      highTextureBytes: x ? await x.bytes() : void 0,
      primaryColor: _.primary,
      highColor: _.high,
    }),
    I = new D1();
  return (
    I.add(G.object),
    { scene: I, character: G, roomMotion: M instanceof rk ? M : void 0 }
  );
}
async function c80(n, e, t, i, r = !1, s = !1) {
  if (s) {
    const c = await Promise.all(qp.map(e)),
      l = new Map(qp.map((u, h) => [u, c[h]]));
    return {
      player: new sk(
        l.get("f00"),
        {
          0: l.get("f08"),
          8: l.get("f45"),
          9: l.get("f46"),
          10: l.get("f47"),
          11: l.get("f48"),
          12: l.get("f49"),
          13: l.get("f50"),
          14: l.get("f51"),
          18: l.get("f11"),
          19: l.get("f54"),
        },
        t,
        !1,
      ),
      animations: c,
    };
  }
  if (n === "card") {
    const [c, l] = await Promise.all([e("f00"), e("f08")]);
    return {
      player: new ag(c, {
        3: l,
        4: l,
        5: l,
        8: l,
        9: l,
        10: l,
        11: l,
        14: l,
        19: l,
      }),
      animations: [c, l],
    };
  }
  if (n === "ready") {
    if (r && i === 0) {
      const [c, l, ...u] = await Promise.all([
          e("f00"),
          e("f21"),
          ...[1, 2, 3, 4, 5, 6, 7, 20].map((d) =>
            e(`f${String(d).padStart(2, "0")}`),
          ),
        ]),
        h = new Map([1, 2, 3, 4, 5, 6, 7, 20].map((d, f) => [d, u[f]]));
      return { player: new rk(c, l, h), animations: [c, l, ...u] };
    }
    return l80(e, i);
  }
  if (i === 1) {
    const [c, l] = await Promise.all([e("f00"), e("f10")]);
    return { player: new ok(c, { f10: l }, t), animations: [c, l] };
  }
  if (i !== 0)
    throw new Error(
      `GaragePreview characterAniType ${i} 不在 P3528 已闭合集合。`,
    );
  const [o, a] = await Promise.all([e("f00"), e("f40")]);
  return {
    player: new ag(
      o,
      { 3: a, 4: a, 5: a, 8: a, 9: a, 10: a, 11: a, 14: a, 19: a },
      t,
    ),
    animations: [o, a],
  };
}
async function l80(n, e) {
  const t = await n("f00");
  if (e === 0) return { player: new bS(t, t, 20), animations: [t] };
  if (e === 1) {
    const i = await n("f10");
    return { player: new bS(t, i, 42), animations: [t, i] };
  }
  throw new Error(`Ready characterAniType ${e} 不在 P3528 已闭合集合。`);
}
const Vi = new WeakMap();
function u80(n) {
  let e = Vi.get(n);
  return (
    e ||
      ((e = d80(n)),
      Vi.set(n, e),
      e.catch(() => {
        Vi.get(n) === e && Vi.delete(n);
      })),
    e
  );
}
function h80(n) {
  const e = Vi.get(n);
  e &&
    (Vi.delete(n),
    e.then(
      (t) => G1(t.font),
      () => {},
    ));
}
async function d80(n) {
  const e = R1(n, `${In}/garageDialog_stringBag.bml`, G3),
    t = oF(n, Qa0),
    i = R1(n, Ja0, Za0),
    r = (D0, E0) => R1(n, D0, E0).bytes().then(s2),
    [s, o, a, c, l, u, h] = await Promise.all([
      r(`${In}/myGarageDialog@zz.bml`, G3),
      r(`${R3}/garageCard@cn.bml`, B3),
      r(`${In}/tabTemplate.bml`, G3),
      r(`${In}/subTabTemplate.bml`, G3),
      r("gui_/monocoque/frame.bml", I3),
      r("gui_/monocoque/config.bml", I3),
      r(`${R3}/blinkMessageWindow.bml`, B3),
    ]),
    d = new Map(
      [
        "BigCaptionDialog",
        "CaptionDialog",
        "TabBoxLarge",
        "NoFrame",
        "DefaultTooltipNew",
      ].map((D0) => [D0, gT(l, D0)[0]]),
    ),
    f = await ma(n, Ae(s, "captionDlgFrame"), In),
    p = T(f, "autoLoadImage"),
    [v, w, ...g] = await Promise.all([
      e.bytes().then(s2),
      t.text(),
      ae(R1(n, "gui_/monocoque/CaptionDialog_new.png", I3)),
      ae(R1(n, "gui_/monocoque/frame01.png", I3)),
      ae(R1(n, "gui_/monocoque/frame02.png", I3)),
      ae(R1(n, "gui_/monocoque/frame_new01.png", I3)),
      ae(R1(n, `${In}/img_playerBG2.png`, G3)),
      ae(R1(n, `${In}/img_playerBgFrame.png`, G3)),
      ...[1, 2, 3, 4].map((D0) => ae(R1(n, `${In}/btn_search_${D0}.png`, G3))),
      ...Array.from({ length: 7 }, (D0, E0) =>
        ae(R1(n, `${R3}/${Kg(E0 + 1)}.png`, B3)),
      ),
      ae(R1(n, `${R3}/카트슬롯_선택2.png`, B3)),
      ae(R1(n, "stage_/common/대화상자정보.png", "stage_common.rho")),
      ae(R1(n, `${R3}/turning_enhancedBG.png`, B3)),
      ...[1, 2, 3, 4, 5].map((D0) =>
        ae(R1(n, `${R3}/tuning_mark_s_${D0}.png`, B3)),
      ),
      ae(R1(n, "gui_/monocoque/common_textTooltipBg.png", I3)),
      ...[1, 2, 3, 4].map((D0) =>
        ae(R1(n, `${R3}/favoriteItem_${D0}.png`, B3)),
      ),
      ...[1, 2, 3, 4].map((D0) =>
        ae(R1(n, `stage_/common/${p}${D0}.png`, "stage_common.rho")),
      ),
    ]),
    [
      y,
      b,
      A,
      x,
      M,
      E,
      _,
      C,
      S,
      G,
      I,
      L,
      k,
      D,
      V,
      K,
      P,
      q,
      e0,
      Q,
      U,
      O,
      F,
      z,
      Y,
      X,
      l0,
      r0,
      j,
      F0,
      ...O0
    ] = g,
    z0 = [_, C, S, G],
    W = [l0, r0, j, F0];
  W.forEach((D0, E0) => lf(D0, 22, 22, `favoriteItem_${E0 + 1}`));
  const R2 = new Map([
      [1, I],
      [2, L],
      [3, k],
      [4, D],
      [5, V],
      [6, K],
      [7, P],
    ]),
    I0 = new Map([
      [1, U],
      [2, O],
      [3, F],
      [4, z],
      [5, Y],
    ]);
  (R2.forEach((D0, E0) => lf(D0, 464, 198, Kg(E0))),
    lf(q, 464, 198, "카트슬롯_选择2"));
  const o2 = new Map([...p80(w), ...f80(v)]),
    G0 = await g80(i);
  return {
    definition: s,
    cardDefinition: o,
    tabDefinition: a,
    subTabDefinition: c,
    noticeDefinition: h,
    closeDefinition: f,
    close: O0,
    frames: d,
    buttonStyles: new Map(
      ["ok", "cancel"].map((D0) => [D0, m4(Ae(s, D0), u, l)]),
    ),
    tabStyle: m4(a, u, l),
    subTabStyle: m4(c, u, l),
    grid: vl(Ae(s, "itemList")),
    scrollbar: Hv(Ae(s, "itemListBar"), l),
    selectedFrame: gT(l, "GreenBorderLinePanel")[0],
    caption: y,
    captionOffset: an(Ae(s, "captionDlgFrame"), u),
    noticeCaptionOffset: an(h, u),
    noticeIcon: e0,
    frame01: b,
    frame02: A,
    buttonFrame: x,
    previewBackground: M,
    previewFrame: E,
    search: z0,
    searchTooltipFrame: X,
    favoriteMark: W,
    card: D,
    qualityCards: R2,
    selectedCard: q,
    levelBackground: Q,
    xunLevelBadges: I0,
    strings: o2,
    font: G0,
  };
}
function cf(n, e, t) {
  const i = n.find((r) => r.itemId === e);
  if (!i) throw new Error(`当前${t} item id ${e} 不在 P3528 离线车库目录中。`);
  return i;
}
function pT(n, e, t) {
  j6(e);
  const i = n.find((r) => r.itemId === e && (e !== 0 || r.systemKey === t));
  if (!i) throw new Error(`当前车辆 item id ${e} 不在 P3528 离线车库目录中。`);
  return i;
}
function f80(n) {
  const e = new Map();
  return (
    n.children.forEach((t) => {
      const i = T(t, "n"),
        r = t.children.find((o) => T(o, "c") === "cn"),
        s = r && T(r, "v");
      i !== void 0 && s !== void 0 && e.set(i, s);
    }),
    e
  );
}
function p80(n) {
  const e = new DOMParser().parseFromString(n, "application/xml");
  if (e.querySelector("parsererror"))
    throw new Error("P3528 baseStringBag.xml 不是有效 XML。");
  const t = new Map();
  return (
    Array.from(e.documentElement.children).forEach((i) => {
      const r = i.getAttribute("n"),
        o = Array.from(i.children)
          .find((a) => a.getAttribute("c") === "cn")
          ?.getAttribute("v");
      r !== null && o !== null && o !== void 0 && t.set(r, o);
    }),
    t
  );
}
async function ae(n) {
  const e = await p2(await n.bytes()),
    t = document.createElement("canvas");
  ((t.width = e.width), (t.height = e.height));
  const i = t.getContext("2d");
  if (!i) throw new Error(`浏览器无法创建 ${n.virtualPath} 的 Canvas。`);
  const r = new Uint8ClampedArray(e.pixels.length);
  return (
    r.set(e.pixels),
    i.putImageData(new ImageData(r, e.width, e.height), 0, 0),
    { width: e.width, height: e.height, image: t }
  );
}
async function g80(n) {
  return f5(Nn, await n.bytes());
}
function lf(n, e, t, i) {
  if (n.width !== e || n.height !== t)
    throw new Error(`P3528 ${i} 应为 ${e}x${t}，实际 ${n.width}x${n.height}。`);
}
function yl(n, e) {
  const t = V0(Ae(n, "shopItemContainer"), e);
  return { ...t, y: t.y + 2 };
}
function rF(n, e, t, i) {
  const r = E9(t, { x: 0, y: 0, width: 0, height: 0 });
  return V0(n, e, t, void 0, {
    width: i.width - r.width,
    height: i.height + r.y - r.height,
  });
}
function sF(n, e) {
  const t = jc(n, { x: 0, y: 0, width: 1600, height: 900 }, e),
    i = new Map([...t].map(([r, s]) => [T(r, "name") ?? "", s]));
  return (
    i.set("itemListBar", V0(Ae(n, "itemListBar"), i.get("itemSelect"))),
    i
  );
}
function Ae(n, e) {
  const t = [n];
  for (; t.length > 0;) {
    const i = t.pop();
    if (T(i, "name") === e) return i;
    t.push(...i.children);
  }
  throw new Error(`P3528 GarageDialog 缺少节点：${e}。`);
}
function gT(n, e) {
  const t = n.children.find((i) => i.name === e);
  if (!t) throw new Error(`P3528 GarageDialog 缺少窗口帧：${e}。`);
  return t.children.map(Ft);
}
function uf(n, e, t) {
  n.drawImage(e.image, t.x, t.y, t.width, t.height);
}
function m80(n, e, t, i) {
  n.drawImage(
    e.image,
    t.x,
    t.y,
    t.width,
    t.height,
    i.x,
    i.y,
    i.width,
    i.height,
  );
}
function kn(n, e, t, i, r, s, o = "label") {
  m9(n, e, t, {
    kind: o,
    family: Nn,
    size: i,
    color: r,
    align: s,
    verticalAlign: "center",
  });
}
function R1(n, e, t) {
  const i = oF(n, e);
  if (i.sourceKind !== "rho" || i.sourceName.toLowerCase() !== t.toLowerCase())
    throw new Error(`${e} 必须来自 ${t}。`);
  return i;
}
function oF(n, e) {
  const t = n.canonicalCandidates(e);
  if (t.length !== 1)
    throw new Error(`${e} source 数量必须为 1，实际 ${t.length}。`);
  return t[0];
}
const w80 = Object.freeze(
    Object.defineProperty(
      {
        __proto__: null,
        GarageLivePanels: E7,
        TimeAttackGarageView: C7,
        createGaragePreviewCoating: JP,
        disposeGaragePreview: Lt,
        disposeKartPanel: Js,
        disposeTimeAttackGarageAssetCache: h80,
        garageCardFloorRay: XP,
        garageCardQualityTextureName: Kg,
        garageDialogHoverSoundAllowed: jP,
        garageItemPanelRect: yl,
        garageNoticeRects: Wo,
        garagePreviewCharacterOwners: Yv,
        garageSearchTooltipRect: rF,
        garageTransformBoosterState: ZP,
        garageWindowRects: sF,
        loadEquipmentPreview: Jv,
        loadGarageKartPanel: Qv,
        loadGaragePreview: T7,
        shouldCreateParticleOwnerForGarageMode: QP,
        updateGarageKartPanel: ey,
        updateGaragePreviewRender: T4,
      },
      Symbol.toStringTag,
      { value: "Module" },
    ),
  ),
  v80 = "stage_/timeAttackReady/mq_window@zz.bml",
  y80 = "stage_/timeAttackReady/stage_stringBag.bml",
  aF = "etc_/baseStringBag.xml",
  A80 = "gui_/monocoque/frame01.png",
  b80 = "gui_/monocoque/frame.bml",
  M80 = "gui_/monocoque/config.bml",
  x80 = "gui_/font/SourceHanSansCN-Bold.otf",
  Al = "stage_timeAttackReady.rho",
  hf = "gui_monocoque.rho",
  S80 = "gui_font.rho",
  cF = "P3528 Source Han Sans CN Ready",
  C80 = "캐릭터창",
  Sc = 1600,
  Cc = 900,
  Ni = 586,
  Es = 480,
  E80 = (350 / Ni) * 2.3,
  jg = "timeAttack_main_iconBooster",
  qo = "timeAttack_main_iconGhost",
  Xg = "timeAttack_main_iconMode",
  T80 = new Map([
    ["S7", { speed: 7 }],
    ["S4", { speed: 4 }],
    ["indiBoosterBtn", { booster: 0 }],
    ["teamBoosterBtn", { booster: 1 }],
    ["onBtn", { showGhost: !0 }],
    ["offBtn", { showGhost: !1 }],
  ]),
  _80 = new Set([
    "clearPanel",
    "difficulty",
    "duel",
    "duelInfoPanel",
    "dualTabBtnPanel",
    "vsIconOn",
  ]),
  G80 = new Map([
    ["setting", "setting"],
    ["record", "time"],
    ["kart", "kart"],
    ["crash", "crash"],
    ["booster", "booster"],
  ]);
class ty {
  constructor(e, t, i) {
    ((this.options = e), (this.assets = t), (this.preview = i));
    const r = this.canvas.getContext("2d", { alpha: !0 });
    if (!r) throw new Error("浏览器无法创建 P3528 Ready 2D Canvas。");
    ((this.context = r),
      (this.readyOptions = e.randomGroup
        ? { ...e.initialOptions, showGhost: !1 }
        : { ...e.initialOptions }));
    const s = e.recordFor(this.readyOptions);
    ((this.record = yT(s, t.strings, this.readyOptions.version ?? ze)),
      (this.hasReplay = s?.hasGhost === !0),
      Object.assign(this.canvas.style, {
        position: "absolute",
        inset: "0",
        width: "100%",
        height: "100%",
        imageRendering: "pixelated",
        pointerEvents: "auto",
      }),
      (this.canvas.dataset.uiLayer = "stage"),
      (this.canvas.hidden = !0),
      this.canvas.setAttribute("aria-hidden", "true"),
      this.canvas.setAttribute("aria-label", Yn("#sb(timeAttack)", t.strings)),
      this.canvas.setAttribute("role", "application"),
      this.canvas.addEventListener("pointermove", this.onPointerMove),
      this.canvas.addEventListener("pointerdown", this.onPointerDown),
      this.canvas.addEventListener("pointerup", this.onPointerUp),
      this.canvas.addEventListener("pointercancel", this.onPointerCancel),
      this.canvas.addEventListener("pointerleave", this.onPointerLeave),
      e.root.append(this.canvas),
      (this.resizeObserver = new ResizeObserver(() => this.onViewportResize())),
      this.resizeObserver.observe(e.root),
      window.addEventListener("resize", this.onViewportResize));
  }
  options;
  assets;
  preview;
  canvas = document.createElement("canvas");
  context;
  resizeObserver;
  nodeIds = new WeakMap();
  record;
  hasReplay = !1;
  readyOptions;
  buttonHits = [];
  nextNodeId = 0;
  hoveredButton;
  pressedButton;
  renderTimeMs = 0;
  shown = !1;
  disposed = !1;
  frozen = !1;
  onViewportResize = () => {
    !this.shown || this.frozen || (this.resizeCanvas(), this.render());
  };
  static async load(e) {
    const t = await R80(e.library, e.trackPath, e.trackId, e.randomGroup);
    let i;
    try {
      return (
        (i = await ny.load(
          e.library,
          e.kart,
          e.character,
          e.environment,
          e.stageBinding,
          e.profile,
        )),
        new ty(e, t, i)
      );
    } catch (r) {
      throw (i?.dispose(), G1(t.font), r);
    }
  }
  show() {
    this.disposed ||
      ((this.shown = !0),
      (this.canvas.hidden = !1),
      this.canvas.setAttribute("aria-hidden", "false"),
      this.resizeCanvas(),
      this.render());
  }
  hide() {
    ((this.shown = !1),
      (this.canvas.hidden = !0),
      this.canvas.setAttribute("aria-hidden", "true"));
  }
  activateTrainingShortcut() {
    !this.shown ||
      this.disposed ||
      (this.options.onInteraction?.(), this.activateButton("training"));
  }
  render(e = performance.now()) {
    if (!this.shown || this.disposed || this.frozen) return;
    ((this.renderTimeMs = e),
      this.context.clearRect(0, 0, Sc, Cc),
      (this.context.imageSmoothingEnabled = !0),
      (this.buttonHits = []));
    const t = { x: 0, y: 0, width: Sc, height: Cc };
    (this.drawNode(this.assets.definition, t),
      (this.canvas.style.cursor =
        this.hoveredButton === void 0 ? "default" : "pointer"));
  }
  freeze() {
    this.disposed ||
      ((this.frozen = !0), (this.canvas.style.pointerEvents = "none"));
  }
  unfreeze() {
    this.disposed ||
      ((this.frozen = !1),
      (this.canvas.style.pointerEvents = "auto"),
      this.resizeCanvas(),
      this.render(this.renderTimeMs || performance.now()));
  }
  dispose() {
    this.disposed ||
      ((this.disposed = !0),
      this.resizeObserver.disconnect(),
      window.removeEventListener("resize", this.onViewportResize),
      this.canvas.removeEventListener("pointermove", this.onPointerMove),
      this.canvas.removeEventListener("pointerdown", this.onPointerDown),
      this.canvas.removeEventListener("pointerup", this.onPointerUp),
      this.canvas.removeEventListener("pointercancel", this.onPointerCancel),
      this.canvas.removeEventListener("pointerleave", this.onPointerLeave),
      this.preview.dispose(),
      this.canvas.remove(),
      G1(this.assets.font));
  }
  resizeCanvas() {
    const e = this.options.root.getBoundingClientRect(),
      t = Sr(e.width, e.height, window.devicePixelRatio, Sc, Cc);
    (this.canvas.width !== t.width && (this.canvas.width = t.width),
      this.canvas.height !== t.height && (this.canvas.height = t.height),
      this.context.setTransform(t.scaleX, 0, 0, t.scaleY, 0, 0));
  }
  get reverseTrack() {
    return /_rvs$/i.test(this.options.trackId);
  }
  drawNode(e, t, i) {
    if (
      !fF(
        e,
        this.hasReplay,
        this.reverseTrack,
        this.options.randomGroup !== void 0,
      )
    )
      return;
    const r = T(e, "frame"),
      s = r === void 0 ? void 0 : this.assets.frames.get(r),
      o = this.assets.images.get(T(e, "texture") ?? ""),
      a = V0(e, t, s, o);
    let c = a;
    (s && (C9(this.context, s, this.assets.frame.image, a), (c = E9(s, a))),
      this.drawNodeSelf(e, a, i),
      this.drawNodeChildren(e, c),
      this.drawNodeCaption(e, a, s));
  }
  drawNodeChildren(e, t) {
    (e.children.forEach((i) => {
      (this.options.randomGroup && T(i, "name") === "trackInfoPanel") ||
        this.drawNode(i, t, e);
    }),
      T(e, "name") === "trackCardPanel" &&
        !this.options.randomGroup &&
        this.drawNode(this.assets.trackDifficulty, t));
  }
  drawNodeCaption(e, t, i) {
    e.name === "CaptionWindow" && i && this.drawCaptionTitle(e, t, i);
  }
  drawNodeSelf(e, t, i) {
    (T(e, "name") === "randomInfoText" &&
    this.options.randomGroup &&
    this.assets.randomInfoText
      ? fs(this.context, this.assets.randomInfoText, t)
      : e.name === "Label"
        ? this.drawLabel(e, t, i)
        : e.name === "ImageButton"
          ? this.drawImageButton(e, t)
          : e.name === "CharPanel"
            ? this.drawCharPanel(e, t)
            : this.drawNodeImage(e, t, i),
      T(e, "name") === C80 && this.drawRiderPreview(t, i));
  }
  drawNodeImage(e, t, i) {
    e.name === "ImageBoard"
      ? this.drawImageBoard(e, t)
      : e.name === "Panel" && this.drawPanel(e, t, i);
  }
  drawRiderPreview(e, t) {
    const i = t?.children.find((r) => T(r, "name") === "캐릭터창_training");
    if (!i) throw new Error("P3528 READY 缺少车手预览的训练布局。");
    this.preview.render(this.context, V0(i, e), this.renderTimeMs);
  }
  drawCaptionTitle(e, t, i) {
    const r = Yn("#sb(timeAttack)", this.assets.strings),
      s = f3(i, t, an(e, this.assets.frameConfig));
    df(this.context, r, s, {
      kind: "button",
      render: "bold20",
      align: "center",
      color: bl("white"),
    });
  }
  drawImageBoard(e, t) {
    const i = Oi(e, "image");
    fs(this.context, pf(this.assets.images, i), t);
  }
  drawPanel(e, t, i) {
    if (T(e, "name") === "thumb") {
      fs(this.context, this.assets.randomCard ?? this.assets.trackCard, t);
      return;
    }
    if (wT(i)) {
      fs(this.context, this.assets.trackIcon, t);
      return;
    }
    const r = P80(T(e, "texture"), this.readyOptions);
    r !== void 0 && fs(this.context, pf(this.assets.images, r), t);
    const s = T(e, "color");
    s !== void 0 && X80(this.context, t, s);
  }
  drawLabel(e, t, i) {
    const r = wT(i)
        ? this.options.randomGroup
          ? W80(this.options.randomGroup)
          : `${this.reverseTrack ? "[反]" : ""}${this.assets.trackTitle}`
        : Y80(e, i, this.record),
      s = Yn(r, this.assets.strings);
    df(this.context, s, t, {
      render: T(e, "textRender") ?? "bold14",
      align: T(e, "textAlign") ?? "left",
      color: bl(T(e, "textColor") ?? "white"),
      strokeColor: bl(T(e, "textColor2") ?? "255 0 0 0"),
    });
  }
  drawCharPanel(e, t) {
    const i = pf(this.assets.images, Oi(e, "texture")),
      r = ga(e, i);
    for (const s of pa(r, Oi(e, "text")))
      this.context.drawImage(
        i.image,
        s.u0 * i.width,
        s.v0 * i.height,
        (s.u1 - s.u0) * i.width,
        (s.v1 - s.v0) * i.height,
        t.x + s.left,
        t.y + s.top,
        s.right - s.left,
        s.bottom - s.top,
      );
  }
  drawImageButton(e, t) {
    const i = this.nodeId(e),
      r = T(e, "name") ?? i,
      s = Oi(e, "autoLoadImage"),
      o =
        this.options.randomGroup !== void 0 &&
        (r === "onBtn" || r === "offBtn"),
      a = o
        ? r === "offBtn"
          ? 4
          : 1
        : Z80(i, r, this.readyOptions, this.hoveredButton, this.pressedButton),
      c = this.assets.buttonImages.get(s);
    if (!c) throw new Error(`P3528 Ready button ${s} 没有四态图片。`);
    (ct(this.context, c[a - 1], t),
      this.drawButtonText(e, t, a),
      a !== 4 &&
        !o &&
        (this.buttonHits = [...this.buttonHits, { id: i, name: r, rect: t }]));
  }
  drawButtonText(e, t, i) {
    const r = T(e, "text");
    if (r === void 0) return;
    const s = this.assets.buttonStyles.get(e)?.states[i - 1];
    if (!s) throw new Error("P3528 Ready button 缺少原版四态文字样式。");
    df(this.context, Yn(r, this.assets.strings), t, {
      kind: "button",
      render: s.textRender,
      align: T(e, "textAlign") ?? "center",
      color: s.textColor,
    });
  }
  nodeId(e) {
    const t = this.nodeIds.get(e);
    if (t !== void 0) return t;
    const i = `ready-button-${this.nextNodeId++}`;
    return (this.nodeIds.set(e, i), i);
  }
  hitButton(e) {
    const t = this.canvas.getBoundingClientRect(),
      i = ((e.clientX - t.left) * Sc) / t.width,
      r = ((e.clientY - t.top) * Cc) / t.height;
    return [...this.buttonHits].reverse().find((s) => Oe(i, r, s.rect));
  }
  onPointerMove = (e) => {
    const t = this.hitButton(e)?.id;
    t !== this.hoveredButton &&
      ((this.hoveredButton = t),
      t !== void 0 && this.options.onHover?.(),
      this.render());
  };
  onPointerDown = (e) => {
    const t = this.hitButton(e);
    !t ||
      e.button !== 0 ||
      (this.options.onInteraction?.(),
      (this.hoveredButton = t.id),
      (this.pressedButton = t.id),
      this.canvas.setPointerCapture(e.pointerId),
      this.render());
  };
  onPointerUp = (e) => {
    const t = this.hitButton(e),
      i = t && t.id === this.pressedButton ? t.name : void 0;
    if (
      ((this.pressedButton = void 0),
      this.canvas.hasPointerCapture(e.pointerId) &&
        this.canvas.releasePointerCapture(e.pointerId),
      i === void 0)
    ) {
      this.render();
      return;
    }
    this.activateButton(i);
  };
  activateButton(e) {
    if (
      (e === "training"
        ? this.options.onStartActivate?.()
        : this.options.onActivate?.(),
      this.selectReadyOption(e))
    ) {
      this.render();
      return;
    }
    (this.render(),
      e === "training"
        ? this.options.onTraining(this.readyOptions)
        : e === "selectTrackBtn"
          ? this.options.onTrackSelect(this.readyOptions)
          : e === "myItemBtn"
            ? this.options.onItemSelect(this.readyOptions)
            : e === "exit" && this.options.onExit?.(this.readyOptions));
  }
  refreshRecord() {
    const e = this.options.recordFor(this.readyOptions);
    ((this.record = yT(
      e,
      this.assets.strings,
      this.readyOptions.version ?? ze,
    )),
      (this.hasReplay = e?.hasGhost === !0));
  }
  setSpeedChannel(e) {
    Ue(this.readyOptions) !== Ue({ ...this.readyOptions, ...e }) &&
      this.applyReadyOptions({ ...this.readyOptions, ...e });
  }
  selectReadyOption(e) {
    const t = J80(this.readyOptions, e);
    return t === this.readyOptions ? !1 : (this.applyReadyOptions(t), !0);
  }
  applyReadyOptions(e) {
    const t =
      Ue(e) !== Ue(this.readyOptions) ||
      e.booster !== this.readyOptions.booster;
    ((this.readyOptions = e), t && this.refreshRecord());
  }
  onPointerCancel = (e) => {
    ((this.pressedButton = void 0),
      this.canvas.hasPointerCapture(e.pointerId) &&
        this.canvas.releasePointerCapture(e.pointerId),
      this.render());
  };
  onPointerLeave = () => {
    ((this.hoveredButton = void 0), this.render());
  };
}
class ny {
  constructor(e, t) {
    ((this.preview = e),
      (this.stageBinding = t),
      (this.renderer.outputColorSpace = qe),
      this.renderer.setClearColor(0, 0),
      this.renderer.setSize(Ni, Es, !1));
  }
  preview;
  stageBinding;
  renderer = new I4({
    alpha: !0,
    preserveDrawingBuffer: !0,
    powerPreference: "high-performance",
  });
  camera = B80();
  static async load(e, t, i, r, s, o) {
    let a;
    try {
      return (
        (a = await T7(e, t, i, r, s, new Tr(), "ready", o)),
        new ny(a, s)
      );
    } catch (c) {
      throw (a && Lt(a), c);
    }
  }
  render(e, t, i) {
    (this.stageBinding.beginFrame(i),
      this.preview.kart.animation.updateCurrentState(i),
      T4(this.preview, i, this.camera, Ni, Es),
      this.preview.flyingPet?.update(i, this.camera, Ni, Es),
      this.preview.decorations.forEach((r) =>
        r.scene.update(i, this.camera, Ni, Es),
      ),
      NP(this.renderer, e, t, () => {
        f4(this.renderer, this.preview.scene, this.camera);
      }));
  }
  dispose() {
    (Lt(this.preview), this.renderer.dispose());
  }
}
function B80() {
  const n = Ni / Es,
    e = new Z9(we(75 / E80, n), n, 0.5, 100),
    t = new H(0.2, 0.8, 0);
  return (e.position.copy(t).sub(new H(2.5, -0.5, -4.5)), e.lookAt(t), e);
}
async function R80(n, e, t, i) {
  const r = et(n, v80, Al),
    s = et(n, y80, Al),
    o = gF(n, aF),
    a = et(n, A80, hf),
    c = et(n, b80, hf),
    l = et(n, M80, hf),
    u = et(n, x80, S80),
    [h, d, f, p, v, w, g] = await Promise.all([
      r.bytes().then(s2),
      s.bytes().then(s2),
      o.text(),
      K5(a),
      K5(O80(n, e)),
      c.bytes().then(s2),
      l.bytes().then(s2),
    ]),
    y = w.children
      .find((P) => P.name === "CaptionDialog")
      ?.children.find((P) => P.name === "Activated");
  if (!y) throw new Error("P3528 READY 缺少 CaptionDialog.Activated。");
  const b = Ft(y);
  if (b.texture !== "frame01")
    throw new Error(`P3528 READY 未加载 frame ${b.texture}。`);
  const A = new Map([["CaptionDialog", b]]),
    x = h.children.find((P) => P.name === "CaptionWindow"),
    M = await ma(n, x, "stage_/timeAttackReady"),
    E = {
      ...h,
      children: h.children.map((P) =>
        P === x && M ? { ...P, children: [...P.children, M] } : P,
      ),
    },
    _ = new Map();
  M6(E, !0, (P) => {
    P.name === "ImageButton" && _.set(P, m4(P, g, w));
  });
  const C = L80(E);
  F80(C);
  const S = await D80(n, C.imageTokens),
    G = await I80(n, t),
    I = new Map([...S, ...G.images]),
    L = await V80(n, C.buttonTokens),
    k = i
      ? await K5(
          et(
            n,
            `dialog2_/selectTrackEx/${i.cardToken}.png`,
            "dialog2_selectTrackEx.rho",
          ),
        )
      : void 0,
    D = i
      ? await K5(
          et(
            n,
            "stage_/timeAttackReady/timeAttack_main_randomInfoText@cn.png",
            Al,
          ),
        )
      : void 0,
    V = new Map([...$80(f), ...U80(d)]),
    K = await z80(u);
  return {
    definition: E,
    frameConfig: g,
    strings: V,
    frame: p,
    frames: A,
    trackCard: v,
    randomCard: k,
    randomInfoText: D,
    ...G,
    images: I,
    buttonImages: L,
    buttonStyles: _,
    font: K,
  };
}
async function I80(n, e) {
  const t = await n.trackMetadata(e),
    i = t && wa(t);
  if (!t?.cnTitle || t.difficulty === void 0 || !i)
    throw new Error(`P3528 READY 地图 ${e} 缺少名称、难度或主题。`);
  const r = "gui_/windowTemplate",
    s = "gui_windowTemplate.rho",
    [o, a, c, l] = await Promise.all([
      et(n, `${r}/trackDifficulty.bml`, s).bytes().then(s2),
      K5(
        et(n, `dialog2_/selectTrackEx/${i}_1.png`, "dialog2_selectTrackEx.rho"),
      ),
      K5(et(n, `${r}/난이도text@cn.png`, s)),
      K5(et(n, `${r}/난이도원.png`, s)),
    ]);
  return {
    trackTitle: t.cnTitle,
    trackIcon: a,
    trackDifficulty: k80(o, t.difficulty),
    images: new Map([
      ["난이도text@zz", c],
      ["난이도원", l],
    ]),
  };
}
function k80(n, e) {
  const t = Array.from({ length: 6 }, (i, r) => (r < e ? "1" : "0")).join("");
  return {
    ...n,
    attributes: [
      ...n.attributes.filter((i) => !["name", "visible"].includes(i.name)),
      { name: "name", value: "difficultyPanel" },
      { name: "visible", value: "true" },
    ],
    children: n.children.map((i) =>
      i.name === "CharPanel"
        ? {
            ...i,
            attributes: [
              ...i.attributes.filter((r) => r.name !== "text"),
              { name: "text", value: t },
            ],
          }
        : i,
    ),
  };
}
function L80(n) {
  const e = new Set(),
    t = new Set();
  let i = 0,
    r = 0;
  return (
    M6(
      n,
      !1,
      (s) => {
        const o = T(s, s.name === "ImageBoard" ? "image" : "texture");
        (o !== void 0 &&
          (s.name === "ImageBoard" || s.name === "Panel") &&
          mT(e, o),
          s.name === "ImageBoard" && (i += 1),
          s.name === "ImageButton" &&
            (t.add(Oi(s, "autoLoadImage")), (r += 1)));
      },
      !0,
    ),
    M6(n, !0, (s) => {
      const o = T(s, s.name === "ImageBoard" ? "image" : "texture");
      (o !== void 0 &&
        (s.name === "ImageBoard" || s.name === "Panel") &&
        mT(e, o),
        s.name === "ImageButton" && t.add(Oi(s, "autoLoadImage")));
    }),
    { imageTokens: e, buttonTokens: t, imageBoardCount: i, buttonCount: r }
  );
}
function Yg(n) {
  return `${jg}${n}`;
}
function Zg(n) {
  return `${Xg}${n}`;
}
function mT(n, e) {
  uF(e)
    ? (n.add(Yg(0)), n.add(Yg(1)))
    : hF(e)
      ? (n.add(Zg(7)), n.add(Zg(4)))
      : lF(e)
        ? (n.add(`${qo}1`), n.add(`${qo}2`))
        : n.add(e);
}
function P80(n, e) {
  if (n !== void 0)
    return uF(n)
      ? Yg(e.booster)
      : hF(n)
        ? Zg(e.speed)
        : lF(n)
          ? `${qo}${e.showGhost ? 1 : 2}`
          : n;
}
function lF(n) {
  return n === `${qo}1` || n === `${qo}2`;
}
function uF(n) {
  return n.startsWith(jg) && /^[012]$/.test(n.slice(jg.length));
}
function hF(n) {
  return n.startsWith(Xg) ? /^(?:1|4|7|Default)$/.test(n.slice(Xg.length)) : !1;
}
function M6(n, e, t, i = !1) {
  fF(n, e, i, !1) && (t(n), n.children.forEach((r) => M6(r, e, t, i)));
}
function F80(n) {
  if (n.imageBoardCount !== 3)
    throw new Error(
      `P3528 Ready training ImageBoard 应为 3，实际 ${n.imageBoardCount}。`,
    );
  if (n.buttonCount !== 8)
    throw new Error(
      `P3528 Ready 无回放纪录时 ImageButton（含标题栏关闭按钮）应为 8，实际 ${n.buttonCount}。`,
    );
}
async function D80(n, e) {
  const t = await Promise.all([...e].map(async (i) => [i, await K5(dF(n, i))]));
  return new Map(t);
}
async function V80(n, e) {
  const t = await Promise.all(
    [...e].map(async (i) => [
      i,
      await Promise.all([1, 2, 3, 4].map(async (r) => K5(dF(n, N80(i, r))))),
    ]),
  );
  return new Map(t);
}
function dF(n, e) {
  const t = e.endsWith("@zz") ? [`${e.slice(0, -3)}@cn`, e] : [e],
    i = [
      { directory: "stage_/timeAttackReady", owner: Al },
      { directory: "stage_/common", owner: "stage_common.rho" },
    ];
  for (const r of t)
    for (const s of i) {
      const o = `${s.directory}/${r}.png`,
        a = ec0(n, o, s.owner);
      if (a) return a;
    }
  throw new Error(
    `P3528 Ready image ${e} 缺少 Ready/current → common、CN → ZZ 资源。`,
  );
}
function N80(n, e) {
  return n.endsWith("@zz") ? `${n.slice(0, -3)}${e}@zz` : `${n}${e}`;
}
function O80(n, e) {
  const t = n.get(e);
  if (!t) throw new Error(`P3528 Ready 找不到选择的赛道 ${e}。`);
  const i = nc0(t.canonicalPath ?? t.virtualPath),
    r = i.lastIndexOf("/"),
    s = `${r < 0 ? "" : i.slice(0, r + 1)}xt_trackCard.png`,
    o = n.resolveContainerPath(e, s);
  if (o.status === "found") return o.entry;
  throw o.status === "ambiguous"
    ? new Error(`${s} 在选择赛道 container 内不唯一。`)
    : new Error(`${s} 不在选择赛道的同一 container 内。`);
}
async function K5(n) {
  const e = await p2(await n.bytes()),
    t = document.createElement("canvas");
  ((t.width = e.width), (t.height = e.height));
  const i = t.getContext("2d");
  if (!i) throw new Error(`浏览器无法创建 ${n.virtualPath} 的 Canvas。`);
  const r = new Uint8ClampedArray(e.pixels.length);
  return (
    r.set(e.pixels),
    i.putImageData(new ImageData(r, e.width, e.height), 0, 0),
    { width: e.width, height: e.height, image: t }
  );
}
async function z80(n) {
  return f5(cF, await n.bytes());
}
function U80(n) {
  const e = new Map();
  return (
    n.children.forEach((t) => {
      const i = T(t, "n"),
        r = t.children.find((o) => T(o, "c") === "cn"),
        s = r && T(r, "v");
      i !== void 0 && s !== void 0 && e.set(i, s);
    }),
    e
  );
}
function $80(n) {
  const e = new DOMParser().parseFromString(n, "application/xml");
  if (e.querySelector("parsererror"))
    throw new Error(`P3528 ${aF} 不是有效 XML。`);
  const i = new Map();
  return (
    Array.from(e.documentElement.children).forEach((r) => {
      const s = r.getAttribute("n"),
        a = Array.from(r.children)
          .find((c) => c.getAttribute("c") === "cn")
          ?.getAttribute("v");
      s !== null && a !== null && a !== void 0 && i.set(s, a);
    }),
    i
  );
}
function Yn(n, e) {
  const t = /^#sb\(([^)]+)\)$/.exec(n);
  return t ? (e.get(t[1]) ?? n) : n;
}
function fF(n, e, t = !1, i = !1) {
  const r = T(n, "name");
  return r === "rvs"
    ? t
    : r === "randomInfoText"
      ? i
      : r !== void 0 && _80.has(r)
        ? !1
        : r === "shadowBtnPanel"
          ? e
          : n.name === "Label" && r === "desc"
            ? T(n, "text") === "#sb(invalidShadow)" && !e
            : T(n, "visible") !== "false"
              ? !0
              : r === "training";
}
function W80(n) {
  return n.randomType === "hot1"
    ? "人气随机（极易）"
    : n.randomType === "hot2"
      ? "人气随机（简单）"
      : n.randomType === "hot3"
        ? "人气随机（普通）"
        : n.randomType === "hot4"
          ? "人气随机（困难）"
          : n.randomType === "hot5"
            ? "人气随机（极难）"
            : n.cardToken === "speedAllRandom_TimeAttack@zz"
              ? "竞速随机"
              : n.randomType === "all"
                ? "全部随机"
                : n.randomType === "speedAll"
                  ? "竞速随机"
                  : n.randomType === "clubSpeed"
                    ? "专业竞速随机"
                    : n.randomType === "new"
                      ? "新图随机"
                      : n.randomType === "reverse"
                        ? "反方向随机"
                        : n.randomType === "crazy"
                          ? "疯狂随机"
                          : n.level === void 0
                            ? n.randomType
                            : `${n.randomType}:${n.level}`;
}
function wT(n) {
  return n !== void 0 && T(n, "name") === "trackInfoPanel";
}
function fs(n, e, t) {
  n.drawImage(e.image, t.x, t.y, t.width, t.height);
}
function df(n, e, t, i) {
  const r = H80(i.render),
    s = q80(i.align);
  m9(n, e, t, {
    kind: i.kind ?? "label",
    family: cF,
    size: r,
    color: i.color,
    align: K80(s),
    verticalAlign: j80(s),
    stroke: i.render === "outline16" ? 1 : 0,
    strokeColor: i.strokeColor,
  });
}
function H80(n) {
  const e = /(?:bold|outline)(14|16|20)$/.exec(n);
  if (!e) throw new Error(`P3528 Ready textRender=${n} 未被准入。`);
  return Number(e[1]);
}
const vT = new Map();
function q80(n) {
  let e = vT.get(n);
  return (
    e || ((e = new Set(n.split(/[,|.;\s]+/).filter(Boolean))), vT.set(n, e)),
    e
  );
}
function K80(n) {
  return n.has("right")
    ? "right"
    : n.has("center") || n.has("hcenter")
      ? "center"
      : "left";
}
function j80(n) {
  return n.has("bottom")
    ? "bottom"
    : n.has("vcenter") || n.has("center")
      ? "center"
      : "top";
}
function X80(n, e, t) {
  ((n.fillStyle = bl(t)), n.fillRect(e.x, e.y, e.width, e.height));
}
function bl(n) {
  if (n.toLowerCase() === "white") return "rgba(255, 255, 255, 1)";
  const [e, t, i, r] = tc0(n, 4, "color");
  return `rgba(${t}, ${i}, ${r}, ${e / 255})`;
}
function Y80(n, e, t) {
  if (T(n, "name") !== "value" || e === void 0) return T(n, "text") ?? "";
  const i = G80.get(T(e, "name") ?? "");
  return i === void 0 ? (T(n, "text") ?? "") : t[i];
}
function yT(n, e, t) {
  if (!n) return { setting: "", time: "", kart: "", crash: "", booster: "" };
  const i = Yn(`#sb(speedS${n.speed})`, e),
    r = zv(t, n.speed),
    s = i !== "" ? i : r ? VP(r, (h) => Yn(h, e)) : String(n.speed),
    o = Yn(`#sb(${n.booster === 0 ? "indiGame" : "teamGame"})`, e),
    a = Yn("#sb(countUnit2)", e),
    c = Math.floor(n.elapsedMs / 6e4),
    l = Math.floor(n.elapsedMs / 1e3) % 60,
    u = Math.floor(n.elapsedMs / 10) % 100;
  return {
    setting: `${s} [${o}]`,
    time: `${ff(c)}:${ff(l)}:${ff(u)}`,
    kart: n.kartName,
    crash: n.crashCount === void 0 ? "" : `${n.crashCount} ${a}`,
    booster: n.boosterCount === void 0 ? "" : `${n.boosterCount} ${a}`,
  };
}
function ff(n) {
  return Math.floor(n).toString().padStart(2, "0");
}
function Z80(n, e, t, i, r) {
  return Q80(e, t) ? 4 : st(n, i, r) + 1;
}
function Q80(n, e) {
  return pF(n)
    ? kP(e) && n === (e.speed === 7 ? "S7" : "S4")
    : n === (e.booster === 0 ? "indiBoosterBtn" : "teamBoosterBtn") ||
        n === (e.showGhost ? "onBtn" : "offBtn");
}
function pF(n) {
  return n === "S4" || n === "S7";
}
function J80(n, e) {
  const t = T80.get(e);
  return t === void 0 || (pF(e) && !kP(n)) ? n : { ...n, ...t };
}
function pf(n, e) {
  const t = n.get(e);
  if (!t) throw new Error(`P3528 Ready texture ${e} 未加载。`);
  return t;
}
function Oi(n, e) {
  const t = T(n, e);
  if (t === void 0) throw new Error(`P3528 Ready ${n.name}.${e} 缺失。`);
  return t;
}
function et(n, e, t) {
  const i = gF(n, e);
  if (i.sourceKind !== "rho" || i.sourceName.toLowerCase() !== t.toLowerCase())
    throw new Error(`${e} 必须来自 ${t}。`);
  return i;
}
function ec0(n, e, t) {
  const i = n
    .canonicalCandidates(e)
    .filter(
      (r) =>
        r.sourceKind === "rho" &&
        r.sourceName.toLowerCase() === t.toLowerCase(),
    );
  if (i.length > 1) throw new Error(`${e} 在 ${t} 内不唯一。`);
  return i[0];
}
function gF(n, e) {
  const t = n.canonicalCandidates(e);
  if (t.length !== 1)
    throw new Error(`${e} source 数量必须为 1，实际 ${t.length}。`);
  return t[0];
}
function tc0(n, e, t) {
  const i = n.trim().split(/\s+/).map(Number);
  if (i.length !== e || i.some((r) => !Number.isFinite(r)))
    throw new Error(`P3528 Ready ${t}=${n} 数值无效。`);
  return i;
}
function nc0(n) {
  return n.replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
}
const Ai = 1600,
  bi = 900,
  r4 = "dialog2_selectTrackEx.rho",
  s4 = "dialog2_/selectTrackEx",
  ic0 = "etc_/baseStringBag.xml",
  x6 = "gui_monocoque.rho",
  rc0 = "gui_font.rho",
  sc0 = "gui_/font/SourceHanSansCN-Bold.otf",
  zi = "P3528 Source Han Sans CN Track Select",
  oc0 = { mabi: "themeMabinogi", maple: "themeMapleStory" };
class _7 {
  constructor(e, t) {
    ((this.options = e), (this.assets = t));
    const i = this.canvas.getContext("2d", { alpha: !0 });
    if (!i) throw new Error("浏览器无法创建 P3528 SelectTrackEx Canvas。");
    ((this.context = i),
      (this.windows = vc0(t)),
      (this.scrollbarInteractions = new Map([
        [
          "selectThemeListBar",
          new b6((o) => {
            ((this.themeOffset = o * this.gridStep("selectTheme")),
              this.render());
          }),
        ],
        [
          "thumbListBar",
          new b6((o) => {
            ((this.trackOffset = o * this.gridStep("thumbList")),
              this.render());
          }),
        ],
      ])),
      (this.selectedTrackId = e.selectedTrackId),
      (this.selectedRandomGroupId = e.selectedRandomGroupId));
    const r = e.randomGroups?.find((o) => o.id === this.selectedRandomGroupId);
    r &&
      ((this.itemEnabled = r.gameType === "item"),
      (this.speedEnabled = r.gameType === "speed"));
    const s = e.tracks.find((o) => o.id === e.selectedTrackId);
    if (!s) throw new Error("P3528 SelectTrackEx 当前赛道不在 mode 9 候选中。");
    ((this.selectedTheme =
      this.selectedRandomGroupId === void 0 ? s.theme : "1024"),
      this.placeInitialOffsets(),
      this.prepareElements(),
      (this.element.className = "client-dialog"),
      (this.element.dataset.uiLayer = "dialog"),
      (this.element.hidden = !0),
      this.element.append(this.canvas, this.search),
      e.root.append(this.element),
      (this.resizeObserver = new ResizeObserver(() => this.render())),
      this.resizeObserver.observe(e.root),
      window.addEventListener("resize", this.onWindowResize));
  }
  options;
  assets;
  element = document.createElement("div");
  canvas = document.createElement("canvas");
  search = document.createElement("input");
  context;
  resizeObserver;
  cardTextures = new Map();
  loadingCards = new Set();
  windows;
  scrollbarInteractions;
  activeScrollbar;
  touchSwipeBar;
  touchSwipe = new WP(jv, Xv, (e) => this.touchSwipeBar?.wheel(e) ?? !1);
  hits = [];
  selectedTrackId;
  selectedRandomGroupId;
  selectedTheme;
  searchQuery = "";
  themeOffset = 0;
  trackOffset = 0;
  itemEnabled = !0;
  speedEnabled = !0;
  hovered;
  pressed;
  favoriteStates = new Map();
  shown = !1;
  disposed = !1;
  onWindowResize = () => this.render();
  static async load(e) {
    if (e.tracks.length === 0)
      throw new Error("P3528 mode 9 没有可选择的普通计时赛赛道。");
    const t = await ac0(e.library, e.randomGroups ?? []);
    t.randomError !== void 0 &&
      e.onError?.(
        new Error(
          `随机赛道界面不可用：${t.randomError instanceof Error ? t.randomError.message : String(t.randomError)}`,
        ),
      );
    const i = t.randomAvailable
      ? e
      : {
          ...e,
          randomGroups: [],
          randomTrackNames: new Map(),
          selectedRandomGroupId: void 0,
        };
    try {
      return new _7(i, t.assets);
    } catch (r) {
      throw (G1(t.assets.font), r);
    }
  }
  show() {
    this.disposed ||
      ((this.shown = !0),
      (this.element.hidden = !1),
      (this.canvas.hidden = !1),
      (this.search.hidden = !1),
      window.addEventListener("keydown", this.onKeyDown),
      this.render(),
      this.canvas.focus());
  }
  dispose() {
    this.disposed ||
      ((this.disposed = !0),
      this.scrollbarInteractions.forEach((e) => e.dispose()),
      this.resizeObserver.disconnect(),
      window.removeEventListener("resize", this.onWindowResize),
      window.removeEventListener("keydown", this.onKeyDown),
      this.canvas.removeEventListener("pointermove", this.onPointerMove),
      this.canvas.removeEventListener("pointerdown", this.onPointerDown),
      this.canvas.removeEventListener("pointerup", this.onPointerUp),
      this.canvas.removeEventListener("pointercancel", this.onPointerCancel),
      this.canvas.removeEventListener("pointerleave", this.onPointerLeave),
      this.canvas.removeEventListener("wheel", this.onWheel),
      this.canvas.remove(),
      this.search.remove(),
      this.element.remove(),
      G1(this.assets.font));
  }
  prepareElements() {
    (Object.assign(this.canvas.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      imageRendering: "pixelated",
      pointerEvents: "auto",
    }),
      (this.canvas.hidden = !0),
      (this.canvas.tabIndex = 0),
      this.canvas.setAttribute("role", "dialog"),
      this.canvas.setAttribute(
        "aria-label",
        this.assets.strings.get("selectTrackCaption") ?? "选择赛道",
      ),
      (this.search.className = "window-edit"),
      Object.assign(this.search.style, {
        position: "absolute",
        boxSizing: "border-box",
        border: "0",
        outline: "0",
        background: "transparent",
        color: "white",
        font: '16px "' + zi + '"',
        padding: "0",
      }),
      (this.search.hidden = !0),
      (this.search.maxLength = Number(T(this.node("searchEdit"), "maxChar"))),
      (this.search.placeholder =
        this.assets.strings.get("fvrTrack_helpstring") ?? ""),
      this.canvas.addEventListener("pointermove", this.onPointerMove),
      this.canvas.addEventListener("pointerdown", this.onPointerDown),
      this.canvas.addEventListener("pointerup", this.onPointerUp),
      this.canvas.addEventListener("pointercancel", this.onPointerCancel),
      this.canvas.addEventListener("pointerleave", this.onPointerLeave),
      this.canvas.addEventListener("wheel", this.onWheel, { passive: !1 }));
  }
  placeInitialOffsets() {
    const e = this.pageSize("selectTheme"),
      t = this.assets.themes.findIndex((r) => r.id === this.selectedTheme),
      i = t < 0 ? 0 : Math.floor(t / e) * e;
    ((this.themeOffset = Math.min(
      i,
      Math.max(0, this.assets.themes.length - e),
    )),
      (this.trackOffset = 0));
  }
  render() {
    if (!this.shown || this.disposed) return;
    (this.resizeCanvas(),
      this.context.clearRect(0, 0, Ai, bi),
      (this.context.imageSmoothingEnabled = !0),
      (this.hits = []));
    const e = this.dialogRect();
    ((this.context.fillStyle = bT(T(this.assets.definition, "color"))),
      this.context.fillRect(0, 0, Ai, bi),
      I5(this.context, this.assets.main, e));
    const t = this.node("selectTrackEx").children.find(
      (i) => i.name === "Label",
    );
    (this.drawLabel(t, this.windows.get(t)),
      this.drawFavoriteButton(),
      this.drawThemes(),
      this.drawFilters(),
      this.drawButtons(e),
      this.drawTracks(),
      this.positionSearch(),
      (this.canvas.style.cursor =
        this.hovered === void 0 ? "default" : "pointer"),
      this.loadVisibleCards());
  }
  drawFavoriteButton() {
    const e = this.node("favTrt0"),
      t = this.rect("favTrt0"),
      i = this.selectedTheme === "favorite",
      r = this.buttonState("theme:favorite"),
      s = i ? this.assets.selectedFavoriteButton : this.assets.favoriteButton;
    (ct(this.context, s[r - 1], t),
      Ln(
        this.context,
        this.assets.strings.get("favoriteTrack"),
        AT(e, t),
        gf(e),
        MT(r, i),
        "left",
      ),
      this.addHit({
        id: "theme:favorite",
        kind: "theme",
        value: "favorite",
        rect: t,
      }));
  }
  drawThemes() {
    const e = this.themeGrid();
    (this.assets.themes
      .slice(e.firstItem, e.firstItem + e.cells.length)
      .forEach((t, i) => {
        const r = e.cells[i],
          s = "theme:" + t.id,
          o = t.id === this.selectedTheme,
          a = this.buttonState(s),
          c = o ? this.assets.selectedThemeButton : this.assets.themeButton;
        (ct(this.context, c[a - 1], r),
          I5(
            this.context,
            t.icon,
            V0(nt(this.assets.themeDefinition, "themeIcon"), r),
          ),
          Ln(
            this.context,
            t.title,
            AT(this.assets.themeDefinition, r),
            gf(this.assets.themeDefinition),
            MT(a, o),
            "left",
          ),
          this.addHit({ id: s, kind: "theme", value: t.id, rect: r }));
      }),
      this.drawScrollbar(
        "selectThemeListBar",
        e,
        this.themeOffset / this.gridStep("selectTheme"),
      ));
  }
  drawFilters() {
    if (this.selectedTheme === "1024") return this.drawRandomFilters();
    (this.drawCheck("item", this.itemEnabled),
      this.drawCheck("speed", this.speedEnabled),
      this.drawLabel(
        this.node("searchTotalTrack"),
        this.rect("searchTotalTrack"),
      ));
  }
  drawRandomFilters() {
    (this.drawRandomCheck("item", this.itemEnabled),
      this.drawRandomCheck("speed", this.speedEnabled),
      this.drawLabel(
        this.node("searchTotalTrack"),
        this.rect("searchTotalTrack"),
      ));
  }
  drawRandomCheck(e, t) {
    const i = this.node("randomRadio." + e),
      r = this.windows.get(i),
      s = "filter:" + e,
      o = Number(t) + (this.hovered === s ? 2 : 0),
      a = this.assets.randomRadioButton?.[o];
    if (!a) return;
    I5(this.context, a, r);
    const c = i.children[0],
      l = this.windows.get(c);
    (this.drawLabel(c, { ...l, y: r.y, height: r.height }),
      this.addHit({ id: s, kind: e, rect: r }));
  }
  drawCheck(e, t) {
    const i = this.node("radio." + e),
      r = this.windows.get(i),
      s = "filter:" + e,
      o = Number(t) + (this.hovered === s ? 2 : 0);
    C9(this.context, this.assets.checkFrames[o], this.assets.frame.image, r);
    const a = i.children[0];
    (this.drawLabel(a, this.windows.get(a)),
      this.addHit({ id: s, kind: e, rect: r }));
  }
  drawTracks() {
    if (this.selectedTheme === "1024") return this.drawRandomTracks();
    const e = this.filteredTracks(),
      t = this.trackGrid(e.length);
    (e.slice(t.firstItem, t.firstItem + t.cells.length).forEach((i, r) => {
      const s = t.cells[r];
      (this.addHit({
        id: "track:" + i.id,
        kind: "track",
        value: i.id,
        rect: s,
      }),
        this.drawTrackCard(i, s));
    }),
      this.drawScrollbar(
        "thumbListBar",
        t,
        this.trackOffset / this.gridStep("thumbList"),
      ));
  }
  drawRandomTracks() {
    const e = this.randomGroupsForDisplay(),
      t = this.randomTrackGrid(e.length);
    (e.slice(t.firstItem, t.firstItem + t.cells.length).forEach((i, r) => {
      const s = t.cells[r],
        o = "random:" + i.id;
      this.addHit({ id: o, kind: "random", value: i.id, rect: s });
      const a = this.buttonState(o),
        c = this.assets.randomCards?.get(i.cardToken);
      c &&
        I5(this.context, c, {
          x: s.x,
          y: s.y,
          width: s.width,
          height: (c.height * s.width) / c.width,
        });
      const l = c
          ? (c.height * s.width) / c.width
          : Math.round(s.height * 0.84),
        u = { x: s.x, y: s.y + l, width: s.width, height: s.height - l },
        h = a === 2,
        d = i.id === this.selectedRandomGroupId;
      ((this.context.fillStyle = h
        ? "rgb(188, 255, 77)"
        : "rgb(245, 245, 245)"),
        this.context.fillRect(u.x, u.y, u.width, u.height),
        (this.context.strokeStyle =
          h || d ? "rgb(154, 224, 35)" : "rgb(50, 50, 50)"),
        (this.context.lineWidth = h || d ? 4 : 2),
        this.context.strokeRect(
          s.x + this.context.lineWidth / 2,
          s.y + this.context.lineWidth / 2,
          s.width - this.context.lineWidth,
          s.height - this.context.lineWidth,
        ),
        Ln(
          this.context,
          xT(i),
          u,
          16,
          h ? "rgb(81, 131, 0)" : "rgb(21, 29, 44)",
          "center",
          "center",
        ));
    }),
      this.drawRandomDescription());
  }
  drawRandomDescription() {
    const e = this.hovered?.startsWith("random:")
        ? this.hovered.slice(7)
        : void 0,
      t = e && this.options.randomGroups?.find((w) => w.id === e),
      i = this.assets.randomDescriptionBackground;
    if (!t || !i || !bc0(t)) return;
    const r = this.hits.find(
      (w) => w.kind === "random" && w.value === t.id,
    )?.rect;
    if (!r) return;
    const o = (t.displayTrackIds ?? t.trackIds).map(
        (w) =>
          this.options.randomTrackNames?.get(w) ??
          this.options.tracks.find((g) => g.id === w)?.title ??
          w,
      ),
      a = t.randomType === "new" ? 1 : 2,
      [c, l] = xc0(this.assets.randomDescriptionDefinition, a),
      u = Math.ceil(o.length / a),
      h = Math.max(l, 40 + u * mf + Mc0),
      d = r.x + r.width + c <= Ai ? r.x + r.width : r.x - c,
      f = Math.max(0, Math.min(bi - h, r.y)),
      p = { x: d, y: f, width: c, height: h };
    (ST(this.context, i, p, 1, 1),
      this.assets.randomDescriptionTitle &&
        ST(
          this.context,
          this.assets.randomDescriptionTitle,
          { x: p.x, y: p.y, width: p.width, height: 32 },
          1,
          1,
        ));
    const v = xT(t);
    (Ln(
      this.context,
      v,
      { x: p.x + 12, y: p.y + 4, width: p.width - 24, height: 30 },
      14,
      "yellow",
      "center",
    ),
      o.forEach((w, g) => {
        const y = g % a,
          b = Math.floor(g / a);
        Ln(
          this.context,
          w,
          {
            x: p.x + 15 + y * 220,
            y: p.y + 40 + b * mf,
            width: 210,
            height: mf,
          },
          14,
          "white",
          "left",
        );
      }));
  }
  drawTrackCard(e, t) {
    const i = Ac0(this.assets.cardDefinition, t),
      r = this.cardTextures.get(e.id);
    r && Sc0(this.context, r, i);
    const s = "track:" + e.id,
      o = this.buttonState(s);
    (I5(this.context, this.assets.cardFrame[o - 1], t),
      e.id === this.selectedTrackId &&
        I5(
          this.context,
          this.assets.selectedCard,
          V0(nt(this.assets.cardDefinition, "selectTrackThumbBG"), t),
        ),
      e.reverse === !0 && this.drawReverseStamp(t));
    const a = V0(
      nt(this.assets.cardDefinition, "difficulty"),
      t,
      void 0,
      this.assets.difficultyLabel,
    );
    (I5(this.context, this.assets.difficultyLabel, a),
      this.drawDifficulty(e.difficulty, t),
      Ln(
        this.context,
        e.title,
        { x: i.x, y: i.y, width: i.width, height: i.height + 28 },
        16,
        o === 2 ? "rgb(81, 131, 0)" : "rgb(21, 29, 44)",
        "center",
        "bottom",
      ),
      this.drawFavoriteCheck(e.id, t));
  }
  drawReverseStamp(e) {
    const t = this.assets.cardDefinition,
      i = j2(T(t, "windowRect"), 4, "windowRect"),
      [r, s] = j2(T(t, "smallSpecialMarkAdjust"), 2, "smallSpecialMarkAdjust"),
      o = this.assets.reverseStamp,
      a = i[2] === 0 ? 1 : e.width / i[2];
    I5(this.context, o, {
      x: e.x + r * a,
      y: e.y + s * a,
      width: o.width * a,
      height: o.height * a,
    });
  }
  drawFavoriteCheck(e, t) {
    const i = V0(nt(this.assets.cardDefinition, "favoriteTrackCheck"), t),
      r = this.favoriteState(e);
    (ct(this.context, this.assets.favoriteMark[r === 5 ? 0 : r], i),
      this.addHit({
        id: "favorite:" + e,
        kind: "favorite",
        value: e,
        rect: i,
      }));
  }
  favoriteState(e) {
    return (
      this.favoriteStates.get(e) ?? Number(this.options.favoriteTrackIds.has(e))
    );
  }
  drawDifficulty(e, t) {
    const i = nt(this.assets.cardDefinition, "difficulty"),
      r = nt(i, "difficultyChar"),
      s = V0(r, V0(i, t, void 0, this.assets.difficultyLabel)),
      [o, a] = j2(T(r, "fontSize"), 2, "fontSize"),
      c = o + Number(T(r, "spaceOffset")),
      l = T(r, "fontStr");
    for (let u = 0; u < 6; u += 1) {
      const h = l.indexOf(u < e ? "1" : "0") * o;
      Ct(this.context, this.assets.difficulty, [h, 0, h + o, a], {
        x: s.x + u * c,
        y: s.y,
        width: o,
        height: a,
      });
    }
  }
  drawButtons(e) {
    (this.drawTextButton(
      "confirm",
      this.assets.strings.get("select") ?? "确认",
      e,
    ),
      this.drawTextButton(
        "cancel",
        this.assets.strings.get("cancel") ?? "取消",
        e,
      ));
    const t = this.node("selectTrackEx").children.find(
        (r) => r.name === "ImageButton" && T(r, "name") === "cancel",
      ),
      i = this.windows.get(t);
    (ct(
      this.context,
      this.assets.closeButton[this.buttonState("close") - 1],
      i,
    ),
      this.addHit({ id: "close", kind: "cancel", rect: i }));
  }
  drawTextButton(e, t, i) {
    const r = this.assets.buttons.get(e),
      s = r.style.states[this.buttonState(e) - 1],
      o = V0(r.definition, i, s.frame);
    (C9(this.context, s.frame, this.assets.textButtonFrame.image, o),
      Ln(
        this.context,
        t,
        E9(s.frame, o),
        Number(s.textRender.slice(4)),
        s.textColor,
        "center",
        "center",
        "button",
      ),
      this.addHit({ id: e, kind: e, rect: o }));
  }
  filteredTracks() {
    const e = this.searchQuery.split(" ").filter(Boolean);
    return this.options.tracks.filter((t) =>
      this.gameTypeEnabled(t)
        ? this.selectedTheme === "favorite"
          ? this.options.favoriteTrackIds.has(t.id)
          : this.selectedTheme === void 0
            ? e.every((i) => t.title.includes(i))
            : this.selectedTheme === "0" || t.theme === this.selectedTheme
        : !1,
    );
  }
  randomGroupsForDisplay() {
    const e = this.options.randomGroups ?? [],
      t = new Map(),
      i = this.speedEnabled ? "speed" : "item";
    e.forEach((s) => {
      if (s.randomType === "all") {
        if (s.gameType !== i) return;
      } else if (s.randomType !== "speedAll" && !this.gameTypeEnabled(s))
        return;
      const o = t.get(s.cardToken);
      (!o || (s.gameType === "speed" && o.gameType !== "speed")) &&
        t.set(s.cardToken, s);
    });
    const r = [
      "hot1",
      "hot2",
      "hot3",
      "hot4",
      "hot5",
      "all",
      "speedAll",
      "clubSpeed",
      "new",
      "reverse",
    ];
    return [...t.values()].sort((s, o) => {
      const a = s.cardToken.startsWith("speedAll")
          ? r.indexOf("speedAll")
          : s.randomType === "all" && s.cardToken.startsWith("allRandom")
            ? r.indexOf("all")
            : r.indexOf(s.randomType),
        c = o.cardToken.startsWith("speedAll")
          ? r.indexOf("speedAll")
          : o.randomType === "all" && o.cardToken.startsWith("allRandom")
            ? r.indexOf("all")
            : r.indexOf(o.randomType);
      return (a < 0 ? 99 : a) - (c < 0 ? 99 : c);
    });
  }
  gameTypeEnabled(e) {
    return e.gameType === "item" ? this.itemEnabled : this.speedEnabled;
  }
  loadVisibleCards() {
    if (this.selectedTheme === "1024") return;
    this.filteredTracks()
      .slice(this.trackOffset, this.trackOffset + this.pageSize("thumbList"))
      .forEach((t) => {
        this.cardTextures.has(t.id) ||
          this.loadingCards.has(t.id) ||
          (this.loadingCards.add(t.id),
          o4(pc0(this.options.library, t.path))
            .then((i) => {
              (this.cardTextures.set(t.id, i), this.render());
            })
            .catch((i) => this.options.onError?.(i))
            .finally(() => this.loadingCards.delete(t.id)));
      });
  }
  resizeCanvas() {
    const e = this.options.root.getBoundingClientRect();
    p3(this.canvas, this.context, e.width, e.height, xe(), Ai, bi, 1600, 900);
  }
  dialogRect() {
    return this.rect("selectTrackEx");
  }
  node(e) {
    return nt(this.assets.definition, e, this.assets.radioDefinition);
  }
  rect(e) {
    return this.windows.get(this.node(e));
  }
  pageSize(e) {
    return Wv(vl(this.node(e)));
  }
  gridStep(e) {
    return i4(vl(this.node(e)));
  }
  gridLayout(e, t, i, r) {
    const s = vl(this.node(e)),
      o = this.rect(e);
    return $P(s, o, V0(t, o), i, r / i4(s));
  }
  themeGrid() {
    return this.gridLayout(
      "selectTheme",
      this.assets.themeDefinition,
      this.assets.themes.length,
      this.themeOffset,
    );
  }
  trackGrid(e) {
    return this.gridLayout(
      "thumbList",
      this.assets.cardDefinition,
      e,
      this.trackOffset,
    );
  }
  drawScrollbar(e, t, i) {
    const r = this.assets.scrollbars.get(e),
      s = this.scrollbarInteractions.get(e),
      o = s.layout(r, this.rect(e), t.positionCount, i);
    t.positionCount > 1 &&
      Kv(this.context, r, this.assets.frame.image, o, s.buttonState);
  }
  drawLabel(e, t) {
    const i = T(e, "text"),
      r = /^#sb\(([^)]+)\)$/.exec(i)?.[1],
      s = r === void 0 ? i : (this.assets.strings.get(r) ?? i),
      o = /(?:^|[;\s])(?:hcenter|center)(?:$|[;\s])/.test(
        T(e, "textAlign") ?? "",
      )
        ? "center"
        : "left";
    Ln(this.context, s, t, gf(e), bT(T(e, "textColor")), o);
  }
  positionSearch() {
    const e = this.rect("searchEdit"),
      t = this.options.root.clientWidth / Ai,
      i = this.options.root.clientHeight / bi;
    aw(this.search, e, t, i);
  }
  buttonState(e) {
    return st(e, this.hovered, this.pressed) + 1;
  }
  addHit(e) {
    this.hits = [...this.hits, e];
  }
  hitAt(e) {
    const t = this.eventPoint(e);
    return [...this.hits].reverse().find((i) => Oe(t.x, t.y, i.rect));
  }
  eventPoint(e) {
    const t = this.canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - t.left) * Ai) / t.width,
      y: ((e.clientY - t.top) * bi) / t.height,
    };
  }
  activate(e) {
    if (e.kind === "cancel") return this.options.onCancel();
    if (e.kind === "confirm") return this.confirm();
    if (e.kind === "theme") return this.selectTheme(e.value);
    if (e.kind === "favorite") return this.activateFavorite(e.value);
    if (e.kind === "track")
      return (
        (this.selectedRandomGroupId = void 0),
        (this.selectedTrackId = e.value),
        this.render()
      );
    if (e.kind === "random")
      return ((this.selectedRandomGroupId = e.value), this.render());
    this.toggleGameType(e.kind);
  }
  activateFavorite(e) {
    const t = this.favoriteState(e);
    if (![2, 3].includes(t)) return;
    const i = this.changeFavorite(e, t === 2);
    this.favoriteStates.set(e, Number(this.options.favoriteTrackIds.has(e)));
    const r = this.options.tracks.find((s) => s.id === e);
    (this.showFavoriteNotice(i, r.title),
      this.selectedTheme === "favorite"
        ? this.selectTheme("favorite")
        : this.render());
  }
  changeFavorite(e, t) {
    const i = this.options.favoriteTrackIds;
    return t
      ? this.options.getFavoriteCount() >= 50
        ? "AddFavoriteTrackError2"
        : (i.add(e), this.options.onFavoriteChange(e, !0), "AddFavoriteTrack")
      : (i.delete(e),
        this.options.onFavoriteChange(e, !1),
        "DeleteFavoriteTrack");
  }
  showFavoriteNotice(e, t) {
    const i = this.assets.strings.get(e).replace("%s", t),
      r = this.assets.notice,
      s = Wo(r.definition, r.frame),
      o = HP(this.context, i, s.message.width, zi),
      a = ve(this.context, "", { family: zi, size: 16 }).height,
      c = Wo(r.definition, r.frame, (o.length - 1) * a);
    this.options.onNotice(c.window, i, (l) =>
      qP(l, r, c, this.assets.strings.get("notice"), o, zi),
    );
  }
  moveFavorite(e) {
    this.hovered !== e?.id &&
      (this.leaveFavorite(),
      e?.kind === "favorite" &&
        this.favoriteState(e.value) === 0 &&
        this.favoriteStates.set(e.value, 5));
  }
  leaveFavorite() {
    if (!this.hovered?.startsWith("favorite:")) return;
    const e = this.hovered.slice(9);
    this.favoriteState(e) !== 1 && this.favoriteStates.set(e, 0);
  }
  pressFavorite(e) {
    if (e.kind !== "favorite") return;
    const t = this.favoriteState(e.value);
    this.favoriteStates.set(e.value, t === 1 ? 3 : 2);
  }
  confirm() {
    if (
      this.selectedTheme === "1024" &&
      this.selectedRandomGroupId !== void 0
    ) {
      const t = this.options.randomGroups?.find(
        (i) => i.id === this.selectedRandomGroupId,
      );
      t && this.options.onConfirm({ kind: "random", group: t });
      return;
    }
    const e = this.options.tracks.find((t) => t.id === this.selectedTrackId);
    e && this.options.onConfirm({ kind: "track", track: e });
  }
  selectTheme(e) {
    const t = this.selectedTheme;
    if (
      (this.resetTrackScrollbar(),
      (this.selectedTheme = e),
      e === "1024" && t !== "1024")
    ) {
      const i = this.options.tracks.find((r) => r.id === this.selectedTrackId);
      ((this.itemEnabled = i?.gameType === "item"),
        (this.speedEnabled = i?.gameType !== "item"));
    }
    ((this.search.value = ""),
      (this.searchQuery = ""),
      this.search.blur(),
      (this.trackOffset = 0),
      this.render());
  }
  toggleGameType(e) {
    (this.selectedTheme === "1024"
      ? ((this.itemEnabled = e === "item"),
        (this.speedEnabled = e === "speed"),
        this.remapRandomSelection(e))
      : e === "item"
        ? (this.itemEnabled = !this.itemEnabled)
        : (this.speedEnabled = !this.speedEnabled),
      this.selectedTheme !== void 0
        ? this.selectTheme(this.selectedTheme)
        : this.searchTracks(this.search.value));
  }
  remapRandomSelection(e) {
    const t = this.options.randomGroups?.find(
      (r) => r.id === this.selectedRandomGroupId,
    );
    if (!t) return;
    const i = this.options.randomGroups?.find(
      (r) =>
        r.gameType === e &&
        r.cardToken === t.cardToken &&
        r.randomType === t.randomType &&
        r.level === t.level,
    );
    i && (this.selectedRandomGroupId = i.id);
  }
  onPointerMove = (e) => {
    if (this.touchSwipe.isActive(e.pointerId)) {
      this.touchSwipe.move(e.pointerId, e.clientY);
      return;
    }
    if (this.activeScrollbar) {
      this.activeScrollbar.move(this.eventPoint(e), (e.buttons & 1) !== 0);
      return;
    }
    const t = this.hitAt(e);
    this.moveFavorite(t);
    const i = t?.id;
    i !== this.hovered && ((this.hovered = i), this.render());
  };
  onPointerDown = (e) => {
    if (e.button !== 0 || this.beginScrollbar(e) || this.beginTouchSwipe(e))
      return;
    const t = this.hitAt(e);
    t &&
      (this.options.onInteraction?.(),
      this.moveFavorite(t),
      this.pressFavorite(t),
      (this.pressed = t.id),
      (this.hovered = t.id),
      this.canvas.setPointerCapture(e.pointerId),
      this.render());
  };
  onPointerUp = (e) => {
    if (this.touchSwipe.isActive(e.pointerId)) return this.finishTouchSwipe(e);
    if (this.finishScrollbar(e)) return;
    const t = this.hitAt(e),
      i = t?.id === this.pressed ? t : void 0;
    ((this.pressed = void 0),
      this.canvas.hasPointerCapture(e.pointerId) &&
        this.canvas.releasePointerCapture(e.pointerId),
      i ? this.activate(i) : this.render());
  };
  onPointerCancel = (e) => {
    if (this.touchSwipe.isActive(e.pointerId)) {
      (this.touchSwipe.finish(e.pointerId),
        (this.touchSwipeBar = void 0),
        this.canvas.hasPointerCapture(e.pointerId) &&
          this.canvas.releasePointerCapture(e.pointerId),
        this.render());
      return;
    }
    this.finishScrollbar(e) ||
      ((this.pressed = void 0),
      this.canvas.hasPointerCapture(e.pointerId) &&
        this.canvas.releasePointerCapture(e.pointerId),
      this.render());
  };
  onPointerLeave = () => {
    (this.activeScrollbar?.leave(),
      this.leaveFavorite(),
      (this.hovered = void 0),
      this.render());
  };
  onWheel = (e) => {
    const t = this.eventPoint(e),
      i = Math.sign(e.deltaY);
    if (i === 0) return;
    let r;
    if (this.overThemes(t)) r = "selectThemeListBar";
    else if (this.overTracks(t)) r = "thumbListBar";
    else return;
    this.scrollbarInteractions.get(r).wheel(i) && e.preventDefault();
  };
  overThemes(e) {
    return (
      Oe(e.x, e.y, this.themeGrid().rect) ||
      Oe(e.x, e.y, this.rect("selectThemeListBar"))
    );
  }
  overTracks(e) {
    return (
      Oe(e.x, e.y, this.rect("contentFrame")) ||
      Oe(
        e.x,
        e.y,
        this.selectedTheme === "1024"
          ? this.randomTrackGrid(this.visibleTrackCount()).rect
          : this.trackGrid(this.visibleTrackCount()).rect,
      )
    );
  }
  visibleTrackCount() {
    return this.selectedTheme === "1024"
      ? this.randomGroupsForDisplay().length
      : this.filteredTracks().length;
  }
  searchTracks(e) {
    (this.resetTrackScrollbar(),
      (this.searchQuery = e),
      (this.selectedTheme = void 0),
      (this.trackOffset = 0),
      this.render());
  }
  commitSearch() {
    const e = this.search.value.replace(
      /^[\t-\r \u0085\u00a0\u1680\u180e\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+|[\t-\r \u0085\u00a0\u1680\u180e\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+$/g,
      "",
    );
    if (e) return this.searchTracks(e);
    ((this.search.value = ""),
      this.search.blur(),
      this.selectedTheme !== void 0 && this.selectTheme(this.selectedTheme));
  }
  beginScrollbar(e) {
    const t = this.eventPoint(e),
      i = [...this.scrollbarInteractions.values()].find((r) => r.down(t));
    return i
      ? ((this.activeScrollbar = i),
        this.options.onInteraction?.(),
        this.canvas.setPointerCapture(e.pointerId),
        !0)
      : !1;
  }
  beginTouchSwipe(e) {
    if (e.pointerType !== "touch") return !1;
    const t = this.eventPoint(e),
      i = this.overThemes(t)
        ? this.scrollbarInteractions.get("selectThemeListBar")
        : this.overTracks(t)
          ? this.scrollbarInteractions.get("thumbListBar")
          : void 0;
    return i
      ? ((this.touchSwipeBar = i),
        this.touchSwipe.begin(e.pointerId, e.clientY),
        this.options.onInteraction?.(),
        this.canvas.setPointerCapture(e.pointerId),
        !0)
      : !1;
  }
  finishTouchSwipe(e) {
    const t = this.touchSwipe.finish(e.pointerId);
    if (
      ((this.touchSwipeBar = void 0),
      this.canvas.hasPointerCapture(e.pointerId) &&
        this.canvas.releasePointerCapture(e.pointerId),
      t)
    )
      return this.render();
    const i = this.hitAt(e);
    i ? this.activate(i) : this.render();
  }
  finishScrollbar(e) {
    return this.activeScrollbar
      ? (this.activeScrollbar.up(),
        (this.activeScrollbar = void 0),
        this.canvas.hasPointerCapture(e.pointerId) &&
          this.canvas.releasePointerCapture(e.pointerId),
        !0)
      : !1;
  }
  resetTrackScrollbar() {
    (this.scrollbarInteractions.get("thumbListBar").reset(),
      (this.activeScrollbar = void 0),
      this.favoriteStates.clear());
  }
  onKeyDown = (e) => {
    if (e.key === "Escape") (e.preventDefault(), this.options.onCancel());
    else if (e.key === "Enter") {
      if (e.isComposing) return;
      (e.preventDefault(), this.commitSearch());
    }
  };
  randomTrackGrid(e) {
    const t = this.rect("thumbList"),
      i = this.assets.randomCards?.values().next().value,
      r = i?.width ?? 281,
      o = (i?.height ?? 164) + 31,
      a = 10,
      c = 4,
      l = Math.min(3, Math.ceil(e / c)),
      u = c * r + (c - 1) * a,
      h = Math.max(1, l) * o + (Math.max(1, l) - 1) * a,
      d = Math.min(this.trackOffset, Math.max(0, e - 1)),
      f = Array.from(
        { length: Math.max(0, Math.min(e - d, c * 3)) },
        (p, v) => ({
          x:
            t.x +
            Math.max(0, Math.floor((t.width - u) / 2)) +
            (v % c) * (r + a),
          y:
            t.y +
            Math.max(0, Math.floor((t.height - h) / 2)) +
            Math.floor(v / c) * (o + a),
          width: r,
          height: o,
        }),
      );
    return { rect: t, cells: f, firstItem: d, positionCount: 1 };
  }
}
async function ac0(n, e) {
  const t = de(n, s4 + "/config@cn.bml", r4),
    i = de(n, s4 + "/selectTrackEx_stringBag.bml", r4),
    r = mF(n, ic0),
    s = de(n, sc0, rc0),
    [o, a, c, l, u, h, d, f, p, v, w, g, y, b, A, x, M, E, _, C] =
      await Promise.all([
        t.bytes().then(s2),
        i.bytes().then(s2),
        r.text(),
        _t(n, "trackSelect_img_mainBG"),
        $3(n, "themeSelect_btn_slot_", !1),
        $3(n, "themeSelected_btn_slot_", !1),
        $3(n, "favTrSelect_btn_slot_", !1),
        $3(n, "favTrSelected_btn_slot_", !1),
        $3(n, "trackthumbcard@zz", !0),
        _t(n, "trackthumbcard4@zz"),
        _t(n, "img_trackSelectIcon"),
        $3(n, "trackSelect_btn_thumbcardFavorite_", !1),
        _t(n, "난이도text@zz"),
        _t(n, "난이도원"),
        o4(de(n, "stage_/common/작은리버스트랙.png", "stage_common.rho")),
        o4(de(n, "gui_/monocoque/frame01.png", x6)),
        o4(de(n, "gui_/monocoque/frame_new01.png", x6)),
        dc0(n, "stage_/common/close_", "stage_common.rho"),
        lc0(n),
        o4(de(n, "stage_/common/대화상자정보.png", "stage_common.rho")),
      ]),
    S = new Map([...wc0(c), ...mc0(a)]),
    G = uc0(o, S),
    I = G.filter((P) => P.id !== "1024"),
    L = await Promise.all(
      I.map(async (P) => ({ ...P, icon: await _t(n, iy(P.icon, 1, !1)) })),
    );
  let k, D;
  if (e.length > 0)
    try {
      const P = G.find((q) => q.id === "1024");
      if (!P) throw new Error("P3528 SelectTrackEx 配置缺少随机主题 1024。");
      k = await cc0(n, e, _, P);
    } catch (P) {
      D = P;
    }
  const V = G.flatMap((P) =>
      P.id === "1024" ? (k ? [k.theme] : []) : L.filter((q) => q.id === P.id),
    ),
    K = await gc0(s);
  return {
    randomAvailable: k !== void 0,
    randomError: D,
    assets: {
      ..._,
      main: l,
      themeButton: u,
      selectedThemeButton: h,
      favoriteButton: d,
      selectedFavoriteButton: f,
      cardFrame: p,
      selectedCard: v,
      selectedTheme: w,
      favoriteMark: g,
      difficultyLabel: y,
      difficulty: b,
      reverseStamp: A,
      frame: x,
      textButtonFrame: M,
      closeButton: E,
      randomRadioButton: k?.radioButton,
      randomCards: k?.cards,
      randomDescriptionDefinition: k?.descriptionDefinition,
      randomDescriptionBackground: k?.descriptionBackground,
      randomDescriptionTitle: k?.descriptionTitle,
      themes: V,
      strings: S,
      font: K,
      notice: { ..._.notice, frameImage: x.image, iconImage: C.image },
    },
  };
}
async function cc0(n, e, t, i) {
  const r = nt(t.definition, "randomTrackDesc"),
    [s, o, a, c, l] = await Promise.all([
      $3(n, "trackSelect_btn_radio_", !1),
      Promise.all(
        [...new Set(e.map((u) => u.cardToken))].map(async (u) => [
          u,
          await _t(n, u),
        ]),
      ),
      _t(n, "popup_bg_tracklist_bg"),
      _t(n, "popup_bg_tracklist_title"),
      _t(n, iy(i.icon, 1, !1)),
    ]);
  return {
    radioButton: s,
    cards: new Map(o),
    descriptionDefinition: r,
    descriptionBackground: a,
    descriptionTitle: c,
    theme: { ...i, icon: l },
  };
}
async function lc0(n) {
  const [e, t, i, r, s, o, a] = await Promise.all([
      de(n, `${s4}/selectTrackEx@zz.bml`, r4).bytes().then(s2),
      de(n, `${s4}/radioButton.bml`, r4).bytes().then(s2),
      de(n, `${s4}/themeTemplate.bml`, r4).bytes().then(s2),
      de(n, `${s4}/trackThumbCard@zz.bml`, r4).bytes().then(s2),
      de(n, "gui_/monocoque/config.bml", x6).bytes().then(s2),
      de(n, "gui_/monocoque/frame.bml", x6).bytes().then(s2),
      de(
        n,
        "gui_/windowTemplate/blinkMessageWindow.bml",
        "gui_windowTemplate.rho",
      )
        .bytes()
        .then(s2),
    ]),
    c = e.children.find((h) => T(h, "name") === "selectTrackEx");
  if (!c) throw new Error("P3528 SelectTrackEx 缺少主窗口定义。");
  const l = new Map(
      ["ok", "cancel"].map((h) => {
        const d = c.children.find(
          (f) => f.name === "TextButton" && T(f, "name") === h,
        );
        if (!d) throw new Error(`P3528 SelectTrackEx 缺少 TextButton ${h}。`);
        return [
          h === "ok" ? "confirm" : "cancel",
          { definition: d, style: m4(d, s, o) },
        ];
      }),
    ),
    u = (h) => {
      const d = o.children.find((f) => f.name === h)?.children[0];
      if (!d) throw new Error(`P3528 SelectTrackEx 缺少窗口帧 ${h}。`);
      return Ft(d);
    };
  return {
    definition: e,
    radioDefinition: t,
    themeDefinition: i,
    cardDefinition: r,
    buttons: l,
    frames: new Map(["NoFrame", "DefaultCheckButton"].map((h) => [h, u(h)])),
    checkFrames: o.children
      .find((h) => h.name === "DefaultCheckButton")
      .children.map(Ft),
    scrollbars: new Map(
      ["selectThemeListBar", "thumbListBar"].map((h) => [h, Hv(nt(e, h), o)]),
    ),
    notice: {
      definition: a,
      frame: u("CaptionDialog"),
      captionOffset: an(a, s),
    },
  };
}
function uc0(n, e) {
  const t = n.children.find((i) => i.name === "themeTabOrder");
  if (!t) throw new Error("P3528 SelectTrackEx config 缺少 themeTabOrder。");
  return t.children.flatMap((i) => {
    const r = T(i, "id");
    if (!r || r === "1025") return [];
    const s = hc0(i, r);
    return [{ id: r, title: e.get(s) ?? r, icon: T(i, "icon") ?? r }];
  });
}
function hc0(n, e) {
  return (
    T(n, "stringKey") ?? oc0[e] ?? "theme" + e[0].toUpperCase() + e.slice(1)
  );
}
async function $3(n, e, t) {
  return Promise.all([1, 2, 3, 4].map((i) => _t(n, iy(e, i, t))));
}
async function dc0(n, e, t) {
  return Promise.all([1, 2, 3, 4].map((i) => o4(de(n, e + i + ".png", t))));
}
function iy(n, e, t) {
  return t && n.endsWith("@zz")
    ? n.slice(0, -3) + e + "@zz"
    : n.endsWith("@zz")
      ? n.slice(0, -3) + "_" + e + "@zz"
      : n.endsWith("_")
        ? n + e
        : n + "_" + e;
}
function _t(n, e) {
  return o4(fc0(n, e));
}
function fc0(n, e) {
  const t = e.endsWith("@zz") ? [e.slice(0, -3) + "@cn", e] : [e];
  for (const i of t) {
    const r = Cc0(n, s4 + "/" + i + ".png", r4);
    if (r) return r;
  }
  throw new Error("P3528 SelectTrackEx 缺少图片 " + e + "。");
}
function pc0(n, e) {
  const t = n.get(e);
  if (!t) throw new Error("P3528 SelectTrackEx 找不到赛道 " + e + "。");
  const i = Ec0(t.canonicalPath ?? t.virtualPath),
    r = i.lastIndexOf("/"),
    s = (r < 0 ? "" : i.slice(0, r + 1)) + "xt_trackCard.png",
    o = n.resolveContainerPath(e, s);
  if (o.status === "found") return o.entry;
  throw o.status === "ambiguous"
    ? new Error(s + " 在赛道 container 内不唯一。")
    : new Error(s + " 不在赛道的同一 container 内。");
}
async function o4(n) {
  const e = await p2(await n.bytes()),
    t = document.createElement("canvas");
  ((t.width = e.width), (t.height = e.height));
  const i = t.getContext("2d");
  if (!i) throw new Error("浏览器无法创建 " + n.virtualPath + " 的 Canvas。");
  const r = new Uint8ClampedArray(e.pixels.length);
  return (
    r.set(e.pixels),
    i.putImageData(new ImageData(r, e.width, e.height), 0, 0),
    { width: e.width, height: e.height, image: t }
  );
}
async function gc0(n) {
  return f5(zi, await n.bytes());
}
function mc0(n) {
  const e = new Map();
  return (
    n.children.forEach((t) => {
      const i = T(t, "n"),
        r = t.children.find((o) => T(o, "c") === "cn"),
        s = r && T(r, "v");
      i !== void 0 && s !== void 0 && e.set(i, s);
    }),
    e
  );
}
function wc0(n) {
  const e = new DOMParser().parseFromString(n, "application/xml");
  if (e.querySelector("parsererror"))
    throw new Error("P3528 baseStringBag.xml 不是有效 XML。");
  const i = new Map();
  return (
    Array.from(e.documentElement.children).forEach((r) => {
      const s = r.getAttribute("n"),
        a = Array.from(r.children)
          .find((c) => c.getAttribute("c") === "cn")
          ?.getAttribute("v");
      s !== null && a !== null && a !== void 0 && i.set(s, a);
    }),
    i
  );
}
function vc0(n, e = { x: 0, y: 0, width: 1600, height: 900 }) {
  const t = nt(n.definition, "favTrt0"),
    i = new Map([[t, n.favoriteButton[0]]]),
    r = jc(n.definition, e, n.frames, i),
    s = r.get(nt(n.definition, "selectTrackEx"));
  jc(n.radioDefinition, s, n.frames).forEach((a, c) => r.set(c, a));
  const o = n.radioDefinition.children.find(
    (a) => T(a, "name") === "randomRadioButton",
  );
  if (o) {
    const a = {
      ...o,
      attributes: o.attributes.filter((c) => c.name !== "visible"),
    };
    jc({ ...n.radioDefinition, children: [a] }, s, n.frames).forEach((c, l) =>
      r.set(l, c),
    );
  }
  for (const a of ["selectThemeListBar", "thumbListBar"]) {
    const c = nt(n.definition, a),
      l = yc0(n.definition, c);
    r.set(c, V0(c, r.get(l)));
  }
  return r;
}
function nt(n, e, t) {
  const i = t ? [n, t] : [n];
  for (; i.length > 0;) {
    const r = i.pop();
    if (T(r, "name") === e) return r;
    i.push(...r.children);
  }
  throw new Error(`P3528 SelectTrackEx 缺少布局节点 ${e}。`);
}
function yc0(n, e) {
  const t = [n];
  for (; t.length > 0;) {
    const i = t.pop();
    if (i.children.includes(e)) return i;
    t.push(...i.children);
  }
  throw new Error("P3528 SelectTrackEx 缺少布局父节点。");
}
function Ac0(n, e) {
  const [t, i, r, s] = j2(T(n, "trackRect"), 4, "trackRect");
  return { x: e.x + t, y: e.y + i, width: r - t, height: s - i };
}
function AT(n, e) {
  const [t, i] = j2(T(n, "stringPos"), 2, "stringPos");
  return {
    ...e,
    x: e.x + t,
    y: e.y + i,
    width: e.width - t,
    height: e.height - i,
  };
}
function gf(n) {
  return Number(T(n, "textRender").replace("bold", ""));
}
function bT(n) {
  if (n === "white" || n === "black") return n;
  const [e, t, i, r] = j2(n, 4, "color");
  return `rgba(${t}, ${i}, ${r}, ${e / 255})`;
}
function MT(n, e) {
  return n === 2
    ? "rgb(142, 196, 243)"
    : e || n === 3
      ? "white"
      : "rgb(135, 146, 167)";
}
function xT(n) {
  return n.randomType === "hot1"
    ? "人气随机（极易）"
    : n.randomType === "hot2"
      ? "人气随机（简单）"
      : n.randomType === "hot3"
        ? "人气随机（普通）"
        : n.randomType === "hot4"
          ? "人气随机（困难）"
          : n.randomType === "hot5"
            ? "人气随机（极难）"
            : n.cardToken === "speedAllRandom_TimeAttack@zz"
              ? "竞速随机"
              : n.randomType === "all"
                ? "全部随机"
                : n.randomType === "speedAll"
                  ? "竞速随机"
                  : n.randomType === "clubSpeed"
                    ? "专业竞速随机"
                    : n.randomType === "new"
                      ? "新图随机"
                      : n.randomType === "reverse"
                        ? "反方向随机"
                        : n.randomType === "crazy"
                          ? "疯狂随机"
                          : n.level === void 0
                            ? n.randomType
                            : `${n.randomType}:${n.level}`;
}
function bc0(n) {
  return (
    n.randomType !== "all" &&
    n.randomType !== "speedAll" &&
    n.randomType !== "reverse"
  );
}
const mf = 22,
  Mc0 = 6;
function xc0(n, e) {
  if (!n) return [220 * e, 225];
  const t = T(n, "leftTopWH");
  if (!t) return [220 * e, 225];
  const i = j2(t, 4, "randomTrackDesc.leftTopWH");
  return [i[2] * e, i[3]];
}
function Sc0(n, e, t) {
  if (e.width >= t.width && e.height >= t.height) {
    const i = (e.width - t.width) * 0.5,
      r = (e.height - t.height) * 0.5;
    Ct(n, e, [i, r, i + t.width, r + t.height], t);
    return;
  }
  I5(n, e, t);
}
function I5(n, e, t) {
  n.drawImage(e.image, t.x, t.y, t.width, t.height);
}
function ST(n, e, t, i, r) {
  const s = e.width - i,
    o = e.height - r,
    a = Math.max(0, t.width - i * 2),
    c = Math.max(0, t.height - r * 2);
  (Ct(n, e, [0, 0, i, r], { x: t.x, y: t.y, width: i, height: r }),
    Ct(n, e, [i, 0, s, r], { x: t.x + i, y: t.y, width: a, height: r }),
    Ct(n, e, [s, 0, e.width, r], {
      x: t.x + t.width - i,
      y: t.y,
      width: i,
      height: r,
    }),
    Ct(n, e, [0, r, i, o], { x: t.x, y: t.y + r, width: i, height: c }),
    Ct(n, e, [i, r, s, o], { x: t.x + i, y: t.y + r, width: a, height: c }),
    Ct(n, e, [s, r, e.width, o], {
      x: t.x + t.width - i,
      y: t.y + r,
      width: i,
      height: c,
    }),
    Ct(n, e, [0, o, i, e.height], {
      x: t.x,
      y: t.y + t.height - r,
      width: i,
      height: r,
    }),
    Ct(n, e, [i, o, s, e.height], {
      x: t.x + i,
      y: t.y + t.height - r,
      width: a,
      height: r,
    }),
    Ct(n, e, [s, o, e.width, e.height], {
      x: t.x + t.width - i,
      y: t.y + t.height - r,
      width: i,
      height: r,
    }));
}
function Ct(n, e, t, i) {
  n.drawImage(
    e.image,
    t[0],
    t[1],
    t[2] - t[0],
    t[3] - t[1],
    i.x,
    i.y,
    i.width,
    i.height,
  );
}
function Ln(n, e, t, i, r, s, o = "center", a = "label") {
  m9(n, e, t, {
    family: zi,
    size: i,
    color: r,
    align: s,
    verticalAlign: o,
    kind: a,
  });
}
function de(n, e, t) {
  const i = mF(n, e);
  if (i.sourceKind !== "rho" || i.sourceName.toLowerCase() !== t.toLowerCase())
    throw new Error(e + " 必须来自 " + t + "。");
  return i;
}
function Cc0(n, e, t) {
  const i = n
    .canonicalCandidates(e)
    .filter(
      (r) =>
        r.sourceKind === "rho" &&
        r.sourceName.toLowerCase() === t.toLowerCase(),
    );
  if (i.length > 1) throw new Error(e + " 在 " + t + " 内不唯一。");
  return i[0];
}
function mF(n, e) {
  const t = n.canonicalCandidates(e);
  if (t.length !== 1)
    throw new Error(e + " source 数量必须为 1，实际 " + t.length + "。");
  return t[0];
}
function Ec0(n) {
  return n.replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
}
class Tc0 {
  constructor(e = Math.random) {
    this.random = e;
  }
  random;
  activeGroupId;
  used = new Set();
  selectGroup(e) {
    this.activeGroupId !== e && ((this.activeGroupId = e), this.used.clear());
  }
  pick(e, t) {
    const i = t.filter((c) => e.trackIds.includes(c.id) && LR(e, c.gameType));
    if (i.length === 0)
      throw new Error(`随机池 ${e.id} 没有可加载的 ${e.gameType} 赛道。`);
    this.selectGroup(e.id);
    let r = i.filter((c) => !this.used.has(c.id));
    r.length === 0 && (this.used.clear(), (r = i));
    const s = this.random(),
      o = Math.min(r.length - 1, Math.max(0, Math.floor(s * r.length))),
      a = r[o];
    return (this.used.add(a.id), a);
  }
  clear() {
    this.selectGroup(void 0);
  }
}
const wF = "gui_/window/menu",
  CT = "gui_window.rho",
  _c0 = "설정",
  Gc0 = "파츠",
  Bc0 = "singleplay",
  Ui = 1600,
  Ti = 66;
class ry {
  constructor(e, t) {
    ((this.options = e), (this.assets = t));
    const i = this.canvas.getContext("2d");
    if (!i) throw new Error("浏览器无法创建 P3528 任务栏 Canvas。");
    ((this.context = i),
      Object.assign(this.element.style, {
        position: "absolute",
        bottom: "0",
        left: "0",
        width: "100%",
        height: `${Ti / 9}%`,
      }),
      (this.element.dataset.uiLayer = "navigation"),
      (this.element.hidden = !0),
      this.element.setAttribute("role", "toolbar"),
      this.element.setAttribute("aria-label", "游戏任务栏"),
      this.canvas.setAttribute("aria-hidden", "true"),
      Object.assign(this.canvas.style, {
        width: "100%",
        height: "100%",
        imageRendering: "pixelated",
      }),
      this.element.append(this.canvas),
      t.buttons.forEach((r) => this.appendButton(r)),
      e.root.append(this.element),
      (this.resizeObserver = new ResizeObserver(() => this.render())),
      this.resizeObserver.observe(e.root),
      window.addEventListener("resize", this.onViewportResize),
      this.render());
  }
  options;
  assets;
  element = document.createElement("div");
  canvas = document.createElement("canvas");
  context;
  resizeObserver;
  onViewportResize = () => this.render();
  hovered;
  pressed;
  compositeOwner;
  compositeChanged;
  revision = 0;
  composite(e, t) {
    return (
      (this.compositeOwner = e),
      (this.compositeChanged = t),
      (this.canvas.style.visibility = "hidden"),
      () => {
        this.compositeOwner === e &&
          ((this.compositeOwner = void 0),
          (this.canvas.style.visibility = "visible"),
          (this.compositeChanged = void 0),
          this.render());
      }
    );
  }
  get compositeFrame() {
    if (!this.element.hidden)
      return {
        canvas: this.canvas,
        revision: this.revision,
        rect: this.element.getBoundingClientRect(),
      };
  }
  static async load(e) {
    return new ry(e, await kc0(e.library));
  }
  setVisible(e) {
    ((this.element.hidden = !e),
      (this.hovered = void 0),
      (this.pressed = void 0),
      this.render());
  }
  dispose() {
    ((this.compositeOwner = void 0),
      (this.compositeChanged = void 0),
      this.resizeObserver.disconnect(),
      window.removeEventListener("resize", this.onViewportResize),
      this.element.remove());
  }
  appendButton(e) {
    const t = document.createElement("button"),
      i = this.assets.labels.get(e.name) ?? e.name;
    ((t.type = "button"),
      (t.title = i),
      t.setAttribute("aria-label", i),
      (t.disabled = !this.actionFor(e.name)),
      Object.assign(t.style, {
        position: "absolute",
        left: `${(e.rect.x / Ui) * 100}%`,
        top: `${(e.rect.y / Ti) * 100}%`,
        width: `${(e.rect.width / Ui) * 100}%`,
        height: `${(e.rect.height / Ti) * 100}%`,
        padding: "0",
        border: "0",
        background: "transparent",
        cursor: t.disabled ? "default" : "pointer",
        outline: "none",
      }),
      t.addEventListener("pointerenter", () => {
        (t.disabled || this.options.onHover?.(),
          (this.hovered = e.name),
          this.render());
      }),
      t.addEventListener("pointerleave", () => {
        ((this.hovered = void 0), (this.pressed = void 0), this.render());
      }),
      t.addEventListener("pointerdown", () => {
        ((this.pressed = e.name), this.render());
      }),
      t.addEventListener("pointerup", () => {
        ((this.pressed = void 0), this.render());
      }),
      t.addEventListener("pointercancel", () => {
        ((this.pressed = void 0), this.render());
      }),
      t.addEventListener("focus", () => this.render()),
      t.addEventListener("blur", () => this.render()),
      t.addEventListener("click", () => {
        const r = this.actionFor(e.name);
        !this.element.hidden &&
          r &&
          !t.disabled &&
          (this.options.onActivate?.(), r());
      }),
      this.element.append(t));
  }
  render() {
    const e = this.options.root.getBoundingClientRect(),
      t = Sr(e.width, e.height, window.devicePixelRatio, Ui, Ti);
    (this.canvas.width !== t.width && (this.canvas.width = t.width),
      this.canvas.height !== t.height && (this.canvas.height = t.height),
      this.context.setTransform(t.scaleX, 0, 0, t.scaleY, 0, 0),
      this.context.clearRect(0, 0, Ui, Ti),
      (this.context.imageSmoothingEnabled = !0),
      this.context.drawImage(this.assets.background.image, 0, 0));
    for (const i of this.assets.buttons) {
      const r = this.actionFor(i.name)
        ? st(i.name, this.hovered, this.pressed)
        : 3;
      (ct(this.context, this.assets.images.get(i.node)[r], i.rect),
        document.activeElement?.parentElement === this.element &&
          document.activeElement.getAttribute("aria-label") ===
            (this.assets.labels.get(i.name) ?? i.name) &&
          document.activeElement.matches(":focus-visible") &&
          ((this.context.strokeStyle = "#a3edff"),
          (this.context.lineWidth = 2),
          this.context.strokeRect(
            i.rect.x + 1,
            i.rect.y + 1,
            i.rect.width - 2,
            i.rect.height - 2,
          )));
    }
    (this.revision++, this.compositeChanged?.());
  }
  actionFor(e) {
    if (e === _c0) return this.options.onSettings;
    if (e === Gc0) return this.options.onGarage;
    if (e === Bc0) return this.options.onSinglePlayer;
    if (e === "multiplay") return this.options.onMultiplayer;
  }
}
function vF(n, e) {
  n.name === "Skip" ||
    T(n, "visible") === "false" ||
    (e(n), n.children.forEach((t) => vF(t, e)));
}
function Rc0(n, e) {
  const t = [],
    i = (r, s) => {
      if (r.name === "Skip" || T(r, "visible") === "false") return;
      const o = V0(Ic0(r), s, void 0, e.get(r));
      (T(r, "autoLoadImage") &&
        t.push({ node: r, rect: o, name: sy(r, "name") }),
        r.children.forEach((a) => i(a, o)));
    };
  return (i(n, { x: 0, y: 0, width: Ui, height: Ti }), t);
}
function Ic0(n) {
  return {
    ...n,
    attributes: n.attributes.map((e) =>
      e.name === "windowSize"
        ? { ...e, value: e.value.replace(/^fullwidth\b/, String(Ui)) }
        : e,
    ),
  };
}
async function kc0(n) {
  const [e, t] = await Promise.all([
      yF(n, "tray@cn.bml").bytes().then(s2),
      AF(n, "etc_/baseStringBag.xml").text(),
    ]),
    i = [];
  vF(e, (a) => {
    T(a, "autoLoadImage") && i.push(a);
  });
  const r = new Map(
      await Promise.all(
        i.map(async (a) => [
          a,
          await Promise.all([1, 2, 3, 4].map((c) => TT(ET(n, Pc0(a, c))))),
        ]),
      ),
    ),
    s = new Map([...r].map(([a, c]) => [a, c[0]]));
  return {
    background: await TT(ET(n, sy(e, "image"))),
    images: r,
    buttons: Rc0(e, s),
    labels: Lc0(e, t),
  };
}
function Lc0(n, e) {
  const t = new DOMParser().parseFromString(e, "application/xml"),
    i = new Map(
      Array.from(t.querySelectorAll("k")).map((o) => [
        o.getAttribute("n"),
        o.querySelector('m[c="cn"]')?.getAttribute("v") ?? "",
      ]),
    ),
    r = new Map(),
    s = (o) => {
      const a = T(o, "altText") ?? T(o, "text") ?? "",
        c = /^#sb\(([^)]+)\)$/.exec(a)?.[1],
        l = c && i.get(c);
      (l && r.set(T(o, "name") ?? "", l), o.children.forEach(s));
    };
  return (s(n), r.set("goKartPass", i.get("kartPass") || "通行证"), r);
}
function Pc0(n, e) {
  const t = sy(n, "autoLoadImage");
  return t.endsWith("@zz") ? `${t.slice(0, -3)}${e}@zz` : `${t}${e}`;
}
function ET(n, e) {
  const t = e.endsWith("@zz") ? [`${e.slice(0, -3)}@cn`, e] : [e];
  for (const i of t) {
    const r = `${wF}/${i}.png`;
    if (n.canonicalCandidates(r).length > 0) return yF(n, `${i}.png`);
  }
  throw new Error(`P3528 任务栏缺少原版图片 ${e}。`);
}
function yF(n, e) {
  const t = AF(n, `${wF}/${e}`);
  if (t.sourceKind !== "rho" || t.sourceName.toLowerCase() !== CT)
    throw new Error(`P3528 任务栏资源必须来自 ${CT}。`);
  return t;
}
function AF(n, e) {
  const t = n.canonicalCandidates(e);
  if (t.length !== 1) throw new Error(`P3528 任务栏资源 ${e} 不唯一或缺失。`);
  return t[0];
}
function sy(n, e) {
  const t = T(n, e);
  if (t === void 0) throw new Error(`P3528 任务栏缺少 ${n.name}.${e}。`);
  return t;
}
async function TT(n) {
  const e = await p2(await n.bytes()),
    t = document.createElement("canvas");
  ((t.width = e.width), (t.height = e.height));
  const i = t.getContext("2d");
  if (!i) throw new Error("浏览器无法解码 P3528 任务栏图片。");
  return (
    i.putImageData(
      new ImageData(new Uint8ClampedArray(e.pixels), e.width, e.height),
      0,
      0,
    ),
    { image: t, width: t.width, height: t.height }
  );
}
function Fc0(n, e = "") {
  const t = new DOMParser().parseFromString(n, "application/xml");
  if (t.querySelector("parsererror")) throw Error("多人 BGM 配置无效。");
  const i = (s, o = new Set()) => {
    if (o.has(s)) throw Error("多人 BGM 引用循环。");
    o.add(s);
    const a = Array.from(
      t.querySelectorAll("defaultBgmList > defaultBgm"),
    ).find((f) => f.getAttribute("stage") === s);
    if (!a) throw Error(`缺少 ${s} BGM。`);
    const c = a.getAttribute("ref");
    if (c) return i(c, o);
    const l = a.getAttribute("id"),
      u = l
        ? Array.from(t.querySelectorAll("bgmList > bgm")).find(
            (f) => f.getAttribute("id") === l,
          )
        : a,
      h = u?.getAttribute("theme"),
      d = u?.getAttribute("name");
    if (!h || !d || /[\\/]/.test(h + d) || h.includes("..") || d.includes(".."))
      throw Error("多人 BGM 路径无效。");
    return `sound_/bgm/${h}/${d}.ogg`;
  };
  return {
    lobby:
      e === ""
        ? i("MainMenuEx")
        : (() => {
            if (
              !Array.from(t.querySelectorAll("bgmList > bgm")).some((o) => {
                const a = o.getAttribute("theme"),
                  c = o.getAttribute("name");
                return (
                  a &&
                  c &&
                  /^[-\w]+$/.test(a) &&
                  /^[-\w]+$/.test(c) &&
                  `sound_/bgm/${a}/${c}.ogg` === e
                );
              })
            )
              throw Error("所选主页面音乐不在官服曲目表中。");
            return e;
          })(),
    room: i("GameReadyStage"),
  };
}
function Dc0(n, e) {
  const t = new DOMParser().parseFromString(n, "application/xml"),
    i = new DOMParser().parseFromString(e, "application/xml");
  if (t.querySelector("parsererror") || i.querySelector("parsererror"))
    throw Error("官服音乐列表无效。");
  const r = new Map(
    Array.from(i.querySelectorAll("StringBag > k")).map((s) => [
      s.getAttribute("n"),
      Array.from(s.children)
        .find((o) => o.getAttribute("c") === "cn")
        ?.getAttribute("v"),
    ]),
  );
  return Array.from(t.querySelectorAll("bgmList > bgm")).flatMap((s) => {
    const o = Number(s.getAttribute("id")),
      a = s.getAttribute("theme"),
      c = s.getAttribute("name");
    return !Number.isInteger(o) ||
      o < 1 ||
      !a ||
      !c ||
      !/^[-\w]+$/.test(a) ||
      !/^[-\w]+$/.test(c)
      ? []
      : [{ id: o, label: r.get(c) || c, path: `sound_/bgm/${a}/${c}.ogg` }];
  });
}
function Vc0(n) {
  const e = n.children.find((h) => T(h, "name") === "onAutoReadyCont"),
    t = n.children.find((h) =>
      h.children.some((d) => T(d, "text") === "#sb(receiveOption)"),
    ),
    i = n.children.find((h) => T(h, "name") === "onIgnoreRequestFriendMsgCont");
  if (!e || !t || !i) throw new Error("游戏设置缺少自定义区域的原版模板。");
  const [r, s, , o] = (T(i, "leftTopWH") ?? "").split(/\s+/).map(Number),
    [, , a] = (T(n, "windowRect") ?? "").split(/\s+/).map(Number);
  if (![r, s, o, a].every(Number.isFinite))
    throw new Error("游戏设置布局不支持自定义区域。");
  const c = (h, d) => ({
      ...h,
      attributes: [
        ...h.attributes.filter((f) => !(f.name in d)),
        ...Object.entries(d).map(([f, p]) => ({ name: f, value: p })),
      ],
    }),
    l = [
      [
        "webFlyingPetSetting",
        "inGameFlyingPetVisible",
        "局内显示自己的飞行宠物",
      ],
      [
        "webRaceAnonymousSetting",
        "raceAnonymous",
        "比赛匿名（比赛期间隐藏其他玩家ID）",
      ],
      ["webRaceTimeGapSetting", "raceTimeGap", "多人比赛时间差提示（估算）"],
      ["webClassicHudSetting", "classicHud", "老车使用经典码表与氮气条"],
    ],
    u = new Set([
      "onIgnoreRequestFriendMsgCont",
      "onIgnoreInviteMsgCont",
      "recOption",
    ]);
  return {
    ...n,
    children: [
      ...n.children
        .filter((h) => !u.has(T(h, "name") ?? ""))
        .map((h) =>
          h === t
            ? {
                ...t,
                children: t.children.map((d) =>
                  T(d, "text") === "#sb(receiveOption)"
                    ? c(d, { text: "自定义设置" })
                    : d,
                ),
              }
            : h === e
              ? {
                  ...e,
                  children: e.children.map((d) =>
                    T(d, "name") === "onAutoReady"
                      ? c(d, { enable: "true" })
                      : d,
                  ),
                }
              : h,
        ),
      ...l.map(([h, d, f], p) => {
        const v = c(e, {
          name: h,
          leftTopWH: `${r} ${s + p * (o + 10)} ${a - r * 2} ${o}`,
        });
        return {
          ...v,
          children: v.children.map((w) =>
            w.name === "PlaneCheckButton"
              ? c(w, { name: d, enable: "true" })
              : c(w, { text: f }),
          ),
        };
      }),
    ],
  };
}
const _i = "P3528 Settings",
  Ts = "raceSpeedVersion",
  Nc0 = "raceSpeedVersionCont",
  _s = "raceSpeedChannel",
  Oc0 = "raceSpeedCont",
  bF = "raceSpeedHint",
  Dn = 21,
  zc0 = 7,
  Uc0 = 3,
  $c0 = "36 217 868 26",
  Wc0 = "36 247 868 26",
  Hc0 = "36 324 904 344",
  W3 = "dialog/optionDialog";
async function qc0(n) {
  const e = async (C) => s2(await Ml(n, C).bytes()),
    [t, i, r, s, o, a, c, l, u] = await Promise.all([
      e(`${W3}/mq_dialog@zz.bml`),
      e(`${W3}/view_graphicsOption@zz.bml`),
      e(`${W3}/view_gameOption@cn.bml`),
      e(`${W3}/view_keyboardMap@zz.bml`),
      e("gui_/monocoque/config.bml"),
      e("gui_/monocoque/frame.bml"),
      e(`${W3}/dialog_stringBag.bml`),
      Ml(n, "etc_/baseStringBag.xml").text(),
      e("dialog2_/customMessageBox/mq_dialog@zz.bml"),
    ]),
    h = Vc0(Xc0(r)),
    d = t.children.find((C) => C.name === "CaptionWindow"),
    f = await ma(n, d, W3),
    p = { ...d, children: [...d.children, ...(f ? [f] : [])] },
    v = { ...t, children: t.children.map((C) => (C === d ? p : C)) },
    w = new Map(),
    g = new Map(a.children.map((C) => [C.name, C.children.map(Ft)])),
    y = new Set(["대화상자정보", "대화상자경고"]),
    b = u.children[0];
  let A;
  Qg(s, (C) => {
    T(C, "name") === "keymapScroll" && (A = Hv(C, a));
  });
  for (const C of [v, h, i, s, b]) Qg(C, (S) => Kc0(S, y, w, o, a));
  ([
    "CaptionDialog",
    "TabBoxLarge",
    "GrayInnerFrame",
    "GrayInputBox",
    "DefaultEdit",
    "SelectBtn",
    "VSection",
    "DefaultCheckButton",
    "NewHorizonScrollButton",
    "NewHorizonScrollArea",
    "BulletLeftButton",
    "BulletRightButton",
    "DefaultVerticalScrollArea",
    "DefaultVerticalScrollButton",
    "HSection",
  ].forEach((C) =>
    g.get(C)?.forEach((S) => {
      S.texture && y.add(S.texture);
    }),
  ),
    w.forEach((C) =>
      C.states.forEach((S) => {
        S.frame.texture && y.add(S.frame.texture);
      }),
    ));
  const M = new Map(
      await Promise.all([...y].map(async (C) => [C, await Zc0(Yc0(n, C))])),
    ),
    E = Qc0(l, c),
    _ = await f5(_i, await Ml(n, "gui_/font/SourceHanSansCN-Bold.otf").bytes());
  return {
    definition: v,
    graphics: i,
    game: h,
    keyboard: s,
    keymapScrollbar: A,
    keyMessageBox: b,
    config: o,
    frames: g,
    styles: w,
    images: M,
    strings: E,
    font: _,
  };
}
function Kc0(n, e, t, i, r) {
  const s = T(n, "texture");
  (s && e.add(s), n.name === "TextButton" && t.set(n, m4(n, i, r)));
  const o = T(n, "autoLoadImage") ?? T(n, "autoImage");
  o && [1, 2, 3, 4].forEach((a) => e.add(`${o}${a}`));
}
function Qg(n, e) {
  (e(n), n.children.forEach((t) => Qg(t, e)));
}
const _T = ["vipCont", "riderSchoolCont", "tierGradeCont"],
  jc0 = "速度频道设置",
  Jg = "速度版本",
  em = "速度频道";
function Xc0(n) {
  const e = n.children.findIndex((r) => T(r, "name") === _T[0]);
  if (e < 0)
    throw new Error(
      "P3528 变更设置页缺少「信息公开设置」区块（vipCont），速度频道行无处安放。",
    );
  const t = new Map([
      [e, GT(Nc0, Ts, Jg, $c0, Uc0)],
      [e + 1, GT(Oc0, _s, em, Wc0, zc0)],
    ]),
    i = [];
  return (
    n.children.forEach((r, s) => {
      const o = T(r, "name") ?? "";
      if (_T.includes(o)) {
        const a = t.get(s);
        a && i.push(a);
        return;
      }
      i.push(r);
    }),
    MF({ ...n, children: i }, (r) => {
      if (r.name === "Label" && T(r, "text") === "#sb(infoOption)")
        return Ec(r, "text", jc0);
      if (r.name === "Label" && T(r, "text") === "#sb(premiumHideDesc)") {
        let s = Ec(r, "text", "");
        return ((s = Ec(s, "windowRect", Hc0)), Ec(s, "name", bF));
      }
    })
  );
}
function GT(n, e, t, i, r) {
  return {
    name: "Container",
    text: "",
    attributes: [
      { name: "name", value: n },
      { name: "leftTopWH", value: i },
    ],
    children: [
      {
        name: "Label",
        text: "",
        attributes: [
          { name: "windowRect", value: "0 0 40 12" },
          { name: "align", value: "vcenter" },
          { name: "text", value: t },
          { name: "textAlign", value: "left" },
          { name: "autoSizing", value: "true" },
          { name: "textRender", value: "bold16" },
          { name: "textColor", value: "255 42 55 80" },
        ],
        children: [],
      },
      {
        name: "ComboBox",
        text: "",
        attributes: [
          { name: "name", value: e },
          { name: "windowSize", value: "256 26" },
          { name: "frame", value: "DefaultEdit" },
          { name: "listFrame", value: "DefaultEdit" },
          { name: "comboListLength", value: String(r * Dn) },
          { name: "align", value: "right,vcenter" },
          { name: "adjust", value: "5 0" },
        ],
        children: [],
      },
    ],
  };
}
function MF(n, e) {
  const t = e(n);
  return t || { ...n, children: n.children.map((i) => MF(i, e)) };
}
function Ec(n, e, t) {
  const i = n.attributes.some((r) => r.name === e)
    ? n.attributes.map((r) => (r.name === e ? { name: e, value: t } : r))
    : [...n.attributes, { name: e, value: t }];
  return { ...n, attributes: i };
}
function Ml(n, e) {
  const t = n.canonicalCandidates(e);
  if (t.length !== 1) throw new Error(`P3528 设置资源 ${e} 不唯一或缺失。`);
  return t[0];
}
function Yc0(n, e) {
  for (const t of [
    W3,
    "dialog2_/customMessageBox",
    "stage_/common",
    "gui_/monocoque",
  ]) {
    const i = `${t}/${e}.png`;
    if (n.canonicalCandidates(i).length) return Ml(n, i);
  }
  throw new Error(`P3528 设置缺少图片 ${e}。`);
}
async function Zc0(n) {
  const e = await p2(await n.bytes()),
    t = document.createElement("canvas");
  ((t.width = e.width), (t.height = e.height));
  const i = t.getContext("2d");
  if (!i) throw new Error("无法创建设置图片 Canvas。");
  return (
    i.putImageData(
      new ImageData(new Uint8ClampedArray(e.pixels), e.width, e.height),
      0,
      0,
    ),
    { image: t, width: t.width, height: t.height }
  );
}
function Qc0(n, e) {
  const t = new DOMParser().parseFromString(n, "application/xml");
  if (t.querySelector("parsererror"))
    throw new Error("P3528 baseStringBag 不是有效 XML。");
  const i = new Map();
  for (const r of t.documentElement.children) {
    const s = [...r.children]
      .find((o) => o.getAttribute("c") === "cn")
      ?.getAttribute("v");
    s != null && i.set(r.getAttribute("n"), s);
  }
  for (const r of e.children) {
    const s = r.children.find((o) => T(o, "c") === "cn");
    s && i.set(T(r, "n"), T(s, "v"));
  }
  return i;
}
const Jc0 = {
    bgmMute: "bgmEnabled",
    fxMute: "fxEnabled",
    enableRoadSound: "enableRoadSound",
    boostBlur: "boostBlur",
    setDualBoostAuto: "dualBoostAuto",
    toonLine: "toonLine",
    shadow: "shadow",
    inGameFlyingPetVisible: "inGameFlyingPetVisible",
    raceAnonymous: "raceAnonymous",
    raceTimeGap: "raceTimeGap",
    classicHud: "classicHud",
    onAutoReady: "autoReady",
  },
  Ie = [
    "view_graphicsOption@zz",
    "view_gameOption@zz",
    "view_keyboardMap@zz",
    "view_macroChatDefine@zz",
  ],
  k3 = { x: 0, y: 0, width: 1600, height: 900 },
  Tc = "rgb(42,55,80)",
  wf = "#bfbfbf",
  el0 = "—";
class oy {
  constructor(e, t) {
    ((this.options = e),
      (this.assets = t),
      (this.draft = { ...e.initial }),
      (this.raceSpeed = e.initialSpeed),
      (this.raceVersion = e.initialVersion ?? C4));
    const i = this.canvas.getContext("2d");
    if (!i) throw new Error("浏览器无法创建设置窗口 Canvas。");
    ((this.context = i),
      Object.assign(this.element.style, { position: "absolute", inset: "0" }),
      (this.element.dataset.uiLayer = "dialog"),
      Object.assign(this.canvas.style, { width: "100%", height: "100%" }),
      this.canvas.setAttribute("aria-hidden", "true"),
      this.element.setAttribute("role", "dialog"),
      this.element.setAttribute("aria-modal", "true"),
      this.element.setAttribute("aria-label", this.text("#sb(option)")),
      (this.element.tabIndex = -1),
      this.canvas.addEventListener("pointerdown", () => {
        (this.closeCombo(), this.element.focus());
      }),
      this.element.addEventListener("focusin", (r) => {
        const s = r.target.dataset.keyIndex;
        this.focusKey(s === void 0 ? void 0 : Number(s));
      }),
      this.element.addEventListener("keydown", this.onKeyDown),
      this.element.addEventListener(
        "wheel",
        (r) => {
          if (this.openCombo === "bgm") {
            (r.preventDefault(),
              (this.bgmOffset = Math.max(
                0,
                Math.min(
                  Math.max(0, this.bgmChoices.length + 1 - 8),
                  this.bgmOffset + (r.deltaY > 0 ? 1 : -1),
                ),
              )),
              this.render());
            return;
          }
          this.tab !== Ie[2] ||
            this.keyError ||
            (r.preventDefault(),
            this.keyScroll.wheel(r.deltaY < 0 ? -1 : 1, 30, !0));
        },
        { passive: !1 },
      ),
      this.element.append(this.canvas),
      Object.assign(this.errorElement.style, {
        position: "absolute",
        inset: "0",
        pointerEvents: "none",
      }),
      this.errorElement.setAttribute("role", "alertdialog"),
      this.errorElement.setAttribute("aria-modal", "true"),
      this.errorElement.setAttribute(
        "aria-label",
        this.text("#sb(gameKeyMap)"),
      ),
      this.element.append(this.errorElement),
      e.root.append(this.element),
      (this.resizeObserver = new ResizeObserver(() => this.render())),
      this.resizeObserver.observe(e.root),
      window.addEventListener("resize", this.onWindowResize),
      this.render(),
      this.controls.get("ok")?.focus());
  }
  options;
  assets;
  element = document.createElement("div");
  canvas = document.createElement("canvas");
  errorElement = document.createElement("div");
  context;
  controls = new Map();
  renderedControls = new Set();
  resizeObserver;
  previousFocus = document.activeElement;
  draft;
  tab = Ie[0];
  hovered;
  pressed;
  volumeRepeat;
  volumeDrag;
  keyChanges = {};
  keyFocus;
  cursorVisible = !0;
  cursorTimer;
  keyViewport;
  keyScroll = new b6(() => this.render());
  keyError;
  keyErrorLines = [];
  raceSpeed = 7;
  raceVersion = "国服";
  openCombo;
  speedCombo;
  versionCombo;
  bgmCombo;
  bgmOffset = 0;
  bgmChoices = [];
  gamepadPoll;
  gamepadHeld = new Set();
  onWindowResize = () => this.render();
  static async load(e) {
    const t = await qc0(e.library);
    try {
      const i = e.library.exactCanonicalCandidates(
          "zeta_/cn/content/bgmList.xml",
        )[0],
        r = e.library.exactCanonicalCandidates("etc_/bgmList.xml")[0];
      let s = [];
      if (i && r) {
        const [c, l] = await Promise.all([i.bytes(), r.bytes()]),
          u = (h) =>
            new TextDecoder(h[0] === 255 ? "utf-16le" : "utf-8").decode(h);
        s = Dc0(u(c), u(l)).filter(
          (h) => e.library.exactCanonicalCandidates(h.path).length === 1,
        );
      }
      const o = new oy(e, t);
      o.bgmChoices = s;
      const a = s.findIndex((c) => c.path === o.draft.mainMenuBgmPath);
      return ((o.bgmOffset = Math.max(0, a - 3)), o.render(), o);
    } catch (i) {
      throw (G1(t.font), i);
    }
  }
  dispose() {
    (this.stopVolumePointer(),
      clearInterval(this.cursorTimer),
      clearInterval(this.gamepadPoll),
      this.keyScroll.dispose(),
      this.resizeObserver.disconnect(),
      window.removeEventListener("resize", this.onWindowResize),
      this.element.remove(),
      G1(this.assets.font),
      this.previousFocus instanceof HTMLElement && this.previousFocus.focus());
  }
  render() {
    const e = this.element.getBoundingClientRect();
    (p3(
      this.canvas,
      this.context,
      e.width,
      e.height,
      xe(),
      k3.width,
      k3.height,
    ),
      this.context.clearRect(0, 0, 1600, 900),
      (this.context.imageSmoothingEnabled = !0),
      this.renderedControls.clear(),
      (this.speedCombo = void 0),
      (this.versionCombo = void 0),
      (this.bgmCombo = void 0),
      this.drawNode(this.assets.definition, k3),
      (this.errorElement.hidden = !this.keyError),
      this.keyError && this.drawNode(this.assets.keyMessageBox, k3),
      this.controls.forEach((t) => {
        t.hidden = !this.renderedControls.has(t);
      }),
      !(this.tab !== Ie[0] && this.tab !== Ie[1]) &&
        (this.drawSpeedMenu(), this.drawVersionMenu(), this.drawBgmMenu()));
  }
  drawNode(e, t, i) {
    if (!this.visible(e)) return;
    const r =
        T(e, "frame") ??
        (e.name === "PlaneCheckButton" ? "DefaultCheckButton" : ""),
      s = this.assets.frames.get(r)?.[0],
      o = this.nodeRect(e, t, s);
    this.drawSelf(e, o, s, i);
    const a = s ? E9(s, o) : o;
    (this.drawChildren(e, a),
      e.name === "CaptionWindow" && this.drawCaption(e, o, s));
  }
  nodeRect(e, t, i) {
    if (e === this.assets.keyMessageBox) return this.keyMessageRect(e, i);
    const r = sl0(e, t, i, this.labelSize(e));
    return T(e, "name") === "keymapContainer"
      ? { ...r, y: r.y - this.keyScroll.contentOffset }
      : r;
  }
  labelSize(e) {
    if (!(e.name !== "Label" || T(e, "autoSizing") !== "true"))
      return ve(this.context, this.text(T(e, "text") ?? ""), {
        family: _i,
        size: RT(T(e, "textRender") ?? "bold16"),
      });
  }
  drawChildren(e, t) {
    if (e.name === "ViewportPanel") {
      this.drawKeyViewport(e, t);
      return;
    }
    e.children.forEach((r) => this.drawNode(r, t, e));
    const i = [this.assets.graphics, this.assets.game, this.assets.keyboard];
    T(e, "name") === "context" &&
      !i.includes(e) &&
      this.drawNode(i[Ie.indexOf(this.tab)], t);
  }
  drawKeyViewport(e, t) {
    ((this.keyViewport = t),
      this.context.save(),
      this.context.beginPath(),
      this.context.rect(t.x, t.y, t.width, t.height),
      this.context.clip(),
      e.children.forEach((i) => this.drawNode(i, t, e)),
      this.context.restore(),
      (this.keyViewport = void 0));
  }
  visible(e) {
    const t = T(e, "name") ?? "";
    return t.startsWith("view_")
      ? Ie.includes(t)
      : il0(e)
        ? !1
        : ({
            imgBoostBlurOn: this.draft.boostBlur,
            imgBoostBlurOff: !this.draft.boostBlur,
            imgBoostRefWaveEnable: !1,
            imgItemCutOn: !0,
            imgAdvanceItemCutEffectOn: !1,
            imgBackMirrorCutOn: !0,
          }[t] ?? T(e, "visible") !== "false");
  }
  drawSelf(e, t, i, r) {
    const o = {
      TextButton: () => this.drawButton(e, t),
      ImageButton: () => this.drawImageButton(e, t),
      PlaneCheckButton: () => this.drawCheck(e, t, r),
      ImageCheckButton: () => this.drawRadio(e, t),
      ScrollBar: () =>
        T(e, "name") === "keymapScroll"
          ? this.drawKeyScroll(t)
          : this.drawVolume(e, t),
      KeyEdit: () => this.drawKeyEdit(e, t),
      ColorLabel: () => this.drawKeyErrorText(t),
      ComboBox: () => this.drawCombo(e, t, i),
      Label: () => this.drawLabel(e, t),
    }[e.name];
    if (o) {
      o();
      return;
    }
    (i && this.drawFrame(i, t), e.name === "Panel" && this.drawPanel(e, t));
  }
  drawPanel(e, t) {
    const i = T(e, "name");
    if (i === "bgmVolumeBar" || i === "fxVolumeBar") return;
    const r = this.assets.images.get(this.panelTexture(e));
    r && this.context.drawImage(r.image, t.x, t.y, t.width, t.height);
    const s = T(e, "color");
    s &&
      ((this.context.fillStyle = IT(s)),
      this.context.fillRect(t.x, t.y, t.width, t.height));
  }
  panelTexture(e) {
    return T(e, "name") === "iconPanel" && this.keyError === "invalidKey"
      ? "대화상자경고"
      : (T(e, "texture") ?? "");
  }
  drawCaption(e, t, i) {
    const r = f3(i, t, an(e, this.assets.config)),
      s = e === this.assets.keyMessageBox ? "#sb(gameKeyMap)" : T(e, "caption");
    this.drawText(this.text(s), r, "bold20", "center", "white", "button");
  }
  drawLabel(e, t) {
    const r =
      (T(e, "name") ?? "") === bF
        ? this.speedChannelHint()
        : this.text(T(e, "text") ?? "");
    this.drawText(
      r,
      t,
      T(e, "textRender") ?? "bold16",
      T(e, "textAlign") ?? "left",
      IT(T(e, "textColor") ?? "black"),
    );
  }
  drawButton(e, t) {
    const i = T(e, "name") ?? "",
      r = [
        Ie[0],
        Ie[1],
        Ie[2],
        "ok",
        "okButton",
        "cancel",
        "defaultSound",
        "defaultGraphic",
        "defaultKeyMap",
        "poorM",
        "normM",
      ].includes(i),
      s = i === this.tab,
      o = s ? 3 : this.state(i, r || Ie.includes(i)),
      a = this.assets.styles.get(e).states[o];
    this.drawFrame(a.frame, t);
    const c = this.text(T(e, "text") ?? i);
    (this.drawText(
      c,
      E9(a.frame, t),
      a.textRender,
      rl0(e),
      a.textColor,
      "button",
    ),
      this.button(i, c, t, !r, () => {
        (this.options.onActivate(), this.activate(i));
      }),
      this.attachMessageButton(i),
      Ie.includes(i) &&
        this.controls.get(i)?.setAttribute("aria-pressed", String(s)));
  }
  attachMessageButton(e) {
    const t = this.controls.get(e);
    e === "okButton" &&
      t.parentElement !== this.errorElement &&
      this.errorElement.append(t);
  }
  drawImageButton(e, t) {
    const i = T(e, "name"),
      r = T(e, "autoLoadImage"),
      s = `close-${i}`;
    (ct(
      this.context,
      this.assets.images.get(`${r}${this.state(s, !0) + 1}`),
      t,
    ),
      this.button(s, this.text("#sb(cancel)"), t, !1, () => {
        (this.options.onActivate(), this.options.onCancel());
      }));
  }
  drawCheck(e, t, i) {
    const r = T(e, "name"),
      s = Jc0[r],
      o = s ? this.draft[s] : ol0(r);
    this.drawFrame(this.assets.frames.get("DefaultCheckButton")[Number(o)], t);
    const a = [...e.children, ...(i?.children ?? [])].find(
        (u) => u.name === "Label",
      ),
      c = this.text((a && T(a, "text")) || r),
      l = {
        ...t,
        width: Math.max(t.width, 25 + this.context.measureText(c).width),
      };
    (this.button(r, c, l, !s, () => this.toggle(s)),
      this.controls.get(r)?.setAttribute("aria-pressed", String(o)));
  }
  drawRadio(e, t) {
    const i = T(e, "name"),
      r = T(e, "autoImage"),
      s = al0(this.draft),
      o = this.assets.images.get(`${r}${i === s ? 2 : 1}`);
    this.context.drawImage(o.image, t.x, t.y);
    const a = this.text(T(e.children[0], "text"));
    (this.button(i, a, t, !["poorMachine", "normMachine"].includes(i), () => {
      (this.options.onActivate(),
        this.applyGraphicsPreset(i === "normMachine"),
        this.render());
    }),
      this.controls.get(i)?.setAttribute("role", "radio"),
      this.controls.get(i)?.setAttribute("aria-checked", String(i === s)));
  }
  drawCombo(e, t, i) {
    const r = T(e, "name");
    if (r === Ts) {
      this.drawVersionCombo(t, i);
      return;
    }
    if (r === _s) {
      this.drawSpeedCombo(t, i);
      return;
    }
    if (r === "mainMenuBgm") {
      this.drawBgmCombo(t, i);
      return;
    }
    this.drawFrame(i, t);
    const s = {
      resol: "1600 X 900 (16:9)",
      windowed: "#sb(windowed)",
      mainMenuBgm: "#sb(defaultBgm)",
    };
    this.drawText(
      this.text(s[r] ?? ""),
      E9(i, t),
      "bold16",
      "center",
      "#838383",
      "button",
    );
  }
  drawVersionCombo(e, t) {
    this.drawFrame(t, e);
    const i = E9(t, e);
    this.versionCombo = { rect: e, client: i };
    const r = Ac(this.raceVersion);
    (this.drawText(
      this.raceVersion,
      i,
      "bold16",
      "left",
      r.available ? Tc : wf,
      "button",
    ),
      this.button(
        Ts,
        `${Jg}：${this.raceVersion}`,
        e,
        !!this.options.speedLocked,
        () => this.toggleCombo("version"),
      ),
      this.drawComboRoles(Ts, "version"));
  }
  drawSpeedCombo(e, t) {
    this.drawFrame(t, e);
    const i = E9(t, e);
    this.speedCombo = { rect: e, client: i };
    const r = this.raceSpeedChannel(),
      s = r === void 0 ? el0 : this.channelText(r);
    (this.drawText(s, i, "bold16", "left", r?.available ? Tc : wf, "button"),
      this.button(_s, `${em}：${s}`, e, !!this.options.speedLocked, () =>
        this.toggleCombo("speed"),
      ),
      this.drawComboRoles(_s, "speed"));
  }
  drawBgmCombo(e, t) {
    this.drawFrame(t, e);
    const i = E9(t, e);
    this.bgmCombo = { rect: e, client: i };
    const s =
      this.bgmChoices.find((o) => o.path === this.draft.mainMenuBgmPath)
        ?.label ??
      (this.draft.mainMenuBgmPath === ""
        ? this.text("#sb(defaultBgm)")
        : "未找到曲目");
    (this.drawText(s, i, "bold16", "left", Tc, "button"),
      this.button(
        "mainMenuBgm",
        `主页面音乐：${s}`,
        e,
        this.bgmChoices.length === 0,
        () => this.toggleCombo("bgm"),
      ),
      this.drawComboRoles("mainMenuBgm", "bgm"));
  }
  drawComboRoles(e, t) {
    const i = this.controls.get(e);
    (i.setAttribute("role", "combobox"),
      i.setAttribute("aria-haspopup", "listbox"),
      i.setAttribute("aria-expanded", String(this.openCombo === t)));
  }
  drawSpeedMenu() {
    if (this.openCombo !== "speed" || !this.speedCombo) return;
    const e = Di(this.raceVersion),
      { rows: t, list: i } = this.comboBoxGeometries(this.speedCombo, e.length);
    (this.drawComboListFrame(i),
      e.forEach((r, s) => {
        const o = { ...t, y: t.y + s * Dn, height: Dn },
          a = `${_s}-${r.speed}`;
        (this.drawComboRow(
          a,
          o,
          this.channelText(r),
          r.available,
          r.unavailableReason,
          () => this.selectSpeed(r),
        ),
          r.available &&
            this.raceSpeed === r.speed &&
            this.controls.get(a)?.setAttribute("aria-selected", "true"));
      }));
  }
  drawVersionMenu() {
    if (this.openCombo !== "version" || !this.versionCombo) return;
    const { rows: e, list: t } = this.comboBoxGeometries(
      this.versionCombo,
      Qd.length,
    );
    (this.drawComboListFrame(t),
      Qd.forEach((i, r) => {
        const s = { ...e, y: e.y + r * Dn, height: Dn },
          o = `${Ts}-${i}`,
          a = Ac(i);
        (this.drawComboRow(o, s, i, a.available, a.unavailableReason, () =>
          this.selectVersion(i),
        ),
          a.available &&
            i === this.raceVersion &&
            this.controls.get(o)?.setAttribute("aria-selected", "true"));
      }));
  }
  drawBgmMenu() {
    if (this.openCombo !== "bgm" || !this.bgmCombo) return;
    const e = [
        { id: 0, label: this.text("#sb(defaultBgm)"), path: "" },
        ...this.bgmChoices,
      ],
      t = Math.min(8, e.length),
      i = this.comboBoxGeometries(this.bgmCombo, t),
      r = Math.min(0, k3.height - (i.list.y + i.list.height) - 12),
      s = { ...i.list, y: i.list.y + r },
      o = { ...i.rows, y: i.rows.y + r };
    (this.drawComboListFrame(s),
      e.slice(this.bgmOffset, this.bgmOffset + t).forEach((a, c) => {
        const l = { ...o, y: o.y + c * Dn, height: Dn },
          u = `mainMenuBgm-${a.path}`;
        (this.drawComboRow(u, l, a.label, !0, void 0, () => {
          (this.options.onActivate(),
            (this.draft = { ...this.draft, mainMenuBgmPath: a.path }),
            (this.openCombo = void 0),
            this.render());
        }),
          a.path === this.draft.mainMenuBgmPath &&
            this.controls.get(u)?.setAttribute("aria-selected", "true"));
      }));
  }
  drawComboListFrame(e) {
    const t = this.assets.frames.get("DefaultEdit")?.[0];
    t && this.drawFrame(t, e);
  }
  comboBoxGeometries(e, t) {
    const i = this.assets.frames.get("DefaultEdit")?.[0],
      r = { ...e.client, height: t * Dn },
      s = i
        ? {
            x: r.x - i.left.width,
            y: r.y - i.caption.height,
            width: r.width + i.left.width + i.right.width,
            height: r.height + i.caption.height + i.bottom.height,
          }
        : r;
    return { rows: r, list: s };
  }
  drawComboRow(e, t, i, r, s, o) {
    const a = this.assets.frames.get("SelectBtn"),
      c = r ? st(e, this.hovered, this.pressed) : 0;
    (a?.length && this.drawFrame(a[Math.min(c, a.length - 1)], t),
      this.drawText(
        i,
        { ...t, x: t.x + 4 },
        "bold16",
        "left",
        r ? Tc : wf,
        "button",
      ));
    const l = r ? i : `${i}（${s ?? ""}）`;
    this.button(e, l, t, !r, o);
  }
  setRoomSpeed(e, t) {
    !this.options.speedLocked ||
      (this.raceSpeed === e && this.raceVersion === t) ||
      ((this.raceSpeed = e),
      (this.raceVersion = t),
      (this.openCombo === "speed" || this.openCombo === "version") &&
        (this.openCombo = void 0),
      this.render());
  }
  raceSpeedChannel() {
    return zv(this.raceVersion, this.raceSpeed);
  }
  channelText(e) {
    return VP(e, (t) => this.text(t));
  }
  speedChannelHint() {
    if (this.options.speedLocked)
      return "多人游戏的速度由房间统一决定，不能在个人设置中修改。";
    const e = Ac(this.raceVersion);
    if (!e.available)
      return `${Jg}${this.raceVersion}当前不可选：${e.unavailableReason ?? ""}`;
    const t = Di(this.raceVersion),
      i = t.filter((o) => o.available),
      r = t.filter((o) => !o.available);
    if (r.length === 0) return "";
    const s = i.map((o) => this.channelText(o)).join("、");
    return `${em}设置：当前可选 ${s || "无"}。其余 ${r.length} 个档位缺少车辆快照，暂不可选。`;
  }
  toggleCombo(e) {
    (e !== "bgm" && this.options.speedLocked) ||
      (this.options.onActivate(),
      (this.openCombo = this.openCombo === e ? void 0 : e),
      this.render());
  }
  selectVersion(e) {
    if (this.options.speedLocked) return;
    (this.options.onActivate(), (this.raceVersion = e));
    const t = Di(e)[0];
    if (t?.available) this.raceSpeed = t.speed;
    else {
      const i = wa0(e);
      i && (this.raceSpeed = i.speed);
    }
    ((this.openCombo = void 0), this.render());
  }
  selectSpeed(e) {
    this.options.speedLocked ||
      (e.available &&
        (this.options.onActivate(),
        (this.raceSpeed = e.speed),
        (this.openCombo = void 0),
        this.render()));
  }
  closeCombo() {
    return this.openCombo ? ((this.openCombo = void 0), this.render(), !0) : !1;
  }
  moveSelection(e) {
    if (this.openCombo === "bgm") {
      const r = ["", ...this.bgmChoices.map((a) => a.path)],
        s = r.indexOf(this.draft.mainMenuBgmPath),
        o = Math.max(0, Math.min(r.length - 1, s + e));
      ((this.draft = { ...this.draft, mainMenuBgmPath: r[o] }),
        o < this.bgmOffset
          ? (this.bgmOffset = o)
          : o >= this.bgmOffset + 8 && (this.bgmOffset = o - 7),
        this.render());
      return;
    }
    if (this.options.speedLocked) return;
    if (this.openCombo === "version") {
      const r = Qd.filter((o) => Ac(o).available);
      if (r.length === 0) return;
      const s = r.indexOf(this.raceVersion);
      this.selectVersion(r[(s + e + r.length) % r.length]);
      return;
    }
    const t = Di(this.raceVersion).filter((r) => r.available);
    if (t.length === 0) return;
    const i = t.findIndex((r) => r.speed === this.raceSpeed);
    this.raceSpeed = t[(i + e + t.length) % t.length].speed;
  }
  drawKeyEdit(e, t) {
    const i = T(e, "name"),
      r = Number(i.slice(6)),
      s = i.startsWith("modKey"),
      o = this.assets.frames.get("DefaultEdit")[0],
      a = E9(o, t);
    (this.drawFrame(o, t),
      s && this.keyFocus === r
        ? this.drawKeyCursor(a)
        : this.drawText(
            this.keyBindingLabel(r, s),
            a,
            "bold16",
            "center",
            "rgb(42,55,80)",
            "button",
          ),
      this.keyControl(i, r, s, t));
  }
  keyValue(e, t) {
    return t
      ? (this.keyChanges[e] ?? 0)
      : (this.options.initial.keyMap[e] ?? 1);
  }
  keyControl(e, t, i, r) {
    const s = `${this.keyActionLabel(t)} ${this.text(i ? "#sb(newKey)" : "#sb(currentKey)")}：${this.keyBindingLabel(t, i)}`;
    this.button(e, s, r, !i || t === 17, () => this.focusKey(t));
    const o = this.controls.get(e);
    (i && t !== 17 && (o.dataset.keyIndex = String(t)),
      [7, 17, 21, 22].includes(t) && (o.title = "当前计时赛尚未接入此功能。"));
  }
  keyActionLabel(e) {
    const t = { 0: 2, 1: 1, 2: 0, 3: 3, 20: 8, 21: 10, 22: 11 },
      i = e === 20 ? 8 : nl0(e);
    return `${this.text(`#sb(kartKey${t[i] ?? i})`)}${i !== e ? "（备用）" : ""}`;
  }
  drawKeyCursor(e) {
    this.cursorVisible &&
      ((this.context.fillStyle = "black"),
      this.context.fillRect(
        e.x + e.width / 2,
        e.y + (e.height - 12) / 2,
        2,
        12,
      ));
  }
  focusKey(e) {
    this.keyFocus !== e &&
      (clearInterval(this.cursorTimer),
      clearInterval(this.gamepadPoll),
      (this.gamepadPoll = void 0),
      (this.keyFocus = e),
      (this.cursorVisible = !0),
      e !== void 0 &&
        ((this.cursorTimer = setInterval(() => {
          ((this.cursorVisible = !this.cursorVisible), this.render());
        }, 501)),
        (this.gamepadHeld = Hg(navigator.getGamepads?.() ?? [])),
        (this.gamepadPoll = setInterval(() => this.pollGamepad(), 60))),
      this.render());
  }
  pollGamepad() {
    const e = Hg(navigator.getGamepads?.() ?? []);
    if (this.keyFocus !== void 0) {
      for (const t of e)
        if (!this.gamepadHeld.has(t)) {
          this.recordGamepad(t);
          break;
        }
    }
    this.gamepadHeld = e;
  }
  recordGamepad(e) {
    const t = this.keyFocus;
    if (!(t === void 0 || !EP(e))) {
      if (ca0(this.draft.gamepadMap, t, e)) {
        this.showKeyError("alreadyUsedKey");
        return;
      }
      ((this.draft = {
        ...this.draft,
        gamepadMap: { ...this.draft.gamepadMap, [t]: e },
      }),
        this.render());
    }
  }
  keyBindingLabel(e, t) {
    const i = SP(this.keyValue(e, t)),
      r = sa0(this.draft.gamepadMap[e]);
    return r === "" ? i : i === "" ? r : `${i} / ${r}`;
  }
  recordKey(e) {
    const t = this.keyFocus,
      i = xP(e);
    if ((this.element.focus(), !CP(i))) {
      this.showKeyError("invalidKey");
      return;
    }
    if (tl0(this.draft.keyMap, t, i)) {
      this.showKeyError("alreadyUsedKey");
      return;
    }
    ((this.keyChanges[t] = i),
      (this.draft = {
        ...this.draft,
        keyMap: { ...this.draft.keyMap, [t]: i },
      }),
      this.render());
  }
  showKeyError(e) {
    this.keyError = e;
    const t = this.text(`#sb(${e})`);
    ((this.keyErrorLines = HP(this.context, t, 408, _i)),
      this.errorElement.setAttribute("aria-description", t),
      this.render(),
      this.controls.get("okButton")?.focus());
  }
  dismissKeyError() {
    ((this.keyError = void 0), this.render(), this.element.focus());
  }
  keyMessageRect(e, t) {
    const i = V0(e, k3, t),
      r = ve(this.context, "", { family: _i, size: 16 }).height;
    return V0(e, k3, t, void 0, {
      width: i.width,
      height: i.height + (this.keyErrorLines.length - 1) * r,
    });
  }
  drawKeyErrorText(e) {
    const t = ve(this.context, "", { family: _i, size: 16 }).height,
      i = e.y + Math.max(0, (e.height - this.keyErrorLines.length * t) / 2);
    this.keyErrorLines.forEach((r, s) =>
      this.drawText(
        r,
        { ...e, y: i + s * t, height: t },
        "bold16",
        "hcenter",
        "rgb(42,55,80)",
      ),
    );
  }
  resetKeys() {
    ((this.keyChanges = Object.fromEntries(
      ut
        .filter((e) => ![18, 19].includes(e.index))
        .map((e) => [e.index, Br[e.index]]),
    )),
      (this.draft = {
        ...this.draft,
        keyMap: { ...this.draft.keyMap, ...this.keyChanges },
      }));
  }
  drawKeyScroll(e) {
    const t = this.assets.keymapScrollbar,
      i = this.keyScroll.layout(t, e, 21, 0, 630);
    Kv(
      this.context,
      t,
      this.assets.images.get(t.areaFrame.texture).image,
      i,
      this.keyScroll.buttonState,
    );
    const r = this.controls.has("keymapScroll");
    this.button("keymapScroll", "滚动键位列表", e, !1, () => {});
    const s = this.controls.get("keymapScroll");
    (s.setAttribute("aria-valuenow", String(this.keyScroll.contentOffset)),
      !r &&
        (s.setAttribute("role", "scrollbar"),
        s.setAttribute("aria-orientation", "vertical"),
        s.setAttribute("aria-valuemin", "0"),
        s.setAttribute("aria-valuemax", "102"),
        s.addEventListener("pointerdown", (o) => {
          o.button === 0 &&
            this.keyScroll.down(this.pointerPoint(o)) &&
            s.setPointerCapture(o.pointerId);
        }),
        s.addEventListener("pointermove", (o) =>
          this.keyScroll.move(this.pointerPoint(o), (o.buttons & 1) !== 0),
        ),
        s.addEventListener("pointerup", () => this.keyScroll.up()),
        s.addEventListener("pointercancel", () => this.keyScroll.up()),
        s.addEventListener("lostpointercapture", () => this.keyScroll.up()),
        s.addEventListener("pointerleave", () => this.keyScroll.leave())));
  }
  pointerPoint(e) {
    const t = this.canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - t.left) * 1600) / t.width,
      y: ((e.clientY - t.top) * 900) / t.height,
    };
  }
  drawVolume(e, t) {
    const i = T(e, "name") === "bgmVolumeScroll" ? "bgmVolume" : "fxVolume",
      { area: r, thumb: s } = cl0(t, this.draft[i]);
    this.drawFrame(this.assets.frames.get("NewHorizonScrollArea")[0], r);
    const o = this.assets.images.get("setting_gaugeBar");
    (this.context.drawImage(o.image, r.x + 1, r.y + 1, s.x - r.x, 12),
      this.drawFrame(
        this.assets.frames.get("NewHorizonScrollButton")[
          this.volumeDrag?.field === i ? 2 : 3
        ],
        s,
      ),
      this.volumeInput(i, r),
      this.volumeArrow(i, { ...t, y: t.y - 3, width: 20, height: 20 }, -1),
      this.volumeArrow(
        i,
        { ...t, x: t.x + t.width - 20, y: t.y - 3, width: 20, height: 20 },
        1,
      ));
  }
  volumeArrow(e, t, i) {
    const r = `${e}-${i}`,
      s = this.assets.frames.get(
        i < 0 ? "BulletLeftButton" : "BulletRightButton",
      )[this.state(r, !0)];
    this.drawFrame(s, t);
    const o = this.controls.has(r),
      a = () => this.stepVolume(e, i * 500);
    if (
      (this.button(
        r,
        `${i < 0 ? "降低" : "提高"}${this.volumeLabel(e)}`,
        t,
        !1,
        (l) => {
          l.detail === 0 && a();
        },
      ),
      o)
    )
      return;
    const c = this.controls.get(r);
    (c.addEventListener("pointerdown", (l) => {
      l.button === 0 &&
        (c.setPointerCapture(l.pointerId), a(), this.repeatVolume(a));
    }),
      c.addEventListener("pointerup", () => this.stopVolumePointer()),
      c.addEventListener("pointercancel", () => this.stopVolumePointer()),
      c.addEventListener("lostpointercapture", () => this.stopVolumePointer()));
  }
  volumeInput(e, t) {
    let i = this.controls.get(e);
    (i ||
      ((i = document.createElement("input")),
      (i.type = "range"),
      (i.min = "0"),
      (i.max = "4778"),
      (i.step = "any"),
      i.setAttribute("aria-label", this.volumeLabel(e)),
      i.addEventListener("input", () =>
        this.changeVolume(e, Number(i.value) / 4778),
      ),
      this.addVolumePointer(i, e),
      this.registerControl(e, i)),
      (i.value = String(this.draft[e] * 4778)),
      i.setAttribute("aria-valuetext", `${Math.round(this.draft[e] * 100)}%`),
      this.placeControl(i, { ...t, height: 20 }));
  }
  volumeLabel(e) {
    return this.text(e === "bgmVolume" ? "#sb(soundBgm)" : "#sb(soundEffect)");
  }
  addVolumePointer(e, t) {
    (e.addEventListener("pointerdown", (i) => {
      if (i.button !== 0) return;
      (i.preventDefault(), e.focus(), e.setPointerCapture(i.pointerId));
      const r = e.getBoundingClientRect(),
        s = { x: 0, y: 0, width: 182, height: 14 },
        o = ((i.clientX - r.left) * 182) / r.width,
        a = tm(this.draft[t]);
      if (o >= a && o <= a + 8)
        ((this.volumeDrag = { field: t, area: s, grab: o - a }), this.render());
      else {
        const c = o < a ? -1 : 1;
        (this.stepVolume(t, c * 222),
          this.repeatVolume(() => this.repeatTrackVolume(t, c, o)));
      }
    }),
      e.addEventListener("pointermove", (i) => {
        const r = this.volumeDrag;
        if (!r) return;
        const s = e.getBoundingClientRect(),
          o = ((i.clientX - s.left) * r.area.width) / s.width,
          a = Math.fround(
            Math.fround(5e3 * Math.fround(o - r.grab)) / r.area.width,
          );
        this.changeVolume(r.field, Math.fround(a / 4778));
      }),
      e.addEventListener("pointerup", () => this.stopVolumePointer()),
      e.addEventListener("pointercancel", () => this.stopVolumePointer()),
      e.addEventListener("lostpointercapture", () => this.stopVolumePointer()));
  }
  stepVolume(e, t) {
    this.changeVolume(
      e,
      Math.fround(Math.fround(Math.fround(this.draft[e] * 4778) + t) / 4778),
    );
  }
  repeatTrackVolume(e, t, i) {
    this.stepVolume(e, t * 500);
    const r = tm(this.draft[e]);
    return i < r || i > r + 8;
  }
  repeatVolume(e) {
    clearTimeout(this.volumeRepeat);
    const t = () => {
      e() !== !1 && (this.volumeRepeat = setTimeout(t, 77));
    };
    this.volumeRepeat = setTimeout(t, 300);
  }
  stopVolumePointer() {
    (clearTimeout(this.volumeRepeat), (this.volumeRepeat = void 0));
    const e = this.volumeDrag;
    ((this.volumeDrag = void 0), e && this.render());
  }
  toggle(e) {
    ((this.draft = { ...this.draft, [e]: !this.draft[e] }),
      this.options.onPreview(this.draft),
      this.render());
  }
  changeVolume(e, t) {
    ((this.draft = {
      ...this.draft,
      [e]: Math.fround(Math.max(0, Math.min(1, t))),
    }),
      this.options.onPreview(this.draft),
      this.render());
  }
  activate(e) {
    if (e === "okButton") {
      this.dismissKeyError();
      return;
    }
    if (e === "ok") {
      this.options.onConfirm(this.draft, this.raceSpeed, this.raceVersion);
      return;
    }
    if (e === "cancel") {
      this.options.onCancel();
      return;
    }
    (Ie.includes(e)
      ? ((this.tab = e), (this.openCombo = void 0))
      : this.applyPreset(e),
      this.render());
  }
  applyPreset(e) {
    e === "defaultSound"
      ? this.resetSound()
      : e === "defaultKeyMap"
        ? this.resetKeys()
        : e === "defaultGraphic"
          ? (this.draft = { ...this.draft, boostBlur: !1 })
          : ["poorM", "normM"].includes(e) &&
            this.applyGraphicsPreset(e === "normM");
  }
  applyGraphicsPreset(e) {
    this.draft = { ...this.draft, toonLine: e, shadow: e, boostBlur: !1 };
  }
  resetSound() {
    const {
      bgmEnabled: e,
      bgmVolume: t,
      fxEnabled: i,
      fxVolume: r,
      enableRoadSound: s,
    } = _P;
    ((this.draft = {
      ...this.draft,
      bgmEnabled: e,
      bgmVolume: t,
      fxEnabled: i,
      fxVolume: r,
      enableRoadSound: s,
    }),
      this.options.onPreview(this.draft));
  }
  button(e, t, i, r, s) {
    let o = this.controls.get(e);
    (o ||
      ((o = document.createElement("button")),
      (o.type = "button"),
      o.addEventListener("click", s),
      this.registerControl(e, o)),
      o.setAttribute("aria-label", t),
      (o.disabled = r),
      this.placeControl(o, i));
  }
  registerControl(e, t) {
    (Object.assign(t.style, {
      position: "absolute",
      opacity: "0",
      margin: "0",
      padding: "0",
      cursor: "pointer",
    }),
      t.addEventListener("pointerenter", () => {
        ((this.hovered = e), this.render());
      }),
      t.addEventListener("pointerleave", () => {
        ((this.hovered = void 0), this.render());
      }),
      t.addEventListener("pointerdown", () => {
        ((this.pressed = e), this.render());
      }),
      t.addEventListener("pointerup", () => {
        ((this.pressed = void 0), this.render());
      }),
      t.addEventListener("focus", () => {
        ((this.hovered = e), this.render());
      }),
      this.element.append(t),
      this.controls.set(e, t));
  }
  placeControl(e, t) {
    const i = this.keyViewport;
    (this.renderedControls.add(e),
      (e.hidden = !1),
      (e.inert = !!this.keyError && e !== this.controls.get("okButton")),
      Object.assign(e.style, {
        left: `${t.x / 16}%`,
        top: `${t.y / 9}%`,
        width: `${t.width / 16}%`,
        height: `${t.height / 9}%`,
        clipPath: i
          ? `inset(${(Math.max(0, i.y - t.y) / t.height) * 100}% 0 ${(Math.max(0, t.y + t.height - i.y - i.height) / t.height) * 100}% 0)`
          : "",
        pointerEvents: "auto",
      }));
  }
  state(e, t) {
    return t ? st(e, this.hovered, this.pressed) : 3;
  }
  drawFrame(e, t) {
    e.texture &&
      C9(this.context, e, this.assets.images.get(e.texture).image, t);
  }
  text(e) {
    return e.replace(
      /^#sb\(([^)]+)\)$/,
      (t, i) => this.assets.strings.get(i) ?? e,
    );
  }
  drawText(e, t, i, r, s, o = "label") {
    const a = new Set(r.split(/[,;|.\s]+/));
    m9(this.context, e, t, {
      family: _i,
      size: RT(i),
      kind: o,
      color: s,
      align: a.has("right") ? "right" : BT(a, "hcenter") ? "center" : "left",
      verticalAlign: a.has("bottom")
        ? "bottom"
        : BT(a, "vcenter")
          ? "center"
          : "top",
    });
  }
  onKeyDown = (e) => {
    (e.stopPropagation(), this.handleKeyDown(e));
  };
  handleKeyDown(e) {
    if (this.keyError) {
      this.keyErrorShortcut(e);
      return;
    }
    if (!this.comboShortcut(e)) {
      if (this.dialogShortcut(e)) {
        e.preventDefault();
        return;
      }
      if (this.keyFocus !== void 0) {
        (e.preventDefault(), this.recordKey(e.code));
        return;
      }
      (/^F\d+$/.test(e.code) && e.preventDefault(),
        e.code === "Tab" && this.moveFocus(e));
    }
  }
  comboShortcut(e) {
    if (!this.openCombo) return !1;
    const i = {
      Escape: () => {
        this.closeCombo();
      },
      Enter: () => {
        this.closeCombo();
      },
      NumpadEnter: () => {
        this.closeCombo();
      },
      ArrowDown: () => this.moveSelection(1),
      ArrowUp: () => this.moveSelection(-1),
    }[e.code];
    return i ? (e.preventDefault(), i(), this.render(), !0) : !1;
  }
  keyErrorShortcut(e) {
    (e.preventDefault(),
      ["Escape", "Enter", "NumpadEnter"].includes(e.code) &&
        this.dismissKeyError());
  }
  dialogShortcut(e) {
    const t = {
      Escape: this.options.onCancel,
      Enter: () =>
        this.options.onConfirm(this.draft, this.raceSpeed, this.raceVersion),
      NumpadEnter: () =>
        this.options.onConfirm(this.draft, this.raceSpeed, this.raceVersion),
    };
    if (t[e.code]) return (t[e.code](), !0);
    const i = BP[e.code];
    return i
      ? (this.toggle(i), !0)
      : ["F9", "F10", "F11"].includes(e.code) ||
          (e.code === "KeyP" && e.ctrlKey);
  }
  moveFocus(e) {
    const t = [...this.controls.values()].filter(
        (r) => !r.hidden && !r.disabled,
      ),
      i = t.indexOf(document.activeElement);
    (e.preventDefault(),
      t[(i + (e.shiftKey ? -1 : 1) + t.length) % t.length]?.focus());
  }
}
function tl0(n, e, t) {
  return ut.some(
    (i) => i.index !== e && ![18, 19].includes(i.index) && n[i.index] === t,
  );
}
function BT(n, e) {
  return n.has("center") || n.has(e);
}
function nl0(n) {
  return n >= 10 && n <= 17 ? n - 10 : n;
}
function il0(n) {
  return (
    n.name === "Skip" ||
    ["disabled", "cancelButton", "errorButton"].includes(T(n, "name") ?? "")
  );
}
function rl0(n) {
  return T(n, "textAlign") ?? "center";
}
function RT(n) {
  return Number(/\d+$/.exec(n)?.[0] ?? 16);
}
function sl0(n, e, t, i) {
  const r = V0(n, e, t, void 0, i),
    s = Ie.indexOf(T(n, "name") ?? "");
  return s < 0 ? r : { ...r, x: r.x + s * r.width };
}
function IT(n) {
  if (!n.includes(" ")) return n;
  const [e, t, i, r] = n.split(/\s+/).map(Number);
  return `rgba(${t},${i},${r},${e / 255})`;
}
function ol0(n) {
  return [
    "dispIngameStressMirror",
    "itemStateNotice",
    "itemStateTotalNotice",
    "dispIngameName",
    "dispIngameItemInfoCard",
    "dispIngameTeamColor",
  ].includes(n);
}
function al0(n) {
  return n.boostBlur || n.toonLine !== n.shadow
    ? "userMachine"
    : n.toonLine
      ? "normMachine"
      : "poorMachine";
}
function tm(n) {
  return Math.trunc(
    Math.fround(Math.fround(182 * Math.fround(n * 4778)) / 5e3),
  );
}
function cl0(n, e) {
  const t = { ...n, x: n.x + 20, width: 182 };
  return {
    area: t,
    thumb: { x: t.x + tm(e), y: n.y - 3, width: 8, height: 20 },
  };
}
