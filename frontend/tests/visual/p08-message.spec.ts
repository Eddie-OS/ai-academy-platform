import { expect, test } from '@playwright/test';
import {
  expectContentWithinRegions,
  expectRegionGeometry,
  expectShellGeometry,
  openBaseline,
  type Region,
} from './shell';

const REGIONS: Region[] = [
  { id: 'R3', name: '页签', x: 221, y: 70, w: 1341, h: 48 },
  { id: 'R4', name: '四张 KPI', x: 221, y: 135, w: 762, h: 98 },
  { id: 'R5', name: '催办记录列表', x: 221, y: 250, w: 548, h: 711 },
  { id: 'R6', name: '催办记录详情', x: 784, y: 250, w: 531, h: 711 },
  { id: 'R7', name: '台账概览', x: 1330, y: 250, w: 238, h: 711 },
];

const KPIS = [
  { id: 'pending', label: '待催办清单', value: '8' },
  { id: 'recordedToday', label: '今日已记台账', value: '128' },
  { id: 'objects', label: '涉及对象', value: '3' },
  { id: 'blocked', label: '防重复拦截', value: '1' },
];

test.describe('P08 消息中心（催办记录台账）', () => {
  test.beforeEach(async ({ page }) => {
    await openBaseline(page, '/escalations');
  });

  test('L0 壳层边界', async ({ page }) => {
    await expectShellGeometry(page, 'message');
  });

  test('L1 五区域外框', async ({ page }) => {
    await expectRegionGeometry(page, REGIONS);
  });

  test('L1 区域内容不溢出', async ({ page }) => {
    await expectContentWithinRegions(page, REGIONS.map((region) => region.id));
  });

  test('L1 三栏宽度、间距与列表行高', async ({ page }) => {
    const regions = await page.locator("[data-region='R5'], [data-region='R6'], [data-region='R7']").evaluateAll((nodes) =>
      nodes.map((node) => {
        const box = node.getBoundingClientRect();
        return { x: box.x, w: box.width };
      }),
    );
    expect(regions.map((region) => Math.round(region.w))).toEqual([548, 531, 238]);
    expect(Math.round(regions[1]!.x - (regions[0]!.x + regions[0]!.w))).toBe(15);
    expect(Math.round(regions[2]!.x - (regions[1]!.x + regions[1]!.w))).toBe(15);
    const firstRow = await page.getByTestId('escalation-row').first().boundingBox();
    expect(firstRow?.height).toBeCloseTo(98, 0);
  });

  test('L2 KPI 采用催办台账语义', async ({ page }) => {
    for (const kpi of KPIS) {
      const card = page.locator(`[data-testid='escalation-kpi'][data-kpi='${kpi.id}']`);
      await expect(card).toContainText(kpi.label);
      await expect(card).toContainText(kpi.value);
    }
  });

  test('L2 默认详情与台账字段正确', async ({ page }) => {
    await expect(page.getByTestId('escalation-detail-title')).toHaveText('课程《Prompt工程实战》');
    const detail = page.locator("[data-region='R6']");
    await expect(detail).toContainText('培训即将到期');
    await expect(detail).toContainText('2024-06-10 09:20');
    await expect(detail).toContainText('系统生成清单');
    await expect(detail).toContainText('本页仅记录催办台账，不发送任何消息。');
  });

  test('L2 页签按台账来源筛选', async ({ page }) => {
    await page.getByTestId('escalation-tab').filter({ hasText: '手动催办' }).click();
    await expect(page.getByTestId('escalation-row')).toHaveCount(2);
    await page.getByTestId('escalation-tab').filter({ hasText: '待催办清单' }).click();
    await expect(page.getByTestId('escalation-row')).toHaveCount(2);
  });

  test('L2 不出现站内信与回执能力', async ({ page }) => {
    for (const forbidden of ['重新发送', '发送失败', '送达', '已读', '未读', '站内信', 'WeLink', '渠道']) {
      await expect(page.getByText(forbidden, { exact: true })).toHaveCount(0);
    }
  });
});
