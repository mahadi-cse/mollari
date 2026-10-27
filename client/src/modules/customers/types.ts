export interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  avatar?: string;
  role?: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: number;
  userId: number;
  user?: User;
  firstName?: string;
  lastName?: string;
  phone?: string;
  segment?: CustomerSegment;
  totalOrders: number;
  totalSpent: number;
  loyaltyPoints: number;
  referralCode?: string;
  isActive: boolean;
  lastOrderDate?: string;
  createdAt: string;
  updatedAt: string;
}

export enum UserRole {
  ADMIN = 'admin',
  STAFF = 'staff',
  CUSTOMER = 'customer',
  GUEST = 'guest',
}

export enum CustomerSegment {
  VIP = 'vip',
  REGULAR = 'regular',
  NEW = 'new',
  INACTIVE = 'inactive',
}

export interface CustomerMetrics {
  totalCustomers: number;
  activeCustomers: number;
  newCustomersThisMonth: number;
  totalRevenue: number;
  averageOrderValue: number;
  customerRetentionRate: number;
}

export interface UpdateCustomerPayload {
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatar?: string;
}
