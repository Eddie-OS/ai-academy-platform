import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, within } from '@testing-library/react';
import { LecturerCockpitPage } from './LecturerCockpitPage';
import { FIELD_ENUM_KEYS } from '@/shared/api/meta';
import { useAuthStore } from '@/shared/store/authStore';
import type { AccountInfo } from '@/shared/api/types';
import type { Lecturer } from '@/shared/api/lecturers';

/**
 * 讲师驾驶舱与另外四个驾驶舱的两处结构差异，都不是可有可无的细节。
 *
 * <ul>
 *   <li><b>面板里没有状态区、没有状态流转日志页签。</b>培养状态与在池状态不是状态机
 *       （规则 TS1、C10），改值走编辑而不是转换接口，也不写流转日志（TS2）。摆一个空的状态区
 *       或一个永远为空的日志页签，会让人以为讲师也有状态机、只是还没配上；接下来就会有人
 *       去给它补一份转换表，而那正是 TS1 要挡住的事。
 *   <li><b>平均评分为空显示「—」而不是 0.0。</b>「还没有人评过」与「大家都打 0 分」是两回事
 *       （设计规范 3.3），而后者会让一名新讲师在按评分排序的列表里沉到底。
 * </ul>
 */

const NO_SCORE_ID = 2;

const rows: Lecturer[] = [
  lecturer({ id: 1, lecturerNo: 'JS0001', lecturerName: '张三', avgScore: '4.5', teachingCount: 3 }),
  lecturer({
    id: NO_SCORE_ID,
    lecturerNo: 'JS0002',
    lecturerName: '李四',
    // 刚入池、还没人评过：后端给 null，不是 0
    avgScore: null,
    teachingCount: 0,
    attendeeCount: 0,
    trialQualified: false,
    firstQualifiedDate: null,
  }),
];

vi.mock('@/shared/api/lecturers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/api/lecturers')>();
  return {
    ...actual,
    lecturerApi: {
      page: () => Promise.resolve({ records: rows, total: rows.length, pageNum: 1, pageSize: 20 }),
      detail: (id: number) => Promise.resolve(rows.find((row) => row.id === id)!),
      teachingRecords: () => Promise.resolve([]),
      evaluations: () => Promise.resolve([]),
      sourceDepts: () => Promise.resolve(['客服中心']),
      trialLedger: () => Promise.resolve({ records: [], total: 0, pageNum: 1, pageSize: 20 }),
    },
  };
});

vi.mock('@/features/lecturer/lecturerMeta', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/lecturer/lecturerMeta')>();
  return {
    ...actual,
    useFieldEnums: () => ({
      data: {
        [FIELD_ENUM_KEYS.lecturerTrainingState]: ['待培养', '培养中', '可上岗'],
        [FIELD_ENUM_KEYS.lecturerPoolState]: ['在池', '已移出'],
        [FIELD_ENUM_KEYS.lecturerJoinType]: ['课程开发人员自动入池', '运营手动添加', '批量导入'],
        [FIELD_ENUM_KEYS.trialConclusion]: ['合格', '不合格'],
      },
      isLoading: false,
    }),
    useExpertiseDomains: () => ['客服中心'],
    useSourceDepts: () => ({ data: ['客服中心'], isLoading: false }),
    useStates: () => ['待录入结论', '已完成'],
    useEmployees: () => ({ data: { records: [], total: 0, pageNum: 1, pageSize: 200 }, isLoading: false }),
  };
});

function lecturer(overrides: Partial<Lecturer>): Lecturer {
  return {
    id: 1,
    lecturerNo: 'JS0001',
    lecturerName: '张三',
    employeeNo: 'E001',
    sourceDept: '客服中心',
    expertiseDomains: ['客服中心'],
    teachingDirection: '大模型应用落地',
    joinType: '运营手动添加',
    joinedDate: '2026-07-01',
    trainingState: '可上岗',
    trialQualified: true,
    firstQualifiedDate: '2026-07-20',
    teachingCount: 3,
    attendeeCount: 90,
    avgScore: '4.5',
    poolState: '在池',
    removedReason: null,
    importBatchNo: null,
    createdAt: '2026-07-01T10:00:00+08:00',
    updatedAt: '2026-07-01T10:00:00+08:00',
    updatedBy: 'operator',
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

function renderPage(path: string) {
  useAuthStore.setState({ account: operatorAccount(), resolved: true });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <App>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/lecturers" element={<LecturerCockpitPage />} />
            <Route path="/lecturers/:id" element={<LecturerCockpitPage />} />
          </Routes>
        </MemoryRouter>
      </App>
    </QueryClientProvider>,
  );
}

describe('讲师驾驶舱', () => {
  it('详情面板只有需求 10.2 的四个页签，没有状态流转日志', async () => {
    renderPage('/lecturers/1');

    const panel = await screen.findByTestId('cockpit-detail-panel');
    const tabs = within(panel).getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual(['基本信息', '试讲记录', '授课记录', '学员评价']);
  });

  it('面板里没有可执行动作区——讲师的两个枚举字段都不是状态机', async () => {
    renderPage('/lecturers/1');

    const panel = await screen.findByTestId('cockpit-detail-panel');
    // 其余四个驾驶舱的面板顶部都有这块，讲师没有
    expect(within(panel).queryByTestId('action-guard')).toBeNull();
    expect(within(panel).queryByText('可执行动作')).toBeNull();
  });

  it('还没有人评过的讲师，平均评分显示「—」而不是 0.0', async () => {
    renderPage(`/lecturers/${NO_SCORE_ID}`);

    const panel = await screen.findByTestId('cockpit-detail-panel');
    expect(await within(panel).findByText('李四')).toBeTruthy();
    // 累计授课 0 次照常显示 0，只有「没有数据」才是 em dash
    expect(within(panel).getByText('0 次')).toBeTruthy();
    expect(within(panel).queryByText('0.0 / 5')).toBeNull();
    expect(within(panel).queryByText('0 / 5')).toBeNull();
  });
});
