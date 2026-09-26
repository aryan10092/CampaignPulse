'use client';

import React, { useState, useRef } from 'react';
import { UploadCloud, Send, Sparkles, Check } from 'lucide-react';

interface CreateCampaignFormProps {
  onCampaignCreated: (campaignId: string) => void;
}

export const CreateCampaignForm: React.FC<CreateCampaignFormProps> = ({
  onCampaignCreated,
}) => {
  const [title, setTitle] = useState('Diwali Special Offer 2026');
  const [subject, setSubject] = useState('✨ Exclusive 50% Diwali Discount For You!');
  const [body, setBody] = useState(
    'Hi {name},\n\nWishing you and your loved ones a very Happy Diwali! Enjoy 50% off on all our premium products with code DIWALI50.\n\nWarm regards,\nThe Marketing Team'
  );
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Helper to quickly load the generated 1,000 customers sample CSV
  const handleLoadSampleData = async () => {
    try {
      let csvContent = 'name,email\n';
      const names = [
        'Aarav Sharma', 'Priya Patel', 'Rohan Verma', 'Sneha Gupta',
        'Aditya Singh', 'Ananya Kumar', 'Vikram Joshi', 'Neha Mehta'
      ];
      for (let i = 1; i <= 1000; i++) {
        const name = names[i % names.length];
        const email = `customer${i}@example.com`;
        csvContent += `"${name}","${email}"\n`;
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

    setIsSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('subject', subject);
      formData.append('body', body);
      formData.append('file', file);

      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      const res = await fetch(`${API_URL}/api/campaigns/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload campaign');
      }

      // Switch to dashboard view
      onCampaignCreated(data.campaignId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong while launching the campaign.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl shadow-slate-950/50">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Create New Email Campaign
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Upload customer list and dispatch jobs asynchronously via BullMQ & Redis.
            </p>
          </div>
          <button
            type="button"
            onClick={handleLoadSampleData}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/20 transition"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Quick 1,000 Sample CSV
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Campaign Title */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Campaign Name
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Diwali Offer 2026"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm transition"
            />
          </div>

          {/* Subject Line */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Email Subject
            </label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Exclusive Diwali discounts for you"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm transition"
            />
          </div>

          {/* Email Body */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-slate-300">
                Email Content Template
              </label>
              <button
                type="button"
                onClick={() => setBody((prev) => prev + ' {name}')}
                className="text-xs text-indigo-400 hover:text-indigo-300"
              >
                + Insert {'{name}'} tag
              </button>
            </div>
            <textarea
              required
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your email body here..."
              className="w-full px-4 py-3 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm transition font-mono"
            />
          </div>

          {/* CSV File Upload Dropzone */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Recipients List (CSV)
            </label>
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition ${
                dragActive
                  ? 'border-indigo-500 bg-indigo-500/10'
                  : file
                  ? 'border-emerald-500/50 bg-emerald-500/5'
                  : 'border-slate-700 hover:border-slate-600 bg-slate-800/30'
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
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <Check className="w-6 h-6" />
                  </div>
                  <div className="text-white font-medium text-sm">{file.name}</div>
                  <div className="text-xs text-slate-400">
                    {(file.size / 1024).toFixed(1)} KB &bull; Click or drop to replace
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <div className="text-sm font-medium text-slate-200">
                    Click to browse or drag and drop your CSV
                  </div>
                  <div className="text-xs text-slate-500">
                    Must have an <code className="text-slate-400">email</code> and optional <code className="text-slate-400">name</code> column
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || !file}
            className={`w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-semibold text-white shadow-lg transition ${
              isSubmitting || !file
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-indigo-500/25'
            }`}
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                Streaming CSV & Enqueuing Jobs...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Launch Campaign Blast
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
