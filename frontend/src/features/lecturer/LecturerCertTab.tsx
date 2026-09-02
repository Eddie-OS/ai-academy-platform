import { useState } from 'react';
import { Alert, Button, Descriptions, Empty, Popconfirm, Space } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { lecturerApi, type CertificationRecord, type Lecturer } from '@/shared/api/lecturers';
import { ApiError } from '@/shared/api/client';
import { App } from 'antd';
import { space } from '@/shared/theme/designTokens';
import { EM_DASH } from '@/shared/format';
import { useIsOperator } from '@/shared/store/authStore';
import { lecturerCertDisplayOf } from './lecturerDisplay';
import { CertFormModal } from './CertFormModal';

/**
 * 认证记录。九个字段按规格录入，不做认证审批、不改档案、不改卡片推导。
 */

function dash(value: string | null | undefined): string {
  return value?.trim() ? value : EM_DASH;
}

function period(from: string | null, to: string | null): string {
  if (!from && !to) return EM_DASH;
  return `${from ?? EM_DASH} 至 ${to ?? EM_DASH}`;
}

export function LecturerCertTab({ lecturer }: { lecturer: Lecturer }) {
  const { message } = App.useApp();
  const isOperator = useIsOperator();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CertificationRecord | undefined>();

  const list = useQuery({
    queryKey: ['lecturers', lecturer.id, 'certification'],
    queryFn: () => lecturerApi.certificationRecords(lecturer.id),
  });

  const remove = useMutation({
    mutationFn: (recordId: number) => lecturerApi.removeCertification(lecturer.id, recordId),
    onSuccess: () => {
      message.success('认证记录已删除');
      void queryClient.invalidateQueries({ queryKey: ['lecturers', lecturer.id, 'certification'] });
    },
    onError: (error) => message.error(error instanceof ApiError ? error.message : '删除失败，请重试'),
  });

  const records = list.data ?? [];

  return (
    <Space direction="vertical" size={space.md} style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        message="只记录认证结果，不做认证审批"
        description="本条状态只挂在认证台账上。卡片上的认证三值仍由试讲合格与培养状态推出，不落库、两条线不自动同步。"
      />
      <Descriptions size="small" column={1}>
        <Descriptions.Item label="讲师ID">{lecturer.lecturerNo}</Descriptions.Item>
        <Descriptions.Item label="讲师姓名">{lecturer.lecturerName}</Descriptions.Item>
        <Descriptions.Item label="当前认证状态">
          {lecturerCertDisplayOf(lecturer.trialQualified, lecturer.trainingState)}
        </Descriptions.Item>
      </Descriptions>

      {isOperator ? (
        <Button size="small" icon={<Plus size={14} />} onClick={() => setCreating(true)}>
          新建认证记录
        </Button>
      ) : null}

      {records.length === 0 ? (
        <Empty description="暂无认证记录" />
      ) : (
        records.map((row) => (
          <article key={row.id} data-testid="cert-record">
            <Space size={space.xs} wrap>
              <strong>{row.certState}</strong>
              {isOperator ? (
                <>
                  <Button size="small" icon={<Pencil size={14} />} onClick={() => setEditing(row)}>
                    编辑
                  </Button>
                  <Popconfirm
                    title="删除这条认证记录？"
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
                { key: 'batch', label: '认证批次', children: dash(row.certBatch) },
                { key: 'level', label: '讲师等级', children: dash(row.lecturerLevel) },
                { key: 'state', label: '认证状态', children: row.certState },
                { key: 'reviewers', label: '评审人', children: dash(row.reviewers) },
                { key: 'opinion', label: '认证意见', children: dash(row.opinion) },
                { key: 'passed', label: '认证通过时间', children: dash(row.passedOn) },
                { key: 'valid', label: '认证有效期', children: period(row.validFrom, row.validTo) },
              ]}
            />
          </article>
        ))
      )}

      {creating ? (
        <CertFormModal
          open
          lecturer={lecturer}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            void queryClient.invalidateQueries({ queryKey: ['lecturers', lecturer.id, 'certification'] });
          }}
        />
      ) : null}
      {editing ? (
        <CertFormModal
          open
          lecturer={lecturer}
          record={editing}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined);
            void queryClient.invalidateQueries({ queryKey: ['lecturers', lecturer.id, 'certification'] });
          }}
        />
      ) : null}
    </Space>
  );
}
