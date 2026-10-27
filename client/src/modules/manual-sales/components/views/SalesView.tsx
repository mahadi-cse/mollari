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
import { Truck } from 'lucide-react';

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
  colorName: string;
  colorHex?: string | null;
  sizes: Array<{ name: string; quantity?: number; imageUrl?: string | null; priceOverride?: number | null; costPriceOverride?: number | null; isActive?: boolean }>;
  colors: Array<{
    name: string;
    hexCode?: string | null;
    imageUrl?: string | null;
    quantity?: number;
    priceOverride?: number | null;
    costPriceOverride?: number | null;
    isActive?: boolean;
    sizes?: Array<{ name: string; quantity?: number; imageUrl?: string | null; priceOverride?: number | null; costPriceOverride?: number | null; isActive?: boolean }>;
  }>;
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
  const [viewSaleModal, setViewSaleModal] = useState<any | null>(null);

  // Steadfast Delivery Fields
  const [isCourierDelivery, setIsCourierDelivery] = useState(true);
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [codAmount, setCodAmount] = useState<number | ''>('');

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
      storeName: storeInfo?.storeName || 'Mollari',
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
          ${(item.colorName || item.sizeName) ? `
            <span style="font-size: 9px; display: block; color: #555;">
              ${[item.colorName && `Color: ${item.colorName}`, item.sizeName && `Size: ${item.sizeName}`].filter(Boolean).join(' | ')}
            </span>
          ` : ''}
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
            ${(sale.recipientName || sale.recipientPhone) ? `
            <tr>
              <td colspan="2" style="padding-top: 4px; font-size: 10px;">
                <strong>Delivery To:</strong> ${sale.recipientName || ''} (${sale.recipientPhone || ''})<br/>
                ${sale.recipientAddress ? `<span style="color: #444;">${sale.recipientAddress}</span>` : ''}
              </td>
            </tr>
            ` : ''}
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
      storeName: siteSettings?.storeName || 'Mollari',
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
    colors: (item.product?.colors || []).filter((c: any) => c.isActive !== false),
  }));

  const getProductMeta = (productId: number) => {
    const liveInv = branchProducts.find((p: any) => p.id === productId);
    const meta = productsMetaList.find((p: any) => p.id === productId);
    if (!liveInv) return meta;
    return {
      ...meta,
      ...liveInv,
      sizes: (liveInv.sizes && liveInv.sizes.length > 0) ? liveInv.sizes : (meta?.sizes || []),
      colors: (liveInv.colors && liveInv.colors.length > 0) ? liveInv.colors : (meta?.colors || []),
    };
  };

  const searchableProducts = branchProducts;

  const grandTotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const totalQty = lineItems.reduce((sum, item) => sum + item.qty, 0);
  const totalItems = lineItems.length;
  const getMaxEditableQty = (productId: number, rowIndex: number) => {
    const item = lineItems[rowIndex];
    const product = searchableProducts.find((p) => p.id === productId);
    if (!product || !item) return 1;

    let variantStock = product.stock;
    const meta = getProductMeta(productId) as any;
    const colors = (meta?.colors || product.colors || []).filter((c: any) => c.isActive !== false);

    if (item.colorName) {
      const matchedColor = colors.find((c: any) => c.name === item.colorName);
      if (matchedColor) {
        if (item.sizeName && matchedColor.sizes && matchedColor.sizes.length > 0) {
          const matchedSize = matchedColor.sizes.find((s: any) => s.name === item.sizeName);
          if (matchedSize && matchedSize.quantity !== undefined) {
            variantStock = Number(matchedSize.quantity);
          }
        } else if (matchedColor.quantity !== undefined) {
          variantStock = Number(matchedColor.quantity);
        }
      }
    } else if (item.sizeName && item.sizes && item.sizes.length > 0) {
      const matchedSize = item.sizes.find((s: any) => s.name === item.sizeName);
      if (matchedSize && matchedSize.quantity !== undefined) {
        variantStock = Number(matchedSize.quantity);
      }
    }

    const usedByOthers = lineItems.reduce((sum, li, idx) => {
      if (
        idx === rowIndex ||
        li.productId !== productId ||
        (li.colorName || '') !== (item.colorName || '') ||
        (li.sizeName || '') !== (item.sizeName || '')
      ) {
        return sum;
      }
      return sum + li.qty;
    }, 0);

    return Math.max(1, variantStock - usedByOthers);
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

  const addCartItem = (
    product: Product,
    variantOptions?: {
      colorName?: string;
      sizeName?: string;
    }
  ) => {
    const meta = getProductMeta(product.id) as any;
    const unitType = meta?.unitType || product.unitType || 'PIECE';
    const unitLabel = meta?.unitLabel || product.unitLabel || 'pc';

    const colors = (meta?.colors || product.colors || []).filter((c: any) => c.isActive !== false);
    const standaloneSizes = (meta?.sizes || product.sizes || []).filter((s: any) => s.isActive !== false);

    // 1. Resolve Color
    let selectedColorName = variantOptions?.colorName;
    if (selectedColorName === undefined && colors.length > 0) {
      const availableColor = colors.find((c: any) => {
        if (c.sizes && c.sizes.length > 0) {
          return c.sizes.some((s: any) => (s.quantity ?? 0) > 0);
        }
        return (c.quantity ?? 0) > 0;
      }) || colors[0];
      selectedColorName = availableColor?.name || '';
    }
    const colorName = selectedColorName || '';
    const matchedColor = colors.find((c: any) => c.name === colorName) || null;

    // 2. Resolve Sizes (color sizes or standalone sizes)
    let availableSizes: any[] = [];
    if (matchedColor && matchedColor.sizes && matchedColor.sizes.length > 0) {
      availableSizes = matchedColor.sizes.filter((s: any) => s.isActive !== false);
    } else if (standaloneSizes.length > 0) {
      availableSizes = standaloneSizes;
    }

    // 3. Resolve Size
    let selectedSizeName = variantOptions?.sizeName;
    if (selectedSizeName === undefined && availableSizes.length > 0) {
      const availableSize = availableSizes.find((s: any) => (s.quantity ?? 0) > 0) || availableSizes[0];
      selectedSizeName = availableSize?.name || '';
    }
    const sizeName = selectedSizeName || '';
    const matchedSize = availableSizes.find((s: any) => s.name === sizeName) || null;

    // 4. Resolve Stock
    let variantStock = Number(product.stock ?? 0);
    if (matchedSize && matchedSize.quantity !== undefined) {
      variantStock = Number(matchedSize.quantity);
    } else if (matchedColor && matchedColor.quantity !== undefined) {
      variantStock = Number(matchedColor.quantity);
    }

    if (variantStock <= 0) {
      if (colorName && sizeName) {
        toast.error(`Variant (Color: ${colorName}, Size: ${sizeName}) is out of stock!`);
      } else if (colorName) {
        toast.error(`Color ${colorName} is out of stock!`);
      } else if (sizeName) {
        toast.error(`Size ${sizeName} is out of stock!`);
      } else {
        toast.error(`${product.name} is out of stock!`);
      }
      return;
    }

    // 5. Resolve Price
    const resolvedPrice =
      matchedSize && matchedSize.priceOverride !== null && matchedSize.priceOverride !== undefined && Number(matchedSize.priceOverride) > 0
        ? Number(matchedSize.priceOverride)
        : matchedColor && matchedColor.priceOverride !== null && matchedColor.priceOverride !== undefined && Number(matchedColor.priceOverride) > 0
          ? Number(matchedColor.priceOverride)
          : Number(product.price ?? 0);

    const defaultQty = 1;

    setLineItems((prev) => {
      const existingIdx = prev.findIndex(
        (i) => i.productId === product.id && (i.colorName || '') === colorName && (i.sizeName || '') === sizeName
      );
      if (existingIdx !== -1) {
        return prev.map((i, idx) => {
          if (idx !== existingIdx) return i;
          const nextQty = Math.min(variantStock, i.qty + 1);
          return { ...i, qty: nextQty, total: nextQty * i.unitPrice };
        });
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          sku: product.sku,
          qty: Math.min(defaultQty, Math.max(1, variantStock)),
          unitPrice: resolvedPrice,
          total: resolvedPrice * Math.min(defaultQty, Math.max(1, variantStock)),
          unitType,
          unitLabel,
          colorName,
          colorHex: matchedColor?.hexCode || null,
          sizeName,
          colors,
          sizes: availableSizes,
        },
      ];
    });
    setSearchQuery('');
    setShowDropdown(false);
  };

  const handleSelectProduct = (product: Product) => {
    addCartItem(product);
  };

  const handleLineColorChange = (index: number, newColorName: string) => {
    setLineItems((prev) =>
      prev.map((li, i) => {
        if (i !== index) return li;
        const matchedColor = li.colors.find((c) => c.name === newColorName);
        const metaProduct = getProductMeta(li.productId) as any;
        const branchProduct = searchableProducts.find((p) => p.id === li.productId);
        const basePrice = Number(
          branchProduct?.price ??
          metaProduct?.price ??
          products.find((p) => p.id === li.productId)?.price ??
          0
        );

        const newSizes = (matchedColor?.sizes || []).filter((s: any) => s.isActive !== false);
        let newSizeName = '';
        let matchedSize: any = null;
        if (newSizes.length > 0) {
          matchedSize =
            newSizes.find((s: any) => s.name === li.sizeName && (s.quantity ?? 0) > 0) ||
            newSizes.find((s: any) => (s.quantity ?? 0) > 0) ||
            newSizes[0];
          newSizeName = matchedSize?.name || '';
        }

        const hasSizeOverride =
          matchedSize && matchedSize.priceOverride !== null && matchedSize.priceOverride !== undefined && Number(matchedSize.priceOverride) > 0;
        const hasColorOverride =
          matchedColor && matchedColor.priceOverride !== null && matchedColor.priceOverride !== undefined && Number(matchedColor.priceOverride) > 0;
        const newPrice = hasSizeOverride
          ? Number(matchedSize.priceOverride)
          : hasColorOverride
            ? Number(matchedColor.priceOverride)
            : basePrice;

        const availStock =
          matchedSize?.quantity !== undefined
            ? matchedSize.quantity
            : matchedColor?.quantity !== undefined
              ? matchedColor.quantity
              : branchProduct?.stock;

        const adjustedQty = availStock !== undefined ? Math.min(li.qty, Math.max(1, availStock)) : li.qty;

        return {
          ...li,
          colorName: newColorName,
          colorHex: matchedColor?.hexCode || null,
          sizeName: newSizeName,
          sizes: newSizes,
          unitPrice: newPrice,
          qty: adjustedQty,
          total: adjustedQty * newPrice,
        };
      })
    );
  };

  const handleLineSizeChange = (index: number, newSizeName: string) => {
    setLineItems((prev) =>
      prev.map((li, i) => {
        if (i !== index) return li;
        const matchedSize = li.sizes.find((sz: any) => sz.name === newSizeName);
        const matchedColor = li.colors.find((c) => c.name === li.colorName);
        const metaProduct = getProductMeta(li.productId) as any;
        const branchProduct = searchableProducts.find((p) => p.id === li.productId);
        const basePrice = Number(
          branchProduct?.price ??
          metaProduct?.price ??
          products.find((p) => p.id === li.productId)?.price ??
          0
        );

        const hasSizeOverride =
          matchedSize && matchedSize.priceOverride !== null && matchedSize.priceOverride !== undefined && Number(matchedSize.priceOverride) > 0;
        const hasColorOverride =
          matchedColor && matchedColor.priceOverride !== null && matchedColor.priceOverride !== undefined && Number(matchedColor.priceOverride) > 0;
        const newPrice = hasSizeOverride
          ? Number(matchedSize.priceOverride)
          : hasColorOverride
            ? Number(matchedColor.priceOverride)
            : basePrice;

        const availStock =
          matchedSize?.quantity !== undefined
            ? matchedSize.quantity
            : matchedColor?.quantity !== undefined
              ? matchedColor.quantity
              : branchProduct?.stock;

        const adjustedQty = availStock !== undefined ? Math.min(li.qty, Math.max(1, availStock)) : li.qty;

        return {
          ...li,
          sizeName: newSizeName,
          unitPrice: newPrice,
          qty: adjustedQty,
          total: adjustedQty * newPrice,
        };
      })
    );
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
      if (isCourierDelivery) {
        if (!recipientName.trim()) {
          toast.error('Recipient name is required for courier delivery');
          return;
        }
        if (!recipientPhone.trim()) {
          toast.error('Recipient phone is required for courier delivery');
          return;
        }
        if (!recipientAddress.trim()) {
          toast.error('Recipient address is required for courier delivery');
          return;
        }
      }

      try {
        const result = await createManualSaleMutation.mutateAsync({
          soldBy: session?.user?.name || session?.user?.email || t.sales.staff,
          note: deliveryNote.trim() || t.manualSale,
          branchId: Number(saleBranchId),
          branchName: activeBranches.find((b) => b.id === Number(saleBranchId))?.name || t.sales.main,
          ...(isCourierDelivery ? {
            recipientName: recipientName.trim(),
            recipientPhone: recipientPhone.trim(),
            recipientAddress: recipientAddress.trim(),
            codAmount: codAmount !== '' ? Number(codAmount) : grandTotal,
          } : {}),
          items: lineItems.map((item) => ({
            productId: item.productId,
            quantity: item.qty,
            unitPrice: item.unitPrice,
            ...(item.sizeName ? { sizeName: item.sizeName } : {}),
            ...(item.colorName ? { colorName: item.colorName } : {}),
          })),
        });
        toast.success(`${t.sales.recorded} ${lineItems.length} ${t.inventory.product}(s), ${totalQty} ${t.sales.qty} ${t.modal.total.toLowerCase()}`);
        if (result) {
          setLastRecordedSale(result);
          setShowPrintToast(true);
        }
        setSearchQuery('');
        setLineItems([]);
        setIsCourierDelivery(true);
        setRecipientName('');
        setRecipientPhone('');
        setRecipientAddress('');
        setDeliveryNote('');
        setCodAmount('');
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
                          const meta = getProductMeta(p.id) as any;
                          const pColors = (p.colors && p.colors.length > 0) ? p.colors : (meta?.colors || []);
                          const pSizes = (p.sizes && p.sizes.length > 0) ? p.sizes : (meta?.sizes || []);
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

                                {/* Colors & Sizes Breakdown */}
                                {pColors.length > 0 ? (
                                  <div className="flex flex-col gap-1 mt-1.5">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <span className="text-[10px] text-zinc-500 font-semibold">{t.products?.colors || 'Colors'}:</span>
                                      {pColors.map((c: any) => {
                                        const hasColorSizes = c.sizes && c.sizes.length > 0;
                                        const colorStock = hasColorSizes
                                          ? c.sizes.reduce((sum: number, s: any) => sum + (Number(s.quantity) || 0), 0)
                                          : (c.quantity ?? 0);
                                        const isColorAvail = colorStock > 0;

                                        return (
                                          <div key={c.name} className="flex flex-wrap items-center gap-1">
                                            <span
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                addCartItem(p, { colorName: c.name });
                                              }}
                                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border transition-all ${
                                                isColorAvail
                                                  ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 hover:border-purple-300 cursor-pointer shadow-xs'
                                                  : 'bg-zinc-100 text-zinc-400 border-zinc-200 cursor-not-allowed line-through'
                                              }`}
                                              title={isColorAvail ? `Add ${c.name} (${colorStock} in stock)` : `${c.name} is out of stock`}
                                            >
                                              {c.hexCode && (
                                                <span
                                                  className="w-2.5 h-2.5 rounded-full border border-black/15 shrink-0"
                                                  style={{ backgroundColor: c.hexCode }}
                                                />
                                              )}
                                              {c.name} {!hasColorSizes && <strong>: {c.quantity ?? 0}</strong>}
                                            </span>

                                            {hasColorSizes && (
                                              <span className="inline-flex items-center gap-1">
                                                {c.sizes.map((s: any) => {
                                                  const isSizeAvail = (s.quantity ?? 0) > 0;
                                                  return (
                                                    <span
                                                      key={`${c.name}-${s.name}`}
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        addCartItem(p, { colorName: c.name, sizeName: s.name });
                                                      }}
                                                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border transition-all ${
                                                        isSizeAvail
                                                          ? 'bg-pink-50 text-pink-700 border-pink-200 hover:bg-pink-100 hover:border-pink-300 cursor-pointer'
                                                          : 'bg-zinc-100 text-zinc-400 border-zinc-200 cursor-not-allowed line-through'
                                                      }`}
                                                      title={isSizeAvail ? `Add ${c.name} - ${s.name} (${s.quantity} in stock)` : `${c.name} - ${s.name} is out of stock`}
                                                    >
                                                      {s.name}: <strong>{s.quantity ?? 0}</strong>
                                                    </span>
                                                  );
                                                })}
                                              </span>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ) : pSizes.length > 0 ? (
                                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                    <span className="text-[10px] text-zinc-500 font-semibold">{t.inventory?.sizeBreakdown || 'Sizes'}:</span>
                                    {pSizes.map((s: any) => {
                                      const isAvailable = (s.quantity ?? 0) > 0;
                                      return (
                                        <span
                                          key={s.name}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            addCartItem(p, { sizeName: s.name });
                                          }}
                                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border transition-all ${isAvailable
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
                                ) : null}
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
                              {/* Variant Selectors: Color and/or Size */}
                              {(item.colors?.length > 0 || item.sizes?.length > 0) && (
                                <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                                  {/* Color Selector */}
                                  {item.colors?.length > 0 && (
                                    <div className="flex items-center gap-1">
                                      <span className="text-[10px] font-semibold text-zinc-400">{t.sales?.color || 'Color'}:</span>
                                      {item.colors.length > 1 ? (
                                        <select
                                          value={item.colorName}
                                          onChange={(e) => handleLineColorChange(idx, e.target.value)}
                                          className="rounded border px-2 py-0.5 text-xs outline-none bg-white font-semibold cursor-pointer"
                                          style={{ borderColor: Theme.border, color: Theme.fg }}
                                        >
                                          {item.colors.map((c: any) => (
                                            <option key={c.name} value={c.name}>
                                              {c.name}
                                            </option>
                                          ))}
                                        </select>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                                          {item.colorHex && (
                                            <span className="w-2 h-2 rounded-full border border-black/15 inline-block" style={{ backgroundColor: item.colorHex }} />
                                          )}
                                          {item.colorName}
                                        </span>
                                      )}
                                    </div>
                                  )}

                                  {/* Size Selector */}
                                  {item.sizes?.length > 0 && (
                                    <div className="flex items-center gap-1">
                                      <span className="text-[10px] font-semibold text-zinc-400">{t.sales?.size || 'Size'}:</span>
                                      {item.sizes.length > 1 ? (
                                        <select
                                          value={item.sizeName}
                                          onChange={(e) => handleLineSizeChange(idx, e.target.value)}
                                          className="rounded border px-2 py-0.5 text-xs outline-none bg-white font-semibold cursor-pointer"
                                          style={{ borderColor: Theme.border, color: Theme.fg }}
                                        >
                                          {item.sizes.map((s: any) => (
                                            <option key={s.name} value={s.name} disabled={s.quantity !== undefined && s.quantity <= 0}>
                                              {s.name} {s.quantity !== undefined ? `(${s.quantity} in stock)` : ''}
                                            </option>
                                          ))}
                                        </select>
                                      ) : (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-pink-50 text-pink-700 border border-pink-200">
                                          {item.sizeName}
                                        </span>
                                      )}
                                    </div>
                                  )}

                                  {/* In Stock Badge */}
                                  {(() => {
                                    const qtyAvail = maxQty;
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
                          {/* Variant Selectors: Color and/or Size */}
                          {(item.colors?.length > 0 || item.sizes?.length > 0) && (
                            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                              {/* Color Selector */}
                              {item.colors?.length > 0 && (
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] font-semibold text-zinc-400">{t.sales?.color || 'Color'}:</span>
                                  {item.colors.length > 1 ? (
                                    <select
                                      value={item.colorName}
                                      onChange={(e) => handleLineColorChange(idx, e.target.value)}
                                      className="rounded border px-2 py-0.5 text-xs outline-none bg-white font-semibold cursor-pointer"
                                      style={{ borderColor: Theme.border, color: Theme.fg }}
                                    >
                                      {item.colors.map((c: any) => (
                                        <option key={c.name} value={c.name}>
                                          {c.name}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                                      {item.colorHex && (
                                        <span className="w-2 h-2 rounded-full border border-black/15 inline-block" style={{ backgroundColor: item.colorHex }} />
                                      )}
                                      {item.colorName}
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* Size Selector */}
                              {item.sizes?.length > 0 && (
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] font-semibold text-zinc-400">{t.sales?.size || 'Size'}:</span>
                                  {item.sizes.length > 1 ? (
                                    <select
                                      value={item.sizeName}
                                      onChange={(e) => handleLineSizeChange(idx, e.target.value)}
                                      className="rounded border px-2 py-0.5 text-xs outline-none bg-white font-semibold cursor-pointer"
                                      style={{ borderColor: Theme.border, color: Theme.fg }}
                                    >
                                      {item.sizes.map((s: any) => (
                                        <option key={s.name} value={s.name} disabled={s.quantity !== undefined && s.quantity <= 0}>
                                          {s.name} {s.quantity !== undefined ? `(${s.quantity} in stock)` : ''}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-pink-50 text-pink-700 border border-pink-200">
                                      {item.sizeName}
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* In Stock Badge */}
                              {(() => {
                                const qtyAvail = maxQty;
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

              {/* Courier Delivery Section (Steadfast) */}
              <div
                className="rounded-xl border p-3.5 mb-3.5 transition-all"
                style={{
                  borderColor: isCourierDelivery ? '#f472b6' : Theme.border,
                  background: isCourierDelivery ? '#fffbfd' : '#fff',
                }}
              >
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isCourierDelivery}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setIsCourierDelivery(checked);
                      if (checked && codAmount === '') {
                        setCodAmount(grandTotal);
                      }
                    }}
                    className="w-4 h-4 rounded text-pink-600 focus:ring-pink-500 accent-pink-600 cursor-pointer"
                  />
                  <div className="flex items-center gap-1.5 font-semibold text-xs" style={{ color: Theme.fg }}>
                    <Truck className="w-4 h-4 text-pink-600" />
                    <span>Courier Delivery (Steadfast)</span>
                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-pink-50 text-pink-700 border border-pink-200">
                      COD / Shipping
                    </span>
                  </div>
                </label>

                {isCourierDelivery && (
                  <div className="mt-3.5 pt-3 border-t border-zinc-100 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
                          Recipient Name <span className="text-pink-600">*</span>
                        </label>
                        <input
                          type="text"
                          maxLength={100}
                          value={recipientName}
                          onChange={(e) => setRecipientName(e.target.value)}
                          placeholder="Customer / Recipient Full Name"
                          className="w-full px-3 py-1.5 border rounded-lg text-xs outline-none focus:ring-2 focus:ring-pink-100 transition-all bg-white"
                          style={{ borderColor: Theme.border }}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
                          Recipient Phone <span className="text-pink-600">*</span>
                        </label>
                        <input
                          type="text"
                          maxLength={40}
                          value={recipientPhone}
                          onChange={(e) => setRecipientPhone(e.target.value)}
                          placeholder="e.g. 017xxxxxxxx"
                          className="w-full px-3 py-1.5 border rounded-lg text-xs outline-none focus:ring-2 focus:ring-pink-100 transition-all bg-white"
                          style={{ borderColor: Theme.border }}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
                        Delivery Address <span className="text-pink-600">*</span>
                      </label>
                      <textarea
                        rows={2}
                        maxLength={490}
                        value={recipientAddress}
                        onChange={(e) => setRecipientAddress(e.target.value)}
                        placeholder="House, Road, Area, District, Police Station"
                        className="w-full px-3 py-1.5 border rounded-lg text-xs outline-none focus:ring-2 focus:ring-pink-100 transition-all bg-white resize-none"
                        style={{ borderColor: Theme.border }}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
                          COD Amount (৳)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={codAmount !== '' ? codAmount : (lineItems.length > 0 ? parseFloat(grandTotal.toFixed(2)) : 0)}
                          onChange={(e) => setCodAmount(e.target.value === '' ? '' : Number(e.target.value))}
                          placeholder={String(grandTotal)}
                          className="w-full px-3 py-1.5 border rounded-lg text-xs font-semibold outline-none focus:ring-2 focus:ring-pink-100 transition-all bg-white"
                          style={{ borderColor: Theme.border }}
                        />
                        <span className="text-[10px] text-zinc-400 mt-0.5 block">Courier collection amount</span>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
                          Delivery Note / Instructions
                        </label>
                        <input
                          type="text"
                          maxLength={480}
                          value={deliveryNote}
                          onChange={(e) => setDeliveryNote(e.target.value)}
                          placeholder="e.g. Call before delivery"
                          className="w-full px-3 py-1.5 border rounded-lg text-xs outline-none focus:ring-2 focus:ring-pink-100 transition-all bg-white"
                          style={{ borderColor: Theme.border }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className={`flex gap-2 ${isMobile ? 'flex-col-reverse' : 'justify-end'}`}>
                <Btn
                  variant="ghost"
                  onClick={() => {
                    setSearchQuery('');
                    setShowDropdown(false);
                    setLineItems([]);
                    setIsCourierDelivery(true);
                    setRecipientName('');
                    setRecipientPhone('');
                    setRecipientAddress('');
                    setDeliveryNote('');
                    setCodAmount('');
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
                        <div>{sale.saleNumber}</div>
                        {(sale.recipientName || sale.recipientPhone) && (
                          <div className="mt-1 flex items-center gap-1 text-[10px] text-zinc-600 font-normal">
                            <Truck className="w-3 h-3 text-pink-600 flex-shrink-0" />
                            <span className="truncate max-w-[130px]">{sale.recipientName || sale.recipientPhone}</span>
                          </div>
                        )}
                        {(sale.consignmentId || sale.trackingCode) && (
                          <div className="text-[9px] font-mono text-indigo-600 font-normal">
                            CID: {sale.consignmentId || sale.trackingCode}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-2.5" style={{ color: Theme.fg }}>
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold text-xs text-zinc-900">
                            {sale.items?.[0]?.productNameSnapshot || t.sales.saleItem}
                          </span>
                          {(sale.items?.[0]?.colorName || sale.items?.[0]?.sizeName) && (
                            <div className="flex items-center gap-1 flex-wrap mt-0.5">
                              {sale.items[0]?.colorName && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                                  {t.sales?.color || 'Color'}: {sale.items[0].colorName}
                                </span>
                              )}
                              {sale.items[0]?.sizeName && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-pink-50 text-pink-700 border border-pink-200">
                                  {t.sales?.size || 'Size'}: {sale.items[0].sizeName}
                                </span>
                              )}
                            </div>
                          )}
                          {sale.items && sale.items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setViewSaleModal(sale)}
                              className="text-[10px] text-pink-600 font-bold hover:underline text-left mt-0.5"
                            >
                              +{sale.items.length - 1} {t.sales.more} ({t.sales?.viewDetails || 'View'})
                            </button>
                          )}
                        </div>
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
                        <div className="flex items-center justify-center gap-1">
                          <Btn
                            variant="ghost"
                            size="sm"
                            onClick={() => setViewSaleModal(sale)}
                            className="p-1 min-w-[28px] h-7 inline-flex items-center justify-center text-zinc-600 hover:bg-zinc-100 rounded-lg transition-all"
                            title={t.sales?.viewDetails || 'View Details'}
                          >
                            👁️
                          </Btn>
                          <Btn
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePrintReceipt(sale)}
                            className="p-1 min-w-[28px] h-7 inline-flex items-center justify-center text-primary hover:bg-primary/10 rounded-lg transition-all"
                            title={t.sales.printReceipt}
                          >
                            🖨️
                          </Btn>
                        </div>
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

      {viewSaleModal && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setViewSaleModal(null)}
        >
          <div
            className="flex max-w-full w-[650px] flex-col overflow-hidden bg-white rounded-xl shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 py-4 border-b"
              style={{ borderColor: Theme.border }}
            >
              <div>
                <h3 className="text-base font-bold text-zinc-900">
                  {t.sales?.saleDetails || 'Sale Details'}
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  #{viewSaleModal.saleNumber} · {new Date(viewSaleModal.createdAt).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setViewSaleModal(null)}
                className="p-1 rounded hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Sale Meta Info */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-zinc-50/60 border-b text-xs" style={{ borderColor: Theme.border }}>
              <div>
                <span className="text-zinc-400 block text-[10px] uppercase font-bold tracking-wider">{t.sales?.branch || 'Branch'}</span>
                <span className="font-semibold text-zinc-800">{viewSaleModal.branchName || t.sales?.main || 'Main'}</span>
              </div>
              <div>
                <span className="text-zinc-400 block text-[10px] uppercase font-bold tracking-wider">{t.sales?.by || 'Served By'}</span>
                <span className="font-semibold text-zinc-800">{viewSaleModal.soldBy || t.sales?.staff || 'Staff'}</span>
              </div>
              {viewSaleModal.note && (
                <div className="col-span-2 sm:col-span-1">
                  <span className="text-zinc-400 block text-[10px] uppercase font-bold tracking-wider">Note</span>
                  <span className="font-medium text-zinc-700 truncate block">{viewSaleModal.note}</span>
                </div>
              )}
            </div>

            {/* Courier Delivery Details */}
            {(viewSaleModal.recipientName || viewSaleModal.recipientPhone || viewSaleModal.consignmentId) && (
              <div className="p-4 bg-pink-50/40 border-b text-xs" style={{ borderColor: Theme.border }}>
                <div className="flex items-center gap-1.5 font-bold text-pink-700 text-[11px] uppercase tracking-wider mb-2">
                  <Truck className="w-3.5 h-3.5" />
                  <span>Steadfast Delivery Information</span>
                  {viewSaleModal.courierStatus && (
                    <span className="ml-auto px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-pink-100 text-pink-800 border border-pink-200">
                      {viewSaleModal.courierStatus}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <span className="text-zinc-400 block text-[10px] uppercase font-bold">Recipient</span>
                    <span className="font-semibold text-zinc-800">{viewSaleModal.recipientName || 'N/A'}</span>
                    <span className="text-zinc-500 block text-[11px]">{viewSaleModal.recipientPhone || ''}</span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block text-[10px] uppercase font-bold">Address</span>
                    <span className="font-medium text-zinc-700 block text-[11px]">{viewSaleModal.recipientAddress || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block text-[10px] uppercase font-bold">COD / Consignment</span>
                    <span className="font-bold text-zinc-900 block">৳{viewSaleModal.codAmount ?? viewSaleModal.totalAmount}</span>
                    {(viewSaleModal.consignmentId || viewSaleModal.trackingCode) && (
                      <span className="text-[10px] font-mono text-indigo-600 block mt-0.5">
                        CID: {viewSaleModal.consignmentId || viewSaleModal.trackingCode}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Items Table */}
            <div className="p-4 max-h-[50vh] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b text-zinc-400 uppercase text-[10px] font-bold" style={{ borderColor: Theme.border }}>
                    <th className="py-2">{t.sales?.product || 'Item'}</th>
                    <th className="py-2 text-center">{t.sales?.color || 'Color'}</th>
                    <th className="py-2 text-center">{t.sales?.size || 'Size'}</th>
                    <th className="py-2 text-right">{t.sales?.unitPrice || 'Price'}</th>
                    <th className="py-2 text-center">{t.sales?.qty || 'Qty'}</th>
                    <th className="py-2 text-right">{t.sales?.lineTotal || 'Total'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: Theme.border }}>
                  {(viewSaleModal.items || []).map((item: any, i: number) => (
                    <tr key={item.id || i} className="hover:bg-zinc-50/50">
                      <td className="py-2.5 pr-2">
                        <div className="font-semibold text-zinc-900">{item.productNameSnapshot}</div>
                        <div className="text-[10px] text-zinc-400">{item.productSkuSnapshot}</div>
                      </td>
                      <td className="py-2.5 text-center">
                        {item.colorName ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                            {item.colorName}
                          </span>
                        ) : (
                          <span className="text-zinc-300">—</span>
                        )}
                      </td>
                      <td className="py-2.5 text-center">
                        {item.sizeName ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-pink-50 text-pink-700 border border-pink-200">
                            {item.sizeName}
                          </span>
                        ) : (
                          <span className="text-zinc-300">—</span>
                        )}
                      </td>
                      <td className="py-2.5 text-right font-medium text-zinc-700">
                        {formatCurrency(item.unitPrice)}
                      </td>
                      <td className="py-2.5 text-center font-bold text-zinc-800">
                        {item.quantity}
                      </td>
                      <td className="py-2.5 text-right font-bold" style={{ color: Theme.primary }}>
                        {formatCurrency(item.lineTotal || (item.quantity * item.unitPrice))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer / Summary */}
            <div
              className="flex items-center justify-between px-5 py-3.5 bg-zinc-50 border-t"
              style={{ borderColor: Theme.border }}
            >
              <div className="flex items-center gap-4 text-xs font-semibold text-zinc-600">
                <span>{t.sales?.totalQty || 'Total Qty'}: <strong className="text-zinc-900">{viewSaleModal.totalQty}</strong></span>
                <span>{t.sales?.grandTotal || 'Grand Total'}: <strong className="text-pink-600 text-sm font-bold">{formatCurrency(viewSaleModal.totalAmount)}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <Btn
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewSaleModal(null)}
                >
                  {t.sales?.close || 'Close'}
                </Btn>
                <Btn
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    handlePrintReceipt(viewSaleModal);
                  }}
                  className="flex items-center gap-1.5"
                >
                  🖨️ {t.sales?.printReceipt || 'Print Receipt'}
                </Btn>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
