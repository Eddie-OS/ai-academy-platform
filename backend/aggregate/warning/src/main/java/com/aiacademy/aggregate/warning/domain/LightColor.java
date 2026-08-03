package com.aiacademy.aggregate.warning.domain;

/**
 * 三色灯 API 码与快照表中文值的双向映射。
 *
 * <p>对外 API／{@code calc_light} 返回 {@code BLUE}/{@code YELLOW}/{@code RED}/{@code NONE}；
 * {@code snapshot_warning_light.light} 的 CHECK 约束是中文「蓝／黄／红／无」（V1_001）。
 * 读写快照时必须经本枚举转换，不要在别处各写一份字面量。
 */
public enum LightColor {

    NONE("NONE", "无"),
    BLUE("BLUE", "蓝"),
    YELLOW("YELLOW", "黄"),
    RED("RED", "红");

    private final String apiCode;
    private final String snapshotCode;

    LightColor(String apiCode, String snapshotCode) {
        this.apiCode = apiCode;
        this.snapshotCode = snapshotCode;
    }

    public String apiCode() {
        return apiCode;
    }

    public String snapshotCode() {
        return snapshotCode;
    }

    public static LightColor fromApi(String apiCode) {
        if (apiCode == null || apiCode.isBlank()) {
            return NONE;
        }
        for (LightColor color : values()) {
            if (color.apiCode.equalsIgnoreCase(apiCode.trim())) {
                return color;
            }
        }
        throw new IllegalArgumentException("未知灯色 API 码：" + apiCode);
    }

    public static LightColor fromSnapshot(String snapshotCode) {
        if (snapshotCode == null || snapshotCode.isBlank()) {
            return NONE;
        }
        for (LightColor color : values()) {
            if (color.snapshotCode.equals(snapshotCode.trim())) {
                return color;
            }
        }
        throw new IllegalArgumentException("未知快照灯色：" + snapshotCode);
    }
}
