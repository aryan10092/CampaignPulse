'use client';

import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { CreateCampaignForm } from '../components/CreateCampaignForm';
import { CampaignDashboard } from '../components/CampaignDashboard';
import { CampaignsList } from '../components/CampaignsList';
import { SettingsView } from '../components/SettingsView';
import { AuthPage } from '../components/AuthPage';
import { getSocket } from '../lib/socket';
import { useAuth } from '../context/AuthContext';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const { user, token, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<'create' | 'dashboard' | 'history' | 'settings'>('create');
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!user || !token) {
      setIsConnected(false);
      return;
    }

    const socket = getSocket(token);

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    if (socket.connected) {
      setIsConnected(true);
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, [user, token]);

  const handleCampaignCreated = (campaignId: string) => {
    setActiveCampaignId(campaignId);
    setActiveTab('dashboard');
  };

  const handleSelectCampaign = (campaignId: string) => {
    setActiveCampaignId(campaignId);
    setActiveTab('dashboard');
  };

  // Show loading spinner while rehydrating auth state
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-zinc-500 animate-spin" />
      </div>
    );
  }

  // Show login/register page if not authenticated
  if (!user) {
    return <AuthPage />;
  }

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col font-sans selection:bg-white selection:text-black">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isConnected={isConnected}
        hasActiveCampaign={Boolean(activeCampaignId)}
      />

      <main className="flex-1">
        {activeTab === 'create' && (
          <CreateCampaignForm
            onCampaignCreated={handleCampaignCreated}
            onOpenSettings={() => setActiveTab('settings')}
          />
        )}

        {activeTab === 'dashboard' && activeCampaignId && (
          <CampaignDashboard
            campaignId={activeCampaignId}
            onBack={() => setActiveTab('history')}
          />
        )}

        {activeTab === 'history' && (
          <CampaignsList
            onSelectCampaign={handleSelectCampaign}
            onNewCampaign={() => setActiveTab('create')}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView />
        )}
      </main>

      <footer className="border-t border-zinc-900 py-5 text-center text-[11px] font-mono text-zinc-600">
        CampaignPulse &bull; Made By Aryan Gupta
      </footer>
    </div>
  );
}
