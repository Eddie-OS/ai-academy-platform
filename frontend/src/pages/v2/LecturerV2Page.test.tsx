import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { LecturerV2Page } from './LecturerV2Page';
import { resetRegressionModeCache } from '@/app/regressionMode';

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
  return render(
    <BrowserRouter>
      <LecturerV2Page />
    </BrowserRouter>,
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
   * 两种模式下 R7 的其余四块都在。防的是「顺手」把整个详情面板也做成分模式 ——
   * 试讲记录、授课记录是需求 10.2 P3-2 的内容，一期就要有。
   */
  it('两种模式下详情的其余四块都在', () => {
    for (const regression of [true, false]) {
      setMode(regression);
      const { unmount } = renderPage();

      expect(screen.getByTestId('trial-timeline'), `regression=${regression}`).toBeTruthy();
      expect(screen.getByTestId('teaching-block'), `regression=${regression}`).toBeTruthy();
      expect(screen.getAllByTestId('lecturer-tab'), `regression=${regression}`).toHaveLength(4);
      expect(screen.getAllByTestId('lecturer-card'), `regression=${regression}`).toHaveLength(8);

      unmount();
    }
  });
});
