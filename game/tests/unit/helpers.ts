import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../../src/game/GameState';
import type { Unit, UnitStats, UnitType } from '../../src/types';
import { UNIT_DEFINITIONS } from '../../src/data/units';

/**
 * 测试工具函数：创建一个标准的玩家单位实例。
 */
export function createPlayerUnit(
  type: UnitType = 'warrior',
  overrides: Partial<Unit> = {},
): Unit {
  const def = UNIT_DEFINITIONS[type];
  const stats: UnitStats = {
    hp: def.hp,
    attack: def.attack,
    attackSpeed: def.attackSpeed,
    moveSpeed: def.moveSpeed,
    range: def.range,
  };
  return {
    id: `test-${Math.random().toString(36).slice(2, 10)}`,
    type,
    team: 'player',
    stats,
    currentHp: def.hp,
    col: -1,
    row: -1,
    ...overrides,
  };
}

/**
 * 创建一个敌方单位实例。
 */
export function createEnemyUnit(
  type: UnitType = 'warrior',
  overrides: Partial<Unit> = {},
): Unit {
  return createPlayerUnit(type, { team: 'enemy', ...overrides });
}

/**
 * 创建一个新的 GameState 实例（每回合独立）。
 */
export function createGameState(): GameState {
  return new GameState();
}

/**
 * 用指定单位填充玩家棋盘的若干格子。
 */
export function placePlayerUnits(
  state: GameState,
  positions: Array<{ col: number; row: number; type?: UnitType }>,
): Unit[] {
  const units: Unit[] = [];
  for (const pos of positions) {
    const u = createPlayerUnit(pos.type ?? 'warrior', {
      col: pos.col,
      row: pos.row,
    });
    state.board[pos.col][pos.row] = u;
    units.push(u);
  }
  return units;
}

/**
 * 用指定单位填充敌方棋盘的若干格子。
 */
export function placeEnemyUnits(
  state: GameState,
  positions: Array<{ col: number; row: number; type?: UnitType }>,
): Unit[] {
  const units: Unit[] = [];
  for (const pos of positions) {
    const u = createEnemyUnit(pos.type ?? 'warrior', {
      col: pos.col,
      row: pos.row,
    });
    state.enemyBoard[pos.col][pos.row] = u;
    units.push(u);
  }
  return units;
}

/**
 * 创建一个用于 BattleSystem / PlacementController 的 mock UnitRenderer。
 * 仅记录调用，不做任何实际渲染。
 */
export function createMockUnitRenderer() {
  const calls: Array<{
    method: string;
    args: unknown[];
  }> = [];
  return {
    calls,
    placeUnit: (u: Unit) => calls.push({ method: 'placeUnit', args: [u] }),
    removeUnit: (id: string) => calls.push({ method: 'removeUnit', args: [id] }),
    moveUnit: (id: string, col: number, row: number) =>
      calls.push({ method: 'moveUnit', args: [id, col, row] }),
    updateHpBar: (id: string, ratio: number) =>
      calls.push({ method: 'updateHpBar', args: [id, ratio] }),
    setSelected: (id: string, selected: boolean) =>
      calls.push({ method: 'setSelected', args: [id, selected] }),
  };
}

/**
 * 创建一个 mock BoardRenderer（无操作）。
 */
export function createMockBoardRenderer() {
  return {
    highlightTiles: () => {},
    clearHighlight: () => {},
  };
}

/**
 * 重导出常用断言工具，避免每个测试文件重复 import。
 */
export { describe, it, expect, beforeEach };
