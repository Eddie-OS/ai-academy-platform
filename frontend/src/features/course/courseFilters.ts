import type { QueryClient } from '@tanstack/react-query';
import { invalidateCourseGraph } from '@/shared/query/invalidateGraph';
import type { Course, CourseFilter } from '@/shared/api/courses';
import type { CourseCard, CourseKpiId } from '@/fixtures/course';
import { COURSE_BOARD, COURSE_KPIS } from '@/fixtures/course';

/**
 * 课程工作台筛选条的受控状态。
 *
 * <p>七个下拉 + 课程 ID／名称搜索，是业务指定的工作台筛选项。
 * 需求 9.10 其余条件（负责人、有效期、精品标注、时间区间）不在这一行。
 * {@code mainState} 不出现在筛选条，只由顶部五张卡点选写入，与列表同一口径。
 */
export interface CourseWorkbenchFilter {
  keyword: string;
  domainCode: string;
  categoryCode: string;
  mainState: string;
  devState: string;
  selfcheckState: string;
  reviewRecordState: string;
  trialState: string;
  light: string;
}

export const EMPTY_COURSE_FILTER: CourseWorkbenchFilter = {
  keyword: '',
  domainCode: '',
  categoryCode: '',
  mainState: '',
  devState: '',
  selfcheckState: '',
  reviewRecordState: '',
  trialState: '',
  light: '',
};

export const COURSE_QUANTITY_QUERY_KEY = ['metrics', 'quantity', 'courses'] as const;
export const COURSE_MONTHLY_OVERVIEW_QUERY_KEY = ['metrics', 'efficiency', 'course-monthly-overview'] as const;

/**
 * 列表与工作台五张卡同一份库数据：写课程后两边一起重算。
 *
 * <p>总看板、三色灯明细、任务中心读的也是这份数据，由 {@link invalidateCourseGraph}
 * 一并带上——只刷本页会让总看板的「已发布课程」停在改动之前那个数。
 */
export function invalidateCourseListAndMetrics(queryClient: QueryClient) {
  invalidateCourseGraph(queryClient);
}

/**
 * 工作台卡对应的主状态。取值来自看板列定义，页面源码不手写状态字面量（STK-1）。
 * 「课程总数」没有主状态，返回空串，点它等于清掉主状态筛。
 */
export function courseKpiMainState(kpiId: CourseKpiId): string {
  const kpi = COURSE_KPIS.find((item) => item.id === kpiId);
  if (!kpi?.column) return '';
  return COURSE_BOARD.find((column) => column.id === kpi.column)?.states[0] ?? '';
}

export function selectedCourseKpiId(filter: CourseWorkbenchFilter): CourseKpiId {
  if (filter.mainState === '') return 'total';
  const match = COURSE_KPIS.find((kpi) => courseKpiMainState(kpi.id) === filter.mainState);
  return match?.id ?? 'total';
}

/** 点卡：只保留该卡主状态，其它筛清空，列表条数才能跟卡上数字对上。 */
export function filterForCourseKpi(kpiId: CourseKpiId): CourseWorkbenchFilter {
  return { ...EMPTY_COURSE_FILTER, mainState: courseKpiMainState(kpiId) };
}

export function toCourseApiFilter(filter: CourseWorkbenchFilter): CourseFilter {
  const blankToNull = (value: string) => (value.trim() === '' ? null : value);
  return {
    keyword: blankToNull(filter.keyword),
    domainCode: blankToNull(filter.domainCode),
    categoryCode: blankToNull(filter.categoryCode),
    mainState: blankToNull(filter.mainState),
    devState: blankToNull(filter.devState),
    selfcheckState: blankToNull(filter.selfcheckState),
    reviewRecordState: blankToNull(filter.reviewRecordState),
    trialState: blankToNull(filter.trialState),
    light: blankToNull(filter.light),
  };
}

export function isCourseFilterActive(filter: CourseWorkbenchFilter): boolean {
  return Object.values(filter).some((value) => value.trim() !== '');
}

export interface LiveCourseCard extends CourseCard {
  liveId: number;
}

export function courseToBoardCard(course: Course): LiveCourseCard {
  return {
    id: course.courseNo,
    name: course.courseName,
    owner: course.ownerName ?? course.ownerNo,
    light: (course.light as CourseCard['light']) || 'NONE',
    lightReason:
      course.light === 'RED'
        ? course.lightReason?.includes('停滞')
          ? 'STALLED'
          : 'OVERDUE'
        : undefined,
    stalledDays: course.lightDays,
    liveId: course.id,
  };
}

/**
 * 演示站没有课程接口，把看板冻数摊成产品列表要的 {@link Course}。
 *
 * <p>只填列表会读的字段。其余列保持空／默认，避免在这里编一套第二份业务数据。
 */
export function boardCardsToCourses(): Course[] {
  return COURSE_BOARD.flatMap((column, columnIndex) =>
    column.cards.map((card, cardIndex) => {
      const id = columnIndex * 10 + cardIndex + 1;
      return {
        id,
        courseNo: card.id,
        courseName: card.name,
        reviewTrack: '',
        domainCode: '',
        ownerNo: card.owner,
        ownerName: card.owner,
        initiatedDate: '2026-01-01',
        expectPublishDate: '2026-12-31',
        summary: null,
        targetAudience: null,
        classHours: null,
        categoryCode: null,
        source: null,
        remark: null,
        initiationNo: null,
        businessPain: null,
        courseGoal: null,
        courseValue: null,
        outlineSummary: null,
        estimateDevDays: null,
        reviewJudges: null,
        initiationReviewDate: null,
        initiationReviewConclusion: null,
        initiationReviewOpinion: null,
        initiationStatus: null,
        planDraftDate: null,
        actualDraftDate: null,
        enterSelfCheck: null,
        selfcheckCheckerNo: null,
        selfcheckCompletedDate: null,
        selfcheckConclusion: null,
        selfcheckRecordStatus: null,
        submitExpertReview: null,
        selfcheckSpecAnswers: null,
        reviewRoundLabel: null,
        reviewCompletedDate: null,
        reviewLedgerPhase: null,
        reviewLedgerStatus: null,
        enterTrial: null,
        prelimRoundLabel: null,
        prelimReviewers: null,
        prelimReviewDate: null,
        prelimCompletedDate: null,
        prelimConclusion: null,
        prelimOpinion: null,
        enterMeeting: null,
        meetingRoundLabel: null,
        meetingReviewers: null,
        meetingActualDate: null,
        meetingConclusion: null,
        meetingOpinion: null,
        trialLecturerNo: null,
        trialCurrentPhase: null,
        trialLedgerStatus: null,
        trialRoundLabel: null,
        trialScheduledDate: null,
        trialAudienceGroup: null,
        trialAudienceCount: null,
        trialHours: null,
        trialFormat: null,
        trialSatisfaction: null,
        trialOptimizeAdvice: null,
        trialAcceptanceResult: null,
        trialReadyToPublish: null,
        trialLecturerQualified: null,
        trialConclusionDate: null,
        trialRemark: null,
        validityPeriod: '',
        validityEndDate: null,
        validityStatus: '未发布',
        expired: false,
        daysToExpiry: null,
        externalLink: null,
        mainState: column.states[0] ?? '',
        devState: null,
        selfcheckState: null,
        trialState: null,
        publishState: null,
        firstPublishDate: null,
        qualityMarks: [],
        closeReason: null,
        currentMaterialVersion: null,
        reviewRound: null,
        reviewRecordState: null,
        hasDemand: false,
        lastStateChangedAt: null,
        updatedAt: '2026-08-28T00:00:00+08:00',
        updatedBy: null,
        version: 0,
        light: card.light,
        lightDays: card.stalledDays ?? null,
        lightReason:
          card.lightReason === 'STALLED' ? '状态停滞' : card.lightReason === 'OVERDUE' ? '已逾期' : null,
      };
    }),
  );
}

/** 把列表结果按主状态拆进看板七列。终态与「优化」不上板。 */
export function boardColumnsFromCourses(courses: Course[]) {
  return COURSE_BOARD.map((column) => {
    const cards = courses
      .filter((course) => column.states.includes(course.mainState))
      .map(courseToBoardCard);
    return { ...column, count: cards.length, cards };
  });
}
