/**
 * Agent chat API 的請求內容。
 */
export interface AgentChatRequestBody {
  /** 既有會話識別值，未提供時後端會自動建立。 */
  sessionId?: string;
  /** 指定本輪對話要使用的 skill。 */
  skillName?: string;
  /** 使用者送進來的原始訊息。 */
  message: string;
}

/**
 * Agent chat API 的回應內容。
 */
export interface AgentChatResponseBody {
  /** 本次對話對應的 session 識別值。 */
  sessionId: string;
  /** 本輪實際採用的 skill。 */
  skillName: string;
  /** Agent 最終整理後的回覆文字。 */
  reply: string;
  /** 發生錯誤時的訊息內容。 */
  error?: string;
}

/**
 * 單筆歷史訊息的 API 格式。
 */
export interface AgentHistoryMessageResponseBody {
  /** 訊息角色。 */
  role: "assistant" | "user" | "system";
  /** 訊息內容。 */
  content: string;
  /** 訊息建立時間。 */
  createdAt: string;
}

/**
 * 讀取指定 session 歷史訊息的 API 回應內容。
 */
export interface AgentSessionMessagesResponseBody {
  /** 本次讀取的 session 識別值。 */
  sessionId: string;
  /** 歷史訊息列表。 */
  messages: AgentHistoryMessageResponseBody[];
  /** 發生錯誤時的訊息內容。 */
  error?: string;
}

/**
 * 單筆 session 摘要的 API 格式。
 */
export interface AgentSessionSummaryResponseBody {
  /** 對外使用的 session 識別值。 */
  sessionId: string;
  /** 會話標題。 */
  title: string;
  /** 建立時間。 */
  createdAt: string;
  /** 最後更新時間。 */
  updatedAt: string;
}

/**
 * Session 列表 API 回應內容。
 */
export interface AgentSessionsResponseBody {
  /** Session 摘要列表。 */
  sessions: AgentSessionSummaryResponseBody[];
  /** 發生錯誤時的訊息內容。 */
  error?: string;
}

/**
 * 刪除 session API 回應內容。
 */
export interface AgentDeleteSessionResponseBody {
  /** 被刪除的 session 識別值。 */
  sessionId: string;
  /** 是否刪除成功。 */
  deleted: boolean;
  /** 發生錯誤時的訊息內容。 */
  error?: string;
}

/**
 * Agent 串流 API 的請求內容。
 */
export interface AgentChatStreamRequestBody extends AgentChatRequestBody {}

/**
 * 單人畫圖猜測 API 的請求內容。
 */
export interface SinglePlayerGuessRequestBody {
  /** 使用者實際選到的題目。 */
  answer: string;
  /** Canvas 匯出的 PNG data URL。 */
  imageDataUrl: string;
  /** 是否為時間到自動送出。 */
  timedOut?: boolean;
}

/**
 * 單人畫圖猜測 API 的回應內容。
 */
export interface SinglePlayerGuessResponseBody {
  /** 後端回傳的猜測結果。 */
  guess: string;
  /** 後端給的簡短評語。 */
  comment: string;
  /** 這次猜測的信心程度。 */
  confidence: "high" | "medium" | "low";
  /** 是否判定為猜對。 */
  isCorrect: boolean;
  /** 發生錯誤時的訊息內容。 */
  error?: string;
}
