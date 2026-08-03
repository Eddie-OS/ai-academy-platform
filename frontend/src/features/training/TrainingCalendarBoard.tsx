import { useMemo, useState } from 'react';
import { App, Calendar, Card, DatePicker, Radio, Space, Tag, Tooltip, Typography } from 'antd';
import { Info } from 'lucide-react';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/shared/api/client';
import { trainingApi, type TrainingSession, type TrainingSessionFilter } from '@/shared/api/trainings';
import { useIsOperator } from '@/shared/store/authStore';
import { formatTime } from '@/shared/format';
import { brand, fontSize, neutral, radius, space } from '@/shared/theme/designTokens';
import {
  TRAINING_OBJECT_TYPE_CODES,
  TRAINING_STATE_FIELDS,
  useStates,
} from '@/features/training/trainingMeta';

const { Text } = Typography;

/**
 * P4-1 培训排期日历（需求 11.8）。它是培训运营地图主区的默认视图，设计稿《培训运营地图》
 * 中部就是这块日历。
 *
 * <p><b>展示单元是场次不是计划</b>：计划横跨一两个月，铺在日历上没有信息量；运营在日历上找的是
 * 「这周哪天有课、谁讲」。计划以列表形态放在底部分析区。
 *
 * <p><b>拖动改期只改日期</b>：讲师与课程没变，两项硬阻断校验按落地要点第 5 条不回溯已排的场次；
 * 但时段冲突要重新算——拖到另一天正是可能撞上别的场次的操作，因此拖完把提示弹出来。
 *
 * <p><b>卡片颜色按状态在状态机里的次序取</b>，不按状态名查表：前端不写死状态值（纪律 STK-1）。
 * 颜色只是辅助，卡片上的状态文字才是识别载体。
 */

/** 一个月的场次是几十条量级，一次取满即可，日历不分页。 */
const CALENDAR_PAGE_SIZE = 200;

/** 按状态在状态机里的次序取色。顺序即业务流程顺序（待开课 → … → 终态）。 */
const STATE_COLORS = ['blue', 'green', 'gold', 'default'] as const;

interface TrainingCalendarBoardProps {
  /** 筛选条件由驾驶舱页统一持有：顶部筛选行筛的就是这块日历上的场次 */
  filter: TrainingSessionFilter;
  onSelectSession: (sessionId: number) => void;
  activeSessionId: number | null;
}

export function TrainingCalendarBoard({
  filter,
  onSelectSession,
  activeSessionId,
}: TrainingCalendarBoardProps) {
  const { message, modal } = App.useApp();
  const queryClient = useQueryClient();
  const isOperator = useIsOperator();
  const [mode, setMode] = useState<'month' | 'week'>('month');
  const [cursor, setCursor] = useState<Dayjs>(dayjs());

  const sessionStates = useStates(TRAINING_OBJECT_TYPE_CODES.session, TRAINING_STATE_FIELDS.session);

  const range = useMemo(() => {
    const unit = mode === 'month' ? 'month' : 'week';
    return {
      dateFrom: cursor.startOf(unit).format('YYYY-MM-DD'),
      dateTo: cursor.endOf(unit).format('YYYY-MM-DD'),
    };
  }, [cursor, mode]);

  const sessions = useQuery({
    queryKey: ['training-sessions', 'calendar', range, filter],
    queryFn: () => trainingApi.sessions({ ...filter, ...range }, 1, CALENDAR_PAGE_SIZE),
  });

  const byDate = useMemo(() => {
    const map = new Map<string, TrainingSession[]>();
    for (const item of sessions.data?.records ?? []) {
      const list = map.get(item.trainingDate) ?? [];
      list.push(item);
      map.set(item.trainingDate, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return map;
  }, [sessions.data]);

  const colorOf = (state: string): string => {
    const index = sessionStates.indexOf(state);
    return (index >= 0 ? STATE_COLORS[Math.min(index, STATE_COLORS.length - 1)] : undefined) ?? 'default';
  };

  const reschedule = useMutation({
    mutationFn: (params: { id: number; date: string }) =>
      trainingApi.reschedule(params.id, params.date),
    onSuccess: (result) => {
      message.success('培训日期已调整');
      void queryClient.invalidateQueries({ queryKey: ['training-sessions'] });
      if (result.warnings.length > 0) {
        modal.warning({
          title: '已改期，但有以下情况需要确认',
          content: (
            <ul style={{ paddingLeft: space.md, margin: 0 }}>
              {result.warnings.map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ul>
          ),
          okText: '知道了',
        });
      }
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '改期失败，请重试'),
  });

  const onDrop = (date: string, sessionId: number) => {
    const session = (sessions.data?.records ?? []).find((item) => item.id === sessionId);
    if (!session || session.trainingDate === date) {
      return;
    }
    modal.confirm({
      title: `把「${session.sessionName ?? session.sessionNo}」改到 ${date}`,
      content: '只改培训日期，讲师、课程与起止时间不变。改期会重新检查该讲师当天的时段冲突。',
      okText: '确认改期',
      cancelText: '取消',
      onOk: () => reschedule.mutateAsync({ id: sessionId, date }),
    });
  };

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => cursor.startOf('week').add(index, 'day')),
    [cursor],
  );

  const dayCellProps = (date: Dayjs) => ({
    onDragOver: (event: React.DragEvent) => {
      if (isOperator) {
        event.preventDefault();
      }
    },
    onDrop: (event: React.DragEvent) => {
      event.preventDefault();
      const id = Number(event.dataTransfer.getData('text/plain'));
      if (Number.isFinite(id) && id > 0) {
        onDrop(date.format('YYYY-MM-DD'), id);
      }
    },
  });

  const renderCards = (date: Dayjs, limit?: number) => {
    const list = byDate.get(date.format('YYYY-MM-DD')) ?? [];
    const shown = limit ? list.slice(0, limit) : list;
    return (
      <>
        {shown.map((item) => (
          <SessionCard
            key={item.id}
            session={item}
            color={colorOf(item.sessionState)}
            draggable={isOperator}
            active={item.id === activeSessionId}
            onOpen={() => onSelectSession(item.id)}
          />
        ))}
        {limit && list.length > limit && (
          <Text type="secondary" style={{ fontSize: fontSize.caption }}>
            另有 {list.length - limit} 场
          </Text>
        )}
      </>
    );
  };

  return (
    <Card
      title="培训排期日历"
      size="small"
      styles={{ body: { padding: space.sm } }}
      extra={
        <Space size={space.sm} wrap>
          <Text type="secondary" style={{ fontSize: fontSize.caption }}>
            {range.dateFrom} 至 {range.dateTo} 共 {sessions.data?.total ?? 0} 场
          </Text>
          {isOperator && (
            <Tooltip title="拖动卡片可以改期。拖动只改培训日期，讲师与课程不变；讲师是否仍可上岗、课程是否仍在可排状态不回溯校验——已经排定的场次不该因为讲师后来转岗而被系统推翻。时段冲突会重新检查，冲突只提示不阻断。">
              <Info size={14} color={neutral[600]} aria-label="拖动改期的规则" />
            </Tooltip>
          )}
          <DatePicker
            size="small"
            picker={mode === 'month' ? 'month' : 'week'}
            value={cursor}
            onChange={(value) => value && setCursor(value)}
            allowClear={false}
          />
          <Radio.Group
            size="small"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            optionType="button"
          >
            <Radio.Button value="month">月</Radio.Button>
            <Radio.Button value="week">周</Radio.Button>
          </Radio.Group>
        </Space>
      }
    >
      {mode === 'month' ? (
        <Calendar
          value={cursor}
          // 卡片头上已经有月/周与月份选择器了，AntD 自带的年月下拉会成为第二套翻月控件
          headerRender={() => null}
          onPanelChange={(value) => setCursor(value)}
          onSelect={(value) => setCursor(value)}
          cellRender={(date, info) => {
            if (info.type !== 'date') {
              return info.originNode;
            }
            return (
              <div style={{ minHeight: 48 }} {...dayCellProps(date)}>
                {renderCards(date, 3)}
              </div>
            );
          }}
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: space.xs }}>
          {weekDays.map((date) => (
            <div
              key={date.format('YYYY-MM-DD')}
              style={{
                minHeight: 220,
                padding: space.xs,
                border: `1px solid ${neutral[200]}`,
                borderRadius: radius.md,
                background: date.isSame(dayjs(), 'day') ? brand[50] : neutral[0],
              }}
              {...dayCellProps(date)}
            >
              <div style={{ marginBottom: space['2xs'] }}>
                <Text strong>{date.format('MM-DD')}</Text>{' '}
                <Text type="secondary" style={{ fontSize: fontSize.caption }}>
                  周{'日一二三四五六'[date.day()]}
                </Text>
              </div>
              {renderCards(date)}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/** 卡片字段按需求 11.8：场次名称、课程名称、授课讲师、开始时间、培训形式、场次状态。 */
function SessionCard({
  session,
  color,
  draggable,
  active,
  onOpen,
}: {
  session: TrainingSession;
  color: string;
  draggable: boolean;
  active: boolean;
  onOpen: () => void;
}) {
  return (
    <div
      draggable={draggable}
      onDragStart={(event) => event.dataTransfer.setData('text/plain', String(session.id))}
      onClick={onOpen}
      style={{
        cursor: 'pointer',
        marginBottom: space['3xs'],
        padding: `${space['3xs']}px ${space['2xs']}px`,
        border: `1px solid ${active ? brand[500] : neutral[200]}`,
        borderRadius: radius.xs,
        background: active ? brand[50] : neutral[0],
        fontSize: fontSize.caption,
        lineHeight: '18px',
      }}
    >
      <div>
        <Text strong style={{ fontSize: fontSize.caption }}>
          {formatTime(session.startTime)}
        </Text>{' '}
        {session.sessionName ?? session.sessionNo}
      </div>
      <div style={{ color: neutral[600] }}>
        {session.courseName ?? '—'} · {session.lecturerName ?? '—'}
      </div>
      <Space size={space['3xs']}>
        <Tag style={{ marginInlineEnd: 0 }}>{session.trainingForm}</Tag>
        <Tag color={color} style={{ marginInlineEnd: 0 }}>
          {session.sessionState}
        </Tag>
      </Space>
    </div>
  );
}
