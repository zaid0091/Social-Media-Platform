'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ShieldCheck, Mail, Phone, User, Save, Link as LinkIcon, Check, AlertCircle } from 'lucide-react';
import api from '@/services/api';
import useAuthStore from '@/store/useAuthStore';

const accountSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, and underscores are allowed'),
  email: z.string().email('Must be a valid email address'),
  phone_number: z.string().optional().or(z.literal('')),
});

export default function AccountSettingsPage() {
  const { user, updateUser, checkAuth } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isDirty }
  } = useForm({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      username: '',
      email: '',
      phone_number: '',
    }
  });

  useEffect(() => {
    if (user) {
      setValue('username', user.username || '');
      setValue('email', user.email || '');
      setValue('phone_number', user.phone_number || '');
    }
  }, [user, setValue]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const res = await api.patch('/users/profile/', data);
      updateUser(res.data);
      await checkAuth(); // Sync store
      showToast('Account details saved successfully!', 'success');
    } catch (err) {
      const serverErrors = err.response?.data || {};
      showToast(serverErrors.username?.[0] || serverErrors.email?.[0] || 'Failed to update account info', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 text-left">
      <div>
        <h1 className="text-xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight flex items-center space-x-2">
          <ShieldCheck className="h-5.5 w-5.5 text-primary" />
          <span>Account Settings</span>
        </h1>
        <p className="text-[11px] text-zinc-400 font-semibold mt-0.5 leading-none">Manage account identifiers and integrations</p>
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

      {/* Account Info Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Username */}
          <div className="flex flex-col space-y-1.5">
            <label className="text-[10px] font-black text-zinc-450 dark:text-zinc-400 uppercase tracking-wider">Username</label>
            <div className="relative">
              <User className="absolute left-3.5 top-3.5 h-4 w-4 text-zinc-400" />
              <input
                type="text"
                {...register('username')}
                className="w-full pl-10 pr-4 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary text-xs"
              />
            </div>
            {errors.username && <p className="text-[10px] text-red-500 font-bold">{errors.username.message}</p>}
          </div>

          {/* Email */}
          <div className="flex flex-col space-y-1.5">
            <label className="text-[10px] font-black text-zinc-455 dark:text-zinc-400 uppercase tracking-wider">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-zinc-400" />
              <input
                type="email"
                {...register('email')}
                className="w-full pl-10 pr-4 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary text-xs"
              />
            </div>
            {errors.email && <p className="text-[10px] text-red-500 font-bold">{errors.email.message}</p>}
          </div>

          {/* Phone Number */}
          <div className="flex flex-col space-y-1.5 md:col-span-2">
            <label className="text-[10px] font-black text-zinc-455 dark:text-zinc-400 uppercase tracking-wider">Phone Number</label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-3.5 h-4 w-4 text-zinc-400" />
              <input
                type="tel"
                placeholder="+1 (555) 000-0000"
                {...register('phone_number')}
                className="w-full pl-10 pr-4 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary text-xs"
              />
            </div>
            {errors.phone_number && <p className="text-[10px] text-red-500 font-bold">{errors.phone_number.message}</p>}
          </div>

        </div>

        {/* Submit */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={loading || !isDirty}
            className={`px-5 py-3 rounded-2xl text-xs font-black text-white transition flex items-center space-x-1.5 cursor-pointer ${
              !isDirty ? 'bg-zinc-300 dark:bg-zinc-800 text-zinc-500 cursor-not-allowed' : 'bg-primary hover:bg-primary-hover shadow-md'
            }`}
          >
            {loading ? (
              <div className="h-4 w-4 rounded-full border-2 border-zinc-200 border-t-primary animate-spin" />
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Connected Accounts Section */}
      <div className="pt-6 border-t border-zinc-150 dark:border-zinc-850">
        <h3 className="text-xs font-black text-zinc-800 dark:text-zinc-200 uppercase tracking-wider mb-4">Connected Accounts</h3>
        
        <div className="space-y-3">
          {[
            { provider: 'Google', connected: true, email: 'google.auth@gmail.com' },
            { provider: 'Apple', connected: false, email: '' },
            { provider: 'GitHub', connected: false, email: '' }
          ].map((acc) => (
            <div key={acc.provider} className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200/50 dark:border-zinc-800 rounded-2.5xl">
              <div className="flex items-center space-x-3.5">
                <div className="h-9 w-9 rounded-xl bg-zinc-100 dark:bg-zinc-850 flex items-center justify-center font-bold text-xs select-none">
                  {acc.provider.charAt(0)}
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-black text-zinc-900 dark:text-zinc-50">{acc.provider}</span>
                  {acc.connected ? (
                    <span className="text-[10px] text-zinc-400 font-semibold">{acc.email}</span>
                  ) : (
                    <span className="text-[10px] text-zinc-400 font-semibold">Not connected</span>
                  )}
                </div>
              </div>

              <button
                type="button"
                className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition border cursor-pointer ${
                  acc.connected
                    ? 'border-zinc-200 dark:border-zinc-850 text-zinc-650 dark:text-zinc-350 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    : 'border-primary text-primary hover:bg-primary/5 bg-transparent'
                }`}
              >
                {acc.connected ? 'Disconnect' : 'Connect'}
              </button>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
