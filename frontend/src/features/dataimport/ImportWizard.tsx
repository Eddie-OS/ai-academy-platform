import { useState } from 'react';
import { Alert, App, Button, Card, Descriptions, Segmented, Space, Steps, Table, Typography, Upload } from 'antd';
import type { UploadFile } from 'antd';
import { FileUp } from 'lucide-react';
import { neutral, space } from '@/shared/theme/designTokens';
import { ApiError } from '@/shared/api/client';
import {
  importApi,
  type ImportPreview,
  type ImportTypeOption,
  type RowProblem,
} from '@/shared/api/imports';

const { Text, Title } = Typography;

/**
 * 区域 B · 发起导入向导（需求 13.8.3 四步）。
 *
 * <p><b>全页向导，不用 Modal</b>（13.8.2）：错误行表格最多 100 行，弹窗里放不下，
 * 而运营需要对着表格逐行核对文件。
 *
 * <p>中途退出不保留上传文件，也不做草稿保存（13.8.3 末）。因此这里的状态都是组件内的
 * useState——存进 store 就等于做了半个草稿功能，而后端的批次在未确认前也随时可能被清理任务收走。
 */

/** .xlsx 的上限。规则 I1 是 5000 数据行，行数要解析才知道，大小是能在前端立刻拒掉的那一半。 */
const MAX_FILE_BYTES = 20 * 1024 * 1024;

interface Props {
  types: ImportTypeOption[];
  onCommitted: () => void;
}

export function ImportWizard({ types, onCommitted }: Props) {
  const { message } = App.useApp();
  const [typeCode, setTypeCode] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  const selected = types.find((type) => type.code === typeCode) ?? null;

  const step = preview === null ? (typeCode === null ? 0 : 1) : preview.canConfirm ? 3 : 2;

  const reset = () => {
    setPreview(null);
    setFileList([]);
  };

  const onUpload = async (file: File) => {
    if (!typeCode) {
      return;
    }
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      message.error('只接受 .xlsx 文件，请用下载的模板另存后再上传');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      message.error('文件超过 20 MB，请确认是否误传了非模板文件');
      return;
    }

    setUploading(true);
    try {
      setPreview(await importApi.upload(typeCode, file));
    } catch (e) {
      message.error(e instanceof ApiError ? e.message : '上传失败，请重试');
      reset();
    } finally {
      setUploading(false);
    }
  };

  const onConfirm = async () => {
    if (!preview) {
      return;
    }
    setConfirming(true);
    try {
      const batch = await importApi.confirm(preview.batchNo);
      message.success(`批次 ${batch.batchNo} 已写入：新增 ${batch.insertRows ?? 0} 条、更新 ${batch.updateRows ?? 0} 条`);
      setTypeCode(null);
      reset();
      onCommitted();
    } catch (e) {
      message.error(e instanceof ApiError ? e.message : '写入失败，请重试');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Card title="发起导入">
      <Steps
        size="small"
        current={step}
        items={[{ title: '选择类型' }, { title: '上传文件' }, { title: '校验结果' }, { title: '确认写入' }]}
        style={{ marginBottom: space.lg }}
      />

      <Space direction="vertical" size={space.md} style={{ width: '100%' }}>
        <Segmented
          value={typeCode ?? undefined}
          onChange={(value) => {
            setTypeCode(String(value));
            reset();
          }}
          options={types.map((type) => ({ value: type.code, label: type.label }))}
        />

        {selected?.appendOnly && (
          <Alert
            type="info"
            showIcon
            message="本次导入为追加，不会覆盖已有反馈"
            description="同一场次同一个人可以提交多份反馈，匿名行更无法识别到人，因此反馈类导入不做去重（规则 FB5、FB4）。重复上传同一个文件会产生重复数据，需要用撤销来纠正。"
          />
        )}

        {selected && preview === null && (
          <Upload.Dragger
            accept=".xlsx"
            maxCount={1}
            fileList={fileList}
            onChange={({ fileList: next }) => setFileList(next.slice(-1))}
            beforeUpload={(file) => {
              void onUpload(file);
              // 返回 false 阻止 AntD 自己发请求：上传与确认是两个接口，
              // 走 AntD 的默认 action 会绕过上面的响应处理
              return false;
            }}
            disabled={uploading}
          >
            <p style={{ margin: 0 }}>
              <FileUp size={32} color={neutral[400]} />
            </p>
            <p style={{ marginTop: space.xs }}>把 .xlsx 文件拖到这里，或点击选择文件</p>
            <Text type="secondary" style={{ fontSize: 12 }}>
              单次最多 5000 数据行（规则 I1）。上传只做校验，确认前不会写入任何数据
            </Text>
          </Upload.Dragger>
        )}

        {preview && <PreviewResult preview={preview} />}

        {preview && (
          <Space>
            <Button
              type="primary"
              loading={confirming}
              disabled={!preview.canConfirm}
              onClick={onConfirm}
            >
              确认写入
            </Button>
            <Button onClick={reset}>重新上传</Button>
            {preview.errorReportAvailable && (
              <Button href={importApi.errorReportUrl(preview.batchNo)}>下载错误报告</Button>
            )}
          </Space>
        )}
      </Space>
    </Card>
  );
}

function PreviewResult({ preview }: { preview: ImportPreview }) {
  return (
    <Space direction="vertical" size={space.md} style={{ width: '100%' }}>
      <Descriptions size="small" column={4} bordered>
        <Descriptions.Item label="批次号">{preview.batchNo}</Descriptions.Item>
        <Descriptions.Item label="总行数">{preview.totalRows}</Descriptions.Item>
        <Descriptions.Item label="将新增">{preview.insertRows}</Descriptions.Item>
        <Descriptions.Item label="将更新">{preview.updateRows}</Descriptions.Item>
      </Descriptions>

      {preview.canConfirm ? (
        <Alert
          type="success"
          showIcon
          message={`共 ${preview.totalRows} 行，全部校验通过`}
          description={preview.notes.join('；') || undefined}
        />
      ) : (
        <Alert
          type="error"
          showIcon
          message={`共 ${preview.errorCount} 行校验失败，本批次不会写入任何数据`}
          description="先按错误原因改好文件再重新上传。校验失败的批次会作为失败记录留档，不需要撤销（规则 RB6）。"
        />
      )}

      {preview.warningCount > 0 && (
        <Alert
          type="warning"
          showIcon
          message={`${preview.warningCount} 行有警告，不阻断写入`}
          description="例如负责人已离职、姓名与工号不一致。确认写入前请先确认这些行是否符合预期。"
        />
      )}

      {preview.errors.length > 0 && <ProblemTable title="错误行" rows={preview.errors} total={preview.errorCount} />}
      {preview.warnings.length > 0 && (
        <ProblemTable title="警告行" rows={preview.warnings} total={preview.warningCount} />
      )}
    </Space>
  );
}

/**
 * 错误行表格（规则 I4：行号 + 列名 + 错误值 + 错误原因）。
 *
 * 这里刻意<b>不用 DataTable</b>：它是向导里的一次性清单，没有分页、没有密度切换、
 * 没有筛选，也不需要空态——套上 DataTable 只会带来一堆用不到的壳。
 */
function ProblemTable({ title, rows, total }: { title: string; rows: RowProblem[]; total: number }) {
  return (
    <div>
      <Title level={5} style={{ marginBottom: space.xs }}>
        {title}
      </Title>
      {total > rows.length && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          共 {total} 条，这里显示前 {rows.length} 条，完整清单请下载错误报告
        </Text>
      )}
      <Table<RowProblem>
        size="small"
        rowKey={(row) => `${row.rowNo}-${row.column}-${row.reason}`}
        dataSource={rows}
        pagination={false}
        scroll={{ y: 320 }}
        columns={[
          { title: '行号', dataIndex: 'rowNo', width: 88, align: 'right' },
          { title: '列名', dataIndex: 'column', width: 140, render: (value: string) => value || '整表' },
          { title: '错误值', dataIndex: 'value', width: 180, ellipsis: true },
          { title: '原因', dataIndex: 'reason' },
        ]}
      />
    </div>
  );
}
