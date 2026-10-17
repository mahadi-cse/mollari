'use client';

import React, { useRef, useState } from 'react';
import { Theme, generateCodeFromName } from '@/modules/dashboard/utils/theme';
import { useResponsive } from '@/shared/hooks/useResponsive';
import { Card, Btn } from '@/shared/components/ui/Primitives';
import {
  useListCategories,
} from '@/modules/categories';
import {
  useListProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  useBulkImportProducts
} from '@/modules/products';
import { useListBranches } from '@/modules/branches';
import { toast } from 'react-hot-toast';
import ImageUploader from '@/shared/components/forms/ImageUploader';
import type { ImageUploaderRef } from '@/shared/components/forms/ImageUploader';
import { confirmDialog } from '@/shared/lib/confirmDialog';
import { useDashboardLocale } from '@/modules/dashboard/locales/DashboardLocaleContext';
import BarcodeScannerModal from '@/modules/dashboard/components/BarcodeScannerModal';
import BulkUploadModal from '@/modules/dashboard/components/BulkUploadModal';
import { downloadProductSample } from '@/shared/utils/sampleFiles';
import type { BulkUploadColumn } from '@/modules/dashboard/components/BulkUploadModal';

const inputClass = 'w-full box-border rounded-lg border border-border bg-white px-[14px] py-2.5 text-[13px] text-foreground outline-none';
const selectClass = `${inputClass} cursor-pointer`;
const labelClass = 'mb-1.5 block text-xs font-semibold text-foreground';

export default function ProductsView() {
  const { isMobile } = useResponsive();
  const { t } = useDashboardLocale();
  const [filterBranchId, setFilterBranchId] = useState('');
  const [productCategoryBranchId, setProductCategoryBranchId] = useState('');
  const productImageRef = useRef<ImageUploaderRef>(null);

  const { data: productCategories = [], isLoading: isLoadingProductCategories } = useListCategories(
    productCategoryBranchId ? { includeInactive: true, branchId: Number(productCategoryBranchId) } : undefined,
    { enabled: !!productCategoryBranchId, queryKey: ['categories', 'list', 'product-form', { branchId: productCategoryBranchId, includeInactive: true }] }
  );
  const { data: apiProducts = [], isLoading: isLoadingProducts } = useListProducts(
    { limit: 100, includeInactive: true, ...(filterBranchId ? { branchId: Number(filterBranchId) } : {}) } as any,
    { queryKey: ['products', 'list', { branchId: filterBranchId, includeInactive: true }] }
  );
  const { data: branches = [] } = useListBranches();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const bulkImportProducts = useBulkImportProducts();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSavingProduct = createProduct.isPending || updateProduct.isPending || isSubmitting;


  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [editProduct, setEditProduct] = useState<number | null>(null);
  const [isSkuManual, setIsSkuManual] = useState(false);
  const [barcodeScannerOpen, setBarcodeScannerOpen] = useState(false);
  const [productForm, setProductForm] = useState({
    name: '', sku: '', barcode: '', categoryId: '', branchId: '', price: '', costPrice: '', stock: '', description: '', image: '',
    unitType: 'PIECE' as 'PIECE' | 'WEIGHT', unitLabel: 'pc',
    hasSizes: false,
    diffPricePerSize: false,
    sizes: [] as Array<{ name: string; quantity: string; priceOverride: string; costPriceOverride: string }>,
  });

  const sizesTotalStock = React.useMemo(() => {
    if (!productForm.hasSizes || productForm.sizes.length === 0) return 0;
    return productForm.sizes.reduce((sum, s) => {
      const q = parseInt(s.quantity, 10);
      return sum + (isNaN(q) ? 0 : Math.max(0, q));
    }, 0);
  }, [productForm.hasSizes, productForm.sizes]);

  React.useEffect(() => {
    if (!productForm.branchId && productForm.categoryId) setProductForm(prev => ({ ...prev, categoryId: '' }));
  }, [productForm.branchId, productForm.categoryId]);

  React.useEffect(() => {
    if (!productForm.categoryId || productCategories.length === 0) return;
    if (!productCategories.some((c: any) => String(c.id) === productForm.categoryId)) setProductForm(prev => ({ ...prev, categoryId: '' }));
  }, [productCategories, productForm.categoryId]);

  const resetForm = () => {
    setProductForm({
      name: '', sku: '', barcode: '', categoryId: '', branchId: '', price: '', costPrice: '', stock: '', description: '', image: '',
      unitType: 'PIECE', unitLabel: 'pc',
      hasSizes: false,
      diffPricePerSize: false,
      sizes: []
    });
    setIsSkuManual(false);
    setShowAddProduct(false); setEditProduct(null); setProductCategoryBranchId('');
  };

  const openProductEditor = (product: any) => {
    const editBranchId = product.inventories?.[0]?.warehouseId?.toString() || '';
    setProductCategoryBranchId(editBranchId);
    const existingSizes = product.sizes || [];
    const hasSizes = existingSizes.length > 0;
    const diffPricePerSize = existingSizes.some((s: any) => s.priceOverride !== null || s.costPriceOverride !== null);

    setProductForm({
      name: product.name, sku: product.sku, barcode: product.barcode || '', categoryId: product.categoryId?.toString() || '', branchId: editBranchId,
      price: product.price?.toString() || '', costPrice: product.costPrice?.toString() || '', stock: product.inventories?.[0]?.quantity?.toString() || '', description: product.description || '',
      image: product.images?.[0] || '', unitType: product.unitType || 'PIECE', unitLabel: product.unitLabel || 'pc',
      hasSizes,
      diffPricePerSize,
      sizes: existingSizes.map((s: any) => ({
        name: s.name,
        quantity: s.quantity && s.quantity > 0 ? s.quantity.toString() : '',
        priceOverride: s.priceOverride?.toString() || '',
        costPriceOverride: s.costPriceOverride?.toString() || ''
      })),
    });
    setIsSkuManual(true);
    setEditProduct(product.id); setShowAddProduct(true);
  };

  const handleAddProduct = async () => {
    if (!productForm.name || !productForm.sku || !productForm.price || !productForm.categoryId || !productForm.branchId) {
      return toast.error(t.products.fillRequired);
    }

    if (productForm.hasSizes) {
      if (productForm.sizes.length === 0) {
        return toast.error(t.products.addAtLeastOneSize || 'Please add at least one size or uncheck "Has Sizes".');
      }

      const trimmedSizes = productForm.sizes.map((s) => ({ ...s, name: s.name.trim() }));
      const hasEmptyName = trimmedSizes.some((s) => !s.name);
      if (hasEmptyName) {
        return toast.error(t.products.emptySizeName || 'Please enter a name for all added sizes, or remove unused ones.');
      }

      const namesLower = trimmedSizes.map((s) => s.name.toLowerCase());
      const hasDuplicates = new Set(namesLower).size !== namesLower.length;
      if (hasDuplicates) {
        return toast.error(t.products.duplicateSizeNames || 'Each size must have a unique name (e.g. S, M, L).');
      }
    }

    setIsSubmitting(true);
    
    const savePromise = (async () => {
      let imageUrl = productForm.image;
      if (productImageRef.current?.hasPending()) { const uploaded = await productImageRef.current.upload(); if (uploaded) imageUrl = uploaded; }
      const defaultImage = 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?q=80&w=800&auto=format&fit=crop';
      const images = imageUrl ? [imageUrl] : [defaultImage];
      const computedStock = productForm.hasSizes
        ? sizesTotalStock
        : (productForm.stock ? Number(productForm.stock) : 0);

      const sizesPayload = productForm.hasSizes
        ? productForm.sizes
            .filter((s) => s.name.trim())
            .map((s, i) => ({
              name: s.name.trim(),
              sortOrder: i,
              imageUrl: null,
              quantity: Math.max(0, parseInt(s.quantity, 10) || 0),
              priceOverride: productForm.diffPricePerSize && s.priceOverride ? Number(s.priceOverride) : null,
              costPriceOverride: productForm.diffPricePerSize && s.costPriceOverride ? Number(s.costPriceOverride) : null,
            }))
        : [];
      const payload = {
        name: productForm.name,
        sku: productForm.sku,
        barcode: productForm.barcode || undefined,
        price: Number(productForm.price),
        costPrice: productForm.costPrice ? Number(productForm.costPrice) : undefined,
        categoryId: Number(productForm.categoryId),
        branchId: Number(productForm.branchId),
        description: productForm.description,
        images,
        unitType: productForm.unitType,
        unitLabel: productForm.unitLabel,
        sizes: sizesPayload,
        openingStock: computedStock,
      } as any;
      if (editProduct) { await updateProduct.mutateAsync({ id: editProduct, ...payload }); }
      else { await createProduct.mutateAsync(payload); }
      resetForm();
    })();

    toast.promise(savePromise, {
      loading: editProduct ? 'Updating product...' : 'Creating product...',
      success: editProduct ? t.products.productUpdated : t.products.productCreated,
      error: (err: any) => err?.message || t.products.failedSave,
    }).finally(() => {
      setIsSubmitting(false);
    });
  };

  const handleDeleteProduct = async (id: number) => {
    if (await confirmDialog({ title: t.products.deleteConfirmTitle, text: t.products.deleteConfirmText, confirmButtonText: t.products.yesDelete, icon: 'warning' })) {
      try { await deleteProduct.mutateAsync(id); toast.success(t.products.productDeleted); } catch { toast.error(t.products.failedDelete); }
    }
  };

  const handleUpdateProductStatus = async (id: number, isActive: boolean) => {
    try { await updateProduct.mutateAsync({ id, isActive } as any); toast.success(isActive ? t.products.productActivated : t.products.productDeactivated); } catch { toast.error(t.products.failedStatusUpdate); }
  };

  const productsList = apiProducts;

  const productBulkColumns: BulkUploadColumn[] = [
    { header: 'name', key: 'name', required: true, type: 'string', example: 'Rose Glow Serum' },
    { header: 'sku', key: 'sku', required: true, type: 'string', example: 'SKU-001' },
    { header: 'barcode', key: 'barcode', required: false, type: 'string', example: '8901234567890' },
    { header: 'price', key: 'price', required: true, type: 'number', example: '1250' },
    { header: 'costPrice', key: 'costPrice', required: false, type: 'number', example: '800' },
    { header: 'categoryId', key: 'categoryId', required: true, type: 'number', example: '1' },
    { header: 'description', key: 'description', required: false, type: 'string', example: 'A luxurious rose serum' },
    { header: 'branchId', key: 'branchId', required: false, type: 'number', example: '1' },
    { header: 'openingStock', key: 'openingStock', required: false, type: 'number', example: '50' },
    { header: 'unitType', key: 'unitType', required: false, type: 'string', example: 'PIECE' },
    { header: 'unitLabel', key: 'unitLabel', required: false, type: 'string', example: 'pc' },
  ];

  return (
    <div className="flex flex-col gap-4">
      <BarcodeScannerModal
        open={barcodeScannerOpen}
        onClose={() => setBarcodeScannerOpen(false)}
        onScan={(code) => {
          setProductForm(prev => ({ ...prev, barcode: code }));
          setBarcodeScannerOpen(false);
        }}
      />
      <Card className={isMobile ? 'p-[18px]' : 'p-7'}>
        <div className="mb-[14px] flex flex-wrap items-center justify-between gap-2">
          <div className="text-[13px]" style={{ color: Theme.mutedFg }}>
            {isLoadingProducts ? t.products.loadingProducts : `${productsList.length} ${t.products.product}${productsList.length !== 1 ? 's' : ''}${filterBranchId ? ` ${t.products.inBranch} ${branches.find((b: any) => b.id === Number(filterBranchId))?.name ?? t.sales.branch.replace(' *', '')}` : ` ${t.products.acrossBranches}`}`}
          </div>
          <div className="flex items-center gap-2">
            <select className={selectClass} value={filterBranchId} onChange={(e) => setFilterBranchId(e.target.value)} style={{ minWidth: 140 }}>
              <option value="">{t.products.allBranches}</option>
              {branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <Btn variant="secondary" size="sm" onClick={() => setShowBulkUpload(true)}>Bulk Upload</Btn>
            <Btn variant="primary" size="sm" onClick={() => { setProductCategoryBranchId(filterBranchId); setProductForm({ ...productForm, branchId: filterBranchId, categoryId: '', name: '', sku: '', price: '', costPrice: '', stock: '', description: '', image: '', unitType: 'PIECE', unitLabel: 'pc', sizes: [], hasSizes: false, diffPricePerSize: false }); setShowAddProduct(true); }}>{t.products.addProduct}</Btn>
          </div>
        </div>

        {(showAddProduct || editProduct !== null) && (
          <div className="mb-4 rounded-xl border-[1.5px] p-4" style={{ borderColor: Theme.primary, background: Theme.secondary }}>
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-bold" style={{ color: Theme.primary }}>{editProduct !== null ? t.products.editProduct : t.products.newProduct}</div>
              <button type="button" onClick={resetForm} className="cursor-pointer border-none bg-transparent text-lg leading-none" style={{ color: Theme.mutedFg }}>✕</button>
            </div>
            <div className={`grid gap-[14px] ${isMobile ? 'grid-cols-1' : 'grid-cols-4'}`}>
              <div><label className={labelClass}>{t.products.productName}</label><input placeholder="e.g. Rose Glow Serum" className={inputClass} value={productForm.name} onChange={(e) => {
                const val = e.target.value;
                setProductForm(prev => {
                  const next = { ...prev, name: val };
                  if (!isSkuManual) {
                    next.sku = generateCodeFromName(val);
                  }
                  return next;
                });
              }} /></div>
              <div><label className={labelClass}>{t.products.sku}</label><input placeholder="e.g. SKU-019" className={inputClass} value={productForm.sku} onChange={(e) => {
                setIsSkuManual(true);
                setProductForm({ ...productForm, sku: e.target.value });
              }} /></div>
              <div><label className={labelClass}>{t.products.barcode}</label><div className="flex gap-1.5"><input placeholder="e.g. 8901234567890" className={inputClass} value={productForm.barcode} onChange={(e) => setProductForm({ ...productForm, barcode: e.target.value })} /><button type="button" onClick={() => setBarcodeScannerOpen(true)} className="shrink-0 flex items-center justify-center w-10 rounded-lg border border-border bg-white transition hover:bg-gray-50" title="Scan barcode"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" /><path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" /><line x1="7" y1="12" x2="17" y2="12" /><line x1="7" y1="8" x2="17" y2="8" /><line x1="7" y1="16" x2="17" y2="16" /></svg></button></div></div>
              <div><label className={labelClass}>{t.products.branch}</label><select className={selectClass} value={productForm.branchId} onChange={(e) => { setProductCategoryBranchId(e.target.value); setProductForm({ ...productForm, branchId: e.target.value, categoryId: '' }); }}><option value="">{t.products.selectBranch}</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
              <div><label className={labelClass}>{t.products.category}</label><select className={selectClass} value={productForm.categoryId} disabled={!productForm.branchId || isLoadingProductCategories} onChange={(e) => setProductForm({ ...productForm, categoryId: e.target.value })}><option value="">{!productForm.branchId ? t.products.selectBranchFirst : isLoadingProductCategories ? t.products.loading : t.products.selectCategory}</option>{productCategories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div><label className={labelClass}>{t.products.sellingPrice}</label><input type="number" placeholder="0" className={inputClass} value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: e.target.value })} /></div>
              <div><label className={labelClass}>{t.products.costPrice}</label><input type="number" placeholder="0" className={inputClass} value={productForm.costPrice} onChange={(e) => setProductForm({ ...productForm, costPrice: e.target.value })} /></div>
              {productForm.hasSizes ? (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className={labelClass} style={{ marginBottom: 0 }}>
                      {t.products.totalStockCalculated || 'Opening Stock (Sum of Sizes)'}
                    </label>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                      Auto-sum
                    </span>
                  </div>
                  <div className={`${inputClass} flex items-center justify-between font-bold text-primary bg-gray-50 border-blue-200`}>
                    <span>{sizesTotalStock} units</span>
                    <span className="text-[11px] font-normal text-muted-foreground">({productForm.sizes.filter(s => s.name.trim()).length} sizes)</span>
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    {t.products.sumOfSizesNote || 'Total opening stock is automatically calculated from the sum of all size quantities.'}
                  </div>
                </div>
              ) : editProduct === null ? (
                <div>
                  <label className={labelClass}>{t.products.openingStock}</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    className={inputClass}
                    value={productForm.stock}
                    onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })}
                    onFocus={(e) => {
                      if (e.target.value === '0') {
                        setProductForm(prev => ({ ...prev, stock: '' }));
                      }
                    }}
                  />
                </div>
              ) : null}
              <div className={isMobile ? '' : 'col-span-2'}><label className={labelClass}>{t.products.description}</label><textarea placeholder="..." className={`${inputClass} h-16 resize-y`} value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} /></div>
              <div><label className={labelClass}>{t.products.productImage}</label><ImageUploader ref={productImageRef} value={productForm.image} onChange={(url) => setProductForm({ ...productForm, image: url })} folder="mollari/products" aspect={1} /></div>
            </div>
            <div className={`mt-3 grid gap-[14px] ${isMobile ? 'grid-cols-1' : 'grid-cols-3'}`}>
              <div><label className={labelClass}>{t.products.unitType}</label><select className={selectClass} value={productForm.unitType} onChange={(e) => { const ut = e.target.value as 'PIECE' | 'WEIGHT'; setProductForm({ ...productForm, unitType: ut, unitLabel: ut === 'PIECE' ? 'pc' : 'kg' }); }}><option value="PIECE">{t.products.piece}</option><option value="WEIGHT">{t.products.weight}</option></select></div>
              <div><label className={labelClass}>{t.products.unitLabel}</label><input className={inputClass} value={productForm.unitLabel} onChange={(e) => setProductForm({ ...productForm, unitLabel: e.target.value })} placeholder="e.g. pc, kg, ml" /></div>
            </div>
            <div className={`mt-3 grid gap-[14px] ${isMobile ? 'grid-cols-1' : 'grid-cols-2'}`}>
              <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-foreground">
                <input
                  type="checkbox"
                  checked={productForm.hasSizes}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setProductForm(prev => ({
                      ...prev,
                      hasSizes: checked,
                      sizes: checked && prev.sizes.length === 0 ? [{ name: '', quantity: '', priceOverride: '', costPriceOverride: '' }] : prev.sizes
                    }));
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                />
                {t.products.hasSizes}
              </label>

              {productForm.hasSizes && (
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-foreground animate-in fade-in duration-200">
                  <input
                    type="checkbox"
                    checked={productForm.diffPricePerSize}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setProductForm(prev => ({
                        ...prev,
                        diffPricePerSize: checked
                      }));
                    }}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                  />
                  {t.products.differentPricePerSize}
                </label>
              )}
            </div>

            {productForm.hasSizes && (
              <div className="mt-3 p-3 rounded-xl border bg-gray-50/50" style={{ borderColor: Theme.border }}>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <label className={labelClass} style={{ marginBottom: 0 }}>{t.products.sizesOptional}</label>
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Total Stock: {sizesTotalStock} units
                    </span>
                  </div>
                  <Btn variant="ghost" size="sm" onClick={() => setProductForm({ ...productForm, sizes: [...productForm.sizes, { name: '', quantity: '', priceOverride: '', costPriceOverride: '' }] })}>{t.products.addSize}</Btn>
                </div>
                {productForm.sizes.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {productForm.sizes.map((size, idx) => {
                      const trimmedName = size.name.trim();
                      const isDuplicate = !!trimmedName && productForm.sizes.some((other, oIdx) => oIdx !== idx && other.name.trim().toLowerCase() === trimmedName.toLowerCase());
                      const isEmpty = !trimmedName && productForm.sizes.length > 1;

                      return (
                        <div
                          key={idx}
                          className={`grid items-end gap-2 p-2 rounded-lg bg-white border ${
                            isDuplicate ? 'border-red-300 ring-1 ring-red-200' : 'border-gray-100'
                          } ${
                            productForm.diffPricePerSize
                              ? (isMobile ? 'grid-cols-1' : 'grid-cols-5')
                              : (isMobile ? 'grid-cols-1' : 'grid-cols-3')
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="block text-[10px] font-semibold text-foreground">{t.products.sizeName}</label>
                              {isDuplicate && (
                                <span className="text-[9px] font-semibold text-red-500">Duplicate</span>
                              )}
                              {isEmpty && (
                                <span className="text-[9px] font-semibold text-amber-500">Required</span>
                              )}
                            </div>
                            <input
                              className={`${inputClass} ${isDuplicate ? 'border-red-400 focus:border-red-500' : ''}`}
                              value={size.name}
                              onChange={(e) => {
                                const n = [...productForm.sizes];
                                n[idx] = { ...n[idx], name: e.target.value };
                                setProductForm({ ...productForm, sizes: n });
                              }}
                              placeholder="e.g. S, M, L"
                            />
                          </div>

                        <div>
                          <label className="mb-1 block text-[10px] font-semibold text-foreground">{t.products.sizeQuantity || 'Quantity *'}</label>
                          <input
                            type="number"
                            min="0"
                            className={inputClass}
                            value={size.quantity}
                            onChange={(e) => {
                              const n = [...productForm.sizes];
                              n[idx] = { ...n[idx], quantity: e.target.value };
                              setProductForm({ ...productForm, sizes: n });
                            }}
                            onFocus={(e) => {
                              if (e.target.value === '0') {
                                const n = [...productForm.sizes];
                                n[idx] = { ...n[idx], quantity: '' };
                                setProductForm({ ...productForm, sizes: n });
                              }
                            }}
                            placeholder="0"
                          />
                        </div>

                        {productForm.diffPricePerSize && (
                          <>
                            <div>
                              <label className="mb-1 block text-[10px] font-semibold text-foreground">{t.products.costPriceOverride}</label>
                              <input
                                type="number"
                                className={inputClass}
                                value={size.costPriceOverride || ''}
                                onChange={(e) => {
                                  const n = [...productForm.sizes];
                                  n[idx] = { ...n[idx], costPriceOverride: e.target.value };
                                  setProductForm({ ...productForm, sizes: n });
                                }}
                                placeholder={t.products.leaveEmpty}
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-[10px] font-semibold text-foreground">{t.products.priceOverride}</label>
                              <input
                                type="number"
                                className={inputClass}
                                value={size.priceOverride}
                                onChange={(e) => {
                                  const n = [...productForm.sizes];
                                  n[idx] = { ...n[idx], priceOverride: e.target.value };
                                  setProductForm({ ...productForm, sizes: n });
                                }}
                                placeholder={t.products.leaveEmpty}
                              />
                            </div>
                          </>
                        )}

                        <div className="text-right">
                          <Btn
                            variant="ghost"
                            size="sm"
                            onClick={() => setProductForm({ ...productForm, sizes: productForm.sizes.filter((_, i) => i !== idx) })}
                            className="text-red-500 hover:text-red-700"
                          >
                            {t.products.remove}
                          </Btn>
                        </div>
                      </div>
                    ); })}
                  </div>
                )}
              </div>
            )}
            <div className="mt-3 flex gap-2"><Btn variant="ghost" size="sm" onClick={resetForm} disabled={isSavingProduct}>{t.products.cancel}</Btn><Btn variant="primary" size="sm" onClick={handleAddProduct} loading={isSavingProduct}>{editProduct !== null ? t.products.saveChanges : t.products.createProduct}</Btn></div>
          </div>
        )}

        <div className="flex flex-col gap-2.5">
          {isLoadingProducts ? <div className="py-4 text-center text-sm">{t.products.loadingProducts}</div> : productsList.length === 0 ? <div className="py-4 text-center text-sm">{t.products.noProducts}</div> : productsList.map((p: any) => (
            <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-[10px] border border-border bg-white px-[14px] py-3" style={{ opacity: p.isActive ? 1 : 0.6 }}>
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded text-lg" style={{ background: Theme.muted }}>{p.images?.[0] ? <img src={p.images[0]} alt={p.name} className="h-full w-full object-cover" /> : '📦'}</div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-semibold" style={{ color: Theme.fg }}>{p.name}</span>
                  {!p.isActive && <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[9px] font-bold text-gray-500 uppercase">{t.products.inactive}</span>}
                  <span className="text-[11px]" style={{ color: Theme.mutedFg }}>
                    · Sell: ৳{p.price}
                    {p.costPrice ? ` · Cost: ৳${p.costPrice}` : ''}
                  </span>
                </div>
                <div className="text-[11px]" style={{ color: Theme.mutedFg }}>
                  {p.category?.name || t.uncategorized} · {t.sales.branch}: {branches.find((b: any) => b.id === p.inventories?.[0]?.warehouseId)?.name || 'Default'} · {t.modal.sku}: {p.sku} · {p.unitType === 'WEIGHT' ? `⚖️ ${p.unitLabel}` : `📦 ${p.unitLabel}`}
                  {p.sizes?.length > 0 && (
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      <span className="font-semibold text-foreground mr-1">{t.products.sizeS}:</span>
                      {p.sizes.map((s: any) => (
                        <span key={s.id || s.name} className="inline-flex items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-700 border border-gray-200">
                          <span>{s.name}:</span>
                          <span className="font-bold text-primary">{s.quantity ?? 0}</span>
                          {s.priceOverride !== null && s.priceOverride !== undefined && (
                            <span className="text-[9px] text-emerald-600 font-semibold">(৳{s.priceOverride})</span>
                          )}
                        </span>
                      ))}
                      <span className="text-[10px] text-muted-foreground ml-1">
                        (Total: {p.sizes.reduce((sum: number, s: any) => sum + (s.quantity ?? 0), 0)} units)
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Btn variant="ghost" size="sm" onClick={() => openProductEditor(p)}>{t.inventory.edit}</Btn>
                <Btn variant="ghost" size="sm" onClick={() => handleUpdateProductStatus(p.id, !p.isActive)}>{p.isActive ? t.products.deactivate : t.products.activate}</Btn>
                <Btn variant="ghost" size="sm" onClick={() => handleDeleteProduct(p.id)}>🗑️</Btn>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <BulkUploadModal
        open={showBulkUpload}
        onClose={() => setShowBulkUpload(false)}
        title="Bulk Upload Products"
        columns={productBulkColumns}
        onUpload={async (data) => {
          const res = await bulkImportProducts.mutateAsync(data);
          return res;
        }}
        onDownloadSample={downloadProductSample}
      />
    </div>
  );
}
