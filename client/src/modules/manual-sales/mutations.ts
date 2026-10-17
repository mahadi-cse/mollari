import { useMutation, useQueryClient } from '@tanstack/react-query';
import { manualSalesAPI, type CreateManualSaleRequest } from './api';
import { MANUAL_SALES_QUERY_KEYS } from './queries';
import { INVENTORY_QUERY_KEYS } from '@/modules/inventory';
import { ANALYTICS_QUERY_KEYS } from '@/modules/analytics';

export const useCreateManualSaleMutation = (options?: any) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateManualSaleRequest) => manualSalesAPI.createManualSale(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MANUAL_SALES_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: INVENTORY_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: ANALYTICS_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    ...options,
  });
};
