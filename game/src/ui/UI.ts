import type { GameState } from '../game/GameState';
import type {
  AugmentId,
  GameState as GameStateModel,
  GamePhase,
  HexAugment,
  ShopSlot,
  Unit,
} from '../types';
import { BENCH_SIZE, SHOP_SIZE } from '../types';
import { UNIT_DEFINITIONS } from '../data/units';
import { AUGMENT_DEFINITIONS } from '../data/augments';
import { REFRESH_COST, UNIT_COST } from '../game/EconomySystem';

/** 阶段中文标签 */
const PHASE_LABELS: Record<GamePhase, string> = {
  prep: '准备阶段',
  battle: '战斗中',
  settle: '结算中',
  augment: '强化选择',
  gameover: '游戏结束',
};

/**
 * 纯 HTML/CSS/JS 实现的 UI 层。
 *
 * 负责渲染 HUD、商店、备战区、按钮、强化面板、游戏结束面板与 toast 提示。
 * 通过 bind(state) 订阅 GameState 快照自动刷新；通过回调属性将用户操作交给 main.ts。
 * 棋盘格点击由 main.ts 的 raycaster 处理，通过 onSelectBoard / onPlaceAt / onRecall 回调上抛。
 */
export class UI {
  // ===== 回调（由 main.ts 注册） =====
  onBuy: (index: number) => void = () => {};
  onRefresh: () => void = () => {};
  onStartBattle: () => void = () => {};
  onSelectBench: (index: number) => void = () => {};
  onSelectBoard: (col: number, row: number) => void = () => {};
  onPlaceAt: (col: number, row: number) => void = () => {};
  onRecall: (col: number, row: number) => void = () => {};
  onChooseAugment: (id: AugmentId) => void = () => {};
  onRestart: () => void = () => {};

  // ===== DOM 引用 =====
  private readonly hudGold: HTMLSpanElement;
  private readonly hudHp: HTMLSpanElement;
  private readonly hudRound: HTMLSpanElement;
  private readonly hudPhase: HTMLSpanElement;
  private readonly shopEl: HTMLDivElement;
  private readonly benchEl: HTMLDivElement;
  private readonly refreshBtn: HTMLButtonElement;
  private readonly battleBtn: HTMLButtonElement;
  private readonly augmentPanel: HTMLDivElement;
  private readonly augmentCards: HTMLDivElement;
  private readonly gameoverPanel: HTMLDivElement;
  private readonly toastEl: HTMLDivElement;
  private readonly battleProgressEl: HTMLDivElement;
  private readonly battleProgressBar: HTMLDivElement;
  private readonly augmentListEl: HTMLDivElement;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  private lastBench: (Unit | null)[] = [];
  private selectedBenchIndex: number | null = null;

  constructor() {
    const root = document.createElement('div');
    root.id = 'ui-root';

    // ----- HUD -----
    const hud = document.createElement('div');
    hud.id = 'hud';
    this.hudGold = document.createElement('span');
    this.hudHp = document.createElement('span');
    this.hudRound = document.createElement('span');
    this.hudPhase = document.createElement('span');
    hud.append(this.hudGold, this.hudHp, this.hudRound, this.hudPhase);
    root.appendChild(hud);

    // ----- 战斗进度条（仅 battle 阶段显示） -----
    this.battleProgressEl = document.createElement('div');
    this.battleProgressEl.id = 'battle-progress';
    this.battleProgressEl.className = 'hidden';
    this.battleProgressBar = document.createElement('div');
    this.battleProgressBar.id = 'battle-progress-bar';
    this.battleProgressEl.appendChild(this.battleProgressBar);
    root.appendChild(this.battleProgressEl);

    // ----- 已选强化列表 -----
    this.augmentListEl = document.createElement('div');
    this.augmentListEl.id = 'augment-list';
    root.appendChild(this.augmentListEl);

    // ----- 底部栏 -----
    const bottom = document.createElement('div');
    bottom.id = 'bottom-bar';

    const shopWrap = document.createElement('div');
    shopWrap.id = 'shop-wrap';
    const shopTitle = document.createElement('div');
    shopTitle.className = 'bar-title';
    shopTitle.textContent = '商店';
    this.shopEl = document.createElement('div');
    this.shopEl.id = 'shop';
    shopWrap.append(shopTitle, this.shopEl);

    const benchWrap = document.createElement('div');
    benchWrap.id = 'bench-wrap';
    const benchTitle = document.createElement('div');
    benchTitle.className = 'bar-title';
    benchTitle.textContent = '备战区';
    this.benchEl = document.createElement('div');
    this.benchEl.id = 'bench';
    benchWrap.append(benchTitle, this.benchEl);

    const btnWrap = document.createElement('div');
    btnWrap.id = 'btn-wrap';
    this.refreshBtn = document.createElement('button');
    this.refreshBtn.id = 'refresh-btn';
    this.refreshBtn.textContent = `刷新 (${REFRESH_COST}金)`;
    this.refreshBtn.addEventListener('click', () => this.onRefresh());
    this.battleBtn = document.createElement('button');
    this.battleBtn.id = 'battle-btn';
    this.battleBtn.textContent = '开始战斗';
    this.battleBtn.addEventListener('click', () => this.onStartBattle());
    btnWrap.append(this.refreshBtn, this.battleBtn);

    bottom.append(shopWrap, benchWrap, btnWrap);
    root.appendChild(bottom);

    // ----- 强化选择面板 -----
    this.augmentPanel = document.createElement('div');
    this.augmentPanel.id = 'augment-panel';
    this.augmentPanel.className = 'overlay hidden';
    const augTitle = document.createElement('h2');
    augTitle.textContent = '选择一项强化';
    this.augmentCards = document.createElement('div');
    this.augmentCards.id = 'augment-cards';
    this.augmentPanel.append(augTitle, this.augmentCards);
    root.appendChild(this.augmentPanel);

    // ----- 游戏结束面板 -----
    this.gameoverPanel = document.createElement('div');
    this.gameoverPanel.id = 'gameover-panel';
    this.gameoverPanel.className = 'overlay hidden';
    const goTitle = document.createElement('h2');
    goTitle.textContent = '游戏结束';
    const restartBtn = document.createElement('button');
    restartBtn.textContent = '重新开始';
    restartBtn.addEventListener('click', () => this.onRestart());
    this.gameoverPanel.append(goTitle, restartBtn);
    root.appendChild(this.gameoverPanel);

    // ----- Toast -----
    this.toastEl = document.createElement('div');
    this.toastEl.id = 'toast';
    this.toastEl.className = 'hidden';
    root.appendChild(this.toastEl);

    document.body.appendChild(root);
  }

  // ===== 订阅状态，自动刷新 =====
  bind(state: GameState): void {
    state.subscribe((snap) => this.onStateChange(snap));
  }

  private onStateChange(snap: GameStateModel): void {
    this.updateHUD(snap);
    this.updateShop(snap.shop);
    this.updateBench(snap.bench);
    this.setPhase(snap.phase);
    this.updateAugmentList(snap.augments);
    // 强化面板：仅在 augment 阶段且有选项时显示
    if (snap.phase === 'augment' && snap.pendingAugmentChoices.length > 0) {
      this.showAugmentChoices(snap.pendingAugmentChoices);
    } else if (snap.phase !== 'augment') {
      this.hideAugmentPanel();
    }
    // 游戏结束面板
    if (snap.phase === 'gameover') {
      this.showGameOver();
    } else {
      this.hideGameOverPanel();
    }
  }

  // ===== 公开 API =====
  updateHUD(state: GameStateModel): void {
    this.hudGold.textContent = `金币: ${state.gold}`;
    this.hudHp.textContent = `HP: ${state.playerHp}`;
    this.hudRound.textContent = `回合: ${state.round}`;
    this.hudPhase.textContent = `阶段: ${PHASE_LABELS[state.phase]}`;
    // HP 低警告：playerHp <= 20 时 HP 文字变红并闪烁
    this.hudHp.classList.toggle('hp-low', state.playerHp <= 20);
  }

  /** 更新战斗进度条（ratio: 0-1，1=满=刚开始，0=空=时间到） */
  updateBattleProgress(ratio: number): void {
    const clamped = ratio < 0 ? 0 : ratio > 1 ? 1 : ratio;
    this.battleProgressBar.style.width = `${clamped * 100}%`;
  }

  updateShop(shop: ShopSlot[]): void {
    this.shopEl.innerHTML = '';
    for (let i = 0; i < SHOP_SIZE; i++) {
      const slot = shop[i];
      const el = document.createElement('div');
      el.className = 'shop-slot';
      if (!slot || slot.sold || slot.unitType === null) {
        el.classList.add('empty');
        el.textContent = slot?.sold ? '已售出' : '空';
      } else {
        const def = UNIT_DEFINITIONS[slot.unitType];
        const color = document.createElement('span');
        color.className = 'unit-color';
        color.style.background = def.color;
        const name = document.createElement('span');
        name.textContent = def.name;
        const stats = document.createElement('span');
        stats.className = 'unit-stats';
        stats.textContent = `HP${def.hp} 攻${def.attack} 速${def.attackSpeed}`;
        const price = document.createElement('span');
        price.className = 'price';
        price.textContent = `${UNIT_COST}金`;
        el.append(color, name, stats, price);
        el.title = `${def.name} — 生命 ${def.hp} / 攻击 ${def.attack} / 攻速 ${def.attackSpeed} / 移速 ${def.moveSpeed} / 范围 ${def.range}`;
        const idx = i;
        el.addEventListener('click', () => this.onBuy(idx));
      }
      this.shopEl.appendChild(el);
    }
  }

  updateBench(bench: (Unit | null)[]): void {
    this.lastBench = bench;
    this.renderBench();
  }

  /** 设置备战区选中索引（null 表示取消），由 main.ts 同步调用 */
  setBenchSelection(index: number | null): void {
    this.selectedBenchIndex = index;
    this.renderBench();
  }

  /** 清除备战区选中状态 */
  clearBenchSelection(): void {
    this.selectedBenchIndex = null;
    this.renderBench();
  }

  setPhase(phase: GamePhase): void {
    this.hudPhase.textContent = `阶段: ${PHASE_LABELS[phase]}`;
    const isPrep = phase === 'prep';
    const isBattle = phase === 'battle';
    // 战斗按钮仅在 prep 阶段显示
    this.battleBtn.style.display = isPrep ? '' : 'none';
    this.battleBtn.disabled = !isPrep;
    // 非 prep 阶段禁用商店与备战区交互
    this.refreshBtn.disabled = !isPrep;
    this.shopEl.classList.toggle('disabled', !isPrep);
    this.benchEl.classList.toggle('disabled', !isPrep);
    // 战斗进度条仅在 battle 阶段显示
    this.battleProgressEl.classList.toggle('hidden', !isBattle);
  }

  showAugmentChoices(choices: HexAugment[]): void {
    this.augmentCards.innerHTML = '';
    for (const choice of choices) {
      const card = document.createElement('div');
      card.className = 'augment-card';
      const kind = document.createElement('span');
      kind.className = 'augment-kind';
      kind.textContent = choice.kind === 'stat' ? '属性' : '经济';
      const name = document.createElement('h3');
      name.textContent = choice.name;
      const desc = document.createElement('p');
      desc.textContent = choice.description;
      card.append(kind, name, desc);
      const id = choice.id;
      card.addEventListener('click', () => this.onChooseAugment(id));
      this.augmentCards.appendChild(card);
    }
    this.augmentPanel.classList.remove('hidden');
  }

  showGameOver(): void {
    this.gameoverPanel.classList.remove('hidden');
  }

  toast(message: string): void {
    this.toastEl.textContent = message;
    this.toastEl.classList.remove('hidden');
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toastEl.classList.add('hidden');
    }, 2200);
  }

  // ===== 内部方法 =====
  /** 更新已选强化列表（stat 类蓝色标签，economy 类金色标签） */
  private updateAugmentList(augments: AugmentId[]): void {
    this.augmentListEl.innerHTML = '';
    for (const id of augments) {
      const def = AUGMENT_DEFINITIONS[id];
      if (!def) continue;
      const tag = document.createElement('span');
      tag.className = `augment-tag ${def.kind}`;
      tag.textContent = def.name;
      this.augmentListEl.appendChild(tag);
    }
  }

  private renderBench(): void {
    this.benchEl.innerHTML = '';
    for (let i = 0; i < BENCH_SIZE; i++) {
      const unit = this.lastBench[i];
      const el = document.createElement('div');
      el.className = 'bench-slot';
      if (this.selectedBenchIndex === i) el.classList.add('selected');
      if (unit) {
        const def = UNIT_DEFINITIONS[unit.type];
        const color = document.createElement('span');
        color.className = 'unit-color';
        color.style.background = def.color;
        const name = document.createElement('span');
        name.textContent = def.name;
        el.append(color, name);
        el.title = `${def.name} — 生命 ${def.hp} / 攻击 ${def.attack} / 攻速 ${def.attackSpeed} / 移速 ${def.moveSpeed} / 范围 ${def.range}`;
        const idx = i;
        el.addEventListener('click', () => this.onSelectBench(idx));
      } else {
        el.classList.add('empty');
      }
      this.benchEl.appendChild(el);
    }
  }

  private hideAugmentPanel(): void {
    this.augmentPanel.classList.add('hidden');
  }

  private hideGameOverPanel(): void {
    this.gameoverPanel.classList.add('hidden');
  }
}
