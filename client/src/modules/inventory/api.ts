import apiClient from '@/shared/lib/apiClient';
import type { PaginatedResponse, ApiResponse } from '@/shared/types';
import type { Inventory, InventoryTransaction } from './types';

export interface InventorySummaryParams {
  page?: number;
  limit?: number;
  warehouseId?: number;
  lowStockOnly?: boolean;
}

export interface AdjustStockRequest {
  productId: number;
  quantity: number;
  type: 'ADJUSTMENT' | 'PURCHASE' | 'RETURN' | 'SALE' | 'POS_SALE';
  reason?: string;
  reference?: string;
  notes?: string;
  warehouseId?: number;
  batchName?: string;
  manufactureDate?: string;
  expiryDate?: string;
  sizeName?: string;
  sizes?: Array<{ name: string; quantity: number }>;
}

export interface TransferStockRequest {
  productId: number;
  quantity: number;
  fromWarehouseId?: number;
  toWarehouseId: number;
  notes?: string;
}

export interface InventoryLedgerEntry {
  id: number;
  inventoryId: number;
  productId: number;
  productName: string;
  productSku: string;
  unitLabel?: string | null;
  branchId: number | null;
  branchName: string;
  type: string;
  quantity: number;
  balanceBefore: number;
  balanceAfter: number;
  reference?: string | null;
  notes?: string | null;
  batchName?: string | null;
  manufactureDate?: string | null;
  expiryDate?: string | null;
  sizeName?: string | null;
  performedBy?: string | null;
  createdAt: string;
}

export interface InventoryLedgerSummary {
  totalIn: number;
  totalOut: number;
  netChange: number;
  totalTransactions: number;
}

export interface InventoryLedgerParams {
  page?: number;
  limit?: number;
  warehouseId?: number;
  productId?: number;
  type?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

export interface InventoryLedgerResponse {
  success: boolean;
  data: InventoryLedgerEntry[];
  summary: InventoryLedgerSummary;
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const inventoryAPI = {
  getInventorySummary: async (params?: InventorySummaryParams) => {
    const response = await apiClient.get<PaginatedResponse<Inventory[]>>('/inventory', {
      params: {
        page: params?.page || 1,
        limit: params?.limit || 10,
        ...(params?.warehouseId && { warehouseId: params.warehouseId }),
        ...(params?.lowStockOnly && { lowStockOnly: 'true' }),
      },
    });
    return response.data;
  },

  getProductStockDetails: async (productId: number) => {
    const response = await apiClient.get<ApiResponse<any>>(`/inventory/${productId}`);
    return response.data.data;
  },

  adjustStock: async (data: AdjustStockRequest) => {
    const response = await apiClient.post<ApiResponse<InventoryTransaction>>('/inventory/adjust', data);
    return response.data.data;
  },

  transferStock: async (data: TransferStockRequest) => {
    const response = await apiClient.post<ApiResponse<any>>('/inventory/transfer', data);
    return response.data.data;
  },

  getLowStockItems: async (params?: { warehouseId?: number; page?: number; limit?: number }) => {
    const response = await apiClient.get<PaginatedResponse<any>>('/inventory/low-stock', {
      params: {
        page: params?.page || 1,
        limit: params?.limit || 10,
        ...(params?.warehouseId && { warehouseId: params.warehouseId }),
      },
    });
    return response.data;
  },

  getInventoryHistory: async (
    productId: number,
    params?: { page?: number; limit?: number; startDate?: string; endDate?: string; type?: string }
  ) => {
    const response = await apiClient.get<PaginatedResponse<InventoryTransaction[]>>(
      `/inventory/${productId}/history`,
      {
        params: {
          page: params?.page || 1,
          limit: params?.limit || 10,
          ...(params?.startDate && { startDate: params.startDate }),
          ...(params?.endDate && { endDate: params.endDate }),
          ...(params?.type && { type: params.type }),
        },
      }
    );
    return response.data;
  },

  reconcileStock: async (data: {
    warehouseId: number;
    items: Array<{ productId: number; physicalCount: number }>;
    notes?: string;
  }) => {
    const response = await apiClient.post<ApiResponse<any>>('/inventory/reconcile', data);
    return response.data.data;
  },

  getInventoryReports: async (params?: {
    reportType?: 'summary' | 'detailed' | 'valuation';
    startDate?: string;
    endDate?: string;
    warehouseId?: number;
  }) => {
    const response = await apiClient.get<ApiResponse<any>>('/inventory/reports', {
      params,
    });
    return response.data.data;
  },

  getInventoryLedger: async (params?: InventoryLedgerParams): Promise<InventoryLedgerResponse> => {
    const response = await apiClient.get<InventoryLedgerResponse>('/inventory/ledger', {
      params,
    });
    return response.data;
  },
};
