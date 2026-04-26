import { Router } from "express";
import { guessSinglePlayerDrawing } from "../controllers/draw.controller.js";
const router = Router();
router.post("/single/guess", guessSinglePlayerDrawing);
export default router;
