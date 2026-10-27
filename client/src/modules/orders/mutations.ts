import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  CreateOrderRequest,
  UpdateOrderStatusRequest,
  CreateReturnRequest,
  ProcessRefundRequest,
} from './api';
import { ordersAPI } from './api';
import { ORDERS_QUERY_KEYS } from './queries';

export const useCreateOrderMutation = (options?: any) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateOrderRequest) => ordersAPI.createOrder(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORDERS_QUERY_KEYS.all });
    },
    ...options,
  });
};

export const useUpdateOrderStatusMutation = (options?: any) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orderId, data }: { orderId: number; data: UpdateOrderStatusRequest }) =>
      ordersAPI.updateOrderStatus(orderId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORDERS_QUERY_KEYS.all });
    },
    ...options,
  });
};

export const useAddOrderNotesMutation = (options?: any) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orderId, notes }: { orderId: number; notes: string }) =>
      ordersAPI.addOrderNotes(orderId, notes),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ORDERS_QUERY_KEYS.detail(variables.orderId),
      });
    },
    ...options,
  });
};

export const useCreateReturnMutation = (options?: any) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateReturnRequest) => ordersAPI.createReturn(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORDERS_QUERY_KEYS.all });
    },
    ...options,
  });
};

export const useProcessRefundMutation = (options?: any) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ProcessRefundRequest) => ordersAPI.processRefund(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORDERS_QUERY_KEYS.all });
    },
    ...options,
  });
};

export const useMarkAsShippedMutation = (options?: any) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (orderId: number) => ordersAPI.markAsShipped(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORDERS_QUERY_KEYS.all });
    },
    ...options,
  });
};

export const useCancelOrderMutation = (options?: any) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (orderId: number) => ordersAPI.cancelOrder(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORDERS_QUERY_KEYS.all });
    },
    ...options,
  });
};

export const useEntrySteadfastMutation = (options?: any) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (orderId: number) => ordersAPI.entrySteadfast(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORDERS_QUERY_KEYS.all });
    },
    ...options,
  });
};

export const useSyncSteadfastStatusMutation = (options?: any) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (orderId: number) => ordersAPI.getSteadfastStatus(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORDERS_QUERY_KEYS.all });
    },
    ...options,
  });
};

