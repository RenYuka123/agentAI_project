import { getSkillByName, getSkillList } from "./skill-registry.js";
const followUpPattern = /^(那|那如果|那今天|那明天|那現在|那也|再|還有|另外|順便|呢|也幫我|也可以|適合|需要)/i;
const investmentContextPattern = /(股價|股票|etf|報酬|投資|複利|年化|0050|006208|aapl|tsla)/i;
/**
 * 將訊息整理成 skill 判斷用的文字上下文。
 *
 * @param historyMessages 既有 session 歷史訊息。
 * @param userMessage 本輪使用者訊息。
 * @returns 供 skill selector 使用的正規化文字。
 */
const buildRoutingContext = (historyMessages, userMessage) => [
    ...historyMessages.slice(-8),
    {
        role: "user",
        content: userMessage,
    },
]
    .map((message) => {
    if (message.role === "tool" && message.toolName) {
        return `${message.role}:${message.toolName}:${message.content}`;
    }
    return `${message.role}:${message.content}`;
})
    .join("\n")
    .toLowerCase();
/**
 * 根據既有歷史訊息，推估前一段對話較接近哪個 skill。
 *
 * @param historyMessages 既有 session 歷史訊息。
 * @returns 推估出的 skill 名稱。
 */
const inferSkillFromHistory = (historyMessages) => {
    const recentMessages = historyMessages.slice(-10);
    const usedWeatherTool = recentMessages.some((message) => message.role === "tool" && message.toolName === "get_weather");
    if (usedWeatherTool) {
        return "weather_summary";
    }
    const usedInvestmentTool = recentMessages.some((message) => message.role === "tool" &&
        message.toolName === "get_stock_price");
    if (usedInvestmentTool) {
        return "investment_analysis";
    }
    const usedCalculator = recentMessages.some((message) => message.role === "tool" && message.toolName === "calculator");
    const hasInvestmentContext = recentMessages.some((message) => message.role !== "tool" && investmentContextPattern.test(message.content));
    if (usedCalculator && hasInvestmentContext) {
        return "investment_analysis";
    }
    return undefined;
};
/**
 * 依據歷史與本輪訊息，自動判斷最適合的 skill。
 *
 * @param input skill 判斷所需資料。
 * @returns 最終 skill 與選擇說明。
 */
export const resolveSkillSelection = (input) => {
    const { historyMessages = [], requestedSkillName, userMessage } = input;
    const manualSkill = getSkillByName(requestedSkillName);
    if (manualSkill) {
        return {
            skillName: manualSkill.name,
            source: "manual",
            reason: `由外部明確指定 skill：${manualSkill.name}`,
        };
    }
    const routingContext = buildRoutingContext(historyMessages, userMessage);
    const matchedSkills = getSkillList()
        .map((skill) => {
        const matchedHints = (skill.routingHints ?? []).filter((hint) => routingContext.includes(hint.toLowerCase()));
        return {
            skill,
            score: matchedHints.length,
            matchedHints,
        };
    })
        .sort((left, right) => right.score - left.score);
    const topMatchedSkill = matchedSkills.find((candidate) => candidate.score > 0);
    if (topMatchedSkill) {
        return {
            skillName: topMatchedSkill.skill.name,
            source: "auto",
            reason: `依關鍵字判斷為 ${topMatchedSkill.skill.name}：${topMatchedSkill.matchedHints.join(", ")}`,
        };
    }
    const inferredHistorySkill = inferSkillFromHistory(historyMessages);
    if (inferredHistorySkill && followUpPattern.test(userMessage.trim())) {
        return {
            skillName: inferredHistorySkill,
            source: "auto",
            reason: `本輪訊息看起來是延續追問，因此沿用前一段對話 skill：${inferredHistorySkill}`,
        };
    }
    return {
        source: "default",
        reason: "未命中特定 skill，改用預設 agent 流程。",
    };
};
