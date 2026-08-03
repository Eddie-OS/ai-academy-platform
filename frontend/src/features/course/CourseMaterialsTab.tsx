import { useState } from 'react';
import { App, Alert, Button, Card, Modal, Progress, Select, Space, Table, Tag, Typography, Upload } from 'antd';
import type { UploadFile } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Trash2, Upload as UploadIcon } from 'lucide-react';
import { ApiError } from '@/shared/api/client';
import { attachmentApi, uploadAttachment } from '@/shared/api/attachments';
import { courseApi, type CourseMaterial, type CourseMaterialVersion } from '@/shared/api/courses';
import { useIsOperator } from '@/shared/store/authStore';
import { space } from '@/shared/theme/designTokens';
import { formatDateTime } from '@/shared/format';
import { useMaterialTypes } from './courseMeta';

const { Text } = Typography;

/**
 * 详情页「课程材料与版本」页签（需求 9.5）。
 *
 * <p>分两区：上区当前材料可增删，下区版本历史只读。<b>版本没有删除入口</b>——删掉一个版本，
 * 绑定它的评审记录就指向了不存在的材料，「评审看的是哪一版」这条线（规则 R7）当场断掉。
 *
 * <p>单文件上限按材料类型区分，取自 {@code /api/meta/material-types}（规则 F1）。上限在前端抄一份
 * 的后果是：规则调整后界面还允许选，直到保存那一刻才被拒。
 */

interface CourseMaterialsTabProps {
  courseId: number;
}

/** 附件归属类型，与后端 {@code AttachmentOwnerType} 一致；它只决定文件落在哪个子目录。 */
const ATTACHMENT_OWNER_TYPE = 'COURSE';

export function CourseMaterialsTab({ courseId }: CourseMaterialsTabProps) {
  const { message, modal } = App.useApp();
  const queryClient = useQueryClient();
  const isOperator = useIsOperator();
  const materialTypes = useMaterialTypes();
  const [uploadType, setUploadType] = useState<string | null>(null);
  const [percent, setPercent] = useState<number | null>(null);
  const [openedVersion, setOpenedVersion] = useState<CourseMaterialVersion | null>(null);

  const materials = useQuery({
    queryKey: ['courses', courseId, 'materials'],
    queryFn: () => courseApi.materials(courseId),
  });
  const versions = useQuery({
    queryKey: ['courses', courseId, 'versions'],
    queryFn: () => courseApi.versions(courseId),
  });

  const selectedType = materialTypes.data?.find((item) => item.materialType === uploadType);

  const attach = useMutation({
    mutationFn: async (file: File) => {
      if (!selectedType) {
        throw new ApiError('PARAM_INVALID', '请先选择材料类型', null, null);
      }
      if (file.size > selectedType.maxBytes) {
        throw new ApiError(
          'PARAM_INVALID',
          `「${selectedType.materialType}」单个文件不超过 ${selectedType.maxSizeText}`,
          null,
          null,
        );
      }
      setPercent(0);
      const attachment = await uploadAttachment(file, selectedType.scene, ATTACHMENT_OWNER_TYPE, setPercent);
      return courseApi.attachMaterials(courseId, selectedType.materialType, [attachment.id]);
    },
    onSuccess: () => {
      message.success('材料已上传');
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
      message.success('材料已移除');
      void queryClient.invalidateQueries({ queryKey: ['courses', courseId, 'materials'] });
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '移除失败，请重试'),
  });

  const snapshot = useMutation({
    mutationFn: () => courseApi.snapshot(courseId, null),
    onSuccess: (version) => {
      message.success(`已生成版本 ${version.versionNo}`);
      void queryClient.invalidateQueries({ queryKey: ['courses', courseId, 'versions'] });
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '生成版本失败，请重试'),
  });

  return (
    <Space direction="vertical" size={space.lg} style={{ width: '100%' }}>
      <Card
        size="small"
        title="当前材料"
        extra={
          isOperator && (
            <Space size={space.xs}>
              <Select
                allowClear
                placeholder="材料类型"
                style={{ width: 160 }}
                value={uploadType}
                loading={materialTypes.isLoading}
                options={(materialTypes.data ?? []).map((item) => ({
                  value: item.materialType,
                  label: `${item.materialType}（≤${item.maxSizeText}）`,
                }))}
                onChange={(value) => setUploadType(value ?? null)}
              />
              <Upload
                showUploadList={false}
                disabled={!uploadType || attach.isPending}
                beforeUpload={(file) => {
                  void attach.mutateAsync(file as unknown as File);
                  return Upload.LIST_IGNORE;
                }}
                fileList={[] as UploadFile[]}
              >
                <Button icon={<UploadIcon size={14} />} disabled={!uploadType} loading={attach.isPending}>
                  上传材料
                </Button>
              </Upload>
              <Button onClick={() => snapshot.mutate()} loading={snapshot.isPending}>
                生成版本快照
              </Button>
            </Space>
          )
        }
      >
        <Space direction="vertical" size={space.sm} style={{ width: '100%' }}>
          {percent !== null && <Progress percent={percent} size="small" />}
          <Table<CourseMaterial>
            size="small"
            rowKey={(row) => String(row.id)}
            dataSource={materials.data ?? []}
            loading={materials.isLoading}
            pagination={false}
            locale={{ emptyText: '还没有上传材料' }}
            columns={[
              { title: '材料类型', dataIndex: 'materialType', width: 140 },
              { title: '文件名', dataIndex: 'fileName' },
              {
                title: '大小',
                dataIndex: 'fileSize',
                width: 120,
                align: 'right',
                render: (size: number) => formatSize(size),
              },
              { title: '上传时间', dataIndex: 'createdAt', width: 160, render: formatDateTime },
              {
                title: '操作',
                key: 'actions',
                width: 140,
                align: 'right',
                render: (_, row) => (
                  <Space size={space.sm}>
                    <Button
                      type="link"
                      size="small"
                      style={{ padding: 0 }}
                      icon={<Download size={13} />}
                      href={attachmentApi.downloadUrl(row.attachmentId)}
                    >
                      下载
                    </Button>
                    {isOperator && (
                      <Button
                        type="link"
                        size="small"
                        danger
                        style={{ padding: 0 }}
                        icon={<Trash2 size={13} />}
                        onClick={() =>
                          modal.confirm({
                            title: `从当前材料移除「${row.fileName}」`,
                            content: '只解除关联，文件本身不删——已生成的版本快照里仍然能下载到它。',
                            okText: '移除',
                            okButtonProps: { danger: true },
                            cancelText: '取消',
                            onOk: () => detach.mutateAsync(row.id),
                          })
                        }
                      >
                        移除
                      </Button>
                    )}
                  </Space>
                ),
              },
            ]}
          />
        </Space>
      </Card>

      <Card size="small" title="版本历史">
        <Space direction="vertical" size={space.sm} style={{ width: '100%' }}>
          <Alert
            type="info"
            showIcon
            message="版本只增不删"
            description="提交评审时自动生成一版并绑定该轮评审，之后再改材料不会影响已提交的评审看到的内容。删掉版本会让评审记录指向不存在的材料。"
          />
          <Table<CourseMaterialVersion>
            size="small"
            rowKey={(row) => String(row.id)}
            dataSource={versions.data ?? []}
            loading={versions.isLoading}
            pagination={false}
            locale={{ emptyText: '还没有生成过版本' }}
            columns={[
              { title: '版本号', dataIndex: 'versionNo', width: 100 },
              { title: '生成方式', dataIndex: 'triggerType', width: 140 },
              {
                title: '绑定评审轮次',
                dataIndex: 'boundReviewRound',
                width: 130,
                render: (round: number | null) => (round === null ? '—' : `第 ${round} 轮`),
              },
              { title: '变更说明', dataIndex: 'remark', render: (v: string | null) => v ?? '—' },
              { title: '生成时间', dataIndex: 'createdAt', width: 160, render: formatDateTime },
              {
                title: '操作',
                key: 'actions',
                width: 100,
                align: 'right',
                render: (_, row) => (
                  <Button type="link" size="small" style={{ padding: 0 }} onClick={() => setOpenedVersion(row)}>
                    查看内容
                  </Button>
                ),
              },
            ]}
          />
        </Space>
      </Card>

      <VersionDetailModal
        courseId={courseId}
        version={openedVersion}
        onClose={() => setOpenedVersion(null)}
      />
    </Space>
  );
}

function VersionDetailModal({
  courseId,
  version,
  onClose,
}: {
  courseId: number;
  version: CourseMaterialVersion | null;
  onClose: () => void;
}) {
  const detail = useQuery({
    queryKey: ['courses', courseId, 'versions', version?.id],
    queryFn: () => courseApi.versionDetail(courseId, version!.id),
    enabled: version !== null,
  });

  return (
    <Modal open={version !== null} title={`版本 ${version?.versionNo ?? ''} 的内容`} footer={null} width={760} onCancel={onClose}>
      <Space direction="vertical" size={space.md} style={{ width: '100%' }}>
        <Table
          size="small"
          rowKey={(row) => String(row.id)}
          dataSource={detail.data?.files ?? []}
          loading={detail.isLoading}
          pagination={false}
          locale={{ emptyText: '该版本没有材料文件' }}
          columns={[
            { title: '材料类型', dataIndex: 'materialType', width: 140 },
            {
              title: '文件名',
              dataIndex: 'fileNameSnapshot',
              render: (name: string, row) => (
                <Space size={4}>
                  {name}
                  {/* 附件被删了仍显示快照文件名：这一版当时确实包含它，抹掉会让历史失真 */}
                  {row.attachmentDeleted && <Tag color="default">附件已删除</Tag>}
                </Space>
              ),
            },
            {
              title: '操作',
              key: 'actions',
              width: 90,
              align: 'right',
              render: (_, row) =>
                row.attachmentDeleted ? (
                  <Text type="secondary">不可下载</Text>
                ) : (
                  <Button
                    type="link"
                    size="small"
                    style={{ padding: 0 }}
                    href={attachmentApi.downloadUrl(row.attachmentId)}
                  >
                    下载
                  </Button>
                ),
            },
          ]}
        />
        <Card size="small" title="该版本的自检快照">
          {(detail.data?.selfcheck ?? []).length === 0 ? (
            <Text type="secondary">这一版没有自检快照。</Text>
          ) : (
            <Table
              size="small"
              // 快照行是 SQL 直出的 Map，没有主键列；顺序即展示顺序，用下标做行键
              rowKey={(_, index) => String(index)}
              dataSource={detail.data?.selfcheck ?? []}
              pagination={false}
              columns={[
                { title: '检查项', dataIndex: 'item_text_snapshot' },
                {
                  title: '勾选',
                  dataIndex: 'checked',
                  width: 80,
                  render: (checked: boolean) => (checked ? '已勾选' : '未勾选'),
                },
                { title: '说明', dataIndex: 'note', render: (v: string | null) => v ?? '—' },
              ]}
            />
          )}
        </Card>
      </Space>
    </Modal>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** 日期时间不显示秒（设计规范 3.3）。实现已移到 {@code shared/format}，需求驾驶舱用的是同一份。 */
export { formatDateTime };
