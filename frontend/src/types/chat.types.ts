import type { ApiErrorResponse } from "./api.types";

/**
 * 聊天訊息可使用的角色類型。
 */
export type ChatMessageRole = "assistant" | "user" | "system";

/**
 * 前端可切換的 skill 名稱。
 */
export type ChatSkillName = "default" | "investment_analysis" | "weather_summary";

/**
 * 前端聊天畫面使用的訊息格式。
 */
export interface ChatMessage {
  /** 訊息唯一識別值。 */
  id: string;
  /** 訊息角色。 */
  role: ChatMessageRole;
  /** 訊息內容。 */
  content: string;
  /** 訊息建立時間。 */
  createdAt?: string;
}

/**
 * 後端 chat API 的回傳格式。
 */
export interface ChatApiResponse extends ApiErrorResponse {
  /** 本次對話對應的 session 識別值。 */
  sessionId: string;
  /** 本輪實際採用的 skill。 */
  skillName: string;
  /** Agent 回覆內容。 */
  reply: string;
}

/**
 * 讀取 session 歷史訊息的 API 回傳格式。
 */
export interface SessionMessagesApiResponse extends ApiErrorResponse {
  /** 本次讀取的 session 識別值。 */
  sessionId: string;
  /** 已整理好的歷史訊息列表。 */
  messages: ChatMessage[];
}

/**
 * 前端送往 chat API 的請求格式。
 */
export interface AgentChatRequest {
  /** 既有會話識別值，未提供時由後端建立。 */
  sessionId?: string;
  /** 本輪指定要使用的 skill；未提供時由後端自動判斷。 */
  skillName?: string;
  /** 使用者輸入訊息。 */
  message: string;
}

/**
 * 前端顯示 Agent Timeline 用的事件格式。
 */
export type AgentStreamEvent =
  | {
      type: "skill_selected";
      sessionId: string;
      skillName: string;
      source: "auto" | "manual" | "default";
      reason: string;
    }
  | {
      type: "orchestration_assessed";
      sessionId: string;
      assessment: {
        shouldOrchestrate: boolean;
        score: number;
        strategy: "single_agent" | "sequential_multi_agent";
        confidence: "low" | "medium" | "high";
        source: "rule" | "hybrid_llm";
        reasons: string[];
        signals: {
          messageLength: number;
          connectorCount: number;
          dependencyCueCount: number;
          parallelCueCount: number;
          intentCount: number;
          estimatedTaskCount: number;
          estimatedDependencyDepth: number;
          isDependencyChainLikely: boolean;
          hasExplicitMultiStepCue: boolean;
          hasFollowUpLanguage: boolean;
          matchedSkillName?: string;
        };
      };
    }
  | {
      type: "orchestration_started";
      sessionId: string;
      taskCount: number;
      reason: string;
      source: "llm" | "fallback";
      tasks: Array<{
        taskId: string;
        title: string;
        instruction: string;
        role: "primary" | "planner" | "worker";
        dependsOn?: string[];
      }>;
    }
  | {
      type: "subtask_started";
      sessionId: string;
      taskId: string;
      title: string;
      role: "primary" | "planner" | "worker";
      dependsOn?: string[];
    }
  | {
      type: "subtask_completed";
      sessionId: string;
      taskId: string;
      title: string;
      role: "primary" | "planner" | "worker";
      dependsOn?: string[];
      output: string;
    }
  | {
      type: "subtask_failed";
      sessionId: string;
      taskId: string;
      title: string;
      role: "primary" | "planner" | "worker";
      dependsOn?: string[];
      error: string;
    }
  | {
      type: "orchestration_completed";
      sessionId: string;
      taskCount: number;
      completedTaskCount: number;
    }
  | {
      type: "session_started";
      sessionId: string;
      skillName: string;
      roleName: "primary" | "planner" | "worker";
      historyMessageCount: number;
    }
  | {
      type: "decision_requested";
      attempt: number;
      roleName: "primary" | "planner" | "worker";
      messageCount: number;
    }
  | {
      type: "agent_decision";
      attempt: number;
      roleName: "primary" | "planner" | "worker";
      decision: {
        type: "final";
        answer: string;
      } | {
        type: "tool_call";
        toolName: string;
        toolInput: Record<string, unknown>;
      };
    }
  | {
      type: "invalid_tool_decision";
      attempt: number;
      roleName: "primary" | "planner" | "worker";
      decision: {
        type: "final";
        answer: string;
      } | {
        type: "tool_call";
        toolName: string;
        toolInput: Record<string, unknown>;
      };
      availableToolNames: string[];
    }
  | {
      type: "tool_started";
      attempt: number;
      roleName: "primary" | "planner" | "worker";
      toolName: string;
      toolInput: Record<string, unknown>;
    }
  | {
      type: "tool_completed";
      attempt: number;
      roleName: "primary" | "planner" | "worker";
      toolName: string;
      result: {
        ok: boolean;
        toolName: string;
        error?: {
          code: string;
          message: string;
          retriable: boolean;
        };
        meta: {
          durationMs: number;
          attempts: number;
          retried: boolean;
        };
      };
    }
  | {
      type: "final_answer";
      attempt: number;
      roleName: "primary" | "planner" | "worker";
      answer: string;
    }
  | {
      type: "done";
      sessionId: string;
    }
  | {
      type: "error";
      message: string;
    };

/**
 * 前端 Timeline 單筆項目格式。
 */
export interface ChatTimelineEntry {
  /** Timeline 唯一識別值。 */
  id: string;
  /** 事件類型。 */
  type: AgentStreamEvent["type"];
  /** 主要標題。 */
  title: string;
  /** 補充說明。 */
  detail?: string;
  /** 顯示狀態。 */
  status: "info" | "success" | "error";
}
