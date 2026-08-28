import { FIELD_ENUM_KEYS } from '@/shared/api/meta';
import { useFieldEnums } from '@/shared/meta/metaHooks';

/**
 * 五个驾驶舱共用的领域取值，与后端 {@code BusinessDomains.NAMES}／
 * {@code /api/meta/field-enums} 的「需求所属领域」同序。
 *
 * <p>旧进程还没下发这个键时表单不能只剩空下拉，所以留一份与后端相同的兜底。
 */
export const BUSINESS_DOMAIN_VALUES = ['零售', 'GTM', '电商', 'MKT', '服务', '渠道', '政企'] as const;

export function useBusinessDomains(): string[] {
  const enums = useFieldEnums();
  const fromMeta = enums.data?.[FIELD_ENUM_KEYS.demandDomain];
  return fromMeta && fromMeta.length > 0 ? fromMeta : [...BUSINESS_DOMAIN_VALUES];
}

/**
 * 作战单元编码／名称 → 现场领域。与 {@code V5_005}／{@code V5_012} 同一张对照表。
 * 列表在库还没迁完时也必须显示零售／MKT，不能再翻成「AI需求／课程」。
 */
export const LEGACY_DOMAIN_TO_BUSINESS: Record<string, string> = {
  AI_DEMAND: 'GTM',
  COURSE: '零售',
  TRAINER: '渠道',
  LECTURER: '渠道',
  TRAINING: '服务',
  CASE: '政企',
  AI需求: 'GTM',
  课程: '零售',
  讲师: '渠道',
  培训: '服务',
  案例: '政企',
};

/** 已是现场领域名则原样；历史作战单元编码／名称翻成零售／MKT 等。 */
export function useDomainLabel(): (code: string | null | undefined) => string | null {
  const domains = useBusinessDomains();
  return (code) => {
    if (!code) return null;
    if (domains.includes(code)) return code;
    return LEGACY_DOMAIN_TO_BUSINESS[code] ?? code;
  };
}

export function domainSelectOptions(domains: string[]) {
  return domains.map((domain) => ({ value: domain, label: domain }));
}
