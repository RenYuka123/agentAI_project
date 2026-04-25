export type AgentRoleName = "primary" | "planner" | "worker";

/**
 * 定義不同 agent role 的行為配置。
 */
export interface AgentRoleConfig {
  /** Role 唯一名稱。 */
  name: AgentRoleName;
  /** Role 用途描述。 */
  description: string;
  /** 額外提供給模型的角色規則。 */
  prompt: string;
  /** 該 role 可使用的工具名稱清單。 */
  allowedTools?: string[];
  /** 該 role 預設建議的最大 loop 次數。 */
  maxLoops?: number;
  /** Role 預期輸出型態。 */
  outputMode?: "freeform" | "task_result";
}
