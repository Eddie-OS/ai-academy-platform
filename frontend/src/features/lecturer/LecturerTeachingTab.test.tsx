import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { LecturerTeachingTab } from './LecturerTeachingTab';
import type { Lecturer, TeachingRecord } from '@/shared/api/lecturers';

const lecturer = {
  id: 1,
  lecturerNo: 'JS0001',
  lecturerName: '张三',
} as Lecturer;

const row: TeachingRecord = {
  sessionId: 9,
  sessionNo: 'CC0009',
  sessionName: '第 12 期',
  courseId: 3,
  courseName: '门店一线实战',
  teachingDate: '2026-08-20',
  sessionState: '已结束',
  attendeeCount: 20,
  avgScore: '4.6',
  trainingForm: '线下',
  createdBy: '运营',
  updatedAt: '2026-08-20T18:30:00+08:00',
};

vi.mock('@/shared/api/lecturers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/api/lecturers')>();
  return {
    ...actual,
    lecturerApi: {
      teachingRecords: () => Promise.resolve([row]),
    },
  };
});

describe('授课记录与学员反馈', () => {
  it('预览四列，展开后带出场次培训形式', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <App>
          <MemoryRouter>
            <LecturerTeachingTab lecturer={lecturer} />
          </MemoryRouter>
        </App>
      </QueryClientProvider>,
    );

    expect(await screen.findByText('门店一线实战')).toBeTruthy();
    expect(screen.getByText('JS0001')).toBeTruthy();
    expect(screen.getByText('张三')).toBeTruthy();
    expect(screen.getByText('课程名称')).toBeTruthy();
    expect(screen.getByText('场次')).toBeTruthy();
    expect(screen.getByText('授课日期')).toBeTruthy();
    expect(screen.getByText('本场评分')).toBeTruthy();
    expect(screen.queryByText('授课类型')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '查看全部授课记录' }));
    expect(screen.getByText('授课类型')).toBeTruthy();
    expect(screen.getByText('线下')).toBeTruthy();
    expect(screen.getByText('记录创建人')).toBeTruthy();
    expect(screen.getByText('记录更新时间')).toBeTruthy();
  });
});
