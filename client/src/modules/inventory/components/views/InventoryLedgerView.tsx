'use client';

import React, { useState, useMemo } from 'react';
import { Theme } from '@/modules/dashboard/utils/theme';
import { Card, Btn } from '@/shared/components/ui/Primitives';
import { useResponsive } from '@/shared/hooks/useResponsive';
import {
  useInventoryLedger,
  inventoryAPI,
  type InventoryLedgerParams,
  type InventoryLedgerEntry,
  type InventoryLedgerResponse,
} from '@/modules/inventory';
import { useListBranches } from '@/modules/branches';
import { useDashboardLocale } from '@/modules/dashboard/locales/DashboardLocaleContext';
import toast from 'react-hot-toast';

interface InventoryLedgerViewProps {
  initialBranchId?: string;
  initialSearchQuery?: string;
}

export default function InventoryLedgerView({ initialBranchId, initialSearchQuery }: InventoryLedgerViewProps) {
  const { isMobile } = useResponsive();
  const { t } = useDashboardLocale();
  const { data: branches = [] } = useListBranches();
  const activeBranches = branches.filter((b) => b.active);

  const [selectedBranch, setSelectedBranch] = useState(initialBranchId || '');
  const [selectedType, setSelectedType] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>(initialSearchQuery || '');
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(20);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  React.useEffect(() => {
    if (initialBranchId !== undefined) {
      setSelectedBranch(initialBranchId);
      setPage(1);
    }
  }, [initialBranchId]);

  React.useEffect(() => {
    if (initialSearchQuery !== undefined) {
      setSearchQuery(initialSearchQuery);
      setPage(1);
    }
  }, [initialSearchQuery]);

  // Debounced or live search parameters
  const queryParams: InventoryLedgerParams = useMemo(
    () => ({
      page,
      limit,
      ...(selectedBranch ? { warehouseId: Number(selectedBranch) } : {}),
      ...(selectedType ? { type: selectedType } : {}),
      ...(startDate ? { startDate } : {}),
      ...(endDate ? { endDate } : {}),
      ...(searchQuery.trim() ? { search: searchQuery.trim() } : {}),
    }),
    [page, limit, selectedBranch, selectedType, startDate, endDate, searchQuery]
  );

  const { data: ledgerResponse, isLoading, isFetching, refetch } = useInventoryLedger(queryParams) as {
    data?: InventoryLedgerResponse;
    isLoading: boolean;
    isFetching: boolean;
    refetch: () => void;
  };

  const ledgerData = ledgerResponse?.data || [];
  const summary = ledgerResponse?.summary || {
    totalIn: 0,
    totalOut: 0,
    netChange: 0,
    totalTransactions: 0,
  };
  const meta = ledgerResponse?.meta || {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  };

  const handleResetFilters = () => {
    setSelectedBranch('');
    setSelectedType('');
    setStartDate('');
    setEndDate('');
    setSearchQuery('');
    setPage(1);
  };

  const hasActiveFilters = Boolean(
    selectedBranch || selectedType || startDate || endDate || searchQuery.trim()
  );

  const applyDatePreset = (preset: 'today' | 'yesterday' | 'week' | 'month' | 'all') => {
    if (preset === 'all') {
      setStartDate('');
      setEndDate('');
      setPage(1);
      return;
    }
    const today = new Date();
    const formatYMD = (d: Date) => d.toISOString().split('T')[0];

    if (preset === 'today') {
      const s = formatYMD(today);
      setStartDate(s);
      setEndDate(s);
    } else if (preset === 'yesterday') {
      const y = new Date(today);
      y.setDate(today.getDate() - 1);
      const s = formatYMD(y);
      setStartDate(s);
      setEndDate(s);
    } else if (preset === 'week') {
      const w = new Date(today);
      w.setDate(today.getDate() - 7);
      setStartDate(formatYMD(w));
      setEndDate(formatYMD(today));
    } else if (preset === 'month') {
      const m = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(formatYMD(m));
      setEndDate(formatYMD(today));
    }
    setPage(1);
  };

  // Full Export to CSV
  const handleExportCSV = async () => {
    if (isExporting) return;
    try {
      setIsExporting(true);
      const res = await inventoryAPI.getInventoryLedger({
        ...queryParams,
        page: 1,
        limit: 5000,
      });

      const records = res?.data || ledgerData;
      if (!records || records.length === 0) {
        toast.error('No ledger records found to export');
        return;
      }

      const headers = [
        'Date & Time',
        'Reference #',
        'Product Name',
        'SKU',
        'Size',
        'Branch',
        'Movement Type',
        'Qty Change',
        'Balance Before',
        'Balance After',
        'Changed By',
      ];

      const rows = records.map((item: InventoryLedgerEntry) => [
        `"${new Date(item.createdAt).toLocaleString().replace(/"/g, '""')}"`,
        `"${(item.reference || '').replace(/"/g, '""')}"`,
        `"${(item.productName || '').replace(/"/g, '""')}"`,
        `"${(item.productSku || '').replace(/"/g, '""')}"`,
        `"${(item.sizeName || '-').replace(/"/g, '""')}"`,
        `"${(item.branchName || '').replace(/"/g, '""')}"`,
        `"${item.type}"`,
        item.quantity,
        item.balanceBefore,
        item.balanceAfter,
        `"${(item.performedBy || 'Staff').replace(/"/g, '""')}"`,
      ]);

      const csvContent =
        'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r: (string | number)[]) => r.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `inventory_ledger_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success(`Exported ${records.length} transactions`);
    } catch {
      toast.error('Failed to export ledger CSV');
    } finally {
      setIsExporting(false);
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'PURCHASE':
        return (
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            📦 {t.inventory.typePurchase}
          </span>
        );
      case 'SALE':
        return (
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            🛒 {t.inventory.typeSale}
          </span>
        );
      case 'POS_SALE':
        return (
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            🏪 {t.inventory.typePosSale}
          </span>
        );
      case 'RETURN':
        return (
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-cyan-50 text-cyan-700 border border-cyan-200">
            ↩️ {t.inventory.typeReturn}
          </span>
        );
      case 'ADJUSTMENT':
        return (
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            ⚙️ {t.inventory.typeAdjustment}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-gray-50 text-gray-700 border border-gray-200">
            {type}
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* KPI Cards: Inflow, Outflow, Net, Total Transactions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total In */}
        <div className="rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50/70 to-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
              {t.inventory.ledgerInflow}
            </span>
            <span className="text-base">📥</span>
          </div>
          <div className="mt-2 text-2xl font-black tracking-tight text-emerald-700">
            +{summary.totalIn.toLocaleString()}{' '}
            <span className="text-xs font-normal text-emerald-600/80">{t.inventory.units}</span>
          </div>
          <div className="mt-1 text-[11px] text-emerald-600/70">
            Stock received / Purchases / Returns
          </div>
        </div>

        {/* Total Out */}
        <div className="rounded-xl border border-rose-100 bg-gradient-to-br from-rose-50/70 to-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-rose-800">
              {t.inventory.ledgerOutflow}
            </span>
            <span className="text-base">📤</span>
          </div>
          <div className="mt-2 text-2xl font-black tracking-tight text-rose-700">
            -{summary.totalOut.toLocaleString()}{' '}
            <span className="text-xs font-normal text-rose-600/80">{t.inventory.units}</span>
          </div>
          <div className="mt-1 text-[11px] text-rose-600/70">
            Sales / Deductions / Dispatches
          </div>
        </div>

        {/* Net Movement */}
        <div
          className={`rounded-xl border p-4 shadow-xs bg-gradient-to-br to-white ${
            summary.netChange >= 0
              ? 'border-blue-100 from-blue-50/70 text-blue-900'
              : 'border-amber-100 from-amber-50/70 text-amber-900'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t.inventory.ledgerNet}
            </span>
            <span className="text-base">{summary.netChange >= 0 ? '📈' : '📉'}</span>
          </div>
          <div
            className={`mt-2 text-2xl font-black tracking-tight ${
              summary.netChange >= 0 ? 'text-blue-700' : 'text-amber-700'
            }`}
          >
            {summary.netChange > 0 ? `+${summary.netChange.toLocaleString()}` : summary.netChange.toLocaleString()}{' '}
            <span className="text-xs font-normal text-muted-foreground">{t.inventory.units}</span>
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            Net overall inventory balance delta
          </div>
        </div>

        {/* Total Transactions */}
        <div className="rounded-xl border border-gray-100 bg-gradient-to-br from-gray-50/80 to-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t.inventory.ledgerTransactions}
            </span>
            <span className="text-base">📑</span>
          </div>
          <div className="mt-2 text-2xl font-black tracking-tight text-foreground">
            {summary.totalTransactions.toLocaleString()}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            Audit logs matching active filters
          </div>
        </div>
      </div>

      <Card>
        {/* Filter Toolbar */}
        <div className="mb-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[220px]">
              <input
                type="text"
                placeholder={t.inventory.ledgerSearchPlaceholder}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none pl-9"
                style={{ borderColor: Theme.border, color: Theme.fg }}
              />
              <span className="absolute left-3 top-2.5 text-gray-400 text-sm">🔍</span>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2 text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Branch Filter */}
            <select
              value={selectedBranch}
              onChange={(e) => {
                setSelectedBranch(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border px-3 py-2 text-xs font-medium outline-none bg-white"
              style={{ borderColor: Theme.border, color: Theme.fg }}
            >
              <option value="">{t.inventory.allBranches}</option>
              {activeBranches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>

            {/* Movement Type Dropdown */}
            <select
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border px-3 py-2 text-xs font-medium outline-none bg-white"
              style={{ borderColor: Theme.border, color: Theme.fg }}
            >
              <option value="">{t.inventory.allTypes}</option>
              <option value="PURCHASE">📦 {t.inventory.typePurchase}</option>
              <option value="SALE">🛒 {t.inventory.typeSale}</option>
              <option value="POS_SALE">🏪 {t.inventory.typePosSale}</option>
              <option value="RETURN">↩️ {t.inventory.typeReturn}</option>
              <option value="ADJUSTMENT">⚙️ {t.inventory.typeAdjustment}</option>
            </select>

            {/* Date Filters */}
            <div className="flex items-center gap-1.5 text-xs bg-gray-50 border rounded-lg px-2 py-1" style={{ borderColor: Theme.border }}>
              <span className="text-gray-500 font-medium">📅</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="bg-transparent border-none text-xs outline-none text-gray-700"
                title="Start Date"
              />
              <span className="text-gray-400">➔</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="bg-transparent border-none text-xs outline-none text-gray-700"
                title="End Date"
              />
              {(startDate || endDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                    setPage(1);
                  }}
                  className="text-gray-400 hover:text-gray-600 font-bold ml-1 cursor-pointer"
                  title="Clear dates"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Reset Filters */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="rounded-lg border border-dashed border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                🔄 {t.sales.reset}
              </button>
            )}

            {/* Export CSV Button */}
            <Btn
              variant="secondary"
              size="sm"
              onClick={handleExportCSV}
              disabled={ledgerData.length === 0 || isExporting}
              className="ml-auto"
            >
              <span>{isExporting ? '⏳' : '📥'}</span>
              <span>{isExporting ? t.inventory.exporting : t.inventory.exportCsv}</span>
            </Btn>

            {/* Refetch button */}
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="p-2 rounded-lg border hover:bg-gray-50 transition-colors cursor-pointer text-gray-600 disabled:opacity-50"
              style={{ borderColor: Theme.border }}
              title="Refresh ledger"
            >
              <span className={`inline-block ${isFetching ? 'animate-spin' : ''}`}>🔄</span>
            </button>
          </div>

          {/* Quick Filter Pills Row */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-gray-100">
            {/* Quick Type Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: '', label: t.inventory.allTypes },
                { id: 'PURCHASE', label: `📦 ${t.inventory.typePurchase}` },
                { id: 'SALE', label: `🛒 ${t.inventory.typeSale}` },
                { id: 'POS_SALE', label: `🏪 ${t.inventory.typePosSale}` },
                { id: 'RETURN', label: `↩️ ${t.inventory.typeReturn}` },
                { id: 'ADJUSTMENT', label: `⚙️ ${t.inventory.typeAdjustment}` },
              ].map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => {
                    setSelectedType(pill.id);
                    setPage(1);
                  }}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all cursor-pointer border ${
                    selectedType === pill.id
                      ? 'bg-foreground text-background border-foreground shadow-xs'
                      : 'bg-white text-muted-foreground border-border hover:bg-gray-50'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            {/* Quick Date Presets */}
            <div className="flex items-center gap-1 text-[11px]">
              <span className="text-gray-400 font-medium">📅</span>
              <button
                type="button"
                onClick={() => applyDatePreset('today')}
                className="px-2 py-0.5 rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 cursor-pointer font-medium transition-colors"
              >
                {t.inventory.today}
              </button>
              <button
                type="button"
                onClick={() => applyDatePreset('yesterday')}
                className="px-2 py-0.5 rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 cursor-pointer font-medium transition-colors"
              >
                {t.inventory.yesterday}
              </button>
              <button
                type="button"
                onClick={() => applyDatePreset('week')}
                className="px-2 py-0.5 rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 cursor-pointer font-medium transition-colors"
              >
                {t.inventory.last7Days}
              </button>
              <button
                type="button"
                onClick={() => applyDatePreset('month')}
                className="px-2 py-0.5 rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 cursor-pointer font-medium transition-colors"
              >
                {t.inventory.thisMonth}
              </button>
            </div>
          </div>
        </div>

        {/* Ledger Table */}
        {isLoading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3">
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
            <div className="text-xs text-muted-foreground animate-pulse">Loading stock ledger transactions...</div>
          </div>
        ) : ledgerData.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center">
            <div className="text-3xl mb-2">📋</div>
            <div className="text-sm font-semibold text-foreground">
              {t.inventory.noLedgerRecords}
            </div>
            <div className="text-xs text-muted-foreground mt-1 max-w-sm">
              No transactions have been recorded under the current filter selection. Try selecting another branch, date range, or reset your search.
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="mt-3 text-xs font-semibold text-primary underline cursor-pointer"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: Theme.muted }}>
                  <th
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: Theme.mutedFg,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      padding: '10px 12px',
                      textAlign: 'left',
                      borderBottom: `1px solid ${Theme.border}`,
                      width: '14%',
                    }}
                  >
                    Date & Time
                  </th>
                  <th
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: Theme.mutedFg,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      padding: '10px 12px',
                      textAlign: 'left',
                      borderBottom: `1px solid ${Theme.border}`,
                      width: '15%',
                    }}
                  >
                    {t.inventory.refOrder}
                  </th>
                  <th
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: Theme.mutedFg,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      padding: '10px 12px',
                      textAlign: 'left',
                      borderBottom: `1px solid ${Theme.border}`,
                      width: '22%',
                    }}
                  >
                    {t.inventory.product}
                  </th>
                  <th
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: Theme.mutedFg,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      padding: '10px 12px',
                      textAlign: 'center',
                      borderBottom: `1px solid ${Theme.border}`,
                      width: '8%',
                    }}
                  >
                    {t.inventory.size}
                  </th>
                  <th
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: Theme.mutedFg,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      padding: '10px 12px',
                      textAlign: 'left',
                      borderBottom: `1px solid ${Theme.border}`,
                      width: '11%',
                    }}
                  >
                    {t.sales.branch}
                  </th>
                  <th
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: Theme.mutedFg,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      padding: '10px 12px',
                      textAlign: 'left',
                      borderBottom: `1px solid ${Theme.border}`,
                      width: '14%',
                    }}
                  >
                    {t.inventory.movement}
                  </th>
                  <th
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: Theme.mutedFg,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      padding: '10px 12px',
                      textAlign: 'right',
                      borderBottom: `1px solid ${Theme.border}`,
                      width: '8%',
                    }}
                  >
                    Qty Change
                  </th>
                  <th
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: Theme.mutedFg,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      padding: '10px 12px',
                      textAlign: 'right',
                      borderBottom: `1px solid ${Theme.border}`,
                      width: '10%',
                    }}
                  >
                    {t.inventory.balanceChange}
                  </th>
                  <th
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: Theme.mutedFg,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      padding: '10px 12px',
                      textAlign: 'left',
                      borderBottom: `1px solid ${Theme.border}`,
                      width: '14%',
                    }}
                  >
                    {t.inventory.changedBy}
                  </th>
                </tr>
              </thead>
              <tbody>
                {ledgerData.map((item: InventoryLedgerEntry) => {
                  const isPositive = item.quantity > 0;
                  const isNegative = item.quantity < 0;

                  return (
                    <tr
                      key={item.id}
                      style={{ borderBottom: `1px solid ${Theme.border}` }}
                      className="hover:bg-gray-50/60 transition-colors"
                    >
                      {/* Date & Time */}
                      <td
                        style={{
                          padding: '12px 12px',
                          verticalAlign: 'middle',
                          fontSize: '12px',
                          color: Theme.fg,
                        }}
                      >
                        <div className="font-semibold">
                          {new Date(item.createdAt).toLocaleDateString(undefined, {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                        <div className="text-[11px] text-muted-foreground font-mono">
                          {new Date(item.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </td>

                      {/* Reference # */}
                      <td
                        style={{
                          padding: '12px 12px',
                          verticalAlign: 'middle',
                        }}
                      >
                        <span className="inline-block font-mono text-[11px] font-semibold text-gray-800 bg-gray-100/90 border border-gray-200/80 px-2 py-0.5 rounded">
                          {item.reference || `#TX-${item.id}`}
                        </span>
                      </td>

                      {/* Product Name & SKU */}
                      <td
                        style={{
                          padding: '12px 12px',
                          verticalAlign: 'middle',
                        }}
                      >
                        <div
                          className="font-semibold text-[13px] text-foreground hover:text-primary cursor-pointer transition-colors"
                          title={t.inventory.filterByProduct}
                          onClick={() => {
                            setSearchQuery(item.productSku || item.productName);
                            setPage(1);
                          }}
                        >
                          {item.productName}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-muted-foreground">
                          <button
                            type="button"
                            title={t.inventory.filterByProduct}
                            onClick={() => {
                              setSearchQuery(item.productSku);
                              setPage(1);
                            }}
                            className="font-mono bg-gray-50 px-1 rounded border border-gray-200 text-[10px] hover:bg-gray-100 cursor-pointer"
                          >
                            {item.productSku}
                          </button>
                          {item.unitLabel && (
                            <span className="text-gray-400">· {item.unitLabel}</span>
                          )}
                        </div>
                      </td>

                      {/* Size */}
                      <td
                        style={{
                          padding: '12px 12px',
                          verticalAlign: 'middle',
                          textAlign: 'center',
                        }}
                      >
                        {item.sizeName ? (
                          <button
                            type="button"
                            title={`${t.inventory.filterBySize}: ${item.sizeName}`}
                            onClick={() => {
                              setSearchQuery(item.sizeName!);
                              setPage(1);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold text-[11px] bg-pink-50 text-pink-700 border border-pink-200 shadow-2xs hover:bg-pink-100 transition-colors cursor-pointer"
                          >
                            {item.sizeName}
                          </button>
                        ) : (
                          <span className="text-gray-300 text-xs font-mono">-</span>
                        )}
                      </td>

                      {/* Branch */}
                      <td
                        style={{
                          padding: '12px 12px',
                          verticalAlign: 'middle',
                          fontSize: '12px',
                          color: Theme.fg,
                        }}
                      >
                        <span className="inline-flex items-center gap-1 text-[12px] font-medium text-gray-700 bg-gray-50 px-2 py-0.5 rounded border border-gray-200/70">
                          🏢 {item.branchName}
                        </span>
                      </td>

                      {/* Movement Type */}
                      <td
                        style={{
                          padding: '12px 12px',
                          verticalAlign: 'middle',
                        }}
                      >
                        {getTypeBadge(item.type)}
                      </td>

                      {/* Quantity Delta */}
                      <td
                        style={{
                          padding: '12px 12px',
                          verticalAlign: 'middle',
                          textAlign: 'right',
                          fontWeight: 700,
                          fontSize: '14px',
                        }}
                      >
                        <span
                          className={`inline-flex items-center gap-0.5 ${
                            isPositive
                              ? 'text-emerald-600'
                              : isNegative
                              ? 'text-rose-600'
                              : 'text-gray-500'
                          }`}
                        >
                          {isPositive && '▲ +'}
                          {isNegative && '▼ '}
                          {item.quantity}
                        </span>
                      </td>

                      {/* Balance Before -> After */}
                      <td
                        style={{
                          padding: '12px 12px',
                          verticalAlign: 'middle',
                          textAlign: 'right',
                        }}
                      >
                        <div className="inline-flex items-center gap-1.5 font-mono text-[12px] bg-gray-50 px-2 py-0.5 rounded border border-gray-200">
                          <span className="text-gray-500 font-medium">{item.balanceBefore}</span>
                          <span className="text-gray-400">➔</span>
                          <span className="font-extrabold text-foreground">{item.balanceAfter}</span>
                        </div>
                      </td>

                      {/* Changed By */}
                      <td
                        style={{
                          padding: '12px 12px',
                          verticalAlign: 'middle',
                          fontSize: '12px',
                        }}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700 text-[11px] font-bold border border-slate-200 shadow-2xs">
                            👤
                          </span>
                          <span
                            className="font-semibold text-foreground text-[12px] truncate max-w-[160px]"
                            title={item.performedBy || 'Staff'}
                          >
                            {item.performedBy || (item.type === 'POS_SALE' ? 'Staff' : item.type === 'SALE' ? 'Online System' : 'Staff')}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer with Summary Count and Pagination */}
        <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-gray-100 text-xs text-muted-foreground">
          <div>
            Showing <span className="font-bold text-foreground">{ledgerData.length > 0 ? (meta.page - 1) * meta.limit + 1 : 0}</span> to{' '}
            <span className="font-bold text-foreground">
              {Math.min(meta.page * meta.limit, meta.total)}
            </span>{' '}
            of <span className="font-bold text-foreground">{meta.total}</span> movements
          </div>

          <div className="flex items-center gap-2">
            <label className="text-[11px] text-gray-500">Rows per page:</label>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="rounded border border-gray-200 px-2 py-1 text-xs outline-none bg-white font-medium"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>

            <div className="flex items-center gap-1 ml-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={meta.page <= 1 || isLoading}
                className="rounded border border-gray-200 px-2.5 py-1 text-xs font-semibold hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                ◀ Prev
              </button>
              <span className="px-2 text-xs font-bold text-foreground">
                Page {meta.page} of {meta.totalPages || 1}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                disabled={meta.page >= meta.totalPages || isLoading}
                className="rounded border border-gray-200 px-2.5 py-1 text-xs font-semibold hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                Next ▶
              </button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
