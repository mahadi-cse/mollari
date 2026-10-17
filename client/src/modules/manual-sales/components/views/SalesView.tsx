'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Theme, formatCurrency } from '@/modules/dashboard/utils/theme';
import { useResponsive } from '@/shared/hooks/useResponsive';
import { Card, SecHead, Btn } from '@/shared/components/ui/Primitives';
import type { Product, SellLog } from '@/modules/dashboard/types';
import { useCreateManualSaleMutation, useListManualSales } from '@/modules/manual-sales';
import { useInventorySummary } from '@/modules/inventory';
import { useListBranches } from '@/modules/branches';
import { useListProducts } from '@/modules/products';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { useDashboardLocale } from '@/modules/dashboard/locales/DashboardLocaleContext';
import BarcodeScannerModal from '@/modules/dashboard/components/BarcodeScannerModal';
import { useSiteSettings } from '@/modules/homepage';

interface SalesViewProps {
  products: Product[];
  setProducts: (products: Product[]) => void;
  sellLog: SellLog[];
  setSellLog: (log: SellLog[]) => void;
}

interface SaleLineItem {
  productId: number;
  name: string;
  sku: string;
  qty: number;
  unitPrice: number;
  total: number;
  unitType: 'PIECE' | 'WEIGHT';
  unitLabel: string;
  sizeName: string;
  sizes: Array<{ name: string; quantity?: number; imageUrl?: string | null; priceOverride?: number | null; costPriceOverride?: number | null; isActive?: boolean }>;
}

const SALES_BRANCH_STORAGE_KEY = 'dashboard.sales.selectedBranchId';

export default function SalesView({
  products,
}: SalesViewProps) {
  const { isMobile } = useResponsive();
  const { t, locale } = useDashboardLocale();
  const { data: session } = useSession();
  const { data: siteSettings } = useSiteSettings();
  const { data: branches = [] } = useListBranches();
  const activeBranches = branches.filter((b) => b.active);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [saleBranchId, setSaleBranchId] = useState('');
  const [lineItems, setLineItems] = useState<SaleLineItem[]>([]);
  const [searchLog, setSearchLog] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLimit, setHistoryLimit] = useState(10);
  const [historySortBy, setHistorySortBy] = useState<'createdAt' | 'totalAmount' | 'totalQty' | 'saleNumber'>('createdAt');
  const [historySortOrder, setHistorySortOrder] = useState<'asc' | 'desc'>('desc');
  const [branchInitialized, setBranchInitialized] = useState(false);
  const [lastRecordedSale, setLastRecordedSale] = useState<any>(null);
  const [showPrintToast, setShowPrintToast] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  useEffect(() => {
    if (showPrintToast) {
      const timer = setTimeout(() => {
        setShowPrintToast(false);
        setLastRecordedSale(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showPrintToast]);

  const buildReceiptHtml = (sale: any, storeInfo?: { storeName: string; tagline: string; address: string; phone: string }) => {
    const store = {
      storeName: storeInfo?.storeName || 'Mouchak Cosmetics',
      tagline: storeInfo?.tagline || 'Premium Quality Cosmetics & Skincare',
      address: storeInfo?.address || '',
      phone: storeInfo?.phone || '',
    };
    // Use saleNumber as the document title — browsers use this as the PDF filename
    const docTitle = sale.saleNumber || 'Receipt';
    const itemsHtml = (sale.items || []).map((item: any) => `
      <tr>
        <td style="padding: 4px 0; font-size: 11px; font-family: monospace; line-height: 1.2;">
          ${item.productNameSnapshot}
          ${item.sizeName ? `<span style="font-size: 9px; display: block; color: #555;">Size: ${item.sizeName}</span>` : ''}
        </td>
        <td style="padding: 4px 0; text-align: center; font-size: 11px; font-family: monospace;">${item.quantity}</td>
        <td style="padding: 4px 0; text-align: right; font-size: 11px; font-family: monospace;">৳${item.unitPrice}</td>
        <td style="padding: 4px 0; text-align: right; font-size: 11px; font-family: monospace;">৳${item.lineTotal || (item.quantity * item.unitPrice)}</td>
      </tr>
    `).join('');

    const formattedDate = new Date(sale.createdAt).toLocaleString();

    const autoprint = `<script>window.onload = function() { setTimeout(function() { window.print(); }, 150); };<\/script>`;  

    const receiptHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${docTitle}</title>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <style>
            @page {
              size: 80mm auto;
              margin: 0;
            }
            body {
              font-family: Arial, sans-serif;
              color: #000;
              margin: 10px;
              padding: 0;
              width: 70mm;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .header {
              margin-bottom: 12px;
              border-bottom: 1px dashed #000;
              padding-bottom: 8px;
            }
            .title {
              font-size: 16px;
              font-weight: bold;
              text-transform: uppercase;
              letter-spacing: 1px;
              margin: 0 0 4px 0;
            }
            .subtitle {
              font-size: 10px;
              margin: 0 0 2px 0;
              color: #333;
            }
            .info-table {
              width: 100%;
              font-size: 10px;
              margin-bottom: 8px;
              border-collapse: collapse;
            }
            .info-table td {
              padding: 1px 0;
            }
            .items-table {
              width: 100%;
              border-collapse: collapse;
              border-bottom: 1px dashed #000;
              margin-bottom: 8px;
            }
            .items-table th {
              border-bottom: 1px dashed #000;
              font-size: 10px;
              padding: 4px 0;
              text-align: left;
            }
            .totals-table {
              width: 100%;
              font-size: 11px;
              margin-bottom: 12px;
            }
            .totals-table td {
              padding: 2px 0;
            }
            .footer {
              border-top: 1px dashed #000;
              padding-top: 8px;
              margin-top: 8px;
              font-size: 9px;
              color: #333;
            }
          </style>
          ${autoprint}
        </head>
        <body>
          <div class="header text-center">
            <div class="title">${store.storeName}</div>
            <div class="subtitle">${store.tagline}</div>
            ${store.address ? `<div class="subtitle">${store.address}</div>` : ''}
            ${store.phone ? `<div class="subtitle">${store.phone}</div>` : ''}
            <div class="subtitle">${sale.branchName || 'Main Branch'}</div>
          </div>

          <table class="info-table">
            <tr>
              <td><strong>Invoice:</strong> ${sale.saleNumber}</td>
              <td class="text-right"><strong>Date:</strong> ${formattedDate.split(',')[0]}</td>
            </tr>
            <tr>
              <td><strong>Served By:</strong> ${sale.soldBy || 'Staff'}</td>
              <td class="text-right"><strong>Time:</strong> ${formattedDate.split(',')[1]?.trim() || ''}</td>
            </tr>
          </table>

          <table class="items-table">
            <thead>
              <tr>
                <th style="width: 45%;">Item</th>
                <th style="width: 15%; text-align: center;">Qty</th>
                <th style="width: 20%; text-align: right;">Price</th>
                <th style="width: 20%; text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <table class="totals-table">
            <tr>
              <td><strong>Total Quantity:</strong></td>
              <td class="text-right">${sale.totalQty}</td>
            </tr>
            <tr style="font-size: 13px; font-weight: bold;">
              <td>Grand Total:</td>
              <td class="text-right">৳${sale.totalAmount}</td>
            </tr>
          </table>

          <div class="footer text-center">
            <p style="margin: 0 0 4px 0;">Thank you for shopping with us!</p>
          </div>
        </body>
      </html>
    `;

    return receiptHtml;
  };

  const triggerPrint = (targetWindow: Window, cleanup: () => void) => {
    let cleaned = false;
    const runCleanup = () => {
      if (cleaned) return;
      cleaned = true;
      cleanup();
    };

    const doPrint = () => {
      targetWindow.focus();
      targetWindow.print();
      targetWindow.addEventListener('afterprint', runCleanup, { once: true });
      if (!isMobile) {
        setTimeout(runCleanup, 2000);
      }
    };

    if (isMobile) {
      setTimeout(doPrint, 300);
    } else {
      doPrint();
    }
  };

  const printReceiptInIframe = (receiptHtml: string) => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      iframe.remove();
      return;
    }

    doc.open();
    doc.write(receiptHtml);
    doc.close();

    const iframeWindow = iframe.contentWindow;
    if (!iframeWindow) {
      iframe.remove();
      return;
    }

    const cleanup = () => iframe.remove();
    let printed = false;
    const startPrint = () => {
      if (printed) return;
      printed = true;
      triggerPrint(iframeWindow, cleanup);
    };

    iframe.onload = startPrint;
    if (doc.readyState === 'complete') {
      startPrint();
    }
  };

  const handlePrintReceipt = (sale: any) => {
    const storeInfo = {
      storeName: siteSettings?.storeName || 'Mouchak Cosmetics',
      tagline: siteSettings?.tagline || 'Premium Quality Cosmetics & Skincare',
      address: siteSettings?.contactAddress || '',
      phone: siteSettings?.contactPhone || '',
    };
    const receiptHtml = buildReceiptHtml(sale, storeInfo);

    if (isMobile) {
      // On mobile, window.print() in a popup is blocked by the browser.
      // Use a Blob URL instead — the page loads in its own origin context and
      // the embedded window.onload script triggers print() without restrictions.
      try {
        const blob = new Blob([receiptHtml], { type: 'text/html;charset=utf-8' });
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        // Revoke after a delay to allow the tab to finish loading
        setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
      } catch {
        // Fallback: open a plain window (best-effort)
        const pw = window.open('', '_blank');
        if (pw) {
          pw.document.open();
          pw.document.write(receiptHtml);
          pw.document.close();
        }
      }
      return;
    }

    printReceiptInIframe(receiptHtml);
  };

  const searchBoxRef = useRef<HTMLDivElement | null>(null);
  const branchInventoryQuery = useInventorySummary({ page: 1, limit: 500, warehouseId: Number(saleBranchId) });
  const createManualSaleMutation = useCreateManualSaleMutation();
  const manualSalesQuery = useListManualSales({
    page: historyPage,
    limit: historyLimit,
    search: searchLog || undefined,
    sortBy: historySortBy,
    sortOrder: historySortOrder,
  });

  const branchInventoryData = ((branchInventoryQuery as any).data?.data || []) as any[];
  // Fetch products with sizes/unit info
  const { data: productsMetaList = [] } = useListProducts(
    { limit: 500, ...(saleBranchId ? { branchId: Number(saleBranchId) } : {}) } as any,
    { queryKey: ['products', 'list', 'sales-meta', { branchId: saleBranchId }], enabled: !!saleBranchId }
  );
  const branchProducts: Product[] = branchInventoryData.map((item: any) => ({
    id: item.productId || item.product?.id,
    name: item.product?.name || t.unknownProduct,
    sku: item.product?.sku || t.na,
    category: t.uncategorized,
    price: Number(item.product?.price ?? 0),
    stock: Number(item.availableQty ?? item.quantity ?? 0),
    warehouse: item.warehouse || t.na,
    sold: 0,
    manualSold: 0,
    status: 'active',
    unitType: item.product?.unitType || 'PIECE',
    unitLabel: item.product?.unitLabel || 'pc',
    sizes: (item.product?.sizes || []).filter((s: any) => s.isActive !== false),
  }));

  const getProductMeta = (productId: number) => {
    const liveInv = branchProducts.find((p: any) => p.id === productId);
    const meta = productsMetaList.find((p: any) => p.id === productId);
    if (!liveInv) return meta;
    return {
      ...meta,
      ...liveInv,
      sizes: (liveInv.sizes && liveInv.sizes.length > 0) ? liveInv.sizes : (meta?.sizes || []),
    };
  };

  const searchableProducts = branchProducts;

  const grandTotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const totalQty = lineItems.reduce((sum, item) => sum + item.qty, 0);
  const totalItems = lineItems.length;
  const getMaxEditableQty = (productId: number, rowIndex: number) => {
    const item = lineItems[rowIndex];
    const product = searchableProducts.find((p) => p.id === productId);
    if (!product) return 1;

    if (item && item.sizeName && item.sizes && item.sizes.length > 0) {
      const matchedSize = item.sizes.find((s: any) => s.name === item.sizeName);
      if (matchedSize && matchedSize.quantity !== undefined) {
        const usedByOthers = lineItems.reduce((sum, li, idx) => {
          if (idx === rowIndex || li.productId !== productId || li.sizeName !== item.sizeName) return sum;
          return sum + li.qty;
        }, 0);
        return Math.max(1, (matchedSize.quantity ?? 0) - usedByOthers);
      }
    }

    const usedByOthers = lineItems.reduce((sum, item, idx) => {
      if (idx === rowIndex || item.productId !== productId) return sum;
      return sum + item.qty;
    }, 0);
    return Math.max(1, product.stock - usedByOthers);
  };

  const hasInvalidLine = lineItems.some((item, idx) => {
    const product = searchableProducts.find((p) => p.id === item.productId);
    if (!product) return true;
    const maxQty = getMaxEditableQty(item.productId, idx);
    return item.qty > maxQty || item.qty < 1 || item.unitPrice < 0;
  });

  const filteredProducts = searchableProducts.filter((p) =>
    p.stock > 0 && (p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.sku.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const historyRows = manualSalesQuery.data?.data || [];
  const historyMeta = manualSalesQuery.data?.pagination;

  useEffect(() => {
    if (branchInitialized || activeBranches.length === 0) return;

    const savedBranchId = window.localStorage.getItem(SALES_BRANCH_STORAGE_KEY) || '';
    const savedBranchStillActive = savedBranchId
      ? activeBranches.some((b) => String(b.id) === savedBranchId)
      : false;

    setSaleBranchId(savedBranchStillActive ? savedBranchId : String(activeBranches[0].id));
    setBranchInitialized(true);
  }, [branchInitialized, activeBranches]);

  useEffect(() => {
    if (!saleBranchId) return;
    window.localStorage.setItem(SALES_BRANCH_STORAGE_KEY, saleBranchId);
  }, [saleBranchId]);

  useEffect(() => {
    if (!saleBranchId || activeBranches.length === 0) return;
    const selectedStillActive = activeBranches.some((b) => String(b.id) === saleBranchId);
    if (!selectedStillActive) {
      const fallbackBranchId = String(activeBranches[0].id);
      setSaleBranchId(fallbackBranchId);
      window.localStorage.setItem(SALES_BRANCH_STORAGE_KEY, fallbackBranchId);
    }
  }, [saleBranchId, activeBranches]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (!searchBoxRef.current?.contains(target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, []);

  useEffect(() => {
    setLineItems([]);
    setSearchQuery('');
  }, [saleBranchId]);

  const addCartItem = (product: Product, sizeName: string, sizes: any[]) => {
    const meta = getProductMeta(product.id) as any;
    const unitType = meta?.unitType || product.unitType || 'PIECE';
    const unitLabel = meta?.unitLabel || product.unitLabel || 'pc';
    const defaultQty = 1;
    const matchedSizeObj = sizes.find((s: any) => s.name === sizeName);
    const resolvedPrice = matchedSizeObj && matchedSizeObj.priceOverride !== null && matchedSizeObj.priceOverride !== undefined && Number(matchedSizeObj.priceOverride) > 0
      ? Number(matchedSizeObj.priceOverride)
      : Number(product.price ?? 0);

    const sizeStock = matchedSizeObj && matchedSizeObj.quantity !== undefined
      ? Number(matchedSizeObj.quantity)
      : Number(product.stock ?? 0);

    if (sizes.length > 0 && sizeStock <= 0) {
      toast.error(`Size ${sizeName} is out of stock!`);
      return;
    }

    setLineItems((prev) => {
      const existingIdx = prev.findIndex((i) => i.productId === product.id && i.sizeName === sizeName);
      if (existingIdx !== -1) {
        return prev.map((i, idx) => {
          if (idx !== existingIdx) return i;
          const maxQty = sizeStock;
          const nextQty = Math.min(maxQty, i.qty + 1);
          return { ...i, qty: nextQty, total: nextQty * i.unitPrice };
        });
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          sku: product.sku,
          qty: Math.min(defaultQty, Math.max(1, sizeStock)),
          unitPrice: resolvedPrice,
          total: resolvedPrice * Math.min(defaultQty, Math.max(1, sizeStock)),
          unitType,
          unitLabel,
          sizeName,
          sizes,
        },
      ];
    });
    setSearchQuery('');
    setShowDropdown(false);
  };

  const handleSelectProduct = (product: Product) => {
    const meta = getProductMeta(product.id) as any;
    const sizes = (meta?.sizes || product.sizes || []).filter((s: any) => s.isActive !== false);
    const availableSize = sizes.find((s: any) => (s.quantity ?? 0) > 0) || sizes[0];
    const defaultSize = availableSize ? availableSize.name : '';
    addCartItem(product, defaultSize, sizes);
  };

  const handleBarcodeScan = useCallback((barcode: string) => {
    const found = branchProducts.find((p) => {
      const meta = getProductMeta(p.id) as any;
      return meta?.barcode === barcode;
    });
    if (found) {
      handleSelectProduct(found);
      toast.success(found.name);
    } else {
      toast.error(t.sales.noProductFound);
    }
  }, [branchProducts]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConfirm = async () => {
    if (lineItems.length > 0 && !hasInvalidLine) {
      try {
        const result = await createManualSaleMutation.mutateAsync({
          soldBy: session?.user?.name || session?.user?.email || t.sales.staff,
          note: t.manualSale,
          branchId: Number(saleBranchId),
          branchName: activeBranches.find((b) => b.id === Number(saleBranchId))?.name || t.sales.main,
          items: lineItems.map((item) => ({
            productId: item.productId,
            quantity: item.qty,
            unitPrice: item.unitPrice,
            ...(item.sizeName ? { sizeName: item.sizeName } : {}),
          })),
        });
        toast.success(`${t.sales.recorded} ${lineItems.length} ${t.inventory.product}(s), ${totalQty} ${t.sales.qty} ${t.modal.total.toLowerCase()}`);
        if (result) {
          setLastRecordedSale(result);
          setShowPrintToast(true);
        }
        setSearchQuery('');
        setLineItems([]);
      } catch {
        toast.error(t.sales.failedRecord);
      }
    }
  };

  const updateLineItem = (index: number, patch: Partial<Pick<SaleLineItem, 'qty' | 'unitPrice'>>) => {
    setLineItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        const maxQty = getMaxEditableQty(item.productId, index);
        const minQty = 1;
        const nextQty = patch.qty !== undefined ? Math.max(minQty, Math.min(maxQty, patch.qty)) : item.qty;
        const nextPrice = patch.unitPrice !== undefined ? Math.max(0, patch.unitPrice) : item.unitPrice;
        return { ...item, qty: nextQty, unitPrice: nextPrice, total: nextQty * nextPrice };
      })
    );
  };

  const removeLineItem = (index: number) => {
    setLineItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleGrandTotalChange = (newGrandTotal: number) => {
    if (lineItems.length === 0) return;
    const currentCalculatedTotal = lineItems.reduce((sum, item) => sum + item.qty * item.unitPrice, 0);
    if (currentCalculatedTotal === 0) {
      const totalQty = lineItems.reduce((sum, item) => sum + item.qty, 0);
      if (totalQty === 0) return;
      const pricePerUnit = newGrandTotal / totalQty;
      setLineItems((prev) =>
        prev.map((item) => {
          const nextPrice = Math.round(pricePerUnit * 100) / 100;
          return { ...item, unitPrice: nextPrice, total: item.qty * nextPrice };
        })
      );
      return;
    }

    const ratio = newGrandTotal / currentCalculatedTotal;
    setLineItems((prev) => {
      const updated = prev.map((item) => {
        const nextPrice = Math.round(item.unitPrice * ratio * 100) / 100;
        return {
          ...item,
          unitPrice: nextPrice,
          total: item.qty * nextPrice,
        };
      });

      const currentSum = updated.reduce((sum, item) => sum + item.total, 0);
      const diff = newGrandTotal - currentSum;
      if (diff !== 0 && updated.length > 0) {
        const lastIdx = updated.length - 1;
        const lastItem = updated[lastIdx];
        const nextTotal = Math.max(0, lastItem.total + diff);
        const nextPrice = lastItem.qty > 0 ? Math.round((nextTotal / lastItem.qty) * 100) / 100 : lastItem.unitPrice;
        updated[lastIdx] = {
          ...lastItem,
          unitPrice: nextPrice,
          total: lastItem.qty * nextPrice,
        };
      }
      return updated;
    });
  };

  return (
    <div className={`flex flex-col ${isMobile ? 'gap-3' : 'gap-3.5'}`}>
      <BarcodeScannerModal open={scannerOpen} onClose={() => setScannerOpen(false)} onScan={handleBarcodeScan} />

      {/* Add Sale Form Card */}
      <Card className="border border-pink-100 shadow-sm !p-3 sm:!p-5" pad={0}>
        
        <div className="flex flex-col gap-3">
          {/* Header & Branch Selection Side-by-Side */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b" style={{ borderColor: Theme.border }}>
            <div>
              <div className="text-[15px] font-bold" style={{ color: Theme.fg }}>{t.sales.addNewSale}</div>
              <div className="text-[12px] hidden sm:block" style={{ color: Theme.mutedFg }}>{t.sales.recordManualTx}</div>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="w-5.5 h-5.5 min-w-[22px] rounded-full flex items-center justify-center text-[10px] font-extrabold text-white" style={{ background: Theme.primary }}>
                {locale === 'bn' ? '১' : '1'}
              </div>
              <label className="text-xs font-semibold" style={{ color: Theme.fg }}>
                {t.sales.step1}:
              </label>
              <select
                value={saleBranchId}
                onChange={(e) => setSaleBranchId(e.target.value)}
                className="rounded-lg border px-3 py-1.5 text-xs font-semibold outline-none bg-white transition focus:border-pink-300 min-w-[120px] max-w-[160px] sm:max-w-none"
                style={{ borderColor: Theme.border, color: Theme.fg }}
              >
                {activeBranches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              <button
                onClick={() => setScannerOpen(true)}
                className="sm:hidden ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white shrink-0 transition hover:opacity-90"
                style={{ background: Theme.primary }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" /><path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" /><line x1="7" y1="12" x2="17" y2="12" /><line x1="7" y1="8" x2="17" y2="8" /><line x1="7" y1="16" x2="17" y2="16" />
                </svg>
                {t.sales.scan}
              </button>
            </div>
          </div>

          {/* Step 2 — Product Search */}
          <div className="flex gap-3">
            <div className="w-6 h-6 min-w-[24px] rounded-full flex items-center justify-center text-xs font-bold text-white mt-0.5" style={{ background: Theme.primary }}>
              {locale === 'bn' ? '২' : '2'}
            </div>
            <div className="flex-1 min-w-0">
              <label className="block text-[13px] font-semibold mb-1.5" style={{ color: Theme.fg }}>
                {t.sales.step2}
              </label>
              
              {/* Search Row */}
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setScannerOpen(true)}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-semibold text-white shrink-0 transition hover:opacity-90"
                  style={{ background: Theme.primary }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" /><path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" /><line x1="7" y1="12" x2="17" y2="12" /><line x1="7" y1="8" x2="17" y2="8" /><line x1="7" y1="16" x2="17" y2="16" />
                  </svg>
                  {t.sales.scan}
                </button>
                <div className="relative flex-1 min-w-0" ref={searchBoxRef}>
                  <input
                    type="text"
                    placeholder={t.sales.searchPlaceholder}
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setShowDropdown(true);
                    }}
                    onFocus={() => setShowDropdown(true)}
                    className="w-full px-3 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-pink-100 transition"
                    style={{
                      borderColor: Theme.border,
                      color: Theme.fg,
                      background: '#fff',
                    }}
                  />
                  {showDropdown && (
                    <div
                      className="absolute top-full left-0 right-0 bg-white border rounded-b-lg max-h-60 overflow-y-auto z-10"
                      style={{
                        borderColor: Theme.border,
                        borderTop: 'none',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      }}
                    >
                      {filteredProducts.length > 0 ? (
                        filteredProducts.map((p) => {
                          const pSizes = (p.sizes && p.sizes.length > 0) ? p.sizes : ((getProductMeta(p.id) as any)?.sizes || []);
                          return (
                            <div
                              key={p.id}
                              onClick={() => handleSelectProduct(p)}
                              className="w-full px-3 py-2.5 border-b text-left cursor-pointer text-xs flex justify-between items-center font-medium hover:bg-pink-50/40 transition-colors"
                              style={{
                                background: 'transparent',
                                color: Theme.fg,
                                borderColor: Theme.border,
                              }}
                            >
                              <div className="min-w-0 pr-2">
                                <div className="font-semibold text-sm">{p.name}</div>
                                <div className="text-[11px]" style={{ color: Theme.mutedFg }}>{t.modal.sku}: {p.sku}</div>
                                {pSizes.length > 0 && (
                                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                    <span className="text-[10px] text-zinc-500 font-semibold">{t.inventory?.sizeBreakdown || 'Sizes'}:</span>
                                    {pSizes.map((s: any) => {
                                      const isAvailable = (s.quantity ?? 0) > 0;
                                      return (
                                        <span
                                          key={s.name}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            addCartItem(p, s.name, pSizes);
                                          }}
                                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border transition-all ${
                                            isAvailable
                                              ? 'bg-pink-50 text-pink-700 border-pink-200 hover:bg-pink-100 hover:border-pink-300 cursor-pointer shadow-xs'
                                              : 'bg-zinc-100 text-zinc-400 border-zinc-200 cursor-not-allowed line-through'
                                          }`}
                                          title={isAvailable ? `Add size ${s.name} (${s.quantity} in stock)` : `Size ${s.name} is out of stock`}
                                        >
                                          {s.name}: <strong className="ml-1">{s.quantity ?? 0}</strong>
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                              <div className="text-xs shrink-0 text-right font-semibold" style={{ color: Theme.fg }}>
                                <div className="text-sm font-bold text-pink-600">{formatCurrency(p.price)}</div>
                                <div className="text-[11px] font-normal" style={{ color: Theme.mutedFg }}>
                                  {t.inventory.stock}: <span className="font-bold text-gray-800">{p.stock}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="px-3 py-3 text-center text-xs" style={{ color: Theme.mutedFg }}>
                          {t.sales.noProductsBranch}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Cart List */}
              <div className="rounded-xl border overflow-hidden bg-white" style={{ borderColor: Theme.border }}>
                {!isMobile && (
                  <div className="grid grid-cols-12 gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-wide bg-gray-50" style={{ color: Theme.mutedFg }}>
                    <div className="col-span-4">{t.sales.product}</div>
                    <div className="col-span-3 text-center">{t.sales.qty}</div>
                    <div className="col-span-2 text-right">{t.sales.unitPrice}</div>
                    <div className="col-span-2 text-right">{t.sales.lineTotal}</div>
                    <div className="col-span-1 text-right"> </div>
                  </div>
                )}

                {lineItems.length > 0 ? (
                  lineItems.map((item, idx) => {
                    const maxQty = getMaxEditableQty(item.productId, idx);

                    if (isMobile) {
                      return (
                        <div key={`${item.productId}-${idx}`} className="px-3 py-3 border-t border-gray-100 hover:bg-gray-50 transition-colors">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold truncate" style={{ color: Theme.fg }}>{item.name}</div>
                              <div className="text-[11px]" style={{ color: Theme.mutedFg }}>
                                {item.sku} · {item.unitType === 'WEIGHT' ? '⚖️' : '📦'} {item.unitLabel}
                              </div>
                              {item.sizes.length > 0 && (
                                <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                  <select
                                    value={item.sizeName}
                                    onChange={(e) => {
                                      const selectedName = e.target.value;
                                      setLineItems((prev) =>
                                        prev.map((li, i) => {
                                          if (i !== idx) return li;
                                          const matchedSize = li.sizes.find((sz: any) => sz.name === selectedName);
                                          const metaProduct = getProductMeta(li.productId) as any;
                                          const branchProduct = searchableProducts.find((p) => p.id === li.productId);
                                          const basePrice = Number(
                                            branchProduct?.price ??
                                            metaProduct?.price ??
                                            products.find((p) => p.id === li.productId)?.price ??
                                            li.unitPrice ??
                                            0
                                          );
                                          const hasOverride = matchedSize && matchedSize.priceOverride !== null && matchedSize.priceOverride !== undefined && Number(matchedSize.priceOverride) > 0;
                                          const newPrice = hasOverride ? Number(matchedSize.priceOverride) : basePrice;
                                          const availableStock = matchedSize && matchedSize.quantity !== undefined ? matchedSize.quantity : branchProduct?.stock;
                                          const adjustedQty = availableStock !== undefined ? Math.min(li.qty, Math.max(1, availableStock)) : li.qty;
                                          return { ...li, sizeName: selectedName, unitPrice: newPrice, qty: adjustedQty, total: adjustedQty * newPrice };
                                        })
                                      );
                                    }}
                                    className="rounded border px-2 py-1 text-xs outline-none bg-white font-semibold cursor-pointer"
                                    style={{ borderColor: Theme.border, color: Theme.fg }}
                                  >
                                    {item.sizes.map((s: any) => (
                                      <option key={s.name} value={s.name} disabled={s.quantity !== undefined && s.quantity <= 0}>
                                        {s.name} {s.quantity !== undefined ? `(${s.quantity} in stock)` : ''}
                                      </option>
                                    ))}
                                  </select>
                                  {(() => {
                                    const matched = item.sizes.find((s: any) => s.name === item.sizeName);
                                    const qtyAvail = matched?.quantity;
                                    if (qtyAvail === undefined) return null;
                                    return (
                                      <span className={`inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                                        qtyAvail > 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'
                                      }`}>
                                        {qtyAvail > 0 ? `${qtyAvail} available` : 'Out of stock'}
                                      </span>
                                    );
                                  })()}
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => removeLineItem(idx)}
                              className="text-sm font-bold px-2 py-1 rounded hover:bg-red-50 transition-colors"
                              style={{ color: '#dc2626' }}
                            >
                              ✕
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-2 mt-2.5">
                            <div>
                              <div className="text-[10px] mb-1 font-semibold uppercase tracking-wide" style={{ color: Theme.mutedFg }}>
                                {t.sales.qty}
                              </div>
                              <div className="inline-flex items-center rounded-lg border bg-white overflow-hidden" style={{ borderColor: Theme.border }}>
                                <button
                                  className="w-8 h-8 text-sm font-bold flex items-center justify-center transition hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                                  style={{ color: Theme.fg }}
                                  onClick={() => updateLineItem(idx, { qty: item.qty - 1 })}
                                  disabled={item.qty <= 1}
                                >
                                  −
                                </button>
                                <span className="w-px h-4 bg-gray-200" />
                                <input
                                  type="number"
                                  min={1}
                                  max={maxQty}
                                  value={item.qty}
                                  onChange={(e) => updateLineItem(idx, { qty: Number(e.target.value) || 1 })}
                                  className="w-10 text-center text-xs font-bold outline-none bg-transparent"
                                  style={{ color: Theme.fg }}
                                />
                                <span className="w-px h-4 bg-gray-200" />
                                <button
                                  className="w-8 h-8 text-sm font-bold flex items-center justify-center transition hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                                  style={{ color: Theme.fg }}
                                  onClick={() => updateLineItem(idx, { qty: item.qty + 1 })}
                                  disabled={item.qty >= maxQty}
                                >
                                  +
                                </button>
                              </div>
                              <span className="block text-[10px] mt-0.5 font-medium" style={{ color: Theme.mutedFg }}>
                                {t.modal.max}: {maxQty}
                              </span>
                            </div>

                            <div>
                              <div className="text-[10px] mb-1 font-semibold uppercase tracking-wide text-right" style={{ color: Theme.mutedFg }}>
                                {t.sales.unitPrice}
                              </div>
                              <input
                                type="number"
                                min={0}
                                value={item.unitPrice}
                                onChange={(e) => updateLineItem(idx, { unitPrice: Number(e.target.value) || 0 })}
                                className="w-full px-2.5 py-1.5 border rounded text-sm text-right outline-none bg-white focus:border-pink-300 transition"
                                style={{ borderColor: Theme.border }}
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between mt-2">
                            <span className="text-[11px] font-semibold" style={{ color: Theme.mutedFg }}>{t.sales.lineTotal}</span>
                            <span className="text-sm font-bold" style={{ color: Theme.primary }}>
                              {formatCurrency(item.total)}
                            </span>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={`${item.productId}-${idx}`} className="grid grid-cols-12 gap-2 px-3 py-2.5 border-t border-gray-100 items-center hover:bg-gray-50 transition-colors">
                        <div className="col-span-4 min-w-0">
                          <div className="text-xs font-semibold truncate" style={{ color: Theme.fg }}>{item.name}</div>
                          <div className="text-[10px]" style={{ color: Theme.mutedFg }}>
                            {item.sku} · {item.unitType === 'WEIGHT' ? '⚖️' : '📦'} {item.unitLabel}
                          </div>
                          {item.sizes.length > 0 && (
                            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                              <select
                                value={item.sizeName}
                                onChange={(e) => {
                                  const selectedName = e.target.value;
                                  setLineItems((prev) =>
                                    prev.map((li, i) => {
                                      if (i !== idx) return li;
                                      const matchedSize = li.sizes.find((sz: any) => sz.name === selectedName);
                                      const metaProduct = getProductMeta(li.productId) as any;
                                      const branchProduct = searchableProducts.find((p) => p.id === li.productId);
                                      const basePrice = Number(
                                        branchProduct?.price ??
                                        metaProduct?.price ??
                                        products.find((p) => p.id === li.productId)?.price ??
                                        li.unitPrice ??
                                        0
                                      );
                                      const hasOverride = matchedSize && matchedSize.priceOverride !== null && matchedSize.priceOverride !== undefined && Number(matchedSize.priceOverride) > 0;
                                      const newPrice = hasOverride ? Number(matchedSize.priceOverride) : basePrice;
                                      const availableStock = matchedSize && matchedSize.quantity !== undefined ? matchedSize.quantity : branchProduct?.stock;
                                      const adjustedQty = availableStock !== undefined ? Math.min(li.qty, Math.max(1, availableStock)) : li.qty;
                                      return { ...li, sizeName: selectedName, unitPrice: newPrice, qty: adjustedQty, total: adjustedQty * newPrice };
                                    })
                                  );
                                }}
                                className="rounded border px-2 py-1 text-xs outline-none bg-white font-semibold cursor-pointer"
                                style={{ borderColor: Theme.border, color: Theme.fg }}
                              >
                                {item.sizes.map((s: any) => (
                                  <option key={s.name} value={s.name} disabled={s.quantity !== undefined && s.quantity <= 0}>
                                    {s.name} {s.quantity !== undefined ? `(${s.quantity} in stock)` : ''}
                                  </option>
                                ))}
                              </select>
                              {(() => {
                                const matched = item.sizes.find((s: any) => s.name === item.sizeName);
                                const qtyAvail = matched?.quantity;
                                if (qtyAvail === undefined) return null;
                                return (
                                  <span className={`inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                                    qtyAvail > 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'
                                  }`}>
                                    {qtyAvail > 0 ? `${qtyAvail} available` : 'Out of stock'}
                                  </span>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                        <div className="col-span-3 flex flex-col items-center">
                          <div className="inline-flex items-center rounded-lg border bg-white overflow-hidden" style={{ borderColor: Theme.border }}>
                            <button
                              className="w-9 h-9 text-base font-bold flex items-center justify-center transition hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                              style={{ color: Theme.fg }}
                              onClick={() => updateLineItem(idx, { qty: item.qty - 1 })}
                              disabled={item.qty <= 1}
                            >
                              −
                            </button>
                            <span className="w-px h-5 bg-gray-200" />
                            <input
                              type="number"
                              min={1}
                              max={maxQty}
                              value={item.qty}
                              onChange={(e) => updateLineItem(idx, { qty: Number(e.target.value) || 1 })}
                              className="w-11 text-center text-sm font-bold outline-none bg-transparent"
                              style={{ color: Theme.fg }}
                            />
                            <span className="w-px h-5 bg-gray-200" />
                            <button
                              className="w-9 h-9 text-base font-bold flex items-center justify-center transition hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                              style={{ color: Theme.fg }}
                              onClick={() => updateLineItem(idx, { qty: item.qty + 1 })}
                              disabled={item.qty >= maxQty}
                            >
                              +
                            </button>
                          </div>
                          <span className="block text-[10px] mt-1 font-medium" style={{ color: Theme.mutedFg }}>
                            {t.modal.max}: {maxQty}
                          </span>
                        </div>
                        <div className="col-span-2">
                          <input
                            type="number"
                            min={0}
                            value={item.unitPrice}
                            onChange={(e) => updateLineItem(idx, { unitPrice: Number(e.target.value) || 0 })}
                            className="w-full px-2 py-1 border rounded text-xs text-right outline-none bg-white focus:border-pink-300 transition"
                            style={{ borderColor: Theme.border }}
                          />
                        </div>
                        <div className="col-span-2 text-right text-xs font-bold" style={{ color: Theme.primary }}>
                          {formatCurrency(item.total)}
                        </div>
                        <div className="col-span-1 text-right">
                          <button
                            onClick={() => removeLineItem(idx)}
                            className="text-xs font-bold px-1.5 py-1 rounded hover:bg-red-50 transition-colors"
                            style={{ color: '#dc2626' }}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="px-3 py-5 text-center text-xs" style={{ color: Theme.mutedFg }}>
                    {t.sales.noProductsAdded}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="h-px ml-0 sm:ml-9" style={{ background: Theme.border }} />

          {/* Step 3 — Summary & Record */}
          <div className="flex gap-3">
            <div className="w-6 h-6 min-w-[24px] rounded-full flex items-center justify-center text-xs font-bold text-white mt-0.5" style={{ background: Theme.primary }}>
              {locale === 'bn' ? '৩' : '3'}
            </div>
            <div className="flex-1">
              <label className="block text-[13px] font-semibold mb-1.5" style={{ color: Theme.fg }}>
                {t.sales.step3}
              </label>
              
              {/* Summary Box */}
              <div className="rounded-xl border p-3.5 mb-3.5 transition-shadow hover:shadow-sm" style={{ borderColor: Theme.border, background: '#fff' }}>
                <div className="flex justify-between mb-2 text-xs" style={{ color: Theme.mutedFg }}>
                  <span>{t.sales.totalItems}</span>
                  <span className="font-semibold" style={{ color: Theme.fg }}>{totalItems}</span>
                </div>
                <div className="flex justify-between mb-2 text-xs" style={{ color: Theme.mutedFg }}>
                  <span>{t.sales.totalQty}</span>
                  <span className="font-semibold" style={{ color: Theme.fg }}>{totalQty}</span>
                </div>
                <div className="h-px my-2" style={{ background: Theme.border }} />
                <div className="flex justify-between items-center text-sm font-black" style={{ color: Theme.primary }}>
                  <span>{t.sales.grandTotal}: ৳</span>
                  <input
                    type="number"
                    min={0}
                    value={lineItems.length > 0 ? parseFloat(grandTotal.toFixed(2)) : 0}
                    disabled={lineItems.length === 0}
                    onChange={(e) => handleGrandTotalChange(Number(e.target.value) || 0)}
                    className="w-24 px-2 py-1 border rounded-lg text-sm font-black text-right outline-none bg-white focus:ring-2 focus:ring-pink-100 transition-all"
                    style={{ borderColor: Theme.border, color: Theme.primary }}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className={`flex gap-2 ${isMobile ? 'flex-col-reverse' : 'justify-end'}`}>
                <Btn
                  variant="ghost"
                  onClick={() => {
                    setSearchQuery('');
                    setShowDropdown(false);
                    setLineItems([]);
                  }}
                  className={isMobile ? 'w-full' : ''}
                >
                  {t.sales.reset}
                </Btn>
                <Btn
                  variant="primary"
                  disabled={lineItems.length === 0 || hasInvalidLine || createManualSaleMutation.isPending}
                  onClick={handleConfirm}
                  className={isMobile ? 'w-full' : ''}
                >
                  {createManualSaleMutation.isPending ? t.sales.recording : `${t.sales.recordSale} · ${formatCurrency(grandTotal)}`}
                </Btn>
              </div>
            </div>
          </div>

        </div>
      </Card>

      {/* Sales History */}
      <Card className="!p-3 sm:!p-5" pad={0}>
        <SecHead 
          title={t.sales.salesHistory} 
          sub={`${t.sales.totalSales}: ${historyMeta?.total ?? 0}`}
        />
        
        <div className="mt-3.5">
          {/* Controls */}
          <div className="mb-3 grid gap-2 md:grid-cols-3">
            <input
              type="text"
              placeholder={t.sales.searchHistory}
              value={searchLog}
              onChange={(e) => {
                setSearchLog(e.target.value);
                setHistoryPage(1);
              }}
              className="w-full px-3 py-2 border rounded text-xs outline-none"
              style={{
                borderColor: Theme.border,
                color: Theme.fg,
                background: '#fff',
              }}
            />
            <select
              value={historySortBy}
              onChange={(e) => {
                setHistorySortBy(e.target.value as 'createdAt' | 'totalAmount' | 'totalQty' | 'saleNumber');
                setHistoryPage(1);
              }}
              className="w-full px-3 py-2 border rounded text-xs outline-none"
              style={{ borderColor: Theme.border, color: Theme.fg, background: '#fff' }}
            >
              <option value="createdAt">{t.sales.sortDate}</option>
              <option value="saleNumber">{t.sales.sortSaleId}</option>
              <option value="totalQty">{t.sales.sortQty}</option>
              <option value="totalAmount">{t.sales.sortAmount}</option>
            </select>
            <div className="flex gap-2">
              <select
                value={historySortOrder}
                onChange={(e) => {
                  setHistorySortOrder(e.target.value as 'asc' | 'desc');
                  setHistoryPage(1);
                }}
                className="w-1/2 px-3 py-2 border rounded text-xs outline-none"
                style={{ borderColor: Theme.border, color: Theme.fg, background: '#fff' }}
              >
                <option value="desc">{t.sales.desc}</option>
                <option value="asc">{t.sales.asc}</option>
              </select>
              <select
                value={historyLimit}
                onChange={(e) => {
                  setHistoryLimit(Number(e.target.value));
                  setHistoryPage(1);
                }}
                className="w-1/2 px-3 py-2 border rounded text-xs outline-none"
                style={{ borderColor: Theme.border, color: Theme.fg, background: '#fff' }}
              >
                <option value={10}>10 {t.sales.perPage}</option>
                <option value={20}>20 {t.sales.perPage}</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b-2" style={{ borderColor: Theme.border }}>
                  <th className="px-2 py-2 font-bold text-left" style={{ color: Theme.mutedFg }}>{t.sales.saleId}</th>
                  <th className="px-2 py-2 font-bold text-left" style={{ color: Theme.mutedFg }}>{t.sales.product}</th>
                  <th className="px-2 py-2 font-bold text-center" style={{ color: Theme.mutedFg }}>{t.sales.qty}</th>
                  <th className="px-2 py-2 font-bold text-right" style={{ color: Theme.mutedFg }}>{t.sales.amount}</th>
                  <th className="px-2 py-2 font-bold text-left" style={{ color: Theme.mutedFg }}>{t.sales.date}</th>
                  <th className="px-2 py-2 font-bold text-left" style={{ color: Theme.mutedFg }}>{t.sales.branch}</th>
                  <th className="px-2 py-2 font-bold text-left" style={{ color: Theme.mutedFg }}>{t.sales.by}</th>
                  <th className="px-2 py-2 font-bold text-center" style={{ color: Theme.mutedFg }}>{t.sales.actions}</th>
                </tr>
              </thead>
              <tbody>
                {manualSalesQuery.isLoading ? (
                  <tr>
                    <td colSpan={8} className="px-2 py-6 text-center text-xs" style={{ color: Theme.mutedFg }}>
                      {t.sales.loadingSales}
                    </td>
                  </tr>
                ) : historyRows.length > 0 ? (
                  historyRows.map((sale) => (
                    <tr 
                      key={sale.saleNumber}
                      className="border-b"
                      style={{ borderColor: Theme.border }}
                    >
                      <td className="px-2 py-2.5 font-semibold" style={{ color: Theme.primary }}>
                        {sale.saleNumber}
                      </td>
                      <td className="px-2 py-2.5" style={{ color: Theme.fg }}>
                        {sale.items?.length > 1
                          ? `${sale.items[0]?.productNameSnapshot || t.sales.saleItem} +${sale.items.length - 1} ${t.sales.more}`
                          : sale.items?.[0]?.productNameSnapshot || t.sales.saleItem}
                      </td>
                      <td className="px-2 py-2.5 text-center font-semibold" style={{ color: Theme.fg }}>
                        {sale.totalQty}
                      </td>
                      <td className="px-2 py-2.5 text-right font-bold" style={{ color: Theme.primary }}>
                        {formatCurrency(sale.totalAmount)}
                      </td>
                      <td className="px-2 py-2.5 text-xs" style={{ color: Theme.mutedFg }}>
                        {new Date(sale.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-2 py-2.5" style={{ color: Theme.mutedFg }}>
                        {sale.branchName || t.sales.main}
                      </td>
                      <td className="px-2 py-2.5" style={{ color: Theme.mutedFg }}>
                        {sale.soldBy || t.sales.staff}
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        <Btn
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePrintReceipt(sale)}
                          className="p-1 min-w-[28px] h-7 inline-flex items-center justify-center text-primary hover:bg-primary/10 rounded-lg transition-all"
                          title={t.sales.printReceipt}
                        >
                          🖨️
                        </Btn>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-2 py-6 text-center text-xs" style={{ color: Theme.mutedFg }}>
                      {searchLog ? t.sales.noSalesMatch : t.sales.noSalesYet}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center justify-end gap-2">
            <Btn
              variant="ghost"
              disabled={historyPage <= 1 || manualSalesQuery.isFetching}
              onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
            >
              {t.sales.prev}
            </Btn>
            <span className="text-xs" style={{ color: Theme.mutedFg }}>
              {t.sales.page} {historyMeta?.page || historyPage} / {historyMeta?.pages || 1}
            </span>
            <Btn
              variant="ghost"
              disabled={!!historyMeta && historyPage >= historyMeta.pages || manualSalesQuery.isFetching}
              onClick={() => setHistoryPage((p) => p + 1)}
            >
              {t.sales.next}
            </Btn>
          </div>
        </div>
      </Card>

      {showPrintToast && lastRecordedSale && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[150] flex items-center justify-between gap-4 w-[90%] max-w-md p-4 rounded-xl border border-primary/20 bg-white/95 backdrop-blur-md shadow-2xl animate-in slide-in-from-bottom-5 duration-300">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-foreground">
              {t.sales.recorded}! {lastRecordedSale.saleNumber}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {lastRecordedSale.totalQty} {t.sales.qty} · ৳{lastRecordedSale.totalAmount}
            </span>
          </div>
          <div className="flex gap-2">
            <Btn
              variant="primary"
              size="sm"
              onClick={() => {
                handlePrintReceipt(lastRecordedSale);
                setShowPrintToast(false);
                setLastRecordedSale(null);
              }}
              className="flex items-center gap-1 text-xs font-semibold py-1.5"
            >
              🖨️ {t.sales.printReceipt}
            </Btn>
            <button
              onClick={() => {
                setShowPrintToast(false);
                setLastRecordedSale(null);
              }}
              className="p-1 hover:bg-gray-100 rounded text-muted-foreground text-sm"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
