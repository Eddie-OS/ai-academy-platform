/**
 * 案例正文与总结报告正文的渲染与摘要（需求 12.3 第 11 项、12.6）。
 *
 * <p><b>为什么不是 wangEditor。</b>技术栈规定富文本一律用 wangEditor 5，但当前离线环境装不上
 * 依赖（原因同 ECharts，见待修清单 P-4）。这一段的编辑器暂时是「HTML 源码文本框 + 实时预览」，
 * 存的仍然是 HTML，网络可用后把编辑控件换成 wangEditor 即可，库里的数据不用迁。
 * 已记入 {@code docs/文档待修清单.md}。
 *
 * <p><b>为什么要自己过一遍白名单。</b>正文要以 HTML 渲染才有意义，而 DOMPurify 同样装不上。
 * 内容虽然只有运营能写，但它会展示给全体使用者——一段被粘进来的 {@code <script>} 会在每个
 * 打开这条案例的人的浏览器里执行。白名单比黑名单短且不会漏。
 */

/** 允许出现的标签。够表达标题、段落、列表、表格、强调、链接与图片，其余一律丢弃。 */
const ALLOWED_TAGS = new Set([
  'P', 'BR', 'HR', 'DIV', 'SPAN',
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'CODE',
  'STRONG', 'B', 'EM', 'I', 'U', 'S',
  'A', 'IMG',
  'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD',
]);

/** 允许保留的属性。<b>没有任何 {@code on*} 事件属性</b>，也没有 style */
const ALLOWED_ATTRS: Record<string, Set<string>> = {
  A: new Set(['href', 'title', 'target', 'rel']),
  IMG: new Set(['src', 'alt', 'width', 'height']),
  TD: new Set(['colspan', 'rowspan']),
  TH: new Set(['colspan', 'rowspan']),
};

/** {@code javascript:} 与 {@code data:} 开头的 URL 一律丢掉——它们是白名单标签上的后门。 */
function safeUrl(value: string): boolean {
  const normalized = value.trim().toLowerCase().replace(/[\u0000-\u0020]/g, '');
  return !normalized.startsWith('javascript:') && !normalized.startsWith('data:');
}

/**
 * 按白名单清洗 HTML。
 *
 * <p>不在白名单里的<b>标签</b>被拆掉但保留它的子节点：一段被 {@code <font>} 包着的文字，
 * 连着标签一起删会让正文凭空少一句，而使用者不会知道少了什么。
 * 不在白名单里的<b>属性</b>直接删。{@code <script>} 与 {@code <style>} 连同内容整个删——
 * 它们的子节点是代码不是正文。
 */
export function sanitizeHtml(html: string | null | undefined): string {
  if (!html) {
    return '';
  }
  const doc = new DOMParser().parseFromString(html, 'text/html');

  doc.body.querySelectorAll('script, style, iframe, object, embed').forEach((node) => node.remove());

  const walk = (node: Element) => {
    // 先递归再处理自己：拆标签会把子节点提到父级，边遍历边改集合会漏掉节点
    Array.from(node.children).forEach(walk);

    if (!ALLOWED_TAGS.has(node.tagName)) {
      node.replaceWith(...Array.from(node.childNodes));
      return;
    }
    const allowed = ALLOWED_ATTRS[node.tagName] ?? new Set<string>();
    for (const attr of Array.from(node.attributes)) {
      const keep =
        allowed.has(attr.name.toLowerCase()) &&
        (!['href', 'src'].includes(attr.name.toLowerCase()) || safeUrl(attr.value));
      if (!keep) {
        node.removeAttribute(attr.name);
      }
    }
    if (node.tagName === 'A') {
      // 站外链接一律新窗口打开，并断开 opener：案例正文里的链接不该能改写平台自己这个页面
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
    }
  };
  Array.from(doc.body.children).forEach(walk);

  return doc.body.innerHTML;
}

/**
 * 卡片摘要：去掉标签取纯文本，超长截断。
 *
 * <p>截断按字符数而不是按 HTML 长度——一段被 {@code <p>} 与 {@code <strong>} 塞满的正文，
 * 按 HTML 截到 80 字可能一个字都没有。
 */
export function excerpt(html: string | null | undefined, max = 80): string {
  if (!html) {
    return '';
  }
  const text = new DOMParser()
    .parseFromString(html, 'text/html')
    .body.textContent?.replace(/\s+/g, ' ')
    .trim();
  if (!text) {
    return '';
  }
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
