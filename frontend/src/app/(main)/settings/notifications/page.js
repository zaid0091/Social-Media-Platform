'use client';

import { useState, useEffect } from 'react';
import { Bell, Mail, Monitor, Check, AlertCircle, Save } from 'lucide-react';

export default function NotificationsSettingsPage() {
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);

  // Notifications states
  const [emailLikes, setEmailLikes] = useState(true);
  const [emailComments, setEmailComments] = useState(true);
  const [emailFollowers, setEmailFollowers] = useState(true);
  const [pushLikes, setPushLikes] = useState(true);
  const [pushComments, setPushComments] = useState(true);
  const [pushMessages, setPushMessages] = useState(true);
  const [inAppLikes, setInAppLikes] = useState(true);

  // Load preferences
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setEmailLikes(localStorage.getItem('notif_email_likes') !== 'false');
      setEmailComments(localStorage.getItem('notif_email_comments') !== 'false');
      setEmailFollowers(localStorage.getItem('notif_email_followers') !== 'false');
      setPushLikes(localStorage.getItem('notif_push_likes') !== 'false');
      setPushComments(localStorage.getItem('notif_push_comments') !== 'false');
      setPushMessages(localStorage.getItem('notif_push_messages') !== 'false');
      setInAppLikes(localStorage.getItem('notif_inapp_likes') !== 'false');
    }
  }, []);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleSaveSettings = () => {
    setLoading(true);
    try {
      localStorage.setItem('notif_email_likes', emailLikes ? 'true' : 'false');
      localStorage.setItem('notif_email_comments', emailComments ? 'true' : 'false');
      localStorage.setItem('notif_email_followers', emailFollowers ? 'true' : 'false');
      localStorage.setItem('notif_push_likes', pushLikes ? 'true' : 'false');
      localStorage.setItem('notif_push_comments', pushComments ? 'true' : 'false');
      localStorage.setItem('notif_push_messages', pushMessages ? 'true' : 'false');
      localStorage.setItem('notif_inapp_likes', inAppLikes ? 'true' : 'false');
      
      showToast('Notification preferences updated!', 'success');
    } catch (err) {
      showToast('Failed to update notification settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 text-left">
      <div>
        <h1 className="text-xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight flex items-center space-x-2">
          <Bell className="h-5.5 w-5.5 text-primary" />
          <span>Notifications</span>
        </h1>
        <p className="text-[11px] text-zinc-400 font-semibold mt-0.5 leading-none">Configure how and when you receive notification updates</p>
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

      {/* 1. Email alerts */}
      <div className="space-y-3.5">
        <h3 className="text-xs font-black text-zinc-850 dark:text-zinc-250 uppercase tracking-wider flex items-center space-x-1.5">
          <Mail className="h-4 w-4 text-primary" />
          <span>Email Preferences</span>
        </h3>

        {[
          { label: 'Likes on my posts', state: emailLikes, setter: setEmailLikes },
          { label: 'Comments on my posts', state: emailComments, setter: setEmailComments },
          { label: 'New follower updates', state: emailFollowers, setter: setEmailFollowers },
        ].map((item, idx) => (
          <div key={idx} className="flex items-center justify-between p-3.5 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200/50 dark:border-zinc-800 rounded-2.5xl">
            <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{item.label}</span>
            <button
              onClick={() => item.setter(!item.state)}
              className={`w-10 h-5.5 rounded-full transition-colors relative cursor-pointer focus:outline-none ${
                item.state ? 'bg-primary' : 'bg-zinc-300 dark:bg-zinc-700'
              }`}
            >
              <span className={`absolute top-0.75 left-0.75 w-4 h-4 rounded-full bg-white transition-transform ${item.state ? 'translate-x-4.5' : ''}`} />
            </button>
          </div>
        ))}
      </div>

      {/* 2. Push notifications */}
      <div className="space-y-3.5 pt-4 border-t border-zinc-150 dark:border-zinc-850">
        <h3 className="text-xs font-black text-zinc-850 dark:text-zinc-250 uppercase tracking-wider flex items-center space-x-1.5">
          <Monitor className="h-4 w-4 text-primary" />
          <span>Push Preferences</span>
        </h3>

        {[
          { label: 'Likes & Reactions', state: pushLikes, setter: setPushLikes },
          { label: 'Comments & Mentions', state: pushComments, setter: setPushComments },
          { label: 'Direct Messages alerts', state: pushMessages, setter: setPushMessages },
        ].map((item, idx) => (
          <div key={idx} className="flex items-center justify-between p-3.5 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200/50 dark:border-zinc-800 rounded-2.5xl">
            <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{item.label}</span>
            <button
              onClick={() => item.setter(!item.state)}
              className={`w-10 h-5.5 rounded-full transition-colors relative cursor-pointer focus:outline-none ${
                item.state ? 'bg-primary' : 'bg-zinc-300 dark:bg-zinc-700'
              }`}
            >
              <span className={`absolute top-0.75 left-0.75 w-4 h-4 rounded-full bg-white transition-transform ${item.state ? 'translate-x-4.5' : ''}`} />
            </button>
          </div>
        ))}
      </div>

      {/* Submit */}
      <div className="flex justify-end pt-2 border-t border-zinc-155 dark:border-zinc-850">
        <button
          onClick={handleSaveSettings}
          disabled={loading}
          className="px-5 py-3 rounded-2xl text-xs font-black text-white bg-primary hover:bg-primary-hover shadow-md transition flex items-center space-x-1.5 cursor-pointer"
        >
          {loading ? (
            <div className="h-4 w-4 rounded-full border-2 border-zinc-200 border-t-primary animate-spin" />
          ) : (
            <>
              <Save className="h-4 w-4" />
              <span>Save Preferences</span>
            </>
          )}
        </button>
      </div>

    </div>
  );
}
