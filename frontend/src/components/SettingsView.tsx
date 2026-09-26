'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Key, 
  Mail, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Eye, 
  EyeOff, 
  Info,
  ShieldCheck,
  Save
} from 'lucide-react';

interface SettingsData {
  provider: 'resend' | 'simulation';
  fromEmail: string;
  fromName: string;
  hasApiKey: boolean;
  maskedApiKey: string;
}

export const SettingsView: React.FC = () => {
  const [provider, setProvider] = useState<'resend' | 'simulation'>('resend');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [fromEmail, setFromEmail] = useState('onboarding@resend.dev');
  const [fromName, setFromName] = useState('CampaignPulse');
  const [hasExistingKey, setHasExistingKey] = useState(false);
  const [maskedKey, setMaskedKey] = useState('');

  const [testEmail, setTestEmail] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [loading, setLoading] = useState(true);

  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [testMessage, setTestMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/settings`);
      if (res.ok) {
        const data: SettingsData = await res.json();
        setProvider(data.provider || 'resend');
        setFromEmail(data.fromEmail || 'onboarding@resend.dev');
        setFromName(data.fromName || 'CampaignPulse');
        setHasExistingKey(data.hasApiKey);
        setMaskedKey(data.maskedApiKey || '');
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  }, [API_URL]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveMessage(null);

    try {
      const res = await fetch(`${API_URL}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          resendApiKey: apiKey || undefined,
          fromEmail,
          fromName,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save settings');

      setSaveMessage({ type: 'success', text: 'Settings saved successfully!' });
      setApiKey('');
      fetchSettings();
    } catch (err: unknown) {
      const text = err instanceof Error ? err.message : 'Error saving settings';
      setSaveMessage({ type: 'error', text });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!testEmail || !testEmail.includes('@')) {
      setTestMessage({ type: 'error', text: 'Please enter a valid email address.' });
      return;
    }

    setIsSendingTest(true);
    setTestMessage(null);

    try {
      const res = await fetch(`${API_URL}/api/settings/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testEmail }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send test email');

      setTestMessage({
        type: 'success',
        text: `✅ Test email successfully dispatched to ${testEmail}! Check your inbox.`,
      });
    } catch (err: unknown) {
      const text = err instanceof Error ? err.message : 'Failed to send test email';
      setTestMessage({ type: 'error', text });
    } finally {
      setIsSendingTest(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        <p className="text-sm text-slate-400">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white tracking-tight">Email Provider Settings</h2>
        <p className="text-sm text-slate-400 mt-1">
          Configure real delivery credentials (Resend) or switch to simulation mode for sandbox testing.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Settings Form */}
        <div className="md:col-span-2 space-y-6">
          <form onSubmit={handleSave} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
            {saveMessage && (
              <div
                className={`p-4 rounded-xl text-sm flex items-center gap-2 ${
                  saveMessage.type === 'success'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                }`}
              >
                {saveMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                <span>{saveMessage.text}</span>
              </div>
            )}

            {/* Provider Mode Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Delivery Mode</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setProvider('resend')}
                  className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-sm font-medium transition ${
                    provider === 'resend'
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                      : 'bg-slate-800/40 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  <Mail className="w-4 h-4" /> Resend (Real Delivery)
                </button>
                <button
                  type="button"
                  onClick={() => setProvider('simulation')}
                  className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-sm font-medium transition ${
                    provider === 'simulation'
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                      : 'bg-slate-800/40 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" /> Simulation (Sandbox)
                </button>
              </div>
            </div>

            {/* Resend API Key */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-slate-300">Resend API Key</label>
                {hasExistingKey && (
                  <span className="text-xs text-emerald-400 flex items-center gap-1 font-mono">
                    <CheckCircle2 className="w-3 h-3" /> Active ({maskedKey})
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={hasExistingKey ? 'Enter new key to replace existing' : 're_xxxxxxxxxxxxxxxxxxxx'}
                  className="w-full px-4 py-2.5 pr-10 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-mono transition"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-1.5">
                Obtain your API key from <a href="https://resend.com/api-keys" target="_blank" rel="noreferrer" className="text-indigo-400 underline">resend.com/api-keys</a>.
              </p>
            </div>

            {/* Sender Email */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">From Email Address</label>
              <input
                type="email"
                required
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                placeholder="onboarding@resend.dev or mail@yourdomain.com"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition"
              />
              <p className="text-xs text-slate-500 mt-1.5">
                Use <code className="text-slate-400">onboarding@resend.dev</code> for testing or your verified domain.
              </p>
            </div>

            {/* Sender Name */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">From Name (Display Name)</label>
              <input
                type="text"
                required
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="e.g. CampaignPulse, My Company"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition"
              />
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition shadow-lg shadow-indigo-600/25 text-sm"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Configuration
            </button>
          </form>
        </div>

        {/* Sidebar: Test Email & Guidance */}
        <div className="space-y-6">
          {/* Test Dispatch Box */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
              <Send className="w-4 h-4 text-indigo-400" /> Verify Sending
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Send a test email to verify your API key and sender address before launching a bulk blast.
            </p>

            {testMessage && (
              <div
                className={`p-3 rounded-xl text-xs mb-3 flex items-start gap-2 ${
                  testMessage.type === 'success'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                }`}
              >
                {testMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                <span>{testMessage.text}</span>
              </div>
            )}

            <div className="space-y-3">
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="your.email@gmail.com"
                className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={handleSendTestEmail}
                disabled={isSendingTest || !testEmail}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white text-xs font-semibold border border-slate-700 transition"
              >
                {isSendingTest ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Send Test Email
              </button>
            </div>
          </div>

          {/* Quick Info Box */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 text-xs text-slate-400 space-y-3">
            <div className="flex items-center gap-2 text-indigo-400 font-semibold">
              <Info className="w-4 h-4" /> Resend Quick Tips
            </div>
            <p>
              • <strong>Unverified Domains</strong>: If you do not own a domain, keep sender as <code className="text-slate-300">onboarding@resend.dev</code>. You can only deliver to the email associated with your Resend account.
            </p>
            <p>
              • <strong>Custom Domains</strong>: Once you add and verify your domain in Resend DNS, you can send to any customer address worldwide.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
