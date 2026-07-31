package com.aiacademy.platform.statemachine.tool;

import com.aiacademy.platform.statemachine.domain.StateMachineDef;
import com.aiacademy.platform.statemachine.domain.Transition;
import com.aiacademy.platform.statemachine.domain.machines.StateMachineCatalog;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

/**
 * 生成《状态机转换表核对清单》——阶段 1 的交付物之一（《开发实施文档》8.5 交付要求）。
 *
 * <p><b>清单从引擎的转换表生成，不从需求文档生成。</b>这一点是刻意的：人工验收动作 1 要求
 * 「随机挑 3 个状态机，把需求文档第 5 章的表格与清单逐行比对」，如果清单本身就是从需求文档
 * 解析出来的，这个比对就是自证，什么也验不出来。清单反映引擎实际装载了什么，人对着需求文档看。
 *
 * <p>用法（在 backend 目录下）：{@code .\gradlew.bat :platform:statemachine:writeChecklist}
 */
public final class StateMachineChecklistTool {

    private StateMachineChecklistTool() {
    }

    public static void main(String[] args) throws IOException {
        if (args.length != 1) {
            throw new IllegalArgumentException("用法：StateMachineChecklistTool <输出文件路径>");
        }
        Path output = Path.of(args[0]);
        Files.createDirectories(output.toAbsolutePath().getParent());
        Files.writeString(output, render(), StandardCharsets.UTF_8);
        System.out.println("已生成 " + output.toAbsolutePath());
    }

    static String render() {
        StringBuilder md = new StringBuilder();
        List<StateMachineDef> machines = StateMachineCatalog.all();

        md.append("""
                # 状态机转换表核对清单

                > 阶段 1 交付物，对应《开发实施文档》8.5「交付要求」第 2 项与人工验收动作 1。
                >
                > **本文件由代码生成，不要手工编辑。** 重新生成（在 `backend` 目录下）：
                > `.\\gradlew.bat :platform:statemachine:writeChecklist`

                ## 怎么用这份清单

                清单内容来自**引擎实际装载的转换表**（`domain/machines/` 下的 Java 代码），不是从需求文档
                解析出来的。这样才能拿它与需求文档第 5 章逐行比对——如果清单也来自需求文档，比对就是自证。

                验收动作 1 建议这样做：随机挑 3 个状态机，打开需求文档第 5 章对应小节，逐行核对
                「起始状态 + 动作 → 目标状态」三列。

                除人工抽查外，这条链路已经有机器验证：

                | 环节 | 手段 |
                |---|---|
                | 需求文档第 5 章 → CSV | `scripts/statemachine/extract-transitions.mjs` 机械解析 markdown 表格。`scripts/build.ps1` 每次构建前重跑它，需求文档一改，CSV 随即变化并让测试红灯 |
                | CSV → 引擎转换表 | `StateMachineTransitionTableTest` 逐行驱动引擎，双向比对（缺转换、多转换、目标状态不符都会红灯） |
                | 引擎 → 本清单 | 本工具生成 |

                因为引擎不读 CSV、测试不读引擎的源码，三段互为独立来源，任何一处转录错误都会暴露。

                ## 覆盖本清单的测试方法

                均位于 `platform/statemachine` 模块的 `StateMachineTransitionTableTest`：

                | 测试方法 | 断言内容 |
                |---|---|
                | `需求转换逐行驱动引擎` | 需求第 5 章每一条转换都能在引擎里查到，且目标状态一致（参数化，一行一个用例） |
                | `引擎不得增补需求之外的转换` | 引擎里没有需求文档之外的转换 |
                | `非法组合全部硬阻断` | 每张表的（状态 × 动作）全组合中未列出的部分一律抛 `ILLEGAL_TRANSITION`（规则 C3） |
                | `未知动作码同样硬阻断` | 传入该状态机不存在的动作码也被拒绝 |
                | `状态机数量与需求清单一致` | 15 个业务状态机 + 任务状态机 = 16 张表（需求 5.13「不多不少」） |
                | `讲师培养状态不得建成状态机` | C10：它是自由选择的枚举字段 |
                | `终态识别正确` | 终态集合与需求 13.1.2 的自动关闭规则一致 |
                | `退出预警范围与终态是两个概念` | 培训计划「已完成」退出预警但不是终态 |
                | `退出预警范围标注与需求一致` | 逐行比对「退出预警范围」标注（参数化） |
                | `任务派生副作用与需求一致` | 逐行比对派生的任务类型（参数化） |
                | `副作用码全部已声明` | 无拼写错误的副作用码 |

                """);

        md.append("## 汇总\n\n");
        md.append("引擎装载 **").append(machines.size()).append(" 张转换表**")
                .append("（需求 5.13 的 ").append(StateMachineCatalog.BUSINESS_MACHINE_COUNT)
                .append(" 个业务状态机 + 任务状态机；任务是支撑对象，不计入 ")
                .append(StateMachineCatalog.BUSINESS_MACHINE_COUNT).append(" 之内），共 **")
                .append(machines.stream().mapToInt(m -> m.transitions().size()).sum())
                .append(" 条转换**。\n\n");
        md.append("| # | 状态机 | 对象类型 | 状态字段 | 转换数 | 终态 | 退出预警范围的转换 |\n");
        md.append("|---|---|---|---|---|---|---|\n");
        for (int i = 0; i < machines.size(); i++) {
            StateMachineDef m = machines.get(i);
            String terminals = m.terminalStates().isEmpty()
                    ? "无"
                    : String.join("、", m.terminalStates().stream().sorted().toList());
            String exiting = m.transitions().stream()
                    .filter(Transition::exitsWarningScope)
                    .map(t -> t.from() + " → " + t.to())
                    .reduce((a, b) -> a + "；" + b)
                    .orElse("无");
            md.append("| %d | %s | `%s` | %s | %d | %s | %s |%n".formatted(
                    i + 1, m.machineName(), m.objectType(), m.stateField(),
                    m.transitions().size(), terminals, exiting));
        }

        md.append("\n## 逐条转换\n\n");
        md.append("「起始状态」为 `（新建/空）` 表示对象尚不存在或该状态字段未置值，引擎里是 `null`。\n\n");
        for (StateMachineDef m : machines) {
            md.append("### ").append(m.machineName()).append("\n\n");
            md.append("对象类型 `").append(m.objectType()).append("`，状态字段「")
                    .append(m.stateField()).append("」。\n\n");
            md.append("| # | 起始状态 | 动作（需求原文） | 动作码 | 目标状态 | 副作用 |\n");
            md.append("|---|---|---|---|---|---|\n");
            List<Transition> ts = m.transitions();
            for (int i = 0; i < ts.size(); i++) {
                Transition t = ts.get(i);
                String effects = t.effects().isEmpty() ? "—" : String.join("、", t.effects());
                if (t.exitsWarningScope()) {
                    effects = effects.equals("—") ? "退出预警范围" : effects + "、退出预警范围";
                }
                md.append("| %d | %s | %s | `%s` | %s | %s |%n".formatted(
                        i + 1,
                        t.from() == null ? "（新建/空）" : t.from(),
                        t.actionLabel(), t.action(), t.to(), effects));
            }
            md.append('\n');
        }

        md.append("""
                ## 核对时发现的文档问题（已全部修订）

                机械核对暴露出 8 处文档内部不一致。**代码始终按转换表与字段清单实现**，
                文档已回头改齐：需求文档升 **V1.3**、开发实施文档升 **V1.2**。
                下表保留问题原貌，便于验收时回看当时的判断依据。

                | # | 位置 | 问题 | 修订结果 |
                |---|---|---|---|
                | 1 | 需求 5.13「状态值数」列 | 「需求业务验收状态」写 4，但 5.2.5 转换表与需求字段清单第 30 项都是 3 个值（待验收 / 验收通过 / 验收不通过） | 需求 V1.3 改为 3，并补写该列的计数口径 |
                | 2 | 需求 5.13「状态值数」列 | 「课程开发子状态」写 2，但 5.4.1 转换表与课程字段清单第 14 项都是 3 个值（待开发 / 开发中 / 自检中） | 需求 V1.3 改为 3 |
                | 3 | 需求 13.1.2 任务派生规则 | 只列了 8 条规则，但转换表要求派生 10 类任务：5.2.5 的「业务验收」与 5.9 的「案例审核」缺规则 | 需求 V1.3 补第 9、10 条。责任人按 13.1.1 字段规格第 5 项「取对象负责人」推出；**两条的默认截止天数是新的待确认项**，已登记为需求附录 A.3 第 23 项，阶段 3 前须关闭 |
                | 4 | 需求 5.3.1 第 15 行 | 「立项/开发/自检/优化 → 关闭课程开发 → 已关闭」未标「退出预警范围」，而第 7 行同样到「已关闭」标了 | 需求 V1.3 补标。两条目标状态同为终态「已关闭」，行为不可能不同，补上不改变实现 |
                | 5 | 开发实施文档 5.1.3／5.1.4 | `Transition` 带 `ExecutorScope executor`、转换流程第 4 步调 `permission.assertCan(...)`，与需求 C8、AR-7、PMI-4 冲突（V1.1 权限简化后的遗留） | 开发 V1.2 删除该字段与该步骤，并把 5.3.1 的 `ExecutorScope` 由「保留单值」改为整个枚举删除。判权收敛在 `PermissionInterceptor` |
                | 6 | 开发实施文档 5.1.6 | 写「出口三按需求文档描述实现」，但需求 V1.2 已取消出口三 | 开发 V1.2 删除该行（该节标题「三处待确认」由此才名副其实） |
                | 7 | 开发实施文档 6.3.2 建表语句 | 仍带只服务于出口三的 `reuse_tool_name` 列，且漏了需求 V1.2 新增的业务验收状态与交付标记两个状态字段 | 开发 V1.2 删该列，补 `acceptance_state`、`delivery_mark` 与两个时间列。**这一处必须在阶段 1B 建 43 张表前改对，否则落地成错的 schema** |
                | 8 | 开发实施文档 5.1.3 对象／状态字段对照表 | AI需求只列了 3 个状态字段，实际是 5 个 | 开发 V1.2 补齐业务验收状态与需求交付标记 |

                > **第 3 项留下了一个未关闭的业务问题**：新补的两条派生规则默认按「触发日 + 7 天」，
                > 但《开工前决策清单》D37 只覆盖了原 8 条，业务方尚未就这两条表态。
                > 引擎侧不受影响（副作用码已如实声明），但**阶段 3 实现任务派生前必须取得确认**。

                ## 需要单独人工核对的一张表

                **需求交付标记**（需求 5.13 清单第 5 项）是 16 张表里唯一手工转录的一张，
                不在解析脚本的 CSV 里，也不参与参数化测试的逐行比对。

                原因是它的源表（需求 5.2.5「前置与终态」）列头是「前置 / 动作 / 结果 / 执行人」，
                没有「当前状态 / 目标状态」两列，机械解析会解出错误结构。状态取值按 5.13
                「状态值数 2」与源表两行动作推导为「已交付 → 已归档」。

                **验收时这一张请直接对着需求 5.2.5 看。**
                """);

        return md.toString();
    }
}
