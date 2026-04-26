import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PNG } from "pngjs";
import { chatStream } from "../src/controllers/agent.controller.js";
import { deleteSession, getSessionMessages } from "../src/controllers/agent.controller.js";
import { llmConfig } from "../src/config/llm.js";
import { agentService } from "../src/services/agent/index.js";
import { bindSocketRoom, clearSocketRoom, resolveSocketRoomId } from "../src/services/draw/core/draw.gateway.js";
import { singlePlayerService } from "../src/services/draw/core/single-player.service.js";
import { assessOrchestration, sanitizeTaskPlan } from "../src/services/orchestration/index.js";
import { sessionService } from "../src/services/session/index.js";
import { resolveSkillSelection } from "../src/services/skills/index.js";
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
const createMockSseResponse = () => {
    const res = new EventEmitter();
    res.headers = {};
    res.writableEnded = false;
    res.destroyed = false;
    res.chunks = [];
    res.setHeader = (name, value) => {
        res.headers[name] = value;
    };
    res.flushHeaders = () => { };
    res.write = (chunk) => {
        res.chunks.push(chunk);
        return true;
    };
    res.end = () => {
        res.writableEnded = true;
    };
    res.status = (_code) => res;
    res.json = (_payload) => res;
    return res;
};
const createSampleImageDataUrl = () => {
    const png = new PNG({ width: 12, height: 12 });
    for (let y = 3; y < 9; y += 1) {
        for (let x = 3; x < 9; x += 1) {
            const index = (png.width * y + x) << 2;
            png.data[index] = 40;
            png.data[index + 1] = 40;
            png.data[index + 2] = 40;
            png.data[index + 3] = 255;
        }
    }
    const buffer = PNG.sync.write(png);
    return `data:image/png;base64,${buffer.toString("base64")}`;
};
const testCases = [
    {
        name: "getSessionMessages returns 404 when the session does not exist",
        run: async () => {
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
        },
    },
    {
        name: "deleteSession returns 404 when the session does not exist",
        run: async () => {
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
        },
    },
    {
        name: "skill selector does not infer investment analysis from calculator history alone",
        run: async () => {
            const historyMessages = [
                {
                    role: "tool",
                    toolName: "calculator",
                    content: '{"tool":"calculator","result":42}',
                },
            ];
            const selection = resolveSkillSelection({
                historyMessages,
                userMessage: "那如果改成 5 年呢",
            });
            assert.equal(selection.source, "default");
            assert.equal(selection.skillName, undefined);
        },
    },
    {
        name: "skill selector keeps investment analysis when calculator history is paired with investment context",
        run: async () => {
            const historyMessages = [
                {
                    role: "user",
                    content: "幫我算 0050 如果年化 8% 五年後會多少",
                },
                {
                    role: "tool",
                    toolName: "calculator",
                    content: '{"tool":"calculator","result":14693.28}',
                },
            ];
            const selection = resolveSkillSelection({
                historyMessages,
                userMessage: "那如果改成 10 年呢",
            });
            assert.equal(selection.source, "auto");
            assert.equal(selection.skillName, "investment_analysis");
        },
    },
    {
        name: "orchestration gate scores a parallel request higher than a linear dependency chain",
        run: async () => {
            const originalApiKey = llmConfig.apiKey;
            llmConfig.apiKey = "";
            try {
                const linearAssessment = await assessOrchestration({
                    context: {
                        sessionId: "session-linear",
                        userMessage: "先查 0050 股價，再用那個價格算上漲 10%，最後整理一句結論",
                        skillName: "investment_analysis",
                    },
                });
                const parallelAssessment = await assessOrchestration({
                    context: {
                        sessionId: "session-parallel",
                        userMessage: "幫我比較 0050 和 006208，並且整理它們的差異與適合族群",
                        skillName: "investment_analysis",
                    },
                });
                assert.ok(parallelAssessment.score > linearAssessment.score, `Expected parallel score (${parallelAssessment.score}) to be greater than linear score (${linearAssessment.score}).`);
                assert.equal(linearAssessment.signals.isDependencyChainLikely, true);
                assert.ok(parallelAssessment.signals.parallelCueCount > 0);
            }
            finally {
                llmConfig.apiKey = originalApiKey;
            }
        },
    },
    {
        name: "single player heuristic guessing is deterministic for identical input",
        run: async () => {
            const originalApiKey = llmConfig.apiKey;
            llmConfig.apiKey = "";
            try {
                const imageDataUrl = createSampleImageDataUrl();
                const input = {
                    answer: "貓",
                    imageDataUrl,
                    timedOut: false,
                };
                const firstResult = await singlePlayerService.guessDrawing(input);
                const secondResult = await singlePlayerService.guessDrawing(input);
                assert.deepEqual(secondResult, firstResult);
            }
            finally {
                llmConfig.apiKey = originalApiKey;
            }
        },
    },
    {
        name: "chatStream aborts cleanly when the client disconnects",
        run: async () => {
            const originalRun = agentService.run;
            let observedAbort = false;
            agentService.run = async (input) => {
                const signal = input.signal;
                signal?.addEventListener("abort", () => {
                    observedAbort = true;
                });
                await input.onEvent?.({
                    type: "skill_selected",
                    sessionId: "session-abort",
                    skillName: "default",
                    source: "default",
                    reason: "test",
                });
                return {
                    sessionId: "session-abort",
                    skillName: "default",
                    reply: "should-not-complete",
                };
            };
            try {
                const req = new EventEmitter();
                req.body = {
                    message: "測試中斷",
                };
                const res = createMockSseResponse();
                const streamPromise = chatStream(req, res);
                req.emit("close");
                await streamPromise;
                assert.equal(observedAbort, true);
                assert.equal(res.writableEnded, true);
            }
            finally {
                agentService.run = originalRun;
            }
        },
    },
    {
        name: "sanitizeTaskPlan rejects task plans with invalid dependency references",
        run: async () => {
            const invalidTaskPlan = sanitizeTaskPlan({
                reason: "invalid dependency",
                tasks: [
                    {
                        taskId: "collect-data",
                        title: "蒐集資料",
                        instruction: "先蒐集資料",
                        role: "worker",
                        dependsOn: [],
                    },
                    {
                        taskId: "summarize",
                        title: "整理答案",
                        instruction: "整理結果",
                        role: "worker",
                        dependsOn: ["missing-task"],
                    },
                ],
            });
            assert.equal(invalidTaskPlan, undefined);
        },
    },
    {
        name: "draw room binding rejects mismatched payload room ids and can be cleared safely",
        run: async () => {
            const socket = {
                id: "socket-1",
                data: {},
            };
            bindSocketRoom(socket, "ROOM_A");
            assert.equal(resolveSocketRoomId(socket, "ROOM_A"), "ROOM_A");
            assert.equal(resolveSocketRoomId(socket, "ROOM_B"), undefined);
            assert.equal(clearSocketRoom(socket), "ROOM_A");
            assert.equal(resolveSocketRoomId(socket, "ROOM_B"), "ROOM_B");
        },
    },
];
const run = async () => {
    let passedCount = 0;
    for (const testCase of testCases) {
        try {
            await testCase.run();
            passedCount += 1;
            console.log(`PASS ${testCase.name}`);
        }
        catch (error) {
            console.error(`FAIL ${testCase.name}`);
            console.error(error);
            process.exitCode = 1;
            return;
        }
    }
    console.log(`All tests passed (${passedCount}/${testCases.length}).`);
};
await run();
