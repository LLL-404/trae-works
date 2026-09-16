import type { UnitDefinition, UnitType } from '../types';

/**
 * 4 种基础单位的基础属性表。
 * shape 用于 3D 表示：
 *   warrior -> box（方盒，稳健）
 *   archer  -> cone（锥体，锐利）
 *   mage    -> sphere（球体，法球）
 *   tank    -> cylinder（圆柱，厚重）
 */
export const UNIT_DEFINITIONS: Record<UnitType, UnitDefinition> = {
  warrior: {
    type: 'warrior',
    name: '战士',
    color: '#4a90d9',
    shape: 'box',
    hp: 100,
    attack: 18,
    attackSpeed: 1.0,
    moveSpeed: 2.0,
    range: 1.0,
  },
  archer: {
    type: 'archer',
    name: '弓手',
    color: '#66cc44',
    shape: 'cone',
    hp: 60,
    attack: 22,
    attackSpeed: 1.2,
    moveSpeed: 1.8,
    range: 4.0,
  },
  mage: {
    type: 'mage',
    name: '法师',
    color: '#aa44cc',
    shape: 'sphere',
    hp: 55,
    attack: 30,
    attackSpeed: 0.8,
    moveSpeed: 1.6,
    range: 3.5,
  },
  tank: {
    type: 'tank',
    name: '坦克',
    color: '#8a8a8a',
    shape: 'cylinder',
    hp: 160,
    attack: 10,
    attackSpeed: 0.7,
    moveSpeed: 1.4,
    range: 1.0,
  },
};

/** 单位类型列表（便于遍历/随机抽取） */
export const UNIT_TYPES: UnitType[] = ['warrior', 'archer', 'mage', 'tank'];

/** 单位购买价格（金币） */
export const UNIT_COST = 2;
