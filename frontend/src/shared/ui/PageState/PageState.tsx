import type { ReactNode } from 'react';
import { Alert, Button, Spin } from 'antd';
import { FileQuestion, Inbox, RotateCcw, Search, ServerCrash, ShieldAlert, WifiOff } from 'lucide-react';
import { fontSize, lineHeight, neutral, space } from '@/shared/theme/designTokens';

/**
 * 七个全局状态页（设计规范 7.3 空态、7.4 加载、7.5 权限与异常态）。
 *
 * <p>做成一个组件七个变体而不是七个页面文件，是因为它们的容器尺寸完全相同
 * （上下内边距 48px、插画 160–200px、标题 18px、说明 14px、最大宽度 400px 居中、
 * 元素间距 16px）。分开写七份，这套尺寸就会漂移。
 *
 * <p><b>插画位现在放的是图标。</b>《图片资产清单》里的空态插画尚未交付，用 96px 图标占位，
 * 但容器按插画的 160–200px 预留，插画到位后替换 {@code visual} 不会引起版式跳动。
 */

export type PageStateVariant =
  | 'loading'
  | 'empty'
  | 'noResult'
  | 'forbidden'
  | 'error'
  | 'offline'
  | 'notFound';

interface VariantSpec {
  visual: ReactNode;
  title: string;
  description: string;
}

const ICON_SIZE = 96;

/**
 * 文案遵守 7.6：不用感叹号、不用第一人称、说清下一步。
 *
 * 「仅运营账号可访问」这条按 V1.1 改写过：一期没有权限申请流程，
 * 写「如何获取权限」会指向一个不存在的动作。
 */
const VARIANTS: Record<Exclude<PageStateVariant, 'empty' | 'loading'>, VariantSpec> = {
  noResult: {
    visual: <Search size={ICON_SIZE} color={neutral[300]} aria-hidden />,
    title: '未找到符合条件的记录',
    description: '可以放宽时间区间、清空状态或负责人条件后重试。',
  },
  forbidden: {
    visual: <ShieldAlert size={ICON_SIZE} color={neutral[300]} aria-hidden />,
    title: '该页面仅运营账号可访问',
    description: '当前登录的是只读账号。如需操作，请使用运营账号登录。',
  },
  error: {
    visual: <ServerCrash size={ICON_SIZE} color={neutral[300]} aria-hidden />,
    title: '加载失败',
    description: '数据没有取到，可以重新加载一次。若持续失败，请联系管理员。',
  },
  offline: {
    visual: <WifiOff size={ICON_SIZE} color={neutral[300]} aria-hidden />,
    title: '网络已断开',
    description: '内网连接中断，恢复后可重新加载。期间的未保存内容仍保留在页面上。',
  },
  notFound: {
    visual: <FileQuestion size={ICON_SIZE} color={neutral[300]} aria-hidden />,
    title: '页面不存在',
    description: '链接可能已失效，或该页面属于二期范围。',
  },
};

interface PageStateProps {
  variant: PageStateVariant;
  /** 仅 empty 变体需要：对象名，渲染成「还没有{对象}」 */
  objectName?: string;
  /** 覆盖默认说明。空态的说明要讲清该模块的用途与第一步，各页面不同 */
  description?: string;
  /** 主动作。空态给「新建／导入」，无结果给「重置筛选」，错误给「重新加载」 */
  action?: ReactNode;
}

export function PageState({ variant, objectName, description, action }: PageStateProps) {
  if (variant === 'loading') {
    // 7.4：整页加载只用于首次进入应用。局部数据加载用骨架屏，见 DataTable
    return (
      <div style={{ ...containerStyle, minHeight: 240 }} data-testid="page-state" data-variant={variant}>
        <Spin size="large" />
        <span style={descriptionStyle}>正在加载</span>
      </div>
    );
  }

  const spec: VariantSpec =
    variant === 'empty'
      ? {
          visual: <Inbox size={ICON_SIZE} color={neutral[300]} aria-hidden />,
          title: `还没有${objectName ?? '数据'}`,
          description: '',
        }
      : VARIANTS[variant];

  return (
    <div style={containerStyle} data-testid="page-state" data-variant={variant}>
      {spec.visual}
      <h3 style={titleStyle}>{spec.title}</h3>
      {(description ?? spec.description) && (
        <span style={descriptionStyle}>{description ?? spec.description}</span>
      )}
      {action}
    </div>
  );
}

/**
 * 网络错误用 Banner 而不是弹窗（7.5）：网络问题可能连续发生，弹窗会一个接一个地挡住页面。
 */
export function OfflineBanner({ onRetry }: { onRetry?: () => void }) {
  return (
    <Alert
      type="warning"
      showIcon
      icon={<WifiOff size={16} />}
      message="网络已断开，页面显示的可能不是最新数据"
      action={
        onRetry && (
          <Button size="small" icon={<RotateCcw size={14} />} onClick={onRetry}>
            重试
          </Button>
        )
      }
      style={{ marginBottom: space.md }}
    />
  );
}

const containerStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center',
  justifyContent: 'center',
  gap: space.md,
  paddingTop: space['2xl'],
  paddingBottom: space['2xl'],
  textAlign: 'center' as const,
};

const titleStyle = {
  margin: 0,
  fontSize: fontSize.h3,
  lineHeight: lineHeight.h3,
  color: neutral[900],
  fontWeight: 600,
};

const descriptionStyle = {
  maxWidth: 400,
  fontSize: fontSize.body,
  lineHeight: lineHeight.body,
  color: neutral[600],
};
