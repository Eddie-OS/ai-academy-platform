import { beforeEach, describe, expect, it } from 'vitest';
import { App as AntdApp } from 'antd';
import { fireEvent, render, screen } from '@testing-library/react';
import { DataTable, type DataTableColumn } from './DataTable';
import { readDensity } from './density';
import { useAuthStore } from '@/shared/store/authStore';
import type { AccountInfo } from '@/shared/api/types';

interface Row {
  id: string;
  name: string;
  owner: string | null;
  count: number;
}

const rows: Row[] = [
  { id: '1', name: '课程开发计划', owner: null, count: 0 },
  { id: '2', name: '讲师池盘点', owner: '张三', count: 12 },
];

const columns: DataTableColumn<Row>[] = [
  { key: 'name', title: '名称', kind: 'name', dataIndex: 'name' },
  { key: 'owner', title: '负责人', kind: 'person', dataIndex: 'owner' },
  { key: 'count', title: '数量', kind: 'number', dataIndex: 'count' },
  { key: 'actions', title: '操作', kind: 'actions', operatorOnly: true, render: () => <a>编辑</a> },
];

function account(operator: boolean): AccountInfo {
  return {
    username: operator ? 'operator' : 'viewer',
    displayName: operator ? '运营' : '用户',
    accountType: operator ? 'OPERATOR' : 'VIEWER',
    typeLabel: operator ? '运营账号' : '用户账号',
    operator,
  };
}

function renderTable(props: Partial<Parameters<typeof DataTable<Row>>[0]> = {}) {
  return render(
    <AntdApp>
      <DataTable<Row>
        storageKey="test-page"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        total={rows.length}
        pageNum={1}
        pageSize={20}
        onPageChange={() => {}}
        objectName="记录"
        {...props}
      />
    </AntdApp>,
  );
}

describe('DataTable（统一表格）', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAuthStore.setState({ account: account(true), resolved: true });
  });

  it('空值统一渲染成 em dash，零值照原样显示', () => {
    renderTable();
    // 规范 5.6：不显示空白、不显示「无」「暂无」「null」「-」
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.queryByText('null')).toBeNull();
    expect(screen.queryByText('无')).toBeNull();
  });

  it('加载中显示骨架屏，且保留表头与列数——列宽一致靠的就是同一套列定义', () => {
    renderTable({ rows: undefined, loading: true });

    expect(screen.getByRole('columnheader', { name: '名称' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '数量' })).toBeInTheDocument();
    // 5 行 × 4 列（运营账号能看到操作列）
    expect(screen.getAllByTestId('skeleton-bar')).toHaveLength(20);
  });

  it('密度偏好按页面存本地：换一个 storageKey 就是另一份偏好', () => {
    renderTable();
    fireEvent.click(screen.getByText('紧凑'));

    expect(readDensity('test-page')).toBe('compact');
    expect(readDensity('another-page')).toBe('default');
  });

  it('「还没有数据」与「未找到符合条件的记录」是两个不同的空态', () => {
    const { unmount } = renderTable({ rows: [], total: 0 });
    expect(screen.getByTestId('page-state')).toHaveAttribute('data-variant', 'empty');
    expect(screen.getByText('还没有记录')).toBeInTheDocument();
    unmount();

    renderTable({ rows: [], total: 0, filtered: true, onResetFilters: () => {} });
    expect(screen.getByTestId('page-state')).toHaveAttribute('data-variant', 'noResult');
    // 无结果的 CTA 是重置筛选，不是新建
    expect(screen.getByRole('button', { name: '重置筛选' })).toBeInTheDocument();
  });

  it('加载失败保留表头，让运营能改条件重试', () => {
    renderTable({ rows: [], total: 0, error: '批次没有取到。', onReload: () => {} });
    expect(screen.getByTestId('page-state')).toHaveAttribute('data-variant', 'error');
    expect(screen.getByRole('columnheader', { name: '名称' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重新加载' })).toBeInTheDocument();
  });

  it('用户账号下选择列与运营专属列整列不渲染，不是置灰', () => {
    useAuthStore.setState({ account: account(false), resolved: true });
    renderTable({ selection: { selectedKeys: [], onChange: () => {} } });

    expect(screen.queryByRole('columnheader', { name: '操作' })).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('运营账号下选择列与运营专属列都在', () => {
    renderTable({ selection: { selectedKeys: [], onChange: () => {} } });

    expect(screen.getByRole('columnheader', { name: '操作' })).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox').length).toBeGreaterThan(0);
  });

  it('有选中行时工具条换成批量操作条', () => {
    renderTable({ selection: { selectedKeys: ['1'], onChange: () => {} }, bulkActions: <button>批量撤销</button> });

    expect(screen.getByTestId('table-bulk-bar')).toHaveTextContent('已选 1 项');
    expect(screen.getByRole('button', { name: '批量撤销' })).toBeInTheDocument();
    // 结果计数被批量操作条顶掉了；分页条上的「共 N 条」不受影响，那是另一处
    expect(screen.queryByTestId('table-toolbar-count')).toBeNull();
  });
});
