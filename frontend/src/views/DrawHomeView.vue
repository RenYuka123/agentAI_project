<template>
  <div class="home">
    <div class="bg-glow" />

    <h1 class="title">畫猜猜！</h1>
    <p class="subtitle">Draw &amp; Guess</p>

    <div class="mode-grid">
      <!-- 單人模式 -->
      <div class="mode-card solo" @click="router.push('/single')">
        <div class="mode-icon">🤖</div>
        <div class="mode-label">單人模式</div>
        <div class="mode-desc">你畫圖，AI 來猜！</div>
      </div>

      <!-- 多人模式（尚未開放）-->
      <div class="mode-card multi" @click="router.push('/multi')">
        <div class="mode-icon">👥</div>
        <div class="mode-label">多人模式</div>
        <div class="mode-desc">與朋友一起玩</div>
        <span class="badge-soon">即將推出</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
const router = useRouter()
</script>

<style scoped>
.home {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  background: radial-gradient(ellipse at 50% 30%, #1e1440 0%, #0f0f1a 70%);
  position: relative;
  overflow: hidden;
}

.bg-glow {
  position: absolute;
  width: 600px;
  height: 600px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(120, 80, 255, 0.12) 0%, transparent 70%);
  top: -100px;
  left: 50%;
  transform: translateX(-50%);
  pointer-events: none;
}

.title {
  font-family: var(--font-title);
  font-size: clamp(2.8rem, 8vw, 5rem);
  letter-spacing: 2px;
  background: linear-gradient(135deg, #a78bfa, #f472b6, #fb923c);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 0.3rem;
  text-align: center;
  animation: titlePop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

.subtitle {
  font-size: 1rem;
  color: var(--text-muted);
  letter-spacing: 3px;
  text-transform: uppercase;
  margin-bottom: 3.5rem;
  animation: fadeUp 0.5s 0.2s both;
}

.mode-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  width: 100%;
  max-width: 480px;
  animation: fadeUp 0.5s 0.35s both;
}

.mode-card {
  border-radius: 20px;
  padding: 1.8rem 1.2rem;
  cursor: pointer;
  border: 1.5px solid var(--border-subtle);
  background: var(--bg-card);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.7rem;
  transition: transform 0.2s, background 0.2s, border-color 0.2s;
  backdrop-filter: blur(10px);
  position: relative;
  overflow: hidden;
}

.mode-card::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 20px;
  opacity: 0;
  transition: opacity 0.3s;
}

.mode-card.solo::after {
  background: radial-gradient(circle at 50% 0%, rgba(167, 139, 250, 0.15), transparent 70%);
}

.mode-card.multi::after {
  background: radial-gradient(circle at 50% 0%, rgba(244, 114, 182, 0.15), transparent 70%);
}

.mode-card:not(.disabled):hover {
  transform: translateY(-4px);
  border-color: rgba(255, 255, 255, 0.2);
}

.mode-card:not(.disabled):hover::after {
  opacity: 1;
}

.mode-card:not(.disabled):active {
  transform: scale(0.97);
}

.mode-card.disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.mode-icon {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.6rem;
}

.solo .mode-icon { background: rgba(167, 139, 250, 0.2); }
.multi .mode-icon { background: rgba(244, 114, 182, 0.2); }

.mode-label {
  font-weight: 700;
  font-size: 1rem;
  color: #fff;
}

.mode-desc {
  font-size: 0.75rem;
  color: var(--text-muted);
  text-align: center;
  line-height: 1.5;
}

.badge-soon {
  font-size: 0.65rem;
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.5);
  padding: 2px 8px;
  border-radius: 20px;
  letter-spacing: 1px;
}

@keyframes titlePop {
  from { transform: scale(0.8); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

@keyframes fadeUp {
  from { transform: translateY(16px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
</style>
