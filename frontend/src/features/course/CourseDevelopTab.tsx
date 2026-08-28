import { useEffect, useState } from 'react';
import { App, Button, Col, DatePicker, Form, Input, Radio, Row, Select, Space, Typography, Upload } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import { Download, Trash2, Upload as UploadIcon } from 'lucide-react';
import { ApiError } from '@/shared/api/client';
import { attachmentApi, uploadAttachment } from '@/shared/api/attachments';
import { COURSE_OBJECT_TYPE, courseApi, type Course } from '@/shared/api/courses';
import { actionTo, transitionApi } from '@/shared/api/transitions';
import { useIsOperator } from '@/shared/store/authStore';
import { space } from '@/shared/theme/designTokens';
import {
  COURSE_OBJECT_TYPE_CODE,
  COURSE_STATE_FIELDS,
  FIELD_ENUM_KEYS,
  useEmployees,
  useFieldEnums,
  useMaterialTypes,
  useStates,
} from './courseMeta';
import { invalidateCourseListAndMetrics } from './courseFilters';
import { CoursePhaseActions } from './CoursePhaseActions';
import { CourseTabEditBar, useCourseTabEditing } from './CourseTabEditBar';

const COURSE_OWNER_TYPE = 'COURSE';
const PPT_ACCEPT = '.ppt,.pptx';

interface CourseDevelopTabProps {
  course: Course;
  /** 选「是」并成功进入自检后，切到自检页签 */
  onEnteredSelfCheck?: () => void;
}

interface FormValues {
  ownerNo?: string;
  planDraftDate?: Dayjs | null;
  actualDraftDate?: Dayjs | null;
  enterSelfCheck?: string;
}

/**
 * 课程详情「开发」页。字段按规格 8 项。
 *
 * <p>开发状态仍走状态机（待开发／开发中／自检中），图里的「已开发」对应进入自检。
 * 「是否进入自检」保存为台账；选「是」后再走「进入自检」动作，不在保存接口里改状态。
 */
export function CourseDevelopTab({ course, onEnteredSelfCheck }: CourseDevelopTabProps) {
  const { message, modal } = App.useApp();
  const queryClient = useQueryClient();
  const isOperator = useIsOperator();
  const employees = useEmployees();
  const fieldEnums = useFieldEnums();
  const devStates = useStates(COURSE_OBJECT_TYPE_CODE, COURSE_STATE_FIELDS.dev);
  const yesNo = fieldEnums.data?.[FIELD_ENUM_KEYS.enterSelfCheck] ?? [];
  const [form] = Form.useForm<FormValues>();
  const { editing, setEditing } = useCourseTabEditing(course.id);

  const fill = () => {
    form.setFieldsValue({
      ownerNo: course.ownerNo || undefined,
      planDraftDate: course.planDraftDate ? dayjs(course.planDraftDate) : null,
      actualDraftDate: course.actualDraftDate ? dayjs(course.actualDraftDate) : null,
      enterSelfCheck: course.enterSelfCheck ?? undefined,
    });
  };

  useEffect(fill, [course, form]);

  const availability = useQuery({
    queryKey: ['courses', course.id, 'available'],
    queryFn: () => transitionApi.available(COURSE_OBJECT_TYPE, course.id),
  });
  const devField = availability.data?.fields.find((item) => item.stateField === COURSE_STATE_FIELDS.dev);
  const mainField = availability.data?.fields.find((item) => item.stateField === COURSE_STATE_FIELDS.main);

  const save = useMutation({
    mutationFn: (values: FormValues) =>
      courseApi.saveDevelopment(course.id, {
        ownerNo: values.ownerNo || null,
        planDraftDate: values.planDraftDate ? values.planDraftDate.format('YYYY-MM-DD') : null,
        actualDraftDate: values.actualDraftDate ? values.actualDraftDate.format('YYYY-MM-DD') : null,
        enterSelfCheck: values.enterSelfCheck || null,
        version: course.version,
      }),
    onError: (e) => message.error(e instanceof ApiError ? e.message : '保存失败，请重试'),
  });

  const transit = useMutation({
    mutationFn: (payload: { stateField: string; action: string; version: number }) =>
      transitionApi.transit(COURSE_OBJECT_TYPE, course.id, {
        stateField: payload.stateField,
        action: payload.action,
        version: payload.version,
        remark: null,
      }),
    onError: (e) => message.error(e instanceof ApiError ? e.message : '状态变更失败，请重试'),
  });

  const refreshCourse = () => invalidateCourseListAndMetrics(queryClient);

  const changeDevState = (toState: string) => {
    if (toState === (course.devState ?? '')) {
      return;
    }
    const viaDev = actionTo(devField, toState);
    const viaMain = actionTo(mainField, toState);
    const hit = viaDev
      ? { option: viaDev, stateField: COURSE_STATE_FIELDS.dev }
      : viaMain
        ? { option: viaMain, stateField: COURSE_STATE_FIELDS.main }
        : null;
    if (!hit) {
      message.error(`当前状态不能改为「${toState}」`);
      return;
    }
    modal.confirm({
      title: hit.option.label,
      content: `变更后状态为「${hit.option.toState}」。状态变更会写入流转日志。`,
      okText: '确认变更',
      cancelText: '取消',
      onOk: async () => {
        const result = await transit.mutateAsync({
          stateField: hit.stateField,
          action: hit.option.action,
          version: course.version,
        });
        message.success(`${result.stateField}已变更为「${result.toState}」`);
        refreshCourse();
      },
    });
  };

  const onFinish = async (values: FormValues) => {
    await save.mutateAsync(values);
    const yes = yesNo[0];
    const enter = (mainField?.actions ?? []).find((option) => option.action === 'ENTER_SELF_CHECK');
    const canEnter =
      Boolean(yes) &&
      values.enterSelfCheck === yes &&
      enter !== undefined &&
      (mainField?.allowedActions ?? []).includes(enter.label);
    if (canEnter && enter) {
      const result = await transit.mutateAsync({
        stateField: COURSE_STATE_FIELDS.main,
        action: enter.action,
        version: course.version + 1,
      });
      message.success(`${result.stateField}已变更为「${result.toState}」`);
      setEditing(false);
      refreshCourse();
      onEnteredSelfCheck?.();
      return;
    }
    message.success('开发信息已保存');
    setEditing(false);
    refreshCourse();
  };

  return (
    <Space direction="vertical" size={space.md} style={{ width: '100%' }}>
      <CoursePhaseActions
        course={course}
        stateField={COURSE_STATE_FIELDS.dev}
        extraMainActions={['START_DEVELOP', 'ENTER_SELF_CHECK', 'SUBMIT_REVIEW', 'RESUBMIT_REVIEW']}
      />
      {isOperator && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <CourseTabEditBar
            editing={editing}
            saving={save.isPending || transit.isPending}
            onEdit={() => {
              fill();
              setEditing(true);
            }}
            onCancel={() => {
              fill();
              setEditing(false);
            }}
            onSave={() => form.submit()}
          />
        </div>
      )}
      <Form
        form={form}
        layout="vertical"
        disabled={!isOperator || !editing}
        onFinish={(values) => void onFinish(values)}
      >
        <Row gutter={[16, 0]}>
          <Col span={12}>
            <Form.Item label="课程ID" extra="关联课程基本信息">
              <Input value={course.courseNo} disabled />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="关联立项单号" extra="关联本课立项页，保存课程后自动生成">
              <Input value={course.initiationNo ?? '保存课程后自动生成'} disabled />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="课程负责人"
              name="ownerNo"
              extra="课程开发负责人"
              rules={[{ required: true, message: '请选择课程负责人' }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="请选择课程负责人"
                options={(employees.data?.records ?? []).map((item) => ({
                  value: item.employeeNo,
                  label: `${item.employeeName}（${item.employeeNo}）`,
                }))}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="开发状态"
              extra="看板核心流转字段，选项由状态机下发"
            >
              <Select
                value={course.devState ?? undefined}
                placeholder="尚未进入开发"
                options={devStates.map((state) => ({ value: state, label: state }))}
                onChange={(value) => changeDevState(value)}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="计划课件初稿完成时间"
              name="planDraftDate"
              extra="开发节点管控基准，用于进度预警、延期判断"
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="实际课件初稿完成时间"
              name="actualDraftDate"
              extra="真实交付时间，用于统计开发周期、计划达成率"
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item
              label="课件 PPT"
              extra="存储课程核心课件，与「材料与版本」页的课件同一批文件"
            >
              <CoursewarePptField courseId={course.id} />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item
              label="是否进入课程自检环节"
              name="enterSelfCheck"
              extra="选「是」并保存后，走状态机进入自检"
            >
              <Radio.Group>
                {yesNo.map((value) => (
                  <Radio key={value} value={value}>
                    {value}
                  </Radio>
                ))}
              </Radio.Group>
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Space>
  );
}

function CoursewarePptField({ courseId }: { courseId: number }) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const isOperator = useIsOperator();
  const materialTypes = useMaterialTypes();
  const courseware = (materialTypes.data ?? []).find((item) => item.scene === 'COURSEWARE');
  const [percent, setPercent] = useState<number | null>(null);

  const materials = useQuery({
    queryKey: ['courses', courseId, 'materials'],
    queryFn: () => courseApi.materials(courseId),
  });
  const rows = (materials.data ?? []).filter(
    (item) => courseware !== undefined && item.materialType === courseware.materialType,
  );

  const attach = useMutation({
    mutationFn: async (file: File) => {
      if (!courseware) {
        throw new ApiError('PARAM_INVALID', '课件类型尚未下发，请稍后重试', null, null);
      }
      if (file.size > courseware.maxBytes) {
        throw new ApiError(
          'PARAM_INVALID',
          `课件单个文件不超过 ${courseware.maxSizeText}`,
          null,
          null,
        );
      }
      setPercent(0);
      const uploaded = await uploadAttachment(file, courseware.scene, COURSE_OWNER_TYPE, setPercent);
      return courseApi.attachMaterials(courseId, courseware.materialType, [uploaded.id]);
    },
    onSuccess: () => {
      message.success('课件已上传');
      setPercent(null);
      void queryClient.invalidateQueries({ queryKey: ['courses', courseId, 'materials'] });
    },
    onError: (e) => {
      setPercent(null);
      message.error(e instanceof ApiError ? e.message : '上传失败，请重试');
    },
  });

  const detach = useMutation({
    mutationFn: (materialId: number) => courseApi.detachMaterial(courseId, materialId),
    onSuccess: () => {
      message.success('课件已移除');
      void queryClient.invalidateQueries({ queryKey: ['courses', courseId, 'materials'] });
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '移除失败，请重试'),
  });

  return (
    <Space direction="vertical" size={space.xs} style={{ width: '100%' }}>
      {rows.length === 0 && (
        <Typography.Text type="secondary">可上传 PPT。上限以材料类型下发值为准</Typography.Text>
      )}
      {rows.map((file) => (
        <Space key={file.id} size={space.sm}>
          <Typography.Text>{file.fileName}</Typography.Text>
          <Button
            type="link"
            size="small"
            icon={<Download size={14} />}
            href={attachmentApi.downloadUrl(file.attachmentId)}
          >
            下载
          </Button>
          {isOperator && (
            <Button
              type="link"
              size="small"
              danger
              icon={<Trash2 size={14} />}
              loading={detach.isPending}
              onClick={() => detach.mutate(file.id)}
            >
              移除
            </Button>
          )}
        </Space>
      ))}
      {percent !== null && <Typography.Text type="secondary">上传中 {percent}%</Typography.Text>}
      {isOperator && (
        <Upload
          multiple={false}
          accept={PPT_ACCEPT}
          showUploadList={false}
          beforeUpload={(file) => {
            void attach.mutateAsync(file as unknown as File);
            return false;
          }}
        >
          <Button size="small" icon={<UploadIcon size={14} />} loading={attach.isPending} disabled={!courseware}>
            上传课件 PPT
          </Button>
        </Upload>
      )}
    </Space>
  );
}
