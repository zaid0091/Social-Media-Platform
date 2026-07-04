'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import useAuthStore from '@/store/useAuthStore';

const loginSchema = z.object({
  username: z.string().min(1, 'Username or Email is required'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
});

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [globalError, setGlobalError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  
  const router = useRouter();
  const { login } = useAuthStore();

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      rememberMe: false
    }
  });

  const onSubmit = async (data) => {
    setSubmitting(true);
    setGlobalError(null);
    const result = await login(data.username, data.password);
    if (result.success) {
      router.push('/');
    } else {
      setGlobalError(result.error || 'Authentication failed. Please verify credentials.');
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col space-y-6">
      <div className="flex flex-col space-y-2 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Welcome back</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Enter your credentials below to access your account
        </p>
      </div>

      {globalError && (
        <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-xl flex items-center space-x-2 text-red-600 dark:text-red-400 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{globalError}</span>
        </div>
      )}

      <form className="flex flex-col space-y-4" onSubmit={handleSubmit(onSubmit)}>
        {/* Username / Email */}
        <div className="space-y-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Username or Email</label>
          <input
            type="text"
            placeholder="username or email"
            {...register('username')}
            className={`w-full px-4 py-2.5 rounded-xl border bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-primary text-zinc-900 dark:text-zinc-50 transition-all ${
              errors.username ? 'border-red-500 focus:ring-red-500' : 'border-zinc-200 dark:border-zinc-800'
            }`}
          />
          {errors.username && (
            <p className="text-xs text-red-500 font-medium px-1">{errors.username.message}</p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Password</label>
            <Link href="/forgot-password" className="text-xs font-semibold text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              {...register('password')}
              className={`w-full pl-4 pr-10 py-2.5 rounded-xl border bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-primary text-zinc-900 dark:text-zinc-50 transition-all ${
                errors.password ? 'border-red-500 focus:ring-red-500' : 'border-zinc-200 dark:border-zinc-800'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-3 text-zinc-400 hover:text-zinc-650 dark:hover:text-zinc-200"
            >
              {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs text-red-500 font-medium px-1">{errors.password.message}</p>
          )}
        </div>

        {/* Remember Me */}
        <div className="flex items-center space-x-2 px-1 py-1">
          <input
            type="checkbox"
            id="rememberMe"
            {...register('rememberMe')}
            className="h-4 w-4 rounded border-zinc-300 text-primary focus:ring-primary dark:border-zinc-800 dark:bg-zinc-950"
          />
          <label htmlFor="rememberMe" className="text-sm font-medium text-zinc-600 dark:text-zinc-400 select-none">
            Remember me
          </label>
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
              <span>Logging in...</span>
            </>
          ) : (
            <span>Sign In</span>
          )}
        </button>
      </form>

      <div className="text-center text-sm text-zinc-500 dark:text-zinc-400">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="font-semibold text-primary hover:underline">
          Sign up
        </Link>
      </div>
    </div>
  );
}
