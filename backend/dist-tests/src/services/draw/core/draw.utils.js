import { DRAW_WORDS } from "./draw.constants.js";
export const getRandomWords = (count = 3) => {
    return [...DRAW_WORDS].sort(() => Math.random() - 0.5).slice(0, count);
};
export const generateRoomId = () => {
    return Math.random().toString(36).slice(2, 8).toUpperCase();
};
