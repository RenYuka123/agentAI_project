# my-app

## Start

```bash
pnpm install
pnpm run install:all
pnpm dev
```

## Structure

- `frontend/`: Vue 3 + Vite + TypeScript
- `backend/`: Express + TypeScript
- `frontend/src/views`: 頁面
- `backend/src/routes`: 路由
- `backend/src/services`: 業務邏輯

### Backend Services

- `backend/src/services/agent`: Agent 主流程與 registry
- `backend/src/services/llm`: LLM service 與 provider
- `backend/src/services/session`: 會話與歷史訊息
- `backend/src/services/skills`: Skill registry 與 skill 定義
- `backend/src/services/tools`: Tool framework 與 tool 定義

目前各 domain 都已提供 `index.ts` 作為統一出口，外層程式可優先透過 domain 入口引用。

## Docs

- [Agent 流程文件](./docs/agent-flow.md)
- [測試案例清單](./docs/testing-checklist.md)
- [開發想法紀錄](./docs/thought-log.md)
