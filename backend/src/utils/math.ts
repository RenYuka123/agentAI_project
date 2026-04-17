import { all, create } from "mathjs";

const math = create(all, {});

math.import(
  {
    import: () => {
      throw new Error("Function import is disabled.");
    },
    createUnit: () => {
      throw new Error("Function createUnit is disabled.");
    },
    reviver: () => {
      throw new Error("Function reviver is disabled.");
    },
  },
  {
    override: true,
  },
);

/**
 * 先整理使用者輸入的運算式，避免空字串或多餘空白直接進入計算流程。
 *
 * @param expression 使用者輸入的運算式。
 * @returns 清理後可交給 math.js 的運算式。
 */
const normalizeExpression = (expression: string): string => {
  const normalized = expression.trim();

  if (!normalized) {
    throw new Error("Expression is required.");
  }

  return normalized;
};

/**
 * 將 math.js 的輸出限制為一般數值，避免回傳複數、矩陣等非預期型別。
 *
 * @param value math.js 計算後的結果。
 * @returns 可回給 calculator tool 的數值結果。
 */
const toFiniteNumber = (value: unknown): number => {
  if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) {
    throw new Error("Expression did not evaluate to a finite number.");
  }

  return Number(value.toFixed(8));
};

/**
 * 計算基礎數學運算式，並將結果限制在固定小數精度。
 *
 * @param expression 要計算的數學運算式。
 * @returns 運算完成後的數值結果。
 */
export const evaluateMathExpression = (expression: string): number => {
  const normalized = normalizeExpression(expression);
  const value = math.evaluate(normalized);

  return toFiniteNumber(value);
};
