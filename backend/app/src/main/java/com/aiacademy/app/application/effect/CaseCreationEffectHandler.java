package com.aiacademy.app.application.effect;

import com.aiacademy.app.application.CaseApplicationService;
import com.aiacademy.business.course.domain.Course;
import com.aiacademy.business.course.service.CourseService;
import com.aiacademy.business.kase.service.CaseService;
import com.aiacademy.platform.people.domain.Employee;
import com.aiacademy.platform.people.service.EmployeeService;
import com.aiacademy.platform.statemachine.domain.Effect;
import com.aiacademy.platform.statemachine.domain.machines.CourseStateMachines;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * 副作用 {@code CREATE_CASE}：课程标注达到精品标准时自动创建案例，初始状态「待整理」
 * （需求 5.3.1 第 12 条、议题 27、C16-b）。
 *
 * <p><b>这是一期案例的唯一来源。</b>学员成果与业务侧实践不能直接提交为案例（N10），因此案例
 * 模块没有对外的「新建案例」接口。看到 {@code CaseController} 里只有编辑没有新建时不要补一个。
 *
 * <p>四个初值全部取自课程（需求 12.3 第 2、3、6、7 项），运营随后可改：
 * <ul>
 *   <li>案例名称 ← 课程名称；
 *   <li>来源课程 ← 触发本次转换的课程；
 *   <li>应用领域 ← 课程的所属领域（案例侧是多选，这里给一个单元素数组）；
 *   <li>案例负责人 ← 课程负责人。<b>它不参与判权</b>（需求 12.3 第 7 项、纪律 PMI-4）。
 * </ul>
 *
 * <p>贡献组织在需求 12.3 里是必填的自由文本，而课程上<b>没有任何对应字段</b>——V1.2 把它从
 * 「部门选择」改成自由文本时（N18），课程侧没有同步加列。这里取课程负责人在人员台账上的部门
 * 作为初值：它是此刻能拿到的最接近「这个案例是谁贡献的」的信息。取不到时落「待补充」而不是
 * 空串，让运营在列表上一眼看出哪些需要补——列是 {@code NOT NULL}，落空串会变成一个看不见的坑。
 */
@Component
public class CaseCreationEffectHandler implements EffectHandler {

    private static final Logger log = LoggerFactory.getLogger(CaseCreationEffectHandler.class);

    /** 贡献组织取不到时的占位值。与讲师自动入池时授课方向的处理同一套路。 */
    private static final String ORG_PLACEHOLDER = "待补充";

    private final CourseService courses;
    private final EmployeeService employees;
    private final CaseService cases;
    private final CaseApplicationService application;

    /**
     * {@code @Lazy} 的理由同 {@link CreateReviewRoundEffectHandler}：本处理器由
     * {@link EffectDispatcher} 持有，而 {@code CaseApplicationService} 反过来要经
     * {@code TransitionApplicationService} 用到那个 Dispatcher。副作用引发二次转换
     * （课程转换 → 建案例 → 案例自己的初始转换）天然是这个形状。
     */
    public CaseCreationEffectHandler(CourseService courses, EmployeeService employees,
                                     CaseService cases, @Lazy CaseApplicationService application) {
        this.courses = courses;
        this.employees = employees;
        this.cases = cases;
        this.application = application;
    }

    @Override
    public boolean supports(String effectCode) {
        return Effect.CREATE_CASE.equals(effectCode);
    }

    @Override
    public void handle(EffectContext context, String effectCode) {
        if (!CourseStateMachines.OBJECT_TYPE.equals(context.objectType())) {
            throw new IllegalStateException("CREATE_CASE 只用于课程，收到 " + context.objectType());
        }

        // 幂等（K2）：uk_case_course 保证一门课程至多一个案例。课程从「精品案例」退回再进来时
        // 不该建第二个——那会撞唯一约束，而运营看到的只是一次没有解释的失败
        Long existing = cases.findIdByCourse(context.objectId());
        if (existing != null) {
            log.info("课程 {} 已有案例 {}，本次标注达精品不重复创建", context.objectId(), existing);
            return;
        }

        Course course = courses.require(context.objectId());
        long caseId = application.createFromCourse(course.getId(), course.getCourseName(),
                course.getOwnerNo(), contributingOrgOf(course.getOwnerNo()),
                List.of(course.getDomainCode()));
        log.info("课程 {} 达到精品标准，已创建案例 {}", course.getId(), caseId);
    }

    private String contributingOrgOf(String ownerNo) {
        return employees.findByNo(ownerNo)
                .map(Employee::getDeptName)
                .filter(dept -> dept != null && !dept.isBlank())
                .orElse(ORG_PLACEHOLDER);
    }
}
