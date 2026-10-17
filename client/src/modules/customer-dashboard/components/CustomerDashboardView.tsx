'use client';

import React, { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useCustomerDashboardProfile, useCustomerDashboardSummary } from '@/modules/customer-dashboard';
import { DESIGN } from '../tokens';
import Link from 'next/link';
import { useSiteSettings } from '@/modules/homepage/queries';

// Tab components — each owns its own queries and local state
import OverviewTab  from './tabs/OverviewTab';
import ProfileTab   from './tabs/ProfileTab';
import OrdersTab    from './tabs/OrdersTab';
import WishlistTab  from './tabs/WishlistTab';
import TrackingTab  from './tabs/TrackingTab';
import ReturnsTab   from './tabs/ReturnsTab';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CustomerNavId = 'overview' | 'profile' | 'order' | 'wishlist' | 'order-tracking' | 'returns';

const VALID_TABS: CustomerNavId[] = ['overview', 'profile', 'order', 'wishlist', 'order-tracking', 'returns'];

const NAV_ITEMS: Array<{ id: CustomerNavId; label: string; icon: string }> = [
  { id: 'overview',       label: 'Overview',       icon: '🏠' },
  { id: 'profile',        label: 'Profile',         icon: '👤' },
  { id: 'order',          label: 'Orders',          icon: '🧾' },
  { id: 'wishlist',       label: 'Wishlist',        icon: '💖' },
  { id: 'order-tracking', label: 'Order Tracking',  icon: '📦' },
  { id: 'returns',        label: 'Returns',         icon: '🔄' },
];

// ---------------------------------------------------------------------------
// Sidebar (shared between desktop aside and mobile drawer)
// ---------------------------------------------------------------------------

function Sidebar({
  activeNav,
  onNavigate,
  onClose,
}: {
  activeNav: CustomerNavId;
  onNavigate: (id: CustomerNavId) => void;
  onClose?: () => void;
}) {
  const { data: settings } = useSiteSettings();
  const storeName = settings?.storeName || 'Mollari';

  return (
    <>
      {/* Logo */}
      <div className="px-5 pb-4 pt-5" style={{ borderBottom: `1px solid ${DESIGN.border}` }}>
        <Link href="/" className="block no-underline select-none group">
          <div className="transition group-hover:text-pink-600" style={{ fontSize: 20, fontWeight: 900, color: DESIGN.primary, letterSpacing: '-0.02em' }}>
            {storeName}
          </div>
          <div className="mt-0.5" style={{ fontSize: 10, color: DESIGN.mutedFg, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Customer Dashboard
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-2 py-3">
        {NAV_ITEMS.map((item) => {
          const isActive = activeNav === item.id;
          return (
            <button
              key={item.id}
              onClick={() => { onNavigate(item.id); onClose?.(); }}
              className="flex w-full items-center gap-3 rounded-[10px] border-0 px-3 py-[11px] text-left text-[14px] transition"
              style={{
                background: isActive ? DESIGN.softPink : 'transparent',
                color:      isActive ? DESIGN.primary  : DESIGN.mutedFg,
                fontWeight: isActive ? 700 : 500,
                cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 15 }}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Bottom link */}
      <div style={{ padding: '12px 8px', borderTop: `1px solid ${DESIGN.border}` }}>
        <a href="/"
          className="flex w-full items-center gap-3 rounded-[10px] px-3 py-[11px] text-[14px] transition"
          style={{ color: DESIGN.mutedFg, fontWeight: 500 }}>
          <span style={{ fontSize: 15 }}>🛍️</span>
          <span>Back to Shop</span>
        </a>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function CustomerDashboardView() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const { data: session } = useSession();
  const { data: settings } = useSiteSettings();
  const storeName = settings?.storeName || 'Mollari';

  const profileQuery = useCustomerDashboardProfile();
  const summaryQuery = useCustomerDashboardSummary();

  const tabParam   = searchParams?.get('tab') as CustomerNavId | null;
  const initialTab: CustomerNavId = tabParam && VALID_TABS.includes(tabParam) ? tabParam : 'overview';

  const [activeNav,      setActiveNav]      = useState<CustomerNavId>(initialTab);
  const [sidebarOpen,    setSidebarOpen]    = useState(false);
  const [profileOpen,    setProfileOpen]    = useState(false);
  // Lifted tracking order id so Overview can deep-link into Tracking tab
  const [trackingOrderId, setTrackingOrderId] = useState<number | undefined>();
  const profileRef = React.useRef<HTMLDivElement>(null);

  // Close profile dropdown on outside click
  React.useEffect(() => {
    if (!profileOpen) return;
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [profileOpen]);

  const navigate = (id: CustomerNavId, trackOrderId?: number) => {
    setActiveNav(id);
    setSidebarOpen(false);
    if (trackOrderId !== undefined) setTrackingOrderId(trackOrderId);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', id);
    void router.replace(url.pathname + url.search, { scroll: false });
  };

  const renderTab = () => {
    switch (activeNav) {
      case 'overview':       return <OverviewTab onNavigate={navigate} />;
      case 'profile':        return <ProfileTab />;
      case 'order':          return <OrdersTab  onTrack={(id) => navigate('order-tracking', id)} />;
      case 'wishlist':       return <WishlistTab />;
      case 'order-tracking': return <TrackingTab initialOrderId={trackingOrderId} onOrderIdChange={setTrackingOrderId} />;
      case 'returns':        return <ReturnsTab />;
      default:               return null;
    }
  };

  const displayName = profileQuery.data
    ? `${profileQuery.data.firstName} ${profileQuery.data.lastName}`.trim()
    : session?.user?.name || 'Customer';
  const initials = displayName.charAt(0).toUpperCase() || 'U';
  const segment  = profileQuery.data?.segment || summaryQuery.data?.segment;

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{
        background: 'radial-gradient(circle at 10% 0%, rgba(243,200,220,0.28), transparent 32%), linear-gradient(180deg, #faf7f9 0%, #f6f0f3 100%)',
        color: DESIGN.fg,
        fontFamily: "var(--font-geist-sans), 'Segoe UI', system-ui, sans-serif",
      }}
    >
      {/* Desktop sidebar */}
      <aside
        className="hidden w-64 shrink-0 flex-col border-r md:flex"
        style={{ borderColor: DESIGN.border, background: DESIGN.card }}
      >
        <Sidebar activeNav={activeNav} onNavigate={navigate} />
      </aside>

      {/* Mobile sidebar drawer */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
          <aside
            className="fixed left-0 top-0 z-50 flex h-full w-64 flex-col border-r md:hidden"
            style={{ borderColor: DESIGN.border, background: DESIGN.card }}
          >
            <div className="flex items-center justify-between px-5 pb-4 pt-5" style={{ borderBottom: `1px solid ${DESIGN.border}` }}>
              <Link href="/" className="block no-underline select-none group">
                <div className="transition group-hover:text-pink-600" style={{ fontSize: 20, fontWeight: 900, color: DESIGN.primary, letterSpacing: '-0.02em' }}>
                  {storeName}
                </div>
                <div className="mt-0.5" style={{ fontSize: 10, color: DESIGN.mutedFg, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Customer Dashboard
                </div>
              </Link>
              <button
                onClick={() => setSidebarOpen(false)}
                className="border-0 bg-transparent text-xl"
                style={{ color: DESIGN.mutedFg, cursor: 'pointer' }}
                aria-label="Close sidebar"
              >
                ✕
              </button>
            </div>
            <Sidebar activeNav={activeNav} onNavigate={navigate} onClose={() => setSidebarOpen(false)} />
          </aside>
        </>
      )}

      {/* Main */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <header
          className="flex items-center justify-between border-b px-4 py-3 md:px-6"
          style={{ borderColor: DESIGN.border, background: DESIGN.card }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border md:hidden"
              style={{ borderColor: DESIGN.border, color: DESIGN.fg, background: DESIGN.card, cursor: 'pointer' }}
              aria-label="Open sidebar"
            >
              ☰
            </button>
            <div>
              <p className="text-lg font-black" style={{ color: DESIGN.fg }}>Customer Dashboard</p>
              <p className="text-xs" style={{ color: DESIGN.mutedFg }}>Welcome to your account space</p>
            </div>
          </div>

          {/* Profile dropdown */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setProfileOpen((o) => !o)}
              className="flex items-center gap-2 rounded-full px-1.5 py-1 transition-all hover:shadow-md"
              style={{ background: DESIGN.softPink, border: `1px solid ${DESIGN.border}`, cursor: 'pointer' }}
              title="Account"
            >
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-extrabold text-white"
                style={{ background: DESIGN.primary }}
              >
                {initials}
              </div>
              <span className="hidden pr-1 text-[13px] font-bold md:block" style={{ color: DESIGN.fg }}>
                {displayName}
              </span>
            </button>

            {profileOpen && (
              <div
                className="absolute right-0 top-full z-50 mt-3 w-64 overflow-hidden rounded-2xl shadow-2xl"
                style={{ background: DESIGN.card, border: `1px solid ${DESIGN.border}` }}
              >
                <div
                  className="border-b px-6 py-5 text-center"
                  style={{ borderColor: DESIGN.border, background: `linear-gradient(180deg, ${DESIGN.softPink} 0%, transparent 100%)` }}
                >
                  <div className="flex flex-col items-center gap-2">
                    <div
                      className="flex h-16 w-16 items-center justify-center rounded-full text-2xl font-black text-white shadow-lg"
                      style={{
                        background: `linear-gradient(135deg, ${DESIGN.primary} 0%, ${DESIGN.primaryDark} 100%)`,
                        border: `3px solid ${DESIGN.card}`,
                      }}
                    >
                      {initials}
                    </div>
                    <div>
                      <p className="text-[15px] font-bold" style={{ color: DESIGN.fg }}>{displayName}</p>
                      <p className="text-[11px]"           style={{ color: DESIGN.mutedFg }}>
                        {profileQuery.data?.email || session?.user?.email || ''}
                      </p>
                      {segment && (
                        <span
                          className="mt-1.5 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest"
                          style={{ background: DESIGN.softPink, color: DESIGN.primary }}
                        >
                          {segment}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 px-5 py-4">
                  <button
                    onClick={() => { navigate('profile'); setProfileOpen(false); }}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[12px] font-bold transition-all hover:-translate-y-0.5"
                    style={{ background: DESIGN.softPink, color: DESIGN.primary, border: `1px solid ${DESIGN.border}` }}
                  >
                    <span>👤</span><span>Profile</span>
                  </button>
                  <button
                    onClick={() => signOut({ callbackUrl: '/' })}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[12px] font-bold transition-all hover:-translate-y-0.5"
                    style={{ background: '#fff1f2', color: '#e11d48', border: '1px solid #ffe4e6' }}
                  >
                    <span>🚪</span><span>Logout</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Active tab content */}
        <section className="flex-1 overflow-auto p-4 md:p-6">
          {renderTab()}
        </section>
      </main>
    </div>
  );
}
