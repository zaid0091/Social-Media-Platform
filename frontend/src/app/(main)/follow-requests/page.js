'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useSWR, { useSWRConfig } from 'swr';
import { ArrowLeft, UserPlus, Check, X, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import api from '@/services/api';
import useAuthStore from '@/store/useAuthStore';

const fetcher = (url) => api.get(url).then((res) => res.data);

export default function FollowRequestsPage() {
  const router = useRouter();
  const { mutate: globalMutate } = useSWRConfig();
  const { user: currentUser } = useAuthStore();

  const [requests, setRequests] = useState([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // 1. Fetch pending follow requests list
  const { data, error, isLoading, mutate } = useSWR(
    currentUser?.is_private ? `/users/follow-requests/?page=${page}` : null,
    fetcher
  );

  useEffect(() => {
    if (data) {
      const results = data.results || [];
      setRequests((prev) => page === 1 ? results : [...prev, ...results]);
      setHasNext(!!data.next);
    }
  }, [data, page]);

  const handleLoadMore = () => {
    if (hasNext && !loadingMore) {
      setPage((p) => p + 1);
    }
  };

  // 2. Action handlers (Accept/Reject)
  const handleRequestAction = async (requestId, action) => {
    // Optimistic UI: remove request card immediately
    const prevRequests = [...requests];
    setRequests((prev) => prev.filter((r) => r.id !== requestId));

    try {
      await api.post(`/users/follow-requests/${requestId}/${action}/`);
      
      // Mutate local SWR cache and LeftSidebar navigation badges
      mutate();
      globalMutate('/users/follow-requests/');
    } catch (err) {
      console.error(`Failed to ${action} follow request`, err);
      // Revert on error
      setRequests(prevRequests);
    }
  };

  // Redirect non-private accounts away
  useEffect(() => {
    if (currentUser && !currentUser.is_private) {
      router.replace('/settings/profile');
    }
  }, [currentUser, router]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Error Loading Requests</h2>
        <p className="text-sm text-zinc-500 text-center max-w-xs">
          An error occurred while loading follow requests.
        </p>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 border border-zinc-250 dark:border-zinc-800 rounded-xl text-xs font-bold hover:bg-zinc-50 dark:hover:bg-zinc-850 transition cursor-pointer"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-screen bg-zinc-50 dark:bg-zinc-950 px-4 py-6 md:px-8">
      <div className="max-w-xl mx-auto space-y-6">

        {/* HEADER */}
        <header className="flex items-center space-x-4 border-b border-zinc-150 dark:border-zinc-850 pb-4 text-left">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-850 rounded-xl text-zinc-650 dark:text-zinc-350 transition cursor-pointer"
            aria-label="Go Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          
          <div className="h-11 w-11 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
            <UserPlus className="h-5 w-5" />
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-black text-zinc-900 dark:text-zinc-50 leading-tight">
              Follow Requests
            </h1>
            <p className="text-xs text-zinc-400 font-semibold leading-none mt-0.5">
              Review requests to follow your private account
            </p>
          </div>
        </header>

        {/* ACCESSIBILITY WARNING IF ACCOUNT TYPE REVERTED */}
        {currentUser && !currentUser.is_private && (
          <div className="flex items-start space-x-3 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-2.5xl text-left">
            <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs font-black text-amber-800 dark:text-amber-400">Account is Public</h4>
              <p className="text-[11px] text-amber-600/90 font-medium leading-relaxed">
                Follow requests only apply to private profiles. You can toggle profile privacy in your Settings page.
              </p>
            </div>
          </div>
        )}

        {/* LIST FEED */}
        {isLoading && requests.length === 0 ? (
          <div className="space-y-3">
            {[1, 2].map((n) => (
              <div key={n} className="bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800 rounded-2.5xl p-4 animate-pulse flex items-center justify-between">
                <div className="flex items-center space-x-3.5 flex-1">
                  <div className="h-10 w-10 rounded-full bg-zinc-200 dark:bg-zinc-800 shrink-0" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-3 w-1/3 bg-zinc-200 dark:bg-zinc-800 rounded" />
                    <div className="h-2.5 w-1/2 bg-zinc-200 dark:bg-zinc-800 rounded" />
                  </div>
                </div>
                <div className="flex space-x-2 shrink-0">
                  <div className="h-8 w-16 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
                  <div className="h-8 w-16 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl">
            <p className="text-sm font-bold text-zinc-450">No pending follow requests</p>
            <p className="text-xs text-zinc-400 mt-1">Incoming follow requests will show up here</p>
          </div>
        ) : (
          <div className="space-y-2 text-left">
            {requests.map((req) => {
              const u = req.requester;
              if (!u) return null;

              return (
                <div
                  key={req.id}
                  className="flex items-center justify-between p-3.5 bg-white dark:bg-zinc-900 border border-zinc-200/40 dark:border-zinc-800/80 rounded-2.5xl shadow-sm"
                >
                  <Link href={`/${u.username}`} className="flex items-center space-x-3.5 min-w-0 mr-4">
                    {u.profile_picture ? (
                      <img
                        src={u.profile_picture}
                        alt={u.username}
                        className="h-10 w-10 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center font-bold text-white text-sm shrink-0">
                        {u.username?.charAt(0).toUpperCase()}
                      </div>
                    )}
                    
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-black text-zinc-900 dark:text-zinc-50 truncate leading-tight">
                        @{u.username}
                      </span>
                      <span className="text-[10px] text-zinc-400 font-semibold truncate leading-none mt-0.5">
                        {u.full_name}
                      </span>
                    </div>
                  </Link>

                  <div className="flex space-x-2 shrink-0">
                    <button
                      onClick={() => handleRequestAction(req.id, 'accept')}
                      className="px-3.5 py-2 bg-primary hover:bg-primary-hover text-white text-[10px] font-black rounded-xl transition cursor-pointer flex items-center space-x-1"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>Accept</span>
                    </button>
                    <button
                      onClick={() => handleRequestAction(req.id, 'reject')}
                      className="px-3.5 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-750 dark:text-zinc-350 text-[10px] font-black rounded-xl transition cursor-pointer flex items-center space-x-1"
                    >
                      <X className="h-3.5 w-3.5" />
                      <span>Ignore</span>
                    </button>
                  </div>
                </div>
              );
            })}

            {hasNext && (
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="w-full text-center py-2.5 bg-white hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-850 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer mt-4"
              >
                {loadingMore ? (
                  <div className="h-4 w-4 rounded-full border-2 border-zinc-200 border-t-primary animate-spin" />
                ) : (
                  <span>Load More Requests</span>
                )}
              </button>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
