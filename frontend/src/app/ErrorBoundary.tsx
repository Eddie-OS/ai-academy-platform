import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Button } from 'antd';
import { RotateCcw } from 'lucide-react';
import { PageState } from '@/shared/ui/PageState';
import { fontSize, neutral, radius, space } from '@/shared/theme/designTokens';

/**
 * 渲染异常的兜底屏障。
 *
 * <p><b>为什么必须有这一层。</b>React 18 的默认行为是：任意一个组件在渲染中抛错，
 * 整棵树被卸载，页面变成纯白，控制台之外没有任何提示。实际发生过一次——总看板的
 * 预警卡在接口回数之前拿到 {@code count === null}，一句 {@code toLocaleString()}
 * 让整个驾驶舱白屏，运营侧看到的只是「系统坏了」，无法判断坏在哪、能不能绕开。
 * 单个组件的缺陷不该有整页的爆炸半径。
 *
 * <p>屏障挂两处，职责不同：
 * <ul>
 *   <li><b>内容区</b>（{@code AppShellV2} 的 Outlet 外层）——侧栏与顶栏保持可用，
 *       运营能直接切到别的驾驶舱继续干活，不必刷新重登。换页时自动恢复，
 *       靠 {@code resetKey} 传 pathname 实现。</li>
 *   <li><b>根节点</b>（{@code main.tsx}）——接壳层自身的异常。这时没有导航可用，
 *       只能给「重新加载」。</li>
 * </ul>
 *
 * <p>错误摘要照原样显示而不是藏进控制台：这是内网平台，报障链路是运营口述给管理员，
 * 屏幕上没有可念的信息就等于没有线索。只显示 message，不显示调用栈。
 */

interface ErrorBoundaryProps {
  children: ReactNode;
  /** 值变化即清空错误态。内容区屏障传 pathname，换页自动恢复 */
  resetKey?: string;
  /** 壳层之外的根屏障用整屏居中版式 */
  fullscreen?: boolean;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] 渲染异常', error, info.componentStack);
  }

  componentDidUpdate(prev: ErrorBoundaryProps) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  private readonly retry = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const { fullscreen } = this.props;
    const panel = (
      <div data-testid="error-boundary">
        <PageState
          variant="error"
          description="这个页面在渲染时出错了，其余页面不受影响。可以重试一次，或把下面这行信息提供给管理员。"
          action={
            <>
              <Button
                type="primary"
                icon={<RotateCcw size={14} />}
                onClick={fullscreen ? () => window.location.reload() : this.retry}
              >
                {fullscreen ? '重新加载' : '重试'}
              </Button>
              <span style={detailStyle}>{error.message || error.name}</span>
            </>
          }
        />
      </div>
    );

    if (!fullscreen) return panel;
    return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>{panel}</div>;
  }
}

const detailStyle = {
  display: 'block',
  maxWidth: 400,
  marginTop: space.md,
  padding: space.sm,
  borderRadius: radius.sm,
  background: neutral[100],
  color: neutral[600],
  fontSize: fontSize.caption,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  wordBreak: 'break-all' as const,
  textAlign: 'left' as const,
};
