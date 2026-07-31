package com.aiacademy.platform.people.repository;

import com.aiacademy.platform.people.domain.Employee;
import com.aiacademy.platform.people.domain.EmployeeForm;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface EmployeeMapper extends BaseMapper<Employee> {

    /**
     * 按工号查在册人员。
     *
     * <p>人员导入以工号为唯一键做「存在则更新」（需求 14.3），签到、参训名单、讲师、两类反馈
     * 五种导入都要靠它校验工号是否存在——这是导入校验的唯一依据（开发 6.2.1）。
     *
     * <p>带 {@code deleted = FALSE}：规则 SEC2 全系统逻辑删除，查询一律过滤已删除行。
     */
    @Select("SELECT * FROM org_employee WHERE employee_no = #{employeeNo} AND deleted = FALSE")
    Employee findByNo(@Param("employeeNo") String employeeNo);

    /**
     * 整行覆盖除工号以外的全部字段（需求 14.3：工号已存在则更新其余全部字段）。
     *
     * <p><b>不用 MyBatis-Plus 的 {@code updateById}</b>：它默认只更新非 null 字段，于是导入文件里
     * 留空的单元格会变成「保持原值」而不是「清空」，与 14.3 的「更新其余全部字段」不符。这条 SQL
     * 把语义写死成整行覆盖，不给隐式行为留空间。
     */
    @Update("""
            UPDATE org_employee
               SET employee_name = #{form.employeeName},
                   dept_name = #{form.deptName},
                   position = #{form.position},
                   email = #{form.email},
                   person_type = #{form.personType},
                   person_state = #{form.personState},
                   import_batch_no = #{form.importBatchNo},
                   updated_at = NOW(),
                   updated_by = #{operator}
             WHERE id = #{id} AND deleted = FALSE
            """)
    int updateAllFields(@Param("id") long id,
                        @Param("form") EmployeeForm form,
                        @Param("operator") String operator);

    /**
     * 逻辑删除（规则 SEC2）。
     *
     * <p>顺带写 {@code updated_at / updated_by}：删除也是一次更新，不记就没人知道是谁在什么时候
     * 删的（开发 6.1.2）。MyBatis-Plus 的 {@code @TableLogic} 自动删除只改 {@code deleted} 一列，
     * 所以这里手写。
     */
    @Update("""
            UPDATE org_employee
               SET deleted = TRUE, updated_at = NOW(), updated_by = #{operator}
             WHERE id = #{id} AND deleted = FALSE
            """)
    int logicalDelete(@Param("id") long id, @Param("operator") String operator);
}
