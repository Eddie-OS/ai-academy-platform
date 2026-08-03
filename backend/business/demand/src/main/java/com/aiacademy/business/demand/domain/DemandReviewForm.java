package com.aiacademy.business.demand.domain;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

/**
 * 录入评审结论的表单（需求 5.2.1 第 3 行、8.3.2、8.3.3 第 19 项）。
 *
 * <p><b>分流出口在这里是必填的。</b>需求 5.2.1 的副作用列写着「必须同时填写分流出口」——它不是
 * 一条可以事后补的字段：出口决定后续激活哪一组状态字段，评审已结束却没有出口的需求，在列表的
 * 「当前处理状态」列上是一个永久的空白，也没有任何动作能推进它。
 *
 * <p><b>解决方案名称不在这里。</b>需求 8.3.3 第 22 项要求它在出口一时必填，但评审刚结束时
 * 方案往往还没写出来。它随「输出解决方案」这条转换一起录入（{@code POST /demands/{id}/solution}），
 * 那个时点填名称才是必填得起来的。
 *
 * @param reviewDate 线下会议日期，可回填（需求 8.3.2 第 15 项）
 * @param version    乐观锁版本号（规则 K1）。不传即放弃冲突检测
 */
public record DemandReviewForm(
        LocalDate reviewDate,

        @Size(max = 1000, message = "评审结论不超过 1000 字")
        String reviewConclusion,

        @Size(max = 2000, message = "评审专业意见不超过 2000 字")
        String reviewOpinion,

        @NotBlank(message = "请选择分流出口")
        String outlet,

        Integer version) {
}
