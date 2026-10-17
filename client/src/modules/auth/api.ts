import { apiClient } from '@/shared/lib/apiClient';
import type { UserProfile } from './types';

function formatRole(role?: string): string {
  if (!role) return 'User';
  const map: Record<string, string> = {
    SYSTEM_ADMIN: 'System Admin',
    ADMIN: 'Admin',
    MANAGER: 'Manager',
    SALES_STAFF: 'Sales Staff',
    CASHIER: 'Cashier',
    RIDER: 'Rider',
    CUSTOMER: 'Customer',
  };
  const upper = role.toUpperCase();
  if (map[upper]) return map[upper];
  return role
    .split(/[_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export const authAPI = {
  getProfile: async (): Promise<UserProfile> => {
    const res = await apiClient.get('/auth/profile');
    const data = res.data.data;
    const computedName =
      [data.firstName, data.lastName].filter(Boolean).join(' ').trim() ||
      data.name ||
      data.fullName ||
      data.username ||
      data.email?.split('@')[0] ||
      'User';

    const rawRole =
      data.userRoles?.[0]?.role?.name ||
      data.userType?.name ||
      data.role ||
      'USER';

    return {
      id: data.id,
      name: computedName,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      address: data.address,
      avatarUrl: data.avatarUrl || data.profileImage || undefined,
      role: formatRole(rawRole),
      userType: data.userType,
    };
  },
  getSecurityDevices: async (): Promise<any[]> => {
    const res = await apiClient.get('/auth/security-devices');
    return res.data.data;
  },
  revokeDevice: async (id: number): Promise<void> => {
    await apiClient.post(`/auth/security-devices/${id}/revoke`);
  },
  revokeAllOtherDevices: async (): Promise<void> => {
    await apiClient.post('/auth/security-devices/revoke-all-others');
  },
};
