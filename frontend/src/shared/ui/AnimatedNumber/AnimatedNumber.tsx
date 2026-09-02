import { useEffect, useMemo, useState } from 'react';
import { shouldReduceMotion } from '@/shared/motion/motionPreference';

const DEFAULT_DURATION = 240;
const NUMBER_PATTERN = /^([^\d+-]*)([+-]?\d[\d,]*(?:\.\d+)?)(.*)$/;

interface ParsedNumber {
  prefix: string;
  suffix: string;
  target: number;
  fractionDigits: number;
  showPlus: boolean;
}

export interface AnimatedNumberProps {
  value: string | number;
  duration?: number;
  className?: string;
}

function parseNumber(value: string | number): ParsedNumber | null {
  const text = String(value);
  const match = NUMBER_PATTERN.exec(text);
  if (!match) {
    return null;
  }

  const [, prefix = '', rawNumber, suffix = ''] = match;
  if (!rawNumber) {
    return null;
  }
  const target = Number(rawNumber.replaceAll(',', ''));
  if (!Number.isFinite(target)) {
    return null;
  }

  return {
    prefix,
    suffix,
    target,
    fractionDigits: rawNumber.split('.')[1]?.length ?? 0,
    showPlus: rawNumber.startsWith('+'),
  };
}

function formatNumber(parsed: ParsedNumber, value: number): string {
  const number = new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: parsed.fractionDigits,
    maximumFractionDigits: parsed.fractionDigits,
  }).format(value);
  const sign = parsed.showPlus && value >= 0 ? '+' : '';
  return `${parsed.prefix}${sign}${number}${parsed.suffix}`;
}

/**
 * 只负责数字文本的短时滚动，不改变布局。
 *
 * 输入中的前后缀、千分位和小数位会原样保留；无法安全解析的文案直接显示，避免把业务文案
 * 猜成数字。回归模式与 reduced-motion 模式始终直接显示终值。
 */
export function AnimatedNumber({
  value,
  duration = DEFAULT_DURATION,
  className,
}: AnimatedNumberProps) {
  const text = String(value);
  const parsed = useMemo(() => parseNumber(value), [value]);
  const [display, setDisplay] = useState(() =>
    parsed && !shouldReduceMotion() ? formatNumber(parsed, 0) : text,
  );

  useEffect(() => {
    if (!parsed || shouldReduceMotion() || duration <= 0) {
      setDisplay(text);
      return;
    }

    let frame = 0;
    const animationWindow = window as unknown as {
      requestAnimationFrame?: typeof window.requestAnimationFrame;
      cancelAnimationFrame?: typeof window.cancelAnimationFrame;
    };
    const nativeRequestFrame = animationWindow.requestAnimationFrame?.bind(window);
    const startedAt = nativeRequestFrame ? performance.now() : Date.now();
    const requestFrame =
      nativeRequestFrame ??
      ((callback: FrameRequestCallback) =>
        window.setTimeout(() => callback(Date.now()), 16) as unknown as number);
    const cancelFrame =
      animationWindow.cancelAnimationFrame?.bind(window) ??
      ((id: number) => window.clearTimeout(id));
    const finishTimer = window.setTimeout(() => setDisplay(text), duration);

    const tick = (now: number) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(formatNumber(parsed, parsed.target * eased));
      if (progress < 1) {
        frame = requestFrame(tick);
      }
    };

    frame = requestFrame(tick);
    return () => {
      cancelFrame(frame);
      window.clearTimeout(finishTimer);
    };
  }, [duration, parsed, text]);

  return (
    <span className={className} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {display}
    </span>
  );
}
