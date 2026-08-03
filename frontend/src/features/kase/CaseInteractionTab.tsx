import { useState } from 'react';
import { App, Alert, Button, Card, Empty, Input, List, Popconfirm, Space, Statistic, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, MessageSquare, ThumbsUp, Timer, Trash2 } from 'lucide-react';
import { ApiError } from '@/shared/api/client';
import { caseApi, type CaseComment } from '@/shared/api/cases';
import { EM_DASH, formatDateTime } from '@/shared/format';
import { useIsOperator } from '@/shared/store/authStore';
import { fontSize, neutral, space } from '@/shared/theme/designTokens';

const { Text } = Typography;

/**
 * 互动页签：四项计数 + 点赞 + 评论（需求 12.4）。
 *
 * <p><b>这一整页的规则在 V1.2 按共享账号模型重写过，看起来全都不合理，但都是确认过的：</b>
 * <ul>
 *   <li>浏览次数<b>不去重</b>——系统不知道是谁，它的含义是「被打开了多少次」；
 *   <li>点赞<b>不去重、不可取消</b>，按钮点完也不变成「已点赞」；
 *   <li>评论<b>只有运营能删</b>——共享账号下分不出哪条是「自己的」。
 * </ul>
 *
 * <p>点赞与评论是用户账号唯一能做的两个写操作（需求 6.2.5），因此这两个入口<b>不受
 * {@code isOperator} 控制</b>。删除评论受控。
 */

interface CaseInteractionTabProps {
  caseId: number;
}

export function CaseInteractionTab({ caseId }: CaseInteractionTabProps) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const isOperator = useIsOperator();
  const [signature, setSignature] = useState('');
  const [content, setContent] = useState('');

  const statsKey = ['cases', caseId, 'interactions'];
  const commentsKey = ['cases', caseId, 'comments'];

  const stats = useQuery({ queryKey: statsKey, queryFn: () => caseApi.interactions(caseId) });
  const comments = useQuery({ queryKey: commentsKey, queryFn: () => caseApi.comments(caseId) });

  const refreshStats = () => void queryClient.invalidateQueries({ queryKey: statsKey });

  const like = useMutation({
    mutationFn: () => caseApi.like(caseId),
    // 被防刷拦下时后端返回 false 而不是报错（12.4：超出静默丢弃）。两种情况都按成功处理——
    // 告诉刷子「你被限流了」等于告诉他隔一分钟再来，而正常使用者根本碰不到这条线
    onSuccess: () => refreshStats(),
    onError: (e) => message.error(e instanceof ApiError ? e.message : '点赞失败，请重试'),
  });

  const comment = useMutation({
    mutationFn: () => caseApi.comment(caseId, { signature: signature || null, content }),
    onSuccess: () => {
      message.success('评论已发表');
      setContent('');
      void queryClient.invalidateQueries({ queryKey: commentsKey });
      refreshStats();
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '发表失败，请重试'),
  });

  const removeComment = useMutation({
    mutationFn: (commentId: number) => caseApi.removeComment(caseId, commentId),
    onSuccess: () => {
      message.success('评论已删除');
      void queryClient.invalidateQueries({ queryKey: commentsKey });
      refreshStats();
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '删除失败，请重试'),
  });

  const data = stats.data;

  return (
    <Space direction="vertical" size={space.md} style={{ width: '100%' }}>
      <Card size="small">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: space.sm }}>
          <Metric icon={<Eye size={14} />} title="浏览次数" value={data?.viewCount} />
          <Metric icon={<ThumbsUp size={14} />} title="点赞量" value={data?.likeCount} />
          <Metric icon={<MessageSquare size={14} />} title="评论数" value={data?.commentCount} />
          <Metric
            icon={<Timer size={14} />}
            title="平均阅读"
            // 没人打开过、或没人回报过时长时是「无数据」而不是 0 秒（设计规范 3.3）
            value={data?.avgReadSeconds == null ? null : Math.round(data.avgReadSeconds)}
            suffix="秒"
          />
        </div>
        <div style={{ marginTop: space.sm }}>
          <Text style={{ fontSize: fontSize.caption, color: neutral[500] }}>
            浏览与点赞都不去重：一期是两个共享账号，系统无法判断是谁。这两个数字表示「被打开／被点了多少次」，不是「多少人看过／多少人赞过」。
          </Text>
        </div>
      </Card>

      <Card
        size="small"
        title="评论"
        extra={
          <Button
            size="small"
            icon={<ThumbsUp size={14} />}
            loading={like.isPending}
            onClick={() => void like.mutateAsync()}
          >
            点赞
          </Button>
        }
      >
        <Space direction="vertical" size={space.sm} style={{ width: '100%' }}>
          <Input
            placeholder="署名（选填）"
            maxLength={50}
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
          />
          <Input.TextArea
            rows={3}
            maxLength={1000}
            showCount
            placeholder="写下你的评论"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <Button
            type="primary"
            size="small"
            disabled={content.trim() === ''}
            loading={comment.isPending}
            onClick={() => void comment.mutateAsync()}
          >
            发表评论
          </Button>

          {isOperator && (
            <Alert
              type="info"
              showIcon
              message="评论只有运营能删，删除是逻辑删除"
              description="共享账号下系统分不出哪条评论是谁写的，因此用户账号一律不能删除——包括他自己刚发的那条。"
            />
          )}

          <List<CaseComment>
            size="small"
            loading={comments.isLoading}
            dataSource={comments.data ?? []}
            locale={{ emptyText: <Empty description="还没有人评论" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
            renderItem={(item) => (
              <List.Item
                actions={
                  isOperator
                    ? [
                        <Popconfirm
                          key="remove"
                          title="删除这条评论？"
                          okText="删除"
                          cancelText="取消"
                          okButtonProps={{ danger: true }}
                          onConfirm={() => removeComment.mutate(item.id)}
                        >
                          <Button type="text" size="small" danger icon={<Trash2 size={14} />} />
                        </Popconfirm>,
                      ]
                    : undefined
                }
              >
                <List.Item.Meta
                  title={
                    <Space size={space.xs}>
                      {/* 署名留空时库里存的是 null，显示成「匿名」是展示层的事 */}
                      <Text strong>{item.signature ?? '匿名'}</Text>
                      <Text style={{ fontSize: fontSize.caption, color: neutral[500] }}>
                        {formatDateTime(item.commentedAt)}
                      </Text>
                    </Space>
                  }
                  description={<Text style={{ whiteSpace: 'pre-wrap' }}>{item.content}</Text>}
                />
              </List.Item>
            )}
          />
        </Space>
      </Card>
    </Space>
  );
}

interface MetricProps {
  icon: React.ReactNode;
  title: string;
  value: number | null | undefined;
  suffix?: string;
}

function Metric({ icon, title, value, suffix }: MetricProps) {
  return (
    <Statistic
      title={
        <Space size={space['2xs']} style={{ color: neutral[600], fontSize: fontSize.bodySm }}>
          {icon}
          {title}
        </Space>
      }
      value={value ?? EM_DASH}
      suffix={value == null ? undefined : suffix}
      valueStyle={{ fontSize: fontSize.h4, fontVariantNumeric: 'tabular-nums' }}
    />
  );
}
