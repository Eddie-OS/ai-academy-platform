import { useEffect } from 'react';
import { Alert, App, Button, Card, Checkbox, Form, Input, Space, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/shared/api/client';
import { trainingApi, type TrainingArchiveForm } from '@/shared/api/trainings';
import { AttachmentField } from '@/shared/ui/AttachmentField';
import { useIsOperator } from '@/shared/store/authStore';
import { formatDateTime } from '@/shared/format';
import { space } from '@/shared/theme/designTokens';

const { Text } = Typography;

/**
 * 场次详情的「培训归档」页签（需求 11.6，页面 P4-4）。
 *
 * <p>一个场次一条归档记录，没归档过时后端返回一条空记录而不是 404——归档是个渐进的过程，
 * 照片先传、纪要后补是常态。
 *
 * <p><b>「归档完成」只是个标记，不挡状态转换</b>（规则 C2：状态变更不做业务前置校验）。
 * 需求 11.6 把它写成了转「已归档」的前置条件，但那会拦住补录历史场次的运营——
 * 三年前的培训没有照片，状态却必须是已归档。差异已记入《文档待修清单》D-16。
 */

/** 附件归属类型，与后端 {@code AttachmentOwnerType.TRAINING_SESSION} 一致。 */
const OWNER_TYPE = 'TRAINING_SESSION';

/** 引用字段名，与后端 {@code ArchiveAttachmentFields} 的三个常量一致。 */
const ARCHIVE_REF_FIELDS = {
  photos: 'archive_photos',
  ppt: 'archive_ppt',
  minutes: 'archive_minutes',
} as const;

interface SessionArchiveTabProps {
  sessionId: number;
}

export function SessionArchiveTab({ sessionId }: SessionArchiveTabProps) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const isOperator = useIsOperator();
  const [form] = Form.useForm<TrainingArchiveForm>();

  const archive = useQuery({
    queryKey: ['training-sessions', sessionId, 'archive'],
    queryFn: () => trainingApi.archive(sessionId),
  });

  useEffect(() => {
    if (archive.data) {
      form.setFieldsValue({
        liveLink: archive.data.liveLink,
        videoLink: archive.data.videoLink,
        minutesText: archive.data.minutesText,
        archiveCompleted: archive.data.archiveCompleted,
      });
    }
  }, [archive.data, form]);

  const save = useMutation({
    mutationFn: (values: TrainingArchiveForm) =>
      trainingApi.saveArchive(sessionId, {
        liveLink: values.liveLink ?? null,
        videoLink: values.videoLink ?? null,
        minutesText: values.minutesText ?? null,
        archiveCompleted: values.archiveCompleted ?? false,
      }),
    onSuccess: () => {
      message.success('归档信息已保存');
      void queryClient.invalidateQueries({ queryKey: ['training-sessions', sessionId, 'archive'] });
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '保存失败，请重试'),
  });

  const data = archive.data;

  return (
    <Space direction="vertical" size={space.md} style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        message="归档完成是个标记，不是状态"
        description="勾上它不会改变场次状态，也不是归档动作的前置条件。它的用处是让运营一眼看出哪些场次的材料还没收齐。"
      />

      <Card size="small" title="归档材料">
        <Space direction="vertical" size={space.md} style={{ width: '100%' }}>
          <div>
            <Text strong>培训照片</Text>
            <AttachmentField
              ownerType={OWNER_TYPE}
              ownerId={sessionId}
              refField={ARCHIVE_REF_FIELDS.photos}
              emptyHint="还没有上传培训照片"
            />
          </div>
          <div>
            <Text strong>培训课件</Text>
            <AttachmentField
              ownerType={OWNER_TYPE}
              ownerId={sessionId}
              refField={ARCHIVE_REF_FIELDS.ppt}
              emptyHint="还没有上传培训课件"
            />
          </div>
          <div>
            <Text strong>纪要附件</Text>
            <AttachmentField
              ownerType={OWNER_TYPE}
              ownerId={sessionId}
              refField={ARCHIVE_REF_FIELDS.minutes}
              emptyHint="还没有上传纪要附件。也可以直接写在下面的培训纪要里"
            />
          </div>
        </Space>
      </Card>

      <Card size="small" title="归档信息">
        <Form form={form} layout="vertical" requiredMark={false} disabled={!isOperator}>
          <Form.Item
            label="直播链接"
            name="liveLink"
            extra="平台不集成直播系统，链接由运营手工填写"
            rules={[{ pattern: /^$|^https?:\/\/.+/, message: '需以 http:// 或 https:// 开头' }]}
          >
            <Input maxLength={500} placeholder="https://" />
          </Form.Item>
          <Form.Item
            label="回放视频链接"
            name="videoLink"
            rules={[{ pattern: /^$|^https?:\/\/.+/, message: '需以 http:// 或 https:// 开头' }]}
          >
            <Input maxLength={500} placeholder="https://" />
          </Form.Item>
          <Form.Item label="培训纪要" name="minutesText">
            <Input.TextArea rows={6} maxLength={5000} showCount />
          </Form.Item>
          <Form.Item name="archiveCompleted" valuePropName="checked">
            <Checkbox>归档完成</Checkbox>
          </Form.Item>
          {isOperator && (
            <Space size={space.md}>
              <Button
                type="primary"
                loading={save.isPending}
                onClick={() =>
                  void form
                    .validateFields()
                    .then((values) => save.mutateAsync(values))
                    .catch(() => undefined)
                }
              >
                保存归档信息
              </Button>
              <Text type="secondary">
                {data?.completedAt
                  ? `归档完成于 ${formatDateTime(data.completedAt)}`
                  : '尚未标记归档完成'}
              </Text>
            </Space>
          )}
        </Form>
      </Card>
    </Space>
  );
}
