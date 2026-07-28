// 核心数据模型与类型定义

/** 单位类型 */
export type UnitType = 'warrior' | 'archer' | 'mage' | 'tank';

/** 阵营 */
export type Team = 'player' | 'enemy';

/** 单位 3D 形状 */
export type UnitShape = 'box' | 'cone' | 'sphere' | 'cylinder';

/** 单位基础属性 */
export interface UnitStats {
  /** 生命值 */
  hp: number;
  /** 攻击力 */
  attack: number;
  /** 攻击速度（次/秒） */
  attackSpeed: number;
  /** 移动速度（单位/秒） */
  moveSpeed: number;
  /** 攻击范围（格子距离） */
  range: number;
}

/** 单位定义（数据表用，包含 3D 表示信息） */
export interface UnitDefinition extends UnitStats {
  type: UnitType;
  /** 中文名 */
  name: string;
  /** 十六进制颜色，如 '#4a90d9' */
  color: string;
  /** 3D 几何形状 */
  shape: UnitShape;
}

/** 场上的单位实例 */
export interface Unit {
  id: string;
  type: UnitType;
  team: Team;
  stats: UnitStats;
  /** 当前生命值 */
  currentHp: number;
  /** 列坐标，-1 表示备战区 */
  col: number;
  /** 行坐标，-1 表示备战区 */
  row: number;
}

/** 棋盘格子 */
export interface Tile {
  col: number;
  row: number;
  /** 该格子归属：玩家区 / 敌方区 / 备战区 */
  team: Team | 'bench';
}

/** 商店槽位 */
export interface ShopSlot {
  index: number;
  unitType: UnitType | null;
  sold: boolean;
}

/** 海克斯科技强化 ID */
export enum AugmentId {
  AtkBoost = 'atkBoost',
  HpBoost = 'hpBoost',
  AtkSpeedBoost = 'atkSpeedBoost',
  GoldIncome = 'goldIncome',
  MoveBoost = 'moveBoost',
  RangeBoost = 'rangeBoost',
}

/** 海克斯强化种类 */
export type AugmentKind = 'stat' | 'economy';

/** 海克斯科技强化描述 */
export interface HexAugment {
  id: AugmentId;
  name: string;
  description: string;
  kind: AugmentKind;
}

/** 游戏阶段 */
export type GamePhase = 'prep' | 'battle' | 'settle' | 'augment' | 'gameover';

/** 棋盘维度常量 */
export const BOARD_COLS = 6;
export const BOARD_ROWS = 4;
export const BENCH_SIZE = 9;
export const SHOP_SIZE = 5;

/** 玩家/敌方棋盘结构：board[col][row]，6 列 × 4 行 */
export type Board = (Unit | null)[][];

/** 完整游戏状态 */
export interface GameState {
  /** 当前回合数 */
  round: number;
  /** 当前阶段 */
  phase: GamePhase;
  /** 玩家生命值 */
  playerHp: number;
  /** 玩家金币 */
  gold: number;
  /** 商店（长度 SHOP_SIZE） */
  shop: ShopSlot[];
  /** 备战区（长度 BENCH_SIZE） */
  bench: (Unit | null)[];
  /** 玩家棋盘（6 列 × 4 行） */
  board: Board;
  /** 敌方棋盘（同 board 结构） */
  enemyBoard: Board;
  /** 已获得的强化 */
  augments: AugmentId[];
  /** 待选择的强化（3 选 1） */
  pendingAugmentChoices: HexAugment[];
}
