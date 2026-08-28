package com.aiacademy.app.repository;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.time.OffsetDateTime;

@Mapper
public interface JobRunLogMapper {

    @Insert("""
            INSERT INTO sys_job_run_log (job_name, started_at, finished_at, success, message, created_by)
            VALUES (#{jobName}, #{startedAt}, #{finishedAt}, #{success}, #{message}, 'system')
            """)
    int insert(@Param("jobName") String jobName,
               @Param("startedAt") OffsetDateTime startedAt,
               @Param("finishedAt") OffsetDateTime finishedAt,
               @Param("success") boolean success,
               @Param("message") String message);
}
