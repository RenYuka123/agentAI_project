import { requestJson } from "./http";
import type { AgentChatRequest, AgentStreamEvent, ChatApiResponse, SessionMessagesApiResponse } from "../types/chat.types";

const apiBaseUrl = import.meta.env.VITE_API_URL?.trim() || "";
const chatEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/agent/chat` : "/api/agent/chat";
const streamChatEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/agent/chat/stream` : "/api/agent/chat/stream";
const sessionEndpoint = (sessionId: string) =>
  apiBaseUrl ? `${apiBaseUrl}/api/agent/session/${sessionId}/messages` : `/api/agent/session/${sessionId}/messages`;

interface StreamChatOptions {
  /** 收到單筆 SSE 事件時的回呼。 */
  onEvent: (event: AgentStreamEvent) => void | Promise<void>;
}

/**
 * 呼叫後端 chat API，取得 agent 回覆。
 *
 * @param payload 要送往後端的聊天請求資料。
 * @returns 後端回傳的聊天結果。
 */
export const sendChatMessage = async (payload: AgentChatRequest): Promise<ChatApiResponse> =>
  requestJson<ChatApiResponse>(chatEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    defaultErrorMessage: "後端目前無法處理這則訊息。",
  });

/**
 * 讀取指定 session 的歷史訊息。
 *
 * @param sessionId 要查詢的 session 識別值。
 * @returns 可直接顯示在前端畫面上的歷史訊息。
 */
export const getSessionMessages = async (sessionId: string): Promise<SessionMessagesApiResponse> =>
  requestJson<SessionMessagesApiResponse>(sessionEndpoint(sessionId), {
    method: "GET",
    defaultErrorMessage: "目前無法讀取歷史訊息。",
  });

/**
 * 以 SSE 方式讀取 Agent 執行過程，提供前端即時 Timeline 顯示。
 *
 * @param payload 要送往後端的聊天請求資料。
 * @param options 串流事件處理設定。
 */
export const streamChatMessage = async (payload: AgentChatRequest, options: StreamChatOptions): Promise<void> => {
  const response = await fetch(streamChatEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok || !response.body) {
    throw new Error("目前無法建立串流連線。");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() || "";

    for (const chunk of chunks) {
      const lines = chunk.split("\n");
      const dataLine = lines.find((line) => line.startsWith("data: "));

      if (!dataLine) {
        continue;
      }

      const event = JSON.parse(dataLine.slice(6)) as AgentStreamEvent;
      await options.onEvent(event);
    }
  }
};
