// Generated from the verified KartSim v39.11 release bundle.
// Rebuild with: node tools/generate-modules.mjs
// Stable minified names are retained for behavioral parity.

import { keyboardActionsForCode } from "../input/action-bindings.ts";
import { isEditableTarget } from "../input/gameplay-input-queue.ts";
import { GameplayInputQueue } from "../input/gameplay-input-queue.ts";
import { GamepadEdgePoller } from "../input/gamepad-edges.ts";
import { AutoForwardAssist as Xl0 } from "../input/auto-forward.ts";
import { NitroSeamlessQueue as Zl0 } from "../input/nitro-seamless.ts";
import { RaceStartCoordinator } from "../multiplayer/race-start-coordinator.ts";
import { LobbyAvatarCache, lobbyAvatarKey } from "../multiplayer/lobby-avatar-cache.ts";
import { animateLobbyRoom, canAnimateLobbyRoom, isLobbyCountdownLocked, lobbyCountdownState, sendLobbyChat as sendLobbyRoomChat, sendLobbyEmotion, setLobbyStartPresentation, updateLobbyCountdown } from "../multiplayer/lobby-room-timing.ts";
import { initializeLobbyRace } from "../multiplayer/lobby-race-loader.ts";
import { RoomState as Ul0 } from "../multiplayer/room-state.ts";
import { formatMultiplayerError as C1 } from "../multiplayer/errors.ts";
import { joinLobbyRoom, leaveLobbyRoom, listLobbyRooms, mutateLobbyRoom, quickJoinLobbyRoom, sendLobbyChat, submitLobbyRoomSettings, switchLobbyTeam } from "../multiplayer/lobby-actions.ts";
import { receiveLobbyEvent } from "../multiplayer/lobby-events.ts";
import { bindLobbyClient, disposeLobby, handleRoomShortcut, lobbyNetworkDiagnostics, maybeAutoReadyInRoom, quickJoinShortcut, refreshLobbyAutoReady, renderLobby } from "../multiplayer/lobby-lifecycle.ts";
import { cancelLobbyDialog, castLobbyKickVote, confirmLeaveLobbyRoom, lobbyDialogOptions, openLobbyDialog, syncKickVoteDialog } from "../multiplayer/lobby-dialogs.ts";
import { openMultiplayerLobby } from "../multiplayer/lobby-open.ts";
import { syncRaceLoadingView } from "../multiplayer/lobby-loading.ts";
import { showLobbyRoom } from "../multiplayer/lobby-room-view.ts";
import { changeLobbyRoomInfo, confirmLobbyAction, createLobbyRoom } from "../multiplayer/lobby-settings.ts";
import { cancelCountdownModals, endChangingModal, finishChangingLoad, isChangingModalCurrent, releaseChanging } from "../multiplayer/lobby-changing.ts";
import { chooseLobbyGarage, confirmLobbyGarage } from "../multiplayer/lobby-garage.ts";
import { chooseLobbyTrack, confirmLobbyTrack } from "../multiplayer/lobby-track.ts";
import { PeerMesh as pl0 } from "../multiplayer/peer-mesh.ts";
import { MotionRoundTripTracker as gl0 } from "../multiplayer/network-timing.ts";
import { bindRaceScope, createRaceConnection } from "../multiplayer/race-session.ts";
import { acceptGameMotion, acceptServerMotion, captureNetworkClock, networkDiagnostics as getNetworkDiagnostics, sendGameMotion, subscribeGameMotion } from "../multiplayer/client-motion.ts";
import { disposeClient, onClientClose, sameOriginOfferUrl, sendControlRequest, subscribeControl } from "../multiplayer/client-control.ts";
import { connectGameClient } from "../multiplayer/client-connect.ts";
import { configuredTransport } from "../multiplayer/local-config.ts";
import { acquireReadyToonEnvironment, enterTimeAttackReady, openTrackSelect, readyStageContext, resolveRandomSelection, selectReadyChoice, selectReadyTrack, startRaceFromReady } from "../timeattack/ready-flow.ts";
import { changeReadyFavoriteItems, changeReadyFavoriteTrack, closeReadyMultiplayer, disposeReadyController, getReadyWindowNotice, isReadyModalBusy, readyNetworkDiagnostics, refreshReadyRecord, releaseReadyForRace, renderReadyController, returnMultiplayerToSinglePlayer, setReadyWindowNotice, updateReadyWindowNotice } from "../timeattack/ready-controller-state.ts";
import { applyReadyMultiplayerGarage, openReadyMultiplayer, readyMultiplayerGarageOptions } from "../timeattack/ready-multiplayer.ts";
import { applyImmediateReadyGarageSelection, openReadyGarage, openReadyGarageX, returnReadyGarage, selectReadyGarage, showReadyGarageError } from "../timeattack/ready-garage.ts";
import { closeReadySettings, confirmReadySettings, handleReadyShortcut, openReadySettings, previewReadySettings, publishReadyRaceSpeed, releaseReadyToonEnvironment, saveReadyGameOptions, showReadyTrackSelectError } from "../timeattack/ready-settings.ts";
import { B2, El, I4, Z9, kl, qe } from "./vendor.js";
import { G2, H6, He, LR, T, W1, We, b4, f4, fa, ha, j0, lw, m9, oR, on, p2, rn, tt, we, x1, xX, y9 } from "./formats.js";
import { Aa, BI, C8, Cw, DI, Ew, F9, MI, Ma, Nw, Q9, RI, S9, Tr, U1, X6, Yc, Zl, _w, ba, h2, rg, t6, t7, te, wI, wa, x4, ya, zw } from "./library.js";
import { Bt, L40, No, S40, Y3, d6 } from "./vehicle.js";
import { $v, Br, E4, Ga, Hg, IP, NP, Ng, Ue, Uo, cP, nT, ua0, ut, xP, y6, yP, ze, zo0 } from "./world.js";
import { C7, Js, Jv, Lt, Qv, T4, Tc0, _7, ds, ey, oy, ry, ty, w80 } from "./ui.js";

const readyGarageDependencies = {
  loadGarage: options => C7.load(options),
  loadGarageX: async options => {
    const { GarageXView } = await El(async () => {
      const { GarageXView } = await import("./GarageXView-DSeU5AUN.js");
      return { GarageXView };
    }, []);
    return GarageXView.load(options);
  },
  createNotice: root => new ds(root),
  speed: y6,
  defaultVersion: ze,
};
const readySettingsDependencies = {
  loadSettings: options => oy.load(options),
  speedLabel: Ue,
  chooseSpeed: $v,
  defaultSpeed: E4,
  defaultVersion: ze,
  persistGameOptions: ua0,
};
const lobbyRoomTimingDependencies = { nowMs: () => performance.now(), requestFrame: callback => requestAnimationFrame(callback), cancelFrame: frameId => cancelAnimationFrame(frameId), toLocalStartAt: Y3 };

class ll0 extends RaceStartCoordinator {
  constructor(options) {
    super(options, {
      gameplay: G2,
      sameRoadblock: oR,
      sameLte: Nw,
      sameRp: t7,
      toLocalStartTick: Y3,
    });
  }
}

const hl0 = new Set([
    "turn:turn.cloudflare.com:3478?transport=udp",
    "turn:turn.cloudflare.com:3478?transport=tcp",
    "turn:turn.cloudflare.com:443?transport=udp",
    "turn:turn.cloudflare.com:80?transport=tcp",
    "turns:turn.cloudflare.com:5349?transport=tcp",
    "turns:turn.cloudflare.com:443?transport=tcp",
  ]);





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
    raceConnection(roomId, raceId, signal) { return createRaceConnection(this, roomId, raceId, signal); }
    bindMotionScope(room) { return bindRaceScope(this, room); }
    acceptMotion(data) { return acceptServerMotion(this, data); }
    acceptMotionMessage(message, fromServer = false) { return acceptGameMotion(this, message, fromServer); }
    sendMotion(sample, mask) { return sendGameMotion(this, sample, mask); }
    networkDiagnostics() { return getNetworkDiagnostics(this); }
    subscribeMotion(listener) { return subscribeGameMotion(this, listener); }
  clock = new L40();
    captureClock() { return captureNetworkClock(this); }
  pending = new Map();
  listeners = new Set();
  closeListeners = new Set();
    static sameOriginUrl(pageUrl) { return sameOriginOfferUrl(pageUrl); }
    async connect(offerUrl, name, resourceVersion, equipment, initial, raceRuntime = false, token) { return connectGameClient(this, offerUrl, name, resourceVersion, equipment, initial, raceRuntime, token, { validateControlMessage: zo0, transport: configuredTransport() }); }
    request(message) { return sendControlRequest(this, message); }
    subscribe(listener) { return subscribeControl(this, listener); }
    onClose(listener) { return onClientClose(this, listener); }
    dispose() { return disposeClient(this); }
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



class El0 extends LobbyAvatarCache { constructor(build, release, changed, failed) { super(build, release, changed, failed, t6); } }

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
    setStartPresentation(enabled) { return setLobbyStartPresentation(this, enabled, lobbyRoomTimingDependencies); }
    roomCanAnimate() { return canAnimateLobbyRoom(this); }
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
    updateCountdown(room) { return updateLobbyCountdown(this, room, lobbyRoomTimingDependencies); }
    countdownState() { return lobbyCountdownState(this, lobbyRoomTimingDependencies); }
    get countdownLocked() { return isLobbyCountdownLocked(this); }
    async sendEmotion(emotion) { return sendLobbyEmotion(this, emotion); }
    animate() { return animateLobbyRoom(this, lobbyRoomTimingDependencies); }
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
    async sendChat() { return sendLobbyRoomChat(this); }
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
    constructor(options) {
    this.options = options;
    initializeLobbyRace(this, {
      createCoordinator: value => new ll0(value),
      preloadRpPet: Nl0,
      loadRoadblock: (library, root, race, playerId) => yy.load(library, root, race, playerId),
      loadRpNotice: (library, root, race, playerId, audio) => vy.load(library, root, race, playerId, audio),
    });
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
    networkDiagnostics() { return lobbyNetworkDiagnostics(this); }
    quickJoinShortcut() { return quickJoinShortcut(this); }
    handleRoomShortcut(event) { return handleRoomShortcut(this, event); }
    refreshAutoReady() { return refreshLobbyAutoReady(this); }
    async open() { return openMultiplayerLobby(this, {
    protocolVersion: Uo,
    pageUrl: () => window.location.href,
    endpoint: Ko,
    fetchHealth: (url, signal) => fetch(url, { cache: "no-store", signal }),
    showAccountProgress: vl0,
    loadAccount: yl0,
    chooseNickname: PT,
    loadLobby: options => Ew.load(options),
    notice: (options, title, message) => b1.notice(options, title, message),
    sessionToken: url => xF(ay(url)),
    rememberNickname: EF,
    createClient: () => new LT(),
  }); }
    bindClient() { return bindLobbyClient(this); }
    dispose() { return disposeLobby(this); }
    render() { return renderLobby(this); }
    syncLoadingView() { return syncRaceLoadingView(this, (library, root) => gy.load(library, root)); }
    maybeAutoReady() { return maybeAutoReadyInRoom(this); }
    receive(event) { return receiveLobbyEvent(this, event, RI); }
    async showRoom() { return showLobbyRoom(this, (library, root, room, playerId, callbacks, audioContext) => py.load(library, root, room, playerId, callbacks, audioContext)); }
    async list(channel, page, quiet = false, gameplay = this.gameplay) { return listLobbyRooms(this, channel, page, quiet, gameplay); }
    async leaveRoom(reason) { return leaveLobbyRoom(this, reason); }
    async mutate(command) { return mutateLobbyRoom(this, command, (options, title, message) => b1.notice(options, title, message)); }
    cancelDialog(releaseAllowed = true) { return cancelLobbyDialog(this, releaseAllowed); }
    async confirmLeaveRoom(roomId) { return confirmLeaveLobbyRoom(this, roomId, (options, title, message, onConfirm, labels) => b1.confirm(options, title, message, onConfirm, labels)); }
    async openDialog(factory, allowDisconnected = false) { return openLobbyDialog(this, factory, allowDisconnected); }
    dialogOptions() { return lobbyDialogOptions(this); }
    syncKickVoteDialog() { return syncKickVoteDialog(this, (options, title, message, onConfirm, labels) => b1.confirm(options, title, message, onConfirm, labels)); }
    castKickVote(approve) { return castLobbyKickVote(this, approve); }
    async sendChat(message) { return sendLobbyChat(this, message); }
    isChangingModalCurrent(modal) { return isChangingModalCurrent(this, modal); }
    endChangingModal(modal, releaseAllowed = true) { return endChangingModal(this, modal, releaseAllowed); }
    cancelCountdownModals() { return cancelCountdownModals(this); }
    finishChangingLoad(modal, loaded) { return finishChangingLoad(this, modal, loaded); }
    async releaseChanging(roomId) { return releaseChanging(this, roomId); }
    async chooseGarage() { return chooseLobbyGarage(this,
    async options => {
      const { TimeAttackGarageView } = await El(async () => {
        const { TimeAttackGarageView } = await Promise.resolve().then(() => w80);
        return { TimeAttackGarageView };
      }, undefined);
      return TimeAttackGarageView.load(options);
    }, (profile, choice) => zw({ ...profile, equipment: choice.equipment })); }
    async confirmGarage(choice, roomId, modal) { return confirmLobbyGarage(this, choice, roomId, modal); }
    async chooseTrack() { return chooseLobbyTrack(this, { gameplay: G2, isGiantTrack: Zl, randomRules: Yc, loadView: options => _7.load(options) }); }
    async confirmTrack(modal, choice) { return confirmLobbyTrack(this, modal, choice, Yc); }
    async changeRoomInfo() { return changeLobbyRoomInfo(this, (options, mode, settings, submit) => b1.roomSettings(options, mode, settings, submit)); }
    async submitRoomSettings(settings, generation) { return submitLobbyRoomSettings(this, settings, generation); }
    async create() { return createLobbyRoom(this, He,
    (options, gameplay, channel, nickname, submit) => gameplay === "ordinary"
      ? b1.createOrdinary(options, channel, nickname, submit)
      : b1.createGameplay(options, gameplay, channel, nickname, submit)); }
    async join(room) { return joinLobbyRoom(this, room, (host, submit) => host.openDialog(() => b1.password(host.dialogOptions(), submit))); }
    async quickJoin() { return quickJoinLobbyRoom(this); }
    async team() { return switchLobbyTeam(this); }
    async confirm(title, message, action) { return confirmLobbyAction(this, title, message, action, (options, heading, body, accept) => b1.confirm(options, heading, body, accept)); }
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
    dispose() { return disposeReadyController(this); }
    updateWindowNotice(value) { return updateReadyWindowNotice(this, value); }
    getWindowNotice() { return getReadyWindowNotice(this); }
    setWindowNotice(value) { return setReadyWindowNotice(this, value); }
    renderReady(state) { return renderReadyController(this, state); }
    refreshRecord() { return refreshReadyRecord(this); }
    releaseForRace() { return releaseReadyForRace(this); }
    readyModalBusy() { return isReadyModalBusy(this); }
    async enterTimeAttackReady(profile = this.host.getProfile()) { return enterTimeAttackReady(this, profile, { findKart: b4, loadTaskbar: options => ry.load(options), loadReadyView: options => ty.load(options) }); }
    async startRaceFromReady(selection, options) { return startRaceFromReady(this, selection, options); }
    async openMultiplayer() { return openReadyMultiplayer(this, {
    sanitizeReadyOptions: Hl0,
    nickname: im,
    version: Bt,
    initialEquipment: zw,
    favoriteTrackIds: nT,
    createNotice: root => new ds(root),
    createLobby: options => new Wl0(options),
  }); }
    async multiplayerGarageOptions() { return readyMultiplayerGarageOptions(this, root => new ds(root)); }
    applyMultiplayerGarage(choice) { return applyReadyMultiplayerGarage(this, choice); }
    async returnMultiplayerToSinglePlayer() { return returnMultiplayerToSinglePlayer(this); }
    networkDiagnostics() { return readyNetworkDiagnostics(this); }
    closeMultiplayer(openReady = true, restoreReady = true) { return closeReadyMultiplayer(this, openReady, restoreReady); }
    readyStageContext() { return readyStageContext(this); }
    async acquireReadyToonEnvironment(library) { return acquireReadyToonEnvironment(this, library, value => rn.load(value)); }
    async openTrackSelect(selection, options) { return openTrackSelect(this, selection, options, { loadTrackSelect: value => _7.load(value), favoriteTrackIds: nT, createWindowNotice: root => new ds(root) }); }
    selectReadyTrack(selection, options, track) { return selectReadyTrack(this, selection, options, track); }
    selectReadyChoice(selection, options, choice, catalog) { return selectReadyChoice(this, selection, options, choice, catalog, LR); }
    async resolveRandomSelection(selection) { return resolveRandomSelection(this, selection); }
    changeFavoriteTrack(track, favorite) { return changeReadyFavoriteTrack(this, track, favorite, IP); }
    changeFavoriteItems(items) { return changeReadyFavoriteItems(this, items); }
    async openGarage(selection, options) { return openReadyGarage(this, selection, options, readyGarageDependencies); }
    async selectReadyGarage(selection, options, choice) { return selectReadyGarage(this, selection, options, choice); }
    async openGarageX(selection, options) { return openReadyGarageX(this, selection, options, readyGarageDependencies); }
    returnGarageToReady() { return returnReadyGarage(this); }
    applyImmediateGarageSelection(selection, options, choice) { return applyImmediateReadyGarageSelection(this, selection, options, choice); }
    showGarageError(error) { return showReadyGarageError(this, error); }
    async openSettings() { return openReadySettings(this, readySettingsDependencies); }
    previewSettings(options) { return previewReadySettings(this, options); }
    confirmSettings(options, speed, version) { return confirmReadySettings(this, options, speed, version, readySettingsDependencies); }
    publishRaceSpeedChannel() { return publishReadyRaceSpeed(this, readySettingsDependencies); }
    saveGameOptions() { return saveReadyGameOptions(this, ua0); }
    closeSettings() { return closeReadySettings(this); }
    showTrackSelectError(error) { return showReadyTrackSelectError(this, error); }
    handleReadyShortcut(event) { return handleReadyShortcut(this, event); }
    releaseReadyToonEnvironment() { return releaseReadyToonEnvironment(this); }
}

function xl(code, keyMap = Br) { return keyboardActionsForCode(code, keyMap, ut); }



class jl0 extends GameplayInputQueue {
  constructor() { super({ keyMap: Br, resolveActions: xl, editableTarget: yf }); }
}

function yf(target) { return isEditableTarget(target); }



class Ql0 extends GamepadEdgePoller {
  constructor() { super({ pressedControls: Hg, bindings: ut, unmappedControl: Ga }); }
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

export { EF, Jl0, LT, Ne, Ql0, Un, Wl0, Xl0, Zl0, bl0, e60, gl0, im, jl0, pl0, ql0, t60, xl };
