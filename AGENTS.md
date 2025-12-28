# Avalon (王者圓桌) — Agents Guide

本文件面向：
- 维护/二开本项目的开发者
- 需要在 Azure App Service (Linux, Node 20) 上部署并稳定运行 Socket.IO 联机游戏的人

> 项目核心：这是一个 **前端 React + 后端 Express + Socket.IO** 的多人联机 Avalon/Resistance 风格游戏。
> 服务端维护房间与对局的权威状态机，客户端只负责渲染与上报玩家操作。

---

## 1. 快速概览

- 前端：React + Vite + TypeScript
- 后端：Node.js (ESM) + Express + Socket.IO
- 运行方式：同一个 Node 进程同时
  - 通过 Express 托管 `dist/` 静态文件（生产）
  - 通过 Socket.IO 提供实时房间与对局同步

关键能力（来自本次 session 的实现/修复）：
- 真联机（无假人）：创建/加入房间、实时玩家列表、房主开局
- 服务端权威状态机：发牌、选队、投票、任务执行、结算、回合推进
- 客户端容错：支持主动拉取 `game_state`，避免错过首包导致黑屏
- 昵称可改：Home/Lobby 改名同步到服务端
- 10 人上限：房间最大 10 人，开局最低 5 人
- 移动端适配：使用 `100dvh` / safe-area padding，修复小屏按钮不可见

---

## 2. 目录结构

- `server.js`
  - Express + Socket.IO 服务端入口
  - 房间管理（内存 Map）与对局状态机
  - 生产环境托管 `dist/`
- `views/`
  - `HomeView.tsx`：输入昵称、进入流程
  - `LobbyView.tsx`：房间信息、玩家列表、改名、复制房间号/邀请链接、房主开局
  - `GameView.tsx`：对局 UI（订阅 `game_state` 并 emit 操作）
  - `RulesView.tsx` / `ProfileView.tsx`
- `services/socket.ts`
  - Socket.IO client 单例与类型定义（NetRoomState / NetGameState 等）
- `constants.ts`
  - Avatar、任务配置常量（部分用于前端展示）

---

## 3. 本地开发

### 3.1 安装

```bash
npm install
```

### 3.2 推荐启动方式（前后端一起）

```bash
npm run dev:full
```

说明：
- 前端 Vite 默认 `http://localhost:5173`
- 后端 Socket.IO/Express 默认 `http://localhost:3000`
- 开发时 Vite 会代理 `/socket.io` 到 3000

> 注意：只跑 `npm run dev` 时，如果后端没起，会看到 websocket proxy refused/aborted 之类日志，这是预期现象。

### 3.3 生产构建

```bash
npm run build
```

构建产物输出到 `dist/`，该目录应被 gitignore（不提交）。

---

## 4. Socket.IO 事件（核心协议）

> 命名以当前实现为准；新增/调整事件时，务必同时更新客户端订阅与服务端广播。

### 4.1 Lobby / Room

客户端 → 服务端：
- `create_room { name }`
- `join_room { roomCode, name }`（对同一 socket 做了幂等处理，避免重复 join 误报 ROOM_FULL）
- `set_name { roomCode, name }`
- `start_game { roomCode }`（房主触发）
- `leave_room { roomCode }`

服务端 → 客户端：
- `room_joined (NetRoomState)`
- `room_update (NetRoomState)`
- `room_error { code }`

### 4.2 Game

客户端 → 服务端：
- `get_game_state { roomCode }`（用于重连/补状态）
- `ack_role { roomCode }`
- `select_team_toggle { roomCode, playerId }`
- `submit_team { roomCode }`
- `vote { roomCode, vote }`
- `mission_action { roomCode, action }`
- `next_round { roomCode }`（房主触发）
- `manual_endgame { roomCode, winner }`（房主触发）

服务端 → 客户端：
- `game_state (NetGameState)`

---

## 5. 服务端状态与规则说明（重要）

### 5.1 权威状态机

服务端维护 `room.game`，并通过 `game_state` 广播。
客户端不直接“改本地状态推进游戏”，只发送操作事件。

主要 phase：
- `ROLE_REVEAL`
- `TEAM_SELECTION`
- `VOTING`
- `MISSION_EXECUTION`
- `MISSION_REVEAL`
- `ASSASSINATION`（目前用于阶段占位/流程衔接）
- `GAME_OVER`

### 5.2 玩家人数

- 房间上限：10
- 开局最低：5

### 5.3 任务配置（5–10 人）

服务端按人数生成 5 轮任务人数（questSizes），并使用 Avalon 常见规则：
- 当玩家数 >= 7 时，第 4 轮任务 `failsRequired = 2`，否则为 1。

### 5.4 角色牌组（按人数配置）

为对齐前端视野逻辑与 rule.md，本项目按人数加入以下特殊角色：
- 5–6 人：
  - 好人：`MERLIN`, `PERCIVAL`
  - 坏人：`MORGANA`, `ASSASSIN`
- 7–9 人：在上面基础上加入 `MORDRED`
- 10 人：在上面基础上加入 `OBERON`

其余根据人数用以下角色补齐：
- 好人补齐：`LOYAL_SERVANT`
- 坏人补齐：`MINION`

---

## 6. 移动端/小屏注意事项

已处理的典型坑：
- 使用 `100dvh` 代替 `100vh`，避免手机地址栏导致高度误差
- 使用 safe-area inset（`env(safe-area-inset-bottom)`）避免底部手势条遮挡
- `ROLE_REVEAL` 身份确认层改为可滚动 + 底部 sticky 按钮，避免小屏看不到“进入游戏”

---

## 7. Azure App Service（Linux Node 20，F1）部署要点

### 7.1 适配现状

- 本项目是 **内存房间/对局状态**（`rooms: Map`）。
- 在 **单实例** 情况下可以正常工作；一旦进程重启/睡眠，所有房间会丢失。

### 7.2 F1（Free）常见限制/风险

- 应用可能会空闲休眠（非 Always On），导致：
  - 房间状态丢失
  - WebSocket 断线、需要重连
- 资源配额较紧，负载稍高时体验会抖动

> 结论：F1 适合演示/测试，不适合稳定在线对局。

### 7.3 必开设置

在 Azure Portal → App Service → **Configuration / General settings**：
- **WebSockets: On**

### 7.4 扩展建议（准备上线/更稳定时）

- 升级到 Basic/Standard，开启：
  - **Always On**（避免休眠）
- 若将来要多实例扩容：
  - Socket.IO 需要 **sticky session**（ARR Affinity）或引入 **Redis adapter**
  - 否则不同请求落到不同实例会导致房间/对局不同步

---

## 8. 贡献/修改指南（给 Agent/维护者）

- 任何对“游戏流程/规则”的改动：
  - 以 `server.js` 为准（服务端权威）
  - 前端只做显示与 emit
- 任何新增事件：
  - 同步更新 `services/socket.ts` 类型
  - 同步更新相关 View 的订阅/emit
- 生产问题排查优先级：
  1) 是否连上 Socket.IO（WebSockets 是否开启/是否被代理拦截）
  2) 是否误触发重复 join（现在服务端已做幂等）
  3) 是否错过 `game_state`（可用 `get_game_state` 拉取）

---

## 9. 常用命令

- 安装：`npm install`
- 开发（前后端一起）：`npm run dev:full`
- 构建：`npm run build`

---

## 10. Known Limitations

- 房间与对局状态为内存存储：进程重启即丢失
- 未做账号/鉴权：socket.id 即玩家身份
- 断线重连会尽力恢复（通过 `get_game_state`），但跨重启无法恢复
