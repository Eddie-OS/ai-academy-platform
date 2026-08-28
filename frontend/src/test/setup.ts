import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/react';

/**
 * Testing Library 的 {@code findBy*} 默认只等 1000ms。
 *
 * <p>本仓库的页面级用例要等好几层 React Query 落地（列表 → 详情 → available），
 * 单跑一个文件够用，33 个文件并行时同一台机器上就不够了——表现是随机某个
 * {@code findByRole} 超时，重跑一次又绿。这类抖动比真失败更贵：它会训练人
 * 「红了先重跑一次看看」，真回归也就跟着被无视了。
 *
 * <p>放宽的是<b>等待上限</b>，不是断言本身：元素真的没渲染出来时用例照样失败，
 * 只是多花几秒才报出来。
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
