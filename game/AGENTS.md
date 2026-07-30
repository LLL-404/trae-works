# AGENTS.md

本项目是一个 3D PVE 自走棋肉鸽 MVP，技术栈为 Three.js + TypeScript + Vite。

## 开发命令

```bash
npm install        # 安装依赖
npm run dev        # 启动开发服务器 http://localhost:5173
npm run build      # 类型检查 + 生产构建
npm run preview    # 预览生产构建
npm run typecheck  # 仅类型检查
```

## 项目结构

```
src/
├── data/          # 数据表（单位定义、强化定义）
├── game/          # 游戏系统逻辑（战斗、经济、商店、强化、rogue 进度等）
├── ui/            # UI 层（HTML/CSS/JS 实现）
├── main.ts        # 主入口，串联场景、状态、UI、战斗系统
├── types.ts       # 核心类型定义（统一在此文件定义）
├── style.css      # UI 样式
└── vite-env.d.ts  # Vite 类型引用
```

## 核心规则 — 变更即上传

**每次完成文件变更（新增、删除、修改文件或代码）后，必须执行以下步骤：**

1. `git add` 暂存变更的文件（按文件名精确添加，禁止 `git add -A`）
2. 使用 Conventional Commit 格式创建 commit：
   - `feat:` 新功能
   - `fix:` 修复 bug
   - `refactor:` 重构
   - `docs:` 文档变更
   - `chore:` 构建/配置/杂项
3. `git push` 到当前工作分支
4. 使用 `gh pr create` 创建到 `main` 的 Pull Request（如已存在则跳过）

**禁止直接 push 到 `main` 分支。**

commit message 使用英文或中文均可，但须描述变更目的。

## 代码规范

- TypeScript strict 模式已启用，禁止使用 `any`
- 新增类型须在 `src/types.ts` 统一定义
- 游戏系统类放在 `src/game/`，数据表放在 `src/data/`，UI 放在 `src/ui/`

## 验证要求

- 变更后运行 `npm run typecheck` 确保无类型错误
- 变更后运行 `npm run build` 确保构建通过
