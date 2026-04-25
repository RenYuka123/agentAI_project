import { safeJsonParse } from "../../../utils/safe-json.js";
import { logger } from "../../../utils/logger.js";
import type { AgentDecision, AgentMessage } from "../../agent/index.js";
import { OpenAiProvider } from "../providers/openai.provider.js";

/**
 * 從包裝過的 tool context 中取回原始工具結果。
 *
 * @param message tool 訊息內容。
 * @returns 純工具結果字串。
 */
const extractToolResultContent = (message: AgentMessage): string => {
  const marker = "Tool result: ";
  const markerIndex = message.content.lastIndexOf(marker);

  if (markerIndex < 0) {
    return message.content;
  }

  return message.content.slice(markerIndex + marker.length).trim();
};

/**
 * 即使尚未設定外部 LLM，也提供可讀的 fallback 回覆。
 *
 * @param toolMessage 最新的工具訊息。
 * @returns 轉換後可直接回給使用者的文字。
 */
const createFallbackFinalAnswer = (toolMessage: AgentMessage): string => {
  const toolResult = extractToolResultContent(toolMessage);
  const parsed = safeJsonParse(toolResult);

  if (!parsed.ok || typeof parsed.data !== "object" || parsed.data === null) {
    return toolResult;
  }

  const data = parsed.data as Record<string, unknown>;

  if (toolMessage.toolName === "calculator") {
    return `計算完成，結果是 ${String(data.result ?? toolResult)}。`;
  }

  if (toolMessage.toolName === "summarize_text") {
    return typeof data.summary === "string" ? data.summary : toolResult;
  }

  if (toolMessage.toolName === "get_stock_price") {
    if (data.available === false) {
      return typeof data.message === "string" ? data.message : "目前無法取得股價資料。";
    }

    return `${String(data.symbol ?? "標的")} 最新價格約為 ${String(data.price ?? "?")} ${String(
      data.currency ?? "",
    )}。`.trim();
  }

  return toolResult;
};

/**
 * 在沒有外部 LLM 可用時，根據當前上下文產生本地 fallback 決策。
 *
 * @param messages 當前 agent 對話上下文。
 * @returns 模擬出的 agent 決策結果。
 */
const createLocalFallbackDecision = (messages: AgentMessage[]): AgentDecision => {
  const latestUserMessage = [...messages].reverse().find((message) => message.role === "user")?.content ?? "";
  const latestToolMessage = [...messages].reverse().find((message) => message.role === "tool");

  if (latestToolMessage) {
    return {
      type: "final",
      answer: createFallbackFinalAnswer(latestToolMessage),
    };
  }

  const normalized = latestUserMessage.toLowerCase();

  if (normalized.includes("總結") || normalized.includes("摘要") || normalized.includes("summar")) {
    return {
      type: "tool_call",
      toolName: "summarize_text",
      toolInput: {
        text: latestUserMessage,
      },
    };
  }

  const mathPattern = /[\d)\]]\s*[\+\-\*\/\^]\s*[\d(\[]/;
  if (mathPattern.test(latestUserMessage) || normalized.includes("calculate") || normalized.includes("幫我算")) {
    return {
      type: "tool_call",
      toolName: "calculator",
      toolInput: {
        expression: latestUserMessage.replace(/^.*?(?=\d)/, "").trim() || latestUserMessage,
      },
    };
  }

  if (normalized.includes("股價") || normalized.includes("price") || normalized.includes("股票")) {
    return {
      type: "tool_call",
      toolName: "get_stock_price",
      toolInput: {
        symbol: latestUserMessage.replace(/[^A-Za-z0-9.]/g, " ").trim().split(/\s+/)[0] || latestUserMessage.trim(),
      },
    };
  }

  if (normalized.includes("天氣") || normalized.includes("weather") || normalized.includes("下雨")) {
    return {
      type: "tool_call",
      toolName: "get_weather",
      toolInput: {
        location: latestUserMessage
          .replace(/今天天氣|現在天氣|天氣怎麼樣|天氣如何|weather/gi, " ")
          .replace(/[?？]/g, " ")
          .trim() || latestUserMessage.trim(),
      },
    };
  }

  return {
    type: "final",
    answer: `目前沒有啟用外部 LLM，我先直接回覆：${latestUserMessage}`,
  };
};

const provider = new OpenAiProvider();

const hasMissingApiKeyError = (error: unknown): boolean =>
  error instanceof Error && error.message.includes("LLM_API_KEY is not configured");

export const llmService = {
  async askAgentDecision(messages: AgentMessage[]): Promise<AgentDecision> {
    try {
      const decision = await provider.getAgentDecision(messages);
      logger.info("LLM service received provider decision", decision);
      return decision;
    } catch (error) {
      if (hasMissingApiKeyError(error)) {
        logger.warn("LLM API key is missing, using local fallback decision");
        const fallbackDecision = createLocalFallbackDecision(messages);
        logger.info("LLM service generated local fallback decision", fallbackDecision);
        return fallbackDecision;
      }

      logger.error("LLM service failed to get decision", error);
      throw error;
    }
  },

  async askJson<T>(input: {
    messages: AgentMessage[];
    validate: (value: unknown) => value is T;
    fallback?: () => T;
  }): Promise<T> {
    const { fallback, messages, validate } = input;

    try {
      const payload = await provider.getJsonResponse(messages);

      if (!validate(payload)) {
        throw new Error("LLM provider returned invalid structured JSON payload.");
      }

      logger.info("LLM service received structured JSON payload");
      return payload;
    } catch (error) {
      if (fallback && hasMissingApiKeyError(error)) {
        logger.warn("LLM API key is missing, using structured JSON fallback");
        return fallback();
      }

      logger.error("LLM service failed to get structured JSON payload", error);
      throw error;
    }
  },
};
