import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Theme } from '@/modules/dashboard/utils/theme';
import { SETTINGS_ITEMS } from '@/modules/dashboard/utils/constants';
import { useDashboardLocale } from '../locales/DashboardLocaleContext';
import { useSiteSettings } from '@/modules/homepage/queries';

interface SidebarProps {
  activeNav: string;
  settingsOpen: boolean;
  settingsTab: string;
  navigate: (id: string, settingsTabId?: string) => void;
  setSettingsTab: (id: string) => void;
  setSettingsOpen: (open: boolean) => void;
  lowCount: number;
  time: Date;
  isMobile: boolean;
  setSidebarOpen: (open: boolean) => void;
  navItems: { id: string; label: string; icon: string; badge?: string }[];
  userModuleCodes: Set<string> | null;
}

export function Sidebar({
  activeNav,
  settingsOpen,
  settingsTab,
  navigate,
  setSettingsTab,
  setSettingsOpen,
  lowCount,
  time,
  isMobile,
  setSidebarOpen,
  navItems,
  userModuleCodes,
}: SidebarProps) {
  const settingsRef = useRef<HTMLDivElement>(null);
  const { t } = useDashboardLocale();
  const { data: settings } = useSiteSettings();
  const storeName = settings?.storeName || 'Mollari';

  useEffect(() => {
    if (settingsOpen && settingsRef.current) {
      setTimeout(() => {
        settingsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    }
  }, [settingsOpen]);

  return (
    <>
      {/* Logo */}
      <div
        className="shrink-0 px-5 pb-3 pt-4"
        style={{ borderBottom: `1px solid ${Theme.border}` }}
      >
        <div className="flex items-center justify-between">
          <Link href="/" className="no-underline cursor-pointer hover:opacity-80 transition-opacity">
            <div
              style={{
                fontSize: 22,
                fontWeight: 900,
                color: Theme.primary,
                letterSpacing: '-0.02em',
              }}
            >
              {storeName}
            </div>
            <div
              style={{
                fontSize: 10,
                color: Theme.mutedFg,
                fontWeight: 600,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
              className="mt-0.5"
            >
              {t.sidebar.brandSub}
            </div>
          </Link>
          {isMobile && (
            <button
              onClick={() => setSidebarOpen(false)}
              className="cursor-pointer border-0 bg-transparent p-0 text-[20px] leading-none"
              style={{ color: Theme.mutedFg }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-0.5 px-3 py-2 overflow-y-auto">
        {navItems.map((n) => {
          const isSettings = n.id === 'settings';
          const active = activeNav === n.id;

          if (isSettings) {
            return (
              <div key="settings" ref={settingsRef}>
                <button
                  onClick={() => {
                    navigate('settings');
                    setSettingsOpen(!settingsOpen);
                  }}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-xl border-0 px-3.5 py-2.5 text-left text-[13.5px] transition-all duration-200"
                  style={{
                    background: active ? Theme.secondary : 'transparent',
                    color: active ? Theme.primary : Theme.mutedFg,
                    fontWeight: active ? 700 : 500,
                  }}
                >
                  <span style={{ fontSize: 16 }}>⚙️</span>
                  <span className="flex-1">{t.sidebar.settings}</span>
                  <motion.span
                    animate={{ rotate: settingsOpen ? 90 : 0 }}
                    transition={{ duration: 0.2 }}
                    style={{
                      fontSize: 16,
                      fontWeight: 800,
                      color: active ? Theme.primary : Theme.mutedFg,
                    }}
                    className="inline-block"
                  >
                    ›
                  </motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {settingsOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <div
                        className="mb-1 ml-3 border-l-2 pl-2 pt-1"
                        style={{ borderLeftColor: Theme.border }}
                      >
                        {SETTINGS_ITEMS.filter((item) => {
                          if (item.id === 'security') return true;
                          if (!userModuleCodes) return true;
                          return userModuleCodes.has(`settings:${item.id}`);
                        }).map((item) => {
                          const localizedLabel = (t.settingsItems as any)[item.id] || item.label;
                          const subActive = active && settingsTab === item.id;
                          return (
                            <button
                              key={item.id}
                              onClick={() => {
                                setSettingsTab(item.id);
                                navigate('settings', item.id);
                                if (isMobile) setSidebarOpen(false);
                              }}
                              className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg border-0 px-3 py-2 text-left text-[13px] transition-colors duration-150"
                              style={{
                                background: subActive ? `${Theme.primary}12` : 'transparent',
                                color: subActive ? Theme.primary : Theme.fg,
                                fontWeight: subActive ? 700 : 400,
                              }}
                            >
                              <span className="shrink-0 text-sm">{item.icon}</span>
                              <span>{localizedLabel}</span>
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          }

          return (
            <button
              key={n.id}
              onClick={() => {
                navigate(n.id);
                if (isMobile) setSidebarOpen(false);
              }}
              className="relative flex w-full cursor-pointer items-center gap-3 rounded-xl border-0 px-3.5 py-2.5 text-left text-[13.5px] transition-all duration-200"
              style={{
                background: active ? Theme.secondary : 'transparent',
                color: active ? Theme.primary : Theme.mutedFg,
                fontWeight: active ? 700 : 500,
              }}
            >
              {active && (
                <motion.div
                  layoutId="nav-active-pill"
                  className="absolute inset-0 rounded-xl"
                  style={{ background: Theme.secondary }}
                  transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                />
              )}
              <span className="relative" style={{ fontSize: 16 }}>{n.icon}</span>
              <span className="relative flex-1">{n.label}</span>
              {n.id === 'inventory' && lowCount > 0 && (
                <span
                  className="relative rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                  style={{ background: Theme.warning }}
                >
                  {lowCount}
                </span>
              )}
              {n.badge && (
                <span
                  className="relative rounded-full px-2 py-0.5 text-[10px] font-semibold"
                  style={{ background: Theme.muted, color: Theme.mutedFg }}
                >
                  {n.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Clock */}
      <div className="shrink-0 px-5 py-4" style={{ borderTop: `1px solid ${Theme.border}` }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: Theme.fg }}>
          {time.toLocaleTimeString('en-BD', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })}
        </div>
        <div className="mt-0.5" style={{ fontSize: 11, color: Theme.mutedFg }}>
          {time.toLocaleDateString('en-BD', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          })}
        </div>
      </div>
    </>
  );
}
