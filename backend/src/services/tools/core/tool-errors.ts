import type { JsonObject } from "../../../types/common.types.js";
import type { ToolExecutionError } from "./tool.types.js";

/**
 * 工具層專用錯誤，統一保留代碼與可重試資訊。
 */
export class ToolError extends Error {
  /** 方便外層判斷的錯誤代碼。 */
  public readonly code: string;

  /** 是否適合在之後加入重試機制。 */
  public readonly retriable: boolean;

  /** 額外補充資訊，方便除錯使用。 */
  public readonly details?: JsonObject;

  /**
   * 建立標準工具錯誤。
   *
   * @param code 錯誤代碼。
   * @param message 錯誤訊息。
   * @param retriable 是否適合重試。
   * @param details 額外補充資訊。
   */
  public constructor(code: string, message: string, retriable = false, details?: JsonObject) {
    super(message);
    this.name = "ToolError";
    this.code = code;
    this.retriable = retriable;
    this.details = details;
  }
}

/**
 * 建立工具輸入驗證錯誤。
 *
 * @param message 錯誤訊息。
 * @param details 額外補充資訊。
 * @returns 統一格式的工具錯誤。
 */
export const createToolInputError = (message: string, details?: JsonObject): ToolError =>
  new ToolError("INVALID_TOOL_INPUT", message, false, details);

/**
 * 建立工具執行失敗錯誤。
 *
 * @param message 錯誤訊息。
 * @param retriable 是否適合重試。
 * @param details 額外補充資訊。
 * @returns 統一格式的工具錯誤。
 */
export const createToolExecutionError = (message: string, retriable = false, details?: JsonObject): ToolError =>
  new ToolError("TOOL_EXECUTION_FAILED", message, retriable, details);

/**
 * 將未知錯誤統一整理成工具結果可用的格式。
 *
 * @param error 原始錯誤。
 * @returns 標準化後的工具錯誤資訊。
 */
export const normalizeToolError = (error: unknown): ToolExecutionError => {
  if (error instanceof ToolError) {
    return {
      code: error.code,
      message: error.message,
      retriable: error.retriable,
    };
  }

  if (error instanceof Error) {
    return {
      code: "UNKNOWN_TOOL_ERROR",
      message: error.message,
      retriable: false,
    };
  }

  return {
    code: "UNKNOWN_TOOL_ERROR",
    message: "工具執行時發生未知錯誤。",
    retriable: false,
  };
};
