import { useState } from 'react';
import { Alert, Button, Card, Form, Input, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/shared/store/authStore';
import { ApiError } from '@/shared/api/client';
import { layout, neutral, space } from '@/shared/theme/designTokens';

const { Title, Text } = Typography;

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
      navigate('/', { replace: true });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '登录失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        minWidth: layout.minWidth,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: neutral[100],
      }}
    >
      <Card style={{ width: 420, padding: space.xs }}>
        <Title level={1} style={{ fontSize: 32, lineHeight: '48px', marginBottom: space.xs }}>
          AI学院联合作战平台
        </Title>
        <Text type="secondary">运营记录与可视化平台</Text>

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
            <Input autoComplete="username" placeholder="运营账号或用户账号" />
          </Form.Item>
          <Form.Item
            label="密码"
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password autoComplete="current-password" placeholder="请输入密码" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={submitting}>
            {submitting ? '登录中…' : '登录'}
          </Button>
        </Form>

        <Text type="secondary" style={{ display: 'block', marginTop: space.lg, fontSize: 12 }}>
          账号由管理员分发。用户账号为只读账号，仅可点赞与评论。
        </Text>
      </Card>
    </div>
  );
}
