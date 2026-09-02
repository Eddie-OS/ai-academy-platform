import { useNavigate } from 'react-router-dom';
import { Alert, Button, Descriptions, Empty, Space, Tag } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { lecturerApi, type TrialLedgerRow } from '@/shared/api/lecturers';
import { space } from '@/shared/theme/designTokens';
import { EM_DASH } from '@/shared/format';

/**
 * 详情页「试讲记录」页签。字段全部从课程工作台·课程试讲带出，按轮次倒序。
 *
 * <p>整体满意度与优化建议挂在课程上（同课多轮共用），不是另建一套讲师侧台账。
 * 要改结论或反馈，仍去课程详情的试讲页签。
 */

interface LecturerTrialsTabProps {
  lecturerId: number;
}

const PAGE_SIZE = 100;

function textOrDash(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : EM_DASH;
}

function trialTimeOf(row: TrialLedgerRow): string {
  return row.trialDate || row.trialScheduledDate || EM_DASH;
}

export function LecturerTrialsTab({ lecturerId }: LecturerTrialsTabProps) {
  const navigate = useNavigate();

  const page = useQuery({
    queryKey: ['trial-ledger', 'by-lecturer', lecturerId],
    queryFn: () => lecturerApi.trialLedger({ lecturerId, sortBy: 'roundNo', sortAsc: false }, 1, PAGE_SIZE),
  });

  const rows = page.data?.records ?? [];

  return (
    <Space direction="vertical" size={space.md} style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        message="试讲记录从课程工作台带出"
        description="第 x 轮、试讲结果、课程名称、整体满意度、优化建议、试讲时间都来自课程试讲。讲师结论决定试讲合格标记；要改请去课程详情页的试讲页签。"
      />

      {page.isLoading ? null : rows.length === 0 ? (
        <Empty description="这名讲师还没有试讲记录" />
      ) : (
        rows.map((row) => (
          <article key={row.id} data-testid="lecturer-trial-round">
            <Space size={space.xs} wrap>
              <Button type="link" style={{ padding: 0 }} onClick={() => navigate(`/courses/${row.courseId}`)}>
                第 {row.roundNo} 轮
              </Button>
              {row.lecturerConclusion ? <Tag color="blue">{row.lecturerConclusion}</Tag> : null}
              {row.inconsistent ? <Tag color="warning">与课程结论不一致</Tag> : null}
            </Space>
            <Descriptions
              size="small"
              column={1}
              items={[
                { key: 'result', label: '试讲结果', children: textOrDash(row.lecturerConclusion) },
                {
                  key: 'course',
                  label: '课程名称',
                  children: (
                    <Button type="link" style={{ padding: 0 }} onClick={() => navigate(`/courses/${row.courseId}`)}>
                      {row.courseName}
                    </Button>
                  ),
                },
                { key: 'satisfaction', label: '整体满意度', children: textOrDash(row.trialSatisfaction) },
                { key: 'advice', label: '优化建议', children: textOrDash(row.trialOptimizeAdvice) },
                { key: 'time', label: '试讲时间', children: trialTimeOf(row) },
              ]}
            />
          </article>
        ))
      )}
    </Space>
  );
}
