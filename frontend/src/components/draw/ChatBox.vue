<template>
  <div class="chatbox">
    <div class="chat-messages" ref="messagesEl">
      <div
        v-for="(msg, i) in messages"
        :key="i"
        class="chat-msg"
        :class="{
          'msg-correct': msg.isCorrect,
          'msg-system':  msg.isSystem,
          'msg-mine':    msg.playerId === myId && !msg.isSystem,
        }"
      >
        <span v-if="!msg.isSystem" class="msg-name">{{ msg.playerName }}</span>
        <span class="msg-text">{{ msg.message }}</span>
      </div>
      <div v-if="messages.length === 0" class="chat-empty">在這裡猜答案！</div>
    </div>

    <div class="chat-input-row">
      <input
        ref="inputEl"
        v-model="inputText"
        class="chat-input"
        placeholder="輸入猜測..."
        :disabled="isDrawer || disabled"
        maxlength="20"
        @keydown.enter="sendGuess"
      />
      <button
        class="send-btn"
        :disabled="!inputText.trim() || isDrawer || disabled"
        @click="sendGuess"
      >送出</button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'

const props = defineProps({
  messages:  { type: Array,   default: () => [] },
  myId:      { type: String,  default: '' },
  isDrawer:  { type: Boolean, default: false },
  disabled:  { type: Boolean, default: false },
})

const emit = defineEmits(['send'])

const inputText = ref('')
const messagesEl = ref(null)
const inputEl = ref(null)

function sendGuess() {
  const text = inputText.value.trim()
  if (!text || props.isDrawer) return
  emit('send', text)
  inputText.value = ''
}

// 自動捲到底
watch(() => props.messages.length, async () => {
  await nextTick()
  if (messagesEl.value) {
    messagesEl.value.scrollTop = messagesEl.value.scrollHeight
  }
})
</script>

<style scoped>
.chatbox {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-height: 0;
}

.chat-messages::-webkit-scrollbar { width: 4px; }
.chat-messages::-webkit-scrollbar-track { background: transparent; }
.chat-messages::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

.chat-empty {
  text-align: center;
  color: rgba(255,255,255,0.2);
  font-size: 0.8rem;
  margin-top: 1rem;
}

.chat-msg {
  display: flex;
  gap: 6px;
  align-items: baseline;
  font-size: 0.82rem;
  line-height: 1.4;
  padding: 3px 6px;
  border-radius: 8px;
}

.chat-msg.msg-correct {
  background: rgba(34,197,94,0.12);
  border: 1px solid rgba(34,197,94,0.25);
  color: #4ade80;
  font-weight: 700;
}

.chat-msg.msg-system {
  color: rgba(255,255,255,0.3);
  font-size: 0.75rem;
  font-style: italic;
}

.chat-msg.msg-mine .msg-name { color: #f472b6; }

.msg-name {
  color: #a78bfa;
  font-weight: 700;
  flex-shrink: 0;
}

.msg-text { color: rgba(255,255,255,0.75); }

.chat-input-row {
  display: flex;
  gap: 6px;
  padding: 8px;
  border-top: 1px solid rgba(255,255,255,0.07);
}

.chat-input {
  flex: 1;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 10px;
  padding: 7px 12px;
  color: #fff;
  font-size: 0.85rem;
  font-family: var(--font-main);
  outline: none;
  transition: border-color 0.15s;
}

.chat-input::placeholder { color: rgba(255,255,255,0.25); }
.chat-input:focus { border-color: rgba(167,139,250,0.5); }
.chat-input:disabled { opacity: 0.4; cursor: not-allowed; }

.send-btn {
  background: rgba(167,139,250,0.2);
  border: 1px solid rgba(167,139,250,0.35);
  color: #a78bfa;
  border-radius: 10px;
  padding: 7px 14px;
  font-size: 0.82rem;
  font-weight: 700;
  font-family: var(--font-main);
  transition: background 0.15s;
}

.send-btn:hover:not(:disabled) { background: rgba(167,139,250,0.35); }
.send-btn:disabled { opacity: 0.3; cursor: not-allowed; }
</style>
