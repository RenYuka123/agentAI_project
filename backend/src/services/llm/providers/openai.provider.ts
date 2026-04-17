import { llmConfig } from "../../../config/llm.js";
import { logger } from "../../../utils/logger.js";
import { safeJsonParse } from "../../../utils/safe-json.js";
import type { AgentDecision, AgentMessage } from "../../agent/index.js";
import type { LlmProvider } from "../index.js";

interface OpenAiChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}

/**
 * chat completions 不認得自訂 tool role，所以先映射成 user。
 *
 * @param role Agent 訊息角色。
 * @returns OpenAI chat completions 可接受的角色。
 */
const mapRole = (role: AgentMessage["role"]): "system" | "user" | "assistant" => {
  if (role === "tool") {
    return "user";
  }

  return role;
};

/**
 * 將 agent 訊息轉成 OpenAI chat completions 格式。
 *
 * @param messages Agent 對話訊息列表。
 * @returns 可直接送給 OpenAI API 的訊息格式。
 */
const mapMessages = (messages: AgentMessage[]) =>
  messages.map((message) => {
    const prefix = message.role === "tool" && message.toolName ? `[tool:${message.toolName}] ` : "";

    return {
      role: mapRole(message.role),
      content: `${prefix}${message.content}`,
    };
  });

/**
 * 驗證模型回傳內容是否符合 AgentDecision 結構。
 *
 * @param value 待驗證的未知資料。
 * @returns 是否為合法的 AgentDecision。
 */
const isAgentDecision = (value: unknown): value is AgentDecision => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<AgentDecision>;

  if (candidate.type === "final") {
    return typeof candidate.answer === "string";
  }

  if (candidate.type === "tool_call") {
    return (
      typeof candidate.toolName === "string" &&
      typeof candidate.toolInput === "object" &&
      candidate.toolInput !== null
    );
  }

  return false;
};

export class OpenAiProvider implements LlmProvider {
  async getAgentDecision(messages: AgentMessage[]): Promise<AgentDecision> {
    if (!llmConfig.apiKey) {
      throw new Error("LLM_API_KEY is not configured.");
    }

    logger.info("LLM provider sending chat completion request", {
      provider: llmConfig.provider,
      model: llmConfig.model,
      messageCount: messages.length,
    });

    const response = await fetch(`${llmConfig.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${llmConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: llmConfig.model,
        temperature: 0.2,
        response_format: {
          type: "json_object",
        },
        messages: mapMessages(messages),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error("LLM provider request failed", {
        provider: llmConfig.provider,
        status: response.status,
        errorText,
      });
      throw new Error(`OpenAI request failed: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as OpenAiChatCompletionResponse;
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("OpenAI returned an empty response.");
    }

    const parsed = safeJsonParse(content);

    if (!parsed.ok || !isAgentDecision(parsed.data)) {
      logger.error("LLM provider returned invalid decision payload", {
        content,
      });
      throw new Error("LLM provider returned invalid agent decision JSON.");
    }

    logger.info("LLM provider parsed decision successfully", parsed.data);
    return parsed.data;
  }
}
