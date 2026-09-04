package com.aiacademy.app.schedule;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * 数据库 pg_dump 备份，每日 2:00（开发 5.11.1、C13）。
 *
 * <p>生产环境是 Windows + WSL2（BLOCK-05）：路径与进程调用按 Windows 编写，不写 {@code .sh}。
 * 当前假设单实例部署，多实例需引入分布式锁。
 *
 * <p><b>E4-5</b>：备份文件必须能恢复到空库才算有效——见
 * {@code docs/备份恢复验证.md}。
 *
 * <p><b>为什么加了 {@code aiacademy.backup.enabled} 这个开关：</b>本任务靠外部
 * {@code pg_dump} 可执行文件工作，Docker 形态下它在 postgres 容器里，单机形态下
 * <b>根本不存在</b>——嵌入式 PostgreSQL 只解包出 {@code initdb}、{@code pg_ctl}、
 * {@code postgres} 三个程序。于是单机部署上这个任务每晚 02:00 抛一次异常，
 * 除日志里一行以外没有任何迹象，而运营会以为每日备份是配好的。
 *
 * <p>「备份看起来在跑、其实每晚失败」比「明确没有备份」危险得多：后者会让人去做手工备份，
 * 前者只会在真需要恢复的那天才发现。因此单机形态显式关掉（见
 * {@code application-standalone.yml}），要备份就手工停机打包 {@code data/} 目录 ——
 * 数据库与附件都在那一个目录下。
 */
@Component
@ConditionalOnProperty(name = "aiacademy.backup.enabled", matchIfMissing = true)
public class DatabaseBackupJob {

    private static final Logger log = LoggerFactory.getLogger(DatabaseBackupJob.class);

    private final JobRunLogger jobLogs;
    private final String jdbcUrl;
    private final String username;
    private final String password;
    private final Path backupDir;
    private final String pgDump;

    public DatabaseBackupJob(
            JobRunLogger jobLogs,
            @Value("${spring.datasource.url}") String jdbcUrl,
            @Value("${spring.datasource.username}") String username,
            @Value("${spring.datasource.password}") String password,
            @Value("${aiacademy.backup.dir:./data/backup}") String backupDir,
            @Value("${aiacademy.backup.pg-dump:pg_dump}") String pgDump) {
        this.jobLogs = jobLogs;
        this.jdbcUrl = jdbcUrl;
        this.username = username;
        this.password = password;
        this.backupDir = Path.of(backupDir).toAbsolutePath().normalize();
        this.pgDump = pgDump;
    }

    @Scheduled(cron = "0 0 2 * * *")
    public void runDaily() {
        jobLogs.run("database-backup", () -> {
            try {
                return backup();
            } catch (Exception e) {
                throw new IllegalStateException(e.getMessage(), e);
            }
        });
    }

    String backup() throws Exception {
        Files.createDirectories(backupDir);
        DbEndpoint ep = parseJdbc(jdbcUrl);
        String stamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss"));
        Path out = backupDir.resolve("ai-academy-" + stamp + ".dump");

        List<String> cmd = new ArrayList<>();
        cmd.add(pgDump);
        cmd.add("-h");
        cmd.add(ep.host);
        cmd.add("-p");
        cmd.add(ep.port);
        cmd.add("-U");
        cmd.add(username);
        cmd.add("-d");
        cmd.add(ep.database);
        cmd.add("-Fc");
        cmd.add("-f");
        cmd.add(out.toString());

        ProcessBuilder pb = new ProcessBuilder(cmd);
        pb.environment().put("PGPASSWORD", password);
        pb.redirectErrorStream(true);
        Process process = pb.start();
        StringBuilder output = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                output.append(line).append('\n');
            }
        }
        boolean finished = process.waitFor(30, TimeUnit.MINUTES);
        if (!finished) {
            process.destroyForcibly();
            throw new IllegalStateException("pg_dump 超时");
        }
        if (process.exitValue() != 0) {
            throw new IllegalStateException("pg_dump 失败 exit=" + process.exitValue()
                    + " " + output);
        }
        if (!Files.isRegularFile(out) || Files.size(out) == 0) {
            throw new IllegalStateException("备份文件未生成或为空：" + out);
        }
        String msg = "备份完成：" + out + " size=" + Files.size(out);
        log.info(msg);
        return msg;
    }

    static DbEndpoint parseJdbc(String url) {
        // jdbc:postgresql://host:port/db
        String stripped = url.replace("jdbc:postgresql://", "");
        int slash = stripped.indexOf('/');
        String hostPort = slash < 0 ? stripped : stripped.substring(0, slash);
        String db = slash < 0 ? "postgres" : stripped.substring(slash + 1).split("[?]")[0];
        String host = hostPort;
        String port = "5432";
        if (hostPort.contains(":")) {
            String[] hp = hostPort.split(":");
            host = hp[0];
            port = hp[1];
        }
        return new DbEndpoint(host, port, db);
    }

    record DbEndpoint(String host, String port, String database) {
    }
}
