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

const productColorSchema = z.object({
  name: z.string().min(1, 'Color name is required'),
  hexCode: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  quantity: z.coerce.number().int().nonnegative().optional().default(0),
  priceOverride: z.coerce.number().positive().optional().nullable(),
  costPriceOverride: z.coerce.number().positive().optional().nullable(),
  sortOrder: z.coerce.number().int().nonnegative().optional(),
  isActive: z.boolean().optional(),
  sizes: z.array(productSizeSchema).optional(),
});

const baseProductSchema = z.object({
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
  colors: z.array(productColorSchema).optional(),
});

const validateUniqueSizes = (sizes?: Array<{ name: string }>) => {
  if (!sizes || sizes.length <= 1) return true;
  const names = sizes.map((s) => s.name.trim().toLowerCase());
  return new Set(names).size === names.length;
};

const validateUniqueColors = (colors?: Array<{ name: string }>) => {
  if (!colors || colors.length <= 1) return true;
  const names = colors.map((c) => c.name.trim().toLowerCase());
  return new Set(names).size === names.length;
};

const validateUniqueColorSizes = (colors?: Array<{ name: string; sizes?: Array<{ name: string }> }>) => {
  if (!colors) return true;
  for (const c of colors) {
    if (c.sizes && c.sizes.length > 1) {
      const names = c.sizes.map((s) => s.name.trim().toLowerCase());
      if (new Set(names).size !== names.length) return false;
    }
  }
  return true;
};

export const createProductSchema = baseProductSchema
  .refine((data) => validateUniqueSizes(data.sizes), {
    message: 'Each product size must have a unique name',
    path: ['sizes'],
  })
  .refine((data) => validateUniqueColors(data.colors), {
    message: 'Each product color must have a unique name',
    path: ['colors'],
  })
  .refine((data) => validateUniqueColorSizes(data.colors), {
    message: 'Each size name under a color must be unique',
    path: ['colors'],
  });

export const updateProductSchema = baseProductSchema
  .partial()
  .refine((data) => validateUniqueSizes(data.sizes), {
    message: 'Each product size must have a unique name',
    path: ['sizes'],
  })
  .refine((data) => validateUniqueColors(data.colors), {
    message: 'Each product color must have a unique name',
    path: ['colors'],
  })
  .refine((data) => validateUniqueColorSizes(data.colors), {
    message: 'Each size name under a color must be unique',
    path: ['colors'],
  });

export type CreateProductInput = z.infer<typeof baseProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
