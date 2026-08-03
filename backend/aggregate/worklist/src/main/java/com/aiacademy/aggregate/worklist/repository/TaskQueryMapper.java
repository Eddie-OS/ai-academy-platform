package com.aiacademy.aggregate.worklist.repository;

import com.aiacademy.aggregate.worklist.domain.TaskListItem;
import com.aiacademy.aggregate.worklist.domain.TaskQuery;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface TaskQueryMapper {

    List<TaskListItem> selectPage(@Param("q") TaskQuery query,
                                  @Param("offset") long offset,
                                  @Param("pending") String pending,
                                  @Param("inProgress") String inProgress);

    long countPage(@Param("q") TaskQuery query,
                   @Param("pending") String pending,
                   @Param("inProgress") String inProgress);
}
