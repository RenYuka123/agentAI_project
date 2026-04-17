import type { JsonObject, JsonValue } from "../../../types/common.types.js";
import { logger } from "../../../utils/logger.js";
import { ToolError, normalizeToolError } from "./tool-errors.js";
import type { AnyAgentTool, ToolExecutionError, ToolExecutionResult } from "./tool.types.js";

/**
 * 在指定時間內執行非同步工作，超時時回傳標準工具錯誤。
 *
 * @param task 要執行的非同步工作。
 * @param timeoutMs 逾時毫秒數。
 * @param toolName 工具名稱。
 * @returns 工作完成結果。
 */
const withTimeout = async <T>(task: Promise<T>, timeoutMs: number, toolName: string): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new ToolError("TOOL_TIMEOUT", `${toolName} 執行逾時。`, true));
    }, timeoutMs);

    task
      .then((value) => {
        clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error: unknown) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });

/**
 * 構建統一格式的工具執行結果。
 */
const buildToolResult = (
  tool: AnyAgentTool,
  startedAt: Date,
  finishedAt: Date,
  outcome:
    | { status: "success"; data: JsonValue; attempts: number }
    | { status: "failure"; error: ToolExecutionError; attempts: number },
): ToolExecutionResult => {
  const durationMs = finishedAt.getTime() - startedAt.getTime();

  if (outcome.status === "success") {
    return {
      ok: true,
      toolName: tool.name,
      data: outcome.data,
      meta: {
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs,
        attempts: outcome.attempts,
        retried: outcome.attempts > 1,
      },
    };
  }

  return {
    ok: false,
    toolName: tool.name,
    error: outcome.error,
    meta: {
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs,
      attempts: outcome.attempts,
      retried: outcome.attempts > 1,
    },
  };
};

/**
 * 記錄工具執行結果。
 */
const logToolResult = (
  result: ToolExecutionResult,
  stage: "completed" | "failed" | "failed_before_execution",
) => {
  const baseLog = {
    toolName: result.toolName,
    ok: result.ok,
    durationMs: result.meta.durationMs,
    attempts: result.meta.attempts,
    retried: result.meta.retried,
  };

  if (result.ok) {
    logger.info(`Tool executor ${stage}`, baseLog);
  } else {
    logger.error(`Tool executor ${stage}`, { ...baseLog, error: result.error });
  }
};

/**
 * 執行單一工具，集中處理輸入驗證、耗時紀錄與錯誤標準化。
 *
 * @param tool 要執行的工具定義。
 * @param input 原始工具輸入。
 * @returns 統一格式的工具執行結果。
 */
export const executeTool = async (tool: AnyAgentTool, input: JsonObject): Promise<ToolExecutionResult> => {
  const startedAt = new Date();
  const maxAttempts = tool.metadata.retryable ? Math.max(1, tool.metadata.maxRetries + 1) : 1;

  logger.info("Tool executor started", {
    toolName: tool.name,
    toolCategory: tool.metadata.category,
    toolVersion: tool.metadata.version,
    timeoutMs: tool.metadata.timeoutMs,
    maxAttempts,
  });

  try {
    /**
     * 先統一做輸入驗證與正規化，避免後續每次重試都重複解析原始輸入。
     */
    const normalizedInput = tool.validateInput(input);
    let attempt = 0;
    let lastError: unknown;

    /**
     * 依工具設定的最大次數執行，若錯誤可重試，才會進入下一次循環。
     */
    while (attempt < maxAttempts) {
      attempt += 1;

      try {
        /**
         * 每次真正執行工具時都套上 timeout 保護，避免外部服務或工具邏輯卡住。
         */
        const data = await withTimeout(tool.execute(normalizedInput), tool.metadata.timeoutMs, tool.name);
        const finishedAt = new Date();
        const result = buildToolResult(tool, startedAt, finishedAt, {
          status: "success",
          data,
          attempts: attempt,
        });

        logToolResult(result, "completed");
        return result;
      } catch (error) {
        /**
         * 先保留最後一次錯誤，若後續不再重試，會用它組成最終失敗結果。
         */
        lastError = error;
        const normalizedError = normalizeToolError(error);
        const shouldRetry = normalizedError.retriable && attempt < maxAttempts;

        logger.warn("Tool executor attempt failed", {
          toolName: tool.name,
          attempt,
          maxAttempts,
          shouldRetry,
          error: normalizedError,
        });

        /**
         * 不可重試或已達最大次數時，跳出循環並回傳最終失敗結果。
         */
        if (!shouldRetry) {
          break;
        }
      }
    }

    /**
     * 工具已實際執行過，但最終仍失敗，回傳標準化的失敗結果。
     */
    const finishedAt = new Date();
    const result = buildToolResult(tool, startedAt, finishedAt, {
      status: "failure",
      error: normalizeToolError(lastError),
      attempts: attempt,
    });

    logToolResult(result, "failed");
    return result;
  } catch (error) {
    /**
     * 這裡通常代表工具還沒真正執行就失敗，例如輸入驗證沒有通過。
     */
    const finishedAt = new Date();
    const result = buildToolResult(tool, startedAt, finishedAt, {
      status: "failure",
      error: normalizeToolError(error),
      attempts: 0,
    });

    logToolResult(result, "failed_before_execution");
    return result;
  }
};
