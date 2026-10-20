import { TABLE_CARD_CLASS_NAME } from "@/components/data-display/TableCard";
import type { ComponentProps, ReactNode } from "react";
import { EnhancedTable } from "@/components/data-display/EnhancedTable";
import type { OrderListItem } from "@/features/orders/types/order";

type Props = ComponentProps<typeof EnhancedTable<OrderListItem>> & { errorContent?: ReactNode };

export function StaffOrdersTable({ errorContent, ...props }: Props) {
  return <div className={TABLE_CARD_CLASS_NAME}>
    {errorContent ?? <EnhancedTable {...props} responsivePageSize contentHeight reserveTableHeight={false} autoPageSize={false} pageCapacity={undefined} pageSize={5} rowHeight={56} />}
  </div>;
}
