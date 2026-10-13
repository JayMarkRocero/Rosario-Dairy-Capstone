import type { ComponentProps } from "react";
import { EnhancedTable } from "@/components/data-display/EnhancedTable";
import type { OrderListItem } from "@/features/orders/types/order";

type Props = ComponentProps<typeof EnhancedTable<OrderListItem>> & { errorContent?: React.ReactNode };

export function OrdersTable({ errorContent, ...props }: Props) {
  return <div className="h-auto shrink-0 bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm space-y-4 flex flex-col justify-between [&_.enhanced-table]:!h-auto [&_.enhanced-table]:!flex-none [&_[data-table-surface]]:!h-auto [&_[data-table-surface]]:!min-h-0 [&_[data-table-surface]]:!flex-none [&_tbody_td]:!py-3 [&_.enhanced-table>div:last-child:not([data-table-surface])]:border-t [&_.enhanced-table>div:last-child:not([data-table-surface])]:border-slate-100 [&_.enhanced-table>div:last-child:not([data-table-surface])]:!pt-3 [&_.enhanced-table>div:last-child:not([data-table-surface])]:mt-auto">
    {errorContent ?? <EnhancedTable {...props} contentHeight reserveTableHeight={false} autoPageSize={false} pageCapacity={undefined} pageSize={props.pageSize ?? 5} rowHeight={56} />}
  </div>;
}
