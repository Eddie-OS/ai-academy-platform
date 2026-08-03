import type { ThemeConfig } from 'antd';
import { elevation, fontSize, layout, lineHeight } from './designTokens';
import { colorV2, fontFamilyV2, radiusV2, sizeV2 } from './designTokensV2';

/**
 * 把设计 Token 映射为 AntD 的 ConfigProvider 主题。
 *
 * AntD 5 的 CSS-in-JS Token 体系与设计规范附录 A 的两层结构是同构的（《开发实施文档》3.4），
 * 因此设计与代码共用一套命名，这正是附录 A 的设计意图。
 *
 * <h3>色彩与圆角取《设计文档 V2.0》，不再取 V1.1</h3>
 *
 * 业务已裁决「设计 Token 全部以 V2.0 为准」（见 docs/文档待修清单.md V-2～V-5）。
 * AntD 的 Token 必须跟着一起换，否则 AntD 组件（按钮、输入框、表格）用 V1.1 的
 * <code>#4E70DB</code>，而 tokens-v2.css 管的自绘区域用 V2.0 的 <code>#3974FA</code>，
 * 同一屏里出现两个蓝——这种差异在视觉回归里表现为大面积 ΔE 超标，却很难定位到根因。
 *
 * <h3>两处刻意接受的无障碍风险</h3>
 *
 * <code>colorBorder</code> 由 V1.1 的 <code>#8A929E</code> 改为 V2.0 的 <code>#E5E7EB</code>，
 * <code>colorTextPlaceholder</code> 由 <code>#667085</code> 改为 <code>#ACB3BD</code>。
 * V1.1 那两个值是为满足 WCAG（控件边界 3:1、正文 4.5:1）才特意调深的，V2.0 的值不达标。
 * 这是业务裁决的结果而不是疏漏，已记入 V-4／V-5，**不要"顺手改回来"**。
 */
export const antdTheme: ThemeConfig = {
  token: {
    colorPrimary: colorV2.brandAction,
    colorPrimaryHover: colorV2.brandActionHover,
    colorPrimaryActive: colorV2.brandActionActive,
    colorPrimaryBg: colorV2.brand50,
    colorPrimaryBgHover: colorV2.brand100,
    colorLink: colorV2.brandAction,
    colorLinkHover: colorV2.brandActionHover,

    colorSuccess: colorV2.success,
    colorWarning: colorV2.warning,
    colorError: colorV2.danger,
    colorInfo: colorV2.info,

    colorText: colorV2.textPrimary,
    colorTextHeading: colorV2.textPrimary,
    colorTextSecondary: colorV2.textSecondary,
    colorTextTertiary: colorV2.textTertiary,
    colorTextDisabled: colorV2.textPlaceholder,
    colorTextPlaceholder: colorV2.textPlaceholder,

    // V2.0 的页面与卡片同为白色，靠 1px 边框而不是底色差来分隔（2.1）
    colorBgLayout: colorV2.bgPage,
    colorBgContainer: colorV2.bgPage,
    colorBgElevated: colorV2.bgPage,
    colorFillAlter: colorV2.bgMuted,
    colorFillSecondary: colorV2.bgMuted,

    colorBorder: colorV2.borderDefault,
    colorBorderSecondary: colorV2.borderLight,

    fontFamily: fontFamilyV2,
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

    // 2.3：控件 8px、卡片 12px、标签 4px。V1.1 的控件圆角是 6px
    borderRadius: radiusV2.control,
    borderRadiusSM: radiusV2.tag,
    borderRadiusLG: radiusV2.card,

    // 2.4：标准控件 h36、紧凑 h28。AntD 默认 32/24/40 三档，中间那档要顶到 36
    controlHeight: sizeV2.controlHeight,
    controlHeightSM: sizeV2.compactHeight,
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
      headerBg: colorV2.bgPage,
      headerPadding: `0 ${layout.contentPadding}px`,
      bodyBg: colorV2.bgPage,
      siderBg: colorV2.bgPage,
    },
    Menu: {
      itemBg: colorV2.bgPage,
      itemSelectedBg: colorV2.brand50,
      itemSelectedColor: colorV2.brandAction,
      itemHoverBg: colorV2.brand50,
      itemColor: colorV2.textSecondary,
      iconSize: 16,
    },
    Card: {
      paddingLG: sizeV2.cardPad,
      borderRadiusLG: radiusV2.card,
    },
    Table: {
      headerBg: colorV2.bgMuted,
      headerColor: colorV2.textTertiary,
      headerSplitColor: 'transparent',
      rowHoverBg: colorV2.bgMuted,
      // 15 组件矩阵：Table row selected 用 #F4F7FF
      rowSelectedBg: colorV2.brand50,
      rowSelectedHoverBg: colorV2.brand50,
      borderColor: colorV2.borderDefault,
      cellPaddingInline: 16,
      // TB1 不用斑马纹、TB3 不画竖线（5.13）。2.2：表格正文 13px，比页面正文小一档
      cellFontSize: fontSize.bodySm,
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
      borderRadiusSM: radiusV2.tag,
    },
    Tabs: {
      titleFontSize: fontSize.body,
      titleFontSizeLG: fontSize.h4,
    },
  },
};
