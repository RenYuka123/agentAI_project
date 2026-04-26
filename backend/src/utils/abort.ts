/**
 * 建立標準 AbortError，讓各層可以用一致的方式辨識取消流程。
 *
 * @param message 錯誤訊息。
 * @returns 帶有 AbortError 名稱的 Error。
 */
export const createAbortError = (message = "Operation aborted."): Error => {
  const error = new Error(message);
  error.name = "AbortError";
  return error;
};

/**
 * 若 signal 已中止，立即拋出 AbortError。
 *
 * @param signal 可能存在的 AbortSignal。
 * @param message 中止時的錯誤訊息。
 */
export const throwIfAborted = (signal?: AbortSignal, message?: string): void => {
  if (signal?.aborted) {
    throw createAbortError(message ?? "Operation aborted.");
  }
};

/**
 * 建立可同時受外部 signal 與 timeout 控制的 AbortSignal。
 *
 * @param timeoutMs timeout 毫秒數。
 * @param parentSignal 上層流程傳入的 signal。
 * @returns 可直接傳給 fetch 等 API 的 signal 與清理函式。
 */
export const createTimedAbortController = (
  timeoutMs: number,
  parentSignal?: AbortSignal,
): { signal: AbortSignal; cleanup: () => void } => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(createAbortError("Operation timed out."));
  }, timeoutMs);

  const handleParentAbort = () => {
    controller.abort(createAbortError("Operation aborted by parent signal."));
  };

  if (parentSignal) {
    if (parentSignal.aborted) {
      handleParentAbort();
    } else {
      parentSignal.addEventListener("abort", handleParentAbort, { once: true });
    }
  }

  const cleanup = () => {
    clearTimeout(timeoutId);
    parentSignal?.removeEventListener("abort", handleParentAbort);
  };

  return {
    signal: controller.signal,
    cleanup,
  };
};
