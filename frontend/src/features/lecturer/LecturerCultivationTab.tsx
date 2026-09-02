import { useState } from 'react';
import { Alert, Button, Descriptions, Empty, Popconfirm, Space } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { lecturerApi, type CultivationRecord, type Lecturer } from '@/shared/api/lecturers';
import { ApiError } from '@/shared/api/client';
import { App } from 'antd';
import { space } from '@/shared/theme/designTokens';
import { EM_DASH } from '@/shared/format';
import { useIsOperator } from '@/shared/store/authStore';
import { CultivationFormModal } from './CultivationFormModal';

/**
 * 培养计划与培养记录。十个字段按规格录入，不做培养引擎、不改档案培养状态。
 */

function dash(value: string | null | undefined): string {
  return value?.trim() ? value : EM_DASH;
}

function period(from: string | null, to: string | null): string {
  if (!from && !to) return EM_DASH;
  return `${from ?? EM_DASH} 至 ${to ?? EM_DASH}`;
}

export function LecturerCultivationTab({ lecturer }: { lecturer: Lecturer }) {
  const { message } = App.useApp();
  const isOperator = useIsOperator();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CultivationRecord | undefined>();

  const list = useQuery({
    queryKey: ['lecturers', lecturer.id, 'cultivation'],
    queryFn: () => lecturerApi.cultivationRecords(lecturer.id),
  });

  const remove = useMutation({
    mutationFn: (recordId: number) => lecturerApi.removeCultivation(lecturer.id, recordId),
    onSuccess: () => {
      message.success('培养记录已删除');
      void queryClient.invalidateQueries({ queryKey: ['lecturers', lecturer.id, 'cultivation'] });
    },
    onError: (error) => message.error(error instanceof ApiError ? error.message : '删除失败，请重试'),
  });

  const records = list.data ?? [];

  return (
    <Space direction="vertical" size={space.md} style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        message="只记录培养结果，不做培养计划引擎"
        description="培养类型与本条状态在这里手填。档案上的培养状态仍只服务排课，两条线不自动同步。"
      />
      <Descriptions size="small" column={1}>
        <Descriptions.Item label="讲师ID">{lecturer.lecturerNo}</Descriptions.Item>
        <Descriptions.Item label="讲师姓名">{lecturer.lecturerName}</Descriptions.Item>
        <Descriptions.Item label="档案培养状态">{lecturer.trainingState || EM_DASH}</Descriptions.Item>
      </Descriptions>

      {isOperator ? (
        <Button size="small" icon={<Plus size={14} />} onClick={() => setCreating(true)}>
          新建培养记录
        </Button>
      ) : null}

      {records.length === 0 ? (
        <Empty description="暂无培养计划与培养记录" />
      ) : (
        records.map((row) => (
          <article key={row.id} data-testid="cultivation-record">
            <Space size={space.xs} wrap>
              <strong>{row.planState}</strong>
              {isOperator ? (
                <>
                  <Button size="small" icon={<Pencil size={14} />} onClick={() => setEditing(row)}>
                    编辑
                  </Button>
                  <Popconfirm
                    title="删除这条培养记录？"
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
                { key: 'plan', label: '培养计划', children: dash(row.planText) },
                { key: 'planned', label: '计划培养周期', children: period(row.plannedFrom, row.plannedTo) },
                {
                  key: 'types',
                  label: '培养类型',
                  children: row.cultivationTypes.length ? row.cultivationTypes.join('、') : EM_DASH,
                },
                { key: 'record', label: '培养记录', children: dash(row.recordText) },
                { key: 'actual', label: '实际培养周期', children: period(row.actualFrom, row.actualTo) },
                { key: 'state', label: '培养状态', children: row.planState },
                { key: 'eval', label: '培养评价', children: dash(row.evaluation) },
                { key: 'remark', label: '备注', children: dash(row.remark) },
              ]}
            />
          </article>
        ))
      )}

      {creating ? (
        <CultivationFormModal
          open
          lecturer={lecturer}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            void queryClient.invalidateQueries({ queryKey: ['lecturers', lecturer.id, 'cultivation'] });
          }}
        />
      ) : null}
      {editing ? (
        <CultivationFormModal
          open
          lecturer={lecturer}
          record={editing}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined);
            void queryClient.invalidateQueries({ queryKey: ['lecturers', lecturer.id, 'cultivation'] });
          }}
        />
      ) : null}
    </Space>
  );
}
