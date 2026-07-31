package com.aiacademy.common.api;

/**
 * 分页入参，对应《开发实施文档》7.1 规则 API-6：pageNum 从 1 开始，pageSize 默认 20、上限 200。
 */
public class PageQuery {

    public static final int DEFAULT_PAGE_SIZE = 20;
    public static final int MAX_PAGE_SIZE = 200;

    private int pageNum = 1;
    private int pageSize = DEFAULT_PAGE_SIZE;

    public int getPageNum() {
        return pageNum;
    }

    public void setPageNum(int pageNum) {
        this.pageNum = Math.max(pageNum, 1);
    }

    public int getPageSize() {
        return pageSize;
    }

    public void setPageSize(int pageSize) {
        this.pageSize = Math.min(Math.max(pageSize, 1), MAX_PAGE_SIZE);
    }

    public long offset() {
        return (long) (pageNum - 1) * pageSize;
    }
}
