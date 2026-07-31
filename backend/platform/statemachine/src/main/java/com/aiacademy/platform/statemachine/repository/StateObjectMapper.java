package com.aiacademy.platform.statemachine.repository;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.OffsetDateTime;

/**
 * 状态列的读写。表名与列名是变量，因此这里是全项目唯一用 {@code ${}} 拼 SQL 的地方。
 *
 * <p><b>为什么可以用 {@code ${}}：</b>表名与列名只来自
 * {@link com.aiacademy.platform.statemachine.domain.StateObjectMappings} 这张编译期常量表，
 * 8 类对象、16 列，全部写死在代码里，<b>没有任何一条来自请求参数</b>。状态值、对象ID、时间戳这些
 * 真正来自外部的值一律走 {@code #{}} 预编译占位符。
 *
 * <p>如果哪天有人想让对象类型或状态字段名从请求里传进来直接拼表名，注入就成立了——防线是
 * {@code StateObjectMappings.require()} 只认已登记的对象类型，未登记的直接抛异常。
 */
@Mapper
public interface StateObjectMapper {

    /**
     * 取当前状态并<b>锁住这一行</b>。
     *
     * <p>{@code FOR UPDATE} 是必需的：同一对象的两次「提交评审」并发时，轮次计算与状态判断都要在
     * 锁内完成（开发 5.10）。乐观锁只能发现冲突，不能防止两个事务同时读到同一个旧状态各自算一遍。
     *
     * @return 当前状态值；对象不存在或已逻辑删除时返回 null
     */
    @Select("SELECT ${stateColumn} FROM ${table} WHERE id = #{id} AND deleted = FALSE FOR UPDATE")
    String lockAndSelectState(@Param("table") String table,
                              @Param("stateColumn") String stateColumn,
                              @Param("id") long id);

    /**
     * 对象是否存在且未被逻辑删除。
     *
     * <p>需要它是因为<b>状态列本身允许为 NULL</b>——需求表格里的「（新建）」「（空）」就是这个含义
     * （见 {@link com.aiacademy.platform.statemachine.domain.Transition} 的 from 参数）。
     * 于是「查状态查出 null」有两种含义，必须再问一次才能分清是「没这条记录」还是「记录在，
     * 但这个状态字段还没置值」。
     */
    @Select("SELECT COUNT(1) FROM ${table} WHERE id = #{id} AND deleted = FALSE")
    boolean existsById(@Param("table") String table, @Param("id") long id);

    /** 取乐观锁版本号。仅用于带 {@code version} 列的三张表（规则 K1）。 */
    @Select("SELECT version FROM ${table} WHERE id = #{id} AND deleted = FALSE")
    Integer selectVersion(@Param("table") String table, @Param("id") long id);

    /**
     * 写状态。<b>{@code last_state_changed_at} 与 {@code updated_at} 都更新，但它们仍是两列</b>：
     * 需求 C5 的红灯判定只看前者，需求 C6 的「最后编辑时间」看后者，改状态确实也是改了这行记录
     * （规则 L1 要求的是两列独立，不是要求改状态时不动 updated_at）。
     *
     * @return 受影响行数。0 表示行已被删除，或版本号已变（见带版本号的重载）
     */
    @Update("""
            UPDATE ${table}
               SET ${stateColumn} = #{toState},
                   last_state_changed_at = #{changedAt},
                   updated_at = #{changedAt},
                   updated_by = #{operator}
             WHERE id = #{id} AND deleted = FALSE
            """)
    int updateState(@Param("table") String table,
                    @Param("stateColumn") String stateColumn,
                    @Param("id") long id,
                    @Param("toState") String toState,
                    @Param("changedAt") OffsetDateTime changedAt,
                    @Param("operator") String operator);

    /**
     * 写状态并推进版本号，同时校验版本号未被他人改动（规则 K1、K2）。
     *
     * <p>版本号自增是 K2 幂等的基础：第一次转换成功后 {@code version} 变了，重复提交带着旧版本号
     * 必然更新到 0 行（开发 5.10）。因此这条 SQL 承担了乐观锁与防重复提交两件事。
     *
     * @return 受影响行数。0 表示版本号已变或行已被删除
     */
    @Update("""
            UPDATE ${table}
               SET ${stateColumn} = #{toState},
                   last_state_changed_at = #{changedAt},
                   updated_at = #{changedAt},
                   updated_by = #{operator},
                   version = version + 1
             WHERE id = #{id} AND deleted = FALSE AND version = #{expectedVersion}
            """)
    int updateStateWithVersion(@Param("table") String table,
                               @Param("stateColumn") String stateColumn,
                               @Param("id") long id,
                               @Param("toState") String toState,
                               @Param("changedAt") OffsetDateTime changedAt,
                               @Param("operator") String operator,
                               @Param("expectedVersion") int expectedVersion);
}
