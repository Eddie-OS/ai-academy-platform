import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/react';

/**
 * findBy* 的等待窗口从默认 1000ms 放宽到 5000ms。
 *
 * <p>这不是在放宽断言，断言本身一个字没改：超时的是「等异步查询回数」这一段。
 * 40 个测试文件并行跑时，机器负载会让 TanStack Query 的 promise 晚几百毫秒兑现，
 * 于是每次全量都有一两个 findByRole 扑空，而且<b>每次是不同的那一两个</b>——
 * 单独跑全过。两次全量分别挂在案例驾驶舱与培训场次表单上，就是这么来的。
 *
 * <p>为什么值得改：随机发红的测试套件等于没有测试套件。人会先学会忽略红色，
 * 再在某次真实回归时继续忽略。门禁的价值全在「红就是真的坏了」这一条上。
 */
configure({ asyncUtilTimeout: 5000 });

/**
 * jsdom 没有实现 matchMedia，而 AntD 的响应式栅格与 Table 会在挂载时订阅断点。
 *
 * <p>返回「不匹配任何断点」的固定结果即可：本平台的基准分辨率是 1440×900，
 * 明确不适配 <1440px（设计规范 4.5），因此测试里不需要模拟断点变化。
 */
if (!window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

/**
 * jsdom 的 getComputedStyle 遇到伪元素参数会抛 Not implemented，
 * 而 rc-table 量测滚动条宽度时就是这么调的。
 *
 * <p>丢掉伪元素参数即可：滚动条宽度在 jsdom 里恒为 0，量测结果本身没有意义，
 * 但异常噪音会把真正的报错埋掉。
 */
const nativeGetComputedStyle = window.getComputedStyle.bind(window);
window.getComputedStyle = ((element: Element) =>
  nativeGetComputedStyle(element)) as typeof window.getComputedStyle;

/**
 * jsdom 没有 ResizeObserver，而 V2.0 的 {@code Chart} 挂载时会订阅容器尺寸。
 *
 * <p>空实现即可：单测不关心图表重绘，只关心页面有没有把图表那一块渲染出来。
 */
if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver;
}
