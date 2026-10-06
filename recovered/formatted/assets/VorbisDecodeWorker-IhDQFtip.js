(function () {
  "use strict";
  var w = "/assets/motor-vorbis-B0OpSz3w.wasm";
  let f;
  function d() {
    return (
      (f ??= (async () => {
        const r = await fetch(w);
        if (!r.ok) throw new Error(`Motor Vorbis decoder HTTP ${r.status}`);
        return WebAssembly.compile(await r.arrayBuffer());
      })().catch((r) => {
        throw ((f = void 0), r);
      })),
      f
    );
  }
  async function p(r, o) {
    const i = await d();
    let e;
    ((e = new WebAssembly.Instance(i, {
      wasi_snapshot_preview1: {
        fd_prestat_get: () => 8,
        fd_prestat_dir_name: () => 8,
        proc_exit: (t) => {
          throw new Error(`Motor Vorbis decoder exited: ${t}`);
        },
        random_get: (t, c) => (
          crypto.getRandomValues(new Uint8Array(e.memory.buffer, t, c)),
          0
        ),
      },
    }).exports),
      e._initialize());
    const a = e.malloc(r.byteLength);
    if (!a) throw new Error("Motor Vorbis input allocation failed");
    let n = 0;
    try {
      if (
        (new Uint8Array(e.memory.buffer, a, r.byteLength).set(r),
        (n = e.decode(a, r.byteLength)),
        !n)
      )
        throw new Error("Motor Vorbis resource is invalid or incomplete");
      const t = new DataView(e.memory.buffer, n, 16),
        c = t.getUint32(0, !0),
        l = t.getUint32(4, !0),
        s = t.getUint32(8, !0),
        y = t.getUint32(12, !0),
        h = new DataView(e.memory.buffer, c, l * s * 2);
      return o(h, s, l, y);
    } finally {
      (n && e.release(n), e.free(a));
    }
  }
  const m = globalThis;
  m.onmessage = async ({ data: r }) => {
    try {
      const o = await p(r.bytes, (i, e, u, a) => {
        const n = Array.from({ length: e }, (t, c) => {
          const l = new Float32Array(u);
          for (let s = 0; s < u; s++)
            l[s] = i.getInt16((s * e + c) * 2, !0) / 32768;
          return l;
        });
        return { ok: !0, frames: u, sampleRate: a, channels: n };
      });
      m.postMessage(
        o,
        o.channels.map((i) => i.buffer),
      );
    } catch (o) {
      m.postMessage({
        ok: !1,
        error: o instanceof Error ? o.message : String(o),
      });
    }
  };
})();
