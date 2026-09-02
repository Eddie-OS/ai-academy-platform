import { isRegressionMode } from '@/app/regressionMode';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const MOTION_PARAM = 'motion';

/**
 * 动效的统一开关。
 *
 * 三层判定，顺序固定：
 * 1. {@code ?motion=1} 强制开 —— 本地预览用，盖过系统偏好与回归冻结；
 * 2. Playwright / Vitest 里的 {@code ?fixture=1} 强制关 —— 截图像素必须是终态；
 * 3. 其余情况只听系统「减少动态效果」。
 *
 * <p>人眼打开 {@code ?fixture=1} 不再关动效。那个地址同时承担两件事：给截图冻数据、
 * 给本地预览冻数据。关动画只服务第一件；第二件关了，运营会以为动效没做。
 */
export function shouldReduceMotion(): boolean {
  if (isForceMotion()) {
    return false;
  }
  if (isRegressionMode() && isAutomatedClient()) {
    return true;
  }
  return prefersReducedMotion();
}

/** 地址栏显式要求看动效。 */
export function isForceMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get(MOTION_PARAM) === '1';
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

/**
 * 截图与单测才算自动化客户端。人眼浏览器里 {@code navigator.webdriver} 为假。
 */
export function isAutomatedClient(): boolean {
  if (typeof process !== 'undefined' && process.env.VITEST) {
    return true;
  }
  return typeof navigator !== 'undefined' && Boolean(navigator.webdriver);
}

/**
 * 人眼预览冻数据时，去掉回归样式里那条 {@code animation:none}。
 * Playwright 不打这个标记，截图基线保持终态。
 */
export function applyMotionPreference(): void {
  if (typeof document === 'undefined') return;
  const force = isForceMotion() || (isRegressionMode() && !isAutomatedClient() && !prefersReducedMotion());
  if (force) {
    document.documentElement.setAttribute('data-force-motion', '');
  } else {
    document.documentElement.removeAttribute('data-force-motion');
  }
}
