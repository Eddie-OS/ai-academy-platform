import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import { CaseCockpitPage } from './CaseCockpitPage';
import { FIELD_ENUM_KEYS } from '@/shared/api/meta';
import { useAuthStore } from '@/shared/store/authStore';
import type { AccountInfo } from '@/shared/api/types';
import type { CaseInfo } from '@/shared/api/cases';

/**
 * 案例驾驶舱的三条结构约束，每一条都对应一个「顺手做了就会破」的边界。
 *
 * <ul>
 *   <li><b>页面上没有「新建案例」。</b>案例的唯一来源是课程被标注达到精品标准（议题 27、N10）。
 *       补一个新建入口能编译、能跑通，代价是手工建出来的案例没有来源课程，
 *       之后每一张按课程口径统计的图都会少算它，而且没有任何报错提示这件事。
 *   <li><b>详情面板正好是需求 12.2 P5-3 的四个区块。</b>
 *   <li><b>离开案例时回报停留时长。</b>不报的话平均阅读时长永远是「—」，
 *       而那是案例驾驶舱六个互动指标里唯一能说明「有没有人真的在读」的一个。
 * </ul>
 */

const CASE_ID = 7;
const VIEW_ID = 991;

const reportDuration = vi.fn(() => Promise.resolve());

const rows: CaseInfo[] = [caseInfo({})];

vi.mock('@/shared/api/cases', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/api/cases')>();
  return {
    ...actual,
    caseApi: {
      page: () => Promise.resolve({ records: rows, total: rows.length, pageNum: 1, pageSize: 12 }),
      detail: () => Promise.resolve({ ...rows[0], viewId: VIEW_ID }),
      interactions: () =>
        Promise.resolve({ viewCount: 0, likeCount: 0, commentCount: 0, readSeconds: 0, avgReadSeconds: null }),
      comments: () => Promise.resolve([]),
      reports: () => Promise.resolve([]),
      reportDuration: (...args: unknown[]) => reportDuration(...(args as [])),
    },
  };
});

vi.mock('@/shared/api/transitions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/api/transitions')>();
  return {
    ...actual,
    transitionApi: {
      available: () =>
        Promise.resolve({
          objectType: 'CASE',
          objectId: CASE_ID,
          version: 0,
          fields: [
            {
              stateField: '案例状态',
              machineName: '案例状态机',
              currentState: '整理中',
              terminal: false,
              allowedActions: ['提交审核'],
              blockedActions: [],
              actions: [{ action: 'SUBMIT_AUDIT', label: '提交审核', toState: '待审核' }],
            },
          ],
        }),
    },
  };
});

vi.mock('@/shared/api/attachments', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/api/attachments')>();
  return { ...actual, attachmentApi: { ...actual.attachmentApi, listOf: () => Promise.resolve([]) } };
});

vi.mock('@/features/kase/caseMeta', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/kase/caseMeta')>();
  return {
    ...actual,
    useFieldEnums: () => ({
      data: {
        [FIELD_ENUM_KEYS.caseAuditResult]: ['通过', '不通过'],
        [FIELD_ENUM_KEYS.caseQualityMark]: ['精品案例', '优秀案例'],
        [FIELD_ENUM_KEYS.caseBoardSort]: ['推荐', '最新', '最多点赞', '最多评论'],
        [FIELD_ENUM_KEYS.caseReportGenerateMode]: ['自动生成', '手动编辑'],
      },
      isLoading: false,
    }),
    useCaseDomains: () => [{ code: 'KFZX', name: '客服中心' }],
    useDomainNames: () => (code: string) => (code === 'KFZX' ? '客服中心' : code),
    useStates: () => ['待整理', '整理中', '待审核', '已上架'],
    useEmployees: () => ({ data: { records: [], total: 0, pageNum: 1, pageSize: 200 }, isLoading: false }),
  };
});

function caseInfo(overrides: Partial<CaseInfo>): CaseInfo {
  return {
    id: CASE_ID,
    caseNo: 'AL202608001',
    caseName: '智能客服质检落地',
    courseId: 3,
    courseName: '智能客服质检实战',
    contributingOrg: '客服中心',
    contributors: [],
    domainCodes: ['KFZX'],
    ownerNo: 'E001',
    ownerName: '张三',
    caseState: '整理中',
    reviewerNo: null,
    reviewerName: null,
    reviewedAt: null,
    reviewOpinion: null,
    reviewResult: null,
    qualityMarks: [],
    content: '<p>把质检准确率从 62% 提到 91%</p>',
    publishedAt: null,
    expectPublishDate: '2026-08-20',
    viewCount: 0,
    likeCount: 0,
    commentCount: 0,
    readSeconds: 0,
    avgReadSeconds: null,
    createdAt: '2026-08-01T10:00:00+08:00',
    createdBy: 'operator',
    lastStateChangedAt: '2026-08-01T10:00:00+08:00',
    updatedAt: '2026-08-01T10:00:00+08:00',
    updatedBy: 'operator',
    version: 0,
    viewId: null,
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
            <Route path="/cases" element={<CaseCockpitPage />} />
            <Route path="/cases/:id" element={<CaseCockpitPage />} />
          </Routes>
        </MemoryRouter>
      </App>
    </QueryClientProvider>,
  );
}

describe('案例驾驶舱', () => {
  it('运营账号下也没有新建入口——案例只能由课程达精品自动产生', async () => {
    renderPage('/cases');

    expect(await screen.findByText('智能客服质检落地')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /新建/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /添加案例/ })).toBeNull();
  });

  it('详情面板是需求 12.2 P5-3 的四个区块', async () => {
    renderPage(`/cases/${CASE_ID}`);

    const panel = await screen.findByTestId('cockpit-detail-panel');
    const tabs = within(panel).getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual(['基本信息', '正文与附件', '审核信息', '互动与评论']);
  });

  it('两个审核动作不做成转换按钮，引导到录入审核结论', async () => {
    renderPage(`/cases/${CASE_ID}`);

    const panel = await screen.findByTestId('cockpit-detail-panel');
    // 后端说「提交审核」可执行，它照常是按钮
    expect(await within(panel).findByRole('button', { name: '提交审核' })).toBeTruthy();
    // 审核结论必须与状态一起提交，因此那两个动作在状态区里不可直接点
    expect(within(panel).queryByRole('button', { name: '审核通过' })).toBeNull();
  });

  it('离开案例时回报本次停留时长', async () => {
    reportDuration.mockClear();
    const view = renderPage(`/cases/${CASE_ID}`);

    const panel = await screen.findByTestId('cockpit-detail-panel');
    // 详情到位后才有 viewId，早一步卸载就什么都不会上报
    await within(panel).findByText('智能客服质检落地');

    // 测试里从打开到卸载不到一秒，会被「不足一秒不上报」那条挡掉。把时钟往前拨，
    // 测的是「离开时会上报」，不是「渲染有多快」
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now + 42_000);
    view.unmount();
    vi.mocked(Date.now).mockRestore();

    await waitFor(() => expect(reportDuration).toHaveBeenCalled());
    const [caseId, viewId, seconds] = reportDuration.mock.calls[0] as unknown as [number, number, number];
    expect(caseId).toBe(CASE_ID);
    expect(viewId).toBe(VIEW_ID);
    expect(seconds).toBe(42);
  });
});
