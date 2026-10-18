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
import apiClient from '@/shared/lib/apiClient';
import imageCompression from 'browser-image-compression';

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
    hasColors: false,
    diffPricePerColor: false,
    colors: [] as Array<{
      name: string;
      hexCode: string;
      imageUrl: string;
      quantity: string;
      priceOverride: string;
      costPriceOverride: string;
      sizes: Array<{ name: string; quantity: string; priceOverride: string; costPriceOverride: string }>;
    }>,
  });
  const [uploadingColorIdx, setUploadingColorIdx] = useState<number | null>(null);

  const handleColorImageUpload = async (idx: number, file: File) => {
    try {
      setUploadingColorIdx(idx);
      let uploadFile: File | Blob = file;
      try {
        uploadFile = await imageCompression(file, {
          maxSizeMB: 0.5,
          maxWidthOrHeight: 800,
          useWebWorker: true,
        });
      } catch (err) {
        uploadFile = file;
      }

      const formData = new FormData();
      formData.append('image', uploadFile);

      const res = await apiClient.post('/uploads/image?folder=mollari/products', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const url = res.data?.data?.url;
      if (url) {
        setProductForm((prev) => {
          const next = [...prev.colors];
          next[idx] = { ...next[idx], imageUrl: url };
          return { ...prev, colors: next };
        });
        toast.success('Color image uploaded');
      } else {
        toast.error('Failed to upload image');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Upload failed');
    } finally {
      setUploadingColorIdx(null);
    }
  };

  const computedTotalStock = React.useMemo(() => {
    if (productForm.hasColors) {
      if (productForm.hasSizes) {
        return productForm.colors.reduce((cSum, c) => {
          return cSum + (c.sizes || []).reduce((sSum, s) => {
            const q = parseInt(s.quantity, 10);
            return sSum + (isNaN(q) ? 0 : Math.max(0, q));
          }, 0);
        }, 0);
      } else {
        return productForm.colors.reduce((cSum, c) => {
          const q = parseInt(c.quantity, 10);
          return cSum + (isNaN(q) ? 0 : Math.max(0, q));
        }, 0);
      }
    } else if (productForm.hasSizes) {
      return productForm.sizes.reduce((sum, s) => {
        const q = parseInt(s.quantity, 10);
        return sum + (isNaN(q) ? 0 : Math.max(0, q));
      }, 0);
    }
    const q = parseInt(productForm.stock, 10);
    return isNaN(q) ? 0 : Math.max(0, q);
  }, [productForm.hasColors, productForm.hasSizes, productForm.colors, productForm.sizes, productForm.stock]);

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
      sizes: [],
      hasColors: false,
      diffPricePerColor: false,
      colors: [],
    });
    setIsSkuManual(false);
    setShowAddProduct(false); setEditProduct(null); setProductCategoryBranchId('');
  };

  const openProductEditor = (product: any) => {
    const editBranchId = product.inventories?.[0]?.warehouseId?.toString() || '';
    setProductCategoryBranchId(editBranchId);
    const existingColors = product.colors || [];
    const hasColors = existingColors.length > 0;
    const colorsHaveSizes = existingColors.some((c: any) => c.sizes && c.sizes.length > 0);
    const existingSizes = product.sizes || [];
    const hasSizes = colorsHaveSizes || existingSizes.length > 0;

    const diffPricePerSize = colorsHaveSizes
      ? existingColors.some((c: any) => (c.sizes || []).some((s: any) => s.priceOverride !== null || s.costPriceOverride !== null))
      : existingSizes.some((s: any) => s.priceOverride !== null || s.costPriceOverride !== null);

    const diffPricePerColor = existingColors.some((c: any) => c.priceOverride !== null || c.costPriceOverride !== null);

    setProductForm({
      name: product.name,
      sku: product.sku,
      barcode: product.barcode || '',
      categoryId: product.categoryId?.toString() || '',
      branchId: editBranchId,
      price: product.price?.toString() || '',
      costPrice: product.costPrice?.toString() || '',
      stock: product.inventories?.[0]?.quantity?.toString() || '',
      description: product.description || '',
      image: product.images?.[0] || '',
      unitType: product.unitType || 'PIECE',
      unitLabel: product.unitLabel || 'pc',
      hasSizes,
      diffPricePerSize,
      sizes: existingSizes.map((s: any) => ({
        name: s.name,
        quantity: s.quantity && s.quantity > 0 ? s.quantity.toString() : '',
        priceOverride: s.priceOverride?.toString() || '',
        costPriceOverride: s.costPriceOverride?.toString() || '',
      })),
      hasColors,
      diffPricePerColor,
      colors: existingColors.map((c: any) => ({
        name: c.name,
        hexCode: c.hexCode || '#000000',
        imageUrl: c.imageUrl || '',
        quantity: c.quantity && c.quantity > 0 ? c.quantity.toString() : '',
        priceOverride: c.priceOverride?.toString() || '',
        costPriceOverride: c.costPriceOverride?.toString() || '',
        sizes: (c.sizes || []).map((s: any) => ({
          name: s.name,
          quantity: s.quantity && s.quantity > 0 ? s.quantity.toString() : '',
          priceOverride: s.priceOverride?.toString() || '',
          costPriceOverride: s.costPriceOverride?.toString() || '',
        })),
      })),
    });
    setIsSkuManual(true);
    setEditProduct(product.id);
    setShowAddProduct(true);
  };

  const handleAddProduct = async () => {
    if (!productForm.name || !productForm.sku || !productForm.price || !productForm.categoryId || !productForm.branchId) {
      return toast.error(t.products.fillRequired);
    }

    if (productForm.hasColors) {
      if (productForm.colors.length === 0) {
        return toast.error(t.products.addAtLeastOneColor || 'Please add at least one color or uncheck "Has Colors".');
      }

      const trimmedColors = productForm.colors.map((c) => ({ ...c, name: c.name.trim() }));
      const hasEmptyName = trimmedColors.some((c) => !c.name);
      if (hasEmptyName) {
        return toast.error(t.products.emptyColorName || 'Please enter a name for all added colors, or remove unused ones.');
      }

      const namesLower = trimmedColors.map((c) => c.name.toLowerCase());
      const hasDuplicates = new Set(namesLower).size !== namesLower.length;
      if (hasDuplicates) {
        return toast.error(t.products.duplicateColorNames || 'Each color must have a unique name.');
      }

      if (productForm.hasSizes) {
        for (const c of trimmedColors) {
          if (!c.sizes || c.sizes.length === 0) {
            return toast.error(`Please add at least one size for color "${c.name}", or uncheck "Has Sizes".`);
          }
          const trimmedColorSizes = c.sizes.map((s) => ({ ...s, name: s.name.trim() }));
          if (trimmedColorSizes.some((s) => !s.name)) {
            return toast.error(`Please enter a size name for all sizes under "${c.name}".`);
          }
          const sizeNamesLower = trimmedColorSizes.map((s) => s.name.toLowerCase());
          if (new Set(sizeNamesLower).size !== sizeNamesLower.length) {
            return toast.error(`Duplicate size names under color "${c.name}".`);
          }
        }
      }
    } else if (productForm.hasSizes) {
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
      if (productImageRef.current?.hasPending()) {
        const uploaded = await productImageRef.current.upload();
        if (uploaded) imageUrl = uploaded;
      }
      const defaultImage = 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?q=80&w=800&auto=format&fit=crop';
      const images = imageUrl ? [imageUrl] : [defaultImage];

      let computedStock = 0;
      let colorsPayload: any[] = [];
      let sizesPayload: any[] = [];

      if (productForm.hasColors) {
        if (productForm.hasSizes) {
          colorsPayload = productForm.colors
            .filter((c) => c.name.trim())
            .map((c, i) => {
              const colorSizes = (c.sizes || [])
                .filter((s) => s.name.trim())
                .map((s, si) => ({
                  name: s.name.trim(),
                  sortOrder: si,
                  imageUrl: null,
                  quantity: Math.max(0, parseInt(s.quantity, 10) || 0),
                  priceOverride: productForm.diffPricePerSize && s.priceOverride ? Number(s.priceOverride) : null,
                  costPriceOverride: productForm.diffPricePerSize && s.costPriceOverride ? Number(s.costPriceOverride) : null,
                }));
              return {
                name: c.name.trim(),
                hexCode: c.hexCode?.trim() || null,
                imageUrl: c.imageUrl?.trim() || null,
                quantity: 0,
                priceOverride: null,
                costPriceOverride: null,
                sortOrder: i,
                isActive: true,
                sizes: colorSizes,
              };
            });
          computedStock = colorsPayload.reduce((sum, c) => {
            return sum + c.sizes.reduce((sSum: number, s: any) => sSum + s.quantity, 0);
          }, 0);
        } else {
          colorsPayload = productForm.colors
            .filter((c) => c.name.trim())
            .map((c, i) => ({
              name: c.name.trim(),
              hexCode: c.hexCode?.trim() || null,
              imageUrl: c.imageUrl?.trim() || null,
              quantity: Math.max(0, parseInt(c.quantity, 10) || 0),
              priceOverride: productForm.diffPricePerColor && c.priceOverride ? Number(c.priceOverride) : null,
              costPriceOverride: productForm.diffPricePerColor && c.costPriceOverride ? Number(c.costPriceOverride) : null,
              sortOrder: i,
              isActive: true,
              sizes: [],
            }));
          computedStock = colorsPayload.reduce((sum, c) => sum + c.quantity, 0);
        }
      } else if (productForm.hasSizes) {
        sizesPayload = productForm.sizes
          .filter((s) => s.name.trim())
          .map((s, i) => ({
            name: s.name.trim(),
            sortOrder: i,
            imageUrl: null,
            quantity: Math.max(0, parseInt(s.quantity, 10) || 0),
            priceOverride: productForm.diffPricePerSize && s.priceOverride ? Number(s.priceOverride) : null,
            costPriceOverride: productForm.diffPricePerSize && s.costPriceOverride ? Number(s.costPriceOverride) : null,
          }));
        computedStock = sizesPayload.reduce((sum, s) => sum + s.quantity, 0);
      } else {
        computedStock = productForm.stock ? Number(productForm.stock) : 0;
      }

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
        colors: colorsPayload,
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
            <Btn variant="primary" size="sm" onClick={() => { setProductCategoryBranchId(filterBranchId); setProductForm({ ...productForm, branchId: filterBranchId, categoryId: '', name: '', sku: '', price: '', costPrice: '', stock: '', description: '', image: '', unitType: 'PIECE', unitLabel: 'pc', sizes: [], hasSizes: false, diffPricePerSize: false, colors: [], hasColors: false }); setShowAddProduct(true); }}>{t.products.addProduct}</Btn>
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
              <div><label className={labelClass}>{t.products.branch}</label><select className={selectClass} value={productForm.branchId} onChange={(e) => { setProductCategoryBranchId(e.target.value); setProductForm({ ...productForm, branchId: e.target.value, categoryId: '' }); }}><option value="">{t.products.selectBranch}</option>{branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
              <div><label className={labelClass}>{t.products.category}</label><select className={selectClass} value={productForm.categoryId} disabled={!productForm.branchId || isLoadingProductCategories} onChange={(e) => setProductForm({ ...productForm, categoryId: e.target.value })}><option value="">{!productForm.branchId ? t.products.selectBranchFirst : isLoadingProductCategories ? t.products.loading : t.products.selectCategory}</option>{productCategories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div><label className={labelClass}>{t.products.sellingPrice}</label><input type="number" placeholder="0" className={inputClass} value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: e.target.value })} /></div>
              <div><label className={labelClass}>{t.products.costPrice}</label><input type="number" placeholder="0" className={inputClass} value={productForm.costPrice} onChange={(e) => setProductForm({ ...productForm, costPrice: e.target.value })} /></div>
              {productForm.hasSizes || productForm.hasColors ? (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className={labelClass} style={{ marginBottom: 0 }}>
                      {t.products.totalStockCalculated || 'Opening Stock (Sum of Variants)'}
                    </label>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                      Auto-sum
                    </span>
                  </div>
                  <div className={`${inputClass} flex items-center justify-between font-bold text-primary bg-gray-50 border-blue-200`}>
                    <span>{computedTotalStock} units</span>
                    <span className="text-[11px] font-normal text-muted-foreground">
                      {productForm.hasColors
                        ? `${productForm.colors.filter((c) => c.name.trim()).length} colors${
                            productForm.hasSizes ? ' (with sizes)' : ' (one size each)'
                          }`
                        : `${productForm.sizes.filter((s) => s.name.trim()).length} sizes`}
                    </span>
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    {t.products.sumOfSizesNote || 'Total opening stock is automatically calculated from the sum of all variant quantities.'}
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
                        setProductForm((prev) => ({ ...prev, stock: '' }));
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

            {/* Variant Checkboxes */}
            <div className="mt-3 flex flex-wrap items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-foreground">
                <input
                  type="checkbox"
                  checked={productForm.hasColors}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setProductForm((prev) => ({
                      ...prev,
                      hasColors: checked,
                      colors:
                        checked && prev.colors.length === 0
                          ? [
                              {
                                name: '',
                                hexCode: '#000000',
                                imageUrl: '',
                                quantity: '',
                                priceOverride: '',
                                costPriceOverride: '',
                                sizes: prev.hasSizes
                                  ? [
                                      { name: 'S', quantity: '', priceOverride: '', costPriceOverride: '' },
                                      { name: 'M', quantity: '', priceOverride: '', costPriceOverride: '' },
                                      { name: 'L', quantity: '', priceOverride: '', costPriceOverride: '' },
                                    ]
                                  : [],
                              },
                            ]
                          : prev.colors,
                    }));
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                />
                {t.products.hasColors || 'Has Colors?'}
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-foreground">
                <input
                  type="checkbox"
                  checked={productForm.hasSizes}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setProductForm((prev) => ({
                      ...prev,
                      hasSizes: checked,
                      sizes:
                        checked && !prev.hasColors && prev.sizes.length === 0
                          ? [{ name: '', quantity: '', priceOverride: '', costPriceOverride: '' }]
                          : prev.sizes,
                      colors: prev.hasColors
                        ? prev.colors.map((c) => ({
                            ...c,
                            sizes:
                              checked && (!c.sizes || c.sizes.length === 0)
                                ? [
                                    { name: 'S', quantity: '', priceOverride: '', costPriceOverride: '' },
                                    { name: 'M', quantity: '', priceOverride: '', costPriceOverride: '' },
                                    { name: 'L', quantity: '', priceOverride: '', costPriceOverride: '' },
                                  ]
                                : c.sizes,
                          }))
                        : prev.colors,
                    }));
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                />
                {productForm.hasColors ? 'Has Multiple Sizes per Color?' : (t.products.hasSizes || 'Has Sizes?')}
              </label>

              {productForm.hasSizes && (
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-foreground animate-in fade-in duration-200">
                  <input
                    type="checkbox"
                    checked={productForm.diffPricePerSize}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setProductForm((prev) => ({
                        ...prev,
                        diffPricePerSize: checked,
                      }));
                    }}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                  />
                  {t.products.differentPricePerSize}
                </label>
              )}

              {productForm.hasColors && !productForm.hasSizes && (
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-foreground animate-in fade-in duration-200">
                  <input
                    type="checkbox"
                    checked={productForm.diffPricePerColor}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setProductForm((prev) => ({
                        ...prev,
                        diffPricePerColor: checked,
                      }));
                    }}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                  />
                  Different price per color?
                </label>
              )}
            </div>

            {/* COLOR CONTAINER (Color-First Hierarchy) */}
            {productForm.hasColors && (
              <div className="mt-3 p-3.5 rounded-xl border bg-gray-50/70" style={{ borderColor: Theme.border }}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-foreground">
                      {productForm.hasSizes ? '🎨 Colors & Sizes Hierarchy' : '🎨 Product Colors (One Size per Color)'}
                    </span>
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-pink-50 text-pink-700 border border-pink-200">
                      {productForm.colors.filter((c) => c.name.trim()).length} {t.products.colorS || 'colors'}
                    </span>
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Total Stock: {computedTotalStock} units
                    </span>
                  </div>
                  <Btn
                    variant="primary"
                    size="sm"
                    onClick={() =>
                      setProductForm({
                        ...productForm,
                        colors: [
                          ...productForm.colors,
                          {
                            name: '',
                            hexCode: '#000000',
                            imageUrl: '',
                            quantity: '',
                            priceOverride: '',
                            costPriceOverride: '',
                            sizes: productForm.hasSizes
                              ? [
                                  { name: 'S', quantity: '', priceOverride: '', costPriceOverride: '' },
                                  { name: 'M', quantity: '', priceOverride: '', costPriceOverride: '' },
                                  { name: 'L', quantity: '', priceOverride: '', costPriceOverride: '' },
                                ]
                              : [],
                          },
                        ],
                      })
                    }
                  >
                    {t.products.addColor || '＋ Add Color'}
                  </Btn>
                </div>

                {productForm.colors.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground bg-white rounded-lg border border-dashed border-gray-200">
                    No colors added yet. Click &quot;＋ Add Color&quot; above to add your first color variant.
                  </div>
                ) : (
                  <div className="flex flex-col gap-3.5">
                    {productForm.colors.map((color, cIdx) => {
                      const trimmedColorName = color.name.trim();
                      const isColorDuplicate =
                        !!trimmedColorName &&
                        productForm.colors.some(
                          (other, oIdx) => oIdx !== cIdx && other.name.trim().toLowerCase() === trimmedColorName.toLowerCase()
                        );
                      const isUploading = uploadingColorIdx === cIdx;
                      const colorStock = productForm.hasSizes
                        ? (color.sizes || []).reduce((s, sz) => s + (parseInt(sz.quantity, 10) || 0), 0)
                        : (parseInt(color.quantity, 10) || 0);

                      return (
                        <div
                          key={cIdx}
                          className={`rounded-xl bg-white border p-3.5 shadow-xs transition-all ${
                            isColorDuplicate ? 'border-red-300 ring-1 ring-red-200' : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          {/* Color Header */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-gray-100">
                            <div className="flex items-center gap-2">
                              <span
                                className="h-4 w-4 rounded-full border border-gray-300 shadow-xs inline-block shrink-0"
                                style={{ backgroundColor: color.hexCode || '#000000' }}
                              />
                              <span className="font-bold text-xs text-foreground">
                                Color #{cIdx + 1}: {color.name || 'Untitled Color'}
                              </span>
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                                Stock: {colorStock} units
                              </span>
                            </div>
                            <Btn
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setProductForm({
                                  ...productForm,
                                  colors: productForm.colors.filter((_, i) => i !== cIdx),
                                })
                              }
                              className="text-red-500 hover:text-red-700 h-7 px-2 text-xs"
                            >
                              {t.products.remove}
                            </Btn>
                          </div>

                          {/* Color Inputs */}
                          <div className="mt-3 grid gap-3 items-end grid-cols-1 sm:grid-cols-12">
                            {/* Color Name */}
                            <div className={!productForm.hasSizes ? 'sm:col-span-3' : 'sm:col-span-4'}>
                              <div className="flex items-center justify-between mb-1">
                                <label className="block text-[10px] font-semibold text-foreground">
                                  {t.products.colorName || 'Color Name *'}
                                </label>
                                {isColorDuplicate && <span className="text-[9px] font-semibold text-red-500">Duplicate</span>}
                              </div>
                              <input
                                className={`${inputClass} ${isColorDuplicate ? 'border-red-400 focus:border-red-500' : ''}`}
                                value={color.name}
                                onChange={(e) => {
                                  const next = [...productForm.colors];
                                  next[cIdx] = { ...next[cIdx], name: e.target.value };
                                  setProductForm({ ...productForm, colors: next });
                                }}
                                placeholder="e.g. Matte Black, Rose Pink"
                              />
                            </div>

                            {/* Color Swatch & Code */}
                            <div className={!productForm.hasSizes ? 'sm:col-span-3' : 'sm:col-span-3'}>
                              <label className="mb-1 block text-[10px] font-semibold text-foreground">
                                {t.products.colorSwatch || 'Swatch / Code'}
                              </label>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="color"
                                  value={color.hexCode || '#000000'}
                                  onChange={(e) => {
                                    const next = [...productForm.colors];
                                    next[cIdx] = { ...next[cIdx], hexCode: e.target.value };
                                    setProductForm({ ...productForm, colors: next });
                                  }}
                                  className="h-[38px] w-[38px] cursor-pointer rounded-lg border border-border p-0.5 bg-white shrink-0"
                                  title="Choose color"
                                />
                                <input
                                  className={`${inputClass} font-mono text-xs`}
                                  value={color.hexCode || ''}
                                  onChange={(e) => {
                                    const next = [...productForm.colors];
                                    next[cIdx] = { ...next[cIdx], hexCode: e.target.value };
                                    setProductForm({ ...productForm, colors: next });
                                  }}
                                  placeholder="#000000"
                                />
                              </div>
                            </div>

                            {/* Color Image Upload */}
                            <div className={!productForm.hasSizes ? 'sm:col-span-6' : 'sm:col-span-5'}>
                              <label className="mb-1 block text-[10px] font-semibold text-foreground">
                                {t.products.colorImage || 'Color Image (Upload)'}
                              </label>
                              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                                {color.imageUrl ? (
                                  <div className="relative group shrink-0">
                                    <img
                                      src={color.imageUrl}
                                      alt={color.name || 'Color'}
                                      className="h-[38px] w-[38px] rounded-lg object-cover border border-border shadow-xs"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const next = [...productForm.colors];
                                        next[cIdx] = { ...next[cIdx], imageUrl: '' };
                                        setProductForm({ ...productForm, colors: next });
                                      }}
                                      className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-red-500 text-white flex items-center justify-center text-[10px] hover:bg-red-600 transition shadow cursor-pointer"
                                      title="Remove image"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ) : null}

                                <label
                                  className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-border bg-white hover:bg-gray-50 cursor-pointer transition select-none shrink-0 ${
                                    isUploading ? 'opacity-60 cursor-not-allowed' : ''
                                  }`}
                                >
                                  {isUploading ? (
                                    <>
                                      <span className="h-3.5 w-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                      <span>Uploading...</span>
                                    </>
                                  ) : (
                                    <>
                                      <span>📷</span>
                                      <span>{color.imageUrl ? 'Change' : (t.products.uploadColorImage || 'Upload Image')}</span>
                                    </>
                                  )}
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    disabled={isUploading}
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) handleColorImageUpload(cIdx, file);
                                      e.target.value = '';
                                    }}
                                  />
                                </label>

                                <input
                                  className={`${inputClass} text-xs py-1.5 px-2 flex-1 min-w-[120px]`}
                                  value={color.imageUrl || ''}
                                  onChange={(e) => {
                                    const next = [...productForm.colors];
                                    next[cIdx] = { ...next[cIdx], imageUrl: e.target.value };
                                    setProductForm({ ...productForm, colors: next });
                                  }}
                                  placeholder="or paste URL"
                                />
                              </div>
                            </div>

                            {/* Direct Stock & Price override if NO sizes (One size per color) */}
                            {!productForm.hasSizes && (
                              <>
                                <div className="sm:col-span-4">
                                  <label className="mb-1 block text-[10px] font-semibold text-foreground">
                                    Stock Quantity * (One Size)
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    className={inputClass}
                                    value={color.quantity}
                                    onChange={(e) => {
                                      const next = [...productForm.colors];
                                      next[cIdx] = { ...next[cIdx], quantity: e.target.value };
                                      setProductForm({ ...productForm, colors: next });
                                    }}
                                    onFocus={(e) => {
                                      if (e.target.value === '0') {
                                        const next = [...productForm.colors];
                                        next[cIdx] = { ...next[cIdx], quantity: '' };
                                        setProductForm({ ...productForm, colors: next });
                                      }
                                    }}
                                    placeholder="0"
                                  />
                                </div>

                                {productForm.diffPricePerColor && (
                                  <>
                                    <div className="sm:col-span-4">
                                      <label className="mb-1 block text-[10px] font-semibold text-foreground">
                                        {t.products.costPriceOverride}
                                      </label>
                                      <input
                                        type="number"
                                        className={inputClass}
                                        value={color.costPriceOverride || ''}
                                        onChange={(e) => {
                                          const next = [...productForm.colors];
                                          next[cIdx] = { ...next[cIdx], costPriceOverride: e.target.value };
                                          setProductForm({ ...productForm, colors: next });
                                        }}
                                        placeholder={t.products.leaveEmpty}
                                      />
                                    </div>
                                    <div className="sm:col-span-4">
                                      <label className="mb-1 block text-[10px] font-semibold text-foreground">
                                        {t.products.priceOverride}
                                      </label>
                                      <input
                                        type="number"
                                        className={inputClass}
                                        value={color.priceOverride || ''}
                                        onChange={(e) => {
                                          const next = [...productForm.colors];
                                          next[cIdx] = { ...next[cIdx], priceOverride: e.target.value };
                                          setProductForm({ ...productForm, colors: next });
                                        }}
                                        placeholder={t.products.leaveEmpty}
                                      />
                                    </div>
                                  </>
                                )}
                              </>
                            )}
                          </div>

                          {/* Nested Sizes Section (When productForm.hasSizes) */}
                          {productForm.hasSizes && (
                            <div className="mt-3.5 pt-3 border-t border-dashed border-gray-200 bg-gray-50/50 rounded-lg p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] font-bold text-foreground">
                                    📏 Sizes for {color.name || 'this color'}:
                                  </span>
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                    {(color.sizes || []).filter((s) => s.name.trim()).length} sizes
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {cIdx > 0 && (productForm.colors[0]?.sizes?.length || 0) > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const sourceSizes = productForm.colors[0].sizes || [];
                                        const cloned = sourceSizes.map((s) => ({ ...s, quantity: '' }));
                                        const next = [...productForm.colors];
                                        next[cIdx] = { ...next[cIdx], sizes: cloned };
                                        setProductForm({ ...productForm, colors: next });
                                        toast.success(`Copied sizes from ${productForm.colors[0].name || 'Color #1'}`);
                                      }}
                                      className="text-[10px] font-semibold text-primary hover:underline px-2 py-1 bg-white border border-border rounded cursor-pointer"
                                    >
                                      📋 Copy sizes from {productForm.colors[0].name || 'Color #1'}
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const std = [
                                        { name: 'S', quantity: '', priceOverride: '', costPriceOverride: '' },
                                        { name: 'M', quantity: '', priceOverride: '', costPriceOverride: '' },
                                        { name: 'L', quantity: '', priceOverride: '', costPriceOverride: '' },
                                        { name: 'XL', quantity: '', priceOverride: '', costPriceOverride: '' },
                                      ];
                                      const next = [...productForm.colors];
                                      const currentSizes = next[cIdx]?.sizes || [];
                                      const newSizes = std.filter((s) => !currentSizes.some((cs) => cs.name.toLowerCase() === s.name.toLowerCase()));
                                      next[cIdx] = { ...next[cIdx], sizes: [...currentSizes, ...newSizes] };
                                      setProductForm({ ...productForm, colors: next });
                                    }}
                                    className="text-[10px] font-semibold text-gray-700 px-2 py-1 bg-white border border-border rounded hover:bg-gray-50 cursor-pointer"
                                  >
                                    ＋ Add S, M, L, XL
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const next = [...productForm.colors];
                                      const currentSizes = next[cIdx]?.sizes || [];
                                      next[cIdx] = {
                                        ...next[cIdx],
                                        sizes: [...currentSizes, { name: '', quantity: '', priceOverride: '', costPriceOverride: '' }],
                                      };
                                      setProductForm({ ...productForm, colors: next });
                                    }}
                                    className="text-[10px] font-bold text-primary px-2.5 py-1 bg-white border border-primary/30 rounded hover:bg-primary/5 cursor-pointer"
                                  >
                                    ＋ Add Size
                                  </button>
                                </div>
                              </div>

                              {(color.sizes || []).length === 0 ? (
                                <div className="text-center py-3 text-[11px] text-muted-foreground bg-white rounded border border-dashed border-gray-200">
                                  No sizes added for this color yet. Click &quot;＋ Add Size&quot; or &quot;＋ Add S, M, L, XL&quot; above.
                                </div>
                              ) : (
                                <div className="flex flex-col gap-1.5">
                                  {color.sizes.map((sz, szIdx) => {
                                    const trimmedSz = sz.name.trim();
                                    const isSzDuplicate =
                                      !!trimmedSz &&
                                      color.sizes.some(
                                        (oth, oSzIdx) => oSzIdx !== szIdx && oth.name.trim().toLowerCase() === trimmedSz.toLowerCase()
                                      );
                                    return (
                                      <div
                                        key={szIdx}
                                        className={`grid items-end gap-2 p-2 rounded-md bg-white border ${
                                          isSzDuplicate ? 'border-red-300 ring-1 ring-red-200' : 'border-gray-200'
                                        } ${
                                          productForm.diffPricePerSize
                                            ? (isMobile ? 'grid-cols-1' : 'grid-cols-5')
                                            : (isMobile ? 'grid-cols-1' : 'grid-cols-3')
                                        }`}
                                      >
                                        <div>
                                          <div className="flex items-center justify-between mb-0.5">
                                            <label className="block text-[9px] font-semibold text-foreground">
                                              Size *
                                            </label>
                                            {isSzDuplicate && <span className="text-[8px] font-semibold text-red-500">Duplicate</span>}
                                          </div>
                                          <input
                                            className={`${inputClass} text-xs py-1 h-8`}
                                            value={sz.name}
                                            onChange={(e) => {
                                              const next = [...productForm.colors];
                                              const sizesArr = [...(next[cIdx].sizes || [])];
                                              sizesArr[szIdx] = { ...sizesArr[szIdx], name: e.target.value };
                                              next[cIdx] = { ...next[cIdx], sizes: sizesArr };
                                              setProductForm({ ...productForm, colors: next });
                                            }}
                                            placeholder="e.g. S, M, L"
                                          />
                                        </div>

                                        <div>
                                          <label className="mb-0.5 block text-[9px] font-semibold text-foreground">
                                            Stock Quantity *
                                          </label>
                                          <input
                                            type="number"
                                            min="0"
                                            className={`${inputClass} text-xs py-1 h-8`}
                                            value={sz.quantity}
                                            onChange={(e) => {
                                              const next = [...productForm.colors];
                                              const sizesArr = [...(next[cIdx].sizes || [])];
                                              sizesArr[szIdx] = { ...sizesArr[szIdx], quantity: e.target.value };
                                              next[cIdx] = { ...next[cIdx], sizes: sizesArr };
                                              setProductForm({ ...productForm, colors: next });
                                            }}
                                            onFocus={(e) => {
                                              if (e.target.value === '0') {
                                                const next = [...productForm.colors];
                                                const sizesArr = [...(next[cIdx].sizes || [])];
                                                sizesArr[szIdx] = { ...sizesArr[szIdx], quantity: '' };
                                                next[cIdx] = { ...next[cIdx], sizes: sizesArr };
                                                setProductForm({ ...productForm, colors: next });
                                              }
                                            }}
                                            placeholder="0"
                                          />
                                        </div>

                                        {productForm.diffPricePerSize && (
                                          <>
                                            <div>
                                              <label className="mb-0.5 block text-[9px] font-semibold text-foreground">
                                                Cost Override (৳)
                                              </label>
                                              <input
                                                type="number"
                                                className={`${inputClass} text-xs py-1 h-8`}
                                                value={sz.costPriceOverride || ''}
                                                onChange={(e) => {
                                                  const next = [...productForm.colors];
                                                  const sizesArr = [...(next[cIdx].sizes || [])];
                                                  sizesArr[szIdx] = { ...sizesArr[szIdx], costPriceOverride: e.target.value };
                                                  next[cIdx] = { ...next[cIdx], sizes: sizesArr };
                                                  setProductForm({ ...productForm, colors: next });
                                                }}
                                                placeholder="Default"
                                              />
                                            </div>
                                            <div>
                                              <label className="mb-0.5 block text-[9px] font-semibold text-foreground">
                                                Price Override (৳)
                                              </label>
                                              <input
                                                type="number"
                                                className={`${inputClass} text-xs py-1 h-8`}
                                                value={sz.priceOverride || ''}
                                                onChange={(e) => {
                                                  const next = [...productForm.colors];
                                                  const sizesArr = [...(next[cIdx].sizes || [])];
                                                  sizesArr[szIdx] = { ...sizesArr[szIdx], priceOverride: e.target.value };
                                                  next[cIdx] = { ...next[cIdx], sizes: sizesArr };
                                                  setProductForm({ ...productForm, colors: next });
                                                }}
                                                placeholder="Default"
                                              />
                                            </div>
                                          </>
                                        )}

                                        <div className="text-right">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const next = [...productForm.colors];
                                              next[cIdx] = {
                                                ...next[cIdx],
                                                sizes: (next[cIdx].sizes || []).filter((_, i) => i !== szIdx),
                                              };
                                              setProductForm({ ...productForm, colors: next });
                                            }}
                                            className="text-red-500 hover:text-red-700 text-xs px-2 py-1 rounded hover:bg-red-50 transition cursor-pointer"
                                          >
                                            ✕ Remove
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* STANDALONE SIZES CONTAINER (when hasSizes && !hasColors) */}
            {!productForm.hasColors && productForm.hasSizes && (
              <div className="mt-3 p-3 rounded-xl border bg-gray-50/50" style={{ borderColor: Theme.border }}>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <label className={labelClass} style={{ marginBottom: 0 }}>{t.products.sizesOptional}</label>
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Total Stock: {computedTotalStock} units
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const standard = [
                          { name: 'S', quantity: '', priceOverride: '', costPriceOverride: '' },
                          { name: 'M', quantity: '', priceOverride: '', costPriceOverride: '' },
                          { name: 'L', quantity: '', priceOverride: '', costPriceOverride: '' },
                          { name: 'XL', quantity: '', priceOverride: '', costPriceOverride: '' },
                        ];
                        const existing = productForm.sizes;
                        const newSizes = standard.filter((std) => !existing.some((e) => e.name.toLowerCase() === std.name.toLowerCase()));
                        setProductForm({ ...productForm, sizes: [...existing, ...newSizes] });
                      }}
                      className="text-[11px] font-semibold text-gray-700 px-2 py-1 bg-white border border-border rounded hover:bg-gray-50 cursor-pointer"
                    >
                      ＋ Add S, M, L, XL
                    </button>
                    <Btn
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setProductForm({
                          ...productForm,
                          sizes: [...productForm.sizes, { name: '', quantity: '', priceOverride: '', costPriceOverride: '' }],
                        })
                      }
                    >
                      {t.products.addSize}
                    </Btn>
                  </div>
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
                  {p.colors?.length > 0 && (
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-foreground mr-1">{t.products.colorS || 'Colors'}:</span>
                      {p.colors.map((c: any) => {
                        const hasColorSizes = c.sizes && c.sizes.length > 0;
                        return (
                          <span
                            key={c.id || c.name}
                            className="inline-flex items-center gap-1.5 rounded-md bg-gray-50 px-2 py-0.5 text-[10px] font-medium text-gray-700 border border-gray-200"
                          >
                            {c.hexCode && (
                              <span
                                className="h-2.5 w-2.5 rounded-full border border-gray-300 shadow-2xs"
                                style={{ backgroundColor: c.hexCode }}
                              />
                            )}
                            {c.imageUrl && (
                              <img src={c.imageUrl} alt={c.name} className="h-3.5 w-3.5 rounded object-cover" />
                            )}
                            <span className="font-bold">{c.name}</span>
                            {hasColorSizes ? (
                              <span className="text-[9px] text-primary font-bold">
                                [{c.sizes.map((s: any) => `${s.name}: ${s.quantity ?? 0}`).join(', ')}]
                              </span>
                            ) : (
                              <span className="text-[9px] text-primary font-bold">
                                (Qty: {c.quantity ?? 0})
                              </span>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  )}
                  {(!p.colors || p.colors.length === 0) && p.sizes?.length > 0 && (
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
