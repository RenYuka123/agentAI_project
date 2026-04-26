import test from "node:test";
import assert from "node:assert/strict";
import { deleteSession, getSessionMessages } from "../src/controllers/agent.controller.ts";
import { sessionService } from "../src/services/session/index.ts";
const createMockResponse = () => ({
    statusCode: 200,
    body: undefined,
    status(code) {
        this.statusCode = code;
        return this;
    },
    json(payload) {
        this.body = payload;
        return this;
    },
});
test("getSessionMessages returns 404 when the session does not exist", async () => {
    const originalGetSessionById = sessionService.getSessionById;
    sessionService.getSessionById = async () => null;
    try {
        const req = {
            params: {
                sessionId: "missing-session",
            },
        };
        const res = createMockResponse();
        await getSessionMessages(req, res);
        assert.equal(res.statusCode, 404);
        assert.deepEqual(res.body, {
            sessionId: "missing-session",
            messages: [],
            error: "Session not found.",
        });
    }
    finally {
        sessionService.getSessionById = originalGetSessionById;
    }
});
test("deleteSession returns 404 when the session does not exist", async () => {
    const originalDeleteSession = sessionService.deleteSession;
    sessionService.deleteSession = async () => false;
    try {
        const req = {
            params: {
                sessionId: "missing-session",
            },
        };
        const res = createMockResponse();
        await deleteSession(req, res);
        assert.equal(res.statusCode, 404);
        assert.deepEqual(res.body, {
            sessionId: "missing-session",
            deleted: false,
            error: "Session not found.",
        });
    }
    finally {
        sessionService.deleteSession = originalDeleteSession;
    }
});
