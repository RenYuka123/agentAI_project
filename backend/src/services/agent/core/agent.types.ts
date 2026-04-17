import type { JsonObject } from "../../../types/common.types.js";
export type {
  AgentTool,
  ToolExecutionError,
  ToolExecutionMeta,
  ToolExecutionResult,
  ToolHealthStatus,
  ToolMetadata,
} from "../../tools/index.js";
export type { AnyAgentTool } from "../../tools/index.js";
import type { ToolExecutionResult } from "../../tools/index.js";

/**
 * Agent 對話訊息可使用的角色類型。
 */
export type AgentMessageRole = "system" | "user" | "assistant" | "tool";

/**
 * Agent 在 loop 中流轉的標準訊息格式。
 */
export interface AgentMessage {
  /** 訊息來源角色。 */
  role: AgentMessageRole;
  /** 實際要給模型或工具看的文字內容。 */
  content: string;
  /** 當 role 為 tool 時，可附上對應工具名稱。 */
  toolName?: string;
}

/**
 * Skill 用來定義特定任務場景下的額外規則與可用工具範圍。
 */
export interface AgentSkill {
  /** Skill 唯一名稱。 */
  name: string;
  /** Skill 用途描述。 */
  description: string;
  /** 額外提供給模型的任務規則。 */
  prompt: string;
  /** 該 skill 可使用的工具名稱清單。 */
  allowedTools?: string[];
}

/**
 * 啟動 agent loop 時需要的輸入資料。
 */
export interface RunAgentLoopInput {
  /** 本輪使用者新送進來的訊息。 */
  userMessage: string;
  /** 該 session 既有的歷史訊息。 */
  historyMessages?: AgentMessage[];
  /** 本輪指定要使用的 skill。 */
  skillName?: string;
  /** 流式模式下的事件回呼。 */
  onEvent?: AgentStreamEventHandler;
}

/**
 * Agent loop 執行完成後的標準輸出。
 */
export interface RunAgentLoopResult {
  /** 最終要回給使用者的答案。 */
  answer: string;
  /** 本輪新產生並建議持久化的訊息。 */
  generatedMessages: AgentMessage[];
}

/**
 * Agent SSE 事件格式。
 */
export type AgentStreamEvent =
  | {
      /** 表示本輪對話已綁定 session。 */
      type: "session_started";
      /** 對話所屬的 session 識別值。 */
      sessionId: string;
      /** 目前指定的 skill。 */
      skillName: string;
      /** 已載入的歷史訊息數量。 */
      historyMessageCount: number;
    }
  | {
      /** 表示 agent 即將向模型請求下一步決策。 */
      type: "decision_requested";
      /** 第幾輪決策。 */
      attempt: number;
      /** 本輪送給模型的訊息數量。 */
      messageCount: number;
    }
  | {
      /** 表示模型已回傳本輪決策。 */
      type: "agent_decision";
      /** 第幾輪決策。 */
      attempt: number;
      /** 模型回傳的決策內容。 */
      decision: AgentDecision;
    }
  | {
      /** 表示模型回傳了不合法的工具決策。 */
      type: "invalid_tool_decision";
      /** 第幾輪決策。 */
      attempt: number;
      /** 原始決策內容。 */
      decision: AgentDecision;
      /** 當前可用工具名稱清單。 */
      availableToolNames: string[];
    }
  | {
      /** 表示 agent 開始執行工具。 */
      type: "tool_started";
      /** 第幾輪決策。 */
      attempt: number;
      /** 工具名稱。 */
      toolName: string;
      /** 工具輸入資料。 */
      toolInput: JsonObject;
    }
  | {
      /** 表示工具已執行完成。 */
      type: "tool_completed";
      /** 第幾輪決策。 */
      attempt: number;
      /** 工具名稱。 */
      toolName: string;
      /** 工具執行結果。 */
      result: ToolExecutionResult;
    }
  | {
      /** 表示 agent 已得到最終答案。 */
      type: "final_answer";
      /** 第幾輪決策。 */
      attempt: number;
      /** 最終答案。 */
      answer: string;
    }
  | {
      /** 表示整個串流流程完成。 */
      type: "done";
      /** 對話所屬的 session 識別值。 */
      sessionId: string;
    }
  | {
      /** 表示串流流程發生錯誤。 */
      type: "error";
      /** 錯誤訊息。 */
      message: string;
    };

/**
 * Agent 串流事件回呼型別。
 */
export type AgentStreamEventHandler = (event: AgentStreamEvent) => void | Promise<void>;

/**
 * Agent 每一輪決策的標準回傳格式。
 */
export type AgentDecision =
  | {
      /** 表示本輪已可直接回覆使用者。 */
      type: "final";
      /** 最終要回給使用者的答案。 */
      answer: string;
    }
  | {
      /** 表示本輪需要先呼叫工具。 */
      type: "tool_call";
      /** 要執行的工具名稱。 */
      toolName: string;
      /** 傳給工具的輸入資料。 */
      toolInput: JsonObject;
    };
