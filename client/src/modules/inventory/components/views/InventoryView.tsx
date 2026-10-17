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
      sizes: item.product?.sizes || [],
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
      .filter((p: any) =>
        p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
      )
      .slice(0, 50);
  }, [formBranchId, modalProducts, productQuery]);

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
      const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         p.sku.toLowerCase().includes(searchQuery.toLowerCase());
      const status = getStatus(p.stock);
      const matchFilter = activeFilter === 'all' || status === activeFilter;
      return matchSearch && matchFilter;
    });
  }, [branchProducts, searchQuery, activeFilter]);

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    return {
      totalSkus: branchProducts.length,
      totalUnits: branchProducts.reduce((sum: number, p: any) => sum + p.stock, 0),
      lowStockCount: branchProducts.filter((p: any) => getStatus(p.stock) === 'low').length,
      outOfStockCount: branchProducts.filter((p: any) => getStatus(p.stock) === 'out').length,
    };
  }, [branchProducts]);

  const totalSizeStocksSum = useMemo(() => {
    return Object.values(sizeStocks).reduce((sum, val) => {
      const q = parseInt(val, 10);
      return sum + (isNaN(q) ? 0 : Math.max(0, q));
    }, 0);
  }, [sizeStocks]);

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
    const productSizes = (meta as any)?.sizes || [];
    const hasSizes = productSizes.length > 0;

    // 1. All Sizes Mode
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

    // 2. Single Size or Regular Product
    const enteredValue = parseInt(formStockValue);
    if (isNaN(enteredValue) || enteredValue < 0 || !selectedProduct) {
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
    setFormSizeName('');
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
      setSizeStocks({});
      setFormSizeName('');
    }
  }, [formBranchId, formProductId, modalProducts]);

  React.useEffect(() => {
    if (formProductId) {
      const meta = getProductMeta(parseInt(formProductId));
      const sizes = (meta as any)?.sizes || [];
      if (sizes.length > 0) {
        const initSizes: Record<string, string> = {};
        sizes.forEach((s: any) => {
          initSizes[s.name] = (s.quantity && s.quantity > 0) ? s.quantity.toString() : '';
        });
        setSizeStocks(initSizes);
        if (!formSizeName || !sizes.some((s: any) => s.name === formSizeName)) {
          setFormSizeName(sizes[0]?.name || '');
          setFormStockValue((sizes[0]?.quantity && sizes[0].quantity > 0) ? sizes[0].quantity.toString() : '');
        }
      } else {
        setSizeStocks({});
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
      {/* Tab Switcher Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3" style={{ borderColor: Theme.border }}>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('current')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer border ${
              activeTab === 'current'
                ? 'bg-foreground text-background border-foreground shadow-xs'
                : 'bg-white text-muted-foreground border-border hover:bg-gray-50'
            }`}
          >
            <span>📦</span>
            <span>{t.inventory.tabCurrentStock || 'Current Stock'}</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                activeTab === 'current'
                  ? 'bg-background/20 text-background'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              {branchProducts.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ledger')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer border ${
              activeTab === 'ledger'
                ? 'bg-foreground text-background border-foreground shadow-xs'
                : 'bg-white text-muted-foreground border-border hover:bg-gray-50'
            }`}
          >
            <span>📋</span>
            <span>{t.inventory.tabLedger || 'Stock Ledger'}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
              Audit Trail
            </span>
          </button>
        </div>

        {activeTab === 'ledger' && (
          <div className="text-xs text-muted-foreground hidden sm:block">
            {t.inventory.ledgerSubtitle}
          </div>
        )}
      </div>

      {activeTab === 'ledger' ? (
        <InventoryLedgerView initialBranchId={selectedBranch} initialSearchQuery={ledgerSearch} />
      ) : (
        <>
          {/* Header with Title and Summary Stats Side by Side */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="text-[18px] font-semibold" style={{ color: Theme.fg }}>
            {t.inventory.title}
          </div>
          <div className="mt-1 text-[13px]" style={{ color: Theme.mutedFg }}>
            {(selectedBranch
              ? branches.find((b) => b.id === Number(selectedBranch))?.name
              : t.inventory.allBranches) || t.na}{' '}
            · {t.inventory.synced}
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 2xl:gap-3 w-full lg:w-auto">
          {[
            { label: t.inventory.totalSkus, val: summaryStats.totalSkus, color: '' },
            { label: t.inventory.totalUnits, val: summaryStats.totalUnits, color: '' },
            { label: t.inventory.lowStock, val: summaryStats.lowStockCount, color: '#854F0B' },
            { label: t.inventory.outOfStock, val: summaryStats.outOfStockCount, color: '#A32D2D' },
          ].map((stat, i) => (
            <div
              key={i}
              className="rounded-lg px-3 py-2"
              style={{ background: Theme.muted }}
            >
              <div className="text-xs" style={{ color: Theme.mutedFg }}>
                {stat.label}
              </div>
              <div className="mt-1 text-lg font-semibold" style={{ color: stat.color || Theme.fg }}>
                {stat.val}
              </div>
            </div>
          ))}
        </div>
      </div>

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
                      width: '40%',
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
                      width: '12%',
                    }}
                  >
                    {t.inventory.stock}
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
                      width: '14%',
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
                      width: '14%',
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
                      width: '6%',
                    }}
                  />
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p: any) => {
                  const status = getStatus(p.stock);
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
                          padding: '10px 12px',
                          borderBottom: `1px solid ${Theme.border}`,
                          verticalAlign: 'middle',
                          fontSize: '13px',
                          color: Theme.fg,
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 500 }}>{p.name}</div>
                          <div style={{ fontSize: '11px', color: Theme.mutedFg, marginTop: '2px', fontFamily: 'monospace' }}>
                            {p.sku}
                          </div>
                        </div>
                      </td>
                      <td
                        style={{
                          padding: '10px 12px',
                          borderBottom: `1px solid ${Theme.border}`,
                          verticalAlign: 'middle',
                          fontSize: '14px',
                          fontWeight: 500,
                          color: getStatusColor(status),
                        }}
                      >
                        <div>
                          <span className="font-bold text-[14px]">{p.stock}</span>
                          {(() => {
                            const sizes = (p.sizes && p.sizes.length > 0) ? p.sizes : ((getProductMeta(p.id) as any)?.sizes || []);
                            if (sizes.length === 0) return null;
                            return (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {sizes.map((s: any) => (
                                  <span
                                    key={s.id || s.name}
                                    className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium border"
                                    style={{
                                      background: s.quantity === 0 ? '#FCEBEB' : s.quantity <= 5 ? '#FAEEDA' : '#F3F4F6',
                                      color: s.quantity === 0 ? '#A32D2D' : s.quantity <= 5 ? '#854F0B' : '#374151',
                                      borderColor: s.quantity === 0 ? '#F87171' : s.quantity <= 5 ? '#FBBF24' : '#E5E7EB',
                                    }}
                                  >
                                    <span>{s.name}:</span>
                                    <span className="font-bold">{s.quantity ?? 0}</span>
                                  </span>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      </td>
                      <td
                        style={{
                          padding: '10px 12px',
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
                          padding: '10px 12px',
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
                          padding: '10px 12px',
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

                            const meta = (p.sizes && p.sizes.length > 0) ? p : (getProductMeta(p.id) || p);
                            const sizes = (meta as any)?.sizes || [];
                            if (sizes.length > 0) {
                              const initSizes: Record<string, string> = {};
                              sizes.forEach((s: any) => {
                                initSizes[s.name] = (s.quantity && s.quantity > 0) ? s.quantity.toString() : '';
                              });
                              setSizeStocks(initSizes);
                              setFormSizeName(sizes[0]?.name || '');
                              setFormStockValue((sizes[0]?.quantity && sizes[0].quantity > 0) ? sizes[0].quantity.toString() : '');
                              setSizeAdjustmentMode('all');
                            } else {
                              setSizeStocks({});
                              setFormSizeName('');
                              setSizeAdjustmentMode('single');
                            }

                            setModalOpen(true);
                          }}
                          className="cursor-pointer rounded border px-2 py-1 text-xs font-medium transition-all"
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
                          <span>📋</span>
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
                          searchableModalProducts.map((p: any) => (
                            <button
                              key={`${p.id}-${p.branchId || 'na'}`}
                              type="button"
                              onClick={() => {
                                setFormProductId(String(p.id));
                                setProductQuery(`${p.name} (${p.sku})`);
                                setShowProductDropdown(false);
                              }}
                              className="w-full cursor-pointer border-0 px-3 py-2 text-left text-[13px]"
                              style={{ background: '#fff', color: Theme.fg }}
                            >
                              <div className="font-semibold">{p.name}</div>
                              <div className="text-[11px]" style={{ color: Theme.mutedFg }}>{t.modal.sku}: {p.sku}</div>
                            </button>
                          ))
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

              {/* Product Size Management in Modal */}
              {(() => {
                const meta = formProductId ? getProductMeta(parseInt(formProductId)) : null;
                const sizes = (meta as any)?.sizes || [];
                if (sizes.length === 0) {
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

                // PRODUCT HAS SIZES
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
                          <span className="text-base font-extrabold text-emerald-700">{totalSizeStocksSum} units</span>
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
                  const hasSizes = ((meta as any)?.sizes || []).length > 0;
                  if (hasSizes && sizeAdjustmentMode === 'all') return `Save Size Stocks (Total: ${totalSizeStocksSum} units)`;
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
