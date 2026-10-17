"use client";
import React, { useEffect, useState } from "react";
import { Theme } from "@/modules/dashboard/utils/theme";
import { apiClient } from "@/shared/lib/apiClient";
import { useQueryClient } from '@tanstack/react-query';
import { PROFILE_QUERY_KEY } from '@/modules/auth/queries/useProfileQuery';
import { Eye, EyeOff } from 'lucide-react';
import { useResponsive } from '@/shared/hooks/useResponsive';

type ProfileTab = 'info' | 'security' | 'modules';

const PROFILE_TABS: { id: ProfileTab; label: string }[] = [
  { id: 'info', label: 'Info' },
  { id: 'security', label: 'Password Change' },
  { id: 'modules', label: 'Modules' },
];

export default function ProfileView() {
  const { isMobile } = useResponsive();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<any>({});
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>('info');
  const queryClient = useQueryClient();

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (passwordForm.newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    setUpdatingPassword(true);
    try {
      await apiClient.post('/auth/change-password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordSuccess('Your password has been changed successfully.');
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (error: any) {
      console.error('Failed to change password', error);
      const errMsg = error.response?.data?.message || 'Failed to change password. Please check your current password and try again.';
      setPasswordError(errMsg);
    } finally {
      setUpdatingPassword(false);
    }
  };

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await apiClient.get('/auth/profile');
        const data = response.data.data;
        setProfile(data);
        setForm({
          name: `${data.firstName || ''} ${data.lastName || ''}`.trim(),
          email: data.email || '',
          phone: data.phone || 'No phone provided',
          address: data.address || 'Address not provided',
        });
      } catch (error) {
        console.error('Failed to fetch profile', error);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  if (loading) {
    return <div className="flex h-full items-center justify-center text-sm text-gray-500">Loading profile...</div>;
  }

  if (!profile) {
    return <div className="flex h-full items-center justify-center p-8 text-center text-red-500">Failed to load profile. Please try again.</div>;
  }

  const initials = profile?.firstName?.charAt(0)?.toUpperCase() || profile?.email?.charAt(0)?.toUpperCase() || 'U';
  const roleName = profile.userType?.name || 'USER';

  const profileHeaderCard = (
    <div className="bg-white border border-gray-100 rounded-xl p-6 flex flex-row items-center gap-5 shadow-sm">
      <div className="relative group cursor-pointer">
        <div className="w-16 h-16 rounded-full bg-pink-500 flex items-center justify-center text-white text-2xl font-bold shrink-0 shadow-sm overflow-hidden">
          {profile.avatarUrl ? (
            <img src={profile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            initials
          )}
        </div>
        <div className="absolute bottom-0 right-0 bg-white border-2 border-white rounded-full p-1 shadow-md text-pink-500 z-10 pointer-events-none">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>
        </div>
        <label className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100 cursor-pointer text-[10px] font-bold z-20">
          {uploading ? '...' : 'UPLOAD'}
          <input
            type="file"
            className="hidden"
            accept="image/*"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setUploading(true);
              try {
                const formData = new FormData();
                formData.append('image', file);
                const res = await apiClient.post('/uploads/image?folder=mollari/users', formData, {
                  headers: { 'Content-Type': 'multipart/form-data' },
                });
                const newAvatarUrl = res.data.data.url;
                await apiClient.patch('/auth/profile', { avatarUrl: newAvatarUrl });
                setProfile((prev: any) => ({ ...prev, avatarUrl: newAvatarUrl }));
                queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEY });
              } catch (err) {
                alert('Failed to upload avatar');
              } finally {
                setUploading(false);
                e.target.value = '';
              }
            }}
          />
        </label>
      </div>
      <div className="flex-1 flex flex-col justify-center">
        <div className="flex items-center gap-3 mb-1">
          <p className="font-bold text-gray-900 text-lg sm:text-xl">{form.name}</p>
          <span className="text-[10px] sm:text-xs border border-pink-200 text-pink-600 rounded-full px-3 py-1 bg-pink-50 font-bold uppercase tracking-wider">
            {roleName}
          </span>
        </div>
        <p className="text-sm text-gray-400 truncate">{form.email}</p>
      </div>
    </div>
  );

  const personalInfoCard = (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <p className="text-sm font-bold text-gray-700">Personal Information</p>
        <button
          onClick={async () => {
            if (editMode) {
              try {
                const nameParts = form.name.split(' ');
                const firstName = nameParts[0] || '';
                const lastName = nameParts.slice(1).join(' ') || '';
                const payload = {
                  firstName,
                  lastName,
                  phone: form.phone === 'No phone provided' ? '' : form.phone,
                  address: form.address === 'Address not provided' ? '' : form.address,
                };
                await apiClient.patch('/auth/profile', payload);
                setProfile((prev: any) => ({ ...prev, ...payload }));
                queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEY });
              } catch (error) {
                console.error('Failed to update profile', error);
                alert('Failed to save profile changes.');
              }
            }
            setEditMode(!editMode);
          }}
          className="text-xs font-medium text-pink-500 hover:text-pink-700 transition-colors bg-pink-50 px-3 py-1.5 rounded-md"
        >
          {editMode ? "Save Changes" : "Edit Details"}
        </button>
      </div>
      <ul className="divide-y divide-gray-50">
        {[
          { label: "Full Name", key: "name", icon: "👤" },
          { label: "Email", key: "email", icon: "✉️" },
          { label: "Phone", key: "phone", icon: "📞" },
          { label: "Address", key: "address", icon: "📍" },
        ].map(({ label, key, icon }) => (
          <li key={key} className="flex items-start gap-4 px-6 py-4">
            <span className="text-lg">{icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-400 mb-1">{label}</p>
              {editMode && key !== 'email' ? (
                <input
                  className="text-sm text-gray-900 font-medium w-full border-b border-gray-300 focus:border-pink-500 outline-none pb-1 bg-transparent transition-colors"
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              ) : (
                <p className="text-sm text-gray-900 font-medium truncate">{form[key]}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );

  const passwordCard = (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
        <p className="text-sm font-bold text-gray-700">Security & Password</p>
        <p className="text-xs text-gray-400 mt-0.5">Manage and update your login password</p>
      </div>
      <form onSubmit={handlePasswordChange} className="p-6 space-y-4">
        {passwordError && (
          <div className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">
            ⚠️ {passwordError}
          </div>
        )}
        {passwordSuccess && (
          <div className="text-xs font-semibold text-green-600 bg-green-50 border border-green-100 rounded-lg p-3">
            ✅ {passwordSuccess}
          </div>
        )}
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Current Password</label>
          <div className="relative">
            <input
              type={showCurrentPassword ? "text" : "password"}
              required
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
              className="w-full text-sm text-gray-900 border border-gray-200 rounded-lg pl-3.5 pr-10 py-2 focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none bg-zinc-50/30 transition-all font-medium"
              placeholder="Enter current password"
            />
            <button
              type="button"
              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none cursor-pointer"
            >
              {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">New Password</label>
          <div className="relative">
            <input
              type={showNewPassword ? "text" : "password"}
              required
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
              className="w-full text-sm text-gray-900 border border-gray-200 rounded-lg pl-3.5 pr-10 py-2 focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none bg-zinc-50/30 transition-all font-medium"
              placeholder="Min 8 characters"
            />
            <button
              type="button"
              onClick={() => setShowNewPassword(!showNewPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none cursor-pointer"
            >
              {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Confirm New Password</label>
          <div className="relative">
            <input
              type={showConfirmPassword ? "text" : "password"}
              required
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
              className="w-full text-sm text-gray-900 border border-gray-200 rounded-lg pl-3.5 pr-10 py-2 focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none bg-zinc-50/30 transition-all font-medium"
              placeholder="Confirm new password"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none cursor-pointer"
            >
              {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <button
          type="submit"
          disabled={updatingPassword}
          className="w-full text-xs font-bold text-white bg-pink-500 hover:bg-pink-600 transition-colors px-4 py-2.5 rounded-lg disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm shadow-pink-100 cursor-pointer"
        >
          {updatingPassword ? 'Updating...' : 'Change Password'}
        </button>
      </form>
    </div>
  );

  const branchesCard = (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm flex flex-col">
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
        <p className="text-sm font-bold text-gray-700">Branch Assignments</p>
        <p className="text-xs text-gray-400 mt-0.5">Physical locations you manage</p>
      </div>
      <ul className="divide-y divide-gray-50 flex-1 overflow-auto">
        {profile.userBranches && profile.userBranches.length > 0 ? (
          profile.userBranches.map((ub: any) => (
            <li key={ub.id} className="flex flex-col gap-2 px-6 py-4 hover:bg-gray-50/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
                    🏪
                  </div>
                  <p className="text-sm font-bold text-gray-800">{ub.branch?.name}</p>
                </div>
              </div>
              <div className="ml-11 flex items-center justify-between mt-1">
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <span>Code:</span> <span className="font-medium text-gray-600">{ub.branch?.branchCode}</span>
                </span>
                <span
                  className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-md ${
                    ub.isPrimary ? 'bg-pink-100 text-pink-700' : 'bg-teal-100 text-teal-700'
                  }`}
                >
                  {ub.isPrimary ? 'Primary' : 'Secondary'}
                </span>
              </div>
            </li>
          ))
        ) : (
          <li className="px-6 py-8 text-center text-sm text-gray-400">No branches assigned.</li>
        )}
      </ul>
    </div>
  );

  const modulesCard = (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
        <p className="text-sm font-bold text-gray-700">App Modules</p>
        <p className="text-xs text-gray-400 mt-0.5">Active modules assigned to your account</p>
      </div>
      <ul className="divide-y divide-gray-50 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {profile.userModules && profile.userModules.length > 0 ? (
          profile.userModules.map((um: any) => (
            <li key={um.id} className="flex items-center gap-3 px-6 py-4 hover:bg-gray-50/50 transition-colors">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-green-50 border border-green-100 text-green-600 text-lg">
                {um.module?.icon || '📦'}
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800">{um.module?.name}</p>
              </div>
            </li>
          ))
        ) : (
          <li className="px-6 py-8 col-span-full text-center text-sm text-gray-400">
            No app modules are assigned to your database profile yet.
          </li>
        )}
      </ul>
    </div>
  );

  const activeTabIndex = PROFILE_TABS.findIndex((tab) => tab.id === activeTab);

  return (
    <div className="bg-gray-50 p-4 md:p-8 min-h-full rounded-tl-xl h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        
        {/* Tabs Bar */}
        <div className="relative flex border-b border-gray-100 bg-white rounded-xl shadow-sm mb-6">
          {PROFILE_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 border-0 bg-transparent py-3 text-sm cursor-pointer transition-colors ${
                activeTab === tab.id ? 'text-pink-500 font-bold' : 'text-gray-400 font-medium'
              }`}
            >
              {tab.label}
            </button>
          ))}
          <div
            className="absolute bottom-0 h-0.5 w-1/3 bg-pink-500 transition-transform duration-200"
            style={{ transform: `translateX(${activeTabIndex * 100}%)` }}
          />
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {activeTab === 'info' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              {profileHeaderCard}
              {personalInfoCard}
            </div>
          )}
          {activeTab === 'security' && (
            <div className="max-w-xl mx-auto">
              {passwordCard}
            </div>
          )}
          {activeTab === 'modules' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              {branchesCard}
              {modulesCard}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
