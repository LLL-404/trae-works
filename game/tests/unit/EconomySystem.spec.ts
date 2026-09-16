import { describe, it, expect, beforeEach } from 'vitest';
import { EconomySystem } from '../../src/game/EconomySystem';
import { AugmentId } from '../../src/types';
import type { GameState } from '../../src/game/GameState';
import { createGameState } from './helpers';

describe('EconomySystem', () => {
  let state: GameState;
  let economy: EconomySystem;

  beforeEach(() => {
    state = createGameState();
    economy = new EconomySystem(state);
  });

  describe('computeIncome', () => {
    it('round=1 时 base=6（5 + round），无利息无强化', () => {
      const r = economy.computeIncome(1, 0, []);
      expect(r.base).toBe(6);
      expect(r.interest).toBe(0);
      expect(r.augmentBonus).toBe(0);
      expect(r.total).toBe(6);
    });

    it('利息计算 floor(gold/10)，上限 5', () => {
      expect(economy.computeIncome(1, 9, []).interest).toBe(0);
      expect(economy.computeIncome(1, 10, []).interest).toBe(1);
      expect(economy.computeIncome(1, 25, []).interest).toBe(2);
      expect(economy.computeIncome(1, 50, []).interest).toBe(5);
      expect(economy.computeIncome(1, 99, []).interest).toBe(5); // 达到上限
      expect(economy.computeIncome(1, 200, []).interest).toBe(5); // 超出上限仍为 5
    });

    it('GoldIncome 强化 +2', () => {
      const r = economy.computeIncome(1, 0, [AugmentId.GOLD_INCOME]);
      expect(r.augmentBonus).toBe(2);
      expect(r.total).toBe(8); // base 6 + interest 0 + augmentBonus 2
    });

    it('无 GoldIncome 强化时 augmentBonus=0', () => {
      const r = economy.computeIncome(1, 0, [AugmentId.ATK_BOOST, AugmentId.HP_BOOST]);
      expect(r.augmentBonus).toBe(0);
      expect(r.total).toBe(6);
    });

    it('round=0/负数/NaN/Infinity 按 1 处理', () => {
      expect(economy.computeIncome(0, 0, []).base).toBe(6);
      expect(economy.computeIncome(-5, 0, []).base).toBe(6);
      expect(economy.computeIncome(NaN, 0, []).base).toBe(6);
      expect(economy.computeIncome(Infinity, 0, []).base).toBe(6);
    });

    it('gold 为负数/NaN/Infinity 按 0 处理', () => {
      expect(economy.computeIncome(1, -50, []).interest).toBe(0);
      expect(economy.computeIncome(1, NaN, []).interest).toBe(0);
      expect(economy.computeIncome(1, Infinity, []).interest).toBe(0);
    });

    it('非整数 round 向下取整后参与 base 计算', () => {
      // safeRound = Math.floor(2.9) = 2 -> base = 5 + 2 = 7
      expect(economy.computeIncome(2.9, 0, []).base).toBe(7);
    });

    it('利息 + 强化 + base 同时生效', () => {
      // round=3 -> base=8, gold=30 -> interest=3, GoldIncome -> +2
      const r = economy.computeIncome(3, 30, [AugmentId.GOLD_INCOME]);
      expect(r.base).toBe(8);
      expect(r.interest).toBe(3);
      expect(r.augmentBonus).toBe(2);
      expect(r.total).toBe(13);
    });
  });

  describe('grantIncome', () => {
    it('调用后 state.gold 增加 total，返回 breakdown 正确', () => {
      // 初始 gold=5, round=1, interest=floor(5/10)=0, total=6
      const r = economy.grantIncome(1, []);
      expect(r).toEqual({ base: 6, interest: 0, augmentBonus: 0, total: 6 });
      expect(state.gold).toBe(11); // 5 + 6
    });

    it('含 GoldIncome 强化时 total 包含 +2', () => {
      const r = economy.grantIncome(1, [AugmentId.GOLD_INCOME]);
      expect(r.total).toBe(8);
      expect(state.gold).toBe(13); // 5 + 8
    });

    it('grantIncome 使用 state.gold 计算利息，而非外部传入', () => {
      // 先加金到 30，利息应为 floor(30/10)=3
      state.addGold(25); // gold=30
      const r = economy.grantIncome(1, []);
      expect(r.interest).toBe(3);
      expect(r.total).toBe(9); // 6 + 3
      expect(state.gold).toBe(39); // 30 + 9
    });
  });

  describe('多次 grantIncome 累加（含利息滚动）', () => {
    it('利息随金币增长逐步滚动', () => {
      // 初始 gold=5
      // 第 1 次：gold=5, interest=floor(5/10)=0, total=6 -> gold=11
      const r1 = economy.grantIncome(1, []);
      expect(r1.total).toBe(6);
      expect(state.gold).toBe(11);

      // 第 2 次：gold=11, interest=floor(11/10)=1, total=7 -> gold=18
      const r2 = economy.grantIncome(1, []);
      expect(r2.total).toBe(7);
      expect(state.gold).toBe(18);

      // 第 3 次：gold=18, interest=floor(18/10)=1, total=7 -> gold=25
      const r3 = economy.grantIncome(1, []);
      expect(r3.total).toBe(7);
      expect(state.gold).toBe(25);

      // 第 4 次：gold=25, interest=floor(25/10)=2, total=8 -> gold=33
      const r4 = economy.grantIncome(1, []);
      expect(r4.total).toBe(8);
      expect(state.gold).toBe(33);
    });

    it('金币超过 50 后利息封顶为 5', () => {
      // 给到 55 金，interest 应封顶 5
      state.addGold(50); // gold=55
      const r = economy.grantIncome(1, []);
      expect(r.interest).toBe(5);
      expect(r.total).toBe(11); // 6 + 5
      expect(state.gold).toBe(66); // 55 + 11
    });
  });
});
