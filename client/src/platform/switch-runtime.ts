/**
 * Startup of the Nintendo Switch build (imported first by main.ts). In a
 * browser it only redirects packaged paths and loads the server address, so
 * the package can be tried on a desktop; inside Brewser it also fills the
 * runtime's gaps. See SWITCH.md for the reasons behind each step.
 */
import { WebGLRenderer } from "three";
import { installBrewserPolyfills } from "./brewser-polyfills";
import { CJK_FAMILY, cjkFontReady, markCjkFontReady, matchRegisteredFont, rememberFontFace } from "./font-matching";
import { loadSwitchNetworkConfig } from "./network-page";
import { appAssetUrl, brewserSwitch, isPackagedPath } from "./platform";
import { enableBrewserTouchRouting, installSwitchInput } from "./switch-input";

/** "/ui/x.png" → "./ui/x.png" for every fetch (the release code builds such paths itself). */
function installPackagedFetch(): void {
  const original = globalThis.fetch.bind(globalThis);
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
    original(typeof input === "string" && isPackagedPath(input) ? appAssetUrl(input) : input, init)) as typeof fetch;
}

// ---- fonts (Brewser, font-matching.ts) ----------------------------------------
const CJK_MIN_BYTES = 2 * 1024 * 1024;

function installFontMatching(): void {
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
  const NativeFontFace = globalThis.FontFace;
  if (!fonts || typeof NativeFontFace !== "function") return;
  const sources = new WeakMap<FontFace, BufferSource>();
  const Wrapped = function FontFace(family: string, source: string | BufferSource, descriptors?: FontFaceDescriptors) {
    const face = new NativeFontFace(family, source, descriptors);
    if (typeof source !== "string") sources.set(face, source);
    return face;
  } as unknown as typeof FontFace;
  Wrapped.prototype = NativeFontFace.prototype;
  globalThis.FontFace = Wrapped;

  for (const face of fonts as unknown as Iterable<FontFace>) rememberFontFace(face.family, face.weight, face.style);
  const add = fonts.add.bind(fonts);
  fonts.add = (face: FontFace) => {
    const result = add(face);
    rememberFontFace(face.family, face.weight, face.style);
    const source = sources.get(face);
    if (!cjkFontReady() && source && source.byteLength >= CJK_MIN_BYTES) {
      markCjkFontReady();
      for (const weight of ["normal", "bold"]) {
        const alias = new NativeFontFace(CJK_FAMILY, source, { weight });
        add(alias);
        rememberFontFace(CJK_FAMILY, weight, "normal");
      }
      const style = document.createElement("style");
      style.textContent = `html,body,button,input,textarea,select,div,span,p,strong,section,label{font-family:"${CJK_FAMILY}",sans-serif}`;
      document.head?.appendChild(style);
    }
    return result;
  };

  const probe = document.createElement("canvas").getContext("2d");
  let proto: object | null = probe ? Object.getPrototypeOf(probe) : null;
  while (proto && !Object.getOwnPropertyDescriptor(proto, "font")) proto = Object.getPrototypeOf(proto);
  const descriptor = proto && Object.getOwnPropertyDescriptor(proto, "font");
  if (!proto || !descriptor?.set || !descriptor.get) return;
  Object.defineProperty(proto, "font", {
    configurable: true,
    get: descriptor.get,
    set(this: CanvasRenderingContext2D, value: string) { descriptor.set!.call(this, matchRegisteredFont(String(value))); },
  });
}

// ---- WebGL (Brewser) ----------------------------------------------------------
/**
 * Every canvas in Brewser renders through one shared GL context (a "tenant"
 * framebuffer per canvas), so state one three.js renderer caches can be stale
 * after another rendered: start each render from a known state.
 */
function installSharedContextRenderFix(): void {
  const proto = WebGLRenderer.prototype as WebGLRenderer & { render: WebGLRenderer["render"] };
  const render = proto.render;
  proto.render = function (this: WebGLRenderer, scene, camera) {
    this.resetState();
    return render.call(this, scene, camera);
  };
}

// ---- diagnostics --------------------------------------------------------------
/** Brewser has no developer tools: errors show on screen and go to kartsim-log.txt. */
function installDiagnostics(): void {
  const fs = brewserSwitch();
  const lines: string[] = [];
  let writing = false;
  let dirty = false;
  const flush = async () => {
    if (!fs?.writeFile || writing) { dirty = true; return; }
    writing = true;
    dirty = false;
    try { await fs.writeFile("kartsim-log.txt", lines.join("\n")); }
    catch { /* The log is best effort. */ }
    writing = false;
    if (dirty) void flush();
  };
  const log = (level: string, parts: unknown[]) => {
    const text = parts.map(part => part instanceof Error ? `${part.message}\n${part.stack ?? ""}`
      : typeof part === "string" ? part : (() => { try { return JSON.stringify(part); } catch { return String(part); } })())
      .join(" ");
    lines.push(`${new Date().toISOString()} ${level} ${text}`);
    if (lines.length > 400) lines.splice(0, lines.length - 400);
    void flush();
  };
  for (const level of ["error", "warn"] as const) {
    const original = console[level].bind(console);
    console[level] = (...parts: unknown[]) => { log(level.toUpperCase(), parts); original(...parts); };
  }
  let panel: HTMLElement | undefined;
  const show = (message: string) => {
    log("FATAL", [message]);
    if (!document.body) return;
    panel ??= Object.assign(document.createElement("div"), { className: "switch-error" });
    Object.assign(panel.style, {
      position: "fixed", left: "8px", right: "8px", top: "8px", maxHeight: "40%", overflow: "hidden",
      padding: "8px 12px", background: "rgba(120, 0, 0, 0.85)", color: "#fff", font: "14px sans-serif",
      zIndex: "2147483646", pointerEvents: "none", whiteSpace: "pre-wrap",
    });
    panel.textContent = `${message}\n（详细记录在 SD 卡的游戏目录 kartsim-log.txt）`.slice(0, 1200);
    if (!panel.isConnected) document.body.appendChild(panel);
  };
  window.addEventListener("error", event => {
    const error = (event as ErrorEvent).error;
    show(error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String((event as ErrorEvent).message));
  });
  window.addEventListener("unhandledrejection", event => {
    const reason = (event as PromiseRejectionEvent).reason;
    log("REJECTION", [reason]);
  });
  log("INFO", [`KartSim Switch 启动：${navigator.userAgent}，${window.innerWidth}×${window.innerHeight}`]);
}

const brewser = brewserSwitch() !== undefined;
installBrewserPolyfills();
installDiagnostics();
installPackagedFetch();
if (brewser) {
  installFontMatching();
  installSharedContextRenderFix();
  enableBrewserTouchRouting();
}
await loadSwitchNetworkConfig();
installSwitchInput();
