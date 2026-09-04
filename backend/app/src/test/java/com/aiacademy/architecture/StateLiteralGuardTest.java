package com.aiacademy.architecture;

import com.aiacademy.platform.statemachine.domain.StateMachineDef;
import com.aiacademy.platform.statemachine.domain.Transition;
import com.aiacademy.platform.statemachine.domain.machines.CaseStateMachines;
import com.aiacademy.platform.statemachine.domain.machines.CourseStateMachines;
import com.aiacademy.platform.statemachine.domain.machines.DemandStateMachines;
import com.aiacademy.platform.statemachine.domain.machines.StateMachineCatalog;
import com.aiacademy.platform.statemachine.domain.machines.TaskStateMachine;
import com.aiacademy.platform.statemachine.domain.machines.TrainingStateMachines;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 状态硬编码门禁（阶段 2 出口准则 E2-6、人工验收动作 3）。
 *
 * <p>业务模块与 app 模块的源码里<b>不得出现状态值字面量</b>。状态值只应存在两个地方：
 * 状态机注册表（{@code platform/statemachine} 的转换表）与它下发出去的接口响应。
 *
 * <p><b>为什么要做成机器门禁而不是每轮人工搜一遍。</b>「课程发布了就不能再改」这类判断，
 * 写成 {@code if ("已发布".equals(state))} 是最自然的写法，AI 每次生成新代码都会重新想到它。
 * 人工搜索只能发现当次的，机器检查能挡住以后每一次。而这类代码的危害是隐蔽的：它能编译、
 * 能过大部分测试，直到需求第 5 章的转换表改了一个状态名，判断悄悄失效，症状是「某个操作
 * 突然可以做了」。
 *
 * <p>检查的是<b>字符串字面量</b>，不是注释与文档：注释里写「当前状态为「已发布」」是必要的说明。
 * 因此扫描前先剥掉行注释、块注释与 Javadoc。
 */
class StateLiteralGuardTest {

    /**
     * 被检查的源码目录。{@code platform/statemachine} 不在其中——转换表本身就是状态值的定义处。
     *
     * <p>{@code common} 与其余 platform 模块也纳入：平台模块出现业务状态值，说明底座在替业务
     * 做判断，那比业务模块自己写更难被发现。
     */
    private static final List<String> SCANNED_MODULES = List.of(
            "app/src/main/java",
            "business",
            "aggregate",
            "common/src/main/java",
            "platform/people", "platform/audit", "platform/dataimport",
            "platform/storage", "platform/escalation", "platform/dict");

    /**
     * 受控白名单：文件名 → 允许出现状态值的理由。
     *
     * <p>每加一条都要写清为什么这里必须写字面量。<b>空着理由的白名单等于没有门禁</b>——
     * 半年后没人能判断某一条是当初想清楚的例外，还是顺手加进来绕过失败的。
     */
    private static final List<String> ALLOWED_FILES = List.of();

    /**
     * 短状态值不参与检查。
     *
     * <p>「开发」「优化」「发布」「推广」这类两字状态值会命中大量正常文案：
     * 「关闭课程开发」是动作标签、「进入推广」是按钮名。把它们一并禁掉的结果是白名单迅速膨胀，
     * 门禁退化成摆设。三字以上的状态值（「已发布」「评审决策」「待录入结论」）足以覆盖真正
     * 危险的那类判断——{@code if ("已发布".equals(state))} 里的状态名恰恰都是长的。
     */
    private static final int MIN_CHECKED_LENGTH = 3;

    // 文本块要放在前面：先匹配普通字符串的话，三引号会被拆成一个空串加一个引号
    private static final Pattern STRING_LITERAL =
            Pattern.compile("\"\"\"[\\s\\S]*?\"\"\"|\"([^\"\\\\]|\\\\.)*\"");
    private static final Pattern BLOCK_COMMENT = Pattern.compile("/\\*[\\s\\S]*?\\*/");
    private static final Pattern LINE_COMMENT = Pattern.compile("//[^\\n]*");

    @Test
    @DisplayName("E2-6：业务与聚合模块的源码里不得出现状态值字面量，状态判断一律交给状态机引擎")
    void noStateLiteralsOutsideStateMachine() {
        Set<String> stateValues = checkedStateValues();
        assertThat(stateValues)
                .describedAs("状态机注册表里应当有可检查的状态值，取不到说明这条门禁什么都没检查")
                .isNotEmpty();

        List<String> violations = new ArrayList<>();
        for (Path file : javaSources()) {
            if (ALLOWED_FILES.contains(file.getFileName().toString())) {
                continue;
            }
            String code = stripComments(read(file));
            for (String literal : stringLiterals(code)) {
                for (String state : stateValues) {
                    if (containsAsWholeValue(literal, state)) {
                        violations.add("%s：字符串 %s 含状态值「%s」".formatted(file.getFileName(), literal, state));
                    }
                }
            }
        }

        assertThat(violations)
                .describedAs("""
                        状态值只应出现在 platform/statemachine 的转换表与它下发的接口里。
                        需要按状态判断时，改为调用状态机引擎（可执行动作由 available 接口给出）；
                        需要在 SQL 里限定状态时，把状态值作为参数从状态机取来传入，不要写在 SQL 文本里。""")
                .isEmpty();
    }

    /**
     * SQL 文本里的单引号状态值同样要挡。
     *
     * <p>Java 字面量能被上一条挡住，而 {@code WHERE record_state = '待录入结论'} 写在文本块里，
     * 从 Java 语法看只是一个长字符串。这类写法比 Java 侧的 if 判断更隐蔽：它躲在 Mapper 里，
     * 而 Mapper 是最少被评审的一层。
     */
    @Test
    @DisplayName("E2-6 配套：Mapper 的 SQL 文本里不得出现状态值，状态条件必须作为参数传入")
    void noStateLiteralsInSql() {
        Set<String> stateValues = checkedStateValues();
        List<String> violations = new ArrayList<>();

        for (Path file : javaSources()) {
            if (ALLOWED_FILES.contains(file.getFileName().toString())) {
                continue;
            }
            String code = stripComments(read(file));
            for (Matcher matcher = Pattern.compile("'([^']{2,64})'").matcher(code); matcher.find(); ) {
                String literal = matcher.group(1);
                for (String state : stateValues) {
                    if (containsAsWholeValue(literal, state)) {
                        violations.add("%s：SQL 字面量 '%s' 含状态值「%s」".formatted(
                                file.getFileName(), literal, state));
                    }
                }
            }
        }

        assertThat(violations)
                .describedAs("把状态值作为参数从状态机取来传给 Mapper，不要写死在 SQL 文本里")
                .isEmpty();
    }

    /**
     * 状态机模块对外导出的状态常量必须真的是那个状态机里的状态。
     *
     * <p>业务代码引用 {@code TrainingStateMachines.SESSION_OPENED} 而不写「已开课」，前提是这个常量
     * 跟转换表不会各走各的。常量与转换表是同一个文件里的两处字面量，改一处忘一处不会有任何编译错误，
     * 症状要到运行时才出现：导入校验永远匹配不上，所有行都报「场次状态不允许」。
     */
    @Test
    @DisplayName("状态机模块导出的状态常量与转换表一致，业务代码才敢用常量代替字面量")
    void exportedStateConstantsMatchTransitionTable() {
        Set<String> sessionStates = new TreeSet<>();
        for (Transition transition : TrainingStateMachines.session().transitions()) {
            Stream.of(transition.from(), transition.to())
                    .filter(state -> state != null)
                    .forEach(sessionStates::add);
        }

        assertThat(sessionStates)
                .describedAs("场次状态常量必须出现在培训场次状态机的转换表里")
                .contains(TrainingStateMachines.SESSION_PENDING,
                        TrainingStateMachines.SESSION_OPENED,
                        TrainingStateMachines.SESSION_FINISHED,
                        TrainingStateMachines.SESSION_ARCHIVED);

        assertThat(statesOf(CourseStateMachines.mainState()))
                .describedAs("课程主状态常量必须出现在课程主状态机的转换表里")
                .contains(CourseStateMachines.MAIN_REVIEW_DECISION,
                        CourseStateMachines.MAIN_OPTIMIZE);
        assertThat(statesOf(CourseStateMachines.trialSubState()))
                .describedAs("试讲子状态常量必须出现在试讲子状态机的转换表里")
                .contains(CourseStateMachines.TRIAL_PENDING);

        assertThat(statesOf(DemandStateMachines.acceptance()))
                .describedAs("业务验收状态常量必须出现在验收状态机的转换表里")
                .contains(DemandStateMachines.ACCEPTANCE_PENDING);

        assertThat(statesOf(CaseStateMachines.caseState()))
                .describedAs("案例状态常量必须出现在案例状态机的转换表里")
                .contains(CaseStateMachines.STATE_PENDING_ORGANIZE,
                        CaseStateMachines.STATE_ORGANIZING,
                        CaseStateMachines.STATE_PENDING_AUDIT,
                        CaseStateMachines.STATE_PUBLISHED);

        assertThat(statesOf(TaskStateMachine.task()))
                .describedAs("任务状态常量必须出现在任务状态机的转换表里")
                .contains(TaskStateMachine.STATE_PENDING, TaskStateMachine.STATE_IN_PROGRESS);
    }

    /**
     * 状态值是否以「完整取值」的形态出现在字面量里，而不是恰好成为另一个词的前缀或后缀。
     *
     * <p>直接用 {@code contains} 会误报：任务状态里有「已完成」，而讲师的<b>培养计划</b>状态
     * 有「已完成培养」（{@code LecturerEnums.PLAN_DONE}）。两者是不同枚举的取值，
     * 培养计划也不走状态机（规则 TS2），但前者是后者的前缀，于是枚举定义处被判成违规。
     *
     * <p>这类误报的代价不只是一次报红：唯一的消解办法是把整个文件加进
     * {@code ALLOWED_FILES}，而那会让该文件里<b>真正的</b>状态判断也一起免检——
     * 门禁越不准，白名单就越长，最后挡不住任何东西。
     *
     * <p>因此要求匹配处两侧不是汉字。危险写法一条不漏：
     * {@code if ("已完成".equals(state))} 的字面量恰好等于状态值，两侧无字符；
     * SQL 文本里的 {@code = '已完成'} 两侧是引号。而「已完成培养」后面跟着「培」，被排除。
     */
    private static boolean containsAsWholeValue(String literal, String state) {
        int from = 0;
        while (true) {
            int at = literal.indexOf(state, from);
            if (at < 0) {
                return false;
            }
            int before = at - 1;
            int after = at + state.length();
            boolean 左侧粘连 = before >= 0 && isChinese(literal.charAt(before));
            boolean 右侧粘连 = after < literal.length() && isChinese(literal.charAt(after));
            if (!左侧粘连 && !右侧粘连) {
                return true;
            }
            from = at + 1;
        }
    }

    private static boolean isChinese(char c) {
        return Character.UnicodeScript.of(c) == Character.UnicodeScript.HAN;
    }

    private static Set<String> statesOf(StateMachineDef machine) {
        Set<String> states = new TreeSet<>();
        for (Transition transition : machine.transitions()) {
            Stream.of(transition.from(), transition.to())
                    .filter(state -> state != null)
                    .forEach(states::add);
        }
        return states;
    }

    /** 全部状态机的状态值，去掉太短的与表示空状态的伪值。 */
    private static Set<String> checkedStateValues() {
        Set<String> values = new TreeSet<>();
        for (StateMachineDef machine : StateMachineCatalog.all()) {
            for (Transition transition : machine.transitions()) {
                Stream.of(transition.from(), transition.to())
                        // 「（空）」是转换表里表达「还没有状态」的写法，不是业务状态值
                        .filter(state -> state != null && state.length() >= MIN_CHECKED_LENGTH
                                && !state.startsWith("（"))
                        .forEach(values::add);
            }
        }
        return values;
    }

    private static List<Path> javaSources() {
        Path backend = backendRoot();
        List<Path> files = new ArrayList<>();
        for (String module : SCANNED_MODULES) {
            Path dir = backend.resolve(module);
            if (!Files.isDirectory(dir)) {
                continue;
            }
            try (Stream<Path> walk = Files.walk(dir)) {
                walk.filter(path -> path.toString().endsWith(".java"))
                        // 测试代码可以写状态值：断言「状态变成了『发布』」本来就该写出那个词
                        .filter(path -> !path.toString().replace('\\', '/').contains("/src/test/"))
                        .forEach(files::add);
            } catch (IOException e) {
                throw new UncheckedIOException(e);
            }
        }
        assertThat(files).describedAs("扫不到任何源码文件，说明路径推断错了，门禁形同虚设").isNotEmpty();
        return files;
    }

    /** 从测试的工作目录向上找到 backend 目录（含 settings.gradle）。 */
    private static Path backendRoot() {
        Path current = Path.of("").toAbsolutePath();
        while (current != null) {
            if (Files.exists(current.resolve("settings.gradle"))
                    || Files.exists(current.resolve("settings.gradle.kts"))) {
                return current;
            }
            current = current.getParent();
        }
        throw new IllegalStateException("没找到 backend 根目录（含 settings.gradle）");
    }

    private static String read(Path file) {
        try {
            return Files.readString(file, StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private static String stripComments(String code) {
        return LINE_COMMENT.matcher(BLOCK_COMMENT.matcher(code).replaceAll(" ")).replaceAll(" ");
    }

    private static Set<String> stringLiterals(String code) {
        Set<String> literals = new LinkedHashSet<>();
        Matcher matcher = STRING_LITERAL.matcher(code);
        while (matcher.find()) {
            literals.add(matcher.group());
        }
        return literals;
    }
}
