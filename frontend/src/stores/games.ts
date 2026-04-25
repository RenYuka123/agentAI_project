import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { guessSinglePlayerDrawing } from "../api/draw.api";
import type { SinglePlayerGuessResponse } from "../types/draw.types";
import { getRandomWords } from "../types/words";

type GamePhase =
  | "idle"
  | "picking"
  | "drawing"
  | "timeup"
  | "result"
  | "guessing";

type SubmitDrawingOptions = {
  timedOut?: boolean;
};

const DEFAULT_ROUND_TIME = 60;
const DEFAULT_CONFIDENCE: SinglePlayerGuessResponse["confidence"] = "low";
const DEFAULT_EMPTY_GUESS = "???";
const DEFAULT_TIMEOUT_COMMENT = "時間到還沒畫完！";
const DEFAULT_FAILURE_GUESS = "（AI 罷工中）";
const DEFAULT_FAILURE_COMMENT = "網路或 API 出了點問題...";

export const useGameStore = defineStore("game", () => {
  /* Game phase */
  const phase = ref<GamePhase>("idle");
  /* Current word to be drawn */
  const currentWord = ref("");
  /* List of words to choose from */
  const wordChoices = ref<string[]>([]);
  /* Calculates the percentage of time remaining */
  const timeLeft = ref(DEFAULT_ROUND_TIME);
  /* Total time for each round */
  const totalTime = ref(DEFAULT_ROUND_TIME);
  /* Player's score */
  const score = ref(0);
  /* Current round number */
  const round = ref(0);

  // AI 猜圖相關
  const aiGuess = ref("");
  const aiComment = ref("");
  const aiCorrect = ref(false);
  const aiLoading = ref(false);
  const lastError = ref("");
  const lastConfidence = ref<SinglePlayerGuessResponse["confidence"]>(DEFAULT_CONFIDENCE);

  let timer: ReturnType<typeof setInterval> | null = null;

  /* Calculates the percentage of time remaining */
  const timePercent = computed(() => (timeLeft.value / totalTime.value) * 100);

  /* Starts a new round */
  const startRound = () => {
    clearTimer();
    round.value++;
    currentWord.value = "";
    aiGuess.value = "";
    aiComment.value = "";
    aiCorrect.value = false;
    lastError.value = "";
    lastConfidence.value = DEFAULT_CONFIDENCE;
    wordChoices.value = getRandomWords(3);
    phase.value = "picking";
  };

  /* Picks a word to draw */
  const pickWord = (word: string) => {
    currentWord.value = word;
    timeLeft.value = totalTime.value;
    phase.value = "drawing";
    startTimer();
  };

  /* Starts the game timer */
  const startTimer = () => {
    clearTimer();
    timer = setInterval(() => {
      timeLeft.value--;
      if (timeLeft.value <= 0) {
        clearTimer();
        phase.value = "timeup";
      }
    }, 1000);
  };

  /* Clears the game timer */
  const clearTimer = () => {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };

  async function submitDrawing(
    canvasDataUrl: string | null,
    options: SubmitDrawingOptions = {},
  ) {
    clearTimer();
    phase.value = "guessing";
    aiLoading.value = true;
    lastError.value = "";

    try {
      if (!canvasDataUrl) {
        aiGuess.value = DEFAULT_EMPTY_GUESS;
        aiComment.value = DEFAULT_TIMEOUT_COMMENT;
        aiCorrect.value = false;
        lastConfidence.value = DEFAULT_CONFIDENCE;
        aiLoading.value = false;
        phase.value = "result";
        return;
      }

      const result = await guessSinglePlayerDrawing({
        answer: currentWord.value,
        imageDataUrl: canvasDataUrl,
        timedOut: options.timedOut ?? false,
      });

      aiGuess.value = result.guess || DEFAULT_EMPTY_GUESS;
      aiComment.value = result.comment || "";
      aiCorrect.value = result.isCorrect;
      lastConfidence.value = result.confidence ?? DEFAULT_CONFIDENCE;

      if (aiCorrect.value) {
        score.value++;
      }
    } catch (e) {
      lastError.value = e instanceof Error ? e.message : "unknown error";
      aiGuess.value = DEFAULT_FAILURE_GUESS;
      aiComment.value = DEFAULT_FAILURE_COMMENT;
      aiCorrect.value = false;
      lastConfidence.value = DEFAULT_CONFIDENCE;
    }

    aiLoading.value = false;
    phase.value = "result";
  }

  /* Resets the game */
  const reset = () => {
    clearTimer();
    phase.value = "idle";
    currentWord.value = "";
    wordChoices.value = [];
    timeLeft.value = DEFAULT_ROUND_TIME;
    score.value = 0;
    round.value = 0;
    aiGuess.value = "";
    aiComment.value = "";
    aiCorrect.value = false;
    aiLoading.value = false;
    lastError.value = "";
    lastConfidence.value = DEFAULT_CONFIDENCE;
  };

  return {
    phase,
    currentWord,
    wordChoices,
    timeLeft,
    totalTime,
    timePercent,
    score,
    round,
    aiGuess,
    aiComment,
    aiCorrect,
    aiLoading,
    lastError,
    lastConfidence,
    startRound,
    pickWord,
    submitDrawing,
    reset,
    clearTimer,
  };
});
