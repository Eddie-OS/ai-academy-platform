import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { AppShell } from './AppShell';
import { OPERATION_PAGES } from './navigation';
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
      <AppShell />
    </MemoryRouter>,
  );
}

/**
 * 阶段 1 人工验收动作 4：用用户账号登录，写操作入口必须**不渲染**，而不是渲染出来再置灰。
 *
 * <p>为什么要盯住「不是置灰」：置灰的按钮仍然告诉使用者「这里有个操作，只是你不能点」，
 * 而共享账号下这句话是错的——两个账号是同一批人在用，运营要做这件事只会换账号登录，
 * 灰按钮只剩下误导。设计规范 7.5 与纪律 PMI-5 因此都要求整个入口消失。
 *
 * <p>入口隐藏分四层，各有自己的测试：侧栏菜单项（本文件）、路由兜底（{@code OperatorOnly.test}）、
 * 表格里的操作列（{@code DataTable.test}）、单个动作按钮（{@code ActionGuard.test}）。
 */
describe('AppShell（壳层的写操作入口可见性）', () => {
  beforeEach(() => {
    useAuthStore.setState({ account: null, resolved: false });
  });

  // 每个用例都先 await 一次查询：AntD 的 Menu 挂载后会异步量测一次宽度，
  // 同步断言会让那次更新落在 act 之外，刷出一屏 act 警告把真正的报错埋掉
  it('用户账号：侧栏没有导入中心与配置中心，且明说写入口已隐藏', async () => {
    renderShell(false);
    await screen.findByText('当前为只读账号，写操作入口已隐藏。');

    expect(screen.queryByRole('link', { name: '导入中心' })).toBeNull();
    expect(screen.queryByRole('link', { name: '配置中心' })).toBeNull();
    expect(screen.getByText('用户账号')).toBeInTheDocument();
  });

  it('运营账号：两个运营专属入口都在，只读提示不出现', async () => {
    renderShell(true);
    await screen.findByRole('link', { name: '导入中心' });

    expect(screen.getByRole('link', { name: '导入中心' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '配置中心' })).toBeInTheDocument();
    expect(screen.queryByText('当前为只读账号，写操作入口已隐藏。')).toBeNull();
  });

  it('用户账号下壳层里没有任何被置灰的控件——隐藏靠不渲染，不靠 disabled', async () => {
    const { container } = renderShell(false);
    await screen.findByText('当前为只读账号，写操作入口已隐藏。');

    const greyedOut = container.querySelectorAll(
      '[disabled], [aria-disabled="true"], .ant-btn-disabled, .ant-menu-item-disabled',
    );
    expect(Array.from(greyedOut).map((node) => node.textContent)).toEqual([]);
  });

  it('两个运营专属页面就是 navigation 里标了 operatorOnly 的那两个，不靠测试另抄一份清单', async () => {
    // 断言的是「侧栏过滤条件与配置同源」。写死 ['/imports','/settings'] 的话，
    // 以后新增一个运营专属页而忘了在 AppShell 过滤，这个测试仍然是绿的
    const operatorOnlyPaths = OPERATION_PAGES.filter((page) => page.operatorOnly).map(
      (page) => page.path,
    );
    expect(operatorOnlyPaths).toEqual(['/imports', '/settings']);

    renderShell(false);
    await screen.findByText('当前为只读账号，写操作入口已隐藏。');
    const visible = OPERATION_PAGES.filter(
      (page) => screen.queryByRole('link', { name: page.title }) !== null,
    ).map((page) => page.path);
    expect(visible.some((path) => operatorOnlyPaths.includes(path))).toBe(false);
  });
});
