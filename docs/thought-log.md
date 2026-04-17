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
