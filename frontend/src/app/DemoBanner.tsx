import type { CSSProperties } from 'react';
import { isDemoMode } from './demoMode';

/**
 * 演示构建的常驻标识。
 *
 * <p>存在的理由只有一条：演示站里<b>每一个数字都是冻结的假数据</b>，而页面本身长得和真系统
 * 一模一样。没有这条标识，看到的人没有任何办法分辨自己看的是演示还是生产——
 * {@code regressionMode.ts} 已经为同类风险写过警告，演示站的传播面更大。
 *
 * <h3>为什么是浮层</h3>
 *
 * 设计稿的版式是 1440×900 基准下逐像素定过的，顶上加一条横幅会把整屏内容下推，
 * 演示看到的就不是设计稿了。{@code position: fixed} 不参与布局，
 * 也就不会影响九页的视觉回归基线。
 *
 * <h3>为什么样式内联而不是单独的 CSS 文件</h3>
 *
 * 未使用的 JS 会被摇树删掉，未使用的 CSS 规则不会——写成 {@code DemoBanner.css}
 * 时，正式构建的样式表里仍留着 {@code .demo-banner}。演示模式的整个卖点是
 * 「正式构建里它不存在」，留一条死规则会让这句话变成半真。内联之后，
 * 不设 {@code VITE_DEMO_MODE} 的构建里本文件的一切都不进产物。
 */

/* 间距取 4px 标尺、圆角取 radius-sm 6px（设计基础规范 3.2、4.6）。
   用中性深色而不是品牌蓝或语义四色：这是环境标识不是业务信息，
   语义色被三色灯占着（WV4），品牌蓝会让它看起来像页面里的一个功能入口。 */
const STYLE: CSSProperties = {
  position: 'fixed',
  left: 16,
  bottom: 16,
  zIndex: 1100,
  padding: '8px 12px',
  borderRadius: 6,
  background: 'rgba(31, 41, 55, 0.92)',
  color: '#FFFFFF',
  fontSize: 12,
  lineHeight: '18px',
  whiteSpace: 'nowrap',
  // 不吃鼠标事件：它盖在页面左下角，底下可能是侧栏的用户卡或表格首列
  pointerEvents: 'none',
};

export function DemoBanner() {
  if (!isDemoMode()) return null;

  return (
    <div style={STYLE} role="note">
      演示环境 · 数据为示例，未连接后端
    </div>
  );
}
