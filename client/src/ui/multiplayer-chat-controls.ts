import { tr } from "../i18n/locale";
import type { WindowNode } from "./multiplayer-window-assets";
import type { MultiplayerWindowDrawHost, WindowNodeState, WindowRect } from "./multiplayer-window-draw";

const inputRects = new WeakMap<object, WindowRect>();
const dismissInstalled = new WeakSet<object>();
const face = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 14c1 4 7 4 8 0" stroke-linecap="round"/><path d="M8 9h.01M16 9h.01" stroke-width="3" stroke-linecap="round"/></svg>';
function installStyle(doc: Document): void {
  if (doc.getElementById("ks-room-chat-style")) return;
  const style = doc.createElement("style"); style.id = "ks-room-chat-style";
  style.textContent = `
.ks-emotion-toggle{position:absolute;display:flex;align-items:center;justify-content:center;gap:6px;box-sizing:border-box;border:1px solid #7398ba;border-radius:9px;background:linear-gradient(135deg,#284d74,#172f51);color:#d9f5ff;cursor:pointer;box-shadow:inset 0 1px #ffffff24;z-index:4}
.ks-emotion-toggle:hover,.ks-emotion-toggle[aria-expanded=true]{background:#23779c;border-color:#8ae7ff;color:white}
.ks-emotion-toggle:focus-visible,.ks-emotion-panel button:focus-visible{outline:2px solid #98efff;outline-offset:2px}
.ks-emotion-toggle:disabled,.ks-emotion-panel button:disabled{opacity:.4;cursor:default}
.ks-emotion-panel{position:absolute;box-sizing:border-box;padding:16px;border:1px solid #6386a7;border-radius:16px;background:linear-gradient(150deg,#223f62,#101f36);color:#edf8ff;box-shadow:0 14px 38px #0008,inset 0 1px #ffffff12;z-index:5;font:14px system-ui;pointer-events:auto}
.ks-emotion-panel header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;font-size:18px;font-weight:700}
.ks-emotion-close{border:0;background:#ffffff12;color:#cce8ff;border-radius:7px;width:28px;height:28px;font-size:22px;cursor:pointer}
.ks-emotion-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
.ks-emotion-item{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-height:76px;padding:10px 4px 8px;border:1px solid #ffffff16;border-radius:10px;background:#ffffff08;color:#e3f1ff;cursor:pointer;font:13px system-ui;transition:background .12s,border-color .12s}
.ks-emotion-item:hover{background:#3587b23d;border-color:#74d6ef}
.ks-emotion-item .face{font:28px system-ui;line-height:30px}
.ks-emotion-item kbd{position:absolute;right:5px;top:3px;color:#9ab6d2;font:10px system-ui}
.ks-emotion-panel footer{color:#96b1cd;font:12px system-ui;margin-top:12px;text-align:right}
.ks-emotion-panel[hidden],.ks-emotion-toggle[hidden]{display:none!important}
`;
  doc.head.append(style);
}
export function placeChatControl(element: HTMLElement, rect: WindowRect, root: HTMLElement): void {
  Object.assign(element.style, { left: `${rect.x / 16}%`, top: `${rect.y / 9}%`,
    width: `${rect.width}px`, height: `${rect.height}px`, transformOrigin: "top left",
    transform: `scale(${root.clientWidth / 1600},${root.clientHeight / 900})` });
}
/** Reserve space inside the input for the trailing emotion button. */
export function roomChatInputRect(host: object, rect: WindowRect): WindowRect {
  inputRects.set(host, rect);
  return { ...rect, width: Math.max(1, rect.width - 46) };
}
export function syncRoomEmotionControl(host: MultiplayerWindowDrawHost, node: WindowNode,
  name: string, state: WindowNodeState, fallback: WindowRect,
  attribute: (node: WindowNode, key: string) => string | undefined): boolean {
  if (name !== "roomEmotionToggle" && name !== "roomEmotionWheel") return false;
  installStyle(host.element.ownerDocument);
  if (!dismissInstalled.has(host)) {
    dismissInstalled.add(host);
    host.element.addEventListener("pointerdown", event => {
      const toggle = [...host.controls.keys()].find(key => attribute(key,"name") === "roomEmotionToggle");
      const panel = [...host.controls.keys()].find(key => attribute(key,"name") === "roomEmotionWheel");
      if (!toggle || !host.options.state(toggle).expanded) return;
      const target = event.target as Node;
      if (!host.controls.get(toggle)?.contains(target) && (!panel || !host.controls.get(panel)?.contains(target)))
        host.options.state(toggle).action?.();
    }, true);
  }
  const input = inputRects.get(host);
  const anchor = input ? { x: input.x + input.width - 42, y: input.y + 1, width: 38, height: Math.max(24, input.height - 2) } : fallback;
  let control = host.controls.get(node);
  if (!control) {
    control = document.createElement(name === "roomEmotionToggle" ? "button" : "section");
    control.className = name === "roomEmotionToggle" ? "ks-emotion-toggle" : "ks-emotion-panel";
    host.controls.set(node, control); host.element.append(control);
    control.addEventListener("pointerdown", event => event.stopPropagation());
    control.addEventListener("click", event => event.stopPropagation());
    if (name === "roomEmotionToggle") {
      (control as HTMLButtonElement).type = "button";
      control.innerHTML = face;
      control.addEventListener("click", () => { const current = host.options.state(node); if (!current.disabled) current.action?.(); });
    } else {
      const header = document.createElement("header");
      const title = document.createElement("span");title.textContent = tr("表情");header.append(title);
      const close = document.createElement("button");close.className = "ks-emotion-close";close.type = "button";
      close.textContent = "×";close.setAttribute("aria-label",tr("关闭"));
      close.addEventListener("click", () => {
        const toggle = [...host.controls.keys()].find(key => attribute(key,"name") === "roomEmotionToggle");
        if (toggle) { host.options.state(toggle).action?.();host.controls.get(toggle)?.focus(); }
      });header.append(close);control.append(header);
      const grid = document.createElement("div");grid.className = "ks-emotion-grid";
      const faces = ["😊", "😂", "😢", "😠", "😎", "👏", "😮", "💛"];
      node.children.forEach((child,index) => {
        const button = document.createElement("button");button.type = "button";button.className = "ks-emotion-item";
        const icon = document.createElement("span");icon.className = "face";icon.textContent = faces[index % faces.length]!;icon.setAttribute("aria-hidden","true");
        const label = document.createElement("span");label.textContent = (attribute(child,"text") ?? "").replace(/^\d+\s*/,"");
        const key = document.createElement("kbd");key.textContent = String(index+1);
        button.append(icon,label,key);button.setAttribute("aria-label",label.textContent);
        button.addEventListener("click",() => { const current=host.options.state(child);if (!current.disabled) current.action?.(); });
        grid.append(button);
      });control.append(grid);
      const footer=document.createElement("footer");footer.textContent="Ctrl + 1–8  ·  Esc";control.append(footer);
      control.setAttribute("role","group");control.setAttribute("aria-label",tr("表情"));
    }
  }
  control.hidden = false;
  if (name === "roomEmotionToggle") {
    (control as HTMLButtonElement).disabled = !!state.disabled;
    control.setAttribute("aria-label",tr("表情"));control.setAttribute("aria-expanded",String(!!state.expanded));
    control.title=tr("表情")+" · `";placeChatControl(control,anchor,host.options.root);
  } else {
    const height=82+Math.ceil(node.children.length/4)*84;
    placeChatControl(control,{x:Math.max(8,Math.min(1248,anchor.x+anchor.width-344)),y:Math.max(8,anchor.y-height-12),width:344,height},host.options.root);
    control.querySelectorAll<HTMLButtonElement>(".ks-emotion-item").forEach((button,index)=>{
      const current=host.options.state(node.children[index]!);button.disabled=!!current.disabled;
    });
  }
  return true;
}
