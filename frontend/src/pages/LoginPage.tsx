import { useEffect, useState } from 'react';
import { Alert, Button, ConfigProvider, Form, Input, Typography } from 'antd';
import { colorV2 } from '@/shared/theme/designTokensV2';
import { useNavigate } from 'react-router-dom';
import { LOGIN_HINT_KEY } from '@/app/shell/loginHint';
import { useAuthStore } from '@/shared/store/authStore';
import { ApiError } from '@/shared/api/client';
import { space } from '@/shared/theme/designTokens';
import AuroraGradient from '@/shared/ui/AuroraGradient/AuroraGradient';
import './LoginPage.css';

const { Title, Text } = Typography;

const SLOGAN_LINES = [
  'AI Academy',
  'Operations Platform:',
  'From demand to case,',
  'one line of sight.',
] as const;

const SLOGAN_TOTAL = SLOGAN_LINES.reduce((n, line) => n + line.length, 0);

function lineStarts(): number[] {
  const starts: number[] = [];
  let acc = 0;
  for (const line of SLOGAN_LINES) {
    starts.push(acc);
    acc += line.length;
  }
  return starts;
}

const SLOGAN_STARTS = lineStarts();

function cursorLineOf(typed: number): number {
  for (let i = SLOGAN_LINES.length - 1; i >= 0; i -= 1) {
    if (typed >= (SLOGAN_STARTS[i] ?? 0)) return i;
  }
  return 0;
}

function skipSloganTyping(): boolean {
  if (typeof window === 'undefined') return true;
  if (new URLSearchParams(window.location.search).get('motion') === '1') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const SLOGAN_CHAR_MS = 38;
const SLOGAN_BREAK_MS = 280;
const SLOGAN_DELAY_MS = 360;
const SLOGAN_CYCLE_MS = 10_000;

function typedCountAt(budget: number): number {
  let n = 0;
  let remain = budget;
  for (let i = 0; i < SLOGAN_LINES.length; i += 1) {
    const line = SLOGAN_LINES[i];
    if (!line) break;
    const lineCost = line.length * SLOGAN_CHAR_MS;
    if (remain <= lineCost) {
      n += Math.floor(remain / SLOGAN_CHAR_MS);
      break;
    }
    n += line.length;
    remain -= lineCost;
    if (i < SLOGAN_LINES.length - 1) {
      if (remain < SLOGAN_BREAK_MS) break;
      remain -= SLOGAN_BREAK_MS;
    }
  }
  return Math.min(SLOGAN_TOTAL, n);
}

function TypingSlogan() {
  const [typed, setTyped] = useState(0);

  useEffect(() => {
    if (skipSloganTyping()) {
      setTyped(SLOGAN_TOTAL);
      return;
    }
    let cycleStart = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const elapsed = now - cycleStart;
      if (elapsed >= SLOGAN_CYCLE_MS) {
        cycleStart += Math.floor(elapsed / SLOGAN_CYCLE_MS) * SLOGAN_CYCLE_MS;
      }
      const into = now - cycleStart;
      const next = into < SLOGAN_DELAY_MS ? 0 : typedCountAt(into - SLOGAN_DELAY_MS);
      setTyped(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const cursorLine = cursorLineOf(typed);
  const done = typed >= SLOGAN_TOTAL;

  return (
    <h1 className="login-slogan" aria-label={SLOGAN_LINES.join(' ')}>
      {SLOGAN_LINES.map((line, i) => {
        const start = SLOGAN_STARTS[i] ?? 0;
        const text = line.slice(0, Math.max(0, Math.min(line.length, typed - start)));
        return (
          <span key={line} className="login-slogan__line" aria-hidden>
            {text}
            {i === cursorLine ? (
              <span className={'login-slogan__cursor' + (done ? ' is-blink' : '')} aria-hidden />
            ) : null}
          </span>
        );
      })}
    </h1>
  );
}

/**
 * 登录页。
 *
 * 全平台只有两个共享账号（需求文档 6.1、决策 C04），因此页面上没有注册、找回密码、
 * 记住我、第三方登录任何入口（需求 6.1.6 第 1 条）。
 */
export function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFinish = async (values: { username: string; password: string }) => {
    setSubmitting(true);
    setError(null);
    try {
      await login(values.username, values.password);
      sessionStorage.removeItem(LOGIN_HINT_KEY);
      navigate('/', { replace: true });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '登录失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <AuroraGradient />
      <div className="login-page__scrim" />
      <div className="login-stage">
      <TypingSlogan />
      <div className="login-panel">
      <div className="login-card">
        <ConfigProvider
          theme={{
            components: {
              Input: {
                colorBgContainer: 'transparent',
                hoverBg: 'transparent',
                activeBg: 'transparent',
                addonBg: 'transparent',
                activeShadow: 'none',
                colorBorder: 'rgba(255,255,255,0.4)',
                hoverBorderColor: 'rgba(255,255,255,0.62)',
                activeBorderColor: colorV2.brandAction,
                borderRadius: 999,
              },
              Button: {
                borderRadius: 999,
                colorPrimary: colorV2.brandAction,
                colorPrimaryHover: colorV2.brandActionHover,
                colorPrimaryActive: colorV2.brandActionActive,
              },
            },
          }}
        >
        <Title
          level={2}
          className="login-card__title"
          style={{ fontSize: 32, lineHeight: '48px', marginBottom: space.xs }}
        >
          AI学院联合作战平台
        </Title>
        <Text className="login-card__subtitle">运营记录与可视化平台</Text>

        {error && (
          <Alert type="error" showIcon message={error} style={{ marginTop: space.lg }} />
        )}

        <Form
          layout="vertical"
          onFinish={onFinish}
          requiredMark={false}
          style={{ marginTop: space.lg }}
          size="large"
        >
          <Form.Item
            label="账号"
            name="username"
            rules={[{ required: true, message: '请输入账号' }]}
          >
            <Input variant="borderless" autoComplete="username" placeholder="运营账号或用户账号" />
          </Form.Item>
          <Form.Item
            label="密码"
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password variant="borderless" autoComplete="current-password" placeholder="请输入密码" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={submitting}>
            {submitting ? '登录中…' : '登录'}
          </Button>
        </Form>

        <Text className="login-card__footnote" style={{ display: 'block', marginTop: space.lg, fontSize: 12 }}>
          账号由管理员分发。用户账号为只读账号，仅可点赞与评论。
        </Text>
        </ConfigProvider>
      </div>
      </div>
      </div>
    </div>
  );
}
