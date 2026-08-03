package com.aiacademy.business.course.domain;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

/**
 * 课程有效期的派生值（需求 9.3.1a 规则 EX1～EX8）。
 *
 * <p>这是<b>一期唯一一处与「时间自动推进」有关的逻辑</b>，需求原文要求「严格按下表实现，不要扩展」。
 * 三条最容易被扩写的边界写在这里备查：
 * <ul>
 *   <li><b>EX4</b>：到期后只打「已过期」标签，<b>不改主状态、不下架、不阻断排课、不发通知</b>；
 *   <li><b>EX7</b>：过期标记是实时计算的派生值，<b>不落库、不建定时任务</b>——与「逾期任务」同一实现方式；
 *   <li><b>EX6</b>：过期课程<b>仍可</b>创建培训场次，排课时只给非阻断提示。
 * </ul>
 *
 * <p>截止日（{@code validity_end_date}）本身是落库的字段（需求 9.3.1 第 12b 项），
 * 在首次发布与修改有效期时由 {@link #endDateOf} 重算。落库的是<b>一个确定的日期</b>，
 * 派生的是<b>它与今天的关系</b>——这两件事分开，是因为前者不随时间变化而后者每天都在变。
 *
 * @param endDate 有效期截止日；未发布或长期有效时为 null
 * @param status 有效期状态，取值见 {@link CourseEnums#VALIDITY_STATUSES}
 * @param expired 过期标记（第 12c 项）
 * @param daysToExpiry 距截止日的自然日天数；已过期时为负数，无截止日时为 null。
 *                     EX5 的「课程有效期将于 X 月 X 日到期」提示用它判断是否在 30 天窗口内
 */
public record CourseValidity(LocalDate endDate, String status, boolean expired, Integer daysToExpiry) {

    /** EX5：到期前 30 天内在预警区显示提示。这是提示窗口，<b>不占用三色灯的灯色</b>。 */
    public static final int EXPIRING_WINDOW_DAYS = 30;

    /**
     * 按有效期时长与首次发布时间算截止日（EX1、EX3、EX8）。
     *
     * <p>起点恒为首次发布时间：改了时长也只重算终点，不改起点。
     *
     * @return 截止日；未发布（EX2）或长期有效（EX8）时为 null
     */
    public static LocalDate endDateOf(String validityPeriod, LocalDate firstPublishDate) {
        if (firstPublishDate == null || CourseEnums.VALIDITY_PERMANENT.equals(validityPeriod)) {
            return null;
        }
        return firstPublishDate.plusMonths(monthsOf(validityPeriod));
    }

    private static int monthsOf(String validityPeriod) {
        return switch (validityPeriod) {
            case "3 个月" -> 3;
            case "6 个月" -> 6;
            case "12 个月" -> 12;
            default -> throw new IllegalArgumentException("未知的课程有效期：" + validityPeriod);
        };
    }

    /**
     * 算出某一天看到的有效期状态。
     *
     * <p><b>截止日取库里的值，不在这里重算。</b>{@code validity_end_date} 是落库字段，
     * 由首次发布与修改有效期两处写入；列表筛选用的 SQL CASE 表达式读的也是这一列。这里若按
     * 时长重算一遍，两份实现就会在「库里的截止日被单独改过」时给出不同答案——而导入与历史数据
     * 修正都会造成这种情况，症状是筛「30 天内到期」筛出来的行，列表上却显示「有效」。
     *
     * @param endDate 库里的有效期截止日
     * @param today 判定基准日。作为参数传入而不是在方法体里取 {@code LocalDate.now()}，
     *              是为了让「到期当天算不算过期」这类边界能被测试直接钉住
     */
    public static CourseValidity of(String validityPeriod, LocalDate firstPublishDate,
                                    LocalDate endDate, LocalDate today) {
        // EX2：还没发布的课程谈不上过期。这一条要排在「长期有效」前面——未发布的长期有效课程
        // 两个分支都成立，而列表里该显示的是「未发布」
        if (firstPublishDate == null) {
            return new CourseValidity(null, CourseEnums.VALIDITY_STATUS_UNPUBLISHED, false, null);
        }
        if (CourseEnums.VALIDITY_PERMANENT.equals(validityPeriod)) {
            return new CourseValidity(null, CourseEnums.VALIDITY_STATUS_PERMANENT, false, null);
        }
        if (endDate == null) {
            // 发布过、非长期有效，却没有截止日：数据不完整。按「未发布」展示会掩盖问题，
            // 抛异常又会让整页列表打不开，因此回落到按时长重算一次
            endDate = endDateOf(validityPeriod, firstPublishDate);
        }

        int days = (int) ChronoUnit.DAYS.between(today, endDate);
        // 截止日当天仍算有效，过了才算过期：字段名是「有效期截止日」，截止日本身包含在有效期内
        String status = days < 0 ? CourseEnums.VALIDITY_STATUS_EXPIRED
                : days <= EXPIRING_WINDOW_DAYS ? CourseEnums.VALIDITY_STATUS_EXPIRING
                : CourseEnums.VALIDITY_STATUS_VALID;
        return new CourseValidity(endDate, status, days < 0, days);
    }
}
