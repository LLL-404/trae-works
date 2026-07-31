import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../../src/game/GameState';
import {
  BOARD_COLS,
  BOARD_ROWS,
  BENCH_SIZE,
  SHOP_SIZE,
  AugmentId,
} from '../../src/types';
import type {
  GameState as GameStateModel,
  HexAugment,
  Board,
  ShopSlot,
  UnitType,
} from '../../src/types';
import { createGameState, createPlayerUnit } from './helpers';

/** 断言棋盘所有格子均为空 */
function expectBoardEmpty(board: Board): void {
  expect(board).toHaveLength(BOARD_COLS);
  for (let col = 0; col < BOARD_COLS; col++) {
    expect(board[col]).toHaveLength(BOARD_ROWS);
    for (let row = 0; row < BOARD_ROWS; row++) {
      expect(board[col][row]).toBeNull();
    }
  }
}

/** 断言商店为初始空状态（SHOP_SIZE 个未售空槽） */
function expectShopEmpty(shop: ShopSlot[]): void {
  expect(shop).toHaveLength(SHOP_SIZE);
  for (let i = 0; i < SHOP_SIZE; i++) {
    expect(shop[i].index).toBe(i);
    expect(shop[i].unitType).toBeNull();
    expect(shop[i].sold).toBe(false);
  }
}

describe('GameState', () => {
  let state: GameState;

  beforeEach(() => {
    state = createGameState();
  });

  describe('初始状态', () => {
    it('round=1, phase=prep, playerHp=100, gold=5', () => {
      expect(state.round).toBe(1);
      expect(state.phase).toBe('prep');
      expect(state.playerHp).toBe(100);
      expect(state.gold).toBe(5);
    });

    it('shop/bench/board/enemyBoard 均为空', () => {
      expectShopEmpty(state.shop);
      expect(state.bench).toHaveLength(BENCH_SIZE);
      for (let i = 0; i < BENCH_SIZE; i++) {
        expect(state.bench[i]).toBeNull();
      }
      expectBoardEmpty(state.board);
      expectBoardEmpty(state.enemyBoard);
    });

    it('augments 与 pendingAugmentChoices 为空数组', () => {
      expect(state.augments).toEqual([]);
      expect(state.pendingAugmentChoices).toEqual([]);
    });
  });

  describe('阶段切换', () => {
    it('startBattle 将阶段切到 battle', () => {
      state.startBattle();
      expect(state.phase).toBe('battle');
    });

    it('endBattle 将阶段切到 settle', () => {
      state.endBattle();
      expect(state.phase).toBe('settle');
    });

    it('showAugmentChoices 设置选项并切到 augment 阶段', () => {
      const choices: HexAugment[] = [
        { id: AugmentId.AtkBoost, name: '攻击强化', description: 'd', kind: 'stat' },
      ];
      state.showAugmentChoices(choices);
      expect(state.phase).toBe('augment');
      expect(state.pendingAugmentChoices).toEqual(choices);
    });

    it('nextRound 回合 +1 并回到 prep', () => {
      state.startBattle();
      state.nextRound();
      expect(state.round).toBe(2);
      expect(state.phase).toBe('prep');
    });

    it('gameOver 将阶段切到 gameover', () => {
      state.gameOver();
      expect(state.phase).toBe('gameover');
    });
  });

  describe('subscribe/notify', () => {
    it('监听器在 notify 时收到深拷贝快照，修改快照不影响原状态', () => {
      let received: GameStateModel | null = null;
      const unsub = state.subscribe((s) => {
        received = s;
      });
      state.addGold(10); // 触发 notify
      expect(received).not.toBeNull();
      expect(received!.gold).toBe(15);

      // 修改快照的各类字段，原状态应保持不变
      received!.gold = 9999;
      received!.phase = 'gameover';
      received!.augments.push(AugmentId.AtkBoost);
      received!.shop[0].sold = true;
      received!.board[0][0] = createPlayerUnit();

      expect(state.gold).toBe(15);
      expect(state.phase).toBe('prep');
      expect(state.augments).toEqual([]);
      expect(state.shop[0].sold).toBe(false);
      expect(state.board[0][0]).toBeNull();

      unsub();
    });

    it('取消订阅后不再收到通知', () => {
      let count = 0;
      const unsub = state.subscribe(() => {
        count += 1;
      });
      state.addGold(1);
      expect(count).toBe(1);
      unsub();
      state.addGold(1);
      expect(count).toBe(1);
    });

    it('多个监听器都被通知', () => {
      let a = 0;
      let b = 0;
      state.subscribe(() => {
        a += 1;
      });
      state.subscribe(() => {
        b += 1;
      });
      state.addGold(1);
      expect(a).toBe(1);
      expect(b).toBe(1);
    });
  });

  describe('addGold', () => {
    it('正常加金', () => {
      state.addGold(10);
      expect(state.gold).toBe(15);
    });

    it('负数减金但不下低于 0', () => {
      state.addGold(-3);
      expect(state.gold).toBe(2);
      state.addGold(-100);
      expect(state.gold).toBe(0);
    });

    it('NaN/0/Infinity 不变更', () => {
      state.addGold(NaN);
      expect(state.gold).toBe(5);
      state.addGold(0);
      expect(state.gold).toBe(5);
      state.addGold(Infinity);
      expect(state.gold).toBe(5);
      state.addGold(-Infinity);
      expect(state.gold).toBe(5);
    });
  });

  describe('spendGold', () => {
    it('成功扣金返回 true', () => {
      expect(state.spendGold(3)).toBe(true);
      expect(state.gold).toBe(2);
    });

    it('金币不足返回 false 且不变更', () => {
      expect(state.spendGold(100)).toBe(false);
      expect(state.gold).toBe(5);
    });

    it('负数/NaN/Infinity 返回 false 且不变更', () => {
      expect(state.spendGold(-1)).toBe(false);
      expect(state.spendGold(NaN)).toBe(false);
      expect(state.spendGold(Infinity)).toBe(false);
      expect(state.gold).toBe(5);
    });

    it('恰好够用返回 true 且 gold 变为 0', () => {
      expect(state.spendGold(5)).toBe(true);
      expect(state.gold).toBe(0);
    });
  });

  describe('damagePlayer', () => {
    it('正常扣血', () => {
      state.damagePlayer(30);
      expect(state.playerHp).toBe(70);
    });

    it('不会变负数', () => {
      state.damagePlayer(200);
      expect(state.playerHp).toBe(0);
    });

    it('NaN/负数/0/Infinity 不变更', () => {
      state.damagePlayer(NaN);
      expect(state.playerHp).toBe(100);
      state.damagePlayer(-10);
      expect(state.playerHp).toBe(100);
      state.damagePlayer(0);
      expect(state.playerHp).toBe(100);
      state.damagePlayer(Infinity);
      expect(state.playerHp).toBe(100);
    });
  });

  describe('placeUnitOnBoard', () => {
    it('合法坐标放置单位', () => {
      const u = createPlayerUnit();
      state.placeUnitOnBoard(u, 2, 1);
      expect(state.board[2][1]).toBe(u);
    });

    it('单位的 col/row 同步更新', () => {
      const u = createPlayerUnit();
      state.placeUnitOnBoard(u, 3, 2);
      expect(u.col).toBe(3);
      expect(u.row).toBe(2);
    });

    it('越界坐标忽略，单位 col/row 不变', () => {
      const u = createPlayerUnit();
      state.placeUnitOnBoard(u, BOARD_COLS, 0); // 列越界
      state.placeUnitOnBoard(u, -1, 0); // 列负
      state.placeUnitOnBoard(u, 0, BOARD_ROWS); // 行越界
      state.placeUnitOnBoard(u, 0.5, 0); // 非整数
      expectBoardEmpty(state.board);
      expect(u.col).toBe(-1);
      expect(u.row).toBe(-1);
    });
  });

  describe('removeUnitFromBoard', () => {
    it('移除后格子为 null，单位 col/row 变 -1', () => {
      const u = createPlayerUnit();
      state.placeUnitOnBoard(u, 1, 1);
      state.removeUnitFromBoard(1, 1);
      expect(state.board[1][1]).toBeNull();
      expect(u.col).toBe(-1);
      expect(u.row).toBe(-1);
    });

    it('空格子不报错', () => {
      expect(() => state.removeUnitFromBoard(0, 0)).not.toThrow();
      expect(state.board[0][0]).toBeNull();
    });

    it('越界坐标不报错', () => {
      expect(() => state.removeUnitFromBoard(BOARD_COLS, 0)).not.toThrow();
      expect(() => state.removeUnitFromBoard(-1, 0)).not.toThrow();
    });
  });

  describe('moveUnitOnBoard', () => {
    it('合法移动：源格子清空，目标格子写入，单位坐标更新', () => {
      const u = createPlayerUnit();
      state.placeUnitOnBoard(u, 0, 0);
      state.moveUnitOnBoard(0, 0, 2, 3);
      expect(state.board[0][0]).toBeNull();
      expect(state.board[2][3]).toBe(u);
      expect(u.col).toBe(2);
      expect(u.row).toBe(3);
    });

    it('源格子为空时无操作', () => {
      state.moveUnitOnBoard(1, 1, 2, 2);
      expect(state.board[1][1]).toBeNull();
      expect(state.board[2][2]).toBeNull();
    });

    it('目标越界时无操作，单位仍在原位', () => {
      const u = createPlayerUnit();
      state.placeUnitOnBoard(u, 0, 0);
      state.moveUnitOnBoard(0, 0, BOARD_COLS, 0);
      expect(state.board[0][0]).toBe(u);
      expect(u.col).toBe(0);
      expect(u.row).toBe(0);
    });
  });

  describe('addToBench', () => {
    it('加入空位成功，单位 col/row 变 -1', () => {
      const u = createPlayerUnit();
      expect(state.addToBench(u)).toBe(true);
      expect(state.bench[0]).toBe(u);
      expect(u.col).toBe(-1);
      expect(u.row).toBe(-1);
    });

    it('备战区满时返回 false', () => {
      for (let i = 0; i < BENCH_SIZE; i++) {
        expect(state.addToBench(createPlayerUnit())).toBe(true);
      }
      expect(state.addToBench(createPlayerUnit())).toBe(false);
    });
  });

  describe('removeFromBench', () => {
    it('移除后槽位为 null，单位 col/row 变 -1', () => {
      const u = createPlayerUnit();
      state.addToBench(u);
      state.removeFromBench(0);
      expect(state.bench[0]).toBeNull();
      expect(u.col).toBe(-1);
      expect(u.row).toBe(-1);
    });

    it('越界索引不报错', () => {
      expect(() => state.removeFromBench(-1)).not.toThrow();
      expect(() => state.removeFromBench(BENCH_SIZE)).not.toThrow();
      expect(() => state.removeFromBench(999)).not.toThrow();
    });
  });

  describe('refreshShop', () => {
    it('5 个槽位全部刷新为指定单位', () => {
      const units: UnitType[] = ['warrior', 'archer', 'mage', 'tank', 'warrior'];
      state.refreshShop(units);
      expect(state.shop).toHaveLength(SHOP_SIZE);
      for (let i = 0; i < SHOP_SIZE; i++) {
        expect(state.shop[i].index).toBe(i);
        expect(state.shop[i].unitType).toBe(units[i]);
        expect(state.shop[i].sold).toBe(false);
      }
    });

    it('sold 标记被重置为 false', () => {
      const units: UnitType[] = ['warrior', 'archer', 'mage', 'tank', 'mage'];
      state.refreshShop(units);
      state.buyFromShop(0); // 标记 sold
      expect(state.shop[0].sold).toBe(true);
      state.refreshShop(units);
      expect(state.shop[0].sold).toBe(false);
    });

    it('单位不足时多余槽位 unitType 为 null', () => {
      state.refreshShop(['warrior', 'archer']);
      expect(state.shop[0].unitType).toBe('warrior');
      expect(state.shop[1].unitType).toBe('archer');
      for (let i = 2; i < SHOP_SIZE; i++) {
        expect(state.shop[i].unitType).toBeNull();
        expect(state.shop[i].sold).toBe(false);
      }
    });
  });

  describe('buyFromShop', () => {
    beforeEach(() => {
      state.refreshShop(['warrior', 'archer', 'mage', 'tank', 'warrior']);
    });

    it('可购买返回快照并标记 sold', () => {
      const snap = state.buyFromShop(0);
      expect(snap).not.toBeNull();
      expect(snap!.index).toBe(0);
      expect(snap!.unitType).toBe('warrior');
      expect(snap!.sold).toBe(true);
      // 原槽位也被标记为已售
      expect(state.shop[0].sold).toBe(true);
    });

    it('已售槽位返回 null', () => {
      state.buyFromShop(1);
      expect(state.buyFromShop(1)).toBeNull();
    });

    it('空槽（unitType 为 null）返回 null', () => {
      state.refreshShop(['warrior']); // 其余槽位 unitType 为 null
      expect(state.buyFromShop(2)).toBeNull();
    });
  });

  describe('addAugment', () => {
    it('添加到 augments 数组', () => {
      state.addAugment(AugmentId.AtkBoost);
      expect(state.augments).toEqual([AugmentId.AtkBoost]);
      state.addAugment(AugmentId.GoldIncome);
      expect(state.augments).toEqual([AugmentId.AtkBoost, AugmentId.GoldIncome]);
    });
  });

  describe('reset', () => {
    it('所有状态回到初始值', () => {
      // 先污染各项状态
      state.startBattle();
      state.nextRound();
      state.damagePlayer(40);
      state.addGold(50);
      state.refreshShop(['warrior', 'archer', 'mage', 'tank', 'warrior']);
      state.buyFromShop(0);
      state.addToBench(createPlayerUnit());
      state.placeUnitOnBoard(createPlayerUnit(), 0, 0);
      state.addAugment(AugmentId.AtkBoost);
      state.showAugmentChoices([
        { id: AugmentId.HpBoost, name: 'n', description: 'd', kind: 'stat' },
      ]);

      state.reset();

      expect(state.round).toBe(1);
      expect(state.phase).toBe('prep');
      expect(state.playerHp).toBe(100);
      expect(state.gold).toBe(5);
      expectShopEmpty(state.shop);
      expect(state.bench).toHaveLength(BENCH_SIZE);
      for (let i = 0; i < BENCH_SIZE; i++) {
        expect(state.bench[i]).toBeNull();
      }
      expectBoardEmpty(state.board);
      expectBoardEmpty(state.enemyBoard);
      expect(state.augments).toEqual([]);
      expect(state.pendingAugmentChoices).toEqual([]);
    });
  });

  describe('toSnapshot', () => {
    it('返回深拷贝，修改拷贝不影响原状态', () => {
      state.addGold(10);
      state.placeUnitOnBoard(createPlayerUnit(), 0, 0);
      const snap = state.toSnapshot();
      expect(snap.gold).toBe(15);
      expect(snap.board[0][0]).not.toBeNull();

      // 修改快照各层字段
      snap.gold = 0;
      snap.playerHp = 1;
      snap.augments.push(AugmentId.GoldIncome);
      snap.board[0][0] = null;
      snap.shop[0].sold = true;
      snap.bench[0] = createPlayerUnit();

      // 原状态保持不变
      expect(state.gold).toBe(15);
      expect(state.playerHp).toBe(100);
      expect(state.augments).toEqual([]);
      expect(state.board[0][0]).not.toBeNull();
      expect(state.shop[0].sold).toBe(false);
      expect(state.bench[0]).toBeNull();
    });
  });
});
