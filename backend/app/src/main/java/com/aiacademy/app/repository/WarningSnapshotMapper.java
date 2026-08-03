package com.aiacademy.app.repository;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

/**
 * 灯色快照读写。写操作放在 app（AR-3：aggregate/warning 只读）。
 *
 * <p>{@code light} 列存中文「蓝／黄／红／无」（V1_001 CHECK）；API 码转换见 {@code LightColor}。
 */
@Mapper
public interface WarningSnapshotMapper {

    @Select("""
            SELECT light FROM snapshot_warning_light
             WHERE object_type = #{objectType} AND object_id = #{objectId}
            """)
    String findLight(@Param("objectType") String objectType, @Param("objectId") long objectId);

    @Insert("""
            INSERT INTO snapshot_warning_light (object_type, object_id, light, snapshot_at)
            VALUES (#{objectType}, #{objectId}, #{light}, NOW())
            ON CONFLICT (object_type, object_id) DO UPDATE
               SET light = EXCLUDED.light,
                   snapshot_at = EXCLUDED.snapshot_at
            """)
    int upsert(@Param("objectType") String objectType,
               @Param("objectId") long objectId,
               @Param("light") String light);
}
