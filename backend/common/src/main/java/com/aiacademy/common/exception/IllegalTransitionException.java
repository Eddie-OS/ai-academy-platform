package com.aiacademy.common.exception;

import com.aiacademy.common.api.ErrorCode;
import java.util.Map;

/**
 * 状态机非法转换。需求文档 5.1 规则 C3：<b>转换表中未列出的组合即为非法，硬阻断</b>。
 *
 * <p>硬阻断的位置必须在服务层，不能只在前端隐藏按钮（CLAUDE.md 第八节第 3 条）。
 * 共享账号下 2–4 名运营并行录入，前端看到的可用动作随时可能已经过期。
 *
 * <p>message 直接面向使用者，形如「当前状态为「立项」，不能执行「提交评审」」；
 * context 带上 currentState 与 action 供前端做精细提示（《开发实施文档》7.2）。
 */
public class IllegalTransitionException extends BizException {

    public IllegalTransitionException(String currentState, String actionLabel) {
        super(ErrorCode.ILLEGAL_TRANSITION,
                "当前状态为「%s」，不能执行「%s」".formatted(displayOf(currentState), actionLabel),
                Map.of("currentState", displayOf(currentState), "action", actionLabel));
    }

    /** 状态字段尚未置值时 from 为 null，直接拼进文案会得到「当前状态为「null」」。 */
    private static String displayOf(String state) {
        return state == null ? "未开始" : state;
    }
}
