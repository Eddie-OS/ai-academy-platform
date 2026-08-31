/**
 * 顶栏「新建」与当前页的登记入口之间的挂钩。
 *
 * <p>壳层不能 import 各驾驶舱的表单：那样壳层会跟着五个业务模块一起编，
 * 而「这一页新建什么」只有页面自己知道。页面挂载时登记，卸载时摘掉。
 * 没人登记时按钮仍在（几何钉死），点下去什么都不发生。
 */

type ShellCreateHandler = () => void;

let handler: ShellCreateHandler | null = null;

export function registerShellCreate(next: ShellCreateHandler): () => void {
  handler = next;
  return () => {
    if (handler === next) handler = null;
  };
}

export function requestShellCreate(): void {
  handler?.();
}
