import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OfflineBanner, PageState, type PageStateVariant } from './PageState';

/** 设计规范 7.3、7.4、7.5：七个全局状态页一个都不能少，且各自的下一步动作不同。 */
describe('PageState（七个全局状态页）', () => {
  const variants: PageStateVariant[] = [
    'loading',
    'empty',
    'noResult',
    'forbidden',
    'error',
    'offline',
    'notFound',
  ];

  it('七个变体都能渲染，且带上可断言的变体标记', () => {
    for (const variant of variants) {
      const { unmount } = render(<PageState variant={variant} objectName="需求" />);
      expect(screen.getByTestId('page-state')).toHaveAttribute('data-variant', variant);
      unmount();
    }
  });

  it('空态标题按对象名生成，不是笼统的「暂无数据」', () => {
    render(<PageState variant="empty" objectName="导入批次" />);
    expect(screen.getByText('还没有导入批次')).toBeInTheDocument();
  });

  it('无数据与无结果的标题不同——两者的处境和下一步动作不一样', () => {
    const { unmount } = render(<PageState variant="empty" objectName="课程" />);
    const emptyTitle = screen.getByTestId('page-state').textContent ?? '';
    unmount();

    render(<PageState variant="noResult" />);
    const noResultTitle = screen.getByTestId('page-state').textContent ?? '';

    expect(emptyTitle).not.toBe(noResultTitle);
    expect(noResultTitle).toContain('未找到符合条件的记录');
  });

  it('文案不用感叹号、不用第一人称（7.6）', () => {
    for (const variant of variants) {
      const { unmount } = render(<PageState variant={variant} objectName="需求" />);
      const text = screen.getByTestId('page-state').textContent ?? '';
      expect(text).not.toMatch(/[!！]/);
      expect(text).not.toMatch(/我们/);
      unmount();
    }
  });

  it('网络错误用 Banner 而不是弹窗，且带重试', () => {
    render(<OfflineBanner onRetry={() => {}} />);
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
