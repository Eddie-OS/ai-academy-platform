import { LECTURER_CULTIVATION_STATES } from '@/fixtures/lecturer';

/**
 * 卡上／详情用的认证展示。不是认证体系，勿落到 fixtures（V-7 禁「待认证」）。
 *
 * <p>由试讲合格与培养状态推出：合格→已认证；培养中且未合格→认证中；其余→待认证。
 */
export const CERT_DISPLAY_PENDING = '待认证';
export const CERT_DISPLAY_IN_PROGRESS = '认证中';
export const CERT_DISPLAY_CERTIFIED = '已认证';
export const LECTURER_CERT_DISPLAY = [CERT_DISPLAY_PENDING, CERT_DISPLAY_IN_PROGRESS, CERT_DISPLAY_CERTIFIED] as const;

const CULTIVATING = LECTURER_CULTIVATION_STATES[1];

export function lecturerCertDisplayOf(trialQualified: boolean, cultivation?: string | null): string {
  if (trialQualified) return CERT_DISPLAY_CERTIFIED;
  if (cultivation === CULTIVATING) return CERT_DISPLAY_IN_PROGRESS;
  return CERT_DISPLAY_PENDING;
}
