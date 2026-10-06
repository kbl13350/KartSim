/** Assets load after the dialog mounts so the cancel control remains usable. */
export interface GaragePreparationLoadingHost<TAssets> {
  disposed: boolean;
  assets?: TAssets;
  controls: Pick<HTMLElement, "replaceChildren">;
  status: Pick<HTMLElement, "textContent">;
  cancelButton(): void;
  refresh(): void;
}

export async function loadGaragePreparation<TAssets>(
  host: GaragePreparationLoadingHost<TAssets>, library: unknown,
  loadAssets: (library: unknown) => Promise<TAssets>,
): Promise<void> {
  try {
    const assets = await loadAssets(library);
    if (host.disposed) return;
    host.assets = assets;
    host.refresh();
  } catch (error) {
    host.assets = undefined;
    if (!host.disposed) {
      host.controls.replaceChildren();
      host.cancelButton();
      host.status.textContent = "强化窗口加载失败，未修改草稿：" +
        (error instanceof Error ? error.message : String(error));
    }
  }
}
