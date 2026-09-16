# Tasks

- [x] Task 1: 初始化项目骨架
  - [ ] SubTask 1.1: 在 `/workspace` 下用 Vite 创建 TypeScript 模板（覆盖现有 README/.gitignore 时保留必要内容）
  - [ ] SubTask 1.2: 安装依赖 `three` 与 `@types/three`
  - [ ] SubTask 1.3: 配置 `package.json` 脚本（dev/build/preview），验证 `npm run dev` 可启动
  - [ ] SubTask 1.4: 创建入口 `index.html` 与 `src/main.ts`，渲染一个含相机/灯光/地面的基础 3D 场景

- [x] Task 2: 定义核心数据模型与类型
  - [ ] SubTask 2.1: 在 `src/types.ts` 定义 `UnitType`、`Unit`、`Tile`、`ShopSlot`、`HexAugment`、`GamePhase`、`GameState` 等类型
  - [ ] SubTask 2.2: 在 `src/data/units.ts` 定义 4 种基础单位（战士/弓手/法师/坦克）的基础属性
  - [ ] SubTask 2.3: 在 `src/data/augments.ts` 定义至少 6 种海克斯科技强化

- [x] Task 3: 实现 3D 棋盘渲染
  - [ ] SubTask 3.1: 在 `src/game/BoardRenderer.ts` 创建 6×4 方格棋盘（玩家 6×2 蓝色，敌方 6×2 红色）
  - [ ] SubTask 3.2: 配置俯视斜角相机与合适灯光
  - [ ] SubTask 3.3: 实现格子坐标到世界坐标的转换工具

- [x] Task 4: 实现单位 3D 表示与场景管理
  - [ ] SubTask 4.1: 在 `src/game/UnitRenderer.ts` 为 4 种单位生成不同颜色与形状的几何体
  - [ ] SubTask 4.2: 实现单位在棋盘格子上放置/移除/移动的 3D 表现
  - [ ] SubTask 4.3: 实现单位血条与选中高亮

- [x] Task 5: 实现游戏状态管理
  - [ ] SubTask 5.1: 在 `src/game/GameState.ts` 维护 HP/金币/回合/阶段/单位/商店/强化等全局状态
  - [ ] SubTask 5.2: 实现阶段切换（准备→战斗→结算→强化→下一回合）的状态机
  - [ ] SubTask 5.3: 提供状态变更事件回调机制供 UI 和 3D 层订阅

- [x] Task 6: 实现经济与商店逻辑
  - [ ] SubTask 6.1: 实现每回合金币发放（5 + 回合数 + 利息）
  - [ ] SubTask 6.2: 实现商店随机刷新 5 个单位的逻辑
  - [ ] SubTask 6.3: 实现购买（扣金币、进备战区）与刷新（扣 2 金币）操作

- [x] Task 7: 实现单位放置与备战区交互
  - [ ] SubTask 7.1: 实现点击商店购买后单位进入备战区空位
  - [ ] SubTask 7.2: 实现点击备战区单位 → 点击玩家区域空格完成放置
  - [ ] SubTask 7.3: 实现已放置单位撤回到备战区

- [x] Task 8: 实现战斗系统
  - [ ] SubTask 8.1: 在 `src/game/BattleSystem.ts` 实现单位寻敌（最近敌方）
  - [ ] SubTask 8.2: 实现单位移动逻辑（按移速向目标移动）
  - [ ] SubTask 8.3: 实现攻击逻辑（按攻速间隔造成伤害）
  - [ ] SubTask 8.4: 实现死亡移除与战斗结束判定（一方全灭或 30 秒超时）

- [x] Task 9: 实现胜负与 HP 系统
  - [ ] SubTask 9.1: 战斗结束时按存活单位数判定胜负
  - [ ] SubTask 9.2: 玩家战败按敌方存活单位数 × 2 扣 HP
  - [ ] SubTask 9.3: 玩家胜利获得奖励金币
  - [ ] SubTask 9.4: HP ≤ 0 触发游戏结束

- [x] Task 10: 实现海克斯科技系统
  - [ ] SubTask 10.1: 在偶数回合结束时生成 3 个不重复随机强化选项
  - [ ] SubTask 10.2: 实现强化选择 UI 与立即生效逻辑
  - [ ] SubTask 10.3: 将强化效果接入战斗/经济/单位属性

- [x] Task 11: 实现肉鸽循环与关卡递进
  - [ ] SubTask 11.1: 每回合生成敌方阵容（每 2 回合 +1 单位，每回合属性 +10%）
  - [ ] SubTask 11.2: 实现游戏结束界面与重新开始（重置所有状态回到第 1 回合）

- [x] Task 12: 实现基础 UI 层
  - [ ] SubTask 12.1: 在 `src/ui/` 下用 HTML/CSS 实现 HUD（金币/HP/回合）
  - [ ] SubTask 12.2: 实现商店栏、备战区、刷新/购买按钮
  - [ ] SubTask 12.3: 实现强化选择面板与游戏结束面板
  - [ ] SubTask 12.4: 实现阶段切换提示与按钮启用/禁用

- [x] Task 13: 主入口与游戏循环整合
  - [ ] SubTask 13.1: 在 `src/main.ts` 串联场景、状态、UI、战斗系统
  - [ ] SubTask 13.2: 实现 requestAnimationFrame 渲染循环与战斗 tick
  - [ ] SubTask 13.3: 端到端验证：启动 → 准备 → 战斗 → 结算 → 强化 → 下一回合 → 失败重开

# Task Dependencies
- Task 2 依赖 Task 1（需要项目骨架）
- Task 3、Task 5、Task 12 依赖 Task 1（需要骨架与类型）
- Task 4 依赖 Task 2、Task 3
- Task 6、Task 7 依赖 Task 2、Task 5
- Task 8 依赖 Task 4、Task 5
- Task 9 依赖 Task 8
- Task 10 依赖 Task 2、Task 5
- Task 11 依赖 Task 5、Task 9
- Task 12 依赖 Task 5（UI 需绑定状态）
- Task 13 依赖 Task 3、Task 4、Task 5、Task 6、Task 7、Task 8、Task 9、Task 10、Task 11、Task 12
- 可并行：Task 2 完成后，Task 3 / Task 5 / Task 10（数据部分） / Task 12（静态部分）可并行推进
