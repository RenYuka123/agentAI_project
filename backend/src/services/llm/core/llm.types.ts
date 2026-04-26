import type { AgentDecision, AgentMessage } from "../../agent/index.js";

export interface LlmProvider {
  getAgentDecision(messages: AgentMessage[], signal?: AbortSignal): Promise<AgentDecision>;
  getJsonResponse(messages: AgentMessage[], signal?: AbortSignal): Promise<unknown>;
}
