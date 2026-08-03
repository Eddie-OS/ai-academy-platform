import { AttachmentField } from '@/shared/ui/AttachmentField';

/**
 * 需求上的多附件字段（评审会议纪要、解决方案附件，需求 8.3.2 第 18 项、8.3.3 第 23 项）。
 *
 * <p>上传、建引用、下载、移除的逻辑在 {@link AttachmentField}——培训归档也有三个同样的字段
 * （需求 11.6），照抄一份的代价是「建引用」这一步会在其中一处被漏掉，而漏了不报错：
 * 附件 24 小时后被当孤儿清理，界面上仍挂着文件名。
 */

/** 附件归属类型，与后端 {@code AttachmentOwnerType.DEMAND} 一致；它只决定文件落在哪个子目录。 */
const ATTACHMENT_OWNER_TYPE = 'DEMAND';

/** 引用字段名，与 {@code sys_attachment_ref.ref_field} 的列注释一致。同一对象的多个附件字段靠它区分。 */
export const DEMAND_REF_FIELDS = {
  reviewMinutes: 'review_minutes',
  solutionFiles: 'solution_files',
} as const;

interface DemandAttachmentsProps {
  demandId: number;
  refField: string;
  emptyHint: string;
}

export function DemandAttachments({ demandId, refField, emptyHint }: DemandAttachmentsProps) {
  return (
    <AttachmentField
      ownerType={ATTACHMENT_OWNER_TYPE}
      ownerId={demandId}
      refField={refField}
      emptyHint={emptyHint}
    />
  );
}
