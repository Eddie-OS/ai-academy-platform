import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WarningLight, WarningSummaryCard, warningLightText } from './WarningLight';

/**
 * 设计规范 2.5 的 WV1–WV5。
 *
 * <p>这些断言看起来琐碎（「有没有文案」「天数说的是剩余还是逾期」），但它们对应的是
 * 无障碍达标条件：三个灯色里有两个的纯色对比度低于 3:1，文案是这套色值成立的前提，
 * 不是加强项。散落实现时最先丢的就是文案与天数。
 */
describe('WarningLight（三色灯）', () => {
  it('WV3：三个灯色的天数语义各不相同，不共用同一句式', () => {
    expect(warningLightText('BLUE', 2)).toBe('即将到期 · 剩余 2 天');
    expect(warningLightText('YELLOW', 5)).toBe('已逾期 · 逾期 5 天');
    expect(warningLightText('RED', 12)).toBe('状态停滞 · 停滞 12 天');
    expect(warningLightText('NONE')).toBe('健康');
  });

  it('WV1：三种形态都同时渲染图标、文案与天数，没有「只有色点」的形态', () => {
    for (const variant of ['inline', 'badge'] as const) {
      const { container, unmount } = render(<WarningLight color="YELLOW" days={5} variant={variant} />);
      expect(screen.getByTestId('warning-light')).toHaveTextContent('已逾期 · 逾期 5 天');
      expect(container.querySelector('svg')).not.toBeNull();
      unmount();
    }

    const { container } = render(<WarningSummaryCard color="RED" count={7} caption="状态连续 5 天未变更" />);
    expect(screen.getByTestId('warning-summary-card')).toHaveTextContent('状态停滞');
    expect(screen.getByTestId('warning-summary-card')).toHaveTextContent('7');
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('WV2：四种状态的图标形状互不相同，健康态无图标', () => {
    const shapes = new Set<string>();
    for (const color of ['BLUE', 'YELLOW', 'RED'] as const) {
      const { container, unmount } = render(<WarningLight color={color} days={1} />);
      const svg = container.querySelector('svg');
      // lucide 把图标名写进 class（如 lucide-clock），用它来断言形状确实换了
      shapes.add(svg?.getAttribute('class') ?? '');
      unmount();
    }
    expect(shapes.size).toBe(3);

    const { container } = render(<WarningLight color="NONE" />);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('WV5：健康态不可下钻——给了 onDrillDown 也不渲染「查看明细」', () => {
    render(<WarningSummaryCard color="NONE" count={128} caption="暂无预警" onDrillDown={() => {}} />);
    expect(screen.queryByText('查看明细')).toBeNull();
  });

  it('三个灯色给了下钻回调时渲染「查看明细」', () => {
    render(<WarningSummaryCard color="BLUE" count={3} caption="距预计完成时间 3 天内" onDrillDown={() => {}} />);
    expect(screen.getByText('查看明细')).toBeInTheDocument();
  });
});
