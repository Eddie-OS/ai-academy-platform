import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { BarChart, FunnelChart, LineChart, PieChart, ScatterChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';
import type { EChartsOption } from 'echarts';
import { isRegressionMode } from '@/app/regressionMode';

/**
 * ECharts 5 封装。全平台唯一图表组件。
 *
 * <h3>为什么用 SVG renderer 而不是默认的 Canvas</h3>
 *
 * 视觉回归要求同一份数据两次渲染的像素完全一致。Canvas 的抗锯齿走 GPU 光栅化，
 * 换机器、换显卡驱动、甚至同机器换负载都可能让边缘像素浮动几个灰阶；
 * SVG 由浏览器按矢量规则合成，结果稳定得多。文档 1.3 的 L5 允许 0.75% 不匹配像素，
 * Canvas 折线图单张就可能吃掉大半配额。
 *
 * <h3>按需引入，不用 echarts 全量包</h3>
 *
 * 只注册九页实际用到的图表与组件。全量包 1MB+，而这里注册的部分约 200KB。
 * 需要新图表类型时在这里加一行 use()，不要在业务代码里 import 'echarts'。
 *
 * <p><b>漏注册不报错。</b>未注册类型的 series 会被静默跳过：图照样画出来，只是少了一条。
 * 总看板四条效率折线的终点标注（圆点 + 日期 + 当期值）就因为漏了 ScatterChart 而整批不见，
 * 而折线本身渲染正常，控制台一片干净。所以 p01 spec 里有一条断言直接查这四个标注的文本。
 */
echarts.use([
  LineChart,
  BarChart,
  PieChart,
  FunnelChart,
  ScatterChart,
  GridComponent,
  TooltipComponent,
  SVGRenderer,
]);

export interface ChartProps {
  option: EChartsOption;
  width?: number | string;
  height: number | string;
  /** 无障碍描述。图表不是唯一信息载体，关键数字必须同时以文本出现（设计规范 VC2 同理） */
  ariaLabel: string;
}

export function Chart({ option, width = '100%', height, ariaLabel }: ChartProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const chart = echarts.init(el, undefined, { renderer: 'svg' });
    chart.setOption({
      // 回归模式必须关动画：ECharts 的入场动画是 requestAnimationFrame 驱动的，
      // 截图时刻落在动画中途就会拍到半截折线，而且每次落点还不一样
      animation: !isRegressionMode(),
      ...option,
    });

    // 容器尺寸由 CSS 变量决定，父级布局变化时要跟着重算
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(el);

    return () => {
      observer.disconnect();
      chart.dispose();
    };
  }, [option]);

  return <div ref={ref} style={{ width, height }} role="img" aria-label={ariaLabel} />;
}
