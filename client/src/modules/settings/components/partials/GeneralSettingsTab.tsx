import React from 'react';
import { Theme } from '@/modules/dashboard/utils/theme';
import { Btn } from '@/shared/components/ui/Primitives';

export interface GeneralSettingsTabProps {
  settings: any;
  setSettings: (s: any) => void;
  logoInputRef: React.RefObject<HTMLInputElement | null>;
  handleLogoFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  t: any;
  isMobile: boolean;
}

const inputClass =
  'w-full box-border rounded-lg border border-border bg-white px-[14px] py-2.5 text-[13px] text-foreground outline-none';
const selectClass = `${inputClass} cursor-pointer`;
const labelClass = 'mb-1.5 block text-xs font-semibold text-foreground';

const FormSection = ({ title, children }: any) => (
  <div className="mb-6">
    <div
      className="mb-3 border-b-2 pb-2 text-sm font-bold"
      style={{ color: Theme.fg, borderBottomColor: Theme.secondary }}
    >
      {title}
    </div>
    {children}
  </div>
);

export default function GeneralSettingsTab({
  settings,
  setSettings,
  logoInputRef,
  handleLogoFileChange,
  t,
  isMobile,
}: GeneralSettingsTabProps) {
  return (
    <div>
      <FormSection title={t.settings.storeIdentity}>
        <div className={`mb-[14px] grid gap-[14px] ${isMobile ? 'grid-cols-1' : 'grid-cols-2'}`}>
          <div>
            <label className={labelClass}>{t.settings.storeName}</label>
            <input
              value={settings.storeName}
              onChange={(e) => setSettings({ ...settings, storeName: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Primary Brand Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="h-9 w-12 cursor-pointer rounded border border-border p-1 outline-none animate-none"
                value={settings.primaryColor}
                onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
              />
              <input
                value={settings.primaryColor}
                onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                className={inputClass}
              />
              <Btn
                variant="secondary"
                size="sm"
                className="h-9 whitespace-nowrap"
                onClick={() => setSettings({ ...settings, primaryColor: '#f01172' })}
              >
                Reset
              </Btn>
            </div>
          </div>
          <div>
            <label className={labelClass}>{t.settings.currency}</label>
            <select
              value={settings.currency}
              onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
              className={selectClass}
            >
              <option value="BDT">BDT — Bangladeshi Taka (৳)</option>
              <option value="USD">USD — US Dollar ($)</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>{t.settings.taxRate}</label>
            <input
              type="number"
              value={settings.taxRate}
              onChange={(e) => setSettings({ ...settings, taxRate: Number(e.target.value) })}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>{t.settings.timezone}</label>
            <select
              value={settings.timezone}
              onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
              className={selectClass}
            >
              <option value="Asia/Dhaka">Asia/Dhaka (GMT +6:00)</option>
              <option value="UTC">UTC (GMT +0:00)</option>
            </select>
          </div>
        </div>

        <div className="mt-4 grid gap-[14px] grid-cols-1 md:grid-cols-3">
          <div>
            <label className={labelClass}>Contact Address</label>
            <input
              value={settings.contactAddress}
              onChange={(e) => setSettings({ ...settings, contactAddress: e.target.value })}
              className={inputClass}
              placeholder="e.g. Dhaka, Bangladesh"
            />
          </div>
          <div>
            <label className={labelClass}>Contact Phone</label>
            <input
              value={settings.contactPhone}
              onChange={(e) => setSettings({ ...settings, contactPhone: e.target.value })}
              className={inputClass}
              placeholder="e.g. +880 1XXX-XXXXXX"
            />
          </div>
          <div>
            <label className={labelClass}>Contact Email</label>
            <input
              value={settings.contactEmail}
              onChange={(e) => setSettings({ ...settings, contactEmail: e.target.value })}
              className={inputClass}
              placeholder="e.g. hello@mollari.com"
            />
          </div>
        </div>

        <div className="mt-8 border-t border-border pt-8">
          <h4 className="mb-4 text-[13px] font-bold uppercase tracking-widest text-zinc-400">Hero Section Content</h4>
          <div className="grid gap-[14px] grid-cols-1 md:grid-cols-2">
            <div>
              <label className={labelClass}>Hero Headline</label>
              <input
                value={settings.heroHeadline}
                onChange={(e) => setSettings({ ...settings, heroHeadline: e.target.value })}
                className={inputClass}
                placeholder="e.g. Spring Beauty"
              />
            </div>
            <div>
              <label className={labelClass}>Hero Year / Sub-label</label>
              <input
                value={settings.heroYear}
                onChange={(e) => setSettings({ ...settings, heroYear: e.target.value })}
                className={inputClass}
                placeholder="e.g. 2026"
              />
            </div>
          </div>
          <div className="mt-4">
            <label className={labelClass}>Hero Description</label>
            <textarea
              value={settings.heroDescription}
              onChange={(e) => setSettings({ ...settings, heroDescription: e.target.value })}
              className={`${inputClass} min-h-[80px] py-3`}
              placeholder="Describe your collection..."
            />
          </div>
        </div>
        
        <div className="mt-8 border-t border-border pt-8">
          <label className={labelClass}>{t.settings.storeLogo}</label>
          <div
            onClick={() => logoInputRef.current?.click()}
            className="cursor-pointer rounded-[10px] border-2 border-dashed border-border px-5 py-5 text-center"
            style={{ background: Theme.muted }}
          >
            {settings.storeLogo ? (
              <img src={settings.storeLogo} alt="Store logo preview" className="mx-auto mb-2 h-16 w-16 rounded-lg object-cover" />
            ) : (
              <div className="mb-1.5 text-2xl">🖼️</div>
            )}
            <div className="text-[13px]" style={{ color: Theme.mutedFg }}>
              {settings.storeLogo ? t.settings.clickToReplaceLogo : t.settings.clickToUploadLogo}
            </div>
          </div>
          <input ref={logoInputRef} type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp" onChange={handleLogoFileChange} className="hidden" />
        </div>
      </FormSection>
    </div>
  );
}
