'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Theme, formatCurrency } from '@/modules/dashboard/utils/theme';
import { useResponsive } from '@/shared/hooks/useResponsive';
import { Card, Btn, Badge } from '@/shared/components/ui/Primitives';
import { useListOrders, useUpdateOrderStatusMutation, useEntrySteadfastMutation, useSyncSteadfastStatusMutation } from '@/modules/orders';
import { useSiteSettings } from '@/modules/homepage';
import toast from 'react-hot-toast';
import { Truck, Printer, ChevronDown, ChevronUp, CheckCircle2, RefreshCw, Copy, Phone, MapPin, ExternalLink } from 'lucide-react';
import { confirmDialog } from '@/shared/lib/confirmDialog';
import type { Order as RealOrder } from '@/modules/orders/types';
import { useDashboardLocale } from '@/modules/dashboard/locales/DashboardLocaleContext';

export type RealOrderStatus = 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED';

const STEADFAST_STEPS = [
  { key: 'entered', label: 'Entered' },
  { key: 'approved', label: 'Approved' },
  { key: 'rider', label: 'With a rider' },
  { key: 'delivered', label: 'Delivered' },
];

const getSteadfastStepIndex = (courierStatus?: string | null, steadfastEntry?: boolean, orderStatus?: string) => {
  const cs = (courierStatus || '').toLowerCase();
  const os = (orderStatus || '').toLowerCase();

  if (cs === 'delivered' || cs === 'partial_delivered' || os === 'delivered') return 3;
  if (cs.includes('rider') || cs.includes('out_for_delivery') || os === 'shipped') return 2;
  if (cs.includes('approved') || cs.includes('in_transit') || cs.includes('transit') || cs.includes('hub') || cs.includes('picked')) return 1;
  if (steadfastEntry || cs.includes('pending') || cs.includes('in_review') || cs.includes('entered') || cs.length > 0 || os === 'confirmed' || os === 'processing') return 0;
  return -1;
};

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
  products?: any[];
  orders?: any[];
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

  const { data: siteSettings } = useSiteSettings();

  // Real orders from API
  const { data: realOrdersData, isLoading: realOrdersLoading, refetch: refetchOrders } = useListOrders(
    { page: 1, limit: 100, ...(orderFilter !== 'all' ? { status: orderFilter.toUpperCase() } : {}) },
    { staleTime: 15 * 1000 }
  );
  const realOrders: RealOrder[] = Array.isArray(realOrdersData) ? realOrdersData : [];

  const updateStatusMutation = useUpdateOrderStatusMutation({
    onSuccess: () => { void refetchOrders(); },
  });

  const entrySteadfastMutation = useEntrySteadfastMutation({
    onSuccess: (data: any) => {
      toast.success(`Entered into Steadfast! CID #${data.consignmentId || data.trackingCode}`);
      void refetchOrders();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || err?.message || 'Failed to enter into Steadfast');
    },
  });

  const handleSteadfastEntry = async (orderId: number) => {
    try {
      await entrySteadfastMutation.mutateAsync(orderId);
    } catch {
      // handled in onError
    }
  };

  const syncSteadfastStatusMutation = useSyncSteadfastStatusMutation({
    onSuccess: (data: any) => {
      toast.success(`Steadfast status: ${data.liveStatus}`);
      void refetchOrders();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || err?.message || 'Failed to fetch Steadfast status');
    },
  });

  const handleSyncSteadfastStatus = async (orderId: number) => {
    try {
      await syncSteadfastStatusMutation.mutateAsync(orderId);
    } catch {
      // handled in onError
    }
  };

  const handleCopy = (text: string, label = 'Copied to clipboard') => {
    if (!text) return;
    void navigator.clipboard.writeText(text);
    toast.success(label);
  };

  const handlePrintOrder = (order: any) => {
    const store = {
      storeName: siteSettings?.storeName || 'Mollari',
      tagline: siteSettings?.tagline || 'Premium Quality Cosmetics & Skincare',
      address: siteSettings?.contactAddress || '',
      phone: siteSettings?.contactPhone || '',
    };

    const formattedDate = order.createdAt ? new Date(order.createdAt).toLocaleString() : 'N/A';
    const itemsHtml = (order.items || []).map((item: any) => `
      <tr>
        <td style="padding: 4px 0; font-size: 11px; font-family: monospace; line-height: 1.2;">
          ${item.productName || item.product?.name || 'Item'}
        </td>
        <td style="padding: 4px 0; text-align: center; font-size: 11px; font-family: monospace;">${item.quantity}</td>
        <td style="padding: 4px 0; text-align: right; font-size: 11px; font-family: monospace;">৳${item.unitPrice}</td>
        <td style="padding: 4px 0; text-align: right; font-size: 11px; font-family: monospace;">৳${item.totalPrice || (item.quantity * item.unitPrice)}</td>
      </tr>
    `).join('');

    const receiptHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${order.orderNumber || 'Invoice'}</title>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <style>
            @page { size: 80mm auto; margin: 0; }
            body { font-family: Arial, sans-serif; color: #000; margin: 10px; padding: 0; width: 70mm; }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .header { margin-bottom: 12px; border-bottom: 1px dashed #000; padding-bottom: 8px; }
            .title { font-size: 16px; font-weight: bold; }
            .subtitle { font-size: 10px; color: #555; }
            .info-table, .items-table, .totals-table { width: 100%; border-collapse: collapse; font-size: 10px; }
            .info-table td { padding: 2px 0; }
            .items-table { margin: 8px 0; border-top: 1px dashed #000; border-bottom: 1px dashed #000; }
            .items-table th { padding: 4px 0; font-size: 10px; font-weight: bold; border-bottom: 1px solid #ccc; }
            .totals-table td { padding: 2px 0; }
            .footer { border-top: 1px dashed #000; padding-top: 8px; margin-top: 8px; font-size: 9px; color: #333; }
          </style>
          <script>window.onload = function() { setTimeout(function() { window.print(); }, 150); };<\/script>
        </head>
        <body>
          <div class="header text-center">
            <div class="title">${store.storeName}</div>
            <div class="subtitle">${store.tagline}</div>
            ${store.address ? `<div class="subtitle">${store.address}</div>` : ''}
            ${store.phone ? `<div class="subtitle">${store.phone}</div>` : ''}
          </div>

          <table class="info-table">
            <tr>
              <td><strong>Order:</strong> #${order.orderNumber}</td>
              <td class="text-right"><strong>Date:</strong> ${formattedDate.split(',')[0]}</td>
            </tr>
            <tr>
              <td><strong>Customer:</strong> ${order.shippingName || 'N/A'}</td>
              <td class="text-right"><strong>Phone:</strong> ${order.shippingPhone || ''}</td>
            </tr>
            ${order.shippingAddress ? `
            <tr>
              <td colspan="2" style="font-size: 9px; padding-top: 2px;"><strong>Address:</strong> ${order.shippingAddress}</td>
            </tr>
            ` : ''}
            ${order.consignmentId ? `
            <tr>
              <td colspan="2" style="font-size: 9px; padding-top: 2px;"><strong>Steadfast CID:</strong> ${order.consignmentId}</td>
            </tr>
            ` : ''}
          </table>

          <table class="items-table">
            <thead>
              <tr>
                <th style="width: 45%; text-align: left;">Item</th>
                <th style="width: 15%; text-align: center;">Qty</th>
                <th style="width: 20%; text-align: right;">Price</th>
                <th style="width: 20%; text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <table class="totals-table">
            <tr style="font-size: 12px; font-weight: bold;">
              <td>Total Amount:</td>
              <td class="text-right">৳${order.total}</td>
            </tr>
            ${order.codAmount ? `
            <tr style="font-size: 11px;">
              <td>COD Collection:</td>
              <td class="text-right">৳${order.codAmount}</td>
            </tr>
            ` : ''}
          </table>

          <div class="footer text-center">
            <p style="margin: 0;">Thank you for shopping with us!</p>
          </div>
        </body>
      </html>
    `;

    try {
      const blob = new Blob([receiptHtml], { type: 'text/html;charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
    } catch {
      const pw = window.open('', '_blank');
      if (pw) {
        pw.document.open();
        pw.document.write(receiptHtml);
        pw.document.close();
      }
    }
  };

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
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3.5 hover:bg-gray-50/80 transition-colors"
                  >
                    <div
                      className="min-w-0 flex-1 cursor-pointer"
                      onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                    >
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
                          {order.shippingName || (order.customer ? `${order.customer.firstName || order.customer.user?.firstName || ''} ${order.customer.lastName || order.customer.user?.lastName || ''}`.trim() : 'N/A')}
                        </span>
                        <Badge label={localizedStatusLabel} bg={statusInfo.bg} color={statusInfo.color} />

                        {/* Steadfast Status Badge */}
                        {order.courierStatus ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                            <Truck className="w-3 h-3" />
                            <span>Steadfast: {order.courierStatus}</span>
                          </span>
                        ) : order.steadfastEntry ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Steadfast: In Review</span>
                          </span>
                        ) : null}
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
                        {order.shippingPhone && order.shippingPhone !== 'N/A' && (
                          <>
                            <span>·</span>
                            <span>📞 {order.shippingPhone}</span>
                          </>
                        )}
                        {order.consignmentId && (
                          <>
                            <span>·</span>
                            <span className="font-mono text-indigo-600 font-semibold">CID: {order.consignmentId}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Action buttons on row: Steadfast Entry/Sync + Print + Details */}
                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                      {order.consignmentId?.startsWith('SF-') ? (
                        <button
                          type="button"
                          disabled={entrySteadfastMutation.isPending && (entrySteadfastMutation.variables as any) === order.id}
                          onClick={() => handleSteadfastEntry(order.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-pink-600 hover:bg-pink-700 text-white shadow-sm transition disabled:opacity-50 cursor-pointer"
                          title="Click to book live parcel on Steadfast"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          <span>
                            {entrySteadfastMutation.isPending && (entrySteadfastMutation.variables as any) === order.id
                              ? 'Booking...'
                              : 'Book Live'}
                          </span>
                        </button>
                      ) : order.steadfastEntry || order.consignmentId ? (
                        <div className="flex items-center gap-1">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Entered</span>
                          </span>
                          <button
                            type="button"
                            disabled={syncSteadfastStatusMutation.isPending && (syncSteadfastStatusMutation.variables as any) === order.id}
                            onClick={() => handleSyncSteadfastStatus(order.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition cursor-pointer"
                            title="Check live delivery status from Steadfast"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${syncSteadfastStatusMutation.isPending && (syncSteadfastStatusMutation.variables as any) === order.id ? 'animate-spin' : ''}`} />
                            <span className="hidden lg:inline">Sync</span>
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={entrySteadfastMutation.isPending && (entrySteadfastMutation.variables as any) === order.id}
                          onClick={() => handleSteadfastEntry(order.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-pink-600 hover:bg-pink-700 text-white shadow-sm transition disabled:opacity-50 cursor-pointer"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          <span>
                            {entrySteadfastMutation.isPending && (entrySteadfastMutation.variables as any) === order.id
                              ? 'Sending...'
                              : 'Entry Steadfast'}
                          </span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handlePrintOrder(order)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 transition cursor-pointer"
                        title="Print Receipt"
                      >
                        <Printer className="w-3.5 h-3.5 text-zinc-600" />
                        <span className="hidden md:inline">Print</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 transition cursor-pointer"
                      >
                        <span>{isExpanded ? 'Collapse' : 'Details'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Expanded Detail */}
                  {isExpanded && (
                    <div className="px-4 pb-5 pt-3 border-t bg-zinc-50/60" style={{ borderColor: Theme.border }}>
                      <div className="space-y-4 w-full">
                        {/* Steadfast Top Parcel Header & Stepper Card */}
                        <div className="rounded-xl border bg-white p-4 shadow-xs" style={{ borderColor: Theme.border }}>
                          {/* Top Row: Status, Parcel #, COD / Delivery stats, Quick Actions */}
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-zinc-100">
                            {/* Left: Status & ID */}
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <span
                                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold"
                                style={{
                                  background:
                                    order.courierStatus?.toLowerCase() === 'delivered'
                                      ? '#dcfce7'
                                      : order.courierStatus?.toLowerCase() === 'cancelled'
                                      ? '#fee2e2'
                                      : order.steadfastEntry || order.consignmentId
                                      ? '#fef3c7'
                                      : '#f3f4f6',
                                  color:
                                    order.courierStatus?.toLowerCase() === 'delivered'
                                      ? '#166534'
                                      : order.courierStatus?.toLowerCase() === 'cancelled'
                                      ? '#b91c1c'
                                      : order.steadfastEntry || order.consignmentId
                                      ? '#92400e'
                                      : '#4b5563',
                                }}
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                <span className="capitalize">{order.courierStatus || (order.steadfastEntry ? 'Pending' : 'Not Entered')}</span>
                              </span>

                              <div className="flex items-center gap-1 font-mono font-bold text-base text-zinc-900">
                                <span>#{order.consignmentId || order.orderNumber}</span>
                                <button
                                  type="button"
                                  onClick={() => handleCopy(order.consignmentId || order.orderNumber, 'ID copied!')}
                                  className="p-1 rounded hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition"
                                  title="Copy ID"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              {(order.trackingCode || order.consignmentId) && (
                                <button
                                  type="button"
                                  onClick={() => handleCopy(`https://steadfast.com.bd/tracking/${order.trackingCode || order.consignmentId}`, 'Tracking link copied!')}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-zinc-200 hover:bg-zinc-50 text-[11px] font-semibold text-zinc-700 transition cursor-pointer"
                                >
                                  <ExternalLink className="w-3 h-3 text-zinc-500" />
                                  <span>Copy tracking link</span>
                                </button>
                              )}
                            </div>

                            {/* Right: COD pill, Delivery Charge pill, Action Buttons */}
                            <div className="flex items-center gap-2 flex-wrap md:flex-nowrap">
                              <div className="px-3 py-1 rounded-lg border border-zinc-200 bg-zinc-50/70 text-right">
                                <span className="text-[10px] uppercase font-bold text-zinc-500 block">COD</span>
                                <span className="font-bold text-xs text-zinc-900 block">৳{order.codAmount ?? order.total}</span>
                              </div>

                              <div className="px-3 py-1 rounded-lg border border-zinc-200 bg-zinc-50/70 text-right">
                                <span className="text-[10px] uppercase font-bold text-zinc-500 block">Total</span>
                                <span className="font-bold text-xs text-zinc-900 block">৳{order.total}</span>
                              </div>

                              {order.consignmentId?.startsWith('SF-') ? (
                                <button
                                  type="button"
                                  disabled={entrySteadfastMutation.isPending && (entrySteadfastMutation.variables as any) === order.id}
                                  onClick={() => handleSteadfastEntry(order.id)}
                                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-pink-600 hover:bg-pink-700 text-white shadow-xs transition disabled:opacity-50 cursor-pointer"
                                >
                                  {entrySteadfastMutation.isPending && (entrySteadfastMutation.variables as any) === order.id ? 'Booking...' : 'Book Live'}
                                </button>
                              ) : (order.steadfastEntry || order.consignmentId) ? (
                                <button
                                  type="button"
                                  disabled={syncSteadfastStatusMutation.isPending && (syncSteadfastStatusMutation.variables as any) === order.id}
                                  onClick={() => handleSyncSteadfastStatus(order.id)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition shadow-xs cursor-pointer"
                                >
                                  <RefreshCw className={`w-3.5 h-3.5 ${syncSteadfastStatusMutation.isPending && (syncSteadfastStatusMutation.variables as any) === order.id ? 'animate-spin' : ''}`} />
                                  <span>Sync Live</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={entrySteadfastMutation.isPending && (entrySteadfastMutation.variables as any) === order.id}
                                  onClick={() => handleSteadfastEntry(order.id)}
                                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-pink-600 hover:bg-pink-700 text-white shadow-xs transition disabled:opacity-50 cursor-pointer"
                                >
                                  {entrySteadfastMutation.isPending && (entrySteadfastMutation.variables as any) === order.id ? 'Sending...' : 'Entry Steadfast'}
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => handlePrintOrder(order)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-zinc-200 hover:bg-zinc-50 text-zinc-700 transition cursor-pointer"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                <span>Invoice</span>
                              </button>
                            </div>
                          </div>

                          {/* Steadfast Stepper */}
                          <div className="pt-4 pb-1">
                            <div className="flex items-center justify-between relative">
                              {STEADFAST_STEPS.map((step, idx) => {
                                const activeIdx = getSteadfastStepIndex(order.courierStatus, order.steadfastEntry, order.status);
                                const isDone = activeIdx >= idx;
                                const isActive = activeIdx === idx;
                                return (
                                  <React.Fragment key={step.key}>
                                    <div className="flex flex-col items-center flex-1 text-center z-10">
                                      <div
                                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-all ${
                                          isDone
                                            ? 'bg-emerald-600 text-white shadow-xs'
                                            : 'bg-zinc-100 text-zinc-400 border border-zinc-200'
                                        }`}
                                      >
                                        {isDone ? '✓' : idx + 1}
                                      </div>
                                      <span
                                        className={`mt-1.5 text-xs font-semibold ${
                                          isActive ? 'text-zinc-900 font-bold' : isDone ? 'text-zinc-700' : 'text-zinc-400'
                                        }`}
                                      >
                                        {step.label}
                                      </span>
                                    </div>
                                    {idx < STEADFAST_STEPS.length - 1 && (
                                      <div
                                        className={`h-[2px] flex-1 -mt-4 transition-all ${
                                          activeIdx > idx ? 'bg-emerald-500' : 'bg-zinc-200'
                                        }`}
                                      />
                                    )}
                                  </React.Fragment>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        {/* 2-Column Minimal Balanced Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 w-full">
                          {/* LEFT COLUMN: Recipient + Parcel details */}
                          <div className="space-y-4">
                            {/* Recipient Card */}
                            <div className="rounded-xl border bg-white p-4 shadow-xs space-y-3" style={{ borderColor: Theme.border }}>
                              <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Recipient</h4>
                              <div>
                                <div className="text-base font-bold text-zinc-900">{order.shippingName || 'N/A'}</div>
                                <div className="text-xs text-zinc-600 mt-1 leading-relaxed">
                                  {order.shippingAddress || 'No address provided'}
                                </div>
                                <div className="flex items-center gap-1 text-xs text-zinc-500 font-medium mt-1">
                                  <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                                  <span>{order.shippingCity || 'Bangladesh'}</span>
                                </div>
                              </div>

                              <div className="pt-2.5 border-t border-zinc-100 flex items-center justify-between flex-wrap gap-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs text-zinc-500">Phone:</span>
                                  <span className="font-mono font-bold text-zinc-900 text-xs">{order.shippingPhone || 'N/A'}</span>
                                </div>
                                {order.shippingPhone && order.shippingPhone !== 'N/A' && (
                                  <div className="flex items-center gap-1.5">
                                    <a
                                      href={`tel:${order.shippingPhone}`}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-zinc-200 bg-white hover:bg-zinc-50 text-xs font-semibold text-zinc-700 transition"
                                    >
                                      <Phone className="w-3 h-3 text-zinc-500" />
                                      <span>Call</span>
                                    </a>
                                    <button
                                      type="button"
                                      onClick={() => handleCopy(order.shippingPhone || '', 'Phone copied!')}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-zinc-200 bg-white hover:bg-zinc-50 text-xs font-semibold text-zinc-700 transition cursor-pointer"
                                    >
                                      <Copy className="w-3 h-3 text-zinc-500" />
                                      <span>Copy</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Parcel Details Card */}
                            <div className="rounded-xl border bg-white p-4 shadow-xs space-y-3" style={{ borderColor: Theme.border }}>
                              <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Parcel Details</h4>
                              <div className="grid grid-cols-2 gap-3 text-xs">
                                <div>
                                  <span className="text-zinc-500 block text-[11px]">Tracking Code</span>
                                  <span className="font-mono font-bold text-indigo-700 block mt-0.5">{order.trackingCode || '—'}</span>
                                </div>
                                <div>
                                  <span className="text-zinc-500 block text-[11px]">Consignment ID</span>
                                  <span className="font-mono font-bold text-zinc-900 block mt-0.5">{order.consignmentId || '—'}</span>
                                </div>
                                <div>
                                  <span className="text-zinc-500 block text-[11px]">Channel</span>
                                  <span className="font-semibold text-zinc-800 block mt-0.5">{isSaleChannel ? 'Manual Sale' : 'Online Store'}</span>
                                </div>
                                <div>
                                  <span className="text-zinc-500 block text-[11px]">Items in Order</span>
                                  <span className="font-semibold text-zinc-800 block mt-0.5">{order.items?.length || 1}</span>
                                </div>
                                <div>
                                  <span className="text-zinc-500 block text-[11px]">Created</span>
                                  <span className="text-zinc-700 block mt-0.5">
                                    {order.createdAt
                                      ? new Date(order.createdAt).toLocaleDateString('en-BD', {
                                          day: '2-digit',
                                          month: 'short',
                                          year: 'numeric',
                                        })
                                      : '—'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-zinc-500 block text-[11px]">Steadfast Status</span>
                                  <span className="font-bold text-emerald-700 capitalize block mt-0.5">
                                    {order.courierStatus || (order.steadfastEntry ? 'In Review' : 'Pending Entry')}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* RIGHT COLUMN: Contents & Notes + Tracking Updates */}
                          <div className="space-y-4">
                            {/* Contents & Note Card */}
                            <div className="rounded-xl border bg-white p-4 shadow-xs space-y-3" style={{ borderColor: Theme.border }}>
                              <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Contents & Note</h4>

                              <div className="text-xs p-2.5 rounded-lg bg-zinc-50 border border-zinc-100 text-zinc-700">
                                <div className="text-[10px] uppercase font-bold text-zinc-400 mb-0.5">Note for delivery</div>
                                <div>{order.notes || '—'}</div>
                              </div>

                              <div className="space-y-2 pt-1">
                                <div className="text-[10px] uppercase font-bold text-zinc-400">Order Items ({order.items?.length || 0})</div>
                                <div className="divide-y divide-zinc-100 rounded-lg border border-zinc-100 overflow-hidden bg-white">
                                  {(order.items || []).map((item: any) => (
                                    <div key={item.id} className="flex justify-between items-center px-3 py-2 text-xs">
                                      <div>
                                        <span className="font-medium text-zinc-900">{item.productName || item.product?.name || 'Item'}</span>
                                        <span className="text-zinc-400 ml-2">x{item.quantity}</span>
                                      </div>
                                      <div className="font-bold text-zinc-900">
                                        ৳{Number(item.totalPrice || item.price || (item.unitPrice * item.quantity) || 0)}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>

                            {/* Tracking Updates Timeline Card */}
                            <div className="rounded-xl border bg-white p-4 shadow-xs space-y-3" style={{ borderColor: Theme.border }}>
                              <div className="flex items-center justify-between">
                                <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Tracking Updates</h4>
                                {(order.steadfastEntry || order.consignmentId) && (
                                  <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                                    Webhook Active
                                  </span>
                                )}
                              </div>

                              {order.trackingEvents && order.trackingEvents.length > 0 ? (
                                <div className="relative pl-6 space-y-3 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[2px] before:bg-zinc-200">
                                  {order.trackingEvents.map((event, idx) => (
                                    <div key={event.id} className="relative">
                                      <span
                                        className={`absolute -left-6 top-1 w-3.5 h-3.5 rounded-full border-2 ${
                                          idx === 0 ? 'bg-emerald-500 border-emerald-200' : 'bg-white border-zinc-300'
                                        }`}
                                      />
                                      <div className="text-xs font-bold text-zinc-900">{event.title}</div>
                                      <div className="text-[11px] text-zinc-400 mt-0.5">
                                        {new Date(event.createdAt).toLocaleString('en-BD', {
                                          day: '2-digit',
                                          month: 'short',
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        })}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-xs text-zinc-500 py-3 text-center border border-dashed border-zinc-200 rounded-lg">
                                  {order.steadfastEntry || order.consignmentId
                                    ? 'Parcel registered. Live courier tracking updates will appear here automatically via webhook.'
                                    : 'Parcel not entered into courier yet.'}
                                </div>
                              )}
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
