import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetRegressionModeCache } from './regressionMode';

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  resetRegressionModeCache();
});

describe('usesFixtureData', () => {
  it('产品构建且无 fixture 参数时为 false', async () => {
    vi.stubEnv('VITE_DEMO_MODE', '');
    const { usesFixtureData } = await import('./fixtureSource');
    expect(usesFixtureData()).toBe(false);
  });

  it('演示构建为 true，即使地址栏没有 fixture=1', async () => {
    vi.stubEnv('VITE_DEMO_MODE', '1');
    const { usesFixtureData } = await import('./fixtureSource');
    expect(usesFixtureData()).toBe(true);
  });
});
