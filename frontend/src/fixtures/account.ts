import type { AccountInfo } from '@/shared/api/types';

/**
 * 视觉回归模式的冻结登录态。
 *
 * <p>应用未登录会整体跳登录页，若不在回归模式下提供一个账号，九张基线截图会全部拍成登录页。
 *
 * <p>取<b>运营账号</b>：文档 15 的交互矩阵要求「所有可见控件可操作」、批量操作与「新建」都要在，
 * 用户账号下这些入口按 PMI-5 整体不渲染，截图会缺掉一批控件。
 *
 * <p>姓名取《平台驾驶舱全景》截图侧栏底部用户卡上的「张小北 · 平台管理员」。
 * 这不是编的：文档 0.3 禁止改写中文文案，用户卡的两行字参与视觉回归。
 */
export const FIXTURE_ACCOUNT: AccountInfo = {
  username: 'operator',
  displayName: '张小北',
  accountType: 'OPERATOR',
  typeLabel: '平台管理员',
  operator: true,
};
