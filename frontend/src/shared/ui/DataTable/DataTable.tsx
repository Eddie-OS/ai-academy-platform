import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { App, Button, Segmented, Table, Typography } from 'antd';
import type { ColumnType } from 'antd/es/table';
import { layout, neutral, radius, space } from '@/shared/theme/designTokens';
import { useIsOperator } from '@/shared/store/authStore';
import { PageState } from '@/shared/ui/PageState';
import { COLUMN_KINDS, type ColumnKind } from './columnKinds';
import { DENSITIES, readDensity, writeDensity, type Density } from './density';

const { Text } = Typography;

/**
 * 统一表格（设计规范第 5 章，开发实施文档 4.3.2）。
 *
 * <p>13 个页面以表格为主工作区，因此这里做对一次胜过在每个页面做对 13 次。组件承担的是
 * 那些「散落实现必然走偏」的部分：
 * <ul>
 *   <li>空值统一 `—`（5.6）：不是空白、不是「无」、不是 `-`，且 0 与空值必须能区分；
 *   <li>三档密度（5.2）与按「用户 + 页面」记住的偏好；
 *   <li>骨架屏列宽与真实列宽一致（5.12）：列宽对不上会导致数据到位时整表跳动；
 *   <li>表头吸顶偏移 = 顶栏 56px + 页面自己的吸顶高度（5.5）；
 *   <li>四种非常规状态（5.12）「无数据」与「无结果」必须分开——用户处境与下一步动作不同；
 *   <li>用户账号下选择列与批量操作整列不渲染（5.9、5.10）。
 * </ul>
 *
 * <p><b>为什么这里可以按账号类型决定渲染，而 ActionGuard 不行。</b>选择列与批量按钮
 * 对应的是「写操作入口」，纪律 PMI-5 明确它只看登录时拿到的 operator 布尔值；
 * ActionGuard 管的是「当前状态允不允许做这个动作」，那是后端才知道的事。
 */

export interface DataTableColumn<T> {
  key: string;
  title: string;
  kind: ColumnKind;
  /** 取值路径。给了 render 时可省 */
  dataIndex?: Extract<keyof T, string>;
  render?: (row: T) => ReactNode;
  sortable?: boolean;
  /** 覆盖基准宽度。操作列用 {@link actionsWidth} 算 */
  width?: number;
  /** 用户账号下整列不渲染（5.10：操作列只留「查看」） */
  operatorOnly?: boolean;
}

interface Selection<T> {
  selectedKeys: string[];
  onChange: (keys: string[], rows: T[]) => void;
  /** 状态不允许选的行给出原因，checkbox 置禁用（5.9） */
  disabledReason?: (row: T) => string | null;
}

interface DataTableProps<T> {
  /** 密度偏好的存储键，用页面标识（如 `imports`），不要用随机值 */
  storageKey: string;
  columns: DataTableColumn<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string;
  total: number;
  pageNum: number;
  pageSize: number;
  onPageChange: (pageNum: number, pageSize: number) => void;
  loading?: boolean;
  /** 加载失败的说明。非空即渲染失败态（5.12），表头与筛选条保留 */
  error?: string | null;
  onReload?: () => void;
  /** 是否处于筛选状态：决定空态是「还没有数据」还是「未找到符合条件的记录」 */
  filtered?: boolean;
  /** 空态的对象名，渲染成「还没有{对象}」 */
  objectName: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  onResetFilters?: () => void;
  selection?: Selection<T>;
  /** 有选中行时替换工具条右侧（5.9） */
  bulkActions?: ReactNode;
  toolbarExtra?: ReactNode;
  /** 页面自己的吸顶高度（页头、筛选条），与顶栏 56px 相加得到表头吸顶偏移 */
  stickyOffset?: number;
}

/** 空值统一 `—`（U+2014）。0 与 false 不是空值，必须原样显示。 */
const EM_DASH = '—';

function renderEmpty(value: ReactNode): ReactNode {
  if (value === null || value === undefined || value === '') {
    return <span style={{ color: neutral[400] }}>{EM_DASH}</span>;
  }
  return value;
}

const SKELETON_ROWS = 5;

/** 骨架行的行键字段。业务行的 rowKey 由调用方给，骨架行没有业务主键，用它顶上。 */
const SKELETON_KEY = '__skeletonKey';

function skeletonRowKey(row: unknown): string {
  return (row as Record<string, string>)[SKELETON_KEY] ?? '';
}

export function DataTable<T>({
  storageKey,
  columns,
  rows,
  rowKey,
  total,
  pageNum,
  pageSize,
  onPageChange,
  loading = false,
  error = null,
  onReload,
  filtered = false,
  objectName,
  emptyDescription,
  emptyAction,
  onResetFilters,
  selection,
  bulkActions,
  toolbarExtra,
  stickyOffset = 0,
}: DataTableProps<T>) {
  const isOperator = useIsOperator();
  const { message } = App.useApp();
  const [density, setDensity] = useState<Density>(() => readDensity(storageKey));

  useEffect(() => {
    setDensity(readDensity(storageKey));
  }, [storageKey]);

  const onDensityChange = (next: Density) => {
    setDensity(next);
    writeDensity(storageKey, next);
  };

  const visibleColumns = useMemo(
    () => columns.filter((column) => !column.operatorOnly || isOperator),
    [columns, isOperator],
  );

  const showSkeleton = loading && (rows === undefined || rows.length === 0);
  const spec = DENSITIES[density];

  const antdColumns: ColumnType<T>[] = visibleColumns.map((column) => {
    const kind = COLUMN_KINDS[column.kind];
    return {
      key: column.key,
      title: column.title,
      // 表头不允许省略号截断（TB4），所以标题不设 ellipsis；单元格才设
      width: column.width ?? kind.width,
      align: kind.align,
      ellipsis: column.kind === 'name' || column.kind === 'dept' ? { showTitle: true } : false,
      sorter: column.sortable ? true : undefined,
      onCell: () => ({
        style: {
          paddingTop: spec.cellPaddingY,
          paddingBottom: spec.cellPaddingY,
          fontSize: spec.fontSize,
          fontVariantNumeric: kind.tabularNums ? 'tabular-nums' : undefined,
          minWidth: kind.minWidth,
        },
      }),
      render: (_: unknown, row: T) => {
        if (showSkeleton) {
          return <SkeletonBar />;
        }
        const value = column.render
          ? column.render(row)
          : column.dataIndex
            ? (row[column.dataIndex] as ReactNode)
            : null;
        return renderEmpty(value);
      },
    };
  });

  const skeletonRows = useMemo(
    () =>
      Array.from(
        { length: SKELETON_ROWS },
        (_, index) => ({ [SKELETON_KEY]: `skeleton-${index}` }) as unknown as T,
      ),
    [],
  );

  const dataSource = showSkeleton ? skeletonRows : (rows ?? []);
  const selectedCount = selection?.selectedKeys.length ?? 0;
  const showBulkBar = selectedCount > 0;

  // 选择列与批量操作只在运营账号下存在（5.9）
  const rowSelection =
    selection && isOperator && !showSkeleton
      ? {
          selectedRowKeys: selection.selectedKeys,
          onChange: (keys: React.Key[], selectedRows: T[]) =>
            selection.onChange(keys.map(String), selectedRows),
          columnWidth: 40,
          getCheckboxProps: (row: T) => {
            const reason = selection.disabledReason?.(row) ?? null;
            return { disabled: reason !== null, title: reason ?? undefined };
          },
        }
      : undefined;

  const emptyNode = error ? (
    <PageState
      variant="error"
      description={error}
      action={onReload && <Button onClick={onReload}>重新加载</Button>}
    />
  ) : filtered ? (
    <PageState
      variant="noResult"
      action={
        onResetFilters && (
          <Button ghost type="primary" onClick={onResetFilters}>
            重置筛选
          </Button>
        )
      }
    />
  ) : (
    <PageState variant="empty" objectName={objectName} description={emptyDescription} action={emptyAction} />
  );

  return (
    <div
      style={{
        background: neutral[0],
        border: `1px solid ${neutral[200]}`,
        borderRadius: radius.lg,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          height: 48,
          display: 'flex',
          alignItems: 'center',
          gap: space.md,
          padding: `0 ${space.lg}px`,
          borderBottom: `1px solid ${neutral[200]}`,
          background: showBulkBar ? '#E8EEFF' : neutral[0],
        }}
      >
        {showBulkBar ? (
          <>
            <Text strong data-testid="table-bulk-bar">
              已选 {selectedCount} 项
            </Text>
            <Button type="link" size="small" onClick={() => selection?.onChange([], [])}>
              取消选择
            </Button>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: space.xs }}>{bulkActions}</div>
          </>
        ) : (
          <>
            <Text type="secondary" data-testid="table-toolbar-count">
              {/* 5.8：筛选后要同时给出筛选结果数与总数，只给一个数无法判断筛掉了多少 */}
              {filtered ? `筛选出 ${total} 条` : `共 ${total} 条`}
            </Text>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: space.xs }}>
              {toolbarExtra}
              <Segmented<Density>
                size="small"
                value={density}
                onChange={onDensityChange}
                options={(Object.keys(DENSITIES) as Density[]).map((key) => ({
                  value: key,
                  label: DENSITIES[key].label,
                }))}
              />
            </div>
          </>
        )}
      </div>

      <Table<T>
        columns={antdColumns}
        dataSource={dataSource}
        rowKey={showSkeleton ? skeletonRowKey : rowKey}
        rowSelection={rowSelection}
        // 骨架屏本身就是加载指示，再叠 Spin 会出现「灰条上转圈」
        loading={false}
        sticky={{ offsetHeader: layout.headerHeight + stickyOffset }}
        locale={{ emptyText: emptyNode }}
        pagination={{
          current: pageNum,
          pageSize,
          total,
          // 单页时也显示，隐藏会让人怀疑「是不是还有更多」（5.11）
          showSizeChanger: true,
          pageSizeOptions: [20, 50, 100],
          showQuickJumper: true,
          showTotal: (count) => `共 ${count} 条`,
          onChange: (nextPage, nextSize) => {
            if (selectedCount > 0) {
              selection?.onChange([], []);
              message.info('翻页已清空选择');
            }
            onPageChange(nextPage, nextSize);
          },
        }}
        onRow={() => ({ style: { height: spec.rowHeight } })}
      />
    </div>
  );
}

/** 骨架屏的一条灰条。放在单元格里而不是覆盖整表，列宽才能与真实列宽一致（5.12）。 */
function SkeletonBar() {
  return (
    <span
      data-testid="skeleton-bar"
      style={{
        display: 'block',
        height: 14,
        borderRadius: radius.xs,
        background: neutral[100],
      }}
    />
  );
}
