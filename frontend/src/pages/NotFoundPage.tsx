import { Button, Card, Result } from 'antd';
import { useNavigate } from 'react-router-dom';

/**
 * 404。设计规范要求 7 个全局状态页（加载/空/无结果/无权限/错误/离线/404），
 * 其余 6 个在阶段 1 与前端基础件一并实现。
 */
export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <Card>
      <Result
        status="404"
        title="页面不存在"
        subTitle="链接可能已失效，或该页面属于二期范围。"
        extra={
          <Button type="primary" onClick={() => navigate('/')}>
            返回总看板
          </Button>
        }
      />
    </Card>
  );
}
