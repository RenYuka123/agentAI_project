import type { AgentDecision, AgentMessage } from "../../agent/index.js";

export interface LlmProvider {
  getAgentDecision(messages: AgentMessage[]): Promise<AgentDecision>;
}
