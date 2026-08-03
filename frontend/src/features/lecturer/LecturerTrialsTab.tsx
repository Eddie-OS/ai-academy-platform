import { useNavigate } from 'react-router-dom';
import { Alert, Button, Space, Table, Tag } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { lecturerApi, type TrialLedgerRow } from '@/shared/api/lecturers';
import { space } from '@/shared/theme/designTokens';
import { TrialLedgerDetail } from './TrialLedgerTable';

/**
 * 详情页「试讲记录」页签（需求 10.2 页面 P3-3 按讲师视角的切片）。
 *
 * <p>与底部的试讲台账读的是同一个接口，只多一个 {@code lecturerId} 条件。做成两个页面各查一次
 * 而不是把台账筛一遍嵌进来，是因为面板只有 460px：台账那一排筛选放不下，而这里也不需要——
 * 打开的就是这一个讲师。
 *
 * <p><b>讲师结论决定这名讲师的试讲合格标记，课程结论不影响它。</b>因此这里把讲师结论放在
 * 课程结论前面：从讲师页看过来，先关心的是「他讲得怎么样」。
 */

interface LecturerTrialsTabProps {
  lecturerId: number;
}

/** 一个讲师的试讲轮次是个位数，一页足够，不做分页 */
const PAGE_SIZE = 100;

export function LecturerTrialsTab({ lecturerId }: LecturerTrialsTabProps) {
  const navigate = useNavigate();

  const page = useQuery({
    queryKey: ['trial-ledger', 'by-lecturer', lecturerId],
    queryFn: () => lecturerApi.trialLedger({ lecturerId }, 1, PAGE_SIZE),
  });

  return (
    <Space direction="vertical" size={space.md} style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        message="试讲合格标记只由讲师结论产生"
        description="课程结论合格但讲师结论不合格，讲师就不会被标为试讲合格——两个结论是独立的。要改结论请去课程详情页的试讲页签。"
      />

      <Table<TrialLedgerRow>
        size="small"
        rowKey={(row) => String(row.id)}
        dataSource={page.data?.records ?? []}
        loading={page.isLoading}
        pagination={false}
        locale={{ emptyText: '这名讲师还没有试讲记录' }}
        expandable={{ expandedRowRender: (row) => <TrialLedgerDetail row={row} /> }}
        columns={[
          { title: '试讲日期', dataIndex: 'trialDate', width: 106 },
          {
            title: '课程',
            dataIndex: 'courseName',
            render: (value: string, row) => (
              <Button
                type="link"
                style={{ padding: 0, textAlign: 'left', whiteSpace: 'normal', height: 'auto' }}
                onClick={() => navigate(`/courses/${row.courseId}`)}
              >
                {value}
              </Button>
            ),
          },
          { title: '轮次', dataIndex: 'roundNo', width: 70, render: (v: number) => `第 ${v} 轮` },
          {
            title: '讲师结论',
            dataIndex: 'lecturerConclusion',
            width: 130,
            render: (value: string | null, row) => (
              <Space size={4} wrap>
                {value ? <Tag color="blue">{value}</Tag> : null}
                {row.inconsistent && <Tag color="warning">与课程结论不一致</Tag>}
              </Space>
            ),
          },
          {
            title: '课程结论',
            dataIndex: 'courseConclusion',
            width: 96,
            render: (value: string | null) => (value ? <Tag>{value}</Tag> : null),
          },
          { title: '记录状态', dataIndex: 'recordState', width: 106 },
        ]}
      />
    </Space>
  );
}
