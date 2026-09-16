import * as THREE from 'three';
import { BOARD_COLS, BOARD_ROWS } from '../types';

// 重新导出棋盘维度，便于上层统一从此处引用
export { BOARD_COLS, BOARD_ROWS };

/** 单格边长（世界单位） */
const TILE_SIZE = 1.5;
/** 单格厚度（世界单位） */
const TILE_HEIGHT = 0.2;
/** 玩家区颜色（蓝色调） */
const PLAYER_TILE_COLOR = 0x3366cc;
/** 敌方区颜色（红色调） */
const ENEMY_TILE_COLOR = 0xcc3333;

/**
 * 格子坐标 → 世界坐标。
 * 返回格子顶部表面中心点（即单位站立位置），棋盘在 XZ 平面居中。
 */
export function tileToWorld(col: number, row: number): THREE.Vector3 {
  const offsetX = -((BOARD_COLS - 1) * TILE_SIZE) / 2;
  const offsetZ = -((BOARD_ROWS - 1) * TILE_SIZE) / 2;
  return new THREE.Vector3(
    offsetX + col * TILE_SIZE,
    TILE_HEIGHT,
    offsetZ + row * TILE_SIZE,
  );
}

/**
 * 3D 棋盘渲染器：6×4 方格。
 * 行 0-1 为玩家区（蓝色调），行 2-3 为敌方区（红色调）。
 * 每格为扁平 Box，记录 col/row 到 userData 以供射线拾取。
 */
export class BoardRenderer {
  private readonly scene: THREE.Scene;
  private readonly highlights: THREE.Mesh[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.createBoard();
  }

  private createBoard(): void {
    const halfRows = BOARD_ROWS / 2;
    for (let col = 0; col < BOARD_COLS; col++) {
      for (let row = 0; row < BOARD_ROWS; row++) {
        const isPlayerArea = row < halfRows;
        const color = isPlayerArea ? PLAYER_TILE_COLOR : ENEMY_TILE_COLOR;
        const geometry = new THREE.BoxGeometry(TILE_SIZE, TILE_HEIGHT, TILE_SIZE);
        const material = new THREE.MeshStandardMaterial({ color });
        const mesh = new THREE.Mesh(geometry, material);
        const pos = tileToWorld(col, row);
        // 网格中心位于厚度一半处，使底面贴地（y=0），顶面位于 y=TILE_HEIGHT
        mesh.position.set(pos.x, TILE_HEIGHT / 2, pos.z);
        mesh.receiveShadow = true;
        mesh.userData = { col, row };
        this.scene.add(mesh);
      }
    }
  }

  /** 在指定格子上叠加半透明高亮色块 */
  highlightTile(col: number, row: number, color: number): void {
    const geometry = new THREE.BoxGeometry(
      TILE_SIZE * 0.95,
      0.05,
      TILE_SIZE * 0.95,
    );
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.5,
    });
    const mesh = new THREE.Mesh(geometry, material);
    const pos = tileToWorld(col, row);
    mesh.position.set(pos.x, TILE_HEIGHT + 0.03, pos.z);
    mesh.userData = { col, row, highlight: true };
    this.scene.add(mesh);
    this.highlights.push(mesh);
  }

  /** 清除所有高亮 */
  clearHighlight(): void {
    for (const mesh of this.highlights) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    this.highlights.length = 0;
  }
}
