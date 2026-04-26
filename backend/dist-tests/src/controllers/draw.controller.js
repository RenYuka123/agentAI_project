import { singlePlayerService } from "../services/draw/core/single-player.service.js";
export const guessSinglePlayerDrawing = async (req, res) => {
    const answer = req.body?.answer?.trim();
    const imageDataUrl = req.body?.imageDataUrl?.trim();
    const timedOut = Boolean(req.body?.timedOut);
    if (!answer) {
        res.status(400).json({
            guess: "",
            comment: "",
            confidence: "low",
            isCorrect: false,
            error: "`answer` is required.",
        });
        return;
    }
    if (!imageDataUrl) {
        res.status(400).json({
            guess: "",
            comment: "",
            confidence: "low",
            isCorrect: false,
            error: "`imageDataUrl` is required.",
        });
        return;
    }
    try {
        const result = await singlePlayerService.guessDrawing({
            answer,
            imageDataUrl,
            timedOut,
        });
        res.json(result);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Internal server error";
        res.status(500).json({
            guess: "",
            comment: "",
            confidence: "low",
            isCorrect: false,
            error: errorMessage,
        });
    }
};
