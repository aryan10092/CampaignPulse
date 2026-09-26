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
  Save,
  ExternalLink
} from 'lucide-react';
import { apiFetch } from '../lib/api';

interface SettingsData {
  provider: 'nodemailer' | 'resend';
  fromEmail: string;
  fromName: string;
  smtpUser: string;
  hasSmtpPass: boolean;
  maskedSmtpPass: string;
  hasApiKey: boolean;
  maskedApiKey: string;
  configured: boolean;
}

export const SettingsView: React.FC = () => {
  const [provider, setProvider] = useState<'nodemailer' | 'resend'>('nodemailer');
  
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [hasExistingSmtpPass, setHasExistingSmtpPass] = useState(false);

  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [hasExistingKey, setHasExistingKey] = useState(false);
  const [maskedKey, setMaskedKey] = useState('');
  const [configured, setConfigured] = useState(false);

  const [fromEmail, setFromEmail] = useState('');
  const [fromName, setFromName] = useState('CampaignPulse');

  const [testEmail, setTestEmail] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [loading, setLoading] = useState(true);

  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [testMessage, setTestMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await apiFetch('/api/settings');
      if (res.ok) {
        const data: SettingsData = await res.json();
        setProvider(data.provider === 'resend' ? 'resend' : 'nodemailer');
        setSmtpUser(data.smtpUser || '');
        setHasExistingSmtpPass(data.hasSmtpPass);
        setFromEmail(data.fromEmail || data.smtpUser || '');
        setFromName(data.fromName || 'CampaignPulse');
        setHasExistingKey(data.hasApiKey);
        setMaskedKey(data.maskedApiKey || '');
        setConfigured(Boolean(data.configured));
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveMessage(null);

    try {
      const res = await apiFetch('/api/settings', {
        method: 'POST',
        body: JSON.stringify({
          provider,
          smtpUser,
          smtpPass: smtpPass || undefined,
          resendApiKey: apiKey || undefined,
          fromEmail: fromEmail || smtpUser,
          fromName,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save settings');

      setSaveMessage({ type: 'success', text: 'Settings saved successfully.' });
      setSmtpPass('');
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
      setTestMessage({ type: 'error', text: 'Valid email address required.' });
      return;
    }

    setIsSendingTest(true);
    setTestMessage(null);

    try {
      const res = await apiFetch('/api/settings/test', {
        method: 'POST',
        body: JSON.stringify({ testEmail }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send test email');

      setTestMessage({
        type: 'success',
        text: `Test email dispatched to ${testEmail}! Check inbox.`,
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
        <Loader2 className="w-5 h-5 text-zinc-500 animate-spin" />
        <p className="text-xs font-mono text-zinc-500">LOADING_CONFIG...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
      <div className="mb-6 pb-4 border-b border-zinc-900">
        <h2 className="text-lg font-semibold text-white tracking-tight">Settings</h2>
        <p className="text-xs text-zinc-400 mt-0.5">
          Save Gmail SMTP or a Resend API key. Campaigns send only after delivery is configured.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Form */}
        <div className="md:col-span-2">
          <form onSubmit={handleSave} className="bg-zinc-950 border border-zinc-800 rounded-xl p-5 sm:p-6 space-y-4">
            {saveMessage && (
              <div
                className={`p-3 rounded-lg text-xs font-mono flex items-center gap-2 ${
                  saveMessage.type === 'success'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}
              >
                {saveMessage.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                <span>{saveMessage.text}</span>
              </div>
            )}

            {/* Provider Selector */}
            <div>
              <label className="block text-xs font-mono text-zinc-400 mb-2">DELIVERY_PROVIDER</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setProvider('nodemailer')}
                  className={`flex flex-col items-center justify-center p-3 rounded-lg border text-xs font-mono gap-1 transition ${
                    provider === 'nodemailer'
                      ? 'bg-zinc-900 border-zinc-700 text-white'
                      : 'bg-black border-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Gmail SMTP</span>
                </button>

                <button
                  type="button"
                  onClick={() => setProvider('resend')}
                  className={`flex flex-col items-center justify-center p-3 rounded-lg border text-xs font-mono gap-1 transition ${
                    provider === 'resend'
                      ? 'bg-zinc-900 border-zinc-700 text-white'
                      : 'bg-black border-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  <Key className="w-3.5 h-3.5 text-zinc-300" />
                  <span>Resend API</span>
                </button>
              </div>
            </div>

            {/* Gmail SMTP */}
            {provider === 'nodemailer' && (
              <div className="p-3.5 bg-black border border-zinc-800 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono text-zinc-400 uppercase">
                    Gmail_Credentials
                  </span>
                  <a
                    href="https://myaccount.google.com/apppasswords"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] font-mono text-zinc-400 hover:text-white flex items-center gap-1 transition"
                  >
                    Get App Password <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                    GMAIL_ADDRESS
                  </label>
                  <input
                    type="email"
                    required
                    value={smtpUser}
                    onChange={(e) => {
                      setSmtpUser(e.target.value);
                      if (!fromEmail) setFromEmail(e.target.value);
                    }}
                    placeholder="yourname@gmail.com"
                    className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 text-xs font-mono"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-mono text-zinc-400">
                      16_CHAR_APP_PASSWORD
                    </label>
                    {hasExistingSmtpPass && (
                      <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> active
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showSmtpPass ? 'text' : 'password'}
                      value={smtpPass}
                      onChange={(e) => setSmtpPass(e.target.value)}
                      placeholder={hasExistingSmtpPass ? 'Enter new password to update' : 'abcd efgh ijkl mnop'}
                      className="w-full px-3 py-2 pr-10 rounded-lg bg-zinc-950 border border-zinc-800 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 text-xs font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSmtpPass(!showSmtpPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                    >
                      {showSmtpPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Resend Fields */}
            {provider === 'resend' && (
              <div className="p-3.5 bg-black border border-zinc-800 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono text-zinc-400 uppercase">
                    Resend_API_Key
                  </span>
                  {hasExistingKey && (
                    <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> active ({maskedKey})
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={hasExistingKey ? 'Enter new key to update' : 're_xxxxxxxxxxxxxxxxxxxx'}
                    className="w-full px-3 py-2 pr-10 rounded-lg bg-zinc-950 border border-zinc-800 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 text-xs font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                  >
                    {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                FROM_EMAIL
              </label>
              <input
                type="email"
                required
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                placeholder={provider === 'nodemailer' ? 'yourname@gmail.com' : 'hello@yourdomain.com'}
                className="w-full px-3 py-2 rounded-lg bg-black border border-zinc-800 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 text-xs transition font-mono"
              />
            </div>

            {/* From Name */}
            <div>
              <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                SENDER_DISPLAY_NAME
              </label>
              <input
                type="text"
                required
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="e.g. CampaignPulse"
                className="w-full px-3 py-2 rounded-lg bg-black border border-zinc-800 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 text-xs transition"
              />
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg font-medium text-black bg-white hover:bg-zinc-200 transition text-xs shadow-sm"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              SAVE_CONFIG
            </button>
          </form>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-mono uppercase text-zinc-300 flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5 text-zinc-400" /> Verify Dispatch
            </h3>
            <p className="text-[11px] text-zinc-500 font-mono">
              Send test email via active provider.
            </p>

            {testMessage && (
              <div
                className={`p-2.5 rounded text-[11px] font-mono flex items-start gap-1.5 ${
                  testMessage.type === 'success'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}
              >
                {testMessage.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
                <span>{testMessage.text}</span>
              </div>
            )}

            <div className="space-y-2">
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="your.email@gmail.com"
                className="w-full px-2.5 py-1.5 rounded-lg bg-black border border-zinc-800 text-white placeholder-zinc-600 text-xs font-mono focus:outline-none focus:border-zinc-500"
              />
              <button
                type="button"
                onClick={handleSendTestEmail}
                disabled={isSendingTest || !testEmail || !configured}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 text-white text-xs font-mono border border-zinc-800 transition"
              >
                {isSendingTest ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                SEND_TEST
              </button>
            </div>
          </div>

          <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-4 text-[11px] font-mono text-zinc-500 space-y-2">
            <div className="flex items-center gap-1.5 text-zinc-300">
              <Info className="w-3.5 h-3.5" /> GMAIL_TIPS
            </div>
            <p>
              Free limit: 500 emails/day directly from your personal Gmail.
            </p>
            <p>
              Make sure 2-Step Verification is ON, then create an App Password at <span className="text-zinc-400">apppasswords</span>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
