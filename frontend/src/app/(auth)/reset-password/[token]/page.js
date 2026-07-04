'use client';

import { useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';
import api from '@/services/api';

const resetPasswordSchema = z.object({
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Must contain at least one lowercase letter')
    .regex(/\d/, 'Must contain at least one number')
    .regex(/[@$!%*?&#]/, 'Must contain at least one special character (@$!%*?&#)'),
  password_confirm: z.string().min(1, 'Please confirm your new password'),
}).refine((data) => data.password === data.password_confirm, {
  message: "Passwords do not match",
  path: ["password_confirm"],
});

export default function ResetPasswordPage() {
  const [isSuccess, setIsSuccess] = useState(false);
  const [globalError, setGlobalError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  const token = params.token;
  const uidb64 = searchParams.get('uidb64');

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(resetPasswordSchema),
    mode: 'onChange'
  });

  const onSubmit = async (data) => {
    if (!uidb64 || !token) {
      setGlobalError('Missing required password reset parameters in the URL.');
      return;
    }

    setSubmitting(true);
    setGlobalError(null);
    try {
      await api.post('/auth/password-reset/confirm/', {
        uidb64,
        token,
        new_password: data.password
      });
      setIsSuccess(true);
    } catch (err) {
      setGlobalError(err.response?.data?.error || 'Password reset link is invalid or has expired.');
    } finally {
      setSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="flex flex-col items-center text-center space-y-6 py-6 animate-in fade-in zoom-in duration-300">
        <div className="h-16 w-16 bg-emerald-50 dark:bg-emerald-950/30 rounded-full flex items-center justify-center text-emerald-500">
          <CheckCircle2 className="h-10 w-10" />
        </div>
        
        <div className="flex flex-col space-y-2">
          <h3 className="text-2xl font-bold text-zinc-950 dark:text-zinc-50">Password Updated</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-sm">
            Your password has been successfully updated. You can now log in using your new credentials.
          </p>
        </div>

        <Link
          href="/login"
          className="w-full py-3 bg-primary hover:bg-primary-hover text-white text-center font-semibold rounded-xl shadow-lg shadow-primary/20 transition-all duration-150"
        >
          Proceed to Login
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-6">
      <div className="flex flex-col space-y-2 text-center relative">
        <Link href="/login" className="absolute left-0 top-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Reset Password</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Please enter and confirm your new password below
        </p>
      </div>

      {globalError && (
        <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-xl flex items-center space-x-2 text-red-655 dark:text-red-400 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{globalError}</span>
        </div>
      )}

      <form className="flex flex-col space-y-4" onSubmit={handleSubmit(onSubmit)}>
        {/* New Password */}
        <div className="space-y-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">New Password</label>
          <input
            type="password"
            placeholder="••••••••"
            {...register('password')}
            className={`w-full px-4 py-2.5 rounded-xl border bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-primary text-zinc-900 dark:text-zinc-50 transition-all ${
              errors.password ? 'border-red-500 focus:ring-red-500' : 'border-zinc-200 dark:border-zinc-800'
            }`}
          />
          {errors.password && (
            <p className="text-xs text-red-500 font-medium px-1 leading-normal">{errors.password.message}</p>
          )}
        </div>

        {/* Confirm Password */}
        <div className="space-y-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Confirm New Password</label>
          <input
            type="password"
            placeholder="••••••••"
            {...register('password_confirm')}
            className={`w-full px-4 py-2.5 rounded-xl border bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-primary text-zinc-900 dark:text-zinc-50 transition-all ${
              errors.password_confirm ? 'border-red-500 focus:ring-red-500' : 'border-zinc-200 dark:border-zinc-800'
            }`}
          />
          {errors.password_confirm && (
            <p className="text-xs text-red-500 font-medium px-1">{errors.password_confirm.message}</p>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          className={`w-full py-3 bg-primary hover:bg-primary-hover text-white font-semibold rounded-xl shadow-lg shadow-primary/20 transition-all duration-150 mt-2 flex items-center justify-center space-x-2 ${
            submitting ? 'opacity-80 cursor-wait' : ''
          }`}
          disabled={submitting}
        >
          {submitting ? (
            <>
              <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              <span>Updating...</span>
            </>
          ) : (
            <span>Update Password</span>
          )}
        </button>
      </form>
    </div>
  );
}
