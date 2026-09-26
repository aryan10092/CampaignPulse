'use client';

import React from 'react';
import { Mail, Radio, PlusCircle, ListOrdered, Settings } from 'lucide-react';

interface HeaderProps {
  activeTab: 'create' | 'dashboard' | 'history' | 'settings';
  setActiveTab: (tab: 'create' | 'dashboard' | 'history' | 'settings') => void;
  isConnected: boolean;
  hasActiveCampaign: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  isConnected,
  hasActiveCampaign,
}) => {
  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('create')}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Mail className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight leading-none">
              CampaignPulse
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Bulk Email Manager &bull; BullMQ + Redis + NeonDB
            </p>
          </div>
        </div>

        {/* Navigation & Socket Status */}
        <div className="flex items-center gap-4">
          <nav className="flex items-center bg-slate-800/80 p-1 rounded-lg border border-slate-700/60 text-sm">
            <button
              onClick={() => setActiveTab('create')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-medium transition ${
                activeTab === 'create'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              New Campaign
            </button>

            {hasActiveCampaign && (
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-medium transition ${
                  activeTab === 'dashboard'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Radio className="w-4 h-4 animate-pulse text-emerald-400" />
                Live Monitor
              </button>
            )}

            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-medium transition ${
                activeTab === 'history'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ListOrdered className="w-4 h-4" />
              Campaigns
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-medium transition ${
                activeTab === 'settings'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Settings className="w-4 h-4" />
              Settings
            </button>
          </nav>

          {/* Connection status indicator */}
          <div
            className={`flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium border ${
              isConnected
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-emerald-400 animate-ping' : 'bg-rose-500'
              }`}
            />
            {isConnected ? 'Socket Live' : 'Connecting...'}
          </div>
        </div>
      </div>
    </header>
  );
};
