import { useCallback, useEffect, useRef, useState } from 'react';
import { shouldReduceMotion } from './motionPreference';

const EXIT_DURATION = 140;

/**
 * 给条件渲染的自定义弹窗留出退出帧。
 *
 * AntD Modal 自带延迟卸载；V2 自绘弹窗原先在 onClose 中立即卸载，CSS 没有机会播放退出动画。
 */
export function useDialogMotion(onClose: () => void) {
  const closeRef = useRef(onClose);
  const closingRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(
    () => () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    },
    [],
  );

  const requestClose = useCallback(() => {
    if (closingRef.current) {
      return;
    }
    if (shouldReduceMotion()) {
      closeRef.current();
      return;
    }

    closingRef.current = true;
    setClosing(true);
    timerRef.current = window.setTimeout(() => closeRef.current(), EXIT_DURATION);
  }, []);

  return { closing, requestClose };
}
