export interface Product {
  id: number;
  name: string;
  sku: string;
  category: string;
  price: number;
  stock: number;
  sold: number;
  manualSold: number;
  status: 'active' | 'low' | 'out';
  warehouse?: string;
  sizes?: any[];
  colors?: any[];
  unitType?: 'PIECE' | 'WEIGHT';
  unitLabel?: string;
}

export interface SellLog {
  id: string;
  product: string;
  qty: number;
  amount: number;
  note: string;
  date: string;
  by: string;
}

export interface Order {
  id: string;
  customer: string;
  amount: number;
  status: 'delivered' | 'processing' | 'shipped' | 'pending';
  items: number;
  time: string;
}

export interface Branch {
  id: number;
  name: string;
  city: string;
  address: string;
  phone: string;
  manager: string;
  email: string;
  active: boolean;
  hq: boolean;
  orders: number;
  stock: number;
  revenue: number;
}
