import { Alert, Button, Card, Col, Row, Space, Statistic, Table, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/shared/api/client';
import type { PageResult } from '@/shared/api/types';
import { useAuthStore } from '@/shared/store/authStore';
import { space } from '@/shared/theme/designTokens';

const { Title, Text } = Typography;

interface SampleStateCount {
  sampleState: string;
  total: number;
}

interface SkeletonSample {
  id: number;
  sampleNo: string;
  sampleName: string;
  sampleState: string;
  updatedAt: string | null;
  lastStateChangedAt: string | null;
}

/**
 * 总看板的壳层。
 *
 * 阶段 0 不实现任何指标（54 个指标属阶段 3）。这里只做两件事：
 * <b>调用示例读接口与写接口</b>，证明「浏览器 → Nginx → Spring Boot → PostgreSQL」整条链路通，
 * 并给出口准则 E0-4 提供可量取的 AntD 按钮与表格实例。
 * 阶段 3 用真实指标卡替换本页。
 */
export function DashboardShellPage() {
  const queryClient = useQueryClient();
  const isOperator = useAuthStore((state) => state.account?.operator ?? false);

  const counts = useQuery({
    queryKey: ['skeleton', 'state-counts'],
    queryFn: () => api.get<SampleStateCount[]>('/api/skeleton-samples/state-counts'),
  });

  const list = useQuery({
    queryKey: ['skeleton', 'page'],
    queryFn: () => api.get<PageResult<SkeletonSample>>('/api/skeleton-samples?pageNum=1&pageSize=10'),
  });

  const create = useMutation({
    mutationFn: () =>
      api.post<SkeletonSample>('/api/skeleton-samples', {
        sampleName: `示例对象 ${new Date().toLocaleTimeString('zh-CN')}`,
      }),
    onSuccess: () => {
      message.success('写入成功');
      void queryClient.invalidateQueries({ queryKey: ['skeleton'] });
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : '写入失败');
    },
  });

  const columns: ColumnsType<SkeletonSample> = [
    { title: '编号', dataIndex: 'sampleNo', width: 160 },
    { title: '名称', dataIndex: 'sampleName' },
    { title: '状态', dataIndex: 'sampleState', width: 120 },
    {
      // 需求 C5／C6：这两列刻意并排展示，用来确认「最后编辑」与「最后状态变更」是分离的
      title: '最后编辑时间',
      dataIndex: 'updatedAt',
      width: 200,
      render: (value: string | null) => value ?? '—',
    },
    {
      title: '最后状态变更时间',
      dataIndex: 'lastStateChangedAt',
      width: 200,
      render: (value: string | null) => value ?? '—',
    },
  ];

  return (
    <div>
      <div
        style={{
          minHeight: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Title level={2} style={{ margin: 0 }}>
          总看板
        </Title>
        {/* 纪律 PMI-5：写操作入口只按登录时拿到的 operator 布尔值决定是否渲染 */}
        {isOperator && (
          <Button type="primary" loading={create.isPending} onClick={() => create.mutate()}>
            新建示例对象
          </Button>
        )}
      </div>

      <Alert
        type="info"
        showIcon
        message="阶段 0 骨架"
        description="指标、三色灯预警与待办清单在阶段 3 实现。下方数据来自骨架示例表，仅用于验证前后端与数据库链路。"
        style={{ marginBottom: space.lg }}
      />

      {counts.error && (
        <Alert
          type="error"
          showIcon
          message="示例接口调用失败"
          description={
            counts.error instanceof ApiError
              ? `${counts.error.code}：${counts.error.message}${
                  counts.error.traceId ? `（traceId ${counts.error.traceId}）` : ''
                }`
              : '未知错误'
          }
          style={{ marginBottom: space.lg }}
        />
      )}

      <Row gutter={16}>
        {(counts.data ?? []).map((item) => (
          <Col span={6} key={item.sampleState}>
            <Card loading={counts.isLoading}>
              <Statistic title={item.sampleState} value={item.total} className="metric-value" />
            </Card>
          </Col>
        ))}
      </Row>

      <Card title="骨架示例表（前 10 条）" style={{ marginTop: space.lg }}>
        <Table
          rowKey="id"
          size="middle"
          columns={columns}
          dataSource={list.data?.records ?? []}
          loading={list.isLoading}
          pagination={false}
          locale={{
            emptyText: (
              <Space direction="vertical">
                <Text type="secondary">示例表暂无数据。</Text>
                <Text type="secondary">执行 scripts\seed\seed.ps1 后刷新本页。</Text>
              </Space>
            ),
          }}
        />
      </Card>
    </div>
  );
}
