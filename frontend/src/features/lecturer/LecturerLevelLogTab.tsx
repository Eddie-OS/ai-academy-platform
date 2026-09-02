import { useState } from 'react';
import { Alert, Button, Descriptions, Empty, Popconfirm, Space } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { lecturerApi, type Lecturer, type LevelLogRecord } from '@/shared/api/lecturers';
import { ApiError } from '@/shared/api/client';
import { App } from 'antd';
import { space } from '@/shared/theme/designTokens';
import { EM_DASH, formatDateTime } from '@/shared/format';
import { useIsOperator } from '@/shared/store/authStore';
import { LevelLogFormModal } from './LevelLogFormModal';

/**
 * 等级变更记录。只落库，不改档案等级、不写状态流转日志。
 */

function dash(value: string | null | undefined): string {
  return value?.trim() ? value : EM_DASH;
}

export function LecturerLevelLogTab({ lecturer }: { lecturer: Lecturer }) {
  const { message } = App.useApp();
  const isOperator = useIsOperator();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<LevelLogRecord | undefined>();

  const list = useQuery({
    queryKey: ['lecturers', lecturer.id, 'level-logs'],
    queryFn: () => lecturerApi.levelLogs(lecturer.id),
  });

  const remove = useMutation({
    mutationFn: (recordId: number) => lecturerApi.removeLevelLog(lecturer.id, recordId),
    onSuccess: () => {
      message.success('等级变更记录已删除');
      void queryClient.invalidateQueries({ queryKey: ['lecturers', lecturer.id, 'level-logs'] });
    },
    onError: (error) => message.error(error instanceof ApiError ? error.message : '删除失败，请重试'),
  });

  const records = list.data ?? [];

  return (
    <Space direction="vertical" size={space.md} style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        message="只记录等级变更结果，不做评估模型"
        description="变更后等级只挂在本条记录上，不自动改档案等级，也不写状态流转日志。"
      />
      <Descriptions size="small" column={1}>
        <Descriptions.Item label="讲师ID">{lecturer.lecturerNo}</Descriptions.Item>
        <Descriptions.Item label="讲师姓名">{lecturer.lecturerName}</Descriptions.Item>
        <Descriptions.Item label="当前等级">{lecturer.lecturerLevel || EM_DASH}</Descriptions.Item>
      </Descriptions>

      {isOperator ? (
        <Button size="small" icon={<Plus size={14} />} onClick={() => setCreating(true)}>
          新建等级变更记录
        </Button>
      ) : null}

      {records.length === 0 ? (
        <Empty description="暂无等级变更记录" />
      ) : (
        records.map((row) => (
          <article key={row.id} data-testid="level-log-record">
            <Space size={space.xs} wrap>
              <strong>{row.changeNo}</strong>
              <span>{row.levelAfter}</span>
              {isOperator ? (
                <>
                  <Button size="small" icon={<Pencil size={14} />} onClick={() => setEditing(row)}>
                    编辑
                  </Button>
                  <Popconfirm
                    title="删除这条等级变更记录？"
                    okText="删除"
                    cancelText="取消"
                    onConfirm={() => remove.mutate(row.id)}
                  >
                    <Button size="small" danger icon={<Trash2 size={14} />}>
                      删除
                    </Button>
                  </Popconfirm>
                </>
              ) : null}
            </Space>
            <Descriptions
              size="small"
              column={1}
              items={[
                { key: 'no', label: '变更记录编号', children: row.changeNo },
                { key: 'reason', label: '变更触发原因', children: dash(row.triggerReason) },
                { key: 'desc', label: '等级变更说明', children: dash(row.changeDesc) },
                { key: 'on', label: '等级变更时间', children: dash(row.changedOn) },
                { key: 'after', label: '变更后等级', children: row.levelAfter },
                { key: 'reviewer', label: '评审人', children: dash(row.reviewer) },
                { key: 'comment', label: '评审意见', children: dash(row.reviewComment) },
                { key: 'creator', label: '记录创建人', children: dash(row.createdBy) },
                { key: 'updated', label: '记录更新时间', children: formatDateTime(row.updatedAt) },
              ]}
            />
          </article>
        ))
      )}

      {creating ? (
        <LevelLogFormModal
          open
          lecturer={lecturer}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            void queryClient.invalidateQueries({ queryKey: ['lecturers', lecturer.id, 'level-logs'] });
          }}
        />
      ) : null}
      {editing ? (
        <LevelLogFormModal
          open
          lecturer={lecturer}
          record={editing}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined);
            void queryClient.invalidateQueries({ queryKey: ['lecturers', lecturer.id, 'level-logs'] });
          }}
        />
      ) : null}
    </Space>
  );
}
