import * as THREE from 'three';
import type { Unit, UnitShape } from '../types';
import { UNIT_DEFINITIONS } from '../data/units';
import { tileToWorld } from './BoardRenderer';

/** 血条宽度（世界单位） */
const HP_BAR_WIDTH = 0.9;
/** 选中时缩放倍数 */
const SELECTED_SCALE = 1.2;
/** 选中时自发光颜色 */
const SELECTED_EMISSIVE = 0x444444;

interface UnitView {
  group: THREE.Group;
  mesh: THREE.Mesh;
  hpBar: THREE.Mesh;
}

/** 按 shape 工厂创建几何体及其高度 */
const SHAPE_FACTORIES: Record<
  UnitShape,
  () => { geometry: THREE.BufferGeometry; height: number }
> = {
  box: () => ({ geometry: new THREE.BoxGeometry(0.8, 0.8, 0.8), height: 0.8 }),
  cone: () => ({ geometry: new THREE.ConeGeometry(0.5, 1.0, 16), height: 1.0 }),
  sphere: () => ({ geometry: new THREE.SphereGeometry(0.5, 16, 16), height: 1.0 }),
  cylinder: () => ({
    geometry: new THREE.CylinderGeometry(0.5, 0.5, 1.0, 16),
    height: 1.0,
  }),
};

/**
 * 单位 3D 表示渲染器。
 * 依据单位 shape 生成几何体，用单位 color 着色，
 * 并提供放置/移除/移动/血条/选中能力。
 */
export class UnitRenderer {
  private readonly scene: THREE.Scene;
  private readonly units: Map<string, UnitView> = new Map();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /** 在单位当前格子（unit.col / unit.row）渲染模型 */
  placeUnit(unit: Unit): void {
    // 同 id 单位已存在则先移除重建
    if (this.units.has(unit.id)) {
      this.removeUnit(unit.id);
    }
    const def = UNIT_DEFINITIONS[unit.type];
    const { geometry, height } = SHAPE_FACTORIES[def.shape]();
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(def.color),
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    // 网格在 group 内底部贴 0，中心位于 height/2
    mesh.position.y = height / 2;

    // 血条：默认隐藏，updateHpBar 时显示
    const hpGeo = new THREE.BoxGeometry(HP_BAR_WIDTH, 0.08, 0.08);
    const hpMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const hpBar = new THREE.Mesh(hpGeo, hpMat);
    hpBar.position.y = height + 0.3;
    hpBar.visible = false;

    const group = new THREE.Group();
    group.add(mesh);
    group.add(hpBar);

    const pos = tileToWorld(unit.col, unit.row);
    group.position.set(pos.x, pos.y, pos.z);
    // 朝向：玩家朝 +z（敌方），敌方朝 -z（玩家）
    group.rotation.y = unit.team === 'player' ? 0 : Math.PI;

    this.scene.add(group);
    this.units.set(unit.id, { group, mesh, hpBar });
  }

  /** 从场景移除并释放单位资源 */
  removeUnit(unitId: string): void {
    const view = this.units.get(unitId);
    if (!view) return;
    this.scene.remove(view.group);
    view.mesh.geometry.dispose();
    (view.mesh.material as THREE.Material).dispose();
    view.hpBar.geometry.dispose();
    (view.hpBar.material as THREE.Material).dispose();
    this.units.delete(unitId);
  }

  /** 更新单位到新格子位置（瞬移，不做插值动画） */
  moveUnit(unitId: string, col: number, row: number): void {
    const view = this.units.get(unitId);
    if (!view) return;
    const pos = tileToWorld(col, row);
    view.group.position.set(pos.x, pos.y, pos.z);
  }

  /**
   * 更新单位血条。
   * hpRatio ∈ [0,1]：>0.5 绿色，0.25-0.5 黄色，<0.25 红色。
   * 血条左对齐收缩。
   */
  updateHpBar(unitId: string, hpRatio: number): void {
    const view = this.units.get(unitId);
    if (!view) return;
    const r = Math.max(0, Math.min(1, hpRatio));
    view.hpBar.visible = r > 0;
    view.hpBar.scale.x = r;
    // 左对齐：收缩时左边缘固定
    view.hpBar.position.x = -(HP_BAR_WIDTH * (1 - r)) / 2;
    const mat = view.hpBar.material as THREE.MeshBasicMaterial;
    if (r > 0.5) {
      mat.color.setHex(0x00ff00);
    } else if (r > 0.25) {
      mat.color.setHex(0xffff00);
    } else {
      mat.color.setHex(0xff0000);
    }
  }

  /** 选中高亮：放大 + 自发光 */
  setSelected(unitId: string, selected: boolean): void {
    const view = this.units.get(unitId);
    if (!view) return;
    const scale = selected ? SELECTED_SCALE : 1.0;
    view.group.scale.set(scale, scale, scale);
    const mat = view.mesh.material as THREE.MeshStandardMaterial;
    mat.emissive.setHex(selected ? SELECTED_EMISSIVE : 0x000000);
  }
}
