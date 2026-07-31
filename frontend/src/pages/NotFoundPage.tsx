import { Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import { PageState } from '@/shared/ui/PageState';

/** 404（设计规范 7.5）。七个全局状态页共用 {@link PageState}，这里只提供动作。 */
export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <PageState
      variant="notFound"
      action={
        <Button type="primary" onClick={() => navigate('/')}>
          返回总看板
        </Button>
      }
    />
  );
}
