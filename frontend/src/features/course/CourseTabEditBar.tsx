import { useEffect, useState } from 'react';
import { Button, Space } from 'antd';
import { Pencil, Save, X } from 'lucide-react';
import { space } from '@/shared/theme/designTokens';

/**
 * 课程详情各页签共用的「查看 / 编辑」条。默认只读，运营点编辑后再改。
 */
export function CourseTabEditBar({
  editing,
  saving,
  saveDisabled,
  onEdit,
  onCancel,
  onSave,
}: {
  editing: boolean;
  saving?: boolean;
  saveDisabled?: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  if (editing) {
    return (
      <Space size={space.xs} className="crs-tab-edit-bar">
        <Button size="small" icon={<X size={14} />} onClick={onCancel}>
          取消
        </Button>
        <Button
          size="small"
          type="primary"
          icon={<Save size={14} />}
          loading={saving}
          disabled={saveDisabled}
          onClick={onSave}
        >
          保存
        </Button>
      </Space>
    );
  }
  return (
    <Button size="small" icon={<Pencil size={13} />} onClick={onEdit} className="crs-tab-edit-bar">
      编辑
    </Button>
  );
}

/** 换一门课时退出编辑，避免把上一门的草稿带到下一门。 */
export function useCourseTabEditing(courseId: number) {
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    setEditing(false);
  }, [courseId]);
  return { editing, setEditing };
}
