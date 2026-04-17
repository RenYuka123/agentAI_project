/**
 * 先抽出看起來像 JSON 的片段，容忍智障模型偶爾多包一層文字。
 *
 * @param raw 原始字串內容。
 * @returns 最可能可被 JSON.parse 的片段。
 */
const extractJsonCandidate = (raw: string): string => {
  const trimmed = raw.trim();

  if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
    return trimmed;
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
};

/**
 * 安全解析 JSON 字串，失敗時回傳可判斷的錯誤結果。
 *
 * @param raw 原始 JSON 字串。
 * @returns 解析成功或失敗的結果物件。
 */
export const safeJsonParse = (
  raw: string,
): { ok: true; data: unknown } | { ok: false; error: Error } => {
  try {
    return {
      ok: true,
      data: JSON.parse(extractJsonCandidate(raw)),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error : new Error("Failed to parse JSON."),
    };
  }
};
