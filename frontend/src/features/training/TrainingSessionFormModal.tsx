import { useEffect } from 'react';
import { Alert, App, DatePicker, Form, Input, InputNumber, Modal, Select, Space, TimePicker } from 'antd';
import { useMutation } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import { ApiError } from '@/shared/api/client';
import { trainingApi, type TrainingSession, type TrainingSessionForm } from '@/shared/api/trainings';
import { space } from '@/shared/theme/designTokens';
import {
  TRAINING_ENUM_KEYS,
  selectOptions,
  useFieldEnums,
  useSchedulingOptions,
} from './trainingMeta';

/**
 * 新建与编辑培训场次（需求 11.4、11.4.1）。
 *
 * <p><b>下拉里只有能排的课程与讲师</b>（落地要点第 4 条）：讲师限「可上岗」、课程限已发布之后的
 * 主状态，两条过滤都在后端做。这不是把校验挪到前端——两项硬阻断照常在保存时执行，
 * 这里只是免得运营选完才被拒。
 *
 * <p><b>时段冲突与课程已过期是提示不阻断</b>（校验三、规则 EX6）：保存成功后把提示展示出来，
 * 不要当成失败处理。「同一讲师同一天两场」在集训周是常态。
 *
 * <p><b>培训地点与线上链接的必填性由培训形式决定</b>（第 10、11 项）。哪些形式要填由后端
 * 下发（{@code 培训形式·需填培训地点}），前端不写死「线下」「混合」这两个词（纪律 STK-1）。
 */

interface TrainingSessionFormModalProps {
  open: boolean;
  /** 新建时必须给：场次挂在计划下，场次号是「计划号-序号」 */
  planId: number;
  /** 传入即为编辑 */
  session?: TrainingSession;
  /** 新建时的默认课程（取所属计划的关联课程） */
  defaultCourseId?: number | null;
  /** 新建时的默认培训日期（日历页在某一天点「新建」时用） */
  defaultDate?: string | null;
  onClose: () => void;
  onSaved: (result: { id: number; warnings: string[] }) => void;
}

interface FormValues {
  sessionName?: string | null;
  courseId: number;
  lecturerId: number;
  trainingDate: Dayjs;
  timeRange: [Dayjs, Dayjs];
  durationHours?: number | null;
  trainingForm: string;
  venue?: string | null;
  onlineLink?: string | null;
  studentScope: string;
  planAttendeeCount?: number | null;
  remark?: string | null;
}

const TIME_FORMAT = 'HH:mm';

export function TrainingSessionFormModal({
  open,
  planId,
  session,
  defaultCourseId,
  defaultDate,
  onClose,
  onSaved,
}: TrainingSessionFormModalProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const fieldEnums = useFieldEnums();
  const options = useSchedulingOptions(null, open);
  const trainingForm = Form.useWatch('trainingForm', form);

  const needsVenue =
    fieldEnums.data?.[TRAINING_ENUM_KEYS.formsNeedVenue]?.includes(trainingForm ?? '') ?? false;
  const needsOnlineLink =
    fieldEnums.data?.[TRAINING_ENUM_KEYS.formsNeedOnlineLink]?.includes(trainingForm ?? '') ?? false;

  useEffect(() => {
    if (!open) {
      return;
    }
    if (session) {
      form.setFieldsValue({
        sessionName: session.sessionName,
        courseId: session.courseId,
        lecturerId: session.lecturerId,
        trainingDate: dayjs(session.trainingDate),
        timeRange: [
          dayjs(session.startTime, TIME_FORMAT),
          dayjs(session.endTime, TIME_FORMAT),
        ],
        durationHours: session.durationHours === null ? null : Number(session.durationHours),
        trainingForm: session.trainingForm,
        venue: session.venue,
        onlineLink: session.onlineLink,
        studentScope: session.studentScope,
        planAttendeeCount: session.planAttendeeCount,
        remark: session.remark,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({
        courseId: defaultCourseId ?? undefined,
        trainingDate: defaultDate ? dayjs(defaultDate) : dayjs(),
      } as Partial<FormValues> as FormValues);
    }
  }, [open, session, defaultCourseId, defaultDate, form]);

  const save = useMutation({
    mutationFn: (values: FormValues) => {
      const payload: TrainingSessionForm = {
        sessionName: values.sessionName ?? null,
        courseId: values.courseId,
        lecturerId: values.lecturerId,
        trainingDate: values.trainingDate.format('YYYY-MM-DD'),
        startTime: values.timeRange[0].format(TIME_FORMAT),
        endTime: values.timeRange[1].format(TIME_FORMAT),
        durationHours:
          values.durationHours === null || values.durationHours === undefined
            ? null
            : String(values.durationHours),
        trainingForm: values.trainingForm,
        venue: values.venue ?? null,
        onlineLink: values.onlineLink ?? null,
        studentScope: values.studentScope,
        planAttendeeCount: values.planAttendeeCount ?? null,
        remark: values.remark ?? null,
      };
      return session
        ? trainingApi.updateSession(session.id, payload)
        : trainingApi.createSession(planId, payload);
    },
    onSuccess: (result) => {
      message.success(session ? '场次已保存' : '场次已创建');
      onSaved(result);
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '保存失败，请重试'),
  });

  return (
    <Modal
      open={open}
      title={session ? `编辑场次 ${session.sessionNo}` : '新建培训场次'}
      okText="保存"
      cancelText="取消"
      width={720}
      confirmLoading={save.isPending}
      onCancel={onClose}
      // 校验不通过时 validateFields 会 reject，错误已由表单在字段下显示，这里咽掉即可——
      // 不咽会变成一条未处理的 Promise 拒绝
      onOk={() => void form.validateFields().then((values) => save.mutateAsync(values)).catch(() => undefined)}
    >
      <Space direction="vertical" size={space.sm} style={{ width: '100%' }}>
        <Alert
          type="info"
          showIcon
          message="下拉里只列出能排的课程与讲师"
          description="讲师限培养状态为可上岗，课程限处在可排课的状态。时段冲突与课程已过期只提示不阻断，保存后会显示在这里。"
        />
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item label="场次名称" name="sessionName" extra="留空时列表上显示场次ID">
            <Input maxLength={100} showCount />
          </Form.Item>
          <Form.Item label="关联课程" name="courseId" rules={[{ required: true, message: '请选择关联课程' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              loading={options.isLoading}
              notFoundContent={options.isLoading ? '加载中' : '没有处在可排课状态的课程'}
              options={(options.data?.courses ?? []).map((item) => ({
                value: item.id,
                label: `${item.courseName}（${item.courseNo}·${item.mainState}）`,
              }))}
            />
          </Form.Item>
          <Form.Item label="授课讲师" name="lecturerId" rules={[{ required: true, message: '请选择授课讲师' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              loading={options.isLoading}
              notFoundContent={options.isLoading ? '加载中' : '讲师池里还没有可上岗的讲师'}
              options={(options.data?.lecturers ?? []).map((item) => ({
                value: item.id,
                label: `${item.lecturerName}（${item.lecturerNo}·${item.sourceDept}）`,
              }))}
            />
          </Form.Item>
          <Form.Item label="培训日期" name="trainingDate" rules={[{ required: true, message: '请填写培训日期' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="培训时间" name="timeRange" rules={[{ required: true, message: '请填写起止时间' }]}>
            <TimePicker.RangePicker format={TIME_FORMAT} minuteStep={5} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label="培训时长"
            name="durationHours"
            extra="留空由起止时间算出。中间休息一小时这类情况在这里手工覆盖"
          >
            <InputNumber min={0.5} max={24} step={0.5} style={{ width: '100%' }} addonAfter="小时" />
          </Form.Item>
          <Form.Item label="培训形式" name="trainingForm" rules={[{ required: true, message: '请选择培训形式' }]}>
            <Select options={selectOptions(fieldEnums.data?.[TRAINING_ENUM_KEYS.trainingForm])} />
          </Form.Item>
          <Form.Item
            label="培训地点"
            name="venue"
            rules={[{ required: needsVenue, message: '当前培训形式必须填写培训地点' }]}
          >
            <Input maxLength={200} disabled={!trainingForm} />
          </Form.Item>
          <Form.Item
            label="线上链接"
            name="onlineLink"
            extra="一期为手工填写，平台不集成任何直播或会议系统"
            rules={[
              { required: needsOnlineLink, message: '当前培训形式必须填写线上链接' },
              { pattern: /^$|^https?:\/\/.+/, message: '需以 http:// 或 https:// 开头' },
            ]}
          >
            <Input maxLength={500} placeholder="https://" disabled={!trainingForm} />
          </Form.Item>
          <Form.Item
            label="学员范围"
            name="studentScope"
            rules={[{ required: true, message: '请填写学员范围' }]}
          >
            <Input.TextArea rows={2} maxLength={500} showCount />
          </Form.Item>
          <Form.Item label="计划人数" name="planAttendeeCount">
            <InputNumber min={1} max={9999} style={{ width: '100%' }} addonAfter="人" />
          </Form.Item>
          <Form.Item label="备注" name="remark">
            <Input.TextArea rows={2} maxLength={1000} showCount />
          </Form.Item>
        </Form>
      </Space>
    </Modal>
  );
}

/** 保存后把非阻断提示原样弹出来。保存已经成功，因此是 warning 不是 error。 */
export function useSchedulingWarnings() {
  const { modal } = App.useApp();
  return (warnings: string[]) => {
    if (warnings.length === 0) {
      return;
    }
    modal.warning({
      title: '已保存，但有以下情况需要确认',
      content: (
        <ul style={{ paddingLeft: space.md, margin: 0 }}>
          {warnings.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ul>
      ),
      okText: '知道了',
    });
  };
}
