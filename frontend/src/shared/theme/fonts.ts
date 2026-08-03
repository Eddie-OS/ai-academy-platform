/**
 * 字体本地加载（《设计文档 V2.0》1.1、F06、16.2）。
 *
 * <p>文档锁定 Inter 400/500/600/700 + Noto Sans SC 400/500/600/700 共八个字面，
 * 并要求「实际版本写入 lockfile，不通过 CDN 加载」。因此走 @fontsource 的 npm 包，
 * woff2 由 Vite 打包进产物，不发起任何外部请求。
 *
 * <p><b>只引这四个字重，不要图省事引 index.css。</b>index.css 会把 100～900 九档全下载，
 * Noto Sans SC 单档就有上百个 unicode-range 分片，九档会让首屏字体请求数翻两倍多；
 * 而 tokens-v2.css 已设 {@code font-synthesis: none}，多出来的字重一处也用不到。
 *
 * <p>Noto Sans SC 取 {@code chinese-simplified-*} 子集：完整包含拉丁、西里尔、越南语等
 * 分片，界面里的拉丁字符由 Inter 承担（Inter 在字族里排在前面），中文包的拉丁分片是纯浪费。
 */

import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';

import '@fontsource/noto-sans-sc/chinese-simplified-400.css';
import '@fontsource/noto-sans-sc/chinese-simplified-500.css';
import '@fontsource/noto-sans-sc/chinese-simplified-600.css';
import '@fontsource/noto-sans-sc/chinese-simplified-700.css';

/** 文档 17 门禁「字体：4 档字重本地加载」的自检用清单 */
export const REQUIRED_FONT_FACES = [
  { family: 'Inter', weights: [400, 500, 600, 700] },
  { family: 'Noto Sans SC', weights: [400, 500, 600, 700] },
] as const;
