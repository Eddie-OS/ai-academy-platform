import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import { fireEvent, render, screen } from '@testing-library/react';
import { DemandFormModal } from './DemandFormModal';
import { FIELD_ENUM_KEYS } from '@/shared/api/meta';

/**
 * 登记弹窗的现场口径（D-21）：双列加宽、领域可手填、描述带提示词。
 */

vi.mock('./demandMeta', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./demandMeta')>();
  return {
    ...actual,
    useFieldEnums: () => ({
      data: {
        [FIELD_ENUM_KEYS.demandDomain]: ['零售', 'GTM', '电商', 'MKT', '服务', '渠道', '政企'],
        [FIELD_ENUM_KEYS.demandPriority]: ['P0（紧急重要）', 'P1（重要）', 'P2（一般）'],
        [FIELD_ENUM_KEYS.demandSource]: ['部门提出'],
        [FIELD_ENUM_KEYS.demandType]: ['效率提升'],
      },
      isLoading: false,
    }),
  };
});

function renderModal() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <App>
        <DemandFormModal open onClose={() => undefined} />
      </App>
    </QueryClientProvider>,
  );
}

describe('DemandFormModal', () => {
  it('加宽双列，并展示现场口径字段', async () => {
    renderModal();

    expect(screen.getByText('登记需求')).toBeInTheDocument();
    expect(screen.getByText('需求ID')).toBeInTheDocument();
    expect(screen.getByDisplayValue('保存后自动生成')).toBeDisabled();
    expect(screen.getByText('需求名称')).toBeInTheDocument();
    expect(screen.getByText('需求所属领域')).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole('combobox', { name: '需求所属领域' }));
    expect(await screen.findByTitle('零售')).toBeInTheDocument();
    expect(screen.getByTitle('GTM')).toBeInTheDocument();
    expect(screen.getByTitle('手动输入')).toBeInTheDocument();
    expect(screen.getByText('需求提出人')).toBeInTheDocument();
    expect(screen.getByText('需求负责人')).toBeInTheDocument();
    expect(screen.getByText('业务背景')).toBeInTheDocument();
    expect(screen.getByText('ROI分析')).toBeInTheDocument();
    expect(screen.getByText('附件上传')).toBeInTheDocument();
    expect(screen.getByText('备注')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/【背景】/)).toBeInTheDocument();
    expect(document.querySelector('.demand-form-modal')).toBeTruthy();
    expect(screen.getByRole('button', { name: /保\s*存/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /删\s*除/ })).toBeNull();
  });

  it('编辑时底栏出现删除，新建没有', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <App>
          <DemandFormModal
            open
            demand={{
              id: 1,
              demandNo: 'XQ202609001',
              demandName: '测试需求',
              domainCode: '零售',
              proposerNo: '张三',
              proposerName: '张三',
              proposerDept: null,
              ownerNo: '李四',
              ownerName: '李四',
              proposedDate: '2026-09-01',
              expectFinishDate: '2026-09-30',
              description: '描述',
              demandSource: null,
              demandType: null,
              priority: 'P1（重要）',
              reviewState: '待评审',
              reviewDate: null,
              reviewConclusion: null,
              reviewOpinion: null,
              outlet: null,
              solutionState: null,
              solutionName: null,
              devState: null,
              currentProcessState: null,
              firstOnlineDate: null,
              latestOnlineDate: null,
              optimizeCount: null,
              deliveryMark: null,
              deliveredAt: null,
              archivedAt: null,
              acceptanceState: null,
              acceptorName: null,
              acceptedAt: null,
              acceptanceOpinion: null,
              acceptanceRemark: null,
              acceptanceRound: null,
              courseCount: null,
              hasCourse: null,
              lastStateChangedAt: null,
              updatedAt: '2026-09-01T10:00:00+08:00',
              updatedBy: 'operator',
              version: 0,
              light: 'NONE',
              lightDays: null,
              lightReason: null,
            }}
            onClose={() => undefined}
          />
        </App>
      </QueryClientProvider>,
    );
    expect(screen.getByRole('button', { name: /删\s*除/ })).toBeInTheDocument();
  });
});
