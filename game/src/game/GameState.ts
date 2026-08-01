import type {
  GameState as GameStateModel,
  GamePhase,
  Unit,
  UnitType,
  ShopSlot,
  AugmentId,
  HexAugment,
  Board,
} from '../types';
import { BOARD_COLS, BOARD_ROWS, BENCH_SIZE, SHOP_SIZE } from '../types';

/** 状态变更监听器，接收深拷贝快照 */
type GameStateListener = (state: GameStateModel) => void;

/** 创建 6 列 × 4 行的空棋盘 */
function createEmptyBoard(): Board {
  const board: Board = [];
  for (let col = 0; col < BOARD_COLS; col++) {
    const column: (Unit | null)[] = [];
    for (let row = 0; row < BOARD_ROWS; row++) {
      column.push(null);
    }
    board.push(column);
  }
  return board;
}

/** 创建 SHOP_SIZE 个空商店槽位 */
function createEmptyShop(): ShopSlot[] {
  const shop: ShopSlot[] = [];
  for (let i = 0; i < SHOP_SIZE; i++) {
    shop.push({ index: i, unitType: null, sold: false });
  }
  return shop;
}

/**
 * 游戏状态管理：实现 types.ts 中的 GameState 接口。
 * 负责阶段切换与所有状态变更，并通过 subscribe 通知外部 UI/3D 层。
 */
export class GameState implements GameStateModel {
  round: number = 1;
  phase: GamePhase = 'prep';
  playerHp: number = 100;
  gold: number = 5;
  shop: ShopSlot[] = createEmptyShop();
  bench: (Unit | null)[] = new Array(BENCH_SIZE).fill(null);
  board: Board = createEmptyBoard();
  enemyBoard: Board = createEmptyBoard();
  augments: AugmentId[] = [];
  pendingAugmentChoices: HexAugment[] = [];

  private listeners: GameStateListener[] = [];

  /** 订阅状态变更，返回取消订阅函数 */
  subscribe(listener: GameStateListener): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx >= 0) { this.listeners.splice(idx, 1); }
    };
  }

  /** 通知所有监听器（传入深拷贝快照，防止外部直接修改） */
  notify(): void {
    const snapshot = this.toSnapshot();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  // ===== 阶段切换 =====

  startBattle(): void {
    this.phase = 'battle';
    this.notify();
  }

  endBattle(): void {
    this.phase = 'settle';
    this.notify();
  }

  showAugmentChoices(choices: HexAugment[]): void {
    this.pendingAugmentChoices = choices;
    this.phase = 'augment';
    this.notify();
  }

  nextRound(): void {
    this.round += 1;
    this.phase = 'prep';
    this.notify();
  }

  gameOver(): void {
    this.phase = 'gameover';
    this.notify();
  }

  // ===== 操作方法 =====

  addGold(amount: number): void {
    if (!Number.isFinite(amount) || amount === 0) { return; }
    this.gold = Math.max(0, this.gold + amount);
    this.notify();
  }

  /** 消费金币，不足或非法金额返回 false 且不变更状态 */
  spendGold(amount: number): boolean {
    if (!Number.isFinite(amount) || amount < 0) { return false; }
    if (this.gold < amount) { return false; }
    this.gold -= amount;
    this.notify();
    return true;
  }

  damagePlayer(amount: number): void {
    if (!Number.isFinite(amount) || amount <= 0) { return; }
    this.playerHp = Math.max(0, this.playerHp - amount);
    this.notify();
  }

  /** 棋盘坐标合法性校验（内部使用） */
  private isInsideBoard(col: number, row: number): boolean {
    return (
      Number.isInteger(col) &&
      Number.isInteger(row) &&
      col >= 0 &&
      col < BOARD_COLS &&
      row >= 0 &&
      row < BOARD_ROWS
    );
  }

  placeUnitOnBoard(unit: Unit, col: number, row: number): void {
    if (!this.isInsideBoard(col, row)) { return; }
    this.board[col][row] = unit;
    unit.col = col;
    unit.row = row;
    this.notify();
  }

  removeUnitFromBoard(col: number, row: number): void {
    if (!this.isInsideBoard(col, row)) { return; }
    const u = this.board[col][row];
    this.board[col][row] = null;
    if (u) {
      u.col = -1;
      u.row = -1;
    }
    this.notify();
  }

  moveUnitOnBoard(
    fromCol: number,
    fromRow: number,
    toCol: number,
    toRow: number,
  ): void {
    if (!this.isInsideBoard(fromCol, fromRow)) { return; }
    if (!this.isInsideBoard(toCol, toRow)) { return; }
    const u = this.board[fromCol][fromRow];
    if (!u) { return; } // 源格子无单位，无操作
    this.board[fromCol][fromRow] = null;
    this.board[toCol][toRow] = u;
    u.col = toCol;
    u.row = toRow;
    this.notify();
  }

  /** 加入备战区，满则返回 false */
  addToBench(unit: Unit): boolean {
    const idx = this.bench.indexOf(null);
    if (idx < 0) { return false; }
    this.bench[idx] = unit;
    unit.col = -1;
    unit.row = -1;
    this.notify();
    return true;
  }

  removeFromBench(index: number): void {
    if (index < 0 || index >= this.bench.length) { return; }
    const u = this.bench[index];
    this.bench[index] = null;
    if (u) {
      u.col = -1;
      u.row = -1;
    }
    this.notify();
  }

  /** 用 5 个 UnitType 刷新商店 */
  refreshShop(units: UnitType[]): void {
    for (let i = 0; i < SHOP_SIZE; i++) {
      this.shop[i] = { index: i, unitType: units[i] ?? null, sold: false };
    }
    this.notify();
  }

  /** 购买商店槽位，返回该槽快照；不可购买返回 null */
  buyFromShop(index: number): ShopSlot | null {
    const slot = this.shop[index];
    if (!slot || slot.sold || slot.unitType === null) { return null; }
    slot.sold = true;
    this.notify();
    return { ...slot };
  }

  addAugment(id: AugmentId): void {
    this.augments.push(id);
    this.notify();
  }

  /** 重置所有状态回到第 1 回合 */
  reset(): void {
    this.round = 1;
    this.phase = 'prep';
    this.playerHp = 100;
    this.gold = 5;
    this.shop = createEmptyShop();
    this.bench = new Array(BENCH_SIZE).fill(null);
    this.board = createEmptyBoard();
    this.enemyBoard = createEmptyBoard();
    this.augments = [];
    this.pendingAugmentChoices = [];
    this.notify();
  }

  /** 返回当前状态的深拷贝快照 */
  toSnapshot(): GameStateModel {
    return JSON.parse(
      JSON.stringify({
        round: this.round,
        phase: this.phase,
        playerHp: this.playerHp,
        gold: this.gold,
        shop: this.shop,
        bench: this.bench,
        board: this.board,
        enemyBoard: this.enemyBoard,
        augments: this.augments,
        pendingAugmentChoices: this.pendingAugmentChoices,
      }),
    ) as GameStateModel;
  }
}
