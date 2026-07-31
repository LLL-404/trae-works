import { describe, it, expect, beforeEach } from 'vitest';
import { RogueProgression } from '../../src/game/RogueProgression';
import { GameState } from '../../src/game/GameState';
import { UNIT_DEFINITIONS, UNIT_TYPES } from '../../src/data/units';
import { AugmentId } from '../../src/types';
import { createGameState } from './helpers';

describe('RogueProgression', () => {
  let state: GameState;
  let prog: RogueProgression;

  beforeEach(() => {
    state = createGameState();
    prog = new RogueProgression(state);
  });

  describe('getEnemyCount', () => {
    // 数量公式：3 + floor(round / 2)，上限 12；非法 round 按 1 处理
    it('round=1 → 3', () => {
      expect(prog.getEnemyCount(1)).toBe(3);
    });

    it('round=2 → 4', () => {
      expect(prog.getEnemyCount(2)).toBe(4);
    });

    it('round=10 → 8', () => {
      expect(prog.getEnemyCount(10)).toBe(8);
    });

    it('round=20 → 13 → 上限 12（max 限制）', () => {
      // 3 + floor(20/2) = 13，但被 MAX_ENEMY_COUNT=12 截断
      expect(prog.getEnemyCount(20)).toBe(12);
    });

    it('round=0 → 按 1 处理 → 3', () => {
      expect(prog.getEnemyCount(0)).toBe(3);
    });

    it('round 为负数 → 按 1 处理 → 3', () => {
      expect(prog.getEnemyCount(-5)).toBe(3);
    });

    it('round 为 NaN → 按 1 处理 → 3', () => {
      expect(prog.getEnemyCount(NaN)).toBe(3);
    });
  });

  describe('getEnemyStatMultiplier', () => {
    // 倍率公式：1 + (round - 1) * 0.1；非法 round 按 1 处理
    it('round=1 → 1.0', () => {
      expect(prog.getEnemyStatMultiplier(1)).toBeCloseTo(1.0);
    });

    it('round=2 → 1.1', () => {
      expect(prog.getEnemyStatMultiplier(2)).toBeCloseTo(1.1);
    });

    it('round=11 → 2.0', () => {
      expect(prog.getEnemyStatMultiplier(11)).toBeCloseTo(2.0);
    });

    it('round 为负数 → 按 1 处理 → 1.0', () => {
      expect(prog.getEnemyStatMultiplier(-5)).toBeCloseTo(1.0);
    });

    it('round 为 NaN → 按 1 处理 → 1.0', () => {
      expect(prog.getEnemyStatMultiplier(NaN)).toBeCloseTo(1.0);
    });
  });

  describe('generateEnemyLineup', () => {
    // 选用 round=5：count = 3 + floor(5/2) = 5，mult = 1 + 4*0.1 = 1.4
    const round = 5;

    it('返回数量等于 getEnemyCount(round)', () => {
      const lineup = prog.generateEnemyLineup(round);
      expect(lineup).toHaveLength(prog.getEnemyCount(round));
    });

    it('所有单位 team=enemy', () => {
      const lineup = prog.generateEnemyLineup(round);
      for (const u of lineup) {
        expect(u.team).toBe('enemy');
      }
    });

    it('所有单位 hp = UNIT_DEFINITIONS[type].hp * mult', () => {
      const lineup = prog.generateEnemyLineup(round);
      const mult = prog.getEnemyStatMultiplier(round);
      for (const u of lineup) {
        expect(u.stats.hp).toBeCloseTo(UNIT_DEFINITIONS[u.type].hp * mult);
      }
    });

    it('所有单位 attack = UNIT_DEFINITIONS[type].attack * mult', () => {
      const lineup = prog.generateEnemyLineup(round);
      const mult = prog.getEnemyStatMultiplier(round);
      for (const u of lineup) {
        expect(u.stats.attack).toBeCloseTo(UNIT_DEFINITIONS[u.type].attack * mult);
      }
    });

    it('所有单位 attackSpeed/moveSpeed/range 不变（不乘倍率）', () => {
      const lineup = prog.generateEnemyLineup(round);
      for (const u of lineup) {
        const def = UNIT_DEFINITIONS[u.type];
        expect(u.stats.attackSpeed).toBe(def.attackSpeed);
        expect(u.stats.moveSpeed).toBe(def.moveSpeed);
        expect(u.stats.range).toBe(def.range);
      }
    });

    it('所有单位 col 在 [0,5]、row 在 [2,3]', () => {
      const lineup = prog.generateEnemyLineup(round);
      for (const u of lineup) {
        expect(u.col).toBeGreaterThanOrEqual(0);
        expect(u.col).toBeLessThanOrEqual(5);
        expect(u.row).toBeGreaterThanOrEqual(2);
        expect(u.row).toBeLessThanOrEqual(3);
      }
    });

    it('所有单位位置不重叠（col/row 对唯一）', () => {
      const lineup = prog.generateEnemyLineup(round);
      const keys = new Set<string>();
      for (const u of lineup) {
        const key = `${u.col},${u.row}`;
        expect(keys.has(key)).toBe(false);
        keys.add(key);
      }
    });

    it('所有单位 currentHp = stats.hp', () => {
      const lineup = prog.generateEnemyLineup(round);
      for (const u of lineup) {
        expect(u.currentHp).toBe(u.stats.hp);
      }
    });

    it('id 格式为 enemy-{round}-{i}', () => {
      const lineup = prog.generateEnemyLineup(round);
      for (let i = 0; i < lineup.length; i++) {
        expect(lineup[i].id).toBe(`enemy-${round}-${i}`);
      }
    });

    it('生成的单位类型均来自 UNIT_TYPES', () => {
      const lineup = prog.generateEnemyLineup(round);
      for (const u of lineup) {
        expect(UNIT_TYPES).toContain(u.type);
      }
    });

    it('上限回合（round=20）生成 12 个单位且位置不重叠', () => {
      // 12 个单位正好填满敌方区 12 格，验证不重叠更严格
      const lineup = prog.generateEnemyLineup(20);
      expect(lineup).toHaveLength(12);
      const keys = new Set<string>();
      for (const u of lineup) {
        const key = `${u.col},${u.row}`;
        expect(keys.has(key)).toBe(false);
        keys.add(key);
      }
    });
  });

  describe('proceedToNextRound', () => {
    it('调用后 state.round + 1、phase=prep', () => {
      state.round = 3;
      state.phase = 'battle';
      prog.proceedToNextRound();
      expect(state.round).toBe(4);
      expect(state.phase).toBe('prep');
    });
  });

  describe('startNewRun', () => {
    it('调用后 state 完全重置', () => {
      // 先污染状态
      state.round = 7;
      state.phase = 'gameover';
      state.playerHp = 30;
      state.gold = 100;
      state.augments.push(AugmentId.AtkBoost);
      state.augments.push(AugmentId.HpBoost);

      prog.startNewRun();

      expect(state.round).toBe(1);
      expect(state.phase).toBe('prep');
      expect(state.playerHp).toBe(100);
      expect(state.gold).toBe(5);
      expect(state.augments).toEqual([]);
    });
  });
});
