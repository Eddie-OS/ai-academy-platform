/**
 * 演示模式：无后端的纯前端构建。
 *
 * <p>用途只有一个——把前端单独发到静态托管（Vercel）上给人看界面。整套后端是
 * Spring Boot + PostgreSQL 单机三容器（C13／BLOCK-03），静态托管上不存在，
 * 因此演示构建里一次接口也不发：登录态直接给冻结账号，其余接口立即失败，
 * 九页复刻件自行回落到 {@code src/fixtures} 的冻结数据。
 *
 * <h3>为什么不复用 {@code ?fixture=1} 的视觉回归模式</h3>
 *
 * 回归模式除了换数据源，还会打 {@code data-regression}：逐页覆盖壳层尺寸、
 * 关掉滚动与动画、冻结加载态。那是为截图比对服务的，拿来当演示会得到一个不能滚动的页面。
 * 两者只共用 fixtures，模式判定各走各的。
 *
 * <h3>为什么是构建期开关而不是 URL 参数</h3>
 *
 * {@code regressionMode.ts} 已经写明「回归模式在生产环境被误开会让运营看到假数据」。
 * 演示模式的数据同样是假的，风险更大——它连登录都跳过。所以判定只读构建期注入的
 * {@code VITE_DEMO_MODE}，<b>没有任何运行期入口</b>：正式产品构建不设这个变量，
 * 线上就不可能有人通过改地址栏把自己切进演示态。
 */

/**
 * 当前构建是否为演示构建。
 *
 * <p>值在构建时由 Vite 静态替换，未设置时为 false，因此正式构建里
 * 所有 {@code if (isDemoMode())} 分支会被摇树删掉，不进产物。
 */
export function isDemoMode(): boolean {
  return import.meta.env.VITE_DEMO_MODE === '1';
}
