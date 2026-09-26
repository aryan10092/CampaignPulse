'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Mail, Eye, Loader2, Sparkles } from 'lucide-react';
import { Campaign } from '../types';
import { apiFetch } from '../lib/api';

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

  const fetchCampaigns = useCallback(async () => {
    try {
      const res = await apiFetch('/api/campaigns');
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data.campaigns || []);
      }
    } catch (err) {
      console.error('Failed to load campaigns:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <Loader2 className="w-5 h-5 text-zinc-500 animate-spin" />
        <p className="text-xs font-mono text-zinc-500">LOADING_CAMPAIGNS...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-900">
        <div>
          <h2 className="text-lg font-semibold text-white tracking-tight">Campaigns</h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            History of queued and delivered email blasts.
          </p>
        </div>
        <button
          onClick={onNewCampaign}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-zinc-200 text-black font-medium text-xs transition"
        >
          <Sparkles className="w-3.5 h-3.5" /> New Campaign
        </button>
      </div>

      {campaigns.length === 0 ? (
        <div className="border border-zinc-800 bg-zinc-950 rounded-xl p-12 text-center">
          <Mail className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-white">No campaigns found</h3>
          <p className="text-xs text-zinc-500 mt-1 max-w-xs mx-auto mb-5">
            Upload your first customer CSV to start sending bulk emails.
          </p>
          <button
            onClick={onNewCampaign}
            className="px-3.5 py-1.5 rounded-lg bg-white text-black text-xs font-semibold hover:bg-zinc-200 transition"
          >
            Create Campaign
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((camp) => {
            const isCompleted = camp.status === 'COMPLETED' || camp.percentage === 100;

            return (
              <div
                key={camp.id}
                className="bg-zinc-950 border border-zinc-800 hover:border-zinc-700 rounded-xl p-4 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2.5 mb-1">
                    <h3 className="text-sm font-semibold text-white tracking-tight">
                      {camp.title}
                    </h3>
                    <span
                      className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border ${
                        isCompleted
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-zinc-900 text-zinc-300 border-zinc-700'
                      }`}
                    >
                      {camp.status}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 line-clamp-1 mb-2.5 font-mono">
                    Subject: &ldquo;{camp.subject}&rdquo;
                  </p>

                  {/* Progress Mini Bar */}
                  <div className="w-full max-w-sm">
                    <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800 mb-1">
                      <div
                        className="h-full bg-emerald-400 transition-all duration-300"
                        style={{ width: `${Math.min(100, camp.percentage)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                      <span>{camp.percentage}%</span>
                      <span>
                        {camp.sent_count + camp.failed_count} / {camp.total_count}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Numbers & Button */}
                <div className="flex items-center gap-3 text-xs font-mono">
                  <div className="text-center px-3 py-1.5 rounded-lg bg-black border border-zinc-800 min-w-[60px]">
                    <div className="text-zinc-500 text-[9px] uppercase">Sent</div>
                    <div className="text-emerald-400 font-bold">{camp.sent_count}</div>
                  </div>

                  <div className="text-center px-3 py-1.5 rounded-lg bg-black border border-zinc-800 min-w-[60px]">
                    <div className="text-zinc-500 text-[9px] uppercase">Failed</div>
                    <div className="text-rose-400 font-bold">{camp.failed_count}</div>
                  </div>

                  <button
                    onClick={() => onSelectCampaign(camp.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-xs border border-zinc-800 hover:border-zinc-700 transition"
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
