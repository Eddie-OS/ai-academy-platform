package com.aiacademy.platform.dataimport.domain;

import java.util.ArrayList;
import java.util.List;

/**
 * 校验产出的写入计划：每一行要做什么（新增／更新／忽略）、更新哪一行。
 *
 * <p><b>为什么校验阶段就要把「新增几条、更新几条」算出来：</b>需求 13.8.3 第 4 步要在确认按钮上方
 * 显示「本次将新增 X 条、更新 Y 条」。这个数字不能在写完之后统计——那时运营已经点了确认。
 * 而要算出它，就必须先按唯一键查一遍已有数据，这一遍查询顺手就决定了每行是新增还是更新，
 * 所以把决定结果留下来给写入阶段用，比写入时再查一遍更省也更不容易两次结论不一致。
 *
 * <p>计划里不含任何数据库写操作，因此可以在校验（上传）与写入（确认）两次请求里各算一次。
 * 确认时必须重算——需求校验与写入之间有时间差，开发 5.6.3 细节一要求写入前重新校验。
 */
public final class ImportPlan {

    private final List<PlannedRow> rows = new ArrayList<>();
    private final List<String> notes = new ArrayList<>();

    public void insert(ImportRow row, Object payload) {
        rows.add(new PlannedRow(row, RowOp.INSERT, null, payload));
    }

    public void update(ImportRow row, long targetId, Object payload) {
        rows.add(new PlannedRow(row, RowOp.UPDATE, targetId, payload));
    }

    /**
     * 忽略该行，不报错。目前只有参训名单导入用到：需求 14.8 明确「同一场次 + 同一工号重复时
     * 忽略，不报错」——名单是「谁要来听课」的集合，重复出现同一个人不是错误，是文件拼接的常态。
     */
    public void skip(ImportRow row) {
        rows.add(new PlannedRow(row, RowOp.SKIP, null, null));
    }

    /** 预览页要显示的提示，如反馈导入的「本场次已有 N 条反馈，本次将追加 M 条」（规则 FB5）。 */
    public void note(String note) {
        notes.add(note);
    }

    public List<PlannedRow> rows() {
        return List.copyOf(rows);
    }

    public List<String> notes() {
        return List.copyOf(notes);
    }

    public int insertRows() {
        return (int) rows.stream().filter(r -> r.op() == RowOp.INSERT).count();
    }

    public int updateRows() {
        return (int) rows.stream().filter(r -> r.op() == RowOp.UPDATE).count();
    }

    public int skipRows() {
        return (int) rows.stream().filter(r -> r.op() == RowOp.SKIP).count();
    }
}
