/**
 * 投資分析 skill，聚焦在股價查詢、簡單試算與投資語境回答。
 */
export const investmentAnalysisSkill = {
    name: "investment_analysis",
    description: "Focus on investment questions, price lookups, and simple return calculations.",
    prompt: [
        "Current skill: investment_analysis.",
        "Focus on investment-related questions, price lookups, and simple return calculations.",
        "Prefer concise, market-oriented explanations with accurate numbers.",
        "If a price lookup or calculation is needed, use the available tools instead of guessing.",
    ].join("\n"),
    allowedTools: ["get_stock_price", "calculator", "summarize_text"],
    routingHints: [
        "股價",
        "股票",
        "etf",
        "price",
        "報酬",
        "投資",
        "0050",
        "aapl",
        "tsla",
        "複利",
        "年化",
    ],
};
