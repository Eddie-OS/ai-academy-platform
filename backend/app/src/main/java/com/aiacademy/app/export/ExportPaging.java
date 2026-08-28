package com.aiacademy.app.export;

import com.aiacademy.common.api.PageResult;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Function;
import java.util.function.IntConsumer;

/**
 * 导出时按列表分页拼全量，避免另写一套查询。
 */
public final class ExportPaging {

    private ExportPaging() {
    }

    public static <T> List<T> loadAll(IntConsumer setPageNum,
                                      int pageSize,
                                      Function<Void, PageResult<T>> pageFn) {
        List<T> all = new ArrayList<>();
        int page = 1;
        while (true) {
            setPageNum.accept(page);
            PageResult<T> result = pageFn.apply(null);
            all.addAll(result.records());
            if (all.size() >= result.total() || result.records().isEmpty()) {
                break;
            }
            page++;
            if (page > 10_000) {
                break;
            }
        }
        return all;
    }
}
