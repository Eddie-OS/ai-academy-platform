package com.aiacademy.business.kase.domain;

/**
 * 案例列表／看板卡片的一行（需求 12.7 的卡片流字段 + 运营列表页字段）。
 *
 * <p>继承 {@link CaseInfo} 拿到全部本体字段，本类只加算出来的几列：负责人姓名、审核人姓名与
 * 四项互动计数。
 *
 * <p><b>没有来源课程名称。</b>{@code biz_course} 是课程模块的表，在这里 JOIN 它会建立一条
 * ArchUnit 看不见的模块间依赖（AR-1）。课程名由 app 层的 {@code CourseRefMapper} 补齐，
 * 与培训场次读课程走的是同一条路。
 *
 * <p><b>四项互动计数在这里是查询结果，不是存储字段。</b>它们由列表 SQL 现算（需求 15.5 的公式），
 * 主表没有对应的列。看板一页 20 张卡片，四个子查询在两万级流水上仍是毫秒级；而存计数器要维护
 * 三处增减，删一条评论忘了减就永远差一条（规则 U2、C14：实时计算，不建预聚合）。
 */
public class CaseListItem extends CaseInfo {

    /** 案例负责人姓名。<b>负责人不参与判权</b>（纪律 PMI-4）。 */
    private String ownerName;

    private String reviewerName;

    /** 浏览次数（需求 15.5）。<b>不去重</b>，每次打开详情页一条。 */
    private Long viewCount;

    /** 点赞量。不去重、不可取消。 */
    private Long likeCount;

    /** 评论数。<b>不含已逻辑删除的评论</b>（需求 12.3 第 19 项）。 */
    private Long commentCount;

    /** 累计阅读时长（秒）。平均阅读时长 = 本值 / 浏览次数，由展示侧算。 */
    private Long readSeconds;

    public String getOwnerName() {
        return ownerName;
    }

    public void setOwnerName(String ownerName) {
        this.ownerName = ownerName;
    }

    public String getReviewerName() {
        return reviewerName;
    }

    public void setReviewerName(String reviewerName) {
        this.reviewerName = reviewerName;
    }

    public Long getViewCount() {
        return viewCount;
    }

    public void setViewCount(Long viewCount) {
        this.viewCount = viewCount;
    }

    public Long getLikeCount() {
        return likeCount;
    }

    public void setLikeCount(Long likeCount) {
        this.likeCount = likeCount;
    }

    public Long getCommentCount() {
        return commentCount;
    }

    public void setCommentCount(Long commentCount) {
        this.commentCount = commentCount;
    }

    public Long getReadSeconds() {
        return readSeconds;
    }

    public void setReadSeconds(Long readSeconds) {
        this.readSeconds = readSeconds;
    }

    /**
     * 平均阅读时长（秒），保留一位小数由前端按设计规范 3.3 处理。口径与
     * {@link CaseInteractionStats#avgReadSeconds()} 一致。
     *
     * <p>没人打开过、或打开了但一次时长都没回报上来时返回 null 而不是 0：设计规范规定零值显示
     * {@code 0}、{@code —} 才表示无数据，而这两种情况都是没有数据，不是「平均读了 0 秒」。
     */
    public Double getAvgReadSeconds() {
        if (viewCount == null || viewCount == 0 || readSeconds == null || readSeconds == 0) {
            return null;
        }
        return (double) readSeconds / viewCount;
    }
}
