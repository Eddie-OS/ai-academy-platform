package com.aiacademy.platform.escalation.repository;

import com.aiacademy.platform.escalation.domain.EscalationQuery;
import com.aiacademy.platform.escalation.domain.EscalationRecord;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.OffsetDateTime;
import java.util.List;

@Mapper
public interface EscalationRecordMapper {

    @Select("""
            SELECT escalated_at
              FROM dtl_escalation_record
             WHERE object_type = #{objectType}
               AND object_id = #{objectId}
               AND COALESCE(owner_no, '') = COALESCE(#{ownerNo}, '')
               AND deleted = FALSE
             ORDER BY escalated_at DESC
             LIMIT 1
            """)
    OffsetDateTime findLatestEscalatedAt(@Param("objectType") String objectType,
                                         @Param("objectId") long objectId,
                                         @Param("ownerNo") String ownerNo);

    @Insert("""
            INSERT INTO dtl_escalation_record (
                object_type, object_id, object_name, owner_no, owner_name,
                escalate_type, channel_note, remark, escalated_at,
                process_node, light, source, content,
                created_by, updated_by)
            VALUES (
                #{objectType}, #{objectId}, #{objectName}, #{ownerNo}, #{ownerName},
                #{escalateType}, #{channelNote}, #{remark}, #{escalatedAt},
                #{processNode}, #{light}, #{source}, #{content},
                #{createdBy}, #{createdBy})
            """)
    @Options(useGeneratedKeys = true, keyProperty = "id", keyColumn = "id")
    int insert(EscalationInsert row);

    @Select("""
            SELECT id, object_type AS objectType, object_id AS objectId, object_name AS objectName,
                   owner_no AS ownerNo, owner_name AS ownerName, escalate_type AS escalateType,
                   channel_note AS channelNote, remark, escalated_at AS escalatedAt,
                   process_node AS processNode, light, source, content,
                   created_at AS createdAt, created_by AS createdBy
              FROM dtl_escalation_record
             WHERE id = #{id} AND deleted = FALSE
            """)
    EscalationRecord findById(@Param("id") long id);

    long countByQuery(@Param("q") EscalationQuery query);

    List<EscalationRecord> pageByQuery(@Param("q") EscalationQuery query);

    @Select("""
            SELECT object_type AS objectType, object_id AS objectId, owner_no AS ownerNo,
                   MAX(escalated_at) AS escalatedAt
              FROM dtl_escalation_record
             WHERE deleted = FALSE
               AND escalated_at >= #{cycleStart}
             GROUP BY object_type, object_id, owner_no
            """)
    List<CycleEscalationMark> findMarksSince(@Param("cycleStart") OffsetDateTime cycleStart);

    @Select("""
            SELECT COUNT(*) FROM dtl_escalation_record
             WHERE deleted = FALSE AND escalated_at >= #{cycleStart}
            """)
    long countSince(@Param("cycleStart") OffsetDateTime cycleStart);

    /** 插入用可变载体（MyBatis 回填 id）。 */
    class EscalationInsert {
        public Long id;
        public String objectType;
        public long objectId;
        public String objectName;
        public String ownerNo;
        public String ownerName;
        public String escalateType;
        public String channelNote;
        public String remark;
        public OffsetDateTime escalatedAt;
        public String processNode;
        public String light;
        public String source;
        public String content;
        public String createdBy;
    }

    record CycleEscalationMark(String objectType, long objectId, String ownerNo, OffsetDateTime escalatedAt) {
    }
}
