package com.aiacademy.business.training.domain;

import jakarta.validation.constraints.Size;

/**
 * 培训归档的保存表单（需求 11.6）。全部字段选填——归档材料是陆续补齐的，
 * 运营先存直播链接、过两天再补纪要是常态。
 *
 * @param archiveCompleted 留空按「否」处理
 */
public record TrainingArchiveForm(

        @Size(max = 500, message = "直播链接不超过 500 字")
        String liveLink,

        @Size(max = 500, message = "视频链接不超过 500 字")
        String videoLink,

        @Size(max = 5000, message = "培训纪要不超过 5000 字")
        String minutesText,

        Boolean archiveCompleted) {

    public boolean completed() {
        return Boolean.TRUE.equals(archiveCompleted);
    }
}
