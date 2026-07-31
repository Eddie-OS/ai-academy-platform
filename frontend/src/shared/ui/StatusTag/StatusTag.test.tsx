import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusTag } from './StatusTag';
import { brand, semantic } from '@/shared/theme/designTokens';

/** 设计规范 2.10 的 SV1、SV3、SV4。 */
describe('StatusTag（三组状态标签）', () => {
  it('SV1：课程有效期的「有效」与「未发布」不显示标签', () => {
    for (const value of ['有效', '未发布']) {
      const { container, unmount } = render(<StatusTag group="courseValidity" value={value} />);
      expect(container).toBeEmptyDOMElement();
      unmount();
    }

    render(<StatusTag group="courseValidity" value="已过期" />);
    expect(screen.getByTestId('status-tag')).toHaveTextContent('已过期');
  });

  it('SV3：培养状态一律不用语义色，「可上岗」用品牌色而不是成功绿', () => {
    render(<StatusTag group="lecturerTraining" value="可上岗" />);
    const tag = screen.getByTestId('status-tag');
    expect(tag).toHaveStyle({ backgroundColor: brand[100] });
    expect(tag).not.toHaveStyle({ backgroundColor: semantic.success.bg });
  });

  it('SV4：案例「待审核」用蓝色系，不与「已逾期」的黄色混用', () => {
    render(<StatusTag group="caseStatus" value="待审核" />);
    expect(screen.getByTestId('status-tag')).toHaveStyle({ backgroundColor: semantic.info.bg });
  });

  it('认不出的取值不渲染，也不兜底成灰标签', () => {
    // 出现未知取值意味着前后端枚举已经不一致，显示一个灰标签会把这个问题藏起来
    const { container } = render(<StatusTag group="caseStatus" value="待定" />);
    expect(container).toBeEmptyDOMElement();
  });
});
