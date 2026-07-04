'use client';

import Link from 'next/link';

export default function LoginPage() {
  return (
    <div className="flex flex-col space-y-6">
      <div className="flex flex-col space-y-2 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Welcome back</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Enter your username and password to log in
        </p>
      </div>

      <form className="flex flex-col space-y-4" onSubmit={(e) => e.preventDefault()}>
        <div className="space-y-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Username or Email</label>
          <input
            type="text"
            placeholder="username or email"
            className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-primary text-zinc-900 dark:text-zinc-50"
            disabled
          />
        </div>

        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Password</label>
            <Link href="/password-reset" className="text-xs font-medium text-primary hover:underline">
              Forgot?
            </Link>
          </div>
          <input
            type="password"
            placeholder="••••••••"
            className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-primary text-zinc-900 dark:text-zinc-50"
            disabled
          />
        </div>

        <button
          type="submit"
          className="w-full py-3 bg-primary hover:bg-primary-hover text-white font-semibold rounded-xl shadow-lg shadow-primary/20 transition-all duration-150 cursor-not-allowed mt-2"
          disabled
        >
          Sign In
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
