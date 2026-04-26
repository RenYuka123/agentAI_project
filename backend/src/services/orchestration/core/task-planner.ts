import { throwIfAborted } from "../../../utils/abort.js";
import { runAgentLoop } from "../../agent/index.js";
import { llmService } from "../../llm/index.js";
import { safeJsonParse } from "../../../utils/safe-json.js";
import { logger } from "../../../utils/logger.js";
import type { AgentMessage, AgentStreamEventHandler } from "../../agent/index.js";
import type {
  OrchestrationAssessment,
  OrchestrationContext,
  PlannedTask,
  TaskPlan,
} from "./orchestrator.types.js";

const connectorPattern = /(先|再|然後|並且|同時|接著|之後|最後|順便)/g;
const dependencyCuePattern = /(先|再|然後|接著|之後|最後|順便)/g;
const parallelCuePattern = /(並且|同時|以及|與|和)/g;
const followUpPattern = /(順便|另外|也|再|接著|然後|補充)/;

/**
 * 粗略判斷訊息中是否同時包含多種任務意圖。
 */
const intentKeywords = ["查", "計算", "算", "整理", "摘要", "比較", "分析"];

const countMatches = (message: string, pattern: RegExp): number => {
  const matches = message.match(pattern);
  return matches ? matches.length : 0;
};

/**
 * 在 gate 階段先粗略估計這個需求的 dependsOn 形狀。
 *
 * 這不是正式 task plan，只是用語句中的依序 / 並列 cue
 * 估計它比較像線性 dependency chain，還是較值得拆分的多任務需求。
 */
const estimateDependencyShape = (normalizedMessage: string, intentCount: number) => {
  const dependencyCueCount = countMatches(normalizedMessage, dependencyCuePattern);
  const parallelCueCount = countMatches(normalizedMessage, parallelCuePattern);
  const estimatedTaskCount = Math.max(
    1,
    Math.min(3, Math.max(intentCount, dependencyCueCount + parallelCueCount + 1)),
  );
  const estimatedDependencyDepth = Math.max(
    1,
    Math.min(3, dependencyCueCount + (parallelCueCount > 0 ? 1 : 0) + 1),
  );
  const isDependencyChainLikely =
    dependencyCueCount >= Math.max(1, parallelCueCount) && estimatedDependencyDepth >= 2;

  return {
    dependencyCueCount,
    parallelCueCount,
    estimatedTaskCount,
    estimatedDependencyDepth,
    isDependencyChainLikely,
  };
};

const createRuleBasedAssessment = (context: OrchestrationContext): OrchestrationAssessment => {
  const normalizedMessage = context.userMessage.replace(/\s+/g, "");
  const connectorCount = countMatches(normalizedMessage, connectorPattern);
  const intentCount = intentKeywords.filter((keyword) => normalizedMessage.includes(keyword)).length;
  const dependencyShape = estimateDependencyShape(normalizedMessage, intentCount);
  const hasExplicitMultiStepCue = connectorCount > 0;
  const hasFollowUpLanguage = followUpPattern.test(normalizedMessage);
  let score = 0;
  const reasons: string[] = [];

  if (normalizedMessage.length >= 8) {
    score += 1;
    reasons.push(`訊息長度達 ${normalizedMessage.length}，高於多步驟判斷最低門檻。`);
  } else {
    reasons.push(`訊息長度只有 ${normalizedMessage.length}，偏向單一步驟處理。`);
  }

  if (connectorCount > 0) {
    score += 2;
    reasons.push(`命中 ${connectorCount} 個多步驟連接詞，顯示需求可能需要拆解。`);
  }

  if (intentCount >= 2) {
    score += 2;
    reasons.push(`同時命中 ${intentCount} 個任務意圖，可能包含多段工作。`);
  } else if (intentCount === 1) {
    reasons.push("目前只命中單一主要任務意圖。");
  }

  if (dependencyShape.estimatedTaskCount >= 2 && !dependencyShape.isDependencyChainLikely) {
    score += 1;
    reasons.push(`預估可拆成 ${dependencyShape.estimatedTaskCount} 段任務。`);
  } else if (dependencyShape.estimatedTaskCount >= 2) {
    reasons.push(`雖然預估有 ${dependencyShape.estimatedTaskCount} 段任務，但它們看起來偏向線性依賴。`);
  }

  if (hasFollowUpLanguage) {
    score += 1;
    reasons.push("訊息帶有延續或補充語氣。");
  }

  if (dependencyShape.parallelCueCount > 0) {
    score += 1;
    reasons.push(`命中 ${dependencyShape.parallelCueCount} 個並列 cue，拆分處理的收益較高。`);
  }

  if (dependencyShape.isDependencyChainLikely) {
    score -= dependencyShape.parallelCueCount > 0 ? 1 : 2;
    reasons.push(
      `依賴 cue 偏強，預估 dependency 深度約 ${dependencyShape.estimatedDependencyDepth}，較像線性串接流程。`,
    );
  }

  if (context.skillName && context.skillName !== "default") {
    score += 1;
    reasons.push(`已命中特定 skill：${context.skillName}。`);
  }

  const shouldOrchestrate = score >= 4;
  const confidence = score >= 5 ? "high" : score >= 3 ? "medium" : "low";

  return {
    shouldOrchestrate,
    score,
    strategy: shouldOrchestrate ? "sequential_multi_agent" : "single_agent",
    confidence,
    source: "rule",
    reasons,
    signals: {
      messageLength: normalizedMessage.length,
      connectorCount,
      dependencyCueCount: dependencyShape.dependencyCueCount,
      parallelCueCount: dependencyShape.parallelCueCount,
      intentCount,
      estimatedTaskCount: dependencyShape.estimatedTaskCount,
      estimatedDependencyDepth: dependencyShape.estimatedDependencyDepth,
      isDependencyChainLikely: dependencyShape.isDependencyChainLikely,
      hasExplicitMultiStepCue,
      hasFollowUpLanguage,
      matchedSkillName: context.skillName,
    },
  };
};

const isOrchestrationAssessment = (value: unknown): value is OrchestrationAssessment => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<OrchestrationAssessment>;
  return (
    typeof candidate.shouldOrchestrate === "boolean" &&
    typeof candidate.score === "number" &&
    (candidate.strategy === "single_agent" || candidate.strategy === "sequential_multi_agent") &&
    (candidate.confidence === "low" || candidate.confidence === "medium" || candidate.confidence === "high") &&
    (candidate.source === "rule" || candidate.source === "hybrid_llm") &&
    Array.isArray(candidate.reasons) &&
    typeof candidate.signals === "object" &&
    candidate.signals !== null
  );
};

const buildRouterMessages = (context: OrchestrationContext, ruleAssessment: OrchestrationAssessment): AgentMessage[] => [
  {
    role: "system",
    content: [
      "You are an orchestration router.",
      "Decide whether the user request should stay in a single agent flow or be upgraded to sequential multi-agent orchestration.",
      "Return valid JSON only with this shape:",
      '{"shouldOrchestrate":true,"score":0,"strategy":"sequential_multi_agent","confidence":"medium","source":"hybrid_llm","reasons":["..."],"signals":{"messageLength":0,"connectorCount":0,"dependencyCueCount":0,"parallelCueCount":0,"intentCount":0,"estimatedTaskCount":0,"estimatedDependencyDepth":0,"isDependencyChainLikely":false,"hasExplicitMultiStepCue":false,"hasFollowUpLanguage":false,"matchedSkillName":"optional"}}',
      "Keep the original numeric signals unchanged.",
      "If dependency cues suggest a mostly linear chain, be more conservative about orchestration cost.",
      "If there are multiple likely tasks with weaker coupling or parallel cues, orchestration becomes more worthwhile.",
      "You may revise shouldOrchestrate, score, strategy, confidence, and reasons based on semantic judgment.",
    ].join("\n\n"),
  },
  {
    role: "user",
    content: [
      `User request: ${context.userMessage}`,
      `Skill: ${context.skillName || "default"}`,
      `Rule assessment: ${JSON.stringify(ruleAssessment)}`,
      "Decide whether orchestration is worth the added complexity and cost.",
    ].join("\n\n"),
  },
];

/**
 * orchestration gate v1.5 / v2。
 *
 * 先用規則式 scoring 產生 assessment，對高低分案例直接決策；
 * 若落在模糊區，則再交給 LLM router 做 hybrid 判斷。
 */
export const assessOrchestration = async (input: {
  context: OrchestrationContext;
  signal?: AbortSignal;
}): Promise<OrchestrationAssessment> => {
  const { signal } = input;
  const ruleAssessment = createRuleBasedAssessment(input.context);
  const { score } = ruleAssessment;

  if (score <= 2 || score >= 5) {
    return ruleAssessment;
  }

  try {
    const llmAssessment = await llmService.askJson<OrchestrationAssessment>({
      messages: buildRouterMessages(input.context, ruleAssessment),
      validate: isOrchestrationAssessment,
      fallback: () => ruleAssessment,
      signal,
    });

    return {
      ...llmAssessment,
      source: "hybrid_llm",
      signals: ruleAssessment.signals,
    };
  } catch (error) {
    logger.warn("Hybrid orchestration router failed, using rule assessment", {
      sessionId: input.context.sessionId,
      error: error instanceof Error ? error.message : String(error),
      score: ruleAssessment.score,
    });
    return ruleAssessment;
  }
};

/**
 * 建立標準化的 worker 子任務資料。
 */
const buildTask = (
  taskId: string,
  title: string,
  instruction: string,
  dependsOn: string[] = [],
): PlannedTask => ({
  taskId,
  title,
  instruction,
  role: "worker",
  dependsOn,
});

/**
 * 將 planner 產生的 taskId 整理成穩定且可讀的短 id。
 */
const normalizeTaskId = (value: string, index: number): string => {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || `task-${index + 1}`;
};

/**
 * 驗證未知資料是否符合單一 PlannedTask 結構。
 */
const isPlannedTask = (value: unknown): value is PlannedTask => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<PlannedTask>;
  return (
    typeof candidate.taskId === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.instruction === "string" &&
    (candidate.dependsOn === undefined ||
      (Array.isArray(candidate.dependsOn) && candidate.dependsOn.every((dependency) => typeof dependency === "string"))) &&
    candidate.role === "worker"
  );
};

/**
 * 清理並驗證 planner 回傳的 task plan。
 *
 * 這裡會限制最多 3 個任務、標準化 taskId，並濾掉不完整的 task，
 * 避免不穩定的模型輸出直接污染 orchestration 主流程。
 */
export const sanitizeTaskPlan = (value: unknown): TaskPlan | undefined => {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const candidate = value as Partial<TaskPlan> & { tasks?: unknown[] };
  if (!Array.isArray(candidate.tasks) || typeof candidate.reason !== "string") {
    return undefined;
  }

  const rawTasks = candidate.tasks.filter(isPlannedTask).slice(0, 3);
  const normalizedTaskIds = rawTasks.map((task, index) => normalizeTaskId(task.taskId, index));
  const validTaskIds = new Set(normalizedTaskIds);

  // 只要 planner 產出的 dependency 參考了未知 taskId，就視為整份 task plan 不可靠。
  const hasInvalidDependencyReference = rawTasks.some((task, index) => {
    const taskId = normalizedTaskIds[index];

    return (task.dependsOn ?? []).some((dependency, dependencyIndex) => {
      const normalizedDependency = normalizeTaskId(dependency, dependencyIndex);
      return normalizedDependency === taskId || !validTaskIds.has(normalizedDependency);
    });
  });

  if (hasInvalidDependencyReference) {
    return undefined;
  }

  const tasks = rawTasks
    .map((task, index) => {
      const taskId = normalizedTaskIds[index];
      const dependsOn = Array.from(
        new Set(
          (task.dependsOn ?? [])
            .map((dependency, dependencyIndex) => normalizeTaskId(dependency, dependencyIndex))
            .filter((dependency) => dependency !== taskId && validTaskIds.has(dependency)),
        ),
      );

      return {
        taskId,
        title: task.title.trim() || `子任務 ${index + 1}`,
        instruction: task.instruction.trim(),
        role: "worker" as const,
        dependsOn,
      };
    })
    .filter((task) => task.instruction.length > 0);

  if (!tasks.length) {
    return undefined;
  }

  return {
    tasks,
    reason: candidate.reason,
    source: "llm",
  };
};

/**
 * 規則式 fallback planner。
 *
 * 當 planner role 無法穩定產生合法 task plan 時，仍能依 skill 與訊息內容
 * 產出最低可用的多步驟拆解結果，確保 orchestration 可以繼續進行。
 */
export const createFallbackTaskPlan = (context: OrchestrationContext): TaskPlan => {
  const { skillName, userMessage } = context;
  const tasks: PlannedTask[] = [];
  const normalizedMessage = userMessage.trim();

  if (skillName === "investment_analysis") {
    tasks.push(
      buildTask(
        "collect-data",
        "蒐集投資資料",
        `針對這個投資請求先蒐集必要資料與數值，只回答與資料蒐集和必要計算直接相關的內容：${normalizedMessage}`,
      ),
    );
    tasks.push(
      buildTask(
        "summarize-analysis",
        "整理投資分析",
        `根據前一個子任務的資料，整理成簡潔的投資分析重點。如果缺乏資料，就明確指出限制。原始需求：${normalizedMessage}`,
        ["collect-data"],
      ),
    );
  } else if (skillName === "weather_summary") {
    tasks.push(
      buildTask(
        "collect-weather",
        "蒐集天氣資料",
        `先取得完成這個天氣需求所需的資訊，只回答天氣事實與條件：${normalizedMessage}`,
      ),
    );
    tasks.push(
      buildTask(
        "summarize-weather",
        "整理天氣建議",
        `根據前一個子任務的天氣結果，整理成自然語言摘要與生活提醒。原始需求：${normalizedMessage}`,
        ["collect-weather"],
      ),
    );
  } else {
    tasks.push(
      buildTask(
        "analyze-request",
        "處理前半段需求",
        `先完成這個需求中最前面的核心步驟，必要時使用工具，但只回答這一步的結果：${normalizedMessage}`,
      ),
    );
    tasks.push(
      buildTask(
        "compose-answer",
        "整理後半段需求",
        `根據前一個子任務結果，繼續完成剩餘需求並補上整體整理。原始需求：${normalizedMessage}`,
        ["analyze-request"],
      ),
    );
  }

  return {
    tasks,
    reason: `訊息包含多步驟意圖，採用 ${tasks.length} 個 worker 子任務處理。`,
    source: "fallback",
  };
};

/**
 * 組出 planner role 的輸入 prompt，要求它只回 task plan JSON。
 */
const buildPlannerPrompt = (context: OrchestrationContext): string =>
  [
    "Please create a task plan for this user request.",
    "The final answer must be a JSON object string matching the required task plan shape.",
    'Each task must follow this shape: {"taskId":"...","title":"...","instruction":"...","role":"worker","dependsOn":["optional-task-id"]}.',
    "Use dependsOn to express task dependencies. Use an empty array when a task has no prerequisite.",
    "Only reference taskIds that exist in the same task plan.",
    `User request: ${context.userMessage}`,
    `Skill: ${context.skillName || "default"}`,
  ].join("\n\n");

/**
 * v1.1 優先使用 planner role 生成 task plan，失敗時退回規則式 fallback。
 */
export const createTaskPlan = async (input: {
  context: OrchestrationContext;
  historyMessages?: AgentMessage[];
  onEvent?: AgentStreamEventHandler;
  signal?: AbortSignal;
}): Promise<TaskPlan> => {
  const { context, historyMessages = [], onEvent, signal } = input;
  throwIfAborted(signal, "Task planning aborted before planner execution.");

  /**
   * 先嘗試由 planner role 產出 task plan。
   * planner 不允許使用工具，只負責做任務拆解。
   */
  try {
    const plannerResult = await runAgentLoop({
      userMessage: buildPlannerPrompt(context),
      historyMessages,
      roleName: "planner",
      disableTools: true,
      onEvent,
      signal,
    });
    const parsed = safeJsonParse(plannerResult.answer);
    const taskPlan = parsed.ok ? sanitizeTaskPlan(parsed.data) : undefined;

    if (taskPlan) {
      return taskPlan;
    }

    /**
     * 若 planner 有回覆但格式不合法，記錄下來並退回 fallback planner。
     */
    logger.warn("Planner returned invalid task plan, using fallback", {
      sessionId: context.sessionId,
      plannerAnswer: plannerResult.answer,
    });
  } catch (error) {
    /**
     * 若 planner role 本身執行失敗，也不要中斷整體流程，直接改走 fallback。
     */
    logger.warn("Planner role failed, using fallback", {
      sessionId: context.sessionId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return createFallbackTaskPlan(context);
};
