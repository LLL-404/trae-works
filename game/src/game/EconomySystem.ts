import { AugmentId } from '../types';
import type { GameState } from './GameState';

/** 单位购买价格（金币） */
export const UNIT_COST = 2;
/** 商店刷新价格（金币） */
export const REFRESH_COST = 2;

/** 收入明细 */
export interface IncomeBreakdown {
  base: number;
  interest: number;
  augmentBonus: number;
  total: number;
}

/**
 * 经济系统：计算回合收入并发放金币。
 *
 * 收入 = base(5 + round) + interest(min(5, floor(gold/10))) + augmentBonus(goldIncome => +2)
 * 通过持有 GameState 引用，以组合方式扩展状态层。
 */
export class EconomySystem {
  constructor(private readonly state: GameState) {}

  /**
   * 计算指定回合的收入明细（纯计算，不修改状态）。
   * @param round 当前回合数
   * @param currentGold 当前金币（用于利息计算）
   * @param augments 已获得的强化列表
   */
  computeIncome(
    round: number,
    currentGold: number,
    augments: AugmentId[],
  ): IncomeBreakdown {
    // 防御性下限：round/gold 非法时按 1/0 处理，避免负收入
    const safeRound = Number.isFinite(round) && round > 0 ? Math.floor(round) : 1;
    const safeGold = Number.isFinite(currentGold) && currentGold > 0 ? currentGold : 0;
    const base = 5 + safeRound;
    const interest = Math.min(5, Math.floor(safeGold / 10));
    const augmentBonus = augments.includes(AugmentId.GoldIncome) ? 2 : 0;
    const total = base + interest + augmentBonus;
    return { base, interest, augmentBonus, total };
  }

  /**
   * 计算当前回合收入并发放到 GameState，返回收入明细。
   */
  grantIncome(round: number, augments: AugmentId[]): IncomeBreakdown {
    const breakdown = this.computeIncome(round, this.state.gold, augments);
    this.state.addGold(breakdown.total);
    return breakdown;
  }
}
