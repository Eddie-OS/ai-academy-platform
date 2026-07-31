package com.aiacademy.platform.dataimport;

import com.aiacademy.platform.dataimport.domain.ImportPlan;
import com.aiacademy.platform.dataimport.domain.ImportProblems;
import com.aiacademy.platform.dataimport.domain.ImportRow;
import com.aiacademy.platform.dataimport.domain.ImportTemplateSpec;
import com.aiacademy.platform.dataimport.domain.ImportType;

import java.util.List;

/**
 * 一类导入的业务处理器（TD-6）。<b>6 类导入 = 6 个实现，一个都不许合并。</b>
 *
 * <p>需求 14.7 表末专门就此警告过：学员反馈与试讲反馈两个模板长得几乎一样，
 * 「开发不要用同一个 Service 加一个 type 参数来处理——建议明确写两个导入处理器，
 * 宁可有重复代码，也不要在指标口径上出错」。两者的关联键、目标表、是否计入讲师平均评分
 * 三处完全不同，而错的那一处（评分口径）在界面上看不出来。
 *
 * <p>框架负责的部分，实现类<b>不要重复做</b>：文件解析、表头校验、示例行跳过、5000 行上限、
 * 必填与字数校验（{@link ImportTemplateSpec} 已声明）、批次号生成、幂等、行快照、错误报告、
 * 审计日志、事务边界、撤销。实现类只负责两件事：业务校验、逐行写入。
 *
 * <p>实现类是 Spring 单例，<b>不得持有任何跨行状态</b>：预加载的引用数据放在
 * {@link #plan} 的局部变量里，通过 {@code PlannedRow.payload} 传给写入阶段。
 */
public interface ImportHandler {

    ImportType type();

    /** 模板列声明。模板文件由它生成，上传文件的表头也由它校验，两者不可能分叉。 */
    ImportTemplateSpec template();

    /**
     * 业务校验 + 生成写入计划。<b>不得写任何数据。</b>
     *
     * <p>校验（上传）与写入（确认）是两次 HTTP 请求，本方法在两次里各跑一遍：第二遍是开发 5.6.3
     * 细节一要求的「写入前在事务内重新校验」——第一遍通过时那个场次还在，运营点确认之前它可能已经
     * 被删了。
     *
     * <p><b>引用数据必须批量预加载</b>（开发 5.6.3 细节三）：5000 行逐行 {@code SELECT} 会让 P4
     * 的 60 秒预算全花在往返上。正确做法是先收集本次文件里全部工号／场次号，一次 {@code IN} 查询
     * 建 Map，再逐行查 Map。
     */
    ImportPlan plan(List<ImportRow> rows, ImportProblems problems);

    /**
     * 逐行写入。
     *
     * <p><b>全部写操作必须经由 {@code writer}</b>：它在写之前取前值快照、写之后回填目标行 ID
     * （{@code import_row_snapshot}），批次撤销（规则 RB2）完全依赖这份快照。绕过 writer 直接调
     * Mapper 的行，撤销时会被静默漏掉——数据回滚不全，而且没有任何报错。
     */
    void write(ImportPlan plan, ImportRowWriter writer);
}
