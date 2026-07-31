import { Button, Card, Col, Row, Tag, Typography } from 'antd';
import { Download } from 'lucide-react';
import { neutral, space } from '@/shared/theme/designTokens';
import { importApi, type ImportTypeOption } from '@/shared/api/imports';

const { Text } = Typography;

/**
 * 区域 A · 模板下载区（需求 13.8.2）：6 张模板卡。
 *
 * <p>卡片列表来自 {@code /api/imports/types}，不在前端写死 6 个中文名——
 * V1.2 已经把导入类型从 5 类改成 6 类一次了（删组织架构、加两类反馈），
 * 前端写死的那份必然是下一次改漏的地方。
 *
 * <p><b>「最后更新日期」这一列暂缺。</b>需求 13.8.2 要求每张卡显示模板的最后更新日期，
 * 但模板是后端按列声明<b>现场生成</b>的（见 ImportController.template），没有文件的更新日期
 * 这个概念。真正对应的语义是「解析器列定义的版本」，一期没有版本号，因此这里不显示一个
 * 编造出来的日期。
 */
export function TemplateCards({ types }: { types: ImportTypeOption[] }) {
  return (
    <Row gutter={[space.md, space.md]}>
      {types.map((type) => (
        <Col span={8} key={type.code}>
          <Card size="small" title={`${type.label}导入模板`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: space.xs }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {type.templateFileName}
              </Text>
              {type.appendOnly && (
                // 规则 FB5：追加语义必须显著提示，否则运营会以为重导一次能覆盖上次的错数据
                <Tag color="blue" style={{ alignSelf: 'flex-start' }}>
                  追加导入，不覆盖已有数据
                </Tag>
              )}
              <Button
                icon={<Download size={14} />}
                href={importApi.templateUrl(type.code)}
                style={{ alignSelf: 'flex-start', color: neutral[700] }}
              >
                下载模板
              </Button>
            </div>
          </Card>
        </Col>
      ))}
    </Row>
  );
}
