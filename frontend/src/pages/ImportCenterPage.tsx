import { Button, Space, Typography } from 'antd';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { space } from '@/shared/theme/designTokens';
import { importApi } from '@/shared/api/imports';
import { PageState } from '@/shared/ui/PageState';
import { TemplateCards } from '@/features/dataimport/TemplateCards';
import { ImportWizard } from '@/features/dataimport/ImportWizard';
import { ImportBatchTable } from '@/features/dataimport/ImportBatchTable';

const { Title, Text } = Typography;

/**
 * 导入中心 S-1（需求 13.8）。三个区域自上而下：模板下载、发起导入向导、批次列表。
 *
 * <p>页面级的运营限制由路由层的 {@code OperatorOnly} 完成（纪律 PMI-5），这里不再判一次。
 */
export function ImportCenterPage() {
  const queryClient = useQueryClient();
  const types = useQuery({ queryKey: ['import-types'], queryFn: () => importApi.types() });

  if (types.isLoading) {
    return <PageState variant="loading" />;
  }
  if (types.isError || !types.data) {
    return (
      <PageState
        variant="error"
        description="导入类型清单没有取到，页面无法初始化。"
        action={<Button onClick={() => void types.refetch()}>重新加载</Button>}
      />
    );
  }

  return (
    <Space direction="vertical" size={space.lg} style={{ width: '100%' }}>
      <div>
        <Title level={2} style={{ margin: 0 }}>
          导入中心
        </Title>
        <Text type="secondary">
          平台唯一的批量数据入口。导入分「上传校验」与「确认写入」两步，校验不通过不会写入任何数据。
        </Text>
      </div>

      <TemplateCards types={types.data} />

      <ImportWizard
        types={types.data}
        onCommitted={() => void queryClient.invalidateQueries({ queryKey: ['imports'] })}
      />

      <ImportBatchTable types={types.data} />
    </Space>
  );
}
