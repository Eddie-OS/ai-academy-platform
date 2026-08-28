import { useEffect, useState } from 'react';
import { App, Alert, Button, Col, DatePicker, Form, Input, Modal, Row, Select, Space, Table, Tag, Typography, Upload } from 'antd';
import type { UploadFile } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import { Download, Trash2, Upload as UploadIcon } from 'lucide-react';
import { ApiError } from '@/shared/api/client';
import { attachmentApi, uploadAttachment } from '@/shared/api/attachments';
import {
  courseApi,
  type Course,
  type CourseMaterialVersion,
  type CourseMaterialVersionFile,
} from '@/shared/api/courses';
import type { MaterialTypeMeta } from '@/shared/api/meta';
import { useIsOperator } from '@/shared/store/authStore';
import { EM_DASH, formatDateTime } from '@/shared/format';
import { space } from '@/shared/theme/designTokens';
import { FIELD_ENUM_KEYS, useEmployees, useFieldEnums, useMaterialTypes } from './courseMeta';
import { CourseTabEditBar, useCourseTabEditing } from './CourseTabEditBar';
import './CourseMaterialsTab.css';

const ATTACHMENT_OWNER_TYPE = 'COURSE';
const PPT_ACCEPT = '.ppt,.pptx,.pdf';

interface CourseMaterialsTabProps {
  course: Course;
}

interface LedgerValues {
  versionLabel?: string;
  versionStatus?: string;
  ownerNo?: string;
  updatedDate?: Dayjs | null;
  coursewareUrl?: string;
  recordingUrl?: string;
  remark?: string;
}

/**
 * 详情页「材料与版本」（需求 9.5）。
 *
 * <p>三栏：版本列表（突出当前版本）→ 所选版本的材料清单 → 版本说明／变更记录。
 * 版本没有删除入口——删掉会让绑定它的评审记录断档（规则 R7）。
 *
 * <p>课件走官方三类材料里的「课件」；试讲／授课录屏只填外链，平台不上传视频（N22／D10）。
 */
export function CourseMaterialsTab({ course }: CourseMaterialsTabProps) {
  const { message, modal } = App.useApp();
  const queryClient = useQueryClient();
  const isOperator = useIsOperator();
  const materialTypes = useMaterialTypes();
  const employees = useEmployees();
  const fieldEnums = useFieldEnums();
  const versionStatuses = fieldEnums.data?.[FIELD_ENUM_KEYS.versionStatus] ?? [];
  const [form] = Form.useForm<LedgerValues>();
  const { editing, setEditing } = useCourseTabEditing(course.id);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [uploadType, setUploadType] = useState<string | null>(null);
  const [percent, setPercent] = useState<number | null>(null);
  const [selfcheckVersion, setSelfcheckVersion] = useState<CourseMaterialVersion | null>(null);

  const materials = useQuery({
    queryKey: ['courses', course.id, 'materials'],
    queryFn: () => courseApi.materials(course.id),
  });
  const versions = useQuery({
    queryKey: ['courses', course.id, 'versions'],
    queryFn: () => courseApi.versions(course.id),
  });

  const selected = (versions.data ?? []).find((item) => item.id === selectedId) ?? versions.data?.[0] ?? null;
  const isCurrent = selected !== null && selected.versionNo === course.currentMaterialVersion;
  const showWorkspace = selected === null || isCurrent;
  const selectedType = (materialTypes.data ?? []).find((item) => item.materialType === uploadType);

  const detail = useQuery({
    queryKey: ['courses', course.id, 'versions', selected?.id, 'files'],
    queryFn: () => courseApi.versionDetail(course.id, selected!.id),
    enabled: selected !== null && !showWorkspace,
  });

  const fill = () => {
    if (!selected) {
      form.resetFields();
      return;
    }
    form.setFieldsValue({
      versionLabel: selected.versionLabel ?? undefined,
      versionStatus: selected.versionStatus ?? undefined,
      ownerNo: selected.ownerNo ?? undefined,
      updatedDate: selected.updatedDate ? dayjs(selected.updatedDate) : null,
      coursewareUrl: selected.coursewareUrl ?? undefined,
      recordingUrl: selected.recordingUrl ?? undefined,
      remark: selected.remark ?? undefined,
    });
  };

  useEffect(fill, [selected, form]);

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
      return courseApi.attachMaterials(course.id, selectedType.materialType, [attachment.id]);
    },
    onSuccess: () => {
      message.success('材料已上传');
      setPercent(null);
      void queryClient.invalidateQueries({ queryKey: ['courses', course.id, 'materials'] });
    },
    onError: (e) => {
      setPercent(null);
      message.error(e instanceof ApiError ? e.message : '上传失败，请重试');
    },
  });

  const detach = useMutation({
    mutationFn: (materialId: number) => courseApi.detachMaterial(course.id, materialId),
    onSuccess: () => {
      message.success('材料已移除');
      void queryClient.invalidateQueries({ queryKey: ['courses', course.id, 'materials'] });
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '移除失败，请重试'),
  });

  const snapshot = useMutation({
    mutationFn: () => courseApi.snapshot(course.id, null),
    onSuccess: (version) => {
      message.success(`已生成版本 ${version.versionNo}`);
      setSelectedId(version.id);
      void queryClient.invalidateQueries({ queryKey: ['courses', course.id] });
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '生成版本失败，请重试'),
  });

  const save = useMutation({
    mutationFn: (values: LedgerValues) => {
      if (!selected) {
        throw new ApiError('PARAM_INVALID', '还没有版本可保存', null, null);
      }
      return courseApi.saveVersionLedger(course.id, selected.id, {
        versionLabel: values.versionLabel || null,
        versionStatus: values.versionStatus || null,
        ownerNo: values.ownerNo || null,
        updatedDate: values.updatedDate ? values.updatedDate.format('YYYY-MM-DD') : null,
        coursewareUrl: values.coursewareUrl || null,
        recordingUrl: values.recordingUrl || null,
        remark: values.remark || null,
      });
    },
    onSuccess: () => {
      message.success('版本信息已保存');
      setEditing(false);
      void queryClient.invalidateQueries({ queryKey: ['courses', course.id, 'versions'] });
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '保存失败，请重试'),
  });

  const employeeName = (ownerNo: string | null | undefined) => {
    const hit = (employees.data?.records ?? []).find((item) => item.employeeNo === ownerNo);
    return hit ? hit.employeeName : ownerNo;
  };

  const workspaceFiles = materials.data ?? [];
  const snapshotFiles = detail.data?.files ?? [];
  const listFiles: Array<{
    key: string;
    name: string;
    type: string;
    href?: string;
    deleted?: boolean;
    materialId?: number;
  }> = showWorkspace
    ? workspaceFiles.map((row) => ({
        key: `m-${row.id}`,
        name: row.fileName,
        type: row.materialType,
        href: attachmentApi.downloadUrl(row.attachmentId),
        materialId: row.id,
      }))
    : snapshotFiles.map((row) => ({
        key: `f-${row.id}`,
        name: row.fileNameSnapshot,
        type: row.materialType,
        href: row.attachmentDeleted ? undefined : attachmentApi.downloadUrl(row.attachmentId),
        deleted: row.attachmentDeleted,
      }));

  return (
    <Space direction="vertical" size={space.md} style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        message="版本只增不删，提交评审时自动快照"
        description="系统会在提交评审时给当前材料建档并绑定该轮评审。之后再改材料不影响已评过的版本。删掉版本会让评审记录指向不存在的材料。"
      />

      {isOperator && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <CourseTabEditBar
            editing={editing}
            saving={save.isPending}
            saveDisabled={!selected}
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
        onFinish={(values) => void save.mutateAsync(values)}
      >
        <Row gutter={[16, 0]}>
          <Col span={12}>
            <Form.Item label="关联课程ID" extra="绑定对应课程，只读追溯">
              <Input value={course.courseNo} disabled />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="课程名称">
              <Input value={course.courseName} disabled />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="课程版本号"
              name="versionLabel"
              extra={selected ? `官方编号 ${selected.versionNo}，由系统自动递增` : '提交评审后会自动生成版本'}
            >
              <Input placeholder="如 V1.0 初稿、V1.1 整改" disabled={!selected || !isOperator} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="版本状态" name="versionStatus" extra="台账标记，不写流转日志">
              <Select
                allowClear
                placeholder="请选择版本状态"
                disabled={!selected || !isOperator}
                options={versionStatuses.map((value) => ({ value, label: value }))}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="版本更新负责人" name="ownerNo">
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="请选择负责人"
                disabled={!selected || !isOperator}
                options={(employees.data?.records ?? []).map((item) => ({
                  value: item.employeeNo,
                  label: `${item.employeeName}（${item.employeeNo}）`,
                }))}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="版本更新时间" name="updatedDate">
              <DatePicker style={{ width: '100%' }} disabled={!selected || !isOperator} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="课件 PPT"
              name="coursewareUrl"
              extra="可填外链；文件请上传到下方材料清单，与开发页课件同一批"
              rules={[{ pattern: /^$|^https?:\/\/.+/, message: '链接需以 http:// 或 https:// 开头' }]}
            >
              <Input placeholder="https://" disabled={!selected || !isOperator} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="试讲／授课录屏"
              name="recordingUrl"
              extra="只填外链，平台不上传视频文件"
              rules={[{ pattern: /^$|^https?:\/\/.+/, message: '链接需以 http:// 或 https:// 开头' }]}
            >
              <Input placeholder="https://" disabled={!selected || !isOperator} />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item label="版本说明" name="remark">
              <Input.TextArea rows={3} maxLength={500} showCount disabled={!selected || !isOperator} />
            </Form.Item>
          </Col>
        </Row>
      </Form>

      <div className="crs-mat-board" data-testid="version-block">
        <div className="crs-mat-col">
          <h3 className="crs-mat-heading">版本列表</h3>
          {(versions.data ?? []).length === 0 ? (
            <p className="crs-mat-empty">还没有生成过版本</p>
          ) : (
            <ul className="crs-mat-list">
              {(versions.data ?? []).map((item) => {
                const current = item.versionNo === course.currentMaterialVersion;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="crs-mat-version"
                      data-testid="course-version"
                      data-current={current}
                      data-selected={item.id === selected?.id}
                      onClick={() => setSelectedId(item.id)}
                    >
                      <div className="crs-mat-version-top">
                        <span className="crs-mat-version-no">{item.versionLabel || item.versionNo}</span>
                        {current && <span className="crs-mat-tag">当前版本</span>}
                      </div>
                      <span className="crs-mat-version-meta">
                        {item.updatedDate ?? formatDateTime(item.createdAt)}
                      </span>
                      <span className="crs-mat-version-meta">
                        {employeeName(item.ownerNo) || item.createdBy || EM_DASH}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {isOperator && (
            <Button
              size="small"
              style={{ marginTop: space.sm }}
              onClick={() => snapshot.mutate()}
              loading={snapshot.isPending}
            >
              手动生成快照
            </Button>
          )}
        </div>

        <div className="crs-mat-col">
          <h3 className="crs-mat-heading">
            材料清单{selected ? `（${selected.versionLabel || selected.versionNo}）` : ''}
          </h3>
          {listFiles.length === 0 ? (
            <p className="crs-mat-empty">{showWorkspace ? '还没有上传材料' : '该版本没有材料文件'}</p>
          ) : (
            <ul className="crs-mat-list">
              {listFiles.map((file, index) => (
                <li className="crs-mat-file" key={file.key} data-tone={index % 3}>
                  <span className="crs-mat-file-icon" aria-hidden />
                  <span className="crs-mat-file-body">
                    <span className="crs-mat-file-name">{file.name}</span>
                    <span className="crs-mat-file-type">{file.type}</span>
                  </span>
                  {file.deleted ? (
                    <Tag>附件已删除</Tag>
                  ) : (
                    <Button type="link" size="small" href={file.href} icon={<Download size={13} />}>
                      下载
                    </Button>
                  )}
                  {showWorkspace && isOperator && file.materialId !== undefined && (
                    <Button
                      type="link"
                      size="small"
                      danger
                      icon={<Trash2 size={13} />}
                      onClick={() => {
                        const row = workspaceFiles.find((item) => item.id === file.materialId);
                        if (row) {
                          modal.confirm({
                            title: `从当前材料移除「${row.fileName}」`,
                            content: '只解除关联，文件本身不删——已生成的版本快照里仍然能下载到它。',
                            okText: '移除',
                            okButtonProps: { danger: true },
                            cancelText: '取消',
                            onOk: () => detach.mutateAsync(row.id),
                          });
                        }
                      }}
                    >
                      移除
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {selected?.coursewareUrl && (
            <p className="crs-mat-note">
              课件外链：<a href={selected.coursewareUrl}>{selected.coursewareUrl}</a>
            </p>
          )}
          {selected?.recordingUrl && (
            <p className="crs-mat-note">
              录屏外链：<a href={selected.recordingUrl}>{selected.recordingUrl}</a>
            </p>
          )}
          {showWorkspace && (
            <WorkspaceUpload
              materialTypes={materialTypes.data ?? []}
              uploadType={uploadType}
              percent={percent}
              attaching={attach.isPending}
              onTypeChange={setUploadType}
              onUpload={(file) => void attach.mutateAsync(file)}
              isOperator={isOperator}
            />
          )}
          {!showWorkspace && (
            <p className="crs-mat-note">该版本是提交时的快照，文件只读。改材料请回到当前版本。</p>
          )}
        </div>

        <div className="crs-mat-col">
          <h3 className="crs-mat-heading">版本说明</h3>
          <p className="crs-mat-summary">{selected?.remark?.trim() ? selected.remark : '暂无版本说明'}</p>
          <h3 className="crs-mat-heading">变更记录</h3>
          {selected ? (
            <ul className="crs-mat-list">
              <li className="crs-mat-change">
                <span className="crs-mat-change-dot" aria-hidden />
                <span>
                  <span className="crs-mat-change-text">生成版本 {selected.versionNo}（{selected.triggerType}）</span>
                  <br />
                  <span className="crs-mat-change-at">
                    {formatDateTime(selected.createdAt)} · {selected.createdBy}
                  </span>
                </span>
              </li>
              {selected.boundReviewRound !== null && (
                <li className="crs-mat-change">
                  <span className="crs-mat-change-dot" aria-hidden />
                  <span className="crs-mat-change-text">绑定评审第 {selected.boundReviewRound} 轮</span>
                </li>
              )}
            </ul>
          ) : (
            <p className="crs-mat-empty">提交评审时由系统自动快照</p>
          )}
          {selected && (
            <Button type="link" size="small" style={{ padding: 0, marginTop: space.xs }} onClick={() => setSelfcheckVersion(selected)}>
              查看该版本自检快照
            </Button>
          )}
          <p className="crs-mat-note">材料版本在提交评审时由系统自动快照，不支持删除</p>
        </div>
      </div>

      <VersionDetailModal
        courseId={course.id}
        version={selfcheckVersion}
        onClose={() => setSelfcheckVersion(null)}
      />
    </Space>
  );
}

function WorkspaceUpload({
  materialTypes,
  uploadType,
  percent,
  attaching,
  onTypeChange,
  onUpload,
  isOperator,
}: {
  materialTypes: MaterialTypeMeta[];
  uploadType: string | null;
  percent: number | null;
  attaching: boolean;
  onTypeChange: (value: string | null) => void;
  onUpload: (file: File) => void;
  isOperator: boolean;
}) {
  if (!isOperator) {
    return null;
  }
  const courseware = materialTypes.find((item) => item.scene === 'COURSEWARE');
  return (
    <Space direction="vertical" size={space.xs} style={{ width: '100%', marginTop: space.sm }}>
      <Space size={space.xs} wrap>
        <Select
          allowClear
          placeholder="材料类型"
          style={{ width: 180 }}
          value={uploadType}
          options={materialTypes.map((item) => ({
            value: item.materialType,
            label: `${item.materialType}（≤${item.maxSizeText}）`,
          }))}
          onChange={(value) => onTypeChange(value ?? null)}
        />
        <Upload
          showUploadList={false}
          disabled={!uploadType || attaching}
          accept={uploadType === courseware?.materialType ? PPT_ACCEPT : undefined}
          beforeUpload={(file) => {
            onUpload(file as unknown as File);
            return Upload.LIST_IGNORE;
          }}
          fileList={[] as UploadFile[]}
        >
          <Button icon={<UploadIcon size={14} />} disabled={!uploadType} loading={attaching}>
            上传材料
          </Button>
        </Upload>
      </Space>
      {percent !== null && <Typography.Text type="secondary">上传中 {percent}%</Typography.Text>}
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
    <Modal open={version !== null} title={`版本 ${version?.versionNo ?? ''} 的自检快照`} footer={null} width={760} onCancel={onClose}>
      <Space direction="vertical" size={space.md} style={{ width: '100%' }}>
        <Table<CourseMaterialVersionFile>
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
                  {row.attachmentDeleted && <Tag>附件已删除</Tag>}
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
                  <Typography.Text type="secondary">不可下载</Typography.Text>
                ) : (
                  <Button type="link" size="small" href={attachmentApi.downloadUrl(row.attachmentId)}>
                    下载
                  </Button>
                ),
            },
          ]}
        />
        {(detail.data?.selfcheck ?? []).length === 0 ? (
          <Typography.Text type="secondary">这一版没有自检快照。</Typography.Text>
        ) : (
          <Table
            size="small"
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
              { title: '说明', dataIndex: 'note', render: (v: string | null) => v ?? EM_DASH },
            ]}
          />
        )}
      </Space>
    </Modal>
  );
}

/** 日期时间不显示秒（设计规范 3.3）。实现已移到 {@code shared/format}。 */
export { formatDateTime };
