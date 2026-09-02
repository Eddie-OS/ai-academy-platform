import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Descriptions, Space, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useQuery } from '@tanstack/react-query';
import { lecturerApi, type Lecturer, type TeachingRecord } from '@/shared/api/lecturers';
import { EM_DASH, formatDateTime } from '@/shared/format';
import { space } from '@/shared/theme/designTokens';

/**
 * 详情页「授课记录与学员反馈」里的授课预览（需求 10.5）。
 *
 * <p><b>实时从培训场次派生，不另建可写授课台账</b>（待修清单 M-1）。
 * 预览列按规格：课程名称、场次、授课日期、本场评分。
 * 「查看全部」再摊开授课类型、综合评分、记录创建人、记录更新时间。
 * 授课类型原样展示场次 {@code trainingForm}（线下／线上／混合），不映射成规格图上的别名。
 */

const PREVIEW_SIZE = 3;

interface LecturerTeachingTabProps {
  lecturer: Lecturer;
}

export function LecturerTeachingTab({ lecturer }: LecturerTeachingTabProps) {
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(false);

  const query = useQuery({
    queryKey: ['lecturers', lecturer.id, 'teaching-records'],
    queryFn: () => lecturerApi.teachingRecords(lecturer.id),
  });

  const records = query.data ?? [];
  const preview = records.slice(0, PREVIEW_SIZE);
  const rows = showAll ? records : preview;

  const previewColumns: ColumnsType<TeachingRecord> = [
    {
      title: '课程名称',
      dataIndex: 'courseName',
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
    {
      title: '场次',
      dataIndex: 'sessionNo',
      render: (_value, row) => (
        <Button
          type="link"
          style={{ padding: 0, textAlign: 'left', whiteSpace: 'normal', height: 'auto' }}
          onClick={() => navigate(`/training-sessions/${row.sessionId}`)}
        >
          {row.sessionName ?? row.sessionNo}
        </Button>
      ),
    },
    { title: '授课日期', dataIndex: 'teachingDate', width: 110 },
    {
      title: '本场评分',
      dataIndex: 'avgScore',
      width: 96,
      align: 'right',
      render: (value: string | null) => (value === null ? EM_DASH : `${value} / 5`),
    },
  ];

  const extraColumns: ColumnsType<TeachingRecord> = [
    {
      title: '授课类型',
      dataIndex: 'trainingForm',
      width: 96,
      render: (value: string | null) => (value ? <Tag>{value}</Tag> : EM_DASH),
    },
    {
      title: '综合评分',
      dataIndex: 'avgScore',
      width: 96,
      align: 'right',
      render: (value: string | null) => (value === null ? EM_DASH : `${value} / 5`),
    },
    {
      title: '记录创建人',
      dataIndex: 'createdBy',
      width: 110,
      render: (value: string | null) => value?.trim() || EM_DASH,
    },
    {
      title: '记录更新时间',
      dataIndex: 'updatedAt',
      width: 150,
      render: (value: string | null) => formatDateTime(value),
    },
  ];

  return (
    <Space direction="vertical" size={space.md} style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        message="只统计已经上完的场次"
        description="还没开讲的场次不在这里。实际参训人数取该场次的签到条数，签到没导入时是 0——那不是没人来，是还没录。授课记录从培训场次实时带出，不另建台账。"
      />

      <Descriptions size="small" column={1}>
        <Descriptions.Item label="讲师ID">{lecturer.lecturerNo}</Descriptions.Item>
        <Descriptions.Item label="讲师姓名">{lecturer.lecturerName}</Descriptions.Item>
      </Descriptions>

      <Table<TeachingRecord>
        size="small"
        rowKey={(row) => String(row.sessionId)}
        dataSource={rows}
        loading={query.isLoading}
        pagination={false}
        locale={{ emptyText: '还没有授课记录' }}
        columns={showAll ? [...previewColumns, ...extraColumns] : previewColumns}
      />

      {records.length > 0 ? (
        <Button type="link" style={{ padding: 0 }} onClick={() => setShowAll((open) => !open)}>
          {showAll ? '收起授课记录' : '查看全部授课记录'}
        </Button>
      ) : null}
    </Space>
  );
}
