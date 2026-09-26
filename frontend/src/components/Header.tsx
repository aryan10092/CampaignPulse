'use client';

import React from 'react';
import { Mail, Radio, PlusCircle, ListOrdered, Settings, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

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
  const { user, logout } = useAuth();

  return (
    <header className="border-b border-zinc-900 bg-black/90 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Brand */}
        <div
          className="flex items-center gap-2.5 cursor-pointer group"
          onClick={() => setActiveTab('create')}
        >
          <div className="w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-100 group-hover:border-zinc-700 transition">
            <Mail className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white tracking-tight">
              CampaignPulse
            </span>
            <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
              v2.0
            </span>
          </div>
        </div>

        {/* Navigation & Socket Status */}
        <div className="flex items-center gap-3">
          <nav className="flex items-center bg-zinc-950 p-1 rounded-lg border border-zinc-900 text-xs">
            <button
              onClick={() => setActiveTab('create')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition ${
                activeTab === 'create'
                  ? 'bg-zinc-900 text-white border border-zinc-800 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              New
            </button>

            {hasActiveCampaign && (
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition ${
                  activeTab === 'dashboard'
                    ? 'bg-zinc-900 text-white border border-zinc-800 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                Live Monitor
              </button>
            )}

            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition ${
                activeTab === 'history'
                  ? 'bg-zinc-900 text-white border border-zinc-800 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <ListOrdered className="w-3.5 h-3.5" />
              Campaigns
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition ${
                activeTab === 'settings'
                  ? 'bg-zinc-900 text-white border border-zinc-800 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              Settings
            </button>
          </nav>

          {/* Connection status */}
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-md text-[11px] font-mono border border-zinc-900 bg-zinc-950 text-zinc-400">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isConnected ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-rose-500'
              }`}
            />
            <span>{isConnected ? 'connected' : 'offline'}</span>
          </div>

          {/* User info + logout */}
          {user && (
            <div className="flex items-center gap-2 pl-2 border-l border-zinc-800">
              <span className="text-[11px] font-mono text-zinc-500 hidden sm:block max-w-[120px] truncate">
                {user.email}
              </span>
              <button
                onClick={logout}
                title="Sign out"
                className="p-1.5 rounded-md text-zinc-500 hover:text-rose-400 hover:bg-zinc-900 transition"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
