import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;

/**
 * 把一个 .sql 文件整体喂给 PostgreSQL。
 *
 * <p><b>为什么需要它：</b>原先 seed.ps1／seed-perf.ps1 都走 {@code docker exec ... psql}。
 * 内网装不了 Docker，交付形态换成嵌入式 PostgreSQL 之后那条路断了，而嵌入式实例
 * <b>只解包 initdb／pg_ctl／postgres 三个程序，没有 psql</b>。于是灌数据这件事
 * 在新形态下没有任何可用工具。
 *
 * <p>这里用 JDBC 绕开对 psql 的依赖：驱动从 app.jar 里取（见 _sql-runner.ps1），
 * 开发机上本来就有 JDK，不引入任何新依赖。
 *
 * <p><b>单文件源码，不参与 Gradle 构建</b>，用 JEP 330 直接跑：
 * <pre>java -cp postgresql.jar RunSqlFile.java &lt;jdbcUrl&gt; &lt;sqlFile&gt;</pre>
 *
 * <p>整个文件作为一个 statement 提交，与 {@code psql -f} 的单事务语义一致：
 * 中途失败则整份回滚，不会留下灌了一半的数据。seed-perf.sql 里的
 * {@code SET session_replication_role} 之类会话级设置也因此能正常生效。
 */
public class RunSqlFile {

    public static void main(String[] args) throws Exception {
        if (args.length < 2) {
            System.err.println("用法：java -cp postgresql.jar RunSqlFile.java <jdbcUrl> <sqlFile>");
            System.exit(2);
        }
        String url = args[0];
        Path file = Path.of(args[1]);
        if (!Files.exists(file)) {
            System.err.println("找不到 SQL 文件：" + file.toAbsolutePath());
            System.exit(2);
        }
        String sql = Files.readString(file, StandardCharsets.UTF_8);

        long t0 = System.currentTimeMillis();
        try (Connection conn = DriverManager.getConnection(url);
             Statement st = conn.createStatement()) {
            st.execute(sql);
        }
        System.out.printf("%s 执行完毕，耗时 %d ms%n", file.getFileName(), System.currentTimeMillis() - t0);
    }
}
