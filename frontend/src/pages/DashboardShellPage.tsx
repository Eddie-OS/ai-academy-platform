import { Alert, Card, Col, Row, Space, Statistic, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '@/shared/api/client';
import type { PageResult } from '@/shared/api/types';
import { space } from '@/shared/theme/designTokens';

const { Title, Text } = Typography;

/** 对应后端 ImportBatch（需求 13.8.4 的批次列表字段）。1D 起改由 OpenAPI 生成（纪律 STK-1）。 */
interface ImportBatch {
  id: number;
  batchNo: string;
  importType: string;
  fileName: string;
  totalRows: number;
  insertRows: number;
  updateRows: number;
  importResult: string;
  importedAt: string | null;
  importedBy: string;
}

const RESULT_COLORS: Record<string, string> = {
  成功: 'green',
  校验失败: 'red',
  已撤销: 'default',
};

/**
 * 总看板的壳层。
 *
 * 阶段 0 靠骨架示例接口验证「浏览器 → Nginx → Spring Boot → PostgreSQL」链路；1C 删掉骨架后
 * 改用导入批次列表，这条链路的验证目标不变，但读的是真实业务表。
 *
 * 54 个指标属阶段 3，导入中心的完整页面（三步向导、错误报告下载、撤销）属 1D。本页在那之前
 * 只做只读展示：把写入口放在这里，1D 落地时就要先把它拆掉。
 */
export function DashboardShellPage() {
  const batches = useQuery({
    queryKey: ['imports', 'page'],
    queryFn: () => api.get<PageResult<ImportBatch>>('/api/imports?pageNum=1&pageSize=10'),
  });

  const records = batches.data?.records ?? [];
  const succeeded = records.filter((item) => item.importResult === '成功').length;
  const importedRows = records.reduce((sum, item) => sum + item.insertRows + item.updateRows, 0);

  const columns: ColumnsType<ImportBatch> = [
    { title: '批次号', dataIndex: 'batchNo', width: 200 },
    { title: '导入类型', dataIndex: 'importType', width: 110 },
    { title: '文件名', dataIndex: 'fileName', ellipsis: true },
    { title: '总行数', dataIndex: 'totalRows', width: 90, align: 'right' },
    { title: '新增', dataIndex: 'insertRows', width: 80, align: 'right' },
    { title: '更新', dataIndex: 'updateRows', width: 80, align: 'right' },
    {
      title: '导入结果',
      dataIndex: 'importResult',
      width: 110,
      render: (value: string) => <Tag color={RESULT_COLORS[value] ?? 'blue'}>{value}</Tag>,
    },
    {
      title: '导入时间',
      dataIndex: 'importedAt',
      width: 200,
      render: (value: string | null) => value ?? '—',
    },
  ];

  return (
    <div>
      <div style={{ minHeight: 64, display: 'flex', alignItems: 'center' }}>
        <Title level={2} style={{ margin: 0 }}>
          总看板
        </Title>
      </div>

      <Alert
        type="info"
        showIcon
        message="阶段 1 骨架"
        description="指标、三色灯预警与待办清单在阶段 3 实现。下方为导入批次记录，用于验证前后端与数据库链路。"
        style={{ marginBottom: space.lg }}
      />

      {batches.error && (
        <Alert
          type="error"
          showIcon
          message="批次列表接口调用失败"
          description={
            batches.error instanceof ApiError
              ? `${batches.error.code}：${batches.error.message}${
                  batches.error.traceId ? `（traceId ${batches.error.traceId}）` : ''
                }`
              : '未知错误'
          }
          style={{ marginBottom: space.lg }}
        />
      )}

      <Row gutter={16}>
        <Col span={6}>
          <Card loading={batches.isLoading}>
            <Statistic title="导入批次总数" value={batches.data?.total ?? 0} className="metric-value" />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={batches.isLoading}>
            <Statistic title="最近 10 批中成功" value={succeeded} className="metric-value" />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={batches.isLoading}>
            <Statistic title="最近 10 批写入行数" value={importedRows} className="metric-value" />
          </Card>
        </Col>
      </Row>

      <Card title="导入批次（最近 10 批）" style={{ marginTop: space.lg }}>
        <Table
          rowKey="id"
          size="middle"
          columns={columns}
          dataSource={records}
          loading={batches.isLoading}
          pagination={false}
          locale={{
            emptyText: (
              <Space direction="vertical">
                <Text type="secondary">还没有导入记录。</Text>
                <Text type="secondary">导入中心页面在阶段 1D 落地，当前可用接口先行导入。</Text>
              </Space>
            ),
          }}
        />
      </Card>
    </div>
  );
}
