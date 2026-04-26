import { randomUUID } from "crypto";
import type { Collection } from "mongodb";
import { appConfig } from "../../../config/env.js";
import { getDatabase } from "../../../config/mongodb.js";
import type { AgentMessage } from "../../agent/index.js";
import { safeJsonParse } from "../../../utils/safe-json.js";
import type { ChatHistoryMessage, ChatMessageRecord, ChatSession, ChatSessionSummary } from "./session.types.js";

/**
 * 將使用者第一句訊息整理成適合顯示的 session 標題。
 *
 * @param message 使用者原始訊息。
 * @returns 截斷後的 session 標題。
 */
const buildSessionTitle = (message: string): string => {
  const normalized = message.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return "新對話";
  }

  return normalized.length > 32 ? `${normalized.slice(0, 32)}...` : normalized;
};

/**
 * 統一整理 session 摘要格式，避免前端拿到舊資料結構時缺 title。
 *
 * @param session 原始 session 資料。
 * @returns 可直接提供給前端的 session 摘要。
 */
const toSessionSummary = (session: ChatSession): ChatSessionSummary => ({
  sessionId: session.sessionId,
  title: session.title?.trim() || "新對話",
  createdAt: session.createdAt,
  updatedAt: session.updatedAt,
});

/**
 * 取得 sessions collection。
 *
 * @returns sessions collection。
 */
const getSessionsCollection = async (): Promise<Collection<ChatSession>> => {
  const database = await getDatabase();
  return database.collection<ChatSession>("sessions");
};

/**
 * 取得 messages collection。
 *
 * @returns messages collection。
 */
const getMessagesCollection = async (): Promise<Collection<ChatMessageRecord>> => {
  const database = await getDatabase();
  return database.collection<ChatMessageRecord>("messages");
};

/**
 * 確認 session 存在；若未提供 sessionId，則自動建立一筆新的 session。
 *
 * @param sessionId 既有 session 識別值。
 * @returns 可用的 session 資料。
 */
const ensureSession = async (sessionId?: string): Promise<ChatSession> => {
  const sessionsCollection = await getSessionsCollection();
  const now = new Date();
  const resolvedSessionId = sessionId?.trim() || randomUUID();

  // 用 upsert 收斂「先查再建」的競態，避免同一 sessionId 併發請求時撞 unique index。
  await sessionsCollection.updateOne(
    { sessionId: resolvedSessionId },
    {
      $setOnInsert: {
        sessionId: resolvedSessionId,
        title: "",
        createdAt: now,
        updatedAt: now,
      },
    },
    { upsert: true },
  );

  const ensuredSession = await sessionsCollection.findOne({ sessionId: resolvedSessionId });

  if (!ensuredSession) {
    throw new Error(`Failed to ensure session: ${resolvedSessionId}`);
  }

  return ensuredSession;
};

/**
 * 依 sessionId 讀取單一 session。
 *
 * @param sessionId session 識別值。
 * @returns 找到時回傳 session，否則回傳 null。
 */
const getSessionById = async (sessionId: string): Promise<ChatSession | null> => {
  const sessionsCollection = await getSessionsCollection();
  return sessionsCollection.findOne({ sessionId });
};

/**
 * 讀取指定 session 最近的對話歷史，並轉回 agent 可直接使用的格式。
 *
 * @param sessionId session 識別值。
 * @returns 依時間排序的歷史訊息。
 */
const getRecentMessages = async (sessionId: string): Promise<AgentMessage[]> => {
  const messagesCollection = await getMessagesCollection();

  const records = await messagesCollection
    .find({ sessionId })
    .sort({ createdAt: -1 })
    .limit(appConfig.agentHistoryLimit)
    .toArray();

  return records.reverse().map((record) => ({
    role: record.role,
    content: record.content,
    toolName: record.toolName,
  }));
};

/**
 * 判斷資料庫中的訊息是否屬於前端可直接顯示的內容。
 *
 * @param record 資料庫中的單筆訊息。
 * @returns 是否應顯示在聊天畫面上。
 */
const isVisibleHistoryMessage = (record: ChatMessageRecord): boolean => {
  if (record.role === "user") {
    return true;
  }

  if (record.role === "tool") {
    return false;
  }

  if (record.role === "assistant") {
    const parsed = safeJsonParse(record.content);

    if (parsed.ok && typeof parsed.data === "object" && parsed.data !== null) {
      const candidate = parsed.data as Record<string, unknown>;

      if (candidate.type === "tool_call") {
        return false;
      }
    }

    return true;
  }

  return record.role === "system";
};

/**
 * 讀取指定 session 的前端可見歷史訊息。
 *
 * @param sessionId session 識別值。
 * @returns 已整理好的歷史訊息列表。
 */
const getVisibleMessages = async (sessionId: string): Promise<ChatHistoryMessage[]> => {
  const messagesCollection = await getMessagesCollection();

  const records = await messagesCollection.find({ sessionId }).sort({ createdAt: 1 }).toArray();

  return records
    .filter(isVisibleHistoryMessage)
    .map((record) => ({
      role: record.role === "system" ? "system" : record.role === "user" ? "user" : "assistant",
      content: record.content,
      createdAt: record.createdAt,
    }));
};

/**
 * 將本輪新產生的訊息批次寫入資料庫，供後續會話延續使用。
 *
 * @param sessionId session 識別值。
 * @param messages 本輪產生的訊息列表。
 */
const appendMessages = async (sessionId: string, messages: AgentMessage[]): Promise<void> => {
  if (!messages.length) {
    return;
  }

  const messagesCollection = await getMessagesCollection();
  const now = new Date();
  const documents: ChatMessageRecord[] = messages.map((message, index) => ({
    sessionId,
    role: message.role,
    content: message.content,
    toolName: message.toolName,
    createdAt: new Date(now.getTime() + index),
  }));

  await messagesCollection.insertMany(documents);
};

/**
 * 若 session 尚未設定標題，則使用第一句使用者訊息補上。
 *
 * @param sessionId session 識別值。
 * @param message 可作為標題的使用者訊息。
 */
const ensureSessionTitle = async (sessionId: string, message: string): Promise<void> => {
  const sessionsCollection = await getSessionsCollection();
  const title = buildSessionTitle(message);

  await sessionsCollection.updateOne(
    {
      sessionId,
      $or: [{ title: { $exists: false } }, { title: "" }],
    },
    {
      $set: {
        title,
      },
    },
  );
};

/**
 * 更新 session 最後活動時間。
 *
 * @param sessionId session 識別值。
 */
const touchSession = async (sessionId: string): Promise<void> => {
  const sessionsCollection = await getSessionsCollection();

  await sessionsCollection.updateOne(
    { sessionId },
    {
      $set: {
        updatedAt: new Date(),
      },
    },
  );
};

/**
 * 讀取所有 session 摘要，預設依更新時間新到舊排序。
 *
 * @returns session 摘要列表。
 */
const getSessionList = async (): Promise<ChatSessionSummary[]> => {
  const sessionsCollection = await getSessionsCollection();
  const sessions = await sessionsCollection.find({}).sort({ updatedAt: -1, createdAt: -1 }).toArray();

  return sessions.map(toSessionSummary);
};

/**
 * 刪除指定 session 與其對應的所有訊息。
 *
 * @param sessionId session 識別值。
 */
const deleteSession = async (sessionId: string): Promise<boolean> => {
  const sessionsCollection = await getSessionsCollection();
  const messagesCollection = await getMessagesCollection();

  const existingSession = await sessionsCollection.findOne({ sessionId });

  if (!existingSession) {
    return false;
  }

  // 先刪 messages 再刪 session，至少保證對外不會留下仍可被讀取的舊內容。
  await messagesCollection.deleteMany({ sessionId });
  const deleteResult = await sessionsCollection.deleteOne({ sessionId });

  return deleteResult.deletedCount === 1;
};

/**
 * 封裝 session 與訊息歷史的資料存取行為。
 */
export const sessionService = {
  ensureSession,
  getSessionById,
  ensureSessionTitle,
  getRecentMessages,
  getVisibleMessages,
  getSessionList,
  appendMessages,
  touchSession,
  deleteSession,
};
