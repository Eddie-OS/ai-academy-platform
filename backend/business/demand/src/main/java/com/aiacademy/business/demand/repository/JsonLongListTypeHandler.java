package com.aiacademy.business.demand.repository;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.ibatis.type.BaseTypeHandler;
import org.apache.ibatis.type.JdbcType;
import org.apache.ibatis.type.MappedJdbcTypes;
import org.apache.ibatis.type.MappedTypes;

import java.sql.CallableStatement;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.util.Collections;
import java.util.List;

/**
 * JSONB ↔ {@code List<Long>}（业务价值关联需求／案例 ID）。
 */
@MappedTypes(List.class)
@MappedJdbcTypes(JdbcType.OTHER)
public class JsonLongListTypeHandler extends BaseTypeHandler<List<Long>> {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final TypeReference<List<Long>> TYPE = new TypeReference<>() {
    };

    @Override
    public void setNonNullParameter(PreparedStatement ps, int i, List<Long> parameter, JdbcType jdbcType)
            throws SQLException {
        try {
            ps.setObject(i, MAPPER.writeValueAsString(parameter == null ? List.of() : parameter), Types.OTHER);
        } catch (Exception e) {
            throw new SQLException("序列化 JSONB 失败", e);
        }
    }

    @Override
    public List<Long> getNullableResult(ResultSet rs, String columnName) throws SQLException {
        return parse(rs.getString(columnName));
    }

    @Override
    public List<Long> getNullableResult(ResultSet rs, int columnIndex) throws SQLException {
        return parse(rs.getString(columnIndex));
    }

    @Override
    public List<Long> getNullableResult(CallableStatement cs, int columnIndex) throws SQLException {
        return parse(cs.getString(columnIndex));
    }

    private static List<Long> parse(String raw) throws SQLException {
        if (raw == null || raw.isBlank()) {
            return Collections.emptyList();
        }
        try {
            return MAPPER.readValue(raw, TYPE);
        } catch (Exception e) {
            throw new SQLException("解析 JSONB 失败: " + raw, e);
        }
    }
}