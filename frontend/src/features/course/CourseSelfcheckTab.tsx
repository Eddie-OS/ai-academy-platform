import { useEffect, useState } from 'react';
import { Alert, App, Button, Card, Checkbox, Input, Progress, Space, Tag, Tooltip, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleHelp } from 'lucide-react';
import { ApiError } from '@/shared/api/client';
import { courseApi, type CourseSelfcheckItem } from '@/shared/api/courses';
import { useIsOperator } from '@/shared/store/authStore';
import { neutral, space } from '@/shared/theme/designTokens';
import { useNoteRequirements } from './courseMeta';

const { Text, Title } = Typography;

/**
 * 详情页「CheckList 自检」页签（需求 9.4）。
 *
 * <p>三条容易被"补全"掉的规则，在这里都是有意为之：
 * <ul>
 *   <li><b>自检不设门禁</b>（CK3）：没做完照样能提交评审，界面只提示不阻断。加了阻断会拦住
 *       运营录入历史数据；
 *   <li><b>「必填说明」的条目勾了但没写说明，算未完成</b>（CK2）——否则自检会退化成一排勾；
 *   <li><b>停用的条目不计入分母，但历史勾选照常显示</b>（CK5）：把它从界面上抹掉，
 *       会让「当时检查过什么」这件事凭空消失。
 * </ul>
 */

interface CourseSelfcheckTabProps {
  courseId: number;
}

type Draft = Record<number, { checked: boolean; note: string }>;

export function CourseSelfcheckTab({ courseId }: CourseSelfcheckTabProps) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const isOperator = useIsOperator();
  const [draft, setDraft] = useState<Draft>({});

  const view = useQuery({
    queryKey: ['courses', courseId, 'selfcheck'],
    queryFn: () => courseApi.selfcheck(courseId),
  });

  useEffect(() => {
    if (!view.data) {
      return;
    }
    const next: Draft = {};
    for (const item of view.data.items) {
      next[item.itemId] = { checked: item.checked, note: item.note ?? '' };
    }
    setDraft(next);
  }, [view.data]);

  const save = useMutation({
    mutationFn: () =>
      courseApi.saveSelfcheck(
        courseId,
        // 停用的条目不再提交：后端只接受启用中的条目，历史勾选靠快照与已存记录保留
        (view.data?.items ?? [])
          .filter((item) => item.enabled)
          .map((item) => ({
            itemId: item.itemId,
            checked: draft[item.itemId]?.checked ?? false,
            note: draft[item.itemId]?.note || null,
          })),
      ),
    onSuccess: () => {
      message.success('自检结果已保存');
      void queryClient.invalidateQueries({ queryKey: ['courses', courseId, 'selfcheck'] });
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '保存失败，请重试'),
  });

  const items = view.data?.items ?? [];
  const groups = [...new Set(items.map((item) => item.groupName))];
  const total = view.data?.totalCount ?? 0;
  const completed = view.data?.completedCount ?? 0;

  return (
    <Space direction="vertical" size={space.lg} style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        message="自检不是门禁"
        description="自检没做完照样可以提交评审——是否具备评审条件由线下判断，平台只记录自检结果。完成度也不参与任何指标与灯色计算。"
      />

      <Card size="small">
        <Space size={space.lg} align="center">
          <Progress
            type="circle"
            size={72}
            percent={total === 0 ? 0 : Math.round((completed / total) * 100)}
            format={() => `${completed}/${total}`}
          />
          <div>
            <Title level={5} style={{ margin: 0 }}>
              检查项完成度
            </Title>
            <Text type="secondary">
              分母只算<b>启用中</b>的检查项。标「必填」的条目勾了但没写说明，不算完成。
            </Text>
          </div>
          {isOperator && (
            <Button type="primary" loading={save.isPending} onClick={() => save.mutate()}>
              保存自检结果
            </Button>
          )}
        </Space>
      </Card>

      {groups.map((group) => (
        <Card key={group} size="small" title={group}>
          <Space direction="vertical" size={space.md} style={{ width: '100%' }}>
            {items
              .filter((item) => item.groupName === group)
              .map((item) => (
                <SelfcheckRow
                  key={item.itemId}
                  item={item}
                  editable={isOperator && item.enabled}
                  value={draft[item.itemId] ?? { checked: item.checked, note: item.note ?? '' }}
                  onChange={(value) => setDraft((current) => ({ ...current, [item.itemId]: value }))}
                />
              ))}
          </Space>
        </Card>
      ))}
    </Space>
  );
}

function SelfcheckRow({
  item,
  editable,
  value,
  onChange,
}: {
  item: CourseSelfcheckItem;
  editable: boolean;
  value: { checked: boolean; note: string };
  onChange: (value: { checked: boolean; note: string }) => void;
}) {
  const { none: NOTE_NONE, required: NOTE_REQUIRED } = useNoteRequirements();
  const noteMissing = value.checked && item.noteRequirement === NOTE_REQUIRED && value.note.trim() === '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space.xs }}>
      <Space size={space.xs} align="start">
        <Checkbox
          checked={value.checked}
          disabled={!editable}
          onChange={(e) => onChange({ ...value, checked: e.target.checked })}
        >
          {item.itemText}
        </Checkbox>
        {item.noteRequirement !== NOTE_NONE && (
          <Tag color={item.noteRequirement === NOTE_REQUIRED ? 'warning' : 'default'}>
            说明{item.noteRequirement}
          </Tag>
        )}
        {!item.enabled && (
          <Tooltip title="该检查项已在配置中心停用：不再计入完成度分母，但这门课当时的勾选照常保留">
            <Tag>已停用</Tag>
          </Tooltip>
        )}
        {item.guideText && (
          <Tooltip title={item.guideText}>
            <CircleHelp size={14} color={neutral[500]} />
          </Tooltip>
        )}
      </Space>
      {item.noteRequirement !== NOTE_NONE && (
        <Input.TextArea
          rows={2}
          maxLength={500}
          disabled={!editable}
          status={noteMissing ? 'warning' : undefined}
          placeholder={item.noteRequirement === NOTE_REQUIRED ? '这一项必须写明依据，否则不算完成' : '可补充说明'}
          style={{ marginLeft: 24 }}
          value={value.note}
          onChange={(e) => onChange({ ...value, note: e.target.value })}
        />
      )}
      {noteMissing && (
        <Text type="warning" style={{ marginLeft: 24 }}>
          勾选了但没写说明，这一项不计入完成度。
        </Text>
      )}
    </div>
  );
}
