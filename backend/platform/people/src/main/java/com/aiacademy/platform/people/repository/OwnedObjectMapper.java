package com.aiacademy.platform.people.repository;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.Collection;
import java.util.List;
import java.util.Map;

@Mapper
public interface OwnedObjectMapper {

    /**
     * 查一批工号各自还负责着多少个业务对象（需求 13.9.4 规则 AG1：每个对象有且仅有 1 名负责人）。
     *
     * <p>用途只有一个：人员导入把某人改成「离职」时，需求 14.3 要求给出<b>警告清单</b>，提示运营到
     * 配置中心 Tab 3 批量转移负责人。它是警告不是错误——离职是既成事实，拦住导入不会让人回来上班
     * （开发 5.6.3 细节六）。
     *
     * <p><b>为什么这条 SQL 出现在 platform/people 而不是各业务模块：</b>它要一次问遍四类业务对象，
     * 而 AR-1 禁止业务模块互相依赖，AR-2 禁止平台模块依赖业务模块——用类依赖的方式实现它，
     * 只能在 app 层编排四个业务查询，或者定义一个由四个业务模块各自实现的扩展点。两种做法都为了
     * 一句警告文案付出结构代价。这里的选择是：<b>跨模块的只读聚合查询走 SQL，写操作严守模块边界</b>。
     * 一期单库单实例，负责人列的语义由需求 6.1.3 统一定义，四张表的列名完全一致，SQL 不会因为
     * 某个业务模块内部重构而失效。
     *
     * <p>转移负责人本身（写操作）不在这里，它属于配置中心的应用服务（AR-4）。
     *
     * @return 工号 → 在负责的对象数。数为 0 的工号不出现在结果里
     */
    @Select("""
            <script>
            SELECT owner_no, SUM(cnt) AS cnt FROM (
                SELECT owner_no, COUNT(*) AS cnt FROM biz_demand
                 WHERE deleted = FALSE AND owner_no IN
                 <foreach collection="employeeNos" item="no" open="(" separator="," close=")">#{no}</foreach>
                 GROUP BY owner_no
                UNION ALL
                SELECT owner_no, COUNT(*) AS cnt FROM biz_course
                 WHERE deleted = FALSE AND owner_no IN
                 <foreach collection="employeeNos" item="no" open="(" separator="," close=")">#{no}</foreach>
                 GROUP BY owner_no
                UNION ALL
                SELECT owner_no, COUNT(*) AS cnt FROM biz_training_plan
                 WHERE deleted = FALSE AND owner_no IN
                 <foreach collection="employeeNos" item="no" open="(" separator="," close=")">#{no}</foreach>
                 GROUP BY owner_no
                UNION ALL
                SELECT owner_no, COUNT(*) AS cnt FROM biz_case
                 WHERE deleted = FALSE AND owner_no IN
                 <foreach collection="employeeNos" item="no" open="(" separator="," close=")">#{no}</foreach>
                 GROUP BY owner_no
            ) t GROUP BY owner_no
            </script>
            """)
    List<Map<String, Object>> countOwnedObjects(@Param("employeeNos") Collection<String> employeeNos);
}
