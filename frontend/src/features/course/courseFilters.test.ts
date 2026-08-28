import { describe, expect, it } from 'vitest';
import type { Course } from '@/shared/api/courses';
import {
  boardColumnsFromCourses,
  courseKpiMainState,
  EMPTY_COURSE_FILTER,
  filterForCourseKpi,
  isCourseFilterActive,
  selectedCourseKpiId,
  toCourseApiFilter,
} from './courseFilters';

describe('courseFilters', () => {
  it('空筛选不传任何 API 条件', () => {
    expect(toCourseApiFilter(EMPTY_COURSE_FILTER)).toEqual({
      keyword: null,
      domainCode: null,
      categoryCode: null,
      mainState: null,
      devState: null,
      selfcheckState: null,
      reviewRecordState: null,
      trialState: null,
      light: null,
    });
    expect(isCourseFilterActive(EMPTY_COURSE_FILTER)).toBe(false);
  });

  it('点卡写入主状态，课程总数不清主状态', () => {
    expect(courseKpiMainState('total')).toBe('');
    expect(filterForCourseKpi('developing').mainState).toBe(courseKpiMainState('developing'));
    expect(filterForCourseKpi('reviewing').mainState).toBe(courseKpiMainState('reviewing'));
    expect(filterForCourseKpi('pendingTrial').mainState).toBe(courseKpiMainState('pendingTrial'));
    expect(filterForCourseKpi('published').mainState).toBe(courseKpiMainState('published'));
    expect(selectedCourseKpiId(EMPTY_COURSE_FILTER)).toBe('total');
    expect(selectedCourseKpiId(filterForCourseKpi('reviewing'))).toBe('reviewing');
    expect(isCourseFilterActive(filterForCourseKpi('developing'))).toBe(true);
  });

  it('空白关键字当成未筛选', () => {
    const filter = { ...EMPTY_COURSE_FILTER, keyword: '  ', devState: '开发中' };
    expect(toCourseApiFilter(filter).keyword).toBeNull();
    expect(toCourseApiFilter(filter).devState).toBe('开发中');
    expect(isCourseFilterActive(filter)).toBe(true);
  });

  it('看板只收七列主状态，终态不上板', () => {
    const columns = boardColumnsFromCourses([
      课({ courseNo: 'KC1', mainState: '开发' }),
      课({ courseNo: 'KC2', mainState: '评审决策' }),
      课({ courseNo: 'KC3', mainState: '已关闭' }),
    ]);
    const byId = Object.fromEntries(columns.map((column) => [column.id, column]));
    expect(byId.development?.cards.map((card) => card.id)).toEqual(['KC1']);
    expect(byId.reviewDecision?.cards.map((card) => card.id)).toEqual(['KC2']);
    expect(columns.reduce((sum, column) => sum + column.cards.length, 0)).toBe(2);
  });
});

function 课(partial: Pick<Course, 'courseNo' | 'mainState'>): Course {
  return {
    id: Number(partial.courseNo.replace(/\D/g, '') || 1),
    courseNo: partial.courseNo,
    courseName: partial.courseNo,
    reviewTrack: '内部端到端课程',
    domainCode: 'COURSE',
    ownerNo: 'E001',
    ownerName: '测试',
    initiatedDate: '2026-01-01',
    expectPublishDate: '2026-02-01',
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
    validityPeriod: '12 个月',
    validityEndDate: null,
    validityStatus: '未发布',
    expired: false,
    daysToExpiry: null,
    externalLink: null,
    mainState: partial.mainState,
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
    updatedAt: '2026-01-01T00:00:00+08:00',
    updatedBy: null,
    version: 0,
    light: 'NONE',
    lightDays: null,
    lightReason: null,
  };
}
