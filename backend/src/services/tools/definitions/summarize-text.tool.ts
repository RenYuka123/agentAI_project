import type { JsonObject } from "../../../types/common.types.js";
import { createToolInputError } from "../core/tool-errors.js";
import type { AgentTool } from "../core/tool.types.js";

interface SummarizeTextToolInput extends JsonObject {
  /** 要摘要的原始文字。 */
  text: string;
  /** 摘要輸出格式。 */
  format: "paragraph" | "bullets";
  /** 最多保留句數。 */
  maxSentences: number;
}

/**
 * 本地摘要工具先用簡單的斷句規則處理常見句子邊界。
 *
 * @param text 原始文字內容。
 * @returns 切分後的句子陣列。
 */
const splitSentences = (text: string): string[] =>
  text
    .split(/[\r\n]+|(?<=[。！？!?\.])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

/**
 * 從原文中取出前幾句，作為簡單摘要結果。
 *
 * @param text 原始文字內容。
 * @param maxSentences 最多保留的句數。
 * @returns 摘要句子陣列。
 */
const buildSummary = (text: string, maxSentences: number) => {
  const sentences = splitSentences(text);
  return sentences.slice(0, maxSentences);
};

export const summarizeTextTool: AgentTool<SummarizeTextToolInput, JsonObject> = {
  name: "summarize_text",
  description: "Use for summarizing, condensing, or turning text into bullets.",
  metadata: {
    category: "text",
    version: "1.0.0",
    timeoutMs: 1000,
    retryable: false,
    maxRetries: 0,
    idempotent: true,
  },
  inputSchema: {
    type: "object",
    required: ["text"],
    properties: {
      text: {
        type: "string",
        description: "Text that should be summarized.",
      },
      format: {
        type: "string",
        enum: ["paragraph", "bullets"],
        description: "Preferred summary format.",
      },
      maxSentences: {
        type: "number",
        description: "Maximum number of sentences to keep.",
      },
    },
  },
  validateInput: (input) => {
    const text = typeof input.text === "string" ? input.text.trim() : "";
    const format = input.format === "paragraph" ? "paragraph" : "bullets";
    const maxSentences =
      typeof input.maxSentences === "number" && input.maxSentences > 0 ? Math.floor(input.maxSentences) : 3;

    if (!text) {
      throw createToolInputError("summarize_text 需要提供 text 欄位。");
    }

    return {
      text,
      format,
      maxSentences,
    };
  },
  async execute(input) {
    const { format, maxSentences, text } = input;
    const summaryParts = buildSummary(text, maxSentences);
    const summary =
      format === "paragraph"
        ? summaryParts.join(" ")
        : summaryParts.map((sentence) => `- ${sentence}`).join("\n");

    return {
      tool: "summarize_text",
      format,
      summary,
    };
  },
  healthCheck: async () => ({
    ok: true,
    toolName: "summarize_text",
    message: "summarize_text 為本地摘要工具，狀態正常。",
    checkedAt: new Date().toISOString(),
  }),
};
