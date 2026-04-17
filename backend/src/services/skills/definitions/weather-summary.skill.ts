import type { AgentSkill } from "../index.js";

/**
 * 天氣摘要 skill，聚焦在天氣查詢、重點整理與生活提醒。
 */
export const weatherSummarySkill: AgentSkill = {
  name: "weather_summary",
  description: "Focus on weather lookups, concise summaries, and practical daily suggestions.",
  prompt: [
    "Current skill: weather_summary.",
    "Focus on weather-related questions, current conditions, and concise practical summaries.",
    "Prefer using get_weather whenever weather data is needed instead of guessing.",
    "When returning the final answer, first provide a short conclusion, then include 2 to 4 key points if useful.",
    "If rain, wind, or temperature feels notable, proactively mention daily suggestions such as bringing an umbrella or adjusting clothing.",
  ].join("\n"),
  allowedTools: ["get_weather", "summarize_text"],
};
