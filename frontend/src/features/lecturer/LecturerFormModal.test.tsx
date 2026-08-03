import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import { fireEvent, render, screen } from '@testing-library/react';
import { LecturerFormModal } from './LecturerFormModal';
import { FIELD_ENUM_KEYS } from '@/shared/api/meta';
import { useAuthStore } from '@/shared/store/authStore';
import type { AccountInfo } from '@/shared/api/types';
import type { Lecturer } from '@/shared/api/lecturers';

/**
 * 讲师表单里两件容易做错的事。
 *
 * <ul>
 *   <li><b>移出原因是条件必填</b>（需求 10.3 第 15 项）：只在在池状态为「已移出」时出现且必填。
 *       难点不是判断本身，而是<b>怎么认出那个取值</b>——按枚举下发的顺序取下标，不比较字面量
 *       （纪律 STK-1）。写死「已移出」三个字的后果不是报错，而是后端有朝一日改了措辞，
 *       界面安静地不再要求填原因，于是讲师池里出现一批没人知道为什么被移出的人。
 *   <li><b>入池方式与试讲合格标记不在表单里</b>（需求 10.4、10.3 第 9 项）：前者由入池路径决定，
 *       后者只能由试讲结论录入产生。做成可填字段等于允许伪造一条不存在的试讲。
 * </ul>
 */

const POOL_IN = '在池';
const POOL_OUT = '已移出';

vi.mock('./lecturerMeta', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./lecturerMeta')>();
  return {
    ...actual,
    useFieldEnums: () => ({
      data: {
        [FIELD_ENUM_KEYS.lecturerTrainingState]: ['待培养', '培养中', '可上岗'],
        // 顺序即后端 LecturerEnums.POOL_STATES 的定义顺序，组件按下标取「已移出」
        [FIELD_ENUM_KEYS.lecturerPoolState]: [POOL_IN, POOL_OUT],
        [FIELD_ENUM_KEYS.lecturerJoinType]: ['课程开发人员自动入池', '运营手动添加', '批量导入'],
      },
      isLoading: false,
    }),
    useExpertiseDomains: () => ['客服中心', '风控'],
    useSourceDepts: () => ({ data: ['客服中心'], isLoading: false }),
    useEmployees: () => ({
      data: {
        records: [
          {
            id: 1,
            employeeNo: 'E001',
            employeeName: '张三',
            deptName: '客服中心',
            personType: '员工',
            personState: '在职',
          },
        ],
        total: 1,
        pageNum: 1,
        pageSize: 200,
      },
      isLoading: false,
    }),
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
    poolState: POOL_IN,
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

function renderModal(value: Lecturer) {
  useAuthStore.setState({ account: operatorAccount(), resolved: true });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <App>
        <LecturerFormModal open lecturer={value} onClose={() => undefined} onUpdated={() => undefined} />
      </App>
    </QueryClientProvider>,
  );
}

describe('讲师表单', () => {
  it('在池时不出现移出原因', async () => {
    renderModal(lecturer({ poolState: POOL_IN }));

    expect(await screen.findByText('讲师姓名')).toBeTruthy();
    expect(screen.queryByText('移出原因')).toBeNull();
  });

  it('已移出时移出原因出现且必填', async () => {
    renderModal(lecturer({ poolState: POOL_OUT, removedReason: null }));

    expect(await screen.findByText('移出原因')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '保 存' }));
    expect(await screen.findByText('移出讲师池时必须填写移出原因')).toBeTruthy();
  });

  it('入池方式与试讲合格标记不是可填字段', async () => {
    renderModal(lecturer({}));

    expect(await screen.findByText('培养状态')).toBeTruthy();
    expect(screen.queryByText('入池方式')).toBeNull();
    expect(screen.queryByText('入池时间')).toBeNull();
    expect(screen.queryByText('试讲合格标记')).toBeNull();
  });
});
