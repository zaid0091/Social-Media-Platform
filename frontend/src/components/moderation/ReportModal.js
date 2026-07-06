'use client';

import React, { useState, useEffect } from 'react';
import { ShieldAlert, CheckCircle2, ChevronRight, AlertCircle } from 'lucide-react';
import api from '@/services/api';

export default function ReportModal({ isOpen, onClose, targetType, targetId }) {
  const [step, setStep] = useState(1); // 1: Reason, 2: Description, 3: Success
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setReason('');
      setDescription('');
      setError('');
      setLoading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const reasons = [
    { id: 'spam', label: 'Spam', desc: 'Repetitive posts, links, or unwanted messages' },
    { id: 'nudity', label: 'Inappropriate content', desc: 'Explicit pictures, videos, or nudity' },
    { id: 'hate_speech', label: 'Hate speech', desc: 'Attacking a protected group or individual' },
    { id: 'harassment', label: 'Harassment', desc: 'Bullying, threats, or stalking behavior' },
    { id: 'false_information', label: 'False information', desc: 'Misleading news, scams, or hoaxes' },
    { id: 'other', label: 'Something else', desc: 'Any other policy violation or general report' }
  ];

  const handleSelectReason = (selectedId) => {
    setReason(selectedId);
    setStep(2);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');

    const payload = {
      reason,
      description
    };

    if (targetType === 'post') payload.reported_post = targetId;
    else if (targetType === 'comment') payload.reported_comment = targetId;
    else if (targetType === 'story') payload.reported_story = targetId;
    else if (targetType === 'user') payload.reported_user = targetId;

    try {
      await api.post('/moderation/reports/create/', payload);
      setStep(3);
    } catch (err) {
      console.error('Failed to submit report', err);
      setError(err.response?.data?.error || 'Failed to submit report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl max-w-md w-full shadow-2xl relative z-10 overflow-hidden text-left flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 border-b border-zinc-150 dark:border-zinc-800/80 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="h-5 w-5 text-red-500" />
            <h2 className="text-base font-black text-zinc-900 dark:text-zinc-50 leading-tight">
              Report {targetType}
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xs font-black select-none cursor-pointer"
          >
            Cancel
          </button>
        </div>

        {/* Content steps */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {error && (
            <div className="p-3.5 bg-red-50 dark:bg-red-950/20 text-red-500 rounded-2xl text-xs font-bold flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3.5">
              <div className="px-1">
                <h3 className="text-sm font-black text-zinc-800 dark:text-zinc-200">Why are you reporting this content?</h3>
                <p className="text-[10px] text-zinc-400 font-semibold mt-0.5">Your report is anonymous. We will review this report against our safety guidelines.</p>
              </div>
              <div className="flex flex-col space-y-2">
                {reasons.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => handleSelectReason(r.id)}
                    className="w-full p-3.5 bg-zinc-50 hover:bg-zinc-100/80 dark:bg-zinc-950 dark:hover:bg-zinc-850 border border-zinc-200/50 dark:border-zinc-800 rounded-2xl flex items-center justify-between group transition text-left cursor-pointer"
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <span className="text-xs font-black text-zinc-900 dark:text-zinc-50 leading-tight">{r.label}</span>
                      <span className="text-[10px] text-zinc-450 font-semibold mt-0.5 leading-tight truncate">{r.desc}</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-1 px-1 text-left">
                <span className="text-[10px] font-black uppercase text-primary tracking-wider">Step 2 of 2</span>
                <h3 className="text-sm font-black text-zinc-800 dark:text-zinc-200">Any additional details? (Optional)</h3>
                <p className="text-[10px] text-zinc-400 font-semibold mt-0.5">Provide details that can help our moderation team review this content quickly.</p>
              </div>

              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Details of the violation..."
                rows="4"
                className="w-full p-4 text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/60 dark:border-zinc-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary text-zinc-800 dark:text-zinc-100"
                disabled={loading}
              />

              <div className="flex space-x-2 pt-2">
                <button
                  onClick={() => setStep(1)}
                  disabled={loading}
                  className="flex-1 py-3 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-850 text-xs font-black text-zinc-700 dark:text-zinc-300 rounded-2xl transition cursor-pointer select-none"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-1 py-3 bg-primary hover:bg-primary-hover text-xs font-black text-white rounded-2xl shadow-sm transition cursor-pointer select-none flex items-center justify-center"
                >
                  {loading ? (
                    <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  ) : (
                    'Submit Report'
                  )}
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="py-6 text-center flex flex-col items-center space-y-4">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-500 rounded-full animate-bounce">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <div className="space-y-1 px-4">
                <h3 className="text-base font-black text-zinc-900 dark:text-zinc-50">Report Submitted</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-semibold leading-relaxed">
                  Thank you for keeping our platform safe. Our team typically reviews reports within 24 hours. We will notify you when a decision has been reached.
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-full py-3 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-xs font-black text-zinc-800 dark:text-zinc-200 rounded-2xl transition cursor-pointer select-none mt-2"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
