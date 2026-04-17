/**
 * 統一字串型環境變數讀取，避免重複寫 fallback 邏輯。
 *
 * @param name 環境變數名稱。
 * @param fallback 找不到值時的預設內容。
 * @returns 清理過空白後的環境變數字串。
 */
const getString = (name: string, fallback = ""): string => process.env[name]?.trim() || fallback;

/**
 * 數字型環境變數統一在這裡轉換，無效值時回退預設值。
 *
 * @param name 環境變數名稱。
 * @param fallback 無法轉成數字時使用的預設值。
 * @returns 可用的數字型設定值。
 */
const getNumber = (name: string, fallback: number): number => {
  const rawValue = process.env[name];

  if (!rawValue) {
    return fallback;
  }

  const value = Number(rawValue);
  return Number.isFinite(value) ? value : fallback;
};

export const appConfig = {
  nodeEnv: getString("NODE_ENV", "development"),
  port: getNumber("PORT", 3001),
  mongodbUri: getString("MONGODB_URI", "mongodb://localhost:27017/ai-investment"),
  mongodbDatabaseName: getString("MONGODB_DATABASE_NAME", "ai-investment"),
  llmProvider: getString("LLM_PROVIDER", "openai-compatible"),
  llmApiKey: getString("LLM_API_KEY"),
  llmModel: getString("LLM_MODEL", "gpt-4o-mini"),
  llmBaseUrl: getString("LLM_BASE_URL", "https://api.openai.com/v1"),
  maxAgentLoops: getNumber("AGENT_MAX_LOOPS", 5),
  agentHistoryLimit: getNumber("AGENT_HISTORY_LIMIT", 20),
  stockPriceApiUrl: getString("STOCK_PRICE_API_URL"),
  stockPriceApiKey: getString("STOCK_PRICE_API_KEY"),
  weatherApiUrl: getString("WEATHER_API_URL", "https://api.open-meteo.com/v1/forecast"),
  weatherGeocodingApiUrl: getString("WEATHER_GEOCODING_API_URL", "https://geocoding-api.open-meteo.com/v1/search"),
};
