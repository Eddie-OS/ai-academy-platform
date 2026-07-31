import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App as AntdApp, ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { antdTheme } from '@/shared/theme/antdTheme';
import { AppRoutes } from '@/app/AppRoutes';
import { PageState } from '@/shared/ui/PageState';
import { useAuthStore } from '@/shared/store/authStore';
import './shared/theme/tokens.css';

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
            <Bootstrap />
          </BrowserRouter>
        </QueryClientProvider>
      </AntdApp>
    </ConfigProvider>
  </StrictMode>,
);
