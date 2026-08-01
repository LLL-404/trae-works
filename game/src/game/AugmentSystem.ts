import { AugmentId } from '../types';
import type { HexAugment, UnitStats } from '../types';
import type { GameState } from './GameState';
import { AUGMENT_DEFINITIONS, AUGMENT_IDS } from '../data/augments';

/**
 * 海克斯科技系统：负责强化的发放、选择与应用。
 *
 * 通过持有 GameState 引用，以组合方式扩展状态层：
 *  - offer() 随机抽取 3 个不重复强化并推入 pendingAugmentChoices
 *  - choose(id) 在待选项中确认一个，写入 state.augments
 *  - applyStatAugments() 将 stat 类强化效果累加到单位属性上
 */
export class AugmentSystem {
  constructor(private readonly state: GameState) {}

  /** 偶数回合提供强化选择 */
  shouldOffer(round: number): boolean {
    return round % 2 === 0;
  }

  /**
   * 从全部 6 种强化中随机抽取 3 个不重复的，返回 HexAugment 数组。
   * 使用 Fisher-Yates 洗牌保证均匀随机。
   */
  rollChoices(): HexAugment[] {
    const pool: HexAugment[] = AUGMENT_IDS.map((id) => {
      const def = AUGMENT_DEFINITIONS[id];
      return {
        id: def.id,
        name: def.name,
        description: def.description,
        kind: def.kind,
      };
    });
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, 3);
  }

  /**
   * 抽取 3 个强化并推入 GameState 的待选列表（phase 切换为 'augment'）。
   * @returns 本次提供的 3 个强化
   */
  offer(): HexAugment[] {
    const choices = this.rollChoices();
    this.state.showAugmentChoices(choices);
    return choices;
  }

  /**
   * 在 state.pendingAugmentChoices 中确认一个强化。
   * 命中则写入 state.augments 并清空待选列表，返回 true；否则返回 false。
   */
  choose(id: AugmentId): boolean {
    const found = this.state.pendingAugmentChoices.find((a) => a.id === id);
    if (!found) { return false; }
    // 先清空待选，再 addAugment（其内部 notify 的快照将同时反映已清空待选与新强化）
    this.state.pendingAugmentChoices = [];
    this.state.addAugment(id);
    return true;
  }

  /**
   * 将所有 stat 类强化累加应用到一个 UnitStats 上，返回新对象（不改原对象）。
   * 同一类强化重复选择时累加生效；goldIncome 属经济类，不影响 stats。
   *  - atkBoost:     attack *= 1.2
   *  - hpBoost:      hp *= 1.25
   *  - atkSpeedBoost: attackSpeed *= 1.25
   *  - moveBoost:    moveSpeed *= 1.3
   *  - rangeBoost:   range += 1
   */
  applyStatAugments(stats: UnitStats, augments: AugmentId[]): UnitStats {
    const result: UnitStats = { ...stats };
    for (const id of augments) {
      switch (id) {
        case AugmentId.ATK_BOOST:
          result.attack *= 1.2;
          break;
        case AugmentId.HP_BOOST:
          result.hp *= 1.25;
          break;
        case AugmentId.ATK_SPEED_BOOST:
          result.attackSpeed *= 1.25;
          break;
        case AugmentId.MOVE_BOOST:
          result.moveSpeed *= 1.3;
          break;
        case AugmentId.RANGE_BOOST:
          result.range += 1;
          break;
        case AugmentId.GOLD_INCOME:
          // 经济类强化：不影响 stats，由 EconomySystem 处理
          break;
      }
    }
    return result;
  }

  /** 检查 state.augments 是否已包含指定强化 */
  hasAugment(id: AugmentId): boolean {
    return this.state.augments.includes(id);
  }
}
