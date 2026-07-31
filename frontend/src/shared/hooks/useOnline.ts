import { useEffect, useState } from 'react';

/**
 * 浏览器在线状态。设计规范 7.5 要求网络错误用 Banner 提示而不是弹窗。
 *
 * <p><b>navigator.onLine 只能证伪不能证真</b>：它为 false 时确实断网了，为 true 时也可能
 * 连不上后端（内网服务停了、Nginx 挂了）。因此它只用来显示离线 Banner，
 * 真正的请求失败仍然各自处理——把它当成唯一的网络判据会漏掉「网卡在线但服务不可达」。
 */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return online;
}
