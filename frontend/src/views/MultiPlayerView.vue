<template>
  <div class="mp-page">

    <!-- ── Header ── -->
    <div class="game-header">
      <button class="back-btn" @click="handleBack">← 返回</button>
      <div class="game-title-sm">畫猜猜！</div>
      <div class="mode-badge">多人模式</div>
    </div>

    <!-- ── 大廳：輸入名字 + 建立/加入 ── -->
    <div v-if="phase === 'entry'" class="entry-screen">
      <div class="entry-card">
        <div class="entry-icon">👥</div>
        <h2 class="entry-title">多人模式</h2>

        <input
          v-model="playerName"
          class="entry-input"
          placeholder="輸入你的名字"
          maxlength="10"
          @keydown.enter="phase = 'choose'"
        />

        <div class="entry-actions">
          <button class="btn-primary" :disabled="!playerName.trim()" @click="phase = 'choose'">
            繼續
          </button>
        </div>
      </div>
    </div>

    <!-- ── 選擇建立或加入 ── -->
    <div v-else-if="phase === 'choose'" class="entry-screen">
      <div class="entry-card">
        <p class="entry-name-display">你好，<strong>{{ playerName }}</strong>！</p>

        <div class="choose-grid">
          <button class="choose-btn" @click="doCreateRoom">
            <span class="choose-icon">🏠</span>
            <span class="choose-label">建立房間</span>
          </button>
          <div class="choose-btn" @click="phase = 'joining'">
            <span class="choose-icon">🔑</span>
            <span class="choose-label">加入房間</span>
          </div>
        </div>

        <p v-if="error" class="error-msg">{{ error }}</p>
      </div>
    </div>

    <!-- ── 輸入房間代碼 ── -->
    <div v-else-if="phase === 'joining'" class="entry-screen">
      <div class="entry-card">
        <h2 class="entry-title">加入房間</h2>
        <input
          v-model="roomCodeInput"
          class="entry-input code-input"
          placeholder="輸入房間代碼"
          maxlength="6"
          style="text-transform:uppercase; letter-spacing: 4px; text-align:center;"
          @keydown.enter="doJoinRoom"
        />
        <div class="entry-actions">
          <button class="btn-primary" :disabled="roomCodeInput.length < 4" @click="doJoinRoom">加入</button>
          <button class="btn-secondary" @click="phase = 'choose'">返回</button>
        </div>
        <p v-if="error" class="error-msg">{{ error }}</p>
      </div>
    </div>

    <!-- ── 等待室 ── -->
    <div v-else-if="phase === 'lobby'" class="lobby-screen">
      <div class="lobby-card">
        <p class="lobby-label">房間代碼</p>
        <div class="room-code">{{ roomId }}</div>
        <p class="lobby-hint">把代碼分享給朋友，他們輸入就能加入！</p>

        <div class="lobby-players">
          <PlayerList :players="room.players" :my-id="myId" drawer-id="" :guessed-ids="[]" />
        </div>

        <p class="lobby-count">{{ room.players.length }} / 6 人</p>

        <button
          v-if="isHost"
          class="btn-start"
          :disabled="room.players.length < 2"
          @click="doStartGame"
        >
          {{ room.players.length < 2 ? '等待更多玩家...' : '開始遊戲！' }}
        </button>
        <p v-else class="waiting-text">等待房主開始遊戲...</p>
      </div>
    </div>

    <!-- ── 遊戲中 ── -->
    <div v-else-if="phase === 'playing'" class="playing-layout">

      <!-- 左側：玩家列表 -->
      <div class="side-panel left-panel">
        <p class="panel-label">玩家</p>
        <PlayerList
          :players="room.players"
          :drawer-id="currentDrawerId"
          :my-id="myId"
          :guessed-ids="guessedIds"
        />
      </div>

      <!-- 中間：畫布區 -->
      <div class="center-panel">

        <!-- 狀態列 -->
        <div class="status-bar">
          <div class="status-left">
            <span class="drawer-label">
              {{ isDrawer ? '🎨 你在畫圖！' : `✏️ ${currentDrawerName} 正在畫` }}
            </span>
          </div>
          <div class="word-hint" v-if="!isDrawer && gamePhase === 'drawing'">
            {{ wordHint }}
          </div>
          <div class="word-display" v-if="isDrawer && gamePhase === 'drawing'">
            題目：<strong>{{ currentWord }}</strong>
          </div>
          <div class="timer-num" :class="timerClass">{{ timeLeft }}s</div>
        </div>

        <!-- 計時條 -->
        <div class="timer-track" v-if="gamePhase === 'drawing'">
          <div class="timer-fill" :class="timerClass" :style="{ width: timerPercent + '%' }" />
        </div>

        <!-- 選題目（只有畫家看得到）-->
        <div v-if="gamePhase === 'picking' && isDrawer" class="word-picker-bar">
          <p class="picker-label">選一個題目來畫：</p>
          <div class="word-choices">
            <button v-for="w in wordChoices" :key="w" class="word-btn" @click="doPickWord(w)">{{ w }}</button>
          </div>
        </div>
        <div v-else-if="gamePhase === 'picking' && !isDrawer" class="picking-wait">
          <span>⏳ 等待 {{ currentDrawerName }} 選題目...</span>
        </div>

        <!-- 畫布 -->
        <div class="canvas-wrap">
          <canvas
            ref="canvasRef"
            width="560" height="380"
            class="draw-canvas"
            :style="{ cursor: isDrawer && gamePhase === 'drawing' ? (tool === 'eraser' ? 'cell' : 'crosshair') : 'default' }"
            @mousedown="isDrawer && gamePhase === 'drawing' && startDraw($event)"
            @mousemove="isDrawer && gamePhase === 'drawing' && draw($event)"
            @mouseup="stopDraw"
            @mouseleave="stopDraw"
            @touchstart.prevent="isDrawer && gamePhase === 'drawing' && startDraw($event)"
            @touchmove.prevent="isDrawer && gamePhase === 'drawing' && draw($event)"
            @touchend="stopDraw"
          />
        </div>

        <!-- 畫家工具列 -->
        <div v-if="isDrawer && gamePhase === 'drawing'" class="toolbar">
          <div
            v-for="c in colors" :key="c"
            class="color-swatch"
            :class="{ active: currentColor === c && tool === 'pen' }"
            :style="{ background: c, border: c === '#ffffff' ? '1.5px solid rgba(255,255,255,0.25)' : 'none' }"
            @click="setColor(c)"
          />
          <div class="divider" />
          <span style="font-size:0.8rem">🖊</span>
          <input type="range" class="size-slider" min="2" max="40" v-model="brushSize" />
          <span class="size-label">{{ brushSize }}</span>
          <div class="divider" />
          <button class="tool-btn" :class="{ active: tool === 'pen' }"     @click="tool = 'pen'">✏️</button>
          <button class="tool-btn" :class="{ active: tool === 'eraser' }"  @click="tool = 'eraser'">🧹</button>
          <button class="tool-btn" @click="doClearCanvas">🗑️</button>
        </div>
      </div>

      <!-- 右側：聊天框 -->
      <div class="side-panel right-panel">
        <p class="panel-label">猜字區</p>
        <ChatBox
          :messages="chatMessages"
          :my-id="myId"
          :is-drawer="isDrawer"
          :disabled="gamePhase !== 'drawing'"
          @send="doGuess"
        />
      </div>
    </div>

    <!-- ── 本輪結算 overlay ── -->
    <Teleport to="body">
      <div v-if="showTurnEnd" class="overlay">
        <div class="overlay-card">
          <div class="overlay-icon">⏰</div>
          <h2 class="overlay-title">這輪結束！</h2>
          <p class="overlay-word">答案是：<strong>{{ lastWord }}</strong></p>
          <div class="score-list">
            <div v-for="p in turnScores" :key="p.id" class="score-row-item">
              <span>{{ p.name }}</span>
              <span class="score-val">{{ p.score }} 分</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ── 遊戲結束 overlay ── -->
      <div v-if="showGameEnd" class="overlay">
        <div class="overlay-card">
          <div class="overlay-icon">🏆</div>
          <h2 class="overlay-title">遊戲結束！</h2>
          <div class="ranking-list">
            <div v-for="(p, i) in ranking" :key="p.id" class="rank-row">
              <span class="rank-num">{{ ['🥇','🥈','🥉'][i] || `#${i+1}` }}</span>
              <span class="rank-name">{{ p.name }}</span>
              <span class="rank-score">{{ p.score }} 分</span>
            </div>
          </div>
          <button class="btn-primary" @click="handleBack">回首頁</button>
        </div>
      </div>
    </Teleport>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { io } from 'socket.io-client'
import PlayerList from '../components/draw/PlayerList.vue'
import ChatBox from '../components/draw/ChatBox.vue'

const router = useRouter()

type ViewPhase = 'entry' | 'choose' | 'joining' | 'lobby' | 'playing'
type GamePhase = 'lobby' | 'picking' | 'drawing' | 'roundEnd' | 'gameEnd'
type DrawTool = 'pen' | 'eraser'

type Player = {
  id: string
  name: string
  score: number
  isHost?: boolean
}

type RoomState = {
  id?: string
  players: Player[]
  phase?: GamePhase
}

type ChatMessage = {
  playerId?: string
  playerName?: string
  message: string
  isCorrect?: boolean
  isSystem?: boolean
}

type ScoreRow = {
  id: string
  name: string
  score: number
}

type DrawDot = {
  type: 'dot'
  x: number
  y: number
  size: number
  color: string
}

type DrawLine = {
  type: 'line'
  x1: number
  y1: number
  x2: number
  y2: number
  size: number
  color: string
}

type DrawEventPayload = DrawDot | DrawLine

// 這一層 phase 是頁面畫面流程：
// entry -> choose -> joining -> lobby -> playing。
const phase = ref<ViewPhase>('entry')
// 這一層 gamePhase 是進房後的遊戲內狀態：
// lobby / picking / drawing / roundEnd / gameEnd。
const gamePhase = ref<GamePhase>('lobby')
const playerName = ref('')
const roomCodeInput = ref('')
const roomId = ref('')
// 每個瀏覽器 websocket 連線都會有自己的 socket.id。
// 後端就是靠這個值區分不同玩家。
const myId = ref('')
const error = ref('')
// room 是後端同步回來的共享房間資料快照。
const room = ref<RoomState>({ players: [] })
const isHost = ref(false)

// 下面這批狀態主要是目前回合用的資料。
const currentDrawerId = ref('')
const currentDrawerName = ref('')
const currentWord = ref('')
const wordChoices = ref<string[]>([])
const wordHint = ref('')
const timeLeft = ref(60)
const guessedIds = ref<string[]>([])
const chatMessages = ref<ChatMessage[]>([])
const showTurnEnd = ref(false)
const showGameEnd = ref(false)
const lastWord = ref('')
const turnScores = ref<ScoreRow[]>([])
const ranking = ref<ScoreRow[]>([])

const canvasRef = ref<HTMLCanvasElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null
let drawing = false
let lastX = 0
let lastY = 0

const colors = ['#1a1a1a','#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#a855f7','#ffffff']
const currentColor = ref('#1a1a1a')
const brushSize = ref(6)
const tool = ref<DrawTool>('pen')

// 只要 myId 跟目前畫家 id 相同，這個玩家就會看到畫家 UI。
const isDrawer = computed(() => myId.value === currentDrawerId.value)
const timerPercent = computed(() => (timeLeft.value / 60) * 100)
const timerClass = computed(() => {
  const p = timerPercent.value
  if (p < 15) return 'danger'
  if (p < 33) return 'warning'
  return ''
})

type SocketClient = ReturnType<typeof io>
let socket: SocketClient | null = null
// websocket 預設直接連到本機 backend。
const SERVER = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'

onMounted(() => {
  // 每開一個分頁，都會建立一條新的 socket 連線。
  socket = io(SERVER, { transports: ['websocket'] })
  myId.value = ''

  socket.on('connect', () => {
    // socket.id 是目前這個玩家在後端的唯一識別。
    myId.value = socket?.id ?? ''
  })

  socket.on('playerJoined', ({ player, room: r }: { player: Player; room: RoomState }) => {
    // 有人加入時，後端會把最新 room 一起推回來。
    room.value = r
    addSystemMsg(`${player.name} 加入了房間`)
  })

  socket.on('playerLeft', ({ playerId, room: r }: { playerId: string; room: RoomState }) => {
    // 有人離開時，前端也是整包覆蓋同步後的 room。
    const name = room.value.players.find((player) => player.id === playerId)?.name || '玩家'
    room.value = r
    addSystemMsg(`${name} 離開了房間`)
  })

  socket.on('gameStarted', ({ room: r }: { room: RoomState }) => {
    // 正式開始後才切到 playing 畫面。
    room.value = r
    phase.value = 'playing'
    gamePhase.value = 'picking'
    clearCanvas()
    addSystemMsg('遊戲開始！')
  })

  socket.on('nextTurn', ({ drawerId, drawerName }: { drawerId: string; drawerName: string }) => {
    // 後端決定本輪畫家；所有玩家都會收到同一個事件。
    currentDrawerId.value = drawerId
    currentDrawerName.value = drawerName
    currentWord.value = ''
    wordHint.value = ''
    wordChoices.value = []
    guessedIds.value = []
    gamePhase.value = 'picking'
    clearCanvas()
    addSystemMsg(`換 ${drawerName} 畫圖了！`)
  })

  socket.on('wordChoices', ({ words }: { words: string[] }) => {
    // 只有畫家會收到題目選項。
    wordChoices.value = words
  })

  socket.on(
    'drawingStarted',
    ({
      drawerId,
      drawerName,
      wordLength,
      timeLeft: tl,
    }: {
      drawerId: string
      drawerName: string
      wordLength: number
      timeLeft: number
    }) => {
    // 畫家選完題後，全員一起進入 drawing；
    // 非畫家只知道字數，不知道答案。
    currentDrawerId.value = drawerId
    currentDrawerName.value = drawerName
    timeLeft.value = tl
    wordHint.value = '_ '.repeat(wordLength).trim()
    gamePhase.value = 'drawing'
    },
  )

  socket.on('timer', ({ timeLeft: tl }: { timeLeft: number }) => {
    // 計時器由後端主控，前端只負責顯示。
    timeLeft.value = tl
  })

  socket.on('draw', (data: DrawEventPayload) => {
    // 畫家送出筆跡後，其他玩家會在這裡重播。
    if (!ctx) initCanvas()
    remoteDraw(data)
  })

  socket.on('clearCanvas', () => clearCanvas())

  socket.on(
    'playerGuessed',
    ({ playerId, playerName: pn, scores }: { playerId: string; playerName: string; scores: ScoreRow[] }) => {
    // 猜中後，後端會把最新分數列表一併推回來。
    guessedIds.value.push(playerId)
    room.value.players = room.value.players.map((player) => {
      const score = scores.find((item) => item.id === player.id)
      return score ? { ...player, score: score.score } : player
    })
    addSystemMsg(`✅ ${pn} 猜對了！`)
    },
  )

  socket.on('chat', ({ playerId, playerName: pn, message }: { playerId: string; playerName: string; message: string }) => {
    // 一般猜錯內容會顯示在聊天室。
    chatMessages.value.push({ playerId, playerName: pn, message, isCorrect: false })
  })

  socket.on('turnEnd', ({ word, scores }: { word: string; scores: ScoreRow[] }) => {
    // 這輪結束時顯示答案與本輪分數。
    lastWord.value = word
    turnScores.value = scores
    showTurnEnd.value = true
    setTimeout(() => { showTurnEnd.value = false }, 3800)
  })

  socket.on('gameEnd', ({ ranking: r }: { ranking: ScoreRow[] }) => {
    // 全部輪次結束後顯示最終排行。
    ranking.value = r
    showGameEnd.value = true
  })
})

onUnmounted(() => {
  socket?.disconnect()
})

// ── Actions ─────────────────────────────────────────
function doCreateRoom() {
  if (!playerName.value.trim() || !socket) return
  error.value = ''
  // 建房時，後端會把目前這條 socket 視為房主玩家。
  socket.emit('createRoom', { playerName: playerName.value }, ({ roomId: id, room: r, error: err }: { roomId?: string; room?: RoomState; error?: string }) => {
    if (err || !id || !r) {
      error.value = err || '建立房間失敗'
      return
    }
    roomId.value = id
    room.value = r
    isHost.value = true
    phase.value = 'lobby'
  })
}

function doJoinRoom() {
  if (!socket) return
  const code = roomCodeInput.value.trim().toUpperCase()
  if (!code) return
  error.value = ''
  // 加房成功後，這個 socket 會被後端綁進 roomId 對應的房間。
  socket.emit('joinRoom', { roomId: code, playerName: playerName.value }, ({ error: err, room: r }: { error?: string; room?: RoomState }) => {
    if (err || !r) { error.value = err || '加入房間失敗'; return }
    roomId.value = code
    room.value = r
    isHost.value = false
    phase.value = 'lobby'
  })
}

function doStartGame() {
  // 權限最終由後端判斷，前端只是送開始請求。
  socket?.emit('startGame', { roomId: roomId.value }, ({ error: err }: { error?: string } = {}) => {
    if (err) error.value = err
  })
}

function doPickWord(word: string) {
  // 畫家選完題目後，後端才會正式切到 drawing 階段。
  socket?.emit('pickWord', { roomId: roomId.value, word })
  currentWord.value = word
}

function doGuess(message: string) {
  // 猜字是否正確、是否加分，全部由後端決定。
  socket?.emit('guess', { roomId: roomId.value, message })
  chatMessages.value.push({
    playerId: myId.value,
    playerName: playerName.value,
    message,
    isCorrect: false,
  })
}

function addSystemMsg(message: string) {
  chatMessages.value.push({ isSystem: true, message })
}

function handleBack() {
  socket?.disconnect()
  router.push('/')
}

// ── Canvas 繪圖 ──────────────────────────────────────
function initCanvas() {
  ctx = canvasRef.value ? canvasRef.value.getContext('2d') : null
  if (ctx) {
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    clearCanvas()
  }
}

function clearCanvas() {
  if (!ctx && canvasRef.value) initCanvas()
  if (!ctx) return
  ctx.clearRect(0, 0, 560, 380)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, 560, 380)
}

function getPos(e: MouseEvent | TouchEvent) {
  const canvas = canvasRef.value
  if (!canvas) return { x: 0, y: 0 }
  const rect = canvas.getBoundingClientRect()
  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height
  if ('touches' in e) {
    return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY }
  }
  return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
}

function startDraw(e: MouseEvent | TouchEvent) {
  if (!ctx) initCanvas()
  if (!ctx) return
  // 本地先畫一個點，再把 dot 事件送出去同步。
  drawing = true
  const pos = getPos(e)
  lastX = pos.x; lastY = pos.y
  ctx.beginPath()
  ctx.arc(pos.x, pos.y, brushSize.value / 2, 0, Math.PI * 2)
  ctx.fillStyle = tool.value === 'eraser' ? '#ffffff' : currentColor.value
  ctx.fill()
  socket?.emit('draw', { roomId: roomId.value, drawData: { type: 'dot', x: pos.x, y: pos.y, size: brushSize.value, color: tool.value === 'eraser' ? '#ffffff' : currentColor.value } })
}

function draw(e: MouseEvent | TouchEvent) {
  if (!drawing || !ctx) return
  // 拖曳時持續送出 line 事件，其他玩家會重播同樣軌跡。
  const pos = getPos(e)
  const color = tool.value === 'eraser' ? '#ffffff' : currentColor.value
  ctx.beginPath()
  ctx.moveTo(lastX, lastY)
  ctx.lineTo(pos.x, pos.y)
  ctx.strokeStyle = color
  ctx.lineWidth = brushSize.value
  ctx.stroke()
  socket?.emit('draw', { roomId: roomId.value, drawData: { type: 'line', x1: lastX, y1: lastY, x2: pos.x, y2: pos.y, size: brushSize.value, color } })
  lastX = pos.x; lastY = pos.y
}

function stopDraw() { drawing = false }

function setColor(c: string) { currentColor.value = c; tool.value = 'pen' }

function doClearCanvas() {
  // 清空畫布也是同步事件，不只是本地清掉而已。
  clearCanvas()
  socket?.emit('clearCanvas', { roomId: roomId.value })
}

function remoteDraw(data: DrawEventPayload) {
  // 這裡是重播從別的玩家傳來的筆跡資料。
  if (!ctx) return
  if (data.type === 'dot') {
    ctx.beginPath()
    ctx.arc(data.x, data.y, data.size / 2, 0, Math.PI * 2)
    ctx.fillStyle = data.color
    ctx.fill()
  } else if (data.type === 'line') {
    ctx.beginPath()
    ctx.moveTo(data.x1, data.y1)
    ctx.lineTo(data.x2, data.y2)
    ctx.strokeStyle = data.color
    ctx.lineWidth = data.size
    ctx.lineCap = 'round'
    ctx.stroke()
  }
}

nextTick(() => initCanvas())
</script>

<style scoped>
.mp-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #0f0f1a;
}

.game-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.9rem 1.2rem;
  background: rgba(255,255,255,0.03);
  border-bottom: 1px solid rgba(255,255,255,0.07);
}

.back-btn {
  background: rgba(255,255,255,0.07); border: none;
  color: rgba(255,255,255,0.7); padding: 6px 14px;
  border-radius: 10px; font-size: 0.85rem;
  transition: background 0.15s;
}
.back-btn:hover { background: rgba(255,255,255,0.12); }

.game-title-sm {
  font-family: var(--font-title); font-size: 1.3rem;
  background: linear-gradient(135deg, #a78bfa, #f472b6);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
}

.mode-badge {
  font-size: 0.75rem; background: rgba(244,114,182,0.15);
  color: #f472b6; padding: 4px 10px; border-radius: 20px; font-weight: 600;
}

/* ── Entry / Choose / Joining ── */
.entry-screen {
  flex: 1; display: flex; align-items: center; justify-content: center;
  padding: 2rem;
}

.entry-card {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 24px;
  padding: 2.5rem 2rem;
  display: flex; flex-direction: column; align-items: center;
  gap: 1.2rem; width: 100%; max-width: 400px;
  animation: fadeUp 0.3s ease both;
}

.entry-icon { font-size: 3rem; }

.entry-title {
  font-family: var(--font-title); font-size: 1.8rem; color: #fff;
}

.entry-name-display {
  font-size: 1rem; color: rgba(255,255,255,0.6);
}
.entry-name-display strong { color: #fff; }

.entry-input {
  width: 100%; background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 12px; padding: 12px 16px;
  color: #fff; font-size: 1rem; font-family: var(--font-main);
  outline: none; transition: border-color 0.15s;
}
.entry-input:focus { border-color: rgba(167,139,250,0.5); }
.entry-input::placeholder { color: rgba(255,255,255,0.25); }

.choose-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; width: 100%;
}

.choose-btn {
  background: rgba(255,255,255,0.05);
  border: 1.5px solid rgba(255,255,255,0.1);
  border-radius: 16px; padding: 1.5rem 1rem;
  display: flex; flex-direction: column; align-items: center;
  gap: 0.6rem; cursor: pointer;
  transition: transform 0.15s, background 0.15s;
  color: inherit;
}
.choose-btn:hover { background: rgba(255,255,255,0.1); transform: translateY(-3px); }

.choose-icon { font-size: 1.8rem; }
.choose-label { font-size: 0.9rem; font-weight: 700; color: #fff; }

.entry-actions { display: flex; gap: 0.8rem; width: 100%; flex-direction: column; }

.error-msg { font-size: 0.85rem; color: #ef4444; }

/* ── Lobby ── */
.lobby-screen {
  flex: 1; display: flex; align-items: center; justify-content: center; padding: 2rem;
}

.lobby-card {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 24px; padding: 2rem;
  display: flex; flex-direction: column; align-items: center;
  gap: 1rem; width: 100%; max-width: 420px;
}

.lobby-label { font-size: 0.75rem; color: rgba(255,255,255,0.35); letter-spacing: 2px; }

.room-code {
  font-family: var(--font-title); font-size: 3rem; letter-spacing: 8px;
  background: linear-gradient(135deg, #a78bfa, #f472b6);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
}

.lobby-hint { font-size: 0.8rem; color: rgba(255,255,255,0.3); text-align: center; }

.lobby-players { width: 100%; }

.lobby-count { font-size: 0.85rem; color: rgba(255,255,255,0.4); }

.waiting-text { font-size: 0.9rem; color: rgba(255,255,255,0.35); font-style: italic; }

/* ── Playing Layout ── */
.playing-layout {
  flex: 1; display: grid;
  grid-template-columns: 160px 1fr 200px;
  gap: 0;
  min-height: 0;
}

.side-panel {
  display: flex; flex-direction: column;
  padding: 10px;
  border-right: 1px solid rgba(255,255,255,0.06);
  overflow-y: auto;
}

.right-panel {
  border-right: none;
  border-left: 1px solid rgba(255,255,255,0.06);
}

.panel-label {
  font-size: 0.7rem; color: rgba(255,255,255,0.3);
  letter-spacing: 2px; margin-bottom: 8px;
}

.center-panel {
  display: flex; flex-direction: column;
  padding: 10px; gap: 8px; align-items: center;
}

/* Status bar */
.status-bar {
  width: 100%; display: flex; align-items: center;
  justify-content: space-between; gap: 1rem;
  padding: 6px 10px;
  background: rgba(255,255,255,0.04);
  border-radius: 10px;
}

.drawer-label { font-size: 0.85rem; color: rgba(255,255,255,0.7); }

.word-hint {
  font-size: 1rem; letter-spacing: 4px; font-weight: 700; color: rgba(255,255,255,0.5);
}

.word-display { font-size: 0.9rem; color: rgba(255,255,255,0.7); }
.word-display strong { color: #a78bfa; }

.timer-num {
  font-size: 1rem; font-weight: 700; color: #a78bfa;
  min-width: 36px; text-align: right;
  font-variant-numeric: tabular-nums;
}
.timer-num.warning { color: #fb923c; }
.timer-num.danger  { color: #ef4444; animation: pulse 0.6s infinite alternate; }

/* Timer bar */
.timer-track {
  width: 100%; height: 5px;
  background: rgba(255,255,255,0.08); border-radius: 99px; overflow: hidden;
}
.timer-fill {
  height: 100%; background: #a78bfa; border-radius: 99px;
  transition: width 0.9s linear, background 0.4s;
}
.timer-fill.warning { background: #fb923c; }
.timer-fill.danger  { background: #ef4444; }

/* Word picker bar */
.word-picker-bar {
  width: 100%; display: flex; align-items: center;
  gap: 0.8rem; flex-wrap: wrap;
  background: rgba(167,139,250,0.08);
  border: 1px solid rgba(167,139,250,0.2);
  border-radius: 12px; padding: 10px 14px;
}
.picker-label { font-size: 0.8rem; color: rgba(255,255,255,0.5); }
.word-choices { display: flex; gap: 0.6rem; flex-wrap: wrap; }
.word-btn {
  background: rgba(167,139,250,0.15); border: 1.5px solid rgba(167,139,250,0.35);
  color: #fff; font-family: var(--font-main); font-weight: 700; font-size: 1rem;
  padding: 6px 16px; border-radius: 10px; cursor: pointer;
  transition: transform 0.15s, background 0.15s;
}
.word-btn:hover { background: rgba(167,139,250,0.3); transform: translateY(-2px); }

.picking-wait {
  font-size: 0.85rem; color: rgba(255,255,255,0.35);
  padding: 8px 0; font-style: italic;
}

/* Canvas */
.canvas-wrap { position: relative; }
.draw-canvas {
  border-radius: 12px; border: 2px solid rgba(255,255,255,0.08);
  background: #fff; max-width: 100%; touch-action: none;
}

/* Toolbar */
.toolbar {
  display: flex; align-items: center; gap: 0.5rem;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px; padding: 6px 10px;
  flex-wrap: wrap; justify-content: center; width: 100%;
}
.color-swatch {
  width: 22px; height: 22px; border-radius: 50%; cursor: pointer;
  border: 2px solid transparent !important; transition: transform 0.15s;
}
.color-swatch:hover { transform: scale(1.2); }
.color-swatch.active { border-color: #fff !important; transform: scale(1.15); }
.divider { width: 1px; height: 20px; background: rgba(255,255,255,0.12); margin: 0 2px; }
.size-slider {
  -webkit-appearance: none; width: 70px; height: 4px;
  border-radius: 2px; background: rgba(255,255,255,0.15); outline: none; cursor: pointer;
}
.size-slider::-webkit-slider-thumb {
  -webkit-appearance: none; width: 12px; height: 12px;
  border-radius: 50%; background: #a78bfa; cursor: pointer;
}
.size-label { font-size: 0.72rem; color: rgba(255,255,255,0.4); min-width: 18px; text-align: center; }
.tool-btn {
  background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.7); border-radius: 8px;
  width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
  font-size: 0.85rem; transition: background 0.15s; cursor: pointer;
}
.tool-btn:hover { background: rgba(255,255,255,0.15); }
.tool-btn.active { background: rgba(167,139,250,0.25); border-color: rgba(167,139,250,0.5); color: #a78bfa; }

/* ── Overlay ── */
.overlay {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(15,15,26,0.88); backdrop-filter: blur(8px);
  display: flex; align-items: center; justify-content: center;
}

.overlay-card {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 24px; padding: 2.5rem 2rem;
  display: flex; flex-direction: column; align-items: center;
  gap: 1rem; text-align: center; min-width: 320px;
  animation: fadeIn 0.3s ease;
}

.overlay-icon { font-size: 3rem; animation: bounce 0.5s cubic-bezier(0.34,1.56,0.64,1); }
.overlay-title { font-family: var(--font-title); font-size: 1.8rem; color: #fff; }
.overlay-word { font-size: 1rem; color: rgba(255,255,255,0.55); }
.overlay-word strong { color: #a78bfa; font-size: 1.4rem; }

.score-list { width: 100%; display: flex; flex-direction: column; gap: 6px; }
.score-row-item {
  display: flex; justify-content: space-between;
  padding: 6px 12px; background: rgba(255,255,255,0.04); border-radius: 8px;
  font-size: 0.9rem; color: rgba(255,255,255,0.7);
}
.score-val { color: #a78bfa; font-weight: 700; }

.ranking-list { width: 100%; display: flex; flex-direction: column; gap: 8px; }
.rank-row {
  display: flex; align-items: center; gap: 12px;
  padding: 8px 14px; background: rgba(255,255,255,0.05); border-radius: 10px;
}
.rank-num { font-size: 1.2rem; width: 28px; }
.rank-name { flex: 1; font-weight: 600; color: #fff; }
.rank-score { color: #f472b6; font-weight: 700; }

/* Buttons */
.btn-primary {
  background: linear-gradient(135deg, #a78bfa, #f472b6);
  border: none; color: #fff; font-family: var(--font-main);
  font-weight: 700; font-size: 0.95rem; padding: 0.7rem 2rem;
  border-radius: 12px; cursor: pointer; transition: transform 0.15s, opacity 0.15s;
  width: 100%;
}
.btn-primary:hover:not(:disabled) { opacity: 0.9; transform: translateY(-2px); }
.btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }

.btn-secondary {
  background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.12);
  color: rgba(255,255,255,0.6); font-family: var(--font-main);
  font-size: 0.95rem; padding: 0.7rem 2rem; border-radius: 12px;
  cursor: pointer; transition: background 0.15s; width: 100%;
}
.btn-secondary:hover { background: rgba(255,255,255,0.12); }

.btn-start {
  background: linear-gradient(135deg, #a78bfa, #f472b6);
  border: none; color: #fff; font-family: var(--font-main);
  font-weight: 700; font-size: 1rem; padding: 0.8rem 2rem;
  border-radius: 14px; cursor: pointer; transition: transform 0.15s, opacity 0.15s;
  width: 100%;
}
.btn-start:hover:not(:disabled) { opacity: 0.9; transform: translateY(-2px); }
.btn-start:disabled { opacity: 0.4; cursor: not-allowed; }

/* Animations */
@keyframes fadeUp {
  from { transform: translateY(16px); opacity: 0; }
  to   { transform: translateY(0); opacity: 1; }
}
@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.96); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes bounce {
  from { transform: scale(0.5); opacity: 0; }
  to   { transform: scale(1); opacity: 1; }
}
@keyframes pulse {
  from { opacity: 1; }
  to   { opacity: 0.5; }
}

/* 響應式 */
@media (max-width: 700px) {
  .playing-layout {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr auto;
  }
  .side-panel { border: none; border-bottom: 1px solid rgba(255,255,255,0.06); max-height: 120px; }
  .right-panel { border: none; border-top: 1px solid rgba(255,255,255,0.06); max-height: 200px; }
}
</style>
