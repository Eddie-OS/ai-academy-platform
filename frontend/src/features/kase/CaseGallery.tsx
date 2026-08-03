import { Button, Card, Empty, Pagination, Skeleton, Space, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { Eye, MessageSquare, ThumbsUp } from 'lucide-react';
import { attachmentApi } from '@/shared/api/attachments';
import type { CaseInfo } from '@/shared/api/cases';
import { StatusTag } from '@/shared/ui/StatusTag';
import { PageState } from '@/shared/ui/PageState';
import { brand, fontSize, neutral, radius, space } from '@/shared/theme/designTokens';
import { useDomainNames } from './caseMeta';
import { excerpt } from './richText';

const { Text, Paragraph } = Typography;

/**
 * 案例卡片流（需求 12.7 卡片流区，P5-1）。
 *
 * <p>卡片流与列表是同一批数据的两种看法，不是两个页面：卡片流用来「翻着看有什么」，
 * 列表用来「按状态逐条处理」。两者共用同一套筛选与分页，切换视图不重置条件。
 *
 * <p><b>三个计数在卡片上直接显示。</b>它们是这个驾驶舱唯一的「效果」信号——案例整理完
 * 有没有人看，只有这三个数字能说明。数值一律 tabular-nums（设计规范 3.3）。
 */

/** 封面附件的 refField，与后端 {@code CaseService.REF_COVER} 一致。 */
const CASE_OWNER_TYPE = 'CASE';
const REF_COVER = 'case_cover';

interface CaseGalleryProps {
  rows: CaseInfo[] | undefined;
  loading: boolean;
  error: boolean;
  total: number;
  pageNum: number;
  pageSize: number;
  onPageChange: (pageNum: number, pageSize: number) => void;
  onReload: () => void;
  onSelect: (id: number) => void;
  activeId: number | null;
}

export function CaseGallery({
  rows,
  loading,
  error,
  total,
  pageNum,
  pageSize,
  onPageChange,
  onReload,
  onSelect,
  activeId,
}: CaseGalleryProps) {
  const domainName = useDomainNames();

  if (error) {
    return (
      <PageState
        variant="error"
        description="案例没有取到。"
        action={<Button onClick={onReload}>重新加载</Button>}
      />
    );
  }

  if (loading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: space.md }}>
        {[0, 1, 2, 3, 4, 5].map((key) => (
          <Card key={key} size="small" style={{ borderRadius: radius.lg }}>
            <Skeleton active paragraph={{ rows: 3 }} />
          </Card>
        ))}
      </div>
    );
  }

  if (!rows || rows.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="没有符合条件的案例。案例的唯一来源是课程被标注达到精品标准，不能在这里新建。"
      />
    );
  }

  return (
    <Space direction="vertical" size={space.md} style={{ width: '100%' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: space.md }}>
        {rows.map((row) => (
          <Card
            key={row.id}
            size="small"
            hoverable
            data-testid="case-card"
            onClick={() => onSelect(row.id)}
            style={{
              borderRadius: radius.lg,
              // 选中态用边框而不是底色：卡片里已经有封面图与多个彩色标签，再换底色会读不出层级
              borderColor: activeId === row.id ? brand[600] : neutral[200],
              borderWidth: activeId === row.id ? 2 : 1,
            }}
            styles={{ body: { padding: space.sm } }}
            cover={<Cover caseId={row.id} caseName={row.caseName} />}
          >
            <Space direction="vertical" size={space['2xs']} style={{ width: '100%' }}>
              <Space size={space['2xs']} wrap>
                <StatusTag group="caseStatus" value={row.caseState} />
                {row.qualityMarks.map((mark) => (
                  <Tag key={mark} color="gold">
                    {mark}
                  </Tag>
                ))}
              </Space>
              <Text strong ellipsis={{ tooltip: row.caseName }} style={{ fontSize: fontSize.h4 }}>
                {row.caseName}
              </Text>
              <Text style={{ fontSize: fontSize.caption, color: neutral[600] }} ellipsis>
                {row.contributingOrg}
                {row.domainCodes.length > 0 && ` · ${row.domainCodes.map(domainName).join('、')}`}
              </Text>
              <Paragraph
                type="secondary"
                style={{ fontSize: fontSize.caption, marginBottom: 0, minHeight: 36 }}
                ellipsis={{ rows: 2 }}
              >
                {excerpt(row.content) || '正文还没写'}
              </Paragraph>
              <Space size={space.sm} style={{ color: neutral[500], fontSize: fontSize.caption }}>
                <Counter icon={<Eye size={13} />} value={row.viewCount} />
                <Counter icon={<ThumbsUp size={13} />} value={row.likeCount} />
                <Counter icon={<MessageSquare size={13} />} value={row.commentCount} />
              </Space>
            </Space>
          </Card>
        ))}
      </div>

      <Pagination
        align="end"
        current={pageNum}
        pageSize={pageSize}
        total={total}
        showSizeChanger
        pageSizeOptions={[12, 24, 48]}
        showTotal={(count) => `共 ${count.toLocaleString()} 条`}
        onChange={onPageChange}
      />
    </Space>
  );
}

function Counter({ icon, value }: { icon: React.ReactNode; value: number | null }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: space['3xs'] }}>
      {icon}
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{(value ?? 0).toLocaleString()}</span>
    </span>
  );
}

/**
 * 封面。
 *
 * <p>逐卡片查一次附件而不是让列表接口带上封面：封面是附件模块的数据，让案例列表 SQL 去联
 * 附件表会把「附件归属」这件事复制到第二处。一页十几张卡，查询结果由 react-query 缓存，
 * 翻回来时不再请求。
 *
 * <p>没有封面时画一块品牌色渐变加案例名首字，不留白：一排卡片里空一块会被当成加载失败。
 */
function Cover({ caseId, caseName }: { caseId: number; caseName: string }) {
  const cover = useQuery({
    queryKey: ['attachments', CASE_OWNER_TYPE, caseId, REF_COVER],
    queryFn: () => attachmentApi.listOf(CASE_OWNER_TYPE, caseId, REF_COVER),
  });

  const file = cover.data?.[0];
  const height = 132;

  if (file) {
    return (
      <img
        src={attachmentApi.downloadUrl(file.id)}
        alt={caseName}
        style={{
          height,
          width: '100%',
          objectFit: 'cover',
          borderTopLeftRadius: radius.lg,
          borderTopRightRadius: radius.lg,
        }}
      />
    );
  }

  return (
    <div
      style={{
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `linear-gradient(135deg, ${brand[100]}, ${brand[300]})`,
        borderTopLeftRadius: radius.lg,
        borderTopRightRadius: radius.lg,
        color: brand[800],
        fontSize: fontSize.h1,
        fontWeight: 600,
      }}
    >
      {caseName.slice(0, 1)}
    </div>
  );
}
