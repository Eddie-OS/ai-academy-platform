import { Button, Dropdown, Layout, Menu, Tag, Typography } from 'antd';
import {
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  Gauge,
  Lightbulb,
  ListChecks,
  LogOut,
  Megaphone,
  Settings,
  Trophy,
  Upload,
  UserRound,
  Users,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  CENTER_PAGES,
  COCKPIT_GROUPS,
  DASHBOARD_PAGE,
  OPERATION_PAGES,
} from './navigation';
import { useAuthStore } from '@/shared/store/authStore';
import { layout, neutral, space } from '@/shared/theme/designTokens';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const GROUP_ICONS: Record<string, ReactNode> = {
  demand: <Lightbulb size={16} />,
  course: <BookOpen size={16} />,
  lecturer: <Users size={16} />,
  training: <CalendarDays size={16} />,
  kase: <Trophy size={16} />,
};

const CENTER_ICONS: Record<string, ReactNode> = {
  '/tasks': <ListChecks size={16} />,
  '/escalations': <Megaphone size={16} />,
  '/reviews': <ClipboardCheck size={16} />,
};

/**
 * 全局壳层：顶栏 56px + 侧栏 240px + 内容区（设计规范 4.2）。
 *
 * 三中心入口在顶栏（需求文档首页布局 F 行），五驾驶舱与两个中心页在侧栏。
 *
 * 纪律 PMI-5：导入中心与配置中心仅运营账号可见，判断依据是登录时拿到的
 * {@code operator} 布尔值，<b>不是接口返回内容</b>。
 */
export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const account = useAuthStore((state) => state.account);
  const logout = useAuthStore((state) => state.logout);

  const isOperator = account?.operator ?? false;

  const sidebarItems = [
    {
      key: DASHBOARD_PAGE.path,
      icon: <Gauge size={16} />,
      label: <Link to={DASHBOARD_PAGE.path}>{DASHBOARD_PAGE.title}</Link>,
    },
    ...COCKPIT_GROUPS.map((group) => ({
      key: group.key,
      icon: GROUP_ICONS[group.key],
      label: group.title,
      children: group.pages
        .filter((page) => page.inSidebar)
        .map((page) => ({
          key: page.path,
          label: <Link to={page.path}>{page.title}</Link>,
        })),
    })),
    ...OPERATION_PAGES.filter((page) => !page.operatorOnly || isOperator).map((page) => ({
      key: page.path,
      icon: page.path === '/imports' ? <Upload size={16} /> : <Settings size={16} />,
      label: <Link to={page.path}>{page.title}</Link>,
    })),
  ];

  const openKeys = COCKPIT_GROUPS.filter((group) =>
    group.pages.some((page) => location.pathname.startsWith(page.path.split('/:')[0] ?? '')),
  ).map((group) => group.key);

  const onLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <Layout style={{ minHeight: '100vh', minWidth: layout.minWidth }}>
      <Header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 200,
          height: layout.headerHeight,
          display: 'flex',
          alignItems: 'center',
          gap: space.lg,
          borderBottom: `1px solid ${neutral[200]}`,
          background: neutral[0],
        }}
      >
        <Link to="/" style={{ fontSize: 16, fontWeight: 600, color: neutral[900] }}>
          AI学院联合作战平台
        </Link>

        <div style={{ display: 'flex', gap: space.xs, marginLeft: space.lg }}>
          {CENTER_PAGES.map((page) => (
            <Button
              key={page.path}
              type="text"
              icon={CENTER_ICONS[page.path]}
              onClick={() => navigate(page.path)}
              style={{
                color: location.pathname === page.path ? undefined : neutral[700],
                fontWeight: location.pathname === page.path ? 600 : 400,
              }}
            >
              {page.title}
            </Button>
          ))}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: space.sm }}>
          {account && (
            <>
              {/* 账号类型必须显式呈现：共享账号下使用者需要随时确认自己在用哪个账号 */}
              <Tag color={isOperator ? 'blue' : 'default'}>{account.typeLabel}</Tag>
              <Dropdown
                menu={{
                  items: [{ key: 'logout', icon: <LogOut size={14} />, label: '退出登录' }],
                  onClick: onLogout,
                }}
              >
                <Button type="text" icon={<UserRound size={16} />}>
                  {account.displayName}
                </Button>
              </Dropdown>
            </>
          )}
        </div>
      </Header>

      <Layout>
        <Sider
          width={layout.sidebarExpanded}
          style={{
            background: neutral[0],
            borderRight: `1px solid ${neutral[200]}`,
          }}
        >
          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            defaultOpenKeys={openKeys}
            items={sidebarItems}
            style={{ borderInlineEnd: 'none' }}
          />
        </Sider>

        <Content style={{ padding: layout.contentPadding, background: neutral[100] }}>
          <Outlet />
          {!isOperator && (
            <Text
              type="secondary"
              style={{ display: 'block', marginTop: space.lg, fontSize: 12 }}
            >
              当前为只读账号，写操作入口已隐藏。
            </Text>
          )}
        </Content>
      </Layout>
    </Layout>
  );
}
