<template>
  <div class="player-list">
    <div
      v-for="player in players"
      :key="player.id"
      class="player-row"
      :class="{
        'is-drawer': player.id === drawerId,
        'is-guessed': guessedIds.includes(player.id),
        'is-me': player.id === myId,
      }"
    >
      <div class="player-avatar">{{ player.name[0]?.toUpperCase() }}</div>
      <div class="player-info">
        <span class="player-name">
          {{ player.name }}
          <span v-if="player.id === myId" class="tag-me">你</span>
          <span v-if="player.isHost" class="tag-host">房主</span>
        </span>
        <span class="player-score">{{ player.score }} 分</span>
      </div>
      <div class="player-status">
        <span v-if="player.id === drawerId">🖊</span>
        <span v-else-if="guessedIds.includes(player.id)">✅</span>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  players:   { type: Array, default: () => [] },
  drawerId:  { type: String, default: '' },
  myId:      { type: String, default: '' },
  guessedIds:{ type: Array,  default: () => [] },
})
</script>

<style scoped>
.player-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}

.player-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 12px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.06);
  transition: background 0.2s;
}

.player-row.is-drawer {
  background: rgba(167,139,250,0.1);
  border-color: rgba(167,139,250,0.3);
}

.player-row.is-guessed {
  background: rgba(34,197,94,0.08);
  border-color: rgba(34,197,94,0.25);
}

.player-row.is-me {
  border-color: rgba(244,114,182,0.35);
}

.player-avatar {
  width: 32px; height: 32px;
  border-radius: 50%;
  background: rgba(167,139,250,0.2);
  color: #a78bfa;
  font-weight: 700;
  font-size: 0.85rem;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}

.player-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.player-name {
  font-size: 0.85rem;
  font-weight: 600;
  color: #fff;
  display: flex;
  align-items: center;
  gap: 5px;
}

.tag-me, .tag-host {
  font-size: 0.6rem;
  padding: 1px 5px;
  border-radius: 6px;
  font-weight: 700;
}

.tag-me   { background: rgba(244,114,182,0.2); color: #f472b6; }
.tag-host { background: rgba(251,146,60,0.2);  color: #fb923c; }

.player-score {
  font-size: 0.72rem;
  color: rgba(255,255,255,0.35);
}

.player-status { font-size: 1rem; }
</style>
