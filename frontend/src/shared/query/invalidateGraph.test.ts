import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import {
  invalidateCourseGraph,
  invalidateDemandCourseLink,
  invalidateDemandGraph,
} from './invalidateGraph';

/**
 * 写完需求／课程后，哪些读侧查询会被重算。
 *
 * <h3>这个文件对应的故障现场</h3>
 *
 * 后端每个数都是实时 {@code COUNT}，改完库里下一次查就是新值，所以「数字对不上」
 * 只可能出在前端缓存。而它的表现极不像 Bug：新建一条需求，需求驾驶舱的总数
 * 当场从 20 变 21（本页自己失效了），切到总看板却还是 20 —— 两个页面各自都对，
 * 只有并排看才发现不一致，且刷新一下就好了，很容易被当成偶发。
 *
 * <p>断言写成「查询是否被标记为 stale」而不是「invalidateQueries 被调了几次」：
 * 后者只能证明函数被调用过，证明不了 key 写对了。把 {@code ['dashboard']} 误写成
 * {@code ['dashboards']} 时，调用次数一次不少，而总看板一个字都不会变。
 */

/** 造一个已有缓存的查询，用它是否变 stale 判断有没有被这次写操作波及 */
function seed(client: QueryClient, queryKey: unknown[]): void {
  client.setQueryData(queryKey, { seeded: true });
}

function isStale(client: QueryClient, queryKey: unknown[]): boolean {
  const state = client.getQueryCache().find({ queryKey })?.state;
  if (!state) throw new Error(`缓存里没有 ${JSON.stringify(queryKey)}`);
  return state.isInvalidated;
}

/** 三个看板 + 总看板下半屏两块，各取一个代表性的 key */
const DASHBOARD = ['dashboard', 'overview'];
const WARNINGS = ['warnings', 'summary'];
const TASKS = ['tasks', 'pending', null];
const DEMAND_LIST = ['demands', 'v2', 'page', {}, 1];
const DEMAND_QUANTITY = ['metrics', 'quantity', 'demands'];
const COURSE_LIST = ['courses', 'v2', 'page', {}, 1, 10];
const COURSE_QUANTITY = ['metrics', 'quantity', 'courses'];
/** 与三个看板无关，用来证明失效范围没有大到「全清」 */
const UNRELATED = ['meta', 'enums'];

function freshClient(): QueryClient {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  for (const key of [
    DASHBOARD,
    WARNINGS,
    TASKS,
    DEMAND_LIST,
    DEMAND_QUANTITY,
    COURSE_LIST,
    COURSE_QUANTITY,
    UNRELATED,
  ]) {
    seed(client, key);
  }
  return client;
}

describe('写操作后的联动范围', () => {
  it('写需求会重算需求列表、需求指标与总看板三块', () => {
    const client = freshClient();

    invalidateDemandGraph(client);

    expect(isStale(client, DEMAND_LIST), '需求列表').toBe(true);
    expect(isStale(client, DEMAND_QUANTITY), '需求指标卡').toBe(true);
    expect(isStale(client, DASHBOARD), '总看板').toBe(true);
    expect(isStale(client, WARNINGS), '三色灯明细').toBe(true);
    expect(isStale(client, TASKS), '任务中心').toBe(true);
    expect(isStale(client, UNRELATED), '字典枚举不该被牵连').toBe(false);
  });

  it('写课程会重算课程列表、课程指标与总看板三块', () => {
    const client = freshClient();

    invalidateCourseGraph(client);

    expect(isStale(client, COURSE_LIST), '课程列表').toBe(true);
    expect(isStale(client, COURSE_QUANTITY), '课程工作台五张卡').toBe(true);
    expect(isStale(client, DASHBOARD), '总看板').toBe(true);
    expect(isStale(client, WARNINGS), '三色灯明细').toBe(true);
    expect(isStale(client, TASKS), '任务中心').toBe(true);
    expect(isStale(client, UNRELATED), '字典枚举不该被牵连').toBe(false);
  });

  /*
   * 只写需求时不动课程列表。
   *
   * <p>反向断言，防的是「干脆 invalidateQueries() 不带 key 全清一遍」——
   * 那样这个文件的其余断言全过，代价是每次写都把字典、枚举、附件列表一起重拉。
   */
  it('写需求不牵连课程列表，反之亦然', () => {
    const demandOnly = freshClient();
    invalidateDemandGraph(demandOnly);
    expect(isStale(demandOnly, COURSE_LIST), '课程列表').toBe(false);
    expect(isStale(demandOnly, COURSE_QUANTITY), '课程指标卡').toBe(false);

    const courseOnly = freshClient();
    invalidateCourseGraph(courseOnly);
    expect(isStale(courseOnly, DEMAND_LIST), '需求列表').toBe(false);
    expect(isStale(courseOnly, DEMAND_QUANTITY), '需求指标卡').toBe(false);
  });

  /*
   * 关联关系是唯一一处必须两边一起刷的写操作：rel_demand_course 的两个方向
   * 分别由需求详情的「关联课程」与课程详情的「关联需求」读取。
   */
  it('需求与课程建立关联时两侧一起重算', () => {
    const client = freshClient();

    invalidateDemandCourseLink(client);

    expect(isStale(client, DEMAND_LIST), '需求列表').toBe(true);
    expect(isStale(client, COURSE_LIST), '课程列表').toBe(true);
    expect(isStale(client, DASHBOARD), '总看板').toBe(true);
  });
});
