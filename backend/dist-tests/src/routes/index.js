import { Router } from "express";
import agentRoutes from "./agent.route.js";
import drawRoutes from "./draw.route.js";
import healthRoutes from "./health.js";
const router = Router();
router.use(healthRoutes);
router.use("/api/agent", agentRoutes);
router.use("/api/draw", drawRoutes);
export default router;
