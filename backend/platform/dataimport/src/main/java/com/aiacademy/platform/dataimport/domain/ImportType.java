package com.aiacademy.platform.dataimport.domain;

/**
 * 6 类导入（需求 13.8.2、第 14 章）。V1.2 删组织架构（N18、C03）、加两类反馈（C11、C12），5 类变 6 类。
 *
 * <p><b>两类反馈刻意分成两个枚举值、两个 Handler。</b>需求 14.7 表末专门警告过这一点：两个模板
 * 长得几乎一样，但关联键（场次／试讲记录）、目标表、是否计入讲师平均评分三处完全不同，
 * 「宁可有重复代码，也不要在指标口径上出错」。
 */
public enum ImportType {

    PEOPLE("人员", "RY", "人员导入模板.xlsx", false),
    ATTENDANCE("签到", "QD", "签到导入模板.xlsx", false),
    LECTURER("讲师", "JS", "讲师导入模板.xlsx", false),
    ATTENDEE("参训名单", "MD", "参训名单导入模板.xlsx", false),
    TRAINING_FEEDBACK("学员反馈", "XF", "学员反馈导入模板.xlsx", true),
    TRIAL_FEEDBACK("试讲反馈", "SF", "试讲反馈导入模板.xlsx", true);

    private final String label;
    private final String abbr;
    private final String templateFileName;
    private final boolean appendOnly;

    ImportType(String label, String abbr, String templateFileName, boolean appendOnly) {
        this.label = label;
        this.abbr = abbr;
        this.templateFileName = templateFileName;
        this.appendOnly = appendOnly;
    }

    /** 中文名。落 {@code import_batch.import_type}，与该列的 CHECK 约束逐字一致。 */
    public String label() {
        return label;
    }

    /**
     * 批次号前缀（规则 I5「对象类型缩写 + 年月日时分秒」）。
     *
     * <p><b>缩写是本项目定的，两份文档都没给。</b>取拼音首字母，与需求既有的 ID 规则同一路子
     * （需求 XQ、计划 JH、讲师 JS）。定在这里而不是散在各 Handler 里，是因为它同时出现在批次号、
     * 文件目录名与测试断言中，三处不一致会让「按批次号找原文件」失效。
     */
    public String abbr() {
        return abbr;
    }

    /** 模板文件名，与需求 14.3～14.8 各节首行的文件名逐字一致。 */
    public String templateFileName() {
        return templateFileName;
    }

    /**
     * 追加语义（规则 I9、FB4）：只新增、不按唯一键更新，因此 {@code update_rows} 恒为 0
     * （需求 13.8.4 第 6 项），撤销时整批逻辑删除即可（RB7）。
     *
     * <p>两类反馈为真，其余四类为假。这不是实现偏好：反馈没有业务唯一键——同一场次同一个人
     * 可以交两份反馈，匿名行更是连人都识别不出，去重会把真实数据判成重复。
     */
    public boolean appendOnly() {
        return appendOnly;
    }

    public static ImportType ofLabel(String label) {
        for (ImportType type : values()) {
            if (type.label.equals(label)) {
                return type;
            }
        }
        throw new IllegalArgumentException("未知的导入类型：" + label);
    }

    /**
     * 接口入参用的解析：URL 名（{@code training-feedback}）、枚举名（{@code TRAINING_FEEDBACK}）
     * 与中文名（{@code 学员反馈}）都收。
     *
     * <p>连字符必须收：规则 API-1 要求路径用小写连字符，因此 URL 里出现的是
     * {@code /api/imports/templates/training-feedback}，而枚举名带下划线。只认下划线等于
     * 让接口自己违反命名规则，或者在每个 Controller 里手工替换一次。
     *
     * <p>中文名也收是因为批次列表的筛选条件由前端把界面上的中文原样回传更省事。
     * 抛 {@link com.aiacademy.common.exception.BizException} 而不是
     * {@link IllegalArgumentException}，是为了让 URL 拼错时返回 400 而不是 500。
     */
    public static ImportType of(String code) {
        String normalized = code == null ? "" : code.replace('-', '_');
        for (ImportType type : values()) {
            if (type.name().equalsIgnoreCase(normalized) || type.label.equals(code)) {
                return type;
            }
        }
        throw new com.aiacademy.common.exception.BizException(
                com.aiacademy.common.api.ErrorCode.PARAM_INVALID, "未知的导入类型：" + code);
    }
}
