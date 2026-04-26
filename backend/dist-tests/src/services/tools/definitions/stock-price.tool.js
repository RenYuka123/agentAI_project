import { appConfig } from "../../../config/env.js";
import { createToolExecutionError, createToolInputError } from "../core/tool-errors.js";
/**
 * 將日期轉成 TWSE STOCK_DAY 需要的 YYYYMM01 格式。
 *
 * @param date JavaScript 日期物件。
 * @returns 查詢月份的第一天字串。
 */
const formatTwseMonthDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${year}${month}01`;
};
/**
 * 將 TWSE 回傳的數字字串轉成 number，並過濾無效值。
 *
 * @param value 原始欄位值。
 * @returns 可用數字或 null。
 */
const parseTwseNumber = (value) => {
    if (!value) {
        return null;
    }
    const normalized = value.replace(/,/g, "").trim();
    if (!normalized || normalized === "--" || normalized === "X0.00") {
        return null;
    }
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
};
/**
 * 從 TWSE 月資料中找出最新一筆有效收盤價。
 *
 * @param payload TWSE STOCK_DAY 回傳資料。
 * @param symbol 股票代號。
 * @returns 整理後的股價資料或 null。
 */
const extractLatestStockPrice = (payload, symbol) => {
    const closePriceIndex = payload.fields?.findIndex((field) => field.includes("收盤價")) ?? -1;
    if (closePriceIndex < 0 || !payload.data?.length) {
        return null;
    }
    for (let index = payload.data.length - 1; index >= 0; index -= 1) {
        const row = payload.data[index];
        const price = parseTwseNumber(row?.[closePriceIndex]);
        if (price === null) {
            continue;
        }
        return {
            symbol,
            price,
            currency: "TWD",
            asOf: row?.[0] ?? payload.date,
            source: "twse",
        };
    }
    return null;
};
/**
 * 把報價服務的 HTTP 細節封裝起來，避免污染 tool 介面。
 *
 * @param symbol 股票代號。
 * @returns 成功時回傳報價資料，未設定供應商時回傳 null。
 */
const fetchStockPrice = async (symbol, signal) => {
    if (!appConfig.stockPriceApiUrl) {
        return null;
    }
    const monthsToTry = [0, -1].map((offset) => {
        const date = new Date();
        date.setMonth(date.getMonth() + offset);
        return formatTwseMonthDate(date);
    });
    for (const monthDate of monthsToTry) {
        const url = new URL(appConfig.stockPriceApiUrl);
        url.searchParams.set("response", "json");
        url.searchParams.set("date", monthDate);
        url.searchParams.set("stockNo", symbol);
        const response = await fetch(url, {
            headers: appConfig.stockPriceApiKey
                ? {
                    Authorization: `Bearer ${appConfig.stockPriceApiKey}`,
                }
                : undefined,
            method: "GET",
            signal,
        });
        if (!response.ok) {
            throw createToolExecutionError(`股價查詢請求失敗：${response.status}`, true, {
                symbol,
                status: response.status,
            });
        }
        const payload = (await response.json());
        if (payload.stat && !payload.stat.includes("OK")) {
            continue;
        }
        const latestPrice = extractLatestStockPrice(payload, symbol);
        if (latestPrice) {
            return latestPrice;
        }
    }
    return null;
};
/**
 * 檢查股價工具的基本可用性。
 *
 * @returns 工具健康狀態。
 */
const checkStockPriceToolHealth = async () => {
    if (!appConfig.stockPriceApiUrl) {
        return {
            ok: false,
            toolName: "get_stock_price",
            message: "未設定股價查詢 API URL。",
            checkedAt: new Date().toISOString(),
        };
    }
    try {
        const url = new URL(appConfig.stockPriceApiUrl);
        return {
            ok: true,
            toolName: "get_stock_price",
            message: "股價查詢 API URL 設定正常。",
            checkedAt: new Date().toISOString(),
            details: {
                host: url.host,
            },
        };
    }
    catch {
        return {
            ok: false,
            toolName: "get_stock_price",
            message: "股價查詢 API URL 格式不正確。",
            checkedAt: new Date().toISOString(),
        };
    }
};
export const getStockPriceTool = {
    name: "get_stock_price",
    description: "Use for stock or ETF price lookups when a symbol is provided.",
    metadata: {
        category: "finance",
        version: "1.0.0",
        timeoutMs: 5000,
        retryable: true,
        maxRetries: 1,
        idempotent: true,
    },
    inputSchema: {
        type: "object",
        required: ["symbol"],
        properties: {
            symbol: {
                type: "string",
                description: "Ticker symbol such as AAPL or 0050.",
            },
        },
    },
    validateInput: (input) => {
        const symbol = typeof input.symbol === "string" ? input.symbol.trim().toUpperCase() : "";
        if (!symbol) {
            throw createToolInputError("get_stock_price 需要提供 symbol 欄位。");
        }
        return {
            symbol,
        };
    },
    async execute(input, context) {
        const { symbol } = input;
        const data = await fetchStockPrice(symbol, context?.signal);
        if (!data || typeof data.price !== "number") {
            const unavailableResult = {
                tool: "get_stock_price",
                symbol,
                available: false,
                message: "目前無法從 TWSE 取得股價資料。",
            };
            return unavailableResult;
        }
        const successResult = {
            tool: "get_stock_price",
            symbol: data.symbol ?? symbol,
            price: data.price,
            currency: data.currency ?? "TWD",
            asOf: data.asOf ?? new Date().toISOString(),
            source: data.source ?? "twse",
        };
        return successResult;
    },
    healthCheck: checkStockPriceToolHealth,
};
