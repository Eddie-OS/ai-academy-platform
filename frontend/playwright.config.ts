import { defineConfig, devices } from '@playwright/test';

/**
 * 视觉回归运行合同（《设计文档 V2.0》第 1 章）。
 *
 * <p>1.1 截图环境与 1.2 固定配置的每一项都是验收口径，不是可调参数：
 * viewport 1586×992、deviceScaleFactor 1、zh-CN / Asia/Shanghai、light、reducedMotion=reduce。
 * 改动其中任何一项都会让既有基线整体失效，必须连基线一起重新生成并说明理由。
 *
 * <p>1.3 通过条件里 L5「抗锯齿掩膜后不匹配像素≤0.75%」对应 {@code maxDiffPixelRatio: 0.0075}；
 * L0～L2 的边界与基线偏差由各 spec 里的坐标断言承担 —— 整图像素比对发现不了
 * 「侧栏宽了 3px 而里面内容整体右移」这类错误，它的像素差可能仍在阈值内。
 */
export default defineConfig({
  testDir: './tests/visual',
  // 视觉基线对并发不敏感，但对机器负载敏感：并发下 GPU 合成时序不同会让抗锯齿像素浮动
  workers: 1,
  fullyParallel: false,
  // 基线截图不允许「重试就过」。失败必须当成真实差异去看，而不是靠重跑掩盖
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  expect: {
    toHaveScreenshot: {
      animations: 'disabled',
      scale: 'css',
      maxDiffPixelRatio: 0.0075,
    },
  },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 1586, height: 992 },
    deviceScaleFactor: 1,
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    colorScheme: 'light',
    reducedMotion: 'reduce',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium-1586',
      use: {
        // 1.1：基线必须由同一版本的 Chromium 生成，因此固定用 Playwright 自带的那个，
        // 不指向系统 Chrome —— 系统 Chrome 会自动升级，基线会在某天早上突然全红
        ...devices['Desktop Chrome'],
        channel: undefined,
        // devices['Desktop Chrome'] 自带 viewport 1280×720，而 project 级的 use 覆盖
        // 顶层 use，展开顺序在后就会把 1586×992 冲掉。必须在展开之后重申一次。
        // 这个坑不会报错，只会让九张基线整体按 1280 宽渲染 —— shell.ts 里那条
        // 「视口必须是 1586×992」的断言就是为了在这里立刻炸掉，而不是等到看图才发现
        viewport: { width: 1586, height: 992 },
        deviceScaleFactor: 1,
      },
    },
  ],
  webServer: {
    // 用 preview 而不是 dev：dev 模式下 Vite 注入的 HMR 客户端会在页面上留一个
    // 隐藏 overlay，且模块是按需编译的，首屏字体与样式的到位时机不稳定。
    //
    // 直接调 vite 而不是 npm run preview：`npm run preview -- --port` 这种参数转发
    // 在 Windows 上会被 npm 的 shell 包装吃掉，preview 起在默认的 4173 之外，
    // Playwright 等的是 4173，表现为「构建成功但 webServer 超时」。
    // build 也交给 Playwright 之外做，见 npm run test:visual 的说明。
    command: 'npx vite preview --port 4173 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
