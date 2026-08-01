import { describe, it, expect, beforeEach } from 'vitest';
import { ShopSystem } from '../../src/game/ShopSystem';
import type { GameState } from '../../src/game/GameState';
import { UNIT_COST, REFRESH_COST } from '../../src/game/EconomySystem';
import { UNIT_DEFINITIONS, UNIT_TYPES } from '../../src/data/units';
import { BENCH_SIZE, SHOP_SIZE } from '../../src/types';
import type { UnitType } from '../../src/types';
import { createGameState, createPlayerUnit } from './helpers';

describe('ShopSystem', () => {
  let state: GameState;
  let shop: ShopSystem;

  beforeEach(() => {
    state = createGameState();
    shop = new ShopSystem(state);
    // 给予充足金币并填充商店，便于多数测试直接使用
    state.gold = 100;
    shop.populateShop();
  });

  describe('rollShop', () => {
    it('返回长度为 SHOP_SIZE(5) 的数组', () => {
      const units = shop.rollShop();
      expect(units).toHaveLength(SHOP_SIZE);
    });

    it('每个元素都是合法的 UnitType', () => {
      const units = shop.rollShop();
      for (const u of units) {
        expect(UNIT_TYPES).toContain(u);
      }
    });

    it('多次调用结果不同（随机性）', () => {
      const results: UnitType[][] = [];
      for (let i = 0; i < 20; i++) {
        results.push(shop.rollShop());
      }
      // 20 次调用中至少存在两种不同结果（4^5=1024 种组合，全相同的概率近乎 0）
      const serialized = new Set(results.map((r) => JSON.stringify(r)));
      expect(serialized.size).toBeGreaterThan(1);
    });
  });

  describe('populateShop', () => {
    it('刷新 state.shop 全部槽位：sold=false、unitType 非 null', () => {
      // 先污染部分槽位以验证刷新效果
      state.shop[0].sold = true;
      state.shop[1].unitType = null;

      shop.populateShop();

      expect(state.shop).toHaveLength(SHOP_SIZE);
      for (const slot of state.shop) {
        expect(slot.sold).toBe(false);
        expect(slot.unitType).not.toBeNull();
      }
    });
  });

  describe('buy', () => {
    it('成功路径：金币足够且备战区有空位 → 返回 Unit、扣 2 金、槽位 sold=true、单位加入 bench、属性匹配定义表', () => {
      const goldBefore = state.gold;
      const slotType = state.shop[0].unitType;
      expect(slotType).not.toBeNull();

      const unit = shop.buy(0);

      expect(unit).not.toBeNull();
      expect(unit!.type).toBe(slotType);
      expect(unit!.team).toBe('player');
      expect(unit!.col).toBe(-1);
      expect(unit!.row).toBe(-1);
      // 金币扣除 UNIT_COST
      expect(state.gold).toBe(goldBefore - UNIT_COST);
      // 槽位 sold=true
      expect(state.shop[0].sold).toBe(true);
      // 单位已加入 bench
      expect(state.bench).toContain(unit);
      // 属性匹配 UNIT_DEFINITIONS
      const def = UNIT_DEFINITIONS[unit!.type];
      expect(unit!.stats.hp).toBe(def.hp);
      expect(unit!.stats.attack).toBe(def.attack);
      expect(unit!.stats.attackSpeed).toBe(def.attackSpeed);
      expect(unit!.stats.moveSpeed).toBe(def.moveSpeed);
      expect(unit!.stats.range).toBe(def.range);
      expect(unit!.currentHp).toBe(def.hp);
    });

    it('金币不足：返回 null、金币不变、槽位不变', () => {
      state.gold = UNIT_COST - 1; // 1 金，不足以购买
      const goldBefore = state.gold;
      const slotBefore = { ...state.shop[0] };

      const unit = shop.buy(0);

      expect(unit).toBeNull();
      expect(state.gold).toBe(goldBefore);
      expect(state.shop[0]).toEqual(slotBefore);
    });

    it('槽位已售：返回 null、金币退还、其他槽位不受影响', () => {
      // 标记槽位 0 为已售
      state.shop[0].sold = true;
      const goldBefore = state.gold;
      const otherSlotBefore = { ...state.shop[1] };

      const unit = shop.buy(0);

      expect(unit).toBeNull();
      // 金币退还（不变）
      expect(state.gold).toBe(goldBefore);
      // 该槽位仍为已售
      expect(state.shop[0].sold).toBe(true);
      // 其他槽位不受影响
      expect(state.shop[1]).toEqual(otherSlotBefore);
    });

    it('备战区已满：返回 null、金币退还、槽位 sold 恢复为 false（重要鲁棒性）', () => {
      // 用单位填满备战区
      for (let i = 0; i < BENCH_SIZE; i++) {
        state.addToBench(createPlayerUnit('warrior'));
      }
      const goldBefore = state.gold;

      const unit = shop.buy(0);

      expect(unit).toBeNull();
      // 金币退还（不变）
      expect(state.gold).toBe(goldBefore);
      // 槽位 sold 恢复为 false（重要鲁棒性）
      expect(state.shop[0].sold).toBe(false);
    });

    it('越界索引：返回 null、金币退还', () => {
      const goldBefore = state.gold;

      const unit = shop.buy(99);

      expect(unit).toBeNull();
      // buyFromShop 对越界索引返回 null，已扣金币会被退还
      expect(state.gold).toBe(goldBefore);
    });

    it('负数索引：返回 null', () => {
      const unit = shop.buy(-1);
      expect(unit).toBeNull();
    });
  });

  describe('refresh', () => {
    it('成功：扣 REFRESH_COST 金、商店被重新随机填充', () => {
      const goldBefore = state.gold;

      const ok = shop.refresh();

      expect(ok).toBe(true);
      // 金币扣除 REFRESH_COST
      expect(state.gold).toBe(goldBefore - REFRESH_COST);
      // 商店被重新随机：所有槽位 sold=false、unitType 非 null
      expect(state.shop).toHaveLength(SHOP_SIZE);
      for (const slot of state.shop) {
        expect(slot.sold).toBe(false);
        expect(slot.unitType).not.toBeNull();
      }
    });

    it('多次调用产生不同的商店组合（随机性）', () => {
      const snapshots = new Set<string>();
      for (let i = 0; i < 20; i++) {
        shop.refresh();
        snapshots.add(JSON.stringify(state.shop.map((s) => s.unitType)));
      }
      expect(snapshots.size).toBeGreaterThan(1);
    });

    it('金币不足：返回 false、金币不变、商店不变', () => {
      state.gold = REFRESH_COST - 1; // 1 金，不足以刷新
      const goldBefore = state.gold;
      const shopBefore = state.shop.map((s) => ({ ...s }));

      const ok = shop.refresh();

      expect(ok).toBe(false);
      expect(state.gold).toBe(goldBefore);
      expect(state.shop).toEqual(shopBefore);
    });
  });
});
