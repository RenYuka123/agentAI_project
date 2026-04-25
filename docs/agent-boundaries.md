# Skill / Role / Tool 邊界文件

這份文件用來釐清目前專案中 `skill`、`role`、`tool` 三者的責任邊界，避免後續擴充時把不同層次的概念混在一起。

這份文件的目標不是追求理論完整，而是提供一套對目前 repo 實際有用的判準。

## 一句話版本

- `tool`：能做什麼
- `role`：負責做什麼
- `skill`：在什麼場景下做

如果把三者混在一起，常見結果會是：

- prompt 設計越來越混亂
- routing 很難判斷
- 新功能不知道該放在哪一層
- agent 行為難以 debug

## Tool 是什麼

Tool 是可被 agent 呼叫的能力單元。

它通常有這些特徵：

- 有明確輸入
- 有明確輸出
- 可以被重複呼叫
- 不代表某種工作分工
- 不代表某種任務場景

### 目前專案中的 Tool

- `calculator`
- `get_stock_price`
- `get_weather`
- `summarize_text`

### 什麼情況應該做成 Tool

當你遇到一個需求，若它符合下面條件，通常就適合做成 tool：

- 可以定義 input schema
- 可以獨立執行
- 執行結果可以直接回給 agent 當上下文
- 未來可能被多個 role 或多個 skill 重複使用

### 不應該做成 Tool 的情況

- 它其實是在描述 agent 身分
- 它其實是在描述流程責任
- 它其實只是一種回答語氣或場景模式

例如：

- `planner` 不應該是 tool
- `investment_analysis` 不應該是 tool

## Role 是什麼

Role 是 agent 在 workflow 中的責任分工。

它通常有這些特徵：

- 描述這個 agent 在流程裡負責哪一段工作
- 會影響 prompt 規則
- 可能影響可用工具範圍
- 不直接代表特定領域場景

### 目前專案中的 Role

- `primary`
- `planner`
- `worker`

### Role 的理解方式

- `primary`
  - 負責對外回覆使用者
  - 負責整合結果
- `planner`
  - 負責拆任務
  - 不直接做工具執行
- `worker`
  - 負責執行單一子任務
  - 可依需求使用工具

### 什麼情況應該做成 Role

當你遇到一個新概念，若它是在描述：

- 這個 agent 該做哪一段工作
- 它在 orchestration 裡的責任是什麼
- 它是否可以用工具
- 它應該輸出哪種型態

那它通常比較像 role。

### 不應該做成 Role 的情況

- 它其實是能力本身
- 它其實是某個任務領域

例如：

- `get_weather` 不應該是 role
- `weather_summary` 不應該是 role

## Skill 是什麼

Skill 是任務場景設定層。

它通常有這些特徵：

- 描述目前對話屬於哪一種任務場景
- 影響 prompt 語境
- 可能限制可用工具
- 可能影響回答風格
- 不負責描述流程中的分工

### 目前專案中的 Skill

- `investment_analysis`
- `weather_summary`

### Skill 的理解方式

同一個 `worker` role 可以在不同 skill 下工作：

- 在 `investment_analysis` 下，偏向投資語境、股價與計算工具
- 在 `weather_summary` 下，偏向天氣語境、摘要與生活提醒

這表示 skill 不是誰來做，而是「這題屬於什麼場景」。

### 什麼情況應該做成 Skill

當一個新需求同時滿足下面條件時，才值得考慮新增 skill：

- 它是穩定且可重複出現的任務場景
- 它需要不同的 prompt 規則
- 它需要不同的工具範圍
- 它需要不同的回答風格

### 不應該做成 Skill 的情況

- 只是換名字，本質上沒有不同規則
- 只是單一能力，不需要場景層
- 其實是在描述流程角色

例如：

- `planner_skill` 不建議做成 skill
- `math_skill` 要先確認是不是其實只需要 `calculator` 這個 tool

## 三者如何一起工作

目前專案中，三者合作的方式可以這樣理解：

1. 使用者輸入訊息
2. 系統先判斷 skill
3. 系統再判斷是否需要 orchestration
4. 若需要 orchestration，則由不同 role 分工
5. 各 role 在可用範圍內呼叫 tool
6. 最後由 primary 對外整理答案

也就是說：

- `skill` 決定場景
- `role` 決定分工
- `tool` 決定能力

## 目前專案中的對照表

### Tool

- `calculator`
- `get_stock_price`
- `get_weather`
- `summarize_text`

### Role

- `primary`
- `planner`
- `worker`

### Skill

- `investment_analysis`
- `weather_summary`

## 新增設計時的判斷順序

當你想加一個新概念時，先問自己下面三題：

### 1. 這是能力嗎

如果答案是：

- 有明確 input / output
- 可以被多次呼叫

那先考慮做成 tool。

### 2. 這是分工嗎

如果答案是：

- 它在描述某個 agent 負責哪段流程

那先考慮做成 role。

### 3. 這是場景嗎

如果答案是：

- 它在描述某種穩定任務領域
- 會改變 prompt、tool scope、回答風格

那再考慮做成 skill。

## 建議原則

### 原則 1

優先重用既有 tool，不要為了場景名稱重複造能力。

### 原則 2

優先重用既有 role，不要把流程責任誤做成 skill。

### 原則 3

只有在場景邊界夠清楚時，才新增 skill。

### 原則 4

如果一個新需求很難分類，先不要急著新增抽象，先確認是不是現有層已足夠。

## 目前階段的建議

以目前這個 repo 來看，下一步不建議急著增加很多 skill。

目前更值得優先穩定的是：

- orchestration 判斷邏輯
- planner 拆任務品質
- worker 結果如何傳遞
- role 邊界是否清楚

等這些穩下來之後，再擴 skill 會比較健康。
