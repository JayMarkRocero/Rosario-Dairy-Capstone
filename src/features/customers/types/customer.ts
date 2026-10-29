export interface Customer {
  id: number;
  name: string;
  isActive: boolean;
  phone: string;
  email: string;
  address: string;
  orders: number;
  readonly totalSpent?: string | null;
  last: string;
  createdAt: string;
}
