package com.aiacademy.platform.storage.domain;

import com.aiacademy.common.api.ErrorCode;
import com.aiacademy.common.exception.BizException;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * 格式白名单与真实类型校验（规则 F2）。
 *
 * <p><b>为什么必须读文件头：</b>扩展名是用户想写什么就写什么的。把 {@code payload.exe} 改名成
 * {@code 课件.pptx} 传上来，只看扩展名的校验会放行，而这个文件会长期躺在服务器上等着被谁点开。
 * 开发 5.7.2 第 8 步与 5.7.1 F2 都把这一步单独点了出来，因为它是最容易被省掉的一步——
 * 省掉之后正常用法一切如常——正常文件的扩展名本来就是对的，只有被伪造的文件才有区别。
 *
 * <p>白名单逐字取自需求 F2：文档（doc/docx/ppt/pptx/xls/xlsx/pdf）、图片（jpg/jpeg/png/gif）、
 * 压缩包（zip/rar）。<b>V1.2 已移除 mp4/mov</b>——视频一律填外部链接（N22）。
 */
public final class FileTypeRules {

    /**
     * 扩展名 → 允许的文件头家族。
     *
     * <p>一个扩展名对多个家族不是妥协：{@code .docx} 与 {@code .zip} 的文件头都是 {@code PK\3\4}
     * （OOXML 本身就是 zip），无法在文件头这一层区分，也没有必要——两者都在白名单里。
     * 真正要挡的是 PE（{@code MZ}）、ELF、脚本这些根本不在任何白名单家族里的东西。
     */
    private static final Map<String, Set<Family>> ALLOWED = Map.ofEntries(
            Map.entry("doc", Set.of(Family.OLE2)),
            Map.entry("xls", Set.of(Family.OLE2)),
            Map.entry("ppt", Set.of(Family.OLE2)),
            // Office 2007+ 的三种格式都是 zip 容器；同时容忍 OLE2，因为运营常把 .doc 另存后仍叫 .docx
            Map.entry("docx", Set.of(Family.ZIP, Family.OLE2)),
            Map.entry("xlsx", Set.of(Family.ZIP, Family.OLE2)),
            Map.entry("pptx", Set.of(Family.ZIP, Family.OLE2)),
            Map.entry("pdf", Set.of(Family.PDF)),
            Map.entry("jpg", Set.of(Family.JPEG)),
            Map.entry("jpeg", Set.of(Family.JPEG)),
            Map.entry("png", Set.of(Family.PNG)),
            Map.entry("gif", Set.of(Family.GIF)),
            Map.entry("zip", Set.of(Family.ZIP)),
            Map.entry("rar", Set.of(Family.RAR)));

    /** 读文件头需要的字节数。RAR5 的签名 8 字节最长。 */
    public static final int HEADER_BYTES = 8;

    private FileTypeRules() {
    }

    /** 文件头家族。 */
    public enum Family {
        ZIP, OLE2, PDF, JPEG, PNG, GIF, RAR, UNKNOWN
    }

    /** 白名单里的扩展名，供前端 accept 与错误文案使用。 */
    public static Set<String> allowedExtensions() {
        return ALLOWED.keySet();
    }

    public static String extensionOf(String fileName) {
        int dot = fileName == null ? -1 : fileName.lastIndexOf('.');
        return dot < 0 ? "" : fileName.substring(dot + 1).toLowerCase(Locale.ROOT);
    }

    /**
     * 第 2 步：扩展名白名单（开发 5.7.2 的申请上传阶段）。
     *
     * <p>放在申请阶段是为了让运营在上传 200MB 之前就知道格式不对，而不是传完再被拒。
     * 它不能代替文件头校验——那一步在合并之后（第 8 步）。
     */
    public static void checkExtension(String fileName) {
        String extension = extensionOf(fileName);
        if (!ALLOWED.containsKey(extension)) {
            throw new BizException(ErrorCode.PARAM_INVALID,
                    "不支持的文件格式「%s」。允许的格式：%s。视频请填外部链接，不要上传（需求 N22）"
                            .formatted(extension.isEmpty() ? "无扩展名" : extension,
                                    String.join("、", sortedExtensions())));
        }
    }

    /**
     * 第 8 步：文件头与扩展名是否属于同一家族（规则 F2）。
     *
     * @param header 文件的前 {@link #HEADER_BYTES} 个字节
     */
    public static void checkMagicNumber(String fileName, byte[] header) {
        String extension = extensionOf(fileName);
        Set<Family> allowed = ALLOWED.get(extension);
        if (allowed == null) {
            checkExtension(fileName);
            return;
        }
        Family actual = familyOf(header);
        if (!allowed.contains(actual)) {
            throw new BizException(ErrorCode.PARAM_INVALID,
                    "文件真实类型与扩展名不符：扩展名是 %s，实际内容是 %s（规则 F2）"
                            .formatted(extension, actual == Family.UNKNOWN ? "无法识别的格式" : actual));
        }
    }

    public static Family familyOf(byte[] header) {
        if (startsWith(header, 0x50, 0x4B, 0x03, 0x04) || startsWith(header, 0x50, 0x4B, 0x05, 0x06)) {
            return Family.ZIP;
        }
        if (startsWith(header, 0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1)) {
            return Family.OLE2;
        }
        if (startsWith(header, 0x25, 0x50, 0x44, 0x46)) {
            return Family.PDF;
        }
        if (startsWith(header, 0xFF, 0xD8, 0xFF)) {
            return Family.JPEG;
        }
        if (startsWith(header, 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A)) {
            return Family.PNG;
        }
        if (startsWith(header, 0x47, 0x49, 0x46, 0x38)) {
            return Family.GIF;
        }
        if (startsWith(header, 0x52, 0x61, 0x72, 0x21, 0x1A, 0x07)) {
            return Family.RAR;
        }
        return Family.UNKNOWN;
    }

    /** 常见 MIME，仅用于下载响应头；不作为类型判定依据（客户端说什么都不能信）。 */
    public static String contentTypeOf(String fileName) {
        return switch (extensionOf(fileName)) {
            case "pdf" -> "application/pdf";
            case "doc" -> "application/msword";
            case "docx" -> "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
            case "xls" -> "application/vnd.ms-excel";
            case "xlsx" -> "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
            case "ppt" -> "application/vnd.ms-powerpoint";
            case "pptx" -> "application/vnd.openxmlformats-officedocument.presentationml.presentation";
            case "jpg", "jpeg" -> "image/jpeg";
            case "png" -> "image/png";
            case "gif" -> "image/gif";
            case "zip" -> "application/zip";
            case "rar" -> "application/vnd.rar";
            default -> "application/octet-stream";
        };
    }

    private static List<String> sortedExtensions() {
        return ALLOWED.keySet().stream().sorted().toList();
    }

    private static boolean startsWith(byte[] header, int... signature) {
        if (header == null || header.length < signature.length) {
            return false;
        }
        for (int i = 0; i < signature.length; i++) {
            if ((header[i] & 0xFF) != signature[i]) {
                return false;
            }
        }
        return true;
    }
}
