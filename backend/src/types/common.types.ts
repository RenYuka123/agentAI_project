/**
 * JSON 可接受的基礎型別。
 */
export type JsonPrimitive = string | number | boolean | null;

/**
 * 專案內部用來表示 JSON 值的共用型別。
 */
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;

/**
 * 一般 JSON 物件格式。
 */
export interface JsonObject {
  /** JSON 物件的任意鍵值內容。 */
  [key: string]: JsonValue;
}

/**
 * 一般 JSON 陣列格式。
 */
export interface JsonArray extends Array<JsonValue> {}
