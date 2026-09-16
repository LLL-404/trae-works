import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BattleSystem } from '../../src/game/BattleSystem';
import type { BattleTickResult } from '../../src/game/BattleSystem';
import type { UnitRenderer } from '../../src/game/UnitRenderer';
import type { UnitStats } from '../../src/types';
import {
  createGameState,
  createPlayerUnit,
  createEnemyUnit,
  createMockUnitRenderer,
  placePlayerUnits,
  placeEnemyUnits,
} from './helpers';

/** 构造一组自定义单位属性，默认值便于在用例中按需覆盖 */
function makeStats(overrides: Partial<UnitStats>): UnitStats {
  return {
    hp: 100,
    attack: 18,
    attackSpeed: 1,
    moveSpeed: 2,
    range: 1,
    ...overrides,
  };
}

/** 玩家高攻 / 敌方低血 的「玩家胜」战斗场景（相邻格子，玩家先手一击必杀） */
function setupPlayerWinBattle() {
  const state = createGameState();
  const playerUnit = createPlayerUnit('warrior', {
    stats: makeStats({ hp: 100, attack: 100 }),
    col: 0,
    row: 0,
  });
  const enemyUnit = createEnemyUnit('warrior', {
    stats: makeStats({ hp: 10, attack: 0 }),
    col: 1,
    row: 0,
  });
  state.board[0][0] = playerUnit;
  state.enemyBoard[1][0] = enemyUnit;
  const rendererMock = createMockUnitRenderer();
  const battle = new BattleSystem(state, rendererMock as unknown as UnitRenderer);
  return { state, playerUnit, enemyUnit, rendererMock, battle };
}

/** 玩家低血 / 敌方高攻 的「敌方胜」战斗场景 */
function setupEnemyWinBattle() {
  const state = createGameState();
  const playerUnit = createPlayerUnit('warrior', {
    stats: makeStats({ hp: 10, attack: 0 }),
    col: 0,
    row: 0,
  });
  const enemyUnit = createEnemyUnit('warrior', {
    stats: makeStats({ hp: 100, attack: 100 }),
    col: 1,
    row: 0,
  });
  state.board[0][0] = playerUnit;
  state.enemyBoard[1][0] = enemyUnit;
  const rendererMock = createMockUnitRenderer();
  const battle = new BattleSystem(state, rendererMock as unknown as UnitRenderer);
  return { state, playerUnit, enemyUnit, rendererMock, battle };
}

/** 反复 tick 直到结束或达到上限帧数 */
function tickUntilFinished(
  battle: BattleSystem,
  maxTicks = 100,
  dt = 0.1,
): BattleTickResult {
  let result: BattleTickResult = { finished: false };
  for (let i = 0; i < maxTicks && !result.finished; i++) {
    result = battle.tick(dt);
  }
  return result;
}

describe('BattleSystem', () => {
  // 控制 performance.now()，用于测试 30s 超时判定
  let now: number;

  beforeEach(() => {
    now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('start：phase 切换为 battle，activeUnits 收集双方单位且全部满血', () => {
    const state = createGameState();
    const [playerUnit] = placePlayerUnits(state, [{ col: 0, row: 0 }]);
    const [enemyUnit] = placeEnemyUnits(state, [{ col: 1, row: 0 }]);
    // 刻意压低 currentHp，验证 start 会将其重置为满血
    playerUnit.currentHp = 50;
    enemyUnit.currentHp = 30;

    const rendererMock = createMockUnitRenderer();
    const battle = new BattleSystem(state, rendererMock as unknown as UnitRenderer);

    battle.start();

    expect(state.phase).toBe('battle');
    const active = battle.getActiveUnits();
    expect(active.length).toBe(2);
    for (const u of active) {
      expect(u.currentHp).toBe(u.stats.hp);
    }
  });

  it('start 多次调用：每次重新收集，不累积', () => {
    const state = createGameState();
    placePlayerUnits(state, [{ col: 0, row: 0 }]);
    placeEnemyUnits(state, [{ col: 1, row: 0 }]);

    const rendererMock = createMockUnitRenderer();
    const battle = new BattleSystem(state, rendererMock as unknown as UnitRenderer);

    battle.start();
    expect(battle.getActiveUnits().length).toBe(2);

    // 再次 start 应重新收集，activeUnits 不应翻倍累积
    battle.start();
    expect(battle.getActiveUnits().length).toBe(2);
  });

  it('tick 未开始：未调用 start 直接 tick 返回 { finished: true }', () => {
    const state = createGameState();
    const rendererMock = createMockUnitRenderer();
    const battle = new BattleSystem(state, rendererMock as unknown as UnitRenderer);

    const result = battle.tick(0.1);

    expect(result.finished).toBe(true);
    expect(result.result).toBeUndefined();
  });

  it('tick 玩家胜：玩家高攻单位击杀敌方低血单位', () => {
    const { battle } = setupPlayerWinBattle();
    battle.start();

    const result = tickUntilFinished(battle, 20, 0.1);

    expect(result.finished).toBe(true);
    expect(result.result).toBe('player');
  });

  it('tick 敌方胜：玩家低血单位被敌方高攻单位击杀', () => {
    const { battle } = setupEnemyWinBattle();
    battle.start();

    const result = tickUntilFinished(battle, 20, 0.1);

    expect(result.finished).toBe(true);
    expect(result.result).toBe('enemy');
  });

  it('tick 同归于尽：双方 0 攻击单位 → 超时平局 result=draw', () => {
    const state = createGameState();
    // 双方 0 攻击、等血单位，无法互相击杀，只能等超时
    state.board[0][0] = createPlayerUnit('warrior', {
      stats: makeStats({ hp: 100, attack: 0 }),
      col: 0,
      row: 0,
    });
    state.enemyBoard[1][0] = createEnemyUnit('warrior', {
      stats: makeStats({ hp: 100, attack: 0 }),
      col: 1,
      row: 0,
    });
    const rendererMock = createMockUnitRenderer();
    const battle = new BattleSystem(state, rendererMock as unknown as UnitRenderer);

    now = 0;
    battle.start(); // battleStartTime = 0

    // 30s 内双方均无法击杀对方，战斗不应结束
    for (let i = 0; i < 5; i++) {
      const r = battle.tick(0.1);
      expect(r.finished).toBe(false);
    }

    // 推进墙钟超过 30s 触发超时判定；双方存活数相等 → draw
    now = 31000;
    const result = battle.tick(0.1);

    expect(result.finished).toBe(true);
    expect(result.result).toBe('draw');
  });

  it('tick 非法 delta：NaN / 负数 / Infinity 按 0 处理，不污染状态', () => {
    const state = createGameState();
    // 双方相距较远（超出 range），仅可能移动，不会进入攻击分支
    state.board[0][0] = createPlayerUnit('warrior', {
      stats: makeStats({ hp: 100, attack: 18, range: 1 }),
      col: 0,
      row: 0,
    });
    state.enemyBoard[5][0] = createEnemyUnit('warrior', {
      stats: makeStats({ hp: 100, attack: 18, range: 1 }),
      col: 5,
      row: 0,
    });
    const rendererMock = createMockUnitRenderer();
    const battle = new BattleSystem(state, rendererMock as unknown as UnitRenderer);
    battle.start();

    // 连续传入非法 delta，应等价于 dt=0：不移动、不攻击、不产生 NaN
    const r1 = battle.tick(NaN);
    const r2 = battle.tick(-1);
    const r3 = battle.tick(Infinity);

    expect(r1.finished).toBe(false);
    expect(r2.finished).toBe(false);
    expect(r3.finished).toBe(false);

    const active = battle.getActiveUnits();
    expect(active.length).toBe(2);
    const player = active.find((u) => u.team === 'player')!;
    const enemy = active.find((u) => u.team === 'enemy')!;
    // dt=0 不移动，位置保持不变
    expect(player.col).toBe(0);
    expect(player.row).toBe(0);
    expect(enemy.col).toBe(5);
    expect(enemy.row).toBe(0);
    // 所有数值仍为有限数，无 NaN 污染；血量保持满血
    for (const u of active) {
      expect(Number.isFinite(u.col)).toBe(true);
      expect(Number.isFinite(u.row)).toBe(true);
      expect(Number.isFinite(u.currentHp)).toBe(true);
      expect(u.currentHp).toBe(u.stats.hp);
    }
  });

  it('getActiveUnits：返回深拷贝，修改不影响内部状态', () => {
    const state = createGameState();
    placePlayerUnits(state, [{ col: 0, row: 0 }]);
    placeEnemyUnits(state, [{ col: 1, row: 0 }]);
    const rendererMock = createMockUnitRenderer();
    const battle = new BattleSystem(state, rendererMock as unknown as UnitRenderer);
    battle.start();

    const snapshot = battle.getActiveUnits();
    expect(snapshot.length).toBe(2);
    const originalHp = snapshot[0].currentHp;
    const originalCol = snapshot[0].col;
    const originalStatsHp = snapshot[0].stats.hp;

    // 篡改快照（含嵌套 stats），验证深拷贝隔离
    snapshot[0].currentHp = 0;
    snapshot[0].col = 999;
    snapshot[0].stats.hp = 1;

    const snapshot2 = battle.getActiveUnits();
    expect(snapshot2[0].currentHp).toBe(originalHp);
    expect(snapshot2[0].col).toBe(originalCol);
    expect(snapshot2[0].stats.hp).toBe(originalStatsHp);
  });

  it('stop：调用后 tick 立即返回 { finished: true }', () => {
    const state = createGameState();
    placePlayerUnits(state, [{ col: 0, row: 0 }]);
    placeEnemyUnits(state, [{ col: 1, row: 0 }]);
    const rendererMock = createMockUnitRenderer();
    const battle = new BattleSystem(state, rendererMock as unknown as UnitRenderer);
    battle.start();

    battle.stop();
    const result = battle.tick(0.1);

    expect(result.finished).toBe(true);
    expect(result.result).toBeUndefined();
  });

  it('attackSpeed=0 防御：按 1 处理，单位仍可攻击，不产生 Infinity', () => {
    const state = createGameState();
    state.board[0][0] = createPlayerUnit('warrior', {
      stats: makeStats({ hp: 100, attack: 100, attackSpeed: 0 }),
      col: 0,
      row: 0,
    });
    state.enemyBoard[1][0] = createEnemyUnit('warrior', {
      stats: makeStats({ hp: 10, attack: 0 }),
      col: 1,
      row: 0,
    });
    const rendererMock = createMockUnitRenderer();
    const battle = new BattleSystem(state, rendererMock as unknown as UnitRenderer);
    battle.start();

    const result = tickUntilFinished(battle, 20, 0.1);

    // attackSpeed=0 不会导致 1/0=Infinity 永不攻击；玩家应正常击杀敌方获胜
    expect(result.finished).toBe(true);
    expect(result.result).toBe('player');
  });

  it('死亡单位移除：mock 的 removeUnit 被调用', () => {
    const { battle, enemyUnit, rendererMock } = setupPlayerWinBattle();
    battle.start();

    tickUntilFinished(battle, 20, 0.1);

    const removed = rendererMock.calls.filter((c) => c.method === 'removeUnit');
    expect(removed.length).toBeGreaterThan(0);
    // 敌方死亡单位的 id 应被传入 removeUnit
    expect(removed.some((c) => c.args[0] === enemyUnit.id)).toBe(true);
  });

  it('血条更新：mock 的 updateHpBar 被调用', () => {
    const { battle, playerUnit, rendererMock } = setupPlayerWinBattle();
    battle.start();

    tickUntilFinished(battle, 20, 0.1);

    const updated = rendererMock.calls.filter((c) => c.method === 'updateHpBar');
    expect(updated.length).toBeGreaterThan(0);
    // 存活的玩家单位血条应被更新
    expect(updated.some((c) => c.args[0] === playerUnit.id)).toBe(true);
  });
});
