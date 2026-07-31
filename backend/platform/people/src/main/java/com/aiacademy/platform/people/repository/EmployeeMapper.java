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
     * 批量按工号查在册人员。
     *
     * <p><b>这是 P4 能不能达标的关键一条</b>（开发 5.6.3 细节三）：六类导入里有五类要校验工号存在，
     * 5000 行逐行 {@code findByNo} 就是 5000 次往返，60 秒预算全花在这上面。正确做法是先收集本次
     * 文件里全部工号，一次 {@code IN} 查询建 Map，再逐行查 Map。
     *
     * <p>调用方须保证集合非空——MyBatis 的 {@code foreach} 对空集合会生成 {@code IN ()}，
     * PostgreSQL 直接报语法错。
     */
    @Select("""
            <script>
            SELECT * FROM org_employee
             WHERE deleted = FALSE AND employee_no IN
             <foreach collection="employeeNos" item="no" open="(" separator="," close=")">#{no}</foreach>
            </script>
            """)
    java.util.List<Employee> findByNos(@Param("employeeNos") java.util.Collection<String> employeeNos);

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
