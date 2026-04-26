import test from "node:test";
import assert from "node:assert/strict";
import { resolveSkillSelection } from "../src/services/skills/index.ts";
test("skill selector does not infer investment analysis from calculator history alone", () => {
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
});
test("skill selector keeps investment analysis when calculator history is paired with investment context", () => {
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
});
