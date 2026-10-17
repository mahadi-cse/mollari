import { z } from 'zod';

export const adjustStockSchema = z.object({
  productId: z.coerce.number().int().positive(),
  quantity: z.coerce.number(),
  type: z.enum(['ADJUSTMENT', 'PURCHASE', 'RETURN', 'SALE', 'POS_SALE']),
  reason: z.string().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
  warehouseId: z.coerce.number().int().positive().optional(),
  batchName: z.string().optional(),
  manufactureDate: z.string().datetime().optional(),
  expiryDate: z.string().datetime().optional(),
  sizeName: z.string().optional(),
  sizes: z.array(z.object({
    name: z.string(),
    quantity: z.coerce.number().int().nonnegative(),
  })).optional(),
});

export const transferStockSchema = z.object({
  productId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().positive(),
  fromWarehouseId: z.coerce.number().int().positive().optional(),
  toWarehouseId: z.coerce.number().int().positive(),
  notes: z.string().optional(),
});

export const reconcileStockSchema = z.object({
  warehouseId: z.coerce.number().int().positive(),
  items: z.array(z.object({
    productId: z.coerce.number().int().positive(),
    physicalCount: z.coerce.number().int().nonnegative(),
  })),
  notes: z.string().optional(),
});

export type AdjustStockInput = z.infer<typeof adjustStockSchema>;
export type TransferStockInput = z.infer<typeof transferStockSchema>;
export type ReconcileStockInput = z.infer<typeof reconcileStockSchema>;
