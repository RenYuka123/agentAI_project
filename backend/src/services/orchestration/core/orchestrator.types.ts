import type { AgentMessage, AgentStreamEventHandler } from "../../agent/index.js";
import type { AgentRoleName } from "../../agents/index.js";

export interface OrchestrationContext {
  /** 本輪對話所屬 session。 */
  sessionId: string;
  /** 使用者原始訊息。 */
  userMessage: string;
  /** 本輪解析出的 skill。 */
  skillName?: string;
}

export interface OrchestrationAssessmentSignals {
  /** 正規化後的訊息長度。 */
  messageLength: number;
  /** 命中的多步驟連接詞數量。 */
  connectorCount: number;
  /** 命中的任務意圖數量。 */
  intentCount: number;
  /** 是否命中明顯多步驟 cue。 */
  hasExplicitMultiStepCue: boolean;
  /** 是否看起來在延續先前步驟。 */
  hasFollowUpLanguage: boolean;
  /** 是否命中特定 skill。 */
  matchedSkillName?: string;
}

export interface OrchestrationAssessment {
  /** 最終是否進入 orchestration。 */
  shouldOrchestrate: boolean;
  /** 評分結果。 */
  score: number;
  /** 本輪採用的 routing 策略。 */
  strategy: "single_agent" | "sequential_multi_agent";
  /** 判斷信心。 */
  confidence: "low" | "medium" | "high";
  /** 判斷來源。 */
  source: "rule" | "hybrid_llm";
  /** 判斷原因。 */
  reasons: string[];
  /** 用來計算分數的原始訊號。 */
  signals: OrchestrationAssessmentSignals;
}

export interface PlannedTask {
  /** 任務唯一識別值。 */
  taskId: string;
  /** 子任務標題。 */
  title: string;
  /** 要交給 worker 的具體指令。 */
  instruction: string;
  /** 負責此任務的角色。 */
  role: AgentRoleName;
}

export interface TaskPlan {
  /** 規劃出的任務清單。 */
  tasks: PlannedTask[];
  /** 為何需要拆任務。 */
  reason: string;
  /** 規劃來源。 */
  source: "llm" | "fallback";
}

export interface TaskResult {
  /** 對應的子任務 id。 */
  taskId: string;
  /** 實際執行角色。 */
  role: AgentRoleName;
  /** 任務標題。 */
  title: string;
  /** 任務狀態。 */
  status: "completed" | "failed";
  /** Worker 最終輸出。 */
  output: string;
}

export interface RunOrchestrationInput {
  /** 協作上下文。 */
  context: OrchestrationContext;
  /** 本輪既有歷史。 */
  historyMessages?: AgentMessage[];
  /** 流式事件回呼。 */
  onEvent?: AgentStreamEventHandler;
}

export interface RunOrchestrationResult {
  /** 對外最終回覆。 */
  reply: string;
  /** 建議寫入 session 的訊息。 */
  generatedMessages: AgentMessage[];
  /** 實際任務規劃。 */
  taskPlan: TaskPlan;
  /** 子任務結果。 */
  taskResults: TaskResult[];
}
