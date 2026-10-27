import type { Product } from '@/modules/products/types';
import type { Customer } from '@/modules/customers/types';

export interface OrderItem {
  id: number;
  orderId: number;
  productId: number;
  quantity: number;
  price: number;
  product?: Product;
}

export interface Order {
  id: number;
  orderNumber: string;
  customerId?: number;
  customer?: Customer;
  items: OrderItem[];
  shippingName?: string;
  shippingPhone?: string;
  shippingAddress?: string;
  shippingCity?: string;
  shippingPostal?: string;
  shippingCountry?: string;
  total: number;
  subtotal: number;
  tax?: number;
  taxAmount?: number;
  shippingCost?: number;
  shippingCharge?: number;
  discountAmount?: number;
  status: OrderStatus | string;
  paymentStatus?: PaymentStatus | string;
  notes?: string;
  trackingNumber?: string;
  consignmentId?: string;
  trackingCode?: string;
  courierStatus?: string;
  steadfastEntry?: boolean;
  codAmount?: number;
  manualSaleId?: number;
  channel?: string;
  trackingEvents?: OrderTrackingEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface OrderTrackingEvent {
  id: number;
  orderId: number;
  status: string;
  title: string;
  description?: string;
  createdAt: string;
}

export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

export enum PaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export interface CreateOrderPayload {
  customerId: number;
  items: Array<{ productId: number; quantity: number }>;
  shippingName: string;
  shippingEmail: string;
  shippingPhone: string;
  shippingAddress: string;
  notes?: string;
}
