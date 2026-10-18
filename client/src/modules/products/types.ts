export interface Category {
  id: number;
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductInventorySnapshot {
  id: number;
  warehouseId: number;
  quantity: number;
  reservedQty: number;
  lowStockThreshold?: number;
}

export interface ProductSize {
  id?: number;
  productId?: number;
  colorId?: number | null;
  name: string;
  sortOrder?: number;
  imageUrl?: string | null;
  priceOverride?: number | null;
  costPriceOverride?: number | null;
  quantity?: number;
  isActive?: boolean;
}

export interface ProductColor {
  id?: number;
  productId?: number;
  name: string;
  hexCode?: string | null;
  imageUrl?: string | null;
  quantity?: number;
  priceOverride?: number | null;
  costPriceOverride?: number | null;
  sortOrder?: number;
  isActive?: boolean;
  sizes?: ProductSize[];
}

export type UnitType = 'PIECE' | 'WEIGHT';

export interface Product {
  id: number;
  name: string;
  slug: string;
  description?: string;
  shortDescription?: string;
  price: number;
  compareAtPrice?: number;
  costPrice?: number;
  sku: string;
  barcode?: string;
  categoryId: number;
  category?: Category;
  images: string[];
  isFeatured: boolean;
  isActive: boolean;
  tags: string[];
  weight?: number;
  unitType: UnitType;
  unitLabel: string;
  sizes?: ProductSize[];
  colors?: ProductColor[];
  inventories?: ProductInventorySnapshot[];
  createdAt: string;
  updatedAt: string;
}

export interface ListProductsParams {
  category?: string;
  search?: string;
  featured?: boolean;
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  limit?: number;
  sortBy?: string;
  order?: 'asc' | 'desc';
  branchId?: number;
}
