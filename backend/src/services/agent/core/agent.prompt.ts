import { getSkillByName } from "../../skills/index.js";
import type { AnyAgentTool } from "../../tools/index.js";

/**
 * 組出工具說明文字，提供模型判斷目前有哪些工具可以使用。
 *
 * @param tools 目前可供 agent 使用的工具列表。
 * @returns 工具清單描述文字。
 */
const buildToolDescriptions = (tools: AnyAgentTool[]): string =>
  tools
    .map((tool, index) => {
      const schema = JSON.stringify(tool.inputSchema);
      const metadata = JSON.stringify(tool.metadata);
      return `${index + 1}. ${tool.name}: ${tool.description}\nmetadata: ${metadata}\ninputSchema: ${schema}`;
    })
    .join("\n");

/**
 * 集中管理 prompt 組裝，讓工具描述與回答規則只有一份來源。
 *
 * prompt 內容主要分成三塊：
 * 1. Agent 身分與工具使用原則
 * 2. JSON 回傳格式限制
 * 3. 多步驟工具串接規則
 * 4. 最終回答品質要求，例如同語言、自然語言、不要只回裸數字
 *
 * @param skillName 目前指定的 skill 名稱。
 * @param tools 目前可供 agent 使用的工具列表。
 * @returns 提供給模型的 system prompt。
 */
export const buildAgentSystemPrompt = (tools: AnyAgentTool[], skillName?: string): string => {
  const toolDescriptions = buildToolDescriptions(tools);
  const skill = getSkillByName(skillName);

  return [
    /**
     * 定義 agent 角色，要求模型先判斷是否真的需要工具。
     */
    "You are a tool-using AI agent.",
    "Choose the smallest helpful next action.",
    "Use a tool only when it is genuinely helpful for answering the user.",
    "If the task requires multiple steps, you may call tools across multiple turns.",
    "Call only one tool at a time.",
    "After each tool result, decide whether another tool is needed or whether you can return the final answer.",
    /**
     * 如果指定 skill，將 skill 的場景規則一起提供給模型。
     */
    ...(skill
      ? [
          "Current skill configuration:",
          `Skill name: ${skill.name}`,
          `Skill description: ${skill.description}`,
          skill.prompt,
        ]
      : []),
    /**
     * 告訴模型目前有哪些工具可用，以及每個工具的輸入格式。
     */
    "Available tools:",
    toolDescriptions,
    /**
     * 限制模型只能回固定 JSON，方便後端做安全解析。
     */
    "You must reply with valid JSON only.",
    'If you can answer directly, return {"type":"final","answer":"..."}',
    'If a tool is needed, return {"type":"tool_call","toolName":"...","toolInput":{}}',
    "Never include markdown fences or extra commentary outside JSON.",
    /**
     * 告訴模型多步驟任務應該逐輪規劃，而不是把多個工具塞在同一輪。
     */
    "For multi-step tasks, use the latest tool result as evidence for the next decision.",
    "Do not invent tool results. Only use the actual tool output provided in the conversation.",
    /**
     * 約束最終答案品質，避免模型只回工具原始結果或裸數字。
     */
    "Respond in the same language as the user's latest message.",
    "When returning a final answer, write a helpful natural-language response.",
    "Do not return only a raw number, raw JSON, or raw tool output unless the user explicitly asks for that format.",
    "After a tool result is provided, use it to produce the final answer unless another tool is strictly required.",
  ].join("\n\n");
};
