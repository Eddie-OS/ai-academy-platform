import type { CSSProperties } from 'react';
import { avatarSizesV2 } from '@/shared/theme/designTokensV2';
import { avatarUrlOf } from '@/fixtures/people';
import './Avatar.css';

/**
 * 人物头像（《设计文档 V2.0》2.4「头像 24/32/40/56/64，仅这 5 档」）。
 *
 * <p>P04 素材映射点名「人物头像需独立头像组件」。抽出来的直接收益是<b>散列只有一份</b>：
 * 抽之前 P01 与 P02 各写了一遍同样的 `AVATAR_TONES` + `avatarTone`，两份能对上纯属巧合 ——
 * 谁改一份颜色，同一个人在两页里就成了两个颜色，而这是运营用来认人的唯一线索。
 *
 * <p>P04 需要三个规格：讲师卡 40、详情头部 56、（预留）64。文档 P04 写的是
 * 「统一 40/48/64 三个规格」，48 不在 2.4 的 5 档里 —— <b>取 56 代替 48</b>（业务已裁决）。
 * 顺带把 P01 的 22px 与 P02 的 26px 两个规范外尺寸并到最小档 24。
 *
 * <h3>两种形态：名录内出图，名录外出首字</h3>
 *
 * 在 {@code fixtures/people.ts} 的 60 人名录里就渲染那个人的照片，否则回落到
 * 首字 + 底色。<b>回落不是降级，是给「业务接口人」「学员甲」这类没有工号的角色
 * 留的正当形态</b> —— 为了让它们有张脸而硬塞进人员台账，反而会让台账里出现不存在的人。
 */

export type AvatarSize = (typeof avatarSizesV2)[number];

export interface AvatarProps {
  /** 姓名。取首字做占位、并决定底色 */
  name: string;
  size: AvatarSize;
  /** 额外类名，用于父级的 flex 定位 */
  className?: string;
}

/**
 * 头像底色。
 *
 * <p>五个都是中性偏冷色，<b>不含四个语义色</b>：头像底色出现红或黄会被读成预警（WV4）。
 * 也不含灯色的浅底 —— 一屏里同时出现浅红头像与红灯时，两者的意思完全不同。
 */
const AVATAR_TONES = ['#5B82FF', '#7C6CF0', '#3FA9C9', '#5AA469', '#8A7CD8'] as const;

/**
 * 按姓名散列取色。
 *
 * <p>散列而不是按下标轮转：同一个人在任何页面、任何排序下必须是同一个颜色。
 * 按下标取色时，列表一排序头像颜色全变，看起来像换了一批人。
 */
export function avatarTone(name: string): string {
  const sum = [...name].reduce((acc, char) => acc + char.codePointAt(0)!, 0);
  return AVATAR_TONES[sum % AVATAR_TONES.length]!;
}

export function Avatar({ name, size, className }: AvatarProps) {
  const photo = avatarUrlOf(name);
  const style = {
    '--avatar-size': `${size}px`,
    // 照片加载完成前露出的是底色而不是白块，与回落形态同一个颜色
    background: avatarTone(name),
  } as CSSProperties;

  return (
    <span
      className={className ? `v2-avatar ${className}` : 'v2-avatar'}
      style={style}
      data-testid="avatar"
      data-avatar-size={size}
      data-avatar-kind={photo ? 'photo' : 'initial'}
      // 姓名紧跟在头像后面以文本给出，读屏再念一遍首字或照片是噪音
      aria-hidden
    >
      {photo ? (
        <img className="v2-avatar-img" src={photo} alt="" loading="lazy" decoding="async" />
      ) : (
        [...name][0]
      )}
    </span>
  );
}
