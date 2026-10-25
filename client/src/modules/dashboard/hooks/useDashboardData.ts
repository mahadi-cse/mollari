"use client";
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useDashboardLocale } from '../locales/DashboardLocaleContext';
import { useListOrders } from '@/modules/orders';
import { useInventorySummary, useLowStockItems } from '@/modules/inventory';
import { useListManualSales } from '@/modules/manual-sales';
import type { Product, SellLog, Order as DashboardOrder } from '../types';

export function useDashboardData() {
  const { status } = useSession();
  const { t } = useDashboardLocale();
  const [products, setProducts] = useState<Product[]>([]);
  const [sellLog, setSellLog] = useState<SellLog[]>([]);
  const [orders, setOrders] = useState<DashboardOrder[]>([]);
  const [time, setTime] = useState(new Date());

  const isAuthenticated = status === 'authenticated';

  const { data: ordersData, isLoading: ordersLoading } = useListOrders({ page: 1, limit: 20 }, { enabled: isAuthenticated });
  const { data: inventoryData, isLoading: inventoryLoading } = useInventorySummary({ page: 1, limit: 100 }, { enabled: isAuthenticated });
  const { data: lowStockData } = useLowStockItems({ page: 1, limit: 100 }, { enabled: isAuthenticated });
  const { data: manualSalesData, isLoading: manualSalesLoading } = useListManualSales({ page: 1, limit: 50 }, { enabled: isAuthenticated });

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const inventoryItems = (inventoryData as { data?: any[] } | undefined)?.data;
    const lowStockItems = (lowStockData as { data?: any[] } | undefined)?.data || [];
    const lowStockIds = new Set(lowStockItems.map((item: any) => item.productId));

    if (Array.isArray(inventoryItems) && !inventoryLoading) {
      const transformedProducts: Product[] = inventoryItems.map((item: any, index: number) => ({
        id: item.productId || item.product?.id || item.id || index,
        name: item.name || item.product?.name || t.unknownProduct,
        sku: item.sku || item.product?.sku || t.na,
        category: item.category || item.product?.category?.name || t.uncategorized,
        price: Number(item.price ?? item.product?.price ?? 0),
        stock: item.currentStock ?? item.quantity ?? item.availableQty ?? 0,
        warehouse: item.warehouse || t.na,
        sold: item.unitsSold || 0,
        manualSold: 0,
        sizes: item.sizes || item.product?.sizes || [],
        colors: item.colors || item.product?.colors || [],
        status: (item.currentStock ?? item.quantity ?? item.availableQty ?? 0) <= 0
          ? 'out'
          : lowStockIds.has(item.productId || item.product?.id) || (item.currentStock ?? item.quantity ?? item.availableQty ?? 0) <= (item.lowStockThreshold || 10)
            ? 'low'
            : 'active',
      }));
      setProducts(transformedProducts);
    }
  }, [inventoryData, lowStockData, inventoryLoading, t]);

  useEffect(() => {
    if (Array.isArray(manualSalesData) && !manualSalesLoading) {
      const transformedLog: SellLog[] = manualSalesData.slice(0, 50).map((sale: any, index: number) => {
        const firstItem = sale.items?.[0];
        const variantLabel = [firstItem?.colorName, firstItem?.sizeName].filter(Boolean).join(' / ');
        const itemDisplayName = firstItem?.productNameSnapshot
          ? (variantLabel ? `${firstItem.productNameSnapshot} (${variantLabel})` : firstItem.productNameSnapshot)
          : t.saleItem;
        return {
          id: sale.saleNumber || String(sale.id || index),
          product: sale.items?.length > 1
            ? `${itemDisplayName} +${sale.items.length - 1} ${t.more}`
            : itemDisplayName,
          qty: sale.totalQty || 0,
          amount: sale.totalAmount || 0,
          note: sale.note || `${t.manualSale} · ${sale.branchName || t.main}`,
          date: sale.createdAt ? new Date(sale.createdAt).toLocaleDateString() : new Date().toLocaleDateString(),
          by: sale.branchName ? `${sale.soldBy || t.staff} · ${sale.branchName}` : (sale.soldBy || t.staff),
        };
      });
      setSellLog(transformedLog);
    }
  }, [manualSalesData, manualSalesLoading, t]);

  useEffect(() => {
    if (Array.isArray(ordersData) && !ordersLoading) {
      const transformedOrders: DashboardOrder[] = ordersData.slice(0, 50).map((order: any) => ({
        id: order.orderNumber ? (order.orderNumber.startsWith('#') ? order.orderNumber : `#${order.orderNumber}`) : `#ORD-${order.id}`,
        customer: order.shippingName || t.customer,
        amount: order.total || 0,
        status: (['delivered', 'processing', 'shipped', 'pending'].includes(String(order.status || 'PENDING').toLowerCase())
          ? String(order.status || 'PENDING').toLowerCase()
          : 'pending') as DashboardOrder['status'],
        items: order.items?.length || 1,
        time: order.createdAt ? new Date(order.createdAt).toLocaleString() : t.now,
      }));
      setOrders(transformedOrders);
    }
  }, [ordersData, ordersLoading, t]);

  return {
    status,
    time,
    products,
    setProducts,
    sellLog,
    setSellLog,
    orders,
    setOrders
  };
}
