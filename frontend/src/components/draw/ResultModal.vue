<template>
  <div class="modal-overlay">
    <div class="modal-card">

      <!-- 猜對 / 猜錯 icon -->
      <div class="modal-icon">{{ store.aiCorrect ? '🎉' : '🤔' }}</div>

      <h2 class="modal-title">
        {{ store.aiCorrect ? 'AI 猜對了！' : 'AI 猜錯了...' }}
      </h2>

      <!-- AI 猜測結果 -->
      <div class="ai-result-box" :class="store.aiCorrect ? 'correct' : 'wrong'">
        <span class="ai-label">AI 猜的是</span>
        <span class="ai-guess">{{ store.aiGuess }}</span>
      </div>

      <!-- AI 評語 -->
      <p class="ai-comment" v-if="store.aiComment">「{{ store.aiComment }}」</p>

      <p class="ai-confidence">
        判定信心：<span class="confidence-badge">{{ confidenceLabel }}</span>
      </p>

      <!-- 正確答案 -->
      <p class="modal-word">
        正確答案：<span class="word-highlight">{{ store.currentWord }}</span>
      </p>

      <!-- 分數 -->
      <div class="score-row">
        <span class="score-label">本局得分</span>
        <span class="score-num">{{ store.score }} / {{ store.round }}</span>
      </div>

      <div class="modal-actions">
        <button class="btn-primary" @click="handleNext">再畫一題</button>
        <button class="btn-secondary" @click="handleBack">回首頁</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '../../stores/games'

const store = useGameStore()
const router = useRouter()
const confidenceLabel = computed(() => {
  if (store.lastConfidence === 'high') return '高'
  if (store.lastConfidence === 'medium') return '中'
  return '低'
})

function handleNext() {
  store.startRound()
}

function handleBack() {
  store.reset()
  router.push('/')
}
</script>

<style scoped>
.modal-overlay {
  position: absolute;
  inset: 0;
  background: rgba(15, 15, 26, 0.9);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 20;
  border-radius: 16px;
  animation: fadeIn 0.3s ease;
}

.modal-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.9rem;
  padding: 2.2rem 2rem;
  text-align: center;
  max-width: 340px;
  width: 100%;
}

.modal-icon {
  font-size: 3rem;
  animation: bounce 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.modal-title {
  font-family: var(--font-title);
  font-size: 1.8rem;
  color: #fff;
}

/* AI 猜測框 */
.ai-result-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  padding: 0.8rem 2rem;
  border-radius: 14px;
  border: 1.5px solid;
}

.ai-result-box.correct {
  background: rgba(34, 197, 94, 0.1);
  border-color: rgba(34, 197, 94, 0.4);
}

.ai-result-box.wrong {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.35);
}

.ai-label {
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.4);
  letter-spacing: 1px;
}

.ai-guess {
  font-size: 1.6rem;
  font-weight: 700;
  color: #fff;
}

.ai-comment {
  font-size: 0.88rem;
  color: rgba(255, 255, 255, 0.5);
  font-style: italic;
}

.ai-confidence {
  font-size: 0.82rem;
  color: rgba(255, 255, 255, 0.45);
}

.confidence-badge {
  color: #fbbf24;
  font-weight: 700;
}

.modal-word {
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.4);
}

.word-highlight {
  font-size: 1.2rem;
  font-weight: 700;
  color: #a78bfa;
}

.score-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  padding: 0.5rem 1.2rem;
}

.score-label {
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.4);
}

.score-num {
  font-size: 1rem;
  font-weight: 700;
  color: #f472b6;
}

.modal-actions {
  display: flex;
  gap: 0.8rem;
  margin-top: 0.3rem;
  flex-wrap: wrap;
  justify-content: center;
}

.btn-primary {
  background: linear-gradient(135deg, #a78bfa, #f472b6);
  border: none;
  color: #fff;
  font-family: var(--font-main);
  font-weight: 700;
  font-size: 0.95rem;
  padding: 0.7rem 1.6rem;
  border-radius: 12px;
  cursor: pointer;
  transition: transform 0.15s, opacity 0.15s;
}

.btn-primary:hover { opacity: 0.9; transform: translateY(-2px); }
.btn-primary:active { transform: scale(0.97); }

.btn-secondary {
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.6);
  font-family: var(--font-main);
  font-size: 0.95rem;
  padding: 0.7rem 1.6rem;
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-secondary:hover { background: rgba(255, 255, 255, 0.12); }

@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes bounce {
  from { transform: scale(0.5); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
</style>
