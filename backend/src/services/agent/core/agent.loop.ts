import { appConfig } from "../../../config/env.js";
import { logger } from "../../../utils/logger.js";
import { getAgentRoleByName } from "../../agents/index.js";
import { llmService } from "../../llm/index.js";
import { executeTool } from "../../tools/index.js";
import type { ToolExecutionResult } from "../../tools/index.js";
import { buildAgentSystemPrompt } from "./agent.prompt.js";
import type { AgentDecision, AgentMessage, AgentStreamEvent, RunAgentLoopInput, RunAgentLoopResult } from "./agent.types.js";
import { getToolByName, getToolList } from "./tool-registry.js";

/**
 * 若有提供串流事件回呼，就將事件往外送出。
 *
 * @param event 要送出的 agent 事件。
 * @param onEvent 外部提供的事件回呼。
 */
const emitAgentEvent = async (
  event: AgentStreamEvent,
  onEvent?: RunAgentLoopInput["onEvent"],
): Promise<void> => {
  if (!onEvent) {
    return;
  }

  await onEvent(event);
};

/**
 * 驗證工具決策是否合法。
 *
 * @param decision LLM 返回的工具決策。
 * @param availableToolNames 目前可用的工具名稱清單。
 * @returns 決策是否合法。
 */
const validateToolDecision = (decision: AgentDecision, availableToolNames: string[]): boolean => {
  if (decision.type !== "tool_call") {
    return false;
  }

  if (!decision.toolName || typeof decision.toolName !== "string") {
    logger.error("Invalid tool name in decision", {
      toolName: decision.toolName,
      availableTools: availableToolNames,
    });
    return false;
  }

  if (!availableToolNames.includes(decision.toolName)) {
    logger.error("Tool name not available in decision", {
      toolName: decision.toolName,
      availableTools: availableToolNames,
    });
    return false;
  }

  if (!decision.toolInput || typeof decision.toolInput !== "object") {
    logger.error("Invalid tool input in decision", {
      toolName: decision.toolName,
      toolInput: decision.toolInput,
    });
    return false;
  }

  return true;
};

/**
 * 將工具執行結果包成結構化 JSON，方便模型在下一輪做多步驟推理。
 * 區分成功和失敗的情況，讓模型能理解工具為何失敗。
 *
 * @param toolName 工具名稱。
 * @param toolInput 呼叫工具時使用的輸入資料。
 * @param toolResult 工具執行後的標準化結果。
 * @returns 可加入對話上下文的結構化字串內容。
 */
const createToolContext = (
  toolName: string,
  toolInput: Record<string, unknown>,
  toolResult: ToolExecutionResult,
): string => {
  if (toolResult.ok) {
    return JSON.stringify({
      type: "tool_result",
      toolName,
      toolInput,
      output: toolResult.data,
      executionTimeMs: toolResult.meta.durationMs,
      attempts: toolResult.meta.attempts,
    });
  }

  return JSON.stringify({
    type: "tool_error",
    toolName,
    toolInput,
    errorCode: toolResult.error?.code,
    errorMessage: toolResult.error?.message,
    retriable: toolResult.error?.retriable,
    executionTimeMs: toolResult.meta.durationMs,
    attempts: toolResult.meta.attempts,
  });
};

/**
 * 執行 agent loop，直到拿到最終答案或超過最大輪數。
 *
 * @param input 本輪使用者訊息與既有歷史上下文。
 * @returns 最終答案與本輪新增訊息。
 */
export const runAgentLoop = async (input: RunAgentLoopInput): Promise<RunAgentLoopResult> => {
  const { disableTools = false, onEvent, userMessage, historyMessages = [], roleName = "primary", skillName } = input;
  const roleConfig = getAgentRoleByName(roleName);
  const tools = disableTools ? [] : getToolList(skillName, roleName);
  const maxLoops = roleConfig?.maxLoops ?? appConfig.maxAgentLoops;
  logger.info("Agent loop started", {
    disableTools,
    toolCount: tools.length,
    maxLoops,
    historyMessageCount: historyMessages.length,
    roleName,
    skillName: skillName || "default",
  });

  /**
   * generatedMessages 只保留本輪新增的訊息，之後會交回 agent.service 寫入 session 歷史。
   */
  const generatedMessages: AgentMessage[] = [
    {
      role: "user",
      content: userMessage,
    },
  ];

  /**
   * messages 是實際送給模型推理的完整上下文，包含：
   * 1. system prompt
   * 2. 歷史訊息
   * 3. 本輪使用者新訊息
   */
  const messages: AgentMessage[] = [
    {
      role: "system",
      content: buildAgentSystemPrompt(tools, roleName, skillName),
    },
    ...historyMessages,
    {
      role: "user",
      content: userMessage,
    },
  ];

  /**
   * 先把目前可用工具名稱整理出來，供每輪驗證模型回傳的 tool_call 使用。
   */
  const availableToolNames = tools.map((tool) => tool.name);

  /**
   * Agent loop 的每一輪都只做一件事：
   * 1. 問模型下一步
   * 2. 若是 final 就結束
   * 3. 若是 tool_call 就執行工具並把結果回灌
   */
  for (let attempt = 0; attempt < maxLoops; attempt += 1) {
    logger.info("Agent loop requesting decision", {
      attempt: attempt + 1,
      messageCount: messages.length,
    });
    await emitAgentEvent(
      {
        type: "decision_requested",
        attempt: attempt + 1,
        roleName,
        messageCount: messages.length,
      },
      onEvent,
    );

    const decision: AgentDecision = await llmService.askAgentDecision(messages);
    logger.info("Agent loop received decision", decision);
    await emitAgentEvent(
      {
        type: "agent_decision",
        attempt: attempt + 1,
        roleName,
        decision,
      },
      onEvent,
    );

    if (decision.type === "final") {
      generatedMessages.push({
        role: "assistant",
        content: decision.answer,
      });
      logger.info("Agent loop completed with final answer", {
        attempt: attempt + 1,
        answerPreview: decision.answer.slice(0, 120),
      });
      await emitAgentEvent(
        {
          type: "final_answer",
          attempt: attempt + 1,
          roleName,
          answer: decision.answer,
        },
        onEvent,
      );
      return {
        answer: decision.answer,
        generatedMessages,
      };
    }

    /**
     * 模型若回了不合法的 tool_call，不直接中斷流程，而是把錯誤資訊回灌給模型重新判斷。
     */
    if (!validateToolDecision(decision, availableToolNames)) {
      logger.warn("Invalid tool decision, asking model to reconsider", {
        decision,
        availableToolNames,
      });
      await emitAgentEvent(
        {
          type: "invalid_tool_decision",
          attempt: attempt + 1,
          roleName,
          decision,
          availableToolNames,
        },
        onEvent,
      );

      /**
       * 這裡同時保留 assistant 原始決策與 tool 錯誤訊息，方便：
       * 1. 下一輪模型知道剛剛哪裡出錯
       * 2. session 歷史保留完整決策軌跡
       */
      messages.push({
        role: "assistant",
        content: JSON.stringify(decision),
      });
      messages.push({
        role: "tool",
        content: JSON.stringify({
          type: "tool_error",
          message: `Invalid tool call. Available tools: ${availableToolNames.join(", ")}. Please use a valid tool name and provide a proper input object.`,
        }),
      });
      generatedMessages.push({
        role: "assistant",
        content: JSON.stringify(decision),
      });
      generatedMessages.push({
        role: "tool",
        content: "Invalid tool call format.",
      });
      continue;
    }

    const tool = getToolByName(decision.toolName);

    if (!tool) {
      logger.error("Agent loop could not find tool", {
        toolName: decision.toolName,
      });
      throw new Error(`Tool not found: ${decision.toolName}`);
    }

    /**
     * 工具執行會走共用 executor，統一處理：
     * 1. validateInput
     * 2. timeout
     * 3. retry
     * 4. 標準化結果格式
     */
    logger.info("Agent loop executing tool", {
      toolName: decision.toolName,
      toolInput: decision.toolInput,
    });
    await emitAgentEvent(
      {
        type: "tool_started",
        attempt: attempt + 1,
        roleName,
        toolName: decision.toolName,
        toolInput: decision.toolInput,
      },
      onEvent,
    );
    const toolResult = await executeTool(tool, decision.toolInput);
    logger.info("Agent loop received tool result", {
      toolName: decision.toolName,
      ok: toolResult.ok,
      toolResultPreview: JSON.stringify(toolResult).slice(0, 200),
    });
    await emitAgentEvent(
      {
        type: "tool_completed",
        attempt: attempt + 1,
        roleName,
        toolName: decision.toolName,
        result: toolResult,
      },
      onEvent,
    );

    const assistantToolCallMessage: AgentMessage = {
      role: "assistant",
      content: JSON.stringify(decision),
    };
    const toolMessage: AgentMessage = {
      role: "tool",
      toolName: decision.toolName,
      content: createToolContext(decision.toolName, decision.toolInput, toolResult),
    };

    /**
     * 同時更新兩份訊息清單：
     * 1. messages：提供下一輪模型決策使用，讓模型知道剛剛呼叫了哪個工具，以及工具回了什麼。
     * 2. generatedMessages：保留本輪新增訊息，供 agent.service 在 loop 結束後寫入 session 歷史。
     */
    messages.push(assistantToolCallMessage);
    messages.push(toolMessage);
    generatedMessages.push(assistantToolCallMessage);
    generatedMessages.push(toolMessage);

    /**
     * 如果工具已明確失敗且不適合重試，這一輪仍然會把失敗結果交回模型，
     * 讓模型自行決定是否改用其他工具、調整輸入，或直接回覆使用者。
     */
    if (!toolResult.ok && !toolResult.error?.retriable) {
      logger.warn("Tool execution failed and not retriable", {
        toolName: decision.toolName,
        errorCode: toolResult.error?.code,
        errorMessage: toolResult.error?.message,
      });
    }
  }

  logger.error("Agent loop exceeded max loop count", {
    maxLoops,
  });
  throw new Error(`Agent exceeded max loop count (${maxLoops}).`);
};
