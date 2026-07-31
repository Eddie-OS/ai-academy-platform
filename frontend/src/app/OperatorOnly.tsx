import type { ReactNode } from 'react';
import { Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useIsOperator } from '@/shared/store/authStore';
import { PageState } from '@/shared/ui/PageState';

/**
 * 运营专属页面的兜底（设计规范 7.5）。
 *
 * <p>导入中心与配置中心的入口在侧栏就不渲染（AppShell 里按 operator 过滤），
 * 因此这里只会被<b>手动改地址栏</b>触发。之所以仍然要有：路由是可以被收藏、被复制粘贴的，
 * 只靠隐藏菜单不算做到「仅运营可访问」。
 *
 * <p>返回的是 403 状态页而不是重定向到首页——静默跳走会让人以为链接坏了。
 */
export function OperatorOnly({ children }: { children: ReactNode }) {
  const isOperator = useIsOperator();
  const navigate = useNavigate();

  if (!isOperator) {
    return (
      <PageState
        variant="forbidden"
        action={
          <Button ghost type="primary" onClick={() => navigate('/')}>
            返回总看板
          </Button>
        }
      />
    );
  }

  return <>{children}</>;
}
