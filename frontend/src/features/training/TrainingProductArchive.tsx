import { useEffect } from 'react';
import { App, Button, Checkbox, Form, Input, Space } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/shared/api/client';
import { trainingApi, type TrainingArchiveForm, type TrainingPlan, type TrainingSession } from '@/shared/api/trainings';
import { AttachmentField } from '@/shared/ui/AttachmentField';
import { useIsOperator } from '@/shared/store/authStore';
import { EM_DASH, formatDateTime } from '@/shared/format';

/**
 * 产品详情「培训归档」：按规格 6 个字段展示。
 *
 * <p>归档编号按场次号派生（一场一条）。归档状态用场次状态机当前值，不另造
 * 「重新归档／归档作废」。资料包走现有三类附件，压缩包 zip／rar 已在附件白名单里。
 */

const OWNER_TYPE = 'TRAINING_SESSION';
const ARCHIVE_REF_FIELDS = {
  photos: 'archive_photos',
  ppt: 'archive_ppt',
  minutes: 'archive_minutes',
} as const;

interface TrainingProductArchiveProps {
  plan: TrainingPlan;
  session: TrainingSession;
}

export function TrainingProductArchive({ plan, session }: TrainingProductArchiveProps) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const isOperator = useIsOperator();
  const [form] = Form.useForm<TrainingArchiveForm>();

  const archive = useQuery({
    queryKey: ['training-sessions', session.id, 'archive'],
    queryFn: () => trainingApi.archive(session.id),
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
      trainingApi.saveArchive(session.id, {
        liveLink: values.liveLink ?? null,
        videoLink: values.videoLink ?? null,
        minutesText: values.minutesText ?? null,
        archiveCompleted: values.archiveCompleted ?? false,
      }),
    onSuccess: () => {
      message.success('归档信息已保存');
      void queryClient.invalidateQueries({ queryKey: ['training-sessions', session.id, 'archive'] });
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '保存失败，请重试'),
  });

  const data = archive.data;
  const archiveNo = `GD-${session.sessionNo}`;

  return (
    <div className="trn-prod-archive">
      <section className="trn-prod-section">
        <h3 className="trn-prod-section-title">归档标识</h3>
        <dl className="trn-prod-kv">
          <div className="trn-prod-field" data-testid="product-archive-field">
            <dt>关联培训计划</dt>
            <dd>{plan.planName}</dd>
          </div>
          <div className="trn-prod-field" data-testid="product-archive-field">
            <dt>归档编号</dt>
            <dd>
              {archiveNo}
              <span className="trn-prod-field-extra">系统按场次号生成，一场一条便于台账检索</span>
            </dd>
          </div>
          <div className="trn-prod-field" data-testid="product-archive-field">
            <dt>归档状态</dt>
            <dd>
              <span className="trn-prod-status">{session.sessionState}</span>
              <span className="trn-prod-field-extra">取场次状态机当前值，不另开归档状态机</span>
            </dd>
          </div>
          <div className="trn-prod-field" data-testid="product-archive-field">
            <dt>归档完成时间</dt>
            <dd>
              {formatDateTime(data?.completedAt)}
              <span className="trn-prod-field-extra">勾选「材料已齐」后由系统写入</span>
            </dd>
          </div>
        </dl>
      </section>

      <section className="trn-prod-section">
        <h3 className="trn-prod-section-title">全套归档资料包</h3>
        <p className="trn-prod-attendees-hint">
          课件、现场照片、海报等可分项上传，也支持 zip／rar 压缩包。视频不上传文件，填外部链接。
        </p>
        <div className="trn-prod-archive-files">
          <div>
            <p className="trn-prod-archive-file-label">培训照片</p>
            <AttachmentField
              ownerType={OWNER_TYPE}
              ownerId={session.id}
              refField={ARCHIVE_REF_FIELDS.photos}
              accept=".jpg,.jpeg,.png,.gif,.zip,.rar"
              emptyHint="还没有上传培训照片"
            />
          </div>
          <div>
            <p className="trn-prod-archive-file-label">培训课件</p>
            <AttachmentField
              ownerType={OWNER_TYPE}
              ownerId={session.id}
              refField={ARCHIVE_REF_FIELDS.ppt}
              accept=".ppt,.pptx,.pdf,.zip,.rar"
              emptyHint="还没有上传培训课件"
            />
          </div>
          <div>
            <p className="trn-prod-archive-file-label">纪要与打包资料</p>
            <AttachmentField
              ownerType={OWNER_TYPE}
              ownerId={session.id}
              refField={ARCHIVE_REF_FIELDS.minutes}
              accept=".doc,.docx,.pdf,.zip,.rar"
              emptyHint="可上传纪要或 zip／rar 资料包"
            />
          </div>
        </div>
      </section>

      <section className="trn-prod-section">
        <h3 className="trn-prod-section-title">归档说明</h3>
        <Form form={form} layout="vertical" requiredMark={false} disabled={!isOperator}>
          <Form.Item
            label="直播／回放链接"
            extra="一期不集成直播与视频系统，只填外部地址"
          >
            <Space.Compact style={{ width: '100%' }}>
              <Form.Item
                name="liveLink"
                noStyle
                rules={[{ pattern: /^$|^https?:\/\/.+/, message: '直播链接需以 http:// 或 https:// 开头' }]}
              >
                <Input maxLength={500} placeholder="直播链接 https://" />
              </Form.Item>
              <Form.Item
                name="videoLink"
                noStyle
                rules={[{ pattern: /^$|^https?:\/\/.+/, message: '回放链接需以 http:// 或 https:// 开头' }]}
              >
                <Input maxLength={500} placeholder="回放链接 https://" />
              </Form.Item>
            </Space.Compact>
          </Form.Item>
          <Form.Item
            label="归档备注"
            name="minutesText"
            extra="缺件说明、特殊情况可写在这里；也用作培训纪要"
          >
            <Input.TextArea rows={4} maxLength={5000} showCount placeholder="选填" />
          </Form.Item>
          <Form.Item name="archiveCompleted" valuePropName="checked">
            <Checkbox>材料已齐</Checkbox>
          </Form.Item>
          {isOperator && (
            <Space size={16}>
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
              <span className="trn-prod-field-extra">
                {data?.completedAt ? `完成于 ${formatDateTime(data.completedAt)}` : EM_DASH}
              </span>
            </Space>
          )}
        </Form>
      </section>
    </div>
  );
}
