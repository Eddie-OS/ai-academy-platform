import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { cleanup, render, screen } from '@testing-library/react';
import { AppShellV2 } from './AppShellV2';
import { SHELL_NAV_OPERATION } from './shellNav';
import { useAuthStore } from '@/shared/store/authStore';
import type { AccountInfo } from '@/shared/api/types';

function account(operator: boolean): AccountInfo {
  return {
    username: operator ? 'operator' : 'viewer',
    displayName: operator ? '运营' : '用户',
    accountType: operator ? 'OPERATOR' : 'VIEWER',
    typeLabel: operator ? '运营账号' : '用户账号',
    operator,
  };
}

function renderShell(operator: boolean) {
  useAuthStore.setState({ account: account(operator), resolved: true });
  return render(
    <MemoryRouter initialEntries={['/']}>
      <AppShellV2 />
    </MemoryRouter>,
  );
}

/**
 * 阶段 1 人工验收动作 4：用用户账号登录，写操作入口必须**不渲染**，而不是渲染出来再置灰。
 *
 * <p>V2 壳层不再单独画「只读账号」提示条——权限差异只靠入口消失（PMI-5）。
 * 账号类型仍显示在侧栏用户区，便于共享账号下确认自己用的是哪一个。
 */
describe('AppShellV2（壳层的写操作入口可见性）', () => {
  beforeEach(() => {
    useAuthStore.setState({ account: null, resolved: false });
  });

  it('用户账号：侧栏没有导入中心与配置中心', async () => {
    renderShell(false);
    await screen.findByRole('link', { name: 'AI需求' });

    expect(screen.queryByRole('link', { name: '导入中心' })).toBeNull();
    expect(screen.queryByRole('link', { name: '配置中心' })).toBeNull();
    expect(screen.getByText('用户账号')).toBeInTheDocument();
  });

  it('运营账号：两个运营专属入口都在', async () => {
    renderShell(true);
    await screen.findByRole('link', { name: '导入中心' });

    expect(screen.getByRole('link', { name: '导入中心' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '配置中心' })).toBeInTheDocument();
  });

  it('壳层里被置灰的控件与账号类型无关——权限差异靠不渲染，不靠 disabled', async () => {
    const greyedOut = async (operator: boolean) => {
      const { container } = renderShell(operator);
      await screen.findByRole('link', { name: 'AI需求' });
      const nodes = container.querySelectorAll(
        '[disabled], [aria-disabled="true"], .ant-btn-disabled, .ant-menu-item-disabled',
      );
      return Array.from(nodes).map(
        (node) =>
          node.getAttribute('aria-label') ?? node.getAttribute('placeholder') ?? node.textContent,
      );
    };

    const viewer = await greyedOut(false);
    cleanup();
    const operator = await greyedOut(true);

    expect(viewer).toEqual(operator);
  });

  it('两个运营专属页面就是 SHELL_NAV_OPERATION 里标了 operatorOnly 的那两个', async () => {
    const operatorOnlyPaths = SHELL_NAV_OPERATION.filter((page) => page.operatorOnly).map(
      (page) => page.path,
    );
    expect(operatorOnlyPaths).toEqual(['/imports', '/settings']);

    renderShell(false);
    await screen.findByRole('link', { name: 'AI需求' });
    const visible = SHELL_NAV_OPERATION.filter(
      (page) => screen.queryByRole('link', { name: page.label }) !== null,
    ).map((page) => page.path);
    expect(visible.some((path) => operatorOnlyPaths.includes(path))).toBe(false);
  });
});
