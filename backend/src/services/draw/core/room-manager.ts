import {
  DRAW_TIME_SECONDS,
  MAX_PLAYERS_PER_ROOM,
  TOTAL_ROUNDS,
} from "./draw.constants.js";
import type { DrawRoom, DrawPlayer, JoinDrawRoomResult, SafeDrawRoom } from "./draw.types.js";

const rooms = new Map<string, DrawRoom>();

export const createRoom = (roomId: string, hostId: string, hostName: string): DrawRoom => {
  const room: DrawRoom = {
    id: roomId,
    players: [{ id: hostId, name: hostName, score: 0, isHost: true }],
    phase: "lobby",
    currentDrawerIndex: 0,
    round: 0,
    totalRounds: TOTAL_ROUNDS,
    currentWord: "",
    wordChoices: [],
    timeLeft: DRAW_TIME_SECONDS,
    guessedPlayers: [],
    chat: [],
    timer: null,
  };

  rooms.set(roomId, room);
  return room;
};

export const getRoom = (roomId: string): DrawRoom | undefined => {
  return rooms.get(roomId);
};

export const hasRoom = (roomId: string): boolean => {
  return rooms.has(roomId);
};

export const deleteRoom = (roomId: string): void => {
  const room = rooms.get(roomId);

  if (room?.timer) {
    clearInterval(room.timer);
  }

  rooms.delete(roomId);
};

export const joinRoom = (
  roomId: string,
  playerId: string,
  playerName: string,
): JoinDrawRoomResult => {
  const room = rooms.get(roomId);

  if (!room) {
    return { error: "找不到房間" };
  }

  if (room.players.length >= MAX_PLAYERS_PER_ROOM) {
    return { error: "房間已滿" };
  }

  if (room.phase !== "lobby") {
    return { error: "遊戲已開始" };
  }

  const existingPlayer = room.players.find((player) => player.id === playerId);
  if (existingPlayer) {
    return { room };
  }

  room.players.push({
    id: playerId,
    name: playerName,
    score: 0,
    isHost: false,
  });

  return { room };
};

export const removePlayer = (roomId: string, playerId: string): DrawRoom | null => {
  const room = rooms.get(roomId);

  if (!room) {
    return null;
  }

  room.players = room.players.filter((player) => player.id !== playerId);

  if (room.players.length > 0 && !room.players.some((player) => player.isHost)) {
    room.players[0].isHost = true;
  }

  return room;
};

export const getCurrentDrawer = (room: DrawRoom): DrawPlayer | null => {
  if (room.players.length === 0) {
    return null;
  }

  const drawerIndex = room.currentDrawerIndex % room.players.length;
  return room.players[drawerIndex] ?? null;
};

export const safeRoom = (room: DrawRoom): SafeDrawRoom => {
  const { timer: _timer, ...safe } = room;
  return safe;
};
