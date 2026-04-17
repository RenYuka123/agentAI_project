import type { JsonObject, JsonValue } from "../../../types/common.types.js";

/**
 * 工具目前所屬的能力分類。
 */
export type ToolCategory = "math" | "text" | "finance";

/**
 * 工具的統一元數據格式，提供後續 timeout、retry 與監控擴充使用。
 */
export interface ToolMetadata {
  /** 工具所屬的能力分類。 */
  category: ToolCategory;
  /** 工具版本，方便後續追蹤行為變化。 */
  version: string;
  /** 單次執行預期的逾時時間。 */
  timeoutMs: number;
  /** 該工具失敗後是否適合自動重試。 */
  retryable: boolean;
  /** 自動重試的最大次數。 */
  maxRetries: number;
  /** 同樣輸入重複執行時是否應得到相同結果。 */
  idempotent: boolean;
}

/**
 * 工具健康檢查的標準狀態。
 */
export interface ToolHealthStatus {
  /** 工具目前是否健康可用。 */
  ok: boolean;
  /** 本次檢查對應的工具名稱。 */
  toolName: string;
  /** 健康狀態的摘要說明。 */
  message: string;
  /** 檢查時間。 */
  checkedAt: string;
  /** 額外補充資訊。 */
  details?: JsonObject;
}

/**
 * 工具失敗時的標準錯誤格式。
 */
export interface ToolExecutionError {
  /** 方便程式判斷的錯誤代碼。 */
  code: string;
  /** 可提供給模型與記錄使用的錯誤訊息。 */
  message: string;
  /** 是否適合在未來加入自動重試流程。 */
  retriable: boolean;
}

/**
 * 工具執行時的共用中繼資訊。
 */
export interface ToolExecutionMeta {
  /** 本次執行開始時間。 */
  startedAt: string;
  /** 本次執行結束時間。 */
  finishedAt: string;
  /** 執行耗時毫秒數。 */
  durationMs: number;
  /** 本次總共執行了幾次。 */
  attempts: number;
  /** 是否曾發生重試。 */
  retried: boolean;
}

/**
 * 工具執行完成後的統一結果格式。
 */
export interface ToolExecutionResult<TData extends JsonValue = JsonValue> {
  /** 工具是否成功執行。 */
  ok: boolean;
  /** 執行的工具名稱。 */
  toolName: string;
  /** 執行成功時的標準化資料。 */
  data?: TData;
  /** 執行失敗時的標準錯誤資訊。 */
  error?: ToolExecutionError;
  /** 執行中繼資訊。 */
  meta: ToolExecutionMeta;
}

/**
 * 所有工具都必須遵守的共同介面。
 */
export interface AgentTool<TInput extends JsonObject = JsonObject, TResult extends JsonValue = JsonValue> {
  /** 工具唯一名稱，提供給 LLM 與 registry 辨識。 */
  name: string;
  /** 工具用途描述，主要提供 prompt 使用。 */
  description: string;
  /** 工具的統一元數據。 */
  metadata: ToolMetadata;
  /** 工具輸入格式說明，用來提示模型應傳入哪些欄位。 */
  inputSchema: JsonObject;
  /**
   * 驗證並正規化工具輸入。
   *
   * @param input 原始工具輸入資料。
   * @returns 通過驗證後可直接執行的工具輸入。
   */
  validateInput: (input: JsonObject) => TInput;
  /**
   * 執行工具並回傳標準化資料內容。
   *
   * @param input 驗證後的工具輸入資料。
   * @returns 工具執行完成後的資料內容。
   */
  execute: (input: TInput) => Promise<TResult>;
  /**
   * 檢查工具目前是否可正常使用。
   *
   * @returns 工具健康狀態。
   */
  healthCheck?: () => Promise<ToolHealthStatus>;
}

/**
 * 供 registry 與 executor 使用的通用工具型別。
 */
export type AnyAgentTool = AgentTool<any, JsonValue>;
