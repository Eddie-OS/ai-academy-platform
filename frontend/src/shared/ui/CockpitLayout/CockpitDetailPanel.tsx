import { useRef, type ReactNode } from 'react';
import { Button, Card, Tooltip, Typography } from 'antd';
import { Maximize2, Minimize2, X } from 'lucide-react';
import { elevation, fontSize, neutral, radius, space } from '@/shared/theme/designTokens';
import { shouldReduceMotion } from '@/shared/motion/motionPreference';
import './CockpitLayout.css';

const { Text } = Typography;

/**
 * 驾驶舱右列的对象详情面板。
 *
 * <p>它取代了原来的独立详情页：设计稿里点一行不跳页，右列换内容，左边的列表与底部的图表
 * 都还在。运营的实际动作是「在一批对象里逐条录入」，跳页会让每录一条就丢一次列表滚动位置
 * 与筛选上下文（体验总纲 3.3：U1 是批量录入者）。
 *
 * <p><b>没选中对象时整列不渲染</b>，主区独占整宽。常驻一块 460px 的「请选择」提示卡看着
 * 友好，代价是状态地图与日历这两个主区在 1440px 下永远少四分之一宽度——而它们恰恰是
 * 最吃宽度的两个。
 *
 * <p><b>为什么要有「展开」。</b>标准宽度 460px 放得下描述列表与状态区，但放不下材料版本、
 * 参训名单、签到记录这类本身就是表格的页签——挤在 460px 里要么横向滚动、要么每列都省略号。
 * 展开态把面板铺满主区宽度、临时盖住左列，退出后列表的滚动位置与选中行都还在。
 */

interface CockpitDetailPanelProps {
  /** 对象名称，作为面板标题 */
  title?: ReactNode;
  /** 标题右侧的编号、状态标签等 */
  titleExtra?: ReactNode;
  /** 标题下方一行灰字：最后修改时间、状态最后变更时间 */
  meta?: ReactNode;
  /** 页头操作按钮 */
  actions?: ReactNode;
  /** 状态与可执行动作区，固定在页签之上（体验总纲 P1：状态先于一切，不进页签、不折叠） */
  stateArea?: ReactNode;
  children?: ReactNode;
  expanded: boolean;
  onToggleExpand: () => void;
  onClose: () => void;
}

export function CockpitDetailPanel({
  title,
  titleExtra,
  meta,
  actions,
  stateArea,
  children,
  expanded,
  onToggleExpand,
  onClose,
}: CockpitDetailPanelProps) {
  const motionRef = useRef<HTMLDivElement>(null);

  const handleClose = () => {
    const element = motionRef.current;
    if (!element || shouldReduceMotion() || typeof element.animate !== 'function') {
      onClose();
      return;
    }

    const animation = element.animate(
      [
        { opacity: 1, transform: 'translateX(0)' },
        { opacity: 0, transform: 'translateX(8px)' },
      ],
      { duration: 100, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' },
    );
    void animation.finished.then(onClose, onClose);
  };

  return (
    <div ref={motionRef} className="cockpit-detail-motion">
      <Card
        size="small"
        data-testid="cockpit-detail-panel"
        data-expanded={expanded}
        style={{
          borderRadius: radius.lg,
          borderColor: neutral[200],
          boxShadow: expanded ? elevation[3] : elevation[1],
        }}
        styles={{ body: { padding: space.md } }}
      >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: space.xs }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: space.xs, flexWrap: 'wrap' }}>
            <Text strong style={{ fontSize: fontSize.h3, color: neutral[900] }}>
              {title}
            </Text>
            {titleExtra}
          </div>
          {meta && (
            <div style={{ marginTop: space['3xs'] }}>
              <Text style={{ fontSize: fontSize.caption, color: neutral[600] }}>{meta}</Text>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: space['2xs'], flexShrink: 0 }}>
          {actions}
          <Tooltip title={expanded ? '收回标准宽度' : '展开到整个主区，便于查看表格类页签'}>
            <Button
              type="text"
              size="small"
              aria-label={expanded ? '收回详情面板' : '展开详情面板'}
              icon={expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              onClick={onToggleExpand}
            />
          </Tooltip>
          <Button
            type="text"
            size="small"
            aria-label="关闭详情面板"
            icon={<X size={16} />}
            onClick={handleClose}
          />
        </div>
      </div>

      {stateArea && <div style={{ marginTop: space.sm }}>{stateArea}</div>}

      <div style={{ marginTop: space.sm }}>{children}</div>
      </Card>
    </div>
  );
}
