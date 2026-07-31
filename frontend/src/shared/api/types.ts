/**
 * 接口契约类型，对应《开发实施文档》7.2、7.3。
 *
 * 纪律 STK-1：<b>前端不得手写状态值与枚举字符串字面量。</b>
 * 阶段 1 起，状态枚举与字段枚举由 OpenAPI 生成或 /api/meta/enums 下发到 src/shared/types。
 * 本文件只放与业务无关的通用契约。
 */

/** 统一响应包装（7.2） */
export interface R<T> {
  code: ErrorCode;
  message: string | null;
  data: T;
  traceId: string | null;
}

/** 一期错误码全集（7.3），只有这 12 个 */
export type ErrorCode =
  | 'OK'
  | 'PARAM_INVALID'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'ILLEGAL_TRANSITION'
  | 'CONCURRENT_MODIFIED'
  | 'DUPLICATE_SUBMIT'
  | 'URGE_TOO_FREQUENT'
  | 'IMPORT_VALIDATION_FAILED'
  | 'BIZ_RULE_VIOLATED'
  | 'INTERNAL_ERROR';

/** 分页入参（API-6）：pageNum 从 1 开始，pageSize 默认 20、上限 200 */
export interface PageQuery {
  pageNum: number;
  pageSize: number;
}

export interface PageResult<T> {
  records: T[];
  total: number;
  pageNum: number;
  pageSize: number;
}

/** 账号类型。全平台只有两个共享账号（需求文档 6.1、决策 C04） */
export type AccountTypeCode = 'OPERATOR' | 'VIEWER';

export interface AccountInfo {
  username: string;
  displayName: string;
  accountType: AccountTypeCode;
  typeLabel: string;
  /**
   * 是否运营账号。<b>这是前端判断「写操作入口是否渲染」的唯一依据</b>（纪律 PMI-5）：
   * 不得依赖接口返回的其他字段是否为空来推断权限。
   */
  operator: boolean;
}

/**
 * 后端在详情响应里返回的「当前状态下允许的动作」（4.3.2）。
 *
 * ActionGuard 是<b>状态门而不是权限门</b>：reason 说的是状态原因
 * （「当前状态为「已发布」，不允许再提交评审」），不是「你没有权限」。
 */
export interface ActionAvailability {
  allowedActions: string[];
  blockedActions: Array<{ action: string; reason: string }>;
}
