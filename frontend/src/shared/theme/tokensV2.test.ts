import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PAGE_SHELL,
  PRODUCT_SHELL,
  avatarSizesV2,
  colorV2,
  effectV2,
  fontFamilyV2,
  logoBoxV2,
  radiusV2,
  sizeV2,
  spaceLadderV2,
  typeV2,
  viewportV2,
  zIndexV2,
} from './designTokensV2';

/**
 * 锁住 tokens-v2.css 与 designTokensV2.ts 两份值一致。
 *
 * <p>CSS 是运行时真相，TS 是 AntD／ECharts／Playwright 的镜像。任一处改漏，
 * 界面与断言就会各用一套蓝，肉眼几乎看不出来。
 */

const CSS_PATH = resolve(process.cwd(), 'src/shared/theme/tokens-v2.css');

function normalizeNumberToken(token: string): string {
  const n = Number(token);
  return Number.isFinite(n) ? String(n) : token;
}

function normalizeCssValue(raw: string): string {
  return raw
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/#([0-9a-fA-F]{3,8})\b/g, (_, hex: string) => `#${hex.toLowerCase()}`)
    .replace(
      /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/g,
      (_, r, g, b, a) => {
        if (a === undefined) return `rgb(${r}, ${g}, ${b})`;
        return `rgba(${r}, ${g}, ${b}, ${normalizeNumberToken(a)})`;
      },
    )
    .replace(/cubic-bezier\(\s*([^)]+)\)/g, (_, body: string) => {
      const parts = body.split(',').map((part) => normalizeNumberToken(part.trim()));
      return `cubic-bezier(${parts.join(', ')})`;
    })
    .replace(/,\s+/g, ', ');
}

/** 解析 :root 与 [data-regression] 选择器下的自定义属性 */
function parseCssVars(css: string): {
  root: Record<string, string>;
  pages: Record<string, Record<string, string>>;
} {
  const root: Record<string, string> = {};
  const pages: Record<string, Record<string, string>> = {};

  const rootMatch = css.match(/:root\s*\{([\s\S]*?)\n\}/);
  if (!rootMatch) throw new Error('tokens-v2.css 缺少 :root 块');
  for (const match of rootMatch[1]!.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
    root[match[1]!] = normalizeCssValue(match[2]!);
  }

  // 产品模式壳层写在文件末尾第二个 :root 里，覆盖同名变量
  const productRoot = [...css.matchAll(/:root\s*\{([\s\S]*?)\n\}/g)].at(-1);
  if (productRoot && productRoot[1] !== rootMatch[1]) {
    for (const match of productRoot[1]!.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
      root[match[1]!] = normalizeCssValue(match[2]!);
    }
  }

  for (const match of css.matchAll(
    /\[data-regression\]\s+\[data-page='([\w-]+)'\]\s*\{([\s\S]*?)\}/g,
  )) {
    const page: Record<string, string> = {};
    for (const varMatch of match[2]!.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
      page[varMatch[1]!] = normalizeCssValue(varMatch[2]!);
    }
    pages[match[1]!] = page;
  }

  return { root, pages };
}

function px(n: number): string {
  return `${n}px`;
}

function expectVar(vars: Record<string, string>, name: string, expected: string | number) {
  const actual = vars[name];
  expect(actual, `--${name}`).toBeDefined();
  const want =
    typeof expected === 'number'
      ? normalizeCssValue(String(expected))
      : normalizeCssValue(expected);
  expect(actual, `--${name}`).toBe(want);
}

describe('tokens-v2.css ↔ designTokensV2.ts', () => {
  const css = readFileSync(CSS_PATH, 'utf8');
  const { root, pages } = parseCssVars(css);

  it('2.1 色彩一一对应', () => {
    expectVar(root, 'brand-primary', colorV2.brandPrimary);
    expectVar(root, 'brand-action', colorV2.brandAction);
    expectVar(root, 'brand-action-hover', colorV2.brandActionHover);
    expectVar(root, 'brand-action-active', colorV2.brandActionActive);
    expectVar(root, 'brand-50', colorV2.brand50);
    expectVar(root, 'brand-100', colorV2.brand100);
    expectVar(root, 'text-primary', colorV2.textPrimary);
    expectVar(root, 'text-secondary', colorV2.textSecondary);
    expectVar(root, 'text-tertiary', colorV2.textTertiary);
    expectVar(root, 'text-placeholder', colorV2.textPlaceholder);
    expectVar(root, 'bg-page', colorV2.bgPage);
    expectVar(root, 'bg-muted', colorV2.bgMuted);
    expectVar(root, 'border-default', colorV2.borderDefault);
    expectVar(root, 'border-light', colorV2.borderLight);
    expectVar(root, 'success', colorV2.success);
    expectVar(root, 'success-bg', colorV2.successBg);
    expectVar(root, 'warning', colorV2.warning);
    expectVar(root, 'warning-bg', colorV2.warningBg);
    expectVar(root, 'danger', colorV2.danger);
    expectVar(root, 'danger-bg', colorV2.dangerBg);
    expectVar(root, 'info', colorV2.info);
    expectVar(root, 'purple', colorV2.purple);
  });

  it('2.2 字号／行高／字重三元组一致', () => {
    expectVar(root, 'font-family-v2', fontFamilyV2);
    const rows = [
      ['page-title', typeV2.pageTitle],
      ['panel-title', typeV2.panelTitle],
      ['body', typeV2.body],
      ['table', typeV2.table],
      ['caption', typeV2.caption],
      ['badge', typeV2.badge],
      ['kpi', typeV2.kpi],
      ['kpi-small', typeV2.kpiSmall],
    ] as const;
    for (const [key, triple] of rows) {
      expectVar(root, `type-${key}-size`, px(triple.size));
      expectVar(root, `type-${key}-line`, px(triple.line));
      expectVar(root, `type-${key}-weight`, triple.weight);
    }
    expectVar(root, 'type-body-medium-weight', typeV2.bodyMedium.weight);
  });

  it('2.3 间距阶梯、圆角、阴影、层级一致', () => {
    spaceLadderV2.forEach((value, index) => {
      expectVar(root, `space-v2-${index + 1}`, px(value));
    });
    expectVar(root, 'radius-control', px(radiusV2.control));
    expectVar(root, 'radius-card', px(radiusV2.card));
    expectVar(root, 'radius-tag', px(radiusV2.tag));
    expectVar(root, 'shadow-card', effectV2.shadowCard);
    expectVar(root, 'shadow-selected', effectV2.shadowSelected);
    expectVar(root, 'transition-v2', effectV2.transition);
    expectVar(root, 'z-v2-base', zIndexV2.base);
    expectVar(root, 'z-v2-sticky', zIndexV2.sticky);
    expectVar(root, 'z-v2-dropdown', zIndexV2.dropdown);
    expectVar(root, 'z-v2-drawer', zIndexV2.drawer);
    expectVar(root, 'z-v2-modal', zIndexV2.modal);
    expectVar(root, 'z-v2-toast', zIndexV2.toast);
  });

  it('2.4 组件固定尺寸与头像五档一致', () => {
    expectVar(root, 'control-h', px(sizeV2.controlHeight));
    expectVar(root, 'control-pad-x', px(sizeV2.controlPadX));
    expectVar(root, 'control-gap', px(sizeV2.controlGap));
    expectVar(root, 'control-compact-h', px(sizeV2.compactHeight));
    expectVar(root, 'control-compact-pad-x', px(sizeV2.compactPadX));
    expectVar(root, 'input-pad-x', px(sizeV2.inputPadX));
    expectVar(root, 'btn-create-w', px(sizeV2.createButtonWidth));
    expectVar(root, 'btn-create-h', px(sizeV2.createButtonHeight));
    expectVar(root, 'badge-h', px(sizeV2.badgeHeight));
    expectVar(root, 'badge-pad-x', px(sizeV2.badgePadX));
    expectVar(root, 'nav-item-h', px(sizeV2.navItemHeight));
    expectVar(root, 'nav-item-pad-x', px(sizeV2.navItemPadX));
    expectVar(root, 'nav-item-gap', px(sizeV2.navItemGap));
    expectVar(root, 'kpi-icon-plate', px(sizeV2.kpiIconPlate));
    expectVar(root, 'card-pad', px(sizeV2.cardPad));
    expectVar(root, 'card-pad-compact', px(sizeV2.cardPadCompact));
    expectVar(root, 'panel-gap', px(sizeV2.panelGap));

    const [xs, sm, md, lg, xl] = avatarSizesV2;
    expectVar(root, 'avatar-xs', px(xs!));
    expectVar(root, 'avatar-sm', px(sm!));
    expectVar(root, 'avatar-md', px(md!));
    expectVar(root, 'avatar-lg', px(lg!));
    expectVar(root, 'avatar-xl', px(xl!));
  });

  it('4.1 视口与 Logo 盒一致', () => {
    expectVar(root, 'viewport-w', px(viewportV2.width));
    expectVar(root, 'viewport-h', px(viewportV2.height));
    expectVar(root, 'logo-slot-h', px(logoBoxV2.slotHeight));
    expectVar(root, 'logo-box-w', px(logoBoxV2.width));
    expectVar(root, 'logo-box-h', px(logoBoxV2.height));
    expectVar(root, 'logo-box-left', px(logoBoxV2.left));
    expectVar(root, 'logo-box-top', px(logoBoxV2.top));
    expectVar(root, 'logo-mark-w', px(logoBoxV2.markWidth));
    expectVar(root, 'logo-mark-h', px(logoBoxV2.markHeight));
  });

  it('产品模式壳层取统一中位值', () => {
    expectVar(root, 'sidebar-w', px(PRODUCT_SHELL.sidebarWidth));
    expectVar(root, 'topbar-h', px(PRODUCT_SHELL.topbarHeight));
    expectVar(root, 'content-x', px(PRODUCT_SHELL.contentX));
    expectVar(root, 'content-w', px(PRODUCT_SHELL.contentWidth));
  });

  it('回归模式九页壳层实测值一一对应', () => {
    expect(Object.keys(pages).sort()).toEqual(Object.keys(PAGE_SHELL).sort());
    for (const [pageKey, shell] of Object.entries(PAGE_SHELL)) {
      const vars = pages[pageKey]!;
      expectVar(vars, 'sidebar-w', px(shell.sidebarWidth));
      expectVar(vars, 'topbar-h', px(shell.topbarHeight));
      expectVar(vars, 'content-x', px(shell.contentX));
      expectVar(vars, 'content-w', px(shell.contentWidth));
    }
  });
});
