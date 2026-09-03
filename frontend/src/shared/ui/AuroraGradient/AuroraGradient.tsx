import { useEffect, useRef } from 'react';
import { shouldReduceMotion } from '@/shared/motion/motionPreference';
import './AuroraGradient.css';

const SRC = '/videos/aurora-gradient.mp4';
const FADE_SEC = 1.2;

export default function AuroraGradient({ className }: { className?: string }) {
  const aRef = useRef<HTMLVideoElement>(null);
  const bRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (shouldReduceMotion()) return;
    const a = aRef.current;
    const b = bRef.current;
    if (!a || !b) return;

    const pair = [a, b] as const;
    let active: 0 | 1 = 0;
    let fading = false;
    let raf = 0;

    const tick = () => {
      const cur = pair[active];
      const next = pair[active === 0 ? 1 : 0];
      if (cur.duration) {
        const fadeSec = Math.min(FADE_SEC, cur.duration / 3);
        const left = cur.duration - cur.currentTime;
        if (!fading && left <= fadeSec) {
          fading = true;
          next.currentTime = 0;
          void next.play();
        }
        if (fading) {
          const t = Math.max(0, Math.min(1, left / fadeSec));
          cur.style.opacity = String(t);
          next.style.opacity = String(1 - t);
          if (t <= 0) {
            cur.pause();
            cur.currentTime = 0;
            cur.style.opacity = '0';
            next.style.opacity = '1';
            active = active === 0 ? 1 : 0;
            fading = false;
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };

    a.classList.add('is-on');
    void a.play();
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      a.pause();
      b.pause();
    };
  }, []);

  return (
    <div className={'aurora-gradient ' + (className || '')}>
      <video ref={aRef} autoPlay muted playsInline preload="auto">
        <source src={SRC} type="video/mp4" />
      </video>
      <video ref={bRef} muted playsInline preload="auto">
        <source src={SRC} type="video/mp4" />
      </video>

      <div className="aurora-gradient__overlay" />
    </div>
  );
}
