import type { FEFOItem, InventoryItem, Category } from "@/features/inventory/types/inventory";
import type { SaleRecord, RevenuePoint } from "@/lib/types/common";

interface DashboardOrderFixture {
  id: string;
  customer: string;
  status: "Completed" | "Pending" | "Processing" | "Ready" | "Cancelled";
  staff: string;
  pickup: string;
  total: number;
}

interface DashboardCustomerFixture {
  id: number;
  name: string;
  phone: string;
  email: string;
  orders: number;
  total: number;
  last: string;
}

interface DashboardUserFixture {
  id: number;
  name: string;
  role: "Administrator" | "Staff";
  email: string;
  status: "Active" | "Inactive";
  last: string;
}

// ─── Revenue / Chart Data ─────────────────────────────────────────────────────

export const dailyRevData: RevenuePoint[] = [
  { n: "Mon", rev: 12400, orders: 34 },
  { n: "Tue", rev: 15800, orders: 42 },
  { n: "Wed", rev: 11200, orders: 28 },
  { n: "Thu", rev: 18600, orders: 51 },
  { n: "Fri", rev: 22100, orders: 63 },
  { n: "Sat", rev: 28400, orders: 78 },
  { n: "Sun", rev: 19800, orders: 55 },
];

export const weeklyRevData: RevenuePoint[] = [
  { n: "Week 1", rev: 98000,  orders: 245 },
  { n: "Week 2", rev: 112000, orders: 289 },
  { n: "Week 3", rev: 89000,  orders: 198 },
  { n: "Week 4", rev: 134000, orders: 341 },
];

export const monthlyRevData: RevenuePoint[] = [
  { n: "Jan", rev: 342000, orders: 876  },
  { n: "Feb", rev: 298000, orders: 754  },
  { n: "Mar", rev: 415000, orders: 1023 },
  { n: "Apr", rev: 389000, orders: 942  },
  { n: "May", rev: 467000, orders: 1156 },
  { n: "Jun", rev: 521000, orders: 1289 },
];

export const yearlyRevData: RevenuePoint[] = [
  { n: "2021", rev: 2800000, orders: 7120  },
  { n: "2022", rev: 3400000, orders: 8640  },
  { n: "2023", rev: 4200000, orders: 10890 },
  { n: "2024", rev: 5100000, orders: 13200 },
  { n: "2025", rev: 5900000, orders: 15400 },
  { n: "2026", rev: 3200000, orders: 8100  },
];

export const forecastData = [
  { date: "Jun 25", actual: 18400, forecast: null, lower: null, upper: null },
  { date: "Jun 26", actual: 19200, forecast: null, lower: null, upper: null },
  { date: "Jun 27", actual: 21500, forecast: null, lower: null, upper: null },
  { date: "Jun 28", actual: 20100, forecast: null, lower: null, upper: null },
  { date: "Jun 29", actual: 22800, forecast: null, lower: null, upper: null },
  { date: "Jun 30", actual: 24100, forecast: null, lower: null, upper: null },
  { date: "Jul 1",  actual: 22400, forecast: 22400, lower: 22400, upper: 22400 },
  { date: "Jul 2",  actual: null,  forecast: 23800, lower: 21200, upper: 26400 },
  { date: "Jul 3",  actual: null,  forecast: 25200, lower: 22100, upper: 28300 },
  { date: "Jul 4",  actual: null,  forecast: 27600, lower: 23800, upper: 31400 },
  { date: "Jul 5",  actual: null,  forecast: 26100, lower: 22000, upper: 30200 },
  { date: "Jul 6",  actual: null,  forecast: 28900, lower: 24200, upper: 33600 },
  { date: "Jul 7",  actual: null,  forecast: 31200, lower: 25800, upper: 36600 },
];

export const categoryData = [
  { name: "Milk",      value: 35, color: "#2F80ED" },
  { name: "Cheese",    value: 22, color: "#17375E" },
  { name: "Butter",    value: 15, color: "#F39C12" },
  { name: "Ice Cream", value: 12, color: "#9B59B6" },
  { name: "Yogurt",    value: 10, color: "#27AE60" },
  { name: "Cream",     value: 6,  color: "#1ABC9C" },
];

export const bestSellers = [
  { product: "Fresh Whole Milk 1L",  sales: 2840 },
  { product: "Skim Milk 1L",         sales: 2210 },
  { product: "Greek Yogurt 200g",    sales: 1890 },
  { product: "Cheddar Cheese 500g",  sales: 1560 },
  { product: "Salted Butter 250g",   sales: 1340 },
  { product: "Heavy Cream 500ml",    sales: 1120 },
  { product: "Mozzarella 250g",      sales: 980  },
  { product: "Vanilla Ice Cream 1L", sales: 870  },
  { product: "Cottage Cheese 500g",  sales: 760  },
  { product: "Chocolate Milk 500ml", sales: 640  },
];

export const miniSalesData = [
  { n: "Mon", v: 8200  },
  { n: "Tue", v: 11400 },
  { n: "Wed", v: 9800  },
  { n: "Thu", v: 14200 },
  { n: "Fri", v: 18100 },
  { n: "Sat", v: 22400 },
  { n: "Sun", v: 25400 },
];

// ─── Inventory ────────────────────────────────────────────────────────────────

export const fefoItems: FEFOItem[] = [
  { id:1, product:"Fresh Whole Milk 1L",  batch:"BT-2024-001", qty:45,  expiry:"Jul 5, 2026",  days:2,  priority:"Critical", st:"red"    },
  { id:2, product:"Mozzarella 250g",       batch:"BT-2024-063", qty:28,  expiry:"Jul 6, 2026",  days:3,  priority:"Critical", st:"red"    },
  { id:3, product:"Cheddar Cheese 500g",   batch:"BT-2024-018", qty:12,  expiry:"Jul 8, 2026",  days:5,  priority:"High",     st:"orange" },
  { id:4, product:"Greek Yogurt 200g",     batch:"BT-2024-042", qty:134, expiry:"Jul 10, 2026", days:7,  priority:"High",     st:"orange" },
  { id:5, product:"Flavored Yogurt 150g",  batch:"BT-2024-055", qty:210, expiry:"Jul 8, 2026",  days:5,  priority:"High",     st:"orange" },
  { id:6, product:"Salted Butter 250g",    batch:"BT-2024-031", qty:78,  expiry:"Jul 20, 2026", days:17, priority:"Medium",   st:"yellow" },
  { id:7, product:"Heavy Cream 500ml",     batch:"BT-2024-056", qty:89,  expiry:"Jul 20, 2026", days:17, priority:"Medium",   st:"yellow" },
  { id:8, product:"Skim Milk 1L",          batch:"BT-2024-007", qty:234, expiry:"Jul 25, 2026", days:22, priority:"Low",      st:"green"  },
  { id:9, product:"Vanilla Ice Cream 1L",  batch:"BT-2024-079", qty:67,  expiry:"Sep 15, 2026", days:74, priority:"Low",      st:"green"  },
];

export const allInventory: InventoryItem[] = [
  { id:1,  name:"Fresh Whole Milk 1L",   cat:"Milk",     price:85,  stock:45,  expiry:"Jul 5, 2026",  low:true  },
  { id:2,  name:"Skim Milk 1L",          cat:"Milk",     price:80,  stock:234, expiry:"Jul 25, 2026", low:false },
  { id:3,  name:"Chocolate Milk 500ml",  cat:"Milk",     price:65,  stock:89,  expiry:"Jul 12, 2026", low:false },
  { id:4,  name:"Cheddar Cheese 500g",   cat:"Cheese",   price:320, stock:12,  expiry:"Jul 8, 2026",  low:true  },
  { id:5,  name:"Mozzarella 250g",       cat:"Cheese",   price:180, stock:28,  expiry:"Jul 6, 2026",  low:true  },
  { id:6,  name:"Cottage Cheese 500g",   cat:"Cheese",   price:145, stock:56,  expiry:"Jul 15, 2026", low:false },
  { id:7,  name:"Salted Butter 250g",    cat:"Butter",   price:120, stock:78,  expiry:"Jul 20, 2026", low:false },
  { id:8,  name:"Unsalted Butter 250g",  cat:"Butter",   price:115, stock:8,   expiry:"Jul 18, 2026", low:true  },
  { id:9,  name:"Greek Yogurt 200g",     cat:"Yogurt",   price:75,  stock:134, expiry:"Jul 10, 2026", low:false },
  { id:10, name:"Flavored Yogurt 150g",  cat:"Yogurt",   price:55,  stock:210, expiry:"Jul 8, 2026",  low:false },
  { id:11, name:"Heavy Cream 500ml",     cat:"Cream",    price:150, stock:89,  expiry:"Jul 20, 2026", low:false },
  { id:12, name:"Vanilla Ice Cream 1L",  cat:"Ice Cream",price:240, stock:67,  expiry:"Sep 15, 2026", low:false },
];

export const categoriesList: Category[] = [
  { id:1, name:"Milk",      products:3, desc:"Fresh fluid milk products",        is_active:true },
  { id:2, name:"Cheese",    products:3, desc:"Aged and fresh cheese varieties",   is_active:true },
  { id:3, name:"Butter",    products:2, desc:"Salted and unsalted butter",        is_active:true },
  { id:4, name:"Yogurt",    products:2, desc:"Probiotic and flavored yogurts",    is_active:true },
  { id:5, name:"Cream",     products:1, desc:"Heavy and whipping cream",          is_active:true },
  { id:6, name:"Ice Cream", products:1, desc:"Frozen dairy desserts",             is_active:true },
];

// ─── Orders ───────────────────────────────────────────────────────────────────

export const recentOrders: DashboardOrderFixture[] = [
  { id:"ORD-2026-001", customer:"Maria Santos",   status:"Completed",  staff:"Juan dela Cruz", pickup:"Jul 3, 2:00 PM",  total:1250 },
  { id:"ORD-2026-002", customer:"Roberto Reyes",  status:"Pending",    staff:"Ana Garcia",     pickup:"Jul 3, 4:30 PM",  total:875  },
  { id:"ORD-2026-003", customer:"Elena Flores",   status:"Processing", staff:"Miguel Torres",  pickup:"Jul 3, 3:00 PM",  total:2100 },
  { id:"ORD-2026-004", customer:"Carlos Mendoza", status:"Ready",      staff:"Juan dela Cruz", pickup:"Jul 3, 1:30 PM",  total:650  },
  { id:"ORD-2026-005", customer:"Teresa Cruz",    status:"Cancelled",  staff:"Ana Garcia",     pickup:"Jul 3, 5:00 PM",  total:420  },
];

export const allOrders: DashboardOrderFixture[] = [
  ...recentOrders,
  { id:"ORD-2026-006", customer:"Antonio Ramos", status:"Completed", staff:"Juan dela Cruz", pickup:"Jul 2, 11:00 AM", total:3200 },
  { id:"ORD-2026-007", customer:"Sofia Lim",     status:"Completed", staff:"Ana Garcia",     pickup:"Jul 2, 2:00 PM",  total:780  },
  { id:"ORD-2026-008", customer:"Walk-in",       status:"Completed", staff:"Miguel Torres",  pickup:"Jul 1, 10:30 AM", total:340  },
];

// ─── Customers ────────────────────────────────────────────────────────────────

export const customers: DashboardCustomerFixture[] = [
  { id:1, name:"Maria Santos",   phone:"09171234567", email:"maria@email.com",   orders:24, total:28400, last:"Jul 3, 2026"  },
  { id:2, name:"Roberto Reyes",  phone:"09182345678", email:"roberto@email.com", orders:18, total:19800, last:"Jul 2, 2026"  },
  { id:3, name:"Elena Flores",   phone:"09193456789", email:"elena@email.com",   orders:31, total:42100, last:"Jul 3, 2026"  },
  { id:4, name:"Carlos Mendoza", phone:"09204567890", email:"carlos@email.com",  orders:12, total:11200, last:"Jul 1, 2026"  },
  { id:5, name:"Teresa Cruz",    phone:"09215678901", email:"teresa@email.com",  orders:8,  total:7800,  last:"Jun 28, 2026" },
  { id:6, name:"Antonio Ramos",  phone:"09226789012", email:"antonio@email.com", orders:45, total:68900, last:"Jul 3, 2026"  },
  { id:7, name:"Sofia Lim",      phone:"09237890123", email:"sofia@email.com",   orders:22, total:19400, last:"Jul 2, 2026"  },
];

// ─── Users ────────────────────────────────────────────────────────────────────

export const systemUsers: DashboardUserFixture[] = [
  { id:1, name:"Admin Rosario",  role:"Administrator", email:"admin@rosariodairy.com",  status:"Active",   last:"Jul 3, 2026"  },
  { id:2, name:"Juan dela Cruz", role:"Staff",          email:"juan@rosariodairy.com",   status:"Active",   last:"Jul 3, 2026"  },
  { id:3, name:"Ana Garcia",     role:"Staff",          email:"ana@rosariodairy.com",    status:"Active",   last:"Jul 3, 2026"  },
  { id:4, name:"Miguel Torres",  role:"Staff",          email:"miguel@rosariodairy.com", status:"Inactive", last:"Jun 25, 2026" },
  { id:5, name:"Sofia Mendez",   role:"Administrator",  email:"sofia@rosariodairy.com",  status:"Active",   last:"Jul 2, 2026"  },
];

// ─── Sales History ────────────────────────────────────────────────────────────

export const salesHistory: SaleRecord[] = [
  { receipt:"RCP-2026-001", customer:"Maria Santos",   cashier:"Juan dela Cruz", date:"Jul 3, 2026",  payment:"Cash",  total:1250 },
  { receipt:"RCP-2026-002", customer:"Roberto Reyes",  cashier:"Ana Garcia",     date:"Jul 3, 2026",  payment:"GCash", total:875  },
  { receipt:"RCP-2026-003", customer:"Walk-in",        cashier:"Juan dela Cruz", date:"Jul 3, 2026",  payment:"Cash",  total:340  },
  { receipt:"RCP-2026-004", customer:"Elena Flores",   cashier:"Miguel Torres",  date:"Jul 2, 2026",  payment:"Card",  total:2100 },
  { receipt:"RCP-2026-005", customer:"Walk-in",        cashier:"Ana Garcia",     date:"Jul 2, 2026",  payment:"Cash",  total:580  },
  { receipt:"RCP-2026-006", customer:"Carlos Mendoza", cashier:"Juan dela Cruz", date:"Jul 1, 2026",  payment:"GCash", total:650  },
  { receipt:"RCP-2026-007", customer:"Antonio Ramos",  cashier:"Ana Garcia",     date:"Jul 1, 2026",  payment:"Cash",  total:3200 },
  { receipt:"RCP-2026-008", customer:"Walk-in",        cashier:"Miguel Torres",  date:"Jun 30, 2026", payment:"Card",  total:480  },
  
];
