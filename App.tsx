
import React, { useState, useEffect } from 'react';
import { HomeView } from './views/HomeView';
import { GameView } from './views/GameView';
import { LobbyView } from './views/LobbyView';
import { ProfileView } from './views/ProfileView';
import { RulesView } from './views/RulesView';
import { ViewState } from './types';
import { Swords, Shield, ScrollText, User } from 'lucide-react';

export default function App() {
  const [currentView, setCurrentView] = useState<ViewState>(ViewState.HOME);
  const [playerName, setPlayerName] = useState("亞瑟王候選人");
  const [initialRoomCode, setInitialRoomCode] = useState<string | null>(null);

  // Check for room code in URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomCode = params.get('room');
    if (roomCode) {
      console.log("偵測到房間連結:", roomCode);
      setInitialRoomCode(roomCode);
      setCurrentView(ViewState.LOBBY);
    }
  }, []);

  // Simple router based on state
  const renderView = () => {
    switch (currentView) {
      case ViewState.HOME:
        return <HomeView onNavigate={setCurrentView} playerName={playerName} onPlayerNameChange={setPlayerName} />;
      case ViewState.LOBBY:
        return <LobbyView onNavigate={setCurrentView} playerName={playerName} initialRoomCode={initialRoomCode} />;
      case ViewState.GAME:
        return <GameView onNavigate={setCurrentView} playerName={playerName} initialRoomCode={initialRoomCode} />;
      case ViewState.PROFILE:
        return <ProfileView onNavigate={setCurrentView} />;
      case ViewState.RULES:
        return <RulesView onNavigate={setCurrentView} />;
      default:
        return <HomeView onNavigate={setCurrentView} playerName={playerName} onPlayerNameChange={setPlayerName} />;
    }
  };

  return (
    <div className="min-h-[100dvh] bg-slate-950 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] text-slate-100 overflow-x-hidden relative selection:bg-amber-700 selection:text-white">
      {/* Background decorative elements */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20 bg-gradient-to-b from-indigo-900/30 to-black"></div>

      {/* Main Content Area */}
      <div className="relative z-10 min-h-[100dvh] flex flex-col">
         {renderView()}
      </div>

      {/* Mobile Sticky Navigation */}
      {currentView !== ViewState.GAME && (
        <nav className="fixed bottom-0 left-0 w-full bg-slate-900/90 backdrop-blur-md border-t border-slate-700 z-50 pb-safe">
          <div className="flex justify-around items-center p-3">
            <NavBtn icon={<Swords size={20} />} label="對戰" active={currentView === ViewState.HOME || currentView === ViewState.LOBBY} onClick={() => setCurrentView(ViewState.HOME)} />
            <NavBtn icon={<ScrollText size={20} />} label="規則" active={currentView === ViewState.RULES} onClick={() => setCurrentView(ViewState.RULES)} />
            <NavBtn icon={<Shield size={20} />} label="排位" active={false} onClick={() => alert('賽季排位即將開啟')} />
            <NavBtn icon={<User size={20} />} label="戰績" active={currentView === ViewState.PROFILE} onClick={() => setCurrentView(ViewState.PROFILE)} />
          </div>
        </nav>
      )}
    </div>
  );
}

const NavBtn = ({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center gap-1 text-xs transition-colors ${active ? 'text-amber-500' : 'text-slate-400 hover:text-slate-200'}`}
  >
    {icon}
    <span>{label}</span>
  </button>
);
