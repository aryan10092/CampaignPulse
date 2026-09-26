'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { 
  Users, 
  CheckCircle2, 
  Loader2, 
  AlertOctagon, 
  ArrowLeft,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { Campaign, Recipient, CampaignProgressEvent, RecipientUpdateEvent } from '../types';
import { getSocket } from '../lib/socket';
import { apiFetch } from '../lib/api';

interface CampaignDashboardProps {
  campaignId: string;
  onBack: () => void;
}

export const CampaignDashboard: React.FC<CampaignDashboardProps> = ({
  campaignId,
  onBack,
}) => {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCampaignData = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/campaigns/${campaignId}`);
      if (!res.ok) throw new Error('Failed to load campaign');
      const data = await res.json();
      setCampaign(data.campaign);
      setRecipients(data.recentRecipients || []);
      setError(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error loading campaign details';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    fetchCampaignData();

    const socket = getSocket();
    socket.emit('join:campaign', campaignId);

    socket.on('campaign:progress', (event: CampaignProgressEvent) => {
      if (event.campaignId === campaignId) {
        setCampaign((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            total_count: event.total,
            sent_count: event.sent,
            processing_count: event.processing,
            failed_count: event.failed,
            percentage: event.percentage,
            status: event.status,
          };
        });
      }
    });

    socket.on('recipient:updated', (event: RecipientUpdateEvent) => {
      setRecipients((prev) => {
        const updated: Recipient = {
          id: event.recipientId,
          email: event.email,
          name: event.name,
          status: event.status,
          sent_at: event.sentAt || new Date().toISOString(),
          error_reason: event.errorReason,
        };

        const filtered = prev.filter((r) => String(r.id) !== String(event.recipientId));
        return [updated, ...filtered.slice(0, 49)];
      });
    });

    return () => {
      socket.emit('leave:campaign', campaignId);
      socket.off('campaign:progress');
      socket.off('recipient:updated');
    };
  }, [campaignId, fetchCampaignData]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="w-5 h-5 text-zinc-500 animate-spin" />
        <p className="text-xs font-mono text-zinc-500">FETCHING_METRICS...</p>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="max-w-md mx-auto my-16 p-6 bg-zinc-950 border border-zinc-800 rounded-xl text-center">
        <p className="text-rose-400 text-xs font-mono mb-4">{error || 'Campaign not found'}</p>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-xs hover:border-zinc-700"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Return
        </button>
      </div>
    );
  }

  const isCompleted = campaign.status === 'COMPLETED' || campaign.percentage === 100;

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 space-y-6">
      {/* Top Bar Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-mono text-zinc-400 hover:text-white transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> ALL_CAMPAIGNS
        </button>
        <button
          onClick={fetchCampaignData}
          className="flex items-center gap-1.5 text-xs font-mono text-zinc-400 hover:text-white bg-zinc-950 px-2.5 py-1 rounded-md border border-zinc-800 hover:border-zinc-700 transition"
        >
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      </div>

      {/* Campaign Header Banner */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-900">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-white tracking-tight">
                {campaign.title}
              </h2>
              <span
                className={`text-[11px] font-mono uppercase px-2 py-0.5 rounded border ${
                  isCompleted
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-zinc-900 text-zinc-300 border-zinc-700'
                }`}
              >
                {campaign.status}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-1 font-mono">
              Subject: &ldquo;{campaign.subject}&rdquo;
            </p>
          </div>

          {isCompleted && (
            <div className="flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-md text-xs font-mono">
              <Sparkles className="w-3.5 h-3.5" /> All jobs finished
            </div>
          )}
        </div>

        {/* Progress Bar Section */}
        <div className="mt-5">
          <div className="flex items-center justify-between text-xs font-mono mb-2">
            <span className="text-zinc-400">DISPATCH_PROGRESS</span>
            <span className="text-white font-bold">{campaign.percentage}%</span>
          </div>

          {/* Minimal high contrast bar */}
          <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
            <div
              className="h-full bg-emerald-400 transition-all duration-300 ease-out shadow-[0_0_12px_rgba(52,211,153,0.5)]"
              style={{ width: `${Math.min(100, campaign.percentage)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-zinc-500 mt-2 font-mono">
            <span>
              {campaign.sent_count + campaign.failed_count} / {campaign.total_count} processed
            </span>
            <span>Workers: 5 &bull; Rate limit: 5/sec</span>
          </div>
        </div>
      </div>

      {/* 4 Primary Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">
              Total
            </span>
            <Users className="w-3.5 h-3.5 text-zinc-500" />
          </div>
          <div className="text-2xl font-mono font-bold text-white">
            {campaign.total_count.toLocaleString()}
          </div>
          <p className="text-[10px] font-mono text-zinc-500 mt-1">Queued customers</p>
        </div>

        {/* Sent */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">
              Sent
            </span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-2xl font-mono font-bold text-emerald-400">
            {campaign.sent_count.toLocaleString()}
          </div>
          <p className="text-[10px] font-mono text-zinc-500 mt-1">Delivered via SMTP</p>
        </div>

        {/* Processing */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">
              Processing
            </span>
            <Loader2 className={`w-3.5 h-3.5 text-amber-400 ${!isCompleted ? 'animate-spin' : ''}`} />
          </div>
          <div className="text-2xl font-mono font-bold text-amber-400">
            {campaign.processing_count.toLocaleString()}
          </div>
          <p className="text-[10px] font-mono text-zinc-500 mt-1">In BullMQ queue</p>
        </div>

        {/* Failed */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">
              Failed
            </span>
            <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="text-2xl font-mono font-bold text-rose-400">
            {campaign.failed_count.toLocaleString()}
          </div>
          <p className="text-[10px] font-mono text-zinc-500 mt-1">Bounced / Rejected</p>
        </div>
      </div>

      {/* Live Activity Stream Table */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-zinc-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-300">Live_Event_Stream</h3>
          </div>
          <span className="text-[11px] font-mono text-zinc-500">
            {recipients.length} events buffered
          </span>
        </div>

        <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
          {recipients.length === 0 ? (
            <div className="p-8 text-center text-zinc-600 text-xs font-mono">
              WAITING_FOR_WORKER_EVENTS...
            </div>
          ) : (
            <table className="w-full text-left text-xs font-mono text-zinc-300">
              <thead className="bg-black/60 text-[10px] uppercase text-zinc-500 sticky top-0 backdrop-blur border-b border-zinc-900">
                <tr>
                  <th className="py-2.5 px-4">Recipient</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Timestamp / Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {recipients.map((r, index) => (
                  <tr key={`${r.id}-${index}`} className="hover:bg-zinc-900/40 transition">
                    <td className="py-2.5 px-4">
                      <span className="text-zinc-100">{r.email}</span>
                      {r.name && <span className="text-zinc-500 ml-2">({r.name})</span>}
                    </td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono border ${
                          r.status === 'SENT'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : r.status === 'FAILED'
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            : 'bg-zinc-900 text-zinc-400 border-zinc-800'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-zinc-500 text-[11px]">
                      {r.status === 'FAILED' && r.error_reason ? (
                        <span className="text-rose-400">{r.error_reason}</span>
                      ) : (
                        <span>
                          {r.sent_at
                            ? new Date(r.sent_at).toLocaleTimeString()
                            : 'in-flight'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
