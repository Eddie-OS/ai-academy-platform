package com.aiacademy.app.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.ViewControllerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.resource.PathResourceResolver;

import java.io.IOException;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * 单机模式下由 Spring Boot 直接托管前端静态文件（standalone profile）。
 *
 * <p>生产原本是三容器 app + postgres + nginx（C13／BLOCK-03），nginx 做静态托管与反向代理。
 * 内网机器装不了 Docker，而 nginx 那一层在单机 100 人以内的规模下没有承担别的职责，
 * 因此整层去掉：静态文件交给 Spring Boot，反向代理不再需要（前后端同源同端口，
 * 顺带少了一处 CORS 与 Cookie 域的配置面）。
 *
 * <p>静态文件放在 jar <b>外面</b>的 {@code web/} 目录，不打进 jar。这样前端改版只要换一个目录，
 * 不必重新构建后端——而后端构建需要 JDK 与 Gradle，内网机器上未必装得全。
 */
@Configuration
@Profile("standalone")
public class StandaloneWebConfig implements WebMvcConfigurer {

    /**
     * 不做 SPA 回退的前缀。
     *
     * <p><b>这份清单是本类的关键，不是可省的优化。</b>SPA 回退的常见写法是「任何找不到的路径
     * 都返回 index.html」，因为浏览器直接访问 {@code /demands/123} 时服务器上并没有那个文件，
     * 必须交给前端路由。但同一条规则会把<b>拼错的接口路径也变成 200 + HTML</b>：
     * 前端拿到一段 {@code <!doctype html>} 去 {@code JSON.parse}，报的是「Unexpected token <」。
     * 那个错误信息里没有任何一处提到 404，排查会从「后端为什么返回了坏 JSON」开始，
     * 而真正的原因是路径写错了一个字母。
     *
     * <p>所以这些前缀下的未命中一律放行到默认的 404，让它以本来的面目出现。
     */
    private static final String[] NO_FALLBACK_PREFIXES = {
            "api/", "actuator/", "v3/api-docs", "swagger-ui",
    };

    private final Path webRoot;

    public StandaloneWebConfig(@Value("${aiacademy.web-root:./web}") String webRoot) {
        this.webRoot = Paths.get(webRoot).toAbsolutePath().normalize();
    }

    /**
     * 根路径 {@code /} 单独转发到 index.html。
     *
     * <p>下面那个 SPA 回退解析器管不到这一条：{@code ResourceHttpRequestHandler} 在调用解析器
     * <b>之前</b>就用 {@code StringUtils.hasText(path)} 把空路径挡掉了，直接抛
     * {@code NoResourceFoundException}。也就是说深链 {@code /courses/1} 能回退到 index.html，
     * 而首页 {@code / } 反而 404 —— 恰好是用户打开浏览器碰到的第一个地址。
     *
     * <p>三容器形态下这条由 nginx 的 {@code index index.html} 承担，去掉 nginx 后没人接。
     * Spring Boot 自带的欢迎页机制只认 {@code spring.web.resources.static-locations} 下的
     * index.html，而这里的前端在 jar 外的 {@code web/} 目录、走的是自定义 handler，够不上。
     */
    @Override
    public void addViewControllers(ViewControllerRegistry registry) {
        registry.addViewController("/").setViewName("forward:/index.html");
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/**")
                .addResourceLocations(webRoot.toUri().toString())
                .resourceChain(true)
                .addResolver(new SpaResourceResolver());
    }

    private final class SpaResourceResolver extends PathResourceResolver {

        @Override
        protected Resource getResource(String resourcePath, Resource location) throws IOException {
            /*
             * 命中真实文件的那条路交给父类，不要自己写成 location.createRelative(...)。
             * 父类除了判可读，还调 checkResource() 校验解析结果没有跑到 location 之外——
             * 那是防路径穿越的一道，自己实现等于把它拆掉。
             * 顺带一个好处：目录的 isReadable() 为 false，于是 web/ 本身不会被当成文件返回。
             */
            Resource requested = super.getResource(resourcePath, location);
            if (requested != null) {
                return requested;
            }
            for (String prefix : NO_FALLBACK_PREFIXES) {
                if (resourcePath.startsWith(prefix)) {
                    return null;
                }
            }
            /*
             * 看起来像文件名的（末段带扩展名）也不回退。
             *
             * 少了这一条，一个没打进包的 assets/index-a1b2c3.js 会拿到 200 + index.html，
             * 浏览器把 HTML 当 JS 解析，报 "Unexpected token '<'"。那条报错指向的是 JS 语法，
             * 而真正的原因是文件不存在——与上面接口路径那一段是同一类误导，
             * 只是发生在资源文件上，且更常见：前端换版本时漏拷 assets 目录就会撞到。
             *
             * 前端路由不带扩展名（/demands/123、/courses），因此这条不会误伤 SPA 回退。
             */
            int lastSlash = resourcePath.lastIndexOf('/');
            if (resourcePath.indexOf('.', lastSlash + 1) >= 0) {
                return null;
            }
            /*
             * 前端路由路径（/demands/123、/courses 等）在磁盘上没有对应文件，交给 index.html
             * 由 React Router 解析。这也覆盖了刷新页面与直接粘贴地址两种情况——
             * 旧收藏不失效这条（见 AGENTS.md 的版式说明）依赖的就是这里。
             */
            Resource index = new FileSystemResource(webRoot.resolve("index.html"));
            return index.exists() ? index : null;
        }
    }
}
