<template>
  <div class="timer-wrap">
    <div class="timer-info">
      <span class="timer-label">剩餘時間</span>
      <span class="timer-num" :class="urgentClass">{{ store.timeLeft }}s</span>
    </div>
    <div class="timer-track">
      <div
        class="timer-fill"
        :class="urgentClass"
        :style="{ width: store.timePercent + '%' }"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '../../stores/games'

const store = useGameStore()

// 剩餘 < 33% 變橘，< 15% 變紅
const urgentClass = computed(() => {
  const p = store.timePercent
  if (p < 15) return 'danger'
  if (p < 33) return 'warning'
  return ''
})
</script>

<style scoped>
.timer-wrap {
  width: 100%;
  max-width: 640px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.timer-info {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.timer-label {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.35);
}

.timer-num {
  font-size: 1.1rem;
  font-weight: 700;
  color: #a78bfa;
  transition: color 0.4s;
  font-variant-numeric: tabular-nums;
}

.timer-num.warning { color: #fb923c; }
.timer-num.danger  { color: #ef4444; animation: pulse 0.6s infinite alternate; }

.timer-track {
  width: 100%;
  height: 6px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 99px;
  overflow: hidden;
}

.timer-fill {
  height: 100%;
  background: #a78bfa;
  border-radius: 99px;
  transition: width 0.9s linear, background 0.4s;
}

.timer-fill.warning { background: #fb923c; }
.timer-fill.danger  { background: #ef4444; }

@keyframes pulse {
  from { opacity: 1; }
  to   { opacity: 0.5; }
}
</style>
