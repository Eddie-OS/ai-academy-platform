package com.aiacademy.common.api;

import java.util.List;

/**
 * 分页出参。总数必显示（设计规范 5.11 要求分页条展示总数）。
 */
public record PageResult<T>(List<T> records, long total, int pageNum, int pageSize) {

    public static <T> PageResult<T> of(List<T> records, long total, PageQuery query) {
        return new PageResult<>(records, total, query.getPageNum(), query.getPageSize());
    }
}
