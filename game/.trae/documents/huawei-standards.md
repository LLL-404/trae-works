# 华为编程开发规范 — 本项目对照标准

> 基于华为 Clean Code / ArkTS 编程规范 / 安全编码规范，结合 TypeScript 项目特点制定。

## 一、命名规范（@hw-stylistic）

### 1.1 类名、枚举名、接口名
- **规则**: UpperCamelCase（首字母大写驼峰），名词或名词短语
- **正例**: `GameState`, `UnitRenderer`, `ShopSystem`
- **反例**: `game_state`, `getData`, `unit_renderer`

### 1.2 变量名、方法名、参数名
- **规则**: lowerCamelCase（小驼峰），函数为动词短语，变量为名词短语
- **正例**: `addGold()`, `userName`, `findNearestEnemy()`
- **反例**: `AddGold()`, `user_name`, `fne()`

### 1.3 常量名、枚举值名
- **规则**: UPPER_SNAKE_CASE（全大写下划线）
- **正例**: `MAX_USER_SIZE`, `BOARD_COLS`, `AugmentId.AtkBoost`
- **反例**: `maxUserSize`, `boardCols`

### 1.4 布尔型变量名
- **规则**: 加 is/has/can/should 前缀，避免否定
- **正例**: `isActive`, `hasAugment`, `canPlace`
- **反例**: `active`, `isNoError`, `isNotFound`

### 1.5 文件命名
- **规则**: 模块文件使用 PascalCase（类文件）或 camelCase（工具文件）
- **正例**: `GameState.ts`, `units.ts`, `main.ts`

## 二、格式规范（@hw-stylistic）

### 2.1 缩进
- **规则**: 2 空格缩进，禁止 tab 字符
- 换行导致的缩进用 4 空格

### 2.2 行宽
- **规则**: 不超过 120 字符
- **例外**: 注释包含长 URL、import 路径

### 2.3 大括号
- **规则**: if/for/do/while 等语句执行体必须使用大括号，即使只有一行
- **正例**:
```typescript
if (condition) {
  doSomething();
}
```
- **反例**:
```typescript
if (condition) doSomething();
```

### 2.4 变量声明
- **规则**: 每个语句只声明一个变量
- **正例**:
```typescript
let maxCount = 10;
let isCompleted = false;
```
- **反例**:
```typescript
let maxCount = 10, isCompleted = false;
```

### 2.5 空格规范
- 关键字后保留空格: `if (`, `for (`, `while (`
- 运算符两侧各一个空格: `a + b`
- 逗号后一个空格: `[a, b, c]`

## 三、类型安全（@correctness）

### 3.1 严格类型
- **规则**: 禁止 `any`，使用具体类型或 `unknown`
- **规则**: 禁止隐式 `any` 参数
- **规则**: 禁止 `@ts-ignore` 注释

### 3.2 空值处理
- **规则**: 显式处理 `null`/`undefined`，使用可选链 `?.` 和空值合并 `??`
- **规则**: 函数参数和返回值不得为隐式 `null`

### 3.3 类型断言
- **规则**: 优先使用 `as` 语法，禁止 `<Type>` 尖括号语法（JSX 冲突）
- **规则**: 对 `as` 断言添加注释说明为何安全

## 四、安全规范（@security）

### 4.1 输入验证
- **规则**: 所有外部输入（用户操作、API 参数）必须验证
- **规则**: 数值范围检查（NaN/Infinity/负数/越界）
- **规则**: 数组索引访问前验证长度

### 4.2 资源管理
- **规则**: 创建的资源必须有对应的清理逻辑（dispose/destroy/remove）
- **规则**: 定时器使用后必须 clearTimeout/clearInterval
- **规则**: 事件监听器必须配套 removeEventListener

### 4.3 异常处理
- **规则**: try-catch 必须包含具体处理逻辑，禁止空 catch
- **规则**: 错误信息不得泄露敏感信息

## 五、架构规范

### 5.1 单一职责
- **规则**: 每个类/模块只负责一个功能领域
- **规则**: 函数不超过 50 行（建议），类不超过 300 行

### 5.2 高内聚低耦合
- **规则**: 模块间通过接口/类型通信，禁止直接访问私有成员
- **规则**: 优先使用依赖注入而非硬编码依赖

### 5.3 模块划分
- **规则**: 游戏逻辑放 `src/game/`，数据表放 `src/data/`，UI 放 `src/ui/`
- **规则**: 类型定义集中在 `src/types.ts`

## 六、注释规范

### 6.1 意图驱动
- **规则**: 注释解释"为什么"（why），而非"是什么"（what）
- **规则**: 公共 API 必须有 JSDoc 注释（@param/@returns）
- **规则**: 复杂算法/边界条件必须有注释

### 6.2 禁止项
- **规则**: 禁止注释掉的代码块（用 git 管理历史）
- **规则**: 禁止无意义注释（如 `// 设置 name` 对应 `name = value`）

## 七、代码审查标准

### 7.1 审查检查点
- 逻辑正确性：边界条件、异常路径、并发安全
- 性能影响：不必要的对象创建、循环中的重复计算
- 测试覆盖：核心路径 ≥ 80%，边界条件有测试
- 安全合规：输入验证、资源释放、敏感信息保护

### 7.2 提交规范
- Conventional Commits 格式
- 每次提交关联需求/任务编号
- 提交前通过 typecheck + 单元测试 + E2E 测试

## 八、测试标准

### 8.1 覆盖率要求
- 业务逻辑层 ≥ 80%
- 数据层 100%
- UI 层由 E2E 覆盖

### 8.2 测试分类
- 单元测试：每个系统类独立测试，mock 外部依赖
- 集成测试：多系统协作流程
- E2E 测试：核心用户流程
- 安全性测试：异常输入、边界条件