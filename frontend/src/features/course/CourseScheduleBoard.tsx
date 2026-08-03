import { useMemo, useState } from 'react';
import { App, Badge, Button, Calendar, DatePicker, Form, Input, Modal, Radio, Space, Table, Tag, Tooltip, Typography } from 'antd';
import { Info, Plus } from 'lucide-react';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/shared/api/client';
import { courseApi, type CourseCalendarItem, type CourseSchedule } from '@/shared/api/courses';
import { AnalyticsCard } from '@/shared/ui/CockpitLayout';
import { useIsOperator } from '@/shared/store/authStore';
import { fontSize, neutral, space } from '@/shared/theme/designTokens';

const { Text } = Typography;

/**
 * P2-4 课程排期日历（需求 9.9）。并页后它是课程工作台底部分析区的左半块。
 *
 * <p>日历上有两类事件：课程的<b>开发节点</b>（自定义名称与计划日期）与<b>预计发布日</b>。
 * 终态课程不出现在日历上——已关闭、已归档的课程留在日历里只会挤占本周要盯的那几门。
 *
 * <p><b>排课没有冲突校验</b>（需求 9.9）：同一天安排三门课的评审是运营的决定，不是系统该拦的事。
 * 平台记录线下已经发生或已经定下的安排，不替线下做判断。
 */
export function CourseScheduleBoard({ onSelect }: { onSelect: (courseId: number) => void }) {
  const { message, modal } = App.useApp();
  const queryClient = useQueryClient();
  const isOperator = useIsOperator();
  const [mode, setMode] = useState<'month' | 'week'>('month');
  const [cursor, setCursor] = useState<Dayjs>(dayjs());
  const [picking, setPicking] = useState(false);
  const [editing, setEditing] = useState<{ courseId: number; schedule?: CourseSchedule } | null>(null);
  const [form] = Form.useForm<{ nodeName: string; planDate: Dayjs; remark?: string }>();

  const range = useMemo(() => {
    const unit = mode === 'month' ? 'month' : 'week';
    return {
      from: cursor.startOf(unit).format('YYYY-MM-DD'),
      to: cursor.endOf(unit).format('YYYY-MM-DD'),
    };
  }, [cursor, mode]);

  const items = useQuery({
    queryKey: ['course-calendar', range.from, range.to],
    queryFn: () => courseApi.calendar(range.from, range.to),
  });

  const byDate = useMemo(() => {
    const map = new Map<string, CourseCalendarItem[]>();
    for (const item of items.data ?? []) {
      const list = map.get(item.eventDate) ?? [];
      list.push(item);
      map.set(item.eventDate, list);
    }
    return map;
  }, [items.data]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['course-calendar'] });
    void queryClient.invalidateQueries({ queryKey: ['courses'] });
  };

  const saveNode = useMutation({
    mutationFn: (values: { nodeName: string; planDate: Dayjs; remark?: string }) => {
      const payload = {
        nodeName: values.nodeName,
        planDate: values.planDate.format('YYYY-MM-DD'),
        remark: values.remark ?? null,
      };
      return editing?.schedule
        ? courseApi.updateSchedule(editing.schedule.id, payload).then(() => undefined)
        : courseApi.createSchedule(editing!.courseId, payload).then(() => undefined);
    },
    onSuccess: () => {
      message.success('排期节点已保存');
      setEditing(null);
      form.resetFields();
      invalidate();
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '保存失败，请重试'),
  });

  const deleteNode = useMutation({
    mutationFn: (scheduleId: number) => courseApi.deleteSchedule(scheduleId),
    onSuccess: () => {
      message.success('排期节点已删除');
      invalidate();
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '删除失败，请重试'),
  });

  const listOfRange = items.data ?? [];

  return (
    <AnalyticsCard
      title="课程排期日历"
      note="展示各课程的开发节点与预计发布日。排期不做冲突校验——同一天安排几件事由运营自己判断。走到终态的课程不再出现在日历上。"
      extra={
        <Space size={space.xs}>
          <Radio.Group
            size="small"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            optionType="button"
          >
            <Radio.Button value="month">月</Radio.Button>
            <Radio.Button value="week">周</Radio.Button>
          </Radio.Group>
          <DatePicker
            size="small"
            picker={mode === 'month' ? 'month' : 'week'}
            value={cursor}
            onChange={(value) => value && setCursor(value)}
            allowClear={false}
          />
          {isOperator && (
            <Button size="small" icon={<Plus size={13} />} onClick={() => setPicking(true)}>
              排期节点
            </Button>
          )}
        </Space>
      }
    >
      <Space direction="vertical" size={space.sm} style={{ width: '100%' }}>
        <Space size={space['2xs']}>
          <Text type="secondary" style={{ fontSize: fontSize.caption }}>
            {range.from} 至 {range.to} 共 {listOfRange.length} 项
          </Text>
          <Tooltip title="走到终态的课程不再出现——它们的节点日期已经没有意义，留在日历上只会挤占这周真正要盯的课。">
            <Info size={12} color={neutral[500]} aria-label="哪些课程不在日历上" />
          </Tooltip>
        </Space>

        {mode === 'month' ? (
          <Calendar
            fullscreen={false}
            value={cursor}
            // 卡片头上已经有月/周与月份选择器了。AntD 自带的年月下拉会在同一块卡片里出现
            // 第二套翻月控件，两套还各管各的
            headerRender={() => null}
            onPanelChange={(value) => setCursor(value)}
            onSelect={(value) => setCursor(value)}
            cellRender={(date, info) => {
              if (info.type !== 'date') {
                return info.originNode;
              }
              const list = byDate.get(date.format('YYYY-MM-DD')) ?? [];
              return (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {list.slice(0, 2).map((item) => (
                    <li key={`${item.eventType}-${item.scheduleId ?? item.courseId}`}>
                      <Badge
                        status={item.scheduleId === null ? 'processing' : 'default'}
                        text={
                          <span
                            style={{ fontSize: fontSize.caption, cursor: 'pointer' }}
                            onClick={() => onSelect(item.courseId)}
                          >
                            {item.nodeName ?? item.eventType}·{item.courseName}
                          </span>
                        }
                      />
                    </li>
                  ))}
                  {list.length > 2 && (
                    <li>
                      <Text type="secondary" style={{ fontSize: fontSize.caption }}>
                        另有 {list.length - 2} 项
                      </Text>
                    </li>
                  )}
                </ul>
              );
            }}
          />
        ) : null}

        <Table<CourseCalendarItem>
          size="small"
          rowKey={(row) => `${row.eventType}-${row.scheduleId ?? row.courseId}-${row.eventDate}`}
          dataSource={listOfRange}
          loading={items.isLoading}
          pagination={false}
          // 一个区间内的排期条数不定，超过一屏就滚，不分页：翻页会让「这个月有几件事」要数两下
          scroll={{ y: 240 }}
          locale={{ emptyText: '这段时间没有排期' }}
          columns={[
            { title: '日期', dataIndex: 'eventDate', width: 104 },
            {
              title: '事件',
              dataIndex: 'eventType',
              width: 96,
              render: (type: string, row) => (
                <Tag color={row.scheduleId === null ? 'blue' : 'default'}>{type}</Tag>
              ),
            },
            { title: '节点名称', dataIndex: 'nodeName', render: (v: string | null) => v ?? '—' },
            {
              title: '课程',
              dataIndex: 'courseName',
              ellipsis: true,
              // 课程ID 与主状态两列在并页后撤掉了：它们在同一屏的状态地图与列表视图里都有，
              // 而这块只有半屏宽，八列全留会让每列都是省略号
              render: (name: string, row) => (
                <Button type="link" style={{ padding: 0 }} onClick={() => onSelect(row.courseId)}>
                  {name}
                </Button>
              ),
            },
            {
              title: '负责人',
              dataIndex: 'ownerName',
              width: 90,
              render: (v: string | null, row) => v ?? row.ownerNo,
            },
            {
              title: '操作',
              key: 'actions',
              width: 110,
              align: 'right',
              render: (_, row) =>
                isOperator && row.scheduleId !== null ? (
                  <Space size={space.sm}>
                    <Button
                      type="link"
                      size="small"
                      style={{ padding: 0 }}
                      onClick={() => {
                        setEditing({
                          courseId: row.courseId,
                          schedule: {
                            id: row.scheduleId!,
                            courseId: row.courseId,
                            nodeName: row.nodeName ?? '',
                            planDate: row.eventDate,
                            remark: null,
                            createdAt: '',
                            createdBy: '',
                            updatedAt: '',
                            updatedBy: null,
                          },
                        });
                        form.setFieldsValue({
                          nodeName: row.nodeName ?? '',
                          planDate: dayjs(row.eventDate),
                        });
                      }}
                    >
                      编辑
                    </Button>
                    <Button
                      type="link"
                      size="small"
                      danger
                      style={{ padding: 0 }}
                      onClick={() =>
                        modal.confirm({
                          title: `删除排期节点「${row.nodeName}」`,
                          content: '删除后这门课在该日期不再出现在日历上，课程本身不受影响。',
                          okText: '删除',
                          okButtonProps: { danger: true },
                          cancelText: '取消',
                          onOk: () => deleteNode.mutateAsync(row.scheduleId!),
                        })
                      }
                    >
                      删除
                    </Button>
                  </Space>
                ) : null,
            },
          ]}
        />
      </Space>

      <CourseNodePicker
        open={picking}
        onCancel={() => setPicking(false)}
        onPicked={(courseId) => {
          setPicking(false);
          setEditing({ courseId });
          form.resetFields();
          form.setFieldsValue({ planDate: cursor });
        }}
      />

      <Modal
        open={editing !== null}
        title={editing?.schedule ? '编辑排期节点' : '新增排期节点'}
        okText="保存"
        cancelText="取消"
        confirmLoading={saveNode.isPending}
        onCancel={() => setEditing(null)}
        onOk={() => void form.validateFields().then((values) => saveNode.mutateAsync(values))}
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item
            label="节点名称"
            name="nodeName"
            extra="如「初稿完成」「内部试讲」。名称自由填写，不与状态机绑定"
            rules={[{ required: true, message: '请填写节点名称' }]}
          >
            <Input maxLength={100} />
          </Form.Item>
          <Form.Item label="计划日期" name="planDate" rules={[{ required: true, message: '请选择计划日期' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="备注" name="remark">
            <Input.TextArea rows={3} maxLength={500} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </AnalyticsCard>
  );
}

/**
 * 新增节点前先选课程。
 *
 * <p>课程数量在数百量级，用搜索选择而不是长下拉——运营记得住课名，记不住课程ID。
 */
function CourseNodePicker({
  open,
  onCancel,
  onPicked,
}: {
  open: boolean;
  onCancel: () => void;
  onPicked: (courseId: number) => void;
}) {
  const [keyword, setKeyword] = useState('');
  const courses = useQuery({
    queryKey: ['courses', 'picker', keyword],
    queryFn: () => courseApi.page({ keyword: keyword || null }, 1, 20),
    enabled: open,
  });

  return (
    <Modal open={open} title="选择课程" footer={null} onCancel={onCancel}>
        <Space direction="vertical" size={space.sm} style={{ width: '100%' }}>
          <Input.Search placeholder="课程ID / 名称" onSearch={setKeyword} allowClear />
          <Table
            size="small"
            rowKey={(row) => String(row.id)}
            dataSource={courses.data?.records ?? []}
            loading={courses.isLoading}
            pagination={false}
            locale={{ emptyText: '没有匹配的课程' }}
            columns={[
              { title: '课程ID', dataIndex: 'courseNo', width: 120 },
              { title: '课程名称', dataIndex: 'courseName' },
              { title: '主状态', dataIndex: 'mainState', width: 100 },
              {
                title: '',
                key: 'pick',
                width: 70,
                align: 'right',
                render: (_, row) => (
                  <Button type="link" size="small" style={{ padding: 0 }} onClick={() => onPicked(row.id)}>
                    选择
                  </Button>
                ),
              },
            ]}
          />
        <Text type="secondary" style={{ color: neutral[600] }}>
          只列出前 20 条，用关键字缩小范围。
        </Text>
      </Space>
    </Modal>
  );
}
