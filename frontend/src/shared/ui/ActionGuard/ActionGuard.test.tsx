import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ActionGuard, resolveAction } from './ActionGuard';
import type { ActionAvailability } from '@/shared/api/types';

const availability: ActionAvailability = {
  allowedActions: ['提交评审'],
  blockedActions: [{ action: '关闭课程', reason: '当前状态为「开发中」，需先完成发布' }],
};

/**
 * 开发实施文档 4.3.2：ActionGuard 是状态门不是权限门。
 *
 * <p>最后一条测试是这个组件存在的理由：它不读账号类型。如果哪天有人在这里加上
 * 「运营才渲染」的判断，权限判定就从「后端一处」变成了「后端 + 前端两处」，
 * 而前端那处永远不会被 ArchUnit 或后端测试覆盖到。
 */
describe('ActionGuard（状态门）', () => {
  it('允许的动作可点，被阻止的动作置灰并带出状态原因', () => {
    render(
      <ActionGuard
        availability={availability}
        actions={[
          { action: '提交评审', onClick: () => {} },
          { action: '关闭课程', onClick: () => {} },
        ]}
      />,
    );

    expect(screen.getByRole('button', { name: '提交评审' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '关闭课程' })).toBeDisabled();
    expect(screen.getByTestId('guarded-action-reason')).toHaveAttribute(
      'data-reason',
      '当前状态为「开发中」，需先完成发布',
    );
  });

  it('两个列表都没提到的动作不渲染——不猜「大概可以」', () => {
    render(<ActionGuard availability={availability} actions={[{ action: '归档', onClick: () => {} }]} />);
    expect(screen.queryByRole('button', { name: '归档' })).toBeNull();
  });

  it('详情还没加载出来时不渲染任何动作，而不是先渲染成可点', () => {
    render(<ActionGuard availability={undefined} actions={[{ action: '提交评审', onClick: () => {} }]} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(resolveAction(undefined, '提交评审')).toEqual({ state: 'unknown', reason: null });
  });

  it('判定只看后端返回的可用动作列表，与账号类型无关', () => {
    // 运营账号也一样：后端说「关闭课程」被状态挡住，就必须是灰的
    const onClick = vi.fn();
    render(<ActionGuard availability={availability} actions={[{ action: '关闭课程', onClick }]} />);

    screen.getByRole('button', { name: '关闭课程' }).click();
    expect(onClick).not.toHaveBeenCalled();
  });
});
