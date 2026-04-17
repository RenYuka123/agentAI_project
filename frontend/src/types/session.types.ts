import type { ApiErrorResponse } from "./api.types";

/**
 * 前端側邊欄使用的 session 摘要格式。
 */
export interface ChatSessionSummary {
  /** session 識別值。 */
  sessionId: string;
  /** 會話標題。 */
  title: string;
  /** 建立時間。 */
  createdAt: string;
  /** 最後更新時間。 */
  updatedAt: string;
}

/**
 * Session 列表 API 回傳格式。
 */
export interface SessionListApiResponse extends ApiErrorResponse {
  /** Session 摘要列表。 */
  sessions: ChatSessionSummary[];
}

/**
 * 刪除 session API 回傳格式。
 */
export interface DeleteSessionApiResponse extends ApiErrorResponse {
  /** 被刪除的 session 識別值。 */
  sessionId: string;
  /** 是否刪除成功。 */
  deleted: boolean;
}
