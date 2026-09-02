import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetRegressionModeCache } from '@/app/regressionMode';
import { shouldReduceMotion } from './motionPreference';

const originalMatchMedia = window.matchMedia;

afterEach(() => {
  window.history.replaceState({}, '', '/');
  window.matchMedia = originalMatchMedia;
  resetRegressionModeCache();
  vi.restoreAllMocks();
});

describe('shouldReduceMotion', () => {
  it('系统要求减少动态效果时返回 true', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as typeof window.matchMedia;

    expect(shouldReduceMotion()).toBe(true);
    expect(window.matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
  });

  it('自动化客户端里的视觉回归模式返回 true', () => {
    window.history.replaceState({}, '', '/?fixture=1');
    resetRegressionModeCache();

    expect(shouldReduceMotion()).toBe(true);
  });

  it('?motion=1 强制开启动效', () => {
    window.history.replaceState({}, '', '/?fixture=1&motion=1');
    resetRegressionModeCache();
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as typeof window.matchMedia;

    expect(shouldReduceMotion()).toBe(false);
  });

  it('普通产品模式返回 false', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as typeof window.matchMedia;

    expect(shouldReduceMotion()).toBe(false);
  });
});
