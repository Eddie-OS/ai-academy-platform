/**
 * 案例 模块的实体、值对象与领域事件。
 *
 * <p>实体必须包含 6.1.2 的全部公共字段；带状态的主对象额外含 last_state_changed_at；需求/课程/案例三表额外含 version。
 *
 * <p><b>禁止：</b>updated_at 与 last_state_changed_at 严格分离（C5、C6、L1）。纯日期语义的字段用 DATE 而非时间戳（6.1.4）。
 */
package com.aiacademy.business.kase.domain;
