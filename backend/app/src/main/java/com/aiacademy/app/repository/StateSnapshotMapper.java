package com.aiacademy.app.repository;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

/**
 * 状态列的<b>只读</b>快照，服务于 {@code GET /api/{objectType}/{id}/transitions/available}
 * （《开发实施文档》7.4）。
 *
 * <p><b>为什么不用引擎自带的读取：</b>
 * {@link com.aiacademy.platform.statemachine.repository.StateObjectMapper#lockAndSelectState}
 * 带 {@code FOR UPDATE}，那是转换执行路径上必需的行锁（开发 5.10），但 available 是 GET 接口、
 * 跑在 {@code readOnly = true} 的事务里，PostgreSQL 会直接拒绝在只读事务中执行 {@code FOR UPDATE}。
 * 给每个查询可用动作的请求加一把行锁也不合适——它会和正在进行的转换互相等待。
 *
 * <p>阶段 1 的状态机引擎没有留无锁读的入口，而阶段 2 A 段的硬约束是不修改引擎代码，
 * 因此这个只读查询新增在 app 层。<b>这是底座的一处缺口，已记入文档待修清单</b>：
 * 合适的归宿是 platform/statemachine，等有一次可以动引擎的窗口再搬过去。
 *
 * <p>{@code ${}} 的安全性同 {@code StateObjectMapper}：表名与列名只来自
 * {@link com.aiacademy.platform.statemachine.domain.StateObjectMappings} 这张编译期常量表，
 * 没有一条来自请求参数。
 */
@Mapper
public interface StateSnapshotMapper {

    /** @return 当前状态值；对象不存在、已逻辑删除，或该状态字段尚未置值时都返回 null */
    @Select("SELECT ${stateColumn} FROM ${table} WHERE id = #{id} AND deleted = FALSE")
    String selectState(@Param("table") String table,
                       @Param("stateColumn") String stateColumn,
                       @Param("id") long id);

    /** 乐观锁版本号，前端提交转换时要原样带回（规则 K1、K2）。无 version 列的表不要调用。 */
    @Select("SELECT version FROM ${table} WHERE id = #{id} AND deleted = FALSE")
    Integer selectVersion(@Param("table") String table, @Param("id") long id);

    @Select("SELECT COUNT(1) FROM ${table} WHERE id = #{id} AND deleted = FALSE")
    boolean existsById(@Param("table") String table, @Param("id") long id);
}
