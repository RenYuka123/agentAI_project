# 開發想法紀錄

這份文件用來記錄每次開發時的想法、決策、疑問與下一步，避免思路散掉，也方便回頭整理脈絡。

## 使用方式

- 每次有新想法，就新增一段紀錄
- 盡量用簡短句子描述
- 如果有做出決策，順手寫下原因
- 如果還沒決定，可以放在「待確認事項」

---

## 2026-04-17

### 主題

Agent 後端與前端聊天流程第一版

### 當下想法

- 先把專案核心做成可擴展的 Agent backend
- 讓模型負責判斷要不要用工具
- 工具先從 `calculator`、`summarize_text`、`get_stock_price` 開始
- 前端先以聊天畫面為入口，不急著做太多頁面

### 已做決策

- 後端採用分層：
  - `routes`
  - `controllers`
  - `services/agent`
  - `services/llm`
  - `services/tools`
- LLM 設定改成通用 `LLM_*`
- 目前透過 OpenAI-compatible 方式串 Groq
- 股價工具先使用 TWSE `STOCK_DAY`
- 數學工具改用 `math.js`
- 會話管理採 MongoDB，拆成：
  - `sessions`
  - `messages`
- Skill 採輕量做法：
  - `skill registry`
  - `skill prompt`
  - `allowedTools`

### 原因

- 分層後比較容易替換模型與工具
- `LLM_*` 命名比 `OPENAI_*` 更不會綁死供應商
- `math.js` 比直接執行字串運算安全
- `sessions/messages` 分開存比把全部訊息塞進單一 document 更穩
- Skill 先做成任務場景設定層，比直接設計複雜 workflow 更穩

### 前端方向

- 使用 Tailwind 建立聊天畫面
- `/` 直接導向 `/chat`
- API 呼叫抽到 `src/api/`
- 型別放在 `src/types/`
- 未來如果互動變複雜，再抽 `useChat.ts`

### 待確認事項

- 是否要補 `GET /api/agent/session/:sessionId/messages`
- 是否要讓前端重整後自動回填歷史訊息
- 是否要新增 `weather` 工具或其他即時資料工具
- 是否要把 LLM provider 檔名改成更中立，例如 `openai-compatible.provider.ts`
- 是否要把前端 skill 選擇做成可擴充的設定來源，而不是先寫死在畫面中

### 下一步候選

1. 前端讀取歷史訊息
2. 後端提供歷史訊息查詢 API
3. 優化最終回答品質
4. 補更多文件
5. 補更多 skill

---

## 2026-04-25

### 主題

Agent 從單一 loop 演進到 multi-agent v1 / v1.1

### 當下想法

- 目前專案已經有 `agent`、`skills`、`tools` 分層，適合往 orchestration 往上長
- 不想一開始就做成 agent 彼此自由對話，先做 `orchestrator -> planner -> worker -> primary`
- multi-agent 先以「可控、可 debug」為優先，不追求一開始就平行執行
- `skill`、`role`、`tool` 三者需要先切清楚，不然後面會越加越亂

### 已做決策

- 保留原本單 agent 流程作為 fallback
- 新增 orchestration 層，讓 `agentService` 可以判斷是否切到 multi-agent
- 先用 `shouldUseOrchestration()` 做 rule-based gate
- 多 agent 第一版採序列執行，不做平行
- `planner` 不使用工具，`worker` 負責執行子任務，`primary` 負責最後整合
- planner 與 synthesizer 都先接成 role-aware agent，並保留 fallback
- timeline 前端改成右側活動欄，方便觀察 planner / worker / primary 流程
- 補一份 `skill / role / tool` 邊界文件，作為後續新增功能時的判準

### 原因

- 先保留單 agent 路徑，能降低改動風險
- rule-based orchestration gate 比較穩定，也比較好 debug
- 序列執行可以讓前一個 worker 的結果直接成為下一個 worker 的上下文
- role-aware flow 比較能練到 multi-agent 真正的分工，而不只是多 call 幾次模型
- timeline 若能看出 role 與 subtask，會比只看最終答案更容易理解系統行為
- 邊界文件可以避免把場景、能力、分工混在一起

### 目前理解

- `skill` 決定場景
- `role` 決定分工
- `tool` 決定能力
- `auto` 只代表 skill 不由前端手動指定，不代表一定是單 agent
- 是否進 multi-agent 目前由 `shouldUseOrchestration()` 判斷
- 目前的 multi-agent 比較像 pipeline，不是 parallel workers

### 待確認事項

- orchestration gate 是否要升級成 hybrid router，而不只是 rule-based
- planner 之後是否要輸出 task dependency，支援部分平行執行
- worker 結果之後要不要改成結構化 artifact，而不只是文字摘要
- skill 選單未來是否只保留給開發 / 測試模式
- timeline 是否要顯示 planner 拆出的原始 task instruction

### 下一步候選

1. 討論 orchestration gate 的升級策略
2. 討論 task dependency 與部分平行執行設計
3. 設計 worker artifact / shared context 格式
4. 進一步整理 `agent.loop.ts` 的核心流程文件
5. 依 `agent-boundaries.md` 檢查未來新功能該放在哪一層

---

## 2026-04-26

### 主題

Orchestration gate v1.5 / v2、task dependency MVP 與目前架構整理

### 當下想法

- orchestration gate 不能只看「像不像多步驟」，也要看 task 之間是否值得拆
- planner 已經能拆 task 了，下一步至少要讓 task 之間有 `dependsOn`
- 不想一口氣做成完整 DAG engine，先把 dependency-aware sequential orchestration 做穩
- frontend timeline 已經是很重要的觀測介面，文件也需要同步更新，不然之後會失真

### 已做決策

- orchestration gate 採 hybrid 方式：
  - 高低分案例直接用 rule-based assessment
  - 模糊區交給 LLM router
- gate signals 新增 dependency-aware heuristic：
  - `dependencyCueCount`
  - `parallelCueCount`
  - `estimatedTaskCount`
  - `estimatedDependencyDepth`
  - `isDependencyChainLikely`
- `PlannedTask` 新增 `dependsOn`
- orchestrator 先支援：
  - dependency 驗證
  - 拓樸排序
  - 只注入依賴結果
  - 前置失敗時 block 後續 task
- 若 planner 回了壞掉或循環 dependency，流程自動降級成原本的線性順序
- 目前不先做：
  - parallel execution
  - artifact / shared state
  - 完整 workflow engine

### 原因

- 直接把 planner / orchestrator / gate 一次做太重，會讓系統難 debug
- `dependsOn` 已經足夠表達目前最需要的任務順序
- gate 若能分辨 dependency chain 與較鬆耦合的多任務，決策會比只看 connector 更準
- 先保留文字型 worker output，能降低改動成本，讓我們先把流程控制做好
- timeline 與文件同步更新，才能支撐後續架構討論

### 目前理解

- 現在系統可以分成 4 層：
  - Agent 基礎執行層
  - Session / API 應用層
  - Orchestration 協調層
  - Frontend 可觀測層
- orchestration 目前仍偏可控 pipeline，不是完整 workflow engine
- `skill` 是場景、`role` 是分工、`tool` 是能力、`orchestration` 是流程編排
- `dependsOn` 已經進入 execution model，也開始影響 gate scoring

### 待確認事項

- gate 是否要在未來更正式地吃 planner 產出的 task model，而不是只用 heuristic
- worker 之間的中間結果是否要升級成 artifact / structured context
- synthesizer 是否要更明確引用 dependency outputs，而不只是吃 taskResults 文字
- 未來是否要支援部分平行執行，而不只是 dependency-aware sequential

### 下一步候選

1. 校正 gate scoring 對實際 prompt 的命中率
2. 討論 synthesizer 如何更明確利用 dependency outputs
3. 設計 worker artifact / shared context 的最小版本
4. 討論 orchestration 何時從 pipeline 升級成 workflow engine

---

## 2026-04-26

### 主題

Backend review 後的可靠性補強、語意收斂與自動化測試基線

### 當下想法

- 第一輪 code review 抓到的問題，多數不是架構方向錯，而是 request lifecycle control 還不夠硬
- 若不把 cancellation、planner contract、session semantics 補齊，後面再談 orchestration 品質會一直被基礎問題干擾
- 今天做完修復後，文件也必須同步，不然下次只看 docs 會跟不上目前真實狀態

### 已做決策

- controller 端新增 request-scoped abort，並把 `AbortSignal` 傳到：
  - `agent.service`
  - `agent.loop`
  - `orchestrator`
  - `result-synthesizer`
  - `llm.service / provider`
  - `tool executor / fetch 型工具`
- planner role prompt 正式納入 `dependsOn`，不再讓 system prompt 與 user prompt schema 打架
- invalid dependency plan 不再靜默清掉 dependency，而是改建 fallback task plan
- `ensureSession` 改成 `upsert` 風格，避免同 session 併發建立 race
- 讀取 / 刪除不存在 session 時，API 改回 `404`
- skill carry-over 不再因 `calculator` 歷史單獨誤判成 `investment_analysis`
- single-player draw fallback 改成 deterministic heuristic
- draw multiplayer room binding 改掛在 `socket.data.activeRoomId`
- 補一套 backend smoke tests，並以 `tsc -> node` 的自訂 test runner 執行

### 原因

- SSE client disconnect 後若後端還繼續跑，會浪費 tokens、留下髒狀態，也讓 debug 很混亂
- planner schema 若不一致，`dependsOn` 再怎麼設計都很難穩定產出
- invalid dependency 不應被當成「沒有 dependency」，那會悄悄改變執行語意
- session 不存在與空訊息是兩種不同狀態，API contract 應該清楚
- deterministic heuristic 比 `Math.random()` 更適合測試、debug 與後續遊戲規則設計
- 先有 smoke tests，這輪修掉的問題才比較不會很快回歸

### 目前理解

- orchestration 現在已經是 dependency-aware pipeline，不只是 task list
- request cancellation 已經從 controller 接到外部依賴層
- backend 的主要高優先 review issue 已修掉一輪
- 自動化測試目前是輕量 baseline，不是完整 integration suite

### 待確認事項

- `deleteSession` 之後要不要再升級成 transaction 或更強的一致性策略
- orchestration / tool executor 是否要補更完整的 integration tests
- draw multiplayer 是否還需要更完整的 state-machine 化整理

### 下一步候選

1. 補 orchestration integration tests
2. 補更多 draw multiplayer 狀態流測試
3. 討論 tool health check / startup validation 是否要升級成真正防線

---

## 紀錄模板

```md
## YYYY-MM-DD

### 主題

一句話描述這次在想什麼

### 當下想法

- 想法 1
- 想法 2

### 已做決策

- 決策 1
- 決策 2

### 原因

- 原因 1
- 原因 2

### 待確認事項

- 問題 1
- 問題 2

### 下一步候選

1. 下一步 1
2. 下一步 2
```
