import "dotenv/config";
import { createApp } from "./app.js";
import { appConfig } from "./config/env.js";
import { logger } from "./utils/logger.js";

const app = createApp();

app.listen(appConfig.port, () => {
  logger.info(`Server running at http://localhost:${appConfig.port}`);
});
