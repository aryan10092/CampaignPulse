'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { 
  Users, 
  CheckCircle2, 
  Loader2, 
  AlertOctagon, 
  Mail, 
  ArrowLeft,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { Campaign, Recipient, CampaignProgressEvent, RecipientUpdateEvent } from '../types';
import { getSocket } from '../lib/socket';

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

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

  const fetchCampaignData = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/campaigns/${campaignId}`);
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
  }, [API_URL, campaignId]);

  useEffect(() => {
    fetchCampaignData();

    // Setup Socket.IO subscription
    const socket = getSocket();

    // Join campaign room
    socket.emit('join:campaign', campaignId);

    // Listen for throttled campaign progress updates
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

    // Listen for live recipient status events
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
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        <p className="text-sm text-slate-400">Loading campaign metrics...</p>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="max-w-xl mx-auto my-12 p-6 bg-slate-900 border border-slate-800 rounded-2xl text-center">
        <p className="text-rose-400 text-sm mb-4">{error || 'Campaign not found'}</p>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 text-white text-sm hover:bg-slate-700"
        >
          <ArrowLeft className="w-4 h-4" /> Go back
        </button>
      </div>
    );
  }

  const isCompleted = campaign.status === 'COMPLETED' || campaign.percentage === 100;

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6">
      {/* Top Bar Navigation */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" /> All Campaigns
        </button>
        <button
          onClick={fetchCampaignData}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Campaign Header Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 mb-8 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-white tracking-tight">
                {campaign.title}
              </h2>
              <span
                className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                  isCompleted
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse'
                }`}
              >
                {campaign.status}
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-1 flex items-center gap-2">
              <Mail className="w-4 h-4 text-indigo-400" />
              <span>Subject: &ldquo;{campaign.subject}&rdquo;</span>
            </p>
          </div>

          {isCompleted && (
            <div className="flex items-center gap-2 text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-xl text-xs font-semibold self-start sm:self-auto">
              <Sparkles className="w-4 h-4" /> All Emails Processed
            </div>
          )}
        </div>

        {/* Progress Bar Section */}
        <div className="mt-8">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="font-medium text-slate-300">Overall Progress</span>
            <span className="font-bold text-white font-mono text-base">
              {campaign.percentage}%
            </span>
          </div>

          {/* Graphical Progress Bar */}
          <div className="w-full h-4 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700/60 shadow-inner">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-emerald-500 to-emerald-400 transition-all duration-300 ease-out shadow-lg shadow-emerald-500/30"
              style={{ width: `${Math.min(100, campaign.percentage)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 mt-2 font-mono">
            <span>
              {campaign.sent_count + campaign.failed_count} of {campaign.total_count} processed
            </span>
            <span>Worker concurrency: 10 &bull; Rate: 50/sec</span>
          </div>
        </div>
      </div>

      {/* 4 Primary Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Total */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Total
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white font-mono">
            {campaign.total_count.toLocaleString()}
          </div>
          <p className="text-xs text-slate-500 mt-1">Recipients queued</p>
        </div>

        {/* Sent */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Sent
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-emerald-400 font-mono">
            {campaign.sent_count.toLocaleString()}
          </div>
          <p className="text-xs text-slate-500 mt-1">Dispatched successfully</p>
        </div>

        {/* Processing */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Processing
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Loader2 className={`w-4 h-4 ${!isCompleted ? 'animate-spin' : ''}`} />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-amber-400 font-mono">
            {campaign.processing_count.toLocaleString()}
          </div>
          <p className="text-xs text-slate-500 mt-1">In Redis / Worker pool</p>
        </div>

        {/* Failed */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Failed
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center">
              <AlertOctagon className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-rose-400 font-mono">
            {campaign.failed_count.toLocaleString()}
          </div>
          <p className="text-xs text-slate-500 mt-1">Bounced / Rejected</p>
        </div>
      </div>

      {/* Live Activity Stream Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-white">Live Activity Stream</h3>
            <p className="text-xs text-slate-400">
              Real-time recipient dispatch stream via WebSocket notifications
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500">
            Showing latest {recipients.length} events
          </span>
        </div>

        <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
          {recipients.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              Waiting for workers to pick up email jobs...
            </div>
          ) : (
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-800/60 text-xs uppercase font-medium text-slate-400 sticky top-0 backdrop-blur">
                <tr>
                  <th className="py-3 px-4">Recipient</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Timestamp / Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {recipients.map((r, index) => (
                  <tr key={`${r.id}-${index}`} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-mono text-xs">
                      <div className="font-semibold text-white">{r.name || 'Customer'}</div>
                      <div className="text-slate-400">{r.email}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                          r.status === 'SENT'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : r.status === 'FAILED'
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        }`}
                      >
                        {r.status === 'SENT' && <CheckCircle2 className="w-3 h-3" />}
                        {r.status === 'FAILED' && <AlertOctagon className="w-3 h-3" />}
                        {r.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-400">
                      {r.status === 'FAILED' && r.error_reason ? (
                        <span className="text-rose-400 font-mono">{r.error_reason}</span>
                      ) : (
                        <span>
                          {r.sent_at
                            ? new Date(r.sent_at).toLocaleTimeString()
                            : 'In transit'}
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
