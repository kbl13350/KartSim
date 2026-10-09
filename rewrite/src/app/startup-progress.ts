/** Fixed startup work units; lazy container downloads must not change the denominator. */
const WORK = { sources: 1, library: 1, garage: 1, maps: 1, account: 1, profile: 1, ready: 4 };
export type StartupWork = keyof typeof WORK;

export class StartupProgress {
  private readonly completed = new Map<StartupWork, number>();

  update(work: StartupWork, current = 0, total = 1): number {
    const fraction = Number.isFinite(current) && Number.isFinite(total) && total > 0
      ? Math.max(0, Math.min(1, current / total)) : 0;
    this.completed.set(work, Math.max(this.completed.get(work) ?? 0, fraction));
    let completed = 0;
    let planned = 0;
    for (const [key, weight] of Object.entries(WORK)) {
      planned += weight;
      completed += weight * (this.completed.get(key as StartupWork) ?? 0);
    }
    // Only HUD.finishLoading() publishes 100%, after the startup flow has succeeded.
    return Math.min(99, Math.floor(completed / planned * 100));
  }
}
