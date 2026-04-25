import { Server, type Socket } from "socket.io";
import { DRAW_TIME_SECONDS } from "./draw.constants.js";
import {
  createRoom,
  deleteRoom,
  getCurrentDrawer,
  getRoom,
  hasRoom,
  joinRoom,
  removePlayer,
  safeRoom,
} from "./room-manager.js";
import { generateRoomId, getRandomWords } from "./draw.utils.js";
import { logger } from "../../../utils/logger.js";

type ClientCallback<T> = (payload: T) => void;

type CreateRoomPayload = {
  playerName?: string;
};

type JoinRoomPayload = {
  roomId?: string;
  playerName?: string;
};

type RoomPayload = {
  roomId?: string;
};

type PickWordPayload = {
  roomId?: string;
  word?: string;
};

type DrawPayload = {
  roomId?: string;
  drawData?: unknown;
};

type GuessPayload = {
  roomId?: string;
  message?: string;
};

const roomStore = new Map<string, string>();

const rememberRoom = (socketId: string, roomId: string): void => {
  roomStore.set(socketId, roomId);
};

const forgetRoom = (socketId: string): string | undefined => {
  const roomId = roomStore.get(socketId);
  roomStore.delete(socketId);
  return roomId;
};

const createUniqueRoomId = (): string => {
  let roomId = generateRoomId();

  while (hasRoom(roomId)) {
    roomId = generateRoomId();
  }

  return roomId;
};

const endTurn = (io: Server, roomId: string): void => {
  const room = getRoom(roomId);

  if (!room) {
    return;
  }

  if (room.timer) {
    clearInterval(room.timer);
    room.timer = null;
  }

  io.to(roomId).emit("turnEnd", {
    word: room.currentWord,
    scores: room.players.map((player) => ({
      id: player.id,
      name: player.name,
      score: player.score,
    })),
  });

  room.phase = "roundEnd";
  room.guessedPlayers = [];
  room.currentWord = "";
  room.currentDrawerIndex += 1;

  const totalTurns = room.players.length * room.totalRounds;

  setTimeout(() => {
    const latestRoom = getRoom(roomId);
    if (!latestRoom) {
      return;
    }

    if (latestRoom.currentDrawerIndex >= totalTurns) {
      latestRoom.phase = "gameEnd";
      const ranking = [...latestRoom.players].sort((left, right) => right.score - left.score);
      io.to(roomId).emit("gameEnd", { ranking });
      return;
    }

    nextTurn(io, roomId);
  }, 4000);
};

const startRoundTimer = (io: Server, roomId: string): void => {
  const room = getRoom(roomId);

  if (!room) {
    return;
  }

  if (room.timer) {
    clearInterval(room.timer);
  }

  room.timer = setInterval(() => {
    room.timeLeft -= 1;
    io.to(roomId).emit("timer", { timeLeft: room.timeLeft });

    if (room.timeLeft <= 0) {
      if (room.timer) {
        clearInterval(room.timer);
        room.timer = null;
      }

      endTurn(io, roomId);
    }
  }, 1000);
};

const nextTurn = (io: Server, roomId: string): void => {
  const room = getRoom(roomId);

  if (!room || room.players.length === 0) {
    return;
  }

  const drawer = getCurrentDrawer(room);
  if (!drawer) {
    return;
  }

  room.wordChoices = getRandomWords(3);
  room.phase = "picking";
  room.timeLeft = DRAW_TIME_SECONDS;

  io.to(roomId).emit("nextTurn", {
    drawerId: drawer.id,
    drawerName: drawer.name,
  });
  io.to(drawer.id).emit("wordChoices", { words: room.wordChoices });
};

const handleDisconnect = (io: Server, socketId: string): void => {
  const roomId = forgetRoom(socketId);
  if (!roomId) {
    return;
  }

  const room = getRoom(roomId);
  if (!room) {
    return;
  }

  const drawer = getCurrentDrawer(room);
  const updatedRoom = removePlayer(roomId, socketId);

  if (!updatedRoom || updatedRoom.players.length === 0) {
    deleteRoom(roomId);
    return;
  }

  if (drawer?.id === socketId && updatedRoom.phase !== "lobby" && updatedRoom.phase !== "gameEnd") {
    updatedRoom.phase = "roundEnd";
    endTurn(io, roomId);
  }

  io.to(roomId).emit("playerLeft", {
    playerId: socketId,
    room: safeRoom(updatedRoom),
  });
};

const registerConnection = (io: Server, socket: Socket): void => {
  socket.onAny((_event: string, payload: unknown) => {
    if (
      payload &&
      typeof payload === "object" &&
      "roomId" in payload &&
      typeof payload.roomId === "string"
    ) {
      rememberRoom(socket.id, payload.roomId);
    }
  });

  socket.on("createRoom", (payload: CreateRoomPayload, callback?: ClientCallback<unknown>) => {
    const playerName = payload.playerName?.trim();

    if (!playerName) {
      callback?.({ error: "playerName is required" });
      return;
    }

    const roomId = createUniqueRoomId();
    const room = createRoom(roomId, socket.id, playerName);

    rememberRoom(socket.id, roomId);
    socket.join(roomId);
    callback?.({ roomId, room: safeRoom(room) });
  });

  socket.on("joinRoom", (payload: JoinRoomPayload, callback?: ClientCallback<unknown>) => {
    const roomId = payload.roomId?.trim();
    const playerName = payload.playerName?.trim();

    if (!roomId || !playerName) {
      callback?.({ error: "roomId and playerName are required" });
      return;
    }

    const result = joinRoom(roomId, socket.id, playerName);
    if ("error" in result) {
      callback?.({ error: result.error });
      return;
    }

    rememberRoom(socket.id, roomId);
    socket.join(roomId);
    socket.to(roomId).emit("playerJoined", {
      player: { id: socket.id, name: playerName, score: 0 },
      room: safeRoom(result.room),
    });
    callback?.({ room: safeRoom(result.room) });
  });

  socket.on("startGame", (payload: RoomPayload, callback?: ClientCallback<unknown>) => {
    const roomId = payload.roomId?.trim();
    if (!roomId) {
      callback?.({ error: "roomId is required" });
      return;
    }

    const room = getRoom(roomId);

    if (!room) {
      callback?.({ error: "找不到房間" });
      return;
    }

    const host = room.players.find((player) => player.isHost);
    if (host?.id !== socket.id) {
      callback?.({ error: "只有房主可以開始遊戲" });
      return;
    }

    if (room.players.length < 2) {
      callback?.({ error: "至少需要 2 名玩家" });
      return;
    }

    room.currentDrawerIndex = 0;
    room.round = 1;

    io.to(roomId).emit("gameStarted", { room: safeRoom(room) });
    callback?.({ room: safeRoom(room) });
    nextTurn(io, roomId);
  });

  socket.on("pickWord", (payload: PickWordPayload) => {
    const roomId = payload.roomId?.trim();
    const word = payload.word?.trim();

    if (!roomId || !word) {
      return;
    }

    const room = getRoom(roomId);
    if (!room) {
      return;
    }

    const drawer = getCurrentDrawer(room);
    if (!drawer || drawer.id !== socket.id) {
      return;
    }

    if (!room.wordChoices.includes(word)) {
      return;
    }

    room.currentWord = word;
    room.phase = "drawing";
    room.timeLeft = DRAW_TIME_SECONDS;
    room.guessedPlayers = [];

    io.to(roomId).emit("drawingStarted", {
      drawerId: drawer.id,
      drawerName: drawer.name,
      wordLength: word.length,
      timeLeft: DRAW_TIME_SECONDS,
    });

    startRoundTimer(io, roomId);
  });

  socket.on("draw", (payload: DrawPayload) => {
    const roomId = payload.roomId?.trim();
    if (!roomId) {
      return;
    }

    socket.to(roomId).emit("draw", payload.drawData);
  });

  socket.on("clearCanvas", (payload: RoomPayload) => {
    const roomId = payload.roomId?.trim();
    if (!roomId) {
      return;
    }

    socket.to(roomId).emit("clearCanvas");
  });

  socket.on("guess", (payload: GuessPayload) => {
    const roomId = payload.roomId?.trim();
    const message = payload.message?.trim();

    if (!roomId || !message) {
      return;
    }

    const room = getRoom(roomId);
    if (!room || room.phase !== "drawing") {
      return;
    }

    const player = room.players.find((candidate) => candidate.id === socket.id);
    if (!player) {
      return;
    }

    const drawer = getCurrentDrawer(room);
    if (drawer?.id === socket.id || room.guessedPlayers.includes(socket.id)) {
      return;
    }

    const isCorrect = message.toLowerCase() === room.currentWord.toLowerCase();

    if (isCorrect) {
      room.guessedPlayers.push(socket.id);

      const bonus = Math.max(10, Math.floor((room.timeLeft / DRAW_TIME_SECONDS) * 100));
      player.score += bonus;

      if (drawer) {
        drawer.score += 30;
      }

      io.to(roomId).emit("playerGuessed", {
        playerId: socket.id,
        playerName: player.name,
        scores: room.players.map((candidate) => ({
          id: candidate.id,
          name: candidate.name,
          score: candidate.score,
        })),
      });

      const nonDrawers = room.players.filter((candidate) => candidate.id !== drawer?.id);
      if (nonDrawers.every((candidate) => room.guessedPlayers.includes(candidate.id))) {
        if (room.timer) {
          clearInterval(room.timer);
          room.timer = null;
        }

        endTurn(io, roomId);
      }

      return;
    }

    room.chat.push({
      playerId: socket.id,
      playerName: player.name,
      message,
      isCorrect: false,
    });

    io.to(roomId).emit("chat", {
      playerId: socket.id,
      playerName: player.name,
      message,
      isCorrect: false,
    });
  });

  socket.on("disconnect", () => {
    logger.info(`Draw player disconnected: ${socket.id}`);
    handleDisconnect(io, socket.id);
  });
};

export const initializeDrawGame = (io: Server): void => {
  io.on("connection", (socket: Socket) => {
    logger.info(`Draw player connected: ${socket.id}`);
    registerConnection(io, socket);
  });
};
