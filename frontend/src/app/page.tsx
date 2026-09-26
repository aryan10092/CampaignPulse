'use client';

import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { CreateCampaignForm } from '../components/CreateCampaignForm';
import { CampaignDashboard } from '../components/CampaignDashboard';
import { CampaignsList } from '../components/CampaignsList';
import { SettingsView } from '../components/SettingsView';
import { getSocket } from '../lib/socket';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'create' | 'dashboard' | 'history' | 'settings'>('create');
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const socket = getSocket();

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
  }, []);

  const handleCampaignCreated = (campaignId: string) => {
    setActiveCampaignId(campaignId);
    setActiveTab('dashboard');
  };

  const handleSelectCampaign = (campaignId: string) => {
    setActiveCampaignId(campaignId);
    setActiveTab('dashboard');
  };

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
          <CreateCampaignForm onCampaignCreated={handleCampaignCreated} />
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
