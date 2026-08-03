import { expect, test } from '@playwright/test';
import { expectFluidFill, openFluid } from './shell';

/**
 * 产品模式的按比例伸缩（窗口大于设计画布时）。
 *
 * <p>其余 spec 都在 1586×992 的固定视口下跑，那里没有多余空间可分，
 * 因此完全测不到「窗口更大时多出来的空间归谁」。这一份专门补这一块：
 * 视口放到 1920×1080，逐页检查各条横带都到右边界、最后一行到视口底部。
 *
 * <p>数据仍用 fixtures，只是把 data-regression 摘掉让产品模式的 CSS 生效，
 * 见 {@link openFluid}。
 */

test.use({ viewport: { width: 1920, height: 1080 } });

test.describe('产品模式按比例伸缩', () => {
  test('P01 总看板四条横带填满窗口', async ({ page }) => {
    await openFluid(page, '/');
    await expectFluidFill(page, [
      "[data-region='R3']",
      "[data-region='R4']",
      '.dash-row-mid',
      '.dash-row-bottom',
    ]);
  });

  test('P02 需求驾驶舱三条横带填满窗口', async ({ page }) => {
    await openFluid(page, '/demands');
    await expectFluidFill(page, ["[data-region='R3']", "[data-region='R4']", '.dmd-main']);
  });

  test('P03 课程工作台主体填满窗口', async ({ page }) => {
    await openFluid(page, '/courses');
    // P03 只有一条通栏横带（主体两栏），左栏内部的四个区域宽度与它对齐
    await expectFluidFill(page, ['.crs-main']);
  });

  test('P03 左栏四条横带右沿对齐', async ({ page }) => {
    await openFluid(page, '/courses');
    // 左栏内部是四条宽度独立声明的横带（R6/R7 并排组成最后一条），
    // 任一处写死像素都会在这里露出来
    await expectFluidFill(
      page,
      ["[data-region='R3']", "[data-region='R4']", "[data-region='R5']", '.crs-bottom'],
      // 左栏最后一条横带不负责顶到视口底部，主体两栏才是
      { bottomSlack: 1080 },
    );
  });

  test('P04 讲师地图两条横带填满窗口', async ({ page }) => {
    await openFluid(page, '/lecturers');
    /*
     * R3 是这一页唯一一条设计宽度短于正文的横带（1150 vs 1310）。
     * 产品模式必须拉满，否则右上角会随窗口变宽露出一块越来越大的白 ——
     * 而它长得像「KPI 卡没加载完」。
     */
    await expectFluidFill(page, ["[data-region='R3']", '.lct-main']);
  });

  test('P04 左栏三条横带右沿对齐', async ({ page }) => {
    await openFluid(page, '/lecturers');
    await expectFluidFill(
      page,
      ["[data-region='R4']", "[data-region='R5']", "[data-region='R6']"],
      { bottomSlack: 1080 },
    );
  });

  test('P05 培训地图三条横带填满窗口', async ({ page }) => {
    await openFluid(page, '/trainings');
    await expectFluidFill(page, ["[data-region='R3']", "[data-region='R4']", '.trn-main']);
  });

  test('P05 左栏两条横带右沿对齐', async ({ page }) => {
    await openFluid(page, '/trainings');
    await expectFluidFill(
      page,
      ["[data-region='R5']", "[data-region='R6']"],
      { bottomSlack: 1080 },
    );
  });

  test('P06 案例图三条横带填满窗口', async ({ page }) => {
    await openFluid(page, '/cases');
    await expectFluidFill(page, ["[data-region='R3']", "[data-region='R4']", '.cse-main']);
  });

  test('P06 左栏横带右沿对齐', async ({ page }) => {
    await openFluid(page, '/cases');
    // V-65：R7 两种模式都在，这里验左栏三带右沿对齐
    await expectFluidFill(
      page,
      ["[data-region='R5']", "[data-region='R6']", "[data-region='R7']"],
      { bottomSlack: 1080 },
    );
  });

  test('P06 五张案例卡铺满案例库宽度', async ({ page }) => {
    await openFluid(page, '/cases');
    /*
     * 左栏变宽后卡宽若仍锁 177px，五张卡只占一半、右边空一大块——
     * 现有「横带右沿对齐」测不到这种「带内留白」。
     */
    const strip = page.getByTestId('case-cards');
    const stripBox = await strip.boundingBox();
    const cards = page.getByTestId('case-card');
    await expect(cards).toHaveCount(5);
    const first = await cards.first().boundingBox();
    const last = await cards.nth(4).boundingBox();
    expect(stripBox).toBeTruthy();
    expect(first).toBeTruthy();
    expect(last).toBeTruthy();
    expect(Math.abs(first!.x - stripBox!.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(last!.x + last!.width - (stripBox!.x + stripBox!.width))).toBeLessThanOrEqual(2);
    // 单卡必须明显宽于设计稿 177，否则就是没吃到多余宽度
    expect(first!.width).toBeGreaterThan(200);
  });

  test('P07 任务中心整体与左侧横带按比例填满', async ({ page }) => {
    await openFluid(page, '/tasks');
    await expectFluidFill(page, ['.tsk']);
    await expectFluidFill(
      page,
      ["[data-region='R3']", "[data-region='R4']", "[data-region='R5']", "[data-region='R6']", '.tsk-bottom'],
      { bottomSlack: 1080 },
    );
  });

  test('P08 消息中心三条横带填满窗口', async ({ page }) => {
    await openFluid(page, '/escalations');
    await expectFluidFill(page, ["[data-region='R3']", '.esc-kpis', '.esc-main']);
  });

  test('P09 评审记录中心五条横带填满窗口', async ({ page }) => {
    await openFluid(page, '/reviews');
    await expectFluidFill(page, [
      "[data-region='R3']",
      "[data-region='R4']",
      "[data-region='R5']",
      "[data-region='R6']",
      "[data-region='R7']",
    ]);
  });
});
