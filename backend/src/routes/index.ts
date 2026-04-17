import { Router } from "express";
import agentRoutes from "./agent.route.js";
import healthRoutes from "./health.js";

const router = Router();

router.use(healthRoutes);
router.use("/api/agent", agentRoutes);

export default router;
