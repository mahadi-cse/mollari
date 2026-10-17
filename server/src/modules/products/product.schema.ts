import { z } from 'zod';

const productSizeSchema = z.object({
  name: z.string().min(1, 'Size name is required'),
  sortOrder: z.coerce.number().int().nonnegative().optional(),
  imageUrl: z.string().optional().nullable(),
  priceOverride: z.coerce.number().positive().optional().nullable(),
  costPriceOverride: z.coerce.number().positive().optional().nullable(),
  quantity: z.coerce.number().int().nonnegative().optional().default(0),
  isActive: z.boolean().optional(),
});

export const createProductSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  description: z.string().optional(),
  shortDescription: z.string().optional(),
  price: z.coerce.number().positive('Price must be positive'),
  compareAtPrice: z.coerce.number().positive().optional(),
  costPrice: z.coerce.number().positive().optional(),
  sku: z.string().min(1, 'SKU is required'),
  barcode: z.string().optional(),
  categoryId: z.coerce.number().int().positive('Invalid category ID'),
  images: z.array(z.string().url()).optional(),
  isFeatured: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  weight: z.coerce.number().positive().optional(),
  branchId: z.coerce.number().int().positive().optional(),
  openingStock: z.coerce.number().int().nonnegative().optional(),
  unitType: z.enum(['PIECE', 'WEIGHT']).optional(),
  unitLabel: z.string().min(1).optional(),
  sizes: z.array(productSizeSchema).optional(),
});

export const updateProductSchema = createProductSchema.partial();

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
