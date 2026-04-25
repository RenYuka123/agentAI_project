import { DRAW_WORDS } from "./draw.constants.js";

export const getRandomWords = (count = 3): string[] => {
  return [...DRAW_WORDS].sort(() => Math.random() - 0.5).slice(0, count);
};

export const generateRoomId = (): string => {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
};
