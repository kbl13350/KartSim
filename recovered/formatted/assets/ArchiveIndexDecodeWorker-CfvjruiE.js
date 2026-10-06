(function () {
  "use strict";
  var u = Uint8Array,
    E = Uint16Array,
    hr = Int32Array,
    Y = new u([
      0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5,
      5, 5, 5, 0, 0, 0, 0,
    ]),
    G = new u([
      0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10,
      11, 11, 12, 12, 13, 13, 0, 0,
    ]),
    wr = new u([
      16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15,
    ]),
    Q = function (r, e) {
      for (var n = new E(31), o = 0; o < 31; ++o) n[o] = e += 1 << r[o - 1];
      for (var a = new hr(n[30]), o = 1; o < 30; ++o)
        for (var s = n[o]; s < n[o + 1]; ++s) a[s] = ((s - n[o]) << 5) | o;
      return { b: n, r: a };
    },
    W = Q(Y, 2),
    Z = W.b,
    yr = W.r;
  ((Z[28] = 258), (yr[258] = 28));
  for (var pr = Q(G, 0), gr = pr.b, D = new E(32768), t = 0; t < 32768; ++t) {
    var g = ((t & 43690) >> 1) | ((t & 21845) << 1);
    ((g = ((g & 52428) >> 2) | ((g & 13107) << 2)),
      (g = ((g & 61680) >> 4) | ((g & 3855) << 4)),
      (D[t] = (((g & 65280) >> 8) | ((g & 255) << 8)) >> 1));
  }
  for (
    var x = function (r, e, n) {
        for (var o = r.length, a = 0, s = new E(e); a < o; ++a)
          r[a] && ++s[r[a] - 1];
        var v = new E(e);
        for (a = 1; a < e; ++a) v[a] = (v[a - 1] + s[a - 1]) << 1;
        var c;
        if (n) {
          c = new E(1 << e);
          var p = 15 - e;
          for (a = 0; a < o; ++a)
            if (r[a])
              for (
                var m = (a << 4) | r[a],
                  A = e - r[a],
                  i = v[r[a] - 1]++ << A,
                  f = i | ((1 << A) - 1);
                i <= f;
                ++i
              )
                c[D[i] >> p] = m;
        } else
          for (c = new E(o), a = 0; a < o; ++a)
            r[a] && (c[a] = D[v[r[a] - 1]++] >> (15 - r[a]));
        return c;
      },
      F = new u(288),
      t = 0;
    t < 144;
    ++t
  )
    F[t] = 8;
  for (var t = 144; t < 256; ++t) F[t] = 9;
  for (var t = 256; t < 280; ++t) F[t] = 7;
  for (var t = 280; t < 288; ++t) F[t] = 8;
  for (var L = new u(32), t = 0; t < 32; ++t) L[t] = 5;
  var Ar = x(F, 9, 1),
    br = x(L, 5, 1),
    I = function (r) {
      for (var e = r[0], n = 1; n < r.length; ++n) r[n] > e && (e = r[n]);
      return e;
    },
    w = function (r, e, n) {
      var o = (e / 8) | 0;
      return ((r[o] | (r[o + 1] << 8)) >> (e & 7)) & n;
    },
    M = function (r, e) {
      var n = (e / 8) | 0;
      return (r[n] | (r[n + 1] << 8) | (r[n + 2] << 16)) >> (e & 7);
    },
    mr = function (r) {
      return ((r + 7) / 8) | 0;
    },
    rr = function (r, e, n) {
      return (
        (e == null || e < 0) && (e = 0),
        (n == null || n > r.length) && (n = r.length),
        new u(r.subarray(e, n))
      );
    },
    Sr = [
      "unexpected EOF",
      "invalid block type",
      "invalid length/literal",
      "invalid distance",
      "stream finished",
      "no stream handler",
      ,
      "no callback",
      "invalid UTF-8 data",
      "extra field too long",
      "date not in range 1980-2099",
      "filename too long",
      "stream finishing",
      "invalid zip data",
    ],
    l = function (r, e, n) {
      var o = new Error(e || Sr[r]);
      if (
        ((o.code = r),
        Error.captureStackTrace && Error.captureStackTrace(o, l),
        !n)
      )
        throw o;
      return o;
    },
    Er = function (r, e, n, o) {
      var a = r.length,
        s = 0;
      if (!a || (e.f && !e.l)) return n || new u(0);
      var v = !n,
        c = v || e.i != 2,
        p = e.i;
      v && (n = new u(a * 3));
      var m = function (cr) {
          var ur = n.length;
          if (cr > ur) {
            var lr = new u(Math.max(ur * 2, cr));
            (lr.set(n), (n = lr));
          }
        },
        A = e.f || 0,
        i = e.p || 0,
        f = e.b || 0,
        S = e.l,
        O = e.d,
        N = e.m,
        U = e.n,
        R = a * 8;
      do {
        if (!S) {
          A = w(r, i, 1);
          var B = w(r, i + 1, 3);
          if (((i += 3), B))
            if (B == 1) ((S = Ar), (O = br), (N = 9), (U = 5));
            else if (B == 2) {
              var J = w(r, i, 31) + 257,
                nr = w(r, i + 10, 15) + 4,
                ar = J + w(r, i + 5, 31) + 1;
              i += 14;
              for (var d = new u(ar), j = new u(19), h = 0; h < nr; ++h)
                j[wr[h]] = w(r, i + h * 3, 7);
              i += nr * 3;
              for (
                var or = I(j), Rr = (1 << or) - 1, Br = x(j, or, 1), h = 0;
                h < ar;
              ) {
                var ir = Br[w(r, i, Rr)];
                i += ir & 15;
                var y = ir >> 4;
                if (y < 16) d[h++] = y;
                else {
                  var C = 0,
                    z = 0;
                  for (
                    y == 16
                      ? ((z = 3 + w(r, i, 3)), (i += 2), (C = d[h - 1]))
                      : y == 17
                        ? ((z = 3 + w(r, i, 7)), (i += 3))
                        : y == 18 && ((z = 11 + w(r, i, 127)), (i += 7));
                    z--;
                  )
                    d[h++] = C;
                }
              }
              var tr = d.subarray(0, J),
                b = d.subarray(J);
              ((N = I(tr)), (U = I(b)), (S = x(tr, N, 1)), (O = x(b, U, 1)));
            } else l(1);
          else {
            var y = mr(i) + 4,
              H = r[y - 4] | (r[y - 3] << 8),
              V = y + H;
            if (V > a) {
              p && l(0);
              break;
            }
            (c && m(f + H),
              n.set(r.subarray(y, V), f),
              (e.b = f += H),
              (e.p = i = V * 8),
              (e.f = A));
            continue;
          }
          if (i > R) {
            p && l(0);
            break;
          }
        }
        c && m(f + 131072);
        for (var Hr = (1 << N) - 1, Vr = (1 << U) - 1, q = i; ; q = i) {
          var C = S[M(r, i) & Hr],
            k = C >> 4;
          if (((i += C & 15), i > R)) {
            p && l(0);
            break;
          }
          if ((C || l(2), k < 256)) n[f++] = k;
          else if (k == 256) {
            ((q = i), (S = null));
            break;
          } else {
            var fr = k - 254;
            if (k > 264) {
              var h = k - 257,
                T = Y[h];
              ((fr = w(r, i, (1 << T) - 1) + Z[h]), (i += T));
            }
            var K = O[M(r, i) & Vr],
              X = K >> 4;
            (K || l(3), (i += K & 15));
            var b = gr[X];
            if (X > 3) {
              var T = G[X];
              ((b += M(r, i) & ((1 << T) - 1)), (i += T));
            }
            if (i > R) {
              p && l(0);
              break;
            }
            c && m(f + 131072);
            var vr = f + fr;
            if (f < b) {
              var sr = s - b,
                Jr = Math.min(b, vr);
              for (sr + f < 0 && l(3); f < Jr; ++f) n[f] = o[sr + f];
            }
            for (; f < vr; ++f) n[f] = n[f - b];
          }
        }
        ((e.l = S),
          (e.p = q),
          (e.b = f),
          (e.f = A),
          S && ((A = 1), (e.m = N), (e.d = O), (e.n = U)));
      } while (!A);
      return f != n.length && v ? rr(n, 0, f) : n.subarray(0, f);
    },
    Cr = new u(0),
    kr = function (r, e) {
      return (
        ((r[0] & 15) != 8 || r[0] >> 4 > 7 || ((r[0] << 8) | r[1]) % 31) &&
          l(6, "invalid zlib data"),
        ((r[1] >> 5) & 1) == 1 &&
          l(
            6,
            "invalid zlib data: " +
              (r[1] & 32 ? "need" : "unexpected") +
              " dictionary",
          ),
        ((r[1] >> 3) & 4) + 2
      );
    };
  function xr(r, e) {
    return Er(r.subarray(kr(r), -4), { i: 2 }, e, e);
  }
  var _ = typeof TextDecoder < "u" && new TextDecoder(),
    Fr = 0;
  try {
    (_.decode(Cr, { stream: !0 }), (Fr = 1));
  } catch {}
  var Nr = function (r) {
    for (var e = "", n = 0; ;) {
      var o = r[n++],
        a = (o > 127) + (o > 223) + (o > 239);
      if (n + a > r.length) return { s: e, r: rr(r, n - 1) };
      a
        ? a == 3
          ? ((o =
              (((o & 15) << 18) |
                ((r[n++] & 63) << 12) |
                ((r[n++] & 63) << 6) |
                (r[n++] & 63)) -
              65536),
            (e += String.fromCharCode(55296 | (o >> 10), 56320 | (o & 1023))))
          : a & 1
            ? (e += String.fromCharCode(((o & 31) << 6) | (r[n++] & 63)))
            : (e += String.fromCharCode(
                ((o & 15) << 12) | ((r[n++] & 63) << 6) | (r[n++] & 63),
              ))
        : (e += String.fromCharCode(o));
    }
  };
  function Ur(r, e) {
    var n;
    if (_) return _.decode(r);
    var o = Nr(r),
      a = o.s,
      n = o.r;
    return (n.length && l(8), a);
  }
  function dr(r, e, n, o) {
    const a = JSON.parse(Ur(xr(r)), (s, v) => {
      if (!er(v) || typeof v.$u8 != "string") return v;
      const c = atob(v.$u8),
        p = Uint8Array.from(c, (m) => m.charCodeAt(0));
      return (o?.push(p.buffer), p);
    });
    if (
      !er(a) ||
      (a.version !== "p3528" &&
        a.version !== "p3543" &&
        a.version !== "p3553") ||
      typeof a.revision != "string" ||
      !/^[a-f0-9]{64}$/i.test(a.revision)
    )
      throw new Error("档案索引格式无效。");
    if (!Array.isArray(a.rho) || !Array.isArray(a.rho5))
      throw new Error("档案索引内容无效。");
    if (a.version !== e || a.revision !== n)
      throw new Error(
        `${e.toUpperCase()} 档案索引与资源清单版本/修订号不匹配。`,
      );
    return { rho: a.rho, rho5: a.rho5 };
  }
  function er(r) {
    return typeof r == "object" && r !== null;
  }
  function Tr(r, e) {
    return `${r}-${e}`;
  }
  function $r(r, e) {
    return `${Tr(r, e)}-archive-index`;
  }
  const Or = 1,
    $ = "snapshots",
    zr = "current",
    Dr = 2;
  async function Ir(r, e, n) {
    const o = await Mr(r, e, n),
      a = await _r(r, e);
    try {
      const s = a.transaction($, "readwrite"),
        v = Pr(s);
      (s
        .objectStore($)
        .put({
          key: zr,
          schemaVersion: Dr,
          version: r,
          revision: e,
          checksum: o,
          rho: n.rho,
          rho5: n.rho5,
        }),
        await v);
    } finally {
      a.close();
    }
  }
  async function Mr(r, e, n) {
    const o = JSON.stringify(
        { version: r, revision: e, rho: n.rho, rho5: n.rho5 },
        (v, c) => (c instanceof Uint8Array ? { $u8: Array.from(c) } : c),
      ),
      a = new TextEncoder().encode(o),
      s = new Uint8Array(await crypto.subtle.digest("SHA-256", a));
    return Array.from(s, (v) => v.toString(16).padStart(2, "0")).join("");
  }
  function _r(r, e) {
    return new Promise((n, o) => {
      const a = indexedDB.open($r(r, e), Or);
      ((a.onupgradeneeded = () => {
        a.result.objectStoreNames.contains($) ||
          a.result.createObjectStore($, { keyPath: "key" });
      }),
        (a.onsuccess = () => n(a.result)),
        (a.onerror = () =>
          o(
            a.error ?? new Error(`${r.toUpperCase()} 档案索引数据库打开失败。`),
          )));
    });
  }
  function Pr(r) {
    return new Promise((e, n) => {
      ((r.oncomplete = () => e()),
        (r.onerror = () => n(r.error ?? new Error("P3528 档案索引事务失败。"))),
        (r.onabort = () =>
          n(r.error ?? new Error("P3528 档案索引事务已中止。"))));
    });
  }
  const P = self;
  P.onmessage = async ({ data: r }) => {
    try {
      const e = [],
        n = dr(new Uint8Array(r.compressed), r.version, r.revision, e);
      try {
        await Ir(r.version, r.revision, n);
      } catch {}
      P.postMessage({ ok: !0, indexes: n }, e);
    } catch (e) {
      P.postMessage({
        ok: !1,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  };
})();
