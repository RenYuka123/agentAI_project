# Draw Module Notes

## Overview

`draw` 目前分成兩條功能線：

1. 單人模式
   前端畫圖後，把 canvas 轉成 PNG data URL 送到後端，後端再用 vision API 或 fallback 規則分析做猜題。
2. 多人模式
   多個玩家都使用同一個前端頁面元件，但每個瀏覽器都有自己的 websocket 連線；後端用 `socket.id` 與 `roomId` 管理房間與玩家。

---

## Main Files

### Frontend

- `frontend/src/views/DrawHomeView.vue`
  畫畫遊戲首頁，提供單人 / 多人入口。
- `frontend/src/views/SinglePlayerView.vue`
  單人模式主頁。
- `frontend/src/views/MultiPlayerView.vue`
  多人模式主頁，負責 socket 連線、房間流程、畫布同步與聊天。
- `frontend/src/stores/games.ts`
  單人模式狀態管理。
- `frontend/src/api/draw.api.ts`
  前端呼叫單人猜圖後端 API。

### Backend

- `backend/src/server.ts`
  建立 HTTP server，並掛上 Socket.IO。
- `backend/src/services/draw/index.ts`
  draw 模組出口。
- `backend/src/services/draw/core/draw.gateway.ts`
  多人模式 websocket 主流程。
- `backend/src/services/draw/core/room-manager.ts`
  房間資料、玩家列表、房主轉移等管理。
- `backend/src/services/draw/core/draw.types.ts`
  draw 模組共用型別。
- `backend/src/services/draw/core/draw.constants.ts`
  題庫、回合秒數、最大玩家數等常數。
- `backend/src/services/draw/core/single-player.service.ts`
  單人模式猜圖邏輯。
- `backend/src/controllers/draw.controller.ts`
  單人模式 API controller。
- `backend/src/routes/draw.route.ts`
  單人模式 route。

---

## Single Player Flow

### Frontend Flow

1. 使用者進入 `SinglePlayerView.vue`。
2. 點開始後，`games.ts` 的 `startRound()` 會隨機出 3 個題目。
3. 使用者選題後進入 `drawing`。
4. 使用者按「我畫好了」或時間到時：
   `SinglePlayerView.vue` 會從 canvas 取出 `dataUrl`。
5. `games.ts` 呼叫 `guessSinglePlayerDrawing(...)`。
6. `frontend/src/api/draw.api.ts` 發 `POST /api/draw/single/guess`。
7. 前端收到 `guess / comment / confidence / isCorrect` 後顯示結果。

### Backend Flow

1. `draw.route.ts` 接到 `POST /api/draw/single/guess`
2. `draw.controller.ts` 驗證 `answer` 與 `imageDataUrl`
3. 呼叫 `singlePlayerService.guessDrawing(...)`
4. `single-player.service.ts`：
   - 先嘗試走 vision API
   - vision 失敗時 fallback 到本地 heuristic 分析
5. 回傳結果給前端

### Single Player Decision Logic

目前單人模式後端有兩層：

1. Vision path
   - 有 `LLM_API_KEY` 時，呼叫 `${LLM_BASE_URL}/responses`
   - 送出 `input_text + input_image`
   - 模型只看圖猜詞，不會先拿到正確答案
   - 後端再自己比對 `guess` 與 `answer`

2. Heuristic fallback
   - 如果 vision API 不可用，就解析 PNG 像素
   - 分析覆蓋率、顏色數、筆觸品質
   - 根據這些指標產生猜測與評語

---

## Multiplayer Flow

## Core Concept

多人模式是「共用同一個頁面元件，不共用同一個前端實例」。

- 所有玩家都使用 `MultiPlayerView.vue`
- 但每個玩家的瀏覽器都會建立一條自己的 websocket 連線
- 後端用 `socket.id` 區分玩家
- 用 `roomId` 區分房間

### Connection

`MultiPlayerView.vue` 在 `onMounted()` 時：

1. `socket = io(SERVER, { transports: ['websocket'] })`
2. `connect` 後把 `socket.id` 存到 `myId`

這個 `myId` 是目前玩家在後端的唯一識別。

---

## Multiplayer State Split

### Local State

這些狀態主要是當前前端自己持有：

- `phase`
- `gamePhase`
- `myId`
- `error`
- `currentColor`
- `brushSize`
- `tool`
- `drawing`
- `lastX`, `lastY`

### Shared Room State

這些資料來自後端同步：

- `room`
- `currentDrawerId`
- `currentDrawerName`
- `wordChoices`
- `timeLeft`
- `guessedIds`
- `turnScores`
- `ranking`

---

## Multiplayer Event Table

### Frontend Emit -> Backend On

- `createRoom`
  建房
- `joinRoom`
  加房
- `startGame`
  房主開始遊戲
- `pickWord`
  畫家選題
- `draw`
  同步筆跡
- `clearCanvas`
  清空畫布
- `guess`
  玩家猜字

### Backend Emit -> Frontend On

- `playerJoined`
  有人加入房間
- `playerLeft`
  有人離開房間
- `gameStarted`
  遊戲開始
- `nextTurn`
  指定下一位畫家
- `wordChoices`
  題目選項，只送給畫家
- `drawingStarted`
  畫家選好題目，正式開畫
- `timer`
  每秒同步剩餘時間
- `draw`
  轉發畫家筆跡
- `clearCanvas`
  轉發清空畫布
- `playerGuessed`
  有人猜中
- `chat`
  猜錯聊天訊息
- `turnEnd`
  本輪結束
- `gameEnd`
  遊戲結束

---

## Multiplayer Round Flow

### 1. Create / Join Room

1. 玩家 A `createRoom`
2. 後端建立 `room`
3. 玩家 B `joinRoom`
4. 後端把 B 加進 `room.players`
5. 後端廣播 `playerJoined`

### 2. Start Game

1. 房主送出 `startGame`
2. 後端檢查：
   - 房間是否存在
   - 是否為房主
   - 玩家數是否至少 2 人
3. 廣播 `gameStarted`
4. 呼叫 `nextTurn(...)`

### 3. Pick Word

1. 後端決定這輪畫家
2. 廣播 `nextTurn`
3. 只對畫家送 `wordChoices`
4. 畫家送出 `pickWord`
5. 後端確認：
   - 發送者是不是畫家
   - 選的字是否在 `wordChoices` 中
6. 廣播 `drawingStarted`
7. 啟動回合計時器

### 4. Draw Sync

1. 畫家本地畫點 / 線
2. 前端 `emit('draw', { roomId, drawData })`
3. 後端用 `socket.to(roomId).emit('draw', drawData)` 轉發
4. 其他玩家在 `remoteDraw(...)` 重播筆跡

### 5. Guess

1. 非畫家送出 `guess`
2. 後端檢查：
   - 房間是否存在
   - 現在是否在 `drawing`
   - 發送者是不是玩家
   - 發送者是不是畫家
   - 發送者是否已猜中
3. 如果猜中：
   - 把玩家放進 `guessedPlayers`
   - 猜中者加分
   - 畫家加分
   - 廣播 `playerGuessed`
4. 如果猜錯：
   - 廣播 `chat`

### 6. Turn End

以下情況會結束本輪：

- 倒數時間歸零
- 所有非畫家都猜中
- 畫家中途斷線

結束時後端會：

1. 清除 timer
2. 廣播 `turnEnd`
3. 清空 `currentWord`、`guessedPlayers`
4. `currentDrawerIndex += 1`
5. 若還有下一輪，呼叫 `nextTurn`
6. 否則廣播 `gameEnd`

---

## Room Manager Notes

`room-manager.ts` 目前做的事情：

- 用 `Map<string, DrawRoom>` 存所有房間
- `createRoom`
  建立房間與房主
- `joinRoom`
  玩家加入房間
- `removePlayer`
  玩家離房，必要時把房主轉給第一位玩家
- `getCurrentDrawer`
  依 `currentDrawerIndex % players.length` 找目前畫家
- `safeRoom`
  回傳給前端時移除 `timer`

---

## Disconnect Handling

多人模式有一個 `roomStore: Map<socketId, roomId>`：

- 用來反查某個 socket 屬於哪一個房間
- 來源是 `socket.onAny(...)` 看到 payload 裡有 `roomId` 就記住

斷線時：

1. `disconnect`
2. `forgetRoom(socketId)`
3. 找到房間
4. 把玩家從 `room.players` 移除
5. 若房間空了就刪房
6. 若離開的是畫家，直接強制結束本輪
7. 廣播 `playerLeft`

---

## Current Constraints

目前多人模式有幾個設計特性：

- 玩家身分是 `socket.id`
  不是帳號系統
- 重新整理頁面通常會拿到新的 `socket.id`
- 所以現在沒有真正的「重連恢復」機制
- 房間資料存在記憶體中
  伺服器重啟後房間會全部消失

---

## Suggested Reading Order

如果要快速理解 draw 模組，建議照這個順序看：

1. `frontend/src/views/DrawHomeView.vue`
2. `frontend/src/views/SinglePlayerView.vue`
3. `frontend/src/stores/games.ts`
4. `backend/src/controllers/draw.controller.ts`
5. `backend/src/services/draw/core/single-player.service.ts`
6. `frontend/src/views/MultiPlayerView.vue`
7. `backend/src/services/draw/core/draw.gateway.ts`
8. `backend/src/services/draw/core/room-manager.ts`

---

## Quick Summary

- 單人模式：
  前端送圖 -> 後端 vision / fallback 猜圖 -> 回傳結果
- 多人模式：
  前端 emit -> backend socket.on -> backend emit -> 前端 socket.on
- 玩家識別：
  用 `socket.id`
- 房間識別：
  用 `roomId`
- 房間狀態：
  由 backend 記憶體中的 `rooms` Map 管理
