import { logger } from "../../../utils/logger.js";
import { runAgentLoop } from "../../agent/index.js";
import type { AgentStreamEvent } from "../../agent/index.js";
import type { PlannedTask, RunOrchestrationInput, RunOrchestrationResult, TaskResult } from "./orchestrator.types.js";
import { createTaskPlan } from "./task-planner.js";
import { synthesizeTaskResults } from "./result-synthesizer.js";

/**
 * 若外部有提供串流事件回呼，就將 orchestration 過程中的事件往外送出。
 */
const emitEvent = async (
  event: AgentStreamEvent,
  onEvent?: RunOrchestrationInput["onEvent"],
): Promise<void> => {
  if (!onEvent) {
    return;
  }

  await onEvent(event);
};

/**
 * 執行單一子任務。
 *
 * 每個子任務目前都交由對應 role 的 agent loop 處理，並將前面已完成的
 * worker 結果附加在 instruction 後面，讓後續任務可以延續前文。
 */
const executeTask = async (
  task: PlannedTask,
  input: RunOrchestrationInput,
  previousResults: TaskResult[],
): Promise<TaskResult> => {
  const contextSummary = previousResults.length
    ? `\n\nPrevious worker outputs:\n${previousResults
        .map((result, index) => `${index + 1}. ${result.title}: ${result.output}`)
        .join("\n")}`
    : "";
  const loopResult = await runAgentLoop({
    userMessage: `${task.instruction}${contextSummary}`,
    historyMessages: input.historyMessages ?? [],
    skillName: input.context.skillName,
    roleName: task.role,
    onEvent: input.onEvent,
  });

  return {
    taskId: task.taskId,
    role: task.role,
    title: task.title,
    status: "completed",
    output: loopResult.answer,
  };
};

/**
 * Orchestrator service 負責 multi-agent 主流程協調。
 *
 * 主要工作包含：
 * 1. 產生 task plan
 * 2. 逐一執行 worker 子任務
 * 3. 收集子任務結果
 * 4. 交給 primary role 整合成最終答案
 */
export const orchestratorService = {
  /**
   * 執行單次 orchestration 流程。
   *
   * @param input orchestration 所需上下文、歷史訊息與事件回呼。
   * @returns 最終回覆、task plan 與子任務執行結果。
   */
  async run(input: RunOrchestrationInput): Promise<RunOrchestrationResult> {
    /**
     * 先由 planner 或 fallback planner 產出本輪任務拆解結果。
     */
    const taskPlan = await createTaskPlan({
      context: input.context,
      historyMessages: input.historyMessages,
      onEvent: input.onEvent,
    });
    logger.info("Orchestrator created task plan", {
      sessionId: input.context.sessionId,
      skillName: input.context.skillName || "default",
      taskCount: taskPlan.tasks.length,
      reason: taskPlan.reason,
      source: taskPlan.source,
    });

    await emitEvent(
      {
        type: "orchestration_started",
        sessionId: input.context.sessionId,
        taskCount: taskPlan.tasks.length,
        reason: taskPlan.reason,
        source: taskPlan.source,
        tasks: taskPlan.tasks.map((task) => ({
          taskId: task.taskId,
          title: task.title,
          instruction: task.instruction,
          role: task.role,
        })),
      },
      input.onEvent,
    );

    /**
     * 依照 task plan 順序執行子任務。
     * v1.1 先採序列執行，讓前一個 worker 的結果可以成為下一個 worker 的上下文。
     */
    const taskResults: TaskResult[] = [];

    for (const task of taskPlan.tasks) {
      await emitEvent(
        {
          type: "subtask_started",
          sessionId: input.context.sessionId,
          taskId: task.taskId,
          title: task.title,
          role: task.role,
        },
        input.onEvent,
      );

      try {
        const taskResult = await executeTask(task, input, taskResults);
        taskResults.push(taskResult);
        await emitEvent(
          {
            type: "subtask_completed",
            sessionId: input.context.sessionId,
            taskId: task.taskId,
            title: task.title,
            role: task.role,
            output: taskResult.output,
          },
          input.onEvent,
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Subtask execution failed";
        logger.error("Orchestrator subtask failed", {
          taskId: task.taskId,
          title: task.title,
          error: errorMessage,
        });
        taskResults.push({
          taskId: task.taskId,
          role: task.role,
          title: task.title,
          status: "failed",
          output: errorMessage,
        });
        await emitEvent(
          {
            type: "subtask_failed",
            sessionId: input.context.sessionId,
            taskId: task.taskId,
            title: task.title,
            role: task.role,
            error: errorMessage,
          },
          input.onEvent,
        );
      }
    }

    /**
     * 全部子任務完成後，交由 synthesizer 整理成最終使用者回覆。
     */
    const synthesis = await synthesizeTaskResults({
      context: input.context,
      taskResults,
      historyMessages: input.historyMessages,
      onEvent: input.onEvent,
    });
    await emitEvent(
      {
        type: "orchestration_completed",
        sessionId: input.context.sessionId,
        taskCount: taskPlan.tasks.length,
        completedTaskCount: taskResults.filter((result) => result.status === "completed").length,
      },
      input.onEvent,
    );

    /**
     * 將 orchestration 過程中產出的核心資料一併回傳，供外層 service
     * 持久化與後續 debug / timeline 顯示使用。
     */
    return {
      reply: synthesis.reply,
      generatedMessages: synthesis.generatedMessages,
      taskPlan,
      taskResults,
    };
  },
};
