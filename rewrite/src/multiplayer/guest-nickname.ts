/** Guest nickname availability check and fallback entry dialog. */

export interface GuestNicknameDependencies {
  createElement(tag: string): HTMLElement;
  overlayStyle: string;
  panelStyle: string;
  styleButtons(...buttons: HTMLButtonElement[]): void;
  endpoint(action: string): string;
  fetch(url: string, options: Record<string, unknown>): Promise<{
    ok: boolean;
    json(): Promise<{ error?: string; available?: boolean }>;
  }>;
  errorMessages: Record<string, string>;
  formatError(error: unknown): string;
}

export async function chooseGuestNickname(dependencies: GuestNicknameDependencies,
  root: HTMLElement, previousName: string, signal?: AbortSignal,
  forcePrompt = false): Promise<string> {
  const available = async (name: string): Promise<boolean> => {
    if (!name || [...name].length > 18 || name !== name.trim() ||
      /[\x00-\x1f\x7f<>]/.test(name)) {
      throw new Error("昵称须为 1–18 字，且不能包含控制字符或尖括号。");
    }
    const response = await dependencies.fetch(dependencies.endpoint("guest-name"), {
      method: "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }), signal,
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(dependencies.errorMessages[payload.error ?? ""] ??
        payload.error ?? "昵称检查失败。");
    }
    return payload.available === true;
  };

  if (signal?.aborted) throw new Error("ACCOUNT_CANCELLED");
  if (previousName && !forcePrompt) {
    try {
      if (await available(previousName)) return previousName;
    } catch (error) {
      if (signal?.aborted) throw new Error("ACCOUNT_CANCELLED");
      if (error instanceof Error && !error.message.startsWith("昵称须为")) {
        throw error;
      }
    }
  }

  return new Promise<string>((resolve, reject) => {
    const overlay = dependencies.createElement("div");
    const form = dependencies.createElement("form") as HTMLFormElement;
    overlay.style.cssText = dependencies.overlayStyle;
    form.style.cssText = dependencies.panelStyle;
    const heading = dependencies.createElement("h2");
    heading.textContent = "游客昵称";
    heading.style.margin = "0";
    const description = dependencies.createElement("div");
    description.textContent = previousName
      ? "这个昵称已被使用，请换一个昵称。"
      : "请输入进入多人游戏时使用的昵称。";
    const input = dependencies.createElement("input") as HTMLInputElement;
    input.value = previousName;
    input.maxLength = 36;
    input.placeholder = "1–18 字昵称";
    input.style.cssText = "box-sizing:border-box;width:100%;padding:9px;font:inherit;background:#fff;color:#152333";
    const errorText = dependencies.createElement("div");
    errorText.style.cssText = "min-height:20px;color:#ffb3a9";
    const submit = dependencies.createElement("button") as HTMLButtonElement;
    submit.type = "submit";
    submit.textContent = "进入多人游戏";
    const back = dependencies.createElement("button") as HTMLButtonElement;
    back.type = "button";
    back.textContent = "返回";
    dependencies.styleButtons(submit, back);

    const cleanup = () => {
      signal?.removeEventListener("abort", onAbort);
      overlay.remove();
    };
    const onAbort = () => {
      cleanup();
      reject(new Error("ACCOUNT_CANCELLED"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    back.onclick = onAbort;
    form.onsubmit = async event => {
      event.preventDefault();
      submit.disabled = true;
      errorText.textContent = "";
      try {
        const name = input.value;
        if (!await available(name)) {
          errorText.textContent = "昵称已被注册或当前有人使用，请换一个。";
          return;
        }
        cleanup();
        resolve(name);
      } catch (error) {
        if (signal?.aborted) {
          onAbort();
          return;
        }
        errorText.textContent = dependencies.formatError(error);
      } finally {
        submit.disabled = false;
      }
    };
    form.append(heading, description, input, errorText, submit, back);
    overlay.append(form);
    root.ownerDocument.body.append(overlay);
    input.focus();
  });
}
