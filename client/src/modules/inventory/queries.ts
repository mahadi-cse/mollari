import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { inventoryAPI, type InventorySummaryParams, type InventoryLedgerParams, type InventoryLedgerResponse } from './api';

export const INVENTORY_QUERY_KEYS = {
  all: ['inventory'] as const,
  summary: () => [...INVENTORY_QUERY_KEYS.all, 'summary'] as const,
  summaryWithParams: (params: InventorySummaryParams) =>
    [...INVENTORY_QUERY_KEYS.summary(), params] as const,
  details: () => [...INVENTORY_QUERY_KEYS.all, 'details'] as const,
  detail: (productId: number) => [...INVENTORY_QUERY_KEYS.details(), productId] as const,
  lowStock: () => [...INVENTORY_QUERY_KEYS.all, 'lowStock'] as const,
  history: (productId: number) => [...INVENTORY_QUERY_KEYS.all, 'history', productId] as const,
  reports: () => [...INVENTORY_QUERY_KEYS.all, 'reports'] as const,
  ledger: (params?: InventoryLedgerParams) => [...INVENTORY_QUERY_KEYS.all, 'ledger', params] as const,
};

export const useInventorySummary = (params?: InventorySummaryParams, options?: any) => {
  return useQuery({
    queryKey: INVENTORY_QUERY_KEYS.summaryWithParams(params || {}),
    queryFn: () => inventoryAPI.getInventorySummary(params),
    staleTime: 3 * 60 * 1000, // 3 minutes
    ...options,
  });
};

export const useProductStockDetails = (productId?: number, options?: any) => {
  return useQuery({
    queryKey: INVENTORY_QUERY_KEYS.detail(productId || 0),
    queryFn: () => inventoryAPI.getProductStockDetails(productId!),
    enabled: !!productId,
    staleTime: 3 * 60 * 1000, // 3 minutes
    ...options,
  });
};

export const useLowStockItems = (
  params?: { warehouseId?: number; page?: number; limit?: number },
  options?: any
) => {
  return useQuery({
    queryKey: [...INVENTORY_QUERY_KEYS.lowStock(), params],
    queryFn: () => inventoryAPI.getLowStockItems(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
};

export const useInventoryHistory = (
  productId?: number,
  params?: { page?: number; limit?: number; startDate?: string; endDate?: string; type?: string },
  options?: any
) => {
  return useQuery({
    queryKey: [...INVENTORY_QUERY_KEYS.history(productId || 0), params],
    queryFn: () => inventoryAPI.getInventoryHistory(productId!, params),
    enabled: !!productId,
    staleTime: 3 * 60 * 1000, // 3 minutes
    ...options,
  });
};

export const useInventoryReports = (
  params?: {
    reportType?: 'summary' | 'detailed' | 'valuation';
    startDate?: string;
    endDate?: string;
    warehouseId?: number;
  },
  options?: any
) => {
  return useQuery({
    queryKey: [...INVENTORY_QUERY_KEYS.reports(), params],
    queryFn: () => inventoryAPI.getInventoryReports(params),
    staleTime: 10 * 60 * 1000, // 10 minutes
    ...options,
  });
};

export const useInventoryLedger = (params?: InventoryLedgerParams, options?: any) => {
  return useQuery<InventoryLedgerResponse>({
    queryKey: INVENTORY_QUERY_KEYS.ledger(params),
    queryFn: () => inventoryAPI.getInventoryLedger(params),
    staleTime: 60 * 1000, // 1 minute
    ...options,
  });
};
