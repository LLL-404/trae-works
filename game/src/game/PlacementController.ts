import type { GameState } from './GameState';
import type { UnitRenderer } from './UnitRenderer';
import type { BoardRenderer } from './BoardRenderer';
import { BOARD_COLS, BOARD_ROWS } from '../types';

/** 选中单位来源 */
type SelectionSource = 'bench' | 'board';

/**
 * 单位放置与备战区交互控制器。
 *
 * 维护当前选中单位，处理备战区 ↔ 棋盘之间的单位移动。
 * 玩家区为 row 0 与 row 1；row 2-3 为敌方区，禁止放置。
 * 通过持有 GameState / UnitRenderer 引用，以组合方式扩展。
 *
 * BoardRenderer 在构造函数中接收（满足依赖注入契约），当前任务的方法集
 * 暂未用到其高亮能力，故以下划线前缀保留不存储，供后续任务扩展。
 *
 * 说明：备战区单位不渲染在 3D 场景，仅由状态层维护、UI 显示；
 * 因此选中备战单位时 setSelected 为空操作（UnitRenderer 内部安全跳过），
 * 撤回单位到备战区时调用 removeUnit 清理 3D 表示。
 */
export class PlacementController {
  /** 当前选中的单位 ID（null 表示未选中） */
  selectedUnitId: string | null = null;

  private source: SelectionSource | null = null;
  /** 选中来源为 bench 时的备战区索引 */
  private benchIndex = -1;
  /** 选中来源为 board 时的源列 */
  private selCol = -1;
  /** 选中来源为 board 时的源行 */
  private selRow = -1;

  constructor(
    private readonly state: GameState,
    private readonly unitRenderer: UnitRenderer,
    _boardRenderer: BoardRenderer,
  ) {}

  /** 是否已有选中单位 */
  hasSelected(): boolean {
    return this.selectedUnitId !== null;
  }

  /**
   * 选中备战区指定位置的单位。
   * @returns 选中成功返回 true；位置为空返回 false
   */
  selectBenchUnit(benchIndex: number): boolean {
    const unit = this.state.bench[benchIndex];
    if (!unit) return false;
    this.clearSelectionHighlight();
    this.selectedUnitId = unit.id;
    this.source = 'bench';
    this.benchIndex = benchIndex;
    this.selCol = -1;
    this.selRow = -1;
    this.unitRenderer.setSelected(unit.id, true);
    return true;
  }

  /**
   * 选中棋盘指定格子上的玩家方单位。
   * @returns 选中成功返回 true；格子为空或非玩家方返回 false
   */
  selectBoardUnit(col: number, row: number): boolean {
    const unit = this.state.board[col]?.[row];
    if (!unit || unit.team !== 'player') return false;
    this.clearSelectionHighlight();
    this.selectedUnitId = unit.id;
    this.source = 'board';
    this.benchIndex = -1;
    this.selCol = col;
    this.selRow = row;
    this.unitRenderer.setSelected(unit.id, true);
    return true;
  }

  /** 清除当前选中状态 */
  deselect(): void {
    if (this.selectedUnitId) {
      this.unitRenderer.setSelected(this.selectedUnitId, false);
    }
    this.selectedUnitId = null;
    this.source = null;
    this.benchIndex = -1;
    this.selCol = -1;
    this.selRow = -1;
  }

  /**
   * 将当前选中单位放置到玩家区指定格子。
   *
   * 约束：
   * - 仅允许放置在玩家区（row 0 或 1）
   * - 目标格子必须为空
   * - 来自备战区：从 bench 移除 → placeUnitOnBoard → 渲染
   * - 来自棋盘：moveUnitOnBoard → 移动渲染
   *
   * @returns 放置成功返回 true；否则 false（保持选中状态由调用方决定）
   */
  placeSelected(col: number, row: number): boolean {
    const id = this.selectedUnitId;
    const source = this.source;
    if (!id || source === null) return false;

    // 仅允许放置在玩家区
    if (row !== 0 && row !== 1) return false;
    // 边界校验
    if (col < 0 || col >= BOARD_COLS) return false;
    if (row < 0 || row >= BOARD_ROWS) return false;
    // 目标格子必须为空
    if (this.state.board[col][row] !== null) return false;

    if (source === 'bench') {
      const unit = this.state.bench[this.benchIndex];
      if (!unit) return false;
      this.state.removeFromBench(this.benchIndex);
      this.state.placeUnitOnBoard(unit, col, row);
      this.unitRenderer.placeUnit(unit);
      this.deselect();
      return true;
    }

    // source === 'board'
    this.state.moveUnitOnBoard(this.selCol, this.selRow, col, row);
    this.unitRenderer.moveUnit(id, col, row);
    this.deselect();
    return true;
  }

  /**
   * 将棋盘指定格子上的玩家方单位撤回备战区第一个空位。
   *
   * 备战区满则返回 false。撤回后该单位从 3D 场景移除（备战区不渲染）。
   * @returns 撤回成功返回 true；否则 false
   */
  recallFromBoard(col: number, row: number): boolean {
    const unit = this.state.board[col]?.[row];
    if (!unit || unit.team !== 'player') return false;
    // 备战区需有空位
    if (this.state.bench.indexOf(null) < 0) return false;

    this.state.removeUnitFromBoard(col, row);
    this.state.addToBench(unit);
    this.unitRenderer.removeUnit(unit.id);

    // 若撤回的正是当前选中单位，清除选中
    if (this.selectedUnitId === unit.id) {
      this.deselect();
    }
    return true;
  }

  /** 清除上一个选中单位的高亮（不重置选中状态字段） */
  private clearSelectionHighlight(): void {
    if (this.selectedUnitId) {
      this.unitRenderer.setSelected(this.selectedUnitId, false);
    }
  }
}
