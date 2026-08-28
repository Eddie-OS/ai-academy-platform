package com.aiacademy.app.export;

import java.time.OffsetDateTime;

public record ExportTask(
        long id,
        String resourceType,
        String status,
        String fileName,
        String storagePath,
        Long rowCount,
        String queryJson,
        String errorMessage,
        OffsetDateTime expiresAt,
        OffsetDateTime createdAt,
        String createdBy
) {
}
