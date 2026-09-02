import { describe, expect, it } from 'vitest';
import {
  LECTURER_POOL,
  TRIAL_CONCLUSION_QUALIFIED,
  TRIAL_CONCLUSION_UNQUALIFIED,
  TRIAL_LEDGER_NO,
  TRIAL_LEDGER_YES,
  trialLedgerYesNoOf,
  lecturerArchiveOf,
  lecturerBasicFieldsOf,
  lecturerCertRecordsOf,
  lecturerCultivationRecordsOf,
  lecturerEvaluationsOf,
  lecturerFieldLogsOf,
  lecturerLevelLogsOf,
  lecturerTeachingOf,
  lecturerTimelineOf,
} from './lecturer';

/**
 * 产品模式右侧七个页签：每位讲师都要能看到标准模拟数据，不能只有李玥有、其他人空态。
 * 李玥的冻结文案另由 LecturerV2Page 产品模式用例钉死。
 */
describe('讲师详情七页签模拟数据', () => {
  it('池子里每位讲师的七个页签都有完整演示记录', () => {
    expect(LECTURER_POOL).toHaveLength(60);

    for (const card of LECTURER_POOL) {
      const archive = lecturerArchiveOf(card);
      expect(archive.availableTime, `${card.id} 可授课时间`).toBeTruthy();
      expect(archive.joinedDate, `${card.id} 建档时间`).toBeTruthy();
      expect(archive.profileMaintainer, `${card.id} 档案维护人`).toBeTruthy();
      expect(archive.scheduleLimit, `${card.id} 排课限制`).toBeTruthy();
      expect(lecturerBasicFieldsOf(card).length, `${card.id} 基本信息`).toBeGreaterThan(10);

      const trials = lecturerTimelineOf(card);
      expect(trials.length, `${card.id} 试讲记录`).toBeGreaterThan(0);
      expect(trials[0]?.courseName, `${card.id} 试讲课程`).toBeTruthy();

      const cultivation = lecturerCultivationRecordsOf(card);
      expect(cultivation).toHaveLength(1);
      expect(cultivation[0]?.planText, `${card.id} 培养计划`).toBeTruthy();
      expect(cultivation[0]?.cultivationTypes.length, `${card.id} 培养类型`).toBeGreaterThan(0);

      const certs = lecturerCertRecordsOf(card);
      expect(certs).toHaveLength(1);
      expect(certs[0]?.certBatch, `${card.id} 认证批次`).toBeTruthy();
      expect(certs[0]?.certState, `${card.id} 认证状态`).toBeTruthy();

      const levels = lecturerLevelLogsOf(card);
      expect(levels).toHaveLength(1);
      expect(levels[0]?.changeNo, `${card.id} 等级编号`).toMatch(/^BG\d{4}$/);
      expect(levels[0]?.levelAfter, `${card.id} 变更后等级`).toBeTruthy();

      const teaching = lecturerTeachingOf(card);
      expect(teaching.length, `${card.id} 授课记录`).toBe(3);
      expect(teaching[0]?.trainingForm, `${card.id} 授课类型`).toBeTruthy();

      const evals = lecturerEvaluationsOf(card);
      expect(evals.length, `${card.id} 学员反馈`).toBe(3);

      const logs = lecturerFieldLogsOf(card);
      expect(logs).toHaveLength(3);
      expect(logs.map((row) => row.fieldName), `${card.id} 流转字段`).toEqual([
        '上岗状态',
        '培养状态',
        '认证状态',
      ]);
      expect(logs.every((row) => row.operator.includes(' ')), `${card.id} 操作人`).toBe(true);
    }
  });

  it('等级变更编号按池子一人一号，不互相撞', () => {
    const nos = LECTURER_POOL.map((card) => lecturerLevelLogsOf(card)[0]!.changeNo);
    expect(new Set(nos).size).toBe(LECTURER_POOL.length);
  });

  it('试讲台账结论只把合格／不合格换成是／否', () => {
    expect(trialLedgerYesNoOf(TRIAL_CONCLUSION_QUALIFIED)).toBe(TRIAL_LEDGER_YES);
    expect(trialLedgerYesNoOf(TRIAL_CONCLUSION_UNQUALIFIED)).toBe(TRIAL_LEDGER_NO);
    expect(trialLedgerYesNoOf(null)).toBe('—');
  });
});
