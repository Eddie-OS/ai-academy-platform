import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import { render, screen } from '@testing-library/react';
import { fieldChangeText, fieldLogOperator, LecturerStateLogTab } from './LecturerStateLogTab';
import type { Lecturer, LecturerFieldLog } from '@/shared/api/lecturers';

const lecturer = {
  id: 1,
  lecturerNo: 'JS0001',
  lecturerName: '张三',
} as Lecturer;

const row: LecturerFieldLog = {
  fieldName: '上岗状态',
  oldValue: '可上岗',
  newValue: '暂停授课',
  accountType: 'OPS',
  operatorNo: '00123456',
  operatorName: '张三',
  operatedAt: '2026-08-05T10:44:00+08:00',
  remark: null,
};

vi.mock('@/shared/api/lecturers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/api/lecturers')>();
  return {
    ...actual,
    lecturerApi: {
      fieldLogs: () => Promise.resolve([row]),
    },
  };
});

describe('讲师状态流转日志', () => {
  it('变更内容按规格句式，时间精确到分', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <App>
          <LecturerStateLogTab lecturer={lecturer} />
        </App>
      </QueryClientProvider>,
    );

    expect(await screen.findByTestId('field-log-item')).toBeTruthy();
    expect(screen.getByText('JS0001')).toBeTruthy();
    expect(screen.getByText('【上岗状态】由 [可上岗] 变更为 [暂停授课]')).toBeTruthy();
    expect(screen.getByText('2026-08-05 10:44')).toBeTruthy();
    expect(screen.getByText('张三 00123456')).toBeTruthy();
    expect(screen.getByText('档案字段改值自动留痕，不是状态机')).toBeTruthy();
  });

  it('句式与操作人回落', () => {
    expect(fieldChangeText({ fieldName: '培养状态', oldValue: '待培养', newValue: '培养中' })).toBe(
      '【培养状态】由 [待培养] 变更为 [培养中]',
    );
    expect(fieldLogOperator({ accountType: 'OPS', operatorNo: null, operatorName: null })).toBe('运营');
    expect(fieldLogOperator({ accountType: 'SYSTEM', operatorNo: null, operatorName: null })).toBe('系统');
  });
});
