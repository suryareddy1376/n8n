'use client';

import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useMutation } from '@tanstack/react-query';
import apiClient from '@/lib/api';
import clsx from 'clsx';
import {
  UserCircleIcon,
  BellIcon,
  ShieldCheckIcon,
  PaintBrushIcon,
  EnvelopeIcon,
  PhoneIcon,
  MapPinIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  CameraIcon,
} from '@heroicons/react/24/outline';

type SettingsTab = 'profile' | 'notifications' | 'security' | 'preferences';

export default function SettingsPage() {
  const user = useAuthStore((state) => state.user);
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const tabs = [
    { key: 'profile' as SettingsTab, label: 'Profile', icon: UserCircleIcon },
    { key: 'notifications' as SettingsTab, label: 'Notifications', icon: BellIcon },
    { key: 'security' as SettingsTab, label: 'Security', icon: ShieldCheckIcon },
    { key: 'preferences' as SettingsTab, label: 'Preferences', icon: PaintBrushIcon },
  ];

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500">Manage your account</p>
      </div>

      {/* Success Toast */}
      {successMessage && (
        <div className="fixed top-4 right-4 z-50 bg-success-50 border border-success-200 text-success-800 px-3 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <CheckCircleIcon className="w-4 h-4 text-success-500" />
          <span className="text-sm font-medium">{successMessage}</span>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={clsx(
              'flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors',
              activeTab === tab.key
                ? 'bg-primary-100 text-primary-700'
                : 'text-slate-600 hover:bg-slate-100'
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="max-w-2xl">
        {activeTab === 'profile' && <ProfileTab user={user} onSuccess={showSuccess} />}
        {activeTab === 'notifications' && <NotificationsTab onSuccess={showSuccess} />}
        {activeTab === 'security' && <SecurityTab onSuccess={showSuccess} />}
        {activeTab === 'preferences' && <PreferencesTab onSuccess={showSuccess} />}
      </div>
    </div>
  );
}

function ProfileTab({ user, onSuccess }: { user: any; onSuccess: (msg: string) => void }) {
  const [formData, setFormData] = useState({
    full_name: user?.full_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    address: user?.address || '',
  });

  const updateMutation = useMutation({
    mutationFn: (data: typeof formData) => apiClient.patch('/users/profile', data),
    onSuccess: () => onSuccess('Profile updated successfully!'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Avatar Section */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Profile Photo</h3>
        <div className="flex items-center gap-6">
          <div className="relative">
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-3xl font-bold">
              {formData.full_name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <button
              type="button"
              className="absolute -bottom-2 -right-2 p-2 bg-white rounded-xl shadow-lg border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              <CameraIcon className="h-4 w-4 text-slate-600" />
            </button>
          </div>
          <div>
            <p className="text-sm text-slate-600">
              Upload a new avatar. JPG, PNG or GIF. Max 2MB.
            </p>
            <button type="button" className="mt-2 text-sm font-medium text-primary-600 hover:text-primary-700">
              Upload Image
            </button>
          </div>
        </div>
      </div>

      {/* Personal Info */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Personal Information</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Full Name</label>
            <div className="relative">
              <UserCircleIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="input pl-10"
                placeholder="Enter your full name"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Email Address</label>
            <div className="relative">
              <EnvelopeIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="input pl-10"
                placeholder="Enter your email"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Phone Number</label>
            <div className="relative">
              <PhoneIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="input pl-10"
                placeholder="Enter your phone number"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Address</label>
            <div className="relative">
              <MapPinIcon className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
              <textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="input pl-10 min-h-[80px] resize-none"
                placeholder="Enter your address"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={updateMutation.isPending}
          className="btn-primary"
        >
          {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}

function NotificationsTab({ onSuccess }: { onSuccess: (msg: string) => void }) {
  const [settings, setSettings] = useState({
    email_notifications: true,
    push_notifications: true,
    sms_notifications: false,
    complaint_updates: true,
    marketing_emails: false,
    weekly_digest: true,
  });

  const handleSave = () => {
    onSuccess('Notification preferences updated!');
  };

  const ToggleSwitch = ({ checked, onChange }: { checked: boolean; onChange: (val: boolean) => void }) => (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={clsx(
        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
        checked ? 'bg-primary-600' : 'bg-slate-300'
      )}
    >
      <span
        className={clsx(
          'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
          checked ? 'translate-x-6' : 'translate-x-1'
        )}
      />
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Notification Channels</h3>
        <p className="text-sm text-slate-500 mb-6">Choose how you want to receive notifications</p>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-slate-100">
            <div>
              <p className="font-medium text-slate-900">Email Notifications</p>
              <p className="text-sm text-slate-500">Receive updates via email</p>
            </div>
            <ToggleSwitch
              checked={settings.email_notifications}
              onChange={(val) => setSettings({ ...settings, email_notifications: val })}
            />
          </div>
          <div className="flex items-center justify-between py-3 border-b border-slate-100">
            <div>
              <p className="font-medium text-slate-900">Push Notifications</p>
              <p className="text-sm text-slate-500">Receive browser push notifications</p>
            </div>
            <ToggleSwitch
              checked={settings.push_notifications}
              onChange={(val) => setSettings({ ...settings, push_notifications: val })}
            />
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium text-slate-900">SMS Notifications</p>
              <p className="text-sm text-slate-500">Receive text message alerts</p>
            </div>
            <ToggleSwitch
              checked={settings.sms_notifications}
              onChange={(val) => setSettings({ ...settings, sms_notifications: val })}
            />
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Email Preferences</h3>
        <p className="text-sm text-slate-500 mb-6">Manage what emails you receive</p>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-slate-100">
            <div>
              <p className="font-medium text-slate-900">Complaint Updates</p>
              <p className="text-sm text-slate-500">Status changes on your complaints</p>
            </div>
            <ToggleSwitch
              checked={settings.complaint_updates}
              onChange={(val) => setSettings({ ...settings, complaint_updates: val })}
            />
          </div>
          <div className="flex items-center justify-between py-3 border-b border-slate-100">
            <div>
              <p className="font-medium text-slate-900">Weekly Digest</p>
              <p className="text-sm text-slate-500">Summary of weekly activity</p>
            </div>
            <ToggleSwitch
              checked={settings.weekly_digest}
              onChange={(val) => setSettings({ ...settings, weekly_digest: val })}
            />
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium text-slate-900">Marketing Emails</p>
              <p className="text-sm text-slate-500">News and promotional content</p>
            </div>
            <ToggleSwitch
              checked={settings.marketing_emails}
              onChange={(val) => setSettings({ ...settings, marketing_emails: val })}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={handleSave} className="btn-primary">
          Save Preferences
        </button>
      </div>
    </div>
  );
}

function SecurityTab({ onSuccess }: { onSuccess: (msg: string) => void }) {
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.new_password !== passwordData.confirm_password) {
      return;
    }
    onSuccess('Password updated successfully!');
    setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
  };

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Change Password</h3>
        <p className="text-sm text-slate-500 mb-6">Update your password regularly for security</p>

        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Current Password</label>
            <input
              type="password"
              value={passwordData.current_password}
              onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })}
              className="input"
              placeholder="Enter current password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">New Password</label>
            <input
              type="password"
              value={passwordData.new_password}
              onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
              className="input"
              placeholder="Enter new password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Confirm New Password</label>
            <input
              type="password"
              value={passwordData.confirm_password}
              onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
              className="input"
              placeholder="Confirm new password"
            />
          </div>
          <div className="pt-2">
            <button type="submit" className="btn-primary">
              Update Password
            </button>
          </div>
        </form>
      </div>

      <div className="card p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Two-Factor Authentication</h3>
        <p className="text-sm text-slate-500 mb-6">Add an extra layer of security to your account</p>
        
        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-warning-100 rounded-xl">
              <ShieldCheckIcon className="h-6 w-6 text-warning-600" />
            </div>
            <div>
              <p className="font-medium text-slate-900">2FA is not enabled</p>
              <p className="text-sm text-slate-500">Secure your account with 2FA</p>
            </div>
          </div>
          <button className="btn-secondary">Enable 2FA</button>
        </div>
      </div>

      <div className="card p-6 border-danger-200 bg-danger-50">
        <h3 className="text-lg font-semibold text-danger-700 mb-2 flex items-center gap-2">
          <ExclamationTriangleIcon className="h-5 w-5" />
          Danger Zone
        </h3>
        <p className="text-sm text-danger-600 mb-4">
          Permanently delete your account and all associated data
        </p>
        <button className="btn-danger">Delete Account</button>
      </div>
    </div>
  );
}

function PreferencesTab({ onSuccess }: { onSuccess: (msg: string) => void }) {
  const [preferences, setPreferences] = useState({
    language: 'en',
    timezone: 'UTC',
    theme: 'light',
  });

  const handleSave = () => {
    onSuccess('Preferences saved!');
  };

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Display Settings</h3>
        <p className="text-sm text-slate-500 mb-6">Customize your experience</p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Language</label>
            <select
              value={preferences.language}
              onChange={(e) => setPreferences({ ...preferences, language: e.target.value })}
              className="input"
            >
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
              <option value="hi">हिंदी</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Timezone</label>
            <select
              value={preferences.timezone}
              onChange={(e) => setPreferences({ ...preferences, timezone: e.target.value })}
              className="input"
            >
              <option value="UTC">UTC</option>
              <option value="America/New_York">Eastern Time</option>
              <option value="America/Los_Angeles">Pacific Time</option>
              <option value="Asia/Kolkata">India Standard Time</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Theme</label>
            <div className="flex gap-3">
              {['light', 'dark', 'system'].map((theme) => (
                <button
                  key={theme}
                  type="button"
                  onClick={() => setPreferences({ ...preferences, theme })}
                  className={clsx(
                    'px-4 py-2 text-sm font-medium rounded-xl border-2 transition-all capitalize',
                    preferences.theme === theme
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  )}
                >
                  {theme}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={handleSave} className="btn-primary">
          Save Preferences
        </button>
      </div>
    </div>
  );
}
