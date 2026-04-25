import { getAgentRoleByName } from "../../agents/index.js";
import type { AgentRoleName } from "../../agents/index.js";
import { calculatorTool, getStockPriceTool, getWeatherTool, summarizeTextTool } from "../../tools/index.js";
import { getSkillByName } from "../../skills/index.js";
import type { AnyAgentTool } from "../../tools/index.js";

const tools: AnyAgentTool[] = [calculatorTool, summarizeTextTool, getStockPriceTool, getWeatherTool];

/**
 * 使用單一工具清單，確保 prompt 與實際執行器使用的是同一批工具。
 *
 * @returns 目前可用的工具清單。
 */
export const getToolList = (skillName?: string, roleName?: AgentRoleName): AnyAgentTool[] => {
  const skill = getSkillByName(skillName);
  const role = getAgentRoleByName(roleName || "primary");
  const roleScopedTools =
    role && Array.isArray(role.allowedTools)
      ? tools.filter((tool) => role.allowedTools?.includes(tool.name))
      : tools;

  if (!skill?.allowedTools?.length) {
    return roleScopedTools;
  }

  return roleScopedTools.filter((tool) => skill.allowedTools?.includes(tool.name));
};

/**
 * 依名稱查詢指定工具。
 *
 * @param name 工具名稱。
 * @returns 找到時回傳對應工具，否則回傳 undefined。
 */
export const getToolByName = (name: string): AnyAgentTool | undefined => tools.find((tool) => tool.name === name);
