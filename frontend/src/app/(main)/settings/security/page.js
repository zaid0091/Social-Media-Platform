'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Key, ShieldAlert, Monitor, Smartphone, Check, AlertCircle, Save, LogOut } from 'lucide-react';
import api from '@/services/api';

const changePasswordSchema = z.object({
  old_password: z.string().min(1, 'Old password is required'),
  new_password: z.string()
    .min(8, 'New password must be at least 8 characters')
    .regex(/[a-zA-Z]/, 'New password must contain at least one letter')
    .regex(/\d/, 'New password must contain at least one number')
    .regex(/[@$!%*?&#]/, 'New password must contain at least one special character (@$!%*?&#)'),
  new_password_confirm: z.string().min(1, 'Please confirm your new password'),
}).refine((data) => data.new_password === data.new_password_confirm, {
  message: 'New passwords do not match',
  path: ['new_password_confirm'],
});

export default function SecuritySettingsPage() {
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  
  // mock devices list state
  const [sessions, setSessions] = useState([
    { id: 1, device: 'Windows PC', browser: 'Chrome', location: 'New York, USA', current: true },
    { id: 2, device: 'iPhone 15', browser: 'Safari App', location: 'London, UK', current: false },
    { id: 3, device: 'iPad Pro', browser: 'Firefox App', location: 'Paris, France', current: false }
  ]);

  const [tfaEnabled, setTfaEnabled] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      old_password: '',
      new_password: '',
      new_password_confirm: '',
    }
  });

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      await api.post('/users/change-password/', data);
      showToast('Password updated successfully!', 'success');
      reset();
    } catch (err) {
      const serverErrors = err.response?.data || {};
      showToast(serverErrors.old_password?.[0] || serverErrors.new_password?.[0] || serverErrors.non_field_errors?.[0] || 'Failed to change password', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeSession = (sessionId) => {
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    showToast('Device session revoked successfully', 'success');
  };

  return (
    <div className="space-y-6 text-left">
      <div>
        <h1 className="text-xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight flex items-center space-x-2">
          <Key className="h-5.5 w-5.5 text-primary" />
          <span>Security & Access</span>
        </h1>
        <p className="text-[11px] text-zinc-400 font-semibold mt-0.5 leading-none">Manage account password changes and session details</p>
      </div>

      {toast && (
        <div className={`p-4 rounded-2xl flex items-center space-x-2 text-xs font-bold leading-normal ${
          toast.type === 'success' 
            ? 'bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-250 dark:border-emerald-900 text-emerald-800 dark:text-emerald-400' 
            : 'bg-red-50 dark:bg-red-950/20 border border-red-250 dark:border-red-900 text-red-800 dark:text-red-400'
        }`}>
          {toast.type === 'success' ? <Check className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* 1. Change Password Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <h3 className="text-xs font-black text-zinc-800 dark:text-zinc-250 uppercase tracking-wider">Change Password</h3>

        <div className="flex flex-col space-y-3">
          {/* Old password */}
          <div className="flex flex-col space-y-1">
            <label className="text-[10px] font-black text-zinc-450 uppercase tracking-wider">Old Password</label>
            <input
              type="password"
              {...register('old_password')}
              className="w-full px-4 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary text-xs"
            />
            {errors.old_password && <p className="text-[10px] text-red-500 font-bold">{errors.old_password.message}</p>}
          </div>

          {/* New password */}
          <div className="flex flex-col space-y-1">
            <label className="text-[10px] font-black text-zinc-450 uppercase tracking-wider">New Password</label>
            <input
              type="password"
              {...register('new_password')}
              className="w-full px-4 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary text-xs"
            />
            {errors.new_password && <p className="text-[10px] text-red-500 font-bold">{errors.new_password.message}</p>}
          </div>

          {/* Confirm password */}
          <div className="flex flex-col space-y-1">
            <label className="text-[10px] font-black text-zinc-455 uppercase tracking-wider">Confirm New Password</label>
            <input
              type="password"
              {...register('new_password_confirm')}
              className="w-full px-4 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary text-xs"
            />
            {errors.new_password_confirm && <p className="text-[10px] text-red-500 font-bold">{errors.new_password_confirm.message}</p>}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-3 rounded-2xl text-xs font-black text-white bg-primary hover:bg-primary-hover shadow-md transition flex items-center space-x-1.5 cursor-pointer"
          >
            {loading ? (
              <div className="h-4 w-4 rounded-full border-2 border-zinc-200 border-t-primary animate-spin" />
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>Update Password</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* 2. Two-Factor Authentication switch */}
      <div className="pt-6 border-t border-zinc-150 dark:border-zinc-850">
        <h3 className="text-xs font-black text-zinc-800 dark:text-zinc-200 uppercase tracking-wider mb-4 flex items-center space-x-1.5">
          <ShieldAlert className="h-4 w-4 text-primary" />
          <span>Two-Factor Authentication (2FA)</span>
        </h3>

        <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200/50 dark:border-zinc-800 rounded-2.5xl">
          <div className="flex flex-col space-y-1 text-left min-w-0 mr-4">
            <span className="text-xs font-black text-zinc-900 dark:text-zinc-50">Authenticator App</span>
            <span className="text-[10px] text-zinc-400 font-semibold leading-relaxed">
              Use an authenticator app (like Google Authenticator or Duo) to scan a QR code and receive verification codes.
            </span>
          </div>
          <button
            onClick={() => {
              setTfaEnabled(!tfaEnabled);
              showToast(tfaEnabled ? 'Two-Factor Authentication disabled' : 'Two-Factor Authentication setup pending config code verification', 'success');
            }}
            className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer focus:outline-none ${
              tfaEnabled ? 'bg-primary' : 'bg-zinc-300 dark:bg-zinc-700'
            }`}
          >
            <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${tfaEnabled ? 'translate-x-5' : ''}`} />
          </button>
        </div>
      </div>

      {/* 3. Session Log Activity */}
      <div className="pt-6 border-t border-zinc-150 dark:border-zinc-850">
        <h3 className="text-xs font-black text-zinc-800 dark:text-zinc-200 uppercase tracking-wider mb-4">Device Login Activity</h3>

        <div className="space-y-3">
          {sessions.map((sess) => (
            <div key={sess.id} className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200/50 dark:border-zinc-800 rounded-2.5xl">
              <div className="flex items-center space-x-3.5 min-w-0 mr-4">
                <div className="h-9 w-9 rounded-xl bg-zinc-100 dark:bg-zinc-850 flex items-center justify-center text-zinc-500 shrink-0 select-none">
                  {sess.device.includes('PC') ? <Monitor className="h-5 w-5" /> : <Smartphone className="h-5 w-5" />}
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-xs font-black text-zinc-900 dark:text-zinc-50 truncate leading-tight">{sess.device}</span>
                    {sess.current && (
                      <span className="bg-emerald-50 dark:bg-emerald-950 text-emerald-600 border border-emerald-200 dark:border-emerald-900 text-[8px] font-black tracking-widest px-1 py-0.5 rounded uppercase leading-none">
                        Active Now
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-zinc-400 font-semibold truncate leading-none mt-1">
                    {sess.browser} • {sess.location}
                  </span>
                </div>
              </div>

              {!sess.current && (
                <button
                  type="button"
                  onClick={() => handleRevokeSession(sess.id)}
                  className="p-2 border border-zinc-200 dark:border-zinc-850 hover:bg-red-50 dark:hover:bg-red-950/20 hover:border-red-200 dark:hover:border-red-900 hover:text-red-550 rounded-xl text-zinc-650 transition cursor-pointer shrink-0"
                  title="Revoke session"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
