'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { signOut } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import dynamic from 'next/dynamic';

import { Theme } from '@/modules/dashboard/utils/theme';
import { useResponsive } from '@/shared/hooks/useResponsive';
import { NAV, SETTINGS_ITEMS } from '@/modules/dashboard/utils/constants';
import { usePathname, useSearchParams } from 'next/navigation';
import { useDashboardLocale } from '../locales/DashboardLocaleContext';
import { useCreateManualSaleMutation } from '@/modules/manual-sales';
import { ANALYTICS_QUERY_KEYS } from '@/modules/analytics';
import { INVENTORY_QUERY_KEYS } from '@/modules/inventory';
import type { Product, SellLog, Order } from '@/modules/dashboard/types';

import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { MobileNav } from './MobileNav';
import { useNavModules } from '../hooks/useNavModules';
import ManualSaleModal from './ManualSaleModal';

// Lazy load views for better performance
const OverviewView = dynamic(() => import('./views/OverviewView'));
const OrdersView = dynamic(() => import('../../orders/components/views/OrdersView'));
const InventoryView = dynamic(() => import('../../inventory/components/views/InventoryView'));
const SalesView = dynamic(() => import('../../manual-sales/components/views/SalesView'));
const ReturnsView = dynamic(() => import('../../manual-returns/components/views/ReturnsView'));
const SuppliersView = dynamic(() => import('../../suppliers/components/views/SuppliersView'));
const ProductsView = dynamic(() => import('../../products/components/views/ProductsView'));
const CategoriesView = dynamic(() => import('../../categories/components/views/CategoriesView'));
const AnalyticsView = dynamic(() => import('../../analytics/components/views/AnalyticsView'));
const BranchesView = dynamic(() => import('../../branches/components/views/BranchesView'));
const SettingsView = dynamic(() => import('../../settings/components/views/SettingsView'));
const ProfileView = dynamic(() => import('../../auth/components/views/ProfileView'));

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

interface DashboardShellProps {
  products: Product[];
  setProducts: (products: Product[]) => void;
  sellLog: SellLog[];
  setSellLog: (log: SellLog[]) => void;
  orders: Order[];
  time: Date;
}

export default function DashboardShell({
  products,
  setProducts,
  sellLog,
  setSellLog,
  orders,
  time,
}: DashboardShellProps) {
  const { t } = useDashboardLocale();
  const { isMobile } = useResponsive();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pathSection = pathname?.split('/')[2] || 'overview';
  const allowedNavIds = useMemo(() => new Set([...NAV.map((n) => n.id), 'profile']), []);
  
  const [activeNav, setActiveNav] = useState(allowedNavIds.has(pathSection) ? pathSection : 'overview');
  const [settingsTab, setSettingsTab] = useState(searchParams?.get('tab') || 'general');
  const [settingsOpen, setSettingsOpen] = useState(activeNav === 'settings');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [modal, setModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const createSaleMutation = useCreateManualSaleMutation();
  const { navItems, userModuleCodes } = useNavModules();

  const lowCount = products.filter((p) => p.status !== 'active').length;
  
  const settingsItemsLocalized = SETTINGS_ITEMS.map((item) => ({
    ...item,
    label: (t.settingsItems as any)[item.id] || item.label,
  }));
  const settingsLabel = settingsItemsLocalized.find((i) => i.id === settingsTab)?.label || '';
  
  const navItemsLocalized = navItems.map((n: any) => ({
    ...n,
    label: (t.nav as any)[n.id] || n.label,
    badge: n.badge ? t.nav.soon : n.badge,
  }));
  
  const topbarLabel =
    activeNav === 'settings'
      ? `${t.nav.settings} › ${settingsLabel}`
      : activeNav === 'profile'
        ? t.topbar.userProfile
        : navItemsLocalized.find((n: { id: string; label: string }) => n.id === activeNav)?.label || activeNav;

  const navigate = (id: string, settingsTabId?: string) => {
    const tab = settingsTabId || (id === 'settings' ? settingsTab : undefined);
    const path = id === 'overview' ? '/dashboard' : `/dashboard/${id}`;
    const target = id === 'settings' && tab ? `${path}?tab=${encodeURIComponent(tab)}` : path;
    setActiveNav(id);
    if (id === 'settings' && tab) setSettingsTab(tab);
    window.history.pushState(null, '', target);
    setSidebarOpen(false);
    if (id !== 'settings') setSettingsOpen(false);
    if (id === 'settings') setSettingsOpen(true);
  };

  useEffect(() => {
    const syncFromUrl = () => {
      const section = window.location.pathname.split('/')[2] || 'overview';
      const nextNav = allowedNavIds.has(section) ? section : 'overview';
      setActiveNav(nextNav);
      setSettingsOpen(nextNav === 'settings');
      if (nextNav === 'settings') {
        const tabFromUrl = new URLSearchParams(window.location.search).get('tab');
        if (tabFromUrl && SETTINGS_ITEMS.some((item) => item.id === tabFromUrl)) {
          setSettingsTab(tabFromUrl);
        }
      }
    };
    syncFromUrl();
    window.addEventListener('popstate', syncFromUrl);
    return () => window.removeEventListener('popstate', syncFromUrl);
  }, [allowedNavIds]);

  useEffect(() => {
    setSettingsOpen(activeNav === 'settings');
  }, [activeNav]);

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/' });
  };

  const views: Record<string, React.ReactNode> = {
    profile: <ProfileView />,
    overview: <OverviewView products={products} orders={orders} onQuickSale={() => setModal(true)} />,
    products: <ProductsView />,
    categories: <CategoriesView />,
    sales: (
      <SalesView
        products={products}
        setProducts={setProducts}
        sellLog={sellLog}
        setSellLog={setSellLog}
      />
    ),
    orders: <OrdersView products={products} orders={orders} />,
    ecommerce: <OrdersView products={products} orders={orders} />,
    returns: <ReturnsView />,
    suppliers: <SuppliersView />,
    inventory: (
      <InventoryView
        products={products}
        setProducts={setProducts}
        sellLog={sellLog}
        setSellLog={setSellLog}
      />
    ),
    analytics: <AnalyticsView />,
    branches: <BranchesView />,
    settings: (
      <SettingsView products={products} tab={settingsTab} setTab={setSettingsTab} />
    ),
  };

  const resolvedView = (() => {
    if (activeNav === 'profile' || !userModuleCodes) return views[activeNav];
    if (userModuleCodes.has(activeNav)) return views[activeNav];
    const firstAllowed = navItems[0]?.id;
    if (firstAllowed && firstAllowed !== activeNav) {
      setTimeout(() => navigate(firstAllowed), 0);
      return null;
    }
    return views[activeNav];
  })();

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{
        background: Theme.bg,
        fontFamily: "'DM Sans','Segoe UI',system-ui,sans-serif",
        color: Theme.fg,
      }}
    >
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: 20 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="fixed right-5 top-5 z-[9998] rounded-xl px-5 py-3.5 text-[13px] font-semibold text-white shadow-[0_8px_30px_rgba(0,0,0,0.15)]"
            style={{ background: Theme.success }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {!isMobile && (
        <aside
          className="flex w-[260px] shrink-0 flex-col overflow-y-auto"
          style={{
            background: Theme.card,
            borderRight: `1px solid ${Theme.border}`,
          }}
        >
          <Sidebar
            activeNav={activeNav}
            settingsOpen={settingsOpen}
            settingsTab={settingsTab}
            navigate={navigate}
            setSettingsTab={setSettingsTab}
            setSettingsOpen={setSettingsOpen}
            lowCount={lowCount}
            time={time}
            isMobile={isMobile}
            setSidebarOpen={setSidebarOpen}
            navItems={navItemsLocalized}
            userModuleCodes={userModuleCodes}
          />
        </aside>
      )}

      <AnimatePresence>
        {isMobile && sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 z-[1000] bg-black/40"
            />
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="fixed bottom-0 left-0 top-0 z-[1001] flex w-[280px] flex-col overflow-y-auto shadow-[4px_0_24px_rgba(0,0,0,0.12)]"
              style={{
                background: Theme.card,
                borderRight: `1px solid ${Theme.border}`,
              }}
            >
              <Sidebar
                activeNav={activeNav}
                settingsOpen={settingsOpen}
                settingsTab={settingsTab}
                navigate={navigate}
                setSettingsTab={setSettingsTab}
                setSettingsOpen={setSettingsOpen}
                lowCount={lowCount}
                time={time}
                isMobile={isMobile}
                setSidebarOpen={setSidebarOpen}
                navItems={navItemsLocalized}
                userModuleCodes={userModuleCodes}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <main
        className={`flex flex-1 flex-col overflow-x-hidden overflow-y-auto ${isMobile ? 'pb-[60px]' : 'pb-0'}`}
      >
        <Topbar
          isMobile={isMobile}
          setSidebarOpen={setSidebarOpen}
          topbarLabel={topbarLabel}
          navigate={navigate}
          handleLogout={handleLogout}
        />

        <div className={`flex-1 overflow-y-auto overflow-x-hidden ${isMobile ? 'px-[14px] py-4' : 'px-8 py-6'}`}>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeNav + (activeNav === 'settings' ? settingsTab : '')}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              {resolvedView}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {isMobile && (
        <MobileNav activeNav={activeNav} navigate={navigate} lowCount={lowCount} />
      )}

      <AnimatePresence>
        {modal && (
          <ManualSaleModal
            products={products}
            onClose={() => setModal(false)}
            onConfirm={async (
              product: Product,
              qty: number,
              note: string,
              total: number,
              variant?: { colorName?: string; sizeName?: string }
            ) => {
              setProducts(
                products.map((p: Product) => {
                  if (p.id !== product.id) return p;
                  const ns = Math.max(0, p.stock - qty);

                  let updatedColors = p.colors;
                  let updatedSizes = p.sizes;
                  if (variant?.colorName && updatedColors) {
                    updatedColors = updatedColors.map((c: any) => {
                      if (c.name !== variant.colorName) return c;
                      if (variant.sizeName && c.sizes) {
                        const nextSizes = c.sizes.map((s: any) =>
                          s.name === variant.sizeName
                            ? { ...s, quantity: Math.max(0, (Number(s.quantity) || 0) - qty) }
                            : s
                        );
                        return {
                          ...c,
                          sizes: nextSizes,
                          quantity: nextSizes.reduce((sum: number, s: any) => sum + (Number(s.quantity) || 0), 0),
                        };
                      }
                      return { ...c, quantity: Math.max(0, (Number(c.quantity) || 0) - qty) };
                    });
                  } else if (variant?.sizeName && updatedSizes) {
                    updatedSizes = updatedSizes.map((s: any) =>
                      s.name === variant.sizeName
                        ? { ...s, quantity: Math.max(0, (Number(s.quantity) || 0) - qty) }
                        : s
                    );
                  }

                  return {
                    ...p,
                    stock: ns,
                    colors: updatedColors,
                    sizes: updatedSizes,
                    manualSold: p.manualSold + qty,
                    sold: p.sold + qty,
                    status: ns === 0 ? 'out' : ns < 15 ? 'low' : 'active',
                  };
                })
              );

              const variantLabel = [variant?.colorName, variant?.sizeName].filter(Boolean).join(' / ');
              const displayProductName = variantLabel ? `${product.name} (${variantLabel})` : product.name;

              setSellLog([
                {
                  id: `MS-${String(sellLog.length + 1).padStart(3, '0')}`,
                  product: displayProductName,
                  qty,
                  amount: total,
                  note: note || t.walkInSale,
                  date: t.justNow,
                  by: t.manager,
                },
                ...sellLog,
              ]);
              setToast(`✓ ${t.sold} ${qty} × ${displayProductName}`);

              try {
                await createSaleMutation.mutateAsync({
                  items: [
                    {
                      productId: product.id,
                      quantity: qty,
                      unitPrice: total / qty,
                      colorName: variant?.colorName,
                      sizeName: variant?.sizeName,
                    },
                  ],
                  branchId: (product as any).branchId ?? (product as any).inventories?.[0]?.warehouseId,
                  branchName: (product as any).branch ?? '',
                  note: note || undefined,
                  soldBy: 'Staff',
                });
                queryClient.invalidateQueries({ queryKey: ANALYTICS_QUERY_KEYS.overview() });
                queryClient.invalidateQueries({ queryKey: INVENTORY_QUERY_KEYS.all });
              } catch (err) {
                console.error('[ManualSale] API call failed — local state updated but server not synced:', err);
              }
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
