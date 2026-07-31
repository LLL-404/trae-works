import { describe, it, expect, beforeEach } from 'vitest';
import { AugmentSystem } from '../../src/game/AugmentSystem';
import type { GameState } from '../../src/game/GameState';
import { AUGMENT_IDS } from '../../src/data/augments';
import { AugmentId } from '../../src/types';
import type { UnitStats } from '../../src/types';
import { createGameState } from './helpers';

describe('AugmentSystem', () => {
  let state: GameState;
  let aug: AugmentSystem;

  beforeEach(() => {
    state = createGameState();
    aug = new AugmentSystem(state);
  });

  describe('shouldOffer', () => {
    it('偶数回合返回 true', () => {
      expect(aug.shouldOffer(2)).toBe(true);
      expect(aug.shouldOffer(4)).toBe(true);
      expect(aug.shouldOffer(10)).toBe(true);
    });

    it('奇数回合返回 false', () => {
      expect(aug.shouldOffer(1)).toBe(false);
      expect(aug.shouldOffer(3)).toBe(false);
      expect(aug.shouldOffer(9)).toBe(false);
    });
  });

  describe('rollChoices', () => {
    it('返回 3 个强化', () => {
      expect(aug.rollChoices()).toHaveLength(3);
    });

    it('3 个强化互不重复', () => {
      const choices = aug.rollChoices();
      const ids = choices.map((c) => c.id);
      expect(new Set(ids).size).toBe(3);
    });

    it('所有 id 都在 AUGMENT_IDS 内', () => {
      const choices = aug.rollChoices();
      for (const c of choices) {
        expect(AUGMENT_IDS).toContain(c.id);
      }
    });
  });

  describe('offer', () => {
    it('写入 3 项到 pendingAugmentChoices 并将 phase 切换为 augment', () => {
      const choices = aug.offer();

      expect(state.pendingAugmentChoices).toHaveLength(3);
      expect(state.pendingAugmentChoices).toEqual(choices);
      expect(state.phase).toBe('augment');
    });
  });

  describe('choose', () => {
    it('成功：id 在待选中 → 写入 augments、清空 pendingAugmentChoices、返回 true', () => {
      const choices = aug.offer();
      const targetId = choices[0].id;

      const ok = aug.choose(targetId);

      expect(ok).toBe(true);
      expect(state.augments).toContain(targetId);
      expect(state.pendingAugmentChoices).toHaveLength(0);
    });

    it('失败：id 不在待选中 → 返回 false、状态不变', () => {
      const choices = aug.offer();
      const pendingBefore = [...state.pendingAugmentChoices];
      const augmentsBefore = [...state.augments];
      // 选一个不在待选中的 id（6 选 3，必有未选中的）
      const notInChoices = AUGMENT_IDS.find(
        (id) => !choices.some((c) => c.id === id),
      );
      expect(notInChoices).toBeDefined();

      const ok = aug.choose(notInChoices!);

      expect(ok).toBe(false);
      expect(state.pendingAugmentChoices).toEqual(pendingBefore);
      expect(state.augments).toEqual(augmentsBefore);
    });
  });

  describe('applyStatAugments', () => {
    // 基础 stats，数值便于校验倍率
    const baseStats: UnitStats = {
      hp: 100,
      attack: 20,
      attackSpeed: 1.0,
      moveSpeed: 2.0,
      range: 3.0,
    };

    it('AtkBoost: attack *= 1.2', () => {
      const result = aug.applyStatAugments(baseStats, [AugmentId.AtkBoost]);
      expect(result.attack).toBeCloseTo(20 * 1.2, 10);
    });

    it('HpBoost: hp *= 1.25', () => {
      const result = aug.applyStatAugments(baseStats, [AugmentId.HpBoost]);
      expect(result.hp).toBeCloseTo(100 * 1.25, 10);
    });

    it('AtkSpeedBoost: attackSpeed *= 1.25', () => {
      const result = aug.applyStatAugments(baseStats, [AugmentId.AtkSpeedBoost]);
      expect(result.attackSpeed).toBeCloseTo(1.0 * 1.25, 10);
    });

    it('MoveBoost: moveSpeed *= 1.3', () => {
      const result = aug.applyStatAugments(baseStats, [AugmentId.MoveBoost]);
      expect(result.moveSpeed).toBeCloseTo(2.0 * 1.3, 10);
    });

    it('RangeBoost: range += 1', () => {
      const result = aug.applyStatAugments(baseStats, [AugmentId.RangeBoost]);
      expect(result.range).toBe(3.0 + 1);
    });

    it('GoldIncome: stats 不变', () => {
      const result = aug.applyStatAugments(baseStats, [AugmentId.GoldIncome]);
      expect(result).toEqual(baseStats);
    });

    it('多个强化叠加：同时应用所有强化', () => {
      const result = aug.applyStatAugments(baseStats, [
        AugmentId.AtkBoost,
        AugmentId.HpBoost,
        AugmentId.AtkSpeedBoost,
        AugmentId.MoveBoost,
        AugmentId.RangeBoost,
      ]);
      expect(result.attack).toBeCloseTo(20 * 1.2, 10);
      expect(result.hp).toBeCloseTo(100 * 1.25, 10);
      expect(result.attackSpeed).toBeCloseTo(1.0 * 1.25, 10);
      expect(result.moveSpeed).toBeCloseTo(2.0 * 1.3, 10);
      expect(result.range).toBe(3.0 + 1);
    });

    it('不修改原 stats 对象（返回新对象）', () => {
      const original: UnitStats = { ...baseStats };
      aug.applyStatAugments(baseStats, [AugmentId.AtkBoost, AugmentId.HpBoost]);
      expect(baseStats).toEqual(original);
    });
  });

  describe('hasAugment', () => {
    it('已添加返回 true', () => {
      state.addAugment(AugmentId.AtkBoost);
      expect(aug.hasAugment(AugmentId.AtkBoost)).toBe(true);
    });

    it('未添加返回 false', () => {
      expect(aug.hasAugment(AugmentId.AtkBoost)).toBe(false);
    });
  });
});
