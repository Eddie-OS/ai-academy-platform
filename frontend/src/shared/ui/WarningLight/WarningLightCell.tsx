import { WarningLight, redLightReasonOf, type WarningLightColor } from './WarningLight';

/** 列表行上的灯色三字段（与后端 VO 对齐）。 */
export interface LightFields {
  light?: string | null;
  lightDays?: number | null;
  lightReason?: string | null;
}

const API_COLORS = new Set<WarningLightColor>(['BLUE', 'YELLOW', 'RED', 'NONE']);

/**
 * DataTable 灯色列：NONE／缺省 → null（表格渲染「—」）；其余走 {@link WarningLight}。
 *
 * <p>红灯成因取后端 {@code lightReason}（「已逾期」／「状态停滞」），映射到 {@code OVERDUE}/{@code STALLED}。
 */
export function WarningLightCell({ light, lightDays, lightReason }: LightFields) {
  if (!light || !API_COLORS.has(light as WarningLightColor) || light === 'NONE') {
    return null;
  }
  const days = lightDays ?? 0;
  if (light === 'RED') {
    return <WarningLight color="RED" reason={redLightReasonOf(lightReason)} days={days} short />;
  }
  return <WarningLight color={light as 'BLUE' | 'YELLOW'} days={days} short />;
}
