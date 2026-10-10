const CONTEXT_EVENTS = [
  "webglcontextlost", "webglcontextrestored", "contextlost", "contextrestored",
] as const;

/** Reports WebGL or 2D canvas loss and recovery with the active game phase. */
export class CanvasContextDiagnostics {
  constructor(
    readonly root: HTMLElement,
    readonly gameCanvas: HTMLCanvasElement,
    readonly phase: () => unknown,
    readonly report: (message: string, lost: boolean) => void,
  ) {
    for (const eventName of CONTEXT_EVENTS) {
      root.addEventListener(eventName, this.onContext, true);
    }
  }

  onContext = (event: Event): void => {
    const canvas = event.target;
    if (!(canvas instanceof HTMLCanvasElement)) return;
    const lost = event.type.endsWith("lost");
    const technology = event.type.startsWith("webgl") ? "WebGL" : "Canvas2D";
    const layer = canvas.closest<HTMLElement>("[data-ui-layer]")
      ?.dataset.uiLayer ?? "unknown";
    const owner = canvas === this.gameCanvas ? "主游戏画布" :
      `界面画布(${layer})`;
    const status = "statusMessage" in event &&
      typeof event.statusMessage === "string" ? event.statusMessage : "";
    const message = `[画布诊断] ${owner} ${technology} ${lost ? "已丢失" : "已恢复"}；${canvas.width}×${canvas.height}；阶段=${this.phase()}${status ? `；${status}` : ""}`;
    this.report(message, lost);
  };

  dispose(): void {
    for (const eventName of CONTEXT_EVENTS) {
      this.root.removeEventListener(eventName, this.onContext, true);
    }
  }
}
