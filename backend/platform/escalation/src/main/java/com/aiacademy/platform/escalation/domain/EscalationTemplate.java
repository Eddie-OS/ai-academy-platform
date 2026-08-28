package com.aiacademy.platform.escalation.domain;

/**
 * 催办文案模板占位符替换（需求 13.9.5 第 4 项）。
 */
public final class EscalationTemplate {

    private EscalationTemplate() {
    }

    public static String render(String template,
                                String objectName,
                                String currentState,
                                Integer remainingDays,
                                String ownerName) {
        String text = template == null ? "" : template;
        text = text.replace("{对象名称}", nullToEmpty(objectName));
        text = text.replace("{当前状态}", nullToEmpty(currentState));
        text = text.replace("{剩余天数}", remainingDays == null ? "—" : String.valueOf(remainingDays));
        text = text.replace("{负责人姓名}", nullToEmpty(ownerName));
        return text;
    }

    private static String nullToEmpty(String value) {
        return value == null ? "" : value;
    }
}
