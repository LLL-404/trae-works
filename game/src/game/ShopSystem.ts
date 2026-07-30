import type { GameState } from './GameState';
import type { Unit, UnitType } from '../types';
import { SHOP_SIZE } from '../types';
import { UNIT_DEFINITIONS, UNIT_TYPES } from '../data/units';
import { UNIT_COST, REFRESH_COST } from './EconomySystem';

/**
 * 商店系统：随机刷新、购买单位、付费刷新商店。
 * 通过持有 GameState 引用，以组合方式扩展状态层。
 */
export class ShopSystem {
  constructor(private readonly state: GameState) {}

  /**
   * 随机生成 5 个 UnitType（从 4 种中均匀抽取，允许重复）。
   */
  rollShop(): UnitType[] {
    const units: UnitType[] = [];
    for (let i = 0; i < SHOP_SIZE; i++) {
      const idx = Math.floor(Math.random() * UNIT_TYPES.length);
      units.push(UNIT_TYPES[idx]);
    }
    return units;
  }

  /**
   * 随机生成并刷新商店槽位。
   */
  populateShop(): void {
    this.state.refreshShop(this.rollShop());
  }

  /**
   * 购买指定槽位的单位，创建实例并加入备战区。
   * 失败（金币不足、槽位无效、备战区满）时返回 null 并保证金币不丢失。
   */
  buy(index: number): Unit | null {
    if (this.state.gold < UNIT_COST) return null;
    if (!this.state.spendGold(UNIT_COST)) return null;

    const slot = this.state.buyFromShop(index);
    if (!slot || slot.unitType === null) {
      // 槽位不可购买：退还已扣金币
      this.state.addGold(UNIT_COST);
      return null;
    }

    const def = UNIT_DEFINITIONS[slot.unitType];
    const unit: Unit = {
      id: generateUnitId(),
      type: slot.unitType,
      team: 'player',
      stats: {
        hp: def.hp,
        attack: def.attack,
        attackSpeed: def.attackSpeed,
        moveSpeed: def.moveSpeed,
        range: def.range,
      },
      currentHp: def.hp,
      col: -1,
      row: -1,
    };

    if (!this.state.addToBench(unit)) {
      // 备战区已满：退还金币并恢复槽位为可购买
      this.state.addGold(UNIT_COST);
      this.state.shop[index].sold = false;
      return null;
    }

    return unit;
  }

  /**
   * 花费 REFRESH_COST 刷新商店。金币不足返回 false。
   */
  refresh(): boolean {
    if (this.state.gold < REFRESH_COST) return false;
    if (!this.state.spendGold(REFRESH_COST)) return false;
    this.populateShop();
    return true;
  }
}

/**
 * 生成单位唯一 ID。
 * 优先使用 crypto.randomUUID，不可用时回退到时间戳+随机串。
 */
function generateUnitId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }
  return `unit_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
