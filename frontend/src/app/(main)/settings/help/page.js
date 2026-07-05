'use client';

import { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp, Check, MessageSquare, ExternalLink } from 'lucide-react';

export default function HelpSettingsPage() {
  const [toast, setToast] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [problemCategory, setProblemCategory] = useState('bug'); // 'bug' | 'abuse' | 'account' | 'other'
  const [problemDesc, setProblemDesc] = useState('');

  // Expandable FAQs
  const [expandedFaq, setExpandedFaq] = useState(null);

  const faqs = [
    { q: 'How do I set my account to private?', a: 'Go to Settings > Privacy & Safety, toggle the "Private Account" option, and click save. Once enabled, only people you approve can follow you and view your content.' },
    { q: 'Where do I find my blocked list?', a: 'You can manage blocked users directly under Settings > Privacy & Safety. Use the block list manager to search and block profiles or unblock existing ones.' },
    { q: 'How do I change my profile settings?', a: 'Navigate to Settings > Edit Profile. You can update your profile avatar, cover banner, location, biography details, and gender choices there.' },
    { q: 'What is Creator Account type?', a: 'Creator accounts have access to public discoverability recommendations, analytics insights, and search rankings suited for businesses and popular influencers.' },
  ];

  const handleReportSubmit = (e) => {
    e.preventDefault();
    if (!problemDesc.trim()) return;

    setLoading(true);
    setTimeout(() => {
      setToast(true);
      setProblemDesc('');
      setLoading(false);
      setTimeout(() => setToast(false), 3000);
    }, 800);
  };

  return (
    <div className="space-y-6 text-left">
      <div>
        <h1 className="text-xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight flex items-center space-x-2">
          <HelpCircle className="h-5.5 w-5.5 text-primary" />
          <span>Help & Support</span>
        </h1>
        <p className="text-[11px] text-zinc-400 font-semibold mt-0.5 leading-none">Find answers to frequently asked questions or report issues</p>
      </div>

      {toast && (
        <div className="p-4 rounded-2xl flex items-center space-x-2 text-xs font-bold leading-normal bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-250 dark:border-emerald-900 text-emerald-800 dark:text-emerald-400">
          <Check className="h-4 w-4 shrink-0" />
          <span>Support ticket submitted successfully! We will review this shortly.</span>
        </div>
      )}

      {/* 1. Expandable FAQs Accordion */}
      <div className="space-y-3">
        <h3 className="text-xs font-black text-zinc-850 dark:text-zinc-250 uppercase tracking-wider">Frequently Asked Questions</h3>
        
        <div className="space-y-2">
          {faqs.map((faq, idx) => {
            const isOpen = expandedFaq === idx;
            return (
              <div key={idx} className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-205 dark:border-zinc-800/80 rounded-2.5xl overflow-hidden">
                <button
                  onClick={() => setExpandedFaq(isOpen ? null : idx)}
                  className="w-full flex items-center justify-between p-4 text-left font-bold text-xs text-zinc-800 dark:text-zinc-200 cursor-pointer focus:outline-none"
                >
                  <span>{faq.q}</span>
                  {isOpen ? <ChevronUp className="h-4 w-4 text-zinc-450 shrink-0" /> : <ChevronDown className="h-4 w-4 text-zinc-450 shrink-0" />}
                </button>
                {isOpen && (
                  <div className="p-4 pt-0 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 border-t border-zinc-100 dark:border-zinc-850 leading-relaxed whitespace-pre-wrap">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Report a Problem Form */}
      <form onSubmit={handleReportSubmit} className="space-y-4 pt-4 border-t border-zinc-150 dark:border-zinc-850">
        <div>
          <h3 className="text-xs font-black text-zinc-850 dark:text-zinc-250 uppercase tracking-wider flex items-center space-x-1.5">
            <MessageSquare className="h-4 w-4 text-primary" />
            <span>Report a Problem</span>
          </h3>
          <p className="text-[10px] text-zinc-400 font-semibold mt-0.5 leading-none">Describe any bugs or report abusive behavior.</p>
        </div>

        <div className="flex flex-col space-y-3">
          <div className="flex flex-col space-y-1">
            <label className="text-[9px] font-black text-zinc-450 uppercase tracking-wider">Issue Type</label>
            <select
              value={problemCategory}
              onChange={(e) => setProblemCategory(e.target.value)}
              className="px-3 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer font-bold text-zinc-800 dark:text-zinc-200"
            >
              <option value="bug">Report a Bug / Technical Glitch</option>
              <option value="abuse">Report Abuse / Harassment</option>
              <option value="account">Account Recovery Issues</option>
              <option value="other">Other Inquiry</option>
            </select>
          </div>

          <div className="flex flex-col space-y-1">
            <label className="text-[9px] font-black text-zinc-450 uppercase tracking-wider">Detailed Description</label>
            <textarea
              rows={4}
              required
              placeholder="Provide a step-by-step description of what you were doing or details of the issue..."
              value={problemDesc}
              onChange={(e) => setProblemDesc(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary text-xs resize-none"
            />
          </div>
        </div>

        <div className="flex justify-between items-center pt-2">
          <a
            href="https://google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-black text-primary hover:underline flex items-center space-x-1"
          >
            <span>Visit Help Center</span>
            <ExternalLink className="h-3 w-3" />
          </a>

          <button
            type="submit"
            disabled={loading || !problemDesc.trim()}
            className="px-5 py-3 rounded-2xl text-xs font-black text-white bg-primary hover:bg-primary-hover shadow-md transition flex items-center space-x-1.5 cursor-pointer disabled:bg-zinc-200 dark:disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="h-4 w-4 rounded-full border-2 border-zinc-200 border-t-primary animate-spin" />
            ) : (
              <span>Submit Ticket</span>
            )}
          </button>
        </div>
      </form>

    </div>
  );
}
