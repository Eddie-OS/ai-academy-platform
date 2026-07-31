import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { OperatorOnly } from './OperatorOnly';
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

function renderGuard() {
  return render(
    <MemoryRouter>
      <OperatorOnly>
        <div>导入中心内容</div>
      </OperatorOnly>
    </MemoryRouter>,
  );
}

/**
 * 设计规范 7.5：用户账号手动改地址栏访问运营专属页面时给 403 状态页。
 *
 * <p>这条要单独测，是因为它的常规路径（侧栏不渲染菜单项）在正常使用下永远不会触发它——
 * 一个从来跑不到的分支，坏了也没人知道。
 */
describe('OperatorOnly（运营专属页面兜底）', () => {
  beforeEach(() => {
    useAuthStore.setState({ resolved: true });
  });

  it('用户账号拿到 403 状态页与返回首页的出口，看不到页面内容', () => {
    useAuthStore.setState({ account: account(false) });
    renderGuard();

    expect(screen.getByTestId('page-state')).toHaveAttribute('data-variant', 'forbidden');
    expect(screen.getByText('该页面仅运营账号可访问')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '返回总看板' })).toBeInTheDocument();
    expect(screen.queryByText('导入中心内容')).toBeNull();
  });

  it('运营账号正常渲染页面内容', () => {
    useAuthStore.setState({ account: account(true) });
    renderGuard();

    expect(screen.getByText('导入中心内容')).toBeInTheDocument();
    expect(screen.queryByTestId('page-state')).toBeNull();
  });

  it('文案不提「如何申请权限」——一期没有申请流程，指向一个不存在的动作只会误导', () => {
    useAuthStore.setState({ account: account(false) });
    renderGuard();

    const text = screen.getByTestId('page-state').textContent ?? '';
    expect(text).not.toMatch(/申请/);
  });
});
