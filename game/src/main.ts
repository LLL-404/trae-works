import * as THREE from 'three';
import { GameState } from './game/GameState';
import { BoardRenderer } from './game/BoardRenderer';
import { UnitRenderer } from './game/UnitRenderer';
import { EconomySystem } from './game/EconomySystem';
import { ShopSystem } from './game/ShopSystem';
import { PlacementController } from './game/PlacementController';
import { BattleSystem } from './game/BattleSystem';
import { CombatResolver } from './game/CombatResolver';
import { AugmentSystem } from './game/AugmentSystem';
import { RogueProgression } from './game/RogueProgression';
import { UI } from './ui/UI';
import { UNIT_DEFINITIONS } from './data/units';
import { BOARD_COLS, BOARD_ROWS } from './types';
import type { UnitStats } from './types';
import './style.css';

// ===== 场景 / 相机 / 渲染器 =====
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);
// 俯视斜角：从右前上方看向原点
camera.position.set(8, 12, 12);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// 灯光：环境光 + 方向光
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
directionalLight.position.set(10, 20, 10);
directionalLight.castShadow = true;
scene.add(directionalLight);

// 地面
const groundGeometry = new THREE.PlaneGeometry(40, 40);
const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x4caf50 });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// ===== 系统实例化 =====
const state = new GameState();
const boardRenderer = new BoardRenderer(scene);
const unitRenderer = new UnitRenderer(scene);
const economySystem = new EconomySystem(state);
const shopSystem = new ShopSystem(state);
const placementController = new PlacementController(
  state,
  unitRenderer,
  boardRenderer,
);
const battleSystem = new BattleSystem(state, unitRenderer);
const combatResolver = new CombatResolver(state);
const augmentSystem = new AugmentSystem(state);
const rogueProgression = new RogueProgression(state);
const ui = new UI();
ui.bind(state);

// ===== UI 回调注册 =====
ui.onBuy = (index: number) => {
  const unit = shopSystem.buy(index);
  if (!unit) {
    ui.toast('购买失败（金币不足或备战区已满）');
  }
};

ui.onRefresh = () => {
  if (!shopSystem.refresh()) {
    ui.toast('金币不足，无法刷新');
  }
};

ui.onStartBattle = () => {
  startBattle();
};

ui.onSelectBench = (index: number) => {
  const current = state.bench[index];
  // 再次点击当前已选中单位 → 取消选中
  if (
    placementController.hasSelected() &&
    placementController.selectedUnitId === current?.id
  ) {
    placementController.deselect();
    ui.clearBenchSelection();
    return;
  }
  placementController.deselect();
  if (placementController.selectBenchUnit(index)) {
    ui.setBenchSelection(index);
  } else {
    ui.clearBenchSelection();
  }
};

ui.onSelectBoard = (col: number, row: number) => {
  placementController.deselect();
  ui.clearBenchSelection();
  placementController.selectBoardUnit(col, row);
};

ui.onPlaceAt = (col: number, row: number) => {
  if (placementController.hasSelected()) {
    if (placementController.placeSelected(col, row)) {
      ui.clearBenchSelection();
    } else {
      ui.toast('无法放置到该格子');
    }
  }
};

ui.onRecall = (col: number, row: number) => {
  if (placementController.recallFromBoard(col, row)) {
    ui.clearBenchSelection();
  } else {
    ui.toast('无法撤回（备战区已满）');
  }
};

ui.onChooseAugment = (id) => {
  // 防御性检查：choose 失败（id 不在待选中）时不推进回合，避免跳过强化
  if (!augmentSystem.choose(id)) {
    ui.toast('强化选择无效');
    return;
  }
  proceedToNextRound();
};

ui.onRestart = () => {
  clearAllUnits3D();
  rogueProgression.startNewRun();
  shopSystem.populateShop();
  spawnEnemies(1);
};

// ===== 流程函数 =====

/**
 * 生成本回合敌方阵容并写入 state.enemyBoard 与 3D 场景。
 * 先清除旧敌方单位的 3D 表现与状态，再重新生成。
 */
function spawnEnemies(round: number): void {
  clearEnemyUnits();
  const enemies = rogueProgression.generateEnemyLineup(round);
  for (const e of enemies) {
    state.enemyBoard[e.col][e.row] = e;
    unitRenderer.placeUnit(e);
  }
  state.notify();
}

/** 清除敌方棋盘上的所有单位（3D + 状态） */
function clearEnemyUnits(): void {
  for (const column of state.enemyBoard) {
    for (const u of column) {
      if (u) unitRenderer.removeUnit(u.id);
    }
  }
  for (let c = 0; c < BOARD_COLS; c++) {
    for (let r = 0; r < BOARD_ROWS; r++) {
      state.enemyBoard[c][r] = null;
    }
  }
}

/** 清除棋盘上所有单位（玩家方 + 敌方）的 3D 表现，用于重新开始 */
function clearAllUnits3D(): void {
  for (const column of state.board) {
    for (const u of column) {
      if (u) unitRenderer.removeUnit(u.id);
    }
  }
  for (const column of state.enemyBoard) {
    for (const u of column) {
      if (u) unitRenderer.removeUnit(u.id);
    }
  }
}

/**
 * 开始战斗：先将玩家方单位的属性从基础值重算并应用当前强化（幂等），
 * 然后调用 BattleSystem.start() 收集双方单位并开打。
 */
function startBattle(): void {
  applyAugmentsToPlayerUnits();
  battleSystem.start();
}

/** 从基础属性重算玩家单位的 stats（应用所有 stat 类强化），幂等 */
function applyAugmentsToPlayerUnits(): void {
  for (const column of state.board) {
    for (const u of column) {
      if (!u) continue;
      const def = UNIT_DEFINITIONS[u.type];
      const base: UnitStats = {
        hp: def.hp,
        attack: def.attack,
        attackSpeed: def.attackSpeed,
        moveSpeed: def.moveSpeed,
        range: def.range,
      };
      u.stats = augmentSystem.applyStatAugments(base, state.augments);
      u.currentHp = u.stats.hp;
    }
  }
}

/**
 * 战斗结算流程：
 * 1. combatResolver.resolve(result, survivingEnemyCount)
 * 2. 清理战场（移除敌方 3D，重置玩家方单位 3D 位置与血条）
 * 3. 游戏结束 → 显示面板并返回
 * 4. 否则根据回合数判断是否弹出强化选择，或直接进入下一回合
 */
function settleBattle(result: 'player' | 'enemy' | 'draw'): void {
  const survivingEnemies = battleSystem
    .getActiveUnits()
    .filter((u) => u.team === 'enemy').length;
  const combat = combatResolver.resolve(result, survivingEnemies);
  cleanupAfterBattle();

  if (combat.gameOver) {
    ui.showGameOver();
    return;
  }

  // 结算提示
  if (result === 'player') {
    ui.toast(`胜利！奖励 ${combat.rewardGold} 金币`);
  } else if (result === 'enemy') {
    ui.toast(`失败！损失 ${combat.hpLost} HP`);
  } else {
    ui.toast(`平局！损失 ${combat.hpLost} HP，奖励 ${combat.rewardGold} 金币`);
  }

  if (augmentSystem.shouldOffer(state.round)) {
    const choices = augmentSystem.offer();
    ui.showAugmentChoices(choices);
  } else {
    proceedToNextRound();
  }
}

/**
 * 战斗后清理：
 * - 移除所有敌方单位的 3D 表现并清空 enemyBoard
 * - 玩家方单位重新放置到原棋盘位置（重置战斗中漂移的位置与血条）
 * 玩家方单位保持原棋盘位置（不重置），敌方单位每回合重新生成。
 */
function cleanupAfterBattle(): void {
  clearEnemyUnits();
  // 阵亡的玩家单位从棋盘移除（不重新放置）；存活单位重置到原格子并刷新 3D 表现。
  // 战斗使用单位深拷贝，存活判定以 BattleSystem 的 activeUnits 为准。
  const survivorIds = new Set(
    battleSystem
      .getActiveUnits()
      .filter((u) => u.team === 'player')
      .map((u) => u.id),
  );
  for (let c = 0; c < BOARD_COLS; c++) {
    for (let r = 0; r < BOARD_ROWS; r++) {
      const u = state.board[c][r];
      if (!u) continue;
      if (survivorIds.has(u.id)) {
        unitRenderer.placeUnit(u);
      } else {
        state.board[c][r] = null;
      }
    }
  }
  state.notify();
}

/**
 * 进入下一回合流程：
 * 1. rogueProgression.proceedToNextRound()
 * 2. economySystem.grantIncome(round, augments)
 * 3. shopSystem.populateShop()
 * 4. 生成敌方阵容
 */
function proceedToNextRound(): void {
  rogueProgression.proceedToNextRound();
  economySystem.grantIncome(state.round, state.augments);
  shopSystem.populateShop();
  spawnEnemies(state.round);
}

// ===== 指针交互（同时支持鼠标与触控）=====
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

// 长按检测：触控设备无右键，长按 500ms 触发撤回
let longPressTimer: ReturnType<typeof setTimeout> | null = null;
let longPressTile: { col: number; row: number } | null = null;
const LONG_PRESS_MS = 500;

// 阻止右键默认菜单（桌面端）
renderer.domElement.addEventListener('contextmenu', (e: MouseEvent) =>
  e.preventDefault(),
);

// 触摸时禁止页面滚动/缩放
renderer.domElement.addEventListener(
  'touchmove',
  (e: TouchEvent) => e.preventDefault(),
  {
    passive: false,
  },
);

const handleTileHit = (
  col: number,
  row: number,
  isSecondary: boolean,
): void => {
  if (isSecondary) {
    // 右键/长按：撤回到备战区
    ui.onRecall(col, row);
    return;
  }
  // 左键/单击：已选中则放置，否则选中格子上的玩家单位
  if (placementController.hasSelected()) {
    const tileUnit = state.board[col]?.[row];
    if (tileUnit && tileUnit.id === placementController.selectedUnitId) {
      placementController.deselect();
      ui.clearBenchSelection();
    } else {
      ui.onPlaceAt(col, row);
    }
  } else {
    ui.onSelectBoard(col, row);
  }
};

// 统一使用 pointerdown 支持鼠标 + 触控
renderer.domElement.addEventListener('pointerdown', (event: PointerEvent) => {
  if (state.phase !== 'prep') return;
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const intersects = raycaster.intersectObjects(scene.children, true);
  for (const hit of intersects) {
    const ud = hit.object.userData as {
      col?: number;
      row?: number;
      highlight?: boolean;
    };
    if (
      typeof ud.col === 'number' &&
      typeof ud.row === 'number' &&
      !ud.highlight
    ) {
      const col = ud.col;
      const row = ud.row;
      const isSecondary = event.button === 2;
      handleTileHit(col, row, isSecondary);
      // 触摸设备：启动长按计时器，到时触发撤回
      if (
        event.pointerType === 'touch' &&
        !isSecondary &&
        !longPressTimer
      ) {
        longPressTile = { col, row };
        longPressTimer = setTimeout(() => {
          if (longPressTile) {
            handleTileHit(longPressTile.col, longPressTile.row, true);
            longPressTile = null;
            longPressTimer = null;
          }
        }, LONG_PRESS_MS);
      }
      return;
    }
  }
});

// 触摸移动或抬起时取消长按
renderer.domElement.addEventListener('pointermove', () => {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
    longPressTile = null;
  }
});
renderer.domElement.addEventListener('pointerup', () => {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
    longPressTile = null;
  }
});
renderer.domElement.addEventListener('pointercancel', () => {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
    longPressTile = null;
  }
});

// ===== 窗口尺寸自适应 =====
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ===== 启动：初始化第 1 回合 =====
// 初始金币 5 已由 GameState 构造函数设置；填充商店并生成第 1 回合敌方阵容
shopSystem.populateShop();
spawnEnemies(1);

// ===== 游戏循环 =====
let lastTime = performance.now();
function animate(now: number): void {
  requestAnimationFrame(animate);
  const delta = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  // 战斗阶段：推进战斗 tick，结束时进入结算流程
  if (state.phase === 'battle') {
    const tickResult = battleSystem.tick(delta);
    if (tickResult.finished) {
      settleBattle(tickResult.result ?? 'draw');
    }
  }

  renderer.render(scene, camera);
}
requestAnimationFrame(animate);
