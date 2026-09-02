import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { resetRegressionModeCache } from '@/app/regressionMode';
import { useDialogMotion } from './useDialogMotion';

const originalMatchMedia = window.matchMedia;

function Harness({ onClose }: { onClose: () => void }) {
  const { closing, requestClose } = useDialogMotion(onClose);
  return (
    <button type="button" data-closing={closing} onClick={requestClose}>
      关闭
    </button>
  );
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  window.matchMedia = originalMatchMedia;
  window.history.replaceState({}, '', '/');
  resetRegressionModeCache();
});

describe('useDialogMotion', () => {
  it('普通模式先标记退出态，140ms 后关闭', () => {
    vi.useFakeTimers();
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as typeof window.matchMedia;
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: '关闭' }));
    expect(screen.getByRole('button')).toHaveAttribute('data-closing', 'true');
    expect(onClose).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(140));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('reduced-motion 下立即关闭', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as typeof window.matchMedia;
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: '关闭' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
