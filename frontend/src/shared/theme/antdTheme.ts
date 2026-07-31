import type { ThemeConfig } from 'antd';
import {
  brand,
  elevation,
  fontFamily,
  fontSize,
  layout,
  lineHeight,
  neutral,
  radius,
  semantic,
} from './designTokens';

/**
 * 把设计规范的 Token 映射为 AntD 的 ConfigProvider 主题。
 *
 * AntD 5 的 CSS-in-JS Token 体系与设计规范附录 A 的两层结构是同构的（《开发实施文档》3.4），
 * 因此设计与代码共用一套命名，这正是附录 A 的设计意图。
 *
 * <b>关键一条：colorPrimary 必须是 brand-600 #4E70DB 而不是品牌色 #5B82FF。</b>
 * #5B82FF 承载白字只有 3.45:1，低于 WCAG AA 对小号文本的 4.5:1 要求；
 * 现有设计稿里全部「新建」主按钮都不达标，决策 D45 已确认执行这处修订。
 */
export const antdTheme: ThemeConfig = {
  token: {
    colorPrimary: brand[600],
    colorPrimaryHover: brand[700],
    colorPrimaryActive: brand[800],
    colorPrimaryBg: brand[50],
    colorPrimaryBgHover: brand[100],
    colorLink: brand[600],
    colorLinkHover: brand[700],

    colorSuccess: semantic.success.solid,
    colorWarning: semantic.warning.solid,
    colorError: semantic.danger.solid,
    colorInfo: semantic.info.solid,

    colorText: neutral[700],
    colorTextHeading: neutral[800],
    colorTextSecondary: neutral[600],
    colorTextTertiary: neutral[600],
    colorTextDisabled: neutral[400],
    // placeholder 属于文本，需满足 4.5:1，因此用 neutral-600 而不是 neutral-400（2.3）
    colorTextPlaceholder: neutral[600],

    colorBgLayout: neutral[100],
    colorBgContainer: neutral[0],
    colorBgElevated: neutral[0],
    colorFillAlter: neutral[100],
    colorFillSecondary: neutral[50],

    colorBorder: neutral[500],
    colorBorderSecondary: neutral[200],

    fontFamily,
    fontSize: fontSize.body,
    fontSizeSM: fontSize.bodySm,
    fontSizeLG: fontSize.bodyLg,
    fontSizeHeading1: fontSize.h1,
    fontSizeHeading2: fontSize.h2,
    fontSizeHeading3: fontSize.h3,
    fontSizeHeading4: fontSize.h4,
    lineHeight: lineHeight.body,
    // AntD 的标题行高默认由字号推算，得到的 24px/30.4px 比规范的 24px/36px 紧一档，
    // 必须逐档显式指定，否则页面标题与设计稿对不上。
    lineHeightHeading1: lineHeight.h1,
    lineHeightHeading2: lineHeight.h2,
    lineHeightHeading3: lineHeight.h3,
    lineHeightHeading4: lineHeight.h4,

    borderRadius: radius.sm,
    borderRadiusSM: radius.xs,
    borderRadiusLG: radius.lg,

    controlHeight: 32,
    controlHeightSM: 28,
    controlHeightLG: 40,

    boxShadow: elevation[1],
    boxShadowSecondary: elevation[2],

    // 只用 1px 边框：2px 会与插画的 2px 描边产生语义混淆（4.8）
    lineWidth: 1,
    lineWidthBold: 1,

    motionDurationFast: '0.1s',
    motionDurationMid: '0.15s',
    motionDurationSlow: '0.2s',
  },
  components: {
    Layout: {
      headerHeight: layout.headerHeight,
      headerBg: neutral[0],
      headerPadding: `0 ${layout.contentPadding}px`,
      bodyBg: neutral[100],
      siderBg: neutral[0],
    },
    Menu: {
      itemBg: neutral[0],
      itemSelectedBg: brand[50],
      itemSelectedColor: brand[600],
      itemHoverBg: neutral[50],
      itemColor: neutral[700],
      iconSize: 16,
    },
    Card: {
      paddingLG: layout.cardPadding,
      borderRadiusLG: radius.lg,
    },
    Table: {
      headerBg: neutral[100],
      headerColor: neutral[600],
      headerSplitColor: 'transparent',
      rowHoverBg: neutral[50],
      rowSelectedBg: brand[50],
      rowSelectedHoverBg: brand[50],
      borderColor: neutral[200],
      cellPaddingInline: 16,
      // TB1 不用斑马纹、TB3 不画竖线（5.13）
      cellFontSize: fontSize.body,
      cellFontSizeSM: fontSize.bodySm,
    },
    Button: {
      primaryShadow: 'none',
      dangerShadow: 'none',
      defaultShadow: 'none',
      // 避免「是」「否」这类短文案按钮过窄（6.1）
      contentFontSize: fontSize.body,
    },
    Tag: {
      borderRadiusSM: radius.xs,
    },
    Tabs: {
      titleFontSize: fontSize.body,
      titleFontSizeLG: fontSize.h4,
    },
  },
};
