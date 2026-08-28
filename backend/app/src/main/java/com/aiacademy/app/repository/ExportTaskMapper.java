package com.aiacademy.app.repository;

import com.aiacademy.app.export.ExportTask;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.OffsetDateTime;
import java.util.List;

@Mapper
public interface ExportTaskMapper {

    @Insert("""
            INSERT INTO sys_export_task
                (resource_type, status, query_json, expires_at, created_by, updated_by)
            VALUES (#{resourceType}, 'PENDING', #{queryJson}, #{expiresAt}, #{createdBy}, #{createdBy})
            """)
    @Options(useGeneratedKeys = true, keyProperty = "id", keyColumn = "id")
    int insert(ExportInsert row);

    @Update("""
            UPDATE sys_export_task
               SET status = #{status},
                   file_name = #{fileName},
                   storage_path = #{storagePath},
                   row_count = #{rowCount},
                   error_message = #{errorMessage},
                   updated_at = NOW()
             WHERE id = #{id}
            """)
    int finish(@Param("id") long id,
               @Param("status") String status,
               @Param("fileName") String fileName,
               @Param("storagePath") String storagePath,
               @Param("rowCount") Long rowCount,
               @Param("errorMessage") String errorMessage);

    @Update("UPDATE sys_export_task SET status = 'RUNNING', updated_at = NOW() WHERE id = #{id}")
    int markRunning(@Param("id") long id);

    @Select("""
            SELECT id, resource_type AS resourceType, status, file_name AS fileName,
                   storage_path AS storagePath, row_count AS rowCount, query_json AS queryJson,
                   error_message AS errorMessage, expires_at AS expiresAt,
                   created_at AS createdAt, created_by AS createdBy
              FROM sys_export_task
             WHERE id = #{id} AND deleted = FALSE
            """)
    ExportTask findById(@Param("id") long id);

    @Select("""
            SELECT id, resource_type AS resourceType, status, file_name AS fileName,
                   storage_path AS storagePath, row_count AS rowCount, query_json AS queryJson,
                   error_message AS errorMessage, expires_at AS expiresAt,
                   created_at AS createdAt, created_by AS createdBy
              FROM sys_export_task
             WHERE deleted = FALSE
               AND (expires_at < NOW() OR created_at < NOW() - INTERVAL '7 days')
            """)
    List<ExportTask> findExpired();

    @Update("UPDATE sys_export_task SET deleted = TRUE, updated_at = NOW() WHERE id = #{id}")
    int softDelete(@Param("id") long id);

    class ExportInsert {
        public Long id;
        public String resourceType;
        public String queryJson;
        public OffsetDateTime expiresAt;
        public String createdBy;
    }
}
