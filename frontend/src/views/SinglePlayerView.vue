<template>
  <div class="game-page">
    <!-- Header -->
    <div class="game-header">
      <button class="back-btn" @click="handleBack">← 返回</button>
      <div class="game-title-sm">畫猜猜！</div>
      <div class="mode-badge">單人模式</div>
    </div>

    <!-- 尚未開始：開始按鈕 -->
    <div v-if="store.phase === 'idle'" class="idle-screen">
      <div class="idle-icon">🎨</div>
      <h2 class="idle-title">準備好了嗎？</h2>
      <p class="idle-desc">系統會給你 3 個題目，選一個來畫！</p>
      <button class="btn-start" @click="store.startRound()">開始遊戲</button>
    </div>

    <!-- 遊戲中 -->
    <div v-else class="canvas-area">

      <!-- 題目 + 計時器列 -->
      <div class="info-bar">
        <div class="word-display">
          <span class="word-label">題目</span>
          <span class="word-text">{{ store.phase === 'drawing' ? store.currentWord : '???' }}</span>
        </div>
        <TimerBar v-if="store.phase === 'drawing'" />
      </div>

      <!-- Canvas 包一層 relative 給 overlay 用 -->
      <div class="canvas-container">
        <DrawingCanvas
          ref="canvasComponent"
          :canvas-width="600"
          :canvas-height="400"
        />

        <!-- 選題目 overlay -->
        <WordPicker v-if="store.phase === 'picking'" />

        <!-- AI 猜圖 loading overlay -->
        <div v-if="store.phase === 'guessing'" class="guessing-overlay">
          <div class="guessing-spinner" />
          <p class="guessing-text">AI 正在看你的傑作...</p>
        </div>

        <!-- 結果 overlay -->
        <ResultModal v-if="store.phase === 'result'" />
      </div>

      <!-- 提交按鈕（畫圖中才顯示）-->
      <button
        v-if="store.phase === 'drawing'"
        class="btn-submit"
        @click="handleSubmit()"
      >
        ✅ 我畫好了！
      </button>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '../stores/games'
import DrawingCanvas from '../components/draw/DrawingCanvas.vue'
import WordPicker from '../components/draw/WordPicker.vue'
import TimerBar from '../components/draw/TimerBar.vue'
import ResultModal from '../components/draw/ResultModal.vue'

const router = useRouter()
const store = useGameStore()
type CanvasComponentExposed = {
  canvasRef?: HTMLCanvasElement | null
  clearCanvas?: () => void
}

const canvasComponent = ref<CanvasComponentExposed | null>(null)

function handleSubmit(options: { timedOut?: boolean } = {}) {
  const canvas = canvasComponent.value?.canvasRef
  const dataUrl = canvas ? canvas.toDataURL('image/png') : null
  store.submitDrawing(dataUrl, options)
}

function handleBack() {
  store.reset()
  router.push('/')
}

watch(
  () => store.phase,
  (phase, previousPhase) => {
    if (phase === 'picking') {
      canvasComponent.value?.clearCanvas?.()
    }

    if (phase === 'timeup' && previousPhase !== 'guessing' && previousPhase !== 'result') {
      handleSubmit({ timedOut: true })
    }
  },
)
</script>

<style scoped>
.game-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #0f0f1a;
}

.game-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.9rem 1.2rem;
  background: rgba(255, 255, 255, 0.03);
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
}

.back-btn {
  background: rgba(255, 255, 255, 0.07);
  border: none;
  color: rgba(255, 255, 255, 0.7);
  padding: 6px 14px;
  border-radius: 10px;
  font-size: 0.85rem;
  transition: background 0.15s;
}

.back-btn:hover { background: rgba(255, 255, 255, 0.12); }

.game-title-sm {
  font-family: var(--font-title);
  font-size: 1.3rem;
  background: linear-gradient(135deg, #a78bfa, #f472b6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.mode-badge {
  font-size: 0.75rem;
  background: rgba(167, 139, 250, 0.15);
  color: #a78bfa;
  padding: 4px 10px;
  border-radius: 20px;
  font-weight: 600;
}

/* ── Idle 畫面 ── */
.idle-screen {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 2rem;
  animation: fadeUp 0.4s ease both;
}

.idle-icon { font-size: 3.5rem; }

.idle-title {
  font-family: var(--font-title);
  font-size: 2rem;
  color: #fff;
}

.idle-desc {
  font-size: 0.95rem;
  color: rgba(255, 255, 255, 0.45);
  text-align: center;
}

.btn-start {
  margin-top: 0.5rem;
  background: linear-gradient(135deg, #a78bfa, #f472b6);
  border: none;
  color: #fff;
  font-family: var(--font-main);
  font-weight: 700;
  font-size: 1.05rem;
  padding: 0.8rem 2.4rem;
  border-radius: 14px;
  cursor: pointer;
  transition: transform 0.15s, opacity 0.15s;
}

.btn-start:hover { opacity: 0.9; transform: translateY(-2px); }
.btn-start:active { transform: scale(0.97); }

/* ── 遊戲中 ── */
.canvas-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem;
  gap: 0.8rem;
}

.info-bar {
  width: 100%;
  max-width: 640px;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.word-display {
  display: flex;
  align-items: center;
  gap: 0.8rem;
}

.word-label {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.35);
  letter-spacing: 1px;
}

.word-text {
  font-size: 1.4rem;
  font-weight: 700;
  color: #fff;
  letter-spacing: 1px;
}

/* Canvas 包 relative，讓 overlay 定位在上面 */
.canvas-container {
  position: relative;
  width: 100%;
  max-width: 640px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.btn-submit {
  background: rgba(167, 139, 250, 0.15);
  border: 1.5px solid rgba(167, 139, 250, 0.4);
  color: #a78bfa;
  font-family: var(--font-main);
  font-weight: 700;
  font-size: 0.95rem;
  padding: 0.65rem 1.8rem;
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.15s, transform 0.15s;
}

.btn-submit:hover {
  background: rgba(167, 139, 250, 0.28);
  transform: translateY(-2px);
}

@keyframes fadeUp {
  from { transform: translateY(16px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.guessing-overlay {
  position: absolute;
  inset: 0;
  background: rgba(15, 15, 26, 0.88);
  backdrop-filter: blur(8px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.2rem;
  z-index: 20;
  border-radius: 16px;
}

.guessing-spinner {
  width: 48px;
  height: 48px;
  border: 3px solid rgba(167, 139, 250, 0.2);
  border-top-color: #a78bfa;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.guessing-text {
  font-size: 1rem;
  color: rgba(255, 255, 255, 0.6);
  letter-spacing: 1px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

</style>
