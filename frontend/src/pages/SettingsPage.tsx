import { Space, Tabs, Typography } from 'antd';
import { space } from '@/shared/theme/designTokens';
import { ThresholdTab } from '@/features/settings/ThresholdTab';
import { DictTab } from '@/features/settings/DictTab';
import { SelfcheckTab } from '@/features/settings/SelfcheckTab';
import { DeriveRuleTab } from '@/features/settings/DeriveRuleTab';

const { Title, Text } = Typography;

/**
 * 配置中心 S-2（需求 13.9）：单页面 + 四个 Tab，不拆成多个一级页面。
 *
 * <p><b>这四个 Tab 与需求 13.9 列的四个不完全相同</b>，差异是阶段划分而不是范围变更：
 * 需求列的是阈值、字典、负责人、催办；本期按《开发实施文档》8.5 阶段 1 交付表实现的是
 * 阈值、字典、自检题库、任务派生规则。负责人配置要等阶段 2 有业务对象才有内容可列，
 * 催办配置属于阶段 4；而自检题库与派生规则的配置表现在就必须能配——否则阶段 2、3 的代码
 * 只能硬编码一份默认值。该差异已记入待修文档清单。
 *
 * <p>页面级的运营限制在路由层（{@code OperatorOnly}），全部配置项的修改都写操作审计日志。
 */
export function SettingsPage() {
  return (
    <Space direction="vertical" size={space.lg} style={{ width: '100%' }}>
      <div>
        <Title level={2} style={{ margin: 0 }}>
          配置中心
        </Title>
        <Text type="secondary">
          这里的每一次修改都会记入操作审计日志（含修改前值与修改后值）。阈值改动后灯色实时重算。
        </Text>
      </div>

      <Tabs
        items={[
          { key: 'thresholds', label: '三色灯阈值', children: <ThresholdTab /> },
          { key: 'dicts', label: '字典配置', children: <DictTab /> },
          { key: 'selfcheck', label: '自检 CheckList 题库', children: <SelfcheckTab /> },
          { key: 'derive-rules', label: '任务派生规则', children: <DeriveRuleTab /> },
        ]}
      />
    </Space>
  );
}
