import { llmConfig } from "../../../config/llm.js";
import { createAbortError, createTimedAbortController, throwIfAborted } from "../../../utils/abort.js";
import { logger } from "../../../utils/logger.js";
import { safeJsonParse } from "../../../utils/safe-json.js";
/**
 * chat completions 不認得自訂 tool role，所以先映射成 user。
 *
 * @param role Agent 訊息角色。
 * @returns OpenAI chat completions 可接受的角色。
 */
const mapRole = (role) => {
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
const mapMessages = (messages) => messages.map((message) => {
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
const isAgentDecision = (value) => {
    if (!value || typeof value !== "object") {
        return false;
    }
    const candidate = value;
    if (candidate.type === "final") {
        return typeof candidate.answer === "string";
    }
    if (candidate.type === "tool_call") {
        return (typeof candidate.toolName === "string" &&
            typeof candidate.toolInput === "object" &&
            candidate.toolInput !== null);
    }
    return false;
};
export class OpenAiProvider {
    async getJsonResponse(messages, signal) {
        if (!llmConfig.apiKey) {
            throw new Error("LLM_API_KEY is not configured.");
        }
        throwIfAborted(signal, "LLM provider request aborted before fetch.");
        logger.info("LLM provider sending chat completion request", {
            provider: llmConfig.provider,
            model: llmConfig.model,
            messageCount: messages.length,
        });
        const { cleanup, signal: requestSignal } = createTimedAbortController(15000, signal);
        let response;
        try {
            response = await fetch(`${llmConfig.baseUrl}/chat/completions`, {
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
                signal: requestSignal,
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
            const data = (await response.json());
            const content = data.choices?.[0]?.message?.content;
            if (!content) {
                throw new Error("OpenAI returned an empty response.");
            }
            const parsed = safeJsonParse(content);
            if (!parsed.ok) {
                logger.error("LLM provider returned invalid JSON payload", {
                    content,
                });
                throw new Error("LLM provider returned invalid JSON.");
            }
            logger.info("LLM provider parsed JSON successfully");
            return parsed.data;
        }
        catch (error) {
            if (requestSignal.aborted) {
                throw createAbortError("LLM provider request aborted.");
            }
            throw error;
        }
        finally {
            cleanup();
        }
    }
    async getAgentDecision(messages, signal) {
        const parsedData = await this.getJsonResponse(messages, signal);
        if (!isAgentDecision(parsedData)) {
            logger.error("LLM provider returned invalid decision payload", {
                parsedData,
            });
            throw new Error("LLM provider returned invalid agent decision JSON.");
        }
        logger.info("LLM provider parsed decision successfully", parsedData);
        return parsedData;
    }
}
