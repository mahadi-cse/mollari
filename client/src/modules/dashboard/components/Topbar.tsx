import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, LogOut } from 'lucide-react';
import { Theme } from '@/modules/dashboard/utils/theme';
import { useDashboardLocale } from '../locales/DashboardLocaleContext';
import { useProfileQuery } from '@/modules/auth';

interface TopbarProps {
  isMobile: boolean;
  setSidebarOpen: (open: boolean) => void;
  topbarLabel: string;
  navigate: (id: string) => void;
  handleLogout: () => void;
}

export function Topbar({
  isMobile,
  setSidebarOpen,
  topbarLabel,
  navigate,
  handleLogout,
}: TopbarProps) {
  const { locale, t, toggleLocale } = useDashboardLocale();
  const { data: profileUser } = useProfileQuery();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    };
    if (profileOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [profileOpen]);

  const userInitials = profileUser?.name
    ? profileUser.name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((w: string) => w.charAt(0).toUpperCase())
        .join('')
    : 'U';

  return (
    <header
      className={`sticky top-0 z-10 flex shrink-0 items-center justify-between ${isMobile ? 'h-[52px] px-4' : 'h-[58px] px-8'}`}
      style={{
        background: Theme.card,
        borderBottom: `1px solid ${Theme.border}`,
      }}
    >
      <div className="flex items-center gap-2.5">
        {isMobile && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex cursor-pointer flex-col gap-1 border-0 bg-transparent p-1"
          >
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-0.5 w-5 rounded-sm"
                style={{ background: Theme.fg }}
              />
            ))}
          </button>
        )}
        {!isMobile && (
          <>
            <span style={{ fontSize: 12, color: Theme.mutedFg }}>{t.topbar.dashboard}</span>
            <span style={{ color: Theme.border }}>›</span>
          </>
        )}
        <span
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: Theme.fg,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          className={isMobile ? 'max-w-40' : undefined}
        >
          {topbarLabel}
        </span>
      </div>
      <div className={`flex items-center ${isMobile ? 'gap-[10px]' : 'gap-4'}`}>
        {/* Language Toggle */}
        <button
          onClick={toggleLocale}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
          style={{
            background: locale === 'bn' ? Theme.primary : Theme.secondary,
            color: locale === 'bn' ? '#fff' : Theme.fg,
            border: `1px solid ${locale === 'bn' ? Theme.primary : Theme.border}`,
          }}
          title={locale === 'en' ? 'বাংলায় পরিবর্তন করুন' : 'Switch to English'}
        >
          <span style={{ fontSize: 14 }}>🌐</span>
          <span>{locale === 'en' ? 'বাংলা' : 'English'}</span>
        </button>

        {/* Profile Dropdown */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2.5 px-2 py-1.5 shrink-0 cursor-pointer rounded-full transition-all duration-200 hover:shadow-md"
            style={{
              background: Theme.secondary,
              border: `1px solid ${Theme.border}`,
            }}
            title="User Profile"
          >
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-extrabold overflow-hidden"
              style={{ background: Theme.primary, color: 'white' }}
            >
              {profileUser?.avatarUrl ? (
                <img
                  src={profileUser.avatarUrl}
                  alt={profileUser.name || 'User'}
                  className="h-full w-full object-cover"
                  onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                />
              ) : (
                userInitials
              )}
            </div>
            {!isMobile && (
              <span className="text-[13px] font-bold pr-1.5" style={{ color: Theme.fg }}>
                {profileUser?.name || 'User'}
              </span>
            )}
          </button>

          {/* Profile Dropdown Menu */}
          <AnimatePresence>
            {profileOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="absolute right-0 top-full mt-3 w-64 rounded-xl shadow-2xl z-50 overflow-hidden"
                style={{ background: Theme.card, border: `1px solid ${Theme.border}` }}
              >
                {/* User Header */}
                <div
                  className="px-6 py-5 border-b text-center"
                  style={{
                    borderColor: Theme.border,
                    background: `linear-gradient(180deg, ${Theme.secondary}25 0%, transparent 100%)`,
                  }}
                >
                  <div className="flex flex-col items-center gap-2.5">
                    <div
                      className="flex h-18 w-18 items-center justify-center rounded-full text-[24px] font-black text-white shadow-md overflow-hidden cursor-pointer transition hover:opacity-90"
                      onClick={() => { navigate('profile'); setProfileOpen(false); }}
                      style={{
                        background: `linear-gradient(135deg, ${Theme.primary} 0%, ${Theme.primary}dd 100%)`,
                        border: `3px solid ${Theme.card}`,
                      }}
                      title="View account"
                    >
                      {profileUser?.avatarUrl ? (
                        <img
                          src={profileUser.avatarUrl}
                          alt={profileUser.name || 'User'}
                          className="h-full w-full object-cover"
                          onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                        />
                      ) : (
                        <span>{userInitials}</span>
                      )}
                    </div>
                    <div className="space-y-0.5">
                      <div className="text-[15px] font-bold tracking-tight" style={{ color: Theme.fg }}>
                        {profileUser?.name || t.profile.user}
                      </div>
                      {profileUser?.email && (
                        <div className="text-[11px] font-normal truncate max-w-[210px]" style={{ color: Theme.mutedFg }}>
                          {profileUser.email}
                        </div>
                      )}
                      <div className="pt-1">
                        <span
                          className="inline-block text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border"
                          style={{
                            background: Theme.primary + '15',
                            color: Theme.primary,
                            borderColor: Theme.primary + '30',
                          }}
                        >
                          {profileUser?.role || t.profile.administrator}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex gap-3 px-5 py-4" style={{ background: Theme.card }}>
                  <button
                    onClick={() => { navigate('profile'); setProfileOpen(false); }}
                    className="flex-1 px-3 py-2.5 rounded-xl text-center text-[12px] font-bold transition-all flex items-center justify-center gap-2 hover:-translate-y-0.5"
                    style={{
                      background: Theme.secondary + '40',
                      color: Theme.primary,
                      border: `1px solid ${Theme.secondary}`,
                    }}
                  >
                    <User size={15} strokeWidth={2.5} />
                    <span>{t.profile.account}</span>
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex-1 px-3 py-2.5 rounded-xl text-center text-[12px] font-bold transition-all flex items-center justify-center gap-2 hover:-translate-y-0.5"
                    style={{
                      background: '#fff1f2',
                      color: '#e11d48',
                      border: '1px solid #ffe4e6',
                    }}
                  >
                    <LogOut size={15} strokeWidth={2.5} />
                    <span>{t.profile.logout}</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
