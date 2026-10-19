'use client';

import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Card, Btn } from '@/shared/components/ui/Primitives';
import apiClient from '@/shared/lib/apiClient';
import { NAV, SETTINGS_ITEMS } from '@/modules/dashboard/utils/constants';
import { useDashboardLocale } from '@/modules/dashboard/locales/DashboardLocaleContext';

const P = '#e91e8c';
const S = '#fdf2f8';
const FG = '#18181b';
const MFG = '#71717a';
const BD = '#e4e4e7';

interface Props {
  userId?: number | null;
  onBack: () => void;
}

interface UserData {
  id: number; firstName: string; lastName: string; email: string;
  phone?: string | null; isActive: boolean; userTypeId?: number;
  userType?: { id: number; code: string; name: string };
  userModules?: Array<{ module: { id: number; code: string; name: string; icon?: string } }>;
  userBranches?: Array<{ branch: { id: number; name: string }; isPrimary: boolean }>;
}

type Tab = 'info' | 'modules' | 'branches';

const ic = 'w-full box-border rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[13px] text-zinc-900 outline-none focus:border-pink-400';
const sc = `${ic} cursor-pointer`;
const lc = 'mb-1 block text-[11px] font-semibold text-zinc-600';

const MODS = [
  ...NAV.map((n, i) => ({ id: i + 1, code: n.id, name: n.label, icon: n.icon })),
  ...SETTINGS_ITEMS.map((s, i) => ({ id: NAV.length + i + 1, code: `settings:${s.id}`, name: `Settings › ${s.label}`, icon: s.icon })),
];

export default function StaffFormView({ userId, onBack }: Props) {
  const qc = useQueryClient();
  const isEdit = !!userId;
  const [tab, setTab] = useState<Tab>('info');
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', password: '', typeId: '', isActive: true });
  const [showPassword, setShowPassword] = useState(false);
  const [mods, setMods] = useState<string[]>([]);
  const [brIds, setBrIds] = useState<number[]>([]);
  const [primaryBr, setPrimaryBr] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: userData, isLoading } = useQuery<UserData | null>({
    queryKey: ['auth', 'user', userId],
    queryFn: async () => {
      const res = await apiClient.get('/auth/users', { params: { limit: 500 } });
      const users: UserData[] = res.data?.data ?? res.data ?? [];
      return users.find((u) => u.id === userId) || null;
    },
    enabled: isEdit,
  });

  const { data: userTypes = [] } = useQuery<Array<{ id: number; name: string }>>({
    queryKey: ['auth', 'user-types'],
    queryFn: async () => { const r = await apiClient.get('/auth/user-types'); return r.data?.data ?? r.data ?? []; },
    staleTime: 10 * 60 * 1000,
  });

  const { data: branches = [] } = useQuery<Array<{ id: number; name: string }>>({
    queryKey: ['branches'],
    queryFn: async () => { const r = await apiClient.get('/branches'); return r.data?.data ?? r.data ?? []; },
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!userData) return;
    setForm({
      firstName: userData.firstName || '', lastName: userData.lastName || '',
      email: userData.email || '', phone: userData.phone || '', password: '',
      typeId: userData.userType?.id ? String(userData.userType.id) : '',
      isActive: userData.isActive,
    });
    setMods(userData.userModules?.map((um: any) => um.module.code) ?? []);
    const ubs = userData.userBranches ?? [];
    setBrIds(ubs.map((ub: any) => ub.branch.id));
    setPrimaryBr(ubs.find((ub: any) => ub.isPrimary)?.branch.id ?? null);
  }, [userData]);

  const createMut = useMutation({ mutationFn: (d: any) => apiClient.post('/auth/users', d).then((r) => r.data?.data ?? r.data) });
  const updateMut = useMutation({ mutationFn: ({ id, data }: { id: number; data: any }) => apiClient.patch(`/auth/users/${id}`, data).then((r) => r.data?.data ?? r.data) });
  const modsMut = useMutation({ mutationFn: ({ id, moduleCodes }: { id: number; moduleCodes: string[] }) => apiClient.put(`/auth/users/${id}/modules`, { moduleCodes }).then((r) => r.data) });
  const brMut = useMutation({ mutationFn: ({ id, branchIds, primaryBranchId }: { id: number; branchIds: number[]; primaryBranchId: number | null }) => apiClient.put(`/auth/users/${id}/branches`, { branchIds, primaryBranchId }).then((r) => r.data) });

  const handleSave = async () => {
    if (!form.firstName.trim() || !form.email.trim()) { toast.error('First name and email required'); return; }
    if (!isEdit && !form.password.trim()) { toast.error('Password required'); return; }
    setSaving(true);
    try {
      let tid = userId;
      if (isEdit && tid) {
        const p: any = { firstName: form.firstName.trim(), lastName: form.lastName.trim(), phone: form.phone.trim() || undefined, isActive: form.isActive, ...(form.typeId ? { typeId: Number(form.typeId) } : {}) };
        if (form.password.trim()) p.password = form.password.trim();
        await updateMut.mutateAsync({ id: tid, data: p });
      } else {
        const c: any = await createMut.mutateAsync({ firstName: form.firstName.trim(), lastName: form.lastName.trim(), email: form.email.trim(), phone: form.phone.trim() || undefined, password: form.password.trim(), isActive: form.isActive, ...(form.typeId ? { typeId: Number(form.typeId) } : {}) });
        tid = c?.id;
      }
      if (tid) {
        await modsMut.mutateAsync({ id: tid, moduleCodes: mods });
        await brMut.mutateAsync({ id: tid, branchIds: brIds, primaryBranchId: primaryBr }).catch(() => {});
      }
      qc.invalidateQueries({ queryKey: ['auth', 'users'] });
      toast.success(isEdit ? 'User updated' : 'User created');
      onBack();
    } catch (err: any) { toast.error(err?.response?.data?.message || 'Failed to save'); } finally { setSaving(false); }
  };

  if (isEdit && isLoading) return <div className="py-8 text-center text-sm" style={{ color: MFG }}>Loading user…</div>;

  const tabs: { id: Tab; label: string }[] = [{ id: 'info', label: '👤 Info' }, { id: 'modules', label: '🧩 Modules' }, { id: 'branches', label: '🏪 Branches' }];

  return (
    <div>
      {/* Header bar */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="rounded-lg border px-3 py-1.5 text-xs font-semibold" style={{ borderColor: BD, color: MFG, background: '#fff', cursor: 'pointer' }}>← Back</button>
          <span className="text-sm font-bold" style={{ color: FG }}>{isEdit ? 'Edit User' : 'New User'}</span>
        </div>
        <button onClick={handleSave} disabled={saving} className="rounded-lg px-5 py-2 text-xs font-bold text-white disabled:opacity-50" style={{ background: P, border: 'none', cursor: 'pointer' }}>
          {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create User'}
        </button>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 rounded-lg border p-1" style={{ borderColor: BD, background: '#fafafa' }}>
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className="flex-1 rounded-md py-2 text-xs font-semibold transition" style={{ background: tab === t.id ? '#fff' : 'transparent', color: tab === t.id ? P : MFG, boxShadow: tab === t.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', border: 'none', cursor: 'pointer' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Info tab — compact grid, no scroll */}
      {tab === 'info' && (
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lc}>First Name *</label><input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className={ic} placeholder="First name" /></div>
          <div><label className={lc}>Last Name</label><input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className={ic} placeholder="Last name" /></div>
          <div><label className={lc}>Email *</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={ic} placeholder="user@company.com" disabled={isEdit} style={{ opacity: isEdit ? 0.6 : 1 }} /></div>
          <div><label className={lc}>Phone</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={ic} placeholder="+880..." /></div>
          <div>
            <label className={lc}>{isEdit ? 'New Password' : 'Password *'}</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className={`${ic} pr-9`}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-zinc-400 hover:text-zinc-600 transition-colors"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          <div><label className={lc}>User Type *</label><select value={form.typeId} onChange={(e) => setForm({ ...form, typeId: e.target.value })} className={sc}><option value="">— Select —</option>{(userTypes as any[]).map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
          <div><label className={lc}>Status</label><select value={form.isActive ? 'active' : 'inactive'} onChange={(e) => setForm({ ...form, isActive: e.target.value === 'active' })} className={sc}><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
        </div>
      )}

      {/* Modules tab — compact checkboxes in grid */}
      {tab === 'modules' && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold" style={{ color: MFG }}>{mods.length}/{MODS.length} selected</span>
            <div className="flex gap-2">
              <button onClick={() => setMods(MODS.map((m) => m.code))} className="text-[11px] font-semibold" style={{ color: P, background: 'none', border: 'none', cursor: 'pointer' }}>All</button>
              <button onClick={() => setMods([])} className="text-[11px] font-semibold" style={{ color: MFG, background: 'none', border: 'none', cursor: 'pointer' }}>Clear</button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {MODS.map((m) => {
              const on = mods.includes(m.code);
              return (
                <label key={m.code} className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-[12px] transition" style={{ borderColor: on ? P : BD, background: on ? S : '#fff' }}>
                  <input type="checkbox" checked={on} onChange={() => setMods((p) => on ? p.filter((c) => c !== m.code) : [...p, m.code])} style={{ accentColor: P }} className="h-3.5 w-3.5" />
                  <span>{m.icon}</span>
                  <span className="truncate font-medium" style={{ color: FG }}>{m.name}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Branches tab */}
      {tab === 'branches' && (
        <div>
          {branches.length === 0 ? (
            <div className="py-6 text-center text-sm" style={{ color: MFG }}>No branches found.</div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {(branches as any[]).map((b: any) => {
                const on = brIds.includes(b.id);
                const ip = primaryBr === b.id;
                return (
                  <div key={b.id} className="flex items-center gap-2 rounded-lg border px-3 py-2.5" style={{ borderColor: on ? P : BD, background: on ? S : '#fff' }}>
                    <input type="checkbox" checked={on} onChange={() => { if (on) { setBrIds((p) => p.filter((i) => i !== b.id)); if (ip) setPrimaryBr(null); } else { setBrIds((p) => [...p, b.id]); } }} style={{ accentColor: P }} className="h-3.5 w-3.5" />
                    <span className="flex-1 truncate text-[13px] font-medium" style={{ color: FG }}>{b.name}</span>
                    {on && (
                      <button onClick={() => setPrimaryBr(ip ? null : b.id)} className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: ip ? P : BD, color: ip ? '#fff' : MFG, border: 'none', cursor: 'pointer' }}>
                        {ip ? '★' : 'Primary'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
