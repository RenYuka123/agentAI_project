import { throwIfAborted } from "../../../utils/abort.js";
import { logger } from "../../../utils/logger.js";
import { runAgentLoop } from "../../agent/index.js";
import type { AgentStreamEvent } from "../../agent/index.js";
import type { PlannedTask, RunOrchestrationInput, RunOrchestrationResult, TaskResult } from "./orchestrator.types.js";
import { createFallbackTaskPlan, createTaskPlan } from "./task-planner.js";
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
 * 檢查 task dependency 是否合法，並依賴關係產生穩定的執行順序。
 */
const resolveExecutionOrder = (tasks: PlannedTask[]): PlannedTask[] => {
  const taskMap = new Map(tasks.map((task) => [task.taskId, task]));
  const missingDependencies = tasks.flatMap((task) =>
    (task.dependsOn ?? [])
      .filter((dependencyId) => !taskMap.has(dependencyId))
      .map((dependencyId) => `${task.taskId} -> ${dependencyId}`),
  );

  if (missingDependencies.length > 0) {
    throw new Error(`Task plan contains unknown dependencies: ${missingDependencies.join(", ")}`);
  }

  const inDegree = new Map<string, number>();
  const dependentMap = new Map<string, string[]>();

  for (const task of tasks) {
    const dependencies = task.dependsOn ?? [];
    inDegree.set(task.taskId, dependencies.length);

    for (const dependencyId of dependencies) {
      const dependentTaskIds = dependentMap.get(dependencyId) ?? [];
      dependentTaskIds.push(task.taskId);
      dependentMap.set(dependencyId, dependentTaskIds);
    }
  }

  const queue = tasks.filter((task) => (inDegree.get(task.taskId) ?? 0) === 0);
  const orderedTasks: PlannedTask[] = [];

  while (queue.length > 0) {
    const currentTask = queue.shift();

    if (!currentTask) {
      continue;
    }

    orderedTasks.push(currentTask);

    for (const dependentTaskId of dependentMap.get(currentTask.taskId) ?? []) {
      const nextInDegree = (inDegree.get(dependentTaskId) ?? 0) - 1;
      inDegree.set(dependentTaskId, nextInDegree);

      if (nextInDegree === 0) {
        const dependentTask = taskMap.get(dependentTaskId);
        if (dependentTask) {
          queue.push(dependentTask);
        }
      }
    }
  }

  if (orderedTasks.length !== tasks.length) {
    throw new Error("Task plan contains circular dependencies.");
  }

  return orderedTasks;
};

/**
 * 根據 task dependency 取出本任務可用的前置結果。
 */
const getDependencyResults = (task: PlannedTask, taskResults: TaskResult[]): TaskResult[] => {
  const dependencyIds = task.dependsOn ?? [];

  if (!dependencyIds.length) {
    return [];
  }

  return dependencyIds
    .map((dependencyId) => taskResults.find((result) => result.taskId === dependencyId))
    .filter((result): result is TaskResult => Boolean(result));
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
  dependencyResults: TaskResult[],
): Promise<TaskResult> => {
  throwIfAborted(input.signal, `Subtask ${task.taskId} aborted before execution.`);

  const contextSummary = dependencyResults.length
    ? `\n\nDependency outputs:\n${dependencyResults
        .map((result, index) => `${index + 1}. ${result.title}: ${result.output}`)
        .join("\n")}`
    : "";
  const loopResult = await runAgentLoop({
    userMessage: `${task.instruction}${contextSummary}`,
    historyMessages: input.historyMessages ?? [],
    skillName: input.context.skillName,
    roleName: task.role,
    onEvent: input.onEvent,
    signal: input.signal,
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
    throwIfAborted(input.signal, "Orchestration aborted before task planning.");

    /**
     * 先由 planner 或 fallback planner 產出本輪任務拆解結果。
     */
    const taskPlan = await createTaskPlan({
      context: input.context,
      historyMessages: input.historyMessages,
      onEvent: input.onEvent,
      signal: input.signal,
    });
    logger.info("Orchestrator created task plan", {
      sessionId: input.context.sessionId,
      skillName: input.context.skillName || "default",
      taskCount: taskPlan.tasks.length,
      reason: taskPlan.reason,
      source: taskPlan.source,
      taskDependencies: taskPlan.tasks.map((task) => ({
        taskId: task.taskId,
        dependsOn: task.dependsOn ?? [],
      })),
    });

    let effectiveTaskPlan = taskPlan;
    let orderedTasks = taskPlan.tasks;

    try {
      orderedTasks = resolveExecutionOrder(taskPlan.tasks);
    } catch (error) {
      logger.warn("Invalid task dependencies detected, rebuilding fallback task plan", {
        sessionId: input.context.sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
      effectiveTaskPlan = createFallbackTaskPlan(input.context);
      orderedTasks = effectiveTaskPlan.tasks;
    }

    await emitEvent(
      {
        type: "orchestration_started",
        sessionId: input.context.sessionId,
        taskCount: effectiveTaskPlan.tasks.length,
        reason: effectiveTaskPlan.reason,
        source: effectiveTaskPlan.source,
        tasks: effectiveTaskPlan.tasks.map((task) => ({
          taskId: task.taskId,
          title: task.title,
          instruction: task.instruction,
          role: task.role,
          dependsOn: task.dependsOn,
        })),
      },
      input.onEvent,
    );

    /**
     * 依照 task plan 順序執行子任務。
     * v1.1 先採序列執行，讓前一個 worker 的結果可以成為下一個 worker 的上下文。
     */
    const taskResults: TaskResult[] = [];

    for (const task of orderedTasks) {
      throwIfAborted(input.signal, "Orchestration aborted during task execution.");
      const dependencyResults = getDependencyResults(task, taskResults);
      const failedDependencies = dependencyResults.filter((result) => result.status !== "completed");

      if (failedDependencies.length > 0) {
        const errorMessage = `Blocked by failed dependencies: ${failedDependencies
          .map((result) => result.taskId)
          .join(", ")}`;
        logger.warn("Orchestrator skipped task due to failed dependencies", {
          taskId: task.taskId,
          dependsOn: task.dependsOn ?? [],
          failedDependencies: failedDependencies.map((result) => result.taskId),
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
            dependsOn: task.dependsOn,
            error: errorMessage,
          },
          input.onEvent,
        );
        continue;
      }

      await emitEvent(
        {
          type: "subtask_started",
          sessionId: input.context.sessionId,
          taskId: task.taskId,
          title: task.title,
          role: task.role,
          dependsOn: task.dependsOn,
        },
        input.onEvent,
      );

      try {
        const taskResult = await executeTask(task, input, dependencyResults);
        taskResults.push(taskResult);
        await emitEvent(
          {
            type: "subtask_completed",
            sessionId: input.context.sessionId,
            taskId: task.taskId,
            title: task.title,
            role: task.role,
            dependsOn: task.dependsOn,
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
            dependsOn: task.dependsOn,
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
      signal: input.signal,
    });
    await emitEvent(
      {
        type: "orchestration_completed",
        sessionId: input.context.sessionId,
        taskCount: effectiveTaskPlan.tasks.length,
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
      taskPlan: effectiveTaskPlan,
      taskResults,
    };
  },
};
