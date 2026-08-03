import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import { render, screen, within } from '@testing-library/react';
import { SessionAttendeesTab } from './SessionAttendeesTab';
import { useAuthStore } from '@/shared/store/authStore';
import type { AccountInfo } from '@/shared/api/types';
import type { AttendeeBoard, AttendeeRow } from '@/shared/api/trainings';

/**
 * 需求 11.5：<b>「没有签到记录」与「未签到」是两件事。</b>
 *
 * <p>前者是「这场还没导签到」，后者是「导了，这个人没来」。把没有记录的行渲染成空白或「未签到」，
 * 运营会照着一张全是「未签到」的名单去追人，而实际上只是签到表还没导进来。
 */

const ATTEND_ABSENT = '未签到';

const board = vi.fn<() => Promise<AttendeeBoard>>();

vi.mock('@/shared/api/trainings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/api/trainings')>();
  return {
    ...actual,
    trainingApi: { ...actual.trainingApi, attendees: () => board() },
  };
});

vi.mock('./trainingMeta', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./trainingMeta')>();
  return {
    ...actual,
    useFieldEnums: () => ({ data: {} }),
    useEmployees: () => ({ data: { records: [], total: 0, pageNum: 1, pageSize: 20 } }),
  };
});

function row(overrides: Partial<AttendeeRow>): AttendeeRow {
  return {
    id: 1,
    sessionId: 1,
    employeeNo: 'E001',
    employeeName: '张三',
    deptName: '客服中心',
    joinSource: '运营指派',
    importBatchNo: null,
    createdAt: '2026-08-01T10:00:00+08:00',
    attendanceId: null,
    attendStatus: null,
    attendTime: null,
    attendRemark: null,
    attendanceBatch: null,
    ...overrides,
  };
}

function operatorAccount(): AccountInfo {
  return {
    username: 'operator',
    displayName: '运营',
    accountType: 'OPERATOR',
    typeLabel: '运营账号',
    operator: true,
  };
}

function renderTab() {
  useAuthStore.setState({ account: operatorAccount(), resolved: true });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <App>
        <SessionAttendeesTab sessionId={1} />
      </App>
    </QueryClientProvider>,
  );
}

describe('参训人员与签到页签', () => {
  it('签到还没导入：整列显示「未导入」，并提示去导入中心，而不是把所有人标成未签到', async () => {
    board.mockResolvedValue({
      rows: [row({ id: 1 }), row({ id: 2, employeeNo: 'E002', employeeName: '李四' })],
      total: 2,
      present: 0,
      absent: 0,
      noRecord: 2,
    });
    renderTab();

    expect(await screen.findByText('本场次尚未导入签到')).toBeTruthy();
    // 汇总卡片上也有「未签到」这三个字（那是个计数），因此断言限定在表格内
    const table = within(screen.getByRole('table'));
    expect(table.getAllByText('未导入')).toHaveLength(2);
    expect(table.queryByText(ATTEND_ABSENT)).toBeNull();
  });

  it('签到已导入：未签到的人显示后端给的签到状态，无记录的仍是「未导入」', async () => {
    board.mockResolvedValue({
      rows: [
        row({ id: 1, attendanceId: 11, attendStatus: '已签到', attendTime: '2026-08-10T09:05:00+08:00' }),
        row({ id: 2, employeeNo: 'E002', employeeName: '李四', attendanceId: 12, attendStatus: ATTEND_ABSENT }),
        row({ id: 3, employeeNo: 'E003', employeeName: '王五' }),
      ],
      total: 3,
      present: 1,
      absent: 1,
      noRecord: 1,
    });
    renderTab();
    await screen.findByText('王五');

    const table = within(screen.getByRole('table'));
    expect(table.getByText('已签到')).toBeTruthy();
    expect(table.getByText(ATTEND_ABSENT)).toBeTruthy();
    expect(table.getAllByText('未导入')).toHaveLength(1);
    // 名单不全是无记录，就不该再提示「尚未导入签到」
    expect(screen.queryByText('本场次尚未导入签到')).toBeNull();
  });
});
