import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { resetRegressionModeCache } from '@/app/regressionMode';
import { CockpitDetailPanel } from './CockpitDetailPanel';
import { MetricCardRow } from './MetricCardRow';

const originalMatchMedia = window.matchMedia;

afterEach(() => {
  window.matchMedia = originalMatchMedia;
  window.history.replaceState({}, '', '/');
  resetRegressionModeCache();
  vi.restoreAllMocks();
});

describe('驾驶舱反馈动效', () => {
  it('指标卡保留终值格式并支持键盘触发', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as typeof window.matchMedia;
    const onClick = vi.fn();

    render(
      <MetricCardRow
        items={[{ key: 'total', title: '讲师总数', value: '1,268', suffix: '人', onClick }]}
      />,
    );

    const card = screen.getByRole('button', { name: /讲师总数/ });
    expect(card).toHaveClass('cockpit-metric-card');
    expect(screen.getByText('1,268')).toBeInTheDocument();

    fireEvent.keyDown(card, { key: 'Enter' });
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('不支持 WAAPI 时关闭动作立即沿用原回调', () => {
    const onClose = vi.fn();
    const onToggleExpand = vi.fn();

    render(
      <CockpitDetailPanel
        title="课程详情"
        expanded={false}
        onClose={onClose}
        onToggleExpand={onToggleExpand}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '展开详情面板' }));
    fireEvent.click(screen.getByRole('button', { name: '关闭详情面板' }));

    expect(onToggleExpand).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
