import { investmentAnalysisSkill } from "../definitions/investment-analysis.skill.js";
import { weatherSummarySkill } from "../definitions/weather-summary.skill.js";
import type { AgentSkill } from "../index.js";

const skills: AgentSkill[] = [investmentAnalysisSkill, weatherSummarySkill];

/**
 * 取得目前可用的 skill 清單。
 *
 * @returns 所有已註冊的 skill。
 */
export const getSkillList = (): AgentSkill[] => skills;

/**
 * 依名稱查詢 skill。
 *
 * @param name skill 名稱。
 * @returns 找到時回傳對應 skill，否則回傳 undefined。
 */
export const getSkillByName = (name?: string): AgentSkill | undefined => {
  if (!name) {
    return undefined;
  }

  return skills.find((skill) => skill.name === name);
};
