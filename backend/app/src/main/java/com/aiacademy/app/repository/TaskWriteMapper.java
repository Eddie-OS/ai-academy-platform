package com.aiacademy.app.repository;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDate;
import java.util.List;

/**
 * 任务写入与派生取数。写路径放在 app（AR-3：worklist 只读查询）。
 */
@Mapper
public interface TaskWriteMapper {

    @Insert("""
            INSERT INTO sys_task (title, task_type, object_type, object_id, owner_no, owner_name,
                                  due_date, task_state, derive_type, created_by)
            VALUES (#{title}, #{taskType}, #{objectType}, #{objectId}, #{ownerNo}, #{ownerName},
                    #{dueDate}, #{taskState}, '系统派生', #{createdBy})
            """)
    @Options(useGeneratedKeys = true, keyProperty = "id", keyColumn = "id")
    int insert(TaskInsert row);

    @Select("""
            SELECT id FROM sys_task
             WHERE object_type = #{objectType} AND object_id = #{objectId}
               AND task_state IN (#{pending}, #{inProgress}) AND deleted = FALSE
            """)
    List<Long> findOpenTaskIds(@Param("objectType") String objectType,
                               @Param("objectId") long objectId,
                               @Param("pending") String pending,
                               @Param("inProgress") String inProgress);

    @Select("""
            SELECT d.demand_name AS object_name, d.owner_no,
                   e.employee_name AS owner_name, CAST(NULL AS DATE) AS due_from_field
              FROM biz_demand d
              LEFT JOIN org_employee e ON e.employee_no = d.owner_no AND e.deleted = FALSE
             WHERE d.id = #{id} AND d.deleted = FALSE
            """)
    ObjectTaskSource loadDemand(@Param("id") long id);

    @Select("""
            SELECT c.course_name AS object_name, c.owner_no,
                   e.employee_name AS owner_name, c.expect_publish_date AS due_from_field
              FROM biz_course c
              LEFT JOIN org_employee e ON e.employee_no = c.owner_no AND e.deleted = FALSE
             WHERE c.id = #{id} AND c.deleted = FALSE
            """)
    ObjectTaskSource loadCourse(@Param("id") long id);

    @Select("""
            SELECT COALESCE(s.session_name, p.plan_name) AS object_name,
                   p.owner_no,
                   e.employee_name AS owner_name,
                   CAST(NULL AS DATE) AS due_from_field
              FROM biz_training_session s
              JOIN biz_training_plan p ON p.id = s.plan_id AND p.deleted = FALSE
              LEFT JOIN org_employee e ON e.employee_no = p.owner_no AND e.deleted = FALSE
             WHERE s.id = #{id} AND s.deleted = FALSE
            """)
    ObjectTaskSource loadTrainingSession(@Param("id") long id);

    @Select("""
            SELECT k.case_name AS object_name, k.owner_no,
                   e.employee_name AS owner_name, CAST(NULL AS DATE) AS due_from_field
              FROM biz_case k
              LEFT JOIN org_employee e ON e.employee_no = k.owner_no AND e.deleted = FALSE
             WHERE k.id = #{id} AND k.deleted = FALSE
            """)
    ObjectTaskSource loadCase(@Param("id") long id);

    record ObjectTaskSource(String objectName, String ownerNo, String ownerName, LocalDate dueFromField) {
    }

    class TaskInsert {
        private Long id;
        private String title;
        private String taskType;
        private String objectType;
        private long objectId;
        private String ownerNo;
        private String ownerName;
        private LocalDate dueDate;
        private String taskState;
        private String createdBy;

        public Long getId() {
            return id;
        }

        public void setId(Long id) {
            this.id = id;
        }

        public String getTitle() {
            return title;
        }

        public void setTitle(String title) {
            this.title = title;
        }

        public String getTaskType() {
            return taskType;
        }

        public void setTaskType(String taskType) {
            this.taskType = taskType;
        }

        public String getObjectType() {
            return objectType;
        }

        public void setObjectType(String objectType) {
            this.objectType = objectType;
        }

        public long getObjectId() {
            return objectId;
        }

        public void setObjectId(long objectId) {
            this.objectId = objectId;
        }

        public String getOwnerNo() {
            return ownerNo;
        }

        public void setOwnerNo(String ownerNo) {
            this.ownerNo = ownerNo;
        }

        public String getOwnerName() {
            return ownerName;
        }

        public void setOwnerName(String ownerName) {
            this.ownerName = ownerName;
        }

        public LocalDate getDueDate() {
            return dueDate;
        }

        public void setDueDate(LocalDate dueDate) {
            this.dueDate = dueDate;
        }

        public String getTaskState() {
            return taskState;
        }

        public void setTaskState(String taskState) {
            this.taskState = taskState;
        }

        public String getCreatedBy() {
            return createdBy;
        }

        public void setCreatedBy(String createdBy) {
            this.createdBy = createdBy;
        }
    }
}
