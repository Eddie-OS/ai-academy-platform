import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from '@/app/ErrorBoundary';

/**
 * 这组用例守的是「一个组件崩掉不许拖垮整页」。
 *
 * <p>React 抛错时会往 console.error 打两条（自己一条、屏障一条），测试里静音，
 * 否则输出淹没真实失败。
 */

function Boom({ message = '崩溃了' }: { message?: string }): JSX.Element {
  throw new Error(message);
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('子树正常时原样渲染，不插入任何东西', () => {
    render(
      <ErrorBoundary>
        <p>正常内容</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('正常内容')).toBeInTheDocument();
    expect(screen.queryByTestId('error-boundary')).not.toBeInTheDocument();
  });

  it('子组件抛错时降级为错误页，而不是白屏', () => {
    render(
      <ErrorBoundary>
        <Boom message="Cannot read properties of null (reading 'toLocaleString')" />
      </ErrorBoundary>,
    );

    expect(screen.getByTestId('error-boundary')).toBeInTheDocument();
    expect(screen.getByTestId('page-state')).toHaveAttribute('data-variant', 'error');
    // 报障时运营要能把这行字念给管理员，藏进控制台等于没有
    expect(
      screen.getByText("Cannot read properties of null (reading 'toLocaleString')"),
    ).toBeInTheDocument();
  });

  it('崩溃被围在屏障内，同层的兄弟节点照常渲染', () => {
    render(
      <div>
        <nav>侧栏还在</nav>
        <ErrorBoundary>
          <Boom />
        </ErrorBoundary>
      </div>,
    );
    expect(screen.getByText('侧栏还在')).toBeInTheDocument();
  });

  it('resetKey 变化即恢复：换页不该还停在上一页的错误上', () => {
    function Harness() {
      const [path, setPath] = useState('/dashboard');
      return (
        <>
          <button onClick={() => setPath('/courses')}>切页</button>
          <ErrorBoundary resetKey={path}>
            {path === '/dashboard' ? <Boom /> : <p>课程驾驶舱</p>}
          </ErrorBoundary>
        </>
      );
    }

    render(<Harness />);
    expect(screen.getByTestId('error-boundary')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '切页' }));

    expect(screen.getByText('课程驾驶舱')).toBeInTheDocument();
    expect(screen.queryByTestId('error-boundary')).not.toBeInTheDocument();
  });
});
