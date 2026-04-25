import { requestJson } from "./http";
import type { SinglePlayerGuessRequest, SinglePlayerGuessResponse } from "../types/draw.types";

const apiBaseUrl = import.meta.env.VITE_API_URL?.trim() || "";
const singleGuessEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/draw/single/guess` : "/api/draw/single/guess";

export const guessSinglePlayerDrawing = async (
  payload: SinglePlayerGuessRequest,
): Promise<SinglePlayerGuessResponse> =>
  requestJson<SinglePlayerGuessResponse>(singleGuessEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    defaultErrorMessage: "目前無法完成這張圖的猜測。",
  });
