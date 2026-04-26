import { createAbortError } from "../utils/abort.js";
import { agentService } from "../services/agent/index.js";
import { sessionService } from "../services/session/index.js";
/**
 * 將 SSE 事件寫入 response。
 *
 * @param res Express response。
 * @param event 要寫出的事件資料。
 */
const writeSseEvent = (res, event) => {
    if (res.writableEnded || res.destroyed) {
        throw createAbortError("SSE response is no longer writable.");
    }
    res.write(`event: ${event.type}\n`);
    res.write(`data: ${JSON.stringify(event)}\n\n`);
};
/**
 * 讓 request / response 的中斷可以往下游流程傳遞。
 *
 * @param req Express request。
 * @param res Express response。
 * @returns 本輪 request 專用的 AbortController。
 */
const createRequestAbortController = (req, res) => {
    const controller = new AbortController();
    const abortRequest = () => {
        if (!controller.signal.aborted) {
            controller.abort(createAbortError("Client disconnected."));
        }
    };
    req.on("close", abortRequest);
    res.on("close", abortRequest);
    return controller;
};
/**
 * Controller 只處理 HTTP 請求與回應，Agent 邏輯交給 service。
 *
 * @param req Express request，包含使用者輸入訊息。
 * @param res Express response，回傳 agent 最終結果。
 */
export const chat = async (req, res) => {
    const message = req.body?.message?.trim();
    const sessionId = req.body?.sessionId?.trim();
    const skillName = req.body?.skillName?.trim();
    if (!message) {
        res.status(400).json({
            sessionId: sessionId || "",
            skillName: skillName || "default",
            reply: "",
            error: "`message` is required.",
        });
        return;
    }
    try {
        const requestAbortController = createRequestAbortController(req, res);
        const result = await agentService.run({
            sessionId,
            skillName,
            message,
            signal: requestAbortController.signal,
        });
        res.json({
            sessionId: result.sessionId,
            skillName: result.skillName,
            reply: result.reply,
        });
    }
    catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
            return;
        }
        const errorMessage = error instanceof Error ? error.message : "Internal server error";
        res.status(500).json({
            sessionId: sessionId || "",
            skillName: skillName || "default",
            reply: "",
            error: errorMessage,
        });
    }
};
/**
 * 以 SSE 方式串流 Agent 執行過程，讓前端可以即時顯示 Timeline。
 *
 * @param req Express request，包含使用者輸入訊息。
 * @param res Express response，以 SSE 格式回傳事件流。
 */
export const chatStream = async (req, res) => {
    const message = req.body?.message?.trim();
    const sessionId = req.body?.sessionId?.trim();
    const skillName = req.body?.skillName?.trim();
    if (!message) {
        res.status(400).json({
            error: "`message` is required.",
        });
        return;
    }
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();
    try {
        const requestAbortController = createRequestAbortController(req, res);
        await agentService.run({
            sessionId,
            skillName,
            message,
            signal: requestAbortController.signal,
            onEvent: async (event) => {
                if (requestAbortController.signal.aborted) {
                    throw createAbortError("Client disconnected before SSE event was sent.");
                }
                writeSseEvent(res, event);
            },
        });
        res.end();
    }
    catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
            if (!res.writableEnded) {
                res.end();
            }
            return;
        }
        const errorMessage = error instanceof Error ? error.message : "Internal server error";
        writeSseEvent(res, {
            type: "error",
            message: errorMessage,
        });
        res.end();
    }
};
/**
 * 讀取指定 session 的歷史訊息，供前端重整畫面後回填對話內容。
 *
 * @param req Express request，包含 sessionId 路徑參數。
 * @param res Express response，回傳整理後的歷史訊息。
 */
export const getSessionMessages = async (req, res) => {
    const sessionId = req.params.sessionId?.trim();
    if (!sessionId) {
        res.status(400).json({
            sessionId: "",
            messages: [],
            error: "`sessionId` is required.",
        });
        return;
    }
    try {
        const session = await sessionService.getSessionById(sessionId);
        if (!session) {
            res.status(404).json({
                sessionId,
                messages: [],
                error: "Session not found.",
            });
            return;
        }
        const messages = await sessionService.getVisibleMessages(sessionId);
        res.json({
            sessionId,
            messages: messages.map((message) => ({
                role: message.role,
                content: message.content,
                createdAt: message.createdAt.toISOString(),
            })),
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Internal server error";
        res.status(500).json({
            sessionId,
            messages: [],
            error: errorMessage,
        });
    }
};
/**
 * 讀取所有 session 摘要，供前端側邊欄顯示。
 *
 * @param _req Express request。
 * @param res Express response，回傳 session 摘要列表。
 */
export const getSessions = async (_req, res) => {
    try {
        const sessions = await sessionService.getSessionList();
        res.json({
            sessions: sessions.map((session) => ({
                sessionId: session.sessionId,
                title: session.title,
                createdAt: session.createdAt.toISOString(),
                updatedAt: session.updatedAt.toISOString(),
            })),
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Internal server error";
        res.status(500).json({
            sessions: [],
            error: errorMessage,
        });
    }
};
/**
 * 刪除指定 session 與其歷史訊息。
 *
 * @param req Express request，包含 sessionId 路徑參數。
 * @param res Express response，回傳刪除結果。
 */
export const deleteSession = async (req, res) => {
    const sessionId = req.params.sessionId?.trim();
    if (!sessionId) {
        res.status(400).json({
            sessionId: "",
            deleted: false,
            error: "`sessionId` is required.",
        });
        return;
    }
    try {
        const deleted = await sessionService.deleteSession(sessionId);
        if (!deleted) {
            res.status(404).json({
                sessionId,
                deleted: false,
                error: "Session not found.",
            });
            return;
        }
        res.json({
            sessionId,
            deleted: true,
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Internal server error";
        res.status(500).json({
            sessionId,
            deleted: false,
            error: errorMessage,
        });
    }
};
