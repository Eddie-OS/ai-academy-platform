import { isDemoMode } from './demoMode';
import { isRegressionMode } from './regressionMode';

/**
 * 当前是否读 fixtures、不发业务接口。
 *
 * <p>两处共用、判定各走各的：
 * <ul>
 *   <li>{@link isRegressionMode} —— {@code ?fixture=1}，还给页面打 {@code data-regression}；</li>
 *   <li>{@link isDemoMode} —— 构建期 {@code VITE_DEMO_MODE=1}，静态托管上没有后端。</li>
 * </ul>
 *
 * <p>产品构建两者都是 false。不要把「接口失败回落样例」写进产品路径：
 * 总看板若用冻数填首屏，会先闪「1,268」再跳到库里的真数。
 * 演示站没有真数可跳，必须走这条分支，否则 KPI 和看板会一直停在「—」。
 */
export function usesFixtureData(): boolean {
  return isRegressionMode() || isDemoMode();
}
