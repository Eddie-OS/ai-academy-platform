import { describe, expect, it } from 'vitest';
import { currentDateText, formatMonthDayWeekday, withCurrentCalendar, withCurrentDates } from './fixtureClock';

/*
 * 这些用例跑在 jsdom 下、地址栏没有 ?fixture=1，所以走的是产品模式那条分支。
 * 回归模式那条分支由视觉回归的 143 条用例覆盖：基线截图比对的就是冻结值本身，
 * 只要平移误伤了回归模式，九张基线会立刻全红。
 */

/** 2026-08-05，与设计稿基准 2024-06-10 相差 786 天 */
const NOW = new Date(2026, 7, 5);

describe('fixture 日期平移', () => {
  it('把设计稿基准日挪到今天', () => {
    expect(withCurrentDates('2024-06-10', NOW)).toBe('2026-08-05');
  });

  it('保持日期之间的相对关系', () => {
    // fixture 里写死着「剩余 2 天」这类文案，两个日期必须一起挪同样的天数
    expect(withCurrentDates(['2024-06-10', '2024-06-12'], NOW)).toEqual(['2026-08-05', '2026-08-07']);
  });

  it('training 那批按自己的基准日挪', () => {
    // 2026-08-04 是 training.ts 的基准日，挪到今天是 +1 天
    expect(withCurrentDates('2026-08-09', NOW)).toBe('2026-08-10');
  });

  it('保留时分', () => {
    expect(withCurrentDates('2024-06-10 14:30', NOW)).toBe('2026-08-05 14:30');
  });

  it('重算星期而不是照抄', () => {
    // 2024-06-12 是周三，挪 786 天之后是周五。照抄会得到自相矛盾的日期
    expect(withCurrentDates('2024-06-12（周三）', NOW)).toBe('2026-08-07（周五）');
  });

  it('替换句子里嵌着的日期', () => {
    expect(withCurrentDates('数据统计截止 2024-06-10，共 12 项待办需要跟进。', NOW)).toBe(
      '数据统计截止 2026-08-05，共 12 项待办需要跟进。',
    );
  });

  it('整串是 MM-dd 时按设计稿基准年补年份', () => {
    expect(withCurrentDates('06-10', NOW)).toBe('08-05');
  });

  it('挪编号里嵌着的日期', () => {
    expect(withCurrentDates('TASK-2024-0612-001', NOW)).toBe('TASK-2026-0807-001');
    expect(withCurrentDates('KC-2024-0518', NOW)).toBe('KC-2026-0713');
    expect(withCurrentDates('ST20240610001', NOW)).toBe('ST20260805001');
    expect(withCurrentDates('T-2405-09', NOW)).toBe('T-2607-04');
  });

  /*
   * 这条防的是把编号当日期改坏。JH-D13-01 的「13-01」和一个 MM-dd 长得完全一样，
   * 而它改坏之后仍然是一个合法编号——列表照常渲染，只有点开详情才发现对不上。
   */
  it('不动编号里长得像日期的数字段', () => {
    expect(withCurrentDates('JH-D13-01', NOW)).toBe('JH-D13-01');
    expect(withCurrentDates('JH2026080005-02', NOW)).toBe('JH2026080005-02');
  });

  it('不动非日期字段', () => {
    expect(withCurrentDates({ owner: '李玥', value: '1,268', remaining: '剩余 2 天' }, NOW)).toEqual({
      owner: '李玥',
      value: '1,268',
      remaining: '剩余 2 天',
    });
  });

  it('深入嵌套结构', () => {
    expect(withCurrentDates({ rows: [{ deadline: '2024-06-12' }] }, NOW)).toEqual({
      rows: [{ deadline: '2026-08-07' }],
    });
  });
});

describe('月历锚点平移', () => {
  const FROZEN = { year: 2024, month: 6, selectedDate: '2024-06-12', scheduledDays: [3, 12, 27] };

  it('年月跟着选中日走', () => {
    const moved = withCurrentCalendar(FROZEN, NOW);
    expect(moved.selectedDate).toBe('2026-08-07');
    expect(moved.year).toBe(2026);
    expect(moved.month).toBe(8);
  });

  /*
   * 平移之后有些打点日会落到隔壁月份。留着的话会画在错误的格子上，
   * 而画错的点和画对的点长得一模一样，截图上看不出来。
   */
  it('丢掉跨出当月的打点日', () => {
    const moved = withCurrentCalendar(FROZEN, NOW);
    expect(moved.scheduledDays.every((day) => day >= 1 && day <= 31)).toBe(true);
    expect(moved.scheduledDays).not.toContain(27);
  });
});

describe('展示串', () => {
  it('星期由日期算出来', () => {
    expect(formatMonthDayWeekday('2026-08-07')).toBe('08 月 07 日（周五）');
  });

  it('单串平移与整份平移同口径', () => {
    expect(currentDateText('2026-08-09 13:20', NOW)).toBe('2026-08-10 13:20');
  });
});
