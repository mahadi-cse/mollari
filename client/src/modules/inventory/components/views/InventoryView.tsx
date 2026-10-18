'use client';

import React, { useState, useMemo } from 'react';
import { Theme } from '@/modules/dashboard/utils/theme';
import { Card, SecHead, Btn } from '@/shared/components/ui/Primitives';
import { useResponsive } from '@/shared/hooks/useResponsive';
import { useAdjustStockMutation, useInventorySummary } from '@/modules/inventory';
import { useListBranches } from '@/modules/branches';
import { useListProducts } from '@/modules/products';
import toast from 'react-hot-toast';
import { useDashboardLocale } from '@/modules/dashboard/locales/DashboardLocaleContext';
import { LoadingSpinner } from '@/shared/components/ui/LoadingStates';
import InventoryLedgerView from './InventoryLedgerView';
import { History } from 'lucide-react';

interface InventoryViewProps {
  products: any[];
  setProducts: (products: any[]) => void;
  sellLog: any[];
  setSellLog: (log: any[]) => void;
}

export default function InventoryView({
  products,
  sellLog,
}: InventoryViewProps) {
  const { isMobile } = useResponsive();
  const { t } = useDashboardLocale();
  const { data: branches = [] } = useListBranches();
  const activeBranches = branches.filter((b) => b.active);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [activeTab, setActiveTab] = useState<'current' | 'ledger'>('current');
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [formProductId, setFormProductId] = useState(products[0]?.id.toString() || '1');
  const [formBranchId, setFormBranchId] = useState('');
  const [formStockValue, setFormStockValue] = useState('');
  const [formMode, setFormMode] = useState<'set' | 'add'>('set');
  const [batchName, setBatchName] = useState('');
  const [mfgDate, setMfgDate] = useState('');
  const [expDate, setExpDate] = useState('');
  const [formColorName, setFormColorName] = useState('');
  const [colorSizeStocks, setColorSizeStocks] = useState<Record<string, string>>({});
  const [formSizeName, setFormSizeName] = useState('');
  const [sizeStocks, setSizeStocks] = useState<Record<string, string>>({});
  const [sizeAdjustmentMode, setSizeAdjustmentMode] = useState<'all' | 'single'>('all');
  const [productQuery, setProductQuery] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'ok' | 'low' | 'out'>('all');
  const productSearchRef = React.useRef<HTMLDivElement | null>(null);
  const adjustStockMutation = useAdjustStockMutation();
  const allInventoryQuery = useInventorySummary({ page: 1, limit: 500 });
  const branchInventoryQuery = useInventorySummary({
    page: 1,
    limit: 500,
    ...(selectedBranch ? { warehouseId: Number(selectedBranch) } : {}),
  });
  // Fetch products with sizes/unit info for the modal
  const { data: productsWithSizes = [] } = useListProducts({ limit: 500 } as any, {
    queryKey: ['products', 'list', 'inventory-sizes', { limit: 500 }],
  });
  const branchInventoryData = ((branchInventoryQuery as any).data?.data || []) as any[];
  const allInventoryData = ((allInventoryQuery as any).data?.data || []) as any[];
  const resolveBranchId = (item: any) => {
    if (item.warehouseId) return item.warehouseId;
    const byName = activeBranches.find((b: any) => b.name === item.warehouse);
    return byName?.id;
  };
  const normalizeInventoryRows = (rows: any[]) =>
    rows.map((item: any) => ({
      id: item.productId || item.product?.id,
      name: item.product?.name || t.unknownProduct,
      sku: item.product?.sku || t.na,
      stock: item.availableQty ?? item.quantity ?? 0,
      sizes: item.product?.sizes || item.sizes || [],
      colors: item.product?.colors || item.colors || [],
      branchId: resolveBranchId(item),
      warehouse: item.warehouse || t.na,
      status: 'active',
      batchName: item.batchName || t.na,
      manufactureDate: item.manufactureDate ? new Date(item.manufactureDate).toLocaleDateString() : t.na,
      expiryDate: item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : t.na,
      rawMfgDate: item.manufactureDate || '',
      rawExpDate: item.expiryDate || '',
    }));

  const allProducts = normalizeInventoryRows(allInventoryData);
  const branchProducts = normalizeInventoryRows(branchInventoryData);
  const getProductMeta = (productId: number) => {
    const liveProd = branchProducts.find((p: any) => p.id === productId) || allProducts.find((p: any) => p.id === productId);
    const cachedMeta = productsWithSizes.find((p: any) => p.id === productId);
    if (!liveProd) return cachedMeta;
    return {
      ...cachedMeta,
      ...liveProd,
      sizes: (liveProd.sizes && liveProd.sizes.length > 0) ? liveProd.sizes : (cachedMeta?.sizes || []),
      colors: (liveProd.colors && liveProd.colors.length > 0) ? liveProd.colors : (cachedMeta?.colors || []),
    };
  };
  const viewProducts = branchProducts;
  const modalProducts = useMemo(() => {
    if (!formBranchId) return [];
    return allProducts.filter((p: any) => String(p.branchId || '') === formBranchId);
  }, [allProducts, formBranchId]);
  const searchableModalProducts = useMemo(() => {
    if (!formBranchId) return [];
    const q = productQuery.trim().toLowerCase();
    if (!q) return modalProducts.slice(0, 50);
    return modalProducts
      .filter((p: any) => {
        const meta = getProductMeta(p.id) || p;
        const sizes: any[] = (p.sizes && p.sizes.length > 0) ? p.sizes : (meta?.sizes || []);
        const colors: any[] = (p.colors && p.colors.length > 0) ? p.colors : (meta?.colors || []);
        return (
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          sizes.some((s: any) => s.name?.toLowerCase().includes(q)) ||
          colors.some((c: any) =>
            c.name?.toLowerCase().includes(q) ||
            c.sizes?.some((cs: any) => cs.name?.toLowerCase().includes(q))
          )
        );
      })
      .slice(0, 50);
  }, [formBranchId, modalProducts, productQuery, productsWithSizes]);

  // Helper functions
  const getStatus = (stock: number) => {
    if (stock === 0) return 'out';
    if (stock <= 10) return 'low';
    return 'ok';
  };

  const getStatusLabel = (stock: number) => {
    if (stock === 0) return t.inventory.outOfStock;
    if (stock <= 10) return t.inventory.lowStock;
    return t.inventory.filterHealthy;
  };

  const getStatusColor = (status: string) => {
    if (status === 'out') return '#A32D2D';
    if (status === 'low') return '#854F0B';
    return '#3B6D11';
  };

  const getStatusBg = (status: string) => {
    if (status === 'out') return '#FCEBEB';
    if (status === 'low') return '#FAEEDA';
    return '#EAF3DE';
  };

  // Filter products based on search and filter
  const filteredProducts = useMemo(() => {
    return branchProducts.filter((p: any) => {
      const q = searchQuery.toLowerCase().trim();
      const meta = getProductMeta(p.id) || p;
      const sizes: any[] = (p.sizes && p.sizes.length > 0) ? p.sizes : (meta?.sizes || []);
      const colors: any[] = (p.colors && p.colors.length > 0) ? p.colors : (meta?.colors || []);
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        sizes.some((s: any) => s.name?.toLowerCase().includes(q)) ||
        colors.some((c: any) =>
          c.name?.toLowerCase().includes(q) ||
          c.sizes?.some((cs: any) => cs.name?.toLowerCase().includes(q))
        );
      const status = getStatus(p.stock);
      const matchFilter = activeFilter === 'all' || status === activeFilter;
      return matchSearch && matchFilter;
    });
  }, [branchProducts, searchQuery, activeFilter, productsWithSizes]);

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    return {
      totalSkus: branchProducts.length,
      totalUnits: branchProducts.reduce((sum: number, p: any) => sum + p.stock, 0),
      lowStockCount: branchProducts.filter((p: any) => getStatus(p.stock) === 'low').length,
      outOfStockCount: branchProducts.filter((p: any) => getStatus(p.stock) === 'out').length,
    };
  }, [branchProducts]);

  const totalVariantStocksSum = useMemo(() => {
    if (!formProductId) return 0;
    const meta = getProductMeta(parseInt(formProductId));
    const colors: any[] = (meta as any)?.colors || [];
    if (colors.length > 0) {
      let sum = 0;
      colors.forEach((c: any) => {
        if (c.sizes && c.sizes.length > 0) {
          c.sizes.forEach((s: any) => {
            const key = `${c.name}:::${s.name}`;
            const val = colorSizeStocks[key] !== undefined ? colorSizeStocks[key] : (s.quantity ?? 0).toString();
            const q = parseInt(val, 10);
            sum += isNaN(q) ? 0 : Math.max(0, q);
          });
        } else {
          const val = colorSizeStocks[c.name] !== undefined ? colorSizeStocks[c.name] : (c.quantity ?? 0).toString();
          const q = parseInt(val, 10);
          sum += isNaN(q) ? 0 : Math.max(0, q);
        }
      });
      return sum;
    }
    const sizes: any[] = (meta as any)?.sizes || [];
    if (sizes.length > 0) {
      return Object.values(sizeStocks).reduce((sum, val) => {
        const q = parseInt(val, 10);
        return sum + (isNaN(q) ? 0 : Math.max(0, q));
      }, 0);
    }
    return 0;
  }, [formProductId, colorSizeStocks, sizeStocks, branchProducts, allProducts, productsWithSizes]);

  const selectedProduct = modalProducts.find((p: any) => p.id === parseInt(formProductId));

  const handleFormSubmit = async () => {
    if (!formBranchId) {
      toast.error(t.inventory.pleaseSelectBranch);
      return;
    }
    if (!formProductId) {
      toast.error(t.inventory.pleaseSelectProduct);
      return;
    }

    const productId = parseInt(formProductId);
    const meta = getProductMeta(productId);
    const productColors = (meta as any)?.colors || [];
    const productSizes = (meta as any)?.sizes || [];
    const hasColors = productColors.length > 0;
    const hasSizes = productSizes.length > 0;

    // 1. Product has colors: All Variants Mode
    if (hasColors && sizeAdjustmentMode === 'all') {
      const formattedColors = productColors.map((c: any) => {
        const hasColorSizes = c.sizes && c.sizes.length > 0;
        if (hasColorSizes) {
          const formattedSizes = c.sizes.map((s: any) => {
            const key = `${c.name}:::${s.name}`;
            const val = colorSizeStocks[key] !== undefined ? colorSizeStocks[key] : (s.quantity ?? 0).toString();
            return {
              name: s.name,
              quantity: Math.max(0, parseInt(val, 10) || 0),
            };
          });
          const totalColStock = formattedSizes.reduce((sum: number, s: any) => sum + s.quantity, 0);
          return {
            name: c.name,
            quantity: totalColStock,
            sizes: formattedSizes,
          };
        } else {
          const val = colorSizeStocks[c.name] !== undefined ? colorSizeStocks[c.name] : (c.quantity ?? 0).toString();
          return {
            name: c.name,
            quantity: Math.max(0, parseInt(val, 10) || 0),
          };
        }
      });

      const newTotalStock = formattedColors.reduce((sum: number, c: any) => sum + (c.quantity || 0), 0);
      const currentStock = selectedProduct?.stock || 0;
      const quantityChange = newTotalStock - currentStock;

      try {
        await adjustStockMutation.mutateAsync({
          productId,
          quantity: quantityChange,
          type: 'ADJUSTMENT',
          warehouseId: Number(formBranchId),
          notes: `Batch color & size stock update from inventory [Total: ${newTotalStock}]`,
          colors: formattedColors,
        });
        toast.success(t.inventory.stockUpdated);
        setModalOpen(false);
      } catch {
        toast.error(t.inventory.failedUpdate);
      }
      return;
    }

    // 2. Product has colors: Single Variant Mode
    if (hasColors && sizeAdjustmentMode === 'single') {
      const enteredValue = parseInt(formStockValue);
      if (isNaN(enteredValue) || enteredValue < 0 || !selectedProduct) {
        toast.error('Please enter a valid stock quantity');
        return;
      }

      const targetColor = productColors.find((c: any) => c.name === formColorName) || productColors[0];
      const hasColorSizes = targetColor?.sizes && targetColor.sizes.length > 0;
      let quantityChange = 0;

      if (hasColorSizes && formSizeName) {
        const targetSize = targetColor.sizes.find((s: any) => s.name === formSizeName);
        const currentVariantStock = targetSize?.quantity ?? 0;
        quantityChange = formMode === 'set' ? enteredValue - currentVariantStock : enteredValue;
      } else {
        const currentVariantStock = targetColor?.quantity ?? 0;
        quantityChange = formMode === 'set' ? enteredValue - currentVariantStock : enteredValue;
      }

      if (quantityChange === 0) {
        setModalOpen(false);
        setFormStockValue('');
        return;
      }

      try {
        await adjustStockMutation.mutateAsync({
          productId,
          quantity: quantityChange,
          type: 'ADJUSTMENT',
          warehouseId: Number(formBranchId),
          notes: formMode === 'set'
            ? `Manual set stock [${targetColor?.name}${formSizeName ? ` / ${formSizeName}` : ''}]`
            : `Manual add stock [${targetColor?.name}${formSizeName ? ` / ${formSizeName}` : ''}]`,
          colorName: targetColor?.name,
          ...(formSizeName ? { sizeName: formSizeName } : {}),
          ...(formMode === 'add' && quantityChange > 0
            ? {
                batchName: batchName || undefined,
                manufactureDate: mfgDate ? new Date(mfgDate).toISOString() : undefined,
                expiryDate: expDate ? new Date(expDate).toISOString() : undefined,
              }
            : {}),
        });
        toast.success(t.inventory.stockUpdated);
        setFormStockValue('');
        setBatchName('');
        setMfgDate('');
        setExpDate('');
        setFormColorName('');
        setFormSizeName('');
        setModalOpen(false);
      } catch {
        toast.error(t.inventory.failedUpdate);
      }
      return;
    }

    // 3. Standalone sizes: All Sizes Mode
    if (hasSizes && sizeAdjustmentMode === 'all') {
      const formattedSizes = productSizes.map((s: any) => ({
        name: s.name,
        quantity: Math.max(0, parseInt(sizeStocks[s.name] ?? (s.quantity ?? 0).toString(), 10) || 0),
      }));
      const newTotalStock = formattedSizes.reduce((sum: number, s: any) => sum + s.quantity, 0);
      const currentStock = selectedProduct?.stock || 0;
      const quantityChange = newTotalStock - currentStock;

      try {
        await adjustStockMutation.mutateAsync({
          productId,
          quantity: quantityChange,
          type: 'ADJUSTMENT',
          warehouseId: Number(formBranchId),
          notes: `Batch size stock update from inventory [Total: ${newTotalStock}]`,
          sizes: formattedSizes,
        });
        toast.success(t.inventory.stockUpdated);
        setModalOpen(false);
      } catch {
        toast.error(t.inventory.failedUpdate);
      }
      return;
    }

    // 4. Standalone sizes (Single Mode) or Standard Product
    const enteredValue = parseInt(formStockValue);
    if (isNaN(enteredValue) || enteredValue < 0 || !selectedProduct) {
      toast.error('Please enter a valid stock quantity');
      return;
    }

    let quantityChange = 0;
    if (hasSizes && formSizeName) {
      const targetSize = productSizes.find((s: any) => s.name === formSizeName);
      const currentSizeStock = targetSize?.quantity ?? 0;
      quantityChange = formMode === 'set' ? enteredValue - currentSizeStock : enteredValue;
    } else {
      const currentStock = selectedProduct.stock || 0;
      quantityChange = formMode === 'set' ? enteredValue - currentStock : enteredValue;
    }

    if (quantityChange === 0) {
      setModalOpen(false);
      setFormStockValue('');
      return;
    }

    try {
      await adjustStockMutation.mutateAsync({
        productId,
        quantity: quantityChange,
        type: 'ADJUSTMENT',
        warehouseId: Number(formBranchId),
        notes: formMode === 'set' 
          ? `Manual set stock from inventory dashboard${formSizeName ? ` [Size: ${formSizeName}]` : ''}` 
          : `Manual add stock from inventory dashboard${formSizeName ? ` [Size: ${formSizeName}]` : ''}`,
        ...(formSizeName ? { sizeName: formSizeName } : {}),
        ...(formMode === 'add' && quantityChange > 0
          ? {
              batchName: batchName || undefined,
              manufactureDate: mfgDate ? new Date(mfgDate).toISOString() : undefined,
              expiryDate: expDate ? new Date(expDate).toISOString() : undefined,
            }
          : {}),
      });
      toast.success(t.inventory.stockUpdated);
      setFormStockValue('');
      setBatchName('');
      setMfgDate('');
      setExpDate('');
      setFormSizeName('');
      setModalOpen(false);
    } catch {
      toast.error(t.inventory.failedUpdate);
    }
  };

  const openAddModal = () => {
    setFormBranchId(selectedBranch || '');
    setFormProductId('');
    setProductQuery('');
    setShowProductDropdown(false);
    setFormStockValue('');
    setFormMode('set');
    setBatchName('');
    setMfgDate('');
    setExpDate('');
    setFormColorName('');
    setFormSizeName('');
    setColorSizeStocks({});
    setSizeStocks({});
    setSizeAdjustmentMode('all');
    setModalOpen(true);
  };

  React.useEffect(() => {
    if (!formBranchId) {
      setFormProductId('');
      return;
    }
    if (modalProducts.length === 0) {
      setFormProductId('');
      return;
    }
    if (!formProductId) {
      return;
    }
    const exists = modalProducts.some((p: any) => String(p.id) === formProductId);
    if (!exists) {
      setFormProductId('');
      setProductQuery('');
      setColorSizeStocks({});
      setSizeStocks({});
      setFormColorName('');
      setFormSizeName('');
    }
  }, [formBranchId, formProductId, modalProducts]);

  React.useEffect(() => {
    if (formProductId) {
      const meta = getProductMeta(parseInt(formProductId));
      const colors = (meta as any)?.colors || [];
      const sizes = (meta as any)?.sizes || [];

      if (colors.length > 0) {
        const initColorSizes: Record<string, string> = {};
        colors.forEach((c: any) => {
          if (c.sizes && c.sizes.length > 0) {
            c.sizes.forEach((s: any) => {
              initColorSizes[`${c.name}:::${s.name}`] = (s.quantity && s.quantity > 0) ? s.quantity.toString() : '';
            });
          } else {
            initColorSizes[c.name] = (c.quantity && c.quantity > 0) ? c.quantity.toString() : '';
          }
        });
        setColorSizeStocks(initColorSizes);
        setSizeStocks({});
        const defaultCol = colors.find((c: any) => c.name === formColorName) || colors[0];
        setFormColorName(defaultCol?.name || '');
        if (defaultCol?.sizes && defaultCol.sizes.length > 0) {
          const defaultSz = defaultCol.sizes.find((s: any) => s.name === formSizeName) || defaultCol.sizes[0];
          setFormSizeName(defaultSz?.name || '');
          setFormStockValue((defaultSz?.quantity && defaultSz.quantity > 0) ? defaultSz.quantity.toString() : '');
        } else {
          setFormSizeName('');
          setFormStockValue((defaultCol?.quantity && defaultCol.quantity > 0) ? defaultCol.quantity.toString() : '');
        }
      } else if (sizes.length > 0) {
        const initSizes: Record<string, string> = {};
        sizes.forEach((s: any) => {
          initSizes[s.name] = (s.quantity && s.quantity > 0) ? s.quantity.toString() : '';
        });
        setSizeStocks(initSizes);
        setColorSizeStocks({});
        setFormColorName('');
        if (!formSizeName || !sizes.some((s: any) => s.name === formSizeName)) {
          setFormSizeName(sizes[0]?.name || '');
          setFormStockValue((sizes[0]?.quantity && sizes[0].quantity > 0) ? sizes[0].quantity.toString() : '');
        }
      } else {
        setColorSizeStocks({});
        setSizeStocks({});
        setFormColorName('');
        setFormSizeName('');
      }
    }
  }, [formProductId, productsWithSizes]);

  React.useEffect(() => {
    const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (!productSearchRef.current?.contains(target)) {
        setShowProductDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, []);

  return (
    <div className="flex flex-col gap-4">
      {/* Unified Compact Header: Title, Segmented Tabs & Summary Stats */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        {/* Left: Title + Segmented Tabs (locked in place) */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
          <div className="shrink-0">
            <div className="text-[18px] font-semibold" style={{ color: Theme.fg }}>
              {t.inventory.title}
            </div>
            <div className="mt-0.5 text-[12px]" style={{ color: Theme.mutedFg }}>
              {(selectedBranch
                ? branches.find((b) => b.id === Number(selectedBranch))?.name
                : t.inventory.allBranches) || t.na}{' '}
              · {t.inventory.synced}
            </div>
          </div>

          {/* Compact E-Commerce Style Segmented Tabs */}
          <div
            className="inline-flex items-center gap-1 overflow-hidden rounded-xl p-1 shrink-0"
            style={{ background: Theme.muted, border: `1px solid ${Theme.border}` }}
          >
            <button
              type="button"
              onClick={() => setActiveTab('current')}
              className="cursor-pointer whitespace-nowrap rounded-lg border-none px-3.5 py-1.5 text-[13px] font-bold capitalize transition-all duration-150 flex items-center gap-2"
              style={{
                background: activeTab === 'current' ? '#fff' : 'transparent',
                color: activeTab === 'current' ? Theme.primary : Theme.mutedFg,
                boxShadow: activeTab === 'current' ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              <span>{t.inventory.tabCurrentStock || 'Current Stock'}</span>
              <span
                className="text-[11px] px-1.5 py-0.2 rounded-full font-semibold"
                style={{
                  background: activeTab === 'current' ? 'rgba(240, 17, 114, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                  color: activeTab === 'current' ? Theme.primary : Theme.mutedFg,
                }}
              >
                {branchProducts.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('ledger')}
              className="cursor-pointer whitespace-nowrap rounded-lg border-none px-3.5 py-1.5 text-[13px] font-bold capitalize transition-all duration-150 flex items-center gap-2"
              style={{
                background: activeTab === 'ledger' ? '#fff' : 'transparent',
                color: activeTab === 'ledger' ? Theme.primary : Theme.mutedFg,
                boxShadow: activeTab === 'ledger' ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              <span>{t.inventory.tabLedger || 'Stock Ledger'}</span>
              <span
                className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                style={{
                  background: activeTab === 'ledger' ? '#dcfce7' : 'rgba(0, 0, 0, 0.05)',
                  color: activeTab === 'ledger' ? '#166534' : Theme.mutedFg,
                }}
              >
                Audit Trail
              </span>
            </button>
          </div>
        </div>

        {/* Right: Summary Stats (when in Current Stock) */}
        {activeTab === 'current' && (
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-2">
            {[
              { label: t.inventory.totalSkus, val: summaryStats.totalSkus, color: '' },
              { label: t.inventory.totalUnits, val: summaryStats.totalUnits, color: '' },
              { label: t.inventory.lowStock, val: summaryStats.lowStockCount, color: '#854F0B' },
              { label: t.inventory.outOfStock, val: summaryStats.outOfStockCount, color: '#A32D2D' },
            ].map((stat, i) => (
              <div
                key={i}
                className="rounded-lg px-2.5 py-1.5 text-center sm:text-left"
                style={{ background: Theme.muted }}
              >
                <div className="text-[11px] leading-tight" style={{ color: Theme.mutedFg }}>
                  {stat.label}
                </div>
                <div className="text-base font-semibold leading-tight" style={{ color: stat.color || Theme.fg }}>
                  {stat.val}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {activeTab === 'ledger' ? (
        <InventoryLedgerView initialBranchId={selectedBranch} initialSearchQuery={ledgerSearch} />
      ) : (
        <>

      <Card>
        {/* Toolbar */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder={t.inventory.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 min-w-[180px] rounded-lg border px-3 py-2 text-sm outline-none"
            style={{ borderColor: Theme.border, color: Theme.fg }}
          />

          {(['all', 'ok', 'low', 'out'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className="rounded-lg border px-3 py-1.5 text-xs font-medium transition-all"
              style={{
                borderColor: Theme.border,
                background: activeFilter === filter ? Theme.primary : 'transparent',
                color: activeFilter === filter ? '#fff' : Theme.mutedFg,
              }}
            >
              {filter === 'all' ? t.inventory.filterAll : filter === 'ok' ? t.inventory.filterHealthy : filter === 'low' ? t.inventory.filterLow : t.inventory.filterOut}
            </button>
          ))}

          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="rounded-lg border px-2.5 py-1.5 text-xs outline-none"
            style={{ borderColor: Theme.border, color: Theme.fg, background: '#fff' }}
          >
            <option value="">{t.inventory.allBranches}</option>
            {activeBranches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          <Btn onClick={openAddModal}>
            {t.inventory.addStock}
          </Btn>
        </div>

        {/* Table */}
        {branchInventoryQuery.isLoading ? (
          <div className="py-12 flex items-center justify-center">
            <svg className="w-9 h-9 animate-spin text-pink-500" viewBox="0 0 24 24" fill="none">
              <circle
                className="opacity-20"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                className="opacity-80"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                d="M12 2a10 10 0 0 1 10 10"
              />
            </svg>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-8 text-center text-sm" style={{ color: Theme.mutedFg }}>
            {t.inventory.noProducts}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: Theme.muted }}>
                  <th
                    style={{
                      fontSize: '11px',
                      fontWeight: 500,
                      color: Theme.mutedFg,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      padding: '8px 12px',
                      textAlign: 'left',
                      borderBottom: `1px solid ${Theme.border}`,
                      width: '32%',
                    }}
                  >
                    {t.inventory.product}
                  </th>
                  <th
                    style={{
                      fontSize: '11px',
                      fontWeight: 500,
                      color: Theme.mutedFg,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      padding: '8px 12px',
                      textAlign: 'left',
                      borderBottom: `1px solid ${Theme.border}`,
                      width: '32%',
                    }}
                  >
                    {t.inventory.stock} & {t.inventory.sizeBreakdown || 'Variants'}
                  </th>
                  <th
                    style={{
                      fontSize: '11px',
                      fontWeight: 500,
                      color: Theme.mutedFg,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      padding: '8px 12px',
                      textAlign: 'left',
                      borderBottom: `1px solid ${Theme.border}`,
                      width: '12%',
                    }}
                  >
                    {t.inventory.status}
                  </th>
                  <th
                    className='hidden lg:table-cell'
                    style={{
                      fontSize: '11px',
                      fontWeight: 500,
                      color: Theme.mutedFg,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      padding: '8px 12px',
                      textAlign: 'right',
                      borderBottom: `1px solid ${Theme.border}`,
                      width: '12%',
                    }}
                  >
                    {t.inventory.batchExp}
                  </th>
                  <th
                    style={{
                      fontSize: '11px',
                      fontWeight: 500,
                      color: Theme.mutedFg,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      padding: '8px 12px',
                      textAlign: 'right',
                      borderBottom: `1px solid ${Theme.border}`,
                      width: '12%',
                    }}
                  />
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p: any) => {
                  const status = getStatus(p.stock);
                  const meta = (p.sizes && p.sizes.length > 0) || (p.colors && p.colors.length > 0)
                    ? p
                    : (getProductMeta(p.id) || p);
                  const colors: any[] = (meta as any)?.colors || [];
                  const sizes: any[] = (meta as any)?.sizes || [];

                  return (
                    <tr
                      key={p.id}
                      style={{
                        borderBottom: `1px solid ${Theme.border}`,
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = Theme.muted)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td
                        style={{
                          padding: '12px 12px',
                          borderBottom: `1px solid ${Theme.border}`,
                          verticalAlign: 'middle',
                          fontSize: '13px',
                          color: Theme.fg,
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '13.5px' }}>{p.name}</div>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            <span style={{ fontSize: '11px', color: Theme.mutedFg, fontFamily: 'monospace' }}>
                              {p.sku}
                            </span>
                            {colors.length > 0 && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                                {colors.length} {colors.length === 1 ? 'color' : 'colors'}
                              </span>
                            )}
                            {sizes.length > 0 && colors.length === 0 && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-pink-50 text-pink-700 border border-pink-200">
                                {sizes.length} {sizes.length === 1 ? 'size' : 'sizes'}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td
                        style={{
                          padding: '12px 12px',
                          borderBottom: `1px solid ${Theme.border}`,
                          verticalAlign: 'middle',
                          fontSize: '13px',
                          color: getStatusColor(status),
                        }}
                      >
                        <div>
                          <div className="flex items-baseline gap-1.5">
                            <span className="font-extrabold text-[15px]">{p.stock}</span>
                            <span className="text-[11px] font-medium" style={{ color: Theme.mutedFg }}>
                              {t.inventory.units}
                            </span>
                          </div>

                          {/* Colored Variants Breakdown */}
                          {colors.length > 0 && (
                            <div className="mt-1.5 flex flex-col gap-1.5">
                              {colors.map((c: any) => {
                                const hasColorSizes = c.sizes && c.sizes.length > 0;
                                const colStock = hasColorSizes
                                  ? c.sizes.reduce((sum: number, s: any) => sum + (Number(s.quantity) || 0), 0)
                                  : (c.quantity ?? 0);
                                return (
                                  <div key={c.id || c.name} className="flex flex-wrap items-center gap-1.5">
                                    <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                                      {c.hexCode && (
                                        <span
                                          className="w-2 h-2 rounded-full border border-black/15 shrink-0"
                                          style={{ backgroundColor: c.hexCode }}
                                        />
                                      )}
                                      <span>{c.name}</span>
                                      {!hasColorSizes && <span className="font-bold">({colStock})</span>}
                                    </span>
                                    {hasColorSizes && (
                                      <div className="flex flex-wrap items-center gap-1">
                                        {c.sizes.map((s: any) => {
                                          const sQty = Number(s.quantity) || 0;
                                          return (
                                            <span
                                              key={s.id || s.name}
                                              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium border"
                                              style={{
                                                background: sQty === 0 ? '#FCEBEB' : sQty <= 5 ? '#FAEEDA' : '#FDF2F8',
                                                color: sQty === 0 ? '#A32D2D' : sQty <= 5 ? '#854F0B' : '#BE185D',
                                                borderColor: sQty === 0 ? '#F87171' : sQty <= 5 ? '#FBBF24' : '#FBCFE8',
                                              }}
                                            >
                                              <span>{s.name}:</span>
                                              <span className="font-bold">{sQty}</span>
                                            </span>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Standalone Sizes Breakdown */}
                          {colors.length === 0 && sizes.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {sizes.map((s: any) => {
                                const sQty = Number(s.quantity) || 0;
                                return (
                                  <span
                                    key={s.id || s.name}
                                    className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium border"
                                    style={{
                                      background: sQty === 0 ? '#FCEBEB' : sQty <= 5 ? '#FAEEDA' : '#FDF2F8',
                                      color: sQty === 0 ? '#A32D2D' : sQty <= 5 ? '#854F0B' : '#BE185D',
                                      borderColor: sQty === 0 ? '#F87171' : sQty <= 5 ? '#FBBF24' : '#FBCFE8',
                                    }}
                                  >
                                    <span>{s.name}:</span>
                                    <span className="font-bold">{sQty}</span>
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </td>
                      <td
                        style={{
                          padding: '12px 12px',
                          borderBottom: `1px solid ${Theme.border}`,
                          verticalAlign: 'middle',
                        }}
                      >
                        <span
                          style={{
                            display: 'inline-block',
                            fontSize: '11px',
                            fontWeight: 500,
                            padding: '2px 8px',
                            borderRadius: '999px',
                            background: getStatusBg(status),
                            color: getStatusColor(status),
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {getStatusLabel(p.stock)}
                        </span>
                      </td>
                      <td
                        className='hidden lg:table-cell'
                        style={{
                          padding: '12px 12px',
                          borderBottom: `1px solid ${Theme.border}`,
                          verticalAlign: 'middle',
                          fontSize: '12px',
                          color: Theme.mutedFg,
                          fontFamily: 'monospace',
                          textAlign: 'right',
                        }}
                      >
                        {p.batchName} / {p.expiryDate}
                      </td>
                      <td
                        style={{
                          padding: '12px 12px',
                          borderBottom: `1px solid ${Theme.border}`,
                          verticalAlign: 'middle',
                          textAlign: 'right',
                        }}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setFormProductId(p.id.toString());
                            setFormBranchId(selectedBranch || String(p.branchId || ''));
                            setProductQuery(`${p.name} (${p.sku})`);
                            setShowProductDropdown(false);
                            setFormMode('set');
                            setFormStockValue(String(p.stock ?? 0));
                            setBatchName(p.batchName !== t.na ? p.batchName : '');
                            setMfgDate(p.rawMfgDate ? p.rawMfgDate.split('T')[0] : '');
                            setExpDate(p.rawExpDate ? p.rawExpDate.split('T')[0] : '');

                            if (colors.length > 0) {
                              const initColorSizes: Record<string, string> = {};
                              colors.forEach((c: any) => {
                                if (c.sizes && c.sizes.length > 0) {
                                  c.sizes.forEach((s: any) => {
                                    initColorSizes[`${c.name}:::${s.name}`] = (s.quantity && s.quantity > 0) ? s.quantity.toString() : '';
                                  });
                                } else {
                                  initColorSizes[c.name] = (c.quantity && c.quantity > 0) ? c.quantity.toString() : '';
                                }
                              });
                              setColorSizeStocks(initColorSizes);
                              setSizeStocks({});
                              const defaultCol = colors[0];
                              setFormColorName(defaultCol?.name || '');
                              if (defaultCol?.sizes && defaultCol.sizes.length > 0) {
                                setFormSizeName(defaultCol.sizes[0]?.name || '');
                                setFormStockValue((defaultCol.sizes[0]?.quantity && defaultCol.sizes[0].quantity > 0) ? defaultCol.sizes[0].quantity.toString() : '');
                              } else {
                                setFormSizeName('');
                                setFormStockValue((defaultCol?.quantity && defaultCol.quantity > 0) ? defaultCol.quantity.toString() : '');
                              }
                              setSizeAdjustmentMode('all');
                            } else if (sizes.length > 0) {
                              const initSizes: Record<string, string> = {};
                              sizes.forEach((s: any) => {
                                initSizes[s.name] = (s.quantity && s.quantity > 0) ? s.quantity.toString() : '';
                              });
                              setSizeStocks(initSizes);
                              setColorSizeStocks({});
                              setFormColorName('');
                              setFormSizeName(sizes[0]?.name || '');
                              setFormStockValue((sizes[0]?.quantity && sizes[0].quantity > 0) ? sizes[0].quantity.toString() : '');
                              setSizeAdjustmentMode('all');
                            } else {
                              setColorSizeStocks({});
                              setSizeStocks({});
                              setFormColorName('');
                              setFormSizeName('');
                              setSizeAdjustmentMode('single');
                            }

                            setModalOpen(true);
                          }}
                          className="cursor-pointer rounded border px-2 py-1 text-xs font-medium transition-all hover:bg-gray-50"
                          style={{
                            border: `1px solid ${Theme.border}`,
                            background: '#fff',
                            color: Theme.fg,
                          }}
                        >
                          {t.inventory.edit}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setLedgerSearch(p.sku || p.name);
                            setActiveTab('ledger');
                          }}
                          className="cursor-pointer rounded border px-2 py-1 text-xs font-medium transition-all hover:bg-gray-100 flex items-center gap-1"
                          style={{
                            border: `1px solid ${Theme.border}`,
                            background: '#fff',
                            color: Theme.fg,
                          }}
                          title={t.inventory.viewProductLedger}
                        >
                          <History className="w-3.5 h-3.5 text-neutral-500" />
                          <span className="hidden sm:inline">{t.inventory.tabLedger}</span>
                        </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Count */}
        <div style={{ fontSize: '11px', color: Theme.mutedFg, marginTop: '10px' }}>
          {filteredProducts.length} {t.inventory.of} {branchProducts.length} {t.inventory.products}
        </div>
      </Card>

      {/* Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="max-h-[92vh] w-[94%] max-w-[720px] overflow-y-auto"
            onClick={(e: any) => e.stopPropagation()}
          >
            <Card>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="text-lg font-extrabold" style={{ color: Theme.fg }}>
                    {t.inventory.addEditStock}
                  </div>
                  <div className="mt-0.5 text-xs" style={{ color: Theme.mutedFg }}>
                    {t.inventory.updateInventory}
                  </div>
                </div>
                <button
                  onClick={() => setModalOpen(false)}
                  className="cursor-pointer border-none bg-transparent text-2xl leading-none"
                  style={{ color: Theme.mutedFg }}
                >
                  ✕
                </button>
              </div>

              <div className={`mb-4 grid gap-[14px] ${isMobile ? 'grid-cols-1' : 'grid-cols-2'}`}>
                <div>
                  <label
                    className="mb-1.5 block text-xs font-bold uppercase tracking-[0.05em]"
                    style={{ color: Theme.mutedFg }}
                  >
                    {t.inventory.searchProduct}
                  </label>
                  <div className="relative" ref={productSearchRef}>
                    <input
                      value={productQuery}
                      onChange={(e) => {
                        setProductQuery(e.target.value);
                        setFormProductId('');
                        setShowProductDropdown(true);
                      }}
                      onFocus={() => {
                        if (formBranchId) setShowProductDropdown(true);
                      }}
                      disabled={!formBranchId}
                      placeholder={formBranchId ? t.inventory.searchProductOrSku : t.inventory.selectBranchFirst}
                      className="w-full rounded-lg bg-white px-3 py-2.5 text-[13px] outline-none"
                      style={{ border: `1px solid ${Theme.border}`, color: Theme.fg }}
                    />

                    {showProductDropdown && formBranchId && (
                      <div
                        className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-lg border bg-white"
                        style={{ borderColor: Theme.border, boxShadow: '0 8px 20px rgba(0,0,0,0.08)' }}
                      >
                        {searchableModalProducts.length === 0 ? (
                          <div className="px-3 py-2 text-xs" style={{ color: Theme.mutedFg }}>
                            {t.inventory.noProductsForBranch}
                          </div>
                        ) : (
                          searchableModalProducts.map((p: any) => {
                            const meta = (p.sizes && p.sizes.length > 0) || (p.colors && p.colors.length > 0)
                              ? p
                              : (getProductMeta(p.id) || p);
                            const pColors: any[] = (meta as any)?.colors || [];
                            const pSizes: any[] = (meta as any)?.sizes || [];

                            return (
                              <button
                                key={`${p.id}-${p.branchId || 'na'}`}
                                type="button"
                                onClick={() => {
                                  setFormProductId(String(p.id));
                                  setProductQuery(`${p.name} (${p.sku})`);
                                  setShowProductDropdown(false);
                                }}
                                className="w-full cursor-pointer border-0 px-3 py-2 text-left text-[13px] hover:bg-pink-50/40 transition-colors"
                                style={{ background: '#fff', color: Theme.fg }}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="font-semibold">{p.name}</div>
                                  <div className="text-[11px] font-bold text-gray-500">{p.stock} units</div>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[11px]" style={{ color: Theme.mutedFg }}>{t.modal.sku}: {p.sku}</span>
                                  {pColors.length > 0 && (
                                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 font-semibold border border-purple-200">
                                      {pColors.length} colors
                                    </span>
                                  )}
                                  {pSizes.length > 0 && pColors.length === 0 && (
                                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-pink-50 text-pink-700 font-semibold border border-pink-200">
                                      {pSizes.length} sizes
                                    </span>
                                  )}
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label
                    className="mb-1.5 block text-xs font-bold uppercase tracking-[0.05em]"
                    style={{ color: Theme.mutedFg }}
                  >
                    {t.inventory.selectBranch}
                  </label>
                  <select
                    value={formBranchId}
                    onChange={(e) => {
                      const nextBranchId = e.target.value;
                      setFormBranchId(nextBranchId);
                      setFormProductId('');
                      setProductQuery('');
                      setShowProductDropdown(false);
                    }}
                    className="w-full cursor-pointer rounded-lg bg-white px-3 py-2.5 text-[13px] outline-none"
                    style={{ border: `1px solid ${Theme.border}`, color: Theme.fg }}
                  >
                    <option value="">{t.inventory.selectBranch}</option>
                    {activeBranches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Product Size / Variant Management in Modal */}
              {(() => {
                const meta = formProductId ? getProductMeta(parseInt(formProductId)) : null;
                const colors: any[] = (meta as any)?.colors || [];
                const sizes: any[] = (meta as any)?.sizes || [];
                const hasColors = colors.length > 0;
                const hasSizes = sizes.length > 0;

                if (!hasColors && !hasSizes) {
                  return (
                    <div className={`grid gap-3 ${isMobile ? 'grid-cols-1' : 'grid-cols-3'}`}>
                      <div>
                        <label
                          className="mb-1.5 block text-xs font-bold uppercase tracking-[0.05em]"
                          style={{ color: Theme.mutedFg }}
                        >
                          {t.inventory.mode}
                        </label>
                        <div className="flex gap-1 rounded-lg p-[3px]" style={{ background: Theme.muted }}>
                          {(['set', 'add'] as const).map((mode) => (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => setFormMode(mode)}
                              className="flex-1 cursor-pointer rounded-md border-none px-2 py-2 text-xs font-semibold capitalize"
                              style={{
                                background: formMode === mode ? '#fff' : 'transparent',
                                color: formMode === mode ? Theme.primary : Theme.mutedFg,
                                boxShadow: formMode === mode ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                              }}
                            >
                              {mode === 'set' ? `🔢 ${t.inventory.setStock}` : `➕ ${t.inventory.addToStock}`}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label
                          className="mb-1.5 block text-xs font-bold uppercase tracking-[0.05em]"
                          style={{ color: Theme.mutedFg }}
                        >
                          {formMode === 'set' ? t.inventory.newStock : t.inventory.addQuantity}
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={formStockValue}
                          onChange={(e) => setFormStockValue(e.target.value)}
                          onFocus={(e) => {
                            if (e.target.value === '0') setFormStockValue('');
                          }}
                          placeholder={formMode === 'set' ? '0' : 'e.g., 10'}
                          className="w-full rounded-lg px-3 py-2.5 text-[13px] outline-none"
                          style={{ border: `1px solid ${Theme.border}`, color: Theme.fg }}
                        />
                      </div>

                      <div>
                        <label
                          className="mb-1.5 block text-xs font-bold uppercase tracking-[0.05em]"
                          style={{ color: Theme.mutedFg }}
                        >
                          {t.inventory.currentStock}
                        </label>
                        <div
                          className="rounded-lg px-3 py-2.5 text-[13px] font-bold"
                          style={{
                            border: `1px solid ${Theme.border}`,
                            color: Theme.primary,
                            background: Theme.muted,
                          }}
                        >
                          {selectedProduct?.stock ?? 0}
                        </div>
                      </div>
                    </div>
                  );
                }

                // PRODUCT HAS COLORS (WITH OR WITHOUT NESTED SIZES)
                if (hasColors) {
                  return (
                    <div className="mt-2 flex flex-col gap-3">
                      {/* Mode Switcher: All Variants vs Single Variant */}
                      <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: Theme.border }}>
                        <div className="text-xs font-bold uppercase tracking-[0.05em]" style={{ color: Theme.mutedFg }}>
                          {t.inventory.colorBreakdown || 'Color & Size Breakdown'}
                        </div>
                        <div className="flex gap-1 rounded-lg p-[3px]" style={{ background: Theme.muted }}>
                          <button
                            type="button"
                            onClick={() => setSizeAdjustmentMode('all')}
                            className="cursor-pointer rounded-md border-none px-3 py-1.5 text-xs font-semibold"
                            style={{
                              background: sizeAdjustmentMode === 'all' ? '#fff' : 'transparent',
                              color: sizeAdjustmentMode === 'all' ? Theme.primary : Theme.mutedFg,
                              boxShadow: sizeAdjustmentMode === 'all' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                            }}
                          >
                            📋 {t.inventory.allSizes || 'All Variants'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSizeAdjustmentMode('single');
                              const cName = formColorName || colors[0]?.name;
                              setFormColorName(cName);
                              const targetCol = colors.find((c: any) => c.name === cName) || colors[0];
                              if (targetCol?.sizes && targetCol.sizes.length > 0) {
                                const sName = formSizeName || targetCol.sizes[0]?.name;
                                setFormSizeName(sName);
                                const sObj = targetCol.sizes.find((s: any) => s.name === sName);
                                setFormStockValue((sObj?.quantity ?? 0).toString());
                              } else {
                                setFormSizeName('');
                                setFormStockValue((targetCol?.quantity ?? 0).toString());
                              }
                            }}
                            className="cursor-pointer rounded-md border-none px-3 py-1.5 text-xs font-semibold"
                            style={{
                              background: sizeAdjustmentMode === 'single' ? '#fff' : 'transparent',
                              color: sizeAdjustmentMode === 'single' ? Theme.primary : Theme.mutedFg,
                              boxShadow: sizeAdjustmentMode === 'single' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                            }}
                          >
                            🎯 {t.inventory.sizeStock || 'Single Variant'}
                          </button>
                        </div>
                      </div>

                      {sizeAdjustmentMode === 'all' ? (
                        <div className="rounded-xl border p-3.5 bg-gray-50/50" style={{ borderColor: Theme.border }}>
                          <div className="mb-2.5 text-xs text-muted-foreground">
                            Enter stock for each color and size variant. Total stock will automatically equal the sum of all variants.
                          </div>
                          <div className="flex flex-col gap-3">
                            {colors.map((c: any) => {
                              const hasColorSizes = c.sizes && c.sizes.length > 0;
                              return (
                                <div key={c.name} className="p-3 rounded-lg bg-white border border-gray-200">
                                  {/* Color Header */}
                                  <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-gray-100">
                                    {c.hexCode && (
                                      <span
                                        className="w-3 h-3 rounded-full border border-black/15 shrink-0"
                                        style={{ backgroundColor: c.hexCode }}
                                      />
                                    )}
                                    <span className="font-bold text-sm text-foreground">{c.name}</span>
                                    <span className="text-[11px] text-muted-foreground ml-auto">
                                      {hasColorSizes ? `${c.sizes.length} sizes` : `Current: ${c.quantity ?? 0} units`}
                                    </span>
                                  </div>

                                  {/* Color Sizes or Single Color Input */}
                                  {hasColorSizes ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                                      {c.sizes.map((s: any) => {
                                        const key = `${c.name}:::${s.name}`;
                                        return (
                                          <div
                                            key={key}
                                            className="flex items-center justify-between gap-2 p-2 rounded bg-gray-50 border border-gray-100"
                                          >
                                            <div className="min-w-0">
                                              <span className="font-semibold text-xs text-foreground">{s.name}</span>
                                              <div className="text-[10px] text-muted-foreground">
                                                Cur: <span className="font-bold text-gray-700">{s.quantity ?? 0}</span>
                                              </div>
                                            </div>
                                            <div className="w-24">
                                              <input
                                                type="number"
                                                min="0"
                                                className="w-full box-border rounded border border-border bg-white px-2 py-1 text-xs text-foreground outline-none font-bold text-right"
                                                value={
                                                  colorSizeStocks[key] !== undefined
                                                    ? colorSizeStocks[key]
                                                    : (s.quantity && s.quantity > 0 ? s.quantity.toString() : '')
                                                }
                                                onChange={(e) => {
                                                  const val = e.target.value;
                                                  setColorSizeStocks((prev) => ({ ...prev, [key]: val }));
                                                }}
                                                onFocus={(e) => {
                                                  if (e.target.value === '0') {
                                                    setColorSizeStocks((prev) => ({ ...prev, [key]: '' }));
                                                  }
                                                }}
                                                placeholder="0"
                                              />
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-between gap-3 p-2 rounded bg-gray-50 border border-gray-100">
                                      <div className="text-xs text-muted-foreground">
                                        Current: <span className="font-bold text-gray-700">{c.quantity ?? 0}</span> units
                                      </div>
                                      <div className="w-32">
                                        <input
                                          type="number"
                                          min="0"
                                          className="w-full box-border rounded border border-border bg-white px-2.5 py-1 text-xs text-foreground outline-none font-bold text-right"
                                          value={
                                            colorSizeStocks[c.name] !== undefined
                                              ? colorSizeStocks[c.name]
                                              : (c.quantity && c.quantity > 0 ? c.quantity.toString() : '')
                                          }
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            setColorSizeStocks((prev) => ({ ...prev, [c.name]: val }));
                                          }}
                                          onFocus={(e) => {
                                            if (e.target.value === '0') {
                                              setColorSizeStocks((prev) => ({ ...prev, [c.name]: '' }));
                                            }
                                          }}
                                          placeholder="0"
                                        />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {/* Sum of all variants display */}
                          <div className="mt-3 flex items-center justify-between p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900">
                            <span className="text-xs font-bold">{t.inventory.totalSizesStock || 'Total Variant Stock'}:</span>
                            <span className="text-base font-extrabold text-emerald-700">{totalVariantStocksSum} units</span>
                          </div>
                        </div>
                      ) : (
                        /* Single Variant Adjustment Mode */
                        <div className="flex flex-col gap-3">
                          <div>
                            <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.05em]" style={{ color: Theme.mutedFg }}>
                              {t.inventory.color || 'Color'}
                            </label>
                            <div className="flex flex-wrap gap-2">
                              {colors.map((c: any) => {
                                const isSelected = (formColorName || colors[0]?.name) === c.name;
                                return (
                                  <button
                                    key={c.name}
                                    type="button"
                                    onClick={() => {
                                      setFormColorName(c.name);
                                      if (c.sizes && c.sizes.length > 0) {
                                        const nextSize = c.sizes[0];
                                        setFormSizeName(nextSize?.name || '');
                                        setFormStockValue((nextSize?.quantity && nextSize.quantity > 0) ? nextSize.quantity.toString() : '');
                                      } else {
                                        setFormSizeName('');
                                        setFormStockValue((c.quantity && c.quantity > 0) ? c.quantity.toString() : '');
                                      }
                                    }}
                                    className="rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5"
                                    style={{
                                      borderColor: isSelected ? Theme.primary : Theme.border,
                                      background: isSelected ? Theme.primary : '#fff',
                                      color: isSelected ? '#fff' : Theme.fg,
                                    }}
                                  >
                                    {c.hexCode && (
                                      <span
                                        className="w-2.5 h-2.5 rounded-full border border-black/15 shrink-0"
                                        style={{ backgroundColor: c.hexCode }}
                                      />
                                    )}
                                    <span>{c.name}</span>
                                    <span className={`text-[10px] px-1 rounded ${isSelected ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'}`}>
                                      {c.sizes && c.sizes.length > 0
                                        ? c.sizes.reduce((sum: number, s: any) => sum + (s.quantity ?? 0), 0)
                                        : (c.quantity ?? 0)}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* If selected color has sizes, pick size */}
                          {(() => {
                            const activeCol = colors.find((c: any) => c.name === (formColorName || colors[0]?.name));
                            if (!activeCol?.sizes || activeCol.sizes.length === 0) return null;
                            return (
                              <div>
                                <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.05em]" style={{ color: Theme.mutedFg }}>
                                  {t.inventory.size || 'Size'}
                                </label>
                                <div className="flex flex-wrap gap-2">
                                  {activeCol.sizes.map((s: any) => {
                                    const isSizeSelected = formSizeName === s.name;
                                    return (
                                      <button
                                        key={s.name}
                                        type="button"
                                        onClick={() => {
                                          setFormSizeName(s.name);
                                          setFormStockValue((s.quantity && s.quantity > 0) ? s.quantity.toString() : '');
                                        }}
                                        className="rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5"
                                        style={{
                                          borderColor: isSizeSelected ? Theme.primary : Theme.border,
                                          background: isSizeSelected ? Theme.primary : '#fff',
                                          color: isSizeSelected ? '#fff' : Theme.fg,
                                        }}
                                      >
                                        <span>{s.name}</span>
                                        <span className={`text-[10px] px-1 rounded ${isSizeSelected ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'}`}>
                                          {s.quantity ?? 0}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })()}

                          <div className={`grid gap-3 ${isMobile ? 'grid-cols-1' : 'grid-cols-3'}`}>
                            <div>
                              <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.05em]" style={{ color: Theme.mutedFg }}>
                                {t.inventory.mode}
                              </label>
                              <div className="flex gap-1 rounded-lg p-[3px]" style={{ background: Theme.muted }}>
                                {(['set', 'add'] as const).map((mode) => (
                                  <button
                                    key={mode}
                                    type="button"
                                    onClick={() => setFormMode(mode)}
                                    className="flex-1 cursor-pointer rounded-md border-none px-2 py-2 text-xs font-semibold capitalize"
                                    style={{
                                      background: formMode === mode ? '#fff' : 'transparent',
                                      color: formMode === mode ? Theme.primary : Theme.mutedFg,
                                      boxShadow: formMode === mode ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                                    }}
                                  >
                                    {mode === 'set' ? `🔢 ${t.inventory.setStock}` : `➕ ${t.inventory.addToStock}`}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div>
                              <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.05em]" style={{ color: Theme.mutedFg }}>
                                {formMode === 'set' ? t.inventory.newStock : t.inventory.addQuantity}
                              </label>
                              <input
                                type="number"
                                min="0"
                                value={formStockValue}
                                onChange={(e) => setFormStockValue(e.target.value)}
                                placeholder={formMode === 'set' ? 'e.g., 50' : 'e.g., 10'}
                                className="w-full rounded-lg px-3 py-2.5 text-[13px] outline-none"
                                style={{ border: `1px solid ${Theme.border}`, color: Theme.fg }}
                              />
                            </div>

                            <div>
                              <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.05em]" style={{ color: Theme.mutedFg }}>
                                Current Stock
                              </label>
                              <div
                                className="rounded-lg px-3 py-2.5 text-[13px] font-bold"
                                style={{
                                  border: `1px solid ${Theme.border}`,
                                  color: Theme.primary,
                                  background: Theme.muted,
                                }}
                              >
                                {(() => {
                                  const activeCol = colors.find((c: any) => c.name === (formColorName || colors[0]?.name));
                                  if (activeCol?.sizes && activeCol.sizes.length > 0) {
                                    const sz = activeCol.sizes.find((s: any) => s.name === formSizeName) || activeCol.sizes[0];
                                    return `${sz?.quantity ?? 0} units`;
                                  }
                                  return `${activeCol?.quantity ?? 0} units`;
                                })()}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }

                // PRODUCT HAS STANDALONE SIZES (NO COLORS)
                return (
                  <div className="mt-2 flex flex-col gap-3">
                    {/* Size Adjustment Mode Switcher */}
                    <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: Theme.border }}>
                      <div className="text-xs font-bold uppercase tracking-[0.05em]" style={{ color: Theme.mutedFg }}>
                        {t.inventory.sizeBreakdown || 'Product Sizes Stock'}
                      </div>
                      <div className="flex gap-1 rounded-lg p-[3px]" style={{ background: Theme.muted }}>
                        <button
                          type="button"
                          onClick={() => setSizeAdjustmentMode('all')}
                          className="cursor-pointer rounded-md border-none px-3 py-1.5 text-xs font-semibold"
                          style={{
                            background: sizeAdjustmentMode === 'all' ? '#fff' : 'transparent',
                            color: sizeAdjustmentMode === 'all' ? Theme.primary : Theme.mutedFg,
                            boxShadow: sizeAdjustmentMode === 'all' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                          }}
                        >
                          📋 {t.inventory.allSizes || 'All Sizes'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSizeAdjustmentMode('single');
                            const sName = formSizeName || sizes[0]?.name;
                            setFormSizeName(sName);
                            const sObj = sizes.find((s: any) => s.name === sName);
                            setFormStockValue((sObj?.quantity ?? 0).toString());
                          }}
                          className="cursor-pointer rounded-md border-none px-3 py-1.5 text-xs font-semibold"
                          style={{
                            background: sizeAdjustmentMode === 'single' ? '#fff' : 'transparent',
                            color: sizeAdjustmentMode === 'single' ? Theme.primary : Theme.mutedFg,
                            boxShadow: sizeAdjustmentMode === 'single' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                          }}
                        >
                          🎯 {t.inventory.sizeStock || 'Single Size'}
                        </button>
                      </div>
                    </div>

                    {sizeAdjustmentMode === 'all' ? (
                      <div className="rounded-xl border p-3.5 bg-gray-50/50" style={{ borderColor: Theme.border }}>
                        <div className="mb-2.5 text-xs text-muted-foreground">
                          Enter stock for each size. The total inventory stock will automatically equal the sum of all sizes.
                        </div>
                        <div className="flex flex-col gap-2">
                          {sizes.map((s: any) => (
                            <div key={s.name} className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-white border border-gray-100">
                              <div className="min-w-0">
                                <span className="font-semibold text-sm text-foreground">{s.name}</span>
                                <div className="text-[11px] text-muted-foreground">
                                  Current: <span className="font-bold text-gray-700">{s.quantity ?? 0}</span> units
                                </div>
                              </div>
                              <div className="w-36">
                                <label className="block text-[10px] font-semibold text-muted-foreground mb-0.5">New Stock</label>
                                <input
                                  type="number"
                                  min="0"
                                  className="w-full box-border rounded-lg border border-border bg-white px-3 py-1.5 text-[13px] text-foreground outline-none font-bold"
                                  value={sizeStocks[s.name] !== undefined ? sizeStocks[s.name] : ((s.quantity && s.quantity > 0) ? s.quantity.toString() : '')}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setSizeStocks(prev => ({ ...prev, [s.name]: val }));
                                  }}
                                  onFocus={(e) => {
                                    if (e.target.value === '0') {
                                      setSizeStocks(prev => ({ ...prev, [s.name]: '' }));
                                    }
                                  }}
                                  placeholder="0"
                                />
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Sum of all sizes display */}
                        <div className="mt-3 flex items-center justify-between p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900">
                          <span className="text-xs font-bold">{t.inventory.totalSizesStock || 'Total Stock (Sum of Sizes)'}:</span>
                          <span className="text-base font-extrabold text-emerald-700">{totalVariantStocksSum} units</span>
                        </div>
                      </div>
                    ) : (
                      /* Single Size Adjustment Mode */
                      <div className="flex flex-col gap-3">
                        <div>
                          <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.05em]" style={{ color: Theme.mutedFg }}>
                            {t.inventory.size}
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {sizes.map((s: any) => (
                              <button
                                key={s.name}
                                type="button"
                                onClick={() => {
                                  setFormSizeName(s.name);
                                  setFormStockValue((s.quantity ?? 0).toString());
                                }}
                                className="rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5"
                                style={{
                                  borderColor: formSizeName === s.name ? Theme.primary : Theme.border,
                                  background: formSizeName === s.name ? Theme.primary : '#fff',
                                  color: formSizeName === s.name ? '#fff' : Theme.fg,
                                }}
                              >
                                <span>{s.name}</span>
                                <span className={`text-[10px] px-1 rounded ${formSizeName === s.name ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'}`}>
                                  {s.quantity ?? 0}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className={`grid gap-3 ${isMobile ? 'grid-cols-1' : 'grid-cols-3'}`}>
                          <div>
                            <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.05em]" style={{ color: Theme.mutedFg }}>
                              {t.inventory.mode}
                            </label>
                            <div className="flex gap-1 rounded-lg p-[3px]" style={{ background: Theme.muted }}>
                              {(['set', 'add'] as const).map((mode) => (
                                <button
                                  key={mode}
                                  type="button"
                                  onClick={() => setFormMode(mode)}
                                  className="flex-1 cursor-pointer rounded-md border-none px-2 py-2 text-xs font-semibold capitalize"
                                  style={{
                                    background: formMode === mode ? '#fff' : 'transparent',
                                    color: formMode === mode ? Theme.primary : Theme.mutedFg,
                                    boxShadow: formMode === mode ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                                  }}
                                >
                                  {mode === 'set' ? `🔢 ${t.inventory.setStock}` : `➕ ${t.inventory.addToStock}`}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.05em]" style={{ color: Theme.mutedFg }}>
                              {formMode === 'set' ? `New Stock for ${formSizeName}` : `Add Qty to ${formSizeName}`}
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={formStockValue}
                              onChange={(e) => setFormStockValue(e.target.value)}
                              placeholder={formMode === 'set' ? 'e.g., 50' : 'e.g., 10'}
                              className="w-full rounded-lg px-3 py-2.5 text-[13px] outline-none"
                              style={{ border: `1px solid ${Theme.border}`, color: Theme.fg }}
                            />
                          </div>

                          <div>
                            <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.05em]" style={{ color: Theme.mutedFg }}>
                              Current {formSizeName} Stock
                            </label>
                            <div
                              className="rounded-lg px-3 py-2.5 text-[13px] font-bold"
                              style={{
                                border: `1px solid ${Theme.border}`,
                                color: Theme.primary,
                                background: Theme.muted,
                              }}
                            >
                              {(sizes.find((s: any) => s.name === formSizeName)?.quantity ?? 0)} units
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Unit info display */}
              {(() => {
                const meta = formProductId ? getProductMeta(parseInt(formProductId)) : null;
                if (!meta) return null;
                return (
                  <div className="mt-2 text-xs" style={{ color: Theme.mutedFg }}>
                    {t.inventory.unit} <span className="font-semibold">{(meta as any).unitType === 'WEIGHT' ? '⚖️' : '📦'} {(meta as any).unitLabel}</span>
                  </div>
                );
              })()}

              {formMode === 'add' && (
                <div className={`mt-3 grid gap-3 ${isMobile ? 'grid-cols-1' : 'grid-cols-3'}`}>
                  <div className={isMobile ? '' : 'col-span-3'}>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.05em]" style={{ color: Theme.mutedFg }}>
                      {t.inventory.batchName}
                    </label>
                    <input
                      value={batchName}
                      onChange={(e) => setBatchName(e.target.value)}
                      placeholder="e.g., BATCH-APR-01"
                      className="w-full rounded-lg px-3 py-2.5 text-[13px] outline-none"
                      style={{ border: `1px solid ${Theme.border}`, color: Theme.fg }}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.05em]" style={{ color: Theme.mutedFg }}>
                      {t.inventory.mfgDate}
                    </label>
                    <input
                      type="date"
                      value={mfgDate}
                      onChange={(e) => setMfgDate(e.target.value)}
                      className="w-full rounded-lg px-3 py-2.5 text-[13px] outline-none"
                      style={{ border: `1px solid ${Theme.border}`, color: Theme.fg }}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.05em]" style={{ color: Theme.mutedFg }}>
                      {t.inventory.expDate}
                    </label>
                    <input
                      type="date"
                      value={expDate}
                      onChange={(e) => setExpDate(e.target.value)}
                      className="w-full rounded-lg px-3 py-2.5 text-[13px] outline-none"
                      style={{ border: `1px solid ${Theme.border}`, color: Theme.fg }}
                    />
                  </div>
                </div>
              )}

              <Btn onClick={handleFormSubmit} className="mt-3.5 w-full" disabled={adjustStockMutation.isPending}>
                ✓ {(() => {
                  const meta = formProductId ? getProductMeta(parseInt(formProductId)) : null;
                  const hasColors = ((meta as any)?.colors || []).length > 0;
                  const hasSizes = ((meta as any)?.sizes || []).length > 0;
                  if ((hasColors || hasSizes) && sizeAdjustmentMode === 'all') {
                    return `Save Variant Stocks (Total: ${totalVariantStocksSum} units)`;
                  }
                  return formMode === 'set' ? t.inventory.setStock : t.inventory.addToStock;
                })()}
              </Btn>
            </Card>
          </div>
        </div>
      )}

        {/* Recent Manual Sales */}
        <Card>
          <SecHead title={t.inventory.recentManualSales} sub={t.inventory.latestTransactions} />
          {sellLog.slice(0, 5).map((log: any) => (
            <div
              key={log.id}
              className="flex items-center justify-between border-b px-3 py-3"
              style={{ borderBottomColor: Theme.border }}
            >
              <div>
                <div className="font-semibold" style={{ color: Theme.fg }}>
                  {log.product}
                </div>
                <div className="text-xs" style={{ color: Theme.mutedFg }}>
                  {log.date}
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold">{log.qty} {t.inventory.units}</div>
                <div className="text-xs" style={{ color: Theme.mutedFg }}>
                  ৳{log.amount}
                </div>
              </div>
            </div>
          ))}
        </Card>
      </>
    )}
  </div>
);
}
