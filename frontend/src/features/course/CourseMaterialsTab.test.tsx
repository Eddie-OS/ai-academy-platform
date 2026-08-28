import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import { render, screen } from '@testing-library/react';
import { CourseMaterialsTab } from './CourseMaterialsTab';
import { useAuthStore } from '@/shared/store/authStore';
import type { AccountInfo } from '@/shared/api/types';
import type { Course, CourseMaterial, CourseMaterialVersion } from '@/shared/api/courses';

vi.mock('@/shared/api/courses', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/api/courses')>();
  return {
    ...actual,
    courseApi: {
      ...actual.courseApi,
      materials: () => Promise.resolve(materials),
      versions: () => Promise.resolve(versions),
      versionDetail: () => Promise.resolve({ files: [], selfcheck: [] }),
    },
  };
});

vi.mock('./courseMeta', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./courseMeta')>();
  return {
    ...actual,
    useMaterialTypes: () => ({
      data: [
        { materialType: '课件', scene: 'COURSEWARE', maxBytes: 200 * 1024 * 1024, maxSizeText: '200MB' },
        { materialType: '教案', scene: 'GENERAL', maxBytes: 20 * 1024 * 1024, maxSizeText: '20MB' },
        { materialType: '实验材料', scene: 'LAB_MATERIAL', maxBytes: 200 * 1024 * 1024, maxSizeText: '200MB' },
      ],
      isLoading: false,
    }),
    useEmployees: () => ({
      data: { records: [{ employeeNo: 'E001', employeeName: '张三' }] },
    }),
    useFieldEnums: () => ({
      data: { 课程版本状态: ['生效版本', '历史归档', '废弃版本'] },
    }),
  };
});

const materials: CourseMaterial[] = [
  {
    id: 11,
    courseId: 1,
    materialType: '课件',
    attachmentId: 100,
    fileName: '大纲.pptx',
    fileSize: 2048,
    seqNo: 1,
    createdAt: '2026-08-10T10:00:00+08:00',
    createdBy: 'operator',
  },
];

const versions: CourseMaterialVersion[] = [
  {
    id: 2,
    courseId: 1,
    versionNo: 'V2',
    triggerType: '提交评审自动',
    remark: '送评材料',
    boundReviewRound: 2,
    versionLabel: 'V2.0 修订',
    versionStatus: '生效版本',
    ownerNo: 'E001',
    updatedDate: '2026-08-20',
    coursewareUrl: 'https://files.example.com/v2.pptx',
    recordingUrl: 'https://files.example.com/v2.mp4',
    createdAt: '2026-08-20T09:00:00+08:00',
    createdBy: 'operator',
  },
  {
    id: 1,
    courseId: 1,
    versionNo: 'V1',
    triggerType: '手动创建',
    remark: '初稿',
    boundReviewRound: null,
    versionLabel: 'V1.0 初稿',
    versionStatus: '历史归档',
    ownerNo: 'E001',
    updatedDate: '2026-08-10',
    coursewareUrl: null,
    recordingUrl: null,
    createdAt: '2026-08-10T09:00:00+08:00',
    createdBy: 'operator',
  },
];

function course(): Course {
  return {
    id: 1,
    courseNo: 'KC2026080001',
    courseName: '大模型应用入门',
    reviewTrack: '内部端到端课程',
    domainCode: '客服中心',
    ownerNo: 'E001',
    ownerName: '张三',
    initiatedDate: '2026-08-01',
    expectPublishDate: '2026-09-01',
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
    validityPeriod: '长期有效',
    validityEndDate: null,
    validityStatus: '未发布',
    expired: false,
    daysToExpiry: null,
    externalLink: null,
    mainState: '评审决策',
    devState: null,
    selfcheckState: null,
    trialState: null,
    publishState: null,
    firstPublishDate: null,
    qualityMarks: [],
    closeReason: null,
    currentMaterialVersion: 'V2',
    reviewRound: 2,
    reviewRecordState: null,
    hasDemand: false,
    lastStateChangedAt: '2026-08-01T10:00:00+08:00',
    updatedAt: '2026-08-01T10:00:00+08:00',
    updatedBy: 'operator',
    version: 0,
    light: 'NONE',
    lightDays: null,
    lightReason: null,
  };
}

function operatorAccount(): AccountInfo {
  return {
    username: 'operator',
    displayName: '运营',
    accountType: 'OPERATOR',
    typeLabel: '运营账号',
    operator: true,
  };
}

describe('课程材料与版本三栏', () => {
  it('展示课程只读信息、当前版本与规格字段，不提供视频上传', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    useAuthStore.setState({ account: operatorAccount(), resolved: true });
    render(
      <QueryClientProvider client={client}>
        <App>
          <CourseMaterialsTab course={course()} />
        </App>
      </QueryClientProvider>,
    );

    expect(await screen.findByDisplayValue('KC2026080001')).toBeInTheDocument();
    expect(await screen.findByText('当前版本')).toBeInTheDocument();
    expect(screen.getByDisplayValue('大模型应用入门')).toBeInTheDocument();
    expect(screen.getByText('版本列表')).toBeInTheDocument();
    expect(screen.getByText('材料清单（V2.0 修订）')).toBeInTheDocument();
    expect(screen.getAllByText('版本说明').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('课程版本号')).toBeInTheDocument();
    expect(screen.getByText('版本状态')).toBeInTheDocument();
    expect(screen.getByText('版本更新负责人')).toBeInTheDocument();
    expect(screen.getByText('版本更新时间')).toBeInTheDocument();
    expect(screen.getByText('课件 PPT')).toBeInTheDocument();
    expect(screen.getByText('试讲／授课录屏')).toBeInTheDocument();
    expect(screen.getByText('只填外链，平台不上传视频文件')).toBeInTheDocument();
    expect(screen.queryByText(/上传.*mp4/i)).toBeNull();
    expect(screen.getByText('大纲.pptx')).toBeInTheDocument();
  });
});
