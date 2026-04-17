import { logger } from "../../../utils/logger.js";
import { sessionService } from "../../session/index.js";
import { resolveSkillSelection } from "../../skills/index.js";
import { runAgentLoop } from "./agent.loop.js";
import type { AgentSkillSelection, AgentStreamEventHandler } from "./agent.types.js";

/**
 * Agent service 的輸入資料。
 */
export interface RunAgentInput {
  /** 既有 session 識別值；未提供時會自動建立。 */
  sessionId?: string;
  /** 本輪指定要使用的 skill。 */
  skillName?: string;
  /** 本輪使用者提問。 */
  message: string;
  /** 流式模式下的事件回呼。 */
  onEvent?: AgentStreamEventHandler;
}

/**
 * Agent service 的輸出資料。
 */
export interface RunAgentResult {
  /** 本次對話所屬的 session 識別值。 */
  sessionId: string;
  /** 本輪實際採用的 skill。 */
  skillName: string;
  /** Agent 最終回覆內容。 */
  reply: string;
}

/**
 * Agent service 負責串接 session 歷史、agent loop 與訊息持久化。
 */
export const agentService = {
  /**
   * 執行單次 agent 對話流程，並將本輪結果寫入對應 session。
   *
   * @param input 本輪請求資料，包含 sessionId 與使用者訊息。
   * @returns 帶有 sessionId 的 agent 最終回覆。
   */
  async run(input: RunAgentInput): Promise<RunAgentResult> {
    const { message, onEvent, sessionId, skillName } = input;
    logger.info("Agent service received request", {
      messagePreview: message.slice(0, 120),
      messageLength: message.length,
      sessionId: sessionId || "new-session",
      skillName: skillName || "default",
    });

    const session = await sessionService.ensureSession(sessionId);
    const historyMessages = await sessionService.getRecentMessages(session.sessionId);
    const skillSelection: AgentSkillSelection = resolveSkillSelection({
      historyMessages,
      requestedSkillName: skillName,
      userMessage: message,
    });
    const resolvedSkillName = skillSelection.skillName;

    logger.info("Agent service resolved skill", {
      sessionId: session.sessionId,
      requestedSkillName: skillName || "auto",
      resolvedSkillName: resolvedSkillName || "default",
      source: skillSelection.source,
      reason: skillSelection.reason,
    });
    await onEvent?.({
      type: "skill_selected",
      sessionId: session.sessionId,
      skillName: resolvedSkillName || "default",
      source: skillSelection.source,
      reason: skillSelection.reason,
    });
    await onEvent?.({
      type: "session_started",
      sessionId: session.sessionId,
      skillName: resolvedSkillName || "default",
      historyMessageCount: historyMessages.length,
    });
    const loopResult = await runAgentLoop({
      userMessage: message,
      historyMessages,
      skillName: resolvedSkillName,
      onEvent,
    });

    await sessionService.appendMessages(session.sessionId, loopResult.generatedMessages);
    await sessionService.ensureSessionTitle(session.sessionId, message);
    await sessionService.touchSession(session.sessionId);
    await onEvent?.({
      type: "done",
      sessionId: session.sessionId,
    });

    return {
      sessionId: session.sessionId,
      skillName: resolvedSkillName || "default",
      reply: loopResult.answer,
    };
  },
};
