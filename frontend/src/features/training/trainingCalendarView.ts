import {
  CALENDAR_SESSIONS,
  sessionMatchesArchive,
  type CalendarSession,
  type SessionState,
  type TrainingView,
} from '@/fixtures/training';
import type { TrainingSession } from '@/shared/api/trainings';

export const CALENDAR_PAGE_SIZE = 200;

export interface TrainingProductFilter {
  keyword: string;
  planState: string;
  sessionState: string;
  archived: '' | 'true' | 'false';
}

export const EMPTY_TRAINING_FILTER: TrainingProductFilter = {
  keyword: '',
  planState: '',
  sessionState: '',
  archived: '',
};

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function isoDate(year: number, month: number, day: number): string {
  const next = new Date(year, month - 1, day);
  return `${next.getFullYear()}-${pad2(next.getMonth() + 1)}-${pad2(next.getDate())}`;
}

function shiftDate(year: number, month: number, day: number, delta: number) {
  const next = new Date(year, month - 1, day + delta);
  return { year: next.getFullYear(), month: next.getMonth() + 1, day: next.getDate() };
}

/** 选中日所在周一～周日。 */
export function weekBounds(year: number, month: number, selectedDay: number) {
  const firstWeekday = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const selectedOffset = firstWeekday + selectedDay - 1;
  const weekStartOffset = selectedOffset - (selectedOffset % 7);
  const startDay = weekStartOffset - firstWeekday + 1;
  const start = shiftDate(year, month, 1, startDay - 1);
  const end = shiftDate(start.year, start.month, start.day, 6);
  return { start, end };
}

/**
 * 当前视图要向接口要的日期区间。
 *
 * <p>月视图把首尾补白格也包进去，翻到邻月尾巴的场次不会空着。
 */
export function visibleDateRange(
  view: TrainingView,
  year: number,
  month: number,
  selectedDay: number,
): { dateFrom: string; dateTo: string } {
  if (view === '日') {
    const day = isoDate(year, month, selectedDay);
    return { dateFrom: day, dateTo: day };
  }
  if (view === '周') {
    const { start, end } = weekBounds(year, month, selectedDay);
    return { dateFrom: isoDate(start.year, start.month, start.day), dateTo: isoDate(end.year, end.month, end.day) };
  }
  const firstWeekday = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();
  const weekCount = Math.ceil((firstWeekday + daysInMonth) / 7);
  const trailing = weekCount * 7 - firstWeekday - daysInMonth;
  const from = shiftDate(year, month, 1, -firstWeekday);
  const to = shiftDate(year, month, daysInMonth, trailing);
  return { dateFrom: isoDate(from.year, from.month, from.day), dateTo: isoDate(to.year, to.month, to.day) };
}

export function toCalendarSession(session: TrainingSession): CalendarSession {
  const [, , dayText] = session.trainingDate.split('-');
  const time = session.startTime.length >= 5 ? session.startTime.slice(0, 5) : session.startTime;
  const lecturer = session.lecturerName?.trim() ?? '';
  const courseName = session.courseName?.trim() || session.sessionName?.trim() || session.sessionNo;
  return {
    id: String(session.id),
    title: courseName,
    time,
    meta: [session.trainingForm, lecturer].filter(Boolean).join(' · '),
    courseName,
    lecturer,
    intro: session.courseIntro?.trim() || undefined,
    date: session.trainingDate,
    state: session.sessionState as SessionState,
    day: Number(dayText),
  };
}

export function sessionCourseName(session: CalendarSession): string {
  return session.courseName?.trim() || session.title;
}

export function sessionLecturer(session: CalendarSession): string {
  if (session.lecturer?.trim()) return session.lecturer.trim();
  const parts = session.meta.split(' · ');
  return parts.length > 1 ? (parts[parts.length - 1] ?? '') : '';
}

export function sessionIntro(session: CalendarSession): string {
  const intro = session.intro?.trim();
  return intro && intro.length > 0 ? intro : '—';
}

export function filterFixtureSessions(
  sessions: readonly CalendarSession[],
  filter: TrainingProductFilter,
): CalendarSession[] {
  const keyword = filter.keyword.trim().toLowerCase();
  return sessions.filter((session) => {
    if (filter.sessionState && session.state !== filter.sessionState) return false;
    if (filter.archived === 'true' && !sessionMatchesArchive(session.state, true)) return false;
    if (filter.archived === 'false' && !sessionMatchesArchive(session.state, false)) return false;
    if (keyword) {
      const hay = `${session.title} ${session.meta}`.toLowerCase();
      if (!hay.includes(keyword)) return false;
    }
    return true;
  });
}

export function sessionsOnDay(
  sessions: readonly CalendarSession[],
  year: number,
  month: number,
  day: number,
  monthOffset = 0,
): CalendarSession[] {
  const target = isoDate(year, month + monthOffset, day);
  return sessions.filter((session) => {
    if (session.date) return session.date === target;
    return session.day === day && (session.monthOffset ?? 0) === monthOffset;
  });
}

/** 月历首行补白：真日期优先，冻数仍按格位挂。 */
export function sessionsOnPrevPad(
  sessions: readonly CalendarSession[],
  year: number,
  month: number,
  day: number,
  padIndex: number,
): CalendarSession[] {
  const dated = sessionsOnDay(sessions, year, month, day, -1);
  if (dated.some((session) => session.date)) return dated;
  return sessions.filter(
    (session) =>
      !session.date &&
      (session.monthOffset ?? 0) === -1 &&
      (session.prevWeekday != null ? session.prevWeekday === padIndex : session.day === day),
  );
}

export function fixtureCalendarSessions(filter: TrainingProductFilter): CalendarSession[] {
  return filterFixtureSessions(CALENDAR_SESSIONS, filter);
}
