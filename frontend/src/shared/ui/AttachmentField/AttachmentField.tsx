import { useState } from 'react';
import { App, Button, Progress, Space, Typography, Upload } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Trash2, Upload as UploadIcon } from 'lucide-react';
import { ApiError } from '@/shared/api/client';
import { attachmentApi, uploadAttachment, type Attachment } from '@/shared/api/attachments';
import { useIsOperator } from '@/shared/store/authStore';
import { space } from '@/shared/theme/designTokens';

const { Text } = Typography;

/**
 * 对象上的一个多附件字段（需求 8.3.2、11.6 等）。
 *
 * <p>走平台通用的附件引用接口：上传 → 落库 → 建引用。<b>建引用这一步不能省</b>——
 * 没有引用的附件 24 小时后会被当孤儿清理掉（开发 5.7.2 第 10 步），界面上却还挂着文件名。
 *
 * <p><b>不在前端校验大小上限。</b>上限按场景码由后端定（规则 F1），前端抄一份的后果是规则调整后
 * 界面还允许选，直到保存那一刻才被拒；而后端本来就会拒，并把上限写在提示里。
 */

/** 场景码，决定大小上限（规则 F1）。业务侧的普通附件都是这一档。 */
export const ATTACHMENT_SCENE_GENERAL = 'GENERAL';

interface AttachmentFieldProps {
  /** 归属类型，与后端 {@code AttachmentOwnerType} 的枚举名一致 */
  ownerType: string;
  ownerId: number;
  /** 同一对象的多个附件字段靠它区分，与 {@code sys_attachment_ref.ref_field} 一致 */
  refField: string;
  /** 空态文案，说明这个字段该放什么 */
  emptyHint: string;
  scene?: string;
  /** 浏览器文件选择过滤；后端仍按场景码校验大小 */
  accept?: string;
}

export function AttachmentField({
  ownerType,
  ownerId,
  refField,
  emptyHint,
  scene = ATTACHMENT_SCENE_GENERAL,
  accept,
}: AttachmentFieldProps) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const isOperator = useIsOperator();
  const [percent, setPercent] = useState<number | null>(null);

  const queryKey = ['attachments', ownerType, ownerId, refField];

  const files = useQuery({
    queryKey,
    queryFn: () => attachmentApi.listOf(ownerType, ownerId, refField),
  });

  const refresh = () => void queryClient.invalidateQueries({ queryKey });

  const attach = useMutation({
    mutationFn: async (file: File) => {
      const uploaded = await uploadAttachment(file, scene, ownerType, setPercent);
      await attachmentApi.link(uploaded.id, {
        refType: ownerType,
        refId: ownerId,
        refField,
        seqNo: files.data?.length ?? 0,
      });
      return uploaded;
    },
    onSuccess: () => {
      message.success('附件已上传');
      setPercent(null);
      refresh();
    },
    onError: (e) => {
      setPercent(null);
      message.error(e instanceof ApiError ? e.message : '上传失败，请重试');
    },
  });

  const detach = useMutation({
    mutationFn: (file: Attachment) =>
      attachmentApi.unlink(file.id, { refType: ownerType, refId: ownerId, refField, seqNo: 0 }),
    onSuccess: () => {
      message.success('附件已移除');
      refresh();
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '移除失败，请重试'),
  });

  const rows = files.data ?? [];

  return (
    <Space direction="vertical" size={space.xs} style={{ width: '100%' }}>
      {rows.length === 0 && <Text type="secondary">{emptyHint}</Text>}
      {rows.map((file) => (
        <Space key={file.id} size={space.sm}>
          <Text>{file.fileName}</Text>
          <Button
            type="link"
            size="small"
            icon={<Download size={14} />}
            href={attachmentApi.downloadUrl(file.id)}
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
              onClick={() => detach.mutate(file)}
            >
              移除
            </Button>
          )}
        </Space>
      ))}
      {percent !== null && <Progress percent={percent} size="small" />}
      {isOperator && (
        <Upload
          multiple={false}
          accept={accept}
          showUploadList={false}
          beforeUpload={(file) => {
            void attach.mutateAsync(file as unknown as File);
            return false;
          }}
        >
          <Button size="small" icon={<UploadIcon size={14} />} loading={attach.isPending}>
            上传附件
          </Button>
        </Upload>
      )}
    </Space>
  );
}
