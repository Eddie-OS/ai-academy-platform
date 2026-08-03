import { Button, Tooltip } from 'antd';
import type { ButtonProps } from 'antd';
import { space } from '@/shared/theme/designTokens';
import type { ActionAvailability } from '@/shared/api/types';

/**
 * 动作门（开发实施文档 4.3.2；由 V1.0 的 PermissionGate 改名并改义）。
 *
 * <p><b>这是状态门，不是权限门。</b>它只按后端返回的 {@link ActionAvailability} 渲染：
 * 在 {@code allowedActions} 里的可点，在 {@code blockedActions} 里的置灰并把
 * {@code reason} 挂成 Tooltip。<b>它不读账号类型、不做任何本地权限推断</b>——
 * 共享两账号下「能不能操作」已经从权限问题重新归类为状态问题，账号类型的处理
 * 下沉到路由与布局层（用户账号下写操作入口整体不渲染）。
 *
 * <p>两个刻意的设计：
 * <ul>
 *   <li><b>两个列表都没提到的动作不渲染。</b>后端没说它可用，也没说它为什么不可用，
 *       此时渲染一个按钮就是前端在猜。猜对了没人知道，猜错了用户点了会拿到
 *       ILLEGAL_TRANSITION——一个本可以避免的失败操作。
 *   <li><b>置灰的按钮必须带原因。</b>这是体验总纲 C-1 可解释性的落点：
 *       「当前状态为「已发布」，不允许再提交评审」比「你不能这么做」有用得多。
 * </ul>
 */

export interface GuardedAction {
  /** 动作名，与后端状态机转换表的 actionLabel 一致（不在前端另起名字） */
  action: string;
  onClick: () => void;
  type?: ButtonProps['type'];
  danger?: boolean;
  loading?: boolean;
  icon?: ButtonProps['icon'];
}

export type ActionState = 'allowed' | 'blocked' | 'unknown';

export interface ResolvedAction {
  state: ActionState;
  reason: string | null;
}

/** 判定单个动作的可用性。导出是为了让页面在非按钮场景（如禁选行）复用同一套判定。 */
export function resolveAction(availability: ActionAvailability | undefined, action: string): ResolvedAction {
  if (!availability) {
    // 详情还没加载出来时不渲染动作，而不是先渲染成可点
    return { state: 'unknown', reason: null };
  }
  if (availability.allowedActions.includes(action)) {
    return { state: 'allowed', reason: null };
  }
  const blocked = availability.blockedActions.find((item) => item.action === action);
  if (blocked) {
    return { state: 'blocked', reason: blocked.reason };
  }
  return { state: 'unknown', reason: null };
}

interface ActionGuardProps {
  availability: ActionAvailability | undefined;
  actions: GuardedAction[];
  /**
   * 按钮间距，默认 {@code space.md}。
   *
   * <p>留这个口子是因为动作名的长度由状态机决定而不是由布局决定：需求详情的四个动作里有一个
   * 六字名（「录入评审结论」），四个按钮本身合计 380px，默认间距下总宽 428px，超出 410px 的
   * 面板正文，第四个就换行了。窄面板收紧到 {@code space.xs} 能排成一行——
   * 比给按钮起个短名字安全，后者会让界面上的动作名和状态机转换表对不上。
   */
  gap?: number;
  /**
   * 铺满容器宽度，几个动作等分。默认按内容定宽。
   *
   * <p>详情面板底部是一条固定的动作栏，动作名长短不一（「一键催办」四字、
   * 「录入评审结论」六字），按内容定宽时右边会剩一截空白，看起来像还有一个按钮没加载出来。
   * 只在宽度确定的容器里开——横向可滚动的容器里等分会把按钮压成一列竖字。
   */
  block?: boolean;
}

/*
 * flexWrap 必须开。动作名来自状态机转换表，长度不由前端决定 ——
 * 课程的「录入结论=不通过·修改后重新评审」有 15 个字，三个这样的按钮在 474px 的
 * 详情面板里放不进一行。不换行的话多出来的按钮会被面板的 overflow:hidden 裁掉，
 * 而被裁掉的按钮既看不见也点不到，表现和「这个动作不可用」一模一样。
 */
export function ActionGuard({ availability, actions, gap = space.md, block = false }: ActionGuardProps) {
  // 等分要落在承载 Tooltip 的那层 span 上，而不是 Button 上——置灰按钮的
  // Tooltip 靠外层 span 接 hover，Button 撑满了 span 才是等分的那一格
  const cellStyle = block ? { flex: '1 1 0', minWidth: 0 } : undefined;

  return (
    <div
      style={{
        display: block ? 'flex' : 'inline-flex',
        flexWrap: 'wrap',
        gap,
        alignItems: 'center',
        width: block ? '100%' : undefined,
      }}
    >
      {actions.map((item) => {
        const { state, reason } = resolveAction(availability, item.action);
        if (state === 'unknown') {
          return null;
        }

        const button = (
          <Button
            data-testid="guarded-action"
            data-action={item.action}
            data-state={state}
            type={item.type}
            danger={item.danger}
            loading={item.loading}
            icon={item.icon}
            disabled={state === 'blocked'}
            block={block}
            onClick={item.onClick}
          >
            {item.action}
          </Button>
        );

        // 置灰按钮不触发 hover 事件，必须由外层元素承载 Tooltip，否则原因看不到
        return state === 'blocked' ? (
          <Tooltip key={item.action} title={reason}>
            <span data-testid="guarded-action-reason" data-reason={reason ?? ''} style={cellStyle}>
              {button}
            </span>
          </Tooltip>
        ) : (
          <span key={item.action} style={cellStyle}>
            {button}
          </span>
        );
      })}
    </div>
  );
}
