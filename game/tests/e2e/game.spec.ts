import { test, expect, type Page } from '@playwright/test';

/**
 * 轮询等待 HUD 中出现指定文本。
 *
 * 战斗结算、回合推进、强化弹出等流程在 requestAnimationFrame 中发生，
 * 属于异步状态变化，需用 expect.poll 捕获最终状态。
 * 返回 '' 而非 null，避免元素尚未渲染时的类型/断言异常。
 */
async function expectHud(page: Page, substring: string): Promise<void> {
  await expect
    .poll(async () => (await page.locator('#hud').textContent()) ?? '')
    .toContain(substring);
}

test.describe('3D 自走棋核心游戏流程 E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // 等待游戏初始化完成（main.ts 模块加载、商店填充、HUD 渲染出初始金币 5）
    await expectHud(page, '金币: 5');
  });

  // 1. 页面加载与初始状态
  test('页面加载后显示正确的初始状态', async ({ page }) => {
    const hud = (await page.locator('#hud').textContent()) ?? '';
    expect(hud).toContain('金币: 5');
    expect(hud).toContain('HP: 100');
    expect(hud).toContain('回合: 1');
    expect(hud).toContain('阶段: 准备阶段');

    // 商店 5 个 slot，初始全部可购买（非 empty）
    await expect(page.locator('.shop-slot')).toHaveCount(5);
    await expect(page.locator('.shop-slot:not(.empty)')).toHaveCount(5);

    // 备战区 9 个 slot，初始全部为空
    await expect(page.locator('.bench-slot')).toHaveCount(9);
    await expect(page.locator('.bench-slot.empty')).toHaveCount(9);

    // 按钮文案
    await expect(page.locator('#battle-btn')).toHaveText('开始战斗');
    await expect(page.locator('#refresh-btn')).toHaveText('刷新 (2金)');

    // 覆盖层面板初始隐藏（含 hidden class）
    await expect(page.locator('#augment-panel')).toBeHidden();
    await expect(page.locator('#gameover-panel')).toBeHidden();
  });

  // 2. 购买单位流程
  test('购买单位后金币减少、单位加入备战区、商店槽位标记已售出', async ({ page }) => {
    // 点击第一个可购买的商店槽位
    await page.locator('.shop-slot:not(.empty)').first().click();

    // 金币减少 2（5 → 3）
    await expectHud(page, '金币: 3');

    // 备战区第一个 slot 出现单位（非 empty）
    await expect(page.locator('.bench-slot:not(.empty)')).toHaveCount(1);
    await expect(page.locator('.bench-slot').first()).not.toHaveClass(/empty/);

    // 该商店 slot 变为"已售出"（empty class）
    await expect(page.locator('.shop-slot').first()).toHaveText('已售出');
    await expect(page.locator('.shop-slot').first()).toHaveClass(/empty/);
  });

  // 3. 刷新商店流程
  test('刷新商店扣 2 金并刷新全部 5 个槽位', async ({ page }) => {
    await page.locator('#refresh-btn').click();

    // 金币减少 2（5 → 3）
    await expectHud(page, '金币: 3');

    // 5 个槽位全部刷新（无"已售出"，全部可购买）
    await expect(page.locator('.shop-slot.empty')).toHaveCount(0);
    await expect(page.locator('.shop-slot:not(.empty)')).toHaveCount(5);
  });

  // 4. 金币不足购买
  test('金币不足时购买失败并提示 toast，金币不变', async ({ page }) => {
    // 购买 2 次花到 1 金（5 - 2 - 2 = 1）
    await page.locator('.shop-slot:not(.empty)').nth(0).click();
    await expectHud(page, '金币: 3');
    await page.locator('.shop-slot:not(.empty)').nth(0).click();
    await expectHud(page, '金币: 1');

    // 再点击商店槽位（金币不足）
    await page.locator('.shop-slot:not(.empty)').first().click();

    // 出现 toast 提示"购买失败"
    await expect(page.locator('#toast')).toContainText('购买失败');

    // 金币不变（仍为 1）
    await expectHud(page, '金币: 1');
  });

  // 5. 备战区选中和放置（棋盘为 3D canvas，仅验证选中状态）
  test('备战区单位可选中与取消选中', async ({ page }) => {
    // 购买一个单位进入备战区
    await page.locator('.shop-slot:not(.empty)').first().click();
    await expect(page.locator('.bench-slot:not(.empty)')).toHaveCount(1);

    // 点击备战区含单位的 slot → 选中
    await page.locator('.bench-slot:not(.empty)').first().click();
    await expect(page.locator('.bench-slot.selected')).toHaveCount(1);
    await expect(page.locator('.bench-slot').first()).toHaveClass(/selected/);

    // 再次点击同一 slot → 取消选中
    await page.locator('.bench-slot.selected').first().click();
    await expect(page.locator('.bench-slot.selected')).toHaveCount(0);

    // 重新选中（棋盘为 3D canvas，无法用 DOM 点击放置，仅验证选中状态）
    await page.locator('.bench-slot:not(.empty)').first().click();
    await expect(page.locator('.bench-slot.selected')).toHaveCount(1);
  });

  // 6. 开始战斗与结算
  test('不放置单位开始战斗后立即失败、扣 HP 并进入下一回合', async ({ page }) => {
    // 不放置任何单位，直接开始战斗
    await page.locator('#battle-btn').click();

    // 战斗阶段（战斗中）在玩家无单位时仅持续一帧（首帧即判定玩家全灭），
    // 难以稳定捕获；用 poll 等待结算完成（回合推进到 2）。
    await expectHud(page, '回合: 2');

    // 结算后：玩家无单位立即失败，敌方 3 单位存活 * 2 = 6 伤害，100 - 6 = 94
    const hud = (await page.locator('#hud').textContent()) ?? '';
    expect(hud).toContain('HP: 94');
    expect(hud).toContain('阶段: 准备阶段');
    expect(hud).toContain('回合: 2');
  });

  // 7. 强化选择流程
  test('偶数回合战斗结束后弹出强化选择，选择后进入下一回合', async ({ page }) => {
    // 回合 1 战斗（不放置单位，直接失败）→ 进入回合 2
    await page.locator('#battle-btn').click();
    await expectHud(page, '回合: 2');
    // 确认回到准备阶段（战斗按钮可用），再开始回合 2 战斗
    await expectHud(page, '阶段: 准备阶段');
    await page.locator('#battle-btn').click();

    // 回合 2 战斗（偶数回合）→ 战斗后弹出强化选择面板（无 hidden class）
    await expect(page.locator('#augment-panel')).toBeVisible();
    // 3 张强化卡
    await expect(page.locator('#augment-cards .augment-card')).toHaveCount(3);

    // 点击第一张强化卡
    await page.locator('#augment-cards .augment-card').first().click();

    // 强化面板隐藏
    await expect(page.locator('#augment-panel')).toBeHidden();
    // 阶段回到准备阶段，回合变为 3
    await expectHud(page, '回合: 3');
    await expectHud(page, '阶段: 准备阶段');
  });

  // 8. 游戏结束与重启（简化：验证面板初始隐藏）
  test('游戏结束面板初始为隐藏状态', async ({ page }) => {
    await expect(page.locator('#gameover-panel')).toBeHidden();
  });
});
