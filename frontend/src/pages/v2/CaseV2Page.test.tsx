import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { CaseV2Page } from './CaseV2Page';
import { resetRegressionModeCache } from '@/app/regressionMode';

/**
 * P06 整页对齐设计稿（V-65）：六张 KPI + R7 两种模式都渲染。
 *
 * <p>组织覆盖仍是 fixture 版式，不接 org_department（N18）。
 * 新建案例／分享报告只出禁用按钮，对版式不对能力。
 */

function setMode(regression: boolean): void {
  window.history.replaceState({}, '', regression ? '/cases?fixture=1' : '/cases');
  resetRegressionModeCache();
}

describe('P06 案例与组织覆盖整页', () => {
  beforeEach(() => {
    resetRegressionModeCache();
  });

  afterEach(() => {
    cleanup();
    setMode(false);
  });

  it('产品模式也渲染组织覆盖区与六张 KPI', () => {
    setMode(false);
    render(<CaseV2Page />);

    expect(screen.getByTestId('coverage-panel')).toBeTruthy();
    expect(screen.getByText('已覆盖部门数')).toBeTruthy();
    expect(screen.getAllByTestId('case-kpi')).toHaveLength(6);
  });

  it('回归模式同样是六张 KPI + 组织覆盖', () => {
    setMode(true);
    render(<CaseV2Page />);

    expect(screen.getByTestId('coverage-panel')).toBeTruthy();
    expect(screen.getByText('已覆盖部门数')).toBeTruthy();
    expect(screen.getAllByTestId('case-kpi')).toHaveLength(6);
  });

  it('新建案例与分享报告只出禁用按钮，不承诺能力', () => {
    for (const regression of [true, false]) {
      setMode(regression);
      const { unmount } = render(<CaseV2Page />);

      expect(screen.getByTestId('case-cards'), `regression=${regression}`).toBeTruthy();
      expect(screen.getByTestId('detail-title'), `regression=${regression}`).toBeTruthy();

      const createBtn = screen.getByRole('button', { name: '新建案例' });
      expect(createBtn).toBeDisabled();
      expect(createBtn).toHaveAttribute('title', expect.stringContaining('自动创建'));

      const shareBtn = screen.getByRole('button', { name: '分享报告' });
      expect(shareBtn).toBeDisabled();

      expect(screen.getByRole('button', { name: '生成总结报告' })).toBeEnabled();
      expect(screen.getByRole('button', { name: '更新报告' })).toBeEnabled();

      unmount();
    }
  });
});
