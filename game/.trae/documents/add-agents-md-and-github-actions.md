# 计划：添加 AGENTS.md 与 GitHub Actions 自动化

## 概述

为项目创建 `AGENTS.md` 文件，其中包含一条核心规则：**每次变更文件（增添、删减文件或代码）后，必须 commit 并 push 到当前工作分支，随后自动创建到 `main` 的 Pull Request**。同时新增 GitHub Actions 工作流，在 push 时自动运行类型检查与构建，并为非 main 分支自动创建/更新 PR。

## 当前状态分析

- **Git 远程**：`https://github.com/LLL-404/game`，默认分支 `main`
- **当前分支**：`trae/agent-q7iNkk`
- **无 AGENTS.md**、无 CLAUDE.md、无 .cursorrules 等任何 AI 指导文件
- **无 .github 目录**，无 CI/CD、无 Actions workflows
- **package.json 脚本**：`dev`、`build`（tsc && vite build）、`preview`、`typecheck`（tsc --noEmit）
- **无测试框架**、无 lint 工具
- **.gitignore** 为标准 Vite 模板，已忽略 node_modules、dist、.vite 等

## 拟定变更

### 1. 新建 `/workspace/AGENTS.md`

**目的**：为 AI coding agent 提供项目指导与强制规则。

**内容结构**：
- **项目简介**：3D PVE 自走棋肉鸽 MVP，技术栈 Three.js + TypeScript + Vite
- **开发命令**：`npm install`、`npm run dev`、`npm run build`、`npm run typecheck`
- **项目结构**：简述 `src/data`、`src/game`、`src/ui` 模块划分
- **核心规则 — 变更即上传**：
  - 每次完成文件变更（新增、删除、修改文件或代码）后，**必须**执行以下步骤：
    1. `git add` 暂存变更的文件（按文件名精确添加，禁止 `git add -A`）
    2. 使用 Conventional Commit 格式创建 commit（如 `feat:`、`fix:`、`refactor:`、`docs:`、`chore:`）
    3. `git push` 到当前工作分支
    4. 使用 `gh pr create` 创建到 `main` 的 Pull Request（如已存在则跳过）
  - 禁止直接 push 到 `main` 分支
  - commit message 使用英文或中文均可，但须描述变更目的
- **代码规范**：
  - TypeScript strict 模式已启用，禁止使用 `any`（类型定义在 `src/types.ts`）
  - 新增类型须在 `src/types.ts` 统一定义
  - 游戏系统类放在 `src/game/`，数据表放在 `src/data/`，UI 放在 `src/ui/`
- **验证要求**：
  - 变更后运行 `npm run typecheck` 确保无类型错误
  - 变更后运行 `npm run build` 确保构建通过

### 2. 新建 `/workspace/.github/workflows/ci.yml`

**目的**：在每次 push 时自动运行类型检查与构建，确保代码质量。

**触发条件**：`push` 到所有分支

**Job 步骤**：
1. `actions/checkout@v4`
2. `actions/setup-node@v4`（Node 20，启用 cache: npm）
3. `npm ci`
4. `npm run typecheck`
5. `npm run build`

### 3. 新建 `/workspace/.github/workflows/auto-pr.yml`

**目的**：push 到非 main 分支时，自动创建/更新到 main 的 Pull Request。

**触发条件**：`push` 到非 main 分支（`branches-ignore: [main]`）

**Job 步骤**：
1. `actions/checkout@v4`
2. 使用 `repo-sync/pull@v2` Action 或 `gh pr create` 命令创建 PR
   - 使用 `gh` CLI 方案（更可控）：
     - `gh pr create --base main --head ${{ github.ref_name }} --title "Merge ${{ github.ref_name }} into main" --body "自动创建的 PR"` 
     - 若 PR 已存在则 `gh pr edit` 更新，不报错
   - 需设置 `env: GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}`
3. PR 创建失败（如已存在）时不中断 workflow（`continue-on-error: true`）

## 假设与决策

1. **GitHub Token**：使用 Actions 默认提供的 `GITHUB_TOKEN`，无需额外配置 secret。该 token 有权限创建 PR。
2. **Node 版本**：选用 Node 20 LTS（与 Vite 5 兼容）。
3. **npm ci**：依赖 `package-lock.json`（已存在），确保 CI 安装确定性。
4. **不添加测试**：项目当前无测试框架，CI 仅运行 typecheck + build。
5. **不添加 lint**：项目无 eslint/prettier 配置，不在本次范围引入。
6. **AGENTS.md 语言**：使用中文（与项目 README 一致）。
7. **auto-pr 使用 gh CLI**：比第三方 Action 更透明，且 `GITHUB_TOKEN` 原生支持。

## 验证步骤

1. **AGENTS.md 验证**：
   - 确认文件存在于 `/workspace/AGENTS.md`
   - 确认包含"变更即上传"规则，且步骤清晰可执行
2. **CI workflow 验证**：
   - 确认 `.github/workflows/ci.yml` 语法正确
   - push 后在 GitHub Actions 页面确认 typecheck + build 通过
3. **Auto-PR workflow 验证**：
   - 确认 `.github/workflows/auto-pr.yml` 语法正确
   - push 到非 main 分支后，确认自动创建了到 main 的 PR
4. **端到端验证**：
   - 对项目做一个小改动（如修改 README），按 AGENTS.md 规则 commit + push
   - 确认 CI 触发并通过
   - 确认 PR 自动创建
