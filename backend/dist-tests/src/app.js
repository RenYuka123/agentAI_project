import cors from "cors";
import express from "express";
import routes from "./routes/index.js";
import { logger } from "./utils/logger.js";
/**
 * 集中建立 Express app，讓伺服器啟動邏輯保持單純。
 *
 * @returns 完成中介層與路由設定的 Express app。
 */
export const createApp = () => {
    const app = express();
    /**
     * 啟用跨來源請求，方便前端在不同 port 開發時可直接呼叫 API。
     */
    app.use(cors());
    /**
     * 解析 JSON request body，讓 controller 可直接從 req.body 取值。
     */
    app.use(express.json());
    /**
     * 掛載應用程式的所有路由入口。
     */
    app.use(routes);
    /**
     * 統一處理請求流程中未攔截的錯誤，避免直接把例外拋回客戶端。
     */
    app.use((error, _req, res, _next) => {
        logger.error("Unhandled request error", error);
        const message = error instanceof Error ? error.message : "Internal server error";
        res.status(500).json({
            error: message,
        });
    });
    return app;
};
