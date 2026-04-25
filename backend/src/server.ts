import "dotenv/config";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { createApp } from "./app.js";
import { appConfig } from "./config/env.js";
import { initializeDrawGame } from "./services/draw/index.js";
import { logger } from "./utils/logger.js";

const app = createApp();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
});

initializeDrawGame(io);

httpServer.listen(appConfig.port, () => {
  logger.info(`Server running at http://localhost:${appConfig.port}`);
});
