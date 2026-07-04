'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Mail, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';
import api from '@/services/api';

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export default function ForgotPasswordPage() {
  const [isSuccess, setIsSuccess] = useState(false);
  const [globalError, setGlobalError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(forgotPasswordSchema)
  });

  const onSubmit = async (data) => {
    setSubmitting(true);
    setGlobalError(null);
    try {
      await api.post('/auth/password-reset/', { email: data.email });
      setIsSuccess(true);
    } catch (err) {
      setGlobalError(err.response?.data?.error || 'An unexpected error occurred.');
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
          <h3 className="text-2xl font-bold text-zinc-950 dark:text-zinc-50">Reset link sent</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-sm">
            If an account exists with that email, we have sent a secure password reset link. Please check your inbox.
          </p>
        </div>

        <Link
          href="/login"
          className="w-full py-3 bg-primary hover:bg-primary-hover text-white text-center font-semibold rounded-xl shadow-lg shadow-primary/20 transition-all duration-150"
        >
          Back to Login
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
        <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Forgot Password</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Enter your email address and we will send a password reset link
        </p>
      </div>

      {globalError && (
        <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-xl flex items-center space-x-2 text-red-655 dark:text-red-400 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{globalError}</span>
        </div>
      )}

      <form className="flex flex-col space-y-4" onSubmit={handleSubmit(onSubmit)}>
        {/* Email */}
        <div className="space-y-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Email Address</label>
          <input
            type="email"
            placeholder="john@example.com"
            {...register('email')}
            className={`w-full px-4 py-2.5 rounded-xl border bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-primary text-zinc-900 dark:text-zinc-50 transition-all ${
              errors.email ? 'border-red-500 focus:ring-red-500' : 'border-zinc-200 dark:border-zinc-800'
            }`}
          />
          {errors.email && (
            <p className="text-xs text-red-500 font-medium px-1">{errors.email.message}</p>
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
              <span>Sending...</span>
            </>
          ) : (
            <span>Send Reset Link</span>
          )}
        </button>
      </form>
    </div>
  );
}
