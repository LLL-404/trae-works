import { AugmentId } from '../types';
import type { HexAugment } from '../types';

/** 强化效果数值 */
export interface AugmentEffect {
  /** 攻击力乘数（1.2 = +20%） */
  attackMult?: number;
  /** 生命值乘数（1.25 = +25%） */
  hpMult?: number;
  /** 攻击速度乘数（1.25 = +25%） */
  attackSpeedMult?: number;
  /** 移动速度乘数（1.3 = +30%） */
  moveSpeedMult?: number;
  /** 攻击范围加成（格子距离） */
  rangeBonus?: number;
  /** 每回合金币加成 */
  goldIncomeBonus?: number;
}

/** 强化定义：描述 + 具体效果数值 */
export interface AugmentDefinition extends HexAugment {
  effect: AugmentEffect;
}

/**
 * 海克斯科技强化库（至少 6 种）。
 */
export const AUGMENT_DEFINITIONS: Record<AugmentId, AugmentDefinition> = {
  [AugmentId.AtkBoost]: {
    id: AugmentId.AtkBoost,
    name: '锋刃',
    description: '所有单位攻击力 +20%',
    kind: 'stat',
    effect: { attackMult: 1.2 },
  },
  [AugmentId.HpBoost]: {
    id: AugmentId.HpBoost,
    name: '韧性',
    description: '所有单位生命值 +25%',
    kind: 'stat',
    effect: { hpMult: 1.25 },
  },
  [AugmentId.AtkSpeedBoost]: {
    id: AugmentId.AtkSpeedBoost,
    name: '急速',
    description: '所有单位攻击速度 +25%',
    kind: 'stat',
    effect: { attackSpeedMult: 1.25 },
  },
  [AugmentId.GoldIncome]: {
    id: AugmentId.GoldIncome,
    name: '财源',
    description: '每回合额外获得 +2 金币',
    kind: 'economy',
    effect: { goldIncomeBonus: 2 },
  },
  [AugmentId.MoveBoost]: {
    id: AugmentId.MoveBoost,
    name: '疾风',
    description: '所有单位移动速度 +30%',
    kind: 'stat',
    effect: { moveSpeedMult: 1.3 },
  },
  [AugmentId.RangeBoost]: {
    id: AugmentId.RangeBoost,
    name: '远视',
    description: '所有单位攻击范围 +1 格',
    kind: 'stat',
    effect: { rangeBonus: 1 },
  },
};

/** 所有强化 ID 列表（便于随机抽取） */
export const AUGMENT_IDS: AugmentId[] = Object.values(AugmentId);
