import { createHash } from "crypto";
import { PNG } from "pngjs";
import { llmConfig } from "../../../config/llm.js";
import { logger } from "../../../utils/logger.js";
import { safeJsonParse } from "../../../utils/safe-json.js";
import { DRAW_WORDS } from "./draw.constants.js";

type GuessConfidence = "high" | "medium" | "low";

export interface SinglePlayerGuessInput {
  answer: string;
  imageDataUrl: string;
  timedOut?: boolean;
}

export interface SinglePlayerGuessResult {
  guess: string;
  comment: string;
  confidence: GuessConfidence;
  isCorrect: boolean;
}

interface DrawingAnalysis {
  coverage: number;
  distinctColorCount: number;
  qualityScore: number;
  isBlank: boolean;
}

interface VisionGuessPayload {
  guess?: unknown;
  comment?: unknown;
  confidence?: unknown;
}

interface ResponsesApiResponse {
  output_text?: string;
}

const parsePngDataUrl = (imageDataUrl: string): PNG => {
  const base64 = imageDataUrl.replace(/^data:image\/png;base64,/, "");

  if (!base64 || base64 === imageDataUrl) {
    throw new Error("Invalid PNG data URL.");
  }

  const buffer = Buffer.from(base64, "base64");
  return PNG.sync.read(buffer);
};

/* Analyzes the drawing and returns its characteristics */
const analyzeDrawing = (imageDataUrl: string): DrawingAnalysis => {
  /* 將 Base64 字串解析成像素矩陣 (RGBA) */
  const png = parsePngDataUrl(imageDataUrl);
  /* 計算畫布總像素量，作為比例基準 */
  const totalPixels = png.width * png.height;
  /* 統計「有畫過」的像素數量 */
  let paintedPixels = 0;
  /* 統計「筆觸能量」（顏色越深、越重，能量越高） */
  let strokeEnergy = 0;
  /* 統計「不同顏色」的數量 */
  const distinctColors = new Set<string>();

  for (let index = 0; index < png.data.length; index += 16) {
    /* index 代表紅(R), index+1 綠(G), index+2 藍(B), index+3 透明度(A) */
    const red = png.data[index];
    const green = png.data[index + 1];
    const blue = png.data[index + 2];
    const alpha = png.data[index + 3];

    /* 檢查透明度，如果完全透明則跳過 */
    if (alpha === 0) {
      continue;
    }

    /* 檢查是否接近白色，如果是則跳過 */
    const nearWhite = red > 245 && green > 245 && blue > 245;
    if (nearWhite) {
      continue;
    }

    /* 因為步長是 16（跳過了 4 個像素），所以這裡加 4 來還原比例 */
    paintedPixels += 4;
    /* 讓顏色越深（如黑色）的點貢獻更高的分數。 */
    strokeEnergy += (255 - red + (255 - green) + (255 - blue)) / (255 * 3);
    /* 避免微小的色差被誤認為不同顏色，只有當顏色差異夠大時，distinctColors 的數量才會增加。 */
    distinctColors.add(
      `${Math.round(red / 32)}-${Math.round(green / 32)}-${Math.round(blue / 32)}`,
    );
  }

  /* 計算各項指標 */
  /* 覆蓋率 */
  const coverage = Math.min(1, paintedPixels / totalPixels);
  /* 筆觸分數 */
  const strokeScore = Math.min(1, strokeEnergy / Math.max(1, paintedPixels));
  /* 顏色分數 */
  const colorScore = Math.min(1, distinctColors.size / 6);
  /**
   * 總體品質分數
   * 覆蓋率權重最高 (3.2)：這意味著「畫得面積夠大」是判定好壞的最主要標準。
   * 色彩與深淺為輔：即使只用一種顏色，只要畫得夠多，分數依然會很高。
   *  */
  const qualityScore = Math.min(
    1,
    coverage * 3.2 + strokeScore * 0.25 + colorScore * 0.2,
  );

  return {
    coverage,
    distinctColorCount: distinctColors.size,
    qualityScore,
    isBlank: coverage < 0.003,
  };
};

const normalize = (value: string): string => value.trim().toLowerCase();

const isGuessCorrect = (guess: string, answer: string): boolean => {
  const normalizedGuess = normalize(guess);
  const normalizedAnswer = normalize(answer);

  if (!normalizedGuess || !normalizedAnswer) {
    return false;
  }

  return (
    normalizedGuess === normalizedAnswer ||
    normalizedGuess.includes(normalizedAnswer) ||
    normalizedAnswer.includes(normalizedGuess)
  );
};

const pickWrongGuess = (answer: string, seed: string): string => {
  const candidates = DRAW_WORDS.filter((word) => word !== answer);

  if (candidates.length === 0) {
    return "???";
  }

  const index = Math.floor(createDeterministicRandom(seed) * candidates.length);
  return candidates[index] ?? "???";
};

/**
 * 讓 heuristic 模式對同一份輸入維持穩定結果，避免每次重新送出都得到不同答案。
 *
 * @param seed 用來產生穩定亂數的字串。
 * @returns 0 到 1 之間的穩定數值。
 */
const createDeterministicRandom = (seed: string): number => {
  const digest = createHash("sha256").update(seed).digest("hex");
  const head = digest.slice(0, 8);
  const numericValue = Number.parseInt(head, 16);

  return numericValue / 0xffffffff;
};

const isGuessConfidence = (value: unknown): value is GuessConfidence => {
  return value === "high" || value === "medium" || value === "low";
};

const buildVisionPrompt = (timedOut: boolean): string => {
  const timeoutInstruction = timedOut
    ? "這張圖是時間到後自動送出的未完成作品，請把這件事納入判斷。"
    : "這張圖是玩家主動提交的作品。";

  return [
    "你在扮演畫圖猜詞遊戲的 AI 猜題者。",
    timeoutInstruction,
    "請只根據圖片內容猜一個最像的詞。",
    "請只回傳 JSON，格式如下：",
    '{"guess":"你猜的詞","comment":"一句繁體中文短評，不超過20字","confidence":"high|medium|low"}',
    "不要輸出 markdown，不要補充其他文字。",
  ].join("\n");
};

/* 向視覺模型請求猜測 */
const requestVisionGuess = async (
  imageDataUrl: string,
  answer: string,
  timedOut: boolean,
): Promise<Omit<SinglePlayerGuessResult, "isCorrect"> | null> => {
  if (!llmConfig.apiKey) {
    logger.warn(
      "Single player vision is unavailable because LLM_API_KEY is missing.",
    );
    return null;
  }

  const response = await fetch(`${llmConfig.baseUrl}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${llmConfig.apiKey}`,
    },
    body: JSON.stringify({
      model: llmConfig.model,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: buildVisionPrompt(timedOut),
            },
            {
              type: "input_image",
              image_url: imageDataUrl,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.warn(
      "Single player vision request failed, falling back to heuristic mode.",
      {
        status: response.status,
        errorText,
        model: llmConfig.model,
      },
    );
    return null;
  }

  const data = (await response.json()) as ResponsesApiResponse;
  const outputText = data.output_text?.trim();

  if (!outputText) {
    logger.warn(
      "Single player vision returned empty output, falling back to heuristic mode.",
    );
    return null;
  }

  const parsed = safeJsonParse(outputText);
  if (!parsed.ok || typeof parsed.data !== "object" || parsed.data === null) {
    logger.warn(
      "Single player vision returned invalid JSON, falling back to heuristic mode.",
      {
        outputText,
      },
    );
    return null;
  }

  const payload = parsed.data as VisionGuessPayload;
  const guess = typeof payload.guess === "string" ? payload.guess.trim() : "";
  const comment =
    typeof payload.comment === "string" ? payload.comment.trim() : "";
  const confidence = isGuessConfidence(payload.confidence)
    ? payload.confidence
    : "low";

  if (!guess) {
    logger.warn(
      "Single player vision returned no guess, falling back to heuristic mode.",
      {
        outputText,
      },
    );
    return null;
  }

  return {
    guess,
    comment: comment || "我看完圖後做出的判斷。",
    confidence,
  };
};

/* 建立正面評論 */
const buildPositiveComment = (
  analysis: DrawingAnalysis,
  timedOut: boolean,
): string => {
  if (timedOut) {
    return "雖然超時了，但重點特徵很清楚。";
  }

  if (analysis.coverage > 0.12 && analysis.distinctColorCount >= 3) {
    return "這張很完整，我一下就看懂了。";
  }

  if (analysis.coverage > 0.06) {
    return "輪廓畫得夠清楚，這題不難猜。";
  }

  return "簡筆畫也很有辨識度。";
};

/* 建立錯誤評論 */
const buildMissComment = (
  analysis: DrawingAnalysis,
  timedOut: boolean,
): string => {
  if (timedOut) {
    return "差一點就看懂了，可惜時間先到了。";
  }

  if (analysis.coverage < 0.015) {
    return "畫面資訊有點少，我沒抓到重點。";
  }

  if (analysis.distinctColorCount <= 1) {
    return "輪廓有了，但再明確一點會更好猜。";
  }

  return "我被某些線條誤導了，再畫明顯一點會更穩。";
};

/* 建立猜測結果 */
const buildHeuristicGuess = (
  analysis: DrawingAnalysis,
  answer: string,
  imageDataUrl: string,
  timedOut: boolean,
): Omit<SinglePlayerGuessResult, "isCorrect"> => {
  if (analysis.isBlank) {
    return {
      guess: "???",
      comment: timedOut
        ? "時間到時畫布幾乎還是白的。"
        : "我真的看不出你想畫什麼。",
      confidence: "low",
    };
  }
  /* 機率加權計算 (The Probability Logic) */
  /* 獎勵分 (detailBonus)：如果用了 3 種以上的顏色，機率加 12%。 */
  const detailBonus = analysis.distinctColorCount >= 3 ? 0.12 : 0;
  /* 超時懲罰 (timeoutPenalty)：如果超時了，機率扣 18%。 */
  const timeoutPenalty = timedOut ? 0.18 : 0;
  /* 成功機率 */
  const successChance = Math.max(
    0.12,
    Math.min(0.92, analysis.qualityScore + detailBonus - timeoutPenalty),
  );
  /* 信心等級判定 (confidence)根據最終機率決定顯示給玩家看的「信心程度」 */
  const confidence: GuessConfidence =
    successChance > 0.72 ? "high" : successChance > 0.42 ? "medium" : "low";
  /* 用穩定 seed 取代真正的隨機，讓同一份圖片輸入能得到一致結果。 */
  const roll = createDeterministicRandom(
    `${answer}|${timedOut ? "timed-out" : "submitted"}|${imageDataUrl.slice(0, 256)}`,
  );
  const wrongGuessSeed = `${answer}|wrong-guess|${imageDataUrl.slice(-256)}`;
  const guessedCorrectly = roll < successChance;

  if (guessedCorrectly) {
    return {
      guess: answer,
      comment: buildPositiveComment(analysis, timedOut),
      confidence,
    };
  }

  return {
    guess: pickWrongGuess(answer, wrongGuessSeed),
    comment: buildMissComment(analysis, timedOut),
    confidence: confidence === "high" ? "medium" : "low",
  };
};

export const singlePlayerService = {
  async guessDrawing(
    input: SinglePlayerGuessInput,
  ): Promise<SinglePlayerGuessResult> {
    const answer = input.answer.trim();

    if (!answer) {
      throw new Error("`answer` is required.");
    }

    const visionResult = await requestVisionGuess(
      input.imageDataUrl,
      answer,
      Boolean(input.timedOut),
    );

    if (visionResult) {
      return {
        ...visionResult,
        isCorrect: isGuessCorrect(visionResult.guess, answer),
      };
    }

    /* 無API，本地分析 */

    const analysis = analyzeDrawing(input.imageDataUrl);
    const result = buildHeuristicGuess(
      analysis,
      answer,
      input.imageDataUrl,
      Boolean(input.timedOut),
    );

    return {
      ...result,
      isCorrect: isGuessCorrect(result.guess, answer),
    };
  },
};
