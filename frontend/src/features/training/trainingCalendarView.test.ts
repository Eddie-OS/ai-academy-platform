import { describe, expect, it } from 'vitest';
import {
  filterFixtureSessions,
  isoDate,
  sessionCourseName,
  sessionIntro,
  sessionLecturer,
  sessionsOnDay,
  toCalendarSession,
  visibleDateRange,
} from './trainingCalendarView';
import type { TrainingSession } from '@/shared/api/trainings';
import type { CalendarSession } from '@/fixtures/training';

const sample: CalendarSession = {
  id: '1',
  title: 'AI 工具实战',
  time: '09:00',
  meta: '线上 · 李明',
  date: '2026-06-15',
  state: '待开课',
  day: 15,
};

describe('trainingCalendarView', () => {
  it('翻到指定月时区间落在那个月', () => {
    const range = visibleDateRange('月', 2026, 6, 1);
    expect(range.dateFrom <= '2026-06-01').toBe(true);
    expect(range.dateTo >= '2026-06-30').toBe(true);
  });

  it('按真实日期挂格，六月的场次不会出现在七月', () => {
    expect(sessionsOnDay([sample], 2026, 6, 15)).toHaveLength(1);
    expect(sessionsOnDay([sample], 2026, 7, 15)).toHaveLength(0);
  });

  it('搜索命中课程名或讲师', () => {
    const empty = { keyword: '', planState: '', sessionState: '', archived: '' as const };
    expect(filterFixtureSessions([sample], { ...empty, keyword: '李明' })).toHaveLength(1);
    expect(filterFixtureSessions([sample], { ...empty, keyword: '不存在' })).toHaveLength(0);
  });

  it('isoDate 能跨月', () => {
    expect(isoDate(2026, 1, 0)).toBe('2025-12-31');
  });

  it('场次条按视图取课名、讲师与介绍', () => {
    expect(sessionCourseName(sample)).toBe('AI 工具实战');
    expect(sessionLecturer(sample)).toBe('李明');
    expect(sessionIntro(sample)).toBe('—');
    expect(sessionIntro({ ...sample, intro: '痛点 / 写法 / 练习' })).toBe('痛点 / 写法 / 练习');
  });

  it('接口场次映射出课名、讲师与课程介绍', () => {
    const mapped = toCalendarSession({
      id: 9,
      sessionNo: 'JH-9',
      planId: 1,
      planNo: 'P-1',
      planName: '计划',
      sessionName: '场次名',
      courseId: 2,
      courseName: 'Prompt 进阶',
      courseIntro: '痛点 / 写法 / 练习',
      lecturerId: 3,
      lecturerName: '周建',
      trainingDate: '2026-06-16',
      startTime: '14:00:00',
      endTime: '16:00:00',
      durationHours: '2.0',
      trainingForm: '线上',
      venue: null,
      onlineLink: null,
      studentScope: '',
      planAttendeeCount: 20,
      actualAttendeeCount: 0,
      attendanceImported: false,
      sessionState: '待开课',
      remark: null,
      lastStateChangedAt: null,
      updatedAt: '2026-06-01T00:00:00+08:00',
      updatedBy: 'operator',
    } as TrainingSession);
    expect(mapped.courseName).toBe('Prompt 进阶');
    expect(mapped.lecturer).toBe('周建');
    expect(mapped.intro).toBe('痛点 / 写法 / 练习');
    expect(mapped.time).toBe('14:00');
  });
});
