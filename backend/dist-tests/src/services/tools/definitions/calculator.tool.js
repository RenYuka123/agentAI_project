import { evaluateMathExpression } from "../../../utils/math.js";
import { createToolExecutionError, createToolInputError } from "../core/tool-errors.js";
/**
 * 提供基礎數學與複利類型計算的工具定義。
 */
export const calculatorTool = {
    name: "calculator",
    description: "Use for arithmetic and compound-growth style calculations.",
    metadata: {
        category: "math",
        version: "1.0.0",
        timeoutMs: 1000,
        retryable: false,
        maxRetries: 0,
        idempotent: true,
    },
    inputSchema: {
        type: "object",
        required: ["expression"],
        properties: {
            expression: {
                type: "string",
                description: "A math expression such as 10000 * 1.05^3",
            },
        },
    },
    validateInput: (input) => {
        const expression = typeof input.expression === "string" ? input.expression.trim() : "";
        if (!expression) {
            throw createToolInputError("calculator 需要提供 expression 欄位。");
        }
        return {
            expression,
        };
    },
    async execute(input) {
        const { expression } = input;
        try {
            const value = evaluateMathExpression(expression);
            return {
                tool: "calculator",
                expression,
                result: value,
            };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "未知錯誤";
            throw createToolExecutionError(`無法解析或計算數學式：${message}`);
        }
    },
    healthCheck: async () => ({
        ok: true,
        toolName: "calculator",
        message: "calculator 為本地計算工具，狀態正常。",
        checkedAt: new Date().toISOString(),
    }),
};
