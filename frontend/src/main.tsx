import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App as AntdApp, ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { antdTheme } from '@/shared/theme/antdTheme';
import { AppRoutes } from '@/app/AppRoutes';
import { ErrorBoundary } from '@/app/ErrorBoundary';
import { PageState } from '@/shared/ui/PageState';
import { useAuthStore } from '@/shared/store/authStore';
import { applyRegressionMode } from '@/app/regressionMode';
import '@/shared/theme/fonts';
import './shared/theme/tokens.css';
// tokens-v2.css 必须排在 tokens.css 之后：业务裁决「设计 Token 全部以 V2.0 为准」，
// 两份文档冲突的 5 个值靠这个引入顺序完成覆盖
import './shared/theme/tokens-v2.css';
import './shared/theme/visual-regression.css';

// 在首帧之前打上 data-regression。晚一帧的话第一帧用的是产品壳层尺寸，
// 截图会抓到壳层从 200px 跳到 218px 的中间态
applyRegressionMode();

// ConfigProvider 的 zhCN 管不到日历的星期表头与「今天」——那些字来自 dayjs 自己的语言包。
// 不设这一行，两块排期日历的表头就是 Su Mo Tu，而周视图又是中文的「周一」，同一屏里两套写法
dayjs.locale('zh-cn');

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 指标一律实时计算、不做缓存兜底（U2、C14）。前端也不做长缓存，
      // 否则运营改完数据刷新看到旧值。
      staleTime: 0,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function Bootstrap() {
  const resolved = useAuthStore((state) => state.resolved);
  const bootstrap = useAuthStore((state) => state.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  if (!resolved) {
    // 整页加载只用于首次进入应用（设计规范 7.4），页面内的数据加载走骨架屏
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <PageState variant="loading" />
      </div>
    );
  }

  return <AppRoutes />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfigProvider locale={zhCN} theme={antdTheme}>
      <AntdApp>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            {/* 壳层自身崩掉时的最后一道：内容区那道屏障也一起没了，只能整页降级 */}
            <ErrorBoundary fullscreen>
              <Bootstrap />
            </ErrorBoundary>
          </BrowserRouter>
        </QueryClientProvider>
      </AntdApp>
    </ConfigProvider>
  </StrictMode>,
);
