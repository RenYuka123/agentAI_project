import type { AgentMessageRole } from "../../agent/index.js";

/**
 * 聊天 session 的資料格式。
 */
export interface ChatSession {
  /** 對外使用的 session 識別值。 */
  sessionId: string;
  /** 會話標題。 */
  title?: string;
  /** session 建立時間。 */
  createdAt: Date;
  /** session 最後更新時間。 */
  updatedAt: Date;
}

/**
 * 提供給前端列表顯示的 session 摘要格式。
 */
export interface ChatSessionSummary {
  /** 對外使用的 session 識別值。 */
  sessionId: string;
  /** 會話標題。 */
  title: string;
  /** session 建立時間。 */
  createdAt: Date;
  /** session 最後更新時間。 */
  updatedAt: Date;
}

/**
 * 持久化在資料庫中的訊息格式。
 */
export interface ChatMessageRecord {
  /** 所屬 session 識別值。 */
  sessionId: string;
  /** 訊息角色。 */
  role: AgentMessageRole;
  /** 訊息內容。 */
  content: string;
  /** 工具訊息時的工具名稱。 */
  toolName?: string;
  /** 訊息建立時間。 */
  createdAt: Date;
}

/**
 * 提供給前端顯示的歷史訊息格式。
 */
export interface ChatHistoryMessage {
  /** 訊息角色。 */
  role: "assistant" | "user" | "system";
  /** 訊息內容。 */
  content: string;
  /** 訊息建立時間。 */
  createdAt: Date;
}
