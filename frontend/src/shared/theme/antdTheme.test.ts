import { describe, expect, it } from 'vitest';
import { antdTheme } from './antdTheme';
import { brand, fontSize, lineHeight, neutral } from './designTokens';
import { colorV2, radiusV2, sizeV2 } from './designTokensV2';
import { SHELL_NAV } from '@/app/shell/shellNav';
import {
  CENTER_PAGES,
  COCKPITS,
  LEGACY_REDIRECTS,
  OPERATION_PAGES,
  REQUIREMENT_PAGES,
  ROUTE_PAGES,
} from '@/app/navigation';

/**
 * 出口准则 E0-4 的自动化证据：设计 Token 已注入前端主题。
 *
 * <p><b>本组断言在 V2.0 落地时整体换过基准值。</b>原先锁的是《设计基础规范 V1.1》，
 * 现在锁《设计文档 V2.0》——业务已裁决「设计 Token 全部以 V2.0 为准」
 * （docs/文档待修清单.md V-2～V-5）。断言的作用没变：把最容易被写错、
 * 而且写错了肉眼几乎看不出的几个值钉死。
 */
describe('AntD 主题与设计 Token V2.0 一致（E0-4）', () => {
  it('主按钮色是交互主色 #3974FA，不是品牌识别色 #5B82FF', () => {
    expect(antdTheme.token?.colorPrimary).toBe('#3974FA');
    expect(antdTheme.token?.colorPrimary).toBe(colorV2.brandAction);
    // 品牌识别色只用于 Logo、插画与图表主序列，不做交互色（V2.0 2.1）
    expect(antdTheme.token?.colorPrimary).not.toBe(colorV2.brandPrimary);
    // 也不能退回 V1.1 的交互色，否则同屏两套蓝
    expect(antdTheme.token?.colorPrimary).not.toBe(brand[600]);
  });

  it('主按钮 hover #2F67ED、active #285BD9', () => {
    expect(antdTheme.token?.colorPrimaryHover).toBe(colorV2.brandActionHover);
    expect(antdTheme.token?.colorPrimaryActive).toBe(colorV2.brandActionActive);
  });

  it('控件圆角 8px、卡片 12px、标签 4px（V2.0 2.3，控件比 V1.1 的 6px 大一档）', () => {
    expect(antdTheme.token?.borderRadius).toBe(8);
    expect(antdTheme.token?.borderRadius).toBe(radiusV2.control);
    expect(antdTheme.token?.borderRadiusLG).toBe(radiusV2.card);
    expect(antdTheme.token?.borderRadiusSM).toBe(radiusV2.tag);
  });

  it('正文字号 14px、标准控件高 36px、紧凑 28px（V2.0 2.4）', () => {
    expect(antdTheme.token?.fontSize).toBe(14);
    expect(antdTheme.token?.fontSize).toBe(fontSize.body);
    expect(antdTheme.token?.controlHeight).toBe(sizeV2.controlHeight);
    expect(antdTheme.token?.controlHeight).toBe(36);
    expect(antdTheme.token?.controlHeightSM).toBe(sizeV2.compactHeight);
  });

  /**
   * 这两条断言的方向被业务裁决<b>反转</b>了。
   *
   * <p>V1.1 特意把控件边框调到 #8A929E、placeholder 调到 #667085，就是为了满足
   * WCAG 2.1 的 SC 1.4.11（界面组件边界 ≥3:1）与 SC 1.4.3（正文 ≥4.5:1）。
   * V2.0 给的 #E5E7EB（约 1.2:1）与 #ACB3BD（约 2.2:1）都不达标。
   *
   * <p>业务裁决以 V2.0 为准并明确接受这个风险（V-4／V-5）。断言留在这里是为了
   * 「反转」这件事本身有记录：谁哪天想把它改回 V1.1，会先看到这段注释，
   * 知道那不是修 Bug 而是推翻一个已生效的业务决定。
   */
  it('控件边框取 V2.0 的 #E5E7EB —— 刻意不满足 WCAG 3:1，见 V-4', () => {
    expect(antdTheme.token?.colorBorder).toBe(colorV2.borderDefault);
    expect(antdTheme.token?.colorBorder).not.toBe(neutral[500]);
  });

  it('placeholder 取 V2.0 的 #ACB3BD —— 刻意不满足 WCAG 4.5:1，见 V-5', () => {
    expect(antdTheme.token?.colorTextPlaceholder).toBe(colorV2.textPlaceholder);
    expect(antdTheme.token?.colorTextPlaceholder).not.toBe(neutral[600]);
  });

  it('语义色四值取 V2.0 2.1（success #22C55E、warning #F59E0B、danger #EF4444、info #0EA5E9）', () => {
    expect(antdTheme.token?.colorSuccess).toBe('#22C55E');
    expect(antdTheme.token?.colorWarning).toBe('#F59E0B');
    expect(antdTheme.token?.colorError).toBe('#EF4444');
    expect(antdTheme.token?.colorInfo).toBe('#0EA5E9');
  });

  it('页面与卡片同为白色，靠 1px 边框分隔而不是底色差（V2.0 2.1）', () => {
    expect(antdTheme.token?.colorBgLayout).toBe('#FFFFFF');
    expect(antdTheme.token?.colorBgContainer).toBe('#FFFFFF');
    // #F5F7FA 在 V2.0 里降级为弱背景，不再是页面底色
    expect(antdTheme.token?.colorFillAlter).toBe(colorV2.bgMuted);
  });

  it('表格不画表头竖线（TB3），选中行用 #F4F7FF（V2.0 15 组件矩阵）', () => {
    expect(antdTheme.components?.Table?.headerSplitColor).toBe('transparent');
    expect(antdTheme.components?.Table?.rowSelectedBg).toBe(colorV2.brand50);
  });

  it('表格正文 13px，比页面正文小一档（V2.0 2.2）', () => {
    expect(antdTheme.components?.Table?.headerBg).toBe(colorV2.bgMuted);
    expect(antdTheme.components?.Table?.headerColor).toBe(colorV2.textTertiary);
    expect(antdTheme.components?.Table?.cellFontSize).toBe(13);
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

/**
 * 并页之后这组断言的对象变了，但要守的东西没变。
 *
 * <p>《平台驾驶舱全景》设计稿把每个驾驶舱画成一整屏，侧栏是扁平 11 项；需求文档写的是
 * 24 个一级页面。二者不冲突——24 项是内容清单，设计稿定的是内容怎么组合。因此这里断言的
 * 不再是「有 24 条路由」，而是<b>那 24 项内容一项都没在并页时掉队</b>：{@code REQUIREMENT_PAGES}
 * 仍然是 24 条，各驾驶舱的 {@code views} 逐条登记它这一屏装了哪几项。
 *
 * <p>少了这组断言，「把三页并成一页」与「把三页里的两页悄悄删了」在代码上看起来一模一样。
 */
describe('并页后仍覆盖一期全部 24 个一级页面', () => {
  it('内容清单总数为 24（总看板 1 + 五驾驶舱 18 + 三中心 3 + 导入中心 1 + 配置中心 1）', () => {
    expect(REQUIREMENT_PAGES).toHaveLength(24);
  });

  it('页面编号与路径均无重复', () => {
    expect(new Set(REQUIREMENT_PAGES.map((p) => p.code)).size).toBe(24);
    expect(new Set(REQUIREMENT_PAGES.map((p) => p.path)).size).toBe(24);
  });

  it('五个驾驶舱一共装下 18 项，与需求文档的五驾驶舱页数一致', () => {
    expect(COCKPITS.flatMap((cockpit) => cockpit.views)).toHaveLength(18);
  });

  it('侧栏是扁平 11 项（总看板 + 五驾驶舱 + 三中心 + 导入中心 + 配置中心）', () => {
    expect(1 + COCKPITS.length + CENTER_PAGES.length + OPERATION_PAGES.length).toBe(11);
  });

  it('每个驾驶舱的主路径与它自己的详情深链都要有路由，否则点行会落到 404', () => {
    const routed = new Set(ROUTE_PAGES.map((p) => p.path));
    COCKPITS.forEach((cockpit) => {
      expect(routed.has(cockpit.path)).toBe(true);
      cockpit.detailPaths.forEach((path) => expect(routed.has(path)).toBe(true));
    });
  });

  it('并页前的旧地址都有落点，不落到「页面不存在」', () => {
    const routed = new Set(ROUTE_PAGES.map((p) => p.path));
    Object.entries(LEGACY_REDIRECTS).forEach(([from, to]) => {
      // 旧地址本身不再是路由，它的落点必须是
      expect(routed.has(from)).toBe(false);
      expect(routed.has(to)).toBe(true);
    });
  });

  it('已删除的组织覆盖视图不在页面清单内（N12），侧栏也不用设计稿的「案例与组织覆盖」', () => {
    expect(REQUIREMENT_PAGES.some((p) => p.title.includes('组织覆盖'))).toBe(false);
    expect(COCKPITS.some((cockpit) => cockpit.title.includes('组织覆盖'))).toBe(false);
  });

  /**
   * 侧栏第 8 项叫「消息中心」，装的是催办记录台账。
   *
   * <p>业务裁决 V-1：沿用 V2.0 P08 的几何与界面名，内容语义按需求 13.2 的催办台账。
   * 所以这里守的不再是「消息中心不进侧栏」，而是<b>名字换了、能力没换</b>：
   * 界面名可以是消息中心，但代码标识必须是 escalation（命名对照表：催办台账 = escalation，
   * 不用 message／notification —— 系统不发消息）。
   *
   * <p>一旦有人把路由或标识也改成 message，下一步几乎必然是加「发送」按钮，
   * 那就直接违反 MSG1 与一期不做清单第 4、5 项。
   */
  it('侧栏第 8 项界面名是「消息中心」，但路由仍是 escalation（V-1）', () => {
    const message = SHELL_NAV.find((item) => item.label === '消息中心');
    expect(message).toBeDefined();
    expect(message?.path).toBe('/escalations');
    expect(SHELL_NAV.every((item) => !item.path.includes('message'))).toBe(true);
  });

  it('需求侧的内容清单仍写「催办记录台账」，两处名字不同是刻意的', () => {
    const sidebar = [...COCKPITS.map((c) => c.title), ...CENTER_PAGES.map((p) => p.title)];
    expect(sidebar).toContain('催办记录台账');
  });

  it('导入中心与配置中心仅运营账号可见（需求 13.8、13.9）', () => {
    const operatorOnly = REQUIREMENT_PAGES.filter((p) => p.operatorOnly).map((p) => p.title);
    expect(operatorOnly).toEqual(['导入中心', '配置中心']);
  });
});
