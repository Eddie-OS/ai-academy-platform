/**
 * 数字与日期排版（设计基础规范 3.3）。
 *
 * <p>这些规则散在各页面写必然走偏：一处显示到秒、一处不显示，一处空值是空白、一处是 `-`。
 */

/** 空值统一 `—`（U+2014）。0 与 false 不是空值。 */
export const EM_DASH = '—';

/** 日期时间 `YYYY-MM-DD HH:mm`，<b>不显示秒</b>。入参是后端给的 ISO-8601 带时区串。 */
export function formatDateTime(value: string | null | undefined): string {
  return value ? value.slice(0, 16).replace('T', ' ') : EM_DASH;
}

/**
 * 时刻 `HH:mm`。培训场次的起止时间在库里是 `TIME` 类型，后端给的是 `14:00:00`。
 *
 * <p>秒对培训排期没有意义，而日历卡片上每条都多出三个字符，一格里就少放一场。
 */
export function formatTime(value: string | null | undefined): string {
  return value ? value.slice(0, 5) : EM_DASH;
}
