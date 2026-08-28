/**
 * 打印无障碍走查用的对比度实测值（A11Y-01／02／12）。
 *
 * 断言在 src/shared/theme/contrast.test.ts 里；这个脚本只是把数字列出来贴进走查表，
 * 免得有人为了看一个比值去改测试的期望值。
 *
 * 用法：node scripts/contrast-report.mjs
 */

const WHITE = '#FFFFFF';

const PAIRS = [
  ['正文 textPrimary', '#101828', WHITE, 4.5],
  ['二级 textSecondary', '#475467', WHITE, 4.5],
  ['三级 textTertiary', '#667085', WHITE, 4.5],
  ['三级文字在弱底 #F5F7FA', '#667085', '#F5F7FA', 4.5],
  ['V1.1 正文 neutral-700', '#4B5563', WHITE, 4.5],
  ['白字 on 交互主色 #3974FA', WHITE, '#3974FA', 4.5],
  ['白字 on hover #2F67ED', WHITE, '#2F67ED', 4.5],
  ['白字 on active #285BD9', WHITE, '#285BD9', 4.5],
  ['白字 on V1.1 交互色 #4E70DB', WHITE, '#4E70DB', 4.5],
  ['品牌识别色 #5B82FF on 白（焦点环）', '#5B82FF', WHITE, 3],
  ['蓝灯 #0EA5E9 on 白', '#0EA5E9', WHITE, 3],
  ['黄灯 #F59E0B on 白', '#F59E0B', WHITE, 3],
  ['红灯 #EF4444 on 白', '#EF4444', WHITE, 3],
  ['无灯 #667085 on 白', '#667085', WHITE, 3],
  ['控件边框 #E5E7EB on 白（V-4）', '#E5E7EB', WHITE, 3],
  ['placeholder #ACB3BD on 白（V-5）', '#ACB3BD', WHITE, 4.5],
];

function luminance(hex) {
  const value = hex.replace('#', '');
  const channels = [0, 2, 4].map((offset) => {
    const raw = parseInt(value.slice(offset, offset + 2), 16) / 255;
    return raw <= 0.03928 ? raw / 12.92 : ((raw + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a, b) {
  const x = luminance(a);
  const y = luminance(b);
  const [light, dark] = x > y ? [x, y] : [y, x];
  return (light + 0.05) / (dark + 0.05);
}

for (const [name, fg, bg, limit] of PAIRS) {
  const ratio = contrast(fg, bg);
  const verdict = ratio >= limit ? '达标' : '不达标';
  console.log(`${name.padEnd(36, '　')} ${ratio.toFixed(2)}:1  需 ${limit}:1  ${verdict}`);
}
