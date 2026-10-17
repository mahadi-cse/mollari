import { useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryAPI, type AdjustStockRequest, type TransferStockRequest } from './api';
import { INVENTORY_QUERY_KEYS } from './queries';

export const useAdjustStockMutation = (options?: any) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AdjustStockRequest) => inventoryAPI.adjustStock(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: INVENTORY_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    ...options,
  });
};

export const useTransferStockMutation = (options?: any) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: TransferStockRequest) => inventoryAPI.transferStock(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: INVENTORY_QUERY_KEYS.all });
    },
    ...options,
  });
};

export const useReconcileStockMutation = (options?: any) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      warehouseId: number;
      items: Array<{ productId: number; physicalCount: number }>;
      notes?: string;
    }) => inventoryAPI.reconcileStock(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: INVENTORY_QUERY_KEYS.all });
    },
    ...options,
  });
};
