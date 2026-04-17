import type { ApiErrorResponse } from "../types/api.types";

/**
 * HTTP 請求可接受的基本設定。
 */
export interface RequestOptions extends RequestInit {
  /** 失敗時的預設錯誤訊息。 */
  defaultErrorMessage?: string;
}

/**
 * 將 fetch 與 JSON 解析封裝成可重用的泛型 helper。
 *
 * @param url 要呼叫的 API 路徑。
 * @param options fetch 設定與預設錯誤訊息。
 * @returns 已完成型別轉換的 API 回應資料。
 */
export const requestJson = async <TResponse>(url: string, options: RequestOptions = {}): Promise<TResponse> => {
  const { defaultErrorMessage = "API 請求失敗。", ...fetchOptions } = options;

  const response: Response = await fetch(url, fetchOptions);
  const data = (await response.json()) as TResponse & Partial<ApiErrorResponse>;

  if (!response.ok) {
    throw new Error(data.error || defaultErrorMessage);
  }

  return data;
};
