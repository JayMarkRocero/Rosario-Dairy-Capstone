import type { ComponentProps, ReactNode } from "react";
import { EnhancedTable } from "@/components/data-display/EnhancedTable";
import type { OrderListItem } from "@/features/orders/types/order";

type Props = ComponentProps<typeof EnhancedTable<OrderListItem>> & { errorContent?: ReactNode };

export function StaffOrdersTable({ errorContent, ...props }: Props) {
  return <div className="flex-1 min-h-0 flex flex-col justify-between bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm overflow-hidden [&_.enhanced-table]:flex-1 [&_.enhanced-table]:justify-between [&_.enhanced-table]:min-h-0 [&_.enhanced-table]:overflow-hidden [&_[data-table-surface]]:!bg-transparent [&_[data-table-surface]]:!border-0 [&_[data-table-surface]]:!rounded-none [&_[data-table-surface]]:!p-0 [&_thead]:!bg-white [&_[data-table-surface]]:flex-1 [&_[data-table-surface]]:min-h-0 [&_[data-table-surface]]:overflow-y-auto [&_tbody_td]:!py-3.5 [&_.enhanced-table>div:last-child:not([data-table-surface])]:mt-auto [&_.enhanced-table>div:last-child:not([data-table-surface])]:!pt-3 [&_.enhanced-table>div:last-child:not([data-table-surface])]:border-t [&_.enhanced-table>div:last-child:not([data-table-surface])]:border-slate-100">
    {errorContent ?? <EnhancedTable {...props} contentHeight reserveTableHeight={false} autoPageSize={false} pageCapacity={undefined} pageSize={5} rowHeight={56} />}
  </div>;
}
