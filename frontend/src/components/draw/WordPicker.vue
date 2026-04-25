<template>
  <div class="picker-overlay">
    <div class="picker-card">
      <p class="picker-label">選一個題目來畫！</p>
      <div class="word-choices">
        <button
          v-for="word in store.wordChoices"
          :key="word"
          class="word-btn"
          @click="store.pickWord(word)"
        >
          {{ word }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useGameStore } from '../../stores/games'
const store = useGameStore()
</script>

<style scoped>
.picker-overlay {
  position: absolute;
  inset: 0;
  background: rgba(15, 15, 26, 0.85);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  border-radius: 16px;
  animation: fadeIn 0.25s ease;
}

.picker-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.2rem;
  padding: 2rem;
}

.picker-label {
  font-size: 1rem;
  color: rgba(255, 255, 255, 0.6);
  letter-spacing: 1px;
}

.word-choices {
  display: flex;
  gap: 0.8rem;
  flex-wrap: wrap;
  justify-content: center;
}

.word-btn {
  background: rgba(167, 139, 250, 0.12);
  border: 1.5px solid rgba(167, 139, 250, 0.35);
  color: #fff;
  font-size: 1.2rem;
  font-weight: 700;
  font-family: var(--font-main);
  padding: 0.8rem 1.6rem;
  border-radius: 14px;
  cursor: pointer;
  transition: transform 0.15s, background 0.15s, border-color 0.15s;
}

.word-btn:hover {
  background: rgba(167, 139, 250, 0.25);
  border-color: rgba(167, 139, 250, 0.7);
  transform: translateY(-3px) scale(1.04);
}

.word-btn:active {
  transform: scale(0.97);
}

@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
</style>
