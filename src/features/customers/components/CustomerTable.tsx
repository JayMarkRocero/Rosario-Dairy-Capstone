import { TABLE_CARD_CLASS_NAME } from "@/components/data-display/TableCard";
import type { ComponentProps } from "react";
import { EnhancedTable } from "@/components/data-display/EnhancedTable";
import type { Customer } from "@/features/customers/types/customer";

type Props = ComponentProps<typeof EnhancedTable<Customer>> & { errorContent?: React.ReactNode };

export function CustomerTable({ errorContent, ...props }: Props) {
  return <div className={TABLE_CARD_CLASS_NAME}>
    {errorContent ?? <EnhancedTable {...props} responsivePageSize contentHeight reserveTableHeight={false} autoPageSize={false} pageCapacity={undefined} pageSize={props.pageSize ?? 5} rowHeight={56} />}
  </div>;
}
