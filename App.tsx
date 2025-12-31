
import React, { useState, useEffect } from 'react';
import { HomeView } from './views/HomeView';
import { GameView } from './views/GameView';
import { LobbyView } from './views/LobbyView';
import { ProfileView } from './views/ProfileView';
import { RulesView } from './views/RulesView';
import { ViewState } from './types';
import { Swords, Shield, ScrollText, User } from 'lucide-react';
import { setSocketAuthToken } from './services/socket';

export default function App() {
  const [currentView, setCurrentView] = useState<ViewState>(ViewState.HOME);
  const [playerName, setPlayerName] = useState("亞瑟王候選人");
  const [initialRoomCode, setInitialRoomCode] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [pendingRoomCode, setPendingRoomCode] = useState<string | null>(null);

  const isAuthed = Boolean(authToken);

  const getNameFromJwt = (token: string): string | null => {
    try {
      const parts = token.split('.');
      if (parts.length < 2) return null;
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
      const json = decodeURIComponent(
        atob(padded)
          .split('')
          .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
          .join('')
      );
      const payload = JSON.parse(json);
      const name = typeof payload?.name === 'string' ? payload.name.trim() : '';
      return name ? name : null;
    } catch {
      return null;
    }
  };

  // Load auth token from localStorage
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      setAuthToken(token);
      setSocketAuthToken(token);
      const name = getNameFromJwt(token);
      if (name) setPlayerName(name);
    }
  }, []);

  // Check for room code in URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomCode = params.get('room');
    if (!roomCode) return;
    console.log('偵測到房間連結:', roomCode);
    // Require login before entering a room via invite link.
    if (localStorage.getItem('auth_token')) {
      setInitialRoomCode(roomCode);
      setCurrentView(ViewState.LOBBY);
    } else {
      setPendingRoomCode(roomCode);
      setCurrentView(ViewState.HOME);
    }
  }, []);

  const handleAuthSuccess = (token: string) => {
    localStorage.setItem('auth_token', token);
    setAuthToken(token);
    setSocketAuthToken(token);
    const name = getNameFromJwt(token);
    if (name) setPlayerName(name);
    if (pendingRoomCode) {
      setInitialRoomCode(pendingRoomCode);
      setPendingRoomCode(null);
      setCurrentView(ViewState.LOBBY);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    setAuthToken(null);
    setSocketAuthToken(null);
    setInitialRoomCode(null);
    setPendingRoomCode(null);
    setCurrentView(ViewState.HOME);
  };

  const handleCreateRoom = () => {
    setInitialRoomCode(null);
    setCurrentView(ViewState.LOBBY);
  };

  const handleJoinRoom = (roomCode: string) => {
    setInitialRoomCode(roomCode);
    setCurrentView(ViewState.LOBBY);
  };

  // Simple router based on state
  const renderView = () => {
    switch (currentView) {
      case ViewState.HOME:
        return (
          <HomeView
            onNavigate={setCurrentView}
            playerName={playerName}
            onPlayerNameChange={setPlayerName}
            isAuthed={isAuthed}
            pendingRoomCode={pendingRoomCode}
            onAuthSuccess={handleAuthSuccess}
            onLogout={handleLogout}
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
          />
        );
      case ViewState.LOBBY:
        return isAuthed ? (
          <LobbyView onNavigate={setCurrentView} playerName={playerName} initialRoomCode={initialRoomCode} />
        ) : (
          <HomeView
            onNavigate={setCurrentView}
            playerName={playerName}
            onPlayerNameChange={setPlayerName}
            isAuthed={false}
            pendingRoomCode={initialRoomCode}
            onAuthSuccess={handleAuthSuccess}
            onLogout={handleLogout}
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
          />
        );
      case ViewState.GAME:
        return isAuthed ? (
          <GameView onNavigate={setCurrentView} playerName={playerName} initialRoomCode={initialRoomCode} />
        ) : (
          <HomeView
            onNavigate={setCurrentView}
            playerName={playerName}
            onPlayerNameChange={setPlayerName}
            isAuthed={false}
            pendingRoomCode={initialRoomCode}
            onAuthSuccess={handleAuthSuccess}
            onLogout={handleLogout}
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
          />
        );
      case ViewState.PROFILE:
        return <ProfileView onNavigate={setCurrentView} />;
      case ViewState.RULES:
        return <RulesView onNavigate={setCurrentView} />;
      default:
        return (
          <HomeView
            onNavigate={setCurrentView}
            playerName={playerName}
            onPlayerNameChange={setPlayerName}
            isAuthed={isAuthed}
            pendingRoomCode={pendingRoomCode}
            onAuthSuccess={handleAuthSuccess}
            onLogout={handleLogout}
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
          />
        );
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
