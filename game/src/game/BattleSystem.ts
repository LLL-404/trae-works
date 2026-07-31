import type { GameState } from './GameState';
import type { UnitRenderer } from './UnitRenderer';
import type { Unit } from '../types';

/** 战斗超时时间（毫秒） */
const BATTLE_TIMEOUT_MS = 30000;

/** tick 返回结果 */
export interface BattleTickResult {
  finished: boolean;
  result?: 'player' | 'enemy' | 'draw';
}

/**
 * 战斗系统：在 GameState 之外独立维护战斗过程。
 *
 * start() 收集双方棋盘上的所有单位，深拷贝为 activeUnits 并满血开打；
 * tick(deltaSeconds) 推进一帧：寻敌、移动、按攻速攻击、死亡移除；
 * 30 秒超时或一方全灭时结束并返回胜负。
 *
 * 通过持有 GameState 与 UnitRenderer 引用，以组合方式扩展状态层与表现层。
 */
export class BattleSystem {
  private readonly state: GameState;
  private readonly unitRenderer: UnitRenderer;

  /** 战斗中的活动单位（深拷贝，独立于 GameState） */
  private activeUnits: Unit[] = [];
  /** 每个单位的攻击冷却剩余时间（秒）；<=0 表示可攻击 */
  private readonly attackCooldowns: Map<string, number> = new Map();
  /** 战斗开始时间戳（performance.now()） */
  private battleStartTime = 0;
  /** 是否正在运行 */
  private isRunning = false;

  constructor(state: GameState, unitRenderer: UnitRenderer) {
    this.state = state;
    this.unitRenderer = unitRenderer;
  }

  /** 开始战斗：调用 state.startBattle()，收集双方单位深拷贝并满血，记录开始时间 */
  start(): void {
    this.state.startBattle();

    const collected: Unit[] = [];
    // 玩家方棋盘
    for (const column of this.state.board) {
      for (const u of column) {
        if (u) collected.push(this.cloneUnit(u));
      }
    }
    // 敌方棋盘
    for (const column of this.state.enemyBoard) {
      for (const u of column) {
        if (u) collected.push(this.cloneUnit(u));
      }
    }

    // 满血开打
    for (const u of collected) {
      u.currentHp = u.stats.hp;
    }

    this.activeUnits = collected;
    this.attackCooldowns.clear();
    this.battleStartTime = performance.now();
    this.isRunning = true;
  }

  /**
   * 推进一帧战斗。
   * 对每个存活单位寻敌、移动或按攻速攻击；死亡单位从 activeUnits 移除并清理 3D 表现。
   * 一方全灭或超时（30s）时返回 finished=true 及胜负结果。
   */
  tick(deltaSeconds: number): BattleTickResult {
    if (!this.isRunning) {
      return { finished: true };
    }

    // 防御性下限：非法 delta 视为 0，避免 NaN/负数污染战斗状态
    const dt = Number.isFinite(deltaSeconds) && deltaSeconds > 0 ? deltaSeconds : 0;

    // 每个存活单位行动
    for (const unit of this.activeUnits) {
      if (unit.currentHp <= 0) continue;
      const target = this.findNearestEnemy(unit);
      if (!target) continue; // 无敌方存活，等待结束判定

      const dx = target.col - unit.col;
      const dy = target.row - unit.row;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > unit.stats.range) {
        // 向目标移动（沿归一化方向），但不越过 range 边界，避免反复横跳
        const moveAmount = unit.stats.moveSpeed * dt;
        const moveDistance = Math.min(moveAmount, dist - unit.stats.range);
        if (moveDistance > 0) {
          unit.col += (dx / dist) * moveDistance;
          unit.row += (dy / dist) * moveDistance;
        }
        this.unitRenderer.moveUnit(unit.id, unit.col, unit.row);
      } else {
        // 在攻击范围内：按 attackSpeed 累积攻击间隔
        // 防御性下限：attackSpeed <= 0 时视为 1，避免 1/0 = Infinity 永不攻击
        const speed = unit.stats.attackSpeed > 0 ? unit.stats.attackSpeed : 1;
        let cooldown = this.attackCooldowns.get(unit.id) ?? 0;
        cooldown -= dt;
        if (cooldown <= 0) {
          target.currentHp -= unit.stats.attack;
          cooldown = 1 / speed;
        }
        this.attackCooldowns.set(unit.id, cooldown);
      }
    }

    // 移除死亡单位：仅死亡单位移除 3D 表现，存活单位保留并同步血条
    const survivors: Unit[] = [];
    for (const unit of this.activeUnits) {
      if (unit.currentHp <= 0) {
        this.unitRenderer.removeUnit(unit.id);
        this.attackCooldowns.delete(unit.id);
      } else {
        this.unitRenderer.updateHpBar(
          unit.id,
          unit.currentHp / unit.stats.hp,
        );
        survivors.push(unit);
      }
    }
    this.activeUnits = survivors;

    const playerCount = this.activeUnits.filter(
      (u) => u.team === 'player',
    ).length;
    const enemyCount = this.activeUnits.filter(
      (u) => u.team === 'enemy',
    ).length;

    // 结束条件：一方全灭
    if (playerCount === 0 || enemyCount === 0) {
      this.isRunning = false;
      if (playerCount === 0 && enemyCount === 0) {
        return { finished: true, result: 'draw' };
      }
      if (playerCount === 0) {
        return { finished: true, result: 'enemy' };
      }
      return { finished: true, result: 'player' };
    }

    // 结束条件：超时（按存活单位数多者胜，相同为平局）
    if (performance.now() - this.battleStartTime >= BATTLE_TIMEOUT_MS) {
      this.isRunning = false;
      if (playerCount > enemyCount) {
        return { finished: true, result: 'player' };
      }
      if (enemyCount > playerCount) {
        return { finished: true, result: 'enemy' };
      }
      return { finished: true, result: 'draw' };
    }

    return { finished: false };
  }

  /** 返回当前 activeUnits 的深拷贝副本 */
  getActiveUnits(): Unit[] {
    return this.activeUnits.map((u) => this.cloneUnit(u));
  }

  /** 返回战斗已用时间比例（0-1），未运行时返回 0 */
  getElapsedRatio(): number {
    if (!this.isRunning) return 0;
    const elapsed = performance.now() - this.battleStartTime;
    const ratio = elapsed / BATTLE_TIMEOUT_MS;
    if (ratio < 0) return 0;
    if (ratio > 1) return 1;
    return ratio;
  }

  /** 强制结束战斗 */
  stop(): void {
    this.isRunning = false;
  }

  /** 深拷贝单位（Unit 为纯数据结构，无循环引用） */
  private cloneUnit(unit: Unit): Unit {
    return JSON.parse(JSON.stringify(unit)) as Unit;
  }

  /** 寻找最近的敌方存活单位（欧氏距离，按 col/row 计算） */
  private findNearestEnemy(unit: Unit): Unit | null {
    let nearest: Unit | null = null;
    let nearestDist = Infinity;
    for (const other of this.activeUnits) {
      if (other.team === unit.team) continue;
      if (other.currentHp <= 0) continue;
      const dx = other.col - unit.col;
      const dy = other.row - unit.row;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = other;
      }
    }
    return nearest;
  }
}
