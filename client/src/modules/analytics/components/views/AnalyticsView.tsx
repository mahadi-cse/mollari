'use client';

import React, { useMemo, useRef, useState } from 'react';
import { Theme, formatCurrency } from '@/modules/dashboard/utils/theme';
import { useResponsive } from '@/shared/hooks/useResponsive';
import { Card, SecHead, KpiCard } from '@/shared/components/ui/Primitives';
import { useOverviewMetrics, useStaffAnalytics, useCustomersDetailed, useCustomerAnalytics } from '@/modules/analytics';
import { useListBranches } from '@/modules/branches';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useDashboardLocale } from '@/modules/dashboard/locales/DashboardLocaleContext';
import {
  exportCSV,
  exportExcel,
  exportPDF,
  exportFullCSV,
  exportFullExcel,
  exportFullPDF,
  type ExportColumn,
} from '@/shared/utils/exportUtils';
import { Download, Search } from 'lucide-react';

export default function AnalyticsView() {
  const { isMobile } = useResponsive();
  const { t } = useDashboardLocale();
  const { data: branches = [] } = useListBranches();
  const activeBranches = branches.filter((b: any) => b.active);
  const [branch, setBranch] = useState('');
  const [period, setPeriod] = useState('daily');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const isCustom = period === 'custom';
  const overviewPeriod = period === 'daily' ? 'today' : period === 'weekly' ? 'week' : 'month';

  const queryParams = useMemo(() => {
    const base: any = {};
    if (branch) base.warehouseId = Number(branch);
    if (isCustom && customStart && customEnd) {
      base.startDate = customStart;
      base.endDate = customEnd;
    } else {
      base.period = overviewPeriod;
    }
    return base;
  }, [branch, isCustom, customStart, customEnd, overviewPeriod]);

  const { data: overview, isLoading } = useOverviewMetrics(queryParams, {
    enabled: isCustom ? !!(customStart && customEnd) : true,
  });

  const [activeTab, setActiveTab] = useState<'overview' | 'staff' | 'customer'>('overview');
  const [custSearch, setCustSearch] = useState('');
  const [custSegment, setCustSegment] = useState('');
  const [custPage, setCustPage] = useState(1);

  const { data: staffData = [], isLoading: isLoadingStaff } = useStaffAnalytics(queryParams, {
    enabled: activeTab === 'staff' && (isCustom ? !!(customStart && customEnd) : true),
  });

  const { data: customerOverview, isLoading: isLoadingCustOverview } = useCustomerAnalytics(queryParams, {
    enabled: activeTab === 'customer' && (isCustom ? !!(customStart && customEnd) : true),
  });

  const { data: customerDetailedData, isLoading: isLoadingCustDetailed } = useCustomersDetailed(
    {
      ...queryParams,
      search: custSearch || undefined,
      segment: custSegment || undefined,
      page: custPage,
      limit: 10,
    },
    {
      enabled: activeTab === 'customer' && (isCustom ? !!(customStart && customEnd) : true),
    }
  );

  const formatTrendLabel = (isoDate: string, idx: number) => {
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return `P${idx + 1}`;

    if (period === 'daily') {
      return d.toLocaleTimeString('en-BD', { hour: '2-digit', minute: '2-digit', hour12: false });
    }
    if (period === 'weekly') {
      return d.toLocaleDateString('en-BD', { day: '2-digit', month: 'short' });
    }
    if (period === 'monthly') {
      const bucketSize = overview?.trend.labels?.length || 6;
      const totalDays = 30;
      const daysPerBucket = Math.ceil(totalDays / bucketSize);
      const endDay = new Date(d);
      endDay.setDate(endDay.getDate() + daysPerBucket - 1);
      return `${d.getDate()}-${endDay.getDate()} ${d.toLocaleDateString('en-BD', { month: 'short' })}`;
    }
    // custom: show date
    return d.toLocaleDateString('en-BD', { day: '2-digit', month: 'short' });
  };

  const trendData = useMemo(() => {
    const labels = overview?.trend.labels || [];
    const size = Math.max(labels.length, overview?.trend.revenue?.length || 0, 6);
    return Array.from({ length: size }, (_, idx) => ({
      label: labels[idx] ? formatTrendLabel(labels[idx], idx) : `P${idx + 1}`,
      revenue: overview?.trend.revenue?.[idx] || 0,
      cost: overview?.trend.cost?.[idx] || 0,
      netProfit: (overview?.trend.revenue?.[idx] || 0) - (overview?.trend.cost?.[idx] || 0),
    }));
  }, [overview?.trend, period]);

  const trendTotals = useMemo(() => {
    return trendData.reduce(
      (acc, point) => ({
        revenue: acc.revenue + point.revenue,
        cost: acc.cost + point.cost,
        netProfit: acc.netProfit + point.netProfit,
      }),
      { revenue: 0, cost: 0, netProfit: 0 }
    );
  }, [trendData]);

  const topProducts = overview?.topProducts || [];

  const trendSubText = period === 'daily'
    ? t.analytics.todayPerformance
    : period === 'weekly'
      ? t.analytics.latestWeekPerformance
      : period === 'custom'
        ? `${customStart} to ${customEnd}`
        : t.analytics.latestMonthPerformance;

  const comparisonLabel = overview?.range?.comparisonLabel || 'previous period';
  const totalSales = overview?.manualSales?.totalSales || 0;
  const transactions = overview?.manualSales?.transactions || 0;
  const avgTicket = overview?.manualSales?.avgTicket || 0;
  const salesDeltaPercent = overview?.manualSales?.salesDeltaPercent || 0;
  const transactionDelta = overview?.manualSales?.transactionDelta || 0;
  const avgTicketDelta = overview?.manualSales?.avgTicketDelta || 0;
  const revenueTrend = overview?.trend?.revenue?.length ? overview.trend.revenue : [0, 0, 0, 0, 0, 0];
  const transactionTrend = overview?.trend?.transactions?.length ? overview.trend.transactions : [0, 0, 0, 0, 0, 0];
  const avgTicketTrend = overview?.trend?.avgTicket?.length ? overview.trend.avgTicket : [0, 0, 0, 0, 0, 0];

  const categoryPalette = ['#e91e8c', '#8b5cf6', '#0ea5e9', '#f59e0b', '#10b981', '#f43f5e'];
  const categoryData = useMemo(() =>
    (overview?.salesByCategory || []).map((item: any, i: number) => ({
      label: item.categoryName,
      value: Math.max(1, Math.round(item.sharePercent)),
      color: categoryPalette[i % categoryPalette.length],
      rev: formatCurrency(item.totalRevenue),
    })),
    [overview?.salesByCategory]
  );

  // ── Export definitions ──
  const periodLabel = isCustom ? `${customStart}_to_${customEnd}` : period;
  const baseFilename = `mollari_analytics_${periodLabel}`;

  const topProductsColumns: ExportColumn[] = [
    { header: 'Rank', accessor: (_row: any, i?: number) => (i ?? 0) + 1 },
    { header: 'Product', accessor: 'productName' },
    { header: 'SKU', accessor: 'sku' },
    { header: 'Units Sold', accessor: 'unitsSold' },
    { header: 'Revenue', accessor: 'revenue', format: (v: number) => formatCurrency(v) },
  ];

  const trendColumns: ExportColumn[] = [
    { header: 'Period', accessor: 'label' },
    { header: 'Revenue', accessor: 'revenue', format: (v: number) => formatCurrency(v) },
    { header: 'Cost', accessor: 'cost', format: (v: number) => formatCurrency(v) },
    { header: 'Net Profit', accessor: 'netProfit', format: (v: number) => formatCurrency(v) },
  ];

  const categoryColumns: ExportColumn[] = [
    { header: 'Category', accessor: 'label' },
    { header: 'Revenue', accessor: 'rev' },
    { header: 'Share %', accessor: 'value', format: (v: number) => `${v}%` },
  ];

  const summaryColumns: ExportColumn[] = [
    { header: 'Metric', accessor: 'metric' },
    { header: 'Value', accessor: 'value' },
  ];

  const summaryData = useMemo(() => [
    { metric: 'Total Revenue', value: formatCurrency(totalSales) },
    { metric: 'Total Cost', value: formatCurrency(trendTotals.cost) },
    { metric: 'Net Profit', value: formatCurrency(trendTotals.netProfit) },
    { metric: 'Qty Sold', value: String(overview?.manualSales?.totalQty ?? 0) },
    { metric: 'Transactions', value: String(transactions) },
    { metric: 'Avg Ticket', value: formatCurrency(avgTicket) },
  ], [totalSales, trendTotals, overview, transactions, avgTicket]);

  const handleExportFull = async (format: 'csv' | 'excel' | 'pdf') => {
    setShowExportMenu(false);
    
    const branchName = branch 
      ? activeBranches.find((b: any) => b.id === Number(branch))?.name || 'Selected Branch'
      : 'All Branches';
    const periodName = period.toUpperCase();
    
    const subtitle = `Branch: ${branchName} | Period: ${periodName} (${trendSubText})`;
    
    const fullOpts = {
      filename: baseFilename,
      title: 'Mollari - Analytics Report',
      subtitle,
      summary: {
        title: 'Summary Overview',
        columns: summaryColumns,
        data: summaryData,
      },
      trend: {
        title: 'Revenue Trend Details',
        columns: trendColumns,
        data: trendData,
      },
      products: {
        title: 'Top Products by Revenue',
        columns: topProductsColumns,
        data: topProducts,
      },
      categories: {
        title: 'Sales by Category',
        columns: categoryColumns,
        data: categoryData.map((c: any) => ({ label: c.label, rev: c.rev, value: c.value })),
      },
    };

    if (format === 'csv') {
      exportFullCSV(fullOpts);
    } else if (format === 'excel') {
      exportFullExcel(fullOpts);
    } else {
      let chartImage: string | null = null;
      try {
        const wrapper = document.querySelector('.recharts-wrapper');
        if (wrapper) {
          const svg = wrapper.querySelector('svg');
          if (svg) {
            const svgClone = svg.cloneNode(true) as SVGSVGElement;
            svgClone.setAttribute('style', 'background-color: white;');
            const svgString = new XMLSerializer().serializeToString(svgClone);
            const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(svgBlob);
            
            chartImage = await new Promise<string | null>((resolve) => {
              const img = new Image();
              img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = (svg.clientWidth || 500) * 2;
                canvas.height = (svg.clientHeight || 300) * 2;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  ctx.fillStyle = '#ffffff';
                  ctx.fillRect(0, 0, canvas.width, canvas.height);
                  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                  resolve(canvas.toDataURL('image/png'));
                } else {
                  resolve(null);
                }
                URL.revokeObjectURL(url);
              };
              img.onerror = () => {
                resolve(null);
                URL.revokeObjectURL(url);
              };
              img.src = url;
            });
          }
        }
      } catch (err) {
        console.error('Failed to capture chart', err);
      }
      exportFullPDF({ ...fullOpts, chartImage });
    }
  };

  const staffKpis = useMemo(() => {
    if (!staffData || staffData.length === 0) {
      return { totalSales: 0, totalTxns: 0, topPerformer: 'N/A', topPerformerSales: 0 };
    }
    const filtered = staffData.filter((s: any) => s.name && s.name.toLowerCase() !== 'system');
    const totalSales = filtered.reduce((acc: number, curr: any) => acc + curr.totalSalesAmount, 0);
    const totalTxns = filtered.reduce((acc: number, curr: any) => acc + curr.totalTransactions, 0);
    const sorted = [...filtered].sort((a: any, b: any) => b.totalSalesAmount - a.totalSalesAmount);
    const topPerformer = sorted[0]?.name || 'N/A';
    const topPerformerSales = sorted[0]?.totalSalesAmount || 0;
    return { totalSales, totalTxns, topPerformer, topPerformerSales };
  }, [staffData]);

  const customerKpis = useMemo(() => {
    if (!customerOverview) {
      return { total: 0, active: 0, avgOrders: 0, avgSpent: 0 };
    }
    return {
      total: customerOverview.totalCustomers || 0,
      active: customerOverview.activeCustomers || 0,
      avgOrders: customerOverview.avgOrdersPerCustomer || 0,
      avgSpent: customerOverview.avgSpentPerCustomer || 0,
    };
  }, [customerOverview]);

  const getSegmentBadge = (segment: string) => {
    switch (segment?.toUpperCase()) {
      case 'VIP':
        return <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">★ VIP</span>;
      case 'REGULAR':
        return <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200">REGULAR</span>;
      case 'NEW':
        return <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-green-50 text-green-700 border border-green-200">NEW</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-gray-50 text-gray-700 border border-gray-200 font-semibold">INACTIVE</span>;
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex items-center justify-between">
          <div className="text-[20px] font-extrabold" style={{ color: Theme.fg }}>{t.analytics.analyticsTitle}</div>
          
          {/* Export Report Dropdown */}
          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center justify-center gap-1.5 cursor-pointer rounded-lg px-3 py-1.5 text-[11px] font-bold transition-colors hover:bg-gray-50"
              style={{ background: Theme.card, color: Theme.fg, border: `1px solid ${Theme.border}` }}
            >
              <Download size={13} />
              <span className="hidden sm:inline">Export</span>
            </button>
            {showExportMenu && (
              <>
                <div className="fixed inset-0 z-[9998]" onClick={() => setShowExportMenu(false)} />
                <div
                  className="absolute right-0 top-full z-[9999] mt-1 w-48 rounded-xl border bg-white py-1 shadow-xl"
                  style={{ borderColor: Theme.border }}
                >
                  <button
                    onClick={() => handleExportFull('pdf')}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-gray-50 cursor-pointer border-none bg-transparent"
                    style={{ color: Theme.fg }}
                  >
                    <span className="inline-block w-8 text-[10px] font-bold" style={{ color: Theme.primary }}>PDF</span>
                    Export as PDF
                  </button>
                  <button
                    onClick={() => handleExportFull('excel')}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-gray-50 cursor-pointer border-none bg-transparent"
                    style={{ color: Theme.fg }}
                  >
                    <span className="inline-block w-8 text-[10px] font-bold" style={{ color: Theme.primary }}>XLS</span>
                    Export as Excel
                  </button>
                  <button
                    onClick={() => handleExportFull('csv')}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-gray-50 cursor-pointer border-none bg-transparent"
                    style={{ color: Theme.fg }}
                  >
                    <span className="inline-block w-8 text-[10px] font-bold" style={{ color: Theme.primary }}>CSV</span>
                    Export as CSV
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className={`flex flex-wrap items-center gap-2 ${isMobile ? 'w-full' : ''}`}>
          <select
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            className="cursor-pointer rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold outline-none w-full sm:w-auto"
            style={{ border: `1px solid ${Theme.border}`, color: Theme.fg }}
          >
            <option value="">{t.analytics.allBranches}</option>
            {activeBranches.map((b: any) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <div className="flex gap-0.5 rounded-lg p-0.5 w-full sm:w-auto" style={{ background: Theme.muted }}>
            {['daily', 'weekly', 'monthly', 'custom'].map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className="flex-1 sm:flex-initial cursor-pointer rounded-md border-none px-2 py-1 text-[11px] font-semibold uppercase text-center transition-all"
                style={{
                  background: period === p ? '#fff' : 'transparent',
                  color: period === p ? Theme.primary : Theme.mutedFg,
                  boxShadow: period === p ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                {p === 'daily' ? t.analytics.daily : p === 'weekly' ? t.analytics.weekly : p === 'monthly' ? t.analytics.monthly : t.analytics.custom}
              </button>
            ))}
          </div>
          {isCustom && (
            <div className="flex items-center gap-1.5 w-full sm:w-auto justify-between sm:justify-start">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="flex-1 sm:flex-initial rounded-lg border px-2 py-1 text-[11px] outline-none max-w-[130px] sm:max-w-none"
                style={{ borderColor: Theme.border, color: Theme.fg }}
              />
              <span className="text-[11px]" style={{ color: Theme.mutedFg }}>→</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="flex-1 sm:flex-initial rounded-lg border px-2 py-1 text-[11px] outline-none max-w-[130px] sm:max-w-none"
                style={{ borderColor: Theme.border, color: Theme.fg }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Tab Selector — full-width, equal columns */}
      <div
        className="flex w-full rounded-xl overflow-hidden mb-4"
        style={{ border: `1px solid ${Theme.border}`, background: Theme.muted }}
      >
        {[
          { id: 'overview', label: t.analytics.overviewTab, icon: '📊' },
          { id: 'staff', label: t.analytics.staffPerformance, icon: '👥' },
          { id: 'customer', label: t.analytics.customerActivity, icon: '💳' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className="flex-1 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 py-2 sm:py-2.5 text-[10px] sm:text-xs font-bold cursor-pointer border-none transition-all duration-150"
            style={{
              background: activeTab === tab.id ? '#fff' : 'transparent',
              color: activeTab === tab.id ? Theme.primary : Theme.mutedFg,
              boxShadow: activeTab === tab.id ? '0 1px 6px rgba(0,0,0,0.08)' : 'none',
              borderRadius: activeTab === tab.id ? '10px' : '0',
              margin: activeTab === tab.id ? '3px' : '0',
            }}
          >
            <span className="text-sm sm:text-base">{tab.icon}</span>
            <span className="text-center">{tab.label}</span>
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <>
          <Card className="px-3 py-2">
            <div className={`flex items-center gap-2 ${isMobile ? 'flex-wrap' : ''}`}>
              <div className="text-[9px] font-bold uppercase tracking-wide shrink-0" style={{ color: Theme.mutedFg }}>📊</div>
              {[
                { label: t.analytics.revenue, value: formatCurrency(totalSales), color: Theme.primary },
                { label: t.analytics.cost, value: formatCurrency(trendTotals.cost), color: Theme.warning },
                { label: t.analytics.netProfit, value: formatCurrency(trendTotals.netProfit), color: trendTotals.netProfit >= 0 ? Theme.success : '#dc2626' },
                { label: t.analytics.qtySold, value: `${overview?.manualSales?.totalQty ?? 0}`, color: Theme.fg },
                { label: t.analytics.transactions, value: `${transactions}`, color: Theme.fg },
                { label: t.analytics.avgTicket, value: formatCurrency(avgTicket), color: Theme.fg },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-1.5 rounded px-2.5 py-1" style={{ background: Theme.muted }}>
                  <span className="text-[10px] font-bold uppercase" style={{ color: Theme.mutedFg }}>{s.label}</span>
                  <span className="text-sm font-black" style={{ color: s.color }}>{s.value}</span>
                </div>
              ))}
            </div>
          </Card>

          <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-2'}`}>
            <Card>
              <SecHead title={t.analytics.costVsRevenue} sub={trendSubText} />
              <ResponsiveContainer width="100%" height={isMobile ? 180 : 220}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={Theme.border} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: Theme.mutedFg }} axisLine={false} tickLine={false} />
                  <YAxis
                    yAxisId="l"
                    tick={{ fontSize: 10, fill: Theme.mutedFg }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`}
                    width={40}
                  />
                  <Tooltip />
                  <Line
                    yAxisId="l"
                    type="monotone"
                    dataKey="revenue"
                    name="revenue"
                    stroke={Theme.primary}
                    strokeWidth={2.5}
                    dot={{ fill: Theme.primary, r: 3 }}
                  />
                  <Line
                    yAxisId="l"
                    type="monotone"
                    dataKey="cost"
                    name="cost"
                    stroke={Theme.warning}
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ fill: Theme.warning, r: 3 }}
                  />
                  <Line
                    yAxisId="l"
                    type="monotone"
                    dataKey="netProfit"
                    name="net profit"
                    stroke={Theme.success}
                    strokeWidth={2.25}
                    strokeDasharray="2 2"
                    dot={{ fill: Theme.success, r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>

              <div className="mt-3 flex flex-wrap justify-center gap-4">
                <div className="flex items-center gap-1.5 text-xs" style={{ color: Theme.mutedFg }}>
                  <div className="h-3 w-3 rounded-sm" style={{ background: Theme.primary }} />
                  {t.analytics.revenue} (৳)
                </div>
                <div className="flex items-center gap-1.5 text-xs" style={{ color: Theme.mutedFg }}>
                  <div className="h-1 w-3" style={{ background: Theme.warning }} />
                  {t.analytics.cost} (৳)
                </div>
                <div className="flex items-center gap-1.5 text-xs" style={{ color: Theme.mutedFg }}>
                  <div className="h-1 w-3" style={{ background: Theme.success }} />
                  {t.analytics.netProfit} (৳)
                </div>
              </div>

              {isLoading && (
                <div className="mt-2 text-center text-xs" style={{ color: Theme.mutedFg }}>
                  {t.analytics.loadingTrend}
                </div>
              )}
            </Card>

            <Card>
              <SecHead
                title={t.analytics.topProductsByRevenue}
                sub={t.analytics.fromCurrentAnalyticsRange}
                action={t.analytics.exportCSV}
                onAction={() => exportCSV({ filename: `${baseFilename}_top_products`, columns: topProductsColumns, data: topProducts, title: 'Top Products by Revenue' })}
              />
              {isLoading ? (
                <div className="py-6 text-center text-sm" style={{ color: Theme.mutedFg }}>{t.analytics.loadingTopProducts}</div>
              ) : topProducts.length === 0 ? (
                <div className="py-6 text-center text-sm" style={{ color: Theme.mutedFg }}>{t.analytics.noSalesData}</div>
              ) : (
                topProducts.slice(0, 6).map((p: any, i: number) => {
                  const maxRev = topProducts[0]?.revenue || 1;
                  const pct = (p.revenue / maxRev) * 100;

                  return (
                    <div key={p.sku || p.productId} className="mb-3.5 flex items-center gap-3">
                      <div
                        className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-xs font-bold"
                        style={{
                          background: i === 0 ? Theme.primary : Theme.muted,
                          color: i === 0 ? '#fff' : Theme.mutedFg,
                        }}
                      >
                        {i + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex justify-between">
                          <span
                            className="max-w-[60%] overflow-hidden text-ellipsis whitespace-nowrap text-xs font-semibold"
                            style={{ color: Theme.fg }}
                          >
                            {p.productName}
                          </span>
                          <span className="shrink-0 text-xs font-bold" style={{ color: Theme.primary }}>
                            {formatCurrency(p.revenue)}
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full" style={{ background: Theme.muted }}>
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${pct}%`,
                              background: `linear-gradient(90deg,${Theme.primaryDark},${Theme.primary})`,
                            }}
                          />
                        </div>
                        <div className="mt-1 text-[10px]" style={{ color: Theme.mutedFg }}>
                          {p.unitsSold} {t.analytics.sold} · {t.modal.sku} {p.sku}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </Card>
          </div>
        </>
      )}

      {activeTab === 'staff' && (
        <>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
            <KpiCard
              icon="👥"
              label="Active Staff"
              value={staffData.filter((s: any) => s.name && s.name.toLowerCase() !== 'system').length}
              accent={Theme.secondary}
            />
            <KpiCard
              icon="💰"
              label="Total Staff Sales"
              value={formatCurrency(staffKpis.totalSales)}
              accent="#fff7ed"
            />
            <KpiCard
              icon="🏆"
              label={`Top Performer · ${formatCurrency(staffKpis.topPerformerSales)}`}
              value={staffKpis.topPerformer}
              accent="#f0fdf4"
            />
          </div>

          <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-3'}`}>
            <Card className="col-span-1">
              <SecHead title="Sales Contribution" sub="Revenue breakdown by staff" />
              {isLoadingStaff ? (
                <div className="py-12 text-center text-xs text-muted-foreground">Loading staff chart...</div>
              ) : staffData.filter((s: any) => s.totalSalesAmount > 0).length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">No sales data for chart</div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={staffData.filter((s: any) => s.name && s.name.toLowerCase() !== 'system' && s.totalSalesAmount > 0)}>
                    <CartesianGrid strokeDasharray="3 3" stroke={Theme.border} vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: Theme.mutedFg }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fontSize: 9, fill: Theme.mutedFg }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`}
                      width={40}
                    />
                    <Tooltip formatter={(value) => [`৳${Number(value).toLocaleString()}`, 'Sales']} />
                    <Bar dataKey="totalSalesAmount" radius={[4, 4, 0, 0]}>
                      {staffData.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? Theme.primary : '#8b5cf6'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>

            <Card className="col-span-1 sm:col-span-2">
              <SecHead title="Staff Performance Overview" sub="Orders, manual sales, and revenue" />
              {isLoadingStaff ? (
                <div className="py-8 text-center text-sm text-muted-foreground">Loading staff metrics...</div>
              ) : staffData.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">No staff data found</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-border bg-gray-50 text-muted-foreground uppercase font-bold tracking-wider">
                        <th className="py-2.5 px-3">Staff Member</th>
                        <th className="py-2.5 px-3">Role</th>
                        <th className="py-2.5 px-3 text-center">Orders</th>
                        <th className="py-2.5 px-3 text-center">Manual</th>
                        <th className="py-2.5 px-3 text-center">Total Txns</th>
                        <th className="py-2.5 px-3 text-right">Revenue</th>
                        <th className="py-2.5 px-3 text-right">Share</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {staffData
                        .filter((s: any) => s.name && s.name.toLowerCase() !== 'system')
                        .map((staff: any, idx: number) => (
                          <tr key={staff.staffId || `staff-${idx}`} className="hover:bg-gray-50 transition-colors">
                            <td className="py-3 px-3 font-semibold text-foreground">
                              <div>
                                <div className="text-xs">{staff.name}</div>
                                <div className="text-[10px] text-muted-foreground font-normal">{staff.email}</div>
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-purple-50 text-purple-700 border border-purple-200 uppercase">
                                {staff.role || 'Staff'}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center text-muted-foreground font-medium">{staff.ordersHandled}</td>
                            <td className="py-3 px-3 text-center text-muted-foreground font-medium">{staff.manualSalesHandled}</td>
                            <td className="py-3 px-3 text-center font-bold text-foreground">{staff.totalTransactions}</td>
                            <td className="py-3 px-3 text-right font-bold text-foreground">{formatCurrency(staff.totalSalesAmount)}</td>
                            <td className="py-3 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <span className="font-semibold text-xs">{staff.revenueContribution.toFixed(1)}%</span>
                                <div className="w-10 bg-gray-100 h-1.5 rounded-full overflow-hidden shrink-0">
                                  <div className="bg-primary h-full" style={{ width: `${Math.min(100, staff.revenueContribution)}%` }} />
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        </>
      )}

      {activeTab === 'customer' && (
        <>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
            <KpiCard icon="👥" label="Total Customers" value={customerKpis.total} accent={Theme.secondary} />
            <KpiCard icon="⚡" label="Active Customers" value={customerKpis.active} accent="#fff7ed" />
            <KpiCard icon="📦" label="Avg Orders / Cust" value={customerKpis.avgOrders.toFixed(1)} accent="#f0fdf4" />
            <KpiCard icon="💳" label="Avg Customer LTV" value={formatCurrency(customerKpis.avgSpent)} accent="#f0f9ff" />
          </div>

          {/* Customer Charts row */}
          <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {/* Segment breakdown bar chart */}
            <Card>
              <SecHead title="Customer Segments" sub="Distribution across segments" />
              {isLoadingCustOverview ? (
                <div className="py-12 text-center text-xs text-muted-foreground">Loading chart...</div>
              ) : !customerOverview?.segments ? (
                <div className="py-12 text-center text-xs text-muted-foreground">No segment data available</div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart
                      data={[
                        { name: '★ VIP', value: customerOverview.segments.vip || 0, fill: '#f59e0b' },
                        { name: 'Regular', value: customerOverview.segments.regular || 0, fill: Theme.primary },
                        { name: 'New', value: customerOverview.segments.new || 0, fill: Theme.success },
                        { name: 'Inactive', value: customerOverview.segments.inactive || 0, fill: Theme.mutedFg },
                      ]}
                      barSize={36}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={Theme.border} vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: Theme.mutedFg }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 9, fill: Theme.mutedFg }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
                      <Tooltip formatter={(v) => [v, 'Customers']} />
                      <Bar dataKey="value" radius={[5, 5, 0, 0]}>
                        {[
                          { fill: '#f59e0b' },
                          { fill: Theme.primary },
                          { fill: Theme.success },
                          { fill: Theme.mutedFg },
                        ].map((entry, index) => (
                          <Cell key={`seg-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="mt-2 flex flex-wrap gap-3 justify-center">
                    {[
                      { label: '★ VIP', color: '#f59e0b', count: customerOverview.segments.vip || 0 },
                      { label: 'Regular', color: Theme.primary, count: customerOverview.segments.regular || 0 },
                      { label: 'New', color: Theme.success, count: customerOverview.segments.new || 0 },
                      { label: 'Inactive', color: Theme.mutedFg, count: customerOverview.segments.inactive || 0 },
                    ].map((s) => (
                      <div key={s.label} className="flex items-center gap-1.5 text-xs" style={{ color: Theme.mutedFg }}>
                        <div className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
                        {s.label} ({s.count})
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Card>

            {/* Top customers by spending bar chart */}
            <Card>
              <SecHead title="Top Customers by Spending" sub="Highest lifetime value customers" />
              {isLoadingCustDetailed ? (
                <div className="py-12 text-center text-xs text-muted-foreground">Loading chart...</div>
              ) : !customerDetailedData || customerDetailedData.data.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">No customer purchase data yet</div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart
                      data={[...customerDetailedData.data]
                        .sort((a, b) => b.totalPurchaseAmount - a.totalPurchaseAmount)
                        .slice(0, 6)
                        .map((c) => ({
                          name: c.name?.split(' ')[0] || 'Guest',
                          spent: c.totalPurchaseAmount,
                          profit: c.profit,
                        }))}
                      barSize={20}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={Theme.border} vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 9, fill: Theme.mutedFg }} axisLine={false} tickLine={false} />
                      <YAxis
                        tick={{ fontSize: 9, fill: Theme.mutedFg }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`}
                        width={36}
                      />
                      <Tooltip formatter={(v) => [`৳${Number(v).toLocaleString()}`, '']} />
                      <Bar dataKey="spent" name="Spent" fill={Theme.primary} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="profit" name="Profit" fill={Theme.success} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="mt-2 flex flex-wrap gap-3 justify-center">
                    <div className="flex items-center gap-1.5 text-xs" style={{ color: Theme.mutedFg }}>
                      <div className="h-2.5 w-2.5 rounded-sm" style={{ background: Theme.primary }} />
                      Total Spent
                    </div>
                    <div className="flex items-center gap-1.5 text-xs" style={{ color: Theme.mutedFg }}>
                      <div className="h-2.5 w-2.5 rounded-sm" style={{ background: Theme.success }} />
                      Net Profit
                    </div>
                  </div>
                </>
              )}
            </Card>
          </div>

          <Card>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
              <div>
                <div className="text-base font-bold text-foreground">Customer Activity Registry</div>
                <div className="text-xs text-muted-foreground mt-0.5">Filter, search, and analyze customer margins & points</div>
              </div>
              
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-initial">
                  <input
                    type="text"
                    value={custSearch}
                    onChange={(e) => {
                      setCustSearch(e.target.value);
                      setCustPage(1);
                    }}
                    placeholder="Search name, phone, email..."
                    className="w-full sm:w-56 pl-8 pr-3 py-1.5 text-xs rounded-lg border outline-none"
                    style={{ borderColor: Theme.border, color: Theme.fg }}
                  />
                  <Search className="absolute left-2.5 top-2 text-muted-foreground" size={13} />
                </div>

                <select
                  value={custSegment}
                  onChange={(e) => {
                    setCustSegment(e.target.value);
                    setCustPage(1);
                  }}
                  className="px-2 py-1.5 text-xs rounded-lg border outline-none bg-white cursor-pointer"
                  style={{ borderColor: Theme.border, color: Theme.fg }}
                >
                  <option value="">All Segments</option>
                  <option value="VIP">VIP</option>
                  <option value="REGULAR">Regular</option>
                  <option value="NEW">New</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
            </div>

            {isLoadingCustDetailed ? (
              <div className="py-12 text-center text-sm text-muted-foreground">Loading customer directory...</div>
            ) : !customerDetailedData || customerDetailedData.data.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">No customer records match search/filters</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-border bg-gray-50 text-muted-foreground uppercase font-bold tracking-wider">
                        <th className="py-2.5 px-3">Customer Details</th>
                        <th className="py-2.5 px-3 text-center">Order Frequency</th>
                        <th className="py-2.5 px-3 text-center">Items Bought</th>
                        <th className="py-2.5 px-3">Financial breakdown</th>
                        <th className="py-2.5 px-3">Loyalty points</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {customerDetailedData.data.map((cust: any) => {
                        const marginPct = cust.totalPurchaseAmount > 0
                          ? (cust.profit / cust.totalPurchaseAmount) * 100
                          : 0;

                        return (
                          <tr key={cust.customerId} className="hover:bg-gray-50 transition-colors">
                            <td className="py-3 px-3 font-semibold text-foreground">
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs">{cust.name || 'Walk-in Customer'}</span>
                                  {getSegmentBadge(cust.segment)}
                                </div>
                                <div className="text-[10px] text-muted-foreground font-normal mt-0.5">
                                  {cust.email || 'No email'} · {cust.phone || 'No phone'}
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-3 text-center text-foreground font-bold">{cust.orderFrequency}</td>
                            <td className="py-3 px-3 text-center text-muted-foreground font-medium">{cust.totalItemsPurchased} units</td>
                            <td className="py-3 px-3">
                              <div className="flex flex-col text-[11px] gap-0.5 max-w-[170px]">
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Spent:</span>
                                  <span className="font-bold text-foreground">{formatCurrency(cust.totalPurchaseAmount)}</span>
                                </div>
                                <div className="flex justify-between text-[10px] text-muted-foreground">
                                  <span>Cost:</span>
                                  <span>{formatCurrency(cust.totalCost)}</span>
                                </div>
                                <div className="flex justify-between border-t border-dashed border-gray-200 pt-0.5 mt-0.5 font-semibold">
                                  <span className="text-success">Profit:</span>
                                  <span className="text-success">{formatCurrency(cust.profit)} ({marginPct.toFixed(0)}%)</span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <div className="flex flex-col text-[11px] gap-0.5 max-w-[140px]">
                                <div className="flex justify-between font-bold">
                                  <span className="text-muted-foreground">Balance:</span>
                                  <span className="text-primary">{cust.loyaltyPoints} pts</span>
                                </div>
                                <div className="flex justify-between text-[9px] text-muted-foreground">
                                  <span>Accumulated:</span>
                                  <span>+{cust.loyaltyPointsAccumulated}</span>
                                </div>
                                <div className="flex justify-between text-[9px] text-muted-foreground">
                                  <span>Used:</span>
                                  <span>-{cust.loyaltyPointsUsed}</span>
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {customerDetailedData.total > 10 && (
                  <div className="flex items-center justify-between mt-4 border-t border-border pt-3 text-xs">
                    <span className="text-muted-foreground">
                      Showing {(custPage - 1) * 10 + 1} to {Math.min(custPage * 10, customerDetailedData.total)} of {customerDetailedData.total} customers
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        disabled={custPage === 1}
                        onClick={() => setCustPage(p => Math.max(1, p - 1))}
                        className="px-2.5 py-1 rounded-lg border bg-white font-semibold disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                        style={{ borderColor: Theme.border, color: Theme.fg }}
                      >
                        Previous
                      </button>
                      <button
                        disabled={custPage * 10 >= customerDetailedData.total}
                        onClick={() => setCustPage(p => p + 1)}
                        className="px-2.5 py-1 rounded-lg border bg-white font-semibold disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                        style={{ borderColor: Theme.border, color: Theme.fg }}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
