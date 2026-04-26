<template>
  <main class="home-shell">
    <div class="home-shell__glow home-shell__glow--left" />
    <div class="home-shell__glow home-shell__glow--right" />

    <section class="hero-card">
      <div class="hero-copy">
        <span class="hero-badge">Creative AI Playground</span>
        <h1>選擇今天想玩的模式</h1>
        <p>
          從聊天 Agent 到畫圖猜題，這裡是整個專案的入口。挑一個場景進去，
          直接開始互動、測試流程，或和朋友一起玩。
        </p>

        <div class="hero-actions">
          <router-link class="hero-button hero-button--primary" to="/chat">
            進入 Chat Workspace
          </router-link>
          <router-link class="hero-button hero-button--secondary" to="/draw_home">
            前往 Draw &amp; Guess
          </router-link>
        </div>
      </div>

      <div class="hero-panel">
        <div class="hero-panel__card">
          <p class="hero-panel__eyebrow">Current Routes</p>
          <ul class="hero-panel__list">
            <li>
              <span>Chat Agent</span>
              <strong>對話、session、timeline</strong>
            </li>
            <li>
              <span>Draw Game</span>
              <strong>單人畫圖猜題、多人體驗延伸</strong>
            </li>
          </ul>
        </div>
      </div>
    </section>

    <section class="entry-grid">
      <router-link class="entry-card entry-card--chat" to="/chat">
        <div class="entry-card__icon">AI</div>
        <div class="entry-card__content">
          <div class="entry-card__topline">
            <span class="entry-card__label">Agent Console</span>
            <span class="entry-card__status">Ready</span>
          </div>
          <h2>聊天工作台</h2>
          <p>
            測試 Agent 對話、工具執行、session 管理與 timeline
            流程，適合拿來驗證整體 orchestration 體驗。
          </p>
          <div class="entry-card__meta">
            <span>Skill 切換</span>
            <span>即時事件流</span>
            <span>歷史會話</span>
          </div>
        </div>
      </router-link>

      <router-link class="entry-card entry-card--draw" to="/draw_home">
        <div class="entry-card__icon">DK</div>
        <div class="entry-card__content">
          <div class="entry-card__topline">
            <span class="entry-card__label">Draw &amp; Guess</span>
            <span class="entry-card__status entry-card__status--warm">Fun Mode</span>
          </div>
          <h2>畫猜猜遊戲</h2>
          <p>
            進入遊戲模式，體驗單人畫圖猜題流程，也能為之後的多人玩法預留更完整的首頁入口。
          </p>
          <div class="entry-card__meta">
            <span>單人模式</span>
            <span>繪圖流程</span>
            <span>遊戲感介面</span>
          </div>
        </div>
      </router-link>
    </section>
  </main>
</template>

<style scoped>
.home-shell {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  padding: 32px 20px 48px;
  color: #f8f4ec;
}

.home-shell__glow {
  position: absolute;
  border-radius: 999px;
  filter: blur(12px);
  pointer-events: none;
}

.home-shell__glow--left {
  top: 72px;
  left: -120px;
  width: 320px;
  height: 320px;
  background: radial-gradient(circle, rgba(245, 171, 79, 0.2), transparent 72%);
}

.home-shell__glow--right {
  right: -80px;
  bottom: 40px;
  width: 380px;
  height: 380px;
  background: radial-gradient(circle, rgba(90, 157, 255, 0.16), transparent 72%);
}

.hero-card,
.entry-grid {
  position: relative;
  z-index: 1;
  width: min(1120px, 100%);
  margin: 0 auto;
}

.hero-card {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(280px, 0.9fr);
  gap: 24px;
  align-items: stretch;
  margin-bottom: 24px;
}

.hero-copy,
.hero-panel__card,
.entry-card {
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: linear-gradient(180deg, rgba(17, 24, 39, 0.72), rgba(9, 14, 26, 0.82));
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(16px);
}

.hero-copy {
  border-radius: 32px;
  padding: 40px;
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 7px 14px;
  background: rgba(244, 180, 103, 0.14);
  color: #f7c67d;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.hero-copy h1 {
  margin: 18px 0 14px;
  font-size: clamp(2.4rem, 5vw, 4.6rem);
  line-height: 1.02;
  letter-spacing: -0.04em;
}

.hero-copy p {
  max-width: 680px;
  margin: 0;
  color: rgba(244, 239, 230, 0.74);
  font-size: 1.02rem;
  line-height: 1.85;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-top: 28px;
}

.hero-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  padding: 0 20px;
  border-radius: 999px;
  font-weight: 700;
  text-decoration: none;
  transition:
    transform 0.2s ease,
    border-color 0.2s ease,
    background 0.2s ease;
}

.hero-button:hover {
  transform: translateY(-2px);
}

.hero-button--primary {
  background: linear-gradient(135deg, #f2c16b, #f59b60);
  color: #1f2430;
}

.hero-button--secondary {
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.04);
  color: #f7f2ea;
}

.hero-panel {
  display: flex;
}

.hero-panel__card {
  width: 100%;
  border-radius: 32px;
  padding: 28px;
}

.hero-panel__eyebrow {
  margin: 0 0 18px;
  color: rgba(247, 198, 125, 0.72);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.hero-panel__list {
  display: grid;
  gap: 14px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.hero-panel__list li {
  border-radius: 22px;
  padding: 18px 18px 16px;
  background: rgba(255, 255, 255, 0.04);
}

.hero-panel__list span,
.hero-panel__list strong {
  display: block;
}

.hero-panel__list span {
  margin-bottom: 8px;
  color: rgba(244, 239, 230, 0.56);
  font-size: 0.8rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.hero-panel__list strong {
  color: #fff7ea;
  line-height: 1.6;
}

.entry-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px;
}

.entry-card {
  display: flex;
  gap: 22px;
  border-radius: 30px;
  padding: 28px;
  color: inherit;
  text-decoration: none;
  transition:
    transform 0.24s ease,
    border-color 0.24s ease,
    box-shadow 0.24s ease;
}

.entry-card:hover {
  transform: translateY(-6px);
  border-color: rgba(255, 255, 255, 0.18);
  box-shadow: 0 28px 80px rgba(0, 0, 0, 0.34);
}

.entry-card--chat {
  background:
    radial-gradient(circle at top right, rgba(244, 180, 103, 0.16), transparent 34%),
    linear-gradient(180deg, rgba(17, 24, 39, 0.78), rgba(9, 14, 26, 0.88));
}

.entry-card--draw {
  background:
    radial-gradient(circle at top right, rgba(108, 134, 255, 0.16), transparent 34%),
    linear-gradient(180deg, rgba(17, 24, 39, 0.78), rgba(9, 14, 26, 0.88));
}

.entry-card__icon {
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 62px;
  height: 62px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.08);
  color: #fff7ea;
  font-size: 1rem;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.entry-card__content {
  min-width: 0;
}

.entry-card__topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.entry-card__label {
  color: rgba(244, 239, 230, 0.62);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.entry-card__status {
  border-radius: 999px;
  padding: 6px 10px;
  background: rgba(105, 219, 124, 0.12);
  color: #b7f5c2;
  font-size: 0.74rem;
  font-weight: 700;
}

.entry-card__status--warm {
  background: rgba(244, 180, 103, 0.14);
  color: #ffd59a;
}

.entry-card h2 {
  margin: 14px 0 10px;
  font-size: 1.9rem;
  line-height: 1.15;
}

.entry-card p {
  margin: 0;
  color: rgba(244, 239, 230, 0.72);
  line-height: 1.8;
}

.entry-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 20px;
}

.entry-card__meta span {
  border-radius: 999px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(247, 242, 234, 0.88);
  font-size: 0.8rem;
}

@media (max-width: 900px) {
  .hero-card,
  .entry-grid {
    grid-template-columns: 1fr;
  }

  .hero-copy {
    padding: 32px 24px;
  }
}

@media (max-width: 640px) {
  .home-shell {
    padding: 20px 16px 32px;
  }

  .hero-copy h1 {
    font-size: 2.4rem;
  }

  .entry-card {
    flex-direction: column;
    padding: 24px 20px;
  }

  .entry-card__topline {
    align-items: flex-start;
    flex-direction: column;
  }

  .hero-actions {
    flex-direction: column;
  }

  .hero-button {
    width: 100%;
  }
}
</style>
