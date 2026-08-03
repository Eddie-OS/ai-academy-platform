/**
 * 视觉回归模式（《设计文档 V2.0》1.1、16.2）。
 *
 * <p>入口是 URL 上的 {@code ?fixture=1}。命中后做两件事：
 * <ol>
 *   <li>在 {@code <html>} 上打 {@code data-regression}，让 tokens-v2.css 的九组逐页壳层变量
 *       与 visual-regression.css 生效；</li>
 *   <li>让页面数据改走 fixtures 而不是后端接口。</li>
 * </ol>
 *
 * <p><b>为什么要分产品模式与回归模式两套。</b>文档 0.3 明令「禁止把页面级侧栏宽度重构为
 * 单一变量」，因为九张截图的侧栏实测是 178～253px 九个不同值；而 16.2 又写「正式产品可统一，
 * 但视觉回归模式必须逐页覆盖」。两条要同时满足，只能双轨：产品用一套统一尺寸，
 * 回归模式按 {@code data-page} 逐页覆盖。切换点集中在本文件，业务代码不判断模式。
 *
 * <p><b>回归模式不是调试开关。</b>它会关掉滚动、动画与加载态，并且用冻结数据替换真实数据，
 * 在生产环境被误开会让运营看到假数据。因此 {@link isRegressionMode} 只读一次 URL，
 * 不提供运行期切换，也不写入 localStorage。
 */

const FIXTURE_PARAM = 'fixture';

let cached: boolean | null = null;

/**
 * 当前是否处于视觉回归模式。
 *
 * <p>结果在首次调用时定格：模式一旦决定就不该在同一次会话里翻转，否则同一棵组件树里
 * 一半读 fixture、一半读接口。切换模式请重新加载页面。
 */
export function isRegressionMode(): boolean {
  if (cached !== null) return cached;
  if (typeof window === 'undefined') {
    cached = false;
    return cached;
  }
  cached = new URLSearchParams(window.location.search).get(FIXTURE_PARAM) === '1';
  return cached;
}

/** 仅供测试重置缓存。 */
export function resetRegressionModeCache(): void {
  cached = null;
}

/**
 * 把模式标记写到 {@code <html>} 上。必须在首帧渲染之前调用，
 * 否则 CSS 变量在第一帧用的是产品尺寸，截图会抓到壳层跳动后的中间态。
 */
export function applyRegressionMode(): void {
  if (typeof document === 'undefined') return;
  if (isRegressionMode()) {
    document.documentElement.setAttribute('data-regression', '');
  } else {
    document.documentElement.removeAttribute('data-regression');
  }
}

/**
 * 等字体真正可用。
 *
 * <p>文档 1.1／F06：截图前必须 {@code await document.fonts.ready}。字体回退到系统黑体时
 * 字宽与基线都会变，L2 的「基线≤2px、不可误换行」必然失败。Playwright 侧也等一次，
 * 这里再等一次是为了应用自身在回归模式下不抢跑第一帧。
 */
export async function waitForFonts(): Promise<void> {
  if (typeof document === 'undefined' || !('fonts' in document)) return;
  await document.fonts.ready;
}
