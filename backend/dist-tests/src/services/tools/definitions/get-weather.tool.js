import { appConfig } from "../../../config/env.js";
import { createToolExecutionError, createToolInputError } from "../core/tool-errors.js";
const taiwanLocationAliases = {
    台北: "Taipei",
    臺北: "Taipei",
    台北市: "Taipei",
    臺北市: "Taipei",
    新北: "New Taipei",
    新北市: "New Taipei",
    台中: "Taichung",
    臺中: "Taichung",
    台中市: "Taichung",
    臺中市: "Taichung",
    台南: "Tainan",
    臺南: "Tainan",
    台南市: "Tainan",
    臺南市: "Tainan",
    高雄: "Kaohsiung",
    高雄市: "Kaohsiung",
    桃園: "Taoyuan",
    桃園市: "Taoyuan",
    新竹: "Hsinchu",
    新竹市: "Hsinchu",
    基隆: "Keelung",
    基隆市: "Keelung",
    嘉義: "Chiayi",
    嘉義市: "Chiayi",
    嘉義縣: "Chiayi County",
    宜蘭: "Yilan",
    宜蘭縣: "Yilan County",
    花蓮: "Hualien",
    花蓮縣: "Hualien County",
    台東: "Taitung",
    臺東: "Taitung",
    台東縣: "Taitung County",
    臺東縣: "Taitung County",
    苗栗: "Miaoli",
    苗栗縣: "Miaoli County",
    彰化: "Changhua",
    彰化縣: "Changhua County",
    南投: "Nantou",
    南投縣: "Nantou County",
    雲林: "Yunlin",
    雲林縣: "Yunlin County",
    屏東: "Pingtung",
    屏東縣: "Pingtung County",
    澎湖: "Penghu",
    澎湖縣: "Penghu County",
    金門: "Kinmen",
    金門縣: "Kinmen County",
    連江: "Lienchiang",
    連江縣: "Lienchiang County",
};
/**
 * 將常見中文地名正規化，提升 geocoding 第一次命中率。
 *
 * @param location 使用者原始地點輸入。
 * @param countryCode 使用者原始國碼。
 * @returns 正規化後的地點與國碼。
 */
const normalizeWeatherLocation = (location, countryCode) => {
    const trimmedLocation = location.trim();
    const normalizedChineseLocation = trimmedLocation.replace(/台/g, "臺");
    const aliasLocation = taiwanLocationAliases[trimmedLocation] ??
        taiwanLocationAliases[normalizedChineseLocation] ??
        trimmedLocation;
    const resolvedCountryCode = countryCode ??
        (taiwanLocationAliases[trimmedLocation] || taiwanLocationAliases[normalizedChineseLocation] ? "TW" : null);
    return {
        location: aliasLocation,
        countryCode: resolvedCountryCode,
    };
};
/**
 * WMO weather code 對照簡短中文描述。
 */
const getWeatherCodeDescription = (weatherCode) => {
    const weatherCodeMap = {
        0: "晴朗",
        1: "大致晴朗",
        2: "局部多雲",
        3: "陰天",
        45: "霧",
        48: "霧凇",
        51: "毛毛雨",
        53: "間歇毛毛雨",
        55: "濃毛毛雨",
        56: "凍毛毛雨",
        57: "強凍毛毛雨",
        61: "小雨",
        63: "雨",
        65: "大雨",
        66: "凍雨",
        67: "強凍雨",
        71: "小雪",
        73: "降雪",
        75: "大雪",
        77: "冰粒",
        80: "陣雨",
        81: "強陣雨",
        82: "豪大陣雨",
        85: "陣雪",
        86: "強陣雪",
        95: "雷雨",
        96: "雷雨伴隨冰雹",
        99: "強雷雨伴隨冰雹",
    };
    if (typeof weatherCode !== "number") {
        return "未知天氣";
    }
    return weatherCodeMap[weatherCode] ?? `天氣代碼 ${weatherCode}`;
};
/**
 * 查詢地點名稱對應的經緯度。
 *
 * @param input 工具輸入資料。
 * @returns 第一筆最匹配的地點資料。
 */
const geocodeLocation = async (input, signal) => {
    const normalizedLocation = normalizeWeatherLocation(input.location, input.countryCode);
    const url = new URL(appConfig.weatherGeocodingApiUrl);
    url.searchParams.set("name", normalizedLocation.location);
    url.searchParams.set("count", "1");
    url.searchParams.set("language", input.language ?? "zh");
    url.searchParams.set("format", "json");
    if (normalizedLocation.countryCode) {
        url.searchParams.set("countryCode", normalizedLocation.countryCode);
    }
    const response = await fetch(url, {
        method: "GET",
        signal,
    });
    if (!response.ok) {
        throw createToolExecutionError(`地點查詢失敗：${response.status}`, true, {
            location: normalizedLocation.location,
            status: response.status,
        });
    }
    const payload = (await response.json());
    const matchedLocation = payload.results?.[0];
    if (!matchedLocation || typeof matchedLocation.latitude !== "number" || typeof matchedLocation.longitude !== "number") {
        throw createToolExecutionError(`找不到地點：${input.location}`, false, {
            location: input.location,
            normalizedLocation: normalizedLocation.location,
            countryCode: normalizedLocation.countryCode,
        });
    }
    if (normalizedLocation.countryCode && matchedLocation.country_code && matchedLocation.country_code !== normalizedLocation.countryCode) {
        throw createToolExecutionError(`找不到符合國碼的地點：${input.location}`, false, {
            location: input.location,
            normalizedLocation: normalizedLocation.location,
            expectedCountryCode: normalizedLocation.countryCode,
            actualCountryCode: matchedLocation.country_code,
        });
    }
    return matchedLocation;
};
/**
 * 使用 Open-Meteo forecast API 取得目前天氣。
 *
 * @param location 已解析的地點資料。
 * @returns Forecast API 回傳內容。
 */
const fetchWeatherForecast = async (location, signal) => {
    const url = new URL(appConfig.weatherApiUrl);
    url.searchParams.set("latitude", String(location.latitude));
    url.searchParams.set("longitude", String(location.longitude));
    url.searchParams.set("current", [
        "temperature_2m",
        "relative_humidity_2m",
        "apparent_temperature",
        "precipitation",
        "weather_code",
        "cloud_cover",
        "wind_speed_10m",
        "wind_direction_10m",
        "wind_gusts_10m",
        "is_day",
    ].join(","));
    url.searchParams.set("timezone", location.timezone ?? "auto");
    const response = await fetch(url, {
        method: "GET",
        signal,
    });
    if (!response.ok) {
        throw createToolExecutionError(`天氣查詢失敗：${response.status}`, true, {
            latitude: location.latitude ?? null,
            longitude: location.longitude ?? null,
            status: response.status,
        });
    }
    return (await response.json());
};
/**
 * 檢查 Open-Meteo 相關 API 設定是否合理。
 *
 * @returns 工具健康狀態。
 */
const checkWeatherToolHealth = async () => {
    try {
        const weatherUrl = new URL(appConfig.weatherApiUrl);
        const geocodingUrl = new URL(appConfig.weatherGeocodingApiUrl);
        return {
            ok: true,
            toolName: "get_weather",
            message: "Open-Meteo API URL 設定正常。",
            checkedAt: new Date().toISOString(),
            details: {
                weatherHost: weatherUrl.host,
                geocodingHost: geocodingUrl.host,
            },
        };
    }
    catch {
        return {
            ok: false,
            toolName: "get_weather",
            message: "Open-Meteo API URL 設定格式不正確。",
            checkedAt: new Date().toISOString(),
        };
    }
};
/**
 * 透過 Open-Meteo 取得目前天氣資訊。
 */
export const getWeatherTool = {
    name: "get_weather",
    description: "Use for weather lookups when the user asks about current weather for a location.",
    metadata: {
        category: "text",
        version: "1.0.0",
        timeoutMs: 5000,
        retryable: true,
        maxRetries: 1,
        idempotent: true,
    },
    inputSchema: {
        type: "object",
        required: ["location"],
        properties: {
            location: {
                type: "string",
                description: "Location name such as Taipei or Tokyo.",
            },
            countryCode: {
                type: "string",
                description: "Optional ISO-3166-1 alpha2 country code filter such as TW or JP.",
            },
            language: {
                type: "string",
                description: "Optional response language for geocoding, such as zh or en.",
            },
        },
    },
    validateInput: (input) => {
        const location = typeof input.location === "string" ? input.location.trim() : "";
        const countryCode = typeof input.countryCode === "string" ? input.countryCode.trim().toUpperCase() : null;
        const language = typeof input.language === "string" ? input.language.trim().toLowerCase() : null;
        if (!location) {
            throw createToolInputError("get_weather 需要提供 location 欄位。");
        }
        return {
            location,
            countryCode,
            language,
        };
    },
    execute: async (input, context) => {
        const location = await geocodeLocation(input, context?.signal);
        const forecast = await fetchWeatherForecast(location, context?.signal);
        const current = forecast.current;
        if (!current) {
            throw createToolExecutionError("目前無法取得即時天氣資料。", true, {
                location: input.location,
            });
        }
        return {
            tool: "get_weather",
            location: {
                name: location.name ?? input.location,
                country: location.country ?? "",
                countryCode: location.country_code ?? "",
                admin1: location.admin1 ?? "",
                latitude: location.latitude ?? null,
                longitude: location.longitude ?? null,
                timezone: location.timezone ?? forecast.timezone ?? "",
            },
            current: {
                time: current.time ?? "",
                weatherCode: current.weather_code ?? null,
                weatherDescription: getWeatherCodeDescription(current.weather_code),
                temperatureC: current.temperature_2m ?? null,
                apparentTemperatureC: current.apparent_temperature ?? null,
                relativeHumidity: current.relative_humidity_2m ?? null,
                precipitation: current.precipitation ?? null,
                cloudCover: current.cloud_cover ?? null,
                windSpeedKmH: current.wind_speed_10m ?? null,
                windDirection: current.wind_direction_10m ?? null,
                windGustsKmH: current.wind_gusts_10m ?? null,
                isDay: current.is_day === 1,
            },
            source: "open-meteo",
        };
    },
    healthCheck: checkWeatherToolHealth,
};
