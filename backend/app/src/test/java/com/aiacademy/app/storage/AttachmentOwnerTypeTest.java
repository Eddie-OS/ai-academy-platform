package com.aiacademy.app.storage;

import com.aiacademy.platform.statemachine.domain.StateObjectMapping;
import com.aiacademy.platform.statemachine.domain.StateObjectMappings;
import com.aiacademy.platform.storage.domain.AttachmentOwnerType;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 附件的对象类型词表与状态机的对象类型词表必须完全一致。
 *
 * <p><b>为什么值得一个专门的测试：</b>对象类型这串字符串同时出现在三处——状态流转日志
 * （{@code audit_state_log.object_type}）、操作审计日志、附件引用（{@code sys_attachment_ref.ref_type}）。
 * 三处各自维护一份枚举，写成 {@code COURSE} 与 {@code Course} 的那一天不会有任何报错：
 * 附件照样上传成功，只是课程详情页的附件列表永远是空的。
 *
 * <p>这个测试放在 {@code app} 模块是因为只有它同时看得见 {@code platform:statemachine} 与
 * {@code platform:storage}——两个平台模块之间不允许互相依赖（AR-1）。
 */
class AttachmentOwnerTypeTest {

    @Test
    @DisplayName("附件对象类型 = 状态机对象类型（需求 5.11 的同一份词表）")
    void 对象类型词表一致() {
        List<String> 状态机的 = StateObjectMappings.all().stream()
                .map(StateObjectMapping::objectType)
                .sorted()
                .toList();
        List<String> 附件的 = java.util.Arrays.stream(AttachmentOwnerType.values())
                .map(Enum::name)
                .sorted()
                .toList();

        assertThat(附件的)
                .describedAs("两份词表来源相同（需求 5.11），必须逐字一致。"
                        + "新增一类业务对象时，这个测试会提醒你附件那边也要加")
                .isEqualTo(状态机的);
    }

    @Test
    @DisplayName("目录名是小写下划线形式，且不含会造成路径歧义的字符")
    void 目录名合法() {
        for (AttachmentOwnerType type : AttachmentOwnerType.values()) {
            assertThat(type.directory())
                    .describedAs("%s 的目录名直接拼进存储路径（开发 5.7.3）", type)
                    .matches("[a-z_]+");
        }
    }
}
