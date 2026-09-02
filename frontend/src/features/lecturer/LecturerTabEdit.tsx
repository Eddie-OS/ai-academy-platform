import { Pencil } from 'lucide-react';
import './LecturerTabEdit.css';

/**
 * 讲师详情每个子页签右上角的「编辑」。
 *
 * <p>规格要求每个子页都有入口，不要求人先切回「基本信息」。回归模式不渲染。
 * 用户账号按 PMI-5 不出现写入口，由调用方决定是否挂上。
 */
export function LecturerTabEdit({ onEdit }: { onEdit: () => void }) {
  return (
    <div className="lct-tab-edit-bar">
      <button type="button" className="lct-tab-edit" data-testid="lecturer-tab-edit" onClick={onEdit}>
        <Pencil size={13} aria-hidden />
        编辑
      </button>
    </div>
  );
}
