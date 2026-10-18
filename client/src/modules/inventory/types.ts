export interface Inventory {
  id: number;
  productId: number;
  name?: string;
  sku?: string;
  category?: string;
  price?: number;
  currentStock: number;
  lowStockThreshold: number;
  unitsSold: number;
  reorderLevel: number;
  createdAt?: string;
  updatedAt?: string;
  product?: {
    id: number;
    name: string;
    sku: string;
    price?: number;
    unitType?: string;
    unitLabel?: string;
    sizes?: any[];
    colors?: any[];
  };
  sizes?: any[];
  colors?: any[];
  warehouseId?: number;
  warehouse?: string;
  availableQty?: number;
  reservedQty?: number;
  batchName?: string;
  manufactureDate?: string;
  expiryDate?: string;
}

export interface InventoryTransaction {
  id: number;
  productId: number;
  orderId?: number;
  quantity: number;
  type: InventoryTransactionType;
  reason?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export enum InventoryTransactionType {
  IN = 'in',           // Stock added
  OUT = 'out',         // Stock removed
  ADJUSTMENT = 'adjustment',  // Manual adjustment
  RETURN = 'return',   // Customer return
  DAMAGED = 'damaged', // Damaged stock
  LOST = 'lost',       // Lost/missing stock
}

export interface LowStockAlert {
  productId: number;
  name: string;
  sku: string;
  currentStock: number;
  lowStockThreshold: number;
  daysUntilStockout?: number;
}

export interface InventoryStats {
  totalProducts: number;
  activeProducts: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  totalInventoryValue: number;
  avgStockTurnover: number;
}
