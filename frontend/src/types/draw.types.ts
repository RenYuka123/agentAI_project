export interface SinglePlayerGuessRequest {
  answer: string;
  imageDataUrl: string;
  timedOut?: boolean;
}

export interface SinglePlayerGuessResponse {
  guess: string;
  comment: string;
  confidence: "high" | "medium" | "low";
  isCorrect: boolean;
  error?: string;
}
