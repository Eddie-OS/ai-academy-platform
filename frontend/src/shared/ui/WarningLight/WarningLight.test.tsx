import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WarningLight, WarningSummaryCard, redLightReasonOf, warningLightText } from './WarningLight';

/**
 * 设计规范 2.5 的 WV1–WV5，按业务重新裁决后的灯色口径（见 docs/文档待修清单.md V-9）。
 *
 * <p>现行口径：蓝=正常运行（健康态）、黄=需要关注、红=已逾期<b>或</b>状态停滞。
 * 与需求 13.4.1a 原文的差别以及理由，写在 designTokens 的 warningLight 上。
 *
 * <p>这些断言看起来琐碎（「有没有文案」「天数说的是剩余还是逾期」），但它们对应的是
 * 无障碍达标条件：三个灯色里有两个的纯色对比度低于 3:1，文案是这套色值成立的前提，
 * 不是加强项。散落实现时最先丢的就是文案与天数。
 */
describe('WarningLight（三色灯）', () => {
  it('WV3：天数语义随灯色而定，不共用同一句式', () => {
    expect(warningLightText('BLUE', 8)).toBe('正常运行 · 剩余 8 天');
    expect(warningLightText('YELLOW', 5)).toBe('需要关注 · 剩余 5 天');
    expect(warningLightText('NONE')).toBe('无预警');
  });

  /**
   * 红灯合并了两种成因，这两句话说的不是同一个数：
   * 逾期天数从预计完成时间往后数，停滞天数从 last_state_changed_at 往后数。
   * 共用一句「红 N 天」会把两个指标混成一个。
   */
  it('红灯按成因给出不同的标签与天数说法', () => {
    expect(warningLightText('RED', 12, 'OVERDUE')).toBe('已逾期 · 逾期 12 天');
    expect(warningLightText('RED', 12, 'STALLED')).toBe('状态停滞 · 停滞 12 天');
  });

  it('WV1：两种形态都同时渲染图标、文案与天数，没有「只有色点」的形态', () => {
    for (const variant of ['inline', 'badge'] as const) {
      const { container, unmount } = render(<WarningLight color="YELLOW" days={5} variant={variant} />);
      expect(screen.getByTestId('warning-light')).toHaveTextContent('需要关注 · 剩余 5 天');
      expect(container.querySelector('svg')).not.toBeNull();
      unmount();
    }

    const { container } = render(<WarningLight color="RED" days={3} reason="STALLED" />);
    expect(screen.getByTestId('warning-light')).toHaveTextContent('状态停滞 · 停滞 3 天');
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('WV2：四种状态的图标形状互不相同，无灯态无图标', () => {
    const shapes = new Set<string>();
    for (const color of ['BLUE', 'YELLOW'] as const) {
      const { container, unmount } = render(<WarningLight color={color} days={1} />);
      // lucide 把图标名写进 class（如 lucide-circle-check），用它来断言形状确实换了
      shapes.add(container.querySelector('svg')?.getAttribute('class') ?? '');
      unmount();
    }
    const { container, unmount } = render(<WarningLight color="RED" days={1} reason="OVERDUE" />);
    shapes.add(container.querySelector('svg')?.getAttribute('class') ?? '');
    unmount();
    expect(shapes.size).toBe(3);

    const none = render(<WarningLight color="NONE" />);
    expect(none.container.querySelector('svg')).toBeNull();
  });

  /**
   * 汇总卡的红灯标题不是「已逾期」，因为这个数把停滞的对象也算进去了。
   * 只写一种成因，运营会以为另一种没被统计，去别处找第二个数字。
   */
  it('汇总卡的红灯标题覆盖两种成因', () => {
    render(<WarningSummaryCard color="RED" count={9} caption="已超期或连续 5 天未变更" />);
    const card = screen.getByTestId('warning-summary-card');
    expect(card).toHaveTextContent('逾期或停滞');
    expect(card).toHaveTextContent('9');
  });

  it('紧凑档不写死 11px：字号走 CSS 档位，内联样式一旦回来就会把缩放盖掉', () => {
    const { container } = render(
      <WarningSummaryCard color="BLUE" count={3} caption="距预计完成时间 3 天以上" compact />,
    );
    expect(screen.getByTestId('warning-summary-card')).toHaveClass('wsc', 'wsc--compact');
    expect(container.innerHTML).not.toMatch(/font-size:\s*11px/);
  });

  it('数字按 3.3 加千分位', () => {
    render(<WarningSummaryCard color="BLUE" count={2133} caption="距预计完成时间 3 天以上" />);
    expect(screen.getByTestId('warning-summary-card')).toHaveTextContent('2,133');
  });

  it('接口未回时 count 为 null 显示「—」，不抛错', () => {
    render(<WarningSummaryCard color="BLUE" count={null} caption="距预计完成时间 3 天以上" />);
    expect(screen.getByTestId('warning-summary-card')).toHaveTextContent('—');
  });

  it('无灯态不可下钻——给了 onDrillDown 也不渲染「查看明细」', () => {
    render(<WarningSummaryCard color="NONE" count={128} caption="无预计完成时间" onDrillDown={() => {}} />);
    expect(screen.queryByText('查看明细')).toBeNull();
  });

  it('三个灯色给了下钻回调时渲染「查看明细」', () => {
    render(<WarningSummaryCard color="BLUE" count={3} caption="距预计完成时间 3 天以上" onDrillDown={() => {}} />);
    expect(screen.getByText('查看明细')).toBeInTheDocument();
  });

  /**
   * 后端 {@code lightReason} 是中文，组件要的是英文键。这层映射必须只有一处：
   * 总看板曾自己写了一遍、写成「红灯一律停滞」，于是真正逾期的对象在待办清单上被说成停滞。
   */
  describe('redLightReasonOf（后端成因 → 成因键）', () => {
    it('两种成因各自映射', () => {
      expect(redLightReasonOf('已逾期')).toBe('OVERDUE');
      expect(redLightReasonOf('状态停滞')).toBe('STALLED');
    });

    /*
     * 兜底是停滞而不是逾期。逾期天数从预计完成时间往后数，只有真的过了那天才成立；
     * 兜到「逾期」会让一条剩余天数还是正数的行显示「已逾期」，同一行里自己打自己的脸。
     */
    it('拿不到成因时兜到停滞', () => {
      expect(redLightReasonOf(null)).toBe('STALLED');
      expect(redLightReasonOf(undefined)).toBe('STALLED');
      expect(redLightReasonOf('')).toBe('STALLED');
    });
  });
});
