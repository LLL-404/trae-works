import { BOARD_COLS } from '../types';
import type { Unit, UnitStats } from '../types';
import type { GameState } from './GameState';
import { UNIT_DEFINITIONS, UNIT_TYPES } from '../data/units';

/** 敌方单位数量上限 */
const MAX_ENEMY_COUNT = 12;
/** 敌方区域行范围：行 2-3 */
const ENEMY_ROW_START = 2;
const ENEMY_ROW_END = 3;

/**
 * 肉鸽循环与关卡递进：负责敌方阵容生成与回合推进。
 *
 * 随回合数提升，敌方数量与属性同步增长：
 *  - 数量：基础 3，每 2 回合 +1，上限 12
 *  - 属性：每回合 +10%（hp / attack 乘倍率，其余不变）
 *
 * 通过持有 GameState 引用，以组合方式扩展状态层。
 * generateEnemyLineup 仅生成 Unit 数组返回，不直接写入 GameState
 *（写入由调用者负责，避免与状态层职责冲突）。
 */
export class RogueProgression {
  constructor(private readonly state: GameState) {}

  /**
   * 敌方单位数量：3 + floor(round / 2)，上限 12。
   */
  getEnemyCount(round: number): number {
    return Math.min(MAX_ENEMY_COUNT, 3 + Math.floor(round / 2));
  }

  /**
   * 敌方属性倍率：每回合 +10%，即 1 + (round - 1) * 0.1。
   * round=1 时倍率为 1.0。
   */
  getEnemyStatMultiplier(round: number): number {
    return 1 + (round - 1) * 0.1;
  }

  /**
   * 生成本回合的敌方阵容。
   *
   *  - 数量与倍率由 getEnemyCount / getEnemyStatMultiplier 决定
   *  - 从 4 种 UnitType 中随机抽取 `count` 个（可重复）
   *  - 每个单位的 hp / attack 乘以倍率，attackSpeed / moveSpeed / range 保持不变
   *  - 放置在敌方区域（行 2-3、列 0-5），均匀随机分配、不重叠
   *
   * @returns 敌方 Unit 数组（col/row 已赋值，但未写入 GameState）
   */
  generateEnemyLineup(round: number): Unit[] {
    const count = this.getEnemyCount(round);
    const mult = this.getEnemyStatMultiplier(round);

    // 收集敌方区域全部格子并洗牌，取前 count 个保证不重叠且均匀随机
    const positions: Array<{ col: number; row: number }> = [];
    for (let col = 0; col < BOARD_COLS; col++) {
      for (let row = ENEMY_ROW_START; row <= ENEMY_ROW_END; row++) {
        positions.push({ col, row });
      }
    }
    for (let i = positions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [positions[i], positions[j]] = [positions[j], positions[i]];
    }

    const units: Unit[] = [];
    for (let i = 0; i < count; i++) {
      const type = UNIT_TYPES[Math.floor(Math.random() * UNIT_TYPES.length)];
      const def = UNIT_DEFINITIONS[type];
      const stats: UnitStats = {
        hp: def.hp * mult,
        attack: def.attack * mult,
        attackSpeed: def.attackSpeed,
        moveSpeed: def.moveSpeed,
        range: def.range,
      };
      const pos = positions[i];
      units.push({
        id: `enemy-${round}-${i}`,
        type,
        team: 'enemy',
        stats,
        currentHp: stats.hp,
        col: pos.col,
        row: pos.row,
      });
    }
    return units;
  }

  /** 推进到下一回合（round + 1，phase 切回 'prep'） */
  proceedToNextRound(): void {
    this.state.nextRound();
  }

  /** 开始新的一局：重置全部状态回到第 1 回合 */
  startNewRun(): void {
    this.state.reset();
  }
}
