import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { LecturerV2Page } from './LecturerV2Page';
import { resetRegressionModeCache } from '@/app/regressionMode';
import { requestShellCreate } from '@/app/shell/shellCreate';
import { LECTURER_POOL, LECTURER_PRODUCT_TABS, lecturerLevelOf } from '@/fixtures/lecturer';
import { avatarUrlOf } from '@/fixtures/people';
import { FIXTURE_ACCOUNT } from '@/fixtures/account';
import { useAuthStore } from '@/shared/store/authStore';

vi.mock('@/features/lecturer/LecturerFormModal', () => ({
  LecturerFormModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="lecturer-form-modal">新建讲师基础档案</div> : null,
}));

/**
 * P04 里唯一分模式渲染的东西：R7 底部的「讲师成长建议」。
 *
 * <p>讲师能力评估与培养建议随二期上线（需求 N6、10.1）。回归模式保留它是为了 R7 的
 * 753px 版式能对上像素；<b>产品模式渲染出来就是「平台会给培养建议」的承诺</b>，
 * 而一期背后没有任何模型 —— 连能力标签都没有。裁决口径与 P06 的组织覆盖区（V-8）一致。
 *
 * <p>这一条不能放在 Playwright 里：{@code isRegressionMode()} 在首帧就定格了，
 * 摘掉 {@code data-regression} 只换 CSS 不换数据源。只有在这里能真的换掉模式。
 */

function setMode(regression: boolean): void {
  window.history.replaceState({}, '', regression ? '/lecturers?fixture=1' : '/lecturers');
  resetRegressionModeCache();
}

// 卡片列表读 ?focus= 决定选中哪位讲师，用 BrowserRouter 是为了让它和 setMode 看同一个
// window.location —— MemoryRouter 自带一份内存历史，?fixture=1 传不进去
function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <LecturerV2Page />
      </BrowserRouter>
    </QueryClientProvider>,
  );
}

describe('P04 成长建议的模式开关', () => {
  beforeEach(() => {
    resetRegressionModeCache();
  });

  afterEach(() => {
    cleanup();
    setMode(false);
    useAuthStore.setState({ account: null, resolved: false });
  });

  it('产品模式不渲染成长建议', () => {
    setMode(false);
    renderPage();

    expect(screen.queryByTestId('growth-advice')).toBeNull();
    expect(screen.queryByText(/建议尝试开发进阶实战类课程/)).toBeNull();
  });

  it('回归模式渲染成长建议', () => {
    setMode(true);
    renderPage();

    expect(screen.getByTestId('growth-advice')).toBeTruthy();
  });

  /*
   * 回归模式仍是「试讲记录 + 授课记录」同屏，p04 像素基线钉的就是这一版。
   * 产品模式默认停在「基本信息」，其余页签要点进去才渲染。
   * 回归仍是四个页签；产品是七个。
   */
  it('回归模式详情同屏出试讲与授课，产品模式默认出基本信息', () => {
    setMode(true);
    const frozen = renderPage();
    expect(screen.getByTestId('trial-timeline')).toBeTruthy();
    expect(screen.getByTestId('teaching-block')).toBeTruthy();
    expect(screen.getAllByTestId('lecturer-tab')).toHaveLength(4);
    expect(screen.getAllByTestId('lecturer-card')).toHaveLength(LECTURER_POOL.length);
    frozen.unmount();

    setMode(false);
    renderPage();
    expect(screen.getByTestId('lecturer-basic')).toBeTruthy();
    expect(screen.queryByTestId('trial-timeline')).toBeNull();
    expect(screen.getAllByTestId('lecturer-tab').map((tab) => tab.textContent)).toEqual([
      '基本信息',
      '试讲记录',
      '培养计划与培养记录',
      '认证记录',
      '等级变更记录',
      '授课记录与学员反馈',
      '状态流转日志',
    ]);
    expect(screen.getAllByTestId('lecturer-card')).toHaveLength(LECTURER_POOL.length);
    expect(screen.queryByTestId('lecturer-group')).toBeNull();
  });

  it('产品模式讲师池平铺全部卡片，回归模式仍按领域分组', () => {
    setMode(false);
    renderPage();
    expect(screen.queryByTestId('lecturer-group')).toBeNull();
    expect(screen.getAllByTestId('lecturer-card')).toHaveLength(LECTURER_POOL.length);
    cleanup();

    setMode(true);
    renderPage();
    expect(screen.getAllByTestId('lecturer-group').length).toBe(7);
    expect(screen.getAllByTestId('lecturer-card')).toHaveLength(LECTURER_POOL.length);
  });

  it('产品模式七个详情页签能切开，流转日志说明讲师没有状态机', () => {
    setMode(false);
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: '培养计划与培养记录' }));
    expect(screen.getByTestId('cultivation-block')).toHaveTextContent('培养计划');
    expect(screen.getByTestId('cultivation-block')).toHaveTextContent('计划培养周期');
    expect(screen.getByTestId('cultivation-block')).toHaveTextContent('培养类型');

    fireEvent.click(screen.getByRole('button', { name: '认证记录' }));
    expect(screen.getByTestId('cert-block')).toHaveTextContent('认证批次');
    expect(screen.getByTestId('cert-block')).toHaveTextContent('2026-08 批次');
    expect(screen.getByTestId('cert-block')).toHaveTextContent('认证有效期');
    expect(screen.getByTestId('cert-block')).toHaveTextContent('讲师等级');

    fireEvent.click(screen.getByRole('button', { name: '等级变更记录' }));
    expect(screen.getByTestId('level-log-block')).toHaveTextContent('变更记录编号');
    expect(screen.getByTestId('level-log-block')).toHaveTextContent('BG0001');
    expect(screen.getByTestId('level-log-block')).toHaveTextContent('变更后等级');
    expect(screen.getByTestId('level-log-block')).toHaveTextContent('记录创建人');

    fireEvent.click(screen.getByRole('button', { name: '授课记录与学员反馈' }));
    expect(screen.getByTestId('teaching-block')).toBeTruthy();
    expect(screen.getByTestId('teaching-block')).toHaveTextContent('讲师ID');
    expect(screen.getByTestId('teaching-block')).toHaveTextContent('课程名称');
    expect(screen.getByTestId('teaching-block')).toHaveTextContent('查看全部授课记录');
    expect(screen.queryByTestId('teaching-extra')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '查看全部授课记录' }));
    expect(screen.getAllByTestId('teaching-extra')[0]).toHaveTextContent('授课类型');
    expect(screen.getByTestId('evaluation-block')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '状态流转日志' }));
    expect(screen.getByTestId('state-log-block')).toHaveTextContent('【上岗状态】由 [可上岗] 变更为 [暂停授课]');
    expect(screen.getByTestId('state-log-block')).toHaveTextContent('【培养状态】');
    expect(screen.getByTestId('state-log-block')).toHaveTextContent('【认证状态】');
    expect(screen.getByTestId('state-log-block')).toHaveTextContent('操作人：张三 00123456');

    fireEvent.click(screen.getByRole('button', { name: '试讲记录' }));
    expect(screen.getByTestId('trial-timeline')).toHaveTextContent('课程名称');
    expect(screen.getByTestId('trial-timeline')).toHaveTextContent('整体满意度');
    expect(screen.getByTestId('trial-timeline')).toHaveTextContent('优化建议');
    expect(screen.getByTestId('trial-timeline')).toHaveTextContent('试讲时间');
    expect(screen.getByTestId('trial-timeline')).toHaveTextContent('门店 AI 导购助手实战');
  });

  it('回归模式试讲时间线仍是专家意见与参与人', () => {
    setMode(true);
    renderPage();
    const timeline = screen.getByTestId('trial-timeline');
    expect(timeline).toHaveTextContent('专家意见');
    expect(timeline).toHaveTextContent('参与人');
    expect(timeline).not.toHaveTextContent('整体满意度');
    expect(timeline).not.toHaveTextContent('课程名称：');
  });

  it('产品模式试讲台账列名对齐课程试讲，查看跳到课程工作台', () => {
    setMode(false);
    renderPage();
    const ledger = screen.getByRole('region', { name: '试讲台账' });
    expect(ledger).toHaveTextContent('试讲轮数');
    expect(ledger).toHaveTextContent('讲师试讲是否合格');
    expect(ledger).toHaveTextContent('课程是否满足发布要求');
    expect(ledger).toHaveTextContent('试讲时间');
    expect(ledger).not.toHaveTextContent('结论一致');
    expect(ledger).not.toHaveTextContent('讲师结论');
    expect(ledger).not.toHaveTextContent('评审日期');
    expect(within(ledger).getAllByText('是').length).toBeGreaterThan(0);
    expect(within(ledger).getAllByText('否').length).toBeGreaterThan(0);
    const view = within(ledger).getAllByRole('link', { name: '查看' })[0];
    expect(view).toHaveAttribute('href', expect.stringContaining('/courses?'));
    expect(view).toHaveAttribute('href', expect.stringContaining('tab='));
    expect(view).toHaveAttribute('href', expect.stringContaining('focus='));
  });

  it('产品模式 KPI 脚注写成「月度环比（较上月）」', () => {
    setMode(false);
    renderPage();
    expect(screen.getAllByText('月度环比（较上月）')).toHaveLength(4);
    expect(screen.getByText('讲师池人数')).toBeTruthy();
    expect(screen.getByText('试讲合格讲师数')).toBeTruthy();
    expect(screen.getByText('可上岗讲师数')).toBeTruthy();
    expect(screen.getByText('讲师综合评分')).toBeTruthy();
    expect(screen.queryByRole('link', { name: /^查看全部$/ })).toBeNull();
    expect(screen.queryByRole('button', { name: '上一页' })).toBeNull();
    expect(screen.queryByRole('button', { name: '下一页' })).toBeNull();
  });

  it('产品模式讲师卡含培养与认证展示，综合评分在最下，没有授课次数', () => {
    setMode(false);
    renderPage();
    const liyue = document.querySelector("[data-lecturer='JS0431']");
    expect(liyue).toBeTruthy();
    expect(liyue).toHaveTextContent('JS0431');
    expect(liyue).toHaveTextContent('L4');
    expect(liyue).toHaveTextContent('合格');
    expect(liyue).toHaveTextContent('可上岗');
    expect(liyue).toHaveTextContent('培养状态');
    expect(liyue).toHaveTextContent('认证状态');
    expect(liyue).toHaveTextContent('已认证');
    expect(liyue).toHaveTextContent('综合评分');
    expect(liyue).toHaveTextContent('4.86 / 5');
    expect(liyue).not.toHaveTextContent('授课次数');
    expect(liyue).not.toHaveTextContent('学员人次');

    const liuyang = document.querySelector("[data-lecturer='JS0402']");
    expect(liuyang).toHaveTextContent('培养中');
    expect(liuyang).toHaveTextContent('认证中');
  });

  it('点另一张讲师卡，右侧详情换成这个人，点字段不弹窗', () => {
    setMode(false);
    renderPage();
    const wangyu = LECTURER_POOL.find((card) => card.name === '王宇');
    expect(wangyu).toBeTruthy();

    const card = document.querySelector(`[data-lecturer='${wangyu!.id}']`);
    expect(card).toBeTruthy();
    fireEvent.click(card!);
    expect(card).toHaveAttribute('data-selected', 'true');
    expect(screen.getByTestId('lecturer-basic')).toHaveTextContent('王宇');
    expect(screen.getByTestId('lecturer-basic')).toHaveTextContent('讲师ID');
    expect(screen.getByTestId('lecturer-basic')).toHaveTextContent('上岗状态');
    expect(screen.getByTestId('lecturer-basic')).toHaveTextContent('讲师简介');
    expect(screen.getByTestId('lecturer-basic')).not.toHaveTextContent('讲师头像');

    fireEvent.click(screen.getAllByTestId('lecturer-field')[0]!);
    expect(screen.queryByTestId('lecturer-field-peek')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '培养计划与培养记录' }));
    expect(screen.getByTestId('cultivation-block')).toHaveTextContent('王宇');
    expect(screen.getByTestId('cultivation-block')).toHaveTextContent('培养计划');
    expect(screen.getByTestId('cultivation-block')).not.toHaveTextContent('暂无培养计划');

    fireEvent.click(screen.getByRole('button', { name: '认证记录' }));
    expect(screen.getByTestId('cert-block')).toHaveTextContent('认证批次');
    expect(screen.getByTestId('cert-block')).not.toHaveTextContent('暂无认证记录');

    fireEvent.click(screen.getByRole('button', { name: '等级变更记录' }));
    expect(screen.getByTestId('level-log-block')).toHaveTextContent('变更记录编号');
    expect(screen.getByTestId('level-log-block')).not.toHaveTextContent('暂无等级变更记录');

    fireEvent.click(screen.getByRole('button', { name: '授课记录与学员反馈' }));
    expect(screen.getAllByTestId('teaching-row')).toHaveLength(3);
    expect(screen.getByTestId('evaluation-block')).toHaveTextContent('门店学员甲');

    fireEvent.click(screen.getByRole('button', { name: '状态流转日志' }));
    expect(screen.getByTestId('state-log-block')).toHaveTextContent('【上岗状态】');
    expect(screen.getByTestId('state-log-block')).toHaveTextContent('【培养状态】');
    expect(screen.getByTestId('state-log-block')).toHaveTextContent('【认证状态】');
    expect(screen.getByTestId('state-log-block')).not.toHaveTextContent('还没有状态变更记录');
  });

  /*
   * 60 张卡各自带一张自己的照片，不是同一张也不是首字占位。
   *
   * 防的是两件事：一是名录里漏了人（那张卡会静默回落成首字，肉眼要逐张比才看得出来），
   * 二是头像映射写成按姓名散列（散列必然碰撞，60 人里会出现两个人共用一张脸）。
   */
  it('产品模式每个详情页签都有编辑，回归模式没有', () => {
    useAuthStore.setState({ account: FIXTURE_ACCOUNT, resolved: true });
    setMode(false);
    renderPage();

    expect(screen.getByTestId('lecturer-tab-edit')).toBeTruthy();
    for (const tab of LECTURER_PRODUCT_TABS) {
      fireEvent.click(screen.getByRole('button', { name: tab }));
      expect(screen.getByTestId('lecturer-tab-edit'), tab).toBeTruthy();
    }
    cleanup();

    setMode(true);
    renderPage();
    expect(screen.queryByTestId('lecturer-tab-edit')).toBeNull();
  });

  it('产品模式顶栏新建打开添加讲师表单，回归模式不接', () => {
    setMode(false);
    renderPage();
    act(() => requestShellCreate());
    expect(screen.getByTestId('lecturer-form-modal')).toBeTruthy();
    cleanup();

    setMode(true);
    renderPage();
    act(() => requestShellCreate());
    expect(screen.queryByTestId('lecturer-form-modal')).toBeNull();
  });

  it('回归模式筛选栏仍是搜索加四下拉加日期', () => {
    setMode(true);
    renderPage();
    const bar = screen.getByRole('region', { name: '讲师筛选' });
    expect(screen.getByPlaceholderText('搜索讲师姓名 / 擅长领域')).toBeTruthy();
    expect(screen.getAllByTestId('lecturer-filter')).toHaveLength(4);
    expect(bar).toHaveTextContent('授课次数');
    expect(bar).toHaveTextContent('日期');
    expect(bar).toHaveTextContent('试讲合格标记');
    expect(screen.queryByLabelText('上岗状态')).toBeNull();
  });

  it('产品模式筛选栏是七项加按讲师ID／姓名搜索', () => {
    setMode(false);
    renderPage();
    expect(screen.getByPlaceholderText('搜索ID / 姓名')).toBeTruthy();
    expect(screen.getByLabelText('来源部门')).toBeTruthy();
    expect(screen.getByLabelText('擅长领域')).toBeTruthy();
    expect(screen.getByLabelText('试讲情况')).toBeTruthy();
    expect(screen.getByLabelText('讲师等级')).toBeTruthy();
    expect(screen.getByLabelText('培养状态')).toBeTruthy();
    expect(screen.getByLabelText('认证状态')).toBeTruthy();
    expect(screen.getByLabelText('上岗状态')).toBeTruthy();
    expect(screen.getAllByTestId('lecturer-filter')).toHaveLength(7);
    expect(screen.queryByPlaceholderText('搜索讲师姓名 / 擅长领域')).toBeNull();
    expect(screen.queryByText('试讲合格标记')).toBeNull();
  });

  it('产品模式按讲师ID或姓名搜索，并与下拉叠加', () => {
    setMode(false);
    renderPage();

    fireEvent.change(screen.getByLabelText('搜索讲师'), { target: { value: 'JS0431' } });
    expect(screen.getAllByTestId('lecturer-card')).toHaveLength(1);
    expect(document.querySelector("[data-lecturer='JS0431']")).toBeTruthy();
    expect(screen.getByText('共 1 人')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('搜索讲师'), { target: { value: '李玥' } });
    expect(screen.getAllByTestId('lecturer-card')).toHaveLength(1);

    fireEvent.change(screen.getByLabelText('搜索讲师'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('讲师等级'), { target: { value: 'L4' } });
    const levelFour = LECTURER_POOL.filter((card) => lecturerLevelOf(card.teachingCount) === 'L4');
    expect(screen.getAllByTestId('lecturer-card')).toHaveLength(levelFour.length);
    expect(screen.getByText(`共 ${levelFour.length.toLocaleString('en-US')} 人`)).toBeTruthy();
  });

  it('讲师卡的头像各不相同，且都取自人物名录', () => {
    setMode(false);
    renderPage();

    // 按讲师编号取而不是按下标：卡片顺序由分组决定，与池子数组的顺序只是恰好相同
    const byId = new Map(
      screen
        .getAllByTestId('lecturer-card')
        .map((card) => [card.getAttribute('data-lecturer'), card.querySelector('img')?.getAttribute('src') ?? null]),
    );

    expect(byId.size).toBe(LECTURER_POOL.length);

    for (const card of LECTURER_POOL) {
      expect(byId.get(card.id), `${card.name} 的头像与名录不符`).toBe(avatarUrlOf(card.name));
    }

    const sources = [...byId.values()];
    expect(sources.filter((src) => src === null), '有讲师没在名录里，头像回落成了首字').toEqual([]);
    expect(new Set(sources).size, '有讲师共用了同一张头像').toBe(LECTURER_POOL.length);
  });
});
