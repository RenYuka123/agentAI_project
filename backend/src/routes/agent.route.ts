import { Router } from "express";
import { chat, chatStream, deleteSession, getSessionMessages, getSessions } from "../controllers/agent.controller.js";

const router = Router();

router.get("/sessions", getSessions);
router.post("/chat", chat);
router.post("/chat/stream", chatStream);
router.get("/session/:sessionId/messages", getSessionMessages);
router.delete("/session/:sessionId", deleteSession);

export default router;
