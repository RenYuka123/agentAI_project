# 測試案例清單

這份文件整理目前專案的主要手動測試案例，方便在調整 Agent、工具、Session、Skill 或前端聊天流程後快速驗證。

## 啟動前檢查

確認以下服務都已啟動：

1. MongoDB
2. Backend
3. Frontend

### Backend

在 `backend/` 執行：

```bash
pnpm dev
```

預期看到：

```text
[info] Server running at http://localhost:3001
```

### Frontend

在 `frontend/` 執行：

```bash
pnpm dev
```

## 測試重點

目前建議至少覆蓋這幾條線：

- 單工具流程
- 多工具串接
- Session 建立與歷史延續
- 頁面重整後回填歷史訊息
- Skill 生效
- 工具錯誤與 fallback 行為

## 一、單工具測試

### 1. Calculator

輸入：

```text
幫我算 10000 * 1.05^3
```

預期：

- 模型回 `tool_call`
- 工具名稱為 `calculator`
- 最終答案為自然語言，不只回裸數字

建議觀察 log：

- `Agent loop requesting decision`
- `Agent loop executing tool`
- `Tool executor completed`
- `Agent loop completed with final answer`

### 2. Summarize Text

輸入：

```text
幫我摘要這段內容：台股今天成交量放大，電子權值股走強，市場關注聯準會後續政策訊號。
```

預期：

- 模型回 `tool_call`
- 工具名稱為 `summarize_text`
- 最終答案為摘要內容

### 3. Stock Price

輸入：

```text
0050 股價
```

預期：

- 模型回 `tool_call`
- 工具名稱為 `get_stock_price`
- 最終答案包含價格與幣別

### 4. Weather

輸入：

```text
台北今天天氣怎麼樣
```

預期：

- 模型回 `tool_call`
- 工具名稱為 `get_weather`
- 最終答案包含地點、天氣描述與基本提醒

## 二、多工具串接測試

### 1. 股價查詢後再計算

輸入：

```text
幫我查 0050 股價，再幫我算如果上漲 10% 會是多少
```

預期流程：

1. 第 1 輪：`get_stock_price`
2. 第 2 輪：`calculator`
3. 第 3 輪：`final`

預期 log 特徵：

- 會看到兩次 `Agent loop executing tool`
- 第一次工具是 `get_stock_price`
- 第二次工具是 `calculator`

### 2. 再次延伸計算

在同一段對話接著輸入：

```text
那如果上漲 20% 呢
```

預期：

- 後端能吃到歷史訊息
- 不需要重新說明 `0050`
- 若模型理解前文正常，會根據前一輪脈絡回答

## 三、Session 測試

### 1. 建立新 Session

第一次送訊息時不帶 `sessionId`。

預期：

- 後端自動建立新 session
- response 內含 `sessionId`
- frontend 將 `sessionId` 存入 localStorage

### 2. 同一 Session 延續對話

第二次送訊息時沿用同一個 `sessionId`。

預期：

- backend log 中 `sessionId` 相同
- `historyMessageCount` 大於 0

### 3. MongoDB 驗證

確認兩個 collection 有資料：

- `sessions`
- `messages`

預期：

- 同一輪訊息都綁同一個 `sessionId`
- `messages` 持續新增

## 四、頁面重整回填歷史

### 1. 重整頁面

在已有對話內容時重新整理前端頁面。

預期：

- 前端會自動打 `GET /api/agent/session/:sessionId/messages`
- 畫面會自動回填歷史對話

### 2. 重整後續聊

重整後再輸入：

```text
那如果改成 5 年呢
```

預期：

- 仍沿用同一個 `sessionId`
- 對話脈絡不中斷

## 五、Skill 測試

### 1. Default Skill

在前端 skill 選單選 `default`。

輸入：

```text
幫我查 0050 股價，再幫我算如果上漲 10% 會是多少
```

預期：

- 可正常完成多工具串接

### 2. Investment Analysis Skill

在前端 skill 選單選 `investment_analysis`。

輸入：

```text
幫我查 0050 股價，再幫我算如果上漲 10% 會是多少
```

預期：

- request 會帶 `skillName`
- backend log 中可看到 `skillName: investment_analysis`
- tool 使用範圍受 skill 約束

### 3. Weather Summary Skill

在前端 skill 選單選 `weather_summary`。

輸入：

```text
台北今天天氣怎麼樣
```

預期：

- request 會帶 `skillName`
- backend log 中可看到 `skillName: weather_summary`
- 模型優先使用 `get_weather`
- 最終答案偏向摘要與生活提醒

## 六、錯誤與邊界測試

### 1. 沒有對應工具

輸入：

```text
今天適合看極光嗎
```

預期：

- 模型直接回 `final`
- 不應強行調用不存在的工具

### 2. Calculator 非法輸入

輸入：

```text
幫我算 (((
```

預期：

- `calculator` 失敗
- 工具結果中會有標準化錯誤資訊

### 3. Stock Price 缺資料

輸入不存在或無法查詢的代號，例如：

```text
ZZZZ 股價
```

預期：

- `get_stock_price` 回傳 `available: false`
- 最終答案表達目前無法取得資料

## 七、工具層驗證

目前工具框架已支援：

- 統一輸入驗證
- 標準化結果格式
- timeout
- retry
- health check 介面

手動驗證時可特別觀察 log：

- `Tool executor started`
- `Tool executor attempt failed`
- `Tool executor completed`
- `Tool executor failed`

## 驗收標準

若以下條件都成立，可視為目前版本測試通過：

- 單工具流程可正常運作
- 多工具串接可正常運作
- Session 會自動建立並延續
- 頁面重整後可回填歷史訊息
- Skill 可正確影響 Agent 行為
- Tool executor 的 timeout / retry / 錯誤標準化可正常工作

## 建議測試順序

建議實際測試時依序跑：

1. `幫我算 10000 * 1.05^3`
2. `0050 股價`
3. `台北今天天氣怎麼樣`
4. `幫我查 0050 股價，再幫我算如果上漲 10% 會是多少`
5. `那如果上漲 20% 呢`
6. 重整頁面
7. `那如果改成 5 年呢`
8. 切換 `investment_analysis` 再測一次多工具案例
9. 切換 `weather_summary` 再測一次天氣案例
