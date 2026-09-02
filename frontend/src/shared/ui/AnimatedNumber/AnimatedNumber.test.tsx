import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { resetRegressionModeCache } from '@/app/regressionMode';
import { AnimatedNumber } from './AnimatedNumber';

const originalMatchMedia = window.matchMedia;

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.matchMedia = originalMatchMedia;
  window.history.replaceState({}, '', '/');
  resetRegressionModeCache();
});

describe('AnimatedNumber', () => {
  it('reduced-motion 下直接保留千分位、小数与后缀', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as typeof window.matchMedia;

    render(<AnimatedNumber value="1,268.0 人次" />);

    expect(screen.getByText('1,268.0 人次')).toBeInTheDocument();
  });

  it('普通模式从零滚动到终值', () => {
    vi.useFakeTimers();
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as typeof window.matchMedia;
    vi.stubGlobal('requestAnimationFrame', undefined);
    vi.stubGlobal('cancelAnimationFrame', undefined);

    render(<AnimatedNumber value="18.5 天" duration={200} />);
    expect(screen.getByText('0.0 天')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(240);
    });

    expect(screen.getByText('18.5 天')).toBeInTheDocument();
  });

  it('非数值文案不执行动画', () => {
    render(<AnimatedNumber value="—" />);

    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
