'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Theme, formatCurrency } from '@/modules/dashboard/utils/theme';
import { useResponsive } from '@/shared/hooks/useResponsive';
import { Card, Btn, Badge } from '@/shared/components/ui/Primitives';
import type { Product, Order } from '@/modules/dashboard/types';
import { useListOrders, useUpdateOrderStatusMutation } from '@/modules/orders';
import { confirmDialog } from '@/shared/lib/confirmDialog';
import type { Order as RealOrder } from '@/modules/orders/types';
import { useDashboardLocale } from '@/modules/dashboard/locales/DashboardLocaleContext';

export type RealOrderStatus = 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED';

const statusDisplayMap: Record<string, { labelKey: string; defaultLabel: string; bg: string; color: string }> = {
  PENDING:    { labelKey: 'placed',     defaultLabel: 'Placed',    bg: '#fef3c7', color: '#b45309' },
  CONFIRMED:  { labelKey: 'confirmed',  defaultLabel: 'Confirmed', bg: '#f0f9ff', color: '#0369a1' },
  PROCESSING: { labelKey: 'processing', defaultLabel: 'Processing',bg: '#fff7ed', color: '#c2410c' },
  SHIPPED:    { labelKey: 'shipped',    defaultLabel: 'Shipped',   bg: '#dbeafe', color: '#1e40af' },
  DELIVERED:  { labelKey: 'delivered',  defaultLabel: 'Delivered', bg: '#dcfce7', color: '#166534' },
  CANCELLED:  { labelKey: 'cancelled',  defaultLabel: 'Cancelled', bg: '#fee2e2', color: '#b91c1c' },
  REFUNDED:   { labelKey: 'refunded',   defaultLabel: 'Refunded',  bg: '#fdf4ff', color: '#86198f' },
};

const getStatusStyle = (status: string) => {
  const upper = (status || 'PENDING').toUpperCase();
  return statusDisplayMap[upper] || { labelKey: 'pending', defaultLabel: status, bg: '#f3f4f6', color: '#4b5563' };
};

interface OrdersViewProps {
  products?: Product[];
  orders?: Order[];
}

type OrderFilter = 'all' | 'pending' | 'shipped' | 'delivered' | 'cancelled';

export default function OrdersView({ products, orders }: OrdersViewProps) {
  const router = useRouter();
  const { isMobile } = useResponsive();
  const { t } = useDashboardLocale();

  const [orderSearch, setOrderSearch] = useState('');
  const [orderFilter, setOrderFilter] = useState<OrderFilter>('all');
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
  const [pendingStatus, setPendingStatus] = useState<Record<number, RealOrderStatus>>({});

  // Real orders from API
  const { data: realOrdersData, isLoading: realOrdersLoading, refetch: refetchOrders } = useListOrders(
    { page: 1, limit: 100, ...(orderFilter !== 'all' ? { status: orderFilter.toUpperCase() } : {}) },
    { staleTime: 15 * 1000 }
  );
  const realOrders: RealOrder[] = Array.isArray(realOrdersData) ? realOrdersData : [];

  const updateStatusMutation = useUpdateOrderStatusMutation({
    onSuccess: () => { void refetchOrders(); },
  });

  const STEPS = [
    { status: 'PENDING',   label: (t as any).orders?.placed || (t as any).ecommerce?.placed || 'Placed',    icon: '🛒' },
    { status: 'SHIPPED',   label: (t as any).orders?.shipped || (t as any).ecommerce?.shipped || 'Shipped',  icon: '🚚' },
    { status: 'DELIVERED', label: (t as any).orders?.delivered || (t as any).ecommerce?.delivered || 'Delivered', icon: '📦' },
  ];

  const getStepState = (stepStatus: string, currentStatus: string): 'done' | 'active' | 'upcoming' => {
    const upper = (currentStatus || 'PENDING').toUpperCase();
    if (upper === 'CANCELLED' || upper === 'REFUNDED') return 'upcoming';

    const orderRanks: Record<string, number> = {
      PENDING: 1,
      CONFIRMED: 1,
      PROCESSING: 1,
      SHIPPED: 2,
      DELIVERED: 3,
    };

    const stepRank = orderRanks[stepStatus] ?? 0;
    const currentRank = orderRanks[upper] ?? 0;

    if (currentRank > stepRank) return 'done';
    if (currentRank === stepRank) return 'active';
    return 'upcoming';
  };

  const filteredOrders = realOrders.filter((o) => {
    const term = orderSearch.trim().toLowerCase();
    if (!term) return true;
    return (
      (o.orderNumber || '').toLowerCase().includes(term) ||
      (o.shippingName || '').toLowerCase().includes(term) ||
      (o.shippingPhone || '').toLowerCase().includes(term) ||
      (o.items || []).some((item: any) =>
        (item.productName || item.product?.name || '').toLowerCase().includes(term)
      )
    );
  });

  const placedCount = realOrders.filter((o) => String(o.status).toUpperCase() === 'PENDING').length;
  const shippedCount = realOrders.filter((o) => String(o.status).toUpperCase() === 'SHIPPED').length;
  const deliveredCount = realOrders.filter((o) => String(o.status).toUpperCase() === 'DELIVERED').length;
  const totalAmount = realOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
  const avgValue = realOrders.length > 0 ? totalAmount / realOrders.length : 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Stat cards row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5 2xl:gap-4">
        {[
          { label: (t as any).orders?.totalOrders || (t as any).ecommerce?.totalOrders || 'Total Orders', value: realOrders.length, icon: '📦', accent: '#f0f4ff', numColor: Theme.fg },
          { label: (t as any).orders?.placed || (t as any).ecommerce?.placed || 'Placed', value: placedCount, icon: '🛒', accent: '#fffbeb', numColor: '#b45309' },
          { label: (t as any).orders?.shipped || (t as any).ecommerce?.shipped || 'Shipped', value: shippedCount, icon: '🚚', accent: '#eff6ff', numColor: '#1d4ed8' },
          { label: (t as any).orders?.delivered || (t as any).ecommerce?.delivered || 'Delivered', value: deliveredCount, icon: '✅', accent: '#f0fdf4', numColor: '#15803d' },
          { label: (t as any).orders?.avgValue || (t as any).ecommerce?.avgValue || 'Avg. Value', value: formatCurrency(avgValue), icon: '💳', accent: '#fdf2f8', numColor: Theme.primary },
        ].map((stat) => (
          <div
            key={stat.label}
            className="flex items-center gap-3 rounded-xl border px-4 py-3 shadow-sm transition-all"
            style={{ borderColor: Theme.border, background: stat.accent }}
          >
            <span className="text-2xl leading-none">{stat.icon}</span>
            <div className="min-w-0">
              <div className="text-[20px] font-black leading-tight tracking-tight" style={{ color: stat.numColor }}>
                {stat.value}
              </div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.06em] leading-tight" style={{ color: Theme.mutedFg }}>
                {stat.label}
              </div>
            </div>
          </div>
        ))}
      </div>

      <Card pad={0}>
        {/* Controls Header */}
        <div
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b px-[18px] py-[14px]"
          style={{ borderBottomColor: Theme.border }}
        >
          <div>
            <div className="text-[15px] font-bold" style={{ color: Theme.fg }}>
              {(t as any).orders?.allOrders || (t as any).ecommerce?.allOrders || 'All Orders'}
            </div>
            <div className="mt-0.5 text-[11px]" style={{ color: Theme.mutedFg }}>
              {filteredOrders.length} of {realOrders.length} orders shown
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <input
              value={orderSearch}
              onChange={(e) => setOrderSearch(e.target.value)}
              placeholder={(t as any).orders?.searchPlaceholder || 'Search order #, customer, branch...'}
              className="flex-1 sm:flex-initial sm:w-[240px] rounded-lg border px-3 py-1.5 text-xs outline-none"
              style={{ borderColor: Theme.border, color: Theme.fg }}
            />
            <select
              value={orderFilter}
              onChange={(e) => setOrderFilter(e.target.value as OrderFilter)}
              className="rounded-lg border px-2.5 py-1.5 text-xs outline-none cursor-pointer"
              style={{ borderColor: Theme.border, color: Theme.fg, background: '#fff' }}
            >
              <option value="all">{(t as any).orders?.allStatus || (t as any).ecommerce?.allStatus || 'All Status'}</option>
              <option value="pending">{(t as any).orders?.placed || (t as any).ecommerce?.placed || 'Placed'}</option>
              <option value="shipped">{(t as any).orders?.shipped || (t as any).ecommerce?.shipped || 'Shipped'}</option>
              <option value="delivered">{(t as any).orders?.delivered || (t as any).ecommerce?.delivered || 'Delivered'}</option>
              <option value="cancelled">{(t as any).orders?.cancelled || (t as any).ecommerce?.cancelled || 'Cancelled'}</option>
            </select>
            <Btn variant="ghost" size="sm" onClick={() => void refetchOrders()}>
              ↻ {(t as any).orders?.refresh || (t as any).ecommerce?.refresh || 'Refresh'}
            </Btn>
          </div>
        </div>

        {/* Orders list */}
        {realOrdersLoading ? (
          <div className="px-4 py-12 text-center text-sm" style={{ color: Theme.mutedFg }}>
            {(t as any).orders?.loadingOrders || (t as any).ecommerce?.loadingOrders || 'Loading orders...'}
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: Theme.border }}>
            {filteredOrders.length === 0 && (
              <div className="px-4 py-12 text-center text-sm" style={{ color: Theme.mutedFg }}>
                {(t as any).orders?.noOrdersFound || (t as any).ecommerce?.noOrdersFound || 'No orders found.'}
              </div>
            )}
            {filteredOrders.map((order) => {
              const currentStatus = (String(order.status || 'PENDING')).toUpperCase() as RealOrderStatus;
              const statusInfo = getStatusStyle(currentStatus);
              const isExpanded = expandedOrderId === order.id;
              const selected = pendingStatus[order.id] ?? currentStatus;
              const isSaving = updateStatusMutation.isPending && (updateStatusMutation.variables as any)?.orderId === order.id;
              const isSaleChannel = (order as any).channel === 'POS';

              const localizedStatusLabel =
                (t as any).orders?.[statusInfo.labelKey] ||
                (t as any).ecommerce?.[statusInfo.labelKey] ||
                statusInfo.defaultLabel;

              return (
                <div key={order.id} className="transition-colors hover:bg-gray-50/50">
                  {/* Collapsed row */}
                  <div
                    className="flex items-center gap-3 px-4 py-3.5 cursor-pointer"
                    onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-bold" style={{ color: Theme.primary }}>
                          #{order.orderNumber}
                        </span>
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                          style={{
                            background: isSaleChannel ? '#ede9fe' : '#e0f2fe',
                            color: isSaleChannel ? '#6d28d9' : '#0369a1',
                          }}
                        >
                          {isSaleChannel ? 'Sale' : 'Online'}
                        </span>
                        <span className="text-[13px] font-semibold" style={{ color: Theme.fg }}>
                          {order.shippingName || (order.customer ? `${order.customer.firstName || ''} ${order.customer.lastName || ''}`.trim() : 'N/A')}
                        </span>
                        <Badge label={localizedStatusLabel} bg={statusInfo.bg} color={statusInfo.color} />
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[11px] flex-wrap" style={{ color: Theme.mutedFg }}>
                        <span>
                          {order.items?.length ?? 0} {order.items?.length === 1 ? 'item' : 'items'}
                        </span>
                        <span>·</span>
                        <span className="font-semibold" style={{ color: Theme.fg }}>
                          {formatCurrency(Number(order.total || 0))}
                        </span>
                        <span>·</span>
                        <span>
                          {order.createdAt
                            ? new Date(order.createdAt).toLocaleDateString('en-BD', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'N/A'}
                        </span>
                      </div>
                    </div>
                    <span
                      style={{
                        color: Theme.mutedFg,
                        fontSize: 13,
                        transition: 'transform 0.2s',
                        transform: isExpanded ? 'rotate(90deg)' : 'none',
                      }}
                    >
                      ▶
                    </span>
                  </div>

                  {/* Expanded Detail */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-2 border-t" style={{ background: Theme.muted, borderColor: Theme.border }}>
                      <div className={`flex gap-4 ${isMobile ? 'flex-col' : ''}`}>
                        {/* Left: Status Stepper & Info */}
                        <div className="flex-1 min-w-0">
                          {/* 3-Step Progress Stepper: Placed -> Shipped -> Delivered */}
                          {currentStatus !== 'CANCELLED' && currentStatus !== 'REFUNDED' ? (
                            <div className="mb-3 rounded-lg border bg-white p-3" style={{ borderColor: Theme.border }}>
                              <div className="flex items-center justify-between gap-1">
                                {STEPS.map((step, idx) => {
                                  const state = getStepState(step.status, currentStatus);
                                  return (
                                    <React.Fragment key={step.status}>
                                      <div className="flex flex-col items-center flex-1" style={{ minWidth: 60 }}>
                                        <div
                                          className="flex h-7 w-7 items-center justify-center rounded-full text-xs shadow-sm transition-all"
                                          style={{
                                            background: state !== 'upcoming' ? Theme.primary : '#f3f4f6',
                                            color: state !== 'upcoming' ? '#fff' : Theme.mutedFg,
                                            fontWeight: 700,
                                            boxShadow: state === 'active' ? `0 0 0 3px ${Theme.primary}33` : 'none',
                                          }}
                                        >
                                          {state === 'done' ? '✓' : step.icon}
                                        </div>
                                        <p
                                          className="mt-1 text-[10px] font-bold text-center leading-tight"
                                          style={{ color: state !== 'upcoming' ? Theme.fg : Theme.mutedFg }}
                                        >
                                          {step.label}
                                        </p>
                                      </div>
                                      {idx < STEPS.length - 1 && (
                                        <div
                                          className="h-[2px] flex-1 mx-1 -mt-4 transition-all"
                                          style={{
                                            background:
                                              getStepState(STEPS[idx + 1].status, currentStatus) !== 'upcoming'
                                                ? Theme.primary
                                                : '#e5e7eb',
                                          }}
                                        />
                                      )}
                                    </React.Fragment>
                                  );
                                })}
                              </div>
                            </div>
                          ) : (
                            <div className="mb-3 rounded-lg border px-3 py-2 text-xs font-semibold" style={{ background: '#fef2f2', borderColor: '#fca5a5', color: '#b91c1c' }}>
                              ⚠️ Order {currentStatus.toLowerCase()}
                            </div>
                          )}

                          {/* Order Details Grid */}
                          <div className="rounded-lg border bg-white p-3 text-[11px] space-y-2" style={{ borderColor: Theme.border }}>
                            <div className="flex flex-wrap gap-x-4 gap-y-1" style={{ color: Theme.mutedFg }}>
                              <span>📍 <strong className="text-gray-800">{order.shippingName}</strong>, {order.shippingAddress || ''} {order.shippingCity ? `(${order.shippingCity})` : ''}</span>
                              {order.shippingPhone && <span>📞 {order.shippingPhone}</span>}
                              {(order.customer as any)?.user?.email && (
                                <span>✉️ {(order.customer as any).user.email}</span>
                              )}
                            </div>

                            {order.notes && (
                              <div className="text-[10px] rounded p-1.5 bg-gray-50 text-gray-600 border border-gray-100">
                                📝 {order.notes}
                              </div>
                            )}

                            {/* Items list */}
                            <div className="border-t pt-2 space-y-1" style={{ borderColor: Theme.border }}>
                              <div className="font-semibold text-gray-700 text-[10px] uppercase tracking-wider">Order Items</div>
                              {(order.items || []).map((item: any) => (
                                <div key={item.id} className="flex justify-between items-center text-[11px]">
                                  <span className="font-medium text-gray-800">
                                    {item.productName || item.product?.name || 'Item'}
                                    <span className="text-gray-400 ml-1.5 font-normal">×{item.quantity}</span>
                                  </span>
                                  <span className="font-semibold text-gray-700">
                                    {formatCurrency(Number(item.totalPrice || item.price || (item.unitPrice * item.quantity) || 0))}
                                  </span>
                                </div>
                              ))}
                            </div>

                            {/* Timeline pills */}
                            {order.trackingEvents && order.trackingEvents.length > 0 && (
                              <div className="border-t pt-2 space-y-1" style={{ borderColor: Theme.border }}>
                                <div className="font-semibold text-gray-700 text-[10px] uppercase tracking-wider">Tracking History</div>
                                <div className="flex flex-wrap gap-1.5">
                                  {order.trackingEvents.map((event) => (
                                    <span
                                      key={event.id}
                                      className="rounded bg-gray-50 border px-2 py-0.5 text-[10px] text-gray-600"
                                      style={{ borderColor: Theme.border }}
                                    >
                                      <strong>{event.title}</strong>{' '}
                                      <span className="opacity-60 text-[9px]">
                                        ({new Date(event.createdAt).toLocaleString('en-BD', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })})
                                      </span>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Right: Total Amount & Status Updater */}
                        <div className="flex flex-col sm:items-end justify-between gap-3 shrink-0 rounded-lg border bg-white p-3.5 sm:min-w-[220px]" style={{ borderColor: Theme.border }}>
                          <div>
                            <div className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold sm:text-right">Total Amount</div>
                            <div className="text-xl font-black sm:text-right" style={{ color: Theme.primary }}>
                              {formatCurrency(Number(order.total || 0))}
                            </div>
                          </div>

                          {/* Status Updater */}
                          <div className="w-full space-y-1.5 border-t pt-2.5" style={{ borderColor: Theme.border }}>
                            <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 block">
                              {(t as any).orders?.updateStatus || 'Update Status'}
                            </label>
                            <div className="flex items-center gap-1.5">
                              <select
                                value={selected}
                                onChange={(e) => setPendingStatus((prev) => ({ ...prev, [order.id]: e.target.value as RealOrderStatus }))}
                                className="flex-1 rounded border px-2 py-1.5 text-xs outline-none bg-white font-medium cursor-pointer"
                                style={{ borderColor: Theme.border, color: Theme.fg }}
                                disabled={isSaving}
                              >
                                <option value="PENDING">{(t as any).orders?.placed || (t as any).ecommerce?.placed || 'Placed'}</option>
                                <option value="SHIPPED">{(t as any).orders?.shipped || (t as any).ecommerce?.shipped || 'Shipped'}</option>
                                <option value="DELIVERED">{(t as any).orders?.delivered || (t as any).ecommerce?.delivered || 'Delivered'}</option>
                                <option value="CANCELLED">{(t as any).orders?.cancelled || (t as any).ecommerce?.cancelled || 'Cancelled'}</option>
                                {currentStatus === 'CONFIRMED' && <option value="CONFIRMED">Confirmed</option>}
                                {currentStatus === 'PROCESSING' && <option value="PROCESSING">Processing</option>}
                              </select>
                              <Btn
                                variant="primary"
                                size="sm"
                                onClick={async () => {
                                  if (selected === currentStatus) return;
                                  const targetDisplay = getStatusStyle(selected).defaultLabel;
                                  const confirmed = await confirmDialog({
                                    title: (t as any).orders?.statusConfirmTitle || (t as any).ecommerce?.updateOrderStatus || 'Update Order Status?',
                                    text: `Change order #${order.orderNumber} status to ${targetDisplay}?`,
                                    confirmButtonText: (t as any).orders?.update || (t as any).ecommerce?.update || 'Update',
                                    icon: 'question',
                                  });
                                  if (confirmed) {
                                    updateStatusMutation.mutate({ orderId: order.id, data: { status: selected } });
                                  }
                                }}
                                disabled={selected === currentStatus || isSaving}
                              >
                                {isSaving ? '...' : (t as any).orders?.update || (t as any).ecommerce?.update || 'Update'}
                              </Btn>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
