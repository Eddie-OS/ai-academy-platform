import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * 跨驾驶舱跳转时「打开在某一条上」的统一入参。
 *
 * <h3>为什么必须只有一套</h3>
 *
 * 课程详情要能跳到讲师、培训、案例、需求与评审记录中心五处，而这五个页面各自已经有一份
 * 「默认选中项」常量（`LECTURER_SELECTED_ID` 那一批）。每个页面各发明一种接收方式
 * （有的读路由参数、有的读 state、有的靠 props 透传）的结果是：<b>跳过去只到了列表首屏</b>，
 * 而这种失败看起来和「跳转坏了」一样 —— 页面确实换了，只是选中的不是目标对象。
 *
 * <p>所以口径固定为 URL 查询参数 `?focus=<对象编号>`：跳转方只拼 URL，接收方只多一行
 * `useFocusedId(默认选中项)`。刷新、复制链接、浏览器前进后退全都成立，这是 state 传参做不到的。
 *
 * <h3>为什么不是路由参数</h3>
 *
 * AGENTS.md 已定「详情不跳页」：`/demands/123` 渲染的是需求驾驶舱并把面板开在该条上。
 * 那套路由参数是给<b>旧收藏</b>用的，一个驾驶舱只能有一个。而这里要表达的是
 * 「换驾驶舱并选中某条」，两者叠加会出现 `/lecturers/JS0387?focus=JS0387` 这类双份真源。
 */

const FOCUS_PARAM = 'focus';

/**
 * 当前应当选中的对象编号。URL 上没带 `?focus=` 时返回该页自己的默认选中项。
 *
 * <p>可以在任意深度的叶子组件里调用 —— 讲师卡的选中态就在叶子上算，
 * 为了它一路透传 selectedId 会顺手把三层组件的签名都改掉。
 */
export function useFocusedId(fallbackId: string): string {
  const [params] = useSearchParams();
  return params.get(FOCUS_PARAM) ?? fallbackId;
}

/**
 * 带选中态的版本：初值取 `?focus=`，之后由页面内的点击接管。
 *
 * <p>初值只在首次渲染时取一次。跳过来之后运营点了别的行，URL 上那个 focus 就不该再把
 * 选中项拽回去 —— 那会表现为「点了没反应」。
 */
export function useFocusSelection(fallbackId: string): [string, (id: string) => void] {
  const focused = useFocusedId(fallbackId);
  const [selectedId, setSelectedId] = useState(focused);
  return [selectedId, setSelectedId];
}

/**
 * 拼一条跳转地址。
 *
 * <p>现有查询参数原样带过去，`?fixture=1` 必须活着到目标页：回归模式是靠它决定的，
 * 丢了就等于跳到一个要登录、要后端的产品模式页面上。
 */
export function focusHref(path: string, id: string, search: string): string {
  const params = new URLSearchParams(search);
  params.set(FOCUS_PARAM, id);
  return `${path}?${params.toString()}`;
}

/** 试讲台账「查看」：打开课程工作台，并把详情停在试讲页签。 */
export function courseTrialHref(courseFocus: string, search: string): string {
  const params = new URLSearchParams(search);
  params.set(FOCUS_PARAM, courseFocus);
  params.set('tab', '试讲');
  return `/courses?${params.toString()}`;
}
