package com.aiacademy.business.course.service;

import com.aiacademy.business.course.domain.Course;
import com.aiacademy.business.course.domain.CourseEnums;
import com.aiacademy.business.course.domain.CourseForm;
import com.aiacademy.business.course.domain.CourseDevelopmentForm;
import com.aiacademy.business.course.domain.CourseInitiationForm;
import com.aiacademy.business.course.domain.CourseSelfcheckInfoForm;
import com.aiacademy.business.course.domain.CourseSelfcheckSpec;
import com.aiacademy.business.course.domain.CourseListItem;
import com.aiacademy.business.course.domain.CourseQuery;
import com.aiacademy.business.course.domain.CourseReviewLedgerForm;
import com.aiacademy.business.course.domain.CourseTrialLedgerForm;
import com.aiacademy.business.course.domain.CourseValidity;
import com.aiacademy.business.course.repository.CourseMapper;
import com.aiacademy.common.api.ErrorCode;
import com.aiacademy.common.api.PageResult;
import com.aiacademy.common.audit.OperatorContext;
import com.aiacademy.common.exception.BizException;
import com.aiacademy.common.exception.NotFoundException;
import com.aiacademy.common.json.JsonArrays;
import com.aiacademy.common.time.DisplayTime;
import com.aiacademy.platform.dict.domain.BusinessDomains;
import com.aiacademy.platform.dict.service.DictQuery;
import com.aiacademy.platform.statemachine.domain.machines.CourseStateMachines;
import com.aiacademy.platform.statemachine.service.StateMachineRegistry;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

/**
 * 课程主表的读写（需求 9.3、9.10）。
 *
 * <p><b>本类不碰状态列，也不派发副作用。</b>状态变更的唯一入口是
 * {@code StateTransitionService}，而副作用派发要跨模块（标注精品会创建案例），按 AR-4 归
 * {@code app} 层的应用服务。这里只做四件事：校验、编号、写本表的业务列、查询。
 *
 * <p>因此「创建课程」在本类里只完成 INSERT，「（空）→ 立项」这一跳由 app 层在同一事务内补记。
 * 拆开看着别扭，但另一种做法是让业务模块依赖 app 模块，那会把依赖方向倒过来。
 */
@Service
public class CourseService {

    private final CourseMapper mapper;
    private final DictQuery dicts;
    private final StateMachineRegistry stateMachines;

    public CourseService(CourseMapper mapper, DictQuery dicts, StateMachineRegistry stateMachines) {
        this.mapper = mapper;
        this.dicts = dicts;
        this.stateMachines = stateMachines;
    }

    /**
     * 插入一门课程，返回主键。主状态直接落「立项」，因为 {@code main_state} 是 {@code NOT NULL}。
     *
     * <p>调用方<b>必须</b>紧接着调用 {@code TransitionApplicationService.initialize} 补记流转日志，
     * 否则这门课程的「立项」时刻没有时间戳，需求 15.2 的课程开发周期会缺掉起点。
     */
    @Transactional
    public long create(CourseForm form) {
        validate(form);

        // 编号是「查最大流水 + 1」，并发下会重号。共享账号让并发录入成为常态，靠唯一约束报错再
        // 重试，运营看到的是一次无从解释的失败
        mapper.lockCourseNoSequence();

        Course course = new Course();
        applyForm(course, form);
        course.setCourseNo(mapper.nextCourseNo());
        course.setInitiationNo(mapper.nextInitiationNo());
        course.setMainState(initialMainState());
        // 未发布就没有有效期起算点（EX3），此时截止日必须为空，哪怕有效期时长已经选定
        course.setValidityEndDate(null);
        return mapper.insert(course, operator());
    }

    /**
     * 编辑课程基本信息（规则 K1 乐观锁）。
     *
     * <p>有效期截止日按 EX3 随时长重算：运营把「3 个月」改成「12 个月」，截止日必须跟着变，
     * 否则界面上会同时显示「有效期 12 个月」和一个按 3 个月算出来的到期日。已发布的课程才有
     * 起算点，未发布的重算结果仍是空。
     */
    @Transactional
    public void update(long id, CourseForm form, Integer expectedVersion) {
        validate(form);
        Course current = requireExisting(id);

        Course course = new Course();
        applyForm(course, form);
        course.setId(id);
        course.setValidityEndDate(
                CourseValidity.endDateOf(form.validityPeriod(), current.getFirstPublishDate()));

        int version = expectedVersion == null ? current.getVersion() : expectedVersion;
        if (mapper.update(course, operator(), version) == 0) {
            throw concurrentModified(current);
        }
    }

    /**
     * 保存详情「立项」页。不改主状态，不写流转日志。
     */
    @Transactional
    public void saveInitiation(long id, CourseInitiationForm form) {
        validateInitiation(form);
        Course current = requireExisting(id);

        Course course = new Course();
        course.setId(id);
        course.setBusinessPain(blankToNull(form.businessPain()));
        course.setCourseGoal(blankToNull(form.courseGoal()));
        course.setCourseValue(blankToNull(form.courseValue()));
        course.setTargetAudience(blankToNull(form.targetAudience()));
        course.setOutlineSummary(blankToNull(form.outlineSummary()));
        course.setEstimateDevDays(form.estimateDevDays());
        course.setReviewJudges(blankToNull(form.reviewJudges()));
        course.setInitiationReviewDate(form.initiationReviewDate());
        course.setInitiationReviewConclusion(blankToNull(form.initiationReviewConclusion()));
        course.setInitiationReviewOpinion(blankToNull(form.initiationReviewOpinion()));
        course.setInitiationStatus(blankToNull(form.initiationStatus()));

        int version = form.version() == null ? current.getVersion() : form.version();
        if (mapper.updateInitiation(course, operator(), version) == 0) {
            throw concurrentModified(current);
        }
    }

    /**
     * 保存详情「开发」页。不改开发状态，不写流转日志。
     */
    @Transactional
    public void saveDevelopment(long id, CourseDevelopmentForm form) {
        validateDevelopment(form);
        Course current = requireExisting(id);

        Course course = new Course();
        course.setId(id);
        course.setOwnerNo(blankToNull(form.ownerNo()) == null ? current.getOwnerNo() : form.ownerNo().trim());
        course.setPlanDraftDate(form.planDraftDate());
        course.setActualDraftDate(form.actualDraftDate());
        course.setEnterSelfCheck(blankToNull(form.enterSelfCheck()));

        int version = form.version() == null ? current.getVersion() : form.version();
        if (mapper.updateDevelopment(course, operator(), version) == 0) {
            throw concurrentModified(current);
        }
    }

    /**
     * 保存详情「自检」页台账。不改自检子状态，不写流转日志。
     */
    @Transactional
    public void saveSelfcheckInfo(long id, CourseSelfcheckInfoForm form) {
        validateSelfcheckInfo(form);
        Course current = requireExisting(id);

        Course course = new Course();
        course.setId(id);
        course.setSelfcheckCheckerNo(blankToNull(form.selfcheckCheckerNo()));
        course.setSelfcheckCompletedDate(form.selfcheckCompletedDate());
        course.setSelfcheckConclusion(blankToNull(form.selfcheckConclusion()));
        course.setSelfcheckRecordStatus(blankToNull(form.selfcheckRecordStatus()));
        course.setSubmitExpertReview(blankToNull(form.submitExpertReview()));
        course.setSelfcheckSpecAnswers(CourseSelfcheckSpec.toJson(form.specAnswers()));

        int version = form.version() == null ? current.getVersion() : form.version();
        if (mapper.updateSelfcheckInfo(course, operator(), version) == 0) {
            throw concurrentModified(current);
        }
    }

    /**
     * 保存详情「评审」页台账。不改五个状态列，不写流转日志。
     */
    @Transactional
    public void saveReviewLedger(long id, CourseReviewLedgerForm form) {
        validateReviewLedger(form);
        Course current = requireExisting(id);

        Course course = new Course();
        course.setId(id);
        course.setOwnerNo(blankToNull(form.ownerNo()) == null ? current.getOwnerNo() : form.ownerNo().trim());
        course.setReviewRoundLabel(blankToNull(form.reviewRoundLabel()));
        course.setReviewCompletedDate(form.reviewCompletedDate());
        course.setReviewLedgerPhase(blankToNull(form.reviewLedgerPhase()));
        course.setReviewLedgerStatus(blankToNull(form.reviewLedgerStatus()));
        course.setEnterTrial(blankToNull(form.enterTrial()));
        course.setPrelimRoundLabel(blankToNull(form.prelimRoundLabel()));
        course.setPrelimReviewers(blankToNull(form.prelimReviewers()));
        course.setPrelimReviewDate(form.prelimReviewDate());
        course.setPrelimCompletedDate(form.prelimCompletedDate());
        course.setPrelimConclusion(blankToNull(form.prelimConclusion()));
        course.setPrelimOpinion(blankToNull(form.prelimOpinion()));
        course.setEnterMeeting(blankToNull(form.enterMeeting()));
        course.setMeetingRoundLabel(blankToNull(form.meetingRoundLabel()));
        course.setMeetingReviewers(blankToNull(form.meetingReviewers()));
        course.setMeetingActualDate(form.meetingActualDate());
        course.setMeetingConclusion(blankToNull(form.meetingConclusion()));
        course.setMeetingOpinion(blankToNull(form.meetingOpinion()));

        int version = form.version() == null ? current.getVersion() : form.version();
        if (mapper.updateReviewLedger(course, operator(), version) == 0) {
            throw concurrentModified(current);
        }
    }

    /**
     * 保存详情「试讲」页台账。不改五个状态列，不写流转日志。
     */
    @Transactional
    public void saveTrialLedger(long id, CourseTrialLedgerForm form) {
        validateTrialLedger(form);
        Course current = requireExisting(id);

        Course course = new Course();
        course.setId(id);
        course.setOwnerNo(blankToNull(form.ownerNo()) == null ? current.getOwnerNo() : form.ownerNo().trim());
        course.setTrialLecturerNo(blankToNull(form.trialLecturerNo()));
        course.setTrialCurrentPhase(blankToNull(form.trialCurrentPhase()));
        course.setTrialLedgerStatus(blankToNull(form.trialLedgerStatus()));
        course.setTrialRoundLabel(blankToNull(form.trialRoundLabel()));
        course.setTrialScheduledDate(form.trialScheduledDate());
        course.setTrialAudienceGroup(blankToNull(form.trialAudienceGroup()));
        course.setTrialAudienceCount(blankToNull(form.trialAudienceCount()));
        course.setTrialHours(form.trialHours());
        course.setTrialFormat(blankToNull(form.trialFormat()));
        course.setTrialSatisfaction(blankToNull(form.trialSatisfaction()));
        course.setTrialOptimizeAdvice(blankToNull(form.trialOptimizeAdvice()));
        course.setTrialAcceptanceResult(blankToNull(form.trialAcceptanceResult()));
        course.setTrialReadyToPublish(blankToNull(form.trialReadyToPublish()));
        course.setTrialLecturerQualified(blankToNull(form.trialLecturerQualified()));
        course.setTrialConclusionDate(form.trialConclusionDate());
        course.setTrialRemark(blankToNull(form.trialRemark()));

        int version = form.version() == null ? current.getVersion() : form.version();
        if (mapper.updateTrialLedger(course, operator(), version) == 0) {
            throw concurrentModified(current);
        }
    }

    /**
     * 首次进入「发布」时回填首次发布时间与有效期截止日（规则 EX1、EX3）。
     *
     * <p>由 app 层的 {@code SET_FIRST_PUBLISHED_AT} 副作用处理器调用。返回 false 表示这门课程
     * 早已发布过——课程从「优化」回到「发布」时会再次触发本效果，而 EX2 规定首次发布时间只写一次。
     * 这不是异常，调用方无需处理。
     */
    @Transactional
    public boolean markFirstPublished(long id) {
        Course course = requireExisting(id);
        LocalDate today = LocalDate.now();
        LocalDate endDate = CourseValidity.endDateOf(course.getValidityPeriod(), today);
        return mapper.markFirstPublished(id, today, endDate, operator()) > 0;
    }

    /** 关闭课程开发时写关闭原因（需求 9.3.2 第 20 项）。状态转换本身由调用方执行。 */
    @Transactional
    public void writeCloseReason(long id, String closeReason) {
        if (mapper.updateCloseReason(id, closeReason, operator()) == 0) {
            throw new NotFoundException("课程不存在或已删除：" + id);
        }
    }

    @Transactional
    public void softDelete(long id) {
        if (mapper.softDelete(id, operator()) == 0) {
            throw new NotFoundException("课程不存在或已删除：" + id);
        }
    }

    @Transactional(readOnly = true)
    public CourseListItem get(long id) {
        CourseListItem item = mapper.selectDetailById(id);
        if (item == null) {
            throw new NotFoundException("课程不存在或已删除：" + id);
        }
        item.applyValidity(LocalDate.now());
        return item;
    }

    @Transactional(readOnly = true)
    public PageResult<CourseListItem> page(CourseQuery query) {
        long total = mapper.countPage(query);
        if (total == 0) {
            return PageResult.of(List.of(), 0, query);
        }
        List<CourseListItem> records = mapper.selectPage(
                query, query.offset(), query.sortColumn(), query.sortDirection());
        LocalDate today = LocalDate.now();
        records.forEach(item -> item.applyValidity(today));
        return PageResult.of(records, total, query);
    }

    @Transactional(readOnly = true)
    public Course require(long id) {
        return requireExisting(id);
    }

    /**
     * 初始主状态从转换表里取，不写成字面量。
     *
     * <p>{@code main_state} 是 {@code NOT NULL}，INSERT 必须带一个值；把「立项」抄进业务代码，
     * 就出现了状态定义的第二个来源，需求改掉初始状态名时它不会跟着变，而症状是 CHECK 约束
     * 报错——离原因很远。A-6 的 ArchUnit 门禁也禁止业务代码出现状态值字面量。
     */
    private String initialMainState() {
        return stateMachines.require(CourseStateMachines.OBJECT_TYPE,
                CourseStateMachines.FIELD_MAIN_STATE, null, CourseStateMachines.ACTION_INITIATE).to();
    }

    private Course requireExisting(long id) {
        Course course = mapper.selectById(id);
        if (course == null) {
            throw new NotFoundException("课程不存在或已删除：" + id);
        }
        return course;
    }

    private void applyForm(Course course, CourseForm form) {
        course.setCourseName(form.courseName().trim());
        course.setReviewTrack(form.reviewTrack());
        course.setDomainCode(form.domainCode());
        course.setOwnerNo(form.ownerNo());
        course.setInitiatedDate(form.initiatedDate());
        course.setExpectPublishDate(form.expectPublishDate());
        course.setSummary(form.summary());
        course.setTargetAudience(form.targetAudience());
        course.setClassHours(form.classHours());
        course.setCategoryCode(form.categoryCode());
        course.setSource(blankToNull(form.source()));
        course.setRemark(blankToNull(form.remark()));
        course.setValidityPeriod(form.validityPeriod());
        course.setExternalLink(blankToNull(form.externalLink()));
        course.setQualityMarks(JsonArrays.toJson(form.qualityMarks()));
    }

    /**
     * 表单校验。
     *
     * <p><b>只校验取值合法性，不校验业务前置条件</b>（规则 C2）：不检查预计发布时间是否晚于立项
     * 时间，也不检查有效期是否合理。运营录入的大多是已经发生的历史数据，日期本来就可能"不合常理"，
     * 拦下来只会逼他们改数据去迁就系统。
     *
     * <p>所属领域与需求同一套现场口径（零售／MKT 等）。历史行仍可能是作战单元编码，
     * 那些编码继续合法，避免改一条旧课就被拒。课程分类仍查字典。
     */
    private void validate(CourseForm form) {
        requireIn(CourseEnums.REVIEW_TRACKS, form.reviewTrack(), "评审轨道");
        requireIn(CourseEnums.VALIDITY_PERIODS, form.validityPeriod(), "课程有效期");

        if (!isAllowedDomain(form.domainCode())) {
            throw new BizException(ErrorCode.PARAM_INVALID,
                    "所属领域只能是：%s".formatted(String.join(" / ", BusinessDomains.NAMES)));
        }
        if (form.categoryCode() != null && !form.categoryCode().isBlank()
                && !dicts.enabledCodeSet(DictQuery.TYPE_COURSE_CATEGORY).contains(form.categoryCode())) {
            throw new BizException(ErrorCode.PARAM_INVALID,
                    "「%s」不在课程分类字典中".formatted(form.categoryCode()));
        }

        if (form.qualityMarks() != null) {
            form.qualityMarks().forEach(mark -> requireIn(CourseEnums.QUALITY_MARKS, mark, "精品标注"));
        }
        if (form.classHours() != null && form.classHours().signum() < 0) {
            throw new BizException(ErrorCode.PARAM_INVALID, "课时不能为负数");
        }
    }

    private void validateDevelopment(CourseDevelopmentForm form) {
        String flag = blankToNull(form.enterSelfCheck());
        if (flag != null && !CourseEnums.YES_NO.contains(flag)) {
            throw new BizException(ErrorCode.PARAM_INVALID,
                    "是否进入课程自检只能是：%s".formatted(String.join(" / ", CourseEnums.YES_NO)));
        }
    }

    private void validateSelfcheckInfo(CourseSelfcheckInfoForm form) {
        requireDictCode(DictQuery.TYPE_COURSE_SELFCHECK_RECORD_STATUS,
                form.selfcheckRecordStatus(), "自检状态");
        requireDictCode(DictQuery.TYPE_COURSE_SELFCHECK_CONCLUSION,
                form.selfcheckConclusion(), "自检总体结论");
        String flag = blankToNull(form.submitExpertReview());
        if (flag != null && !CourseEnums.YES_NO.contains(flag)) {
            throw new BizException(ErrorCode.PARAM_INVALID,
                    "是否提交专家评审只能是：%s".formatted(String.join(" / ", CourseEnums.YES_NO)));
        }
        if (form.specAnswers() != null) {
            form.specAnswers().forEach((code, value) -> {
                if (value == null || value.isBlank()) {
                    return;
                }
                if (!CourseSelfcheckSpec.CODES.contains(code)) {
                    throw new BizException(ErrorCode.PARAM_INVALID, "未知的自检清单项：" + code);
                }
                if (!CourseEnums.YES_NO.contains(value)) {
                    throw new BizException(ErrorCode.PARAM_INVALID,
                            "是否符合要求只能是：%s".formatted(String.join(" / ", CourseEnums.YES_NO)));
                }
            });
        }
    }

    private void validateReviewLedger(CourseReviewLedgerForm form) {
        String round = blankToNull(form.reviewRoundLabel());
        if (round != null && !CourseEnums.REVIEW_ROUND_LABELS.contains(round)) {
            throw new BizException(ErrorCode.PARAM_INVALID,
                    "评审轮数只能是：%s".formatted(String.join(" / ", CourseEnums.REVIEW_ROUND_LABELS)));
        }
        String prelimRound = blankToNull(form.prelimRoundLabel());
        if (prelimRound != null && !CourseEnums.REVIEW_ROUND_LABELS.contains(prelimRound)) {
            throw new BizException(ErrorCode.PARAM_INVALID,
                    "初步评审轮数只能是：%s".formatted(String.join(" / ", CourseEnums.REVIEW_ROUND_LABELS)));
        }
        String meetingRound = blankToNull(form.meetingRoundLabel());
        if (meetingRound != null && !CourseEnums.REVIEW_ROUND_LABELS.contains(meetingRound)) {
            throw new BizException(ErrorCode.PARAM_INVALID,
                    "上会评审轮数只能是：%s".formatted(String.join(" / ", CourseEnums.REVIEW_ROUND_LABELS)));
        }
        requireDictCode(DictQuery.TYPE_COURSE_REVIEW_PHASE, form.reviewLedgerPhase(), "当前评审阶段");
        requireDictCode(DictQuery.TYPE_COURSE_REVIEW_LEDGER_STATUS, form.reviewLedgerStatus(), "评审状态");
        requireDictCode(DictQuery.TYPE_PRELIM_REVIEW_CONCLUSION, form.prelimConclusion(), "初步评审结论");
        requireDictCode(DictQuery.TYPE_MEETING_CONCLUSION, form.meetingConclusion(), "上会最终结论");
        String enterTrial = blankToNull(form.enterTrial());
        if (enterTrial != null && !CourseEnums.YES_NO.contains(enterTrial)) {
            throw new BizException(ErrorCode.PARAM_INVALID,
                    "是否进入试讲环节只能是：%s".formatted(String.join(" / ", CourseEnums.YES_NO)));
        }
        String enterMeeting = blankToNull(form.enterMeeting());
        if (enterMeeting != null && !CourseEnums.YES_NO.contains(enterMeeting)) {
            throw new BizException(ErrorCode.PARAM_INVALID,
                    "是否进入上会评审环节只能是：%s".formatted(String.join(" / ", CourseEnums.YES_NO)));
        }
    }

    private void validateTrialLedger(CourseTrialLedgerForm form) {
        String round = blankToNull(form.trialRoundLabel());
        if (round != null && !CourseEnums.REVIEW_ROUND_LABELS.contains(round)) {
            throw new BizException(ErrorCode.PARAM_INVALID,
                    "试讲轮数只能是：%s".formatted(String.join(" / ", CourseEnums.REVIEW_ROUND_LABELS)));
        }
        requireDictCode(DictQuery.TYPE_COURSE_TRIAL_PHASE, form.trialCurrentPhase(), "试讲当前阶段");
        requireDictCode(DictQuery.TYPE_COURSE_TRIAL_LEDGER_STATUS, form.trialLedgerStatus(), "试讲状态");
        requireDictCode(DictQuery.TYPE_COURSE_TRIAL_FORMAT, form.trialFormat(), "试讲形式");
        requireDictCode(DictQuery.TYPE_TRIAL_ACCEPTANCE_RESULT, form.trialAcceptanceResult(), "试讲验收结果");
        if (form.trialHours() != null && form.trialHours().signum() < 0) {
            throw new BizException(ErrorCode.PARAM_INVALID, "试讲时长不能为负数");
        }
        String ready = blankToNull(form.trialReadyToPublish());
        if (ready != null && !CourseEnums.YES_NO.contains(ready)) {
            throw new BizException(ErrorCode.PARAM_INVALID,
                    "课程是否满足发布要求只能是：%s".formatted(String.join(" / ", CourseEnums.YES_NO)));
        }
        String qualified = blankToNull(form.trialLecturerQualified());
        if (qualified != null && !CourseEnums.YES_NO.contains(qualified)) {
            throw new BizException(ErrorCode.PARAM_INVALID,
                    "讲师试讲是否合格只能是：%s".formatted(String.join(" / ", CourseEnums.YES_NO)));
        }
    }

    private void validateInitiation(CourseInitiationForm form) {
        if (form.estimateDevDays() != null && form.estimateDevDays().signum() < 0) {
            throw new BizException(ErrorCode.PARAM_INVALID, "预估开发工时不能为负数");
        }
        requireDictCode(DictQuery.TYPE_COURSE_INITIATION_STATUS, form.initiationStatus(), "立项状态");
        requireDictCode(DictQuery.TYPE_COURSE_INITIATION_REVIEW_CONCLUSION,
                form.initiationReviewConclusion(), "立项评审结论");
    }

    private void requireDictCode(String dictType, String code, String label) {
        if (code == null || code.isBlank()) {
            return;
        }
        if (!dicts.enabledCodeSet(dictType).contains(code)) {
            throw new BizException(ErrorCode.PARAM_INVALID,
                    "「%s」不在%s字典中".formatted(code, dictType));
        }
    }

    private boolean isAllowedDomain(String value) {
        return BusinessDomains.contains(value)
                || dicts.enabledCodeSet(DictQuery.TYPE_COMBAT_UNIT).contains(value)
                || dicts.enabledNameSet(DictQuery.TYPE_COMBAT_UNIT).contains(value);
    }

    private static void requireIn(List<String> allowed, String value, String label) {
        if (!allowed.contains(value)) {
            throw new BizException(ErrorCode.PARAM_INVALID,
                    "%s只能是：%s".formatted(label, String.join(" / ", allowed)));
        }
    }

    /**
     * 冲突提示带上最后修改时间与修改人。
     *
     * <p>共享账号下界面看不出还有别人在操作，只说一句「保存失败」，运营会当成系统 bug 反复重试
     * （开发 5.10）。
     */
    private static BizException concurrentModified(Course current) {
        return new BizException(ErrorCode.CONCURRENT_MODIFIED,
                "该记录已被他人修改（最后修改：%s），请刷新后重试"
                        .formatted(DisplayTime.human(current.getUpdatedAt())));
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    private static String operator() {
        return OperatorContext.current().account().name();
    }
}
