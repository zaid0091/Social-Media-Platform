'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Link from 'next/link';
import { Mail, CheckCircle2, AlertCircle } from 'lucide-react';
import api from '@/services/api';

const registerSchema = z.object({
  full_name: z.string().min(1, 'Full name is required'),
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, and underscores are allowed'),
  email: z.string().email('Invalid email address'),
  date_of_birth: z.string().min(1, 'Date of birth is required'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Must contain at least one lowercase letter')
    .regex(/\d/, 'Must contain at least one number')
    .regex(/[@$!%*?&#]/, 'Must contain at least one special character (@$!%*?&#)'),
  password_confirm: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.password === data.password_confirm, {
  message: "Passwords do not match",
  path: ["password_confirm"],
});

export default function RegisterPage() {
  const [isSuccess, setIsSuccess] = useState(false);
  const [globalError, setGlobalError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isValid }
  } = useForm({
    resolver: zodResolver(registerSchema),
    mode: 'onChange'
  });

  const onSubmit = async (data) => {
    setSubmitting(true);
    setGlobalError(null);
    try {
      await api.post('/auth/register/', data);
      setIsSuccess(true);
    } catch (err) {
      const errorData = err.response?.data;
      if (errorData && typeof errorData === 'object') {
        Object.keys(errorData).forEach((field) => {
          setError(field, {
            type: 'server',
            message: Array.isArray(errorData[field]) ? errorData[field][0] : errorData[field]
          });
        });
      } else {
        setGlobalError('An unexpected error occurred. Please try again.');
      }
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
          <h3 className="text-2xl font-bold text-zinc-950 dark:text-zinc-50">Check your email</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-sm">
            We have sent a verification link to your registered email address. Please verify your account to proceed.
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
      <div className="flex flex-col space-y-2 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Create an account</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Join us today by entering your details below
        </p>
      </div>

      {globalError && (
        <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-xl flex items-center space-x-2 text-red-650 dark:text-red-400 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{globalError}</span>
        </div>
      )}

      <form className="flex flex-col space-y-4" onSubmit={handleSubmit(onSubmit)}>
        {/* Full Name */}
        <div className="space-y-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Full Name</label>
          <input
            type="text"
            placeholder="John Doe"
            {...register('full_name')}
            className={`w-full px-4 py-2.5 rounded-xl border bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-primary text-zinc-900 dark:text-zinc-50 transition-all ${
              errors.full_name ? 'border-red-500 focus:ring-red-500' : 'border-zinc-200 dark:border-zinc-800'
            }`}
          />
          {errors.full_name && (
            <p className="text-xs text-red-500 font-medium px-1">{errors.full_name.message}</p>
          )}
        </div>

        {/* Username */}
        <div className="space-y-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Username</label>
          <input
            type="text"
            placeholder="johndoe"
            {...register('username')}
            className={`w-full px-4 py-2.5 rounded-xl border bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-primary text-zinc-900 dark:text-zinc-50 transition-all ${
              errors.username ? 'border-red-500 focus:ring-red-500' : 'border-zinc-200 dark:border-zinc-800'
            }`}
          />
          {errors.username && (
            <p className="text-xs text-red-500 font-medium px-1">{errors.username.message}</p>
          )}
        </div>

        {/* Email Address */}
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

        {/* Date of Birth */}
        <div className="space-y-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Date of Birth</label>
          <input
            type="date"
            {...register('date_of_birth')}
            className={`w-full px-4 py-2.5 rounded-xl border bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-primary text-zinc-900 dark:text-zinc-50 transition-all ${
              errors.date_of_birth ? 'border-red-500 focus:ring-red-500' : 'border-zinc-200 dark:border-zinc-800'
            }`}
          />
          {errors.date_of_birth && (
            <p className="text-xs text-red-500 font-medium px-1">{errors.date_of_birth.message}</p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Password</label>
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
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Confirm Password</label>
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

        {/* Submit Button */}
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
              <span>Registering...</span>
            </>
          ) : (
            <span>Sign Up</span>
          )}
        </button>
      </form>

      <div className="text-center text-sm text-zinc-500 dark:text-zinc-400">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Sign in
        </Link>
      </div>
    </div>
  );
}
