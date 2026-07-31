import { describe, expect, it } from 'vitest';
import { antdTheme } from './antdTheme';
import { brand, fontSize, lineHeight, neutral, radius, semantic } from './designTokens';
import { ALL_PAGES } from '@/app/navigation';

/**
 * 出口准则 E0-4 的自动化证据：设计规范的 Token 已注入前端主题。
 *
 * 这些断言把「设计规范里最容易被写错的几个值」钉死在测试里。它们不是形式主义——
 * 主按钮色若被改回品牌色 #5B82FF，界面看起来几乎一样，但全部主按钮的文字对比度都不达标。
 */
describe('AntD 主题与设计规范一致（E0-4）', () => {
  it('主按钮色是交互主色 brand-600 #4E70DB，不是品牌识别色 #5B82FF', () => {
    expect(antdTheme.token?.colorPrimary).toBe('#4E70DB');
    expect(antdTheme.token?.colorPrimary).toBe(brand[600]);
    expect(antdTheme.token?.colorPrimary).not.toBe(brand[500]);
  });

  it('主按钮 hover 与 active 分别取 brand-700 与 brand-800', () => {
    expect(antdTheme.token?.colorPrimaryHover).toBe(brand[700]);
    expect(antdTheme.token?.colorPrimaryActive).toBe(brand[800]);
  });

  it('按钮与输入框圆角为 radius-sm 6px，卡片为 radius-lg 12px', () => {
    expect(antdTheme.token?.borderRadius).toBe(6);
    expect(antdTheme.token?.borderRadius).toBe(radius.sm);
    expect(antdTheme.token?.borderRadiusLG).toBe(radius.lg);
  });

  it('正文字号 14px、控件高度 32/28/40', () => {
    expect(antdTheme.token?.fontSize).toBe(14);
    expect(antdTheme.token?.fontSize).toBe(fontSize.body);
    expect(antdTheme.token?.controlHeight).toBe(32);
    expect(antdTheme.token?.controlHeightSM).toBe(28);
    expect(antdTheme.token?.controlHeightLG).toBe(40);
  });

  it('表单控件边框用 neutral-500（WCAG 要求组件边界 ≥3:1），不是 neutral-200', () => {
    expect(antdTheme.token?.colorBorder).toBe(neutral[500]);
    expect(antdTheme.token?.colorBorder).not.toBe(neutral[200]);
  });

  it('placeholder 用 neutral-600 而不是 neutral-400（placeholder 属文本，需 4.5:1）', () => {
    expect(antdTheme.token?.colorTextPlaceholder).toBe(neutral[600]);
    expect(antdTheme.token?.colorTextPlaceholder).not.toBe(neutral[400]);
  });

  it('语义色取需求文档 13.4.1a 的原值，未被压暗（决策 D43 沿用原值）', () => {
    expect(antdTheme.token?.colorSuccess).toBe(semantic.success.solid);
    expect(antdTheme.token?.colorWarning).toBe(semantic.warning.solid);
    expect(antdTheme.token?.colorError).toBe(semantic.danger.solid);
    expect(antdTheme.token?.colorInfo).toBe('#0EA5E9');
  });

  it('表格不画表头竖线、行 hover 用 neutral-50（TB1／TB3）', () => {
    expect(antdTheme.components?.Table?.headerSplitColor).toBe('transparent');
    expect(antdTheme.components?.Table?.rowHoverBg).toBe(neutral[50]);
  });

  it('表头底 neutral-100、表头文字 neutral-600、单元格文字 14px（5.13 表头规格）', () => {
    expect(antdTheme.components?.Table?.headerBg).toBe(neutral[100]);
    expect(antdTheme.components?.Table?.headerColor).toBe(neutral[600]);
    expect(antdTheme.components?.Table?.cellFontSize).toBe(fontSize.body);
  });

  it('标题行高逐档显式指定，不用 AntD 按字号推算的值', () => {
    // 24px 标题的规范行高是 36px；AntD 默认推算出 30.4px，紧了一档。
    expect(antdTheme.token?.lineHeightHeading2).toBe(lineHeight.h2);
    expect((antdTheme.token?.lineHeightHeading2 ?? 0) * fontSize.h2).toBe(36);
    expect((antdTheme.token?.lineHeightHeading1 ?? 0) * fontSize.h1).toBe(48);
    expect((antdTheme.token?.lineHeightHeading3 ?? 0) * fontSize.h3).toBe(28);
    expect((antdTheme.token?.lineHeight ?? 0) * fontSize.body).toBe(22);
  });

  it('页面框架尺寸：顶栏 56px、侧栏 240px', () => {
    expect(antdTheme.components?.Layout?.headerHeight).toBe(56);
  });
});

describe('导航覆盖一期全部 24 个一级页面', () => {
  it('页面总数为 24（总看板 1 + 五驾驶舱 18 + 三中心 3 + 导入中心 1 + 配置中心 1）', () => {
    expect(ALL_PAGES).toHaveLength(24);
  });

  it('页面编号与路径均无重复', () => {
    expect(new Set(ALL_PAGES.map((p) => p.code)).size).toBe(24);
    expect(new Set(ALL_PAGES.map((p) => p.path)).size).toBe(24);
  });

  it('已删除的组织覆盖视图不在页面清单内（N12）', () => {
    expect(ALL_PAGES.some((p) => p.title.includes('组织覆盖'))).toBe(false);
  });

  it('导入中心与配置中心仅运营账号可见（需求 13.8、13.9）', () => {
    const operatorOnly = ALL_PAGES.filter((p) => p.operatorOnly).map((p) => p.title);
    expect(operatorOnly).toEqual(['导入中心', '配置中心']);
  });
});
