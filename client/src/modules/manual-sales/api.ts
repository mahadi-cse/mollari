import apiClient from '@/shared/lib/apiClient';
import type { ApiResponse, PaginatedResponse } from '@/shared/types';

export interface ManualSaleItemPayload {
  productId: number;
  quantity: number;
  unitPrice?: number;
  sizeName?: string;
  colorName?: string;
}

export interface CreateManualSaleRequest {
  soldBy?: string;
  note?: string;
  branchId?: number;
  branchName?: string;
  recipientName?: string;
  recipientPhone?: string;
  recipientAddress?: string;
  codAmount?: number;
  consignmentId?: string;
  trackingCode?: string;
  courierStatus?: string;
  items: ManualSaleItemPayload[];
}

export interface ManualSaleItemResponse {
  id: number;
  productId: number;
  productNameSnapshot: string;
  productSkuSnapshot: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  sizeName?: string | null;
  colorName?: string | null;
}

export interface ManualSaleResponse {
  id: number;
  saleNumber: string;
  totalQty: number;
  totalAmount: number;
  branchId?: number;
  branchName?: string;
  soldBy?: string;
  note?: string;
  recipientName?: string | null;
  recipientPhone?: string | null;
  recipientAddress?: string | null;
  codAmount?: number | null;
  consignmentId?: string | null;
  trackingCode?: string | null;
  courierStatus?: string | null;
  createdAt: string;
  items: ManualSaleItemResponse[];
}

export interface ListManualSalesParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: 'createdAt' | 'totalAmount' | 'totalQty' | 'saleNumber';
  sortOrder?: 'asc' | 'desc';
}

export const manualSalesAPI = {
  listManualSales: async (params?: ListManualSalesParams) => {
    const response = await apiClient.get<any>('/manual-sales', {
      params: {
        page: params?.page || 1,
        limit: params?.limit || 20,
        ...(params?.search ? { search: params.search } : {}),
        ...(params?.sortBy ? { sortBy: params.sortBy } : {}),
        ...(params?.sortOrder ? { sortOrder: params.sortOrder } : {}),
      },
    });
    const payload = response.data;
    return {
      success: payload?.success ?? true,
      data: payload?.data ?? [],
      pagination: {
        page: payload?.meta?.page ?? 1,
        limit: payload?.meta?.limit ?? 20,
        total: payload?.meta?.total ?? 0,
        pages: payload?.meta?.totalPages ?? 1,
      },
      message: payload?.message,
    } as PaginatedResponse<ManualSaleResponse>;
  },

  createManualSale: async (data: CreateManualSaleRequest) => {
    const response = await apiClient.post<ApiResponse<ManualSaleResponse>>('/manual-sales', data);
    return response.data.data;
  },
};
