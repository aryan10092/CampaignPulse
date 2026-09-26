'use client';

import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, Send, Sparkles, FileText, AlertCircle, Settings } from 'lucide-react';
import { API_URL } from '../lib/config';
import { apiFetch } from '../lib/api';

interface CreateCampaignFormProps {
  onCampaignCreated: (campaignId: string) => void;
  onOpenSettings: () => void;
}

export const CreateCampaignForm: React.FC<CreateCampaignFormProps> = ({
  onCampaignCreated,
  onOpenSettings,
}) => {
  const [title, setTitle] = useState('Diwali Special Offer 2026');
  const [subject, setSubject] = useState('Exclusive Diwali Festive Offer for You');
  const [body, setBody] = useState(
    'Hi {name},\n\nWishing you and your family a joyous Diwali! Use code DIWALI50 to claim 50% off on your next purchase.\n\nBest regards,\nTeam'
  );
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [deliveryReady, setDeliveryReady] = useState<boolean | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch('/api/settings');
        if (!res.ok) {
          if (!cancelled) setDeliveryReady(false);
          return;
        }
        const data = await res.json();
        if (!cancelled) setDeliveryReady(Boolean(data.configured));
      } catch {
        if (!cancelled) setDeliveryReady(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.endsWith('.csv')) {
        setFile(droppedFile);
        setError(null);
      } else {
        setError('Only .csv files are supported.');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleLoadSampleData = async () => {
    try {
      const firstNames = ['Aarav', 'Ananya', 'Rohan', 'Priya', 'Aditya', 'Sneha', 'Vikram', 'Neha', 'Rahul', 'Pooja', 'Amit', 'Divya', 'Siddharth', 'Tanvi'];
      const lastNames = ['Sharma', 'Patel', 'Verma', 'Gupta', 'Singh', 'Kumar', 'Joshi', 'Mehta', 'Nair', 'Reddy', 'Chopra', 'Rao', 'Iyer', 'Das'];
      const domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'example.com', 'company.org'];

      let csvContent = 'name,email\n';
      for (let i = 1; i <= 25; i++) {
        const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
        const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
        const domain = domains[Math.floor(Math.random() * domains.length)];
        const fullName = `${firstName} ${lastName}`;
        const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@${domain}`;
        csvContent += `"${fullName}","${email}"\n`;
      }

      const sampleFile = new File([csvContent], 'customers.csv', { type: 'text/csv' });
      setFile(sampleFile);
      setError(null);
    } catch {
      setError('Could not generate sample file.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please select or upload a customers CSV file.');
      return;
    }
    if (deliveryReady === false) {
      setError('Save Gmail SMTP or a Resend API key in Settings before launching a campaign.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('subject', subject);
      formData.append('body', body);
      formData.append('file', file);

      const token = typeof window !== 'undefined' ? localStorage.getItem('cp_token') : null;
      const res = await fetch(`${API_URL}/api/campaigns/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload campaign');
      }

      onCampaignCreated(data.campaignId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong while launching the campaign.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      <div className="border border-zinc-800 bg-zinc-950 rounded-xl p-6 sm:p-7 shadow-2xl">
        <div className="flex items-center justify-between mb-6 pb-5 border-b border-zinc-900">
          <div>
            <h2 className="text-lg font-semibold text-white tracking-tight">
              Create Campaign
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Upload a customer CSV. Mail is sent with your saved Gmail SMTP or Resend credentials.
            </p>
          </div>
          <button
            type="button"
            onClick={handleLoadSampleData}
            className="flex items-center gap-1.5 text-xs font-mono px-2.5 py-1.5 rounded-md bg-zinc-900 text-zinc-300 border border-zinc-800 hover:border-zinc-700 hover:text-white transition"
          >
            <Sparkles className="w-3.5 h-3.5 text-zinc-400" />
             Sample CSV
          </button>
        </div>

        {deliveryReady === false && (
          <div className="mb-5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-mono flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p>Delivery is not configured. Save Gmail SMTP or a Resend API key before launching.</p>
              <button
                type="button"
                onClick={onOpenSettings}
                className="mt-2 inline-flex items-center gap-1.5 text-white hover:text-zinc-200"
              >
                <Settings className="w-3 h-3" />
                Open Settings
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-mono">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Campaign Title */}
          <div>
            <label className="block text-xs font-mono text-zinc-400 mb-1.5">
              CAMPAIGN_NAME
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Diwali Offer 2026"
              className="w-full px-3.5 py-2 rounded-lg bg-black border border-zinc-800 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 text-sm transition"
            />
          </div>

          {/* Subject Line */}
          <div>
            <label className="block text-xs font-mono text-zinc-400 mb-1.5">
              EMAIL_SUBJECT
            </label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Exclusive Diwali discounts for you"
              className="w-full px-3.5 py-2 rounded-lg bg-black border border-zinc-800 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 text-sm transition"
            />
          </div>

          {/* Email Body */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-mono text-zinc-400">
                BODY_TEMPLATE
              </label>
              <button
                type="button"
                onClick={() => setBody((prev) => prev + ' {name}')}
                className="text-[11px] font-mono text-zinc-400 hover:text-white transition"
              >
                + insert {'{name}'}
              </button>
            </div>
            <textarea
              required
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your email body here..."
              className="w-full px-3.5 py-2.5 rounded-lg bg-black border border-zinc-800 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 text-xs font-mono transition leading-relaxed"
            />
          </div>

          {/* CSV File Upload Dropzone */}
          <div>
            <label className="block text-xs font-mono text-zinc-400 mb-1.5">
              CUSTOMERS_CSV
            </label>
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative border border-dashed rounded-lg p-5 text-center cursor-pointer transition ${
                dragActive
                  ? 'border-white bg-zinc-900/60'
                  : file
                  ? 'border-zinc-700 bg-zinc-900/30'
                  : 'border-zinc-800 hover:border-zinc-700 bg-black/60'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileChange}
              />

              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <div className="w-8 h-8 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <div className="text-white font-medium text-xs font-mono">{file.name}</div>
                    <div className="text-[11px] text-zinc-500">
                      {(file.size / 1024).toFixed(1)} KB &bull; click to change
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1.5 py-1">
                  <UploadCloud className="w-5 h-5 text-zinc-500" />
                  <div className="text-xs text-zinc-300 font-medium">
                    Drag and drop <span className="font-mono text-white">.csv</span> or browse
                  </div>
                  <div className="text-[11px] text-zinc-500 font-mono">
                    Must include email column (name optional)
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting || !file || deliveryReady === false}
              className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-medium text-xs tracking-wide transition ${
                isSubmitting || !file || deliveryReady === false
                  ? 'bg-zinc-900 text-zinc-600 border border-zinc-800 cursor-not-allowed'
                  : 'bg-white text-black hover:bg-zinc-200 shadow-sm'
              }`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-zinc-600 border-t-black rounded-full animate-spin" />
                  <span>STREAMING_CSV_AND_ENQUEUING...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>LAUNCH_CAMPAIGN_BLAST</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
