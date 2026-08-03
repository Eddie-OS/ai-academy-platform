import { useNavigate } from 'react-router-dom';
import { Alert, Button, Space, Table, Tag } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { lecturerApi, type TeachingRecord } from '@/shared/api/lecturers';
import { EM_DASH } from '@/shared/format';
import { space } from '@/shared/theme/designTokens';

/**
 * 详情页「授课记录」页签（需求 10.5）。
 *
 * <p><b>这张表是实时从培训场次派生的，不是一张独立台账。</b>需求 10.5 说授课记录在场次变为
 * 「已结束」时生成，但那一刻签到往往还没导入——「结束」这条转换派生的正是一条「签到导入」任务。
 * 若在那一刻落库，实际参训人数必然是 0，而后续导入签到不会回头改它。实时派生则改一次签到，
 * 这里的人次立刻跟着对。决策记在 {@code docs/文档待修清单.md} 的 M-1。
 *
 * <p>只统计已结束与已归档的场次：排在下周的场次还没讲，算进「累计授课」会让讲师的授课次数
 * 提前虚增，而这个数是排课时判断「谁讲得多」的依据。
 */

interface LecturerTeachingTabProps {
  lecturerId: number;
}

export function LecturerTeachingTab({ lecturerId }: LecturerTeachingTabProps) {
  const navigate = useNavigate();

  const records = useQuery({
    queryKey: ['lecturers', lecturerId, 'teaching-records'],
    queryFn: () => lecturerApi.teachingRecords(lecturerId),
  });

  return (
    <Space direction="vertical" size={space.md} style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        message="只统计已经上完的场次"
        description="还没开讲的场次不在这里。实际参训人数取该场次的签到条数，签到没导入时是 0——那不是没人来，是还没录。"
      />

      <Table<TeachingRecord>
        size="small"
        rowKey={(row) => String(row.sessionId)}
        dataSource={records.data ?? []}
        loading={records.isLoading}
        pagination={false}
        locale={{ emptyText: '还没有授课记录' }}
        columns={[
          { title: '授课日期', dataIndex: 'teachingDate', width: 110 },
          {
            title: '培训场次',
            dataIndex: 'sessionNo',
            render: (_: string, row) => (
              <Button
                type="link"
                style={{ padding: 0, textAlign: 'left', whiteSpace: 'normal', height: 'auto' }}
                onClick={() => navigate(`/training-sessions/${row.sessionId}`)}
              >
                {row.sessionName ?? row.sessionNo}
              </Button>
            ),
          },
          {
            title: '课程',
            dataIndex: 'courseName',
            width: 150,
            render: (value: string | null, row) =>
              row.courseId ? (
                <Button
                  type="link"
                  style={{ padding: 0, textAlign: 'left', whiteSpace: 'normal', height: 'auto' }}
                  onClick={() => navigate(`/courses/${row.courseId}`)}
                >
                  {value ?? `课程 #${row.courseId}`}
                </Button>
              ) : (
                EM_DASH
              ),
          },
          { title: '场次状态', dataIndex: 'sessionState', width: 96, render: (v: string) => <Tag>{v}</Tag> },
          {
            title: '参训人次',
            dataIndex: 'attendeeCount',
            width: 90,
            align: 'right',
          },
          {
            title: '本场评分',
            dataIndex: 'avgScore',
            width: 96,
            align: 'right',
            // 没有反馈与「大家都打 0 分」是两回事（设计规范 3.3）
            render: (value: string | null) => (value === null ? EM_DASH : `${value} / 5`),
          },
        ]}
      />
    </Space>
  );
}
