'use client';

import React, { useMemo, useRef, useState } from 'react';
import { Theme } from '@/modules/dashboard/utils/theme';
import { useResponsive } from '@/shared/hooks/useResponsive';
import { Card, Btn, Badge } from '@/shared/components/ui/Primitives';
import { NAV, SETTINGS_ITEMS } from '@/modules/dashboard/utils/constants';
import { useSecurityDevicesQuery, useRevokeDeviceMutation, useRevokeAllOtherDevicesMutation } from '@/modules/auth';
import {
  useListProducts,
  useUpdateProduct,
} from '@/modules/products';
import { useListBranches } from '@/modules/branches';
import { useListCategories } from '@/modules/categories';
import { toast } from 'react-hot-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { confirmDialog } from '@/shared/lib/confirmDialog';
import { useDashboardLocale } from '@/modules/dashboard/locales/DashboardLocaleContext';
import { useSession } from 'next-auth/react';
import apiClient from '@/shared/lib/apiClient';
import StaffFormView from '../../../auth/components/partials/StaffFormView';
import CustomerSettingsView from './CustomerSettingsView';
import GeneralSettingsTab from '../partials/GeneralSettingsTab';
import PaymentSettingsTab from '../partials/PaymentSettingsTab';
import ShippingSettingsTab from '../partials/ShippingSettingsTab';
import InventorySettingsTab from '../partials/InventorySettingsTab';
import NotificationSettingsTab from '../partials/NotificationSettingsTab';
import TrendingSettingsTab from '../partials/TrendingSettingsTab';
import DiscountsSettingsTab from '../partials/DiscountsSettingsTab';
import SecuritySettingsTab from '../partials/SecuritySettingsTab';
import AuditLogsSettingsTab from '../partials/AuditLogsSettingsTab';

import {
  usePromotions,
  useCreatePromotion,
  useUpdatePromotion,
  useTogglePromotion,
  useDeletePromotion,
} from '@/modules/promotions';
import type { Promotion as APIPromotion } from '@/modules/promotions';
import {
  useCoupons,
  useCreateCoupon,
  useUpdateCoupon,
  useToggleCoupon,
  useDeleteCoupon,
} from '@/modules/coupons';
import type { Coupon as APICoupon } from '@/modules/coupons';
import {
  homepageAPI,
  useHomepageStats,
  useSiteSettings,
  useCreatePaymentMethod,
  useUpdatePaymentMethod,
  useDeletePaymentMethod
} from '@/modules/homepage';

interface SettingsViewProps {
  products: any[];
  tab: string;
  setTab: (tab: string) => void;
}

type StaffStatus = 'active' | 'inactive';

// ─── Staff / User management types ───────────────────────────────────────────

interface StaffUser {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  typeId?: number;
  userType?: { id: number; name: string };
  isActive: boolean;
  createdAt: string;
  userModules?: Array<{ module: { id: number; code: string; name: string; icon?: string } }>;
}

interface StaffUserForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  typeId: string;
  isActive: boolean;
  moduleCodes: string[];
}

interface AvailableModule {
  id: number;
  code: string;
  name: string;
  icon?: string;
}

const EMPTY_STAFF_FORM: StaffUserForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  password: '',
  typeId: '',
  isActive: true,
  moduleCodes: [],
};

// ─── Legacy local-only types (kept for promotions/settings) ──────────────────

interface StaffMember {
  id: number;
  name: string;
  email: string;
  role: string;
  branch: string;
  status: StaffStatus;
}

interface SettingsState {
  storeName: string;
  primaryColor: string;
  currency: string;
  taxRate: number;
  timezone: string;
  lowStockThreshold: number;
  autoReserve: boolean;
  barcodeEnabled: boolean;
  sslStoreId: string;
  sslStoreSecret: string;
  refundDays: number;
  defaultShipping: number;
  freeShippingOver: number;
  deliveryEstimate: string;
  emailOrders: boolean;
  emailStock: boolean;
  emailNewCustomer: boolean;
  smsOrders: boolean;
  smsDelivery: boolean;
  storeLogo: string;
  acceptedPayments: {
    bkash: boolean;
    nagad: boolean;
    card: boolean;
    cash: boolean;
  };
  contactAddress: string;
  contactPhone: string;
  contactEmail: string;
  heroHeadline: string;
  heroYear: string;
  heroDescription: string;
}

const DASHBOARD_SETTINGS_KEY = 'mollari.dashboard.settings.v1';
const DASHBOARD_STAFF_KEY = 'mollari.dashboard.staff.v1';

const DEFAULT_SETTINGS: SettingsState = {
  storeName: 'Mollari',
  primaryColor: '#f01172',
  currency: 'BDT',
  taxRate: 15,
  timezone: 'Asia/Dhaka',
  lowStockThreshold: 15,
  autoReserve: true,
  barcodeEnabled: true,
  sslStoreId: 'mollari_store_01',
  sslStoreSecret: '',
  refundDays: 7,
  defaultShipping: 80,
  freeShippingOver: 1000,
  deliveryEstimate: '3-5 business days',
  emailOrders: true,
  emailStock: true,
  emailNewCustomer: false,
  smsOrders: false,
  smsDelivery: true,
  storeLogo: '',
  acceptedPayments: { bkash: true, nagad: true, card: true, cash: true },
  contactAddress: 'Dhaka, Bangladesh',
  contactPhone: '+880 1XXX-XXXXXX',
  contactEmail: 'hello@mollari.com',
  heroHeadline: 'Spring Beauty',
  heroYear: '2026',
  heroDescription: 'Discover luxurious skincare and makeup that celebrates your natural glow.',
};

const STAFF_LIST: StaffMember[] = [
  {
    id: 1,
    name: 'Karim Hossain',
    email: 'karim@mollari.com',
    role: 'Admin',
    branch: 'Dhaka Main',
    status: 'active',
  },
  {
    id: 2,
    name: 'Fatima Khanam',
    email: 'fatima@mollari.com',
    role: 'Staff',
    branch: 'Chittagong',
    status: 'active',
  },
  {
    id: 3,
    name: 'Raihan Ahmed',
    email: 'raihan@mollari.com',
    role: 'Staff',
    branch: 'Sylhet Outlet',
    status: 'inactive',
  },
];

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

const Toggle = ({ val, onToggle, label }: any) => (
  <div className="flex items-center justify-between border-b border-border py-3">
    <span className="text-[13px]" style={{ color: Theme.fg }}>
      {label}
    </span>
    <button
      onClick={onToggle}
      className="relative h-6 w-11 shrink-0 cursor-pointer rounded-full border-none transition-colors"
      style={{ background: val ? Theme.primary : Theme.border }}
    >
      <div
        className="absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.2)] transition-all"
        style={{ left: val ? 22 : 3 }}
      />
    </button>
  </div>
);

const categoryEmojis: any = {
  Skincare: '🧴',
  Lipstick: '💄',
  Foundation: '🌿',
  Eyewear: '👁️',
  Fragrance: '🌸',
};

export default function SettingsView({ products: _products, tab, setTab }: SettingsViewProps) {
  const { isMobile } = useResponsive();
  const { t } = useDashboardLocale();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const isAdmin = true; // Staff dashboard is already protected by middleware; role-based UI gating can be added once role values are confirmed

  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [filterBranchId, setFilterBranchId] = useState('');
  const [isHydrated, setIsHydrated] = useState(false);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const [newPaymentMethod, setNewPaymentMethod] = useState('');

  const { data: siteSettingsData } = useSiteSettings();
  const { data: homepageStatsData } = useHomepageStats();

  const { data: apiProducts = [], isLoading: isLoadingProducts } = useListProducts(
    {
      limit: 100,
      includeInactive: true, // Display everything in settings
      ...(filterBranchId ? { branchId: Number(filterBranchId) } : {})
    } as any,
    { queryKey: ['products', 'list', { branchId: filterBranchId, includeInactive: true }] }
  );
  const { data: branches = [] } = useListBranches();
  const { data: allCategories = [] } = useListCategories({ includeInactive: true } as any);

  // Security devices hooks
  const { data: securityDevices = [], isLoading: isLoadingSecurity } = useSecurityDevicesQuery();
  const revokeDeviceMutation = useRevokeDeviceMutation();
  const revokeAllOtherDevicesMutation = useRevokeAllOtherDevicesMutation();

  const updateProduct = useUpdateProduct();

  const createPaymentMethod = useCreatePaymentMethod();
  const updatePaymentMethod = useUpdatePaymentMethod();
  const deletePaymentMethod = useDeletePaymentMethod();


  // ─── Staff / User management ───────────────────────────────────────────────
  // These endpoints are pending backend implementation.
  // Set enabled: false until /auth/users and /auth/user-types are available.
  const { data: staffUsers = [], isLoading: isLoadingStaff, refetch: refetchStaff } = useQuery<StaffUser[]>({
    queryKey: ['auth', 'users'],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/auth/users', { params: { limit: 200 } });
        const raw: any[] = res.data?.data ?? res.data ?? [];
        return raw.filter((u: any) => {
          const typeName = (u.userType?.name || '').toLowerCase();
          return typeName !== 'customer' && typeName !== 'guest';
        });
      } catch {
        return [];
      }
    },
    enabled: true,
    staleTime: 2 * 60 * 1000,
    retry: false,
  });

  const { data: userTypes = [] } = useQuery<Array<{ id: number; name: string; code?: string }>>({
    queryKey: ['auth', 'user-types'],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/auth/user-types');
        return res.data?.data ?? res.data ?? [];
      } catch {
        return [];
      }
    },
    enabled: true,
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  // Static module list derived from NAV + SETTINGS_ITEMS — no API needed
  const availableModules: AvailableModule[] = React.useMemo(() => [
    ...NAV.map((n, i) => ({ id: i + 1, code: n.id, name: n.label, icon: n.icon })),
    ...SETTINGS_ITEMS.map((s, i) => ({
      id: NAV.length + i + 1,
      code: `settings:${s.id}`,
      name: `Settings › ${s.label}`,
      icon: s.icon,
    })),
  ], []);

  const createUserMutation = useMutation({
    mutationFn: (data: any) => apiClient.post('/auth/users', data).then((r) => r.data?.data ?? r.data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['auth', 'users'] }); },
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiClient.patch(`/auth/users/${id}`, data).then((r) => r.data?.data ?? r.data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['auth', 'users'] }); },
  });

  const updateUserModulesMutation = useMutation({
    mutationFn: ({ id, moduleCodes }: { id: number; moduleCodes: string[] }) =>
      apiClient.put(`/auth/users/${id}/modules`, { moduleCodes }).then((r) => r.data?.data ?? r.data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['auth', 'users'] }); },
  });

  const forceLogoutMutation = useMutation({
    mutationFn: (id: number) => apiClient.post(`/auth/users/${id}/force-logout`).then((r) => r.data),
  });

  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [staffForm, setStaffForm] = useState<StaffUserForm>(EMPTY_STAFF_FORM);
  const [staffSearch, setStaffSearch] = useState('');
  const [staffFormTab, setStaffFormTab] = useState<'details' | 'modules'>('details');
  const [staffFormView, setStaffFormView] = useState<'list' | 'new' | 'edit'>('list');
  const [staffEditId, setStaffEditId] = useState<number | null>(null);

  const openCreateUser = () => {
    setEditingUserId(null);
    setStaffForm(EMPTY_STAFF_FORM);
    setStaffFormTab('details');
    setStaffModalOpen(true);
  };

  const openEditUser = (user: StaffUser) => {
    setEditingUserId(user.id);
    setStaffForm({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone || '',
      password: '',
      typeId: user.userType?.id ? String(user.userType.id) : ((user as any).userTypeId ? String((user as any).userTypeId) : ''),
      isActive: user.isActive,
      moduleCodes: user.userModules?.map((um) => um.module.code) ?? [],
    });
    setStaffFormTab('details');
    setStaffModalOpen(true);
  };

  const handleSaveStaffUser = async () => {
    if (!staffForm.firstName.trim() || !staffForm.email.trim()) {
      toast.error('First name and email are required');
      return;
    }
    try {
      if (editingUserId !== null) {
        const payload: any = {
          firstName: staffForm.firstName.trim(),
          lastName: staffForm.lastName.trim(),
          phone: staffForm.phone.trim() || undefined,
          isActive: staffForm.isActive,
          ...(staffForm.typeId ? { typeId: Number(staffForm.typeId) } : {}),
        };
        if (staffForm.password.trim()) payload.password = staffForm.password.trim();
        await updateUserMutation.mutateAsync({ id: editingUserId, data: payload });
        await updateUserModulesMutation.mutateAsync({ id: editingUserId, moduleCodes: staffForm.moduleCodes });
        toast.success('User updated');
      } else {
        if (!staffForm.password.trim()) { toast.error('Password is required for new users'); return; }
        const created: any = await createUserMutation.mutateAsync({
          firstName: staffForm.firstName.trim(),
          lastName: staffForm.lastName.trim(),
          email: staffForm.email.trim(),
          phone: staffForm.phone.trim() || undefined,
          password: staffForm.password.trim(),
          isActive: staffForm.isActive,
          ...(staffForm.typeId ? { typeId: Number(staffForm.typeId) } : {}),
          moduleCodes: staffForm.moduleCodes,
        });
        toast.success('User created');
      }
      setStaffModalOpen(false);
    } catch {
      toast.error('Failed to save user');
    }
  };

  const handleToggleUserActive = async (user: StaffUser) => {
    try {
      await updateUserMutation.mutateAsync({ id: user.id, data: { isActive: !user.isActive } });
      toast.success(`User ${user.isActive ? 'deactivated' : 'activated'}`);
    } catch {
      toast.error('Failed to update user status');
    }
  };

  const handleForceLogout = async (user: StaffUser) => {
    const confirmed = await confirmDialog({
      title: 'Force Logout?',
      text: `Force logout ${user.firstName} ${user.lastName}? Their active session will be invalidated.`,
      confirmButtonText: 'Yes, force logout',
      icon: 'question',
    });
    if (!confirmed) return;
    try {
      await forceLogoutMutation.mutateAsync(user.id);
      toast.success('Session invalidated');
    } catch {
      toast.error('Force logout not available');
    }
  };

  const filteredStaffUsers = React.useMemo(() => {
    const q = staffSearch.trim().toLowerCase();
    if (!q) return staffUsers;
    return staffUsers.filter(
      (u) =>
        `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.userType?.name || '').toLowerCase().includes(q)
    );
  }, [staffUsers, staffSearch]);
  // ─── End staff management ───────────────────────────────────────────────────

  const updateSiteSettingsMutation = useMutation<any, any, any>({
    mutationFn: (data: any) => homepageAPI.updateSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homepage', 'settings'] });
    },
  });
  const updateHomepageStatsMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => homepageAPI.updateStats(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homepage', 'stats'] });
    },
  });

  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
  const [staff, setStaff] = useState<StaffMember[]>(STAFF_LIST);

  // Promotions — fully API-driven
  const { data: promotions = [], isLoading: isLoadingPromotions } = usePromotions();
  const createPromotionMut = useCreatePromotion();
  const updatePromotionMut = useUpdatePromotion();
  const togglePromotionMut = useTogglePromotion();
  const deletePromotionMut = useDeletePromotion();

  // Coupons — fully API-driven
  const { data: coupons = [], isLoading: isLoadingCoupons } = useCoupons();
  const createCouponMut = useCreateCoupon();
  const updateCouponMut = useUpdateCoupon();
  const toggleCouponMut = useToggleCoupon();
  const deleteCouponMut = useDeleteCoupon();

  const productsList = apiProducts;

  const [showPromotionEditor, setShowPromotionEditor] = useState(false);
  const [editingPromotionId, setEditingPromotionId] = useState<number | null>(null);
  const [promotionForm, setPromotionForm] = useState({
    label: '',
    pct: '',
    ends: '',
    banner: '',
    active: true,
    applyTo: 'ALL' as 'ALL' | 'PRODUCT' | 'CATEGORY',
    productIds: [] as number[],
    categoryId: '' as string | number,
    productSearch: '',
  });

  const [showCouponEditor, setShowCouponEditor] = useState(false);
  const [editingCouponId, setEditingCouponId] = useState<number | null>(null);
  const [couponForm, setCouponForm] = useState({
    code: '',
    description: '',
    type: 'FIXED' as 'FIXED' | 'PERCENTAGE',
    value: '',
    minOrderAmount: '',
    maxDiscountAmount: '',
    usageLimit: '',
    isActive: true,
    startsAt: '',
    expiresAt: '',
  });

  const [trendingSearch, setTrendingSearch] = useState('');
  const [trendingBranchId, setTrendingBranchId] = useState('');
  const [pendingFeaturedChanges, setPendingFeaturedChanges] = useState<Record<number, boolean>>({});

  const toggleProductFeatured = (productId: number, initiallyFeatured: boolean) => {
    setPendingFeaturedChanges(prev => {
      const currentVal = prev.hasOwnProperty(productId) ? prev[productId] : initiallyFeatured;
      const newVal = !currentVal;
      
      const next = { ...prev };
      if (newVal === initiallyFeatured) {
        delete next[productId];
      } else {
        next[productId] = newVal;
      }
      return next;
    });
  };



  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const storedSettings = window.localStorage.getItem(DASHBOARD_SETTINGS_KEY);
      if (storedSettings) {
        const parsed = JSON.parse(storedSettings) as Partial<SettingsState>;
        setSettings((prev) => ({ ...prev, ...parsed }));
      }

      const storedStaff = window.localStorage.getItem(DASHBOARD_STAFF_KEY);
      if (storedStaff) {
        const parsed = JSON.parse(storedStaff) as StaffMember[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setStaff(parsed);
        }
      }

      // Clean up legacy promotions localStorage (now API-driven)
      window.localStorage.removeItem('mouchak.dashboard.promotions.v1');
    } catch {
      toast.error('Unable to read saved settings from browser storage');
    } finally {
      setIsHydrated(true);
    }
  }, []);

  React.useEffect(() => {
    if (!siteSettingsData && !homepageStatsData) return;

    setSettings((prev) => ({
      ...prev,
      ...(siteSettingsData ? {
        storeName: siteSettingsData.storeName || prev.storeName,
        primaryColor: siteSettingsData.primaryColor || prev.primaryColor,
        contactAddress: siteSettingsData.contactAddress || prev.contactAddress,
        contactPhone: siteSettingsData.contactPhone || prev.contactPhone,
        contactEmail: siteSettingsData.contactEmail || prev.contactEmail,
        heroHeadline: siteSettingsData.heroHeadline || prev.heroHeadline,
        heroYear: siteSettingsData.heroYear || prev.heroYear,
        heroDescription: siteSettingsData.heroDescription || prev.heroDescription,
      } : {}),
      ...(homepageStatsData
        ? {
          freeShippingOver: homepageStatsData.minFreeDeliveryAmount ?? prev.freeShippingOver,
          deliveryEstimate: homepageStatsData.deliveryTimeframe || prev.deliveryEstimate,
        }
        : {}),
    }));
  }, [homepageStatsData, siteSettingsData]);

  React.useEffect(() => {
    if (!isHydrated || typeof window === 'undefined') return;
    window.localStorage.setItem(DASHBOARD_SETTINGS_KEY, JSON.stringify(settings));
  }, [isHydrated, settings]);

  React.useEffect(() => {
    if (!isHydrated || typeof window === 'undefined') return;
    window.localStorage.setItem(DASHBOARD_STAFF_KEY, JSON.stringify(staff));
  }, [isHydrated, staff]);

  const handleRevokeDevice = async (id: number) => {
    const confirmed = await confirmDialog({
      title: t.securityDevices.confirmRevokeDevice,
      text: t.securityDevices.confirmRevokeDeviceText,
      confirmButtonText: t.securityDevices.revokeSession,
      icon: 'warning',
    });
    if (!confirmed) return;
    try {
      await revokeDeviceMutation.mutateAsync(id);
      toast.success(t.securityDevices.deviceRevoked);
    } catch {
      toast.error('Failed to log out device');
    }
  };

  const handleRevokeAllOtherDevices = async () => {
    const confirmed = await confirmDialog({
      title: t.securityDevices.confirmRevokeAllOthers,
      text: t.securityDevices.confirmRevokeAllOthersText,
      confirmButtonText: t.securityDevices.revokeAllOthers,
      icon: 'warning',
    });
    if (!confirmed) return;
    try {
      await revokeAllOtherDevicesMutation.mutateAsync();
      toast.success(t.securityDevices.allOthersRevoked);
    } catch {
      toast.error('Failed to log out all other devices');
    }
  };

  const triggerSavedIndicator = () => {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  };

  const activePromotion = useMemo(
    () => promotions.find((p) => p.isActive) ?? null,
    [promotions]
  );

  const availableBranchNames = useMemo(() => {
    const dynamicBranchNames = branches.map((branch: any) => branch.name);
    if (dynamicBranchNames.length > 0) return dynamicBranchNames;
    return ['Dhaka Main', 'Chittagong', 'Sylhet Outlet'];
  }, [branches]);


  const handleLogoFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo must be under 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setSettings((prev) => ({ ...prev, storeLogo: String(reader.result || '') }));
      toast.success('Logo selected. Save to apply.');
    };
    reader.readAsDataURL(file);
  };

  const openPromotionEditor = (promotion?: APIPromotion) => {
    if (promotion) {
      setEditingPromotionId(promotion.id);
      setPromotionForm({
        label: promotion.label,
        pct: String(promotion.pct),
        ends: promotion.endsAt || '',
        banner: promotion.banner,
        active: promotion.isActive,
        applyTo: promotion.applyTo || 'ALL',
        productIds: promotion.productIds || [],
        categoryId: promotion.categoryId || '',
        productSearch: '',
      });
    } else {
      setEditingPromotionId(null);
      setPromotionForm({ label: '', pct: '', ends: '', banner: '', active: true, applyTo: 'ALL', productIds: [], categoryId: '', productSearch: '' });
    }
    setShowPromotionEditor(true);
  };

  const handleSavePromotion = async () => {
    if (!promotionForm.label.trim()) {
      toast.error('Promotion name is required');
      return;
    }
    if (!promotionForm.banner.trim()) {
      toast.error('Banner text is required');
      return;
    }

    const percentage = Number(promotionForm.pct);
    if (!Number.isFinite(percentage) || percentage <= 0 || percentage > 95) {
      toast.error('Discount percentage must be between 1 and 95');
      return;
    }

    // Validate scope
    if (promotionForm.applyTo === 'PRODUCT' && promotionForm.productIds.length === 0) {
      toast.error('Please select at least one product');
      return;
    }
    if (promotionForm.applyTo === 'CATEGORY' && !promotionForm.categoryId) {
      toast.error('Please select a category');
      return;
    }

    try {
      const payload: any = {
        label: promotionForm.label.trim(),
        banner: promotionForm.banner.trim(),
        pct: Math.round(percentage),
        endsAt: promotionForm.ends.trim() || undefined,
        isActive: promotionForm.active,
        applyTo: promotionForm.applyTo,
        productIds: promotionForm.applyTo === 'PRODUCT' ? promotionForm.productIds : [],
        categoryId: promotionForm.applyTo === 'CATEGORY' ? Number(promotionForm.categoryId) : null,
      };

      if (editingPromotionId !== null) {
        await updatePromotionMut.mutateAsync({ id: editingPromotionId, ...payload });
      } else {
        await createPromotionMut.mutateAsync(payload);
      }

      setShowPromotionEditor(false);
      setEditingPromotionId(null);
      toast.success('Promotion saved');
    } catch {
      toast.error('Failed to save promotion');
    }
  };

  const handleTogglePromotionActive = async (id: number) => {
    try {
      await togglePromotionMut.mutateAsync(id);
    } catch {
      toast.error('Failed to toggle promotion');
    }
  };

  const openCouponEditor = (coupon?: APICoupon) => {
    if (coupon) {
      setEditingCouponId(coupon.id);
      setCouponForm({
        code: coupon.code,
        description: coupon.description || '',
        type: coupon.type,
        value: String(coupon.value),
        minOrderAmount: coupon.minOrderAmount ? String(coupon.minOrderAmount) : '',
        maxDiscountAmount: coupon.maxDiscountAmount ? String(coupon.maxDiscountAmount) : '',
        usageLimit: coupon.usageLimit ? String(coupon.usageLimit) : '',
        isActive: coupon.isActive,
        startsAt: coupon.startsAt ? coupon.startsAt.split('T')[0] : '',
        expiresAt: coupon.expiresAt ? coupon.expiresAt.split('T')[0] : '',
      });
    } else {
      setEditingCouponId(null);
      setCouponForm({
        code: '',
        description: '',
        type: 'FIXED',
        value: '',
        minOrderAmount: '',
        maxDiscountAmount: '',
        usageLimit: '',
        isActive: true,
        startsAt: '',
        expiresAt: '',
      });
    }
    setShowCouponEditor(true);
  };

  const handleSaveCoupon = async () => {
    if (!couponForm.code.trim()) {
      toast.error('Coupon code is required');
      return;
    }

    const value = Number(couponForm.value);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error('Discount value must be a positive number');
      return;
    }

    if (couponForm.type === 'PERCENTAGE' && value > 100) {
      toast.error('Percentage cannot exceed 100');
      return;
    }

    try {
      const payload: any = {
        code: couponForm.code.trim().toUpperCase(),
        description: couponForm.description.trim() || undefined,
        type: couponForm.type,
        value,
        isActive: couponForm.isActive,
      };

      if (couponForm.minOrderAmount) {
        payload.minOrderAmount = Number(couponForm.minOrderAmount);
      }
      if (couponForm.maxDiscountAmount) {
        payload.maxDiscountAmount = Number(couponForm.maxDiscountAmount);
      }
      if (couponForm.usageLimit) {
        payload.usageLimit = Number(couponForm.usageLimit);
      }
      if (couponForm.startsAt) {
        payload.startsAt = new Date(couponForm.startsAt).toISOString();
      }
      if (couponForm.expiresAt) {
        payload.expiresAt = new Date(couponForm.expiresAt).toISOString();
      }

      if (editingCouponId !== null) {
        await updateCouponMut.mutateAsync({ id: editingCouponId, ...payload });
      } else {
        await createCouponMut.mutateAsync(payload);
      }

      setShowCouponEditor(false);
      setEditingCouponId(null);
      toast.success('Coupon saved');
    } catch {
      toast.error('Failed to save coupon');
    }
  };

  const handleToggleCouponActive = async (id: number) => {
    try {
      await toggleCouponMut.mutateAsync(id);
    } catch {
      toast.error('Failed to toggle coupon');
    }
  };

  const handleResetCurrentTab = () => {
    if (tab === 'general') {
      setSettings((prev) => ({
        ...prev,
        storeName: siteSettingsData?.storeName || DEFAULT_SETTINGS.storeName,
        primaryColor: siteSettingsData?.primaryColor || DEFAULT_SETTINGS.primaryColor,
        currency: DEFAULT_SETTINGS.currency,
        taxRate: DEFAULT_SETTINGS.taxRate,
        timezone: DEFAULT_SETTINGS.timezone,
        contactAddress: siteSettingsData?.contactAddress || DEFAULT_SETTINGS.contactAddress,
        contactPhone: siteSettingsData?.contactPhone || DEFAULT_SETTINGS.contactPhone,
        contactEmail: siteSettingsData?.contactEmail || DEFAULT_SETTINGS.contactEmail,
        heroHeadline: siteSettingsData?.heroHeadline || DEFAULT_SETTINGS.heroHeadline,
        heroYear: siteSettingsData?.heroYear || DEFAULT_SETTINGS.heroYear,
        heroDescription: siteSettingsData?.heroDescription || DEFAULT_SETTINGS.heroDescription,
        storeLogo: '',
      }));
    }

    if (tab === 'payment') {
      setSettings((prev) => ({
        ...prev,
        sslStoreId: DEFAULT_SETTINGS.sslStoreId,
        sslStoreSecret: DEFAULT_SETTINGS.sslStoreSecret,
        refundDays: DEFAULT_SETTINGS.refundDays,
        acceptedPayments: DEFAULT_SETTINGS.acceptedPayments,
      }));
    }

    if (tab === 'shipping') {
      setSettings((prev) => ({
        ...prev,
        defaultShipping: DEFAULT_SETTINGS.defaultShipping,
        freeShippingOver: homepageStatsData?.minFreeDeliveryAmount || DEFAULT_SETTINGS.freeShippingOver,
        deliveryEstimate: homepageStatsData?.deliveryTimeframe || DEFAULT_SETTINGS.deliveryEstimate,
      }));
    }

    if (tab === 'inventory') {
      setSettings((prev) => ({
        ...prev,
        lowStockThreshold: DEFAULT_SETTINGS.lowStockThreshold,
        autoReserve: DEFAULT_SETTINGS.autoReserve,
        barcodeEnabled: DEFAULT_SETTINGS.barcodeEnabled,
      }));
    }

    if (tab === 'notifications') {
      setSettings((prev) => ({
        ...prev,
        emailOrders: DEFAULT_SETTINGS.emailOrders,
        emailStock: DEFAULT_SETTINGS.emailStock,
        emailNewCustomer: DEFAULT_SETTINGS.emailNewCustomer,
        smsOrders: DEFAULT_SETTINGS.smsOrders,
        smsDelivery: DEFAULT_SETTINGS.smsDelivery,
      }));
    }

    if (tab === 'trending') {
      setPendingFeaturedChanges({});
      toast.success('Reset trending product selections');
      return;
    }

    if (tab === 'staff') {
      setStaff(STAFF_LIST);
    }

    toast.success('Current tab reset');
  };

  const handleSave = async (targetTab: string = tab) => {
    try {
      setIsSaving(true);

      if (targetTab === 'general') {
        await updateSiteSettingsMutation.mutateAsync({
          storeName: settings.storeName.trim() || DEFAULT_SETTINGS.storeName,
          primaryColor: settings.primaryColor || DEFAULT_SETTINGS.primaryColor,
          contactAddress: settings.contactAddress || DEFAULT_SETTINGS.contactAddress,
          contactPhone: settings.contactPhone || DEFAULT_SETTINGS.contactPhone,
          contactEmail: settings.contactEmail || DEFAULT_SETTINGS.contactEmail,
          heroHeadline: settings.heroHeadline || DEFAULT_SETTINGS.heroHeadline,
          heroYear: settings.heroYear || DEFAULT_SETTINGS.heroYear,
          heroDescription: settings.heroDescription || DEFAULT_SETTINGS.heroDescription,
        });
      }

      if (targetTab === 'shipping') {
        await updateHomepageStatsMutation.mutateAsync({
          minFreeDeliveryAmount: Number(settings.freeShippingOver) || 0,
          deliveryTimeframe: settings.deliveryEstimate || DEFAULT_SETTINGS.deliveryEstimate,
        });
      }

      if (targetTab === 'discounts') {
        // Sync the active promotion to homepage_stats for the storefront
        await updateHomepageStatsMutation.mutateAsync({
          currentOfferText: activePromotion?.banner || '',
          currentOfferPercentage: activePromotion?.pct || 0,
          isOfferActive: Boolean(activePromotion),
          minFreeDeliveryAmount: Number(settings.freeShippingOver) || 0,
          deliveryTimeframe: settings.deliveryEstimate || DEFAULT_SETTINGS.deliveryEstimate,
        });
      }

      if (targetTab === 'trending') {
        const changeEntries = Object.entries(pendingFeaturedChanges);
        if (changeEntries.length > 0) {
          await Promise.all(
            changeEntries.map(([idStr, isFeatured]) =>
              updateProduct.mutateAsync({
                id: Number(idStr),
                isFeatured,
              } as any)
            )
          );
          setPendingFeaturedChanges({});
        }
        toast.success('Featured products published');
      } else if (targetTab === 'discounts') {
        toast.success('Promotions published');
      } else {
        toast.success('Settings saved');
      }

      triggerSavedIndicator();
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const currentLabel = SETTINGS_ITEMS.find((i) => i.id === tab)?.label || '';

  const panels: any = {
    general: (
      <GeneralSettingsTab
        settings={settings}
        setSettings={setSettings}
        logoInputRef={logoInputRef}
        handleLogoFileChange={handleLogoFileChange}
        t={t}
        isMobile={isMobile}
      />
    ),
    payment: (
      <PaymentSettingsTab
        settings={settings}
        setSettings={setSettings}
        newPaymentMethod={newPaymentMethod}
        setNewPaymentMethod={setNewPaymentMethod}
        homepageStatsData={homepageStatsData}
        createPaymentMethod={createPaymentMethod}
        updatePaymentMethod={updatePaymentMethod}
        deletePaymentMethod={deletePaymentMethod}
        t={t}
        isMobile={isMobile}
      />
    ),
    shipping: (
      <ShippingSettingsTab
        settings={settings}
        setSettings={setSettings}
        t={t}
        isMobile={isMobile}
      />
    ),
    inventory: (
      <InventorySettingsTab
        settings={settings}
        setSettings={setSettings}
        t={t}
        isMobile={isMobile}
      />
    ),
    notifications: (
      <NotificationSettingsTab
        settings={settings}
        setSettings={setSettings}
        t={t}
      />
    ),
    staff: (
      <div>
        {!isAdmin ? (
          <div className="rounded-xl border p-6 text-center text-sm font-semibold" style={{ borderColor: Theme.border, color: Theme.mutedFg }}>
            {t.settings.adminOnly}
          </div>
        ) : staffFormView !== 'list' ? (
          <StaffFormView
            userId={staffFormView === 'edit' ? staffEditId : null}
            onBack={() => { setStaffFormView('list'); refetchStaff(); }}
          />
        ) : (
          <>
            {/* Toolbar */}
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  value={staffSearch}
                  onChange={(e) => setStaffSearch(e.target.value)}
                  placeholder={t.settings.searchStaff}
                  className={`${inputClass} w-full sm:w-auto`}
                  style={{ maxWidth: isMobile ? '100%' : 280 }}
                />
                <div className="text-[13px] whitespace-nowrap" style={{ color: Theme.mutedFg }}>
                  {isLoadingStaff ? 'Loading…' : `${filteredStaffUsers.length} ${filteredStaffUsers.length !== 1 ? t.settings.users : t.settings.user}`}
                </div>
                <Btn variant="ghost" size="sm" onClick={() => refetchStaff()}>↻ {t.ecommerce.refresh}</Btn>
              </div>
              <Btn variant="primary" size="sm" className="w-full sm:w-auto justify-center" onClick={() => setStaffFormView('new')}>{t.settings.addUser}</Btn>
            </div>

            {/* User list */}
            {isLoadingStaff ? (
              <div className="py-8 text-center text-sm" style={{ color: Theme.mutedFg }}>Loading users…</div>
            ) : filteredStaffUsers.length === 0 ? (
              <div className="py-8 text-center text-sm" style={{ color: Theme.mutedFg }}>{t.settings.noStaffFound}</div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {filteredStaffUsers.map((u) => {
                  const initials = `${u.firstName[0] ?? ''}${u.lastName?.[0] ?? ''}`.toUpperCase();
                  const typeName = u.userType?.name || '—';
                  return (
                    <div key={u.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-[10px] border border-border bg-white px-[14px] py-3 transition" style={{ opacity: u.isActive ? 1 : 0.55 }}>
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-extrabold" style={{ background: Theme.secondary, color: Theme.primary }}>{initials || '?'}</div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold" style={{ color: Theme.fg }}>{u.firstName} {u.lastName}</span>
                            {!u.isActive && <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-gray-500">{t.settings.inactive}</span>}
                          </div>
                          <div className="text-[11px]" style={{ color: Theme.mutedFg }}>
                            {u.email}
                            {u.userModules && u.userModules.length > 0 && <span className="ml-2 opacity-70">· {u.userModules.length} {t.settings.modules}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 pt-2.5 sm:pt-0 border-t sm:border-t-0 border-gray-100 sm:justify-end">
                        <Badge label={typeName} bg={Theme.secondary} color={Theme.primary} />
                        <Btn variant="ghost" size="sm" onClick={() => { setStaffEditId(u.id); setStaffFormView('edit'); }}>{t.settings.edit}</Btn>
                        <Btn variant="ghost" size="sm" onClick={() => handleToggleUserActive(u)}>{u.isActive ? t.settings.deactivate : t.settings.activate}</Btn>
                        <Btn variant="ghost" size="sm" onClick={() => handleForceLogout(u)}>{t.settings.forceLogout}</Btn>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    ),
    trending: (
      <TrendingSettingsTab
        trendingSearch={trendingSearch}
        setTrendingSearch={setTrendingSearch}
        trendingBranchId={trendingBranchId}
        setTrendingBranchId={setTrendingBranchId}
        isLoadingProducts={isLoadingProducts}
        productsList={productsList}
        branches={branches}
        t={t}
        pendingFeaturedChanges={pendingFeaturedChanges}
        toggleProductFeatured={toggleProductFeatured}
      />
    ),
    discounts: (
      <DiscountsSettingsTab
        showPromotionEditor={showPromotionEditor}
        setShowPromotionEditor={setShowPromotionEditor}
        editingPromotionId={editingPromotionId}
        setEditingPromotionId={setEditingPromotionId}
        promotionForm={promotionForm}
        setPromotionForm={setPromotionForm}
        isLoadingPromotions={isLoadingPromotions}
        promotions={promotions}
        deletePromotionMut={deletePromotionMut}
        openPromotionEditor={openPromotionEditor}
        handleSavePromotion={handleSavePromotion}
        handleTogglePromotionActive={handleTogglePromotionActive}
        productsList={productsList}
        categories={allCategories}
        showCouponEditor={showCouponEditor}
        setShowCouponEditor={setShowCouponEditor}
        editingCouponId={editingCouponId}
        setEditingCouponId={setEditingCouponId}
        couponForm={couponForm}
        setCouponForm={setCouponForm}
        isLoadingCoupons={isLoadingCoupons}
        coupons={coupons}
        deleteCouponMut={deleteCouponMut}
        openCouponEditor={openCouponEditor}
        handleSaveCoupon={handleSaveCoupon}
        handleToggleCouponActive={handleToggleCouponActive}
        t={t}
        isMobile={isMobile}
      />
    ),
    customers: (
      <CustomerSettingsView />
    ),
    security: (
      <SecuritySettingsTab
        securityDevices={securityDevices}
        isLoadingSecurity={isLoadingSecurity}
        handleRevokeDevice={handleRevokeDevice}
        handleRevokeAllOtherDevices={handleRevokeAllOtherDevices}
        t={t}
      />
    ),
    audit: (
      <AuditLogsSettingsTab t={t} />
    ),
  };

  return (
    <div className="flex flex-col gap-4">
      {isMobile && (
        <select
          value={tab}
          onChange={(e) => setTab(e.target.value)}
          className="w-full cursor-pointer rounded-[10px] border border-border bg-white px-[14px] py-2.5 text-sm font-semibold text-foreground outline-none"
        >
          {SETTINGS_ITEMS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      )}

      <Card className={`${isMobile ? 'p-[18px]' : 'p-7'}`}>
        {tab !== 'staff' && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
            <div className="text-base font-bold" style={{ color: Theme.fg }}>
              {currentLabel}
            </div>
            {['trending', 'discounts'].includes(tab) && (
              <div className="flex items-center gap-2">
                {saved && (
                  <span className="text-xs font-semibold" style={{ color: Theme.success }}>
                    {t.settings.saved}
                  </span>
                )}
                <Btn variant="primary" size="sm" onClick={() => handleSave(tab)}>
                  {isSaving ? t.settings.saving : t.settings.saveAndPublish}
                </Btn>
              </div>
            )}
          </div>
        )}

        {panels[tab] || (
          <div className="text-[13px]" style={{ color: Theme.mutedFg }}>
            {t.settings.selectSetting}
          </div>
        )}

        {!['products', 'categories', 'trending', 'discounts', 'staff', 'customers', 'security', 'audit'].includes(tab) && (
          <div className="mt-8 flex items-center justify-end gap-2 border-t border-border pt-6">
            <div className="flex items-center gap-2">
              {saved && (
                <span className="text-xs font-semibold" style={{ color: Theme.success }}>
                  {t.settings.saved}
                </span>
              )}
              <Btn variant="ghost" size="sm" onClick={handleResetCurrentTab}>
                {t.settings.reset}
              </Btn>
              <Btn variant="primary" size="sm" onClick={() => handleSave(tab)}>
                {isSaving ? t.settings.saving : t.settings.saveChanges}
              </Btn>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
