export type DrawRoomPhase = "lobby" | "picking" | "drawing" | "roundEnd" | "gameEnd";

export type DrawPlayer = {
  id: string;
  name: string;
  score: number;
  isHost: boolean;
};

export type DrawRoom = {
  id: string;
  players: DrawPlayer[];
  phase: DrawRoomPhase;
  currentDrawerIndex: number;
  round: number;
  totalRounds: number;
  currentWord: string;
  wordChoices: string[];
  timeLeft: number;
  guessedPlayers: string[];
  chat: Array<{
    playerId: string;
    playerName: string;
    message: string;
    isCorrect: boolean;
  }>;
  timer: NodeJS.Timeout | null;
};

export type SafeDrawRoom = Omit<DrawRoom, "timer">;

export type JoinDrawRoomResult =
  | { room: DrawRoom; error?: never }
  | { error: string; room?: never };
