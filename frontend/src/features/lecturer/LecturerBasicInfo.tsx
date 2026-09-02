import type { ReactNode } from 'react';
import type { Lecturer } from '@/shared/api/lecturers';
import { lecturerPortraitSrc } from './lecturerAvatars';
import './LecturerBasicInfo.css';

/**
 * 右侧详情「基本信息」只读档案。分组与字段顺序跟新建／编辑表单同一套。
 *
 * <p>V2 产品模式与业务页共用这一份，避免两处各写一列字段、改口径时漏一边。
 * 试讲合格、授课次数等是系统汇总，放在最后一组，表单里没有。
 */

export interface LecturerBasicProfile {
  name: string;
  lecturerNo: string;
  employeeNo: string | null;
  sourceDept: string | null;
  lecturerLevel: string | null;
  dutyState: string | null;
  expertiseDomains: string[];
  capabilityTags: string | null;
  bio: string | null;
  portraitSrc: string | null;
  availableTime: string | null;
  scheduleLimit: string | null;
  joinedDate: string | null;
  profileMaintainer: string | null;
  poolState: string | null;
  removedReason: string | null;
  remark: string | null;
  trialQualified: boolean | null;
  teachingCount: number | null;
  avgScore: string | null;
  attendees: number | null;
  joinType?: string | null;
  firstQualifiedDate?: string | null;
  importBatchNo?: string | null;
}

export function lecturerBasicProfileOf(lecturer: Lecturer): LecturerBasicProfile {
  return {
    name: lecturer.lecturerName,
    lecturerNo: lecturer.lecturerNo,
    employeeNo: lecturer.employeeNo,
    sourceDept: lecturer.sourceDept,
    lecturerLevel: lecturer.lecturerLevel,
    dutyState: lecturer.dutyState ?? lecturer.trainingState,
    expertiseDomains: lecturer.expertiseDomains,
    capabilityTags: lecturer.capabilityTags,
    bio: lecturer.teachingDirection,
    portraitSrc: lecturerPortraitSrc(lecturer) ?? null,
    availableTime: lecturer.availableTime,
    scheduleLimit: lecturer.scheduleLimit,
    joinedDate: lecturer.joinedDate,
    profileMaintainer: lecturer.profileMaintainer,
    poolState: lecturer.poolState,
    removedReason: lecturer.removedReason,
    remark: lecturer.remark,
    trialQualified: lecturer.trialQualified,
    teachingCount: lecturer.teachingCount,
    avgScore: lecturer.avgScore,
    attendees: lecturer.attendeeCount,
    joinType: lecturer.joinType,
    firstQualifiedDate: lecturer.firstQualifiedDate,
    importBatchNo: lecturer.importBatchNo,
  };
}

function EmptyValue() {
  return <span className="lct-profile-empty">—</span>;
}

function textOrEmpty(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : <EmptyValue />;
}

function textValue(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : '—';
}

function splitTags(value: string | null | undefined): string[] {
  if (!value?.trim()) return [];
  return value
    .split(/[,，、]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function Field({
  label,
  children,
  span,
  mono,
}: {
  label: string;
  children: ReactNode;
  text?: string;
  span?: 'full';
  mono?: boolean;
}) {
  return (
    <div className="lct-profile-field" data-span={span} data-mono={mono} data-testid="lecturer-field">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function TagList({ items }: { items: string[] }) {
  if (items.length === 0) return <EmptyValue />;
  return (
    <ul className="lct-profile-tags">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function teachingLabel(count: number | null): string {
  return count === null ? '—' : `${count} 次`;
}

function scoreLabel(score: string | null): string {
  return score === null ? '—' : `${score} / 5`;
}

function attendeesLabel(count: number | null): string {
  return count === null ? '—' : count.toLocaleString('en-US');
}

function trialLabel(qualified: boolean | null): string {
  if (qualified === null) return '—';
  return qualified ? '是' : '否';
}

export function LecturerBasicInfo({
  profile,
}: {
  profile: LecturerBasicProfile;
}) {
  const showLedgerExtras =
    profile.joinType !== undefined ||
    profile.firstQualifiedDate !== undefined ||
    profile.importBatchNo !== undefined;

  return (
    <div className="lct-basic lct-profile" data-testid="lecturer-basic">
      <section className="lct-profile-card">
        <h4>基础档案</h4>
        <dl className="lct-profile-grid">
          <Field label="讲师ID" text={profile.lecturerNo} mono>
            {profile.lecturerNo}
          </Field>
          <Field label="讲师姓名" text={profile.name}>
            {profile.name}
          </Field>
          <Field label="工号" text={textValue(profile.employeeNo)} mono>
            {textOrEmpty(profile.employeeNo)}
          </Field>
          <Field label="来源部门" text={textValue(profile.sourceDept)}>
            {textOrEmpty(profile.sourceDept)}
          </Field>
          <Field label="讲师简介" text={textValue(profile.bio)} span="full">
            <p data-empty={!profile.bio?.trim()}>{profile.bio?.trim() || '—'}</p>
          </Field>
          <Field label="讲师等级" text={textValue(profile.lecturerLevel)}>
            {textOrEmpty(profile.lecturerLevel)}
          </Field>
          <Field
            label="擅长领域"
            text={profile.expertiseDomains.join('、') || '—'}
          >
            <TagList items={profile.expertiseDomains} />
          </Field>
          <Field label="能力标签" text={textValue(profile.capabilityTags)}>
            <TagList items={splitTags(profile.capabilityTags)} />
          </Field>
          <Field label="可授课时间" text={textValue(profile.availableTime)}>
            {textOrEmpty(profile.availableTime)}
          </Field>
          <Field label="上岗状态" text={textValue(profile.dutyState)}>
            {textOrEmpty(profile.dutyState)}
          </Field>
          <Field label="排课限制说明" text={textValue(profile.scheduleLimit)}>
            {textOrEmpty(profile.scheduleLimit)}
          </Field>
          <Field label="建档时间" text={textValue(profile.joinedDate)} mono>
            {textOrEmpty(profile.joinedDate)}
          </Field>
          <Field label="档案维护人" text={textValue(profile.profileMaintainer)}>
            {textOrEmpty(profile.profileMaintainer)}
          </Field>
          <Field label="在池状态" text={textValue(profile.poolState)}>
            {textOrEmpty(profile.poolState)}
          </Field>
          {profile.removedReason ? (
            <Field label="移出原因" text={textValue(profile.removedReason)} span="full">
              {textOrEmpty(profile.removedReason)}
            </Field>
          ) : null}
          <Field label="备注" text={textValue(profile.remark)} span="full">
            <p data-empty={!profile.remark?.trim()}>{profile.remark?.trim() || '—'}</p>
          </Field>
        </dl>
      </section>

      <section className="lct-profile-card">
        <h4>授课台账</h4>
        <dl className="lct-profile-grid">
          <Field label="试讲合格" text={trialLabel(profile.trialQualified)}>
            {trialLabel(profile.trialQualified) === '—' ? <EmptyValue /> : trialLabel(profile.trialQualified)}
          </Field>
          <Field label="授课次数" text={teachingLabel(profile.teachingCount)} mono>
            {profile.teachingCount === null ? <EmptyValue /> : teachingLabel(profile.teachingCount)}
          </Field>
          <Field label="学员评分" text={scoreLabel(profile.avgScore)} mono>
            {profile.avgScore === null ? <EmptyValue /> : scoreLabel(profile.avgScore)}
          </Field>
          <Field label="学员人次" text={attendeesLabel(profile.attendees)} mono>
            {profile.attendees === null ? <EmptyValue /> : attendeesLabel(profile.attendees)}
          </Field>
          {showLedgerExtras ? (
            <>
              <Field label="入池方式" text={textValue(profile.joinType)}>
                {textOrEmpty(profile.joinType)}
              </Field>
              <Field label="首次试讲合格" text={textValue(profile.firstQualifiedDate)} mono>
                {textOrEmpty(profile.firstQualifiedDate)}
              </Field>
              <Field label="导入批次" text={textValue(profile.importBatchNo)} mono>
                {textOrEmpty(profile.importBatchNo)}
              </Field>
            </>
          ) : null}
        </dl>
      </section>
    </div>
  );
}
