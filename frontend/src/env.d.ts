/**
 * 构建期环境变量的类型声明。
 *
 * <p>这里手写而不是 {@code /// <reference types="vite/client" />}：后者会顺带引入
 * 一大批模块通配声明（{@code *.css}、{@code *.svg}、{@code *.png} 等）。当前
 * tsconfig 的 {@code types} 是显式白名单，引入那一整包会改变现有 import 的解析结果，
 * 让本次改动的影响范围远超「加一个开关」。只声明真正用到的那一个变量。
 *
 * <p>可选类型（{@code ?}）是刻意的：正式构建不设 {@code VITE_DEMO_MODE}，
 * 此时它就是 undefined，调用方必须处理这种情况。
 */
interface ImportMetaEnv {
  /** 演示构建开关，取 '1' 时生效。见 {@code src/app/demoMode.ts} */
  readonly VITE_DEMO_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
