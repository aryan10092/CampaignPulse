'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Mail, Eye, Loader2, Sparkles } from 'lucide-react';
import { Campaign } from '../types';

interface CampaignsListProps {
  onSelectCampaign: (campaignId: string) => void;
  onNewCampaign: () => void;
}

export const CampaignsList: React.FC<CampaignsListProps> = ({
  onSelectCampaign,
  onNewCampaign,
}) => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

  const fetchCampaigns = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/campaigns`);
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data.campaigns || []);
      }
    } catch (err) {
      console.error('Failed to load campaigns:', err);
    } finally {
      setLoading(false);
    }
  }, [API_URL]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        <p className="text-sm text-slate-400">Loading campaigns...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Campaigns History</h2>
          <p className="text-sm text-slate-400 mt-1">
            Monitor ongoing email dispatches and review completed campaign analytics.
          </p>
        </div>
        <button
          onClick={onNewCampaign}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition shadow-lg shadow-indigo-600/20"
        >
          <Sparkles className="w-4 h-4" /> New Campaign
        </button>
      </div>

      {campaigns.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
          <Mail className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white">No campaigns created yet</h3>
          <p className="text-sm text-slate-400 mt-1 max-w-sm mx-auto mb-6">
            Get started by uploading a customer CSV to launch your first high-throughput email campaign.
          </p>
          <button
            onClick={onNewCampaign}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 transition"
          >
            Create Your First Campaign
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {campaigns.map((camp) => {
            const isCompleted = camp.status === 'COMPLETED' || camp.percentage === 100;

            return (
              <div
                key={camp.id}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 transition shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-6"
              >
                {/* Left Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-lg font-bold text-white tracking-tight">
                      {camp.title}
                    </h3>
                    <span
                      className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                        isCompleted
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse'
                      }`}
                    >
                      {camp.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-1 mb-3">
                    Subject: &ldquo;{camp.subject}&rdquo;
                  </p>

                  {/* Progress Bar Mini */}
                  <div className="w-full max-w-md">
                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mb-1.5 border border-slate-700/50">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-300"
                        style={{ width: `${Math.min(100, camp.percentage)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                      <span>{camp.percentage}% complete</span>
                      <span>
                        {camp.sent_count + camp.failed_count} / {camp.total_count}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Stat pills */}
                <div className="flex items-center gap-4 text-xs font-mono">
                  <div className="text-center px-3 py-2 rounded-xl bg-slate-800/60 border border-slate-700/60 min-w-[70px]">
                    <div className="text-slate-400 text-[10px] uppercase">Sent</div>
                    <div className="text-emerald-400 font-bold text-sm">
                      {camp.sent_count}
                    </div>
                  </div>

                  <div className="text-center px-3 py-2 rounded-xl bg-slate-800/60 border border-slate-700/60 min-w-[70px]">
                    <div className="text-slate-400 text-[10px] uppercase">Failed</div>
                    <div className="text-rose-400 font-bold text-sm">
                      {camp.failed_count}
                    </div>
                  </div>

                  <button
                    onClick={() => onSelectCampaign(camp.id)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs border border-slate-700 transition"
                  >
                    <Eye className="w-3.5 h-3.5" /> Monitor
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
