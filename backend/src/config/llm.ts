import { appConfig } from "./env.js";

/**
 * 通用 LLM 設定，統一從環境變數配置轉出，供 provider 使用。
 */
export interface LlmConfig {
  /** 目前要使用的 LLM provider 名稱。 */
  provider: string;
  /** 呼叫 LLM API 使用的金鑰。 */
  apiKey: string;
  /** 實際送出請求時要使用的模型名稱。 */
  model: string;
  /** LLM API 的基礎網址，可切換為 Groq、OpenAI 或其他相容服務。 */
  baseUrl: string;
}

/**
 * LLM 設定實體，提供 provider 讀取供應商、API 金鑰、模型與網址。
 */
export const llmConfig: LlmConfig = {
  provider: appConfig.llmProvider,
  apiKey: appConfig.llmApiKey,
  model: appConfig.llmModel,
  baseUrl: appConfig.llmBaseUrl,
};
