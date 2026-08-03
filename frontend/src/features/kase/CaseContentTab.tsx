import { useEffect, useState } from 'react';
import { Alert, App, Button, Card, Input, Segmented, Space, Typography } from 'antd';
import { useMutation } from '@tanstack/react-query';
import { Pencil, Save, X } from 'lucide-react';
import { ApiError } from '@/shared/api/client';
import { caseApi, type CaseInfo } from '@/shared/api/cases';
import { AttachmentField } from '@/shared/ui/AttachmentField';
import { useIsOperator } from '@/shared/store/authStore';
import { fontSize, neutral, space } from '@/shared/theme/designTokens';
import { sanitizeHtml } from './richText';

const { Text } = Typography;

/**
 * 案例正文与附件（需求 12.3 第 11、12、13 项）。
 *
 * <p><b>正文不在编辑弹窗里。</b>它是长文，塞进弹窗后编辑区只剩几行，写不动也读不了。
 *
 * <p><b>正文为空不阻断保存，也不阻断上架</b>（规则 C2）。需求 12.3 第 11 项写的「上架时 M」是
 * 一条状态前置条件，而 C9 把本期允许的业务前置校验限定为三处，案例上架不在其中——补录历史案例
 * 时正文可能压根在别处，平台上只登记它存在过。界面给提示，不给拦截。
 */

/** 附件归属类型与两个 refField，与后端 {@code CaseService.REF_*} 一致。 */
const CASE_OWNER_TYPE = 'CASE';
const REF_ATTACHMENTS = 'case_files';
const REF_COVER = 'case_cover';

interface CaseContentTabProps {
  caseInfo: CaseInfo;
  onSaved: () => void;
}

export function CaseContentTab({ caseInfo, onSaved }: CaseContentTabProps) {
  const { message } = App.useApp();
  const isOperator = useIsOperator();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(caseInfo.content ?? '');
  const [mode, setMode] = useState<'编辑' | '预览'>('编辑');

  useEffect(() => {
    setDraft(caseInfo.content ?? '');
    setEditing(false);
  }, [caseInfo.id, caseInfo.content]);

  const save = useMutation({
    mutationFn: () =>
      caseApi.update(
        caseInfo.id,
        {
          caseName: caseInfo.caseName,
          contributingOrg: caseInfo.contributingOrg,
          contributors: caseInfo.contributors,
          domainCodes: caseInfo.domainCodes,
          ownerNo: caseInfo.ownerNo,
          qualityMarks: caseInfo.qualityMarks,
          content: draft,
          expectPublishDate: caseInfo.expectPublishDate,
        },
        caseInfo.version,
      ),
    onSuccess: () => {
      message.success('正文已保存');
      setEditing(false);
      onSaved();
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '保存失败，请重试'),
  });

  return (
    <Space direction="vertical" size={space.md} style={{ width: '100%' }}>
      <Card
        size="small"
        title="案例正文"
        extra={
          isOperator &&
          (editing ? (
            <Space size={space['2xs']}>
              <Button size="small" icon={<X size={14} />} onClick={() => {
                setDraft(caseInfo.content ?? '');
                setEditing(false);
              }}>
                取消
              </Button>
              <Button
                size="small"
                type="primary"
                icon={<Save size={14} />}
                loading={save.isPending}
                onClick={() => void save.mutateAsync()}
              >
                保存
              </Button>
            </Space>
          ) : (
            <Button size="small" icon={<Pencil size={14} />} onClick={() => setEditing(true)}>
              编辑正文
            </Button>
          ))
        }
      >
        {editing ? (
          <Space direction="vertical" size={space.sm} style={{ width: '100%' }}>
            <Alert
              type="info"
              showIcon
              message="当前是 HTML 源码编辑"
              description="所见即所得的编辑器（wangEditor）在当前离线环境装不上，暂时直接编辑 HTML，存的格式与将来一致，切换后不用迁数据。常用标签：段落 <p>、小标题 <h3>、列表 <ul><li>、加粗 <strong>。"
            />
            <Segmented
              size="small"
              value={mode}
              options={['编辑', '预览']}
              onChange={(value) => setMode(value as '编辑' | '预览')}
            />
            {mode === '编辑' ? (
              <Input.TextArea
                rows={16}
                value={draft}
                maxLength={20000}
                showCount
                onChange={(e) => setDraft(e.target.value)}
              />
            ) : (
              <RenderedContent html={draft} />
            )}
          </Space>
        ) : caseInfo.content ? (
          <RenderedContent html={caseInfo.content} />
        ) : (
          <Text style={{ color: neutral[600], fontSize: fontSize.bodySm }}>
            正文还没写。上架前应当补上，但平台不会因为它为空而拦住状态变更——补录的历史案例
            正文可能在别处，这里只登记它存在过。
          </Text>
        )}
      </Card>

      <Card size="small" title="封面图">
        <AttachmentField
          ownerType={CASE_OWNER_TYPE}
          ownerId={caseInfo.id}
          refField={REF_COVER}
          emptyHint="看板卡片上显示的图。没有封面时卡片按纯文字排版，不影响任何功能"
        />
      </Card>

      <Card size="small" title="案例附件">
        <AttachmentField
          ownerType={CASE_OWNER_TYPE}
          ownerId={caseInfo.id}
          refField={REF_ATTACHMENTS}
          emptyHint="佐证材料、原始截图、演示视频等。下载需要登录，不会生成公开链接"
        />
      </Card>
    </Space>
  );
}

/**
 * 渲染富文本。
 *
 * <p>先过一遍白名单再交给 {@code dangerouslySetInnerHTML}：正文只有运营能写，但它展示给
 * 全体使用者，一段被粘进来的脚本会在每个打开这条案例的人的浏览器里执行。
 */
function RenderedContent({ html }: { html: string }) {
  return (
    <div
      data-testid="case-content"
      style={{ fontSize: fontSize.body, color: neutral[700], wordBreak: 'break-word' }}
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
    />
  );
}
