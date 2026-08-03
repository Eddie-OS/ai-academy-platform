import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import { fireEvent, render, screen } from '@testing-library/react';
import { TrainingSessionFormModal } from './TrainingSessionFormModal';
import { useAuthStore } from '@/shared/store/authStore';
import type { AccountInfo } from '@/shared/api/types';
import type { TrainingSession } from '@/shared/api/trainings';

/**
 * 需求 11.4 第 10、11 项：<b>培训地点在线下与混合时必填，线上链接在线上与混合时必填。</b>
 *
 * <p>这里真正要守住的是<b>判断依据的来源</b>：适用范围由后端随字段枚举下发
 * （{@code 培训形式·需填培训地点}），前端不写死「线下」「混合」这两个词（纪律 STK-1）。
 * 写死的后果不是报错，而是有朝一日培训形式增加一个取值时，界面安静地不再要求填地点。
 */

const FORM_OFFLINE = '线下';
const FORM_ONLINE = '线上';

vi.mock('./trainingMeta', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./trainingMeta')>();
  return {
    ...actual,
    useFieldEnums: () => ({
      data: {
        [actual.TRAINING_ENUM_KEYS.trainingForm]: [FORM_OFFLINE, FORM_ONLINE, '混合'],
        [actual.TRAINING_ENUM_KEYS.formsNeedVenue]: [FORM_OFFLINE, '混合'],
        [actual.TRAINING_ENUM_KEYS.formsNeedOnlineLink]: [FORM_ONLINE, '混合'],
      },
    }),
    useSchedulingOptions: () => ({ data: { courses: [], lecturers: [] }, isLoading: false }),
  };
});

function session(overrides: Partial<TrainingSession>): TrainingSession {
  return {
    id: 1,
    sessionNo: 'JH2026080001-01',
    planId: 1,
    planNo: 'JH2026080001',
    planName: '八月大模型集训',
    sessionName: '第一场',
    courseId: 10,
    courseName: '提示词工程',
    lecturerId: 20,
    lecturerName: '王五',
    trainingDate: '2026-08-10',
    startTime: '09:00',
    endTime: '11:00',
    durationHours: '2.0',
    trainingForm: FORM_OFFLINE,
    venue: null,
    onlineLink: null,
    studentScope: '客服中心全体',
    planAttendeeCount: 30,
    actualAttendeeCount: 0,
    attendanceImported: false,
    sessionState: '待开课',
    remark: null,
    lastStateChangedAt: null,
    updatedAt: '2026-08-01T10:00:00+08:00',
    updatedBy: 'operator',
    ...overrides,
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

function renderModal(value: TrainingSession) {
  useAuthStore.setState({ account: operatorAccount(), resolved: true });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <App>
        <TrainingSessionFormModal
          open
          planId={1}
          session={value}
          onClose={() => undefined}
          onSaved={() => undefined}
        />
      </App>
    </QueryClientProvider>,
  );
}

describe('培训场次表单的条件必填', () => {
  it('线下场次：培训地点必填，线上链接不必填', async () => {
    renderModal(session({ trainingForm: FORM_OFFLINE }));
    fireEvent.click(screen.getByRole('button', { name: '保 存' }));

    expect(await screen.findByText('当前培训形式必须填写培训地点')).toBeTruthy();
    expect(screen.queryByText('当前培训形式必须填写线上链接')).toBeNull();
  });

  it('线上场次：线上链接必填，培训地点不必填', async () => {
    renderModal(session({ trainingForm: FORM_ONLINE }));
    fireEvent.click(screen.getByRole('button', { name: '保 存' }));

    expect(await screen.findByText('当前培训形式必须填写线上链接')).toBeTruthy();
    expect(screen.queryByText('当前培训形式必须填写培训地点')).toBeNull();
  });
});
