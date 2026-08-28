import type { QueryClient } from '@tanstack/react-query';

/**
 * 写完一个业务对象后，要跟着重算的读侧查询。
 *
 * <h3>为什么需要这一层</h3>
 *
 * 指标一律实时计算、不做预聚合（U2、C14），所以<b>后端天然联动</b>：
 * 需求总数是 {@code SELECT COUNT(*) FROM biz_demand WHERE deleted = FALSE}，
 * 改完库里下一次查就是新数。不联动只会出在前端缓存这一侧 ——
 * 写完只失效了自己那个驾驶舱的 key，别的页面还端着上一次的响应。
 *
 * <p>这个故障在开发期几乎看不出来：写完当场就在本页，本页的数是对的。
 * 只有切到总看板才发现需求总数还是改之前那个，而它看着完全正常。
 *
 * <h3>为什么跨驾驶舱的 key 用 refetchType: 'all'</h3>
 *
 * 默认只重取当前挂载着的查询，没挂载的仅标记为 stale。总看板此刻多半没挂载，
 * 于是切过去时先渲染缓存里的旧数、再被重取的新数替换 —— 又是一次闪。
 * {@code 'all'} 让它在后台立刻重算，切过去时缓存已经是新的。
 * 一次写多发三个请求，在「100 人以内、无缓存层」的规模下换掉闪值是划算的。
 */
const CROSS_COCKPIT_KEYS = [['dashboard'], ['warnings'], ['tasks']] as const;

function invalidateCrossCockpit(queryClient: QueryClient): void {
  for (const queryKey of CROSS_COCKPIT_KEYS) {
    void queryClient.invalidateQueries({ queryKey: [...queryKey], refetchType: 'all' });
  }
}

/**
 * 写需求之后。
 *
 * <p>{@code ['metrics','efficiency']} 是前缀，一并盖住需求评审周期与课程月度概览：
 * 九个效率指标都从状态流转日志算，改一次状态就可能动其中几条，
 * 逐个列举等于每加一个指标都要回来补一行。
 */
export function invalidateDemandGraph(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: ['demands'] });
  void queryClient.invalidateQueries({ queryKey: ['metrics', 'quantity', 'demands'] });
  void queryClient.invalidateQueries({ queryKey: ['metrics', 'efficiency'] });
  invalidateCrossCockpit(queryClient);
}

/** 写课程之后。列表、工作台五张卡、总看板三处同一份库数据。 */
export function invalidateCourseGraph(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: ['courses'] });
  void queryClient.invalidateQueries({ queryKey: ['metrics', 'quantity', 'courses'] });
  void queryClient.invalidateQueries({ queryKey: ['metrics', 'efficiency'] });
  invalidateCrossCockpit(queryClient);
}

/**
 * 需求与课程的关联发生变化时（关联／解除关联）。
 *
 * <p>两边都要刷：关联关系挂在 {@code rel_demand_course} 上，
 * 需求详情的「关联课程」与课程详情的「关联需求」读的是同一张表的两个方向。
 */
export function invalidateDemandCourseLink(queryClient: QueryClient): void {
  invalidateDemandGraph(queryClient);
  invalidateCourseGraph(queryClient);
}
