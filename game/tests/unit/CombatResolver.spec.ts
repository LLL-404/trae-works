import { describe, it, expect, beforeEach } from 'vitest';
import { CombatResolver } from '../../src/game/CombatResolver';
import type { GameState } from '../../src/game/GameState';
import { createGameState } from './helpers';

describe('CombatResolver', () => {
  let state: GameState;
  let resolver: CombatResolver;

  beforeEach(() => {
    // 每个用例独立的状态与结算器，初始 playerHp=100、gold=5
    state = createGameState();
    resolver = new CombatResolver(state);
  });

  it("resolve 'player' 胜：hpLost=0、rewardGold=5、gold +5、gameOver=false", () => {
    const goldBefore = state.gold;
    const hpBefore = state.playerHp;

    const result = resolver.resolve('player', 3);

    expect(result.hpLost).toBe(0);
    expect(result.rewardGold).toBe(5);
    expect(result.gameOver).toBe(false);
    // 玩家胜不扣血、奖励 5 金币
    expect(state.playerHp).toBe(hpBefore);
    expect(state.gold).toBe(goldBefore + 5);
  });

  it("resolve 'enemy' 败：hpLost = survivingEnemyCount * 2、rewardGold=0、playerHp 减少、gameOver 仅当 playerHp<=0", () => {
    const hpBefore = state.playerHp;
    const goldBefore = state.gold;
    const surviving = 3;

    const result = resolver.resolve('enemy', surviving);

    expect(result.hpLost).toBe(surviving * 2);
    expect(result.rewardGold).toBe(0);
    // 100 - 6 = 94，未归零 → 不触发 gameOver
    expect(result.gameOver).toBe(false);
    expect(state.playerHp).toBe(hpBefore - surviving * 2);
    expect(state.gold).toBe(goldBefore);
  });

  it("resolve 'draw' 平：hpLost=2、rewardGold=1", () => {
    const hpBefore = state.playerHp;
    const goldBefore = state.gold;

    const result = resolver.resolve('draw', 0);

    expect(result.hpLost).toBe(2);
    expect(result.rewardGold).toBe(1);
    expect(result.gameOver).toBe(false);
    expect(state.playerHp).toBe(hpBefore - 2);
    expect(state.gold).toBe(goldBefore + 1);
  });

  it('resolve survivingEnemyCount=0 时 enemy 胜：hpLost=0（防御性 max(0, ...)）', () => {
    const hpBefore = state.playerHp;

    const result = resolver.resolve('enemy', 0);

    // max(0, 0) * 2 = 0，不扣血
    expect(result.hpLost).toBe(0);
    expect(result.rewardGold).toBe(0);
    expect(result.gameOver).toBe(false);
    expect(state.playerHp).toBe(hpBefore);
  });

  it('resolve survivingEnemyCount 负数：hpLost=0（防御性，不变成加血）', () => {
    const hpBefore = state.playerHp;

    const result = resolver.resolve('enemy', -5);

    // max(0, -5) * 2 = 0，负数存活数不应导致加血
    expect(result.hpLost).toBe(0);
    expect(result.rewardGold).toBe(0);
    expect(result.gameOver).toBe(false);
    expect(state.playerHp).toBe(hpBefore);
  });

  it('resolve 触发 gameOver：playerHp 归零 → gameOver=true、phase=gameover', () => {
    // 初始 playerHp=100，手动调到 2，使一次 enemy 胜利（surviving=2 → hpLost=4）即可归零
    state.playerHp = 2;

    const result = resolver.resolve('enemy', 2);

    expect(result.hpLost).toBe(4);
    expect(result.gameOver).toBe(true);
    expect(state.playerHp).toBe(0);
    expect(state.phase).toBe('gameover');
  });

  it('多次 resolve 不互相干扰', () => {
    // 初始：playerHp=100, gold=5

    // 第一次：玩家胜 → gold +5 = 10，hp 不变
    let r = resolver.resolve('player', 0);
    expect(r.hpLost).toBe(0);
    expect(r.rewardGold).toBe(5);
    expect(r.gameOver).toBe(false);
    expect(state.gold).toBe(10);
    expect(state.playerHp).toBe(100);

    // 第二次：敌方胜 surviving=2 → hp -4 = 96，gold 不变
    r = resolver.resolve('enemy', 2);
    expect(r.hpLost).toBe(4);
    expect(r.rewardGold).toBe(0);
    expect(r.gameOver).toBe(false);
    expect(state.gold).toBe(10);
    expect(state.playerHp).toBe(96);

    // 第三次：平局 → hp -2 = 94，gold +1 = 11
    r = resolver.resolve('draw', 0);
    expect(r.hpLost).toBe(2);
    expect(r.rewardGold).toBe(1);
    expect(r.gameOver).toBe(false);
    expect(state.gold).toBe(11);
    expect(state.playerHp).toBe(94);
  });
});
