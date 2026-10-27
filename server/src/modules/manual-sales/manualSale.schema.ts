import { z } from 'zod';

export const createManualSaleSchema = z.object({
  soldBy: z.string().min(1).optional(),
  note: z.string().max(480).optional(),
  branchId: z.coerce.number().int().positive(),
  branchName: z.string().min(1),
  // Steadfast courier fields
  recipientName: z.string().max(100).optional(),
  recipientPhone: z.string().max(40).optional(),
  recipientAddress: z.string().max(490).optional(),
  codAmount: z.coerce.number().nonnegative().optional(),
  consignmentId: z.string().optional(),
  trackingCode: z.string().optional(),
  courierStatus: z.string().optional(),
  items: z.array(
    z.object({
      productId: z.coerce.number().int().positive(),
      quantity: z.coerce.number().int().positive(),
      unitPrice: z.coerce.number().nonnegative().optional(),
      sizeName: z.string().optional(),
      colorName: z.string().optional(),
    })
  ).min(1),
});

export type CreateManualSaleInput = z.infer<typeof createManualSaleSchema>;
