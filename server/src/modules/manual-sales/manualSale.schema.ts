import { z } from 'zod';

export const createManualSaleSchema = z.object({
  soldBy: z.string().min(1).optional(),
  note: z.string().optional(),
  branchId: z.coerce.number().int().positive(),
  branchName: z.string().min(1),
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
