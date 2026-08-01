import type { GameState } from './GameState';

/** 战斗结算结果 */
export interface CombatResult {
  /** 玩家本局损失的生命值 */
  hpLost: number;
  /** 本局获得的奖励金币 */
  rewardGold: number;
  /** 是否触发游戏结束 */
  gameOver: boolean;
}

/**
 * 战斗结算系统：根据战斗结果扣减玩家 HP、发放奖励金币，并判定游戏结束。
 *
 * - player 胜：不扣 HP，奖励 5 金币
 * - enemy 胜：扣 survivingEnemyCount * 2 HP，无奖励
 * - draw：扣 2 HP（小惩罚），奖励 1 金币
 *
 * 玩家 HP 归零时调用 state.gameOver()。通过持有 GameState 引用，以组合方式扩展状态层。
 */
export class CombatResolver {
  constructor(private readonly state: GameState) {}

  /**
   * 结算一场战斗。
   * @param result 战斗胜负（由 BattleSystem.tick 返回）
   * @param survivingEnemyCount 战斗结束时存活的敌方单位数（用于计算失败扣血）
   */
  resolve(
    result: 'player' | 'enemy' | 'draw',
    survivingEnemyCount: number,
  ): CombatResult {
    this.state.endBattle();

    let hpLost = 0;
    let rewardGold = 0;

    if (result === 'player') {
      hpLost = 0;
      rewardGold = 5;
    } else if (result === 'enemy') {
      // 防御性下限：避免负数存活数导致负伤害（变成加血）
      hpLost = Math.max(0, survivingEnemyCount) * 2;
      rewardGold = 0;
    } else {
      hpLost = 2;
      rewardGold = 1;
    }

    if (hpLost > 0) {
      this.state.damagePlayer(hpLost);
    }
    if (rewardGold > 0) {
      this.state.addGold(rewardGold);
    }

    const gameOver = this.state.playerHp <= 0;
    if (gameOver) {
      this.state.gameOver();
    }

    return { hpLost, rewardGold, gameOver };
  }
}
