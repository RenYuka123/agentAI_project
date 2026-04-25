<template>
  <main
    class="min-h-screen bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_30%),linear-gradient(180deg,rgba(247,199,121,0.12),transparent_30%)] px-4 py-6 text-stone-100 sm:px-6 lg:px-10"
  >
    <section
      class="mx-auto flex min-h-[calc(100vh-3rem)] max-w-7xl flex-col gap-4 lg:flex-row"
    >
      <aside
        class="flex overflow-hidden rounded-[2rem] border border-white/10 bg-white/6 shadow-[0_20px_80px_rgba(0,0,0,0.25)] backdrop-blur xl:max-w-sm"
      >
        <div class="flex w-full flex-col p-6">
          <div class="mb-6 flex items-center gap-3">
            <div
              class="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-300/90 text-lg font-semibold text-slate-900"
            >
              AI
            </div>
            <div>
              <p class="text-sm uppercase tracking-[0.28em] text-amber-200/70">
                Agent Console
              </p>
              <h1 class="text-2xl font-semibold text-stone-50">
                Chat Workspace
              </h1>
            </div>
          </div>

          <button
            class="mb-4 inline-flex items-center justify-center rounded-full bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-200"
            @click="startNewSession"
          >
            開始新對話
          </button>

          <div
            class="mb-4 rounded-2xl border border-white/10 bg-slate-950/20 p-4"
          >
            <p
              class="mb-2 text-xs uppercase tracking-[0.2em] text-amber-200/70"
            >
              Sessions
            </p>
            <div class="max-h-72 space-y-2 overflow-y-auto pr-1">
              <button
                v-for="session in sessions"
                :key="session.sessionId"
                class="flex w-full items-start justify-between gap-3 rounded-2xl border px-3 py-3 text-left transition"
                :class="
                  session.sessionId === sessionId
                    ? 'border-amber-300/40 bg-amber-300/10'
                    : 'border-white/10 bg-slate-950/20 hover:bg-white/5'
                "
                @click="selectSession(session.sessionId)"
              >
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium text-stone-100">
                    {{ session.title }}
                  </p>
                  <p class="mt-1 text-xs text-stone-400">
                    {{ formatSessionTime(session.updatedAt) }}
                  </p>
                </div>
                <span
                  class="rounded-full px-2 py-1 text-xs text-rose-200 transition hover:bg-rose-400/15"
                  @click.stop="removeSession(session.sessionId)"
                >
                  刪除
                </span>
              </button>

              <p
                v-if="!sessions.length"
                class="text-sm leading-6 text-stone-400"
              >
                目前還沒有會話，先開始一段新對話吧。
              </p>
            </div>
          </div>

          <p class="text-sm leading-7 text-stone-300/85">
            這裡先用聊天作為前端入口。你可以測試 Agent
            是否會判斷工具、執行工具，再把結果整理成自然語言回覆。
          </p>

          <div
            class="mt-6 rounded-2xl border border-white/10 bg-slate-950/20 p-4"
          >
            <label
              class="mb-2 block text-xs uppercase tracking-[0.2em] text-amber-200/70"
              >Skill</label
            >
            <select
              v-model="selectedSkill"
              class="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-stone-100 outline-none"
            >
              <option value="default">auto</option>
              <option value="investment_analysis">investment_analysis</option>
              <option value="weather_summary">weather_summary</option>
            </select>
            <p class="mt-3 text-xs leading-6 text-stone-400">
              `auto` 會先由 Agent 判斷本輪該走哪個 skill；`investment_analysis`
              與 `weather_summary` 則會直接覆蓋自動判斷。
            </p>
          </div>
        </div>
      </aside>

      <section
        class="flex min-h-[70vh] flex-1 flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/35 shadow-[0_20px_80px_rgba(0,0,0,0.35)] backdrop-blur"
      >
        <header
          class="flex items-center justify-between border-b border-white/10 px-5 py-4 sm:px-6"
        >
          <div>
            <p class="text-xs uppercase tracking-[0.24em] text-amber-200/60">
              Live Session
            </p>
            <h2 class="mt-1 text-lg font-medium text-stone-50">
              {{ currentSessionTitle }}
            </h2>
          </div>
          <div
            class="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-xs text-emerald-200"
          >
            {{ isLoading ? "Agent thinking..." : "Ready" }}
          </div>
        </header>
        <div class="flex min-h-0 flex-1 flex-col lg:flex-row">
          <div class="flex min-h-0 flex-1 flex-col">
            <div
              ref="messageListRef"
              class="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6"
            >
              <article
                v-for="message in messages"
                :key="message.id"
                class="flex"
                :class="message.role === 'user' ? 'justify-end' : 'justify-start'"
              >
                <div
                  class="max-w-3xl rounded-[1.5rem] px-4 py-3 text-sm leading-7 shadow-[0_16px_40px_rgba(0,0,0,0.18)] sm:px-5"
                  :class="{
                    'bg-amber-300 text-slate-950': message.role === 'user',
                    'bg-white/10 text-stone-100': message.role === 'assistant',
                    'bg-rose-400/15 text-rose-100 ring-1 ring-rose-300/20':
                      message.role === 'system',
                  }"
                >
                  <p
                    class="mb-2 text-[11px] uppercase tracking-[0.24em] opacity-60"
                  >
                    {{
                      message.role === "user"
                        ? "You"
                        : message.role === "assistant"
                          ? "Agent"
                          : "System"
                    }}
                  </p>
                  <p class="whitespace-pre-wrap">{{ message.content }}</p>
                </div>
              </article>
            </div>

            <footer class="border-t border-white/10 bg-black/10 p-4 sm:p-5">
              <div
                class="rounded-[1.75rem] border border-white/10 bg-slate-900/55 p-3 shadow-inner"
              >
                <textarea
                  v-model="inputMessage"
                  rows="4"
                  class="w-full resize-none border-0 bg-transparent px-2 py-2 text-sm leading-7 text-stone-100 outline-none placeholder:text-stone-400/70"
                  placeholder="輸入你的問題，例如：幫我算 10000 * 1.05^3"
                  @keydown="handleKeydown"
                />

                <div class="mt-3 flex items-center justify-between gap-3">
                  <p class="text-xs text-stone-400">
                    Enter 送出，Shift + Enter 換行
                  </p>
                  <button
                    class="inline-flex items-center justify-center rounded-full bg-amber-300 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:bg-stone-500/60 disabled:text-stone-200"
                    :disabled="isLoading || !inputMessage.trim()"
                    @click="sendMessage"
                  >
                    {{ isLoading ? "傳送中..." : "送出訊息" }}
                  </button>
                </div>
              </div>
            </footer>
          </div>

          <aside
            class="flex max-h-[32rem] min-h-[18rem] w-full flex-col border-t border-white/10 bg-black/10 lg:max-h-none lg:min-h-0 lg:w-[21rem] lg:border-l lg:border-t-0"
          >
            <div class="border-b border-white/10 px-5 py-4">
              <div class="flex items-center justify-between">
                <p class="text-xs uppercase tracking-[0.24em] text-amber-200/60">
                  Timeline
                </p>
                <p class="text-xs text-stone-400">Planner to Worker</p>
              </div>
              <p class="mt-2 text-xs leading-6 text-stone-400">
                即時顯示 Agent 決策、工具執行與 orchestration 流程。
              </p>
            </div>
            <div class="flex-1 space-y-2 overflow-y-auto px-4 py-4">
              <article
                v-for="entry in timelineEntries"
                :key="entry.id"
                class="rounded-2xl border px-3 py-3 text-sm"
                :class="{
                  'border-white/10 bg-white/5': entry.status === 'info',
                  'border-emerald-300/20 bg-emerald-300/10': entry.status === 'success',
                  'border-rose-300/20 bg-rose-300/10': entry.status === 'error',
                }"
              >
                <p class="font-medium text-stone-100">{{ entry.title }}</p>
                <p
                  v-if="entry.detail"
                  class="mt-1 whitespace-pre-wrap text-xs leading-6 text-stone-300"
                >
                  {{ entry.detail }}
                </p>
              </article>
              <p
                v-if="!timelineEntries.length"
                class="rounded-2xl border border-dashed border-white/10 bg-white/5 px-3 py-4 text-sm leading-6 text-stone-400"
              >
                送出訊息後，這裡會像聊天室側邊活動欄一樣，持續顯示 planner、worker 與工具流程。
              </p>
            </div>
          </aside>
        </div>
      </section>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue";
import { getSessionMessages, streamChatMessage } from "../api/chat.api";
import { deleteSession, getSessions } from "../api/session.api";
import type {
  AgentStreamEvent,
  ChatMessage,
  ChatMessageRole,
  ChatSkillName,
  ChatTimelineEntry,
} from "../types/chat.types";
import type { ChatSessionSummary } from "../types/session.types";

const sessionStorageKey = "agent-chat-session-id";
const isLoading = ref(false);
const inputMessage = ref("");
const sessionId = ref<string>(localStorage.getItem(sessionStorageKey) || "");
const selectedSkill = ref<ChatSkillName>("default");
const messageListRef = ref<HTMLElement | null>(null);
const sessions = ref<ChatSessionSummary[]>([]);
const timelineEntries = ref<ChatTimelineEntry[]>([]);
const welcomeMessages: ChatMessage[] = [
  {
    id: "welcome",
    role: "assistant",
    content:
      "我是你的 Agent chat 測試畫面。你可以先試試看：幫我算 10000 * 1.05^3，或問我 0050 股價。",
  },
];
const messages = ref<ChatMessage[]>([...welcomeMessages]);

const currentSessionTitle = computed(() => {
  const activeSession = sessions.value.find(
    (session) => session.sessionId === sessionId.value,
  );
  return activeSession?.title || "Agent Chat";
});

const roleLabelMap: Record<"primary" | "planner" | "worker", string> = {
  primary: "Primary",
  planner: "Planner",
  worker: "Worker",
};

/**
 * 重設成新對話的預設畫面。
 */
const resetToWelcomeState = () => {
  messages.value = [...welcomeMessages];
};

/**
 * 將後端歷史訊息轉成目前聊天畫面需要的格式。
 *
 * @param historyMessages 後端回傳的歷史訊息。
 */
const restoreMessages = (historyMessages: ChatMessage[]) => {
  if (!historyMessages.length) {
    resetToWelcomeState();
    return;
  }

  messages.value = historyMessages.map((message, index) => ({
    id: `history-${index}-${message.createdAt || Date.now()}`,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt,
  }));
};

/**
 * 將時間字串整理成簡短顯示格式。
 *
 * @param value 原始 ISO 時間字串。
 * @returns 適合側邊欄顯示的時間文字。
 */
const formatSessionTime = (value: string): string =>
  new Date(value).toLocaleString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

/**
 * 讓訊息清單在新內容加入後自動捲到最底部。
 */
const scrollToBottom = async () => {
  await nextTick();

  if (!messageListRef.value) {
    return;
  }

  messageListRef.value.scrollTop = messageListRef.value.scrollHeight;
};

/**
 * 將新訊息追加到目前對話紀錄。
 *
 * @param role 訊息角色。
 * @param content 訊息文字。
 */
const appendMessage = async (role: ChatMessageRole, content: string) => {
  messages.value.push({
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
  });

  await scrollToBottom();
};

/**
 * 將 Agent SSE 事件轉成可讀的 Timeline 條目。
 *
 * @param event 後端串流事件。
 * @returns 可顯示的 Timeline 項目。
 */
const toTimelineEntry = (event: AgentStreamEvent): ChatTimelineEntry => {
  const id = `${event.type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  switch (event.type) {
    case "orchestration_assessed":
      return {
        id,
        type: event.type,
        title: `Gate 評估：${event.assessment.shouldOrchestrate ? "進入 multi-agent" : "維持 single agent"}`,
        detail: [
          `score: ${event.assessment.score}`,
          `strategy: ${event.assessment.strategy}`,
          `confidence: ${event.assessment.confidence}`,
          `source: ${event.assessment.source}`,
          `signals: connector=${event.assessment.signals.connectorCount}, intent=${event.assessment.signals.intentCount}, length=${event.assessment.signals.messageLength}`,
          `reasons: ${event.assessment.reasons.join(" / ")}`,
        ].join("\n"),
        status: event.assessment.shouldOrchestrate ? "success" : "info",
      };
    case "orchestration_started":
      return {
        id,
        type: event.type,
        title: `啟動 multi-agent orchestration`,
        detail: [
          `來源：${event.source}`,
          `子任務數量：${event.taskCount}`,
          `原因：${event.reason}`,
          "Tasks:",
          ...event.tasks.map(
            (task, index) =>
              `${index + 1}. [${roleLabelMap[task.role]}] ${task.title} (${task.taskId})\n${task.instruction}`,
          ),
        ].join("\n"),
        status: "info",
      };
    case "subtask_started":
      return {
        id,
        type: event.type,
        title: `${roleLabelMap[event.role]} 開始子任務：${event.title}`,
        detail: `taskId: ${event.taskId}`,
        status: "info",
      };
    case "subtask_completed":
      return {
        id,
        type: event.type,
        title: `${roleLabelMap[event.role]} 完成子任務：${event.title}`,
        detail: `taskId: ${event.taskId}\n${event.output}`,
        status: "success",
      };
    case "subtask_failed":
      return {
        id,
        type: event.type,
        title: `${roleLabelMap[event.role]} 子任務失敗：${event.title}`,
        detail: `taskId: ${event.taskId}\n${event.error}`,
        status: "error",
      };
    case "orchestration_completed":
      return {
        id,
        type: event.type,
        title: "multi-agent orchestration 完成",
        detail: `完成 ${event.completedTaskCount} / ${event.taskCount} 個子任務`,
        status: "success",
      };
    case "session_started":
      return {
        id,
        type: event.type,
        title: `Session 已綁定：${event.sessionId}`,
        detail: `role: ${roleLabelMap[event.roleName]}\nskill: ${event.skillName}\n歷史訊息數量：${event.historyMessageCount}`,
        status: "info",
      };
    case "skill_selected":
      return {
        id,
        type: event.type,
        title: `本輪採用 skill：${event.skillName}`,
        detail: `來源：${event.source}\n原因：${event.reason}`,
        status: "info",
      };
    case "decision_requested":
      return {
        id,
        type: event.type,
        title: `${roleLabelMap[event.roleName]} 第 ${event.attempt} 輪：正在向模型請求決策`,
        detail: `messageCount: ${event.messageCount}`,
        status: "info",
      };
    case "agent_decision":
      return {
        id,
        type: event.type,
        title:
          event.decision.type === "final"
            ? `${roleLabelMap[event.roleName]} 第 ${event.attempt} 輪：模型決定直接回答`
            : `${roleLabelMap[event.roleName]} 第 ${event.attempt} 輪：模型決定使用工具 ${event.decision.toolName}`,
        detail:
          event.decision.type === "final"
            ? event.decision.answer
            : JSON.stringify(event.decision.toolInput, null, 2),
        status: "info",
      };
    case "invalid_tool_decision":
      return {
        id,
        type: event.type,
        title: `${roleLabelMap[event.roleName]} 第 ${event.attempt} 輪：模型回傳了不合法的工具決策`,
        detail: `可用工具：${event.availableToolNames.join(", ")}`,
        status: "error",
      };
    case "tool_started":
      return {
        id,
        type: event.type,
        title: `${roleLabelMap[event.roleName]} 第 ${event.attempt} 輪：開始執行 ${event.toolName}`,
        detail: JSON.stringify(event.toolInput, null, 2),
        status: "info",
      };
    case "tool_completed":
      return {
        id,
        type: event.type,
        title: `${roleLabelMap[event.roleName]} 第 ${event.attempt} 輪：${event.toolName} ${event.result.ok ? "執行成功" : "執行失敗"}`,
        detail: `duration: ${event.result.meta.durationMs} ms\nattempts: ${event.result.meta.attempts}${
          event.result.error ? `\nerror: ${event.result.error.message}` : ""
        }`,
        status: event.result.ok ? "success" : "error",
      };
    case "final_answer":
      return {
        id,
        type: event.type,
        title: `${roleLabelMap[event.roleName]} 第 ${event.attempt} 輪：產生最終答案`,
        detail: event.answer,
        status: event.roleName === "primary" ? "success" : "info",
      };
    case "done":
      return {
        id,
        type: event.type,
        title: "本輪流程完成",
        detail: `sessionId: ${event.sessionId}`,
        status: "success",
      };
    case "error":
      return {
        id,
        type: event.type,
        title: "串流流程發生錯誤",
        detail: event.message,
        status: "error",
      };
  }
};

/**
 * 讀取 session 列表並更新側邊欄。
 *
 * @returns 最新 session 列表。
 */
const loadSessions = async (): Promise<ChatSessionSummary[]> => {
  const data = await getSessions();
  sessions.value = data.sessions;
  return data.sessions;
};

/**
 * 依 sessionId 載入對話歷史。
 *
 * @param nextSessionId 目標 session 識別值。
 */
const selectSession = async (nextSessionId: string) => {
  if (!nextSessionId) {
    return;
  }

  sessionId.value = nextSessionId;
  localStorage.setItem(sessionStorageKey, nextSessionId);

  try {
    const data = await getSessionMessages(nextSessionId);
    restoreMessages(data.messages);
    await scrollToBottom();
  } catch (error) {
    const message = error instanceof Error ? error.message : "發生未知錯誤。";
    await appendMessage("system", `讀取歷史訊息失敗：${message}`);
  }
};

/**
 * 建立新的空白會話。
 */
const startNewSession = () => {
  sessionId.value = "";
  localStorage.removeItem(sessionStorageKey);
  resetToWelcomeState();
};

/**
 * 刪除指定 session，若刪除的是當前 session，則自動切到下一筆或建立新對話。
 *
 * @param targetSessionId 要刪除的 session 識別值。
 */
const removeSession = async (targetSessionId: string) => {
  try {
    await deleteSession(targetSessionId);
    const nextSessions = await loadSessions();

    if (sessionId.value !== targetSessionId) {
      return;
    }

    const nextActiveSession = nextSessions[0];

    if (!nextActiveSession) {
      startNewSession();
      return;
    }

    await selectSession(nextActiveSession.sessionId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "發生未知錯誤。";
    await appendMessage("system", `刪除會話失敗：${message}`);
  }
};

/**
 * 送出使用者訊息到後端 chat API，並將回覆顯示在畫面上。
 */
const sendMessage = async () => {
  const content = inputMessage.value.trim();

  if (!content || isLoading.value) {
    return;
  }

  inputMessage.value = "";
  await appendMessage("user", content);
  timelineEntries.value = [];
  isLoading.value = true;

  try {
    let finalAnswer = "";
    let didReceiveFinalAnswer = false;

    await streamChatMessage(
      {
        sessionId: sessionId.value || undefined,
        skillName:
          selectedSkill.value === "default" ? undefined : selectedSkill.value,
        message: content,
      },
      {
        onEvent: async (event) => {
          timelineEntries.value.push(toTimelineEntry(event));

          if (event.type === "session_started") {
            sessionId.value = event.sessionId;
            localStorage.setItem(sessionStorageKey, event.sessionId);
          }

          if (event.type === "final_answer" && event.roleName === "primary") {
            finalAnswer = event.answer;
            didReceiveFinalAnswer = true;
          }
        },
      },
    );

    if (sessionId.value) {
      await loadSessions();
    }

    if (didReceiveFinalAnswer) {
      await appendMessage("assistant", finalAnswer);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "發生未知錯誤。";
    timelineEntries.value.push({
      id: `timeline-error-${Date.now()}`,
      type: "error",
      title: "串流連線失敗",
      detail: message,
      status: "error",
    });
    await appendMessage("system", `連線失敗：${message}`);
  } finally {
    isLoading.value = false;
  }
};

/**
 * 處理輸入框快捷鍵，Enter 送出、Shift+Enter 換行。
 *
 * @param event 鍵盤事件。
 */
const handleKeydown = async (event: KeyboardEvent) => {
  if (event.key !== "Enter" || event.shiftKey) {
    return;
  }

  event.preventDefault();
  await sendMessage();
};

/**
 * 頁面載入時，如果已有 sessionId，則自動讀回歷史訊息。
 */
onMounted(async () => {
  try {
    const loadedSessions = await loadSessions();
    const storedSessionId = sessionId.value;

    if (
      storedSessionId &&
      loadedSessions.some((session) => session.sessionId === storedSessionId)
    ) {
      await selectSession(storedSessionId);
      return;
    }

    if (!loadedSessions.length) {
      startNewSession();
      return;
    }

    await selectSession(loadedSessions[0].sessionId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "發生未知錯誤。";
    await appendMessage("system", `讀取會話列表失敗：${message}`);
    return;
  }
});
</script>
