import { useState } from 'react';
import { App, Button, Card, DatePicker, Modal, Select, Space, Tag } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Dayjs } from 'dayjs';
import { space } from '@/shared/theme/designTokens';
import { ApiError } from '@/shared/api/client';
import { importApi, type ImportBatch, type ImportTypeOption } from '@/shared/api/imports';
import { DataTable, actionsWidth, type DataTableColumn } from '@/shared/ui/DataTable';

/**
 * 区域 C · 导入批次列表（需求 13.8.4）与批次撤销（13.8.5）。
 *
 * <p>筛选项与列都照 13.8.4 的十个字段来。「操作账号」固定是运营（C04），仍然要显示——
 * 共享账号下运营需要靠这一列 + 导入时间自己判断是谁导的。
 */

const RESULT_OPTIONS = ['成功', '校验失败', '已撤销'];

export function ImportBatchTable({ types }: { types: ImportTypeOption[] }) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const [type, setType] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [range, setRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const filter = {
    type,
    result,
    from: range?.[0]?.startOf('day').toISOString() ?? null,
    to: range?.[1]?.endOf('day').toISOString() ?? null,
  };
  const filtered = Object.values(filter).some((value) => value !== null);

  const batches = useQuery({
    queryKey: ['imports', filter, pageNum, pageSize],
    queryFn: () => importApi.page(filter, pageNum, pageSize),
  });

  const revoke = useMutation({
    mutationFn: (batchNo: string) => importApi.revoke(batchNo),
    onSuccess: (data) => {
      // 规则 RB3：被跳过的行号必须列出来，否则运营以为全撤了
      const skipped =
        data.skippedRows > 0
          ? `，跳过 ${data.skippedRows} 行（已被后续修改，行号：${data.skippedRowNos.join('、')}）`
          : '';
      message.success(`批次 ${data.batchNo} 已撤销：回滚 ${data.revokedRows} 行${skipped}`);
      void queryClient.invalidateQueries({ queryKey: ['imports'] });
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '撤销失败，请重试'),
  });

  const confirmRevoke = (batch: ImportBatch) => {
    Modal.confirm({
      title: `撤销批次 ${batch.batchNo}`,
      // 规则 RB1：确认文案必须写明将回滚的条数
      content: `将回滚本批次导入的 ${batch.insertRows ?? 0} 条新增与 ${batch.updateRows ?? 0} 条更新。已被后续修改过的记录不回滚，撤销后会列出被跳过的行号。`,
      okText: '撤销本批次',
      okButtonProps: { danger: true },
      cancelText: '不撤销',
      onOk: () => revoke.mutateAsync(batch.batchNo),
    });
  };

  const columns: DataTableColumn<ImportBatch>[] = [
    { key: 'batchNo', title: '批次号', kind: 'code', width: 180, dataIndex: 'batchNo' },
    { key: 'importType', title: '导入类型', kind: 'combatUnit', dataIndex: 'importType' },
    { key: 'fileName', title: '文件名', kind: 'name', dataIndex: 'fileName' },
    { key: 'totalRows', title: '总行数', kind: 'number', dataIndex: 'totalRows' },
    { key: 'insertRows', title: '新增条数', kind: 'number', dataIndex: 'insertRows' },
    { key: 'updateRows', title: '更新条数', kind: 'number', dataIndex: 'updateRows' },
    {
      key: 'importResult',
      title: '导入结果',
      kind: 'statusMain',
      render: (row) => (row.importResult ? <ResultTag result={row.importResult} /> : null),
    },
    { key: 'createdBy', title: '操作账号', kind: 'person', dataIndex: 'createdBy' },
    {
      key: 'importedAt',
      title: '导入时间',
      kind: 'datetime',
      sortable: true,
      render: (row) => formatDateTime(row.importedAt ?? row.createdAt),
    },
    {
      key: 'actions',
      title: '操作',
      kind: 'actions',
      width: actionsWidth(3),
      operatorOnly: true,
      render: (row) => (
        <Space size={space.md}>
          <Button type="link" size="small" style={{ padding: 0 }} href={importApi.sourceFileUrl(row.batchNo)}>
            原文件
          </Button>
          {row.errorReportPath && (
            <Button type="link" size="small" style={{ padding: 0 }} href={importApi.errorReportUrl(row.batchNo)}>
              错误报告
            </Button>
          )}
          {/* RB4：已撤销的批次不可重复撤销；RB6：校验失败的批次没写入任何数据，不需要撤销 */}
          {row.importResult === '成功' && (
            <Button type="link" size="small" danger style={{ padding: 0 }} onClick={() => confirmRevoke(row)}>
              撤销
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const resetFilters = () => {
    setType(null);
    setResult(null);
    setRange(null);
    setPageNum(1);
  };

  return (
    <Card title="导入批次" styles={{ body: { paddingTop: space.md } }}>
      <Space style={{ marginBottom: space.md }} wrap>
        <Select
          allowClear
          placeholder="导入类型"
          style={{ width: 160 }}
          value={type ?? undefined}
          onChange={(value) => {
            setType(value ?? null);
            setPageNum(1);
          }}
          options={types.map((item) => ({ value: item.label, label: item.label }))}
        />
        <Select
          allowClear
          placeholder="导入结果"
          style={{ width: 160 }}
          value={result ?? undefined}
          onChange={(value) => {
            setResult(value ?? null);
            setPageNum(1);
          }}
          options={RESULT_OPTIONS.map((item) => ({ value: item, label: item }))}
        />
        <DatePicker.RangePicker
          value={range ?? undefined}
          onChange={(value) => {
            setRange(value as [Dayjs | null, Dayjs | null] | null);
            setPageNum(1);
          }}
        />
        <Button onClick={resetFilters}>重置</Button>
      </Space>

      <DataTable<ImportBatch>
        storageKey="imports"
        columns={columns}
        rows={batches.data?.records}
        rowKey={(row) => row.batchNo}
        total={batches.data?.total ?? 0}
        pageNum={pageNum}
        pageSize={pageSize}
        onPageChange={(nextPage, nextSize) => {
          setPageNum(nextPage);
          setPageSize(nextSize);
        }}
        loading={batches.isLoading}
        error={batches.isError ? '导入批次没有取到。' : null}
        onReload={() => void batches.refetch()}
        filtered={filtered}
        objectName="导入批次"
        emptyDescription="导入中心是平台唯一的批量数据入口。先在上方下载模板，填好后上传校验，确认无误再写入。"
        onResetFilters={resetFilters}
      />
    </Card>
  );
}

/**
 * 导入结果的颜色。
 *
 * <p>这里用 AntD 的 Tag 预设色而不是三色灯的语义色：导入结果不是预警（规则 WV4 要求
 * 灯色与状态徽章的用色互不侵占），「校验失败」是一次操作的结果，不进三色灯统计。
 */
function ResultTag({ result }: { result: string }) {
  const color = result === '成功' ? 'green' : result === '校验失败' ? 'red' : 'default';
  return <Tag color={color}>{result}</Tag>;
}

function formatDateTime(value: string): string {
  // 后端给的是 OffsetDateTime 的 ISO 串，这里只截到分钟：秒对运营没有意义，
  // 但会让「导入时间」列宽从 148px 涨到 170px 以上
  return value.replace('T', ' ').slice(0, 16);
}
