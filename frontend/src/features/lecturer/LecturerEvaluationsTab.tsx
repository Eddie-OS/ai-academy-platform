import { Alert, Empty, List, Rate, Space, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { lecturerApi, type LecturerEvaluation } from '@/shared/api/lecturers';
import { EM_DASH, formatDateTime } from '@/shared/format';
import { fontSize, neutral, space } from '@/shared/theme/designTokens';

const { Text } = Typography;

/**
 * 详情页「学员评价」页签（需求 10.6）。
 *
 * <p><b>试讲反馈不在这里</b>（规则 R10）。试讲的听众是评审专家与少量试听学员，目的是挑课程的
 * 毛病，打分普遍偏低；正式培训的听众是目标学员，目的是评价授课效果。把 1 分的试讲反馈与 5 分的
 * 正式反馈平均成 3.0，讲师平均评分这个指标就不再有意义。试讲反馈在课程详情的试讲页签里。
 *
 * <p>用列表而不是表格：评价内容是长文本，在 460px 宽的面板里做成表格一列会挤成两个字换一行。
 *
 * <p>提交人留空即匿名（需求 10.6 第 3 项，V1.2 依 D35 改为选填）。匿名不影响计分（规则 FB3），
 * 只影响能不能看到是谁写的，因此这里照常显示评分，只把姓名位置写成「匿名」。
 */

interface LecturerEvaluationsTabProps {
  lecturerId: number;
}

export function LecturerEvaluationsTab({ lecturerId }: LecturerEvaluationsTabProps) {
  const evaluations = useQuery({
    queryKey: ['lecturers', lecturerId, 'evaluations'],
    queryFn: () => lecturerApi.evaluations(lecturerId),
  });

  const rows = evaluations.data ?? [];

  return (
    <Space direction="vertical" size={space.md} style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        message="只含正式培训的学员反馈"
        description="试讲反馈另计，在课程详情的试讲记录里。两者的样本量与评分心理完全不同，混在一起算平均分会让这个数字失去意义。"
      />

      <List<LecturerEvaluation>
        size="small"
        loading={evaluations.isLoading}
        dataSource={rows}
        locale={{ emptyText: <Empty description="还没有学员评价" /> }}
        renderItem={(item) => (
          <List.Item style={{ display: 'block', padding: `${space.sm}px 0` }}>
            <Space size={space.xs} wrap style={{ marginBottom: space['2xs'] }}>
              <Rate disabled value={item.score} style={{ fontSize: fontSize.bodySm }} />
              <Text strong>{item.score} / 5</Text>
              <Text style={{ fontSize: fontSize.bodySm, color: neutral[600] }}>
                {item.submitterName ?? '匿名'}
                {item.submitterDept ? ` · ${item.submitterDept}` : ''}
              </Text>
              {item.feedbackScene && <Tag>{item.feedbackScene}</Tag>}
            </Space>
            <div style={{ whiteSpace: 'pre-wrap', marginBottom: space['2xs'] }}>
              {item.content ?? EM_DASH}
            </div>
            <Text style={{ fontSize: fontSize.caption, color: neutral[500] }}>
              {item.sessionNo} · 授课于 {item.trainingDate} · 提交于 {formatDateTime(item.submittedAt)}
            </Text>
          </List.Item>
        )}
      />
    </Space>
  );
}
