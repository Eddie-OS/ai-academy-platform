import { describe, expect, it } from 'vitest';
import { colorV2 } from './designTokensV2';
import { neutral, warningLight } from './designTokens';

/**
 * 无障碍走查 A11Y-01／A11Y-02／A11Y-12 的自动化部分（出口准则 E5-2）。
 *
 * <p>走查表原来写的是「约 1.2:1」这样的手算结论。手算的问题不是算错，而是
 * <b>换了 Token 之后没人重算</b>——文档上的数字还在，实际对比度已经变了。
 * 这里把 WCAG 2.2 的相对亮度公式实现一遍，每个数字都是当场算出来的。
 * 完整实测表用 {@code node scripts/contrast-report.mjs} 打印。
 *
 * <p>两类断言方向相反，都要有：
 * <ul>
 *   <li>必须达标的组合——低于阈值就是缺陷；
 *   <li><b>已知不达标</b>的组合，断言它「确实不达标」并要求登记理由。
 *       看着别扭，但正是它把书面例外钉住了：哪天有人把颜色改深、例外不再需要，
 *       这条会红，提示去撤掉那条例外而不是留着一条空例外。
 * </ul>
 */

const WHITE = '#FFFFFF';

/** WCAG 2.2 相对亮度（SC 1.4.3 的定义）。 */
function relativeLuminance(hex: string): number {
  const value = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((offset) => {
    const raw = parseInt(value.slice(offset, offset + 2), 16) / 255;
    return raw <= 0.03928 ? raw / 12.92 : ((raw + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const [lighter, darker] = a > b ? [a, b] : [b, a];
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * 低于 SC 1.4.11 的 3:1、但已判定豁免的图形色，每条都要写清豁免依据。
 *
 * <p>灯色能豁免的唯一理由是 WV1：灯色<b>不是</b>唯一识别载体，
 * 「图标 + 文字标签 + 天数」三件同时出现，文字用的是正文色（17.75:1）。
 * SC 1.4.11 管的是「为理解内容所必需的图形」，而这里的图标是冗余的。
 * 一旦哪天有人把文字标签去掉只留色点，这条豁免立刻失效——
 * 那种改动会先被 {@code WarningLight.test.tsx} 拦住。
 */
const NON_TEXT_EXEMPT: Record<string, string> = {
  '#0EA5E9': '蓝灯图标，需求 13.4.1a 定的色值；WV1 保证同时有文字标签与天数',
  '#F59E0B': '黄灯图标，同上',
};

describe('对比度（WCAG 2.2 AA，走查表 A11Y-01／02／12）', () => {
  it('正文与各级文字在白底上 ≥4.5:1（SC 1.4.3）', () => {
    expect(contrast(colorV2.textPrimary, WHITE)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colorV2.textSecondary, WHITE)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colorV2.textTertiary, WHITE)).toBeGreaterThanOrEqual(4.5);
    // V1.1 的正文色也仍在用（tokens.css 的 --color-text-body）
    expect(contrast(neutral[700], WHITE)).toBeGreaterThanOrEqual(4.5);
  });

  it('表头三级文字在弱背景 #F5F7FA 上仍 ≥4.5:1', () => {
    expect(contrast(colorV2.textTertiary, colorV2.bgMuted)).toBeGreaterThanOrEqual(4.5);
  });

  /**
   * A11Y-01a（阶段 5 新发现，待业务裁决）。
   *
   * <p>V1.1 的交互主色 {@code #4E70DB} 对白字正好 4.50:1——它就是为了卡住这条线才那么定的。
   * V2.0 换成 {@code #3974FA} 后降到 4.16:1，14px 白字按 SC 1.4.3 需要 4.5:1，差 0.34。
   * hover 态 {@code #2F67ED} 是 4.90:1，反而达标。
   *
   * <p>处置与 V-4／V-5 同类：Token 以 V2.0 为准是已生效的业务决定，这里只把事实钉住并记入
   * 走查表的书面例外。真要合规，最小改动是把静止态填色换成 hover 那一档，
   * 但那会整体重画九页视觉基线，不属于阶段 5「不加新功能、只修缺陷」的范围。
   */
  it('A11Y-01a：静止态主按钮白字 4.16:1 未达 4.5，hover 与 active 达标', () => {
    const resting = contrast(WHITE, colorV2.brandAction);
    expect(resting).toBeLessThan(4.5);
    expect(resting).toBeCloseTo(4.16, 2);
    // 不能再更差：低于 3:1 连大字号与图形的底线都破了
    expect(resting).toBeGreaterThanOrEqual(3);

    expect(contrast(WHITE, colorV2.brandActionHover)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(WHITE, colorV2.brandActionActive)).toBeGreaterThanOrEqual(4.5);
    // 品牌识别色不承载白字，它只用于 Logo、插画与 ≥24px 大标题（CLAUDE.md 第九节）
    expect(contrast(WHITE, colorV2.brandPrimary)).toBeLessThan(4.5);
  });

  it('焦点环 ≥3:1（SC 1.4.11，走查表 A11Y-12）', () => {
    expect(contrast(colorV2.brandPrimary, WHITE)).toBeGreaterThanOrEqual(3);
  });

  it('灯色图标要么 ≥3:1，要么在豁免表里写明依据（SC 1.4.11）', () => {
    const unexplained: string[] = [];
    Object.values(warningLight).forEach((light) => {
      const ratio = contrast(light.solid, WHITE);
      if (ratio < 3 && !NON_TEXT_EXEMPT[light.solid]) {
        unexplained.push(`${light.label} ${light.solid} = ${ratio.toFixed(2)}:1`);
      }
    });
    expect(
      unexplained,
      '新增的图形色低于 3:1 却没有豁免依据，走查表 A11Y-02 会失去可信度',
    ).toEqual([]);

    // 红灯与无灯本身达标，不靠豁免
    expect(contrast(warningLight.RED.solid, WHITE)).toBeGreaterThanOrEqual(3);
    expect(contrast(warningLight.NONE.solid, WHITE)).toBeGreaterThanOrEqual(3);
  });

  it('V-4：控件边框 #E5E7EB 确实不满足 3:1，例外仍然必要', () => {
    const ratio = contrast(colorV2.borderDefault, WHITE);
    expect(ratio).toBeLessThan(3);
    // 走查表里的 1.24:1 就是这个数，别再手写第二遍
    expect(ratio).toBeCloseTo(1.24, 2);
  });

  it('V-5：placeholder #ACB3BD 确实不满足 4.5:1，例外仍然必要', () => {
    const ratio = contrast(colorV2.textPlaceholder, WHITE);
    expect(ratio).toBeLessThan(4.5);
    expect(ratio).toBeCloseTo(2.11, 2);
  });
});
