import { assessOrchestration, orchestratorService } from "../../orchestration/index.js";
import { throwIfAborted } from "../../../utils/abort.js";
import { logger } from "../../../utils/logger.js";
import { sessionService } from "../../session/index.js";
import { resolveSkillSelection } from "../../skills/index.js";
import { runAgentLoop } from "./agent.loop.js";
/**
 * Agent domain 的主要 service 入口。
 *
 * 負責整合：
 * 1. session 建立與歷史讀取
 * 2. skill 自動判斷
 * 3. 單 agent loop 或 multi-agent orchestration 執行
 * 4. 本輪訊息持久化與 session 狀態更新
 */
export const agentService = {
    /**
     * 執行單次 agent 對話流程，並將本輪結果寫入對應 session。
     *
     * @param input 本輪請求資料，包含 sessionId 與使用者訊息。
     * @returns 帶有 sessionId 的 agent 最終回覆。
     */
    async run(input) {
        const { message, onEvent, sessionId, signal, skillName } = input;
        logger.info("Agent service received request", {
            messagePreview: message.slice(0, 120),
            messageLength: message.length,
            sessionId: sessionId || "new-session",
            skillName: skillName || "default",
        });
        /**
         * 先確保本輪對話已綁定 session，並載入最近歷史訊息。
         * 後續 skill 判斷與 agent / orchestration 執行都會依賴這份上下文。
         */
        const session = await sessionService.ensureSession(sessionId);
        const historyMessages = await sessionService.getRecentMessages(session.sessionId);
        /**
         * skill 可以由外部指定，也可以依照本輪訊息與歷史內容自動推估。
         * 這裡先把最終 skill 決定出來，後面所有流程都沿用這個結果。
         */
        const skillSelection = resolveSkillSelection({
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
        /**
         * 串流模式下，先把 skill 與 session 綁定資訊送給前端，
         * 讓 timeline 可以從流程一開始就顯示目前上下文。
         */
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
            roleName: "primary",
            historyMessageCount: historyMessages.length,
        });
        /**
         * 根據使用者需求複雜度決定本輪走哪條執行路徑：
         * 1. 單一步驟問題：直接交給 primary agent loop
         * 2. 多步驟問題：交給 orchestrator 拆成多個 worker 子任務處理
         */
        const orchestrationAssessment = await assessOrchestration({
            context: {
                sessionId: session.sessionId,
                userMessage: message,
                skillName: resolvedSkillName,
            },
            signal,
        });
        logger.info("Agent service assessed orchestration", {
            sessionId: session.sessionId,
            shouldOrchestrate: orchestrationAssessment.shouldOrchestrate,
            score: orchestrationAssessment.score,
            strategy: orchestrationAssessment.strategy,
            confidence: orchestrationAssessment.confidence,
            source: orchestrationAssessment.source,
            reasons: orchestrationAssessment.reasons,
            signals: orchestrationAssessment.signals,
        });
        await onEvent?.({
            type: "orchestration_assessed",
            sessionId: session.sessionId,
            assessment: orchestrationAssessment,
        });
        const runResult = orchestrationAssessment.shouldOrchestrate
            ? await orchestratorService.run({
                context: {
                    sessionId: session.sessionId,
                    userMessage: message,
                    skillName: resolvedSkillName,
                },
                historyMessages,
                onEvent,
                signal,
            })
            : await runAgentLoop({
                userMessage: message,
                historyMessages,
                skillName: resolvedSkillName,
                roleName: "primary",
                onEvent,
                signal,
            });
        // 寫入資料前再檢查一次取消狀態，避免 client 已離線仍把半完成流程持久化。
        throwIfAborted(signal, "Agent request aborted before persistence.");
        /**
         * 不論本輪是單 agent 還是 multi-agent，最後都統一在這裡：
         * 1. 寫入本輪新增訊息
         * 2. 補 session 標題
         * 3. 更新最後活動時間
         * 4. 通知前端本輪流程已完成
         */
        await sessionService.appendMessages(session.sessionId, runResult.generatedMessages);
        await sessionService.ensureSessionTitle(session.sessionId, message);
        await sessionService.touchSession(session.sessionId);
        await onEvent?.({
            type: "done",
            sessionId: session.sessionId,
        });
        /**
         * runResult 可能來自單 agent loop 或 orchestration。
         * 兩者回傳欄位不同，因此這裡統一整理成 controller 對外使用的標準格式。
         */
        return {
            sessionId: session.sessionId,
            skillName: resolvedSkillName || "default",
            reply: "answer" in runResult ? runResult.answer : runResult.reply,
        };
    },
};
