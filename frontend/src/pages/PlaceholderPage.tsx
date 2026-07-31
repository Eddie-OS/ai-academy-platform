import { Card, Empty, Typography } from 'antd';
import type { PageDef } from '@/app/navigation';

const { Title, Text } = Typography;

/**
 * 阶段 0 的页面占位。
 *
 * 24 个一级页面在骨架阶段全部指向本组件，只显示页面编号与标题，用来验证导航与路由完整。
 * 阶段 1 起逐个替换为真实页面：先导入中心与配置中心（阶段 1），再五驾驶舱（阶段 2）。
 */
export function PlaceholderPage({ page }: { page: PageDef }) {
  return (
    <div>
      <div style={{ minHeight: 64, display: 'flex', alignItems: 'center' }}>
        <Title level={2} style={{ margin: 0 }}>
          {page.title}
        </Title>
      </div>
      <Card style={{ marginTop: 8 }}>
        <Empty
          description={
            <span>
              <Text strong>{page.code}</Text>
              <Text type="secondary">　页面尚未实现（阶段 0 仅搭建骨架）</Text>
            </span>
          }
        />
      </Card>
    </div>
  );
}
