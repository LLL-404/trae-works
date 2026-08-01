import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../../src/game/GameState';
import { EconomySystem } from '../../src/game/EconomySystem';
import { ShopSystem } from '../../src/game/ShopSystem';
import { AugmentSystem } from '../../src/game/AugmentSystem';
import { RogueProgression } from '../../src/game/RogueProgression';
import { CombatResolver } from '../../src/game/CombatResolver';
import { BattleSystem } from '../../src/game/BattleSystem';
import type { BattleTickResult } from '../../src/game/BattleSystem';
import { PlacementController } from '../../src/game/PlacementController';
import type { UnitRenderer } from '../../src/game/UnitRenderer';
import type { BoardRenderer } from '../../src/game/BoardRenderer';
import { AUGMENT_DEFINITIONS } from '../../src/data/augments';
import { UNIT_DEFINITIONS } from '../../src/data/units';
import { AugmentId } from '../../src/types';
import type { UnitStats } from '../../src/types';
import { BENCH_SIZE, SHOP_SIZE } from '../../src/types';
import {
  createGameState,
  createPlayerUnit,
  createMockUnitRenderer,
  createMockBoardRenderer,
  placePlayerUnits,
  placeEnemyUnits,
} from './helpers';

/** 反复 tick 直到战斗结束或达到上限帧数 */
function tickUntilFinished(
  battle: BattleSystem,
  maxTicks = 200,
  dt = 0.1,
): BattleTickResult {
  let result: BattleTickResult = { finished: false };
  for (let i = 0; i < maxTicks && !result.finished; i++) {
    result = battle.tick(dt);
  }
  return result;
}

describe('集成测试', () => {
  let state: GameState;
  let economySystem: EconomySystem;
  let shopSystem: ShopSystem;
  let augmentSystem: AugmentSystem;
  let rogueProgression: RogueProgression;
  let combatResolver: CombatResolver;
  let battleSystem: BattleSystem;
  let placementController: PlacementController;

  beforeEach(() => {
    // 每个用例创建全新的状态与各系统实例
    state = createGameState();
    economySystem = new EconomySystem(state);
    shopSystem = new ShopSystem(state);
    augmentSystem = new AugmentSystem(state);
    rogueProgression = new RogueProgression(state);
    combatResolver = new CombatResolver(state);
    // BattleSystem 使用 createMockUnitRenderer
    battleSystem = new BattleSystem(
      state,
      createMockUnitRenderer() as unknown as UnitRenderer,
    );
    // PlacementController 使用 createMockUnitRenderer + createMockBoardRenderer
    placementController = new PlacementController(
      state,
      createMockUnitRenderer() as unknown as UnitRenderer,
      createMockBoardRenderer() as unknown as BoardRenderer,
    );
  });

  // ===== 1. 完整回合流程集成 =====
  it('完整回合流程：populateShop → buy → refresh → 金币不足时不购买', () => {
    // 初始状态：round=1, gold=5, shop 空
    expect(state.round).toBe(1);
    expect(state.gold).toBe(5);
    for (const slot of state.shop) {
      expect(slot.unitType).toBeNull();
      expect(slot.sold).toBe(false);
    }

    // populateShop 后 shop 有 5 个非空 slot
    shopSystem.populateShop();
    expect(state.shop).toHaveLength(SHOP_SIZE);
    for (const slot of state.shop) {
      expect(slot.unitType).not.toBeNull();
      expect(slot.sold).toBe(false);
    }

    // buy(0) 成功：gold=3, bench[0] 有单位, shop[0].sold=true
    const unit = shopSystem.buy(0);
    expect(unit).not.toBeNull();
    expect(state.gold).toBe(3); // 5 - UNIT_COST(2) = 3
    expect(state.bench[0]).not.toBeNull();
    expect(state.shop[0].sold).toBe(true);
    // 验证购买的单位属性与 UNIT_DEFINITIONS 一致
    if (unit) {
      const def = UNIT_DEFINITIONS[unit.type];
      expect(unit.stats.hp).toBe(def.hp);
      expect(unit.stats.attack).toBe(def.attack);
    }

    // refresh：gold=1, shop 全新
    const refreshed = shopSystem.refresh();
    expect(refreshed).toBe(true);
    expect(state.gold).toBe(1); // 3 - REFRESH_COST(2) = 1
    for (const slot of state.shop) {
      expect(slot.sold).toBe(false);
      expect(slot.unitType).not.toBeNull();
    }

    // 再 buy(0)：金币不足（1 < 2），不购买
    const unit2 = shopSystem.buy(0);
    expect(unit2).toBeNull();
    expect(state.gold).toBe(1); // 金币不变
    expect(state.shop[0].sold).toBe(false); // 槽位不变
  });

  // ===== 2. 战斗 + 结算 + 下一回合完整循环 =====
  it('战斗 + 结算 + 下一回合完整循环', () => {
    // 放置 2 个玩家单位（强单位，默认 warrior 属性）
    placePlayerUnits(state, [{ col: 0, row: 0 }, { col: 1, row: 0 }]);
    // 放置 1 个敌方单位（低血，确保玩家胜）
    const [enemyUnit] = placeEnemyUnits(state, [{ col: 0, row: 2 }]);
    enemyUnit.stats.hp = 10;
    enemyUnit.currentHp = 10;

    // 开始战斗
    battleSystem.start();
    expect(state.phase).toBe('battle');

    // 循环 tick 直到结束
    const result = tickUntilFinished(battleSystem, 200, 0.1);

    // 验证玩家胜（2v1 强单位 vs 弱单位）
    expect(result.finished).toBe(true);
    expect(result.result).toBe('player');

    // 结算：玩家胜，奖励 5 金币，不扣血
    const goldBefore = state.gold;
    const hpBefore = state.playerHp;
    const combatResult = combatResolver.resolve('player', 0);

    expect(combatResult.rewardGold).toBe(5);
    expect(combatResult.hpLost).toBe(0);
    expect(state.gold).toBe(goldBefore + 5);
    expect(state.playerHp).toBe(hpBefore);

    // 推进到下一回合：round=2
    rogueProgression.proceedToNextRound();
    expect(state.round).toBe(2);

    // 发放第 2 回合收入：gold 增加正确
    const goldBeforeIncome = state.gold;
    const income = economySystem.grantIncome(2, state.augments);
    // round=2: base=7, interest=floor(goldBeforeIncome/10), total=base+interest
    const expectedInterest = Math.min(5, Math.floor(goldBeforeIncome / 10));
    expect(income.base).toBe(7);
    expect(income.interest).toBe(expectedInterest);
    expect(income.total).toBe(7 + expectedInterest);
    expect(state.gold).toBe(goldBeforeIncome + income.total);
  });

  // ===== 3. 强化选择完整流程 =====
  it('强化选择完整流程：offer → choose → applyStatAugments', () => {
    // state.round 设为 2（偶数回合提供强化）
    state.round = 2;
    expect(augmentSystem.shouldOffer(2)).toBe(true);

    // 抽取 3 个强化
    const choices = augmentSystem.offer();
    expect(state.pendingAugmentChoices).toHaveLength(3);
    expect(state.phase).toBe('augment');

    // 验证 choices 与 AUGMENT_DEFINITIONS 一致
    for (const c of choices) {
      const def = AUGMENT_DEFINITIONS[c.id];
      expect(c.name).toBe(def.name);
      expect(c.description).toBe(def.description);
      expect(c.kind).toBe(def.kind);
    }

    // 选择第一个强化
    const chosen = choices[0];
    const ok = augmentSystem.choose(chosen.id);
    expect(ok).toBe(true);
    expect(state.augments).toContain(chosen.id);
    expect(state.pendingAugmentChoices).toHaveLength(0);

    // 应用强化到单位属性
    const baseStats: UnitStats = {
      hp: 100,
      attack: 20,
      attackSpeed: 1.0,
      moveSpeed: 2.0,
      range: 3.0,
    };
    const augmentedStats = augmentSystem.applyStatAugments(
      baseStats,
      state.augments,
    );

    // 根据所选强化类型验证对应属性已被修改
    // 注意：GoldIncome 为经济类强化，不影响单位 stats
    switch (chosen.id) {
      case AugmentId.ATK_BOOST:
        expect(augmentedStats.attack).toBeCloseTo(20 * 1.2, 10);
        break;
      case AugmentId.HP_BOOST:
        expect(augmentedStats.hp).toBeCloseTo(100 * 1.25, 10);
        break;
      case AugmentId.ATK_SPEED_BOOST:
        expect(augmentedStats.attackSpeed).toBeCloseTo(1.0 * 1.25, 10);
        break;
      case AugmentId.MOVE_BOOST:
        expect(augmentedStats.moveSpeed).toBeCloseTo(2.0 * 1.3, 10);
        break;
      case AugmentId.RANGE_BOOST:
        expect(augmentedStats.range).toBe(3.0 + 1);
        break;
      case AugmentId.GOLD_INCOME:
        // 经济类强化不影响 stats
        expect(augmentedStats).toEqual(baseStats);
        break;
    }
  });

  // ===== 4. 备战区满 + 商店购买的鲁棒性 =====
  it('备战区满时购买：返回 null、金币不变、槽位恢复', () => {
    // 给予充足金币并填充商店
    state.gold = 100;
    shopSystem.populateShop();

    // 填满备战区（9 个单位）
    for (let i = 0; i < BENCH_SIZE; i++) {
      state.bench[i] = createPlayerUnit();
    }

    // 尝试 buy(0)：返回 null, gold 不变, shop[0].sold === false（关键：槽位恢复）
    const goldBefore = state.gold;
    const unit = shopSystem.buy(0);
    expect(unit).toBeNull();
    expect(state.gold).toBe(goldBefore); // 金币已退还
    expect(state.shop[0].sold).toBe(false); // 槽位恢复为可购买

    // 清空备战区后 buy 成功
    for (let i = 0; i < BENCH_SIZE; i++) {
      state.bench[i] = null;
    }
    const unit2 = shopSystem.buy(0);
    expect(unit2).not.toBeNull();
    expect(state.bench[0]).not.toBeNull();
    expect(state.shop[0].sold).toBe(true);
  });

  // ===== 5. 多回合经济累积 =====
  it('多回合经济累积：5 回合收入与利息滚动', () => {
    // 初始 gold=5
    expect(state.gold).toBe(5);

    // 收入公式：total = base(5+round) + interest(min(5, floor(gold/10))) + augmentBonus(0)

    // round=1: gold=5, base=6, interest=floor(5/10)=0, total=6 → gold=11
    let income = economySystem.grantIncome(1, state.augments);
    expect(income.base).toBe(6);
    expect(income.interest).toBe(0);
    expect(income.total).toBe(6);
    expect(state.gold).toBe(11);

    // round=2: gold=11, base=7, interest=floor(11/10)=1, total=8 → gold=19
    income = economySystem.grantIncome(2, state.augments);
    expect(income.base).toBe(7);
    expect(income.interest).toBe(1);
    expect(income.total).toBe(8);
    expect(state.gold).toBe(19);

    // round=3: gold=19, base=8, interest=floor(19/10)=1, total=9 → gold=28
    income = economySystem.grantIncome(3, state.augments);
    expect(income.base).toBe(8);
    expect(income.interest).toBe(1);
    expect(income.total).toBe(9);
    expect(state.gold).toBe(28);

    // round=4: gold=28, base=9, interest=floor(28/10)=2, total=11 → gold=39
    income = economySystem.grantIncome(4, state.augments);
    expect(income.base).toBe(9);
    expect(income.interest).toBe(2);
    expect(income.total).toBe(11);
    expect(state.gold).toBe(39);

    // round=5: gold=39, base=10, interest=floor(39/10)=3, total=13 → gold=52
    income = economySystem.grantIncome(5, state.augments);
    expect(income.base).toBe(10);
    expect(income.interest).toBe(3);
    expect(income.total).toBe(13);
    expect(state.gold).toBe(52);
  });

  // ===== 6. 游戏结束触发 =====
  it('游戏结束触发：playerHp 归零 → gameOver', () => {
    // state.playerHp = 2
    state.playerHp = 2;

    // 放置 2 个敌方单位（不放置玩家单位 → 敌方自动获胜）
    placeEnemyUnits(state, [{ col: 0, row: 2 }, { col: 1, row: 2 }]);

    // 开始战斗并 tick 直到敌方胜
    battleSystem.start();
    const result = tickUntilFinished(battleSystem, 200, 0.1);

    expect(result.finished).toBe(true);
    expect(result.result).toBe('enemy');

    // 结算：敌方胜，survivingEnemyCount=2 → hpLost=4, playerHp=2-4→0
    const combatResult = combatResolver.resolve('enemy', 2);
    expect(combatResult.hpLost).toBe(4);
    expect(state.playerHp).toBe(0); // max(0, 2-4) = 0
    expect(combatResult.gameOver).toBe(true);
    expect(state.phase).toBe('gameover');
  });

  // ===== 7. 重启后状态完全重置 =====
  it('重启后状态完全重置：startNewRun → 全部回到初始', () => {
    // 进行几回合游戏：添加强化、购买单位、棋盘放置
    state.round = 3;
    state.playerHp = 50;
    state.gold = 20;
    state.addAugment(AugmentId.ATK_BOOST);
    state.addAugment(AugmentId.HP_BOOST);
    shopSystem.populateShop();
    shopSystem.buy(0); // 购买单位到备战区
    // 棋盘上放置单位
    state.board[0][0] = createPlayerUnit();
    state.board[2][1] = createPlayerUnit();
    // 备战区额外放单位
    state.bench[3] = createPlayerUnit();

    // 重启
    rogueProgression.startNewRun();

    // 验证所有状态回到初始
    expect(state.round).toBe(1);
    expect(state.phase).toBe('prep');
    expect(state.playerHp).toBe(100);
    expect(state.gold).toBe(5);
    expect(state.augments).toEqual([]);
    expect(state.pendingAugmentChoices).toEqual([]);
    // bench 全空
    for (const u of state.bench) {
      expect(u).toBeNull();
    }
    // board 全空
    for (const col of state.board) {
      for (const u of col) {
        expect(u).toBeNull();
      }
    }
    // enemyBoard 全空
    for (const col of state.enemyBoard) {
      for (const u of col) {
        expect(u).toBeNull();
      }
    }
    // shop 全空
    for (const slot of state.shop) {
      expect(slot.unitType).toBeNull();
      expect(slot.sold).toBe(false);
    }
  });

  // ===== 8. 棋盘放置边界场景 =====
  it('棋盘放置边界场景：选中、移动、敌方区拒绝、撤回', () => {
    // 放置单位到 (0,0)
    placePlayerUnits(state, [{ col: 0, row: 0 }]);
    expect(state.board[0][0]).not.toBeNull();

    // 选中 (0,0) 的单位成功
    expect(placementController.selectBoardUnit(0, 0)).toBe(true);
    expect(placementController.hasSelected()).toBe(true);

    // 移动到空格 (0,1) 成功
    expect(placementController.placeSelected(0, 1)).toBe(true);
    expect(state.board[0][0]).toBeNull();
    expect(state.board[0][1]).not.toBeNull();

    // 重新选中 (0,1) 的单位
    expect(placementController.selectBoardUnit(0, 1)).toBe(true);

    // 尝试移动到敌方区 (2,2) 失败（row=2 为敌方区）
    expect(placementController.placeSelected(2, 2)).toBe(false);
    expect(state.board[0][1]).not.toBeNull(); // 单位仍在原位

    // 撤回 (0,1) 的单位到备战区成功，bench 有单位
    expect(placementController.recallFromBoard(0, 1)).toBe(true);
    expect(state.board[0][1]).toBeNull();
    expect(state.bench[0]).not.toBeNull(); // 撤回到备战区第一个空位
  });
});
