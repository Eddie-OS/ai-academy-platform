import { useMemo, useState } from 'react';
import { App, Card, Modal, Space, Spin, Tag, Tooltip, Typography } from 'antd';
import { Info } from 'lucide-react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/shared/api/client';
import { COURSE_OBJECT_TYPE, courseApi, type Course, type CourseFilter } from '@/shared/api/courses';
import { actionTo, fieldOf, transitionApi, type ActionOption, type ObjectStateView } from '@/shared/api/transitions';
import { useIsOperator } from '@/shared/store/authStore';
import { brand, elevation, fontSize, neutral, radius, space } from '@/shared/theme/designTokens';
import { COURSE_OBJECT_TYPE_CODE, COURSE_STATE_FIELDS, useMachines } from '@/features/course/courseMeta';
import { DELEGATED_ACTIONS } from '@/features/course/CourseTransitionPanel';

const { Text } = Typography;

/**
 * P2-3 课程状态地图（需求 9.2）：每个主状态一列，卡片可拖动，<b>仅在合法转换范围内生效</b>。
 *
 * <p>它是课程工作台主区的默认视图（设计稿《课程工作台》中部就是这块看板），与「课程列表」
 * 表格视图共用同一套筛选条件。
 *
 * <p>「合法与否」不由前端判断。拖动落下时去后端的 available 接口找「能走到目标状态的动作」：
 * 找到就弹确认框执行，找不到就明说当前状态到目标状态没有通路。前端自己维护一份转换表，
 * 等于把需求第 5 章的 74 条转换抄第二遍，而抄错的那几条只会在运营拖动时才暴露。
 *
 * <p><b>录入结论类的动作拖不动。</b>「评审决策 → 试讲」要连同评审结论一起写，
 * 拖一下就改状态会留下没有结论的评审轮次，因此这类目标状态给出引导而不是执行。
 *
 * <p>拖拽用原生 HTML5 drag-and-drop：一期不允许引入 AntD 之外的 UI 库，为一个页面上一套
 * 拖拽库不划算。
 */

/** 一列最多渲染多少张卡片。状态地图是概览，不是列表页。 */
const MAX_CARDS_PER_COLUMN = 50;

interface CourseStateMapProps {
  /** 与列表视图共用的筛选条件。两个视图筛出的必须是同一批课，否则切换视图数量会对不上 */
  filter: CourseFilter;
  /** 点卡片在右侧面板打开 */
  onSelect: (courseId: number) => void;
  /** 当前在面板里打开的课程，卡片加选中边框 */
  activeId: number | null;
}

export function CourseStateMap({ filter, onSelect, activeId }: CourseStateMapProps) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const isOperator = useIsOperator();
  const [dragging, setDragging] = useState<Course | null>(null);
  const [hoverState, setHoverState] = useState<string | null>(null);
  const [pending, setPending] = useState<{ course: Course; option: ActionOption; toState: string } | null>(null);

  const machines = useMachines();
  const mainStates =
    machines.data?.find(
      (m) => m.objectType === COURSE_OBJECT_TYPE_CODE && m.stateField === COURSE_STATE_FIELDS.main,
    )?.states ?? [];

  // 状态地图要看全量分布，因此一次取满上限而不分页；使用者上限 100 人、课程量级在数百
  const courses = useQuery({
    queryKey: ['courses', 'state-map', filter],
    queryFn: () => courseApi.page(filter, 1, 200),
  });

  const rows = useMemo(() => courses.data?.records ?? [], [courses.data]);

  // 每张卡片的可执行动作各不相同，逐个取。TanStack Query 会去重与缓存，
  // 拖动时才需要它，因此这里只在有数据后触发
  const availabilities = useQueries({
    queries: rows.map((course) => ({
      queryKey: ['courses', course.id, 'available'],
      queryFn: () => transitionApi.available(COURSE_OBJECT_TYPE, course.id),
      staleTime: 30 * 1000,
    })),
  });
  const availabilityOf = (courseId: number): ObjectStateView | undefined =>
    availabilities.find((q) => q.data?.objectId === courseId)?.data;

  const transit = useMutation({
    mutationFn: () =>
      transitionApi.transit(COURSE_OBJECT_TYPE, pending!.course.id, {
        stateField: COURSE_STATE_FIELDS.main,
        action: pending!.option.action,
        version: pending!.course.version,
        remark: null,
      }),
    onSuccess: (result) => {
      message.success(`${pending?.course.courseName} 已变更为「${result.toState}」`);
      setPending(null);
      void queryClient.invalidateQueries({ queryKey: ['courses'] });
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '状态变更失败，请重试'),
  });

  const onDrop = (toState: string) => {
    const course = dragging;
    setDragging(null);
    setHoverState(null);
    if (!course || course.mainState === toState) {
      return;
    }
    const field = fieldOf(availabilityOf(course.id), COURSE_STATE_FIELDS.main);
    const option = actionTo(field, toState);
    if (!option) {
      message.warning(`「${course.mainState}」不能直接变为「${toState}」，转换表里没有这条通路。`);
      return;
    }
    // 录入结论类的动作不能只改状态：拖一下会留下一条没有结论的评审／试讲记录
    const tab = DELEGATED_ACTIONS[option.action];
    if (tab) {
      message.warning(`「${option.label}」要连同结论一起保存，请到右侧详情面板的「${tab}」页签录入。`);
      return;
    }
    setPending({ course, option, toState });
  };

  return (
    <Card
      size="small"
      style={{ borderRadius: radius.lg, borderColor: neutral[200] }}
      styles={{ body: { padding: space.sm } }}
      title={
        <Space size={space.xs}>
          <Text strong>课程状态地图</Text>
          <Text style={{ fontSize: fontSize.caption, color: neutral[600], fontWeight: 400 }}>
            {isOperator
              ? '拖动卡片到目标状态列即可变更主状态，只有转换表里存在的通路会生效'
              : '按主状态分布查看课程。用户账号只读，卡片不可拖动'}
          </Text>
          {/* 这条说明原本是一整块 Alert。并页后主区上方已经有指标卡与筛选行两段，
              再压一条常驻横幅会把看板挤到首屏之外，而它要说的话每次都一样 */}
          <Tooltip title="由评审结论、试讲结论驱动的状态变更要连同结论一起保存，拖动只会得到一条没有结论的记录，因此拖到这些列时会引导到对应页签。">
            <Info size={13} color={neutral[500]} aria-label="录入结论类的变更为什么拖不动" />
          </Tooltip>
        </Space>
      }
    >
      <Spin spinning={courses.isLoading}>
        <div style={{ display: 'flex', gap: space.sm, overflowX: 'auto', paddingBottom: space.xs }}>
          {mainStates.map((state) => {
            const cards = rows.filter((course) => course.mainState === state);
            return (
              <div
                key={state}
                data-testid="state-column"
                data-state={state}
                onDragOver={(e) => {
                  if (!isOperator) {
                    return;
                  }
                  e.preventDefault();
                  setHoverState(state);
                }}
                onDragLeave={() => setHoverState((current) => (current === state ? null : current))}
                onDrop={() => onDrop(state)}
                style={{
                  // 220px 是卡片里「课程名 + 课程ID · 负责人」两行不折行的下限。
                  // 12 个主状态一定要横向滚动，缩到更窄只会让每张卡片都换行
                  minWidth: 220,
                  flex: '0 0 220px',
                  background: hoverState === state ? brand[50] : neutral[100],
                  border: `1px solid ${hoverState === state ? brand[300] : neutral[200]}`,
                  borderRadius: radius.lg,
                  padding: space.sm,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: space.sm }}>
                  <Text strong>{state}</Text>
                  <Tag>{cards.length}</Tag>
                </div>
                <Space direction="vertical" size={space.xs} style={{ width: '100%' }}>
                  {cards.slice(0, MAX_CARDS_PER_COLUMN).map((course) => (
                    <Card
                      key={course.id}
                      size="small"
                      data-testid="course-card"
                      data-course-id={course.id}
                      draggable={isOperator}
                      onDragStart={() => setDragging(course)}
                      onDragEnd={() => setDragging(null)}
                      onClick={() => onSelect(course.id)}
                      styles={{ body: { padding: space.sm } }}
                      style={{
                        cursor: isOperator ? 'grab' : 'pointer',
                        boxShadow: dragging?.id === course.id ? elevation[3] : elevation[0],
                        // 选中态与拖动态用不同通道表达：边框表示「面板里打开的是它」，
                        // 阴影表示「正在拖它」。都用阴影会分不清刚才拖的是哪张
                        borderColor: course.id === activeId ? brand[500] : undefined,
                        background: course.id === activeId ? brand[50] : undefined,
                      }}
                    >
                      <Text strong style={{ display: 'block' }} ellipsis={{ tooltip: course.courseName }}>
                        {course.courseName}
                      </Text>
                      <Text type="secondary" style={{ fontSize: fontSize.caption }}>
                        {course.courseNo} · {course.ownerName ?? course.ownerNo}
                      </Text>
                      <div style={{ marginTop: space['2xs'] }}>
                        <Text type="secondary" style={{ fontSize: fontSize.caption }}>
                          预计发布 {course.expectPublishDate}
                        </Text>
                      </div>
                    </Card>
                  ))}
                  {cards.length > MAX_CARDS_PER_COLUMN && (
                    <Text type="secondary" style={{ fontSize: fontSize.caption }}>
                      另有 {cards.length - MAX_CARDS_PER_COLUMN} 门，切到列表视图按条件筛选查看
                    </Text>
                  )}
                  {cards.length === 0 && (
                    <Text type="secondary" style={{ fontSize: fontSize.caption }}>
                      这一状态下没有课程
                    </Text>
                  )}
                </Space>
              </div>
            );
          })}
        </div>
      </Spin>

      <Modal
        open={pending !== null}
        title="确认变更课程主状态"
        okText="确认变更"
        cancelText="取消"
        confirmLoading={transit.isPending}
        onCancel={() => setPending(null)}
        onOk={() => transit.mutate()}
      >
        <Text>
          将「{pending?.course.courseName}」从「{pending?.course.mainState}」变更为「{pending?.toState}」，
          执行动作「{pending?.option.label}」。变更会写入流转日志。
        </Text>
      </Modal>
    </Card>
  );
}
