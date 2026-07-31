# 后端镜像。两段构建：Gradle 编译 → JRE 运行。
# 基础镜像用 Temurin 17（BLOCK-02 已确认无信创要求，用标准 OpenJDK）。

FROM gradle:8.10-jdk17 AS build
WORKDIR /src
COPY backend/ /src/
RUN gradle :app:bootJar --no-daemon -x test

FROM eclipse-temurin:17-jre
WORKDIR /app
RUN useradd --system --create-home --shell /usr/sbin/nologin aiacademy \
    && mkdir -p /data/attachments /var/log/aiacademy \
    && chown -R aiacademy:aiacademy /data/attachments /var/log/aiacademy
COPY --from=build /src/app/build/libs/ai-academy-app.jar /app/app.jar
USER aiacademy
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
