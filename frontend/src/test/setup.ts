import '@testing-library/jest-dom/vitest';

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
