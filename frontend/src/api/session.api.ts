import { requestJson } from "./http";
import type { DeleteSessionApiResponse, SessionListApiResponse } from "../types/session.types";

const apiBaseUrl = import.meta.env.VITE_API_URL?.trim() || "";
const sessionsEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/agent/sessions` : "/api/agent/sessions";
const sessionDeleteEndpoint = (sessionId: string) =>
  apiBaseUrl ? `${apiBaseUrl}/api/agent/session/${sessionId}` : `/api/agent/session/${sessionId}`;

/**
 * 讀取所有 session 摘要。
 *
 * @returns 可供側邊欄顯示的 session 列表。
 */
export const getSessions = async (): Promise<SessionListApiResponse> =>
  requestJson<SessionListApiResponse>(sessionsEndpoint, {
    method: "GET",
    defaultErrorMessage: "目前無法讀取會話列表。",
  });

/**
 * 刪除指定 session。
 *
 * @param sessionId 要刪除的 session 識別值。
 * @returns 刪除結果。
 */
export const deleteSession = async (sessionId: string): Promise<DeleteSessionApiResponse> =>
  requestJson<DeleteSessionApiResponse>(sessionDeleteEndpoint(sessionId), {
    method: "DELETE",
    defaultErrorMessage: "目前無法刪除這個會話。",
  });
