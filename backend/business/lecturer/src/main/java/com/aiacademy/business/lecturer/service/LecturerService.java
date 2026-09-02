package com.aiacademy.business.lecturer.service;

import com.aiacademy.business.lecturer.domain.Lecturer;
import com.aiacademy.business.lecturer.domain.LecturerEnums;
import com.aiacademy.business.lecturer.domain.LecturerForm;
import com.aiacademy.business.lecturer.repository.LecturerMapper;
import com.aiacademy.common.api.ErrorCode;
import com.aiacademy.common.audit.OperatorContext;
import com.aiacademy.common.exception.BizException;
import com.aiacademy.common.exception.NotFoundException;
import com.aiacademy.common.json.JsonArrays;
import com.aiacademy.platform.people.domain.Employee;
import com.aiacademy.platform.people.service.EmployeeService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.regex.Pattern;

/**
 * 讲师主表的读写（需求 10.3、10.4）。
 *
 * <p><b>这里没有状态机。</b>培养状态与在池状态都是自由选择的枚举（规则 TS1、C10），改值只写
 * 操作审计日志。把它们做成状态机会让「把讲师从可上岗改回培养中」这种纯粹的信息修正污染流转统计，
 * 而效率指标恰恰是按流转日志算的。
 *
 * <p><b>这里也没有判权。</b>讲师没有 owner 字段，能不能写只取决于登录的是哪个账号（PMI-4）。
 */
@Service
public class LecturerService {

    /** 需求 10.4 末段的「待补充」标记。列是 NOT NULL，占位文本比空串更能说明它需要人来填。 */
    private static final String TO_BE_FILLED = "待补充";

    /** 平台现成 60 张：male_01～30 / female_01～30。 */
    private static final Pattern AVATAR_PRESET =
            Pattern.compile("^(male|female)_(0[1-9]|[12][0-9]|30)$");

    private final LecturerMapper mapper;
    private final EmployeeService employees;

    public LecturerService(LecturerMapper mapper, EmployeeService employees) {
        this.mapper = mapper;
        this.employees = employees;
    }

    /**
     * 运营手动添加讲师（需求 10.4 第 2 行）。
     *
     * <p>入池方式与入池时间由这条路径本身决定，不从表单来：手动添加就是「运营手动添加」，
     * 入池时间就是今天。
     */
    @Transactional
    public long createManually(LecturerForm form) {
        return create(form, LecturerEnums.JOIN_MANUAL);
    }

    private long create(LecturerForm form, String joinType) {
        validate(form, null);

        Lecturer lecturer = new Lecturer();
        applyForm(lecturer, form);
        return insert(lecturer, joinType);
    }

    /**
     * 课程开发人员自动入池（需求 10.4 第 1 行、规则 TS3）。
     *
     * <p>由 app 层在立项／编辑课程写入负责人后调用；讲师模块不认识课程（AR-1）。
     *
     * <p><b>这条路径不抛异常。</b>工号已在池中就什么都不做——编辑课程时每次都会走到这里，
     * 重复建会撞唯一约束，把一次正常的课程编辑变成一个看不懂的失败。工号不在人员台账里也只是
     * 跳过：课程立项本身不校验负责人工号（规则 C2 不加业务前置条件），自动入池更不该反过来
     * 成为立项的拦路条件。
     *
     * <p>两处与手动添加不同的默认值，都来自需求：
     * <ul>
     *   <li>培养状态取「培养中」而不是「待培养」（TS3）——自动入池的人已经在做课程，比全新讲师靠前；
     *   <li>擅长领域与授课方向<b>留空并标记「待补充」</b>（需求 10.4 末段），由运营后续补齐。
     *       这两列在库里是 NOT NULL，所以「留空」落成空数组与一句占位文本。
     * </ul>
     */
    @Transactional
    public void ensureCourseOwnerInPool(String employeeNo) {
        if (employeeNo == null || employeeNo.isBlank()) {
            return;
        }
        String no = employeeNo.trim();
        if (mapper.selectIdByEmployeeNo(no) != null) {
            return;
        }
        Employee employee = employees.findByNo(no).orElse(null);
        if (employee == null) {
            return;
        }

        Lecturer lecturer = new Lecturer();
        lecturer.setLecturerName(employee.getEmployeeName());
        lecturer.setEmployeeNo(no);
        lecturer.setSourceDept(blankToDefault(employee.getDeptName()));
        // 列是 JSONB NOT NULL，「留空」只能落成空数组
        lecturer.setExpertiseDomains("[]");
        lecturer.setTeachingDirection(TO_BE_FILLED);
        lecturer.setTrainingState(LecturerEnums.TRAINING_IN_PROGRESS);
        lecturer.setDutyState(LecturerEnums.DUTY_PAUSED);
        lecturer.setLecturerLevel(LecturerEnums.LEVELS.get(0));
        lecturer.setPoolState(LecturerEnums.POOL_IN);
        insert(lecturer, LecturerEnums.JOIN_AUTO_COURSE_OWNER);
    }

    private long insert(Lecturer lecturer, String joinType) {
        mapper.lockLecturerNoSequence();
        lecturer.setLecturerNo(mapper.nextLecturerNo());
        lecturer.setJoinType(joinType);
        if (lecturer.getJoinedDate() == null) {
            lecturer.setJoinedDate(LocalDate.now());
        }
        if (lecturer.getProfileMaintainer() == null || lecturer.getProfileMaintainer().isBlank()) {
            lecturer.setProfileMaintainer(operator());
        }
        return mapper.insert(lecturer, operator());
    }

    @Transactional
    public void update(long id, LecturerForm form) {
        validate(form, id);
        Lecturer existing = requireExisting(id);

        Lecturer lecturer = new Lecturer();
        applyForm(lecturer, form);
        lecturer.setId(id);
        if (lecturer.getJoinedDate() == null) {
            lecturer.setJoinedDate(existing.getJoinedDate());
        }
        if (mapper.update(lecturer, operator()) == 0) {
            throw new NotFoundException("讲师不存在或已删除：" + id);
        }
    }

    /** 逻辑删除（SEC2）。引用检查在 app 层做——引用方是培训场次与试讲记录，都在别的模块。 */
    @Transactional
    public void softDelete(long id) {
        if (mapper.softDelete(id, operator()) == 0) {
            throw new NotFoundException("讲师不存在或已删除：" + id);
        }
    }

    /**
     * 试讲讲师结论 = 合格时置试讲合格标记（需求 10.3 第 9、10 项）。
     * 由 app 层的 {@code UPDATE_LECTURER_TRIAL_FLAG} 副作用处理器调用。
     */
    @Transactional
    public void markTrialQualified(long id, LocalDate qualifiedDate) {
        if (mapper.markTrialQualified(id, qualifiedDate, operator()) == 0) {
            throw new NotFoundException("讲师不存在或已删除：" + id);
        }
    }

    @Transactional(readOnly = true)
    public Lecturer get(long id) {
        return requireExisting(id);
    }

    private Lecturer requireExisting(long id) {
        Lecturer lecturer = mapper.selectById(id);
        if (lecturer == null) {
            throw new NotFoundException("讲师不存在或已删除：" + id);
        }
        return lecturer;
    }

    private void applyForm(Lecturer lecturer, LecturerForm form) {
        lecturer.setLecturerName(form.lecturerName().trim());
        lecturer.setEmployeeNo(form.employeeNo().trim());
        lecturer.setSourceDept(form.sourceDept().trim());
        lecturer.setExpertiseDomains(JsonArrays.toJson(form.expertiseDomains()));
        lecturer.setTeachingDirection(form.teachingDirection().trim());
        lecturer.setPoolState(form.poolState());
        lecturer.setRemovedReason(blankToNull(form.removedReason()));
        applyAvatar(lecturer, form);
        lecturer.setLecturerLevel(blankToDefaultLevel(form.lecturerLevel()));
        lecturer.setCapabilityTags(blankToNull(form.capabilityTags()));
        lecturer.setAvailableTime(blankToNull(form.availableTime()));
        String duty = resolveDutyState(form);
        lecturer.setDutyState(duty);
        lecturer.setTrainingState(LecturerEnums.trainingStateOf(duty));
        lecturer.setScheduleLimit(blankToNull(form.scheduleLimit()));
        lecturer.setJoinedDate(form.joinedDate());
        lecturer.setProfileMaintainer(blankToNull(form.profileMaintainer()));
        lecturer.setRemark(blankToNull(form.remark()));
    }

    /**
     * 表单校验。
     *
     * <p>枚举值在这里校验而不是只靠表上的 CHECK 约束：约束报出来的是
     * {@code violates check constraint "ck_lecturer_training_state"}，运营看不懂，
     * 而错误码要求 {@code message} 是可直接展示的中文（开发 7.2）。
     */
    private void validate(LecturerForm form, Long excludeId) {
        String employeeNo = form.employeeNo().trim();
        if (employees.findByNo(employeeNo).isEmpty()) {
            throw new BizException(ErrorCode.PARAM_INVALID,
                    "工号「%s」不在人员台账中，请先在导入中心导入人员".formatted(employeeNo));
        }
        if (mapper.existsByEmployeeNo(employeeNo, excludeId)) {
            throw new BizException(ErrorCode.BIZ_RULE_VIOLATED,
                    "工号「%s」已在讲师池中，同一个人不能重复入池".formatted(employeeNo));
        }
        String duty = resolveDutyState(form);
        if (!LecturerEnums.DUTY_STATES.contains(duty)) {
            throw new BizException(ErrorCode.PARAM_INVALID,
                    "上岗状态只能是：" + String.join("／", LecturerEnums.DUTY_STATES));
        }
        String preset = blankToNull(form.avatarPreset());
        if (preset != null && !AVATAR_PRESET.matcher(preset).matches()) {
            throw new BizException(ErrorCode.PARAM_INVALID, "请从平台现有的 60 张头像中选择");
        }
        if (!LecturerEnums.LEVELS.contains(blankToDefaultLevel(form.lecturerLevel()))) {
            throw new BizException(ErrorCode.PARAM_INVALID,
                    "讲师等级只能是：" + String.join("／", LecturerEnums.LEVELS));
        }
        if (!LecturerEnums.POOL_STATES.contains(form.poolState())) {
            throw new BizException(ErrorCode.PARAM_INVALID,
                    "在池状态只能是：" + String.join("／", LecturerEnums.POOL_STATES));
        }
        // 需求 10.3 第 15 项：移出原因在「已移出」时必填。跨字段条件必填，注解表达不了
        if (LecturerEnums.POOL_OUT.equals(form.poolState()) && blankToNull(form.removedReason()) == null) {
            throw new BizException(ErrorCode.PARAM_INVALID, "移出讲师池时必须填写移出原因");
        }
        List<String> domains = form.expertiseDomains() == null ? List.of() : form.expertiseDomains();
        if (domains.stream().noneMatch(item -> item != null && !item.isBlank())) {
            throw new BizException(ErrorCode.PARAM_INVALID, "请填写擅长领域");
        }
    }

    /**
     * 上传优先：有附件就清掉预设，避免详情页两张脸。
     */
    private static void applyAvatar(Lecturer lecturer, LecturerForm form) {
        Long attachmentId = form.avatarAttachmentId();
        if (attachmentId != null) {
            lecturer.setAvatarAttachmentId(attachmentId);
            lecturer.setAvatarPreset(null);
            return;
        }
        lecturer.setAvatarAttachmentId(null);
        lecturer.setAvatarPreset(blankToNull(form.avatarPreset()));
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    private static String blankToDefault(String value) {
        return value == null || value.isBlank() ? TO_BE_FILLED : value;
    }

    private static String blankToDefaultLevel(String value) {
        return value == null || value.isBlank() ? LecturerEnums.LEVELS.get(0) : value;
    }

    private static String resolveDutyState(LecturerForm form) {
        if (form.dutyState() != null && !form.dutyState().isBlank()) {
            return form.dutyState();
        }
        if (form.trainingState() != null && !form.trainingState().isBlank()) {
            return LecturerEnums.dutyStateOf(form.trainingState());
        }
        return LecturerEnums.DUTY_PAUSED;
    }

    private static String operator() {
        return OperatorContext.current().account().name();
    }
}
