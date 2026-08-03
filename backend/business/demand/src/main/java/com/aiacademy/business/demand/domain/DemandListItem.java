package com.aiacademy.business.demand.domain;

/**
 * 需求列表的一行（需求 8.6 的默认展示列 + 可选列）。
 *
 * <p>继承 {@link Demand} 拿到全部本体字段，本类只加算出来的四列：负责人姓名、提出人姓名、
 * 关联课程数、当前处理状态。
 *
 * <p><b>灯色列不在这里。</b>三色灯属于阶段 3，本阶段列表只留出列位置。
 */
public class DemandListItem extends Demand {

    /** 负责人姓名，从 {@code org_employee} 带出。<b>负责人不参与判权</b>（纪律 PMI-4）。 */
    private String ownerName;

    private String proposerName;

    /** 关联课程数（需求 8.4，规则 R4）。 */
    private Integer courseCount;

    /**
     * 当前处理状态（需求 8.6 的默认展示列之一）。
     *
     * <p>需求用「一个分流出口 + 两组状态字段」建模，列表要在一列里显示需求走到哪儿了，就得按
     * 出口取对应那一组的值：出口一看解决方案状态，出口二看需求开发状态。还没定出口时为空。
     *
     * <p>这里读的是<b>出口</b>取值而不是状态值——出口是需求主表上的普通枚举字段，与 A-6 的
     * 「业务代码不得出现状态值字面量」不冲突：状态值仍然原样取自库里的列。
     */
    public String getCurrentProcessState() {
        if (DemandEnums.OUTLET_SOLUTION.equals(getOutlet())) {
            return getSolutionState();
        }
        if (DemandEnums.OUTLET_DEVELOPMENT.equals(getOutlet())) {
            return getDevState();
        }
        return null;
    }

    public String getOwnerName() {
        return ownerName;
    }

    public void setOwnerName(String ownerName) {
        this.ownerName = ownerName;
    }

    public String getProposerName() {
        return proposerName;
    }

    public void setProposerName(String proposerName) {
        this.proposerName = proposerName;
    }

    public Integer getCourseCount() {
        return courseCount;
    }

    public void setCourseCount(Integer courseCount) {
        this.courseCount = courseCount;
    }

    public Boolean getHasCourse() {
        return courseCount != null && courseCount > 0;
    }
}
