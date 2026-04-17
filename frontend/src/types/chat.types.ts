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
  /** 本輪指定要使用的 skill。 */
  skillName?: string;
  /** 使用者輸入訊息。 */
  message: string;
}

/**
 * 前端顯示 Agent Timeline 用的事件格式。
 */
export type AgentStreamEvent =
  | {
      type: "session_started";
      sessionId: string;
      skillName: string;
      historyMessageCount: number;
    }
  | {
      type: "decision_requested";
      attempt: number;
      messageCount: number;
    }
  | {
      type: "agent_decision";
      attempt: number;
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
      toolName: string;
      toolInput: Record<string, unknown>;
    }
  | {
      type: "tool_completed";
      attempt: number;
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
