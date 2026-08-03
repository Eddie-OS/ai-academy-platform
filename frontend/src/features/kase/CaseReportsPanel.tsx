import { useEffect, useState } from 'react';
import {
  Alert,
  App,
  Button,
  Card,
  DatePicker,
  Drawer,
  Empty,
  Form,
  Input,
  List,
  Popconfirm,
  Segmented,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import { FileText, Plus, Trash2 } from 'lucide-react';
import { ApiError } from '@/shared/api/client';
import { caseApi, type CaseReport } from '@/shared/api/cases';
import { AnalyticsCard } from '@/shared/ui/CockpitLayout';
import { formatDateTime } from '@/shared/format';
import { useIsOperator } from '@/shared/store/authStore';
import { fontSize, neutral, space } from '@/shared/theme/designTokens';
import { FIELD_ENUM_KEYS, useFieldEnums } from './caseMeta';
import { sanitizeHtml } from './richText';

const { Text } = Typography;

/**
 * 总结报告（需求 12.6，原 P5-4）。
 *
 * <p><b>「自动生成」生成的是一份草稿，不是一份结论。</b>后端按区间把案例与培训的计数拼成三段
 * 正文，运营在这里改。一经编辑，生成方式就从「自动生成」翻成「手动编辑」并且不会翻回去——
 * 让人一眼看出哪几份被人动过（需求 12.6）。
 *
 * <p><b>报告不是状态机对象</b>：没有发布、没有归档、没有审核。它就是一段带区间的正文。
 */

interface RangeValue {
  from: Dayjs;
  to: Dayjs;
}

export function CaseReportsPanel() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const isOperator = useIsOperator();
  const fieldEnums = useFieldEnums();
  const [generating, setGenerating] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);

  const reports = useQuery({ queryKey: ['case-reports'], queryFn: () => caseApi.reports() });

  const remove = useMutation({
    mutationFn: (id: number) => caseApi.removeReport(id),
    onSuccess: () => {
      message.success('报告已删除');
      void queryClient.invalidateQueries({ queryKey: ['case-reports'] });
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '删除失败，请重试'),
  });

  /** 「自动生成」在枚举里的取值，用来判断某份报告有没有被人改过。取值不写死（STK-1） */
  const autoMode = fieldEnums.data?.[FIELD_ENUM_KEYS.caseReportGenerateMode]?.[0];

  return (
    <>
      <AnalyticsCard
        title="总结报告"
        note="报告的正文由平台按区间取数拼出草稿，结论由运营自己写——平台不替线下下判断（设计原则一）"
        extra={
          isOperator && (
            <Button size="small" icon={<Plus size={14} />} onClick={() => setGenerating(true)}>
              生成报告
            </Button>
          )
        }
      >
        <List<CaseReport>
          size="small"
          loading={reports.isLoading}
          dataSource={reports.data ?? []}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="还没有报告。选一个时间区间，平台会把该区间内的案例与培训数据拼成一份草稿"
              />
            ),
          }}
          renderItem={(item) => (
            <List.Item
              actions={[
                <Button key="open" type="link" size="small" onClick={() => setOpenId(item.id)}>
                  查看
                </Button>,
                ...(isOperator
                  ? [
                      <Popconfirm
                        key="remove"
                        title="删除这份报告？"
                        description="逻辑删除，正文不会被物理清除。同一区间可以重新生成一份新的。"
                        okText="删除"
                        cancelText="取消"
                        okButtonProps={{ danger: true }}
                        onConfirm={() => remove.mutate(item.id)}
                      >
                        <Button type="text" size="small" danger icon={<Trash2 size={14} />} />
                      </Popconfirm>,
                    ]
                  : []),
              ]}
            >
              <List.Item.Meta
                avatar={<FileText size={18} color={neutral[500]} />}
                title={
                  <Space size={space.xs}>
                    <Text strong>{item.reportName}</Text>
                    <Tag color={item.generateMode === autoMode ? 'blue' : 'default'}>
                      {item.generateMode}
                    </Tag>
                  </Space>
                }
                description={
                  <Text style={{ fontSize: fontSize.caption, color: neutral[500] }}>
                    统计区间 {item.periodStart} ~ {item.periodEnd} · 最后修改{' '}
                    {formatDateTime(item.updatedAt)}
                  </Text>
                }
              />
            </List.Item>
          )}
        />
      </AnalyticsCard>

      <GenerateReportModal open={generating} onClose={() => setGenerating(false)} />

      <ReportDrawer id={openId} onClose={() => setOpenId(null)} />
    </>
  );
}

/**
 * 生成弹窗。改区间时实时预览正文——区间选错了，看数字比看日期快。
 */
function GenerateReportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<{ reportName: string; range: [Dayjs, Dayjs] }>();
  const [range, setRange] = useState<RangeValue | null>(null);

  useEffect(() => {
    if (open) {
      // 默认上一个自然月：季度报告与年报的区间各不相同，但「刚过去的那个月」是最常用的一个
      const from = dayjs().subtract(1, 'month').startOf('month');
      const to = from.endOf('month');
      form.setFieldsValue({ reportName: `${from.format('YYYY 年 M 月')}案例总结`, range: [from, to] });
      setRange({ from, to });
    }
  }, [open, form]);

  const preview = useQuery({
    queryKey: ['case-reports', 'preview', range?.from.format('YYYY-MM-DD'), range?.to.format('YYYY-MM-DD')],
    queryFn: () => caseApi.previewReport(range!.from.format('YYYY-MM-DD'), range!.to.format('YYYY-MM-DD')),
    enabled: open && range !== null,
  });

  const generate = useMutation({
    mutationFn: (values: { reportName: string; range: [Dayjs, Dayjs] }) =>
      caseApi.generateReport({
        reportName: values.reportName,
        periodStart: values.range[0].format('YYYY-MM-DD'),
        periodEnd: values.range[1].format('YYYY-MM-DD'),
      }),
    onSuccess: () => {
      message.success('报告已生成，可以继续编辑正文');
      void queryClient.invalidateQueries({ queryKey: ['case-reports'] });
      onClose();
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '生成失败，请重试'),
  });

  return (
    <Drawer
      open={open}
      width={720}
      title="生成总结报告"
      onClose={onClose}
      extra={
        <Button
          type="primary"
          loading={generate.isPending}
          onClick={() => void form.validateFields().then((values) => generate.mutateAsync(values))}
        >
          生成
        </Button>
      }
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        onValuesChange={(_, values) =>
          setRange(values.range?.[0] && values.range?.[1] ? { from: values.range[0], to: values.range[1] } : null)
        }
      >
        <Form.Item
          label="报告名称"
          name="reportName"
          rules={[{ required: true, message: '请填写报告名称' }]}
        >
          <Input maxLength={100} />
        </Form.Item>
        <Form.Item
          label="统计区间"
          name="range"
          rules={[{ required: true, message: '请选择统计区间' }]}
          extra="按自然日闭区间取数。区间两端都算在内"
        >
          <DatePicker.RangePicker style={{ width: '100%' }} />
        </Form.Item>
      </Form>

      <Card size="small" title="正文预览">
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: space.sm }}
          message="这份草稿只有数字，没有结论"
          description="平台不判断「本季度案例质量提升明显」这类话。生成后请在正文里补上你的判断——那才是这份报告的价值所在。"
        />
        <Spin spinning={preview.isFetching}>
          <RenderedReport html={preview.data ?? ''} />
        </Spin>
      </Card>
    </Drawer>
  );
}

/** 报告详情抽屉：读与改在同一个抽屉里，改完即存。 */
function ReportDrawer({ id, onClose }: { id: number | null; onClose: () => void }) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const isOperator = useIsOperator();
  const [mode, setMode] = useState<'阅读' | '编辑'>('阅读');
  const [draft, setDraft] = useState('');

  const report = useQuery({
    queryKey: ['case-reports', id],
    queryFn: () => caseApi.reportDetail(id!),
    enabled: id !== null,
  });

  useEffect(() => {
    setMode('阅读');
    setDraft(report.data?.content ?? '');
  }, [id, report.data?.content]);

  const save = useMutation({
    mutationFn: () =>
      caseApi.updateReport(id!, {
        reportName: report.data!.reportName,
        periodStart: report.data!.periodStart,
        periodEnd: report.data!.periodEnd,
        content: draft,
      }),
    onSuccess: () => {
      message.success('报告已保存，生成方式已改为手动编辑');
      setMode('阅读');
      void queryClient.invalidateQueries({ queryKey: ['case-reports'] });
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '保存失败，请重试'),
  });

  const data = report.data;

  return (
    <Drawer
      open={id !== null}
      width={720}
      onClose={onClose}
      title={data?.reportName ?? '加载中'}
      extra={
        isOperator &&
        data && (
          <Space size={space.xs}>
            <Segmented
              size="small"
              value={mode}
              options={['阅读', '编辑']}
              onChange={(value) => setMode(value as '阅读' | '编辑')}
            />
            {mode === '编辑' && (
              <Button
                type="primary"
                size="small"
                loading={save.isPending}
                onClick={() => void save.mutateAsync()}
              >
                保存
              </Button>
            )}
          </Space>
        )
      }
    >
      <Spin spinning={report.isLoading}>
        {data && (
          <Space direction="vertical" size={space.sm} style={{ width: '100%' }}>
            <Text style={{ fontSize: fontSize.caption, color: neutral[500] }}>
              统计区间 {data.periodStart} ~ {data.periodEnd} · {data.generateMode} · 最后修改{' '}
              {formatDateTime(data.updatedAt)}
              {data.updatedBy ? ` · ${data.updatedBy}` : ''}
            </Text>
            {mode === '编辑' ? (
              <Input.TextArea
                rows={24}
                value={draft}
                maxLength={50000}
                showCount
                onChange={(e) => setDraft(e.target.value)}
              />
            ) : (
              <RenderedReport html={data.content ?? ''} />
            )}
          </Space>
        )}
      </Spin>
    </Drawer>
  );
}

function RenderedReport({ html }: { html: string }) {
  if (html === '') {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="正文为空" />;
  }
  return (
    <div
      data-testid="report-content"
      style={{ fontSize: fontSize.body, color: neutral[700], wordBreak: 'break-word' }}
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
    />
  );
}
