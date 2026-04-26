/**
 * 工具層專用錯誤，統一保留代碼與可重試資訊。
 */
export class ToolError extends Error {
    /**
     * 建立標準工具錯誤。
     *
     * @param code 錯誤代碼。
     * @param message 錯誤訊息。
     * @param retriable 是否適合重試。
     * @param details 額外補充資訊。
     */
    constructor(code, message, retriable = false, details) {
        super(message);
        this.name = "ToolError";
        this.code = code;
        this.retriable = retriable;
        this.details = details;
    }
}
/**
 * 建立工具輸入驗證錯誤。
 *
 * @param message 錯誤訊息。
 * @param details 額外補充資訊。
 * @returns 統一格式的工具錯誤。
 */
export const createToolInputError = (message, details) => new ToolError("INVALID_TOOL_INPUT", message, false, details);
/**
 * 建立工具執行失敗錯誤。
 *
 * @param message 錯誤訊息。
 * @param retriable 是否適合重試。
 * @param details 額外補充資訊。
 * @returns 統一格式的工具錯誤。
 */
export const createToolExecutionError = (message, retriable = false, details) => new ToolError("TOOL_EXECUTION_FAILED", message, retriable, details);
/**
 * 將未知錯誤統一整理成工具結果可用的格式。
 *
 * @param error 原始錯誤。
 * @returns 標準化後的工具錯誤資訊。
 */
export const normalizeToolError = (error) => {
    if (error instanceof ToolError) {
        return {
            code: error.code,
            message: error.message,
            retriable: error.retriable,
        };
    }
    if (error instanceof Error) {
        return {
            code: "UNKNOWN_TOOL_ERROR",
            message: error.message,
            retriable: false,
        };
    }
    return {
        code: "UNKNOWN_TOOL_ERROR",
        message: "工具執行時發生未知錯誤。",
        retriable: false,
    };
};
