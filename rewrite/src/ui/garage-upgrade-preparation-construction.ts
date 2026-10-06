import type {
  GaragePreparationResult, GarageProgressionCandidate,
  GarageUpgradePreparationState,
} from "./garage-progression-session";

export interface GaragePreparationConstructionHost {
  state: GarageUpgradePreparationState;
  onClose: (result?: GaragePreparationResult) => void;
  element: HTMLElement;
  controls: HTMLElement;
  status: HTMLElement;
  context: CanvasRenderingContext2D;
  cancelButton(): void;
  close(accept: boolean): void;
  load(library: unknown): Promise<void>;
}

export interface GaragePreparationConstructionDependencies {
  createState(candidates: GarageProgressionCandidate[], selectedItemId: number):
    GarageUpgradePreparationState;
}

/** Mount the preparation canvas and keyboard controls before assets load. */
export function initializeGaragePreparation(
  host: GaragePreparationConstructionHost,
  surface: HTMLElement,
  library: unknown,
  candidates: GarageProgressionCandidate[],
  selectedItemId: number,
  onClose: (result?: GaragePreparationResult) => void,
  dependencies: GaragePreparationConstructionDependencies,
): void {
  host.onClose = onClose;
  host.state = dependencies.createState(candidates, selectedItemId);
  host.element.className = "garage-upgrade-preparation";
  host.element.setAttribute("role", "dialog");
  host.element.setAttribute("aria-modal", "true");
  host.element.setAttribute("aria-label", "迅车辆强化准备");
  const canvas = document.createElement("canvas");
  canvas.width = 1600;
  canvas.height = 900;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("强化准备画布不可用。");
  host.context = context;
  host.status.className = "garage-preparation-status";
  host.status.setAttribute("role", "status");
  host.status.textContent = "正在加载原版强化窗口…";
  host.element.append(canvas, host.controls, host.status);
  surface.append(host.element);
  host.cancelButton();
  host.element.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      host.close(false);
    }
    if (event.key === "Tab") {
      event.preventDefault();
      const buttons = [...host.controls.querySelectorAll<HTMLButtonElement>(
        "button:not(:disabled)")];
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      buttons[(index + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length]?.focus();
    }
  });
  void host.load(library);
}
