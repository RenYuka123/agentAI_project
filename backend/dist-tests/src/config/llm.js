import { appConfig } from "./env.js";
/**
 * LLM 設定實體，提供 provider 讀取供應商、API 金鑰、模型與網址。
 */
export const llmConfig = {
    provider: appConfig.llmProvider,
    apiKey: appConfig.llmApiKey,
    model: appConfig.llmModel,
    baseUrl: appConfig.llmBaseUrl,
};
