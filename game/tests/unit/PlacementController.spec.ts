import { describe, it, expect, beforeEach } from 'vitest';
import { PlacementController } from '../../src/game/PlacementController';
import { GameState } from '../../src/game/GameState';
import type { UnitRenderer } from '../../src/game/UnitRenderer';
import type { BoardRenderer } from '../../src/game/BoardRenderer';
import { BENCH_SIZE } from '../../src/types';
import {
  createGameState,
  createPlayerUnit,
  createEnemyUnit,
  createMockUnitRenderer,
  createMockBoardRenderer,
} from './helpers';
import type { Unit } from '../../src/types';

describe('PlacementController', () => {
  let state: GameState;
  let controller: PlacementController;
  let unitRenderer: ReturnType<typeof createMockUnitRenderer>;

  beforeEach(() => {
    state = createGameState();
    unitRenderer = createMockUnitRenderer();
    // mock 对象结构兼容但缺少 UnitRenderer/BoardRenderer 的私有字段，
    // 通过 as unknown as 桥接类型（依赖注入的测试替身常用做法）
    controller = new PlacementController(
      state,
      unitRenderer as unknown as UnitRenderer,
      createMockBoardRenderer() as unknown as BoardRenderer,
    );
  });

  describe('hasSelected', () => {
    it('初始为 false', () => {
      expect(controller.hasSelected()).toBe(false);
    });

    it('selectBenchUnit 后为 true', () => {
      state.bench[0] = createPlayerUnit();
      controller.selectBenchUnit(0);
      expect(controller.hasSelected()).toBe(true);
    });

    it('deselect 后为 false', () => {
      state.bench[0] = createPlayerUnit();
      controller.selectBenchUnit(0);
      controller.deselect();
      expect(controller.hasSelected()).toBe(false);
    });
  });

  describe('selectBenchUnit', () => {
    it('成功返回 true 并设置 selectedUnitId', () => {
      const unit = createPlayerUnit();
      state.bench[2] = unit;
      expect(controller.selectBenchUnit(2)).toBe(true);
      expect(controller.selectedUnitId).toBe(unit.id);
    });

    it('空位返回 false', () => {
      expect(controller.selectBenchUnit(0)).toBe(false);
      expect(controller.selectedUnitId).toBeNull();
    });
  });

  describe('selectBoardUnit', () => {
    it('成功选中玩家方单位返回 true', () => {
      const unit = createPlayerUnit();
      state.board[3][0] = unit;
      expect(controller.selectBoardUnit(3, 0)).toBe(true);
      expect(controller.selectedUnitId).toBe(unit.id);
    });

    it('非玩家方单位返回 false', () => {
      const enemy = createEnemyUnit();
      state.board[3][0] = enemy;
      expect(controller.selectBoardUnit(3, 0)).toBe(false);
      expect(controller.selectedUnitId).toBeNull();
    });

    it('空格子返回 false', () => {
      expect(controller.selectBoardUnit(3, 0)).toBe(false);
      expect(controller.selectedUnitId).toBeNull();
    });
  });

  describe('deselect', () => {
    it('清除选中状态', () => {
      state.bench[0] = createPlayerUnit();
      controller.selectBenchUnit(0);
      controller.deselect();
      expect(controller.selectedUnitId).toBeNull();
      expect(controller.hasSelected()).toBe(false);
    });

    it('调用 mock unitRenderer.setSelected(id, false)', () => {
      const unit = createPlayerUnit();
      state.bench[0] = unit;
      controller.selectBenchUnit(0);
      // 清空选中阶段产生的调用，仅观察 deselect 的副作用
      unitRenderer.calls.length = 0;
      controller.deselect();
      const setSelectedFalse = unitRenderer.calls.find(
        (c) =>
          c.method === 'setSelected' &&
          c.args[0] === unit.id &&
          c.args[1] === false,
      );
      expect(setSelectedFalse).toBeDefined();
    });
  });

  describe('placeSelected 从备战区放置', () => {
    let unit: Unit;

    beforeEach(() => {
      unit = createPlayerUnit();
      state.bench[1] = unit;
      controller.selectBenchUnit(1);
    });

    it('合法玩家区（row 0）空格子 → 成功、单位从 bench 移除、加入 board、调用 placeUnit 渲染、自动 deselect', () => {
      expect(controller.placeSelected(2, 0)).toBe(true);
      // 单位从 bench 移除
      expect(state.bench[1]).toBeNull();
      // 加入 board
      expect(state.board[2][0]).toBe(unit);
      // 调用 placeUnit 渲染
      const placeCall = unitRenderer.calls.find(
        (c) => c.method === 'placeUnit' && c.args[0] === unit,
      );
      expect(placeCall).toBeDefined();
      // 自动 deselect
      expect(controller.hasSelected()).toBe(false);
      expect(controller.selectedUnitId).toBeNull();
    });

    it('合法玩家区（row 1）空格子 → 成功', () => {
      expect(controller.placeSelected(4, 1)).toBe(true);
      expect(state.bench[1]).toBeNull();
      expect(state.board[4][1]).toBe(unit);
    });

    it('敌方区（row 2）→ 失败、保持选中', () => {
      expect(controller.placeSelected(2, 2)).toBe(false);
      expect(controller.hasSelected()).toBe(true);
      expect(controller.selectedUnitId).toBe(unit.id);
      // bench 未变化
      expect(state.bench[1]).toBe(unit);
    });

    it('敌方区（row 3）→ 失败、保持选中', () => {
      expect(controller.placeSelected(2, 3)).toBe(false);
      expect(controller.hasSelected()).toBe(true);
      expect(state.bench[1]).toBe(unit);
    });

    it('越界 col（过大）→ 失败', () => {
      expect(controller.placeSelected(99, 0)).toBe(false);
      expect(controller.hasSelected()).toBe(true);
    });

    it('越界 col（负数）→ 失败', () => {
      expect(controller.placeSelected(-1, 0)).toBe(false);
      expect(controller.hasSelected()).toBe(true);
    });

    it('已占用格子 → 失败', () => {
      const other = createPlayerUnit();
      state.board[2][0] = other;
      expect(controller.placeSelected(2, 0)).toBe(false);
      expect(controller.hasSelected()).toBe(true);
      // 已占用单位未变化
      expect(state.board[2][0]).toBe(other);
      // bench 未变化
      expect(state.bench[1]).toBe(unit);
    });
  });

  describe('placeSelected 从棋盘移动', () => {
    let unit: Unit;

    beforeEach(() => {
      unit = createPlayerUnit();
      state.board[2][0] = unit;
      unit.col = 2;
      unit.row = 0;
      controller.selectBoardUnit(2, 0);
    });

    it('合法移动 → 成功、源格子清空、目标格子写入、调用 moveUnit 渲染', () => {
      expect(controller.placeSelected(3, 1)).toBe(true);
      // 源格子清空
      expect(state.board[2][0]).toBeNull();
      // 目标格子写入
      expect(state.board[3][1]).toBe(unit);
      // 调用 moveUnit 渲染
      const moveCall = unitRenderer.calls.find(
        (c) =>
          c.method === 'moveUnit' &&
          c.args[0] === unit.id &&
          c.args[1] === 3 &&
          c.args[2] === 1,
      );
      expect(moveCall).toBeDefined();
      // 自动 deselect
      expect(controller.hasSelected()).toBe(false);
    });

    it('移动到敌方区（row 2）→ 失败', () => {
      expect(controller.placeSelected(3, 2)).toBe(false);
      expect(controller.hasSelected()).toBe(true);
      // 源单位未变化
      expect(state.board[2][0]).toBe(unit);
    });

    it('移动到敌方区（row 3）→ 失败', () => {
      expect(controller.placeSelected(3, 3)).toBe(false);
      expect(controller.hasSelected()).toBe(true);
      expect(state.board[2][0]).toBe(unit);
    });
  });

  describe('recallFromBoard', () => {
    it('玩家方单位 + 备战区有空位 → 成功、单位从 board 移除、加入 bench、调用 removeUnit 渲染', () => {
      const unit = createPlayerUnit();
      state.board[2][0] = unit;
      unit.col = 2;
      unit.row = 0;

      expect(controller.recallFromBoard(2, 0)).toBe(true);
      // 单位从 board 移除
      expect(state.board[2][0]).toBeNull();
      // 加入 bench（第一个空位 0）
      expect(state.bench[0]).toBe(unit);
      // 调用 removeUnit 渲染
      const removeCall = unitRenderer.calls.find(
        (c) => c.method === 'removeUnit' && c.args[0] === unit.id,
      );
      expect(removeCall).toBeDefined();
    });

    it('敌方单位 → 失败（实际场景不会发生，但需防御）', () => {
      const enemy = createEnemyUnit();
      state.board[2][0] = enemy;
      expect(controller.recallFromBoard(2, 0)).toBe(false);
      // 棋盘未变化
      expect(state.board[2][0]).toBe(enemy);
    });

    it('备战区已满 → 失败', () => {
      const unit = createPlayerUnit();
      state.board[2][0] = unit;
      // 填满备战区
      for (let i = 0; i < BENCH_SIZE; i++) {
        state.bench[i] = createPlayerUnit();
      }
      expect(controller.recallFromBoard(2, 0)).toBe(false);
      // 棋盘未变化
      expect(state.board[2][0]).toBe(unit);
    });

    it('空格子 → 失败', () => {
      expect(controller.recallFromBoard(2, 0)).toBe(false);
    });

    it('撤回当前选中单位 → 自动 deselect', () => {
      const unit = createPlayerUnit();
      state.board[2][0] = unit;
      unit.col = 2;
      unit.row = 0;
      controller.selectBoardUnit(2, 0);
      expect(controller.hasSelected()).toBe(true);

      // 清空选中阶段产生的调用，仅观察 recall 的副作用
      unitRenderer.calls.length = 0;
      expect(controller.recallFromBoard(2, 0)).toBe(true);
      // 自动 deselect
      expect(controller.hasSelected()).toBe(false);
      expect(controller.selectedUnitId).toBeNull();
      // deselect 触发 setSelected(id, false)
      const setSelectedFalse = unitRenderer.calls.find(
        (c) =>
          c.method === 'setSelected' &&
          c.args[0] === unit.id &&
          c.args[1] === false,
      );
      expect(setSelectedFalse).toBeDefined();
    });
  });
});
