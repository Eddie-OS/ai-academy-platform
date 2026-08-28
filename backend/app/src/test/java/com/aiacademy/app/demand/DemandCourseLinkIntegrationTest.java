package com.aiacademy.app.demand;

import com.aiacademy.app.application.CourseApplicationService;
import com.aiacademy.app.application.DemandApplicationService;
import com.aiacademy.app.application.DemandCourseLinkService;
import com.aiacademy.app.support.IntegrationTest;
import com.aiacademy.business.course.domain.CourseForm;
import com.aiacademy.business.course.domain.CourseQuery;
import com.aiacademy.business.demand.domain.DemandCourseLinkForm;
import com.aiacademy.business.demand.domain.DemandForm;
import com.aiacademy.business.demand.domain.DemandQuery;
import com.aiacademy.business.course.service.CourseService;
import com.aiacademy.business.demand.service.DemandService;
import com.aiacademy.common.audit.OperatorAccount;
import com.aiacademy.common.audit.OperatorContext;
import com.aiacademy.common.exception.NotFoundException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 需求↔课程 N:N 关联的双向维护（阶段 2 B-4，需求 8.4、规则 R1～R4）。
 *
 * <p>重点验证 R4「双向可查」与「解除关联要留痕」：这张表没有 {@code deleted} 列，解除即物理
 * 删除，审计日志是关联变更的唯一历史——不写就等于没发生过。
 */
class DemandCourseLinkIntegrationTest extends IntegrationTest {

    @Autowired
    private DemandCourseLinkService links;

    @Autowired
    private DemandApplicationService demandApplication;

    @Autowired
    private CourseApplicationService courseApplication;

    @Autowired
    private DemandService demands;

    @Autowired
    private CourseService courses;

    @Autowired
    private JdbcTemplate jdbc;

    private String employeeNo;

    @BeforeEach
    void 以运营账号操作() {
        OperatorContext.set(OperatorAccount.OPS, "10.0.0.9");
        employeeNo = 造人员("关联相关人");
    }

    @AfterEach
    void 清理上下文() {
        OperatorContext.clear();
    }

    @Test
    @DisplayName("R4：一次关联，需求侧与课程侧都查得到，两侧各留一条审计")
    void 双向可查() {
        long demandId = 造需求("双向可查");
        long courseId = 造课程("双向可查");

        links.link(demandId, courseId, "覆盖该需求的话术部分");

        assertThat(links.coursesOf(demandId)).singleElement().satisfies(course -> {
            assertThat(course.courseId()).isEqualTo(courseId);
            assertThat(course.mainState()).isEqualTo("立项");
            assertThat(course.ownerName()).isEqualTo("关联相关人");
            assertThat(course.linkNote()).isEqualTo("覆盖该需求的话术部分");
        });
        assertThat(links.demandsOf(courseId)).singleElement().satisfies(demand -> {
            assertThat(demand.demandId()).isEqualTo(demandId);
            assertThat(demand.reviewState()).isEqualTo("待评审");
            assertThat(demand.ownerName()).isEqualTo("关联相关人");
        });

        assertThat(审计(demandId, "DEMAND")).containsExactly("新增|关联课程 #" + courseId);
        assertThat(审计(courseId, "COURSE")).contains("新增|关联需求 #" + demandId);
    }

    @Test
    @DisplayName("K2：重复关联静默成功，不产生第二行关联，也不重复记审计")
    void 重复关联() {
        long demandId = 造需求("重复关联");
        long courseId = 造课程("重复关联");

        links.link(demandId, courseId, "第一次");
        links.link(demandId, courseId, "第一次");

        assertThat(links.coursesOf(demandId)).hasSize(1);
        assertThat(审计(demandId, "DEMAND"))
                .describedAs("两名运营各自从一侧勾选，做的是同一件事，不该记成两次新增")
                .hasSize(1);
    }

    @Test
    @DisplayName("需求 5.12：改关联说明按修改留痕，记字段名与前后值")
    void 改关联说明() {
        long demandId = 造需求("改说明");
        long courseId = 造课程("改说明");
        links.link(demandId, courseId, "旧说明");

        links.link(demandId, courseId, "新说明");

        assertThat(links.coursesOf(demandId)).singleElement()
                .satisfies(course -> assertThat(course.linkNote()).isEqualTo("新说明"));
        assertThat(字段变更(demandId, "DEMAND"))
                .containsExactly("关联说明|旧说明|新说明");
    }

    @Test
    @DisplayName("开发 6.3.1：解除关联是物理删除，历史只剩审计日志这一处")
    void 解除关联() {
        long demandId = 造需求("解除关联");
        long courseId = 造课程("解除关联");
        links.link(demandId, courseId, null);

        links.unlink(demandId, courseId);

        assertThat(links.coursesOf(demandId)).isEmpty();
        assertThat(links.demandsOf(courseId)).isEmpty();
        assertThat(审计(demandId, "DEMAND")).contains("删除|解除关联课程 #" + courseId);
        assertThat(审计(courseId, "COURSE")).contains("删除|解除关联需求 #" + demandId);

        links.unlink(demandId, courseId);
        assertThat(审计(demandId, "DEMAND"))
                .describedAs("再点一次「解除」不该报错，也不该多出一条什么都没删的审计")
                .filteredOn(row -> row.startsWith("删除"))
                .hasSize(1);
    }

    @Test
    @DisplayName("R3：课程可不关联需求，需求也可不衍生课程；列表的「是否有关联」筛选据此工作")
    void 允许无关联() {
        long linkedDemand = 造需求("有关联");
        long linkedCourse = 造课程("有关联");
        links.link(linkedDemand, linkedCourse, null);
        long lonelyDemand = 造需求("无关联");
        long lonelyCourse = 造课程("无关联");

        assertThat(links.coursesOf(lonelyDemand)).isEmpty();
        assertThat(links.demandsOf(lonelyCourse)).isEmpty();

        DemandQuery query = new DemandQuery();
        query.setHasCourse(true);
        assertThat(demands.page(query).records())
                .extracting(item -> item.getId())
                .contains(linkedDemand)
                .doesNotContain(lonelyDemand);

        CourseQuery courseQuery = new CourseQuery();
        courseQuery.setHasDemand(false);
        assertThat(courses.page(courseQuery).records())
                .extracting(item -> item.getId())
                .contains(lonelyCourse)
                .doesNotContain(linkedCourse);
    }

    @Test
    @DisplayName("关联不存在的对象报 NOT_FOUND，不会留下一条指向空对象的关联行")
    void 对象必须存在() {
        long demandId = 造需求("对象校验");

        assertThatThrownBy(() -> links.link(demandId, 999_999_999L, null))
                .isInstanceOf(NotFoundException.class);
        assertThat(links.coursesOf(demandId)).isEmpty();
    }

    @Test
    @DisplayName("关联课程页签可保存 http 外链，非法协议拒绝")
    void 外链可保存() {
        long demandId = 造需求("课程外链");
        demands.updateCourseLink(demandId, new DemandCourseLinkForm("https://example.com/kc", null));
        assertThat(demands.get(demandId).getCourseLink()).isEqualTo("https://example.com/kc");

        assertThatThrownBy(() -> demands.updateCourseLink(demandId,
                new DemandCourseLinkForm("ftp://example.com/kc", null)))
                .hasMessageContaining("http://");
    }

    // -------------------------------------------------------------------------
    // 夹具
    // -------------------------------------------------------------------------

    private long 造需求(String name) {
        return demandApplication.register(new DemandForm(name + System.nanoTime(), "COURSE",
                employeeNo, employeeNo, LocalDate.now().minusDays(10), LocalDate.now().plusDays(30),
                name + " 的业务问题与场景", "部门提出", "效率提升", "P1（重要）"));
    }

    private long 造课程(String name) {
        return courseApplication.initiate(new CourseForm(name + System.nanoTime(),
                "内部端到端课程", "COURSE", employeeNo,
                LocalDate.now().minusDays(30), LocalDate.now().plusDays(30),
                name + " 的简介", "一线客服", new BigDecimal("4.5"), null, null, null,
                "12 个月", "https://example.com/course", List.of()));
    }

    private List<String> 审计(long objectId, String objectType) {
        return jdbc.queryForList("""
                SELECT op_type || '|' || COALESCE(remark, '') FROM audit_op_log
                 WHERE object_type = ? AND object_id = ? AND field_name IS NULL
                 ORDER BY id
                """, String.class, objectType, objectId);
    }

    private List<String> 字段变更(long objectId, String objectType) {
        return jdbc.queryForList("""
                SELECT field_name || '|' || COALESCE(old_value, '') || '|' || COALESCE(new_value, '')
                  FROM audit_op_log
                 WHERE object_type = ? AND object_id = ? AND field_name IS NOT NULL
                 ORDER BY id
                """, String.class, objectType, objectId);
    }

    private String 造人员(String name) {
        String no = "E" + System.nanoTime() % 100000000L;
        jdbc.update("""
                INSERT INTO org_employee (employee_no, employee_name, dept_name, person_type,
                                          person_state, created_by)
                VALUES (?, ?, '数字化部', '学员', '在职', 'operator')
                """, no, name);
        return no;
    }
}
