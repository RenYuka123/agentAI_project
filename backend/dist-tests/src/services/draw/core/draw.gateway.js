import { DRAW_TIME_SECONDS } from "./draw.constants.js";
import { createRoom, deleteRoom, getCurrentDrawer, getRoom, hasRoom, joinRoom, removePlayer, safeRoom, } from "./room-manager.js";
import { generateRoomId, getRandomWords } from "./draw.utils.js";
import { logger } from "../../../utils/logger.js";
/**
 * 將目前 socket 綁定到指定房間，供 disconnect 與事件驗證共用。
 *
 * @param socket 目前連線的 socket。
 * @param roomId 已確認加入的房間。
 */
export const bindSocketRoom = (socket, roomId) => {
    socket.data.activeRoomId = roomId;
};
/**
 * 清除 socket 綁定的房間資訊，避免 disconnect 時誤判舊房間。
 *
 * @param socket 目前連線的 socket。
 * @returns 原本綁定的房間 id。
 */
export const clearSocketRoom = (socket) => {
    const { activeRoomId } = socket.data;
    delete socket.data.activeRoomId;
    return activeRoomId;
};
/**
 * 驗證事件 payload 的 roomId 是否與目前 socket 綁定的房間一致。
 *
 * @param socket 目前連線的 socket。
 * @param roomId 事件帶入的房間 id。
 * @returns 通過驗證時回傳可用的房間 id，否則回傳 undefined。
 */
export const resolveSocketRoomId = (socket, roomId) => {
    const normalizedRoomId = roomId?.trim();
    if (!normalizedRoomId) {
        return undefined;
    }
    if (socket.data.activeRoomId && socket.data.activeRoomId !== normalizedRoomId) {
        logger.warn("Draw event used a roomId different from the socket binding", {
            socketId: socket.id,
            activeRoomId: socket.data.activeRoomId,
            payloadRoomId: normalizedRoomId,
        });
        return undefined;
    }
    return normalizedRoomId;
};
const createUniqueRoomId = () => {
    let roomId = generateRoomId();
    while (hasRoom(roomId)) {
        roomId = generateRoomId();
    }
    return roomId;
};
const endTurn = (io, roomId) => {
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
const startRoundTimer = (io, roomId) => {
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
const nextTurn = (io, roomId) => {
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
const handleDisconnect = (io, socket) => {
    const roomId = clearSocketRoom(socket);
    if (!roomId) {
        return;
    }
    const room = getRoom(roomId);
    if (!room) {
        return;
    }
    const drawer = getCurrentDrawer(room);
    const updatedRoom = removePlayer(roomId, socket.id);
    if (!updatedRoom || updatedRoom.players.length === 0) {
        deleteRoom(roomId);
        return;
    }
    if (drawer?.id === socket.id && updatedRoom.phase !== "lobby" && updatedRoom.phase !== "gameEnd") {
        updatedRoom.phase = "roundEnd";
        endTurn(io, roomId);
    }
    io.to(roomId).emit("playerLeft", {
        playerId: socket.id,
        room: safeRoom(updatedRoom),
    });
};
const registerConnection = (io, socket) => {
    const drawSocket = socket;
    socket.on("createRoom", (payload, callback) => {
        const playerName = payload.playerName?.trim();
        if (!playerName) {
            callback?.({ error: "playerName is required" });
            return;
        }
        const roomId = createUniqueRoomId();
        const room = createRoom(roomId, socket.id, playerName);
        bindSocketRoom(drawSocket, roomId);
        socket.join(roomId);
        callback?.({ roomId, room: safeRoom(room) });
    });
    socket.on("joinRoom", (payload, callback) => {
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
        bindSocketRoom(drawSocket, roomId);
        socket.join(roomId);
        socket.to(roomId).emit("playerJoined", {
            player: { id: socket.id, name: playerName, score: 0 },
            room: safeRoom(result.room),
        });
        callback?.({ room: safeRoom(result.room) });
    });
    socket.on("startGame", (payload, callback) => {
        const roomId = resolveSocketRoomId(drawSocket, payload.roomId);
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
    socket.on("pickWord", (payload) => {
        const roomId = resolveSocketRoomId(drawSocket, payload.roomId);
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
    socket.on("draw", (payload) => {
        const roomId = resolveSocketRoomId(drawSocket, payload.roomId);
        if (!roomId) {
            return;
        }
        socket.to(roomId).emit("draw", payload.drawData);
    });
    socket.on("clearCanvas", (payload) => {
        const roomId = resolveSocketRoomId(drawSocket, payload.roomId);
        if (!roomId) {
            return;
        }
        socket.to(roomId).emit("clearCanvas");
    });
    socket.on("guess", (payload) => {
        const roomId = resolveSocketRoomId(drawSocket, payload.roomId);
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
        handleDisconnect(io, drawSocket);
    });
};
export const initializeDrawGame = (io) => {
    io.on("connection", (socket) => {
        logger.info(`Draw player connected: ${socket.id}`);
        registerConnection(io, socket);
    });
};
