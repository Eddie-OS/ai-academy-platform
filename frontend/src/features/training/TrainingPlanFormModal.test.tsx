import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import { render, screen } from '@testing-library/react';
import { TrainingPlanFormModal } from './TrainingPlanFormModal';
import { useAuthStore } from '@/shared/store/authStore';
import type { AccountInfo } from '@/shared/api/types';

/**
 * 新建培训计划表单：能改的字段可填，系统字段只展示。
 *
 * <p>状态选项来自 meta，不在用例里断言某个状态字——纪律 STK-1。
 */

vi.mock('./trainingMeta', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./trainingMeta')>();
  return {
    ...actual,
    useStates: () => ['待执行', '执行中', '已完成'],
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

vi.mock('@/shared/api/courses', () => ({
  courseApi: {
    page: vi.fn().mockResolvedValue({ records: [], total: 0, pageNum: 1, pageSize: 20 }),
  },
}));

function operatorAccount(): AccountInfo {
  return {
    username: 'operator',
    displayName: '运营',
    accountType: 'OPERATOR',
    typeLabel: '运营账号',
    operator: true,
  };
}

function renderForm() {
  useAuthStore.setState({ account: operatorAccount(), resolved: true });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <App>
        <TrainingPlanFormModal open onClose={() => undefined} />
      </App>
    </QueryClientProvider>,
  );
}

describe('TrainingPlanFormModal', () => {
  it('新建时列出可填项，系统字段不可改', () => {
    renderForm();
    expect(screen.getByTestId('training-plan-form')).toBeInTheDocument();
    expect(screen.getByLabelText('培训计划名称')).toBeEnabled();
    expect(screen.getByLabelText('培训介绍')).toBeEnabled();
    expect(screen.getByLabelText('培训课程')).toBeEnabled();
    expect(screen.getByLabelText('运营负责人')).toBeEnabled();
    expect(screen.getByPlaceholderText('保存后自动生成')).toBeDisabled();
    expect(screen.getByText('保存后由系统写入初始状态')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('关联场次后自动汇总')).toBeDisabled();
    expect(screen.getByPlaceholderText('导入签到后自动汇总')).toBeDisabled();
    expect(screen.getByPlaceholderText('完成后自动写入')).toBeDisabled();
    expect(screen.getByText('排场次时从讲师池选择')).toBeInTheDocument();
  });
});
