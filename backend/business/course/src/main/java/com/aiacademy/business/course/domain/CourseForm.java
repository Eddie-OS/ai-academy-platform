package com.aiacademy.business.course.domain;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * 课程立项与编辑表单（需求 9.3.1 的可编辑字段）。
 *
 * <p><b>不含状态字段与关闭原因。</b>五个状态列只能由状态机引擎写；关闭原因随「关闭课程开发」
 * 一起录入（需求 9.3.2 第 20 项要求主状态为「已关闭」时必填，放进通用编辑表单就没法表达这个必填）。
 *
 * <p><b>不含有效期截止日与过期标记。</b>前者由首次发布时间与有效期时长算出（EX1、EX3），
 * 后者按 EX7 实时计算、不落库。让运营能手填截止日，就等于允许它与有效期时长不一致。
 *
 * @param externalLink 课程外部链接（D10）。需求 9.3.1 第 12d 项要求 URL 格式校验；
 *                     只校验协议头，不校验可达性——内网地址与尚未上线的链接都是正常录入内容
 */
public record CourseForm(
        @NotBlank(message = "请填写课程名称")
        @Size(max = 100, message = "课程名称不超过 100 字")
        String courseName,

        @NotBlank(message = "请选择评审轨道")
        String reviewTrack,

        @NotBlank(message = "请选择所属领域")
        String domainCode,

        @NotBlank(message = "请选择课程负责人")
        String ownerNo,

        @NotNull(message = "请填写立项时间")
        LocalDate initiatedDate,

        @NotNull(message = "请填写预计发布时间")
        LocalDate expectPublishDate,

        @Size(max = 2000, message = "课程简介不超过 2000 字")
        String summary,

        @Size(max = 500, message = "面向人群不超过 500 字")
        String targetAudience,

        BigDecimal classHours,

        String categoryCode,

        @NotBlank(message = "请选择课程有效期")
        String validityPeriod,

        @Size(max = 500, message = "课程外部链接不超过 500 字")
        @Pattern(regexp = "^$|^https?://.+", message = "课程外部链接需以 http:// 或 https:// 开头")
        String externalLink,

        List<String> qualityMarks) {
}
