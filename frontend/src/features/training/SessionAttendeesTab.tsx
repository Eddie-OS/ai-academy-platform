import { useState } from 'react';
import {
  Alert,
  App,
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import dayjs, { type Dayjs } from 'dayjs';
import { ApiError } from '@/shared/api/client';
import { trainingApi, type AttendeeRow } from '@/shared/api/trainings';
import { useIsOperator } from '@/shared/store/authStore';
import { formatDateTime } from '@/shared/format';
import { space } from '@/shared/theme/designTokens';
import { TRAINING_ENUM_KEYS, selectOptions, useEmployees, useFieldEnums } from './trainingMeta';

const { Text } = Typography;

/**
 * 场次详情的「参训人员与签到」页签（需求 11.5，页面 P4-4）。
 *
 * <p><b>名单与签到合并成一张表。</b>运营在这个页签上要回答的问题是「谁没来」，
 * 两张表分开摆就得自己对。没有签到记录的人显示成「未导入」，不是空白——
 * 空白会被当成「这个人没签到」，而那是另一回事。
 *
 * <p><b>没有「新增签到」入口</b>（业务确认项 6）：签到的录入通道只有导入。名单上还没有签到
 * 记录的人，补的办法是重新导一次那个场次的签到表。
 */

interface SessionAttendeesTabProps {
  sessionId: number;
}

export function SessionAttendeesTab({ sessionId }: SessionAttendeesTabProps) {
  const { message, modal } = App.useApp();
  const queryClient = useQueryClient();
  const isOperator = useIsOperator();
  const fieldEnums = useFieldEnums();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<AttendeeRow | null>(null);

  const board = useQuery({
    queryKey: ['training-sessions', sessionId, 'attendees'],
    queryFn: () => trainingApi.attendees(sessionId),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['training-sessions', sessionId, 'attendees'] });
    // 实际签到人数是场次的展示字段，名单一动它就变
    void queryClient.invalidateQueries({ queryKey: ['training-sessions'] });
  };

  const remove = useMutation({
    mutationFn: (attendeeId: number) => trainingApi.removeAttendee(sessionId, attendeeId),
    onSuccess: () => {
      message.success('已从参训名单移除');
      refresh();
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '移除失败，请重试'),
  });

  const data = board.data;
  const rows = data?.rows ?? [];

  return (
    <Space direction="vertical" size={space.md} style={{ width: '100%' }}>
      <Card size="small">
        <Space size={space['2xl']} wrap>
          <Statistic title="名单人数" value={data?.total ?? 0} />
          <Statistic title="已签到" value={data?.present ?? 0} />
          <Statistic title="未签到" value={data?.absent ?? 0} />
          <Statistic title="无签到记录" value={data?.noRecord ?? 0} />
        </Space>
      </Card>

      {data && data.total > 0 && data.noRecord === data.total && (
        <Alert
          type="info"
          showIcon
          message="本场次尚未导入签到"
          description="名单上的人都还没有签到记录。签到从导入中心的「签到记录导入」进来，按工号覆盖，可以重复导。"
        />
      )}

      {isOperator && (
        <div>
          <Button icon={<Plus size={14} />} onClick={() => setAdding(true)}>
            添加参训人员
          </Button>
        </div>
      )}

      <Table<AttendeeRow>
        size="small"
        rowKey={(row) => String(row.id)}
        dataSource={rows}
        loading={board.isLoading}
        pagination={false}
        locale={{ emptyText: '还没有参训人员。可以手工添加，也可以直接导入签到自动加入' }}
        columns={[
          { title: '工号', dataIndex: 'employeeNo', width: 110 },
          { title: '姓名', dataIndex: 'employeeName', width: 100 },
          { title: '部门', dataIndex: 'deptName', width: 160, render: (v: string | null) => v ?? '—' },
          {
            title: '加入方式',
            dataIndex: 'joinSource',
            width: 160,
            render: (value: string) => <Tag>{value}</Tag>,
          },
          {
            title: '签到状态',
            dataIndex: 'attendStatus',
            width: 100,
            // 没有签到记录 ≠ 未签到：前者是「这场还没导签到」，后者是「导了，这个人没来」
            render: (value: string | null) =>
              value === null ? <Text type="secondary">未导入</Text> : <Tag color="blue">{value}</Tag>,
          },
          {
            title: '签到时间',
            dataIndex: 'attendTime',
            width: 150,
            render: (value: string | null) => formatDateTime(value),
          },
          { title: '签到备注', dataIndex: 'attendRemark', render: (v: string | null) => v ?? '—' },
          {
            title: '来源批次',
            key: 'batch',
            width: 150,
            render: (_, row) => row.attendanceBatch ?? row.importBatchNo ?? '—',
          },
          {
            title: '操作',
            key: 'actions',
            width: 160,
            align: 'right',
            render: (_, row) =>
              isOperator ? (
                <Space size={space.sm}>
                  {row.attendanceId !== null && (
                    <Button type="link" size="small" style={{ padding: 0 }} onClick={() => setEditing(row)}>
                      修改签到
                    </Button>
                  )}
                  <Button
                    type="link"
                    size="small"
                    danger
                    style={{ padding: 0 }}
                    onClick={() =>
                      modal.confirm({
                        title: `把 ${row.employeeName} 移出参训名单`,
                        content:
                          '移出后这个人不再计入名单人数与实际签到人数。签到记录本身保留，重新加入即可再看到。',
                        okText: '移出',
                        okButtonProps: { danger: true },
                        cancelText: '取消',
                        onOk: () => remove.mutateAsync(row.id),
                      })
                    }
                  >
                    移出名单
                  </Button>
                </Space>
              ) : null,
          },
        ]}
      />

      <AddAttendeesModal
        open={adding}
        sessionId={sessionId}
        existing={rows.map((row) => row.employeeNo)}
        onClose={() => setAdding(false)}
        onAdded={() => {
          setAdding(false);
          refresh();
        }}
      />

      {editing && (
        <AttendanceModal
          row={editing}
          sessionId={sessionId}
          statuses={fieldEnums.data?.[TRAINING_ENUM_KEYS.attendStatus]}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}
    </Space>
  );
}

/** 手工添加参训人员（需求 11.5.1）。已在名单上的会被后端忽略，这里同时把它们从候选里去掉。 */
function AddAttendeesModal({
  open,
  sessionId,
  existing,
  onClose,
  onAdded,
}: {
  open: boolean;
  sessionId: number;
  existing: string[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const { message } = App.useApp();
  const employees = useEmployees();
  const [selected, setSelected] = useState<string[]>([]);

  const add = useMutation({
    mutationFn: () => trainingApi.addAttendees(sessionId, selected),
    onSuccess: (result) => {
      message.success(
        result.ignored > 0
          ? `已添加 ${result.added} 人，${result.ignored} 人已在名单上`
          : `已添加 ${result.added} 人`,
      );
      setSelected([]);
      onAdded();
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '添加失败，请重试'),
  });

  return (
    <Modal
      open={open}
      title="添加参训人员"
      okText="添加"
      cancelText="取消"
      okButtonProps={{ disabled: selected.length === 0 }}
      confirmLoading={add.isPending}
      onCancel={() => {
        setSelected([]);
        onClose();
      }}
      onOk={() => void add.mutateAsync()}
    >
      <Space direction="vertical" size={space.sm} style={{ width: '100%' }}>
        <Text type="secondary">
          手工添加的人加入方式记为「运营指派」。直接导入签到时没在名单上的人会自动加入，不需要先添加。
        </Text>
        <Select
          mode="multiple"
          showSearch
          optionFilterProp="label"
          style={{ width: '100%' }}
          placeholder="按姓名或工号搜索"
          value={selected}
          onChange={setSelected}
          options={(employees.data?.records ?? [])
            .filter((item) => !existing.includes(item.employeeNo))
            .map((item) => ({
              value: item.employeeNo,
              label: `${item.employeeName}（${item.employeeNo}·${item.deptName}）`,
            }))}
        />
      </Space>
    </Modal>
  );
}

/** 单条修改已导入的签到记录（需求 11.5.3）。 */
function AttendanceModal({
  row,
  sessionId,
  statuses,
  onClose,
  onSaved,
}: {
  row: AttendeeRow;
  sessionId: number;
  statuses: string[] | undefined;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { message } = App.useApp();
  const [form] = Form.useForm<{ attendStatus: string; attendTime?: Dayjs | null; remark?: string }>();

  const save = useMutation({
    mutationFn: (values: { attendStatus: string; attendTime?: Dayjs | null; remark?: string }) =>
      trainingApi.updateAttendance(sessionId, row.attendanceId!, {
        attendStatus: values.attendStatus,
        attendTime: values.attendTime ? values.attendTime.toISOString() : null,
        remark: values.remark ?? null,
      }),
    onSuccess: () => {
      message.success('签到记录已更新');
      onSaved();
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '保存失败，请重试'),
  });

  return (
    <Modal
      open
      title={`修改 ${row.employeeName} 的签到记录`}
      okText="保存"
      cancelText="取消"
      confirmLoading={save.isPending}
      onCancel={onClose}
      // 校验不通过时 validateFields 会 reject，错误已由表单在字段下显示，这里咽掉即可
      onOk={() => void form.validateFields().then((values) => save.mutateAsync(values)).catch(() => undefined)}
    >
      <Space direction="vertical" size={space.sm} style={{ width: '100%' }}>
        <Text type="secondary">
          导入进来的签到允许单条更正（例如现场补签）。改动只影响这一条，不会动整批导入记录。
        </Text>
        <Form
          form={form}
          layout="vertical"
          requiredMark={false}
          initialValues={{
            attendStatus: row.attendStatus ?? undefined,
            attendTime: row.attendTime ? dayjs(row.attendTime) : null,
            remark: row.attendRemark ?? undefined,
          }}
        >
          <Form.Item
            label="签到状态"
            name="attendStatus"
            rules={[{ required: true, message: '请选择签到状态' }]}
          >
            <Select options={selectOptions(statuses)} />
          </Form.Item>
          <Form.Item label="签到时间" name="attendTime">
            <DatePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="备注" name="remark">
            <Input.TextArea rows={2} maxLength={500} showCount />
          </Form.Item>
        </Form>
      </Space>
    </Modal>
  );
}
