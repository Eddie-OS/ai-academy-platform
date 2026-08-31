import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { LecturerV2Page } from './LecturerV2Page';
import { resetRegressionModeCache } from '@/app/regressionMode';
import { requestShellCreate } from '@/app/shell/shellCreate';
import { LECTURER_POOL } from '@/fixtures/lecturer';
import { avatarUrlOf } from '@/fixtures/people';

vi.mock('@/features/lecturer/LecturerFormModal', () => ({
  LecturerFormModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="lecturer-form-modal">添加讲师</div> : null,
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
   * 产品模式默认停在「基本信息」，另两个页签要点进去才渲染 —— 四个页签本身必须都在。
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
    expect(screen.getAllByTestId('lecturer-tab')).toHaveLength(4);
    expect(screen.getAllByTestId('lecturer-card')).toHaveLength(LECTURER_POOL.length);
  });

  it('产品模式 KPI 脚注写成「月度环比（较上月）」', () => {
    setMode(false);
    renderPage();
    expect(screen.getAllByText('月度环比（较上月）')).toHaveLength(4);
    expect(screen.getByText('讲师池人数')).toBeTruthy();
    expect(screen.getByText('试讲合格讲师数')).toBeTruthy();
    expect(screen.getByText('可上岗讲师数')).toBeTruthy();
    expect(screen.getByText('讲师综合评分')).toBeTruthy();
  });

  it('点另一张讲师卡，右侧详情换成这个人，字段可点开', () => {
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

    fireEvent.click(screen.getAllByTestId('lecturer-field')[0]!);
    expect(screen.getByTestId('lecturer-field-peek')).toHaveTextContent(wangyu!.id);
  });

  /*
   * 60 张卡各自带一张自己的照片，不是同一张也不是首字占位。
   *
   * 防的是两件事：一是名录里漏了人（那张卡会静默回落成首字，肉眼要逐张比才看得出来），
   * 二是头像映射写成按姓名散列（散列必然碰撞，60 人里会出现两个人共用一张脸）。
   */
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
