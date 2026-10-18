'use client';

import React, { useState } from 'react';
import { Theme, formatCurrency } from '@/modules/dashboard/utils/theme';
import { useResponsive } from '@/shared/hooks/useResponsive';
import { Btn } from '@/shared/components/ui/Primitives';
import type { Product } from '@/modules/dashboard/types';
import { useDashboardLocale } from '../locales/DashboardLocaleContext';

interface ManualSaleModalProps {
  products: Product[];
  onClose: () => void;
  onConfirm: (
    product: Product,
    qty: number,
    note: string,
    total: number,
    variant?: { colorName?: string; sizeName?: string }
  ) => void;
}

export default function ManualSaleModal({ products, onClose, onConfirm }: ManualSaleModalProps) {
  const { isMobile } = useResponsive();
  const { t } = useDashboardLocale();
  const [selectedProductId, setSelectedProductId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedColorName, setSelectedColorName] = useState('');
  const [selectedSizeName, setSelectedSizeName] = useState('');
  const [qty, setQty] = useState(1);
  const [salePrice, setSalePrice] = useState(0);
  const [lastSale, setLastSale] = useState<string | null>(null);

  const selectedProduct = products.find((p) => p.id === Number(selectedProductId));
  const colors = (selectedProduct?.colors || []).filter((c: any) => c.isActive !== false);
  const standaloneSizes = (selectedProduct?.sizes || []).filter((s: any) => s.isActive !== false);
  const matchedColor = colors.find((c: any) => c.name === selectedColorName) || null;
  const availableSizes = matchedColor && matchedColor.sizes && matchedColor.sizes.length > 0
    ? matchedColor.sizes.filter((s: any) => s.isActive !== false)
    : standaloneSizes;
  const matchedSize = availableSizes.find((s: any) => s.name === selectedSizeName) || null;

  let variantStock = selectedProduct?.stock || 0;
  if (matchedSize && matchedSize.quantity !== undefined) {
    variantStock = Number(matchedSize.quantity);
  } else if (matchedColor && matchedColor.quantity !== undefined) {
    variantStock = Number(matchedColor.quantity);
  }

  const defaultPrice =
    matchedSize && matchedSize.priceOverride !== null && matchedSize.priceOverride !== undefined && Number(matchedSize.priceOverride) > 0
      ? Number(matchedSize.priceOverride)
      : matchedColor && matchedColor.priceOverride !== null && matchedColor.priceOverride !== undefined && Number(matchedColor.priceOverride) > 0
        ? Number(matchedColor.priceOverride)
        : (selectedProduct?.price || 0);

  const basePrice = salePrice > 0 ? salePrice : defaultPrice;
  const total = basePrice * qty;
  const overStock = selectedProduct && qty > variantStock;

  const filteredProducts = products.filter((p) =>
    p.stock > 0 && (p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.sku.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const inp: React.CSSProperties = {
    border: `1px solid ${Theme.border}`,
    fontSize: 13,
    color: Theme.fg,
    outline: 'none',
    boxSizing: 'border-box',
  };

  const lbl: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: Theme.fg,
  };

  const handleSelectProduct = (product: Product) => {
    setSelectedProductId(String(product.id));
    setSearchQuery(product.name);
    setShowDropdown(false);
    setQty(1);
    setSalePrice(0);

    const pColors = (product.colors || []).filter((c: any) => c.isActive !== false);
    const pStandaloneSizes = (product.sizes || []).filter((s: any) => s.isActive !== false);

    let defaultColor = '';
    let availSizes: any[] = [];
    if (pColors.length > 0) {
      const availColor = pColors.find((c: any) => {
        if (c.sizes && c.sizes.length > 0) return c.sizes.some((s: any) => (s.quantity ?? 0) > 0);
        return (c.quantity ?? 0) > 0;
      }) || pColors[0];
      defaultColor = availColor?.name || '';
      availSizes = (availColor?.sizes || []).filter((s: any) => s.isActive !== false);
    } else if (pStandaloneSizes.length > 0) {
      availSizes = pStandaloneSizes;
    }

    let defaultSize = '';
    if (availSizes.length > 0) {
      const availSize = availSizes.find((s: any) => (s.quantity ?? 0) > 0) || availSizes[0];
      defaultSize = availSize?.name || '';
    }

    setSelectedColorName(defaultColor);
    setSelectedSizeName(defaultSize);
  };

  const handleConfirm = () => {
    if (selectedProduct && qty > 0 && !overStock) {
      onConfirm(selectedProduct, qty, '', total, {
        colorName: selectedColorName || undefined,
        sizeName: selectedSizeName || undefined,
      });
      const variantDesc = [selectedColorName, selectedSizeName].filter(Boolean).join(' / ');
      setLastSale(`✓ ${t.sold} ${qty} × ${selectedProduct.name}${variantDesc ? ` (${variantDesc})` : ''}`);
      setSelectedProductId('');
      setSearchQuery('');
      setSelectedColorName('');
      setSelectedSizeName('');
      setSalePrice(0);
      setQty(1);
      setTimeout(() => setLastSale(null), 3000);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-[9999] flex justify-center bg-black/50 ${isMobile ? 'items-end p-0' : 'items-center p-4'}`}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`flex max-w-full flex-col overflow-hidden bg-white shadow-[0_20px_50px_rgba(0,0,0,0.15)] ${isMobile ? 'w-full rounded-t-[20px] rounded-b-none' : 'w-[680px] rounded-xl'}`}
      >
        {isMobile && (
          <div
            className="mx-auto mt-2 h-1 w-10 rounded-sm"
            style={{ background: Theme.border }}
          />
        )}

        {/* Header */}
        <div
          className="flex shrink-0 items-center justify-between px-4 py-3"
          style={{ borderBottom: `1px solid ${Theme.border}` }}
        >
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: Theme.fg }}>
              {t.modal.recordSale}
            </div>
          </div>
          <button
            onClick={onClose}
            className="cursor-pointer border-0 bg-transparent p-0 text-[20px] leading-none"
            style={{ color: Theme.mutedFg }}
          >
            ✕
          </button>
        </div>

        {/* Last Sale Notification */}
        {lastSale && (
          <div
            className="border-b border-[#bbf7d0] bg-[#f0fdf4] px-4 py-2 text-[11px] font-semibold text-[#166534]"
          >
            {lastSale}
          </div>
        )}

        {/* Form */}
        <div className="flex flex-col gap-[10px] px-4 py-3">
          {/* Product Selection with Search */}
          <div className="relative">
            <label className="mb-1 block" style={lbl}>{t.modal.product} *</label>
            <div className="relative">
              <input
                type="text"
                placeholder={t.modal.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                className={`box-border w-full rounded-md py-2 ${selectedProductId ? 'pr-9 pl-3' : 'px-3'}`}
                style={{
                  ...inp,
                  background: selectedProductId ? '#f9fafb' : '#fff',
                }}
              />
              {selectedProductId && (
                <button
                  onClick={() => {
                    setSelectedProductId('');
                    setSearchQuery('');
                    setShowDropdown(false);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer border-0 bg-transparent px-2 py-1 text-base"
                  style={{ color: Theme.mutedFg }}
                >
                  ✕
                </button>
              )}
              {showDropdown && (
                <div
                  className="absolute left-0 right-0 top-full z-10 max-h-60 overflow-y-auto rounded-b-md border border-t-0 bg-white shadow-[0_4px_12px_rgba(0,0,0,0.1)]"
                  style={{ borderColor: Theme.border }}
                >
                  {filteredProducts.length > 0 ? (
                    filteredProducts.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => handleSelectProduct(p)}
                        className="flex w-full cursor-pointer items-center justify-between border-0 border-b px-3 py-2 text-left text-xs"
                        style={{
                          background: selectedProductId === String(p.id) ? Theme.muted : 'transparent',
                          color: Theme.fg,
                          borderBottom: `1px solid ${Theme.border}`,
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600 }}>{p.name}</div>
                          <div style={{ fontSize: 10, color: Theme.mutedFg }}>{t.modal.sku}: {p.sku}</div>
                        </div>
                        <div className="ml-2 text-[11px]" style={{ color: Theme.mutedFg }}>
                          {p.stock} {t.modal.inStock}
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-3 text-center text-xs" style={{ color: Theme.mutedFg }}>
                      {t.modal.noProductsFound}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Color & Size Variant Selectors if available */}
          {selectedProduct && (colors.length > 0 || standaloneSizes.length > 0) && (
            <div className="flex flex-col gap-2 rounded-lg border p-2.5" style={{ borderColor: Theme.border, background: '#fafafa' }}>
              {/* Color selection */}
              {colors.length > 0 && (
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label style={lbl}>{t.modal.color} *</label>
                    <span className="text-[11px]" style={{ color: Theme.mutedFg }}>
                      {selectedColorName ? `${t.modal.color}: ${selectedColorName}` : ''}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {colors.map((c: any) => {
                      const isSelected = selectedColorName === c.name;
                      const cSizes = (c.sizes || []).filter((s: any) => s.isActive !== false);
                      const cStock = cSizes.length > 0
                        ? cSizes.reduce((sum: number, s: any) => sum + (Number(s.quantity) || 0), 0)
                        : Number(c.quantity) || 0;
                      return (
                        <button
                          key={c.id || c.name}
                          type="button"
                          onClick={() => {
                            setSelectedColorName(c.name);
                            if (cSizes.length > 0) {
                              const avail = cSizes.find((s: any) => (s.quantity ?? 0) > 0) || cSizes[0];
                              setSelectedSizeName(avail?.name || '');
                            } else {
                              setSelectedSizeName('');
                            }
                            setQty(1);
                            setSalePrice(0);
                          }}
                          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                            isSelected
                              ? 'border-2 shadow-sm'
                              : 'border bg-white text-gray-700 hover:bg-gray-50'
                          }`}
                          style={{
                            borderColor: isSelected ? Theme.primary : Theme.border,
                            color: isSelected ? Theme.primary : Theme.fg,
                            backgroundColor: isSelected ? '#f0fdf4' : '#fff',
                          }}
                        >
                          <span
                            className="inline-block h-3.5 w-3.5 rounded-full border border-black/10 shrink-0"
                            style={{ backgroundColor: c.hexCode || '#ccc' }}
                          />
                          <span>{c.name}</span>
                          <span className="text-[10px] opacity-75">({cStock})</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Size selection */}
              {availableSizes.length > 0 && (
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label style={lbl}>{t.modal.size} *</label>
                    <span className="text-[11px]" style={{ color: Theme.mutedFg }}>
                      {selectedSizeName ? `${t.modal.size}: ${selectedSizeName}` : ''}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {availableSizes.map((s: any) => {
                      const isSelected = selectedSizeName === s.name;
                      const sStock = Number(s.quantity) || 0;
                      const hasStock = sStock > 0;
                      const sizePrice = s.priceOverride !== null && s.priceOverride !== undefined && Number(s.priceOverride) > 0
                        ? Number(s.priceOverride)
                        : null;

                      return (
                        <button
                          key={s.id || s.name}
                          type="button"
                          disabled={!hasStock}
                          onClick={() => {
                            setSelectedSizeName(s.name);
                            setQty(1);
                            setSalePrice(0);
                          }}
                          className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
                            isSelected
                              ? 'border-2 shadow-sm'
                              : hasStock
                              ? 'border bg-white text-gray-700 hover:bg-gray-50'
                              : 'border border-dashed bg-gray-100 text-gray-400 opacity-60 cursor-not-allowed'
                          }`}
                          style={{
                            borderColor: isSelected ? Theme.primary : Theme.border,
                            color: isSelected ? Theme.primary : hasStock ? Theme.fg : Theme.mutedFg,
                            backgroundColor: isSelected ? '#f0fdf4' : hasStock ? '#fff' : '#f3f4f6',
                          }}
                        >
                          <span>{s.name}</span>
                          <span className="text-[10px] opacity-75">({sStock})</span>
                          {sizePrice !== null && (
                            <span className="ml-0.5 text-[9px] font-normal text-emerald-600">
                              ৳{sizePrice}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Quantity & Price - Stacked Layout */}
          <div className="flex flex-col gap-[10px]">
            {/* Quantity */}
            <div>
              <label className="mb-1 block" style={lbl}>{t.modal.quantity} *</label>
              <div className="flex items-center gap-1.5">
                <button
                  disabled={!selectedProduct || qty <= 1}
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className={`h-8 w-8 shrink-0 rounded-md border text-base ${selectedProduct && qty > 1 ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                  style={{
                    borderColor: Theme.border,
                    background: selectedProduct && qty > 1 ? Theme.muted : '#e5e7eb',
                    opacity: selectedProduct && qty > 1 ? 1 : 0.5,
                  }}
                >
                  −
                </button>
                <input
                  type="number"
                  min={1}
                  max={variantStock || 1}
                  value={qty}
                  disabled={!selectedProduct || variantStock <= 0}
                  onChange={(e) => setQty(Math.max(1, Math.min(variantStock || 999999, Number(e.target.value))))}
                  className="box-border w-[60px] rounded-md px-3 py-2 text-center"
                  style={{
                    ...inp,
                    textAlign: 'center',
                    WebkitAppearance: 'none',
                    MozAppearance: 'textfield',
                    background: '#fff',
                  }}
                />
                <button
                  disabled={!selectedProduct || qty >= variantStock}
                  onClick={() =>
                    selectedProduct && setQty((q) => Math.min(variantStock, q + 1))
                  }
                  className={`h-8 w-8 shrink-0 rounded-md border text-base ${selectedProduct && qty < variantStock ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                  style={{
                    borderColor: Theme.border,
                    background: selectedProduct && qty < variantStock ? Theme.muted : '#e5e7eb',
                    opacity: selectedProduct && qty < variantStock ? 1 : 0.5,
                  }}
                >
                  +
                </button>
                <span className="text-[11px]" style={{ color: Theme.mutedFg }}>
                  {selectedProduct ? `${t.modal.max}: ${variantStock}` : ''}
                </span>
              </div>
            </div>

            {/* Sale Price */}
            <div>
              <label className="mb-1 block" style={lbl}>{t.modal.salePrice}</label>
              <input
                type="number"
                disabled={!selectedProduct}
                value={salePrice > 0 ? salePrice : ''}
                onChange={(e) => setSalePrice(Number(e.target.value) || 0)}
                placeholder={selectedProduct ? String(defaultPrice) : '0'}
                className="box-border w-full rounded-md px-3 py-2"
                style={{ ...inp, background: '#fff', opacity: selectedProduct ? 1 : 0.5 }}
              />
              <div className="mt-0.5 text-[9px]" style={{ color: Theme.mutedFg }}>
                {salePrice > 0 ? `✎ ${t.modal.customPrice}` : selectedProduct ? t.modal.defaultPrice : '—'}
              </div>
            </div>
          </div>

          {/* Summary */}
          <div
            className="mt-1 rounded-lg px-3 py-2.5"
            style={{
              background: Theme.muted,
              borderLeft: `3px solid ${selectedProduct ? Theme.primary : Theme.border}`,
              opacity: selectedProduct ? 1 : 0.5,
            }}
          >
            {selectedProduct && (selectedColorName || selectedSizeName) && (
              <div className="mb-1 flex justify-between text-[11px]" style={{ color: Theme.mutedFg }}>
                <span>{t.sales?.variant || 'Variant'}</span>
                <span style={{ fontWeight: 600, color: Theme.fg }}>
                  {[selectedColorName, selectedSizeName].filter(Boolean).join(' / ')}
                </span>
              </div>
            )}
            <div className="mb-1 flex justify-between text-[11px]" style={{ color: Theme.mutedFg }}>
              <span>{t.modal.unitPrice}</span>
              <span style={{ fontWeight: 600, color: Theme.fg }}>
                {selectedProduct ? formatCurrency(basePrice) : '—'}
              </span>
            </div>
            <div className="mb-1 flex justify-between text-[11px]" style={{ color: Theme.mutedFg }}>
              <span>{t.modal.quantity}</span>
              <span style={{ fontWeight: 600, color: Theme.fg }}>
                {selectedProduct ? qty : '—'}
              </span>
            </div>
            <div className="my-1.5 h-px" style={{ background: Theme.border }} />
            <div className="flex justify-between text-sm font-bold">
              <span>{t.modal.total}</span>
              <span style={{ color: Theme.primary }}>
                {selectedProduct ? formatCurrency(total) : '—'}
              </span>
            </div>
          </div>

          {selectedProduct && variantStock <= 0 && (
            <div className="rounded-md bg-[#fee2e2] px-[10px] py-1.5 text-[11px] font-semibold text-[#991b1b]">
              ⚠ {t.modal.outOfStock || 'Out of stock for this variant'}
            </div>
          )}
          {selectedProduct && variantStock > 0 && overStock && (
            <div className="rounded-md bg-[#fee2e2] px-[10px] py-1.5 text-[11px] font-semibold text-[#991b1b]">
              ⚠ {t.modal.maxWarning}: {variantStock}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex shrink-0 justify-end gap-2 bg-[#fafafa] px-4 py-2.5"
          style={{ borderTop: `1px solid ${Theme.border}` }}
        >
          <Btn variant="ghost" onClick={onClose}>
            {t.modal.close}
          </Btn>
          <Btn
            variant="primary"
            disabled={!selectedProduct || qty < 1 || overStock || variantStock <= 0}
            onClick={handleConfirm}
          >
            {t.modal.record} ({formatCurrency(total)})
          </Btn>
        </div>
      </div>
    </div>
  );
}
