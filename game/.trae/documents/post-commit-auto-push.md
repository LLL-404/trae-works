# 计划：post-commit hook 实现本地领先远程时自动推送

## 概述

创建一个 git post-commit hook，在每次 `git commit` 后自动检查本地分支是否领先远程分支，如果是则自动 `git push`。同时配置分支上游跟踪关系和 fetch refspec，确保版本比较功能正常工作。hook 脚本通过 `core.hooksPath` 指向项目内可版本控制的目录，使所有 clone 用户共享同一套 hooks。

## 当前状态分析

- **当前分支**：`trae/agent-q7iNkk`，领先远程 3 个 commit
- **上游跟踪缺失**：`.git/config` 中无 `[branch "trae/agent-q7iNkk"]` 段，`git push` 需手动指定 `-u`
- **fetch refspec 限定**：仅 `+refs/heads/main:refs/remotes/origin/main`，只拉取 main 分支，无法跟踪其他远程分支
- **无 git hooks**：`.git/hooks/` 仅有 `.sample` 示例文件，无生效的 hook
- **无 husky**：项目未使用 husky，无 `.husky` 目录
- **已有 CI**：`.github/workflows/ci.yml`（push 后触发 typecheck + build）和 `auto-pr.yml`（非 main 分支 push 后自动创建 PR）
- **远程仓库**：`https://github.com/LLL-404/game`，默认分支 `main`

## 拟定变更

### 1. 新建 `/workspace/scripts/hooks/post-commit`

**目的**：可版本控制的 post-commit hook 脚本，commit 后自动检测并推送。

**脚本逻辑**：
1. 获取当前分支名（`git rev-parse --abbrev-ref HEAD`）
2. 如果是 `main` 分支，跳过（禁止直接 push 到 main，与 AGENTS.md 规则一致）
3. 检查是否有上游跟踪分支（`git rev-parse --abbrev-ref --symbolic-full-name @{u}`）
   - 无上游：执行 `git push -u origin <branch>` 设置跟踪并推送
   - 有上游：继续版本比较
4. fetch 远程分支最新状态（`git fetch origin <branch>`）
5. 比较本地与远程：`git rev-list --count <upstream>..HEAD`
   - count > 0（本地领先）：执行 `git push`
   - count = 0（已同步）：输出提示，不操作
   - 本地落后远程：输出警告，不推送（需手动处理冲突）
6. push 失败时输出错误信息但不中断（commit 已完成，无法撤回）

### 2. 修改 `/workspace/.git/config`

**目的**：配置 fetch refspec 和分支上游跟踪。

**变更内容**：
- 修改 `remote.origin.fetch` 从 `+refs/heads/main:refs/remotes/origin/main` 改为 `+refs/heads/*:refs/remotes/origin/*`（拉取所有远程分支）
- 添加 `[branch "trae/agent-q7iNkk"]` 段，设置 `remote = origin` 和 `merge = refs/heads/trae/agent-q7iNkk`

**执行方式**：通过 git 命令完成（非手动编辑文件）：
```bash
git config remote.origin.fetch "+refs/heads/*:refs/remotes/origin/*"
git branch --set-upstream-to=origin/trae/agent-q7iNkk trae/agent-q7iNkk
```

### 3. 设置 `core.hooksPath`

**目的**：让 git 使用项目内 `scripts/hooks/` 目录而非默认的 `.git/hooks/`。

**执行命令**：
```bash
git config core.hooksPath scripts/hooks
```

### 4. 更新 `/workspace/AGENTS.md`

**目的**：在 AGENTS.md 中说明 post-commit hook 自动推送机制，避免 agent 重复手动 push。

**新增内容**（在"核心规则 — 变更即上传"部分后追加说明）：
```
## 自动推送机制

项目已配置 git post-commit hook（位于 `scripts/hooks/post-commit`），通过 `core.hooksPath` 启用。

- 每次 `git commit` 后，hook 自动检测本地是否领先远程分支
- 本地领先时自动执行 `git push`（首次推送会自动设置上游跟踪）
- 禁止直接 push 到 `main` 分支（hook 会跳过 main）
- 本地落后远程时不自动推送（需手动处理冲突后重试）
- GitHub Actions 的 `auto-pr.yml` 会在 push 后自动创建到 main 的 PR

因此，完成变更后只需 `git add` + `git commit`，推送和 PR 创建由自动化处理。
```

## 假设与决策

1. **hooksPath 方案**：使用 `core.hooksPath scripts/hooks` 而非直接写入 `.git/hooks/`，确保 hook 脚本可被 git 跟踪、可被 clone 用户共享。
2. **跳过 main 分支**：post-commit hook 检测到当前分支为 main 时不推送，与 AGENTS.md "禁止直接 push 到 main" 规则一致。
3. **push 失败不阻断**：post-commit 在 commit 完成后执行，无法阻止 commit，因此 push 失败仅输出警告。
4. **fetch refspec 放宽**：从仅 main 改为所有分支，使 `git fetch` 能获取任意远程分支状态用于版本比较。
5. **脚本语言**：使用 bash shell 脚本（与 git hooks 惯例一致，无需额外依赖）。
6. **不引入 husky**：项目当前无 husky 依赖，`core.hooksPath` 是更轻量的原生方案。

## 验证步骤

1. **hook 脚本验证**：
   - 确认 `/workspace/scripts/hooks/post-commit` 文件存在且内容正确
   - 确认文件有可执行权限（`ls -la scripts/hooks/post-commit`）
2. **git config 验证**：
   - `git config core.hooksPath` 输出 `scripts/hooks`
   - `git config remote.origin.fetch` 输出 `+refs/heads/*:refs/remotes/origin/*`
   - `git branch -vv` 显示 `trae/agent-q7iNkk` 跟踪 `origin/trae/agent-q7iNkk`
3. **端到端验证**：
   - 做一个小改动（如修改 README），`git add` + `git commit`
   - 观察 post-commit hook 输出：应显示检测到本地领先并自动 push
   - `git log origin/trae/agent-q7iNkk..HEAD` 应为空（已同步）
4. **AGENTS.md 验证**：
   - 确认新增了"自动推送机制"说明段落
