import test from "node:test";
import assert from "node:assert/strict";
import { llmConfig } from "../src/config/llm.ts";
import { assessOrchestration } from "../src/services/orchestration/index.ts";
test("orchestration gate scores a parallel request higher than a linear dependency chain", async () => {
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
});
