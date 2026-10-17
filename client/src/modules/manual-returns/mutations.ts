import { useMutation, useQueryClient } from '@tanstack/react-query';
import { manualReturnsAPI, type CreateManualReturnRequest } from './api';
import { MANUAL_RETURNS_QUERY_KEYS } from './queries';
import { INVENTORY_QUERY_KEYS } from '@/modules/inventory';

export const useCreateManualReturnMutation = (options?: any) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateManualReturnRequest) => manualReturnsAPI.createManualReturn(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MANUAL_RETURNS_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: INVENTORY_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    ...options,
  });
};
