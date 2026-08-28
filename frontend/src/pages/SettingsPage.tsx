import { Space, Tabs, Typography } from 'antd';
import { space } from '@/shared/theme/designTokens';
import { ThresholdTab } from '@/features/settings/ThresholdTab';
import { DictTab } from '@/features/settings/DictTab';
import { SelfcheckTab } from '@/features/settings/SelfcheckTab';
import { DeriveRuleTab } from '@/features/settings/DeriveRuleTab';
import { EscalationConfigTab } from '@/features/settings/EscalationConfigTab';

const { Title, Text } = Typography;

/**
 * 配置中心 S-2（需求 13.9）：单页面多 Tab。
 * 阶段 4 已补催办配置；负责人配置仍见待修清单 D-5。
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
          { key: 'escalation', label: '催办配置', children: <EscalationConfigTab /> },
        ]}
      />
    </Space>
  );
}
