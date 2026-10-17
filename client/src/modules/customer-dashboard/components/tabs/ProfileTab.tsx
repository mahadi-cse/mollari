import React, { useEffect, useState } from 'react';
import { DESIGN } from '../../tokens';
import { toDateLabel, toDateInputValue, SectionContainer, LoadingState, ErrorState } from '../shared';
import {
  useCustomerDashboardProfile,
  useUpdateCustomerDashboardProfile,
  type CustomerDashboardProfile,
  type UpdateProfilePayload,
} from '@/modules/customer-dashboard';
import { useQueryClient } from '@tanstack/react-query';
import { PROFILE_QUERY_KEY } from '@/modules/auth/queries/useProfileQuery';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ProfileDraft = {
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  dateOfBirth: string;
  gender: string;
  defaultAddress: string;
  city: string;
  postalCode: string;
  country: string;
  avatarUrl: string;
};

const EMPTY_DRAFT: ProfileDraft = {
  firstName: '', lastName: '', phone: '', address: '',
  dateOfBirth: '', gender: '', defaultAddress: '',
  city: '', postalCode: '', country: 'Bangladesh',
  avatarUrl: '',
};

const toProfileDraft = (profile: CustomerDashboardProfile): ProfileDraft => ({
  firstName:      profile.firstName      || '',
  lastName:       profile.lastName       || '',
  phone:          profile.phone          || '',
  address:        profile.address        || '',
  dateOfBirth:    toDateInputValue(profile.dateOfBirth),
  gender:         profile.gender         || '',
  defaultAddress: profile.defaultAddress || '',
  city:           profile.city           || '',
  postalCode:     profile.postalCode     || '',
  country:        profile.country        || 'Bangladesh',
  avatarUrl:      profile.avatarUrl      || '',
});

const hasChanges = (draft: ProfileDraft, profile?: CustomerDashboardProfile) => {
  if (!profile) return false;
  return JSON.stringify(draft) !== JSON.stringify(toProfileDraft(profile));
};

// ---------------------------------------------------------------------------
// Input / Textarea primitives (keep styling consistent)
// ---------------------------------------------------------------------------

const inputCls = 'mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none transition focus:border-[#e91e8c] focus:ring-4 focus:ring-pink-100';
const inputStyle = { borderColor: DESIGN.border, color: DESIGN.fg };

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ProfileTab() {
  const profileQuery        = useCustomerDashboardProfile();
  const [draft, setDraft]   = useState<ProfileDraft>(EMPTY_DRAFT);
  const [dirty, setDirty]   = useState(false);
  const [notice, setNotice] = useState('');
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (profileQuery.data && !dirty) {
      setDraft(toProfileDraft(profileQuery.data));
    }
  }, [profileQuery.data, dirty]);

  const updateMutation = useUpdateCustomerDashboardProfile({
    onSuccess: () => { setDirty(false); setNotice('Profile updated successfully.'); },
    onError:   () => { setNotice('Failed to update profile. Please try again.'); },
  });

  if (profileQuery.isLoading) return <LoadingState message="Loading your profile details..." />;
  if (profileQuery.isError || !profileQuery.data) return <ErrorState message="Unable to load profile information." />;

  const profile = profileQuery.data;
  const canSave = hasChanges(draft, profile) && !updateMutation.isPending;

  const change = (field: keyof ProfileDraft, value: string) => {
    setNotice('');
    setDirty(true);
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const save = () => {
    const payload: UpdateProfilePayload = {
      firstName:      draft.firstName.trim(),
      lastName:       draft.lastName.trim(),
      phone:          draft.phone.trim(),
      address:        draft.address.trim(),
      dateOfBirth:    draft.dateOfBirth,
      gender:         draft.gender.trim(),
      defaultAddress: draft.defaultAddress.trim(),
      city:           draft.city.trim(),
      postalCode:     draft.postalCode.trim(),
      country:        draft.country.trim() || 'Bangladesh',
      avatarUrl:      draft.avatarUrl,
    };
    updateMutation.mutate(payload);
  };

  return (
    <SectionContainer>
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <div className="relative group">
            <div
              className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full text-xl font-bold shadow-sm border-2"
              style={{ background: DESIGN.softPink, color: DESIGN.primary, borderColor: DESIGN.primary }}
            >
              {draft.avatarUrl ? (
                <img src={draft.avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                profile.firstName?.charAt(0).toUpperCase() || profile.email?.charAt(0).toUpperCase() || 'U'
              )}
            </div>
            {/* Edit Badge */}
            <div className="absolute bottom-0 right-0 bg-white border-2 border-white rounded-full p-1 shadow-md z-10 pointer-events-none" style={{ color: DESIGN.primary }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>
            </div>
            <label
              className="absolute inset-0 z-20 flex cursor-pointer items-center justify-center rounded-full bg-black/40 text-xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100"
              htmlFor="avatar-upload"
            >
              {uploading ? '...' : 'Upload'}
            </label>
            <input
              id="avatar-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setUploading(true);
                try {
                  const formData = new FormData();
                  formData.append('image', file);
                  const { apiClient } = await import('@/shared/lib/apiClient');
                  const res = await apiClient.post('/uploads/image?folder=mollari/users', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                  });
                  change('avatarUrl', res.data.data.url);
                  setNotice('Avatar uploaded. Remember to save.');
                  queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEY });
                } catch (err) {
                  setNotice('Failed to upload image.');
                } finally {
                  setUploading(false);
                  e.target.value = '';
                }
              }}
            />
          </div>
          <div>
            <p className="text-xl font-bold" style={{ color: DESIGN.fg }}>
              {profile.firstName} {profile.lastName}
            </p>
            <p className="text-sm" style={{ color: DESIGN.mutedFg }}>{profile.email}</p>
          </div>
        </div>
        <span
          className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em]"
          style={{ background: DESIGN.softPink, color: DESIGN.primary }}
        >
          {profile.segment}
        </span>
      </div>

      {/* Form grid */}
      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        {([
          { label: 'First Name', field: 'firstName', placeholder: 'First name' },
          { label: 'Last Name',  field: 'lastName',  placeholder: 'Last name'  },
          { label: 'Phone',      field: 'phone',     placeholder: 'Phone number'},
          { label: 'Gender',     field: 'gender',    placeholder: 'Gender'     },
        ] as { label: string; field: keyof ProfileDraft; placeholder: string }[]).map(({ label, field, placeholder }) => (
          <label key={field} className="text-sm">
            <span style={{ color: DESIGN.mutedFg }}>{label}</span>
            <input
              value={draft[field]}
              onChange={(e) => change(field, e.target.value)}
              className={inputCls}
              style={inputStyle}
              placeholder={placeholder}
            />
          </label>
        ))}

        <label className="text-sm">
          <span style={{ color: DESIGN.mutedFg }}>Date of Birth</span>
          <input
            type="date"
            value={draft.dateOfBirth}
            onChange={(e) => change('dateOfBirth', e.target.value)}
            className={inputCls}
            style={inputStyle}
          />
        </label>

        <label className="text-sm">
          <span style={{ color: DESIGN.mutedFg }}>City</span>
          <input
            value={draft.city}
            onChange={(e) => change('city', e.target.value)}
            className={inputCls}
            style={inputStyle}
            placeholder="City"
          />
        </label>

        <label className="text-sm md:col-span-2">
          <span style={{ color: DESIGN.mutedFg }}>Address</span>
          <textarea
            value={draft.address}
            onChange={(e) => change('address', e.target.value)}
            rows={2}
            className={inputCls}
            style={{ ...inputStyle, resize: 'none', fontFamily: 'inherit' }}
            placeholder="Primary address"
          />
        </label>

        <label className="text-sm md:col-span-2">
          <span style={{ color: DESIGN.mutedFg }}>Default Delivery Address</span>
          <textarea
            value={draft.defaultAddress}
            onChange={(e) => change('defaultAddress', e.target.value)}
            rows={2}
            className={inputCls}
            style={{ ...inputStyle, resize: 'none', fontFamily: 'inherit' }}
            placeholder="Delivery address"
          />
        </label>

        <label className="text-sm">
          <span style={{ color: DESIGN.mutedFg }}>Postal Code</span>
          <input
            value={draft.postalCode}
            onChange={(e) => change('postalCode', e.target.value)}
            className={inputCls}
            style={inputStyle}
            placeholder="Postal code"
          />
        </label>

        <label className="text-sm">
          <span style={{ color: DESIGN.mutedFg }}>Country</span>
          <input
            value={draft.country}
            onChange={(e) => change('country', e.target.value)}
            className={inputCls}
            style={inputStyle}
            placeholder="Country"
          />
        </label>
      </div>

      {/* Footer */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs" style={{ color: DESIGN.mutedFg }}>
          Last updated on {toDateLabel(profile.updatedAt)}
        </div>
        <button
          onClick={save}
          disabled={!canSave}
          className="rounded-xl px-5 py-2 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
          style={{
            background:  canSave ? DESIGN.primary : '#9ca3af',
            boxShadow: canSave ? '0 8px 20px rgba(233,30,140,0.25)' : 'none',
          }}
        >
          {updateMutation.isPending ? 'Saving...' : 'Save Profile'}
        </button>
      </div>

      {notice && (
        <p
          className="mt-3 text-sm font-semibold"
          style={{ color: notice.includes('success') ? DESIGN.success : '#b91c1c' }}
        >
          {notice}
        </p>
      )}
    </SectionContainer>
  );
}
