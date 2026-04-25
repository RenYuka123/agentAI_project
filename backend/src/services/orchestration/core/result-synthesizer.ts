import { logger } from "../../../utils/logger.js";
import { runAgentLoop } from "../../agent/index.js";
import type { AgentMessage, AgentStreamEventHandler } from "../../agent/index.js";
import type { OrchestrationContext, TaskResult } from "./orchestrator.types.js";

/**
 * 規則式 fallback synthesis。
 *
 * 當 primary role 無法穩定整合子任務結果時，至少能把已完成的輸出整理成
 * 一段可回給使用者的回覆，並明確標記失敗的子任務數量。
 */
const createFallbackReply = (taskResults: TaskResult[]): string => {
  const successfulResults = taskResults.filter((result) => result.status === "completed");
  const failedResults = taskResults.filter((result) => result.status === "failed");
  const successfulDigest = successfulResults.map((result) => result.output.trim()).filter(Boolean).join("\n\n");

  return (
    failedResults.length > 0
      ? [
          successfulDigest || "部分子任務已完成。",
          `有 ${failedResults.length} 個子任務失敗，若需要我可以再針對失敗部分重試或改寫策略。`,
        ]
          .filter(Boolean)
          .join("\n\n")
      : successfulDigest || "已完成多步驟處理，但目前沒有可整理的輸出。"
  );
};

/**
 * 組出 primary role 做最終整合時的 prompt。
 *
 * 這裡會把原始需求與所有 worker 結果一併提供，讓 primary 專注於整理最終答案，
 * 而不是重新規劃或再次執行工具。
 */
const buildSynthesizerPrompt = (context: OrchestrationContext, taskResults: TaskResult[]): string =>
  [
    "Please synthesize the worker results into one final answer for the user.",
    "Do not mention internal orchestration unless it helps the user.",
    `Original request: ${context.userMessage}`,
    `Skill: ${context.skillName || "default"}`,
    "Worker results:",
    ...taskResults.map(
      (result, index) =>
        `${index + 1}. ${result.title} (${result.status})\n${result.output}`,
    ),
  ].join("\n\n");

/**
 * v1.1 優先由 primary role 整合 worker 結果，失敗時退回規則式 fallback。
 */
export const synthesizeTaskResults = async (input: {
  context: OrchestrationContext;
  taskResults: TaskResult[];
  historyMessages?: AgentMessage[];
  onEvent?: AgentStreamEventHandler;
}): Promise<{ reply: string; generatedMessages: { role: "user" | "assistant"; content: string }[] }> => {
  const { context, historyMessages = [], onEvent, taskResults } = input;
  let reply = "";

  /**
   * 優先由 primary role 做最終整合。
   * 這一輪禁用工具，讓它只專心消化 worker 的結果並產出使用者可讀的答案。
   */
  try {
    const synthesisResult = await runAgentLoop({
      userMessage: buildSynthesizerPrompt(context, taskResults),
      historyMessages,
      skillName: context.skillName,
      roleName: "primary",
      disableTools: true,
      onEvent,
    });
    reply = synthesisResult.answer.trim();
  } catch (error) {
    logger.warn("Primary synthesis failed, using fallback", {
      sessionId: context.sessionId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  /**
   * 若 primary 沒有成功產出可用答案，再退回規則式 fallback。
   */
  if (!reply) {
    reply = createFallbackReply(taskResults);
  }

  /**
   * 不論最終答案來自 primary 或 fallback，這裡都統一整理成可持久化的訊息格式。
   */
  return {
    reply,
    generatedMessages: [
      {
        role: "user",
        content: context.userMessage,
      },
      {
        role: "assistant",
        content: reply,
      },
    ],
  };
};
