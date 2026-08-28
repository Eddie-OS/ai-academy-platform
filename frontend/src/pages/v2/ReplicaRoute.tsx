import type { ComponentType } from 'react';

/** 回到阶段 2 业务页的逃生门：`?legacy=1`。五个驾驶舱主路径都用这套。 */
const LEGACY_PARAM = 'legacy';

/**
 * 同一路由下的双轨分派：默认渲染《设计文档 V2.0》的复刻件，`?legacy=1` 回到阶段 2 的业务页。
 *
 * <h3>为什么复刻件是默认的那一轨</h3>
 *
 * 复刻件目前只读 {@code src/fixtures}——54 个指标属阶段 3 的 aggregate/metrics，此刻还没有
 * 接口可接。业务页接的是真实接口，但阶段 3 的聚合接口同样还不存在，所以它在没有后端的
 * 环境里整页只显示「加载失败」。<b>两轨都不是完整的，区别是复刻件缺的是真数据，业务页缺的是
 * 能看见的内容。</b>先让面板按设计稿长齐、数据随阶段 3 替换，是本项目当前的取舍。
 *
 * <p>业务页没有被删，它承载的录入能力（表单弹窗、状态转换面板、详情六个页签）阶段 3/4 还要用：
 *
 * <ul>
 *   <li>详情深链 {@code /demands/:id} 仍直接指向业务页，不走这个分派；
 *   <li>驾驶舱主路径加 {@code ?legacy=1} 也能回到业务页。
 * </ul>
 *
 * <p>阶段 3/4 把复刻件接上真实数据、并把业务页的录入入口搬进新布局后，这个分派就地删掉。
 *
 * <h3>为什么判定放在渲染期而不是模块加载期</h3>
 *
 * 判定读的是 URL 的查询串。写成模块级常量的话，判定会在 import 那一刻定格，之后同一个会话内
 * 在带 legacy 与不带 legacy 的地址之间跳转，渲染的还是第一次进来时那一轨。放在组件里每次渲染
 * 重新判定，跳转就跟得上。
 */
export function replicaRoute(product: ComponentType, replica: ComponentType): ComponentType {
  function ReplicaRoute() {
    const Chosen = isLegacyMode() ? product : replica;
    return <Chosen />;
  }

  // 两个组件名都带上，React DevTools 与测试报错里能一眼看出这是哪一对的分派
  ReplicaRoute.displayName = `ReplicaRoute(${replica.name} | ${product.name})`;
  return ReplicaRoute;
}

function isLegacyMode(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get(LEGACY_PARAM) === '1';
}